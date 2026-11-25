# Night Bells

Served at `/lab/night-bells/`. A visual rhythm game for one thumb. 24 nights in three chapters, endless play and a daily peal, in English and Turkish. No network score service; play recording goes through `kit/lab.js` (below).

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

## 2026-11-24 — "Good but improve": 24 nights, the village's tune, a daily peal, Turkish

The owner's verdict was "Good but improve". This section supersedes the eight-level table above for nights 2–8 (their targets, windows, damping and clocks were retuned; main's values are kept in `sim.js` `LEGACY` and replayed by `bots.mjs`).

### Five weak things from cold play, before and after

Cold play on main in both phone profiles, before any change (screenshots `/tmp/claude-improve-night-bells/before/`, after `/tmp/claude-improve-night-bells/after/`; not in the repo).

| # | Weak thing on main | Measure before | After |
| --- | --- | --- | --- |
| 1 | The lost card had "Try again" and "Again" doing the same thing and never said why | 2 identical buttons, no reason | one primary "Try again ↻", Again hidden on a loss; a reason line: "Out of time with 0 of 26 lights." or "Bell 2 swung too low…" (checked in both browsers) |
| 2 | Dead stretch: the bar is full, the player waits for swings to line up while the clock runs | delayed-response bot losses on the clock with a full bar, nights 2/3/4: 6/13/23 of 32 | 0 on every night (`hold` rule: the clock waits while the bar is full; the cue says what is still needed). Bot claim `no night is lost on the clock with a full bar` |
| 3 | Difficulty cliff | delayed-response bot wins nights 1–8 (main's open-loop bot): 32 26 19 1 26 11 1 0; with this branch's closed-loop bot on main's rules: 32 24 16 0 24 6 0 0 | 32 31 29 29 26 27 27 26; largest night-to-night drop over all 24 nights is 4 |
| 4 | The village barely answered | a ring lit no particular window; a "together" was a 10% flash for 0.7 s | each ring sends a spark from the bell to one window, which pops on arrival; the end card replays the tune and lights the windows in order, with one dot per note |
| 5 | Three-bell nights: apex rings of neighbouring bells overlapped; the objective ran into the moon | ring overlap at 390×844 from main's formula: 18.6 px on two-bell nights, 35.5 px on three-bell nights | 0: rings sit only on sides that may ring, radius 0.34·size, each swing stays in its column; worst gap −15.1 px on nights 2–8 and ≤ 0 px on 9–24 (measured from `bellsState().markers`). The objective stops 96 px from the right edge |

### 24 nights: one idea each from real pendulums and bells

| Night | Idea | The physics |
| ---: | --- | --- |
| 1 | swing | one bell; ring at the top of the swing (unchanged) |
| 2 | periods | period ∝ √length: two lengths drift in and out of phase |
| 3 | drift | the two swings beat: they drift apart and come back into phase |
| 4 | together | fill the bar, then a full alignment (the held clock makes the wait fair) |
| 5 | three | three lengths; alignment needs all three tops |
| 6 | tight | three bells damp a little faster (0.019 vs 0.018), more lights |
| 7 | tighter | longer night, same three bells |
| 8 | eight | the end of main's campaign |
| 9 | ringUp | bells start near rest (start energy 0.16): ringing up a bell from small swings |
| 10 | handstroke | the second bell rings only on one side of its swing (handstroke/backstroke) |
| 11 | octave | lengths 4:1 give periods 2:1; tops meet every long swing; ring a chord (two tops within 0.32 s) |
| 12 | muffled | a leather muffle on the clapper: that bell damps 3.2× faster |
| 13 | rounds | change ringing's rounds: 1 2 3 in order |
| 14 | beam | two bells on one beam: energy flows at a rate ∝ sin(phase difference) (averaged coupled oscillators), so swing passes back and forth |
| 15 | gust | a gust is a horizontal impulse: change velocity, then read amplitude and phase back; leaves warn 1.2 s ahead |
| 16 | high | finite-amplitude pendulum: period grows about 1 + A²/16, so high swings are slower |
| 17 | hunt | plain hunt on three: swap the front pair, then the back pair; home after six rows |
| 18 | rope | the ringer shortens the third rope at 12 s (length × 0.55): that bell speeds up |
| 19 | triad | lengths 36:16:9 swing 2:3:4; all three tops within 0.6 s ring a triad |
| 20 | sympathy | sympathetic resonance: an unroped twin of the same length on the beam wakes when its energy passes a threshold |
| 21 | chain | three bells on one beam: the swing travels along it |
| 22 | heavy | a heavy tenor: each pull lifts it 0.55 as much |
| 23 | huygens | Huygens' clocks: bells on one frame pull into step (phase pull ∝ sin of the difference) |
| 24 | peal | plain hunt, then rounds, in the wind |

The careful timing bot clears every night on all 32 seeds (7.72–15.38 s). Delayed-response bot wins per night of 32, after: 32 31 29 29 26 27 27 26 · 24 20 21 21 19 16 16 15 · 15 15 14 13 9 8 8 8. Nights 1–8 before: see row 3 above. No night is lower than 2/32 and the bot clears fewer nights per chapter (bot claims).

### What else was added

- **The village plays your tune.** Each strike is one note of `kit/music.js` preset `bell` (`chime(rank)`: the longest bell is the lowest note) when music and sound are on; otherwise fixed C5/E5/G5. A bell voice is three partials. A won night replays the last 24 strikes with the gaps tightened (×0.5, 0.16–0.42 s) and lights windows in order. `music.js` was not edited.
- **Daily peal.** `?day=YYYY-MM-DD` or the UTC date → FNV seed (`dayNumber`) → one of eight three-bell ideas (`dailySpec`), the same on every phone. The result card offers Share: a 1080×1350 PNG drawn from SVG (the peal as dots by bell and time, the date and counts) through `kit/share.js` `shareImage` (the share sheet with the file, else a download of the picture); `kit/room.js` `shareLink` shares the text and URL when there is no picture.
- **English and Turkish** through `kit/i18n.js` words (`words.js`); `?lang=tr`. Catalog entry `tr: true`. Opened from `/small/` the menu and result cards carry a back link, and results reach the home through `kit/home.js`.
- **Chapters**: nights 1–8, 9–16, 17–24 on the menu; a chapter opens when its first night is reached.
- Play recording: the run summary adds `daily`, `chords`; a new event `daily-finished` and `share`.

### Storage

`night-bells:save` is unchanged in format (stars stay eight long), so an old save loads and the shared lab check fixture still passes. New keys: `night-bells:more` `{v:1, stars:[16]}` for nights 9–24; `night-bells:music` `'1'|'0'`; `night-bells:daily` `{v:1, day, plays, best, won, rings, together, misses, peal:[[bell, tenths]…]}`, reset when the day changes.

### Checks

- `bots.mjs`: 0 failed. Parity: with every new field absent the rules hash is `92c13613`, as on main. `--mutate` (apex, 17 failures), `--mutate=order` (1), `--mutate=hold` (3) each exit 1.
- `check.mjs` webkit and chromium: PASS. Changes made on purpose: (1) the accelerated winner skips a free bell, which has no rope and no apex to ring; (2) after night 8 the check taps Next into nights 9–24 instead of stopping, then checks the chapters; (3) a lost endless run is retried through `#next`, because `#retry` is now hidden on a loss; (4) a new block: daily peal in Turkish at 320×568 opened from the home (no screen scrolls, same seed for the same day and a different one for the next day, peal saved, picture 1080×1350, Share in Turkish, old save unchanged except `tries`, a run with `daily-finished`).
- A new assertion: with sound and music on, every strike's pitch comes from `song.chime` (`bellsState().voices`); breaking `song.chime` makes `check.mjs` fail on it (tried).
- `kit/check/phone.mjs lab/night-bells` and `small`: ok in both browsers. `npm test`: 73 pass.
- Frame cost (outside probe timing every requestAnimationFrame callback, careful play of night 8 to the end card, 390×844): branch WebKit p95 1 ms, Chromium p95 0.4 ms; one frame per run exceeds 8 ms in WebKit (10–14 ms) at the moment of winning. Main measured with the same probe has the same one-off spike (WebKit 9 ms; Chromium once 10.2 ms). Timing the parts: `finish()` takes about 1 ms; on the first end-card frame 10–17 ms fall inside `tower()` (pure canvas calls right after the end card's DOM changes); a 5–8 ms play-frame spike falls outside `draw()`. The cause is unresolved. **8 ms: not met on one frame per night in WebKit.**
- The Share picture and text both describe today's best peal (`night-bells:daily`), not necessarily the last run.
- At heights up to 620 px in portrait the menu darkens over the tower so its buttons stay readable; the tower art is mostly hidden there.
- 320×568: no screen scrolls in English or Turkish, menu, pause and result. Landscape (664×390): every menu button fits; the Turkish back link from the home sits 5 px below the fold and the card scrolls to it (the no-scroll rule is for portrait).

### Unverified

- The Turkish wording has not been read by a native speaker.
- Sound by ear: the bell voice, the music preset and the replayed tune.
- Real phones, one-thumb reach and human difficulty of nights 9–24; the bots prove solvability and the shape of the curve, not enjoyment.
- The home card at `/small/` still counts to 8 (`experiments/small/marks.js` `of: 8`, asserted '1 / 8' in `kit/check/pages.mjs`); not changed here.

## 2026-11-25 — the way back to the small games home

Already wired to the home. The way back and the recording notice and switch now follow the page's language when it changes (`lang` passed to `kit/home.js` and `kit/lab.js`). The home shows this game's progress out of the count in `experiments/small/catalog.js`, which `scripts/small-catalog.test.mjs` keeps equal to the game's own.
