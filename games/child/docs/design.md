## Current episode contract — 2026-11-05

The current README and AGENTS define edition 6: five short HF4 chapters, explicit year skips, complete per-episode exports and exact replay. Continuous-life, daily gap care, offscreen natural mortality and original time budgets below are historical proposals and unqualified candidates. They are superseded for this port, not reported as completed. Dated checkpoints are in HANDOFF: 2026-11-12 with an individual reason for each previously overdue Deferred item. Multiplayer and account transfer remain excluded.

# What the Child Saw

You are Zehra. Your daughter Elif learns by watching adults work. Prepare her for five days when she must act alone, at three, six, ten, fourteen and eighteen. Keep the household fed while choosing whose work she sees. At eighteen she must bring water home for every waiting household. Her independence can win, even when she follows another adult.

Done means a complete small run with both winning and losing endings, exact replay export, independent Codex review, green CI on the deployed commit, live verification, registry entries and a central listing ready for the coordinator. The owner accepts feel after the lab round. This implements the approved v2 brief and coordinator rulings of 2026-10-26.

## Cue vocabulary (designed before code)

Cues describe situations, never ages or chapter numbers. Demonstrations and crises share these exact keys and values throughout the run.

| Cue          | Values          | Meaning                                                                |
| ------------ | --------------- | ---------------------------------------------------------------------- |
| supply       | scarce          | The available water or food may run short.                             |
| route        | uncertain       | A route or source needs inspection.                                    |
| keeper       | needed          | A task could use the trusted keeper.                                   |
| availability | present, absent | The keeper can or cannot help today.                                   |
| pressure     | repeated        | Someone asks again or pushes past a limit.                             |
| conflict     | (removed)       | Removed 2026-10-27: every held way now matches, so it changed nothing. |

Four method actions: `count` (Maryam, count before sharing), `look` (Yusuf, go and look first), `wait` (Danyal, wait for the keeper), `refuse` (Zehra, say no and mean it). Each demonstration uses one stable condition: supply scarce, route uncertain, keeper needed, pressure repeated respectively. Situations can carry several cues. HF selects among the methods she holds. **Changed 2026-10-27 (coordinator ruling, owner direction bold over safe):** crisis cues are what a child can see, not which method will work. Water always looks scarce, the path always uncertain, and someone always asks again; only Danyal's presence is visible. So every held method matches, and HF evidence (how often and how recently she watched it) decides which one she uses. If the two strongest are tied, she freezes. The task that stayed with her between chapters counts as one watching. The old stop-or-go condition is removed: it no longer changed anything once every held way matched. The screen states the rule each chapter. Before this change a careless player who varied teachers won 178 of 192 seeded runs because the cues told Elif which held method fit; after it, 22 of 192 (rotating through every teacher: 32 of 32 before, 0 after), while a careful reader wins 32 of 32 and a careful player with one stray afternoon per chapter wins 27 of 32.

## A game with costs

Each chapter has three preparations. A companion teaches through a witnessed task and exact HF method APIs. Maryam's counting takes her away from preparing food. Yusuf's walk leaves field work undone. Danyal's lesson delays well repairs. Zehra's boundary lesson consumes household stores while she stays home. Cost descriptions appear on the choice. Household food and well condition persist. Choosing field work restores food but leaves Elif to practise alone without a new demonstration. No guaranteed injury for independence.

Every preparation shows the conditions of the coming crisis, including Danyal's availability. Seed and earlier food, repair and route outcomes change those conditions. At least two practices meet each chapter's goal with different costs. Others can bring a shortfall with a visible consequence. Final success is enough water for all, not a parenting score. Earlier shortfalls reduce stores or repair capacity; they do not end the run.

| Age | Goal                                            | Workable approaches and differing costs                                                                                                                                                                                                             |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Keep an evening jar for home.                   | Count shares (time); refuse a repeat request (neighbour waits).                                                                                                                                                                                     |
| 6   | Bring the household water home.                 | Inspect a dry upper route (food/time); count smaller safe trips (well wear). With a present keeper, waiting also works but delays repairs. A flooded lower path or absent keeper causes a shortfall.                                                |
| 10  | Keep the household's place in the queue.        | Refuse pressure (friction); count and arrange turns (stores); a present keeper can settle it (repair delay).                                                                                                                                        |
| 14  | Divide the winter store so nobody goes without. | Count portions (thin household meals); inspect the water store (repair work deferred).                                                                                                                                                              |
| 18  | Supply every waiting household by night.        | Count and ration (household stored water spent); inspect a flowing upper spring (path work); hold the queue (neighbours wait). A present keeper can organise turns at repair cost. Poor settlement state can close one of these routes; two remain. |

