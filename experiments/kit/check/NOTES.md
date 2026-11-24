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
