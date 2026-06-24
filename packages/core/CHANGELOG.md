# @magicpages/kalotyp-core

## 0.2.0

### Minor Changes

- fc7350d: Add an emoji sticker tool to the annotate utility. A new Emoji tool opens a searchable picker (the full set, with category tabs) and places the chosen emoji on the image as its own object: click to place, drag to move, drag a corner to resize uniformly, and drag the rotate handle (or type an angle) to rotate. Emojis render as OpenMoji vector artwork — crisp at any size and identical across platforms — loaded on demand from same-origin assets shipped with the package, with the OS emoji font as a fallback. The picker scrolls without zooming the image.
- 7e4c16f: Rework the text annotation tool. Text shapes gain a font family picker (the same set Ghost loads from fonts.bunny.net), bold/italic toggles, alignment buttons, and a font-size control in the panel. Clicking an existing text annotation with the text tool re-opens its editor instead of stacking a new one, and the inline editor no longer shows a duplicate selection frame while editing. Text size is set from the panel rather than by dragging handles.

## 0.1.2

### Patch Changes

- 12ac8f6: Upgrade the build toolchain to latest stable (TypeScript 6, Vite 8, Vitest 4, Biome 2.4, jsdom 29) and clear all dependency audit alerts. No public API or runtime behaviour changes; the Ghost bundle still ships `kalotyp.js` plus a standalone `kalotyp.css`.

## 0.1.1

### Patch Changes

- Fix the published dependency ranges. 0.1.0 was published with `npm publish`,
  which left the internal `workspace:*` protocol in the manifests verbatim, so
  `npm install @magicpages/kalotyp` failed with `EUNSUPPORTEDPROTOCOL`. Republished
  via `pnpm publish`, which rewrites those to real version ranges. (The CDN bundle
  was unaffected — it inlines its dependencies at build time.)

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
