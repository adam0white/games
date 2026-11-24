# Lamp Keeper

## 2026-11-24 — implementation and acceptance

A one-thumb route puzzle about helping a hillside village find its way home. Draw from the keeper through connected lamps and release to walk. A route can revisit a branch. Draw again to replace the remaining route. The first evening has an animated finger on the actual path; no written instruction is required. Wind marks the threatened lamp before extinguishing it. Neighbours wait in darkness, follow available lit paths, and add a permanent light on arrival.

Ten hand-ordered evenings unlock in order, followed by a daily evening. The daily uses the device's local calendar date. It changes geometry, destinations and gust timing; the best score stays on this device. There is no telemetry or server submission.

Acceptance: every evening solves through the route API; idle play loses; real lit lamps extinguish and can be relit; a neighbour finds a fully lit alternative route; wind does not teleport a neighbour already walking; equal seeds and input reproduce the same state. Phone checks cover gesture input, result cards, pause, leaving the page, route cancellation, progress reload, daily score reload, corrupt saves, denied storage and retry after loss.

### Decisions

- Faith-adjacent theme through care, light and hospitality, without doctrine or religious tests.
- Two visual variants: `?look=amber` (default) and `?look=rose`. Same rules. Procedural canvas hills, houses, keeper, neighbours, stars and light; no external assets.
- A permanent home light cannot blow out. Neighbours replan only at nodes; an occupied edge remains stable during a gust.
- Simulation ticks are 0.025 seconds. Keeper speed is 38 world units/second; neighbour speed is 17. The first evening allows 18 seconds; later evenings allow 55. The generous budget is intentional for the first playable version, but human difficulty is unmeasured.
- Score is rounded remaining seconds × 100 + arrivals × 500. Earlier evenings can be replayed. The daily unlocks after evening 10.
- Kit imports: save, audio, pause, zoom, screens and path hint. `/notes/button.js` is loaded. Absolute graph-path input belongs here because the kit's drag control is relative steering.
- Save contract: `night-lamp-keeper:save` contains `{v:1, unlocked:1..11, sound:boolean, played:boolean, daily:null|{day:"YYYY-MM-DD",score:number}}`. Hint key: `night-lamp-keeper:hint`. Failed writes show a session-only warning. Existing external keys and formats are untouched.
- Only this folder was edited. No registration, deployment or shared-code change is included.

### Ordered evenings and bot results

`fnm exec --using=26.12.0 node experiments/lab/night-lamp-keeper/bots.mjs`

| Evening | Teaching focus | Careful completion, seconds | Clumsy mean, seconds | Clumsy wins |
| --- | --- | ---: | ---: | ---: |
| 1 | Draw through lamps | 5.050 | 5.346 | 20/20 |
| 2 | A junction serves two homes | 6.175 | 6.898 | 20/20 |
| 3 | Return after wind | 9.125 | 10.015 | 20/20 |
| 4 | Home light survives wind | 7.275 | 9.133 | 20/20 |
| 5 | Visit both arms of a fork | 8.525 | 11.750 | 20/20 |
| 6 | Use a loop for the return | 10.250 | 10.745 | 20/20 |
| 7 | Order three branches | 12.950 | 15.676 | 20/20 |
| 8 | Share a lit path | 11.650 | 13.553 | 20/20 |
| 9 | Watch the upper junction | 11.275 | 13.915 | 20/20 |
| 10 | Join all branches | 13.700 | 17.290 | 20/20 |

Careful: 10/10. Idle: 0/10. Clumsy: 200/200, with a 45% chance of choosing an adjacent detour and 0.3–1.5-second decision delays. These bots know the graph and neighbour routes; their success is evidence of solvability, not an estimate of human success or enjoyment. Difficulty is forgiving and not monotonically increasing.

Four daily dates, 2026-11-24 through 2026-11-27: all solve in 15.800, 11.300, 13.475 and 11.875 seconds. Seeds are 35190161, 18412542, 1634923 and 4279824600. Repeated runs match exactly. Destinations and geometry differ across dates.

`fnm exec --using=26.12.0 node experiments/lab/night-lamp-keeper/bots.mjs --mutate` exits **1**. It disables lamp ignition and fails the actual lit-detour assertion. There is no forced failing assertion conditional on the flag.

