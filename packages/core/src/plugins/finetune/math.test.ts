import { describe, expect, it } from 'vitest';
import {
  applyClarity,
  applyFinetuneLutAndSaturation,
  applyFinetuneToImageData,
  boxBlur3x3,
  buildFinetuneLut,
} from './math.js';
import { DEFAULT_FINETUNE_STATE } from './state.js';

function makeRaster(width: number, height: number, fill: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = fill(x, y);
      data[i] = r ?? 0;
      data[i + 1] = g ?? 0;
      data[i + 2] = b ?? 0;
      data[i + 3] = a ?? 255;
    }
  }
  return { data, width, height };
}

describe('buildFinetuneLut', () => {
  it('is the identity map when state is the default', () => {
    const lut = buildFinetuneLut(DEFAULT_FINETUNE_STATE);
    for (let v = 0; v < 256; v++) {
      expect(lut[v]).toBe(v);
    }
  });

  it('brightens monotonically as brightness increases', () => {
    const dim = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, brightness: -50 });
    const bright = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, brightness: 50 });
    for (let v = 64; v < 192; v++) {
      expect(dim[v]).toBeLessThan(v);
      expect(bright[v]).toBeGreaterThan(v);
    }
  });

  it('contrast +100 maps mid-gray to itself but pushes endpoints', () => {
    const lut = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, contrast: 100 });
    expect(lut[128]).toBeGreaterThanOrEqual(127);
    expect(lut[128]).toBeLessThanOrEqual(129);
    expect(lut[64]).toBeLessThan(64);
    expect(lut[192]).toBeGreaterThan(192);
  });

  it('contrast -100 collapses every input to mid-gray', () => {
    const lut = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, contrast: -100 });
    for (let v = 0; v < 256; v++) {
      expect(lut[v]).toBe(128);
    }
  });

  it('exposure scales the linear-ish slope', () => {
    const dimmer = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, exposure: -100 });
    const brighter = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, exposure: 100 });
    expect(dimmer[200]).toBeLessThan(200);
    expect(brighter[100]).toBeGreaterThan(100);
  });

  it('gamma +100 brightens midtones (smaller exponent)', () => {
    const lut = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, gamma: 100 });
    expect(lut[128]).toBeGreaterThan(128);
  });

  it('gamma -100 darkens midtones (larger exponent)', () => {
    const lut = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, gamma: -100 });
    expect(lut[128]).toBeLessThan(128);
  });
});

describe('applyFinetuneLutAndSaturation', () => {
  it('default state is the identity transform', () => {
    const src = new Uint8ClampedArray([12, 34, 56, 200]);
    const dst = new Uint8ClampedArray(4);
    const lut = buildFinetuneLut(DEFAULT_FINETUNE_STATE);
    applyFinetuneLutAndSaturation(src, dst, lut, DEFAULT_FINETUNE_STATE);
    expect(Array.from(dst)).toEqual([12, 34, 56, 200]);
  });

  it('saturation -100 collapses to per-pixel Rec. 709 luminance', () => {
    const src = new Uint8ClampedArray([200, 50, 30, 255]);
    const dst = new Uint8ClampedArray(4);
    const lut = buildFinetuneLut(DEFAULT_FINETUNE_STATE);
    applyFinetuneLutAndSaturation(src, dst, lut, {
      ...DEFAULT_FINETUNE_STATE,
      saturation: -100,
    });
    const expected = Math.round(0.2126 * 200 + 0.7152 * 50 + 0.0722 * 30);
    expect(dst[0]).toBe(expected);
    expect(dst[1]).toBe(expected);
    expect(dst[2]).toBe(expected);
    expect(dst[3]).toBe(255);
  });

  it('preserves alpha unchanged', () => {
    const src = new Uint8ClampedArray([10, 20, 30, 77]);
    const dst = new Uint8ClampedArray(4);
    const lut = buildFinetuneLut({ ...DEFAULT_FINETUNE_STATE, brightness: 50 });
    applyFinetuneLutAndSaturation(src, dst, lut, {
      ...DEFAULT_FINETUNE_STATE,
      brightness: 50,
    });
    expect(dst[3]).toBe(77);
  });

  it('throws when buffers have mismatched lengths', () => {
    expect(() =>
      applyFinetuneLutAndSaturation(
        new Uint8ClampedArray(8),
        new Uint8ClampedArray(4),
        new Uint8ClampedArray(256),
        DEFAULT_FINETUNE_STATE,
      ),
    ).toThrow();
  });
});

