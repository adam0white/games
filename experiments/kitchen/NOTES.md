# Sky Kitchen

Catch falling ingredients on a tray, cook them, ring up the guest at a cartoon cash register, and spend coins to grow a food cart into a five-star restaurant. Live at `/kitchen/`.

## Loop

1. A guest walks up. Their order is on the ticket at the bottom left ("3 potatoes", "2 strawberries, 1 banana").
2. Catch: drag the tray (finger, mouse or arrow keys). Catching anything the ticket does not ask for opens a card: **Catch again** (start the catch over, free) or **Pay N to toss it** (keep going).
3. Cook, by recipe: chop (swipe across), fry (hold, let go in the green), microwave (tap to stop the needle in the green), blend (tap fast).
4. Serve: the total is keyed in digit by digit. Tap the register once: the guest's bills and coins flutter into their slots in the drawer, coins fly to the counter, and it closes itself. The register: the drawer springs open with a coin ding and the coins fly to the counter; tap again to close it (clunk).
5. After the day's guests, the day card shows coins and tips. **Restaurant** opens the shop.

Progression: eleven ranks. Food cart, diner, bistro, restaurant, fine dining, five stars, then five ranks above the clouds (Rooftop Garden, Balloon Galley, Cloud Kitchen, Starlight Room, The Top Table), shown as moons after the five stars. Each rank above five stars adds a catch twist (`TWISTS` in `sim.js`: wind, gusts, fast drops, triples, all) and one more building level. Each rank needs some buildings at a level and costs coins. Buildings: tray (wider), knife (faster chop), stove, microwave, blender (each unlocks dishes and widens the green), tables (more guests per day), decor (bigger tips). Higher ranks bring longer orders, faster falls and junk (fish bones, crushed cans, broken plates).

The first day is a tutorial: the coach line plus a pointing finger shows the catch, the chop swipe and the register taps. The kit drag hint also shows on a fresh save.

## Looks (for Adam to pick)

