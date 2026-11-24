# Hold Your Breath

Built 2026-11-23. An experiment at `/breath/`. All new files are inside `experiments/breath/`. No archived source was copied. The source idea was read in `archive/README.md`, “Smoke on the Stairs” under “Ideas worth reusing”.

## Acceptance and ownership

The requested result is one playable phone game with twelve levels, a daily tower, deterministic pure rules, bot evidence, and two phone checks. The owner accepts the play verdict. Automated checks establish rules and browser behavior; no human play verdict has been obtained.

The initial build had flat clumsy completion rates at levels 1–3 and 9–12. See the 2026-11-24 entry for the revised rules and results.

## Rules and controls

Hold anywhere on the building to run. Release to stop and crouch. Space, Up, Right, or W also run. P or Escape pauses. The pause button, focus loss, page hide, and switching away stop the simulation and silence the kit audio. Resume clears the held input. A captured pointer can release at another position without leaving movement stuck on.

Each floor has one corridor. Stairs alternate ends. The route climbs through every corridor to the top and retraces it to the street. Three mint door recesses on each floor, plus the stairs, provide clean air. Everything outside those pockets is exposed to that floor's wave. Crouching reduces smoke consumption to 46%; clear air restores 18 breath per second. A floor clock and a rising synthesized hum warn of a wave. Later floors show two concentric clocks for rhythms with a 1:1.53 period ratio.

People join when reached. Each has independent breath. While moving, cumulative route gaps are .045 for a neighbour, .10 for an elder, .085 for a child, and .035 for a cat. Releasing in shelter compacts gaps to .012 per follower. Followers wait for their target to advance; they never move backwards when the line spreads. A sheltered leader does not protect an exposed tail. Zero breath for the firefighter or a joined follower ends the run. There is no graphic injury.

Twelve hand-tuned parameter rows control floor count, neighbour count, period, smoke duty and breath drain. The seed sets clock offsets. Level 4 introduces a permanently smoky second floor; door pockets remain safe there. Level 6 adds the second rhythm. Level 9 adds a neighbour who waits for a clear corridor. Level 11 adds the cat. The first three levels have three floors; levels 4–8 have four; levels 9–12 have five. A level ends after every neighbour reaches the street. A four-minute deadline prevents a numbered level from lasting indefinitely.

Stars: one for everybody out, one for keeping the whole group's lowest breath at least 35, and one for finishing within 38 seconds per floor. Better stars replace the previous result. Winning opens the next level. One tap restarts from the end or pause card.

The daily tower repeats five-floor rescues with increasingly dense smoke. It is deliberately endless and can exceed four minutes. Each completed building awards 1,000 points plus five times that building's minimum breath. A failed or deliberately ended attempt also counts partial rescue/progress points. The best is saved at street returns, pause/leave, restart, and failure. Its UTC date is read when a run starts and retained for that run; leaving a tab open over midnight does not preserve yesterday's seed for a new run. Everybody starting on the same UTC date gets the same seed. The seed hash is the FNV-style hash of `breath:YYYY-MM-DD`. Normal levels use `1700 + 97 * level`, or `?seed=<number>`.

## Page and kit

`index.html` contains the cards and CSS. `main.js` draws every asset in canvas, handles input and effects, and connects the kit. `sim.js` contains rules and the seeded RNG and can run in Node. It has no wall-clock or unseeded random calls. `bots.mjs` exercises it. No build step or runtime npm dependency is needed.

Kit modules: save, audio, pause, zoom, screens, lab. The local hold-and-release hint retains the `breath:hint` key and counts idle time only in uncovered play. A completed saved run also suppresses the idle hint. The recording notice is on the first card; the recording switch is on pause. `/notes/button.js` is loaded as in the reference experiments. Lab calls include start, hold/release, joins, turns, rescues, and the final outcome.

New device save contract: `breath-save`, JSON `{v:1, stars:{level:0..3}, opened:1..12, best:number, daily:{UTC-date:score}, runs:number, sound:boolean, look:'night'|'ember'|'paper'}`. Only the newest thirty daily scores are retained. Stored stars are restricted to numbered levels and clamped before rendering. The kit owns its existing shared recording keys; none were changed.