### Review corrections

- Neighbours originally committed to an unlit shortest route even when another route home was fully lit. The independent regression draws `[0,1,5,6,5,4,8,4,3,7]` on evening 10, leaving node 2 dark. All three now arrive through the alternative lit route.
- A draft now rebases to the current keeper target on release. Cancellation leaves the prior queued route intact. Reversing over a branch adds a return leg instead of erasing that branch.
- Save denial is visible. A first attempt does not mark the tutorial learned until a route is accepted.
- Upper houses originally appeared above the hill. The far hillside now begins at world y=20, behind every node, with static terrace and vegetation marks.

### Check timing and environment

The initial broad kit run passed its WebKit kit self-test, then was stopped to avoid duplicating concurrent broad suites. A focused attempt briefly failed because shared `phone.mjs` referenced `pages.mjs` before that concurrent file existed. A later focused `phone.mjs kit` run passed WebKit and Chromium. This folder did not change those files.

The retry check originally asserted simulation time under 0.25 seconds immediately after a tap. A heavily loaded host (measured load average 151.53) let frames advance before the tool returned. The check now verifies the actual reset: play state, zero arrivals, keeper at the start, empty queue, all neighbours reset and no prior loss event. No gameplay threshold or bot acceptance limit was loosened.

Browser evidence and remaining gaps follow.

A separate static WebKit probe reproduced the startup failure: a visible, focused document produced 0 animation frames after 1.5 seconds. Resizing its viewport started rendering (163 frames observed at the next sample); reload then rendered normally (136 frames). The phone harness now resizes WebKit by one CSS pixel and restores the exact device viewport before testing. It does not force clicks, bypass stability checks or alter game time. The first blank screenshots were rejected.

The screenshot operation timeout is 90 seconds rather than Playwright's default 30 seconds. A later combined run stalled while capturing the first WebKit menu after its controls had already passed hit-testing/stability checks. This extends only artifact capture on the overloaded host; route, win, loss, save and timing assertions are unchanged. The browser was also observed above a 360 load average during concurrent work. This is a test-host limitation, not a measured phone-performance result.

### Browser evidence

Command: `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules fnm exec --using=26.12.0 node experiments/lab/night-lamp-keeper/check.mjs` (optional final argument `webkit` or `chromium`).

Final combined check: exit **0** on both profiles. Recorded results:

| Profile | Evening 1, seconds | Daily, seconds | Daily arrivals | Daily score | Browser errors | Outside requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WebKit, iPhone 13 | 9.700 | 14.075 | 3/3 | 5593 | 0 | 0 |
| Chromium, Pixel 7 | 10.950 | 17.825 | 3/3 | 5218 | 0 | 0 |

Both profiles exercised the page controls and simulation in real time. Route checks alternate dispatched touch PointerEvents with paced native mouse drags on the phone viewport. This covers browser hit testing and pointer capture as well as touch-event handlers; it is not a physical-touch test. Thirteen visible menu controls meet the 44 CSS-pixel target minimum. Daily mode is reached from a compatible progressed-save fixture; the ten-evening campaign is solved by the simulation bots, not a full ten-evening browser playthrough.

Sixteen screenshots are in `/private/tmp/night-r2-astra2/`: eight per profile covering amber menu, first-evening gesture hint, ending, pause, rose menu, daily home light, daily ending and nightfall. The screenshots were opened and inspected. Text fits the cards; controls stay inside the viewport; upper branches sit on terrain; arrived-home windows glow; unarrived windows remain dark.

### Unverified and limits

- Human enjoyment and whether a first-time player understands the gesture without reading. The owner accepts these through play, not bot scores.
- A physical phone, thumb reach, accidental multi-touch, thermal behaviour and sound by ear. No real-device performance claim.
- A real midnight transition; fixed date generation and new-date save replacement are covered.
- A complete ten-evening campaign through browser input. Each evening is independently solved in Node; browser checks cover evening 1, evening 2 pause/cancel, and the daily.
- Keyboard gameplay and a screen-reader-accessible graph are not implemented; keyboard controls only pause/resume.
- No deployment, live integration or full shared-suite success is claimed. The earlier focused kit self-tests passed both profiles. The final focused run passed Chromium but failed WebKit with `hint: shown after the delay of play`. That shared timing assertion was not changed. Concurrent browser startup/capture failures are documented above.

