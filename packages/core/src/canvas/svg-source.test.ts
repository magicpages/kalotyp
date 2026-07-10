import { describe, expect, it } from 'vitest';
import {
  isSvgBlob,
  MAX_SVG_RASTER_DIMENSION,
  resolveSvgPixelSize,
  SVG_MIME,
} from './svg-source.js';

const FALLBACK = { width: 300, height: 150 };

function svg(attrs: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect width="10" height="10"/></svg>`;
}

describe('isSvgBlob', () => {
  it('matches the SVG mime', () => {
    expect(isSvgBlob(new Blob([''], { type: SVG_MIME }))).toBe(true);
  });

  it('tolerates a charset suffix and casing', () => {
    expect(isSvgBlob(new Blob([''], { type: 'image/svg+xml; charset=utf-8' }))).toBe(true);
    expect(isSvgBlob(new Blob([''], { type: 'IMAGE/SVG+XML' }))).toBe(true);
  });

  it('rejects raster mimes and empty types', () => {
    expect(isSvgBlob(new Blob([''], { type: 'image/png' }))).toBe(false);
    expect(isSvgBlob(new Blob([''], { type: '' }))).toBe(false);
  });
});

describe('resolveSvgPixelSize', () => {
  it('uses explicit px width and height', () => {
    expect(resolveSvgPixelSize(svg('width="800" height="600"'), FALLBACK)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('accepts an explicit px unit suffix', () => {
    expect(resolveSvgPixelSize(svg('width="640px" height="480px"'), FALLBACK)).toEqual({
      width: 640,
      height: 480,
    });
  });

  it('falls back to the viewBox when width/height are absent', () => {
    // This is the reported-bug case: viewBox only, no intrinsic pixel size.
    expect(resolveSvgPixelSize(svg('viewBox="0 0 800 600"'), FALLBACK)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('ignores non-pixel units (percent) and uses the viewBox', () => {
    expect(
      resolveSvgPixelSize(svg('width="100%" height="100%" viewBox="0 0 1000 400"'), FALLBACK),
    ).toEqual({ width: 1000, height: 400 });
  });

  it('derives the missing dimension from the viewBox aspect ratio', () => {
    // width given, height absent → height = 400 * (300/1200) = 100
    expect(resolveSvgPixelSize(svg('width="400" viewBox="0 0 1200 300"'), FALLBACK)).toEqual({
      width: 400,
      height: 100,
    });
    // height given, width absent → width = 200 * (1200/300) = 800
    expect(resolveSvgPixelSize(svg('height="200" viewBox="0 0 1200 300"'), FALLBACK)).toEqual({
      width: 800,
      height: 200,
    });
  });

  it('handles comma-separated viewBox values', () => {
    expect(resolveSvgPixelSize(svg('viewBox="0,0,320,240"'), FALLBACK)).toEqual({
      width: 320,
      height: 240,
    });
  });

  it('clamps proportionally when the longest edge exceeds the max', () => {
    const size = resolveSvgPixelSize(svg('viewBox="0 0 40000 20000"'), FALLBACK);
    expect(size.width).toBe(MAX_SVG_RASTER_DIMENSION);
    expect(size.height).toBe(MAX_SVG_RASTER_DIMENSION / 2);
  });

  it('rounds fractional dimensions', () => {
    expect(resolveSvgPixelSize(svg('viewBox="0 0 100 33.4"'), FALLBACK)).toEqual({
      width: 100,
      height: 33,
    });
  });

  it('falls back when nothing usable is declared', () => {
    expect(resolveSvgPixelSize(svg(''), FALLBACK)).toEqual(FALLBACK);
    expect(resolveSvgPixelSize(svg('viewBox="0 0 0 0"'), FALLBACK)).toEqual(FALLBACK);
    expect(resolveSvgPixelSize(svg('viewBox="garbage"'), FALLBACK)).toEqual(FALLBACK);
  });

  it('falls back on non-SVG or malformed markup', () => {
    expect(resolveSvgPixelSize('<html><body>not svg</body></html>', FALLBACK)).toEqual(FALLBACK);
    expect(resolveSvgPixelSize('<svg width="10"', FALLBACK)).toEqual(FALLBACK);
    expect(resolveSvgPixelSize('', FALLBACK)).toEqual(FALLBACK);
  });
});
