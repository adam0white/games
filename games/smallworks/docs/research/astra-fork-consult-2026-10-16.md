# Fork candidates: targeted game-design consultation

Date: 2026-10-16. Private research. No implementation, build, playtest, or integration proof is claimed. Repository documentation and upstream primary sources were read. Recommendations below are design judgments.

## Recommendation

Try **Endless Sky first**, **Cataclysm: Dark Days Ahead second**, and **OpenTTD third**. Keep **Veloren as the ambitious wildcard**. Choose the base by playing its existing loop before integrating HF. A fork solves the missing game problem only if Adam enjoys that game before we change it.

Endless Sky best combines the user's existing interest, retained equipment/fleet progression, and a small number of legible consequential people. CDDA already supplies embodied companions and rich physical consequences, but its interface is a major risk. OpenTTD supplies strong planning and durable infrastructure, but adding individuals is a new game layer. Veloren supplies a visible world and an unusually relevant simulation boundary, with larger engineering uncertainty.

Do not begin by replacing the interface or replacing all native AI. Those choices discard much of the reason to fork.

## Shortlist

| Candidate | Existing game worth preserving | HF opportunity | Principal mismatch |
|---|---|---|---|
| Endless Sky | Trading, exploration, missions, ship improvements and fleets | A few persistent captains decide whether to accept work, retreat, help, or leave | Native NPC abstraction is a mission-associated ship, not a complete person |
| CDDA | Turn-based survival, persistent world, equipment, physical constraints | A companion chooses real activities with existing world consequences | Dense controls and survival administration could repeat the rejected experience |
| OpenTTD | Route planning, network capacity, investment and persistent infrastructure | Rival operator or local decision-maker makes consequential commitments | No established individual-worker layer; macro strategy may overshadow people |
| Veloren | Visible action-adventure world and progression | Persistent travelers or companions choose destinations and activities | Action emphasis, changing codebase, and simulation aspirations beyond proven implementation |

## 1. Endless Sky: best first experiment

