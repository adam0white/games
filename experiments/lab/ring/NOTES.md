# Firefly Ring

A phone game. You drag a glowing thread around fireflies in a night meadow. A closed loop catches what is inside it.

## Source

- Source: https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game. It describes loop-drawing entries in a 2025 game jam. The lab opened it on 2026-11-24 for `docs/ideas/shortlist-2026-11-24.md` (pick 2); the builder did not.
- Only the gesture is taken: draw a closed loop to catch things inside it.

## What makes it ours

- Pure rings score n². A mixed ring scores nothing and startles the fireflies.
- Fireflies drift toward their own colour, so waiting builds bigger rings. The thread burns from the tail, so a ring cannot be bigger than the thread.
- Moths snap the thread and cost wicks. The bat eats the biggest same-colour cluster. These two make waiting risky.
- The night has eight levels, and each adds one thing. There is a daily meadow with a result row of jars and a picture to share.

## Rules

- The field is 360x600 units with a fixed step of 1/60 s. All rules are in sim.js.
- Drag to draw the thread. The thread holds at most 600 units and burns from the tail.
- A loop closes in two ways:
  - The thread crosses itself. The earliest crossing gives the largest loop.
  - The finger lifts within 34 units of the start, after at least 90 units of thread.
- The ring catches what is inside the closed part, tested by point-in-polygon. The scoring cases are:

| Ring contents | Points | Other effects |
|---|---|---|
| n fireflies of one colour | n² | Moths inside are sent away and do not count. |
| A golden firefly | n² + 20 (one jar) | It does not make a ring mixed. |
| Mixed colours | 0 | Those fireflies are startled for 2 s. |
| Moths only | 1 per moth | No light. |

- After any ring closes, the thread cannot be drawn for 0.5 s (REKINDLE). Many small rings therefore cost time.
- Jars fill by points: 20 points fill one jar. A level ends when its jars are full or its dawn bar runs out.
- Filling the jars early earns 3 points for each whole second of dawn left.
- A moth that touches the thread snaps it and costs one of 3 wicks. With no wicks left, the run ends.
- From L4 a bat comes. It warns for 1 s, then flies at the firefly with the most same-colour neighbours. It eats fireflies on its line.
- Wind (L6) is a 1.5 s gust every 5–8 s.
- The golden firefly (L7) flees the finger.
- Caught fireflies come back at an edge 2–3.5 s later, in the colour with the fewest fireflies.

| Level | Colours | Fireflies | Moths | New | Jars | Seconds |
|---|---|---|---|---|---|---|
| 1 | 1 | 14 | 0 | one colour | 5 | 32 |
| 2 | 2 | 18 | 0 | two colours | 5 | 32 |
| 3 | 2 | 18 | 2 | moths | 5 | 34 |
| 4 | 2 | 20 | 2 | bat | 5 | 35 |
| 5 | 3 | 24 | 2 | three colours | 4 | 36 |
| 6 | 3 | 24 | 2 | wind | 5 | 38 |
| 7 | 3 | 24 | 3 | golden firefly | 5 | 38 |
| 8 | 3 | 26 | 3 | all of it | 5 | 40 |

- The night runs through all 8 levels whether or not each one is cleared.
- Stars:
  - Every finished run gets 1 star. Reaching dawn with at least 6 levels cleared adds a second, and with all 8 cleared a third.
  - A run that ends by losing all wicks keeps 1 star.
- Endless opens after your first dawn, meaning a night that ends without losing all wicks.
  - Endless uses the L8 rules. Round r has min(7, 5 + r) jars and a dawn of max(24, 40 − 2r) seconds.
  - Endless ends when a dawn runs out. The device keeps the best score.
- Today's meadow:
  - The seed is hashString(`ring:YYYY-MM-DD`) on the UTC date.
  - The first run of the day is the scored one. It is marked used when it starts, so quitting does not give a second try. Later runs are practice.
  - Restart during a daily run starts a normal night.
  - The end card shows 8 jars, one per level, filled to that level's share. "Save picture" makes a 720x420 PNG. It uses navigator.share with files where available, and a download otherwise.
- `?level=N` plays one level as practice. `?date=YYYY-MM-DD` picks a daily meadow. `?hint=1` shows the hint again.
- Save key `ring:v1`; hint key `ring:hint`.

## Files

