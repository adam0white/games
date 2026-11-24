# Thumb Duel

Two players share one phone. The screen is split in half, and the top half is drawn upside down. A match is first to 3 duel wins (at most 5 decided duels, hard cap 12 duels including draws). Each duel is drawn from a shuffled deck of 7 kinds without repeats. Solo mode, "Play the bot", puts a sim.js bot in the top half at one of 3 strengths.

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
- The per-tick input for each side is `{held, taps, px, py}`.
- Keyboard and mouse work for the bottom side only. Space is the tap or hold, 1-4 are the memory pads, and the arrow keys move the hockey paddle.

## Duels

| kind | control | rule | time limit |
|---|---|---|---|
| tug | tap | each tap pulls the rope toward you; the ribbon reaching your mark wins | 15 s, then the side nearer its mark wins |
| quick draw | tap | the lantern flashes after 1.4-3.6 s; the first tap after the flash wins the point, and a tap before it gives the point away; first to 2 points; ties are void | 5 flashes or 20 s, then more points win |
| sumo beetles | hold | holding pushes; pressing again shoves; a shove into a beetle that was not holding misses, and the shover stumbles and is dazed; pushed past the edge loses | 15 s, then the more central beetle wins |
| catch firefly | tap | tap the firefly while it is on your side; it feints; a wrong tap dazes you; first to 5 catches | 20 s, then more catches win |
| air hockey | drag | the paddle follows your finger, and the puck is a seed; first to 3 goals | 20 s, then more goals win |
| memory flash | tap | repeat a lit sequence of 3-5 pads on your own 4 pads; first to 2 rounds; finishing on the same tick voids the round | 20 s, then more rounds win |
| balance dewdrop | hold | holding tilts the leaf against a wobble; keep the drop in the middle band longest | 14 s |

A draw scores for neither side, and the match deals another duel. "Best of 5" is implemented as first to 3, so draws can make a match longer (the longest seen in 100 seeds was 8 duels). All parameters are named constants at the top of each duel in `sim.js`.

- Between duels the page shows a score strip readable from both sides (pips), a 3-2-1 countdown, and a pictogram of the next duel's control for each half.
- A match ends with confetti toward the winner. The end card has a rematch button in each half, and a rematch needs both players to tap. In solo, the bot's side is ready at once.

## Progression and save

- The levels are the bot strengths easy, medium and hard. Medium opens after a win against easy, and hard after a win against medium. Each level shows stars equal to min(3, best win streak against that strength).
- Friend mode saves the current and best wins-in-a-row by side colour, and the menu shows that streak line.
- The save is the `save.js` key `duel-save`: `{v:1, sound, matches, friend:{side,run,best}, solo:{easy|medium|hard:{won,run,best}}}`. The hint uses the key `duel:hint`.
- A first-ever match (matches === 0) opens with tug. This puts a tap duel under the tap hint, which shows on the first duel only and only to the bottom player, at the bottom centre.
- lab.js records each duel as `rec.event('duel', {kind, winner, ms, solo})`, and the match as `rec.start({solo, strength, ...})` and `rec.end('won'|'lost'|'played'|'left')`.

## Bot numbers (`node bots.mjs`, 2026-11-24, all claims hold, exit 0)

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

The last run on 2026-11-24 passed with zero page and console errors: WebKit took 101 s, and Chromium took 149 s including the small-screen and desktop runs. It also asserts that the first screen shows exactly one short line. The screenshots are in `/private/tmp/night-duel/`.

## Decisions that differ from the brief

- Solo offers 3 strengths, but medium and hard are locked until the previous strength is beaten. This gives the run a progression.
- Bot match medians are 0.8 to 1.3 min, and careful against easy takes 0.8 min, which is under the 1 minute floor. Human matches have slower reactions and should run longer, but that is unmeasured.
- The widest seat shares are hockey (44% bottom) and quick draw (55-56%). Both are inside the 40-60% claim.
- The tagline and the friend streak share one line on the first screen. The desktop keyboard line is on the pause card.

## Not verified

- Two real fingers on a real phone. Touch was tested only through CDP and synthetic PointerEvents. Real-device multi-touch limits are untested: iOS gesture arbitration, palm rejection, and Android's limit on simultaneous points in the browser.
- Audio on a real iPhone (unlock on the first gesture).
- Real safe-area insets. Playwright reports zero, so the notch and home-bar padding are untested.
- Lab recording end to end. The slug `duel` is not yet in LAB_PROTOTYPES in human-framework, so the server will refuse sends until someone adds it there. That file is outside this directory.
- `kit/check/phone.mjs` seed lines for `duel-save` and `duel:hint` were not added, because that file is outside this directory.
- Whether strangers understand each pictogram without words. No human has played this game yet.

## Open ideas

- Hockey between medium bots usually runs to the 20 s limit: median 20.0, with 38 of 200 duels undecided. It was 17.3 s before medium was softened to fix the ladder. If people find it long, use a wider goal or a 2-goal target.
- Give the top player a hint too. Today only the bottom player sees it.
- An 8th kind (for example "stack": alternating holds to build a tower) so a 5-duel match shows more variety.
- A "party" mode with three-match series and a running tally.
