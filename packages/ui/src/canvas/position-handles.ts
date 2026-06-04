import {
  type CornerHandle,
  type EdgeHandle,
  type Rect,
  type Viewport,
  rectImageToDisplay,
} from '@magicpages/kalotyp-core';

/**
 * Position corner anchors, edge handles, and body hit-area to match the crop rect.
 *
 * Corner buttons aren't positioned directly: they live inside an anchor that sits at the
 * corner point, and host CSS (Ghost's `pintura.css` or our `crop.css`) shifts the button
 * by `-20px` so its 20×20 bracket pseudo-element aligns with the corner. Edges are inset
 * by 12px on each end so they don't overlap the corner brackets.
 */
export interface PositionHandlesInput {
  readonly cropRectImage: Rect;
  readonly viewport: Viewport;
  readonly cornerAnchors: Readonly<Record<CornerHandle, HTMLElement>>;
  readonly edgeHandles: Readonly<Record<EdgeHandle, HTMLElement>>;
  readonly bodyHitArea: HTMLElement;
}

const CORNER_INSET = 12;

export function positionHandles(input: PositionHandlesInput): void {
  const display = rectImageToDisplay(input.cropRectImage, input.viewport);
  const { cornerAnchors, edgeHandles, bodyHitArea } = input;

  bodyHitArea.style.left = `${display.x}px`;
  bodyHitArea.style.top = `${display.y}px`;
  bodyHitArea.style.width = `${display.width}px`;
  bodyHitArea.style.height = `${display.height}px`;

  setAnchor(cornerAnchors.tl, display.x, display.y);
  setAnchor(cornerAnchors.tr, display.x + display.width, display.y);
  setAnchor(cornerAnchors.bl, display.x, display.y + display.height);
  setAnchor(cornerAnchors.br, display.x + display.width, display.y + display.height);

  const horizontalLength = Math.max(0, display.width - CORNER_INSET * 2);
  const verticalLength = Math.max(0, display.height - CORNER_INSET * 2);

  setHorizontalEdge(edgeHandles.t, display.x + CORNER_INSET, display.y, horizontalLength);
  setHorizontalEdge(
    edgeHandles.b,
    display.x + CORNER_INSET,
    display.y + display.height,
    horizontalLength,
  );
  setVerticalEdge(edgeHandles.l, display.x, display.y + CORNER_INSET, verticalLength);
  setVerticalEdge(
    edgeHandles.r,
    display.x + display.width,
    display.y + CORNER_INSET,
    verticalLength,
  );
}

function setAnchor(anchor: HTMLElement, x: number, y: number): void {
  anchor.style.left = `${x}px`;
  anchor.style.top = `${y}px`;
}

function setHorizontalEdge(handle: HTMLElement, x: number, y: number, length: number): void {
  handle.style.left = `${x}px`;
  handle.style.top = `${y}px`;
  handle.style.width = `${length}px`;
}

function setVerticalEdge(handle: HTMLElement, x: number, y: number, length: number): void {
  handle.style.left = `${x}px`;
  handle.style.top = `${y}px`;
  handle.style.height = `${length}px`;
}
