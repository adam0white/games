import { bindings, defineConfig, triggers } from "cf/config";

// Legacy per-game origins that still route to this Worker. scripts/check-redirects.mjs
// verifies this list against games.json before every build and deploy.
const legacyRoutes = [
	"rope.adamwhite.work/*",
	"hearsay.adamwhite.work/*",
	"goodhands.adamwhite.work/*",
	"glance.adamwhite.work/*",
	"repair.adamwhite.work/sw.js",
	"valley.adamwhite.work/*",
	"murmur.adamwhite.work/*",
	"stairwell.adamwhite.work/*",
	"pass.adamwhite.work/*",
	"warren.adamwhite.work/*",
	"commonstead.adamwhite.work/*",
	"child.adamwhite.work/*",
	"neighbours.adamwhite.work/*",
	"lefthand.adamwhite.work/*",
	"days.adamwhite.work/*",
	"word.adamwhite.work/*",
	"smoke.adamwhite.work/*",
	"island.adamwhite.work/*",
];

export default defineConfig({
	accountId: "a20259cba74e506296745f9c67c1f3bc",
	worker: {
		name: "games-static",
		compatibilityDate: "2026-11-05",
		entrypoint: "src/worker.mjs",
		workersDev: false,
		previewUrls: false,
		// Static assets come from dist/ through Vite's publicDir (vite.config.ts).
		assets: {
			notFoundHandling: "none",
			runWorkerFirst: true,
		},
		domains: ["play.adamwhite.work"],
		triggers: legacyRoutes.map((pattern) => triggers.fetch({ pattern, zone: "adamwhite.work" })),
		env: {
			ASSETS: bindings.assets(),
		},
	},
});
