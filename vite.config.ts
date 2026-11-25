import { cloudflare } from "@cloudflare/vite-plugin";
import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";

// The Worker and its routes live in cloudflare.config.ts. scripts/build.mjs assembles every game into dist/,
// which Vite copies as the Worker's static assets into .cloudflare/output for `cf deploy --prebuilt`.
export default defineConfig({
	publicDir: "dist",
	// The top-level names the Worker may serve (src/probe.mjs). "null" without a build: the Worker then skips the check.
	define: {
		__TOP_LEVEL__: existsSync("dist") ? JSON.stringify(readdirSync("dist").filter((name) => !name.startsWith("_"))) : "null",
	},
	plugins: [cloudflare()],
});
