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
- `route.mjs`: a route check of the endless generator that does not use the bots' search (see the follow-up below). `bots.mjs` also uses its `bands()` to cross one hazard band at a time.

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

Endless pond opens after stage 3. Rows are generated ahead, each from its own seed. A lily-pad checkpoint every 2 rows adds 2 + 3 × min(line, 6) seconds (`checkGain` in `sim.js`) and scores 20 × n(n+1)/2 + 10, so a short line shortens the run. Start time 40 s.

Teaching: stage 1 waits for the first touch with a ghost finger and "Hold here". In stages 1 and 2, a turn of more than 0.9 rad shows a dotted trail for 3.2 s with "They follow your path" (at most 3 times). Stopping bunches the line into a huddle (view only).

First-time hint: the shared kit hint (`../kit/hint.js`, kind `hold-and-move`, key `ducklings:hint`, 130 px above the bottom) shows after 3 s of idle play to a player with no save. While it shows, the stage-1 ghost finger waits; the first touch ends it for good. `check.mjs` asserts that `?hint=hand` shows it after idle play and that a finger down removes it.

`?level=N` opens on stage N. `?fast=K` runs K ticks per tick (checks only).

Save: one key `ducklings-save`: `{ v, sound, opened, stars, best, endless, home, album, taught }`.

## Bots (`fnm exec --using=26.12.0 node bots.mjs`, about 34 s)

Planner and greedy are the same search (4.2 s look-ahead, 16 headings plus goal and wait, re-planned every 0.2 s, crossing one hazard band at a time). They differ in one thing: planner also tests each duckling at its delayed trail position; greedy tests the mother only. Idle never touches.

```
stage  bot      end    arrived   of       stars    hits   scared quacks time   
1      planner  nest   2         2        ***      0      0      0      0       17.5
1      greedy   nest   2         2        ***      0      0      0      0       17.5
1      idle     dusk   0         2        -        0      0      0      0       60.0
2      planner  nest   6         6        ***      0      0      0      0       35.9
2      greedy   nest   6         6        ***      0      0      0      0       35.9
2      idle     dusk   0         6        -        0      0      0      0       75.0
3      planner  nest   7         7        ***      0      0      0      0       38.3
3      greedy   nest   6         7        **       0      1      0      0       37.9
3      idle     dusk   0         7        -        0      0      0      0       80.0
4      planner  nest   7         7        ***      0      0      0      0       39.7
4      greedy   nest   7         7        ***      0      4      0      0       49.4
4      idle     dusk   0         7        -        0      0      0      0       85.0
5      planner  nest   7         8        ***      0      6      1      3       53.4
5      greedy   nest   2         8        -        0      14     6      0       49.8
5      idle     dusk   0         8        -        0      0      0      0       85.0
6      planner  nest   8         8        ***      0      0      0      0       40.4
6      greedy   nest   4         8        *        0      8      4      0       46.5
6      idle     dusk   0         8        -        0      0      0      0       85.0
7      planner  nest   9         9        ***      0      0      0      0       42.3
7      greedy   nest   4         9        *        0      9      3      0       47.9
7      idle     dusk   0         9        -        0      0      0      0       95.0
8      planner  nest   9         9        ***      0      0      0      0       53.8
8      greedy   nest   1         9        -        0      15     6      0       72.1
8      idle     dusk   0         9        -        0      0      0      0       110.0
total arrived: planner 55, greedy 32

other seeds, 6 each: nest runs and mean arrived / total
stage  bot      nest         arrived       
3      planner  6/6          7.0 / 7.0     
3      greedy   6/6          3.5 / 7.0     
5      planner  6/6          8.0 / 8.0     
5      greedy   6/6          2.8 / 8.0     
8      planner  6/6          8.0 / 9.0     
8      greedy   6/6          3.7 / 9.0     

endless route check, 30 seeds to 60 m: 30 passable, 30 on time
endless, 20 seeds, up to 90 s: score (end, distance, line)
seed   planner                    greedy                     idle  
101    3930 (alive, 17m, 10)      1810 (alive, 20m, 5)       0     
202    4260 (alive, 20m, 8)       1820 (alive, 15m, 5)       0     
303    4450 (alive, 20m, 8)       1730 (alive, 20m, 4)       0     
404    5530 (alive, 22m, 10)      3080 (alive, 18m, 10)      0     
505    3500 (alive, 19m, 5)       3930 (alive, 18m, 7)       0     
606    3930 (alive, 16m, 8)       120 (dusk, 3m, 2)          0     
707    3930 (alive, 17m, 10)      2690 (alive, 19m, 7)       0     
808    6320 (alive, 20m, 9)       2220 (alive, 22m, 4)       0     
909    3630 (alive, 15m, 8)       2670 (alive, 20m, 5)       0     
1010   2740 (alive, 16m, 6)       1490 (alive, 18m, 4)       0     
1111   2950 (alive, 17m, 8)       2590 (alive, 16m, 6)       0     
1212   3750 (alive, 17m, 9)       2170 (alive, 21m, 6)       0     
1313   3390 (alive, 18m, 10)      1180 (dusk, 14m, 1)        0     
1414   2330 (alive, 17m, 5)       1010 (alive, 20m, 1)       0     
1515   3880 (alive, 17m, 9)       1540 (alive, 19m, 0)       0     
1616   6040 (alive, 20m, 10)      3860 (alive, 18m, 5)       0     
1717   3590 (alive, 19m, 4)       3660 (alive, 15m, 4)       0     
1818   5350 (alive, 15m, 10)      1640 (alive, 18m, 4)       0     
1919   4910 (alive, 19m, 9)       1670 (alive, 21m, 1)       0     
2020   3640 (alive, 20m, 7)       2080 (alive, 19m, 5)       0     
planner beats greedy on 18 of 20

all checks passed in 34.0 s
```

