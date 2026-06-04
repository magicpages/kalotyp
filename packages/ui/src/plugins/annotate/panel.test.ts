import { describe, expect, it } from 'vitest';
import { buildAnnotatePanel } from './panel.js';

const initialStyle = {
  color: '#34c759',
  strokeWidth: 4,
  fillColor: 'transparent',
  fontSize: 24,
};

function build(
  initialTool:
    | 'select'
    | 'rect'
    | 'ellipse'
    | 'arrow'
    | 'text'
    | 'freehand'
    | 'highlight' = 'select',
) {
  const events: Record<string, unknown[]> = {
    color: [],
    stroke: [],
    delete: [],
    tool: [],
    insert: [],
  };
  const coordInputs = document.createElement('div');
  const panel = buildAnnotatePanel({
    initialTool,
    initialStyle,
    canDelete: false,
    coordInputs,
    onSelectTool: (tool) => events.tool?.push(tool),
    onColorChange: (color) => events.color?.push(color),
    onStrokeWidthChange: (w) => events.stroke?.push(w),
    onDeleteSelected: () => events.delete?.push(true),
    onInsertAtCenter: () => events.insert?.push(true),
  });
  return { panel, events };
}

describe('annotate panel — hex code input', () => {
  it('mounts a single hex code input as the only typed colour control', () => {
    const { panel } = build();
    const hex = panel.container.querySelector('.kalotyp-annotate-hex') as HTMLInputElement | null;
    expect(hex).not.toBeNull();
    expect(hex?.getAttribute('aria-label')).toBe('Color hex code');
    expect(hex?.value.toLowerCase()).toBe('#34c759');
    // The native `<input type="color">` was dropped (Phase 6.6) — it
    // duplicated the swatches' role and crowded the row.
    expect(panel.container.querySelector('.kalotyp-annotate-color')).toBeNull();
  });

  it('commits a typed valid #rrggbb value via the change event', () => {
    const { panel, events } = build();
    const hex = panel.container.querySelector('.kalotyp-annotate-hex') as HTMLInputElement;
    hex.value = '#ff3300';
    hex.dispatchEvent(new Event('change'));
    expect(events.color).toEqual(['#ff3300']);
  });

  it('expands #rgb shorthand to #rrggbb on commit', () => {
    const { panel, events } = build();
    const hex = panel.container.querySelector('.kalotyp-annotate-hex') as HTMLInputElement;
    hex.value = '#abc';
    hex.dispatchEvent(new Event('change'));
    expect(events.color).toEqual(['#aabbcc']);
  });

  it('rejects malformed input and restores the last valid hex without firing the handler', () => {
    const { panel, events } = build();
    const hex = panel.hexInput;
    hex.value = 'not a colour';
    hex.dispatchEvent(new Event('change'));
    expect(events.color).toEqual([]);
    // The seed colour stays visible; bad input is cleared.
    expect(hex.value.toLowerCase()).toBe('#34c759');
  });
});

describe('annotate panel — keyboard placement Insert button', () => {
  it('mounts a labelled Insert button in the style row', () => {
    const { panel } = build('rect');
    const insert = panel.insertButton;
    expect(insert).toBeTruthy();
    expect(insert.getAttribute('aria-label')).toBe('Insert annotation at image centre');
    expect(insert.disabled).toBe(false);
  });

  it('disables the Insert button when the active tool is select', () => {
    const { panel } = build('select');
    expect(panel.insertButton.disabled).toBe(true);
  });

  it.each(['freehand', 'highlight'] as const)(
    'disables the Insert button for %s (pointer-only tools)',
    (tool) => {
      const { panel } = build(tool);
      expect(panel.insertButton.disabled).toBe(true);
    },
  );

  it.each(['rect', 'ellipse', 'arrow', 'text'] as const)(
    'enables Insert for the keyboard-placeable tool: %s',
    (tool) => {
      const { panel } = build(tool);
      expect(panel.insertButton.disabled).toBe(false);
    },
  );

  it('toggles Insert disabled state when setActiveTool changes', () => {
    const { panel } = build('select');
    expect(panel.insertButton.disabled).toBe(true);
    panel.setActiveTool('rect');
    expect(panel.insertButton.disabled).toBe(false);
    panel.setActiveTool('freehand');
    expect(panel.insertButton.disabled).toBe(true);
  });

  it('fires onInsertAtCenter when clicked', () => {
    const { panel, events } = build('rect');
    panel.insertButton.click();
    expect(events.insert).toEqual([true]);
  });

  it('hosts the coordinate-inputs slot inside the panel container', () => {
    const coordInputs = document.createElement('div');
    coordInputs.dataset.testTag = 'slot';
    const panel = buildAnnotatePanel({
      initialTool: 'rect',
      initialStyle,
      canDelete: false,
      coordInputs,
      onSelectTool: () => {},
      onColorChange: () => {},
      onStrokeWidthChange: () => {},
      onDeleteSelected: () => {},
      onInsertAtCenter: () => {},
    });
    expect(panel.container.contains(coordInputs)).toBe(true);
    // Slot lives below the style row so a keyboard user reaches it
    // via natural Tab order after the colour / stroke / delete /
    // insert controls.
    const lastChild = panel.container.lastElementChild;
    expect(lastChild).toBe(coordInputs);
  });
});
