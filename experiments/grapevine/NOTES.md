# Grapevine

## What it is

Grapevine is a wordless routing puzzle for phones. Draw a path from the teller to the listener through villagers who each change the news in a fixed, visible way, so the message arrives as the listener expects it.

## The idea it rebuilds

The idea comes from the archived game Hearsay. In Hearsay, news changes each time someone repeats it, and the player decides who it passes through. Grapevine keeps only that idea. The code, the message model (shape, colour, count), the villager kinds, the levels and the art are new. Nothing was copied or ported from `archive/`.

## Rules

- **Message.** A token has a shape (circle, square, triangle, star), a colour (red, yellow, blue, green) and a count from 1 to 3.
- **Route.**
  - Start at the teller and step along drawn paths to neighbours.
  - The route ends at the listener.
  - Each villager on the way applies its change.
  - The route may not step straight back (a, b, a), because dragging back undoes the last step.
  - The route never re-enters the teller.
  - Loops that revisit a villager are allowed, except for sleepy villagers.
  - The longest route is 14 hops (`MAX_HOPS`).
- **Input.**
  - Drag with one finger, or tap villagers one by one.
  - Touching a villager already on the route cuts the route back to it.
  - Touching the teller clears the route.
  - Lifting the finger on the listener sends the message.
  - A ghost token next to each villager on the route shows the message after that villager.
  - The HUD pill shows "now → want". It turns green when they match.
- **Villagers** (change ids in `sim.js`):

  | Villager | Look | Change |
  | --- | --- | --- |
  | honest | sprout | nothing |
  | painter | beret in its colour | paints the token its colour (ids 1–4) |
  | exaggerator | party hat | count +1, up to 3 (id 5) |
  | grump | flat cap, storm cloud | count −1, down to 1 (id 6) |
  | muddler | spiral eyes | swaps circle↔square or triangle↔star (ids 7, 8) |
  | sculptor | hard hat | makes the shape its shape (ids 9–12) |
  | contrarian | upside-down hat | opposite colour: red↔green, yellow↔blue (id 13) |
  | timid | bow | refuses any red message (the route cannot enter) |
  | parrot | bird | repeats the change of the previous speaker. After the teller or an honest villager it does nothing. After a change that did nothing (for example +1 at count 3), it repeats that change, which again does nothing. The badge shows the copied change live. |
  | sleepy (flag on any villager) | nightcap, moon | speaks once, then goes home and cannot be revisited |

- **Win and stars.**
  - Right message: celebration, stars, and an end card with a "what they heard" strip.
  - Wrong message: the listener looks confused, and the wrong token is shown next to the wanted one. The route stays on the board; the next touch edits it or draws a new one, so the player can retry at once.
  - Stars: 3 if hops ≤ shortest; 2 if ≤ shortest + 2; otherwise 1. Hop dots show the 3-star budget.
- **Hint.** After 3 wrong sends, a bulb button appears. Each press shows one more hop of a shortest route.
- **Daily village.**
  - Seeded from the local date (`dailySeed`).
  - Generated with `DAILY_SPEC`: 4–5 rows, 7–9 villagers, shortest route 5–8 hops, no straight solve, 0–1 sleepy villagers.
  - Solved in the browser before it is shown. If no seed meets the spec, it falls back to a looser spec, then to level 21.
  - Keeps its own best stars per date.
- **Tuning numbers.**
  - Fixed 60 Hz tick; dt is capped at 0.25 s.
  - A hop takes 18 ticks.
  - The end card appears 70 ticks after a win.
  - Pause stops the tick.
  - Each hop plays the next note of a major scale. Each villager kind has its own voice.
- **Layout.**
  - The board is a grid of 3 columns by 3–5 rows with jittered positions.
  - The listener is in the top row and the teller in the bottom row, so the dragging hand stays below the path it has drawn.
  - Villager radius is 15–30 CSS px, set by the screen.
