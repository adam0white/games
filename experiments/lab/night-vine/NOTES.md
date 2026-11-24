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

Run from the repository root. The phone check finds Playwright through `$PLAYWRIGHT` or `~/code/human-framework/node_modules`, serves the static page locally and writes images to `/private/tmp/night-r5-new5/`.

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
