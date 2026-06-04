/**
 * Nested overlay (modal or anchored popover) used for the Output popover, Preferences modal,
 * and Keyboard cheatsheet. Lives inside the editor host so the editor's click-capture scope
 * and Ghost's modal-service allowlist still cover it. Traps Tab in capture phase so it wins
 * over the editor's outer trap.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export interface NestedModalOptions {
  readonly host: HTMLElement;
  /** When supplied, the overlay positions as a popover above this element instead of centred. */
  readonly anchor?: HTMLElement;
  readonly title: string;
  readonly body: HTMLElement;
  /** CSS class added to the overlay container. */
  readonly variant?: string;
  /** Default true; the popover variant typically sets false (Esc / click-outside dismiss). */
  readonly showCloseButton?: boolean;
  readonly onClose: () => void;
}

export interface NestedModalHandle {
  readonly element: HTMLElement;
  close(): void;
}

/** Open a nested modal or anchored popover. Caller owns the body content. */
export function openNestedModal(options: NestedModalOptions): NestedModalHandle {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  overlay.className = 'kalotyp-nested-overlay';
  if (options.variant) overlay.classList.add(options.variant);

  const surface = document.createElement('div');
  surface.className = 'kalotyp-nested-surface';
  surface.setAttribute('role', 'dialog');
  surface.setAttribute('aria-modal', 'true');
  surface.tabIndex = -1;

  const titleId = `kalotyp-nested-title-${Math.random().toString(36).slice(2, 8)}`;
  surface.setAttribute('aria-labelledby', titleId);

  const header = document.createElement('div');
  header.className = 'kalotyp-nested-header';

  const heading = document.createElement('h3');
  heading.id = titleId;
  heading.className = 'kalotyp-nested-title';
  heading.textContent = options.title;
  header.appendChild(heading);

  let closeButton: HTMLButtonElement | undefined;
  if (options.showCloseButton !== false) {
    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'kalotyp-nested-close';
    closeButton.setAttribute('aria-label', `Close ${options.title}`);
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => requestClose());
    header.appendChild(closeButton);
  }

  surface.appendChild(header);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'kalotyp-nested-body';
  bodyWrap.appendChild(options.body);
  surface.appendChild(bodyWrap);

  overlay.appendChild(surface);
  options.host.appendChild(overlay);

  if (options.anchor) {
    overlay.classList.add('kalotyp-nested-overlay--popover');
    positionAnchored(overlay, surface, options.anchor);
    const reposition = (): void =>
      positionAnchored(overlay, surface, options.anchor as HTMLElement);
    window.addEventListener('resize', reposition);
    overlay.dataset.resizeListenerAttached = '1';
    overlay.addEventListener('kalotyp-nested-cleanup', () => {
      window.removeEventListener('resize', reposition);
    });
  } else {
    overlay.classList.add('kalotyp-nested-overlay--modal');
  }

  requestAnimationFrame(() => surface.focus());

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      surface.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !surface.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !surface.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  // Capture phase so we win over the editor's outer Tab trap.
  document.addEventListener('keydown', onKeyDown, true);

  const onClickOutside = (event: MouseEvent): void => {
    const target = event.target as Node | null;
    if (!target) return;
    if (!surface.contains(target)) {
      requestClose();
    }
  };
  // Listen on overlay (dimming layer) not document, so other editor clicks pass through normally.
  overlay.addEventListener('mousedown', onClickOutside);

  let closing = false;
  function requestClose(): void {
    if (closing) return;
    closing = true;
    document.removeEventListener('keydown', onKeyDown, true);
    overlay.removeEventListener('mousedown', onClickOutside);
    overlay.dispatchEvent(new Event('kalotyp-nested-cleanup'));
    overlay.remove();
    if (previouslyFocused?.isConnected) {
      try {
        previouslyFocused.focus();
      } catch {
        /* trigger may have been removed; ignore */
      }
    }
    options.onClose();
  }

  return {
    element: overlay,
    close: requestClose,
  };
}

function positionAnchored(overlay: HTMLElement, surface: HTMLElement, anchor: HTMLElement): void {
  const anchorRect = anchor.getBoundingClientRect();
  const hostRect = overlay.parentElement?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
  // Bottom edge 8px above anchor's top; right edge aligned to anchor's right (keeps it in the gutter).
  const surfaceRect = surface.getBoundingClientRect();
  const top = anchorRect.top - hostRect.top - surfaceRect.height - 8;
  const right = hostRect.right - anchorRect.right;
  surface.style.position = 'absolute';
  surface.style.top = `${Math.max(8, top)}px`;
  surface.style.right = `${Math.max(8, right)}px`;
}
