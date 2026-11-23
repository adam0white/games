# Games monorepo

Human Framework remains an external published dependency. Each game lives at `games/<slug>` and is listed in `games.json` with its original repository and full source commit. Preserve imported history without squash, except for the explicit Neighbours signed-import ruling below. Games that use HF pin the registry's exact HF version. HF is optional for new games (owner, 2026-11-13: HF "shouldn't restrict our Game lab"). Each game owns its rules, assets, replay and first-minute tutorial.

Do not overwrite another agent's work; use a separate worktree or branch. Use pnpm with the committed workspace lockfile and the pinned Node version. Run `npm run check:lane` before committing and `node scripts/prepare-game.mjs <slug>` and `node scripts/check-game.mjs <slug>` for each affected game before delivery. Shared configuration and registry changes require all game checks. Keep commits signed. One PR combines related work per repository. Merge only with exact-head green CI. A hosted Codex review is optional; ask for one when a change touches signing, deployment or shared build scripts.

The full deployment assembles every game. Deploy only the exact clean commit with successful main CI; verify each live `release.json`. For asset verification use the exact successful Deploy run’s `games-static-<commit>` artifact, verify its digest, receipt commit and file hashes; local rebuild bytes may differ. Keep each game's service worker, storage, CSP, recording notice and lab behavior isolated under its game path. Do not move HF engine code into this repository. Original repositories are retained; ask the owner before archiving one.


Archived code lives under `archive/` and is not built, served or checked; `archive/README.md` lists what is there, why, and how to bring it back. Do not port, polish or upgrade archived code.


## Shared code (owner, 2026-11-23)

The live prototypes share plumbing through `prototypes/kit/`. `prototypes/kit/README.md` holds the rules.
Before you write input, sound, pause, menu, save, shop or feedback-button code in a game, use or extend the kit.
Run `node prototypes/kit/check/phone.mjs` before and after your changes.
Storage keys and formats never change.
Reuse before you build. When two games need the same thing, move it to the kit in the same change.

## Current goal (owner, 2026-11-13 and 2026-11-14)

Owner words are in [HF owner directions](https://github.com/adam0white/human-framework/blob/main/docs/owner-directions-2026-10-18.md). The reasoning is in [the direction document](docs/game-lab-direction-2026-11-13.md).

Make real games that people outside the lab choose to play, guided by the owner's taste. Work on fewer, focused directions; do not grow the catalogue for its own sake. The owner decides through variants, design proposals and acceptance gates, in small batched asks. Agents build, test and measure. Synthetic testers find defects; they do not vote on fun. Rules that slow the work may be dropped and re-enacted when needed (owner, 2026-11-14).

The earlier migration-first goal is superseded and "New-game prototypes wait" is removed. Remaining migration items are in [docs/migration.md](docs/migration.md). The owner owns secret entry and archive decisions. A staged subtree is not a shipped game.

Proposals from the direction document (owner approved the document on 2026-11-14 and may change any detail):

- **Bake-off.** Build a few small entries in about two weeks; the owner plays each for ten minutes and picks one. The winner gets the remaining effort toward a game outsiders finish without help and recommend.
- **Prototype lane.** A prototype needs signed commits and green CI only. It does not need HF, a replaying export, a cast registry entry, a design document or a hosted review until it graduates. A prototype is a static directory `prototypes/<slug>/` with an `index.html`; the build copies it to `/proto/<slug>/`. It has no `games.json` entry, so the HF pin and release-manifest checks do not apply. A prototype that graduates moves to `games/<slug>` and meets the game rules.
- **Taste gates.** Concept card, then two to four look variants, then a ten-minute play verdict, then outsider-ready. Each gate is one short ask to the owner.
- **Spend.** Paid art, music or other assets are allowed only under a cap the owner has set, and each purchase is logged in the repository. No cap is set yet; spend nothing until one is.

Still in force: friends' playtests and Show HN stay paused until the owner accepts readiness; outside publishing waits on the owner's open check; multiplayer and account transfer are not authorized; no new server infrastructure without an owner decision.

Cloud sessions use this checkout alone. Set `HF_SUITE_LOCK_DIR` to one shared writable session path before running game checks, as shown in README; all agents on the machine use the same path and keep locking enabled. Install the pinned Node and pnpm versions, then `pnpm install --frozen-lockfile`. Never require a `~/code` location, Homebrew, or a sibling HF tree for CI, builds, replay, or deployment. Use disposable worktrees under the session workspace when the Mac worktree helper is unavailable. HF is an exact npm dependency; no file/link/workspace HF engine dependency or game-level legacy engine alias. The Lab client also uses the exact npm HF4.17.0 package for its retained coarse-life clock. Validate the installed SDK dependency graph as well as the direct game engine; no legacy engine alias is allowed.

CI path filters select game checks. Shared changes run all games. The complete bundle always builds. After successful push CI on current main, Deploy runs the existing guarded root deployment and verifies every live manifest. Keep its same-repository/main-push restriction, serialized deploys, clean exact-main check, and live verification. Missing `CLOUDFLARE_API_TOKEN` is an owner setup step documented in README; never read, add, or transmit credentials on the owner's behalf. Keep production and CI success claims distinct.

## Neighbours history exception — coordinator ruling, 2026-11-11

Concordia contains unsigned upstream commits. Its Neighbours subtree split also produced unsigned commits. Keep the public, archived `adam0white/concordia` available as the exact full-history source (owner ruling, 2026-11-12). Neighbours therefore uses one signed import, recorded in `games.json` as `source.history`, while `source.repository` and `source.commit` retain the original provenance. The build and game checks require that import commit to be an ancestor and its imported game tree to match the pinned tree object. All other original source commits must remain ancestors of main. Do not expand this exception without an explicit coordinator or owner ruling. Never weaken signing protection or re-sign original history. See `docs/migration-lineage.md` for exact retrieval commands.
