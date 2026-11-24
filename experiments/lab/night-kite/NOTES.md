# Night Kite

## 2026-11-24 — first evening flight

The page opens with the kite already aloft. A moving mark shows the opening drag from the spool toward the first ring. The clock starts on contact. On the first flight, touching the kite or birds high in the picture keeps the current payout until the finger moves vertically. The same tension moves the kite for either grip. Arrow keys also move the hand and reel.

Ten flights mix three goals. The player flies into a ring of birds, picks up a lantern and lifts it to a rooftop, or holds the kite steady in a marked pocket through a squall. The book in the pause card opens every completed flight and the endless evening. Endless gives each goal 24 seconds at first, falling by 0.53 seconds per completion to a minimum of 10 seconds. Landing banks the current score. A new best is saved as soon as it is earned.

### Flight and artwork

- The pure simulation advances at 60 Hz. A seeded field varies across position and time. The kite moves and banks in the vertical plane. The prevailing horizontal wind goes into the screen. Crosswind and thermal updrafts move the field's visible leaves. Aerodynamic lift acts perpendicular to relative air velocity, drag acts downwind, gravity acts downward, and a stretched line pulls the kite toward the moving hand. Slack line exerts zero tension.
- Pulling down reels in up to 78 world units per second. Easing up pays out up to 108. The 360 × 520 flight plane uses a spring and damper for line compliance. Reworking the lift model changed the overload threshold from 1,150 to 2,000 force units and the maximum reel-in rate from 132 to 78. This keeps a normal change in reel direction from breaking the line under the revised loads. The overload must persist for 0.65 seconds. Bot acceptance thresholds stayed in force.
- The campaign lanterns start at heights between y=347 and y=356. A carrying kite bears an extra downward load of 45 and must arrive at the rooftop at (180, 300) at 64 units per second or slower. A squall needs 2.1 seconds of steady flight inside the pocket. Progress drains when the kite leaves. Accumulated exposure beyond the shelter can end the flight.
- The wind field drives the grass, leaves and cloud streaks. The print has two ink palettes, indigo and copper, selectable on the pause card. Rain and a progress arc mark a squall. The lantern hangs beneath the kite after pickup. The bird ring scatters before the result card opens. The idle scene redraws at up to 24 frames per second. Physics always uses the same 60 Hz tick.
- Shared kit modules handle pointer ownership, save, audio, pause, zoom, screens and the first-use hint. The page loads the private feedback button. It stores a version, selected and unlocked flight numbers, endless best, ink and sound in `night-kite:save`. The kit hint has its own `night-kite:hint` key. There is no play recorder.

### Bot results

The scripted spool-to-ring gesture on the opening seed won in **77 ticks (1.28 s)**. An untouched simulated kite stayed aloft for **120 s** with **0** rings. A sensitivity check held the endpoint at 25 positions spanning ±20 horizontally and ±32 vertically. **21/25** reached the opening ring within 10 seconds. The slowest of those took **7.70 s**.

| Flight | Goals | Clears / seeds | Slowest (simulated s) |
| ---: | --- | ---: | ---: |
| 1 | Ring | 10/10 | 1.83 |
| 2 | Two rings | 10/10 | 6.60 |
| 3 | Lantern | 10/10 | 2.72 |
| 4 | Three rings | 10/10 | 9.52 |
| 5 | Squall | 10/10 | 3.23 |
| 6 | Lantern, ring | 10/10 | 8.57 |
| 7 | Ring, squall | 10/10 | 9.45 |
| 8 | Two lanterns | 10/10 | 7.53 |
| 9 | Squall, two rings | 10/10 | 10.65 |
| 10 | Ring, lantern, squall, ring | 10/10 | 14.92 |

The bot also cleared all 10 built-in campaign seeds. Its final flight took 15.05 seconds.

The endless bot completed **12 successive goals on each of 10 seeds**, scoring **2,207–2,281**. Replaying the same seed and control policy reproduced the end state exactly. The checks also exercise lift and drag directions, zero relative wind, lantern pickup without delivery, loss of squall progress, squall exposure and an expired endless goal. The mutation reverses the horizontal tether force in memory. The ordinary bot run exits 0. The mutated run exits 1 at the opening-ring assertion.

### Reproduce

Run from the repository root. The phone check resolves Playwright from `$PLAYWRIGHT` or `~/code/human-framework/node_modules` and starts its own local server. Images go under `/private/tmp/night-r4-new3/`.

```sh
fnm exec --using=26.12.0 node experiments/lab/night-kite/bots.mjs
fnm exec --using=26.12.0 node experiments/lab/night-kite/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/lab/night-kite/check.mjs
```

### Phone results

The default headless check exited 0 for both phone profiles. Each opened straight into flight, waited idle for 3.2 seconds with a stationary simulation clock, finished flight 1 with a drag, then retried and finished by touching the bird ring. The four times below measure the gesture through the result card. Wall time includes the arrival animation and browser automation.

| Profile | Drag (sim / wall s) | Direct touch (sim / wall s) | Flight 2 / 3 / 4 / 5 (sim s) | Line after easing up / pulling down | Endless best after reload |
| --- | ---: | ---: | --- | ---: | ---: |
| WebKit iPhone 13 | 1.650 / 2.455 | 1.167 / 2.106 | 5.033 / 2.450 / 8.017 / 3.233 | 221.4 / 197.7 | 157 |
| Chromium Pixel 7 | 1.983 / 5.049 | 1.167 / 2.006 | 5.000 / 2.550 / 8.033 / 3.217 | 223.2 / 214.5 | 154 |

The sustained drag used trusted mouse input on WebKit and trusted touch on Chromium. Both used a trusted touch for the direct-ring retry. The tests collected and delivered a lantern, held through a squall, unlocked flight 6, paused and resumed, switched ink and sound, landed an endless flight and reloaded its best. Both reported 0 browser errors, 0 external requests and 0 telemetry requests. Fourteen screenshots were inspected across the two profiles, including the rooftop delivery and squall.

A Chromium touch exposed a result-card bug. A finger still on the field at the end of a flight could activate the newly appeared Next button when lifted. A pointer click on a card now requires the press to have started on that button. The check asserts that releasing the finishing gesture leaves the result open. Idle rendering was reduced to 24 frames per second during investigation of intermittent headless WebKit stalls. The final run used the normal 2D canvas on both engines.

The shared kit self-test passed on both profiles. The broader pre-change catalogue run had WebKit timeouts on existing pages, including Lantern and Ant Promotion, and was stopped. The new page's own check covers its controls and saves. Real-device frame rate, audio by ear and first-time play by a stranger remain unverified.
