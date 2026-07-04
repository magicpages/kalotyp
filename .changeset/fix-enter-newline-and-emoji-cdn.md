---
"@magicpages/kalotyp-core": patch
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Fix two annotate bugs:

- **Text:** pressing Enter now inserts a newline (text annotations are multi-line). Commit the text by clicking outside the editor or with Cmd/Ctrl+Enter — previously Enter closed the editor. Multi-line text, including empty and trailing lines, now stays aligned with the caret while editing (the inline editor is a `<textarea>`, so its content round-trips as clean `\n` text instead of drifting).
- **Emoji:** artwork now loads from the same origin the bundle was served from — the editor resolves the `emoji/` directory relative to its own URL (`import.meta.url`), so stickers work out of the box on hosted installs with no CDN and no per-site config. Previously the default `/emoji/` path resolved against the Ghost site root and 404'd. The Ghost bundle is now published as an ES module (every host already loads it via dynamic `import()`); to serve the SVGs from elsewhere, set `window.__KALOTYP_EMOJI_BASE__` or call `setEmojiAssetBase`.
