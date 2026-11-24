# Night Loaves

## 2026-11-24 · Acceptance

Open directly on the dough. A single pointer can fold and press it, let it proof, shape it, slide it into the oven, draw it out and deliver bread within 60 seconds on the first morning. Compare warm and cool proofing, local deformation and recovery, and pale, golden and burnt pulls. The last loaf can be sold or given away. A gift must earn more. Complete eight mornings, repeat batches in endless and retain its best on this device. Exercise normal controls on both phone profiles. Human discovery needs a first-time playtest.

### The bench

The page opens directly on a floured board. The dotted hand shows the fold on the dough itself. A batch rises on the bench, or faster if moved towards the fire. Tuck its edge and slide the peel into the oven. The ember field sets the browning rate at each position. A pale batch can go back in. A burnt batch ends the morning. The paying neighbour shows a coin. On the final loaf a latecomer arrives with open hands. The final handoff stays visible for 0.85 seconds before the receipt.

Eight mornings change the dough's elasticity, yeast rate, work required, fire and yield. Mornings 1–3 make two loaves, 4–6 make three, and 7–8 make four. Endless morning starts from the pause card or the eighth morning's receipt. Each new four-loaf batch has a fresh seed. Each successful handoff updates the endless run's points and, if higher, the device best. The pause card allows replaying unlocked mornings.

The original illustrations are drawn in canvas. The indigo window is the default. Append `?look=mulberry` for the alternate glaze and dawn light. The static scene is cached. The loaf contour, proof bubbles, flour, fire, hand guides and neighbours draw during play.

### Simulation measurements

The rules use 28 rim particles, local shape-memory springs and position constraints between first and second neighbours. The simulation ticks at 60 Hz. The fold compresses the held rim and moves dough sideways. Flour scatters along the stroke. Rest warmth raises the gas fraction and the resting area over seconds. Browning starts on insertion. The serviceable range is 0.66 to below 1.13. A sweet spot within 0.13 of 0.82 adds two points to every loaf. A regular handoff pays three, a gift eight. Both branches of the same golden final loaf earned five and ten respectively.

Run `fnm exec --using=26.12.0 node experiments/lab/night-loaves/bots.mjs`. All 40 campaign runs and 15 endless batches finished. Five seeds per row:

| Morning | Loaves | Completion time (simulated seconds) |
| --- | ---: | ---: |
| 1 | 2 | 13.92–14.20 |
| 2 | 2 | 13.68–13.93 |
| 3 | 2 | 12.93–13.17 |
| 4 | 3 | 12.50–12.68 |
| 5 | 3 | 12.57–13.13 |
| 6 | 3 | 11.78–12.28 |
| 7 | 4 | 12.08–12.23 |
| 8 | 4 | 13.03–13.20 |
| Endless batches 1 / 2 / 20 | 4 | 11.68–12.85 / 11.52–12.68 / 11.52–12.68 |

A pressed rim spanned 70.92 board units from 105.88 at rest. Two ticks after release it still spanned 68.80. It settled back to 105.88. An outward pull stretched it to 127.74. The first WebKit fold image exposed an inversion at a stronger displacement. On that earlier solver the 77-unit cross-centre stroke left as little as 15.90% of the projected area and produced 592 intersecting outlines in 1,728 frames. The revised pressure distribution kept at least 78.50% of the area, with zero intersections on those same inputs. The new regression requires at least 65% and zero crossings throughout press, hold and release.

Near the hearth, a stoneground batch finished rising 1.70 seconds after placement. Its clone took 4.30 seconds at the cool end. Projected area grew 1.56× on the warm bench. In two seconds the same bread gained 0.24 browning at the oven centre and 0.20 on the outer shelf. The pale-pull test returned the loaf to the oven and served it at 0.73. Unattended bread burnt at 1.13.

Run the same bots with `--mutate`. A constant heat field makes both proof fractions 0.51 at one second (ordinary 0.55 and 0.30). The ordinary warm-versus-cool assertion rejects this mutation, exit 1. No simulation check threshold was lowered.

### Browser, save and feedback

The kit supplies save, audio, pause, zoom, screens and the first-use drag hint. The deformable contact uses one captured pointer in canvas coordinates. A cancelled touch returns a carried loaf to its pickup point. The shared private feedback button loads from `/notes/button.js`. There is no lab recorder or leaderboard. `night-loaves:save` stores the highest unlocked morning, endless points record and sound preference. The kit uses `night-loaves:hint` for first use. A reload opens the most advanced unlocked campaign morning.

Run `fnm exec --using=26.12.0 node experiments/lab/night-loaves/check.mjs`. It serves the page, kit and feedback script from this checkout. Playwright resolves from `$PLAYWRIGHT` or `~/code/human-framework/node_modules`. Captures from this pass went to `/private/tmp/night-r4-new4/`. The browser check times a complete morning through ordinary controls. A separate replay captures the intermediate gestures so screenshot encoding and transfer do not consume the player's time budget. The original 60-second acceptance threshold is unchanged.

