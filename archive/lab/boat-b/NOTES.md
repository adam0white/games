# Paper Boat

Built 2026-11-24. Lab variant B at `/lab/boat-b/`. Everything for this entry is in this directory. No telemetry, shared board, dependencies, build step, external art or fonts. No commits or deployment were made.

## Acceptance and decisions

Done for this build means a playable six-street journey, deterministic rule checks, a detected rule mutation, two successful phone-profile checks, and inspected menu/play/end screenshots. The owner accepts the game's taste and readiness after playing it. Human acceptance is still open.

- Use transient local currents, not a boat-position target. A swipe changes nearby water; the hull follows that water with inertia. A tap drops a pebble with an outward impulse. Both lateral and longitudinal water velocity affect the boat.
- Use a warm paper boat against teal rainwater, with canvas streamlines sampled from the same field as the rules. The boat and its passengers stay above the thumb's working area. No external assets.
- Six hand-ordered streets introduce passengers, leaves, drains, the cat's paw, faster water, then the combined course. Seeds make small changes to obstacle placement. The page uses seed 7; the bots exercise 240 seeds.
- Each street supplies a fresh boat. Paper soaks over time and on contact with a hazard. At 100% soak the boat sinks. Reaching the street's end before that wins. The next street waits behind one button.
- A street awards one star for arrival, one for both passengers, and one for no collision. Stars persist independently for all six streets. A journey lasts about 124 seconds of careful play, excluding cards and retries.
- Score is 100 for arrival, 100 per passenger, remaining dry paper rounded to an integer, and 50 per star. Best stores the highest journey total. Retrying a street replaces that street's journey score; it cannot repeatedly add the same street's score.

## Controls and wiring

Drag anywhere near the boat to draw a short ripple. Ripples expire after 0.8 seconds and affect a radius of 30 world units. Taps create a radial pebble current for one second within 34 units. A distant gesture visibly disturbs water but does not move the hull. There is no direct steering or teleportation.

Mouse dragging and clicking use the same pointer handlers. Hold Left/Right or A/D to make horizontal ripples; Space drops a pebble to the left of the hull. P or Escape pauses and resumes. Pointer cancellation and leaving the page clear input. Pausing freezes rules and visual animation and suspends audio.

The page uses kit `save.js`, `audio.js`, `pause.js`, `screens.js`, `zoom.js`, and `hint.js`. The beginner hint is `kind: path`, delayed 1.8 seconds during active play only. Its key is `boat-b:hint`; prior completed runs suppress it. All sound is synthesized through `sound()`. `/notes/button.js` is loaded as the model pages load it. This is a lab page, so it does not import `lab.js`.

Storage contract:

- `boat-b-save`: `{v:1,best:number,stars:[six numbers 0..3],runs:number,sound:boolean}`.
- `boat-b:hint`: the kit's first-input marker.

`window.boatState()` returns a detached snapshot for browser assertions. It has no mutation or fast-forward interface.

## Rule evidence

Run `node experiments/lab/boat-b/bots.mjs`. Final normal run exits 0.

| Street | Careful wins | Clumsy wins | Clumsy success | Careful seconds |
| --- | --- | --- | --- | --- |
| First rain | 240/240 | 240/240 | 100% | 18.02 |
| Leaf lane | 240/240 | 209/240 | 87.1% | 19.02 |
| Open drains | 240/240 | 185/240 | 77.1% | 20.27–20.30 |
| Cat crossing | 240/240 | 95/240 | 39.6% | 21.23–21.27 |
| Heavy rain | 240/240 | 44/240 | 18.3% | 22.17–22.20 |
| The pond | 240/240 | 0/240 | 0% | 23.07–23.08 |

All 1,440 careful runs collect both passengers, avoid every collision, and receive three stars. The clumsy policy is unchanged between streets: noisy targets (±25 units) and reactions every 0.8–2.1 seconds. The careful policy reacts every 0.13 seconds. Both operate through the public ripple API and use only approaching obstacles and passengers. They share the reference route heuristic; these numbers measure mechanical difficulty, not human comprehension or fun. The page never uses the heuristic to steer.

Additional assertions cover a byte-identical 900-frame replay with identical seed and inputs, seed variation, current locality and expiry, outward pebble force, actual hull response, vertical current affecting distance, each hazard's contact damage exactly once, passenger collection exactly once, soaking failure, and terminal-state immutability. Controlled fixtures set up contacts independently of the route heuristic.

Run `node experiments/lab/boat-b/bots.mjs --mutate`. It deliberately replaces the ripple input with a no-op, while keeping all the original assertions. Final mutation run exits 1 with **17 failed assertions**. The first street can be survived without steering, so the browser checks also independently assert directional movement; winning street 1 alone would not establish working input.

## Browser checks

Command: `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/boat-b/check.mjs`.

The check serves `experiments/` itself. It loads actual kit modules and stubs the separately hosted notes script. It aborts unexpected external requests and fails on page errors, console errors, failed requests, or HTTP errors. It uses normal simulation time and no state setters.

Final default check exits **0**:

