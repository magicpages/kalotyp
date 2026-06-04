import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Filter E2E. Picks the Vivid preset, saves, and verifies the uploaded
 * image has higher per-pixel chroma divergence than the source (Vivid
 * is +40 saturation / +10 contrast). Also verifies the filter/finetune
 * state-sharing promise by reading the Finetune sliders after picking
 * Vivid. Gated on Ghost admin credentials.
 */

const FIXTURE = resolve(HERE, 'fixtures/feature.png');

const adminEmail = process.env.GHOST_ADMIN_EMAIL ?? '';
const adminPassword = process.env.GHOST_ADMIN_PASSWORD ?? '';
const kalotypJs = process.env.KALOTYP_JS_URL ?? 'http://localhost:5174/kalotyp.js';
const kalotypCss = process.env.KALOTYP_CSS_URL ?? 'http://localhost:5174/kalotyp.css';

const credentialsMissing = !adminEmail || !adminPassword;

test.describe('Ghost integration — filter', () => {
  test.skip(
    credentialsMissing,
    'Set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD against a running Ghost (see README.md).',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await configureIntegration(page, kalotypJs, kalotypCss);
  });

  test('Vivid preset → upload is more saturated than source; sliders mirror preset', async ({
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

    const sourceUrl = ((await originalUpload.json()) as { images: Array<{ url: string }> })
      .images[0]?.url;
    expect(sourceUrl).toBeTruthy();

    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page.locator('.pintura-editor')).toBeVisible();

    await page.locator('.kalotyp-util-nav-button[data-utility-id="filter"]').click();
    await expect(page.locator('.kalotyp-filter-panel')).toBeVisible();
    await expect(page.locator('.kalotyp-filter-thumb')).toHaveCount(7);

    // None is active by default (source has zero adjustments).
    await expect(page.locator('.kalotyp-filter-thumb[data-preset-id="none"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.locator('.kalotyp-filter-thumb[data-preset-id="vivid"]').click();
    await expect(page.locator('.kalotyp-filter-thumb[data-preset-id="vivid"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // The two tabs share one store; Finetune sliders must reflect the
    // Vivid preset (sat +40, contrast +10, clarity +5).
    await page.locator('.kalotyp-util-nav-button[data-utility-id="finetune"]').click();
    await expect(page.locator('.kalotyp-finetune-panel')).toBeVisible();

    const sliderValues = await page.evaluate(() => {
      const out: Record<string, number> = {};
      for (const row of document.querySelectorAll<HTMLElement>('.kalotyp-finetune-row')) {
        const key = row.dataset.adjustment;
        const slider = row.querySelector<HTMLInputElement>('.kalotyp-finetune-slider');
        if (key && slider) out[key] = Number(slider.value);
      }
      return out;
    });
    expect(sliderValues.saturation).toBe(40);
    expect(sliderValues.contrast).toBe(10);
    expect(sliderValues.clarity).toBe(5);

    // Filter is not in the bake chain; finetune applies the tone math,
    // so the upload is the Vivid-state finetune bake of the source.
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

    // Compute average chroma divergence (|R-Y|+|G-Y|+|B-Y|, Rec. 709
    // luminance) for source and edited. Vivid's +40 saturation should
    // produce meaningfully higher chroma than the source.
    const stats = await page.evaluate(
      ([originalUrl, editedUrl]) =>
        Promise.all(
          [originalUrl, editedUrl].map(
            (url) =>
              new Promise<{ chroma: number }>((resolveImg, rejectImg) => {
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
                  let chromaSum = 0;
                  let samples = 0;
                  for (let i = 0; i < data.length; i += 400) {
                    const r = data[i] ?? 0;
                    const g = data[i + 1] ?? 0;
                    const b = data[i + 2] ?? 0;
                    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    chromaSum += Math.abs(r - y) + Math.abs(g - y) + Math.abs(b - y);
                    samples++;
                  }
                  resolveImg({ chroma: chromaSum / samples });
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

    // Conservative relative bound — robust to JPEG noise but still
    // catches "the bake didn't move bytes" regressions.
    expect(editedStats.chroma).toBeGreaterThan(sourceStats.chroma * 1.15);
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
