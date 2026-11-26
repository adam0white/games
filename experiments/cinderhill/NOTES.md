# Cinderhill: notes

Working name for the ant colony game specified in `docs/design/colony/`. This directory holds the M0 work: the deterministic sim core, its tests and the spikes. There is no game page yet. `/cinderhill/` serves a determinism check page.

## What exists (2026-11-25)

| Path | What it is |
| --- | --- |
| `sim/` | The pure sim: plain ES modules, no dependencies, no build. Runs unchanged in Node, browsers and workerd |
| `sim/sim.js` | `Sim`: the tick (20 a second), ants as typed arrays, commands, events, `hashes()` |
| `sim/grid.js` | Both layers as one cell index space; materials; entrance links |
| `sim/flow.js` | Flow fields: breadth-first search per live goal (16 slots), rebuilt only when a change touches them |
| `sim/scent.js` | Three scent fields (trail, food, alarm): mass-conserving spread, 24-bit decay with a set half-life |
| `sim/math.js`, `sim/rng.js`, `sim/hash.js` | Table trig and integer `angleOf`; mulberry32 streams; 32-bit hashes |
| `sim/snapshot.js` | `snapshot(sim)` to bytes with a version header, `restore(bytes)` |
| `sim/replay.js` | `script(cfg, ticks)` (scripted orders), `replay(...)`, `firstDivergence(a, b)` |
| `sim/world.js` | Seeded terrain: surface with stones, a pond and four food piles; nest with soil bands, shaft and chamber |
| `sim/SPIKES.md` | Spike results S1, S2 and S4 with numbers |
| `test/` | `node --test` suites; CI runs them in the `changes` job (step "Cinderhill sim") |
| `spikes/` | S1, S2, S4 and the workerd harness; the planted fault `mutant.js` |
| `index.html`, `check.js`, `quick.js` | The determinism check page; the phone check runs it in WebKit and Chromium |

## Rules the sim keeps

- Integers only in the state. Positions are 1/256 cell in `Uint16`. Angles are 0..255 with table sine and cosine.
- `test/lint.test.mjs` rejects floating-point `Math` functions, `**`, `Date`, `performance`, locale calls, `crypto` and `.sort()` without a comparator anywhere in `sim/`.
- Everything that changes is in `hashes()` (subsystems: ants, scent, terrain, flow, rng, events, globals) and in `snapshot()`. The one exception is the flow distances, which restore rebuilds. They are hashed, so a wrong rebuild shows.
- Commands apply at the start of their tick in (tick, seat, id) order. A command for a past tick is refused with a `LATE` event.
- Random numbers come from separate streams (world, ants, spare), so a new draw in one place does not shift another.

## How to run

```
node --test experiments/cinderhill/test/                         # all tests, about 15 s
node experiments/cinderhill/spikes/s1.mjs 2000 5000              # S1 tick cost in Node
PLAYWRIGHT=<dir with playwright> node experiments/cinderhill/spikes/s2.mjs   # S2 Node and browsers
node experiments/cinderhill/spikes/s4.mjs [--ticks=8000]         # S4 snapshot size
node experiments/cinderhill/spikes/workerd.mjs                   # S1 and S2 in a local Durable Object (needs wrangler)
PLAYWRIGHT=<dir> node experiments/kit/check/phone.mjs cinderhill # the page in WebKit and Chromium
```

When a sim change alters play, `test/page.test.mjs` fails and prints the new hash to put in `quick.js`.

## Simplifications to revisit in M1

- Diggers dig the nearest marked cell, not the painted order, and carry no spoil. A dig crew is capped (4 per marked cell, 24 in all).
- Foragers seek in this order: the pile they last took from, the newest trail, the three scent sensors, a random walk. After a minute with nothing found they go home. The scripted orders do not give good foraging; that is tuning work.
- A field rebuild is a whole-field search (0.7 ms on the full map). Regional rebuilds and a per-tick rebuild budget are not built.
- Ants in a crowd pass through one another. Separation bends a path but never cancels the step.
- No duplicate-command check in the sim; the room drops duplicates (05-tech, room protocol).