## Build order and HF ownership

First implement age six only, preparation, crisis, movement, aftermath. Prove success, shortfall, explicit confusion and same-seed different movement headless and in a browser. Only then add ages three, ten, fourteen, eighteen.

HF 3.2.0, exactly pinned, owns Person state, method evidence and decisions. Use receiveMethodCues, demonstrateMethod and decide. Never write methods.context. No new HF capability and no engine edits. Crisis presentation holds on the community day boundary; it never adds a partial body day. Monthly liveCommunity steps advance the entire cast between chapters; demonstrations occur at Elif.now between steps. Elif has no second aging loop. Host code owns physical water, food, routes and task results. No copied learning, cognition or trust logic.

## Visual and technical choices

PixiJS 8 with all words in the DOM. A cloth field fills the top of a narrow page. Stitched figures move along paths, count jars, wait beside the well, or hold an arm across the queue. Show movement before revealing her explanation. Canvas 2D implements the same frame protocol if WebGL fails. Use a main-thread HF host unless measurement shows a worker is needed; rendering receives only frames. The game has no runtime server or database. No React shell. Under five seconds ready on the spike phone profile is a release gate. Godot is excluded by its measured 52-second load. techspike/report.md was absent when read; the v2 reviews contain the corrected Pixi 3.8-second measurement.

At 360×690 the scene stays above the choice text. One focused decision appears at a time. No numeric personality scores. The yearbook gives varied first-person recollections. Feedback offers stopping and confusion; first visit explains recording and one switch controls it. Export and replay are public in Menu. Other ways to begin offers the age-six day. Canvas diagnostics sit in collapsed Debug beside Lab privacy. Reduced motion keeps a readable action pose and skips travel.

## Cast

Canonical Yusuf (34, builder), Maryam (68), Danyal (52, Christian well keeper), Tariq (16, Zehra’s stepson). Zehra is Yusuf's wife, now a foreground player body. Elif is their daughter. These two receive new registry entries under the coordinator's explicit allowance. This game is an authored branch, not a claim about another game's current continuation. No new faith rulings.

## Review decisions

The coordinator resolves the v1 roster objection. Drop the witnessed-practice opt-in and prediction wager. Prefer situational selection over mixed-exposure failure. Reveal actual conditions rather than rumours before the last preparation; hidden availability would make failure arbitrary. Use monthly community advancement, not dual loops. Keep companion costs and variable crises. Lines vary by action, chapter and settlement consequence.

## Deferred

- 2026-11-10: Consider F-2866, F-2868, F-2869, F-2870 and F-2873: neighbour context, afternoon variation, more interaction with Elif and a clearer failed attempt. These are fictional LIGHT panel preferences, not proven causes or approved features. Preserve fair failure.
- 2026-11-10: Consider the nine first-fixed-retest preferences F-2922–F-2930 and Rosa's recovery preference, “Explain why food returned between years.” Preserve fair failure. The [retest record](playtests/2026-10-31-fixed-retest.md) retains the exact asks and their sources. No additional blocking ask was reached in Rosa's recovery.
- 2026-11-12: Recheck owner feel on a deployed episode candidate; that candidate did not exist at the old November 3 review. The first-fixed-retest player loop and Rosa's instrument recovery are collected with limits; owner acceptance of feel remains pending. F-2921's New game instrument lead is resolved for the new Rosa recovery only; the causes of her two earlier TOOL stops remain unknown. Candidate wording for F-2861, F-2862 and F-2865 and the Feedback handoff received player observations in the retest. Those observations do not establish the causes of earlier blocks. The handoff watches SDK 0.4.15's private veil removal because the SDK exposes no close callback.

- 2026-11-03: owner taste acceptance remains pending; the first-fixed-retest player loop is closed with the recorded limits.
- 2026-11-03: cross-game continuation admission, pending a separate receiving-stage design; this run uses its own authored cast branch.
- 2026-11-03: custom cloth shader and sound, only if players request them; protect phone ready time.


