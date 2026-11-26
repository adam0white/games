# Cinderhill M0 spikes: S1, S2, S3, S4

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

## S1 deployed

Pass line: 20.0 ticks a second deployed for 10 minutes; the room role's CPU and cost written down.

The room is `workers/cinderhill/` (Worker `games-cinderhill`, one SQLite Durable Object per room code); its NOTES.md says how it works and how to run the load test. Each run: 4 scripted Node players on one Mac, each running the sim in lockstep at 20 Hz, sending about 31 orders a minute (every 10th sent twice) and a hash every second. Worker version 591301fd, 2026-11-26 02:00 to 02:31 UTC. The room ran `SIM_VERSION` 1, the sim before the trail painter and trail-shape changes (the re-runs under S2); the CPU numbers predate those changes, which by the Node re-run above did not change the tick cost. Ticks a second and jitter are measured at the players, because a deployed Durable Object's clock does not advance during computation. CPU, duration and rows written are Cloudflare's own Durable Object analytics (`durableObjectsPeriodicGroups`, full minutes only).

| Run (10 min, 4 players) | Ticks/s | Gap sd / p99 / max | DO CPU | Bytes/s per player (in / out) | Resets | Hash check | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Relay (players at 5,000 ants) | 20.00 | 12 / 78 / 175 ms | 3.7 ms/s | 265 / 93 | 0 | 1,798 room compares, 0 differ; offline replay 2,398, 0 differ | **Pass** |
| Authority, 2,000 ants | 20.01 | 13 / 80 / 241 ms | 91 ms/s (76 to 137 by minute) | 266 / 94 | 1 at 27 s, back in 2.9 s | 2,296 room compares, 0 differ; offline 2,400, 0 differ | **Pass** |
| Authority, 5,000 ants | 19.98 to 19.99 | 16 / 81 / 504 ms | 91 ms/s (85 to 97 by minute, 7 minutes) | 265 / 93 | 1 at 25 s, back in 3.2 s | 2,300 room compares, 0 differ; offline 2,396, 0 differ | **Fail by 0.02**: the 3.2 s reset |

- "Gap" is the time between live sealed frames at a player; 50 ms is on time. "Bytes" are WebSocket payloads, not counting framing or TLS.
- No exceeded-CPU or exceeded-memory errors in any run. No clock slips (the room never had to skip a tick). Every order was stored once: (seat, id) unique in every log, and every planted repeat was dropped (120 to 124 a run).
- The authority room's CPU did not grow with ants as the bench predicted (5.7 ms a tick at 5,000 would be 114 ms/s). Both counts land near 90 ms/s. Scent over the full map is the fixed part of the tick (S1 above), which may explain it; not established.
- **Cost per room-hour**, from https://developers.cloudflare.com/durable-objects/platform/pricing/ (read 2026-11-25; page dated 2026-11-13), above the monthly included amounts: duration $12.50 per million GB-s, billed on wall time at 128 MB per object whatever the role; requests $0.15 per million, incoming WebSocket messages counted 20 to 1; SQLite rows written $1.00 per million. The page bills no CPU time for Durable Objects.

| Role | Duration | Requests | Rows written | Total per room-hour |
| --- | --- | --- | --- | --- |
| Relay (first schema) | 460.8 GB-s: $0.0058 | 22,600 in, 1,130 billed: $0.0002 | 37,240: $0.0372 | **$0.043** |
| Authority 2,000 (first schema) | 460.8 GB-s: $0.0058 | $0.0002 | 37,407: $0.0374 | **$0.043** |
| Authority 5,000 (first schema) | 460.8 GB-s: $0.0058 | $0.0002 | 37,329: $0.0373 | **$0.043** |
| Relay, 2,000 ants (orders table, 5 min) | 460.8 GB-s: $0.0058 | $0.0002 | 14,280: $0.0143 | **$0.020** |
| Authority 2,000 (orders table, 5 min) | 460.8 GB-s: $0.0058 | $0.0002 | 14,430: $0.0144 | **$0.020** |

