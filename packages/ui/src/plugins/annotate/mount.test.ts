/**
 * Mount-level regression: a pointer interaction on the stage blurs a focused
 * coordinate input.
 *
 * The coordinate inputs (X / Y / Size / Angle) keep focus after a value is
 * committed with Enter. Without this blur, a subsequent drag-resize on the
 * canvas left the Size field frozen at its typed value (the store-driven sync
 * deliberately skips a *focused* input to avoid clobbering mid-typing), and
 * Delete/Backspace edited the number field instead of removing the shape. A
 * stage pointerdown now blurs the field so it syncs live and Delete targets the
 * shape again.
 */

import {
  type AnnotateState,
  addShape,
  createStore,
  type EmojiShape,
  initialAnnotateState,
  type SourceImage,
  selectShape,
} from '@magicpages/kalotyp-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountAnnotateUtility } from './mount.js';

// jsdom lacks ResizeObserver and pointer-capture; stub both (mirrors the crop
// plugin's mount tests).
class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver ??=
  StubResizeObserver;

const proto = HTMLElement.prototype as unknown as Record<string, () => void>;
if (typeof proto.setPointerCapture !== 'function') {
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
}

const SOURCE = {
  width: 1200,
  height: 800,
  bitmap: undefined as unknown as CanvasImageSource,
  mimeType: 'image/png',
} as unknown as SourceImage;

const EMOJI: EmojiShape = {
  id: 'e1',
  kind: 'emoji',
  x: 520,
  y: 320,
  size: 160,
  emoji: '😀',
  rotation: 0,
};

describe('annotate mount — coordinate inputs release focus on a stage gesture', () => {
  let stageHost: HTMLElement;
  let utilHost: HTMLElement;

  beforeEach(() => {
    stageHost = document.createElement('div');
    utilHost = document.createElement('div');
    document.body.append(stageHost, utilHost);
  });

  afterEach(() => {
    stageHost.remove();
    utilHost.remove();
  });

  it('blurs a focused Size input when a pointerdown reaches the stage', () => {
    // Start with the emoji present but *unselected* (addShape auto-selects, so
    // deselect first) — then selecting it after mount is a real change that
    // fires the store subscription, which is what fills the coordinate row.
    const store = createStore<AnnotateState>(
      selectShape(
        addShape(initialAnnotateState({ imageSize: { width: 1200, height: 800 } }), EMOJI),
        null,
      ),
    );
    const handle = mountAnnotateUtility({ stageHost, utilHost, source: SOURCE, store });
    store.update((current) => selectShape(current, EMOJI.id));

    const sizeInput = utilHost.querySelector<HTMLInputElement>(
      '.kalotyp-annotate-coords-input[data-field="size"]',
    );
    expect(sizeInput).toBeTruthy();
    if (!sizeInput) return;

    sizeInput.focus();
    expect(document.activeElement).toBe(sizeInput);

    // Any canvas gesture starts with a pointerdown that reaches the stage
    // container (where the capture-phase blur listener lives). Dispatching
    // directly on the container isolates that listener from tool/selection
    // side effects. jsdom's PointerEvent is partial, so a MouseEvent named
    // `pointerdown` is enough for the handler.
    const stage = stageHost.querySelector<HTMLElement>('.kalotyp-annotate-stage');
    expect(stage).toBeTruthy();
    stage?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(document.activeElement).not.toBe(sizeInput);

    handle.destroy();
  });
});
