# Cinderhill: game spec

Status: rebuild spec, round 3, 2026-11-26. It replaces the round-2 spec. The M1 build (SIM_VERSION 6) taught us that the round-2 spec, built as written, makes a slow game: replays of the owner's sessions showed no birth, no threat and a first delivery 73 seconds after the first trail. [11-round3-findings.md](11-round3-findings.md) says what changed and why; the full reviews are in [round3/](round3/). Genre: ant colony real-time strategy and base builder, played in a phone or desktop browser, alone or with friends by link.

Read with: [01-reference-research.md](01-reference-research.md) (the reference game, reference only), [03-features.md](03-features.md), [04-roadmap.md](04-roadmap.md), [05-tech.md](05-tech.md), [07-biology-ideas.md](07-biology-ideas.md).

**For the builder.** Every number in this spec is in one table, section 3. Other files cite it. When this spec and an older file disagree, this spec wins. When a rule here is missing, take the simplest rule that keeps the pace budget, write it down in `experiments/cinderhill/NOTES.md`, and say so in the pull request.

## 0. What done means

The first release is **Spring**: six chapters on one hill, plus free play and a daily hill. It is done when outside players finish chapter 1 without help, most of them go on, and they say they would recommend it.

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
| A wildlife documentary narrator | No narrator. Wordless scenes (tone is an owner choice, 11 decision 4) |
| A lab colony tested by scientists, then separate missions as other real species | One wild colony on one burned hillside. No humans on screen |
| A fictional gene-stealing ant and a jelly meta-currency | Progress is the colony itself and the hill's regrowth ("bloom") |
| A hex-tile nest where tiles upgrade from same-type neighbours | Free digging in a soil grid. A room's worth comes from depth, size, dryness and distance |
| Numbered pheromone groups fed by assigned nurseries | Trails you draw, each with a crew you size (section 6.2) |
| A named class of giant bosses | Large animals that come because of what the colony did, with no shared class name |
| Defending aphids from ladybirds as an advertised decision | Not used. Ladybirds are dropped (round 3) |
| Its look, UI, music, names and levels | All ours |

The natural-history framing (one-line notes on real behaviour) is allowed only as the owner picks in 11 decision 4, because the red team found that a field-guide identity echoes the reference game's documentary identity.

## 2. Name, premise and shape

**Name.** Cinderhill is the working name (owner pick open, todo `lab-5w7.1`; variants in [09](09-round2-findings.md) and 11). A name and trademark check comes before any public listing.

**Premise.** A summer fire burned the hill black. Deep under it, one colony lived through the fire in its lowest chambers. You are that colony on the morning it comes up. Hundreds of ants pour out onto black ash. Feed them, dig, raise brood, and plant the seeds they carry, and the hill turns green behind you. Rain floods the low tunnels, a spider that smells like an ant walks your trails, and a neighbour colony reads every trail you draw.

**Shape.** The first release is **Spring**: six chapters of 4 to 12 minutes on one hill. The colony, the nest and the bloom carry from chapter to chapter. Each chapter runs from morning (Field look) into dusk and night (Ember look) and ends at a natural stop. Free play and a five-minute daily hill sit beside it on the menu. Summer, Autumn, Winter, the invading supercolony and friends' modes come after the first release (section 11).

## 3. Numbers: the pace budget and the starting values

This is the one table of numbers. Pace lines are gates, read from replays; everything else is a starting value, tuned by bots and play. No clock in this game is measured in days.

### 3.1 Pace budget (gates)

"Median bot" draws a trail to the nearest visible food every 15 s, answers threats with Recall, and leaves crews on Steady. "Passive bot" draws one trail and then gives no order. "Idle bot" gives no order.

| Line | Target | Read from |
| --- | --- | --- |
| Input ready after the page opens | ≤ 3 s on a mid-range phone | Page timing |
| First order (people) | ≤ 10 s for 80% of sessions | Lab record |
| First delivery from the player's first trail | ≤ 10 s after the stroke commits | replay-lab trail table, "first" |
| Deliveries in minute 1 (median bot) | ≥ 25 | replay-lab per-minute table |
| First birth | ≤ 15 s | replay-lab births (new field) |
| First player-funded birth (larva fed by a load the player routed) | ≤ 90 s | replay-lab births |
| First real choice (two options with different costs, both visible) | ≤ 30 s | Chapter script; decision events (new field) |
| Its consequence visible | ≤ 60 s | Chapter script |
| First threat telegraphed | ≤ 60 s | Decision events |
| First threat resolved (won, dodged or lost) | ≤ 3 min | Decision events |
| Longest gap between decision events, minutes 0 to 10 | ≤ 30 s | Decision events. A decision event is: a new source seen, a source empty, a threat in view, a room full, a rain warning, a route jammed, an unlock |
| Same gap, after minute 10 | ≤ 45 s | Decision events |
| Workers idle for more than 10 s (outside Recall and rain shelter) | ≤ 15% at any sampled tick | replay-lab idle column |
| Chapter 1 length | 4 to 6 min for the median bot; human median ≤ 8 min | replay-lab |
| Chapters 2 to 6 length | 6 to 12 min for the median bot | replay-lab |
| Passive bot | finishes chapter 1 | Bot run |
| Idle bot | loses chapter 2 or 3 | Bot run |
| The old quota opening (20 workers, 40 sugar, 4 larvae, a 40-load day) | **fails** this table | A fixture in CI; if it ever passes, the table is too loose |

