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

**Acceptance** (the coordinator's brief, written before tuning): the first load home 10 to 15 s after the first trail; the first new ant within 60 s; no stretch over 45 s in the first five minutes with nothing new. Measured by `spikes/pace.mjs` (retired in R0 for `spikes/pace-gate.mjs`) on 24 seeds with two passive players like the owner (one trail at 3 s, then nothing): "near" draws to the nearest pile, "owner" to the nearest protein.

| Player | Pile distance (cells) | First load after the trail: median / worst | First birth, worst | Longest quiet stretch, worst | Ants at 5 min (median) | Larvae lost (median) |
| --- | --- | --- | --- | --- | --- | --- |
| near | 7 to 16 | 8 to 9.5 / 13.0 s | 15 s | 52.6 s | 21 to 22 | 42 to 43 |
| owner | 7 to 19 | 8.2 to 10.8 / 14.7 s | 15 s | 52.6 s | 31 to 32 | 0 |

(Two shards of 12 seeds; the ranges are the two shards' medians.) A quiet stretch ends only at something the page announces: a load home (the first), the first birth and every tenth (toasts), a new pile, a pile empty, the spider's warning, a dusk. Lost larvae have no toast and do not count. First load and first birth hold on every seed. The quiet stretch does not: on every seed the last one runs from the first dusk (210 s) to day 2's spider warning (262.5 s). Counting every birth (each has a sound) it was 31.5 s. The near player fetches only sugar, so its larvae starve; the page says "larvae are hungry". The median first load is below 10 s; the brief's 10 to 15 s was read as "at most 15 s".

**Superseded.** The round-3 spec (`docs/design/colony/02-spec.md` section 3, merged after this pass) sets different numbers: 300 ants at the start, walk 3.5 cells a second on a trail, egg to adult in 60 s, no days, and decision events at most 30 s apart. This pass is the interim build the owner can play now; R1 replaces its starting values, and the R0 pace gate measures both against the spec.

**Bots** (`bots.mjs`, seeds 1 to 12, three days of 4,200 ticks, with day 3 at 110). Acceptance, kept from sim 6: careful wins every day on every seed, idle loses every day on every seed.

| Bot | Day 1 (60 loads) | Day 2 (40 dug) | Day 3 (110 of each; 83 eased) |
| --- | --- | --- | --- |
| careful | won 12 of 12 (160 to 206) | won 12 of 12 (48) | won 11 of 12; seed 1 lost with 93 protein |
| careless (no Recall) | won 12 of 12 | won 12 of 12 | won 11 of 12; seed 3 lost with 96 protein; the spider ate 28 to 30 a game |
| greedy (sugar only) | won 12 of 12 | lost 12 of 12 | lost 11 of 12; seed 12 won |
| idle | lost 12 of 12 | lost 12 of 12 | lost 11 of 12; seed 9 won with 103 sugar and 215 protein, by scent |

Both acceptance lines miss on one seed of twelve, on day 3. Day 3 was 60 at first; idle won it on seed 3 of a five-seed run, so it went to 110, and now careful loses one seed and idle still wins one. The next fix would be to count only loads brought along a trail on day 3, as day 1 does. It is not made: the round-3 spec drops days (above), so tuning them further is spent on code that R1 replaces. On a both-foods day the careful bots now take the food with fewer loads since dawn and redraw every 600 ticks (1,500 before).

`test/pace.test.mjs`: three births within 60 s; new piles at the windfall times, protein first, each with food. Mutations shown to fail: no windfalls; no pupae at the start.

## Starting values (SIM_VERSION 8, snapshot format 8, R1 step 2, 2026-11-26)

The colony game now starts as 02-spec 3.2 says (after the owner's taste calls of PR 363: 30 workers, fast brood).

- **Nest**: 192 by 64 (`nh: 64` from the host). A porch store 6 by 2, 3 cells under the entrance, is home: a load counts there. The shaft goes on down to the nursery, 16 by 4 (64 cells), 12 cells down, where the queen lives and brood lies (`sim.nursery`, in the snapshot header). The sandbox keeps its chamber 10 cells down.
- **Colony at start** (`START`, `startColony`): 30 adults, 20 foragers on the surface within 3 cells of the entrance and 10 nurses (`JOB.NURSE`) who stay in the nursery; 10 sugar and 5 protein; 20 eggs aged 0 to 10 s; 20 unfed larvae aged 0 to 20 s (hungry since they hatched, so the oldest starves at 40 s with no protein); 12 brood due at 8, 11, ... 41 s.
- **Deviation**: the spec says "12 pupae due from 8 s and then every 3 to 5 s", but a pupa lasts 20 s, so a pupa cannot be due at 41 s. The ones due within 20 s are pupae (5); the later ones are fed larvae that pupate in time (7). Their times are fractions of `PUPA_TICKS`, so the pace gate's brood x10 plant still delays them.
- **Brood**: egg 15 s, larva 25 s once fed one protein load (one larva fed a tick, in brood order; a larva fed with 20 or more protein in store at her first meal is fed to 3 loads and becomes a major); one brood per nursery cell, pupa 20 s: 60 s egg to adult. A larva with no meal for 60 s dies. The queen lays 1 egg a second while sugar > 0, free, at most 64 brood. Adults eat 1 sugar per 10 adults a minute. A load is one unit (`LOAD = [1, 1]`).
- **Food**: a seed head of 30 sugar loads and a beetle of 20 protein loads, 8 to 12 cells out in two different directions. The "third pile of 120 loads, mixed, past a stone at 2:00" is two piles of 60 (a pile holds one kind), side by side 25 to 35 cells out behind a stone; the stone and the clearing are made at the start so the terrain does not change mid-game, and the piles get their food at tick 2,400. No windfalls without days.
- **Speeds**: 45 units a tick (3.5 cells/s) on a trail's path and in the nest, 32 (2.5 cells/s) on the surface off a trail's path (an ant walking to a trail is off it), 64 running. Trail half-life 1,200 ticks (60 s).
- **No days** unless the page asks (`?day=`): no dusk, no goals, no spider. The chapters that replace days are R1 step 6.
- **Not built yet (R1 step 3)**: starvation of adults (half speed at 0 sugar, then deaths), the who-goes rule (free ants only on the nearest drawn trail, one in three, turning back at threats) and the resting free count. Free foragers still search by scent as before, so the start fetches food without a trail.
- **Pace gate**: `STAGE = 'R1.2'`, strict. On 20 seeds (12 minutes, worst seed): first delivery 6.55 s (median bot), 6 s (passive), 50 deliveries in minute 1, first birth 8 s; funded birth 34 s; wasted labour 0.15. Not yet met, not blocking: the quiet stretch in the first 2 min (67 s: the near food is gone in about a minute and the late find comes at 2:00), decision gaps (412.4 s, 120 s). The threat lines are "not built" (the spider needs days; the bird is R1 step 5). The funded-birth stand-in now skips the births the starting brood and protein pay for (12 + 5).
- **Tests changed**: the queen's egg rules, egg to adult, the nursery cap, the start (pace.test.mjs), the windfall test runs with days; the Recall test waits 30 s instead of 20 s for foragers to go out again (they walk off-trail at 2.5 cells/s now).
- **Review** (read-only): fixed opening food that could fall off a small map or 5.7 cells out, a nursery below a shallow nest, brood sharing cells, starting larvae with no hunger, 20 protein not making a major, trail speed before reaching the trail, larvae drawn with no body in the nest view, stores drawn in the nursery, the ant card for a nurse. The Recall test now checks that ants go out at some point in the 22 s after Recall ends (they go out and come back in waves).
- **Second review** (read-only, of the fixes): fixed a larva first fed at exactly 20 protein still becoming a worker when another larva ate next (a major's first meal now takes all 3 loads at once), the late-find stone covering an opening pile on a small map, a straight pile 12.04 cells out (no sideways step at 12), the nest view drawing stores in a room that digging joins to the porch, and a sandbox restore turning "no nursery" into the home chamber (the header writes width 0). New tests for the three sim fixes and the restore; each sim test fails with its fix reverted (the nest view change has no test). Not fixed: a colony nest under 17 cells deep has no room for the whole nursery (the page always uses 64); a snapshot from the first sim 8 commit loads into the second (never released).
- **Mutations shown to fail**: eggs costing sugar again (3 colony tests fail); foragers starting in the nest (the pace gate fails first delivery, 19.55 s, and minute-1 deliveries); brood placed without checking for brood in the cell (the start test fails).

## Goal manager (SIM_VERSION 11, snapshot format 11, R1 step 4, 2026-11-26)

The navigation goal manager of 05-tech and 03-features 10 ("64 goals live at 2,000 ants inside the tick budget"). Play is unchanged from sim 10: the quick, colony and long runs give the same ants, globals and terrain at every 50th tick (compared against a sim 10 checkout); the hashes change only because the fields and `best` are wider.

- **Why before the bird**: all 16 slots were taken (4 fixed, 4 trails, 8 food), and chapter 1's husk, midden and cover each need a destination field. So step 4 comes before step 5, as the roadmap orders it.
- **Slots**: `MAX_GOALS` 64. Slots 0 to 15 keep their fixed meanings; from `SLOT.POOL0` (16) `allocGoal()` takes the lowest free slot, or returns -1. A slot with no goal shares one all-INF array; a goal gets its own array when set and gives it back when dropped (a full pool on the full map is about 23 MB; a usual game holds about 11 live fields, 4 MB).
- **No 16-bit ceiling**: distances and each ant's `best` are 32-bit, `INF` = 2^31 - 1. A 16,000-cell switchback tunnel (distance 82,230) is walked to its end (`test/goals.test.mjs`). The spec offered an authored maximum path cost instead; wider fields were chosen because a player can dig any nest shape.
- **Work quota**: each of the tick's two rebuild points rebuilds at most `REBUILDS` = 2 marked fields, oldest marked first (marks carry an order number, `G.DIRTY_SEQ`; a field marked again keeps its place). A field still marked after a rebuild point is blank (all INF) until its turn, and an ant following a blank field keeps her heading. At a tick boundary every field is exact or blank, so the snapshot still leaves distances out: restore rebuilds the exact ones and blanks the marked ones. The flow hash leaves marked fields out (a field marked after the tick's last rebuild point, as at dusk, is still exact in the running game and blank in a restored one; neither is read before the next rebuild point).
- **Numbers** (`spikes/goals.mjs`, 2,000 ants, 64 live goals, every field marked at once at tick 1,800): steady ticks 1.60 ms mean, 1.69 p95; the 20 ticks after the burst 5.7 ms mean, 9.1 ms max, every field exact again 16 ticks (0.8 s) later. Without the quota the burst tick takes 77 ms. Quotas 1, 3 and 4 gave maxima of 6.0, 9.8 and 14.2 ms (31, 11 and 8 ticks): 2 keeps the worst tick under S1's 10 ms line with some room. In normal play no more than 2 fields are marked at one rebuild point, so nothing waits.
- **Shared destination fields**: already so: one field per destination (a pile, the dig, home), read by every ant; trail paths are kept apart from destination search (`rebuildTrail`).
- **Decisions (agent)**: 32-bit fields over an authored cost cap; quota 2 by count of fields, not by cells settled; oldest marked first; a blank field means keep heading (decisions that test a field for INF, such as a digger's or a guard's, read a blank field as unreachable for those few ticks). Not done: a per-hill budget (one hill exists); the pool's goal kinds come with the husk, the midden and cover (step 5).
- **Tests**: `test/goals.test.mjs` (7 tests). Eight mutations each fail one; a ninth (restore rebuilding marked fields too) is equivalent: the restored field is exact but flagged blank, so nothing reads it before its rebuild (`sim/SPIKES.md`, Goal manager).

## Doors (SIM_VERSION 10, snapshot format 10, R1 step 3, 2026-11-26)

Doors and traffic, as 02-spec 3.2 (Doors, Recall) and 6.2 (Traffic) say, in colony games. The sandbox keeps its 2-cell entrance and no lanes.

- **The entrance** is 3 cells wide (`DOOR.wide` in `sim/world.js`), the shaft as wide. Each entrance cell has two lanes, out and in, and each passes 6 ants a second: a lane carries a debt in twentieths of a pass (`G.LANE0` on), pays off 6 a tick, and lets an ant through while the debt is 20 or less, adding 20. A rested lane passes 2 at once. An ant at a lane with no room waits where she is (`sim.queued`, `G.QUEUED`). Lanes are taken in index order within a tick.
- **Jams**: a door is jammed once 10 or more ants have queued at it for 5 s (`EVENT.JAM`, `G.JAMMED`, `G.JAMS`), and clear when fewer than 10 wait. The jam shows on the HUD (`jamHud`) and on every route card (`why_jammed`) only while it lasts; the inspector says a queued ant waits her turn (`why_queued`). The observer counts a jam as a decision event ("route jammed").
- **Recall**: the way in is not limited under Recall; the way out still is.
- **Free ants** (the first review's open finding 6): an ant with a load is not free (6.2), so carriers no longer count in `freeAll` or the third. A free forager who picks up leaves the count; one who unloads off any crew joins it again.
- **Pace gate**: `STAGE = 'R1.3b'`. Two lines now block: queued at doors outside a jam (ants queued over ants outside, summed over the looks outside a jam; target 0.10) and door jams (0: chapter 1 cannot jam its 3-cell door). Queued ants are counted apart, not idle. A new fixture `door1` (a one-cell door, 300 adults, 400 sugar) must jam on some seed in 3 minutes on 5 seeds, or the gate fails: it jams 18 times.
- **Numbers** (20 seeds, 12 minutes, worst seed): first delivery 7.2 s (median), 6.85 s (passive), 50 deliveries in minute 1, first birth 8 s, wasted labour 0, queued at doors 0.001, no jams. Not yet met, not blocking: the quiet stretch (60.5 s), decision gaps (377.95 s, 120 s). First delivery is 0.1 to 0.2 s later than sim 9: the first crew waits at the lanes for a moment.
- **Decisions (agent)**: the queued line is a ratio of sums over the game, not the largest sample: at the first trail 15 ants leave a porch at once and the largest sample reads 0.29 on the one-cell fixture, which says nothing about steady play. One door per colony for now: every entrance cell's queue counts toward one jam. Under Recall every ant crossing inward is at the door, so "within 2 cells of a door" exempts the whole way in. Entrance cells past the fourth would have no lanes (`DOOR_CELLS`); no map has them yet. `sim.queued` is per-tick scratch, not state: it is 0 right after a restore until the next step.
- **Tests**: `test/doors.test.mjs` (17 tests). 14 mutations each fail a test, and 13 more after the review (`sim/SPIKES.md`, Doors).
- **Review** (Codex, read-only): fixed a death leaving a false jam (the jam is now judged after the deaths, and a queued ant who dies leaves the count); the route card counting a free ant carrying home as free on her trail; the inspector missing a queued guard (any job now says `why_queued`); a free forager sent back to rest keeping her trail in `via` (the sim now clears it, so the observer no longer counts her as working); ants queued inside with no one outside scoring a queued share of 0 (the share is now queued over the ants out or queued inside); queued ants missing from the per-minute table (a Queued column); the gate rounding 10.04% down to its 10% limit (shares now round up, `up()`); and the one-cell door fixture passing with a 3-cell door (a control fixture `door3`, the same crowd at the real door: the one-cell door must jam more and queue at least twice as much). The HUD's crew lines moved to `hud.js` so a Node test reads the jam line. Five tests that accepted broken behaviour now fail on it: a rested lane passing two at once, three cells with their own lanes (18 a second), a jam at exactly 10 and clear at 9, all 60 sandbox ants through, the HUD's jam line. The sim totals are unchanged (the quick runs meet neither case).

## Who goes (SIM_VERSION 9, snapshot format 9, R1 step 3, 2026-11-26)

Crews, the who-goes rule and adult starvation, as 02-spec 3.2 (Crews) and 6.2 (Who goes) say, in colony games. The sandbox keeps its old foraging.

- **Crew levels**: Light, Steady and Surge set a trail's crew to 10, 25 or 50% of the outside workforce (living adults of the colony that are not nursing or digging, crew members included), rounded, at least 1. A new trail starts Steady. Crews are worked out oldest trail first and together never take more than the workforce: a newer crew gets what is left, and its card says "no free foragers" (`why_noFree`). Sizes are worked out again only when the workforce has moved by a tenth since the last time (`G.WORKFORCE`), or on any level or count order; each recompute redoes every levelled crew, oldest trail first. Levels are colony-only and whole (1 to 3); anything else is rejected. Plus and minus still work: they set a count and drop the level, so a count does not follow the workforce. The route card has the three level buttons (`#crewLevels`, colony games only), the crew and free ants on the trail and its loads in the last minute. The inspector says when an ant is resting (`why_resting`).
- **Who goes**, for a forager that is not carrying home, in order: Recall keeps an ant in the nest in; a crew keeps its members, and one over its size leaves it; a free ant joins the nearest crew short of its size (from the nest, the oldest trail slot first); a free ant in the nest takes the dig while marked cells lack diggers (an auto job: no diggers are born, and a digger with nothing to dig is a free forager again); a free ant resting outside walks in for the dig; then free foraging: only on a drawn trail, at most a third of the free ants (rounded up) out at a time, the rest resting in the porch or on the surface within 3 cells of the entrance, still. When a crew is cut, free ants out over the third turn back at once, wherever they are. A free ant takes the trail nearest her (the field's off-path distance); trails equally near (all drawn from the door) go to the shorter one. A free forager walks at off-trail speed (2.5 cells/s) even on the trail; a crew walks it at 3.5. With no trail drawn, nobody forages: the start waits for the first trail.
- **Starvation**: at 0 sugar every adult of the colony walks at half speed. After 60 s at 0, one adult in a hundred (at least one) dies every 10 s, oldest (lowest index) first; the queen dies once no adult is left. Any sugar in store, or a sugar load delivered, resets the count (`G.STARVE`). Deaths come at 60, 70, 80 s and so on; with no adult left, the queen dies on the next 10 s step.
- **Not built**: free ants turning back at a telegraphed threat (it waits for the bird, R1 step 5); doors and queues (the next pull request, `R1.3b`).
- **Decisions (agent)**: the default level is Steady (the spec's median bot "leaves crews on Steady"; free ants alone at 2.5 cells/s would push the first delivery past 10 s for a pile 12 cells out). Resting ants go out in index order. Starvation kills at least one adult a tick of 10 s, so a colony under 100 still starves. Loads a minute come from a new `EVENT.HOME` (colony games; events are not hashed). Free ants rest in the porch or within 3 cells of the entrance; the quota is a third of the free ants, rounded up. The nearest trail is the field's off-path distance, ties to the shorter trail. The dig is an auto job by switching jobs, and a resting surface ant walks in for a short dig. The first death comes at 60 s, not 70 s. A level order or a count order recomputes all levelled crews.
- **Pace gate**: `STAGE = 'R1.3'`; the idle-share line blocks, and CI now plays 12-minute games (`--minutes=12`, about 90 s on this machine). The doors line moved to a new stage `R1.3b`. The wasted-labour count now includes free foragers resting with no route while a job has a gap, and a free forager's load counts for the trail she worked. In colony games a trip comes from the `EVENT.HOME` events, so a replacement trail is not credited with its predecessor's load (the sandbox keeps the carry check). An ant walking in to take a job (`goal` set) is not idle. **Definition change**: a gap counts once it has lasted 5 ticks (`GAP_FOR`). Before it, the worst seed read 0.179: when a crew member gives up, her crew is one short until a resting ant takes her place on the next tick, and every resting ant counted as wasted at that instant. Measured over the 20 seeds and 12 minutes: such a gap, with resting ants waiting, lasts at most 2 ticks (`gaprun` probe, not kept). With `GAP_FOR` 5 the line reads 0 on every seed. A planted fault (resting ants never join a short crew) reads over 0.15 (`test/pace-gate.test.mjs`). The brood x10 plant is now checked only on lines its 3-minute run can read, so an unread line no longer counts as a catch. **Accepted regressions**: a baseline line may carry `accepted`, a written reason; then the slack check lets it be worse than at the base (only while it still passes its target, and only when the reason is new on this branch). `--update` keeps it. The first one: `first-delivery-passive`, 6 s to 6.65 s, because foragers wait for a trail and one trail gets a Steady quarter. This is a visible exception the owner may veto.
- **Numbers** (20 seeds, 12 minutes, worst seed): first delivery 7.1 s (median), 6.65 s (passive), 50 deliveries in minute 1, first birth 8 s, funded birth 37 s, wasted labour 0. Not yet met, not blocking: the quiet stretch (61 s), decision gaps (379.75 s, 120 s).
- **Tests changed**: `crew.test.mjs` is rewritten for the spec's rule (18 tests). The days test now expects no food home without a trail. The colony egg-to-adult test resets `G.STARVE` each tick: with no adults and no sugar, the queen would starve on the birth's own tick. Nineteen mutations each fail a test (`sim/SPIKES.md`, Who goes).
- **Review** (Codex, read-only): fixed the quota after a crew cut, minus not freeing a squeezed crew, a sugar delivery not resetting starvation, stale counts after a death, levels in the sandbox and fractional levels, dig walkers counted idle, a replacement trail credited with the old trail's load, restart keeping loads, the card's capacity reason and free count, the inspector's resting line, and the starvation test deriving its timing from the constants. **Not fixed**: (1) foragers of another team can take crew places (`workforce()` filters by team, recruitment and the census do not); no colony game has a second foraging team until R2b. (2) A working digger who starves keeps her dig place for the rest of that tick. (3) `GAP_FOR` 5 is a definition change, kept as a decision; Codex calls it masking a literal sample. Owner question: does a crew one short for under a quarter second count as a job with a gap? (4) The queued-at-doors line is deferred to `R1.3b`; the spec blocks it at R1 step 3, and the doors pull request comes next. (5) The trip count from `EVENT.HOME` has no test of its own (added in the second round).
- **Second review** (Codex, read-only, of the fixes): fixed the dusk gift not ending starvation, the route card's capacity reason for a level capped part-way, free ants walking back to rest counted free on their trail and at the door (the inspector now says `why_toRest` for the walk), the counts left at 0 right after a restore, a restart dropping the loads home before its dawn, the observer closing trails the restored game still has and crediting a load to a trail whose sequence number changed, crew levels from JSON values that are not numbers (`true`, `[3]`), and the `accepted` check (now only a text reason, and only when the value meets the target), with tests that fail when each fix is reverted (13 mutations). The sim totals are unchanged. **Not fixed**: (6) a forager carrying home with no crew counts as free (`freeAll`, the third), where 6.2 says a free ant has neither a load nor a crew; fixed with the doors (sim 10). (7) The idle line's `since` includes a resting ant's walk back to the door, so she can count as idle for 10 s on her first tick there; this can only make the line stricter, not looser.

## The pace gate (R0, 2026-11-26)

`spikes/pace-gate.mjs` reads the pace budget of 02-spec section 3.1 from scripted players. CI runs it in the `changes` job when `experiments/cinderhill`, `.node-version` or `ci.yml` changes (`scripts/affected.mjs`), and nightly, with 3-minute games (`--minutes=3`); a run with no flag plays 12 minutes and reads every line.

- **Bots** (02 section 3.1, adapted to what the build has). Median: every 15 s, a trail from the entrance to the nearest pile of the food the colony has less of in store, skipped when a live trail already ends there; the sim keeps four trails and reuses the oldest, so it never has more than six; Recall on at the spider's warning and off when it leaves; it taps on at every dusk card. Passive: one trail at 1 s to the nearest pile, then nothing. Idle: no order; it does not play yet because no line the build can measure reads it (chapters are not built).
- **Watching**: replay-lab's `Observer`, the same one a lab record's replay uses, attached to the bot's Host. It now keeps births, deliveries in the first 2 min, decision events (new source seen, source empty, threat telegraphed, brood short of protein; the spec's other kinds are not built; the spider arriving and leaving are kept for the threat and quiet lines but are not decision events, since they offer no new choice) and the wasted-labour share (a forager with no load, no trail, no remembered pile and no find for 10 s, or a digger resting, or seeking with no marked dig, for 10 s, while a trail has no crew size or is short of it, or marked dig cells have room in the dig crew).
- **Worst seed**: a line's value is its worst seed of 20 ("every line passes for the scripted bots on 20 seeds", 02 section 0). A line that never happens on some seed fails.
- **Staging** (02 section 3.1, "Which lines block what", round 4): each line names the stage it blocks from (`stage`); `STAGE` in the file is where the build is. At R0 four lines block: first delivery (median and passive), deliveries in minute 1, first birth. Every other line is read and reported with its status: pass, fail, "not read" (the run is too short for it) or "not built" (the build has nothing to read). Raise `STAGE` in the pull request that builds the next step.
- **Ratchet** (`spikes/pace-baseline.json`) on the blocking lines: a line that passes must keep passing; a failing line may not get worse than its recorded value by more than a twentieth (plus a quarter unit), or stop happening; a line that starts to pass fails until `--update` records it, so progress is kept. CI also passes the base commit (`--base-ref`): the baseline a pull request records may not be worse on a blocking line than the base commit's, so `--update` cannot hide a regression. A blocking line must be read in every run. The roadmap says the current build fails the gate: it does (first delivery 16.2 s on the worst seed), and the gate prints "Pace budget at R0: FAILS". Only at R0 does the baseline allow a failing blocking line (otherwise no pull request could merge before R1 step 2); from R1 step 2 (`STAGE = 'R1.2'`) every blocking line must pass whatever the baseline says.
- **Quota opening** (fault injection, no sim change): 20 workers, 40 sugar, 4 larvae, no pupae, a 40-load first day of 10 minutes. It must fail a blocking line the build passes. It fails the first birth.
- **Brood x10 plant**: every brood stage ten times as long. It must fail a blocking line. The starting pupae now start a third of the pupa stage apart (the same ages as before with a 900-tick stage, so the same hashes), so a slower stage delays them too: the first birth moves from 15 s to 150 s.
- **First player-funded birth** stands in as the first birth beyond those the starting brood and protein pay for (from sim 8) that comes after the first protein load home by a drawn trail. The sim does not track which load fed which larva, so this is an approximation, not the spec's exact event.
- **Quiet stretches** (round 4): no structures exist yet, so the events are deliveries, births, new sources and threat changes.
- **Limits**: a restart in a lab record rolls the sim's counters back, so the minute it falls in undercounts deliveries (bots never restart). At R1 step 3 the idle-share line (12-minute horizon) starts to block, so CI must then play 12 minutes or the line needs a shorter horizon. The people line reads sim seconds, so a lab session played at 2x or 4x reads later than it was; first delivery from records counts only sessions that replayed to their hashes. **Not built**: first real choice and its consequence (chapter scripts), consequential choices (needs a paired-replay tool), doors, chapters. Input ready, human first order and human chapter 1 length are listed as people and page lines, "not built". **People lines**: `--records <files>` replays lab records and reports first order within 10 s and first delivery from the first trail.

Sim 7, 20 seeds, 12 minutes, worst seed:

| Line | Target | Sim 7 | Blocks from |
| --- | --- | --- | --- |
| First delivery from the first trail (median / passive) | <= 10 s | 16.2 / 13.25 s: fail | R0 |
| Deliveries in minute 1 | >= 25 | 39: pass | R0 |
| First birth | <= 15 s | 15 s: pass | R0 |
| First funded birth | <= 90 s | 135 s: fail | R1 |
| Quiet stretch, first 2 min | <= 15 s | 21 s: fail | R1 |
| First threat telegraphed / resolved | <= 60 s / 3 min | 52.55 / 94.55 s: pass | R1 step 5 |
| Longest gap between decision events, 0 to 10 min / after | <= 30 / 45 s | 157.5 / 82.55 s: fail | R1 |
| Wasted labour | <= 15% | 0.261: fail (the starting diggers wait in SEEK with nothing marked; counted after the second review) | R1 step 3 |

Decisions (agent): the gate runs only when `experiments/cinderhill` changes, since nothing else can move these numbers, and CI plays 3-minute games (every blocking line fits in 1 minute; 12-minute games cost about 20 s of a core each).

## Speed (2026-11-26, page only)

A button beside Hold cycles 1x, 2x, 4x. It is a view speed: the host runs 2 or 4 times as many ticks per frame (at most 4, 8 or 16 a frame), so the sim, its hashes and the command log are the same as at 1x. A new game starts at 1x. The lab record gets a `speed` event with the tick and the speed. The `cinderhill speed` phone line checks that 4x runs at least 2.5 times the ticks of 1x and that the log replays in Node to the page's hash. In a shared room a speed would be a room rule, like the hold; it is solo only.

## Combat at a choke: first probe (2026-11-26, not built)

Before the round-3 spec placed the rival colony at R2b, a throwaway copy of the sim tried today's `fight()` on a 64 by 40 arena: 20 majors (team 0) against 60 workers (team 1), in the open and at a 2-cell gap in a stone wall, 3 seeds each, 3,000 ticks. The battle toy's arithmetic (`experiments/lab/cinderhill-battle/NOTES.md`) says the workers should win in the open (square law: 3 squared beats the majors' 6-fold bite times hit points) and the majors at the gap (contact-limited).
- Today's rules alone: almost no fighting. Ants pass through one another and only bite what they touch on the way.
- With ants steering at the nearest enemy within 2 cells and standing still while in contact: the majors lost at the gap in about 160 ticks (everyone crowded into the gap), and the open fights did not finish in 3,000 ticks (the armies stood at their goals).
- Adding a cap of 1 or 2 biters per cell per team (an ant may bite only when fewer of her team in her cell bit within the last 10 ticks) turned the gap around: the majors won all 6 gap runs with 8 to 18 left. The open runs still did not finish, so the square-law half is not shown.
So geometry alone does not give a frontage cap here; a per-cell contact limit does, which matches the spec's "combat by bounded contact slots" (05-tech, Rebuild plan). The open-field half needs both armies to seek each other out, which is rival behaviour, not a fight rule.

## The tactical hold (2026-11-26)

The Hold button (Durdur in Turkish) stops time on the page: the host stops advancing ticks, so the sim, scent and ants stand still. Orders still work while held. A trail or dig drawn while held is queued at the current tick (the page state says queued); the first tick after Go applies it. A blue frame marks the held screen. The hold lives in the page (`painter.js` `held`, `host.advance(now, ... || held)`), not in the sim, so it changes no hash and needs nothing from the room. In a shared room a hold would have to be a room rule (who may stop time for everyone); that is open. Trail, dig and Recall all go through the same `order()` path to `host.order`; the Recall button shows its new state only once Go applies it (it follows the sim). The `cinderhill orders` phone line checks that no tick runs while held, that a trail stroke queues, and that Go applies it; it fails when the hold does not stop time. Dig and Recall while held are not checked on their own. The kit's `pause.js` is the full pause (pause card, page hidden) and Cinderhill uses it; a hold that takes orders has one user, so it stays in the game until a second game needs it (kit rule 1).

## Simplifications to revisit in M1

- Diggers dig the nearest marked cell, not the painted order, and carry no spoil. A dig crew is capped (4 per marked cell, 24 in all).
- In the sandbox, foragers seek in this order: the trail that led them out last (their route), a trail short of its crew, the pile they last took from, the newest trail (when it has no crew size), the three scent sensors, a random walk. After 30 s with nothing found they go home. The scripted orders do not give good foraging; that is tuning work.
- A field rebuild is a whole-field search (about 1.3 ms on the full map with octile costs, 0.7 ms before). Rebuilding all 9 live fields in one tick now takes about 12 ms, over the 10 ms tick budget. Regional rebuilds and a per-tick rebuild budget are not built.
- Ants in a crowd pass through one another. Separation bends a path but never cancels the step.
- No duplicate-command check in the sim; the room drops duplicates (05-tech, room protocol).
