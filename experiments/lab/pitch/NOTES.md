# Paper Pitch

A lab page at `/lab/pitch/`. Built 2026-11-24 from pick 1 of `docs/ideas/shortlist-2026-11-24.md`. Listed on the lab index. Not registered with `lab.js`, so nothing is recorded or sent.

## Rules used

Paper soccer, as described at https://en.wikipedia.org/wiki/Paper_soccer (read 2026-11-24).

- Points on a grid 8 squares wide and 10 tall. Each short side has a goal 2 squares wide and 1 deep, centred. The ball starts on the centre point.
- A move draws a line from the ball to an orthogonally or diagonally adjacent point. A line already drawn cannot be drawn again. The boundary counts as drawn lines.
- If the ball lands on a point that any line already touches (boundary included), the same player moves again. The turn ends on a point with no lines.
- A ball in a goal wins for that goal's attacker, so an own goal counts for the opponent. A player whose ball has no legal move loses. Wikipedia gives two options for this case, a draw or a loss for the player who cannot move. The brief chose the loss.
- Lines may cross. Wikipedia's general rules do not forbid crossing, and only the variants mention it.

Wikipedia does not describe the goal mouth in detail. These choices are ours:

- The two segments of the goal line inside the mouth are open. The rest of each end line is boundary.
- The ball scores when it reaches any of the three points at the back of the goal.
- It may enter the goal only from a point in the mouth (the centre point or a post). A diagonal from the point beside a post would cut across the corner outside the pitch, so it is not a move. The first build allowed it. The rules oracle in `bots.mjs` used the same geometry and also missed it. A screenshot caught it.
- The posts touch the boundary, so a ball landing on a post bounces. The centre of the mouth has no lines at the start, so it does not bounce.

Player 0 (blue, the player at the bottom) attacks the top goal. Player 1 (red, the bot or the second player) attacks the bottom goal. A match is best of three goals (first to two), with a fresh sheet for each goal. Kick-off alternates.

## The three twists

1. **The match is a drawing.** Everything is drawn in code on squared paper: wobbly pencil boundary and nets, blue and red ballpoint lines that draw themselves (150 ms for a player, 250 ms for the bot), and a small ball. The end card shows the finished pitch as a picture, with a small title and the score. Save picture uses `navigator.share` with a PNG file where the browser can share files, and a download otherwise.
2. **No words needed to learn.** Legal next points pulse in the colour of the player to move. A point where you would bounce has a small spring beside it. Tap near a point (the nearest legal point within max(44 px, 1.3 cells)), or drag from the ball towards one. The first match is on a 6 x 8 pitch against Easy. After 3 s with no tap, `hint.js` (kind `tap`) shows a finger tapping the legal point nearest the middle column.
3. **Today's pitch.** `daily(date)` in `sim.js` is seeded by the UTC date. It plays seeded self-play on 8 x 10, with both sides drifting towards the top goal. It stops at a position where blue is to move and the shortest scoring chain in one turn is 3 to 7 segments, found by iterative deepening. The player gets 3 attempts. An attempt counts once its first line is drawn, so a reload does not give a free try. After a miss the sheet resets. After three misses, the answer is drawn in dashed pencil. The result is saved per device, and a finished day reopens on its result card. `?date=YYYY-MM-DD` picks a date for testing.

## Bots

`botTurn(state, level, rng)` returns a whole turn. The bots are pure, seeded, and capped by node count, not by time.

- Easy: a random legal segment, skipping any that lose at once (an own goal, or a dead end), repeated until the turn ends.
- Medium: depth-first over every way to finish the turn, goalward moves first, capped at 3000 segments. It scores the ball's distance to the goal it attacks, with a pull to the middle near that goal.
- Hard: the same chain search (cap 2500). It keeps the 14 best distinct end positions, then looks one reply ahead: the opponent's best whole turn under Medium's evaluation, capped at 500 segments. It takes a winning chain at once.

## Measured (node bots.mjs, Node 26.13.1, this Mac, 2026-11-24)

The final run was on a heavily loaded machine (load average about 470). Hard's time is CPU time, because wall time on a shared machine reached 900 ms. An earlier run on a quiet machine gave a 3.5 ms wall-time maximum.

```
rules: 2000 random games, 68668 segments, 29640 bounces, 809 goals, 1191 stuck endings, all invariants hold (16.3 s)
bots: Medium beat Easy in 200/200 games (100.0%), seats and kick-off alternated
bots: Hard beat Medium in 200/200 games (100.0%), seats and kick-off alternated; Hard turn CPU time in Node: mean 0.70 ms, max 13.3 ms
daily: 60 days from 2026-11-24 verified and distinct; shortest chains {"3":37,"4":12,"5":6,"6":4,"7":1}; 2.1 ms mean, 20.3 ms max per day
```

- The rules invariants are checked against an oracle in `bots.mjs` with its own geometry. Legal moves match. No segment is drawn twice. The ball stays on the pitch and moves one step. The midpoint of every line lies on the pitch or in a goal box. Every game ends. The turn passes exactly when the landing point had no line.
- `node bots.mjs --mutate` turns off "boundary points bounce". The bounce assertion fails, and the script reports it and exits 0.
- `check.mjs` (Playwright) runs WebKit on iPhone 13 and Chromium on Pixel 7. It also runs Chromium at 360x640 and 390x844. It covers:
  - a full first match against Easy, played by tapping, to the end card, then Save picture and a one-tap rematch;
  - pause on page hide, with the bot frozen while paused;
  - the save after a reload;
  - one move by dragging from the ball;
  - a two-player match played to its end card;
  - one missed daily attempt, then the Node solver's chain tapped on the page;
  - a finished daily reopening on its result;
  - at the two small sizes, a lost match against Hard, where the second loss in a row drops the level to Medium, and the third missed daily try showing the answer card;
  - no console errors, no requests off the local server, and no horizontal overflow.
