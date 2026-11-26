# Cinderhill: round-3 review before the rebuild

Status: 2026-11-26. The owner played the M1 build and said it was "too slow and still too basic". A full rebuild by a stronger model comes next, so this round reviewed the spec, roadmap and plan from many sides before that build starts. This file records what each reviewer found, what we changed, and why. Docs 02 to 05 were rewritten from it.

## The play evidence

Replays of the owner's own sessions on 2026-11-26, read back with `experiments/cinderhill/spikes/replay-lab.mjs`. Every record that carried a replay on sim 6 replayed to its recorded hashes. Two colony records had no replay section and one was recorded on sim 5; their lengths and counts come from the lab record alone. Raw records stay private.

| Mode | Sessions | Length | What happened |
| --- | --- | --- | --- |
| Colony (20 workers, quota day) | 7 | 1 s, 12 s, 60 s, 69 to 120 s, 75 s, 92 s, 427 s | A trail drawn in the first 2 to 3 s. First food home 73 s after the trail, or never. No birth in any session. No threat in any session. Long gaps with no order |
| Sandbox, 5,000 ants, no goal | 1 | 1,035 s (17 min) | 81 orders, 2,122 deliveries, left by choice |
| Sandbox, 2,000 ants | 1 | 73 s | |

The longest session by far was the goal-less 5,000-ant sandbox. That is one session, so it is a signal, not a finding.

## Who reviewed, and how independence was kept

| Reviewer | Given | Lens | Full text |
| --- | --- | --- | --- |
| Blind design A | Genre, constraints, the evidence; no spec, no repo | Design the game from scratch | [round3/design-a.md](round3/design-a.md) |
| Blind design B | Same, run in an empty folder | Same | [round3/design-b.md](round3/design-b.md) |
| Blind design C | Same, run in an empty folder | Same | [round3/design-c.md](round3/design-c.md) |
| Red team | Docs, code, evidence | "We built it to spec and it failed because..." | [round3/red-team.md](round3/red-team.md) |
| Players and genre | Docs, code, evidence | Colony and RTS veteran, two-minute phone player, parent with a child, pacing designer | [round3/players.md](round3/players.md) |
| Technical feasibility | Docs, code, evidence | Engine and netcode; keep, extend or rewrite per module | [round3/tech.md](round3/tech.md) |
| Cold builder | Docs, code, evidence | Every point where a builder would have to guess | [round3/builder.md](round3/builder.md) |
| Business and market | Docs, evidence, web search | Audience, channels, shareability, monetisation, name | [round3/business.md](round3/business.md) |
| Wildcards | Docs, code, evidence | Bold alternatives, each as a one-page toy | [round3/wildcards.md](round3/wildcards.md) |

The reviewers ran on four different models from two vendors, so no single model's blind spots dominate. The three blind designers each used a different model.

No reviewer saw another's output or this file's conclusions. Each lens reviewer was asked the same central question: why did a twice-reviewed spec produce a slow, basic game?

## The answer to the central question

All six lens reviewers reached the same answer on their own: **mostly the spec, and the build made it worse in one place.**

- The spec used the 8-to-12-minute day as the clock for everything: brood (egg to adult "about one day"), threats (first on Day 2), new verbs ("at most one a day"), goals ("one goal per day"), the payoff of the first choice ("at dawn of Day 2") and bloom ("over days"). Every slow number in the replays is a spec number, taken literally (red team; the spec lines are cited in its review).
- The spec had pass lines for hashes, frame rate, snapshot bytes and unintended orders, and none for pace. Of the twelve ranked traps in 09, none is about slowness. Agents passed every gate they could measure; fun was left to one owner gate at the end.
- The build skipped feature 53 (the founding seed, husk and sprout), which was the only first-minute decision, and put a 10-minute delivery quota in its place. The roadmap's M1 build steps never listed feature 53, though its gate did (players lens; confirmed against 04 round 2, whose M1 build steps 1 to 7 do not name feature 53).
- Geometry: ants walk about 1.9 cells a second (`WALK = 24` sub-cell units a tick in `sim/sim.js` at commit `0d6fd214`; confirmed). A 47-cell trail plus a 24-cell shaft (`world.js`, home chamber at depth 24; confirmed) is a 70-to-76-second round trip before any choice pays off (tech and builder lenses).

