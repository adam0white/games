# Registry and release

`games.json` contains `hfVersion` and `games`, initially empty. Each entry has a lowercase path-safe `slug`, and `source` with the original GitHub `repository` URL and full `commit` SHA. Import each source without squashing and preserve its commit as an ancestor. The package at `games/<slug>` pins the registry HF version exactly and supplies `check` and `build` scripts. Keep the root lockfile current.

CI computes affected games from the actual base diff. Changes outside `games/` check every registered game. The required `ci` job accepts skipped game checks only when there are no affected games, and rejects missing or failed prerequisites. The deployment build refuses an empty registry or dirty checkout, builds every game, and emits `dist/<slug>/release.json` with game, monorepo commit, clean state, source lineage and HF version. CI validates each affected package pin.

Deployment needs the hosting integration to supply a `deploy:worker` package script and an HTTPS `GAMES_ORIGIN`. `npm run deploy` requires a successful push workflow run on the exact main commit, builds all games and checks each deployed manifest. It fails closed until hosting is configured. A green release manifest alone does not verify gameplay, telemetry, identity or recording consent; verify those independently.