describe('applyClarity', () => {
  it('is a no-op when clarity is zero', () => {
    const dst = new Uint8ClampedArray([10, 20, 30, 255]);
    const before = Array.from(dst);
    applyClarity(dst, new Uint8ClampedArray([5, 15, 25, 255]), 0);
    expect(Array.from(dst)).toEqual(before);
  });

  it('positive clarity sharpens (pushes pixels away from blur)', () => {
    const dst = new Uint8ClampedArray([100, 100, 100, 255]);
    const blurred = new Uint8ClampedArray([80, 80, 80, 255]);
    applyClarity(dst, blurred, 50);
    expect(dst[0]).toBe(110);
    expect(dst[1]).toBe(110);
    expect(dst[2]).toBe(110);
  });

  it('negative clarity softens (pulls pixels toward blur)', () => {
    const dst = new Uint8ClampedArray([100, 100, 100, 255]);
    const blurred = new Uint8ClampedArray([80, 80, 80, 255]);
    applyClarity(dst, blurred, -50);
    expect(dst[0]).toBe(90);
    expect(dst[1]).toBe(90);
    expect(dst[2]).toBe(90);
  });

  it('clamps at 0/255 boundaries', () => {
    const dst = new Uint8ClampedArray([255, 0, 128, 255]);
    const blurred = new Uint8ClampedArray([100, 100, 128, 255]);
    applyClarity(dst, blurred, 100);
    expect(dst[0]).toBe(255);
    expect(dst[1]).toBe(0);
    expect(dst[2]).toBe(128);
  });
});

describe('boxBlur3x3', () => {
  it('does not change a uniform image', () => {
    const w = 4;
    const h = 4;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 100;
      src[i + 1] = 100;
      src[i + 2] = 100;
      src[i + 3] = 255;
    }
    const tmp = new Uint8ClampedArray(w * h * 4);
    const dst = new Uint8ClampedArray(w * h * 4);
    boxBlur3x3(src, tmp, dst, w, h);
    for (let i = 0; i < dst.length; i += 4) {
      expect(dst[i]).toBe(100);
      expect(dst[i + 1]).toBe(100);
      expect(dst[i + 2]).toBe(100);
      expect(dst[i + 3]).toBe(255);
    }
  });

  it('softens a single bright pixel into a 3×3 region', () => {
    const w = 5;
    const h = 5;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 3; i < src.length; i += 4) src[i] = 255;
    const c = (2 * w + 2) * 4;
    src[c] = 255;
    src[c + 1] = 255;
    src[c + 2] = 255;
    const tmp = new Uint8ClampedArray(w * h * 4);
    const dst = new Uint8ClampedArray(w * h * 4);
    boxBlur3x3(src, tmp, dst, w, h);
    expect(dst[c]).toBeGreaterThan(20);
    expect(dst[c]).toBeLessThan(40);
    expect(dst[0]).toBe(0);
  });
});

describe('applyFinetuneToImageData', () => {
  it('default state leaves the image unchanged byte-for-byte', () => {
    const baseline = makeRaster(8, 8, (x, y) => [x * 16, y * 16, 0, 255]);
    const dst = makeRaster(8, 8, () => [0, 0, 0, 0]);
    applyFinetuneToImageData(DEFAULT_FINETUNE_STATE, baseline, dst);
    expect(Array.from(dst.data)).toEqual(Array.from(baseline.data));
  });

  it('brightness +50 increases every channel monotonically (excluding clamps)', () => {
    const baseline = makeRaster(4, 4, () => [80, 80, 80, 255]);
    const dst = makeRaster(4, 4, () => [0, 0, 0, 0]);
    applyFinetuneToImageData({ ...DEFAULT_FINETUNE_STATE, brightness: 50 }, baseline, dst);
    for (let i = 0; i < dst.data.length; i += 4) {
      expect(dst.data[i]).toBeGreaterThan(80);
    }
  });

  it('saturation -100 collapses to identical RGB per pixel (grayscale)', () => {
    const baseline = makeRaster(4, 4, (x, y) => [200 - y * 30, 50 + x * 30, 30, 255]);
    const dst = makeRaster(4, 4, () => [0, 0, 0, 0]);
    applyFinetuneToImageData({ ...DEFAULT_FINETUNE_STATE, saturation: -100 }, baseline, dst);
    for (let i = 0; i < dst.data.length; i += 4) {
      expect(dst.data[i]).toBe(dst.data[i + 1]);
      expect(dst.data[i + 1]).toBe(dst.data[i + 2]);
    }
  });

  it('clarity changes mid-tone pixel values when there is local contrast', () => {
    const baseline = makeRaster(8, 8, (x, y) => {
      const dark = (x + y) % 2 === 0;
      return dark ? [100, 100, 100, 255] : [160, 160, 160, 255];
    });
    const dstNoClarity = makeRaster(8, 8, () => [0, 0, 0, 0]);
    const dstClarity = makeRaster(8, 8, () => [0, 0, 0, 0]);
    applyFinetuneToImageData(DEFAULT_FINETUNE_STATE, baseline, dstNoClarity);
    applyFinetuneToImageData({ ...DEFAULT_FINETUNE_STATE, clarity: 50 }, baseline, dstClarity);
    expect(Array.from(dstNoClarity.data)).toEqual(Array.from(baseline.data));
    let differ = 0;
    for (let i = 0; i < dstClarity.data.length; i += 4) {
      if (dstClarity.data[i] !== baseline.data[i]) differ++;
    }
    expect(differ).toBeGreaterThan(8);
  });

  it('throws when baseline and dst dimensions differ', () => {
    const baseline = makeRaster(2, 2, () => [0, 0, 0, 255]);
    const dst = makeRaster(3, 3, () => [0, 0, 0, 255]);
    expect(() => applyFinetuneToImageData(DEFAULT_FINETUNE_STATE, baseline, dst)).toThrow();
  });
});
