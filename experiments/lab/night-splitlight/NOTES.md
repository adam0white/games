# Splitlight

## 2026-11-24 — first exposure

Turn the glass until the missing colours land on the receiver. On the opening plate, red already reaches the receiver while violet reflects inside the prism and leaves through another face. One rightward movement can bring the beams together. The six lamps outside the receiver show which wavelengths it currently catches. The first plate needs all six at once. A coloured receiver on a later plate needs only its own wavelength. An exposed receiver stays lit while the player turns the glass to find the next one.

**Bet.** The sudden change of exit face makes a player stop, back up and deliberately repeat the split. Test with three first-time phone players, sound off, without coaching. The opening fails if any player needs text or takes 60 seconds to expose the first plate. The optical effect fails as a reason to keep playing if fewer than two can reproduce the split on request after plate two. Human results are pending.

### Play and presentation

Six plates open straight onto the instrument. Slide the brass control, tap its track, drag horizontally on the optical bench, or focus the range and use the keyboard. The dial stays where the player leaves it. There is no time limit. The first plate limits the prism's travel to 29.44° across a critical angle; the other five give the dial 128°. A missed receiver discharges, and the player can keep adjusting. The final plate has one receiver for each wavelength.

Nocturne is the default finish. Add `?look=oxide` for the copper finish. Both show the traced paths, including reflections inside the glass. The completed exposure stays on the bench above the next-plate control. Colour, position and the fill of the receiving arc work with the sound muted. Kit tones mark an entering wavelength and a finished exposure.

The page uses kit drag, hint, zoom, pause, screens, audio and save, plus the private feedback button. It stores the highest unlocked plate in `night-splitlight:plate`, the sound setting in `night-splitlight:sound`, and first use in `night-splitlight:hint`. Reload resumes the highest unlocked plate. Each plate uses a fixed seed on the page. Replaying an earlier plate keeps the higher unlock. There is no lab recording.

### Optical rules

The source emits six parallel rays into a convex polygon. Each contact solves Snell's law using refractive indices 1.47, 1.49, 1.52, 1.55, 1.58 and 1.61. The deliberately large dispersion makes the difference visible on a phone. Total internal reflection keeps the ray inside the polygon until it exits another face. The bench cuts each outgoing ray at a circular rail of radius 146. Catching a beam depends on its intersection with that rail. Each receiver needs 0.42 seconds of exposure. A miss drains 1.65 units of partial exposure per second.

The seed perturbs the dial positions used to place the receivers by up to 1.2% of travel. The optical solver places the receivers. The aiming bot reads the visible apertures and ray endpoints, then searches a 201-position dial without access to their authored positions.

### Measurements

The bots ran the page's seed and 48 additional seeds per plate. The moving bot sweeps the full dial in two seconds and rests for one second. The aiming bot pauses as soon as the light fits.

| Plate | Receivers | Aiming clears | Aiming seconds | Moving clears |
| --- | ---: | ---: | ---: | ---: |
| First light | 1 | 49/49 | 1.48 | 49/49 |
| Chromatic pair | 2 | 49/49 | 2.62–2.70 | 0/49 |
| Return path | 2 | 49/49 | 2.93–3.00 | 0/49 |
| Violet edge | 3 | 49/49 | 3.53–3.62 | 0/49 |
| Twin facets | 3 | 49/49 | 4.00–4.07 | 0/49 |
| Full spectrum | 6 | 49/49 | 5.32 | 0/49 |

Aiming cleared 294/294. On all 49 opening seeds, moving straight to 45%, 60%, 79% or 100% of the dial cleared the plate in one move (196/196). Sixty seconds of idle time charged zero receivers. The tests checked 36,036 rays at 1,001 dial positions per plate. Every glass contact lay on a polygon edge and every ray ended on the rail. Independent reference checks cover normal incidence, a 30° ray entering glass from air, and the reflected direction of a 50° ray leaving glass. The tests also cover loss of partial exposure, a wrong wavelength, seed reproducibility and receiver separation.

