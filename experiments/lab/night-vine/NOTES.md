# Night Vine

## 2026-11-24 · First glasshouse

The game opens on a potted vine in an engraved glasshouse. A moth flies from the lamp toward the first window. If the player waits, a hand taps the window. The first touch starts growth. A tap places the lamp, dragging moves it, and a quick flick across wood prunes that branch. A successful cut returns the lamp to its previous position. Arrow keys move the lamp. X cuts at the lamp.

The ten beds introduce window, fruit and flower goals. A tendril must catch a marked trellis arm before a bunch can ripen. Ripening needs the lamp nearby. Beds 6, 8 and 10 start with a mature lateral already shading flowers. A flower darkens, droops and shows a stress arc before it wilts. Cutting a fruiting branch costs its bunch. A bud at the cut can grow back. The result appears below the glass so the finished plant stays visible.

The endless arbour has a fresh seed per run, slower extension, successive beds and no timer. Each harvested bed adds one to the score. The device saves the best immediately. The pause card opens the arbour and previously unlocked beds. It also offers two print palettes, Vesper and Cobalt. Vesper is the default.

### Growth and controls

- The pure simulation advances at 30 Hz. Old wood keeps its position. The growing tip turns toward the lamp by at most 0.105 radians per tick. Every 11 units it lays down another internode. A seeded schedule opens lateral buds. Light at the tip controls growth speed. The renderer eases leaf expansion, draws the extending tip between nodes and sways the foliage independently of the simulation.
- An overhead leaf intercepts up to 72% of the light that reaches it. Overlapping leaves compound. Flower stress rises above 38% shade and falls below it. At 38% shade, the footer changes to a pruning cue. A full stress arc ends the bed. Each new fruit needs 1.35 seconds at full illumination after gripping its arm.
- A pruning gesture must travel at least 30 field units in at most 320 ms. The simulation cuts at every stem the stroke crosses and drops all disconnected descendants. On the opening bed, a touch within 36 units of the window places the lamp at its centre.
- Campaign extension has a base rate of 35 units/s. The arbour uses 19 units/s. The board is 360 × 480. The kit supplies pointer ownership, audio, pause, zoom, screens, hint and storage. The page loads the private feedback button. There is no play recorder. The device keys are `night-vine:save` (version, unlocked bed, campaign bed, best, sound and ink) and `night-vine:hint`.

### Seeded bot checks

The tending bot finished **240/240** campaign beds across 24 seeds. The table gives the slowest simulated finish for each bed.

| Bed | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Seconds | 8.00 | 10.00 | 8.13 | 10.70 | 11.60 | 12.07 | 10.27 | 13.80 | 14.97 | 16.20 |

- Holding the lamp at 25 points within a 28 × 28 square around the first window cleared **24/25** within 9.80 s. This tests the raw simulation without the opening touch assist. An untouched simulation stayed on bed 1 for 60 s.
- On beds 6, 8 and 10, the same lamp policy without pruning wilted the flowers **72/72** times. A test flick reduced shade from 0.99 to 0. A separate low cut removed 32 segments, dropped the fruit and released the tendril. The new shoot gripped again, ripened fruit and reached the window at 17.57 s.
- The arbour bot harvested **288/288** beds over 12 successive bed numbers and 24 seeds. Finishes ranged from 14.83 to 33.17 simulated seconds.
- Opposing lamps separated the primary tips by 94.77 units in 2.50 s. Replaying a seed and inputs reproduced the full vine. A different seed changed it. The normal suite exited 0. Reversing the horizontal light response in memory made `--mutate` exit 1 at the opposing-lamps assertion. No acceptance threshold changed.

### Reproduce

Run from the repository root. The phone check finds Playwright through `$PLAYWRIGHT` or `~/code/human-framework/node_modules`, serves the static page locally and writes images to `/private/tmp/night-r6-review/vine/check/`.

```sh
fnm exec --using=26.12.0 node experiments/lab/night-vine/bots.mjs
fnm exec --using=26.12.0 node experiments/lab/night-vine/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/lab/night-vine/check.mjs
```

### Complete campaign through the page

A separate Chromium run used the phone viewport and a virtual browser clock. It opened bed 1 with empty storage and completed all ten built-in campaign seeds through the page controls. It intentionally let bed 6 wilt, replanted it and pruned on the retry. The ten winning simulation times were **8.00, 10.70, 8.13, 11.10, 13.00, 13.30, 11.57, 15.17, 15.40 and 17.90 s**. Completing bed 10 opened the arbour. Reload restored the tenth campaign bed. The loss and final harvest were both inspected.

### Phone checks

Both headless profiles exercised one trusted opening tap, the first harvest, pruning, blur pause, resume, palette and sound settings. The WebKit check used a mouse flick for the cut. Chromium used touch for the cut. Both retained an arbour best of 1 after reload. The shared kit self-test also passed on both profiles before and after implementation.