- sim.js: pure rules. Seeded mulberry32. Runs in Node.
- main.js and index.html: rendering, input, audio, save and screens.
- bots.mjs: rule and balance checks.
- check.mjs: Playwright check.

## Bot numbers

From `node bots.mjs`, run on 2026-11-24 with 40 seeds:

| Bot | All 8 cleared | Mean cleared | Mean score | Best ring | Rings | Mixed | Snaps | Stars |
|---|---|---|---|---|---|---|---|---|
| careful | 37/40 (93%) | 7.90 | 1305 (min 1161) | 8.9 | 29 | 0.3 | 0.05 | 2.92 |
| greedy (tiny rings at once) | 0/40 | 0.00 | 383 | 4.0 | 219 | 0.7 | 0 | 1.00 |
| idle | 0/40 | 0.00 | 0 | 0 | 0 | 0 | 0 | 1.00 |

- Careful has a mean of 53% of dawn left when a level fills (per level: 66 57 56 48 53 43 50 54). A careful night lasts 146 s on average.
- Careful in endless lasts 5.7 rounds on average (min 3, max 8).
- Mixed rings closed across all runs: 39, scoring 0 points.
- `node bots.mjs --mutate` lets mixed rings score. The "mixed rings never score" check then fails, and the suite reports "mutation caught".
- Idle gets 1 star. The brief asks for 1–3 stars, so every finished run gets at least 1.

## Not verified

- No real phone. No human has played it. The feel of the gesture under a thumb is untested.
- Audio was not heard on a phone.
- The 60 fps target was not shown. Headless WebKit measured about 44 fps on this machine at load average 170–450. That number says little about a phone.
- check.mjs depends on timing when the machine is loaded. For that reason the first ring and the practice level get retries. The night L1 result is printed but not asserted.
- In the whole night played by the scripted finger, the finger lost all wicks to moths. That finger does not avoid moths. The careful bot does avoid them.
- The check never finishes a scored daily run. Its whole night is a practice run, because the daily mark is set earlier. Saving `daily[date] = {score, fills, stars, ring}` at the end of a scored run is untested.
- "No per-frame allocations" was not measured. Pools and preallocated arrays are used, but popups and ring effects are small objects pushed per event.
- The first-play hint (`hold-and-move`) was seen once in Chromium. It wrote `ring:hint` = 1 on the first press.
- A strong player in endless was checked only through the careful bot, which lasts 3–8 rounds.
- kit/check/phone.mjs does not know the `ring:v1` and `ring:hint` keys. That file is outside this folder.
- No lab index entry. lab.js and /notes/button.js are not used.

## Open ideas

- A shared board for Today's meadow, so players can compare scores on the same seed.
- Two players on one phone, each with a thread in their own colour, on the same meadow.

## Languages

English and Turkish, through the shared kit (`../../kit/i18n.js`). Every string a player can see or hear read aloud lives in `words.js` (`tables.en`, `tables.tr`): HTML text, aria-labels, the document title, HUD and canvas words (level banner, score pops, the dawn bonus), the hint, the pause and end cards, and the share picture. `?lang=tr` picks Turkish and is remembered (`kit:lang`, shared with the other games). A small language button sits beside the sound button on the menu and on the pause card; it switches without a reload and redraws the card in view. Numbers and the date on the daily end card use `Intl` with the page language (Turkish groups thousands with a dot). Capitals come from CSS only, so Turkish i and I follow the document language. Save format, storage keys, `sim.js` and the `window.__ring` hooks are unchanged.

Title: Turkish is "Ateş Böceği Halkası" (a literal, natural rendering; "Firefly" is "ateş böceği"). The share picture file is `ates-bocegi-halkasi-<name>.png` in Turkish.

The Turkish was written by an AI and has not been read by a native speaker. Open items for the reader: "Mumlar söndü" / "Fitiller söndü" for the lost wicks, "çayır" for meadow, "Alıştırma" for practice, and the second line of the intro paragraph.

`check.mjs` covers it on iPhone 13 (WebKit) and Pixel 7 (Chromium) plus 360x640: key parity of the two tables (and `{placeholder}` parity), no raw keys or English left on the Turkish menu, pause and end cards, exact Turkish strings, `lang="tr"`, the switch and its survival of a reload, the hint's words, no overflow, no console errors. The English checks open pages with `?lang=en`.