| Profile | Result | Errors |
| --- | --- | --- |
| WebKit iPhone 13 | Street 1 won; 518 points | 0 page / 0 console / 0 failed requests |
| Chromium Pixel 7 | Street 1 won; 519 points | 0 page / 0 console / 0 failed requests |
| Chromium 360 × 640 | Layout, keyboard, pause and 48px targets pass | 0 |
| Chromium 1280 × 800 | Layout, keyboard, pause and 48px targets pass | 0 |

Both phone runs check left/right hull displacement from trusted mouse swipes, outward hull movement after a real touchscreen pebble tap, and a synthetic touch PointerEvent drag. They then restart and complete street 1 at normal speed. They verify the paper meter, blur/pause freezing, resume, one-tap retry, saved stars/best/sound across reload, and no external requests. The full runs use mouse pointers on touch-capable device profiles; the supplemental drag uses synthetic touch events. This is not physical-touch validation.

Menu, mid-play, and end screenshots from both engines, plus 360 × 640 and desktop screenshots, are under `/private/tmp/night-boat-b/`. The builder inspected the final images; the meter is visibly nonempty and tracks soak, the cards fit, and controls are readable.

The required shared kit baseline was also run. It exits 1 on two pre-existing Chromium checks for `lab/lantern-3d`: the game script needs WebGL2, and its hint check then cannot find Play. All other baseline cases passed. This directory does not alter that page or the kit. The post-change shared run also exits 1: `lab/lantern-3d` again times out waiting for its WebGL2 game script, and `hint lab/lantern-3d` fails its before-delay timing assertion. All other cases pass. These are failures in an untouched sibling page; they were not bypassed or changed.

The optional full browser journey also passes:

`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/boat-b/check.mjs --journey`

Chromium plays all six streets through actual pointer input and Next buttons. It saves **18/18 stars**, delivers **12 passengers**, takes **zero hits**, and records best **2992**, with **zero page, console, HTTP or request errors**. Street travel times are 17.73, 18.77, 19.77, 20.85, 21.62 and 22.45 seconds: **121.19 seconds total**. The browser's stroke timing includes small forward components, so its travel times differ from the purely horizontal Node controller. Screenshots `journey-street-3.png`, `journey-street-4.png`, and `journey-street-6-end.png` were inspected.

The first full-browser controller used seven pointer samples per swipe and a 110 ms wait. It cleared streets 1–4, then lost street 5 at 12.42 seconds with two hits. A rapid short-stroke controller using one pointer move and a 70 ms wait clears all six. No game rules or win assertions were relaxed. This exposes a real timing/strength limit of the harder streets. Slow drags and quick strokes do not produce identical fields because ripples are created along the pointer path; future human testing should assess whether that difference feels fair. A separate test race was fixed by ceasing pointer actions during the win celebration and asserting each end card's street number.

## Review fixes

- The initial dry-paper display used a 0–1 value while the rules use 0–100. The meter and wet-paper shading now use the correct units; the phone check compares the rendered meter with remaining paper.
- Rescue feedback now responds to the rules' `rescue` event.
- Hazard artwork is flattened to match its shallow collision band.
- Repeated street retries no longer inflate a journey's score.
- A queued animation frame could have a timestamp slightly earlier than a new run's timestamp. Negative frame time caused negative rain-ring radii in Chromium. Frame delta is now bounded to 0–0.08 seconds.
- Review found that forward flow was drawn but ignored by movement. Both components now move the hull, and progress measures distance. An opposite-vertical-stroke assertion guards that behavior.
- Streamlines now integrate both coordinates in the same time direction.
- Review found that street 1's forgiving layout could hide ineffective input in the browser test. Separate directional movement assertions now check the pointer-to-current-to-hull path.

## Not verified and open ideas

- No person has played this build. A stranger finishing without reading remains a human acceptance check; the first street is 18 seconds and the clumsy bot finishes it on all tested seeds.
- Emulated devices are not physical phones. Real iPhone audio, silent-switch behavior, thumb occlusion, notched safe areas, sustained performance, and perceived feel remain unverified.
- The notes script is a local-test stub. Its hosted integration was not tested. Nothing was deployed.
- A human may find the last street too demanding. The clumsy bot's zero success is deliberate evidence of a steep final challenge, not proof that it is enjoyable.
- The cat paw is a fixed obstacle, not an animated timed attack. The flow field is a local impulse model, not a fluid solver. No fluid simulation library is used.
- Possible next variants: slower water with longer-lived drawn currents, or fewer but stronger pebble impulses. These are ideas, not accepted changes.
- The shared phone-check registry was not edited because the build brief permits writes only inside this directory. The coordinator can add this lab page when collecting tonight's entries.
- The brain-consult skill's decision log was absent at `~/code/brain/promoted/index.md`; no historical finding was substituted for current evidence.

## Independent review — 2026-11-24

Reviewed the rule engine, page state, input, pause, retry, save and rendering loops. The fixed-step accumulator is bounded by the 0.08-second frame cap. Current impulses expire and the simulation caps them at 70. Gesture trails cap at 18 points. Particles and visual rings expire. Page input supplies finite coordinates and rule input rejects non-finite values. No additional timer, unbounded-loop or reachable NaN defect was found.

