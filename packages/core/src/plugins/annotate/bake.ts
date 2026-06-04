import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { tracePath } from './smooth.js';
import { assertNever, type Shape } from './state.js';

export interface AnnotateBakeInput {
  readonly shapes: ReadonlyArray<Shape>;
}

/**
 * System font stack used at bake; matches what the preview canvas renders.
 * No web font is loaded — the bundle budget rules it out and the bake
 * pipeline has no "wait for font" affordance.
 */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Paint every shape onto a fresh canvas at the source's dimensions. */
export async function bakeAnnotate(
  state: AnnotateBakeInput,
  source: SourceImage,
): Promise<SourceImage> {
  if (state.shapes.length === 0) return source;

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
  shape: Shape & { kind: 'text' },
): void {
  ctx.save();
  ctx.fillStyle = shape.color;
  ctx.font = `${shape.fontSize}px ${SYSTEM_FONT_STACK}`;
  ctx.textAlign = shape.textAlign;
  ctx.textBaseline = 'top';
  // Paint each line on its own; explicit `\n` only (no auto-wrap).
  const lines = shape.text.length === 0 ? [''] : shape.text.split('\n');
  const lineHeight = shape.fontSize * 1.2;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    ctx.fillText(line, shape.x, shape.y + i * lineHeight);
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
