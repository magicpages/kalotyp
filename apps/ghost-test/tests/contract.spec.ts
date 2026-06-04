import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Locator, type Page, expect, test } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Crop round-trip E2E against a real Ghost admin, verifying the upload
 * to `/ghost/api/admin/images/upload/`. Gated on GHOST_ADMIN_EMAIL /
 * GHOST_ADMIN_PASSWORD; skipped when unset.
 */

const FIXTURE = resolve(HERE, 'fixtures/feature.png');

const adminEmail = process.env.GHOST_ADMIN_EMAIL ?? '';
const adminPassword = process.env.GHOST_ADMIN_PASSWORD ?? '';
const kalotypJs = process.env.KALOTYP_JS_URL ?? 'http://localhost:5174/kalotyp.js';
const kalotypCss = process.env.KALOTYP_CSS_URL ?? 'http://localhost:5174/kalotyp.css';

const credentialsMissing = !adminEmail || !adminPassword;

test.describe('Ghost integration — crop round-trip', () => {
  test.skip(
    credentialsMissing,
    'Set GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD against a running Ghost (see README.md).',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await configureIntegration(page, kalotypJs, kalotypCss);
  });

  test('Edit button mounts the Kalotyp shell, crops the image, and uploads the result', async ({
    page,
  }) => {
    await page.goto('/ghost/#/posts');
    await page.getByRole('link', { name: /new post/i }).click();

    const [featureUpload] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes('/ghost/api/admin/images/upload') && response.ok(),
      ),
      page.getByLabel(/feature image/i).setInputFiles(FIXTURE),
    ]);
    expect(featureUpload.status()).toBe(201);
    const originalSize = (await featureUpload.request().postDataBuffer())?.byteLength ?? 0;

    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page.locator('.pintura-editor')).toBeVisible();
    await expect(page.locator('.kalotyp-root[data-env~="landscape"]')).toBeVisible();

    await dragHandle(page.locator('.kalotyp-handle[data-direction="br"]'), {
      dx: -120,
      dy: -120,
    });

    const [editedUpload] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/ghost/api/admin/images/upload') && response.status() === 201,
      ),
      page.locator('.kalotyp-button-export').click(),
    ]);
    const editedSize = (await editedUpload.request().postDataBuffer())?.byteLength ?? 0;
    expect(editedSize).toBeLessThan(originalSize);

    await expect(page.locator('.pintura-editor')).toHaveCount(0);
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

async function dragHandle(handle: Locator, delta: { dx: number; dy: number }): Promise<void> {
  const box = await handle.boundingBox();
  if (!box) throw new Error('handle has no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const page = handle.page();
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (delta.dx * i) / steps, startY + (delta.dy * i) / steps);
  }
  await page.mouse.up();
}
