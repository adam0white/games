# Island

Read [README.md](README.md) and [HF2.md](HF2.md). This main branch is a CLI lab experiment on exact HF 2.9.0, not a browser game. Preserve simulation semantics, adapters and recorded evidence. Historical branches do not replace origin/main.

Use a managed isolated worktree from current origin/main. Use shared Node 26.12.0 and exact pnpm 12.14.0. Install with `pnpm install --frozen-lockfile`. Keep dependency policy and native build permissions in `pnpm-workspace.yaml`. Run the full check once under the shared lock: `PATH=/opt/homebrew/bin:$PATH node ~/code/human-framework/scripts/suite-lock.ts -- npm run check`. Package scripts do not acquire that lock.

Installer conversion ends with reviewed source, preserved dependency versions and fixture bytes, passing full check, signed source with `Co-Authored-By: Codex <noreply@openai.com>`, and exact green CI. Fetch/rebase origin/main before pushing. Remove only the task's merged worktree and branch after recording evidence. There is no build/dist or deployment gate for this conversion. The requester accepts the source and verification evidence; experiment acceptance remains as recorded in HF2.md. Do not run LLM providers or regenerate experiment recordings as part of installer maintenance.
