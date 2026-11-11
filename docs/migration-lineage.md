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

## Complete registry source inventory

The following source commits are retained in the candidate history. Local ancestry checks passed for all 18 entries. This table records imports; hosted CI, production verification and old-host cutover are separate gates.

| Game | Original repository | Full source commit |
| --- | --- | --- |
| rope | https://github.com/adam0white/rope | `c563ac3c03b0798ca69dc12711fa1469b31aadad` |
| hearsay | https://github.com/adam0white/hearsay | `f6737badd333a7e889a8a9abb91653aae04b370a` |
| goodhands | https://github.com/adam0white/goodhands | `b54fd4326954e5a74f5b9bd6ec1d08f07055cb6d` |
| glance | https://github.com/adam0white/glance | `6971b4d72ff0bdb3ac11b6f55119a9ebab90ec8a` |
| smallworks | https://github.com/adam0white/repair-game | `7f0ac33eaffd4c5394f2604a255320d190a61716` |
| valley | https://github.com/adam0white/valley | `f30f3f2391b2d677e0b5950fdb6ec96dac911aed` |
| murmur | https://github.com/adam0white/murmur | `de1f39829026888a4e5fba180cc6901d57fcea0a` |
| stairwell | https://github.com/adam0white/stairwell | `8ff83b59bb3149b19f0ce9a061dd0ce992937043` |
| pass | https://github.com/adam0white/pass | `c7bebaffd00a2e5b64d971d62c73b60ed3ada6c4` |
| warren | https://github.com/adam0white/warren | `e6bec0f4fc86d1b465e08e7c076e80ab8cdb19bb` |
| commonstead | https://github.com/adam0white/commonstead | `4daa46e5a0ab070f4a4a6be584366ab488092718` |
| child | https://github.com/adam0white/child | `5d9f5564100cacda1d8481f5a37c6ed45c811a51` |
| neighbours | https://github.com/adam0white/concordia | `ec3c015fda5afb0854c07f61d901107dad644ddb` |
| lefthand | https://github.com/adam0white/lefthand | `6b4e2c28edaa58579e4c4ff1544ee1c74f9c0db3` |
| days | https://github.com/adam0white/days | `b6371b31786d2f72ed863ddcfd1be592cade81fa` |
| word | https://github.com/adam0white/word | `06866be5b594313f2ca71864dc81b8f78234464d` |
| smoke | https://github.com/adam0white/smoke | `63c801e71381fc4cc4673329653a1ccc0439ff64` |
| island | https://github.com/adam0white/island | `736c4b4a74adbac62633bd69ffd0e093e63df69e` |

Island is a static recording viewer with no Lab artifact. Its native current HF4 CLI recording replays all 240 steps; its historical recording bytes remain unchanged. Interactive games use the single npm HF 4.17.0 engine and immutable client 0.5.17 / kit 0.5.34 artifacts. Archived legacy adapters and recordings retain their original versions; they are not current runtime dependencies.

The migration controls do not qualify every research campaign. Neighbours retains three fixture-dependent browser skips; Lefthand retains three source-defined browser skips and requires the hosted Linux export job; Smoke retains two source-defined WebKit CPU skips; Word retains three source-defined browser skips. Existing long-duration, admission and human playtester gates remain game-specific. Do not describe a startup check as a complete campaign or a human acceptance.
