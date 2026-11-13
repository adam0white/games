import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// The Worker and its routes live in cloudflare.config.ts. scripts/build.mjs assembles every game into dist/,
// which Vite copies as the Worker's static assets into .cloudflare/output for `cf deploy --prebuilt`.
export default defineConfig({
	publicDir: "dist",
	plugins: [cloudflare()],
});
