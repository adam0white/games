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

## 2026-11-24 — Phone play review

- In landscape the drawer started at y = 438 on both profiles, beyond their 390 and 412 CSS-pixel viewport heights. The sheet now sits alongside the header, progress and drawer. The drawer starts at y = 238.61 on WebKit and 253.22 on Chromium. The visible sheet increased from 206.39 × 240.78 to 257.94 × 300.92 CSS pixels on WebKit and from 205.84 × 240.14 to 274.16 × 319.84 on Chromium. All drawer buttons, the pause controls and the last-plate retry fit at 44 CSS pixels or larger. The shorter retry label keeps its arrow on the same line.
- Rotating with a pointer down compared two coordinates from different layouts. Moving that contact just 2 CSS pixels made a false stroke of 163.01 sheet units on WebKit and 229.30 on Chromium. Rotation now ends the active stroke. The same motion adds 0 units on each profile. A new stroke after rotation darkened only the expected rows around the pencil. The delayed hand is now anchored to the sheet, with a 150 CSS-pixel track down from 198 to fit shorter sheets.
- A stationary first tap dismissed the shared gesture demo and left a generic progress label. The status now says “Rub across the fossil” until the first stroke. The pause copy points to the pale tips. Sound and material switches keep keyboard focus, and Resume returns it to the sheet.
- Both runs paused on navigation away, restored the completed sixth plate on return, and accepted another stroke of 154.04 sheet units on WebKit and 154.26 on Chromium. Reloading a partially rubbed plate kept its plate selection and started the unfinished sheet clean. Retry also cleared the incomplete sheet.

An independent run started with empty storage and used broad diagonal sweeps on all six plates. WebKit used touch taps and trusted mouse drags. Chromium used touch for both. The six plates took 11, 12, 13, 11, 13 and 13 strokes on each profile. This is input replay with browser events. A first-time player's time and decision to keep playing remain unverified.

| Profile | Wall seconds by plate | Animation callbacks, p95 / max | Pointer events, p95 / max |
| --- | --- | --- | --- |
| WebKit | 4.165, 1.565, 5.343, 8.691, 7.844, 4.237 | 432, 1.0 / 5.0 ms | 819, 1.0 / 8.0 ms |
| Chromium | 7.529, 7.497, 6.813, 5.815, 9.582, 8.790 | 753, 1.7 / 2.8 ms | 819, 0.5 / 12.2 ms |

The timings cover callback and event-handler work in headless browsers. Frame delivery on physical phones and sound by ear remain unverified. The bots cleared 48/48 cases and exited 0. The mutation exited 1 at the original directional pencil test. The 36 fresh-profile captures were inspected and are under `/private/tmp/night-r6-review/rubbing/after/`.

The final `check.mjs` runs exited 0 on each profile. Both filed all six plates in 11, 12, 13, 12, 13 and 13 strokes. Opening and final plate times were 4.674 and 4.380 s on WebKit and 10.081 and 4.810 s on Chromium. Both reported zero browser errors and zero unexpected requests. All restored prints were within 1 of 255 per RGB channel. One WebKit opening screenshot timed out during concurrent runs. The profile-only retry passed with the existing 8 s timeout. The final checks captured 34 images under `/private/tmp/night-r6-review/rubbing/final-check/`.

## Play recording (2026-11-24)

Records under `night-rubbing` (`kit/lab.js`). One run for each plate the player starts to rub: it starts at the first stroke that moves the paper, ends `won` when the plate fills (event `plate-filed` with level and ink), and ends `quit` when the player picks another plate or restarts one. The summary has level, coverage percent, distance and plates unlocked. The notice sits under the specimen drawer, on screen from the first look, because this page has no menu card. The page sends nothing typed, no names and no room codes. The recording notice and off switch are the kit's own (`kit/lab.js`); the switch is on the pause card. `check.mjs` answers the lab endpoint itself, loads the page with `?labRunSource=agent`, and asserts that a played run sends a run record under the slug with recording on and nothing with the switch off. Not verified: the live endpoint (it refuses these names until the human-framework change lands and deploys). Changed on purpose: the check used to require that no `hf-lab-` key exists; it now allows the lab client's player id, because the page now records. Bots: unchanged outcome (exit 0; every plate cleared 8/8 within 12 to 14 strokes, exact replay verified). `check.mjs`: exit 0 on WebKit iPhone 13 and Chromium Pixel 7.

## 2026-11-25 — the way back to the small games home

