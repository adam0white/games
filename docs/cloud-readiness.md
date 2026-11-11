# Cloud readiness audit — 2026-11-10

Games implementation is staged on MIGRATE cloud branch. Automatic production deployment cannot succeed until the owner adds the named Actions secret. No token was read or installed. An Actions deployment has not yet been verified.

## Games

The build, checks and deployment resolve packages inside the workspace. All game engines pin the registry npm version. The former Homebrew Node PATH override in root deployment is removed; setup-node supplies Node in Actions. Build output, deployment checkouts and package dependencies are regenerable. Original repos, evidence and exports are not.

Deployment runs only after successful same-repo push CI on main. It checks current main again before upload, builds all games, and compares every live manifest. See root README for owner setup and cloud commands. A green build is not a live verification. The old-host redirect configuration is separate from automatic asset deployment and must be checked per game.

## Human Framework

Read-only audit of remote main `2ecdd895552546537541f1058202249660c5894a`, fetched in this session. Rechecked against merged `33ed47e7822abb52064d940807ec44699cce3b26`: only the queue fix, client/kit versions, client tests/docs and lock changed; the operational files below are unchanged, and that delta adds no Mac path assumption. Rechecked again at merged `7605561564998230d2632fb8209f7c6a902d9e09`: the deferred-recording/dialog correction changes only the two Lab packages and lockfile; the listed operational assumptions remain unchanged. Its existing CI already uses Linux setup-node/pnpm. The following operational assumptions remain; this audit does not claim they are fixed.

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

| Location | Mac/local assumption | Cloud replacement |
| --- | --- | --- |
| `apps/site/scripts/watch-phone-layout.ts:23,27` | Absolute Playwright import from an unrelated scratch checkout; phone artifacts under home/code scratch | Import declared Playwright package; write test-owned output to a configurable runner artifact directory. |
| `packages/playtester/adapters/{pass,glance,voices,warren}.ts` and examples | Default game source checkouts under home/code; environment variables can override | Point `PASS_DIR`, `GLANCE_DIR`, `MURMUR_DIR`, `WARREN_DIR`, `SMALLWORKS_DIR` and `NEIGHBOURS_DIR` at the monorepo subdirectories in a cloud checkout. Record source SHA. Qualify each adapter against the current game's edition instead of assuming old adapters work. |
| `packages/playtester/README.md` | Old instructions symlink node_modules from local repo and read historical refs in that repo | Use isolated immutable source worktrees or repository archives and frozen installs; never borrow a Mac sibling dependency tree. |
| Root README | Homebrew PATH guidance | Add portable pinned Node/pnpm setup alongside optional Mac guidance. |
| `packages/lab-kit/test/lab-inbox.test.ts:179` | Budget test directory under a mocked home/code scratch location | Use test-owned temporary directories and explicit cleanup. |
| Curated historical Lab records and voice blocker notes | Local artifact links and old absolute extraction paths | Preserve provenance; upload approved artifacts to durable private storage, store stable receipt identifiers and export hashes. Do not erase original notes merely because they contain a local path. |

The installed Mac scheduler and its persistent budget/admission state are documented separately. Current local Git signing uses SSH format; no key was read. A cloud session must supply signing that satisfies branch protection without depending on this Mac's key paths. The presence of local signing configuration does not prove a chosen cloud provider already supports it.

Small Works retains the old Repair experiments archive on its existing origin. Its eventual redirect uses a selective zone rule, excluding `/experiments`, its descendants and `/sw.js`. Set `redirectMode: "zone"` only with a directly verified release; the same live-release gate applies, but the asset Worker must claim only the exact old `/sw.js` route to return the same-origin unregister script. It rejects other old-origin paths. The zone rule, retained archive and an existing service-worker registration need independent live checks; preflight does not inspect the zone configuration. All other aliases use exact Worker host routes, including their old service-worker retirement response.


## Retained research tools

The current build and CI do not run the historical synthetic-person harnesses. Retained Glance `scripts/playtester/hf-session.ts`, Good Hands and Hearsay `scripts/hf-playtest/run.ts`, and Valley `scripts/hf-playtest.ts` still refer to a separate HF playtester source tree. That private harness is not the game's engine dependency and is not an npm publication. A cloud run of those optional tools needs an explicitly pinned HF tool checkout and adapter qualification; do not treat their old Mac defaults as setup instructions or current player evidence. Good Hands' historical browser driver also writes under a Mac scratch convention. These are proposed follow-up replacements: require explicit tool/output paths, import the declared Playwright package, and retain source SHA and export hashes. The normal cloud clone, frozen install, checks, build and deploy use no such checkout. Current game engines resolve only the pinned npm HF package. The shared Lab SDK additionally retains the published npm HF3.0 alias for its existing coarse-life clock. That is a separate SDK dependency, not a sibling checkout or a current game-engine pin; the complete lockfile is not single-version.

All imported interactive games adopt immutable client 0.5.18 and kit 0.5.35 artifacts from signed green HF main `76055615`. Shared-origin queued recordings retain their original game and only that game may retry them; other games still count toward the shared capacity bound. Deferred recording is supported only with preserving initialization and rejects unsupported calls before side effects. The nine lazy file adapters leave pending delivery inactive until explicit recording or Share play; an unshared feedback note stays unlinked. Local native/file and actual captured-prefix replay controls remain required per game. Previously loaded tabs keep their old SDK until refreshed. Publication does not update central or old external bundles.


## Build tool integrity

Lefthand pins Godot 4.7.2 editor archive SHA-256 values from the official `godotengine/godot-builds` release API, independently compared with its published SHA512-SUMS. The Linux executable hash is derived from the verified Linux archive. Both web template member hashes were derived only after downloading and checking the complete official template archive against both published digests. `games/lefthand/scripts/setup-godot.py` contains the exact pins and verifies archive/member bytes before extraction or use, including cached tools. Mac caches require the complete app tree, modes and absence of extra files to match a checksum-verified archive. Linux caches require the verified executable member hash. Build failure preserves the refusal; do not bypass a mismatch by running the cached binary. The seven Python integrity controls run through the game's additive `ci:check`.

Official provenance: https://github.com/godotengine/godot-builds/releases/tag/4.7.2-stable . These checks authenticate the observed official bytes; they do not provide an OS sandbox. Deployment passes a credential-stripped environment to package installation, build and preflight subprocesses; only the Wrangler upload receives upload credentials. Same-user process access and local OAuth files are outside that inheritance control.
