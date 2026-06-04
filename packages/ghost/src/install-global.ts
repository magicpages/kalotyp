import { openDefaultEditor } from './editor.js';

/**
 * Assign Kalotyp's editor to `window.pintura`. Ghost's loader (§5.5,
 * §12.2) reads the resolved module value from dynamic `import()` but
 * ignores it — the contract is purely this side effect.
 *
 * The brand name appears here intentionally and only here. It is the
 * literal global identifier Ghost looks up in
 * `koenig-image-editor.js:171`. Renaming this would break the integration.
 */
export function installGlobal(target: typeof globalThis = globalThis): void {
  const existing = (target as { pintura?: unknown }).pintura;
  if (existing && typeof existing === 'object') {
    // Match Ghost's short-circuit: a second import reuses the existing
    // global (`if (window.pintura) { this.scriptLoaded = true; return; }`).
    return;
  }
  Object.defineProperty(target, 'pintura', {
    value: { openDefaultEditor },
    writable: true,
    configurable: true,
    enumerable: true,
  });
}
