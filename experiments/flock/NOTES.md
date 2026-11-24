# Night Flock

A no-build game at `/flock/`. It was the lab page `/lab/night-flock-2/` ("Night Flock II") until 2026-11-24; that address now redirects here. The original hillside, dog, boids, fold, wolf and endless count came from the first [Night Flock](../lab/night-flock/NOTES.md), which stays in the lab. Its measurements belong to that version.

The newest section is at the end. Sections above it describe the page as it was when they were written; where the promotion changed something, the last section says so.

## 2026-11-24 — Twenty evenings in the valley

Start on Low Beck with twelve sheep. Drag uphill behind them. Evening 2 introduces the drafting gate. Bring sheep to the gate, then hold still to lie the dog down. When sheep graze in the opening with the dog watching, the gate opens. On evening 3, flick sideways toward the bellwether's grazing patch. The dog runs a wide arc and whistles the bellwether off the verge. Drag again to drive the gathered flock. Each new gesture has its own kit hint and saved setting.

Low Beck has evenings 1–6, Fellside has 7–13 and High Tarn has 14–20. Tap a numbered stop on the hand-drawn map to revisit an unlocked evening. Family fleece marks identify a lamb's ewe. The bellwether wears a brass bell. Rushing through sheep and a running wolf can start a panic that spreads between neighbours. The calm meter follows the whole flock. A lying dog eases nearby sheep out of flight.

The bridge and stone lane constrain sheep to their openings. Soft ground slows sheep and dog. Mist reduces flocking sight from 67 to 42 world units. The windsock and arrow show which side will hear the flank whistle farther away. Stars record bringing every sheep home, keeping calm at or above 78%, and finishing within the evening's par. A lost sheep ends the evening. Stars earned on separate clears accumulate. A daily uses the UTC date for its seed and rotates among evenings 2–20, including fields still locked in the campaign. The endless count remains available from the map.

State is local to this version. The keys under `night-flock-2:` are `save` for unlocks, endless best and preferences, `stars` for campaign awards, `daily` for the latest daily result, and `hint-drag`, `hint-hold`, `hint-outrun` for the gesture lessons. There was no play recorder at this point (added at the promotion, see the last section).

### Reproduce

From the repository root, with `PLAYWRIGHT` set to the directory containing the Playwright package:

```sh
fnm exec --using=26.12.0 node experiments/flock/bots.mjs
fnm exec --using=26.12.0 node experiments/flock/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/flock/check.mjs
```

The mutation reverses uphill dog pressure. It should exit 1. The phone check serves the field, kit and feedback button from the checkout. The screenshots from this pass are in `/private/tmp/night-r5-flock2/`. Chromium uses touch drags. WebKit uses a mouse for sustained gestures on the phone viewport and touch taps on menus.

### Simulation results

The ordinary suite exited 0. Reversing dog pressure exited 1 with 0/12 home in the opening drive. The original opening, rescue, hazard, wolf and endless checks keep their numerical thresholds.

| Policy or probe | Result |
| --- | --- |
| Full commands, campaign | 99/99 clears across all 20 evenings |
| Endless | 20/20 clears across waves 1, 2, 5, 8 and 30 |
| Opening drag | 36/36 clears at 10, 26, 80 and 200 world units/s |
| Disable outrun | 0/30 clears on evenings 3, 8, 12, 15, 18 and 20 |
| Disable lie-down | 0/30 clears on evenings 2, 7, 11, 14, 17 and 20 |
| Drive the exposed bellwether first with no whistle | 0/6 clears |
| Park a standing dog outside its usual pressure radius | 0/6 drafting gates opened |
| One correctly directed flick | 90/90 gathers across six fields, five seeds and three contact durations |
| Initial placement | 340/340 layouts started clear of collision geometry |
| Consecutive daily evenings, 24 November–12 December 2026 UTC | 19/19 clears |

