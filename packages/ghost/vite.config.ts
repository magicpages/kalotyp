import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const aliasToSource = {
  '@magicpages/kalotyp-core': resolve(__dirname, '../core/src/index.ts'),
  '@magicpages/kalotyp-ui/styles.css': resolve(__dirname, '../ui/src/styles/index.css'),
  '@magicpages/kalotyp-ui': resolve(__dirname, '../ui/src/index.ts'),
};

export default defineConfig({
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
      // ES module (not UMD): every host loads the bundle via dynamic `import()`
      // and reads `window.pintura` from the `installGlobal` side effect, so no
      // UMD global is needed.
      formats: ['es'],
      fileName: () => 'kalotyp.js',
    },
    // Vite 8 runs on Rolldown; use its native `rolldownOptions` rather than the
    // `rollupOptions` compatibility alias.
    rolldownOptions: {
      external: [],
      output: {
        // `build.minify` (above) minifies the CSS but, for an ES lib build in
        // this rolldown-vite, does NOT whitespace-minify the JS — the output is
        // only identifier-renamed, leaving ~100 KB of raw whitespace. The
        // Rolldown-native `output.minify` forces a full JS minify. Don't remove
        // it: the gzip diff is small but the raw/parse cost is not.
        minify: true,
        assetFileNames: (asset) => (asset.name === 'style.css' ? 'kalotyp.css' : '[name][extname]'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
