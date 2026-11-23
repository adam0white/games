# Island in the games workspace

Island is a CLI experiment and a static viewer of recorded frames. Its current `hf4` arm uses published Human Framework 4.17.0; a current run writes a complete replay file that `node src/run.ts --verify <file>` checks against both native HF and the physical host. The viewer is built for `/island/` and does not run an engine or collect new recordings.

The retired HF 2.9 arms cannot be run from this workspace. Their original adapters and tests are retained byte-for-byte in `archive/historical/`, and all historical viewer recordings remain unchanged. Asking the CLI to start a retired arm refuses before writing a file. New random, scripted and LLM controls record `hf: none` and default to `scratch/non-hf`; historical labels are unchanged. The central `/lab/island/` viewer and recordings are independent of this migration. This monorepo path has not yet been deployed.

From the monorepo root, use `pnpm install --frozen-lockfile`, `pnpm --filter ./games/island run check`, and `pnpm --filter ./games/island run build`. Previous source notes below describe historical workflows; the workspace lock and this section govern the current migration.

---

# Island lab experiment

Island compares an HF person, LLM agents and control policies in the same small simulated island. It is a CLI experiment with a static recording viewer. The retained HF/HF2/HF3 arms pin HF 2.9.0. The separate `hf4` arm pins the published HF 4.17.0 through an npm alias; historical experiment branches are separate. [HF2.md](HF2.md) records the adapters, comparisons and limits.

Use shared Node 26.12.0 (`.node-version` and `.nvmrc`) and pnpm 12.14.0:

```sh
pnpm install --frozen-lockfile
npm run check
```

The check runs formatting/lint, TypeScript and tests. Tests use fake LLM backends. There is no build script or generated dist artifact. Recorded fixtures and viewer runs stay unchanged during installer work.

`npm run run:hf` runs the experiment CLI; `node src/compare.ts` compares retained recordings. Experiment runs and LLM provider calls require their own task scope. This installer conversion runs neither. It imports the existing npm lock without dependency-version changes. Use pnpm for dependency changes and retain `pnpm-lock.yaml`; do not regenerate an npm lock. Policy requires strict engines/peers, no hoisting, hardlinks and a 24-hour third-party release delay, with an exemption only for owned `@adam0white/*` packages. Do not provision a runtime per worktree.

## Published HF4 rerun

[HF4.md](HF4.md) records the 2026-10-28 ten-seed rerun, mapping and limits.

```sh
npm run rerun:hf4 -- /absolute/scratch/island-rerun
node src/run.ts --mind hf4 --seed 1 --out /absolute/scratch/hf4-1.json
```

The batch verifies registry latest before starting, runs seeds 1–10 with the default three free hours plus one task hour, physically replays every recording, verifies every HF archive, runs ten random controls, and independently repeats seed 1. It refuses if the registry has advanced past the exact alias. Update and document a new version deliberately before a later batch. No LLM provider is called. Existing recordings are not rewritten. `npm run check:lane` checks that the HF4 task has not changed retained adapters, recordings or dependency policy.

## Current HF 4 run — 2026-11-05

The default CLI runs published HF 4.17.0. `pnpm run run:hf -- --seed 1 --out scratch/hf417-1.json` writes a viewer recording and `scratch/hf417-1.json.replay.json`. Verify the complete export with `node src/run.ts --verify scratch/hf417-1.json.replay.json`. Verification replays the native person and regenerates every physical action and episode reset. Unsupported exports require a new run.

The `hf`, `hf2` and `hf3` experiment names describe historical arms using the separate HF 2.9.0 alias. They are preserved for earlier evidence. Existing recorded results do not become HF 4.17 results. Island remains a seeded CLI experiment and a recorded-frame viewer.

Default outputs go into version-specific `scratch/` directories. Existing recording or replay files are never overwritten. Current replay imports allow up to 100 free episodes, 10,000 recorded steps and a 16 MiB native archive.

The CLI preserves an existing recording index. Use `--publish-index` only when deliberately rebuilding that directory’s index. Batch reruns require an empty output directory. The historical `compare` command still expects the legacy baselines; the current batch command reports its own current-HF and random controls separately.

`pnpm build` stamps `viewer/release.json` with this repository’s exact commit, dirty state and current HF version. The static viewer is served at the central site’s `/lab/island/` path; its release stamp identifies Island source independently of the central deployment.
