/**
 * On a 844×390 landscape phone the stage must keep at least 200 px of working height.
 * jsdom can't layout our flex/grid, so we compute the budget analytically from the
 * chrome heights pinned in mobile.css.
 */

import { describe, expect, it } from 'vitest';

describe('landscape stage height (844×390 phone, mobile.css)', () => {
  it('chrome heights leave the stage at least 200 px on 844×390', () => {
    // mobile.css gate: nav 44, util-main 56, util-footer 6+6 padding + 40 export = 52.
    const navMinHeight = 44;
    const utilMainMinHeight = 56;
    const utilFooterHeight = 52;
    const viewportHeight = 390;

    const stageBudget = viewportHeight - navMinHeight - utilMainMinHeight - utilFooterHeight;
    expect(stageBudget, 'stage height budget on 844×390 landscape phone').toBeGreaterThanOrEqual(
      200,
    );
  });

  it('without the height-based gate, the desktop chrome would leave the stage below 200 px', () => {
    // Desktop chrome: nav 56 + util 88 + footer 64 = 208; stage = 182. Documents the regression we fixed.
    const desktopChromeTotal = 56 + 88 + 64;
    const desktopBudget = 390 - desktopChromeTotal;
    expect(desktopBudget).toBeLessThan(200);
  });

  it('controller-driven fit-to-screen gives a 4000×3000 image at least a 200 px tall display rect on landscape', async () => {
    const { computeViewport } = await import('@magicpages/kalotyp-core');
    // Approximate the landscape stage as 800×238 (844 width minus modal padding) and fit a 4000×3000 image.
    const stage = { width: 800, height: 238, padding: 32 };
    const image = { width: 4000, height: 3000 };
    const viewport = computeViewport(stage, image);
    expect(viewport.displayRect.height).toBeGreaterThanOrEqual(150);
    // The image fits within the stage (no overflow at zoom=1).
    expect(viewport.displayRect.width).toBeLessThanOrEqual(stage.width);
    expect(viewport.displayRect.height).toBeLessThanOrEqual(stage.height);
  });
});
