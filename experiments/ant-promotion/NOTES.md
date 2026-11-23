# Ant Promotion notes

## 2026-11-22: first playable version

The owner passed on a spoken design for a new game. This is the first build of it: one static page, no server, no paid assets. All art is drawn in code (`art.js`).

You start as an ant in a walled meadow, eat weaker animals to fill a bar, and pick one of three new animals each time the bar fills. There are 18 levels and 55 animals (3 food bugs, the ant, and 3 choices at each of 17 promotions).

### Rules taken as written

| The animal is | It has noticed you | Its speed against yours | What happens |
| --- | --- | --- | --- |
| weaker | no | any | you eat it on touch (the sneak-up) |
| weaker | yes | slower | you eat it on touch |
| weaker | yes | faster | you cannot eat it; it runs and a touch does nothing |
| stronger | yes | faster | it chases you and catches you |
| stronger | yes | slower | it chases you; you can outrun it |

- A power number sits over every animal and over the player.
- Death shows "Died to a X as a Y", takes one level, and returns you to the animal you were before. You may start again as an ant instead.
- Every promotion offers 3 animals. No animal appears twice in the tree. Fire Ant is one of the ant's three choices. Level 17 has no dragon.
- The menu has ant skins: 9 colours and 4 patterns.

### Choices made where the design was open

1. **A weaker animal that is faster and has noticed you does not kill you.** The sentence "notices you and is faster, it eats you" is read as being about stronger animals.
2. **Touching a stronger animal kills you even if it has not noticed you.**
3. **Same speed counts as "not faster".** You can eat a weaker animal of your own speed, and a stronger one of your own speed never closes the gap.
4. **Same power: nothing happens.** The two bump.
5. **Noticing is sight.** Each animal sees a wedge in front of it (about 65 degrees each side). Behind it you are unseen, which is the sneak-up. It stays alert until you are well out of range for 1.5 s.
6. **The three choices at each level are fixed, one of each kind:** strong and slow, fast and weaker, or medium and hard to notice (animals see it from 60% of the distance). The path you took does not change later choices.
7. **Three speeds only** (slow, medium, fast), so "faster than you" is a clear mark (`»`) and not a hidden number.
8. **Level 18 is the top.** Filling the bar there shows a win card; you can keep roaming or start again.
9. **Dying as an ant** keeps you an ant and empties the bar.
10. **Animals do not eat each other.** Only the player eats and is eaten.
11. **Skins colour the ant only.** Later animals keep their own colours and wear a ring in the skin colour.
12. **Progress is saved on the device** (animal path, bar, skin, sound).
13. Quality of life added: pause (button, P, Escape, or leaving the page), 2.5 s of safety after a death, red arrows at the screen edge for hunters you cannot see, a how-to-play page, sound on/off.

### Checks

`node bots.mjs [seeds] [minutes]` runs:

- the contact rule, 9 cells, including the known cases above;
- the tree (3 choices per level, unique names, Fire Ant offered, no dragon at 17);
- food: every playable animal starts in a world with prey it can catch (fewest seen: 31 of 64 animals); a world seeded with only stronger animals must report 0;
- two bots for 12 simulated minutes over 10 seeds. The careful bot reaches a median level of 14 to 18 with 0 deaths; the reckless bot reaches 6 to 9 with 30 to 45 deaths.

A WebKit run at phone size (390 by 844, touch) loaded the page, changed the skin, steered by drag, took a promotion, died, and went back one level with no script errors.

### Not verified

- Feel, speed and sound on a real phone. Nobody has played it by hand.
- Whether it is fun, or the right difficulty for a person. Bots only show that careful play is rewarded.
- The 55 drawings were checked on one contact sheet at one size. Some are plain (Dog, Lynx, Bear) and all are placeholders for the owner's taste.

## 2026-11-22: tester t1's answers and requests (notes #30, #33, #34)

