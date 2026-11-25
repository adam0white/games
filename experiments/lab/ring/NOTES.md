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
- A moth that touches the thread snaps it and costs one of 3 wicks. With no wicks left, the run ends. Since 2026-11-24 the page plays with fair moths (notice within 150, hover half a second, then chase) and relight (a full level relights a wick); main's rules stay in sim.js with both options off. See "Improve" below.
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
  - The end card shows 8 jars, one per level, filled to that level's share. "Save picture" makes a 720x420 PNG, shared through `kit/share.js` with a line of words since 2026-11-24 (see below).
- `?level=N` plays one level as practice. `?date=YYYY-MM-DD` picks a daily meadow. `?hint=1` shows the hint again.
- Save key `ring:v1`; hint key `ring:hint`. Nights 2 and 3, fair moths, relight and the new key `ring:nights`: see "Improve" (2026-11-24) below.

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

## Play recording (2026-11-24)

The page sends play records to the lab under the name `ring` through `kit/lab.js` (the name is in human-framework `LAB_PROTOTYPES` once its pull request lands; until then every send is refused). The recording notice is on the menu card; the off switch is on the pause card. A run is one night, today's meadow, an endless meadow or a practice jar; it ends `won` at dawn or `lost` when the wicks run out (summary: kind, score, level, jars cleared, best ring, stars), or `quit` through Menu or Restart. Events: `dawn` and, for the daily, `daily-finished`.

`check.mjs` answers the lab address itself (no check reaches the real one), loads the page with `?labRunSource=agent`, and asserts: the notice is on the page before play, a played run sends one run record under `ring` with its events record, and after the switch is turned off a further run sends nothing and the player id is removed. Not verified: delivery to the real lab (the Worker does not accept this name yet), a real phone.

## Improve: nights, fair moths, feedback (2026-11-24)

The owner's word on this page was "Good but improve". What was built, from a cold play on both engines and the bots:

| # | Weak thing (cold play, main) | Before | What changed | After |
|---|---|---|---|---|
| 1 | One moth touch costs a wick, with no warning; a hand that is not exact loses the whole night. A moth chases the thread from 260 away at once. | Whole night, shaky hand: dawn 0%, 2.3 of 8 levels full. Clumsy: dawn 23%. Single levels, shaky: 100 90 **43** 48 63 50 57 58 (a 47-point cliff at level 3, where moths arrive). A finger that ignores moths lost the night at level 3 (Chromium) and 5 (WebKit). | Fair moths: a moth notices the thread only within 150, hovers 30 steps (half a second) with a red ring closing on it and a two-note call, then chases as before. Relight: a level that ends with full jars relights one wick (up to 3). Both are options in sim.js, off by default. | Whole night, shaky: dawn 63%, 6.5 of 8 full; clumsy: dawn 97%. Single levels, shaky: 100 90 87 88 93 93 88 90, largest step down 10 (was 47). Clumsy, night 1: main 100 97 92 73 90 88 90 83 (largest drop 19); now 100 97 100 100 100 98 98 100 (3). |
| 2 | The frame that ends a night spikes: the share picture was drawn and PNG-encoded inside it. | 31 ms WebKit, 22.9 ms Chromium (the only frame over 8 ms in a whole night). | The picture is drawn 300 ms after the card is up, and encoded in a separate task. | Frames at 390x844 (rAF callback time): end card max 1.0 ms WebKit, 0.8 ms Chromium; crowd level (32 fireflies) 1.0 / 0.4; gale 1.0 / 0.9; a 200 s cold play of night 1, 16420 and 13761 frames, max 2 / 2.3 ms. The encode now runs in its own task, which a rAF timer does not see; its length on WebKit was not measured. |
| 3 | Many actions are silent: a button, the pen going down, a press while the lamp rekindles, a moth arriving, the level banner, a jar filling. | 6 actions with no sound and no motion. | Every sound and motion goes through `kit/fx.js` (`fx(name, sound, motion)`), which logs the name; `__ring.fx` reads it. New answers: button (click and bump), penDown (spark), rekindleWait (dull tick), moth (low hum), level (two notes and a lantern flare), jar (rising note and a glow on the jar), and for the new ideas thorn, fade, call, relight, mothNotice, night, nightOpened. | Seen firing in a browser: button, level, penDown, ring, jar, levelFull, moth, mothNotice, bat, eat, gust, mixed, golden, over, nightOpened, night, thorn. Wired but not seen firing in a browser: rekindleWait, fade, call, ringCalled, relight, snap, empty, moths, levelShort, nightEdge (the bots cover the sim events behind them). |
| 4 | One night of 8 levels, then nothing new. A moth-aware finger got a perfect night on its first try on both engines. | 8 levels. | Nights 2 and 3, 8 levels each, one new idea per level (below). Night n+1 opens when night n ends with 4 or more levels full; a chooser on the menu picks among open nights. | 24 levels. |
| 5 | Save picture shares a file with no words. | No text. | `kit/share.js` with a share line: "Firefly Ring · <card top>: <score>, biggest ring <n> ★★☆" and the page address. | Text on every share. |

