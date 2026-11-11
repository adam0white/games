# Games monorepo

Human Framework remains an external published dependency. Each game lives at `games/<slug>` and is listed in `games.json` with its original repository and full source commit. Preserve imported history without squash. All games pin the registry's exact HF version. Each game owns its rules, assets, replay and first-minute tutorial.

Use one worktree per agent. Do not overwrite another agent's work. Use pnpm with the committed workspace lockfile and the pinned Node version. Run `npm run check:lane` before committing and `node scripts/prepare-game.mjs <slug>` and `node scripts/check-game.mjs <slug>` for each affected game before delivery. Shared configuration and registry changes require all game checks. Keep commits signed. One PR combines related work per repository. Merge only with exact-head green CI and a clear hosted Codex review, and honor current coordination holds.

The full deployment assembles every game. Deploy only the exact clean commit with successful main CI; verify each live `release.json`. Keep each game's service worker, storage, CSP, recording notice and lab behavior isolated under its game path. Do not move HF engine code into this repository. Original repositories are retained; ask the owner before archiving one.


The current owner goal prioritizes finishing every existing-game migration and cloud operation. New-game prototypes wait. Done means each requested game retains full history and notices, uses the single npm HF version, exports a replaying current run, passes required CI, serves a verified clean main release from play, and has its old origin redirecting. The owner owns secret entry and archive decisions. Record unqualified games explicitly; a staged subtree is not a shipped game.

Cloud sessions use this checkout alone. Install the pinned Node and pnpm versions, then `pnpm install --frozen-lockfile`. Never require a `~/code` location, Homebrew, or a sibling HF tree for CI, builds, replay, or deployment. Use disposable worktrees under the session workspace when the Mac worktree helper is unavailable. HF is an exact npm dependency; no file/link/workspace HF engine dependency or legacy engine alias.

CI path filters select game checks. Shared changes run all games. The complete bundle always builds. After successful push CI on current main, Deploy runs the existing guarded root deployment and verifies every live manifest. Keep its same-repository/main-push restriction, serialized deploys, clean exact-main check, and live verification. Missing `CLOUDFLARE_API_TOKEN` is an owner setup step documented in README; never read, add, or transmit credentials on the owner's behalf. Keep production and CI success claims distinct.
