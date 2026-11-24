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
