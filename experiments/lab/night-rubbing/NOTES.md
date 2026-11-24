# Carbon Cabinet

## 2026-11-24 — Six fossil rubbings

The page opens with a sheet over a scallop. A pencil demonstrates a short sweep. Drag it across the ridges to take an impression. The specimen drawer holds six prints. Each print qualifies for filing once the player has marked enough of its relief and reached its extremities. The player can keep rubbing a filed print, including after closing the page. Graphite and red chalk have the same friction. The pause card switches the material.

**The bet.** A finger can distinguish raised ribs from flat paper through the mark it leaves. Making and keeping a particular impression should be reason enough to open a second plate. Give five first-time players the opening sheet without instructions. The discovery bet fails if fewer than four file the scallop within 60 seconds without reading help. The collection bet fails if fewer than three begin the fern of their own accord. These are proposed human tests.

### Transfer and completion

The simulation rasterizes 1,408 polylines into six 240 × 280 relief fields. The specimen geometry stays fixed. The seed determines the paper tooth at each cell. Pencil travel integrates friction in steps of at most four sheet units. Transfer depends on radial contact pressure, paper tooth, relief height, remaining pigment capacity and the slope facing the moving pencil. Reversing the stroke changes which side of a rib darkens. Lifting the pencil between strokes leaves a gap.

The first build filed a scallop while its hinge was still almost blank. The final score weights total marked ridge area at 40% and the least covered of ten strips at 60%. Five strips divide the width of the specimen and five divide its height. A raised cell counts once its relief is at least 0.34 and pigment reaches 0.36. The six filing thresholds stayed at 70%, 76%, 80%, 82%, 84% and 86%. The contact radius falls from 32 to 22 sheet units. No acceptance threshold was relaxed. A regression test inks 74.71% of the scallop's ridge cells while leaving the hinge bare. That sheet scores 29.88% and stays open.

### Bot results

The sweep policy knows the sheet edges. It varies its spacing and slope by seed without consulting the fossil. Each row below covers eight seeds. Distance is pencil travel in sheet units.

| Plate | Clears | Most strokes | Longest distance | Raised / flat pigment gain | Directional edge gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| Scallop | 8/8 | 12 | 2,431.6 | 16.92× | 37.15% |
| Fern frond | 8/8 | 13 | 2,674.8 | 15.74× | 34.27% |
| Trilobite | 8/8 | 13 | 2,728.8 | 24.08× | 39.55% |
| Ammonite | 8/8 | 12 | 2,539.7 | 17.26× | 43.84% |
| Fish skeleton | 8/8 | 13 | 2,782.8 | 17.44× | 44.60% |
| Dragonfly | 8/8 | 14 | 2,918.0 | 19.21× | 50.08% |

Across 240 stationary taps, pigment change was zero. Repeating 300 short strokes over the centre of the scallop reached a score of 9.80%. Replaying identical strokes and seed reproduced the state exactly. Dividing a 120-unit stroke into 24 events changed total absolute pigment by 1.06–1.49% of the single-stroke deposit. The mutation removes the relief-dependent transfer coefficient in memory. The mutated scallop's directional edge gain falls to 5.03 × 10⁻¹⁰ as a ratio. The direction assertion fails and the process exits 1. The intact suite exits 0.

### Controls and storage

The kit owns pointer capture, first-use help, audio, pause on leaving the page, screens, zoom control and local storage. Arrow keys move the pencil on the focused sheet. The page loads the private feedback button. It has no recorder. A completed plate stores its own seed, pigment bytes, material, travel distance and score in local storage. Quantization preserves which cells crossed the filing threshold. The drawer reopens the player's impression. An unfinished plate starts clean on reload.

### Reproduce

From the repository root, run the following commands. The phone check finds Playwright in the directory named by `PLAYWRIGHT` or in `~/code/human-framework/node_modules`. It starts a local server and headless browsers.

```sh
fnm exec --using=26.12.0 node experiments/lab/night-rubbing/bots.mjs
fnm exec --using=26.12.0 node experiments/lab/night-rubbing/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/lab/night-rubbing/check.mjs
```

### Phone results

The headless check completed all six plates on both profiles. The figures are wall seconds from the start of scripted strokes to the filed print. The first timing includes the partial-print screenshot. Both ran the same fixed sequence of horizontal strokes.

| Profile | Input | Scallop | Fern | Trilobite | Ammonite | Fish | Dragonfly |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | Trusted mouse drag | 3.847 | 1.867 | 2.334 | 1.124 | 0.797 | 0.575 |
| Chromium Pixel 7 | Trusted touch drag | 2.233 | 2.603 | 4.703 | 3.756 | 4.122 | 2.794 |

Both used 11, 12, 13, 12, 13 and 13 strokes respectively. Both exercised a stationary touch, progress during a stroke, pause, resume, restart, mute, the chalk switch, the feedback link and the filed drawer. Four additional strokes on the restored scallop darkened 1,119 of 1,260 sampled hinge pixels on WebKit and 1,092 on Chromium. The maximum difference between the original and restored prints was 1 of 255 per colour channel, including after retouching. Each profile reported zero browser or resource errors, zero unexpected requests and zero recording keys.

All 20 phone screenshots were inspected, including the partial print, pause card, six filed specimens and the retouched hinge on each profile. Screenshots are in `/private/tmp/night-r5-wild/`. The shared kit's own phone checks passed on both profiles before and after the work. The full catalogue was outside this single-folder check. A stranger's unaided completion time, repeat play, physical phone performance and sound by ear remain unverified.
