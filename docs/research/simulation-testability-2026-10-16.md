# Simulation hosts: autonomous coding and verification

Inspected 2026-10-16. This supplements the host comparison; it selects no game. Refs come from [the pinned upstream list](upstream-refs-2026-10-16.json). Judgments below are estimates from source inspection, not successful builds or playtests.

An agent can meaningfully test changes in several of these projects. Existing tests, isolation boundaries and inspectable state matter more than language age. Cataclysm-DDA is a better example of executable NPC regression coverage than the newer AI Town. None provides an existing HF adapter or proves that HF will improve its experience.

## Comparison

| Host | Agent can test | Main difficulty | HF proving potential | Appearance verification |
| --- | --- | --- | --- | --- |
| Veloren | Rust unit tests; server and simulation code can be tested without the graphical client | Large workspace; world generation, ECS, server-agent and rtsim boundaries; assets and toolchain | High ceiling for persistent people, travel and encounters; expensive first integration | High: camera, terrain, animation, occlusion and real-time control require captured client play |
| Cataclysm-DDA | Dedicated Catch2 executable; real NPC movement, food, combat and needs fixtures; selectable tests and RNG seed | Large mature C++ simulation with many interacting rules and JSON content | High for bounded learning, commitment and companion decisions, if those are the selected experience | Lower for state assertions; terminal/tile UI still needs actual interaction and screenshot checks |
| Luanti + Minetest Game | Engine unit tests; dedicated server; Lua checks; development-game client smoke tests | Luanti is an engine. Minetest Game supplies a sandbox, not the requested living social game | Moderate after choosing a concrete game and NPC/action model; presently much of the experience must be authored | High for embodied voxel interaction; software rendering catches crashes/shader errors, not readability or feel |
| Unknown Horizons | Existing simulated game tests advance seconds and assert production; GUI harness | FIFE/fifechan native dependencies; dated pytest integration needs compatibility work | Moderate for bounded resident or worker decisions; economic production already exists, individual social agency is additional work | Medium: fixed isometric presentation, but actual GUI/native engine must run |
| AI Town | Jest tests for helpers, history serialization and conversation message construction; TypeScript build | Convex backend, asynchronous timers, inference and operational state; existing tests are not behavioral acceptance tests | Strong controlled HF-versus-LLM experiment surface; weaker evidence of a substantial game worth choosing on that basis | Relatively low for 2D browser inspection; conversation quality and persistent behavior still need separate evaluation |
| Original Generative Agents | Recorded simulation replay; inspectable persona state and step loop | Research application, separate browser/environment and simulation processes, old provider/dependency assumptions | Strong historical comparison baseline, weak default foundation for a new playable game | 2D inspection is manageable; replay displays recorded output and does not demonstrate fresh causal reproducibility |

“High ceiling” is a research opportunity, not a prediction that an adapter is quick. HF is published as a TypeScript npm package. Rust/C++/Lua/Python hosts need an explicit runtime boundary, state protocol and packaging decision. A browser backend already written in TypeScript reduces that boundary cost; it does not remove asynchronous simulation or inference uncertainty.

## Source evidence and reproducible entry points

Commands below are upstream commands or proposed focused invocations of upstream executables. **They were not run here.** They require a checkout at the linked SHA and its documented dependencies. A fixed seed should be chosen explicitly for comparisons; upstream CI's time-derived seed is unsuitable as the sole HF control.

### Veloren

Ref `2dbddc2ffa36db9a5c69cc831b65a7336ceab6a3`.

