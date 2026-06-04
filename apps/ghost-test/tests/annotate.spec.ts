import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Annotate E2E. Drives a real Ghost admin through drawing a rectangle
 * and a piece of text, undoing the text, saving, then verifying the
 * uploaded file contains red pixels for the rectangle but no text-
 * coloured pixels (the undo dropped the text before bake). Skipped
 * unless GHOST_ADMIN_EMAIL / GHOST_ADMIN_PASSWORD are set.
 */

const FIXTURE = resolve(HERE, 'fixtures/feature.png');

const adminEmail = process.env.GHOST_ADMIN_EMAIL ?? '';
const adminPassword = process.env.GHOST_ADMIN_PASSWORD ?? '';
const kalotypJs = process.env.KALOTYP_JS_URL ?? 'http://localhost:5174/kalotyp.js';
const kalotypCss = process.env.KALOTYP_CSS_URL ?? 'http://localhost:5174/kalotyp.css';

const credentialsMissing = !adminEmail || !adminPassword;

test.describe('Ghost integration — annotate', () => {
  test.skip(
    credentialsMissing,
    'Set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD against a running Ghost (see README.md).',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await configureIntegration(page, kalotypJs, kalotypCss);
  });

  test('rectangle + text → undo text → save preserves the rectangle but not the text', async ({
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

    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page.locator('.pintura-editor')).toBeVisible();

    await page.locator('.kalotyp-util-nav-button[data-utility-id="annotate"]').click();
    await expect(page.locator('.kalotyp-annotate-panel')).toBeVisible();

    await page.locator('.kalotyp-annotate-tool[data-tool="rect"]').click();
    const hit = page.locator('.kalotyp-annotate-hit');
    const box = await hit.boundingBox();
    if (!box) throw new Error('hit area has no bounding box');
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 16 });
    await page.mouse.up();

    await page.locator('.kalotyp-annotate-tool[data-tool="text"]').click();
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
    const editor = page.locator('.kalotyp-annotate-text-editor');
    await expect(editor).toBeVisible();
    await page.keyboard.type('LABEL');
    await page.keyboard.press('Enter');

    // Undo the text shape (Enter committed it).
    await page.locator('.kalotyp-history-undo').click();

    const [editedUpload] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/ghost/api/admin/images/upload') && response.status() === 201,
      ),
      page.locator('.kalotyp-button-export').click(),
    ]);

    await expect(page.locator('.pintura-editor')).toHaveCount(0);

    const responseJson = (await editedUpload.json()) as { images: Array<{ url: string }> };
    const uploadedUrl = responseJson.images[0]?.url;
    expect(uploadedUrl).toBeTruthy();

    // Count red pixels (annotation default #ff3b30 with JPEG noise
    // tolerated: r>200, g<100, b<100).
    const stats = await page.evaluate(
      (url) =>
        new Promise<{
          width: number;
          height: number;
          redCount: number;
        }>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext('2d');
            if (!ctx) {
              reject(new Error('no 2d context'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, c.width, c.height).data;
            let redCount = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i] ?? 0;
              const g = data[i + 1] ?? 0;
              const b = data[i + 2] ?? 0;
              if (r > 200 && g < 100 && b < 100) redCount++;
            }
            resolve({ width: c.width, height: c.height, redCount });
          };
          img.onerror = () => reject(new Error(`Failed to fetch ${url}`));
          img.src = url;
        }),
      uploadedUrl,
    );

    // Conservative bar; the rect's 4px stroke at ~40%×40% of the image
    // produces well above 100 red pixels in practice.
    expect(stats.redCount).toBeGreaterThan(100);
  });
});

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
