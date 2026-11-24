# Ant Draft (lab, variant b)

Served at `/lab/ant-draft-b/`. A run-based twist on Ant Promotion: 8 short waves of a one-thumb ant battle, and after
each wave a draft of one promotion card from three. Cards stack, so runs differ. A lab page: no lab recording.

## Rules (all in `sim.js`, pure, seeded, fixed step 1/30 s)

- Portrait arena 360 x 600. The colony's mound runs along the whole bottom edge (y >= 552), entrance in the middle.
- Bugs come down from the top (from wave 3 some enter from the sides) and walk straight down their lane. A bug that
  reaches the mound hurts the nest (termite 1, wasp 2, beetle 3, spider 8) and is gone. Nest starts at 16.
- The one input is a rally point, held 46 px above the thumb so the thumb does not hide the swarm. Soldiers gather
  round it and bite any bug within 38 px. Lift the thumb and they hold where they are. A ground bug that touches an
  ant stops and fights it. Wasps fly: they do not stop, but ants still bite them as they pass.
- Workers fetch the crumbs dead bugs drop; every 3 crumbs at the nest hatch a soldier. Each cleared wave adds 2 soldiers.
- Wave n has a budget of 4 + 7.5n bug points (termite 1, wasp 3, beetle 4); wave 8 is 58 points with one spider (150 hp).
  Beetles from wave 2, wasps from wave 3. The wave plan comes from the run seed and the wave number, so the scout card
  can show it before it starts.
- Lost when the nest reaches 0 or the last ant dies. Won after wave 8.
- Cards (max stacks): Soldiers split on death (2: a soldier dies into k+1 small ants), Workers carry double (2: +1 crumb
  per trip, +1 worker), Scout the next wave (2: the draft shows the next wave's bugs; bugs walk 12% slower per stack),
  Acid trail (3: moving soldiers drip acid that hurts ground bugs), Queen's guard (2: two big guards with crowns hold
  the mound), Sharper jaws (3: +40% bite), Thicker shells (3: +50% soldier hp, healed now), Brood burst (3: +4 soldiers
  now, hatching needs 2 crumbs), Swift legs (2: +30% ant speed), Honey nest (3: nest +4 max, +8 now, +2 per stack after
  every wave).
- Score: 10 per bug point killed, 100 + 5 x nest per wave, 500 for the crown. Best score saved on the device
  (`ant-draft-b:save`), plus a daily run with a seed everyone shares that day and today's score on the menu.

## Page

- Menu: title, one line, Play, Daily run, best, sound. Play starts wave 1 at once; the wave 1 bugs teach by walking at
  the swarm. The shared finger hint (`hold-and-move`, key `ant-draft-b:hint`) shows after 3 s of play with no touch.
- Draft: three tall cards flip in with a sound each; icon first, at most four words (Workers carry double); a stacked
  card shows `++`. Tap one (or keys 1 to 3). Taps in the first 350 ms are ignored, so a thumb still down from the fight
  does not pick by accident. With the scout, the next wave's bugs and counts show under the cards.
- End card: Nest fell / Colony crowned!, the 8 wave dots (the one you fell on in red), every card held as an icon, score,
  best, bugs; Retry is the big button and starts a fresh run at once (the daily run retries the daily seed).
- Juice: screen shake on nest hits, beetle and spider kills and the loss; red flash on nest hits; particles on every kill,
  death, hatch, delivery, split and pick; floating -n and +1; bitten ants and bugs flash; ants squash as they bite;
  bouncing wave banner; confetti at the crown. Every action has a synthesized sound through `kit/audio.js`.
- Kit: `save.js`, `audio.js`, `pause.js` (`onLeave`, P / Escape), `zoom.js`, `screens.js`, `hint.js`, the notes
  button. No `lab.js`.
- `?seed=n` fixes the seed; `?speed=n` (1 to 8) steps the rules n times per frame, used by check.mjs only.

## Bot results (`node bots.mjs`, 120 seeds each)

| Bot | Wins | Mean waves cleared | Clear rate of wave 1..8 among runs that reached it (%) | Won-run play time |
| --- | --- | --- | --- | --- |
| careful | 99% | 7.98 | 100 100 100 100 100 100 99 100 | 164 s |
| clumsy | 45% | 6.00 | 100 100 99 87 80 79 88 95 | 202 s |
| idle | 0% | 1.60 | 100 45 26 21 33 0 0 0 | - |

All checks pass: careful wins >= 70%; clumsy <= careful - 25 pts; clumsy clears wave 1 (100%); clumsy clear rate falls
from 100% at wave 1 to 79% at its worst later wave; idle far below careful; won run 164 s of play (about 4 minutes with
8 drafts); 77 distinct hands in 120 careful runs; same seed and inputs give the same 160 state snapshots and score;
another seed differs. 360 runs take about 5 minutes (`RUNS=40` for a quick pass).

Careful bot: puts the rally point just below the ground bug that will reach the mound first; drafts by a fixed priority
(guard, honey, haul, scout, swift, jaws, acid, brood, shell, split), chosen by measuring each card's win rate with the
careful mover (scratch experiment, 40 seeds per card; guard best, split and shell worst). Clumsy bot: looks again every
1.6 s, 35% of the time lets go, otherwise chases a random bug where it was with +-40 px error; random cards. Idle: never
touches.

The clumsy bot's clear rate among runs that reached a wave is biased by survivorship (only strong hands reach wave 8), so
"difficulty rises" is checked as wave 1 against its worst later wave.

