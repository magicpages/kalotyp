/**
 * Loads the text-annotation web fonts from fonts.bunny.net — the same
 * GDPR-friendly CDN and family set Ghost's own admin uses, so annotations can
 * match a site's typography. Injection is idempotent: if the link is already
 * present (Ghost may have loaded these, or we ran before), it's a no-op.
 *
 * The bake awaits `document.fonts.load` (with a timeout) before painting, so a
 * slow load never produces a wrong baked image — it just falls back to the
 * generic family if the face isn't ready in time.
 */

import { TEXT_FONTS } from '@magicpages/kalotyp-core';

const LINK_ID = 'kalotyp-annotate-fonts';

/** Build the combined Bunny CSS URL requesting regular+bold, roman+italic per family. */
function buildBunnyUrl(): string {
  const families = TEXT_FONTS.flatMap((f) => (f.bunnyName ? [f.bunnyName] : []));
  // Request 400/700 with italics so bold + italic render as real faces, not
  // synthesized obliques.
  const familyParam = families.map((name) => `${name}:400,400i,700,700i`).join('|');
  return `https://fonts.bunny.net/css?family=${familyParam}&display=swap`;
}

/**
 * Inject the Bunny stylesheet once (idempotent) and invoke `onFontsChanged`
 * whenever font faces finish loading. Web fonts arrive asynchronously: the
 * canvas first paints with a fallback face, then the real face swaps in with
 * different metrics — so the caller must repaint the shapes when fonts load,
 * or committed text appears to shift on the next interaction. `loadingdone`
 * fires for each batch the document loads (including fonts Ghost or other tools
 * trigger), and `fonts.ready` covers any already-pending load. Returns a
 * cleanup that detaches the listener.
 */
export function ensureAnnotateFontsLoaded(onFontsChanged?: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  if (!document.getElementById(LINK_ID)) {
    const link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = buildBunnyUrl();
    document.head.appendChild(link);
  }
  if (!onFontsChanged || !('fonts' in document)) return () => {};
  const onLoadingDone = (): void => onFontsChanged();
  document.fonts.addEventListener('loadingdone', onLoadingDone);
  // Also catch fonts already pending when we mount.
  void document.fonts.ready.then(() => onFontsChanged());
  return () => document.fonts.removeEventListener('loadingdone', onLoadingDone);
}
