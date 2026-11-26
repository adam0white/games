# Cold review: Cinderhill spec, round 3 (2026-11-26)

Reviewer B, unbiased lens. Read-only. Files read in full: `docs/02-spec.md`, `docs/03-features.md`, `docs/04-roadmap.md`, `docs/05-tech.md`, `evidence.md`. Read in part: `docs/01-reference-research.md` (sections 0 to 10), `docs/07-biology-ideas.md` (sections 5 and 6), `code/sim/sim.js`, `code/sim/colony.js`, `code/sim/world.js`, `code/sim/flow.js` constants, `code/sim/SPIKES.md` (S1, S2). "Checked" means I read the cited text and did the arithmetic. "Assumed" means I inferred it.

## Verdict

This is a strong spec with a weak middle. The diagnosis is right: `evidence.md` shows first food 73 s after the trail, no births and no threat in seven sessions, and the spec answers each with a number and a gate (02 section 3.1, checked). Chapter 1 is scripted second by second (02 section 4), the gates include a known-bad fixture that must fail (02 section 3.1, last row), and outside players come at R1 (04, "What changed"). That is better practice than most game specs.

The weak middle is that several chapter 1 beats are not produced by the numbers in section 3.2. The door jam cannot happen at the stated crew sizes. The 3:00 "nursery full" beat only happens if protein is short. The bird, the first real choice, costs at most 5 ants out of 300 or more. The crew formula is circular, and auto foraging may make crew sizes moot. A builder who follows the spec literally will build a chapter 1 that passes some gates and then fails the decision-gap gate because the late beats never fire. These are fixable with numbers, not redesign.

Would a stranger play 20 minutes? Probably, if chapter 2 (rain) is as good as its one-line skeleton promises (assumed; 02 section 8.1 gives it one line). 20 minutes is chapters 1 to 3 at the stated lengths: 4 to 6 + 6 to 12 + 6 to 12 = 16 to 30 min (02 section 3.1, checked). Would they come back? Less sure. The return hooks are the bloom map, the persistent colony and the daily hill (02 sections 6.6, 8.3). None is in R1. At R1 a stranger gets one 5-minute chapter whose only loss is a few ants. The owner's own longest session was a 17-minute goalless sandbox at 5,000 ants (`evidence.md`, checked). That suggests the pull is the swarm itself, and the spec keeps it in free hill (02 section 8.3). I would expect strangers to return for free hill and the daily hill sooner than for the campaign (assumed).

## What is strong

- **Numbers multiplied out.** First delivery: 10 cells at 3.5 cells/s is 2.86 s, plus 0.5 s pick-up, 2.86 s back and 3 cells down at 0.86 s, total 7.07 s against the stated 7.2 s and the 10 s gate (02 section 3.2 "First food", checked). Walk speed 45 units a tick × 20 ticks / 256 = 3.52 cells/s (checked). Brood today is 3,000 + 3 × 1,200 + 4,800 = 11,400 ticks = 570 s (`code/sim/colony.js` C, checked), now 60 s.
- **Upkeep is real from minute 1.** 300 adults eat 30 sugar loads a minute; 60 starting sugar lasts 2 min (02 section 3.2, checked).
- **Population ceiling is honest.** Chapter 1 at 1 egg/s for about 300 s, with 60 s egg to adult, gives about 240 births from new eggs plus 52 starting brood, so 300 + 240 + 52 = 592 against the stated "about 590" (checked).
- **A gate that must fail.** The old quota opening is a CI fixture that must fail (02 section 3.1; 04 R0 adds a planted brood ×10 slow-down). This is the right way to show a gate has teeth.
- **Clean-room line.** The table in 02 section 1 swaps each expressive element of the reference game (narrator, lab, jelly currency, hex adjacency, numbered groups, Titans) for something else, and round 3 removed the room-neighbour term because it echoed hex adjacency (02 section 6.5). I found nothing in 02 that copies the reference game's expression (checked against 01 sections 1 to 3).
- **Complaint answers.** Saves every 20 s with a command suffix (05 Saves), tactical pause (02 section 6.2), Recall (02 section 6.7), no kill-all goals and a 20 s unstick rule (02 section 6.4). These answer the top complaints in 01 section 7 (checked).
- **Tech is grounded in measurement.** 1.65 ms a tick at 2,000 ants in Node (SPIKES.md S1, checked); relay room 3.7 ms CPU a second (SPIKES.md S1, checked). Integer sim because WebKit and Chromium differ from Node on 5 to 37% of Math arguments (05, checked as stated, not re-run).
- **Scope discipline.** Cuts with reasons (02 section 10) and "Nothing else is judged until this passes" for R1 (03).

