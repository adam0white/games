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

Menu **Look** button cycles them, or `?look=diner|toon|night|clay`: Sunny diner (default), Cartoon (toon shading and ink outlines), Night market (dusk sky, string lights), Clay (soft, low saturation).

## Difficulty (bots.mjs)

`node bots.mjs` plays 60 catches per stage with a "new" and a "good" bot. Clean = share of catches with no extra. Cart: about 0.92. Diner: about 0.9. Bistro: 0.7. Restaurant: about 0.33. Fine dining and five stars: about 0.2. Tuning lives in `TUNE` in `sim.js`. These numbers are the first guess; Adam's play sets the real curve.

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
