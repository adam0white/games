# Cinderhill M0 spikes: S1, S2, S4

Pass lines are from `docs/design/colony/04-roadmap.md`. Measured on 2026-11-25 on one Apple-silicon Mac, with Node 26.13.1 (the repository pins 26.12.0; the tests pass on both), Playwright 1.64.1, and wrangler 4.168.0 running workerd locally. Scripts are in `../spikes/`; NOTES.md one level up says how to run them.

The world in every spike is the full map: a 256 x 256 surface and a 192 x 128 nest, 90,112 cells in all. Three scent fields cover every cell. The orders come from `script()` in `replay.js`: rooms dug every minute, a trail to each food pile, random trail strokes, alarms on the surface and in the nest, and recalls. There are 11 to 12 live flow fields (home, exit, dig, alarm, up to four trails, four food piles; the cap is 16).

## S1: tick cost

Pass line: under 10 ms a tick locally; 20.0 ticks a second deployed for 10 minutes; the room role's CPU and cost written down.

**Node, 5,400 timed ticks after 600 warm-up ticks:**

| Ants | Mean | p95 | Max | Ticks with a flow rebuild (mean) | Verdict |
| --- | --- | --- | --- | --- | --- |
| 2,000 | 1.65 ms | 1.74 ms | 4.10 ms | 35 (2.45 ms) | Pass |
| 5,000 | 1.86 to 2.03 ms | 2.00 to 2.83 ms | 3.96 to 17.41 ms | 35 (2.61 to 2.85 ms) | Pass on mean and p95 |

The 5,000-ant row spans three runs. The maximum moved between 4 and 17 ms from run to run, and it did not fall on rebuild ticks. A garbage collection or other machine noise is the likely cause; that is not established.

- Worst case for flow: rebuilding all 9 live fields of the 5,000-ant world in one tick takes 6.6 ms (0.74 ms a field). With all 16 slots live this would be about 12 ms, over the pass line. Two things keep this from happening in play. Digging only opens cells, and an opened cell is repaired in place: a breadth-first relaxation from the new cell, not a rebuild. Only closing a cell (a cave-in or a plug) or a goal's source change forces a full rebuild. Before the in-place repair, ticks with a dig averaged 7.4 ms and peaked at 10.7 ms. No per-tick budget for full rebuilds exists yet.
- Scent dominates the plain tick. Three fields over 90,112 cells cost about 1.5 ms. Ants add about 0.1 ms per thousand.

**Durable Object under workerd (`wrangler dev`, local), 2,400 ticks in 20-tick requests timed by the client:**

| Ants | Mean | p95 of 20-tick batches | Max | Empty request round trip | Verdict |
| --- | --- | --- | --- | --- | --- |
| 2,000 | 1.60 ms | 1.79 ms | 1.90 ms | 1.28 ms per request | Pass locally |
| 5,000 | 1.92 ms | 2.29 ms | 2.38 ms | 1.29 ms per request | Pass locally |

The request round trip is included in these numbers. Clocks do not advance during computation in workerd, so the room cannot time itself.

**Not done:** a deployed Durable Object. So there is no measurement of 20.0 ticks a second deployed for 10 minutes, and no CPU per second or cost per room-hour for either room role (relay only or authority). The local numbers suggest the authority role costs about 2 ms of CPU per tick, 40 ms a second. That is an extrapolation and has not been measured on Cloudflare.

## S2: determinism across engines

Pass line: the same hash everywhere over 10 minutes and a 60-minute bot soak. The lint, a planted mutation and a flipped state byte must each fail the check and name the subsystem.

Seed 2026, 2,000 ants, 12,000 ticks (10 minutes), 41 orders. Every engine got the same JSON command log, and each page checked the log's SHA-256 against Node's. Hashes of all seven subsystems were compared every 20 ticks, 600 records per engine.

