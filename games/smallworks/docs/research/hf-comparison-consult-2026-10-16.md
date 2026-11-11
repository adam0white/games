# HF comparison consultation

2026-10-16. Research proposal; no host selected, adapter built, or experiment run. This responds to Adam's emphasis on autonomous coding and meaningful agent verification. It supplements the [host screen](open-source-hosts-2026-10-16.md).

## Recommendation

For testing HF, prioritize a **bounded Concordia comparison** over a new living-agent game. For delivering an enjoyable game, continue comparing existing non-LLM game bases. These are different deliverables. Concordia offers a relatively small, inspectable experiment boundary; it does not supply embodied gameplay or prove that HF makes a game better.

Do not rank Concordia below native games just because it is Python or previously assume its interface forces unrestricted text. Conversely, using its runner does not make our custom environment an independent benchmark. We would still author most of the consequential environment.

## Verified current source

Checked upstream main at **6fbfbc58f324aa74f78568c488713210889a801e**, whose commit timestamp is **2026-10-15 17:36:28 UTC**. That establishes recent activity, not release stability. This consultation performed source review only. Root subsequently installed the same revision and passed 19 upstream engine/checkpoint tests; see [the later probe](evidence/concordia-engine-probe-2026-10-16.txt). Neither activity built an HF adapter.

