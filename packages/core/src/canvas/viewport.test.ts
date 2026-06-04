import { describe, expect, it } from 'vitest';
import {
  computeViewport,
  IDENTITY_VIEWPORT_TRANSFORM,
  pointDisplayToImage,
  pointImageToDisplay,
  rectDisplayToImage,
  rectImageToDisplay,
} from './viewport.js';

describe('computeViewport (fit-only / identity transform)', () => {
  it('letterboxes a wide image into a square stage by fitting width', () => {
    const v = computeViewport(
      { width: 1000, height: 1000, padding: 0 },
      { width: 4000, height: 2000 },
    );
    expect(v.scale).toBeCloseTo(0.25);
    expect(v.displayRect.width).toBeCloseTo(1000);
    expect(v.displayRect.height).toBeCloseTo(500);
    expect(v.displayRect.x).toBeCloseTo(0);
    expect(v.displayRect.y).toBeCloseTo(250); // centered vertically
  });

  it('letterboxes a tall image into a square stage by fitting height', () => {
    const v = computeViewport(
      { width: 1000, height: 1000, padding: 0 },
      { width: 500, height: 2000 },
    );
    expect(v.scale).toBeCloseTo(0.5);
    expect(v.displayRect.width).toBeCloseTo(250);
    expect(v.displayRect.height).toBeCloseTo(1000);
    expect(v.displayRect.x).toBeCloseTo(375); // centered horizontally
    expect(v.displayRect.y).toBeCloseTo(0);
  });

  it('scales small images up to fill the stage minus padding', () => {
    const v = computeViewport(
      { width: 1000, height: 800, padding: 50 },
      { width: 100, height: 100 },
    );
    // inner is 900x700, square image fits 700x700 at scale 7
    expect(v.scale).toBeCloseTo(7);
    expect(v.displayRect.width).toBeCloseTo(700);
    expect(v.displayRect.height).toBeCloseTo(700);
    // centered inside the inner area: x = 50 + (900-700)/2 = 150
    expect(v.displayRect.x).toBeCloseTo(150);
    expect(v.displayRect.y).toBeCloseTo(50);
  });

  it('handles a 4000×3000 source on a 1280×800 stage with 32px padding', () => {
    const v = computeViewport(
      { width: 1280, height: 800, padding: 32 },
      { width: 4000, height: 3000 },
    );
    // inner 1216x736; fitting 4000x3000 → scale = min(0.304, 0.2453) = 0.2453
    const expectedScale = 736 / 3000;
    expect(v.scale).toBeCloseTo(expectedScale);
    expect(v.displayRect.height).toBeCloseTo(736);
    expect(v.displayRect.width).toBeCloseTo(4000 * expectedScale);
  });

  it('returns a zero viewport for a degenerate stage', () => {
    const v = computeViewport({ width: 0, height: 100, padding: 0 }, { width: 100, height: 100 });
    expect(v.scale).toBe(0);
  });

  it('returns a zero viewport for a degenerate image', () => {
    const v = computeViewport({ width: 1000, height: 1000, padding: 0 }, { width: 0, height: 100 });
    expect(v.scale).toBe(0);
  });

  it('treats padding larger than half the stage as zero inner area', () => {
    const v = computeViewport(
      { width: 100, height: 100, padding: 60 },
      { width: 200, height: 200 },
    );
    expect(v.scale).toBe(0);
  });

  it('explicit identity transform produces the same viewport as no transform', () => {
    const stage = { width: 1280, height: 800, padding: 32 };
    const image = { width: 4000, height: 3000 };
    const a = computeViewport(stage, image);
    const b = computeViewport(stage, image, IDENTITY_VIEWPORT_TRANSFORM);
    expect(a).toEqual(b);
  });
});

