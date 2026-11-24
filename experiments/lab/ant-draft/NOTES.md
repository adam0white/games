# Ant Draft notes

Lab page at `/lab/ant-draft/`. Built 2026-11-24 from the brief "Ant Draft, a run-based twist on Ant Promotion". A second build of the same brief is in `lab/ant-draft-b/`; this one was written without looking at it. No lab telemetry.

## The game

- Portrait meadow, the queen on her mound at the bottom. Enemies walk down from the top in 8 waves.
- One control: the thumb is the rally flag. Soldiers gather at the flag and bite any enemy within 85 units of it. On touch the flag sits 44 px above the finger so the thumb does not cover the fight. Mouse: the flag follows the pointer. Keyboard: arrows or WASD move the flag, 1 2 3 pick a card, P or Escape pauses.
- Workers act by themselves: they carry the crumbs dead enemies drop to the nest; 3 crumbs hatch a soldier. 3 soldiers hatch free at the start of each wave after the first.
- After each of waves 1 to 7 the player picks 1 of 3 cards. A card can be taken up to 3 times (the pips). A run has 7 picks from 12 cards.
- The run is lost when the queen's health reaches 0. The end card shows the held cards with their levels and an Again button that starts wave 1 at once.
- Score = 100 per wave cleared + queen health + kills. Device best, win count and a daily run (seed from the date) are saved under `ant-draft:save`.

### Enemies

| Enemy | What makes it different |
| --- | --- |
| aphid | weak, many |
| beetle | tough, slow, hits the queen hard |
| wasp | fast, flies past soldiers, hunts workers |
| spider | stops 235 units from the queen and spits at her; the swarm has to go to it |
| stag beetle | wave 8 boss; soldiers only slow it |

Ground enemies stop while a soldier holds them, so meeting them early protects the queen. Enemies get 6% more health per wave.

### Cards (icon, name, at most five words; each has 3 levels)

| Card | Words on the card | Effect per level |
| --- | --- | --- |
| Split | Soldiers split on death | a dead soldier leaves 2 / 3 / 4 small ants |
| Haul | Workers carry double | a crumb counts 2 / 3 / 4 |
| Scout | Reveals and slows next wave | the draft shows the next wave's enemies, arrows mark arrivals 3 s ahead, arrivals are slowed 1.6 s per level |
| Acid | Swarm leaves acid trail | the moving swarm drips puddles: 3.2 damage a second per level |
| Guard | Queen's guard circles her | 2 / 4 / 6 strong ants circle the nest |
| Jaws | Bites hit harder | +30% damage |
| Legs | Ants run faster | +20% speed |
| Brood | More ants hatch each wave | +2 soldiers per wave |
| Shell | Ants take more hits | +35% health for ants hatched from then on |
| Jelly | Queen heals each wave | +14 health per wave |
| Fire | Dead ants explode | 6 damage per level in a small circle |
| Frenzy | Kills speed up bites | bites twice as fast for 1.5 s per level after a kill |

Cards combine without special cases: Split with Fire makes every small ant a bomb; Legs with Acid lays a longer trail; Guard with Jelly lets the swarm leave the nest.

## Decisions that shaped it

1. **The player steers a swarm, not one ant.** Ant Promotion is one ant on a stick. A draft needs many units for cards like Split and Guard to show, so the thumb moves a flag. Hint kind: `hold-and-move`.
2. **Spiders and wasps exist to make the thumb matter.** Without them, holding the flag on the queen would be the best play. The bots measure this (see `park`).
3. **The field hangs from the top of the screen.** Spare height on a tall phone is grass below the nest, where the thumb rests.
4. **Scout has a rule effect as well as the reveal**, so it is not a wasted pick for a player who ignores the preview.
5. **Draft cards ignore taps for 0.35 s** after they appear, so a finger still down from the fight does not pick one by accident.

## Checks

`fnm exec --using=26.12.0 node bots.mjs [runs] [--mutate]` (default 120 runs per bot, seeds 1000 to 1119, about 80 s). Thresholds were set before tuning. One tuning change was made after the first run: the free hatch per wave went from 2 to 3 (careful 70% to 93%, clumsy 2% to 10%).

Result of the last full run (exit 0):