- The roles cost the same: duration is wall time, and CPU is not billed. Rows written were most of the bill under the first schema (a second index on the command table, and the sealed mark rewritten on every tick with a command). The current schema (version 42ee31d6; one row per order keyed by tick, the mark written once a second) halves that. Its two 5-minute checks ran at the same time in two rooms, 02:32 to 02:37 UTC: both 20.00 ticks a second, gap sd 12 and 15 ms, 0 hash differences (898 and 1,197 room compares; 1,198 and 1,197 offline), no resets, authority CPU 85 ms/s against relay 3.4 ms/s. The room counted about 7,450 orders and 3,440 mark writes an hour; Cloudflare reports 14,300 rows written. The other 3,400 or so are not explained.
- **Idle cost:** none per hour that was found on the pricing page. An empty room stops its clock after 5 s and is then evicted; duration is billed only while the object is in memory. What stays is SQLite storage, $0.20 per GB-month above 5 GB included: a room holds its command log (about 7,500 orders an hour of play at this load, under 100 bytes each) and, for an authority room, one checkpoint (52 KB at 2,000 ants, 67 KB at 5,000). The Worker itself costs nothing while unused.
- **Unexplained reset.** Eight of eleven authority rooms (all five 5,000-ant smoke runs, four of them with result files in `loadtest/results/`; both 10-minute runs; `resume1`) lost all their sockets once with close code 1006 about 25 to 30 s after it first started, or later in one case (71 s). The new instance ran the same version id, so it was not a deploy; tail showed no exception; `limits.cpu_ms` set to 300,000 did not change it; a 5,000-ant sim is about 7 MB. The three that did not: the 70 s smoke run at 300 ants, the 120 s smoke run at 2,000 ants, and the 5-minute check on the current schema at 2,000 ants. No relay room has reset (3 rooms, 16 minutes). Recovery each time: the players reconnected, the room restored its checkpoint and replayed to its mark, with 0 hash differences after, in 2.0 to 3.3 s. A guess, not checked: the platform moves or restarts a new object that uses much CPU.
- **Deploy-then-resume** (authority, 2,000 ants, 8 minutes, room `resume1`, `loadtest/results/deploy-resume.json`): a new version was deployed 90 s into the run (01:53:14 to 01:53:18 UTC). The room kept running the old version with its sockets open for 300 s more. At 01:58:18, 300 s after the deploy, all four sockets closed with 1006 at tick 7,869. The players had a welcome from the new version 2.60 s later and their next frame at the same moment. The room restored its checkpoint at tick 7,800 and replayed 85 ticks; 0 hash differences in 342 compares after, 0 in 1,914 offline. Each order was stored once (991; 16 repeats dropped). This run also had the unexplained reset at 71 s (2.0 s). So a deploy cuts an occupied room off for about 2.6 s, up to 5 minutes after the deploy, and play resumes where it was; the 5-minute wait is Cloudflare's, not the room's.

**Recommendation: relay.** Both roles hold 20.0 ticks a second apart from the reset, and both cost the same, $0.020 a room-hour with the current schema ($0.043 with the first), because Durable Objects bill wall time, not CPU. The relay uses 3.7 ms of CPU a second against 91 ms; it has the larger margin under the per-request CPU limit, restarts faster (nothing to replay), and has not shown the reset (8 of 11 authority rooms did). Desync detection works in both: the relay compares the players with each other. What the relay gives up is a server copy of the state, which is needed for join snapshots in a room whose players are all gone and for refusing a forged state. Keep authority behind the debug switch until one of those is needed, and look at the reset before using it.

**Not done:** a room soak longer than 10 minutes; more than one machine's players (all four players shared one Mac, so their network paths were the same); players on phones.

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

**Verdict: pass for Node, Chromium, WebKit and workerd over 10 minutes. Firefox is open. The 60-minute soak is in "S2 soak" below.**

- **Lint** (`test/lint.test.mjs`): the sim files pass. A list of known-bad lines (`Math.sin`, `Math.random`, `**`, `Date`, `performance.now`, `toLocaleString`, `localeCompare`, `Intl`, `.sort()` and others) each fails.
- **Flipped byte** (`test/byteflip.test.mjs`): one byte flipped at tick 60, in each of the seven subsystems in turn. Each time, `firstDivergence` names tick 60 and only that subsystem.
- **Planted mutation** (`spikes/mutant.js`): after each ant step, the last mantissa bit of `Math.sin(...)` turns the ant one angle unit. The spike also compared the raw bits of `Math.sin` for the 20,000 arguments the first 20 ticks use. Chromium 156 differed from Node 26.13 on 631 of them and WebKit on 891. So the divergence comes from the engines, not from the harness. With the mutation, both browsers diverge from Node at the first comparison (tick 20), and the check names `ants`. Without it, both match for all 12,000 ticks.
- A surprise: Chromium and Node do not share `Math.sin` bits, though both run V8. The two V8 versions differ. "Node agrees with Chromium" is therefore no evidence that floating-point code is safe.
- **Firefox: not run.** Playwright's Firefox build is not installed on this machine. It was not installed for this spike, as the instructions asked.
- **60-minute bot soak:** see "S2 soak" below.
- **In CI:** the phone check now runs the page's short replay (600 ticks, 300 ants) in WebKit (iPhone 13) and Chromium (Pixel 7) and fails if the hash differs from Node's. It failed as expected with a wrong expected hash.

