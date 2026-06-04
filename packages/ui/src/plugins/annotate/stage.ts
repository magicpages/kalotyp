/**
 * Build the layered DOM for the annotation plugin's stage. Three
 * canvases (image, committed shapes, live in-progress) plus three DOM
 * layers (a hit-area for pointer input, a handles layer for selection
 * resize handles, and a text-edit overlay) — / Phase 3
 * brief on stacked canvases.
 *
 * The element ordering follows the z-stack: image at the bottom,
 * shapes and live canvases above it, then the pointer hit-area, then
 * the handles layer (so handles can intercept pointerdowns before the
 * hit-area sees them), then the text overlay on top.
 *
 * The hit-area is the surface the tool / selection layer attaches its
 * pointerdown handlers to. It carries `touch-action: none` so the
 * browser doesn't hijack drags for scroll/pinch on touch devices.
 */

export interface AnnotateStageElements {
  readonly container: HTMLDivElement;
  readonly imageCanvas: HTMLCanvasElement;
  readonly shapesCanvas: HTMLCanvasElement;
  readonly liveCanvas: HTMLCanvasElement;
  readonly hitArea: HTMLDivElement;
  /** Holds selection handles (DOM buttons) when a shape is selected. */
  readonly handlesLayer: HTMLDivElement;
  /** Holds the inline text editor when text is being edited. */
  readonly textOverlay: HTMLDivElement;
}

export function buildAnnotateStage(): AnnotateStageElements {
  const container = document.createElement('div');
  container.className = 'kalotyp-annotate-stage';

  const imageCanvas = document.createElement('canvas');
  imageCanvas.className = 'kalotyp-annotate-image';
  imageCanvas.setAttribute('aria-hidden', 'true');

  const shapesCanvas = document.createElement('canvas');
  shapesCanvas.className = 'kalotyp-annotate-shapes';
  shapesCanvas.setAttribute('aria-hidden', 'true');

  const liveCanvas = document.createElement('canvas');
  liveCanvas.className = 'kalotyp-annotate-live';
  liveCanvas.setAttribute('aria-hidden', 'true');

  const hitArea = document.createElement('div');
  hitArea.className = 'kalotyp-annotate-hit';
  hitArea.setAttribute('role', 'presentation');

  const handlesLayer = document.createElement('div');
  handlesLayer.className = 'kalotyp-annotate-handles';
  handlesLayer.setAttribute('role', 'group');
  handlesLayer.setAttribute('aria-label', 'Selected annotation');

  const textOverlay = document.createElement('div');
  textOverlay.className = 'kalotyp-annotate-text-overlay';

  container.appendChild(imageCanvas);
  container.appendChild(shapesCanvas);
  container.appendChild(liveCanvas);
  container.appendChild(hitArea);
  container.appendChild(handlesLayer);
  container.appendChild(textOverlay);

  return {
    container,
    imageCanvas,
    shapesCanvas,
    liveCanvas,
    hitArea,
    handlesLayer,
    textOverlay,
  };
}
