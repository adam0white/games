# Cinderhill: technology and prior art

Decisions for building the game, with reasons. The research behind them, with sources, is in [06-tech-research.md](06-tech-research.md). "Measured" means measured in this repo; anything else says where it comes from.

## Decisions

| Area | Choice | Rejected | Why |
| --- | --- | --- | --- |
| Engine | Plain web: ES modules, no build step, served like the other experiments | Unity 6 Web, Godot 4 Web, Bevy | Below |
| Rendering | Own WebGL2: instanced ants, terrain as textures, scent as an overlay texture. Canvas 2D for `rig.js` close-ups and UI | PixiJS v8 (kept as the fallback), Three.js, WebGPU as a base | WebGL2 runs on every target phone. WebGPU is on by default in iOS 26 but not on all Android GPUs, and Firefox Android has it behind a flag. Use it later for looks only |
| Simulation | One pure, deterministic module in `experiments/cinderhill/sim/`: integer positions (1/256 cell), typed arrays per field (structure of arrays), seeded mulberry32, lookup-table trig, stable order, a state hash per subsystem | An ECS library (bitECS is MPL-2.0; miniplex uses one object per entity), a physics engine | Determinism, saves and replays come free. The same file runs in the page, the Durable Object, Node bots and tests |
| Movement | Flow field per goal (breadth-first fill over the grid, rebuilt only in changed regions), separation from a spatial hash, scent fields that blur and decay each tick, three-sensor steering | A* per ant, navmesh | Cost grows with goals, not ants. Red Blob Games' flow-field notes and the Age of Empires IV GDC talk use this for large crowds |
| Terrain | Cell grid (material per cell, Terraria-style), drawn smooth with marching squares; only water and loose ash move, in dirty chunks (Noita-style, limited) | 3D voxels | Small to save and send; the same grid drives digging, flow fields and scent |
| Saves | A new IndexedDB store (not `kit/save.js`, which is localStorage for small settings): versioned checkpoints of the typed arrays and random state, plus an ordered command suffix and an atomic committed cursor. Checkpoint every 20 s (headroom inside the 30 s promise) and at dusk. Keep the previous good checkpoint and the dawn save apart. One tab owns a campaign (Web Locks); a second tab offers to take over. A failed write is shown, not swallowed | Saving only between days | Never lose more than 30 seconds of play, the genre's most common complaint |
| Friends' play | Server-ordered lockstep: one SQLite-backed Durable Object per hill seals ticks on its own clock, orders commands, broadcasts, and compares client hashes; a snapshot on join or mismatch. Whether it also runs the sim is decided by S1 (protocol below) | Per-ant snapshots (Crumbwar model), peer-to-peer, waiting for the slowest phone (`kit/lockstep.js` does) | Bandwidth grows with commands, not ants (below) |
| Fallback if S2 fails | Coarse server state: per-cell ant counts, scent and terrain changes; phones animate ants locally | | Simpler server, but players do not see the same individual ants |
| Art | Procedural, in code. Optional CC0 textures (ambientCG) and CC0 sound (Freesound CC0 filter, Kenney) | Paid packs; CC-BY models unless credited | The art budget is $1 a month. Procedural ants recolour per caste and species for free |
| Words | `kit/i18n.js`, English and Turkish | | Same as the other games |

### Room protocol (holds whether or not the room runs the sim)

From the round-2 reviews (09-round2-findings.md):

- **The room never waits for a phone.** It seals each tick on its own clock (20 Hz) and announces the last sealed tick even when nobody sent anything. A command that arrives late goes into the next open tick. A phone that falls behind catches up or takes a snapshot.
- **Commands apply once.** Each carries a seat, a command id and the client's tick. The room drops duplicates, so a retry after a lost acknowledgement is safe.
- **Durable before acknowledged.** Accepted commands and the sealed-tick mark are written to the room's SQLite in one transaction before the room acknowledges or broadcasts. Checkpoints are versioned (sim version, random state, last applied command).
- **Deploys and restarts.** A code update restarts a live room within minutes (08-cloudflare-and-prior-art.md). The handshake carries the protocol and sim version; clients reconnect and the room resumes from SQLite. A test evicts the room mid-match.
- **Hashes keep the room awake.** Each client sends its state hash once a second. That detects desyncs and, per 08, resets the Durable Object's CPU allowance, which counts from the last incoming message.
- **Seats.** The invite link is not the seat credential. Joining exchanges the link for a seat token; a dropped seat is held for two minutes. Pause needs every present player.
- **Room role.** Relay only is cheapest (08 estimates the full sim at 5,000 ants near 300 ms of CPU a second, unmeasured). An authority room can make join snapshots and catch a modified client. S1 measures both. In relay-only rooms the join snapshot comes from the most recent client checkpoint whose hash the other clients confirmed.
- **Cost (08, calculated, unmeasured):** about $0.006 per active room-hour of duration at 128 MB; the tick runs on `setInterval` while players are present and stops when the room is empty so it can hibernate. Alarms only for expiry and closing a daily hill.

