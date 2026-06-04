/**
 * Preferences modal. Lets the user adjust persisted defaults across
 * editor sessions: output format/quality, plus per-utility "remember
 * what I picked last time" toggles.
 *
 * Lifecycle: the caller supplies the current preferences and an
 * `onChange` handler that fires on every internal interaction. The
 * caller is responsible for persisting via `savePreferences` —
 * keeping this modal storage-free means it can be tested without
 * a `localStorage` shim and lets the editor coordinate batched
 * writes with its own debounce.
 */

import type { OutputMimeChoice } from '@magicpages/kalotyp-core';
import { openNestedModal } from '../dom/nested-modal.js';
import { DEFAULT_PREFERENCES, type KalotypPreferences } from './storage.js';

export interface OpenPreferencesModalOptions {
  readonly host: HTMLElement;
  readonly initial: KalotypPreferences;
  onChange(next: KalotypPreferences): void;
  onClose(): void;
}

export interface PreferencesModalHandle {
  close(): void;
}

interface FormatChoice {
  readonly value: OutputMimeChoice;
  readonly label: string;
}

const FORMAT_CHOICES: ReadonlyArray<FormatChoice> = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/avif', label: 'AVIF' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
];

export function openPreferencesModal(options: OpenPreferencesModalOptions): PreferencesModalHandle {
  let state: KalotypPreferences = options.initial;

  function update(patch: Partial<KalotypPreferences>): void {
    state = { ...state, ...patch };
    options.onChange(state);
  }

  const body = document.createElement('div');
  body.className = 'kalotyp-preferences-body';

  // ----- Output defaults -----
  const outputSection = document.createElement('section');
  outputSection.className = 'kalotyp-preferences-section';
  outputSection.innerHTML = '<h4>Output defaults</h4>';

  const formatRow = makeRow('Format');
  const formatSelect = document.createElement('select');
  formatSelect.className = 'kalotyp-output-format';
  formatSelect.setAttribute('aria-label', 'Default output format');
  for (const choice of FORMAT_CHOICES) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label;
    formatSelect.appendChild(option);
  }
  formatSelect.value = state.outputMimeChoice;
  formatSelect.addEventListener('change', () => {
    update({ outputMimeChoice: formatSelect.value as OutputMimeChoice });
  });
  formatRow.appendChild(formatSelect);
  outputSection.appendChild(formatRow);

  const qualityRow = makeRow('Quality');
  const qualitySlider = document.createElement('input');
  qualitySlider.type = 'range';
  qualitySlider.className = 'kalotyp-output-quality';
  qualitySlider.min = '50';
  qualitySlider.max = '100';
  qualitySlider.step = '1';
  qualitySlider.value = String(Math.round(state.outputQuality * 100));
  qualitySlider.setAttribute('aria-label', 'Default output quality');
  qualitySlider.addEventListener('input', () => {
    update({ outputQuality: qualitySlider.valueAsNumber / 100 });
    qualityReadout.textContent = String(qualitySlider.valueAsNumber);
  });
  const qualityReadout = document.createElement('span');
  qualityReadout.className = 'kalotyp-output-quality-readout';
  qualityReadout.textContent = String(Math.round(state.outputQuality * 100));
  qualityReadout.setAttribute('aria-hidden', 'true');
  qualityRow.appendChild(qualitySlider);
  qualityRow.appendChild(qualityReadout);
  outputSection.appendChild(qualityRow);

  // Strip-metadata toggle. Same control as the Output popover —
  // mirrored here so the user can adjust the default without opening
  // the popover.
  const stripToggle = makeToggle(
    'Strip EXIF, GPS, and camera metadata on save',
    state.outputStripMetadata,
    (checked) => update({ outputStripMetadata: checked }),
  );
  outputSection.appendChild(stripToggle);

  // ----- Remember toggles -----
  const memorySection = document.createElement('section');
  memorySection.className = 'kalotyp-preferences-section';
  memorySection.innerHTML = '<h4>Remember across sessions</h4>';

  const annotateToggle = makeToggle(
    'Annotation style (colour + stroke width)',
    state.rememberAnnotationStyle,
    (checked) => update({ rememberAnnotationStyle: checked }),
  );
  const filterToggle = makeToggle('Last filter preset', state.rememberFilter, (checked) =>
    update({ rememberFilter: checked }),
  );
  const frameToggle = makeToggle('Last frame preset', state.rememberFrame, (checked) =>
    update({ rememberFrame: checked }),
  );
  memorySection.appendChild(annotateToggle);
  memorySection.appendChild(filterToggle);
  memorySection.appendChild(frameToggle);

  // ----- Footer -----
  const footer = document.createElement('footer');
  footer.className = 'kalotyp-preferences-footer';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'kalotyp-preferences-reset';
  resetButton.textContent = 'Reset to defaults';
  resetButton.addEventListener('click', () => {
    state = { ...DEFAULT_PREFERENCES };
    options.onChange(state);
    syncControls(state);
  });

  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'kalotyp-preferences-done';
  doneButton.textContent = 'Done';
  doneButton.addEventListener('click', () => handle.close());

  footer.appendChild(resetButton);
  footer.appendChild(doneButton);

  body.appendChild(outputSection);
  body.appendChild(memorySection);
  body.appendChild(footer);

  const handle = openNestedModal({
    host: options.host,
    title: 'Preferences',
    body,
    variant: 'kalotyp-preferences-modal',
    showCloseButton: true,
    onClose: options.onClose,
  });

  function syncControls(s: KalotypPreferences): void {
    formatSelect.value = s.outputMimeChoice;
    qualitySlider.value = String(Math.round(s.outputQuality * 100));
    qualityReadout.textContent = String(Math.round(s.outputQuality * 100));
    syncToggle(stripToggle, s.outputStripMetadata);
    syncToggle(annotateToggle, s.rememberAnnotationStyle);
    syncToggle(filterToggle, s.rememberFilter);
    syncToggle(frameToggle, s.rememberFrame);
  }

  return {
    close: () => handle.close(),
  };
}

function makeRow(label: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'kalotyp-output-row';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'kalotyp-output-row-label';
  labelSpan.textContent = label;
  row.appendChild(labelSpan);
  return row;
}

function makeToggle(
  label: string,
  initial: boolean,
  onChange: (checked: boolean) => void,
): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'kalotyp-preferences-toggle';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = initial;
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  const span = document.createElement('span');
  span.textContent = label;
  row.appendChild(checkbox);
  row.appendChild(span);
  return row;
}

function syncToggle(row: HTMLLabelElement, value: boolean): void {
  const input = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (input && input.checked !== value) input.checked = value;
}
