import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Transform-chain E2E. Drives Ghost through all four geometric
 * utilities (crop, rotate, flip, resize) and verifies the uploaded
 * file's dimensions match the resize panel's pre-save preview. Gated
 * on Ghost admin credentials.
 */

const FIXTURE = resolve(HERE, 'fixtures/feature.png');

const adminEmail = process.env.GHOST_ADMIN_EMAIL ?? '';
const adminPassword = process.env.GHOST_ADMIN_PASSWORD ?? '';
const kalotypJs = process.env.KALOTYP_JS_URL ?? 'http://localhost:5174/kalotyp.js';
const kalotypCss = process.env.KALOTYP_CSS_URL ?? 'http://localhost:5174/kalotyp.css';

const credentialsMissing = !adminEmail || !adminPassword;

test.describe('Ghost integration — transform chain', () => {
  test.skip(
    credentialsMissing,
    'Set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD against a running Ghost (see README.md).',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await configureIntegration(page, kalotypJs, kalotypCss);
  });

  test('crop → rotate 90° CW → flip horizontal → resize 50% round-trips through Ghost', async ({
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

    await page.locator('.kalotyp-util-nav-button[data-utility-id="rotate"]').click();
    await page.getByRole('button', { name: /rotate 90° clockwise/i }).click();

    await page.locator('.kalotyp-util-nav-button[data-utility-id="flip"]').click();
    await page.getByRole('button', { name: /flip horizontal/i }).click();

    await page.locator('.kalotyp-util-nav-button[data-utility-id="resize"]').click();
    const percentInput = page.locator('input[aria-label="Scale (%)"]');
    await percentInput.fill('50');
    await percentInput.press('Enter');

    // The resize panel's reported dimensions are the assertion target
    // for the upload's actual dimensions.
    const summaryText = await page.locator('.kalotyp-resize-summary').textContent();
    const match = summaryText?.match(/(\d+)\s*×\s*(\d+)px/);
    expect(
      match,
      `Resize summary should show "<W> × <H>px" but got: ${summaryText}`,
    ).not.toBeNull();
    const expectedW = Number(match?.[1]);
    const expectedH = Number(match?.[2]);
    expect(Number.isFinite(expectedW) && expectedW > 0).toBe(true);
    expect(Number.isFinite(expectedH) && expectedH > 0).toBe(true);

    const [editedUpload] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/ghost/api/admin/images/upload') && response.status() === 201,
      ),
      page.locator('.kalotyp-button-export').click(),
    ]);

    await expect(page.locator('.pintura-editor')).toHaveCount(0);

    const responseJson = (await editedUpload.json()) as {
      images: Array<{ url: string }>;
    };
    const uploadedUrl = responseJson.images[0]?.url;
    expect(uploadedUrl).toBeTruthy();

    // Decode in the browser to avoid pulling an image decoder into
    // the test runner.
    const dims = await page.evaluate(
      (url) =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => reject(new Error(`Failed to fetch ${url}`));
          img.src = url;
        }),
      uploadedUrl,
    );

    expect(dims.width).toBe(expectedW);
    expect(dims.height).toBe(expectedH);
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
