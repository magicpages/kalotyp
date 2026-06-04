/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { KEYBOARD_SHORTCUTS } from '../keyboard-shortcuts.js';
import { openCheatsheet } from './modal.js';

let host: HTMLElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
});

function mountHost(): HTMLElement {
  const element = document.createElement('div');
  element.tabIndex = -1;
  document.body.appendChild(element);
  host = element;
  return element;
}

describe('openCheatsheet', () => {
  it('renders one section per context bucket present in the manifest', () => {
    const trigger = mountHost();
    openCheatsheet({ host: trigger, onClose: () => {} });
    const sections = trigger.querySelectorAll('.kalotyp-cheatsheet-section');
    const presentContexts = new Set(KEYBOARD_SHORTCUTS.map((s) => s.context));
    expect(sections.length).toBe(presentContexts.size);
  });

  it('renders every manifest entry as a dt/dd pair', () => {
    const trigger = mountHost();
    openCheatsheet({ host: trigger, onClose: () => {} });
    const dts = trigger.querySelectorAll('.kalotyp-cheatsheet-keys');
    const dds = trigger.querySelectorAll('.kalotyp-cheatsheet-description');
    expect(dts.length).toBe(KEYBOARD_SHORTCUTS.length);
    expect(dds.length).toBe(KEYBOARD_SHORTCUTS.length);
  });

  it('joins multi-key shortcuts with visible plus separators', () => {
    const trigger = mountHost();
    openCheatsheet({ host: trigger, onClose: () => {} });
    // Ctrl+Shift+Z renders three <kbd> pills and two `+` separators.
    const dts = Array.from(trigger.querySelectorAll<HTMLElement>('.kalotyp-cheatsheet-keys'));
    const multiKey = dts.find((dt) => dt.querySelectorAll('kbd').length >= 2);
    expect(multiKey).toBeTruthy();
    const pluses = multiKey?.querySelectorAll('.kalotyp-cheatsheet-plus');
    expect((pluses?.length ?? 0) + 1).toBe(multiKey?.querySelectorAll('kbd').length);
  });

  it('invokes onClose when the handle is closed', () => {
    const trigger = mountHost();
    let closed = false;
    const handle = openCheatsheet({
      host: trigger,
      onClose: () => {
        closed = true;
      },
    });
    handle.close();
    expect(closed).toBe(true);
    expect(trigger.querySelector('.kalotyp-cheatsheet-body')).toBeNull();
  });
});
