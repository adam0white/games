# Lantern: Spark

Lab page at `/lab/lantern-spark/`. It does not record play (no lab.js).

## Rules

- The lantern is out. You see the river only where a spark has shown it.
- Steer by dragging (kit `drag.js`). On a keyboard, use the arrows or a/d.
- Strike a spark with the big button at the bottom right, a second-finger tap, a mouse click, or Space.
  - The ring spreads from the boat at 1.6 river units a second, out to 2.3.
  - Each rock, bank stretch and ember the ring passes keeps an afterglow for 2.2 s.
- The tin starts at 8 sparks and holds at most 20.
  - An ember adds 1.
  - A wisp costs 1.
  - An empty tin strikes nothing.
- Every night opens with one free spark.
- Cues that cost nothing:
  - Reflected stars sit still on the water. A rock blots out the stars it covers, so a hole in the stars may be a rock.
  - Fireflies hover only over safe water.
  - Water murmurs near rocks. A StereoPanner pans the murmur to the rock's side.
  - Thunder sometimes lights the whole river for a moment.
- Hits, hearts, embers, wisps and dawn follow Lantern's rules, because the game imports `../../lantern/sim.js` unchanged.
- Stars per night:
  - 1 star for reaching dawn.
  - +1 for no hits.
  - +1 for ending with 6 or more sparks in the tin.
- Storage keys:
  - `lantern-spark:save` holds `{v:1, best, stars, played}`.
  - `lantern-spark:spark` records that the spark-button pulse is done.
  - `lantern-spark:hint` is the drag hint.

### What the layer writes into Lantern's state

`sim.js` is a pure layer over Lantern's `create` and `step`. It writes into Lantern's state in three places:

- **`s.calm *= config(n).flow` once at start.** Early nights slow the river without adding later moving rocks to night 1. Lateral steering keeps its imported limit.
- **`s.light = 1` before every step.** The lantern's oil never runs out here, so a run never ends `'dark'`.
- **`s.over = 'dawn'` on a short night,** once progress reaches that night's `length`.

The layer has its own random stream for thunder (seed `^0x51ab7e`). It never draws from Lantern's `s.r` or `s.q`. Bot check 2 confirms this: 60 runs with no sparks match plain Lantern at the configured flow step for step.

### Ramp (`config(n)`)

The ladder is Lantern stages 1 to 6. In the oracle runs, pools (stage 8) and gates (stage 11) beat even an oracle planner, so they are left out.

| Night | Lives | River length | Flow multiplier | Firefly row gap | Empty star cells | Thunder mean gap |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 0.50 | 0.75 | 0.55 | 50% | 12 s |
| 2 | 3 | 0.55 | 0.80 | 0.59 | 52% | 15.2 s |
| 3 | 3 | 0.60 | 0.85 | 0.63 | 54% | 18.4 s |
| 4 | 3 | 0.65 | 0.90 | 0.67 | 56% | 21.6 s |
| 5 | 3 | 0.75 | 0.95 | 0.71 | 58% | 24.8 s |
| 6 | 2 | 0.90 | 1.00 | 0.75 | 60% | 28 s |

`calm` remains 3. The flow multiplier scales its 0.88 river pace once at start. Dawn times are **77.30, 75.68, 73.88, 72.00, 72.92, 77.22 s** on nights 1–6.
Night 3 introduces more restless rocks over a shorter river than the original 0.80, with three lives instead of two.

## Initial measurements (`node bots.mjs 100`, 2026-11-24)

These measurements predate the retuning below.

The bots read only what a player could see:

- the afterglow (`view`)
- the star field (idealized: the cue bot gets exact rock-occlusion flags; naturally empty cells are omitted)
- the fireflies
- the faint banks

The careful, clumsy and rhythm bots plan by holding a target for 0.6 s and picking the clearest rollout among the things they have seen.

All 11 checks pass, in 139 s. Dawn rates on night 1 (100 seeds):

| Bot | Dawn | Sparks per run |
|---|---|---|
| blind random | 0% | 0 |
| drift (middle) | 0% | 0 |
| cue (stars + fireflies, no sparks) | 85% | 0 |
| spark every 3 s | 100% | 20.0 |
| spark every 6 s | 35% | 8.3 |
| spark every 12 s | 8% | 3.5 |

Dawn rates on each night:

| Bot | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| careful | 100% | 100% | 100% | 99% | 81% | 75% |
| clumsy (0.2 s reaction, wobble, forgets) | 95% | 94% | 36% | 1% | 0% | 0% |

What these checks show:

- **The four required facts:**
  - The rhythm bot reaches dawn on 100% of night 1 runs.
  - Fewer sparks give fewer dawns (100% > 35% > 8%, each gap more than 2 standard errors).
  - The no-spark cue bot beats blind random (85% vs 0%).
  - Replays are deterministic (check 1).
- **Supporting checks:**
  - Sparks carry more than the cues alone.
  - Fireflies never sit over a rock: 0 of 21,324.
  - The tin bookkeeping is right.
  - The murmur is loud and panned to the right side in 304 of 304 ticks.

### Mutation (`node bots.mjs 100 --mutate`, or `--mutate=flies-anywhere`)

`ring-behind` breaks the spark: the ring lights only things behind the boat.

The run exits 1 with 6 failures:

- **Rhythm bot:** 1% dawn on night 1, at every spark rate.
- **Careful bot:** 87%, 89%, 54%, 25%, 4%, 3% dawn.
- **Clumsy bot:** 0% dawn on every night.
- **Failed checks:** 3, 4, 6, 7a, 7b and 8.
- **Checks still passing:**
  - Checks 1, 2, 5 and 9 to 11, which do not depend on the spark.
  - The cue bot still reaches 84%.

## Initial browser check

Command: `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node check.mjs`.

Engines: WebKit as an iPhone 13 and Chromium as a Pixel 7. Chromium also runs at 360x640 and on desktop.

The check covers:

- **Menu:** targets are at least 48 px and text is at least 14 px.
- **Steering and spark input:**
  - One finger steers.
  - A second finger strikes a spark and does not steer.
  - The first finger keeps steering after the second lifts.
- **Spark button:** it strikes a spark, and its pulse stops after first use.
- **Pause and resume.**
- **A night 1 dawn:** an in-page pilot does this. It plans over the real rocks and sends pointer moves and taps on the spark button.
- **After dawn:**
  - The end card shows, and the save is written.
  - "Again" opens night 2, which ends "Wrecked" with no input.
  - After a reload, night 2 is unlocked.
- **Desktop input:** Enter, Space, a mouse click, blur-pause and P.

Result on 2026-11-24: 3 runs in a row passed on both engines, with 0 page or console errors. Each run took about 30 s on WebKit and about 36 s on Chromium. Screenshots are in `/private/tmp/night-lantern-spark/`.

### Initial default run (`node bots.mjs`, 150 seeds)

All 11 checks pass.

| Bot | Dawn |
|---|---|
| cue | 87% |
| spark every 3 s | 100% |
| spark every 6 s | 36% |
| spark every 12 s | 7% |
| careful, nights 1 to 6 | 100%, 100%, 100%, 99%, 83%, 77% |
| clumsy, nights 1 to 6 | 97%, 93%, 35%, 1%, 0%, 0% |

The run took 1089 s, because other builders' bots were loading the machine.

Check 7b has a thin margin. Careful on night 6 sits 7 points above the 70% floor, about 1.2 standard errors at 100 seeds.

### Second mutant (`--mutate=flies-anywhere`, 100 seeds)

Fireflies sit anywhere on the river. The run exits 1:

- Check 9 fails: 861 of 21,324 fireflies sit over a rock.
- The cue bot falls from 85% to 71%.
- Check 7b also fails: careful on night 6 reaches 69%.

Two kinds of check have no known-bad case: tin bookkeeping (check 10) and murmur (check 11).

## Unverified

- **Sound is not heard by ear.** This covers the murmur's level and pan through the StereoPanner, the thunder, and the firefly chime. Only the numbers (`murmur()`) are tested.
- **No real phone has run this.** Only the Playwright device profiles have.
- **Human play is untested:**
  - whether players can read holes in the stars, or that fireflies mean safe water, without being told
  - whether players notice the second-finger spark at all
- **The pilot cheats.** It plans over the true rocks, so it proves that the page can be finished, not that the game can be read.
- **The check runs at 3x speed.** It uses `?fast=3`, which is for tests only, so timing at 1x is covered only by the bots.
- **The clumsy bot stands in for a beginner.** Nights 4 to 6 may be much easier or much harder for people than it shows.
- **Thunder is untested and unseen.** No check and no screenshot covers the flash or its timing.
- The earlier 360 px hint overlap is fixed; see the dated verification below.

## Initial findings (before retuning)

- **Sparks are nearly optional on night 1.** The no-spark cue bot reaches dawn 85% of the time, against 100% for a spark every 3 s. To make sparks matter more, raise `empty` or the firefly row gap.
- **The tin rarely binds for a bot that sparks often.** The 3 s rhythm bot refills 27.2 and spends 20.0 per run. The 12-spark start constrains only bots that spark more often than every 3 s.
- **The ramp may be steep after night 2.** The clumsy bot drops from 94% to 36% to 1% to 0%.
- **Night 1 is a little short.** It lasts about 57 s, against the 1 to 4 minute rule.

