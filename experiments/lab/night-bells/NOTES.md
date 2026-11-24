# Night Bells

Served at `/lab/night-bells/`. A visual rhythm game for one thumb. Eight short levels and endless play. No lab telemetry or network score service.

## Acceptance

The delivery is a static page with seeded pure rules, eight completable levels, an endless device-only best, discriminating bot checks, a failing mutation run, passing WebKit iPhone 13 and Chromium Pixel 7 checks, and inspected screenshots. A stranger's wordless first-level completion in under a minute remains a human acceptance test.

## Rules and controls

Each bell is a damped small-angle pendulum. Its angular frequency is `sqrt(470 / length)`, and its angle is `0.68 * sqrt(max(0.015, energy)) * cos(phase)`. Lengths start near 61, 73 and 88; the seed perturbs each by up to one unit. This is an analytic pendulum approximation, not a nonlinear rigid-body simulation.

Tap a swinging bell or its matching thumb pad near either apex. A bright ring marks the accepted window. A successful tap restores 0.12 energy without resetting phase. A miss removes 0.055 energy. The shared 140 ms cooldown and per-apex lock prevent repeated strikes. Each tick accepts at most one bell. The page ignores secondary pointers. Keyboard: 1–3; Space for the single bell; P or Escape pauses.

Recent successful strikes on every bell during an apex overlap light the village. Different lengths preserve phase drift. Each hit adds one light of level progress. The first level has one bell, no timer or passive damping, and a forgiving timing window. Later levels introduce two then three bells. A level ends after reaching its light target and at least one alignment. Later levels end unsuccessfully if any bell's energy falls below 0.16 or the visible timer expires.

| Level | Bells | Target | Apex half-window | Time limit |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1 | 15 | 340 ms | none |
| 2 | 2 | 22 | 280 ms | 60 s |
| 3 | 2 | 26 | 260 ms | 65 s |
| 4 | 2 | 30 | 240 ms | 65 s |
| 5 | 3 | 34 | 270 ms | 70 s |
| 6 | 3 | 38 | 250 ms | 70 s |
| 7 | 3 | 42 | 230 ms | 75 s |
| 8 | 3 | 46 | 210 ms | 75 s |

Endless starts with three bells. Tempo and damping increase to difficulty 1.70 at 126 seconds; the time window narrows with the square root of difficulty. The score rewards timing precision and alignments. Every new best is saved immediately, including an unfinished run. Nothing is shared.

## Page and shared kit

`index.html` and `main.js` provide the tower, ringer, village, pendulum arcs, squash, glow, sound, controls and cards. The three selectable palettes are Amber, Moon and Rose (`?look=amber`, `moon`, `rose`); they share all rules. Amber is the initial palette. Palette preference persists.

Imports: kit `save.js`, `audio.js`, `pause.js`, `zoom.js`, `screens.js`, `hint.js`, plus the actual `/notes/button.js`. No `lab.js`. The kit owns hint delay, dismissal and storage. The normal-motion demonstration is drawn in the game from the actual accepted beat; the generic kit tap animation is hidden locally because its independent cadence would demonstrate mistakes. Reduced motion retains the kit's still hand and short label. Gameplay remains visual with sound off.

Save contract: `night-bells:save`, `{v:1, stars:[eight integers 0–3], best, sound, tries, look}`. Hint key: `night-bells:hint`. Malformed values are sanitized. Storage errors fall back safely through the kit. No existing key or format is changed.

Read-only `window.bellsState()` returns copied state and drawing geometry. Only `?test=1` exposes `bellsAdvance(seconds)` for browser checks; it executes the actual fixed-step update, never grants hits or wins. Ordinary play uses a 1/120-second fixed simulation step and requestAnimationFrame.

## 2026-11-24 — changes and measured checks

Built this new folder only. No shared registry, kit, deployment or other game files changed. No commits or publication.

Decisions that shaped the game:

