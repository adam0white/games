# Lantern: First Person

A lab page at `/lab/lantern-fp/`, answering tester notes #158 and #159: the view from the boat, with left/right taps instead of dragging. Acceptance is the shared build brief: seeded rule checks, a failed steering mutation, two phone engines, visible menu/play/end captures, and a no-WebGL2 fallback. The owner accepts the play feel; bots do not judge it.

## Rules and controls

`sim.js` imports and re-exports `../../lantern/sim.js`. No river rule was copied or changed. Rocks, collisions, flame decay, pickups, powers, speed, fifty nights, and dawn all come from that file. This page has no shop, purchased stats, or rebirth modifiers. A completed night unlocks the next night. Device saves are separate from Lantern and Lantern 3D.

A press starts on one half of the river. Left subtracts **0.025** from a persistent target x; right adds **0.025**. Releasing keeps that target. Holding waits **12 fixed ticks (200 ms)**, then repeats every **2 ticks (30 steps/s, target rate 0.75 river units/s)**. The target clamps to [0,1]. The upstream `step()` moves the actual boat toward it using its original steering cap, and applies the original bank collision. Pointer motion does nothing. Crossing the middle while held keeps the original side. Arrow keys use the same adapter and hold timing. Pause, lost capture, cancelled pointers, key release, and leaving the page stop a hold. Resume sets the target to the boat's position.

The page seeds its default river from the UTC date plus the night, so everyone on the same night gets the same daily river. The date is outside the rules. `?seed=N` fixes the seed; `?night=N` selects an original night. `?speed=1..8` only multiplies the fixed-tick clock for diagnosis; the phone completion check uses speed 2 with the same original fixed ticks. A failed run restarts the same daily river.

## Drawing and kit

`render.js` adapts this repository's `lab/lantern-3d/render.js`. It keeps its river-table texture, faceted hazards, water waves and specular reflection, light attenuation using the original `sight()`, fog, rain, reeds, pickup glows, and dawn. The eye follows the boat, 0.085 units above water and 0.045 units behind its row, looking downriver with a 72-degree vertical field of view. The lantern is moved onto the bow. The near plane is 0.004. Both boat and lantern remain visible. Permanent distance fog and sparse code-drawn stars establish depth. Renderer reads state and never advances or changes rules.

Kit imports: `save.js`, `audio.js` `sound()`, `pause.js` `onLeave`/`isPauseKey`, `zoom.js` `noZoom()`, `screens.js`, `hint.js` with kind `tap`, key `lantern-fp:hint`, 1.5-second idle delay, active only in unpaused play, and prior-play detection from saved runs. The page loads `/notes/button.js`. No `lab.js` import, player identity, or recording is used on this lab page.

## Storage and sharing

`lantern-fp-save` is one object with `best`, `opened`, `runs`, `sound`, `name`, `sharing`, `boardId`, and `pendingRemove`. These new keys do not touch Lantern's saves. `best` is `(night - 1) * 100 + floor(original progress * 100)`; each night is 100 distance points. `opened` is the next unlocked night. The hint uses its separate new key above. Reads and writes use the kit's nonthrowing storage helpers.

The board uses **GET/POST `/lab-api/board/lantern-fp`**. GET runs when the player opens the board. Nothing is posted before an explicit Share with a typed name and a positive device best. POST is `{id,n,s}`; the random UUID, typed name (up to 16 characters), and best distance are the entire payload. After opt-in, finished runs can update the best under that ID. Stop sharing disables further updates locally and requests `{id,remove:true}`. POSTs are serialized, and queued score uploads are discarded if consent was revoked before dispatch, so an earlier automatic upload cannot be sent after removal. Stop keeps the opaque ID in `pendingRemove` until a successful removal response. Failure shows "row removal unconfirmed" and a Retry removal button; that explicit retry survives reload. An unavailable server cannot establish removal. GET responses use the same `{rows:[{n,s}],place}` shape as Lantern. Names are rendered with `textContent`, not HTML. A 404, offline transport, malformed response, or 3.5-second timeout leaves a device-only board and a working Back button. Failed score uploads are not retried. Removal retries require the player to tap Retry removal.

## Verification results

`node experiments/lab/lantern-fp/bots.mjs`: **exit 0**. The default sample uses seeds 1–200.