## Open ideas

- Split the cue bot into stars-only and flies-only runs, to see which cue does the work.
- Add an echo sound whose delay matches the distance to the nearest rock.
- Add a thunder-only night with no tin.
- Outside this directory (not done here):
  - a `lab/index.html` entry
  - a `lab/NOTES.md` row
  - the `lantern-spark:hint` key in `kit/check/phone.mjs`
  - adding `lantern-spark:save` to its seed

## 2026-11-24 — Fuel, duration, ramp and phone spacing

### Decisions and changes

- Start with **8 sparks**, down from 12. An ember returns **1 spark**, down from 2. Capacity stays 20. The pickup message reads `REFILL`, so it says `+1 spark`.
- Thin night 1's free cues: empty star cells **20% → 50%**; firefly row gap **0.32 → 0.55** river units. By night 6 those values reach 60% and 0.75.
- Keep night 1's original **0.50 river length**. Multiply the imported calm pace by **0.75** at start. Its actual river pace is 0.66 of the unmodified first night. This gives **77.30 s** to dawn without adding the moving-rock section beyond halfway. Lateral steering keeps its imported limit. The multiplier increases by 0.05 each night to 1.00.
- Use lengths **0.50, 0.55, 0.60, 0.65, 0.75, 0.90**. Give three lives through night 5, then two on night 6. The original ramp removed a life on night 3 while also adding moving rocks and length; those changes now occur separately.
- Use thunder mean gaps **12.0, 15.2, 18.4, 21.6, 24.8, 28.0 s**. The earlier flashes support a player who has emptied the tin. They do not refill it.
- Raise the shared drag hint center **56 → 170 px** above the bottom. A 360×640 probe sampled **159 frames over 2.7 s**: the animated hand and track cleared the 72×72 spark button by **27.08–31.00 px**. Its screenshot was inspected.

### Check changes

- Strengthen rhythm success **80% → more than 95%** and require no-spark cue success **under 40%**. Keep the original two-standard-error ordering checks, 50% clumsy night 1 floor, and 70% careful floor on every night.
- Add a **30 percentage point maximum adjacent clumsy drop**, alongside the original monotonicity tolerance of 4 points and at least 30 points of total decline. The original 58-point night 2→3 drop fails this bound. Thirty points is a ceiling for the measured ramp, not a claim about human difficulty.
- Require dawns in **75–90 s**. Measure successful runs, not the mean duration of successful and wrecked runs.
- Require steady refills below spending, mean ending stock at most **6**, and clumsy mean empty-tin time above **5 s**. Print ending stock, empty-run fraction and empty duration. This checks scarcity from observed consumption rather than assuming a smaller starting tin binds.
- Compare the imported reference river at the configured flow. The equality check still compares boat position, river position and rock count tick for tick over 60 runs.
- Cache candidate-independent geometry in the bot planner. Before/after comparison produced identical event/position/tin traces for **9 runs and 1,226 observations**: seed 7; cue, careful and clumsy; nights 1, 3 and 6. Bot policies, horizons, candidates and scoring are unchanged.
- The browser pilot now seeks visible embers and sparks every 3 s. Its existing requirement of more than 10 pointer-triggered sparks remains. Input probes (including the desktop fixture) run with collision protection so a hit cannot reset the drag anchor between automation calls. A fresh river without that protection is used for the dawn pilot. Startup is observed inside the real Play click event before the opening ring expires.
- Extend browser polling for the longer night from 30 to 60 s and screenshot/action timeout from 30 to 60 s under host load. These are automation deadlines; the simulation's 75–90 s acceptance is separate. The 360 px check measures rendered hint parts and requires at least **16 px** clearance.

The star occlusion query also excludes rocks outside the queried interval plus two grid cells and their collision radius. The bound is wider than the floor/ceil grid and 0.2–0.8-cell jitter can reach. The per-cell occlusion predicate is unchanged. A reference comparison across seeds **1, 7, 19, 101**, all six nights, and both bot and screen intervals produced identical arrays for **7,200 queries / 612,766 cells**. This reduces repeated scans of rocks already far behind the boat.

Input assertions count successful sparks (`used` increases by exactly one) rather than comparing tin snapshots separated by browser calls. An ember can arrive between those calls; stock subtraction and refill arithmetic remain checked independently in bot check 10.

