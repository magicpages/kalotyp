/**
 * Redact state and mutators. Mirrors the annotate plugin's vocabulary
 * (id + kind, monotonic mint, replace/delete) so the selection layer
 * can be reused.
 */

import type { Rect } from '../../geometry/rect.js';

/** `pixelate`, `blur`, or `solid` (flat fill). */
export type RedactMode = 'pixelate' | 'blur' | 'solid';

export const REDACT_MODES: readonly RedactMode[] = ['pixelate', 'blur', 'solid'];

export interface RedactRegion {
  /** Stable per-session id; survives undo/redo. */
  readonly id: string;
  /** Image-space rectangle. May be temporarily negative-extent mid-drag. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly mode: RedactMode;
  /** Used only when `mode === 'solid'`. CSS hex string. */
  readonly color: string;
}

export interface RedactState {
  readonly regions: ReadonlyArray<RedactRegion>;
  /** Monotonic id source for new regions. Never decreases. */
  readonly nextRegionNumber: number;
  /** The currently-selected region id, or `null` when none. */
  readonly selectedId: string | null;
  /** The mode new regions are created with. Persists across selections. */
  readonly currentMode: RedactMode;
  /** Default fill colour for the `solid` mode. */
  readonly currentColor: string;
  /** Image-space dimensions of the upstream-baked source the plugin was mounted on. */
  readonly imageSize: { readonly width: number; readonly height: number };
}

export const DEFAULT_REDACT_COLOR = '#000000';
export const DEFAULT_REDACT_MODE: RedactMode = 'pixelate';

export interface InitialRedactStateInput {
  readonly imageSize: { readonly width: number; readonly height: number };
}

export function initialRedactState(input: InitialRedactStateInput): RedactState {
  return {
    regions: [],
    nextRegionNumber: 1,
    selectedId: null,
    currentMode: DEFAULT_REDACT_MODE,
    currentColor: DEFAULT_REDACT_COLOR,
    imageSize: input.imageSize,
  };
}

/** Allocate a new region id; caller threads `nextRegionNumber` back into state. */
export function mintRegionId(state: RedactState): {
  id: string;
  nextRegionNumber: number;
} {
  return {
    id: `r_${state.nextRegionNumber.toString(36)}`,
    nextRegionNumber: state.nextRegionNumber + 1,
  };
}

export function addRegion(state: RedactState, region: RedactRegion): RedactState {
  return {
    ...state,
    regions: [...state.regions, region],
    selectedId: region.id,
  };
}

export function replaceRegion(state: RedactState, region: RedactRegion): RedactState {
  let changed = false;
  const next = state.regions.map((existing) => {
    if (existing.id !== region.id) return existing;
    changed = true;
    return region;
  });
  if (!changed) return state;
  return { ...state, regions: next };
}

export function deleteRegion(state: RedactState, id: string): RedactState {
  const next = state.regions.filter((region) => region.id !== id);
  if (next.length === state.regions.length) return state;
  return {
    ...state,
    regions: next,
    selectedId: state.selectedId === id ? null : state.selectedId,
  };
}

/** Mirror every region across an axis of `dims`. */
export function mirrorRegions(
  state: RedactState,
  axis: 'horizontal' | 'vertical',
  dims: { readonly width: number; readonly height: number },
): RedactState {
  if (state.regions.length === 0) return state;
  const next = state.regions.map((region) => {
    if (axis === 'horizontal') {
      return { ...region, x: dims.width - region.x - region.width };
    }
    return { ...region, y: dims.height - region.y - region.height };
  });
  return { ...state, regions: next, imageSize: dims };
}

/** Translate every region by `(dx, dy)`. Out-of-bounds regions are kept (bake clips on Save). */
export function translateRegions(
  state: RedactState,
  dx: number,
  dy: number,
  dims: { readonly width: number; readonly height: number },
): RedactState {
  if (state.regions.length === 0) return { ...state, imageSize: dims };
  if (dx === 0 && dy === 0 && state.imageSize === dims) return state;
  const next = state.regions.map((region) => ({
    ...region,
    x: region.x + dx,
    y: region.y + dy,
  }));
  return { ...state, regions: next, imageSize: dims };
}

/**
 * Rotate every region `turns × 90°` CW around the image centre. Caller
 * passes post-rotation dims as `newDims`; pre-rotation dims come from
 * `state.imageSize`.
 */
