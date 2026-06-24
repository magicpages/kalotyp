import { describe, expect, it } from 'vitest';
import { buildAnnotatePanel } from './panel.js';

const initialStyle = {
  color: '#34c759',
  strokeWidth: 4,
  fillColor: 'transparent',
  fontSize: 24,
  fontFamily: 'system',
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
  textAlign: 'left' as const,
  emoji: '😀',
};

function build(
  initialTool:
    | 'select'
    | 'rect'
    | 'ellipse'
    | 'arrow'
    | 'text'
    | 'freehand'
    | 'highlight'
    | 'emoji' = 'select',
) {
  const events: Record<string, unknown[]> = {
    color: [],
    stroke: [],
    delete: [],
    tool: [],
    insert: [],
    fontFamily: [],
    fontSize: [],
    bold: [],
    italic: [],
    align: [],
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
    onFontFamilyChange: (f) => events.fontFamily?.push(f),
    onFontSizeChange: (s) => events.fontSize?.push(s),
    onToggleBold: () => events.bold?.push(true),
    onToggleItalic: () => events.italic?.push(true),
    onAlignChange: (a) => events.align?.push(a),
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

  it.each([
    'freehand',
    'highlight',
  ] as const)('disables the Insert button for %s (pointer-only tools)', (tool) => {
    const { panel } = build(tool);
    expect(panel.insertButton.disabled).toBe(true);
  });

  it.each([
    'rect',
    'ellipse',
    'arrow',
    'text',
    'emoji',
  ] as const)('enables Insert for the keyboard-placeable tool: %s', (tool) => {
    const { panel } = build(tool);
    expect(panel.insertButton.disabled).toBe(false);
  });

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
      onFontFamilyChange: () => {},
      onFontSizeChange: () => {},
      onToggleBold: () => {},
      onToggleItalic: () => {},
      onAlignChange: () => {},
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

describe('annotate panel — emoji tool', () => {
  it('mounts an Emoji tool button in the toolbar', () => {
    const { panel } = build();
    const emojiTool = panel.toolButtons.get('emoji');
    expect(emojiTool).toBeTruthy();
    expect(emojiTool?.getAttribute('aria-label')).toBe('Emoji');
  });

  it('emoji mode hides the colour, stroke, and text controls', () => {
    const { panel } = build('emoji');
    panel.setControlsMode({ text: false, emoji: true });
    const swatches = panel.container.querySelector<HTMLElement>('.kalotyp-annotate-swatches');
    const strokeWrap = panel.container.querySelector<HTMLElement>('.kalotyp-annotate-stroke-wrap');
    const textRow = panel.container.querySelector<HTMLElement>('.kalotyp-annotate-text-row');
    expect(swatches?.style.display).toBe('none');
    expect(panel.hexInput.style.display).toBe('none');
    expect(strokeWrap?.style.display).toBe('none');
    expect(textRow?.style.display).toBe('none');
  });

  it('shape mode restores the colour + stroke controls', () => {
    const { panel } = build('rect');
    panel.setControlsMode({ text: false, emoji: true });
    panel.setControlsMode({ text: false, emoji: false });
    const swatches = panel.container.querySelector<HTMLElement>('.kalotyp-annotate-swatches');
    const strokeWrap = panel.container.querySelector<HTMLElement>('.kalotyp-annotate-stroke-wrap');
    expect(swatches?.style.display).not.toBe('none');
    expect(panel.hexInput.style.display).not.toBe('none');
    expect(strokeWrap?.style.display).not.toBe('none');
  });
});

describe('annotate panel — font size input', () => {
  it('commits a valid size and reverts invalid input to the last valid size, not the palette default', () => {
    const { panel, events } = build('text');
    const input = panel.fontSizeInput;

    // A valid change commits and becomes the new "last valid" value.
    input.value = '64';
    input.dispatchEvent(new Event('change'));
    expect(events.fontSize).toEqual([64]);

    // An entry below the min of 8 reverts to 64 (the current size), NOT 24.
    input.value = '3';
    input.dispatchEvent(new Event('change'));
    expect(input.value).toBe('64');
    // An entry above the max of 400 also reverts (typed input bypasses `max`).
    input.value = '9999';
    input.dispatchEvent(new Event('change'));
    expect(input.value).toBe('64');
    // No extra onFontSizeChange fired for either out-of-range entry.
    expect(events.fontSize).toEqual([64]);
  });

  it('keeps the revert target in sync when the style changes externally', () => {
    const { panel } = build('text');
    panel.setStyle({ ...initialStyle, fontSize: 120 });

    // After an external style change to 120, an invalid entry reverts to 120.
    panel.fontSizeInput.value = '0';
    panel.fontSizeInput.dispatchEvent(new Event('change'));
    expect(panel.fontSizeInput.value).toBe('120');
  });
});