Players pick the look with the **Style** button on the menu and pause cards (Adam 2026-11-27: "give the players more options ... set a
default, then check how many players changed it and to what"). Default `diner`. The order is diner, storybook, diorama, comic, toon,
night, clay. A `?look=<id>` link also picks one. The pick sticks on that device (key `kitchen-look`).

Telemetry for every setting, through `kit/settings.js`: the event `setting {id, value, from, def}` for look, tool, sound, music and lang. Every run's start
record also carries `look`, `tool`, `sound` and `music`, so share of play per style can be counted as well as changes.
Round 1 looks: `diner` (default), `toon`, `night`, `clay`. Adam called the cartoon "not bad but there's better", so round 2 adds three
art directions, each a full-screen shader pass over the 3D render (`post` in `LOOKS`, the `post` block in art.js):

- `storybook`: watercolour. A Kuwahara filter turns surfaces into flat painted patches, brown ink lines come from depth and
  colour edges, and paper grain and a warm vignette sit on top.
- `diorama`: a toy model. Tilt-shift blur at the very top and bottom (the band where food falls stays sharp), bright paint,
  strong sun.
- `comic`: three tones, halftone dots in the shadows, thick ink lines from depth.

Cost: one extra full-screen pass. Desktop WebKit holds 72 fps on all of them; CI's software GL drops from about 11 to 5-8 fps.

## Difficulty (bots.mjs)

`node bots.mjs` plays 60 catches per stage with a "new" and a "good" bot. Clean = share of catches with no extra. Cart: about 0.92. Diner: about 0.9. Bistro: 0.7. Restaurant: about 0.33. Fine dining and five stars: about 0.2. Tuning lives in `TUNE` in `sim.js`. These numbers are the first guess; Adam's play sets the real curve.

## The line (from the Diner, rank 1)

Guests no longer come one at a time. Two are waiting by the tables when the doors open, and more arrive every `max(15, 26 - 1.1 x rank)` s while a spot is free (2 to 4 spots, from the Tables building). Each has a patience bar (`max(62, 95 - 3 x rank)` s; rude 0.7x, picky 0.85x) that drains the whole time, also while you cook for someone else. Out of patience, they walk out, and the day-end ledger counts them.

Between guests the camera shows the room. Tap a chip (dish, price, mood, patience) to call that guest to the counter. Space or Enter calls the most impatient guest, and after 2.5 s that guest comes up on their own. While you cook, the chips shrink to the top right. Rules and a whole-day simulation (`simulateLine`) live in `sim.js`. `bots.mjs` checks that a good cook keeps everyone at the Diner and that a slow cook at the top loses guests. Hook: `kitchenCall(i)`. Nothing new is saved.

## Looking around (focus views)

While guests wait (the pick phase), the ◀ ▶ buttons on the screen edges, a swipe, or the arrow keys walk the camera through
five views: Dining room, The line, Counter, Front door, Kitchen. Tapping a guest in any view calls them to the counter. Once the
player looks around, the auto-call is off for that pick, so a guest is never pulled while the player is looking; patience still
drains. The right wall now has a doorway (guests used to walk through the wall). Lab event: `focus {view}`.

## Moods and the Manners Wheel (from the Bistro, rank 2)

Nana's rule: "Feed everyone. Throw food? Spin first. THEN feed." From the Bistro on, some guests arrive with a mood (rude, picky, sneaky; up to 1 a day at rank 2, 3 at the top). Moods come from their own seeded stream, so the day's dishes do not change. Missions that need a mood force one onto a guest.

- Rude: no tip, and a dish under three stars comes back in your face. Picky: no tip unless three stars. Sneaky: pays half and runs.
- Burnt food is thrown by anyone.
- The Wheel button (bottom right, at order time) opens 11 actions: kick out, slap, fridge, pan, microwave, cook it, lock out, trash can, rob, hire, fist fight. Most send the guest off in a slapstick stunt and bring them back sorted: a moody guest tips 1.25x, a calm one tips nothing. After food in the face the Wheel opens again ("payback"); "Let it go" skips it.
- Rob takes 0.6 of the dish price and the guest leaves unfed. Hire adds paid staff (wage `8 + 6 x rank` at day end). Winning a fist fight (tap race, 3 s) makes the guest work one free shift. Up to 2 staff; each adds 15% to tips.
- A beaten guest works the rest of that day and all of the next, then goes home. On that next day they rebel 40% of the time: win the rematch or they quit. Fights need `10 + 1.2 x rank` taps, capped at 16.
- Staff are stored in `kitchen-staff` (array of {look, kind, name}). Do not rename it.
- Test hooks: `kitchenWheel(id)`, `kitchenFight(win)`, `kitchenMood(m)`, `kitchenThrow()`.

## Code

- `sim.js`: rules, no DOM (recipes, ranks, buildings, catch step, cook scoring, bills).
- `art.js`: three.js scene, camera views per phase, looks, register, guests.
- `main.js`: phases, input, screens, sound, lab events. Check hooks: `kitchenState()`, `kitchenMusic()`, `kitchenAlive()`; `?recipe=<id>` forces a dish after the tutorial.
- Save key `kitchen-save`, music `kitchen-music`, look `kitchen-look`, hint `kitchen:hint`, story `kitchen-story`, tool skins `kitchen-tools` ({own, use}). Do not rename them.
- Tool skins (shop, bottom): chef knife, chopsticks, spatula, cleaver, a fish, machete, golden knife. Cosmetic, each with its own cut sound. The knife building no longer tightens chop par; it widens the edge (`knifeReach`) and steadies sliding food (`knifeCalm`).

## Sources and licences

- Kenney Food Kit, Furniture Kit and Mini Characters (kenney.nl), CC0. See `models/KENNEY-LICENSE.txt`.
- three.js r187 (MIT), vendored in `vendor/`.
- Sounds and music are made in the browser by the kit (`kit/audio.js`, `kit/music.js`). Nothing was bought.

## Rush rebuild (started 2026-11-28, following `docs/playable-first.md`)

Built by the strongest available model in the lab thread; reviewers on other model families. No person has played any of this yet unless a line below says so.

### What recorded play shows (26 to 28 November, phone, 42 runs, about 250 minutes)

- A day lasts about 1.4 minutes at the median and serves 2 to 5 guests for about 30 coins. Players start the next day about 15 to 20 seconds later, so they do come back.
- Nothing can beat the player. A day cannot be lost. 49 guests arrived in the line on 27 November and none walked out (patience 86 s or more against about 20 s a guest).
- "Catch again" is free and was tapped 13 times on 27 November.
- Rob was 8 of 21 wheel uses, also on calm guests. It pays 0.6 of the price in about 5 seconds against about 1.25 of the price in about 25 seconds for cooking, and it costs nothing.
- Eight wheel actions do the same thing. The rank needs fix the build order.

### Target, as things the player decides

Owner's recorded asks: several orders at once and choosing which guests to serve; more variety and faster play; harder; better progress and missions; funny actions.

| Ask | What the player decides | What the game must do for it to matter | Build before the rebuild | Live after slice 3 |
|---|---|---|---|---|
| choose which guests to serve | whose food to catch, and who to give up on | more guests than one cook can serve, patience that runs out, pay that differs by guest and by how long they waited | no pressure: nobody walks out, so order never matters | Rush: guests walk out and pay differs, but no adaptive serving rule beats every fixed plan (gate parked) |
| several orders at once | take one order or two together | a joined catch is quicker per guest but harder, and both guests keep waiting | one guest at a time | Rush: three seated at once, one shared sky; every pair of falling things is a side to pick |
| harder | how much risk to take | a shift that can go badly, with a visible target | a day cannot be lost | Rush: three strikes shut the doors; three coin targets a rank; Lunch rush is the riskier night |
| faster play | nothing; this is pace | under 15 s from call to catch to cook to pay for a simple dish | about 20 to 30 s, with about 6 s of fixed waits | Rush: about 12 s a guest for a good scripted cook; Lunch rush is 90 s of one-step dishes |
| funny actions | which wheel action, and when | each action does something different and has a price | 8 of 11 identical; Rob dominates | Rush: eleven effects, eleven prices, three turns a shift; Cook it! may be too strong, Lock out may be dead |
| progress and missions | what to build first, which shift to attempt | builds that change the measured result in different ways | build order fixed by rank needs | weakest row. Two nights with their own stars; in a Rush only Tray and Decor change the result; Tables does nothing; no missions inside a shift |

### The first situation: one Rush shift (slice 1, 2026-11-28)

A Rush is one shift on a clock, started from the menu ("Rush hour") on any save past the tutorial. The ordinary day is unchanged and stays the first button. Rules live in `shift.js` (no DOM); the page and the scripted players in `measure.mjs` use the same calls. Rush progress is in its own key, `kitchen-rush`; `kitchen-save` keeps its shape and only receives coins.

- Doors are open 120 seconds. Three seats. Every seated guest's food falls in one shared sky.
- Food falls two things at a time, one each side of the middle, each farther out than a tray left in the middle can reach. So every pair is a side to pick. Each thing is something a different seated guest lacks, or sometimes a thing nobody ordered.
- A ring round a falling thing has the colour of the guest it would go to (the guest who lacks it and has the least patience). Things nobody ordered have no ring.
- The tray holds 3 plus the Tray level. One more pushes the oldest thing of another guest off. Catching a thing nobody ordered knocks the newest thing off and costs one buzz.
- When one guest's food is all on the tray, that dish is cooked at once with the usual steps. The sky waits; the other guests' patience does not.
- Tip falls with the wait. A walkout is a strike and clears the buzz. Three strikes shut the doors early. A guest who finds no seat leaves and costs one buzz.
- Buzz: each guest served adds a step (up to five); each step adds 12% to pay.
- Stars: three coin targets per rank. The save receives a quarter of the shift's coins ("your share"), so a Rush pays about what the same minutes of ordinary days pay.

### Measured (scripted players, 40 seeds, Bistro rank, coins a shift)

`node experiments/kitchen/measure.mjs order 40 --tier=2`. "Good" reacts in 0.25 s and cooks at 0.93 quality; "new" reacts in 0.45 s, cooks 45% slower at 0.74.

| Player | Good cook | Walkouts | New cook | Walkouts |
|---|---|---|---|---|
| tray never moves (middle) | 0, doors shut early every time | 4.4 | 0 | 4.4 |
| tray parked at one side | 227 | 1.7 | 164 | 2.3 |
| no plan: catch anything ringed | 362 | 0.47 | 223 | 1.05 |
| most impatient guest first | 349 | 0.10 | 219 | 0.70 |
| best payer first | 294 | 1.23 | 216 | 1.40 |
| nearest to done first | 370 | 0.30 | 226 | 0.82 |
| mixed rule (save who can be saved, then best coins a second) | 352 | 0.47 | 224 | 1.10 |

What this shows, and what it does not:

- Picking a side matters: a still tray earns nothing and a parked tray earns about 60% of a played one.
- Which guest to build for changes walkouts by a factor of four to twelve, and "best payer first" loses about 20% for a good cook. It changes coins among the three sensible plans by under 6%, which is inside the spread between seeds (about 300 to 410). So the plan is a real choice for keeping guests, and close to flat for coins.
- Not shown: a rule that reads the whole table and beats the best simple rule by a clear margin. The mixed rule does not. Until one does, do not claim the Rush has deep ordering strategy.
- The measurement can fail: with the tray holding everything (`--off`), "best payer first" rises from 294 to 349 and walkouts halve, and "no plan" becomes the best plan (378). The tray limit is what makes chasing the best payer cost something.
- The model was checked against the page. Ten dishes timed in a phone-size browser came within 1.2 s of `cookSecs`. A browser script at the good cook's pace took 405 (most impatient first, touch) and 271 (no plan, new cook's pace) on one seed at the Bistro; a tray left in the middle served nobody and the doors shut early with no page error.
- No person has played a Rush.

