# Thousandfold: an independent design (blind, design A)

Working title. Written only from brief.md and evidence.md.

## 1. Pitch and core loop

You are one ant colony in a meadow that changes with the seasons. You do not steer single ants. You draw scent trails with a finger, and thousands of ants follow them. Scent is part of the ground, so every colony in the meadow can read your trails, follow them, and cut them. A session is one Year: spring growth, a summer war over food, an autumn harvest, and a winter you survive on what you stored. At the end of each summer you raise winged queens and send them on a nuptial flight across the meadow map. Where they land, your next colonies start. The colony goes from 30 ants to several thousand inside one 22-minute Year, so the swarm you liked in sandbox mode is the normal state of the game, with decisions on top.

**Core loop at three time scales**

| Scale | Loop |
| --- | --- |
| 30 seconds | See food or a threat. Draw or reshape a trail. Watch the stream of ants change and food arrive. A new ant hatches every few seconds. |
| 10 minutes | Grow from 30 to about 700 ants. Dig chambers in the shape you choose. Split workers between foraging, digging and guarding. Meet a rival colony and decide to raid, wall off, or out-grow it. Survive the first rain. |
| 5 hours | Play about 12 Years across one meadow of 15 patches. Each nuptial flight picks which patches you settle and which colony trait the new queens carry. Win the meadow by holding the old oak at its centre through one full Year. |

## 2. The first five minutes

### Starting state (changed from the current build on purpose)

- Queen, 30 workers, 8 pupae, 12 larvae, 10 eggs. The brood is staggered so births start at 18 s and arrive every 3 to 5 s after.
- A fallen raspberry (sugar) lies **8 cells** from the entrance. A dead moth (protein) lies **12 cells** away on the other side. Both are visible without scrolling.
- Ant speed: **4 cells/s on a trail** (one cell per 5 ticks), 2.5 cells/s off a trail. The build's 1 cell per 1 to 2 s is the main reason first food took 73 s. An 8-cell round trip at 4 cells/s, plus 1 s to pick up, is about 5 s.
- Egg to adult in spring: **70 s** (egg 20 s, larva 30 s with one protein load, pupa 20 s). The build's 9.5 minutes meant no player ever saw a birth.

### Layout on a phone (portrait)

The surface fills the top 70% of the screen. A strip of nest cutaway fills the bottom 30% and shows the queen, brood and tunnels. Swipe the strip up to swap the proportions. In landscape and on desktop the two views sit side by side.

### Second by second, minute one

| Time | On screen | Player does | What changes |
| --- | --- | --- | --- |
| 0 s | Field look, morning light. 30 ants mill around the entrance. The raspberry glints. One line of text: "Drag from the hill to the berry." A ghost finger shows the stroke. | Nothing yet. | Ants drift and sniff. Ambient sound starts. |
| 2 s | | Drags from entrance to berry. | A marching-stripe trail appears. 12 ants peel off at once. |
| 4 s | First ant reaches the berry. | | A small "tick" sound. The ant turns with a red bead in its jaws. |
| 7 s | **First food home.** Sugar counter ticks up. In the strip, a nurse carries the bead to the queen. | | Every 1 to 2 s after this, another load arrives. |
| 10 s | Text: "Larvae need protein. Drag to the moth." | Drags to the moth. | A second trail. The job ring appears (bottom left) with Forage wedge full. |
| 15 s | First moth piece reaches a larva. The larva visibly swells. | | |
| 18 s | **First birth.** A pupa splits; a pale new ant walks up the tunnel and out. Ant count 31. | | Births every 3 to 5 s for the next minute. |
| 25 s | Brood chamber outline flashes: full. Text: "Dig more room. Drag in the nest." | Drags a shape in the strip. | The Dig wedge grows on the job ring. Diggers carry soil grains up and drop them around the entrance. The mound starts. |
| 40 s | **First real choice.** A seed head drops 28 cells away, across a sandy patch with an antlion pit. The raspberry is two-thirds eaten. | Draws straight through the sand, or bends the trail around it (+12 cells). | Straight: faster, the pit takes an ant now and then. Around: safe, slower. Either way the seed head stores for winter and the berry does not. |
| 55 s | Raspberry runs out. Its trail fades to grey. | Erases it or leaves it. | A dead trail wastes walkers until it fades. |
| 60 s | About 45 ants. 28 deliveries so far. | | |

### Minutes two to five

