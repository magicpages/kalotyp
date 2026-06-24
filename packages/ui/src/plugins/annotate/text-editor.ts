/**
 * Inline text editor for the text annotation tool.
 *
 * The editor renders a contenteditable `<div>` overlaid on the
 * annotation's image-space anchor. Using a `<div>` instead of a
 * `<textarea>` lets us match the canvas-side font and size precisely
 * (textareas restrict the visible padding/size combination on some
 * browsers). The element auto-sizes to its content and grows with the
 * text the user types (line breaks via Shift+Enter).
 *
 * Lifecycle:
 *   - `open(shape, viewport)`: position the editor over the shape,
 *     prefill its text, focus it. Each input event reports the new
 *     text via `onInput`. Pressing Enter (without Shift) commits;
 *     pressing Escape cancels.
 *   - `close()`: hide the editor and blur it.
 *
 * The caller is responsible for committing the shape into the store
 * when the editor closes; the editor is presentational.
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
  const editor = document.createElement('div');
  editor.className = 'kalotyp-annotate-text-editor';
  editor.setAttribute('contenteditable', 'true');
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true');
  editor.setAttribute('aria-label', 'Annotation text');
  editor.spellcheck = false;
  editor.style.display = 'none';
  options.host.appendChild(editor);

  let activeShape: TextShape | null = null;

  const onInput = (): void => {
    options.onInput(editor.innerText);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // Enter without modifiers commits; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
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
   * Position the editor over the shape and match its font metrics. The editor's
   * OWN text is kept transparent — the visible glyphs are painted on the canvas
   * by the same `paintText` the bake uses, so what you edit is byte-identical to
   * what bakes and can never jump on commit. This element exists only to capture
   * keystrokes and show the caret; aligning a contenteditable's text layout to
   * canvas `textBaseline:'top'` pixel-for-pixel is font-metric-dependent and
   * unreliable, so we don't try — we just place the caret close.
   */
  function applyStyles(shape: TextShape, viewport: Viewport): void {
    // `shape.x, shape.y` is the block's top-left for every alignment (same as
    // the canvas).
    const left = viewport.displayRect.x + shape.x * viewport.scale;
    const top = viewport.displayRect.y + shape.y * viewport.scale;
    editor.style.left = `${left}px`;
    editor.style.top = `${top}px`;
    // Text is invisible (the canvas shows it); only the caret is coloured.
    editor.style.color = 'transparent';
    editor.style.caretColor = shape.color;
    // Same font/size/zoom as the canvas so the caret tracks the painted glyphs
    // horizontally (identical advances) and the line box matches vertically.
    editor.style.font = cssFontString(shape, viewport.scale);
    // The `font` shorthand resets `line-height` to `normal`; pin it to the
    // canvas line-height multiple so the caret height matches a painted line.
    editor.style.lineHeight = String(TEXT_LINE_HEIGHT);
    editor.style.textAlign = shape.textAlign;
    editor.style.transformOrigin = 'top left';
    // Auto-size to content; cap the width so a long line can't slide off-stage.
    editor.style.width = 'max-content';
    const maxWidth = Math.max(100, viewport.displayRect.x + viewport.displayRect.width - left - 8);
    editor.style.maxWidth = `${maxWidth}px`;
  }

  return {
    open(shape, viewport, source): void {
      activeShape = shape;
      editor.style.display = '';
      applyStyles(shape, viewport);
      editor.innerText = shape.text;
      // Defer focus so the layout pass settles before we move the
      // caret. Without this, Safari occasionally focuses but doesn't
      // place the caret.
      requestAnimationFrame(() => {
        editor.focus();
        // Place caret at end.
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
      // `source` is part of the API surface so the caller can pass it
      // through unconditionally; the position math doesn't need it
      // today but a future per-image-bound clamp would.
      void source;
    },
    restyle(shape, viewport): void {
      if (activeShape === null) return;
      activeShape = shape;
      // Restyle only — keep the text and the caret/selection untouched so the
      // user can keep typing after, say, picking a font.
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
