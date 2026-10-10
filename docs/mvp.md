# MVP target: home to first handoff

2026-10-09. The owner authorized autonomous implementation with bounded delegation and reviews, through a meaningful playtesting dependency. First delivery is the home-to-garage opening. The full apprentice-learning target below remains to be demonstrated; no HF release is set by this document.

## Promise

Start by tinkering with a family object at home. Repair a few friends' objects in the parents' garage. Teach one apprentice, then experience the first prestige: they complete an entire repair without your expertise, leaving you free to take on broader work or return to a personal project.

## Proposed content budget

- Two modest spaces: the home bench and the garage, introduced sequentially.
- One main object family with bounded fault variations: battery-powered lamps are the proposed first choice. One donor and one put-aside personal object use the same parts and actions. Music boxes and mechanical toys are future candidates, not MVP obligations. These are fictionalized repair models, not technical tutorials. Final choice depends on the opening prototype's appeal.
- One player character, one apprentice and two recurring family/friend customers. The proposed apprentice is a friend who starts learning alongside you, then agrees paid work once the garage has a small flow of jobs. Specific biographies remain undecided and fictional; do not import the owner's family as characters by default.
- A small parts tray with condition and compatibility. One donor object demonstrates recovery and reuse. A waiting shelf holds unfinished work.
- A compact sequence of jobs followed by a continuing garage period after the first handoff. No fixed real-time duration until the opening is tested.

## Play loop

Examine the object and what its owner says → choose an informative test → form or revise a diagnosis → choose repair, reuse, defer or return → perform work over simulated time → verify the result → return the object and experience the consequence.

Successful tests narrow hidden fault possibilities. Faults and latent properties are drawn when a job is created and persisted; they are not rerolled after every inspection. Work quality can vary with skill, method, part condition and circumstance, with seeded outcomes and visible reasons. The host must offer an understandable route to verification; repeated random clicking is not the intended strategy.

A failed attempt must reveal actionable evidence or have a bounded, understandable cost; endlessly repeating the same action until a hidden success roll wins is not a repair loop. Verification checks actual function against the owner's requested outcome.

Putting an object aside preserves its parts, evidence and repair stage. Save and reload preserve that state. Returning it unfinished ends the present customer promise honestly but need not erase the object or prevent a later return.

## Concrete opening proposed for M1

A family lamp flickers when moved. A weak battery and an intermittent contact are plausible explanations in the game's model. The player can test with a known-good battery or inspect the holder and switch; the observations distinguish the causes. Restoring a steady pool of light is the visible payoff, and the family member's response establishes why this particular object mattered.

A second personal lamp has a visibly broken holder. Its compatible replacement is missing, so the player labels and shelves it instead of forcing a repair. A donor object introduced later supplies a suitable part. This makes the return to an early object mechanically useful, not just a sentimental caption.

M1 implements only the first object's small diagnostic vocabulary, one repair method, and preserving the second object's unfinished state. Additional fault methods arrive only when teaching needs them. The opening should permit experimenting without a ticking commercial deadline.

## Teaching and first prestige

The apprentice initially observes or assists. Demonstrations expose relevant observations and a bounded method, not privileged knowledge of hidden faults. Supervision offers correction and explanation. Existing HF instruction and observation support skill development; conditional method acquisition is a candidate new framework capability.

Use a small method vocabulary: inspect, test, repair, verify, and seek help or defer when evidence is insufficient. Procedures need conditional choices and termination, but not a universal planner or programming language.

The capability probe is bounded to two authored methods and one exception. Fix its observation vocabulary and procedure-size budget before tuning. Transfer means unfamiliar appearances or parameter combinations inside a learned diagnostic structure, not inventing a wholly unseen procedure.

Proposed teaching beat: the friend wants to replace a battery because the previous lamp needed one. You demonstrate a test that shows why this lamp needs a different repair. Later, the friend uses that distinction without your prompting. Correction should communicate a reason; repeated demonstrations solely to fill a training bar are not the intended experience.

