---
'@magicpages/kalotyp-core': patch
---

Fix cropping (and every other tool) on SVG sources. `createImageBitmap` can't decode SVG in any current browser, so SVGs always took the `<img>`-element fallback — and an SVG that declares no pixel `width`/`height` (only a `viewBox`, or `width="100%"`) loads at a tiny browser-default intrinsic size (e.g. 300×150) regardless of its real dimensions. Editing then happened at that tiny size, and baking a crop drew the SVG element through a source-rectangle `drawImage`, which mis-maps on a no-intrinsic-size element: the saved image came out tiny with the content collapsed into the top-left corner instead of cropped.

SVGs are now rasterised once, on load, onto a canvas sized from their own metadata (explicit px `width`/`height`, else `viewBox`, proportionally clamped to 8000 px), so every downstream transform operates on a correctly-sized raster. `'auto'` output no longer resolves an SVG source to JPEG, preserving transparency.
