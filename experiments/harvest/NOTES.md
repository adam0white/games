# Harvest Morning

Served at `/harvest/`. It rebuilds the archived "The Valley" idea as a fresh game; no code was taken from it.

## Files

| File | What it is |
|---|---|
| `index.html` | the page and its cards (menu, fields, paused, end) |
| `main.js` | view, input, sound, save, lab recording, hint |
| `art.js` | everything drawn in code: people, sheaves, cart, crows, hare, whetstone, reason pictures |
| `sim.js` | the rules: pure, fixed step `DT = 1/30`, seeded mulberry32, no `Date.now` or `Math.random` |
| `brain.js` | the careful and clumsy players, used by `bots.mjs` and to steer the finger in `check.mjs` |
| `bots.mjs` | rule tests and balance proof; `--mutate` breaks the pay rule and must fail |
| `check.mjs` | Playwright phone check (WebKit iPhone 13, Chromium Pixel 7, plus 360x640 and desktop) |
| `song.js` | what the music hears: preset and volume, the run's mood, and which events play, miss or thin the tune (2026-11-24) |
| `words.js` | English and Turkish words, so far only the Music switch (2026-11-24) |

## Rules

- Top-down golden field that sways. Hold and move: the farmer walks to the point under the finger. The touch target is 34 px above the finger, so the thumb does not hide the farmer.
- Standing wheat near the scythe is cut and lies as a sheaf. Walking over sheaves picks them up, up to 3 (6 with Grandma hired). Walking to the cart in the lane below unloads.
- The sky bar: a storm cloud crosses from left to right over the morning (50 to 115 s per field). When it arrives, rain sweeps the field left to right in 5 s. Anything still in the field, standing or lying, is lost.
- Neighbours wait on the verge with a price bubble (grain icon and number) and a picture of what they want. Tap to hire. Tap again to send home. A second tap within 1 s is ignored.
  - Strong one (22, a bowl): carries 10 sheaves to the cart.
  - Child (6, a sweet): chases crows.
  - Grandma (10, a loaf): ties bundles, so you carry double.
  - Fast one (8, a ring): cuts fast, ignores flattening, bundles up to 3 sheaves and carries them to the cart, but tramples 12% of the cells he cuts. Offered from field 7 alongside double bundles.
  - The fast one refuses (a crossed-out picture of the strong one) if the strong one was hired this morning.
- Pay comes out of the cart at the end, pro rata for time worked: `ceil(price * min(1, worked / morning))`. "Stop here" on the pause card ends the morning now and pays what was earned. The score is grain kept.
- Hazards:
  - crows land on sheaves and eat them; walking near scares them off;
  - a hidden stone blunts the scythe (cutting 0.3x) until you tap Sharpen (1 s, standing still);
  - wind flattens a patch (slower to cut);
  - a hare's nest pays +12 if all its cells are still standing at the end. It can be cut only from inside it, and crows ignore it.
- 12 fields. The early fields introduce hazards; the late fields give shorter mornings and more hiring choices. Stars are set by grain kept: field 1 needs 15/21/25. A field opens when the one before has a star.
- Today's field: a seed from the UTC date (`sim.dateSeed`), the same on every device. The device keeps its best per day, and a device-only board holds the top 10 mornings. The shared board (`/lab-api/board/harvest`) is not available, so it is not used.

## Baseline bot results (before the 2026-11-24 retune)

The careful bot plays 12 seeds for every set of offered neighbours on each field. The clumsy bot plays 30 seeds with no hires, then 30 with the careful bot's best set.