The ordinary bot run exits 0. The mutation gives all six wavelengths one refractive index. Opening red–violet separation falls from 66.54° to 0.00°. The same physical assertion requires more than 45° and exits 1.

### Run locally

Serve the experiments tree at the site root and open `/lab/night-splitlight/`. The phone check serves its own copy from this checkout, including the shared kit and the real notes script. It looks for Playwright in the directory named by `PLAYWRIGHT` or in `~/code/human-framework/node_modules`. Run from the experiment folder.

```sh
fnm exec --using=26.12.0 node bots.mjs
fnm exec --using=26.12.0 node bots.mjs --mutate
fnm exec --using=26.12.0 node check.mjs
```

### Phone checks

Both profiles passed the folder's headless check. The opening gesture was one trusted touch at 79% of the slider's displayed width, which positioned the native thumb at 81.9% of its travel. Wall time includes the completed exposure remaining visible before the result controls appear.

| Phone profile | First plate, exposure / wall seconds | Second plate, exposure / wall seconds | Oxide first plate, exposure / wall seconds |
| --- | ---: | ---: | ---: |
| WebKit, iPhone 13 | 0.432 / 2.178 | 0.905 / 2.144 | 0.428 / 1.556 |
| Chromium, Pixel 7 | 0.4214 / 7.345 | 1.1653 / 3.063 | 0.4491 / 1.570 |

Both profiles completed plate two with two touches. Both kept the clock, dial and receiver charges fixed during a 600 ms pause. Restart reset the current plate. Reload restored the sound preference and unlock. Both kept plate three unlocked after replaying plate one. The checks observed zero browser errors, external requests, lab requests and lab storage writes.

The initial WebKit navigation allowance of 5 seconds expired on the busy host. The final check gives navigation 30 seconds, polls snapshots from the host and can wake a stalled display by resizing it one pixel before restoring the profile. The under-60-second opening requirement and optical assertions stayed fixed. The game integrates the time the prism actually spends at each angle, including between pointer events. A slow display refresh cannot allocate the previous angle's dwell to a new angle.

A separate Chromium touch run played all six plates in order and exposed all 17 receivers. A second contact during a bench drag left steering with the first finger. A further final-plate run verified the completion control starts a new campaign and reload still restores plate six. The controls fit at 320 × 568 and at 844 × 390.

Fourteen captures in `/private/tmp/night-r4-wild/` were inspected: five per phone profile and four covering the last plate, completion and the two additional viewports. Inspection of the first pass led to a bevel on the glass, six individually responsive lamps on the opening receiver and inline result controls that keep the exposed plate visible.

Unverified: first-time discovery by a person, sustained frame rate and sound on a physical phone, and live serving. The page was tested from the local checkout.

The shared kit self-check passed on Chromium before and after the change. The shared WebKit runner timed out at 150 seconds before and after the change. With the display kept awake via `caffeinate -diu`, the same WebKit command and assertions passed. A separate iPhone 13 run that woke the viewport first also passed all 65 original kit assertions. The experiment's own two-profile check passed without the external display-awake command.

## 2026-11-24 — phone play review

- The tutorial hand stayed in the middle of the viewport after rotation. On Pixel 7 it was 187.80 CSS px right of the landscape dial centre. On iPhone 13 it was 176.17 px right. It now follows the dial in both orientations. A stationary tap on the glass and a mouse hover over the dial leave it visible. The browser check rotates with the hand visible, checks its track against the dial column and verifies that turning the dial dismisses it.
- The iPhone 13 landscape readout split the plate number across 2 lines. Narrower gaps and padding fit it on 1 line on both profiles. The rotated check measures the text rectangles.
- A held Chromium touch reached the right end stop and stayed at 1.000 after reversing by 5% of the canvas width. The drag now resets its reference point at either limit. The same reversal moved the dial to 0.92598. The browser check reverses once from each stop without lifting.
- Pause and restart could leave focus on a hidden button or the document body. Resume, restart and advance now focus the dial. The browser check verifies each transition and turns the dial with one arrow key.

