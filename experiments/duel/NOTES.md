# Thumb Duel

Two players share one phone. The screen is split in half, and the top half is drawn upside down. A match is first to 3 duel wins (at most 5 decided duels, hard cap 12 duels including draws). Each duel is drawn from a shuffled deck of 9 kinds without repeats. Solo mode, "Play the bot", puts a bot in the top half at one of 3 strengths.

Served at `/duel/`. There is no build step. The files are:

- `sim.js`: the rules. It is pure and seeded (mulberry32), with a fixed step of 1/60 s, and both sides resolve on the same tick.
- `brain.js`: the bots. Each bot sees a view delayed by its reaction time, and its taps are capped at a thumb rate.
- `art.js`: the palette and drawing helpers.
- `main.js` and `index.html`: the page.
- `bots.mjs`: the balance and acceptance claims. Run `node bots.mjs`; add `--quick` for a smaller run and `--mutate` for the mutation run.
- `check.mjs`: the Playwright check.

## Board and input

- The board is 1 wide and 2 tall: x runs 0..1 and y runs -1 (top) to 1 (bottom). Side 0 is the bottom player and side 1 the top. `mirror()` gives the top player the same view as the bottom player.
- Each pointer is assigned to a side by where it went down (`pointerId` to side, set at pointerdown). It keeps that side until it lifts, even if it crosses the middle line. Pause clears all pointers. In solo mode, touches in the top half are ignored.
- Each side sends `{held, taps, px, py, heldFor, releases}` per tick. Only presses started during a swipe or launch duel can complete those gestures. Pause and pointer cancellation discard unfinished gestures.
- Keyboard and mouse work for the bottom side only. Space is the tap or hold, including release to launch. Keys 1-4 are the memory pads. The arrow keys move the hockey paddle. Up scores one swipe per press.

## Duels

| kind | control | rule | time limit |
|---|---|---|---|
| tug | tap | each tap pulls the rope toward you; the ribbon reaching your mark wins | 15 s, then the side nearer its mark wins |
| quick draw | tap | the lantern flashes after 1.4-3.6 s; the first tap after the flash wins the point, and a tap before it gives the point away; first to 2 points; ties are void | 5 flashes or 20 s, then more points win |
| sumo beetles | hold | holding pushes; pressing again shoves; a shove into a beetle that was not holding misses, and the shover stumbles and is dazed; pushed past the edge loses | 15 s, then the more central beetle wins |
| catch firefly | tap | tap the firefly while it is on your side; it feints; a wrong tap dazes you; first to 5 catches | 20 s, then more catches win |
| air hockey | drag | the paddle follows your finger, and the puck is a seed. First to 3 goals, with a goal opening spanning 70% of the board | 20 s, then more goals win |
| memory flash | tap | repeat a lit sequence of 3-5 pads on your own 4 pads; first to 2 rounds; finishing on the same tick voids the round | 20 s, then more rounds win |
| balance dewdrop | hold | holding tilts the leaf against a wobble; keep the drop in the middle band longest | 14 s |
| beetle race | flick | flick toward the center and lift to advance. First to 17 valid flicks | 17 s, then more flicks win |
| seed launch | hold and release | hold to charge, then lift at the gold mark. Up to 100 points per shot. Both sides get the same six marks | 16 s or six shots per side, then higher total wins |

A draw scores for neither side, and the match deals another duel. "Best of 5" is implemented as first to 3, so draws can make a match longer (the longest seen in 100 seeds was 8 duels). All parameters are named constants at the top of each duel in `sim.js`.

- Between duels the page shows a score strip readable from both sides (pips), a 3-2-1 countdown, and a pictogram of the next duel's control for each half.
- A match ends with confetti toward the winner. The end card has a rematch button in each half, and a rematch needs both players to tap. In solo, the bot's side is ready at once.

## Progression and save

- The levels are the bot strengths easy, medium and hard. Medium opens after a win against easy, and hard after a win against medium. Each level shows stars equal to min(3, best win streak against that strength).
- Friend mode saves the current and best wins-in-a-row by side colour, and the menu shows that streak line.
- The save is the `save.js` key `duel-save`: `{v:1, sound, matches, friend:{side,run,best}, solo:{easy|medium|hard:{won,run,best}}}`. The hint uses the key `duel:hint`.
- A first-ever match (matches === 0) opens with tug. The tap hint shows after 3 s of idle play. In friend mode a copy faces each player. In solo, it faces the human player. The first accepted play input retires the hint.
- lab.js records each duel as `rec.event('duel', {kind, winner, ms, solo})`, and the match as `rec.start({solo, strength, ...})` and `rec.end('won'|'lost'|'played'|'left')`.

## Initial bot numbers (`node bots.mjs`, 2026-11-24, all claims hold, exit 0)

- Determinism: seed 4242 plays the same match twice, and another seed gives a different match.
- Each duel alone was played for 100 seeds per row:

