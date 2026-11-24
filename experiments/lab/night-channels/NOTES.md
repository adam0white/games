# Night Channels

## 2026-11-24 — hillside irrigation

Open `/lab/night-channels/` to play. Garden 1 opens directly on a spring, a wet furrow and one seedbed. A moving mark traces the three dry cells between them. Digging lowers the land under the thumb immediately. A player can pause, replant or switch to the daily garden at any point. A win leaves the water and flowers on screen.

There are ten campaign gardens. Finishing a garden unlocks the next one. The daily uses the device’s local calendar date and opens immediately, even on a new device. The best is the fewest cuts that flower every bed. The score is stored separately for each date. The full garden and the scoring rules are identical in the juniper `?look=moon` and terracotta `?look=clay` palettes.

### Water and growth

Each of the 63 cells has ground height, surface water depth and soil moisture. The spring replenishes up to 0.078 units per tick toward a depth of 0.66. Digging lowers one cell by 1.55 units and spends one cut. Repeated passes over that cell are free. Rock faces carry no flow.

At 30 fixed ticks per second, each open face proposes a transfer of 0.23 times the difference in free-surface elevation. The solver scales each donor’s outgoing transfers to its available water before applying any transfers. Local flow can reverse if water backs up. Sand admits up to 0.022 units per tick into dry soil, compared with 0.0023 for regular soil. Infiltration moves water into storage. Percolation leaves the model through a measured drain. The mass check compares initial water plus spring inflow with surface water, soil moisture and cumulative drainage.

A bed above the 0.065 moisture threshold gains 0.34 growth per second. Below it an unfinished plant loses 0.2 per second. A fully flowered plant stays open. Water width follows depth, highlights follow local flux, and wet soil darkens beyond the cut. Reduced motion keeps the changes in water depth and plant growth and freezes decorative motion.

The page uses the kit for sound, pause, zoom, screens, the delayed path hint and local storage. The first garden also traces the actual gap on its own soil. Absolute cell digging uses the pointer’s position and traverses every crossed grid face, including a fast stroke that exits the board. The notes button loads from `/notes/button.js`. The game has no lab recording or score submission.

### Rules checks

Command: `fnm exec --using=26.12.0 node experiments/lab/night-channels/bots.mjs`.

The planner connects beds using visible terrain and spends three ticks per accepted cut. It can share an existing trench between beds. Idle play left every bed dry for 2,700 ticks in each of the ten gardens.

| Garden | Beds | Cuts used / available | Ticks to flower all beds |
| ---: | ---: | ---: | ---: |
| 1 | 1 | 3 / 5 | 105 |
| 2 | 1 | 6 / 8 | 114 |
| 3 | 2 | 8 / 10 | 204 |
| 4 | 2 | 7 / 12 | 187 |
| 5 | 2 | 10 / 13 | 265 |
| 6 | 3 | 9 / 13 | 131 |
| 7 | 3 | 12 / 14 | 490 |
| 8 | 3 | 12 / 14 | 219 |
| 9 | 3 | 13 / 16 | 516 |
| 10 | 4 | 11 / 17 | 383 |

The 365 local dates from 2026-11-24 through 2027-11-23 produced 365 distinct terrain layouts. The planner flowered all three beds on 365/365, spending 7–18 cuts in 126–1,760 ticks. Garden 1 took 105 ticks (3.50 seconds). The hydraulic fixtures check flow up a terrain slope toward lower water level, zero flux across an equal water level, stronger sand uptake, wilting, rock barriers and repeatability.

The `--mutate` run credits a receiving cell with only half of the transferred water. It exits 1 on the first mass check, with a discrepancy of 0.04659648444945441 against a tolerance of 0.00000001. No gameplay acceptance threshold was loosened.

A connected route can supply too little water. On 2029-05-27 the cheaper 13-cut route flowered one of three beds in 90 seconds. Moving the cross-channel uphill and spending 15 of 21 cuts flowered all three in 971 ticks (32.37 seconds). An exhausted budget shows an isolated-bed warning only when an intact bank separates a bed from the spring.

The optional `--extended` run follows the generator’s reserved terrace for 5,000 consecutive dates starting 2026-11-24. All 5,000 routes flowered. The slowest took 1,424 ticks (47.47 seconds) on 2030-08-07. The routes needed at most 17 cuts and left at least six unused. The maximum observed mass residual across the per-tick accounting tests, including the starved route, was 1.9983792398647893 × 10⁻¹¹.

### First gesture

An independent screenshot-only probe saw the opening board with all words cropped out. Its first proposed gesture was to press the lower tip of the water, drag down the dotted line and lift on the sprout. It predicted that this would dig a channel and water the sprout. The phone checks drag along the same column from the spring to the sprout. A new human player has yet to try it.

### Phone checks and screenshots

Run `fnm exec --using=26.12.0 node experiments/lab/night-channels/check.mjs` with Playwright installed at the path resolved by the check or in `PLAYWRIGHT`. It serves the actual experiment, kit modules and notes button on loopback. The final combined run exited 0. The first-garden stopwatch starts before navigation and includes screenshot capture. Physics and gestures run in real time.

| Profile | First flower, wall seconds | Cuts | Cell width, CSS px | Daily cuts / budget | Daily beds flowered |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebKit, iPhone 13 | 9.80 | 3 | 43.1 | 11 / 20 | 3 / 3 |
| Chromium, Pixel 7 | 12.79 | 3 | 53.6 | 11 / 20 | 3 / 3 |

