# Lantern Tide

## 2026-11-24

A paper lantern crosses the same river as Lantern. The tide moves the boat faster in bright, narrow channels and more slowly in open water. Fast water saves flame. Rounding a rock gives access to the quiet water downstream, where the wick can recover.

Acceptance is a wordless start and drag on both phone profiles, with a first crossing under one minute. Paired seeded policies must show a clear dawn advantage from reading the flow. With the tide off, state must match Lantern at every tick.

The page begins on the water and launches on a canvas touch or the play icon. Relative drag uses the kit at 1.3× travel. A hand cue appears after 1.5 seconds of idle play. The HUD uses a flame meter, hull marks and a dawn gauge. The ink print is the default. `?look=mauve` supplies the second print with the same water geometry. The page uses the kit for save, audio, pause, zoom and screens, and loads the private notes button. Play makes no network requests. The local save keys are `lantern-tide:night` (2 after first dawn), `lantern-tide:sound` (0 or 1) and `lantern-tide:hint` (1 after steering).

### Tide rules

Lantern supplies the seeded river, steering, rocks, collision order, embers and dawn. The tide samples position and time at 60 Hz. It varies forward speed from 1.52× in slack water to 2.72× in the first channel, and up to 3.20× on night 2. Water accelerates around rock shoulders. A lee can drop to 1.04× and replenishes the wick only inside the hull-safe bank and clear of rocks. Moving flecks, the bright channel and downstream rings use the simulated water field. A boat entering a lee gets a bright ring and sparks. The tide run has no ability pickups and starts with three hull lives on night 1 and two on night 2. `?tide=0` takes the original Lantern path, starting at night 1.

The first crossing uses 44 river units, down from 78 in the first pass. At 78 units the opening reader hit rocks at 24.88 s and 30.15 s when its commands arrived 100 and 200 ms late. The full 78 units remain on night 2 for comparing the two policies. The opening duration floor in the bot check changed from 30 s to 15 s to match the shorter course. The under-60-second limit is unchanged. The dawn advantage assertion is on the full river, where both policies have room to separate. The opening adds a requirement to clear with up to 300 ms of injected command delay.

### Bot results

Both policies assess the same banks, rocks and embers within 2.2 units, using drag targets at 10 Hz. The reader also forecasts forward motion from each sampled current and scores the water along each route. The plain policy uses the boat's observed forward speed. The outcome measures both uses of current together.

| Night | Reader dawns | Plain dawns | Reader dawn times | Plain dawn times |
| --- | ---: | ---: | ---: | ---: |
| 1 | 48/48 | 48/48 | 23.67–25.98 s | 27.47–30.43 s |
| 2 | 22/48 | 9/48 | 32.60–37.38 s | 38.88–41.42 s |

On night 2 the reader gained 13 of 48 dawns (27.08 percentage points). It spent 20.41 s on average in water above half the channel strength, against 12.52 s for plain drag. In the field probe, core/slack forward speed was 1.6864/0.9424 river units per second and the flame drained at 0.012/0.220 per second. A clear eddy restored 0.100 flame per second at 1.04× speed. A rock added to its center suppressed the restoration cue.

The opening seed reached dawn in 23.43 s with 3 hull lives, 16 embers, 19.52 s of fast current and 0.093 flame regained from eddies. With 100, 200 and 300 ms of added command delay it finished in 23.27, 22.88 and 22.93 s. The same seeded opening replayed exactly. With the tide off, 63,679 ticks across 16 runs matched Lantern's state. The reversed-burn mutation exited 1 at the “fast water saves flame” assertion.

The fixed night 2 seed reached dawn in 34.53 s with the reader.

### Browser verification

The initial headless `check.mjs` runs wrote PNGs to `/private/tmp/night-r4-tide/`. They checked the icon-only start, animated drag cue, steering, pause and resume, saved sound and progression, dawn, the tide-off launch and private notes. They checked for page errors and outside requests. The crossings fed regular pointer handlers while observing the running game. Chromium used touch drag. WebKit used touch taps and mouse steering.

| Phone profile | Simulated crossing | Wall time | Steering commands | Embers | Hull lives left | Flame regained |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WebKit, iPhone 13 | 23.75 s | 24.43 s | 193 | 18 | 3 | 0.089 |
| Chromium, Pixel 7 | 23.00 s | 23.73 s | 159 | 16 | 1 | 0.086 |

