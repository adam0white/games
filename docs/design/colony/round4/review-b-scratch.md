# Meadowdeep: design

Working title only. This is a design for a phone-first ant colony strategy game in a browser. It builds on the existing deterministic simulation: 20 ticks a second, 5,000 ants, flow fields, three scent fields, WebGL2 instanced ants, rooms on Durable Objects.

## 1. What the evidence says, and the rule this design follows

The owner's colony sessions ended at 1 s, 12 s, 60 s, 69 to 120 s, 75 s, 92 s and 427 s. In every session the owner drew a trail in the first 2 to 3 s. Then nothing happened. First food came home 73 s later, or never. No ant was born. No threat came. The owner had nothing to decide.

The numbers explain it:

- Ants walked 1.9 cells/s. The store was 24 cells below the entrance. That leg alone took 24 / 1.9 = 12.6 s, before any distance on the surface.
- Egg to adult took 9.5 min = 570 s. No session except one lasted that long.
- The first threat came at about 12:30 = 750 s. No session reached it.

The one long session was the 5,000-ant sandbox: 17 min, 81 orders (one every 12.8 s), 2,122 deliveries (one every 0.49 s). The owner stayed when many ants moved, food poured in, and orders had visible results.

The rule: **every 10 s the player sees a new result of an earlier order, and every 30 s the game offers a new decision.** Section 6 turns this into checks a bot can run on replays.

## 2. Pitch

You are the scent of a colony. You draw trails with your finger, and thousands of ants follow them. In one summer of three days and three nights you grow a colony from 20 ants to a few thousand, take a meadow from rival colonies and large insects, and send a flight of winged queens into the evening sky. A run lasts about 12 minutes. Every run is a new meadow.

## 3. Core loop at three time scales

**Seconds (5 to 15 s): draw, watch, adjust.** Draw a trail to food. Ants stream along it within 2 s. Loads arrive home within 12 s. The queen lays, brood hatches, new ants join the trail. When a pile runs low, its marker pulses, and you draw to the next one.

**Minutes (one day plus one night, 4 min): grow, dig, defend.** In the day you forage, dig chambers and choose castes. At dusk the look changes from Field to Ember. At night rival colonies raid along the dark, and large creatures hunt. At dawn you pick one of three colony traits.

**Run (3 days, about 12 min): take the meadow, launch the flight.** Each day the meadow widens and threats grow. After the third night the colony spends its stored food on winged queens. The number of queens launched is the score. Queens launched unlock new traits and new meadow types for later runs.

## 4. The first five minutes, second by second

### Units and constants

- 1 cell is the world unit. 1 cell = 256 sub-units in the integer simulation.
- The surface map is 64 cells wide and 112 cells tall, which matches a 9:16 portrait screen. At default zoom a 360 px wide phone shows 32 cells across, so 1 cell = 11.25 px.
- Worker speed unladen: 51 sub-units a tick. 51 × 20 = 1,020 sub-units a second = 3.98 cells/s. Call it 4 cells/s.
- Worker speed laden: 38 sub-units a tick. 38 × 20 = 760 = 2.97 cells/s. Call it 3 cells/s.
- Speed in tunnels: same as surface.
- Pick up and drop: 10 ticks each = 0.5 s.
- The nest entrance is at (32, 92), 20 cells above the bottom edge. The store chamber is 6 cells down the shaft. 6 / 3 = 2 s laden.
- The nest is a cutaway shown in the bottom quarter of the screen, always visible. The surface fills the top three quarters. The player never switches views to see the nest.

### Food piles on the starting meadow

| Pile | Distance from entrance | Loads | Round trip |
| --- | --- | --- | --- |
| A, spilled seeds | 16 cells north | 60 | 16/4 + 0.5 + 16/3 + 2 + 0.5 = 4 + 0.5 + 5.33 + 2 + 0.5 = 12.3 s |
| B, a fallen berry | 30 cells north-east | 120 | 7.5 + 0.5 + 10 + 2 + 0.5 = 20.5 s |
| C, a dead moth | 44 cells west | 200, needs 4 carriers | see below |