## Iteration 2: lessons and settlement consequences (2026-10-26)

The binding coordinator rulings remain unchanged. We chose the review's thinner-gap option: monthly community advancement still totals 180 steps, but the gap gives one witnessed task at its end instead of 36–48 repeated demonstrations. The three lived lessons can now change HF's selected action. The arrangement retains a remembered alternative when you spend the preparations in the field. No host action chooser or framework code was added.

Yusuf's lesson records that Elif knows how to check a route. It never creates water. The upper spring depends on seed and the well rope at chapter entry. Food stores and well rope stay between 0–12 and 0–10. Empty food stores mean no supper. Poor well rope can close the upper path. Missed meals before the final chapter limit repeated carrying trips. An empty household water store can also close counting even when the carriers have eaten. When that route is difficult Danyal is on duty to help; checking the upper spring and working with him remain two approaches. When the spring is dry, counting small shares and stopping second jars both work. A flowing spring with food set aside for the carriers admits counting or inspection, but guarding the well alone leaves households short. The relevant conditions stay fixed through all three preparations; preparation costs affect later chapters and supper, not a concealed last-choice verdict.

Freeze happens when her two strongest held methods are tied. The freeze line names the two teachers. Edition 4: earlier exports get the start-fresh message. An unfit remembered practice has an honest failure line. A child with no demonstrated practice tries without a plan. Danyal's keeper cue is absent when he is away, and waiting cannot solve winter allocation or the evening jar task.

Movement lasts four seconds (two with reduced motion). Each yearbook row recalls the adult's task behind Elif's action in a distinct first-person memory. All Zehra buttons address the player as you. Water stores, food stores and the well rope have separate names. The upper spring replaces the unexplained seep in player text.

Replay edition 2 explicitly identifies the changed rules. Edition 1 exports require the original release; an old local save starts a new upbringing with the existing visible warning. Exact replay remains tested within edition 2. Each memory stores the task actually witnessed and adds the action and result; it does not infer a new childhood scene from the selected action.

Copied Claude simulations (unchanged scripts) measured final-age lesson effects at 30/80 versus 0/80, and chapter comparisons at 96/96 versus 9/96. A comparison counts a lesson result that differs from the same seed/gap with field work; it does not count changed prose. Across seeds 21–24, all-companion final wins are Maryam 1/4, Yusuf 3/4, Danyal 3/4 and you 1/4. With field preparations and only gap teaching they are 2/4, 3/4, 3/4 and 1/4. These are bounded controls, not a claim of balance across all seeds.

## Iteration 3: choices across an upbringing

The cold player found the same five preparation descriptions at every age. The choice descriptions now name the coming task: keeping an evening jar, bringing water home, holding a queue place, dividing the winter store, and supplying every household. Each demonstration choice says “Try” until Elif has witnessed that practice, then “Practise … again”. This uses the recorded lesson, including a lesson from the intervening years; it does not claim that she has mastered or retained a method. Field work names the current household need and the adult she last watched. Every cost stays explicit.

This is a presentation change. Inputs, witnessed tasks, HF decisions, settlement rules, movement timing, replay edition 2 and the admitted state are unchanged. Returning to a practice can still fail. The age-specific purpose describes why you might choose the lesson, not a guarantee about Elif's later action. Gap companion choices retain their existing costs.

## Iteration 4: the upbringing reaches the final day (2026-10-26)

Earlier failed errands now consume emergency water that ordinary daily supplies do not replace. The household starts with two emergency household shares. Each pre-eighteen shortfall spends one, down to zero. The final day's last households need one stored share while the carriers return; a suitable learned practice still fails to finish before night if earlier shortfalls exhausted the store. This is an authored physical delivery rule, not an HF parenting score. Conditions disclose the store and its use before every preparation. The ending names the final learned practice and teacher and recalls the earlier failed errands that used the emergency water. Successful daily errands do not consume the emergency store. Field work restores food and the well rope; it does not create stored water.

HF still selects Elif's action from acquired methods. The host adds no learning, trust or cognition rules. Mixed exposure remains allowed and can succeed. Existing route and availability conditions still determine whether a practice fits the final task. A suitable final lesson cannot undo several earlier shortages. A careful complete win remains reachable.

