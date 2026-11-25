# Cinderhill: game spec

Status: spec, 2026-11-25. No code yet. Working name **Cinderhill** (slug `cinderhill`); the name and setting are a taste pick for the owner (section 2). Genre: ant colony real-time strategy and base builder, played in a phone or desktop browser, alone or with friends by link.

Read with: [01-reference-research.md](01-reference-research.md) (the reference game, reference only), [03-features.md](03-features.md) (ranked features), [04-roadmap.md](04-roadmap.md), [05-tech.md](05-tech.md), [07-biology-ideas.md](07-biology-ideas.md).

## 0. What done means

The game is done for release when outside players finish the first season without help and say they would recommend it. Measured through the lab recording (`kit/lab.js`):

| Gate | Target |
| --- | --- |
| New players who finish Day 1 without opening help | 80% |
| New players who start Day 2 | 60% |
| Players who finish season one (Spring, 6 days) | 30% of those who start Day 2 |
| Lost progress after a crash, reload or closed tab | at most 30 seconds of play, every time |
| A full day on a mid-range phone (iPhone 13 class, Pixel 7 class) | 30 frames a second or better at 2,000 ants |
| Friends' hill by link | a second phone joins in under 10 seconds with no account |
| "Would you recommend it?" on the end card | a majority of yes from outside players |

The owner accepts each milestone by playing it (section 12 of the roadmap).

## 1. Clean-room line

The project rule (owner, 2026-11-24): for a specific published game, take the genre, not the game. These tables list what we keep from the genre and what we leave with the reference game.

### Taken: genre conventions shared by many games

- A colony with one queen who lays every egg. Lose her and you lose.
- Workers forage, carry food home and dig the nest. Food pays for brood.
- Brood grows through egg, larva and pupa. Castes differ in size and job.
- An underground nest seen as a cutaway, and a surface world above it.
- Indirect control of a swarm. You guide ants with scent, not by moving each ant.
- Fights with other insects and rival colonies. Day and night.
- A home colony that grows across a campaign.

SimAnt (1991) already had most of these: pheromone trails, a nest cutaway and a surface map, and rival colonies.

### Not taken: the reference game's own expression

| Reference game has | Cinderhill has instead |
| --- | --- |
| A wildlife documentary narrator | No narrator. The story plays out in short wordless scenes and one-line scent notes from named ants (section 4) |
| A lab colony tested by two scientists, then separate missions as other real species | One wild colony on one burned hillside for the whole campaign. No humans appear on screen |
| A fictional gene-stealing ant and a jelly meta-currency | Fictional native species of our own (section 5). Progress comes from the colony's age and the hill's regrowth ("bloom") |
| A hex-tile nest where tiles upgrade from same-type neighbours | Free digging in a soil grid. A room's purpose is painted on, and its worth comes from depth, size, dryness and distance (section 6.2) |
| Five numbered pheromone groups fed by assigned nurseries | Trails you draw with a finger, an alarm call, a recall, and job sliders (section 6.4) |
| A named class of giant bosses | One large animal per season, each its own set piece with its own rules; the game gives them no shared class name |
| Biome tiers with real species per tier | Five regions of one hill across four seasons |
| Its look, UI, music, names and levels | All ours: procedural ink-and-wash art, our own UI and levels |

### Design goals drawn from the genre's common complaints

The research (01, section 10) maps each common complaint in this genre to the system below that answers it. In short:

- **Never lose more than 30 seconds of play**, and pause to give orders at any time.
- **Short days** (8 to 12 minutes) that end in a save, inside one colony that persists.
- **A retreat in one tap**, and orders that show their effect within half a second.
- **Large swarms that stay smooth on a phone.**
- **Threats and contests where the bigger swarm does not simply win.**
- **No goal that a stuck enemy can block.**
- **Play with friends by link.**

## 2. Name and setting: owner's pick

These are taste choices, so here are four variants. A web search on 2026-11-25 found no game with any of these exact names. A name check comes before anything public. Recommended: **A**.