Mutation (`node bots.mjs --mutate`, nest takes no damage): exits 1. Careful, clumsy and idle all win 100%, so three checks fail (clumsy clearly fewer, difficulty rises,
input matters). `--mutate=nobite` and `--mutate=nosplit` also exist; their effect was not measured.

## Phone check (`check.mjs`)

`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node check.mjs` passes on WebKit iPhone 13 and Chromium
Pixel 7 with zero page and console errors (2026-11-24). It checks: menu buttons >= 48 px; Play starts wave 1; the finger
hint appears after 3 s without touch and goes on the first touch; the rally point follows touch pointer events; pause
freezes the rules and Go on resumes; a whole run at `?speed=6` driven by a pointer thumb, taking a card at every draft
(7 drafts), to the end card (both browsers won at wave 8, scores 4780 and 4850); the end card shows one icon per held
card; Retry starts a fresh run in one tap; the best score is saved. Screenshots: `/private/tmp/night-ant-draft-b/`
(menu, hint, play, paused, draft, later wave, end) for both phones; I looked at them.

## Not verified

- Sound and haptics on a real phone; frame rate on a real phone (the check runs on a desktop CPU).
- Whether a person reads the cards without words beyond four; whether the rally point 46 px above the thumb feels right.
- The check plays the full run at `?speed=6`; at speed 1 only wave 1 was played in the check.
- Card balance: Soldiers split and Thicker shells measured weakest; they may need a buff. Clumsy bot's late waves are
  easier than its middle waves because of the cards it holds by then (and survivorship).

## Ideas left open

- Rare gold cards (one per run) that change a rule, such as ants that fly or a second nest entrance.
- A shared daily board (the lab board endpoint), as Lantern has.


## 2026-11-24 independent review

Fixed first-pointer ownership and capture loss. Draft and end transitions now count active game time, so pausing during the 650 ms draft celebration cannot consume the only draft callback, and an old 1100/1300 ms end callback cannot replace a restarted run. Menu/restart clear delayed callbacks and transient effects. Each effects batch is consumed once. Leaving during the 280 ms card-pick animation pauses the next wave. Frame delta is bounded below by zero.

The expanded phone check pauses in the exact draft-transition frame, waits 900 ms, resumes, and requires the draft. It also pauses at the terminal phase for 1500 ms, quits, starts again, waits 1500 ms, and requires the new run to remain playable. It then finishes a separate full run for the original end-card/save/retry assertions. Its overall test deadline increased from 150 to 240 s because the scenario now plays two runs; game-time and correctness thresholds did not change. Precise transition pauses call the visible button's handler from the observation frame; other pause/resume/menu/card controls still use browser taps.

Chromium check exits 0: the final full run wins wave 8, takes 7 cards, scores 4520, and reports zero page/console errors. `check.mjs chromium --mutate-transitions` restores the original wall-clock draft callback and exits 1 at "draft after interrupted celebration". The ownership regression in `../ant-draft/review.mjs` passes: primary x=113.592233, secondary leaves it unchanged, primary then moves to x=157.281553, and lost capture stops it there. Its input mutation exits 1 after secondary takeover moves x to 270.873786.

Normal bots exit 0: 120 seeds per policy, 360 runs; careful 99%, clumsy 45%, idle 0%; mean cleared waves 7.98/6.00/1.60; careful median winning play time 164 s; 77 distinct hands. Wall time 1112.0 s under shared-host load. No rule or balance thresholds changed.

Inspected `review-shots/` menu, hint, play, paused transition, draft, later wave, and end captures. Chromium controls fit without overlap. First-screen text is one short line. The final card shows all seven held cards and its Retry button fits. WebKit verification is recorded below.

### Comparison of the two Ant Draft builds

The first build plays better in this review. Its red soldiers, visible queen, rally flag, and 85-unit combat ring make the action easier to read. A new player can identify both what to protect and where the swarm is being sent. Its spiders attack at range, while wasps hunt workers, so enemies give different reasons to move. Its light draft cards separate icon, short name, effect, and stack count clearly.

The second build has a more compact draft and a useful numeric nest-health display. Its dark soldiers merge into a single moving cluster, and the nest is a small hole on the bottom border. Its narrower 38-unit attack range makes interception more exacting. The first build's explicit queen and larger rally marker communicate that task better. Neither first screen requires a paragraph of instructions; both need the delayed finger hint. Both still depend on short card text to explain upgrades.

This is a judgment from emulated play and inspected screenshots, not a human play verdict. The bots differ between builds; 93.3% versus 99% careful wins and 10% versus 45% clumsy wins are not a controlled comparison of difficulty. No balance or artwork was changed to impose this preference.

The default bot mutation also completed: 360 runs in 2078.3 s, exit 1, with all three policies winning 100%. The checks for fewer clumsy wins, increasing difficulty, and useful input fail as intended.

Final WebKit iPhone 13 check exits 0: all 8 waves won, 7 drafts, score 4730, 110 bugs, zero page/console errors. Both interrupted transitions and blur during card selection recover. Inspected all seven stage screenshots plus the transition pause: menu art renders, all controls fit, all seven held cards fit on the end screen, and text has clear contrast. The independent WebKit review also exits 0: first-pointer x=115.215947 survives the second touch, the owner moves it to x=165.049834, and capture loss stops it there. Blur, restart, and reload pass. Physical notch insets remain unverified by device emulation.

The shared-kit smoke passes after changes on both phone profiles; the full before-run had seven unrelated failures, recorded in `../ant-draft/kit-before.log`. No shared files changed. Local browser servers stub the hosted notes button. Its live service, physical-phone sound/haptics/performance, and human play acceptance remain unverified. Full browser wins here use the existing six-times-speed test hook; a complete normal-speed browser run remains unverified for this build.