- **Levels** (`make-levels.mjs` writes `levels.js`).
  - Levels 1–3 are hand-made:
    - L1: one path. A ghost finger draws it. A player with no save first sees the shared kit hint (`../kit/hint.js`, kind `path`, key `grapevine:hint`) after 3 s of idle play; the ghost finger waits while it shows. It sits between the teller's row and the next row up on level 1; on boards with 4–5 rows it can overlap a villager. `check.mjs` asserts that `?hint=hand` shows it and a tap removes it.
    - L2: two paths, one painter wrong.
    - L3: the short path is wrong and the long one is right.
  - Levels 4–30: each new villager kind gets 3 levels, in this order: exaggerator, grump, muddler, sculptor, contrarian, timid, sleepy, parrot. The last 3 levels mix every kind.
  - Each spec sets a hop range, and requires that:
    - no shortest-by-distance path solves it;
    - the new villager kind is essential: with those villagers removed, no route of the shortest length solves it. For timid and sleepy levels, the rule itself is essential: with the rule switched off, a shorter route would solve it.
  - "Round again" (L9) and "Lantern night" (L30) require a loop.
  - From 8 seeds per level, the curator keeps the one whose random-walker win rate (`wanderRate`) is closest to the target `0.75 − 0.6·(n − 4)/26`. The target falls from 75% at L4 to 15% at L30.
- **Save.** One key `grapevine-save`: `{v, sound, best: {level: stars}, opened, daily: {date: stars}}`.
- **URL parameters.** `?level=n` opens level n, even if it is locked. `?seed=n` replaces the daily seed.

## Bot results (`fnm exec --using=26.12.0 node bots.mjs`, exit 0, 0.1 s)

The bots check:
- **Determinism:** generate, walk and rng.
- **Per level:**
  - The level is solvable.
  - The stored shortest equals the solver's.
  - The solver route is correct by `walk()`.
  - A brute-force search that uses only `walk()` agrees with the solver on the shortest length and on the number of routes up to shortest + 2.
  - After L3, no straight path solves the level.
  - The new villager kind is essential.
- **Random bot:** 400 random-walk attempts per level, 3 sends each.
- **Daily:** 365 villages for 2026.

| n | name | villagers | paths | shortest | routes at shortest | routes ≤ +2 | straight path | random bot wins | new kind |
|---|---|---|---|---|---|---|---|---|---|
| 1 | First words | 3 | 2 | 2 | 1 | 1 | solves | 100% | paint |
| 2 | Two ways | 4 | 4 | 2 | 1 | 1 | solves | 91% | paint |
| 3 | The long way | 5 | 5 | 3 | 1 | 1 | fails | 90% | paint |
| 4 | Big talk | 5 | 5 | 3 | 1 | 1 | fails | 70% | more |
| 5 | Tall tales | 6 | 7 | 4 | 1 | 1 | fails | 73% | more |
| 6 | Three of them | 6 | 6 | 4 | 1 | 2 | fails | 68% | more |
| 7 | Grumbles | 6 | 6 | 4 | 1 | 1 | fails | 70% | less |
| 8 | Ups and downs | 7 | 9 | 4 | 3 | 5 | fails | 61% | less |
| 9 | Round again | 6 | 7 | 6 | 2 | 4 | fails | 51% | more (loop) |
| 10 | Mix-up | 7 | 10 | 4 | 2 | 9 | fails | 62% | swap |
| 11 | Shape shift | 8 | 8 | 4 | 1 | 1 | fails | 57% | swap |
| 12 | Muddle | 9 | 9 | 5 | 1 | 2 | fails | 52% | swap |
| 13 | Carved | 7 | 10 | 4 | 2 | 10 | fails | 51% | carve |
| 14 | Star-maker | 8 | 8 | 4 | 1 | 1 | fails | 58% | carve |
| 15 | Chips fly | 9 | 10 | 6 | 1 | 3 | fails | 44% | carve |
| 16 | Not so | 6 | 7 | 4 | 2 | 2 | fails | 45% | flip |
| 17 | Quite the opposite | 7 | 7 | 5 | 1 | 2 | fails | 51% | flip |
| 18 | Back and forth | 9 | 11 | 7 | 1 | 8 | fails | 47% | flip |
| 19 | Not red! | 7 | 8 | 5 | 1 | 1 | fails | 44% | timid |
| 20 | Tiptoe | 8 | 11 | 4 | 1 | 1 | fails | 35% | timid |
| 21 | Hush | 9 | 11 | 7 | 1 | 1 | fails | 35% | timid |
| 22 | Bedtime | 8 | 14 | 7 | 3 | 28 | fails | 38% | once |
| 23 | Lights out | 8 | 10 | 7 | 3 | 4 | fails | 32% | once |
| 24 | Night owls | 9 | 13 | 5 | 2 | 2 | fails | 30% | once |
| 25 | Pretty bird | 6 | 7 | 4 | 1 | 1 | fails | 22% | parrot |
| 26 | Echo | 8 | 11 | 5 | 1 | 3 | fails | 20% | parrot |
| 27 | Says it twice | 9 | 11 | 5 | 1 | 2 | fails | 20% | parrot |
| 28 | Market day | 9 | 11 | 7 | 1 | 9 | fails | 31% | mix |
| 29 | Festival | 9 | 12 | 6 | 1 | 4 | fails | 25% | mix |
| 30 | Lantern night | 9 | 11 | 8 | 1 | 7 | fails | 15% | mix (loop) |