## Findings

### Blockers

**B1. The chapter 1 door jam cannot happen at the stated numbers.** (checked arithmetic)
02 section 3.2 Doors: 3 cells × 6 ants/s = 18 ants/s each way. A jam needs 10 or more ants queued for 5 s, so arrivals must exceed 18/s for several seconds. The stated trigger is "the third pile's long route runs on Surge with 400 or more ants, about 3 to 5 min in." The colony at that time is about 450 adults (02 section 3.2 "Ants at chapter ends"), with 200 inside on nursing and stores at the start. Surge is 50% of the foraging pool. Even if all 450 were in the pool, Surge is 225, not 400. A crew of N on a round trip of T seconds crosses the door N/T times a second. For a third pile at an assumed 30 cells: T = 2 × 30 / 3.5 + 0.5 + 2 × 0.86 = 19.4 s. Then 225 / 19.4 = 11.6/s, plus two Steady crews at about 5/s (02 section 3.2 says "under 6 a second") gives about 16.6/s. That is under 18. With realistic Surge sizes (see M1, about one third of the pool), it is near 10/s. So no jam, no "dig a second door" beat, and the 3 to 5 min stretch of chapter 1 loses its last decision event. 03 feature 5's test ("300 ants through one door jam") passes only on a mass Recall, not in play. Fix options: one-cell entrance at the start (6/s), lower per-cell rate to about 3/s, or move the jam to chapter 4, whose skeleton already has "jams on the long route; second door" (02 section 8.1).

**B2. The idle-bot gate likely fails as written.** (checked arithmetic, one assumption)
02 section 3.1: the idle bot "loses chapter 2 or 3". 02 section 8.2 says it loses chapter 2 because its brood drowns. Work it through. Chapter 2 floor: 150 ants, 30 sugar (02 section 8.2). 150 ants eat 15 loads a minute (02 section 3.2), so sugar is gone at 2:00. Eggs are laid only while sugar is above 0. The floor names no protein (assumed 0 for the idle bot). Larvae with no protein die after 60 s (02 section 3.2 Starvation). The last egg is laid at about 2:00, hatches at 2:15 and dies unfed at 3:15. The first rain pulse is at 2:30 for 30 s and floods "the lowest tunnel" (02 section 8.1, chapter 2 beats); the nursery is 10 to 16 cells down (02 section 3.2). The next pulse is 2 to 4 min later, at 4:30 or after, when all brood is already dead of hunger. So "the brood all drowns" fires only if the first pulse floods the nursery. If it does not, the rule is vacuous when brood is zero. The other loss paths are slow: falling from 150 to under 50 at 1% per 10 s takes ln(50/150) / ln(0.99) = 109 intervals = 18 min, plus 60 s grace, longer than a 6 to 12 min chapter. In chapter 3 the spider walks "the busiest trail" (02 section 6.4), and the idle bot has none. So a literal build can let the idle bot survive Spring, and the CI gate will flag it with no rule to fix. Decide: does "all brood dead" (any cause) count as a loss, or does the first pulse always reach the nursery?

### Major

**M1. The crew formula is circular and can make crew sizes moot.** (checked text)
02 section 3.2 Crews: Light, Steady, Surge are 10, 25 and 50% of "the foraging pool (adults not on a crew, not nursing, not digging)", recomputed when the pool changes by 10%. Assigning a crew removes ants from the pool. One Steady crew from a pool of 100 is 25, which shrinks the pool to 75, a 25% change, which triggers a recompute. If the builder solves for the fixed point c = 0.25 × (100 − c), Steady is 20 (this matches the "Steady crew of 20" in 3.2 "First food") and Surge is c = 0.5 × (P − c), so P/3, not P/2. Two Steady crews settle at 16.7 each. The spec never says which reading is meant. Worse, 02 section 6.2 rule 4 sends free ants to "forage the nearest open route". With one trail and 80 free ants, the free ants forage it too, so crew size does not change throughput. The seed head then empties near 80 / (100 / 7.9) = 6.3 s after the first wave arrives, not at 0:40, and the "source empty" decision event moves. Also "nursing" ants are excluded from the pool but nursing is an auto job taken by free ants (rule 4). Specify: the pool snapshot used for sizing, whether rule 4 foraging is allowed on routes that have crews, and how many ants nurse.

