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

`check.mjs` runs headless and writes PNGs to `/private/tmp/night-r4-tide/`. It checks the icon-only start, animated drag cue, steering, pause and resume, saved sound and progression, dawn, the tide-off launch and private notes. It checks for page errors and outside requests. The crossings feed regular pointer handlers while observing the running game. Chromium uses touch drag. WebKit uses touch taps and mouse steering.

| Phone profile | Simulated crossing | Wall time | Steering commands | Embers | Hull lives left | Flame regained |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WebKit, iPhone 13 | 23.75 s | 24.43 s | 193 | 18 | 3 | 0.089 |
| Chromium, Pixel 7 | 23.00 s | 23.73 s | 159 | 16 | 1 | 0.086 |

Both profiles passed in the same `check.mjs` run. Inspected openings in both palettes, current and eddies, the drag hint, paused play and the dawn card.

The 150 s shared kit WebKit check timed out during the baseline run, alongside unrelated page timeouts. The experiment's WebKit check uses full-page snapshots to avoid blank or stalled viewport captures on this host. The shared kit self-test passed on Chromium after the change.

No cold human playtest, physical-phone or audible-sound test. The phone browser runs show that level 1 is completable without interacting with written instructions. A stranger's ability to infer the route remains open.