| Phone profile | Bed 1 wall / sim s | Nodes at window | First fruit / bed 2 win, sim s | Nodes severed by flick | Flower shade before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | 8.984 / 8.000 | 47 | 4.133 / 10.033 | 20 | 0.4932 → 0 |
| Chromium Pixel 7 | 8.960 / 8.000 | 47 | 4.067 / 10.033 | 20 | 0.4713 → 0 |

Each profile reported 0 browser errors, 0 external requests and 0 telemetry requests. The two-profile check exited 0. All 14 phone-check screenshots were inspected. On a separate Chromium opening, the delayed tap cue landed 2.08 CSS pixels from the window centre. An off-centre touch 32 field units to its right completed that bed in 8.00 simulated seconds.

Unaided first-time play by a stranger, physical-phone performance and sound by ear remain unverified.

## 2026-11-24 · First-play review

- The opening explicitly asks for a tap on the lit window. The first fruit bed names the marked trellis arm as the next place to tap. The delayed hand still points at the target.
- A held contact at field coordinates (230, 390) moved the lamp to (12, 425) when the viewport rotated, although the finger stayed still. The game now discards movement and release from a gesture if the glass moves or resizes by more than 1 CSS px. The phone check holds a contact through rotation and through a same-size horizontal shift, then checks the lamp and cut count.
- Opening the bed picker in landscape used 525.53 CSS px of height and put the sound button's bottom at y=512.53 on both profiles. A two-column pause card now uses 318.39 CSS px. The sound button ends at y=334.19 on the 390 px viewport and y=345.19 on the 412 px viewport. All ten bed slots, settings and pause actions fit without scrolling.
- With the private feedback key present, the feedback link covered 15 × 34 CSS px of the iPhone pause button. Moving the link from y=62 to y=8 eliminated the overlap. The header, glass and pause actions cleared the link in both orientations, as did the landscape result button. The window remained tappable.

Fresh-storage play on both browsers used trusted touch taps, trusted Chromium touch drags and trusted WebKit mouse drags. Both runs paused, replanted, reloaded during growth, navigated away and used browser Back, rotated during growth, and recovered from a wilted bed 6. Back navigation and reload in these headless runs replanted the saved bed. A separate check dispatched blur and verified that the game paused. The first complete real-time pass reached the bed 10 harvest and its arbour button on both profiles.

| Profile | Simulated clear seconds, beds 1–10 | Measured animation callbacks | Callback p95 / maximum (ms) | Interval p95 / maximum (ms) |
| --- | --- | ---: | ---: | ---: |
| WebKit iPhone 13 | 8.00, 10.03, 8.13, 10.80, 11.77, 12.27, 10.43, 13.93, 15.00, 16.10 | 9,841 | 1.0 / 15.0 | 15.0 / 137.0 |
| Chromium Pixel 7 | 8.00, 10.17, 8.13, 10.73, 11.70, 12.87, 10.33, 13.93, 15.20, 16.43 | 8,413 | 0.5 / 26.4 | 16.7 / 83.3 |

The timing probe wrapped animation callbacks during the headless review, including screenshot captures and concurrent browser checks. Both campaigns reported zero page errors. All 20 fruit-target orders across the six multi-arm fixed campaign beds also cleared in isolated simulation. The intact bots cleared 240/240 campaign beds and 288/288 arbour beds. The reversed-light mutation exited 1. No acceptance threshold changed.

After the fixes, both profiles cleared all ten beds again. The final bed took 16.23 s on WebKit and 18.33 s on Chromium. WebKit recorded 10,324 callbacks at 1.0 ms p95 and 7.0 ms maximum. Chromium recorded 8,967 at 0.6 ms p95 and 5.5 ms maximum. The p95 callback intervals were 20.0 and 16.8 ms. Maximum intervals were 184.0 and 3,066.5 ms during the concurrent headless runs. An earlier concurrent Chromium run missed a bed 6 flick and timed out. The repeated run cleared beds 6, 8 and 10 with one flick each. The causes of the missed flick and long callback interval remain unresolved.

The updated phone check exited 0 on both profiles. The opening took 8.00 simulated seconds on each, with 8.960 s wall time on WebKit and 14.618 s on Chromium. Bed 2 finished at 10.033 and 10.100 simulated seconds respectively. Each cut detached 25 nodes and brought flower shade from 0.52673 and 0.53549 to zero. Both retained an arbour best of 1 after reload and reported zero browser errors, external requests and telemetry requests.

Screenshots are under `/private/tmp/night-r6-review/vine/`. The reviewed images include the opening and its delayed cue, both orientations, the open bed picker with the feedback link, reload and browser Back, wilt and retry, pruning and the final harvest. Physical-device rotation, OS backgrounding, audio by ear and unaided play by a new person remain unverified.