- Hard replied in 0.8 s on a quiet machine and 1.3 to 1.8 s on the loaded one. Those times include the 380 ms wait and the drawing.

The kit's `check/phone.mjs` has two entries for this page, `lab/pitch` (an old save survives, a tap draws a line, leaving pauses) and `hint lab/pitch` (first-time help). The page acts when the finger lifts, so it does not use the shared `hinted` helper, which asserts before the lift.

## Not verified

- A real phone: touch feel, the pencil sound, audio unlock, and share sheets. The share and download paths were only exercised in emulation, and `navigator.share` was stubbed.
- Human play: whether the bots feel fair, and whether the jump from Easy to Medium is too steep. The check plays only with bot-chosen moves. Medium beat Easy in all 200 games and Hard beat Medium in all 200, so the levels are far apart.
- Hard's speed on a phone. It was measured in Node only (max 3.5 ms; the budget is 150 ms).
- Daily puzzles are measured for 60 days only. Most have a shortest chain of 3, so they may feel easy.

## Play a friend

Create a table from the menu and share its four-letter code or link. A friend can enter the code or open the link directly. A name is optional and saved on the device. The table seats the first player as Blue and the second as Red. Each phone puts its own goal at the bottom and shows which seats are connected.

Both phones apply each segment when it comes back from the table. The server seed picks the first kick-off, then kick-offs alternate. The same move log rebuilds the sheet and score after a reload or drop. Either player can take their turn while their friend is disconnected. The next sheet opens automatically after a point, and the first player to two points wins. A rematch starts when both players vote.

The shared room client keeps the seat key in browser storage. Reopening the same link in that browser reclaims the seat while the table exists. Friend matches leave the bot, daily and shared-board records alone.

The phone check targets Playwright's iPhone 13 and Pixel 7 profiles and uses the Worker's table protocol functions in Node. It covers joining, replay after reload and disconnect, full tables, move validation and rematch. The builder's sandbox could not start a browser, so the lab ran the check itself on 2026-11-24: it passes on both profiles, with a 22-segment match, and the lab looked at the six friend screenshots per browser. Not verified: two real phones, the share sheet, a slow or lossy network.

## Languages

The page plays in English and Turkish through `experiments/kit/i18n.js`. `words.js` holds both tables (98 keys each, same `{variables}`); `main.js` and `index.html` take every visible string, aria-label, the document title, the first-play hint label, the share text, the saved picture's title and the download name from it. Dates use `toLocaleDateString(lang())`. A small EN/TR button sits beside Sound on the menu and the pause card; it switches without a reload, redraws every text and remembers the choice in `kit:lang` (and updates `?lang=` if present). Save format, storage keys, rules and the friends' table protocol are unchanged. Table codes carry `lang="en"` so CSS uppercase does not turn `i` into `İ`.

Title decision: Turkish uses "Kâğıt Futbolu", the traditional name of the pencil game, as the whole title (Paper Pitch is not kept as a subtitle). Names are never given suffixes: "Bekleniyor: {name}", "Bağlantı koptu: {name}." The three bot levels are Kolay, Orta, Zor.

`check.mjs` opens everything with `?lang=en`, compares the two tables in Node (keys and variables), and on each phone profile and at 360x640 runs a Turkish pass: menu, hint, pause, between and end cards, daily date, friend card and table lines, the switch with a reload, raw-key and stray-English scans, overflow and console errors. Screenshots go to `WORD_SHOTS`.

The Turkish was written by an AI and has not been read by a native speaker. Least sure: "Çıkmaz!" (Stuck!), "Rövanş", "Bu turda gol at", "Yol buradan geçiyordu".

## Open ideas

- A shared board for the daily: how many tries each player needed.
- Harder dailies: prefer chains of 4 to 7, or require the shortest chain to start away from the goal.
- A softer Medium (sampled rather than greedy) to smooth the steps between levels.

## Play recording (2026-11-24)

The page sends play records to the lab under the name `pitch` through `kit/lab.js` (the name is in human-framework `LAB_PROTOTYPES` once its pull request lands; until then every send is refused). The recording notice is on the menu card and on the friend card (a friend's link opens there); the off switch is on the pause card, which is the table menu at a friend's table. A run is one match against the bot (`won` or `lost`), a two-player match (`finished`), today's pitch (`won` if scored, `lost` otherwise; event `daily-finished`) or a match at a friend's table (`won` or `lost` for the seat). Leaving by Menu or Restart ends it `quit`. Events: `goal` (who, how) and `table-joined` (the seat only). Names, table codes and links are never sent; the check proves it with the names Ada and Ben and the code.

`check.mjs` answers the lab address itself (no check reaches the real one), loads the page with `?labRunSource=agent`, and asserts: the notice is on the page before play, a played run sends one run record under `pitch` with its events record, and after the switch is turned off a further run sends nothing and the player id is removed. Not verified: delivery to the real lab (the Worker does not accept this name yet), a real phone.
