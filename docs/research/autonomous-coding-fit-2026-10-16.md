# Autonomous coding fit and HF evidence potential

2026-10-16. This changes the selection criteria from theme and inherited gameplay to **reliable autonomous edit/test work** and **bounded evidence for HF**. It does not select or implement a new game. Done for this research increment is a source-backed full-list comparison, explicit uncertainty, a bounded local feasibility probe and independent review. Adam chooses the next experiment and accepts any later game's feel.

## Recommendation

**Concordia is now the first research choice. Wesnoth is the first game-integration candidate to validate locally; FreeCol is the second.** These recommendations are provisional and answer different questions. Concordia offers a compact comparison interface without a renderer. Its strongest initial evidence would concern transfer of received conditional-method evidence, compared with a table learner and LLM systems; that would not validate the broader HF architecture. Wesnoth has unusually useful authored scenario tests; FreeCol has an explicitly headless world model. Neither game was built in this pass. Cataclysm-DDA is a strong NPC-testing reserve with a much larger simulation and usability burden. Endless Sky remains viable, but no longer leads when autonomous verification is the primary criterion.

AI Town and original Smallville are not recommended game foundations under Adam's revised preference. Existing LLM machinery is not itself an advantage for proving HF. Concordia is the exception as an experiment runner and comparison system, not as the foundation of a new village UI. No need to replace its entire agent stack or build a town first.

## How to read the estimates

“Good” means inspected tests and boundaries make a bounded change credible after environment setup. It does not mean an arbitrary game rewrite is autonomously verifiable. “Conditional” means the agent needs substantial setup, coupling control or a new behavior harness. “Poor first choice” means those costs dominate the first experiment.

HF evidence potential means the opportunity to isolate HF's contribution to an actual outcome, not simply the number of NPCs or the richness of a world. High potential is not validated human psychology, a general planner, or proof of fun. A programmable robot is an easier optimization target but often a worse test of person agency.

Codebase difficulty is judged from build dependencies, interfaces, mutable/global state, test isolation, feedback and presentation. Old tooling is not automatically archaic or unusable. Modern Rust, TypeScript or Python is not automatically simple. Ratings are qualitative engineering estimates; no hours, success probabilities or performance scores are claimed.

## Full list

| Candidate | Autonomous coding fit | Concrete test feedback / code difficulty | HF evidence potential | Recommendation |
|---|---|---|---|---|
| **Concordia** | **Good for a bounded study**; locally probed | Python entity/engine interfaces, CHOICE actions, engine/checkpoint tests. Python/Node bridge still needed. Recent API activity means pin a revision. No renderer required. | **High, narrow and controllable:** learning, partial information, commitments and comparisons with LLM/simple policies | **First research choice** |
| **Wesnoth** | **Good after native setup** | C++/WML/Lua; Boost tests plus authored scenario, play and multiplayer runners. Real executable tests need SDL setup. Apple Silicon build not verified here. | **Medium–high:** retained companions, received information, tactical method learning; weaker ordinary-life setting | **First game harness to validate** |
| **FreeCol** | **Good after Java/Ant setup** | Explicitly headless JUnit model tests; older Ant/Swing tooling, but accessible discrete model. Server/AI/controller boundaries complicate broad changes. | **Medium–high:** work, negotiation and knowledge; existing workers are not full people | **Second game harness to validate** |
| **Cataclysm-DDA** | **Conditional; strong tests, difficult integration** | Large C++/JSON simulation; actual Catch2 NPC fixtures, fixed-seed invocation and native activities. Many interactions and hidden test groups. | **High potential:** embodied companion behavior and material outcomes; complex needs must have one owner | Reserve for deeper simulation |
| **Endless Sky** | **Conditional but credible** | C++20/CMake; Catch2 and real game integration scenarios, including mission/save behavior. Native dependencies and graphics/display setup remain work. | **Medium–high:** a persistent captain's decisions change journeys; person identity and off-screen continuity remain unknowns | Stronger than Naev on inspected tests |
| **OpenTTD** | **Good for bounded simulation edits** | C++20/CMake, CTest and scripted regressions; dedicated build possible. Synchronization/save compatibility and Squirrel runtime bridge are constraints. | **Low–medium:** good company/leader decisions; ordinary people require a new layer | Strong tooling, weaker HF question |
| **Mindustry** | **Good for bounded simulation edits** | Java/Gradle JUnit with headless Arc backend and map/save tests; singleton state and assets still matter. | **Low–medium for people:** strong logistics tests, but machines do not naturally establish human agency | Choose only for a logistics question |
| **Naev** | **Conditional; behavior harness needed** | Rust/C/Lua and Meson; inspected tests emphasize startup/menu, metadata and lint. Lua extensibility is not a substitute for causal regression tests. | **Medium:** missions/factions/captains are plausible; persistent-person adapter unproven | Below Endless Sky for autonomous work |
| **Freeciv** | **Conditional; partial source inspection** | Mature native engine with Meson CI and ruleset save/reload tests. Full behavior-suite depth and local build were not established in this pass. | **Medium for leaders/diplomacy**, lower for individual lives | Strategic reserve; confidence lower |
| **Luanti + a chosen game** | **Conditional** | Engine/server unit tests and software-rendered client smoke exist. Lua modding helps; an actual game and NPC model still need selection. | **Medium now, higher possible:** useful embodied actions only after that game gap closes | Defer 3D and content burden |
| **Veloren** | **Poor first choice despite modern code** | Large Rust workspace; rtsim/world/ECS/server boundaries; assets/toolchain; cargo tests do not settle visible behavior. | **High ceiling, high confounding cost:** persistent travel and people need loading and world controls | Defer 3D integration |
| **Unknown Horizons** | **Poor first choice until unchanged tests run** | Python plus FIFE/fifechan native dependencies. Existing economic game tests are useful, but source uses removed pytest hooks/APIs. | **Medium:** production outcomes are testable; individual agency must be added | Concrete compatibility risk |
| **AI Town** | **Conditional technically; not preferred as a game base** | TypeScript/Jest and browser UI, but Convex, timers, inference and persistence increase the operational surface. Existing tests do not establish behavior quality. | **Medium–high for a controlled comparison**, but chat/town behavior needs substantive new outcome rules | Lower priority than Concordia |
| **Original Generative Agents / Smallville** | **Poor first choice** | Research-era Python/Django/OpenAI setup; separate simulation/environment processes and replay. A replay is not a fresh causal rerun. No ready behavior acceptance suite established here. | **Medium as historical comparator**, lower evidence per integration effort | Reference, not implementation base |

