/**
 * Pure math for the finetune adjustments. Slider values arrive in
 * [-100, +100] from `state.ts`. Shared by the bake (full-resolution)
 * and the live preview (display-resolution).
 */

import type { FinetuneState } from './state.js';

/**
 * 256-entry LUT collapsing brightness + contrast + exposure + gamma into
 * one per-byte mapping. Saturation and clarity run in separate passes.
 */
export function buildFinetuneLut(state: FinetuneState): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);

  // brightness: -100 → -0.5, +100 → +0.5 on the normalised value
  const brightnessOffset = state.brightness / 200;
  // contrast multiplier around mid-gray: -100 → 0×, +100 → 2×
  const contrastFactor = 1 + state.contrast / 100;
  // exposure multiplier: -100 → 0.5×, +100 → 1.5×
  const exposureFactor = 1 + state.exposure / 200;
  // gamma exponent: -100 → 2.0, 0 → 1.0, +100 → 0.5
  const gammaExponent = gammaExponentFor(state.gamma);

  for (let v = 0; v < 256; v++) {
    let x = v / 255;
    x = x * exposureFactor;
    x = (x - 0.5) * contrastFactor + 0.5;
    x = x + brightnessOffset;
    if (x < 0) x = 0;
    else if (x > 1) x = 1;
    x = x ** gammaExponent;
    if (x < 0) x = 0;
    else if (x > 1) x = 1;
    lut[v] = Math.round(x * 255);
  }

  return lut;
}

function gammaExponentFor(slider: number): number {
  if (slider === 0) return 1;
  if (slider > 0) return 1 - 0.5 * (slider / 100);
  return 1 + 1.0 * (-slider / 100);
}

/**
 * Apply the LUT and saturation in one pass. `src`/`dst` may be the same
 * buffer. Saturation: -100 → grayscale (Rec. 709), 0 → identity, +100 → 2×.
 */
export function applyFinetuneLutAndSaturation(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  lut: Uint8ClampedArray,
  state: FinetuneState,
): void {
  const len = src.length;
  if (dst.length !== len) {
    throw new Error('applyFinetuneLutAndSaturation: src/dst length mismatch');
  }

  const saturation = 1 + state.saturation / 100;

  // Fast path for the common identity (saturation === 0).
  if (saturation === 1) {
    for (let i = 0; i < len; i += 4) {
      dst[i] = lut[src[i]];
      dst[i + 1] = lut[src[i + 1]];
      dst[i + 2] = lut[src[i + 2]];
      dst[i + 3] = src[i + 3];
    }
    return;
  }

  for (let i = 0; i < len; i += 4) {
    const r0 = lut[src[i]];
    const g0 = lut[src[i + 1]];
    const b0 = lut[src[i + 2]];
    // Rec. 709 luminance.
    const y = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
    let r = y + (r0 - y) * saturation;
    let g = y + (g0 - y) * saturation;
    let b = y + (b0 - y) * saturation;
    if (r < 0) r = 0;
    else if (r > 255) r = 255;
    if (g < 0) g = 0;
    else if (g > 255) g = 255;
    if (b < 0) b = 0;
    else if (b > 255) b = 255;
    dst[i] = r;
    dst[i + 1] = g;
    dst[i + 2] = b;
    dst[i + 3] = src[i + 3];
  }
}

/**
 * Unsharp-mask local contrast: `result = dst + (clarity/100) * (dst - blurred)`.
 * `clarity === 0` is a no-op; caller is expected to skip the call.
 */
export function applyClarity(
  dst: Uint8ClampedArray,
  blurred: Uint8ClampedArray,
  clarity: number,
): void {
  if (clarity === 0) return;
  const len = dst.length;
  if (blurred.length !== len) {
    throw new Error('applyClarity: dst/blurred length mismatch');
  }
  const amount = clarity / 100;
  for (let i = 0; i < len; i += 4) {
    const dr = dst[i];
    const dg = dst[i + 1];
    const db = dst[i + 2];
    let r = dr + amount * (dr - blurred[i]);
    let g = dg + amount * (dg - blurred[i + 1]);
    let b = db + amount * (db - blurred[i + 2]);
    if (r < 0) r = 0;
    else if (r > 255) r = 255;
    if (g < 0) g = 0;
    else if (g > 255) g = 255;
    if (b < 0) b = 0;
    else if (b > 255) b = 255;
    dst[i] = r;
    dst[i + 1] = g;
    dst[i + 2] = b;
  }
}

/** Separable 3×3 box blur (clamp at edges). Used as the unsharp-mask reference. */
export function boxBlur3x3(
  src: Uint8ClampedArray,
  tmp: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (src.length !== tmp.length || src.length !== dst.length) {
    throw new Error('boxBlur3x3: buffer length mismatch');
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const xm = x === 0 ? 0 : x - 1;
      const xp = x === width - 1 ? width - 1 : x + 1;
      const i = (y * width + x) * 4;
      const im = (y * width + xm) * 4;
      const ip = (y * width + xp) * 4;
      tmp[i] = (src[im] + src[i] + src[ip]) / 3;
      tmp[i + 1] = (src[im + 1] + src[i + 1] + src[ip + 1]) / 3;
      tmp[i + 2] = (src[im + 2] + src[i + 2] + src[ip + 2]) / 3;
      tmp[i + 3] = src[i + 3];
    }
  }
  for (let y = 0; y < height; y++) {
    const ym = y === 0 ? 0 : y - 1;
    const yp = y === height - 1 ? height - 1 : y + 1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const im = (ym * width + x) * 4;
      const ip = (yp * width + x) * 4;
      dst[i] = (tmp[im] + tmp[i] + tmp[ip]) / 3;
      dst[i + 1] = (tmp[im + 1] + tmp[i + 1] + tmp[ip + 1]) / 3;
      dst[i + 2] = (tmp[im + 2] + tmp[i + 2] + tmp[ip + 2]) / 3;
      dst[i + 3] = tmp[i + 3];
    }
  }
}

/** Structural raster shape so tests can pass a plain object (some jsdom versions lack `ImageData`). */
export interface RasterImage {
  // ArrayBuffer-pinned so data is assignable to `new ImageData(...)`.
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
}

/** Apply the full pipeline (LUT + saturation + clarity); blur buffers allocate only when clarity ≠ 0. */
export function applyFinetuneToImageData(
  state: FinetuneState,
  baseline: RasterImage,
  dst: RasterImage,
): void {
  if (
    baseline.width !== dst.width ||
    baseline.height !== dst.height ||
    baseline.data.length !== dst.data.length
  ) {
    throw new Error('applyFinetuneToImageData: baseline/dst dimensions mismatch');
  }

  const lut = buildFinetuneLut(state);
  applyFinetuneLutAndSaturation(baseline.data, dst.data, lut, state);

  if (state.clarity !== 0) {
    // Blur the pre-LUT baseline so the cached blur stays valid as long as
    // the baseline does; high-frequency is roughly order-independent here.
    const tmp = new Uint8ClampedArray(baseline.data.length);
    const blurred = new Uint8ClampedArray(baseline.data.length);
    boxBlur3x3(baseline.data, tmp, blurred, baseline.width, baseline.height);
    applyClarity(dst.data, blurred, state.clarity);
  }
}