**Re-run after a sim change (2026-11-25, trail painter PR).** Foragers now keep following the newest trail while they are on it, instead of dropping it 30 seconds into their trip (`sim.js`, the trail rule in the forager step). That changes play, so every hash above changed. S2 was run again with the same script: Node's final total is now 471678023, and Chromium 156 and WebKit 27.2 again match Node at all 600 records; the planted mutation still diverges at tick 20 in `ants`. workerd was not re-run. S4 at 5,000 ants was re-run too: 36.8, 44.4 and 57.9 KB at 3,000, 8,000 and 24,000 ticks (was 37.6, 43.8 and 54.8 KB), still under 64 KB and restoring to the same hash. The S1 numbers predate the change.

**Re-run after the trail-shape change (2026-11-25, `SIM_VERSION` 2).** Trails now keep their drawn shape (section "Trail shape" below). That changes play, so every hash changed again. S2 with the same script: Node's final total is now 158760334; Chromium 156.0.8078.4 and WebKit 27.2 match Node at all 600 records, and the planted mutation still diverges at tick 20 in `ants`. workerd and Firefox were not run. The phone check (`cinderhill`, `check` and `orders` in WebKit and Chromium) passes with the new `quick.js` hash.

S1 re-run, Node 26.13.1, 5,400 timed ticks after 600 warm-up: 2,000 ants mean 1.61 ms, p95 1.68 ms, max 3.38 ms; 5,000 ants mean 1.87 ms, p95 2.00 ms, max 2.73 ms; 34 ticks with a flow rebuild (mean 2.32 and 2.47 ms). Rebuilding all 9 live fields at once: 6.15 ms (0.68 ms a field). Within the earlier numbers: a trail's field costs what a plain field cost, and the per-ant work added is one comparison.

## S2 soak

Pass line: the same hash everywhere over a 60-minute bot soak.

Seed 2026, 2,000 ants, 72,000 ticks (60 minutes of play), 249 scripted orders from `script()`; command log SHA-256 begins `f3d5489486deeeb5`, checked by every engine. Hashes of all seven subsystems were compared every 20 ticks: 3,600 records per engine. Run with `spikes/s2.mjs --ticks=72000` and `spikes/workerd.mjs --ticks=72000`, first on `SIM_VERSION` 1 (2026-11-25) and again on `SIM_VERSION` 2, the trail-shape sim (2026-11-26).

| Engine | Version | Sim 2: clean run vs Node | Sim 2: wall time | Sim 1: clean run vs Node | Planted mutation vs Node (both) |
| --- | --- | --- | --- | --- | --- |
| Node | 26.13.1 | (reference) final total 1035232780 | 118 s | (reference) final total 87767665 | diverges at tick 20, `ants` |
| Chromium | 156.0.8078.4 (Playwright 1.64.1) | same at all 3,600 records | 121 s | same at all 3,600 records | diverges at tick 20, `ants` |
| Chromium | 159.0.8154.6 (Playwright 1.66 alpha) | not run | - | same at all 3,600 records | diverges at tick 20, `ants` (sim 1) |
| WebKit | 27.2 (Playwright 1.64.1) | same at all 3,600 records | 94 s | same at all 3,600 records | diverges at tick 20, `ants` |
| workerd (Durable Object, local) | wrangler 4.168.0 | same at all 3,600 records | 117 s | same at all 3,600 records | not run |
| Firefox | - | **not run** | - | **not run** | - |

**Verdict: pass for Node, Chromium, WebKit and workerd over 60 minutes, on both sim versions. Firefox is open:** Playwright's Firefox build is not installed on this machine (neither firefox-1578 nor firefox-1555), and it was not installed for this run.

- The planted mutation again came from the engines: `Math.sin` bits differed from Node on 631 of 20,000 arguments in Chromium and 891 in WebKit.
- Deployed workerd was also compared with Node, by a different route (sim 1): in every S1 room above, an offline Node replay of the room's stored command log matched every hash the players sent (2,400 records a room), and in the authority rooms the deployed Durable Object's own sim agreed with the players at every compare. The longest of these is 10 minutes, not 60.
- Not done: a 60-minute soak through a live room (the soak above is a replay of a fixed command log in each engine, not players sending orders over the network).

