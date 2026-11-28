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

## Looks (for the owner to pick)

Players pick the look with the **Style** button on the menu and pause cards (the owner, 2026-11-27: "give the players more options ... set a
default, then check how many players changed it and to what"). Default `diner`. The order is diner, storybook, diorama, comic, toon,
night, clay. A `?look=<id>` link also picks one. The pick sticks on that device (key `kitchen-look`).

Telemetry for every setting, through `kit/settings.js`: the event `setting {id, value, from, def}` for look, tool, sound, music and lang. Every run's start
record also carries `look`, `tool`, `sound` and `music`, so share of play per style can be counted as well as changes.
Round 1 looks: `diner` (default), `toon`, `night`, `clay`. The owner called the cartoon "not bad but there's better", so round 2 adds three
art directions, each a full-screen shader pass over the 3D render (`post` in `LOOKS`, the `post` block in art.js):

- `storybook`: watercolour. A Kuwahara filter turns surfaces into flat painted patches, brown ink lines come from depth and
  colour edges, and paper grain and a warm vignette sit on top.
- `diorama`: a toy model. Tilt-shift blur at the very top and bottom (the band where food falls stays sharp), bright paint,
  strong sun.
- `comic`: three tones, halftone dots in the shadows, thick ink lines from depth.

Cost: one extra full-screen pass. Desktop WebKit holds 72 fps on all of them; CI's software GL drops from about 11 to 5-8 fps.

## Difficulty (bots.mjs)

`node bots.mjs` plays 60 catches per stage with a "new" and a "good" bot. Clean = share of catches with no extra. Cart: about 0.92. Diner: about 0.9. Bistro: 0.7. Restaurant: about 0.33. Fine dining and five stars: about 0.2. Tuning lives in `TUNE` in `sim.js`. These numbers are the first guess; the owner's play sets the real curve.

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

| Ask | What the player decides | What the game must do for it to matter | Build before the rebuild | Live after slice 4 |
|---|---|---|---|---|
| choose which guests to serve | whose food to catch, and who to give up on | more guests than one cook can serve, patience that runs out, pay that differs by guest and by how long they waited | no pressure: nobody walks out, so order never matters | Rush: guests walk out and pay differs, but no adaptive serving rule beats every fixed plan (gate parked) |
| several orders at once | take one order or two together | a joined catch is quicker per guest but harder, and both guests keep waiting | one guest at a time | Rush: three seated at once, one shared sky; every pair of falling things is a side to pick |
| harder | how much risk to take | a shift that can go badly, with a visible target | a day cannot be lost | Rush: three strikes shut the doors; three coin targets a rank; Lunch rush is the riskier night |
| faster play | nothing; this is pace | under 15 s from call to catch to cook to pay for a simple dish | about 20 to 30 s, with about 6 s of fixed waits | Rush: about 12 s a guest for a good scripted cook; Lunch rush is 90 s of one-step dishes |
| funny actions | which wheel action, and when | each action does something different and has a price | 8 of 11 identical; Rob dominates | Rush: eleven effects, eleven prices, three turns a shift; Cook it! may be too strong, Lock out may be dead |
| progress and missions | what to build first, which shift to attempt | builds that change the measured result in different ways | build order fixed by rank needs | Two nights with their own stars; thirteen missions, one a shift, paid outside the stars; in a Rush only Tray and Decor change the result; Tables does nothing |

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
| 2 | new | 225 (86/min) | 196 (107/min) | 1.2 | 2.4 | 18% |
| 2 | good | 357 (141/min) | 313 (166/min) | 0.1 | 1.0 | 2% |
| 4 | new | 353 (134/min) | 345 (180/min) | 1.1 | 2.4 | 10% |
| 4 | good | 676 (263/min) | 559 (297/min) | 0.1 | 0.6 | 0% |
| 7 | new | 629 (226/min) | 615 (321/min) | 0.9 | 1.8 | 5% |
| 7 | good | 1160 (449/min) | 1075 (571/min) | 0.0 | 0.3 | 0% |
| 10 | new | 829 (298/min) | 772 (399/min) | 0.5 | 1.2 | 2% |
| 10 | good | 1518 (580/min) | 1347 (722/min) | 0.0 | 0.1 | 0% |

Reading: the shape is the same at every rank. Rush hour takes more a shift, Lunch rush takes 10 to 40% more a minute and has two to three times the walkouts. Neither is better on both counts. Rank 2 is the worst case for a beginner: Lunch is shut early in 18% of shifts, and in 30% with the tray two levels down. Whether a person feels the trade as a choice is not known.

**Did it pass?** No line was recorded before the first nights run; the session record has none. The comparison actually used was coins a minute (the `<` mark in `measure.mjs nights`), under which Lunch is best for every player and the big-dish night was best for none. Stated as coins a shift, the line would be: the night pays most a shift for at least one of the four players (new or good cook, tray low or built) and not for all four. Lunch did not meet it. Rush hour pays more a shift for every player at nearly every rank (the one exception is the new cook with a low tray at rank 2, 188 against 182). Lunch is kept as variety with a measured trade (more a minute, more walkouts, half the time), not as the better night for some player. Lunch also had two tunings (1.7 times pay, then the set price), which is the one retune the stop rules allow.

**In the real page** (browser players at the Fine rank, final rules, five seeds each; targets 260, 410 and 560): Lunch rush took 386, 527, 640, 524 and 587 coins at a good pace and 221, 486, 497, 298 and 495 at a beginner's pace. Rush hour on seed 4242 took 559 and 544. A browser player that only chases the lowest wanted thing took 35, 74 and 149 on Lunch, and once 679. Lunch is hard for a careless player. Only the Fine rank was played in the browser.

**The step 6 checks on Lunch** (`measure.mjs order 30 --night=lunch`, `measure.mjs wheel 40 --night=lunch`, with and without `--off`):

- A still tray takes nothing at every rank (bots). A parked tray (moved once, then left) takes 195, 192, 332, 608 and 720 for the good cook at ranks 1, 2, 4, 7 and 10, which is one star each time and never two. For the new cook it is under one star at ranks 1, 2, 4 and 10 and one star at rank 7. Same open finding as Rush hour.
- The wheel: no action changes Lunch by more than it changes Rush hour. Cook it! is again the strong one for a new cook (+80 at rank 4, +168 at rank 10). Rob at random still shuts the kitchen. Trash has lost its price on Lunch, because the smaller dish pays the same set price; used at random it gains a new cook 16, 36 and 54 coins at ranks 1, 4 and 10 (4 to 10%) and a good cook nothing at rank 4. Left as it is and recorded; it joins Cook it! and Lock out for the retune after a person's shifts.
- Bots run every action at random on both nights and assert the shift ends. (Correction, slice 4: this line was written in slice 3 but the edit that added the Lunch half had matched nothing, so only Rush hour was asserted until slice 4.)

**First-time and early taps** (real page, 390 by 844): a save at rank 1 or above that has never played a Rush sees only the Rush hour button; Lunch appears after one Rush hour, so the first shift still gets the drag hint. A tap on either button while the models are still loading starts that night when loading ends (about six seconds later in the test).

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
- The page steps a shift on render frames and chops with `Math.random()`, while `measure.mjs` uses a fixed step. The same seed is the same guests, not the same shift, on page and script.

### Review of slice 3

One adversarial code review of the diff by another model. Fixed: a second tab's newer record was overwritten by a whole-record write (records are now merged, keeping the higher best and stars); the measuring script could run a night that is not open at that rank (now refused); a start that waited for loading could fire after the player left the menu and came back; the tray kept its position from the last shift; "Again" after a seeded start replayed the saved pick, not the night just played; the end card named the other night. Obsolete: a finding about ticket and rob prices under the 1.7 pay multiplier, removed with the multiplier. Left: the page and script stepping difference above. A second outside review read the set price, the record merge and the menu-visit guard as finally written. Nothing blocked. Checked and rejected: that a second tab can still erase a best (the write rereads storage and merges in one step). Left and recorded: the play count can be one short when two tabs each finish a shift; a hand-damaged record holding a huge best is kept; fight then trash and trash then fight differ by one coin on a rich guest; and two faults older than this slice, a Play tap followed by a Restaurant tap during loading, and the Rush buttons failing without a message when the 3D view cannot start. Not reviewed by an outside reader: the look of the menu and Lunch screens.


### Slice 4: missions inside a shift (2026-11-28)

Row served: progress and missions. A mission is one goal shown when a shift starts and checked at the bell. Every mission also needs one star, so a tray that does nothing completes none. The reward sits outside the star count (a stamp, and coins added after the stars are counted), so no star target moves.

**Pass line, written before the first run.** Each candidate is measured with `node measure.mjs missions 60` for a new and a good cook, on both nights, at the lowest rank where the night opens and at rank 10, with three plans on the same seeds: one that ignores the mission, one built for it, and a parked tray. A mission ships only if all of these hold in most of the eight cells (at least six):

1. the ignoring plan completes it in under 30% of shifts;
2. the built plan completes it at least 20 points more often than the ignoring plan;
3. with the built plan the good cook completes it at least as often as the new cook;
4. a still tray and a parked tray complete it in under 5% of shifts;
5. no wheel action used at random completes it more often than the built plan.

If the built plan takes no fewer coins than the ignoring plan, the mission is called a bonus, not a trade, and that is written next to its numbers. One retune a mission, then it is removed. Excluded before the trial: anything that leans on cooking quality (the scripted beginner's quality is known wrong) and anything that reduces to serving one guest first (the parked question).

**First run** (`node measure.mjs missions 60`, seventeen candidates). Thirteen passed and four failed:

- *Nobody walks out.* The good cook completes it while ignoring it in 67 to 98% of shifts. Failed line 1. Removed.
- *Catch nothing unwanted.* No plan built for it did better than ignoring it. Failed line 2. Removed.
- *Fill the buzz.* The same: 40 against 43%, 85 against 75%. Failed line 2. Removed.
- *Four served in the first forty seconds.* Ignoring it completes it in 65 to 93% of shifts on Lunch and at low ranks, and a parked tray in 63% at one cell. Failed lines 1 and 4. Removed.

**One retune** for two of the thirteen: *use the Microwave* is offered from the Bistro (rank 2), because it needs a moody guest and there are none before; *turn nobody away* is offered from the Bistro, because below it the room is rarely full and ignoring it completed it in 60 to 75% of Rush hours.

**Second run, what ships** (share of shifts completed; coins against the ignoring plan; eight cells each):

| Mission | Ignoring it | Built plan, new cook | Built plan, good cook | Coins against ignoring | Best random action |
|---|---|---|---|---|---|
| Use the Pan | 0% | 93 to 100% | 100% | -51 to +20 | 0% |
| Use Slap | 0% | 88 to 97% | 100% | -28 to +11 | 0% |
| Use the Fridge | 0% | 90 to 93% | 98 to 100% | -20 to +18 | 0% |
| Use Trash | 0% | 83 to 93% | 97 to 100% | -68 to +15 | 0% |
| Use Hire | 0% | 80 to 97% | 98 to 100% | -59 to +69 | 0% |
| Use Kick out | 0% | 83 to 95% | 100% | -67 to +17 | 0% |
| Use Cook it! | 0% | 87 to 95% | 98 to 100% | -35 to +46 | 0% |
| Use Lock out | 0% | 85 to 97% | 97 to 100% | -34 to +110 | 0% |
| Use the Microwave | 0% | 83 to 98% | 98 to 100% | -26 to +51 | 0% |
| Three different actions | 0% | 88 to 98% | 100% | -65 to +34 | 0% |
| Turn nobody away | 0 to 2% | 17 to 77% | 90 to 100% | -18 to +133 | 83% |
| Win a fist fight | 0% | 50 to 65% | 80 to 88% | -41 to +75 | 0% |
| Use Rob | 0% | 85 to 88% | 100% | -66 to +30 | 0% |

Reading, plainly:

- The twelve wheel missions pass lines 1, 2, 4 and 5 by construction: a plan that never opens the wheel cannot complete them. The lines could not fail for them, so their pass says little. What the numbers do show is line 3 (the good cook completes each more often, because of the one-star floor) and the cost: Rob, Kick out, Lock out and Cook it! cost coins in most cells (trades); the Fridge and the Microwave almost never do (bonuses that teach the action).
- *Turn nobody away* is the one mission whose lines could fail, and it passed: nobody completes it by accident, a new cook completes it in 17 to 77% of shifts and a good cook in 90 to 100%. The random-action figure is high because locking the door or kicking someone out at random are the two routes to it.
- A finding outside the missions: Lock out used whenever the room is full gains a good cook 87 coins a Rush hour and 120 a Lunch at rank 10. Slice 2 measured Lock out as dead with a different trigger. The action was fine and the trigger was wrong, the same fault as in slice 2. Lock out leaves the "may be dead" list; it may now be strong, and gets its one retune after a person's shifts.
- Their purpose is the recorded fact from before the rebuild: one action was taken thirty times and the others almost never. Whether a person enjoys being sent to the other ten is not known.

**In the page.** From the fourth Rush a shift shows one mission: a line at the start, a chip under the tickets (a target, then a tick, or struck out once it cannot be done), and a line on the end card with the coins. The mission is the next one not yet done, in a fixed order from plain to costly, one step along each shift so a hard one is not offered twice running. It pays a fifth of the one-star target (50 coins at the Fine rank), added after the stars are counted, and only with one star. Done missions are kept in `kitchen-rush.done` and merged across tabs like the bests. `rec` start and end carry the mission, whether it was done, whether its condition held without the star, and the actions used. The hook is `kitchenRush(seed, night, mission)`.

**Real page** (390 by 844 English, 320 by 568 Turkish): the menu's pick after three plays is Use the Pan; the chip sits under the tickets at both sizes and is not cut; banging the pan ticks it; the end card shows "+50" with a star and "needs one star" without one, and still fits; a kept mission shows green until broken; three turns spent elsewhere strikes it out; pause and Menu clear the chip and do not count the shift; a damaged record (text, a huge number, an unknown id) is read safely; under three plays no mission is shown. No page errors.

**Review of slice 4.** One adversarial code review and one cold read of six screenshots, by two other models.

- Fixed from the code review: the Microwave mission could meet no moody guest in a whole shift (now the second plain guest onward is moody if none has come; the row above is measured with that); the chip covered "Keep cooking" on the pause screen of a small phone (hidden while paused); "three different actions" stayed open after two turns on one action (now struck out); a second tab's plays and done missions were not read before a mission was chosen (now merged at the start of a shift); the test hook accepted an inherited property name as a mission.
- Fixed from the cold read: the reader understood the mission, the star it also needs and the 50 coins, but not where the Pan is, so the start line now says "(tap a ticket)"; the chip now shows a hollow star while the mission holds but the star is still owed, and the coins once both are met; the start banner sits a line lower so the chip does not cover it.
- Checked and rejected: that merging can erase a done mission (the merge keeps the higher count and is one synchronous step).
- Left and recorded: the count of times a mission was done can be one short when two tabs each finish it (only "done at least once" is used); two tabs that each add coins to the wallet overwrite each other, which is older than the rebuild; the cold reader could not tell what the red dot on Lunch rush means or how the two nights differ from the menu alone; the end card does not say why the doors shut early.

**Open after slice 4**

- No person has played a shift with a mission.
- There is no reward for a full card beyond the count. Two blind outside answers both proposed a cosmetic (a tray or knife skin) for stamps.
- Both blind answers proposed missions with a follow-through (freeze a guest and serve them before they thaw; win a fight, then serve three without a walkout). None was built; they are the next candidates if the plain ones feel like chores.
- Trash on Lunch, Cook it! and now Lock out wait for one retune each after a person's shifts.

### Slice 5: guests as people in the room (2026-11-28)

Until now a guest in a Rush was a ticket. This slice draws each guest in the line as a person standing in front of the
counter, under the tray, with a ring over their head in their ticket's colour (the same ring that marks their food in
the sky). It changes no rule: `shift.js` and `sim.js` are not touched.

**Pass line, written before the trial** (a staging test with three still people came first, to learn whether people fit
in the catching view at all; nothing else was built or measured before this line):

1. From one 320 by 568 screenshot with three guests, an outside reader who has not seen the game matches every person
   to their ticket, on two different screenshots.
2. At 320 by 568, 390 by 844 and 1280 by 720 no ring or head is drawn over the tray, and each waiting person's eyes are
   on screen.
3. With people on, the median frame time on the real page is within 15% of people off, same seed, same machine.
4. `node bots.mjs` prints the same as before, and the rule files have no diff.
5. While catching, the number of people equals the length of the line once arrivals have walked in; it is zero on the
   menu, on the end card and after pause then Menu; the renderer's geometry and texture counts do not grow from the
   first shift to the third.

**What was built.** Each guest in a Rush or Lunch line is a person standing in front of the counter, under the tray,
facing the camera, with a ring over their head in the colour of their ticket and of their food in the sky. Tickets stay
the control; people are not tappable. A wheel action plays its stunt from the ordinary day on that person (slap, fridge,
pan, microwave, trash, kick out, rob, hire) with the shift still running: no camera cut and no hold. A guest whose food
is cooking waits at the pass and leaves happy when served. The ticket rail is now one column per seat, so ticket order
and people order agree. Setting on the pause card: Guests shown (default) or tickets only, stored as `kitchen-people`
and sent with each shift's start record. Rules, pay and bots are unchanged.

**Results against the pass line.**

1. Passed. Two outside readers each matched three of three people to tickets on both screenshots, one of which had
   tickets in a different order from the people (taken before the rail was put in seat order).
2. Passed on both phones (no ring over the tray in any sample across three shifts each). **Failed at 1280 by 720:**
   about 0.3 world units show under the tray there, so only hair and rings show and no eyes. A ring was also drawn over
   the tray line in 111 to 135 samples a shift, because the lift was worked out while the camera was still moving; it
   now waits for the camera to settle, and the last wide walk had none in three shifts. Two retunes (people at 0.66 and at 0.5 of phone height) did not fix it; stopped under
   the stop rule and kept 0.66. Fixed later the same day by moving the camera, not the person: see "Wide screens,
   third attempt" below.
3. Median frame time 16.7 ms and 95th percentile 16.7 to 16.8 ms with people on and off. The test page is capped at
   60 frames a second, so this shows no drop on this machine and nothing about a slow phone.
4. Passed.
5. Passed after a fix. Texture count grew every shift (79, 101, 116) because each cloned guest owns a bone texture that
   was never freed; this leak was older than the slice and also ran in ordinary days. Freed on removal: the count is now
   level across three shifts (72, 73, 73 and 74, 75, 75). Models are zero on the menu, the end card and after quitting.

**Outside code review (two reviewers), fixed:** a stunt that spawns sparks kept spawning every paused frame; stunts
outlived a removed guest; the setting turned off in another tab stranded models; two wall-clock timers ran through a
pause (now on the game clock); a second wheel action on a guest mid-show lost its show (the next one now waits; a
third replaces it); a floor ring stayed
when a model failed to load. Exercised through the real page after the fixes: pause during a Pan hop (spark count 14 and
14 two seconds apart), Guests switched off and on from the pause card (models 3, 0, 3), a second action on a guest
mid-show, quit during a Fridge stunt (models and sparks zero), and Fridge, Kick out and Pan in an ordinary day (the day
carries on). Changed but not exercised: the setting changed in another tab, and a model that fails to load.
**Not fixed:** turning Guests off and on again while a dish is cooking does not bring back
the guest waiting at the pass (the ticket and the pay are unaffected).

**Dropped or changed on the way.** Full-size people (hid the counter and the tray on phones); floor rings as the only
marker (the floor is off screen on phones, so the ring moved over the head); the lying-down spin for Cook it! and Lock
out (it read as a knockout; now a head shake); tickets drawn over the pause card at 320 by 568 (rail hidden when not
playing).

**Not shown.** No person has played with the people on. Whether they make the choice of guest feel more like a choice
is the open question for the owner.

**Wide screens, third attempt (same day).** The first two retunes shrank the person. The cause was the camera: the
catching view puts the tray a fifth of the way up whatever the screen, and a short screen shows almost nothing under
it. Stepping the camera back alone changed nothing (the fifth stays a fifth). What worked: on any screen wider than 0.6
of its height (landscape, tablets, desktop windows), with Guests shown, the catching camera steps back by a fifth and
aims lower so the tray sits near the middle, and guests are lifted until their shoulders show. Tall phones are
untouched. Line 2 of the pass line now passes at the sizes staged: faces show at 1280 by 720, 1920 by 1080, 1024 by
768, 844 by 390, 768 by 1024, 800 by 900 and 600 by 900. Full walks at 1280 by 720, 844 by 390, 768 by 1024 and 320 by
568: no ring over the tray in three shifts each, all nine wheel actions accepted, models zero after quit, no errors.

Also checked on a wide screen: the tray is back at its ordinary height in an ordinary day after a Rush is quit, after
Guests is switched off, and when a Rush starts with Guests off; switching Guests on mid-shift moves the camera and
lifts the guests; pause during a stunt keeps the spark count flat. Turning a phone mid-shift, both ways, rebuilds the
guests at the right height (they walk in again). That walk also found a page error older than this slice: quitting an
ordinary day while a guest was still walking in. Fixed.

Cost, for the owner to judge: on a wide screen a Rush with Guests shown has a tray and food about a fifth smaller than
an ordinary day, and food now starts at the top edge of the screen, so in the middle fifth of the width it is behind
the tickets for roughly the first third of its fall (an estimate from the layout, not measured; bots cannot see it).
Tickets only gives the old view. A guest walking in passes close to the camera on a wide screen and fills a corner for
a moment.

### Slice 6: a reward for the mission card (2026-11-28)

Slice 4 left the card with a count and nothing else. Two blind outside answers there both proposed a cosmetic for
stamps. The reward is a tray, because the tray is on screen in every catch: an enamel tray at six missions and a golden
tray for every mission open at the player's rank. Once earned a tray is kept (stored in its own key, `kitchen-tray`),
so a rank that opens a new mission does not take it back. It pays nothing and changes no rule.

**Pass line, written before the build** (only lines that could fail are counted):

1. Reachable: a scripted player who plays for each shift's mission fills the card within 40 shifts in every one of 30
   runs, for a new and a good cook, on both nights, at ranks 0, 2 and 10 (`node measure.mjs card 30`).
2. From a 320 by 568 catch screenshot, an outside reader who is shown the three trays' names picks which tray is in
   use, in two looks.
3. The end card's new-tray line is not cut at 320 by 568 in Turkish, beside the mission lines.
4. On each tray, food on the tray and the orange and yellow seat rings read as clearly as on wood (outside read).

Not counted, because it cannot fail: a tray that does nothing earns no stamps (already asserted in bots).

**Results.**

1. Reachable: **pass.** Median 11 to 20 shifts to a full card; the worst run was 32 (rank 10, new cook, Rush hour,
   where "turn nobody away" falls last in 23 of 30 runs). No run was stuck. Eleven missions are open at ranks 0 and
   1, thirteen from rank 2.
2. Naming the tray in use: **miss for wood.** Shuffled 320 by 568 shots under neutral file names (three trays,
   Sunny diner and Toon), one shot an ask, two outside readers. Enamel 2 of 2 and golden 4 of 4, each "very sure".
   Wood was named right in 1 of 4 reads of the same two shots, and called golden in the other three: wood is a warm
   amber, and a reader who sees one shot cannot compare. A player sees the tray change. Left as a miss. One retune
   of the golden tray (dark floor, bright rim) was tried and taken back: readers still said yellow food blends into
   it, and it looked less like a prize. The retune did not touch wood, so it could not have moved the wood reads;
   the two rounds differed only in which reader saw which wood shot.
3. End card at 320 by 568 in Turkish: **pass.** "Yeni tepsi: Emaye" at the sixth stamp and "Yeni tepsi: Altın" at
   the thirteenth, neither cut, each under the mission line and the count. Walked through the real page: the tray is
   owned and in use on the end card, still there after a reload; a failed mission earns nothing; junk in storage
   falls back to wood.
4. Food and rings on each tray: **part.** Rings were named right in all ten reads. On teal, "the food stands out".
   On golden, both readers said a yellow item blends into the tray; one said the same of a lemon on wood. Golden is
   no better than wood here and may be a little worse for yellow food.

The first golden (metal 0.8) rendered dark olive in Sunny diner, because the scene has no sky to reflect. It is now a
plain bright yellow that glows a little. Found by looking at the shot, not by any check.

Not shown: nobody has earned a tray by playing. No shot had a yellow seat ring beside the golden tray, the pair most
likely to fail line 4. The golden walk used the pan mission as the last stamp; the slap mission, which ended ✗ in an
earlier walk, was then played to its end card through the real page and stamped ("✓ Use Slap +50"), so that ✗ was the
walk and not the game.

The shop's Trays box, walked at 320 by 568 in Turkish and English with one, two and three trays owned: no label is
cut ("13 görevin hepsi", "All 13 missions"), a locked tray does nothing when tapped, an owned one is put in use, the
list does not jump, and the box is absent before the first Rush.

**Outside review of the wide-screen change, after it merged.** That change merged before its outside code review and
outside read came back. They found four faults, all fixed here:

- Turning the phone while a dish cooked deleted the guest waiting at the pass. Guests are still rebuilt on a turn,
  but the one whose food is on the board is rebuilt too and walks to the pass. This also fixes the same loss when
  Guests is switched off and on while cooking. Seated guests still walk in again from the door after a turn.
- The camera stepped back even when no guest model had loaded. It now steps back when the first guest stands there.
- On a screen between 0.62 and about 1.18 wide for its height the step back changed the aim but not the distance.
  Both now use one number. Pass line for this trial: faces show at every size staged before, and the outer guests
  are not cut at 768 by 1024. Staged at thirteen sizes, six of them wide: pass. A tablet now shows whole guests.
- A window resized on the menu did not remember which side of the line it was on. It is sampled on every resize.

The advisor's question found one more before it shipped: the lower edge of the two-edge switch (0.56) sat under a
16:9 phone held upright (0.5625), so a phone turned and turned back would have stayed in the wide class. The edges
are now 0.575 and 0.63. Staged 320 by 568, 360 by 640 and 390 by 660 arriving from landscape: faces show.

Checks on this tree: bots ok; phone check on Chromium and WebKit; full walks at 320 by 568, 1280 by 720 and 768 by
1024 with no errors, no halo over the tray and no models left after quitting; a turn mid-cook leaves four people
(three seated, one at the pass).

Left from the outside read: on a wide screen a guest's ring can overlap a neighbour's falling food ring; on a tablet
the tickets sit over the kitchen sign and the pan and register are off screen while catching.

**Outside code review of this slice, before it merged.** Eight findings, all fixed: a second tab could write an
earned tray away (the store now merges with what is saved); stamps from before trays existed did not count until the
next Rush (counted when the page loads; walked: six old stamps give the enamel tray at once); a tray skin replaced
the Toon outline (seen back in a shot); a guest rebuilt at the pass stayed counted when its model failed; a tray
given by the game was recorded as a setting the player chose; the setting and the run record used two names (both
`trayskin` now); the end card played its sound twice with a new tray; and, older than this slice, a guest walking
to a seat in an ordinary day arrived on the menu after quitting. Not rechecked by a walk: the second tab, the failed
model, and the sound. Guests switched off and back on while cooking is fixed by the same code as the turn, but only
the turn was walked, and neither was played on to the serve.

### Stop adding: the whole Rush journey read cold (2026-11-28)

**Play records first.** One run by a person on the day the Rush work shipped: 43 seconds of an ordinary day on a
desktop, before the first Rush slice was live. No person has played a Rush, so every retune that waits on a person's
shift still waits.

**Pass line, written before the shots were read.** From nine shots of one sitting, in order (menu, Rush start, catch,
a ticket's sheet, chopping, after a serve, end card, shop, shop at the trays), each of two outside readers, on a
phone (390 by 844) and a wide screen (1280 by 720), can say: what to do on the catch screen; what the ticket sheet
is for; what the mission was and whether it was done; how to change the tray. Anything they call broken is ranked by
how many of the four reads name it.

**Result: pass on all four questions in all four reads.** Ranked complaints:

| named in | complaint | done |
|---|---|---|
| 4 of 4 | knives and trays are hard to find under the shop's list, which is cut by the footer | a row at the top of the list jumps to each box; on a screen under 640 px tall the whole card scrolls and the two buttons share a row (the list was a strip 124 px tall at 320 by 568) |
| 4 of 4 | ingredient icons on tickets are small and pale | missing ingredients drawn stronger (opacity .38 to .62, less grey) |
| 4 of 4 | nothing on the Rush screens shows how to move the tray or aim the knife | not changed: the ordinary day teaches both before Rush hour opens; the shots started from a save past that |
| 3 of 4 | the menu's privacy line names a tick box that is not on that screen | not changed here: the line and the box are the shared kit's; the box is on the pause card |
| 3 of 4 | the mission line covers the tray or the sign when a shift starts | not changed |
| 2 of 4 | "Chop!" and the fading stars overlap the kitchen sign; rings overlap halos on wide | not changed |

**Re-read of the fixed screens** (320 by 568, both readers, new shots): both said they would tap the Trays row to
change the tray and read the three trays and what the locked ones need. Both now named most ticket ingredients
(potatoes, cabbage, turnips or onions); one thin sandwich ingredient was still not named, and both still called the
icons tiny. Not tested: telling a caught ingredient from a missing one, since the shot had none caught yet.

Checks: bots ok; phone check on Chromium and WebKit; the shop walk in two languages; the journey walk at 320 by 568
(English and Turkish), 390 by 844 and 1280 by 720 with no errors.

The scripts behind this file's claims are now in `walks/`.

Outside code review of this pass, read before merging: four findings. Fixed: the footer's two buttons wrap on a
screen narrower than they are; keyboard focus follows a jump. Not fixed: resizing across 640 px of height while
scrolled loses the place in the shop; buying the last level a rank needs moves that card to the end of the list
(older than this pass).

### The owner played two Rush shifts (2026-11-28): what the records say, and the first fixes

**Records.** One Rush hour and one Lunch rush, on a phone, at rank 1, the first and second Rush shifts on that save. Both
ended on three stars (427 and 400 coins against three-star lines of 385 and 300), 14 and 15 served, one walkout in all,
three guests turned away at Lunch. No wheel action was used in either. Missions start at the fourth shift, so none was
seen. So: the star lines set from the scripted player are too low for a person at rank 1, the wheel was not needed, and
the two nights played alike. One fry in the Rush hour was lifted after a tenth of a second, pressed again a tenth later,
and scored 0.35: the lift had ended the dish.

**The owner's asks, and what changed here.**

| ask | change |
|---|---|
| the register visit in a Rush feels redundant | a Rush dish no longer swings the camera to the register side: the pay floats up at the stove and the sky is back about 0.7 s sooner (the wait after a cooking step is 0.55 s, was 1.0 s; the plate pause is gone) |
| dim the ring of the second one when catching the first makes it redundant | rings are claimed lowest first by the most urgent guest who lacks the ingredient; one more than anybody lacks is a spare and its ring is faint and smaller |
| blink the urgent orders | under 30% patience a ticket blinks red, its guest's halo blinks and the rings on its food pulse (was a pulse on the ticket under 20%) |
| catch two that land almost together | an item can be scooped for 0.07 of the lane's height under the tray top (`TUNE.catchBand`), about 0.1 s at Rush speed; applies to the ordinary day too |
| the fry meter should be more prominent, at the top | every cooking meter sits at the top, wider, under the tickets in a Rush; the banner drops under it while it shows |
| do not end the fry at once when undercooked | lifting before the green starts 0.3 s of grace; pressing again keeps cooking; left alone it ends as before. Lifting in or past the green ends at once, as before |
| catching needs more speed, growing with the story, 1.5x in a Rush | a Pace setting (`kitchen-pace`): calm is the old speed; lively (default) is 1.1x on an ordinary day plus 0.03 a story beat seen up to 1.5x, and 1.5x in a Rush; wild adds 0.35. In a Rush only the fall is faster, not how often things drop, so the star lines do not inflate. Recorded at every run start as `pace` |

**Checked.** `bots.mjs`: a tray that never moves takes nothing at pace 1.5 and 1.85 at every rank on both nights; the
band scoops a late tray, not a later one, and an 83 ms frame does not tunnel. Through the real page at 390 by 844 and at
320 by 568 in Turkish (`walks/fixes.mjs`): press again inside the grace keeps cooking, left alone it ends; an urgent
ticket alternates two colours; a spare ring was seen; plate to sky 0.15 s; no page errors. Shots looked at.

**Not done here.** The star lines are still the old ones, so a Rush is still too easy; they are retuned with the ladder
(next). The scripted player has not been re-timed at the faster fall. No person has played this build.

**Outside code review of these fixes (before merge).** Ten findings. Fixed: a second finger or key still holding the pan
no longer starts the grace, and a pause counts as a lift; a ring now shows the guest who would really get the item (two
of one thing falling level share a claim, and only what can still be caught claims); an urgent halo comes back on when
its guest stops waiting; the meter no longer paints over the pause card; `body.nerve` is cleared on quit. Older faults
fixed in passing: the card after an unwanted catch ran on a wall-clock timer that a pause could swallow, leaving an
ordinary day stuck; it is on the game clock now. Not fixed, written down: a Pace change made in the pause card applies
from the next shift, not the next pair; an unwanted item caught as the last guest walks out can be counted as missed;
a rude guest's splat can land on the end card.


### One Rush, a ladder of shifts (2026-11-28)

The owner, after two Rush shifts: both nights look good but differ little; make it one continuous Rush with
progressively harder missions that open with the story. Two outside designers, asked blind, both proposed the same
shape: one two-minute format, about twelve rungs, clear the rung's goal to move up, gated by rank.

**Pass line (written after the calibration below and before the page was built).**
1. A still tray earns nothing and clears no shift, at any rank, at pace 1.5 and 1.85.
2. A sharp scripted cook, without the wheel, gets three stars on some shifts and misses them on others: between 15% and
   85% of shifts on both nights at ranks 0 to 4. The old lines failed this: the owner took three stars on both first tries.
3. A new scripted cook gets one star on at least 75% of shifts and three on at most 10%.
4. A new cook who means to do each mission clears every shift within six tries. Nothing blocks for good.
5. A save from before the ladder (two plays, stars on both nights, no rung) loads, starts at shift 1 and keeps its
   bests, stars, stamps and trays.

**Calibration.** The owner's two shifts (rank 1, pace 1): 427 coins in a Rush hour and 400 in a Lunch rush. The old
"good" scripted cook's middle half was 281 to 379 and 267 to 336, so both sat above it: the player model was too weak,
and "three stars is a good cook's average" was too low. A `sharp` cook was added to `measure.mjs` (reacts in 0.18 s,
cooks in 0.75 of the time); its middle half at pace 1 is 360 to 421 and 345 to 432. The 427 sits a little above it.
Two shifts from one person, both from before the faster fall: nothing here is fitted tighter than a quartile.

**Star lines** (`node measure.mjs lines 60`, at pace 1.5, the default): one star is 0.88 of a new cook's lower quarter,
three stars a sharp cook's average, two a little past half way. At rank 1 a Rush hour went from 190/295/385 to
195/315/415 and a Lunch rush from 150/225/300 to 165/335/470. The lines are measured at the default pace only: on Calm
(pace 1) three stars is harder, which is not measured.

**The ladder** (`shift.js` `LADDER`). Twelve shifts. A shift is a night (Rush hour or Lunch rush), a mission and the
stars needed to move up. The Rush button plays the next shift not yet cleared; a row of pips under it replays a cleared
one. Lunch is no longer a separate button: it is shifts 4, 6, 8, 10 and 12.

| shift | night | mission | stars | opens at rank |
|---|---|---|---|---|
| 1 | rush | none (so the first hint is alone on the screen) | 1 | 0 |
| 2 | rush | pan | 1 | 0 |
| 3 | rush | slap | 2 | 0 |
| 4 | lunch | fridge | 1 | 1 |
| 5 | rush | swap the order (trash) | 2 | 1 |
| 6 | lunch | hire | 2 | 1 |
| 7 | rush | microwave | 2 | 2 |
| 8 | lunch | kick out | 2 | 2 |
| 9 | rush | make them cook | 3 | 2 |
| 10 | lunch | lock the door | 2 | 3 |
| 11 | rush | three different actions | 3 | 3 |
| 12 | lunch | win a fist fight | 3 | 3 |

Past the last open shift the button plays an open shift: a Rush hour with the next mission not yet done, as before, so
the two missions not on the ladder (turn nobody away, rob) still come round and the golden tray's "all" is unchanged.
A stuck player is let through: every two failed tries the stars needed drop by one, and after four the mission is
waived. Measured (`node measure.mjs ladder 60`, a player who uses the mission's action the first time it is allowed):
a good cook clears a two-star shift first try on 60 to 90% of shifts and a three-star shift on about 10%; a sharp cook
28 to 57% on the three-star shifts; a new cook clears the one-star shifts first try and the others once eased.
"Turn nobody away" was tried as shift 7 and dropped: a sharp cook held it on 18 to 55% of shifts, which is luck in who
arrives, not skill.

**What a rung does not do yet.** No new rules: every shift is one of the two existing nights. The consults' rule ideas
(a marked guest who pays double if served first, a standby guest who takes a walkout's seat, a precision cooking bonus,
double pay in the last twenty seconds) each need their own measurement and are not built.

**Recording.** `start` and `end` carry `rung` (1 to 12, 0 for an open shift), `need`, and `end` adds `cleared` and
`rungUp`. `kitchen-rush` gains `rung`, `fails` and `rungs`; nothing is renamed, and two tabs merge by the larger value.

**Checked.** `bots.mjs` asserts the pass line. Through the real page (`walks/ladder.mjs`) at 390 by 844, at 320 by 568
in Turkish and as a first-ever Rush: an old-shaped save starts at shift 1 with seven pips (six open, one locked) and
keeps its bests and stars; shift 1 shows the drag hint alone on a first Rush; clearing it offers shift 2 with the pan
mission; the pan mission clears shift 2; the locked pip says which rank opens it; a cleared pip replays its shift; no
page errors. Shots looked at; at 320 wide the banner wrapped over the sign and the end card grew past the screen, both
fixed and re-shot. Phone check passes in both browsers.

**Not checked.** No person has played the ladder. Shifts 3 to 12 were not played through the page, only by the scripted
cooks. The walk's own player (it follows the lowest wanted item) took 278 to 388 coins at rank 1, one or two stars.
