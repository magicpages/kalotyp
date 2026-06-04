import { expect, type Page, test } from '@playwright/test';

/**
 * Keyboard-only end-to-end: open → crop → rotate → annotate → finetune
 * → save, using only Tab / arrow keys / typed values. Runs against the
 * axe-host page (no Ghost needed). Chromium-only — keyboard semantics
 * are identical across engines.
 */

test.use({ baseURL: 'http://localhost:5175' });

async function openEditorViaKeyboard(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as { openEditor?: unknown }).openEditor === 'function',
  );
  await page.locator('#open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pintura-editor')).toBeVisible();
  await expect(page.locator('.kalotyp-util-nav-button[data-utility-id="crop"]')).not.toBeDisabled();
}

test('keyboard-only: open → crop → rotate → annotate → finetune → save', async ({ page }) => {
  await openEditorViaKeyboard(page);

  // Focus lands on the editor host or a descendant (dialog root).
  await expect(page.locator('.pintura-editor:focus, .pintura-editor :focus')).toHaveCount(1);

  // ----- Crop: type a 600x400 rect. -----
  // Focusing the input directly mirrors a screen-reader user's
  // form-field quick-key path and avoids counting Tabs.
  await page.locator('.kalotyp-crop-dims-input[aria-label="Width (pixels)"]').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('600');
  await page.keyboard.press('Tab'); // Commit on blur

  await page.locator('.kalotyp-crop-dims-input[aria-label="Height (pixels)"]').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('400');
  await page.keyboard.press('Tab');

  // ----- Switch to Rotate via the tablist's keyboard nav. -----
  await page.locator('.kalotyp-util-nav-button[data-utility-id="crop"]').focus();
  // Roving-tabindex with automatic activation: ArrowRight moves and
  // activates the next tab.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(':focus')).toHaveAttribute('data-utility-id', 'rotate');
  await expect(page.locator('.kalotyp-rotate-panel')).toBeVisible();

  await page.locator('.kalotyp-rotate-input').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('15');
  await page.keyboard.press('Tab');

  // ----- Switch to Annotate via the tablist. -----
  await page.locator('.kalotyp-util-nav-button[data-utility-id="rotate"]').focus();
  await page.keyboard.press('ArrowRight'); // flip
  await page.keyboard.press('ArrowRight'); // filter
  await page.keyboard.press('ArrowRight'); // finetune
  await page.keyboard.press('ArrowRight'); // annotate
  await expect(page.locator(':focus')).toHaveAttribute('data-utility-id', 'annotate');
  await expect(page.locator('.kalotyp-annotate-panel')).toBeVisible();

  // Set a colour via the hex input (keyboard-accessible alternative).
  await page.locator('.kalotyp-annotate-hex').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('#ff3300');
  await page.keyboard.press('Tab');
  await expect(page.locator('.kalotyp-annotate-hex')).toHaveValue('#ff3300');

  // Keyboard-driven annotation placement: select tool → Insert →
  // type into a coordinate input → verify value persists.
  for (const tool of ['rect', 'ellipse', 'arrow'] as const) {
    await page.locator(`.kalotyp-annotate-tool[data-tool="${tool}"]`).focus();
    await page.keyboard.press('Enter');
    const insertButton = page.locator('.kalotyp-annotate-insert');
    await expect(insertButton).toBeEnabled();
    await insertButton.focus();
    await page.keyboard.press('Enter');
    const coordsRow = page.locator('.kalotyp-annotate-coords');
    await expect(coordsRow).toBeVisible();
    const inputs = coordsRow.locator('.kalotyp-annotate-coords-input');
    await expect(inputs.first()).toBeVisible();
    await inputs.first().focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('120');
    await page.keyboard.press('Tab');
    await expect(inputs.first()).toHaveValue('120');
  }

  // Text path: Insert opens the inline editor, focus enters a
  // contenteditable, Enter commits.
  await page.locator('.kalotyp-annotate-tool[data-tool="text"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.kalotyp-annotate-insert').focus();
  await page.keyboard.press('Enter');
  const textEditor = page.locator('.kalotyp-annotate-text-editor');
  await expect(textEditor).toBeVisible();
  await page.keyboard.type('Hello');
  await expect(textEditor).toHaveText('Hello');
  await page.keyboard.press('Enter');
  await expect(textEditor).toBeHidden();

  // ----- Switch to Finetune. -----
  await page.locator('.kalotyp-util-nav-button[data-utility-id="annotate"]').focus();
  await page.keyboard.press('ArrowLeft'); // back to finetune
  await expect(page.locator(':focus')).toHaveAttribute('data-utility-id', 'finetune');
  await expect(page.locator('.kalotyp-finetune-panel')).toBeVisible();
  // Set saturation via the typed-number row alongside the slider.
  await page.locator('.kalotyp-finetune-input[aria-label="Saturation value"]').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('25');
  await page.keyboard.press('Tab');

  // ----- Switch to Redact and place a region via Insert. -----
  await page.locator('.kalotyp-util-nav-button[data-utility-id="finetune"]').focus();
  await page.keyboard.press('ArrowRight'); // annotate
  await page.keyboard.press('ArrowRight'); // redact
  await expect(page.locator(':focus')).toHaveAttribute('data-utility-id', 'redact');
  await expect(page.locator('.kalotyp-redact-panel')).toBeVisible();

  await page.locator('.kalotyp-redact-insert').focus();
  await page.keyboard.press('Enter');
  const redactCoordsRow = page.locator('.kalotyp-redact-coords');
  await expect(redactCoordsRow).toBeVisible();
  const widthInput = redactCoordsRow.locator('.kalotyp-redact-coords-input[data-field="width"]');
  await widthInput.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('250');
  await page.keyboard.press('Tab');
  await expect(widthInput).toHaveValue('250');

  // ----- Switch to Frame and pick a preset. -----
  await page.locator('.kalotyp-util-nav-button[data-utility-id="redact"]').focus();
  await page.keyboard.press('ArrowRight'); // resize
  await page.keyboard.press('ArrowRight'); // frame
  await expect(page.locator(':focus')).toHaveAttribute('data-utility-id', 'frame');
  await expect(page.locator('.kalotyp-frame-panel')).toBeVisible();
  // Strip is a radiogroup; focus a thumb and press Enter to pick it.
  const polaroidThumb = page.locator('.kalotyp-frame-thumb[data-preset-id="polaroid"]');
  await polaroidThumb.focus();
  await page.keyboard.press('Enter');
  await expect(polaroidThumb).toHaveAttribute('aria-checked', 'true');

  // ----- Save: focus the export button, press Enter. -----
  await page.locator('.kalotyp-button-export').focus();
  await page.keyboard.press('Enter');

  // Editor closes after a successful save (contract §4.2).
  await expect(page.locator('.pintura-editor')).toHaveCount(0);
});