Both profiles passed in the same `check.mjs` run. Inspected openings in both palettes, current and eddies, the drag hint, paused play and the dawn card.

The 150 s shared kit WebKit check timed out during the baseline run, alongside unrelated page timeouts. The experiment's WebKit check uses full-page snapshots to avoid blank or stalled viewport captures on this host. The shared kit self-test passed on Chromium after the change.

No cold human playtest, physical-phone or audible-sound test. The phone browser runs show that level 1 is completable without interacting with written instructions. A stranger's ability to infer the route remains open.

## 2026-11-24 — phone play review

Two clean browser profiles opened the game with no save. A canvas tap launched the boat. A second stationary tap used to mark the steering hint as complete while the boat held its course. The guide now stays eligible after the tap and goes away on a drag. The browser check verifies that the second tap leaves the hint key unset and that steering sets it to `1`.

The portrait title took up too much of the approach to the boat in landscape. The landscape type now scales with height. Both landscape profiles have at least 24 CSS pixels between the bottom of the title box and the centre of the lantern. At 568 × 280 the 64-pixel launch button now ends 12 pixels above the bottom. It previously extended about 5 pixels past the viewport. Rotation during a drag releases the old target and keeps the crossing in progress.

The paused canvas used to issue 2,405 fill operations in 500 ms on WebKit and 1,690 on Chromium in the review sample. It now keeps its last frame, with zero full-canvas fills during a 240 ms pause on each engine. Rotating while paused redraws the canvas at the new size without advancing the simulation. Navigating away from a live crossing pauses it at page exit. A mid-crossing reload starts the unlocked night from its launch screen.

Dawn now saves the unlock on the terminal tick. Previously a reload during the 650 ms arrival animation could lose it. The pause menu can switch between either unlocked night, so replaying the opening keeps the second night available in the same session.

The first WebKit finale attempt hit a rock at 62.25 of 78 river units. The original fixed seed also failed isolated playback with a small input delay. The replacement authored seed clears the same 78-unit course with the same two starting hull lives at all three delays below. A separate probe tested 20 repeatable schedules with input intervals of 5–8 ticks and delays of 0–3 ticks. The original seed cleared 7/20 and the replacement cleared 15/20. The 100 ms delay case is now a regression assertion in `check.mjs`. Restoring seed 3 in memory fails the new assertion with exit 1.

| Fixed delay at 10 Hz | Original seed 3 | Replacement seed 255 |
| ---: | --- | --- |
| 0 ms | Dawn in 34.53 s | Dawn in 34.07 s |
| 50 ms | Rock at 62.32 units | Dawn in 32.58 s |
| 100 ms | Rock at 46.28 units | Dawn in 31.95 s |

Chromium's original check sampled the drag anchor before the browser received the press. A trace after a hit showed target offsets up to 0.143 river units persisting for about a second. Before the driver fix, two Chromium opening runs lost at 41.39 and 32.22 of 44 units. The check now observes the trusted press when it reaches the canvas and uses a fixed 10 Hz simulation schedule. Both profiles wait 10 ms between live polls instead of 35 ms. WebKit keeps its interval-based command schedule. Its finale mouse driver looks 0.675 s ahead instead of 0.540 s and leaves more space around rocks and banks. This finale driver cleared 28/30 jittered trials versus 23/30 with the default bot steering. The one-minute wall and simulation limits stay in place.

The ordinary simulation checks exit 0 with 48/48 opening dawns per policy, 22/48 reader versus 9/48 plain finale dawns, and 63,679 tide-off parity ticks. Mutated burn exits 1 at the fast-water flame assertion.

Both profiles cleared both nights through the live pointer handlers. The browser driver assisted with the route after the opening taps and drags. Chromium used trusted touch drags. WebKit used trusted touch taps and mouse steering. Each profile navigated away and back, reloaded during Night 2, switched between the unlocked nights, completed Dawn, sailed again, lost and retried. Both recorded zero page errors, failed HTTP responses and outside requests.

