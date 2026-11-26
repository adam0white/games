# Cinderhill: game spec

Status: rebuild spec, round 3, 2026-11-26. It replaces the round-2 spec. The M1 build (SIM_VERSION 6) taught us that the round-2 spec, built as written, makes a slow game: replays of the owner's sessions showed no birth, no threat and a first delivery 73 seconds after the first trail. [11-round3-findings.md](11-round3-findings.md) says what changed and why; the full reviews are in [round3/](round3/). Genre: ant colony real-time strategy and base builder, played in a phone or desktop browser, alone or with friends by link.

Read with: [01-reference-research.md](01-reference-research.md) (the reference game, reference only), [03-features.md](03-features.md), [04-roadmap.md](04-roadmap.md), [05-tech.md](05-tech.md), [07-biology-ideas.md](07-biology-ideas.md).

**For the builder.** Every pace and economy number is in section 3; a few rule-local numbers (telegraph times, crew presets) sit beside their rule. Other files cite this spec. [01](01-reference-research.md) is reference only: its complaint mapping was written for round 2 (days, 30 s saves, bands, tournaments) and is not spec. When this spec and an older file disagree, this spec wins. When a rule here is missing, take the simplest rule that keeps the pace budget, write it down in `experiments/cinderhill/NOTES.md`, and say so in the pull request.

## 0. What done means

The first release is **Spring**: six chapters on one hill, plus free play and a daily founding run. It is done when outside players finish chapter 1 without help, most of them go on, and they say they would recommend it.

| Gate | Target | How it is read |
| --- | --- | --- |
| Pace budget (section 3) | Every line passes for the scripted bots on 20 seeds, and for the median of outside players | `replay-lab.mjs` on every pull request (bots) and on lab records (people) |
| New players who finish chapter 1 without opening help | 4 of 5 at R1, then 80% | Lab records |
| New players who start chapter 2 | 60% | Lab records |
| Players who finish Spring | 30% of those who start chapter 2 | Lab records |
| Lost progress after a crash, reload or closed tab | at most 20 s of play, every time | Kill-the-tab test (05) |
| Frame rate on a mid-range phone (iPhone 13 class, Pixel 7 class) | 30 frames a second at 2,000 ants, on a real phone | Phone check plus one real phone |
| "Would you recommend it?" on the chapter card | a majority of yes from outside players | Lab records; players who leave earlier are counted apart |

Every rate is reported with its denominator. The owner accepts each milestone by playing it (04).

## 1. Clean-room line

The project rule (owner, 2026-11-24): for a specific published game, take the genre, not the game.

### Taken: genre conventions shared by many games

- A colony with one queen who lays every egg. Lose her and you lose the chapter.
- Workers forage, carry food home and dig the nest. Food pays for brood.
- Brood grows through egg, larva and pupa. Castes differ in size and job.
- An underground nest seen as a cutaway, and a surface world above it.
- Indirect control of a swarm with scent, not by moving each ant.
- Fights with other insects and rival colonies. Day and night. Weather.

SimAnt (1991) already had most of these: pheromone trails, a nest cutaway and a surface map, and rival colonies.

### Not taken: the reference game's own expression

| Reference game has | Cinderhill has instead |
| --- | --- |
| A wildlife documentary narrator | No narrator. Wordless scenes (owner chose wordless, 11 decision 4) |
| A lab colony tested by scientists, then separate missions as other real species | One wild colony on one burned hillside. No humans on screen |
| A fictional gene-stealing ant and a jelly meta-currency | Progress is the colony itself and the hill's regrowth ("bloom") |
| A hex-tile nest where tiles upgrade from same-type neighbours | Free digging in a soil grid. A room's worth comes from depth, size, dryness and distance |
| Numbered pheromone groups fed by assigned nurseries | Trails you draw, each with a crew you size (section 6.2) |
| A named class of giant bosses | Large animals that come because of what the colony did, with no shared class name |
| Defending aphids from ladybirds as an advertised decision | Not used. Ladybirds are dropped (round 3) |
| Its look, UI, music, names and levels | All ours |

The natural-history framing (one-line notes on real behaviour) is not used: the owner chose wordless play with a colony ledger (11 decision 4), and the red team found that a field-guide identity echoes the reference game.

## 2. Name, premise and shape

**Name.** Cinderhill is the working name (owner pick open, todo `lab-5w7.1`; variants in [09](09-round2-findings.md) and 11). A name and trademark check comes before any public listing.

**Premise.** A summer fire burned the hill black. Deep under it, one colony lived through the fire in its lowest chambers. You are that colony on the morning it comes up. Hundreds of ants pour out onto black ash. Feed them, dig, raise brood, and plant the seeds they carry, and the hill turns green behind you. Rain floods the low tunnels, a spider that smells like an ant walks your trails, and a neighbour colony reads every trail you draw.

