# Mooring Hour

Status: Astra wildcard review conditionally retained the concept. The requirements below include its corrections. No game built. Based on the first concept in the approved ideas list; an original small ferry rescue game, with original drawings, authored river and levels. Canvas 2D, TypeScript, current monorepo HF pin, published lab client. No recreation of another game's map, characters, art or rules.

## What the player does

Steer a ferry between two landing points during a rising river. Catch a mooring rope, choose a load, ask passengers to board and make the crossing. Departures close after six simulation minutes. Three trips form a complete loop. Grounding costs boat condition and time. A crossing underway can finish after departures close. The run ends with the actual people and supplies delivered. Partial delivery is a distinct ending. There is no numerical moral grade.

The river and hull fill most of the screen. Indigo moving current, cream banks, lit windows and bold paper silhouettes communicate state. The boat turns, passengers walk and cargo visibly tilts. Text is a short speech bubble attached to the speaker; it is never the main play surface. The waterline rises on the actual pier. The player can stop and inspect without losing a choice.

## First minute

Start with the boat drifting toward the lit pier. A single arrow is attached to the tiller. It disappears only after the player turns toward the berth. At the berth, the rope handle glows until the player catches it. The ferry settles and a real passenger approaches. The passenger points to a medicine crate and a visible load outline shows that both fit. The player loads the crate, asks the passenger to board, then pushes off. The lesson changes the ordinary run. Skip and replay sit in the menu. No instruction paragraph must be read to find the first decision. Missing the berth produces a scrape, a new reachable berth and visible damage; no soft lock.

## Cast and agency

Use canonical Burak, Dilan and Aylin, with their existing registry ids and complete profiles; add this game's role and carry mapping to the HF registry before building. These are their original authored HF characters, not characters borrowed from another work. The player pilots the boat and cannot control a passenger. Burak is a passenger who can hold a mooring line, not an assumed trained ferryman. Dilan wants to complete a delivery; Aylin has a promised family call. Their existing occupations are not invented boating skills.

The host owns steering, collision, load and time. HF owns people's fatigue, held memories, commitments and acceptance of a request through public APIs. Each passenger can board, wait or decline; visible movement follows the recorded HF decision. If a request's conditions change before boarding completes, revalidate and visibly cancel it. Never decide willingness from a host trust threshold and call that HF agency. Before expanding past one crossing, demonstrate one accepted and one refused request, each caused by an ordinary supported HF transition, with a source-unread reviewer able to explain what changed. Compare with a fixed-response control. If this cannot work without a new faculty, bring the generic engine gap to HF rather than putting it in the game.

A prior kept delivery promise may influence a later request but cannot guarantee agreement. Show only what the passenger says or does. Do not expose private registry secrets in HUD labels. A player's earlier load decision changes the later passenger's available departure; a remembered interaction must also change the later public request or response in a pinned replay control.

## Input and replay

Keyboard arrows/A-D steer, Space handles the nearby rope or boarding offer. Pointer/touch use large left/right steering and context handles; no drag-only action. An optional slower simulation speed changes wall time only. The menu pauses. A fixed host simulation tick records normalized input changes and discrete requests. Render frames interpolate; no physics or HF decision uses wall time or Math.random. HF steps at bounded simulation events; measure the actual cost before selecting frequency. Every current-version export pins seed, host version, HF version/build, cast revision/admission, initial state, normalized input log and final state hash. Replay does not contact a model. Namespaced save and telemetry keys; path-scoped worker. No old-origin import.

## Done and review

Astra wildcard review before code. One playable complete three-trip run; live /mooring-hour/release.json matches exact green signed commit and dirty:false. All three passengers have visible independent decisions; an accepted/refused request and memory-effect control replay. Notice, recording off/on, shelf and lab receipt work on play origin. One cheap synthetic panel round and same-panel retest, labeled synthetic, then default Codex final review and hosted PR gate. Phone and desktop action checks reach the first crossing without reading body text. Owner taste acceptance remains separate; coordinator receives the shipped game for taste review.

## Deferred

- 2026-11-24: second river and procedural banks, after the first authored run is readable and enjoyable.
- 2026-11-24: gamepad remapping and audio score, after pointer, keyboard and touch have equal reachable actions.
- 2026-11-24: additional passengers, after existing cast recurrence is tested; no cast expansion in this build.
- Multiplayer and account transfer remain outside scope, pending owner discussion.

## Astra review resolution — 2026-11-05

The wildcard review conditionally retained the concept. Builder requirements below resolve its open rules; gameplay and HF feasibility remain unproven.

The river has a west village landing at (120,380) and east clinic at (760,380) in an 880×520 logical canvas. A north depot at (440,130) is background scenery. A constant small motor provides forward thrust; left/right rotate the heading, releasing controls damps turn velocity. Current adds a small eastward velocity. The engine is bounded kinematics, with no buoyancy. A 70-pixel mooring circle and low-speed threshold let the context action catch a line; no pixel-perfect docking. Missed mooring leaves a downstream turning basin with room to circle back. Scrapes reduce condition; reaching zero condition ends in grounding at the nearest reachable bank.

The complete run uses this route: village → clinic → village → clinic. The north depot is background scenery only and no claim of three unique landing routes remains. Dilan travels on trip one, asks the player to return to the village on trip two and bring her sister Aylin to the clinic on trip three, and meets the boat again at the clinic on trip three. Capacity is three visible floor slots: a person uses one and a crate uses two. Trip one teaches Dilan plus medicine, which fit. Aylin and her crate compete with Burak for three slots on the final crossing; the player can carry both people or one person and the crate, and the left-behind option misses the last crossing. The promise is made to Dilan in a public interaction and the kept/broken event is delivered to her at the clinic after trip three. Her later requested help holding the clinic line uses the same public request under matched conditions; inspect the received event and recomputed decision to test memory. A physical cargo difference alone does not count as the memory proof.

At 360 simulation seconds no further departure can start. A crossing already underway may reach a bank; it cannot start another. Three completed trips or an inability to continue gives the corresponding ending. Refusal never blocks time or a required UI step. Inspection and menu both freeze boat, water, deadlines and HF time. Slow speed scales all clocks together. Tick order is held-control update, request input, preconditions, HF decision, scheduled action completion, flood/deadline, render snapshot. On focus loss record a neutral-control input so steering cannot stick. Current-version replay recomputes every HF decision. The fixed-response comparison is a separate experiment, never a replay shortcut.

Naming check, 2026-11-05: the earlier working title is also used for a composition in the [PixelWall Willowmere guide](https://www.pixelwall.dev/guides/willowmere). Mooring Hour is this game’s authored title. The limited search did not establish worldwide name uniqueness. No art, characters or level layout from that project is used.
