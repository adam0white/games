# Follow Me

Steer a mother duck with one thumb and bring her flock to the nest. Each duckling replays the exact positions she swam through, so a crossing has to stay safe until the tail gets through.

The original inspiration was the archived “What the Child Saw,” a game about a small one copying what it saw a grown-up do. Follow Me makes the copied action a route through water.

## Campaign and rules

| Chapter | Levels | Main lessons |
| --- | --- | --- |
| Pond | 1–4 | Hold and move, rescue, turn a corner, collect across the pond |
| Road | 5–8 | Cross between cars, stop on an island, collect on the other side |
| Garden | 9–15 | Slip around a sleeping cat, keep the line out of sticky water |
| River | 16–24 | Folding leaves, fast water, a timed dash, and combinations |

- Each level requires a displayed number of ducklings home. The dash also has a 7.5-second clock. Level clocks and hazards wait for the first steering input.
- A clear earns at least one star. Two stars require everybody home or all but one above the minimum. Three require everybody home with no hits or scares. An unlocked level can be replayed directly from the map.
- Mother speed is 0.28 pond widths per second. Steering aims 70 CSS pixels above the finger. A 60 Hz simulation records the trail, and followers index that trail by delay. Brave, curious, tiny and loud ducklings have 0.42-second gaps. Eager and sleepy gaps are 0.85 and 1.18 times that gap.
- Quack briefly pulls the line together. It uses 35% gaps for 1.4 seconds and recharges in 6 seconds. The Quack button, a second finger, a double tap and Q or Space all work. A hit costs a heart. An initial scare sends a duckling back to wait for a rescue. A second scare hides it for the run.

| Element | Effect on the line |
| --- | --- |
| Cars | Headlights warn before moving across a lane. A car that clears the mother can arrive while her followers cross. |
| Sleeping cat | Approaching wakes it. The circle warns for 1.05 seconds before the pounce, so followers can enter it after the mother has left. |
| Sticky water | The mother can swim through the weed, but any follower entering it scatters. |
| Folding leaves | Contact with the mother starts a 1.55-second warning. The patch folds for the rest of the level and scatters followers. Go around or Quack during the rustle. |
| Current | Adds 0.29 pond widths per second upstream and may push sideways. The line copies the resulting motion. Exit early when the current leads into weeds. |

## Endless tuning

Start with 37 sunlight. Drain starts at one unit per second and increases after 18 seconds by one unit per second for every 36 seconds elapsed. Pads appear every two rows. A pad adds 1, 2, 4, 7, 13, 16 or 19 sunlight for 0 through 6 ducklings. Each scare since the last pad subtracts 4 from that refill, down to a minimum of 1. This gives a reason to time a crossing for the tail even if each scattered duckling can be rescued later. Row speed continues to rise with distance.

The competent bot plans 4.5 seconds ahead for the whole line and quacks when doing so makes the crossing safer. The average bot looks 1.05 seconds ahead for the mother, replans less often and only goes after ducklings within 0.16 pond widths side to side. Each uses the same full simulation and sunlight rules.

| Seed | Competent seconds | Competent points | Average seconds | Average points |
| --- | ---: | ---: | ---: | ---: |
| 101 | 62.9 | 1720 | 50.4 | 550 |
| 202 | 71.0 | 3720 | 41.4 | 290 |
| 303 | 73.8 | 3750 | 50.4 | 700 |
| 404 | 83.1 | 4420 | 41.4 | 210 |
| 505 | 83.1 | 4990 | 59.8 | 1540 |
| 606 | 68.5 | 3170 | 39.5 | 370 |
| 707 | 60.2 | 1600 | 35.7 | 100 |
| 808 | 90.7 | 6330 | 36.3 | 220 |
| 909 | 72.2 | 3560 | 43.2 | 410 |
| 1010 | 66.4 | 3710 | 56.9 | 1460 |
| 1111 | 76.5 | 3740 | 52.0 | 610 |
| 1212 | 65.1 | 1960 | 37.6 | 200 |

| Elapsed seconds | Sunlight drain | Competent alive / 12 | Average alive / 12 |
| ---: | ---: | ---: | ---: |
| 25 | 1.19× | 12 | 12 |
| 50 | 1.89× | 12 | 5 |
| 75 | 2.58× | 4 | 0 |
| 100 | 3.28× | 0 | 0 |

All 24 campaign routes earned three stars, with simulated clear times of 3.3–13.5 seconds. The complete bot suite, including the independent double-log route check and determinism, passed in a measured 4.16 seconds.

## Compatibility and checks

- The `ducklings-save` key and its JSON fields are unchanged. Previous unlocks, stars, scores, sound, home totals, album and tutorial status still load. Old scores and stars stay at their original numbers. The replacement levels and the revised endless economy change what new scores measure.
- The kit hint keeps `hold-and-move` and its existing key. The game keeps `#play`, `#pause`, `#pauseMenu`, and `window.ducklingsState()` with its screen and pause fields. Lab outcomes remain `nest`, `lost-all` and `left`. Insufficient arrivals use the new summary reason `short`. A level preview via `?level=` lets you play that level without unlocking the map.
- `bots.mjs` drives independent waypoints through the fixed-tick simulation. It compares the authored routes against straight steering and idle. Direct steering earns three stars on 7 of 24 levels. Idle rescues none. The suite also checks the folding-leaf crossing with and without a quack, the follower-only weed collision and a dash with its current removed.
- `check.mjs` uses touch PointerEvents in WebKit iPhone 13, Chromium Pixel 7, Chromium 390×664 and Chromium 360×640. It clears the first two levels and a dash, tests a lost dash, opens and replays the map, checks pause and blur, quack, sound, the old save, the shared hint, and lab messages against a local stub. All four profiles passed. The screenshot passes cover opening, active play and the result card. Two review passes improved the route map, restored the opening pond colors, clarified the current badge and showed a car on the first road before steering.
- The shared kit runner has a Ducklings entry and a hint entry. Their selectors and save seed still apply. Add a map assertion to the shared entry to cover the new chapter and level controls. The standalone check exercises both. The shared command passed both Ducklings entries in WebKit and Chromium after the sibling experiment registry caught up.

## Not verified

Real-phone touch and audio, real-phone performance and safe areas, first-time human comprehension, replay appeal, production deployment, and storing records at the live lab endpoint.

## Builder

- A clean-flock star gives players a reason to test a safer route after a clear. Clear cards show the arriving ducklings as a drawn family portrait alongside their names.
- Roll call and the quack echo give different birds distinct peeps and movements. A rescue lights the peep ring, lifts the line in a ripple and plays a rising cheer.
- Endless checkpoints have a visible pad and a dashed crossing line. The sun meter shows when its drain accelerates.
- A future playtest could measure whether a first-time player chooses to detour around the folding leaves or discovers the fast quack crossing.

## Kit candidates

A phone screenshot helper that waits for a rendered frame and writes at CSS-pixel resolution. A negative-frame-delta regression applies to games whose input handler resets the animation clock.
