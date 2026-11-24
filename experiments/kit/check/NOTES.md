# Shared phone checks

## 2026-11-24 — missing page registrations

Acceptance: register the 17 requested pages using their existing storage contracts, run their shared checks on both configured phone profiles, inspect screenshots, and report failures without changing game code.

Added `pages.mjs` and `lab-pages.mjs`. They register 17 saved-play sections and 17 first-time-help sections: 68 browser/profile cases. Their seeds cover 41 existing storage keys, including 17 hint keys, the separate sharing identifiers, the spark-button flag, and the daily pour result. No storage formats changed.

`phone.mjs` checks that each page loads the seeded progress, accepts input, pauses its clock, resumes its clock, pauses on blur and pagehide, preserves saves after a setting write and reload, and respects the saved sound choice. Run-counter changes use exact deltas. Pages without a sound setting retain their existing audio behavior. Matchmaker uses its exposed animation clock for the pause check. The daily pour assertion reads the rendered result, so reading the fixture directly from storage cannot satisfy it.

Each new hint section checks first-visit timing, pause/resume, input reaching the canvas, persisted dismissal, returning-player suppression, and reduced motion. Some input hooks and hint visibility update on the next animation frame. New sections therefore poll for those rendered changes with the existing 8-second wait helper. A first WebKit Breath run still saw the hint class after 200 ms under rendering load; pause itself had already updated synchronously. Existing sections retain their 200 ms hide check and immediate input assertions. No existing threshold was changed. Boat's hint gesture releases before checking its ripple, because that short stroke is committed on pointer-up.

Lantern Race uses an offline WebSocket fixture. This exercises its real local fallback and pausable clock. It does not verify a live room. Lantern Spark's pause button uses pointer-down. The two menu-only sound controls are exercised on the menu.

Meadow Folk's `/lab-api/quest` route returns a local text fixture. The static server cannot provide that Worker endpoint. HTTP and console errors remain failures; no new error filter was added. The production text service is unverified.

Optional `SHOTS=<directory>` saves menu, play, pause, hint and failure screenshots. Screenshot names include the browser and section. Artifacts from this session are in `/private/tmp/night-kit-phone/`; transient logs are in `/private/tmp/night-kit-*.log`.

Before edits, `kit,grapevine,ducklings,fixit,borrowed` passed 16/16 selected sections across both profiles, including their selected hint sections. Syntax checks for all three modules and `git diff --check` passed.

Browser results use the latest completed attempt of each section, including targeted reruns after harness corrections. They do not describe one uninterrupted green run. `P/P` means saved-play section / hint section; `F` means failed.

Final totals: 63/68 cases passed: 32/34 saved-play cases and 31/34 hint cases. Fourteen of the 17 pages passed all four cases. Inspected 61 captured screenshots, including the blank frame described below.

| Page | WebKit iPhone 13 | Chromium Pixel 7 |
| --- | --- | --- |
| breath | P/P | P/P |
| matchmaker | P/P | P/P |
| sling | P/P | P/P |
| duel | P/P | P/P |
| harvest | P/P | P/P |
| boat | P/P | P/F |
| lab/lantern-fp | F/P | F/F |
| lab/lantern-race | P/P | P/P |
| lab/ant-swarm | P/P | P/P |
| lab/ant-quests | P/P | P/P |
| lab/lantern-spark | P/P | P/P |
| lab/ant-creatures | P/P | P/P |
| lab/ant-draft | P/F | P/P |
| lab/ant-draft-b | P/P | P/P |
| lab/boat-b | P/P | P/P |
| lab/wild2-face-shift | P/P | P/P |
| lab/wild-pour | P/P | P/P |

Failures retained:

- Boat's Chromium hint failed `hint: not before the delay`. An earlier run reached the later input assertion; that assertion was then corrected to release the stroke before expecting a ripple. The latest attempt stopped at the timing assertion.
- Lantern FP's latest WebKit saved-play run reached `screen: 'nogl'` with WebGL context loss and shader errors. Its hint rerun passed. Both WebKit sections passed an earlier attempt. Both latest Chromium sections timed out navigating, before validating the page.
- Ant Draft's WebKit hint timed out clicking the visible Play button while waiting for stability. Its saved-play section passed; both Chromium sections passed.

Initial quest cases returned 404 from the static server. After adding the local fixture, both sections passed on both profiles. The earlier 404 results are superseded by `/private/tmp/night-kit-quest.log`.

