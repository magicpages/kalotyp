/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRedactPanel, type RedactPanel } from './panel.js';

function makePanel(overrides: Partial<Parameters<typeof buildRedactPanel>[0]> = {}): {
  panel: RedactPanel;
  calls: Record<string, ReturnType<typeof vi.fn>>;
} {
  const calls = {
    onSelectMode: vi.fn(),
    onColorChange: vi.fn(),
    onDeleteSelected: vi.fn(),
    onInsertAtCenter: vi.fn(),
  };
  const coordInputs = document.createElement('div');
  coordInputs.className = 'kalotyp-redact-coords';
  const panel = buildRedactPanel({
    initialMode: 'pixelate',
    initialColor: '#000000',
    canDelete: false,
    coordInputs,
    onSelectMode: calls.onSelectMode,
    onColorChange: calls.onColorChange,
    onDeleteSelected: calls.onDeleteSelected,
    onInsertAtCenter: calls.onInsertAtCenter,
    ...overrides,
  });
  return { panel, calls };
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('redact panel', () => {
  it('renders the three mode buttons in radiogroup form', () => {
    const { panel } = makePanel();
    document.body.appendChild(panel.container);
    expect(panel.modeButtons.size).toBe(3);
    const toolbar = panel.container.querySelector('.kalotyp-redact-toolbar');
    expect(toolbar?.getAttribute('role')).toBe('radiogroup');
    for (const [mode, button] of panel.modeButtons) {
      expect(button.getAttribute('role')).toBe('radio');
      expect(button.dataset.mode).toBe(mode);
    }
  });

  it('marks the initial mode aria-checked=true', () => {
    const { panel } = makePanel({ initialMode: 'blur' });
    document.body.appendChild(panel.container);
    const blur = panel.modeButtons.get('blur');
    const pixelate = panel.modeButtons.get('pixelate');
    expect(blur?.getAttribute('aria-checked')).toBe('true');
    expect(pixelate?.getAttribute('aria-checked')).toBe('false');
  });

  it('clicking a mode button fires onSelectMode', () => {
    const { panel, calls } = makePanel();
    document.body.appendChild(panel.container);
    panel.modeButtons.get('solid')?.click();
    expect(calls.onSelectMode).toHaveBeenCalledWith('solid');
  });

  it('disables the colour inputs when the active mode is not "solid"', () => {
    const { panel } = makePanel({ initialMode: 'pixelate' });
    document.body.appendChild(panel.container);
    expect(panel.colorInput.disabled).toBe(true);
    expect(panel.hexInput.disabled).toBe(true);
    panel.setActiveMode('solid');
    expect(panel.colorInput.disabled).toBe(false);
    expect(panel.hexInput.disabled).toBe(false);
  });

  it('typing a valid hex into the hex input commits and normalises the colour', () => {
    const { panel, calls } = makePanel({ initialMode: 'solid' });
    document.body.appendChild(panel.container);
    panel.hexInput.value = 'ff0000';
    panel.hexInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls.onColorChange).toHaveBeenCalledWith('#ff0000');
    expect(panel.hexInput.value).toBe('#ff0000');
  });

  it('rejecting an invalid hex restores the previous colour without firing the handler', () => {
    const { panel, calls } = makePanel({ initialMode: 'solid' });
    document.body.appendChild(panel.container);
    panel.hexInput.value = 'gibberish';
    panel.hexInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(calls.onColorChange).not.toHaveBeenCalled();
    expect(panel.hexInput.value).toBe(panel.colorInput.value);
  });

  it('Insert / Delete buttons fire their handlers', () => {
    const { panel, calls } = makePanel({ canDelete: true });
    document.body.appendChild(panel.container);
    panel.insertButton.click();
    expect(calls.onInsertAtCenter).toHaveBeenCalledOnce();
    panel.deleteButton.click();
    expect(calls.onDeleteSelected).toHaveBeenCalledOnce();
  });

  it('Delete button is disabled until a region is selected', () => {
    const { panel } = makePanel({ canDelete: false });
    document.body.appendChild(panel.container);
    expect(panel.deleteButton.disabled).toBe(true);
    panel.setCanDelete(true);
    expect(panel.deleteButton.disabled).toBe(false);
  });
});