| | Name | Setting | Why |
| --- | --- | --- | --- |
| **A** | **Cinderhill** | A hillside after a wildfire. The colony regrows it | A visible goal (black to green), renewal and stewardship, family-friendly, and a seed economy grounded in real biology |
| B | Floodline | A riverbank with seasonal floods | Water as the main threat, raft-building, strong nest-design puzzles |
| C | Kerbside | Under one city square: pavement cracks, a café and a bin | Funny and familiar. Humans appear only as feet, crumbs and weather |
| D | Seedkeepers | A meadow with seed granaries and a long winter | Calm economy-first play. An itch.io game is called "SeedKeeper", so this name is close to taken |

The rest of this spec is written for A. Most systems carry over to B to D unchanged. What changes is the map, the threats and the story.

## 3. Pitch

A summer fire has burned Cinderhill black. One young queen landed in the ash after her wedding flight and dug in. You are her colony. Forage, dig and raise brood. Plant the seeds your ants carry, and the hill turns green behind you. Rain floods the low tunnels, a spider that smells like an ant walks your trails, and from the valley road a pale invading supercolony climbs toward you, driving out every colony it meets. A day of play lasts ten minutes. Spring, Summer and Autumn last six days each. Win by bringing the hill back to life and turning the native colonies from rivals into allies before the pale tide reaches the top.

## 4. Story and characters

The story is told without a narrator. Scenes last 5 to 15 seconds and are drawn in the game's own style. Named ants speak one-line scent notes, and the player can tap a note to see the ant who left it.

### Characters

- **Queen Sorrel.** The founder. She is the colony's heart and its weak point. Her lines are few and come at season turns.
- **Tally.** The first worker to hatch. She is the player's guide and is never forced on the player. The first trail of the game is hers. If she dies, her trail fades and a younger ant takes her name ("Tally the Second"), so the colony's memory survives.
- **Burr.** An old ground beetle who lived through the fire under a stone. He trades seeds for protection and knows where things are. Ant guests like him are real: myrmecophiles.
- **The Changeling.** A caterpillar the colony adopts in Summer. It smells like brood, so the nurses carry it in and feed it, and it eats brood in secret. Caterpillars of the large blue butterfly (*Phengaris*) do this. When the colony finds out, the player chooses: drive it out, or keep it and let it eat. Kept until Autumn, it emerges as a butterfly that pollinates the high meadow, and the bloom jumps. This is a mercy choice with a cost and a payoff. Neither path is "wrong".
- **The Pale Tide.** An invasive supercolony coming from the road. It has no queen you can reach, only many nests that share one scent and never fight each other. It displaces the native colonies it reaches. It is a slow, unbeatable flood that must be held back with allies, scent and terrain. Argentine ants behave this way. The Tide is drawn without faces. It is a force, not a villain.
- **Neighbour colonies.** Three native colonies: the **Thornbacks** (big, slow, proud), the **Jar-keepers** (honeypot ants who store food in living workers) and the **Leafstitchers** (who sew nests from leaves with silk from their larvae). Each starts as a rival and can become an ally through a tournament (section 6.7).

### Arc by season

| Season | Days | What happens | New verb or system |
| --- | --- | --- | --- |
| Spring | 6 | Founding. The first workers, the first trail, the first rain. Burr appears. An ant-eating spider that wears ant scent hunts the trails | Trail, dig, rooms, Recall, Alarm, rain |
| Summer | 6 | The hill starts to bloom. The Changeling is adopted. Thornback tournament. Heat closes the midday. Antlion pits on the dry slope. A horned lizard waits beside the trails | Seeds and bloom, tournaments, heat, castes |
| Autumn | 6 | The Pale Tide reaches the creek. Jar-keeper and Leafstitcher alliances. The Changeling choice pays off. Night raids | Scent disguise, allies, repletes, plugs |
| Winter | 4 | Diapause. Short defensive days in a cold, slow nest. The Tide tests the hill's edge. The colony survives on stores | Stores, brood pause, defence |
| Spring again | 2 | The wedding flight. Winged daughters leave to found new colonies, which seed New Hill+ and friends' games | Wedding flight, legacy |

