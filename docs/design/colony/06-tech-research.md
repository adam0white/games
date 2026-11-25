# Technology prior art: browser-first ant-colony RTS / base-builder

Date: 2026-11-25. Scope: thousands of ants, pheromone trails, dug nests in a 2D cross-section, combat with other insects, friends join by link with no account. Current stack: static ES modules on Cloudflare, Workers + Durable Objects (DO) for rooms, Crumbwar running a 20 Hz authoritative tick in a DO with 240 clients.

**Provenance labels.** [opened] = I opened the page this session and the claim comes from it. [snippet] = only a search-result summary, page not opened. [memory] = my own background knowledge, not checked this session. The Sources list at the end holds only [opened] URLs.

---

## 1. Ant and swarm simulations

### What exists, and whether we can reuse it

| Project | Stack | Licence | Use for us |
|---|---|---|---|
| johnBuffer/AntSimulator | C++ / SFML | MIT [opened] | Reusable. README does not describe internals; marker grid inferred from the "M: toggle markers" key [opened]. Port ideas, not code (C++). |
| StrandedKitty/ants-simulation | TypeScript, Three.js, WebGL, webpack | MIT [opened] | Reusable. GPU ant sim; two pheromones (to-food, to-home) that evaporate and diffuse [snippet]. Closest web prior art. |
| SebLague/Ant-Simulation | Unity 2021.3, C# | GPL-3.0 [opened] | Reference only. Two pheromone colours: "leaving home" and "returning from food" [opened]. |
| SebLague/Slime-Simulation | Unity compute shader | GPL-3.0 [snippet] | Reference only. Physarum agent + trail-map pattern. |
| NetLogo Ants (Wilensky 1997) | NetLogo | CC BY-NC-SA 3.0 [opened] | Reference only (non-commercial). Rules: chemical dropped on return trip, `diffuse` + evaporation sliders, ants sniff 3 directions and turn to the strongest, respond only to levels 0.05..2, nest scent field for homing [opened]. |
| piellardj/particles-webgpu | WebGPU compute, GPUBuffer of vec2 pos+vel (16 B/particle) | MIT [opened] | Reusable skeleton for cosmetic GPU particles. |
| lisyarus particle-life (blog) | WebGPU compute | not stated [opened] | Reference. GPU binning: atomic count, prefix-sum scan, scatter; ~0.1 ms for 10k bins on a GTX 1060; 65,536 particles in the gallery [opened]. Notes WebGL cannot do this (no compute, no atomics) [opened]. |
| kody-w "Ant Colony" demo | WebGL instancing | unknown | Claims 5k-10k ants at 60 fps with diffusing/evaporating pheromone [snippet]. Behaviour reference. |
| slime-mold crate, Strowger Physarum | Rust + wgpu | not checked | Millions of agents in compute [snippet]. |
| vonwolfehaus/flow-field | JS | no licence file [opened] | Reference only. Dijkstra fill from goal, per-cell vector, flocking made results "slightly worse" [opened]; archived 2021. |

"Gyre-style": I could not identify a project or technique by that name. Not researched further.

### Technique that matters

