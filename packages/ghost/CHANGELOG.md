# @magicpages/kalotyp

## 0.2.2

### Patch Changes

- 770597d: Keep emoji stickers crisp by clamping their maximum size. Emoji render with the OS colour-emoji font, which is bitmap on macOS/iOS (Apple Color Emoji, ~160px strikes) and Android/Linux (Noto); drawing a glyph larger than its native strike just upscales the bitmap and blurs. Emoji boxes are now capped at `EMOJI_MAX_SIZE` (160px, image-space) everywhere they're sized — the default placement size, corner-handle resize, and the Size coordinate input — so a sticker is never drawn past its crisp resolution. (Closes #31.)
- d038279: Emoji now work with **no bundled artwork and no CDN** on the documented "upload the JS + CSS" setup. The emoji picker previously rendered each cell as an OpenMoji SVG `<img>`; where those SVGs aren't served next to the bundle (e.g. only the two files were uploaded into Ghost's integration settings, without the sibling `emoji/` directory) the cells showed broken images. The picker now renders the OS native colour-emoji glyph as the base and only reveals the OpenMoji SVG when that artwork actually loads — matching the canvas, which already falls back to the same OS font. Result: the picker and the baked image are consistent everywhere, crisp OpenMoji is used wherever the `emoji/` directory is served, and the bundle stays ~76 KB gzip (nothing embedded, no third-party request).
- Updated dependencies [770597d]
- Updated dependencies [d038279]
  - @magicpages/kalotyp-core@0.2.2
  - @magicpages/kalotyp-ui@0.2.2

## 0.2.1

### Patch Changes

- 58ab95a: Fix an annotate selection glitch where the coordinate inputs (X / Y / Size / Angle) trapped focus. After typing a value and committing with Enter the field kept focus, so a subsequent drag-resize on the canvas left the Size field frozen at the typed value (it only refreshed after clicking outside the canvas), and Delete/Backspace edited the number field instead of removing the selected annotation. A pointer interaction on the stage now blurs a focused coordinate input, so the field syncs live with the drag, Delete removes the shape, and the selection no longer feels "stuck". Typing a value and pressing Delete _inside_ the field still edits the number, as before.
- e5dd04c: Fix two annotate bugs:

  - **Text:** pressing Enter now inserts a newline (text annotations are multi-line). Commit the text by clicking outside the editor or with Cmd/Ctrl+Enter — previously Enter closed the editor. Multi-line text, including empty and trailing lines, now stays aligned with the caret while editing (the inline editor is a `<textarea>`, so its content round-trips as clean `\n` text instead of drifting).
  - **Emoji:** artwork now loads from the same origin the bundle was served from — the editor resolves the `emoji/` directory relative to its own URL (`import.meta.url`), so stickers work out of the box on hosted installs with no CDN and no per-site config. Previously the default `/emoji/` path resolved against the Ghost site root and 404'd. The Ghost bundle is now published as an ES module (every host already loads it via dynamic `import()`); to serve the SVGs from elsewhere, set `window.__KALOTYP_EMOJI_BASE__` or call `setEmojiAssetBase`.

- Updated dependencies [58ab95a]
- Updated dependencies [e5dd04c]
  - @magicpages/kalotyp-ui@0.2.1
  - @magicpages/kalotyp-core@0.2.1

## 0.2.0

### Minor Changes

- fc7350d: Add an emoji sticker tool to the annotate utility. A new Emoji tool opens a searchable picker (the full set, with category tabs) and places the chosen emoji on the image as its own object: click to place, drag to move, drag a corner to resize uniformly, and drag the rotate handle (or type an angle) to rotate. Emojis render as OpenMoji vector artwork — crisp at any size and identical across platforms — loaded on demand from same-origin assets shipped with the package, with the OS emoji font as a fallback. The picker scrolls without zooming the image.
- 7e4c16f: Rework the text annotation tool. Text shapes gain a font family picker (the same set Ghost loads from fonts.bunny.net), bold/italic toggles, alignment buttons, and a font-size control in the panel. Clicking an existing text annotation with the text tool re-opens its editor instead of stacking a new one, and the inline editor no longer shows a duplicate selection frame while editing. Text size is set from the panel rather than by dragging handles.

