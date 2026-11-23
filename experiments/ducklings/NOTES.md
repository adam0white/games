# Follow Me

A mother duck leads her ducklings up a pond to the nest; you steer her with one finger, and every duckling swims exactly the path she swam a moment earlier. Logs, a pike, bikes, gusts, a snapping turtle and a heron cross that path, so a route that is safe for her can still catch the little ones behind her.

## The idea it rebuilds

The archived "What the Child Saw" was about a small one copying what it watched the grown-up do. Here that is the whole rule: duckling n is where the mother was about n × 0.42 s ago. You do not control the ducklings at all. You protect them by choosing a path that will still be safe when they get to it, which means looking at where they are going to be, not where she is.

## Files

- `index.html`: view, input, camera, sound, cards, save, lab recording.
- `sim.js`: the rules. Fixed tick (1/60 s), seeded, pure; no DOM. Hazards are closed-form functions of time (`view`, `hits`), shared by the sim, the bots and the view.
- `art.js`: all drawing (code-drawn canvas).
- `bots.mjs`: proof of the rules (see below). `node bots.mjs stage N [planner|greedy|idle]` prints one run.
- `check.mjs`: browser check (see below).

## Rules and tuning

The pond is 1 unit wide; y grows upward.

| What | Number |
| --- | --- |
| Tick | 1/60 s; view interpolates the mother between ticks |
| Mother top speed | 0.28 units/s, eased (rate 9/s; 6/s while stunned) |
| Finger target | 70 CSS px above the finger, recomputed every tick from the held screen point |
| Trail gap | 0.42 s per duckling × trait factor (eager 0.85, sleepy 1.18, others 1) |
| Catch-up | a duckling behind its place runs at 1.9× trail speed; ahead of its place it stands still |
| Quack | squeezes gaps to 0.35× for 1.4 s; 6 s cooldown. Second finger, double tap, Space or Q |
| Pick-up | mother within 0.075 of a waiting duckling; it joins the end of the line |
| Line cap | 10 |
| Hearts | 3. A hit costs 1 heart, 0.6 s stun, 2 s safe time |
| Scare | first hit: the duckling flees 1.1 s back along the trail and waits with "!", re-collectable. Second hit: it is gone ("hid in the reeds") |
| Reeds | 0.45× speed inside |
| Warnings | every hazard warns at least 0.7 s (logs, turtle, gust, heron 1.0 s, bikes 1.1 s); the pike is always visible as a shadow on a dashed circle |
| Home | mother within 0.15 of the nest; ducklings arrive within 0.17; the stage ends when all in the line are home |
| Score | join +10 × line length; arrival +50 × arrival index; home bonus 2 per second left + 25 per heart |
| Stars | ducklings home against the stage par (1/2/3 stars) |
| Fail | timer runs out before home ("dusk"), or hearts reach 0 |

Hazard windows are sized from `need = n × GAP`, the time the whole line of n takes to pass a point, plus a margin that shrinks per stage (`ease = max(0, 1 − 0.12 d)`, `d = max(0, stage − 2)`). A crossing that is just long enough for the mother is too short for her line unless you time it.

Stages (fixed layouts, seed `7919 n + 13`; `?seed=` overrides):

| Stage | New thing | Start + lost | Time | Par (1/2/3 stars) |
| --- | --- | --- | --- | --- |
| 1 | one slow log, ghost finger, one duckling to collect | 1 + 1 | 60 s | 1 / 2 / 2 |
| 2 | logs, reeds | 2 + 4 | 75 s | 2 / 4 / 6 |
| 3 | pike | 2 + 5 | 80 s | 3 / 5 / 7 |
| 4 | snapping turtle | 2 + 5 | 85 s | 3 / 5 / 7 |
| 5 | bikes with a bell on a boardwalk | 3 + 5 | 85 s | 3 / 6 / 7 |
| 6 | gust (pushes the mother only) | 3 + 5 | 85 s | 3 / 6 / 7 |
| 7 | heron shadow sweep | 3 + 6 | 95 s | 3 / 6 / 8 |
| 8 | everything | 3 + 6 | 110 s | 3 / 6 / 8 |

Endless pond opens after stage 3. Rows are generated ahead, each from its own seed. A lily-pad checkpoint every 2 rows adds 3 + 1.2 × min(line, 5) seconds and scores 20 × n(n+1)/2 + 10, so a short line shortens the run. Start time 40 s.

Teaching: stage 1 waits for the first touch with a ghost finger and "Hold here". In stages 1 and 2, a turn of more than 0.9 rad shows a dotted trail for 3.2 s with "They follow your path" (at most 3 times). Stopping bunches the line into a huddle (view only).

`?level=N` opens on stage N. `?fast=K` runs K ticks per tick (checks only).

Save: one key `ducklings-save`: `{ v, sound, opened, stars, best, endless, home, album, taught }`.

## Bots (`fnm exec --using=26.12.0 node bots.mjs`, about 18 s)

Planner and greedy are the same search (4.2 s look-ahead, 16 headings plus goal and wait, re-planned every 0.2 s). They differ in one thing: planner also tests each duckling at its delayed trail position; greedy tests the mother only. Idle never touches.

