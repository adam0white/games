# Fix-It Stall

## What it is

Fix-It Stall is a phone arcade game about a street repair stall. Customers queue with broken things; you fix each one with a single hands-on gesture (turn, pull, tap, flick, rub, set, hook, push and hold, swipe) before their patience runs out, and the thing works for a moment while they cheer and pay.

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

Nothing was copied or ported from `archive/`. Code, art, jobs, rules and tuning are new.

## Rules

- **Bench.** One customer is served at a time; up to four more wait in a visible queue. Each customer brings one object with one repair, or (from shift 2) sometimes two repairs on the same object, done in order. Dots under the verb show how many.
- **Patience.** A ring round the customer's head drains. Their face goes from smiling to flat to frowning. If it runs out they walk off and you lose a heart. Three hearts; the Lucky horseshoe from the shop adds a fourth.
- **Pay.** Coins = (job price + 1 if fixed with at least half the patience left) × streak multiplier × 2 for the regular. The multiplier is 1 + floor(streak / 4), capped at ×3. Losing a customer resets the streak.
- **Shift.** A day lasts 90 s of customer time. It ends early if the hearts run out. The level rises every 15 s (6 levels), which shortens patience and makes two-repair jobs more common.
- **First shift (tutorial).** The first three customers bring the bell, the music box and the kettle, one each, and wait 45 s. The day clock does not run while they are served. There is no text beyond the verb.
- **Unlocks.** A shift with 4 or more fixed unlocks the next job (wheel, lamp, clock, bike, vase, knife, in that order). It is saved at once and comes first in the next shift with a "New job!" banner and 30 s patience.
- **Shop.** Coins are banked between shifts. Teal awning (owned), Copper awning 50, Berry awning 90, String lights 140, Radio 180 (a synthesized tune during the shift), Sunny awning 220, Stall cat 280 (sits on the counter and looks pleased after a fix), Lucky horseshoe 400 (+1 heart).

### The nine jobs

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

## Bots (`bots.mjs`)

`fnm exec --using=26.12.0 node experiments/fixit/bots.mjs` runs in about 0.4 s and is deterministic. The bots play the real `sim.js` through the same finger paths the check uses (`moves.js`). Their speed is capped at what a thumb can do: no finger moves faster than 820 units/s, and the fastest one measured was 779.

One repair at the hardest level (patience 7.5 s). Median seconds from the job appearing to fixed, over 20 seeds:

| Job | competent | average | slow |
| --- | --- | --- | --- |
| screw | 2.10 | 3.27 | 7.28 |
| pin | 1.65 | 2.07 | 3.32 |
| dent | 1.63 | 2.35 | 4.33 |
| wheel | 1.87 | 2.30 | 4.03 |
| rub | 2.68 | 3.93 | does not finish |
| clock | 1.83 | 2.25 | 3.90 |
| chain | 1.03 | 1.38 | 2.37 |
| glue | 1.72 | 2.12 | 3.32 |
| sharpen | 1.87 | 2.95 | 6.48 |

A competent bot loses no two-repair job at the top level (worst: lamp plus screw in 4.85 s of 13.1 s).

Whole shifts, all nine jobs unlocked, 40 seeds each:

| Bot | Coins | Fixed | Hearts lost | Ended by hearts | First heart lost at |
| --- | --- | --- | --- | --- | --- |
| idle | 0 | 0 | 3 | 40/40 | 13 s (shift ends at 41 s on average) |
| scribbler (random taps) | 4 | 1.4 | 3 | 40/40 | 13 s |
| slow | 46 | 12.6 | 0.4 | 0/40 | 79 s (median; a heart is lost in 14 of 40 shifts) |
| average | 227 | 23.7 | 0 | 0/40 | none |
| competent | 331 | 31.4 | 0 | 0/40 | none |
| expert | 399 | 37.3 | 0 | 0/40 | none |

Other claims it checks: taps that are not the job make no progress on any job; a slow player's first two shifts earn a median 100 coins and an average player's 457 to 513, against a cheapest item of 50; the tutorial waits for a slow player.

## Browser check (`check.mjs`)

`fnm exec --using=26.12.0 node experiments/fixit/check.mjs [webkit|chromium]`. It serves `experiments/` on a free port, answers `/notes/button.js` with an empty script, captures lab records sent to the lab endpoint, and fails on any page error, console error, failed request or HTTP status of 400 or more. It runs WebKit as iPhone 13 and Chromium as Pixel 7. Every touch is a real touch `PointerEvent` on the canvas, one step per animation frame, along the path `moves.js` makes from the job's own guide. Screenshots go to `$SHOTS` (default: a folder in the OS temp directory).

It covers:

- the menu and its lab notice;
- the first shift: the three tutorial jobs in order, the ghost finger on the first job, a stray tap that does no harm, the smallest touch target of at least 44 px;
- pause by the button freezing time, Keep going, losing focus pausing, P resuming;
- the rest of the shift to the end card (the check shortens the day to 16 s with `?day=16`; everything else is the real game);
- coins banked, the save blob unchanged by a reload, the unlock kept;
- one lab run with outcome `closed`, its summary and at least 5 `repair` events;
- the next shift opening with the new job, and Menu from the pause card sent as `left`;
- every one of the nine jobs, forced with `?only=` and done once;
- a two-repair job (`?two=1&level=3`);
- the shop: buying the copper awning and the cat, both kept after a reload, both sent as `buy` events; the sound setting kept after a reload;
- a later shift on each phone with `prefers-reduced-motion: reduce`, sound on and the radio owned: no hint at first on a job seen many times, the faint hint after 1.5 s idle, five jobs, the regular as the sixth customer with silly things on the object, then no touches until four customers walk off; the end card says "Out of hearts", the lab run has `why: 'hearts'` and lost repairs, and the regular's visit is saved;
- a 360 × 640 Chromium screen during play with four hearts, the cat, radio, lights and horseshoe showing;
- a 1280 × 800 Chromium desktop window, one job done with mouse pointer events.

