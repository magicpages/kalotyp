---
'@magicpages/kalotyp': patch
---

Fix the editor leaving Ghost's React admin stuck after a save. `openDefaultEditor()` now returns an instance with a `destroy()` method, and the editor emits a `destroy` event whenever it tears itself down.

Ghost's React admin — the tag detail screen and the settings image fields — tracks whether the editor is open and drives teardown itself, unlike the Ember admin and the Koenig post editor. It listens for `destroy` to learn the editor closed, and calls `destroy()` when its host component unmounts. Neither existed, so editing a tag image played out as: the edited image uploaded fine, then the tag's own Save button stayed disabled and the pencil stopped reopening the editor (the host still believed the editor was open, because Save closes without consulting `willClose`), and navigating away threw `TypeError: … destroy is not a function` out of a React cleanup effect, crashing the route.

`destroy()` is idempotent, so calling it after the editor already closed itself is a no-op, and it is deliberately not vetoable by `willClose` — that hook guards user dismissal, and refusing a host's unmount would leak the modal into the next route. `docs/ghost-contract.md` gains a Teardown section covering both obligations.