### 3.2 Starting values (tune these, keep the gates)

| Thing | Start value | Why, multiplied out |
| --- | --- | --- |
| Cell | about one ant length; 256 sub-cell units | As now |
| Tick | 20 a second, fixed | As now |
| Walk on a trail | 3.5 cells/s (45 units a tick) | Now 1.9 (`WALK = 24` in `sim/sim.js`). At 1.9 the first delivery cannot meet 10 s |
| Walk off a trail | 2.5 cells/s | Scouting and wandering |
| Run (Recall, Alarm) | 5 cells/s | |
| First food | two sources 8 to 12 cells from the entrance, visible at 0 s | 10 cells out (2.9 s), pick up (0.5 s), 10 back (2.9 s), 3 down (0.9 s): **7.2 s** to a delivery |
| Porch store | a store chamber 3 cells under the entrance; a load counts as home there | The old chamber was 24 cells down: 6.9 s one way even at 3.5 cells/s |
| Nursery and queen | 10 to 16 cells down | Depth protects brood from rain and raids; nurses carry food down, foragers do not |
| Colony at start | 300 adults (owner choice, 11 decision 6), queen, 12 pupae due from 8 s and then every 3 to 5 s, 20 larvae, 20 eggs | Births inside 15 s; the swarm is visible at once |
| Brood | egg 15 s, larva 25 s (needs 1 protein load), pupa 20 s: egg to adult 60 s | Now 570 s (`colony.js`, 11,400 ticks) |
| Queen laying | 1 egg a second when fed; at most 1 brood per nursery cell | 60 a minute at most; nursery size and protein set the real rate |
| Adults eat | 1 sugar load per 10 adults a minute | 300 ants need 30 loads a minute: food matters from minute 1 |
| Ants at chapter ends (median bot) | about 500 after chapter 1, 1,200 after 3, 2,000 to 3,000 after 6 | The swarm grows inside a session; 5,000 is the sim cap |
| Food sources | finite piles; seeds, nectar plants and prey that regrow as the hill blooms | A fixed map runs out (NOTES.md found days asking for more than the map holds) |
| Door throughput | 4 ants a second per entrance cell of width | 300 ants through a 1-cell door take 75 s: traffic is a decision |
| Rain | warning at 2:00 in chapter 2, a 30 s pulse; then a pulse every 2 to 4 min | Rain is the first terrain test |
| Chapter checkpoint | at chapter start, and every 20 s | The 20 s save line |
| Surface region | 256 by 256 cells | As now |
| Nest | 192 wide by 64 deep cells | Shallower than 128: walking depth is time |
| Trail fade | half-life about 60 s unused | Now a third of a day |

## 4. The first five minutes (chapter 1, "Up from the deep")

This is the chapter the M1 build failed. It is written second by second so a builder does not have to guess.

| Time | What the player sees | What the player can do | What it teaches |
| --- | --- | --- | --- |
| 0 s | Morning, Field look. The entrance on black ash. Ants pour out and mill. Two food piles glint 8 to 12 cells away: a seed head and a dead beetle. A ghost finger draws from the entrance to the seed head | Draw a trail | Trail |
| 2 to 5 s | The stroke commits on lift. A stream of ants turns onto it at once; a count on the trail ticks up | Draw a second trail to the beetle | Orders have an effect within 0.5 s |
| 7 to 10 s | The first seed reaches the porch. A pop and a store counter | | Food home |
| 8 to 15 s | The nest cutaway opens in place over the entrance for 3 s (or on a tap): the first pupae split and new ants stand up | | Births |
| 15 to 30 s | The seed husks pile at the entrance. A prompt shows two places to put the first husk: in the open beside the busier trail, or under a charred stalk off the trail. The husk is a light object a crew carries | Drag the husk to a place, or ignore it (a crew then drops it by the stalk) | Build |
| 30 to 60 s | A bird's shadow crosses from the hill's edge, slowly, with a sound | Recall, move a trail under the husk, or do nothing | Threat, cover |
| 45 to 75 s | The bird takes ants in the open. Ants under the husk are safe. A loss counter shows what it cost | | Consequence of the first choice, inside a minute |
| 60 to 90 s | The first larva fed with the player's beetle protein pupates; the nursery row shows its progress | | Player-funded brood |
| 90 s to 2 min | A seed planted in the midden sprouts: a green tuft on the ash, with a shadow ants can stand in | Plant (drop husks and seeds on the midden spot) | Bloom |
| 2 to 3 min | A third pile appears farther off, past a stone. The trail to it is long and open; a shorter path goes under the sprout | Choose route and crew size | Routes, crews |
| 3 to 5 min | The door jams: ants queue at the one entrance. A "jammed" marker. Dig paint shows where a second door could go | Dig a second door, or widen the first | Traffic, dig |
| 4 to 6 min | Dusk. The Ember look comes in. Stores, ants, sprouts and losses on a short card. Chapter 1 ends | Go on, or stop (the game is saved) | Natural stop |

