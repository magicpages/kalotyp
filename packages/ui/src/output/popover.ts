/**
 * Output popover anchored to the Save-button caret: format, quality, strip-metadata.
 * State commits immediately to the Store; no apply button. Unsupported formats
 * (per async runtime probe) are disabled in-place when the probe resolves.
 */

import {
  canEncodeMime,
  type OutputMimeChoice,
  type OutputState,
  type Store,
  setOutputMime,
  setOutputQuality,
  setStripMetadata,
} from '@magicpages/kalotyp-core';
import { openNestedModal } from '../dom/nested-modal.js';

export interface OpenOutputPopoverOptions {
  readonly host: HTMLElement;
  readonly anchor: HTMLElement;
  readonly store: Store<OutputState>;
  /** Click of "Save and close" inside the popover. */
  readonly onSaveAndClose: () => void;
  /** Mirrors the editor's Save-enabled state so the in-popover Save button stays in sync. */
  readonly canSave: () => boolean;
  readonly onClose: () => void;
}

export interface OutputPopoverHandle {
  close(): void;
}

interface FormatChoice {
  readonly value: OutputMimeChoice;
  readonly label: string;
  readonly description: string;
  /** Mime types the runtime must be able to encode for this option to be usable. */
  readonly requires: ReadonlyArray<string>;
}

const FORMAT_CHOICES: ReadonlyArray<FormatChoice> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'WebP when supported, PNG fallback.',
    requires: [],
  },
  {
    value: 'image/webp',
    label: 'WebP',
    description: 'Best compression for most images.',
    requires: ['image/webp'],
  },
  {
    value: 'image/avif',
    label: 'AVIF',
    description: 'Smallest size; slower encode.',
    requires: ['image/avif'],
  },
  {
    value: 'image/jpeg',
    label: 'JPEG',
    description: 'Universal; no transparency.',
    requires: ['image/jpeg'],
  },
  {
    value: 'image/png',
    label: 'PNG',
    description: 'Lossless; preserves transparency.',
    requires: ['image/png'],
  },
];

