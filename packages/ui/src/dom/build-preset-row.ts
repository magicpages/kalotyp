import type { CropPreset } from '@magicpages/kalotyp-core';

export interface PresetRowElements {
  readonly container: HTMLDivElement;
  readonly buttons: readonly HTMLButtonElement[];
}

/** Build the aspect-ratio preset row. `activeIndex` indexes into the visible presets passed in. */
export function buildPresetRow(
  visiblePresets: readonly CropPreset[],
  activeIndex: number,
  onSelect: (visibleIndex: number, preset: CropPreset) => void,
): PresetRowElements {
  const container = document.createElement('div');
  container.className = 'kalotyp-preset-row';
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Crop aspect ratio');

  const buttons: HTMLButtonElement[] = [];
  visiblePresets.forEach((preset, index) => {
    const [, label] = preset;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-preset-button';
    button.textContent = label;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', index === activeIndex ? 'true' : 'false');
    button.dataset.presetIndex = String(index);
    button.addEventListener('click', () => onSelect(index, preset));
    container.appendChild(button);
    buttons.push(button);
  });

  return { container, buttons };
}

/** Update the active state of an existing preset row in place. */
export function setActivePresetButton(
  buttons: readonly HTMLButtonElement[],
  activeIndex: number,
): void {
  buttons.forEach((button, index) => {
    button.setAttribute('aria-checked', index === activeIndex ? 'true' : 'false');
  });
}
