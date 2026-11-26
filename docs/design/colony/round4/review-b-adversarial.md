# Cinderhill round-3 spec: adversarial pre-mortem

Reviewer lens: it is November 2027. Spring shipped exactly as `docs/02-spec.md` says. Outside players left inside ten minutes and did not recommend it. Why?

Files read (all checked unless marked): `docs/02-spec.md` (all), `docs/01-reference-research.md` (all), `docs/03-features.md` (all), `docs/04-roadmap.md` (all), `docs/05-tech.md` (sections 1 to "Layout"), `docs/07-biology-ideas.md` (headings, 1.7, 1.8, 1.9, 1.14 to 1.16, section 5), `evidence.md` (all), `code/sim/sim.js` and `code/sim/colony.js` and `code/sim/flow.js` (constants only). Files the spec links but that are not in the folder (11-round3-findings.md, round3/, 09, 10) were not read; claims about them are assumed.

Code numbers confirmed: `WALK = 24` units a tick in `code/sim/sim.js` line 46, so 24 x 20 / 256 = 1.875 cells/s (spec says 1.9). 3.5 cells/s = 3.5 x 256 / 20 = 44.8, so 45 units a tick (spec 3.2 matches). Egg to adult = 3000 + 3 x 1200 + 4800 = 11,400 ticks = 570 s (`colony.js` lines 20 and 45; spec matches). `LOAD = [4, 2]` (`colony.js` line 40), `MAX_GOALS = 16` and `INF = 0xFFFF` (`flow.js` lines 16 and 21) match 05.

## Findings, ranked

| # | Rank | Finding | Where | Status |
| --- | --- | --- | --- | --- |
| F1 | Blocker | The chapter 1 door jam cannot happen with the spec's own numbers | 02 s4 row "3 to 5 min", s3.2 "Doors", "Crews", "Colony at start" | Checked arithmetic |
| F2 | Blocker | Chapter 1 choices have almost no numeric consequence; the colony is too large and refills too fast for a loss to be felt | 02 s3.2 "Bird", "Queen laying", s4 "45 to 75 s", line 150 | Checked arithmetic |
| F3 | Major | No outside player is asked "would you recommend it" until R2c, after six chapters are built | 04 R1 gate; 02 s0 | Checked |
| F4 | Major | The R1 onboarding gate is vacuous: chapter 1 cannot be lost, so "finish chapter 1 without help" passes by waiting | 02 s0 row 2, s3.1 "Passive bot", line 150; 04 R1 | Checked |
| F5 | Major | Chapter 1 teaches about ten concepts in five wordless minutes; it also teaches Dig, which 8.1 assigns to chapter 2 | 02 s4, s5 line 154, s8.1 rows 1 and 2 | Checked |
| F6 | Major | Starvation cannot make the idle bot lose within a chapter; the 3.2 "why" is false | 02 s3.2 "Starvation", s3.1 "Idle bot" | Checked arithmetic |
| F7 | Major | Protein shortage produces a steady larval death of up to 1 a second, which the loss counter would show non-stop | 02 s3.2 "Queen laying", "Starvation", s7 bullet 4 | Checked arithmetic, assumed counter behaviour |
| F8 | Major | 07 ranks the reference game's own species gimmicks as top "original" ideas; 03 "Later" keeps some of them | 07 s5 rows 2 and 13, s1.7, 1.8, 1.14, 1.15; 03 "Later"; 01 s3 table | Checked |
| F9 | Minor | Beat timings are off: the beetle empties near 0:36, not 0:50, so two "source empty" events and the bird bunch into 15 s | 02 s3.2 "First food", s4 | Checked arithmetic |
| F10 | Minor | "Room full at 3:00" happens only if protein is short; with good play the nursery never fills | 02 s4 row "3:00", s3.2 "Colony at start", "Brood" | Checked arithmetic |
| F11 | Minor | The "deliveries in minute 1 at least 25" gate is about ten times looser than the design rate | 02 s3.1 | Checked arithmetic |
| F12 | Minor | Room worth: s1 says depth, size, dryness and distance; s6.5 says depth, dryness and size only | 02 s1 line 47, s6.5 | Checked |
| F13 | Minor | Steady is 25% of "foraging pool" in 3.2 but "free workers, capped by route width" in 6.2; the second Steady order gets fewer ants than the first | 02 s3.2 "Crews", s6.2 | Checked |

## Part 1. Post-mortem: the five most likely causes

### Cause 1. Nothing the player did mattered (F2, F6)

**What players said, in this imagined post-mortem:** "I let the bird eat my ants to see what happens. Nothing happened."

**Spec line.** 02 s3.2 "Bird": "One pass costs at most 5 ants: a lesson, not a wipe." Same table, "Colony at start": 300 adults. "Queen laying": 1 egg a second.

