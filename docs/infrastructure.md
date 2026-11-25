# Registry and release

`games.json` contains `hfVersion` and `games`, initially empty. Each entry has a lowercase path-safe `slug`, `source` with original GitHub `repository` URL and full `commit` SHA, and a nonempty `saveSchema`. Import source without squashing; its source commit must remain an ancestor. The sole Neighbours exception records `source.history` with `mode: original-repository`, a signed `importCommit` and the imported `tree` object. Its original full history stays in adam0white/concordia; the import commit must be an ancestor and contain that exact game tree. Compare the imported subtree against the source tree during import. Each package at `games/<slug>` pins the registry HF version exactly and supplies `check:lane`, `test`, and `build` scripts. Keep the workspace lockfile current. Installed HF aliases and differing versions are forbidden, including transitive versions. Each game must install the lab client.

CI computes affected games from the base diff. Changes outside registered game paths check every game. Paths under `workers/` are the exception: the always-on `workers` job checks them, and the aggregate requires it. The aggregate `ci` job runs the same result gate covered by the tooling tests; a full build runs whenever the registry is nonempty. Bootstrap CI permits an empty registry but build and deployment refuse it. All jobs use full history.

A release checks clean source, latest remote main, and successful exact-commit push CI including its `ci` job. It installs and builds from a fresh detached worktree, clears every game output, assembles all games, scopes headers and redirects, and emits `dist/<slug>/release.json` with lineage, engine, lab and save schema. It then deploys through Wrangler and checks each manifest directly at `https://play.adamwhite.work` without redirects. Hosting configuration remains separate. Verify gameplay, telemetry, identity, recording consent, CSP and offline behavior independently; a matching manifest alone does not establish them.

All game simulation engines resolve to HF 4.17.0 through one root override and exact game pins. The lab client artifact retains its own HF 3 dependency for older-person continuity; it is not used as a game simulation engine. This is not a claim that only one HF package version is installed. Game-level legacy simulation aliases are not allowed. Old saves are not transferred to the play origin.

## Old game subdomains (deleted 2026-11-25)

The owner had the old per-game subdomains deleted on 2026-11-25. Seventeen hosts under `adamwhite.work` no longer resolve: rope, glance, murmur, stairwell, pass, warren, neighbours, lefthand, word (old addresses of games that are still live under `play.adamwhite.work/<slug>/`) and hearsay, goodhands, valley, commonstead, child, days, island, smoke (archived games). Old links to them fail; nothing redirects them. Traffic on them was not measured first.

Sixteen were custom domains on each game's original Worker and were detached from it; `island` was a bare DNS record. `games-static` no longer routes any of them: `legacyRoutes` holds only the Small Works route, `archivedHosts` is empty, and the nine live games have `redirectEnabled: false` in `games.json` with `legacyOrigin` kept as a record of where they came from.

Kept: `repair.adamwhite.work`, because its original Worker still serves the Small Works experiments archive under `/experiments`. The sixteen original Workers were not deleted and still answer on their `workers.dev` addresses (item `lab-5fb` in the list).

To bring one host back, attach it again as a custom domain on the game's original Worker, or add a route and an `archivedHosts` or `legacyRoutes` entry here.