### Cloudflare products (08-cloudflare-and-prior-art.md has sources)

| Need | Product | Note |
| --- | --- | --- |
| Pages and the sim files | Workers static assets | Already how the lab serves games. Not Pages |
| Friends' hill room | Durable Objects with SQLite storage, WebSocket hibernation, RPC between Worker and room | `new_sqlite_classes` migration; `getByName` per hill code |
| Daily hill board | The existing `workers/lab-ai` board (run tickets, game allowlist) | Add `cinderhill` to its allowlist and a scoring rule. Server replay of top scores only, later |
| Replays and command logs people share | R2 | Free egress; only when someone shares one |
| Play telemetry in aggregate | Analytics Engine | Sampled, so the Day 1 gate still reads exact lab records |
| Logs and traces | Workers Logs, traces, Cloudflare Issues | As every lab Worker (no exceptions). Keep invite codes and commands out of logs |
| Abuse without accounts | In-room token bucket; Turnstile (invisible) on score posts if needed | The rate-limiting binding counts per location, approximately |
| Tests | `@cloudflare/vitest-plugin` | Includes evicting a Durable Object, for the deploy-then-resume test |
| Not needed now | Containers, Realtime, Queues, Workflows, Workers AI | Revisit only with a measured need |

### Why not Unity

The lab built Exile in Unity 6 (adam0white/exile-unity) and hosts its web build at `/exile/`. What that showed, from its notes:

- Builds take about a minute and need the editor installed on one Mac. Agents in the cloud cannot build it.
- Headless tests need special Chromium flags, and the build was never checked on Safari, a real phone or a real GPU.
- Its C# cannot run inside a Cloudflare Durable Object, so friends' play would need the simulation written twice (C# and JavaScript). Two copies of one simulation drifting apart is the worst kind of lockstep bug.
- A Unity web build is one multi-megabyte download before play. Poki's 2026 guide says each extra megabyte before play costs a couple of percent of players (06-tech-research.md).
- It cannot use the shared kit (`experiments/kit/`) that every lab game uses for hints, saves, sound, words, rooms and recording.

Godot has the same problems: GDScript and C# cannot run in a Worker, and C# cannot export to the web in Godot 4. Bevy (Rust to WASM) could share one simulation between page and server, but it leaves the kit behind and slows the work. It stays the fallback if spike S1 shows JavaScript is too slow.

### Why lockstep, in numbers

