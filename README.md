# Island lab experiment

Island compares an HF person, LLM agents and control policies in the same small simulated island. It is a CLI experiment with a static recording viewer. This main branch pins HF 2.9.0; historical experiment branches are separate. [HF2.md](HF2.md) records the adapters, comparisons and limits.

Use shared Node 26.12.0 (`.node-version` and `.nvmrc`) and pnpm 12.14.0:

```sh
pnpm install --frozen-lockfile
npm run check
```

The check runs formatting/lint, TypeScript and tests. Tests use fake LLM backends. There is no build script or generated dist artifact. Recorded fixtures and viewer runs stay unchanged during installer work.

`npm run run:hf` runs the experiment CLI; `node src/compare.ts` compares retained recordings. Experiment runs and LLM provider calls require their own task scope. This installer conversion runs neither. It imports the existing npm lock without dependency-version changes. Use pnpm for dependency changes and retain `pnpm-lock.yaml`; do not regenerate an npm lock. Policy requires strict engines/peers, no hoisting, hardlinks and a 24-hour third-party release delay, with an exemption only for owned `@adam0white/*` packages. Do not provision a runtime per worktree.
