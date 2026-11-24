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

## 2026-11-24 independent review

Acceptance: retain normal bots exit 0, mutation exit nonzero, and both phone-profile checks. Exercise additional input and transition failures without setting game state. Only this folder and the four other assigned lab folders may change. No shared kit edit, commit, or deployment.

Fixed first-pointer ownership: a second finger no longer moves the flag or ends the first finger's drag. Lost capture now ends only its owning pointer. Pause, blur, draft, and restart clear held keyboard input and transient input. Restart clears old shake/flash and scheduled callbacks. Leaving during the 300 ms card-pick animation pauses the next wave. Invalid negative wave counts and infinite health from query options now fall back to 8 waves and 100 health.

`review.mjs chromium` passes both drafts: first pointer x=130, second pointer leaves x=130, first pointer can move to x=180, and lost capture leaves x=180. It also checks blur, restart, reload, and finite query options. `review.mjs chromium --mutate-input` exits 1 for both builds: restoring pointer takeover changes this build's position from (130,386) to (310,566). This independently proves the new regression rejects the old behavior.

Full normal bots: 120 seeds per policy, 600 runs, 93.3% careful wins, 10.0% clumsy, 0% idle, 0% parked, 0% with cards disabled; careful median 196 s; 120 distinct hands; zero timeouts. Wall time 695.3 s under shared-host load. No rule or balance thresholds changed.

The old browser assertion compared the rally with the next selected enemy after the original target died. It now measures the response immediately after each dispatched pointer move: error must be under 0.01 px, replacing the unrelated 30 px target comparison. The final Chromium run recorded 301 frames in 5015 ms, zero frames above 50 ms, and zero page/console errors. The test adds leaving during the card animation. Foregrounding the test page and waiting two animation frames prevents capturing an unpainted first frame; this does not bypass input or error checks.

Screenshots in `review-shots/` cover first menu, hint, fight, draft, win, loss, input, and resumed play. Rendered Chromium stages have readable text and on-screen controls without overlap. The first WebKit attempts produced black screenshots and Play stability timeouts; final verification is recorded below.

### Comparison of the two Ant Draft builds

The first build plays better in this review. Its red soldiers, visible queen, rally flag, and 85-unit combat ring make the action easier to read. A new player can identify both what to protect and where the swarm is being sent. Its spiders attack at range, while wasps hunt workers, so enemies give different reasons to move. Its light draft cards separate icon, short name, effect, and stack count clearly.

The second build has a more compact draft and a useful numeric nest-health display. Its dark soldiers merge into a single moving cluster, and the nest is a small hole on the bottom border. Its narrower 38-unit attack range makes interception more exacting. The first build's explicit queen and larger rally marker communicate that task better. Neither first screen requires a paragraph of instructions; both need the delayed finger hint. Both still depend on short card text to explain upgrades.

This is a judgment from emulated play and inspected screenshots, not a human play verdict. The bots differ between builds; 93.3% versus 99% careful wins and 10% versus 45% clumsy wins are not a controlled comparison of difficulty. No balance or artwork was changed to impose this preference.

A full unaccelerated Chromium run now also passes (`full-run.mjs chromium`): seed 11, all 8 waves, 7 drafts, 137 kills, queen health 100, score 1037, simulation time 161.733333 s, zero page/console errors. Inspected all full-run captures in `full-run-shots/contact.png`; the final five distinct cards with seven total picks fit with Retry/Menu. The earlier full-browser-run gap is closed for Chromium only.

The default 120-seed bot mutation exits 1 with 3 failed checks: clumsy wins 73.3% versus careful 93.3%, late clumsy clear rate 91.8%, and 40 timeouts across careful/clumsy runs. Wall time 1026.3 s.

Final WebKit iPhone 13 check exits 0: 360 frames in 5007 ms, zero frames above 50 ms, zero page/console errors. Menu, hint, win, draft, loss with its held card, retry, pause/resume, and leaving during the pick animation pass. Inspected all six WebKit stage screenshots: the menu art and field render, text is readable, and cards/buttons stay inside the viewport without overlap. Physical notch insets remain unverified by device emulation.

The independent WebKit input/reload review also exits 0 for both drafts. This build retains first-pointer x=130 through the second touch, moves to x=180 with the owner, and remains x=180 after capture loss. Blur clears keyboard movement; menu/restart/reload and invalid query options pass.

Shared-kit validation: the full before-run had seven failures in unrelated Lantern/Ant Promotion/lab-down cases (`kit-before.log`), including navigation timeouts and unavailable WebGL2. The after-run of the kit smoke case passes on both phone profiles (`kit-after-chromium.log`, `kit-after-webkit.log`). The full shared suite is not claimed green. No shared files changed. Local browser servers stub the hosted notes button; its live service, physical-phone sound/haptics/performance, and human play acceptance remain unverified.

## 2026-11-24: levels, tutorial, numbers and explosions (tester t1, note #207, answering #175)

The note, in short: Ant Draft A is liked; it needs a tutorial level, at least 50 more levels, a visible explosion for the explosion card, damage numbers and health by each enemy's name, and one health bar for all the ants.

- **Fifty levels** (`levels.js`): ten chapters of five, 3 to 6 waves each, stars by the queen's health (80 and 40). The old 8-wave run is kept as "Long run", with its best, wins and daily; the existing key is unchanged. New keys: `ant-draft:levels` ({ open, stars }) and `ant-draft:tutorial` ('1').
- **Tutorial:** offered on the first Play of a new player, and always under "How to play". Three short waves, a line of words for what is on the field, and the queen cannot be hurt.
- **Numbers:** each enemy shows its name and health; damage adds up for a third of a second and rises as one yellow number; bites on ants rise in pink. In a crowd, hidden labels show the health only or nothing.
- **Explosion:** the Fire card draws a fireball with the damage it did in orange. Every ant death shows a red ring.
- **Ants bar:** the health of all fighting ants. Full is the most they had this wave, so a dead ant lowers it.
- Own additions: stars, the chapter themes, and `?give=fire,split` to look at a card (opens no levels).

Checks: `bots-levels.mjs 8`: all 50 levels won by a careful bot in at least half of 8 runs (the lowest are 63%), clumsy win rate falls from 0.94 (levels 1 to 10) to 0.46 (41 to 50), idle flag wins 4% of levels 26 to 50. The thresholds were set before tuning. Levels that aim at being too hard can still appear: 8 runs per level is a small sample. `bots.mjs 40` (the long run) passes, and the 8-wave run uses the same rules. `check.mjs` run C covers the first-time question, the tutorial to its end, level 1, the level list and a reload; it passed on Chromium with the frame-rate line lowered by `MIN_FPS=1`. On this machine that line failed before any change too (45 and 17 frames in about 5 s on Chromium and WebKit, against 45 or 33 and 16 after), so **frame rate was not judged**, and WebKit did not finish run B. CI runs the shared phone check, not this one.

Not verified: a person, a real phone, frame rate on a phone, levels 1 to 50 in a browser (bots only).

### Left as a proposal (2026-11-24)
- The tester's answer also says The Swarm, Living Animals and Ant Draft B could be dropped. Recorded only; dropping is the owner's decision.
