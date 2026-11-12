# Imported source history

GitHub compared each source below to PR 5 head `64516460dd14badfd07d9ec5666881b101733f8c` on 2026-11-10. Every comparison returned `status: ahead`, `behind_by: 0`, and a merge base equal to the complete source SHA. Full unsquashed import commits are retained as parents in the monorepo graph. The clean hosted build also passed the source-ancestry checks.

| Game | Source head | Import merge |
| --- | --- | --- |
| smallworks | `7f0ac33eaffd4c5394f2604a255320d190a61716` | `c89ebd9cbd478a94bea318ffb8d92e2774441ecd` |
| valley | `f30f3f2391b2d677e0b5950fdb6ec96dac911aed` | `369d8de7599bbe4ab2cff951c2574dde52a5a523` |
| murmur | `de1f39829026888a4e5fba180cc6901d57fcea0a` | `b2c1d225c81f882846cb0e1f8679499a6d82cf09` |
| stairwell | `8ff83b59bb3149b19f0ce9a061dd0ce992937043` | `b27510e258db9c0dfae45fa221f8393ca6bbc5d8` |
| pass | `c7bebaffd00a2e5b64d971d62c73b60ed3ada6c4` | `0dff0f02113281ac439b615b0e23448645b0c1c4` |

`node scripts/check-game.mjs <slug>` and `pnpm build` run `git merge-base --is-ancestor` for the registry source commit on every candidate, except for the explicit Neighbours exception below. Clone with full history. A review snapshot can have a synthetic commit graph; use the real GitHub head and its parents to verify retained history. Do not replace other imports with a tree-only copy or squash.

## Complete registry source inventory

The following source commits identify each original import. Seventeen remain ancestors of the signed replacement candidate. Neighbours full original history is retained in Concordia, as explained below; the earlier all-eighteen candidate-ancestry claim is superseded. This table records historical import origins; some old repositories are private or archived and may not be publicly accessible. Current source lives under [`games/`](../games/). Hosted CI, production verification and old-host cutover are separate gates.

| Game | Original repository | Full source commit |
| --- | --- | --- |
| rope | https://github.com/adam0white/rope (archived private source) | `c563ac3c03b0798ca69dc12711fa1469b31aadad` |
| hearsay | https://github.com/adam0white/hearsay (archived private source) | `f6737badd333a7e889a8a9abb91653aae04b370a` |
| goodhands | https://github.com/adam0white/goodhands (archived private source) | `b54fd4326954e5a74f5b9bd6ec1d08f07055cb6d` |
| glance | https://github.com/adam0white/glance (archived private source) | `6971b4d72ff0bdb3ac11b6f55119a9ebab90ec8a` |
| smallworks | https://github.com/adam0white/repair-game (archived private source) | `7f0ac33eaffd4c5394f2604a255320d190a61716` |
| valley | https://github.com/adam0white/valley (archived private source) | `f30f3f2391b2d677e0b5950fdb6ec96dac911aed` |
| murmur | https://github.com/adam0white/murmur (archived private source) | `de1f39829026888a4e5fba180cc6901d57fcea0a` |
| stairwell | https://github.com/adam0white/stairwell (archived private source) | `8ff83b59bb3149b19f0ce9a061dd0ce992937043` |
| pass | https://github.com/adam0white/pass (archived private source) | `c7bebaffd00a2e5b64d971d62c73b60ed3ada6c4` |
| warren | https://github.com/adam0white/warren (archived private source) | `e6bec0f4fc86d1b465e08e7c076e80ab8cdb19bb` |
| commonstead | https://github.com/adam0white/commonstead (archived private source) | `4daa46e5a0ab070f4a4a6be584366ab488092718` |
| child | https://github.com/adam0white/child (archived private source) | `5d9f5564100cacda1d8481f5a37c6ed45c811a51` |
| neighbours | https://github.com/adam0white/concordia | `ec3c015fda5afb0854c07f61d901107dad644ddb` |
| lefthand | https://github.com/adam0white/lefthand (archived private source) | `6b4e2c28edaa58579e4c4ff1544ee1c74f9c0db3` |
| days | https://github.com/adam0white/days (archived private source) | `b6371b31786d2f72ed863ddcfd1be592cade81fa` |
| word | https://github.com/adam0white/word (archived private source) | `06866be5b594313f2ca71864dc81b8f78234464d` |
| smoke | https://github.com/adam0white/smoke (archived private source) | `63c801e71381fc4cc4673329653a1ccc0439ff64` |
| island | https://github.com/adam0white/island (archived private source) | `736c4b4a74adbac62633bd69ffd0e093e63df69e` |