Each completed field afternoon now has visible progress toward the third-afternoon errand. Older Elif no longer plays with an empty jar or stands beside an adult's elbow. The yearbook uses her actual errand explanation with its remembered source, so an unfit practice cannot invent a successful act. Zero food is described as empty. The ending shows her remembered lesson and actual consequence before the full yearbook.

Replay edition 3 identifies the new physical rules and state. Edition 2 exports require their original release; an incompatible local save uses the existing visible new-upbringing warning. Exact replay remains required within edition 3.

## HF 4.x move: natural death and tracked seeds (2026-10-27)

Child stays on **HF 3.2.0**. The owner accepted always-on natural death in HF 4.0: “Yes death from natural causes can give a story stakes. Keep that seed so we track what happens.” The 4.x move must retain natural death and track what happens when Maryam, authored at 68, dies before Elif turns eighteen. This acceptance does not migrate this release.

**Remaining:** a runnable 4.x host migration, then an observed Maryam death seed and its presentation. No death seed was observed in this investigation. The supplied patch cannot run Child against published HF 4.0.0. This is a blocked discovery, not a finding that Maryam survives every seed.

### Scratch reproduction and observed outcome

Starting at Child `32bbf87`, apply `~/code/.lab-scratch/stale-patches/child-hf4-child.diff` in an isolated scratch worktree, then run `pnpm install --frozen-lockfile`. The patch changes only `package.json` and `pnpm-lock.yaml` from HF 3.2.0 to 4.0.0. Its SHA-256 is `a4cb5096a4bb7e9e6ba6174494c647828719c4b7dd42ba5ce86d92e3cb6989e5`.

`node --experimental-strip-types --input-type=module -e 'import "./src/model.ts"'` fails before `createGame` can run: `SyntaxError: The requested module '@adam0white/human-framework' does not provide an export named 'DAYS_PER_YEAR'`. `pnpm typecheck` also rejects the removed `Community`, `createCommunity`, `liveCommunity`, method APIs and the old `createPerson` signature. HF 4.0.0 exposes the run API instead. No seed is reached, and no in-game death screen, lesson, yearbook or ending can be observed with this patch. No browser or panel run was performed. The scratch dependency changes were restored; they are not part of this change.

| Tracked case                       | Seed                          | Engine      | Observed outcome                                                                                                                                               |
| ---------------------------------- | ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural death before Elif is grown | Unobserved; discovery blocked | 4.0.0 patch | Model import fails before seed initialization. No death or presentation observed.                                                                              |
| Current-version headless control   | 21                            | 3.2.0       | Full five-chapter run reaches eighteen after 180 monthly steps. Maryam is alive. Final inspection succeeds. Export and replay match the recorded control hash. |

The control teaches `count`, `look`, `refuse`, `look`, `look` in successive chapters: three demonstrations, crisis, reveal and arrange with that same practice each time, including the final arrange that closes the yearbook. Seed 21 is a control, **not a death seed**.

### Fixture required for the migration

[`test/fixtures/hf4-natural-death.json`](../test/fixtures/hf4-natural-death.json) records the blocker, an empty observed-death list and the exact current-version control input log. It is a migration fixture contract, not an enabled 4.x test or a completed seed survey. Before accepting the 4.x move, the migration must fill that list from a headless run of the migrated Child host and turn the recorded case into a pinned regression test, with one headless control. No matrix or panel run is required here.

For each tracked death, record the game seed, complete input log, exact HF version, person id, engine death evidence and time, Elif’s age at death, the first chapter showing the loss, visible text and available choices, the next crisis and yearbook/ending outcome, and a current-version export with exact replay. Preserve the authored starting ages. Confirm that engine natural mortality caused the death; do not manufacture it by changing health, age or RNG state. Distinguish the engine event from the next chapter presentation. Record whether the game still offers work with the deceased person or describes a fresh demonstration; those are migration issues to resolve, not observed outcomes today. Existing `nextChapter`, preparation choices and rendering have no death-specific presentation, but that static reading cannot establish what a future 4.x host will show.

Target: revisit 2026-11-03 with the 4.x host migration. Done for seed discovery means an observed death entry with a pinned headless reproduction, one control and exact export replay; owner acceptance of feel remains separate.


## HF 4.4.0 port gate (2026-10-27)

