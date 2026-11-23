# Island HF2 experiment

Done means: corrected HF2 arms plus hf3 with received consequences, ten seeds per requested arm, byte-identical prior recordings, a reproducible exact comparison with per-seed values and action composition, passing checks, and a signed local commit. The requester accepts the code and recorded evidence. No remote or publication is part of this work.

Run the comparison with `node src/compare.ts`. Run an arm with `node src/run.ts --mind hf2 --seed 1 --out /absolute/path/run.json`. The CLI regenerates the index beside its output. Scratch results are in `/Users/abdul/code/human-framework/scratch/island2/`. No LLM calls were made. HF remains pinned to 2.9.0.

## Adapter

`src/minds/hf2.ts` uses the same createPerson specification as hf. It encodes every observed object, carried object, Spire and event with a target and place. Places are coordinates relative to the reset origin; observations give offsets rather than absolute grid coordinates. The body tracks its own legal movements. It never imports the world or reads unseen object state. A throw onto land reports its landing offset; a loss reports no landing cell, so that event records the observed launch cell.

HF recall supplies object-directed movement offers, including objects outside current sight. Cue recall is fuzzy in HF, so the adapter filters exact identities after recall. Current sight supersedes older memories. Memory can forget or be stale. Every HF2 arm now supplies exactly one offer per legal input. Movement merges all targets approached by that input into its label. The first currently visible target in observation order is the representative targetId/placeId; if none is visible, the most recently recalled target is the representative (episode id breaks equal-minute ties). That representative controls HF target-specific scoring and the fromMemory flag. Other targets appear only in the label. The movement effect target/place, advertised effects, effort, goal links and all other adapter mechanisms remain unchanged. Memory no longer adds sampling weight by duplicating movement inputs. This is not evidence of HF planning.

Each chosen action begins one activity and lives one minute. Its next observation closes that activity with only its observed effects. The closing episode observation handles the last action once. Leisure and competence outcomes teach HF's action/target expectations. Effect novelty counts event kind, object/body and place in HF memory, with 30-minute habituation recovery. Future throw landings are unknown; their offers use the launch place as a prior, while actual throw feedback uses the reported landing. No throw physics or hidden recipe is supplied.

Engagement has a four-minute half-life. New routine movement stimulates by 0.12; half-habituated movement stimulates by 0.06. Their steady engagement values are 0.46 and 0.29, either side of the 0.35 boredom line. New manipulation/discovery stimulates by 0.55, look by 0.18 and rest by 0.04. The first calibration gave every new effect 0.55 and kept every normal HF2 run above the line. It was revised to satisfy the dynamics requirement before the final reported runs; no claim of preregistration is made.

## Public API limits and goals

HF 2.9.0 `dist/person.js:tick` calls `dist/agenda/agenda.js:proposeGoals` on hourly grid boundaries. Starting at noon, the 240 actions reach minutes 780, 840, 900 and 960. The adapter also calls the public proposeGoals path at those boundaries. It is idempotent with the tick call. Every goal is recorded in frame inner.goals with label, adoption minute, source, proposed/adopted flags and current status. HF's proposals adopt immediately. Final goal status is merged into the last frame after its outcome.

In all forty HF2 recordings, no free-time goal is proposed. The largest eligible psychological urgency at the end is 0.013864, far below proposeUrgency=0.6. HF has templates for belonging, competence, esteem and meaning, and allows at most one proposal per day. No threshold or persona was changed. A test lowers competence with public satisfy, restricts actions to rest, and confirms the hourly proposal/adoption of master-skill at lived minute 60 and its links to manipulation offers. This diagnostic is not one of the reported seed runs.

HF 2.9.0 `dist/types.d.ts:Affordance` has no serves field or spatial goal predicate. `dist/agenda/agenda.js:agendaTerms/onFinished` matches goal action names or explicit advances ids; placeId does not imply means toward a goal. The adapter declares serves as host metadata and maps honest need effects to explicit links for HF-proposed goals. It uses the same offers in free and task time. The stated task adopts a goal matching the semantic action island:place:cube@Spire. Placement endpoint semantics are declared even without a task. Walking or picking gets no task-specific link. HF2 is an endpoint-only adapter. This is an adapter limit, not an HF API limit: HF 2.9.0 supports temporal goals and received consequences that can give intermediate actions goal value. HF2 did not use them. It has no taskAdvances equivalent. Each qualifying placement contributes 0.1 goal progress; ten placements achieve the bounded goal, while taskScore counts actual final cubes and can differ after removals.

