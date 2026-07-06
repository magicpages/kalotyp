---
"@magicpages/kalotyp-core": patch
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Keep emoji stickers crisp by clamping their maximum size. Emoji render with the OS colour-emoji font, which is bitmap on macOS/iOS (Apple Color Emoji, ~160px strikes) and Android/Linux (Noto); drawing a glyph larger than its native strike just upscales the bitmap and blurs. Emoji boxes are now capped at `EMOJI_MAX_SIZE` (160px, image-space) everywhere they're sized — the default placement size, corner-handle resize, and the Size coordinate input — so a sticker is never drawn past its crisp resolution. (Closes #31.)