The pheromone sims above share one structure (NetLogo rules [opened]; Lague two-pheromone design [opened]; StrandedKitty [snippet]; Physarum [snippet]; the sensor detail is from NetLogo plus [memory] of Lague's video): agents on a continuous plane, one or more scalar fields on a grid, each tick (1) agents sample the field at 2-3 sensor points ahead and steer toward the maximum, (2) agents deposit, (3) the field is blurred (diffusion) and multiplied by a decay factor (evaporation). Two fields (to-food, to-home) or a home-distance field give return paths. This is a stigmergy model; the field update is a separable box/Gaussian blur plus scale, which is embarrassingly parallel and cheap on CPU for grids up to ~256x256 (65k cells, a few hundred µs in JS typed arrays [memory]).

**Constraint that decides architecture:** a Durable Object has no GPU. Any authoritative simulation runs as CPU JavaScript (or WASM) in the DO. GPU sims (StrandedKitty, WebGPU particle demos) apply only to client-side, cosmetic work, and GPU float results are not bit-reproducible across vendors [memory], so they cannot feed a lockstep simulation. The authoritative ant sim must be CPU code on typed arrays (structure of arrays), shared verbatim between DO and page.

### Boids and steering

Craig Reynolds, "Steering Behaviors For Autonomous Characters", GDC 1999 [opened]: seek/flee, arrival, wander, obstacle avoidance, containment, wall following, path following, **flow field following**, crowd path following, leader following, unaligned collision avoidance, queuing at a doorway, flocking (separation, alignment, cohesion) [opened]. For ants we need separation (spatial hash, cell = sensor radius), wall following inside tunnels, flow-field following, and queuing at tunnel mouths. Alignment/cohesion are not ant-like and can be dropped.

---

## 2. Pathfinding and netcode for many units

### Flow fields

- A flow field is the gradient of a distance field; A* yields both (`cost_so_far` is the distance field, `came_from` is the flow field); coarse+fine hierarchy is optional (Red Blob Games, 2024) [opened].
- Supreme Commander 2: Elijah Emerson, "Crowd Pathfinding and Steering Using Flow Field Tiles", Game AI Pro [snippet]; I did not open the chapter. howtorts.github.io notes SupCom2 used tiling to cut memory and generation time and line-of-sight to the goal near the end [snippet].
- Continuum Crowds (Treuille et al. 2006 [memory]): per-tick density and speed grids, anisotropic cost, Dijkstra/eikonal fill per destination group, agents read the vector under them [opened, howtorts]. The howtorts author judges it too expensive per tick to be what SupCom2 did and suspects SupCom2 used flow fields plus steering, binning for neighbour search and discomfort fields [opened].
- Age of Empires IV: GDC 2022, Frank Cheng (World's Edge), "Pathing in Age of Empires IV: Flow Fields and Steering Behaviors": hundreds of units, walls and buildings built and destroyed constantly, combined flow fields + hierarchical A* + steering, terrain types and unit sizes [opened, abstract only].
- Planetary Annihilation: flow-field-based movement shown in an Uber dev stream [snippet].
- StarCraft 2: I found no primary source this session. From memory: navmesh + A* + funnel, with boids-like separation and "unit pushing"; deterministic lockstep netcode [memory].
- They Are Billions: no source found on its pathfinding. Searched; nothing from Numantian Games.

**Fit for ants.** Ants mostly travel to a few shared goals (nest chambers, food sources, rally flag, enemy nest). That is the case flow fields are built for: cost scales with grid size and number of goals, not with ant count. On a 2D cross-section grid of e.g. 256x128 cells, a BFS/Dijkstra fill is ~32k cells, sub-millisecond in JS [memory], and only needs recomputing when terrain changes (digging) or a goal moves. Pheromone fields and flow fields are the same data type (a scalar field per goal) so one code path serves both: "ants follow player-painted pheromone" and "ants path to the target" become the same sampling step. Hierarchical/tiled fields (SupCom2, AoE4) are only needed if the map grows past a few hundred cells a side.

### Netcode: what fits a Durable Object

Measured in Crumbwar (`workers/crumbwar/DECISIONS.md` , read this session): interest-filtered delta snapshots at 10 Hz, quarter-unit `u16` positions or `i8` deltas; 240 ants cost 0.60-0.76 ms per tick on a Mac including building every snapshot, and 1645-3578 bytes per client per second (deployed 1645 B/s; local bench after the density change 3578 B/s). DO limits: 30 s CPU per incoming message refill, soft limit 1,000 requests/s per object, 32 MiB max received message [opened, Cloudflare]. Crumbwar's notes record that an overloaded room is reset rather than slowed. Memory per isolate is 128 MB [memory].

AoE "1500 Archers" (Bettner & Terrano) [opened]: sending per-unit state would have capped AoE at ~250 moving units; they chose lockstep: everyone runs the same sim, commands execute two turns later, turns ~200 ms, adjusted to latency and the slowest machine; command latency under 250 ms unnoticed, 250-500 ms playable; players issue a command every 1.5-2 s, bursts of 3-4/s. The cost: desyncs from tiny divergence, checksums over world/pathing/targeting, 50 MB world dumps for debugging, synchronized seeded RNG.

**Extrapolation (not measured).** Per-unit snapshots scale linearly with visible ants. 5,000 ants visible x ~3 bytes (delta position + state) x 10 Hz = ~150 KB/s per client, about 50x Crumbwar's measured rate. Interest filtering helps less in an RTS because the player zooms out over the whole colony. Crumbwar itself is far from its limits (0.6 ms of a 50 ms tick budget); the problem is bandwidth growing with ant count, not the room.

Three options:

| Option | Server sends | Bandwidth | Server CPU | Risk |
|---|---|---|---|---|
| A. Server-ordered lockstep: DO collects commands, stamps a turn number, broadcasts; every client and the DO run the same deterministic sim; periodic state hash; DO sends a full snapshot on join or hash mismatch | commands + hash | ~bytes/s, independent of ant count | one sim per room (DO keeps the reference copy) | Determinism in JS; late-join snapshot size |
| B. Coarse authoritative state: server sends per-cell ant counts, pheromone grid (u8), terrain diffs; clients animate individual ants cosmetically from the grid | quantized grids, diffs | 1-10 KB/s depending on grid and diff rate [extrapolation] | server sim + diff | Individual ants not consistent across players; combat readability |
| C. Crumbwar model: interest-filtered per-ant snapshots | per-ant deltas | linear in visible ants | sim + per-client snapshot build | Bandwidth wall at a few hundred visible ants |

JS determinism is achievable: basic IEEE-754 double arithmetic is reproducible across engines; transcendental functions (`Math.sin`, `cos`, `pow`) are not; Rune patches ~30 `Math` functions to round to float32, replaces `Math.random` with seeded mulberry32, patches `Array.prototype.sort`, and lints against locale functions and global scope; Rune uses predict-rollback on top [opened]. Rapier's WASM build is cross-platform deterministic given identical creation order and no host transcendentals [opened]. The safest route for a new sim is integer or fixed-point state (Int32Array positions in 1/256 cells, lookup-table trig, integer pheromone levels), which removes the floating-point question entirely and also makes the state hash trivial.

Rollback (GGPO-style) is not needed: an RTS tolerates 100-250 ms command latency (AoE figures above), and rolling back thousands of ants per frame is expensive [memory]. Use a short input delay (2 turns of 50 ms) and local command acknowledgement (selection ring, sound) to hide it.

---

## 3. Diggable terrain and nests

- **Cellular grid, Terraria-style** [memory]: a `Uint8Array` material per cell (air, soil, clay, rock, sand, water, food store, chamber floor); digging sets cells to air over several ticks; tunnels are just air cells. This is deterministic, tiny to snapshot (RLE or per-chunk diff), and the same grid drives the flow-field fill and pheromone diffusion (walls block both).
- **Noita-style falling sand** (Petri Purho, GDC 2019 [snippet]): 64x64 chunks, each with a dirty rect so only changed pixels update; multithreaded by updating chunks in a four-round checkerboard where a pixel may move into its chunk plus 32 px in each direction, so threads never collide; destructible rigid bodies store body id + local position per pixel and re-split on damage [opened, 80.lv]. For ants, full falling sand is more simulation than the design needs; use it selectively: loose sand and water cells that settle under a dirty-chunk rule, so cave-ins and flooding are possible, with everything else static.
- **Marching squares** for rendering (Jamie Wong) [opened]: 4 corner samples per cell give a 4-bit case (16 cases), linear interpolation of the crossing along each edge, saddle cases 5 and 10 resolved by the cell-centre assumption. Store a per-corner soil density (u8) rather than binary cells and render tunnel walls as smooth contours; digging lowers density. The contour can also be used for collision edges.
- **3D voxels** [memory]: marching cubes or surface nets over chunked density; multiplies terrain memory and complicates phone camera controls. The ant-farm cross-section is the genre's familiar view (SimAnt, from memory). Not for version 1.

---

## 4. Engine options

| Criterion | Plain web (own WebGL2 / PixiJS v8 / Three.js) | Unity 6 Web | Godot 4 Web | Bevy (Rust -> WASM) |
|---|---|---|---|---|
| First load | Tens to hundreds of KB of JS plus assets; can stream | Empty URP project ~10.7 MB, ~2-4.7 MB after size optimisation and LTO [snippet]; one wasm blob must finish before play (Poki) [opened] | Default ~42 MB raw / 8.7 MB zip, ~2.7 MB brotli with a custom template [snippet]; same single-blob issue (Poki) [opened] | Up to 30 MB, 15 MB after wasm-opt (Bevy 0.12, outdated) [snippet] |
| Memory | Small | ~200 MB in an empty release build reported [snippet] | not measured | not measured |
| Mobile Safari | Native | iOS Safari 15+, Android Chrome 58+ listed [opened] | Single-threaded export (default since 4.3) works on iOS; WebGL2 Compatibility renderer only; docs warn of Safari WebGL2 issues [opened] | WebGL2 default, WebGPU opt-in [snippet] |
| Threads | Workers, no isolation needed | Native C++ threads experimental, need COOP/COEP/CORP; no C# threads [opened] | Threads need COOP+COEP [opened] | wasm threads need isolation [memory] |
| WebGPU | PixiJS v8: WebGL default and recommended, WebGPU feature-complete but advised against for production [opened]; Three.js WebGPURenderer [memory] | 6.6 docs list WebGPU limits with an automatic compatibility-mode fallback [opened]; WebGL2 remains default and "out of experimental in 6.6" [snippet] | Not supported on web [opened] | Opt-in [snippet] |
| Share code with the DO | Same ES modules run in page and DO (Crumbwar already does this) | No: C# sim cannot run in a Worker; would duplicate the sim in JS | No: GDScript cannot run in a Worker; C# cannot export to web at all in Godot 4 [opened] | Yes in principle: the sim crate can compile to WASM for Workers too [memory]; separate toolchain from the rest of the games repo |
| Agent authoring | Plain text, test with Node | Scenes, prefabs, `.meta` files, editor-bound import; builds long (5-40 min reports) [snippet] | `.tscn` is text and diffable [memory]; editor still central | Plain text, slow compiles [memory] |
| Shared kit with other small games | Yes (`/kit/` already used, e.g. i18n) | No | No | No |
| Cost | $0 | Personal free under $200k revenue; splash optional in Unity 6; Runtime Fee cancelled Sept 2024 [snippet] | $0 (MIT) [memory] | $0 (MIT/Apache) [memory] |

Poki (June 2026): each extra megabyte before play costs "a couple percent" of players; Unity is the most-used engine on Poki but its single wasm download and up-front asset loading lower conversion; web-native engines load only what the first seconds need [opened].

The deciding row is "share code with the DO". In lockstep option A the page and the DO must run byte-identical simulation code. With the plain web stack this is the existing Crumbwar arrangement (`shared/` modules, `PROTO` fingerprint test). With Unity or Godot the sim would exist twice (engine language + JS for the DO), and a determinism bug between two implementations is the worst kind of desync. Bevy could share one Rust sim across page and DO, but it gives up the shared JS kit, the fast iteration and the small first load, for a performance gain we do not need at a few thousand ants.

**ECS libraries.** bitECS: typed-array SoA components, ~5 kB, serialization included, **MPL-2.0** [opened], which is outside the MIT/BSD/Apache/CC0/zlib list (file-level copyleft; using it unmodified is usually fine, but it needs an owner decision). miniplex: MIT, entities are plain objects with archetype queries [opened]; object-per-entity is the wrong layout for 5,000 ants in a hot loop. Recommendation: no ECS library; hand-written SoA typed arrays (`x: Int32Array`, `y`, `state: Uint8Array`, `carry`, `hp`), which is what bitECS does internally and what determinism + snapshotting want anyway.

**Physics.** Rapier (WASM) is deterministic [opened]; ants on a grid do not need it. Skip.

**Babylon.js / Three.js** [memory]: full 3D engines (Apache-2.0 / MIT); useful only if a 3D surface view is added. Overkill for a 2D cross-section.

**Flow-field libraries.** I found no maintained, usably licensed JS flow-field library (vonwolfehaus has no licence and is archived). Write our own: a BFS/Dijkstra fill over the terrain grid is ~100 lines.

**Rendering.** Ants are tiny and numerous: one instanced draw (WebGL2 `drawArraysInstanced` with per-instance position/angle/colour/animation phase) handles 10k+ sprites [memory; kody-w demo claims 5-10k at 60 fps, snippet]. Terrain and pheromone overlay are textures or per-chunk meshes. The existing own WebGL2 renderer covers this; PixiJS v8 (MIT [memory]) is the fallback.

---

## 5. Free assets ($1/month cap)

| Source | Licence | Insects/nature content |
|---|---|---|
| Kenney | CC0; commercial use; attribution optional; do not use the Kenney logo [opened] | UI, audio, generic sprites; no ant pack found this session |
| Quaternius | **Quaternius Asset License v1.0**, not CC0: commercial use, modification and no attribution allowed; no redistribution as a standalone pack; no claim of authorship [opened] | Nature packs (Stylized Nature MegaKit, Ultimate Nature Pack, etc.), animal packs; no insect pack listed [opened] |
| poly.pizza | per model | 7 ant models (mostly "Poly by Google"), grasshopper, centipede x2, giant spider, fly, bee, ladybug, Quaternius "Armabee" [opened]. The one ant opened ("dook", via Poly by Google) is **CC-BY 3.0**, OBJ/GLTF [opened]; needs a credits line. |
| KayKit | not stated on the page opened; Forest Nature Pack is the only nature item [opened]. CC0 [memory, unconfirmed] |
| ambientCG | CC0 for all assets [opened] | Soil, dirt, rock, bark, leaf PBR textures [memory] |
| OpenGameArt | page returned 403 to the fetcher | Mixed CC0/CC-BY/GPL; filter by licence [memory] |
| Freesound | per sound; CC0 filter available [memory] | Insect, digging, crunch sounds [memory] |
| Sketchfab | CC-BY downloadable models exist [memory]; scanned insects are often high-poly | Not checked this session |

**Procedural is the better default for ants.** In a 2D cross-section at RTS zoom an ant is 6-20 px. A procedural ant (three ellipses for head/thorax/gaster, six two-segment legs driven by a tripod-gait phase, two antennae) drawn in the instance shader costs no art budget, recolours per colony and caste (worker, soldier with larger head, queen with wings) by uniform, and animates for free from velocity. Enemy insects (beetle, spider, centipede as a chain of segments following the head, a technique from snake/IK demos [memory]) can be built the same way. Add ambientCG soil, Kenney UI/audio, Freesound CC0 sounds; keep a `CREDITS` file if any CC-BY model is used.

---

## 6. WebGPU availability, late 2026

- Safari: WebGPU on by default in iOS 26, iPadOS 26 and visionOS 26 (gpuweb Implementation Status) [opened]; macOS Tahoe 26 too [snippet, web.dev]. A January 2026 WebKit bug reported WebGPU unusable on iOS Safari 26.2; a WebKit engineer said fixed in iOS 26.4 beta 1; a reporter said it worked in 26.4 [snippet, bug not opened].
- Chrome Android: Android 12+ with ARM, Qualcomm or Intel GPUs since Chrome 121; Imagination GPUs on Android 16+ since Chrome 139; **Samsung Xclipse and "other" GPUs: TBD** [opened]. Samsung Internet 24+ supported [opened, caniuse].
- Firefox: Windows since 141 and Apple-silicon macOS since 145 [snippet]; caniuse shows Firefox as not on by default and Firefox Android behind a flag [opened]; gpuweb says Mozilla expects Android work in 2026 [opened].
- Coverage: caniuse global 88.6% (86.8% full + 1.8% partial) [opened]; Poki says 68% of its players were on WebGPU-capable devices in June 2026 [opened]. Poki's lower figure reflects low-end phones.

Conclusion: WebGL2 is the baseline. WebGPU is an optional enhancement for cosmetic effects (more pheromone overlay resolution, particle dust, GPU-binned cosmetic swarms) behind feature detection, never for anything the simulation depends on.

---

## 7. Recommendation

1. **Stack: plain web.** ES modules, the existing own WebGL2 renderer with instanced ants (PixiJS v8 as a fallback if needed), no engine, no ECS library, no physics engine. Reject Unity and Godot (no sim sharing with the DO, multi-MB blob before play, editor-bound authoring). Keep Bevy as the only credible alternative if a later measurement shows the JS sim cannot reach the target ant count; it is the only engine whose sim could run in both page and DO.

2. **Simulation: deterministic integer sim in `shared/`, run identically in page and DO.** Structure of arrays on `Int32Array`/`Uint8Array`, seeded PRNG, lookup-table trig, stable iteration order, no `Math.sin`/`Math.random`/locale calls (lint rule as Rune does). Fixed tick 20 Hz. Pheromone rules re-implemented from the NetLogo/Lague descriptions (their code is not reusable). Goals (nest chambers, food, rally, enemy nest) as BFS flow fields on the terrain grid, recomputed per dirty region. Separation via a spatial hash. Player controls the colony, not individual ants: dig orders, painted pheromone, rally flags, caste production. This is also what makes thousands of ants controllable on a phone.

3. **Terrain:** section 3's cellular grid with marching-squares rendering.

4. **Netcode: server-ordered lockstep (option A) for friend rooms of 2-8 players.** The DO collects commands, stamps the turn (2 turns of input delay, 50 ms turns), broadcasts, runs the reference sim, compares state hashes every second, and sends a full snapshot (terrain RLE + ant arrays, compressed) to late joiners or a desynced client. Bandwidth then scales with commands, not ants. Keep the Crumbwar model (option C) only for any future many-player public mode. Lockstep costs on phones: every client runs the full sim, so the slowest phone sets the tick budget; a backgrounded tab stops ticking and must fast-forward or take a fresh snapshot on return; every client holds full state, so fog of war cannot hide information from a modified client (acceptable among friends). Expect desync debugging as the main engineering cost (AoE needed checksums per subsystem and world dumps); build the hash-per-subsystem and a headless Node replay harness from day one.

5. **Art:** procedural insects (section 5); spend $0. **WebGPU:** cosmetic only, WebGL2 baseline.

### What needs measurement before relying on it

- JS ant tick cost at 2k / 5k / 10k ants on a deployed DO (Crumbwar's 240-ant figure is the only measurement; anything above is extrapolation). Acceptance proposal: 5,000 ants + 3 fields of 256x128 under 10 ms per tick locally, and 20.0 ticks/s deployed for 10 minutes.
- Cross-browser determinism: same seed and command log on Chrome, Safari iOS, Firefox, Node and workerd must produce the same hash after 10 minutes. Inject a known bad case (one `Math.sin`) and show the hash check catches it.
- Late-join snapshot size for a dug nest and 5,000 ants (estimate: tens of KB compressed; unmeasured).
- Simulation tick time and instanced rendering frame time for 5,000-10,000 ants on a mid-range Android phone and an iPhone (lockstep makes the slowest phone the limit).

---

## Sources (opened this session)

- https://github.com/johnBuffer/AntSimulator
- https://github.com/SebLague/Ant-Simulation
- https://github.com/StrandedKitty/ants-simulation
- https://ccl.northwestern.edu/netlogo/models/Ants
- https://github.com/piellardj/particles-webgpu
- https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html
- https://github.com/vonwolfehaus/flow-field
- https://www.red3d.com/cwr/steer/
- https://www.redblobgames.com/blog/2024-04-27-flow-field-pathfinding/
- https://howtorts.github.io/2014/01/09/continuum-crowds.html
- https://www.gdcvault.com/play/1027659
- https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond
- https://developers.rune.ai/blog/making-js-deterministic-for-fun-and-glory/
- https://rapier.rs/docs/user_guides/javascript/determinism
- https://arxiv.org/abs/1705.09704 (lockstep in Haskell/CodeWorld; background only)
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/
- https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/intro/technical-overview
- https://docs.unity3d.com/6000.2/Documentation/Manual/webgl-browsercompatibility.html
- https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/graphics/web-gpu/limitations
- https://unity.com/blog/engine-platform/web-runtime-updates-enhance-browser-experience (Nov 2023)
- https://poki.com/blog/building-web-browser-games-2026
- https://pixijs.com/8.x/guides/components/renderers
- https://github.com/NateTheGreatt/bitECS
- https://github.com/hmans/miniplex
- https://kenney.nl/support
- https://quaternius.com/ and https://quaternius.com/license.html
- https://poly.pizza/search/ant and https://poly.pizza/m/90PJjBye5ZC
- https://kaylousberg.com/game-assets
- https://ambientcg.com/
- https://caniuse.com/webgpu
- https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- Local: `workers/crumbwar/DECISIONS.md` (Crumbwar measurements)

Search-result-only leads (not opened): Unity/Godot/Bevy size threads (discussions.unity.com, popcar.bearblog.dev, bevy-cheatbook), Unity Runtime Fee cancellation (unity.com blog), web.dev WebGPU post, WebKit bug 301627/299237, Noita GDC Vault 1025695, Emerson's Game AI Pro chapter.
