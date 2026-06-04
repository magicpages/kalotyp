/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { installGlobal } from './install-global.js';

afterEach(() => {
  (globalThis as { pintura?: unknown }).pintura = undefined;
});

describe('installGlobal', () => {
  it('sets `globalThis.pintura.openDefaultEditor` as a side effect', () => {
    installGlobal(globalThis);
    const pintura = (globalThis as { pintura?: { openDefaultEditor?: unknown } }).pintura;
    expect(pintura).toBeDefined();
    expect(typeof pintura?.openDefaultEditor).toBe('function');
  });

  it("does not overwrite an existing global (matches Ghost's short-circuit)", () => {
    const sentinel = { openDefaultEditor: () => undefined as never };
    (globalThis as { pintura?: unknown }).pintura = sentinel;
    installGlobal(globalThis);
    expect((globalThis as { pintura?: unknown }).pintura).toBe(sentinel);
  });
});
