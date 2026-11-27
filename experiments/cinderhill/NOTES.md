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

## The sim's public surface (SIM_VERSION 11, 2026-11-26)

This is what a page or a bot may rely on, as of sim 11. The source is the authority; this list is updated with each sim PR until the handoff. **The bird, husk, sprouts, chapter script and ledger do not exist in the sim yet**: there are no fields, events, commands or host calls for them. Step 5 would add the husk, midden and cover as pool goals (`allocGoal`) with new `GOAL` kinds.

- **Make and step**: `new Sim(cfg)`; `cfg` keys are in `DEFAULTS` (`sim/sim.js`): seed, ants, maxAnts, map sizes `sw sh nw nh`, scent `spread` and `halfLife`, `blank` (an empty test map), `colony` (0 sandbox, 1 colony) with its starting `sugar protein eggs larvae pupae surface`, and `dayTicks` (0: no days). Then `sim.step()` (one tick, `TICK_HZ` = 20), `sim.tick`, `sim.hashes()` (per-subsystem and `total`), `snapshot(sim)` / `restore(bytes)` (`sim/snapshot.js`), and `replay()`, `script()`, `firstDivergence()` (`sim/replay.js`).
- **Orders**: `sim.queueCommand(cmd)` or `encodeCommand(cmd)`, with `CMD` = TRAIL 1 `{layer, points:[x,y,...]}`, DIG 2 `{cells:[x,y,...]}` (nest cells), ALARM 3 `{layer, x, y, hold}`, RECALL 4 `{on}`, CREW 5 `{seq, delta, level}` (`seq`: the trail's creation number, `flow.seq[slot]`; `delta` changes a set count; `level` 1 Light, 2 Steady, 3 Surge, given only for a level order). Every command carries `tick`, `seat` and `id`.
- **Events**: `sim.drainEvents()` returns the flat `[code, a, b, ...]` triples since the last drain (capped), with `EVENT` = DUG 1 (cell), PILE_EMPTY 2 (pile), REJECTED 3 (command id), LATE 4, DUSK 5 (day, won), SPIDER 6 (spider state, slot or kills), PILE_NEW 7 (pile, kind), HOME 8 (trail slot of her route or -1, food kind), JAM 9 (1 jammed or 0 clear, ants queued).
- **Per-ant arrays** (index below `sim.n`): `x y` (sub-cells, 256 a cell), `layer` (SURFACE 0, NEST 1), `heading` (0 to 255), `job` (`JOB` FORAGE, DIG, GUARD, NURSE), `mode` (`MODE` SEEK, RETURN, WORK, REST), `carry` (0, 1 sugar, 2 protein), `via` (trail slot, `FREE_VIA + slot` for a free forager on it, -1), `goal`, `best`, `stall`, `since`, `hp`, `caste` (`CASTE` WORKER, MAJOR), `team`, `queued`, `lastCell`, `mem`.
- **World**: `sim.L` (layout: `sw sh nw nh n nestBase`, `cellAt(L, layer, x, y)` in `sim/grid.js`), `mat` (`MAT`), `link` (entrance pairs), `dig`, `home` and `nursery` rectangles, `pileCell pileAmount pileKind` (`MAX_PILES` 8), `brood` (`n`, and per brood `stage age fed hunger cell`, `makeBrood` in `sim/colony.js`), `crew` (per trail), `freeAll freeOut`, `doorCells`.
- **Globals** `sim.g[G.*]` (`sim/flow.js`): stores and counters (STORES, SUGAR, PROTEIN, PICKED, DUG, DIG_COUNT, DIG_CREW, BORN, HUNGRY, BROOD_LOST, DIED, QUEEN), Recall and the alarm (RECALL, ALARM_HOLD), days (DAY, DAYS_WON, EASED, TRAIL_LOADS, SUGAR_LOADS, PROTEIN_LOADS, DAY_LAST; `dayState(sim)` in `colony.js` gives the day's goal), the spider (SP and SP_*), WINDFALLS, crews (WANT0+k, LEVEL0+k, WORKFORCE), STARVE, doors (LANE0, QUEUED, JAM_RUN, JAMMED, JAMS), DIRTY_SEQ.
- **Fields**: `sim.flow` with `SLOT` HOME 0, EXIT 1, DIG 2, ALARM 3, TRAIL0 4 (4 trails), FOOD0 8 (8 piles), POOL0 16 (to `MAX_GOALS` 64); `GOAL` kinds NONE, HOME, EXIT, DIG, ALARM, TRAIL, FOOD. Read with `distAt(sim, slot, cell)` (INF: unreachable or blank), `fieldReady(sim, slot)`, `nextCell`; trail paths in `flow.path` / `flow.pathLen` (`PATH_MAX` per slot). Goals: `allocGoal(sim, kind, cell)`, `setGoal`, `dropGoal`, `markDirty`, `markKind`. `sim.newestTrail()`, `sim.setCell(c, m)` and `sim.rebuildAll()` (tools, tests: between ticks only).
- **Host** (`host.js`, what the page calls): `new Host(ants, seed, {colony, dayTicks})`, `reset`, `attach`, `advance(now, paused)` (fixed 50 ms ticks), `step`, `snap` (positions for drawing between ticks), `order(o)` (queues and logs a command), `stats()` (HUD counts: ants, surface, carrying, foragers, seeking, resting, queued, jammed, trails, alarm, dig, piles, picked, stores, recall, tick, colony), `inspect(i)` (the ant card), `day()`, `saveDawn`, `restartDay(day)`, `goOn`, `tickStats()`. `hud.js` `crewLines(stats, ...)` makes the crew lines.

## Goal manager (SIM_VERSION 11, snapshot format 11, R1 step 4, 2026-11-26)

The navigation goal manager of 05-tech and 03-features 10 ("64 goals live at 2,000 ants inside the tick budget"). Play is unchanged from sim 10: the quick, colony and long runs give the same ants, globals and terrain at every 50th tick (compared against a sim 10 checkout); the hashes change only because the fields and `best` are wider.

- **Why before the bird**: all 16 slots were taken (4 fixed, 4 trails, 8 food), and chapter 1's husk, midden and cover each need a destination field. So step 4 comes before step 5, as the roadmap orders it.
- **Slots**: `MAX_GOALS` 64. Slots 0 to 15 keep their fixed meanings; from `SLOT.POOL0` (16) `allocGoal()` takes the lowest free slot, or returns -1. A slot with no goal shares one all-INF array; a goal gets its own array when set and gives it back when dropped (a full pool on the full map is about 23 MB; a usual game holds about 11 live fields, 4 MB).
- **No 16-bit ceiling**: distances and each ant's `best` are 32-bit, `INF` = 2^31 - 1. A 16,000-cell switchback tunnel (distance 82,230) is walked to its end (`test/goals.test.mjs`). The spec offered an authored maximum path cost instead; wider fields were chosen because a player can dig any nest shape.
- **Work quota**: each of the tick's two rebuild points rebuilds at most `REBUILDS` = 2 marked fields, oldest marked first (marks carry an order number, `G.DIRTY_SEQ`; a field marked again keeps its place). A field still marked after a rebuild point is blank (all INF) until its turn, and an ant following a blank field keeps her heading. At a tick boundary every field is exact or blank, so the snapshot still leaves distances out: restore rebuilds the exact ones and blanks the marked ones. The tick's last rebuild point comes after dusk, and `setCell` (between ticks: tools, tests) rebuilds what it marks, so no field is left marked and still exact at a boundary. The flow hash leaves marked fields out.
- **Numbers** (`spikes/goals.mjs`, 2,000 ants, 62 live fields marked at once at tick 1,800; the two empty trail slots need a drawn path): steady ticks 1.58 ms mean, 1.66 p95; the 20 ticks after the burst 5.8 ms mean, 8.9 ms max, every field exact again 16 ticks (0.8 s) later. Without the quota the burst tick takes 80 ms. Quotas 3 and 4 gave maxima of 10.1 and 12.2 ms (11 and 8 ticks); quota 1 took 31 ticks. 2 keeps the worst tick under S1's 10 ms line. In normal play no more than 2 fields are marked at one rebuild point, so nothing waits.
- **Shared destination fields**: already so: one field per destination (a pile, the dig, home), read by every ant; trail paths are kept apart from destination search (`rebuildTrail`).
- **Decisions (agent)**: 32-bit fields over an authored cost cap; quota 2 by count of fields, not by cells settled; oldest marked first; a blank field means keep heading (decisions that test a field for INF, such as a digger's or a guard's, read a blank field as unreachable for those few ticks). Not done: a per-hill budget (one hill exists); the pool's goal kinds come with the husk, the midden and cover (step 5).
- **Review** (read-only): fixed a pooled DIG field not marked by a dig order or a dug cell (`markKind` marks every field of the kind; the restored game differed at once); a field marked between ticks (a terrain change, then a trail order read HOME before any rebuild point) that was exact in the running game and blank in the restored one (the boundary rule above; a first fix that blanked it made the trail order fail, which `test/trail.test.mjs` caught); a carrier who met her trail blank for one rebuild point and took HOME for the whole trip; a blank HOME counting as "far" for a seeker (sandbox and colony); a stalled ant on a blank field still counting her stall and kicking; oldest-first breaking when the order counter wraps (age is now taken modulo 2^31 from the last mark); the spike marking 61 fields, not 64, and counting later marks in its wait. Not fixed: a snapshot of a full pool allocates about 22 MB for the duplicate live distance arrays while it encodes (`snapshot.js` `rebuiltDistances`); digger and guard INF tests still read a blank field as unreachable.
- **Tests**: `test/goals.test.mjs` (11 tests). The mutation list and which are caught is in `sim/SPIKES.md` (Goal manager); restore rebuilding marked fields too is equivalent (the restored field is exact but flagged blank, so nothing reads it before its rebuild).

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

## The war sim, beside sim 11 (2026-11-27)

Owner direction: the game should be of the colony-strategy genre in full (missions, base building worth doing, strategy, variety, a tech tree, branching decisions); see `docs/design/colony/13-full-game.md`. Sim 11 has one colony baked in, so the contested game is a new sim in `war/` and sim 11 is untouched. Sim 11 and its two pages retire only after a one-colony config of the war sim passes the pace gate.

- `war/sim.js`: any number of seats (two now), integers only, 20 Hz, one order queue. The rival (`war/ai.js`) issues the same orders a player can, so a log replays without it. `war/host.js` runs it for a page or a test. `war/world.js` is the first map, The Crossing: mirror-fair, two fords, the big food on the fords.
- It imports only the modules of `sim/` that hold no colony state: grid, rng, math, hash.
- Slice 1 leaves out digging, rooms, fog, heat and air, water as a weapon, and follow-one-ant. The rival knows every pile and the player sees the rival's nest and trails until sight is built.
- The page `war/` reuses `game/gl.js` (now two doors, sixteen piles, a rival body colour on ant kind +16) and `gestures.js`. Settings go through the kit under slug `cinderhill` with keys `cinderhill:war:*`; plays record under `cinderhill` with `mode: 'war'`.
- Rival mood (timid, steady, bold) is a player setting. It shipped with steady as the default; the sweeps below moved the default to timid.
- Meat is held back for a larva waiting on the soldier diet. Before this, worker larvae ate each load as it came and no soldier was ever raised from a trickle.
- Balance as first shipped: queen 800 hit points, dusk at 9,600 ticks, the steady rival raids from tick 4,200 with ten soldiers. Bot matches end by a queen's death near tick 5,500 to 5,900. Not yet tuned with players.
- A tap is a short order: Raid sends soldiers to the tapped spot, Forage sends workers to a pile under the finger. The sim routes from the door.

### Bot sweeps (2026-11-27)

`node experiments/cinderhill/war/sweep.mjs 30` plays each pairing over 30 seeds. Findings and the changes they led to:

- First sweep: the timid rival (never raids) beat the steady one 100 to 0, because a raid into an equal guard at the door is thrown away. Turtling was the best play.
- Change: the rival breaks into a nest only with the numbers for it (bold at parity, steady with a quarter more soldiers). Short of that its soldiers hold the richest food on the fords. Bites of one tick now land together.
- After: bold beats steady 77 to 23, steady beats timid 100 to 0, bold beats timid 93 to 7. Steady against steady is 43 to 57 and bold against bold 63 to 37 (30 seeds; a small side bias is not ruled out, lab-5w7.55).
- A novice script (three trails and a soldier diet at the start, nothing after) loses to all three moods. Against timid it loses at dusk on count; against the others its queen dies near 3:30 to 4:30. So the default rival is timid, and the result card offers the next mood up after a win.

## Digging and rooms in the war sim (2026-11-27)

- A nest cell has a use (`room`: store, nursery, quarters), a mark to dig (`mark`: 1 + the colony) and work left (`digLeft`). All three are saved; `WAR_VERSION` is 2. A cell belongs to the colony whose door is nearer in x.
- Orders: `CMD.DIG { cells, on }` marks own clay (at most 96 marks a colony); `CMD.ROOM { cells, kind }` paints a use on open or marked own cells. The page sends both from one drag, so a stroke digs and names a room.
- Up to 8 resting workers dig. Each stroke takes a tick off a cell's 120; the opening stroke rebuilds the walking fields once that tick. A mark with no open cell beside it waits.
- Caps: stores hold 8 loads of each food a store cell (the porch gives 120; a load over the cap is lost, event `FULL`); the brood cap is one a nursery cell (48 at the start); the hill holds 90 ants and brood plus 4 a quarters cell, and the queen stops laying at that cap. Laying is a little faster (every 14 ticks) so the nursery cap is what binds.
- Carriers walk to the nearest store cell, nurses mill on nursery cells, brood lies on nursery cells.
- The rival builds through the same orders, one room at a time, from fixed slots around its shaft (`ai.js` `SLOTS`): a store at 80% of the food cap, quarters within 10 of the hill's cap, a nursery wing within 4 of the brood cap.
- A bite's wait now varies by a tick either way. Before, an even fight was settled by where each side stood, and with larger hills that decided most matches for one seat.
- Sweep, 30 seeds a pairing (`war/sweep.mjs`): a steady mind that builds beats the same mind that never digs 100 to 0; so do bold and timid. A mind that digs only stores, only a nursery, only quarters, or stores and quarters loses 0 to 100 to the full builder. A mind that digs nursery and quarters and no store does as well as the full builder (30 to 70, the same as steady against steady).
- What that says: nursery and quarters are worth building and are needed together. Stores do not matter yet, because food is eaten as fast as it comes. Digging costs only the diggers' time. Both are open (bead lab-5w7.47): a build is worthwhile but not yet a choice between builds.
- Seat bias: steady against steady is 30 to 70 and bold against bold 57 to 43. Not explained (lab-5w7.55). The first big fight at a ford decides most matches.
- The moods' order moved with the larger hills: bold now loses to steady (27 to 73), steady beats timid 93 to 7. The novice (three trails, no rooms) loses every match to every mood.
- Page: the Nest sheet has Look, Store, Nursery, Quarters and Clear; a drag in the cutaway paints cells; marks are hatched and fill as they are dug; the sheet shows stores, young and ants against their caps. No setting was added.
- Not verified: no person has dug a room on a phone. The scripted browser check drew quarters with the mouse and the cap rose from 90 to 130.

## Tables, a caste pick and a price to dig (2026-11-27)

- `war/tables.js` holds the castes, rooms and missions. The sim reads them: a caste is a row (hp, bite, speed, meat to raise, reach, fights), a room is a row (which cap, how much a cell), a mission is a row (map, starting kit, goals, castes to pick from, rooms allowed). The Crossing is the one mission. Moving it into the table left four seeded bot runs with the same hashes.
- Two new castes. Spitters: 14 hp, bite 3, reach 2.5 cells, need a clear line, are not crowded out of a target, stop at their reach. Wardens: 96 hp, bite 3, slow. A colony picks one, once (`CMD.PICK`), from the mission's list. `CMD.DIET` takes `special`: its share of the brood in four, beside the soldiers' share.
- On the page the pick is a player setting (`cinderhill:war:caste`, default spitters). A rival that fights takes the other caste. The Nest sheet has two tabs, Young and Dig rooms.
- Digging costs a seed a cell, paid at the opening stroke; the last three seeds are never spent on earth.
- Bold now raises soldiers from the first brood and may strike from tick 1,600 with eight.
- Sweeps swap sides on even seeds (`cfg.swap`), so a bias of the side cancels: steady against steady is 53 to 47, bold against bold 50 to 50.
- Sweep, 30 seeds a pairing: spitters against wardens 47 to 53 (steady minds) and 33 to 67 (bold minds). A mind with either caste beats the same mind with none 97 to 100 in 100: a pick is a plain gain, the choice is which. Bold against steady moved between 47 and 20 across two small changes to digging, so that pairing is noisy and not settled. Timid loses to both (7 in 100). The builder still beats every partial build except nursery and quarters (50 to 50): stores still do not matter.
- A blind read of the nest screens (an outside model as a first-time player) led to: "housing" for the hill's cap, a line under the room tools saying what the chosen room does and costs, a small sign in each room cell, "Unmark" for Clear. Not done from that read: a hint for how to feed a starving hill beside the food counter, queued against digging marks, tap a room to see what it holds.
- Not verified: no person has picked a caste or dug on a phone.

## A second mission and the campaign menu (2026-11-27)

- The owner's direction changed what done means: a campaign with missions, base building that is worth doing, variety, a tree, and branches that matter. From here the war sim grows by mission rows, forks and unlocks before it grows by rules for the one skirmish.
- **First Frost** is a row in `war/tables.js` on the Crossing's map. Its kit: seed piles three times as big (`glut`), frost at tick 4,800 (`frostTick`): every pile outside is gone and a meal comes every 300 ticks, not 1,200 (`frostEat`). Hunger kills after 15 seconds, one in ten every ten seconds (`starveAfter`, `starveDiv`). The queen has 3,200 hit points (`queenHp`). The thaw (dusk) is at 10,800. All of these are sim options with the Crossing's old values as defaults: four seeded Crossing runs kept their hashes.
- The rival plans for the winter on a frost mission: only seeds once it has 12 meat, a store before housing, enough stores for every mouth and a quarter over, no quarters the stores cannot feed. `{ mood, winter: false }` is the same mind without the plan.
- Sweep, 30 seeds a pairing, sides swapped on even seeds (`node war/sweep.mjs` takes a mission as its third argument; the pairs below came from a small script on the same Host): the planner against the same mind without the plan 30 to 0 (72 adults to 47 at the thaw); against a planner that may not dig stores 30 to 0 (71 to 32). This is the first mission where stores decide the result. Timid against timid 18 to 12. Bold against timid 27 to 3 (it lives on what it steals: 108 adults to 72). Steady against timid 4 to 26 (its soldiers eat as three). Bold against steady 9 to 21. Steady against steady ends on a queen 25 times in 30, at 395 seconds, though she has four times the hit points: unresolved whether that is too often.
- **Campaign** (`CAMPAIGN` in the tables, state on the page under the new key `cinderhill:war:campaign`): the Crossing, a fork, First Frost. The fork is the third caste: spitters or wardens, kept for the campaign; the rival raises the other. It opens when the Crossing has been played to its end, won or lost. A lost mission costs the next one 8 of its 30 first workers (`antsBy`). "New campaign" erases the state after a second tap.
- The caste setting left the settings panel: the fork sets it, so the record still carries it (`caste` in `rec.start`, `none` before the fork; a `fork` event when chosen).
- From a blind read of the campaign plan by an outside model: every finished mission grants its fork, win or lose (done); the second fork as first drawn (deeper stores or faster brood, after the frost) is a trap because stores stop mattering once the frost has passed (not built; to be redrawn); an unlock that needs both an earlier fork and a mission outcome is what makes it a tree (not built); trails that hold an objective (needed for the next mission, hold sites that pay).
- Not verified: no person has played First Frost or used the menu. A scripted phone-size browser pass covered: frost closed at first, the Crossing lost, the fork chosen, First Frost started with 22 workers, the frost tint and "Thaw in", the result card; no page errors.

## A third mission, sites, and a second fork

**The Stones** (`MISSIONS.stones`). Four stones stand on the surface (`sites`, cell coordinates). A colony holds a stone when it
has at least `SITE_MIN` (3) ants within `SITE_R` (3) cells of it on the surface and strictly more than the other colony; a
holder keeps the stone while it has an ant there and is not outnumbered. Each held stone pays one point a second. First to 400
points wins (`REASON.POINTS`); at dusk the higher points win, adults break a tie. A dead queen still ends it. The hold is
state (`siteHold`, saved and hashed), so every hash changed with this slice and `WAR_VERSION` is 4.

**Per-colony stats.** Caste hit points, bite, speed, food cost and reach, room sizes, adults fed per seed and pupa time are read
from `sim.stat[team]`, built once from the tables plus the colony's traits (`cfg.traits`). A trait is a row in `TRAITS` with a
list of `set` entries. No rule lives in the client.

**The second fork ("way").** Thrift: a seed feeds twenty at a meal, not ten. Swift brood: pupae hatch in 370 ticks, not 400.
First values (fifteen, and 300 ticks) failed: swift won 18, 20, 17 and 20 of 20 in four of six pairings, because a brood
lead compounds. Final values, thrift's wins of 20 seeds against swift, same mind both sides:

| mission | steady | bold |
| --- | --- | --- |
| The Crossing | 5 | 13 |
| First Frost | 8 | 16 |
| The Stones | 11 | 6 |

59 of 120 overall. No single cell is even, which is the point of a fork: which one is better depends on the mission and on
how the colony is played. Bots only; no person has played either option.

**Rival traits.** A rival that is not timid takes the option the player did not, so a fork changes both sides.

**The Stones, 30 seeds a pairing** (before the fork values changed; no traits in these runs): timid v timid 16 to 14; steady v
timid 30 to 0; bold v timid 30 to 0; steady v steady 18 to 12; bold v steady 29 to 1; bold v bold 16 to 14; steady spitters v
steady wardens 25 to 5; bold spitters v bold wardens 7 to 23. Missions end between 247 and 440 seconds.

**The rival on a site mission.** It wants the nearest `1 + mood` stones, draws a raid trail to each, and does not march on the
queen. A player can still win by the queen.

**Table rows with no fork yet.** `farspit`, `acid` (need spitters), `iron`, `stride` (need wardens). They wait for a fourth
mission so that the third fork depends on the first.

**Open.** Bold v bold on The Stones averaged 299 points at the end, cause not examined. Steady v steady on First Frost ends on
a queen 25 times in 30.

## One finger, the fork measured against nothing, and saves

**One finger** (setting `finger`, key `cinderhill:war:finger`, default `hill`). With `hill`, a trail or raid stroke starts within
64 px of your own door; a drag that starts anywhere else moves the view, and a tap acts as before. With `draw`, one finger
always draws and the Move tool or two fingers move the view (the behaviour before this setting). Reason: the owner named the
Move button as a shortcoming of the page. This is my reading of that remark, not a confirmed one. The setting is recorded in
`rec.start`, so the share of players who change it is readable. Checked in a phone-size browser: a drag away from the door
moved the camera and drew nothing; a drag from the door drew one trail.

**Each fork option against no trait**, wins of 30 seeds, same mind both sides (identical minds split about 15 give or take 5):

| mission | swift, steady | swift, bold | thrift, steady | thrift, bold |
| --- | --- | --- | --- | --- |
| The Crossing | 21 | 13 | 15 | 19 |
| First Frost | 22 | 9 | 20 | 17 |
| The Stones | 17 | 20 | 11 | 15 |

Swift 102 of 180, thrift 97 of 180. Both options help a little and neither changes what a colony does. The fork is even
because it is weak. It ships as is; the next round replaces number changes with options that change orders or layout.

**Saves.** The page never writes a sim save to storage (`save()` and `load()` are used by tests and the host only), so the
`WAR_VERSION` bump to 4 cannot meet an old save in a browser. The campaign key written by the earlier page has no `forks`
field; `loadCamp` adds it. Checked by opening the page with that older value in storage: no page error, and with a steady
rival and thrift picked the sim ran with `[["thrift"],["swift"]]`.

Five screenshots (`war/nest1.png` to `nest5.png`) were committed by mistake in an earlier slice and are removed here.

## A fourth mission, a fork that depends on a fork, and fixes from an outside review

**Outside review.** Three reviewers read the war folder cold and scored it against the owner's six goals (missions, base
building, strategy, variety, progression, decision branches): between 2 and 6 of 10 each, lowest on variety (one map) and
progression (a line, no tree). What they agreed on, in the order it is being taken:
1. bugs: the dusk score used a census taken before the last tick's births and deaths (two reviewers reproduced a wrong
   winner); on The Stones the page warned "marching on your hill" for a raid on a stone; the rival sent crews of one soldier
   to a stone that takes three. All three fixed here. The planner's winter sum now reads the colony's own `eatPer`.