The first swipe uses native mouse input on WebKit and trusted touch input on Chromium. Both runs checked rock touches, secondary pointers, cancellation, an exhausted budget, retry, pause and resume, leaving the page, campaign unlocks, daily rollover and the notes button. Both replays used 12 cuts. Reload preserved the 11-cut best. Both browsers reported zero script or console errors, failed asset responses, telemetry requests and outside requests.

Five screenshots per profile show the spring, growing bed, first flower, dry daily and completed daily. All ten were inspected. The initial WebKit visual check caught 0 of 53 dry soil cells visible while the water and plant still rendered. The final renderer paints the terrain directly into the visible canvas each frame. The browser check now samples the saved screenshot and requires soil-colored pixels at 80% or more of uncut soil cells. The sprout capture moved from growth above zero to growth at least 0.5 and below 1 so it captures unfolding leaves.

The test harness foregrounds WebKit, changes the viewport by one CSS pixel for 150 ms and restores the device viewport before navigation. Initial play-state polling uses a 100 ms interval to report startup errors even when animation frames stall. Default operations have a 30-second deadline. The first win wait is 55 seconds, the daily win wait is 60 seconds, and a screenshot gets up to 90 seconds on a busy host. The first-garden acceptance threshold stayed below 60 wall-clock seconds.

The shared kit self-test passed on both browsers. The two broad registered-game runs were interrupted after unrelated WebKit failures in the breath hint, race launch and a 3D page that lost its WebGL context. The full registered-game suite remains unverified. No shared files were edited.

Still unverified: first-time human play, difficulty beyond the planner’s routes, physical-phone performance, and audio by ear. The screenshots and bot results describe local play.

## 2026-11-24 — phone review

- Render the unchanged soil, rocks and verge in a visible canvas behind the water and plants. Repaint that terrain on a new garden or backing-size change. The browser check counts terrain draws through digging and blooming and checks the composited soil pixels on both sides of a resize.
- Keep the board in place when Next garden appears. Removing its 4 px top and bottom margins holds the control row at 45 px. The check compares the opening and winning board geometry exactly.
- Cancel a held stroke when the board resizes and redraw the board even on pause. Otherwise its last point belongs to the previous coordinate system. The check holds on the spring while rotating, moves over a dry bank and requires zero cuts from that held stroke. A new tap must spend one cut on the landscape board. Reload then restores garden 2 with its full budget.
- Remove the decorative instruments and narrow the sidebar margins in landscapes up to 720 CSS px wide. At 664 px the bloom reading previously overlapped the retry hit box. The check now measures the gap between readings and from the bloom reading to retry.

The WebKit harness produced one completely black screenshot, including the header and footer. It now retries at most twice after a one-pixel viewport change and restores the original dimensions before the next capture. A screenshot with visible controls and missing terrain still fails the same 80% dry-soil pixel requirement.

An independent Chromium opening sample before the split measured 165 animation callbacks at 2.50 ms p95 and 7.90 ms maximum. The callback interval was 33.40 ms p95. After the split, a separate opening-to-first-bloom run measured 825 callbacks at 0.50 ms p95 and 10.30 ms maximum. Zero callbacks took more than 16.7 ms. Its 824 callback intervals reached 16.80 ms p95 and 11,949.40 ms maximum, with 374 above 16.7 ms. These measurements include capture and shared-host scheduling delays and do not establish a sustained device frame rate.

The WebKit native animation probe sampled the dry opening and the first wet furrow separately. Dry callback work fell from 2 ms p95 over 141 callbacks to 1 ms p95 over 224. Wet callback work fell from 2 ms p95 over 166 callbacks to 1 ms p95 over 232. The dry and wet callback interval p95 changed from 30 and 27 ms to 18 and 21 ms. The final maximum work took 1 and 6 ms. The final intervals exceeded 16.7 ms in 19/223 dry and 22/231 wet samples.

The normal bot suite exited 0. All 10 gardens and all 365 daily layouts flowered. The mutated suite exited 1 on the 0.04659648444945441 mass discrepancy. The review left the rules and existing test thresholds unchanged.

Both final browser checks exited 0. Each used real taps and drags to complete gardens 1–10, pause, retry, navigate away and return, and reload after tapping a bank in landscape. Chromium used trusted touch drags and WebKit used native mouse drags on the phone viewport. The two routes spent 3, 6, 7, 7, 10, 9, 12, 12, 13 and 11 cuts. Each check flowered all three daily beds and retained the 11-cut best after a 12-cut replay.

| Profile | First bloom, wall s | First cell width, CSS px | Landscape gap, CSS px | Garden 1–10 ticks at win | Daily cuts / budget | Browser errors |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| WebKit, iPhone 13 | 5.75 | 43.1 | 38.20 | 166, 137, 184, 197, 276, 214, 502, 230, 318, 471 | 11 / 20 | 0 |
| Chromium, Pixel 7 | 11.54 | 53.6 | 27.64 | 192, 150, 225, 222, 281, 259, 511, 256, 542, 388 | 11 / 20 | 0 |

Fourteen accepted captures were inspected. They show the opening, growing bed, first bloom, rotated second garden, completed campaign and dry and completed daily. They live under `/private/tmp/night-r4-review/channels/`. First-time human play, difficulty without the tested routes, audio by ear, physical-phone frame rate and deployment remain unverified.
