import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Plugin, defineConfig } from 'vite';

const distDir = resolve(__dirname, '../../packages/ghost/dist');

/**
 * Serve `/kalotyp.js` and `/kalotyp.css` directly from
 * `packages/ghost/dist` without Vite's import transform. Matches how Ghost
 * loads the bundle in production: dynamic `import()` of a static asset
 * served as plain JS, no module rewriting in the middle.
 *
 * Without this plugin Vite intercepts `?import` requests for files served
 * out of `publicDir` and rejects them — breaking the playground's Ghost-
 * shaped loader path.
 */
function serveKalotypBundle(): Plugin {
  return {
    name: 'kalotyp-serve-bundle',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const match = url.match(/^\/kalotyp\.(js|css)(?:\?.*)?$/);
        if (!match) return next();
        const ext = match[1];
        const filePath = resolve(distDir, `kalotyp.${ext}`);
        try {
          await stat(filePath);
        } catch {
          res.statusCode = 404;
          res.end('Not built yet — run `pnpm --filter @magicpages/kalotyp build`.');
          return;
        }
        const buf = await readFile(filePath);
        res.setHeader(
          'Content-Type',
          ext === 'js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8',
        );
        res.setHeader('Cache-Control', 'no-store');
        res.end(buf);
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [serveKalotypBundle()],
  build: {
    target: 'es2022',
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [resolve(__dirname, '../../')],
    },
  },
});
