import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const aliasToSource = {
  '@magicpages/kalotyp-core': resolve(__dirname, '../core/src/index.ts'),
  '@magicpages/kalotyp-ui/styles.css': resolve(__dirname, '../ui/src/styles/index.css'),
  '@magicpages/kalotyp-ui': resolve(__dirname, '../ui/src/index.ts'),
};

// Pin the emoji-asset default to the jsDelivr copy of *this* published version,
// so emoji load out of the box wherever the bundle runs (the bundle is loaded
// via dynamic `import()` and can't learn its own URL). Self-hosters override via
// `window.__KALOTYP_EMOJI_BASE__`. See packages/ui/.../emoji-images.ts.
const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const EMOJI_DEFAULT_BASE = `https://cdn.jsdelivr.net/npm/@magicpages/kalotyp@${version}/dist/emoji/`;

export default defineConfig({
  define: {
    __KALOTYP_EMOJI_DEFAULT_BASE__: JSON.stringify(EMOJI_DEFAULT_BASE),
  },
  resolve: {
    alias: aliasToSource,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: 'oxc',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['umd'],
      name: 'pintura',
      fileName: () => 'kalotyp.js',
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: (asset) => (asset.name === 'style.css' ? 'kalotyp.css' : '[name][extname]'),
        exports: 'named',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