Reproduction commands (prefix each with `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules`; add `SHOTS=/private/tmp/night-kit-phone` for captures):

```sh
fnm exec --using=26.12.0 node experiments/kit/check/phone.mjs breath,matchmaker,sling,duel,harvest,boat
fnm exec --using=26.12.0 node experiments/kit/check/phone.mjs lab/lantern-race,lab/ant-swarm,lab/ant-quests,lab/lantern-spark,lab/ant-creatures,lab/ant-draft,lab/ant-draft-b,lab/boat-b,lab/wild2-face-shift,lab/wild-pour
fnm exec --using=26.12.0 node experiments/kit/check/phone.mjs 'matchmaker,hint breath,hint boat,lab/lantern-fp'
fnm exec --using=26.12.0 node experiments/kit/check/phone.mjs lab/ant-quests,kit
```

The final kit self-test passed 2/2 profiles. Three module syntax checks and `git diff --check` passed after the last code change. Game-specific `bots.mjs`, mutation runs and `check.mjs` suites were not rerun. This folder has no such separate suites. No game source or existing seed was changed. The existing Lantern 3D sections were neither modified nor included in these scoped runs.

Unverified: real phones, audible output, live recording/quest/room services, quiet-host repeatability, and the game-specific suites. No deployment was attempted.

Observed host conditions: the one-minute load average reached 406.06 during reruns. Browser navigation/stability timeouts and WebGL context loss occurred. Resource contention may explain some failures, but that explanation is unresolved for each failure. No error was filtered out to obtain a pass.

Screenshot inspection found a blank Chromium Harvest canvas in `chromium-hint-harvest-hint.png`: only the HTML pause button and hint are visible. Its saved-play screenshots render the field correctly, and its functional hint assertions passed. The blank capture remains unresolved. No game folder was edited.

## 2026-11-24 — five Night pages and headless Pour

Registered five saved-play cases and five hint cases on both phone profiles. Each registration uses the page's existing progress and hint keys, for 10 keys total. Bells keeps its eight star entries, best score and palette and increments `tries` by one per start. Lamp Keeper restores evening 2 and a daily best of 1400. Channels restores garden 3, Flock restores evening 2 and an endless best of 17, and Podwire restores plate 2 with one completed plate. All five registrations check that sound stays off after a reload.

The checks strike one bell, commit one route, spend one cut, move the dog at least one world unit, and count one released pluck. Podwire uses native touch in Chromium and a browser mouse drag in WebKit to exercise pointer capture. The Flock check presses the exposed left side of Pause because the tester Notes button overlaps its center on Pixel 7.

Hint delays are 1600 ms for Bells, 4500 ms for Lamp Keeper, 4000 ms for Channels, 8500 ms for Flock and 5500 ms for Podwire. The check records the start action or the result card and the hint's first appearance in the browser. It allows 250 ms for the kit's first eligible frame, which can count time from the preceding frame. Channels uses the daily garden and Flock uses endless play to reach the kit hint. Podwire opens the first pod and verifies that Next dismisses the hint and opens plate 2. Its hint appears on the result card, where Pause is disabled. The saved-play case exercises pause and resume separately. Returning-player checks assert that the kit does not mount a hint for either a progress save or a dismissal key. Existing thresholds remain in force.

On macOS the selected WebKit runs hold a display assertion while the browser runs. If no animation frames arrive, the harness restores the original viewport after a one-pixel resize and verifies two frames at that size. Wild Pour defaults both profiles to headless, opens a window only with `HEADED=1`, and writes captures to `SHOTS` or a new temporary directory. Its macOS WebKit display assertion is bounded at 180 seconds.

Verification artifacts for this section are in `/private/tmp/night-r3-shared-verification/`. The initial WebKit runs captured black screens. Subsequent runs checked both animation frames and the captured images. The initial Chromium Pour run logged an audio-device error after completing its gameplay assertions. Error and frame-budget checks remain in place.

The combined standalone Pour check exited 0, with zero page or console errors. Both profiles won the campaign on the first attempt. Inspected all 12 captures from that run, including the hint, full tilt and daily result.

| Headless profile | Campaign (drops / target, spills, stars) | Daily (drops / target, spills) | Clearance (CSS px) | Stationary frames / mean interval / p95 work | Active frames / mean interval / p95 work |
| --- | --- | --- | ---: | --- | --- |
| WebKit iPhone 13 | 29 / 34, 13, 1 | 32 / 34, 9 | 13.92 | 353 / 14.235 ms / 2.0 ms | 300 / 14.250 ms / 2.0 ms |
| Chromium Pixel 7 | 37 / 34, 4, 2 | 37 / 34, 6 | 15.82 | 308 / 16.666 ms / 2.2 ms | 263 / 16.666 ms / 1.9 ms |

