/**
 * Annotation state and pure mutators. Shapes are a flat discriminated
 * union keyed on `kind`; all coordinates are image-space pixels.
 */

import type { Point } from '../../geometry/rect.js';

export type ShapeKind = 'text' | 'rect' | 'ellipse' | 'arrow' | 'freehand' | 'highlight';

/** Tools the annotation plugin exposes. `select` is the picker. */
export type AnnotateTool = ShapeKind | 'select';

interface ShapeBase {
  /** Stable per-session id; survives undo/redo. */
  readonly id: string;
  readonly kind: ShapeKind;
}

export type TextFontWeight = 'normal' | 'bold';
export type TextFontStyle = 'normal' | 'italic';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextShape extends ShapeBase {
  readonly kind: 'text';
  /** Top-left anchor in image-space pixels. */
  readonly x: number;
  readonly y: number;
  readonly text: string;
  /** Font size in image-space pixels. Changed via the panel, not by handles. */
  readonly fontSize: number;
  /** CSS colour string. */
  readonly color: string;
  /** Glyph justification (multi-line text aligns relative to the anchor). */
  readonly textAlign: TextAlign;
  /** Font key from the font catalogue (see fonts.ts), e.g. `'system'`, `'inter'`. */
  readonly fontFamily: string;
  readonly fontWeight: TextFontWeight;
  readonly fontStyle: TextFontStyle;
}

export interface RectShape extends ShapeBase {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  /** Non-negative after gesture commit; may be negative mid-drag. */
  readonly width: number;
  readonly height: number;
  readonly strokeColor: string;
  readonly strokeWidth: number;
  /** `null` means "no fill". */
  readonly fillColor: string | null;
}

export interface EllipseShape extends ShapeBase {
  readonly kind: 'ellipse';
  /** Bounding-box top-left; the ellipse fits inside the box. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly strokeColor: string;
  readonly strokeWidth: number;
  readonly fillColor: string | null;
}

export interface ArrowShape extends ShapeBase {
  readonly kind: 'arrow';
  readonly x1: number;
  readonly y1: number;
  /** Arrowhead is drawn at (x2, y2). */
  readonly x2: number;
  readonly y2: number;
  readonly color: string;
  readonly strokeWidth: number;
}

export interface FreehandShape extends ShapeBase {
  readonly kind: 'freehand';
  /** Decimated raw points in image-space; smoothing happens at render time. */
  readonly points: ReadonlyArray<Point>;
  readonly color: string;
  readonly strokeWidth: number;
}

export interface HighlightShape extends ShapeBase {
  readonly kind: 'highlight';
  readonly points: ReadonlyArray<Point>;
  /** Default semi-transparent yellow, drawn with `multiply` blend mode. */
  readonly color: string;
  readonly strokeWidth: number;
}

export type Shape =
  | TextShape
  | RectShape
  | EllipseShape
  | ArrowShape
  | FreehandShape
  | HighlightShape;

export interface StylePalette {
  readonly color: string;
  readonly strokeWidth: number;
  /** Used for new rect/ellipse fills; `null` = unfilled. */
  readonly fillColor: string | null;
  /** Used for new text shapes. In image-space pixels. */
  readonly fontSize: number;
  /** Font key for new text shapes (see fonts.ts). */
  readonly fontFamily: string;
  readonly fontWeight: TextFontWeight;
  readonly fontStyle: TextFontStyle;
  readonly textAlign: TextAlign;
}

export interface AnnotateState {
  readonly shapes: ReadonlyArray<Shape>;
  readonly selectedId: string | null;
  readonly activeTool: AnnotateTool;
  readonly currentStyle: StylePalette;
  /** Image-space dimensions of the upstream-baked source the plugin was mounted on. */
  readonly imageSize: { readonly width: number; readonly height: number };
  /** Monotonic counter used to mint shape ids. Never decreases. */
  readonly nextShapeNumber: number;
}

/** Yellow @ 35% alpha; the highlight bake uses `multiply` blending. */
export const HIGHLIGHT_DEFAULT_COLOR = 'rgba(255, 235, 59, 0.35)';
export const HIGHLIGHT_DEFAULT_STROKE = 18;
export const FREEHAND_DEFAULT_STROKE = 6;
export const TEXT_DEFAULT_FONT_SIZE = 32;
export const DEFAULT_PALETTE_COLOR = '#ff3b30';
export const DEFAULT_STROKE_WIDTH = 4;

/** Default font key for new text shapes; resolves to the system stack. */
export const DEFAULT_FONT_KEY = 'system';

export function defaultStylePalette(): StylePalette {
  return {
    color: DEFAULT_PALETTE_COLOR,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    fillColor: null,
    fontSize: TEXT_DEFAULT_FONT_SIZE,
    fontFamily: DEFAULT_FONT_KEY,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
  };
}

/**
 * Fill any missing font fields on a text shape with defaults. Defensive
 * against partial literals (tests) and stale undo snapshots from a prior dev
 * build during hot reload — shapes are never persisted, so this is a safety
 * net, not a schema migration.
 */
