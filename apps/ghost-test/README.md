# Kalotyp E2E harness

End-to-end tests against a real Ghost instance. The specs install Kalotyp through Ghost's **Settings → Integrations → image-editor** flow, exercise the editor inside an actual post, and verify the integration contract end-to-end.

## What's covered

The suite runs Playwright specs against a containerised Ghost and an HTTP server hosting the freshly-built `kalotyp.{js,css}` assets:

- **`contract.spec.ts`** — Kalotyp loads as the configured image editor, mounts `.pintura-editor` with the landscape `data-env` layout, emits a `process` event with a `{ dest: File }` payload, and the modal unmounts on Save.
- **`transform.spec.ts`** — crop, rotate, flip, and resize round-trip through the chain.
- **`annotate.spec.ts`** — text / rect / ellipse / arrow / freehand / highlight placement and edit.
- **`filter.spec.ts`** / **`finetune.spec.ts`** — colour adjustment panels.
- **`axe.spec.ts`** — `@axe-core/playwright` runs against every panel; zero violations is the gate.
- **`keyboard-only.spec.ts`** — full keyboard-only walkthrough of the editor; auto-runs on chromium and mobile-chromium projects.
- **`mobile.spec.ts`** / **`zoom.spec.ts`** — touch-emulated gestures, viewport pan/zoom math under landscape and portrait.

## Running locally

You need a Ghost admin user already created (Ghost's first-run wizard creates the owner account in the browser; the harness does not automate that).

```bash
# 1. Boot Ghost in docker.
pnpm --filter @magicpages/kalotyp-ghost-test ghost:up
#    Visit http://localhost:2368 once to complete the first-run wizard.

# 2. Build the Kalotyp Ghost adapter.
pnpm --filter @magicpages/kalotyp-ghost build

# 3. Run the spec (auto-starts http-server for /kalotyp.{js,css}).
GHOST_ADMIN_EMAIL=you@example.com \
GHOST_ADMIN_PASSWORD='<password>' \
pnpm --filter @magicpages/kalotyp-ghost-test test
```

Spec skip gate: `test.skip(...)` triggers when `GHOST_ADMIN_EMAIL` or `GHOST_ADMIN_PASSWORD` aren't set, so a `pnpm test:e2e` against an unconfigured machine reports skipped instead of failing.

Environment:

- `GHOST_BASE_URL` — defaults to `http://localhost:2368`
- `GHOST_ADMIN_EMAIL` / `GHOST_ADMIN_PASSWORD` — admin credentials
- `KALOTYP_JS_URL` / `KALOTYP_CSS_URL` — defaults to
  `http://localhost:5174/kalotyp.{js,css}`

## Fixtures

- `tests/fixtures/feature.png` — 256 × 256 PNG with a sky / sand gradient and a centred black square. Small enough to upload quickly; the recognisable square makes visual-diff assertions tractable if we add them.
- `tests/fixtures/axe-host/` — a static HTML host that mounts Kalotyp outside Ghost so the accessibility spec can run without a Ghost-side setup step.
