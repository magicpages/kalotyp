/**
 * Build the annotation panel: tool toolbar on the left, style
 * controls on the right. Mirrors the layout-rhythm conventions the
 * other Phase 2 panels (rotate, flip, resize) established — flat
 * row(s) of controls under `.kalotyp-util-main`.
 */

import {
  type AnnotateTool,
  isKeyboardPlaceableKind,
  type StylePalette,
  TEXT_FONTS,
  type TextAlign,
} from '@magicpages/kalotyp-core';
import { icon } from '../../icons.js';

export interface AnnotatePanelOptions {
  readonly initialTool: AnnotateTool;
  readonly initialStyle: StylePalette;
  readonly canDelete: boolean;
  /**
   * Where the per-selection coordinate-input row mounts. The mount layer owns the row's lifecycle and just
   * needs the panel to expose the slot so the inputs render in the
   * panel rhythm rather than as a free-floating bar.
   */
  readonly coordInputs: HTMLElement;
  onSelectTool(tool: AnnotateTool): void;
  onColorChange(color: string): void;
  onStrokeWidthChange(width: number): void;
  onFontFamilyChange(fontFamily: string): void;
  onFontSizeChange(fontSize: number): void;
  onToggleBold(): void;
  onToggleItalic(): void;
  onAlignChange(align: TextAlign): void;
  onDeleteSelected(): void;
  /**
   * Insert the active drawing tool's default shape at image centre
   * (Phase 6.3). The panel disables the button when the active tool
   * is `select`, `freehand`, or `highlight` — see
   * `isKeyboardPlaceableKind` in core.
   */
  onInsertAtCenter(): void;
}

export interface AnnotatePanel {
  readonly container: HTMLDivElement;
  readonly toolButtons: ReadonlyMap<AnnotateTool, HTMLButtonElement>;
  readonly hexInput: HTMLInputElement;
  readonly colorSwatches: ReadonlyArray<HTMLButtonElement>;
  readonly strokeRange: HTMLInputElement;
  readonly fontSelect: HTMLSelectElement;
  readonly fontSizeInput: HTMLInputElement;
  readonly boldButton: HTMLButtonElement;
  readonly italicButton: HTMLButtonElement;
  readonly alignButtons: ReadonlyMap<TextAlign, HTMLButtonElement>;
  readonly deleteButton: HTMLButtonElement;
  readonly insertButton: HTMLButtonElement;
  setActiveTool(tool: AnnotateTool): void;
  setStyle(style: StylePalette): void;
  setCanDelete(canDelete: boolean): void;
  /**
   * Show the per-mode controls for the active tool / selection. `text` reveals
   * the font/size/bold/italic/align row; `emoji` hides the colour + stroke
   * controls (an emoji carries its own colour). Stroke width hides for both.
   */
  setControlsMode(mode: { readonly text: boolean; readonly emoji: boolean }): void;
}

/**
 * Tool icons. Sourced from Lucide via the shared icons module so the
 * whole editor reads as one icon family (history controls, lock
 * toggle, annotation tools). The select cursor is filled to match
 * the conventional pointer-arrow visual; the others are stroked
 * outlines.
 */
const TOOL_DEFS: ReadonlyArray<{ id: AnnotateTool; label: string; icon: string }> = [
  {
    id: 'select',
    label: 'Select',
    icon: icon('select', { fill: 'currentColor', 'stroke-width': 1 }),
  },
  { id: 'text', label: 'Text', icon: icon('text') },
  { id: 'rect', label: 'Rectangle', icon: icon('rect') },
  { id: 'ellipse', label: 'Ellipse', icon: icon('ellipse') },
  { id: 'arrow', label: 'Arrow', icon: icon('arrow') },
  { id: 'freehand', label: 'Freehand', icon: icon('freehand') },
  { id: 'highlight', label: 'Highlight', icon: icon('highlight') },
  { id: 'emoji', label: 'Emoji', icon: icon('emoji') },
];

/**
 * Compact preset swatch palette. Six colours covering bright (red,
 * yellow, green, blue) plus white and black for outlines on either
 * background. The custom-colour `<input type="color">` lets the user
 * override; the swatches just save them a click for the common cases.
 */
const PRESET_COLORS: readonly string[] = [
  '#ff3b30',
  '#ffcc00',
  '#34c759',
  '#007aff',
  '#ffffff',
  '#000000',
];

/** Font-size bounds in image-space px; the single source for the input's
 *  min/max attributes and the typed-value validation (kept from drifting). */
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 400;

