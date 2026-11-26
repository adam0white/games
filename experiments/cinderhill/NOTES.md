# Cinderhill: notes

Working name for the ant colony game specified in `docs/design/colony/`. This directory holds the M0 work: the deterministic sim core, its tests, the spikes and the trail painter. `/cinderhill/` is the trail painter (M0 roadmap item, spike S3); the determinism check page moved to `/cinderhill/check.html`.

## What exists (2026-11-25)

| Path | What it is |
| --- | --- |
| `sim/` | The pure sim: plain ES modules, no dependencies, no build. Runs unchanged in Node, browsers and workerd |
| `sim/sim.js` | `Sim`: the tick (20 a second), ants as typed arrays, commands, events, `hashes()` |
| `sim/grid.js` | Both layers as one cell index space; materials; entrance links |
| `sim/flow.js` | Flow fields: octile shortest distances per live goal (16 slots; orthogonal step 5, diagonal 7, entrance link 5) by a bucket queue, rebuilt only when a change touches them |
| `sim/scent.js` | Three scent fields (trail, food, alarm): mass-conserving spread, 24-bit decay with a set half-life |
| `sim/math.js`, `sim/rng.js`, `sim/hash.js` | Table trig and integer `angleOf`; mulberry32 streams; 32-bit hashes |
| `sim/snapshot.js` | `snapshot(sim)` to bytes with a version header, `restore(bytes)`; format 4 models each value and range-codes it (S4: 60.7 KB at 5,000 ants, 24,000 ticks) |
| `sim/rangecoder.js` | The binary range coder the snapshot uses: adaptive probabilities, integers only, one walk for both directions |
| `sim/replay.js` | `script(cfg, ticks)` (scripted orders), `replay(...)`, `firstDivergence(a, b)` |
| `sim/world.js` | Seeded terrain: surface with stones, a pond and four food piles; nest with soil bands, shaft and chamber |
| `sim/SPIKES.md` | Spike results S1, S2, S3 and S4 with numbers |
| `test/` | `node --test` suites; CI runs them in the `changes` job (step "Cinderhill sim") |
| `spikes/` | S1, S2, S3, S4, the trail-shape cases (`trail-shape.mjs`) and the workerd harness; the planted fault `mutant.js` |
| `check.html`, `check.js`, `quick.js` | The determinism check page; the phone check runs the short and the long check in WebKit and Chromium (`cinderhill check`), and `test/page.test.mjs` checks both expected totals in Node. `quick.js` holds the short check (`EXPECTED`) and the long one (`LONG`, `EXPECTED_LONG`: S2's 12,000 ticks of 2,000 ants), which the page runs in slices and reports as one copyable line |
| `index.html`, `painter.js` | The trail painter page: menu, pause card, tool strip, HUD, the ant card, the frame sampler (`?fps=1`) |
| `host.js` | Runs the sim for the page: 20 ticks a second from the frame clock (at most 4 a frame), the command log, crews and the "why" for one ant |
| `gestures.js` | The touch rules as a pure reducer (pointer events in, preview, order, alarm, pan and zoom actions out); `test/gestures.test.mjs` |
| `render.js` | WebGL2: the ground as one full-screen pass (terrain and scent as textures), ants as one instanced draw with a procedural body, interpolated between ticks; context loss and restore |
| `words.js` | English and Turkish words (the Turkish is not checked by a native speaker) |
| `sim/colony.js` | The colony: queen, brood, sugar and protein, castes, hit points, teams and the fight hook (section below) |
| `bots.mjs` | Three ways to play a colony game for three days (careful, greedy, idle): `node experiments/cinderhill/bots.mjs [seeds] [ticks]` |

## Rules the sim keeps

- Integers only in the state. Positions are 1/256 cell in `Uint16`. Angles are 0..255 with table sine and cosine.
- `test/lint.test.mjs` rejects floating-point `Math` functions, `**`, `Date`, `performance`, locale calls, `crypto` and `.sort()` without a comparator anywhere in `sim/`.
- Everything that changes is in `hashes()` (subsystems: ants, scent, terrain, flow, rng, events, globals) and in `snapshot()`. The one exception is the flow distances, which restore rebuilds. They are hashed, so a wrong rebuild shows.
- Commands apply at the start of their tick in (tick, seat, id) order. A command for a past tick is refused with a `LATE` event.
- Random numbers come from separate streams (world, ants, spare), so a new draw in one place does not shift another.

## How to run

```
node --test experiments/cinderhill/test/                         # all tests, about 20 s (the S4 size test plays 8,000 ticks of 5,000 ants)
node experiments/cinderhill/spikes/s1.mjs 2000 5000              # S1 tick cost in Node
PLAYWRIGHT=<dir with playwright> node experiments/cinderhill/spikes/s2.mjs   # S2 Node and browsers
node experiments/cinderhill/spikes/s4.mjs [--ants=5000] [--ticks=8000]   # S4 snapshot size
node experiments/cinderhill/spikes/workerd.mjs                   # S1 and S2 in a local Durable Object (needs wrangler)
PLAYWRIGHT=<dir> node experiments/kit/check/phone.mjs cinderhill # both pages in WebKit and Chromium, and the command-log check
PLAYWRIGHT=<dir> node experiments/cinderhill/spikes/s3.mjs        # S3 frame times in emulated phones
```

The painter takes `?ants=500|2000|5000`, `?colony=1` (a colony game) and `?fps=1` (frame, work and sim tick times on screen, for a real phone).

## The trail painter (2026-11-25)

Touch rules (02-spec 6.4), in `gestures.js`:

- One finger draws. The stroke is a local preview; it becomes one order when the finger lifts.
- A second finger ends the stroke with no order and starts a pinch (zoom and pan). The fingers that were down stay "dead" until all have lifted, so lifting one finger of a pinch never draws.
- `pointercancel`, `lostpointercapture`, a layer switch, a tool switch, a pause (blur, pagehide, the pause key) and an ant count change each end a stroke with no order.
- Alarm: a still single finger held 300 ms starts the alarm (an order with hold 400 ticks); it is renewed every 10 s while held, and the lift sends hold 1 to end it. So one alarm is two orders. A second finger before 300 ms gives none.
- Dig: on the nest layer only, a 3 x 3 brush along the stroke, at most 256 cells an order (the sim's cap).
- The Move tool, a mouse's right or middle button, and two fingers pan. A tap with any tool inspects the nearest ant, unless "trail by two taps" is on (pause card).

The phone check `cinderhill orders` plays pinches and two-finger pans mid-stroke, a pointercancel, a layer switch and a pause mid-stroke, and alarm and dig pinches, and asserts the log holds only the intended orders. On Chromium it repeats a pinch and a stroke as real touches (DevTools protocol). It fails when the page ignores `pointercancel` or when a second finger does not end the stroke (both tried).

Decisions:

- The sim runs on the main thread (S3: a few ms a tick on an M4 Mac). A Worker waits for a real phone to show long frames.
- Ant crews were counts only until sim 7; crews (below) add a crew size per trail.
- The page sets up the colony: 17 in 20 ants forage, 2 dig, 1 guards; seven in ten foragers start on the surface near the entrance with staggered time out. The sim's rules are not changed by this.
- Sim change: foragers keep following the newest trail while they are on it. Before, a forager dropped any trail 30 s into her trip, so a trail longer than about 30 cells never reached its food (2,000 ants, trail to pile 3: 51 seeds picked by tick 1,600 before, 592 and the pile emptied after). This changed the hashes (`quick.js`, S2 re-run).
- Saved: `cinderhill:save` `{ v: 1, sound, ants, tapTrail }` and `cinderhill:hint`. Written on a setting change or the first Play.

- Sim change (`SIM_VERSION` 2): trails keep their drawn shape. The stroke becomes an ordered path, and the trail's field leads along it in order. Carriers walk their trail back, and a forager keeps her trail as her route. Before, ants walked the straight line to a trail's end. Numbers are in `sim/SPIKES.md`, "Trail shape", and the cases are in `spikes/trail-shape.mjs`.

- Sim change (`SIM_VERSION` 3, 2026-11-26): ants move in eight directions. Owner feedback: guards could not move diagonally. Numbers are in `sim/SPIKES.md`, "Eight directions". The rules:
  - Fields are octile distances: an orthogonal step costs 5, a diagonal 7, an entrance link 5. The constants are `STEP` and `DIAG` in `flow.js`. Thresholds that compared a distance to a cell count now multiply by `STEP` (`FAR`, the guard's reach).
  - A field takes a diagonal only when the target and both side cells are open (`grid.js` `diagOpen`), so a path never cuts a wall's corner.
  - Movement is more lenient: a step across a cell corner is refused only when both side cells are closed (two walls touching at a corner). With the strict rule, crowds jammed at the chamber and shaft mouths (bot run: 27 ants stuck for good, longest stall 2,983 ticks).
  - Opening a cell repairs each field in place (lower the cell and its eight neighbours, then settle). Closing a cell marks touched fields for a full rebuild, as before.
  - Trail paths are 8-connected. On the path the field holds path steps (one a step, not 5 or 7). An ant on the path goes to the path cell holding one less, so a bend that comes back beside an earlier cell is still walked in order. Off the path the field is 4,096 plus the octile distance to the path, and an ant joins at the nearest path cell.
  - Distances are `Uint16`, so a field covers at most 13,106 straight steps of one winding corridor. The maps here are far below that; it is a limit, not a guard.
  - Separation pushes along the line between two ants, with the distance estimated as the larger gap plus 3/8 of the smaller one.
  - A stuck ant (no progress for 50 ticks) turns a random way once every 30 ticks and wanders for 8 of them, then steers again. Before, it drew a new random heading every tick.
  - Unchanged: scent spreads to 4 neighbours; the three scent sensors already sample any angle.
  - Snapshot format 3 codes an ant's last cell among the 8 neighbours and the link. Version 2 snapshots are refused, as the rule for a sim version change says.
- The page: the `?fps=1` sampler sits in the HUD column, so it no longer covers the status and crew lines on a phone (`cinderhill hud` in the phone check, 360 x 640 in Turkish at 5,000 ants). Ants hold an idle pose when they did not move since the last tick, with a small antenna twitch; all ants hold still while paused.

Not built: undo (the sim has no erase order), the small view of the other layer, an "ants wanted" number.

When a sim change alters play, `test/page.test.mjs` fails and prints the new hash to put in `quick.js`.

## The colony (M1, SIM_VERSION 4, 2026-11-26)

`sim/colony.js` adds the queen, brood, two foods, castes and a fight hook. It runs only when `cfg.colony` is set: `/cinderhill/?colony=1` on the page, `bots.mjs`, `test/colony.test.mjs`. Without it the page is the trail painter sandbox as before (`?ants=`, the count buttons, the saved count); only the hashes changed, because they now cover the new fields.

Rules (numbers are first guesses, tuned with `bots.mjs`; constants in `colony.js` `C`):

- Piles alternate: even piles are sugar, odd piles protein (`world.js`). A load home adds 4 sugar or 2 protein to its store. `G.STORES` still counts loads.
- The queen lays one egg per unit of sugar every 240 ticks; every 120 at 50 sugar in store, every 60 at 200. At a flat 240, laying capped growth at 50 eggs a day and a careful player grew no faster than an idle one on a map where wandering finds both foods.
- Egg 3,000 ticks; larva eats one protein every 1,200 ticks and pupates after 3 meals, or after 5 meals (a major) when 20 protein is in store; a larva with no meal for 6,000 ticks dies; pupa 4,800 ticks. Egg to worker is 11,400 ticks, about one day.
- Adults are born where the pupa lay. Jobs go by birth order: 7 in 10 forage, 2 dig, 1 guards.
- Adults eat one sugar per 10 ants every 1,200 ticks. A missed meal is counted (`G.HUNGRY`); no adult starves yet.
- A colony game starts with 20 workers in the chamber, 40 sugar and 4 larvae (`colony.js` `START`).

Battles are not built. The sim is ready for them: every ant has a caste (worker 12 hit points, bite 2; major 30 and 5), hit points, a team and a bite cooldown. `fight()` runs once a tick after all ants have moved. Each ant whose cooldown is over bites the first enemy within 160 sub-cell units on her layer, then waits 10 ticks. An ant at 0 is removed at the end of the tick and the rest keep their order (`removeDead`). A digger who dies frees her place in the dig crew. With one team on the map the pass only counts cooldowns down.

Two independent reviews (Codex, gpt-6.2-astra, read-only) of earlier versions found, and this version fixes: a death pending at a snapshot was lost on restore; the hash did not cover the population cap (which decides whether the queen lays); a chamber left of a narrow nest restored to the wrong place (the header is unsigned); bites reached past the touching distance and across the entrance, standing ants never bit, and a death gave the next ant two bites in a row (the bite beat came from the array index); the sandbox carried protein; a larva starved one tick late; the page drew the ants after a dead one from the wrong place. The second review added: the hash missed the layer sizes; a caller could change the scent settings after the sim was made; starting ants could spawn outside a narrow nest; a queen with no open cell lost her laying turn; diagonal bites reached past the touching distance; the page kept a stale ant card after a death. The dig-crew leak was found before the reviews. `test/colony.test.mjs` covers each sim fix and the host's renumbering; the pending-death, dig-crew and sandbox-carry tests were checked to fail without their fix. The page's ant card has no automated test.

Snapshot format 4 codes pile kinds, caste, hit points (as damage taken), team, and the brood (stage, age, meals, hunger, cell as a step from the last one).

Choices the owner may want to change: the start (20/40/4), sugar and protein per load, faster laying on rich sugar, adults never starving, majors from protein surplus rather than a caste dial (02-spec 6.3 names a dial), jobs by birth order, piles alternating by index.

Bots after three days (`sim/SPIKES.md`): careful 130 to 153 ants, greedy (sugar only) 20, idle 20 to 94. Idle play does not lose on every map: adults never starve and there is no goal yet. Days (below) now give idle play a goal it fails.

Foraging two foods needs crews split between trails. Seekers take the newest trail and keep their route, so the careful bot redraws to the scarcer food every 1,500 ticks. Crews (sim 7, below) are the spec's crew plus and minus (02-spec 6.4).

The page draws the queen and brood as placeholder shapes in the nest view; the HUD shows ants, sugar, protein and the brood by stage. A newborn ant is drawn without interpolation on her first tick. When an ant dies the later ants move down one index, so that tick is drawn without interpolation and the selected ant is let go.

## Days (M1, SIM_VERSION 5, 2026-11-26)

A colony game (`?colony=1`) is played in days of 12,000 ticks (ten minutes; `?day=<ticks>` shortens them for testing, 100 to 100,000). Each day has one goal, shown on a dawn card and on the HUD's goal line. The sim judges it at dusk, the last tick of the day (`colony.js`, section Days; `stepDay` runs after everything else in that tick). Progress counts from dawn, so a day cannot be won with yesterday's work.

| Day | Goal | Target | Why it needs the player |
| --- | --- | --- | --- |
| 1 | Loads brought home along a drawn trail | 40 | A load counts only if a trail led the forager out to it (`via` set). Loads found by wandering do not count. |
| 2 | Cells dug | 40 | Diggers dig only marked cells. |
| 3 | Loads of both foods, the smaller count | 60 each | Seekers take the newest trail, so both foods need trails to both. |
| 4 and later | Both foods | 60 + 30 a day | |

- A lost day: the colony keeps what it has, and the next day's goal is eased by a quarter (`target - target/4`).
- The floor (02-spec 6.9): at every dawn, a colony with fewer than 20 ants or under 10 sugar gets 20 sugar, won or lost.
- The page stops time at dusk and shows a summary card: the goal and its result, ants, sugar, protein, born and lost that day, and the next goal. "Go on" starts the next dawn. "Restart the day" restores that day's dawn snapshot. The sim raises `EVENT.DUSK`; the stop, the card and the dawn snapshots live in the page (`host.js` `dawns`, `dusk`, `restartDay`), so a room can decide its own rule.
- Dawn saves are kept in memory: today's, and at a dusk card the finished day's. The next day's save is taken when the player goes on, so orders the page queues on the way to the card are in it. A reload loses them; the IndexedDB save is the next PR.
- Restarting a day marks the orders given after its dawn save as undone in the order log; orders in the save that had not yet run are queued again.
- Open: later days ask for more food than a map holds (seed 2026: about 1,060 loads of each food; days 3 to 9 ask for 1,050 of each), so a long campaign ends in lost days. Piles that regrow, or a last day, would fix it; M1 plays three days.
- The sandbox (`/cinderhill/` without `?colony=1`) has no days. The menu links the two.
- `bots.mjs` plays the goals: on a digging day the careful bot marks an 8 x 6 nursery beside the chamber at dawn. On 12 seeds, careful wins days 1 to 3 every time and idle loses every day (`sim/SPIKES.md`, Days). `test/days-bots.test.mjs` checks careful on seed 6, the seed with the narrowest day 3, in CI.

Choices the owner may want to change: the three goals and their targets, +30 a day after day 3, easing by a quarter after a loss, the floor rule and its gift, time stopping at dusk (a room could run straight on), the day length, and keeping the colony behind `?colony=1` rather than making it the page's default.

## The spider and Recall (M1, SIM_VERSION 6, 2026-11-26)

From day 2 a spider comes once a day (02-spec 6.5, feature 12; `sim/spider.js`). It wears ant scent, so ants neither flee nor fight it. The answer is Recall.

| When (a day of T ticks) | What happens | The page |
| --- | --- | --- |
| T/4 | It smells the trail with the most living surface ants on or beside its path (ties: the newest). `EVENT.SPIDER` WARN. | Toast, two low notes, HUD line "Spider: coming", a red ring where it will appear (an arrow at the screen edge when that is off screen). |
| + max(20, T/30) | It appears at the trail's far end. HUNT. | A dark eight-legged body with a red mark, its reach drawn as a box; HUD "Spider: hunting · eaten N". |
| hunting | One cell each 10 ticks back along the trail toward the nest. It eats the nearest surface ant within one cell, then needs 20 ticks before the next. | |
| it leaves | At the walk's end after max(40, T/40) ticks with nothing to eat, after T/6 ticks of hunting, at 30 kills, or when its trail is removed or replaced. LEFT. | Toast: what it ate, or "found nobody: send the ants out". |

- The first visit (day 2) is the safe form (02-spec 8): it walks along the map's top edge and eats no one, so the player meets it before it costs anything.
- Recall now empties the surface and keeps it empty: foragers in the nest stay in (before, they came home and went straight back out, so Recall never cleared the surface), their search timer does not run while they wait, and guards do not go out to a surface alarm.
- The careful bot turns Recall on at the warning and off when the spider leaves. "Careless" plays the same without Recall. On 12 seeds (`sim/SPIKES.md`, The spider), see the sweep there for what the spider costs.
- Times shrink for short days (at most an eighth of the day for the warning and the hunger time, half for the hunt), so a visit ends inside its day; `?day=200` on the phone check sees the day-2 visit.

Choices the owner may want to change: from day 2, once a day at a quarter of the day; a harmless first visit; the busiest trail by ants near it now (not loads carried); 30 kills a visit; no way to fight it (bites or majors could hurt it later, 02-spec 6.5 says ants cannot); its look.

## The nest view (2026-11-26, page only)

The nest layer (`nestview.js`) now shows:
- Each dug chamber, tinted and labelled with its size. The queen's chamber is the one around the middle of `sim.home`. A chamber is open cells grown by one cell from a core at least three cells wide and two high, six cells or more, so shafts and tunnels are not chambers. Rooms are found again only when the terrain changes.
- Sugar and protein in store as heaps on the two sides of the queen's chamber (one grain per 4 units, 60 at most).
- Brood by growth. Eggs swell with age. Larvae get bigger and close their curl with each meal; a hungry one is pale with a red spot. Pupae darken toward hatching.
- The queen: three body parts, six legs, antennae, and an abdomen that pulses and swells before she lays.

The sim is not touched (no hash change). Rooms with purposes (02-spec 6.2: nursery, granary, worth) are not built: they need sim rules, and brood still lies in the queen's chamber. Its colours follow the look (see Looks).

## Looks (2026-11-26, page only)

Three looks of the same scene, for the owner to pick one (04-roadmap M1 item 4). Open the page with `?look=ink`, `?look=ember` or `?look=field`, or use the Look row on the pause card. The row switches the look in place: the shaders are built again and the textures uploaded again, the game goes on, and the URL keeps the new look (a lab `look` event records the switch).

| Look | Ground | Edges | Scent | Ants |
|---|---|---|---|---|
| `ink` (the default) | Paper ash, a soft wash, a few embers | Wobbly hand-inked lines | Watercolour washes | Small inked bodies |
| `ember` | Night: dark ash with many embers and a vignette; warm light from the entrance | Rock edges glow and beat like cooling coals | Light added to the ground | Dark bodies with a hot rim; far away they are sparks |
| `field` | A field-guide plate in daylight: flat stepped tones and halftone dots on solid ground | Thick, clean outlines | Marching stripes for trails, dots for food | 1.3 times bigger, coloured by job (black forager, orange digger, red guard), with a white outline |

- `looks.js` holds the names and one palette per look for the Canvas 2D overlay: crews, the stroke preview, the selected ant, the spider and its arrow, room tints and labels, stores, brood and the queen. `index.html`'s page background and theme colour follow the look.
- Each look is its own shader build: `render.js` adds `#define LOOK n` after `#version`, and the context-restore path builds the same variant.
- An unknown name falls back to `ink`. The lab record's start carries the resolved name, not the raw query.
- The sim and its hashes do not change.
- The phone line `cinderhill looks` checks the following in WebKit and Chromium. `ember`, `field` and an unknown name each compile and draw, and each survives a lost context. The pause card switches looks without restarting the game (same tick and hash) and keeps `colony=1` in the URL. A syntax error in the `field` shader made this line fail (`timed out waiting for: field: frames drawn`). Every other cinderhill line still passed, because a shader that does not compile leaves the page running with no WebGL.
- S3 per look, run with `spikes/s3.mjs --only=webkit --look=<name>`: WebKit 27.2 with the iPhone 13 profile, on the Mac's GPU, with the machine's load average at about 13. These numbers are not from a phone: every look holds the display's frame rate here.

| Look | Ants | Frame mean / p95 ms | fps | Page work mean / p95 ms |
|---|---|---|---|---|
| ink | 2,000 | 13.89 / 15 | 72 | 0.78 / 3 |
| ink | 5,000 | 13.93 / 15 | 71.8 | 0.79 / 3 |
| ember | 2,000 | 14.07 / 15 | 71.1 | 0.64 / 2 |
| ember | 5,000 | 13.89 / 15 | 72 | 0.80 / 3 |
| field | 2,000 | 14.00 / 15 | 71.4 | 0.71 / 3 |
| field | 5,000 | 14.23 / 15 | 70.3 | 0.84 / 3 |

  Feature 10's bar is 30 fps with 2,000 ants on an iPhone 13 class phone. That bar is not yet checked on a real phone for any look: open `/cinderhill/?fps=1&look=<name>` on one.

Choices the owner may want to change: which look to keep (or parts of each), the field look's bigger ants, and switching looks in place rather than by reload.

## The lab record: a full replay (2026-11-26)

Every game sends its whole replay to the game lab, so a session can be played again in Node and read minute by minute (`labrec.js`, using only kit/lab.js's `start`, `event`, `end` and its flush when the page is put away).

- Start: format `cinderhill-replay/1`, a chain id and part, mode, look, ants, seed, `SIM_VERSION`, snapshot format, the day length, the viewport.
- `log` events: the replay stream, in order: every order exactly as `host.order` got it with its tick, go-on after a dusk, and a day restarted. Batched to about 3 KB an event.
- `sample` every 30 s of play: tick and the sim's total hash, ants by caste, sugar, protein, brood by stage, loads home, frames a second (p50 and the p95 slow frame), ms held, the camera. The log up to a sample is sent before it, so the hash checks the stream.
- `cam` (settled camera, at most one each 5 s), `hold` with its length, `hide` and `show`, `error` (10 at most), `dusk` with the goal's result, `dawn`, `restart`.
- Summary: totals, orders by type, holds, the longest play with no order, the final tick and hash.
- The kit keeps a run to 300 events and 96 KB. Near 270 events or 80 KB the part ends as `continued` and the next part starts where it stopped; parts share the chain id. A 10-minute bot game is about 6 KB and 57 events.

`spikes/replay-lab.mjs <record.json> [...]` makes the game again with `host.js`, replays the stream, checks every hash (part starts, samples, the final one) and writes a report: deliveries by food per minute, working and idle ants, each trail (ants on it, trips, time to the first delivery, how it ended), digs and what they opened, alarms and recalls with their effect, brood and castes, deaths, stalls of 60 s with nothing happening, days and restarts, and the page's frame rate, holds and errors. Trips are not attributed on ticks where an ant died. A record from another sim version will not match; the report says so. `test/labrec.test.mjs` plays a bot game through a Host as the page does, checks the kit's limits, replays it, and shows that one changed order is caught at the next sample.

## Crews (SIM_VERSION 7, 2026-11-26)

Tap a trail's number, then + or - to set how many ants it wants (`CMD.CREW`, command type 5: trail number and change, the change clamped to -64..64; trail number 0 means the newest trail). The sim keeps a wanted size per trail slot (`G.WANT0` to `WANT0 + 3`, stored as size + 1 so 0 means "no size"); the first order counts the ants on the trail now and adds the change. An ant's crew is her route (`via`), so the count is the ants whose route is that trail.

- Plus takes free ants and ants from trails without a size, never from another crew. A seeker ranks trails short of their size by her distance to the trail and joins the nearest.
- Minus sends ants over the size home; at home they come out again free. An ant over her crew's size takes no load on the surface.
- An ant that gives up, or whose trail can no longer be reached, frees her place at once.
- The newest trail takes every seeker only while it has no size. A new trail in a reused slot starts without one.
- The room (`workers/cinderhill`) accepts command type 5 and clamps it the same way.

`test/crew.test.mjs` (6 tests). Mutations shown to fail: pickup over the size allowed, a short-crew seeker kept on her old route, the change not clamped (wraps), the room refusing type 5.

## The pace pass (SIM_VERSION 7, 2026-11-26)

The owner's lab records of 20:31 to 20:34 UTC (4 sessions: 12, 69, 82 and 120 s) replay exactly at sim 6 (`spikes/replay-lab.mjs`). In the 120 s one he drew one 47-cell trail to protein at the start; the first load came home 73 s later; no ant was born; nothing else happened. The frame rate was fine (median 120). The first two minutes were empty.

What changed, all in the sim:

| Lever | Sim 6 | Sim 7 |
| --- | --- | --- |
| Ant speed (`WALK` / `RUN`, sub-cells a tick) | 24 / 36 | 48 / 72 |
| Queen's chamber depth below the surface | 24 rows | 10 rows |
| First two piles (one sugar, one protein) | 30 to 89 cells out, 400 to 799 food | 17 to 21 cells out, 120 to 179 food |
| New piles during a day | none | at 7, 10, 14 and 18 twentieths of the day (73, 105, 147, 189 s), 24 to 63 cells out, 200 to 400 food, protein first then alternating (`world.js` `windfall`, event `PILE_NEW`) |
| Day length (`DAY_TICKS`) | 12,000 (10 min) | 4,200 (3.5 min) |
| Brood: egg / larva meal / starve / pupa / adult meal (ticks) | 3,000 / 1,200 / 6,000 / 4,800 / 1,200 (egg to adult 9.5 min) | 600 / 300 / 2,400 / 900 / 600 (egg to adult 2 min) |
| Brood at the start | 4 larvae | 4 larvae and 3 pupae that hatch at 15, 30 and 45 s |
| Spider | from day 2 | day 1 walks the edge at a quarter of the day (52 s) and eats no one; first hunt on day 2 |
| Seeking gives up after | 60 s | 30 s |
| Trail scent half-life | 4,000 ticks | 1,400 ticks |
| Day goals | 40 loads / 40 dug / 60 of each food | 60 loads / 40 dug / 110 of each food |

The page shows each new thing: a toast and sound for a new pile, the first birth and every tenth, and "larvae are hungry" when there are larvae and no protein (lab events `pile` and `hungry`).

**Acceptance** (the coordinator's brief, written before tuning): the first load home 10 to 15 s after the first trail; the first new ant within 60 s; no stretch over 45 s in the first five minutes with nothing new. Measured by `spikes/pace.mjs` on 24 seeds with two passive players like the owner (one trail at 3 s, then nothing): "near" draws to the nearest pile, "owner" to the nearest protein.

| Player | Pile distance (cells) | First load after the trail: median / worst | First birth, worst | Longest quiet stretch, worst | Ants at 5 min (median) | Larvae lost (median) |
| --- | --- | --- | --- | --- | --- | --- |
| near | 7 to 16 | 8 to 9.5 / 13.0 s | 30 s | 31.5 s | 21 to 22 | 42 to 43 |
| owner | 7 to 19 | 8.2 to 10.8 / 14.7 s | 30 s | 31.5 s | 29 to 30 | 0 |

(Two shards of 12 seeds; the ranges are the two shards' medians.) All three hold on every seed. The near player fetches only sugar, so its larvae starve: that is the "larvae are hungry" toast doing its job, not a pace failure. The median first load is below 10 s; the brief's 10 to 15 s was read as "at most 15 s".

**Bots** (`bots.mjs`, seeds 3, 8, 5, 11, 2026, three days of 4,200 ticks). Acceptance, kept from sim 6: careful wins every day on every seed, idle loses every day on every seed.

| Bot | Day 1 (60 loads) | Day 2 (40 dug) | Day 3 (110 of each, 83 eased) |
| --- | --- | --- | --- |
| careful | won 157 to 193 | won 48 | won; narrowest 125 protein (seed 3), 177 sugar (seed 5) |
| careless (no Recall) | won 171 to 231 | won 48 | won; narrowest 118 protein (seed 3), 120 sugar (2026); spider ate 29 to 30 |
| greedy (sugar only) | won 149 to 175 | lost 0 | lost |
| idle | lost 0 | lost 0 | lost; best 77 sugar (seed 3) against 83 eased |

Day 3 was 60 at first: idle won it on seed 3 (77 sugar, 166 protein by scent with 100 ants), so it is 110 now. The bots ran with day 3 at 60 and were judged against 110; careful and careless clear 110 on every seed. On a both-foods day the careful bots now take the food with fewer loads since dawn and redraw every 600 ticks (1,500 before).

`test/pace.test.mjs`: three births within 60 s; new piles at the windfall times, protein first, each with food. Mutations shown to fail: no windfalls; no pupae at the start.

## Speed (2026-11-26, page only)

A button beside Hold cycles 1x, 2x, 4x. It is a view speed: the host runs 2 or 4 times as many ticks per frame (at most 4, 8 or 16 a frame), so the sim, its hashes and the command log are the same as at 1x. A new game starts at 1x. The lab record gets a `speed` event with the tick and the speed. The `cinderhill speed` phone line checks that 4x runs at least 2.5 times the ticks of 1x and that the log replays in Node to the page's hash. In a shared room a speed would be a room rule, like the hold; it is solo only.

## The tactical hold (2026-11-26)

The Hold button (Durdur in Turkish) stops time on the page: the host stops advancing ticks, so the sim, scent and ants stand still. Orders still work while held. A trail or dig drawn while held is queued at the current tick (the page state says queued); the first tick after Go applies it. A blue frame marks the held screen. The hold lives in the page (`painter.js` `held`, `host.advance(now, ... || held)`), not in the sim, so it changes no hash and needs nothing from the room. In a shared room a hold would have to be a room rule (who may stop time for everyone); that is open. Trail, dig and Recall all go through the same `order()` path to `host.order`; the Recall button shows its new state only once Go applies it (it follows the sim). The `cinderhill orders` phone line checks that no tick runs while held, that a trail stroke queues, and that Go applies it; it fails when the hold does not stop time. Dig and Recall while held are not checked on their own. The kit's `pause.js` is the full pause (pause card, page hidden) and Cinderhill uses it; a hold that takes orders has one user, so it stays in the game until a second game needs it (kit rule 1).

## Simplifications to revisit in M1

- Diggers dig the nearest marked cell, not the painted order, and carry no spoil. A dig crew is capped (4 per marked cell, 24 in all).
- Foragers seek in this order: the trail that led them out last (their route), a trail short of its crew, the pile they last took from, the newest trail (when it has no crew size), the three scent sensors, a random walk. After 30 s with nothing found they go home. The scripted orders do not give good foraging; that is tuning work.
- A field rebuild is a whole-field search (about 1.3 ms on the full map with octile costs, 0.7 ms before). Rebuilding all 9 live fields in one tick now takes about 12 ms, over the 10 ms tick budget. Regional rebuilds and a per-tick rebuild budget are not built.
- Ants in a crowd pass through one another. Separation bends a path but never cancels the step.
- No duplicate-command check in the sim; the room drops duplicates (05-tech, room protocol).