**M2. The first real choice has almost no consequence.** (checked)
Bird: at most 1 ant a second for 5 s, so 5 ants (02 section 3.2 Bird). Against 300 to 450 ants that is 1.1 to 1.7%, and it is replaced in 5 s of laying. The section 4 claim that "a colony that ignored the bird starts chapter 2 smaller" is true by about 1%. The owner called the last build "too basic" (`evidence.md`). A choice whose cost a player cannot feel teaches that choices do not matter (assumed). This is taste; see call 1.

**M3. The 3:00 "nursery full" beat depends on protein starvation.** (checked arithmetic)
Nursery: 80 cells (02 section 3.2). At 1 egg/s with 60 s egg to adult, a fed pipeline holds 60 brood, under 80. The nursery fills only if larvae wait unfed: waiting larvae can pile up for 60 s before they die, so the peak is about 15 eggs + 60 waiting larvae + pupae, which crosses 80. So the beat fires for a player who neglects protein and not for one who plays well. Either cut the nursery to about 50 cells or make the beat "nursery full or protein short".

**M4. Chapter 1 does not meet its own 30 s decision-gap line.** (checked)
Beats after 2:30 (02 section 4): 3:00 room full (M3), 3 to 5 min jam (B1) plus a carcass, 4 to 6 min dusk. If the jam lands at 5:00 or not at all, the gap from 3:00 is 60 to 120 s against "≤ 30 s" (02 section 3.1). Also "consequence visible ≤ 60 s": the bird strikes at 45 to 75 s, so if the line is absolute time it fails; if it is relative to the 15 to 30 s husk choice, it passes. Say which.

**M5. The decision-gap gate measures the script, not the player.** (checked text, judgment)
Decision events are placed by each chapter's script (02 section 3.1). A builder can satisfy the gate with timers. The evidence complaint was "long gaps with no order" by the player (`evidence.md`). The only human-side input line is "first order ≤ 10 s" (02 section 3.1). Add a people line read from lab records: median orders per minute, or the longest gap between player orders in minutes 0 to 10. That is the honest test of "too slow".

**M6. How chapter 1 ends is undefined.** (checked)
02 section 8.1 says "Dusk, about 5 min"; 02 section 3.1 says 4 to 6 min for the median bot and a human median of 8 min or less. If dusk is a clock, bot and human lengths are the same. If dusk waits for beats, the spec never lists which. A literal builder will pick a clock, and then the "human ≤ 8 min" line is meaningless. Same problem in chapter 2 ("the storm passes"): storm length is not given.

**M7. Recall has no end.** (checked)
02 section 6.7: "Every ant outside goes home at a run." The median bot answers every telegraph with Recall (02 section 3.1). Nothing says when ants go back out: a second tap, a timer or the end of the threat. Today's code keeps foragers in under Recall (`code/sim/sim.js` SIM_VERSION comment). A literal builder can ship a Recall that idles the colony until the player finds the release, which will also break the idle-labour gate.

**M8. The builder cannot read the owner decisions.** (checked)
02 cites `11-round3-findings.md` for decisions 1, 2, 4, 5 and 6, plus `round3/`, 06, 08, 09 and 10. None is in this folder (`ls docs`, checked). 02 states recommendations for decisions 2 and 5 and says "owner choice" for 300 ants (decision 6), so those are usable. Decision 4 (words and tone) is open and governs teaching (03 feature 12), help (03 feature 28) and the chapter card. Give the builder a short table: decided, recommended default, or blocked.