So the rebuilt spec states pace as numbers with the same force as frame rate and determinism, checked by bots and replays in CI, and no clock is measured in days.

## Findings, ranked by independent agreement

"Raised by" counts reviewers who reached the finding without seeing each other. Blind designers count when their design embodies the finding.

| # | Finding | Raised by | Decision | Where it landed |
| --- | --- | --- | --- | --- |
| 1 | A pace budget in seconds, checked from replays and bots in CI: first order, first delivery, first birth, first choice, first threat, longest idle gap | All nine | Adopted. The day is a save point and a story beat only | 02 §0 and §3, 04 gates, 03 feature 1 |
| 2 | Start with a living colony that is already moving, not 20 ants and a quota. The swarm is the draw, so a first session must reach hundreds of ants within minutes and thousands within a chapter or two | Blind A (30 ants plus staggered brood, 100 by 3:00, thousands by 20:00), B, C (480 adults), business, wildcards, red team, players | Adopted: reach hundreds within minutes. The start size is decision 6 (recommended: about 300 survivors). Growth targets per chapter | 02 §3.2, §4 |
| 3 | Brood in seconds: mature pupae at the start (a birth inside 15 s), player-funded batches that hatch in 45 to 90 s | Blind B, C, builder, players, red team | Adopted | 02 §6.3 |
| 4 | The first choice must pay off inside a minute, not at the next dawn. The seed husk becomes a placeable object (plant it for cover, or use it as a roof or door), and a bird shadow or rain tests it within 60 s | Blind C, builder, players, red team, tech | Adopted. The husk and bloom premise stays, compressed | 02 §4, §6.5 |
| 5 | Release is a short complete experience with real stakes, not a 24-day, 4-to-5-hour campaign. Chapters of 6 to 12 minutes; the first about 5 | Red team, business, blind B (5 to 8 min chapters), blind C (10 to 14), wildcards (20-min runs) | Adopted: the first release is Spring as six chapters on one hill. The structure itself is an owner choice (decision 1) | 02 §2, §8; 04 |
| 6 | Weather and terrain works drive decisions: rain that runs down the tunnels the player dug and floods low cells, and structures (spans, ramps, roofs, plugs, channels, a soil mound) that change routes | All three blind designs built their game on this independently (A as an integer water automaton on the grid), builder | Adopted as the core strategic layer, with water as its own hashed subsystem | 02 §6.5, §6.6, 05 |
| 7 | Labour allocation is the main economic decision: every trail and work has a crew with a wanted count the player sets; one rule decides who goes | Builder (exact rules), players, blind B (allocation cards), blind C (Light, Steady, Surge) | Adopted, with the builder's priority order | 02 §6.2 |
| 8 | Traffic is a resource: queues at doors and crossings, loads per minute shown on every route | Blind B, blind C, builder | Adopted | 02 §6.2, §7 |
| 9 | Outside players at the first playable chapter, not at M3 after Summer content | Red team, business, blind C (8 of 10 unaided), players | Adopted: R1 gate includes five fresh players | 04 |
| 10 | Real loss inside a chapter. The spec removed stakes on every axis at once (an unbeatable Tide, a replaceable queen, all endings wins, restart and floor) | Red team, blind B (chapter loss when all routes to the queen are cut) | Adopted: a chapter can be lost and retried from its checkpoint; the campaign never dead-ends | 02 §8.2 |
| 11 | Bloom must pay inside a session: a sprout within a minute, a green patch by chapter end, a share picture | Red team, business, players | Adopted | 02 §6.6, 03 |
| 12 | Saves are promised but not built; feature 8 says 30 s and 05 says 20 s; dawn state lives in memory | Tech, builder (confirmed: `host.js` keeps dawn saves in a `Map`, no IndexedDB) | Adopted: 20 s checkpoints in IndexedDB, previous good save kept, built in R1 | 05 Saves |
| 13 | Navigation does not scale to rivals and structures: 16 fixed flow slots, synchronous rebuilds (nine rebuilds took 11.56 ms, confirmed in `sim/SPIKES.md`), `Uint16` distance saturation (confirmed: `INF = 0xFFFF`) | Tech, builder | Adopted: rewrite the goal manager; keep the solver | 05 |
| 14 | Combat target scans are unbounded: the tech reviewer's local probe reported 77 ms at 5,000 ants in one cell (reported, not re-run) | Tech, builder (frontage rule) | Adopted: frontage contact slots | 05, 02 §6.4 |
| 15 | Friends: same-seed challenges and replay links first (no room needed), then one shared colony; lockstep versus last, off the solo release path | Blind B (one shared colony), blind C (shared colony and same-seed challenge), wildcards (raid by replay), red team, business | Adopted | 02 §9, 04 |
| 16 | Daily hill, share picture and replay links move from P1 and P3 into the first public build | Business, wildcards (ghost trails) | Adopted | 03 |
| 17 | Free play (the sandbox) stays on the menu from the start, with 200 to 5,000 ants | Blind B, business | Adopted | 02 §8.3 |
| 18 | Tournaments are a direct-control minigame inside an indirect-control game, proven only by bots | Red team, builder | Changed: an optional set piece, not the only path to allies; kept out of the first release | 02 §10 |
| 19 | Undefined rules a builder would guess: room capacity and worth, seed ledger, order ownership, gestures for Alarm during a pinch, weather order, UI layout | Builder | Adopted: each now has a rule in 02 | 02 §6, §7 |
| 20 | Name check, channel plan and a monetisation rule are missing | Business | Adopted: name check before any public listing; monetisation rule written (none in the core) | 02 §12, 04 |
| 21 | Ladybirds thinning an aphid herd still echo the reference game's advertised pairing | Red team | Adopted: dropped | 02 §1 |
| 22 | The natural-history framing (field guide, "real basis" notes, a field-guide-plate look) rebuilds the reference game's documentary identity by another route | Red team | Owner's call (decision 4) | 02 §1 |
| 23 | Release on a 24-day arc with Winter, the wedding flight, New Hill+, the Changeling and three neighbour species | Red team (cut), blind designs (none had them) | Changed: all are after the first release; the Changeling and two of three neighbours are cut from the plan, kept in 07 as ideas | 02 §10, §11, 03 |
| 24 | Scent is shared ground: rival colonies read the player's trails, follow them to food and to the nest, and fall for decoy trails. The one verb then carries offence, defence and deception | Blind A (central idea), red team (rivals as AI on the player's rules) | Adopted for the rival layer in R2; the first chapters have no rival | 02 §6.4 |
| 25 | Now versus later: every load either grows the colony now or goes into stores for the chapter-end bill (a dry spell, a cold night). A greedy colony grows faster until the bill comes | Blind A (winter as the bill), blind C (stores against rain) | Adopted as the chapter-end check from chapter 3 | 02 §6.1, §8.1 |
| 26 | Pace metrics beyond first events: the longest gap between "decision events" (new source, source empty, threat in view, room full, rain warning, unlock), the share of idle workers, ant count at fixed times for a scripted median bot, and a passive bot that must still finish chapter 1 | Blind A, red team | Adopted into the pace gate | 02 §3.1, 04 R0 |

