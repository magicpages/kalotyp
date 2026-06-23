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
