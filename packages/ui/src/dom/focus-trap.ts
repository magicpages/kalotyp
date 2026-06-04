/**
 * Focus trap + initial-focus + restore-on-release for the editor dialog.
 *
 * The Tab keydown path doesn't trap screen readers' virtual cursors — `aria-modal=true`
 * is what makes content outside the dialog inert for assistive tech. On release, focus
 * returns to the element that was active before the trap installed (usually the trigger).
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export interface InstallFocusTrapOptions {
  readonly host: HTMLElement;
  /** Element to focus on mount. Defaults to the first focusable descendant of `host`. */
  readonly initialFocus?: HTMLElement;
}

export interface FocusTrapHandle {
  /** Hook for future use; currently a no-op because focusables are re-queried on every Tab. */
  refresh(): void;
  /** Tear down listeners and restore focus to the trigger element. */
  release(): void;
}

/** Install the focus trap and seed initial focus. */
export function installFocusTrap(options: InstallFocusTrapOptions): FocusTrapHandle {
  const { host } = options;
  const trigger =
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;

  function getFocusable(): HTMLElement[] {
    // No offsetParent/visibility filtering: the selector handles `disabled`, jsdom
    // reports `offsetParent === null` for every element regardless of layout, and
    // we never display-hide focusable controls mid-interaction.
    return Array.from(host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  // rAF so the DOM is laid out before focus — initial tabIndex may have been set in this same tick.
  const seedTarget = options.initialFocus ?? getFocusable()[0];
  if (seedTarget) {
    requestAnimationFrame(() => seedTarget.focus());
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !host.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !host.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', onKeyDown, true);

  return {
    refresh: () => {},
    release: () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (trigger?.isConnected) {
        try {
          trigger.focus();
        } catch {
          // ignore
        }
      }
    },
  };
}
