# @magicpages/kalotyp-ui

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
