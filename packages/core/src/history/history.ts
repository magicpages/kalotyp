import type { UtilityId } from '../plugins/utility.js';

/**
 * Immutable snapshot of every registered plugin's state at a single moment.
 * `History` deep-clones on capture so live store writes cannot bleed in.
 */
export type SessionSnapshot = ReadonlyMap<UtilityId, unknown>;

export const HISTORY_MAX_ENTRIES = 50;

export interface UndoResult {
  readonly snapshot: SessionSnapshot;
  /** Utility ids whose state changed between the prior and restored snapshot. */
  readonly changed: ReadonlySet<UtilityId>;
}

/** Editor-wide undo/redo store using a snapshot stack. State-only; the editor decides when to commit. */
export class History {
  private shadow: SessionSnapshot;
  private undoStack: SessionSnapshot[] = [];
  private redoStack: SessionSnapshot[] = [];

  constructor(initial: SessionSnapshot) {
    this.shadow = cloneSnapshot(initial);
  }

  /**
   * Capture a commit. Previous shadow → undo stack; `current` → shadow.
   * Redo is cleared because a new commit branches the history. A commit
   * structurally equal to the shadow is a no-op so duplicates (clicking
   * the same preset twice) don't pollute the undo stack.
   */
  commit(current: SessionSnapshot): void {
    if (snapshotsEqual(current, this.shadow)) return;
    this.undoStack.push(this.shadow);
    if (this.undoStack.length > HISTORY_MAX_ENTRIES) {
      this.undoStack.shift();
    }
    this.shadow = cloneSnapshot(current);
    this.redoStack.length = 0;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Pop the most recent prior snapshot; `current` goes onto the redo stack. Returns null if undo is empty. */
  undo(current: SessionSnapshot): UndoResult | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(cloneSnapshot(current));
    this.shadow = previous;
    return { snapshot: previous, changed: diffSnapshots(current, previous) };
  }

  /** Pop the most recent redo entry; `current` goes onto the undo stack. Returns null if redo is empty. */
  redo(current: SessionSnapshot): UndoResult | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneSnapshot(current));
    if (this.undoStack.length > HISTORY_MAX_ENTRIES) {
      this.undoStack.shift();
    }
    this.shadow = next;
    return { snapshot: next, changed: diffSnapshots(current, next) };
  }

  /** Test/debug helpers; not part of the editor's runtime API. */
  size(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }
}

function snapshotsEqual(a: SessionSnapshot, b: SessionSnapshot): boolean {
  if (a.size !== b.size) return false;
  for (const [id, value] of a) {
    if (!b.has(id)) return false;
    if (stableJson(value) !== stableJson(b.get(id))) return false;
  }
  return true;
}

function diffSnapshots(prev: SessionSnapshot, next: SessionSnapshot): Set<UtilityId> {
  const changed = new Set<UtilityId>();
  for (const [id, value] of next) {
    if (stableJson(value) !== stableJson(prev.get(id))) changed.add(id);
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) changed.add(id);
  }
  return changed;
}

function cloneSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  const next = new Map<UtilityId, unknown>();
  for (const [id, value] of snapshot) {
    next.set(id, structuredClone(value));
  }
  return next;
}

/** Key-sorted JSON for structural equality regardless of insertion order. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}