Evidence for each row and exact upstream test commands: [native hosts including Freeciv](native-testability-2026-10-16.md), [simulation hosts](simulation-testability-2026-10-16.md), and [Concordia source consultation](hf-comparison-consult-2026-10-16.md). All candidate source refs are pinned there or in [the upstream list](upstream-refs-2026-10-16.json). These commands are **not local passes** except the Concordia probe below. No candidate UI was played during this assessment.

## What I actually tested

Checked Concordia at `6fbfbc58f324aa74f78568c488713210889a801e`, the same October 15 revision identified in the previous research. Installed it with base dependencies plus pytest/xdist in a temporary isolated Python **3.12.13** environment on this Apple Silicon Mac. The default system Python is 3.15; using the supported environment avoids assuming newest means compatible.

Ran engine action-spec, sequential, simultaneous and checkpoint test files with `-n 0`: **19 passed in 2.91 seconds**. [Recorded output and command](evidence/concordia-engine-probe-2026-10-16.txt). The source checkout remained clean. No paid API, model, embedder, HF adapter, benchmark or game ran. This is a small real feasibility probe, not the complete upstream suite or evidence of an implemented comparison.

**Correction to the earlier broad description:** Concordia's usual agent prefabs use LLMs and embeddings, but its core Entity and engine interfaces do not require either. Its tests run mock entities. A deterministic game master and a non-LLM HF actor are plausible at the existing interface. The CHOICE action form already exists, so a shared finite-action comparison need not force a foreign action format onto Concordia. The inspected sequential loop does not validate actor outputs itself; our adapter must validate every arm identically.

## Can an autonomous agent test the changes meaningfully?

Yes, if the change has an inspectable causal boundary. For a game, first reproduce one unchanged upstream test in the intended environment. Then add a scenario at the intended integration point and show that an intentional broken behavior fails it. After that, integrate one HF person. Native low-level physics and action execution should continue to run. Saves must preserve actor snapshots, host state, observations, time, RNG and version provenance together.

Separate four gates:

1. **Build and unit correctness:** type/API contracts, state invariants and adapter failure handling.
2. **Host behavior:** the actor actually travels, transfers a resource or executes the activity, using the host's own rules.
3. **HF contribution:** matched controls show that received experience or another selected HF mechanism changes choices and outcomes. A host hardcoding the desired choice does not pass.
4. **Presentation and experience:** the consequence is visible, understandable and worth engaging with. Test results do not replace this gate.

