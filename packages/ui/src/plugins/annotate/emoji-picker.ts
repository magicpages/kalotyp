/**
 * Emoji picker popover for the annotate emoji sticker tool.
 *
 * A self-contained overlay (owned by the mount layer, like the inline text
 * editor) with a search box, category tabs, and a scrollable grid. To keep the
 * DOM small the grid renders only the active category — or, while searching,
 * the capped set of name matches — never all ~1,900 cells at once.
 *
 * The picker is purely presentational: clicking a cell reports the chosen
 * character via `onSelect`; the caller arms it as the current emoji and places
 * it on the canvas. The popover is positioned by CSS (absolute, anchored above
 * the panel) so showing it never reflows the stage.
 */

import { icon } from '../../icons.js';
import { EMOJI_GROUPS, type EmojiEntry } from './emoji-data.js';
import { emojiSvgUrlForKey } from './emoji-images.js';

export interface EmojiPickerOptions {
  readonly host: HTMLElement;
  /** A cell was chosen; the value is the emoji character. */
  onSelect(char: string): void;
  /** The close (×) button was pressed. */
  onClose(): void;
}

export interface EmojiPickerHandle {
  readonly element: HTMLDivElement;
  show(): void;
  hide(): void;
  readonly isOpen: boolean;
  destroy(): void;
}

/** Fixed column count so the grid lays out predictably and arrow-key navigation can move by row. */
const GRID_COLUMNS = 8;
/** Cap on rendered search matches — a guard against rendering a huge result DOM. */
const MAX_SEARCH_RESULTS = 180;