Island is a static recording viewer with no Lab artifact. Its native current HF4 CLI recording replays all 240 steps; its historical recording bytes remain unchanged. Interactive games use the single npm HF 4.17.0 engine and immutable client 0.5.19 / kit 0.5.36 artifacts. The Lab client uses the same exact HF4.17.0 package for the retained coarse-life clock; its installed dependency graph has no legacy alias. Archived legacy adapters and recordings retain their original versions; they are not current runtime dependencies.

The migration controls do not qualify every research campaign. Neighbours retains three fixture-dependent browser skips; Lefthand retains three source-defined browser skips and requires the hosted Linux export job; Smoke retains two source-defined WebKit CPU skips; Word retains three source-defined browser skips. Existing long-duration, admission and human playtester gates remain game-specific. Do not describe a startup check as a complete campaign or a human acceptance.

Neighbours file-session pagehide checks distinguish request ordering from delivery. A real Chromium navigation control proves the SDK requests its final snapshot before host retirement. The pending-export control reconstructs a distinct complete upload and compares its full changed replay; the pending-reply control retains cancellation and people/player checks with a distinct complete upload. These do not qualify a pagehide while an earlier SDK snapshot is busy, or asynchronous delivery after actual document unload.

## Neighbours signed import — coordinator ruling, 2026-11-11

The original candidate `b685cf47fd94c52127697c4cf26a659745ebe354` passed every CI job and hosted review. Protected main rejected its unsigned upstream Concordia ancestry. A real `git subtree split --prefix=neighbours ec3c015fda5afb0854c07f61d901107dad644ddb` produced 169 unsigned commits, so it cannot satisfy signature protection either. The coordinator authorized one signed import while retaining the original repository as the full history. This supersedes the full-main-ancestry requirement for Neighbours only.

Signed import `e99d8771a8bc0a752b00e7f1499a23833f7f1a46` has exactly the qualified candidate tree `485e7631845ca631b678c81583fcea8e95ca75bc`. It retains main and the other new game source heads as parents. Its Neighbours tree is `59e20f83c4ba6353431ad42d5eb0f1a5460994e4`. The follow-up registry records that import and tree under `source.history`; release manifests include this provenance. Checks reject a missing or nonancestor import and a substituted tree. Original Concordia objects are not rewritten or re-signed. Intervening migration commits remain in the retained original candidate branch, but are not claimed as replacement-main ancestors.

The original Neighbours source is `ec3c015fda5afb0854c07f61d901107dad644ddb` at [adam0white/concordia](https://github.com/adam0white/concordia). The repository is public and archived under the 2026-11-12 ruling; retain it as the full-history source. Builds need only this monorepo. To inspect the original history in any cloud clone:

```sh
git fetch https://github.com/adam0white/concordia ec3c015fda5afb0854c07f61d901107dad644ddb
git log FETCH_HEAD -- neighbours
git show FETCH_HEAD:neighbours/package.json
git merge-base --is-ancestor e99d8771a8bc0a752b00e7f1499a23833f7f1a46 HEAD
git rev-parse e99d8771a8bc0a752b00e7f1499a23833f7f1a46:games/neighbours
```

The last command must return `59e20f83c4ba6353431ad42d5eb0f1a5460994e4`. Fetching history is an inspection step, not an install or build dependency. No archive decision, live release or redirect follows from source retention alone.

## Native source verification without upstream Git objects

The signed Neighbours import intentionally excludes unsigned upstream Git history. The native GM replay verifier formerly used `git show` on upstream commit `6fbfbc58f324aa74f78568c488713210889a801e`, so a clean Games clone could not run it. It now checks SHA256 pins for the same four critical components in `gm_director.py`, with no Git database or network dependency. On 2026-11-12 all four files independently matched both the pinned public Concordia raw URLs and GitHub contents API, including their Git blob identities. The verifier retains the original upstream SHA in report identity and refuses changed or missing bytes. It does not weaken the signed-import rule or import unsigned history. Source-only, one-byte tamper and missing-file controls cover the boundary; historical source fingerprints are not rewritten.