| Profile | Night | Simulated / wall seconds | Commands | Embers | Hull lives left | Flame regained |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WebKit, iPhone 13 | 1 | 23.53 / 24.24 | 236 | 18 | 3 | 0.105 |
| WebKit, iPhone 13 | 2 | 36.13 / 36.82 | 362 | 15 | 2 | 0.379 |
| Chromium, Pixel 7 | 1 | 23.27 / 23.99 | 232 | 16 | 3 | 0.090 |
| Chromium, Pixel 7 | 2 | 32.27 / 32.98 | 321 | 9 | 2 | 0.210 |

Inspected 12 baseline captures and 22 final captures in `/private/tmp/night-r5-review/lantern-tide/`. The final set shows both prints, the opening and pause in landscape, the short launch viewport, the steering hint, the current, both dawns and the loss card on both profiles. Unaided human route discovery, physical-phone timing and sound by ear remain unverified.

## 2026-11-24 — night 2 pointer timing

Traced eight live night 2 crossings with the wider browser driver margins already applied. WebKit cleared 3/4 and Chromium cleared 1/4. The terminal positions were y=62.785 on WebKit and y=34.091, 58.398 and 58.417 on Chromium. The trace recorded each animation callback, host observation, canvas pointer event and target used by each 60 Hz simulation tick.

| Failed run | Frame gap median / max | Frame intervals with multiple ticks | Command gap median / max | Observed sample-to-move delay median / max |
| --- | ---: | ---: | ---: | ---: |
| WebKit, y=62.785 | 14 / 91 ms | 34/2,099 | 6 / 46 ticks | 4 / 731 ms |
| Chromium, y=58.398 | 33.3 / 50.1 ms | 702/796 | 6 / 26 ticks | 0.5 / 350.1 ms |

The intended command interval was six ticks. Replaying the targets actually consumed by the simulation reproduced all eight outcomes. Replaying the measured sample schedule with immediate, accurate targets cleared 8/8 with 1–2 lives. Applying the observed sample-to-event delays to that replay cleared 7/8. Adding the measured target offsets reproduced the WebKit loss at y=62.785 exactly. Its mouse coordinates were computed against an earlier river centre, so motion between sampling and delivery shifted the applied target. In the Chromium failure at y=58.398, 75/234 sample intervals had no observed pointer move. In one interval just before the first hit at y=40.964, the observed target was still 0.120 river units from the new command. Frame catch-up increased the number of ticks between commands on Chromium. WebKit lost with only 1.6% of intervals advancing multiple ticks. The harness let host polling and pointer delivery determine which targets the simulation consumed.

The widest hull-safe interval was 0.155–0.166 river units at the observed hits near y=40.9 and 0.231 at y=51.428 in the delay replay. These widths measure single cross sections. To test a whole route, the same cautious reader forecast the boat and visible rocks over the input delay using the current and its already-issued targets. The test included the page's target reset on a hit. With commands every six ticks, six launch phases at each of 100, 116.7, 133.3 and 150 ms of delay cleared 24/24 in 36.00–36.97 s, with 16/24 keeping both lives. The same driver without the forecast cleared 5/24. When command intervals varied over five to seven ticks, the forecast cleared 43/48. The forecast gives evidence of a navigable route with those delays. The course and game rules stay as authored.

The browser check holds the clock during the hint, rotation and steering captures so screenshot latency cannot advance the river before the pause key. It delivers trusted touch drags on Chromium and trusted mouse moves on WebKit. It observes a fresh canvas press for each new touch gesture and confirms the game applied each changed target within one CSS pixel of travel before advancing. Requests within that tolerance keep the previous target because pointer coordinates are quantized. The two-second event deadline allows for the 731 ms latency measured under load. Each advancement runs the game's animation callback with a 100 ms frame interval, which must produce exactly six ticks between samples. A negative control with pointer moves suppressed exited 1 when the canvas failed to apply the first changed target.

The first repeat series used the controlled clock on night 2 alone. The first four runs cleared both nights on both engines. In run five, Chromium lost the live opening at y=34.50 before reaching night 2. Both crossings now verify delivery before advancing. The opening paces successive advances at least 100 ms apart in wall time and retains both one-minute limits. Night 2 retains the same limits and advances as soon as the target is confirmed. Its wall time measures the test's input and rendering throughput under the controlled clock. The pause, resume, navigation and retry checks also exercise the native frame clock.
