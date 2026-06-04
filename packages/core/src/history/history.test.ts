import { describe, expect, it } from 'vitest';
import type { UtilityId } from '../plugins/utility.js';
import { HISTORY_MAX_ENTRIES, History, type SessionSnapshot } from './history.js';

function snap(entries: Array<[UtilityId, unknown]>): SessionSnapshot {
  return new Map(entries);
}

describe('History', () => {
  it('starts empty — neither undo nor redo is available', () => {
    const history = new History(snap([['crop', { rect: { x: 0, y: 0 } }]]));
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo(snap([['crop', { rect: { x: 0, y: 0 } }]]))).toBeNull();
    expect(history.redo(snap([['crop', { rect: { x: 0, y: 0 } }]]))).toBeNull();
  });

  it('commits push the previous shadow onto the undo stack', () => {
    const history = new History(snap([['crop', { v: 0 }]]));
    history.commit(snap([['crop', { v: 1 }]]));
    history.commit(snap([['crop', { v: 2 }]]));
    expect(history.size()).toEqual({ undo: 2, redo: 0 });

    const result = history.undo(snap([['crop', { v: 2 }]]));
    expect(result?.snapshot.get('crop')).toEqual({ v: 1 });
    expect(result?.changed).toEqual(new Set(['crop']));
  });

  it('skips no-op commits (state unchanged from shadow)', () => {
    const history = new History(snap([['crop', { v: 1 }]]));
    history.commit(snap([['crop', { v: 1 }]]));
    expect(history.size()).toEqual({ undo: 0, redo: 0 });
    expect(history.canUndo()).toBe(false);
  });

  it('compares snapshots structurally regardless of key order', () => {
    const history = new History(snap([['crop', { a: 1, b: 2 }]]));
    history.commit(snap([['crop', { b: 2, a: 1 }]]));
    expect(history.canUndo()).toBe(false);
  });

  it('redo round-trips an undo', () => {
    const history = new History(snap([['crop', { v: 0 }]]));
    history.commit(snap([['crop', { v: 1 }]]));

    const undo = history.undo(snap([['crop', { v: 1 }]]));
    expect(undo?.snapshot.get('crop')).toEqual({ v: 0 });
    expect(history.canRedo()).toBe(true);

    const redo = history.redo(snap([['crop', { v: 0 }]]));
    expect(redo?.snapshot.get('crop')).toEqual({ v: 1 });
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it('a new commit invalidates redo', () => {
    const history = new History(snap([['crop', { v: 0 }]]));
    history.commit(snap([['crop', { v: 1 }]]));
    history.undo(snap([['crop', { v: 1 }]]));
    expect(history.canRedo()).toBe(true);
    history.commit(snap([['crop', { v: 9 }]]));
    expect(history.canRedo()).toBe(false);
  });

  it('reports which utilities changed across an undo', () => {
    const history = new History(
      snap([
        ['crop', { v: 0 }],
        ['rotate', { angle: 0 }],
      ]),
    );
    history.commit(
      snap([
        ['crop', { v: 0 }],
        ['rotate', { angle: 30 }],
      ]),
    );
    const result = history.undo(
      snap([
        ['crop', { v: 0 }],
        ['rotate', { angle: 30 }],
      ]),
    );
    expect(result?.changed).toEqual(new Set(['rotate']));
  });

  it('reports utilities removed or added across an undo', () => {
    const history = new History(snap([['crop', { v: 0 }]]));
    history.commit(
      snap([
        ['crop', { v: 0 }],
        ['annotate', { shapes: [] }],
      ]),
    );
    const result = history.undo(
      snap([
        ['crop', { v: 0 }],
        ['annotate', { shapes: [] }],
      ]),
    );
    expect(result?.changed).toEqual(new Set(['annotate']));
  });

  it('clones captured snapshots so live mutations cannot bleed in', () => {
    const live = { rect: { x: 0, y: 0 } };
    const history = new History(snap([['crop', live]]));
    history.commit(snap([['crop', { rect: { x: 10, y: 10 } }]]));

    live.rect.x = 999;

    const undo = history.undo(snap([['crop', { rect: { x: 10, y: 10 } }]]));
    expect(undo?.snapshot.get('crop')).toEqual({ rect: { x: 0, y: 0 } });
  });

  it('caps the undo stack at HISTORY_MAX_ENTRIES, dropping the oldest', () => {
    const history = new History(snap([['crop', { v: 0 }]]));
    for (let i = 1; i <= HISTORY_MAX_ENTRIES + 5; i++) {
      history.commit(snap([['crop', { v: i }]]));
    }
    expect(history.size().undo).toBe(HISTORY_MAX_ENTRIES);

    let current: SessionSnapshot = snap([['crop', { v: HISTORY_MAX_ENTRIES + 5 }]]);
    while (history.canUndo()) {
      const undo = history.undo(current);
      if (!undo) break;
      current = undo.snapshot;
    }
    expect(current.get('crop')).toEqual({ v: 5 });
  });
});