- **Measured (Crumbwar, `workers/crumbwar/DECISIONS.md`):** 240 ants tick in 0.56 to 0.76 ms locally (the room's full tick, sockets aside). At 240 ants each client receives about 2.5 to 3.6 KB a second of per-ant snapshots in the local bench.
- **Extrapolated:** 5,000 visible ants in per-ant snapshots would be about 75 KB a second per client if Crumbwar's 240-ant rate scales linearly, and about 150 KB a second at 3 bytes per ant ten times a second (06-tech-research.md). Either is too much for phones on mobile data.
- **Lockstep:** players send commands (a trail is a few points; Age of Empires players issued a command every 1.5 to 2 seconds, from "1500 Archers"). Bandwidth stays at a few hundred bytes a second whatever the ant count.
- **Costs:** the slowest phone sets the pace; a tab put in the background must catch up or take a snapshot; every phone holds the full state, so hidden information is not secret from a modified client. That is acceptable among friends.
- **What we already have:** `kit/lockstep.js` runs two phones in lockstep (Thumb Duel), and `kit/samemath.js` gives the same `exp`, `sin`, `cos` and `hypot` on every engine. On 2026-11-24 the lab measured WebKit and Chromium differing from Node on 5 to 37% of 20,000 arguments to `Math` functions. That is why the Cinderhill sim uses integers and tables, not floating-point `Math`.

## Reuse from this repo

| From | What | Use in Cinderhill |
| --- | --- | --- |
| `experiments/kit/` | `hint.js`, `save.js`, `audio.js`, `music.js`, `pause.js`, `zoom.js`, `i18n.js`, `screens.js`, `lab.js`, `share.js`, `fx.js` | Teaching, saves, sound, music (new "hill" preset), pause, words, recording, sharing the bloom map |
| `experiments/kit/` | `room.js` (codes and links, no account), `lockstep.js`, `samemath.js` | Friends' hill links. `lockstep.js` is for two phones; Cinderhill needs a server-ordered version for 2 to 4, added to the kit as a new module (kit rule 4: exports only grow) |
| `workers/crumbwar/` | Durable Object room and directory, binary `Writer` in `public/crumbwar/shared/proto.js`, join rate limit, health and alert workflow, `PROTO` fingerprint test, load bench, bot harness | The Friends' hill Worker, whether in `workers/lab-ai` (room routes exist) or its own Worker |
| `workers/lab-ai/` | `/lab-api/board/` shared leaderboard with run tickets | Daily hill board |
| `experiments/ant-promotion/` | `rig.js` (legged creatures with a real tripod gait), `creature.js` (species as parameter records), `look3d.js` (2D draw calls turned into lit 3D shapes), `bots.mjs` style | Close-up ants and every insect; the optional 3D look; test bots. All three are cosmetic only: `rig.js` uses native `Math` and a frame step, so rig state stays outside the deterministic sim. `creature.js` imports Ant Promotion's own form registry, so the drawing interface is extracted first. `look3d.js` stops adding shapes silently at its buffer cap; the port counts dropped shapes |
| `experiments/kit/check/phone.mjs` | WebKit iPhone 13 and Chromium Pixel 7 runs | Cinderhill section from M1 |

Kit rule 1 applies: the scent field, the flow field and the turn client start in `experiments/cinderhill/sim/` and move to the kit as soon as a second game imports them.

## Prior art (outside this repo)

| Work | Licence | How we use it |
| --- | --- | --- |
| NetLogo Ants (Wilensky 1997) | CC BY-NC-SA | Rules only: drop scent on the way home, diffuse and evaporate, sniff three directions, nest scent for homing. No code |
| Sebastian Lague, Ant-Simulation | GPL-3.0 | Rules only (two scents: leaving home, carrying food). No code |
| StrandedKitty/ants-simulation (Three.js, WebGL) | MIT | Closest web prior art for a GPU look of scent; may borrow shader ideas |
| johnBuffer/AntSimulator | MIT | Reference for marker grids |
| Craig Reynolds, steering behaviours (1999) | paper | Separation, wall following, flow-field following, queuing at doors |
| Red Blob Games, flow fields (2024) | article | Breadth-first fill and gradient |
| Age of Empires IV, "Pathing: Flow Fields and Steering" (GDC 2022) | talk | Flow fields plus steering for hundreds of units around walls that change |
| "1500 Archers" (Age of Empires netcode) | article | Lockstep turns, command delay, checksums per subsystem |
| Rune, "Making JS deterministic" | article | Which JavaScript is unsafe in lockstep (Math functions, sort, locale) |
| Jamie Wong, marching squares | article | Smooth tunnel walls |
| Noita (GDC 2019) | talk | Dirty-chunk updates for water and loose ash only |
| SimAnt (1991), Pikmin | games | Genre conventions (two layers, scent); the Pikmin day boundary as a save point |
| Factorio Friday Facts 302 | article | A separate, throwaway "latency state" for local prediction; the real state only moves on sealed ticks |
| Desyncs in synchronous RTS engines (Game Developer) | article | Hash the whole state about once a second; desyncs show up in long games, so run hour-long bot soaks |
| Glenn Fiedler, "Fix Your Timestep" | article | Separate sim steps from frames; cap catch-up steps per frame |
| Dungeon Keeper | game | Orders go to places (tiles), not to units: the same idea as trails and digs |
| Tooth and Tail | game | A swarm RTS designed around a gamepad's limits; design the controls around the phone, not the mouse |
| An independent from-scratch design (10-fresh-design.md) | our own | Crew counts per order, "why waiting" inspection, bridge crews, a labour ledger that never changes with zoom |

Our own code is written from these descriptions. GPL and non-commercial code is not copied.

## Layout in the repo

```
experiments/cinderhill/      page, renderer, input, words, NOTES.md, bots.mjs
experiments/cinderhill/sim/  pure deterministic sim (runs in Node, page, Worker)
experiments/kit/             new shared modules (scent field, flow field, turn client)
workers/lab-ai or workers/cinderhill/   Friends' hill rooms (decided at M3)
docs/design/colony/          this spec
```

The page is served at `/cinderhill/`, unlisted until M3. If the owner picks another name, the slug follows it.
