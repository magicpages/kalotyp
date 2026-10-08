---
'@magicpages/kalotyp-core': patch
'@magicpages/kalotyp-ui': patch
'@magicpages/kalotyp': patch
---

`'auto'` output now preserves the source image's own format instead of transcoding everything to WebP. Previously, when the runtime supported WebP, every edited image was re-encoded to WebP and Ghost served those files straight into newsletters — email clients such as Outlook Classic (Word engine) cannot decode WebP, so images broke or overflowed the layout. JPEG stays JPEG, PNG stays PNG, and so on; only a source format the runtime cannot encode falls back by alpha (JPEG for opaque, PNG otherwise). Explicit format choices are unchanged.

Also fixed the runtime encoder-support probe: it encoded from a contextless `OffscreenCanvas`, which throws `InvalidStateError` in Chromium and made the probe report every format unsupported there. The probe now acquires a 2D context first, matching the real encode path.