import { describe, expect, it } from 'vitest';
import {
  computeViewport,
  pointDisplayToImage,
  pointImageToDisplay,
  rectDisplayToImage,
  rectImageToDisplay,
} from './viewport.js';
import { ViewportController } from './viewport-controller.js';

const STAGE = { width: 1280, height: 800, padding: 32 };
const IMAGE = { width: 4000, height: 3000 };
const ZOOM_LEVELS = [0.5, 1, 2, 4];

describe('coordinate flow at multiple zoom levels', () => {
  it.each(
    ZOOM_LEVELS,
  )('a "user click" at the visible position of an image pixel maps back to the same pixel — zoom=%s', (zoom) => {
    const transform = { zoom, panX: 0, panY: 0 };
    const v = computeViewport(STAGE, IMAGE, transform);

    const samples = [
      { x: 0, y: 0 },
      { x: IMAGE.width, y: IMAGE.height },
      { x: IMAGE.width / 2, y: IMAGE.height / 2 },
      { x: 1234, y: 567 },
    ];
    for (const original of samples) {
      const display = pointImageToDisplay(original, v);
      const back = pointDisplayToImage(display, v);
      expect(back.x).toBeCloseTo(original.x);
      expect(back.y).toBeCloseTo(original.y);
    }
  });

  it.each(ZOOM_LEVELS)('a rectangle round-trips through display space — zoom=%s', (zoom) => {
    const transform = { zoom, panX: 0, panY: 0 };
    const v = computeViewport(STAGE, IMAGE, transform);
    const original = { x: 500, y: 800, width: 1200, height: 700 };
    const display = rectImageToDisplay(original, v);
    const back = rectDisplayToImage(display, v);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
    expect(back.width).toBeCloseTo(original.width);
    expect(back.height).toBeCloseTo(original.height);
  });

  it('a crop-handle drag at zoom=4 ends at the same image-space rect as the same drag at zoom=1', () => {
    const v1 = computeViewport(STAGE, IMAGE, { zoom: 1, panX: 0, panY: 0 });
    const v4 = computeViewport(STAGE, IMAGE, { zoom: 4, panX: 0, panY: 0 });

    const handleImage = { x: 3000, y: 2000 };

    const handleAt1 = pointImageToDisplay(handleImage, v1);
    const handleAt4 = pointImageToDisplay(handleImage, v4);
    const dragAt1 = pointDisplayToImage({ x: handleAt1.x - 100, y: handleAt1.y - 100 }, v1);
    const dragAt4 = pointDisplayToImage({ x: handleAt4.x - 100, y: handleAt4.y - 100 }, v4);

    // At higher zoom the same on-screen drag covers fewer image pixels.
    const dx1 = handleImage.x - dragAt1.x;
    const dx4 = handleImage.x - dragAt4.x;
    expect(dx1).toBeCloseTo(dx4 * 4);

    expect(dragAt1.x).toBeGreaterThanOrEqual(0);
    expect(dragAt4.x).toBeGreaterThanOrEqual(0);
  });

  it('panning shifts where image pixels appear on screen but does not change image-space identity', () => {
    const original = { x: 1000, y: 500 };

    const noPan = computeViewport(STAGE, IMAGE, { zoom: 2, panX: 0, panY: 0 });
    const panned = computeViewport(STAGE, IMAGE, { zoom: 2, panX: -200, panY: 100 });

    const displayNoPan = pointImageToDisplay(original, noPan);
    const displayPanned = pointImageToDisplay(original, panned);

    expect(displayPanned.x).not.toBeCloseTo(displayNoPan.x);
    expect(displayPanned.y).not.toBeCloseTo(displayNoPan.y);

    expect(pointDisplayToImage(displayNoPan, noPan)).toEqual(
      expect.objectContaining({ x: expect.closeTo(original.x), y: expect.closeTo(original.y) }),
    );
    expect(pointDisplayToImage(displayPanned, panned)).toEqual(
      expect.objectContaining({ x: expect.closeTo(original.x), y: expect.closeTo(original.y) }),
    );
  });
});

describe('controller-driven zoom flow (smoke for plugin integration)', () => {
  it('zoomAt at the cursor anchor preserves the image-space point under that anchor', () => {
    const c = new ViewportController();
    const stage = STAGE;
    const image = IMAGE;
    const stageCenter = { x: stage.width / 2, y: stage.height / 2 };

    const anchor = { x: 800, y: 400 };
    const before = c.computeViewport(stage, image);
    const imageUnderAnchorBefore = pointDisplayToImage(anchor, before);

    c.zoomAt(2, anchor, stageCenter);
    const after = c.computeViewport(stage, image);
    const imageUnderAnchorAfter = pointDisplayToImage(anchor, after);

    expect(imageUnderAnchorAfter.x).toBeCloseTo(imageUnderAnchorBefore.x);
    expect(imageUnderAnchorAfter.y).toBeCloseTo(imageUnderAnchorBefore.y);
  });

  it.each([
    2, 4,
  ])('zoom=%s: an image-space point projected to display, then panned-and-zoomed-back, returns to the same image-space point', (zoom) => {
    const c = new ViewportController({ zoom, panX: -50, panY: 30 });
    const v = c.computeViewport(STAGE, IMAGE);
    const original = { x: 1500, y: 1000 };
    const display = pointImageToDisplay(original, v);
    const back = pointDisplayToImage(display, v);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
  });
});

describe('output bake invariance under zoom', () => {
  // Bake inputs are image-space; the viewport (incl. zoom) is display-only.
  it('a crop rect derived from image-space round-tripping is identical at every zoom', () => {
    const cropImage = { x: 100, y: 200, width: 1500, height: 900 };
    const baked: Array<typeof cropImage> = [];
    for (const zoom of ZOOM_LEVELS) {
      const v = computeViewport(STAGE, IMAGE, { zoom, panX: 0, panY: 0 });
      const display = rectImageToDisplay(cropImage, v);
      const back = rectDisplayToImage(display, v);
      baked.push(back);
    }
    for (const round of baked) {
      expect(round.x).toBeCloseTo(cropImage.x);
      expect(round.y).toBeCloseTo(cropImage.y);
      expect(round.width).toBeCloseTo(cropImage.width);
      expect(round.height).toBeCloseTo(cropImage.height);
    }
  });
});
