> Current workflow: follow the repository-root AGENTS.md and README.md. Use the root workspace lockfile and `node scripts/prepare-game.mjs <slug>` / `node scripts/check-game.mjs <slug>` from the root. Imported standalone setup, sibling-checkout, Homebrew and Mac scratch instructions below are historical; they are not prerequisites for the current build or CI. Game rules and evidence requirements below still apply.

# Child

Current goal (owner, 2026-11-05): deliver the current published HF4 port, simplifying blocked continuous simulation and sacrificing old saves. The current episode edition keeps all five crises and explicit year skips. Read the current README before the historical design.

Done means complete five-chapter play, native replay of every episode, complete host reconstruction and export equality, tamper refusal, same-next-input continuation, signed combined source, exact hosted Codex review with no findings, green CI and a clean matching deployed release.json. The owner accepts game feel separately. The old continuous-calendar qualifiers remain historical failures; do not relabel the episode workload as those passes. No multiplayer or account transfer.

Use an isolated worktree. Run check:lane before commits. Use pnpm install --frozen-lockfile. Keep explicit native build permissions and a 1440-minute third-party release delay. Keep evidence and historical fixtures unchanged. The current test timeout bounds multi-episode evidence tests; it is not an interaction latency claim. Public files identify a human playtester only with those words.

Stack: Node 26.12.0, pnpm 12.16.1, TypeScript 7.0.2, Vitest 5.1.0, Biome 2.6.5, Wrangler 4.157.0, HF 4.17.0.
