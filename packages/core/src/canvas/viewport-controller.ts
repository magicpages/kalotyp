import type { Point, Size } from '../geometry/rect.js';
import {
  IDENTITY_VIEWPORT_TRANSFORM,
  type StageDimensions,
  type Viewport,
  type ViewportTransform,
  computeViewport,
} from './viewport.js';

export const MAX_ZOOM = 8;
export const MIN_ZOOM = 0.25;

export interface ViewportControllerSnapshot {
  readonly transform: ViewportTransform;
  readonly pinching: boolean;
}

export type ViewportControllerListener = (snapshot: ViewportControllerSnapshot) => void;

/** Editor-level zoom + pan state, shared with every plugin's `UtilityContext`. */
export class ViewportController {
  private current: ViewportTransform;
  private isPinching: boolean;
  private readonly listeners: Set<ViewportControllerListener>;

  constructor(initial: ViewportTransform = IDENTITY_VIEWPORT_TRANSFORM) {
    this.current = clampTransform(initial);
    this.isPinching = false;
    this.listeners = new Set();
  }

  getTransform(): ViewportTransform {
    return this.current;
  }

  getSnapshot(): ViewportControllerSnapshot {
    return { transform: this.current, pinching: this.isPinching };
  }

  setTransform(transform: ViewportTransform): void {
    const next = clampTransform(transform);
    if (transformsEqual(this.current, next)) return;
    this.current = next;
    this.emit();
  }

  /**
   * Apply a multiplicative zoom delta anchored on a stage CSS-pixel point.
   * The point under `anchor` stays under `anchor` after the zoom.
   *
   * Pan is the displaced image-center's offset from the stage center, so the
   * dolly-zoom reduces to `pan_new = ratio · pan_old + (1 − ratio) · (anchor − stageCenter)`,
   * independent of the active plugin's image intrinsic.
   */
  zoomAt(deltaZoom: number, anchor: Point, stageCenter: Point): ViewportTransform {
    if (!Number.isFinite(deltaZoom) || deltaZoom <= 0) return this.current;
    const oldZoom = this.current.zoom;
    const requested = oldZoom * deltaZoom;
    const newZoom = clamp(requested, MIN_ZOOM, MAX_ZOOM);
    if (newZoom === oldZoom) return this.current;

    const ratio = newZoom / oldZoom;
    const anchorRelX = anchor.x - stageCenter.x;
    const anchorRelY = anchor.y - stageCenter.y;
    const newPanX = ratio * this.current.panX + (1 - ratio) * anchorRelX;
    const newPanY = ratio * this.current.panY + (1 - ratio) * anchorRelY;

    this.current = { zoom: newZoom, panX: newPanX, panY: newPanY };
    this.emit();
    return this.current;
  }

  /**
   * Translate pan by `(dx, dy)` in stage CSS pixels at the current zoom.
   * Pan is stored raw; `computeViewport` clamps at emission time so the
   * gesture handler's math stays stable when the user pans past the clamp.
   */
  panBy(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.current = {
      zoom: this.current.zoom,
      panX: this.current.panX + dx,
      panY: this.current.panY + dy,
    };
    this.emit();
  }

  resetToFit(): void {
    if (transformsEqual(this.current, IDENTITY_VIEWPORT_TRANSFORM)) return;
    this.current = IDENTITY_VIEWPORT_TRANSFORM;
    this.emit();
  }

  /** Reset only the pan, preserving zoom. Used on plugin switch. */
  resetPan(): void {
    if (this.current.panX === 0 && this.current.panY === 0) return;
    this.current = { zoom: this.current.zoom, panX: 0, panY: 0 };
    this.emit();
  }

  /** True while a multi-pointer gesture is active. Heavy plugins read this. */
  getPinching(): boolean {
    return this.isPinching;
  }

  setPinching(value: boolean): void {
    if (this.isPinching === value) return;
    this.isPinching = value;
    this.emit();
  }

  computeViewport(stage: StageDimensions, image: Size): Viewport {
    return computeViewport(stage, image, this.current);
  }

  /** Subscribe to transform / pinching changes. Handler runs synchronously after every change. */
  subscribe(listener: ViewportControllerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.listeners.clear();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clampTransform(transform: ViewportTransform): ViewportTransform {
  const zoom = clamp(Number.isFinite(transform.zoom) ? transform.zoom : 1, MIN_ZOOM, MAX_ZOOM);
  const panX = Number.isFinite(transform.panX) ? transform.panX : 0;
  const panY = Number.isFinite(transform.panY) ? transform.panY : 0;
  return { zoom, panX, panY };
}

function transformsEqual(a: ViewportTransform, b: ViewportTransform): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}
