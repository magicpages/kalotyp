import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { cssFontString } from './fonts.js';
import { tracePath } from './smooth.js';
import { assertNever, normalizeTextShape, type Shape } from './state.js';
import { lineOffset, TEXT_LINE_HEIGHT, textLines } from './text-layout.js';

export interface AnnotateBakeInput {
  readonly shapes: ReadonlyArray<Shape>;
}

/** Re-exported from fonts.ts; the system stack is the default font key's value. */
export { SYSTEM_FONT_STACK } from './fonts.js';

/**
 * Cap on how long the bake waits for web fonts to load before painting. A
 * slow or unreachable CDN must never block Save indefinitely; on timeout we
 * bake with whatever faces are ready (falling back to the generic family).
 */
const FONT_LOAD_TIMEOUT_MS = 400;

/**
 * Ensure every font face used by the text shapes is loaded before bake, so the
 * baked output matches the on-screen preview. Bounded by a timeout and a
 * no-op where `document.fonts` is unavailable (jsdom / worker / OffscreenCanvas).
 */
// Exported for unit testing the font-await behaviour; not part of the public
// API surface (intentionally absent from index.ts).
export async function awaitFontsForBake(shapes: ReadonlyArray<Shape>): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const specs = new Set<string>();
  for (const shape of shapes) {
    if (shape.kind === 'text') specs.add(cssFontString(normalizeTextShape(shape)));
  }
  if (specs.size === 0) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
  // `document.fonts.load` REJECTS when a face is registered (the Bunny CSS
  // parsed) but its woff2 fetch fails — a realistic offline / blocked / flaky
  // case. Swallow it so the bake always proceeds and falls back to the generic
  // family; a font fetch must never break Save or a tab switch.
  const loaded = Promise.all([...specs].map((spec) => document.fonts.load(spec)))
    .then(() => document.fonts.ready)
    .then(() => undefined)
    .catch(() => undefined);
  await Promise.race([loaded, timeout]);
}

/** Paint every shape onto a fresh canvas at the source's dimensions. */
export async function bakeAnnotate(
  state: AnnotateBakeInput,
  source: SourceImage,
): Promise<SourceImage> {
  if (state.shapes.length === 0) return source;

  await awaitFontsForBake(state.shapes);

  const bake = createBakeCanvas(source.width, source.height);
  const ctx = getBakeContext2D(bake);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(source.bitmap, 0, 0, source.width, source.height);

  for (const shape of state.shapes) {
    paintShape(ctx, shape);
  }

  return {
    bitmap: bake.canvas,
    width: source.width,
    height: source.height,
    mimeType: source.mimeType,
  };
}

/** Paint one shape; caller positions the context for image-space coordinates. Shared by preview and bake. */
export function paintShape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: Shape,
): void {
  switch (shape.kind) {
    case 'text':
      paintText(ctx, shape);
      return;
    case 'rect':
      paintRect(ctx, shape);
      return;
    case 'ellipse':
      paintEllipse(ctx, shape);
      return;
    case 'arrow':
      paintArrow(ctx, shape);
      return;
    case 'freehand':
      paintFreehand(ctx, shape);
      return;
    case 'highlight':
      paintHighlight(ctx, shape);
      return;
    default:
      assertNever(shape);
  }
}

function paintText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  textShape: Shape & { kind: 'text' },
): void {
  const shape = normalizeTextShape(textShape);
  ctx.save();
  ctx.fillStyle = shape.color;
  ctx.font = cssFontString(shape);
  // `shape.x, shape.y` is ALWAYS the block's top-left. Alignment justifies each
  // line *within* the block via a manual per-line offset — never via the canvas
  // anchor — so the editor (which uses the same top-left origin + CSS
  // text-align) matches exactly, for any alignment. No wrapping: one line per
  // explicit `\n`.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = textLines(shape.text);
  const widths = lines.map((line) => ctx.measureText(line).width);
  const blockWidth = widths.reduce((max, w) => (w > max ? w : max), 0);
  const lineHeight = shape.fontSize * TEXT_LINE_HEIGHT;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const dx = lineOffset(blockWidth, widths[i] ?? 0, shape.textAlign);
    ctx.fillText(line, shape.x + dx, shape.y + i * lineHeight);
  }
  ctx.restore();
}

function paintRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: Shape & { kind: 'rect' },
): void {
  ctx.save();
  if (shape.fillColor !== null) {
    ctx.fillStyle = shape.fillColor;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineJoin = 'miter';
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  }
  ctx.restore();
}

function paintEllipse(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: Shape & { kind: 'ellipse' },
): void {
  ctx.save();
  const rx = shape.width / 2;
  const ry = shape.height / 2;
  const cx = shape.x + rx;
  const cy = shape.y + ry;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  if (shape.fillColor !== null) {
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function paintArrow(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: Shape & { kind: 'arrow' },
): void {
  const dx = shape.x2 - shape.x1;
  const dy = shape.y2 - shape.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return;

  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Floor on head size so thin strokes still get a readable head.
  const headLength = Math.min(Math.max(shape.strokeWidth * 5, 28), length * 0.6);
  const headWidth = Math.max(shape.strokeWidth * 4, 18);
  const ux = dx / length;
  const uy = dy / length;
  // Shaft stops short of the tip so the head's base sits flush with the cap.
  const shaftEndX = shape.x2 - ux * headLength * 0.6;
  const shaftEndY = shape.y2 - uy * headLength * 0.6;

  ctx.beginPath();
  ctx.moveTo(shape.x1, shape.y1);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  const baseX = shape.x2 - ux * headLength;
  const baseY = shape.y2 - uy * headLength;
  const px = -uy;
  const py = ux;
  ctx.beginPath();
  ctx.moveTo(shape.x2, shape.y2);
  ctx.lineTo(baseX + (px * headWidth) / 2, baseY + (py * headWidth) / 2);
  ctx.lineTo(baseX - (px * headWidth) / 2, baseY - (py * headWidth) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintFreehand(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: Shape & { kind: 'freehand' },
): void {
  if (shape.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  tracePath(ctx, shape.points);
  ctx.stroke();
  ctx.restore();
}

function paintHighlight(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: Shape & { kind: 'highlight' },
): void {
  if (shape.points.length === 0) return;
  ctx.save();
  // `multiply` tints pixels like a highlighter pen; engines without it fall back to alpha-blend.
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  tracePath(ctx, shape.points);
  ctx.stroke();
  ctx.restore();
}
