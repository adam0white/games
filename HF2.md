# Island HF2 experiment

Done means: four corrected deterministic HF2 arms, ten seeds per requested arm, byte-identical legacy recordings, a reproducible exact comparison with Holm correction, passing checks, and a signed local commit. The requester accepts the code and recorded evidence. No remote or publication is part of this work.

Run the comparison with `node src/compare.ts`. Run an arm with `node src/run.ts --mind hf2 --seed 1 --out /absolute/path/run.json`. The CLI regenerates the index beside its output. Scratch results are in `/Users/abdul/code/human-framework/scratch/island2/`. No LLM calls were made. HF remains pinned to 2.9.0.

## Adapter

`src/minds/hf2.ts` uses the same createPerson specification as hf. It encodes every observed object, carried object, Spire and event with a target and place. Places are coordinates relative to the reset origin; observations give offsets rather than absolute grid coordinates. The body tracks its own legal movements. It never imports the world or reads unseen object state. A throw onto land reports its landing offset; a loss reports no landing cell, so that event records the observed launch cell.

HF recall supplies object-directed movement offers, including objects outside current sight. Cue recall is fuzzy in HF, so the adapter filters exact identities after recall. Current sight supersedes older memories. Memory can forget or be stale. Every HF2 arm now supplies exactly one offer per legal input. Movement merges all targets approached by that input into its label. The first currently visible target in observation order is the representative targetId/placeId; if none is visible, the most recently recalled target is the representative (episode id breaks equal-minute ties). That representative controls HF target-specific scoring and the fromMemory flag. Other targets appear only in the label. The movement effect target/place, advertised effects, effort, goal links and all other adapter mechanisms remain unchanged. Memory no longer adds sampling weight by duplicating movement inputs. This is not evidence of HF planning.

Each chosen action begins one activity and lives one minute. Its next observation closes that activity with only its observed effects. The closing episode observation handles the last action once. Leisure and competence outcomes teach HF's action/target expectations. Effect novelty counts event kind, object/body and place in HF memory, with 30-minute habituation recovery. Future throw landings are unknown; their offers use the launch place as a prior, while actual throw feedback uses the reported landing. No throw physics or hidden recipe is supplied.

Engagement has a four-minute half-life. New routine movement stimulates by 0.12; half-habituated movement stimulates by 0.06. Their steady engagement values are 0.46 and 0.29, either side of the 0.35 boredom line. New manipulation/discovery stimulates by 0.55, look by 0.18 and rest by 0.04. The first calibration gave every new effect 0.55 and kept every normal HF2 run above the line. It was revised to satisfy the dynamics requirement before the final reported runs; no claim of preregistration is made.

## Public API limits and goals

HF 2.9.0 `dist/person.js:tick` calls `dist/agenda/agenda.js:proposeGoals` on hourly grid boundaries. Starting at noon, the 240 actions reach minutes 780, 840, 900 and 960. The adapter also calls the public proposeGoals path at those boundaries. It is idempotent with the tick call. Every goal is recorded in frame inner.goals with label, adoption minute, source, proposed/adopted flags and current status. HF's proposals adopt immediately. Final goal status is merged into the last frame after its outcome.

In all forty HF2 recordings, no free-time goal is proposed. The largest eligible psychological urgency at the end is 0.013864, far below proposeUrgency=0.6. HF has templates for belonging, competence, esteem and meaning, and allows at most one proposal per day. No threshold or persona was changed. A test lowers competence with public satisfy, restricts actions to rest, and confirms the hourly proposal/adoption of master-skill at lived minute 60 and its links to manipulation offers. This diagnostic is not one of the reported seed runs.

HF 2.9.0 `dist/types.d.ts:Affordance` has no serves field or spatial goal predicate. `dist/agenda/agenda.js:agendaTerms/onFinished` matches goal action names or explicit advances ids; placeId does not imply means toward a goal. The adapter declares serves as host metadata and maps honest need effects to explicit links for HF-proposed goals. It uses the same offers in free and task time. The stated task adopts a goal matching the semantic action island:place:cube@Spire. Placement endpoint semantics are declared even without a task. Walking or picking gets no task-specific link. Consequently this is the closest direct-action goal version, not a task planner. It has no taskAdvances equivalent. Each qualifying placement contributes 0.1 goal progress; ten placements achieve the bounded goal, while taskScore counts actual final cubes and can differ after removals.

Ablations: no-boredom skips only engagement-driven boredom injection; ordinary HF tick remains. No-memory encodes no placeId, uses object-only effect novelty, and supplies object-directed movement only for currently visible objects. No-goals still lets HF tick propose and logs proposals, but removes all goal pull, including direct task-action matching.

## Measurement

Existing metric values are unchanged. Legacy arms retain the pilot JSON measure schema to preserve byte hashes. measureRecording recomputes the added metrics for comparison without rewriting pilot files. HF2 recordings include the added fields. The comparison's tallest stack is freeMaxStack; the original maxStack still spans free and task episodes.

