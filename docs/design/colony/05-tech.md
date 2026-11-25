# Cinderhill: technology and prior art

Decisions for building the game, with reasons. The research behind them, with sources, is in [06-tech-research.md](06-tech-research.md). "Measured" means measured in this repo; anything else says where it comes from.

## Decisions

| Area | Choice | Rejected | Why |
| --- | --- | --- | --- |
| Engine | Plain web: ES modules, no build step, served like the other experiments | Unity 6 Web, Godot 4 Web, Bevy | Below |
| Rendering | Own WebGL2: instanced ants, terrain as textures, scent as an overlay texture. Canvas 2D for `rig.js` close-ups and UI | PixiJS v8 (kept as the fallback), Three.js, WebGPU as a base | WebGL2 runs on every target phone. WebGPU is on by default in iOS 26 but not on all Android GPUs, and Firefox Android has it behind a flag. Use it later for looks only |
| Simulation | One pure, deterministic module in `shared/`: integer positions (1/256 cell), typed arrays per field (structure of arrays), seeded mulberry32, lookup-table trig, stable order, a state hash per subsystem | An ECS library (bitECS is MPL-2.0; miniplex uses one object per entity), a physics engine | Determinism, saves and replays come free. The same file runs in the page, the Durable Object, Node bots and tests |
| Movement | Flow field per goal (breadth-first fill over the grid, rebuilt only in changed regions), separation from a spatial hash, scent fields that blur and decay each tick, three-sensor steering | A* per ant, navmesh | Cost grows with goals, not ants. Red Blob Games' flow-field notes and the Age of Empires IV GDC talk use this for large crowds |
| Terrain | Cell grid (material per cell, Terraria-style), drawn smooth with marching squares; only water and loose ash move, in dirty chunks (Noita-style, limited) | 3D voxels | Small to save and send; the same grid drives digging, flow fields and scent |
| Saves | Snapshot of typed arrays plus the command log, in IndexedDB every 30 s and at dusk; reload replays the log from the snapshot | Saving only between days | Answers the reference game's top complaint |
| Friends' play | Server-ordered lockstep: a Durable Object collects commands, stamps the tick, broadcasts, runs its own copy and checks hashes; a snapshot on join or mismatch | Per-ant snapshots (Crumbwar model), peer-to-peer | Bandwidth grows with commands, not ants (below) |
| Fallback if S2 fails | Coarse server state: per-cell ant counts, scent and terrain changes; phones animate ants locally | | Simpler server, but players do not see the same individual ants |
| Art | Procedural, in code. Optional CC0 textures (ambientCG) and CC0 sound (Freesound CC0 filter, Kenney) | Paid packs; CC-BY models unless credited | The art budget is $1 a month. Procedural ants recolour per caste and species for free |
| Words | `kit/i18n.js`, English and Turkish | | Same as the other games |

### Why not Unity

The lab built Exile in Unity 6 (adam0white/exile-unity) and hosts its web build at `/exile/`. What that showed, from its notes:

- Builds take about a minute and need the editor installed on one Mac. Agents in the cloud cannot build it.
- Headless tests need special Chromium flags, and the build was never checked on Safari, a real phone or a real GPU.
- Its C# cannot run inside a Cloudflare Durable Object, so friends' play would need the simulation written twice (C# and JavaScript). Two copies of one simulation drifting apart is the worst kind of lockstep bug.
- A Unity web build is one multi-megabyte download before play. Poki's 2026 guide says each extra megabyte before play costs a couple of percent of players (06-tech-research.md).
- It cannot use the shared kit (`experiments/kit/`) that every lab game uses for hints, saves, sound, words, rooms and recording.

Godot has the same problems: GDScript and C# cannot run in a Worker, and C# cannot export to the web in Godot 4. Bevy (Rust to WASM) could share one simulation between page and server, but it leaves the kit behind and slows the work. It stays the fallback if spike S1 shows JavaScript is too slow.

### Why lockstep, in numbers

- **Measured (Crumbwar, `workers/crumbwar/DECISIONS.md`):** 240 ants in one Durable Object tick in 0.56 to 0.76 ms locally. Each client receives 1.6 to 3.6 KB a second of per-ant snapshots.
- **Extrapolated:** 5,000 visible ants in per-ant snapshots would be about 150 KB a second per client. That is too much for phones on mobile data.
- **Lockstep:** players send commands (a trail is a few points; Age of Empires players issued a command every 1.5 to 2 seconds, from "1500 Archers"). Bandwidth stays at a few hundred bytes a second whatever the ant count.
- **Costs:** the slowest phone sets the pace; a tab put in the background must catch up or take a snapshot; every phone holds the full state, so hidden information is not secret from a modified client. That is acceptable among friends.
- **What we already have:** `kit/lockstep.js` runs two phones in lockstep (Thumb Duel), and `kit/samemath.js` gives the same `exp`, `sin`, `cos` and `hypot` on every engine. On 2026-11-24 the lab measured WebKit and Chromium differing from Node on 5 to 37% of 20,000 arguments to `Math` functions. That is why the Cinderhill sim uses integers and tables, not floating-point `Math`.

## Reuse from this repo

| From | What | Use in Cinderhill |
| --- | --- | --- |
| `experiments/kit/` | `hint.js`, `save.js`, `audio.js`, `music.js`, `pause.js`, `zoom.js`, `i18n.js`, `screens.js`, `lab.js`, `share.js`, `fx.js` | Teaching, saves, sound, music (new "hill" preset), pause, words, recording, sharing the bloom map |
| `experiments/kit/` | `room.js` (codes and links, no account), `lockstep.js`, `samemath.js` | Friends' hill links. `lockstep.js` is for two phones; Cinderhill needs a server-ordered version for 2 to 4, added to the kit as a new module (kit rule 4: exports only grow) |
| `workers/crumbwar/` | Durable Object room and directory, binary `Writer` in `shared/proto.js`, join rate limit, health and alert workflow, `PROTO` fingerprint test, load bench, bot harness | The Friends' hill Worker, whether in `workers/lab-ai` (room routes exist) or its own Worker |
| `workers/lab-ai/` | `/lab-api/board/` shared leaderboard with run tickets | Daily hill board |
| `experiments/ant-promotion/` | `rig.js` (legged creatures with a real tripod gait, pure math), `creature.js` (species as parameter records), `look3d.js` (2D draw calls turned into lit 3D shapes), `bots.mjs` style | Close-up ants and every insect; the optional 3D look; test bots |
| `experiments/kit/check/phone.mjs` | WebKit iPhone 13 and Chromium Pixel 7 runs | Cinderhill section from M1 |

Kit rule 1 applies: when Cinderhill needs something a second game could use (scent fields, flow fields, a turn server), it goes in the kit.

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

Our own code is written from these descriptions. GPL and non-commercial code is not copied.

## Layout in the repo

```
experiments/cinderhill/      page, renderer, input, words, NOTES.md, bots.mjs
experiments/cinderhill/sim/  pure deterministic sim (runs in Node, page, Worker)
experiments/kit/             new shared modules (scent field, flow field, turn client)
workers/lab-ai or workers/cinderhill/   Friends' hill rooms (decided at M3)
docs/design/colony/          this spec
```

The page is served at `/cinderhill/`, unlisted until M4. If the owner picks another name, the slug follows it.