Chapter 1 cannot be lost by doing nothing (the passive bot finishes it). It can go badly: a colony that ignored the bird starts chapter 2 smaller.

## 5. Story and tone

The story is told in short wordless scenes, 3 to 10 seconds, in the game's own style (tone is 11 decision 4). Words appear only on controls, goals and the chapter card.

- **The colony.** It survived the fire underground. Its queen is old and still laying. She is the colony's weak point: if an enemy reaches her, the chapter is lost.
- **The hill.** Black ash at first; it greens where the colony plants seeds. The bloom map is the record of play and the picture a player shares.
- **The neighbours.** A rival colony across the creek (chapter 5 onward), run by the same rules as the player (section 6.4). It is not a villain; it is another colony trying to live.
- **Later (after Spring):** an invading supercolony from the road, allies, seasons. Kept in 07 and the P3 list.

Warm, small and alive. Death is shown (ants carry their dead to the midden) but never gory. No human cruelty. Nothing in the game names a religion.

## 6. Systems

### 6.1 Economy and the now-or-later choice

- **Sugar** (nectar, honeydew, seed tips) feeds adults. **Protein** (prey, the dead) feeds larvae. **Seeds** keep in a dry granary and can be cracked into sugar slowly. No other currency.
- **Soil** from digging goes on the entrance mound (raises the door above rain water) or on a spoil spot the player marks (fills antlion pits, makes low walls).
- **Now or later.** From chapter 3 each chapter ends with a bill shown from its start: a dry spell or a cold night that needs stored seeds or sugar per ant. A load eaten now grows the colony; a load stored pays the bill. Short of the bill, the weakest ants die at the chapter card.
- **Starvation warning:** when sugar will run out within 60 s, a warning with its cause and one fix.

### 6.2 Crews, routes and traffic

Every trail, dig, build and alarm has a **crew**. Its card shows ants on it, ants wanted, loads a minute, and the reason for a gap ("no free foragers", "door jammed", "path flooded").