Opened from `/small/` (`?from=small`), the page shows "‹ Small games" on the pause card and under the title, through `kit/home.js`. The page has no menu or end card, and the status row where Next plate appears is too narrow for a second control, so the title is where the way back stays in sight. A filed print is reported to the home as a win. The page is in English only, so the link is English even for a Turkish browser (`lang: () => 'en'`). `check.mjs` asserts the two links. The home now also counts the sixth print as filed (from `night-rubbing:proof:6`, read only). Same keys, same records.
The check serves only the files it allows; `kit/home.js` is added to that list (on purpose: the page now loads it).

## 2026-11-25 — Deeper: twelve plates, the stick, glaze, grit, stars, a daily plate, Turkish

The owner's decision (2026-11-25): keep it for now, though it is too basic. This change adds depth from the existing rule (pigment goes where the paper presses on a ridge, and the stroke direction decides which flank darkens).

### Why it read as basic (played before any change, WebKit iPhone 13 and Chromium Pixel 7, cleared save)

1. One verb, one plan: sweep back and forth over the whole sheet. The same blind sweep filed all six plates, 48 of 48 in the bots.
2. No cost and no fail: rubbing bare paper costs nothing, so there was nothing to plan.
3. No skill ceiling: a plate is filed or not; no score, no reason to rub a filed plate again.
4. The one interesting rule (direction decides the flank) only changed shading; play never asked for it.
5. Nothing to come back for: six plates, no daily, no share, English only.

### What changed

