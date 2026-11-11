# Games

Original games built with [Human Framework](https://github.com/adam0white/human-framework). Games live at `https://play.adamwhite.work/<slug>/`. The central shelf, identity service, and Lab remain in Human Framework.

## Work from a cloud session

Clone `adam0white/games` in the session workspace. Use the Node version in `.node-version` and pnpm version in `package.json`. No local Mac checkout or sibling Human Framework repository is needed.

```sh
pnpm install --frozen-lockfile
pnpm --filter ./games/rope dev
node scripts/prepare-game.mjs rope
node scripts/check-game.mjs rope
pnpm check:lane
```

Run the preparation command before checks; it installs each game's declared browser runtimes and OS dependencies. On Linux, installation may require the session's package-manager privileges. Neighbours additionally requires Python 3.12.13 and `python -m pip install -r games/neighbours/neighbours/native-gm-requirements.txt` before its native checks. Lefthand downloads checksum-pinned Godot tools; its required hosted matrix covers Linux Chromium and macOS WebKit. Preserve the pinned versions when choosing a cloud image.

`games.json` lists every imported game, original source commit, old origin, save schema, and the single exact HF version. Every game consumes HF from npm. Lab packages are immutable published artifacts or checked-in vendor archives with notices. Original source history remains reachable through unsquashed subtree imports.

The registry also supports `kind: "recorded-viewer"` for a CLI experiment and static recording viewer such as Island. This kind still requires the exact npm HF engine for native replay and declares no direct Lab client dependency. The source/build audit must establish that no recording implementation is bundled; the manifest check alone does not establish that. Its release reports `labVersion: null`. Interactive games continue to require their immutable Lab client artifact.

Work on a signed branch. Run the affected game checks and root lane. Open one combined PR for independent changes. Obtain green required CI and a clear hosted Codex review on the exact head. Merge normally. Shared files and the lockfile trigger all game checks. CI always builds the entire deployment bundle.

## Production deployment

After CI succeeds for a push to `main`, `.github/workflows/deploy.yml` checks out that exact commit. It serializes production deploys and runs `pnpm deploy`. The deploy script rejects stale main or unsuccessful CI, builds the complete bundle in a clean temporary checkout, uploads `games-static`, then verifies every live `/<slug>/release.json` against the complete expected manifest and `dirty:false`. It deletes its temporary checkout on exit. PR and fork runs cannot deploy.

The owner must add the repository Actions secret before automatic deployment can succeed:

1. Create a Cloudflare API token scoped to the account in `wrangler.jsonc`, with Workers Scripts Edit and Account Settings Read; scope Zone Read and Workers Routes Edit to `adamwhite.work` for its custom domain/routes. Use the [Cloudflare deployment guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) to confirm the token scope.
2. Open [games Actions secrets](https://github.com/adam0white/games/settings/secrets/actions). Choose **New repository secret**. Name it `CLOUDFLARE_API_TOKEN`. Paste the token there. Never paste it in chat, source, or STATUS.
3. Re-run the latest successful main CI workflow. Its successful completion triggers Deploy. Read the Deploy result and verify every live release manifest. A successful CI run alone does not prove deployment.

The account ID is committed non-secret configuration. GitHub supplies the read-only `GH_TOKEN` used to verify CI. No credential file or local OAuth session is needed in Actions. For a manual recovery deployment from a cloud checkout, use `pnpm deploy` on current clean green main with the same token supplied privately in the environment and an authenticated read-only GitHub CLI.

## Data and recovery

Old-origin saves are not automatically transferred. The new origin starts fresh; retain original data and exports. A path is not an isolation boundary: all games share the play origin. Each game's storage keys and service-worker scope must remain distinct. Validate native export/replay, recording and privacy behavior before enabling an old-host redirect. Preserve old hosts and source until the owner decides to retire them. Archiving and deleting source directories require the owner's decision.

Code is MIT licensed. Imported games retain their attribution and third-party notices. [AGENTS.md](AGENTS.md) defines work rules. [HANDOFF.md](HANDOFF.md) records release state.
