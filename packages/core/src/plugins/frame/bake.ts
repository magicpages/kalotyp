import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { type FramePresetId, type FrameState, isFrameNoOp } from './state.js';

/**
 * Apply the active frame preset. Frame thickness scales with `source`
 * so it stays consistent across resize choices. Output dimensions match
 * the input except for Polaroid, which extends the canvas.
 */
export async function bakeFrame(state: FrameState, source: SourceImage): Promise<SourceImage> {
  if (isFrameNoOp(state)) return source;

  if (state.presetId === 'polaroid') {
    return bakePolaroid(state.color, source);
  }
  if (state.presetId === 'none') return source;
  return bakeInsideFrame(state.presetId, state.color, source);
}

function bakeInsideFrame(
  presetId: Exclude<FramePresetId, 'none' | 'polaroid'>,
  color: string,
  source: SourceImage,
): SourceImage {
  const bake = createBakeCanvas(source.width, source.height);
  const ctx = getBakeContext2D(bake);

  ctx.drawImage(source.bitmap, 0, 0, source.width, source.height);

  paintInsideFrame(ctx, presetId, color, source.width, source.height);

  return {
    bitmap: bake.canvas,
    width: source.width,
    height: source.height,
    mimeType: source.mimeType,
  };
}

/** Paint a non-extending frame; caller has already drawn the source image. */
export function paintInsideFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  presetId: Exclude<FramePresetId, 'none' | 'polaroid'>,
  color: string,
  width: number,
  height: number,
): void {
  switch (presetId) {
    case 'solidSharp':
      paintMatSharp(ctx, color, width, height);
      return;
    case 'solidRound':
      paintMatRound(ctx, color, width, height);
      return;
    case 'lineSingle':
      paintLineSingle(ctx, color, width, height);
      return;
    case 'hook':
      paintCornerHooks(ctx, color, width, height);
      return;
  }
}

/** Mat Sharp: 4%-of-shorter-edge solid border with sharp corners. */
function paintMatSharp(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  color: string,
  width: number,
  height: number,
): void {
  const t = matThickness(width, height);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, t);
  ctx.fillRect(0, height - t, width, t);
  ctx.fillRect(0, t, t, height - 2 * t);
  ctx.fillRect(width - t, t, t, height - 2 * t);
  ctx.restore();
}

/** Mat Round: Mat Sharp with the four outer corners knocked out via destination-out. */
function paintMatRound(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  color: string,
  width: number,
  height: number,
): void {
  const t = matThickness(width, height);
  const r = t;
  paintMatSharp(ctx, color, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  drawCornerCutout(ctx, 0, 0, r, 'tl');
  drawCornerCutout(ctx, width, 0, r, 'tr');
  drawCornerCutout(ctx, 0, height, r, 'bl');
  drawCornerCutout(ctx, width, height, r, 'br');
  ctx.restore();
}

function drawCornerCutout(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  corner: 'tl' | 'tr' | 'bl' | 'br',
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  switch (corner) {
    case 'tl':
      ctx.lineTo(cx + r, cy);
      ctx.arc(cx + r, cy + r, r, -Math.PI / 2, Math.PI, true);
      ctx.lineTo(cx, cy);
      break;
    case 'tr':
      ctx.lineTo(cx, cy + r);
      ctx.arc(cx - r, cy + r, r, 0, -Math.PI / 2, true);
      ctx.lineTo(cx, cy);
      break;
    case 'bl':
      ctx.lineTo(cx + r, cy);
      ctx.arc(cx + r, cy - r, r, Math.PI / 2, Math.PI, false);
      ctx.lineTo(cx, cy);
      break;
    case 'br':
      ctx.lineTo(cx - r, cy);
      ctx.arc(cx - r, cy - r, r, Math.PI / 2, 0, true);
      ctx.lineTo(cx, cy);
      break;
  }
  ctx.closePath();
  ctx.fill();
}

/** Line Single: thin stroked rect inset 5% from the edge. */
function paintLineSingle(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  color: string,
  width: number,
  height: number,
): void {
  const inset = Math.round(Math.min(width, height) * 0.05);
  const stroke = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke;
  // strokeRect centres on the path; offset by half-stroke to fit inside the inset.
  const half = stroke / 2;
  ctx.strokeRect(
    inset + half,
    inset + half,
    width - 2 * inset - stroke,
    height - 2 * inset - stroke,
  );
  ctx.restore();
}

/** Corner Hooks: four L-shapes at the corners. */
function paintCornerHooks(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  color: string,
  width: number,
  height: number,
): void {
  const arm = Math.round(Math.min(width, height) * 0.08);
  const stroke = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  const inset = Math.round(Math.min(width, height) * 0.05);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke;
  ctx.lineCap = 'square';

  const half = stroke / 2;
  const drawHook = (vx: number, vy: number, horizDir: -1 | 1, vertDir: -1 | 1): void => {
    ctx.beginPath();
    ctx.moveTo(vx + horizDir * arm, vy);
    ctx.lineTo(vx, vy);
    ctx.lineTo(vx, vy + vertDir * arm);
    ctx.stroke();
  };

  drawHook(inset + half, inset + half, 1, 1);
  drawHook(width - inset - half, inset + half, -1, 1);
  drawHook(inset + half, height - inset - half, 1, -1);
  drawHook(width - inset - half, height - inset - half, -1, -1);
  ctx.restore();
}

/** Polaroid: 5% top/left/right + 18% bottom border; output canvas is larger than input. */
function bakePolaroid(color: string, source: SourceImage): SourceImage {
  const shorter = Math.min(source.width, source.height);
  const top = Math.round(shorter * 0.05);
  const left = top;
  const right = top;
  const bottom = Math.round(shorter * 0.18);

  const outW = source.width + left + right;
  const outH = source.height + top + bottom;

  const bake = createBakeCanvas(outW, outH);
  const ctx = getBakeContext2D(bake);

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(source.bitmap, left, top, source.width, source.height);

  return {
    bitmap: bake.canvas,
    width: outW,
    height: outH,
    mimeType: source.mimeType,
  };
}

/** 4% of the shorter dimension, floored at 4px. */
function matThickness(width: number, height: number): number {
  return Math.max(4, Math.round(Math.min(width, height) * 0.04));
}

/** Output dimensions for a preset; equals input except for Polaroid. */
export function frameOutputSize(
  presetId: FramePresetId,
  inputWidth: number,
  inputHeight: number,
): { width: number; height: number } {
  if (presetId !== 'polaroid') {
    return { width: inputWidth, height: inputHeight };
  }
  const shorter = Math.min(inputWidth, inputHeight);
  const top = Math.round(shorter * 0.05);
  const bottom = Math.round(shorter * 0.18);
  return {
    width: inputWidth + 2 * top,
    height: inputHeight + top + bottom,
  };
}
