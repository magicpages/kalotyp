/* @vitest-environment jsdom */
import type { SourceImage, TextShape, Viewport } from '@magicpages/kalotyp-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTextEditor } from './text-editor.js';

const SHAPE: TextShape = {
  id: 't',
  kind: 'text',
  x: 10,
  y: 20,
  text: 'hi',
  fontSize: 32,
  color: '#000',
  textAlign: 'left',
  fontFamily: 'system',
  fontWeight: 'normal',
  fontStyle: 'normal',
};

const VIEWPORT: Viewport = {
  displayRect: { x: 0, y: 0, width: 800, height: 600 },
  scale: 1,
} as Viewport;

const SOURCE = { width: 800, height: 600 } as SourceImage;

afterEach(() => {
  document.body.replaceChildren();
});

describe('text editor — outside-click commit filtering', () => {
  it('commits when a pointerdown lands on the canvas (outside the editor and panel)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onCommit = vi.fn();
    const editor = buildTextEditor({ host, onInput: () => {}, onCommit, onCancel: () => {} });
    editor.open(SHAPE, VIEWPORT, SOURCE);

    const elsewhere = document.createElement('div');
    document.body.appendChild(elsewhere);
    elsewhere.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    editor.destroy();
  });

  it('does NOT commit when a pointerdown lands on the annotate panel', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    // A stand-in for the panel: the editor must treat clicks inside it as part
    // of the editing session (e.g. picking a font), not a commit.
    const panel = document.createElement('div');
    panel.className = 'kalotyp-annotate-panel';
    const fontSelect = document.createElement('select');
    panel.appendChild(fontSelect);
    document.body.appendChild(panel);

    const onCommit = vi.fn();
    const editor = buildTextEditor({ host, onInput: () => {}, onCommit, onCancel: () => {} });
    editor.open(SHAPE, VIEWPORT, SOURCE);

    fontSelect.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(onCommit).not.toHaveBeenCalled();
    editor.destroy();
  });
});

describe('text editor — Enter inserts a newline, Cmd/Ctrl+Enter commits', () => {
  function open(onCommit: () => void) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = buildTextEditor({ host, onInput: () => {}, onCommit, onCancel: () => {} });
    editor.open(SHAPE, VIEWPORT, SOURCE);
    // `open()` has appended the editor element; cast the `Element | null` from
    // querySelector to the concrete element the tests dispatch events on.
    const el = host.querySelector('.kalotyp-annotate-text-editor') as HTMLElement;
    return { editor, el };
  }
  const key = (init: KeyboardEventInit) =>
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });

  it('does not commit on a plain Enter (it should add a line break)', () => {
    const onCommit = vi.fn();
    const { editor, el } = open(onCommit);
    el.dispatchEvent(key({}));
    expect(onCommit).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('commits on Cmd+Enter and Ctrl+Enter', () => {
    const onCommit = vi.fn();
    const { editor, el } = open(onCommit);
    el.dispatchEvent(key({ metaKey: true }));
    el.dispatchEvent(key({ ctrlKey: true }));
    expect(onCommit).toHaveBeenCalledTimes(2);
    editor.destroy();
  });
});

describe('text editor — multi-line round-trip (textarea)', () => {
  it('is a textarea whose value round-trips newlines and empty lines exactly', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const seen: string[] = [];
    const editor = buildTextEditor({
      host,
      onInput: (t) => seen.push(t),
      onCommit: () => {},
      onCancel: () => {},
    });
    editor.open(SHAPE, VIEWPORT, SOURCE);
    // The editor renders a <textarea>; cast to read `.value` / `.tagName`
    // (asserted below).
    const el = host.querySelector('.kalotyp-annotate-text-editor') as HTMLTextAreaElement;
    // A textarea, not a contenteditable — block elements would make `innerText`
    // over-count empty lines and drift the caret from the canvas.
    expect(el.tagName).toBe('TEXTAREA');
    // Empty middle lines survive verbatim (the bug was a phantom extra line).
    el.value = 'test\ntest\n\nend';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen.at(-1)).toBe('test\ntest\n\nend');
    editor.destroy();
  });
});

describe('text editor — positioning (transparent input over the canvas)', () => {
  function openAt(shape: TextShape, viewport: Viewport) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = buildTextEditor({
      host,
      onInput: () => {},
      onCommit: () => {},
      onCancel: () => {},
    });
    editor.open(shape, viewport, SOURCE);
    const el = host.querySelector('.kalotyp-annotate-text-editor') as HTMLElement;
    return { editor, el };
  }

  it('positions the top-left edge at the anchor for every alignment', () => {
    for (const textAlign of ['left', 'center', 'right'] as const) {
      const { editor, el } = openAt({ ...SHAPE, x: 100, y: 200, textAlign }, VIEWPORT);
      // displayRect (0,0) + (x,y) * scale (1). No half-leading games: the
      // overlay is transparent and the canvas paints the visible glyphs.
      expect(el.style.left).toBe('100px');
      expect(el.style.top).toBe('200px');
      expect(el.style.textAlign).toBe(textAlign);
      expect(el.style.transformOrigin).toBe('top left');
      editor.destroy();
    }
  });

  it('keeps its own text transparent and the caret in the shape colour', () => {
    const { editor, el } = openAt({ ...SHAPE, color: '#ff0000' }, VIEWPORT);
    expect(el.style.color).toBe('transparent');
    expect(el.style.caretColor).toBe('rgb(255, 0, 0)');
    editor.destroy();
  });

  it('scales position by the viewport zoom', () => {
    const zoomed: Viewport = {
      displayRect: { x: 30, y: 50, width: 800, height: 600 },
      scale: 2,
    } as Viewport;
    const { editor, el } = openAt({ ...SHAPE, x: 100, y: 200, fontSize: 40 }, zoomed);
    // left = 30 + 100*2 = 230; top = 50 + 200*2 = 450.
    expect(el.style.left).toBe('230px');
    expect(el.style.top).toBe('450px');
    editor.destroy();
  });
});