**Shape.** The first release is **Spring**: six chapters of 4 to 12 minutes on one hill. The colony, the nest and the bloom carry from chapter to chapter. Each chapter runs from morning (Field look) into dusk and night (Ember look) and ends at a natural stop. Free play and a five-minute daily hill sit beside it on the menu. Summer, Autumn, Winter, the invading supercolony and friends' modes come after the first release (section 11).

## 3. Numbers: the pace budget and the starting values

This is the one table of numbers. Pace lines are gates, read from replays; everything else is a starting value, tuned by bots and play. No clock in this game is measured in days.

### 3.1 Pace budget (gates)

"Median bot" every 15 s draws a trail to the nearest visible food of the kind the colony is shortest of, erases its oldest trail when it has more than six, answers telegraphed threats with Recall, builds the chapter's offered structures, and leaves crews on Steady. "Passive bot" draws one trail and then gives no order. "Idle bot" gives no order.

| Line | Target | Read from |
| --- | --- | --- |
| Input ready after the page opens | ≤ 3 s on a mid-range phone | Page timing |
| First order (people) | ≤ 10 s for 80% of sessions | Lab record |
| First delivery from the player's first trail | ≤ 10 s after the stroke commits | replay-lab trail table, "first" |
| Deliveries in minute 1 (median bot) | ≥ 25 | replay-lab per-minute table |
| First birth | ≤ 15 s | replay-lab births (new field) |
| First player-funded birth (larva fed by a protein load the player routed) | ≤ 90 s (script: about 65 s) | replay-lab births |
| First real choice (two options with different costs, both visible) | ≤ 30 s | Chapter script; decision events (new field) |
| Its consequence visible | ≤ 60 s | Chapter script |
| First threat telegraphed | ≤ 60 s in chapter 1. Later chapters open with their own scripted beat (chapter 2's rain warning is at 2:00) | Decision events |
| First threat resolved (won, dodged or lost) | ≤ 3 min | Decision events |
| Longest gap between decision events, minutes 0 to 10 | ≤ 30 s | Decision events. A decision event is one that offers a choice: a new source seen, a source empty, a threat telegraphed, a room full, brood short of protein, a rain warning, a route jammed, a build offered, a sprout that opens a covered route. Each chapter's script (section 8.1) places them; a script that cannot meet this line is rewritten, not padded with small piles |
| Same gap, after minute 10 | ≤ 45 s | Decision events |
| Wasted labour: workers idle for more than 10 s while any crew or marked job has a gap | ≤ 15% at any sampled tick | replay-lab idle column. Idle = no load, no crew, no auto job and no goal for 10 s. Ants queued at a door are counted apart as "queued" |
| Queued at doors outside a jam event | ≤ 10% of ants outside | replay-lab (new field) |
| Chapter 1 length | 4 to 6 min for the median bot; human median ≤ 8 min | replay-lab |
| Chapters 2 to 6 length | 6 to 12 min for the median bot | replay-lab |
| Passive bot | finishes chapter 1 | Bot run |
| Idle bot | loses chapter 2 or 3 | Bot run |
| Consequential choices (round 4) | In each chapter, at least 4 of the median bot's orders each change ants, stores or open routes at dusk by 5% or more when a paired replay changes only that order. A decision event that changes nothing does not count toward the gap lines | Paired replays (new tool) |
| Quiet stretches (round 4) | In the first 2 min of the median replay, no 15 s window without a delivery, a birth, a new source, a finished structure or a threat change | replay-lab per-second events |
| The old quota opening (20 workers, 40 sugar, 4 larvae, a 40-load day) | **fails** this table | A fixture in CI; if it ever passes, the table is too loose |

**Which lines block what (round 4).** A line blocks a pull request only once the sim has the parts it reads. R0 blocks on: first delivery, deliveries in minute 1, first birth, the quota fixture failing, and a planted slow-down (brood ×10) failing. From R1 step 3 (crews): wasted labour and queued share. From R1 step 5 (bird): the threat and first-choice lines and consequential choices for chapter 1. At the R1 gate: every line for chapter 1, on 20 seeds. R2a adds chapters 2 and 3; R2b adds 4 to 6. A line that cannot be read yet is reported, not skipped silently.

### 3.2 Starting values (tune these, keep the gates)

| Thing | Start value | Why, multiplied out |
| --- | --- | --- |
| Cell | about one ant length; 256 sub-cell units | As now |
| Tick | 20 a second, fixed | As now |
| Walk on a trail | 3.5 cells/s (45 units a tick) | Now 1.9 (`WALK = 24` in `sim/sim.js`). At 1.9 the first delivery cannot meet 10 s |
| Walk off a trail | 2.5 cells/s | Scouting and wandering |
| Run (Recall, Alarm) | 5 cells/s | |
| First food | a seed head (30 sugar loads) and a dead beetle (20 protein loads), 8 to 12 cells from the entrance, visible at 0 s; a third pile (120 loads, mixed) past a stone at 2:00 | 10 cells out (2.9 s), pick up (0.5 s), 10 back (2.9 s), 3 down (0.9 s): **7.2 s** to a delivery. About 5 ants on a Steady crew plus free foragers bring about 0.7 to 1 load a second, so the seed head empties near 0:40 and the beetle near 0:50 (pile sizes scaled to the 30-ant start): two decision events |
| Loads | 1 load = 1 unit of food. The rebuild drops today's `LOAD = [4, 2]` units | Avoids a 4x fork in upkeep |
| Starting stores | 10 sugar, 5 protein in the porch store | Covers about 3 min of upkeep for the starting colony with no orders; growth raises upkeep fast |
| Starvation | At 0 sugar, adults move at half speed; after 60 s at 0, one adult in a hundred dies every 10 s, oldest first. Larvae with no protein for 60 s die. The queen dies last, and only after all workers | Gives the idle bot a way to lose |
| Porch store | a store chamber 3 cells under the entrance; a load counts as home there | The old chamber was 24 cells down: 6.9 s one way even at 3.5 cells/s |
| Nursery and queen | 10 to 16 cells down | Depth protects brood from rain and raids; nurses carry food down, foragers do not |
| Colony at start | 30 adults (owner choice 2026-11-26, 11 decision 6 B): 20 on the surface around the entrance, 10 inside nursing. Queen, 12 pupae due from 8 s and then every 3 to 5 s, 20 larvae aged 0 to 20 s, 20 eggs aged 0 to 10 s. Nursery of 64 cells | Births inside 15 s. The colony is small and visibly grows: 42 adults by about 1 min from the pupae, about 100 by 3 min when the player routes about 50 protein (each larva needs 1), and thousands by about minute 20. Every loss shows. At 1 egg a second and 60 s from egg to adult a fed colony holds about 60 brood, so 64 nursery cells fill once protein flows and the "room full" beat fires on that event |
| Brood | egg 15 s, larva 25 s (needs 1 protein load), pupa 20 s: egg to adult 60 s | Now 570 s (`colony.js`, 11,400 ticks) |
| Queen laying | 1 egg a second while sugar stores are above 0; 2 a second once a queen chamber of worth 60 or more is dug (from chapter 3); at most 1 brood per nursery cell. Eggs are free; each larva needs 1 protein load | Nursery cells and protein set the real rate. Round 4: 2 eggs a second only adds ants when the nursery holds more than about 60 cells, so chapter 3 offers the queen chamber and a nursery dig together |
| Adults eat | 1 sugar load per 10 adults a minute | 30 ants need 3 loads a minute; 200 need 20. Round 4 check: one forager on a 7 s trip brings about 8 loads a minute and feeds about 80 ants, so sugar is loose. Tuning target, read from bots: the median bot needs 20 to 30% of its outside workers on sugar to break even; raise upkeep until it does |
| Ants at chapter ends (median bot) | about 200 after chapter 1, 900 after 3, 1,500 to 2,000 after 6 | Chapter 1 ceiling is about 320 (30 + 52 starting brood + 1 egg a second, less the last minute's eggs); chapters 2 and 3 need about 700 births of up to 1,500; chapters 4 to 6 need about 1,000 of up to 3,600 at 2 a second. Losses fit. 2,000 matches the frame gate; free play goes to 5,000 |
| Food sources | finite piles; seeds, nectar plants and prey that regrow as the hill blooms | A fixed map runs out (NOTES.md found days asking for more than the map holds) |
| Doors | The entrance starts 3 cells wide. Each cell passes 6 ants a second in each direction (out and in are separate lanes). A door is **jammed** when 10 or more ants queue at it for 5 s | 18 a second each way. Round 4: chapter 1 cannot jam this door. Even a 300-ant colony on Surge sends about 9 to 12 a second, and the 30-ant start reaches about 200 by dusk. The first jam moves to chapter 4 (long routes, a bigger colony), where the skeleton already has it. A jam is shown only when it really happens; bots test congestion in a separate fixture with a one-cell door |
| Crews | Light, Steady, Surge = 10%, 25%, 50% of the **outside workforce** (all adults not nursing and not digging, including ants already on crews), recomputed only when that workforce changes by 10%. If the crews would add up to more than 100%, the new crew gets what is left and its card says "no free foragers" | Round 4: the round-3 base excluded ants already on crews, so Steady settled near 20% and Surge near 33%. Free outside ants forage on their own at a low rate (rule 4, owner choice 12-B), so crews still decide where and how fast |
| Bird | Shadow 10 to 15 s ahead; strikes a circle of radius 6 cells for 5 s. Each second it takes 1 ant for every 10 exposed ants in the circle (at least 1 if any are exposed, and at most a quarter of the exposed ants over a pass); every exposed carrier in the circle drops its load; the struck route scatters for 10 s. A husk covers 3 by 3 cells, a sprout 5 by 5, a roof as built. A trail runs under cover where its cells are covered | Round 4: a flat 5 ants is 1.7% of 300, too small to feel, and good and bad husk placement could both show 5 deaths. Now the cost is economic (dropped loads, a dip in loads a minute) and scales with how many ants the player left in the open. The owner chose this (12-A, 2026-11-26) |
| Recall | Ants go to the nearest shelter: inside a door, or a covered cell (cover holds 4 ants a cell). This is the one rule; 6.7 follows it. Recall ends when the threat passes or on a second tap; crews then resume. Recall is not limited by door lanes for ants already within 2 cells of a door | Recall can beat a 10 s telegraph |
| Trails | A trail whose scent falls under 5% of its peak (about 4 half-lives unused) is removed | Bounds goals (05) |
| Structure costs | Husk: free (it is a carried object). Roof: 3 husks or 6 leaves. Span: 10 soil. Ramp: 6 soil. Plug: 4 soil, or one major standing in it. Channel: dug, 1 soil a cell. Mound: rises one step per 20 soil | Crew time 5 to 20 s each |
| Majors | A larva fed 3 protein becomes a major; 4 times the hit points, 3 times the damage, eats double | From chapter 3 |
| Rain | Chapter 2: warning at 2:00, the first 30 s pulse at 2:30; then a warning 30 s before each pulse, every 2 to 4 min. The warning draws the predicted waterline in the nest. The first pulse floods only an empty low passage; the second is the first that can reach brood. Rain slows ants in the open; it kills only by flooding: an ant or brood in a flooded cell for 10 s drowns | Rain is the first terrain test, and Recall is not the answer to it. Round 4: a structure takes 5 to 20 s, so a first pulse that reaches brood before a plug is offered is unfair |
| Now-or-later bill (chapter 3 on) | Due during dusk: 0.2 sugar loads per adult, counted live from the moment it is shown. A seed in the granary cracks into 2 sugar loads. A projected surplus or deficit shows on the top bar from mid-chapter. A shortfall costs one adult per missing load, weakest first, at most a quarter of the colony; the chapter then ends and the colony advances smaller | Round 4 worked dusk (round4/review-a-player.md, assumed inputs): 1,012 adults owe 202 loads; a growth plan holding 213 sugar clears it by 10, while at 0.25 a load the same play misses by 40. R2a must show a lower-growth storing plan that beats it on a second hill |
| Chapter checkpoint | at chapter start, and every 20 s. Solo time pauses and the game saves when the tab is hidden | The 20 s save line |
| Surface region | 256 by 256 cells | As now |
| Nest | 192 wide by 64 deep cells | Shallower than 128: walking depth is time |
| Trail fade | half-life about 60 s unused | Now a third of a day |

## 4. The first five minutes (chapter 1, "Up from the deep")

This is the chapter the M1 build failed. It is written second by second so a builder does not have to guess.

| Time | What the player sees | What the player can do | What it teaches |
| --- | --- | --- | --- |
| 0 s | Morning, Field look. The entrance on black ash. A few dozen survivors climb out and mill; a counter shows 30. Two food piles glint 8 to 12 cells away: a seed head and a dead beetle. A ghost finger draws from the entrance to the seed head | Draw a trail | Trail |
| 2 to 5 s | The stroke commits on lift. A stream of ants turns onto it at once; a count on the trail ticks up | Draw a second trail to the beetle | Orders have an effect within 0.5 s |
| 7 to 10 s | The first seed reaches the porch. A pop and a store counter. The first beetle load reaches the nursery by about 20 s | | Food home |
| 8 to 15 s | The nest cutaway opens in place over the entrance for 3 s (or on a tap): the first pupae split and new ants stand up | | Births |
| 15 to 30 s | The seed husks pile at the entrance. A prompt shows two places to put the first husk: in the open beside the busier trail, or under a charred stalk off the trail. The husk is a light object a crew carries | Drag the husk to a place, or ignore it (a crew then drops it by the stalk) | Build |
| 30 to 60 s | A bird's shadow crosses from the hill's edge, slowly, with a sound | Recall, move a trail under the husk, or do nothing | Threat, cover |
| 40 to 50 s | The seed head empties. The beetle empties near 50 s. A new sugar source, a nectar stalk, shows across open ash | Draw a new trail, open or under the husk | Sources run out |
| 45 to 60 s | The bird strikes. Exposed carriers drop their loads, the struck route scatters for 10 s and its loads a minute dip; it takes ants in proportion to how many were in the open (3.2). Ants under the husk keep working. A loss counter shows ants and loads lost. Two replays that differ only in husk placement must look different by 60 s | | Consequence of the first choice, inside a minute |
| about 65 s | The first ant raised on the player's beetle protein stands up; the larva pupated at about 45 s. The cutaway follows that load: the beetle piece reaches a larva at about 20 s and the larva is marked; the new adult comes out marked in the beetle trail's colour and walks to the free count | | Player-funded brood, seen as caused by the player |
| 70 to 90 s | The nursery shows larvae short of protein; the only protein left is a dead cricket by the bird's path | Route to it now, or wait under cover | Risk against need |
| 90 s to 2 min | A seed planted in the midden sprouts: a green tuft on the ash, with a shadow ants can stand in | Plant (drop husks and seeds on the midden spot) | Bloom |
| 2:00 | A third pile appears farther off, past a stone. The quick route to it crosses open ash; a longer route runs under the sprout and the husk | Choose route and crew size | Routes, crews |
| 2:30 | The second bird pass, now along the long route | Keep, cover or reroute | Threats return to what you built |
| when it fills (about 2 to 3 min if protein flows) | The nursery is full (room full). Laying stops; dig paint for new nursery cells is pre-marked | One tap to dig them, or leave it | Dig. Shown only when it happens; a colony short of protein sees "brood short of protein" instead |
| 3 to 4 min | A beetle carcass drops near the far pile; the stalk's nectar runs low | Route to the carcass, open or covered | Sources run out; risk against need |
| 4 to 5 min | The third bird pass, along whichever route carries most | Keep, cover or reroute | The cover you built pays |
| 4 to 6 min | Dusk. The Ember look comes in. Stores, ants (30 at dawn, now about 200), sprouts and losses on a short card with the colony ledger, and a look at tomorrow's hill: where the sprouts will spread, which piles will regrow, and the next threat's first sign. Chapter 1 ends | Go on, or stop (the game is saved) | Natural stop, and a reason to come back |

Chapter 1 cannot be lost by doing nothing (the passive bot finishes it). It can go badly: a colony that ignored the bird starts chapter 2 smaller.

## 5. Story and tone

The story is told in short wordless scenes, 3 to 10 seconds, in the game's own style. Words appear only on controls, goals and the chapter card (owner choice 2026-11-26, 11 decision 4 A, with C's ledger). The chapter card carries a **colony ledger**: route records (busiest route, longest route, loads home), weather marks (rains survived, floods), losses and births. No biology notes and no narrator.

- **The colony.** It survived the fire underground. Its queen is old and still laying. She is the colony's weak point: if an enemy reaches her, the chapter is lost.
- **The hill.** Black ash at first; it greens where the colony plants seeds. The bloom map is the record of play and the picture a player shares.
- **The neighbours.** A rival colony across the creek (chapter 5 onward), run by the same rules as the player (section 6.4). It is not a villain; it is another colony trying to live.
- **Later (after Spring):** an invading supercolony from the road, allies, seasons. Kept in 07 and the P3 list.

Warm, small and alive. Death is shown (ants carry their dead to the midden) but never gory. No human cruelty. Nothing in the game names a religion.

## 6. Systems

### 6.1 Economy and the now-or-later choice

- **Sugar** (nectar, honeydew, seed tips) feeds adults. **Protein** (prey, the dead) feeds larvae. **Seeds** keep in a dry granary and can be cracked into sugar slowly. No other currency.
- **Soil** from digging goes on the entrance mound (raises the door above rain water) or on a spoil spot the player marks (fills antlion pits, makes low walls).
- **Now or later.** From chapter 3 each chapter ends with a bill shown from its start: a dry spell or a cold night that needs stored seeds or sugar per ant. A load eaten now grows the colony; a load stored pays the bill. It comes due during dusk, with numbers in 3.2; short of it, the weakest ants die and the colony advances smaller.
- **Starvation warning:** when sugar will run out within 60 s, a warning with its cause and one fix.

### 6.2 Crews, routes and traffic

Every trail, dig, build and alarm has a **crew**. Its card shows ants on it, ants wanted, loads a minute, and the reason for a gap ("no free foragers", "door jammed", "path flooded").

- **Crew size** is set on the route card: **Light**, **Steady** or **Surge** (about 10%, 25% and 50% of free workers, capped by the route's width), or plus and minus one ant, hold for eight.
- **Who goes.** One rule, applied every tick in this order: (1) Recall; (2) an ant carrying a load finishes the delivery; (3) an ant on an explicit crew keeps it; (4) free ants take auto jobs by need: feed brood, store food, dig marked cells, then forage. **Free foraging** (owner choice 12-B, with decisions left to the player): free ants forage only on trails the player drew, only the nearest one, one free ant in three at a time (the rest rest by the door, shown as a "free" count), at off-trail speed, and they turn back at any telegraphed threat. A trail with no crew therefore runs at about Light; a crew lifts it to Steady or Surge, sends ants to far or risky sources, and keeps working through a threat. An ant is free when it has no load and no crew. (Round 4 found that full auto-forage emptied both opening piles in about 20 s whatever the crew size; this rule keeps the colony busy without making crews moot.)
- **Traffic.** Doors and narrow passages have a throughput (section 3.2). Queues show as a jam marker. Widening, a second door, a span or a ramp fixes it. Loads a minute on every route make throughput visible.
- **Tactical pause** (solo, and co-op when all players agree): time stops; orders can be given; they take effect on resume.

### 6.3 Brood and growth

- Queen lays when fed; eggs, larvae and pupae need nursery cells. A larva needs one protein load. Well-fed larvae (a caste dial from chapter 3) become **majors**: slower, stronger, they crack seeds and hold doors.
- Brood times are in section 3.2. Pupae at the start make the first births arrive in seconds.
- Nurses carry brood up or down by heat and water: brood rises in rain, sinks at midday.

### 6.4 Threats and combat

- **Combat contact rule.** Fights are automatic. Each ant can engage at most a fixed number of enemies it touches (frontage contact slots, 05). On open ground more ants touch, so the bigger swarm wins by its square; in a tunnel one faces one, so quality and doors win. Several ants can pin a big enemy: each on a leg slows it.
- **Threat order in Spring** (each first in a safe form):

| Chapter | Threat | Telegraph | Answer |
| --- | --- | --- | --- |
| 1 | Bird | A shadow and a sound, 10 to 15 s ahead | Recall, cover (husk, sprout), trails under cover |
| 2 | Rain | A sky change and a rain marker 30 s ahead | Mound, plugs, channels, carry brood up, redraw trails |
| 3 | A spider that wears ant scent and walks the busiest trail | Its trail of wrong-coloured scent | Alarm with majors, cut the trail for 20 s, decoy trail |
| 4 | Antlion pits on the dry slope | Sand cones | Route around, fill with spoil |
| 5 | The neighbour colony | Its scouts on your trails | Guards on doors, decoy trails, walls, a counter-raid |
| 6 | A storm night and a raid together | Both warnings | Everything above |

- **Shared scent.** Every colony reads every trail. A rival's scouts follow your strongest trail to your food and to your door. A trail drawn to nothing with Alarm held is a **decoy**: scouts follow it into your guards. Rivals do the same to you. The rival AI uses the player's own verbs and rules; it has no hidden powers.
- **No stuck enemies.** An enemy that has not moved for 20 s wanders, then leaves the map edge, unless it is holding a door or fighting. No goal requires every enemy to die.
- **Equal-cost test (round 4).** Combat is tuned on forces of equal protein (one major against three workers), on open ground and at a held door, counting the income of workers left foraging.

### 6.5 Water and terrain

- Soil is a grid of cells: loose ash, topsoil, clay, stone, roots, water. Water is an integer cellular automaton on the same grid, its own hashed subsystem: rain fills low surface cells, runs down open tunnels and pools in low rooms.
- **Structures** are placed objects a crew builds from husks, soil or leaves: a **span** (crosses a gap or water), a **ramp**, a **roof** (cover from birds and rain), a **plug** (closes a door; majors can hold one), a **channel** (leads water away), and the **mound** (raises the door). Each has a cost in loads and a crew time of 5 to 20 s. Chapter 1 and 2 offer marked placement spots; later chapters allow any legal edge.
- **Rooms** are dug spaces with a painted purpose (nursery, granary, porch store, queen, midden). A room's capacity is its cells. Its worth (0 to 100, shown on it) comes from the room's own depth, dryness and size only. Nothing about its neighbours changes it (round 3: a neighbour term read too close to the reference game's tile adjacency).
- **Cave-ins** only in loose ash under too wide a span, with a crack 5 s ahead.

### 6.6 Bloom

- Seeds carried home are eaten for the fatty tip; the husk and some seeds go on the midden or a place the player drops them. Middens near the surface sprout in 45 to 90 s.
- Sprouts give shade (cover from birds), nectar, and roots that stop cave-ins. By chapter 6 a well-played hill has a green patch that changes routes.
- The **bloom map** (black to green) is the chapter card picture and the share picture.

### 6.7 Controls

Portrait phone layout: a top bar (chapter goal, stores, ants, pause), the play field, and a bottom tool strip: **Trail**, **Dig**, **Build**, **Alarm**, and a **Recall** button at the right edge. Route cards slide up from the bottom when a trail or job is tapped. The nest opens as a cutaway in place over the entrance (tap the entrance, or pinch in on it); the surface stays visible above it.

| Verb | Gesture | What ants do |
| --- | --- | --- |
| Trail | Trail mode: draw from the entrance or an existing trail | The crew follows the drawn shape and lays scent. A trail with food at its end strengthens; an unused one fades (section 3.2). Erase by drawing over it with Dig or from the route card |
| Dig | Dig mode: paint soil | The dig crew digs painted cells in order and carries spoil to the mound or spoil spot |
| Build | Build mode: drag a structure from the strip, or drag a husk | A crew carries materials and builds it |
| Alarm | Alarm mode: press and hold | Guards and nearby ants run there in waves while held. Held at the end of a trail drawn to nothing, it makes a decoy. Round 4: the route card of a trail that ends on nothing also has a **Make decoy** button, so one thumb can do it |
| Recall | One button | Every ant outside runs to the nearest shelter (3.2). Carriers keep their loads. A second tap, or the threat passing, ends it |

One finger acts in the chosen mode; two fingers always pan and zoom. A stroke is a preview until the finger lifts; a second touch or a `pointercancel` cancels it. A mouse uses the left button to act and the right button or wheel to move. One-finger camera, zoom buttons, undo of the last order, and tap-start, tap-end trails are in settings. Every order shows its effect within 0.5 s.

## 7. What the screen must always answer

- Where is my food going, and how fast? (loads a minute on routes, store counters; selecting a route shows on the ground how many ants wait to pick up, carry, and wait to unload, so a full store looks different from a queue; a trail being drawn previews its first trip in seconds)
- What is about to hurt me, and when? (telegraphs, section 6.4)
- Why is this ant or crew not doing what I asked? (the gap reason on every card; tap an ant for its load, goal and wait reason)
- What did my last choice cost or win? (loss and gain counters for 5 s after an event)

## 8. Chapters, stakes and modes

### 8.1 Spring, six chapters

| # | Chapter | New verb or threat | Ends when |
| --- | --- | --- | --- |
| 1 | Up from the deep | Trail, husk, bird, births, the sprout (round 4: the door jam moved to chapter 4) | Dusk, about 5 min |
| 2 | First rain | Dig, mound, plugs, channels, brood moved up | The storm passes with the queen dry |
| 3 | The spider on the trails | Alarm, majors, decoy, the first now-or-later bill | Dusk after the spider is driven off or starved of trails; the bill is settled at dusk, paid or short (3.2) |
| 4 | The dry slope | Antlion pits, spans and ramps, crews under traffic | A route to the far seed field runs for 60 s |
| 5 | Neighbours | Shared scent, rival scouts, raids, walls | The border holds through a raid, or a counter-raid takes their granary |
| 6 | Storm night | All of it at once, in the Ember look | Dawn, with the queen alive; the bloom picture |

Each chapter has a script like section 4, written before it is built, with a decision event at least every 30 s for its first 10 minutes. The skeleton for chapters 2 to 6:

| # | Beats in order (about one every 20 to 30 s) |
| --- | --- |
| 2 | New sources uphill and downhill; room full; rain warning at 2:00; first pulse floods the lowest tunnel; brood short of protein; a plug or mound offered; second pulse at a new low point; a channel offered; a sprout gives a dry route; storm peak; dry-out |
| 3 | Spider's wrong-coloured trail seen; busiest route hit; majors unlocked (caste dial); a decoy offered; queen chamber offered; the bill shown (it grows with the colony); spider returns to the new busiest route; sources empty; bill due at dusk |
| 4 | Dry slope opens; first pit; spoil spot offered; span over a crack; ramp to the seed field; jams on the long route; second door; pits move as sand slides; far field runs |
| 5 | Rival scouts on your trail; their trail seen; a decoy works; their raid telegraphed; walls and plugs; a counter-raid route; their granary in view; border settles |
| 6 | Dusk; storm warning; raid warning; flood and raid together; Ember night; dawn |

### 8.2 Stakes (owner chose A, 11 decision 5)

A chapter is lost if an enemy reaches the queen, if the queen drowns, if the colony has had no brood and no sugar for 2 minutes, or if it falls under 50 ants. The idle bot loses in chapter 2: its larvae starve by about 3 min, its sugar runs out, and with no mound, plug or channel the storm peak floods the queen's chamber. (Round 4: brood starves before the first lethal pulse, so "the brood all drowns" could not be the idle bot's loss; under 50 ants by starvation alone takes about 30 min.) The floor at a chapter start is 150 ants and 30 sugar. A lost chapter retries from its start checkpoint or from any 20 s checkpoint in the last two minutes. The campaign never dead-ends: a chapter always starts with at least a floor of ants and stores, and the chapter card says when the floor was used.

Difficulty: **Gentle** (no loss; a lost chapter becomes a poor score), **Standard**, **Hard** (fewer floor stores, faster raids).

### 8.3 Modes in the first release

| Mode | Players | Length | Notes |
| --- | --- | --- | --- |
| Spring | 1 | six chapters, 45 to 60 min in all | The campaign |
| Free hill | 1 | open | 30 to 5,000 ants, any look, weather and rivals on or off. The owner's longest session was free play. Unlisted beside chapter 1 from R1 (owner choice 12-C) |
| Daily founding run | 1 | about 20 min | Owner choice 2026-11-26, 11 decision 1 C. One queen and a handful of workers on a fresh hill; same seed for everyone each day. The run ends when the queen dies or the season turns; the bloom it leaves carries to the player's next run. Score: ants at the end plus bloom; the lab board Worker; a replay link to the best run |

**Scores and replays (owner choice 12-F).** At release every chapter has a score (ants, bloom, losses) and a replay of the player's best run. Next after release: a persistent free hill with a long-running rival colony whose trails remember past fights.

## 9. Friends (after the solo release)

Order, each gated on the one before:

1. **Same-seed challenge.** A link to a daily run or a chapter seed; friends' runs and replays side by side. No room needed.
2. **Ghost trails.** Past players' trails on the daily run show as fading shared scent.
3. **One shared colony.** Two to four players on one colony, each with their own trail colour and their own crews; pause by all. Lockstep through the relay room (05).
4. **Versus** on one hill, shared scent as the battlefield. Only after 3 is stable.

## 10. Cut from the first release, and why

| Cut | Why |
| --- | --- |
| Summer, Autumn, Winter, the invading supercolony, allies | Spring must prove the game first |
| Wedding flight, New Hill+, colony traits | They reward a long campaign that does not exist yet |
| The Changeling caterpillar | A story beat that needs words; kept in 07 |
| Two of the three neighbour species | One rival is enough to test shared scent |
| Tournaments (display contests) | A direct-control minigame inside an indirect-control game; an optional set piece later, not the only path to allies |
| Named ants who speak, a field guide, natural-history notes | Owner chose wordless with a colony ledger (11 decision 4) |
| Lockstep versus | After the shared colony |

## 11. After Spring

The round-2 arc (Summer bloom, Autumn and the invading supercolony, Winter, the wedding flight) stays as the direction for later seasons, re-cut into chapters with the same pace budget. Ideas: [07-biology-ideas.md](07-biology-ideas.md), [10-fresh-design.md](10-fresh-design.md), [round3/design-a.md](round3/design-a.md) (a season-cycle session with a campaign map), [round3/wildcards.md](round3/wildcards.md).

## 12. Look, sound, money

- **Looks.** Field (day) and Ember (night) are kept: the owner liked both (2026-11-26). The owner chose (11 decision 2 A): each chapter runs from Field into Ember. Ink stays as a settings option.
- **Ants** are drawn by the rig (close) and instanced shapes (far). At far zoom, very large counts may be drawn as density (the fluid colony toy tests this).
- **Sound** in code (`kit/audio.js`, `kit/music.js`). Music follows bloom and danger.
- **Accessibility:** a spider toggle (spiders drawn as beetles), colour-blind palettes, one-finger controls, reduced motion, English and Turkish.
- **Money.** None in the core game. No timers, no premium currency, no ads in the game. A supporter pack or extra looks may come after release, as an owner decision.

## 13. What is not decided

- Owner decisions: [11, "Decisions only the owner can make"](11-round3-findings.md#decisions-only-the-owner-can-make).
- Round 4 taste calls: [12, "Taste calls"](12-round4-findings.md#taste-calls-for-the-owner).
- Fun and phone feel: unmeasured until chapter 1 runs on a real phone. Every value in 3.2 is a starting value.
- Whether 50,000 ants as a fluid at far zoom works on a phone: the fluid colony toy.
- Whether a founding run beats chapters: the founding runs toy.
