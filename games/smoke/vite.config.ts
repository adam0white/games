import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Preview must exercise the same eval-free policy as the deployed static site.
const csp = /Content-Security-Policy: (.+)/.exec(readFileSync('public/_headers', 'utf8'))?.[1];
if (!csp) throw new Error('Missing release Content Security Policy.');
export default defineConfig({
  base: '/smoke/',
  preview: { headers: { 'Content-Security-Policy': csp } },
  plugins: [
    {
      name: 'local-sdk-manifest',
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          // The SDK uses an origin-root receipt only for non-play local preview hosts.
          if (new URL(req.url ?? '/', 'http://preview.local').pathname !== '/release.json') return next();
          const file = resolve(server.config.root, server.config.build.outDir, 'release.json');
          if (!existsSync(file)) return next();
          res.setHeader('Content-Type', 'application/json');
          createReadStream(file).pipe(res);
        });
      },
    },
  ],
});
