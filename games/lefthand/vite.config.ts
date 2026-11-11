import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
  base: "/lefthand/",
  plugins: [
    {
      name: "encoded-godot-preview",
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url ?? "/", "http://preview.local").pathname;
          // On localhost the SDK uses the legacy origin-root manifest path.
          // The production play origin uses /lefthand/release.json directly.
          if (path === "/release.json") {
            const file = resolve(
              server.config.root,
              server.config.build.outDir,
              "release.json",
            );
            if (!existsSync(file)) return next();
            res.setHeader("Content-Type", "application/json");
            createReadStream(file).pipe(res);
            return;
          }
          if (/^\/lefthand\/engine\/game-[a-f0-9]+\.wasm$/.test(path)) {
            if (req.method !== "GET" && req.method !== "HEAD") {
              res.writeHead(405, { Allow: "GET, HEAD" });
              res.end();
              return;
            }
            const file = resolve(
              server.config.root,
              server.config.build.outDir,
              `.${path.replace(/^\/lefthand/, "")}.gz`,
            );
            if (!existsSync(file)) {
              res.statusCode = 404;
              res.end();
              return;
            }
            res.setHeader("Content-Encoding", "gzip");
            res.setHeader("Content-Type", "application/wasm");
            if (req.method === "HEAD") res.end();
            else createReadStream(file).pipe(res);
            return;
          }
          next();
        });
      },
    },
  ],
  server: { host: "127.0.0.1" },
  build: { target: "esnext" },
});