Both fresh profiles cleared all 6 plates and all 17 receivers using the live controls. The opening was a rightward bench drag. Later plates used known receiver positions on the native dial. Chromium used trusted touch throughout. WebKit used trusted mouse for sustained drags and trusted touch taps. Both paused, resumed, restarted and played plate 3 in landscape. Actual navigation away delivered `pagehide` and paused the outgoing game. History return and mid-plate reload restarted the highest unlocked plate at 0.080 dial travel. The final result's replay opened plate 1, and reload restored plate 6.

| Profile | Opening / finale wall s | Frame intervals during plates 2–6 | Median / 95th percentile / max ms |
| --- | ---: | ---: | ---: |
| WebKit iPhone 13 | 1.591 / 3.951 | 897 | 14.0 / 15.0 / 44.0 |
| Chromium Pixel 7 | 1.930 / 4.443 | 612 | 16.7 / 33.4 / 50.1 |

The frame samples include Playwright input and screenshot captures on the same host. Both playthroughs logged zero browser errors. Inspected 52 before-and-after screenshots covering the opening, hint, rotated controls, pause, partial exposures and every result. The images are under `/private/tmp/night-r5-review/`. The updated `check.mjs` exited 0 on both profiles with 0 browser errors, outside requests, lab requests or lab storage writes. Its opening tap cleared in 1.502 s on WebKit and 1.611 s on Chromium. The bots aim successfully on 294/294 runs and check 36,036 rays. The equal-index mutation exits 1, with 0.00° opening separation against the 45° requirement.

Unaided discovery by a new person, app switching on a physical phone, physical-device frame timing and audible sound remain unverified.

## Play recording (2026-11-24)

Records under `night-splitlight` (`kit/lab.js`). One run for each plate: it starts at the first turn of the dial, ends `won` when every receiver is lit (event `plate-exposed` with seconds), and ends `quit` on Restart plate, Replay or any other new plate. Summary: level, receivers lit, receiver count, seconds, highest unlocked plate. The notice is under the instrument, on screen from the first look; the height formulas reserve 60 px more, and in landscape the notice sits above the title. The page sends nothing typed, no names and no room codes. The recording notice and off switch are the kit's own (`kit/lab.js`); the switch is on the pause card. `check.mjs` answers the lab endpoint itself, loads the page with `?labRunSource=agent`, and asserts that a played run sends a run record under the slug with recording on and nothing with the switch off. Not verified: the live endpoint (it refuses these names until the human-framework change lands and deploys). Changed on purpose: the check's lab-storage assertions allow the player id and this page's session id only, and the block on `/kit/lab.js` is gone. Bots: unchanged outcome. `check.mjs`: exit 0 on both profiles.

## 2026-11-24 — bench v2: 18 plates, chord rule, daily bench

The owner's note on this page was "Good but improve". This section records what changed, the numbers before and after, and what was not checked.

### Five weak things, before and after