With all 20 workers on A: 20 loads / 12.3 s = 1.63 loads/s. A lasts 60 / 1.63 = 37 s.

### Economy constants

- Egg cost: 4 food.
- Egg to adult: 6 s egg + 14 s larva = 20 s. That is 570 / 20 = 28.5 times faster than the old build.
- Queen lay rate: 1 egg per 3 s while the store holds 4 or more food. That is 20 eggs/min and costs 20 × 4 = 80 food/min = 1.33 food/s. 20 workers on A earn 1.63 food/s, so the starting colony can feed its queen with a margin of 0.3 food/s.
- Each nursery chamber adds 1 egg per 3 s. The first nursery is free at start. Each later one must be dug.
- Digging: 1 cell per 2 s per digger. A chamber is 6 × 4 = 24 cells. 8 diggers dig it in 24 / 8 × 2 = 6 s.

### Start state

20 workers in the nest. The queen. 30 food in store. 3 larvae that become adults at 8 s, 16 s and 24 s. One scout already stands at pile A, and a faint trail runs from A to the entrance. A new player who does nothing still sees food come home.

### Timeline

| Time | What happens | Numbers |
| --- | --- | --- |
| 0:00 | Field look. Camera centred on the entrance. Pile A glows. The faint scout trail pulses once. One line of text: "Drag from the nest to food." | |
| 0:00 | Queen lays egg 1. | Store 30 - 4 = 26 |
| 0:01 | Five workers already follow the faint trail without any input. | |
| 0:02 to 0:03 | Player drags from the entrance to A. The trail becomes bright. All 20 workers leave within 1 s. | Exit rate 20 per second through the entrance |
| 0:03 | Queen lays egg 2. | Store 22 |
| 0:05 | First of the 5 early workers reaches A (left at 0:01, 16 cells / 4 = 4 s). | |
| 0:05.5 | Picks up. | |
| 0:06 | Queen lays egg 3. | Store 18 |
| 0:07 | Main group reaches A (left at 0:03, + 4 s). | |
| 0:08 | Larva 1 becomes an adult. First birth. A small chime. Population 21. | Old build: never |
| 0:10.8 | First laden ant reaches the entrance (5.5 + 16/3 = 5.5 + 5.33). | |
| 0:12.8 | First load enters the store (+ 2 s down the shaft). Counter ticks up. | Old build: 73 s after the trail |
| 0:13 to 0:16 | The five early ants deliver. Store climbs. The main group is on its way home. | |
| 0:16 | Larva 2 becomes an adult. Population 22. | |
| 0:15 to 0:18 | Main group delivers: 15 loads in about 3 s. | Store about 30 |
| 0:20 | Egg 1 (laid 0:00) becomes an adult. From now on one adult every 3 s while food lasts. | |
| 0:24 | Larva 3 hatches. Population 25. | |
| 0:30 | First decision prompt: "Dig a second nursery?" A ghost chamber appears in the cutaway. Tap to place. | 8 diggers × 6 s |
| 0:36 | Second nursery done. Lay rate now 2 eggs per 3 s = 40 eggs/min = 2.67 food/s. Income from about 30 workers on A is 30 / 12.3 = 2.44 food/s. Store now drains slowly. The player must add workers to food or slow the queens. | |
| 0:40 to 0:45 | Pile A runs out (60 loads). Its marker shrinks and pulses. Ants on the dead trail mill and drift back. | 60 loads at about 1.9 to 2.4 loads/s = about 30 s of real flow |
| 0:45 | Player drags to B (30 cells). | Round trip 20.5 s |
| 0:53 | First ants reach B (30 / 4 = 7.5 s). | |
| 1:03 | First load from B in store (7.5 + 0.5 + 10 + 2). | |
| 1:00 | A ground beetle walks across the trail to B. It is prey, not a raider. Ants near it stop and bite. | Beetle 40 hp. Worker bite 1 hp/s. 10 ants kill it in 4 s. The beetle shoves 1 ant aside every 2 s; shoved ants are stunned 3 s, not killed |
| 1:05 | Beetle down. It becomes a 40-load carcass. 8 ants lift it together and walk it home at 1 cell/s. 18 cells away, so 18 s. | First group carry: a showpiece |
| 1:10 | Population about 40 (25 + 15 born since 0:20 at 1 per 3 s, then 2 per 3 s after 0:56). | |
| 1:23 | Carcass in store. +40 food. | |
| 1:30 | Rival scouts: 6 red ants from the east edge, 50 cells away, walking 4 cells/s. They arrive in 12.5 s. A red edge marker shows where. | First hostile at 1:30. Old build: 12:30 |
| 1:30 | Second decision: caste dial unlocks. The player can set a share of eggs to soldiers. Soldier: 8 food, 20 s to adult, 3 cells/s, 3 hp, 3 hp/s bite. Worker: 1 hp, 1 hp/s. | |
| 1:42 | Rival scouts reach the trail. If the player draws a war trail (hold then drag) to them, about 15 workers meet 6 scouts. Workers win in about 3 s. Each defeated ant curls up and fades into the soil. Each rival scout leaves 2 food. | |
| 2:00 | Population about 70. Store 40 to 80. | |
| 2:00 | Third decision: pile C, the moth, 44 cells west. 200 loads, but each piece needs 4 carriers at 1.5 cells/s. One 4-ant team round trip: 44/4 + 1 + 44/1.5 + 2 = 11 + 1 + 29.3 + 2 = 43.3 s per 4 loads. 40 ants on C = 10 teams = 40 loads per 43.3 s = 0.92 loads/s. Worse rate than B but far larger, and its trail runs past the rival's side. | |
| 2:20 | Rain starts (the game shows clouds 20 s before). Rain washes scent: all trail strength halves every 5 s. The shaft floods if the entrance has no mound. Decision: dig a mound (12 cells, 8 diggers, 3 s) or reroute through a second entrance. | |
| 2:40 | Rain ends. Trails need redrawing. | |
| 3:00 | Dusk. The look fades from Field to Ember over 4 s. Ants and scent glow. Vision outside trails drops to 12 cells. | Night lasts 1 min |
| 3:10 | Rival raid: 40 red workers and 8 red soldiers along a single trail toward the entrance. Path 50 cells at 4 cells/s, so they arrive about 3:23. Edge marker from 3:10. | Rival force strength 40 × 1 + 8 × 9 = 112 (hp × bite). Player at 3:00 with about 90 workers and 10 soldiers = 90 + 90 = 180 |
| 3:23 to 3:35 | Battle at the mound. A war trail from the entrance to the raid sends defenders. | |
| 3:45 | A wolf spider walks in from the south. 300 hp, bite stuns 1 ant a second. 60 workers need 300 / 60 = 5 s of bites if they all reach it. It drops 150 food. Ignore it and it eats 1 stored food a second until driven off with a keep-out scent. | A big prize at night |
| 4:00 | Dawn. Field look returns. Day summary on one line: food in, born, lost. Trait draft: pick 1 of 3 (examples in section 5). | |
| 4:00 to 5:00 | The meadow widens by 16 cells on each side. A second rival nest is revealed. A fallen leaf (fungus garden trait) or a puddle (raft trait) appears. Population passes 150. | Target at 5:00: 150 to 400 |

