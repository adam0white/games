# Lantern notes

## 2026-11-22: first outside play notes

One tester played the 2026-11-22 build on a phone and gave spoken notes. The owner passed them on. The tester liked the game and wants it developed.

| Note | Done in this change | Left as a proposal |
| --- | --- | --- |
| The boat jumps to wherever the finger lands; a stray tap ends the run | A finger steers by how far it has moved since touch-down (`?gain=` sets the ratio, default 1.3). A tap does nothing. A mouse still steers by position | Tilt steering |
| Embers feel pointless; the dark always comes back | An ember gives 0.3 light (was 0.2), holds the flame for 2.5 s, and the lit circle grows more per unit of light | Embers as currency |
| A light that helps more | Blue ember: a shield that takes one hit from a rock, ice or the bank | |
| It does not get harder | Speed doubles over a night (was 1.8 times); rocks start to swing past halfway; the river pinches in the last tenth | |
| Nothing after winning | Nights: dawn opens the next night. Night 2 adds drifting ice, night 3 more swinging rocks, every night is 8% faster. The night reached is saved; `?night=1` starts over | Shop, coins, boat skins, extra life, smaller boat, hand-made levels |
| A phone call loses the run | Pause button, P or Escape, and pause when the page loses the screen | |

Checks: `node bots.mjs 200` plays three bot policies on nights 1 to 3. `node bots.mjs 200 audit` rides a ghost boat down 200 rivers per night and prints the narrowest free gap, so an impassable river shows up. Result on this change: narrowest gap 0.028 river widths (night 2, one river in 200 under 0.03), no closed river on nights 1 to 8.

Not verified: feel and sound on a real phone; pause on a real incoming call. Bot results show how runs end, not how hard the game is for a person.

## Second round of notes from the same tester, 2026-11-22

The tester liked round one and asked for the game to grow. Built in this round:

| Note | What changed |
| --- | --- |
| A menu with a Play button, a shop and credits | Menu screen with Play night N, Endless river, Shop and Credits. End and pause cards have buttons. |
| Embers as money; a shop that sells packs of about 50, each giving a random thing | Embers from every run go to a bank. Three packs (Boats, Waters, Flames), five things in each, 50 embers a pack, one random thing you do not own yet. |
| Hearts on screen; a red pickup that gives a life | Hearts at the top left. A red heart pickup gives a spare life, up to three. Blue is still the shield. |
| Big numbers for embers and score; percent in story | Ember count top left; percent (story) or score (endless, 10 a second) top centre. |
| Some embers sit inside rocks | Every pickup is checked against each rock's whole travel when it is placed, and removed if a later rock would cover it. `bots.mjs audit` counts buried pickups: 0 in 300 rivers per night. |
| Rocks should also move up and down | From night 4 some rocks ride up and down the current. |
| A waterfall near halfway | From night 5 a stretch of fast white water at 50%; every 60 units on the endless river. |
| Story of at least 20 nights, each harder | 20 nights. Nights 2, 3, 4 and 5 add ice, swinging rocks, rocks that ride the current and the waterfall. Nights 6 to 20 are faster and denser only. Any opened night can be replayed. |
| Endless mode, harder every 300 or 500 | Endless river: no dawn, harder every 300 points, hazards arrive in the story's order, narrower over time. |
| A big red warning when the light is low | "The lantern is beginning to fade" below 28% light. |

Also changed: ice no longer closes the channel against the next row (the audit found one closed river in 200 on night 5 before this), and just after a blow the bank holds the boat in rather than taking a second life.

The endless river was audited on 10 seeds out to 30 river lengths, past its last step harder: narrowest gap 0.042, no buried pickup. Bots pick up about 0.5 to 1.5 hearts and shields a run.

Left as proposals: a tower mode, custom matches where the player picks the obstacles, wrecks of earlier boats as obstacles, a new hazard on every one of the 20 nights, and menus and shops for the other two prototypes.

Checked in Chromium with an iPhone profile: menu, night picker, buying two packs, the refusal at 20 embers, saved shop state after reload, story run, pause and menu, endless run to its end card, waterfall, hearts, the warning, relative steering, dawn opening the next night. Not checked: a real phone, sound, how hard nights 6 to 20 feel to a person, and whether 50 embers a pack is the right price (bots take about 8 to 16 embers a run).

## 2026-11-22: tester t1's answers and requests (notes #27, #28, #29, #33, #35)

Answers to the lab's questions:

- Steering by finger slide: "very good" (#27). Keep it.
- Difficulty: reached night 5; fairly hard up to there; do not change the difficulty (#28).
- Which idea next: a new obstacle every night (#29). Build it without making nights 1 to 5 harder than now.
- Which game gets the most work: Lantern and Ant Promotion (#33). See `prototypes/NOTES.md`.

### Left as a proposal (2026-11-22, note #35)

One long request for the next Lantern round. Nothing of it is built yet.

- More power-ups. Named: a boost; a slow-down for the boat that leaves the percent counter running at the same speed; a shrink power, like the shield, that makes the boat smaller 80% of the time and bigger 20% of the time.
- Stats to spend points on: barrier (shield) strength, lives, game speed, and others at the lab's choice.
- Tower mode: the river climbs upward first; when it finally runs straight, you reach dawn. (Tower mode was already a proposal; this describes it.)
- Better-looking boats and flames: different models, less plain colours.
- A fourth shop pack, "Abilities", that sells the powers above. Packs should also keep selling looks for flames, boats and water.
- Pack opening animation: the pick hops from one hidden item to another, and when it settles the whole screen lights up in that item's colour.
