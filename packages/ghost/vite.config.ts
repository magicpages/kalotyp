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