- Stationary pads provide thumb reach while the moving bell remains directly tappable.
- Successful impulses preserve phase. Alignments result from different periods rather than resetting all bells together.
- First-level errors remain recoverable. Initial target 15, ±290 ms timing and a two-light miss penalty gave the unchanged delayed-response bot 5/32 wins, taking 33.86–87.71 seconds. Target 15, ±340 ms and a one-light penalty gave 32/32 wins in 16.96–49.78 seconds. Rapid tapping stayed 0/32. The first-level bot acceptance threshold was retained; gameplay changed instead.
- Later misses originally cost two lights and gave the delayed-response bot 0/32 on every later level. Reducing that penalty to 0.5 lights gave the results below. Timing, energy penalties and the bot policy stayed unchanged. One candidate penalty was tested. Added a level-2 transition assertion. No check threshold was lowered.
- Independent review found that the generic help cadence could demonstrate invalid taps and that low-energy apex markers could be unreachable. The help now follows actual readiness; marker amplitude now exactly matches the bell. Review also found that seed metadata could make a weak seed-variation assertion pass: the check now compares actual bell motion. Endless best checks include a completed lower-score run.

### Pure rules

Command: `fnm exec --using=26.12.0 node experiments/lab/night-bells/bots.mjs`.

| Level | Careful / 32 | Delayed response / 32 | Rapid tapping / 32 | Careful time |
| --- | ---: | ---: | ---: | --- |
| 1 | 32 | 32 | 0 | 15.10–15.33 s |
| 2 | 32 | 26 | 0 | 11.91–13.05 s |
| 3 | 32 | 19 | 0 | 15.18–15.42 s |
| 4 | 32 | 1 | 0 | 17.45–17.72 s |
| 5 | 32 | 0 | 0 | 13.28–14.27 s |
| 6 | 32 | 0 | 0 | 15.44–15.65 s |
| 7 | 32 | 0 | 0 | 17.00–17.19 s |
| 8 | 32 | 0 | 0 | 18.63–18.88 s |

Careful uses an independent sine-based timing predicate and at least 150 ms between actions, not the presentation's `ready` flag. Delayed response uses 30–450 ms reaction lag and at least 160 ms between actions. It is a difficulty probe, not a model of a person's learning. Final normal run exited 0 with zero failed assertions. Careful: 256/256 wins, zero misses, 2,195 alignment bursts. The scheduler reached 107,163 fixed steps with multiple bells near apex and kept its minimum 150 ms action interval. Idle and rapid tapping: 0/256 wins each. The 8 independent apex-boundary cases pass. Checked analytic damping, phase-preserving impulses, same-apex lockout, finite malformed-input handling, one-action packets, terminal immutability and seeded replay.

Endless idle fades at 45.25 seconds. Careful survives 180 seconds, score 18,407, difficulty 1.70 and ±161 ms timing at level-8 settings. The regular endless button uses the level-1 base timing window.

Mutation command adds `--mutate`: reverses apex acceptance in an in-memory copy of the module. Verified exit 1; eight assertions fail, careful wins 0/256 and independent boundary cases pass 0/8. Source files are not mutated.

### Phone checks and screenshots

Command: `PLAYWRIGHT=<directory containing playwright> fnm exec --using=26.12.0 node experiments/lab/night-bells/check.mjs`.

The default screenshot-enabled command exited 0 with both profiles, sequentially. A final WebKit rerun after the two cosmetic fixes also exited 0; final measured results are below. Each passed all eight campaign levels, pause/resume/blur, campaign and preference reloads, exact endless best storage, a completed lower-score run retaining that best, corrupt JSON, invalid save values, a future-version save, and blocked storage. Each made 110 same-origin GET requests, with zero telemetry, outbound requests, page, console, HTTP or request errors. Minimum control dimension was 48 px.

| Profile | Level 1 wall time from Play | Hits / misses | Endless best | Screenshots |
| --- | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | 20.489 s | 15 / 0 | 310 | 9 |
| Chromium Pixel 7 | 33.896 s | 15 / 0 | 303 | 9 |