```
stage  bot      end    arrived   of       stars    hits   scared quacks time
1      planner  nest   2         2        ***      0      0      0      0       17.5
1      greedy   nest   2         2        ***      0      0      0      0       17.5
1      idle     dusk   0         2        -        0      0      0      0       60.0
2      planner  nest   6         6        ***      0      0      0      0       34.0
2      greedy   nest   0         6        -        0      12     6      0       54.2
2      idle     dusk   0         6        -        0      0      0      0       75.0
3      planner  nest   7         7        ***      0      0      0      0       38.2
3      greedy   nest   6         7        **       0      1      0      0       37.8
3      idle     dusk   0         7        -        0      0      0      0       80.0
4      planner  nest   7         7        ***      0      0      0      0       38.9
4      greedy   nest   3         7        *        0      11     4      0       51.4
4      idle     dusk   0         7        -        0      0      0      0       85.0
5      planner  nest   8         8        ***      0      0      0      1       36.7
5      greedy   nest   2         8        -        0      13     6      0       50.3
5      idle     dusk   0         8        -        0      0      0      0       85.0
6      planner  nest   8         8        ***      0      0      0      0       40.2
6      greedy   nest   5         8        *        0      8      3      0       53.8
6      idle     dusk   0         8        -        0      0      0      0       85.0
7      planner  nest   9         9        ***      0      0      0      0       42.1
7      greedy   nest   5         9        *        0      8      4      0       47.8
7      idle     dusk   0         9        -        0      0      0      0       95.0
8      planner  nest   9         9        ***      0      0      0      1       53.7
8      greedy   nest   4         9        *        0      13     5      0       69.4
8      idle     dusk   0         9        -        0      0      0      0       110.0
total arrived: planner 56, greedy 27

other seeds, 6 each: nest runs and mean arrived / total
3      planner  6/6   7.0 / 7.0
3      greedy   6/6   2.7 / 7.0
5      planner  6/6   7.7 / 8.0
5      greedy   6/6   1.8 / 8.0
8      planner  6/6   8.2 / 9.0
8      greedy   6/6   3.2 / 9.0

endless, 4 seeds, up to 180 s: score (end, distance)
planner  1790(dusk, 11m)  650(dusk, 6m)  4570(dusk, 22m)  5820(dusk, 23m)
greedy   2020(dusk, 15m)  1740(dusk, 13m)  710(dusk, 13m)  4340(dusk, 23m)
idle     0 on all four
```

Checks it enforces (exits non-zero on failure): every non-pike hazard warns at least 0.7 s; same seed and inputs give the same run (stage 4 and endless); per stage the planner reaches the nest, gets 3 stars, brings home at least 75 %, and finishes in at least 15 s (stage 1) or 30 s and at most 0.75 × the time limit; idle fails every stage; greedy's total is at most 0.8 × planner's; planner reaches the nest on at least 80 % of other seeds.

Reading the table: stage 1 is a lesson and has no trail hazard, so greedy equals planner there on purpose. Stage 3 (pike) is almost as easy for greedy as for planner on its fixed seed; on other stage-3 seeds greedy brings 2.7 of 7. In endless, planner beats greedy on mean score (3208 against 2203) but not on every seed: on seed 202 the planner stalls early. Unresolved.

## Browser check (`SHOTS=<dir> fnm exec --using=26.12.0 node check.mjs [filter]`)

Serves `experiments/` on port 0, answers `/notes/button.js` with an empty script, routes the lab endpoint and records what is sent. Runs WebKit iPhone 13 and Chromium Pixel 7 in full, and Chromium 360x640 for layout. Fails on page errors, console errors and 4xx/5xx responses. Input is touch PointerEvents dispatched on the canvas.

Full run asserts: lab notice on the menu; no audio context before Play and one after; stage 1 waits for a touch with one follower; a touch moves her; a second finger quacks; the pause button freezes sim time and Resume continues it; blur pauses and P resumes; stage 1 played by a steering finger to the end card with outcome `nest`; the save blob has stars, opened stage, taught and home count; the lab run was sent with outcome `nest`, its summary and `join` events; a reload keeps progress and the menu offers stage 2; the sound setting survives a reload; leaving stages 7 and 5 through the pause menu sends a `left` run. The 360x640 run checks the Play button is on screen and plays stage 4 briefly. Screenshots: menu, teach, paused, mid-play, end card, stage 7, stage 5 (and menu and stage 4 at 360x640).

Last result: all three runs pass.

## Not verified

- A real phone (touch feel, safe areas on a notched device, frame rate).
- Real-phone audio (only that an AudioContext is created in the Play tap).
- A person playing: whether a newcomer understands "they follow my path" within 20 s and feels protective of the line.
- The lab server storing records: the check fakes the endpoint. The lab server must list `ducklings` in its prototype list before records are kept.
- Desktop keyboard play beyond P to resume (arrow keys and Space are wired but not driven by the check).

## Ideas of the builder

These are the builder's choices, not from the brief:

- Personalities (the brief's wildcard, builder's pick): each duckling has a name and a trait (eager, sleepy, brave, curious, tiny, loud). Traits change its trail gap and its look; the end card names who came home ("Clover, the sleepy one").
- A second scare means gone: a duckling scared twice hides in the reeds for the rest of the stage. Without this, re-collecting made careless play almost as good as careful play.
- A Quack button (bottom left, cooldown ring) in addition to the second finger and double tap, so the action is discoverable.
- An always-on faint trail line behind the mother, besides the teaching flash.
- An album count: ducklings brought home over all runs, kept in the save.
- Endless time per checkpoint grows with the line, so losing ducklings ends the run sooner.

## Kit candidates

- A touch-finger helper for checks (dispatching pointer events with ids, a second finger) — `check.mjs` has one.
- A safe-area probe (a fixed element with `env(safe-area-inset-*)` padding read once at resize).
- `kit/lab.js` flush on hide: navigating away mid-run in WebKit makes the page report "Cannot load blob ... due to access control checks" from the gzip `Blob.stream()` flush. The check here avoids it by leaving through the pause menu; the partial-run record on a real Safari tab close may be lost. Not fixed here (kit is out of scope).
- `kit/check/phone.mjs` has no section for this game.
