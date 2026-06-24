/**
 * Unit tests for the per-selection coordinate inputs. The row is store-free; the test exercises the field
 * geometry and the onShapeChanged emission path.
 */

import type {
  ArrowShape,
  EllipseShape,
  RectShape,
  Shape,
  TextShape,
} from '@magicpages/kalotyp-core';
import { afterEach, describe, expect, it } from 'vitest';
import { applyCoordEdit, buildCoordInputs } from './coord-inputs.js';

const RECT: RectShape = {
  id: 'r',
  kind: 'rect',
  x: 100,
  y: 50,
  width: 200,
  height: 150,
  strokeColor: '#000',
  strokeWidth: 4,
  fillColor: null,
};

const ELLIPSE: EllipseShape = {
  id: 'e',
  kind: 'ellipse',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  strokeColor: '#000',
  strokeWidth: 4,
  fillColor: null,
};

const ARROW: ArrowShape = {
  id: 'a',
  kind: 'arrow',
  x1: 10,
  y1: 20,
  x2: 110,
  y2: 120,
  color: '#000',
  strokeWidth: 4,
};

const TEXT: TextShape = {
  id: 't',
  kind: 'text',
  x: 200,
  y: 80,
  text: 'hi',
  fontSize: 24,
  color: '#000',
  textAlign: 'center',
  fontFamily: 'system',
  fontWeight: 'normal',
  fontStyle: 'normal',
};

describe('coord-inputs row (Phase 6.3 keyboard placement)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('hides itself when no shape is selected', () => {
    const handle = buildCoordInputs({ onShapeChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForShape(null);
    expect(handle.container.hidden).toBe(true);
    expect(handle.container.children.length).toBe(0);
  });

  it.each([
    ['rect', RECT, ['Left (pixels)', 'Top (pixels)', 'Width (pixels)', 'Height (pixels)']],
    ['ellipse', ELLIPSE, ['Left (pixels)', 'Top (pixels)', 'Width (pixels)', 'Height (pixels)']],
    ['arrow', ARROW, ['Start X (pixels)', 'Start Y (pixels)', 'End X (pixels)', 'End Y (pixels)']],
    ['text', TEXT, ['X (pixels)', 'Y (pixels)']],
  ] as const)('renders the right field set and labels for %s', (_kind, shape, expectedLabels) => {
    const handle = buildCoordInputs({ onShapeChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForShape(shape);
    expect(handle.container.hidden).toBe(false);
    const inputs = handle.container.querySelectorAll<HTMLInputElement>(
      '.kalotyp-annotate-coords-input',
    );
    expect(inputs.length).toBe(expectedLabels.length);
    const labels = Array.from(inputs).map((i) => i.getAttribute('aria-label'));
    expect(labels).toEqual([...expectedLabels]);
  });

  it('hides for freehand and highlight (pointer-only kinds)', () => {
    const handle = buildCoordInputs({ onShapeChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForShape({
      id: 'f',
      kind: 'freehand',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      color: '#000',
      strokeWidth: 4,
    } as Shape);
    expect(handle.container.hidden).toBe(true);
  });

  it('emits onShapeChanged when an input commits', () => {
    const seen: Shape[] = [];
    const handle = buildCoordInputs({ onShapeChanged: (shape) => seen.push(shape) });
    document.body.appendChild(handle.container);
    handle.updateForShape(RECT);
    const widthInput = handle.container.querySelector<HTMLInputElement>(
      '.kalotyp-annotate-coords-input[data-field="width"]',
    );
    expect(widthInput).not.toBeNull();
    if (!widthInput) return;
    widthInput.value = '320';
    widthInput.dispatchEvent(new Event('change'));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id: 'r', kind: 'rect', width: 320 });
  });

  it('reflects external shape mutations into the inputs (pointer↔keyboard parity)', () => {
    const handle = buildCoordInputs({ onShapeChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForShape(RECT);
    handle.updateForShape({ ...RECT, x: 999, y: 888 });
    const xInput = handle.container.querySelector<HTMLInputElement>(
      '.kalotyp-annotate-coords-input[data-field="x"]',
    );
    const yInput = handle.container.querySelector<HTMLInputElement>(
      '.kalotyp-annotate-coords-input[data-field="y"]',
    );
    expect(xInput?.valueAsNumber).toBe(999);
    expect(yInput?.valueAsNumber).toBe(888);
  });

  it('does not overwrite a focused, partially-typed input', () => {
    const handle = buildCoordInputs({ onShapeChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForShape(RECT);
    const widthInput = handle.container.querySelector<HTMLInputElement>(
      '.kalotyp-annotate-coords-input[data-field="width"]',
    );
    if (!widthInput) throw new Error('widthInput missing');
    widthInput.focus();
    widthInput.value = '4'; // user mid-type
    handle.updateForShape({ ...RECT, width: 200 }); // store sync
    // The user's in-progress value survives the sync.
    expect(widthInput.value).toBe('4');
  });

  it('rebuilds the field set when the selection switches kinds', () => {
    const handle = buildCoordInputs({ onShapeChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForShape(RECT);
    expect(handle.container.querySelectorAll('.kalotyp-annotate-coords-input').length).toBe(4);
    handle.updateForShape(TEXT);
    expect(handle.container.querySelectorAll('.kalotyp-annotate-coords-input').length).toBe(2);
  });
});

describe('applyCoordEdit', () => {
  it('applies the edit to the matching shape kind', () => {
    expect(applyCoordEdit(RECT, { kind: 'rect', x: 1, y: 2, width: 3, height: 4 })).toMatchObject({
      kind: 'rect',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      // Other fields preserved.
      strokeColor: RECT.strokeColor,
    });
  });

  it('returns the original shape when the edit kind does not match', () => {
    expect(applyCoordEdit(RECT, { kind: 'arrow', x1: 0, y1: 0, x2: 0, y2: 0 })).toBe(RECT);
  });
});
