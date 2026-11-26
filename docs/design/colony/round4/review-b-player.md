# Cinderhill spec review: four players

Read: docs/02-spec.md in full; 03-features.md and 04-roadmap.md in full; 05-tech.md lines 11 to 92 (saves, rewrite table, combat); 01 lines 85 to 100 (castes); 07 headings plus sections 1.9 and 2.5; evidence.md; code/sim/sim.js line 46 and code/sim/colony.js lines 8 to 46 for current numbers. I did not read the other reviewers' files. "Checked" means I read the cited text. "Assumed" marks a number the spec does not give.

Spec numbers used below (checked, 02 section 3.2): trail walk 3.5 cells/s; pick-up 0.5 s; porch 3 cells down; 300 adults (100 surface, 200 inside); egg 15 s, larva 25 s with 1 protein, pupa 20 s; laying 1 egg/s, 2/s with a worth-60 queen chamber; upkeep 1 sugar per 10 adults a minute; stores 60 sugar, 20 protein; nursery 80 cells; door 3 cells at 6 ants/s each, so 18/s each way. The code confirms the old values the spec replaces: `WALK = 24`, about 1.9 cells/s (sim.js line 46), and 11,400 ticks egg to adult (colony.js line 20).

A repeating forage cycle on a route of L cells is 2L/3.5 + 0.5 s pick-up + 0.9 s down + 0.9 s back up. For L = 10 that is 8.1 s; for L = 20, 13.7 s (4.4 loads a minute per ant).

## Findings, ranked

### Blocker 1. Rule (4) sends every free ant to forage, so chapter 1's piles empty in about 20 s

Checked: 02 section 6.2 rule (4), "free ants take auto jobs by need: ... forage the nearest open route"; 02 section 3.2 Crews row, "Auto jobs (rule 4) take only ants left after crews".

Read literally, a crew size is a floor. Every surface ant not on a crew forages the nearest drawn route anyway. With two crews of 20, the other 60 surface ants join: 100 ants / 8.1 s = 12.4 loads/s. The seed head and beetle (80 + 60 = 140 loads) are gone about 11 s after the first arrival, near 15 to 20 s. Section 4 places "seed head empties" at 40 to 50 s and the beetle at about 50 s. Two decision events collapse into the first 20 s, followed by a gap until the nectar stalk and the bird. Light, Steady and Surge stop mattering on the nearest route, which removes the lesson 03 feature 4 tests.

The other reading (free ants wait) leaves about 250 of 300 adults doing nothing. The idle line in 3.1 still passes, because idle counts only "while any crew or marked job has a gap" and a percentage crew is never short. So the literal spec gives either a broken script or a frozen swarm. Taste call 1 gives the options.

### Major 1. The crew percentage is circular

Checked: 02 section 3.2: the pool is "adults not on a crew, not nursing, not digging"; crews are "recomputed only when the pool changes by 10%".

Creating a crew removes its ants from the pool by more than 10%, which triggers a recompute. The fixed point of c = f(P - c) is c = fP/(1 + f): Steady settles at 20% of P, Surge at 33%. Two Surge crews settle at 25% each. The spec's own "Steady crew of 20" from 100 surface ants is the 20% fixed point, not 25%. Fix: size crews as a share of all adults not nursing or digging, crew members included.

### Major 2. Two scripted chapter 1 beats depend on unstated rules or cannot happen

**Nursery full at 3:00** (02 section 4). Checked arithmetic. At 1 egg/s and 60 s egg to adult, steady brood is 15 + 25 + 20 = 60 cells. Start brood is 52. Occupancy peaks near 72 at about 25 s (52 + 25 laid - about 5 born) and settles at 60. With full protein the 80-cell nursery never fills. It fills only if an unfed larva holds its cell while it waits; my minute table below has births protein-limited at 40 to 55 a minute against 60 eggs, which would fill the 20 spare cells by about 2:30 to 3:00. So the beat works only through a rule the spec does not state: 3.2 says larvae without protein die after 60 s but not whether the 25 s larva clock pauses while unfed. State it, since the beat depends on it.

