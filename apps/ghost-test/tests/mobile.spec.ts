import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, expect, type Page, test } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Mobile E2E. Runs against a real Ghost admin under an iPhone 13
 * touch-emulated profile (390×844) and verifies: shell mounts without
 * horizontal page scroll; all utility tabs are reachable; touch-only
 * gestures drive the crop handle and export. Gated on Ghost admin
 * credentials. Emulation complements but does not replace real-hardware
 * verification.
 */

const FIXTURE = resolve(HERE, 'fixtures/feature.png');

const adminEmail = process.env.GHOST_ADMIN_EMAIL ?? '';
const adminPassword = process.env.GHOST_ADMIN_PASSWORD ?? '';
const kalotypJs = process.env.KALOTYP_JS_URL ?? 'http://localhost:5174/kalotyp.js';
const kalotypCss = process.env.KALOTYP_CSS_URL ?? 'http://localhost:5174/kalotyp.css';

const credentialsMissing = !adminEmail || !adminPassword;

// `test.use(devices[…])` must live at the file level (not in describe)
// because the iPhone profile sets `defaultBrowserType: 'webkit'` and
// per-describe worker forks aren't allowed.
test.use({ ...devices['iPhone 13'] });

test.describe('Ghost integration — mobile (touch + portrait)', () => {
  test.skip(
    credentialsMissing,
    'Set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD against a running Ghost (see README.md).',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await configureIntegration(page, kalotypJs, kalotypCss);
  });

  test('Editor opens at phone viewport, all seven utility tabs reachable, touch-driven crop saves', async ({
    page,
  }) => {
    await page.goto('/ghost/#/posts');
    await page.getByRole('link', { name: /new post/i }).click();

    const [originalUpload] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes('/ghost/api/admin/images/upload') && response.ok(),
      ),
      page.getByLabel(/feature image/i).setInputFiles(FIXTURE),
    ]);
    expect(originalUpload.status()).toBe(201);

    // `tap()` exercises the touch pipeline; the desktop spec uses
    // `click()` for the mouse pipeline.
    await page.getByRole('button', { name: /edit/i }).tap();
    await expect(page.locator('.pintura-editor')).toBeVisible();

    // No horizontal page scroll: scrollWidth must equal clientWidth.
    const scrollOk = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth <= html.clientWidth;
    });
    expect(scrollOk).toBe(true);

    // The nav scrolls horizontally on narrow viewports; all buttons
    // are in the DOM regardless of visibility.
    const tabs = page.locator('.kalotyp-util-nav-button');
    await expect(tabs).toHaveCount(7);

    // `scrollIntoViewIfNeeded` before tap mirrors the runtime behaviour:
    // a user scrolls the strip to reach an off-screen tab.
    for (const id of ['rotate', 'flip', 'filter', 'finetune', 'annotate', 'resize', 'crop']) {
      const tab = page.locator(`.kalotyp-util-nav-button[data-utility-id="${id}"]`);
      await tab.scrollIntoViewIfNeeded();
      await tab.tap();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    // `mouse.down()` doesn't fire Pointer Events with
    // `pointerType: 'touch'`, so the corner-handle drag is dispatched
    // via raw PointerEvents (see `touchDragWithin` below).
    const handle = page.locator('.kalotyp-handle[data-direction="br"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('br handle has no bounding box');
    await touchDragWithin(page, '.kalotyp-stage-container', {
      from: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      delta: { dx: -60, dy: -60 },
    });

    // Save and close — touch the export button.
    const exportButton = page.locator('.kalotyp-button-export');
    await exportButton.scrollIntoViewIfNeeded();
    const [editedUpload] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/ghost/api/admin/images/upload') && response.status() === 201,
      ),
      exportButton.tap(),
    ]);
    expect(editedUpload.status()).toBe(201);

    // Editor cleans up after `process` fires (contract §8.2).
    await expect(page.locator('.pintura-editor')).toHaveCount(0);
  });

  test('Touch-target sizes meet WCAG 2.5.5 (≥44×44 effective hit area on key controls)', async ({
    page,
  }) => {
    // Regression catcher for the `(pointer: coarse)` rules in
    // mobile.css — a refactor dropping the ::before extension or a
    // CSS-import ordering bug would silently break this.
    await page.goto('/ghost/#/posts');
    await page.getByRole('link', { name: /new post/i }).click();
    await page.getByLabel(/feature image/i).setInputFiles(FIXTURE);
    await page.waitForResponse(
      (response) => response.url().includes('/ghost/api/admin/images/upload') && response.ok(),
    );
    await page.getByRole('button', { name: /edit/i }).tap();
    await expect(page.locator('.pintura-editor')).toBeVisible();

    await expect(page.locator('.kalotyp-handle[data-direction="br"]')).toBeVisible();

    // Read an element's effective hit-area, including any `::before`
    // pseudo-element extension. Negative inset values mean the
    // pseudo-element extends outward beyond the host.
    const hitArea = async (selector: string): Promise<{ width: number; height: number }> =>
      page.evaluate((sel) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return { width: 0, height: 0 };
        const rect = el.getBoundingClientRect();
        const before = window.getComputedStyle(el, '::before');
        const top = Number.parseFloat(before.top) || 0;
        const right = Number.parseFloat(before.right) || 0;
        const bottom = Number.parseFloat(before.bottom) || 0;
        const left = Number.parseFloat(before.left) || 0;
        return {
          width: rect.width + Math.max(0, -left) + Math.max(0, -right),
          height: rect.height + Math.max(0, -top) + Math.max(0, -bottom),
        };
      }, selector);

    const closeArea = await hitArea('.kalotyp-button-close');
    expect(closeArea.width, 'close button hit width').toBeGreaterThanOrEqual(44);
    expect(closeArea.height, 'close button hit height').toBeGreaterThanOrEqual(44);

    const cornerArea = await hitArea('.kalotyp-handle[data-direction="br"]');
    expect(cornerArea.width, 'corner manipulator hit width').toBeGreaterThanOrEqual(44);
    expect(cornerArea.height, 'corner manipulator hit height').toBeGreaterThanOrEqual(44);

    // Sliders use a 44px direct height (no ::before).
    await page.locator('.kalotyp-util-nav-button[data-utility-id="rotate"]').tap();
    await expect(page.locator('.kalotyp-rotate-slider')).toBeVisible();
    const sliderBox = await page.locator('.kalotyp-rotate-slider').boundingBox();
    expect(sliderBox).toBeTruthy();
    expect(sliderBox?.height ?? 0, 'rotate slider height').toBeGreaterThanOrEqual(44);
  });
});