2. a mission won by theft (this slice);
3. the caste upgrades should be a fork (this slice);
4. forks should change what a player does, not a number by a few percent (open);
5. a second map; stores robbed cell by cell, guard posts, a reason to place rooms (open);
6. hidden map and scouts (open, `lab-5w7.49`).
Not taken: reviewers also proposed sharing a seed and order log for a friend to take over a losing hill. Recorded as an idea.
Reported and not yet checked: repainting the starting store as quarters costs nothing; a spitter can stop behind a wall with
a target it cannot hit; a trail slot reused within a few ticks keeps ants bound to the old trail; trails can skip a painted
bend; workers on a forage trail count toward holding a stone.

**The Larder** (`MISSIONS.larder`). `lean: 3` leaves a third of the food outside; both stores start with 40 seeds and 20 meat.
A load taken from the rival's store carries a flag (`CARRY.LOOT`) and counts in `CG.HAUL` only when the thief reaches her own
store. First to 10 wins (`REASON.HAUL`); at dusk the larger haul wins, adults break a tie. Queens have 6000 hit points and,
on a haul mission, soldiers inside the rival nest stand at its store and do not go for the queen: the first build let them,
and every match ended on a queen. The rival keeps half its soldiers on the richest ford, which is the opening a thief
needs; a first build with the whole guard at home had no theft at all against a timid rival (0 loads in 8 seeds). A rival
that fights breaks in with every soldier and workers to carry when it has half as many soldiers again (steady) or a quarter
more (bold). On the page a tap on the rival door in this mission draws that same full raid.

