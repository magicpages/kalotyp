/**
 * Inline text editor for the text annotation tool.
 *
 * Renders a transparent `<textarea>` overlaid on the annotation's image-space
 * anchor. A textarea (rather than a contenteditable `<div>`) is used because it
 * round-trips multi-line text — including empty and trailing lines — as a clean
 * `\n` string via `.value`, with correct caret placement on every line. A
 * contenteditable instead builds `<div>`/`<br>` blocks whose `innerText`
 * mis-counts empty lines, drifting the caret from the canvas (which splits the
 * text on `\n`).
 *
 * The textarea's own text is transparent — the visible glyphs are painted on the
 * canvas by the same `paintText` the bake uses, so what you edit is
 * byte-identical to what bakes and can never jump on commit. The element exists
 * only to capture keystrokes and show the caret.
 *
 * Lifecycle:
 *   - `open(shape, viewport)`: position over the shape, prefill, focus, caret at
 *     end. Each input reports `.value` via `onInput`. Enter inserts a newline
 *     (native); Cmd/Ctrl+Enter (or a click outside) commits; Escape cancels.
 *   - `close()`: hide the editor and blur it.
 *
 * The caller commits the shape into the store when the editor closes; the editor
 * is presentational.
 */

import {
  cssFontString,
  type SourceImage,
  TEXT_LINE_HEIGHT,
  type TextShape,
  type Viewport,
} from '@magicpages/kalotyp-core';

export interface TextEditorOptions {
  readonly host: HTMLDivElement;
  onInput(text: string): void;
  onCommit(): void;
  onCancel(): void;
}

export interface TextEditorHandle {
  open(shape: TextShape, viewport: Viewport, source: SourceImage): void;
  /** Re-apply font/colour/alignment/position to the open editor without
   *  resetting its text or moving the caret (used when panel controls
   *  restyle the text mid-edit). */
  restyle(shape: TextShape, viewport: Viewport): void;
  close(): void;
  destroy(): void;
}

export function buildTextEditor(options: TextEditorOptions): TextEditorHandle {
  const editor = document.createElement('textarea');
  editor.className = 'kalotyp-annotate-text-editor';
  editor.setAttribute('aria-label', 'Annotation text');
  // No soft-wrapping: lines break only on explicit `\n`, matching the canvas
  // (which never wraps). This also makes `scrollWidth` the widest line's width.
  editor.setAttribute('wrap', 'off');
  editor.setAttribute('autocomplete', 'off');
  editor.setAttribute('autocapitalize', 'off');
  editor.setAttribute('autocorrect', 'off');
  editor.spellcheck = false;
  editor.style.display = 'none';
  options.host.appendChild(editor);

  let activeShape: TextShape | null = null;
  // Cap so a long line can't slide off-stage; set from the viewport in applyStyles.
  let maxWidthPx = Number.POSITIVE_INFINITY;

  /**
   * Grow the textarea to fit its content exactly, so it never scrolls
   * internally — an internal scroll would offset the caret from the painted
   * lines. Height = line count × line-height; width = widest line (with `wrap`
   * off, that's `scrollWidth`), so center/right alignment matches the canvas's
   * block (whose width is also the widest line).
   */
  const autosize = (): void => {
    editor.style.height = '0px';
    editor.style.width = '0px';
    editor.style.height = `${editor.scrollHeight}px`;
    // +2px so the caret at a line's end isn't clipped; cap to the stage.
    editor.style.width = `${Math.min(editor.scrollWidth + 2, maxWidthPx)}px`;
  };

  const onInput = (): void => {
    autosize();
    options.onInput(editor.value);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      // Cmd/Ctrl+Enter commits; a plain Enter falls through to the textarea's
      // native newline insertion.
      event.preventDefault();
      event.stopPropagation();
      options.onCommit();
      return;
    }
    if (event.key === 'Escape') {
      // Stop propagation so the editor-level Esc-to-close handler
      // doesn't fire while the user is actively editing text.
      event.preventDefault();
      event.stopPropagation();
      options.onCancel();
    }
  };

  // Click outside the editor commits the edit — but NOT clicks on the
  // annotation panel. The font picker, size stepper, bold/italic and
  // alignment controls are part of the editing session; touching them must
  // restyle the live text, not commit and close the editor. Only clicks
  // elsewhere (the canvas, the page) commit.
  const onPointerDownOutside = (event: PointerEvent): void => {
    if (activeShape === null) return;
    // `event.target` can be a non-Element (e.g. a text node); narrow first so
    // `contains`/`closest` are always safe to call.
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (editor.contains(target)) return;
    if (target.closest('.kalotyp-annotate-panel')) return;
    options.onCommit();
  };

  editor.addEventListener('input', onInput);
  editor.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onPointerDownOutside, true);

  /**
   * Position the editor over the shape and match its font metrics so the caret
   * tracks the painted glyphs (same font/size/zoom + line-height). `shape.x,
   * shape.y` is the block's top-left for every alignment, same as the canvas.
   */
  function applyStyles(shape: TextShape, viewport: Viewport): void {
    const left = viewport.displayRect.x + shape.x * viewport.scale;
    const top = viewport.displayRect.y + shape.y * viewport.scale;
    editor.style.left = `${left}px`;
    editor.style.top = `${top}px`;
    // Text is invisible (the canvas shows it); only the caret is coloured.
    editor.style.color = 'transparent';
    editor.style.caretColor = shape.color;
    editor.style.font = cssFontString(shape, viewport.scale);
    // The `font` shorthand resets `line-height` to `normal`; pin it to the
    // canvas line-height multiple so the caret height matches a painted line.
    editor.style.lineHeight = String(TEXT_LINE_HEIGHT);
    editor.style.textAlign = shape.textAlign;
    editor.style.transformOrigin = 'top left';
    maxWidthPx = Math.max(40, viewport.displayRect.x + viewport.displayRect.width - left - 8);
    autosize();
  }

  return {
    open(shape, viewport, source): void {
      activeShape = shape;
      editor.style.display = '';
      editor.value = shape.text;
      applyStyles(shape, viewport);
      // Defer focus so the layout pass settles first. Without this, Safari
      // occasionally focuses but doesn't place the caret.
      requestAnimationFrame(() => {
        editor.focus();
        const end = editor.value.length;
        editor.setSelectionRange(end, end);
      });
      // `source` is part of the API surface so the caller can pass it through
      // unconditionally; the position math doesn't need it today but a future
      // per-image-bound clamp would.
      void source;
    },
    restyle(shape, viewport): void {
      if (activeShape === null) return;
      activeShape = shape;
      // Restyle only — the textarea keeps its value and selection across style
      // changes, so the user can keep typing after, say, picking a font.
      applyStyles(shape, viewport);
    },
    close(): void {
      activeShape = null;
      editor.style.display = 'none';
      editor.blur();
    },
    destroy(): void {
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      editor.remove();
    },
  };
}