/**
 * Synthesise a pointer-touch drag via PointerEvents. CDP's
 * `Input.dispatchTouchEvent` would only work on Chromium; dispatching
 * PointerEvents directly works uniformly in Chromium / WebKit / Firefox.
 * The element captures the pointer on down (the editor's gesture helper
 * calls `setPointerCapture`), so subsequent moves keep routing to it.
 */
async function touchDragWithin(
  page: Page,
  hostSelector: string,
  drag: { from: { x: number; y: number }; delta: { dx: number; dy: number } },
): Promise<void> {
  await page.evaluate(
    ({ host, from, delta }) => {
      const el = document.elementFromPoint(from.x, from.y) as HTMLElement | null;
      // If elementFromPoint lands on a hit-area extension or sibling,
      // fall back to the host and let setPointerCapture stretch from there.
      const target = el?.closest('.kalotyp-handle')
        ? (el.closest('.kalotyp-handle') as HTMLElement)
        : (document.querySelector(host) as HTMLElement);
      if (!target) return;
      const dispatch = (type: string, x: number, y: number): void => {
        target.dispatchEvent(
          new PointerEvent(type, {
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            composed: true,
          }),
        );
      };
      dispatch('pointerdown', from.x, from.y);
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        dispatch('pointermove', from.x + (delta.dx * i) / steps, from.y + (delta.dy * i) / steps);
      }
      dispatch('pointerup', from.x + delta.dx, from.y + delta.dy);
    },
    { host: hostSelector, from: drag.from, delta: drag.delta },
  );
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/ghost/#/signin');
  if (
    await page
      .getByLabel('Email')
      .isVisible({ timeout: 2000 })
      .catch(() => false)
  ) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/ghost\/#\/(dashboard|posts)/, { timeout: 30_000 });
  }
}

async function configureIntegration(page: Page, jsUrl: string, cssUrl: string): Promise<void> {
  await page.goto('/ghost/#/settings/integrations/pintura');
  const toggle = page.getByRole('switch').first();
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
  await page.getByLabel(/javascript url/i).fill(jsUrl);
  await page.getByLabel(/css url/i).fill(cssUrl);
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();
}