End: the hill's bloom level and the allies won decide one of three closing scenes. All three are wins. A colony that lost its queen does not end the campaign: on Gentle and Standard, a worker becomes the egg-layer at a cost, and play goes on. Mated egg-laying workers (gamergates) exist in about 1% of ant species, not in harvesters; this is a borrowed rule, and the game says so in its field guide.

### Tone

Warm, small and alive. Death is shown (ants carry their dead to the midden, which real ants do) but never gory. There is no human cruelty. Themes of stewardship, mercy and renewal, without preaching. Nothing in the game names a religion.

## 5. Species (all fictional, built on real behaviour)

| Species | Plays as | Real basis | Special |
| --- | --- | --- | --- |
| Cinder harvesters (player) | Campaign colony | Seed-harvester ants (*Messor*, *Pogonomyrmex*) | Store seeds in granaries. Majors crack seeds. Plant seeds by dropping them in the midden |
| Thornbacks | Rival, later ally; playable later (P3) | Turtle ants (*Cephalotes*) | Majors plug entrances with their flat heads |
| Jar-keepers | Rival, later ally; playable later (P3) | Honeypot ants (*Myrmecocystus*) | Repletes: living food stores. Tournament displays |
| Leafstitchers | Rival, later ally; playable later (P3) | Weaver ants (*Oecophylla*) | Build above-ground leaf nests. Chain-bridges |
| Pale Tide | Enemy only | Argentine ant supercolonies | Never fight each other. Drive out and kill native colonies, as real Argentine ants do |

Each playable species has 3 or 4 castes from one shared list of body parts (rig.js, section 9). One species is enough for the vertical slice.

## 6. Systems

### 6.1 The two layers

- **Surface:** a top-down map of a region of the hill (ash, stones, burned stumps, plants regrowing, water). Foraging, threats, tournaments and the Tide happen here.
- **Nest:** a side cutaway of the soil under the colony's entrance or entrances. Digging, rooms, brood, the queen and stores live here.
- The layer button switches between them. Each layer is one grid, so pathfinding and scent work the same way in both. Ants pass between layers through entrances.
- A small inset always shows the other layer, with alert pips for fights, floods and hungry brood. The first emergency of each kind pauses the game in solo play and points to it.

### 6.2 Digging and rooms

- Soil is a grid of cells: loose ash, topsoil, clay, stone (cannot be dug), roots, and water. Paint cells to mark them for digging. Workers dig in order of the paint and carry spoil to the surface, where it forms a mound. The mound is a real thing: it raises the entrance above flood water.
- **Rooms.** Any dug space can be given a purpose by painting it:

| Room | Works best | Real basis |
| --- | --- | --- |
| Queen's chamber | Deep, dry, far from entrances | Queens stay deep |
| Nursery | Warm (shallow by day, deep by night: nurses move brood, which is real) | Brood carried to the best temperature |
| Granary | Dry. Seeds rot below the water line | Harvester granaries |
| Larder | Cool. Meat spoils in two days | |
| Replete gallery (Jar-keepers and allies) | Ceiling hooks, deep | Honeypot repletes hang from ceilings |
| Midden | Near the surface, away from brood | Waste chambers; disease if they are near brood |

- A room's worth is a number from 0 to 100 shown on the room: depth, size, dryness, distance from where its goods come from, and neighbours that harm it (midden next to nursery). There are no adjacency upgrades. Players learn by reading one number and its tooltip.
- **Cave-ins** happen only in loose ash when a span is too wide, with a warning crack first. **Flooding** follows the water cells (section 6.8). Plugs and mounds stop it.

### 6.3 Economy and brood

