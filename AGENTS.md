# AGENTS.md

Guidance for AI coding agents (and humans skimming for the rules) working in
the Kalotyp repository. This is the canonical instruction file; `CLAUDE.md`
points here.

Kalotyp is an open-source, MIT-licensed image editor for Ghost CMS, published as
`@magicpages/kalotyp-core` / `@magicpages/kalotyp-ui` / `@magicpages/kalotyp-ghost`.
Self-hosted Ghost users upload `kalotyp.js` and `kalotyp.css` through
**Settings → Integrations → Pintura**, toggle the integration on, and get image
editing in the post editor with **zero changes** to Ghost itself. ("Pintura" is
the name of Ghost's built-in image-editor integration slot — see Legal below.)

This is a working codebase. The notes below describe what's actually here.

## Setup & build

- **pnpm** workspaces. Install with `pnpm install`.
- `pnpm dev` — Vite dev playground (`apps/playground`), no Ghost needed.
- `pnpm build` — library build of the three published packages via Vite.
- `pnpm test` — Vitest unit tests across core / ui / ghost.
- `pnpm typecheck` — `tsc --noEmit` per package.
- `pnpm lint` — Biome check (lint + format). `pnpm lint:fix` to apply.
- `pnpm size` — bundle-size budget check.
- `pnpm test:e2e` — Playwright against a real containerised Ghost
  (`apps/ghost-test`; needs Docker + admin creds).

## Tech stack

- **TypeScript, strict mode.** No `any`, no unexplained `as` casts.
- **Vanilla DOM + plain CSS** for the UI. No React/Vue/Angular or framework
  runtime in the bundle — the single most important decision for the
  bundle-size budget.
- **Canvas 2D + OffscreenCanvas where supported.** No WebGL.
- **No Fabric.js, Konva, or Pixi.** The small subset we need is hand-written.
- **Vite** build (library mode), **Vitest** unit tests, **Playwright** E2E,
  **Biome** lint/format, **Changesets** versioning (the three published
  packages are linked at one shared version).

## Architecture

```
kalotyp/
├── packages/
│   ├── core/                 # framework-agnostic editor engine
│   │   └── src/
│   │       ├── canvas/       # image loading, viewport, bake
│   │       ├── events/       # event bus
│   │       ├── geometry/     # rect/point/size math
│   │       ├── history/      # snapshot-based undo/redo
│   │       ├── output/       # output state (mime + quality + strip-metadata)
│   │       ├── pipeline/     # chain runner, encoder, EXIF copier
│   │       ├── plugins/      # per-tool state + bake (no DOM here)
│   │       │   ├── crop/ rotate/ flip/ resize/ finetune/
│   │       │   ├── filter/   # shares finetune state via presets
│   │       │   ├── annotate/ redact/ frame/
│   │       └── state/        # observable store primitive
│   ├── ui/                   # default UI — DOM + plain CSS, no framework
│   │   └── src/
│   │       ├── canvas/       # render helpers for the stage
│   │       ├── cheatsheet/   # `?` keyboard cheatsheet modal
│   │       ├── dom/          # shell, focus trap, nested-modal helper
│   │       ├── output/       # save-caret popover
│   │       ├── preferences/  # per-site preferences modal + storage
│   │       ├── plugins/      # per-tool mount + panel DOM + CSS
│   │       └── styles/       # base / mobile / per-plugin stylesheets
│   └── ghost/                # Ghost adapter — produces dist/kalotyp.{js,css}
│       └── src/
│           ├── editor.ts     # the session — destructive-edit model
│           ├── install-global.ts  # sets window.pintura
│           ├── contract.ts   # public-facing types
│           ├── default-presets.ts
│           └── source-image.ts
├── apps/
│   ├── playground/           # Vite dev harness — no Ghost needed
│   └── ghost-test/           # docker-compose Ghost + Playwright E2E
└── docs/
    └── ghost-contract.md     # the spec, cited line-for-line from Ghost
```

### The session model: destructive-edit on tab switch

When the user leaves a tab with dirty plugin state, `commitActiveIntoChain` runs
that plugin's `bake` against the current working image, appends `(id, state)` to
a chain, and resets the plugin's store. The next tab mounts on the now-baked
working image. The save chain is the order the user actually used the tools —
there is no fixed chain order.

Implications: each plugin's state shape is what gets baked, not what later tools
read. Filter is a UI tab that shares the finetune slot's store, and its commit
path is remapped to bake through the finetune slot (its own bake is identity).
Undo restores both the chain and per-plugin state in one step; snapshots carry
the chain under a private `'__committedChain__'` key (see `captureSnapshot` /
`applyHistoryResult` in `editor.ts`).

### The split between `core`, `ui`, and `ghost`

Deliberate. The Ghost bundle composes the other two; a future host could ship a
different UI without touching the engine.

## The Ghost integration contract

`docs/ghost-contract.md` is the canonical reference, cited line-for-line to
`../core/ghost/admin/` (a `TryGhost/Ghost` checkout). Read it before changing
anything in `packages/ghost/`. **When uncertain about the contract, grep
`../core/ghost/`, not your memory.**

In one paragraph: Ghost loads the editor as an ES module via dynamic `import()`
from a URL stored in `settings.pinturaJsUrl`. The module assigns itself to
`window.pintura`, exposing a single entry point `openDefaultEditor(options)`.
The returned instance exposes `.on(name, handler)` for `loaderror` and
`process`. Save fires `process` with a `{ dest: File }` payload that Ghost POSTs
to `/ghost/api/admin/images/upload`. Ghost reads four CSS custom properties for
theming. The editor applies two Ghost-named class hooks — `.pintura-editor`
(theme-variable scope) and `.PinturaModal` (close-button detection) — and styles
everything else through its own `kalotyp-*` namespace. There is no
`appendDefaultEditor`, no `getEditorDefaults` — only `openDefaultEditor`.

## Feature scope

Tools shipped (each matches a `utils[]` entry Ghost passes; `'trim'` is in
Ghost's list but never invoked on images, so it isn't implemented):

- **Crop** — free crop, aspect-ratio presets, pointer-drag handles,
  keyboard-accessible coord inputs.
- **Rotate** — quarter-turn (lossless) and free-angle straighten (−45°…+45°).
- **Flip** — independent horizontal and vertical mirror.
- **Resize** — `scaleX` / `scaleY` with chain-link aspect lock, 8000 px max.
- **Finetune** — six tone adjustments: brightness, contrast, saturation,
  exposure, clarity, gamma.
- **Filter** — six presets implemented by writing into the finetune store.
- **Annotate** — text / rect / ellipse / arrow / freehand / highlight, with
  selection, drag, nudge, mirror/rotate-with-canvas.
- **Redact** — pixelate / blur / solid-fill regions.
- **Frame** — preset borders plus colour control.

Editor extras (opt-in, behind the editor's existing surface): the Save-caret
output popover (format conversion + quality slider + strip-metadata toggle, which
preserves source EXIF on JPEG → JPEG); EXIF auto-orient on load via
`createImageBitmap(blob, { imageOrientation: 'from-image' })`; a per-site
Preferences modal (LocalStorage, scoped by origin + Ghost content-root); and the
`?` keyboard cheatsheet.

## Code style & conventions

- TypeScript strict mode. No `any`. No `as` casts unless paired with a comment.
- Files: kebab-case. Classes: PascalCase. Functions/variables: camelCase.
  Constants: UPPER_SNAKE.
- One module = one job. Files over 300 lines get split.
- **Internal barrel files are forbidden** (e.g. a `plugins/index.ts` re-exporting
  everything) — they break tree-shaking on the consumer side. The published
  package's *root* `index.ts` is the one intentional exception: it IS the
  package's stable API surface (see the docblock atop `packages/core/src/index.ts`).
- Public APIs documented with TSDoc. Internal code: comment only when behaviour
  isn't obvious.
- Tests live next to the file they test: `crop.ts` and `crop.test.ts` in the
  same directory.

## Testing & quality bar

Non-negotiable for the published bundle:

- Bundle size: < 300 KB gzipped for `kalotyp.js + kalotyp.css` combined
  (currently ~47 KB).
- 60fps for all transformations on a 4000×3000 image, mid-range 2020-era Android.
- Test coverage: > 85% on the core engine, > 70% overall.
- E2E passes inside a real Ghost (`apps/ghost-test`), chromium + mobile-chromium.
- Accessibility: axe-core zero violations on every UI surface; full keyboard-only
  walkthrough green.
- Zero `any` types and zero runtime dependencies in published code.

CI enforces lint, typecheck, test, build, bundle-size budget, and the axe /
keyboard-only Playwright projects.

### What "done" looks like

1. Tests cover the change (new behaviour → new tests; bug fixes → regression tests).
2. `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass.
3. `pnpm build` produces output; `pnpm size` stays under budget.
4. Public-API changes update `docs/ghost-contract.md` if they touch the contract.
5. User-visible changes add a changeset (`pnpm changeset`).
6. The Ghost E2E suite still passes (`pnpm test:e2e`).

## Commit & PR conventions

- Commits follow Conventional Commits (the Changesets workflow expects this).
- Every PR that changes published code adds a changeset.
- Prefer small commits — one logical change each, so reviewers can read the diff.
- No AI attribution in commit messages.

## How to work in this codebase

- **Always start by reading.** Before changing a file, read it, its tests, and
  the neighbours that import from it. Don't pattern-match from the filename.
- **Run the tests before and after.** If tests fail before your change, that's a
  separate issue — flag it.
- **Don't add dependencies casually.** Every dependency is a permanent
  maintenance and bundle-size cost; justify it.
- **Don't "improve" code outside your task's scope.** File an issue instead.
- Lead with the recommendation, then the reasoning. For hard-to-reverse
  architectural decisions, stop and discuss first, then leave a load-bearing
  inline comment at the call site explaining *why*.

## Legal & clean-room policy

**Read this before writing any code.** It is load-bearing — for the project's
legal protection, not just style.

Kalotyp is an **independent, clean-room implementation** of the image-editor
integration contract Ghost's admin expects from a module. It is not a clone,
port, fork, or rewrite of any other editor. The discipline that keeps it
defensible:

- **Never** read another image editor's source (compiled, minified, decompiled,
  or any form) at any point in this project. If such a snippet is shared in a
  chat, refuse to use it and explain why.
- **Don't** copy another editor's UI layouts, panel arrangements, colour palette,
  iconography, or visual identity. Match function (a crop tool exists), not form.
- **Don't** frame Kalotyp in relation to, or in comparison with, any specific
  commercial editor in code, package metadata, npm tags, GitHub topics,
  documentation, or marketing. Kalotyp is described on its own terms: an
  open-source image editor for Ghost.
- **Don't** distribute, mirror, or reference another editor's assets.

You **may** and **should**:

- Read Ghost's MIT-licensed source at `../core`. Ghost is the spec.
- Read public-facing API documentation when a module's signature is unclear —
  functional facts (function names, option keys, event names) aren't copyrightable.
- Design fresh UI from first principles, aligned with Ghost's Shade design system.

### The two Ghost-named identifiers

The editor applies two class tokens that aren't in the `kalotyp-*` namespace:
`pintura-editor` (on the host element) and `PinturaModal` (on the modal wrapper),
plus the `window.pintura` global. Ghost's runtime looks these up by name — the
host class scopes Ghost's CSS-variable theme overrides, the modal class is what
Ghost's close-button click handler selects on, and the global is what Ghost's
loader reads. They exist **solely for compatibility with Ghost's integration
slot, which Ghost happens to name "Pintura."** They are not branding and imply
no affiliation with, or endorsement by, the editor Ghost named the slot after.
The disclaimer is restated at the application sites in
`packages/ui/src/dom/build-shell-dom.ts` and `packages/ui/src/styles/base.css`.

Clean-room reimplementation of an interoperability surface has decades of legal
precedent (Wine, ReactOS, every reimplementation of a database wire protocol);
*Google v. Oracle* (2021) affirmed that reimplementing API surfaces for
interoperability is fair use. The project's protection depends on maintaining
this discipline. **One mistake here taints the whole codebase.**

## Project context

Kalotyp is part of the Magic Pages stack — a managed Ghost hosting platform that
values open infrastructure, EU data sovereignty, and direct customer
relationships. Kalotyp exists to give the Ghost ecosystem an open-source,
self-hostable image editor that fits the open nature of the CMS. When in doubt,
pick the option that makes Kalotyp a better gift to the Ghost community, not the
option that makes it a better proprietary asset. Optimise for adoption,
contribution, and longevity.

---

License: MIT · Repository: github.com/magicpages/kalotyp ·
Maintainer: Jannis Fedoruk-Betschki <jannis@magicpages.co>