In 3D, a coordinate or body-state assertion cannot prove appearance is correct. Needs, injury, activity and relationships can require explicit model/animation mappings; HF does not automatically render them. Camera, occlusion, collision and timing need fixed visual checkpoints and observed interaction. 2D icons, sprites or a simple event timeline reduce this work, while still needing truthful presentation. For the first comparison, use no 3D and keep any viewer a projection of the same recorded state, not another simulation.

## The proposed Concordia comparison

Prefer one small invented environment with meaningful consequences: a few agents can observe a demonstrated method, act, inspect, seek help or refuse under scarce time and materials. Use unfamiliar labels/rules so the task measures acquired experience rather than ordinary repair knowledge. Include misleading appearance, absent cues and changed conditions. Stay within released HF's bounded conditional-method capability; disclose failures on unsupported compositions instead of silently expanding the framework.

One deterministic environment owns feasibility and outcomes. Every policy receives the same observation fields, action IDs/descriptions and available history. HF receives structured inputs; the LLM receives the same information in an equivalent schema and returns a legal action. Do not give HF hidden truth, predicted utility or a correct-action flag. Both get identical demonstrations. Deterministic resolution prevents an LLM game master from deciding whether HF succeeds.

Minimum policies: HF intact; HF with acquired method evidence removed; legal random; a fixed safe policy; a simple conditional-table learner; and an LLM with equal received history. A documented Concordia memory/reflection agent is an additional systems comparison, not interchangeable with a plain LLM. Report configuration, host encoding, manual authoring/tuning effort, memory budget, model version, calls, latency and cost. Equal token counts do not ensure equal information. Do not reward merely repeatable wrong behavior.

Use held-out worlds/rule combinations after freezing the generator and metrics. Match external events independently of policy random draws. Distinguish actor-state ablation from attended/withheld teaching. Repeat stochastic API runs; do not treat one episode's decisions as independent samples. Primary results are externally checked task outcomes, waste, unsafe actions and time, reported separately. An internal HF score or an LLM's opinion of the story is not an external success measure. Standardize partners first; mixed-policy groups need a later design controlling partner effects.

This could establish bounded capabilities, failure modes and engineering costs. It cannot establish general human realism, broad superiority to LLMs, emergent society or an enjoyable game. Using Concordia's runner also does not make a custom environment an independent benchmark. The simple table learner is important: HF must earn its extra complexity against a strong cheap baseline.

## Is Concordia itself necessary?

A tiny standalone deterministic runner is the effort baseline. We still have to build the world, encoders, persistence and outcome measures; merely importing Concordia would not supply an independent benchmark. Its useful contribution is an existing Entity/ActionSpec contract, multiple turn-taking engines, checkpoint boundaries and compatibility with documented LLM-agent configurations. Those can make the systems comparison easier to inspect. This advantage is a hypothesis, not measured saved effort.

At the first adapter gate, check whether those contracts actually reduce custom orchestration. If the study only wraps a tiny synchronous action loop and uses none of the existing scenarios or comparison components, keep the standalone runner instead of forking Concordia. The question is HF versus disclosed baselines; dependence on Concordia is optional.

## Proposed order, not a build commitment

1. If the aim is **HF evidence**, choose the bounded Concordia comparison. First acceptance gate: one HF entity, one deterministic GM, one real legal action, and exact synchronized save/restore across Python and Node.
2. If the aim is **a game**, first validate Wesnoth's scenario harness locally. Compare FreeCol if its work/negotiation setting is more appealing. Keep inherited controls and restrict the first change to one actor's high-level choice.
3. Keep 3D and the older AI-town applications out of the first integration. Revisit only after evidence or a specific desired experience justifies their cost.

No game code, archive deployments or framework package changed in this research increment. This assessment supersedes the previous theme-first ranking for the revised criteria. Adam has not selected an implementation.

## Independent review

Astra inspected the source contract and proposed the comparison controls. Two fresh reviewers checked the integrated assessment for autonomous coding fit, source support, fairness and proof scope. The final revision clarifies that source-only consultation preceded the later 19-test probe; qualifying Concordia's effort advantage remains a judgment; the primary proof is conditional-method transfer, not the entire framework; and a standalone deterministic runner is the dependency/effort baseline. No reviewer selected a build or accepted game feel.
