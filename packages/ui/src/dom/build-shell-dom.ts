import { icon } from '../icons.js';

export interface ShellDom {
  readonly editor: HTMLElement;
  readonly modal: HTMLElement;
  readonly root: HTMLElement;
  readonly main: HTMLElement;
  readonly stage: HTMLElement;
  readonly navTools: HTMLElement;
  readonly utilMain: HTMLElement;
  readonly utilFooter: HTMLElement;
  readonly closeButton: HTMLButtonElement;
  /** Gear icon — opens the Preferences modal. */
  readonly prefsButton: HTMLButtonElement;
  readonly exportButton: HTMLButtonElement;
  /** Caret next to Save — opens the output-format popover; the Save button itself bypasses it. */
  readonly outputSettingsButton: HTMLButtonElement;
  /** Visually-hidden polite live region for one-shot announcements. */
  readonly liveRegion: HTMLElement;
  readonly titleId: string;
}

export interface BuildShellDomOptions {
  exportLabel: string;
}

// Monotonic id prefix so multiple editor instances on one page get distinct namespaces for aria-controls/labelledby.
let nextEditorId = 0;

/**
 * Build the DOM skeleton for an editor session.
 *
 * The editor's own structure is namespaced `kalotyp-*`. Two class tokens are
 * the exception — `pintura-editor` on the host and `PinturaModal` on the modal
 * wrapper. Ghost's runtime looks those up by name (the host class scopes Ghost's
 * theme-variable overrides; the modal class is what Ghost's close-button click
 * handler selects on), so they exist purely for Ghost compatibility — not as
 * branding, and implying no affiliation with or endorsement by the editor Ghost
 * named them after. See `docs/ghost-contract.md`. The integration breaks if
 * those two tokens change.
 *
 * The util-main `aria-labelledby` is updated on tab switch by `setActiveUtilityButton`
 * to complete the tablist/tab/tabpanel triple.
 */
export function buildShellDom(options: BuildShellDomOptions): ShellDom {
  const editorId = `kalotyp-editor-${++nextEditorId}`;
  const titleId = `${editorId}-title`;

  const editor = document.createElement('div');
  // `pintura-editor`: Ghost-compatibility hook only (theme-variable scope), not
  // branding and no affiliation/endorsement implied. See the file docblock.
  editor.className = 'pintura-editor kalotyp-editor';
  editor.id = editorId;
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-modal', 'true');
  editor.setAttribute('aria-labelledby', titleId);
  // tabindex=-1 so the focus trap lands initial focus on the dialog root, not the close button.
  editor.tabIndex = -1;

  const title = document.createElement('h2');
  title.id = titleId;
  title.className = 'kalotyp-visually-hidden';
  title.textContent = 'Image editor';

  // `PinturaModal`: Ghost-compatibility hook only — Ghost's body-level click
  // handler selects on `.PinturaModal button[title="Close"]` to detect explicit
  // closes. Not branding, no affiliation/endorsement implied. See the file
  // docblock and docs/ghost-contract.md (Dismissal).
  const modal = document.createElement('div');
  modal.className = 'PinturaModal kalotyp-modal';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.title = 'Close';
  closeButton.setAttribute('aria-label', 'Close image editor');
  closeButton.className = 'kalotyp-button-close';
  closeButton.innerHTML = icon('close');

  const prefsButton = document.createElement('button');
  prefsButton.type = 'button';
  prefsButton.title = 'Preferences';
  prefsButton.setAttribute('aria-label', 'Open editor preferences');
  prefsButton.setAttribute('aria-haspopup', 'dialog');
  prefsButton.className = 'kalotyp-button-prefs';
  prefsButton.innerHTML = icon('settings');

  const root = document.createElement('div');
  root.className = 'kalotyp-root';
  root.setAttribute('data-env', 'landscape has-navigation');

  const main = document.createElement('div');
  main.className = 'kalotyp-main';

  const stage = document.createElement('div');
  stage.className = 'kalotyp-stage';
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', 'Image preview');

  const utilMain = document.createElement('div');
  utilMain.id = `${editorId}-panel`;
  utilMain.className = 'kalotyp-util-main';
  utilMain.setAttribute('role', 'tabpanel');
  utilMain.setAttribute('tabindex', '0');

  const navTools = document.createElement('div');
  navTools.className = 'kalotyp-nav-tools';

  const utilFooter = document.createElement('div');
  utilFooter.className = 'kalotyp-util-footer';

  const exportGroup = document.createElement('div');
  exportGroup.className = 'kalotyp-export-group';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'kalotyp-button-export';
  const exportInner = document.createElement('span');
  exportInner.className = 'kalotyp-button-inner';
  exportInner.textContent = options.exportLabel;
  exportButton.appendChild(exportInner);

  const outputSettingsButton = document.createElement('button');
  outputSettingsButton.type = 'button';
  outputSettingsButton.className = 'kalotyp-button-output-settings';
  outputSettingsButton.title = 'Output settings';
  outputSettingsButton.setAttribute('aria-label', 'Output settings (format and quality)');
  outputSettingsButton.setAttribute('aria-haspopup', 'dialog');
  outputSettingsButton.setAttribute('aria-expanded', 'false');
  outputSettingsButton.innerHTML = icon('chevronDown');

  exportGroup.appendChild(exportButton);
  exportGroup.appendChild(outputSettingsButton);
  utilFooter.appendChild(exportGroup);

  // aria-atomic so screen readers read the whole message, not just diffed tokens.
  const liveRegion = document.createElement('div');
  liveRegion.className = 'kalotyp-visually-hidden';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');

  main.appendChild(stage);
  main.appendChild(utilMain);

  root.appendChild(navTools);
  root.appendChild(main);
  root.appendChild(utilFooter);

  modal.appendChild(title);
  modal.appendChild(prefsButton);
  modal.appendChild(closeButton);
  modal.appendChild(root);
  modal.appendChild(liveRegion);

  editor.appendChild(modal);

  return {
    editor,
    modal,
    root,
    main,
    stage,
    navTools,
    utilMain,
    utilFooter,
    closeButton,
    prefsButton,
    exportButton,
    outputSettingsButton,
    liveRegion,
    titleId,
  };
}