export function normalizeTextShape(shape: TextShape): TextShape {
  if (
    typeof shape.fontFamily === 'string' &&
    (shape.fontWeight === 'normal' || shape.fontWeight === 'bold') &&
    (shape.fontStyle === 'normal' || shape.fontStyle === 'italic')
  ) {
    return shape;
  }
  return {
    ...shape,
    fontFamily: typeof shape.fontFamily === 'string' ? shape.fontFamily : DEFAULT_FONT_KEY,
    fontWeight: shape.fontWeight === 'bold' ? 'bold' : 'normal',
    fontStyle: shape.fontStyle === 'italic' ? 'italic' : 'normal',
  };
}

export interface InitialAnnotateStateInput {
  readonly imageSize: { readonly width: number; readonly height: number };
}

export function initialAnnotateState(input: InitialAnnotateStateInput): AnnotateState {
  return {
    shapes: [],
    selectedId: null,
    activeTool: 'select',
    currentStyle: defaultStylePalette(),
    imageSize: input.imageSize,
    nextShapeNumber: 1,
  };
}

/** Allocate a new shape id from the monotonic counter; caller threads `nextShapeNumber` back into state. */
export function mintShapeId(state: AnnotateState): {
  id: string;
  nextShapeNumber: number;
} {
  return {
    id: `s_${state.nextShapeNumber.toString(36)}`,
    nextShapeNumber: state.nextShapeNumber + 1,
  };
}

export function setActiveTool(state: AnnotateState, tool: AnnotateTool): AnnotateState {
  if (state.activeTool === tool) return state;
  // Switching to a drawing tool deselects so the next drag starts a new shape.
  return { ...state, activeTool: tool, selectedId: tool === 'select' ? state.selectedId : null };
}

export function setStyle(state: AnnotateState, partial: Partial<StylePalette>): AnnotateState {
  return { ...state, currentStyle: { ...state.currentStyle, ...partial } };
}

export function selectShape(state: AnnotateState, id: string | null): AnnotateState {
  if (state.selectedId === id) return state;
  return { ...state, selectedId: id };
}

export function addShape(state: AnnotateState, shape: Shape): AnnotateState {
  return { ...state, shapes: [...state.shapes, shape], selectedId: shape.id };
}

export function replaceShape(state: AnnotateState, shape: Shape): AnnotateState {
  let changed = false;
  const next = state.shapes.map((existing) => {
    if (existing.id !== shape.id) return existing;
    changed = true;
    return shape;
  });
  if (!changed) return state;
  return { ...state, shapes: next };
}

export function deleteShape(state: AnnotateState, id: string): AnnotateState {
  const next = state.shapes.filter((shape) => shape.id !== id);
  if (next.length === state.shapes.length) return state;
  return {
    ...state,
    shapes: next,
    selectedId: state.selectedId === id ? null : state.selectedId,
  };
}

export function findShape(state: AnnotateState, id: string | null): Shape | undefined {
  if (id === null) return undefined;
  return state.shapes.find((shape) => shape.id === id);
}

/** Normalise a rect extent so `width`/`height` are non-negative after a sign-flip drag. */
export function normaliseRectExtent(extent: {
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

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.kind) {
    case 'text':
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case 'rect':
    case 'ellipse':
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case 'arrow':
      return {
        ...shape,
        x1: shape.x1 + dx,
        y1: shape.y1 + dy,
        x2: shape.x2 + dx,
        y2: shape.y2 + dy,
      };
    case 'freehand':
    case 'highlight':
      return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    default:
      return assertNever(shape);
  }
}

/** Type-narrowing helper for exhaustive switches over `Shape`. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled annotation shape kind: ${JSON.stringify(value)}`);
}

/**
 * Mirror a shape across an axis of `dims`. Rect/ellipse top-left is
 * remapped so the visible rectangle straddles the same pixels; arrow
 * endpoints and freehand points mirror independently. Text uses its
 * anchor only — the glyph rect walks slightly relative to centre.
 */
export function mirrorShape(
  shape: Shape,
  axis: 'horizontal' | 'vertical',
  dims: { readonly width: number; readonly height: number },
): Shape {
  if (axis === 'horizontal') {
    switch (shape.kind) {
      case 'rect':
      case 'ellipse':
        return { ...shape, x: dims.width - shape.x - shape.width };
      case 'text':
        return { ...shape, x: dims.width - shape.x };
      case 'arrow':
        return { ...shape, x1: dims.width - shape.x1, x2: dims.width - shape.x2 };
      case 'freehand':
      case 'highlight':
        return {
          ...shape,
          points: shape.points.map((p) => ({ x: dims.width - p.x, y: p.y })),
        };
      default:
        return assertNever(shape);
    }
  }
  switch (shape.kind) {
    case 'rect':
    case 'ellipse':
      return { ...shape, y: dims.height - shape.y - shape.height };
    case 'text':
      return { ...shape, y: dims.height - shape.y };
    case 'arrow':
      return { ...shape, y1: dims.height - shape.y1, y2: dims.height - shape.y2 };
    case 'freehand':
    case 'highlight':
      return {
        ...shape,
        points: shape.points.map((p) => ({ x: p.x, y: dims.height - p.y })),
      };
    default:
      return assertNever(shape);
  }
}

