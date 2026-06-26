---
"@magicpages/kalotyp-core": patch
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Fix two annotate bugs:

- **Text:** pressing Enter now inserts a newline (text annotations are multi-line). Commit the text by clicking outside the editor or with Cmd/Ctrl+Enter — previously Enter closed the editor. Multi-line text, including empty and trailing lines, now stays aligned with the caret while editing (the inline editor is a `<textarea>`, so its content round-trips as clean `\n` text instead of drifting).
- **Emoji:** artwork now loads from the jsDelivr CDN of the matching release by default, so emoji work out of the box on hosted installs. Previously the default `/emoji/` path resolved to the site root and 404'd unless the host happened to serve the asset directory. To self-host the SVGs (they still ship in `dist/emoji/`), set `window.__KALOTYP_EMOJI_BASE__` to a same-origin URL.
