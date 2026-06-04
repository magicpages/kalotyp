import { describe, expect, it } from 'vitest';
import {
  KEYBOARD_SHORTCUT_CONTEXT_LABELS,
  KEYBOARD_SHORTCUTS,
  type KeyboardShortcutContext,
} from './keyboard-shortcuts.js';

describe('KEYBOARD_SHORTCUTS', () => {
  it('every entry has at least one key token and a non-empty description', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a context with a registered label', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(KEYBOARD_SHORTCUT_CONTEXT_LABELS[shortcut.context]).toBeTruthy();
    }
  });

  it('lists the four contexts the cheatsheet groups by', () => {
    const seen = new Set<KeyboardShortcutContext>();
    for (const shortcut of KEYBOARD_SHORTCUTS) seen.add(shortcut.context);
    expect(seen).toEqual(new Set(['editor', 'annotate', 'redact', 'text']));
  });

  it('includes the discoverability shortcut (? opens cheatsheet)', () => {
    const found = KEYBOARD_SHORTCUTS.find(
      (s) => s.context === 'editor' && s.keys.length === 1 && s.keys[0] === '?',
    );
    expect(found).toBeTruthy();
  });

  it('lists undo and redo on the editor with Ctrl modifier', () => {
    const undo = KEYBOARD_SHORTCUTS.find(
      (s) => s.context === 'editor' && s.keys.includes('Z') && !s.keys.includes('Shift'),
    );
    const redoShift = KEYBOARD_SHORTCUTS.find(
      (s) => s.context === 'editor' && s.keys.includes('Z') && s.keys.includes('Shift'),
    );
    expect(undo?.keys[0]).toBe('Ctrl');
    expect(redoShift?.keys[0]).toBe('Ctrl');
  });
});
