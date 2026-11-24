# Lantern: Race

Lab page at `/lab/lantern-race/`. Only this directory is changed. No build, dependencies, recording, commits or deployment.

## Rules and decisions

- The page imports `../../lantern/sim.js` unchanged. The race layer in this directory does not re-export Lantern. Boat collision, flame decay, river generation, pickups and dawn remain Lantern rules.
- A server seed selects Night 1, 3 or 6 (`seed % 3`). A race ends at Lantern's dawn, or when the boat sinks or its light goes out. A completed night takes 73.4–87.2 simulation seconds. An early sinking can end sooner.
- Everyone starts without bought stats, gifts or power pickups (`create(seed, night, false, [])`). Embers remain. This gives every boat the same setup; surviving boats can tie exactly on distance and time. The current experiment tests simultaneous survival rather than adding a new speed mechanic.
- Distance is Lantern progress to dawn scaled to 0..100000. Rank by descending distance, then ascending elapsed simulation milliseconds. Exact ties use socket ID for stable display order. The result card says when other boats are still racing and refreshes as they finish. A 150-second deadline marks stalled boats retired.
- Other boats do not enter the player's simulation. Reported lateral coordinates are interpolated 200 ms behind arrivals. Missing reports hold their last position; they never invent distance. Regressive distances are ignored. Terminal results cannot be revived by subsequent progress frames.
- Ghosts at the same distance are spread vertically so their labels remain readable. The side bar retains their reported progress. Labels are clamped into the viewport.
- An empty room supplies three local bots, on the same seed/night and the unchanged sim. Their reaction intervals are 0.4, 0.22 and 0.065 seconds. Their policy tests the whole lateral approach to a candidate lane, not just its endpoint. The slow bot also wanders on a seeded deterministic schedule.
- Bots advance in reserve even during a human race. If the last other human leaves, or the socket fails, the three bots appear at their actual elapsed progress. A socket failure keeps your current river. An initial failure selects the daily UTC seed. Rematches increment it, rotating the three nights. This is the return incentive along with the best distance saved on this device.
- `you.round` means a round already exists: a new arrival waits in the lobby. Only a new `round` frame starts play. An ignored Ready retries at most once every two seconds, so an early Rematch needs only one tap. Duplicate round frames do not restart the river.
- The countdown uses `start - Date.now()` clamped to 1..6 seconds, then a monotonic local deadline. The page sends a progress frame every 200 ms during play and a final progress frame before `done`. `done.s` means elapsed simulation milliseconds, not Lantern score.
- Offline pause freezes the river and all bots and extends the deadline by the full pause duration. Pausing a live race retires your boat; freezing only one player's clock would change the result. Menu disconnects. Sound uses only the shared kit.
- The supplied 2D Lantern style determined the palette and drawing treatment. Existing Lantern hull, wake and reeds are imported read-only. No new visual direction gate or catalogue entry was added for this prescribed lab experiment.

## Connection and privacy

Quick race uses `open`. Friends can create a cryptographically random four-letter room, join a typed code, or open `?room=ABCD`. Share copies that URL; if clipboard permission is unavailable, the URL is shown for manual copying. The name is trimmed, stripped of control/markup delimiters and limited to 16 Unicode characters. All names render as text, never HTML.

Only a chosen boat name and the contract's race frames are sent to the same-origin room WebSocket. No lab recording. No identity, account, telemetry, external asset or model request. The feedback button is loaded as requested from `/notes/button.js`.

Protocol conflict: the brief caps every frame at 200 UTF-8 bytes, but a legal `you` roster with eight 16-letter ASCII names and a round is **334 bytes**. Even a roster excluding self can exceed 200. All outbound frames and inbound relays obey 200 bytes. Only inbound `you` accepts up to 2048 bytes, with schema, name, ID, count and unique-ID validation. Other malformed or oversized frames are ignored. This receive-only exception is necessary for eight-player rosters; the server may send a single roster as its current implementation does. A 4001 close says “Room full · offline” and supplies bots.

Contract limitation: relayed frames have no round identifier or sequence. WebSocket transport order and the server's round boundary must order reports. The client rejects reports during countdown and latches terminal results, but cannot distinguish an old progress frame sent after a new round starts. The server should fence participant frames if that becomes a problem.

Storage contracts (new keys): `lantern-race-name` string; `lantern-race-best` integer 0..100000; `lantern-race-sound` `0`/`1`; `lantern-race-played` `1`; `lantern-race:hint` managed by the kit. All use kit storage and leave Lantern's keys alone.

## Rule checks

Run `node experiments/lab/lantern-race/bots.mjs`.

**9/9 checks pass.** They cover ranking (including unfinished and exact ties), non-mutating sort, interpolation endpoints/midpoint/loss/regression, protocol ranges, malformed JSON, malicious names, roster bounds, code generation, countdown clamps, seeded ghost traces, and measured difficulty.

