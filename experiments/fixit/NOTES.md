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
| thread (Thread it!) | needle | hold the thread low down, steer its tip (16 units above the finger) into the eye, hold still | the tip follows at 110 units/s; 1.0 s inside 6 units of the swaying eye with the finger nearly still | 22 |

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