20 seeds a pairing, wins for the left: steady v steady 11; bold v bold 12; steady v timid 9; bold v timid 6; bold v steady 8;
steady spitters v steady wardens 3; bold spitters v bold wardens 7. Mean haul is between 2 and 6 loads, so most matches go to
dusk. A timid rival wins ties on adults because it never loses soldiers in a raid; a player must bring one load home to
beat it. Wardens are much the better caste here (they hold a tunnel). Bots only.

**The third fork ("craft")** offers the two upgrades of the caste taken at the first fork: far spit or strong spit; iron shell
or long stride. The rival, which has the other caste, takes the upgrade in the other position of its own list. Steady minds
on The Larder, 20 seeds: far spit v strong spit 5 to 15 with strong spit at bite 6, so it is now 5 (not re-run); iron v stride
9 to 11; far-spit spitters v stride wardens 9 to 11; strong-spit spitters v iron wardens 14 to 6 (at bite 6).

**Open from this slice.** The menu is five boxes and four missions long on a phone. An idle colony on The Larder starves to
one ant by tick 4000.

## Maps as table rows, and a siege

**Maps** are rows in `MAPS` (`war/tables.js`): what runs down the middle (water, stone or nothing), the rows where it is open,
the food piles and how many stone clumps. `world.js` reads the row named by the mission's `map`. The Crossing's row
reproduces the old hard-coded map exactly: state hashes of eight runs (four missions, two seeds, 1800 ticks) are the same
before and after. Two new rows: `pass` (a stone ridge with one gap, the rich food in the gap) and `flat` (no wall, many
small piles; no mission uses it yet).

