# Night Channels

## 2026-11-26 — the garden greens over

Played cold first (iPhone 13 WebKit): garden 1 is open to bloom in about 3 s with one drag, so the first minute was already fine. The weak moment was the win: one small flower at the end of a bare trench, then a button.

- On a win the banks green over. Grass and small flowers spread out from the spring along every wet cell and onto the soil beside it, nearest first (0.07 s per cell of distance), and stay while the finished garden is on screen. A longer, branching channel makes a bigger meadow. Reduced motion shows it grown at once. Drawn in `render.js` (`verge`), after the water and before the beds; nothing in the rules changed.
- Haptics where the phone has them (`navigator.vibrate`, Android; silent elsewhere and under reduced motion): a tick per cut, a double tap on a refused cut, a tap when water reaches a bed, a pattern on a bed blooming and on the whole garden.
- The win button names the next garden: "Next: The bend" ("Sıradaki: Dönemeç"). It stays on one line; a long name is cut with an ellipsis on a narrow phone. The text buttons in the row no longer wrap ("Günün bahçesi" did at 320 px).

Verified: `check.mjs` on WebKit iPhone 13 and Chromium Pixel 7 (all 30 gardens by real drags, first bloom 3.2 / 3.4 s wall, frame work p95 1 ms, fit at 320x568 in English and Turkish, 0 errors); `bots.mjs` unchanged (same pars, same clumsy-bot rates); `phone.mjs small/night-channels`. Render cost with a won garden-30-sized meadow: median 1 ms / p95 2 ms (WebKit), 0.4 / 0.8 ms (Chromium), against 1 / 1 and 0.3 / 0.5 without it. Screenshots of the meadow and the Turkish row at 320 px looked at.

Not judged by a person: whether the meadow feels like a reward, the buzz strength on a real Android phone, and whether naming the next garden pulls anyone on.

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

## Play recording (2026-11-24)

The page sends play records to the lab under the name `night-channels` through `kit/lab.js` (the name is in human-framework `LAB_PROTOTYPES` once its pull request lands; until then every send is refused). This page has no start card, so the recording notice sits in the footer under the garden from the first moment, and the off switch is on the pause card. A run is one garden, from the first cut to bloom (`won`), a replant or leaving for the list (`lost` if the cuts ran out, else `quit`). Opening the page and not cutting records nothing. Events: `garden-complete` and, for the daily, `daily-finished`. The check no longer blocks `/kit/lab.js`; it answers the lab address itself and asserts nothing else is written.

`check.mjs` answers the lab address itself (no check reaches the real one), loads the page with `?labRunSource=agent`, and asserts: the notice is on the page before play, a played run sends one run record under `night-channels` with its events record, and after the switch is turned off a further run sends nothing and the player id is removed. Not verified: delivery to the real lab (the Worker does not accept this name yet), a real phone.

## 2026-11-24 — improve (the owner: "Good but improve")

The owner played the page on a phone and said "Good but improve". This round played it cold first (main bd56a760, cleared save, WebKit iPhone 13 and Chromium Pixel 7 at 390x844), wrote down the five weakest things, fixed them, tripled the gardens from the same rule, added par and a shareable daily line, sound and motion for every action, and Turkish.

### Five weak things, before and after

| # | Weak thing (before) | Change | Before | After |
| --- | --- | --- | --- | --- |
| 1 | Dead wait after the last cut | When the beds are joined to the spring, no finger is down and the last cut was 0.8 s ago, the water runs four ticks per frame. The result line says "Water running »". | Wall s from last drag to win, gardens 3/5/7/9/10: WebKit 6.7/8.7/16.2/17.1/12.6, Chromium 6.1/8.0/15.2/16.1/11.7 | WebKit 2.3/2.8/4.7/4.9/3.8, Chromium 2.1/2.6/4.4/4.6/3.5. Longest new garden (22): 8.5 / 8.2 |
| 2 | A drag through a stone kept digging below it (wasted cuts) | A stroke that crosses a stone stops cutting until the finger lifts (`stroke.js`). Refused cells show a red X, a low tone and the line "A stone stops the cut". "No cuts left" shows when the budget is spent. | Garden 7, a straight drag down column 1: 4 of 14 cuts spent on a dry trench. Clumsy bot, gardens 1–10: 100 85 88 100 56 100 38 80 96 99 | Same drag: 0 cuts spent. Clumsy bot: 100 97 96 100 99 99 94 79 97 97 |
| 3 | A win said little ("In full bloom", 10 px) | Every garden has a par. A win reads "12 cuts · par 12" or "N under par". The list marks gardens cleared at or under par. A per-garden best is kept. | No par, no per-garden best | Par shown before and after play; best per garden saved |
| 4 | Thin feedback | Sound and motion for every action, all through `kit/audio.js` (list below). | One noise burst per cut; touches on stone, spring or with no cuts were silent; buttons silent | Every action has a sound and a motion |
| 5 | A bed's thirst was invisible | A ring round each bed fills with its growth: light while wet, amber while drying, faint while dry. If the beds are joined and a bed has had no growth for 25 s of game time since the last cut, the line says "Too little water reaches a bed". | No sign until the leaves changed | Ring on every bed |