**M9. Full-Spring pace gate on every pull request is expensive.** (checked inputs, estimate assumed)
04 says the gate runs on every pull request on all chapters, three bots, 20 seeds. Spring is 45 to 60 min of play (02 section 8.3), so up to 72,000 ticks. At 1.7 ms a tick (SPIKES.md S1, 2,000 ants, before water, combat and a rival), that is about 122 s per bot per seed, × 60 = about 2 CPU-hours per pull request. At R1 (chapter 1, 6,000 ticks) it is about 6 min, which is fine. Plan now for the R2 scale: chapter-start fixtures per chapter, the full run nightly.

**M10. Chapters 2 to 6 are one line each.** (checked)
02 section 8.1 gives a beat list per chapter and says each script is written before it is built. That is the right rule, but the 20-minute question depends on chapters 2 and 3, and the depth check (04) comes after R2a is built. A stranger's return depends on content the spec has not designed yet. This is a planning risk, not a defect.

### Minor

- **m1. Seeds are two things.** 3.2 counts the seed head as "80 sugar loads"; 6.1 makes seeds a third stored resource cracked into sugar slowly; 6.6 says seeds are eaten for the tip and husks go to the midden. Husks per load is not given, yet the husk beat at 15 to 30 s depends on it (checked).
- **m2. Roof costs "6 leaves"** (02 section 3.2) but no leaf source exists on a burned hill in Spring (checked: none in 3.2, 4, 6.6).
- **m3. The beetle empties sooner than stated.** With the spec's own cycle, a 20-ant crew does 20 / 7.9 s = 2.5 loads/s, not 2.8 (2.8 used the 7.2 s one-way time as the cycle, omitting the climb back from the porch). 60 loads at 2.5/s after a start near 10 s gives about 34 s, not "near 0:50" (checked).
- **m4. Minute-1 delivery gate is loose.** By the spec's own rate, one crew alone makes 2.8 × 50 = 140 deliveries in minute 1 against "≥ 25" (checked). It will never bind; set it near 80.
- **m5. "Player-funded birth" needs provenance on fungible loads.** Loads go into one porch store (02 section 3.2). Tracking which protein load fed which larva is a new per-load tag. Also, does an unfed larva's 25 s stage clock pause? Not said (checked).
- **m6. 01 section 10 is stale.** It still says 30 s saves, days and bands, and cites 6.6 for the unstick rule that is now 6.4. 02's header says 01 is not spec, so this only matters to a careless reader (checked).
- **m7. Frame gate and the rival.** 2,000 ants at chapter 6 plus a rival colony can exceed the 2,000-ant frame gate (02 sections 0, 3.2). Say whether the gate counts all ants (checked text).
- **m8. Inside walking speed** is not given; on-trail and off-trail speeds are surface concepts (02 section 3.2). Nurses carrying protein 10 to 16 cells down need a rate (checked).

## Taste calls only the owner can make

1. **How much the bird costs.** (a) Keep at most 5 ants, a lesson. (b) Up to 20 to 25 ants, about 5% of the colony, still not a wipe. (c) It takes a carried husk or a load as well, so the loss shows on the store counter. **Recommend (b):** a loss the counter makes obvious, while the passive bot still finishes.
2. **Where the first traffic jam lives.** (a) Chapter 1, with a one-cell starting entrance. (b) Chapter 4, where "jams on the long route" already sits, and chapter 1 ends on the second bird plus the carcass. (c) Both, a small one in chapter 1 and the real one in chapter 4. **Recommend (b):** chapter 1 already teaches seven things.
3. **What ends a chapter.** (a) A fixed dusk clock. (b) Dusk after the last beat is resolved, with a time cap. (c) The player chooses when to call dusk after the goal is met. **Recommend (b).**
4. **Words (decision 4).** (a) Wordless, labels only on controls. (b) One-line natural-history notes on the chapter card. (c) Named ants with short lines. **Recommend (a) for R1,** with (b) tested as a lab toggle, since the clean-room note in 02 section 1 flags (b) as near the reference game's identity.
5. **What a stranger comes back for.** (a) The campaign alone. (b) The daily hill pulled into R1 as a second menu item. (c) Free hill at 2,000 ants in R1, since the owner's longest session was a sandbox. **Recommend (c):** it is mostly built already (`evidence.md`, 04 "Already done") and matches the strongest evidence of pull.