| kind | careful vs idle | careful vs clumsy (bottom/top) | bottom-seat share, medium vs medium | median s, medium vs medium |
|---|---|---|---|---|
| tug | 40/40 | 100% / 100% | 51% | 15.0 |
| quick draw | 40/40 | 100% / 100% | 55% | 10.8 |
| sumo | 40/40 | 72% / 72% | 46% | 15.0 |
| catch | 40/40 | 87% / 92% | 49% | 10.6 |
| hockey | 40/40 | 100% / 99% | 44% of 162 decided | 20.0 (at the limit) |
| memory | 40/40 | 99% / 99% | 47% | 17.0 |
| balance | 40/40 | 100% / 100% | 48% | 14.0 |

- Full matches, 100 seeds each:

| player | vs easy | vs medium | vs hard | match length |
|---|---|---|---|---|
| clumsy | 97% | 30% | 0% | 0.9-1.3 min |
| careful | 100% | 100% | 100% | 0.8-1.0 min |

- Between medium bots, p90 / longest duel in seconds: tug 15.0/15.0, draw 14.6/20.0, sumo 15.0/15.0, catch 14.1/17.9, hockey 20.0/20.0, memory 20.0/20.0, balance 14.0/14.0. Before the 20 s caps were added to draw and memory, memory reached p90 23.2 s and draw a longest of 23.9 s.
- Every duel has a hard limit of at most 20 s, and none ran longer.
- No bot taps faster than 8.5/s or reacts faster than 0.18 s.
- Mutation (`--mutate`): a top tap in tug pulls toward the bottom. Four claims fail, and the run exits 1:
  - careful vs idle: 20/40
  - careful vs clumsy from the top: 0%
  - bottom-seat share: 100%
  - tug median: 4.5 s

## Playwright check (`check.mjs`)

The check runs on WebKit (iPhone 13) and Chromium (Pixel 7) and uses real pointer input:

- Chromium uses CDP `Input.dispatchTouchEvent` with two touch points. touchEnd lists only the lifting points; listing the remaining points lifts them instead, which was verified by a probe.
- WebKit uses dispatched PointerEvents with two pointerIds.

It covers:

- The menu and levels.
- A first match against easy that opens with tug and shows the hint, played to a win by thumb.
- The end card, the lab record, the solo rematch, pause, blur, and the medium unlock.
- A friend tug match won 3-0 by two simultaneous thumbs, where the rematch needs both taps.
- Sumo hold and tap independence.
- Hockey: two paddles at once, a top finger crossing into the bottom half, then the bottom finger lifting.
- Every kind, forced with screenshots.
- Memory won by thumb.
- A 360x640 screen, and desktop keyboard and mouse.

The initial run on 2026-11-24 passed with zero page and console errors. WebKit took 101 s, and Chromium took 149 s including the small-screen and desktop runs. It also asserts that the first screen shows exactly one short line. The initial screenshots are in `/private/tmp/night-duel/`.

## 2026-11-24 update

- Widened the hockey goal from 50% to 70% of the rink and kept three goals to win. In the 200-seed medium-bot test, the median dropped from 19.98 s to 12.78 s, p90 was 17.93 s, and draws dropped from 38/200 to 7/200 (3.5%). Four additional batches had 6, 6, 10 and 7 draws per 200, for 36/1,000 (3.6%) across all five batches.
- Mirrored the shared tap hint by rotating the top copy 180°. The first accepted tap dismisses both copies and saves the existing `duel:hint` key.
- Added Beetle Race and Seed Launch. A valid flick moves at least 22% of the board width toward the center in at most 0.45 s. A launch scores by the distance from the mark when the thumb lifts. The simulation applies both seats' inputs before it decides a winner. Equal final totals draw.

| medium vs medium | median | p90 | longest | undecided |
|---|---:|---:|---:|---:|
| beetle race | 15.92 s | 17.00 s | 17.00 s | 17/200 |
| seed launch | 10.47 s | 11.22 s | 12.30 s | 0/200 |

- In each new duel, careful beats idle 40/40 and beats clumsy 100/100 from each seat. Added scripted checks for invalid flicks, simultaneous finishes, and launch accuracy. The existing balance thresholds are unchanged. The deck minimum assertion rose from 7 to 9 to require the two additions.
- The test-only `slow-human` profile uses a 0.35 s base reaction and a nominal tap rate of 3.9/s. Match times include the 3 s intros and 1.6 s result cards.

| 100 matches per matchup | median | range | 60–180 s |
|---|---:|---:|---:|
| slow-human vs slow-human | 78.82 s | 41.02–126.53 s | 80/100 |
| slow-human vs easy | 73.45 s | 44.32–125.32 s | 66/100 |

- Careful beat easy 100/100 at a median of 44.25 s. The full bot run exited 0. The tug mutation still exited 1 with four failed claims. The optional `--quick` sample reports the same tug seat-share failure as before this change (20 bottom wins in 53 decided duels).
- `check.mjs` passed with zero browser errors on WebKit iPhone 13 (124 s) and Chromium Pixel 7 (179 s, including the small-screen and desktop runs). It checked both hint copies, valid and invalid flicks in both seats, independent holds and releases, pause cancellation, and the new keyboard controls. The countdown, in-play and scored screenshots were inspected on both profiles. They are in `/private/tmp/night-duel-r2-final/`.
- The shared kit's Duel check passed for both profiles with existing `duel-save` and `duel:hint` fixtures. The full shared-worktree preflight was stopped after it reported failures in other experiments.

