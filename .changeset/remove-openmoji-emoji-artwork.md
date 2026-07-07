---
"@magicpages/kalotyp-core": patch
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Render emoji purely with the OS colour-emoji font; remove the OpenMoji SVG artwork entirely. Previously emoji could upgrade to bundled OpenMoji SVGs when the `emoji/` directory was served next to the bundle — which meant a system-emoji → SVG swap in the picker, a network request per emoji, ~5 MB of vendored SVGs, and a hosting dependency. Now the picker and the canvas both use the OS font consistently: no artwork bundled or fetched, no CDN, no `emoji/` directory, no `window.__KALOTYP_EMOJI_BASE__` / `setEmojiAssetBase`. The Ghost bundle drops ~7 KB gzip (and the package sheds the SVG directory). Emoji stay crisp within the size clamp (`EMOJI_MAX_SIZE`); the emoji list still comes from `unicode-emoji-json`.