Checks it enforces (exits non-zero on failure): every non-pike hazard warns at least 0.7 s; same seed and inputs give the same run (stage 4 and endless); per stage the planner reaches the nest, gets 3 stars, brings home at least 75 %, and finishes in at least 15 s (stage 1) or 30 s and at most 0.75 × the time limit; idle fails every stage; greedy's total is at most 0.8 × planner's; planner reaches the nest on at least 80 % of other seeds; endless: on 30 seeds every hazard band in the first 60 m is passable and the clock stays ahead of dusk (route check); planner beats greedy on at least 16 of 20 endless seeds.

Reading the table: stage 1 is a lesson and has no trail hazard, so greedy equals planner there on purpose. Since the bots cross one band at a time (follow-up below), greedy also does as well as planner on the fixed seeds of stages 2 and 4; the separation now comes from stages 5 to 8 and from other seeds. On stage 5 the planner scares 6 and loses 1 but still makes the 3-star par.

## Browser check (`SHOTS=<dir> fnm exec --using=26.12.0 node check.mjs [filter]`)

Serves `experiments/` on port 0, answers `/notes/button.js` with an empty script, routes the lab endpoint and records what is sent. Runs WebKit iPhone 13 and Chromium Pixel 7 in full, and Chromium 360x640 for layout. Fails on page errors, console errors and 4xx/5xx responses. Input is touch PointerEvents dispatched on the canvas.

Full run asserts: lab notice on the menu; no audio context before Play and one after; stage 1 waits for a touch with one follower; a touch moves her and starts the roll call; a second finger quacks; the pause button freezes sim time and Resume continues it; blur pauses and P resumes; stage 1 played by a steering finger to the end card with outcome `nest`; the save blob has stars, opened stage, taught and home count; the lab run was sent with outcome `nest`, its summary and `join` events; a reload keeps progress and the menu offers stage 2; the sound setting survives a reload; leaving stages 7 and 5 through the pause menu sends a `left` run. The 360x640 run checks the Play button is on screen, plays stage 4 briefly, then plays stage 5 (seed 5) and asserts a warning hidden under the HUD was repeated below it. Screenshots: menu, teach, paused, mid-play, end card, stage 7, stage 5 (and menu and stage 4 at 360x640).

Last result: all three runs pass.

## Not verified

- A real phone (touch feel, safe areas on a notched device, frame rate).
- Real-phone audio (only that an AudioContext is created in the Play tap).
- A person playing: whether a newcomer understands "they follow my path" within 20 s and feels protective of the line.
- The lab server storing records: the check fakes the endpoint. The lab server must list `ducklings` in its prototype list before records are kept.
- Desktop keyboard play beyond P to resume (arrow keys and Space are wired but not driven by the check).

## Ideas of the builder

These are the builder's choices, not from the brief:

- Roll call (follow-up): see below.
- Personalities (the brief's wildcard, builder's pick): each duckling has a name and a trait (eager, sleepy, brave, curious, tiny, loud). Traits change its trail gap and its look; the end card names who came home ("Clover, the sleepy one").
- A second scare means gone: a duckling scared twice hides in the reeds for the rest of the stage. Without this, re-collecting made careless play almost as good as careful play.
- A Quack button (bottom left, cooldown ring) in addition to the second finger and double tap, so the action is discoverable.
- An always-on faint trail line behind the mother, besides the teaching flash.
- An album count: ducklings brought home over all runs, kept in the save.
- Endless time per checkpoint grows with the line, so losing ducklings ends the run sooner.
- The route check (`route.mjs`) as a generator test, independent of the bots.