| Night | Clumsy dawn finishes | Clumsy mean distance | Careful dawn finishes | Careful mean distance | Complete night |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 34/120 | 78.6% | 40/40 | 100.0% | 87.2 s |
| 3 | 10/120 | 64.7% | 35/40 | 97.9% | 81.5 s |
| 6 | 5/120 | 52.2% | 35/40 | 96.8% | 73.4 s |

Seeds are consecutive from 1, without artificial lives or invulnerability. Careful bots finish every selected night, but do not finish every seed on the later nights. The stats do not establish that people find the game fun.

Outbound frame audit: **204 samples, maximum 81 bytes**, including a 16-emoji name and coordinate clamps. The same seed and policy produce exactly equal traces for all three bot skills.

Mutation: `node experiments/lab/lantern-race/bots.mjs --mutate` reverses the distance ranking function while running the same assertions. Observed result: **exit 1, 8/9 checks passed**; it fails specifically on the independent expected ranking `[1,3,4,5,2]`. No source file is modified by this run.

## Browser verification

Command: `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/lantern-race/check.mjs`.

The test serves the **experiments root**, supplies the requested tiny RFC6455 Node mock and an empty notes-button script, and launches WebKit iPhone 13 and Chromium Pixel 7. The mock's handshake, peer lists, first-Ready start, active-round rejection and late-join behavior follow the room server source read at `workers/lab-ai/src/index.mjs` and `room.mjs` on 2026-11-23. These sources were not edited. A late spectator is excluded from the active ranking until the next round. Frames and rolling client rates are independently checked by the mock.

Full races use a continuous synthetic touch PointerEvent path through the shared drag control, as the Fix-It model does, with botControl deciding the thumb's target. Trusted browser input also checks hit testing: Chromium CDP touch drag; WebKit native touchscreen tap plus mouse drag. Synthetic full-race input does not establish real-device touch feel.

Final default command: **exit 0**. Both profiles completed two full Night 1 rivers at **87.2 s** each. WebKit received **438/437** remote position reports; Chromium received **437/436**. Every primary online and clean-close offline page had **zero page, console and network errors**. The mock observed **6 rounds, 1953 position frames, 8 done frames, maximum 36-byte client frame and maximum 7 messages per rolling second**.

Both profiles passed Ready/rematch, saved name/best, offline pause and P-resume, all-bot result settlement, late arrival waiting, no phantom spectator rank, friends create/join/share, and three-bot fallback after the last human departure. Chromium also passed 360x640 and 1280x800 mouse-input/card-bounds smoke. The isolated HTTP-404 upgrade test recovered offline on both engines; each engine emitted **one expected browser-generated WebSocket console diagnostic**, which is explicitly accounted for rather than claimed as zero. No application page error occurred there.

Earlier runs exposed and fixed synthetic pointer capture and a test that steered outside the banks before trying to pause. The final default run includes the corrected test. Final menu/mid/end and animation-settled small/desktop screenshots were visually inspected. The existing shared-kit Lantern phone smoke passed before changes on WebKit, and after changes on both WebKit and Chromium. The whole shared-kit catalogue was not run; no shared files were changed or test-registration keys edited under the directory-only restriction. Screenshots go only to `/private/tmp/night-lantern-race/` (menu, mid-play and end for both human pages and offline; plus 360x640 and desktop).

## Unverified and open

- Live production room integration and deployment are not verified. This deliverable stops at the runnable page and contract mock.
- Real iPhone/Android sound, silent switch, thumb feel, networking across devices, reconnect under actual mobile handoff, clipboard behavior across browsers, and human enjoyment remain unverified. The shared kit retains its audio unlock behavior.
- The full night uses synthetic touch dispatch; trusted input smoke is narrower. No claim that all phone gesture arbitration has been tested.
- Eight-player layout/schema is supported, but the end-to-end race test uses two humans plus a separate solo bot race, not eight physical players.
- `done.s` has no unit in the supplied contract. This client uses milliseconds. A future server-side ranking feature must preserve that meaning or explicitly version it.
- Remaining ideas: meaningful finish-time differences between surviving boats (currently exact ties are common); reconnect identity; server round identifiers; ready-state broadcasts. These are open design options, not unfinished work required by this brief.
- Two read-only reviewers found and prompted fixes for offline pause duration, final bot result refresh, last-human departure fallback, stale-round joins and terminal ghost state. The first phone run also caught synthetic pointer capture. The final checks include these lifecycle paths where feasible.
- The configured brain decision-log index was unavailable. No claim in this file relies on it.

## Tested imported sources

Read-only SHA-256 snapshots at verification:

- `experiments/lantern/sim.js`: `2a8124b74e48b0d5b7278ea4dd465740558ec8114767d3ea3dd01ae209f87765`
- `experiments/lantern/looks.js`: `6e983e4ee06927b23620c1577f53fa67b3ffd411049f7cc37eb513e02b27a696`