## Visual and design decisions

- Default: Midnight. Mint means shelter; amber marks the firefighter and held control. Neighbours have different silhouettes and colours. Ember and Blueprint are selectable alternatives in pause, so the owner can choose a palette without another build.
- The camera stops at the roof. It does not leave a large empty area above the top corridor.
- Particles and squash accompany input; footsteps and shelter changes have small synthesized tones; smoke exposure earns shake. A rescue has confetti and a four-note ascent. Reduced motion disables shake and walking bounce.
- The title card has one large Play button and one short control line before the required lab notice. The level picker and daily tower appear after a completed run. Controls are at least 48px; UI text is at least 14px. Safe-area insets are used for cards, pause, HUD and the bottom control.
- No art, font, music, account, paid service, or external asset was added.

## Bot evidence from the initial build (2026-11-23)

Run with pinned Node v26.12.0:

```sh
node experiments/breath/bots.mjs
node experiments/breath/bots.mjs --mutate
```

The normal suite exits 0. Each numbered level uses seeds 1–32. The careful bot reads the deterministic clocks, forecasts each follower's exposure, and uses only hold/release. The clumsy bot reacts every 1.8–4 seconds, reads current smoke rather than forecasting, and makes seeded random mistakes. The same policy is used at every level.

| Level | Careful wins /32 | Clumsy wins /32 | Careful mean seconds | Lowest group breath across careful runs |
|---|---:|---:|---:|---:|
| 1 | 32 | 32 | 60.1 | 72.9 |
| 2 | 32 | 32 | 65.3 | 54.3 |
| 3 | 32 | 32 | 67.7 | 43.3 |
| 4 | 32 | 9 | 97.7 | 38.2 |
| 5 | 32 | 9 | 102.8 | 33.9 |
| 6 | 32 | 7 | 109.7 | 29.7 |
| 7 | 32 | 3 | 113.2 | 25.6 |
| 8 | 32 | 1 | 117.9 | 26.3 |
| 9 | 32 | 0 | 162.6 | 25.4 |
| 10 | 32 | 0 | 180.6 | 25.8 |
| 11 | 32 | 0 | 187.5 | 25.7 |
| 12 | 32 | 0 | 193.1 | 25.7 |

Total: 384/384 careful wins. Clumsy three-level blocks: 96, 25, 4, 0 wins out of 96. A separate rules-agent robustness run over seeds 33–64 also won 384/384; its longest run was 198.13 seconds. The checked daily bot rescued ten floors over 420 seconds without failure.

Independent invariants:

- Identical seed and input policy reproduce the entire state; different seeds change clocks.
- A stationary doorway prevents breath loss during thick smoke.
- A sheltered leader can have an exposed follower who loses breath.
- 2,400 mixed hold/release steps never move a follower backwards.
- Replacing an elder/child line with ordinary neighbours on the same exposure trace changes tail lag by .085 route units and tail breath by 27.6. Kind changes the actual risk.

**Mutation:** `--mutate` switches off the real `safe()` protection for stairs and doorways. The same one-second thick-smoke doorway invariant then loses breath. The run prints `FAIL a stationary doorway protects breath through thick smoke` and exits 1. There is no unconditional forced failure.

## Browser evidence

```sh
PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/breath/check.mjs
PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/kit/check/phone.mjs kit
```

`check.mjs` serves `experiments/` itself on an ephemeral loopback port. It plays an unshortened level with real Playwright browser pointer presses/releases on WebKit iPhone 13 and Chromium Pixel 7. A separate synthetic touch sequence checks the touch branch. The advisor chooses only the next input; it does not change progress, breath, rules, time or outcomes. The diagnostic snapshot has no policy side effects. The separate advisor retains its own policy target fields in the run state.

Both engines have passed: full rescue, three stars, zero page errors, zero console errors, and zero failed requests/HTTP errors. The check also verifies stop on release, capture release at a different coordinate, pause freezing time, blur/pagehide pause, keyboard play, persistent stars/unlock, daily seed on restart, daily best on restart, sound persistence, all visible button bounds, 360×640 and 1280×800. Final run numbers are recorded below after the last pass.

