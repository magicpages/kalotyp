---
"@magicpages/kalotyp-core": minor
"@magicpages/kalotyp-ui": minor
"@magicpages/kalotyp": minor
---

WebP and AVIF export now work in every browser. Canvas 2D can't *encode* AVIF in any mainstream browser today (AVIF *decoding* — displaying an existing AVIF — is unrelated and has been broadly supported for years), and can't encode WebP specifically in Safari. Kalotyp previously detected that and silently downgraded to PNG/JPEG (and hid WebP/AVIF as "(unsupported)" in the Save popover) wherever Canvas 2D fell short. Both formats are now always selectable: where Canvas 2D supports the requested format natively, encoding is unchanged; where it doesn't, Kalotyp fetches a WASM codec (libwebp / libavif, via `@jsquash/webp` and `@jsquash/avif`) from a pinned jsDelivr URL the first time it's needed and encodes with that instead. This only ever runs for the runtime and format combination that actually needs it — a browser with native support for the requested format sees no behaviour change and no network request (in practice: most non-Safari browsers for WebP, no browser for AVIF). Operators running Ghost admin behind a strict CSP should allow `cdn.jsdelivr.net` in `connect-src`/`script-src` if they want WebP/AVIF exports to succeed rather than silently falling back to PNG/JPEG.

This also fixes a bug in the runtime's own format-support probe (`canEncodeMime`): it never established a rendering context on its throwaway test canvas before requesting a blob, which some engines require — Chromium threw and the probe silently treated every format, including PNG and JPEG, as unsupported. That's now fixed for all formats, not just WebP/AVIF.
