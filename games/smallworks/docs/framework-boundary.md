# Game and HF boundary

Updated 2026-10-10. Grounded in the sibling HF architecture and the installed released package. The game consumes released HF 2.2.0; historical replay engines retain their exact npm dependencies.

## Ownership

| Game / host | HF / person |
|---|---|
| Actual objects, latent faults, part condition, inventories and prices | Received observations, beliefs, learned expectations and uncertainty |
| Repair actions, their world preconditions and consequences | Choosing among offered actions using capacity, motives, memory and will |
| World clock, jobs, customer agreements and verification evidence | Understood commitments, experience, relationships and response to advice |
| Domain-specific methods and observations the world can express | Acquisition, retention and application of explicitly demonstrated conditional methods |
| UI, player input, object art and business views | Deterministic state and explainable decision records |

A customer's deadline exists in the host world. Each person's understanding of it belongs to that person. Giving every actor the correct answer from the job record would erase the information boundary we intend to prove.

## What already exists

HF offers practice and skill development, instruction and observation, outcome-based expectations, beliefs and source trust, advice/refusal, commitments, fatigue, relationships, impressions, joint-activity acceptance, snapshots and deterministic replay machinery. Released package 2.2.0 is installed and pinned here. Its acquired-method faculty was added after a demonstrated gap in the earlier released package, reviewed with domain-neutral controls and published through HF's own release workflow.

The opening uses public person creation, action begin/decide/tick/finish, perceptions and snapshots. Tests show actual skill and memory changes and exact replay. The enriched chapter also uses shared time and real HF relationships/social needs: a matched-duration neutral-rest control gives Mum the same leisure effect and elapsed time, while shared tea changes her tie and social need. Subsequent public `decide()` traces change between helping and reading. This is one bounded causal human response, not evidence of general human realism or apprentice learning.

Manual repair outcomes still depend on host diagnosis/action matching. Optional authored conversation has no mechanical reward; it enriches the player's understanding rather than secretly teaching a task policy. No physiological claim about caffeine or bladder effects is made.

Skill growth is not evidence of learning an arbitrary multi-step policy. Narration describing an apprentice as trained is not evidence either.

## Acquired methods and their limits

**Implemented:** an attended, explicitly explained demonstration records conditional method evidence in the learner. Received categorical cues activate that evidence in ordinary HF decision terms. Sam's actual learned state changes his choices on unfamiliar supported lamps; withholding teaching, teaching an alternative and scalar skill alone are matched controls. The same mechanism passes a separate domain-neutral parcel scenario in HF. Player-assisted work is useful but cannot earn independent whole-job credit.

The host supplies domain-specific actions, received observations, repair preconditions and physical outcomes. It does not supply the learner's correct next choice or grant expertise after a training flag. Unknown mechanical work still leads to an ordinary help-seeking fallback, not a demonstrated ability to infer a new procedure. Scope is explicit taught categorical methods; no general planning, inferred cue composition or calibrated human learning is claimed.

The first service week additionally consumes existing public APIs for ethical convictions, actual daily practices, understood promises, actual joint cabinet work and owner choices about unfinished work. Host business agreements and authored dialogue remain game content. Actual event timestamps preserve timely collection, while broken promises remain in HF history. Further communicated experience, richer mutual participation, revision and calibrated confidence remain candidates rather than automatic scope.

## External consumer test

The game installs exact public npm releases with a lockfile. An isolated release checkout passed clean installation and all checks without copying sibling HF source. There are no sibling-source imports or aliases; npm package aliases retain historical published releases for replay. Filesystem access to the sibling was not explicitly denied during that check. Candidate framework versions can be tested as packed artifacts, but the delivered game consumes a released dependency.

HF changes are developed, tested, reviewed and released in HF. The game upgrades the dependency afterward. Engine/scenario migrations and changed replay expectations are explicit.

## Future scaling

The long-term vision needs people and early work to matter at large scale. It does not yet establish that every action by every employee can be simulated at the original temporal detail. Before an idle conglomerate, measure runtime, save size and the consequences of any aggregation or coarse stepping. Record where approximation changes outcomes. Do not build distributed infrastructure to anticipate an unmeasured problem.

## HF 2.8.0 fit and requests (2026-10-19)

Engine `small-works@5` consumes HF 2.8.0. Engine-4 worlds keep engine-4 rules until the player continues them, and replay switches rules at the recorded input (`migratedFrom.atInput`).

| HF 2.8.0 feature | Use here | Reason |
|---|---|---|
| `enableFatigueStore` | on for every person | Harmless, but it never fills: bench efforts are 0.03 to 0.08, below `depletionFloor` 0.3 (request SW-1). |
| `enableFullness` | on for every person | Changes meal timing, so historical scripted tests run under engine-4 rules. |
| `decide(..., { suggestion })` and `noteVoicePromise` | player asks and Sam's trust in the player's word | The player is a voice, not a tie. Broken word: a lapsed lesson time, a recall mid-work. |
| `decide(..., { reconsider: true })` | not used | The game never decides while an activity runs; a retry waits for the activity to end. Host reason, not a request. |
| `Affordance.alongside` | not used | People have no ties to each other here, and the player is a voice (request SW-2). |
| `Affordance.followedBy` (bodily forecast) | not used | Bench work is light; there is no follow-on exertion to forecast. |
| promptings | not used | No natural temptation in a repair day; forcing one would make faith or vice a mechanic. |
| muhasaba / evening review | not used | It reads chronicle day records; the workshop day closes at 17:00 and the game does not live evenings. |

Requests returned to HF (text as filed):

- **SW-1, mental effort fills the slow fatigue store.** Confirmed in the 2.8.0 dist: the store fills only from physical effort above `BODY_DEFAULTS.depletionFloor` (0.3), and `body` ignores an affordance's `focus`. Careful bench work (effort 0.03 to 0.08, high focus) never tires anyone across a week. Assumed: other desk, craft or study games hit the same gap. Proposal: an optional focus term in the store's fill (for example `focus × duration` above a focus floor), off by default. Workaround: none honest; the game leaves fatigue to sleep pressure.
- **SW-2, a voice as a companion for `alongside`.** Confirmed in the 2.8.0 types: `alongside` takes `PersonId`s and weighs a `together:<id>` term from closeness to that person; the player in a host game is a voice (`voiceId`), not a person with closeness. Assumed: games where the player works beside a person (lessons, shared repairs) want the same pull. Proposal: let `alongside` name a voice, weighted by that voice's trust. Workaround: none; lessons use a player suggestion instead.
- **Supports Valley 5 (a canonical saved person).** Confirmed: `restore` stamps the current engine on each person, so a host that checks `restore(saved)` against `saved` rejects every older save after an HF upgrade. The game now normalises `engine` before that check; before the fix, a v4 autosave would have been silently replaced. Proposal as Valley 5, plus a note in the upgrade docs.
