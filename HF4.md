# Published HF4 Island rerun, 2026-10-28

The ten-seed batch and replay checks are complete. Merge/review acceptance is recorded in the PR and coordinator report. This is a new public-Run adapter experiment. It is not a matched migration of the historical HF5/HF6 host and does not estimate an engine-version effect.

## Version and commands

The batch checks `npm view @adam0white/human-framework version` immediately before running. It freezes the exact published alias `hf4: npm:@adam0white/human-framework@4.5.1`; the original `@adam0white/human-framework: 2.9.0` and all old adapters/recordings remain unchanged. No LLM is called.

```sh
PATH=/opt/homebrew/bin:$PATH pnpm install --frozen-lockfile
# After adding the exact npm alias:
PATH=/opt/homebrew/bin:$PATH pnpm install --lockfile-only
PATH=/opt/homebrew/bin:$PATH pnpm exec vitest run test/hf4.test.ts
PATH=/opt/homebrew/bin:$PATH npm run rerun:hf4 -- /Users/abdul/code/.lab-scratch/codex/island-rerun
PATH=/opt/homebrew/bin:$PATH node /Users/abdul/code/human-framework/scripts/suite-lock.ts -- npm run check
PATH=/opt/homebrew/bin:$PATH npm run check:lane
```

`node src/run.ts --mind hf4 --seed 1 --out /absolute/scratch/hf4-1.json` runs one arm. The batch's output directory contains recordings, seed-1 HF archive and `summary.json`. Seeds are 1–10. Each seed gets three 60-action free episodes and one 60-action task episode. The task is “Put as many cubes as you can on the Spire before the hour ends.” Each action lasts 60,000 HF milliseconds. Closed HF input lanes require a 1 ms gap before each later decision: 239 ms over the default 240 actions, without an added physical island action. Island resets between episodes; the HF person and run persist.

## Authored mapping

`src/minds/hf4.ts` imports only the public published Run API. It never imports the world. Each legal island input produces exactly one offer. The host accepts HF's chosen start request and settles its finish request with the following observation. The last episode action is settled by `endEpisode` once. A separate physical replay uses the world engine after decisions; it cannot influence the mind.

Walk, jump, pick, place, throw, rest and look have distinct action semantics, target identities and relative places. The body tracks its own legal moves from the reset origin. At each decision, visible objects, observation text and actual events enter the public percept channel. The closing action also returns its outcome summary and observed progress before an episode reset. The full text is context; the adapter also supplies object identities/locations as structured percepts. Throw offers use the launch/adjacent direction as a prior, never a predicted landing. Observed throw events remain evidence rather than a hidden physics model.

As in the historical HF5 host, the observed Spire landmark and visible ring cells supply `arrange` prospects. Their materials are only visible/carried cubes; observed progress is visible cubes on the cell divided by the authored ten-cube target, bounded to [0,1]. The landmark remains visible from anywhere, but its contents are unknown outside ordinary object sight (radius 4, or radius 7 after the observed look result). Such prospects omit progress, and outcomes omit observedProgress for them; leaving sight never asserts zero contents. Placement offers advance a matching prospect; picking from its cell diminishes it. Outcome progress is reported from current sight, including losses of progress. The same prospects and offers apply in free and task time. HF owns project adoption, abandonment, persistence and choice. Only the stated task introduces an explicit goal; only a completed cube placement on the observed Spire has its endpoint action. Picks, moves and throws receive no task progress.

The public package exports no authoring helper. `hf4-authoring.ts` adapts the explicit HF4 minimal example: adult male, healthy body, no norms/skills/relationships, otherwise the example's engineering priors, with openness/stimulation 0.9 to express the shared curious persona. HF4's default will and all faculties remain on. There are no legacy enable switches or mutable-person calls. There are no supplied food/drink actions; bodily drift can affect choices.

Expected leisure is 0.02 for manipulation, 0.01 for look and 0.004 otherwise; manipulation also expects competence 0.01. Actual psychological feedback uses those same values on the first action/target/place effect and 20% on repeats. This deterministic host habituation is an authored engineering assumption, not a fitted human parameter or a claim that every manipulation succeeds at a project. Walk effort is 0.08, jump 0.18, manipulation 0.08 with focus 0.03; other effort is zero. HF's own learning and affect consume these outcomes.

## Evidence boundary

This arm supplies public project prospects and undo metadata, but a run with zero project progress does not demonstrate that undo protection or net-credit works. Focused tests prove offer and receipt wiring; engine regression tests remain the authority for those mechanisms. The batch counts public HF goals and physical pursuit separately. Goal adoption is not project completion, and physical repeated pursuit is weak behavioral evidence.