| Engine | Version | Same command log | Clean run vs Node | Planted mutation vs Node | Wall time |
| --- | --- | --- | --- | --- | --- |
| Node | 26.13.1 | (reference) | final total 2774816872 | diverges at tick 20, `ants` | 20.7 s |
| Chromium | 156.0.8078.4 | yes | same at all 600 records | diverges at tick 20, `ants` | 20.5 s |
| WebKit | 27.2 | yes | same at all 600 records | diverges at tick 20, `ants` | 16.2 s |
| workerd (Durable Object, local) | wrangler 4.168.0 | yes | same at all 600 records | not run | 19.9 s |
| Firefox | - | - | **not run** | - | - |

**Verdict: pass for Node, Chromium, WebKit and workerd over 10 minutes. Firefox and the 60-minute soak are open.**

- **Lint** (`test/lint.test.mjs`): the sim files pass. A list of known-bad lines (`Math.sin`, `Math.random`, `**`, `Date`, `performance.now`, `toLocaleString`, `localeCompare`, `Intl`, `.sort()` and others) each fails.
- **Flipped byte** (`test/byteflip.test.mjs`): one byte flipped at tick 60, in each of the seven subsystems in turn. Each time, `firstDivergence` names tick 60 and only that subsystem.
- **Planted mutation** (`spikes/mutant.js`): after each ant step, the last mantissa bit of `Math.sin(...)` turns the ant one angle unit. The spike also compared the raw bits of `Math.sin` for the 20,000 arguments the first 20 ticks use. Chromium 156 differed from Node 26.13 on 631 of them and WebKit on 891. So the divergence comes from the engines, not from the harness. With the mutation, both browsers diverge from Node at the first comparison (tick 20), and the check names `ants`. Without it, both match for all 12,000 ticks.
- A surprise: Chromium and Node do not share `Math.sin` bits, though both run V8. The two V8 versions differ. "Node agrees with Chromium" is therefore no evidence that floating-point code is safe.
- **Firefox: not run.** Playwright's Firefox build is not installed on this machine. It was not installed for this spike, as the instructions asked.
- **60-minute bot soak: not done.** The longest run is the 10-minute replay above.
- **In CI:** the phone check now runs the page's short replay (600 ticks, 300 ants) in WebKit (iPhone 13) and Chromium (Pixel 7) and fails if the hash differs from Node's. It failed as expected with a wrong expected hash.

## S4: snapshot size

Pass line: a late-join snapshot of a dug nest plus 5,000 ants, compressed, under 64 KB.

The snapshot holds every state array: terrain, all three scent fields, all ant fields, globals, random streams, goals and queued commands. It leaves out the flow distances, which restore rebuilds exactly; the restore check reached the same total hash. Arrays are byte-shuffled before compression. The nest was pre-dug with galleries at four depths, shafts and eight rooms (2,384 open nest cells), then played with the scripted orders.

| Played ticks | Ants on the surface | Compressed (gzip; deflate the same) | Scent | Ants | Terrain | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 3,000 (2.5 min) | 259 | 60.5 KB | 29.9 KB | 24.1 KB | 2.6 KB | Pass |
| 8,000 (6.7 min) | 161 | 74.6 KB | 41.4 KB | 25.7 KB | 2.6 KB | **Fail** |

The raw snapshot is 1,776 KB. At 8,000 ticks the trail field alone compresses to 30.3 KB; the ant fields `lastCell`, `best`, `stall` and `since` add 10.2 KB between them.

**Verdict: fail.** The pass holds only early in play. Scent is the largest part and grows as trails accumulate; ant fields come second.

Options, none built yet:
- Send the ant fields that follow from others (`lastCell`, `best`) as nothing, and rebuild them on restore.
- Store positions relative to the cell.
- Send the snapshot from a checkpoint a few seconds old, plus the commands since; the joiner replays them.
- Quantize the scent for sending and run the joiner on coarse scent until its next checkpoint. That gives up exact lockstep for the joiner until then, so it needs a protocol decision.

The roadmap's fallback, "terrain as a seed plus a dig log", does not help. Terrain is already the smallest part (2.6 KB).