Each pass below is a separate `phone.mjs lab/<slug> <profile>` invocation covering both saved play and the hint. The final streaks contain 30 passing invocations and 60 passing sections.

| Page | Consecutive WebKit passes | Consecutive Chromium passes |
| --- | ---: | ---: |
| night-bells | 3 | 3 |
| night-lamp-keeper | 3 | 3 |
| night-channels | 3 | 3 |
| night-flock | 3 | 3 |
| night-podwire | 3 | 3 |

Inspected the 40 shared captures from the last pass on each profile and compared the hint captures to earlier frames where needed. Some captures landed during the hint's fade-in. Earlier WebKit runs hit compositor stalls and a 150-second whole-section deadline. The scoped kit self-test and shared Wild Pour saved-play and hint cases passed on both profiles. All six normal bot suites exited 0 and all six mutations exited 1. Syntax checks on the three edited modules and the scoped whitespace check passed.

Physical phones, audible sound, windowed Pour, and a full run of every registered shared check remain unverified in this pass. All new verification images and logs were written outside the worktree.

## 2026-11-24 — Kite, Loaves, Splitlight and Tide

Added 4 saved-play sections and 4 first-visit hint sections across 2 phone profiles. The seeds exercise 10 storage keys. Each saved-play case checks pause, resume, blur, pagehide and sound persistence after reload.

| Page | Seeded progress | Input checked | Hint delay |
| --- | --- | --- | ---: |
| night-kite | Flight 2 unlocked and selected, best 157, copper ink | Tap logical point (220, 440). The spool moves past x=200. | 6500 ms |
| night-loaves | Morning 2, Milk bread, best 240 on the pause card | A fold travels from (x−38, y+8) to (x+39, y−7) relative to the dough center. Kneading work and the play clock advance. | 3800 ms |
| night-splitlight | Plate 2, sound on | A tap 12% from the left of the range changes prism position and starts the exposure clock. | 2200 ms |
| lantern-tide | Night 2, sound on | A 40 CSS px drag moves the steering target right by more than the equivalent of 24 CSS px and the boat by more than 4 CSS px. | 1500 ms |

Kite, Loaves and Splitlight start hint timing on the opening board. A document-start observer timestamps the hint mount and first visible frame. Tide measures from the launch tap and uses its existing `check=1` state hook. Loaves reads its simulation state from the bakery canvas dataset. The timing assertions use the existing 250 ms first-frame allowance. The hint cases wait on visibility and input state, verify dismissal and returning-player suppression, and check the reduced-motion presentation. Hint captures wait for full opacity. Kite and Splitlight use trusted touch taps on both profiles. Loaves and Tide use native touch drags in Chromium and browser mouse drags in WebKit, where the automation for touch is limited to taps.

| Page | Consecutive WebKit passes | Consecutive Chromium passes |
| --- | ---: | ---: |
| night-kite | 3 | 3 |
| night-loaves | 3 | 3 |
| night-splitlight | 3 | 3 |
| lantern-tide | 3 | 3 |

Each pass invokes `phone.mjs lab/<slug> <profile>` separately with Node 26.12.0. The required streaks cover 24 invocations and 48 passing sections. Kit, Bells and Podwire passed 10/10 regression sections across the two profiles. All 4 normal bot checks exited 0 and all 4 mutation runs exited 1.

Repeated the affected streaks after concurrent page updates. Inspected 112 shared screenshots, including 32 opening, play, pause and hint captures from the final pass for each page and profile. Browser logs and images are in `/private/tmp/night-r3-phone-four.VXhW4h/`.

The latest standalone `check.mjs` runs passed 7/8 profile cases. Kite, Loaves and Splitlight passed on both profiles. Tide passed in WebKit, reaching dawn on nights 1 and 2 in 23.63 and 34.47 simulated seconds. Its Chromium run hit a rock at y=51.39 on night 2 and exited 1. The previous Chromium run hit the bank at y=64.78 on night 2. These crossings are outside the shared cases. All three shared modules passed syntax checks, and the scoped diff passed the whitespace check. Physical phones, audible sound and a full run of the shared catalogue remain unverified.
