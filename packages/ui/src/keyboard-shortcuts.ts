/**
 * Manifest of every keyboard shortcut. The cheatsheet UI reads this list.
 * This is a manifest, not a registry — handlers live with the features that own them.
 * "Ctrl" stands in for Ctrl/Cmd: handlers check `ctrlKey || metaKey`, so one label covers both.
 */

export type KeyboardShortcutContext = 'editor' | 'annotate' | 'redact' | 'text';

export interface KeyboardShortcut {
  /** Tokens rendered as `<kbd>` pills joined by " + ". Use platform-neutral spelling ("Ctrl", "Esc", "Arrow keys"). */
  readonly keys: ReadonlyArray<string>;
  readonly description: string;
  readonly context: KeyboardShortcutContext;
}

export const KEYBOARD_SHORTCUTS: ReadonlyArray<KeyboardShortcut> = [
  {
    keys: ['?'],
    description: 'Show keyboard shortcuts',
    context: 'editor',
  },
  {
    keys: ['Esc'],
    description: 'Close editor (or clear current selection)',
    context: 'editor',
  },
  {
    keys: ['Ctrl', 'Z'],
    description: 'Undo',
    context: 'editor',
  },
  {
    keys: ['Ctrl', 'Shift', 'Z'],
    description: 'Redo',
    context: 'editor',
  },
  {
    keys: ['Ctrl', 'Y'],
    description: 'Redo (alternate)',
    context: 'editor',
  },
  {
    keys: ['Tab'],
    description: 'Move focus to next control',
    context: 'editor',
  },
  {
    keys: ['Shift', 'Tab'],
    description: 'Move focus to previous control',
    context: 'editor',
  },

  {
    keys: ['Delete'],
    description: 'Delete the selected shape',
    context: 'annotate',
  },
  {
    keys: ['Arrow keys'],
    description: 'Nudge the selected shape by 1 px',
    context: 'annotate',
  },
  {
    keys: ['Shift', 'Arrow keys'],
    description: 'Nudge the selected shape by 10 px',
    context: 'annotate',
  },
  {
    keys: ['Shift', 'while drawing'],
    description: 'Constrain shape (square, 45° line, circle)',
    context: 'annotate',
  },

  {
    keys: ['Delete'],
    description: 'Delete the selected redaction region',
    context: 'redact',
  },
  {
    keys: ['Arrow keys'],
    description: 'Nudge the selected region by 1 px',
    context: 'redact',
  },
  {
    keys: ['Shift', 'Arrow keys'],
    description: 'Nudge the selected region by 10 px',
    context: 'redact',
  },

  {
    keys: ['Enter'],
    description: 'Commit the text and close the editor',
    context: 'text',
  },
  {
    keys: ['Shift', 'Enter'],
    description: 'Insert a line break',
    context: 'text',
  },
  {
    keys: ['Esc'],
    description: 'Cancel the in-progress edit',
    context: 'text',
  },
];

export const KEYBOARD_SHORTCUT_CONTEXT_LABELS: Readonly<Record<KeyboardShortcutContext, string>> = {
  editor: 'Editor',
  annotate: 'Annotate',
  redact: 'Redact',
  text: 'Text editing',
};