### Tried and dropped

- Calling one guest to the counter and choosing the order. "Most impatient first" beat every other order (125 against 118 first come and 106 best payer), so it was one right answer.
- A shared sky that drops one thing at a time. "No plan" won (161 against 128 to 145), so there was nothing to decide.
- Pairs that fall anywhere 1.0 to 1.15 apart. A tray that never left the middle caught about one of each pair and earned three stars in the browser. Pairs now straddle the tray's reach.
- A fourth and fifth seat from the Tables build. More seats lowered takings (good cook 329, 339, 309 for 3, 4, 5 seats on ten seeds; new cook 225, 218, 199) and shut the doors early in 40 to 90% of shifts at five seats, because a refusal costs one buzz and a walkout costs a strike. Seats are three at every rank until a seat is worth having (`node experiments/kitchen/measure.mjs seats`).
- The first model of cooking time added 4 s a guest for walking, ordering and paying, which a Rush does not have. It put a good cook at 235 where the page gave 390, so the first star targets were far too low. Check the model against the page before setting any target from it.

### Open

- Star targets are set from the model (one star near a new cook's lower quartile, three near a good cook's upper quartile). A person's first shifts will show whether they are right.
- Corrected 2026-11-28: an earlier line here said a new cook's doors shut early in 75 to 93% of shifts from the Fine rank up. That was measured before the arrival-timing fix in the slice 1 review. Rerun on 30 seeds after it: no rank shuts early for either cook, and a new cook takes 0.4 to 1.1 strikes a shift.
- The wheel opens in a Rush since slice 2 (below). No person has used it there yet.
- Guests are tickets at the top of the screen, not people in the room.
- The Rush is not in the browser phone check; `bots.mjs` asserts its rules (idle serves nobody, a played shift ends).