## 2026-11-24 — phone play review

- The first-evening gesture now traces both real path segments, from the keeper to the house. Previously the canvas traced only the first segment, and after 4.5 seconds the kit drew a separate four-dot path across the terrain. The kit still supplies the reduced-motion text. The canvas holds the complete dotted route still when reduced motion is requested.
- The landscape menu uses one row for ten evening buttons. The sound button previously ended at y=468.34375 in a 390 CSS-pixel viewport and y=467.6875 in a 412 CSS-pixel viewport. The page now permits vertical panning on cards. The canvas retains its drag handling.
- A route can start on the walking keeper. While the thumb is down, the keeper finishes the current edge and waits at its endpoint. Releasing replaces the remaining route. Cancelling preserves it. Previously the visible keeper rejected a grab outside the target's hit area. An intermediate patch could still discard a slow gesture when the old route left the anchor before release.
- A win writes the unlock or daily best on the frame it occurs. A reload during the 900 ms before the result card previously reopened the menu with only evening 1 unlocked. Both profiles reproduced that state loss.
- Evening 4 exposed a wind recovery problem. Waiting about one second before tracing the first-home route let the five-second gust extinguish its lamp before the neighbour arrived. The page now marks the dark lamp until the keeper relights it. The browser check waits at least 1.2 game seconds before sending the route, sees the lit lamp go dark, returns to relight it and verifies the cue clears. The gust schedule and level budgets stayed the same.
- Holding P keeps the pause card open. A fresh key press toggles it. The check sends a repeated keydown while paused.

The browser check keeps the existing 44 CSS-pixel minimum target and storage, pause, retry and error assertions. It adds rotated-menu hit testing, a canvas pixel check on the second tutorial segment, a held reroute and a save read before the result card. Profile taps use Playwright's touchscreen. Campaign drags use browser mouse events in WebKit and CDP touch events in Chromium. The wind setup and parts of the daily check dispatch touch PointerEvents. All campaign and daily play uses normal simulation time. The check verifies WebKit has painted and retries the viewport resize if navigation stalls frame delivery.

Pure checks on Node 26.12.0 exited 0. Careful play won 10/10, clumsy play won 200/200 and idle play won 0/10. All four fixed daily seeds solved. The disabled-ignition mutation exited 1 at the lit-detour assertion. Acceptance thresholds stayed the same.

The combined browser check exited 0. Both profiles started with a fresh save, cleared all ten evenings and unlocked and won the daily through the menu. They each brought 25 neighbours home across those 11 wins. They returned from Back at the menu, restarted the unlocked evening, reloaded mid-evening and retained the completed unlock. Both also retried after an idle loss and reported zero browser errors and zero outside requests.

| Evening | WebKit iPhone 13, game seconds | Chromium Pixel 7, game seconds |
| --- | ---: | ---: |
| 1 | 11.825 | 11.050 |
| 2 | 7.125 | 6.400 |
| 3 | 9.675 | 10.175 |
| 4 | 14.025 | 13.925 |
| 5 | 9.825 | 10.100 |
| 6 | 11.275 | 11.650 |
| 7 | 13.575 | 14.350 |
| 8 | 11.200 | 12.250 |
| 9 | 11.750 | 11.675 |
| 10 | 18.500 | 17.600 |
| Daily | 16.800 | 15.825 |

Daily scores were 5320 and 5418, both saved and recovered after reload. Landscape viewports were 664 × 390 and 839 × 412 CSS pixels. The sound controls ended at y=358.34375 and y=369.34375. All 13 menu controls passed at 44 CSS pixels or larger on each profile. The second tutorial segment had 49 and 52 bright sampled pixels. Inspected all 42 captures in `/private/tmp/night-r3-review/lamp/acceptance/`, including the later graphs, both wind states, results, pause, retry and landscape.

Physical touch and safe-area behaviour, audio by ear, a stranger's learning time, a real midnight transition and deployment remain unverified.