| Field | Need | Best hires | Best kept | Best pass | Secs | Nobody kept | Nobody pass | Everyone kept | Clumsy pass | Clumsy kept/need | Clumsy + best hires pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15 | nobody | 25.0 | 100% | 24 | 25.0 | 100% | 25.0 | 100% | 1.67 | 100% |
| 2 | 20 | nobody | 30.4 | 100% | 34 | 30.4 | 100% | 30.4 | 100% | 1.46 | 100% |
| 3 | 34 | strong | 61.9 | 100% | 58 | 59.6 | 100% | 61.9 | 83% | 1.06 | 80% |
| 4 | 40 | nobody | 49.7 | 100% | 74 | 49.7 | 100% | 48.2 | 47% | 0.97 | 47% |
| 5 | 42 | child | 64.7 | 100% | 115 | 59.8 | 100% | 61.3 | 40% | 0.97 | 17% |
| 6 | 46 | child | 65.2 | 100% | 111 | 58.8 | 100% | 59.8 | 27% | 0.94 | 13% |
| 7 | 83 | child+old | 87.8 | 100% | 121 | 77.8 | 0% | 80.9 | 0% | 0.57 | 0% |
| 8 | 81 | child+old | 85.1 | 100% | 115 | 76.8 | 0% | 77.8 | 0% | 0.54 | 0% |
| 9 | 88 | strong+child | 100.3 | 100% | 107 | 79.7 | 0% | 93.6 | 0% | 0.51 | 0% |
| 10 | 94 | strong+child | 103.8 | 100% | 108 | 87.2 | 0% | 96.8 | 0% | 0.50 | 0% |
| 11 | 92 | strong+child | 101.4 | 100% | 111 | 86.2 | 0% | 96.0 | 0% | 0.53 | 0% |
| 12 | 94 | strong+child | 101.3 | 100% | 111 | 88.1 | 0% | 95.4 | 0% | 0.56 | 0% |

What `bots.mjs` asserts (all pass, 0 failures):

- Rule tests:
  - cutting, the carry limit and unloading;
  - Grandma doubles the load;
  - crows land, eat and are scared;
  - the stone blunts (at least 2.5x slower), and Sharpen stops the farmer and sharpens after 1 s;
  - a gust flattens at least 5 cells;
  - the nest pays 12 if left and nothing if cut;
  - the rival refuses;
  - half a morning costs half;
  - pay comes from the cart;
  - no hiring after the end;
  - rain soaks everything.
- Determinism: field 10 digests match run to run.
- The clumsy bot finishes field 1 (100%, at least 90% required). Its pass rate falls by thirds of the game, and so does its kept/need. It is 0% on field 12.
- The careful bot with its best hires finishes every field (100%).
- The careful bot hiring nobody finishes fields 1 to 6 (100%) and none of 9 to 12 (0%).
- Fields 7 to 12: the best set is neither nobody nor everyone. It beats hire-everyone by 5.4 to 7.3 and hire-nobody by 8.3 to 20.6.
- The newly offered neighbour is in the best set on field 3 (strong), 5 (child) and 7 (old).
- Mornings last 24 to 121 s for the careful bot and 51 to 145 s for the clumsy bot.
- Today's field on 2026-11-23 (hourglass, 12 rows): the best set (child) keeps 81 and nobody keeps 75.

Mutation run, `node experiments/harvest/bots.mjs --mutate`: helpers work for free. It exits 1 with 8 failures:

- "half a morning costs half";
- "best beats everyone" on fields 7 to 12, where the two tie at 106.0, 105.0, 127.6, 130.0, 126.3 and 124.2;
- "the new neighbour (old) is in the best choice" on field 7.

## Baseline phone check (`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/harvest/check.mjs`)

Both phones pass, with zero page errors, console errors, failed requests or HTTP errors: WebKit iPhone 13 in 97 s, Chromium Pixel 7 in 117 s.

The finger is steered by the careful bot. Every move reaches the game as a touch `PointerEvent` on the canvas, aimed 34 px low the way a thumb holds.

What the check covers:

- **First visit.**
  - The menu shows only Play and the lab notice.
  - The hold-and-move hint shows after 3 s idle, and the first touch ends it for good.
  - Field 1 is played by touch to the end card: kept 25, 3 stars, all in at 25 to 26 s.
  - Stars are saved, and the save survives a reload.
  - The menu then offers "Field 2" and Today's field.
  - The finished morning is sent once to the lab with its kept grain.
  - The field picker shows fields 1 and 2 open.
- **Pause.**
  - The button pauses, and time stands still.
  - Keep going resumes.
  - Blur pauses, and P resumes.