This adapter supplies neither remembered-target navigation nor received successor chains, unlike the historical HF5/HF6 adapters. It supplies no path finder, task executor, hidden terrain, unseen cube positions or recipe knowledge. The ten-seed result describes this authored public-Run configuration. A negative task result does not establish that HF4 cannot plan or that it regressed against an older engine. A later matched adapter experiment is separate work, not an inferred improvement from these numbers.

## Results

Registry latest was **4.5.1** at batch start `2026-10-28T05:55:23.450Z`; batch finished `2026-10-28T05:58:09.242Z` (machine ISO timestamps). All ten seeds adopted one free-time arrangement project. All ten reached zero project progress, placed zero free-time Spire objects, showed zero repeated pursuit and finished the task with zero Spire cubes. These runs do not demonstrate project completion or the efficacy of undo protection/net-credit.

| Seed | Cells | Kind entropy | Manipulation share | Idle share | Free Spire objects | Free tallest stack | Repeated pursuit | Task cubes | Project adoptions | Max project progress |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 26 | 2.574247 | 0.194444 | 0.327778 | 0 | 1 | 0 | 0 | 1 | 0 |
| 2 | 24 | 2.542392 | 0.200000 | 0.483333 | 0 | 2 | 0 | 0 | 1 | 0 |
| 3 | 26 | 2.588978 | 0.216667 | 0.483333 | 0 | 1 | 0 | 0 | 1 | 0 |
| 4 | 29 | 2.495714 | 0.166667 | 0.494444 | 0 | 1 | 0 | 0 | 1 | 0 |
| 5 | 26 | 2.537967 | 0.155556 | 0.461111 | 0 | 1 | 0 | 0 | 1 | 0 |
| 6 | 28 | 2.342369 | 0.222222 | 0.244444 | 0 | 1 | 0 | 0 | 1 | 0 |
| 7 | 26 | 2.473315 | 0.122222 | 0.450000 | 0 | 1 | 0 | 0 | 1 | 0 |
| 8 | 27 | 2.562280 | 0.244444 | 0.288889 | 0 | 1 | 0 | 0 | 1 | 0 |
| 9 | 33 | 2.523464 | 0.200000 | 0.500000 | 0 | 2 | 0 | 0 | 1 | 0 |
| 10 | 28 | 2.525479 | 0.211111 | 0.233333 | 0 | 2 | 0 | 0 | 1 | 0 |

Comparison with ten freshly generated random controls, same terrain seeds and episode configuration. Statistics recompute `measureRecording` from frames for both arms, including controls whose serialized metric schema remains legacy-shaped. Exact unpaired permutation tests enumerate all C(20,10) allocations and include ties; one eight-test Holm family. This is exploratory, not a preregistered hypothesis test. A nonsignificant difference does not establish equivalence.

| Measure | HF4 median | Random median | Exact p | Holm p |
|---|---:|---:|---:|---:|
| cellsVisited | 26.50000000 | 41.50000000 | 0.00101756 | 0.00508779 |
| kindEntropy | 2.53172301 | 1.98565399 | 0.00001083 | 0.00008660 |
| manipulationShare | 0.20000000 | 0.03888889 | 0.00002165 | 0.00015155 |
| idleShare | 0.45555556 | 0.21666667 | 0.00012990 | 0.00077941 |
| freeSpireObjects | 0.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| freeMaxStack | 1.00000000 | 1.00000000 | 1.00000000 | 1.00000000 |
| repeatedPursuit | 0.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| taskScore | 0.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |

After Holm correction, this configuration visits fewer cells and has higher entropy, manipulation share and idle share than random. There is no detected difference in the four physical/project endpoint measures. This does not isolate any HF mechanism.

Free-time action composition, pooled over 1,800 actions per arm:

| Arm | move | jump | look | rest | pick | place | throw |
|---|---:|---:|---:|---:|---:|---:|---:|
| hf4 | 0.231667 | 0.178333 | 0.201111 | 0.195556 | 0.097222 | 0.045556 | 0.050556 |
| random | 0.371111 | 0.366111 | 0.119444 | 0.096111 | 0.023889 | 0.008333 | 0.015000 |

## Verification

