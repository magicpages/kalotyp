/**
 * Build the layered DOM for the redact plugin's stage. Same structural
 * shape as the annotate plugin (image canvas, regions canvas, live
 * canvas, hit-area, handles layer) — redact reuses the same selection
 * + drag-to-define interaction model with one shape kind, so keeping
 * the DOM rhythm aligned across plugins is the cleanest choice.
 *
 * No text overlay: redactions don't carry typed content.
 */

export interface RedactStageElements {
  readonly container: HTMLDivElement;
  readonly imageCanvas: HTMLCanvasElement;
  readonly regionsCanvas: HTMLCanvasElement;
  readonly liveCanvas: HTMLCanvasElement;
  readonly hitArea: HTMLDivElement;
  readonly handlesLayer: HTMLDivElement;
}

export function buildRedactStage(): RedactStageElements {
  const container = document.createElement('div');
  container.className = 'kalotyp-redact-stage';

  const imageCanvas = document.createElement('canvas');
  imageCanvas.className = 'kalotyp-redact-image';
  imageCanvas.setAttribute('aria-hidden', 'true');

  const regionsCanvas = document.createElement('canvas');
  regionsCanvas.className = 'kalotyp-redact-regions';
  regionsCanvas.setAttribute('aria-hidden', 'true');

  const liveCanvas = document.createElement('canvas');
  liveCanvas.className = 'kalotyp-redact-live';
  liveCanvas.setAttribute('aria-hidden', 'true');

  const hitArea = document.createElement('div');
  hitArea.className = 'kalotyp-redact-hit';
  hitArea.setAttribute('role', 'presentation');

  const handlesLayer = document.createElement('div');
  handlesLayer.className = 'kalotyp-redact-handles';
  handlesLayer.setAttribute('role', 'group');
  handlesLayer.setAttribute('aria-label', 'Selected redaction region');

  container.appendChild(imageCanvas);
  container.appendChild(regionsCanvas);
  container.appendChild(liveCanvas);
  container.appendChild(hitArea);
  container.appendChild(handlesLayer);

  return { container, imageCanvas, regionsCanvas, liveCanvas, hitArea, handlesLayer };
}
