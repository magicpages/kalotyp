---
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Emoji now work with **no bundled artwork and no CDN** on the documented "upload the JS + CSS" setup. The emoji picker previously rendered each cell as an OpenMoji SVG `<img>`; where those SVGs aren't served next to the bundle (e.g. only the two files were uploaded into Ghost's integration settings, without the sibling `emoji/` directory) the cells showed broken images. The picker now renders the OS native colour-emoji glyph as the base and only reveals the OpenMoji SVG when that artwork actually loads — matching the canvas, which already falls back to the same OS font. Result: the picker and the baked image are consistent everywhere, crisp OpenMoji is used wherever the `emoji/` directory is served, and the bundle stays ~76 KB gzip (nothing embedded, no third-party request).