- **Field 3.**
  - Every neighbour slot is at least 48 px.
  - A real tap hires the strong one; a quick second tap does not send him home.
  - Stop here gives the end card with the why `stopped`. The strong one is paid part of his 22. Kept = cart - pay + bonus, and the ledger names him.
  - Again restarts with one tap.
  - The lab record has outcome `stopped` and the hire event.
- **Today's field.**
  - The same date gives the same field; another date gives another.
  - The device best is saved, and the board grows.
  - A junk daily entry in the save is dropped.
  - The menu shows today's best.
- **Chromium also.**
  - At 360x640, field 12 shows 4 neighbours and Sharpen, each slot at least 48 px, with the lane above the verge and the field inside the width.
  - Desktop: a mouse drag moves the farmer, an arrow key walks, key 1 hires, and Escape pauses and resumes.

Screenshots are in `/private/tmp/night-harvest/`:

- for each phone: `<phone>-1-menu`, `-2-hint`, `-3-mid`, `-4-end`, `-5-hired`, `-6-stopped`, `-7-today`, `-8-today-end`;
- also `small-360-menu`, `small-360-field12` and `desktop`.

## Baseline gaps (before the 2026-11-24 retune)

Current results and remaining gaps are in the dated retune section below. This section records the starting evidence.

- **No human has played it.** The difficulty curve is proven only for the two bots.
  - The need jumps from 46 (field 6) to 83 (field 7), and the clumsy bot is at 0% from field 7 even with the best hires (kept/need 0.53 to 0.64).
  - The careful bot's best clears fields 7 to 12 by only 4 to 12 grain.
  - Fields 7 to 12 are likely too hard for many people. That is the first thing to watch in lab play.
- **The fast one is never in the best set** in bot play. Carrying, not cutting, is the bottleneck, and his early cut sheaves feed the crows. On field 9 his best set keeps 85.2 against 79.7 hiring nobody, but strong+child keeps 100.3.
  - Attempts to make him worth hiring did not work: trample 0.35 down to 0.12, price 13 down to 8, ignoring flattening, and four early gusts.
  - He stays as a choice that looks good and is not. A person may still use him differently than the bot does.
- **Sound** is synthesized for every action, but it was never heard on a real phone. The check cannot hear it.
- **Hire-everyone order:** "hire everyone" in the bots taps in the listed order, so the fast one always refuses after the strong one. A person who taps the fast one first gets him, and then the strong one still works.
- **The lab will refuse sends:** the slug `harvest` is not in human-framework's `LAB_PROTOTYPES` list, so real sends will be refused until it is added there (outside this folder).
- **Phone seed line not added:** `kit/check/phone.mjs` has no seed line for harvest. The brief forbids editing the kit, so this is left undone.
- **Reduced-motion mode** (fewer particles, no shake) was not looked at in a screenshot.

## Ideas left open

- A shared daily board when `/lab-api/board/harvest` exists. The device board keeps the same shape (`{d, k}`).
- Neighbours who remember: a neighbour sent home early asks more next morning.

## 2026-11-24 — difficulty and wheat retune

### Acceptance and decisions

The progression curve below measures the unchanged clumsy brain with a simple hiring policy: nobody on fields 1, 2 and 4; strong on 3; child on 5 and 6; fast on 7–12, hired at 4 s. Solo clumsy results remain separate. This interpretation preserves the existing requirement that even the careful brain must hire to earn its first star late. Lowering only the quotas would let the careful brain pass every late field alone. No bot aiming, reactions or movement changed.

First-star quotas are now 15, 20, 34, 37, 39, 42, 56, 61, 66, 71, 73 and 75. The field 6→7 increase is 14 grain, formerly 37. Late morning limits are 50, 60, 60, 65, 70 and 75 s, formerly 120, 110, 115, 120, 130 and 140 s. Late two-star targets are 64, 68, 76, 79, 80 and 82; three-star targets are 68, 74, 80, 88, 88 and 90, retuned to the shorter mornings. The fast neighbour arrives on field 7, cuts and bundles his own load of 3, then delivers before cutting again. His price remains 8 and trample chance remains 12%. He avoids selecting nest cells and shares the player's nest swing protection.

The hiring search now hires fast before strong when both are selected. “Everyone” therefore measures everyone actually working; it no longer silently omits the refusing neighbour. The refusal rule itself is unchanged and still tested in both orders.