export function buildEmojiPicker(options: EmojiPickerOptions): EmojiPickerHandle {
  let open = false;
  let activeGroupIndex = 0;

  const root = document.createElement('div');
  root.className = 'kalotyp-annotate-emoji-picker';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Emoji picker');
  root.hidden = true;

  // ----- Header: title + close -----
  const header = document.createElement('div');
  header.className = 'kalotyp-annotate-emoji-header';
  const title = document.createElement('span');
  title.className = 'kalotyp-annotate-emoji-title';
  title.textContent = 'Emoji';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'kalotyp-annotate-emoji-close';
  closeButton.innerHTML = icon('close');
  closeButton.setAttribute('aria-label', 'Close emoji picker');
  closeButton.title = 'Close';
  closeButton.addEventListener('click', () => options.onClose());
  header.appendChild(title);
  header.appendChild(closeButton);

  // ----- Search -----
  const searchWrap = document.createElement('div');
  searchWrap.className = 'kalotyp-annotate-emoji-search';
  searchWrap.innerHTML = icon('search', { 'aria-hidden': 'true' });
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'kalotyp-annotate-emoji-search-input';
  searchInput.setAttribute('aria-label', 'Search emoji');
  searchInput.placeholder = 'Search emoji';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchWrap.appendChild(searchInput);

  // ----- Category tabs -----
  const tabs = document.createElement('div');
  tabs.className = 'kalotyp-annotate-emoji-tabs';
  // Plain category-filter buttons (aria-pressed), not an ARIA tablist — there
  // are no tab panels and search can leave none active, so tab semantics would
  // mislead assistive tech.
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Emoji categories');
  const tabButtons: HTMLButtonElement[] = [];
  EMOJI_GROUPS.forEach((group, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'kalotyp-annotate-emoji-tab';
    tab.setAttribute('aria-label', group.label);
    tab.title = group.label;
    // The group's first emoji as the tab icon — same OpenMoji artwork as the
    // cells (crisp + consistent), rather than the OS glyph.
    const firstKey = group.emojis[0]?.key;
    if (firstKey) {
      const tabImg = document.createElement('img');
      tabImg.className = 'kalotyp-annotate-emoji-tab-img';
      tabImg.setAttribute('loading', 'lazy');
      tabImg.alt = '';
      tabImg.draggable = false;
      tabImg.src = emojiSvgUrlForKey(firstKey);
      tab.appendChild(tabImg);
    }
    tab.addEventListener('click', () => {
      searchInput.value = '';
      setActiveGroup(index);
    });
    tabs.appendChild(tab);
    tabButtons.push(tab);
  });

  // ----- Grid + empty state -----
  const grid = document.createElement('div');
  grid.className = 'kalotyp-annotate-emoji-grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Emoji');
  grid.style.setProperty('--kalotyp-emoji-cols', String(GRID_COLUMNS));

  const empty = document.createElement('p');
  empty.className = 'kalotyp-annotate-emoji-empty';
  empty.textContent = 'No emoji found.';
  empty.hidden = true;

  root.appendChild(header);
  root.appendChild(searchWrap);
  root.appendChild(tabs);
  root.appendChild(grid);
  root.appendChild(empty);
  options.host.appendChild(root);

  function setActiveGroup(index: number): void {
    activeGroupIndex = index;
    tabButtons.forEach((tab, i) => {
      tab.setAttribute('aria-pressed', i === index ? 'true' : 'false');
    });
    const group = EMOJI_GROUPS[index];
    renderCells(group ? group.emojis : []);
  }

  function runSearch(query: string): void {
    const q = query.trim().toLowerCase();
    if (q === '') {
      setActiveGroup(activeGroupIndex);
      return;
    }
    // Searching spans all groups; clear the active category so the highlight
    // doesn't imply the results are scoped to one.
    for (const tab of tabButtons) tab.setAttribute('aria-pressed', 'false');
    const matches: EmojiEntry[] = [];
    for (const group of EMOJI_GROUPS) {
      for (const entry of group.emojis) {
        if (entry.name.includes(q)) {
          matches.push(entry);
          if (matches.length >= MAX_SEARCH_RESULTS) break;
        }
      }
      if (matches.length >= MAX_SEARCH_RESULTS) break;
    }
    renderCells(matches);
  }

  function renderCells(entries: ReadonlyArray<EmojiEntry>): void {
    grid.replaceChildren();
    empty.hidden = entries.length > 0;
    grid.hidden = entries.length === 0;
    entries.forEach((entry, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'kalotyp-annotate-emoji-cell';
      // Roving tabindex: only the first cell is in the Tab order; arrow keys
      // move focus among cells. Keeps a several-hundred-cell grid from adding
      // that many Tab stops.
      cell.tabIndex = i === 0 ? 0 : -1;
      cell.dataset.char = entry.char;
      cell.setAttribute('aria-label', entry.name);
      cell.title = entry.name;
      // Render the OpenMoji SVG (same artwork the canvas bakes), lazily so only
      // the cells scrolled into view fetch. Decorative — the button carries the
      // accessible name.
      const img = document.createElement('img');
      img.className = 'kalotyp-annotate-emoji-cell-img';
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.alt = '';
      img.draggable = false;
      img.src = emojiSvgUrlForKey(entry.key);
      cell.appendChild(img);
      cell.addEventListener('click', () => options.onSelect(entry.char));
      grid.appendChild(cell);
    });
    grid.scrollTop = 0;
  }

  function focusCell(index: number): void {
    const cells = grid.querySelectorAll<HTMLButtonElement>('.kalotyp-annotate-emoji-cell');
    const target = cells[index];
    if (!target) return;
    for (const cell of cells) cell.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
  }

  function onGridKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      !target.classList.contains('kalotyp-annotate-emoji-cell')
    ) {
      return;
    }
    const cells = Array.from(
      grid.querySelectorAll<HTMLButtonElement>('.kalotyp-annotate-emoji-cell'),
    );
    const current = cells.indexOf(target as HTMLButtonElement);
    if (current === -1) return;
    let next = current;
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(current + 1, cells.length - 1);
        break;
      case 'ArrowLeft':
        next = Math.max(current - 1, 0);
        break;
      case 'ArrowDown':
        next = Math.min(current + GRID_COLUMNS, cells.length - 1);
        break;
      case 'ArrowUp':
        next = Math.max(current - GRID_COLUMNS, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = cells.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusCell(next);
  }

  const onSearchInput = (): void => runSearch(searchInput.value);
  // Keep the wheel inside the picker: the grid scrolls natively, but the event
  // must not reach the editor's stage zoom handler (which would zoom the image
  // instead). The stage listener is in the bubble phase, so stopping
  // propagation here is enough; we don't preventDefault so native scroll stays.
  const onWheel = (event: WheelEvent): void => event.stopPropagation();
  searchInput.addEventListener('input', onSearchInput);
  grid.addEventListener('keydown', onGridKeyDown);
  root.addEventListener('wheel', onWheel);

  setActiveGroup(0);

  return {
    element: root,
    get isOpen(): boolean {
      return open;
    },
    show(): void {
      open = true;
      root.hidden = false;
      // Defer focus so the show-time layout settles first.
      requestAnimationFrame(() => searchInput.focus());
    },
    hide(): void {
      open = false;
      root.hidden = true;
    },
    destroy(): void {
      searchInput.removeEventListener('input', onSearchInput);
      grid.removeEventListener('keydown', onGridKeyDown);
      root.removeEventListener('wheel', onWheel);
      root.remove();
    },
  };
}