Screenshots: `/tmp/claude-improve-night-channels/before/` and `after/` (and `after-tr/` for Turkish), not in the repo.

### Thirty gardens: one idea each (11–30 are new)

Gardens 1–10 are unchanged. Gardens 11–30 use the same rule (water follows the free surface, sand soaks, stone blocks, a bed blooms while wet). Each adds one idea:

- 11 Old furrows: a dug furrow already leads away from the spring, the wrong way. Use it or ignore it.
- 12 Sand or stone: two rows of sand stand between the spring and the bed. Cutting through sand is cheap but it soaks; the bypass is longer.
- 13 Through the bed: one bed sits on the line to the next; water passes through a bed to reach the one below.
- 14 Spring at the foot: the spring is at the bottom and the bed is uphill. Water must climb.
- 15 The dry ditch: an old dry furrow (`=`, dug but empty) lies across the slope. Joining it is cheaper than digging a new one.
- 16 Up the slope: the spring is mid-hill with one bed above and one below.
- 17 Spring on the side: the spring is at the left edge, not the top.
- 18 The walled bed: stone walls the bed on three sides; there is one way in, from below.
- 19 The narrow gate: a stone wall across the hill with one gap.
- 20 Sand sink: two beds sit inside a field of sand that drinks water.
- 21 The fan: four beds in a row at the bottom; one trunk channel must branch.
- 22 Switchback: two walls force the channel to zig and zag down the hill.
- 23 Far corners: two beds in the bottom corners, with sand between them.
- 24 Two springs: two springs at the top corners and three beds; choose which spring feeds which bed.
- 25 Four ways: the spring is in the middle and four beds sit north, south, east and west of it.
- 26 Five beds: five beds, the most in any garden.
- 27 Mirror: a symmetric garden; a stone row with gaps lies across it and two beds sit below it.
- 28 The far spring: two springs, and the near one is walled off; the far one is the only way.
- 29 The long way down: a stone maze; the only route is long.
- 30 The whole hillside: everything at once: two springs, five beds, sand, stone and an old dry ditch.

Gardens 21–30 were reordered once so the clumsy bot's clear rate falls without a step of more than 15 points (before reordering, 25→26 fell 17 points).

### Par

`plan.js` plans routes by Dijkstra over new cuts from every spring's wet network to each bed, with a penalty for each step uphill (`climb`). Par is the fewest cuts of a planned route that the rules confirm flowers every bed within 90 s of game time. It tries climb 2, 0, 1, 4, 8, then a terrace route (a cross channel on rows 1–5). Campaign pars are in `PARS` (checked by `bots.mjs` against the planner): 3 6 8 7 10 9 12 12 13 11 4 4 3 5 6 6 7 7 11 5 9 16 13 11 11 13 9 9 13 11. A daily par is computed once on the device and cached. Daily par over 365 dates ranges 7–18. On 30 of those dates the cheapest route does not flower in time (the water starves), so par is the cheapest route that does.

### Daily and share

The daily garden is unchanged (same seed from the local date, same layout for everyone on that date). After a daily win a Share button appears. It shares three lines: the title with the date, the flowers with cuts and par, and the page address. It uses `navigator.share` and falls back to the clipboard ("Copied"). The address is the page's origin and path only, without `from`, `lang` or other query words. There is no picture on purpose: a picture of the board would give the route away. There is no `experiments/kit/share.js` on main and no open pull request adds one. `night-sand/main.js` and the small-games home (`experiments/small/main.js`, merged during this round) each share a drawn picture file through `navigator.share({ files })`; their code makes the picture, which this page does not want, so nothing was moved to the kit and the share stays in this page.

The daily's par is found once per date in a module worker (`par-worker.js`), so the tap that opens the daily does not wait for it; the par reads "–" until it answers (without workers the page finds it itself). Measured at 390x844 on three dates, including the slowest of 365 in Node (2027-10-21) and one where the cheapest route starves (2029-05-27): the tap takes 3–4 ms on WebKit and Chromium, and the par arrives 10–49 ms later. Done on the page's thread before the worker, the same tap took 55 ms (WebKit) and 156 ms (Chromium) on 2027-10-21. The first tap in a freshly launched headless Chromium costs about 130 ms whatever the date; main bd56a760 shows the same 134 ms, so it is not from this change. `check.mjs` asserts the page's daily par equals the Node planner's on both browsers.

