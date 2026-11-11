## Monorepo migration, 2026-11-11

This copy uses the games workspace and the exact npm HF 4.17.0 package. The retired HF 2.9 arms are archived as historical source and are explicitly refused by the current CLI. Their recordings are unchanged. The viewer is a non-recording static site at `/island/`; keep the central `/lab/island/` routes and data untouched. The monorepo `AGENTS.md` governs checks, commits and deployment. Historical instructions below describe the original repository and do not restore its separate engine alias.

# Island

Read [README.md](README.md) and [HF2.md](HF2.md). This main branch is a CLI lab experiment, not a browser game. The default arm uses exact published HF 4.17.0. Retained historical arms use HF 2.9.0 through the explicitly historical hfLegacy alias. Historical recordings are not current HF runs. Preserve simulation semantics, adapters and recorded evidence. Historical branches do not replace origin/main.

Use a managed isolated worktree from current origin/main. Use shared Node 26.12.0 and exact pnpm 12.16.1. Install with `pnpm install --frozen-lockfile`. Keep dependency policy and native build permissions in `pnpm-workspace.yaml`. Run the full check once under the shared lock: `PATH=/opt/homebrew/bin:$PATH node ~/code/human-framework/scripts/suite-lock.ts -- npm run check`. Package scripts do not acquire that lock.

Installer conversion ends with reviewed source, preserved dependency versions and fixture bytes, passing full check, signed source with `Co-Authored-By: Codex <noreply@openai.com>`, and exact green CI. Fetch/rebase origin/main before pushing. Remove only the task's merged worktree and branch after recording evidence. There is no build/dist or deployment gate for this conversion. The requester accepts the source and verification evidence; experiment acceptance remains as recorded in HF2.md. Do not run LLM providers or regenerate experiment recordings as part of installer maintenance.

The 2026-10-28 roadmap rerun ends with ten default HF4 seeds, recorded commands/per-seed numbers/limits in HF4.md and human-framework docs/findings.md, physical and public archive replay, an independent seed-1 repeat, a random headless control, passing checks, one hosted Codex review, signed source and exact green merged CI. The requester accepts source and evidence; negative results complete the rerun. Preserve old adapter and recording bytes. No deployment gate applies to this CLI experiment.

## Current upkeep, owner 2026-11-05

Move the current default to published HF 4.x. Preserve historical experiment meaning and fixture bytes. Current CLI runs write a viewer recording and a complete `.replay.json` file. Verify it with `node src/run.ts --verify <file>`. Done means exact reviewed green source, a current recorded run with HF and host replay, a deployed viewer and central listing. The owner accepts game feel separately. The earlier no-deployment scope applied only to installer maintenance and the October experiment.

Stack: TypeScript 7.0.2, Vitest 5.1.0, Biome 2.6.5, published HF 4.17.0. Historical arms retain exact HF 2.9.0; current runs and native replay use 4.17.0.