Median clear time increased from 19.52 s to 30.20 s to 33.53 s across the three farms. The largest adjacent evening rise in median clear time was 15.03 s. The least daylight remaining on a sampled clear was 53.5%. Evening 20 took 42.3–48.7 s with 80/80 home. Of 99 campaign clears, 62 earned calm, 69 beat par and 45 earned both. A single pass through the 20 fixed campaign seeds took the bot 580.77 simulated seconds, excluding menus and retries.

Paired simulations isolated four effects. Changing the assigned ewe displaced a lamb by 4.31 world units after 1 s. Changing the bellwether displaced a follower by 2.24 units after 1 s. Reversing the wind changed a sheep's response to the same whistle by 0.69 units in 0.3 s. The same 0.6 s drive left a sheep 8.39 units farther behind on bog than on grass. Other assertions cover panic across two neighbour links, mist sight, settling on open grass, and blocked versus open crossings.

Independent play exposed two bypasses. A standing dog could wait out the drafting gate. A dog could drive the uncalled bellwether straight off its grazing patch. The gate now needs both a visibly lying dog and settled sheep. The uncalled bellwether returns to its patch. Ending an outrun stands the dog up. A separate one-flick check covers a case where the dog missed the moving bellwether and the original bot silently retried.

### Phone checks and visual review

The phone check uses normal controls for the opening, a second 10-unit/s drive after par, both command lessons, an entire daily, the next UTC daily, an endless wave and the first arrivals of the next wave. The map and late campaign checks use seeded unlocks. Replaying the slower opening earns two stars and retains the previously earned third star on the map. During testing, a stationary pointer laid the dog down with 19/20 sheep home on evening 3. The phone driver now lifts and starts a fresh drive if the dog lies down while it is still trying to move sheep. Three reduced-motion lessons were also opened and inspected on the Chromium phone profile.

The complete opening HUD fits 390 × 664 and 320 × 568 CSS pixels. A deliberate slow drag had previously triggered a hold. Coherent small movement now resets the hold timer, and a delayed frame contributes at most 50 ms of stationary time. A still contact needs 430 ms. A flick travels at least 28 world units horizontally in at most 300 ms.

One WebKit capture lost the landscape while the HUD and animals continued painting. The screenshot check now samples tonal contrast across the mountain ridge as well as contrast across the whole image. The static landscape requests a CPU-backed canvas and rebuilds on context restoration. Each frame replaces the previous one. Thirteen separate WebKit openings showed the hillside. In a diagnostic session, erasing the cache and dispatching a restoration event recovered the original sampled sky pixel. The cause of the first missing landscape remains unresolved.

In a separate run on each profile, trusted pointer gestures cleared the entire final evening. Both runs gathered the bellwether, opened the drafting gate under a hold and brought 80/80 home. Timing covered the actual animation callback including simulation, canvas drawing and HUD updates. WebKit recorded 3,042 callbacks, with p95 2 ms and maximum 4 ms over the whole clear, in 41.63 simulated seconds. Chromium recorded 2,965 callbacks, with p95 1.0 ms and maximum 16.1 ms, in 48.77 simulated seconds. The measurements run on a host browser with a phone profile. Physical-handset rendering, audible whistle quality and voluntary twenty-minute play remain unverified.

The final phone suite exited 0. Both profiles cleared the opening, drafting gate, outrun, daily and first endless wave. Both reported zero browser errors, external requests and telemetry requests. The kit self-check also passed on both profiles before and after the work.