| # | Weak thing | Before (main) | After |
| --- | --- | --- | --- |
| 1 | Every plate played the same: receivers latched one at a time, so a blind sweep cleared everything | A blind slow sweep (+0.01 every 40 ms, 500 ms pause while a receiver charges) cleared 6 of 6 plates in the browser | Chord rule: every receiver must be fed at the same setting before any charge builds. The same sweep, run in node against `bench.js`, clears 13 of 18 plates. It fails on the four two-control plates 8, 11, 12, 18 and on the moving receiver, 16. A one-control dial still passes through its one answer, so this weakness is only partly fixed. |
| 2 | Difficulty cliff on the last plate | Clumsy bot clear rate 100.0, 99.3, 99.8, 99.0, 99.8, then 34.8% | Lowest plate 85.0%; the largest drop between neighbouring plates is 13.0 points (plate 16 to 17); the planned limit was 15. Full table below. |
| 3 | Thin light | Plate 6 at dial 0.3: saturated canvas pixels 0.49% WebKit, 0.41% Chromium; bright 2.17% / 2.64%; 1.25 px lines; no bloom; one 784 Hz finish tone | Saturated 1.36% and bright 2.75% on both engines. Glow pass, a continuous dispersion fan of 25 wavelengths between the six bands, receivers that bloom while fed, and a finish chord built from the receivers' own colour pitches through `kit/audio.js`. |
| 4 | Layout at small phones | 320x568: canvas 286x318 and the page scrolled 3 px | 320x568: canvas 294x327, no scroll on the bench, daily bench, result card, Turkish result or pause card (checked in `check.mjs`). 390x844: canvas 364x404 before and after; the bench is limited by width there. |
| 5 | Nothing to come back for | 6 plates, no daily, no share, English only | 18 plates, a daily bench with par and a share line, best turns per plate, English and Turkish. |

Frame work in the animation callback during a drag at 390x844: WebKit median 0, p95 1, max 1 ms (the WebKit timer has 1 ms steps); Chromium median 0.3, p95 0.4, max 0.6 ms. Before: WebKit 0 / 1 / 1, Chromium 0.1 / 0.3 / 0.4. The budget is 8 ms.

### Plates and their optics

`bench.js` is a new tracer. It calls `sim.js`'s `transmit` unchanged for every glass face and adds a mirror, a colour filter, a thin lens (slope minus h/f), a transmission grating (sin θm = sin θi + mλ/d, orders −1, 0, 1 unless a plate says otherwise), more than one lamp, and parts that slide. Receivers are placed by tracing a hidden answer, so every plate is solvable by construction.

| Plate | Name | Idea | Controls |
| ---: | --- | --- | ---: |
| 1 | First light | dispersion: white light fans into colours | 1 |
| 2 | Chromatic pair | two colours must land at once (the chord) | 1 |
| 3 | Return path | total internal reflection sends violet out another face | 1 |
| 4 | Violet edge | three colours at one setting | 1 |
| 5 | Twin facets | a four-sided glass picks the exit face | 1 |
| 6 | Critical angle | work at the edge of total internal reflection | 1 |
| 7 | Folded beam | a plane mirror: angle in equals angle out | 1 |
| 8 | Mirror and glass | aim the beam with a mirror, then split it | 2 |
| 9 | Two lamps | two beams through one prism | 1 |
| 10 | Green glass | an absorbing filter passes one band | 1 |
| 11 | Sliding prism | where the beam enters changes the path; slide and turn | 2 |
| 12 | Glass mirror | a right-angle prism used as a mirror by total internal reflection | 2 |
| 13 | Focus | a thin lens bends each ray by its height | 1 |
| 14 | Back to white | a second prism recombines the colours into white | 1 |
| 15 | Ruled glass | a diffraction grating: red bends more than violet, the opposite of a prism | 1 |
| 16 | Wandering eye | a receiver that swings; hold the light where it will be | 1 |
| 17 | Mirror and grating | steer onto a grating, then read its orders | 2 |
| 18 | Full spectrum | three diffraction orders at once | 2 |

Plates 1–6 keep the first version's glass, cut and lamp. Their receivers moved so that one setting feeds all of them (the chord rule). This is a deliberate change to those plates.

### Bots

`bots.mjs` part 1 is the first version's checks, unchanged, run against `sim.js`. Part 2 is new:

- Parity: `bench.js` against `sim.js` on the six original plates, 36,036 rays at 1,001 dial positions; worst point difference 3.93e-12.
- Solver: clears every plate; par equals the control count on every plate.
- Clumsy bot: aims at the answer with a normal error of 0.035 of travel on each control, holds 0.8 s (or one swing period), 12 gestures, 400 trials per plate.