| Source | Observed contract | Implication |
|---|---|---|
| [Entity interface](https://github.com/google-deepmind/concordia/blob/6fbfbc58f324aa74f78568c488713210889a801e/concordia/typing/entity.py) | `name`, `observe(str)`, `act(ActionSpec) -> str`; FREE, CHOICE and FLOAT; choice validation; JSON-compatible action specifications | A non-LLM entity can return a legal choice. HF needs an observation encoder and a Python-to-Node bridge, not a Python port. |
| [Sequential engine](https://github.com/google-deepmind/concordia/blob/6fbfbc58f324aa74f78568c488713210889a801e/concordia/environment/engines/sequential.py) | GM supplies observation, next actor, action specification, resolution and termination; observations are delivered concurrently; action gets an actor-name prefix | A deterministic GM can own these functions. Parsing, concurrent observation reads and transition idempotence need explicit handling. The inspected loop does not itself call player `ActionSpec.validate`; the adapter must validate. |
| [Engine serialization](https://github.com/google-deepmind/concordia/blob/6fbfbc58f324aa74f78568c488713210889a801e/concordia/environment/engine.py) | JSON action specification serialization/parser with legacy fallback | Use finite choices and exact serialization; avoid natural-language interpretation of commands. |
| [Sequential test](https://github.com/google-deepmind/concordia/blob/6fbfbc58f324aa74f78568c488713210889a801e/concordia/environment/engines/sequential_test.py) | Mock entities run the loop without LLM calls | Evidence that the loop is not intrinsically dependent on an LLM GM; not evidence our HF adapter works. |
| [Checkpoint tests](https://github.com/google-deepmind/concordia/blob/6fbfbc58f324aa74f78568c488713210889a801e/concordia/environment/engines/checkpoint_test.py) | Callbacks follow completed steps, including skipped steps | Useful boundary for recording. These tests do not establish serialization or exact restoration of an HF/LLM comparison. |

The ordinary Concordia prefabs use LLMs and associative-memory embeddings. A deterministic GM plus HF entity need not use those prefabs. Keep this distinction in the main report. An LLM comparison arm can use Concordia components, but must disclose their exact configuration.

## One discriminating task

Use a small unfamiliar world where a person acquires conditional methods through observed demonstrations and results. Later, that person chooses an action on a new object with a familiar condition, a misleading surface resemblance, or an unobserved condition. Include safe inspection, help and refusal. Exogenous constraints can make acting, asking or waiting costly. Do not reuse repair lore that a pretrained LLM already knows.

**Primary capability:** acquired experience changes appropriate later choices under received evidence. **Primary external outcomes:** successful physical completion, wasted resources, unsafe actions and time. Report them separately. Do not reward HF's internal confidence, needs satisfaction, method match or adherence to its own decision rule. There can be multiple reasonable social choices; do not assign moral correctness to a particular loyalty or refusal.

The first study should stay within released HF 2.2.1's demonstrated conditional-method scope. A separate hard set should expose its limits: changed rules, absent cues, novel compositions and new actions. Keep supported-case performance and unsupported-case failures visible. Do not silently expand HF until it passes its own test.

## Fairness controls

| Confound | Required control |
|---|---|
| Structured-action advantage | Give every policy the same legal action IDs, descriptions, observation fields and available history. Give the LLM a structured output schema. Randomize action order in paired runs. Validate every arm identically; record invalid responses and use one predeclared retry rule. |
| Host encoding HF's answer | Menus depend on physical possibility, not HF state or desired behavior. Never include predicted utility, correct-action flags or hidden fault labels. Audit the observation encoder. If HF needs explicit method demonstrations, show the same demonstrations and conditional descriptions to every arm. |
| LLM prior knowledge | Procedurally randomize fictional object names, cue-to-outcome rules and appearances. Separate familiar-world and invented-world sets. Teach both arms the same task rules. Random names reduce leakage; they cannot erase pretrained reasoning advantages. |
| LLM GM or judge bias | Use deterministic transitions and machine-checkable outcomes for the primary study. No model decides whether another model's action succeeds. Optional natural-language social judging is a separate exploratory result with blinded human checks. |
| Circular reward | Define outcomes outside HF. Include a simple method-table learner and a rule policy; HF must justify its extra complexity against them. Do not equate a preference fit with human realism. |
| Component and budget differences | Compare plain LLM with equal history, a documented Concordia memory/reflection configuration, HF and simple policies. Pin models, prompts, retrieval, examples and tuning budgets. Report tokens, calls, latency and compute. Present both controlled-resource and best-configured results; equal token counts do not mean equal information or capability. |
| Memory advantage | Start the controlled LLM arm with the complete received transcript within a declared bound. Report retrieval/truncation separately. HF's compressed structured state is an architectural feature whose construction and information content must be disclosed. |
| Seed confounds | Pre-generate world events by episode/time/object keys independently of actor draws. Pair worlds across policies. Keep world seeds, actor seeds and API sampling settings separate. Repeat stochastic model runs; an API seed does not guarantee exact reruns. |
| Evaluator overfitting | Freeze generators and metrics before held-out evaluation. Reserve rule combinations and task families. Have a reviewer author or inspect hidden cases without tuning HF on their answers. Report all attempted cases and uncertainty, including ties and failures. |

A valid result compares complete systems under specified conditions. It does not isolate the value of an internal HF mechanism unless the matching ablation actually removes only that mechanism.

## Arms and causal checks

Minimum arms: HF intact; HF without the relevant acquired method evidence; uniform legal random; a fixed safe policy; a simple conditional table learner; LLM with equal history. Add the documented Concordia agent configuration if resources permit. The table learner is essential: beating random or a weak LLM prompt would not justify HF.

For paired interventions, compare identical post-training world snapshots while restoring only the chosen actor state. Also run a separate attended-versus-withheld teaching experiment with matched time and exogenous events. Do not confuse those two estimands. A shuffled-evidence control tests whether relevant evidence matters. Run a cue-conflict test and a restored-save continuation. Record whether a policy learns, whether its knowledge changes action, and whether that action changes outcome.

Use multiple worlds as the independent units. Report paired differences with uncertainty; do not count repeated decisions in one episode as independent samples. Predeclare an initial fixed evaluation size and stopping rule after a separate variance pilot. Mixed-policy groups introduce partner effects: start with standardized partners, then cross policy assignments and roles in a separate interaction study.

## Autonomous coding fit and game comparison

These are conceptual rankings, not build benchmarks.

| Route | Agent can meaningfully verify | What remains difficult |
|---|---|---|
| Concordia bounded environment | Interface compliance, state transitions, information boundaries, causal controls, repeated evaluations and restore | We must author the consequential world; narrow success may be task-specific. Python/Node lifecycle and LLM accounting remain work. |
| Turn-based existing games, such as Wesnoth, FreeCol or CDDA | Discrete state and action outcomes are promising test boundaries; existing gameplay supplies independent constraints | Exact testability needs host inspection. Human behavior must fit the existing game; CDDA's complexity and UI remain costs. |
| Scriptable games, such as Naev or a chosen Luanti game | Potentially narrow scripting seam and observable actions | Scripting is not proof of a stable person adapter or automated play. Need actual host and version. |
| Native real-time games, such as Endless Sky or Veloren | Headless decision tests and selected engine invariants | Movement, loading, persistence, timing and visible consequences add integration work. Agent inspection of source cannot establish compelling 3D action or owner enjoyment. |
| AI Town or Smallville | Existing agent schedules and text traces | Much inherited machinery is already LLM-oriented. They are weak default choices when Adam wants an existing non-AI game and independent evidence for HF. |

Concordia is the most promising inspected research interface for a bounded comparison. Better HF evidence per integration effort is a design estimate, not a measured efficiency advantage over other hosts. A turn-based or scriptable existing game is the provisional first category for **independently constrained gameplay with testable consequences**. No basis yet establishes which individual game wins. Real-time 3D should rise only after a narrow build demonstrates both state observability and visible consequences.

## What completion would establish

A completed study can establish bounded learning effects, failure modes, costs, reproducibility and performance against disclosed baselines. It cannot establish general planning, human realism, social validity, broad superiority over LLMs, or an enjoyable game. A separate source-unread playtest must show that a player notices the consequence, understands their influence and wants to continue. Adam accepts feel.

If chosen, the first adapter acceptance gate is one HF entity, one deterministic GM, one legal decision and exact save/restore across the Python/Node boundary. Reject or revise the adapter if observation translation requires invented beliefs or host-selected answers. The next gate is the held-out comparison. No implementation is authorized by this consultation alone.