- **75 s, first threat.** Six red rival scouts find your moth trail and follow it toward your entrance, because scent is shared. Text: "Hold on them to call your ants." The player long-presses; nearby ants muster and attack. The lesson lands at once: others can read your trails.
- **2:00, rain warning.** A cloud shadow and a 45-second ring. Rain will wash trails away and flood the lowest tunnels. Two ways to prepare: dig the new chamber higher, or pile soil on the mound.
- **2:45 to 3:15, rain.** Trails fade. Water runs down the tunnels. Nurses carry brood uphill and growth pauses in wet cells. The player redraws trails. Nest shape matters for the first time.
- **3:00.** About 100 ants. The **brood dial** appears: more protein per larva raises majors, less raises workers.
- **4:00.** Scouts reveal the rival nest 60 cells away.
- **5:00.** About 180 ants. Summer starts: richer, farther food, and the rival starts raiding.

### Required timings

| Event | Target | Current build |
| --- | --- | --- |
| First order | ≤ 3 s (prompted at 0 s) | 2 to 3 s |
| First food home | ≤ 8 s after the first trail | 73 s or never |
| First birth | 18 s | never |
| First threat | 75 s | 10 min |
| First real choice | 40 s | none in minute 1 or 2 |

## 3. Systems

### 3.1 Controlling a swarm on a phone

The player gives orders to places and flows, never to selected ants. Everything works with one thumb.

| Gesture | Effect |
| --- | --- |
| Drag starting on the entrance, an ant cluster or a trail | Draws a trail. It keeps its drawn shape (already built). |
| Drag starting on empty ground | Pans. This separates drawing from panning without a mode button. |
| Pinch | Zooms. |
| Tap a trail | Ring menu: More ants, Fewer ants, Erase. |
| Long-press | Muster: ants within a radius drop their jobs and gather at the point. Drag after the long-press to send the muster as a charge. Release on empty ground to send them home. |
| Job ring (bottom-left dial) | Three wedges: Forage, Dig, Guard. Drag the dividers. Nursing is automatic and takes a fixed share. |
| Brood dial (nest strip) | Slides between workers, majors and, from summer, winged queens. |
| Drag in the nest strip | Marks cells to dig. Tap a chamber to set its use: brood, granary, queen, or midden. |
| Pause button | Freezes time; all gestures still work and run on unpause. (Convergent with the "tactical hold" in evidence.md; I keep it because one-thumb play under pressure needs it.) |

Mouse and keyboard add speed, not new verbs: left-drag draws, right-drag pans, wheel zooms, Space pauses, Q/W/E nudge the job ring toward Forage/Guard/Dig, and M musters at the cursor.

**Decision: where to put the flow.** Trail capacity is limited: each cell of trail holds a set number of ants per second. More ants on one trail jams it. So the player must choose which sources get more ants and when to open a second route. This is hard because the best source changes every minute and jams are visible but slow to clear.

### 3.2 Economy

Three things flow into the nest:
- **Sugar** pays for activity. Each ant burns a small amount per minute. At zero sugar, all ants move at half speed. Sugar does not keep through winter unless stored by repletes (see below).
- **Protein** grows larvae. One load per larva. No protein, no births.
- **Seeds** are winter food. They are heavy (two ants carry one, at half speed) but keep forever in a granary.

**Soil** from digging goes on the entrance mound (keeps rain out) or on a surface midden spot you set (a low wall that slows rivals).

**Repletes** (summer): a worker that stores 20 sugar in its body through winter and no longer works.

**Decision: now versus winter.** Sugar and protein make the colony bigger now. Seeds and repletes keep it alive in winter. Every load is one or the other. This is hard because a bigger colony also forages more seeds later, so the greedy path often wins, until the year it does not.

### 3.3 Growth and the nest

- The queen lays one egg every 2 s at start. Each brood chamber cell raises the cap on eggs in flight. A second, deeper queen chamber (dug in summer) raises the lay rate by 50%.
- Chambers are shapes the player digs. Their size in cells is their capacity. There is no tile upgrading. A chamber's depth matters: deeper is safe from rain and raids, but each worker walks farther.
- Growth targets for median play: 100 ants at 3:00, 700 at 10:00, 2,000 at 14:00, 4,000 or more by 20:00. The colony cap is 5,000.
- When the colony is at cap, new brood can only become winged queens. This turns the cap into a decision instead of a wall.