### Second red-team pass on the revised draft

A fresh reviewer, given 01, the revised 02 to 05 and the evidence but not this file, multiplied the new numbers out. It found that the first draft's door rule jammed in seconds and made Recall useless, that the idle line and starting stores were undefined, that chapter 1's script broke its own 30 s decision line, that growth targets sat at the queen's ceiling, and that a room's worth from its neighbours echoed the reference game's tile adjacency. All were fixed in 02 section 3.2, section 4 and section 8: a 3-cell door with separate lanes, Recall to the nearest cover, defined idle and queued shares, pile sizes and starting stores, a starvation rule, a bird rule, a flood loss for the idle bot, beat skeletons for chapters 2 to 6, lower growth targets with a second laying rate, and worth from a room's own properties only. Remaining findings were minor.

## Rejected or not taken

| Proposal | Source | Why not |
| --- | --- | --- |
| Start with 480 adults | Blind C | Taken as "about 300". The number is a tuning value, set by the pace gates and the frame gate |
| Seven workers and one larva at the start | Builder | Too few to show the swarm, which was the one positive signal |
| Remove the nest layer from the first session | Red team | The nest is where brood, stores and flooding show. It stays as a cutaway that opens in place over the entrance, so the player never loses the surface |
| A fixed construction socket per site | Blind B | Taken as authored placement spots for the first chapter only; later chapters allow free placement on legal edges |
| Make 50,000 ants a fluid | Wildcards | A lab toy, not the rebuild. If it passes on a real phone it can become the far zoom level |
| Ride one ant (tandem recruitment) | Wildcards | Closest to SimAnt's yellow ant; most clean-room risk |
| A 22-minute Year as the session, with a 15-patch meadow campaign settled by nuptial flights and colony traits | Blind A | Kept as variant D of decision 1. Strong, but it puts the wedding flight and a meta-map on the first release path, which the red team cut for scope |
| Lockstep versus with the world's 5,000 ants split across players | Blind A | Versus is after the first release. Co-op on one colony comes first |
| Portal ads | Business | Against the calm family tone; never in the core build |

