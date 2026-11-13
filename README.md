# Games

Original games built with [Human Framework](https://github.com/adam0white/human-framework). Games live at `https://play.adamwhite.work/<slug>/`. The central shelf, identity service, and Lab remain in Human Framework.

## Work from a cloud session

Clone `adam0white/games` with full history in the session workspace. If the provider created a shallow checkout, run `git fetch --unshallow origin` before checks. Use the Node version in `.node-version` and pnpm version in `package.json`. No local Mac checkout or sibling Human Framework repository is needed.

```sh
export HF_SUITE_LOCK_DIR="${TMPDIR:-/tmp}/adamwhite-full-suite"
pnpm install --frozen-lockfile
pnpm --filter ./games/rope dev
node scripts/prepare-game.mjs rope
node scripts/check-game.mjs rope
pnpm check:lane
pnpm check
```

All agents sharing a cloud machine must use the same `HF_SUITE_LOCK_DIR`. It serializes full suites without a home checkout. Do not disable the lock. Without this setting, the six imported lock helpers retain the existing Mac lock location for coordination with other local projects.

For the full root `pnpm check`, run `node scripts/prepare-game.mjs <slug>` for every slug in `games.json` first. The check runs root tests and the existing native or CI qualification scripts for every registered game serially; it stops at the first failure. Delivery also requires the separate CI browser matrices and full deployment bundle build. Run the preparation command before checks; it installs each game's declared browser runtimes and OS dependencies. On Linux, installation may require the session's package-manager privileges. Neighbours additionally requires Python 3.12.13 and `python -m pip install -r games/neighbours/neighbours/native-gm-requirements.txt` before its native checks. Lefthand requires Python 3.11 or later and downloads checksum-pinned Godot tools; its required hosted matrix covers Linux Chromium and macOS WebKit. Preserve the pinned versions when choosing a cloud image.

`games.json` lists every imported game, original source commit, old origin, save schema, and the single exact game-engine HF version. Every game consumes HF from npm. Lab packages are immutable published artifacts or checked-in vendor archives with notices. Original source history remains reachable through unsquashed subtree imports for seventeen games. Neighbours uses a signed import because Concordia and its subtree split contain unsigned commits; its exact full history stays in the public, archived [Concordia repository](https://github.com/adam0white/concordia). The registry records this exception explicitly. See [source lineage](docs/migration-lineage.md) for retrieval and verification commands. The games and Lab client resolve the same exact npm HF 4.17.0 version. Client 0.5.19 projects the retained coarse-life clock through HF4; the installed graph contains no legacy engine alias.

The registry also supports `kind: "recorded-viewer"` for a CLI experiment and static recording viewer such as Island. This kind still requires the exact npm HF engine for native replay and declares no direct Lab client dependency. The source/build audit must establish that no recording implementation is bundled; the manifest check alone does not establish that. Its release reports `labVersion: null`. Interactive games continue to require their immutable Lab client artifact.

Cloud commits must retain verified signatures. One supported option is [GitHub Codespaces GPG verification](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-gpg-verification-for-github-codespaces): in GitHub **Settings → Codespaces**, enable **GPG verification**, choose **Selected repositories**, and add `adam0white/games`. Create a new codespace, or restart an existing one after enabling it. Codespaces supplies the signer; do not copy Mac signing-key paths into the cloud workspace. Confirm the pushed commit is verified on GitHub. For another cloud runner, configure its verified signer before committing. Fix signing errors without disabling signing.

Work on a signed branch. Run the affected game checks and root lane. Open one combined PR for independent changes. Obtain green required CI and a clear hosted Codex review on the exact head. Merge normally. Shared files and the lockfile trigger all game checks. CI always builds the entire deployment bundle.

## Production deployment

After CI succeeds for a push to `main`, `.github/workflows/deploy.yml` checks out that exact commit. It serializes production deploys and runs `pnpm deploy`. The deploy script rejects stale main or unsuccessful CI, builds the complete bundle in a clean temporary checkout, bundles the Worker with Vite, uploads that exact output as `games-static` with `cf deploy --prebuilt`, then verifies every live `/<slug>/release.json` against the complete expected manifest and `dirty:false`. It deletes its temporary checkout on exit. After Wrangler returns, the deploy script verifies both the upload input and retained copy against the in-memory receipt before checking live manifests. It assumes no concurrent writer during upload; it does not defend against transient same-user races. After a successful deploy step, Actions retains the assembled dist and prepared-byte receipt as `games-static-<commit>` for 14 days. Download the artifact from the exact successful Deploy run, verify its artifact digest, receipt commit and per-file hashes, then compare live assets to those bytes. Godot PCK output can differ between builds, so a separate local build is not the deployed-byte reference. Artifact creation alone does not prove deployment. PR and fork runs cannot deploy.

If Deploy reports a missing repository Actions secret, the owner supplies it:

1. Create a Cloudflare API token scoped to the account in `cloudflare.config.ts`, with Workers Scripts Edit and Account Settings Read; scope Zone Read and Workers Routes Edit to `adamwhite.work` for its custom domain/routes. See [Cloudflare deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) and [route permissions](https://developers.cloudflare.com/workers/authorization/workers/) for the token scope.
2. Open [games Actions secrets](https://github.com/adam0white/games/settings/secrets/actions). Choose **New repository secret**. Name it `CLOUDFLARE_API_TOKEN`. Paste the token there. Never paste it in chat, source, or STATUS.
3. After successful push CI on current main, start recovery with `gh workflow run deploy.yml --ref main -R adam0white/games`. The guarded trigger rechecks current main and its latest successful push CI before upload. Read the new Deploy result and verify every live release manifest. A successful CI run alone does not prove deployment.

The account ID is committed non-secret configuration. GitHub supplies the read-only `GH_TOKEN` used to verify CI. Actions supplies the owner's stored Cloudflare token. No credential file or local OAuth session is needed in Actions. A cloud session needs GitHub access to dispatch and inspect the workflow; recovery uses the same stored deployment secret.

## Data and recovery

Old-origin saves are not automatically transferred. The new origin starts fresh; retain original data and exports. A path is not an isolation boundary: all games share the play origin. Each game's storage keys and service-worker scope must remain distinct. Validate native export/replay, recording and privacy behavior before enabling an old-host redirect. Preserve old hosts and source until the owner decides to retire them. Archiving and deleting source directories require the owner's decision.

Code is MIT licensed. Imported games retain their attribution and third-party notices. [AGENTS.md](AGENTS.md) defines work rules. [HANDOFF.md](HANDOFF.md) records release state.
