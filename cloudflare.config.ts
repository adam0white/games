import { bindings, defineConfig, triggers } from "cf/config";
import { archivedRoutes, assets, compatibilityDate, domains, legacyRoutes, name, zone } from "./worker-settings.mjs";

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
		// Legacy game hosts redirect to their game; archived game hosts redirect to the shelf (src/worker.mjs).
		triggers: [...legacyRoutes, ...archivedRoutes].map((pattern) => triggers.fetch({ pattern, zone })),
		env: {
			ASSETS: bindings.assets(),
		},
	},
});
