# Changesets

This folder is managed by [@changesets/cli](https://github.com/changesets/changesets).

When you make a user-visible change to any package, run `pnpm changeset` and follow the prompts. The CLI writes a markdown file here describing the change and the version bump it implies. CI fails the PR if you change a package and don't add a changeset.

The three published packages (`@magicpages/kalotyp-core`, `@magicpages/kalotyp-ui`, and `@magicpages/kalotyp` — the Ghost bundle) are linked, so they release together with a single version. The two `apps/*` workspaces are ignored — they're internal harnesses, not published.