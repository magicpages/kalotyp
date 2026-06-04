---
"@magicpages/kalotyp-core": patch
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Upgrade the build toolchain to latest stable (TypeScript 6, Vite 8, Vitest 4, Biome 2.4, jsdom 29) and clear all dependency audit alerts. No public API or runtime behaviour changes; the Ghost bundle still ships `kalotyp.js` plus a standalone `kalotyp.css`.