### How population reaches thousands

The per-worker economy is food income about 1/16 load/s, and an egg costs 4. So one worker funds one new ant every 64 s, plus 20 s to grow. Without caps the colony doubles about every 64 × ln 2 + 20 = 44 + 20 = 64 s. Caps come from nursery count and food distance. Planned path: about 150 at 5:00, about 600 at 8:00, 1,500 to 3,000 at 12:00. The hard cap is 5,000, which the simulation already handles. Rivals use the same rules, so a rival nest left alone also grows.

## 5. Systems

**Scents.** The simulation has three scent fields. They are named by meaning, not numbered:
- Food scent (amber in Field, gold in Ember). Drag from nest to target. Workers forage along it.
- War scent (red). Hold 0.4 s, then drag. Soldiers and nearby workers attack along it.
- Keep-out scent (blue). Two-finger tap or a button. Ants avoid the area. Use it to steer around a spider or a flood.

Scent fades: food scent halves every 30 s unless ants walk it. Ants walking it refresh it. So busy trails stay and dead trails vanish without cleanup.

**Orders other than scents.** Rally: tap and hold on the map for 1 s; all idle ants within 20 cells go there. Recall: one button; everyone comes home. Dig: tap a ghost room in the cutaway. Caste dial: a ring around the queen icon with up to four castes; the queen lays in that ratio.