The clumsy curve assertion changed from solo failure on field 12 to the simple-policy progression above: every field must have nonzero success; the last must be 10–25%; each adjacent drop must be at most 25 percentage points and each rise at most 10. The old solo kept/quota trend assertion was removed because the new late hiring gate deliberately separates solo and hired play. The careful first-star assertions retain 90% minimum with the best hires and 20% maximum alone late; the solo gate now includes fields 7 and 8 as well as 9–12. Added checks require fast in the best roster on at least two fields, every quota increase at most 15, and independent fast deliveries within his carry limit. These changes define the new target rather than relax a failed delivery or phone check.

Wheat now has a stem, leaf, 4 paired spikelet rows (8 pointed grains) and awns. The title, standing wheat and sheaves share that shape. Three cached 48×112 canvases draw dry, storm and wet wheat. This replaces detailed geometry work on every frame. Rain leaves blue-grey collapsed stalks, a 0.65 s collapse and splash ring, and a pale blue leading edge. Reduced motion skips collapse interpolation while keeping the colour boundary and stalks. The rain banner says “Uncut wheat is lost.” Fixed the cutting flag assignment that was accidentally inside a comment, so scythe animation reflects cutting again.

### Verification

Commands used the pinned runtime: `fnm exec --using=26.12.0 node`.

`bots.mjs`: exit 0, 0 failures, 236.1 s. Careful: 12 seeds per hiring set. Clumsy: 30 seeds per field, both solo and with the fixed policy. Both brains are unchanged.

| Field | Need | Morning limit (s) | Careful best hires | Best kept mean | Best passes | Solo careful passes | Solo clumsy passes | Clumsy with fixed hires |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | 15 | 90 | nobody | 25.0 | 12/12 | 12/12 | 30/30 | 30/30 |
| 2 | 20 | 95 | nobody | 30.4 | 12/12 | 12/12 | 30/30 | 30/30 |
| 3 | 34 | 90 | strong | 61.9 | 12/12 | 12/12 | 25/30 | 24/30 |
| 4 | 37 | 105 | nobody | 49.7 | 12/12 | 12/12 | 23/30 | 23/30 |
| 5 | 39 | 110 | child | 64.7 | 12/12 | 12/12 | 25/30 | 21/30 |
| 6 | 42 | 115 | child | 65.2 | 12/12 | 12/12 | 18/30 | 17/30 |
| 7 | 56 | 50 | fast | 67.5 | 12/12 | 0/12 | 0/30 | 10/30 |
| 8 | 61 | 60 | fast | 71.3 | 12/12 | 0/12 | 0/30 | 8/30 |
| 9 | 66 | 60 | fast+old | 81.8 | 12/12 | 0/12 | 0/30 | 10/30 |
| 10 | 71 | 65 | fast+strong | 80.4 | 12/12 | 0/12 | 0/30 | 7/30 |
| 11 | 73 | 70 | fast | 80.4 | 12/12 | 0/12 | 0/30 | 6/30 |
| 12 | 75 | 75 | fast | 81.6 | 12/12 | 0/12 | 0/30 | 6/30 |

The progression percentages are 100, 100, 80, 76.7, 70, 56.7, 33.3, 26.7, 33.3, 23.3, 20 and 20. Largest adjacent drop: 23.3 percentage points. Largest rise: 6.7. Fast is in the best set on all 6 late fields. Late best sets beat hiring everyone by 11.0–19.5 grain and hiring nobody by 12.8–28.2 grain. Careful mornings take 24–115 s; solo clumsy mornings take 51–120 s. The fixed daily sample keeps 83 with fast+strong versus 75 alone.

`bots.mjs --mutate`: exit 1, 17 failures, 229.0 s. Free wages break the direct half-morning wage assertion and the hiring/progression comparisons. No check was suppressed.

`check.mjs webkit`: final exit 0 on the iPhone 13 profile, 100 s, zero page, console, failed-request or HTTP errors. Field 1 finished with 25 kept and 3 stars at 25 s. Rain showed 14 wet-standing cells and 10 cells still standing ahead of it. Viewed the final hint, mid-play and rain screenshots: dry ears and stems are present, the rain boundary is distinct.

