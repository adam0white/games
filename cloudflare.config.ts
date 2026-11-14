import { bindings, defineConfig, triggers } from "cf/config";
import { assets, compatibilityDate, domains, legacyRoutes, name, zone } from "./worker-settings.mjs";

export default defineConfig({
	accountId: "a20259cba74e506296745f9c67c1f3bc",
	worker: {
		name,
		compatibilityDate,
		entrypoint: "src/worker.mjs",
		workersDev: false,
		previewUrls: true,
		// Static assets come from dist/ through Vite's publicDir (vite.config.ts).
		assets,
		domains,
		triggers: legacyRoutes.map((pattern) => triggers.fetch({ pattern, zone })),
		env: {
			ASSETS: bindings.assets(),
		},
	},
});