**Door jam at 3 to 5 min** (3.2 Doors row: "the third pile's long route runs on Surge with 400 or more ants"). Checked arithmetic. The colony cannot field 400 ants on one route then. At 3 min the minute table gives about 425 adults, 225 on the surface after the 200 inside; Surge is 112 at a true 50% or 75 at the fixed point. A route jams a 3-cell door when N/T reaches 18 ants/s. For 112 ants that needs a cycle of 6.2 s or less, shorter than the 8.1 s of a 10-cell route, so no route length jams it. (400 ants would jam any route of about 35 cells or less, assumed geometry, but 400 are not available.) This beat teaches the second door, a chapter 1 verb (8.1), and it feeds the 30 s gap line. Fix: start with a 1-cell door (6 ants/s), or script a cave-in that narrows it.

### Major 3. Sugar goes flat; the economy is set by pile sizes, not labour

Checked: 3.2 Adults eat and Queen laying rows. One ant on a 20-cell route brings 4.4 loads a minute and eats 0.1: its work feeds 44 ants. Eggs are free, and laying needs only sugar "above 0". Sugar above upkeep buys nothing until the chapter 3 bill. The row "food matters from minute 1" is true only for the idle bot. See both minute tables below.

### Major 4. The queen-chamber upgrade buys nothing on the target curve

Checked: 3.2 "Ants at chapter ends": about 450 after chapter 1 and 900 after chapter 3. Chapter 3 then needs about 28 births a minute (table below). The laying cap is 60 a minute before the chamber and 120 after. Births are set by protein delivered. A player who digs a worth-60 chamber gains no ants unless protein exceeds 1 load/s, which the target curve rules out. Either the curve is wrong or the chamber needs another effect (brood safety, faster larvae).

### Major 5. The now-or-later bill has no number

Checked: 6.1, "needs stored seeds or sugar per ant ... Short of the bill, the weakest ants die". No rate per ant and no deaths per missing load are in section 3, "the one table of numbers". 04's first risk row names the bill as the answer to "a toy with no depth", and the R2a depth check would test the builder's guess. Proposal to tune from: 0.5 load per adult; 1 adult dies per 2 loads short. At 900 adults that is 450 loads, about 5 minutes of upkeep, enough to make store-or-grow real.

### Major 6. The bird's cost cannot be felt

Checked: 3.2 Bird row ("at most 5 ants"); section 4 rows 45 to 75 s; section 4 closing line. Births run near 50 a minute by minute 2 (table). Five ants are replaced in about 6 s; two passes cost at most 10 of about 450, 2%. "Starts chapter 2 smaller" is not visible. Taste call 2.

### Major 7. The idle bot's chapter 2 loss is undefined

Checked: 8.2 (lose if the brood all drowns or under 50 ants; floor 150 ants and 30 sugar); 3.2 Starvation and Rain rows. Assumed start: 300 ants, 30 sugar. Upkeep 30 a minute empties sugar at 1:00 and laying stops. The last eggs hatch at 1:15 and those larvae, unfed, die at 2:15, 15 s before the first pulse at 2:30. Whether "the brood all drowns" fires with no brood left is not stated. Starvation is slow: 1% every 10 s is 6% a minute, so 300 to 50 takes ln(50/300)/ln(0.94) = 29 min. Also unstated: whether ants with no trail forage on their own (3.2 "Walk off a trail: scouting and wandering"). The CI line "Idle bot loses chapter 2 or 3" can pass or fail by accident. Fix: lose when the colony has no brood and no eggs for 60 s, or name the spider reaching the queen in chapter 3 as the idle bot's loss.

### Major 8. No save or pause when the tab is hidden

Checked: 05 line 14 (saves): checkpoint every 20 s and at chapter start, previous good checkpoint kept, Web Locks. Nothing about saving on `visibilitychange` or `pagehide`, or pausing a hidden solo game. A 2-minute bus session can lose 20 s, 17% of it, and resume into a telegraph already running. Proposal: write a checkpoint on hide and on `pagehide`; pause solo play while hidden.

### Major 9. Nothing in Spring measures how well you played

Checked: chapter card shows "stores, ants, sprouts, losses" (03 feature 11); the median bot, a fixed 15-second script, must finish every chapter (04, "How we know it works"); Hard is "fewer floor stores, faster raids" (8.2). Only the daily hill scores. Taste call 5.

