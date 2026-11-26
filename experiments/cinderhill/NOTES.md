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
| `sim/snapshot.js` | `snapshot(sim)` to bytes with a version header, `restore(bytes)`; format 3 models each value and range-codes it (S4: 61.8 KB at 5,000 ants, 24,000 ticks) |
| `sim/rangecoder.js` | The binary range coder the snapshot uses: adaptive probabilities, integers only, one walk for both directions |
| `sim/replay.js` | `script(cfg, ticks)` (scripted orders), `replay(...)`, `firstDivergence(a, b)` |
| `sim/world.js` | Seeded terrain: surface with stones, a pond and four food piles; nest with soil bands, shaft and chamber |
| `sim/SPIKES.md` | Spike results S1, S2, S3 and S4 with numbers |
| `test/` | `node --test` suites; CI runs them in the `changes` job (step "Cinderhill sim") |
| `spikes/` | S1, S2, S3, S4, the trail-shape cases (`trail-shape.mjs`) and the workerd harness; the planted fault `mutant.js` |
| `check.html`, `check.js`, `quick.js` | The determinism check page; the phone check runs it in WebKit and Chromium (`cinderhill check`). `quick.js` holds the short check (`EXPECTED`) and the long one (`LONG`, `EXPECTED_LONG`: S2's 12,000 ticks of 2,000 ants), which the page runs in slices and reports as one copyable line |
| `index.html`, `painter.js` | The trail painter page: menu, pause card, tool strip, HUD, the ant card, the frame sampler (`?fps=1`) |
| `host.js` | Runs the sim for the page: 20 ticks a second from the frame clock (at most 4 a frame), the command log, crews and the "why" for one ant |
| `gestures.js` | The touch rules as a pure reducer (pointer events in, preview, order, alarm, pan and zoom actions out); `test/gestures.test.mjs` |
| `render.js` | WebGL2: the ground as one full-screen pass (terrain and scent as textures), ants as one instanced draw with a procedural body, interpolated between ticks; context loss and restore |
| `words.js` | English and Turkish words (the Turkish is not checked by a native speaker) |

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

The painter takes `?ants=500|2000|5000` and `?fps=1` (frame, work and sim tick times on screen, for a real phone).

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
- Ant crews are counts only: the sim has no "ants wanted" number, and the page says so.
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

## Simplifications to revisit in M1

- Diggers dig the nearest marked cell, not the painted order, and carry no spoil. A dig crew is capped (4 per marked cell, 24 in all).
- Foragers seek in this order: the trail that led them out last (their route), the pile they last took from, the newest trail, the three scent sensors, a random walk. After a minute with nothing found they go home. The scripted orders do not give good foraging; that is tuning work.
- A field rebuild is a whole-field search (about 1.3 ms on the full map with octile costs, 0.7 ms before). Rebuilding all 9 live fields in one tick now takes about 12 ms, over the 10 ms tick budget. Regional rebuilds and a per-tick rebuild budget are not built.
- Ants in a crowd pass through one another. Separation bends a path but never cancels the step.
- No duplicate-command check in the sim; the room drops duplicates (05-tech, room protocol).