- **Crew size** is set on the route card: **Light**, **Steady** or **Surge** (about 10%, 25% and 50% of free workers, capped by the route's width), or plus and minus one ant, hold for eight.
- **Who goes.** One rule, applied every tick in this order: (1) Recall; (2) an ant carrying a load finishes the delivery; (3) an ant on an explicit crew keeps it; (4) free ants take auto jobs by need: feed brood, store food, dig marked cells, forage the nearest open route. An ant is free when it has no load and no crew.
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
- **No stuck enemies.** An enemy that has not moved for 20 s wanders, then leaves the map edge. No goal requires every enemy to die.

### 6.5 Water and terrain

- Soil is a grid of cells: loose ash, topsoil, clay, stone, roots, water. Water is an integer cellular automaton on the same grid, its own hashed subsystem: rain fills low surface cells, runs down open tunnels and pools in low rooms.
- **Structures** are placed objects a crew builds from husks, soil or leaves: a **span** (crosses a gap or water), a **ramp**, a **roof** (cover from birds and rain), a **plug** (closes a door; majors can hold one), a **channel** (leads water away), and the **mound** (raises the door). Each has a cost in loads and a crew time of 5 to 20 s. Chapter 1 and 2 offer marked placement spots; later chapters allow any legal edge.
- **Rooms** are dug spaces with a painted purpose (nursery, granary, porch store, queen, midden). A room's capacity is its cells. Its worth (0 to 100, shown on it) comes from depth, dryness, size and distance from its goods; a midden next to the nursery lowers it. No adjacency upgrades.
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
| Alarm | Alarm mode: press and hold | Guards and nearby ants run there in waves while held. Held at the end of a trail drawn to nothing, it makes a decoy |
| Recall | One button | Every ant outside goes home at a run. Carriers keep their loads |

One finger acts in the chosen mode; two fingers always pan and zoom. A stroke is a preview until the finger lifts; a second touch or a `pointercancel` cancels it. A mouse uses the left button to act and the right button or wheel to move. One-finger camera, zoom buttons, undo of the last order, and tap-start, tap-end trails are in settings. Every order shows its effect within 0.5 s.

## 7. What the screen must always answer

- Where is my food going, and how fast? (loads a minute on routes, store counters)
- What is about to hurt me, and when? (telegraphs, section 6.4)
- Why is this ant or crew not doing what I asked? (the gap reason on every card; tap an ant for its load, goal and wait reason)
- What did my last choice cost or win? (loss and gain counters for 5 s after an event)

## 8. Chapters, stakes and modes

### 8.1 Spring, six chapters

| # | Chapter | New verb or threat | Ends when |
| --- | --- | --- | --- |
| 1 | Up from the deep | Trail, husk, bird, births, a second door | Dusk, about 5 min |
| 2 | First rain | Dig, mound, plugs, channels, brood moved up | The storm passes with the queen dry |
| 3 | The spider on the trails | Alarm, majors, decoy, the first now-or-later bill | The spider is driven off or starved of trails; the bill is paid |
| 4 | The dry slope | Antlion pits, spans and ramps, crews under traffic | A route to the far seed field runs for 60 s |
| 5 | Neighbours | Shared scent, rival scouts, raids, walls | The border holds through a raid, or a counter-raid takes their granary |
| 6 | Storm night | All of it at once, in the Ember look | Dawn, with the queen alive; the bloom picture |

### 8.2 Stakes (owner choice, 11 decision 5; recommended A)

A chapter is lost if an enemy reaches the queen, if the brood all drowns, or if the colony falls under 50 ants. A lost chapter retries from its start checkpoint or from any 20 s checkpoint in the last two minutes. The campaign never dead-ends: a chapter always starts with at least a floor of ants and stores, and the chapter card says when the floor was used.

Difficulty: **Gentle** (no loss; a lost chapter becomes a poor score), **Standard**, **Hard** (fewer floor stores, faster raids).

### 8.3 Modes in the first release

| Mode | Players | Length | Notes |
| --- | --- | --- | --- |
| Spring | 1 | six chapters, 45 to 60 min in all | The campaign |
| Free hill | 1 | open | 200 to 5,000 ants, any look, weather and rivals on or off. The owner's longest session was free play |
| Daily hill | 1 | 5 min | Same seed for everyone; score is loads home plus bloom; the lab board Worker; a replay link to the best run |

## 9. Friends (after the solo release)

Order, each gated on the one before:

1. **Same-seed challenge.** A link to a daily hill or a chapter seed; friends' runs and replays side by side. No room needed.
2. **Ghost trails.** Past players' trails on the daily hill show as fading shared scent.
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
| Named ants who speak, a field guide | Tone choice pending (decision 4) |
| Lockstep versus | After the shared colony |

## 11. After Spring

The round-2 arc (Summer bloom, Autumn and the invading supercolony, Winter, the wedding flight) stays as the direction for later seasons, re-cut into chapters with the same pace budget. Ideas: [07-biology-ideas.md](07-biology-ideas.md), [10-fresh-design.md](10-fresh-design.md), [round3/design-a.md](round3/design-a.md) (a season-cycle session with a campaign map), [round3/wildcards.md](round3/wildcards.md).

## 12. Look, sound, money

- **Looks.** Field (day) and Ember (night) are kept: the owner liked both (2026-11-26). How they are used is 11 decision 2; recommended: each chapter runs from Field into Ember. Ink stays as a settings option.
- **Ants** are drawn by the rig (close) and instanced shapes (far). At far zoom, very large counts may be drawn as density (the fluid colony toy tests this).
- **Sound** in code (`kit/audio.js`, `kit/music.js`). Music follows bloom and danger.
- **Accessibility:** a spider toggle (spiders drawn as beetles), colour-blind palettes, one-finger controls, reduced motion, English and Turkish.
- **Money.** None in the core game. No timers, no premium currency, no ads in the game. A supporter pack or extra looks may come after release, as an owner decision.

## 13. What is not decided

- Owner decisions: [11, "Decisions only the owner can make"](11-round3-findings.md#decisions-only-the-owner-can-make).
- Fun and phone feel: unmeasured until chapter 1 runs on a real phone. Every value in 3.2 is a starting value.
- Whether 50,000 ants as a fluid at far zoom works on a phone: the fluid colony toy.
- Whether a founding run beats chapters: the founding runs toy.