### Review of slice 1

One adversarial code review on another model family found nine things; seven were confirmed and fixed before merge: the end card could say "shut early" when the third walkout came after the bell; the third guest arrived with the opening two; things in the air hung still when the room emptied; a thing nobody ordered was drawn twice on a clatter; the tray kept showing a dish's food for a moment after it left; ring materials leaked on quit; a damaged `kitchen-rush` record could break the menu. Not fixed: the wheel and Rob are not reachable in a Rush (planned next).

### Slice 2: the wheel inside a Rush (2026-11-28)

Recorded play showed Rob taken 30 times and nothing else on the wheel more than a handful, with no walkouts to make any of it matter. In a Rush every wheel action now has one effect and one price, the price is printed on its button, and a shift has three turns (`RUSH.nerve`). Tap a guest's ticket (or press 1, 2, 3) to open it. The sky holds still while the sheet is open and patience keeps running, so reading is not free.

| Action | Effect | Price |
|---|---|---|
| Kick out | the guest leaves | no pay, one step of buzz, no strike |
| Slap | patience full again | half their tip |
| Fridge | no patience lost for 25 s | a turn |
| Pan | junk in the air is gone and none falls for 15 s | a turn |
| Microwave | a moody guest turns calm | a turn; tip is half as much again |
| Cook it! | served the moment their food is caught | no tip, no buzz |
| Lock out | nobody arrives for 18 s | the guests who would have come |
| Trash can | their order becomes the smallest dish | the price of the bigger dish |
| Rob | 60% of their price now | a strike, the buzz, nine seconds off everyone watching |
| Hire | tray holds two more for the shift | that guest's pay; once a shift |
| Fight | win the tap fight: double pay | lose: they leave and it is a strike |