Screenshots are saved and visually inspected at `/private/tmp/night-breath/`: `<engine>-menu.png`, `<engine>-mid-play.png`, `<engine>-end.png`, and 360px menu/play/pause variants. The shared kit self-check passed both engines before and after page work. Its registry was not edited, as this task prohibits writing outside `breath/`.

## Independent review and fixes

Two read-only review agents examined rules and UI/integration separately. Verified findings were fixed: compact followers could move backwards on restarting; slow kinds did not meaningfully lengthen the line; daily Menu/Restart could lose the best; daily date could become stale; snapshot reads called the bot; and the initial browser test used only dispatched events. The fixes have targeted invariants or browser checks. The palette and compact phone screenshots were inspected. Remaining review findings are the limits below.

## Not verified and open ideas

- **Real phone audio and feel.** Headless profiles do not establish audible sound on a physical iPhone, its silent switch behavior, physical thumb comfort, or fun. The kit's audio unlock remains unchanged. No ten-minute owner play verdict or outsider readiness acceptance is claimed.
- **Live lab storage.** The kit is wired, and the phone check captures compressed agent-marked records through a mocked endpoint. The new `breath` slug still needs registration in the human-framework `LAB_PROTOTYPES` list before live storage accepts it. That is outside this directory and was not changed. No live accepted recording is claimed.
- **Notes host.** The production notes script tag is present. The local check stubs that script, as Fix-It does. The deployed feedback UI was not exercised.
- **Deployment.** No git, gh, Wrangler, commits, publication, or root/shared file changes were performed. Only this directory is delivered. No production state is claimed.
- **Human difficulty progression.** The bot curve measures the fixed test policy. Human difficulty progression remains unverified.
- **Daily length.** The daily is endless, while numbered levels stay in the requested 1–4 minute range. A bounded three-minute daily would be a distinct design choice.
- **Open visual choice.** Midnight is the default; Ember and Blueprint remain available for the owner to choose in pause.

Initial page runs after the 2026-11-23 review fixes:

| Profile | Level 1 time | Rescued | Stars | Holds / releases | Page / console errors |
|---|---:|---:|---:|---:|---:|
| WebKit iPhone 13 | 65.4s | 1/1 | 3 | 18 / 18 | 0 / 0 |
| Chromium Pixel 7 | 63.3s | 1/1 | 3 | 18 / 18 | 0 / 0 |

Operational lesson: on this shared machine, a fixed 900ms wait did not always advance enough animation frames. The input check now waits for observed forward movement with a 15-second timeout, then checks the same distance assertion. It still fails if holding never moves the player. An earlier stop assertion also needed to take its reference snapshot after dispatching release, rather than before release. Neither correction changed game rules. The final bot suite exits 0; the final mutation exits 1 as expected. The final screenshots on both engines were opened and inspected.

## 2026-11-24 — Opening waves and landscape

Level 1 starts a wave as the firefighter enters the first floor's middle shelter. Level 2 repeats it on the return with the group. Each wave gives 1.4 seconds of warning, then lasts 8.5 seconds. In strong smoke, running outside a shelter drops to 24% of normal speed. The mint strip shows the full safe width, and the in-world hand lifts while the player holds near the wave. Letting go crouches as before. Continuous hold drains breath on floor 1 and leads to the existing retry card.

The local idle hint holds one contact point for 1.28 seconds before lifting straight up. Reduced motion shows both poses together. The notification row sits above the clipped building view. In short landscape the viewport fits two complete floors at the street and three at the roof on the two phone profiles. Rotation resets the camera to the player's current position. The compact result card puts the retry button beside the summary so the player can reach it without scrolling.

Each opening-level policy ran on seeds 1–32, the shipped seed, and seed 1801, with first-press delays of 0, 3.4 and 12 seconds. Times are measured from the first press.

| Level | Continuous-hold losses on floor 1 | Latest loss | Three-star wins releasing at warning | Three-star wins releasing when smoke starts |
|---:|---:|---:|---:|---:|
| 1 | 102/102 | 14.03 s | 102/102 by 64.97 s, one release | 102/102 by 63.53 s, one release |
| 2 | 102/102 | 13.90 s | 102/102 by 75.53 s, two releases | 102/102 by 72.70 s, two releases |

