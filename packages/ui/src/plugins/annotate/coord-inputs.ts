/**
 * Per-shape coordinate-input rows for the keyboard placement path
 *. The inputs are the keyboard-only equivalent
 * of dragging selection handles: a user types image-space pixel
 * coordinates, the shape's geometry updates on `change` (blur or
 * Enter), and the live canvas + selection handles re-paint via the
 * existing store subscription path.
 *
 * Each shape kind exposes a different shape of fields:
 *
 *   - rect / ellipse → Left, Top, Width, Height (matches crop's
 *     dimension-input pattern from Phase 6.2; same semantics).
 *   - arrow → Start X, Start Y, End X, End Y (the two endpoints).
 *   - text → X, Y (anchor only; size is driven by the font-size
 *     control, and the inline editor handles the text content).
 *   - emoji → X, Y, Size, Angle (the square sticker box; Size and Angle are the
 *     keyboard equivalents of dragging a corner / the rotate handle).
 *
 * One row instance is reused across selections; it rebuilds its
 * fields when the selected shape's kind changes. The mount layer
 * subscribes to the selection and calls `updateForShape(shape)` on
 * each change so the inputs reflect the live geometry.
 */

import {
  type ArrowShape,
  type EllipseShape,
  EMOJI_MIN_SIZE,
  type EmojiShape,
  normalizeAngle,
  type RectShape,
  type Shape,
  type TextShape,
} from '@magicpages/kalotyp-core';

export interface CoordInputsOptions {
  /**
   * Called when a typed value commits (blur or Enter). The handler
   * receives the new shape; the mount layer writes it to the store
   * via `replaceShape` and emits a commit. Keeping the helper
   * store-free means the row's tests don't need to thread a store.
   */
  onShapeChanged(shape: Shape): void;
}

/**
 * A single coordinate edit. Discriminated on shape kind so the apply
 * step can narrow without re-reading the input ids.
 */
export type ShapeCoordEdit =
  | {
      readonly kind: 'rect' | 'ellipse';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: 'arrow';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
    }
  | { readonly kind: 'text'; readonly x: number; readonly y: number }
  | {
      readonly kind: 'emoji';
      readonly x: number;
      readonly y: number;
      readonly size: number;
      readonly rotation: number;
    };

export interface CoordInputsHandle {
  readonly container: HTMLDivElement;
  /** Show inputs for the given shape and prefill values. Hides when shape is null. */
  updateForShape(shape: Shape | null): void;
  destroy(): void;
}

interface FieldSpec {
  readonly id: string;
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  /** Unit named in the accessible label; defaults to pixels. */
  readonly unit?: string;
}

const RECT_FIELDS: ReadonlyArray<FieldSpec> = [
  { id: 'x', label: 'Left' },
  { id: 'y', label: 'Top' },
  { id: 'width', label: 'Width', min: 1 },
  { id: 'height', label: 'Height', min: 1 },
];

const ARROW_FIELDS: ReadonlyArray<FieldSpec> = [
  { id: 'x1', label: 'Start X' },
  { id: 'y1', label: 'Start Y' },
  { id: 'x2', label: 'End X' },
  { id: 'y2', label: 'End Y' },
];

const TEXT_FIELDS: ReadonlyArray<FieldSpec> = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
];

const EMOJI_FIELDS: ReadonlyArray<FieldSpec> = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'size', label: 'Size', min: 1 },
  { id: 'rotation', label: 'Angle', unit: 'degrees' },
];

/**
 * Build a single per-selection coordinate-input row. The row reuses
 * the same `kalotyp-annotate-coords-*` class set across shape kinds
 * so styling is one rule set; only the field set changes per shape.
 */
