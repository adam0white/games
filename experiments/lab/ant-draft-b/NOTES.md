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

