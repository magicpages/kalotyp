/**
 * Per-axis scale factors. `lockAspect` makes the editor keep `scaleX === scaleY`.
 * Output pixels are computed at bake time as `round(upstream * scale)`,
 * clamped to `[MIN_DIMENSION, MAX_DIMENSION]`.
 */
export interface ResizeState {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly lockAspect: boolean;
}

export const MAX_DIMENSION = 8000;
export const MIN_DIMENSION = 1;

export function initialResizeState(): ResizeState {
  return { scaleX: 1, scaleY: 1, lockAspect: true };
}

export function isResizeNoOp(state: ResizeState): boolean {
  return Math.abs(state.scaleX - 1) < 1e-9 && Math.abs(state.scaleY - 1) < 1e-9;
}

/** Integer output dimensions for an upstream image, clamped per axis. */
export function resolveOutputSize(
  state: ResizeState,
  upstream: { readonly width: number; readonly height: number },
): { width: number; height: number } {
  const width = clampInt(Math.round(upstream.width * state.scaleX));
  const height = clampInt(Math.round(upstream.height * state.scaleY));
  return { width, height };
}

/** Set width via a pixel value; with `lockAspect` the vertical scale follows. */
export function setWidthPx(
  state: ResizeState,
  widthPx: number,
  upstream: { readonly width: number; readonly height: number },
): ResizeState {
  if (upstream.width <= 0) return state;
  const target = clampInt(Math.round(widthPx));
  const scaleX = target / upstream.width;
  const scaleY = state.lockAspect ? scaleX : state.scaleY;
  return { ...state, scaleX, scaleY };
}

export function setHeightPx(
  state: ResizeState,
  heightPx: number,
  upstream: { readonly width: number; readonly height: number },
): ResizeState {
  if (upstream.height <= 0) return state;
  const target = clampInt(Math.round(heightPx));
  const scaleY = target / upstream.height;
  const scaleX = state.lockAspect ? scaleY : state.scaleX;
  return { ...state, scaleX, scaleY };
}

/** Uniform percentage change; always touches both axes regardless of `lockAspect`. */
export function setPercent(state: ResizeState, percent: number): ResizeState {
  const scale = clampScaleForPercent(percent / 100);
  return { ...state, scaleX: scale, scaleY: scale };
}

export function setLockAspect(state: ResizeState, locked: boolean): ResizeState {
  if (state.lockAspect === locked) return state;
  if (!locked) return { ...state, lockAspect: false };
  // Average the two scales so neither axis arbitrarily wins on lock.
  const merged = (state.scaleX + state.scaleY) / 2;
  return { scaleX: merged, scaleY: merged, lockAspect: true };
}

/** Percent display value; when axes differ, returns the larger scale. */
export function effectivePercent(state: ResizeState): number {
  const max = Math.max(state.scaleX, state.scaleY);
  return Math.round(max * 1000) / 10;
}

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return MIN_DIMENSION;
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.trunc(n)));
}

function clampScaleForPercent(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0.01;
  return Math.max(0.01, Math.min(scale, MAX_DIMENSION));
}