### Minor

- 3.2 "Steady crew of 20 brings about 2.8 loads a second" uses the 7.2 s first-delivery time, not the 8.1 s repeating cycle: 20/8.1 = 2.5. With an equal crew drawn 3 s later, the beetle empties near 0:33, not 0:50. Checked.
- "Brood short of protein", a decision event (3.1), fires near 5 s: 20 stored protein feeds the 20 start larvae, and the 20 start eggs hatch from 5 s with no protein until the first beetle load at about 16 s. Section 4 places it at 70 to 90 s. Checked.
- Room worth: 02 section 1 says "depth, size, dryness and distance"; 6.5 says "depth, dryness and size only". Checked.
- Combat has no numbers: contact slots, hit points and damage (6.4; 05 line 84 gives only the structure). Majors are given only as multiples (3.2). R2a will guess. Checked absence.
- Source sizes for the nectar stalk, the cricket, the carcass and every chapter 2 to 6 pile are not given, so the 450 and 900 targets cannot be derived. Checked absence.

## Four players

### 1. The colony and RTS veteran

Hour one has real hooks: Lanchester fights (square law in the open, one on one in tunnels, 6.4), shared scent and decoys (6.4), and doors with visible throughput (6.2). The reference game's numbered groups (01 section on control) have nothing like shared scent.

Hour three thins. Spring is 45 to 60 minutes (8.3); after it come a goal-less free hill and a 5-minute daily. There are two castes (3.2, 6.3) against two to five per colony in the reference game (01 lines 87 to 100). Majors 3 and 4 mean a bigger or better-run colony does not earn more: about 25 ants carry chapter 3's whole economy (table below), so growth matters only in fights. 07 holds depth the spec cut to Later (age polyethism 2.6, response thresholds 2.5, harvester granaries 1.9). The R2a depth check (04) asks whether the owner changes a plan "for a reason they can name". Proposal: also report the outcome gap between the two plans, in ants and stores, so depth is measured, not felt.

### 2. The two-minute phone player on a bus

Good: first order, delivery and birth inside 15 s (3.1); telegraphs are visual first (6.4), so muted sound works; tactical pause (6.2).

Problems. The shortest unit is a 4 to 6 minute chapter or the 5-minute daily (8.3); nothing ends in 2. Major 8 covers resume. The default camera needs two fingers (6.7); one-finger camera is a setting, hard to use one-handed on a bus. Default zoom and how much of the 256 by 256 map a portrait phone shows are not stated, so whether the bird's shadow and the third pile are on screen is unknown. Proposal: one-finger pan on touch when no tool is armed; on resume, a 2-second recap of the last telegraph.

### 3. A parent with a ten-year-old

Good: wordless scenes (5); spider toggle (12); death shown, never gory, the dead carried to the midden where seeds sprout (5, 6.6); Gentle has no loss (8.2); tap an ant to see its load and goal (7); the bloom picture to share (6.6).

Problems. Playing together needs the shared colony, which is R3, after release (9). One portrait phone does not seat two; desktop is the better shared seat, and 6.7 gives only mouse buttons, no desktop layout. The chapter 3 bill kills ants on the chapter card (6.1), where a child cannot act; on Gentle it could shrink the next start instead. "Light, Steady, Surge" are adult words; icons with ant counts read better.

### 4. The economy designer, minute by minute

Median bot with Steady crews respected (Blocker 1 resolved toward caps).

**Chapter 1** (5 min). Assumed sizes: nectar stalk 80 sugar, cricket 30 protein, third pile 150 sugar and 150 protein from 2:00, carcass 40 protein at 3:30.

| Min | Adults at start | Sugar in | Upkeep | Sugar store at end | Protein in | Larvae needing protein | Births | Losses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 | 300 | 80 | 30 | 110 | 20 + 60 | about 85; short near 55 s | about 45 (start brood) | 0 |
| 1-2 | 345 | 80 | 35 | 155 | 30 | 60 | about 40 | bird ≤ 5 |
| 2-3 | 380 | 75 | 38 | 192 | 75 | 60 | about 50 | bird ≤ 5 |
| 3-4 | 425 | 75 | 42 | 225 | 75 + 40 | 60 | about 55 | 0 |
| 4-5 | 480 | 0 (pile empty) | 48 | 177 | 0 | 60 | about 55 | 0 |