The [unit-test script](https://github.com/veloren/veloren/blob/2dbddc2ffa36db9a5c69cc831b65a7336ceab6a3/.gitlab/scripts/unittest.sh) exports `VELOREN_ASSETS` and executes `cargo test`. The [workspace manifest](https://github.com/veloren/veloren/blob/2dbddc2ffa36db9a5c69cc831b65a7336ceab6a3/Cargo.toml) separates common, networking, world, rtsim, server-agent and Voxygen client crates. The [rtsim manifest](https://github.com/veloren/veloren/blob/2dbddc2ffa36db9a5c69cc831b65a7336ceab6a3/rtsim/Cargo.toml) depends on world/common, ECS and Rayon. This is substantial coupling, despite modern Rust.

```sh
bash .gitlab/scripts/unittest.sh
# Proposed narrower compile/test entry, not evidence of a ready HF scenario:
cargo test -p veloren-rtsim
```

First useful proof: a fixed small world, one NPC and one conflicting obligation; assert chosen actions and saved state before touching client presentation. Do not replace locomotion or combat wholesale. Native build and graphical client startup are separate gates. World generation and simulation RNG scheduling must be controlled, rather than assuming one global seed gives matched events.

### Cataclysm-DDA

Ref `591f5dc8e391105b249fa209cc01f8d518cbd856`.

[Testing documentation](https://github.com/CleverRaven/Cataclysm-DDA/blob/591f5dc8e391105b249fa209cc01f8d518cbd856/doc/c%2B%2B/TESTING.md) identifies `tests/cata_test`, built by normal Make builds, and Catch2. [Actual NPC tests](https://github.com/CleverRaven/Cataclysm-DDA/blob/591f5dc8e391105b249fa209cc01f8d518cbd856/tests/npc_test.cpp) include `npc-movement`, `[npc_ai]` weapon decisions, food behavior, and comparisons between elapsed-time and per-turn body updates. Some tests are hidden with `[.]`, so a default passing run does not cover everything. [CI's test runner](https://github.com/CleverRaven/Cataclysm-DDA/blob/591f5dc8e391105b249fa209cc01f8d518cbd856/build-scripts/gha_test_only.sh) selects/shards tests and uses `--rng-seed time`.

```sh
# After the appropriate upstream build; proposed focused deterministic invocation:
tests/cata_test 'npc-movement' --rng-seed 12345
tests/cata_test '[npc_ai]' --rng-seed 12345
```

A narrow HF companion policy could use existing NPC fixtures and a finite action set. Assert refusal under unmet needs, changed decisions after received teaching, and persistence across save/load. Run original NPC controls alongside the adapter. The mature C++/JSON boundary is an integration cost, but existing executable tests make this more testable than “old code” implies. These fixtures do not establish a coherent household or repair game.

### Luanti and the concrete-game gap

Engine ref `0e1414682e4be3ffb84d067d0621e98d6bf5cd76`; Minetest Game ref `c42e4d0c0ff9d27ff7b9b308c3cfc14098dd3a0f`.

[Linux CI](https://github.com/luanti-org/luanti/blob/0e1414682e4be3ffb84d067d0621e98d6bf5cd76/.github/workflows/linux.yml) runs `./bin/luanti --run-unittests`, tests a server-only build with `./bin/luantiserver --run-unittests`, and runs the development client under Xvfb. [macOS CI](https://github.com/luanti-org/luanti/blob/0e1414682e4be3ffb84d067d0621e98d6bf5cd76/.github/workflows/macos.yml) includes arm64 builds and unit tests. [The single-player smoke script](https://github.com/luanti-org/luanti/blob/0e1414682e4be3ffb84d067d0621e98d6bf5cd76/util/test_singleplayer.sh) enables many visual effects with software rendering; it is useful for obvious rendering/runtime failures.

Minetest Game's [runtime test](https://github.com/luanti-org/minetest_game/blob/c42e4d0c0ff9d27ff7b9b308c3cfc14098dd3a0f/utils/test/run.sh) starts a Docker server and checks that `map.sqlite` exists. This proves startup/world creation, not NPC needs, relationships, teaching or an engaging game loop. Docker was unavailable here. No alternative Luanti game was inspected deeply enough in this pass to claim it closes that gap.

```sh
./bin/luanti --run-unittests
./bin/luantiserver --run-unittests
# Linux CI graphical smoke, not an Apple Silicon instruction:
xvfb-run ./util/test_singleplayer.sh
```

HF would need a selected game's entity perception/action API plus a process/runtime bridge. A scripted server scenario can check inventory, received observations, elapsed time and entity actions. It cannot judge camera clarity or whether a new player understands a voxel interaction. Selecting the engine does not select the game.

### Unknown Horizons

Ref `702203736ef3bcf1884a2256a11152b2f372366c`.

The [example game test](https://github.com/unknown-horizons/unknown-horizons/blob/702203736ef3bcf1884a2256a11152b2f372366c/tests/game/test_example.py) builds a farm and pastures, advances 31 simulated seconds, and asserts resource flow. This is meaningful economic simulation testing. [Test setup](https://github.com/unknown-horizons/unknown-horizons/blob/702203736ef3bcf1884a2256a11152b2f372366c/tests/conftest.py) mocks FIFE and uses `pytest_namespace` and `item.get_marker`; those legacy API usages are concrete compatibility risks with a newly installed pytest. They need a pinned compatible environment or a harness update before claiming the tests run. Python does not make this friction disappear. The [README](https://github.com/unknown-horizons/unknown-horizons/blob/702203736ef3bcf1884a2256a11152b2f372366c/README.md) lists FIFE and fifechan native dependencies.

```sh
# Intended test entry; compatibility unverified:
pytest tests/game/test_example.py
# Existing GUI wrapper uses Xvfb when available:
./run_gui_tests.sh
```

The [GUI wrapper](https://github.com/unknown-horizons/unknown-horizons/blob/702203736ef3bcf1884a2256a11152b2f372366c/run_gui_tests.sh) invokes pytest with `--gui-tests`. A first integration gate should be running the unchanged example in a reproducible environment. Only then estimate HF work. Existing production tests prove a useful baseline, but not resident individuality or knowledge.

### AI Town

Ref `8e05997f2409275669c8344b84a51692e83f3f33`.

The [package scripts](https://github.com/a16z-infra/ai-town/blob/8e05997f2409275669c8344b84a51692e83f3f33/package.json) provide Jest, ESLint, TypeScript/Vite build and Convex processes. [History tests](https://github.com/a16z-infra/ai-town/blob/8e05997f2409275669c8344b84a51692e83f3f33/convex/engine/historicalObject.test.ts) check serialization round trips. [Conversation tests](https://github.com/a16z-infra/ai-town/blob/8e05997f2409275669c8344b84a51692e83f3f33/convex/agent/conversation.test.ts) check that recalled memories remain untrusted message data. These are useful correctness checks, not evidence that a town learns, forms coherent plans or meets player goals.

```sh
npm test -- --runInBand
npm run lint
npm run build
```

The [README](https://github.com/a16z-infra/ai-town/blob/8e05997f2409275669c8344b84a51692e83f3f33/README.md) documents local inference options and Convex operations. Start/stop/archive/debug commands are operational controls, not a deterministic acceptance harness. A strong comparison would freeze observations and action opportunities, run HF and the existing LLM policy separately, and report task outcomes, violations, latency and inference cost. Disabling inference and seeing sprites move would not prove HF produces worthwhile autonomous people.

### Original Generative Agents

Ref `fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4`.

The [README](https://github.com/joonspk-research/generative_agents/blob/fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4/README.md) records Python 3.9.12, an API key in local `utils.py`, two concurrent servers and browser-mediated environment updates. Its commands are:

```sh
# environment/frontend_server:
python manage.py runserver
# Separate terminal, reverie/backend_server:
python reverie.py
# At the interactive simulation prompt:
run 100
```

[The simulation server](https://github.com/joonspk-research/generative_agents/blob/fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4/reverie/backend_server/reverie.py) exposes a step-oriented loop and saved simulations. The browser replay route displays an earlier simulation. A live inference rerun can differ; replay is not a matched causal rerun. Recorded memories and action traces make this useful as an HF-versus-LLM research comparison, but do not supply the game's objectives, consequence model or acceptance tests. No ready automated behavioral suite was established by this inspection; that is not a claim that none exists anywhere in the repository.

## Evidence actually obtained in this pass

Fetched pinned source files and CI definitions from GitHub, read the actual test implementations above, and checked available local tools. Local Python has neither pytest nor FIFE; Docker and Luanti binaries were absent. Cargo was present. No upstream checkout was built, no dependency installation was attempted, no game executable or behavioral test ran, and no screenshot/play evidence was collected. Avoid interpreting documented commands as local passes. The fetch process used recursive repository trees to locate paths; large trees can truncate, so directory omissions were not used as proof that a test suite does not exist.

## Shared HF proof and appearance gates

The first bounded integration should expose one actor, finite world actions and one meaningful outcome. Preserve the host's physics and existing low-level action execution. Record the observation delivered to the actor, its resulting internal state, its chosen action, and the host result.

Use paired controls: native policy, HF without teaching, HF with actual received teaching, and HF with an irrelevant or contradicted method. Include a need/commitment conflict and unsupported conditions. Hold exogenous events fixed independently of policy RNG draw counts. Save and reload mid-scenario; compare state and subsequent decisions. Measure success, resource conservation, unsafe or impossible action requests and action latency. An LLM comparison also needs frozen model/provider settings and repeated trials; deterministic HF should not be credited merely for producing more repeatable text.

Keep appearance acceptance separate. A headless pass can show that an NPC reached a coordinate or transferred an item. It cannot show that the movement looks plausible, the object is visible, the camera reveals the action, or the player knows what to do. For 3D candidates, require a reproducible camera path, screenshots at fixed checkpoints and real interaction footage or observed play, including collision and occlusion. Software-rendered CI is an early smoke gate; Apple Silicon GPU/client play remains a distinct compatibility and presentation gate. Adam accepts game feel.
