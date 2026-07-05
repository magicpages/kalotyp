import '@magicpages/kalotyp-ui/styles.css';
import { setEmojiAssetBaseDefault } from '@magicpages/kalotyp-ui';
import { openDefaultEditor } from './editor.js';
import { installGlobal } from './install-global.js';

if (typeof window !== 'undefined') {
  // Resolve the emoji artwork directory relative to this bundle's own URL. Ghost
  // (and the playground / test hosts) load Kalotyp via dynamic `import()` from
  // wherever it's served — e.g. https://accounts.magicpages.co/kalotyp/kalotyp.js
  // — and the OpenMoji SVGs ship in the sibling `dist/emoji/` directory. So the
  // assets come from the same origin as the bundle: no CDN, no per-site config.
  // Self-hosters can still override via `window.__KALOTYP_EMOJI_BASE__`.
  try {
    // Read `import.meta.url` into a variable first so Vite treats this as a
    // runtime URL join, not a build-time asset reference it should inline/emit.
    const bundleUrl = import.meta.url;
    if (bundleUrl) setEmojiAssetBaseDefault(new URL('emoji/', bundleUrl).href);
  } catch {
    // No usable module URL — the loader falls back to the same-origin `/emoji/`.
  }
  installGlobal(globalThis);
}

export type {
  EditorEventName,
  EditorEventPayloads,
  EditorInstance,
  EditorOptions,
  LoadErrorEvent,
  ProcessEvent,
} from './contract.js';
export { openDefaultEditor };