The new pixel assertion requires more than 50 golden wheat pixels in the untouched upper quarter-field; it excludes the HUD and cart. It caught an actual blank-crop screenshot during development. Sprite canvases now request CPU readback and flush once before caching. The page draws immediately after beginning a morning or resizing, so clearing the canvas does not wait for an animation frame.

Chromium investigation exposed a defect in the new pixel check: a 3 s rain-test morning darkens wheat to about RGB(178, 143, 68), outside its initial dry-wheat limits. The zero-gold failures from that assertion, including an original-source reference and alternate browser modes, do not establish a rendering regression. Those alternate browser options were not retained. The main canvas keeps its original context options. The corrected classifier requires R>150, G>110, R>1.1G and R>2.3B, while retaining the count of more than 50 pixels. Independent controls accept dry RGB(240,194,79), storm (178,143,68) and darkest storm (160,131,67); they reject soil (176,136,80), stubble (216,182,114) and white (255,255,255). The sample waits for simulation time above 0.05 s and uses the upper quarter-field to avoid the banner. This corrects the new check's false negative rather than suppressing an existing failure.

A prior full retry also failed the unchanged zero-console-error check with an AudioContext device/renderer error; a standalone tone/reload reference did not reproduce it. No error was suppressed. Host load averages reached 222.94, 247.05 and 227.45 during these runs, but the cause of that audio error remains unresolved. The final default Chromium run with the corrected assertion passed; no alternate launch flags remain. The exact final WebKit run also passed with the final foreground/first-frame helper and corrected pixel assertion.

`check.mjs chromium`: exit 0 on the Pixel 7 profile, 148 s, zero page, console, failed-request or HTTP errors. Field 1 kept 25, earned 3 stars and cleared in 24 s. Both normal and reduced-motion rain views had 14 wet-standing cells and 10 still standing. The 360×640 layout and desktop mouse/keyboard/pause checks also passed. Viewed final screenshots from both phones, normal/reduced rain, field 12 at 360 px, and desktop; no missing-wheat artifact remains in those captures.

The check now brings each new context forward and uses `startGame` to wait for a running first frame after each start/restart. Desktop holds last 0.9 and 0.7 simulation seconds with bounded 10 s waits, rather than sampling a fixed wall-clock delay before a loaded window has rendered; the movement thresholds remain more than 1 cell vertically and 0.8 horizontally. All existing input, accounting, save, lab and zero-error assertions remain.

### Remaining gaps

- No human playtest or real-phone audio test. Bot pass rates do not measure enjoyment. Frame timing on a real phone is unmeasured.
- The target curve uses the fixed hires above. Solo clumsy play still fails fields 7–12; solo and hired results are not interchangeable.
- The lab transport in the phone check is mocked. Live lab acceptance is unverified; this folder cannot register or deploy the slug in the external lab service.
- The shared kit suite did not pass in this environment. The broad run failed unrelated kit/3D/hint cases with timeouts and WebGL context loss. The post-change `phone.mjs kit` run passed Chromium but timed out after 150 s on WebKit. No shared files or thresholds were changed to hide those failures.

## 2026-11-24 — Music

The kit's score (`kit/music.js`, Lantern's music) now plays under a morning, and the player plays its tune.