Ends near 530 adults against a target of 450 and a ceiling of 590 (3.2). Sugar never binds; the store only grows until the map runs out. Protein binds in minutes 1 to 2 and again at 4 to 5. Breaks: the outcome rests entirely on pile sizes the spec does not give.

**Chapter 3** (assumed 9 min, start 650 adults and 100 sugar, queen chamber dug at 3:00, target 900 at the end, bill B due at dusk). Births on target: (900 - 650)/9 = 28 a minute. Spider losses assumed 10 a minute in minutes 1 to 3 and 6 to 7, when it walks the busiest trail. A Steady sugar crew is 20% of a pool of about 450, 90 ants, which can carry 90 × 4.4 = 396 loads a minute on a 20-cell route.

| Min | Adults | Upkeep | Sugar crew capacity | Sugar needed (upkeep + B/9) | Laying cap | Births | Protein needed | Losses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 650 | 65 | 396 | 65 + B/9 | 60 | 28 | 28 | 0 |
| 1 | 678 | 68 | 400 | 68 + B/9 | 60 | 28 | 28 | 10 |
| 2 | 696 | 70 | 400 | 70 + B/9 | 60 | 28 | 28 | 10 |
| 3 | 714 | 71 | 410 | 71 + B/9 | 120 | 28 | 28 | 10 |
| 4 | 732 | 73 | 420 | 73 + B/9 | 120 | 28 | 28 + 3 per major | 0 |
| 5 | 760 | 76 | 430 | 76 + B/9 | 120 | 28 | same | 0 |
| 6 | 788 | 79 | 440 | 79 + B/9 | 120 | 28 | same | 10 |
| 7 | 806 | 81 | 450 | 81 + B/9 | 120 | 28 | same | 10 |
| 8 | 824 | 82 | 460 | 82 + B/9 | 120 | 28 | same | 0 |

Ends near 850 after 50 spider losses, close to the 900 target. Where it goes flat: one Steady crew moves five times the upkeep, so intake is capped by pile size, not by ants, and a 300-load pile lasts 45 s. Laying runs at a quarter to a half of capacity. About 25 ants of 650 to 900 carry the economy; the rest matter only in fights. Where it breaks: B has no value, and chapter 3 source sizes are absent. Unless piles are thousands of loads, the 30 s decision-event line will be met by piles emptying, which 3.1 forbids ("not padded with small piles"). A fix that keeps the pace: sources that regrow at a rate (6.6 already says nectar plants regrow), so more ants help only through more routes, and route count becomes the economic choice under traffic and threat.

## Taste calls for the owner

1. **What free ants do.** (a) Auto-forage the nearest route, as written: busy, but crew size stops mattering. (b) Forage only on crews; spare ants wait at the door as a visible "free" count. (c) Outflow set by return rate, as harvester ants do (07 section 1.9): crews are targets and fast returns pull more ants out. Recommend (b) for R1, (c) as a lab toy.
2. **What the bird costs.** (a) Up to 5 ants, as written. (b) Up to 5 ants plus dropped loads and a 10 s scatter of the struck route, so its loads a minute dips. (c) About 3% of the ants outside, so it scales. Recommend (b).
3. **Free hill timing.** (a) R2c, as written. (b) Unlisted beside chapter 1 at R1. The owner's longest session was a 17-minute sandbox with 81 orders (evidence.md). Recommend (b).
4. **How chapters end on a bad bill.** (a) Ants die at the card, as written. (b) Ants die at the card on Standard and Hard; on Gentle the next chapter starts smaller. (c) The bill comes due during dusk, so the player sees and can answer it. Recommend (c).
5. **What keeps a veteran after Spring.** (a) Hard and the daily score only. (b) A chapter score (ants, bloom, losses) with a best-run replay. (c) A skirmish against the chapter 5 rival AI on the free hill. Recommend (b) at release, (c) next.