**Historical gate; the 2026-10-28 candidate measurement below supersedes this schedule.** Child remains on released HF 3.2.0 and client 0.4.15. Published HF 4.4.0 supplies the run and method routes, but its measured daily workload does not meet the chapter latency budget. The matching existing row is **G7** in `human-framework/docs/hf4-game-needs.md` (Child section). Review after that row's 2026-11-17 scheduler delivery; rerun this workload by **2026-11-24**. This is a framework dependency, not an owner question. No HF source changed.

The maintainer sets a **2,000 ms desktop computation budget per three-year chapter gap**, before UI rendering, on this Apple Silicon machine with Node 26.12.0. A player makes one companion choice and should see the next chapter promptly. Moving the same work to a Worker does not shorten that wait. A phone budget and the complete six-person upbringing still need measurement after G7 closes.

The control uses the npm-published exact `@adam0white/human-framework@4.4.0`, a pnpm lockfile and `pnpm install --frozen-lockfile`. It imports the public API and the self-contained minimal host from tag `v4.4.0`. Elif starts at three with the example's authored traits and body. Four actual host consumption receipts each day deliver 0.5 food and 0.5 water at hours 1, 7, 13 and 19. No body, clock, RNG or faculty is overwritten. `step` uses daily fidelity with 86,400,000 ms days. No archive is materialized during the timed stepping loop.

| Measured workload                            |  Step time |  JSON archive | Exact replay time |
| -------------------------------------------- | ---------: | ------------: | ----------------: |
| Elif, one day, one call                      |   203.7 ms |  65,660 bytes |          178.1 ms |
| Elif, 30 days, one call with 120 care inputs | 3,461.4 ms | 289,985 bytes |        2,941.0 ms |
| Elif, 30 days, 30 daily calls                | 5,159.5 ms | 299,471 bytes |        3,244.6 ms |
| Six example actors, one day                  |   882.4 ms | 242,726 bytes |          770.4 ms |

Every listed archive returned `verified:true` with its full replay hash equal to the export hash. Elif ended the 30-day controls alive, health 1, satiety 0.66869 and hydration 0.66479. The single-call 30-day full hash is `91758b34cee7819d6feb464c3e1ac529ab179f27fdcf678ebd5cbe9820360c56`. The complete three-year or fifteen-year workload was not run. These are bounded runtime controls, not Child gameplay, care adequacy across an upbringing, natural-death discovery, or performance measurements on a phone. They omit explicit sleep activities, witnessed lessons and relationships. Six example actors are not the production cast.

The 30-day single-call control already exceeds the budget for the much longer chapter. The published scheduler still splits at inputs, midnight, daily anchors and faculty boundaries (`dist/run-step.js`, span probing/materialization). Batched input does not remove that cost. Do not implement a second aging loop, discard retained learning, disable faculties, or replace HF cognition to bypass G7. Archive sizes are **G6 measurements**, not evidence that G6 is closed or independently blocking. No full-upbringing save-size claim is made.

Reproduction evidence is retained at `~/code/.lab-scratch/codex/child-hf4-proof/daily/`: `batch.ts`, `probe.ts`, the tag's `minimal.ts`, `package.json`, `pnpm-lock.yaml` and result JSON. In that directory, use `/opt/homebrew/bin` first on PATH, run `pnpm install --frozen-lockfile`, then `node batch.ts 30 1` or `node probe.ts 30 1`. `batch-30-fed.json` records the single-call result. The scripts assert replay verification and full-hash equality. These paths are local evidence; they are not distributed with the game.

The separate 4.4.0 public protocol control passed pending-request restore, active-work JSON restore and continuation, equal complete archives, read-only inspection/preview, distinct work/rest body outcomes and exact replay. Its files and results are at `~/code/.lab-scratch/codex/child-hf4-proof/control/`. Its work hash is `4cebb9f43752c647e7c7dcbca1902d0181bbdae96663030a726eb59eeb027259`. This closes no whole-game delivery gate: Child's playtest export still runs on 3.2.0. The future bridge must retain complete HF and host replay evidence, refuse old saves with a start-fresh message, and track natural Maryam death as specified above. Client 0.5.2 is available as the immutable `lab-client-v0.5.2` GitHub release artifact; the engine-blocked port does not adopt it separately.

Public gameplay is already implemented by Child PR #2: `src/main.ts` has no query-string reads. Export/replay and age-six start are public menu controls; the Canvas diagnostic sits in one collapsed Debug item beside Lab privacy. The Chromium phone suite passed all eight tests without query-string gates. The released five-chapter seed-21 headless control finishes successfully after 180 months and replays exactly at edition 4, hash `c0e90d29`. Neither result is an HF4 Child port receipt.