Summary of the run:
- Solver bot: won 30/30 levels, 90/90 stars.
- Random bot: won 49.4% of 12,000 level attempts, 1.24 stars per attempt.
- Ramp (random-bot win rate, groups of three from L4): 70% 60% 57% 51% 47% 38% 33% 21% 24%.
- Do-nothing bot (sends the teller's message as it is): won 0/30.
- Straight path: solves only levels 1–2.
- Daily villages for 2026: 365/365 solvable and repeatable, 0 fallbacks. Shortest route 5–8 hops, mean 6.0.

The random bot is a weak measure: it walks only along paths and gets 3 sends, so the small early levels are easy for it on purpose. Since the follow-up below, `bots.mjs` asserts the ramp: each level from L4 is within 12 points of the median of the five levels around it, and each group of three is no easier on average than the group before, give or take 5 points. The last group (mixed villagers) is 3 points easier than the parrot group, inside that tolerance.

## What the browser check covers (`check.mjs`)

The check serves `experiments/` on port 0, answers `/notes/button.js` with an empty script, and records lab sends locally. It fails on any page error or console error.

Main pass, run on WebKit (iPhone 13) and on Chromium (Pixel 7):
1. Menu screenshot.
2. Level 1 solved by a touch drag (PointerEvents with pointerType 'touch').
3. Pause during a hop freezes the hop counter; resume continues it.
4. End card with 3 stars.
5. Level 2: a wrong route by taps, cleared by a tap on the teller, then the right route by taps.
6. Level 3:
   - A page blur pauses the game, and P resumes it.
   - 3 wrong sends make the hint button appear. The hint shows hop 1, then hop 2. Then the level is solved.
7. Reload: the save persists (opened 4, best stars for levels 1–3, "Play 4").
8. Mid-route screenshot on `?level=14`.
9. Daily village solved; its stars are saved.
10. Lab records: at least 4 solved runs, a 'left' run, send and hint events, and `runSource: 'agent'`.

A third pass runs Chromium at 360x640. It checks:
- no sideways scroll;
- Play is on screen;
- every level-30 villager is on screen;
- a screenshot of the parrot level 25.

A fourth pass runs Chromium at 1280x800 with a mouse. It takes a menu screenshot and solves level 1 by a mouse drag.

The desktop pass also opens level 29 and checks that every villager stays within 300 px of the middle.

A colour pass (Chromium) draws tokens and painter badges with `art.js`, then simulates deuteranopia and greyscale on the pixels and compares every pair of the four colours (see the follow-up below).

The main pass also takes screenshots of the level 2 and level 3 tutorials.

Last run: ok on webkit, ok on chromium, ok on chromium 360x640, ok on colour cues, ok on chromium desktop 1280x800.

## Reduced motion

With `prefers-reduced-motion: reduce`: no screen shake, no hint-button nudge, no squash and stretch on the hopping token, and a quarter of the celebration particles.

## Not verified

- Not run on a real phone.
- Audio was not heard on a real phone; only the WebAudio calls ran in the headless browsers.
- No person has played it. The quality bar ("a new person solves L1–3 without reading anything, and smiles") is untested.
- Desktop: only level 1 was played with a mouse, at 1280x800.
- Colour blindness: only a simulation was checked (deuteranopia and greyscale). No colour-blind person has looked at it. Protanopia and tritanopia were not simulated.

## Ideas of the builder

Labelled: these go beyond the brief.

- **Wildcard: "what they heard".** The end card shows a comic strip of the message at each villager, so the player sees how the news was bent on the way.
- **Teller at the bottom, listener at the top.** The dragging hand stays below the path it has drawn. The brief's example put the teller left or top; this is a deliberate change.
- **The route is a growing vine.** It has leaves and chevrons that point the way.
- **"now → want" pill.** The HUD compares the current message with the wanted one.
- **Live parrot badge.** The parrot's badge shows the change it will copy on the current route.
- **Villager reactions.** Each kind has its own silhouette and voice. Timid villagers shake when they refuse red. Sleepy villagers show "z z" after they speak.
- **Proposals not built:**
  - A sandbox where the player places changers to make a route work.
  - One-way gossip lanes (directed edges).
  - A daily streak.
  - Two listeners who want different news from one teller.

## Kit candidates

- **A fixed-tick loop helper.** It would cover the accumulator, the dt cap, pause freezing the tick and the interpolation alpha. This game writes its own in `index.html`.
- **A finger path sampler.** It would turn pointermove into evenly spaced samples (every 6 px here), for drag-to-draw input.
- **A check server helper.** It would serve `experiments/`, stub `/notes/button.js`, and capture lab sends. `check.mjs` has its own.

## For the lead

- The lab endpoint stores records only for slugs listed in `LAB_PROTOTYPES` (human-framework `apps/site/src/lab/games.ts`). `grapevine` must be added there before real lab sends are kept. The check captures sends locally, so it does not depend on this.
- Teller at the bottom versus the brief's left/top example (see above).
- Levels 16, 23, 25 and 26 changed on 2026-11-23 (see the follow-up below). Saved stars for those four numbers came from the old puzzles.

## Follow-up, 2026-11-23

The game went live less than an hour before this round. Changes:

1. **Level 1 ghost finger.** The finger now runs beside the route, about one villager-width to the right (mirrored to the left near the right edge). The painter's badge, which is what level 1 teaches, stays fully visible. Screenshots of levels 1, 2 and 3 were checked.
2. **A second cue for every colour.** Each colour has a small mark in the middle of every coloured shape:

   | Colour | Mark |
   | --- | --- |
   | red | dot |
   | yellow | ring |
   | blue | bar |
   | green | cross |

   The marks show in tokens, the thought bubble, the HUD pill, painter badges, the contrarian's badge and the timid villager's badge. They are drawn in soft ink, and skipped on shapes too small to hold them.

   `check.mjs` renders one token of each colour, simulates deuteranopia and greyscale, and asserts that every pair of colours differs on more than 3% of the token's shape. Deuteranopia uses the Machado 2009 matrix at full severity in linear RGB; I typed the matrix from memory and did not check it against the paper.

   | Result | Share of the token's shape that differs |
   | --- | --- |
   | Deuteranopia, least different pair | 59.7% |
   | Greyscale, least different pair (red and blue) | 3.7% |

   Red and blue have almost the same grey, so the marks alone separate them in grey. With the marks switched off, that pair differs on 0.0% and the check fails (mutation test run). The screenshot `colour-cues.png` shows tokens and badges in normal, deuteranopia and grey views.
3. **Ramp.**
   - `make-levels.mjs` now searches 48 seeds instead of 8 for levels 16, 23, 25 and 26 (`MORE_SEEDS`). The first 8 seeds are the same as before, so every other level came out byte-identical. A diff of `levels.js` changed only those four lines.
   - Random-bot win rates for the changed levels:

     | Level | Before | After |
     | --- | --- | --- |
     | 16 | 40% | 45% |
     | 23 | 11% | 32% |
     | 25 | 46% | 22% |
     | 26 | 15% | 20% |

   - Level 25 was not one of the three named outliers. It had to change because it was 26 points easier than its neighbours.
   - Saved stars are keyed by level number, so a player who had stars on these four levels keeps them for a different puzzle. This is accepted because the game had been live for less than an hour.
   - `bots.mjs` now asserts the ramp (see "Bot results"). Run against the old `levels.js`, it fails on levels 23, 25 and 26.
4. **Overlaps.**
   - **Flying token.** It still arcs from above one head to above the next. The arc now bows sideways away from the line between them, more on steep hops, so it passes beside the badge under the next villager instead of over it.
   - **Ghost tokens.** Each villager's "after me" token takes the best of four spots beside its head: the spot furthest from paths, from other villagers and their badges, from its own head and from the screen edge. The spots are chosen once per layout.
5. **Desktop.**
   - Correction: the earlier note said the board stays a narrow column on wide screens. That was true only for level 1. On wider levels the board stretched across the whole window.
   - From 700 px wide, the board is now held to a 600 px column in the middle. Both sides become a street: rows of houses with lit windows, chimneys, trees and lamp posts, plus swaying lantern strings between the rows.
   - Phones (narrower than 700 px) are unchanged.


## 2026-11-23: understood at once (tester t1, note #138)

The lab asked (#127) whether the tester understood what to do without anyone explaining. Answer: "Evet, hemen" (yes, right away). Recorded; no change. This is the first sign that Grapevine's first minute works for a newcomer. Whether it is fun was not asked.