- **Sugar** (nectar, honeydew from aphids) feeds adults. **Protein** (insects, the dead) feeds larvae. **Seeds** keep and can be cracked into both, slowly. No other currencies.
- **Brood:** egg (queen lays when fed) to larva (eats protein, needs nurses) to pupa to adult. Larval feeding decides caste: well-fed larvae become majors. This is real, and it is how the player chooses castes. A caste dial sets the share of food that goes to big larvae.
- **Age jobs:** young ants work inside (nurse, dig) and old ants forage and fight. This is automatic, as in real colonies. The player shifts the balance with four **job sliders**: Dig, Nurse, Forage, Guard. Ants answer by threshold: an ant takes a job when its need passes that ant's own threshold. The colony adjusts by itself and the sliders tilt it.
- **Starvation guard:** when stores will run out within one day, a warning shows with the cause ("no protein for 40 larvae") and one suggested fix. The queen has a fasting reserve worth one day. Brood is eaten last (real colonies eat eggs in a famine; the game shows it as a warning, never a surprise).

### 6.4 Control: scent, not cursors

A tool strip at the bottom picks the mode: Trail, Dig or Alarm. One finger acts in the chosen mode. Two fingers always pan and zoom, in every mode, so a drawn trail is never a camera move by mistake. A mouse uses the left button to act and the right button or wheel to move the camera. The M0 trail painter tests this scheme before anything else is built.

| Verb | Gesture | What ants do |
| --- | --- | --- |
| **Trail** | Trail mode: draw a line from the nest or an existing trail | Ants of the chosen job follow it and lay scent as they use it. Unused trails fade in about one day. A trail with food at its end grows stronger by itself, as in nature. Trails can be erased |
| **Alarm** | Alarm mode: press and hold on a spot | Guards and nearby ants rush there. The call grows while held, and ants arrive in waves. Release to let it fade |
| **Recall** | One button | Every ant outside heads home on the shortest path at a run. Carriers drop nothing. This is the retreat |
| **Dig** | Dig mode: paint soil (nest layer) | Workers dig the painted cells in order |

- **Bands.** Up to three named bands (a banner each) for players who want more control. Tap a band, then draw a trail or call an alarm for that band alone. Bands are optional. The game is winnable without them.
- **Tactical pause** (solo, and co-op when all players agree): time stops; trails, alarms, digs and sliders can still be set; they take effect when time resumes.
- **Feedback:** every order shows its effect within 0.5 seconds: a pulse on the trail, ants turning, a count of ants on their way.

### 6.5 Combat and threats