| Policy / night | Natural dawns | Mean distance |
| --- | ---: | ---: |
| Original 2D careful, night 1 | 38/200 (19%) | baseline |
| Tap careful, night 1 | 43/200 (21.5%) | 62.4% |
| Clumsy, night 1 | 3/200 | 29.5% |
| Clumsy, night 3 | 0/200 | 22.3% |
| Clumsy, night 8 | 0/200 | 20.3% |
| Clumsy, night 20 | 0/200 | 13.4% |
| Clumsy, night 50 | 0/200 | 9.0% |

The clumsy policy observes every 150 ms, misses or reverses some inputs using seeded randomness, and permits at most 10 taps/s. Its dawn rate reaches zero at night 3, so the later decline is measured by distance, not a strictly decreasing completion rate on each consecutive night. This is a difficult unchanged game: three first-night successes do not establish beginner friendliness.

The careful tap policy has the original 2D careful policy's target scoring and discretizes it into taps. It permits one tap per 60 Hz tick in bursts; its measured mean is 351.2 taps over 58.7 seconds (about 6/s), and successful night-1 runs last 85.2–88.2 seconds. The acceptance tolerance was no more than 10 percentage points below the 2D baseline. The actual tap result is 2.5 points higher. **This is a control-capability comparison, not a demonstrated human-speed equivalence.** A preliminary 10-taps/s version of the simple careful policy reached dawn only 5/200 times.

All **50/50 offered nights** have a natural dawn witness with taps, without changing simulation state. The harness tries the basic careful policy on seeds 1–20 until it wins, then an expert policy on seeds 1–200 if needed. The expert predicts moving-rock positions at bow arrival, samples targets on the actual tap grid, and seeks visible pickups. Forty-three nights use the basic policy; the seven expert witnesses are night 31 / seed 1, 37 / seed 5, 38 / seed 1, 40 / seed 2, 45 / seed 2, 49 / seed 1, and 50 / seed 1. This adaptive witness search proves reachability; it does not measure an unbiased win rate for all fifty nights.

Determinism: **4,598 ticks** of recorded tap inputs replay with identical complete state and event trace. A second same-seed policy run also matches, and another seed differs. Independent contracts cover left/right direction, exact target displacement, the 200 ms hold delay, repeat cadence, boundary clamping, and release.

`node experiments/lab/lantern-fp/bots.mjs --mutate`: **exit 1, five failing checks**. This deliberately reverses left/right tap directions while keeping every river rule unchanged. The mutated careful tap policy reaches dawn 0/200 times. The directional contract also fails; the good policy cannot conceal a reversed control.

The initial full shared-kit run exited **1**: Chromium navigation timed out on `lab/lantern-3d` and `hint ant-promotion`. Its other scenarios completed, including all WebKit scenarios. No kit or sibling page was edited. The post-change focused command `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/kit/check/phone.mjs kit` passed on both engines (**exit 0**). The new page has its own phone check below. The shared kit's registry was not extended because this brief expressly forbids changes outside this directory.

The phone harness serves the entire `experiments/` directory and stubs only the notes-button script and named board endpoint. Initial controls use native browser touchscreen taps, native mouse holds, and keyboard input. The complete night uses touch `PointerEvent` down/up pairs through the canvas handlers once per animation frame, up to sixteen taps per frame to converge on the careful policy's target. It reads simulation state but never writes it. This follows the Fix-It model's event scheduling. It is **not** a complete night of native touchscreen input. The two-times clock reduces wall time without changing rules. Seed 36 was chosen after a Node reference check reached dawn with the same burst policy at every fixed observation cadence from 1 to 15 ticks. A preliminary three-tap burst cap failed at cadence 10 and in a heavily loaded Chromium run; the final integration policy converges the target with up to sixteen handler-delivered taps while the original boat-speed limit still controls motion. It is deliberately an upper-bound integration policy.

The targeted board-failure check passed both engines: it holds an authorized automatic score response, requests Stop, asserts removal has not overtaken the score, then releases the response and observes score followed by removal. Another test returns 404 for removal, reloads, verifies no automatic retry, taps Retry removal, and verifies the same ID is removed and the pending flag cleared. Each profile produced one expected browser 404 diagnostic and zero application/page errors during this deliberate fault.

Final command (2026-11-24): `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/lantern-fp/check.mjs` — **exit 0**.