### Patch Changes

- Updated dependencies [fc7350d]
- Updated dependencies [7e4c16f]
  - @magicpages/kalotyp-core@0.2.0
  - @magicpages/kalotyp-ui@0.2.0

## 0.1.2

### Patch Changes

- 12ac8f6: Upgrade the build toolchain to latest stable (TypeScript 6, Vite 8, Vitest 4, Biome 2.4, jsdom 29) and clear all dependency audit alerts. No public API or runtime behaviour changes; the Ghost bundle still ships `kalotyp.js` plus a standalone `kalotyp.css`.
- Updated dependencies [12ac8f6]
  - @magicpages/kalotyp-core@0.1.2
  - @magicpages/kalotyp-ui@0.1.2

## 0.1.1

### Patch Changes

- Fix the published dependency ranges. 0.1.0 was published with `npm publish`,
  which left the internal `workspace:*` protocol in the manifests verbatim, so
  `npm install @magicpages/kalotyp` failed with `EUNSUPPORTEDPROTOCOL`. Republished
  via `pnpm publish`, which rewrites those to real version ranges. (The CDN bundle
  was unaffected — it inlines its dependencies at build time.)
- Updated dependencies
  - @magicpages/kalotyp-core@0.1.1
  - @magicpages/kalotyp-ui@0.1.1

## 0.1.0

### Minor Changes

- d38e55b: First public release of Kalotyp — an MIT-licensed image editor that drops into Ghost CMS through the standard Settings → Integrations → Pintura flow.

  What's in v0.1.0:

  - **The integration contract.** Kalotyp satisfies the integration surface Ghost's admin actually invokes: `window.pintura.openDefaultEditor`, the `process` event with a `{ dest: File }` payload, the `loaderror` and `willClose` callbacks, every documented option key, the two class hooks Ghost's runtime requires to theme and dismiss the editor, and the locale callbacks Ghost uses to override frame preset labels. Everything else Kalotyp renders uses its own `kalotyp-*` namespace. No changes to Ghost itself are required.
  - **A focused tool set.** Crop (with aspect-ratio presets), rotate (quarter-turn + free-angle straighten), flip, resize, finetune (six tone adjustments), six filter presets, annotate (text /rect / ellipse / arrow / freehand / highlight), redact (pixelate / blur / solid fill), frame (five presets with colour control).
  - **A destructive-edit model.** Each tool, when you leave its tab, bakes its result into a working image. The next tool sees the baked composite. The save chain is the order you actually used the tools.
  - **Editor extras beyond the contract.** Output popover with format conversion (Auto / PNG / JPEG / WebP / AVIF) and a quality slider, EXIF auto-orient on load, per-site Preferences in LocalStorage,and a keyboard cheatsheet (`?`).
  - **Accessibility.** Full keyboard surface (Tab through controls, arrow-key nudging for annotations and redactions, keyboard placement of shapes, Esc to dismiss, Ctrl+Z / Ctrl+Shift+Z undo / redo). Focus trap, polite live region announcer, ARIA dialog / tablist / tabpanel / radiogroup wiring. axe-core clean on every surface.
  - **Mobile.** Touch-emulated viewport gestures, WCAG 2.5.5 touch targets, responsive layout for narrow screens.
  - **Engineered for adoption.** Under 50 KB gzipped (budget 300 KB), no runtime dependencies in the published bundle, no telemetry, no license keys.

  Install: upload `kalotyp.js` and `kalotyp.css` to Ghost's **Settings → Integrations → Pintura**, toggle the integration on, save. That's the entire setup.

### Patch Changes

- Updated dependencies [d38e55b]
  - @magicpages/kalotyp-core@0.1.0
  - @magicpages/kalotyp-ui@0.1.0