## S3: phone frames

Pass line (04-roadmap): 30 fps or better with 2,000 ants on an iPhone 13 class phone.

Script: `../spikes/s3.mjs`. It opens the trail painter (`/cinderhill/`), draws a trail from the entrance to the nearest food pile with one finger, waits 4 s, then records every frame for 10 s. "Work" is the page's own time inside a frame (sim ticks due, uploads, the WebGL draw calls and the 2D overlay); the GPU's time is not in it. "Lift to applied" is the time from the finger lift to the order's state turning `applied` in the page; an order applies at the start of the next tick, so it is up to one tick (50 ms) plus a frame. Run on 2026-11-25, Playwright 1.64.1, an Apple M4 Mac.

| Browser (emulated phone) | Ants | Frames | Frame mean | Frame p95 | fps | Work mean / p95 | Sim tick mean / p95 | Ants drawn | GPU reported | Lift to applied |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WebKit 27.2 (iPhone 13, 390 x 664, dpr 2) | 2,000 | 720 | 13.9 ms | 15 ms | 72 | 0.54 / 2 ms | 1.37 / 2 ms | 1,373 | Apple GPU | 64 ms |
| WebKit 27.2 (iPhone 13) | 5,000 | 721 | 13.9 ms | 15 ms | 72 | 0.65 / 2 ms | 1.81 / 2 ms | 3,407 | Apple GPU | 64 ms |
| Chromium 156 headless (Pixel 7, 412 x 839, dpr 2) | 2,000 | 193 | 51.8 ms | 66.7 ms | 19 | 2.39 / 3.4 ms | 2.01 / 2.3 ms | 1,372 | SwiftShader (software) | 14 ms |
| Chromium 156 headless (Pixel 7) | 5,000 | 136 | 74.0 ms | 83.4 ms | 14 | 4.14 / 5.8 ms | 2.55 / 2.9 ms | 3,393 | SwiftShader (software) | 8 ms |
| Chromium 156 headless, ANGLE on Metal (Pixel 7) | 2,000 | 600 | 16.7 ms | 16.7 ms | 60 | 1.29 / 4.8 ms | 3.23 / 4.8 ms | 1,377 | Apple M4 (Metal) | 21 ms |
| Chromium 156 headless, ANGLE on Metal (Pixel 7) | 5,000 | 601 | 16.7 ms | 16.8 ms | 60 | 1.82 / 6.3 ms | 4.67 / 6.0 ms | 3,407 | Apple M4 (Metal) | 70 ms |

WebKit timer values come in whole milliseconds, so its p95 reads 15 ms. "Ants drawn" counts the ants on the shown layer; the rest are in the nest.

**Verdict: pass in emulation, not shown on a phone.** With a hardware GPU, both engines hold their frame rate at 2,000 and at 5,000 ants, with the page's own work under 7 ms at p95. Headless Chromium's default software renderer (SwiftShader) runs at 19 fps at 2,000 ants. That is the renderer, not the page: the same browser on Metal holds 60 fps, and CI's phone check runs on that software renderer, so CI is no frame-rate gate.

This is an emulated phone. The CPU and GPU are an M4 Mac's. An iPhone 13 (A15) has a slower CPU and a much smaller GPU. What is likely to matter on the phone, from these numbers: the sim tick (1.4 to 1.8 ms here, 20 times a second) is small; the full-screen ground shader at dpr 2 (it has fbm noise and smooth contours per pixel) is the most likely cost; ants are one instanced draw. None of that is measured on a phone. To measure on a real phone, open `/cinderhill/?fps=1` (frame mean and p95, work, sim tick, ants drawn, dpr and the GPU string on screen) or `/cinderhill/?fps=1&ants=5000`.

- **WebGL context loss:** the page keeps the sim running while the context is gone, and rebuilds every GPU resource on `webglcontextrestored`. The phone check loses and restores the context in both engines (`cinderhill orders`) and checks frames are drawn again.
- **Worker:** not used. The sim runs on the main thread; its tick is a few ms at most here, and a Worker would add a copy of every ant position per tick. Move it if a real phone shows long frames on tick frames.
- **Not done:** a real iPhone 13 or Android phone; Firefox; a long run (thermal throttling).

## S4: snapshot size

Pass line: a late-join snapshot of a dug nest plus 5,000 ants, compressed, under 64 KB.

**Verdict: pass, lossless, at 3,000, 8,000 and 24,000 ticks (snapshot format 2, 2026-11-25).** Format 1 failed at 8,000 ticks.