Repeated pursuit counts an episode-local carrying bout when at least two carried moves reduce Manhattan distance toward its eventual observed destination. At an episode boundary, a still-carried object's endpoint is the last body cell. Losses have no inferred destination. Each bout counts once. This physical measure applies to random too; it is weak behavioral evidence and cannot establish an intention or a project. It is not a count of self-authored projects.

Remembered-target moves count selected object-directed movement offers whose representative target was absent from current sight, across all four episodes. An unseen target listed alongside a visible representative does not increment this count. freeRememberedTargetMoves is also available. Goals are counted by unique HF ids in the HF2 audit; older pilot files did not record goal identities. Boredom means/minima/maxima use available frame readings, including the closing outcome for the last HF2 frame.

The test enumerates all C(20,10)=184756 allocations and compares the absolute difference of means, including ties. Samples have ten seeds each. Medians describe each arm. The test is unpaired despite matched terrain seeds. Holm step-down correction uses one eight-test family per arm-vs-random block: seven free-time measures plus task score. Each task-score comparison vs hf is a singleton family. The retained hf2-vs-ablation comparisons each form a two-test family. Families are exploratory and are not jointly corrected; a large p is not evidence of equivalence.

## What changed

Commit 601f6bf offered a base movement plus one movement offer per approached target. This inflated movement probability and confounded the memory ablation. The correction merges them into one offer in hf2 and all three ablations. A regression test covers visible and recalled target collisions in each arm. The test first failed on the duplicated inputs, then passed after the merge.

All forty hf2* recordings were overwritten for seeds 1–10. No legacy recording was overwritten. The index was regenerated. The comparison now includes all requested free-time measures for hf, hf2, hf2-no-memory and hf2-no-boredom against random, task score against random and hf, and Holm-adjusted p values. The hf baseline is not compared with itself. The full output is saved as `compare2.md` in scratch.

Free-time move share is now 48.7% for hf2, 45.8% for hf2-no-memory and 37.1% for random, pooled over ten seeds. These shares count move inputs only; jumps are separate. The old 67.8%/54.4% movement contrast was confounded by duplicate offers and is superseded by this rerun.

## Verification

Each corrected HF2 arm was run twice for seeds 1–3; all twelve SHA-256 pairs matched, and each pair matches its saved viewer recording. Scratch `determinism2.json` records both hashes. Every one of the 33 legacy JSON recordings, including LLM recordings, is byte-identical to the starting commit. No LLM mind was called. Scratch `legacy-hashes2.json` records their hashes. All 12,480 offer lists across forty runs and twelve repeats contained exactly one offer per legal input. The regenerated index contains 73 recordings. All 73 recordings were physically replayed against the world engine and passed the viewer validator. The hf seed 1 regression test retains SHA-256 4e4826d03a20956f54b581eedea3777e551c595837867ec67855ab4186af924d. `npm run check` passes all 106 tests.

## Results

With Holm-adjusted p < 0.05, hf differs from random in fewer cells visited, higher action-kind entropy and higher manipulation share. Corrected hf2 differs only in higher idle share. hf2-no-memory differs in higher entropy, manipulation share and idle share. hf2-no-boredom differs only in higher idle share. No requested arm has a detected difference in free Spire objects, free tallest stack or repeated pursuit. No task-score comparison is significant. These results are exploratory; nonsignificance does not establish equivalence.

No HF-proposed free-time goal appears. All seven free-time metric samples for hf2-no-goals exactly match hf2, so the same higher-idle-share result applies. Recalled-target movement demonstrates memory use; it does not demonstrate project formation. These runs do not support a claim that HF2 builds self-directed projects.

Exact unpaired permutation tests of absolute mean differences, including ties. Medians describe samples. Holm correction uses one eight-test family per arm vs random (seven free-time metrics plus task score), one singleton family per task-score comparison vs hf, and one two-test family per hf2 ablation comparison. Families are exploratory and are not jointly corrected; large p values do not establish equivalence. The hf baseline has no task comparison with itself.

