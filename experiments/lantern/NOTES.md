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

Left as proposals: a tower mode, custom matches where the player picks the obstacles, wrecks of earlier boats as obstacles, a new hazard on every one of the 20 nights, and menus and shops for the other two experiments.

Checked in Chromium with an iPhone profile: menu, night picker, buying two packs, the refusal at 20 embers, saved shop state after reload, story run, pause and menu, endless run to its end card, waterfall, hearts, the warning, relative steering, dawn opening the next night. Not checked: a real phone, sound, how hard nights 6 to 20 feel to a person, and whether 50 embers a pack is the right price (bots take about 8 to 16 embers a run).

## 2026-11-22: tester t1's answers and requests (notes #27, #28, #29, #33, #35)

Answers to the lab's questions:

- Steering by finger slide: "very good" (#27). Keep it.
- Difficulty: reached night 5; fairly hard up to there; do not change the difficulty (#28).
- Which idea next: a new obstacle every night (#29). Build it without making nights 1 to 5 harder than now.
- Which game gets the most work: Lantern and Ant Promotion (#33). See `experiments/NOTES.md`.

### Left as a proposal (2026-11-22, note #35)

One long request for the next Lantern round. Nothing of it is built yet.

- More power-ups. Named: a boost; a slow-down for the boat that leaves the percent counter running at the same speed; a shrink power, like the shield, that makes the boat smaller 80% of the time and bigger 20% of the time.
- Stats to spend points on: barrier (shield) strength, lives, game speed, and others at the lab's choice.
- Tower mode: the river climbs upward first; when it finally runs straight, you reach dawn. (Tower mode was already a proposal; this describes it.)
- Better-looking boats and flames: different models, less plain colours.
- A fourth shop pack, "Abilities", that sells the powers above. Packs should also keep selling looks for flames, boats and water.
- Pack opening animation: the pick hops from one hidden item to another, and when it settles the whole screen lights up in that item's colour.

## 2026-11-23: a new thing every night (note #29, first item of note #35's order)

Nights 6 to 20 each add one new thing; it shows up most on its own night and stays for the nights after. The endless river gets them in the same order, one step every 300 points.

| Night | New thing | Rule |
| --- | --- | --- |
| 6 | Logs | A trunk lies out from one bank. |
| 7 | Fog | Stretches where the boat sees 60% as far. |
| 8 | Whirlpools | Pull the boat sideways within 0.16; the centre is a blow. |
| 9 | Side wind | Stretches that push the boat at about a quarter of its own sideways speed. |
| 10 | False embers | Flicker green; taking one costs 0.2 light. |
| 11 | Gates | Trunks from both banks with one gap of 0.15. |
| 12 | Rocks that follow | Drift toward the boat at 0.08 a second; red eyes. |
| 13 | Rain | Stretches where the flame fades 1.6 times as fast. |
| 14 | Sliding ice | Some ice also slides from side to side. |
| 15 | Hidden rocks | Only a ripple shows until the rock is 0.45 away. |
| 16 | Second waterfall | At 80%. |
| 17 | Spinning rocks | Two rocks turning about a point near one bank. |
| 18 | Geysers | Deadly only while they blow; a dashed ring while they rest. |
| 19 | Lightning | Every nine seconds: a flash, then two seconds of seeing 60% as far. |
| 20 | Islands | A line of rocks down the middle of the river. |

Nights 1 to 5 are unchanged, as the tester asked: the same seeds give the same rivers as before (a fingerprint over 200 rivers matched). `bots.mjs 200 audit` on nights 1 to 20 and the endless river: no closed river (narrowest gap 0.048 on story nights, 0.038 endless), no buried pickup. Each new thing was seen in a Chromium phone-profile screenshot.

Fog, wind and rain each start their first stretch about a tenth of the way down, so a short run still meets the night's new thing. Seven of the fifteen are not solid obstacles (fog, wind, false embers, rain, sliding ice, the second waterfall, lightning); the tester may want some swapped for solid ones.

Not checked: whether nights 6 to 20 are too hard for a person now that they are faster and also hold new things (the careful bot's runs that end in the dark on night 20 rose from 21 to 49 in 100); a real phone; sound.

Still left from note #35, in the tester's order: power-ups, stats to spend points on, better-looking boats and flames, an Abilities pack, the pack-opening animation, tower mode.

## 2026-11-23: powers (note #35, second item)

Three powers lie in open water, about four a night, on every night and the endless river.

| Power | Looks like | Does | Lasts |
|---|---|---|---|
| Boost | gold arrows | the river runs 1.8 times as fast and nothing can break the boat | 2.5 s, then 0.6 s more of safety |
| Slow water | violet clock | the river runs at half speed; the percent to dawn keeps its usual speed, and the flame fades by river passed, not by time | 5 s |
| Size | teal rings | four times in five the boat is 0.6 of its size; one time in five it is 1.4 times its size. The pickup looks the same either way | 6 s |

Decisions taken here, not asked for by the tester: a boost also makes the boat unbreakable (a faster river alone would be a penalty); the size gamble is hidden until taken; an arc round the boat shows the time left; powers are free on every night from night 1 until the Abilities pack exists; a boost on the endless river scores the extra river it covers (8 points a second) without bringing the next step harder any sooner.

How it is built: powers draw from their own random stream and sit in their own list, so a seed's rocks and embers are the same as before. Which power, and whether a size power grows the boat, is fixed when the river is laid down. Ice now drifts by river passed. `create(seed, stage, endless, powers)` takes the list of powers allowed, ready for the Abilities pack.

Checked:
- 440 story rivers (nights 1 to 20 sampled, 40 seeds each) with powers switched off: rocks and embers identical to main.
- With powers on, rocks matched main on all but 3 of 440 story rivers; one of them on night 5. In those a power taken shifted ice by a hair and one later pickup moved. Unresolved, judged harmless.
- Audit, 200 rivers a night, each ridden five ways (no powers, boost only, slow only, all powers, all powers with calm water at its top level) because a power shifts when the boat meets each moving rock: no closed river, no buried pickup of any kind. Narrowest gap on story nights 0.048 for the usual boat and 0.030 for the bigger one; on the endless river, ridden 30 nights long, 0.038 and 0.020.
- Chromium phone profile: each power taken, said aloud and drawn; under slow water the boat covered 0.55 of river in 1.5 s while the percent gained 1.01, the same as without it. No page errors.
- Careful bot, 100 runs, dawn reached before and after: night 1 20 and 23, night 3 20 and 21, night 5 18 and 22. Not tuned.

Not checked: a person playing; a real phone; sound; whether four a night is too many.

## 2026-11-23: stats to spend embers on (note #35, third item)

The shop has a Stats block above the packs. A level costs 40 embers times the level being bought (40, 80, 120). Stats are kept between runs and apply on every night and the endless river.

| Stat | Levels | Each level |
|---|---|---|
| Hearts | 2 | start with one more heart (the most held is still 3) |
| Barrier | 2 | a shield takes one more hit; one blue ring shows for each hit left |
| Calm water | 3 | the river runs 4% slower; the flame fades by river passed, so calm water costs no light |
| Long wick | 3 | the flame fades 8% more slowly |
| Long reach | 3 | embers, gifts and powers are taken from further away (0.05 plus 0.012 a level); false embers are not |

The tester named barrier strength, lives and game speed, and asked for others; long wick and long reach are the lab's additions. Reading taken for "game speed": slower, because a stat should help.

Checked: full stats clamp bad saved values; a full barrier took three hits in the sim; 196 of 200 story rivers are identical with full stats and the other 4 differ by one pickup (same cause as the powers note); in a phone-sized Chromium the shop sold two heart levels for 40 and 80, the Back button stayed on screen, and the next run started with three hearts. No page errors.

Not checked: whether the prices are right; how much easier night 5 is with full stats, for a person.

## 2026-11-23: boats and flames (note #35, fourth item)

The tester asked for different models and less plain colours. Drawing lives in `looks.js` and changes nothing in the run.

- Boats are six different vessels, each shaded as if lit from the left: oak rowboat, red canoe, birch raft, iron barge with lit cabin windows, jade dragon with horns and a moving tail, golden barge with glints. A foam wake follows the boat. The boat is drawn 1.2 times the size it collides at.
- Flames are a small particle simulation that streams out behind the lantern, leans away from a turn and shrinks as the light fades: candle, tight gas jet, slow marsh fire, sparkler that throws sparks, turning star, twin flame wound in a helix.
- Shop buttons show the boat or flame itself, drawn small, in place of a plain colour.

The lab's additions beyond the ask: the wake, the lean and fade of the flame, the shop previews.

Checked: all six boats and flames drawn in a phone-sized Chromium with no page errors, and looked at. Not checked: frame rate on a real phone (about 35 soft particles a frame); whether the tester finds them better.

## 2026-11-23: Abilities pack and the pack opening (note #35, fifth and sixth items)

- A fourth pack, Abilities, holds the powers. A power lies in the river only once it is owned. Boost is owned from the start, as one boat, water and flame are, so a new player meets powers at once; the other four come from the pack. This replaces "powers are free on every night" from the powers note above. The other three packs still sell looks only.
- The pack holds five powers: the tester's three and two from the lab. Magnet (pink): for 7 s embers within 0.32 swim to the boat. Flare (white sun): the flame is filled and does not fade for 6 s.
- Opening any pack: a light hops between the things not yet found, slows, and stops on the find; then the whole screen fills with the find's colour and fades. The pack is paid for and the find saved at the tap, so leaving mid-animation loses nothing, and a second tap during it does nothing.

Checked: in a phone-sized Chromium an Abilities pack cost 50, saved its find, showed the hop and the flash, and the next run laid only that power in the river; two fast taps on another pack charged once. Audit clean with all five powers (an ember a magnet has pulled is left out of the buried-pickup count). No page errors.

Not checked: whether locking powers behind the pack is what the tester meant (to ask); the hop's feel and sound on a phone.

## 2026-11-23: tower climb (note #35, last item)

The tester's words: the river climbs upward first, and when it runs straight you reach dawn. Reading taken: a third way to play beside the story and the endless river.

- The river is walled in stone and climbs in tight turns (about two and a half times as sharp as a story night). The turns ease as it rises and the last 15% runs dead straight into the dawn.
- Ten floors. A dashed ledge with its number cut in the wall marks each one; the game says each floor and saves the best floor reached.
- The tower holds the things of the nights already opened, never fewer than night 3's and never more than night 12's, so it grows with the player and does not hand a new player lightning.
- Reaching the top does not open a story night.

Checked: audit over 200 tower rivers at night 3's and night 12's things, each ridden four ways: narrowest gap 0.057, no buried pickup. Careful bot reached the top 15 and 18 times in 100. Phone-sized Chromium: the menu still fits, a climb ran to the top, the card and best floor were right, the story night stayed where it was. No page errors.

Not checked: whether this is what the tester pictured (to ask); how the sharp turns feel under a thumb.

## Looks taken from the 3D experiment (2026-11-23)

The wildcard lab drew Lantern in 3D (`../lab/lantern-3d/`, log in `../lab/NOTES.md`). Four of its looks are now drawn flat in this game, in `looks.js`. Nothing in `sim.js` changed, so rivers, collisions and difficulty are the same.

- **Reeds** (`reeds`). Blades stand on both banks, rooted outside the water's edge and leaning away from it, so they never cover water. They are drawn twice: dark under the night, then the blades inside the lantern's circle again with the flame's colour over the night. The tower keeps its stone kerb and has no reeds.
- **Pickup lights on the water** (`shine`). Each ember, wisp, heart, shield and power lays a shimmering streak of its colour down the screen. A false ember's streak is fainter, as its glow is.
- **Shield glow** (`halo`). A blue halo lies on the water under the shield rings, half strength while the boat blinks after a blow.
- **Dawn flood** (`flood`). From 86% a low sun shows past the top edge. At dawn its light pours down the screen, then settles within 2.5 s so the card can be read. The first version stayed bright and made the card's title unreadable; the screenshot caught it.

Checked: phone-sized Chromium, a night-1 run with each look on screen, 60 frames a second on this Mac, no page errors; the dawn card compared with the build before. Not checked: a real phone (about 350 reed blades a frame are new), a person's opinion. Full 3D stays in the lab until a person compares the two on a phone, because rocks ahead draw about 20% smaller there.

## 2026-11-23: tester t1 asks for a harder, longer game (note #69)

The tester likes the game but finds it too easy: night 6 without a struggle, the tower cleared in one go, the whole game done in 15 to 30 minutes. They blame the stats and powers. They asked for a long list. In their words, shortened:

1. Stats should last one night only, with a warning in the shop.
2. Powers should be rarer; a player can switch some off so they stop appearing; only two at a time; hearts and the shield should count as powers and not be free; the shield and a heart should differ (now both are a spare life).
3. Test commands to get as many embers and powers as wanted, removed at launch.
4. The river colours barely differ (blue and a darker blue).
5. Tower: about 50 levels, much harder each level, growing exponentially. After each level ask "go again or stop". Going to the menu after level 7 shows "best 7" and the next climb starts from 1 again, for competition.
6. 50 more nights, with an exponential rise in difficulty between nights.
7. A leaderboard so people compete.
8. A river animations pack; a crash effects pack (choose two or three): crashes that differ by what you hit, with their own sounds (a rock: the boat sinks or breaks; the bank: it tips over the bank).

### Done in this change

| Ask | What changed |
| --- | --- |
| 1 | A stat level now lasts the next run only and is used up when that run starts, whatever the mode. The price fell to 15 embers times the level bought (15, 30, 45), since it is spent each time. The shop shows a warning in orange, the menu lists the stats ready for the next run, and the run opens with "Your stats are on for this run". Stats bought before this change are used by the next run. `lantern-stats` keeps its format; it now holds the levels for the next run. |
| 2, rarer | About two powers a night (one every 26 to 40 river units, was 14 to 24). Careful bot, night 5: 0.33 powers taken a run before, 0.26 after; greedy bot 0.78 and 0.39. Hearts and shields are unchanged here. |
| 2, switch off | Tapping an owned ability in the shop switches it off (dimmed, dashed); it stays owned and no longer lies in the river. Tap again to bring it back. New key `lantern-off`: a JSON list of ability ids. |
| 3 | "Tester tools" at the bottom of the shop: +500 embers, open all nights, find everything. They show only in a browser that has the notes button, that is one that opened a tester's private link. Each use is recorded in the lab events as `test`. **Remove before launch.** |
| 4 | Blue is a brighter cobalt, teal is clearly green-blue, black glass is darker with silver streaks. Screenshots of all six waters before and after were compared; blue and teal were the close pair. |

The lab's own reading: "two at a time" is ambiguous (two chosen for a run, or two working at once), and it decides whether hearts and shields take a slot. A question went to the tester.

Checks: `node experiments/kit/check/phone.mjs lantern` on WebKit iPhone 13 and Chromium Pixel 7 with new lines for the stat warning, the 15-ember price, the menu line, stats used up at run start, the switch and its saved key, and a tester tool. Making the run keep its stats makes the check fail (tried). `bots.mjs 60 audit` on nights 1 to 20, endless and tower: no closed river, no buried pickup. Not checked: a real phone; whether 15 embers a level is the right price now that a stat is spent each run.

### Left as a proposal (2026-11-23, note #69)

- **Only two powers, hearts and shield as powers, shield different from a heart.** Waiting on the tester's answer about "two at a time". A lab idea for the difference: the shield becomes a force field that lasts a few seconds and pushes rocks aside, while a heart stays a spare life.
- **50 more nights and an exponential rise between nights.** Nights past 24 would be the same under the current caps on speed and density; it needs new hazards or a new curve, audited for closed rivers. The steeper rise should start at night 6, as the tester earlier asked nights 1 to 5 kept, and come with careful-bot numbers before and after.
- **Leaderboard.** A shared leaderboard needs a server, which is the owner's decision. A best list on this device is possible without one.
- **Crash effects pack and river animations pack.** A crash that differs by what is hit (sink or shatter on a rock, tip over on the bank, crack on ice), each with its own sound; the pack lets a player pick two or three. River animations: moving ripples, moonlight glints, mist.
- **Tower of 50 levels** (built in the next change if it lands; see below).