export function rotateRegions(
  state: RedactState,
  turns: 0 | 1 | 2 | 3,
  newDims: { readonly width: number; readonly height: number },
): RedactState {
  if (turns === 0) return { ...state, imageSize: newDims };
  if (state.regions.length === 0) return { ...state, imageSize: newDims };
  const oldW = state.imageSize.width;
  const oldH = state.imageSize.height;
  const next = state.regions.map((region) => {
    const { x, y, width, height } = region;
    if (turns === 1) {
      return { ...region, x: oldH - y - height, y: x, width: height, height: width };
    }
    if (turns === 2) {
      return {
        ...region,
        x: oldW - x - width,
        y: oldH - y - height,
      };
    }
    return { ...region, x: y, y: oldW - x - width, width: height, height: width };
  });
  return { ...state, regions: next, imageSize: newDims };
}

export function selectRegion(state: RedactState, id: string | null): RedactState {
  if (state.selectedId === id) return state;
  return { ...state, selectedId: id };
}

export function setCurrentMode(state: RedactState, mode: RedactMode): RedactState {
  if (state.currentMode === mode) return state;
  return { ...state, currentMode: mode };
}

export function setCurrentColor(state: RedactState, color: string): RedactState {
  if (state.currentColor === color) return state;
  return { ...state, currentColor: color };
}

/** Update the mode of a region; `color` is preserved across mode flips. */
export function setRegionMode(state: RedactState, id: string, mode: RedactMode): RedactState {
  const region = state.regions.find((r) => r.id === id);
  if (!region) return state;
  if (region.mode === mode) return state;
  return replaceRegion(state, { ...region, mode });
}

export function setRegionColor(state: RedactState, id: string, color: string): RedactState {
  const region = state.regions.find((r) => r.id === id);
  if (!region) return state;
  if (region.color === color) return state;
  return replaceRegion(state, { ...region, color });
}

export function findRegion(state: RedactState, id: string | null): RedactRegion | undefined {
  if (id === null) return undefined;
  return state.regions.find((r) => r.id === id);
}

export function selectedRegionOf(state: RedactState): RedactRegion | null {
  if (state.selectedId === null) return null;
  return state.regions.find((r) => r.id === state.selectedId) ?? null;
}

/** Normalise a region's rect so `width` / `height` are non-negative. */
export function normaliseRegionExtent(extent: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = extent;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  return { x, y, width, height };
}

/** Default-sized region centred on the image. Used by the keyboard "Insert" path. */
export interface CreateCenteredRegionContext {
  readonly imageSize: { readonly width: number; readonly height: number };
  readonly mode: RedactMode;
  readonly color: string;
  readonly id: string;
}

export function createCenteredRegion(ctx: CreateCenteredRegionContext): RedactRegion {
  const { imageSize, mode, color, id } = ctx;
  const shortEdge = Math.min(imageSize.width, imageSize.height);
  const size = Math.max(80, Math.round(shortEdge * 0.25));
  const cx = imageSize.width / 2;
  const cy = imageSize.height / 2;
  const x = Math.round(cx - size / 2);
  const y = Math.round(cy - size / 2);
  return {
    id,
    x,
    y,
    width: size,
    height: size,
    mode,
    color,
  };
}

/** Clamp regions against new bounds; drop regions fully outside. "Clamp, don't reset". */
export function revalidateAgainstBounds(
  state: RedactState,
  bounds: { width: number; height: number },
): RedactState {
  if (state.imageSize.width === bounds.width && state.imageSize.height === bounds.height) {
    return state;
  }
  const kept: RedactRegion[] = [];
  for (const region of state.regions) {
    if (
      region.x + region.width <= 0 ||
      region.y + region.height <= 0 ||
      region.x >= bounds.width ||
      region.y >= bounds.height
    ) {
      continue;
    }
    kept.push(clampRegion(region, bounds));
  }
  const selectedDropped = state.selectedId !== null && !kept.some((r) => r.id === state.selectedId);
  return {
    ...state,
    regions: kept,
    imageSize: { width: bounds.width, height: bounds.height },
    selectedId: selectedDropped ? null : state.selectedId,
  };
}

function clampRegion(
  region: RedactRegion,
  bounds: { width: number; height: number },
): RedactRegion {
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  const right = Math.min(bounds.width, region.x + region.width);
  const bottom = Math.min(bounds.height, region.y + region.height);
  return {
    ...region,
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

/** Bounding-box shape used by the selection layer; matches `Rect`. */
export function regionBoundingBox(region: RedactRegion): Rect {
  return { x: region.x, y: region.y, width: region.width, height: region.height };
}