First-level times include 3.3 seconds of idle help. The controller uses one scored native `page.tap`, then synthetic touch PointerEvents dispatched to the real pads in requestAnimationFrame, with at least 150 ms between events. Actual minimum gaps were 632 ms and 235.9 ms respectively. It does not alter simulation time or state. Levels 2–8 use explicitly accelerated fixed-step time through the real input queue and finish/save UI; both profiles completed these with zero misses. These tests establish browser integration, not physical-phone or human-play evidence.

Initial remote-selector tap loops reacted to stale snapshots under concurrent browser load. Moving the timed controller into the page removed that test-runner latency. WebKit also stalled in navigation, compositor capture, and Playwright's stability wait. The harness now captures palettes using the actual palette controls, tests query parameters in separate contexts at the end, and waits for two rendered frames. The control helper explicitly checks visibility, enabled state, a 48 px target, viewport containment and `elementFromPoint` before sending a native forced tap. It waits for the pointer-release active style to clear before measuring baseline geometry. Covered or off-screen controls still fail. The screenshot timeout increased from 30 to 45 seconds to accommodate slow capture. The 60-second gameplay limit and functional thresholds were not relaxed. The default check still requires screenshots; functional-only mode was used only to diagnose the host failures.

Screenshots: `/private/tmp/night-r2-astra1/`, nine per profile: three palette menus, idle help, victory, three gameplay palettes, and endless result. Menu, hint, victory, three-bell Moon/Rose play and endless screenshots were inspected. All controls fit and the three pads remain visible. Final small-phone inspection moved the single-bell ringer left to avoid the swing and hid the menu subtitle below 700 px height to clear the figure. Both profiles passed with these final visual changes. The final WebKit menu, hint, victory, three-bell play and endless screenshots were re-inspected; the ringer clears the bell and the menu title is clear.

The broad shared kit run began before implementation. WebKit passed the kit, Lantern, Ducklings, Fixit, Borrowed, and the two checked ant lab pages, but Ant Promotion and Grapevine timed out waiting for visible buttons. The broad run was stopped without editing those games. A later kit-only invocation briefly failed because another concurrent edit referenced a missing `kit/check/pages.mjs`; after that file appeared, the kit-only run passed Chromium but timed out at 150 seconds on WebKit. These are shared-suite failures, not a green shared-suite claim.

## Unverified

- A stranger learning without reading and finishing level 1 in under a minute. Scripted timing success does not establish this.
- Physical phones, actual one-thumb reach, perceived latency, frame rate or battery use on an older device, and sound by ear.
- Late-level human difficulty: the delayed-response bot wins only 1/32 on level 4 and none on levels 5–8. The careful bot establishes solvability, not enjoyment.
- Production routing, deployment and live integration. The shared catalogue was not edited because writes were restricted to this new folder.

## 2026-11-24 — first-play review

- Rotated the 390 × 664 and 412 × 837 phone profiles during first play. With the finger lifted, the teaching hand reached y=412.30 in the 390 px viewport and y=431.44 in the 412 px viewport. The pad centre now leaves 78 px for the hand and its shadow in landscape, ending its shape at y=385 and y=407. The ringer stands on the gallery, the bell swing clears it, and the landscape menu places its buttons beside the tower. The still hint follows the pad through a rotation.
- Both profiles lost the hint after a reload before the first strike. Starting Endless could also show or retire the campaign hint. The first-campaign completion and existing hint key govern persistence. A fresh player can reload, try Endless, or tap open space and still get the lesson. A WebKit tap in open space had produced one valid ring. Moving-bell tap targets now follow their drawn centres, with hit radii of 37.05, 28.6 and 24 px for one, two and three bells respectively. Native taps still score on the pads and moving bells.
- The lights bar could fill while the level still needed harmony, and the counter kept increasing past the goal. Level 2 now gives the harmony instruction before it is needed. A deliberate one-bell run earns 23 lights against a 22-light target, displays `22 / 22`, leaves the instruction visible and remains in play until a harmony. The goal clears after a credited harmony.
- Native WebKit Level 7 twice timed out at 75.000 s with 148 hits and 5 misses, then 157 hits and 4 misses. Both attempts made zero harmonies. Three-bell campaign levels now credit each bell's previous half-swing strike during a real apex overlap. The recent-hit window per bell is one half-period plus its accepted timing half-window, formerly 0.65 seconds. Apex timing and energy eligibility still apply. The one- and two-bell levels and Endless use their existing rule. The browser regression observes a Level 7 harmony where at least one strike is older than 0.65 seconds, and independently checks the apex overlap for all observed harmonies.

