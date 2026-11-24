# Lantern: Spark

Lab page at `/lab/lantern-spark/`. It does not record play (no lab.js).

## Rules

- The lantern is out. You see the river only where a spark has shown it.
- Steer by dragging (kit `drag.js`). On a keyboard, use the arrows or a/d.
- Strike a spark with the big button at the bottom right, a second-finger tap, a mouse click, or Space.
  - The ring spreads from the boat at 1.6 river units a second, out to 2.3.
  - Each rock, bank stretch and ember the ring passes keeps an afterglow for 2.2 s.
- The tin starts at 12 sparks and holds at most 20.
  - An ember adds 2.
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

`sim.js` is a pure layer over Lantern's `create` and `step`. It writes into Lantern's state in two places only:

- **`s.light = 1` before every step.** The lantern's oil never runs out here, so a run never ends `'dark'`.
- **`s.over = 'dawn'` on a short night,** once progress reaches that night's `length`.

The layer has its own random stream for thunder (seed `^0x51ab7e`). It never draws from Lantern's `s.r` or `s.q`. Bot check 2 confirms this: 60 runs with no sparks match plain Lantern step for step.

### Ramp (`config(n)`)

The ladder is Lantern stages 1 to 6. In the oracle runs, pools (stage 8) and gates (stage 11) beat even an oracle planner, so they are left out.

| Night | Lives | River length | Firefly row gap | Empty star cells | Thunder mean gap |
|---|---|---|---|---|---|
| 1 | 3 | 0.50 | 0.32 | 20% | 14 s |
| 2 | 3 | 0.65 | 0.40 | 25% | 17 s |
| 3 | 2 | 0.80 | 0.48 | 30% | 20 s |
| 4 | 2 | 1 | 0.56 | 35% | 22 s |
| 5 | 1 | 1 | 0.64 | 40% | 25 s |
| 6 | 1 | 1 | 0.72 | 45% | 28 s |

`calm` is 3 on every night, so the river runs 12% slower than Lantern's. Runs last about 57 s on night 1 and 80 to 90 s on nights 4 to 6.

## Bots (`node bots.mjs 100`, 2026-11-24)

The bots read only what a player could see:

- the afterglow (`view`)
- the star field
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

## Browser check

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

### Default run (`node bots.mjs`, 150 seeds, final files)

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
- **At 360 px the first-run drag hint pill touches the spark button.** It looks crowded, but taps still work.

## Findings to weigh (not retuned)

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