**Verified foundation.** C++ game built with CMake. Code uses GPLv3; artwork has separate entries in the copyright inventory. Its existing loop includes trading, missions, upgrades and exploration. [Repository and README](https://github.com/endless-sky/endless-sky).

The native AI owns ship execution, processes ship events, and supports orders, escort movement and route selection. Its source distinguishes these responsibilities. An `NPC` represents a mission-associated ship or fleet and its mission triggers. This is a plausible insertion boundary, but it does not prove autonomous off-screen careers. [AI interface](https://github.com/endless-sky/endless-sky/blob/master/source/AI.h), [NPC interface](https://github.com/endless-sky/endless-sky/blob/master/source/NPC.h).

**Proposed game.** The player remains a captain. One known captain accepts a jointly chosen journey, sees a real dangerous encounter, then makes a later decision using that experience. Their withdrawal changes available escort strength. Their help consumes their actual time, fuel or opportunity. The player can still trade, explore and improve a ship independently.

HF owns received observations, acquired methods, priorities and acceptance/refusal. Native AI owns flying, targeting and executing a permitted order. Preserve the existing controls. Add at most one concise captain panel that exposes current intention and observed reason.

**Bounded experiment.** One captain, two short journeys, one dangerous route, one alternative obligation. Run matched histories with experienced versus unexperienced danger and attended versus withheld instruction. Require a visible difference in the captain's later action, persistence after save/load, and a real effect on the journey. Start in loaded systems. Explicitly test what happens when the player leaves; do not pretend the stock engine simulates an independent off-screen economy.

**Kill criteria.** Stop if the meaningful action is only a dialogue choice; if the captain's identity disappears with a mission; if every journey needs new story flags; or if independent travel requires rebuilding the galaxy simulator before the first test. For an active-game goal, stop if Adam dislikes ordinary flight/trading. For an ambient-world goal, test watching and occasional intervention instead; liking a screensaver does not establish enjoyment of active flight, and active flight is not required for a worthwhile ambient simulation.

## 2. Cataclysm: DDA: strongest embodied-person fit

**Verified foundation.** A C++ turn-based survival game with a persistent procedural world. The project states CC BY-SA 3.0 for its code and content, with separately licensed included code. Its documentation allows JSON NPC definitions and dialogue effects. Native action selection is substantial C++ implementation; JSON dialogue flexibility does not establish a general external actor API. [README](https://github.com/CleverRaven/Cataclysm-DDA/blob/master/README.md), [NPC documentation](https://docs.cataclysmdda.org/JSON/NPCs.html), [NPC movement/action source](https://github.com/CleverRaven/Cataclysm-DDA/blob/master/src/npcmove.cpp).

**Proposed game.** A small survivor household has a real shared task and scarce supplies. One companion may help, take care of another need, or refuse. Their action consumes native materials and time. The player builds retained practical capacity while choosing which risks to take.

Use HF above native activity execution. Do not make HF calculate movement, combat or every physiological need. Avoid competing authorities: one system must own each need and commitment, with explicit observations passed into the other.

**Bounded experiment.** One companion, one safe starting location, one useful native craft or repair activity. Demonstrate the activity alone, then let the companion choose between performing it and a competing personal activity. Compare attended/withheld evidence and adequate/inadequate supplies. Require the existing activity system to produce the actual item or failure, and preserve both person and world state through a save.

**Kill criteria.** Reject if making the first 20 minutes enjoyable requires replacing inventory, crafting and controls; if the companion needs omniscient map knowledge; or if we merely reskin existing skill levels as HF learning. Its rich simulation is valuable only if the inherited interaction burden is acceptable. Do not select it solely because repairing things already exists.

## 3. OpenTTD: best strategic baseline, weaker person fit

**Verified foundation.** Transport simulation, GPLv2, macOS universal support. It has distinct free graphics/sound packages. NoAI provides scripted company AI in Squirrel, including save/load support; Game Scripts are another mechanism. This is an extension route, not proof that a TypeScript npm package can execute inside Squirrel. [README](https://github.com/OpenTTD/OpenTTD/blob/master/README.md), [official scripting documentation](https://wiki.openttd.org/en/Development/Script/Main%20Page).

**Proposed game.** A few named operators make investment and service commitments. The player's routes and earlier capital remain useful. HF might govern a rival operator's priorities or a local decision-maker's willingness to support a proposal. Do not model every passenger or make staff refusal randomly break a train schedule.

**Bounded experiment.** One rival operator chooses between two valid routes under a fixed budget. A prior observed service failure and a competing commitment change the choice. Native commands construct and operate the route. Show the decision through existing map consequences and a short report. Check both fresh and restored sessions. Establish a narrow runtime bridge before expanding the scenario.

**Kill criteria.** Stop if the person is just a name attached to an unchanged optimization function; if human preferences do not affect the player's planning; or if supporting actual workers requires a new labor simulator and UI. Prefer this base only if managing organizations satisfies the user's wish for alive NPCs.

## Wildcard: Veloren

**Verified foundation.** Rust action-adventure game, GPLv3, with official ARM64 macOS builds. Its `rtsim` module explicitly separates a high-level whole-world simulation from fine movement, combat and physics. The module lists NPC behavior and social/economic domains, but explicitly mixes what it manages with what it is intended to manage. Do not advertise that entire list as shipped capabilities. [README](https://github.com/veloren/veloren/blob/master/README.md), [rtsim source documentation](https://github.com/veloren/veloren/blob/master/rtsim/src/lib.rs).

**Bounded experiment.** One persistent traveler chooses between two destinations because of received information and one remembered encounter. Verify destination changes, actual travel, unloaded/reloaded continuity and persistence through restart. Keep ordinary action AI. This tests the useful boundary before attempting a society.

**Kill criteria.** Stop if the current world simulation cannot preserve one person's identity and intention across loaded/unloaded transitions without substantial reconstruction; if the result depends on unreleased roadmap features; or if combat dominates the experience Adam actually wants.

## Other named candidates

- **Unknown Horizons:** Strong thematic fit for settlement growth and goods. Python game logic uses FIFE C++ bindings and fifechan UI; GPLv2 with separate asset licensing. The dependency stack is a material build-validation task on this Mac. Do not call it abandoned without checking activity. Its economic population abstraction still does not give us embodied people. It is a reserve candidate if settlement economics beats personal action in the owner's preference. [README](https://github.com/unknown-horizons/unknown-horizons/blob/master/README.md).
- **Freeciv:** Strong deliberate turn-based strategy. Core GPLv2; Freeciv-web has a distinct AGPL client. Nations and cities are better existing decision units than individual people. HF leaders might make diplomacy less interchangeable, but a believable citizen society would be a substantial new layer. [Core README](https://github.com/freeciv/freeciv/blob/main/README.md), [official project site](https://www.freeciv.org/).
- **Mindustry:** Java automation/tower-defense RTS, GPLv3; JSON/HJSON content and JavaScript mod scripts are documented. Strong retained production infrastructure, weak existing human social premise. JS mod support does not imply npm compatibility. Recasting machines as people risks turning agency into inconvenient unreliability. Use only if factory planning is the actual desired game. [README](https://github.com/Anuken/Mindustry/blob/master/README.md), [license](https://github.com/Anuken/Mindustry/blob/master/LICENSE), [mod documentation](https://mindustrygame.github.io/wiki/modding/1-modding/).

## Why not start from Concordia or Generative Agents?

Concordia is a social-simulation library. Its documented pattern uses natural-language actions and a game-master entity to resolve outcomes, with access to an LLM API. It does not supply the mature player loop sought here. [Primary repository](https://github.com/google-deepmind/concordia).

Stanford's Generative Agents repository supplies a research simulation and browser environment, with separate environment and agent servers and an API-dependent setup. Its demonstration of simulated social behavior does not establish a satisfying strategy game or durable progression. [Primary repository](https://github.com/joonspk-research/generative_agents).

Both are useful comparison systems for behavior. Starting from them would leave us responsible for the game again. HF's selected role here is deterministic person state and choice inside an existing rule-governed game.

## Decision rule for the first spike

1. Adam plays the unchanged candidate long enough to make a consequential choice. Record whether he wants another session.
2. Inventory the exact engine, asset and dependency licenses before distributing a derivative. A private experiment is distinct from a published fork. Existing private-source delivery assumptions cannot silently govern an upstream copyleft derivative.
3. Preserve native rules and UI. Give one HF person real legal actions, received observations, persistent identity and one competing intention.
4. Run paired causal checks and save/load checks. Disabling HF must remove the claimed behavioral difference.
5. Have an unbriefed player encounter the person. They should describe a changed decision through its game consequence, without reading a personality dashboard.

Stop after that evidence. Do not expand to a world of people until one person makes the existing game better.