| Profile | Natural dawn | Handler-delivered taps | Largest one-frame burst | Page / application / normal-console errors |
| --- | --- | ---: | ---: | ---: |
| WebKit, iPhone 13 | yes | 252 | 10 | 0 |
| Chromium, Pixel 7 | yes | 210 | 9 | 0 |

Both profiles pass native left/right touchscreen input, held-repeat, a press moving across halves without becoming drag steering, arrow keys, tap hint, pause freezing time, blur pause, resume, persistent save, opt-in-only board writes, Stop/remove ordering, failed-removal retry after reload, and WebGL2 returning null or throwing during initialization. Chromium also passes 360×640 and 1280×800 layouts. Visible controls have 48 px targets. Test-owned browsers close when the script ends.

Deliberate network faults are reported separately from application errors: each engine emits one expected browser diagnostic for the injected board GET 404 and one for the failed removal 404; offline transport emits zero on WebKit and one on Chromium. Neither fault produces a page/application error. These diagnostics are not claimed to be zero console errors.

Screenshots are in `/private/tmp/night-lantern-fp/`: `<engine>-1-menu.png`, `-2-mid-play.png`, `-3-end.png`, `-4-no-webgl2.png`, `-5-webgl-init-throw.png`, plus `chromium-360.png` and `chromium-desktop.png`. The final menu/play/end/fallback captures on both engines and both extra layouts were visually inspected. Earlier `*-FAIL.png` captures are retained as diagnostics from the harness iterations described here.

Harness lesson: hold assertions use the observed control counter (initial press plus at least one repeat), not a 270 ms wall-clock sleep. Under software-WebGL load, browser input delivery and the capped render delta can consume or delay that interval. Native buttons are tapped at their measured DOM centres; full-night steering is scheduled inside the browser to separate protocol latency from the policy's reaction time. Earlier failing harness attempts are not evidence of human play failure. Screenshot capture waits two animation-frame commits and retries at most three times only for the browser protocol error "Unable to capture screenshot"; any other error still fails immediately. Chromium ran through the software SwiftShader backend on this Mac, so these runs do not measure physical-phone graphics performance.

## Verification limits

- No live board integration or deployment was attempted. The board browser checks use a local response fixture and injected failures. Client request ordering cannot establish the final server state if an earlier upload timed out while still being processed remotely; the endpoint has no version or tombstone field in the supplied API.
- No person played this page. Emulated phone profiles do not establish real-phone frame rate, thumb comfort, safe-area behavior, or audible sound. Audio uses the kit's iPhone unlock wiring; it has not been heard on an actual iPhone.
- Rule bots read simulation hazards inside `sight()`, including hazards outside the first-person camera frustum. Their results establish the input adapter's capability, not human hazard visibility or first-person difficulty equivalence.
- The renderer is adapted code rather than a new rendering library. Existing and new views can diverge after future renderer fixes; the simulation import remains shared.
- Offline means a loaded page and a working local save without the board. This directory adds no service worker or offline installation.

## Decisions and open ideas

- Took persistent target steps, with delayed hold-repeat, instead of inventing lanes. This preserves the original continuous river geometry and collisions.
- Kept camera yaw straight downriver, following lateral boat movement. A camera that anticipates bends is a future look variant; it could change what hazards a person sees.
- Used a single marine/amber look and the requested 2D / 3D / First person links. The existing two views remain separate pages.
- Kept all original nights and no upgrades. The complete-run phone check covers night 1; later-night visibility still needs playtesting.
- A frustum-aware bot and measured real-phone holds would give stronger evidence than a policy reading raw world state. Open; no claim that bot success proves fun or readability.

## Independent review

Two delegated lenses reviewed renderer/input/state correctness and phone/failure/recovery coverage. Two material verification findings were fixed: the rule check now proves natural dawn reachability for every offered night, and the mid-play capture is unobstructed instead of showing the pause card. The end-card animation now translates rather than shrinking its touch targets. A later failure/recovery review also found a race between an automatic score upload and Stop sharing. POST ordering and consent checks now prevent queued stale uploads, and failed removal keeps the ID with an explicit retry instead of discarding it. No material renderer or input-lifecycle defect remained in static review. Reviewers could not establish human hazard visibility from the bots, so that remains an explicit limit.

## Review fixes (2026-11-24)

- Overlapping thumbs: the newest press wins and lifting the older thumb does nothing (previously the second thumb was ignored). Checked in `check.mjs`.
- End title names the cause: Run aground (bank), Wrecked (hazard), Light lost (dark).
