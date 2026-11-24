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

## Rules

- Top-down golden field that sways. Hold and move: the farmer walks to the point under the finger. The touch target is 34 px above the finger, so the thumb does not hide the farmer.
- Standing wheat near the scythe is cut and lies as a sheaf. Walking over sheaves picks them up, up to 3 (6 with Grandma hired). Walking to the cart in the lane below unloads.
- The sky bar: a storm cloud crosses from left to right over the morning (90 to 140 s per field). When it arrives, rain sweeps the field left to right in 5 s. Anything still in the field, standing or lying, is lost.
- Neighbours wait on the verge with a price bubble (grain icon and number) and a picture of what they want. Tap to hire. Tap again to send home. A second tap within 1 s is ignored.
  - Strong one (22, a bowl): carries 10 sheaves to the cart.
  - Child (6, a sweet): chases crows.
  - Grandma (10, a loaf): ties bundles, so you carry double.
  - Fast one (8, a ring): cuts fast, ignores flattening, but tramples 12% of the cells he cuts.
  - The fast one refuses (a crossed-out picture of the strong one) if the strong one was hired this morning.
- Pay comes out of the cart at the end, pro rata for time worked: `ceil(price * min(1, worked / morning))`. "Stop here" on the pause card ends the morning now and pays what was earned. The score is grain kept.
- Hazards:
  - crows land on sheaves and eat them; walking near scares them off;
  - a hidden stone blunts the scythe (cutting 0.3x) until you tap Sharpen (1 s, standing still);
  - wind flattens a patch (slower to cut);
  - a hare's nest pays +12 if all its cells are still standing at the end. It can be cut only from inside it, and crows ignore it.
- 12 fields, each with a new shape and one new thing. Stars are set by grain kept: field 1 needs 15/21/25. A field opens when the one before has a star.
- Today's field: a seed from the UTC date (`sim.dateSeed`), the same on every device. The device keeps its best per day, and a device-only board holds the top 10 mornings. The shared board (`/lab-api/board/harvest`) is not available, so it is not used.

## Bot results (`node experiments/harvest/bots.mjs`, 2026-11-24)

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

## Phone check (`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/harvest/check.mjs`)

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

## Not verified

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
- Make the fast one pay off: a field where cutting is the bottleneck (a very short morning with a near cart), or let him tie his own sheaves.
- Ease the step from field 6 to 7 after seeing human pass rates.
- Neighbours who remember: a neighbour sent home early asks more next morning.