The standalone shared-kit check passed on Chromium before and after the changes. On WebKit the default runner timed out at 150 seconds on this host. The final shared check passed after bringing its blank page to the front, resizing it by one pixel and restoring the iPhone 13 viewport before navigation. The kit source and assertions stayed unchanged. The game's own screenshot call uses a 45-second capture timeout (initially 15 seconds) and wakes a stalled viewport before retrying. This timeout applies only to image capture.

| Final phone profile | Morning 1 wall / simulated seconds | Loaves / points | Endless wall / simulated seconds | Endless loaves / saved best |
| --- | ---: | ---: | ---: | ---: |
| Chromium, Pixel 7 | 26.376 / 23.500 | 2 / 15 | 17.126 / 16.200 | 4 / 25 |
| WebKit, iPhone 13 | 22.951 / 19.717 | 2 / 15 | 19.957 / 19.600 | 4 / 25 |

Both profile runs exited 0. Both unlocked morning 2, served a paid loaf for 5 points and the final gift for 10, started the next endless batch, retained a best of 25 after reload, and recovered from burning a batch. Both reported zero page errors, failed HTTP responses and unexpected requests. Chromium uses trusted touch drags. WebKit uses trusted mouse drags in the phone viewport. Both use touch taps on controls.

Ten final phone screenshots were inspected, five per profile: opening, held fold, loaded hearth, the choice of two hands, and receipt. The held fold stays in one piece. A separate art plate shows the mulberry opening and a four-loaf batch.

A first-time stranger's unaided completion, physical-phone feel and sound by ear remain unverified. Checks served the local folder. No deployment was performed.

## 2026-11-24 · Phone play review

- The morning picker measured 24 CSS pixels high in WebKit. It now measures 44 in both profiles and still uses the native picker.
- Dragging proofing dough to the lower right put its center at (316, 437). The rim, proof meter and following tuck cue were cut off. The same drag now stops at (293, 416) with the rim and meter inside the frame.
- The shape rail showed 5% on opening. It now starts at 0% and fills when the tuck is complete.
- The final-loaf guide pointed to the paying hand for the first second, before the guest appeared. The guide now waits while the footer says “Wait to share”. The existing one-second arrival opens the gift and changes the footer to “Sell or share”. The paid hand remains available during the wait. Across both phone profiles a golden paid loaf earned 5 points and the final gift earned 10.

`check.mjs` asserts all four fixes. The browser check also rotates to landscape, pauses a held pull, and checks reload and browser Back. A trusted `pagehide` event confirms the page enters its pause screen when leaving a partially folded morning. The blur check verifies independently that pausing during a pull returns the bread to its pickup point and freezes the bake.

All 40 campaign and 15 endless bot cases passed. The heat mutation exited 1 at the original heat assertion and produced identical warm/cool proof fractions of 0.51. The existing acceptance thresholds stayed in place.

The standalone check passed with zero page errors, failed responses or unexpected requests in both profiles. Morning 1 took 14.851 wall seconds / 14.633 simulated on WebKit and 19.109 / 17.000 on Chromium. The shared kit self-check also passed in both profiles.

A separate run in each fresh browser played through all eight mornings using the production pointer handlers. Morning 2 was completed in landscape. Each route served 23 loaves for 155 points, completed two endless batches of four loaves each and retained an endless best of 50 on reload. The same run verified that a partially folded batch restarted on reload at the latest unlocked morning.

| Morning | Loaves | Points | WebKit wall s | Chromium wall s |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 15 | 18.813 | 19.653 |
| 2 | 2 | 15 | 19.322 | 20.147 |
| 3 | 2 | 15 | 17.020 | 16.879 |
| 4 | 3 | 20 | 15.105 | 14.911 |
| 5 | 3 | 20 | 12.746 | 13.613 |
| 6 | 3 | 20 | 11.456 | 13.277 |
| 7 | 4 | 25 | 13.784 | 14.322 |
| 8 | 4 | 25 | 16.273 | 17.281 |
| Endless batch 1 | 4 | 25 | 12.641 | 13.775 |
| Endless batch 2 | 4 | 25 | 13.709 | 13.882 |

The active serving scene sampled 60 animation-frame gaps per profile. The median / 95th percentile / maximum gaps were 14.0 / 16.0 / 28.0 ms on WebKit and 16.7 / 16.7 / 16.8 ms on Chromium.

Inspected 26 PNGs across the two profiles, including the fold, hot oven, proof edge, final choice, landscape pause, Morning 8 and endless receipts. Captures are under `/private/tmp/night-r5-review/night-loaves/`. Both profiles used touch taps. Chromium used touch drags and WebKit used mouse drags in the phone viewport. Physical touch on WebKit, physical-phone frame timing, audible sound and unaided human discovery remain unverified.