| Profile | Opening (s) | Slow replay (s) | Hold, 16 home (s) | Outrun, 20 home (s) | Daily, 24 home (s) | First endless wave, 32 home (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| iPhone 13 / webkit | 9.58 | 21.63 | 23.93 | 17.18 | 18.38 | 21.82 |
| Pixel 7 / chromium | 9.62 | 21.62 | 24.22 | 17.17 | 17.88 | 19.97 |

Four short bursts per profile measured all 80 sheep still in the field. Two bursts included a flank command. Each burst had to advance the simulation. The check enforces a maximum callback cost below 16.7 ms. Browser callback intervals are measured separately.

| Profile | Frames | Callback p95 / maximum (ms) | Interval p95 / maximum (ms) |
| --- | ---: | ---: | ---: |
| iPhone 13 / webkit | 80 | 1.0 / 2.0 | 15.0 / 17.0 |
| Pixel 7 / chromium | 83 | 1.6 / 1.8 | 16.7 / 16.8 |

## 2026-11-24 — First-use phone review

- The delayed opening hand swept sideways and replaced the uphill path. It now moves 48 CSS px uphill while the path stays visible. A tap or sideways drag leaves both cues available. An uphill drag of 14 world units dismisses the lesson.
- Rotating the idle field left the visible hand 104 CSS px left of its intended anchor on both profiles, and 127.62 px above it on iPhone 13 or 170.39 px above it on Pixel 7. The cues now use the field itself for positioning. The phone check covers rotation before input and while steering.
- Either flick direction previously marked the bellwether lesson complete. The footer now asks the player to wait while the dog circles. An opposite flick leaves the lesson available. The existing key is written after the bellwether joins the flock.
- With the private feedback link visible, it covered 985.09 CSS px² of the pause button on Pixel 7, and 618.47 CSS px² of the field at 320 × 568. The link now clears the pause, field and valley map controls on both profiles at their portrait sizes and at 320 × 568.

The Playwright check repeats the sideways and uphill drag, idle rotation, unsuccessful and successful flicks, and feedback hit areas. It also exercises pause, retry, navigation away and Back, mid-evening reload, the daily, and endless play. No game or acceptance threshold changed. A flick test retries only if the browser reports more than 300 ms from press to release. The first delivered gesture within the window must work. Against the original opening styles, the regression exited 1 at the sideways path assertion.

Both profile checks exited 0 with zero browser errors, external requests or telemetry. Bots exited 0 with 99/99 campaign and 20/20 sampled endless clears. The reversed-pressure mutation exited 1 with 0/12 sheep home. The shared phone suite passed the three pages and their hints across the two profiles after rerunning one transient WebKit outrun timeout.

| Profile | Opening / slow replay (sim s) | Hold / flank lesson (sim s) | Daily / first endless wave (sim s) | 80-sheep callbacks | Callback p95 / max (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | 9.87 / 22.03 | 23.65 / 18.07 | 18.05 / 19.55 | 83 | 2.0 / 2.0 |
| Chromium Pixel 7 | 9.93 / 21.82 | 28.05 / 15.73 | 16.40 / 18.63 | 84 | 1.6 / 2.0 |

The landscape anchor finished within 0.013 CSS px of its target on both profiles. Fresh campaign play cleared consecutive evenings 1–10 on WebKit and 1–6 on Chromium. An early pass stalled at the evening 7 cross-gate on both profiles, with 0/40 home after 89 simulated seconds. Holding again after bringing the sheep closer cleared it on the next WebKit run in 32.32 s. With the final evening opened using an unlocked save, trusted gestures brought home 80/80 sheep on both profiles in 46.10 and 44.78 simulated seconds respectively. Both runs used one flank flick and opened the drafting gate. The game checks use the native animation clock. The separate campaign runs advance the Playwright clock between inputs.

Reviewed the 42 final check captures and both final-evening results under `/private/tmp/night-r6-review/flock/`. An uninterrupted 20-evening campaign, physical-device performance, audible feedback and unaided first-time play remain unverified.

## 2026-11-24 — Promoted to /flock/

Done means: a stranger on a phone, reading Turkish or nothing, starts, understands and finishes it. That is measured below with bots and browser checks. It is not confirmed by a person.

### What changed

- **Move.** `experiments/lab/night-flock-2/` is now `experiments/flock/`. `/lab/night-flock-2/` is a redirect that keeps the query string. The storage keys keep their `night-flock-2:` names, so a save made on the lab page still loads. The game is in `kit/games.json` (fresh) and its shared phone check moved from `kit/check/lab-pages.mjs` to `kit/check/pages.mjs`.
- **First card.** The page used to open straight on the field. It now opens on a card with the title, one Play button that names the evening, the language button and the recording notice. Reason: the notice has to be seen before anything can be recorded, and it does not fit on the field at 320 x 568. Cost: one more tap. Play also starts the sound.
- **Teaching without sentences.** The sentence under the field and the paragraph on the pause card are gone. `teach.js` decides what the field should picture at each moment (`cue(game)`), and `art.js` draws it on the field:
  - evening 1: the uphill route and the moving hand (as before);
  - from evening 2, whenever nothing else is asked: a dotted line from the flock to the next narrow place the lowest sheep has still to pass (the bridge, the cross-gate or the lane), and to the fold once none is left. Daily and endless fields show the same line;
  - sheep waiting at the closed gate: a ring at the place to press, with an arc that fills while the gate counts down, and the moving hand of the lie-down lesson at that point (it used to appear in the middle of the field at the start of evening 2, before there was anything to do with it);
  - an uncalled bellwether: a dotted arc from the dog round the outside to the bellwether, a ring on the bellwether, and an arrow beside the dog in the direction to flick;
  - eyes in the trees or a wolf: a dotted line from the dog to it and a ring on it (first seen on evening 4);
  - a sheep within 12 units of a bank: a ring on the far side of it, where the dog should go.
  Not pictured: the bog, the mist and the wind. They change how the flock moves, not what the player does, and the line still shows where to go. The weather keeps its short label above the field.
  The reduced-motion labels of the three kit hints are short and translated. The pause card shows the three star goals as a picture row (none lost, calm 78%+, par seconds).
- **Rule changes that follow from the teaching** (see numbers below):
  - Sheep get a foothold at the banks from evening 2 (it was evening 6). A sheep at the edge is pushed back in unless the dog is close behind it.
  - The time limits are as they were. During the audit evenings 2 to 10 were lengthened for the naive bot, and one replace landed on the wrong rows (evening 6 got 104 s). Once the dotted line existed the longer limits changed nothing (table below), so the original limits are back.
  - A finger on the field no longer calls the dog off an outrun towards an uncalled bellwether. This replaces the sentence "wait before dragging again".
- **Turkish.** All words come from `words.js` through `kit/i18n.js` (`en` and `tr`). `?lang=tr` or the globe button on the first card and the pause card switches. Farm names are translated (Aşağıdere, Yamaçlı, Yukarıgöl).
- **Recording.** `kit/lab.js` with slug `flock`: notice on the first card, switch on the pause card. A run starts at the first touch of an evening with `{ level, mode, wave, seed, sheep, lang }`. Events: `hold` and `flick` (the first 12 of each, with whether the field was asking for it), `gate` (cross-gate opened) and `gathered` (bellwether called). It ends with `won`, `lost` (a sheep lost), `dark` (out of time) or `left` (a retry or a map pick mid-evening), and a summary: home, sheep, lost, lostTo, rescued, time, lowest calm, stars, holds, flicks, wrongFlicks, gateAt, gatheredAt.
- **End of an evening.** Three rising notes on a win and the stars arrive one at a time; a falling note on a loss, and Try again becomes the main button. Winning evening 20 shows "The whole valley is home" with the star total and a longer tune; its main button still leads to the endless count. No modes or menus were added.

### Audit numbers

`bots.mjs` now holds three players that act through a finger model (`playFinger`): a press sets where the dog runs, a press held still for 0.43 s where the dog stands is the lie-down, a flick is the outrun.

- **Careful**: the existing bot, unchanged in behaviour.
- **Clumsy**: the careful bot acting on what it saw 150 ms earlier, with 15% of its half-second inputs replaced by a wrong one (a touch at a random place, an unwanted lie-down, or a random flick).
- **Naive**: knows only what the page pictures (`cue`). It drags uphill from below the flock as the first hand shows, goes to a ring when one is shown, presses where the lie-down hand is, flicks the way the arrow points, drags along the dotted line from behind the lowest sheep when one is shown, and otherwise repeats the uphill drag that worked on evening 1. It answers a picture one second after it appears. It does not look at the terrain.

Sixty fresh seeds per evening for careful and clumsy, twenty for naive (seeds `5000 + 37 i`); the campaign itself always deals seed = evening number.

```
Evening               1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20
Careful, 60 seeds  100%100%100%100% 98%100%100%100%100%100%100%100%100%100%100%100%100% 98%100%100%
Clumsy, 60 seeds    98%100%100%100%100%100% 97%100%100%100% 95%100%100% 98%100%100%100%100%100%100%
Naive, 20 seeds    100%100%100%100%100%100%100%100%100%100%100%100%100%100%100%100%100%100%100%100%
Naive, own seed      9s  22s  16s  20s  27s  36s  33s  29s  37s  30s  37s  59s  31s  37s  30s  37s  66s  38s  49s  60s
Very clumsy (500 ms late, 50% wrong), 20 seeds, evenings 3, 12, 20: 95%, 20%, 0%
```

("Own seed" is the campaign as dealt, seed = evening number; the figure is the time of the win.)

- Careful: no wall. The lowest evening is 98% (59 of 60), against the 85% line. It also wins every evening on the campaign seed. The older suite is unchanged: 99 of 99 campaign runs, 20 of 20 endless runs.
- Clumsy: 95% or better on every evening, 97% or better on the first third (evenings 1 to 7). The check in `bots.mjs` asserts at least 50% on evenings 1 to 7.
- Is the clumsy row a measurement, or can nothing lose? A much worse finger (500 ms late, half of its inputs wrong) wins 20% on evening 12 and 0% on evening 20, and `bots.mjs` asserts that it stays at least 20 points under the clumsy row there. On evening 3 it still wins 19 of 20: the first evenings forgive almost any finger since the foothold change. That is intended for a first-time player and it means the first-third clumsy numbers say little about skill.
- Naive, campaign as dealt: clears evenings 1 to 20 in a row. It is reported, not asserted. The page check also plays evening 20 this way (see below).
- How the naive row got there (20 fresh seeds per evening, evenings 1 to 20):
  - before any change: evening 1 won, then 0 of 20 on each of evenings 2 to 5 (a sheep lost to the woods at about 18 s on evening 2);
  - bank picture, foothold from evening 2 and longer limits (since withdrawn): `100 50 50 30 30 30 25 65 5 75 80 0 85 75 85 75 35 55 30 50` %, as dealt it cleared 1 to 4 and ran out of light on 5 with 24 of 28 home;
  - dotted line to the bridge, cross-gate and lane: `100 100 50 65 30 80 70 100 5 95 75 30 85 50 80 55 80 55 80 90` %, as dealt it failed evenings 4, 5, 9, 13, 14 and 19, always on the clock;
  - dotted line to the fold as well: 100% on every evening.
  The bot is exact and tireless, so 100% is an upper bound on what the pictures can carry, not a forecast for a person.
- Why the foothold. The careful bot had no wall, so the brief's condition for a retune was not met; the one rule change kept is for the first-time player. Before any change the naive bot won evening 1 and then 0 of 20 on each of evenings 2 to 5: on evening 2 it lost a sheep to the woods at about 18 s and never reached the gate. With the bank picture alone: 2, 7, 12 and 13 of 20 on evenings 2 to 5, still losing sheep at 17 to 44 s. With the foothold from evening 2 the losses stopped and the failures became the clock (for example 15 of 16 home). The dotted line removed those. Longer limits were tried in between and withdrawn: with the original limits against the lengthened ones, the careful and naive rows are identical, the clumsy row differs on one evening (7: 97% against 98%), and the very clumsy control reads 95%, 20%, 0% against 100%, 20%, 0%. The foothold was not re-measured without the line in place.
- Test changed with the rule: the bank test in `bots.mjs` now puts the dog 13 units inside the bank (it was 24), because a dog 24 units away no longer drives a sheep over on evening 2+. Its assertions (a pressed sheep is lost, a rescued one is counted) are unchanged.
- `bots.mjs` exits 0 (about 3 minutes). `bots.mjs --mutate` exits 1.

### Browser checks

- `check.mjs` passes on WebKit iPhone 13 and Chromium Pixel 7. It now also checks:
  - the first card and its notice are inside the viewport; nothing goes to the lab address and no player number exists before the first touch on the field;
  - a won run for evening 1 arrives with the fold count and stars; an abandoned evening arrives as `left`; an evening left to run out of light arrives as `dark`, shows "Gece bastırdı", hides Next and focuses Try again as the main button; with the pause-card switch off a whole evening sends nothing and the player number is forgotten;
  - the lie-down hand appears only once sheep wait at the gate, sits under the gate, hides under the pause card and comes back after it; a touch during an outrun does not cancel it;
  - `/lab/night-flock-2/?lang=tr&look=pine` lands on `/flock/?lang=tr&look=pine`;
  - `?lang=tr` on a fresh browser shows no English on the first card, field, result, dark result, evening 2, pause card, map and finale (compared against the word tables, including words painted on canvases and labels read by screen readers; the detector is shown to catch "Paused" and "Try again"), at the phone size and at 320 x 568, with no text leaving its card or column; the tester notes button is present there, has its Turkish label and does not cover the language button;
  - evening 20 is played to its end at 320 x 568 by a script inside the page that reads only `cue()` and dispatches synthetic `PointerEvent`s on the field (the naive bot, in real time; 59 s on Chromium and 51 s on WebKit in the last run, 60 s and 69 s in the one before). It must win; the finale card must show its title, line, star total out of 60 and the endless button, and a second `won` run for level 20 must arrive.
  The lab address is answered inside the check; the real one is never called. The old assertions that the page never sends anything and keeps no `hf-lab` keys were replaced by these, because recording is now wanted.
- That check found one thing: the Turkish label for the countdown ("Hava kararıyor") was wider than its column. It is now "Gün batımı".
- `node experiments/kit/check/phone.mjs flock webkit` and `chromium` pass (save kept, pause, sound, the three first-time hands). The lie-down hand is timed from the moment sheep wait at the gate, so the shared check does not run its pause leg for that hand; `check.mjs` does (above). `phone.mjs lab/night-flock-2` now matches no page and exits 0 without running anything.
- Screenshots of the last run are in `/private/tmp/night-r7-flock/` (not kept in the repository). Looked at: first card (both languages); in Turkish the field, result, dark result, evening 2 with its line, pause card, map, evening 20 early in its run (the dog was on its outrun, so no line was showing), finale; in English the lie-down and outrun lessons, the wolf picture and the fold line on the endless field. `check.mjs` takes about two minutes longer per browser than before (the 50 s wait for dark and the evening-20 run).

### Not verified

- No person has played it, on any device. The naive bot is the only evidence about a first-time player; it reads the pictures perfectly and never tires, which a person will not.
- A real phone: touch feel, the 0.43 s lie-down press under a real thumb, sound after the first touch (the checks count audio contexts; nobody has listened to the end-of-evening notes or the finale tune).
- Turkish was written without a native reader's review.
- Production recording: the lab server accepts only listed games. `flock` must be added to `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts` and deployed; until then every send is refused. The checks answer the lab address themselves.
- The bank ring was never seen in a screenshot (it shows only while a sheep is within 12 units of a bank). Its position is covered by the bots, which steer by it. The dotted line to a bridge or a lane was never looked at in a screenshot; the line to the cross-gate (evening 2) and to the fold (endless) were.
- A loss by a lost sheep (`lost` outcome, "Lost in the woods / to the stream" titles) was not produced in a browser; the `dark` loss was.
- The redirect was checked on the local server only, not on the deployed host.
