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

Run from the repository root. The phone check finds Playwright through `$PLAYWRIGHT` or `~/code/human-framework/node_modules`, serves the static page locally and writes images to `/private/tmp/night-r7-vine/check/` (before the promotion: `/private/tmp/night-r6-review/vine/check/`).

```sh
fnm exec --using=26.12.0 node experiments/vine/bots.mjs
fnm exec --using=26.12.0 node experiments/vine/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/vine/check.mjs
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

## 2026-11-24 · Promoted to /vine/

The lab page moved from `experiments/lab/night-vine/` to `experiments/vine/` and is served at `/vine/` as Night Vine. `/lab/night-vine/` is now a small redirect that keeps the query string and hash. The device keys did not change: `night-vine:save` and `night-vine:hint`.

### What changed

- **Teaching without words.** The instruction sentence under the glass and the help sentence on the pause card are gone. The footer shows a short goal label ("To the window", "Ripen the grapes", "Cut the shade") and a row of pictures: one bunch per fruit arm (filled when ripe), an arrow, the window (lit when reached), and the flowers (red when shaded). The pause card shows two picture rows: tap → lamp → vine, and flick → scissors → flower.
- **A moving finger for every rule.** The kit first-time hint still points at the window on bed 1. After that the game draws its own finger on the canvas. The finger comes from `cue(s)` in `sim.js`, a pure function. It taps the next unripe arm after 4 s without input; before the window is reached it taps the window. It draws a flick across a stem after 1 s of flower shade over 0.3. The flick is chosen by `previewCut`, which tries a cut without changing the bed and keeps the smallest cut that clears the shade without losing fruit. Reduced motion shows a still hand. The finger is the game's own, not a new `kit/hint.js` kind, because the kit hint runs once and adding kinds would change a shared file.
- **Turkish.** `words.js` holds en and tr tables for `kit/i18n.js`. A language button sits in the header and on the pause card; `?lang=tr` works. The title is "Gece Asması"; a bed is "Saksı" and the glasshouse "Sera".
- **Recording.** `kit/lab.js` with slug `vine`. There is no menu, so the unstarted bed is the pre-play screen: the notice sits under the goal until the first touch. The toggle is on the pause card. Each bed starts a run with level, endless, seed and language. It ends with the outcome and time, cuts, ripe and arm counts, node count and score. Events: `touch`, `cut` (position, whether it followed the finger, shade), `cue` (kind), `grip`, `ripe`, `window`, `language`.
- **End of bed.** A win sends light from the window and sparkles up the vine for 1.2 s before the result card; bed 10 adds falling petals. A loss dims the glass for 0.85 s, then the result card shows the scissors and "Cut the shade".
- **Layout.** The language button made the header wrap and the page overflowed by 87 px on a 390 px phone. The sprig is now hidden below 440 px, the title does not wrap and the glass has a 208 px height budget. The page height equals the viewport on iPhone 13 and Pixel 7 in both languages. In landscape the Turkish recording notice ended 26 px below the viewport; the left column now puts the header at the top (`grid-template-rows:auto 1fr` instead of `1fr 1fr`) and the goal label is 22 px there.
- **Notice on every unstarted bed.** The recording notice shows under the goal on every bed until its first touch, not only on the first. The game has no menu, so this keeps the notice in front of any bed a player opens from a link or a reload. The notice wording is the kit's (`kit/lab.js` `NOTICE`); the Turkish follows Follow Me's and names the pause card by its title, "Mola".
- **Shared checks.** The phone-check entry moved from `kit/check/lab-pages.mjs` to `kit/check/pages.mjs` under `vine`. `games.json` lists `vine` as fresh.

### Bots (`bots.mjs`, 60 fresh seeds plus the page seed per bed)

- Careful bot (acts on the cue at once): 100% on all ten beds. The 85% wall line was never crossed, so nothing was retuned. All three bots read the same `cue()` the page draws, so these numbers show the finger is enough to win; they are not an independent measure of difficulty. The older campaign line in the same run (24 wins per bed, scripted marks) is independent of the cue.
- Clumsy bot (reads the cue 150 ms late, at most one input per 0.6 s, 15% of inputs wrong: a tap 90 units off or a flick that only moves the lamp): 100, 100, 100, 100, 100, 100, 98, 100, 100, 100%. The check requires 85% on beds 1–3.
- Naive bot (acts only when the page would show the finger, plus 1 s reaction; after a kind of cue has worked once it acts on that kind after 1 s): 100% on all beds. On the page seeds in order it reached bed 10 of 10 with one try per bed. With the tap cue delayed to 400 s it scored 0% and the reach check failed, so the check depends on the finger.
- Time to wilt with no cut: bed 6 8.03 s, bed 8 8.23 s, bed 10 8.63 s.
- `--mutate` exits 1.

### Page checks

- `check.mjs` passed on WebKit iPhone 13 and Chromium Pixel 7. It now intercepts the lab endpoint and never reaches it. It checks: nothing is sent before bed 1 ends; after bed 1 one `run` record for `vine` with outcome won, level 1 and a `window` event; the tap finger points at arm 0 on bed 2 after idling; a flick along the shown flick cue on bed 3 clears the shade (0.497 → 0 on WebKit); after the toggle is switched off nothing is sent and only `hf-lab-recording-off` remains. A Turkish run opens `/lab/night-vine/?lang=tr`, follows the redirect, and finds no English on the opening, the pause card with the bed picker open, and the first result; the language button switches back to English and sets `?lang=en`.
- `kit/check/phone.mjs vine` passed on WebKit and Chromium.
- A separate throwaway run (`/private/tmp/night-r7-vine/extra.mjs`, outside the repo) on both profiles and in both languages: bed 6 with no cut wilted at 8.03 s, the loss card showed "The flowers wilted" / "Çiçekler soldu" and its button replanted bed 6; bed 10, played by following only the page's finger (5 inputs, 1 cut), was won at 25.97 s on WebKit and 26.23–26.30 s on Chromium, showed "The glasshouse blooms" / "Sera çiçek açtı", and its button opened the endless arbour. In landscape before the first touch and on the pause card with the bed picker open, every button, the goal and the notice were inside the viewport and nothing scrolled. No English on the Turkish loss, final and landscape pause cards. Zero page errors; nothing reached the lab endpoint.
- Screenshots looked at. English: opening, tap cue, flick cue, landscape board, landscape pause card, results, loss and win beats. Turkish: opening (both profiles), portrait pause card, first result, landscape opening, landscape pause card, loss card, final card. Not captured in Turkish: the tap and flick cues (the finger has no words).

### Not verified

- `words.js` and `experiments/lab/night-vine/index.html` are new, untracked files. They must be added with the move, or `/vine/` fails at import and the old address stops redirecting.

- No person has played this version, and no native Turkish speaker has read the Turkish.
- Real phones, audio by ear, and the real flick classifier (30 units in 320 ms): the bots act on the simulation, not through the page's gesture code.
- Bed 6 leaves about 8 s before the first wilt. A first-time player may need a retry there; the bots cannot show that.
- The naive bot assumes a person copies a shown flick within 1 s.
- Production recording: the server accepts only listed games. `vine` must be added to `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts` and deployed; until then every send is refused.

## 2026-11-24 — Music (kit/music.js)

The owner moved Lantern's music into the kit for this game. Night Vine now has a score made in code that the gardener plays.

**Preset: `flute`.** The kit describes it as "a garden": slow attack, a small vibrato, 80 a minute, key of G. Night Vine is a night glasshouse, so the score starts in minor chords and turns major once four fifths of the bed's steps are done (`turn` 0.8), as the window comes into reach. No kit change; the preset is used as it is (`song.js`, `SONG`).

**Mapping (`song.js`; the page and `bots.mjs` both import it; `sim.js` is unchanged and never calls it):**
- progress: the bed's own steps (tendrils caught, bunches ripe, the window) out of all of them (2 × arms + 1).
- danger: the most stressed flower (0 to 1); the heartbeat starts above 0.15.
- light: 1 − that stress; the thin high note sounds when a flower is about to wilt (stress above 0.72).
- Notes: a tendril catching an eye, a bunch ripening, the window reached, and a cut that takes wood each play the next note of the bed's tune. These steps had no sound before, so with Music off they stay silent; the cut keeps its own snip sound either way.
- A miss: a cut that drops a held tendril (and its bunch) plays no note, and the streak ends (`miss()`).
- A blow: a wilted flower (`hit()`); the bed ends there.
- `on`: Music on, Sound on, the bed in play, started and growing, not paused. Each bed starts its own tune from its seed when the song first hears it.
- Measured rates (scratch script, the finger-following gardener, 100 beds, 19.2 minutes): tendrils 8.3, bunches 8.3, windows 5.2, cuts 2.3 a minute; a bed takes about 11 s, so about four or five notes a bed. This is a sparse melody, by design: a note is something the gardener did.

**Switch.** "Music on / Music off" (Turkish "Müzik açık / Müzik kapalı") on the pause card's settings row, between Sound and the language button. Its own key `night-vine:music`, `'0'` when off; on when the key is missing. The save `night-vine:save` is unchanged. On the 390 px card the four settings buttons wrap to two lines each (screenshot looked at); Turkish passes `check.mjs`'s overflow check.

**Levels** (rendered offline in headless Chromium, peaks of the score alone at volume 1, after a 6 s fade-in): bed peak 0.154, RMS 0.024; one melody note 0.083; heartbeat at full danger 0.165; the kit's worst case 0.292. The game's own sounds (the kit's tone peak is its volume): first touch 0.035, cut noise about 0.040 peak (rendered), wilt 0.06, win 0.085 + 0.045. Criterion written before choosing: (1) bed RMS at most a quarter of the quietest regular sound (0.035); (2) a melody note within half to twice the first-touch tone, the nearest in-play tone (the steps had none); (3) worst case plus the loudest sound under 0.9. Volume 0.3: bed RMS 0.0073 (≤ 0.0088), bed peak 0.046, a melody note 0.025 (in 0.018 to 0.07), worst case 0.088 + 0.13 = 0.22. When the tune's queue is full (four notes waiting) a chord pitch plays at 0.03 instead.

**Checks.**
- `node bots.mjs music`: 240 beds (10 beds × 6 seeds × 4 gardeners: finger-following, a quarter of inputs random, three fifths random, lamp left on the window with no cuts), 130 minutes: 1139 tune notes (8.8 a minute; the random gardeners make long beds), 176 with no note (four waiting), 173 dropped tendrils (missed notes), 18 wilts (blows), 827 heartbeat pulses, 18 high notes; latest note 275 ms after its moment; 0 failures. Claims: one note for each step and cut and none otherwise; a dropped tendril plays no note and is a miss; a wilt is a blow; every note on the grid, in its chord and in the tune's order (`kit/check/music-claims.mjs`); heartbeat only above 0.15 stress, high note only with a flower about to wilt; major chords only past four fifths; a twin bed with no music ends identical (JSON equal).
- `node bots.mjs music --mutate` exits 1: a cut that drops a tendril still playing (270 failures) and notes on a clock (15277 failures) are both caught.
- `node bots.mjs` exits 0 (the music claims now run at its end too); `node bots.mjs --mutate` still fails as before (exit 1, "tips bend toward opposing lamps").
- `phone.mjs vine` passes on WebKit iPhone 13 and Chromium Pixel 7 (both sections): Music on at first, the score scheduling during a bed, the switch off on the pause card saved as `'0'`, nothing scheduled after resuming with it off, off kept after a reload; old saves kept.
- `check.mjs` passes on both phones (English and Turkish).

**Not verified.** Nobody has listened; all of this was measured, not heard. Things to listen for: whether a note on each tendril, bunch and window feels like the gardener playing (or like random chimes); whether a cut's note sits well on top of the snip; whether the heartbeat under a shaded flower helps or nags (it starts early, at 0.15 stress); whether the high note before a wilt is noticed; whether the flute's vibrato is pleasant on a phone speaker; whether the music at 0.3 hides the first-touch tone. The music is quiet on purpose; a phone speaker may lose the bass.
