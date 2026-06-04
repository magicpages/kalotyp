/** Cheatsheet modal — renders `KEYBOARD_SHORTCUTS` grouped by context. Opened via `?`. */

import { openNestedModal } from '../dom/nested-modal.js';
import {
  KEYBOARD_SHORTCUT_CONTEXT_LABELS,
  KEYBOARD_SHORTCUTS,
  type KeyboardShortcut,
  type KeyboardShortcutContext,
} from '../keyboard-shortcuts.js';

export interface OpenCheatsheetOptions {
  readonly host: HTMLElement;
  onClose(): void;
}

export interface CheatsheetHandle {
  close(): void;
}

const CONTEXT_ORDER: ReadonlyArray<KeyboardShortcutContext> = [
  'editor',
  'annotate',
  'redact',
  'text',
];

export function openCheatsheet(options: OpenCheatsheetOptions): CheatsheetHandle {
  const body = document.createElement('div');
  body.className = 'kalotyp-cheatsheet-body';

  for (const context of CONTEXT_ORDER) {
    const entries = KEYBOARD_SHORTCUTS.filter((s) => s.context === context);
    if (entries.length === 0) continue;
    body.appendChild(buildSection(context, entries));
  }

  const handle = openNestedModal({
    host: options.host,
    title: 'Keyboard shortcuts',
    body,
    variant: 'kalotyp-cheatsheet-modal',
    showCloseButton: true,
    onClose: options.onClose,
  });

  return {
    close: () => handle.close(),
  };
}

function buildSection(
  context: KeyboardShortcutContext,
  entries: ReadonlyArray<KeyboardShortcut>,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'kalotyp-cheatsheet-section';

  const heading = document.createElement('h4');
  heading.className = 'kalotyp-cheatsheet-heading';
  heading.textContent = KEYBOARD_SHORTCUT_CONTEXT_LABELS[context];
  section.appendChild(heading);

  const list = document.createElement('dl');
  list.className = 'kalotyp-cheatsheet-list';

  for (const shortcut of entries) {
    const dt = document.createElement('dt');
    dt.className = 'kalotyp-cheatsheet-keys';
    shortcut.keys.forEach((token, index) => {
      if (index > 0) {
        const plus = document.createElement('span');
        plus.className = 'kalotyp-cheatsheet-plus';
        plus.setAttribute('aria-hidden', 'true');
        plus.textContent = '+';
        dt.appendChild(plus);
      }
      const kbd = document.createElement('kbd');
      kbd.className = 'kalotyp-cheatsheet-kbd';
      kbd.textContent = token;
      dt.appendChild(kbd);
    });

    const dd = document.createElement('dd');
    dd.className = 'kalotyp-cheatsheet-description';
    dd.textContent = shortcut.description;

    list.appendChild(dt);
    list.appendChild(dd);
  }

  section.appendChild(list);
  return section;
}
