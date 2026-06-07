/**
 * Text measurement for the text annotation tool. Pure and framework-agnostic
 * so the live canvas preview, the bake, and the geometry (selection outline /
 * hit-test) all share one notion of a text shape's extent.
 *
 * Text is anchor-based and does NOT wrap: lines are split on explicit `\n`
 * only, and the shape's width is its widest line. The line-measuring function
 * is injected so the same code works with real canvas metrics (browser
 * preview + bake) and with a heuristic estimate in headless/jsdom contexts
 * where `measureText` returns 0.
 */

import type { TextShape } from './state.js';

/** Line-height multiple of the font size. Shared by layout and bake. */
export const TEXT_LINE_HEIGHT = 1.2;

/** Measures the rendered width of a single line of text, in image-space px. */
export type MeasureLine = (line: string) => number;

/** Split text into rendered lines. Empty text yields one empty line (caret height). */
export function textLines(text: string): string[] {
  return text.length === 0 ? [''] : text.split('\n');
}

export interface TextLayout {
  readonly lines: string[];
  readonly width: number;
  readonly height: number;
}

/** Measure a text shape's natural extent: widest line × line count. */
export function layoutTextLines(shape: TextShape, measure: MeasureLine): TextLayout {
  const lines = textLines(shape.text);
  let width = 0;
  for (const line of lines) {
    const w = measure(line);
    if (w > width) width = w;
  }
  // A floor so an empty box still has a grabbable width.
  width = Math.max(width, shape.fontSize * 0.6);
  return {
    lines,
    width,
    height: lines.length * shape.fontSize * TEXT_LINE_HEIGHT,
  };
}

/**
 * Heuristic line-width estimate for headless contexts where canvas
 * `measureText` returns 0. Assumes ~0.55em mean Latin glyph advance — close
 * enough for the selection outline; the real renderer measures at paint time.
 */
export function estimateLineWidth(line: string, fontSize: number): number {
  return line.length * fontSize * 0.55;
}