Ablations: no-boredom skips only engagement-driven boredom injection; ordinary HF tick remains. No-memory encodes no placeId, uses object-only effect novelty, and supplies object-directed movement only for currently visible objects. No-goals still lets HF tick propose and logs proposals, but removes all goal pull, including direct task-action matching.

## Measurement

Existing metric values are unchanged. Legacy arms retain the pilot JSON measure schema to preserve byte hashes. measureRecording recomputes the added metrics for comparison without rewriting pilot files. HF2 recordings include the added fields. The comparison's tallest stack is freeMaxStack; the original maxStack still spans free and task episodes.

Repeated pursuit counts an episode-local carrying bout when at least two carried moves reduce Manhattan distance toward its eventual observed destination. At an episode boundary, a still-carried object's endpoint is the last body cell. Losses have no inferred destination. Each bout counts once. This physical measure applies to random too; it is weak behavioral evidence and cannot establish an intention or a project. It is not a count of self-authored projects.

Remembered-target moves count selected object-directed movement offers whose representative target was absent from current sight, across all four episodes. An unseen target listed alongside a visible representative does not increment this count. freeRememberedTargetMoves is also available. Goals are counted by unique HF ids in the HF2 audit; older pilot files did not record goal identities. Boredom means/minima/maxima use available frame readings, including the closing outcome for the last HF2 frame.

The test enumerates all C(20,10)=184756 allocations and compares the absolute difference of means, including ties. Samples have ten seeds each. Medians describe each arm. The test is unpaired despite matched terrain seeds. Holm step-down correction uses one eight-test family per arm-vs-random block: seven free-time measures plus task score. Each task-score comparison vs hf or hf2 is a singleton family. The retained hf2-vs-ablation comparisons each form a two-test family. Families are exploratory and are not jointly corrected; a large p is not evidence of equivalence.

## What changed

Commit 601f6bf offered a base movement plus one movement offer per approached target. This inflated movement probability and confounded the memory ablation. The correction merges them into one offer in hf2 and all three ablations. A regression test covers visible and recalled target collisions in each arm. The test first failed on the duplicated inputs, then passed after the merge.

All forty hf2* recordings were overwritten for seeds 1–10. No legacy recording was overwritten. The index was regenerated. The comparison now includes all requested free-time measures for hf, hf2, hf2-no-memory and hf2-no-boredom against random, task score against random and hf, and Holm-adjusted p values. The hf baseline is not compared with itself. The full output is saved as `compare2.md` in scratch.

Free-time move share is now 48.7% for hf2, 45.8% for hf2-no-memory and 37.1% for random, pooled over ten seeds. These shares count move inputs only; jumps are separate. The old 67.8%/54.4% movement contrast was confounded by duplicate offers and is superseded by this rerun.

## HF2 verification (prior run)

Each corrected HF2 arm was run twice for seeds 1–3; all twelve SHA-256 pairs matched, and each pair matches its saved viewer recording. Scratch `determinism2.json` records both hashes. Every one of the 33 legacy JSON recordings, including LLM recordings, is byte-identical to the starting commit. No LLM mind was called. Scratch `legacy-hashes2.json` records their hashes. All 12,480 offer lists across forty runs and twelve repeats contained exactly one offer per legal input. The regenerated index contains 73 recordings. All 73 recordings were physically replayed against the world engine and passed the viewer validator. The hf seed 1 regression test retains SHA-256 4e4826d03a20956f54b581eedea3777e551c595837867ec67855ab4186af924d. `npm run check` passes all 106 tests.

## HF2 results (prior run)

With Holm-adjusted p < 0.05, hf differs from random in fewer cells visited, higher action-kind entropy and higher manipulation share. Corrected hf2 differs only in higher idle share. hf2-no-memory differs in higher entropy, manipulation share and idle share. hf2-no-boredom differs only in higher idle share. No requested arm has a detected difference in free Spire objects, free tallest stack or repeated pursuit. No task-score comparison is significant. These results are exploratory; nonsignificance does not establish equivalence.

No HF-proposed free-time goal appears. All seven free-time metric samples for hf2-no-goals exactly match hf2, so the same higher-idle-share result applies. Recalled-target movement demonstrates memory use; it does not demonstrate project formation. These runs do not support a claim that HF2 builds self-directed projects.

## HF3 received consequences

`node src/run.ts --mind hf3 --seed 1` runs the new arm. HF3 uses the HF2 person, offers, goal importance, progress amounts, selection temperature, engagement, learning and recall. `hf3-no-consequences` denotes the existing hf2 comparison; no new arm or recordings are created for that name.