Independent rate cases now run on at most **4 worker threads**. `BOT_WORKERS=1` uses the same `rate()` directly. Each case retains its entire seed loop and summation order; mutation selection is passed explicitly to workers. Direct/parallel comparisons were deep-equal for all **11 metrics** in cue night 1 and clumsy night 3 on seeds 7–8. A separate mutated comparison of rhythm-3 and cue on seed 7 was also deep-equal, with exactly **2 completion callbacks**; rhythm dawn changed from 1 normally to 0 under `ring-behind`. Per-case completion lines show progress while the full suite runs.

The runner uses Node 26 `import.meta.main` for its CLI entry, including a `/tmp` symlink path. Direct entry reported `true`; importing `bots.mjs` did not run the suite. Future scoped measurements can import `rateCases(cases, runs, from, workers)` rather than copying the bot code.

### Final verification

Commands from the repository root:

- `fnm exec --using=26.12.0 node experiments/lab/lantern-spark/bots.mjs`: **exit 0**, all checks passed, **150 seeds (1–150)** per rate case, **870 s** wall time.
- `fnm exec --using=26.12.0 node experiments/lab/lantern-spark/bots.mjs --mutate`: **exit 1**, **6 failed checks**, the same **150 seeds**, **670 s** wall time. Failed gates: 3, 4, 6, 7a, 7b and 8. Mutated rhythm-3 dawn is **3%** at the runner's printed precision; clumsy dawn is 0% on all six nights.
- `fnm exec --using=26.12.0 node experiments/lab/lantern-spark/check.mjs`: **exit 0**. Final runs: WebKit iPhone 13 **61 s** and Chromium Pixel 7 **55 s**, each with **0 page or console errors**. Chromium also passed desktop input and 360×640 layout. The 360 px checked frame had a **31.00 px** hint gap. Menu, play, hint and end screenshots were inspected.
- All four JavaScript/module syntax checks and the scoped `git diff --check` passed.

Wall times above include heavy concurrent host load; they are not a speedup benchmark.

Night 1 dawns:

| Bot | Dawns / 150 | Dawn rate |
|---|---:|---:|
| Blind | 0 | 0% |
| Drift | 0 | 0% |
| Cue, no sparks | 46 | **30.67%** |
| Rhythm, 3 s | 150 | **100%** |
| Rhythm, 6 s | 117 | 78% |
| Rhythm, 12 s | 34 | 22.67% |

Clumsy dawns by night:

| Night | Dawns / 150 | Dawn rate |
|---|---:|---:|
| 1 | 85 | 56.67% |
| 2 | 70 | **46.67%** |
| 3 | 54 | **36.00%** |
| 4 | 45 | 30.00% |
| 5 | 18 | 12.00% |
| 6 | 0 | 0.00% |

The night 2→3 drop is **10.67 percentage points**, against the initial default run's 58 points. The maximum adjacent drop is **18.00 points** (night 4→5). Careful dawn rates at the runner's whole-percent precision are **100%, 99%, 100%, 100%, 99%, 77%**; every night clears the unchanged 70% floor.

Night 1 rhythm-3 means across all 150 runs, rounded to two decimal places:

| Measure | Result |
|---|---:|
| Sparks used | **25.73** |
| Sparks refilled | **21.95** |
| Ending tin | **4.23** |
| Empty-tin duration | **4.03 s** |
| Runs with an empty tin | **48 / 150 (32%)** |
| Dawn time, minimum and maximum | **77.30 s / 77.30 s** |

Clumsy night 1 empties the tin in every run and spends **49.63 s** empty on average. The supply now falls below steady consumption, and 48 steady runs actually run out. Fuel timing is measured separately from the claim that it is interesting for people.

Supporting checks: **0 / 14,144** fireflies over rocks; murmur level/pan correct on **305 / 305** qualifying ticks; tin bookkeeping passed. The mutation leaves those independent checks passing while breaking the spark-dependent gates.

### Shared check gap

The broader shared phone check was attempted during this work. The initial launch could not resolve Playwright until its supplied path was set. On retry, the kit self-test passed on WebKit, then the full run failed Lantern's view-retention check outside this folder and was stopped. Later scoped kit checks passed on Chromium but were inconsistent on WebKit: one timed out at **150 s**; another failed the delayed-hint assertion and six lab-recording assertions. The cause is **unresolved**. No shared files were changed. The Lantern Spark checks on both engines passed independently.

### Material limits

The cue bot receives exact rock-occlusion flags for the remaining star cells. The renderer shows both natural gaps and occluded stars as absent; the bot's perception is idealized. Its dawn rate does not establish human readability. Resource pressure does not establish that people find the timing choices interesting. Real-phone input and sound heard by ear remain unverified. The browser pilot reads true rock geometry and runs at 3× simulation speed.
