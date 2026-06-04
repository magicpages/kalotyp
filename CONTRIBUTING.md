# Contributing to Kalotyp

Kalotyp is an MIT-licensed image editor for Ghost, built as a clean-room implementation of the image-editor integration contract Ghost CMS expects.
Two things matter most before you write any code: the **clean-room policy**, and the **commit-trail discipline** that makes the policy verifiable.

---

## The clean-room policy

> **Kalotyp must remain independent of any other image editor's source.**

Kalotyp is functionally compatible with the integration that Ghost loads. The contract — function name, option shape, event names, DOM class hooks — is fixed by Ghost's MIT-licensed code, not by anyone else's editor. Reading Ghost is fair and required; reading any third-party editor's code is not.

---

## Ghost-named identifiers that aren't ours

Kalotyp's *source* applies exactly three Ghost-named identifiers — the `window.pintura` global and two class hooks. Ghost's Admin can't find, theme, or dismiss the editor without them. They aren't branding; they're the identifiers Ghost's own code looks up, named by Ghost:

| Identifier | Where we apply it | Why it has to match |
| --- | --- | --- |
| `window.pintura` (global) | `packages/ghost/src/install-global.ts` | Ghost's loader reads this exact global after `import()` resolves. |
| `.pintura-editor` (host class) | `packages/ui/src/dom/build-shell-dom.ts` | Ghost overrides four CSS custom properties (theme colours, font, modal radius) scoped to this class; without it the editor doesn't pick up Ghost's per-site theme. |
| `.PinturaModal` (modal wrapper class) | `packages/ui/src/dom/build-shell-dom.ts` | Ghost's global click-capture handler watches `.PinturaModal button[title="Close"]` to detect explicit close-button clicks. |

These three exist solely so Ghost's runtime can find, theme, and dismiss the editor. They carry no affiliation with, and imply no endorsement by, the editor Ghost named them after. Everything else Kalotyp renders uses the project's own `kalotyp-*` namespace; the `data-env` / `data-shape` / `data-direction` attributes are plain HTML attributes read only by Kalotyp's own CSS.

Separately, Ghost declares settings keys `pintura`, `pinturaJsUrl`, and `pinturaCssUrl` in its own database — that's how Ghost stores and loads a module's bundle. Kalotyp never reads those keys; they're entirely Ghost-side.

If you find a Ghost-named identifier applied somewhere it isn't required by Ghost, file an issue. Each occurrence should be traceable to a Ghost-side line.

The build outputs are named `kalotyp.js` and `kalotyp.css`. Ghost's settings modal copy mentions different filenames in its placeholder text, but Ghost stores whatever URL the admin pastes — the filenames are not part of the contract.

---

## Commit-trail discipline

- Use [Conventional Commits](https://www.conventionalcommits.org/). Examples:
  `feat(ghost): emit process event with synthetic file`,
  `fix(core): prevent canvas leak on destroy`, `docs: clarify clean-room policy`.
- One logical change per commit. Reviewers should be able to read the diff.
- Every PR that changes published code includes a
  [Changeset](https://github.com/changesets/changesets):
  `pnpm changeset` and follow the prompts.
- Don't squash unrelated work. If you spot something while working on a task,
  open an issue, don't ride it along.

---

## Local development

```bash
pnpm install
pnpm dev          # playground at http://localhost:5173
pnpm test         # vitest, all packages
pnpm typecheck    # tsc --noEmit, all packages
pnpm lint         # biome check
pnpm build        # produces packages/ghost/dist/kalotyp.{js,css}
pnpm size         # gzip-size budget check (fails over 300KB)
```

CI runs all of the above. Bundle-size budget is enforced — if your change pushes the gzipped bundle over 300KB, CI will fail and you'll need to either trim the change or open an issue to discuss raising the budget.

## Reporting issues

Bugs and feature requests go to the
[issue tracker](https://github.com/magicpages/kalotyp/issues).

## License

By contributing, you agree your work is licensed under the MIT license, the same as the project.
