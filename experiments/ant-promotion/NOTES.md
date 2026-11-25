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

## 2026-11-23: tester t1's answers (notes #80, #84 to #89)

| Note | Question | Answer | What happened |
|---|---|---|---|
| #80 | #39: do you hear a sound when you eat or die? | "No, there is no sound." | Fixed in the kit, see below |
| #84 | #48: should the real game have a rival? | Yes | Already done: the rival was ported from `lab/ant-nemesis` into this game earlier today |
| #85 | #49: is the meadow more fun when animals hunt each other? | "Function not working properly" | Unclear which part. A one-tap question asks what went wrong |
| #86 | #50 (`lab/ant-nest`): did an ant that did not dig feel like its choice or a bug? | "I did not notice" | Recorded. No change |
| #87 | #53: which look? | Cartoon | Cartoon is already the default look (`look: 1`). No change |
| #88 | #54: Classic or Wild as the normal game? | Wild | Wild is now the default |
| #89 | #56: leftovers or a green arrow to food? | The green arrow | Built |

### Done
- **Sound (#80).** The page made its sound correctly in the browsers we test: one audio context on the first Play tap, notes on every bite. The most likely cause is the iPhone silent switch. Safari mutes Web Audio while the switch is on, and a game has no other sound path. The kit (`kit/audio.js`) now sets `navigator.audioSession.type = 'playback'` when the game's sound is on and the first tap starts audio (Safari 16.4 and later). Sound then plays through the silent switch, as a video does. The cost: it pauses music from another app. The Sound button in the menu still mutes. This also applies to Lantern.
- **Wild is the default (#88).** A new save starts with Wild rules, and so does a save from before Wild existed. A save that already holds `wild: false` keeps Classic. The save format does not change, so the tester's own save probably still says Classic: one tap on the Rules button switches it. The help text now says Wild is the normal game.
- **Green arrow (#89).** When no animal you can eat is on the screen, a green arrow at the screen edge points to the nearest one. It goes away as soon as food is in view. It is drawn in the overlay that the flat, cartoon, soft and 3D looks share. The help list explains it next to the red hunter arrows.

### Checks
- `kit/check/phone.mjs` on WebKit and Chromium:
  - The audio session is not asked for before the first tap, and is 'playback' after Play.
  - An old save without the field shows "Rules: Wild".
  - With all food moved off the screen, the arrow points to food; with food beside the player, no arrow.
- Mutation tests: with the arrow disabled the check times out on "green food arrow". Without the audio session line it fails on "sound plays through the iPhone silent switch".
- WebKit iPhone 13 screenshot: the arrow sits at the right edge, pointing up and right at the moved food.

### Not verified
- That the silent switch was the cause, and that sound now plays on the tester's phone. No real iPhone was used. If the phone runs iOS older than 16.4, this change does nothing there.
- How the arrow feels in play: it may show often at high levels, where food is sparse.

## 2026-11-23: tester t1's notes #101, #105 and #106

| Note | In short | What happened |
|---|---|---|
| #101 | Send a beam of light up into the sky at every promotion. Since the fast picks got faster, the game is too easy: no animal is faster than you any more. Make the animals as fast or faster, or make the player slower; the tester recommends faster animals | Built: the beam, and stronger animals keep up with a fast-boosted player (below). The player was not made slower |
| #105 | Answer to #102 ("what went wrong with animals hunting each other?"): "Animals kill me too often" | Withdrawn by #106 as a mis-tap. Nothing done for it |
| #106 | "The last text was a misclick; the animals don't strive and try enough to kill each other." Sent from the Lantern page, but it is about this game | Built: animals hunt each other harder (below) |

### Done
- **A beam of light at each promotion (#101).** When you pick your new animal, a column of light in the new animal's colour shoots from it up through the top of the screen. Sparks climb it, it glows on the ground, and it fades over 1.8 seconds, with a rising tone and a short buzz. It is drawn in the overlay that all four looks share (`lightBeam` in `index.html`). A dark animal colour falls back to its main colour, then to gold, because dark colours vanish when added as light.
- **Stronger animals keep up (#101).** Picking fast again makes you up to 2.5 times the plain fast speed, and every animal was at most plain fast, so nothing could catch a boosted runner. Now a stronger animal that chases you runs with your fast boost, and a fast one runs 6% faster than that (`chasePace` and `PACE_UP` in `sim.js`). Medium and slow stronger animals still fall behind you, so the speed table's rule holds: you can outrun what is marked slower, and the » mark is shown on what is faster than you. The rival and the Wild hunt follow the same rule.
  - Only a player with a fast boost is affected: every strong or sneaky animal, and a first fast pick, meets exactly the speeds it met before. Weaker animals are unchanged, so what you can eat and the green food arrow are unchanged.
  - The » mark over an animal now uses the same function (`paceAgainst`), so it shows on stronger fast animals when you are boosted.
- **Animals hunt each other harder (#106).** Before, a hunter chased at 0.8 of its speed while its prey fled at full speed, so only a faster hunter ever caught anything. Most chases trailed off: in bot runs a chase was on screen half the time, and about 4 kills a minute happened near the player. Now a hunter runs at full speed, lunges at 1.3 times its speed when close, keeps after prey that has slipped out of its view wedge, and gives up after 8 seconds instead of 6. After a kill it stays full for 70 seconds instead of 15 (`PREY` in `sim.js`), because shorter rests emptied the meadow of the player's food.

### Numbers
Wild rules, careful bot, 6 seeds × 12 minutes. Medians; kills are animal on animal, "near you" means inside about one screen.

| Build | Pick | Top level | Deaths | Kills/min | Kills near you/min | A chase on screen |
|---|---|---|---|---|---|---|
| main | strong | 8 | 3 | 29 | 4.1 | 50% |
| main | fast | 10 | 9 | 33 | 4.6 | 52% |
| main | sneaky | 10 | 9 | 30 | 4.2 | 54% |
| this change | strong | 7 | 4 | 39 | 4.2 | 25% |
| this change | fast | 11 | 11 | 48 | 6.3 | 33% |
| this change | sneaky | 9 | 9 | 45 | 5.7 | 32% |

Chases are on screen less of the time because they now end in a kill instead of going on. The keep-up rule alone (with the old hunting) left strong and sneaky identical to main, and took the fast pick's deaths from 9 to 13.

Other settings tried, same bot (top level for strong / fast / sneaky; kills near you a minute):

| Hunter speed, lunge, rest after a kill | Top level | Kills near you/min |
|---|---|---|
| 1.0, 1.35, 10 s, with wider sight | 7 / 6 / 7 | 10.6 to 11.8 |
| 0.9, 1.3, 15 s | 6 / 9 / 7 | 7.3 to 8.8 |
| 1.0, 1.3, 25 s | 7 / 8 / 8 | 6.9 to 8.3 |
| 1.0, 1.3, 40 s | 6 / 8 / 8 | 6.3 to 7.3 |
| **1.0, 1.3, 70 s (built)** | 7 / 11 / 9 | 4.2 to 6.3 |

### Checks
- `bots.mjs`: new asserts that a boosted runner at every level below the top meets stronger animals faster than itself, that only fast animals outrun it, that a player with no boost meets plain speeds, and that a hunter runs at its full speed before it lunges. With the hunter at 0.8 speed the last assert fails (tried); against main's speeds the first one fails (tried).
- One older `bots.mjs` assert, read from the rival temperament table, failed after the hunting change: "closing in" went from 100% to 0% for the brute and from 0% to 71% for the ambusher, on a few alert ticks each. The player in that column is a level 4 Crab with no fast boost, so the keep-up rule does not touch it; the hunting change moves animals and the bot. Like the two lab asserts above, it is now checked directly: a Crab of power 44 stands still before a Mole rival of power 54, a brute closes 50 in half a second and a coward backs away. With the coward's flee turned off, that check fails (tried). The table is still printed.
- `kit/check/phone.mjs`: a promotion starts the beam and it fades, on WebKit iPhone 13 and Chromium Pixel 7.
- Phone-sized Chromium screenshots of the beam in the Cartoon and 3D looks; no page errors.

### Not verified
- How the faster hunters feel to a person, and whether the meadow now looks like animals fighting. Bot numbers show kills, not drama.
- The beam on a real phone.

### Left as a proposal (2026-11-23)
- If the meadow should be bloodier still: a 25 to 40 second rest after a kill roughly doubles the kills near you (table above) and costs the careful bot one or two levels. The tester also says the game is too easy, so that cost may be welcome. One number to change: `PREY.fed`.
- A chase is shown by a line from hunter to prey in every look, and a kill near you by a burst, a crunch and "X ate a Y". A louder sign of a chase starting (a growl, the hunter's number turning red) would make the striving easier to see.

## 2026-11-23: hunters tire (owner)

The owner: Wild "adds a good difficulty, but makes things impossible", and asked that a hunter slow down with time or stop after the player has run a while.

- `TIRE = { fresh: 4, spent: 10, slow: 0.55, rest: 7 }`. A stronger animal chasing the player runs at full pace for 4 seconds, slows evenly to 55% of its pace by 10 seconds, then gives up. For the next 7 seconds it cannot notice the player. Touching it still gets the player eaten. Breath comes back at 1.5 seconds for each second not chasing.
- It applies in Classic and Wild, and to the Wild hunt. The rival does not tire; its temperament already sets how long it chases.
- The page says "A Wasp got tired and gave up", shows "phew..." over the animal and plays a rising note. The help list has a line for it.

### Checks
- `bots.mjs`, direct and placed: full speed while fresh, slowing in order, gives up at 10 s, cannot notice for 7 s and then does, fresh again after 5 s without a chase, the rival never tires. With the animal held outside its sight the give-up never came and the check failed, as it should.
- `node bots.mjs 6 12`, careful bot, median highest level / median deaths. The first column is main before this pull request; the second is this branch (keep-up pace, harder animal hunts and tiring together). The branch without tiring was not measured here.

| | main | with tiring |
|---|---|---|
| classic strong | 12 / 2 | 11 / 1 |
| classic fast | 16 / 3 | 17 / 5 |
| classic sneaky | 18 / 0 | 18 / 0 |
| Wild strong | 8 / 3 | 7 / 4 |
| Wild fast | 10 / 9 | 9 / 10 |
| Wild sneaky | 10 / 9 | 13 / 4 |

- WebKit, iPhone 13 profile: a Wasp held 90 units from the player gave up, the message showed, the player was alive, no page errors.
- From a second attempt at notes #101 and #106 (closed pull request 101): an 8% speed step per level for fast animals, and hunters that see further and take prey 3 levels below, cut the classic strong-pick bot from level 12 to 5 to 8. Not used.

### Not verified
- Whether Wild now feels fair to a person, and whether the tester (who found the game too easy) now finds it easier still. The bots move little between main and this branch except for the sneaky pick in Wild.
- A real phone.

## 2026-11-23: first-time help (the owner's request for beginners)

After 3 s of play with no input, a see-through joystick near the bottom of the screen, the size of the real one, with a finger pressing the knob and taking it once round (`experiments/kit/hint.js`, kind `stick`). It goes on the first touch or key in play and never shows again on that device. New key `ant-promotion:hint`, `'1'` once the player has given input in play. A player with an `ant-promotion:v1` save never sees it. `?hint=hand` or `?hint=ring` shows it anyway, in the two looks for the owner to pick from. Checks: `hint ant-promotion` in the phone check. Not verified on a real phone.

## 2026-11-23: an ending that is not an end, a power for every animal, and speed again (tester t1, notes #148 and #149)

The notes, in short:
- **#148.** The game feels finished once you have every animal; it should not. Every animal should have its own ability, tied to its species. Animals should see differently: a snake narrow and far, a bird almost all the way round, and other shapes for others. Add more species, and make sure each has a unique ability.
- **#149.** The speed is annoying and makes the game boring: you outrun every animal in the game. Fix it.

### Done
- **Hunters pounce on fast animals (#149).** A medium or fast stronger animal that is fresh and within 62% of its sight distance dashes at 1.3 times your speed for 1 second, then cannot pounce again for 6 seconds (`POUNCE` in `sim.js`). It shows "Pounce!", dust and a growl. Only a player whose current animal is a fast pick meets it; a strong or sneaky player meets exactly the hunters it met before. A slow hunter never pounces, so the owner's "a slower one can be outrun" stays true for slow ones. The rival does not pounce; its temperaments already cover this.
- **The speed cap on fast picks is 1.8 times, was 2.5 (#149).** Six fast picks now reach it. Each pick before that is still +12% (note #46). A saved player with more fast picks is slower after this.
- **The owner's "hunters tire" rule is unchanged.**
- **Every species has its own sight (#148).** `SIGHT` in `sim.js`: snakes see a long thin strip (1.7 times as far, 0.42 rad each side), birds almost all round but close (0.62, 2.65), and 22 more animals have their own shape (a Mole all round and very near, a Cheetah far and narrow, a Spider wide). The rest keep the plain wedge. A bird keeps a blind spot right behind it, so it can still be sneaked up on. Food bugs, and animals hunting each other, use the old wedge.
- The help list explains both. The Animal book says how each animal you have been sees.
- **Fixed on the way:** a message from play ("You are a Rabbit") showed through the Animal book and the other menu pages.

### Numbers
A hunter one level up notices a fast player at 40%, 60% or 80% of its sight; the player runs straight away. Main: a first fast pick escaped all nine, and a medium hunter never caught a fast player. Now a medium hunter at 40% catches a level 2, 8 or 13 fast player, and from 60% on it does not. Strong and sneaky rows are the same as before.

Careful bot, 6 seeds, 12 minutes, median top level / median deaths:

| | main | pounce and cap | pounce, cap and sight (built) |
|---|---|---|---|
| classic strong | 11 / 1 | 11 / 1 | 9 / 1 |
| classic fast | 17 / 5 | 15 / 5 | 13 / 3 |
| classic sneaky | 18 / 0 | 18 / 0 | 18 / 0 |
| Wild strong | 7 / 4 | 7 / 4 | 6 / 2 |
| Wild fast | 9 / 10 | 11 / 9 | 11 / 10 |
| Wild sneaky | 13 / 4 | 13 / 4 | 12 / 4 |

The first sight table (birds 2.85, Rabbit, Deer and Zebra wider) took classic strong to 7: wide-eyed fast prey cannot be caught by a slow animal. Their blind spots were made larger for that reason.

### Checks
`bots.mjs` has direct checks of the pounce and the sight shapes; with the dash set to 0.1 the pounce check fails (tried). WebKit iPhone 13 screenshots of seven animals in Cartoon and 3D, no page errors. The phone check covers the book line.

The first full `bots.mjs 6 12` failed in the rival rules: their test animal, the Mole, no longer has the plain wedge. They now use a Porcupine, which has it (asserted); every assertion is kept, and the bite-range one still uses the Mole. The bot play printed before that point matches the table above.

The rival section of `bots.mjs` passes after that. One number moved: the bot that is reckless until its first death ate its rival in 3 of 6 Classic runs and 2 of 6 Wild runs. The build that added the rival had 6 and 6; main just before this change was not measured, so part of the drop may be from the changes in between.

### Not verified
- How a pounce feels to a person, and whether it is enough. Bots show fast picks rise less high in Classic; their deaths barely change.
- Whether the tester meant the animals' sight, the player's own view, or both. Only the animals' sight changed; a question went to the tester.
- A real phone.

### Left as a proposal (2026-11-23, notes #148 and #149)
- **Speed (#149): other levers, if the pounce is not enough.** (`FAST_CAP` went to 1.8 above.) The speed history is: fast picks grew to 2.5× (note #46); stronger animals were made to keep up with a boosted player (note #101); then the owner made a hunter slow down after 4 s and give up at 10 s, because Wild was "impossible". With tiring, running away always works, which matches "you outrun every mob". The candidates are:
  1. A lower cap on fast picks (`FAST_CAP` 2.5 → about 1.6).
  2. Tiring only in Wild, not Classic.
  3. Tiring later (`TIRE.fresh` 4 → 7 s, `spent` 10 → 16 s).
  4. Hunters that cut the corner (aim where you will be). This alone does not answer #149: against a player who runs straight away, aiming ahead gives the same heading.

  Measure with `bots.mjs` before choosing. Option 2 contradicts the owner's ruling for Classic and needs the owner.
- **Ways of seeing for the player (#148).** Light the meadow in the shape of the player's own species and dim the rest. It must stay fair: a hunter outside the light still needs its arrow.
- **An ability per animal (#148).** Group the 51 promoted animals into about 12 ability families, each with a key and a cooldown, for example: Wasp and Scorpion sting (stun), Frog and Rabbit leap, Mole digs (hide underground), Lizard blends in, Eagle and Owl dive, Porcupine spikes (an attacker bounces off), Bat echolocates (see through grass). The species then sets the strength and cooldown. One button on the right of the screen. This is a large change, and bots need a policy for each family.
- **After every animal (#148).** Two candidates:
  - a New Game+ meadow where the top animals of the last run are the hunters;
  - a collection screen of every animal you have been, with the rare ones only reachable through particular picks.

  Ask the tester which one before building.
- **More species (#148).** Add one extra choice at some promotions, so the tree branches more. It costs art time (each animal is drawn in code in `art.js`, in all four looks).

## 2026-11-24: a skill for every animal (tester t1, note #148)

The page calls it a "skill", because "Power" is already the strength number. The code says `power`.

Every animal after the Ant has one power, used with a round button at the bottom right (Space on a keyboard). The button shows the power's name and fills up again while it waits. `POWER` and `POWERS` in `sim.js` hold the numbers and the 49 names.

| Kind | Who (examples) | What it does | Wait |
|---|---|---|---|
| sting | Wasp, Spider, Snake, Hydra | The nearest animal within 120 units cannot move, notice or bite for 3 s. Works on stronger animals. Nothing in reach: not spent, 1 s wait. | 10 s |
| leap | Frog, Rabbit, Cat, Raptor | Jumps 150 units plus three body sizes the way you face; nothing can bite for 0.35 s. | 6 s |
| shell | Turtle, Beetle, Mole, Crocodile | Nothing can bite or notice you for 3 s. | 16 s |
| roar | Dog, Bear, Lion, Dragon | Every weaker animal within 230 units freezes for 2.5 s. | 14 s |
| dive | Bat, Owl, Eagle, Griffin | 1.9 times the speed for 1.2 s, and nothing notices you; animals already chasing give up. | 10 s |
| sprint | Cheetah, Fox, Lizard, Zebra | 1.6 times the speed for 2 s. | 8 s |

Reach grows 2% per level. A promotion or a revive resets the wait. A game played without pressing the button is the same game as before: the earlier bot rows did not move.

Careful bot that uses its power when a hunter has noticed it within 130 units (roar: when two weaker animals are within 200), 6 seeds, 12 minutes, median top level / median deaths, against the same bot without powers:

| | no power | with power |
|---|---|---|
| classic strong | 9 / 1 | 7 / 0 |
| classic fast | 13 / 4 | 13 / 3 |
| classic sneaky | 18 / 0 | 18 / 0 |
| Wild strong | 6 / 2 | 7 / 1 |
| Wild fast | 11 / 10 | 11 / 7 |
| Wild sneaky | 12 / 4 | 18 / 1 |

Powers are mostly an escape, so they cut deaths, most in Wild. Wild sneaky now reaches the top band; that may be too easy and is the first number to tune.

### Checks
`bots.mjs` has a direct check of each kind (a stunned stronger animal on top of the player does not bite; the shell holds for its time and then does not; roar spares stronger and far animals; dive and sprint are exactly their speed and then the plain speed; a diving bird is not noticed), of the wait, and that the Ant has no power and every other animal has one. WebKit iPhone 13, Cartoon and 3D: the button is hidden for the Ant, shows "Sting / ready" for a Wasp, a tap stuns a Dog 70 units away and the button shows the wait, no page errors. The steering stick's numbers in the shared phone check are unchanged.

### Not verified
- A real phone and a person: whether the button sits well under the right thumb while the left steers, and whether the powers are fun or only safe.
- The roar is the only power that helps hunting. The others are escapes. A hunting use for each kind is a next step.
- Other animals do not use powers.

"The same game without the button" was checked directly: main's `sim.js` and this one, fed the same scripted steering for 4 simulated minutes, 24 runs (Classic and Wild, each pick, 4 seeds), end in the identical state. The earlier table's "classic fast 13 / 3" prints 13 / 4 on this machine today; that difference is not from this change.

### 2026-11-24, later: what a skill does, and when to use it
- Three seconds after a promotion the page says what the new skill does in one line ("Hard shell: nothing can bite you"). Before this the button only showed a name.
- The button pulses when the skill would help now: a stronger animal has noticed you within 170 units (roar: two weaker animals in reach). With reduced motion it shows a still ring.
- Checked in WebKit iPhone 13 after a real promotion: the line appears, and the button gets the pulse when a Dog that has noticed the player is 120 units away.

### Wild with skills: measured, not tuned
Wild, careful bot with skills, 6 seeds, 12 minutes, median top level / median deaths:

| | sneaky | strong | fast |
|---|---|---|---|
| no skills | 12 / 4 | 6 / 2 | 11 / 10 |
| all skills | 18 / 1 | 7 / 1 | 11 / 7 |
| without roar | 16 / 0 | 7 / 1 | |
| roar only | 12 / 6 | | |
| without sting / shell / dive / leap | 17 / 2, 18 / 1, 16 / 2, 17 / 1 | | |
| every wait twice as long | 17 / 2 | | 11 / 7 |
| every wait three times as long | 14 / 2 | | 10 / 7 |

No single kind carries it, and longer waits barely move it: the bot uses a skill only about 10 times a run, each at the exact moment it is noticed, and each use is a death avoided. Seeds differ a lot (top level 10 to 18 in one row). The numbers were left as they are until a person has played: a bot's reactions are not a person's, and six seeds cannot separate these rows.

## 2026-11-24: skills that hunt, and a second reviewer's bug hunt

### Hunting uses
Before this only the roar and the sting helped a hunt. Now:
- **Leap:** weaker animals within 40 units of where you land are pinned for 0.9 s.
- **Sprint and dive:** while they last, the catch rule uses your boosted speed, so you can catch prey that is faster than you and has noticed you.
- **Shell:** a stronger animal that bites the shell is dazed for 2 s ("ouch!").

### Bugs found by a second model reading main, and fixed
1. The skill button could stay hidden after a pause (the button text had not changed, so the code that shows it again was skipped).
2. A dive did not hide you from the rival, though the page says nothing sees you. A sting, roar, leap or dive now also resets the rival's stalk, so it starts its hunt again instead of resuming a committed charge.
3. A second finger on the play area took the steering stick from the first (`kit/stick.js`). The first finger now owns the stick until it lifts. The lab ant pages use the same stick.
4. A sprint overtook prey but could not eat it (the catch rule used the plain speed). Same change as "sprint and dive" above.
5. Enter on the focused skill button, or a screen reader's activate, did nothing.
6. A leap pressed together with a new direction went the old way.
7. A promotion kept the old animal's sprint or dive running.
8. A stunned hunter could still eat the animal it was chasing.
9. The winning card said "Nothing here can eat you". A Dragon (184) eats a Hydra (180). It now says "You are at the top."

Not fixed: in the 3D look the green food arrow decides "off screen" with the flat view's rectangle, so near the edges it can show for visible food or hide for food just off screen.

### Checks
`bots.mjs`: a direct check for each hunting use and for 6, 7 and 8. Main's rules and these, fed the same steering without the button, still end identical (24 runs). WebKit iPhone 13: pause and resume shows the button again; a second finger leaves the steering vector unchanged and the first finger still steers after it lifts; a click on the button uses the skill; a real promotion shows the skill line. Not verified: a real phone, and the rival fix (2) has no direct check.

## 2026-11-24: Turkish

The game is now in English and Turkish, with the shared language kit (`experiments/kit/i18n.js`).

- **How a player picks it.** `?lang=tr` on the address, the globe button, or a Turkish browser. The choice is the kit's one key, `kit:lang`, shared by every game. An English browser gets English. The globe sits beside the Rules button on the menu (the title keeps its width) and in the top right corner of the pause card. It switches at once: every card, the HUD, the skill button and a speech bubble that is showing redraw; an explicit `?lang=` in the address follows the choice.
- **What stays English.** `sim.js`, the save (`ant-promotion:v1`) and lab records are unchanged. Animal names, skill labels, the rival's name, title and lines are identifiers there. They are translated only when drawn, by looking the English text up in `words.js` under a prefix: `animal.Fire Ant`, `skill.Hard shell`, `trait.`, `sight.`, `look.`, `pattern.`, `epithet.`, `title.`, `line.`. A text with no entry is drawn in English, so an old save or a new animal never shows a raw key. The rival's saved name "One Eye the Wolf" is drawn as "Tek Göz Kurt" only when both parts are known.
- **English is unchanged.** English strings moved into `words.js` as the same text. The How to play list, the lab notice and the recording switch keep the English the page and the kit wrote; Turkish replaces them and switching back restores them. A browser check compared every English screen (text, aria-labels, title, canvas text) with the page before the change: only the globe differs.
- **Turkish grammar.** Turkish has no article, and a case ending on an inserted animal name must follow vowel harmony. Every Turkish sentence with an inserted name is written so the name needs no ending: "Kurt olarak devam et", "Yengeç iken seni bir Kertenkele yedi", "Kitabına eklendi: Kurt", "Artık Kurt oldun", the rival's `{you}` always at the end of a clause.
- **Fit.** The skill button shrinks its font (13, 12, 11 px) when a label would need a third line or overflow; every English label measures at 14 px, so English never shrinks.

**To add a string:** add the key to `tables.en` and `tables.tr` in `words.js` and draw it with `t('key', { vars })`. A new animal or skill label needs only a Turkish entry (`'animal.<English name>'`, `'skill.<English label>'`); a check in node (all 55 names present and different) is in this change's report, not in the repo.

**Not verified.** No native Turkish speaker has read the text. Ask the tester (or another Turkish reader) to play one life in Turkish and mark anything stiff or wrong, especially the animal names (Böcek for Beetle, Kılıç Dişli Kaplan for Sabertooth, Yıldırım Kuşu for Thunderbird), the rival's epithets and lines, and the skill labels.

## 2026-11-24: your own way of seeing, and old animals that hunt (tester t1, notes #200 and #201)

The answers, in short. #200 (to #163, should your own view change with your animal): yes, but only a little. #201 (to #164, what should happen after the top): your old top animals come back as hunters.

### Done
- **Your own sight (#200).** The ground outside your animal's sight shape is a little darker (two steps of 8%), in all four looks. A Snake lights a strip, a Bat a circle. A round patch beside you is never dark, and very short sights (Mole, Bat) are drawn at 170 units or more so they are not a small hole. Drawing only: everything out there is still drawn, and numbers, arrows and the speech bubble lie above it. `sim.js` does not know about it.
- **Old animals (#201).** When a climb that reached the top ends in a new game (the winning card's "Start again as an Ant", New game on the menu, or Start over on the death card), its top three animals become hunters in the next climb. They carry 12 less power than before, so all three can be eaten on the way up; eating one pays 4 extra and takes it out of the save. Every 90 s one that is still stronger arrives from out of sight and hunts for 6 s, with a message and the red arrow. They wear a violet dotted ring.
- **Fair by construction, decided here.** An old animal is never faster than 0.88 of you, never pounces, tires like any hunter, sees half as far between hunts and walks away from you then. It does not hunt or get hunted by other animals, and it never becomes your rival. Wild's own hunt does not pick it.
- **Save.** `ant-promotion:v1` gains `old` (list of animal ids); a save without it, or with a bad value, has none. No other field changed.

### Numbers
Careful bot, 6 seeds, 12 minutes, median top level / median deaths (a run stops at the top):

| | none | first try (every 50 s, 0.98 speed, stays near) | built |
|---|---|---|---|
| classic strong | 9 / 1 | 5 / 5 | 7 / 2 |
| classic fast | 13 / 4 | 8 / 6 | 12 / 5 |
| classic sneaky | 18 / 0 | 18 / 1 | 18 / 0 |
| Wild strong | 6 / 2 | 5 / 6 | 5 / 3 |
| Wild fast | 11 / 10 | 6 / 11 | 10 / 9 |
| Wild sneaky | 12 / 4 | 9 / 7 | 12 / 4 |

### Checks
A game without old animals ends identical to main's rules under the same steering (24 runs). `bots.mjs` section 6 checks hunting, speed, the prize, upkeep, a revive, and that one is never crowned rival. The phone check climbs to the top, starts again and reloads, and plays a save with a bad `old`. Screenshots of Mole, Snake, Bat and Dog in Cartoon and 3D, of the winning card and of a hunt (WebKit iPhone 13) were looked at.

### Not verified
A real phone; whether the hunts are exciting or only a nuisance; whether the dimming is seen as "a little". In the bots an old animal was rarely eaten, because most runs did not get that far.

### Left as a proposal (2026-11-24, note #201)
- Keep roaming at the top is unchanged: the old animals come only after starting again. A harder meadow each time round (more than three, or stronger old animals on the third climb) needs the tester's word first.

## 2026-11-24: old hunters use their skills (tester t1, note #225, answering #218)

Asked what the climb after that should bring, the tester chose "Old hunters use their skills".

### Done
- A hunting old animal uses its own skill (`OLD_SKILL` in `sim.js`), the same one the player had as that animal. It stops for 0.7 s and shows what is coming in red, with the skill's name: a circle for a roar or a sting, a line for a leap or a dive, a filling ring for a sprint or a shell.
- A roar or sting slows the player in reach (to 0.75 or 0.7 for about a second) and never stops them; a shell, a dive or safe time blocks it. A leap or dive follows the line it showed, so a step aside makes it miss. A shell keeps it from tiring and from being stung for 2.5 s.
- **Own idea:** after the skill it is out of breath for 0.9 s (half speed), the moment to get away. Easy to remove: `puff`.
- The first skill of a visit is explained once, in English and Turkish. No save key changed.

### Numbers
Section 6 of `bots.mjs`, 6 seeds, 12 minutes, median top level / median deaths:

| | without old animals | with, before (#201) | with skills |
|---|---|---|---|
| classic strong | 9 / 1 | 7 / 2 | 7 / 2 |
| classic fast | 13 / 4 | 12 / 5 | 12 / 5 |
| classic sneaky | 18 / 0 | 18 / 0 | 16 / 0 |
| Wild strong | 6 / 2 | 5 / 3 | 7 / 3 |
| Wild fast | 11 / 10 | 10 / 9 | 9 / 9 |
| Wild sneaky | 12 / 4 | 12 / 4 | 12 / 4 |

### Checks
`bots.mjs`: each species with a skill, against each kind of player, at five distances: shown for 0.6 s or more, never catches a player who keeps running straight (tightest gap 62), all six kinds used; what blocks a slow; a dive keeps to its line and catches a player who stays in it; a stun stops it; a revive ends a slow. Five known-bad changes to the rules each fail (a faster dive, a short warning, a slow through a shell, a dive that steers, a skill that survives a stun). Without old animals the world ends identical to main's under the same steering (24 runs). Screenshots of Howl, Pounce and Sprint in Cartoon and 3D looked at (WebKit iPhone 13).

### Not verified
A real phone; whether the hunts are more exciting; the skills at high levels by hand. The straight runner is never caught by design, so the skills bite mostly on a player who stops or turns.

## 2026-11-24: the Living look (lab page ant-creatures folded in, owner's lab cleanup)

### Done
- A fifth look, **Living** (Turkish "Canlı"), on the Look button after 3D and in the URL as `?look=4`. Looks 0 to 3 keep their numbers, so a saved `look` in `ant-promotion:v1` means what it meant. Cartoon stays the default.
- Every animal near the screen, and the player, walks on a rig: a spine that keeps its lengths, two-bone legs with an alternating gait, tails, antennae, necks and a trunk that swing, eyes on what it hunts or flees. `rig.js` and `creature.js` came from the lab page; `living.js` joins them to the game. Nothing is imported from `experiments/lab/`. The rigs step after each sim step and only read it.
- Only the body drawing changes. Rings, numbers, "!", "zzz", the crown, the rival's tag, bubble and ring, hunt lines, sight wedges, the dim ground, edge arrows, the food arrow, old-animal rings and aims, floats, pieces, the light beam, flashes and cards come from the same code as in the other looks. Numbers rise with a body that is off the ground. The rival's scars are cut into its body.
- Body language from the rules (`moodOf` and `playerMood` in `living.js`):
  - pounce (`m.pounce`): a crouch for the first moment, then a leap off the ground with the body stretched out
  - an old animal winding up its skill (`m.wind`): a crouch that deepens until it springs; its leap or dive rises off the ground, its sprint takes quick steps
  - tired (`m.puff`, `m.winded`, a hunter's `tirePace` falling): panting, tongue out, quick breath
  - fleeing (`m.fear`): quick short steps, body stretched; chasing: stretched a little
  - stunned (`m.stun`): eyes shut, low and still
  - the rival's temperament: an ambusher lies low until it has seen you, a stalker creeps long and slow, a brute is bigger, a coward is smaller and trembles when it sees you
  - the player: a shell or a dig shows a see-through dome (a porcupine raises its quills instead), sprint and dive take quick stretched steps and a dive lifts, a leap or being thrown clear flies the body there in an arc (0.35 s; the sim has already moved), a roar's slow makes it stagger, a Wild hide growing back shows scratches
  - a bite squashes the biter: the player on a meal, an animal that eats another, the killer
- Hurrying animals take shorter, quicker steps and creeping ones longer, slower ones (`hurry` in `rig.js`).
- Look-alikes: a contact sheet of all 55 at book size and at 16 and 9 pixels showed dog, lynx and cat; bear, boar, gorilla and mole; hippo and mouse; and the ostrich (a dark four-legged blob) as the worst. Each got its own outline (`shape()` in `creature.js`): the cat is slim with a long curled tail; the dog has a muzzle, big floppy ears and a fast wag; the lynx has long legs, ear tufts, a cheek ruff and a black-tipped stub tail; the sabertooth is heavy at the front with long fangs; the bear has a shoulder hump; the gorilla knuckle-walks on long front legs with a silver back and no tail; the boar has a pink snout disc and a bristle ridge; the mole is round with pink hands and a pink star nose; the mouse has big ears and a long pink tail; the hippo has a barrel body and a square muzzle; the ostrich is a black fluffy body with white plumes, a long pale neck and a beak; the lion's mane is bigger and shaggy.
- The menu picture, the promotion cards and the animal book show the living animal when Living is chosen (a still rig).
- The lab page's zoo was not carried over; it is archived with the page (`archive/lab/ant-creatures/`). It was a toy for poking animals, not part of a run.
- Far and small bodies (under 6 pixels of radius) are drawn plain: no outline, eyes, shadow or marks.

### Overlay checklist
Compared on one frozen moment (the same seed and placements; `__ant.look(n)` switches the look without moving anything; the states are set after the freeze, so the sim cannot clear them): Chromium level 12 in looks 0 to 4, levels 6 and 17 in looks 1 and 4, WebKit level 12 in look 4, a variant with food off screen, and in motion (a meal, a leap, a death) at level 8. "Shared" means the code that draws it runs after the body is drawn and is the same in every look; the Living branch replaces only the call that draws a body. "Seen" means I saw it in a Living screenshot.

| Overlay | Living |
| --- | --- |
| numbers, faster ">>" marks, "zzz" | shared, seen; raised over a body in the air |
| "!" on a stronger animal that has seen you | shared, seen |
| green food arrow | shared, seen |
| red edge arrows (danger off screen) | shared; the test scene drew none in any look, so not compared |
| rival: ring, crown, name tag, bubble | shared, seen |
| rival: scars | drawn on the body by the rig's own marks, seen |
| hunt (chase) lines, sight wedges, dimmed ground | shared, seen |
| skill effects: "Pounce!", leap dust, shell | shared, seen; the shell is also a dome on the body |
| skill effects: roar ring, sting | shared, not caught |
| hide state (HUD "hide ready", dashed ring) | shared, seen |
| old animals: purple ring, red aim while winding up | shared, seen; the wind-up crouch shows on the body |
| "+n" floats, eat pieces | shared, seen |
| death pieces, death card | shared, seen |
| the promotion beam, flashes, cards | shared; cards seen, beam not caught |

### Numbers
- `rig-bots.mjs` (run first by `bots.mjs`): 55 species walk 10,000 steps each at up to 360, above the game's top speed, with every pose; no NaN, spine and chain error under 1e-10 %, no foot past its leg (worst 98.0 %), the gait alternates 100.0 % of 73,386 waves, feet slide 0.08 % at a walk and 0.40 % at a run (with every pose and speed mixed in, 0.98 % walking, 1.32 % running and 3.14 % in a pounce reach the leg's end before a step). A fleeing Dog steps 119 times in 10 s against 75 calm, a Mouse 235 against 148. 240 s of a real run with the look stepping ends in the same sim state as without it, with up to 63 rigs. Three more runs (seeds 3, 17, 29; 200 to 300 s) with a brute rival, three old animals and a fast player end in the same state too, and in them animals leave the ground in a pounce (49 rig-ticks), crouch and are bigger as the rival; making the look nudge the rival's heading by 1e-9 fails this check on all three runs. 11 sim states each give the pose they should, a calm animal none. Every species in 11 poses draws on a context that rejects NaN (168,056 calls).
- `--mutate=gait`, `clamp` and `spine` each fail 3 or 4 of those checks; `node bots.mjs --mutate` exits 1.
- Rules parity: `node bots.mjs 6 12` prints the same 66 lines after the rig checks as main's `bots.mjs` on main's `sim.js` (`sim.js` is unchanged).
- Page work per frame (the sim steps, the rigs and the drawing; `__ant.work`), headless at 390x844, median / 95th percentile in ms:

| | level 6 | level 12 | level 18 |
| --- | --- | --- | --- |
| Chromium, Cartoon | 0.6 / 1.2 | 0.9 / 1.6 | 0.8 / 1.3 |
| Chromium, Living | 0.8 / 1.4 | 1.0 / 1.8 | 1.0 / 1.6 |
| Chromium at 4x CPU slowdown, Cartoon | 2.4 / 3.3 | 3.2 / 4.2 | 3.4 / 4.8 |
| Chromium at 4x CPU slowdown, Living | 2.7 / 3.7 | 3.9 / 6.1 | 4.4 / 5.7 |
| WebKit (1 ms clock), Cartoon | 1 / 1 | 1 / 2 | 1 / 1 |
| WebKit (1 ms clock), Living | 1 / 2 | 1 / 2 | 1 / 2 |

  About 20 to 32 rigs are live near the screen. Living costs about 0.1 to 1 ms more than Cartoon, inside a 16 ms frame even at a 4x slowdown, so no further detail is dropped.

### Checks
- The phone check (`kit/check/phone.mjs ant-promotion`, WebKit iPhone 13 and Chromium Pixel 7): the old save with `look: 2` now must show "Look: Soft"; the Look button goes round to Living and saves 4; play draws living bodies; a death in Living, the death card, going on; the button goes back round to the old look; the other looks have no rigs. With Living switched off in the page, the check fails at "living bodies drawn".
- Played headless at 390x844: the menu, the first minute from Ant, a meal, a leap, a death, the pause card, the book and the winning card in Living.

### Not verified
- A real phone, and how Living feels in the hand against Cartoon.
- At play size the dog and the lynx are still close (both tan with dark spots); at 9 pixels most mammals read by colour and size more than by outline.
- The ostrich's plumes and the gorilla's face are first drafts.
- A rig's heading lags when an animal is moved at once (a revive, a check placing animals); in play animals walk, so this shows only in tests.

## 2026-11-24: rocks and tall grass (lab page ant-hide folded in, "but less prevalent")

### Done
- From level 4, the meadow has a few rocks and patches of tall grass: about 11 rocks and 13 patches in the 2000 x 2000 world (the lab page had 53 of each), none within 330 of the middle. A phone screen shows one or two at most. Levels 1 to 3 have none, so a new player's first minute is the meadow as it was. The world keeps its layout across promotions; cover is switched on by level each tick, not when the world is made.
- The code is in `cover.js` (layout, sight tests, the push out of rocks, the cut sight outline; pure geometry, no drawing, node-safe) and `cover-draw.js` (drawing in every look). `sim.js` calls them in a few marked lines: `coverOn`, `coverPlayer`, `teachCover`, the `hid` test in the animal loop, and `pushOut` after each move. The builder adding evolution across runs can treat cover as one switch: `create(..., opts)` with `opts.cover`.
- **Rocks block sight and movement.** A hunter cannot notice you through a rock, and nothing walks through one: a body that steps into a rock is put back on its edge and the part of its step that went in becomes a slide round it, toward the side it was heading. Why solid: a rock you can walk through reads wrong when it is drawn as a boulder. A plain push straight out pinned a body that ran at a rock's middle; in staged chases (a faster hunter behind, a rock ahead, 60 trials) a bot that ignores cover then survived 67 % instead of 82 % at level 6, and 57 % instead of 77 % at level 12. With the slide it was 78 % and 77 %, close to no rock at all.
- **Tall grass hides you while you creep.** Inside a patch, moving at most 0.45 of your top speed (or standing), you cannot be seen from outside the patch unless the looker is within 2.2 times your two radii. Running in grass rustles: you are seen as usual. A looker in the same patch sees you. Grass does not slow you (the lab page slowed by 20 %), so it costs nothing to cross.
- **Losing a hunter.** An alert hunter that loses sight of you to a rock or grass walks at 0.55 of its speed to where it last saw you. After 0.6 s out of sight (or its own hold time if shorter) it gives up, and then it does not notice anyone for 2 s, like a tired hunter. The lab page let a hunter sweep for 3 s and rest 1 s. Without the rest, half the hunters that lost the bot found it again within 3 s, so a break was not an escape.
- Cover applies to everyone who looks: the rival, old animals on the hunt and Wild hunts (which otherwise see you wherever they face) do not see through a rock or into grass. Animals hunting each other do not start or keep a chase on prey behind a rock or creeping in grass.
- **Fair both ways.** An animal creeping in grass is drawn as two eyes only, with no number, unless you share its patch or are very close; you are drawn faint with your eyes showing when you creep in grass. Rocks do not hide animals in the drawing, since the view is from above; the dimmed ground of your own sight is cut by rocks, so you see the shadows.
- **Sight drawn with shadows.** Every hunter's sight wedge and your own dimmed-ground sight are cut by rocks with real shadow outlines (`sightCut`: rays at each rock's edges), in Flat, Cartoon, Soft, Living and 3D (3D draws the cut wedge as a fan of triangles).
- **Taught without words.** The first time cover comes on, on a device that has not seen it, a rock appears ahead of the player with a hunter behind it facing the player; its drawn sight visibly stops at the rock. The hunter is the next-two-levels animal that sees furthest, placed inside its reach and on a phone screen. It waits a few seconds, then lives as usual. The device remembers in a new key `ant-promotion:cover` (`{ taught: true }`); `ant-promotion:v1` is unchanged and old saves load as before.
- **Seeds and boards.** Ant Promotion has no daily or shared board: the page makes a random seed each visit, or uses `?seed=`. The layout comes from its own random stream (seed xor a constant), so animals, spawns and moves come out exactly as without cover; levels 1 to 3 play tick for tick as on main, and a `?seed=` link shows the same rocks every time. `?cover=0` turns cover off.
- No new words, in English or Turkish.
- The lab page `ant-hide` is in `archive/lab/ant-hide/`. The redirect `'ant-hide': '/ant-promotion/'` is for the owner to add to `labMoved` in `worker-settings.mjs`.

### Checks
- `cover-bots.mjs`, run by `bots.mjs` after `rig-bots.mjs`, and alone (`node experiments/ant-promotion/cover-bots.mjs [seeds] [minutes] [--ref=<main's sim.js>] [--mutate=rocks]`):
  - Below level 4 a world with cover plays as one without: 86,400 ticks identical (seeds 1 to 3, Classic and Wild), whole state and every event.
  - With `--ref=` main's `sim.js` (from `git archive origin/main experiments`), `{ cover: false }` plays as main: 86,400 ticks identical at levels 1, 6, 12 and 18, Classic and Wild, with power presses.
  - Staged rules: a rock stops a hunter noticing you; an alert hunter loses you behind a rock in 0.58 s and rests, and stays on you in the open; grass hides you standing, not running, and not from a looker in the same patch; the rival and an old animal on the hunt do not see through a rock; a hunter starts on prey in the open and not behind a rock; running straight at a rock slides round it with no step inside; the layout is seeded and keeps out of the middle; the teaching rock and hunter appear at level 4 only, once.
  - `--mutate=rocks` (a test-only switch in `cover.js` that makes rocks see-through) fails 5 of those checks and exits 1. `rig-bots.mjs` now hands any mutation that is not its own (gait, clamp, spine) to `cover-bots.mjs` instead of treating it as a rig mutation.
  - Measured play runs only alone or with `--cover-play` (about 8 minutes).
- Sections 4 to 6 of `bots.mjs` now play with cover on (`create` makes cover unless told `{ cover: false }`), so their printed numbers above level 3 differ a little from main. Their claims still pass: `node bots.mjs 6 12` exits 0 (all sections, 620 s of CPU). The run had to be given 1800 s: with the machine at load 10, main's own `bots.mjs 6 12` also passed the 600 s limit. The default 20-seed run was cut by a 1500 s limit in the rival table, after the cover, rule-table, classic, WILD, wild-rules and powers sections had passed. `bots.mjs 3 6` is too small to use: it fails on main too.
- The phone check (`kit/check/phone.mjs ant-promotion`, WebKit iPhone 13 and Chromium Pixel 7) now also: no cover and no teaching at level 3; at level 6 on a fresh device the first rock is taught and saved in `ant-promotion:cover`, and the hunter behind it has not seen the player; all five looks draw with cover; a death with cover; `ant-promotion:v1` holds no cover field.
- Played headless at 390x844 and looked at: the menu, the first minute as an Ant (no cover), promoting to level 4 and the teaching rock with the hunter's sight cut by it, the pause card, the death card; rocks and grass in Flat, Soft, 3D and Living at level 6; eyes in grass in Cartoon and Living.
- Trial merge with PR 242 (`ant-skills`, not pushed): conflicts in `sim.js` (the imports, `create`'s first line, and the `sees` line, where both changes are kept: `!unseen(...)`, `seenK(s)`, and `&& !hid`), `bots.mjs` (imports), `index.html` (imports) and `NOTES.md`. Resolved that way, the cover checks pass and `{ cover: false }` plays as `ant-skills`'s own `sim.js` for 86,400 ticks.

### Numbers
- Measured play, held-out seeds 101 to 110, 12 minutes, Classic and Wild, each of the three picks, deaths at level 4 and above:

| | no cover | careful bot, cover on | hider bot, cover on |
| --- | --- | --- | --- |
| deaths (total of 6 settings) | 173 | 147 | 170 |
| deaths per 100 chases | 30.1 | 24.2 | 26.3 |
| chases broken by cover | | 10.0 % | 9.4 % |

  The careful bot does not know about cover. The hider bends its run toward a rock ahead when chased and keeps the rock between, and stands still in grass when a stronger animal is near.
- **The brief's bot target is not met.** Cover is no tax (147 deaths against 173 without; within noise of 10 seeds it may be a small help), but the bot that uses cover does no better than the one that ignores it (26.3 against 24.2 per 100 chases). Tried and dropped: three hider policies, the search walk at 0 and 0.55 of speed, and staged chases. In staged chases with a faster hunter close behind, cover never broke line of sight: a hunter on your tail stays on the same side of the rock as you. Breaks happen when you already have a lead, and those are chases the careful bot survives anyway (a hunter tires after 10 s). Deaths were 0 to 3 within 10 s of a cover break in 20-seed runs. At twice the density (still under half the lab page's) cover broke about 26 % of chases, the "one chase in four" of the brief, and the hider was still no better (146 against 153, and 68 against 69, in Wild with the fast and sneaky picks). The lab page's hider halved its deaths with 53 rocks and 53 patches; at this density the effect is too small to measure with these bots.
- Page work per frame (`__ant.work`), headless at 390x844, standing next to a rock on seed 7 (the same spot on main), mean / 95th percentile in ms, main then this branch:

| | level 6 | level 12 | level 18 |
| --- | --- | --- | --- |
| Chromium, Cartoon | 0.83 / 1.0 → 0.92 / 1.1 | 0.88 / 1.0 → 1.07 / 1.2 | 0.87 / 1.0 → 0.96 / 1.1 |
| WebKit (1 ms clock), Cartoon | 0.71 / 1 → 0.96 / 2 | 0.79 / 1 → 1.09 / 2 | 0.96 / 1 → 1.18 / 2 |
| Chromium, 3D | 2.29 / 17.6 → 2.65 / 16.3 | 2.36 / 13.6 → 2.56 / 13.6 | 2.55 / 14.7 → 2.91 / 14.8 |
| Chromium, Living | 0.81 / 1.0 → 0.95 / 1.4 | 0.93 / 1.2 → 1.16 / 1.6 | 1.02 / 1.3 → 1.12 / 1.5 |

  Cover costs about 0.1 to 0.35 ms a frame.

### Not verified
- A real phone, and whether the owner finds cover "less prevalent" enough, or now too rare to matter.
- Whether hiding feels worth doing to a person; the bots say it does not change survival at this density (see above).
- Frame time at a 4x CPU slowdown, and WebKit in 3D and Living.
- Balance was tuned on seeds 1 to 40 and reported on seeds 101 to 110.