The normal rules run exited 0. Careful won 256/256 with 0 misses and 2,284 harmonies. Idle and rapid tapping won 0/256 each. The delayed-response bot's wins across levels 1–8 were `32, 26, 19, 1, 26, 11, 1, 0` out of 32 each, up from 78/256 to 116/256 overall. The in-memory apex mutation exited 1 with 8 failed checks. No check acceptance threshold changed.

Native touch play reached all eight levels across two passes per profile. The first pass started with an empty save. The second pass started with completed levels 1–4 and used seed 73096 to replay the WebKit Level 7 failure. The controller observed the same readiness used for the visible rings, then sent native touchscreen taps through Playwright at normal animation speed.

| Profile | Level 1 | Level 5 | Level 6 | Level 7 | Level 8 |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | 18.833 s | 22.758 s | 17.867 s | 23.458 s | 33.092 s |
| Chromium Pixel 7 | 19.917 s | 16.492 s | 32.742 s | 45.625 s | 30.942 s |

Game times are to the first win in the listed pass. WebKit's same-seed Level 7 win was 45 hits, 5 misses and 3 harmonies. Chromium's was 53 hits, 22 misses and 4 harmonies. Chromium previously reached the 70-second Level 5 limit with 98 hits, 26 misses and 0 harmonies.

Both profiles paused, froze, resumed, retried Level 1 with zero attempts and retained its 3 stars, rotated in play, reloaded mid-level, and returned to the menu via browser history after leaving Endless. A background-to-pad drag scored 0 hits and 0 misses on each profile, using native touch in Chromium and a native mouse drag in WebKit. Headless tab focus switching did not pause either profile. The existing blur event check verifies the pause handler. Real-phone touch and app switching, emergent player timing, and sound by ear remain unverified.

The screenshot-enabled phone checks each completed all eight levels and observed zero out-of-apex harmonies. WebKit completed the real-time Level 1 check in 23.354 s and Chromium in 21.708 s, each with 15 hits, 0 misses and a 48 px minimum touch target. The first WebKit rerun reached the end of the campaign, then opened a visible save-fixture page that rendered zero frames. The test now grows the WebKit viewport by 1 px and restores the exact device size before it requires two painted frames. Screenshot timeouts and gameplay thresholds retain their previous values. The artifacts are in `/private/tmp/night-r3-review/bells/`, including 12 check screenshots per profile. Inspected menu, hint, active play, retries, victories, pause and Endless in both orientations, plus the reduced-motion hint.

## Play recording (2026-11-24)

The page sends play records to the lab under the name `night-bells` through `kit/lab.js` (the name is in human-framework `LAB_PROTOTYPES` once its pull request lands; until then every send is refused). The recording notice is on the menu card; the off switch is on the pause card. A run is one try at a night or the endless mode: it starts with Play, a level or Endless, and ends `won` or `lost` (summary: level, hits, harmony, misses, score, stars), or `quit` through Menu or Retry. Events: `level-complete` (level, stars) and `endless-finished`.

`check.mjs` answers the lab address itself (no check reaches the real one), loads the page with `?labRunSource=agent`, and asserts: the notice is on the page before play, a played run sends one run record under `night-bells` with its events record, and after the switch is turned off a further run sends nothing and the player id is removed. Not verified: delivery to the real lab (the Worker does not accept this name yet), a real phone.
