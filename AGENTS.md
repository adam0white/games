# Games monorepo

Human Framework remains an external published dependency. Each game lives at `games/<slug>` and is listed in `games.json` with its original repository and full source commit. Preserve imported history without squash. All games pin the registry's exact HF version. Each game owns its rules, assets, replay and first-minute tutorial.

Use one worktree per agent. Do not overwrite another agent's work. Use pnpm with the committed workspace lockfile and the pinned Node version. Run `npm run check:lane` before committing and the affected game's `pnpm run check` before delivery. Shared configuration and registry changes require all game checks. Keep commits signed. One PR combines related work per repository. Merge only with exact-head green CI and a clear hosted Codex review, and honor current coordination holds.

The full deployment assembles every game. Deploy only the exact clean commit with successful main CI; verify each live `release.json`. Keep each game's service worker, storage, CSP, recording notice and lab behavior isolated under its game path. Do not move HF engine code into this repository. Original repositories are retained; ask the owner before archiving one.