## HF 4.6.0 candidate gate (2026-10-28)

Historical candidate measurement. The published 4.9.0 retry below is the current gate result.

**Remaining: a daily step and restore that meet Child's latency budgets.** The local G6/G7 candidate still fails the chapter budget. Keep HF 3.2.0 and client 0.4.15. Recheck G7 and rerun this gate by **2026-11-24**, or sooner when a candidate claims to meet these budgets. This is an existing framework dependency, not an owner question. Under the owner's failed-cost option, the full port, published dependency switch and deployment remain deferred. Publication alone does not close this gate.

The desktop step budget remains **2,000 ms for the six-person three-year chapter gap**, or **111.11 ms per nominal in-game year per person** (`2000 / 3 / 6`). Set a **2,000 ms restore budget**, measured from parsed archive to restored HF run, at every chapter through age eighteen. Parsing, asset loading and rendering must also fit the existing five-second phone-ready gate. These are acceptance budgets, not measured phone performance. The normalized rate describes the measured three-year gate; later four-year gaps and full-history restore still need direct acceptance measurements.

Candidate: HF PR #46, branch `g6g7`, commit `16f14ccef298eba9a9e24b6811a36927366cb0b9`. A separate managed HF worktree ran `pnpm install --frozen-lockfile`, then `pnpm --filter @adam0white/human-framework pack --pack-destination ...`. No HF source changed or was pushed. The resulting tarball labels itself 4.6.0; this local pack is not proof of npm publication. Its SHA256 is `5e7559eb9891f2b5458476209d880cb40cf8d107bed360cf28f34fb8c9a8afeb`. Engine build: `9ef0d0acfecfd52a54ddfb415f329beb7db10503f55c5f1c50ec6efeb46bccd1`.

The public-API workload uses seed 21, Child's six names, sexes, starting ages (Elif 3, Zehra 31, Yusuf 34, Maryam 68, Danyal 52, Tariq 16), and authored traits. Remaining state comes from the candidate's minimal example. It advances 36 monthly calls with daily fidelity, rounding monthly targets to whole days as Child does: 1,096 days for a nominal three-year gap. Four daily food/water receipts per person supply 0.5 of each at hours 1, 7, 13 and 19. There are 26,304 admitted inputs. No clock, body or faculty is overwritten during stepping. The timed step excludes input construction, export, JSON serialization and UI rendering.

| Measured reduced workload          |     Budget |          Result |
| ---------------------------------- | ---------: | --------------: |
| Six people, nominal three-year gap |   2,000 ms |    130,737.6 ms |
| Step, per nominal year per person  |  111.11 ms |     7,263.20 ms |
| JSON archive restore after the gap |   2,000 ms |    135,802.3 ms |
| Exact replay of that archive       | diagnostic |    250,420.6 ms |
| JSON export and serialization      | diagnostic |        340.3 ms |
| Serialized archive                 | diagnostic | 7,584,651 bytes |

The normalization divides by 18 nominal person-years; the rounded duration is 3.00068 calendar years. All six people ended alive with health 1. This is a reduced cast workload, not a runnable Child port or a mathematical lower bound for every possible schedule. It omits witnessed lessons, relationships and explicit sleep activities; sleep debt reached 48 hours. No fifteen-year upbringing, full-history reload, phone cost, fine/daily multi-year agreement or Maryam death seed was measured. These results do not establish care adequacy or natural-death timing.

Restore used a JSON-parsed archive in the same Node process, not a new browser or process. Its exported archive matched the original JSON exactly. Replay returned `verified:true` and the same full hash. Full archive hash: `e331085de222b981bc7864159ab08d2b29b9999997b29356ed9492cf90a1dfaf`. Format 5 retains 36 transactions with all 26,304 inputs.

This shared Apple M4 used Node 26.12.0 and pnpm 12.14.0 with `/opt/homebrew/bin` first on PATH. During stepping the one-minute machine load ranged from 13.48 to 20.60. The final one-minute load after replay was 44.89. Timings are one loaded-machine run, not a portable throughput guarantee. The step result exceeds the chapter budget by **65.37 times**. A worker would move computation off the UI thread without meeting that latency budget. Do not bypass the gate with a second aging loop, disabled faculties, discarded learning or host cognition.