**Decision: nest shape.** A compact shallow nest is fast to use. A deep branching nest survives floods and raids. Players dig under time pressure from the next rain, so they live with their shapes.

**Decision: workers or majors.** Majors win fights and crack hard seeds but cost three protein and eat more sugar. A colony full of majors grows slowly.

### 3.4 Combat and threats

Combat is local and by mass. Each cell with ants of two colonies resolves damage every 10 ticks. Damage is applied spread across defenders, so numbers count roughly by the square (Lanchester's square law). Majors have four times the hit points and three times the damage. Defenders inside the nest get a bonus. Defeated ants curl up and fade. No gore.

**Alarm scent.** When an ant is hit, it drops alarm scent. Nearby guards come; foragers leave the area. This uses the existing scent fields (trail, home, alarm).

**Threats, by first appearance:**

| Threat | First seen | What it does | Answer |
| --- | --- | --- | --- |
| Rival scouts | 1:15 | Follow your trails toward food and your nest | Muster, or move Guard wedge up |
| Antlion pit | 0:40 | Fixed sand trap that takes ants passing over it | Route around, or fill it with soil from a midden |
| Rain | 2:45, then every 3 to 4 min | Wipes surface trails, floods low tunnels | Mound height, nest depth, redraw trails |
| Rival raid | Summer, about 7:00 | 50 to 300 ants march down your strongest trail to your entrance and steal stored food | Guards, majors, soil walls, or a counter-raid on their nest |
| Rove beetle | Summer | Fast, armoured, walks along trails eating stragglers | Muster on it; cut that trail for 20 s |
| Toad | Autumn, rare | Sits near your entrance and catches ants that come out | Use a second entrance, or wait it out on stores |
| Frost | Late autumn | Ants on the surface slow, then stop | Bring everyone home in time |

The rivals are other ant colonies run by AI on the same rules as the player, not scripted waves. Three invented archetypes: **Rustbacks** (raiders, many majors), **Glassrunners** (fast scouts, small ants, steal from your trails), and **Mound-builders** (slow, huge walls, out-grow you). None is a real species.

**Decision: raid, wall, or out-grow.** A raid on a rival nest can steal its granary and kill its queen, ending it on this patch. It also strips your foragers and leaves your own trails open. This is hard because your scouts show you only part of their strength.

**Decision: trail exposure.** A long, busy trail feeds you well and leads raiders straight to you. Players can lay a **decoy trail** (draw a trail to nothing while holding Guard): rival scouts follow it into your guards. Rivals can do the same to you.

### 3.5 The map

A patch is about 160 × 160 surface cells over a nest layer 64 cells deep, under fog of war. Features: a log (rich protein, rivals near), a puddle that grows with rain, sand with antlion pits, clover flowers (summer sugar), and seed plants (autumn). The **meadow** campaign map is 15 patches in a ring around an old oak; neighbours share edges.

### 3.6 The Year and progression

A Year is the session unit. Spring 0:00 to 6:00, Summer 6:00 to 14:00, Autumn 14:00 to 20:00, Winter 20:00 to 22:00.

- **Winter** is a short resolution scene, not play. The colony needs one stored food unit per ant. Shortfall puts ants to sleep for good (they fade, no gore). The colony starts next spring with what survived plus its chambers.
- **Nuptial flight.** In late summer the brood dial can raise winged queens. Each costs ten protein and the brood slot. At the last day of summer they fly. On the meadow map the player sends each queen to a neighbouring patch. Next Year the player picks which colony to play; the others grow on simple rules off-screen and send a share of food to the main colony.
- **Traits.** Each flight offers three colony traits; the player picks one that all new queens carry. Examples: Long Legs (+20% speed, −15% carry), Thick Shell (+30% HP, slower brood), Sweet Tooth (repletes hold double), Deep Diggers (dig 2× faster, mound grows slower). Traits stack across Years: up to six per colony line.
- **Winning the meadow.** Hold the old oak patch through one full Year. A typical campaign takes 10 to 14 Years, about 4 to 5 hours.

**Decision: queens or survival.** Every winged queen is protein that did not become workers this summer. Too few and you have no spread. Too many and your home colony starves in winter.

**Chapter one** is Year 1 on the home patch, about 22 minutes. It ends with the first nuptial flight and winter tally. A passive player who draws two trails and never acts again still survives Year 1 with a small colony and a poor score, so every stranger can finish it.

## 4. Pace and session shape

- **A session is one Year**: 20 to 24 minutes. Winter ends it with a tally screen and a natural stop. Players can quit at any time; the game saves at each season change.
- **What brings the player back tomorrow:** their founded colonies wait on the meadow map, the next rival is half seen, and a **Daily Meadow** seed gives a comparable run.
- **Sandbox stays** as **Free Meadow** (any patch, 5,000 ants, rain and rivals optional). It was the owner's longest session.

### Bot-checkable pace targets (from replay logs)

All times are from session start unless stated. "Median play" means a scripted bot that draws a trail to the nearest visible food every 15 s and sets the job ring to 60/30/10.

| Metric | Target |
| --- | --- |
| First order | ≤ 3 s for the bot; ≤ 10 s for 80% of human sessions |
| First delivery | ≤ 8 s after the first trail order |
| Deliveries in minute 1 | ≥ 25 |
| First birth | ≤ 20 s |
| Births by 3:00 | ≥ 60 |
| Ant count, median bot | ≥ 100 at 3:00; ≥ 600 at 10:00; ≥ 3,500 at 20:00 |
| First threat in view | 60 to 90 s |
| First choice event (two sources with different trade-offs visible) | ≤ 45 s |
| Longest gap between decision events in minutes 0 to 10 | ≤ 30 s. A decision event is any of: new source revealed, source exhausted, threat in view, chamber full, rain warning, new unlock. |
| Same gap, minutes 10 to 20 | ≤ 45 s |
| Human orders per minute, minutes 1 to 10 | median ≥ 4; no 60 s window with zero orders in more than 20% of sessions |
| Idle workers | ≤ 15% of workers idle for more than 10 s at any sampled tick |
| Year length | 20 to 24 min |
| Year 1 survival | passive bot (two trails, then nothing) survives; random-order bot survives ≥ 90% of seeds |
| Raid outcome variance | rush bot vs greedy-economy bot: neither wins more than 65% across 200 seeds |

## 5. Friends by link

A host taps "Play with friends" and gets a link. No accounts. Friends join by opening it. One Durable Object per room runs the authoritative sim.

**Network model.** Keep the deterministic sim. The Durable Object collects inputs, stamps each with a tick, and broadcasts them. Clients run the same sim in lockstep with a 3-tick (150 ms) input delay, so local play feels close to instant. Every 100 ticks clients send per-subsystem hashes; on a mismatch the Durable Object sends its 60 KB snapshot and the client resyncs. Late join uses the same snapshot. If a player disconnects, an AI takes their colony on the archetype that best matches their play, and they can rejoin into it.

**Ant budget.** The 5,000-ant measurement is per world. Two players get a 2,500 cap each, three get 1,700, four get 1,250. If real-phone tests allow more (unmeasured, a guess), raise the world cap before splitting it.

**Modes:**
- **Shared Hill (2 to 4, co-op).** One colony against AI rivals. Each player draws trails in their own colour and owns one wedge of the job ring: one digs, one forages, one guards and raids.
- **Meadow War (2 to 4, versus).** One colony each on one patch. Shared scent makes trails the battlefield: follow a friend's trail to their food, lay decoys, cut routes. One Year; most stored food plus ants at winter wins, or last queen standing.
- **Daily Meadow table.** Async: same daily seed, scores and replays compared by link.

## 6. Why this is not "basic"

1. **Scent is shared ground.** Every colony reads every trail. A trail is a supply line and also a signpost to your nest. This makes trail drawing, the game's one core verb, carry offence, defence and deception: decoy trails, trail cuts, ambushes on busy routes. Other games in the genre give each colony private orders. SimAnt has pheromone trails, but the player cannot weaponise them against other colonies by design.
2. **The year is the session, and winter is the bill.** Every load is "now" or "winter". Every winged queen is "this colony" or "the next one". The season clock gives a beginning, a crisis and an ending to each 22-minute session, and stored food, chambers and flown queens carry over. This gives the short-session pace the owner wants and a five-hour arc.
3. **The nest is terrain, and water is real.** Rain is an integer cellular automaton on the same grid. Water runs down tunnels you dug and pools in low chambers. Dug soil builds your mound and walls. Nest shape becomes a defence decision under a clock, not a tile grid.

Under all three sits scale: a stranger reaches thousands of ants in their first session, which the evidence shows is what kept the owner playing.

## 7. Scope for an ambitious build

### On the existing sim

Keep it. Its determinism is what makes lockstep play and replay pace checks possible. The pace problem is in its numbers, not its design. Change: ant speed, brood timing, start state, trail capacity. Add: the integer water automaton (hashed as its own subsystem) and AI rivals on the player's rules.

### Milestones, in order

1. **Pace slice.** Home patch, minutes 0 to 5 as written in section 2, Field look, the full phone gesture set, rival scouts, one rain. Pace bot runs on every replay in CI and fails the build below target.
2. **Year 1, chapter one complete.** All four seasons, one AI rival (Rustbacks), raids, majors, repletes, seeds and granary, winter tally, nuptial flight to a stub meadow map. Five strangers play it cold; target: four finish.
3. **Meadow campaign.** 15 patches, three rival archetypes, all threats in section 3.4, traits, off-screen colonies, save and resume. Ember look.
4. **Friends by link.** Lockstep on Durable Objects, Meadow War first, then Shared Hill. Late join, disconnect AI, desync recovery.
5. **Depth and return.** Daily Meadow with score table, Free Meadow sandbox, shareable replays, difficulty settings.
6. **Finish.** Procedural audio that follows the swarm (density drives the sound), accessibility (colour-blind trails, larger targets), real-phone performance passes, the third look if wanted.

### Cut list, in the order I would cut

1. Shared Hill co-op (keep Meadow War).
2. Toad and frost threats.
3. Off-screen colonies sending food (flown queens become only map unlocks).
4. Traits reduced from 12 to 6.
5. Ember look (ship Field only).
6. Water automaton reduced to "rain wets cells below a depth; wet cells slow ants and stop brood". Keep the mound.
7. Four-player rooms (cap at two).

Never cut: the minute-one pace, shared scent, the season clock, the sandbox.

## 8. The five biggest risks and early tests

1. **Real phones cannot hold 5,000 ants.** The 70+ fps figure is from an emulated iPhone on a Mac. Test in milestone 1: Free Meadow at 5,000 ants on two real mid-range Androids and one older iPhone, 5 minutes, logging fps and tick time. Fallback: a 2,500 phone cap and density rendering for far ants.
2. **The gestures misfire under one thumb.** Draw versus pan by start point may confuse. Test: five strangers, no help, must draw, erase, muster and dig within 90 s. Count misfires in replays (an erase within 2 s of a draw, repeated pans near a trail).
3. **Fast growth snowballs and late Year goes dull.** Test: headless Node at 100× with greedy, rush, turtle and random bots over 200 seeds. Check win-rate spread, decision gaps in minutes 10 to 20, and that winter costs at least one strategy dearly in 30% of seeds.
4. **Water breaks determinism or the tick budget.** Test: build it first as its own hashed subsystem. 60-minute soak, rain every 3 minutes, 5,000 ants, all four runtimes. Pass: identical hashes, tick under 10 ms.
5. **Lockstep lags or desyncs on mobile networks.** Test before milestone 4: two clients, one on throttled 3G with packet loss, 20 minutes. Count desyncs, resync time and input delay. If players repeat taps, add local prediction for their own trail drawing only.

## 9. Questions only the owner can answer

1. **How do Field and Ember share the game?**
   - a. Field is the game; Ember is an optional look in settings.
   - b. Field by day and Ember by night: each summer has a 2-minute night where scent glows and rivals raid.
   - c. Field on the surface and Ember in the nest cutaway, always both on screen.
   - d. Field for solo campaign; Ember for Meadow War and the sandbox.
2. **How long should one session be?**
   - a. A 22-minute Year, as written.
   - b. A 12-minute Year (all timings halved, 8 to 10 Years still make a campaign of about 2 hours).
   - c. No fixed end: the Year runs on, saved at each season, and winter only happens when the player chooses to end it.
3. **What happens when the queen is lost?**
   - a. The colony ends; restart from the last winter save.
   - b. A daughter queen in the nest takes over if one was raised; otherwise the colony ends.
   - c. Roguelite: the colony line ends and the meadow resets, with traits as the only carry-over.

## Notes on independence

- Convergent with evidence.md: drawn trails, a pause that takes orders, the two looks, and a threat that targets busy trails (here it comes from rivals reading shared scent).
- Not used: the seed, husk and sprout opening, birds, one goal per day, the dusk card, Recall.
- Checked against the clean-room list. The job ring has three unnumbered wedges and no nursery feed.