Levels 3–11 use revised smoke duty and drain values. The clumsy policy stays the same. The strict per-level check extends the previous nonincreasing check to catch any tie. The existing 75% floor for level 1, three-level block check, and timing and mutation checks still apply.

| Level | Clumsy wins, seeds 1–32 | Clumsy wins, seeds 33–64 | Careful mean seconds, seeds 1–32 | Lowest careful breath, seeds 1–32 |
|---:|---:|---:|---:|---:|
| 1 | 30 | 28 | 68.9 | 72.9 |
| 2 | 25 | 23 | 82.3 | 54.5 |
| 3 | 23 | 21 | 80.3 | 26.3 |
| 4 | 19 | 19 | 92.3 | 51.6 |
| 5 | 16 | 15 | 99.0 | 47.9 |
| 6 | 13 | 13 | 101.3 | 42.1 |
| 7 | 10 | 11 | 104.4 | 42.1 |
| 8 | 8 | 10 | 105.0 | 36.6 |
| 9 | 6 | 8 | 140.1 | 29.7 |
| 10 | 4 | 6 | 147.9 | 26.8 |
| 11 | 2 | 3 | 161.1 | 25.9 |
| 12 | 0 | 0 | 193.1 | 25.7 |

Careful won 768/768 across both seed ranges. Daily rescued 10 floors in 420.0 seconds in the checked run. The normal suite exited 0. The doorway protection mutation failed its invariant and exited 1.

| Profile | Level 1 time | Rescued | Stars | Holds / releases | Full landscape floors at entry / roof / 568×320 entry |
|---|---:|---:|---:|---:|---:|
| WebKit iPhone 13 | 72.8 s | 1/1 | 3 | 18 / 18 | 2 / 3 / 2 |
| Chromium Pixel 7 | 72.8 s | 1/1 | 3 | 18 / 18 | 2 / 3 / 2 |

Both browser runs recorded zero page, console, request and HTTP errors. Both kept the toast above the building and fit all result actions at 568×320. Separate continuous pointer holds reached the loss card at 14.07 and 14.03 seconds of simulation time respectively, and both retried from the visible primary action. The reduced-motion hint stayed still across samples 550 ms apart. The shared kit check passed on both engines. Screenshots of the hint, play, result and landscape states were inspected in `/private/tmp/night-breath/`. Physical-device play, whether a first-time player reads the cue without text, and live lab storage remain unverified.

## 2026-11-24 — Phone play review

- The landscape introduction clipped the required recording notice. Before the change, the cards needed 406 CSS px of vertical space on both phone profiles, against viewports of 342 px and 360 px. The pause screen needed 501 px and 502 px. Three palette buttons and the recording switch started below the viewport. The introduction and pause cards now use two columns in short landscape. The numbered picker uses six columns. The regression checks that the complete first-run card fits the phone viewport and that the return menu, pause and level picker fit 568×320.
- Holding the pause key generated a second keydown and resumed play in both browsers. A repeated pause key now leaves the current screen alone. The browser check sends two consecutive keydowns and verifies that the game stays paused.
- The prompt said release would shelter the firefighter even between doorways. It now says to crouch outside a pocket and to breathe inside one. The intro names the rescue goal and the mint doorways. The return HUD counts rescues at the street. Previously it showed 1/1 on the roof after the first follower joined. The check reads the rendered prompt in both locations and the rendered 0/1 return count before the first rescue.
- Two campaign runs timed out with positive breath and showed the breath-loss result. The numbered campaign now displays a countdown from 4:00 and identifies a timeout separately. The loss card has one retry action. The browser check distinguishes a live continuous-hold loss from a 240-second idle timeout and verifies an immediate retry at the street.
- The first-run canvas-only hint timed out in the registered kit check. The hint now uses the kit's existing delay, dismissal, storage and overlay. The local animation holds one contact point for 1.26 seconds before lifting. Reduced motion shows a still target and text. The browser check samples two contact positions 1,000 ms apart and the lifted position, then checks reduced motion and removal on input. The first-floor warning still shows the in-world lift cue.