**Castes.** Worker (cost 4, 1 hp, carries 1). Soldier (cost 8, 3 hp, 3 hp/s bite, slower). Major (unlock by trait; cost 16, 6 hp, carries 4, can cut leaves and break stems). Scout (trait; cost 3, 6 cells/s, lays food scent itself when it finds food, which automates small piles).

**Chambers.** Nursery (+1 egg per 3 s), store (+200 capacity; base 150), soldier barracks (soldiers rest and heal 1 hp per 5 s), garden (needs leaves; turns 1 leaf into 3 food over 30 s), and mound (blocks floods, +50% defence at the entrance). Each chamber is 24 cells of digging. Tunnels connect them along flow fields, so a deep nest costs travel time. That is the trade-off that replaces the old fixed 24-cell store.

**Creatures.** All are animals doing animal things. No named boss class. Ground beetle (prey, 40 hp). Caterpillar (prey, slow, 120 hp, 100 food, damages nothing). Wolf spider (night hunter, 300 hp). Antlion pit (a fixed hazard that pulls ants in; a keep-out trail around it is the answer). Bird shadow (day, rare: picks up 10 ants on the surface at a marked spot after a 5 s warning; ants underground are safe). Defeat is shown as a curl and fade, or as an ant tumbling away. Nothing bleeds.

**Rival colonies.** Each rival is a full colony in the same simulation, driven by a simple planner: forage the nearest pile, raid when its army strength is 1.5 times the target's guard at the target's entrance, retreat below 0.6. Taking a rival nest gives its store and opens its tunnels.

**Weather and day cycle.** Day 3 min, night 1 min. Rain once per day at a random time between 1:00 and 2:30 into the day, lasting 20 s, with a 20 s warning. Field look by day, Ember look by night. Both looks the owner liked are now two halves of every day.

**Traits.** At each dawn pick 1 of 3 from a pool of about 30. All come from real ant behaviour: living bridges (ants link over water), rafting (colony survives floods), acid spray (soldiers hit at 2 cells), honeypot ants (store capacity +100%), fungus garden, aphid herding (aphids on stems give 1 food per 10 s if guarded), trap-jaw (soldiers stun), supercolony (second queen), and so on. Traits stack, so runs differ.

**Score and end.** After night 3, a 30 s flight. Each winged queen costs 50 food and 1 nursery slot. The camera rises as they lift off in the evening light. The score is queens launched. Losing: if rivals or creatures reach the queen chamber and hold it for 10 s, the colony scatters and the run ends with a summary. There is no lose before 3:00, so new players learn.

**Meta.** Queens launched across runs unlock traits, castes and meadow types (pond edge, garden bed, sandy dune, forest floor). No currency for sale. No account; progress is stored in the browser, with an export code.

**Controls.** One finger draw, two finger pan and pinch zoom. Every order also has a large button for one-hand use. Desktop: mouse draw, wheel zoom, keys 1 to 3 for the three scents.

**Readability at 5,000 ants.** Instanced ants stay at 2 to 4 px. Above 60 ants in a 4 × 4 cell area the renderer adds a soft flow ribbon in the scent colour so the stream reads as a river. Loads are a bright dot on each ant. Hostile ants are red in both looks. Counters for food, population and brood sit in a single top bar.

## 6. Pace targets a bot can check from replays

Each replay is a seed plus a list of tick-stamped orders. A headless runner replays it and logs events. These are the checks:

| Check | Target | Old build |
| --- | --- | --- |
| First load in store, no input | ≤ 15 s | never |
| First load in store after first food trail | ≤ 12 s | 73 s or never |
| First birth | ≤ 10 s | never |
| First creature on the screen | ≤ 75 s | 750 s |
| First hostile ant | ≤ 100 s | none |
| Longest gap with no new event on screen (birth, delivery batch, creature, prompt, depletion) | ≤ 10 s | long gaps |
| Longest gap between decision prompts | ≤ 45 s | no prompts |
| Population at 5:00 for the reference bot | 150 to 400 | 20 |
| Population at 12:00 for the reference bot | 1,500 to 3,000 | n/a |
| Share of ant-ticks idle (no trail, no task) after 0:30, reference bot | ≤ 25% | not logged |
| Deliveries per minute at 5:00, reference bot | ≥ 300 | n/a |

Four bots run every build on 200 seeds:
- **Idle bot** gives no orders. It must see first food home by 15 s and lose by about 5:00 to the first big raid. This proves the game has stakes and that the opening plays itself enough to teach.
- **Greedy bot** always trails the nearest food and never fights. It must lose between 3:30 and 8:00.
- **Reference bot** trails the best food by rate, digs a nursery when the store passes 60, keeps 15% soldiers, war-trails raids. It must launch 5 to 15 queens.
- **Strong bot** adds traits by a fixed priority list and takes rival nests. It must launch more than the reference bot on at least 80% of seeds, so skill matters.

Owner-session targets (from real replays, not bots): median session ≥ 5 min; orders per minute 6 to 15; no gap with no order longer than 30 s unless the player is watching a fight.

## 7. Session shape

- **Run:** 3 days, 12 min. Pausable. Leaving the tab pauses solo games.
- **Quick run:** 1 day plus the flight, 5 min, for a short phone moment.
- **Endless meadow:** the sandbox the owner already played for 17 minutes, now with creatures and rivals that scale. No score, no end.
- **Daily meadow:** one fixed seed per day for everyone. Score shown beside friends' scores.

A run opens in under 3 s on a phone: the 60 KB snapshot of the opening state loads with the page.

## 8. Friends

Rooms are made by link. No account; each player picks a name and an ant colour.

- **Co-op colony.** Two to four players share one colony and one queen. Each player's trails show in their own tint, so it is clear who drew what. Any player can draw any scent. This is the best first friends mode because it needs no balance.
- **Rival meadow.** Two to four colonies on one larger map, 96 × 168 cells. Same day and night. Score is queens launched, and taking a rival queen chamber ends that player's run but they keep watching.
- **Daily meadow race.** Asynchronous. Same seed. Friends see each other's ghost trails on the replay.

Network: lockstep on the existing simulation. Each order is sent to the room's Durable Object, which stamps it for tick now + 3 (150 ms) and broadcasts it. All clients run the same ticks. Every 100 ticks (5 s) each client sends a state hash. On a mismatch the Durable Object sends a fresh 60 KB snapshot from the client that matches the majority, or from its own headless copy. A late joiner gets the snapshot and the order list since it. A player who drops is replaced by the reference bot until they return.

## 9. Why it is not basic

- Every 10 s something new happens, and every 30 to 45 s there is a choice. The old build had one choice in a session.
- There are five kinds of order (three scents, rally, recall) plus digging and caste mix, and each has a clear use against a clear problem.
- Food comes in kinds: piles, prey that must be fought, large prey that needs group carries, leaves that need a garden, aphids that need guards.
- Threats come in kinds: rival raids at night, hunters, hazards, birds, rain. Each has a different answer.
- Rivals are real colonies with the same rules.
- Day and night change what is safe, using both looks the owner liked.
- Traits make each run different, and the meta unlocks new meadows.
- Spectacle: thousands of ants, glowing streams at night, a hundred ants carrying a caterpillar home, a nest that grows down the cutaway, a flight of queens at the end.

## 10. Scope and milestones, in order

