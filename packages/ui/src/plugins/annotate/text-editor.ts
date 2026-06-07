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
  close(): void;
  destroy(): void;
}

export function buildTextEditor(options: TextEditorOptions): TextEditorHandle {
  const editor = document.createElement('div');
  editor.className = 'kalotyp-annotate-text-editor';
  editor.setAttribute('contenteditable', 'true');
  editor.setAttribute('role', 'textbox');
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

  // Click outside the editor element commits the edit. Listening on
  // the host (the text-overlay div) means anywhere outside the editor
  // bubble closes it; we filter clicks on the editor itself to let
  // them pass through normally.
  const onPointerDownOutside = (event: PointerEvent): void => {
    if (activeShape === null) return;
    if (editor.contains(event.target as Node)) return;
    options.onCommit();
  };

  editor.addEventListener('input', onInput);
  editor.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onPointerDownOutside, true);

  return {
    open(shape, viewport, source): void {
      activeShape = shape;
      // Position in stage CSS pixels: image origin + image-space
      // anchor scaled by viewport.
      const left = viewport.displayRect.x + shape.x * viewport.scale;
      const top = viewport.displayRect.y + shape.y * viewport.scale;
      editor.style.display = '';
      editor.style.left = `${left}px`;
      editor.style.top = `${top}px`;
      editor.style.color = shape.color;
      // Match the canvas font exactly (family/weight/style/size), scaled to
      // the current zoom, so the editor is WYSIWYG with the baked output.
      editor.style.font = cssFontString(shape, viewport.scale);
      editor.style.textAlign = shape.textAlign;
      // Anchor the editor's growth to the shape's anchor for the current
      // alignment, so typing extends the text in the same direction the
      // canvas would render it.
      editor.style.transformOrigin = transformOriginFor(shape.textAlign);
      // Auto-size to content (no wrap box). Cap the width so a long line can't
      // slide off the stage; the editor grows rightward/down as the user types.
      editor.style.width = 'max-content';
      const maxWidth = Math.max(
        100,
        viewport.displayRect.x + viewport.displayRect.width - left - 8,
      );
      editor.style.maxWidth = `${maxWidth}px`;
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

function transformOriginFor(align: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'left':
      return 'top left';
    case 'center':
      return 'top center';
    case 'right':
      return 'top right';
  }
}