- First impression: "not bad" (#30).
- Tester t1 named Ant Promotion one of the two best games, with Lantern (#33). See `experiments/NOTES.md`.

### Left as a proposal (2026-11-22, note #34)

- More detailed animal drawings: "too plain for modern games". The look is a taste decision, so it goes through look variants first. Three looks are now built; see "look variants" below.
- Sound effects and eat and death effects: built, see the next entry.

## 2026-11-22: eat and death effects (tester t1, note #34)

Tester t1 asked for sound effects, an effect when you eat an animal and an effect when you die.

| Note | What changed |
| --- | --- |
| Eat effect | Pieces in the eaten animal's colours burst out, with a yellow ring and a crunch sound under the old blip |
| Death effect | Red and body-coloured pieces burst from the player, a red ring, a red screen flash, a heavier crunch and the old falling tone; the player disappears. The death card follows 0.9 s later (real time). The lost level is saved at the moment of death, as before |
| Sound effects | The game already had sound. Phones keep audio off until it starts inside a tap, and the game used to start it in the animation loop, so a phone may never have played any. Play and Continue now start the audio |

All of it is in `index.html`; `sim.js` is unchanged, so `bots.mjs` results are unchanged (checked).

Checked in WebKit with an iPhone 13 profile: an eat and a death forced through `window.__ant`, the death burst on screen, the death card after the delay, "Keep going" back to play, the saved level, no script errors (the notes button script is a 404 on a local server only). Not verified: sound on a real phone, the effects at full frame rate (headless WebKit drew 7 to 8 frames a second), and whether the effects feel good.

## 2026-11-23: look variants for the animal drawings (tester t1, note #34)

Tester t1 found the animals too plain. The look is a taste decision, so this change adds three looks to choose from and does not settle it.

| Look | What it is |
| --- | --- |
| Flat | The first drawings, unchanged |
| Cartoon (now the default) | Dark outline, shaded bodies, bigger eyes with whites, toes, noses, inner ears, whiskers, fur ticks, a back stripe, feather and scale marks, segment lines and leg joints on insects |
| Soft | The same extra detail with a thin outline in the animal's own dark colour and a stronger gloss |

The menu has a Look button that cycles the three and saves the choice. `?look=0`, `?look=1` or `?look=2` in the address also sets it. Shading is lit from the top left whatever way the animal faces. All of it is in `art.js`; `sim.js` is unchanged, so `bots.mjs` results are unchanged.

Checked in WebKit with an iPhone 13 profile: each look loads and plays with no script errors, and a frame took the same time in all three (about 14 ms headless). A side-by-side sheet of 14 animals in each look was checked by eye.

Not verified: frame rate on a real phone, where the two detailed looks draw about four times as many shapes. Which look is right is the tester's and the owner's call; the question was sent to tester t1.

## 2026-11-23: a 3D look, the animal book, eat streaks (own ideas, the owner's standing instruction)

The owner asked the lab to go past the literal asks: try 3D for the "more detailed animals" request, hunt bugs unasked, add own ideas.

### 3D look (Look button, fourth option; `?look=3`)
- `look3d.js` is a small WebGL2 renderer with no dependencies. It does not hold a second set of models. A recorder object stands in for the 2D canvas context, takes the same `drawForm` calls from `art.js`, and turns filled ellipses into lit ellipsoids, stroked lines into capsules (legs, tails, feelers) and polygons into plates (wings, fins).
- Tilted camera, one sun, shadows projected on the ground, grass that sways, eat and death pieces that bounce. Numbers, "!" marks and edge arrows stay on the 2D canvas, placed with `project()`.
- The sim is untouched, so the rules and the bots are the same in every look.
- If WebGL2 is missing, a shader fails or the phone drops the WebGL context, the game says so, switches to Cartoon and saves that. Checked with a real shader failure during the build and with WebGL2 stubbed out.
- Promotion cards, the menu and the book stay 2D.
- Why not three.js: nothing else in the lab ships a dependency, and 55 animals as hand-made models was not a one-session job. The recorder gives every animal a solid for free. The cost: shapes are only as good as the stacking guess (a small ellipse drawn on a big one sits on top of it).

### Animal book
- Menu button "Animal book n/52". Shows every animal the player has been; the rest are dark outlines with their level. It gives a reason to pick a different animal at each promotion, which the design asks for ("every single time, it has to be unique").
- Saved as `seen` in the same save. Old saves start with the animals in their current path.

### Eat streak and buzz
- Eating again within 4 seconds raises the eat sound by a semitone per step and shows "3 in a row" on the float. It changes no rule and gives no XP.
- Phones that support it vibrate on eat and death (off with sound off). iPhones do not support web vibration.

### Checks
- WebKit with the iPhone 13 profile and Chromium: 3D loads, no page errors, the frame loop holds the headless frame cap (13.8 ms) at levels 6, 12 and 18. That shows no stall; it does not measure render cost.
- Phone flow test passes in Cartoon and 3D. Death in 3D, drop a level, switch look in the menu and back: no errors.
- `node bots.mjs 10 12` and `npm run check:lane` pass.

### Found while testing, answered with a rules variant (see "Wild rules" below)
- The careful bot reaches a median top level of 18 picking sneaky, 15 picking fast and 14 picking strong, with 0 deaths in 12 minutes. A bot that always picks sneaky climbs highest, and a careful bot is never in danger. The tester called the game "not bad", not "fun" (note #30). Proposal for the owner: give strong animals something of their own, and add pressure for careful players. Both change rules he wrote, so they wait for the owner.

### Not verified
- 3D on a real phone: frame rate, battery, how it reads on a small screen. Headless numbers come from a desktop GPU.
- Whether 3D is liked more than the 2D looks. That is the tester's and the owner's call.

## 2026-11-23: Wild rules, a variant beside Classic

Classic is the default and plays exactly as before (the classic bot numbers did not move). The menu has "Rules: Classic / Wild"; `?wild=1` forces it.

Wild adds two things, both in `sim.js` behind `s.wild`:
- **Thick hide.** A strong (brute) animal lives through one bite and is thrown clear. The hide grows back in 25 seconds. The HUD shows "hide ready" or "hide growing".
- **The hunt.** Every 45 seconds the nearest stronger animal within 700 units that has not noticed you tracks you for 5 seconds, wherever it is looking. The game says which animal is hunting.

Why: under Classic a bot that always picks sneaky reaches level 18 and a careful bot never dies. Bots, 10 seeds, 12 minutes, careful play, median top level and deaths:

| pick | Classic | Wild |
|---|---|---|
| strong | 14, 0 deaths | 11, 2 deaths |
| fast | 15, 0 deaths | 10, 6 deaths |
| sneaky | 18, 0 deaths | 12, 7 deaths |

Wild brings the three picks within two levels of each other and puts careful players in danger. It may be too hard; nobody has played it by hand.

Checks: `bots.mjs` asserts classic has no hide and no hunt, the first bite on a hide does not kill and the second does, only strong picks use the hide, hunts happen, and care still pays under Wild. In WebKit with the iPhone 13 profile: switch to Wild, hide takes a bite, second bite kills, no page errors.

Not verified: whether Wild is more fun. That is the tester's call; a one-tap question asks which they prefer, and the winner becomes the default.

## 2026-11-23: tester t1's round 3 (notes #45, #46)

Asked for: animals hostile to each other, a percentage beside the progress bar, faster each time you pick fast again (and the same idea for the last option), more quality of life, and our own ideas.

### Done
- **Animals hunt each other** (both rule sets). A stronger animal that sees a weaker one, at most 2 levels below it, chases it at 80% speed and eats it on contact. The hunted animal runs. A hunter gives up after 6 seconds and rests 15 seconds after a meal. The little food bugs are never hunted, so an ant always has food. A red dashed line shows who is chasing whom; an eat in view shows "Wolf ate a Deer".
- **Percentage** beside the progress bar.
- **Same kind again builds on it.** Each earlier fast pick makes a fast animal 5% faster (16 fast picks: about 2.1 times). Each earlier sneaky pick shrinks the distance a sneaky animal is seen from by 5%. The promotion card shows the bonus before the pick and the HUD shows it after.
  - Reading taken: "the middle one" is the fast option and "the last one" is the sneaky option. Strong is not changed here, because power is the level number other animals are compared with. Under Wild rules strong has the thick hide.
  - 5% per pick, compounding, is the lab's number. The tester said "exponentially"; a bigger base made a level-18 runner faster than the screen can follow.

### Bots after this round (6 seeds, 12 minutes, careful play, median top level)
| pick | Classic | Wild |
|---|---|---|
| strong | 12, 2 deaths | 8, 3 deaths |
| fast | 14, 3 deaths | 11, 8 deaths |
| sneaky | 18, 0 deaths | 10, 9 deaths |

Animals hunting each other makes the meadow less predictable: fleeing animals run into the player. Wild on top of that is hard for the bots.

### Checks
- `bots.mjs`: a second fast pick is 5% faster, a second sneaky pick is seen from 5% less far, animals eat each other, food bugs are never hunted, plus all earlier asserts.
- WebKit, iPhone 13 profile: flow test in Cartoon and 3D, Wild rules test, a chase with its line on screen, promotion cards showing "Fast again: +22% speed". No page errors.
- Local testing must serve `experiments/` (not this folder), because the page imports `../kit/`. Served from this folder the module fails without a page error and tests that only click can pass falsely.

### From the wildcard lab, next
- The named rival (lab `ant-nemesis`) is picked to graduate into this game. The lab's animals-chase-each-other test (`ant-wilds`) overlaps with this round; its dashed red line is used here.

## 2026-11-23: fast again, a bigger step (tester t1, note #46)

Note #46 asked that each fast pick be "exponentially faster than the one before … not just the same speed". Round 3 gave 5% a pick. On screen that is about 2% a pick, because the view zooms out about 2.5% each level (`480 + 14 × level`). Over five fast picks the on-screen speed rose about 10%, which reads as the same speed.

This revises the round-3 number:

- Each fast pick is now 12% faster than your previous fast pick (`SAME_FAST = 1.12`). That shows as about 9% a pick on screen.
- Capped at 2.5 times the plain fast speed (`FAST_CAP`). The cap is reached at the ninth fast pick. Round 3 kept 5% because a bigger base made a level-18 runner too fast to follow. With the cap, the top speed is 375, against 327 under round 3.
- `fastBoost(k)` in `sim.js` is now the only place that computes the gain. The promotion card uses it, so the card cannot promise more than the cap. `bots.mjs` checks that every fast pick is faster or capped, and that the step is at least 10%.

Bots, 6 seeds, 12 minutes, Classic, always picking fast:

| | 5% (round 3) | 12% with cap (now) |
|---|---|---|
| careful | median top level 14, 3 deaths | 16, 3 deaths |
| reckless | 15, 55 deaths | 17, 68 deaths |

Careful play that always picks sneaky still reaches 18, so fast does not take over.

Checked: `bots.mjs` passes, and `kit/check/phone.mjs ant-promotion` passes on WebKit and Chromium. A WebKit iPhone 13 run started from a save with Fire Ant, Wasp and Mouse. The HUD read "speed +25%", the fast card read "Fast again: +40% speed", and after the pick the HUD read "+40%" at speed 210.7. No page errors.

Not verified: how 12% a pick feels on a real phone, and whether a speed near the cap stays steerable.

### Left as a proposal (2026-11-23)
These ideas come from a parallel build of #45 and #46 that was not merged, because round 3 shipped first:
- **A green arrow at the screen edge.** It would point to the nearest food you can catch when none is on screen.
- **Leftovers.** A kill between animals would leave a scrap worth 1 point for 12 seconds where the hunter ate. That pulls the player toward danger. In bot runs it changed the top level by at most one.
- **Hunger.** That build made animals stay full for 60 seconds after a meal. It kept kills to about 20 to 26 a minute across the whole meadow. The first try, without hunger, gave over 100 a minute and cut careful bots from level 14–18 to 4–9. If the meadow feels too bloody, this is the setting to change.

## 2026-11-23: the named rival, from the wildcard lab

Ported from the lab variant `prototypes/lab/ant-nemesis` (lab log: `prototypes/lab/NOTES.md`). In the code it keeps the lab's word, `nemesis`; the player sees "rival".

### What it does
- The animal that kills you becomes your rival, if you have none. It gets a name ("Snaggle the Wasp"), a title, a colour, a crown over its number and a coloured ring on the ground.
- It has one of four temperaments, picked at random when it rises, and two settings from 1 to 3 (persistence: how long it chases and how often it comes looking; territory: how far it wanders from home).
- It talks in speech bubbles: when it rises, notices you, loses you, kills you again, when you eat one of its kind, and when you eat it.
- On screen it has a name tag. Off screen it has an arrow in its colour at the edge, bigger than the red hunter arrows, with its name. The HUD has a line with its name and power.
- It is saved with the game (`save.nem` in `ant-promotion:v1`) and comes back on the next visit, far from you. It stays through deaths, promotions and "New game as an Ant".
- You eat it like any other animal once your number is bigger. That pays a prize, lists it under "Rivals beaten" on the menu, and frees the place: the next animal that kills you becomes the new rival.
- Names, titles and lines come from tables in `index.html`. The lab's language-model endpoint is not ported. The game makes no network call for the rival, and its events are not sent to the lab recording.

### Numbers
| | |
|---|---|
| Power per repeat kill | +10 (`NEM_STEP`), shown in its number and counted in every comparison |
| Most it can gain | +30 (`NEM_MAX_BONUS`) |
| Prize for eating it | +6 on the bar (`NEM_PRIZE`), on top of the normal 1 to 3 |
| Rest after a kill | 25 s before it comes looking again; 20 s after it first rises |
| Scars | one for each repeat kill, at most 4 (flat looks only) |

| Temperament | Sees | Waits still | Chase | Keeps a lost chase (persistence 2) | Other |
|---|---|---|---|---|---|
| ambusher | 35% farther, wedge 30% wider | yes | plain speed | 2.0 s | comes looking less often |
| stalker | 15% farther | no | 8% faster | 3.5 s | follows at the edge of sight; strikes when you eat, come close, or after 7 s |
| brute | plain | no | 10% faster, turns slowly | 5.0 s | follows farthest |
| coward | 10% farther | no | plain speed | 1.25 s | runs once you are within 12 of its power (at most a quarter of its power) |

### How it fits the rest of the rules
- `create(seed, stack, xp, weights, wild, nemesis)`: the rival is the 6th parameter. `powerOf(m)` gives a mob's power with the rival's gains; the sim, the page and the bots use it wherever a mob is compared with the player.
- The rival draws its random numbers from its own stream (`nrand`). A world with no rival is the same, tick for tick, as before this change.
- Animals hunting each other: the rival takes no part. No animal picks it as prey or runs from it, it hunts only the player, and `crown()` makes any animal that was chasing it let go. `upkeep` never clears it away.
- Wild rules: the thick hide takes the rival's bite like any other (no kill, no power gain). The hunt can pick the rival; the message then uses its name.
- When eating the rival fills the bar, the promotion card waits 1.8 s so the last words and the burst are seen.

### Decisions taken here (not in the lab)
- The menu shows the rival line and "Rivals beaten" only when there is something to show. A new player sees the same menu as before.
- Beside a sideways edge arrow the name sits above the arrow; in the lab it covered the arrow.
- The 3D look draws the ring, crown, tag, arrow and bubble. It does not draw scars.

### Checked
- No-rival world unchanged: `node bots.mjs 4 8` printed the same 12 classic and WILD lines before and after the sim change. A scratch script also compared the new `sim.js` with the one on main, every tick and every event: 864,000 ticks, classic and wild, 2 input policies, 5 seeds, 3 picks, 4 minutes each. Identical.
- `node bots.mjs 6 12` passes (about 3 to 4 minutes now; it was about 1). New asserts: the numbers above; a death makes a rival; a repeat kill adds 10 and the gain stops at 30; it stays through deaths and promotions; it reloads from a save under both rule sets; eating it pays 1 + 6 and clears it; the next death makes a new one; no animal chases or eats it over 4 minutes among much stronger animals (classic and wild, 3 seeds); an animal crowned while another chases it is not eaten; a power 20 coward chases a power 10 Ant; each temperament rule in a world with only the rival (who sees past plain range, who has the wider wedge, how long each keeps a lost chase, the ambusher stands still); the gained power decides the outcome (a Spider of 20 with +30 against a level 4 player of 44: its touch kills, it is not counted as food, it notices as a stronger animal, the Wild hunt picks it, the Wild hide takes its first bite without a kill or a gain and the second bite kills; with the gain removed the same touch is a meal); the careful bot still reaches level 6 with each temperament; the rival is eaten in play.
- Careful bot, 6 seeds, 12 minutes, classic, a level 3 rival from the start (median top level / median deaths):

| pick | no rival | ambusher | stalker | brute | coward |
|---|---|---|---|---|---|
| strong | 12 / 2 | 12 / 3 | 9 / 4 | 11 / 2 | 11 / 1 |
| fast | 14 / 3 | 13 / 4 | 14 / 4 | 14 / 5 | 12 / 5 |
| sneaky | 18 / 0 | 18 / 0 | 18 / 0 | 18 / 1 | 18 / 0 |

- A bot that is reckless until its first death and careful after ate its rival in 6 of 6 runs (classic, median 3.1 minutes) and 6 of 6 (Wild, median 4.6 minutes).
- Eight one-line faults were put into a copy of `sim.js` and the short rival checks run against each. All eight failed, as they should: plain power instead of `powerOf` in the touch, in the notice, in `catchable` and in the Wild hunt picker; the rival not skipped in `upkeep`; the rival allowed as another animal's prey; the +30 cap removed; `crown` not clearing chasers.
- The printed lost-chase time for the coward (0.78 s) is shorter than its rule (1.25 s) because in that check it had already lost sight of the player during the 2-second run before the player was moved away. The assert is on the order of the four, which holds.
- `npm run check:lane` passes (55 tests).
- WebKit, iPhone 13 profile, `prototypes/` served locally, `?seed=7`. The test moves animals and sets the player's form through `window.__ant`; the page's own loop does the rest. Passed: an old save without rival fields loads; die to an animal and it becomes the rival with a name; the death card shows it; after reviving it speaks, the HUD line shows, the edge arrow and the name tag draw in its colour; die to it again and its power goes from 27 to 37; reload and it is back with the same name, power and kills; eat it as a level 8 Cat and the bar gains 7, it is gone, and it is listed under "Rivals beaten"; reload and it does not come back; the next death makes a new rival; with `&look=3` the 3D look is on (checked, not the Cartoon fallback) and the arrow, tag, crown, ring and bubble draw; a broken rival in the save is dropped. Every request went to the local server, none was a POST, and there were no page or console errors other than the expected 404 for `/notes/button.js`.

### Two lab checks that did not carry over as written
The lab asserted two things from its temperament table: a brute's mean chase is longer than a coward's, and an ambusher notices the player more often than a brute. On this sim, with animals hunting each other, both fail at 6 seeds (mean chase 6.87 s against 7.38 s; notices per minute 0.29 against 0.46). The first holds at 10 and 20 seeds, the second at 20 only. Each rests on about 0.3 meetings per minute, so a run has a handful of samples. The same table on the lab's own sim gives 0.5 to 0.6 against 0.2 to 0.3 for notices. The rival code is not the cause. A scratch script ran the new `sim.js` with the animal-hunt picker switched off against the lab's `sim.js`: identical on every tick, every event and the whole rival state over 1,382,400 ticks (2 input policies, 4 temperaments, 4 seeds, rival from the start and rival made by a death, classic, 6 minutes), with 53 rises, 78 repeat kills, 20 escapes and 22 rivals eaten along the way. So the difference comes from animals hunting each other, which changes where animals and the bot are. Which part of that moves the two numbers is not known. `bots.mjs` now prints the table and asserts the two rules directly instead (sight and wedge by placing the player; lost-chase time by moving the player out of sight). The other two table asserts (ambusher stands still, coward does not close in) are kept and pass.

Two lab fixtures were changed for the same kind of reason: the "other knobs give another world" check now starts with a rival present (on this sim seed 7's first death comes at 170 s and the two rivals never met the bot in the 4-minute run), and the repeat-kill check follows each rival until one wins twice (the bot ate its first rival before it won again).

### Not verified
- A person playing it. Whether the rival is fun, fair or too talkative is the tester's call.
- A real phone. The browser test is WebKit on a desktop with the iPhone 13 profile.
- Long sessions, and the rival at high levels with the full +30.
- Whether the temperaments feel different to a player. The bots show the rules differ.
- The speech bubble's tail can cross the message line near the top of the screen (seen in a screenshot). The bubble's box keeps clear of it. When the bubble moves below the message line it can cover the rival's crown and the top of its number for the few seconds both show (seen in a screenshot).
- The lab's own `prototypes/lab/ant-nemesis/bots.mjs` fails on main at its "matches the main game" check, before and after this change: it compares the lab copy with this folder's `sim.js`, which gained animal hunts after the lab copy was made. Not touched here.

## 2026-11-23: numbers and the HUD, bubble tails

- A number over an animal is not drawn while it is under the HUD. Before, in both looks, it sat on the bar and the percentage and neither could be read.
- A speech bubble has no tail when the tail would end on the message line or on a name. The bubble still sits beside the speaker.
- Checked in a WebKit phone profile, flat and 3D, with animals placed under the HUD. Not checked on a real phone.
