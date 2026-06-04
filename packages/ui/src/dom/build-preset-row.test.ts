import type { CropPreset } from '@magicpages/kalotyp-core';
import { describe, expect, it, vi } from 'vitest';
import { buildPresetRow, setActivePresetButton } from './build-preset-row.js';

const visible: readonly CropPreset[] = [
  [undefined, 'Custom'],
  [1, 'Square'],
  [16 / 9, '16:9'],
];

describe('buildPresetRow', () => {
  it('renders one button per visible preset, with labels', () => {
    const { container, buttons } = buildPresetRow(visible, 0, () => {});
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.textContent)).toEqual(['Custom', 'Square', '16:9']);
    expect(container.getAttribute('role')).toBe('radiogroup');
  });

  it('marks the active button with aria-checked="true"', () => {
    const { buttons } = buildPresetRow(visible, 1, () => {});
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[2].getAttribute('aria-checked')).toBe('false');
  });

  it('invokes onSelect with the visible index and the preset tuple', () => {
    const onSelect = vi.fn();
    const { buttons } = buildPresetRow(visible, 0, onSelect);
    buttons[2].click();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(2, visible[2]);
  });

  it('renders nothing when given no visible presets', () => {
    const { buttons } = buildPresetRow([], 0, () => {});
    expect(buttons).toHaveLength(0);
  });
});

describe('setActivePresetButton', () => {
  it('moves the aria-checked flag to the new index', () => {
    const { buttons } = buildPresetRow(visible, 0, () => {});
    setActivePresetButton(buttons, 2);
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
    expect(buttons[2].getAttribute('aria-checked')).toBe('true');
  });

  it('clears every button when activeIndex is out of range', () => {
    const { buttons } = buildPresetRow(visible, 1, () => {});
    setActivePresetButton(buttons, -1);
    for (const button of buttons) {
      expect(button.getAttribute('aria-checked')).toBe('false');
    }
  });
});
