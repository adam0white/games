# Island HF2 experiment

Done means: four new deterministic HF2 arms, ten seeds per requested arm, preserved pilot recordings, a reproducible exact comparison, passing checks, and a signed local commit. The requester accepts the code and recorded evidence. No remote or publication is part of this work.

Run the comparison with `node src/compare.ts`. Run an arm with `node src/run.ts --mind hf2 --seed 1 --out /absolute/path/run.json`. The CLI regenerates the index beside its output. Scratch results are in `/Users/abdul/code/human-framework/scratch/island2/`. No LLM calls were made. HF remains pinned to 2.9.0.

## Adapter

`src/minds/hf2.ts` uses the same createPerson specification as hf. It encodes every observed object, carried object, Spire and event with a target and place. Places are coordinates relative to the reset origin; observations give offsets rather than absolute grid coordinates. The body tracks its own legal movements. It never imports the world or reads unseen object state. A throw onto land reports its landing offset; a loss reports no landing cell, so that event records the observed launch cell.

HF recall supplies object-directed movement offers, including objects outside current sight. Cue recall is fuzzy in HF, so the adapter filters exact identities after recall. Current sight supersedes older memories. Memory can forget or be stale. Multiple targets in the same direction produce separate offers that map to the same legal input. This expands the movement offer count and can itself favor movement; the memory ablation changes that count. It is not evidence of HF planning.

Each chosen action begins one activity and lives one minute. Its next observation closes that activity with only its observed effects. The closing episode observation handles the last action once. Leisure and competence outcomes teach HF's action/target expectations. Effect novelty counts event kind, object/body and place in HF memory, with 30-minute habituation recovery. Future throw landings are unknown; their offers use the launch place as a prior, while actual throw feedback uses the reported landing. No throw physics or hidden recipe is supplied.

Engagement has a four-minute half-life. New routine movement stimulates by 0.12; half-habituated movement stimulates by 0.06. Their steady engagement values are 0.46 and 0.29, either side of the 0.35 boredom line. New manipulation/discovery stimulates by 0.55, look by 0.18 and rest by 0.04. The first calibration gave every new effect 0.55 and kept every normal HF2 run above the line. It was revised to satisfy the dynamics requirement before the final reported runs; no claim of preregistration is made.

## Public API limits and goals

HF 2.9.0 `dist/person.js:tick` calls `dist/agenda/agenda.js:proposeGoals` on hourly grid boundaries. Starting at noon, the 240 actions reach minutes 780, 840, 900 and 960. The adapter also calls the public proposeGoals path at those boundaries. It is idempotent with the tick call. Every goal is recorded in frame inner.goals with label, adoption minute, source, proposed/adopted flags and current status. HF's proposals adopt immediately. Final goal status is merged into the last frame after its outcome.

In all forty HF2 recordings, no free-time goal is proposed. The largest eligible psychological urgency at the end is 0.013692, far below proposeUrgency=0.6. HF has templates for belonging, competence, esteem and meaning, and allows at most one proposal per day. No threshold or persona was changed. A test lowers competence with public satisfy, restricts actions to rest, and confirms the hourly proposal/adoption of master-skill at lived minute 60 and its links to manipulation offers. This diagnostic is not one of the reported seed runs.

HF 2.9.0 `dist/types.d.ts:Affordance` has no serves field or spatial goal predicate. `dist/agenda/agenda.js:agendaTerms/onFinished` matches goal action names or explicit advances ids; placeId does not imply means toward a goal. The adapter declares serves as host metadata and maps honest need effects to explicit links for HF-proposed goals. It uses the same offers in free and task time. The stated task adopts a goal matching the semantic action island:place:cube@Spire. Placement endpoint semantics are declared even without a task. Walking or picking gets no task-specific link. Consequently this is the closest direct-action goal version, not a task planner. It has no taskAdvances equivalent. Each qualifying placement contributes 0.1 goal progress; ten placements achieve the bounded goal, while taskScore counts actual final cubes and can differ after removals.

Ablations: no-boredom skips only engagement-driven boredom injection; ordinary HF tick remains. No-memory encodes no placeId, uses object-only effect novelty, and supplies object-directed movement only for currently visible objects. No-goals still lets HF tick propose and logs proposals, but removes all goal pull, including direct task-action matching.

## Measurement

Existing metric values are unchanged. Legacy arms retain the pilot JSON measure schema to preserve byte hashes. measureRecording recomputes the added metrics for comparison without rewriting pilot files. HF2 recordings include the added fields. The comparison's tallest stack is freeMaxStack; the original maxStack still spans free and task episodes.

Repeated pursuit counts an episode-local carrying bout when at least two carried moves reduce Manhattan distance toward its eventual observed destination. At an episode boundary, a still-carried object's endpoint is the last body cell. Losses have no inferred destination. Each bout counts once. This physical measure applies to random too; it is weak behavioral evidence and cannot establish an intention or a project. It is not a count of self-authored projects.

Remembered-target moves count selected object-directed movement offers whose target was absent from current sight, across all four episodes. freeRememberedTargetMoves is also available. Goals are counted by unique HF ids in the HF2 audit; older pilot files did not record goal identities. Boredom means/minima/maxima use available frame readings, including the closing outcome for the last HF2 frame.

The test enumerates all C(20,10)=184756 allocations and compares the absolute difference of means, including ties. Samples have ten seeds each. Medians describe each arm. The test is unpaired despite matched terrain seeds. P values are exploratory and unadjusted for twenty comparisons; a large p is not evidence of equivalence.

## Verification