- Fights are automatic when ants meet enemies. Ants bite, sting or spray by caste. Several ants can **pin** a big enemy: each ant on a leg slows it, and enough ants stop it. This is real ant behaviour, and it makes small ants matter against big foes.
- Terrain decides how numbers count. On open ground every ant can touch an enemy, so a swarm wins by the square of its size (Lanchester's square law, which fits some real ant fights). In a tunnel one ant faces one enemy, so quality wins (the linear law). This gives majors, choke points and plugs their worth with one rule: how many enemies each ant can touch. Attacks from the side or behind do more.
- **Threats that punish "bigger swarm wins":**
  - **Antlion pits** on the dry slope (from Summer). Ants that stream down a straight trail into one are lost one by one. Answer: route the trail around it, or fill it with spoil.
  - **Fly parasites** that hover over dense crowds and pick off ants. They are an ambient hazard that grows with crowding, never a scripted wave. Answer: thin trails and keep crowds underground. Real phorid flies do this.
  - **Spider webs** across gaps. Answer: route around them, or send majors to cut them.
  - **Birds**, shown as a shadow first. Ants on open ash are taken. Answer: Recall, or trails under cover.
- **One large animal per season**, each a set piece with a readable pattern and no shared class name in the game: an ant-eating spider that wears ant scent and walks the trails (Spring; it teaches scent and is the first hint of disguise), a horned lizard that sits beside trails eating ants one by one (Summer; horned lizards specialise in harvester ants, from memory; answer: move the trail, or plug and wait for the heat), a mole digging through the nest from below (Autumn; a nest-layer fight), a hungry shrew at the frozen entrance (Winter). Each one teaches the next season's skill.
- **The Pale Tide** is not a beast. It advances one front per day on a visible map. It can be slowed by allies, by scent tricks, by plugging and by burning bridges (dropping the leaf-bridges it uses). It is never beaten outright. Winning is holding the top of the hill.

### 6.6 Movement and pathing

- Each goal (each room, each food source, each trail, the Recall home) has a **flow field** over its layer's grid, rebuilt when the soil changes. Ants read the field under them and add separation and a little noise. Thousands of ants cost the same as a handful of goals.
- Scent trails are a field too. Following a trail and following a path use the same code.
- **No stuck enemies:** an enemy that has not moved for 20 seconds switches to wandering and then leaves the map edge. No goal requires every enemy to die.

### 6.7 Tournaments: winning without war

Real honeypot ants settle borders with displays: workers face off, stand tall and stilt-walk, and the colony that shows more and bigger ants takes the ground, often with no deaths. In Cinderhill:

- A tournament is called on a border with a neighbour. Each side sends ants to a ring. Ants display for 60 seconds. The ring holds at most 30 ants a side, so a bigger colony cannot simply flood it: freshness, size and timing decide.
- Score is display, not kills: the number of ants in the ring, their size, their freshness (well-fed ants display longer) and timing. The player paces the ants in waves: fresh ants replace tired ones.
- Winning makes the neighbour yield the border. Winning by a wide margin, or winning twice, opens an alliance. An ally sends guards when the Tide comes and trades goods (Jar-keepers trade sugar; Leafstitchers build bridges).
- Losing costs ground, not ants. A player can always fight instead, at a cost in dead ants and a lasting grudge.
- Tournaments are also a non-violent versus mode for families in Friends' hill.

### 6.8 World, weather and bloom

- **Day and night:** a day is 8 to 12 minutes of play. Night brings different hunters and slower foraging.
- **Weather:** rain (water fills low cells and flows down open tunnels; ants carry brood upward), heat (midday surface is deadly in Summer; forage at dawn and dusk), cold (Winter: everything slows; ants cluster).
- **Bloom:** seeds carried home are eaten for the fatty tip, and the seed is thrown in the midden. Middens near the surface sprout. Real ants spread seeds this way (myrmecochory). Plants grow over days: shade, nectar, aphids, cover from birds, roots that stop cave-ins. The **bloom map** turns black ash green where the colony has been. Bloom is the campaign's score, and the map is the reward a player shows a friend.
- **Aphid herding:** aphids on regrown plants give honeydew if guarded. Ladybirds eat them. A guarded herd is a farm.

### 6.9 A day's goal, losing a day, and catching up

- **One goal per day**, shown on the dawn card (for example "Bring home 20 seeds before dusk" or "Keep the nursery dry through the storm"), plus up to two optional goals. A day is won at dusk when the main goal is met.
- **Losing a day** means the goal was missed or the queen was in danger at dusk. The colony keeps what it has, and the player chooses: go on to the next day, or **restart the day from dawn** (the dawn save is always kept). No day can be lost in a way that makes a later day impossible: the next day's dawn checks the colony against a floor (ants, stores, a dry queen's chamber) and, below it, Burr brings seeds and the day's goal is eased. The dusk card says so plainly.
- **A decision floor:** Day 1 asks for at least one meaningful order every 20 seconds; the bots measure orders per minute on every day, and a day where the careful bot needs fewer than two orders a minute gets more to do.

### 6.10 Progress between days

- The colony carries everything from day to day: the nest, stores, brood, ants, trails (faded overnight) and bloom.
- **Colony traits:** at each season's end the colony picks one of three traits (for example: "Deep sleepers: Winter costs half the stores"; "Long legs: foragers run 15% faster on ash"; "Sweet tooth: aphid herds yield double"). Traits are earned by playing, not by replaying for currency. A trait choice can be changed once per season.
- **Rebuild:** any room can be filled in and redug. Nothing about a layout is permanent.