**The Narrows** (`MISSIONS.narrows`, map `pass`). A siege: the rival (team 1) starts with 40 workers to your 36 and wins by
lasting until dusk (`goals.dusk: 'holder'`); its queen has 1200 hit points. A rival under siege never marches on the other
hill. A machine attacker goes at the half-way mark with what it has. Attacker's wins of 12 seeds by start sizes:

| start (you, rival) | timid v timid | steady v timid | steady v steady | bold v steady | bold v bold |
| --- | --- | --- | --- | --- | --- |
| 36, 36 | 12 | 12 | 9 (queen 2400) | 11 | 12 |
| 36, 40 (shipped) | 10 | 12 | 5 | 0 | 0 |
| 32, 40 | 3 | 7 | 3 | 1 | 0 |
| 36, 44 | 4 | 12 | 2 | 2 | 3 |

The result turns on who wins the first fight in the pass and then snowballs, so four workers move it a long way. At the
shipped sizes a timid rival is easy, a steady one about even for the steady bot, and a bold-against-bold attack never got
through. Bots only. The versus bar shows the rival queen's health in this mission.

## A guard post

A fourth room kind, `post`, has no cap and stores nothing. Each post cell holds one idle fighter in eight inside the nest, so four cells keep about half the guard underground beside whatever the player painted them next to. Without a post the guard stands at the door as before, and the eight reference hashes did not move. A mission lists the rooms it allows, and the dig menu hides the others: posts open with The Larder and stay for The Narrows. This is the first unlock that comes from reaching a mission and not from a fork. The rival does not paint posts yet, and no sweep has measured what a post is worth.

