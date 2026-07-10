import { Buffer } from 'node:buffer';
import { expect, type Page, test } from '@playwright/test';

/**
 * Regression test for the SVG crop bug.
 *
 * `createImageBitmap` can't decode SVG in any browser, so SVGs take the
 * `<img>` fallback — and an SVG with no pixel `width`/`height` (viewBox only)
 * used to load at a tiny browser-default intrinsic size (~200-300×150)
 * regardless of its real size. Cropping then baked through a source-rectangle
 * `drawImage` on that no-intrinsic-size element, which mis-mapped: the saved
 * image came out tiny with the content collapsed into the top-left corner.
 *
 * SVGs are now rasterised on load at their viewBox size, so the whole pipeline
 * operates on a correctly-sized raster. This drives the real bundle through the
 * standalone axe-host page (no Ghost needed) across chromium/firefox/webkit —
 * the last of which is the engine the original report worried about.
 */

test.use({ baseURL: 'http://localhost:5175' });

// viewBox 800×600, NO width/height — the reported-bug shape. Blue field with
// an orange circle dead-centre, so a centred crop must land on orange.
const SVG_NO_SIZE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">' +
  '<rect width="800" height="600" fill="#4f46e5"/>' +
  '<circle cx="400" cy="300" r="120" fill="#f59e0b"/>' +
  '</svg>';

function svgDataUrl(markup: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
}

// The axe-host fixture's inline script injects `openEditor` and `__lastProcess`
// onto `window`; neither exists on the ambient `Window` type, so every access
// below reaches them through `window as unknown as FixtureWindow`.
type FixtureWindow = {
  openEditor: (overrides?: { src?: string }) => void;
  __lastProcess: File | null;
};

test.describe('SVG source — crop', () => {
  test('a viewBox-only SVG loads at its real size and crops correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof (window as unknown as FixtureWindow).openEditor === 'function',
    );

    await page.evaluate(
      (src) => (window as unknown as FixtureWindow).openEditor({ src }),
      svgDataUrl(SVG_NO_SIZE),
    );

    const widthInput = page.locator('input[aria-label="Width (pixels)"]');
    const heightInput = page.locator('input[aria-label="Height (pixels)"]');
    await expect(widthInput).toBeVisible();

    // The crop input `max` is the loaded image dimension. Core regression
    // guard: this must be the viewBox 800×600, not the tiny browser default.
    await expect(widthInput).toHaveAttribute('max', '800');
    await expect(heightInput).toHaveAttribute('max', '600');

    // Centred crop: the middle half of the frame.
    await setCrop(page, { left: 200, top: 150, width: 400, height: 300 });

    await page.locator('.kalotyp-button-export').click();
    await page.waitForFunction(
      () => (window as unknown as FixtureWindow).__lastProcess instanceof File,
    );

    const out = await page.evaluate(async () => {
      const file = (window as unknown as FixtureWindow).__lastProcess;
      if (!file) throw new Error('no processed file');
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(bmp, 0, 0);
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      let filled = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) filled++;
      const c = ctx.getImageData(width >> 1, height >> 1, 1, 1).data;
      return {
        width,
        height,
        filledPct: Math.round((filled / (width * height)) * 100),
        center: { r: c[0], g: c[1], b: c[2], a: c[3] },
      };
    });

    // A correctly-sized crop of an 800×600 image → 400×300 (was tiny pre-fix).
    expect(out.width).toBe(400);
    expect(out.height).toBe(300);
    // Fully painted (was ~25%, content stuck in the top-left, pre-fix).
    expect(out.filledPct).toBeGreaterThan(95);
    // The centre of the centred crop is the orange circle (#f59e0b ≈
    // rgb(245,158,11)) — opaque, red-dominant, low blue — not the blue field
    // and not transparent.
    expect(out.center.a).toBe(255);
    expect(out.center.r).toBeGreaterThan(200);
    expect(out.center.b).toBeLessThan(80);
  });
});

async function setCrop(
  page: Page,
  rect: { left: number; top: number; width: number; height: number },
): Promise<void> {
  // Set width/height before the origin: moving the origin on a full-frame rect
  // would clamp it back to 0. Each `fill` blurs the previous input, firing its
  // `change` (which commits the whole rect read from all four fields).
  await page.locator('input[aria-label="Width (pixels)"]').fill(String(rect.width));
  await page.locator('input[aria-label="Height (pixels)"]').fill(String(rect.height));
  await page.locator('input[aria-label="Left (pixels)"]').fill(String(rect.left));
  await page.locator('input[aria-label="Top (pixels)"]').fill(String(rect.top));
  await page.locator('input[aria-label="Top (pixels)"]').blur();
}
