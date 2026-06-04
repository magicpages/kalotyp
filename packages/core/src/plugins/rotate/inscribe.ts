import type { Size } from '../../geometry/rect.js';

/**
 * Largest axis-aligned rect of the source's aspect ratio that fits
 * inside the source rotated by `angleRad`. Used by free-angle rotation
 * to avoid transparent corners.
 *
 * The two binding constraints reduce to
 *   `2x ≤ W² / (W|cosθ| + H|sinθ|)`
 *   `2x ≤ W·H / (W|sinθ| + H|cosθ|)`
 * — the inscribed half-width is the smaller bound. Works on absolute
 * sin/cos so the result is symmetric in the sign of the angle.
 */
export function largestInscribedRect(source: Size, angleRad: number): Size {
  const width = source.width;
  const height = source.height;
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };

  const c = Math.abs(Math.cos(angleRad));
  const s = Math.abs(Math.sin(angleRad));

  const denomA = width * c + height * s;
  const denomD = width * s + height * c;
  const capA = denomA > EPSILON ? (width * width) / denomA : Number.POSITIVE_INFINITY;
  const capD = denomD > EPSILON ? (width * height) / denomD : Number.POSITIVE_INFINITY;

  const outWidth = Math.min(capA, capD);
  const outHeight = (outWidth * height) / width;
  return { width: outWidth, height: outHeight };
}

const EPSILON = 1e-9;
