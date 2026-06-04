import { describe, expect, it } from 'vitest';
import { largestInscribedRect } from './inscribe.js';

const deg = (d: number) => (d * Math.PI) / 180;

describe('largestInscribedRect', () => {
  it('returns the source unchanged for zero rotation', () => {
    expect(largestInscribedRect({ width: 4000, height: 3000 }, 0)).toEqual({
      width: 4000,
      height: 3000,
    });
  });

  it('returns the source unchanged at 0° and 180°', () => {
    const source = { width: 4000, height: 3000 };
    expect(largestInscribedRect(source, 0)).toEqual({ width: 4000, height: 3000 });
    const at180 = largestInscribedRect(source, deg(180));
    expect(at180.width).toBeCloseTo(4000, 6);
    expect(at180.height).toBeCloseTo(3000, 6);
  });

  it('returns the H × H²/W rect at 90° / 270° for non-square sources', () => {
    const source = { width: 4000, height: 3000 };
    const expectedWidth = 3000;
    const expectedHeight = (3000 * 3000) / 4000;
    const at90 = largestInscribedRect(source, deg(90));
    const at270 = largestInscribedRect(source, deg(-90));
    expect(at90.width).toBeCloseTo(expectedWidth, 6);
    expect(at90.height).toBeCloseTo(expectedHeight, 6);
    expect(at270.width).toBeCloseTo(expectedWidth, 6);
    expect(at270.height).toBeCloseTo(expectedHeight, 6);
  });

  it('preserves the source aspect ratio', () => {
    const source = { width: 4000, height: 3000 };
    const angles = [10, 22, 30, 45, 60, 75];
    for (const angle of angles) {
      const { width, height } = largestInscribedRect(source, deg(angle));
      expect(width / height).toBeCloseTo(source.width / source.height, 6);
    }
  });

  it('matches the closed-form value for 4:3 at 30°', () => {
    const result = largestInscribedRect({ width: 4000, height: 3000 }, deg(30));
    expect(result.width).toBeCloseTo(2609.74, 1);
    expect(result.height).toBeCloseTo((2609.74 * 3) / 4, 1);
  });

  it('handles a square source at 45° (degenerate denom2)', () => {
    const result = largestInscribedRect({ width: 100, height: 100 }, deg(45));
    expect(result.width).toBeCloseTo(100 / Math.SQRT2, 4);
    expect(result.height).toBeCloseTo(100 / Math.SQRT2, 4);
  });

  it('shrinks monotonically as the angle moves from 0° toward 45°', () => {
    const source = { width: 800, height: 600 };
    const a = largestInscribedRect(source, deg(5)).width;
    const b = largestInscribedRect(source, deg(20)).width;
    const c = largestInscribedRect(source, deg(40)).width;
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('is symmetric in the sign of the angle', () => {
    const source = { width: 800, height: 600 };
    const positive = largestInscribedRect(source, deg(33));
    const negative = largestInscribedRect(source, deg(-33));
    expect(positive.width).toBeCloseTo(negative.width, 6);
    expect(positive.height).toBeCloseTo(negative.height, 6);
  });

  it('is periodic with period 180° (half-turn invariant)', () => {
    const source = { width: 4000, height: 3000 };
    const a = largestInscribedRect(source, deg(15));
    const b = largestInscribedRect(source, deg(15 + 180));
    expect(a.width).toBeCloseTo(b.width, 6);
    expect(a.height).toBeCloseTo(b.height, 6);
  });

  it('returns a zero rect for degenerate sources', () => {
    expect(largestInscribedRect({ width: 0, height: 100 }, deg(30))).toEqual({
      width: 0,
      height: 0,
    });
    expect(largestInscribedRect({ width: 100, height: 0 }, deg(30))).toEqual({
      width: 0,
      height: 0,
    });
  });

  it('every corner of the inscribed rect lies inside the rotated source', () => {
    const tolerance = 1e-6;
    const cases: Array<{ source: { width: number; height: number }; angleDeg: number }> = [
      { source: { width: 200, height: 100 }, angleDeg: 20 },
      { source: { width: 4000, height: 3000 }, angleDeg: 30 },
      { source: { width: 800, height: 600 }, angleDeg: 45 },
      { source: { width: 800, height: 600 }, angleDeg: -33 },
      { source: { width: 1000, height: 1000 }, angleDeg: 12.5 },
      { source: { width: 600, height: 800 }, angleDeg: 7 },
    ];
    for (const { source, angleDeg } of cases) {
      const angleRad = deg(angleDeg);
      const inscribed = largestInscribedRect(source, angleRad);
      const halfX = inscribed.width / 2;
      const halfY = inscribed.height / 2;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const corners = [
        [halfX, halfY],
        [-halfX, halfY],
        [halfX, -halfY],
        [-halfX, -halfY],
      ] as const;
      for (const [ox, oy] of corners) {
        const sx = ox * cos + oy * sin;
        const sy = -ox * sin + oy * cos;
        expect(Math.abs(sx)).toBeLessThanOrEqual(source.width / 2 + tolerance);
        expect(Math.abs(sy)).toBeLessThanOrEqual(source.height / 2 + tolerance);
      }
    }
  });
});