Claims come from the observed action semantics and land cells established by current legal movement/placement actions, visible objects and the visible Spire. No world import, hidden terrain, unseen object state, task routing or task-conditioned claims are added. Picking any object permits a placement here or on a known adjacent land cell. Moving while carrying any object permits a placement on the destination or on known land within one cell of it. The generator applies to cubes, rock and ring, at any target. Spire placement retains the endpoint action name already present in HF2. The same generator runs in free and task time and never reads the task or goal. No free-time goal is injected; none was proposed in these ten runs.

Each claim is a `Percept` with `channel: 'told'`, `actorId: 'island'`, recipient `islander`, salience 0.5 and one `consequences` entry. It competes with visible object percepts in the same `perceive` call. No claim bypasses attention, and the existing fallback memory encoding of unattended facts does not admit their consequences. Chance and confidence are 1 because these are conditional physical semantics; HF still applies estimated success and its default source trust. Successor duration is one minute, carrying effort 0.08 and focus 0.03. Slot ids are reused with the current minute as revision. HF retains at most 16 entries and 64 revision records. An unreceived or evicted claim contributes nothing.

A claim starts after the current one-minute trigger and must finish by receipt minute + 2. At the next decision, an old claim cannot fit a new trigger and successor before that bound, even if it was not superseded. There is no stale-body route through a prior observation or reset. HF matches action, target and place exactly, excluding affordance id. Where multiple movement inputs share that identity, the adapter emits only placements reachable after every matching input. It neither duplicates offers nor changes their identities to obtain a bonus.

Expressible chains are **pick → place** and **move while carrying → immediate placement at/next to the destination**, including placement on the Spire when it is within reach after that one move. A distant carrying move does not claim eventual Spire placement. **walk → pick → walk → place**, **pick → walk → place** and **move → move → place** exceed the one-successor bound. No route is chained recursively. Only actual completed placements advance the goal; a received claim or completed intermediate trigger never grants goal progress.

HF3 adopts the stated task goal with `temporal: { halfLifeMinutes: 60 }`; importance remains 0.5 and each matching completed placement contributes 0.1. The half-life is an engineering choice equal to one episode, not a fitted parameter. Temporal valuation is required for HF's received-goal route, and also changes direct-action valuation. Per the requested comparison, hf2 remains the unchanged ablation, with temporal valuation off. Thus hf3 vs hf2 compares the received-consequence configuration including its temporal prerequisite; it does not isolate testimony from temporal valuation. The installed 2.3.0 documentation recommends matching temporal settings for a strict knowledge-only control. No extra control arm was requested or added.

Public API path: `perceive` in `node_modules/@adam0white/human-framework/dist/person.js` calls `perceiveOne` for attended percepts, then `receiveConsequences` in `dist/prospection/prospection.js`. `scoreInputs` uses public `scoreAll`; `dist/cognition/cognition.js:consider` calls `receivedGoalRoute` in `dist/prospection/prospection.js` (around line 218). It combines one successor with `dist/agenda/agenda.js:temporalGoalValue` and emits `goal:<id>` via `agendaTermsWithGoalEstimates`. The task uses public `adoptGoal` and `Goal.temporal`. See the installed README section "Receiving a possible future route" (introduced in 2.3.0). No dependency was edited.

## HF3 verification and results

All ten hf3 seeds were generated. Seeds 1–3 were each run twice again; both hashes match each other and the saved recording. `determinism3.json` in scratch records the three hash triples and 2,904 offer-list checks, including closing observations. All 73 prior recordings match their hashes from starting commit 5a0364d. `legacy-hashes3.json` records them. The regenerated index contains 83 recordings. The comparison is saved as `compare3.md` in scratch and reproduced below. `generate3.ts` and `audit3.ts` preserve the commands and assertions. `npm run check` passes all 111 tests. All 83 recordings pass physical replay and viewer validation. No LLM calls were made.

HF3 finishes with one task cube in seeds 1, 4 and 6 and zero in the other seven. It never achieves its ten-placement goal. No task-score comparison against hf2, hf or random is significant. In free time, only higher idle share differs from random after Holm correction (p = 0.002165). There is no detected difference in Spire objects, tallest stack or repeated pursuit. Claims can affect attention and memory even without a temporal goal, so free-time traces need not match hf2. These results do not establish project formation or equivalence to random.

