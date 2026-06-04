import type { CornerHandle, EdgeHandle, HandleDirection } from '@magicpages/kalotyp-core';

export interface StageElements {
  readonly container: HTMLDivElement;
  readonly imageCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  readonly handlesLayer: HTMLDivElement;
  readonly handles: Readonly<Record<HandleDirection, HTMLButtonElement>>;
  /**
   * Per-corner wrapper providing the positioning context Ghost's pintura.css expects:
   * `[data-direction=tr|bl|br] { left/top: -20px !important }` resolves against this
   * anchor, not the stage. Without it three corner buttons end up off-screen.
   */
  readonly cornerAnchors: Readonly<Record<CornerHandle, HTMLDivElement>>;
  /** Body drag surface — under handles, above canvases in z-order. */
  readonly bodyHitArea: HTMLDivElement;
}

const CORNERS: readonly CornerHandle[] = ['tl', 'tr', 'bl', 'br'];
const EDGES: readonly EdgeHandle[] = ['t', 'r', 'b', 'l'];

/** Build the interactive crop UI inside the stage. Class names and data-* come from the Ghost contract. */
export function buildStageElements(): StageElements {
  const container = document.createElement('div');
  container.className = 'kalotyp-stage-container';

  const imageCanvas = document.createElement('canvas');
  imageCanvas.className = 'kalotyp-stage-image';
  imageCanvas.setAttribute('aria-hidden', 'true');

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.className = 'kalotyp-stage-overlay';
  overlayCanvas.setAttribute('aria-hidden', 'true');

  const bodyHitArea = document.createElement('div');
  bodyHitArea.className = 'kalotyp-stage-body';

  const handlesLayer = document.createElement('div');
  handlesLayer.className = 'kalotyp-handles';
  handlesLayer.setAttribute('role', 'group');
  handlesLayer.setAttribute('aria-label', 'Crop region');

  const handles = {} as Record<HandleDirection, HTMLButtonElement>;
  for (const direction of EDGES) {
    const button = createEdgeButton(direction);
    handles[direction] = button;
    handlesLayer.appendChild(button);
  }

  const cornerAnchors = {} as Record<CornerHandle, HTMLDivElement>;
  for (const direction of CORNERS) {
    const anchor = document.createElement('div');
    anchor.className = 'kalotyp-corner-anchor';
    anchor.dataset.direction = direction;
    const button = createCornerButton(direction);
    anchor.appendChild(button);
    handles[direction] = button;
    cornerAnchors[direction] = anchor;
    handlesLayer.appendChild(anchor);
  }

  container.appendChild(imageCanvas);
  container.appendChild(overlayCanvas);
  container.appendChild(bodyHitArea);
  container.appendChild(handlesLayer);

  return {
    container,
    imageCanvas,
    overlayCanvas,
    handlesLayer,
    handles,
    cornerAnchors,
    bodyHitArea,
  };
}

function createCornerButton(direction: CornerHandle): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kalotyp-handle';
  button.dataset.shape = 'circle';
  button.dataset.direction = direction;
  button.setAttribute('aria-label', labelFor(direction));
  button.tabIndex = 0;
  return button;
}

function createEdgeButton(direction: EdgeHandle): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kalotyp-handle';
  button.dataset.shape = 'edge';
  button.dataset.direction = direction;
  button.setAttribute('aria-label', labelFor(direction));
  button.tabIndex = 0;
  return button;
}

function labelFor(direction: HandleDirection): string {
  switch (direction) {
    case 'tl':
      return 'Top-left crop handle';
    case 'tr':
      return 'Top-right crop handle';
    case 'bl':
      return 'Bottom-left crop handle';
    case 'br':
      return 'Bottom-right crop handle';
    case 't':
      return 'Top crop handle';
    case 'r':
      return 'Right crop handle';
    case 'b':
      return 'Bottom crop handle';
    case 'l':
      return 'Left crop handle';
  }
}