Last result: `ok` on WebKit (iPhone 13), about 99 s, and on Chromium (Pixel 7, plus the 360 × 640 and desktop runs), about 104 s.

## Debug queries

`?seed=N` fixes the customer queue (shift k uses N + k). `?level=N` starts at level N (0 to 5). `?only=<job>` serves only that job. `?two=1` or `?two=0` forces two-repair jobs on or off. `?day=S` sets the shift length in seconds.

## Save

One key, `fixit-save`, holding one JSON object: `v`, `bank`, `best`, `shifts`, `unlocked`, `seen` (times each job was shown, for the ghost finger), `owned`, `awning`, `sound`, `regular` (visits by the regular), `pending` (the new job for the next shift), `bestStreak`, `served`. Fields only grow. Unknown or wrong-typed fields are dropped on load.

## Lab recording

`rec.start({ mode: 'day', unlocked, shift, tutorial, only })`; `rec.event('repair', { kind, ms, ok })` for each fixed or lost job, at most 120 per run; `rec.event('buy', { item })`; `rec.end('closed', { coins, served, lost, bestStreak, why })` when the shift ends, with `why` `'time'` or `'hearts'`; `rec.end('left', { ..., why: 'menu' })` when the player quits from the pause card.

## Not verified

- On a real phone: feel of the gestures under a real thumb, frame rate, safe areas on a notched phone, the browser's own edge gestures.
- Audio on a real phone (the check runs with sound but cannot hear it; iOS silent switch behaviour is unknown).
- A person playing. All difficulty numbers come from bots whose speeds are my estimates of thumb speed, not measurements.
- The radio tune ran without errors but nobody listened to it. The reduced-motion path ran without errors; I did not compare it frame by frame with the full-motion path.
- Real touch input from the browser: the check dispatches `PointerEvent`s on the canvas, so it does not exercise the browser's own touch-to-pointer conversion or `setPointerCapture` with a real touch.

## Known weaknesses

- The page draws the latest sim state each frame without interpolating between ticks. At 60 Hz this should not show; on a 120 Hz screen motion may step slightly.
- Repairs need a pointer. The keyboard can start, pause and resume, but cannot do a repair.
- A slow player cannot finish the lamp (rub) at the top level inside its patience. That is by design (the slow bot should fail late), but it means the lamp is the job that ends most slow runs.
- Leaving customers can overlap the next customer for a moment as they walk off.
- The ghost finger is a drawn thumb; whether people read it as "do this" is untested.

## Ideas of the builder

- **The regular.** From the second shift a regular (top hat, round glasses, moustache) comes as the sixth customer of each shift, says "Me again!", pays double, and waits a little longer. Their object wears more silly things each visit (googly eyes, a moustache, a tiny hat, a bow, sunglasses, a flower), counted in the save. This is my idea; it is not in the brief or in Copper Afternoon.
- Not built: a daily seed shared by everyone, and a rare golden customer who pays big for a two-repair job.

## Kit candidates

- **A touch replay helper for checks.** Turn a list of `{ type, x, y }` steps into real touch `PointerEvent`s, one per animation frame, stopping when a condition changes. `check.mjs` has its own.
- **Gesture plans shared by bots and checks.** `moves.js` makes one finger path per gesture type (circle, drag, tap, flick, rub, arc, swipe) that bots feed per tick and checks feed per frame, with a ghost-finger pose from the same shape. Other gesture games could share it.
- **A check server helper.** Serve `experiments/`, stub `/notes/button.js`, capture lab records. Every game's `check.mjs` repeats this.

## For the lead

- **Outcome names.** `closed` is used for both endings (time and hearts), with `summary.why` telling them apart. `left` is used only for quitting from the pause card, because the lab treats `left` as "ending not reached". Alternative: use `closed` and `walked-out` as two outcomes.
- **WebKit and the lab record.** WebKit logs "Cannot load blob … due to access control checks" if the page navigates while `kit/lab.js` is still compressing a record. The check quits to the menu and waits 300 ms before each navigation. A real player closing the tab mid-shift could lose that last record in Safari. This is a kit question, not fixed here.
- **Screenshot folder.** `check.mjs` writes to `$SHOTS`, or to `fixit-shots` in the OS temp directory when it is unset, so that no session-specific path is written into the repo. This build ran it with `SHOTS` set to the scratch shots folder.
- **Shift length.** The day is 90 s; with the tutorial and walk-ups a shift takes about 1.5 to 2 minutes.

## 2026-11-23: the tester picked this one (note #103)

Asked which of the three new games (Grapevine, Fix-It Stall, Follow Me) to work on more, tester t1 answered "Fix-It Stall" (note #103, answering #100). It is the one of the three to grow next. No change was made in this run; see `experiments/NOTES.md`.