| Comparison | Measure | Median A | Median B | Exact p | Holm p |
|---|---|---:|---:|---:|---:|
| hf vs random | Cells visited | 21.5000 | 41.5000 | 0.000368 | 0.002576 |
| hf vs random | Kind entropy | 2.2745 | 1.9857 | 0.000076 | 0.000606 |
| hf vs random | Manipulation share | 0.0889 | 0.0389 | 0.003009 | 0.018056 |
| hf vs random | Idle share | 0.2750 | 0.2167 | 0.022949 | 0.114746 |
| hf vs random | Spire objects | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf vs random | Tallest stack | 1.0000 | 1.0000 | 0.582043 | 1.000000 |
| hf vs random | Repeated pursuit | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf vs random | Task score | 0.0000 | 0.0000 | 0.210526 | 0.842105 |
| hf2 vs random | Cells visited | 36.0000 | 41.5000 | 0.160146 | 1.000000 |
| hf2 vs random | Kind entropy | 2.0537 | 1.9857 | 0.160255 | 1.000000 |
| hf2 vs random | Manipulation share | 0.0639 | 0.0389 | 0.217314 | 1.000000 |
| hf2 vs random | Idle share | 0.3111 | 0.2167 | 0.000314 | 0.002511 |
| hf2 vs random | Spire objects | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs random | Tallest stack | 1.0000 | 1.0000 | 1.000000 | 1.000000 |
| hf2 vs random | Repeated pursuit | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs random | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2-no-memory vs random | Cells visited | 37.0000 | 41.5000 | 0.320791 | 1.000000 |
| hf2-no-memory vs random | Kind entropy | 2.2009 | 1.9857 | 0.000650 | 0.005196 |
| hf2-no-memory vs random | Manipulation share | 0.1000 | 0.0389 | 0.002078 | 0.012471 |
| hf2-no-memory vs random | Idle share | 0.3028 | 0.2167 | 0.001028 | 0.007199 |
| hf2-no-memory vs random | Spire objects | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2-no-memory vs random | Tallest stack | 1.0000 | 1.0000 | 1.000000 | 1.000000 |
| hf2-no-memory vs random | Repeated pursuit | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2-no-memory vs random | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2-no-boredom vs random | Cells visited | 41.0000 | 41.5000 | 0.616251 | 1.000000 |
| hf2-no-boredom vs random | Kind entropy | 2.0482 | 1.9857 | 0.196540 | 1.000000 |
| hf2-no-boredom vs random | Manipulation share | 0.0667 | 0.0389 | 0.098974 | 0.692816 |
| hf2-no-boredom vs random | Idle share | 0.3083 | 0.2167 | 0.000455 | 0.003637 |
| hf2-no-boredom vs random | Spire objects | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2-no-boredom vs random | Tallest stack | 1.0000 | 1.0000 | 1.000000 | 1.000000 |
| hf2-no-boredom vs random | Repeated pursuit | 0.0000 | 0.0000 | 0.303406 | 1.000000 |
| hf2-no-boredom vs random | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf2-no-memory vs hf | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf2-no-boredom vs hf | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf2 vs hf2-no-boredom | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf2-no-boredom | Remembered-target moves (all) | 7.0000 | 9.0000 | 0.760300 | 1.000000 |
| hf2 vs hf2-no-memory | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf2-no-memory | Remembered-target moves (all) | 7.0000 | 0.0000 | 0.000011 | 0.000022 |
| hf2 vs hf2-no-goals | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf2-no-goals | Remembered-target moves (all) | 7.0000 | 7.0000 | 1.000000 | 1.000000 |

## Boredom by episode

Means pool ten seeds with equal episode lengths. Min/max are the range across frames within that episode across the ten seeds. Every recording separately includes its own boredomMeanN/boredomMinN/boredomMaxN.

| Arm | Episode | Mean | Min | Max | Engagement min | Engagement max |
|---|---:|---:|---:|---:|---:|---:|
| hf2 | 0 | 0.0291 | 0.0000 | 0.2076 | 0.2723 | 0.8765 |
| hf2 | 1 | 0.0786 | 0.0000 | 0.2735 | 0.2516 | 0.8415 |
| hf2 | 2 | 0.0641 | 0.0000 | 0.1733 | 0.3051 | 0.8470 |
| hf2 | 3 | 0.0284 | 0.0000 | 0.1165 | 0.3388 | 0.8734 |
| hf2-no-boredom | 0 | 0.0000 | 0.0000 | 0.0000 | 0.2681 | 0.8713 |
| hf2-no-boredom | 1 | 0.0000 | 0.0000 | 0.0000 | 0.2452 | 0.8456 |
| hf2-no-boredom | 2 | 0.0000 | 0.0000 | 0.0000 | 0.2913 | 0.8693 |
| hf2-no-boredom | 3 | 0.0000 | 0.0000 | 0.0000 | 0.3136 | 0.8580 |
| hf2-no-memory | 0 | 0.3580 | 0.0000 | 0.8750 | 0.0808 | 0.8524 |
| hf2-no-memory | 1 | 0.6372 | 0.1813 | 0.8773 | 0.1125 | 0.8341 |
| hf2-no-memory | 2 | 0.5563 | 0.2270 | 0.8073 | 0.1838 | 0.8428 |
| hf2-no-memory | 3 | 0.3582 | 0.1045 | 0.6970 | 0.2281 | 0.8546 |
| hf2-no-goals | 0 | 0.0291 | 0.0000 | 0.2076 | 0.2723 | 0.8765 |
| hf2-no-goals | 1 | 0.0786 | 0.0000 | 0.2735 | 0.2516 | 0.8415 |
| hf2-no-goals | 2 | 0.0641 | 0.0000 | 0.1733 | 0.3051 | 0.8470 |
| hf2-no-goals | 3 | 0.0284 | 0.0000 | 0.1165 | 0.3388 | 0.8734 |
