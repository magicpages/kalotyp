/**
 * Build the redact panel: mode toggle, optional colour picker, the
 * per-selection coordinate inputs row, and Insert/Delete actions.
 *
 * Same panel-rhythm conventions as the annotate plugin (Phase 6.3) —
 * a toolbar of mode buttons, then a style row with colour + Insert +
 * Delete, then a slot for the coordinate inputs row mounted by the
 * mount layer.
 */

import type { RedactMode } from '@magicpages/kalotyp-core';
import { icon } from '../../icons.js';

export interface RedactPanelOptions {
  readonly initialMode: RedactMode;
  readonly initialColor: string;
  readonly canDelete: boolean;
  /** Where the per-selection coordinate-input row mounts. */
  readonly coordInputs: HTMLElement;
  onSelectMode(mode: RedactMode): void;
  onColorChange(color: string): void;
  onDeleteSelected(): void;
  onInsertAtCenter(): void;
}

export interface RedactPanel {
  readonly container: HTMLDivElement;
  readonly modeButtons: ReadonlyMap<RedactMode, HTMLButtonElement>;
  readonly colorInput: HTMLInputElement;
  readonly hexInput: HTMLInputElement;
  readonly insertButton: HTMLButtonElement;
  readonly deleteButton: HTMLButtonElement;
  setActiveMode(mode: RedactMode): void;
  setColor(color: string): void;
  setCanDelete(canDelete: boolean): void;
}

const MODE_DEFS: ReadonlyArray<{ id: RedactMode; label: string }> = [
  { id: 'pixelate', label: 'Pixelate' },
  { id: 'blur', label: 'Blur' },
  { id: 'solid', label: 'Solid fill' },
];

export function buildRedactPanel(options: RedactPanelOptions): RedactPanel {
  const container = document.createElement('div');
  container.className = 'kalotyp-redact-panel';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Redact');

  // ----- Mode toolbar -----
  const toolbar = document.createElement('div');
  toolbar.className = 'kalotyp-redact-toolbar';
  toolbar.setAttribute('role', 'radiogroup');
  toolbar.setAttribute('aria-label', 'Redaction mode');

  const modeButtons = new Map<RedactMode, HTMLButtonElement>();
  for (const def of MODE_DEFS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-redact-mode';
    button.dataset.mode = def.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', def.id === options.initialMode ? 'true' : 'false');
    button.setAttribute('aria-label', `${def.label} redaction`);
    button.title = def.label;
    button.textContent = def.label;
    button.addEventListener('click', () => options.onSelectMode(def.id));
    toolbar.appendChild(button);
    modeButtons.set(def.id, button);
  }

  // ----- Style row -----
  const styleRow = document.createElement('div');
  styleRow.className = 'kalotyp-redact-style-row';

  // Colour picker for the `solid` mode. We always render the controls
  // and disable them when the mode isn't `solid`, instead of hiding,
  // so the panel layout doesn't reflow as the user switches modes.
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'kalotyp-redact-color';
  colorInput.value = normaliseColorForInput(options.initialColor);
  colorInput.setAttribute('aria-label', 'Solid fill colour (visual picker)');
  colorInput.addEventListener('change', () => options.onColorChange(colorInput.value));

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'kalotyp-redact-hex';
  hexInput.value = normaliseColorForInput(options.initialColor);
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;
  hexInput.autocomplete = 'off';
  hexInput.setAttribute('aria-label', 'Solid fill hex code');
  hexInput.setAttribute('placeholder', '#000000');
  hexInput.addEventListener('change', () => {
    const value = hexInput.value.trim();
    const normalised = normaliseHexInput(value);
    if (normalised) {
      hexInput.value = normalised;
      options.onColorChange(normalised);
    } else {
      hexInput.value = colorInput.value;
    }
  });

  const insertButton = document.createElement('button');
  insertButton.type = 'button';
  insertButton.className = 'kalotyp-redact-insert';
  insertButton.innerHTML = `${icon('plus')}<span>Insert at centre</span>`;
  insertButton.setAttribute('aria-label', 'Insert redaction region at image centre');
  insertButton.title = 'Insert at centre';
  insertButton.addEventListener('click', () => options.onInsertAtCenter());

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'kalotyp-redact-delete';
  deleteButton.innerHTML = `${icon('delete')}<span>Delete</span>`;
  deleteButton.setAttribute('aria-label', 'Delete selected redaction region');
  deleteButton.title = 'Delete (Del)';
  deleteButton.disabled = !options.canDelete;
  deleteButton.addEventListener('click', () => options.onDeleteSelected());

  // Group colour controls so they wrap together as a unit (Phase 6.6
  // mobile-layout fix: previously the row could split with the hint
  // floating alone). The Insert/Delete pair is its own group so they
  // also stay together.
  const colorGroup = document.createElement('div');
  colorGroup.className = 'kalotyp-redact-color-group';
  colorGroup.appendChild(colorInput);
  colorGroup.appendChild(hexInput);

  // Helper text that explains why the colour controls are disabled
  // outside Solid fill mode. Hidden when the mode is `solid` (the
  // controls are usable). `aria-live` so screen-reader users hear
  // the explanation when they switch modes.
  const colorHint = document.createElement('span');
  colorHint.className = 'kalotyp-redact-color-hint';
  colorHint.textContent = 'Colour applies to Solid fill only.';
  colorHint.setAttribute('aria-live', 'polite');

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'kalotyp-redact-button-group';
  buttonGroup.appendChild(insertButton);
  buttonGroup.appendChild(deleteButton);

  styleRow.appendChild(colorGroup);
  styleRow.appendChild(colorHint);
  styleRow.appendChild(buttonGroup);

  container.appendChild(toolbar);
  container.appendChild(styleRow);
  container.appendChild(options.coordInputs);

  function setActiveMode(mode: RedactMode): void {
    for (const [id, button] of modeButtons) {
      button.setAttribute('aria-checked', id === mode ? 'true' : 'false');
      button.classList.toggle('kalotyp-redact-mode--active', id === mode);
    }
    const isSolid = mode === 'solid';
    colorInput.disabled = !isSolid;
    hexInput.disabled = !isSolid;
    colorHint.hidden = isSolid;
  }

  function setColor(color: string): void {
    const target = normaliseColorForInput(color);
    if (colorInput.value !== target) colorInput.value = target;
    if (hexInput.value.toLowerCase() !== target.toLowerCase()) hexInput.value = target;
  }

  function setCanDelete(canDelete: boolean): void {
    deleteButton.disabled = !canDelete;
  }

  setActiveMode(options.initialMode);

  return {
    container,
    modeButtons,
    colorInput,
    hexInput,
    insertButton,
    deleteButton,
    setActiveMode,
    setColor,
    setCanDelete,
  };
}

function normaliseColorForInput(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

function normaliseHexInput(value: string): string | null {
  const cleaned = value.startsWith('#') ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[0];
    const g = cleaned[1];
    const b = cleaned[2];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}