describe('computeViewport (with zoom)', () => {
  const stage = { width: 1000, height: 1000, padding: 0 };
  const image = { width: 1000, height: 1000 };

  it('zoom=2 doubles displayRect size and the scale factor', () => {
    const v = computeViewport(stage, image, { zoom: 2, panX: 0, panY: 0 });
    expect(v.scale).toBeCloseTo(2);
    expect(v.displayRect.width).toBeCloseTo(2000);
    expect(v.displayRect.height).toBeCloseTo(2000);
  });

  it('zoom=2 with no pan centers the image (clamping not triggered)', () => {
    const v = computeViewport(stage, image, { zoom: 2, panX: 0, panY: 0 });
    expect(v.displayRect.x).toBeCloseTo(-500);
    expect(v.displayRect.y).toBeCloseTo(-500);
  });

  it('zoom=0.5 shrinks the image and clamps pan to centered', () => {
    const v = computeViewport(stage, image, { zoom: 0.5, panX: 100, panY: -200 });
    expect(v.scale).toBeCloseTo(0.5);
    expect(v.displayRect.width).toBeCloseTo(500);
    expect(v.displayRect.x).toBeCloseTo(250); // centered baseline
    expect(v.displayRect.y).toBeCloseTo(250);
  });
});

describe('computeViewport (pan clamping)', () => {
  const stage = { width: 1000, height: 1000, padding: 0 };
  const image = { width: 1000, height: 1000 };

  it('panning into the corner is allowed up to the 1-px-visible boundary', () => {
    const v = computeViewport(stage, image, { zoom: 2, panX: 600, panY: 0 });
    expect(v.displayRect.x).toBeCloseTo(100);
  });

  it('clamps a far-right pan so the image left edge stays inside the inner stage', () => {
    const v = computeViewport(stage, image, { zoom: 2, panX: 2000, panY: 0 });
    expect(v.displayRect.x).toBeCloseTo(999);
  });

  it('clamps a far-left pan so the image right edge stays inside the inner stage', () => {
    const v = computeViewport(stage, image, { zoom: 2, panX: -2000, panY: 0 });
    expect(v.displayRect.x).toBeCloseTo(-1999);
  });

  it('clamping is independent on each axis', () => {
    const v = computeViewport(stage, image, { zoom: 2, panX: 5000, panY: -5000 });
    expect(v.displayRect.x).toBeCloseTo(999);
    expect(v.displayRect.y).toBeCloseTo(-1999);
  });
});

describe('coordinate conversion (round-trip, identity)', () => {
  const viewport = computeViewport(
    { width: 1280, height: 800, padding: 32 },
    { width: 4000, height: 3000 },
  );

  it('image → display → image preserves a point', () => {
    const original = { x: 1234, y: 567 };
    const display = pointImageToDisplay(original, viewport);
    const back = pointDisplayToImage(display, viewport);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
  });

  it('image → display → image preserves a rect', () => {
    const original = { x: 100, y: 200, width: 1500, height: 900 };
    const display = rectImageToDisplay(original, viewport);
    const back = rectDisplayToImage(display, viewport);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
    expect(back.width).toBeCloseTo(original.width);
    expect(back.height).toBeCloseTo(original.height);
  });

  it('the image origin maps to the displayRect origin', () => {
    const display = pointImageToDisplay({ x: 0, y: 0 }, viewport);
    expect(display.x).toBeCloseTo(viewport.displayRect.x);
    expect(display.y).toBeCloseTo(viewport.displayRect.y);
  });
});

describe('coordinate conversion (round-trip, zoomed + panned)', () => {
  const viewport = computeViewport(
    { width: 1280, height: 800, padding: 32 },
    { width: 4000, height: 3000 },
    { zoom: 3, panX: -150, panY: 80 },
  );

  it('image → display → image preserves a point under zoom', () => {
    const original = { x: 2000, y: 1500 };
    const display = pointImageToDisplay(original, viewport);
    const back = pointDisplayToImage(display, viewport);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
  });

  it('image → display → image preserves a rect under zoom', () => {
    const original = { x: 500, y: 800, width: 1200, height: 700 };
    const display = rectImageToDisplay(original, viewport);
    const back = rectDisplayToImage(display, viewport);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
    expect(back.width).toBeCloseTo(original.width);
    expect(back.height).toBeCloseTo(original.height);
  });

  it('the displayed image origin still maps to the displayRect origin', () => {
    const display = pointImageToDisplay({ x: 0, y: 0 }, viewport);
    expect(display.x).toBeCloseTo(viewport.displayRect.x);
    expect(display.y).toBeCloseTo(viewport.displayRect.y);
  });
});