Exact unpaired permutation tests of absolute mean differences, including ties. Medians describe samples. Holm correction uses one eight-test family per arm vs random (seven free-time metrics plus task score), one singleton family per task-score comparison vs hf or hf2, and one two-test family per hf2 ablation comparison. Families are exploratory and are not jointly corrected; large p values do not establish equivalence. The hf baseline has no task comparison with itself.

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
| hf3 vs random | Cells visited | 35.0000 | 41.5000 | 0.166782 | 1.000000 |
| hf3 vs random | Kind entropy | 2.0537 | 1.9857 | 0.282178 | 1.000000 |
| hf3 vs random | Manipulation share | 0.0639 | 0.0389 | 0.313560 | 1.000000 |
| hf3 vs random | Idle share | 0.3111 | 0.2167 | 0.000271 | 0.002165 |
| hf3 vs random | Spire objects | 0.0000 | 0.0000 | 0.473684 | 1.000000 |
| hf3 vs random | Tallest stack | 1.0000 | 1.0000 | 1.000000 | 1.000000 |
| hf3 vs random | Repeated pursuit | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf3 vs random | Task score | 0.0000 | 0.0000 | 0.210526 | 1.000000 |
| hf2 vs hf | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf2-no-memory vs hf | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf2-no-boredom vs hf | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf3 vs hf | Task score | 0.0000 | 0.0000 | 0.568111 | 0.568111 |
| hf3 vs hf2 | Task score | 0.0000 | 0.0000 | 0.210526 | 0.210526 |
| hf2 vs hf2-no-boredom | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf2-no-boredom | Remembered-target moves (all) | 7.0000 | 9.0000 | 0.760300 | 1.000000 |
| hf2 vs hf2-no-memory | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf2-no-memory | Remembered-target moves (all) | 7.0000 | 0.0000 | 0.000011 | 0.000022 |
| hf2 vs hf2-no-goals | Task score | 0.0000 | 0.0000 | 1.000000 | 1.000000 |
| hf2 vs hf2-no-goals | Remembered-target moves (all) | 7.0000 | 7.0000 | 1.000000 | 1.000000 |

Per-seed values (vectors follow the listed seed order). Spire objects, tallest stack and repeated pursuit use free time; task score is final task cubes on the Spire.

| Arm | Seeds | Spire objects | Tallest stack | Repeated pursuit | Task score |
|---|---|---|---|---|---|
| hf | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 1, 1, 1, 1, 1, 2, 1, 1, 1, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 2, 0, 2, 0, 0, 0, 0, 2, 0, 0 |
| hf-no-boredom | 1, 2, 3 | 0, 0, 0 | 1, 1, 1 | 0, 0, 0 | 2, 1, 3 |
| hf2 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 | 1, 1, 1, 2, 1, 1, 2, 1, 2, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| hf2-no-boredom | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 1, 1, 1, 2, 1, 2, 1, 1, 1, 2 | 1, 0, 1, 0, 0, 1, 0, 0, 0, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| hf2-no-goals | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 | 1, 1, 1, 2, 1, 1, 2, 1, 2, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| hf2-no-memory | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 1, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 1, 1, 1, 3, 1, 1, 1, 1, 1, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| hf3 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 | 1, 1, 1, 2, 1, 1, 2, 1, 2, 1 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 | 1, 0, 0, 1, 0, 1, 0, 0, 0, 0 |
| random | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 1, 1, 1, 2, 1, 1, 2, 1, 2, 1 | 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |

Free-time action-kind composition (pooled action shares; jump is the input verb, recorded as climb in the entropy metric).

| Arm | move | jump | look | rest | pick | place | throw |
|---|---:|---:|---:|---:|---:|---:|---:|
| hf | 0.3761 | 0.2450 | 0.1350 | 0.1289 | 0.0578 | 0.0367 | 0.0206 |
| hf-no-boredom | 0.3889 | 0.1537 | 0.1944 | 0.2074 | 0.0278 | 0.0167 | 0.0111 |
| hf2 | 0.4872 | 0.1450 | 0.1528 | 0.1489 | 0.0339 | 0.0222 | 0.0100 |
| hf2-no-boredom | 0.4944 | 0.1378 | 0.1494 | 0.1483 | 0.0356 | 0.0228 | 0.0117 |
| hf2-no-goals | 0.4872 | 0.1450 | 0.1528 | 0.1489 | 0.0339 | 0.0222 | 0.0100 |
| hf2-no-memory | 0.4578 | 0.1428 | 0.1400 | 0.1511 | 0.0544 | 0.0300 | 0.0239 |
| hf3 | 0.4911 | 0.1456 | 0.1511 | 0.1494 | 0.0322 | 0.0206 | 0.0100 |
| random | 0.3711 | 0.3661 | 0.1194 | 0.0961 | 0.0239 | 0.0083 | 0.0150 |

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
