import {
  type AnnotateState,
  createStore,
  initialAnnotateState,
  type Shape,
  type Store,
} from '@magicpages/kalotyp-core';
import { describe, expect, it } from 'vitest';
import { startEmojiGesture, type ToolGestureContext } from './tools.js';

function harness() {
  const store: Store<AnnotateState> = createStore(
    initialAnnotateState({ imageSize: { width: 1000, height: 800 } }),
  );
  const live: Array<Shape | null> = [];
  let commits = 0;
  const ctx: ToolGestureContext = {
    store,
    // Identity projection keeps the assertions about coordinates simple.
    toImageSpace: (p) => ({ x: p.clientX, y: p.clientY }),
    setLiveShape: (shape) => live.push(shape),
    commit: () => {
      commits += 1;
    },
  };
  return { store, ctx, live, getCommits: () => commits };
}

const pointer = (clientX: number, clientY: number) =>
  ({ clientX, clientY }) as unknown as PointerEvent;

const dragPoint = (clientX: number, clientY: number) => ({ clientX, clientY, shiftKey: false });

describe('startEmojiGesture', () => {
  it('places the armed emoji centred on a tap and selects it', () => {
    const { store, ctx, getCommits } = harness();
    const handlers = startEmojiGesture(ctx, pointer(200, 150), { emoji: '🚀', size: 80 });
    handlers.onCommit();

    const shapes = store.get().shapes;
    expect(shapes).toHaveLength(1);
    // Centred on the pointer: top-left = pointer - size/2; upright by default.
    expect(shapes[0]).toMatchObject({
      kind: 'emoji',
      emoji: '🚀',
      size: 80,
      x: 160,
      y: 110,
      rotation: 0,
    });
    expect(store.get().selectedId).toBe(shapes[0]?.id);
    expect(getCommits()).toBe(1);
  });

  it('repositions while dragging before commit', () => {
    const { store, ctx } = harness();
    const handlers = startEmojiGesture(ctx, pointer(200, 150), { emoji: '😀', size: 80 });
    handlers.onMove(dragPoint(300, 250));
    handlers.onCommit();

    expect(store.get().shapes[0]).toMatchObject({ kind: 'emoji', x: 260, y: 210 });
  });

  it('previews on press and clears the live shape on commit', () => {
    const { ctx, live } = harness();
    const handlers = startEmojiGesture(ctx, pointer(200, 150), { emoji: '😀', size: 80 });
    expect(live[0]).toMatchObject({ kind: 'emoji', x: 160, y: 110 });
    handlers.onCommit();
    expect(live.at(-1)).toBeNull();
  });

  it('adds nothing and clears the preview on cancel', () => {
    const { store, ctx, live } = harness();
    const handlers = startEmojiGesture(ctx, pointer(200, 150), { emoji: '😀', size: 80 });
    handlers.onCancel();
    expect(store.get().shapes).toHaveLength(0);
    expect(live.at(-1)).toBeNull();
  });
});