1. **Pace pass on the existing build.** New speeds, store at 6 cells, 20 s brood, start with scout trail and larvae, beetle at 1:00. Add the replay event log and the idle bot. Done when the first five checks in section 6 pass on 200 seeds.
2. **Portrait layout and controls.** Surface plus nest cutaway on one screen, the three scents by gesture and by button, rally and recall. Done when a new tester on a phone draws a working food trail within 10 s without help in 4 of 5 tries.
3. **Economy and nest.** Queen, nurseries, store, digging, castes worker and soldier, caste dial. Reference bot reaches 150 to 400 at 5:00.
4. **Combat and creatures.** Bites, stun, curl-and-fade, beetle, caterpillar, spider, antlion, group carry. Tick stays under 10 ms with 5,000 ants and 200 fighting.
5. **Rival colonies.** Planner, raids, taking a nest. Greedy bot loses between 3:30 and 8:00.
6. **Day, night, weather.** Field and Ember transitions, rain and floods, night vision radius.
7. **Run structure.** Three days, traits at dawn, flight, score, summary. Reference bot launches 5 to 15 queens.
8. **Readability at scale.** Flow ribbons, counters, edge markers. Screenshot test in section 11 passes.
9. **Co-op rooms.** Lockstep on Durable Objects, hash checks, snapshot resync, bot fill-in.
10. **Rival meadow and daily meadow.**
11. **Content breadth.** Thirty traits, four meadow types, majors, scouts, gardens, aphids, birds.
12. **Polish.** Sound, haptics on phone, first-run hints, accessibility (colour-blind safe scent tints, larger buttons option).

## 11. The five biggest risks and the test for each

1. **It is still slow.** The new numbers may look fast on paper but feel slow on a phone. Test: the pace checks in section 6 on every build, plus five owner sessions on a phone after milestone 3. Pass if the median session is 5 min or longer and the owner does not say "slow".
2. **Trails are hard to draw on a phone.** A thumb covers 4 to 5 cells at default zoom. Test: a target task with 20 random food piles; the player draws a trail to each. Pass if 90% of trails connect on the first try and median draw time is under 2 s.
3. **Thousands of ants become noise.** The player cannot read where the army is or who is winning. Test: show 20 screenshots from mid-game replays for 3 s each. Ask "where is the main fight?" and "is food coming in?". Pass at 80% correct.
4. **Performance on a mid-range phone with combat and creatures.** The 10 ms budget was measured without fights. Test: a fixed worst-case scene (5,000 ants, 500 fighting, 6 creatures, rain) on the slowest target phone. Pass at under 10 ms a tick and 60 fps for 2 min, with no thermal drop below 45 fps.
5. **Desync in rooms after new systems.** Combat and rival planners add many integer paths. Test: 1,000 seeded replays run on Chrome, Safari and Firefox, desktop and phone, comparing hashes every 100 ticks. Pass at zero mismatches. Also a fault test: drop one client for 20 s mid-battle and check the snapshot rejoin matches.

## 12. Questions only the owner can answer

1. **How long should the main run be?**
   a) 5 min, one day and one night.
   b) 12 min, three days (this design's default).
   c) 20 min, five days, closer to the 17-minute sandbox session.
   d) Player picks each time.

2. **How do the two looks map to play?**
   a) Field by day, Ember by night, always (this design's default).
   b) Player picks one look for the whole run.
   c) Meadow type sets the look: Ember for forest floor and caves, Field for open meadows.

3. **How should creatures look?**
   a) Close to real insects, drawn clean and bright.
   b) Rounder and softer, with big readable shapes, more toy-like.
   c) Real shapes in the Field look, glowing outlines in Ember.

4. **How harsh is losing?**
   a) The colony can be wiped out from 3:00 on; the run ends (default).
   b) No wipe-out; losses only lower the score.
   c) Wipe-out only on a "hard meadow" setting.

5. **Which friends mode comes first?**
   a) Co-op colony (default; least balance work).
   b) Rival meadow, head to head.
   c) Daily meadow race, asynchronous.

6. **What does the player carry between runs?**
   a) Unlocks only: traits, castes, meadow types (default).
   b) Nothing; every run starts equal.
   c) Unlocks plus a small starting bonus chosen before each run, such as +10 workers.