export function openOutputPopover(options: OpenOutputPopoverOptions): OutputPopoverHandle {
  const { host, anchor, store } = options;

  const body = document.createElement('div');
  body.className = 'kalotyp-output-popover-body';

  const formatLabel = document.createElement('label');
  formatLabel.className = 'kalotyp-output-row';
  const formatLabelText = document.createElement('span');
  formatLabelText.className = 'kalotyp-output-row-label';
  formatLabelText.textContent = 'Format';
  formatLabel.appendChild(formatLabelText);

  const formatSelect = document.createElement('select');
  formatSelect.className = 'kalotyp-output-format';
  formatSelect.setAttribute('aria-label', 'Output format');
  for (const choice of FORMAT_CHOICES) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label;
    formatSelect.appendChild(option);
  }
  formatSelect.value = store.get().mimeChoice;
  formatSelect.addEventListener('change', () => {
    const value = formatSelect.value as OutputMimeChoice;
    store.update((current) => setOutputMime(current, value));
  });
  formatLabel.appendChild(formatSelect);

  const formatHint = document.createElement('p');
  formatHint.className = 'kalotyp-output-hint';
  formatHint.setAttribute('aria-live', 'polite');

  const qualityLabel = document.createElement('label');
  qualityLabel.className = 'kalotyp-output-row';
  const qualityLabelText = document.createElement('span');
  qualityLabelText.className = 'kalotyp-output-row-label';
  qualityLabelText.textContent = 'Quality';
  qualityLabel.appendChild(qualityLabelText);

  const qualitySlider = document.createElement('input');
  qualitySlider.type = 'range';
  qualitySlider.className = 'kalotyp-output-quality';
  qualitySlider.min = '50';
  qualitySlider.max = '100';
  qualitySlider.step = '1';
  qualitySlider.value = String(Math.round(store.get().quality * 100));
  qualitySlider.setAttribute('aria-label', 'Output quality');
  qualitySlider.addEventListener('input', () => {
    store.update((current) => setOutputQuality(current, qualitySlider.valueAsNumber / 100));
  });
  qualityLabel.appendChild(qualitySlider);

  const qualityReadout = document.createElement('span');
  qualityReadout.className = 'kalotyp-output-quality-readout';
  qualityReadout.setAttribute('aria-hidden', 'true');
  qualityReadout.textContent = `${Math.round(store.get().quality * 100)}`;
  qualityLabel.appendChild(qualityReadout);

  const summary = document.createElement('p');
  summary.className = 'kalotyp-output-summary';
  summary.setAttribute('aria-live', 'polite');

  // Toggle stores intent; the encoder honours it only when source and output are both JPEG
  // (canvas re-encoding strips metadata otherwise). The hint below surfaces that constraint.
  const metadataRow = document.createElement('label');
  metadataRow.className = 'kalotyp-output-metadata-row';
  const metadataCheckbox = document.createElement('input');
  metadataCheckbox.type = 'checkbox';
  metadataCheckbox.className = 'kalotyp-output-metadata-checkbox';
  metadataCheckbox.checked = store.get().stripMetadata;
  metadataCheckbox.addEventListener('change', () => {
    store.update((current) => setStripMetadata(current, metadataCheckbox.checked));
  });
  const metadataText = document.createElement('span');
  metadataText.className = 'kalotyp-output-metadata-text';
  metadataText.textContent = 'Strip EXIF, GPS, and camera metadata on save';
  metadataRow.appendChild(metadataCheckbox);
  metadataRow.appendChild(metadataText);

  const metadataHint = document.createElement('p');
  metadataHint.className = 'kalotyp-output-metadata-hint';
  metadataHint.setAttribute('aria-live', 'polite');

  const footer = document.createElement('footer');
  footer.className = 'kalotyp-output-footer';

  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'kalotyp-output-done';
  doneButton.textContent = 'Done';
  doneButton.setAttribute('aria-label', 'Close output settings');
  doneButton.addEventListener('click', () => handle.close());

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'kalotyp-output-save';
  saveButton.textContent = 'Save and close';
  saveButton.addEventListener('click', () => {
    if (!options.canSave()) return;
    options.onSaveAndClose();
  });

  footer.appendChild(doneButton);
  footer.appendChild(saveButton);

  body.appendChild(formatLabel);
  body.appendChild(formatHint);
  body.appendChild(qualityLabel);
  body.appendChild(summary);
  body.appendChild(metadataRow);
  body.appendChild(metadataHint);
  body.appendChild(footer);

  anchor.setAttribute('aria-expanded', 'true');

  const handle = openNestedModal({
    host,
    anchor,
    title: 'Output settings',
    body,
    variant: 'kalotyp-output-popover',
    showCloseButton: true,
    onClose: () => {
      anchor.setAttribute('aria-expanded', 'false');
      unsubscribe();
      options.onClose();
    },
  });

  function renderState(state: OutputState): void {
    if (formatSelect.value !== state.mimeChoice) formatSelect.value = state.mimeChoice;
    const percent = Math.round(state.quality * 100);
    if (qualitySlider.valueAsNumber !== percent) qualitySlider.value = String(percent);
    qualityReadout.textContent = String(percent);
    const choice = FORMAT_CHOICES.find((c) => c.value === state.mimeChoice);
    formatHint.textContent = choice?.description ?? '';
    summary.textContent = describeSelection(state);
    // PNG ignores quality — visually disable the slider for that format.
    const qualityActive = state.mimeChoice !== 'image/png';
    qualitySlider.disabled = !qualityActive;
    qualityReadout.style.opacity = qualityActive ? '1' : '0.4';
    if (metadataCheckbox.checked !== state.stripMetadata) {
      metadataCheckbox.checked = state.stripMetadata;
    }
    metadataHint.textContent = describeMetadataHint(state);
    saveButton.disabled = !options.canSave();
  }

  renderState(store.get());
  const unsubscribe = store.subscribe(renderState);

  // 'auto' is always enabled because its resolver falls back to PNG internally.
  void (async () => {
    for (const choice of FORMAT_CHOICES) {
      if (choice.requires.length === 0) continue;
      const supported = (
        await Promise.all(choice.requires.map((mime) => canEncodeMime(mime)))
      ).every(Boolean);
      if (!supported) {
        const option = formatSelect.querySelector<HTMLOptionElement>(
          `option[value="${choice.value}"]`,
        );
        if (option) {
          option.disabled = true;
          option.textContent = `${choice.label} (unsupported)`;
        }
      }
    }
  })();

  return {
    close: () => handle.close(),
  };
}

function describeSelection(state: OutputState): string {
  if (state.mimeChoice === 'image/png') return 'PNG · lossless';
  const percent = Math.round(state.quality * 100);
  switch (state.mimeChoice) {
    case 'auto':
      return `Auto · ${percent}% quality`;
    case 'image/webp':
      return `WebP · ${percent}% quality`;
    case 'image/avif':
      return `AVIF · ${percent}% quality`;
    case 'image/jpeg':
      return `JPEG · ${percent}% quality`;
    default:
      return `${state.mimeChoice} · ${percent}% quality`;
  }
}

/** When strip is off, surface the JPEG→JPEG constraint so EXIF loss doesn't surprise the user. */
function describeMetadataHint(state: OutputState): string {
  if (state.stripMetadata) return '';
  if (state.mimeChoice === 'image/jpeg') {
    return 'EXIF preserved when the source is also JPEG.';
  }
  if (state.mimeChoice === 'auto') {
    return 'Metadata is preserved only when the resolved output is JPEG.';
  }
  return 'Metadata can only be preserved when the output is JPEG.';
}
