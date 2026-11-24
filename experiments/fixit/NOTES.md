# Fix-It Stall

## Status

Round 4, 2026-11-24: Night market adds levels 33–44 and raises the job count to 18. A slower-clock retry is available after two failures on a level. See “Round 4: Night market and assist” for the current rules and checks.

Round 3, 2026-11-24: levels. Play now goes to a map of 32 levels, each with one goal, one to three stars, and the next level unlocked by clearing it (tester t1, notes #150 and #157). Four new jobs (oil a squeaky door, unstick a zip, wind a toy car, thread a needle) bring the total to 15. The random shift stays as the "open stall", opened by level 8. See "Round 3: levels" below.

Round 2, 2026-11-23. tester t1 picked Fix-It Stall as the game to work on more, out of the three (note #103, answering #100: "Fix-It Stall"). This round fixed the round-1 weaknesses (interpolation, overlapping customers, keyboard), added depth (daily stall, golden customer, two new jobs, streak feedback), and did a play-feel pass on fresh screenshots.

## What it is

Fix-It Stall is a phone arcade game about a street repair stall. Customers queue with broken things; you fix each one with a single hands-on gesture (turn, pull, tap, flick, rub, set, hook, push and hold, swipe, sew, pump, tap in time, wiggle up, pull back and let go, steer and hold still) before their patience runs out, and the thing works for a moment while they cheer and pay. Since round 3 you play a map of numbered levels, each with its own goal.

## The idea it rebuilds

The idea comes from the archived game Copper Afternoon: a small repair bench where the pleasure is in doing the repair with your hands. tester t1 could not tell what to tap, saw taps do nothing, met words they did not know, could not tell whether a repair had worked, had the part hidden under their own finger, and waited with nothing to do. Fix-It Stall keeps only the idea of hands-on repair. Each complaint has a direct answer here:

| Complaint | Answer in Fix-It Stall |
| --- | --- |
| Could not tell what to tap | One object on the bench at a time. A one- or two-word verb ("Turn!", "Pull!") above it. A pulsing ghost finger shows the gesture the first two times a job appears, and again, faintly, after 1.5 s with no progress. |
| Taps did nothing | Every touch is answered in the same frame. A touch on the part makes it move. A touch elsewhere makes a ripple and a soft sound, and it does no harm. |
| Jargon | No part names on screen. Only verbs, "Fixed!", "Too slow!", "One more!", "New job!". |
| Could not tell if it worked | The fixed object works for 0.6 s: the bell rings, the music box plays, the lamp lights, the clock ticks, the wheel spins, the vase grows a flower. The customer cheers, coins fly to the counter. |
| Finger hid the part | Progress is a ring around the whole object, outside the finger. Every grab radius is at least 17 local units (63 px at 390 px wide; the smallest touch target measured in the check is about 126 px on the iPhone 13 viewport). |
| Idle waits | The next customer steps up as soon as the last one is paid. The first shift starts within one tap of the menu. |

Round 2 kept these answers for the two new jobs: the teddy's tear is a white zigzag with the needle ringed at its start and a star at its end, and the needle trails behind the finger so the finger never covers it; the pump shows its strokes still to go as dots beside the barrel, and the ball visibly grows with each push.

Nothing was copied or ported from `archive/`. Code, art, jobs, rules and tuning are new.

## Rules

- **Bench.** One customer is served at a time; up to four more wait in a visible queue. Each customer brings one object with one repair, or (from shift 2) sometimes two repairs on the same object, done in order. Dots under the verb show how many.
- **Patience.** A ring round the customer's head drains. Their face goes from smiling to flat to frowning. If it runs out they walk off and you lose a heart. Three hearts; the Lucky horseshoe from the shop adds a fourth.
- **Pay.** Coins = (job price + 1 if fixed with at least half the patience left) × streak multiplier × 2 for the regular. The multiplier is 1 + floor(streak / 4), capped at ×3. Losing a customer resets the streak.
- **Levels.** See "Round 3: levels". The rules below for shifts, the tutorial and unlocks now apply to the open stall.
- **Shift.** A day lasts 90 s of customer time. It ends early if the hearts run out. The level rises every 15 s (6 levels), which shortens patience and makes two-repair jobs more common.
- **First shift (tutorial; rounds 1 and 2 only).** Since round 3 the open stall starts without it, because levels 1 to 3 teach these jobs; `sim.js` keeps it behind `tutorial: true`. The first three customers bring the bell, the music box and the kettle, one each, and wait 45 s. The day clock does not run while they are served. There is no text beyond the verb.
- **Unlocks.** A shift with 4 or more fixed unlocks the next job (wheel, lamp, clock, bike, vase, knife, teddy, ball, in that order). It is saved at once and comes first in the next shift with a "New job!" banner and 30 s patience.
- **Golden customer.** Rarely (2.5% of eligible customers, never among the first six of a shift, never the regular, a tutorial or a new-job customer) a customer glows gold in the queue. At the counter a "Golden job!" banner and a shimmer sound announce them. They always bring two repairs and wait 1.45 × the one-repair patience (a plain two-repair job gets 1.6 ×), and pay 4 × the coins. An average bot meets one in 15 of 40 open-stall shifts (round 3).
- **Streak feedback.** On a quick fix with a streak of 2 or more: a rising run of up to five notes pitched by the streak, a word ("Nice!", "Great!", "Hot!", "On fire!", or "x2!" / "x3!" when the multiplier goes up), confetti that grows with the streak, and the multiplier badge pops. A golden fix says "Golden fix!" with gold confetti.
- **Daily stall.** After level 3 (or any shift of the old game) the menu offers "Daily stall": one seed for everyone on the same UTC date, all 15 jobs, three hearts (no horseshoe), no regular, no new job, two-repair jobs on. Coins are banked as usual, but the daily never unlocks a job and does not change the all-time best. The best coins for each date are kept (newest 30 dates) and shown on the menu and the end card.
- **Keyboard and mouse.** The mouse drags like a finger. Holding Space does the job in front of you at the average bot's pace along the same finger paths the bots use; letting go lifts the finger. A line on the menu says so on devices whose main pointer is fine.
- **Shop.** Coins are banked between shifts. Teal awning (owned), Copper awning 50, Berry awning 90, String lights 140, Radio 180 (a synthesized tune during the shift), Sunny awning 220, Stall cat 280 (sits on the counter and looks pleased after a fix), Lucky horseshoe 400 (+1 heart).

### The fifteen jobs

All positions are in the object's own 100 × 100 box.

| Job (verb) | Object | Gesture | Done when | Hit radius |
| --- | --- | --- | --- | --- |
| screw (Turn!) | bell | circle round the loose screw, either way | 1080° turned; a click every 90° | 60 |
| pin (Pull!) | music box | grab the bent pin, drag it out and keep holding | the pin follows at most 1.1 / s up to 46 units; it slides back at 0.6 / s if let go | 32 |
| dent (Tap!) | kettle | tap each dent | 3 to 5 dents from 5 places popped | 17 |
| wheel (Flick!) | wheel | flick round the rim | it seats only while spinning at 360°/s or more; spin decays as exp(−0.6 t) | 52 |
| rub (Rub!) | lamp | rub back and forth on the base | 600 units of rubbing; each step counts at most 25 | 38 |
| clock (Set it!) | clock | drag the hand clockwise to the star | within 5° of a target 210° to 300° ahead; the hand turns at most 240°/s | 54 |
| chain (Hook it!) | bike | drag the chain loop onto the big gear | the loop trails the finger at 95 units/s and hooks within 6 of the gear edge | 26 |
| glue (Push & hold!) | vase | push the loose half onto the vase, then hold | joined within 9 units, then held for 1.0 s | 30 |
| sharpen (Swipe!) | knife | long swipes along the blade | 6 strokes of 48 units each | 36 |
| sew (Sew!) | teddy | grab the needle and drag along the zigzag tear | the needle follows the finger at most 40 units/s if the finger is within 18 units of the seam; done at the seam's end (about 99 units) | 26 |
| pump (Pump!) | ball | push the pump handle down and pull it up | 6 full strokes; the handle goes down at most 140 units/s, up at 400 | 26 |
| oil (Tap when open!) | squeaky door | tap the oil can while the door swings wide open | 3 drops; one per swing; the door swings once a second and takes a drop while at least 0.6 open (60% of each swing); a tap while it is shut splashes and does no harm | 30 |
| zip (Zip it up!) | jacket | hold the pull tab under the slider and drag it up; at a snag wiggle side to side | the slider climbs at most 150 units/s and only up; each of 2 snags needs 4 changes of direction, each after at least 4 units | 22 |
| spring (Pull back!) | toy car | hold the back of the car, pull it left, let go when the key glows | pulled back 34 units (at most 75 units/s); let go before that and it rolls back unwound | 26 |
| thread (Thread it!) | needle | press the knob, the stiff thread or its tip; the tip stands straight above the thumb (28 units); steer it into the eye and hold still | the tip follows at 200 units/s; 1.0 s inside 9 units of the swaying eye with the finger nearly still; a magnified view of the eye shows while the thread is held | 22 |

### Tuning (`sim.js`)

| Name | Value | Meaning |
| --- | --- | --- |
| `DAY` | 90 s | length of a day shift |
| `RAMP` | 15 s | time per level |
| `PATIENCE` | 13, 12, 10.5, 9.5, 8.5, 7.5 s | patience by level |
| `TWO_PATIENCE` | × 1.6 | patience factor for a two-repair job |
| `TWO_CHANCE` | 0, 0.15, 0.25, 0.3, 0.4, 0.45 | chance of a two-repair job by level (from shift 2) |
| `TUTOR_PATIENCE`, `NEW_PATIENCE` | 45 s, 30 s | tutorial customers, a new job's first customer |
| `COIN` | 2 or 3 per job | job price |
| `HINT_AFTER` | 1.5 s | faint hint after this long without progress |
| `WORKS` | 0.6 s | the fixed object works for this long |
| `REGULAR_AT` | 6th customer | when the regular arrives (from shift 2) |
| `GOLDEN_CHANCE`, `GOLDEN_FROM` | 0.025, 6 | chance a customer is golden; none before this many customers |
| `GOLDEN_PATIENCE`, `GOLDEN_PAY` | × 1.45, × 4 | a golden job's patience (on the one-repair patience) and pay |
| `PUMP_RATE` | 140 units/s | how fast the pump handle can go down |
| `OIL_PERIOD`, `OIL_OPEN` | 1.0 s, 0.6 | one door swing; how open it must be for a drop |
| `ZIP_RATE` | 150 units/s | how fast the zip slider can climb |
| `SPRING_RATE` | 75 units/s | how fast the toy car can be pulled back |
| `THREAD_HOLD` | 1.0 s | how long to hold the thread still in the eye |
| `THREAD_UP`, `THREAD_EYE`, `THREAD_RATE` | 28 units, 9 units, 200 units/s | the thread tip's height straight above the thumb; the eye's catch radius; how fast the tip follows |
| `TRACE_OFFSET`, `TRACE_RADIUS` (`repairs.js`) | 26 units, 6.5 units | the tile pen's nozzle height straight above the thumb; how close to the line the nozzle must stay |

Round 2 changed every seeded queue. Each customer now draws its golden chance, its two-repair roll and a seed for its repairs' layout when it joins the queue, and the queue's numbers are drawn nowhere else. So a seed gives the same customers to everyone however fast they play, and a change to the golden chance does not shift the rest of the queue. Old `?seed=` links give different queues than in round 1. (The objects already came in the same order regardless of speed before this; the change stops a future job whose layout draws a varying count of numbers from shifting later customers.)

## Bots (`bots.mjs`)

`fnm exec --using=26.12.0 node experiments/fixit/bots.mjs` is deterministic and took 8 s in its last run (1.3 s to 56 s depending on what else the machine was doing; see Round 3). The bots play the real `sim.js` through the same finger paths the check uses (`moves.js`). Their speed is capped at what a thumb can do: no finger moves faster than 820 units/s, and the fastest one measured was 779.

One repair at the hardest level (patience 7.5 s). Median seconds from the job appearing to fixed, over 20 seeds:

| Job | competent | average | slow |
| --- | --- | --- | --- |
| screw | 2.10 | 3.27 | 7.28 |
| pin | 1.65 | 2.07 | 3.32 |
| dent | 1.63 | 2.35 | 4.33 |
| wheel | 1.87 | 2.30 | 4.03 |
| rub | 2.68 | 3.93 | does not finish |
| clock | 1.78 | 2.22 | 3.90 |
| chain | 1.03 | 1.38 | 2.37 |
| glue | 1.72 | 2.12 | 3.32 |
| sharpen | 1.87 | 2.95 | 6.48 |
| sew | 2.90 | 3.32 | 4.52 |
| pump | 2.80 | 3.65 | 6.85 |
| oil | 3.38 | 3.38 | 4.38 |
| zip | 1.88 | 2.20 | 3.85 |
| spring | 1.47 | 1.90 | 3.28 |
| thread | 2.02 | 2.43 | 3.73 |

The door takes the same time for every bot that taps in the window, since it waits for the swing.

A competent bot loses no two-repair job at the top level (round 3, 15 jobs: worst oil plus screw in 5.65 s of 12.0 s). With every eligible customer golden, a competent bot at the top level fixes all 78 golden jobs over 10 seeds (worst 5.58 s), and each pays at least 8 coins a repair.

The pump first needed 7 strokes with the handle going down at 110 units/s; a competent bot's worst time was then too close to the limit (median 3.92 s), so it is now 6 strokes at 140 units/s. The golden chance was first 5%; an average bot met one in 25 of 40 shifts, which is not rare, so it is now 2.5% (15 of 40 in round 3, with 15 jobs).

Whole open-stall shifts, all 15 jobs unlocked, 40 seeds each (round 3):

| Bot | Coins | Fixed | Hearts lost | Ended by hearts | First heart lost at |
| --- | --- | --- | --- | --- | --- |
| idle | 0 | 0 | 3 | 40/40 | 13 s |
| scribbler (random taps) | 3 | 1.0 | 3 | 40/40 | 13 s |
| slow | 51 | 12.3 | 0.4 | 0/40 | 82 s (median) |
| average | 241 | 22.2 | 0 | 0/40 | none |
| competent | 340 | 28.3 | 0 | 0/40 | none |
| expert | 396 | 32.4 | 0 | 0/40 | none |

Other claims it checks: with the same seed an expert and a slow bot meet the same objects in the same order (the daily stall's promise; whether a customer also brings a second repair still follows the level when they step up, which depends on time); taps that are not the job make no progress on any job; golden customers are rare (4 to 20 of 40 shifts for an average bot); a slow player's first two shifts earn a median 96 coins and an average player's 440 to 640, against a cheapest item of 50; the tutorial waits for a slow player.

## Browser check (`check.mjs`)

`fnm exec --using=26.12.0 node experiments/fixit/check.mjs [webkit|chromium]`. It serves `experiments/` on a free port, answers `/notes/button.js` with an empty script, captures lab records sent to the lab endpoint, and fails on any page error, console error, failed request or HTTP status of 400 or more. It runs WebKit as iPhone 13 and Chromium as Pixel 7. Every touch is a real touch `PointerEvent` on the canvas, one step per animation frame, along the path `moves.js` makes from the job's own guide. Screenshots go to `$SHOTS` (default: a folder in the OS temp directory).

It covered in round 2 (round 3 rewrote it for levels; see "Browser check, round 3" below):

- the menu and its lab notice;
- a streak felt during the first full shift: at least one streak word ("Nice!", "Great!", "Hot!", "On fire!", "x2!" or "x3!") shown and confetti on screen;
- the first shift: the three tutorial jobs in order, the ghost finger on the first job, a stray tap that does no harm, the smallest touch target of at least 44 px;
- pause by the button freezing time, Keep going, losing focus pausing, P resuming;
- the rest of the shift to the end card (the check shortens the day to 16 s with `?day=16`; everything else is the real game), sampling every frame that no two people's bodies overlap (bodies are 1.5 R each side of centre) and that the drawing blend fraction stays in 0..1;
- coins banked, the save blob unchanged by a reload, the unlock kept;
- one lab run with outcome `closed`, its summary and at least 5 `repair` events;
- the next shift opening with the new job, and Menu from the pause card sent as `left`;
- every one of the 11 jobs, forced with `?only=` and done once;
- a two-repair job (`?two=1&level=3`);
- a golden customer (`?golden=1` makes every customer golden from the first): two repairs, done, paying at least 16 coins;
- the daily stall on each phone: hidden before the first shift, shown after; a bad `days` entry dropped and a good one kept on load; the same date gives the same first customer and queue twice; a shift played to the end card with the day's best saved, the coins banked, the end card naming the daily stall, the lab run carrying `daily`; the menu showing today's best; another date giving another queue;
- the shop: buying the copper awning and the cat, both kept after a reload, both sent as `buy` events; the sound setting kept after a reload;
- a later shift on each phone with `prefers-reduced-motion: reduce`, sound on and the radio owned: no hint at first on a job seen many times, the faint hint after 1.5 s idle, five jobs, the regular as the sixth customer with silly things on the object, then no touches until four customers walk off; the end card says "Out of hearts", the lab run has `why: 'hearts'` and lost repairs, and the regular's visit is saved;
- a 360 × 640 Chromium screen during play with four hearts, the cat, radio, lights and horseshoe showing;
- a 1280 × 800 Chromium desktop window: the menu line about mouse and Space, then every one of the 11 jobs done with mouse pointer events, and every one again by holding Space; Space held through the end of a short shift (with repeats) leaves the end card showing; pausing with Space held lets go of the keyboard's finger and nothing carries on after resume.

A known bad case fails: with the no-overlap clamp in `people()` switched off, a 12 s run of chain jobs on Chromium measured bodies 50.7 px inside each other; with it on, the closest pair was 1.8 px apart.

Last result (round 2, final code): `ok` on WebKit (iPhone 13), 126 s, and on Chromium (Pixel 7, plus the 360 × 640 and desktop runs), 198 s. The repo's shared phone check (`experiments/kit/check/phone.mjs`) passed before and after this round's changes. Round 3's result is under "Browser check, round 3".

## Debug queries

`?level=N` makes Play start map level N (round 3; it used to set the ramp). `?ramp=N` starts the open stall at ramp step N (0 to 5; this was `?level=` before round 3). `?seed=N` fixes the open stall's customer queue (shift k uses N + k); levels always use their own seed. `?golden=1` makes every open-stall customer golden from the first. `?date=YYYY-MM-DD` picks the daily stall's date (default: today, UTC). `?only=<job>` makes Play start the open stall serving only that job, with no goal card. `?two=1` or `?two=0` forces two-repair jobs on or off in the open stall. `?day=S` sets the open stall's shift length in seconds.

## Save

One key, `fixit-save`, holding one JSON object: `v`, `bank`, `best`, `shifts`, `unlocked`, `seen` (times each job was shown, for the ghost finger), `owned`, `awning`, `sound`, `regular` (visits by the regular), `pending` (the new job for the next shift), `bestStreak`, `served`, and from round 2 `days` (`{ "YYYY-MM-DD": best coins }`, newest 30 dates; entries with a bad date or value are dropped on load), and from round 3 `levels` (`{ "<n>": best stars 1..3 }`, cleared levels only) and `times` (`{ "<n>": best clear seconds }`). Fields only grow; a round-1 save loads with `days` empty, a round-2 save with `levels` carried over as below. Unknown or wrong-typed fields are dropped on load; `levels` keeps only real level numbers with 1, 2 or 3, and `times` only entries for cleared levels with a positive number.

## Lab recording

`rec.start({ mode: 'level', level, goal })` for a map level (goal is the goal line), `rec.start({ mode: 'day', unlocked, shift, only })` for the open stall, or `rec.start({ mode: 'daily', date })` for the daily stall; a level's end is `rec.end('closed', { coins, served, lost, bestStreak, mode: 'level', level, cleared, stars, secs, why, bonus })` with `why` `'clear'`, `'time'`, `'hearts'` or `'lost'` (someone walked off in a level that forbids it, or a set list ran out); a level left from the pause card is `rec.end('left', { ...same, why: 'menu' })`. No new outcome names. `rec.event('repair', { kind, ms, ok })` for each fixed or lost job, at most 120 per run; `rec.event('buy', { item })`; `rec.end('closed', { coins, served, lost, bestStreak, why })` when the shift ends, with `why` `'time'` or `'hearts'` (and `daily: date` for the daily stall); repair events carry `golden: true` for a golden customer; `rec.end('left', { ..., why: 'menu' })` when the player quits from the pause card.

## Not verified

- On a real phone: feel of the gestures under a real thumb, frame rate, safe areas on a notched phone, the browser's own edge gestures.
- Audio on a real phone (the check runs with sound but cannot hear it; iOS silent switch behaviour is unknown).
- A person playing. All difficulty numbers come from bots whose speeds are my estimates of thumb speed, not measurements.
- The radio tune ran without errors but nobody listened to it. The reduced-motion path ran without errors; I did not compare it frame by frame with the full-motion path.
- Interpolation: the check only shows that the blend fraction stays in 0..1, which is true by construction; it would still pass with blending switched off. Nobody has looked at motion on a 120 Hz screen.
- Streak feedback: the check sees the words and the confetti; the pitch of the rising notes was not heard.
- Vibration: `navigator.vibrate` is called on grab, puff, fix and loss when sound is on; neither browser in the check vibrates, and iOS Safari has no `vibrate`.
- The daily stall across real devices and time zones: the seed comes from the UTC date, tested only with `?date=`.
- Whether the golden glow, the half-way notch on the patience ring and the streak words read clearly to a person.
- Real touch input from the browser: the check dispatches `PointerEvent`s on the canvas, so it does not exercise the browser's own touch-to-pointer conversion or `setPointerCapture` with a real touch.

## Known weaknesses

- Holding Space plays every job at the average bot's pace, so a keyboard player cannot be faster or slower than that; their score sits near the average bot's. It makes every repair possible from the keyboard, not skilful.
- Interpolation blends only the listed numeric fields of each repair (`LERP` in `main.js`); the dents, the customers' walk and the particles are not blended (they move by frame time).
- A slow player cannot finish the lamp (rub) at the top level inside its patience. That is by design (the slow bot should fail late), but it means the lamp is the job that ends most slow runs. The pump is the next slowest for a slow player (6.85 s of 7.5 s).
- The daily stall serves all 11 jobs, so a player who has not unlocked the teddy or the ball meets them there first, with the ghost finger but without a "New job!" customer's long patience.
- The ghost finger is a drawn thumb; whether people read it as "do this" is untested.
- `check.mjs` now takes about 126 s on WebKit and 198 s on Chromium; more than double round 1, mostly the desktop run doing 22 jobs.

## Ideas of the builder

Labelled by origin. "Asked" means it was in the round-2 request; "builder" means it is my own idea.

- **Builder: a half-way notch on the patience ring.** A short dark tick at the bottom of the ring marks where the quick bonus ends, so "quick" has a place you can see.
- **Builder: vibration.** A short buzz on grab and on each pump stroke, a pattern on a fix (longer on a golden fix) and a long one when a customer walks off. Tied to the sound setting, so one switch silences both.
- **Builder: the needle that trails the finger.** In the sew job the needle moves at the thread's pace toward the finger, so it is always just ahead of the thumb, not under it. This answers tester t1's "finger hid the object" for a path-following gesture.
- **Builder: the pump's stroke dots.** The strokes still to go are dots beside the barrel that turn green, so "how many more" is visible without a number.
- **Builder: the daily stall leaves the best alone.** The all-time best counts only normal shifts; the daily has its own best per date.
- **Asked: daily stall, golden customer, sew and pump, streak feedback.** Described under Rules.
- **The regular.** From the second shift a regular (top hat, round glasses, moustache) comes as the sixth customer of each shift, says "Me again!", pays double, and waits a little longer. Their object wears more silly things each visit (googly eyes, a moustache, a tiny hat, a bow, sunglasses, a flower), counted in the save. This is my idea; it is not in the brief or in Copper Afternoon.

## Kit candidates

- **A touch replay helper for checks.** Turn a list of `{ type, x, y }` steps into real touch `PointerEvent`s, one per animation frame, stopping when a condition changes. `check.mjs` has its own.
- **Gesture plans shared by bots and checks.** `moves.js` makes one finger path per gesture type (circle, drag, tap, flick, rub, arc, swipe) that bots feed per tick and checks feed per frame, with a ghost-finger pose from the same shape. Other gesture games could share it.
- **A check server helper.** Serve `experiments/`, stub `/notes/button.js`, capture lab records. Every game's `check.mjs` repeats this.

## For the lead

- **Keyboard play.** Holding Space does the repair at a fixed everyday pace. The other choice is a keyboard gesture per job (arrows to turn, Space to tap); that is more skilful but eleven more things to learn. I took the simple one; change it if keyboard players are a real audience.
- **The daily stall and the bank.** Daily coins go into the bank like any shift, so a player could replay the daily for coins. Replays bring the same customers with the same objects, so a player gets better at it, not luckier (the second repairs follow the ramp, so they can differ with speed). If that matters, bank only the first daily of each date.
- **Old seeded links.** The golden draw changed every `?seed=` queue. Any shared link with a seed from round 1 now shows a different queue.

- **Outcome names.** `closed` is used for both endings (time and hearts), with `summary.why` telling them apart. `left` is used only for quitting from the pause card, because the lab treats `left` as "ending not reached". Alternative: use `closed` and `walked-out` as two outcomes.
- **WebKit and the lab record.** WebKit logs "Cannot load blob … due to access control checks" if the page navigates while `kit/lab.js` is still compressing a record. The check quits to the menu and waits 300 ms before each navigation. A real player closing the tab mid-shift could lose that last record in Safari. This is a kit question, not fixed here.
- **Screenshot folder.** `check.mjs` writes to `$SHOTS`, or to `fixit-shots` in the OS temp directory when it is unset, so that no session-specific path is written into the repo. This build ran it with `SHOTS` set to the scratch shots folder.
- **Shift length.** The day is 90 s; with the tutorial and walk-ups a shift takes about 1.5 to 2 minutes.

## 2026-11-23: the tester picked this one (note #103)

Asked which of the three new games (Grapevine, Fix-It Stall, Follow Me) to work on more, tester t1 answered "Fix-It Stall" (note #103, answering #100). It is the one of the three to grow next. No change was made in this run; see `experiments/NOTES.md`.

## 2026-11-23: "very bad right now" (tester t1, note #150)

The lab asked (#128) how Fix-It Stall is with the daily stall, the golden customer, sewing and pumping. The tester's answer, in short: it is very bad right now. Going back to the menu loses all your money. There are only three kinds of puzzle, where there should be many more. There should be levels instead of entering a random shift. (The note is cut off at the end.)

### Done: Menu keeps your coins
Before this change, Menu on the pause card dropped every coin earned in that shift; coins were banked only when a shift ended. Now Menu banks the shift's coins and its served count. Leaving early does not count as a shift. It sets no best. If 4 or more were fixed it still earns the next job, the same price as a finished shift; before, leaving lost it.

Fixed on the way: the best streak was never saved, because the line that saves it was behind a comment. No save field changed.

Check: `check.mjs` now fixes a job, leaves through the pause card, and asserts the bank rose by the shift's coins, on the menu and in `fixit-save`. Without the fix it fails at "Menu keeps the coins of the shift (note #150)" (tried twice). Locally the check passes every assertion on Chromium and then fails on "page errors": the live lab server (`human.adamwhite.work`) refuses this Mac, which this change does not touch. One run on each engine failed earlier, on the timing line "a streak is felt", with and without this change. The shared phone check passes for Fix-It.

Not checked: closing the tab mid-shift still loses that shift's coins, as before.

### Left as a proposal (2026-11-23, note #150)
- **"Only three types."** The game has eleven jobs, but a new player sees three (bell, music box, kettle), and each further job needs a whole shift with 4 or more fixed. So the tester saw three. Before this change, leaving through Menu also lost the unlock. Leaving after fixing 4 now keeps it.
- **Levels.** Replace random shifts with numbered levels. Each level has a goal (for example "fix 6, lose at most 1"), introduces one new job and brings back the old ones. Stars come from coins or time. The eleven jobs give about 11 levels; levels 12 and up mix jobs at a rising pace. The daily stall stays as it is. This is a change of structure, so it goes to the next working session. Question #154 asks the tester what should clear a level.
- **More kinds of puzzle.** Each new job is a new gesture and a new object. Candidates: thread a needle (hold steady), wind a watch (small circles), tighten a belt (pull and hook), unjam a zip (wiggle), oil a hinge (drip with timed taps).

## 2026-11-23: what clears a level (tester t1, note #157)

Asked (#154) what should clear a level, the tester chose "Mix: each level has its own goal". Nothing is built yet.

### Left as a proposal (2026-11-23, note #157), built 2026-11-24 (see below)
- The levels proposal under note #150 now has its rule. A goal per level, one of: fix N before time runs out; fix a set list without losing a customer; earn N coins. A first table: levels 1 to 11 introduce one job each and cycle the three goals; later levels combine two goals. Each goal shows as one line and an icon before the level and on the counter during it. Bots must show each level clearable before it ships. The daily stall stays as it is.

## 2026-11-24: a rival stall (tester t1, note #205, answering #179)

Asked what would make the levels better, the tester chose a rival stall to race against. First slice (it replaces the rival-stall proposal at the end of this file): levels 8, 11, 14, 16, 23 and 28 (fix n in a time) are races. The rival's face rides the clock bar with its own count, red when it is ahead; the goal card says so; losing says the rival won. The rival reaches the goal as the clock runs out, so no limit, star time or other rule changed (`rivalCount` in `levels.js`). Checked: the bots, and screenshots at 360 px. Not verified: a person or a phone.

### Left as a proposal (2026-11-24, note #205)
- A rival with moods: it speeds up when it falls behind and fumbles now and then, as its own drawn stall at the top of the screen. That changes difficulty and needs new bot runs.

## 2026-11-24: levels built (note #157)

Built: the levels from notes #150 and #157, with the goal rule the tester chose in #157 ("Mix: each level has its own goal"), and four new jobs for "only three types" (#150).

### Round 3: levels

- **The map.** The menu shows 32 numbered tiles in two chapters: "Learning the trade" (levels 1 to 15, a new job each) and "Busy street" (16 to 32, mixed jobs, faster). Each tile shows its best stars. A level is open when the one before it is cleared; locked tiles are greyed. The next level is teal and pulses. **Play** names it ("Play level 5") with its goal line under it, and starts it at once. The next level is the lowest one not cleared; when all are cleared, the lowest one without three stars. Any open tile starts its level.
- **The goal card.** A level opens on a card over the bench: "Level N", "New job: the door" when it brings one, the goal's icons, the goal line, and the three-star time. The sim waits behind it. A tap (or Space) starts the level, or it starts by itself after 2.6 s. The pause button works during it.
- **Goals.** One per level, of three kinds, and two combined later: fix N before the time runs out (wrench and clock icons); fix a set list of customers, in order, with nobody walking off (ticket and heart); earn N coins before the time runs out (coin and clock). Levels 19, 25 and 30 are "fix N, nobody walks off"; 20, 26 and 32 combine fix and coins under a time limit; 18, 24, 27 and 31 put a time limit on a set list. Hearts still end a level when they run out.
- **During a level.** Under the hearts, a pill shows each part of the goal with its icon and its count ("4/12", "35/130"), green when met, and a heart when nobody may walk off. Beside it the level clock runs along a bar with a gold star mark at the three-star time and a pale one at the two-star time; a mark dims once its time has passed. A timed level shows the seconds left, and the bar flashes red in the last 10 s. When the goal is met the clock stops, "Goal!" shows with gold confetti, and the level ends as that customer leaves.
- **Stars.** From the clear time: 3 at or under the three-star time, 2 at or under the two-star time, else 1. They are measured by the bots (below).
- **Ends.** Cleared: "Level N cleared!", the stars, the coins, time and best time, a line on new stars or what three stars needs, and a teaser for the next level ("Next: a new job, the music box."). Buttons: Next level (main), Try again, Menu. Failed: "Out of time", "Out of hearts" or "Someone walked off", empty stars, how far it got ("Fixed 9/12"), what was missing ("So close! 2 more to fix."), the goal again; Try again is the main button and restarts the level in one tap.
- **Coins.** A level's coins are banked whether it is cleared, failed or left from the pause card. Each new star pays 5 coins more.
- **Levels 1 to 15** bring one job each, in the order screw, pin, dent, wheel, oil, rub, clock, zip, chain, glue, spring, sharpen, sew, thread, pump. The first customer brings the new job with 30 s patience and a "New job!" banner; every other customer after brings it again; the rest come from the jobs already taught, never the same kind twice in a row. Levels 2 to 15 have 12 to 19 customers. Patience is 16 s on levels 2 to 5, 14 s on 6 to 10 and 12 s on 11 to 15; no two-repair jobs; the regular comes from level 6 (not on set-list levels).
- **Levels 16 to 32** each use 6 of the 15 jobs (a fixed shuffle per level). Patience falls from 11 s to 7.5 s, the two-repair chance rises from 10% to 45%, golden customers come from level 18 (6%), and the regular comes on levels without a set list.
- **Fixed seeds.** Every level has its own seed (1000 + 7919 n), so a level is the same for everyone, and a level's customers do not depend on how fast it is played.
- **Sky.** Levels 16 to 24 are played under a sunset sky and 25 to 32 at dusk.

### The open stall and the daily stall

The old random shift stays as the **open stall**: a 90 s day of random customers from the player's jobs, with the ramp, the regular, golden customers and job unlocks (4 fixed earns the next job) as before. It opens after level 8 is cleared, or at once for any save that played a shift of the old game. It has no tutorial now (levels 1 to 3 teach those jobs). A level cleared adds its new job to the open stall's jobs too. The **daily stall** is unchanged but now opens after level 3, or for any save with a shift. The **shop** is unchanged.

### Old saves (the rule)

A save from before round 3 has no `levels` field. If it shows play (`shifts` > 0, `served` > 0, or more than the first three jobs unlocked), the longest run of levels from level 1 whose new job is already in its unlocked list is marked cleared with one star, once, and saved at once. The menu says so on that load ("Your stall's old jobs count: levels 1 to 4 are done."). Coins, best, shop items, awning, sound, seen jobs, regular visits and the daily bests are kept as they are. Because level 5 teaches the door, a job no old save has, an old save never starts past level 5; a save that unlocked all eleven old jobs starts at level 5 with levels 1 to 4 done, its open stall and daily stall already open, and every star still to earn. A save with no play starts at level 1. The check proves both and that the carry-over happens once.

Adding the four jobs to the job list changed every seeded open-stall and daily queue: a `?seed=` link or a date gives a different queue from round 2. The daily for one date is still the same for everyone.

### The four new jobs

Each is a gesture the first eleven do not use, and each keeps the thing being fixed out from under the thumb:

- **Squeaky door (oil): timing.** The door swings by itself once a second; tap the oil can (low on the right) while the door is wide open and a drop lands on the hinge (up on the left), which glows while a drop will take. One drop per swing, three drops. The can shows three dots for the drops. A tap at the wrong moment splashes and costs nothing but the swing.
- **Jacket (zip): drag with a wiggle.** Hold the pull tab, which hangs under the slider, and drag up. At each of two red snags the slider sticks and shakes, with side arrows; wiggle side to side four times to free it. The open teeth above the slider stay in sight.
- **Toy car (spring): pull back and let go.** Hold the back of the car and pull it left against the spring (it comes back at its own pace). A meter on top fills; when the key glows, let go and the car zooms off. Let go early and it rolls back unwound ("Hold till it glows!"). The car stays to the right of the thumb.
- **Needle (thread): steer and hold still.** Hold the thread low down; its stiff tip stands above the thumb and follows at its own pace. Steer the tip into the swaying needle's eye and hold still: a ring round the eye fills in 1 s; moving pulls it back out.

### Bots for levels

`node bots.mjs` plays every level with the slow, average, competent and expert bots on the level's own seed, and each wobbly bot 6 more ways (each job's reaction time × 0.75 to 1.25 and speed × 0.9 to 1.1). The whole run took 1.3 s on a quiet machine and 56 s at a load average of 78 (several browser checks running at once), under the 60 s limit both times. `node bots.mjs --calibrate` measures the time limits, coin targets and star times and prints them as `TUNE` for `levels.js`:

- a coin target is 90% of what the competent bot holds after fixing the level's customer count;
- a time limit runs from 1.15 × the slow bot's time on level 2 to 1.25 × the competent bot's time on level 32 (the slow time counts at most 1.6 × the average's), rounded up to 5 s, and is at least 4 s past the two-star time;
- three stars need the expert's time plus 10%; two stars the average bot's time plus 5%, capped at the competent bot's plus 30%.

Last run:

| Level | New job | Goal | Patience (s) | Competent (s) | Expert (s) | 3★ / 2★ / limit (s) | Average bot stars | Average bot length (s) | Slow bot clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | screw | Fix these 6. Nobody walks off. | 30 | 15.6 | 12.5 | 14/21/- | 1.0 | 23 | 6/6 |
| 2 | pin | Fix 14 in 85 seconds. | 16 | 34.0 | 29.0 | 32/45/85 | 1.3 | 46 | 6/6 |
| 3 | dent | Fix these 17. Nobody walks off. | 16 | 34.7 | 29.4 | 33/46/- | 1.8 | 46 | 6/6 |
| 4 | wheel | Earn 130 coins in 85 seconds. | 16 | 37.0 | 32.4 | 36/49/85 | 2.0 | 47 | 5/6 |
| 5 | oil | Fix 14 in 75 seconds. | 16 | 43.3 | 40.4 | 45/50/75 | 2.0 | 48 | 6/6 |
| 6 | rub | Fix these 12. Nobody walks off. | 14 | 38.9 | 32.1 | 36/51/- | 2.0 | 50 | 6/6 |
| 7 | clock | Earn 116 coins in 80 seconds. | 14 | 35.8 | 31.6 | 35/47/80 | 2.0 | 45 | 0/6 |
| 8 | zip | Fix 17 in 85 seconds. | 14 | 41.2 | 36.8 | 41/51/85 | 2.0 | 49 | 6/6 |
| 9 | chain | Fix these 19. Nobody walks off. | 14 | 39.3 | 34.4 | 38/52/- | 2.0 | 50 | 6/6 |
| 10 | glue | Earn 149 coins in 85 seconds. | 14 | 41.2 | 36.6 | 41/53/85 | 2.0 | 51 | 0/6 |
| 11 | spring | Fix 17 in 80 seconds. | 12 | 39.9 | 35.3 | 39/51/80 | 2.0 | 50 | 4/6 |
| 12 | sharpen | Fix these 16. Nobody walks off. | 12 | 39.1 | 34.6 | 39/51/- | 1.8 | 51 | 6/6 |
| 13 | sew | Earn 131 coins in 70 seconds. | 12 | 42.3 | 39.2 | 44/52/70 | 2.0 | 49 | 6/6 |
| 14 | thread | Fix 17 in 75 seconds. | 12 | 42.5 | 39.4 | 44/52/75 | 2.0 | 50 | 6/6 |
| 15 | pump | Fix these 14. Nobody walks off. | 12 | 40.9 | 37.4 | 42/54/- | 2.0 | 52 | 6/6 |
| 16 | - | Fix 13 in 70 seconds. | 11 | 36.3 | 32.7 | 36/48/70 | 2.0 | 46 | 0/6 |
| 17 | - | Earn 122 coins in 70 seconds. | 10.8 | 37.8 | 33.5 | 37/50/70 | 2.0 | 48 | 0/6 |
| 18 | - | Fix these 13 in 65 seconds. Nobody walks off | 10.6 | 35.3 | 30.1 | 34/46/65 | 1.3 | 47 | 0/6 |
| 19 | - | Fix 13. Nobody walks off. | 10.3 | 38.9 | 32.7 | 36/51/- | 1.0 | 53 | 6/6 |
| 20 | - | Fix 13 and earn 162 coins in 65 seconds. | 10.1 | 37.3 | 31.2 | 35/49/65 | 0.3 | 60 | 0/6 |
| 21 | - | Fix these 14. Nobody walks off. | 9.9 | 43.2 | 36.3 | 40/57/- | 1.0 | 59 | 6/6 |
| 22 | - | Earn 157 coins in 75 seconds. | 9.7 | 43.4 | 37.4 | 42/57/75 | 1.0 | 59 | 0/6 |
| 23 | - | Fix 15 in 85 seconds. | 9.5 | 52.4 | 44.7 | 50/69/85 | 2.0 | 68 | 0/6 |
| 24 | - | Fix these 14 in 70 seconds. Nobody walks off | 9.3 | 42.9 | 38.6 | 43/56/70 | 2.0 | 54 | 0/6 |
| 25 | - | Fix 15. Nobody walks off. | 9 | 54.8 | 48.2 | 54/72/- | 2.0 | 71 | 5/6 |
| 26 | - | Fix 15 and earn 146 coins in 85 seconds. | 8.8 | 56.5 | 50.2 | 56/74/85 | 1.3 | 78 | 0/6 |
| 27 | - | Fix these 15 in 75 seconds. Nobody walks off | 8.6 | 49.4 | 42.1 | 47/65/75 | 1.5 | 66 | 0/6 |
| 28 | - | Fix 16 in 75 seconds. | 8.4 | 51.2 | 45.3 | 50/67/75 | 2.0 | 65 | 0/6 |
| 29 | - | Earn 218 coins in 95 seconds. | 8.2 | 59.4 | 49.0 | 54/78/95 | 0.0 | 95 | 0/6 |
| 30 | - | Fix 16. Nobody walks off. | 7.9 | 47.8 | 39.8 | 44/63/- | 1.3 | 64 | 0/6 |
| 31 | - | Fix these 16 in 84 seconds. Nobody walks off | 7.7 | 61.0 | 52.2 | 58/80/84 | 1.0 | 82 | 0/6 |
| 32 | - | Fix 18 and earn 183 coins in 90 seconds. | 7.5 | 65.8 | 57.9 | 64/86/90 | 0.0 | 90 | 0/6 |

| Levels | Slow bot clears | Average bot stars | Average bot length (s) |
| --- | --- | --- | --- |
| 1-10 | 78% | 1.82 | 45 |
| 11-20 | 57% | 1.65 | 51 |
| 21-32 | 15% | 1.26 | 71 |

It claims, and all hold: a competent bot clears every level, plain and all 6 wobbly ways; an expert bot three-stars every level; a wobbly expert three-stars at least 80% of plays (192 of 192); a competent bot three-stars at most a third of the mixed levels (1 of 17) and gets at least two stars on all 32; an idle bot and a scribbler clear none; the slow bot's clears and the average bot's stars fall band by band; an average bot spends 45 to 90 s in each of levels 2 to 15 and 45 to 100 s in the later ones; levels 1 to 15 each start with their new job, every job once; time limits bite (half the time on a mixed level, or 80% of the competent bot's own clear time on any timed level, and the competent bot fails); a level played twice the same way gives the same result.

The first table had levels of 12 to 48 s for a competent bot, and a second one still had 8 of levels 5 to 15 under 45 s for an average bot; the request asked for 45 to 90 s, so the customer counts went up (14 to 19 customers on levels 2 to 14) until every level from 2 on takes an average bot 45 s or more. Level 1 stays short on purpose (23 s for an average bot, 6 customers with 30 s patience): it is the game's first minute. An earlier calibration set time limits from the competent bot alone; a slow bot then failed most early timed levels, so the limits now start from the slow bot's time.

### Browser check, round 3

`check.mjs` was rewritten for levels. On each phone (WebKit as iPhone 13, Chromium as Pixel 7) it covers: the map (32 tiles, level 1 next, level 2 locked, no open or daily stall on a new save, Play naming level 1); Play starting level 1 directly with the sim waiting behind the goal card, then a tap starting it; the ghost finger on the first job; a stray tap; pause, Keep going, blur, P; level 1 played out by real touch events with no overlapping people, the blend fraction in 0..1, the goal counter counting 0 to 6; the cleared card, its Next button, the stars and the star bonus banked; one lab run `closed` with `level`, `cleared` and `stars` and the repairs; Next starting level 2 (the pin); Menu from the pause card keeping the coins, not clearing the level, sent as `left`; the save unchanged by a reload; level 19 failed with hands off ("Someone walked off", Try again as main button, no Next), one tap restarting it, and the failed run sent as `closed` with `cleared: false`; every one of the 15 jobs through `?only=` with real pointer events; the open stall behind its gate with the leave-early unlock rule; a two-repair job; a golden customer; the old-save carry-over (levels 1 to 4 with one star each, coins and awning kept, the open and daily stalls open, the menu line, once only) and an unplayed old save starting at level 1; the shop and the sound setting. Then a later open-stall shift with reduced motion, the radio and the regular, run to "Out of hearts"; the daily stall (hidden on a new save, shown after level 3 or a shift). Chromium also runs a 360 × 640 screen (the map with stars, the level 14 goal card, the needle, the door, the zip and the car, a cleared and a failed card) and the 1280 × 800 desktop run (every job by mouse and by holding Space).

Screenshots for review, in `$SHOTS`: `<phone>-1-map.png`, `<phone>-2-goal-card.png`, `<phone>-3-level-hud.png`, `<phone>-4-cleared.png`, `<phone>-5-failed.png`, `<phone>-6-old-save.png`, `<phone>-job-oil.png` (and `zip`, `spring`, `thread`), `small-1-map.png` to `small-5-failed.png`, `small-job-*.png`.

Changes after looking at the screenshots: the locked tiles first showed a padlock drawn in CSS that read as a box; they now show their number greyed. The pulsing next tile moved by a few pixels, which made Playwright wait for it to settle; it now pulses a teal ring instead. The goal card's star line drew its text in the star colour; it is now dark text after gold stars. The star marks above the clock bar ran into the coin count; they moved under the bar as one gold star (three stars) and one pale star (two stars). At 360 wide two marks of three small stars each overlapped.

### Not verified (round 3)

- Nobody has played a level. Every star time, time limit and coin target comes from bots whose speeds are estimates of thumb speed.
- The four new gestures under a real thumb, in particular whether the door's timing window and the needle's hold-still read without words, and whether the toy car's "let go when it glows" is found without the ghost finger.
- Whether the goal card's 2.6 s is long enough to read and short enough not to annoy on a replay; whether people tap it or wait.
- Whether a player understands the star marks on the clock bar without a legend.
- The old-save carry-over was checked with saves written by the check, not with a real tester's save.

### Known weaknesses (round 3)

- The late levels are hard for an average player: the average bot fails levels 29 and 32 every time and gets under one star on 20; the slow bot clears none of 26 to 32. The competent bot clears all of them. That may be the right end of a map or too steep; it is a lead decision.
- Coin goals depend on streaks (the multiplier), so a slow bot clears none of the coin levels 7, 10 and 17 to 29 even with the time it gets; slow players will meet coin goals as walls.
- Level 1 takes an average bot 23 s, under the 45 to 90 s asked for; on purpose, as the first minute of the game.
- `goalLine` has two branches for "Nobody walks off" that give the same text; harmless.
- The map is taller than a 640 px screen; the Play button and the next level are at the top, the late chapter needs a scroll.
- In the needle job the thumb ends up over the needle's lower shaft once the tip is in the eye; the eye and the ring stay in sight, but the ghost finger's last pose sits on the needle.
- The keyboard (hold Space) plays at the average bot's pace, so a keyboard player gets about an average bot's stars.

### Ideas of the builder (round 3)

- **Builder: star bonus coins.** Each new star pays 5 coins, so replaying for three stars also buys shop items.
- **Builder: next-job teaser.** The cleared card names the next level's new job ("Next: a new job, the door."), so the next tap has a reason.
- **Builder: how close.** The failed card says what was missing ("So close! 2 more to fix."), so a near miss reads as a near miss.
- **Builder: best time.** Each level keeps its best clear time, shown on the cleared card with "New best time!".
- **Builder: chapters and sky.** The map has two named chapters, and the sky turns to sunset and then dusk as the levels go on.
- **Builder: the clock stops at the goal.** Stars come from the moment the goal is met, not from when the last customer walks away.
- **Builder: the open stall as an unlock.** The old endless shift comes back at level 8 as a reward, not as the default.

### For the lead (round 3)

- **Late difficulty.** Levels 26 to 32 are cleared by a competent bot and failed by a slow one; levels 29 and 32 are failed by the average bot too. Options: keep it (an endgame), or cap patience at 8.5 s instead of 7.5 s for the last chapter. I kept it.
- **Old saves start at level 5 at most.** The alternative was to mark every level whose job the save knew, wherever it falls (for example the rub at level 6), with gaps in the map. I took the unbroken run from level 1, so the map never has holes.
- **The open stall gate is level 8.** It could be level 15 (after every job is taught). Level 8 gives a player who likes the old mode a way back sooner: levels 1 to 8 take an average bot about 6 minutes of play in all.
- **Coins from levels can be farmed.** Replaying level 1 pays about 25 coins each time (the competent bot's first run there earned 27 before the star bonus). Shop prices (50 to 400) were set for 90 s shifts; they are still reachable, maybe faster than before.
- **The shared phone check.** `experiments/kit/check/phone.mjs` (the `fixit` entry uses `started()`) passes unchanged: `#play` still leaves the menu at once (to the goal card, with `playing` true), the pause button pauses, `#quit` returns to the menu with one `left` run. It needs no change.

Last result (round 3, final code): `ok` on WebKit (iPhone 13), 166 s, and on Chromium (Pixel 7, plus the 360 × 640 and desktop runs), 338 s, with several other browser checks running on the same machine. The shared phone check, `phone.mjs fixit`, gave `ok` on WebKit and Chromium; a full `phone.mjs` run failed only on `lab/lantern-3d` (another game, under work in another session at the time). `bots.mjs`: all claims hold.

## Round 4: Night market and assist

Fix-It Stall is a portrait arcade game where customers bring broken objects to a street repair bench. Use one thumb to fix them, earn stars in a 44-level campaign, take an open shift or play the daily stall.

### Progression and saves

- **Coin goals.** Repair base pay counts toward the goal. Each completed repair contributes 2 or 3 before bonuses. The wallet still shows the full payout, including quick repairs, combos, regulars and golden customers. The goal has its own green ticket icon and “base pay” wording. Levels 17 and 22 also give a longer deadline. Three-star target times on levels 1–32 are retained.
- **Level payouts.** Bank the full repair payout on the first clear only. Each new star adds 5 coins, including on replays. A failed or abandoned campaign attempt pays zero. Open and daily stall payouts still bank by the shift rules. Existing balances and stars carry over, and an old clear already counts as a clear for payout purposes.
- **Help.** After two completed failures on a level, a snail and two stars offer a slower-clock retry. The ordinary retry remains available, and the menu offers help again after leaving or reloading. The level deadline and patience rings run at 45% speed. Gesture physics, repair order, quick-pay timing and elapsed clear time stay the same. The helper caps the run at two stars. Best times are recorded for unaided clears. Leaving by Menu does not add a failure, and clearing a level resets its failure count.
- **Storage and lab.** `fixit-save` keeps its existing fields and adds `attempts` (consecutive closed failures by level, capped at 2) and `assists` (helper selections by level). The kit's one-time hint uses `fixit:hint`. On helper selection the lab records an `assist` event, and the run summary records `assisted`. The outcomes remain `closed` and `left`. Pause is unavailable once the goal is met so the final repair settles as a clear.

### Night market

| Levels | Rule | What changes at the bench |
| --- | --- | --- |
| 33, 37, 41 | Picky customer | Choose numbered tickets from a shuffled row. The correct ticket opens that stage. A wrong ticket costs 0.75 s of patience. |
| 34, 38, 42 | Rush hour | Two customers arrive together. Tap their tickets to switch repairs. Both clocks run, and the second customer's budget is 75% of the first customer's base budget. Banks of 23, 16 and 12 s tighten across the three levels. A repair keeps its progress when you switch. |
| 35, 39, 43 | Blackout | A swinging lamp sweeps the work surface. The inactive part of the bench stays dimly visible. Reduced motion uses a broad stationary beam. |
| 36, 40, 44 | Boss | Big jobs require three repairs on one fixture under one patience ring. The ticket row previews each stage and marks completed stages. Big jobs use 2.5 times the one-repair patience. |

New jobs debut on levels 33–35. The daily uses all 18 jobs, and an open stall can acquire them through clears or shift unlocks. The new jobs change seeded open and daily queues compared with round 3. The daily remains deterministic by UTC date within this version.

| Job | Gesture | Completion |
| --- | --- | --- |
| Winding drum | Sweep the crank back and forth between the stops | Four alternating 124° sweeps |
| Scale | Move the lower counterweight and hold it where the beam is level | Three loads, 0.45 s balanced per load |
| Tile | Lay a bead along the crack with the nozzle above the thumb | Pass every sample in sequence within 5 local units |
| Needle, revised | Steer the tip into the eye and hold still | The tip stands 26 local units right and 16 above the touch. The hold remains 1.0 s. |

### Builder decisions

- **Builder: stall growth.** The shelf, sign, lights and cat appear at 6, 20, 40 and 66 total stars. The shop still recognizes its existing purchases. Chapter tabs keep each part of the map within one short grid.
- **Builder: feedback.** Patience gets a warning mark and a paid customer gets a reaction badge. Eight combo pips show the quick-repair streak toward the two payout multipliers. Daily results have a PNG share card with date, coins, repairs and best combo. The share button uses the system share sheet when file sharing is supported, with a PNG download available directly.
- **Builder: short first visits.** The first four Night Market levels introduce one rule each, then later levels use longer tickets or tighter paired deadlines. Darkness changes what you can see while leaving input active throughout.

### Bot results

Seven profiles per level, one fixed profile and six deterministic reaction/speed variations. The slow bot chooses help on its third run only after two actual failures. The retry policy left competent and expert clear outcome, time, coins and stars unchanged.

| Campaign levels | Slow unaided | Slow with retries | Average stars |
| --- | ---: | ---: | ---: |
| 1–15 | 103/105 | 105/105 | 1.87 |
| 16–32 | 34/119 | 119/119 | 1.54 |
| 33–44 | 70/84 | 84/84 | 1.93 |
| Coin goals only | 42/70 | 70/70 | |
| All levels | 207/308 | 308/308 | |

The competent bot cleared 308/308. The expert earned three stars on 308/308. An explicitly assisted expert run that met the three-star time earned two. Idle and random pointer bots cleared zero levels. The checks also cover deterministic queues, the first-clear reward, paired timers, wrong order, wrong gestures and shortened deadlines. The last run took 2.3 s.

| Open stall bot, 40 seeds each | Mean coins | Mean fixed | Mean hearts lost |
| --- | ---: | ---: | ---: |
| Idle | 0 | 0.0 | 3.0 |
| Random | 2 | 0.6 | 3.0 |
| Slow | 55 | 12.5 | 0.3 |
| Average | 241 | 22.0 | 0.0 |
| Competent | 344 | 28.1 | 0.0 |
| Expert | 399 | 32.1 | 0.0 |

### Checks

`check.mjs` covers first-clear and replay rewards, help eligibility and persistence, lab outcomes, the helper cap, pause, all 18 touch repairs, all four Night Market rules, progress when switching rush customers, cosmetics, old saves, daily PNG sharing and downloads. Chromium additionally checks a 360 × 640 viewport and desktop mouse and keyboard. The final runs passed on WebKit (iPhone 13, 249 s) and Chromium (Pixel 7 plus small-screen and desktop checks, 411 s). Script syntax and diff checks passed. The 390 × 664 WebKit and 360 × 640 Chromium screenshots were inspected across three passes. The passes improved ticket contrast, map navigation, the boss fixture, needle clearance, lamp placement, the order cue and daily card spacing.

The requested shared phone command passed on WebKit and Chromium before and after the edits. An intermediate run stopped at the global registry assertion for the sibling `nightshift` experiment. Its registry entry was present on the final rerun. Fix-It required no shared-check change.

### Known weaknesses and verification limits

- Four of the ten coin levels still require help for every sampled slow profile. They remain timed goals even after the streak dependency is removed.
- The aim and timing bots know the guide. Their clear rates measure input feasibility, speed and patience. They do not measure how quickly someone discovers a gesture, reads the tickets in dim light or knows what the snail offers. The rush timing table follows the initially active customer and does not optimize switching.
- Physical phone input and sound, live lab ingestion, the native share sheet and play by an outside tester remain unverified. Browser lab submissions and file sharing use local test stand-ins. PNG download is checked in emulation.
- No new shared kit feature was needed. The Fix-It shared phone test uses the existing selectors and run outcomes.

## 2026-11-24 — Cold play audit

Two fresh profiles cleared campaign levels 1–8 before source review. WebKit used the iPhone 13 profile (390 × 664 CSS pixels). Chromium used a 360 × 640 touch viewport. Both visited the three chapter tabs, shop, pause, loss, Daily, share card and Open Stall. Open Stall is a timed shift. There is no separate endless mode.

The files below are relative to the requested scratchpad folder `shots/audit-fixit/`. The original runs are `wk-001.png` through `wk-361.png` and `c-0000.png` through `c-0411.png`. The `w-` and `av-` series provide additional loss, menu and audio observations. Inputs used screen coordinates and native browser touch. Each action was captured and inspected. Later repeated customers used gestures selected from the visible repair and screenshots, with the browser clock paused between actions for inspection. Completion and elapsed times in these runs measure different things.

### Findings ranked by first-play impact

| Rank | Cold observation and evidence | Change and replay evidence |
| --- | --- | --- |
| 1 | **The music box rejected a complete pull.** A fast swipe along the arrow extended the pin, then it slid back. The ring could retain progress after the pin retracted. Repeating the same swipe lost customers. A slow pull and hold worked. `c-0035.png`–`c-0051.png`, `wk-040.png`–`wk-051.png`. | A full pull completes on release. Short pulls still retract, cancel stays safe, and the ring follows the pin. The instruction identifies the pin. Compare the same fast stroke in `c-0412.png`–`c-0413.png` and `c-0420.png`–`c-0421.png`. Partial pull and release appear in `c-0424.png`–`c-0426.png`. |
| 2 | **Reload discarded an active run.** WebKit lost one repair and three coins. Chromium lost two repairs from pause. `w-029.png`–`w-030.png`, `c-0011.png`–`c-0012.png`. | A same-tab reload restores the customer, repair, clock, hearts and unbanked coins behind Pause. It consumes a tab-scoped checkpoint. Campaign payment still happens at settlement. Both profiles kept 1/6, three coins and 83 s, finished with 42 earned and kept the 66-coin wallet through two reloads. `verify-c-016.png`–`verify-c-026.png` and corresponding `verify-w-` files. A live-clock Daily retained its next job and banked exactly three coins once. `c-0463.png`–`c-0473.png`. |
| 3 | **The jammed zipper demonstrated the wrong movement.** The vertical arrow and hand kept moving upward beside small horizontal arrows. Repeated upward strokes made no progress. `c-0352.png`–`c-0369.png`, `wk-331.png`–`wk-334.png`. | At a jam the caption and hand both switch to a sideways wiggle. They switch back when the slider releases. `c-0439.png`–`c-0442.png`. |
| 4 | **The first three lessons asked for 6, 14 and 17 customers.** All six opening customers brought the same bell. “Turn!” did not say what to turn. One missed customer ended the opening with two hearts still visible. “Tap to start” also started by itself while the player was reading. `w-002.png`–`w-004.png`, `w-038.png`–`w-044.png`, `wk-071.png`. | The first three goals now take 3, 6 and 6 repairs. Level 1 teaches circling the screw and lets the player recover from a walk-off. The existing early star times and deadlines give learners more room. After a walk-off, both profiles still cleared level 1 (`real-c-012.png`–`real-c-016.png`, `real-w-012.png`–`real-w-020.png`). Briefings wait for a tap or Space. Set-list levels show one heart and explain the loss condition. `legible-w-2.png`–`legible-w-3.png`, `verify-c-002.png`–`verify-c-014.png`, `verify-w-027.png`, `c-0459.png`–`c-0461.png`. |
| 5 | **The recording notice contradicted a saved opt-out.** The pause box stayed unchecked after reload while the menu still said the lab recorded play. Privacy measured 43.31 × 14 CSS pixels. `av-001.png`, `av-013.png`–`av-016.png`. | The menu reads the recording choice and keeps Privacy available with a 48 × 44 target. The associated text makes the small pause checkbox itself part of a full-height target. `after-menu-c-001.png`, `after-menu-c-007.png`–`after-menu-c-008.png`, and corresponding WebKit frames. |
| 6 | **Help concealed its rules.** After a second failure the snail and two stars gave no visible explanation. The assisted briefing promised an 85 s deadline while the HUD showed 189 s. `c-0094.png`, `c-0100.png`–`c-0101.png`. | The retry and menu buttons name slower clocks and the two-star cap. The briefing uses the assisted deadline. `wk-375.png`–`wk-378.png`, `wk-385.png`. |
| 7 | **Losing Daily unlocked Open Stall early.** Both profiles entered it after three campaign clears and a zero-repair Daily. The menu had promised level 8. Neither shift identified its remaining seconds. `wk-114.png`–`wk-129.png`, `c-0156.png`–`c-0166.png`, `c-0203.png`. | Daily settlement no longer increments the open-shift counter that grants legacy access. Prior saves retain their existing access, including ones already unlocked by the old daily counter. Both shift descriptions give their duration and coin objective; the HUD names the mode and counts down. `wk-409.png`–`wk-410.png`, `c-0450.png`–`c-0456.png`. |
| 8 | **Two repairs gave ambiguous feedback.** The door's hinge stayed bright after the drop for that swing was spent. Daily introduced balancing with no explanation of the required hold, even after the beam looked level. `c-0212.png`, `c-0227.png`–`c-0231.png`, `wk-115.png`–`wk-118.png`. | The can lights only when it accepts a drop. The balance prompt changes from sliding to holding at the mark, then advances to the next load. `c-0431.png`–`c-0434.png`, `c-0445.png`–`c-0449.png`. |
| 9 | **The results contradicted the play.** First clear showed Time 48 s and Best 49 s. A 36 s result missed a displayed 36 s three-star threshold. Between play and results the bench flashed an unrelated kettle and customer. Cleared levels also announced their jobs as new on replay. `c-0032.png`–`c-0033.png`, `wk-163.png`, `wk-411.png`–`wk-412.png`. | Time and best use the same upward tenth, preserving the star cutoff. The last customer and object remain through settlement. Only uncleared introductions are announced as new. `wk-368.png`, `wk-404.png`–`wk-406.png`, `wk-417.png`–`wk-421.png`, `wk-425.png`. |
| 10 | **Share and Save image gave no confirmation.** The result looked unchanged after each tap. `wk-118.png`–`wk-120.png`, `c-0163.png`–`c-0165.png`. | An on-card status distinguishes share-sheet handoff, cancellation and PNG download request. `wk-406.png`–`wk-408.png`. Browser checks also exercise unsupported file sharing and capture the dated PNG. |
| 11 | **Menu labels and layout obscured progress.** “Jobs 3/18” and three outlined stars on a fresh tile looked earned. Locked chapters still described level 1's goal. Back was below the shop viewport. The 10 px combo caption was difficult to read. `w-001.png`, `w-006.png`–`w-008.png`, `w-023.png`, `c-0014.png`–`c-0017.png`. | The counter says “Jobs unlocked”, tiles show only earned stars, and each locked chapter names its prerequisite. Inventory scrolls with Back in view. The combo caption is 13 CSS pixels. `after-menu-c-002.png`–`after-menu-c-003.png`, `legible-c-1.png`, `legible-c-3.png`, and matching WebKit frames. |
| 12 | **The radio tune had no visual counterpart.** The shop identifies the tune and the owned radio is on the counter, but its face stayed static as notes played. `c-0408.png`, `c-0411.png`. The missing animation was confirmed with a failing canvas check. | The face now shows notes at different heights and goes blank on rests. It also works when muted. Both browsers used a funded test wallet to buy and inspect the radio. `radio-c-005.png`–`radio-c-007.png` and matching WebKit frames. |

### Remaining observations and limits

- The wheel demo traces an arc. A straight tangential flick also spins it (`c-0168.png`–`c-0170.png`). Both motions work, so the permissive recognizer stays. The kettle's individual dents, the lamp's rubbing pads and the clock's hand-to-star target were readable in play (`wk-071.png`–`wk-074.png`, `wk-234.png`–`wk-238.png`, `wk-284.png`–`wk-287.png`).
- The shelf is a furnishing earned at six stars. The milestone label looked tappable, but tapping it opened nothing. It appears on the counter once earned (`c-0200.png`–`c-0203.png`). No additional menu was added for a cosmetic. Browsing a taller chapter can put the footer below the fold (`wk-114.png`, `wk-121.png`). The page scrolls.
- Daily can introduce jobs well before their campaign lessons. The revised balance cue addresses the observed failure. The shared daily queue still includes all jobs. Later campaign pacing and unaided first-play star rates need player evidence before further tuning.
- The run checkpoint applies to same-tab reloads. An expired UTC daily, a browser that blocks tab storage, or a tab killed without a page lifecycle event can still lose the active attempt. Completed progress uses the original `fixit-save` key. The kit hint keeps `fixit:hint`. Run outcomes remain `left` and `closed`.
- Measured browser audio during the opening coincided with visible repair feedback (`av-002.png`–`av-004.png`). Later repair-sound pairings were also inspected in the drawing and event code. No physical thumb covered the screen during these runs. Physical-device audio, haptics, OS-level share delivery, live lab receipt and outside-player enjoyment remain unverified.

### Verification

| Check | WebKit | Chromium |
| --- | --- | --- |
| Full `check.mjs` suite | Passed on iPhone 13 | Passed on Pixel 7, including separate 360 × 640 and desktop checks |
| Shared `phone.mjs fixit` | Passed before and after edits | Passed before and after edits |
| Cold campaign coverage | Levels 1–8 cleared with touch | Levels 1–8 cleared with touch |

`bots.mjs` passed all claims with the pinned runtime. New regressions were run against the failing behavior before the fixes. They cover fast pull versus cancel, dynamic gesture prompts, the shorter opening, safe-level hearts, briefing dismissal, reload and settlement, mode access and deadlines, rounded results, sharing status, menu targets, earned stars, combo text and the muted radio. The rush check also reloads with a partially repaired second customer, switches tickets twice, and finishes that customer's repair. Browser checks use local lab capture. The production service was outside this audit.

## 2026-11-24 — Words and pictures

### Pictures

- The repair captions became demonstrations on the bench. The bell shows the fingertip circling the real screw. The music box shows an upward drag from the pin and a lift. The oil can gets a ring and a tap only when it can take a drop. When the zipper catches, the trail turns sideways and returns to an upward drag when the snag clears. The scale shows a slide and a clock that fills while the player holds at the mark. The toy car shows a lift beside the glowing key.
- The briefing pairs the goal icon with its count. A clock shows the actual deadline, stars sit next to their time target, and the tap icon waits for the player. A new repair shows its object and a sparkle. Numbered tickets, paired patience bars, the swinging lamp and three repair slots represent the night-market rules. The slow retry pairs a snail with two filled stars and one outline.
- A check, a bolt, a gold star, a broken heart and a rewind arrow replace the repair, speed, gold, walk-off and early-release captions. Completed repair dots turn into checks. The pay badge and confetti carry the streak feedback. Shift clocks, coins, locks and level numbers show score goals and prerequisites. Item previews, a music note and a heart replace shop descriptions. Bonus coins and star targets use symbols and counts on the results card.

### Words kept

- Mode names, button labels and result reasons tell the player what will open or why play stopped. Short chapter prerequisites, the walk-off consequence, the base-pay rule and the shared daily queue state conditions that the icons leave ambiguous. Privacy and recording copy describes data handling and the pause setting. Share status states whether the browser accepted a share request, canceled it or started a download.
- The keyboard line names the Space key. The quiet first-level hint uses a short screw instruction when reduced motion is enabled. Screen-reader descriptions name the pictured job, gesture, goal and progress. The full English and Turkish table is in `words.js`. The language button uses the kit preference. When the address already contains a language override, the button updates it so reload keeps the new choice. Displayed amounts, times and the daily date use the selected language's Intl formats.

### Verification limits

No Turkish speaker has reviewed the copy in play. The automated runs exercise the demonstrated inputs and verify layout at the two emulated sizes. How quickly a first-time player reads the pictures remains unverified. Physical-device input, assistive-technology announcements, the native share sheet and production lab receipt were outside these checks.

### Checks

| Check | Result |
| --- | --- |
| `bots.mjs` | Passed with the pinned runtime, including the circular path, sideways snag cue, oil timing and scale hold. |
| `check.mjs` | Passed on WebKit with the iPhone 13 profile and on Chromium with the Pixel 7 profile, plus the small-screen and desktop checks. |
| `check.mjs --words` | Passed at 390 × 664 in WebKit and at 360 × 640 in Chromium. The tables have the same keys and interpolation fields. Both language switches survive reload. The Turkish screens, canvas text and accessible labels passed the English-copy check. The viewport checks allow scrolling inside the shop inventory. |
| `experiments/kit/check/phone.mjs fixit` | Passed on WebKit and Chromium before and after the edits. |

The narrow-screen check caught the Turkish recording notice below the fold when both modes and assisted retry were available. The final layout keeps the two actions on one row, fits six level tiles across and puts the mode summaries side by side. The final screenshots include the Turkish menu, first repair, pause, win and loss at both sizes.

## 2026-11-24 — Middle and late game audit

Returning-player touch play from level 9 to level 44, then Daily and Open Stall, in Turkish, before any source review. WebKit used the iPhone 13 profile and Chromium used 360 × 640 with touch. Input was touch pointer events at coordinates read from screenshots; the browser clock was paused between actions, so star results from these runs measure the harness, not difficulty. Screenshots are in the requested scratchpad folder `shots/deep-fixit/` (`w-`, `wb-` WebKit; `c-` Chromium; `check/` holds the check run).

Coverage. WebKit: level 1 by touch, levels 2–8 skipped with a save the game wrote after level 1 whose level map was raised by hand (the earlier cold audit cleared 1–8 by touch; these were not replayed here), then levels 9–44 all cleared by touch, Daily three runs, Open Stall three runs. Chromium 360 × 640: the WebKit save after level 33 copied in, then levels 9, 14, 16, 33–41 cleared by touch, level 42 failed six times, one Daily run and one Open Stall run.

### Findings ranked by how likely each is to make a player quit

| Rank | Observation and evidence | Outcome |
| --- | --- | --- |
| 1 | **Level 42 (rush) was lost on every first try in both browsers.** The right-hand customer runs out while the left job (scale) and the needle are done in order. Nothing showed that the other ticket can be served first. WebKit needed six tries and the slow clock; Chromium failed six times, including the slow clock. `wb-2013-f42`, `wb-2064-se42b`, `c-0586`, `c-0636`, `c-0688`, `c-0800`, `c-0856-n6`. Some of the Chromium losses were the player's own mistakes (sliding the scale weight the wrong way), so the firm evidence is `bots.mjs`: the slow bot cleared 38 and 42 unaided on 0 of 7 profiles. | Fixed. Rush patience by band is 23, 20, 17 s (was 23, 16, 12). The ticket of the customer who will leave first glows (outline pulses teal to amber, without moving) while the other is served. New claim: the slow bot clears every rush level unaided on at least 5 of 7 profiles (fails at 0/7 with the old numbers). New browser check: the urgent rush ticket glows. The replay supports the patience change; whether the glow teaches switching lanes is not shown, since the replays were played by someone who already knew to switch. |
| 2 | **The night-market order rule was not taught (level 33).** The bench showed only a paper tile; tapping it did nothing; the next ticket glowed only after 1.5 s idle. `wb-1554-n33`, `wb-1555-s33`, `wb-1556-t1`, `wb-1557-w1`. | Fixed. The next ticket glows as soon as the choice opens, and a tap on the bench bumps that ticket once. A first version also bobbed the ticket without end; the browser check could not tap a moving button, so the pulse now changes colour only. The bench-tap bump was not visible in the replay screenshot (`p3-0007-bench-tapi`) and is not verified. New browser check asserts the glow at once. |
| 3 | **Hold-to-finish gestures were demonstrated as plain drags.** The toy car (level 11) rolled back with only a rewind badge when released after the pull; the needle (level 14) only threads after holding the tip in the eye, which cost a WebKit player 16 s of a 75 s level. `w-0071`–`w-0073`, `wb-0140`–`wb-0158`. | Fixed. The car and needle demonstrations now show the hold clock filling at the end of the drag (the scale already did). New claims in `bots.mjs` fail without it. |
| 4 | **The clock hand stopped just short of the star after the finger lifted on it**, and needed a second push. Seen three times in a row early and again later. `w-0024`–`w-0025`, `w-0051`–`w-0052`, `w-0085`–`w-0086`, `wb-1054`–`wb-1068`. | Fixed. Lifting within 20° of the star finishes the turn; lifting 60° short still does not. Two new claims. |
| 5 | **Levels 16–32 add nothing new and the results card went empty.** After level 14 no level showed a new item or teaser until 32; mid-chapter levels play interchangeably and several timers left 40–60 s spare (`wb-0493`, `wb-0536`, `wb-0822`, `wb-1476-n32`, `wb-1553-end32`). | Partly fixed. Between new repairs the results card shows the next stall item with stars had/needed (for example "45/66 ★" for the cat). The final level says every level is done and the two modes stay open. New browser check plays level 16 and reads the next-item label. The busy street itself was not retuned: retuning seventeen levels needs new level content and a fresh play-through to judge, and the slower fixes above came first. |
| 6 | **Compound jobs (a second repair, usually a screw) arrive from level 16 unannounced**; step order and screw position vary by object, and players reported the first circle on the second step being ignored once. `wb-0348`–`wb-0354`, `wb-0556`, `wb-0641`, `wb-0706`. | Left. The two dots above the bench are the only cue. The ignored circle is unresolved: the sim blocks a finger that is still down when a step finishes, which matches a single continuous gesture, but the reports also describe a fresh circle being ignored, which was not reproduced. |
| 7 | **Golden customers pay large totals that do not count for coin goals.** In level 22 the total went 17 to 57 while the goal stayed 14/41. `wb-0754`–`wb-0757`, `wb-0822`, `wb-1339-end29`. | Left. The briefing's line "Bonuses do not count" is the only explanation. A goal-coin readout separate from the wallet needs a layout decision. |
| 8 | **The scale and the needle stay hard at the night market**: hint hand covers the scale handle at 360 px (`c-0194`, `c-0295`, `c-0852-s6c`), needle grab point unclear (`wb-2538-nd`, `c-0855-s6f`): the finger holds the blue knob, the thread tip stands 26 units right and 16 up from it, and the finger ends below-left of the eye, not on it. In the replay a drag from the tip onto the eye failed twice and lost level 42 (`p3b-0049-thread`, `p3b-0050-thread2`); following the demonstration's end point worked at once (`p3b-0079-threadA`). The trace pen works the same way (held by its body, `p3b-0026-trace` failed, `p3b-0027-trace2` worked). | Left. Rank 1 and 3 changes reduce the cost of each. The needle grab should rank higher than its place here: after the fixes it still lost level 42 at 9/10 in the replay. A fix (for example accepting a press on the thread tip as well as the knob) changes the gesture for every needle level and was not attempted in this pass. |
| 9 | **Daily is the same list on every replay and Open Stall changes only order** (no ramp, unlock or reward beyond coins and the record). Equalling the record shows no message. Daily runs 2 and 3 scored the same 245 with the same jobs (`wb-2776-dend`, `wb-2843-dend3`); Open Stall `wb-2942-oend`, `wb-3092-end2`; Chromium `c-0930-end2`, `c-1023-over`. | Left. Variety in these modes is a design proposal (for example a weekly twist rule or a ramp within the run), not a bug fix, and needs a decision on scope. |
| 10 | **Lamp sometimes needs a second rub with no cue** after the pads look clean. `w-0054`–`w-0057`. | Left: seen once early, not reproduced later, cause not looked at. |
| 11 | **Small-screen layout.** Edge customers are cropped, the stall cat sits over the first queued customer, two-step pips are about 10 px. `c-0006`, `c-0012`, `c-0452`, `c-0536`, `c-0092-chain`. Candidate bug: the scale scene slid below the screen twice after serving the needle first (`c-0687-s3`, `c-0798-s5b`). | Left; the slide is unresolved and was not reproduced in WebKit. |
| 12 | Silly decorations, the streak chip, and the circular-arrow badge are unexplained (`w-0049`, `w-0078`, `wb-0757`). A chain drag was once rejected right after the customer arrived (`w-0017`), not reproduced. Turkish copy read naturally; no English was seen. "37.seviye" looked unspaced on canvas, but the string has a space. | Left: low cost to a player, or not reproduced. |

### Verification

| Check | WebKit | Chromium |
| --- | --- | --- |
| `bots.mjs` | all claims hold, including four new ones: hold clock for car and needle, clock finishes when lifted near the star, slow bot clears every rush level unaided (these three failed against the old code), and a guard that a lift far from the star still does not finish (passes on old and new code) | (no browser) |
| `check.mjs <phone>` | ok | ok |
| `check.mjs --words` | ok | ok |
| `kit/check/phone.mjs fixit` | ok | ok |

The three new browser assertions were each run against main.js with only that fix reverted, on WebKit, and each failed: the next-item label (no `#newjob` image, timeout), "the rush ticket of the customer who will leave first glows", and "the next picky ticket glows as soon as the choice opens". The file was restored after each run.

Replay by touch after the fixes (screenshots `p3-`, `p3b-` WebKit, `p3c-` Chromium, all in `shots/deep-fixit/`):

- Level 33: next ticket outlined 0.4 s after the level starts (`p3-0006-l33-open`), second ticket outlined after the first job (`p3-0012-wind4`).
- Level 42, WebKit: first try lost at 9/10 on the needle grab (`p3b-0050-thread2`); second try cleared without the slow clock, switching to the glowing lane for the needle (`p3b-0077-doorA`, `p3b-0078-switch`, `p3b-0085-l42-end`). Chromium: cleared on the first try without the slow clock (`p3c-0013-cpump` glow, `p3c-0036-cswitch`, `p3c-0043-c42end`). Both runs used what the WebKit attempts had taught, and the paused clock gave unlimited time to look between gestures, so this shows the level can be cleared by touch, not that a new player clears it.
- Needle and car demonstrations show the hold clock filling at the end of the drag (`p3b-0047-nd-ei`, `p3b-0048-nd-f`, `p3b-0142-car5i`).
- Clock released short of the star in level 44 finished on its own (`p3b-0121-clock-release`); the exact angle at release was estimated from the screenshot, so the bots claim is the firmer evidence.
- Results card after level 42 shows the cat with 64/66 stars in Turkish, WebKit and Chromium (`p3b-0085-l42-end`, `p3c-0043-c42end`); level 44 shows the closing line (`p3b-0133-l44-end`).

Not verified: levels 2–8 by touch in this audit; Daily and Open Stall after the fixes (they were not changed); a level 16–32 results card by touch (the browser check covers level 16); the bench-tap bump on a ticket; Chromium replay of level 33; the cause of the ignored first circle on a second step and of the scale scene sliding at 360 px; star times, which reflect the harness.

## 2026-11-24 — Open items from the middle and late game audit

The four items the audit left open, in its order. Each change has a claim in `bots.mjs` or an assertion in `check.mjs`; each new claim and assertion was run against the code from before this pass and failed there (see Verification).

### What changed and why

| Item | Change | Why | Covered by |
| --- | --- | --- | --- |
| Needle | The thread tip now stands straight above the thumb (28 units, was 26 right and 16 up), on a drawn stiff stalk from a knob under the thumb. A press on the knob, the stalk or the tip takes hold. The eye's catch zone is 9 units (was 6) and is drawn as a ring that turns green when the tip is in it. The tip follows at 200 units/s (was 110). While the thread is held, a magnified view of the eye (1.6×, 118 px across on an iPhone 13) shows in the top-left corner of the bench, with an arrow on its rim pointing to the tip when the tip is outside the view. The ghost finger draws the stalk and the star at the tip. | The audit's player ended the finger below-left of the eye and lost level 42. Now the thumb ends straight below the eye, 19 units under its ring, and the part being aimed is never under the thumb. | `bots.mjs`: press on the tip takes hold; thumb straight below the eye threads it; a tip 7 units beside the swaying eye still goes through; the thumb holds 19 units below the ring. `check.mjs`: the thumb ends at least 50 px below the eye's ring (replaces "at least 55 px to the side", which the new design makes wrong on purpose); the magnifier shows while steering, is at least 80 px across, clear of the eye and the thumb, and goes when the thumb lifts. |
| Tile pen (trace) | The same treatment: nozzle straight above the thumb (26 units, was 23), a press anywhere on the pen from grip to nozzle takes hold, the line tolerance is 6.5 units (was 5), a magnified view of the nozzle (2×) in the top corner away from it, switching sides only past 38 or 62 units so it does not jump at the middle. | Same reason; the audit's first trace press on the nozzle failed. | `bots.mjs`: a press on the nozzle takes hold. `check.mjs`: the trace magnifier assertion above. |
| Two-step jobs: ignored circle | Reproduced in the sim with a script: a circle that goes straight on from the first repair into the second was ignored 576 of 576 times, because the sim blocked any finger still down when a step finished. Now only tap repairs (dents, the oil can) block a finger carried over; for every other repair the carried finger takes hold as soon as it reaches the part. A fresh circle after lifting was never ignored (0 of 612) in the old or new sim; that report is not reproduced. | The blocked carry-over matched the report of "a first circle ignored". | `bots.mjs`: a circle that goes straight on from the first repair turns the screw, 6 of 6 two-step kinds (0 of 6 on the old code); guard: a finger still down from the last customer does nothing to the next job until it lifts (passes on old and new). |
| Two-step jobs: unannounced | The two 5 px dots became pictures, 34 px across: the object for the first step, the screw or the dent for the second, joined by an arrow, the current one lit with a teal ring, a done one ticked. The same pictures are on an order slip beside the customer at the counter from the moment they arrive. When the first step is done: a two-note chime, the second picture pops, a ring pulses on the next part (at its guide point: the screw's centre or the first dent) and the ghost finger shows its move once (1.1 s), without blocking input. | The audit found two-step jobs arrive with no warning and only two tiny dots. | `check.mjs`: a two-step job shows both pictures on the bench and the slip from the start, each at least 28 px; after the first step the first is ticked, the second lit and the beat playing. |
| Golden pay and the coin goal | Decision: keep the rule (only the repairs' prices count toward a coin goal) and make the two amounts look different. The coin goal's icon is now a green token with a wrench, never the gold coin. On each pay in a coin-goal level, green tokens fly to the goal and a green +price shows under it; gold coins fly to the wallet with a gold +total. The goal card's "Bonuses don't count" line shows a crossed-out gold coin. The `paid` event carries the goal share (`wage`). | Counting the bonus would change every coin level's balance and the bot tables; the confusion was that the goal and the wallet used the same coin. The slow bot's coin-goal results are unchanged (42 of 70 unaided, 70 of 70 with retries). | `bots.mjs`: each pay names its goal share, the shares add up to the goal count, and a golden pay is more than its share. `check.mjs`: in level 4 the pay's goal share equals the goal count and is reported apart from the wallet's. |
| 360 px: queue | The next two people in the queue stand fully on screen: their size scales with the screen width (below 420 px) and their places are clamped to the left edge. The third still waits off screen. | At 360 px the second person was cut in half (left edge at −14 px). | `check.mjs`: at 360 px every queue person is fully on screen. |
| 360 px: cat | The stall cat sits on the bench below the queue (it sat over the first queued person). In order, rush and boss levels it keeps its old place beside the tickets, where no queue stands. While the thread or pen is held and the magnifier opens over the cat's corner, the cat is not drawn. | The new place put the cat over the needle magnifier (cat box 25 px from the magnifier centre at 360 px, in both browsers). | `check.mjs`: at 360 px the cat is clear of the queue; with the cat owned, the cat does not cover the thread or trace magnifier (failed before the cat was hidden: gap 25 px, needs 54). |
| 360 px: pips | Replaced by the 34 px step pictures above. | | as above |
| Scale "slid off screen" | Cause found and reproduced in the sim: a level lost to a walk-off ends with the sim still in the walk-off and its time a hair below zero (−5e−16 s in 15 of 15 lost runs of levels 19, 38 and 42). The page's fade then computed an alpha just below 0, which Chromium's canvas ignores (so the object was drawn whole) while it moved the object 0.4 of the bench down, off the screen. It happens on any walk-off loss, not only the scale. The fade is now clamped, and the unfixed object shrinks and fades where it stands (moves 6% of the bench) instead of sliding down. | Reproduced in the browser on the old code: level 19 lost at 360 px leaves the wheel drawn whole and slid down in both Chromium and WebKit (scratch `dev/slide-old-chromium`, `dev/slide-old-webkit`); with the fix it stays faded in place in both (`dev/slide-new-*`). | `check.mjs`: after level 19 is lost at 360 px, the walked-off object stays on the bench (alpha within 0..1, moved at most 10% of the bench). |

No new player-facing words: the new pictures and numbers carry no text, so `words.js` is unchanged.

### Still open

- A fresh circle on a second step being ignored was not reproduced (sim: 0 of 612). One untested explanation: the player circles where the first repair was, and the second step's screw sits elsewhere; the new pulse ring and ghost on the next part address that if it is the cause.
- Whether a new player understands the green goal token as "repair price" and the gold coin as "everything you earn" is not shown; only a player who has not seen the game can tell.
- The magnifier covers the top corner of the bench while the thread or pen is held. No job places its target there (checked for the needle and the tile), but a future job could.
- At 360 px the order slip can overlap a customer who is still walking off to the right for a moment after a job.

### Verification

Old-code runs: the original files were copied to a scratch folder with the new `bots.mjs`; the old sim had no `THREAD_EYE`, so a shim exported the old value (6). All seven new claims failed there; the carry-over guard passed (as intended). The new `check.mjs` predicates were evaluated against the old page in Chromium with a scratch script: thumb 34 px below the old ring (needs 50), and no magnifier, step pictures, slip, pay split, bench-object or cat fields; the old queue's second person stood at x 15.6 with R 20, cut off by 14 px. The new `check.mjs` file itself was not run against the old code; for the predicates on missing fields, failing only shows the field is new, not that the old page looked wrong (the screenshots in the audit show that).

Played by touch, Turkish, scratch screenshots in `shots/open-fixit/` (`wb-` WebKit iPhone 13, touch pointer events, as WebKit has no touch-drag API; `cb-` Chromium 360 × 640, real touch input through the DevTools protocol; buttons by Playwright touchscreen taps). The browser clock was paused between gestures. The first needle of each run was aimed by reading the screenshot; the other jobs used the job's own planned gesture sent as touch input, so these runs show the changed parts work by touch, not how a new player does.

- WebKit level 14 (needle): won, 17/17, none lost, 2 stars (`wb-0105`). First needle: press on the knob, drag below the eye, lift, the tip stays in the green ring and the magnifier closes (`wb-0012`, `wb-0013-lifted`); press and hold threads it.
- WebKit level 42 (rush, needle and scale): won, 10/10, 3 stars, switching to the urgent ticket by tapping it (`wb-0173`).
- Chromium 360 level 17 (coin goal): won, 38/36 goal, 13 served, none lost; a two-step job shown on the slip and the bench, second step lit with the ghost on the screw (`cb-0024`, `cb-0028`); queue fully visible, cat on the bench (`cb-0006`).
- Chromium 360 level 42: the audit's losing case replayed on purpose: needle served first, threaded on the first try from the screenshot (`cb-0122-needle42`, `cb-0124`), then the scale customer left to walk off. The scale fades in place (`cb-0126`) where it used to slide off (`deep-fixit/c-0687-s3`).
- WebKit two-step open stall: step pictures and the step beat (`w-0005`, `w-0011-s2`, `w-0012-s3`); level 4 pay split, green tokens to the goal and gold coins to the wallet, +3 and +4 (`w-0020-pay2`, `w-0021-pay3`); goal card with the green token and crossed gold coin (`w-0015-card4`).

- WebKit level 22 golden customer, the audit's case: a golden two-step job paid; the goal went 10 to 14 with a green +4 and green tokens flying to it, the wallet 17 to 57 with a gold +40 (`dev/golden22-webkit-5`). Planned gestures as touch pointer events, real-time clock; the level was not played to the end.

Final runs on the finished code: `node bots.mjs` all claims hold; `node check.mjs` ok on WebKit (357 s) and Chromium (518 s), exit 0; `node experiments/kit/check/phone.mjs fixit` ok on WebKit and Chromium.

Not verified: the fresh-lift ignored circle (not reproduced); the magnifier on a phone smaller than 360 × 640; how a first-time player reads the step pictures, the slip and the green token; star times (paused clock).

## 2026-11-24: answer (tester t1, note #205, answering #179)

Asked what would make the levels better, the tester chose a rival stall to race against.

### Left as a proposal (2026-11-24, note #205)
- A rival stall: a second counter at the top of the screen fixes things at its own pace and shows its count; a level goal is to fix more before the bell. Needs a rule in `sim.js` (the rival's pace per level) and bots that win and lose against it.

## 2026-11-24: the rival has moods, and a friend can race (tester t1, note #233, answering #224)

Asked what the rival should do next, the tester asked for all three ideas: speed up when the player is ahead, make funny mistakes, race a friend. This builds the moods left as a proposal under note #205.

- **Speeds up.** The rival (`makeRival`, `stepRival` in `levels.js`) fixes at 1.15 of the pace the clock asks for, and at 1.4 times that while the player leads by two or more. If it reaches the goal first the level is lost, even before the limit. The limit and the star times are unchanged.
- **Mistakes.** Every 11 to 19 s it drops a finished one (one off its count), sneezes or nods off. A short bubble under its face on the bar says so, in English and Turkish. Its face now runs along the bar by its own progress; a small dot is the clock. At the limit, "The rival stall won" shows only if the rival is ahead; else "Out of time".
- **Race a friend, without a server.** After a won race level (not with the slower clock), "Challenge a friend" shares a link that carries the level and the seconds at which each repair was finished. Nothing is sent to or stored on a server; nothing about the player is in the link. The friend opens it, taps "Race your friend" on the menu, and that run stands in for the rival. Winning offers a link back, so two friends can pass it to and fro. A race on a level not opened yet saves no stars, coins or unlocks. A lost race does not count towards the slower-clock offer.
- The link sharing moved into `kit/room.js` as `shareLink` (`share` uses it).

### Numbers and checks
The bot table (slow unaided, stars, clears) is the same line for line as before the change; at 1.25 and above the slow bot loses more of level 11, so 1.15 was kept. Seconds the rival takes, against a player behind / far ahead, and the limit: level 8 99 / 67 / 85, 11 100 / 64 / 80, 14 82 / 58 / 75, 16 76 / 50 / 70, 23 96 / 65 / 85, 28 84 / 57 / 75. `bots.mjs` claims: against a player who is behind it needs longer than the limit, against one far ahead it is faster, it hurries on every race, makes every mistake, a player who stops one short loses; a run survives its link, an expert beats an average friend, a slow player loses to an expert friend at the friend's time, and broken links are refused. The phone check plays a friend race won and lost, copies the link, and opens a broken one. Screenshots of the bar, bubbles and cards looked at (WebKit iPhone 13).

### Not verified
A real phone and its share sheet; whether the rival feels fair or funny; a race against a real friend. The friend race uses a run already played, not two people at once.

### Left as a proposal (2026-11-24, note #233)
- Both friends at once on two phones. The kit's friend tables would need Fix-It added to their server's list, which a tester note cannot change.
- Best of three between two friends, with a running score in the link.