## 7. Modes

| Mode | Players | Length | Notes |
| --- | --- | --- | --- |
| Campaign | 1, or 2 in co-op | 24 days, about 4 to 5 hours | Co-op: the friend plays a sister nest (real colonies with several nests do this) on the same hill, with shared bloom |
| Friends' hill | 2 to 4 by link | one 20 to 30 minute match | Co-op against the year's hunters and weather, versus by tournaments only (family), or versus with fights. Co-op against the Tide comes with the full campaign (M5) |
| Daily hill | 1 | one day, about 10 minutes | Same seed for everyone, shared leaderboard (the lab's board Worker) |
| Skirmish | 1 against bots | one match | Bot colonies use the same rules |
| Sandbox | 1 | open | Every system unlocked, sliders for weather and threats |
| New Hill+ | 1 or 2 | campaign | Starts from a daughter colony of a finished campaign, on a new seeded hill |

## 8. First minute and teaching

- No reading needed. The game opens on Day 1 with the queen sealed in a small chamber and her first eggs. Tally hatches and walks out. The kit's hint shows a finger drawing a line from the entrance to a crumb. Drawing it sends Tally, and the crumb comes home. Day 1 ends when the first larva is fed.
- Each day adds at most one new verb or threat, first in a safe form: the first rain floods an empty tunnel; the first spider hunts where the player has no trail.
- Help is always one tap away (a "?" on any thing shows a one-line note with a small moving picture). The hint never comes back once the player has shown the skill.
- Lab recording logs which help was opened and where players stalled, for the Day 1 gate.

## 9. Look and sound

- **Art:** procedural and drawn in code, no paid assets. Ink outlines and watercolour washes. Ash is grey-black with ember specks. Regrowth is green with flowers that sway. Ants are drawn by a rig of body parts and legs with a real tripod gait (Ant Promotion's `rig.js` and `creature.js`), recoloured per species and caste. Close up, ants show legs and antennae. Zoomed out, each ant is one instanced shape with a two-frame wiggle.
- **Optional 3D look:** Ant Promotion's `look3d.js` turns 2D draw calls into lit 3D shapes. It is offered as a second look in settings, if the frame-rate gate allows it.
- **Sound:** made in code (`kit/audio.js`, `kit/music.js` with a new hill preset). The music follows bloom (sparse on ash, fuller on green) and danger. Ants have tiny clicks and stridulation. CC0 sound effects (Freesound CC0, Kenney) only where code sound is weak.
- **Accessibility:** a spider toggle that redraws spiders as beetles, colour-blind palettes for colony colours, all controls by one finger or one mouse button, reduced motion, English and Turkish (`kit/i18n.js`).

## 10. Numbers to start from (to tune by bots and play)

| Thing | Start value |
| --- | --- |
| Ants alive, solo, end of Spring | 300 to 600 |
| Ants alive, solo, peak | 2,000 (hard cap 5,000 across all colonies on the hill) |
| Surface region | 256 by 256 cells, one cell about one ant length |
| Nest | 192 wide by 128 deep cells |
| Sim tick | 20 per second, fixed |
| Day length | 8 to 12 minutes of play |
| Egg to adult | about 1 day of play (Spring), faster in Summer |
| Trail fade | half-life of about a third of a day |

## 11. What is not decided

- Name and setting: owner's pick (section 2). Filed in the todo list as `needs-adam`.
- Net model: server-ordered lockstep is chosen, but it depends on spike S2 (roadmap) proving the sim is deterministic on every engine. If S2 fails, the fallback is coarse server state (05-tech.md).
- Whether the 3D look ships: decided by the frame-rate spike.
- Whether ants are drawn as individuals at all zoom levels on low-end phones: decided by spike S3.
- How a person feels about tournaments as the main path to allies: unknown until playtests.