Fixed three related interrupted-input and retry defects:

- A second touch's `lostpointercapture` cleared the first touch. The handler now checks the pointer id. The independent pre-fix Chromium regression failed with 1 ripple where 2 were expected.
- Pause and Menu cleared the pointer but retained its drawn trail. Both now clear the trail. The regression asserts a null pointer and zero trail points while paused, then verifies that the old pointer cannot resume a drag.
- Restart retained the previous rescue toast, shake, wobble and keyboard cadence. A new run now clears that feedback and resets the cadence. The regression starts a fresh run during visible rescue feedback and checks the new clock is exactly 0 and the old toast text is empty before another simulation step.

`review.mjs` serves the actual experiments folder and performs a first-play pass without importing the reference controller. It captures menu, delayed gesture hint, play, pause, end, retry and reload. It checks two-finger interruption, pause/resume, retry and reload. Set `PLAYWRIGHT` to the installed test dependency directory. Commands use `fnm exec --using=26.12.0 node`.

The screenshots in `review-shots/` and `check-shots/` stay inside this folder. The existing check's screenshot destination changed for that reason; no gameplay, pass threshold or assertion was relaxed. An early toast assertion was corrected to inspect restart synchronously: checking it after several browser round trips could already observe the new run's first passenger rescue.

Current completed evidence:

- `bots.mjs`: exit 0. All 1,440 careful runs won with 3 stars and 0 hits. Clumsy wins across the six streets remain 240, 209, 185, 95, 44 and 0 out of 240 each. Deterministic replay covers 900 frames.
- `bots.mjs --mutate`: exit 1, with 17 failed assertions after ripple input is disabled. Rules and bot thresholds did not change.
- `check.mjs chromium`: exit 0. Pixel 7 completed street 1 with best 519. Pixel 7, 360 × 640 and 1280 × 800 checks reported 0 errors. Layout, 48px targets, input, pause/blur, restart and reload assertions passed.
- The initial successful independent Pixel 7 run reached street 1's end in 17.77 simulated seconds, with 296 points, 1 passenger and 1 hit. This used a few visible-water swipes and then waited; it did not use the builder's route heuristic.

Visual inspection of the Pixel 7 menu, hint, play, pause, end, retry and reload images found no clipped text, overlapping controls or off-screen buttons. The entry screen has one Play button and one short subtitle. The moving gesture hint demonstrates a swipe before instruction text is needed. The passenger and hazard silhouettes differ clearly. Foreground text remains legible over the gutter. These observations are evidence about the inspected viewport, not a physical phone's notch or thumb coverage.

The first WebKit attempt returned a completely black screenshot, then timed out while waiting for the visible Play button to become stable. It did not pass. Other concurrently tested pages showed the same symptom; the host-level explanation remains unconfirmed. The successful follow-up is recorded below. The hosted notes script is stubbed by both local checks. Physical multitouch, actual iPhone safe areas/audio, hosted notes and production deployment remain unverified.

The final `review.mjs chromium` run exits 0. Its two-contact CDP sequence keeps the first finger down while the second finger lifts, then verifies the first finger still creates another ripple. The final first-play result is **446 points, 2 passengers, 1 hit, 17.77 simulated seconds**, with **0 page or console errors**. Synthetic capture-loss and pause-trail assertions also pass. The CDP probe initially used the wrong `touchEnd` contact list; its event trace showed it released the first touch. Correcting that probe established the second-finger result without any further game change. The scripted two-contact result is browser emulation, not physical multitouch validation.

### WebKit follow-up — 2026-11-24

`check.mjs webkit` exits **0**: iPhone 13 completes street 1 with **518 points** and **0 page, console, HTTP or request errors**. Its mid-play and end screenshots are rendered and inspected. Its immediate menu screenshot was black, so that image alone is not visual acceptance.

The independent checker now foregrounds its page and requires **2 actual animation frames** before initial capture. Frame readiness has a **10,000 ms** assertion, and the independent check also bounds foregrounding at **10,000 ms**. These are readiness checks, not changes to game or gameplay thresholds. Two attempts stalled before their first new screenshot and were interrupted; their exact blocked browser operation was not established. During those attempts, host load averages were **189.13 / 243.35 / 219.79**, and other WebKit processes were active outside this review. Those observations do not establish the cause of the stall. Only this review's processes were interrupted.

The final `review.mjs webkit` retry exits **0**. It records **296 points, 1 passenger, 1 hit and 17.93 simulated seconds**, with **0 page or console errors**. The menu, hint, play, pause, end, retry and reload screenshots in `review-shots/` all render correctly and were inspected. The menu requires no rules paragraph; the controls and cards fit, text is readable, and no overlapping controls were found. Synthetic second-finger capture-loss, pause/resume, cleared trails, retry feedback reset and reload assertions pass. WebKit's two-contact check uses synthetic pointer events; Chromium additionally passes its native CDP two-contact sequence.

Both requested phone profiles now have successful functional checks and independently inspected first-play screenshots. No additional game changes were needed for WebKit. Physical phones, actual notch safe areas/audio, hosted notes and deployment remain unverified.