- Plates 7 to 12 (`plates.js`): young ammonite, crinoid stem, brittle star, sea urchin, horseshoe crab, feather. Plates 1 to 6 are unchanged.
- The stick (from plate 7): each plate has a stick length. Rubbing bare paper wears it down too. If it runs out before the print is filed, the sheet is spoiled ("The stick wore out", Try again). A meter on the sheet shows what is left.
- Glaze (plates 8, 10, 12): contact is `GLAZE_BITE · (stroke direction · slope)` only, so a stroke marks only the flank it moves towards. A line has to be rubbed across, both ways.
- Grit (plates 9, 11, 12): grey pebbles round the fossil (`stoneField` in `sim.js`, with a clear pocket round the specimen). Each grit cell the stick darkens counts as a smudge; more than 48 spoils the sheet. A smudge meter shows the count.
- Stars: three for a print filed within par, two within a quarter over par, one otherwise. Plates 1 to 6 have a par too, so the first plates now have a reason to be rubbed again. Best stars per plate show in the drawer.
- Par and stick come from a careful rubber (`plan.js`): par is its distance plus a quarter, the stick twice its distance, both rounded up to tens. `bots.mjs` fails if the numbers in `plates.js` drift from that rule.
- Daily plate (the button with today's date): the UTC date picks a specimen, a way (stick, glaze or grit) and a mirror, the same for everyone. The page computes par and stick with the same careful rubber. `?date=YYYY-MM-DD` opens another day. Best stars, distance and tries for the day are kept.
- Share (after a filed print): `kit/share.js` with a picture of the print and a line with the plate, the stars and the share of the stick left.
- Sound and motion: `kit/music.js` (flute, quiet; brighter as the print fills, tense when the stick is low) and `kit/fx.js` cues for each tenth filled, past par, stick low, smudge, filed, spoiled, daily, next and share.
- English and Turkish for every string (`words.js`, `kit/i18n.js`). The name stays "Carbon Cabinet" in both. The way back to the small games home is now in the page's language ("‹ Küçük oyunlar").
- The first plate is the same as on main and still teaches without words: the pencil demo, then the kit hand.
- The plate label stays on one line; a long taxon name is cut with an ellipsis (the sheet canvas covers a second line). Worst case seen: plate 12, three stars, "Archaeopt…".

### Saves

`night-rubbing:save` keeps its format and still holds plates 1 to 6 (level and unlocked are clamped to 6 there, so the page on main can read it). New keys: `night-rubbing:more` `{v:1, level, unlocked}` for plates 7 to 12, `night-rubbing:stars` `{v:1, best:{plate:stars}}`, `night-rubbing:daily` `{v:1, day, stars, distance, tries}`. Proofs stay at `night-rubbing:proof:<n>` (also for 7 to 12; none for the daily plate). An old save with plate 6 filed opens with plate 7 unlocked. `check.mjs` loads a save written in the old format and checks this.

### Play recording

Same slug and records (`kit/lab.js`). Runs now end `won`, `lost` (a spoiled sheet) or `quit`. The summary adds kind, stars, stick used, smudges and the day for a daily plate. New events: `plate-filed` (with stars and day), `plate-spoiled` (why), `shared`.

### Bot results (`bots.mjs`, exit 0, about 8.5 s)

The original claims for plates 1 to 6 are unchanged and pass. Parity: plates 1 to 6 give the same pigment bit for bit as on main (12 runs of 400 strokes). Strategies: naive is the old sweep unchanged; rows trims sweeps to the fossil; hatch cross-hatches the whole sheet; pocket rows that step round grit; careful plans rows (and columns on glaze) cut to the fossil and broken round grit.

| Plate | Kind | naive | rows | hatch | pocket | careful |
| --- | --- | --- | --- | --- | --- | --- |
| 1–6 | free | 8/8 ★ | 8/8 ★★★ | 8/8 ★ | 8/8 ★★★ | 8/8 ★★★ |
| 7 young ammonite | stick | 0/8 (stick) | 8/8 ★★★ | 8/8 ★★ | 8/8 ★★★ | 8/8 ★★★ |
| 8 crinoid | glaze | 0/8 (stick) | 0/8 | 8/8 ★★★ | 0/8 | 8/8 ★★★ |
| 9 brittle star | grit | 0/8 (smudge) | 0/8 (smudge) | 0/8 (smudge) | 8/8 ★★★ | 8/8 ★★★ |
| 10 urchin | glaze | 0/8 (stick) | 0/8 | 8/8 ★★★ | 0/8 | 8/8 ★★★ |
| 11 horseshoe crab | grit | 0/8 (smudge) | 0/8 (smudge) | 0/8 (smudge) | 8/8 ★★★ | 8/8 ★★★ |
| 12 feather | glaze and grit | 0/8 (smudge) | 0/8 | 8/8 ★★★ | 0/8 | 8/8 ★★★ |

Filed count over eight papers; stars on the plate's own paper. Before this change the naive sweep filed 48/48 with no score. Now it scores one star on plates 1 to 6 and files none of plates 7 to 12; the careful rubber files all 96 with three stars, using 50% of the stick and about 80% of par on its own paper. Daily: all 72 specimen, way and mirror combinations are filed by the careful rubber; over 60 days the careful rubber gets three stars 60/60 and the old sweep files 0/60.

Mutations, each exits 1: `--mutate` (no direction in transfer) fails at the original direction claim; `--mutate=glaze` (glaze ignores direction) fails at the par drift check for plate 8; `--mutate=stone` (grit takes no smudges) fails at "rows that cross the grit spoil a stone plate"; `--mutate=lead` (the stick never wears) fails at "the old sweep cannot file plate 7".

### Phone check (`check.mjs`)

New part `deeper()`, on WebKit iPhone 13 and Chromium Pixel 7: an old-format save opens plate 7; the old sweep spoils plate 7 and the careful strokes file it with three stars; share sends one picture; save formats; glaze marks across but hardly along (along 0.004, across 0.042 coverage); plate 9 smudges and spoils; plates 10 to 12 open with their teaching line; the daily plate is filed and kept; Turkish strings and the Turkish home link; run outcomes and the stars event.

Changed on purpose in the existing check: unlocked after plate 6 is now 7, not 6, and seven drawer buttons are enabled; the Turkish home link is "‹ Küçük oyunlar" (it was English only); the allowed files add `kit/fx.js`, `kit/i18n.js`, `kit/music.js`, `kit/share.js`. In `scripts/small-catalog.test.mjs` the "finished" seed for this game now also writes `night-rubbing:more` and twelve proofs, because finished now means twelve plates. The shared `experiments/kit/check/lab-pages.mjs` entry is unchanged and passes (it opens plate 2 in red chalk, English).

### Not verified

- Turkish wording: not read by a native speaker.
- Sound and music by ear.
- Whether a thumb reaches par and stays within the stick and the smudge limit; the careful rubber needs half the stick, a person may need more. The numbers are in `plates.js` and in `rate()` if they need loosening.
- How grit and glaze read on a real phone screen, and the denser two-row drawer under a thumb.
- The live recording endpoint.
- The kit's recording switch on the pause card stays English in Turkish ("Record this play for the game lab"); that string is the kit's, not this page's.

### Reproduce

```
fnm exec --using=26.12.0 node experiments/small/night-rubbing/bots.mjs
fnm exec --using=26.12.0 node experiments/small/night-rubbing/bots.mjs --mutate        # also =glaze, =stone, =lead
PLAYWRIGHT=~/code/human-framework/node_modules fnm exec --using=26.12.0 node experiments/small/night-rubbing/check.mjs webkit   # or chromium
```
The older reproduce commands above still name `experiments/lab/night-rubbing/`; the page moved to `experiments/small/night-rubbing/` on 2026-11-25.
