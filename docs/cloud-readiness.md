# Cloud readiness audit — 2026-11-10

Games implementation is staged on MIGRATE cloud branch. Automatic production deployment cannot succeed until the owner adds the named Actions secret. No token was read or installed. An Actions deployment has not yet been verified.

## Games

The build, checks and deployment resolve packages inside the workspace. All game engines pin the registry npm version. The former Homebrew Node PATH override in root deployment is removed; setup-node supplies Node in Actions. Build output, deployment checkouts and package dependencies are regenerable. Original repos, evidence and exports are not.

Deployment runs only after successful same-repo push CI on main. It checks current main again before upload, builds all games, and compares every live manifest. See root README for owner setup and cloud commands. A green build is not a live verification. The old-host redirect configuration is separate from automatic asset deployment and must be checked per game.

## Human Framework

Read-only audit of remote main `2ecdd895552546537541f1058202249660c5894a`, fetched in this session. Its existing CI already uses Linux setup-node/pnpm. The following operational assumptions remain; this audit does not claim they are fixed.

| Location | Confirmed local assumption | Proposed cloud replacement |
| --- | --- | --- |
| `scripts/agent-worktree.sh:4,12` | Homebrew PATH and `$HOME/code/.lab-scratch/wt` | Session workspace plus configurable worktree root; use git worktrees under that root. |
| `scripts/install-wai-daily.ts:9–17` | macOS LaunchAgents, launchctl, Homebrew Node, a fixed checkout and log directory | A scheduled Actions workflow with explicit concurrency, pinned Node/pnpm, browser dependencies and durable private artifacts. Run at the equivalent selected time; account for DST. Disable local scheduling only after cloud receipts are verified and the owner accepts cutover. |
| `scripts/lab-wai-play.ts:14,125,503` | Scratch state in home/code; child processes run Homebrew Node | Configurable state directory and `process.execPath`; install Playwright browsers in Actions. |
| `scripts/lab-wai-budget.ts:23,53–54,120–121,419` | Local budget/account caches, filesystem locks, and an admission key | Durable private state with conditional writes and a single scheduled runner. Supply admission key via an Actions secret or use a scoped remote admission service. Never reset daily spend on each fresh runner. |
| `scripts/lab-wai-reading.ts:254,497` | Finds separate game source repos under home/code | Read games from `games/<slug>` in a separately checked-out immutable games commit and HF from its checkout. Record both SHAs in receipts. |
| `scripts/suite-lock.ts:58` | Local full-suite lock under home/code | Already bypasses local locking when CI is set; Actions concurrency governs scheduled work. A configurable temp directory supports interactive cloud sessions. |
| `scripts/lab-play.integration.test.ts:13,205`, `lab-wai-{cache,refill,runner}.test.ts` | Fixtures create home/code scratch directories | Test-owned mkdtemp directories with cleanup. Current Linux CI can create these paths, but they are an unnecessary location assumption. |
| `scripts/lab-{play,phone}.ts` | Fallback searches local npm `_npx` cache for Playwright | Use the declared Playwright dependency and install its browsers in the runner; retain clear missing-browser errors. |
| `AGENTS.md:59,75` | Mac checkout/scratch conventions and Homebrew PATH | Document cloud clone/setup and session temp roots alongside optional Mac tooling. |

Observed local installed scheduler: `work.adamwhite.lab-wai-play` runs daily at 16:00 local time with `--run --scheduled --suggest`. It points to a Mac checkout and writes scratch logs. Its existence is confirmed; current loaded/running state was not inspected. It was not stopped or edited.

The current HF publish workflows already exist. HF production-site deployment still uses a guarded CLI script; add an analogous green-main Actions deployment if cloud operation of the central site is desired. Keep its Lab R2 bindings, identity allowlists and privacy gates intact. Games asset deployment does not migrate central telemetry, budget state, or the scheduler.

References: [Cloudflare Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run).