| Plate | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Before % | 100.0 | 99.3 | 99.8 | 99.0 | 99.8 | 34.8 | | | | | | | | | | | | |
| After % | 100.0 | 99.5 | 99.3 | 91.5 | 99.0 | 99.5 | 100.0 | 90.0 | 100.0 | 98.5 | 90.8 | 93.5 | 100.0 | 100.0 | 100.0 | 100.0 | 87.0 | 85.0 |

- Daily bench: 365 days from 2026-11-24, each valid and cleared at par 2. Families mirror 77, slide 87, lamps 100, grating 101. Mean 10.91 generation attempts.
- Mutations: `--mutate` (equal refractive index) and `--mutate=mirror|grating|lens|filter|chord|moving` each exit 1 with an assertion tied to that part.

### Daily bench

`?daily` opens today's bench; `?day=YYYY-MM-DD` opens a given day. The seed is FNV-1a of `splitlight <day>` into mulberry32, so everyone gets the same bench. One of four families (mirror, slide, lamps, grating) is generated and checked: receivers well apart, the answer feeds them all, no knife edge (±0.01 still solves), the start is unsolved, and no single control can solve it. Par is 2. The result card shows turns, par and seconds, and a Share button. Share draws a picture of the bench and offers it with a text line through the Web Share API when the phone can share files; otherwise it hands the text and link to `shareLink` from `kit/room.js` (there is no `kit/share.js`). The link is `?daily&day=<day>`, so whoever opens it gets the same bench. A turn is one gesture, or a run of key presses with gaps of 700 ms or less.

### Storage

Existing keys keep their formats: `night-splitlight:plate` (highest unlocked plate), `:sound`, `:hint`. A saved plate from 1 to 6 loads as before. New keys: `:best` (best turns per plate, JSON), `:daily` (today's result, JSON), `:parts` (the part chips have been used), `:done` (plate 18 finished; read by `experiments/small/marks.js`).

### Small games and words

`catalog.js` marks this page `tr: true`; `marks.js` counts 18 plates and reads `:done`. The page uses `kit/home.js`, so `?from=small` shows the way back on the pause card and the result card. Every new string is in `words.js` in English and Turkish.

### Checks changed on purpose

- `check.mjs` second plate: it now aims at the chord answer. A tap at 0.55 used to win plate 2 and must not under the chord rule.
- `check.mjs` gained `extras` at 320x568: daily bench, par, chips at least 44 px, the chord frequencies, share line, `?from=small` back link, Turkish plate label, no scroll in each state.
- `experiments/kit/check/lab-pages.mjs`: the expected plate label is now "Plate 02 / 18" (was "Plate 02 / 06"), and the seeds add `:best`, `:parts` and `:daily` to prove old and new saves load.

### Correction

The first section says "There is no lab recording." That stopped being true with the play recording section above.

### Checks run (2026-11-24)

- `npm test`: 73 of 73 pass.
- `bots.mjs`: exit 0. `--mutate` and the six named mutations: exit 1.
- `check.mjs`: exit 0 on WebKit iPhone 13 and Chromium Pixel 7, with 0 browser errors, outside requests, lab requests or lab writes.
- `experiments/kit/check/phone.mjs small,lab/night-splitlight`: ok on both browsers, including the hint.
- Screenshots at 390x844 (first plate, mid-turn, result, plate 12 with chips, pause card, plate 18, end card, daily bench, daily result) and the landscape hint were inspected on both engines. They are kept outside the repository.

### Not verified

- Turkish was not read by a native speaker.
- The finish chord and receiver tones were not judged by ear; only the frequencies were checked.
- First-time play by a person, and frame timing on a physical phone.
- The share sheet on a physical phone; the check only sees the line and the link call.
- The kit's back link and the lab notice keep the language the page loaded in after the in-page language switch. That is the kit's behaviour and was not changed here.
- On screens shorter than 700 px in portrait, the result card covers the foot of the bench instead of growing the page.