- **Preset.** `flute` (slow attack, a little vibrato: the kit's "garden" voice) with three overrides in `song.js`, no change to the kit: 88 a minute (the flute's 80 is a stroll; a harvest walks), `turn` 0.8, and morning chords in place of Lantern's night ones. Written in D like the kit's: D add9, Bm7, G, A sus4 while the field stands; the kit's bright D, G maj7, A, D once four fifths of the field is cleared. The flute preset plays them a fourth up, in G. A night minor did not suit a sunny field.
- **What plays it** (`song.js`, read by the page and by `bots.mjs`; `sim.js` is unchanged and never calls it):
  - each sheaf the farmer bundles (`pick` by `me`, 29 a minute for the bots, median 0.4 s apart) plays the next note of the morning's tune, in place of the pick sound. The neighbours' sheaves play nothing. When four notes already wait, a pitch from the chord sounding plays as the pick sound (never with the bots: 0 of 2647);
  - a sheaf lost (eaten by a crow, trampled by the fast one, the hare's nest cut) is a note not played: the streak ends, its harmony stops;
  - the hidden stone and the start of the rain are blows: pad, bass and walk drop for two bars;
  - progress: the share of the field cleared; danger: 0.35 for each crow eating, rising over the last 10 s before the rain, full in the rain (a low heartbeat); light: the time left before the rain (below 28% one thin high note each bar).
  - The cart drop, the crows, the stone and every other sound are unchanged.
- **Switch.** "Music: on" beside each Sound button (menu and pause card), on by default because Sound is. Its own key `harvest-music` (`'0'` when off); `harvest-save` is untouched. With Sound off the music is off too.
- **Words.** `words.js` (kit `i18n.js`) holds only `musicOn`/`musicOff` in English and Turkish ("Müzik: açık", "Müzik: kapalı"). The rest of Harvest Morning is still English, so a Turkish phone sees "Sound: on" beside "Müzik: açık".
- **Volume 0.4**, from rendering offline in headless Chromium (the score at volume 1, preset with these overrides; linear in volume): bed (calm, mid-morning, after a 6 s fade-in) peak 0.161, RMS 0.0243; a single melody note peak 0.085; the kit's worst case (full danger, the ending, light nearly out, a pickup every 0.2 s, a blow) peak 0.279. Game effects: a kit tone peaks at its volume; the kit's band-passed noise measured offline (median of 20): cut noise 0.052 (with a 0.015 tone), footstep 0.0084, trample 0.030, soak 0.039. Criteria, fixed before choosing: (1) bed RMS at most a quarter of the quietest effect that signals something, the cut (0.052): 0.0097 ≤ 0.013; (2) the melody note within half to twice the pick sound it replaces (0.06): 0.034 (−5 dB); (3) worst music peak plus the loudest effect (the storm, about 0.47) under 0.9: 0.11 + 0.47. Footsteps (0.0084 peak) are under the bed's RMS: they will be masked while the music plays. I counted them as texture, not a signal; a person should judge that.
- **Checks.**
  - `node bots.mjs music`: 84 mornings (levels 1, 2, 4, 6, 7, 10, 12; 6 seeds; careful with a simple roster and clumsy alone), 91.5 minutes: 2647 tune notes, 0 without a note, 648 lost sheaves (missed notes), 89 blows, 48 rains, latest note 362 ms after its sheaf; 0 failures. Claims: one note for each of the farmer's sheaves and none otherwise; misses and blows as above; every note on the score's grid, in its chord, in the tune's order (`kit/check/music-claims.mjs`); a heartbeat in the rain; no major chord before four fifths is cleared; no high note before the last 28% of the time; a twin morning stepped without music ends identical (digest, result and stats).
  - `node bots.mjs music --mutate`: exit 1. The neighbours' sheaves playing notes: 2866 failures; a sheaf eaten playing a note: 1023 failures.
  - `node bots.mjs`: exit 0 (runs the music claims as section 6). `node bots.mjs --mutate`: exit 1, 17 failures, as before.
  - `phone.mjs harvest`: both phones pass, the hint included. The shared check now also asserts the switch says on at first, the score schedules notes in a run, off is saved under `harvest-music` and schedules nothing after resuming, and off survives a reload.
  - `check.mjs`: exit 0 on both phones (field 1 by touch kept 25, 3 stars, 25 s and 26 s).
  - Looked at: the pause card (Sound and Music side by side, WebKit iPhone 13) and the Turkish menu at Pixel 7 size.
- **Not verified.** Nobody has listened: every number above is measured, none heard. What to listen for: does each sheaf picked up sound like a note of a tune rather than a blip, and does a quick run of pickups sound like a phrase; does a crow taking a sheaf leave a gap you notice; do the stone and the rain make the music drop out for a moment and come back; does the heartbeat with one crow down feel too much (it starts with a single eating crow); do the chords brighten near the end of a good morning; are the cut swish and the footsteps still heard under the music; is the volume right on a phone speaker.
