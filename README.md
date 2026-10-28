# Island lab experiment

Island compares an HF person, LLM agents and control policies in the same small simulated island. It is a CLI experiment with a static recording viewer. The retained HF/HF2/HF3 arms pin HF 2.9.0. The separate `hf4` arm pins the published HF 4.5.1 through an npm alias; historical experiment branches are separate. [HF2.md](HF2.md) records the adapters, comparisons and limits.

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
