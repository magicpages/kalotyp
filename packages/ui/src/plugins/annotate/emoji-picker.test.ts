import { afterEach, describe, expect, it } from 'vitest';
import { EMOJI_GROUPS } from './emoji-data.js';
import { buildEmojiPicker } from './emoji-picker.js';

function setup() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const selected: string[] = [];
  let closed = 0;
  const picker = buildEmojiPicker({
    host,
    onSelect: (char) => selected.push(char),
    onClose: () => {
      closed += 1;
    },
  });
  return { host, picker, selected, getClosed: () => closed };
}

function cells(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('.kalotyp-annotate-emoji-cell'));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('emoji picker', () => {
  it('renders one tab per category and the first group in the grid by default', () => {
    const { host } = setup();
    const tabs = host.querySelectorAll('.kalotyp-annotate-emoji-tab');
    expect(tabs.length).toBe(EMOJI_GROUPS.length);
    expect(cells(host).length).toBe(EMOJI_GROUPS[0]?.emojis.length);
    // The active tab is the first one.
    expect(tabs[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('gives every cell an accessible label (the emoji name)', () => {
    const { host } = setup();
    const first = cells(host)[0];
    expect(first?.getAttribute('aria-label')).toBeTruthy();
    expect(first?.dataset.char).toBeTruthy();
  });

  it('renders each cell as an OS colour-emoji glyph (no bundled artwork)', () => {
    const { host } = setup();
    const first = cells(host)[0];
    // The glyph is the emoji character rendered by the OS font — same as the
    // canvas bakes — with no <img> / SVG artwork involved.
    const glyph = first?.querySelector<HTMLElement>('.kalotyp-annotate-emoji-glyph');
    expect(glyph).not.toBeNull();
    expect(glyph?.textContent).toBe(first?.dataset.char);
    expect(first?.querySelector('img')).toBeNull();
  });

  it('reports the chosen character when a cell is clicked', () => {
    const { host, selected } = setup();
    const first = cells(host)[0];
    first?.click();
    expect(selected).toEqual([first?.dataset.char]);
  });

  it('switching a category tab renders that group', () => {
    const { host } = setup();
    const tabs = host.querySelectorAll<HTMLButtonElement>('.kalotyp-annotate-emoji-tab');
    const targetIndex = 3;
    tabs[targetIndex]?.click();
    expect(cells(host).length).toBe(EMOJI_GROUPS[targetIndex]?.emojis.length);
    expect(tabs[targetIndex]?.getAttribute('aria-pressed')).toBe('true');
    expect(tabs[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('filters by name on search and deselects the tabs', () => {
    const { host } = setup();
    const search = host.querySelector<HTMLInputElement>('.kalotyp-annotate-emoji-search-input');
    if (!search) throw new Error('search input missing');
    search.value = 'rocket';
    search.dispatchEvent(new Event('input'));
    const found = cells(host);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((c) => c.dataset.char === '🚀')).toBe(true);
    // Every match's name contains the query.
    for (const cell of found) {
      expect(cell.getAttribute('aria-label')?.toLowerCase()).toContain('rocket');
    }
    const selectedTabs = host.querySelectorAll('.kalotyp-annotate-emoji-tab[aria-pressed="true"]');
    expect(selectedTabs.length).toBe(0);
  });

  it('shows the empty state when nothing matches', () => {
    const { host } = setup();
    const search = host.querySelector<HTMLInputElement>('.kalotyp-annotate-emoji-search-input');
    if (!search) throw new Error('search input missing');
    search.value = 'zzzznotarealemojiname';
    search.dispatchEvent(new Event('input'));
    expect(cells(host).length).toBe(0);
    const empty = host.querySelector<HTMLElement>('.kalotyp-annotate-emoji-empty');
    expect(empty?.hidden).toBe(false);
  });

  it('clearing the search restores the active group', () => {
    const { host } = setup();
    const search = host.querySelector<HTMLInputElement>('.kalotyp-annotate-emoji-search-input');
    if (!search) throw new Error('search input missing');
    search.value = 'rocket';
    search.dispatchEvent(new Event('input'));
    search.value = '';
    search.dispatchEvent(new Event('input'));
    expect(cells(host).length).toBe(EMOJI_GROUPS[0]?.emojis.length);
  });

  it('fires onClose when the close button is pressed', () => {
    const { host, getClosed } = setup();
    const close = host.querySelector<HTMLButtonElement>('.kalotyp-annotate-emoji-close');
    close?.click();
    expect(getClosed()).toBe(1);
  });

  it('show() reveals the popover and hide() conceals it', () => {
    const { picker } = setup();
    expect(picker.element.hidden).toBe(true);
    picker.show();
    expect(picker.element.hidden).toBe(false);
    expect(picker.isOpen).toBe(true);
    picker.hide();
    expect(picker.element.hidden).toBe(true);
    expect(picker.isOpen).toBe(false);
  });

  it('moves focus across cells with the arrow keys (roving tabindex)', () => {
    const { host } = setup();
    const grid = host.querySelector<HTMLElement>('.kalotyp-annotate-emoji-grid');
    const list = cells(host);
    const first = list[0];
    const second = list[1];
    if (!grid || !first || !second) throw new Error('grid/cells missing');
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(second);
    expect(second.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
  });

  it('destroy() removes the popover from the DOM', () => {
    const { host, picker } = setup();
    expect(host.querySelector('.kalotyp-annotate-emoji-picker')).not.toBeNull();
    picker.destroy();
    expect(host.querySelector('.kalotyp-annotate-emoji-picker')).toBeNull();
  });
});