Reproduce from `~/code/.lab-scratch/codex/child-g7-proof/`: `pnpm install --frozen-lockfile`, then `node workload.ts > workload.jsonl 2> workload.stderr`. That directory retains the local tarball, its manifest and frozen lockfile, candidate example host, workload source, raw progress, final JSON archive and results. These are local engineering evidence, not shipped assets. The existing replay-hash tests remain unchanged. The released HF 3.2.0 game passed all 24 tests and the Chromium phone full-upbringing/save/export control; those checks do not validate an HF4 port.


## Published HF 4.9.0 gate (2026-10-29)

**Remaining: stepping and replay-based restore within the existing 2,000 ms budgets.** Published HF 4.9.0 still fails both reduced chapter gates. The released game stays on HF 3.2.0 and client 0.4.15. Snapshot-only recovery is a separate owner proposal; the current restore contract replays accepted history. Recheck at the existing **2026-11-24** workload checkpoint, or when an HF candidate claims these budgets. No full HF4 port or deployment is established by this measurement.

The opt-in probe is now retained in this repo. `hf4` is an exact development alias for published `@adam0white/human-framework@4.9.0`; the app's runtime dependency remains 3.2.0. After `pnpm install --frozen-lockfile`, run `pnpm run bench:hf4 --mode full`. Add `--archive /absolute/path/archive.json` to retain the native file. The default quick mode covers one day and is not the three-year acceptance run. The slow full probe is outside the default test suite.

It preserves the reduced workload above: seed 21, the same six identities, ages and authored traits, 36 monthly daily-fidelity calls, 1,096 days and 26,304 food/water receipts. Other state uses the minimal HF4 host. Lessons, relationships and explicit sleep activities are absent. This is not a full upbringing, phone measurement or mathematical lower bound for every schedule.

| Published reduced workload      |     Budget | Observed result |
| ------------------------------- | ---------: | --------------: |
| Six-person chapter stepping     |   2,000 ms |    58,884.70 ms |
| Step per actual year/person     | diagnostic |     3,270.63 ms |
| Restore from parsed JSON, exact |   2,000 ms |    64,871.45 ms |
| Full replay, exact              | diagnostic |    67,658.64 ms |
| Export and JSON serialization   | diagnostic |       379.99 ms |
| Native archive                  | diagnostic | 4,282,497 bytes |

The rate divides by `6 * (1096 / 365.25)` person-years; the total step and restore budgets apply directly. Restore exported the same archive bytes. Replay verified the complete full hash `38a44bdef07b6663457a979e9ef4dd0d4caf20dbe5098236c54e57eb8f0ae822`. Format 7 retains all accepted transactions and uses the deliberate 4.x narration/archive change. Old build hashes are not current acceptance values.

This shared Apple M4 used Node 26.12.0 and pnpm 12.14.0. One-minute load was 2.68 at the start, 3.21 after stepping and 3.53 after replay. These are one observed run's timings, not an isolated speed ratio against the earlier candidate. Input construction, export and rendering are outside step time. Restore runs in the same process from a parsed archive.

The registry tar is 475,382 bytes, SHA256 `97485db053f24639003d4bc5e2e0958d7550a809a8affeeae924c8c765aece80`. Its integrity matches npm metadata. Provenance binds it to source `97127f60e48465fc73ffc6b469844255516e629e`, tag `v4.9.0` and publish workflow run 40830473010. Engine build: `2be1b4e3f21f68556da0b114840d876a31e2ba264e1980980b046708d67d49d1`. Raw progress, archive and artifact verification remain under `~/code/.lab-scratch/codex/g7-perf-proof/published-490/`. The app's existing replay-hash tests remain unchanged.


## HF 4.16.0 composition candidate (2026-11-01)

The owner wants every game on 4.x. The recorded 2026-11-24 cost recheck does not freeze source work. The [candidate status](hf4151-port-status.md) records the actual host port, source authority, public ingress ordering correction, prepared finite checks and remaining integration. Earlier failed cost results and proxy omissions above remain historical evidence. Both 2,000 ms budgets remain in force pending root's documented ordinary-scope decision. No current native export, runtime check, budget pass or natural-death observation has been produced under the active Well panel hold.