**Arithmetic.** At the first bird pass (30 to 75 s), the colony has 300 adults plus births. Five ants are 5 / 300 = 1.7% of it. The queen lays 1 egg a second, so the loss is replaced in 5 s of laying (60 s later, after brood time). The section 4 "consequence of the first choice, inside a minute" is a loss counter showing "-5" next to a swarm of 300. Line 150 says a colony that ignored the bird "starts chapter 2 smaller". Two passes in chapter 1 (s4 rows "30 to 60 s" and "2:30") cost at most 10 ants against about 450 at chapter end (s3.2 "Ants at chapter ends"): 10 / 450 = 2.2%.

Starvation does not bite either (F6). s3.2: after 60 s at 0 sugar, one adult in a hundred dies every 10 s. From 300 to the 50-ant loss line (s8.2) needs 0.99^n = 50/300, so n = ln(1/6) / ln(0.99) = 178 steps of 10 s = 1,780 s, about 30 minutes. Chapters run 6 to 12 minutes (s3.1). So the 3.2 note "Gives the idle bot a way to lose" is false; only flooding (s8.2) can do it.

**Why players leave.** The spec's own gate, "First real choice ≤ 30 s; its consequence visible ≤ 60 s" (s3.1), is met by a counter, not by a felt difference. A player who tests a choice and sees no change concludes the choices are decoration.

**Prevention.** Make threat cost scale with what is exposed, not with a flat cap: for example the bird takes a share of the ants in the open on the struck route (say 20% of that crew, which is 5 of 25 on a Steady crew but 50 of 250 on Surge), or it takes loads in transit, which the player watches arrive. Add one gate to s3.1: the median bot ends chapter 1 at least 10% larger in ants or stores than a bot that ignores every threat. Fix the starvation rate so a fully idle colony falls under 50 inside one chapter, or delete the claim.

### Cause 2. The script promised beats the simulation could not make, so the builder faked them (F1, F9, F10)

**Spec line.** 02 s4 row "3 to 5 min": "With the third route on Surge, the door jams." s3.2 "Doors": "The jam comes when the third pile's long route runs on Surge with 400 or more ants, about 3 to 5 min in."

