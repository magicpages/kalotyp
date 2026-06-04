import { describe, expect, it } from 'vitest';
import { buildShellDom } from './build-shell-dom.js';

describe('buildShellDom', () => {
  it('produces an outer host element with the .pintura-editor class', () => {
    const dom = buildShellDom({ exportLabel: 'Save and close' });
    expect(dom.editor.classList.contains('pintura-editor')).toBe(true);
  });

  it('mounts a layout root with the expected data-env tokens', () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    expect(dom.root.classList.contains('kalotyp-root')).toBe(true);
    const tokens = (dom.root.getAttribute('data-env') ?? '').split(/\s+/);
    expect(tokens).toContain('landscape');
    expect(tokens).toContain('has-navigation');
  });

  it("exposes a .PinturaModal containing a close button matching Ghost's click selector", () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    const match = dom.editor.querySelector('.PinturaModal button[title="Close"]');
    expect(match).toBe(dom.closeButton);
  });

  it('places the export button + inner span pair inside the export group', () => {
    const dom = buildShellDom({ exportLabel: 'Save and close' });
    expect(dom.exportButton.classList.contains('kalotyp-button-export')).toBe(true);
    const inner = dom.exportButton.querySelector('.kalotyp-button-inner');
    expect(inner?.textContent).toBe('Save and close');
  });

  it('emits the layout containers under the kalotyp-root', () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    expect(dom.editor.querySelector('.kalotyp-root > .kalotyp-main')).not.toBeNull();
    expect(dom.editor.querySelector('.kalotyp-root .kalotyp-stage')).not.toBeNull();
    expect(dom.editor.querySelector('.kalotyp-root > .kalotyp-nav-tools')).not.toBeNull();
    expect(dom.editor.querySelector('.kalotyp-util-main')).not.toBeNull();
    expect(dom.editor.querySelector('.kalotyp-util-footer')).not.toBeNull();
  });

  it('labels the dialog with a hidden heading via aria-labelledby', () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    expect(dom.editor.getAttribute('role')).toBe('dialog');
    expect(dom.editor.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dom.editor.getAttribute('aria-labelledby');
    expect(labelledBy).toBe(dom.titleId);
    const title = dom.editor.querySelector(`#${dom.titleId}`);
    expect(title?.textContent).toBe('Image editor');
  });

  it('mounts a polite live region for one-shot announcements', () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    expect(dom.liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(dom.liveRegion.getAttribute('aria-atomic')).toBe('true');
    // The live region lives inside the dialog so screen readers read it
    // without leaving the dialog landmark.
    expect(dom.editor.contains(dom.liveRegion)).toBe(true);
  });

  it('marks the util-main slot as a tabpanel', () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    expect(dom.utilMain.getAttribute('role')).toBe('tabpanel');
    expect(dom.utilMain.id).toMatch(/-panel$/);
  });

  it('gives the stage a region role with a meaningful label', () => {
    const dom = buildShellDom({ exportLabel: 'Save' });
    expect(dom.stage.getAttribute('role')).toBe('region');
    expect(dom.stage.getAttribute('aria-label')).toBe('Image preview');
  });

  it('gives sequential editor instances unique title ids', () => {
    const a = buildShellDom({ exportLabel: 'Save' });
    const b = buildShellDom({ exportLabel: 'Save' });
    expect(a.titleId).not.toBe(b.titleId);
  });

  it('pairs the export button with an output-settings caret', () => {
    const dom = buildShellDom({ exportLabel: 'Save and close' });
    expect(dom.outputSettingsButton.classList.contains('kalotyp-button-output-settings')).toBe(
      true,
    );
    expect(dom.outputSettingsButton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dom.outputSettingsButton.getAttribute('aria-expanded')).toBe('false');
    // Both buttons share the same group container so they read as a split button.
    const group = dom.exportButton.parentElement;
    expect(group?.classList.contains('kalotyp-export-group')).toBe(true);
    expect(group?.contains(dom.outputSettingsButton)).toBe(true);
  });
});