The world: seed 2026; the nest pre-dug with galleries at four depths, shafts and eight rooms (2,384 open nest cells); then the scripted orders `script(seed 2026, ticks)` played for that many ticks. Each tick count is its own run, as `spikes/s4.mjs` does (a longer script draws its random strokes in a different order, so a staged run gives other states). Sizes are gzip through `CompressionStream`, as a browser or workerd has it; deflate gave the same within 0.1 KB.

| Ants | Played ticks | Ants on the surface | Format 1 gzip | Format 2 coded | Format 2 gzip | Scent | Ants part | Terrain | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5,000 | 3,000 (2.5 min) | 259 | 60.5 KB | 37.6 KB | 37.5 KB | 19.5 KB | 16.4 KB | 1.3 KB | Pass |
| 5,000 | 8,000 (6.7 min) | 161 | 74.6 KB | 43.8 KB | 43.7 KB | 24.1 KB | 17.8 KB | 1.4 KB | Pass |
| 5,000 | 24,000 (20 min) | 2,560 | 96.2 KB | 54.8 KB | 54.7 KB | 28.2 KB | 24.2 KB | 1.4 KB | Pass |
| 2,000 | 3,000 | 180 | 51.4 KB | 32.6 KB | 32.4 KB | 22.6 KB | 8.2 KB | 1.3 KB | Pass |
| 2,000 | 8,000 | 287 | 66.3 KB | 40.1 KB | 40.0 KB | 28.8 KB | 9.4 KB | 1.4 KB | Pass |
| 2,000 | 24,000 | 258 | 81.2 KB | 43.8 KB | 43.8 KB | 31.6 KB | 9.9 KB | 1.4 KB | Pass |