All 2,400 HF4 actions and 2,400 random-control actions physically replayed with exact events, body cells, carrying state and object positions. Public `replay` verified all ten HF archives and returned their exact full hashes. A fresh independently constructed seed-1 run reproduced both its recording and HF archive hash. The focused test also verifies `restoreRun` round-trip, one offer per legal input, free/task offer identity, endpoint-only task semantics, pickup undo metadata and exact settlement count.

| Seed | Recording SHA-256 (compact JSON) | HF archive full hash |
|---|---|---|
| 1 | `58b9fcf86894f327b32f962a1be28cf92f9a8f8bd56b3fd80ae48fb27f32be0d` | `1ad5ddcf8f7ab558796fa412d0b1d8c66d742a25acd853c7aa6fcb3af3e2a845` |
| 2 | `12a112d08b622e6c6fe0a9b3c3785c2ee74182bc931fb49d8f2b65a424fad5f3` | `5840ca8787c088da77a3448c6d220ee9b63d916d873f5cdae9fee68ed2b55857` |
| 3 | `ed56eeb658f8fcf3c0ea8eef58e2b0e59da50561720aec5ffb3f21a32ccdb987` | `a09553d83debe544d0915e841fec60d33f17c0aa3b612e45ab6e03352ebd053e` |
| 4 | `1f1cc4625740f7a182a980e9cd334908a10f2f13e5ebbfecf0c960c448d0bd0d` | `b7307bc48e1c347fa6bc7eed41940e01850737a9fc202469e8e17e8d1390ddce` |
| 5 | `30055a4903588c6524472ae8194162a02c9695481fa7a4d677cb2e63b8891106` | `552cda4a962e44a867a50632f19211eb9dc752eee02cf32847cc8d628d72296f` |
| 6 | `5ab6185ab9471323c8b0c4e64a7dad13c08b4cc82816a0bc00710e3aaed3416f` | `f4e832839cc904c614bbacabe71764c97a1d14cd02936d12691178d0dedae62c` |
| 7 | `6841474004721faeb57c7371a754a8ba4a4e1f4a4756897d95fa81634335bcb1` | `47e83e2fedb801af1a76935c155eea5219872cb626f8fb4a61a5820c55471918` |
| 8 | `c523a6ca51a8bab0180214925c4a79d68901a04dc9af548685572d23e86af656` | `5b63ba6445014ed3de2c4ed28998ca94cdaa87cebae58883daf2d84623bfd178` |
| 9 | `445c369fc06d4d2e8097532c4c9a98abd407a447d7da7a06755453f972bd04bd` | `ff046196a7d57d4c15dbb0815634cf29a626550e42e1459b3b406a85bcb4b176` |
| 10 | `50548de2fef46a436c9bd9b504b5df66444932f9f3ce396e11153940e0c0b139` | `01c27c5cc17414093727e3a911ae07c32a3dedf59b28c501431f20c533a6c1e0` |

Seed-1 independent repeat recording hash is `58b9fcf86894f327b32f962a1be28cf92f9a8f8bd56b3fd80ae48fb27f32be0d`. The old adapters, 83 retained viewer recordings and fixture bytes remain unchanged; the existing legacy replay-hash test remains. The batch stores only new evidence in `/Users/abdul/code/.lab-scratch/codex/island-rerun`. No dev server or browser was started.

The initial statistics postprocessor read missing extra metrics from legacy-shaped random records as zero. It was corrected to recompute metrics from frames before reporting; no actor recording changed. Reproduce analysis alone with:

```sh
PATH=/opt/homebrew/bin:$PATH npm run rerun:hf4 -- /Users/abdul/code/.lab-scratch/codex/island-rerun --summarize
```

Focused tests: 5 passed. Full check and hosted-review outcome are recorded in the PR and coordinator report. No app deploy or `/release.json` gate applies to this CLI repository.

The one hosted Codex review found P2: the global Spire landmark had been mistaken for observed contents outside object sight. The fix omits unknown prospect progress and corresponding outcome progress. The corrected ten-seed batch above supersedes the initial batch (`2026-10-28T05:46:31.220Z`–`2026-10-28T05:49:14.149Z`), retained at `/Users/abdul/code/.lab-scratch/codex/island-rerun-initial/summary.json` with its original recording/archive hashes. Every recording hash and reported statistic stayed unchanged; every HF archive hash changed because the corrected input logs omit false zero evidence. The superseded seed-1 archive hash was `20ffc21f3c3eb7b8879d8194976404d842923f8f8863993459a2a5de27549047`. The new sight-boundary regression verifies unknown at distance 5, observed 0.1 after look, observed zero at an empty nearby cell, and omission from actual outcome progress. No second review was requested.
