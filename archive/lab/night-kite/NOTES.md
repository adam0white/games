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

Run from the repository root. The phone check resolves Playwright from `$PLAYWRIGHT` or `~/code/human-framework/node_modules` and starts its own local server. Images from this run went under `/private/tmp/night-r4-new3/`.

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

## 2026-11-24 — phone play review

- A stationary tap on the illustrated kite started flight 1 with zero goals and removed the only steering cue. The opening now says “Drag the spool” and keeps the animated path visible until the player moves the captured finger 8 CSS pixels, presses a steering key or clears the goal. The 8-pixel distance lets small movements during a tap preserve the cue. The check taps the kite, reads the unchanged instruction after 0.25 simulated seconds, and clears the flight by dragging from the pictured guide origin (180, 470) to (245, 399). It then retries and clears by tapping the birds.
- The landscape title squeezed Pause to 35.89 × 44 CSS pixels on both phone profiles. At 568 × 320 the page extended to 337 CSS pixels on WebKit and 335 on Chromium. The Flight book's Back button ended at y=354.14 on both. The landscape title now fits on one line at 44 px and Pause retains 44 × 44. Compact landscape puts the pause actions and Flight book controls in columns. The check steers after rotation, requires a 568 × 320 document with no scroll, and verifies the buttons, all ten flight targets and the endless Land control fit with 44 × 44 minimum targets.
- Both clean profiles played through all ten flights and 21 goals, including every delivery and squall, then entered endless from both the final receipt and the Flight book. Both paused, returned from a background lifecycle event, navigated away and back, reloaded during flight 2 and retained a best of 152 after landing and reloading. A separate navigation probe observed trusted `pagehide` with the flight paused at 0.283 s on WebKit and 0.317 s on Chromium. Back opened the saved flight. The lifecycle check also simulates hiding the document because a second headless test tab leaves the first tab visible on this host.

| Phone profile | Opening drag (sim / wall s) | Opening retry tap (sim / wall s) | Flights 2–10 (sim s) | Animation-frame interval p95 | Intervals above 34 ms |
| --- | ---: | ---: | --- | ---: | ---: |
| WebKit iPhone 13 | 1.317 / 2.087 | 1.167 / 1.924 | 4.917, 2.517, 7.867, 3.233, 8.750, 9.483, 7.600, 9.467, 15.167 | 20.0 ms | 61 / 5,622 |
| Chromium Pixel 7 | 1.283 / 2.113 | 1.167 / 1.945 | 5.033, 2.550, 8.083, 3.217, 8.750, 9.450, 7.633, 9.450, 16.583 | 16.8 ms | 2 / 4,965 |

Frame intervals include the headless browser, result transitions and captures during the campaign. Both checks exited 0 and observed zero browser errors, external requests and telemetry requests. The opening limit is still 60 wall seconds, and the earlier flights 2–5 keep their 18-second automation budget. Newly covered flights 6–10 get 27 wall seconds to accommodate flight 10's 15–17 simulated seconds and the result animation. The shared kit self-test passed before and after on both engines.

The bot run exited 0, cleared 100/100 seeded campaign flights and all 10 built-in flights, and cleared 12 endless goals on each of 10 seeds. The mutation exited 1 at the opening-ring assertion. The review inspected 34 final captures and six landscape baseline captures in `/private/tmp/night-r5-review/kite/`. Chromium used trusted touch drags. WebKit used trusted mouse drags in the iPhone viewport. Both used trusted touch taps. First-time discovery by an unaided player, frame pacing and sound on physical phones, and live delivery remain unverified.
