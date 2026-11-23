# Archive

Code that is no longer built, deployed or checked. Nothing under `archive/` is served. Git history is intact, so anything here can be moved back.

| Path | What it is | Archived | Why | To revive |
| --- | --- | --- | --- | --- |
| `archive/prototypes/copper-afternoon/` | Bake-off prototype: a repair workshop afternoon with visitors and colleagues who decide for themselves. `sim.js` is the rules, `people.js` the cast, `main.js` the view, `bots.mjs` and `client-smoke.mjs` the checks. Design: `docs/design/copper-afternoon.md`. Play notes: its `NOTES.md`. | 2026-11-23 | Owner: it "has some value, but let it go for now; we'll reuse it for something else later". | `git mv archive/prototypes/copper-afternoon prototypes/copper-afternoon`; it is then served at `/proto/copper-afternoon/`. |
| `archive/prototypes/long-road/` | Bake-off prototype: a wagon trail with a small party. | 2026-11-23 | Owner: "The long road can go." | Same move, to `prototypes/long-road`. |
| `archive/games/commonstead/` | HF game: eight residents finish a storehouse before a storm. | 2026-11-23 | A new game failed to start in the iPhone browser profile (Playwright WebKit: "Saved game changed in another tab"); it had no owner verdict. | Move it back to `games/commonstead`, restore its `games.json` entry and its route in `worker-settings.mjs` and `wrangler.jsonc` from the commit before the archive, then `pnpm install`. |
| `archive/games/island/` | Not a game: a viewer for recorded runs of an HF person and a language model on one island. The same viewer is served by the HF site at `/lab/island/`. | 2026-11-23 | Never on the public list; a duplicate of the HF site copy. | Same steps as Commonstead. |

Archiving a registered game: move `games/<slug>` to `archive/games/<slug>`, delete its `games.json` entry and its legacy route in `worker-settings.mjs` and `wrangler.jsonc`, run `pnpm install --lockfile-only`, and set `listed: false` on it in the HF site's `apps/site/src/games.ts`. Its URL under `play.adamwhite.work` and its old origin then stop serving. The original GitHub repository is not touched; archiving that is the owner's call.

The bake-off ended on 2026-11-23 with Lantern and Ant Promotion as the two games that get the work.