export function buildAnnotatePanel(options: AnnotatePanelOptions): AnnotatePanel {
  const container = document.createElement('div');
  container.className = 'kalotyp-annotate-panel';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Annotate');

  // ----- Tool toolbar -----
  const toolbar = document.createElement('div');
  toolbar.className = 'kalotyp-annotate-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Annotation tools');

  const toolButtons = new Map<AnnotateTool, HTMLButtonElement>();
  for (const def of TOOL_DEFS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-annotate-tool';
    button.dataset.tool = def.id;
    button.setAttribute('aria-label', def.label);
    button.title = def.label;
    button.setAttribute('aria-pressed', def.id === options.initialTool ? 'true' : 'false');
    // The icon string is inline SVG markup (from Lucide via the
    // shared icons module). Use innerHTML so the SVG actually
    // parses and renders — `textContent` would print the markup as
    // literal text inside the button.
    button.innerHTML = def.icon;
    button.addEventListener('click', () => options.onSelectTool(def.id));
    toolbar.appendChild(button);
    toolButtons.set(def.id, button);
  }

  // ----- Style controls (color + stroke) -----
  const styleRow = document.createElement('div');
  styleRow.className = 'kalotyp-annotate-style-row';

  const swatches: HTMLButtonElement[] = [];
  const swatchGroup = document.createElement('div');
  swatchGroup.className = 'kalotyp-annotate-swatches';
  swatchGroup.setAttribute('role', 'radiogroup');
  swatchGroup.setAttribute('aria-label', 'Color');
  for (const color of PRESET_COLORS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'kalotyp-annotate-swatch';
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-label', `Use color ${color}`);
    swatch.dataset.color = color;
    swatch.style.setProperty('--kalotyp-swatch', color);
    swatch.addEventListener('click', () => options.onColorChange(color));
    swatchGroup.appendChild(swatch);
    swatches.push(swatch);
  }

  // Single hex code input. The native `<input type="color">` was
  // dropped (Phase 6.6 polish) — it duplicated the swatches' role
  // and crowded the row. The hex input is the keyboard-accessible
  // path; swatches cover the common-colour quick-pick path. Power
  // users with a custom palette type the hex.
  let lastValidHex = normaliseColorForInput(options.initialStyle.color);
  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'kalotyp-annotate-hex';
  hexInput.value = lastValidHex;
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;
  hexInput.autocomplete = 'off';
  hexInput.setAttribute('aria-label', 'Color hex code');
  hexInput.setAttribute('placeholder', '#000000');
  hexInput.style.setProperty('--kalotyp-hex-swatch', lastValidHex);
  hexInput.addEventListener('change', () => {
    const value = hexInput.value.trim();
    const normalised = normaliseHexInput(value);
    if (normalised) {
      hexInput.value = normalised;
      lastValidHex = normalised;
      hexInput.style.setProperty('--kalotyp-hex-swatch', normalised);
      options.onColorChange(normalised);
    } else {
      // Restore to the last valid colour. The colour swatches and
      // state still reflect the last accepted value; the input
      // visibly resets so the user sees their bad input cleared.
      hexInput.value = lastValidHex;
    }
  });

  // Stroke "Width" control, wrapped so it can be hidden for text (text has no
  // stroke; its size is the font-size stepper in the text row).
  const strokeWrap = document.createElement('span');
  strokeWrap.className = 'kalotyp-annotate-stroke-wrap';

  const strokeLabel = document.createElement('label');
  strokeLabel.className = 'kalotyp-annotate-stroke-label';
  strokeLabel.textContent = 'Width';

  const strokeRange = document.createElement('input');
  strokeRange.type = 'range';
  strokeRange.className = 'kalotyp-annotate-stroke';
  strokeRange.min = '1';
  strokeRange.max = '40';
  strokeRange.step = '1';
  strokeRange.value = String(options.initialStyle.strokeWidth);
  strokeRange.setAttribute('aria-label', 'Stroke width');
  strokeRange.addEventListener('change', () =>
    options.onStrokeWidthChange(strokeRange.valueAsNumber),
  );
  strokeLabel.appendChild(strokeRange);
  strokeWrap.appendChild(strokeLabel);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'kalotyp-annotate-delete';
  deleteButton.innerHTML = `${icon('delete')}<span>Delete</span>`;
  deleteButton.setAttribute('aria-label', 'Delete selected annotation');
  deleteButton.title = 'Delete (Del)';
  deleteButton.disabled = !options.canDelete;
  deleteButton.addEventListener('click', () => options.onDeleteSelected());

  // Insert-at-centre button. The keyboard-only
  // path for placing a shape: pick a tool, press this, get a default
  // shape at image centre, then position via the coordinate inputs.
  // Pointer users can ignore it — the canvas drag still works for
  // them. The button is disabled for tools that can't be placed
  // without a path (freehand, highlight) and for `select`.
  const insertButton = document.createElement('button');
  insertButton.type = 'button';
  insertButton.className = 'kalotyp-annotate-insert';
  insertButton.innerHTML = `${icon('plus')}<span>Insert at centre</span>`;
  insertButton.setAttribute('aria-label', 'Insert annotation at image centre');
  insertButton.title = 'Insert at centre';
  insertButton.disabled = !canInsertForTool(options.initialTool);
  insertButton.addEventListener('click', () => options.onInsertAtCenter());

  styleRow.appendChild(swatchGroup);
  styleRow.appendChild(hexInput);
  styleRow.appendChild(strokeWrap);
  styleRow.appendChild(insertButton);
  styleRow.appendChild(deleteButton);

  // ----- Text controls (font family / size / bold / italic / align) -----
  const textRow = document.createElement('div');
  textRow.className = 'kalotyp-annotate-text-row';
  textRow.style.display = 'none';

  const fontSelect = document.createElement('select');
  fontSelect.className = 'kalotyp-annotate-font';
  fontSelect.setAttribute('aria-label', 'Font');
  for (const font of TEXT_FONTS) {
    const option = document.createElement('option');
    option.value = font.key;
    option.textContent = font.label;
    fontSelect.appendChild(option);
  }
  fontSelect.value = options.initialStyle.fontFamily;
  fontSelect.addEventListener('change', () => options.onFontFamilyChange(fontSelect.value));

  // Last accepted font size, used to revert invalid typed input. Kept in sync
  // by `setStyle` so a typo restores the *current* size, not the palette default.
  let lastValidFontSize = options.initialStyle.fontSize;
  const fontSizeInput = document.createElement('input');
  fontSizeInput.type = 'number';
  fontSizeInput.className = 'kalotyp-annotate-font-size';
  fontSizeInput.min = String(FONT_SIZE_MIN);
  fontSizeInput.max = String(FONT_SIZE_MAX);
  fontSizeInput.step = '1';
  fontSizeInput.value = String(options.initialStyle.fontSize);
  fontSizeInput.setAttribute('aria-label', 'Font size');
  fontSizeInput.addEventListener('change', () => {
    const value = Math.round(fontSizeInput.valueAsNumber);
    // Enforce both bounds (the min/max attributes only constrain the spinner
    // arrows, not typed input); revert out-of-range entries to the last valid.
    if (Number.isFinite(value) && value >= FONT_SIZE_MIN && value <= FONT_SIZE_MAX) {
      lastValidFontSize = value;
      options.onFontSizeChange(value);
    } else {
      fontSizeInput.value = String(lastValidFontSize);
    }
  });

  const boldButton = document.createElement('button');
  boldButton.type = 'button';
  boldButton.className = 'kalotyp-annotate-text-toggle';
  boldButton.innerHTML = icon('bold');
  boldButton.setAttribute('aria-label', 'Bold');
  boldButton.title = 'Bold';
  boldButton.setAttribute(
    'aria-pressed',
    options.initialStyle.fontWeight === 'bold' ? 'true' : 'false',
  );
  boldButton.addEventListener('click', () => options.onToggleBold());

  const italicButton = document.createElement('button');
  italicButton.type = 'button';
  italicButton.className = 'kalotyp-annotate-text-toggle';
  italicButton.innerHTML = icon('italic');
  italicButton.setAttribute('aria-label', 'Italic');
  italicButton.title = 'Italic';
  italicButton.setAttribute(
    'aria-pressed',
    options.initialStyle.fontStyle === 'italic' ? 'true' : 'false',
  );
  italicButton.addEventListener('click', () => options.onToggleItalic());

  const alignGroup = document.createElement('div');
  alignGroup.className = 'kalotyp-annotate-align';
  alignGroup.setAttribute('role', 'radiogroup');
  alignGroup.setAttribute('aria-label', 'Text alignment');
  const alignButtons = new Map<TextAlign, HTMLButtonElement>();
  const ALIGN_DEFS: ReadonlyArray<{ id: TextAlign; label: string; icon: string }> = [
    { id: 'left', label: 'Align left', icon: icon('alignLeft') },
    { id: 'center', label: 'Align center', icon: icon('alignCenter') },
    { id: 'right', label: 'Align right', icon: icon('alignRight') },
  ];
  for (const def of ALIGN_DEFS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-annotate-align-button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', def.label);
    button.title = def.label;
    button.innerHTML = def.icon;
    button.setAttribute(
      'aria-checked',
      def.id === options.initialStyle.textAlign ? 'true' : 'false',
    );
    button.addEventListener('click', () => options.onAlignChange(def.id));
    alignGroup.appendChild(button);
    alignButtons.set(def.id, button);
  }

  textRow.appendChild(fontSelect);
  textRow.appendChild(fontSizeInput);
  textRow.appendChild(boldButton);
  textRow.appendChild(italicButton);
  textRow.appendChild(alignGroup);

  container.appendChild(toolbar);
  container.appendChild(styleRow);
  container.appendChild(textRow);
  // Coordinate-input slot. The mount layer
  // appends the inputs into this slot after constructing the panel,
  // so the panel doesn't need to know per-shape geometry. The slot
  // sits below the style row inside the panel container so a
  // keyboard user finds it via natural Tab order.
  container.appendChild(options.coordInputs);

  function setActiveTool(tool: AnnotateTool): void {
    for (const [id, button] of toolButtons) {
      button.setAttribute('aria-pressed', id === tool ? 'true' : 'false');
    }
    insertButton.disabled = !canInsertForTool(tool);
  }

  function setStyle(style: StylePalette): void {
    const targetColor = normaliseColorForInput(style.color);
    if (hexInput.value.toLowerCase() !== targetColor.toLowerCase()) hexInput.value = targetColor;
    lastValidHex = targetColor;
    hexInput.style.setProperty('--kalotyp-hex-swatch', targetColor);
    if (strokeRange.valueAsNumber !== style.strokeWidth) {
      strokeRange.value = String(style.strokeWidth);
    }
    for (const swatch of swatches) {
      const matches = swatch.dataset.color?.toLowerCase() === style.color.toLowerCase();
      swatch.setAttribute('aria-checked', matches ? 'true' : 'false');
    }
    // Text controls reflect the same palette (current style for new shapes, or
    // the selected text shape's attributes, both threaded through here).
    if (fontSelect.value !== style.fontFamily) fontSelect.value = style.fontFamily;
    lastValidFontSize = style.fontSize;
    if (Math.round(fontSizeInput.valueAsNumber) !== style.fontSize) {
      fontSizeInput.value = String(style.fontSize);
    }
    boldButton.setAttribute('aria-pressed', style.fontWeight === 'bold' ? 'true' : 'false');
    italicButton.setAttribute('aria-pressed', style.fontStyle === 'italic' ? 'true' : 'false');
    for (const [id, button] of alignButtons) {
      button.setAttribute('aria-checked', id === style.textAlign ? 'true' : 'false');
    }
  }

  function setCanDelete(canDelete: boolean): void {
    deleteButton.disabled = !canDelete;
  }

  function setControlsMode(mode: { readonly text: boolean; readonly emoji: boolean }): void {
    textRow.style.display = mode.text ? '' : 'none';
    // An emoji sticker carries its own colour, so the colour controls don't
    // apply — hide the swatches + hex input while emoji is in play.
    swatchGroup.style.display = mode.emoji ? 'none' : '';
    hexInput.style.display = mode.emoji ? 'none' : '';
    // Stroke width is meaningless for both text (font-size drives it) and emoji;
    // swap it out so the relevant row owns sizing.
    strokeWrap.style.display = mode.text || mode.emoji ? 'none' : '';
  }

  setStyle(options.initialStyle);

  return {
    container,
    toolButtons,
    hexInput,
    colorSwatches: swatches,
    strokeRange,
    fontSelect,
    fontSizeInput,
    boldButton,
    italicButton,
    alignButtons,
    deleteButton,
    insertButton,
    setActiveTool,
    setStyle,
    setCanDelete,
    setControlsMode,
  };
}

/**
 * Whether the active tool exposes a default-at-centre keyboard
 * placement path. The toolbar's `select` button isn't a drawing
 * tool, and `freehand` / `highlight` are gestural — neither has a
 * meaningful "default shape" to place., Phase 6.3.
 */
function canInsertForTool(tool: AnnotateTool): boolean {
  if (tool === 'select') return false;
  return isKeyboardPlaceableKind(tool);
}

/**
 * `<input type="color">` only accepts `#rrggbb`. Our default palette
 * stores colours in the same form, but state writes from elsewhere
 * (e.g. the highlight default) might use rgba — those just leave the
 * native picker showing the previous valid colour, which is fine.
 */
function normaliseColorForInput(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    // Expand short hex to full hex so the input accepts it.
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

/**
 * Accept hex codes the user types into the keyboard-accessible
 * colour input. Tolerant of upper/lower case and
 * missing `#` prefix; returns the canonical `#rrggbb` form for
 * accepted input or `null` if the input isn't a valid hex code.
 */
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
