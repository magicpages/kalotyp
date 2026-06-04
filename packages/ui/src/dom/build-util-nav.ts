import type { UtilityId } from '@magicpages/kalotyp-core';

export interface UtilityNavEntry {
  readonly id: UtilityId;
  readonly label: string;
}

export interface UtilityNavElements {
  readonly container: HTMLDivElement;
  readonly buttons: ReadonlyMap<UtilityId, HTMLButtonElement>;
}

export interface BuildUtilityNavOptions {
  /** Tabpanel id wired into each tab's `aria-controls` to complete the tablist/tab/tabpanel triple. */
  panelId: string;
}

/** Build the utility nav. Roving-tabindex per WAI-ARIA APG: active tab `tabindex=0`, others `-1`; Left/Right/Home/End move active state. */
export function buildUtilityNav(
  entries: readonly UtilityNavEntry[],
  initialActive: UtilityId,
  onSelect: (id: UtilityId) => void,
  options: BuildUtilityNavOptions,
): UtilityNavElements {
  const container = document.createElement('div');
  container.className = 'kalotyp-util-nav';
  container.setAttribute('role', 'tablist');
  container.setAttribute('aria-label', 'Editor tools');

  const buttons = new Map<UtilityId, HTMLButtonElement>();
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-util-nav-button';
    button.dataset.utilityId = entry.id;
    button.id = `${options.panelId}-tab-${entry.id}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', entry.id === initialActive ? 'true' : 'false');
    button.setAttribute('aria-controls', options.panelId);
    button.tabIndex = entry.id === initialActive ? 0 : -1;
    button.textContent = entry.label;
    button.addEventListener('click', () => onSelect(entry.id));
    container.appendChild(button);
    buttons.set(entry.id, button);
  }

  // WAI-ARIA APG "automatic activation" pattern: Left/Right/Home/End change selection + focus.
  container.addEventListener('keydown', (event) => {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    const ids = entries.map((e) => e.id);
    const currentEl = event.target as HTMLElement | null;
    const currentId = currentEl?.dataset?.utilityId as UtilityId | undefined;
    const currentIdx = currentId ? ids.indexOf(currentId) : -1;
    if (currentIdx === -1) return;

    let nextIdx = currentIdx;
    if (event.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + ids.length) % ids.length;
    else if (event.key === 'ArrowRight') nextIdx = (currentIdx + 1) % ids.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = ids.length - 1;

    const nextId = ids[nextIdx];
    if (!nextId || nextId === currentId) return;
    event.preventDefault();
    onSelect(nextId);
    buttons.get(nextId)?.focus();
  });

  return { container, buttons };
}

/** Update active tab state and scroll the newly-active tab into view (no-op on non-overflowing desktop strips). */
export function setActiveUtilityButton(
  nav: UtilityNavElements,
  active: UtilityId,
  panel?: HTMLElement,
): void {
  for (const [id, button] of nav.buttons.entries()) {
    const isActive = id === active;
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.tabIndex = isActive ? 0 : -1;
    if (isActive) {
      // jsdom's scrollIntoView stub throws on options args — swallow to keep tests green.
      try {
        button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } catch {
        // ignore
      }
      if (panel) panel.setAttribute('aria-labelledby', button.id);
    }
  }
}