### Sound and motion for every action

All sounds go through `kit/audio.js`. The motion is the page's own (`render.js` and `garden.css`): the kit has no motion or feedback helper to use. Reduced motion keeps the sounds and colour changes and drops the movement.

- Cut: noise burst, clods fly, the cuts number pops.
- Refused cut (stone, spring, already cut after a stone, no cuts): low triangle tone, red X ring on the cell, the cuts number shakes when spent, a short line says why.
- Water reaches a new bed: plink and a ripple ring.
- A bed blooms: two rising tones and petals.
- The garden blooms: four-note arpeggio and rings at every bed.
- Every button: a soft tone and a press scale. A new garden fades in.

### Saves

`night-channels:save` keeps its format. `unlocked` is clamped to 30. A save with `completed: true` (all ten old gardens done) opens garden 11. Per-garden bests are under a new key, `night-channels:gardens` (`{garden: cuts}`). Daily bests stay at `night-channels:save:best:<date>`. Language uses the kit's `kit:lang`.

### Language

All page strings are in `words.js` in English and Turkish (`kit/i18n.js`). `?lang=tr` or the language button on the pause card switches. No native reader has checked the Turkish. The play-recording notice in the footer comes from `kit/lab.js` and stays in English.

### Checks

- `bots.mjs` exits 0 in about 7 s. Parity: gardens 1–10 and 30 dailies give digest `89119636`, the same as main's rules. All 30 gardens and 365 dailies flower at par. The clumsy bot (200 trials per garden, a planned route with random detours and slips) clears: 100 97 96 100 99 99 94 79 97 97 97 97 96 93 95 91 89 95 93 97 91 89 89 83 81 78 74 68 62 58. Minimum 58. The largest drop between neighbouring gardens is 15, at garden 7 to 8 (94 to 79). Garden 8 is one of the unchanged original ten (80 on main), so the 15-point limit in the claim is that observed drop, not a target chosen in advance. Clumsy-bot numbers before this round exist only for gardens 1–10, because 11–30 are new.
- `--mutate` (mass leak) exits 1 at residual 0.0466. `--mutate=stroke` (stones do not stop a stroke) exits 1. `--mutate=par` (par without checking it flowers) exits 1 on daily 2027-02-16.
- `check.mjs` exits 0 on WebKit and Chromium. It plays all 30 gardens with real drags (11–30 at par), checks par in the win line, the list's par marks, the daily share line, the garden-12 run record, the old-save migration, page work per frame on garden 30 (p95 1 ms, max 2 ms; target under 8 ms), and that nothing scrolls at 320x568 in English and Turkish (footer bottom 563 of 568).
- `phone.mjs lab/night-channels` exits 0 on both browsers. `npm test` passes (73).

Checks changed on purpose: the list and campaign counts went from 10 to 30, the last garden is 30 not 10, unlocked after reload is 30 not 10, and gardens 11–30 are played on the par route. Nothing was removed or loosened.

Not verified: Turkish wording by a native reader; play on a real phone; the sounds by ear; whether the faster water after the last cut feels right; the share sheet on a device; the daily across time zones (it uses the local date, as before); delivery of play records to the real lab.

### The small-games home (after merging main)

Main gained the small-games home (`/small/`, `kit/home.js`, `experiments/small/catalog.js`) while this round was under way. The page now calls `home(lab('night-channels'), { back: ['#paused .card', '#selection .card'] })`, so a player who came from the home gets "‹ Small games" ("‹ Küçük oyunlar") on the pause and garden-list cards, and a won garden counts as a win on the home. The catalog entry for this page now has `tr: true` and the Turkish name "Kanallar". The home's progress reader for this page (`experiments/small/marks.js`, this page's line only) counted 10 gardens and called `completed` finished; it now counts up to 30 (the larger of `completed` as 10, unlocked − 1 and the gardens with a best) and calls the page finished when garden 30 has a best. A player who finished the old ten now shows 10 of 30 on the home, not finished. This line is in the home's file, outside this page's catalog entry; without it the home would show 10 of 10 finished after garden 10. It is a decision for whoever looks after the home. `check.mjs` opens the page with and without `?from=small` at 320x568: with it, the pause and list cards carry the link to `/small/` and fit (card bottoms 414 and 512 of 568); without it, they carry nothing. `phone.mjs small` passes on both browsers.

## 2026-11-25 — the way back to the small games home

Already wired to the home. The way back and the recording notice and switch now follow the page's language when it changes (`lang` passed to `kit/home.js` and `kit/lab.js`). The home shows this game's progress out of the count in `experiments/small/catalog.js`, which `scripts/small-catalog.test.mjs` keeps equal to the game's own.
