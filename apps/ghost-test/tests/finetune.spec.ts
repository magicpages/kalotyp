import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Finetune E2E. Sets saturation -100 and brightness +60, saves, and
 * verifies the uploaded file has near-zero R/G/B divergence (grayscale)
 * and higher mean luminance than the source. Gated on Ghost admin
 * credentials.
 */

const FIXTURE = resolve(HERE, 'fixtures/feature.png');

const adminEmail = process.env.GHOST_ADMIN_EMAIL ?? '';
const adminPassword = process.env.GHOST_ADMIN_PASSWORD ?? '';
const kalotypJs = process.env.KALOTYP_JS_URL ?? 'http://localhost:5174/kalotyp.js';
const kalotypCss = process.env.KALOTYP_CSS_URL ?? 'http://localhost:5174/kalotyp.css';

const credentialsMissing = !adminEmail || !adminPassword;

test.describe('Ghost integration — finetune', () => {
  test.skip(
    credentialsMissing,
    'Set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD against a running Ghost (see README.md).',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await configureIntegration(page, kalotypJs, kalotypCss);
  });

  test('saturation -100 + brightness +60 → upload is grayscale and brighter', async ({ page }) => {
    await page.goto('/ghost/#/posts');
    await page.getByRole('link', { name: /new post/i }).click();

    const [originalUpload] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes('/ghost/api/admin/images/upload') && response.ok(),
      ),
      page.getByLabel(/feature image/i).setInputFiles(FIXTURE),
    ]);
    expect(originalUpload.status()).toBe(201);

    const sourceUrl = ((await originalUpload.json()) as { images: Array<{ url: string }> })
      .images[0]?.url;
    expect(sourceUrl).toBeTruthy();

    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page.locator('.pintura-editor')).toBeVisible();

    await page.locator('.kalotyp-util-nav-button[data-utility-id="finetune"]').click();
    await expect(page.locator('.kalotyp-finetune-panel')).toBeVisible();

    // Programmatic value changes don't fire synthetic input events in
    // headless browsers, so both `input` (live preview) and `change`
    // (commit) are dispatched explicitly.
    await page.evaluate(() => {
      const setSlider = (key: string, value: number) => {
        const row = document.querySelector(
          `.kalotyp-finetune-row[data-adjustment="${key}"]`,
        ) as HTMLElement | null;
        const slider = row?.querySelector('.kalotyp-finetune-slider') as HTMLInputElement | null;
        if (!slider) throw new Error(`slider for ${key} not found`);
        slider.value = String(value);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setSlider('saturation', -100);
      setSlider('brightness', 60);
    });

    const [editedUpload] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/ghost/api/admin/images/upload') && response.status() === 201,
      ),
      page.locator('.kalotyp-button-export').click(),
    ]);

    await expect(page.locator('.pintura-editor')).toHaveCount(0);

    const uploadedUrl = ((await editedUpload.json()) as { images: Array<{ url: string }> })
      .images[0]?.url;
    expect(uploadedUrl).toBeTruthy();

    // Compute per-pixel grayscale-ness (avg |R-G|+|G-B|) and mean luminance.
    const stats = await page.evaluate(
      ([originalUrl, editedUrl]) =>
        Promise.all(
          [originalUrl, editedUrl].map(
            (url) =>
              new Promise<{
                width: number;
                height: number;
                rgDiff: number;
                gbDiff: number;
                meanY: number;
              }>((resolveImg, rejectImg) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  const c = document.createElement('canvas');
                  c.width = img.naturalWidth;
                  c.height = img.naturalHeight;
                  const ctx = c.getContext('2d', { willReadFrequently: true });
                  if (!ctx) {
                    rejectImg(new Error('no 2d context'));
                    return;
                  }
                  ctx.drawImage(img, 0, 0);
                  const data = ctx.getImageData(0, 0, c.width, c.height).data;
                  let rgSum = 0;
                  let gbSum = 0;
                  let ySum = 0;
                  let samples = 0;
                  // Sample one pixel per 100 — statistically sufficient.
                  for (let i = 0; i < data.length; i += 400) {
                    const r = data[i] ?? 0;
                    const g = data[i + 1] ?? 0;
                    const b = data[i + 2] ?? 0;
                    rgSum += Math.abs(r - g);
                    gbSum += Math.abs(g - b);
                    ySum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    samples++;
                  }
                  resolveImg({
                    width: c.width,
                    height: c.height,
                    rgDiff: rgSum / samples,
                    gbDiff: gbSum / samples,
                    meanY: ySum / samples,
                  });
                };
                img.onerror = () => rejectImg(new Error(`Failed to fetch ${url}`));
                img.src = url;
              }),
          ),
        ),
      [sourceUrl, uploadedUrl] as const,
    );

    const [sourceStats, editedStats] = stats;
    expect(sourceStats).toBeDefined();
    expect(editedStats).toBeDefined();
    if (!sourceStats || !editedStats) throw new Error('image decode failed');

    // Bar of 6 accounts for JPEG chroma noise (true grayscale is 0).
    expect(editedStats.rgDiff + editedStats.gbDiff).toBeLessThan(6);
    expect(sourceStats.rgDiff + sourceStats.gbDiff).toBeGreaterThan(
      editedStats.rgDiff + editedStats.gbDiff + 5,
    );

    // Brightness +60 maps to +30 in normalised space; require at least
    // +20 luminance units higher than the source.
    expect(editedStats.meanY).toBeGreaterThan(sourceStats.meanY + 20);
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