The rival now paints a post in the throat of its shaft (three cells above the store, then three below) once it has four soldiers. Measured over 20 seeds on The Larder, a rival that posts against the same rival that does not: steady 10 wins of 20, bold 11 of 20. On The Narrows, 12 seeds, a steady attacker wins 4 with or without posts of its own. So in bot play a post is worth nothing that these runs can see. The likely reason is that the door guard already stands four cells from the store, and food is taken from one colony-wide count, so where the guard stands inside hardly matters. Posts will matter when stores are robbed cell by cell (lab-5w7.63); until then the room is a small choice, not a strong one.

## The Lineage: deeds open nodes

The three forks were all changes to a number. An outside design review (two reviewers, given the candidate list and asked to attack it) agreed on the direction: a visible tree, nodes opened by named deeds in missions, and every node a new order, room or rule. This slice builds the frame and three nodes.

- **Deeds.** Each mission row has two `deeds`. The sim judges them from its own counts (`Sim.deeds(team)`); the page only stores which were done, under a new key, `cinderhill:war:lineage`. A deed done opens a node for the rest of the campaign. Each node has three or four deeds across the missions, so a missed one is not lost.
- **Nodes.** Guard post (the room, which is no longer given by reaching The Larder). Raiders: a raid trail may be sent for the store, and its soldiers carry loads home and leave the queen be. Hold fast: a raid trail may be told to hold, and its soldiers never go down a door. The last two are a mode on the trail (`trMode`, set with the trail or by a crew order); a colony without the node gets the old behaviour whatever it asks for.
- **The rival has the same nodes.** A node is a new thing to do, not a lead. The rival paints posts when it has the node. It does not yet use the two raid modes.
- **The tree** is a panel in the menu: four boughs, the three forks shown beside the three nodes, a tap on any node says what it does and which deeds open it.
- **Deed rates**, a steady bot against a steady rival, 12 seeds, deeds done out of wins: Crossing 0 and 6 of 6 wins; Frost 4 and 4 of 10; Stones 0 and 1 of 9; Larder 4 and 3 of 8; Narrows 1 and 2 of 3. The first set of deeds was thrown out because five of them were done by every win.
- The three older missions give the same results as before for three seeds each (winner, end tick, adults, kills, stores). The Larder and The Narrows changed because their rivals no longer have posts without the node. The save version is 5 (a new array).

