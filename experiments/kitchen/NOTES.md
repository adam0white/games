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

Telemetry for every setting: the event `setting {name, from, to, where}` for look, tool, sound, music and lang. Every run's start
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