## Kit candidates

- A touch-finger helper for checks (dispatching pointer events with ids, a second finger) — `check.mjs` has one.
- A safe-area probe (a fixed element with `env(safe-area-inset-*)` padding read once at resize).
- `kit/lab.js` flush on hide: navigating away mid-run in WebKit makes the page report "Cannot load blob ... due to access control checks" from the gzip `Blob.stream()` flush. The check here avoids it by leaving through the pause menu; the partial-run record on a real Safari tab close may be lost. Not fixed here (kit is out of scope).
- `kit/check/phone.mjs` has no section for this game.

## Follow-up, 2026-11-23

**1. Endless seed 202, planner stalled at 6 m.** Reproduced: the planner sat below a double log lane (y 5.4 and 5.7) from 19 s to 57 s, sliding sideways, and twice crossed with a line of 6, scattered ducklings, then swam back across the logs to fetch them. Cause, in two parts:

- Bot weakness. The planner's moves are "go one way for 0.9 s, then head for the goal". It cannot express "cross the first log lane, stop in the calm strip between lanes so the line bunches, then cross the second". With 6 ducklings both log windows rarely line up for one straight crossing. A person can see the calm strip and stop there. Evidence: `route.mjs` (below) crosses that band on seed 202, and on all 30 checked seeds.
- Generator tuning. The old checkpoint gain (3 + 1.2 per duckling, at most 9 s) was below what any route needs: the route check's earliest clock costs about 17 to 18 s per checkpoint, and under the old gain it reached dusk at 7 to 15 m on every seed tried (seed 202 at 10.1 m). So every run, however careful, ended near 10 m. That is a checkpoint that cannot be reached in time, so the generator changed.

No sealed gap was found: every band to 60 m is passable on 30 seeds.

Fixes: checkpoint gain is now 2 + 3 × min(line, 6) (20 s with 6 ducklings, 8 s with 2). The bots now aim for the free water just past the next hazard band (`stepping` in `bots.mjs`), which the planner needed to stop stalling.

**Route check** (`route.mjs`): the pond is cut into bands of y that some hazard can reach. A band passes if, from free water below it, a mother with a bunched line of 6 (gap 0.42 s each, no quack) can swim straight up some lane (0.1 to 0.9 in 0.05 steps), starting within 15 s, using the sim's own `moveMom` (rocks, reeds, gusts) and `hitAny`, with every body clear until the last duckling is past. A forward pass takes the first crossing that works and compares that clock with dusk at each checkpoint. `bots.mjs` asserts all 30 seeds (101 × k) pass to 60 m and stay on time. Known-bad case: the same check with a line of 10 or 16 fails on all 10 seeds tried (log lanes, bikes, herons), so it does detect windows that are too short.

Open: a player holding the full line of 10 cannot cross a log lane straight without a quack; windows are sized for 4 + d. Quack makes it possible but the route check does not model quack.

**2. Endless tuning.** Planner beats greedy on 18 of 20 seeds at 90 s (asserted at least 16). The two losses (505, 1717) are close (3500 against 3930, 3590 against 3660).

**3. HUD.** A soft strip (opaque at the top, fading out about 18 px under the score) sits behind the hearts, count pill and sun bar, so a hazard drifting in at the top shows through it faded. A hazard warning that sits under the HUD is repeated as a "!" just below the strip at the same x. Checked at 360x640: the check plays stage 5 and asserts at least one such repeat; see the screenshot `chromium-360x640-3-stage5.png`.

**4. Duckling interpolation.** Done, and cheap: the trail, the wake and each duckling are drawn at `delay + (1 − alpha) × tick`, the same partial tick behind that the mother is drawn. One extra add per duckling per frame.

**5. Builder's idea: roll call.** When she first sets off, each duckling in turn hops and peeps up a scale (170 ms apart), and its name floats up beside it for 1.6 s. A quack is answered down the line the same way (hops and peeps, no names). A duckling that joins shows its name too. This puts the personalities in the first seconds instead of only on the end card, and the quack echo repeats the game's rule: they do what she did. Not tested with a person.

## 2026-11-23: "not bad" (tester t1, note #139)

The lab asked (#129) how Follow Me was. Answer: "Fena değil" (not bad), from the choices fun, not bad, boring, hard or annoying. Recorded; no change. Among the three new experiments the tester chose Fix-It Stall to grow (note #103), so Follow Me stays as it is.