Not built, in the order the reviews put them: stores robbed cell by cell with deep stores; a second door; trail stances beyond hold; sight and scouts. One reviewer's wildcard is worth a node of its own: both nests share one underground grid, so a colony could tunnel sideways into the other's nest.
- Deeds count against any rival, the timid one included, where the bot does both Stones deeds in one win. Early nodes are meant to come easily; if records show every player holding every node after one pass, tie the later deeds to a steady rival.

## Food lies in cells, and caches lie in the clay

- **Every load lies in a nest cell** (`binS`, `binP`). The totals the rest of the sim reads are the sums; a test checks that every tick of two matches and across a save. A store cell holds the room's measure of each food. A hill with few store cells keeps the old floor of 24 as a heap on its founding cell.
- **A carrier walks to a cell with room for her load** (`putF`), the nearest to the door first. **The colony eats from the cells nearest the door first** (`cfg.eatDeep` reverses it), so deep cells fill last and empty last: they are the reserve.
- **A thief walks to the nearest cell with anything in it** (`lootF`) and takes from that cell. The `STOLEN` event carries the cell.
- **A store cell unpainted** gives its loads to cells with room; what finds none spoils. This replaces the old rule that clipped the totals.
- **Bot runs: depth is a cost and not yet a gain.** A mind that keeps its stores beside the queen (`{ deep: true }`) carries home about 30 in 100 fewer loads and lost every match of 10 on The Crossing and of 20 on The Larder. Thieves take two to five loads a match of about 200 carried, so there is nothing for depth to save. A mind that sends soldiers for the store whenever it has four (`{ loot: true }`) lost 10 of 10; sent only when the other guard is away it never finds the moment. **Deep stores is not built as a node** until theft bites harder. A guard post is still worth nothing measurable (12 wins of 20 against 14 without).
- **Caches** (`CACHES` in `tables.js`): four a hill, the same either side, chosen by the seed. They show in the clay. Digging one open adds its loads to the stores (what finds no room spoils) and counts in `CG.FOUND`. The rival digs to its nearest when nothing else presses (`cacheRun`). A mind that digs for them against one that does not: 16 wins of 20 on The Larder (14 when both dig), 11 of 20 on The Crossing (11 when both dig). So a cache is a small gain, not a strategy.
- **Tunnel tool**: a plain dig order from the nest sheet, so a way to a cache does not have to be a room.
- **Found while measuring, not fixed:** on The Larder with no change of sides, seat 0 won 6 of 8 before this change and 8 of 8 after it (steady against steady). The sweeps above change sides every other seed and seat 0 still wins 14 of 20 there, so the lean is in the seat, not the side of the map.
- Version 6: older saves are refused, as before.
- **Outside review of this slice (two reviewers), fixed here:** a dig mark left the food cells in index order while a loaded save sorted them, so the two ran apart (now every recount is followed by a field rebuild; a test fails without it); a cache opened into full stores reported loads that spoiled (it now reports what was kept); a thief whose cell was emptied the same tick went home with nothing (she waits a tick); a thief with no way to the food stood still for good (she goes home); the nest view still drew the totals as one heap on the porch; the rival's first guard post asked for a row it may not paint and so asked for ever (its posts never reached the second slot, and its cache digging was held up).
- **Why theft is weak, from the same review, not yet acted on:** workers on a raid chase any enemy in sight before they follow the order to steal; guards with no post already stand within four cells of the door, which is on top of the porch store, so a post in the same shaft adds nothing; a thief takes one load and must cross the guarded door twice. After the post fix a poster still wins 11 of 20 on The Larder against 12 without. The changes proposed: thieves that do not give chase and carry more than one load, and guards that stay on the surface unless given a post.

## The Wall: digging into the other nest