export function buildCoordInputs(options: CoordInputsOptions): CoordInputsHandle {
  const container = document.createElement('div');
  container.className = 'kalotyp-annotate-coords';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Selected annotation position');
  container.hidden = true;

  let activeShape: Shape | null = null;
  let activeKind: 'rect' | 'ellipse' | 'arrow' | 'text' | 'emoji' | null = null;
  const inputs = new Map<string, HTMLInputElement>();

  function rebuildFor(kind: 'rect' | 'ellipse' | 'arrow' | 'text' | 'emoji'): void {
    container.replaceChildren();
    inputs.clear();
    const fields = fieldsFor(kind);
    for (const spec of fields) {
      const wrapper = document.createElement('label');
      wrapper.className = 'kalotyp-annotate-coords-field';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'kalotyp-annotate-coords-label';
      labelSpan.textContent = spec.label;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'kalotyp-annotate-coords-input';
      input.dataset.field = spec.id;
      input.step = '1';
      input.inputMode = 'numeric';
      if (spec.min !== undefined) input.min = String(spec.min);
      if (spec.max !== undefined) input.max = String(spec.max);
      input.setAttribute('aria-label', `${spec.label} (${spec.unit ?? 'pixels'})`);
      input.addEventListener('change', onAnyInputChange);

      wrapper.appendChild(labelSpan);
      wrapper.appendChild(input);
      container.appendChild(wrapper);
      inputs.set(spec.id, input);
    }
    activeKind = kind;
  }

  function syncValuesFromShape(shape: Shape): void {
    const setVal = (id: string, value: number): void => {
      const el = inputs.get(id);
      if (!el) return;
      const next = String(Math.round(value));
      // Skip the assignment if the user is mid-edit on this very
      // input — overwriting a focused, partially-typed value is the
      // most surprising thing an a11y helper can do. The store-driven
      // sync still catches up after blur via the next `update`.
      if (document.activeElement === el) return;
      if (el.value !== next) el.value = next;
    };

    switch (shape.kind) {
      case 'rect':
      case 'ellipse': {
        setVal('x', shape.x);
        setVal('y', shape.y);
        setVal('width', shape.width);
        setVal('height', shape.height);
        return;
      }
      case 'arrow': {
        setVal('x1', shape.x1);
        setVal('y1', shape.y1);
        setVal('x2', shape.x2);
        setVal('y2', shape.y2);
        return;
      }
      case 'text': {
        setVal('x', shape.x);
        setVal('y', shape.y);
        return;
      }
      case 'emoji': {
        setVal('x', shape.x);
        setVal('y', shape.y);
        setVal('size', shape.size);
        setVal('rotation', shape.rotation);
        return;
      }
      default:
        // freehand / highlight don't expose coordinate inputs (they're
        // pointer-only per ). The mount layer hides the row
        // before reaching this branch; keeping the case exhaustive
        // means adding a new keyboard-placeable kind shows up as a
        // type error here.
        return;
    }
  }

  function onAnyInputChange(): void {
    if (!activeShape || !activeKind) return;
    const edit = readCurrentEdit(activeShape);
    if (!edit) return;
    const updated = applyCoordEdit(activeShape, edit);
    if (updated === activeShape) return;
    activeShape = updated;
    options.onShapeChanged(updated);
  }

  function readCurrentEdit(shape: Shape): ShapeCoordEdit | null {
    const num = (id: string): number => {
      const el = inputs.get(id);
      if (!el) return Number.NaN;
      return el.valueAsNumber;
    };
    switch (shape.kind) {
      case 'rect':
      case 'ellipse': {
        const x = Math.round(num('x'));
        const y = Math.round(num('y'));
        const width = Math.round(num('width'));
        const height = Math.round(num('height'));
        if (![x, y, width, height].every(Number.isFinite)) return null;
        return { kind: shape.kind, x, y, width, height };
      }
      case 'arrow': {
        const x1 = Math.round(num('x1'));
        const y1 = Math.round(num('y1'));
        const x2 = Math.round(num('x2'));
        const y2 = Math.round(num('y2'));
        if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
        return { kind: 'arrow', x1, y1, x2, y2 };
      }
      case 'text': {
        const x = Math.round(num('x'));
        const y = Math.round(num('y'));
        if (![x, y].every(Number.isFinite)) return null;
        return { kind: 'text', x, y };
      }
      case 'emoji': {
        const x = Math.round(num('x'));
        const y = Math.round(num('y'));
        const size = Math.round(num('size'));
        const rotation = Math.round(num('rotation'));
        if (![x, y, size, rotation].every(Number.isFinite)) return null;
        return { kind: 'emoji', x, y, size, rotation };
      }
      default:
        return null;
    }
  }

  return {
    container,
    updateForShape(shape): void {
      if (!shape) {
        activeShape = null;
        activeKind = null;
        container.hidden = true;
        container.replaceChildren();
        inputs.clear();
        return;
      }
      // Freehand / highlight aren't keyboard-placeable; their
      // selection still works (Delete to remove; arrow keys to
      // nudge), but no coordinate inputs are shown.
      if (shape.kind === 'freehand' || shape.kind === 'highlight') {
        activeShape = shape;
        activeKind = null;
        container.hidden = true;
        container.replaceChildren();
        inputs.clear();
        return;
      }
      activeShape = shape;
      if (activeKind !== shape.kind) {
        rebuildFor(shape.kind);
      }
      syncValuesFromShape(shape);
      container.hidden = false;
    },
    destroy(): void {
      container.replaceChildren();
      inputs.clear();
      container.remove();
    },
  };
}

function fieldsFor(
  kind: 'rect' | 'ellipse' | 'arrow' | 'text' | 'emoji',
): ReadonlyArray<FieldSpec> {
  switch (kind) {
    case 'rect':
    case 'ellipse':
      return RECT_FIELDS;
    case 'arrow':
      return ARROW_FIELDS;
    case 'text':
      return TEXT_FIELDS;
    case 'emoji':
      return EMOJI_FIELDS;
  }
}

/**
 * Apply an edit produced by the inputs to the shape it came from.
 * Exported so the mount layer can compose it with its own clamping
 * before writing to the store. The function is total over the shape
 * union so the caller doesn't need to re-narrow.
 */
export function applyCoordEdit(shape: Shape, edit: ShapeCoordEdit): Shape {
  switch (shape.kind) {
    case 'rect': {
      if (edit.kind !== 'rect') return shape;
      const next: RectShape = {
        ...shape,
        x: edit.x,
        y: edit.y,
        width: edit.width,
        height: edit.height,
      };
      return next;
    }
    case 'ellipse': {
      if (edit.kind !== 'ellipse') return shape;
      const next: EllipseShape = {
        ...shape,
        x: edit.x,
        y: edit.y,
        width: edit.width,
        height: edit.height,
      };
      return next;
    }
    case 'arrow': {
      if (edit.kind !== 'arrow') return shape;
      const next: ArrowShape = { ...shape, x1: edit.x1, y1: edit.y1, x2: edit.x2, y2: edit.y2 };
      return next;
    }
    case 'text': {
      if (edit.kind !== 'text') return shape;
      const next: TextShape = { ...shape, x: edit.x, y: edit.y };
      return next;
    }
    case 'emoji': {
      if (edit.kind !== 'emoji') return shape;
      const next: EmojiShape = {
        ...shape,
        x: edit.x,
        y: edit.y,
        size: Math.max(EMOJI_MIN_SIZE, edit.size),
        rotation: normalizeAngle(edit.rotation),
      };
      return next;
    }
    default:
      return shape;
  }
}
