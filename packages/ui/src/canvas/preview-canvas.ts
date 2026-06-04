import {
  type SourceImage,
  type Viewport,
  type ViewportController,
  computeViewport,
} from '@magicpages/kalotyp-core';

const STAGE_PADDING_PX = 32;

export interface PreviewCanvas {
  readonly container: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
}

export function buildPreviewCanvas(): PreviewCanvas {
  const container = document.createElement('div');
  container.className = 'kalotyp-stage-container kalotyp-preview-container';

  const canvas = document.createElement('canvas');
  canvas.className = 'kalotyp-stage-image kalotyp-preview-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  container.appendChild(canvas);
  return { container, canvas };
}

/** Compute the letterboxed viewport for a preview. Returns `undefined` if the container has no laid-out size yet. */
export function previewViewportFor(
  container: HTMLElement,
  intrinsic: { width: number; height: number },
  controller?: ViewportController,
): { viewport: Viewport; stageWidth: number; stageHeight: number } | undefined {
  const rect = container.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  const stageDims = { width: rect.width, height: rect.height, padding: STAGE_PADDING_PX };
  const viewport = controller
    ? controller.computeViewport(stageDims, intrinsic)
    : computeViewport(stageDims, intrinsic);
  return { viewport, stageWidth: rect.width, stageHeight: rect.height };
}

/** Paint into a preview canvas. The callback receives a DPR-scaled context positioned at (0,0) in stage CSS pixels. */
export function paintPreview(
  canvas: HTMLCanvasElement,
  stageWidth: number,
  stageHeight: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const targetW = Math.max(1, Math.round(stageWidth * dpr));
  const targetH = Math.max(1, Math.round(stageHeight * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  canvas.style.width = `${stageWidth}px`;
  canvas.style.height = `${stageHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, stageWidth, stageHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  draw(ctx);
}

export { STAGE_PADDING_PX };
export type { SourceImage };