```
120 runs per bot, seeds 1000..1119
  careful                    wins  93.3%  mean waves cleared 7.87  median run 196 s  timeouts 0
  clumsy                     wins  10.0%  mean waves cleared 5.48  median run 177 s  timeouts 0
  idle                       wins   0.0%  mean waves cleared 3.00  median run 160 s  timeouts 0
  park                       wins   0.0%  mean waves cleared 3.00  median run 169 s  timeouts 0
  careful, cards do nothing  wins   0.0%  mean waves cleared 4.54  median run 147 s  timeouts 0
  clumsy clear rate by wave (of runs that reached it): 100.0% 100.0% 99.2% 93.3% 81.1% 72.2% 32.3% 57.1%
  careful clear rate by wave:                          100.0% 100.0% 100.0% 100.0% 100.0% 99.2% 95.0% 99.1%
ok   careful bot wins most runs: 93.3% (need 70%)
ok   clumsy bot wins clearly fewer: 10.0% against 93.3% (need 30 points lower)
ok   clumsy bot clears wave 1: 100.0% (need 90%)
ok   difficulty rises for the clumsy bot: waves 1-3 99.7%, waves 6-8 53.9% (need 10 points lower)
ok   the thumb matters: an idle flag mostly loses: 0.0% (need 30% or less)
ok   parking on the queen is worse than steering: 0.0% against 93.3% (need 15 points lower)
ok   cards matter: 0.0% without card effects (need 30 points lower)
ok   a won run takes 3 to 5 minutes: 196 s median, with 5 s per card choice
ok   determinism: seed 4242 twice: score 1037 and 1037; seed 4243 differs: true
ok   cards have at most five words: longest 5 words over 12 cards
ok   runs differ: 120 different card sets in 120 careful runs
ok   no run timed out: 0 timeouts
all checks passed in 308.3 s (the phone check was running beside it)
```

- `careful`: every 0.2 s puts the flag on the most dangerous enemy (a spitting spider first, then whatever is nearest the queen); takes cards in a fixed order of preference.
- `clumsy`: looks every 1.6 s, picks any enemy, misses by up to 60 units, takes cards at random.
- `idle`: never moves the flag. `park`: holds the flag on the queen. Both pick cards as `careful` does, so they isolate steering.
- `careful, cards do nothing`: the same steering with card effects switched off, so it isolates the draft.
- Run time counts 5 s per card choice.

`--mutate` makes the queen take no damage (`hurtQueen` in `sim.js`). With 60 runs: clumsy wins 73.3% against careful 93.3% (fails "clearly fewer"), the clumsy late-wave clear rate is 91.2% (fails "difficulty rises"), and 20 runs hit the 2-minute wave cap (fails "no run timed out"). 3 checks fail, exit code 1.

`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules fnm exec --using=26.12.0 node check.mjs` plays on WebKit iPhone 13 and Chromium Pixel 7 with touch pointer events sent to the canvas (the method `fixit/check.mjs` uses) and real taps on buttons and cards:

- Run A (`?waves=1`): menu, the beginner hint after 3 s without a touch, the hint leaves on the first touch, the flag follows the finger, frame rate above 25 a second while fighting, the win card.
- Run B (`?waves=3&hp=8`): clear wave 1, the draft shows 3 different cards (icon first, at most five words, text 14 px or more, inside the screen), tap one, hold the finger in a corner so the weak queen falls, the loss card shows the held card with its level, Again starts wave 1 with no card between, pause and resume.
- No page errors and no console errors.

Result of the last run (exit 0): both phones passed. WebKit iPhone 13: 322 frames in 5.0 s of fighting, 3 frames over 50 ms. Chromium Pixel 7: 301 frames in 5.0 s, none over 50 ms. These are headless desktop figures, not phone figures.

Screenshots: `/private/tmp/night-ant-draft/{webkit,chromium}-{1-menu,2-hint,3-fight,4-win,5-draft,6-loss}.png`.

## Not verified, and known gaps

- Not played by a person and not run on a real phone. Sound was not heard (the check runs silent).
- Balance is measured by bots only. The careful bot reacts every 0.2 s and never mis-aims, so a person will win less than it does. Individual cards are not measured one by one; some may be much stronger than others (the careful bot prefers Brood, Jaws, Shell, Guard).
- A full 8-wave run was played only by the bots in Node, not in a browser. The browser check plays 1 and 2 waves.
- Mouse and keyboard control are written but not covered by the check.
- WebKit in Playwright lost canvases painted while the module loads (blank ground and menu art on the first page of a context). The page now repaints both on early frames until a pixel reads back solid. Cause not found; whether a real iPhone does the same is unknown.
- The hint key `ant-draft:hint` is not in the seed in `kit/check/phone.mjs`, and `lab/index.html` does not link this page (both are outside this folder).
- The daily run has a device best only, no shared board.
- No reduced-motion handling for screen shake.

## Ideas left open

- Named combinations shown on the end card ("Split + Fire: chain burst") so players learn what to hunt for.
- A fourth, rare gold card that costs queen health.
- Let the player place the guard ring with a second gesture, or keep the game to one gesture and make Guard follow the flag at level 3.
- Carry the Ant Promotion skin onto the soldiers.