/**
 * Rotate a shape `turns × 90°` CW around the centre of `oldDims`. Returns
 * coordinates in the post-rotation image's coord space (dims swap on odd turns).
 */
export function rotateShape(
  shape: Shape,
  turns: 0 | 1 | 2 | 3,
  oldDims: { readonly width: number; readonly height: number },
): Shape {
  if (turns === 0) return shape;
  const rotatePoint = (x: number, y: number): { x: number; y: number } => {
    if (turns === 1) return { x: oldDims.height - y, y: x };
    if (turns === 2) return { x: oldDims.width - x, y: oldDims.height - y };
    return { x: y, y: oldDims.width - x };
  };
  switch (shape.kind) {
    case 'rect':
    case 'ellipse': {
      // Rotated TL + BR become two corners of the new axis-aligned box.
      const corners = [
        rotatePoint(shape.x, shape.y),
        rotatePoint(shape.x + shape.width, shape.y + shape.height),
      ];
      const newX = Math.min(corners[0].x, corners[1].x);
      const newY = Math.min(corners[0].y, corners[1].y);
      const newW = Math.abs(corners[1].x - corners[0].x);
      const newH = Math.abs(corners[1].y - corners[0].y);
      return { ...shape, x: newX, y: newY, width: newW, height: newH };
    }
    case 'text': {
      const p = rotatePoint(shape.x, shape.y);
      return { ...shape, x: p.x, y: p.y };
    }
    case 'arrow': {
      const p1 = rotatePoint(shape.x1, shape.y1);
      const p2 = rotatePoint(shape.x2, shape.y2);
      return { ...shape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case 'freehand':
    case 'highlight':
      return { ...shape, points: shape.points.map((p) => rotatePoint(p.x, p.y)) };
    default:
      return assertNever(shape);
  }
}

/** Apply a transformation to every shape in `state.shapes`. */
export function transformShapes(
  state: AnnotateState,
  transformer: (shape: Shape) => Shape,
): AnnotateState {
  if (state.shapes.length === 0) return state;
  return { ...state, shapes: state.shapes.map(transformer) };
}

/**
 * Kinds placeable from the keyboard. Freehand / highlight are excluded;
 * a "default at centre" instance has no honest shape for those.
 */
export type KeyboardPlaceableKind = 'text' | 'rect' | 'ellipse' | 'arrow';

export const KEYBOARD_PLACEABLE_KINDS: ReadonlyArray<KeyboardPlaceableKind> = [
  'text',
  'rect',
  'ellipse',
  'arrow',
];

export function isKeyboardPlaceableKind(kind: ShapeKind): kind is KeyboardPlaceableKind {
  return kind === 'text' || kind === 'rect' || kind === 'ellipse' || kind === 'arrow';
}

export interface CreateCenteredShapeContext {
  readonly imageSize: { readonly width: number; readonly height: number };
  readonly style: StylePalette;
  readonly id: string;
}

/** A `Shape` whose kind is keyboard-placeable (rect / ellipse / arrow / text). */
export type KeyboardPlaceableShape = TextShape | RectShape | EllipseShape | ArrowShape;

export function createCenteredShape(
  kind: KeyboardPlaceableKind,
  ctx: CreateCenteredShapeContext,
): KeyboardPlaceableShape {
  const { imageSize, style, id } = ctx;
  const shortEdge = Math.min(imageSize.width, imageSize.height);
  const cx = imageSize.width / 2;
  const cy = imageSize.height / 2;

  switch (kind) {
    case 'rect':
    case 'ellipse': {
      const size = Math.max(80, Math.round(shortEdge * 0.25));
      const x = Math.round(cx - size / 2);
      const y = Math.round(cy - size / 2);
      if (kind === 'rect') {
        return {
          id,
          kind: 'rect',
          x,
          y,
          width: size,
          height: size,
          strokeColor: style.color,
          strokeWidth: style.strokeWidth,
          fillColor: style.fillColor,
        };
      }
      return {
        id,
        kind: 'ellipse',
        x,
        y,
        width: size,
        height: size,
        strokeColor: style.color,
        strokeWidth: style.strokeWidth,
        fillColor: style.fillColor,
      };
    }
    case 'arrow': {
      const length = Math.max(100, Math.round(shortEdge * 0.3));
      const x1 = Math.round(cx - length / 2);
      const x2 = x1 + length;
      const y = Math.round(cy);
      return {
        id,
        kind: 'arrow',
        x1,
        y1: y,
        x2,
        y2: y,
        color: style.color,
        strokeWidth: style.strokeWidth,
      };
    }
    case 'text': {
      const x = Math.round(cx);
      const y = Math.round(cy - style.fontSize / 2);
      return {
        id,
        kind: 'text',
        x,
        y,
        text: '',
        fontSize: style.fontSize,
        color: style.color,
        textAlign: style.textAlign,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
      };
    }
  }
}