- **Why.** With the door as the only way in, every fight ends in the same shaft, so where a store or a post is dug cannot matter. A spike before this slice (a free tunnel between the nurseries on The Crossing, eight seeds) showed that a second way in makes a post decide: the attacker won 8 of 8 with no post at the mouth and 2 of 8 with one. A door-to-door dig on the old maps is about 81 cells, about 4,500 ticks at the measured 50 to 60 ticks a cell, which is most of a match. So the breach ships as a mission with the hills close together, and not as a rule on every map.
- **The mission** (`MISSIONS.wall`, map `wall`): a stone wall with no gap, doors at 58 and 101 (a map's `door` is how far in from its edge each door stands), 31 cells of clay between the nurseries. `breach: true` lets either colony mark plain clay on the rival's side (`Sim.mayBreach`; a trait may set `breach` for one colony, and none does yet). Rooms cannot be painted there. `rivalMood: 1` is the least mood its rival plays at, since a rival that never raids would never dig.
- **Under ground.** `underF[t]` is the walk from queen `t` with no door used; `linked` is whether one queen can walk to the other that way. Both are worked out only where a colony may breach, so the older missions run as before (checked: the same hashes on fifteen matches, three seeds on each of the five older missions, against the code before this change). A colony that may breach digs from any open cell its ants can walk to under ground, on either side of the border.
- **Events.** `HEARD`: a colony opened a cell in the other's ground (the client rings the cell and says so). `BREACH`: the stroke that joined the nests.
- **A raid under ground** is a raid trail with `under: [x, y]`: one open nest cell for its end, refused while there is no way there. Its soldiers take the shortest way, and at its end in the rival's ground they go on as any raid does (Press for the queen, Loot for the stores, Hold to stand there). The phone has a Strike tool for it: tap a cell for half the soldiers, tap its mark for all of them, tap again to call them off.
- **The rival** digs eight cells at a time when nothing else presses (`breachRun`; where it aims, the nearest room, the queen's chamber or the stores, goes by the seed), goes through when it has the soldiers (steady: a quarter more than the other hill, or at three fifths of the day whatever it has), uses a tunnel the other side dug, and answers a breach with a guard post on the last six cells before its own rooms (`mouth`).
- **Measured, both seat orders, five seeds:** seat A digs row 12 at tick 600 and sends a raid through at 6,000; both minds otherwise never raid. With no answer from the defender the attacker won 10 of 10 (queen dead near tick 6,800). With the post at the mouth it won 0 of 10. The defender had its usual five post cells in the throat of its shaft both times, so a post by the door does nothing against a strike through the clay: where the post stands is what decides.
- **Minds against minds, six seeds, both seat orders:** steady v steady 6 and 6, every match ended by a dead queen; bold v steady 10 and 2 (11 and 1 before the review fixes); a steady mind that does not post at the mouth lost 8 of 12 to one that does; a mind that only defends beat a steady one in 5 of 12 and a bold one in 5 of 12.
- **Deeds.** As first written (queen dead inside six minutes; fewer than forty dead) no bot earned either in 40 matches: wins came between ticks 7,940 and 9,235 with 104 to 161 of the winner's own dead (the count includes the starved). They are now seven minutes and fewer than 120 dead, which bold earns in 2 of 7 wins (seven minutes) and 4 of 7 (fewer than 120 dead). No person has tried for them.
- **Tried and dropped:** a rule that a guard standing on her post is bitten by one ant at a time. It changed nothing measurable, so it is not in.
- **From an outside review of this slice (two readers), fixed:** the order log keeps its own copy of `under`; a strike is refused on a colony's own tunnel in the rival's ground until the nests are joined (its soldiers would have waited there in a fight that could not start), and the client says so before it calls a live strike off; `BREACH` is raised when the fields first show the nests joined, so two cells dug in one tick cannot hide it; on its own ground a colony takes a rival's dig mark over, and the rival's dig goes round clay the other has marked; the rival falls back to the nearest room when there are no stores to aim at; its post goes on the tunnel beyond the first room when a breach comes straight into a room; it no longer asks every think for a forage trail across the wall; a tap is a tap only if the finger never moved ten pixels.
- **Found by the phone check after those fixes:** the rival counted the player's unfinished tunnel in its ground as a place of its own to dig from, marked a run to a cache from it (taking the player's mark over), found no worker could reach the marks, took them off, and did it again every think, so the player's tunnel never got through. `cacheRun` now starts only from cells the colony's own ants can walk to. The headless matches had not shown it because both seats were bots that dig by `breachRun`.
- **From the same review, not fixed:** a second tunnel goes round the one post the rival digs (`mouth` follows one way in); a steady mind's late strike can be four soldiers against thirty; a strike always ends at the queen, whatever cell was tapped (the route chips Loot and Hold cannot be reached for a raid under ground); the deeds here open nodes that then apply on the older missions. One design reading from both readers: the cheap line is to let the other hill pay for the tunnel, post its mouth, and strike back down it. Their answers to try: stone veins and caches in the middle clay, and a plug the defender digs that costs the attacker time.
- **Not done:** a rally under ground; filling a tunnel back in; sound of digging before the border is crossed; a Lineage node that lets a colony breach on the other maps.

## Sappers, a plug, and forks that can be freed

- **Two blinded design reads** (no sight of the code, no word of which shape was preferred) on the tree and on eight candidate nodes. Both put growth inside the mission above the tree as it stands: deeds that open tools for good are content, not decisions. Both kept Sappers, the plug and a side door; both cut Deep stores as a number (one offered instead: raiders loot the shallowest store first, so depth is protection). One named the thing most missing: the nest is not yet the battlefield on most maps. The tree's shape is the owner's call and was put to him; the build goes on toward growth inside the mission with deeds widening what it offers.
- **Sappers** (`TRAITS.sappers`, `breach: 1`): the first deed of The Wall opens it, on a new bough, Dig. A colony with it may tunnel into the other nest on any map. On The Crossing the nurseries are 75 cells apart: in 40 bot matches with the node no nest was joined before the match ended over the ground (about tick 5,700), so for a bot it changes nothing there. For a person it is a late way round a held ford; not tried by one.
- **A plug** (`CMD.FILL`, tool Plug): an open tunnel cell of its own packed shut for 3 seeds. It is clay with `PLUG` in `room`, so no new saved array and no version change. Digging it out takes one stroke every fifth tick however many dig (600 ticks against a crew's 15 for plain clay) and 4 seeds, and is heard. Allowed wherever either colony may breach. Refused in a room, in the shaft, with a rival within 8 cells, past 3 at once, or where it would cut the queen from her door or a room. Its own ants in the cell step back; ants left on the far side wait there.
- **The rival** packs the mouth shut when the other hill has half as many soldiers again and more, and digs no way through while that lasts. In bot matches this changed no result (steady v steady 6 and 6 with or without it; bold v steady 11 and 1): a plug buys about thirty seconds, and a bot does nothing with thirty seconds that it would not have done. Whether a person does is not known.
- **Forks** have a setting (`cinderhill:war:forks`): kept for the campaign (default) or free to change between missions. A changed caste drops the craft that belonged to it. A change is recorded as `refork`.
- **Not done:** the in-mission tree itself; a side door; looting the shallowest store first; soldiers hatching where they were raised.

## Growth inside a mission: the queen's chamber, two growths, a branch

Spec 13 section 4 already says it: enlarging the queen's chamber raises the colony's tier, which opens room kinds and
castes inside a mission, stops laying for a while and spends stores. This is that, in its first form.

- `CMD.GROW` grows the chamber. It is paid in seeds at once (`TIERS.grow`: 18, then 36, on top of the digging
  reserve) and the queen lays nothing for a fixed time (15 s, then 20 s). The pause is a timer and not a dig, so
  nothing can cancel or stall it. The seeds must really lie in the store cells: the count alone does not pay.
- The first growth takes a branch. **War hill**: soldiers a quarter tougher (living ones too), the third caste, and
  the raid nodes (Raiders, Hold fast). **Deep hill**: store and quarters cells hold half as much again, pupae hatch
  13% sooner, and the Guard post node. The second growth opens the other branch's nodes and caste, and Sappers. It
  does not give the other branch's numbers: those stay the mark of the branch (`restat`).
- A node of the Lineage says where it opens (`at: [tier, branch]` in TRAITS). A deed still opens a node for the
  campaign, and the colony must still grow to it in each mission. What a mission itself grants (The Wall's digging
  and its Guard post) is open from the start, as before.
- One gate: `Sim.open(t, at)`, read by `has`, `mayPick`, `mayRoom`, `mayBreach`, `mayGrow`, the client and the rival.
- The rival grows too. With a caste to pick it takes the War hill, else a branch by seed and seat. It does not grow
  when it stores for a frost. `grow: 0` never grows.
- State: three `cg` slots (TIER, GROW, BRANCH). `WAR_VERSION` is 7, because every mission plays differently now.
  `tiers: false` gives the old rules (tests of single nodes use it).

Tried and dropped (do not retry without a new reason):
- A general gain per growth (faster laying, more housing): growing won 11 of 12 and early beat late 12 of 12. A build
  order, not a choice.
- A meat cost, and a one-minute pause: growers lost every match.
- Opening a ring of clay round the chamber when it grows. More open cells beside the queen let more attackers press
  her (`PRESS_OPEN`), and the Wall's guard post stopped holding a breach. Growth changes no nest geometry; the client
  should draw it instead (not drawn yet).
- The brood waiting while the chamber grows (a reviewer's fix for a pause that costs nothing when the nursery is
  full). Measured: growers lost 10 of 10 on The Crossing and The Stones. It is kept behind `growFreeze` and is off.
  The dodge it meant to close is still open.

Shipped numbers (5 seeds, both seats; W: war grower with spitters, D: deep grower, N: never grows):

| mission | W v D | W v N | D v N | default v N |
|---|---|---|---|---|
| crossing | 5–5 | 4–6 | 6–4 | 5–5 |
| frost | not run | not run | not run | 5–5 |
| stones | 2–8 | 4–6 | 5–5 | 6–4 |
| larder | 6–4 | 4–6 | 7–3 | 7–3 |
| narrows | not run | not run | not run | 7–3 |
| wall | 9–1 | 7–3 | 8–2 | 5–5 |

Read: growing is close to even against not growing for a bot, so it is neither a tax nor a must. Which branch is
better depends on the mission. On The Wall the War hill beats the Deep hill 9 of 10: not fixed. The Wall's guard
post with growth on: the queen lived through 5 of 5 controlled strikes with a guard (seed 5 ended at 320 of 800).

Open from the two outside reviews: the second growth opens nothing for a colony with no Lineage nodes; a locked raid
mode is turned into Press without a word; the rival retries a refused plug each think; the campaign caste is ordered
by the client on the tier event, so a headless replay lacks it; the Larder haul test moved seed (2 to 1) to pass.

Not known: how any of this plays for a person. Bots take a branch by seed, not by reading the map.

## Rooms by tier: a fungus garden, a hill that mends, and growth as a setting

After PR 406 the second growth opened nothing for a colony with no Lineage nodes, and base building had three rooms.

- **Fungus garden** (`ROOM.GARDEN`, `TIERS.rooms`): a Deep hill may dig it from its first growth, any hill from its
  second. Each open cell pays a seed at every `GARDEN_EVERY` (a minute) if a store cell has room, and houses one ant
  fewer (`per: -1` on the ants cap; the cap never falls under `REST_MIN`). Food with no trail to guard, paid for in
  housing and in clay. A raid can carry the seeds off like any others.
- **A full-grown hill mends its wounded** (`TIERS.heal`): at tier 3 an ant inside its own nest gets back a sixteenth
  of its health every `HEAL_EVERY` ticks. So Recall has a use beyond running away, for every hill, with or without
  Lineage nodes.
- **Setting "The tree"** (`cinderhill:war:growth`): grow in each mission (default), or deeds alone (`tiers: false`).
  Recorded with the rest of the settings at the start of a match, so the two shapes can be compared by play.
- `mayGrow` now counts only seeds that lie in a store cell, so the client and the rival are not told yes and then
  refused.
- The rival digs one garden room (16 cells) off the far end of its first nursery. Its left nursery slot moved right.
  It takes the second growth only with 60 seeds to spare.

Measured (5 seeds, both seats, steady minds): a Deep hill that digs gardens against one that does not: 5–5 on all six
missions. So gardens are not a must and not a trap for a bot, and their worth to a bot is not shown either: matches
end near tick 5,700, about three garden harvests after they are dug. On The Crossing at 12 seeds a hill that grows
twice as soon as it can lost 8–16 to one that never grows; held back to a 60 seed surplus it is 13–11, and one growth
only is 11–13. The second growth is a late-game buy, not a build order.

Not known: whether a person finds the garden worth its housing; whether mending makes a defended nest too hard to
take (no bot test separates it). The War hill still beats the Deep hill on The Wall (10–0 at 5 seeds).

## The Hunt: a third thing on the map (war build)

A sixth mission, third in the campaign: open ground, and a great beetle that never leaves a dead vole in the middle.
The hill that does the beetle more harm wins when it falls; at dusk, more harm wins. Queens are hard to kill here
(`queenHp: 6000`), so the mission is about the beetle and about what you can spare for it.

- Rules live in the sim. `mission.beast` is a table row (`at`, `hp`, `bite`, `hits`, `every`, `range`, `press`, `girth`).
  `sim.beast` is `[health, surface cell, bites taken this window]`. An ant on the surface with no ant to bite bites the
  beetle if she is within reach plus its girth. Every `every` ticks it bites the `hits` nearest ants of either hill.
  Harm is counted per hill in `CG.HARM`. `REASON.BEAST`, `EVENT.BEAST_BIT`, `EVENT.BEAST_DEAD`.
- The rival draws one raid trail to the beetle once it has soldiers to spare (4, 6 or 10 by mood) and thickens it at 12.
- The client draws the beetle, its reach as a dashed ring, its health over it, a dot on the small map, and the harm
  bar in place of the count of ants.
- Deeds open Hold fast and the Guard post, which The Stones opened before; The Stones still opens them too.

Numbers at 4 seeds, both seats: steady v steady 4 to 4, bold v steady 2 to 6, steady v timid 4 to 4, bold v timid 3 to 5.
The beetle falls between ticks 4061 and 8512 in most games; about a third run to dusk. 43 to 81 dead a side.

Tried and dropped: the beetle sitting on the central food pile with bite 12, three ants, every 10 ticks. About 100
dead a side and both hills starved.

Known and accepted: a player part way through the campaign now needs The Hunt before The Stones. Bold loses to
steady here more often than it wins, because it sends soldiers before it has enough. No person has played it yet.

Review fixes (outside adversarial review, same pull request): a garden pays only for full minutes its cells were
gardens (`CG.GROWN` accrues; painting a room for the last tick before the harvest earned a full harvest before).
The beetle's reach is a circle, the one drawn. Equal harm goes to the larger hill, as at dusk. A hill whose queen
is dead cannot win by the beetle. Each hill starts The Hunt with three soldiers (`kit.majors`). A Raid tap near
the beetle snaps to it. The harm bar is labelled. Open from that review, not built: array order decides who gets
the beetle's twelve bites a window when both hills crowd it; workers can be parked as bait; the carcass has no
use because the mission ends at the fall (a kill, recover, deliver phase is the proposed fix).