Both first-run contexts used the shipped seed and real browser input. Chromium used native touchscreen taps and dispatched native touch holds and drags through the browser protocol. WebKit used native touchscreen taps and browser pointer holds and drags. Lift ended the drag at progress 0.2651 on Chromium and 0.2509 on WebKit. Leaving through navigation and returning reloaded the menu on both profiles. A further mid-level reload returned to the menu at progress 0. The clean first continuous holds failed at 17.30 s on Chromium and 18.03 s on WebKit, including the initial idle hint. Both retried from the visible result action.

| Profile | Campaign finish in normal time | Later finish with 3.5× browser frame timing | First timer loss |
|---|---|---|---|
| Chromium Pixel 7 | Level 1 in 69.30 s, 3 stars. Level 2 in 84.83 s, 3 stars. | — | Level 3 at 240.03 s, lowest breath 26% |
| WebKit iPhone 13 | Level 1 in 69.40 s, 3 stars. | Level 2 in 89.17 s, 3 stars. Level 3 in 92.50 s, 2 stars. | Level 4 at 240.03 s, lowest breath 68% |

The browser input driver chose later holds and lifts from the existing page advisor. It did not grant progress, breath or results. The late trials used 3.5× frame timing. Those losses establish that a timeout can occur with breath remaining. The input driver can miss its intended stopping point, so the losses do not establish a difficulty verdict. The rules and bot thresholds were left intact.

Screenshots are in `/private/tmp/night-r3-review/breath/`. Inspected both profiles' portrait introduction, idle hint, first wave, loss, return HUD, landscape introduction and landscape pause. The WebKit harness repaints after navigation with a one-pixel viewport nudge and restores the exact profile. It verifies a drawn pixel before interaction. Screenshot capture allows 90 seconds because this host stalled captures at the prior 30-second limit. The game, input and wall-time level completion thresholds are unchanged.

A separate fixed-frame browser replay used the same page advisor, synthetic touch PointerEvents on the canvas, and native Next level taps. It advanced one normal rules step per frame between taps. Both profiles finished all 12 levels and opened the daily tower. The WebKit replay used a 16×16 canvas backing store between captures to reduce raster work and restored the profile's full canvas for screenshots. Results matched across profiles. The level 12 result and daily entry were inspected on both.

| Level | Simulation time | Rescued | Stars |
|---:|---:|---:|---:|
| 1 | 68.47 s | 1/1 | 3 |
| 2 | 83.57 s | 2/2 | 3 |
| 3 | 76.33 s | 2/2 | 2 |
| 4 | 93.63 s | 2/2 | 3 |
| 5 | 98.33 s | 3/3 | 3 |
| 6 | 103.07 s | 3/3 | 3 |
| 7 | 106.73 s | 3/3 | 3 |
| 8 | 104.70 s | 3/3 | 3 |
| 9 | 138.17 s | 4/4 | 2 |
| 10 | 148.03 s | 4/4 | 2 |
| 11 | 152.27 s | 4/4 | 2 |
| 12 | 194.60 s | 5/5 | 1 |

Final `check.mjs` runs used 17 captures per profile. The check played the first rescue at normal speed. Its separate idle-timeout case used a browser clock and did not change the game deadline.

| Profile | Level 1 | Stars | Holds / releases | Continuous-hold loss | Page, console, request and HTTP errors |
|---|---:|---:|---:|---:|---:|
| WebKit iPhone 13 | 81.4 s | 3 | 17 / 17 | 14.20 s | 0 |
| Chromium Pixel 7 | 76.0 s | 3 | 17 / 17 | 14.03 s | 0 |

`bots.mjs` exited 0 with 384/384 careful wins and 32 seeds per level. The clumsy block totals stayed at 78, 48, 24 and 6 out of 96. `bots.mjs --mutate` exited 1 when disabling safe pockets caused actual breath loss. The registered shared play and hint checks passed on both profiles. WebKit needed a separate retry after its first play check stalled waiting for a stable button.

Unverified here: physical phones, audio by ear, late-level timing with a person's thumb, and production lab recording.