Level 1 is short (2.6 to 9.5 s in cold play; careful keeps 66% of dawn). Left as it is: it is the first ring.

### The sixteen ideas (sim.js `NIGHTS[1]`, `NIGHTS[2]`)

Each level reads its parameters from `DEFAULTS`, which equal main's constants, and changes one of them or adds one rule.

Night 2 (two colours, no bat): crowd (32 fireflies, 6 jars) · big (every 4th firefly is big and counts as two) · call (one colour, shown under the score, pays double; the call moves on after it is ringed) · short (thread 420 instead of 600) · quick (fireflies' top speed 0.85 instead of 0.55) · restless (cohesion 0.014 instead of 0.02) · thorns (3 thorn bushes; touching one with the thread cuts it, no wick lost; fireflies keep off them) · sleep (a firefly in its dark blink is asleep: not caught, does not spoil a ring; 4 jars, since with 5 the clumsy hand dropped 15 points there).

Night 3 (three colours, bat): pull (the lantern pulls 6 times harder) · life (fireflies fade after 16 s) · hungry (the bat comes every 2 s instead of 7) · swarm (5 moths) · mingle (repel 0.012 instead of 0.03) · shy (fireflies keep away from the finger) · slowLamp (72 steps between rings instead of 30) · gale (gusts twice as strong, twice as often).

Endless and today's meadow stay on night 1's levels. All of them, and night 1, play with fair moths and relight: the daily and endless change on purpose.

### Saves

- `ring:v1` is unchanged in shape and meaning; `save.best` stays the best of night 1.
- New key `ring:nights` = `{ v: 1, open, pick, best: [_, night2, night3] }`. It is written only when it changes (a night ends, or the player picks a night).
- A player from before with at least one dawn in `ring:v1` finds night 2 open. Reason: that player has finished night 1 already.
- `?night=N` plays night N whole as practice (open or not); with `?level=L` one level of it.

### Home, recording, share

- `kit/home.js`: `home(lab('ring'), { back: ['#menu > div', '#end > div'] })`. The ring cards have no `.card` class. The catalog entry (`ring`, think, tr: true) is right and was not changed.
- Outcome change on purpose: a single practice level now ends `won` only when its jars filled, else `lost`. Before, any practice level that reached dawn was `won`, which the home would count as a win. A night is still `won` at dawn and `lost` when the wicks run out.
- After a night opens the next one, the pick moves to it, so "Play again" on that end card starts the new night. A decision: the player just earned it.
- Recording carries `night` (1 to 3) in the run start, in the summary and in the `dawn` event; a new event `night-opened`.
- Friend play does not apply: the game is one finger on one meadow. Solo against a bot does not apply either.

### Bot claims (bots.mjs)

- Parity: with `fair` and `relight` off and night 0, digests of nights, endless, single levels and 30 dailies equal main's (`6b475af2 33afed55 b6a972e7 ee1491b0`).
- Ladder, page rules, 60 seeds per level, all 24 levels: careful at least 85% on every level (lowest 92); clumsy at least 70% (lowest 92) with no step down over 12 (largest 8); shaky level 1 at least 90%, largest step down at most 15 (largest 10), night 3 mean below night 2 mean.
  - careful: 100 100 98 98 100 100 100 100 / 100 100 100 100 100 95 98 100 / 100 92 100 97 100 100 97 97
  - clumsy: 100 97 100 100 100 98 98 100 / 100 98 100 100 93 97 95 93 / 100 97 95 100 98 100 92 97
  - shaky: 100 90 87 88 93 93 88 90 / 97 97 100 97 93 95 93 95 / 95 92 92 87 87 95 85 80
- Whole nights, page rules (40 seeds in the suite, 60 with `--nights --seeds=60`): clumsy reaches dawn 97/95/97% and opens the next night 98/100/97%; shaky dawn 63/60/50%, opens 82/85/65%. Main rules, night 1: shaky dawn 0%, opens 5%; clumsy dawn 23%, opens 58%.
- Constructed tests for each idea: big counts two, the call doubles, thorns cut without a wick and push fireflies off, sleepers are not caught and do not mix a ring, life fades and refills, the short thread holds at most 420, the slow lamp, fair moths hover where main moths move, relight gives a wick only on page rules.
- Mutations, each caught: `--mutate` (mixed rings score), `--mutate=fair` (careful's weakest level 82%), `--mutate=sleep`, `--mutate=thorns`.
- The hands: `clumsy` checks moths 8 steps late, keeps 25 from them, rushes at 3, aims 14 off centre with 25% size error; `shaky` 14 late, 10 gap, rush 2, 22 off, 35%. They are bots, not people.

### Kit

`kit/fx.js` is new: `feedback({ canSound })` gives `fx`, `bump` and `log`. lab/pitch has the same helper inline (its own pull request); it can move to the kit once both are merged.

### Small screens

The card's own overflow at 320x568 (scrollHeight minus clientHeight of the menu card), both engines, with `?from=small`:

| Case | main | now |
|---|---|---|
| fresh, English | 0 | 0 |
| fresh, Turkish | 26 to 27 px | 0 |
| fullest (3 nights open, bests, home link, lab notice), English | 0 (main has no home link or night line) | 0 |
| fullest, Turkish | 53 to 54 px | 0 |

Below 760 px of height the menu is tighter (smaller title, 44 px buttons, small notes) and hides the second intro line ("Mixed colours scatter. Moths snap the thread."); the level banners still say both. With the rule at 620 px the fullest Turkish menu still scrolled 24 px at 360x640 and 15 px at 390x700; at 760 px it is 0 at 320x568, 360x640, 390x700, 390x760, 390x780 and 390x844, both engines, both languages. check.mjs `tiny` asserts 320x568 in both languages and 360x640, 390x700, 390x760 in Turkish. Level banners shrink a line that is wider than the screen (the longest Turkish tips at 320 px).

### Check changes on purpose

- check.mjs: the whole-night block (Chromium) used to replay today's meadow as practice; it now plays a night, because only a night opens night 2. It asserts at least 4 levels full, "Night 2 is open.", `ring:nights.open` = 2, the menu offering night 2, and feedback names over the night. Last run: 8/8 full, 3 wicks, 170 s; names seen: button level penDown ring jar levelFull moth mothNotice bat eat gust mixed golden over nightOpened.
- New in check.mjs: `improved` (old save untouched, night 2 open from it, chooser, pick kept over a reload, night 2 page rules, daily on night 1, `?night=3`, thorns on screen, the home link on menu and end card, `hub:results` counted, the share line, Save picture), `tiny` (320x568, plus 360x640, 390x700, 390x760 in Turkish) and `ideas` (both engines: every level of nights 2 and 3 played with a moving finger, worst rAF frame per idea under 8 ms; last run WebKit 1 to 4 ms, Chromium 0.5 to 2.6 ms; then a drag across a thorn cuts the thread with no wick lost). The thorn drag tries each thorn in turn and judges the first drag with a cut and no moth snap, because one Chromium run had no cut at the first thorn; the cause was not found. One drag counts several cuts (each step after a cut starts a new thread on the thorn), so the check asks for at least one.
- phone.mjs `lab/ring`: also asserts `ring:nights` is not written at load and the chooser shows for an old save with a dawn.
- Save picture tapped before the deferred picture is made draws it at once and shares the canvas; the check taps at once, so this path is the one it covers.

### Not verified

- No person played nights 2 and 3. The ideas were tuned on bots only; whether "sleep" and "call" read clearly on a phone is a judgement for a person.
- No real phone; headless WebKit and Chromium on a loaded machine.
- Sounds were not heard.
- The Turkish for the new lines was written by an AI and has not been read by a native speaker (the idea lines, "{n}. gece / {open}", "Bir gecede {k} seviyenin kavanozları dolunca {n}. gece açılır.").
- Real share sheet on a phone: headless browsers download instead.
- The lab Worker accepting `night` in the summary: the check answers the lab address itself.