## Lab toys proposed alongside the rebuild

From the wildcards lens, ranked by what they test and how cheap they are. Each is a page under `experiments/lab/` with an owner pass line.

1. **Founding runs.** A 20-minute roguelite run from sealing in to the wedding flight, seasons as phases, bloom kept between runs. Tests whether a run beats a chapter campaign (decision 1).
2. **Fluid colony.** Far ants as a density field advected along the flow fields, near ants as individuals, on the Ember look. Tests scale as spectacle; 50,000 on a real phone is unmeasured.
3. **Ghost trails.** Past visitors' trails stay as fading shared scent on the daily hill. The cheapest shared feature.

## Decisions only the owner can make

These are taste or direction calls. Each has a recommendation; work proceeds on it until the owner says otherwise.

| # | Decision | Options | Recommended |
| --- | --- | --- | --- |
| 1 | Session structure | **A** Chapters on one hill (6 to 12 min each, the colony persists, Spring is the first release). **B** Founding runs (one 20-min run per queen, roguelite, bloom kept between runs). **C** A, with B as the daily mode. **D** One 20-to-24-min season cycle per session (grow, fight, store, a short winter tally), with flown queens settling a campaign map | A, while the Founding runs toy tests B. D is the most ambitious; it fits after the first release |
| 2 | How Field and Ember are used | **A** Each chapter runs from day (Field) into dusk and night (Ember). **B** Field for the campaign, Ember for free play and night chapters. **C** The player picks one in settings | A |
| 3 | Name and setting (todo `lab-5w7.1`) | Cinderhill (burned hill regrown), Floodline, Kerbside, Seedkeepers (02 round-1 table) | Cinderhill, which the owner's earlier reply seemed to accept |
| 4 | Tone | **A** Wordless: small scenes, words only on controls and goals. **B** Field notes: one-line natural-history notes on a "?" tap. **C** Colony ledger: route records and weather marks, no biology notes | A, with B available on "?" |
| 5 | Stakes | **A** A chapter can be lost (queen reached, or the brood drowned), retried from its checkpoint. **B** No loss; chapters only score. **C** Loss only on Hard | A |
| 6 | Starting colony size | **A** About 300 survivors come up from the deep chamber (the swarm at once). **B** 30 workers with staggered brood, 100 by minute 3 and thousands by minute 20 (design A). **C** A small founding (7 workers, one larva), the closest to the round-2 premise | A. This is a premise and taste call, not reviewer consensus: reviewers agreed the swarm must arrive within minutes, not on the number |

## Gaps

- Fun and real-phone feel remain unmeasured until the first chapter exists. Every pace number in 02 is a starting value to be tuned by play.
- No real phone has run the renderer; S3 numbers are emulated on a Mac.
- Portal terms and audience sizes in the business review are from search snippets and memory, and are marked so in that review.
- The full reviews are in [round3/](round3/). Owner names were replaced by "the owner"; nothing else was edited.