Measured with `measure.mjs wheel 60 --tier=4 --who=greedy` and the same with `--off` (60 seeds, rank 4, a catcher with no plan, coins a shift against never opening the wheel, up to three uses; rerun on the merged code):

| Action | New cook, timed (never 353, strikes 1.08) | Good cook, timed (never 632) | New cook, at random | Good cook, at random |
|---|---|---|---|---|
| Kick out | +1, strikes 0.55 | +5 | -5 | -61 |
| Slap | +47, strikes 0.15 | +24 | -4 | -19 |
| Fridge | +24, strikes 0.25 | +14 | +26 | -32 |
| Pan | +4 | +36 | +29 | +16 |
| Microwave | +16 | +7 | +11 | +6 |
| Cook it! | +63 | +61 | +79 | +9 |
| Lock out | -2 | -16 | +11, strikes 0.32 | -117 |
| Trash can | +6 | +7 | +34 | +48 |
| Rob | +14 | +9 | -241, shut early always | -511, shut early always |
| Hire | +20 | -1 | +7 | -4 |
| Fight | -8, strikes 1.68, shut early 17% | +49, strikes 0.67 | +37, strikes 1.78 | +14 |

With the careful plan (most impatient first, `--who=impatient`) a good cook takes 676 without the wheel and the gains shrink: Cook it! +30, Microwave +21, Pan +16, Fight -1, Hire -27, Lock out -31, the rest within 5. A new cook on that plan: Cook it! +51, Microwave +23, Fight +17 (strikes 0.37 to 1.25), Pan +12.

The scripted fight first cost no catching time and showed +38 to +46 everywhere. Modelled as on the page (nothing is caught for the 3.5 s of the fight, and it counts only if the guest is still seated) it is a gamble: +49 for a good cook who is losing guests anyway, and for a new cook -8 with the scripted trigger, +37 at random and +17 on the careful plan, so the new cook's trigger is wrong and the sign is not known.

Reading. The moment matters for Kick out, Slap and Rob, and for Fridge with a good cook: each is worth using when timed and costs coins at random, and Rob at random is ruinous, which is the price recorded play said it lacked. Fight pays a player who wins fights and has time to spare, and it is the one that can close the doors. Cook it! is the best single action for a careless catcher of either skill, even with no tip and no buzz. Lock out helps nobody the scripts can find except a new cook at random. Trash can and Pan are better at random than with the scripted trigger, so their triggers are wrong.

Decision: all eleven stay. Several scripted triggers did worse than random use (Trash can, Fridge, Pan, Lock out at first), which says the trigger was wrong, not that the action is flat. Per the stop rule, Cook it! and Lock out get one retune each after a person's shifts can be read: Cook it! may be too good, Lock out may be dead.

Not shown: that a person finds the sheet, reads eleven buttons under pressure, or chooses differently from one shift to the next. The gate from the design reviews (an adaptive rule that beats every fixed plan) is still unmet.

### Cold first play (2026-11-28, slice 1 build)

Seven phone screenshots of a Rush went to a reviewer on another model family with no other information. It read the mode, the clock, the tickets, the rings and the end card correctly. Six findings, all addressed the same day in the stop-adding pass and rechecked by playing a first-ever Rush in a browser and recording every hint and message:

1. Control: nothing on the first Rush screen said to drag the tray. Fixed: the first two shifts open with "Drag the tray under a ringed thing" (mouse and keys wording on a desktop); the rules line comes after the first catch. (The reviewer's screenshots came from a browser without touch, so its remark about the menu text was not checked on a phone.)
2. Control: nothing said what to do at the cooking step. Fixed: each cooking step shows its one-line hint for the first two shifts.
3. Cost: nothing said what caused a strike. Fixed: a walkout, a robbery and a lost fight each say "Strike n of 3".
4. Cost: it could not tell what a wrong catch costs. Fixed: the wrong catch says it costs one buzz, and says so when it also knocked something off the tray.
5. Progress: shift takings and the wallet share looked like one number. Changed: the end card's row reads "Your share (a quarter)". The next star's target was already the second number beside the coins.
6. It could not tell what the diamond and the eyes mean. Fixed: the first time each kind of guest arrives, one line says what it does.

Not rechecked by a cold reader yet. The first screen still stacks the banner, the hint and the tickets in the top half.

### Review of slice 2

A browser script at phone size ran the edges: pause with the sheet open, a lost fight through the real tap fight, a third strike from a lost fight, the shift ending and the guest walking out during a fight, the guest walking out under an open sheet, Cook it! followed to its serve (price alone, buzz unchanged), and the sheet at 320 by 568 in Turkish. It found two faults, both fixed: on a small phone the tap that opened the sheet also pressed the button that appeared under the finger (the sheet now opens on click and ignores presses for a quarter second); and Escape paused the game instead of closing the sheet.

One adversarial code review on another model family gave nine findings. Fixed: Pan could still send junk when one guest was left; Trash can after a won fight lost the double pay; Cook it! raised the best-buzz record; the fridge timer stopped under a measuring switch; the scripted fight cost no catching time; the test hook could act on the wrong guest or skip the fight. Two were already fixed by the edge run.

One cold read of the sheet on a third family (three screenshots, no context) read ten of eleven buttons correctly. Fixed from it: the turns left are now a labelled count that says each action uses one; a disabled button says why; Cook it! and Fight say what the player has to do. Left for the next stop-adding pass: mark which actions touch one guest and which the whole room.

Open after this slice: a tray parked at one side still takes 227 at the Bistro, above the one-star target of 180, so doing one thing and stopping earns a star; cells of +1 to +7 in the table are probably inside seed noise (no paired spread was printed); a wheel use in a Rush also counts toward the ordinary day's wheel missions (left in on purpose, not measured); only one action type a shift was measured, never a mix (for example a won fight then Rob on the same guest); a shaking ticket (low patience) is a moving target for a finger.

### The adaptive-rule gate: parked after three trials (2026-11-28)

The design reviews set a gate: some rule that reads the room should beat every fixed plan for whose dish to build. Three rules have now been tried with `measure.mjs order` (60 seeds, ranks 2, 4 and 7, both cooks): `mixed` (slice 1), `slack` (earliest deadline among guests who can still be saved) and `worth` (coins a second of work left, switching to most impatient when the buzz or the strikes are high).

| Coins a shift | Rank 2 good | Rank 2 new | Rank 4 good | Rank 4 new | Rank 7 good | Rank 7 new |
|---|---|---|---|---|---|---|
| most impatient | 357 | 211 | 676 | 388 | 1156 | 650 |
| no plan | 355 | 225 | 632 | 353 | 1073 | 596 |
| best payer | 305 | 222 | 621 | 383 | 1147 | 627 |
| mixed | 343 | 225 | 584 | 380 | 1106 | 623 |
| slack | 344 | 217 | 647 | 369 | 1172 | 652 |
| worth | 334 | 223 | 598 | 394 | 1129 | 642 |

No adaptive rule beats "most impatient" by more than 2% anywhere, and each loses to it somewhere. Having a plan matters from rank 4 up (7 to 10% over no plan); which sensible plan matters little. Per the stop rule this question is parked until a person's shift can be read. What would reopen it: a recorded shift where the person lets a guest go on purpose, or a seat rule that makes refusing a guest cheaper than losing one.

### A still tray and a parked tray at every rank (2026-11-28)

The slice 1 check ran a still tray at three ranks. Run at all eleven, it took 202 to 584 coins at the top four ranks and sometimes a star: from rank 7 a gust slides the whole sky sideways and carried one side of every pair onto the tray. Gusts are now off in a Rush, a still tray takes nothing at any rank, and `bots.mjs` asserts it for every rank on three seeds. Targets at the top four ranks were rechecked and stand.

A tray parked at one side with a good cook behind it still averages 0.7 to 1.1 stars at every rank (for example 209 coins against a one-star target of 180 at rank 2). Left as it is: the first star is set near a new cook's lower quartile, and catching one side of every pair while cooking well is about that good. Open for the owner if one star should demand more.

### Slice 3: nights (2026-11-28)

Row served: progress and missions ("which shift to attempt"), and the owner's asks for variety and faster play. This is not a fourth trial of the parked serving-order question: the choice is made on the menu, before the shift.

**What shipped.** From the Diner (rank 1) the menu has a second start button, Lunch rush. It is a Rush with one rule changed: only the quickest third of the menu, every dish at one set price (the average price of the whole menu at that rank), 90 seconds, guests arrive 1.67 times as often and wait 0.62 times as long. It keeps its own best and stars for each rank (`kitchen-rush.nights.lunch`; the Rush hour record keeps its place and shape). "Rush again" repeats the night just played. `rec` start and end events carry `night`.

**Measured** (`node measure.mjs nights 60 --tier=N`, scripted cooks, coins a shift and coins a minute):

| Rank | Cook | Rush hour | Lunch rush | Rush strikes | Lunch strikes | Lunch shut early |
|---|---|---|---|---|---|---|
| 1 | new | 248 (102/min) | 201 (110/min) | 0.6 | 1.7 | 5% |
| 1 | good | 332 (140/min) | 299 (166/min) | 0.0 | 0.4 | 0% |
| 4 | new | 353 (134/min) | 345 (180/min) | 1.1 | 2.4 | 10% |
| 4 | good | 676 (263/min) | 559 (297/min) | 0.1 | 0.6 | 0% |
| 7 | new | 629 (226/min) | 615 (321/min) | 0.9 | 1.8 | 5% |
| 7 | good | 1160 (449/min) | 1075 (571/min) | 0.0 | 0.3 | 0% |
| 10 | new | 829 (298/min) | 772 (399/min) | 0.5 | 1.2 | 2% |
| 10 | good | 1518 (580/min) | 1347 (722/min) | 0.0 | 0.1 | 0% |

Reading: the shape is the same at every rank. Rush hour takes more a shift, Lunch rush takes 10 to 40% more a minute and has two to three times the walkouts. Neither is better on both counts. Whether a person feels that as a choice is not known.

**In the real page** (browser players at the Fine rank, seed 4242, Lunch at its first tuning): Rush hour 544 and 559 coins, Lunch rush 305 and 457 for a slower and a faster player. A browser player that only chases the lowest wanted thing was shut early on Lunch twice (35 and 74 coins). Lunch is hard for a careless player. A still tray takes nothing on either night at any rank (bots).

**Tried and dropped in this slice**

- *A fourth and fifth seat with a crowd bonus* (pay +10, 15 or 20% for each guest seated beyond three when a dish goes to the stove). One trial, pass line written first: a good cook gains at least 4% at four seats and a new cook does not gain. It failed: the new cook gained more than the good cook at every strength (rank 4, +15%: new 388 to 420 to 428, good 676 to 677 to 709), because a slow cook has the fuller room. It was an upgrade for everyone, so not a choice. Seats stay at three. A blind outside answer to the same question proposed spare seats as an offer the player taps to accept; that is a serving choice and waits with the parked gate.
- *Banquet night* (the biggest third of the menu). At its first tuning it paid most for every player; after one retune (no bonus, normal patience) it was within 5% of Rush hour for every player and best for none. Removed.
- *Critics' night* (three stars pays double, less pays half). The scripted new cook never cooks three stars (quality 0.74), so it measured as a night for good cooks only (rank 4: new 164, good 825). Browser players earned three stars on it at both paces. Recorded play settles it: 82 of 97 recorded dishes were three stars, chopping scored 0.9 or more 94% of the time, frying 69%. For people it would be close to double pay for everyone. A second form (double pay only while the guest's bar is still green) made no serving plan better than "most impatient first" (rank 4 good cook: 1072 against 1025 for a plan built for the rule), because a good cook serves nearly everyone in the green. Removed. It could return if a person's Rush shifts show cooking quality falling under time pressure.
- *Lunch at 1.7 times pay.* It beat Rush hour on both counts at ranks 1 and 2 (rank 1 new cook: 312 against 220 a shift), because at low ranks the quick dishes are most of the menu. Replaced by the set price, which gives the same shape at every rank.

**Open after slice 3**

- The scripted new cook's quality (0.74) is too low against recorded play (85% three-star dishes). It lowers that cook's tips, so the one-star targets on both nights are probably easy for a real beginner. Targets are not refitted until a person's Rush shifts can be read.
- In a Rush only Tray and Decor change the result. Knife, Stove, Microwave and Blender change nothing there, and Tables does nothing. "What to build first" is still not a Rush decision.
- No missions inside a shift yet.
- No person has played either night.