Part sizes are coded bytes (the coder's output is already near entropy, so gzip adds nothing). Encoding takes 40 to 70 ms and restoring 40 to 60 ms in Node on this Mac; restore includes rebuilding the live flow fields. Every run restored to the same total hash.

**Method (sim/snapshot.js, sim/rangecoder.js).** Format 1 wrote every state array byte-shuffled and left compression to gzip. Format 2 writes the same state through a binary range coder with adaptive probabilities (the LZMA design, 15-bit probabilities, integers only) and models the values instead of the bytes. Nothing is lost and nothing is quantized: restore gives the same hash in every subsystem, the restored sim re-encodes to the same bytes, and the next 2,000 ticks match tick for tick (test/snapshot.test.mjs, at three random ticks). Each prediction below is followed by an exact residual or an escape, so values no play produces also round-trip (the test corrupts every state array to check that).

| Part | Format 2 coding | Gain measured on 5,000 ants, 24,000 ticks |
| --- | --- | --- |
| Scent | Open cells only (closed cells hold 0; a list carries any that do not). Each cell predicted as left + up - upper-left, the residual coded in a context of how much those neighbours differ; all-zero neighbourhoods get their own context | 52.9 KB to 28.2 KB |
| Ant position | The cell as its rank among the layer's open cells, through an adaptive 12-bit tree per layer and job (ants share cells: diggers and guards at rest stand together), then the offset inside the cell | The cell: 10.7 bits an ant with a plain integer model, 6.9 with the tree |
| Ant fields | Job in the context of the spawn order (index mod 20); `since` as the difference from the tick (an ant that never changed mode has since equal to the tick); `lastCell` as same cell, one of five neighbours, or raw; `best` as the difference from the rebuilt flow distance at `lastCell` | `lastCell` and `best` together under 0.1 KB; job 0.9 KB to 0.1 KB; `since` 6.4 KB to 4.6 KB |
| Terrain | Material in a context of its left and upper neighbours; dig marks, dig work and links as lists of exceptions | 2.7 KB to 1.4 KB |

Measured and dropped: the median (MED) predictor, a least-squares predictor over up to eight neighbours (both larger than left + up - upper-left on the trail field), a second scent context axis for magnitude (no gain), and coding repeated in-cell offsets by reference (larger). The 11-bit probabilities LZMA uses cost about 4 KB more here: a near-certain zero then still costs 0.02 bits, over 200,000 scent cells.

**What dominates now.** The trail field, 22.6 KB at 24,000 ticks: about 7.5 bits for each of its 24,505 non-zero cells. Its low bits come from decay rounding and many small deposits and look like noise to every predictor tried. Then ant offsets, headings and `since`, which are close to uniform for moving ants (about 6, 6 and 7 bits an ant).

**Open risk, not measured:** the trail field grows with the area ants have walked. If every open surface cell (about 64,000) held trail scent at the same cost per cell, scent alone would come to about 60 KB and the pass would fail. The 24,000-tick run reaches 36% of them. A bot soak over a full match would show where play really goes.

**Not built: checkpoint plus command suffix.** A checkpoint is the same state at an earlier tick, so it is the same size; it would help the room reuse one snapshot for several joiners, not shrink it. Only the extreme form, the seed plus the whole command log, is smaller, and the joiner then replays every tick (about 2 ms a tick at 5,000 ants, S1: 48 s at 24,000 ticks). Because the lossless format passes on its own, neither was built, and join cost was not measured beyond the restore times above.

The roadmap's fallback, "terrain as a seed plus a dig log", does not help: terrain is 1.4 KB.

**Re-run after the trail-shape change (2026-11-25).** 5,000 ants, compared with `origin/main`'s sim on the same day and script (the table above predates the painter PR):

| Played ticks | gzip before / after | Scent before / after | Ants part before / after | Ants on the surface before / after |
| --- | --- | --- | --- | --- |
| 3,000 | 36.7 / 47.6 KB | 19.6 / 20.7 KB | 15.4 / 25.1 KB | 150 / 2,365 |
| 8,000 | 44.3 / 60.5 KB | 24.6 / 32.6 KB | 17.9 / 25.9 KB | 72 / 2,400 |
| 24,000 | 57.8 / 61.8 KB | 31.9 / 35.6 KB | 23.7 / 23.8 KB | 2,846 / 2,274 |

Still a pass, each restoring to the same hash, but the margin is now 3.5 KB at 8,000 ticks (the CI assertion) and 2.2 KB at 24,000. At 3,000 and 8,000 ticks the ants part grew with the number of ants on the surface; at 8,000 and 24,000 the scent part grew. Why more ants are out at those ticks, and why scent grew, is not established: the scripted colony runs in waves, and the change shifts them (at 2,000 ticks fewer ants were out than before: 597 against about 2,790). A likely factor is that ants now walk the drawn strokes, which are longer than the straight line, and lay carrier scent along them; that is not measured. The new state itself is small: trail paths are coded as steps (in `globals`, 0.2 to 0.3 KB with everything else there) and `via` is one small integer per ant. Predicting a homeward carrier's `best` from her steps along the trail was tried and saved nothing measurable, so it was dropped. The open risk above (scent growing with the area walked) is closer now.

## Trail shape (2026-11-25)

Pass line (todo lab-5w7.17; 02-spec 6.4; 09-round2-findings trap 9): ants on a trail walk the stroke as drawn, out to the food and home with it; tick cost stays within S1.

**The flaw.** A trail order laid scent along the stroke but set a flow goal only at its end cell, so ants walked the shortest way to the end: a dog-leg was walked as its hypotenuse. Homeward carriers took the shortest way home, and after one load a forager followed the pile's field straight, ignoring the trail.

**The rule now (`sim.js` `trailPath`, `flow.js` `rebuildTrail`).**
- The stroke becomes an ordered, 4-connected path of open surface cells. A diagonal step goes through an open side cell. Cells that are closed or that no ant can reach from home are left out, and the gap is bridged by the shortest way round: first inside a box 12 cells around the gap, then over the whole surface. Where the stroke comes back over a cell it already holds, the loop is cut out (loop erasure), so each cell is on the path once. At most 2,048 cells.
- The trail's field is one integer per cell, as before. On the path it holds the steps left along the path to the end; off it, 4,096 plus the steps to the nearest path cell (breadth-first, surface only). Descending it from anywhere reaches the trail, then walks it in the drawn order. No per-ant progress is needed outbound. Walking back is the reverse on the path: the neighbour holding one more.
- A carrier whose trip used a trail (`via`, one byte per ant) walks that trail back to its start, then takes the way home. A forager keeps that trail as her route for the next trip. `via` is cleared when she gives up or the trail's slot is reused.
- A surface change rebuilds a trail's field (the in-place repair assumes uniform distance); nest digging never touches it. Off the path, the field value is not progress along the trail, so there a new cell counts as progress for the stall rule.

**Candidates.** Three were considered: per-ant progress along waypoints, a corridor field, and this single field. The single field was built first because it reuses `nextCell`, the stall rule, the restore rebuild and the snapshot's prediction of `best` unchanged. It met every line below, including a tight U (arms 3 cells apart) and a self-crossing stroke, so per-ant progress was not built and has no numbers.

**Measured** (`spikes/trail-shape.mjs`; pass lines in `test/trail.test.mjs`). The setup is a 96 x 96 open surface with one entrance, 200 foragers, 6,000 ticks, and a pile at the stroke's far end. Deviation is the 4-connected steps from an ant's cell to the nearest cell of the drawn stroke's Bresenham line, computed by the script, not by the sim. It is sampled every tick for every forager outbound on the trail or homeward with food. "In order" means a load picked up after passing within 3 cells of each corner of the stroke, in order. The before column is `origin/main`'s sim with the same script.

| Stroke | Outbound mean / max, after | Homeward mean / max, after | Loads in order, after | Outbound mean / max, before | Homeward mean / max, before | Loads in order, before |
| --- | --- | --- | --- | --- | --- | --- |
| Dog-leg (east 31, north 33) | 0.21 / 2 | 0.22 / 1 | 795 of 795 | 16.82 / 34 | 1.08 / 3 | 0 of 800 |
| U (87 cells, ends 23 apart) | 0.28 / 1 | 0.14 / 1 | 590 of 590 | 5.15 / 11 | 6.90 / 13 | 0 of 1,684 |
| Tight U (arms 3 apart) | 0.29 / 1 | 0.16 / 1 | 851 of 851 | 0.65 / 2 | 1.45 / 2 | 0 of 3,933 |
| Self-crossing (loop cut out) | 0.30 / 2 | 0.14 / 1 | not checked | 0.49 / 2 | 0.55 / 3 | not checked |
| Dog-leg through a 7 x 7 stone | 0.84 / 5 | 0.72 / 5 | 729 of 729 | 16.82 / 34 | 2.02 / 5 | 0 of 800 |

All 200 ants made 2 or more round trips in every case after the change. Food stored falls on long strokes (dog-leg 644 against 710 before): the drawn way is longer, and that is the point. The stone case's 5 cells is the way round the stone. Before, the outbound sample counts are smaller because after one load ants followed the pile's field, not the trail.

**Decisions.** The stroke's first point is its nest end (02-spec: a trail is drawn from the nest). A loop in a stroke is dropped, not walked. A trail followed as a route outranks the remembered pile. Touching arms (adjacent path cells far apart along the path) are a shortcut the field allows; arms 3 apart showed none.

**Painter.** Driven once in WebKit (iPhone 13, deviceScaleFactor 2, 2,000 ants): an L from the entrance east 41 cells, then north 48. After 35 s the ants were on both legs and none on the diagonal.


## Eight directions (SIM_VERSION 3, 2026-11-26)

The change: ants move in eight directions, fields are octile distances (5 and 7), and a field never cuts a wall's corner (`../NOTES.md` has the rules). All numbers below were measured on an M4 Mac mini that was running other work, so tick times are noisy.

**Tests.** `node --test experiments/cinderhill/test/`: 55 pass. The flow test compares every field with a separately written Dijkstra over 8 directions with the same corner rule. Two planted faults each fail it: dropping the neighbour lowering from the in-place repair, and a corner rule that checks one side cell only. `test/diagonal.test.mjs`: a guard sent 40 cells diagonally to an alarm arrives before tick 470 and strays under 2.5 cells (the 4-direction sim arrives at tick 556 and fails); an ant cannot squeeze between two stones touching at a corner, and can once one is gone.

**Independent review.** Codex (`gpt-6.2-astra`, read-only) reviewed the sim diff. It found no lost bucket-queue entries, no repair that differs from a full rebuild, and no diagonal a field allows that movement refuses; Node and Bun (JavaScriptCore) gave the same hashes and snapshot bytes over 600 ticks. Its findings and what was done:
- Fixed: on a trail's path, `nextCell` scored path steps as walking cost, so where a bend came back beside an earlier cell an ant jumped across to the later one. It now takes the path cell holding one less (`test/trail.test.mjs` fails on the old code). Off the path it joined the path cell nearest the trail's end; it now joins the nearest.
- Fixed: separation used a square range and the larger axis gap; it now uses a distance estimate (max plus 3/8 min). The stall counter saturates instead of wrapping after 65,535 ticks.
- A second review of those fixes found: the ant aims two path cells ahead and so still cuts a bend that doubles back within one cell (a lone ant passes 1.04 cells from the bend cell's centre). Aiming one cell ahead on such a bend brought that to 0.61 cells, but moved S4 at 24,000 ticks from 60.6 to 64.9 KB (more ants stayed in the nest at that tick; why is not established), so it was not kept. A one-cell bend is below what a finger draws on purpose; a saturated stall counter stopped the kicks (it now wraps back into the kick cycle); replacing a trail kept an ant's progress `best` from the old path (it is now reset). The off-path test was made one that the old scoring fails.
- Kept, written down: `Uint16` distances end at 13,106 straight steps of one corridor; the stroke-gap bridge still searches four neighbours (the bridge is walkable, sometimes a few steps longer than the octile shortest).

**S1** (`spikes/s1.mjs 2000 5000 --ticks=3000`, interleaved with `origin/main`'s sim exported to a temp folder; the quietest pair):

| Sim | 2,000 ants mean / p95 / max | 5,000 ants mean / p95 / max | All 9 live fields rebuilt at once |
| --- | --- | --- | --- |
| Before (4 directions) | 2.27 / 3.64 / 18.90 ms | 2.26 / 3.78 / 12.47 ms | 6.54 ms (0.73 a field) |
| After (8 directions) | 1.68 / 1.87 / 7.58 ms | 1.98 / 2.16 / 8.05 ms | 11.76 ms (1.31 a field) |

These two runs predate the review fixes below. After them, at a load average near 19, two interleaved pairs gave 2,000 ants mean 1.90 and 2.61 ms before, 3.00 and 2.20 after; 5,000 ants 2.42 and 3.02 before, 3.10 and 2.70 after; all fields at once 7.4 and 8.8 ms before, 25.5 and 15.3 after. The tick means differ by less than the noise between runs. Still a pass on the mean. The per-field rebuild costs about 1.8 times what it did (the bucket queue does more work per cell than the breadth-first search). Rebuilding every field in one tick is now over 10 ms; it happens only on restore and when one surface change touches every field. A per-tick rebuild budget is the fix if it shows in play. In local workerd (`spikes/workerd.mjs`, 20-tick requests, after the fixes, loaded machine): 2,000 ants mean 2.09 ms, p95 3.55; 5,000 ants mean 2.90 ms, p95 4.09.

**S2.** The 41-order script (command log sha256 begins `78ba8e6cf74058e6`), 12,000 ticks of 2,000 ants, hashes every 20 ticks: Node, workerd, Chromium 156 and WebKit 27.2 agree on all 600 records (final total 3889048384, after the review fixes; the run before them also agreed everywhere). workerd agreed on both runs too. The planted mutant diverges at tick 20 in `ants` in Node, Chromium and WebKit. Firefox did not run: Playwright's Firefox is not installed here. For a real phone, `/cinderhill/check.html` now runs the same 12,000 ticks (`quick.js` `LONG`) and shows one line to copy: sim version, short and long result, engine and user agent. A Firefox result from a phone is still owed (feature 1's done line names Firefox).

**S4** (5,000 ants, gzip; before is the trail-shape re-run above):

| Played ticks | gzip before / after | Scent after | Ants part after | Ants on the surface after |
| --- | --- | --- | --- | --- |
| 3,000 | 47.6 / 45.5 KB | 20.0 KB | 23.7 KB | 2,394 |
| 8,000 | 60.5 / 58.1 KB | 30.8 KB | 25.3 KB | 2,443 |
| 24,000 | 61.8 / 60.6 KB | 31.9 KB | 26.3 KB | 2,321 |

Each restores to the same hash. The margin under 64 KB is 5.9 KB at 8,000 ticks (the CI assertion) and 3.4 KB at 24,000; todo lab-5w7.19 stays open.

**Trail shape** (`spikes/trail-shape.mjs`, same cases as above, after the review fixes; deviation is still measured in 4-connected steps to the Bresenham line):

| Stroke | Outbound mean / max | Homeward mean / max | Loads in order |
| --- | --- | --- | --- |
| Dog-leg | 0.13 / 2 | 0.12 / 1 | 800 of 800 |
| U | 0.15 / 1 | 0.13 / 1 | 589 of 589 |
| Tight U | 0.16 / 1 | 0.15 / 1 | 912 of 912 |
| Self-crossing | 0.20 / 2 | 0.15 / 1 | 1,383 of 1,383 |
| Dog-leg through a 7 x 7 stone | 0.75 / 5 | 0.70 / 5 | 769 of 769 |

All 200 ants made 2 or more round trips in every case.

**Bots** (`test/bots.test.mjs`): 800 ants, 3,000 ticks: longest stall 30, 29, 28 and 32 ticks on seeds 3, 8, 5 and 11 (the test's line is 100). A strict movement corner rule (both side cells must be open) gave 97 to 199 at every stall-kick period tried, and 2,983 with the old kick, so movement uses the lenient rule.