**Arithmetic.** Door capacity is 3 cells x 6 ants/s = 18 a second each way (s3.2). Surge is 50% of the foraging pool (s3.2 "Crews"). At 3 to 5 min the colony has at most about 470 to 590 adults (300 + 52 starting brood + eggs laid more than 60 s earlier at 1/s; spec's own ceiling is 590). 200 start inside on nursing, digging and stores (s3.2 "Colony at start"). So the pool is at most about 250 to 390, minus ants already on the two earlier crews; Surge is therefore about 100 to 190 ants, not 400. A crew of N on a route with round trip T passes the door at N / T each way. For the long route, say 25 cells out: T = 50 / 3.5 + 0.5 + 2 x 3 / 3.5 = 14.3 + 0.5 + 1.7 = 16.5 s. Then 150 / 16.5 = 9 a second, half the door's 18. Even 400 ants on it would give 400 / 16.5 = 24 a second, which would jam, but the colony does not have 400 spare ants in chapter 1. The jam is the chapter's Dig beat and the teaching moment for the second door. It cannot arise from the numbers.

Two more beats are off. The beetle (60 loads) with a Steady crew at about 2.5 loads a second (round trip 2 x 10 / 3.5 + 0.5 + 2 x 3 / 3.5 = 7.9 s; 20 / 7.9 = 2.5; the spec uses one-way 7.2 s and gets 2.8) empties 60 / 2.5 = 24 s after its first delivery, near 0:36, not 0:50 (F9). The seed head (80 loads) empties near 0:42. So the husk prompt (15 to 30 s), both "source empty" events, the nectar stalk and the bird shadow (30 to 60 s) arrive within about 15 s, then the next beat is the cricket at 70 to 90 s. That is a 30 s gap right after a pile-up. "Room full at 3:00" (F10): at 1 egg a second, brood in the pipe at steady state is 15 + 25 + 20 = 60, under the 80-cell nursery. The room fills only if larvae wait for protein, that is, only for a player who is doing badly.

**Why players leave.** The spec tells the builder (s0 "For the builder"): "When a rule here is missing, take the simplest rule that keeps the pace budget." A literal builder whose bots must pass "longest gap ≤ 30 s" (s3.1) will add a scripted jam trigger or shrink the door. The game then feels staged: a jam appears when you have 120 ants outside, a full room appears on a clock. Players notice staged events within minutes.

**Prevention.** Before building, run the s3.2 values through a spreadsheet or the bots and print a predicted beat timeline next to the s4 table, with the arithmetic. Then fix one side: a 1-cell starting door at 6 a second, or a lane rate of 2 a second per cell, or move the jam to a chapter whose colony is large enough. Make the beetle 100 loads or the crew Light if 0:50 is wanted.

### Cause 3. "Too basic" was never answered at the point outsiders judge it (F3, F4)

**Evidence.** The owner said "too slow and still too basic" (`evidence.md` line 3). The spec's status line (02 line 3) and every gate in s3.1 address "slow". "Basic" is deferred: the Depth check comes after R2a (04 milestone table), and the recommend question is read only at R2c (04 "R2c Release": "The release gates in 02 section 0 measured on outside players").

**Spec line.** 04 R1 gate: "Five fresh phone players: 4 of 5 finish chapter 1 without help, and 4 of 5 place the husk on purpose." No recommend question, no "started chapter 2" rate. And chapter 1 "cannot be lost by doing nothing (the passive bot finishes it)" (02 line 150), so "finish chapter 1" measures patience (F4).

**Why players leave.** Chapter 1's loop is: draw a line from the entrance to a pile, the pile empties, draw another line. Every trail starts at the one entrance (s6.7 Trail: "draw from the entrance or an existing trail"), so there is no network to design until the third pile at 2:00. A player who has seen Mini Metro or any idle ant toy files it as "basic" by minute 3, and the project first learns this after R2b, with six chapters built.

**Prevention.** At R1, read three numbers from the five fresh players: started chapter 2 (target from s0, 60%), "would you recommend it" on the chapter 1 card (the card exists at R1, 03 feature 11), and whether each player made one order that the script did not prompt. Replace "finish chapter 1 without help" with "finish chapter 1 having used Recall or cover inside a telegraph window, unprompted".

### Cause 4. Chapter 1 asked a new player to learn ten things with no words (F5)

**Spec line.** 02 s4 introduces, in about 5 minutes: trail, crew size (route card at 2:00), the cutaway, husk build, Recall, cover, sources running out, planting on the midden, route choice, dig nursery cells, door jam, second door. s5 line 154: "Words appear only on controls, goals and the chapter card." s8.1 row 2 lists Dig as chapter 2's new verb, yet s4 rows "3:00" and "3 to 5 min" teach Dig in chapter 1.

**Arithmetic.** Ten new concepts in 300 s is one every 30 s, which is the decision-gap gate (s3.1) used as a teaching rate. The reference game's recent negative reviewers "could not work out food gathering" with a tutorial and narrator (01 s4 "Onboarding").

**Why players leave.** On a portrait phone, a ghost finger can teach "draw here". It cannot teach "the route card's Surge spends half your free workers" or "this green tuft is shade". Players who do not understand a choice do not experience it as a choice.

**Prevention.** Cut chapter 1 to trail, births, husk and cover, bird and Recall, sources running out. Move planting, crews and dig plus door to chapter 2 (where 8.1 already puts Dig). Allow one short label per beat if decision 4 permits, worded as a control hint, not a field-guide voice.

### Cause 5. The spec bet on scripted chapters; the only long session in the evidence was a goal-free swarm

**Evidence.** `evidence.md` line 10: sandbox, 5,000 ants, no goal, 1,035 s, 81 orders, 2,122 deliveries, "left by choice". That is an order every 1,035 / 81 = 12.8 s with no prompt. The seven colony sessions ran 1 s to 427 s, median about 75 s.

**Spec line.** 02 s8.3 puts Spring first and Free hill as a side mode ("The owner's longest session was free play" is noted, then not acted on). s3.2 caps chapter populations at 1,500 to 2,000. The frame gate (s0) is 2,000 ants.

**Why players leave.** If the draw is the swarm itself, chapter 1 at 300 to 450 ants, framed by a timed script, removes the thing that held the one real player for 17 minutes. If the draw is goals, the evidence for that is a sample of one owner, and outside players were never asked.

**Prevention.** At R1, give outside players the chapter and a free hill on the same menu and record which they open and how long they stay. The "founding runs" toy (03 lab toys; 04 "answers decision 1 before R2b") should run at R1, not before R2b.

## Part 2. Attack on the clean-room line

The rule (02 s1): take the genre, not the game. I compared every 02 mechanic against 01 sections 1 to 6.

**02 itself is clean.** I found no item in 02 that copies the reference game's own expression. Its s1 table removes the narrator, the lab and scientists, the gene-stealing ant and jelly, hex adjacency, numbered pheromone groups, and the named boss class. The 07 and 01 overlaps below are mechanics, which are ideas, not expression; but the project rule is stricter than copyright, and 01 line 5 says the species roster does not go in.

Items that sit closest, in order of risk:

1. **07 ranks the reference's own species gimmicks as "original" (F8, major).** 07 s5 row 2, "Matabele rescue and wound treatment", scores originality 5 of 5. 01 s3 table row "Matabele": "medic (carries wounded home to revive at reduced stats)", the reference's tier 5 headline mechanic. Also: 07 s1.7 exploding ants as self-destruct workers that slow (01 s3: exploding ant DLC, "Minor soldiers self-destruct (damage + slow)"); 07 s1.8 bullet ants as paralysis (01 s3: "Bullet ant soldier (paralysing sting, execute)"); 07 s1.15 and s2.8 fire-ant rafts and living bridges (01 s3: fire ant "can link into floating bridges over water"). 03 "Later" keeps "more playable species (44)" and "living bridges (45)" and the "Bridge crew" toy. 03 does say "Rescue of wounded ants stays out (old 47)", which is right. A literal builder told to be ambitious and pointed at 07 by 02 line 5 ("Read with") will reach for the top-ranked ideas. Fix: annotate 07 s5 rows 2, 13 and runners-up "exploding glue workers" as "in the reference game's roster: not taken", and drop the originality scores for them.
2. **Spider toggle (02 s12 "spiders drawn as beetles").** The reference added an arachnophobia mode in 2024 (01 s3 "Enemies" last line). This is a shared accessibility convention in many games (other examples from memory, not checked). Keep it; it is genre.
3. **Natural-history one-liners (02 s1 line 53).** The spec already flags this as an echo of the documentary identity and leaves it to the owner. Agreed.
4. **Porch store near the entrance (02 s3.2).** The reference's guides advise food storage near the exit (01 s2 "Nest building", s6). This is a walking-time consequence any colony game reaches; genre.
5. **Persistent colony plus a ladder of one-new-threat chapters** mirrors the reference's persistent formicarium with scripted experiments (01 s1, s5). Structure only; SimAnt and Pikmin precedents (05 "Prior art") cover it.
6. **Majors from well-fed larvae** (02 s6.3). Biology; the reference has majors per species (01 s3), but the mechanism (feeding sets caste) is different from per-caste nursery tiles (01 s2). Clean.

01 s10 is stale (30 s saves, days, bands, tournaments). 02 line 7 already says it is not spec. A literal builder could still quote 01 s10 "Bigger swarm wins: ... tournaments"; tournaments are cut (02 s10). Consider striking s10 or marking it "round 2, superseded" in its heading.

## Part 3. The single assumption that sinks the project

**The assumption:** that pace was the missing ingredient, so a decision event every 30 s (02 s3.1 "Longest gap") makes the game engaging.

Every gate in s3.1 measures how often something happens. None measures whether a choice changed an outcome (F2). The only weight test, the Depth check, sits after R2a (04). The only outside-player fun test, "would you recommend it", sits at R2c (04). The evidence behind the bet is one player's seven short sessions plus one long goal-free session (`evidence.md`), and that long session points at the swarm, not at prompts.

If the assumption is false, R0 and R1 pass every CI gate, five players finish chapter 1 by waiting, and the project builds chapters 2 to 6 before learning that frequent weightless events are not a game. Cheapest test: at R1, add a gate that the median bot's chapter-end state beats the passive bot's by a stated margin, and ask the five players the recommend question and whether they want chapter 2.

## Part 4. Taste calls only the owner can make

1. **Starting colony size** (02 s3.2, decision 6). Options: (A) 300, as now: instant swarm, but losses are invisible. (B) about 100, with 2 eggs a second: births and losses both show, growth to about 450 is a visible tripling. (C) a founding start of 20 with very fast brood: strongest growth story, slow first minute. Recommendation: B. I am not certain; it depends on whether the owner values spectacle at 0 s over felt growth.
2. **What a threat takes** (02 s3.2 "Bird"). Options: (A) a flat cap of 5 ants. (B) a share of the exposed crew, so Surge in the open is punished. (C) loads in transit, so the cost shows in the store counter. Recommendation: B, since it makes crew size and cover one decision.
3. **Words in chapter 1** (02 s5, decision 4). Options: (A) wordless. (B) one short control hint per beat, no narrator voice. (C) natural-history one-liners. Recommendation: B. C carries the clean-room echo 02 s1 line 53 names.
4. **Chapter 1 scope** (02 s4). Options: (A) all ten concepts, as written. (B) five concepts (trail, births, husk and cover, bird and Recall, sources run out), with crews, planting, dig and the door moved to chapter 2. Recommendation: B.
5. **What the first menu leads with** (02 s8.3). Options: (A) Spring first, free hill beside it. (B) a short free hill first, Spring unlocked from it. (C) both on the first screen, measured at R1. Recommendation: C, because the evidence (one long sandbox session) and the spec's bet disagree, and only outside players can settle it.