## Decisions that differ from the brief

- Solo offers 3 strengths, but medium and hard are locked until the previous strength is beaten. This gives the run a progression.
- The tagline and the friend streak share one line on the first screen. The desktop keyboard line is on the pause card.

## Not verified

- Two real fingers on a real phone. Touch was tested only through CDP and synthetic PointerEvents. Real-device multi-touch limits are untested: iOS gesture arbitration, palm rejection, and Android's limit on simultaneous points in the browser.
- Audio on a real iPhone (unlock on the first gesture).
- Real safe-area insets. Playwright reports zero, so the notch and home-bar padding are untested.
- Live lab routing and storage. The browser check intercepts the endpoint and verifies the records the page sends.
- Actual match duration with people and whether new players understand each pictogram.

## Open ideas

- A "party" mode with three-match series and a running tally.

## 2026-11-24 — phone play review

- Quitting to the menu before the first tug input used to retire the help for that visit. The next eligible duel now still shows it. One accepted input still retires both copies.
- Quick Draw's countdown used to demonstrate repeated taps around both sides of the lamp's flash. The pictured thumb now taps only while its lamp is lit. Each player's live cue distinguishes waiting from tapping.
- Holding the pause key produced a second toggle through keyboard repeat. One press now makes one transition.
- Layout changes cancel existing contacts and their queued input. Seed Launch resumes with two fresh holds instead of charging toward a shot with pre-rotation coordinates.
- A Beetle Race flick could start on the pictured beetle late in the race and score nothing. The minimum starting distance from the center is now 0.23 board widths, down from 0.34, matching the lane's near edge. A flick still needs 0.22 board widths of travel within 0.45 seconds. Both seats use the same rule. No check or bot acceptance threshold changed.
- At 342 px landscape height, the old result's Menu button spanned y=335–383, leaving 7 of its 48 px visible. The result now keeps both player regions within the viewport and places the bottom actions side by side. Short menu cards permit vertical touch scrolling. Tug keeps both critters in frame during a large pull. Seed Launch separates each final score from its result label.
- At 280 px height, a native Chromium drag scrolled the menu 110 px and moved the 48 px Sound control from y=262.34–310.34 to y=152.34–200.34. A native tap then toggled it.

Local play used a clean save, the normal countdown, and the real input path. Timings below are wall-clock seconds measured after the initial help and pause exercise for easy, and from starting the driver on medium and hard. The driver reads the game state and sends touches. It leaves the simulation clock and results alone.

| Profile | Easy | Medium | Hard | Two-seat Beetle Race | Two-seat Seed Launch |
| --- | --- | --- | --- | --- | --- |
| WebKit iPhone 13 | 3–0 in 28.464 s | 3–1 in 58.980 s | 3–0 in 39.593 s | 17–17 in 5.53 s | 585–451, 6/6 shots per seat, in 7.75 s |
| Chromium Pixel 7 | 3–0 in 36.643 s | 3–1 in 60.796 s | 3–0 in 39.833 s | 17–16 in 9.40 s | 556–407, 6/6 shots per seat, in 8.33 s |

The review exercised pause and resume, leaving and returning, rematch, landscape and a mid-duel reload that retained completed progression. Chromium used native Playwright taps and CDP multi-touch. WebKit used native taps and dispatched touch PointerEvents for multi-touch. The browser assertions cover each correction above. Phone checks hit-test visible, enabled control centers, verify at least 48 px in both dimensions, then send native Playwright taps. For WebKit, the check nudges the viewport by 1 px and restores it before play, and schedules the timing-sensitive first pair of releases in the document. Both changes address host-side frame and actionability stalls. Screenshots use CSS-pixel resolution and a 90 s capture timeout. The timed launch checks are separate from screenshots taken while charging.

The full bot check exited 0 in 6.2 s. The tug mutation exited 1 with four failed claims. Between equal medium bots, Beetle Race had a 15.92 s median and 17 draws in 200, and Seed Launch had a 10.47 s median and zero draws in 200.

The final screenshot-enabled `check.mjs` exited 0 on WebKit iPhone 13 (127 s, 33 captures) and Chromium Pixel 7 (188 s, 26 phone captures plus four small-screen and desktop captures). Both passed with zero browser errors. The final landscape Seed Launch replay ended 550–550 on WebKit and 569–569 on Chromium after six shots per seat. The registered shared Duel play and hint checks passed on both profiles. Screenshots are under `/private/tmp/night-r3-review/thumb-duel/verified/`. Reviewed first play, layout, pause, rematch, both new duels and landscape results.

Still unverified: first-time human comprehension, two contacts and safe-area insets on physical phones, audio by ear, and live lab delivery.
