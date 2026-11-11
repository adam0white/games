# Imported source history

GitHub compared each source below to PR 5 head `64516460dd14badfd07d9ec5666881b101733f8c` on 2026-11-10. Every comparison returned `status: ahead`, `behind_by: 0`, and a merge base equal to the complete source SHA. Full unsquashed import commits are retained as parents in the monorepo graph. The clean hosted build also passed the source-ancestry checks.

| Game | Source head | Import merge |
| --- | --- | --- |
| smallworks | `7f0ac33eaffd4c5394f2604a255320d190a61716` | `c89ebd9cbd478a94bea318ffb8d92e2774441ecd` |
| valley | `f30f3f2391b2d677e0b5950fdb6ec96dac911aed` | `369d8de7599bbe4ab2cff951c2574dde52a5a523` |
| murmur | `de1f39829026888a4e5fba180cc6901d57fcea0a` | `b2c1d225c81f882846cb0e1f8679499a6d82cf09` |
| stairwell | `8ff83b59bb3149b19f0ce9a061dd0ce992937043` | `b27510e258db9c0dfae45fa221f8393ca6bbc5d8` |
| pass | `c7bebaffd00a2e5b64d971d62c73b60ed3ada6c4` | `0dff0f02113281ac439b615b0e23448645b0c1c4` |

`node scripts/check-game.mjs <slug>` and `pnpm build` run `git merge-base --is-ancestor` for the registry source commit on every candidate. Clone with full history. A review snapshot can have a synthetic commit graph; use the real GitHub head and its parents to verify retained history. Do not replace the imports with a tree-only copy or squash.
