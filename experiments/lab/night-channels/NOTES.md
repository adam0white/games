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
