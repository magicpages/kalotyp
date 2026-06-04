import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

/**
 * axe-core accessibility gate. Runs against the modal chrome and every
 * plugin panel via the standalone axe-host page (no Ghost needed) and
 * fails CI on any violation. Chromium-only — axe checks DOM/ARIA, not
 * engine rendering. Scoped to `.pintura-editor` and WCAG 2.1 AA only.
 */

const AXE_BUILDER_OPTIONS = {
  wcagTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const,
};

test.use({ baseURL: 'http://localhost:5175' });

async function openEditor(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as { openEditor?: unknown }).openEditor === 'function',
  );
  await page.evaluate(() => (window as unknown as { openEditor: () => void }).openEditor());
  await expect(page.locator('.pintura-editor')).toBeVisible();
  // Wait until nav buttons are enabled (image loaded).
  await expect(page.locator('.kalotyp-util-nav-button[data-utility-id="crop"]')).not.toBeDisabled();
}

async function runAxe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('.pintura-editor')
    .withTags([...AXE_BUILDER_OPTIONS.wcagTags])
    .analyze();
  if (results.violations.length > 0) {
    const summary = results.violations
      .map(
        (v) => `  - [${v.id}] ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`,
      )
      .join('\n');
    throw new Error(
      `axe-core found ${results.violations.length} violation(s) on ${label}:\n${summary}`,
    );
  }
}

const PLUGIN_TABS = [
  'crop',
  'rotate',
  'flip',
  'filter',
  'finetune',
  'annotate',
  'redact',
  'resize',
  'frame',
] as const;

test.describe('axe-core: every editor surface', () => {
  test('initial editor mount', async ({ page }) => {
    await openEditor(page);
    await runAxe(page, 'initial mount (crop tab active)');
  });

  for (const tab of PLUGIN_TABS) {
    test(`${tab} panel`, async ({ page }) => {
      await openEditor(page);
      await page.locator(`.kalotyp-util-nav-button[data-utility-id="${tab}"]`).click();
      // Some panels render async content (e.g. filter thumbnails).
      await page.waitForTimeout(100);
      await runAxe(page, `${tab} panel`);
    });
  }
});
