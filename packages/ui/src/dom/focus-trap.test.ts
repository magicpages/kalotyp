import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installFocusTrap } from './focus-trap.js';

describe('installFocusTrap', () => {
  let trigger: HTMLButtonElement;
  let host: HTMLDivElement;

  beforeEach(() => {
    trigger = document.createElement('button');
    trigger.textContent = 'Edit';
    document.body.appendChild(trigger);
    trigger.focus();

    host = document.createElement('div');
    host.innerHTML = `
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c">C</button>
    `;
    document.body.appendChild(host);
  });

  afterEach(() => {
    trigger.remove();
    host.remove();
  });

  it('moves focus into the host on install', async () => {
    const handle = installFocusTrap({ host });
    // RAF-deferred; jsdom resolves rAF synchronously enough that we
    // can wait via a microtask + timeout queue.
    await new Promise((r) => setTimeout(r, 16));
    expect(document.activeElement?.id).toBe('a');
    handle.release();
  });

  it('honours an explicit initialFocus target', async () => {
    const handle = installFocusTrap({
      host,
      initialFocus: host.querySelector('#b') as HTMLElement,
    });
    await new Promise((r) => setTimeout(r, 16));
    expect(document.activeElement?.id).toBe('b');
    handle.release();
  });

  it('restores focus to the trigger element on release', async () => {
    const handle = installFocusTrap({ host });
    await new Promise((r) => setTimeout(r, 16));
    handle.release();
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Tab from last to first', async () => {
    const handle = installFocusTrap({ host });
    await new Promise((r) => setTimeout(r, 16));
    const last = host.querySelector('#c') as HTMLButtonElement;
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(document.activeElement?.id).toBe('a');
    handle.release();
  });

  it('wraps Shift+Tab from first to last', async () => {
    const handle = installFocusTrap({ host });
    await new Promise((r) => setTimeout(r, 16));
    const first = host.querySelector('#a') as HTMLButtonElement;
    first.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(document.activeElement?.id).toBe('c');
    handle.release();
  });

  it('lets Tab through when focus is in the middle of the trap', async () => {
    const handle = installFocusTrap({ host });
    await new Promise((r) => setTimeout(r, 16));
    const middle = host.querySelector('#b') as HTMLButtonElement;
    middle.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    // The trap doesn't preventDefault the middle case; the browser
    // would advance to #c, but jsdom doesn't simulate that. We just
    // verify the trap didn't intervene.
    expect(event.defaultPrevented).toBe(false);
    handle.release();
  });
});
