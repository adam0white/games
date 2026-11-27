# Cinderhill handoff (2026-11-26)

This covers where the R1 build in `experiments/cinderhill/` stopped. A new thread is starting a full rebuild from the merged spec (`docs/design/colony/`). The details are in `NOTES.md` (design decisions, review findings) and `sim/SPIKES.md` (performance and determinism reruns for each sim version). This file only points into them.

## Done

| Step (04-roadmap R1) | PR | Sim / snapshot version |
| --- | --- | --- |
| R0: pace gate in CI | #366 | 7 |
| Step 2: the spec's starting values, brood, stores | #370 | 8 |
| Page fixes for sim 8 with tests; major larvae drawn bigger | #373 | 8 |
| Step 3a: crew levels, the who-goes rule, the dig as an auto job, adult starvation, resting free count | #378 | 9 |
| Step 3b: doors, queues and jams (pace gate fixture `door1` / `door3`) | #379 | 10 |
| Step 4: goal manager: 64 goal slots, 32-bit distances, rebuild quota of 2 a rebuild point | #380 | 11 |

Each sim PR has its hashes in `quick.js`, S1/S2/S4 reruns in `sim/SPIKES.md`, mutations shown to fail, and a read-only review whose real findings were fixed. The page is unlisted at https://play.adamwhite.work/cinderhill/.

## Open

- **Step 5 not started**: husk, roof, bird (feature 6), sprouts and the bloom map (feature 7). Use `allocGoal` (sim 11) for the husk, midden and cover goals; the 16 fixed slots are full.
- **Not started**: step 6 (nest cutaway, the chapter 1 script in 02-spec section 4, the chapter and ledger cards), step 7 (saves, teaching, recording, sound and words, phone check) and step 8 (five fresh players).
- **Owner question, unanswered**: does a crew one short for under a quarter second count as a job with a gap? (`GAP_FOR` = 5 ticks in `spikes/replay-lab.mjs`, which the pace gate uses.)
- The lanes' cost in a large colony is not timed.
- Open sim 9 review findings that were not fixed are listed in `NOTES.md` (Who goes, Review and Second review).
- Goal manager caveats (`NOTES.md`, Goal manager): the digger and guard code reads a blank field (one waiting for its rebuild) as unreachable for the few ticks it waits. Snapshotting a full pool allocates about 22 MB while it encodes.

## Known bugs

- **Major larva size.** PR #373 draws a larva fed to be a major 1.35 times bigger (`larvaScale` in `nestview.js`). The bug is still listed as open: no player has confirmed that a major larva can be told apart at phone size.
- **Food distance on small maps.** The opening piles are placed at fixed distances from the entrance. The sim 8 reviews fixed piles that fell off a small map, one 5.7 cells out, and one 12.04 cells out (`NOTES.md`, Starting values, Review and Second review). The pace gate plays only the default map, so pile distances on smaller maps are not checked against the pace budget.
- **Shallow nests.** A colony nest under 17 cells deep has no room for the whole nursery, because the page always asks for 64 brood cells (`NOTES.md`, Starting values, Second review: "Not fixed").

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

The same list is in `NOTES.md`. From this handoff's merge, the rebuild thread owns `sim/` too.

## Tools

From `experiments/cinderhill/`:

- Tests: `node --test test/` (fast), or `CINDERHILL_LONG=1 node --test test/` (everything, about 3 minutes). The totals line starts with `ℹ`, not `#`.
- Pace gate, as CI runs it: `node spikes/pace-gate.mjs --minutes=12 --base-ref=origin/main --quiet`. It plays the median, passive and idle bots on 20 seeds and reads each pace-budget line on the worst seed. `pace-baseline.json` is a ratchet: a line that starts to pass fails the gate until you record it with `--update`. Two planted controls (the old quota opening, brood times ten) must each fail; the door fixtures must jam more than an open doorway.
- People lines from lab records: `node spikes/pace-gate.mjs --records <record.json ...>`.
- Replay a lab record: `node spikes/replay-lab.mjs <record.json> [parts...] [--out=report.md] [--json=stats.json]`. It replays every order and checks each 30 s hash; the first mismatch is the divergence. The report covers deliveries per minute, idle and queued ants, trails, digs, alarms, brood, deaths and stalls.
- Spikes, in `spikes/`: `node s1.mjs 2000 5000` (tick time), `node s4.mjs --ants=5000 --ticks=N` (snapshot size), `PLAYWRIGHT=<dir> node s2.mjs [--colony]` (cross-engine determinism), `node workerd.mjs [--colony]`, `node goals.mjs 2000 [--all]` (64 goals and the rebuild quota).
- Phone check, from the repo root: `PLAYWRIGHT=<dir> node experiments/kit/check/phone.mjs cinderhill chromium|webkit`.

## Traps

- Widening a field or adding a global changes every hash even when play is identical. To show play is unchanged, compare ant arrays, globals and terrain every 50 ticks against a `git worktree` of the previous version; do not rely on the totals.
- The pace gate and the reviewer both read the working tree. Do not edit files while either one runs.
- Foreground shell commands move to the background after about 3 minutes. Run long suites in the background, or give them a timeout.
- zsh aborts a command when a glob matches nothing.
- Pages call `lab('cinderhill')`; agent test runs add `?labRunSource=agent`. A new lab slug must be added to the human framework's `LAB_PROTOTYPES`, or CI fails. `experiments/kit/lab.js` belongs to another thread; use only its public API.
- `docs/design/colony/` is the spec; do not edit it from a build branch. Put build decisions in `NOTES.md`.
- The live deploy lands about 15 to 20 minutes after main's CI passes. Check it with `curl -s https://play.adamwhite.work/cinderhill/sim/sim.js | grep -o "SIM_VERSION = [0-9]*"`.
- Some mutants are equivalent. Say so in SPIKES.md instead of writing a test that cannot fail (sim 11 has three).
- A failing `assert.deepEqual` on two 90,000-cell typed arrays can spin for minutes while Node builds the diff. Compare them with a plain loop and `assert.ok`.
- A mutation script killed by an outer `timeout` leaves its mutant in the source, because Python skips `finally` on SIGTERM. Time out the inner test run instead, and grep for every mutant site afterwards.
- A snapshot rebuilds only clean fields. Any field that is marked but still exact at a tick boundary breaks restore. Keep a rebuild point last in the tick, and rebuild in anything that changes terrain between ticks.
- A door fixture that is not really narrowed passes silently. The gate now compares `door3` (a real 3-cell door) with an open doorway and fails if the door does not jam more.
- Firefox is not installed on this Mac, so S2 covers Node, workerd, Chromium and WebKit only.