The first prestige is evidenced by an apprentice owning intake through diagnosis, repair, verification and the customer's outcome on a supported job. The player does not choose the diagnosis, supply a hidden answer, finish the job, or silently grant an expertise bonus. Tools and parts previously provided remain legitimate resources. Asking for help is valid on an unfamiliar exception, but a rescued repair does not count as the independent completion.

After the handoff, the player can accept and organize the next work while the apprentice handles a familiar job, or resume the put-aside personal project. Delegation remains reversible. The business does not turn into an unexplained passive-income multiplier.

The post-handoff episode offers two overlapping supported jobs: choose their order and agree achievable return times, then return to the personal lamp using the recovered part. The apprentice diagnoses, repairs, verifies and reports both jobs without routine bench intervention. Customer promises permit this choice without an artificial emergency punishing hands-on play. The resulting question for the player is whether they want to delegate another job, not merely whether they can.

## People and agency

Workers are HF people. Knowledge, learning, fatigue, willingness and understood commitments affect their choices. Reports are based on what they know. The player is represented as a person too; manual input is a host control channel whose exact coupling to HF capacity needs a bounded decision before implementation. Avoid double-counting real player knowledge as automatically learned simulated knowledge.

The apprentice's availability is agreed and communicated, so a refusal or departure is understandable. Warmth and ordinary obligations can establish character without building a general dialogue engine. Spiritual life can influence motives and commitments naturally; broader faith systems are not a new MVP subsystem.

## Business scope

Track quoted fees, material costs, cash and an agreed apprentice payment. Authored customer jobs and stable prices are enough. Preserve ownership and quantities of parts; recovered parts cannot be spent twice. Reuse offers a suitability/quality/time choice, not universally free profit.

No endogenous market, multiple branches, debt system, online economy, employee marketplace, server, multiplayer, general LLM dialogue or offline-income system. Those ideas stay in the roadmap.

## Acceptance

Adam is the acceptor. The proposed completion artifact is a playable standalone build that reaches first prestige and remains playable afterward, with save/load, replay and playtest export. If a generic HF extension is required, it must be released and consumed through the published package; HF's existing games are upgraded and checked under its own release workflow.

Acceptance has three distinct requirements:

1. **Enjoyable opening and transition:** Adam enjoys at least one repair before delegation, understands why work was put aside, and feels that the independent apprentice creates useful freedom. After playing the scheduling/personal-repair episode, he wants to use delegation again. Record playtester words verbatim; do not substitute a headless score for this judgment.
2. **Causal framework evidence:** a domain-neutral headless control shows learned conditional behavior transferring to an unfamiliar variation; a skill-only control and an ablation lack the corresponding learned behavior. Hold host offers and fault rules identical across controls. Withhold or change teaching, including demonstrating a valid alternative method: acquired person state and subsequent choices must change accordingly. Decision traces must read that acquired state, rather than activate a fixed host policy after a training flag. Relevant observations, learned state, decision traces and actual outcomes establish the chain. Compare external events with keyed seeded draws; report null and adverse results. One successful game job alone does not prove learning or reliability.
3. **Technical coherence:** installed released HF works through public APIs without sibling-source access; partial repairs and independent activity survive save/load; exports replay to the same rule state. Two independently held-out supported fault variations exercise delegation, and one out-of-scope variation exercises appropriate help-seeking or deferral. Persist scenario and engine provenance.

If a new faculty is added, the generic control belongs in HF. If the released package already supports the same conditional learning and transfer, retain the same controls in the game's consumer test suite and document the existing API/state that produces the effect; no new HF release is necessary. A fun game that fails this learning test is useful prototype evidence, but is not acceptance of the proposed apprentice-learning goal. If the probe cannot meet the test within bounded scope, return to Adam with the demonstrated limit and a narrower recommendation.

## First playable checkpoint

Build the smallest family opening and its transition into bounded garage free play. Reveal controls through received observations and conversation rather than future menus or checklist instructions. Unknown objects and business contacts are undiscovered, not merely disabled. Include enough garage work for shelving/resumption and reuse to become meaningful. Stop for Adam's reaction to this playable experience before implementing conditional apprenticeship. The full MVP is the target; every roadmap tier is not a prerequisite.
