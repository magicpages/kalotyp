import { buildShellDom, type ShellDom } from './dom/build-shell-dom.js';

export interface ShellOptions {
  host: HTMLElement;
  exportLabel: string;
  onExportClick: () => void;
  onCloseClick: () => void;
  onOutputSettingsClick: () => void;
  onPrefsClick: () => void;
}

export interface ShellHandle {
  readonly editor: HTMLElement;
  readonly modal: HTMLElement;
  readonly root: HTMLElement;
  readonly exportButton: HTMLButtonElement;
  /** Caret button next to Save — opens the output-format popover. */
  readonly outputSettingsButton: HTMLButtonElement;
  /** Gear button next to close — opens the Preferences modal. */
  readonly prefsButton: HTMLButtonElement;
  readonly closeButton: HTMLButtonElement;
  readonly stage: HTMLElement;
  readonly utilMain: HTMLElement;
  readonly navTools: HTMLElement;
  /** Polite live-region announcer; identical messages re-announce via a trailing-space flip (NVDA/JAWS suppress duplicate text). */
  announce(message: string): void;
  destroy(): void;
}

export function mountShell(options: ShellOptions): ShellHandle {
  const dom: ShellDom = buildShellDom({ exportLabel: options.exportLabel });

  const onExport = () => options.onExportClick();
  const onClose = () => options.onCloseClick();
  const onOutputSettings = () => options.onOutputSettingsClick();
  const onPrefs = () => options.onPrefsClick();
  dom.exportButton.addEventListener('click', onExport);
  dom.closeButton.addEventListener('click', onClose);
  dom.outputSettingsButton.addEventListener('click', onOutputSettings);
  dom.prefsButton.addEventListener('click', onPrefs);

  options.host.appendChild(dom.editor);

  // NVDA/JAWS suppress identical-text updates in live regions; flip a trailing space to force re-announce.
  let announceFlip = false;
  function announce(message: string): void {
    announceFlip = !announceFlip;
    dom.liveRegion.textContent = announceFlip ? `${message} ` : message;
  }

  return {
    editor: dom.editor,
    modal: dom.modal,
    root: dom.root,
    exportButton: dom.exportButton,
    outputSettingsButton: dom.outputSettingsButton,
    prefsButton: dom.prefsButton,
    closeButton: dom.closeButton,
    stage: dom.stage,
    utilMain: dom.utilMain,
    navTools: dom.navTools,
    announce,
    destroy() {
      dom.exportButton.removeEventListener('click', onExport);
      dom.closeButton.removeEventListener('click', onClose);
      dom.outputSettingsButton.removeEventListener('click', onOutputSettings);
      dom.prefsButton.removeEventListener('click', onPrefs);
      dom.editor.remove();
    },
  };
}