Each HF2 arm was run twice for seeds 1–3; all twelve SHA-256 pairs matched. The six hf/random seed 1–3 reruns matched their committed bytes. All nineteen original JSON recordings were preserved, including LLM recordings, without calling those minds. New recordings are hf/random seeds 4–10 and all forty HF2 runs. The regenerated index contains 73 recordings. The hf seed 1 regression test pins SHA-256 4e4826d03a20956f54b581eedea3777e551c595837867ec67855ab4186af924d. The scratch determinism.json holds the repeat hashes. All 73 recordings were also replayed through the world engine; every recorded position, carried object, object layout and event matched. The six hf-no-boredom/scripted seed 1–3 reruns matched too. `npm run check` passes all 98 tests. The viewer validates structured goal audits and shows their labels, minute and status. All 73 recordings pass its validator. The existing mocked-backend test redirects its filesystem calls into island2 without editing the LLM adapter.

## Results

HF2 has no detected advantage over random in manipulation, free Spire objects, free stack height or repeated pursuit. It idles less and has lower action-kind entropy. No HF-proposed free-time goal appears. Recalled-target movement demonstrates memory use; it does not demonstrate project formation. These runs do not support a claim that HF2 builds self-directed projects.

| Comparison | Measure | Median A | Median B | Exact p |
|---|---|---:|---:|---:|
| hf2 vs random | Cells visited | 49.0000 | 41.5000 | 0.254043 |
| hf2 vs random | Kind entropy | 1.4674 | 1.9857 | 0.000011 |
| hf2 vs random | Manipulation share | 0.0389 | 0.0389 | 0.755321 |
| hf2 vs random | Idle share | 0.0778 | 0.2167 | 0.000011 |
| hf2 vs random | Spire objects | 0.0000 | 0.0000 | 1.000000 |
| hf2 vs random | Tallest stack | 1.0000 | 1.0000 | 1.000000 |
| hf2 vs random | Repeated pursuit | 0.5000 | 0.0000 | 0.097523 |
| hf vs random | Cells visited | 21.5000 | 41.5000 | 0.000368 |
| hf vs random | Kind entropy | 2.2745 | 1.9857 | 0.000076 |
| hf vs random | Manipulation share | 0.0889 | 0.0389 | 0.003009 |
| hf vs random | Idle share | 0.2750 | 0.2167 | 0.022949 |
| hf vs random | Spire objects | 0.0000 | 0.0000 | 1.000000 |
| hf vs random | Tallest stack | 1.0000 | 1.0000 | 0.582043 |
| hf vs random | Repeated pursuit | 0.0000 | 0.0000 | 1.000000 |
| hf2 vs hf2-no-boredom | Task score | 0.0000 | 0.0000 | 1.000000 |
| hf2 vs hf2-no-boredom | Remembered-target moves (all) | 62.5000 | 65.5000 | 0.757421 |
| hf2 vs hf2-no-memory | Task score | 0.0000 | 0.0000 | 1.000000 |
| hf2 vs hf2-no-memory | Remembered-target moves (all) | 62.5000 | 0.0000 | 0.000011 |
| hf2 vs hf2-no-goals | Task score | 0.0000 | 0.0000 | 1.000000 |
| hf2 vs hf2-no-goals | Remembered-target moves (all) | 62.5000 | 62.5000 | 0.990236 |

## Boredom by episode

Means pool ten seeds with equal episode lengths. Min/max are the range across frames within that episode across the ten seeds. Every recording separately includes its own boredomMeanN/boredomMinN/boredomMaxN.

| Arm | Episode | Mean | Min | Max | Engagement min | Engagement max |
|---|---:|---:|---:|---:|---:|---:|
| hf2 | 0 | 0.0211 | 0.0000 | 0.1617 | 0.2877 | 1.0000 |
| hf2 | 1 | 0.0300 | 0.0000 | 0.1536 | 0.3128 | 0.8239 |
| hf2 | 2 | 0.0145 | 0.0000 | 0.0720 | 0.3366 | 0.8495 |
| hf2 | 3 | 0.0047 | 0.0000 | 0.0636 | 0.3153 | 1.0000 |
| hf2-no-boredom | 0 | 0.0000 | 0.0000 | 0.0000 | 0.2753 | 1.0000 |
| hf2-no-boredom | 1 | 0.0000 | 0.0000 | 0.0000 | 0.3128 | 0.8594 |
| hf2-no-boredom | 2 | 0.0000 | 0.0000 | 0.0000 | 0.3132 | 0.8495 |
| hf2-no-boredom | 3 | 0.0000 | 0.0000 | 0.0000 | 0.3153 | 0.8498 |
| hf2-no-memory | 0 | 0.3368 | 0.0000 | 0.8845 | 0.0815 | 0.8540 |
| hf2-no-memory | 1 | 0.5692 | 0.3024 | 0.8861 | 0.1112 | 0.8638 |
| hf2-no-memory | 2 | 0.4777 | 0.2757 | 0.7700 | 0.2075 | 0.8468 |
| hf2-no-memory | 3 | 0.3013 | 0.1256 | 0.5906 | 0.2519 | 0.8522 |
| hf2-no-goals | 0 | 0.0211 | 0.0000 | 0.1617 | 0.2877 | 1.0000 |
| hf2-no-goals | 1 | 0.0300 | 0.0000 | 0.1536 | 0.3128 | 0.8239 |
| hf2-no-goals | 2 | 0.0145 | 0.0000 | 0.0720 | 0.3366 | 0.8495 |
| hf2-no-goals | 3 | 0.0047 | 0.0000 | 0.0636 | 0.3153 | 1.0000 |
