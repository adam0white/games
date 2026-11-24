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
- **Tower of 50 levels:** built; see the next entry.

## 2026-11-23: the tower is 50 levels (note #69, item 5)

- A tower climb is now a chain of up to 50 levels. Each level is one climb of the old tower, with ten floors and a straight run into dawn.
- After each level a card shows what the next level adds. Its buttons are "Climb on to level N" and "Stop".
- Stopping, losing or leaving ends the climb. The best number of levels cleared is kept, and the next climb starts at level 1, as the tester asked for competition.
- The menu shows "Tower climb · best level N of 50". New key: `lantern-best-level`, a number. `lantern-best-tower`, the best floor, is still written and no longer shown.
- **The curve.** The pace grows geometrically, from 1.15 at level 1 to 2.2 at level 50. (Corrected below: level 1 now starts at 1.2.) Night 20 runs at 1.67. Rows come up to 15% closer and the river narrows by up to 0.012 by level 50.
- **New things.** Level 1 holds night 4's things, and one more of the nights' new things joins every two levels: all twenty from level 33. The tower no longer depends on the nights opened.
- **Stats.** A whole climb counts as one run: stats bought before it last every level of that climb.
- The lab took "exponential" as a fixed share harder each level, about 1.3% faster plus a new thing every second level. A steeper curve over 50 levels would end far past what a person can react to.

Checks:
- `bots.mjs 100 audit` on levels 1, 17, 33 and 50 (and 10, 25 and 40 on the earlier curve): no closed river, no buried pickup. The narrowest gap is 0.040 at level 50; the endless river's is 0.038.
- The phone check on WebKit and Chromium covers: clear level 1 and see "Stop", climb on to level 2, lose and see "cleared 1 level. Best 1 of 50", the next climb starting at level 1, and the menu line.
- Screenshots of the cards after levels 1 and 7 and after a loss.

Not checked:
- How hard levels 10 to 50 feel to a person. Bots react instantly, so they clear 10% to 28% of levels at every height and cannot measure speed.
- A real phone.

## 2026-11-23: the tower starts harder; crashes differ (note #69, follow-up)

**Correction.** The entry above said tower level 1 was "a little faster than the old tower at night 12's things". That was wrong. The old tower took the nights opened, clamped to 3 to 12. For a player on night 6 that meant pace 1.175 with logs. The first curve's level 1 was 1.15 with night 4's things, so it was easier than the tower the tester called too easy.

**The fix.** Level 1 now runs at 1.2 with night 6's things. The pace still ends at 2.2 at level 50. A new thing joins every two levels, and all twenty are in from level 29. The level card gives the percent faster only from 5% up; below that it just says "faster". Audit, 100 rivers each ridden five ways, at levels 1, 15, 29 and 50: no closed river and no buried pickup. The narrowest gaps are 0.062, 0.055, 0.043 and 0.040.

### Lab experiment: crashes that differ by what was hit

This is the lab's own experiment, a first slice of the tester's crash-effects idea. Each kind of crash has its own look and sound:

| Hit | Effect |
| --- | --- |
| A rock, log, island, spinning rock or hidden rock | Half the time the boat sinks: it shrinks and turns under expanding rings, with bubbles. The other half it smashes into flying planks with a crunch. |
| The bank | The boat tips over onto the bank with a creak and a splash. |
| Ice | Cracks run across the boat and white shards fly, with a glassy crack. |
| A whirlpool | The boat spins down and fades, with a falling tone. |
| A geyser | The boat is thrown up, turning, with a rush of spray. |

The card waits 1.3 s after a crash (was 0.7 s), so the crash can play out. Each crash is recorded in the lab events as `crash` with its cause and effect. To remove the experiment, delete `crashFx`, `wreck` and the `crash` variable in `index.html`.

Checked: each effect was screenshotted in a phone-sized Chromium. A first run found a negative radius, because the frame time can fall just before the crash time; it is clamped and the run is now clean.

Not checked: the sounds on a phone, and whether the tester likes the effects.

### Left as a proposal (2026-11-23)

- The crash-effects pack, where a player picks two or three effects, is still to build on top of this experiment.
- The flame stays lit over a sunk boat. It could go out with a hiss.

## 2026-11-23: tester t1's note #73

The tester asked for at least 50 nights; a rebirth that resets everything for a reward once everything is unlocked; a tower that goes on from where you left off, with a second sector of 50 more levels after the first 50; a tester tool that erases everything, so they can test again from the start; and, when a river, boat or flame is tapped in the shop, every button gone to show it, with a tap bringing them back. They said the new tower difficulty looks really good and asked for the same in the next 50 levels. They said again that the "trash bags" from the last test were not added. The lab reads "trash bags" as a dictation slip for "crash packs", the crash effects pack of note #69, but asked to be sure. Their bar: a game people would want to download from an app store.

### Done in this change

| Ask | What changed |
| --- | --- |
| Tower goes on where you left off | Reverses note #69's "the next climb starts at level 1". New key `lantern-tower-at`, a number: the level the next climb starts at. A cleared level moves it on by one; a lost level is tried again. The menu reads "Tower climb · go on at level N", and a second button, "New climb from level 1", appears once N is above 1. The best level is still kept under `lantern-best-level`. |
| Stats on the tower | A climb is one run while the player taps "Climb on". Trying a lost level again, or starting from the menu, is a new run, so stats bought for the next run are used up there. |
| Erase everything | A tester tool. The first tap asks again; the second removes every `lantern-` key and reloads. It leaves the notes link and the lab's keys alone. |
| A look on the whole screen | Tapping a boat, water or flame you own wears it and hides every button, the notes button included. A calm river with no rocks flows by, lit wider than in play, with the boat and flame drawn 2.2 times their size. "Tap to go back" shows for a moment; one tap anywhere, or any key, brings the shop back. Abilities keep their on and off tap. |

Checks: the phone check on WebKit iPhone 13 and Chromium Pixel 7 now covers resuming at level 2 after a loss, the menu button, a new climb from level 1, the look screen hiding the shop and the notes button and coming back on a tap, and the erase tool (one tap erases nothing; two leave no `lantern-` key and keep `notes.k`). With the old rule put back (a lost climb starts at level 1), the check fails at "after a loss the level is tried again". Screenshots of the jade boat, teal water and sparkler looks, and of the menu with the resume button, were looked at.

Not checked: a real phone.

## 2026-11-23: 50 nights and a second tower sector (note #73)

| Ask | What changed |
| --- | --- |
| At least 50 nights | `NIGHTS` is 50. Nights 21 to 50 hold all twenty things. Each is a fixed share harder: the pace grows geometrically from night 20's 1.665 to 2.3 at night 50 (about 1.1% a night), rows come up to 15% closer and the river narrows by up to 0.012, the same as tower levels 1 to 50. Each night puts one old thing up front in turn (logs, whirlpools, gates, red-eyed rocks, hidden rocks, spinners, geysers, islands), and the menu says which. Night 50 is the last night. |
| A second sector of 50 more levels | Tower climbs 51 to 100 are sector 2, shown as "sector 2, level N", built of violet stone. Clearing level 50 shows "Sector 1 cleared" and "Climb on to sector 2". `lantern-best-level` and `lantern-tower-at` keep their format and now go up to 100. |
| Keep the difficulty change in the next 50 | Rows come closer at the first sector's rate. The pace grows from 2.2 to 3.0, which is slower than the first sector's rate; at that rate it would reach about 4 times level 1's pace by level 100. The river stops narrowing at level 50: with narrowing kept, the audit found gaps of 0.014 and no room for the big boat at levels 75 and 100. |

Nights 1 to 20, the endless river and tower levels 1 to 50 are unchanged. A fingerprint of every rock and ember over 40 rivers of each, taken before and after, matched.

Audit (`bots.mjs 100 audit`, each river ridden five ways):
- Nights 21 to 50: no closed river and no buried pickup. The narrowest gap is 0.036, on night 45 (0.018 for the big boat).
- Sector 2: no closed river and no buried pickup. The narrowest gap is 0.029 at levels 60 and 75 (0.011 for the big boat). That is below the 0.038 accepted for the endless river. The first round accepted 0.028. Capping row density in sector 2 did not change it, so pace is the likely cause. Unresolved.

Careful bot, dawn reached out of 100 runs:
- Nights: 20 → 15, 21 → 14, 30 → 7, 40 → 6, 50 → 8.
- Tower levels: 50 → 23, 51 → 16, 75 → 12, 100 → 8.

`bots.mjs` takes a comma-separated list of stages after the run count, and its default lists include the new nights and levels.

Phone check, new lines:
- Clearing level 50 shows the sector card.
- Climbing on goes to climb 51.
- A loss there resumes at "sector 2, level 1".
- The tester tool opens night 50, and only night 50 says it is the last.

Screenshots looked at: a sector 2 level, its card, and night 50.

Not checked:
- Whether a person can play at a pace of 2.3 to 3.0.
- A real phone.

## 2026-11-23: rebirth (note #73)

The tester asked for a rebirth once everything is unlocked, so the game is not played once and done, and left the reward to the lab.

- **When.** A Rebirth block in the shop, under Stats. Until it is open it shows the goal: "Find everything (N of 23) and open all 50 nights (N of 50)". When both are met it shows a Rebirth button that asks twice.
- **What it resets.** Embers to 0. Finds back to the starting boat, water, flame and boost. Looks worn, abilities switched off, stats ready, nights opened, and the tower's resume level. Bests stay: they are records, and the tester asked for competition.
- **Reward, chosen by the lab.** Each rebirth adds 25% to the embers every run banks, for good, and puts a star by the ember count on the menu. The end card says when the bonus added embers. New key `lantern-rebirths`, a number.
- **Why this reward.** It shortens the second way through without making a run easier. The tester's earlier complaint was that stats and powers made runs too easy.

Checks: the phone check on both profiles covers the goal text before the rebirth is open, one tap doing nothing, the second tap resetting the keys listed above, the star, and a 4-ember run banking 5. With the bonus removed, the check fails at "4 embers bank as 5". The shop's Rebirth block was screenshotted.

Not checked: whether a person reaches night 50, which the rebirth requires (bots reach dawn on night 50 about 8 times in 100). Whether 25% feels like a reward.

### Left as a proposal (2026-11-23, note #73)

- **"Trash bags".** No earlier note mentions trash bags. The lab reads it as "crash packs", the crash effects pack of note #69, in which the player picks two or three crash effects. A question went to the tester before building it. If it is the crash pack, a plan: a fifth pack, Crashes, with the six effects there now (sink, smash, tip, crack, swirl, throw) and two new ones (the flame bursts into sparks, the boat freezes and shatters). The player turns on two or three. A crash uses the effect that fits what was hit when it is on, else one of those on.
- **River animations pack** (note #69): still a proposal.
- **The app-store bar.** The tester wants a game people would download from an app store. Recorded as the bar the tester holds the game to. Publishing is the owner's decision and is not asked for here.

## 2026-11-23: tester t1's notes #74, #75 and #76

- **#74, zoom stuck after a double tap.** Fixed in the kit for both games (`kit/zoom.js`, see `experiments/NOTES.md`). Not verified on a real phone.
- **#75, 30 new nights.** Already built: 50 nights went live in the change above. The note was written before that build was deployed.
- **#75, only two abilities, picked by the player.** This answers question #71 ("pick two"). See the table below. Question #72, on whether hearts and the shield take one of the two places, stays open.
- **#75, "a crash pack or victory pack".** The crash pack is built; see below. The victory pack is left as a proposal.
- **#76, leaderboard with Google sign-up or accounts, names, endless only.** Accounts, sign-in and a shared leaderboard need a server and accounts. Those are the owner's decision ("no new server infrastructure without an owner decision"; accounts are not authorized). Nothing is built for them. See the proposal below.

### Done in this change

| Ask | What changed |
| --- | --- |
| Two abilities at a time | At most two owned abilities are switched on. Tapping a third says "Only 2 abilities at a time. Switch one off first." A find from a pack that would make three arrives switched off, and the shop says so. A save with more than two on keeps the first two in the order they were found, and the rest go into `lantern-off`, which keeps its format. "Find everything" leaves two on. |
| Crash pack | A fifth pack, Crashes, at 50 embers. It holds Fireworks (the lantern bursts into sparks of the flame's colour), Freeze (the boat ices over and shatters), Ghost (a pale ghost of the boat rises), Lightning (a bolt, a blackened boat and smoke) and Big splash (a column of water). Up to three are switched on; a crash plays one of them at random. With none on, a crash fits what was hit, as before. A find switches itself on if fewer than three are. New key `lantern-crash`, a JSON list of ids. Rebirth clears it. The rebirth goal now counts 28 things. |
| (Lab) "New climb from level 1" | Asks twice, as Erase and Rebirth do, so a stray tap under the resume button does not lose the climb. |
| (Lab) Sound fix | Lantern's `tone` wrapper dropped the slide argument, so the crash sounds of note #69 never slid in pitch. It now passes it on. |

Checks: the phone check on both profiles covers two abilities after "Find everything", the refusal of a third, three crashes on and the refusal of a fourth, a crash playing the one crash switched on, and the two taps for a new climb. Making crashes ignore the switched-on list fails the check. Each new effect was screenshotted mid-crash in a phone-sized Chromium, with no page errors.

Not checked: the new crash sounds on a phone.

### Left as a proposal (2026-11-23, notes #75 and #76)

- **Victory pack.** Dawn effects to pick from, like the crash pack: fireworks over the river, lanterns rising, a burst of birds, a rainbow.
- **Leaderboard, names and sign-up.** The owner decides on a server and accounts. Without one, the lab could add a name field above the title and an endless best list on this phone only. That was not built, so as not to suggest names reach anyone else.

## 2026-11-23: tester t1 answered the lab's Lantern questions (notes #81, #83, #91, #92, #93, #94)

| Question | Answer | What follows |
| --- | --- | --- |
| #42: seven of the new things are weather or tricks, not solid obstacles. Change some? | "Good as it is" (#81) | Nothing. |
| #47: which look, flat or the 3D lab version? | "Let me switch between them" (#83) | Left as a proposal: a Look switch between flat and 3D in the game. The 3D version lives in `../lab/lantern-3d/` with its own page, and does not share saves or the shop. |
| #71: "two at a time" meant what? | "Only 2 working at the same moment" (#91) | Note #75 said "so they can only select two of them", and that is built: at most two abilities switched on. With only two kinds in the river, at most two work at the same moment. If the tester wants all five in the river with a limit of two active at once, that is a change to make. |
| #72: should the force field become a few seconds' bubble that pushes rocks, and the heart stay the spare life? | "Yes" (#92) | Built, see below. |
| #78: what were the trash bags? | "The crash effects pack: I pick 2 or 3 crash effects" (#93) | Built in the change above: up to three on. |
| #79: should a rebirth give more than 25% embers? | "Reborn nights that are harder and pay more" (#94) | Built, see below. |

### Done in this change

- **Force field.** The blue pickup no longer takes a hit. For 4 seconds, plus 1.5 seconds a Barrier level, a bubble round the boat shoves any rock it touches sideways, kept inside the river, and holds the boat off the bank. When it ends, half a second of grace follows. An arc shows the time left, and the bubble blinks in its last second. A rock shoved onto an ember or power drops that pickup, so nothing is left buried. The barrier stat now reads "The force field lasts longer"; `lantern-stats` keeps its format. A shield saved inside an old run cannot exist, since runs are not saved.
- **Reborn nights.** After a rebirth, story nights run 6% faster for each rebirth, counted up to five, and dawn pays 10 more embers for each rebirth. The rebirth bonus applies on top. The menu says so. The tower and the endless river are unchanged by rebirth.

Checks:
- A fingerprint over 40 rivers of each night, the endless river and four tower levels matches main once the field pickup is made inert in both copies. With it live, rivers differ only after a field has shoved a rock, which moves where later pickups go.
- Audit, 60 rivers each, ridden five ways, on nights 1, 3, 5, 8, 12, 20, 30 and 50, endless, and tower levels 1, 50 and 75: no closed river. The first run found 5 buried pickups on night 20 and 3 on the endless river, where the field had shoved rocks onto them. After the drop rule: 0.
- The phone check on both profiles covers taking the field, a rock placed on the boat being pushed aside with no heart lost, a reborn night's 1.06 pace, and the menu line. With the push turned off, it fails.
- A phone-sized screenshot shows the bubble and a pushed rock.

Not checked:
- Reborn pace was not audited: five rebirths on night 50 is a pace of about 3.0, the same as tower level 100, which was audited.
- A real phone.

## 2026-11-23: victory pack and a leaderboard on this phone (tester t1, note #96)

The note, in short: "Just build the leaderboard, the victory pack, and the sign-up username UI." All three were earlier left as proposals (notes #75 and #76): a shared leaderboard, accounts and sign-up need a server, which is the owner's decision. The tester now asks for them to be built.

### Done
| Ask | What changed |
| --- | --- |
| Victory pack | A sixth pack, Victories, at 50 embers: Fireworks (rockets burst over the river), Sky lanterns (paper lanterns rise from the water), Birds (a flock takes off from the banks), Rainbow (it opens over the river) and Shooting stars. Up to three are switched on, like crashes; reaching dawn (a night or a tower level) plays one of them at random, with its own sound for fireworks, birds and stars. With none on, dawn is as before. A find switches itself on if fewer than three are. New key `lantern-win`, a JSON list of ids. Rebirth clears it. **The rebirth goal now counts 33 things, not 28**, so a player who had found everything must find five more before the next rebirth. |
| Leaderboard | A Leaderboard button on the menu opens a screen with the ten best endless-river runs **on this phone**: place, name, score and date. An endless run that makes the ten goes in, and the end card says "Number 3 on this phone's leaderboard". A best from before the board becomes its first row. New key `lantern-board`, a JSON list of `{ n, s, d }` (name, score, date), best first. |
| Name ("sign-up username") | A name field on the leaderboard screen, up to 16 characters, saved as you type. Each run on the board carries the name it was played under. New key `lantern-name`, text. There is no account and no sign-in: the screen says the name and scores stay on this phone. |

Kept on this phone only: the name and the board are not in any lab recording. The phone check turns recording on, plays an endless run under a name, confirms the run was recorded, and confirms no record contains the name. With the name added to the run's start record, the check fails (tried).

The name field keeps key presses from reaching the game, so typing P in it does not pause or start anything. Found while testing: the five victory drawings first used added light, which washed out to white against the dawn sky. They are now painted, and only the lantern glows are added as light.

Checks: `node experiments/kit/check/phone.mjs` on WebKit iPhone 13 and Chromium Pixel 7. New lines: an old save's endless best starts the board; three victories on and a fourth refused; dawn plays the one switched on; the name is trimmed and kept to 16 characters and shown as text, not markup; typing P in the name field does not pause; an endless run lands first on the board and the card says so; the board and name survive a reload; nothing sent contains the name. Phone-sized Chromium screenshots of all five victories, the board and the shop; no page errors.

Not checked: the victory sounds and the name keyboard on a real phone.

### Left as a proposal (2026-11-23, note #96)
- **A shared leaderboard with accounts or sign-up** (notes #76 and #96). It needs a server, storage of names and scores from many players, and some way to stop fake scores. All of that waits on an owner decision ("no new server infrastructure without an owner decision"; accounts are not authorized). The local board's format (`{ n, s, d }`) could be sent as is if a shared board is approved. A build without accounts is described in the next section.

## 2026-11-23: a leaderboard shared between players (notes #76 and #96), built, waiting on the owner

The owner was asked on 2026-11-23 whether Lantern gets a leaderboard shared between players. This entry is the build that is
ready for a yes. **Until the owner says yes, the endpoint is not deployed**, and the game behaves as before: the page asks
`/lab-api/board/lantern`, gets no good answer, and shows only the phone's own board.

What it is: no account, no password, no Google sign-in. A name and a best score, under a random id made on the phone.

| Part | What it does |
|---|---|
| Server | `workers/lab-ai/src/board.mjs`: `GET` and `POST /lab-api/board/lantern`, one SQLite Durable Object. Its README lists what is stored, the guards and what was checked. |
| Leaderboard screen | When the shared board answers, two tabs appear, "This phone" and "All players", and a "Share my best run" button with the line "Share sends your name and your best score to this game's server. Nothing else is sent." |
| Sharing | Off for everyone until that button is tapped, so a name typed before today is never sent on its own. While on, each endless run is sent and the server keeps the best. "Stop sharing" deletes the row. "Erase everything" (tester tools) deletes it too. |
| Failure | Any bad answer (no server, an error status, an answer that is not JSON, no answer in 4 seconds) hides the tabs and the button. |

New save keys: `lantern-share` (`'1'` while sharing, else empty) and `lantern-board-id` (the random id, empty when not sharing).
Neither is in the lab recording.

Decisions:
- **On the existing `games-lab-ai` Worker, not the notes Worker.** The notes Worker's database holds private tester notes and every route there needs a token; a public route beside them is a risk for no gain. `games-lab-ai` is already public, has no secrets, and already has the rate limiter and a Durable Object.
- **Opt-in, per phone.** The screen said "Your name and scores stay on this phone" when names were typed, so nothing is sent without a tap on a button that says what is sent.
- **The server's name rule is stricter than the phone's** (letters, digits, space, `_ . -`). A name with other characters shows without them on the shared tab.

Checked: the Worker's unit tests; the Worker under `wrangler dev --local`; the phone check on WebKit and Chromium with a stand-in
server (nothing sent before Share; 401, HTML and a hung request each leave the phone's board; sharing sends only id, name and
score; a later run is sent; Stop sharing sends the removal and clears both keys; the id is not in the lab recording). Two faults
were put in to see the check fail: a failed request treated as an empty shared board, and the sharing switch ignored when sending.

Not checked: the deployed endpoint, a real phone, two real players.

Owner's answer, 2026-11-23 21:23Z: "Yes shared stuff in any game is okay". A basic rude-name filter was added on the server
(a listed word stores the name as "Player"). Still open: false scores (the page reports its own score).

## 2026-11-23: first-time help (the owner's request for beginners)

After 1.5 s of play with no input, a see-through track near the bottom of the screen with a finger sliding along it shows how to steer (`experiments/kit/hint.js`, kind `drag`). It goes on the first touch or key in play and never shows again on that device. New key `lantern-hint`, `'1'` once the player has given input in play. A save with `lantern-bank` means a returning player, who never sees it. Erase everything removes the key with the other `lantern-` keys, so a tester sees the hint again. 1.5 s rather than 3 s because a boat left alone met a rock or the bank after 3.4 to 8.7 s in six emulated runs. Checks: `hint lantern` in the phone check. Not verified on a real phone.
- **A shared leaderboard with accounts or sign-up** (notes #76 and #96). It needs a server, storage of names and scores from many players, and some way to stop fake scores. All of that waits on an owner decision ("no new server infrastructure without an owner decision"; accounts are not authorized). The local board's format (`{ n, s, d }`) could be sent as is if a shared board is approved.

## 2026-11-23: see everything in the shop on the whole screen (tester t1, note #112)

The note, in short: tapping a crash or victory effect should play it with all the buttons gone, and a separate button should switch it on or off. The same should go for every pack.

### Done
| Ask | What changed |
| --- | --- |
| See crash and victory effects with no buttons on screen | Tapping an owned crash shows the boat on a calm river and plays that crash every 2.8 seconds. Tapping an owned victory shows the river at dawn and plays it every 3.8 seconds. One tap anywhere goes back. Sounds play as they do in a run. |
| The same for every pack | Abilities: the pickup floats down to the boat and is taken, with its ring and its screen effect (boost streaks, slow-water hush, the smaller boat for Size), every 3.4 seconds. Boats, waters and flames already had a whole-screen look (note #73). **A tap on them now only shows them. It no longer wears them.** |
| A button to switch it on or off | Under each pack: the thing last shown, whether it is on, and a button: "Switch on" or "Switch off" for abilities, crashes and victories (the limits of 2, 3 and 3 are unchanged), and "Use it" for boats, waters and flames. Before this change, a tap on the thing itself did this. The thing last shown has an outline. |
| (Lab) The shop comes back where it was | Crashes and Victories are at the bottom of the shop, so going back keeps the scroll position. |
| (Lab) Dawn's light radius | Dawn's progress is now kept at 0 or above, so its light radius cannot go below zero. Before this change the phone check failed once in Chromium, on the tower's level card, with "createRadialGradient: r1 is less than 0". This clamp is a possible cause, **not reproduced**. The timing does not fit well: the level card is scheduled before the dawn frames are drawn. The failure is unexplained. |

A showing changes no save and sends nothing to the lab recording. (The first version sent a `look` event, but outside a run every event is posted as its own record, one per tap. That was removed the same day.) No storage key was added or changed.

The previews run by the clock, not by frame time. Headless WebKit draws about two frames a second, and the frame time is capped at 0.1 s, so a preview timed by frames never finished there.

Checks: `node experiments/kit/check/phone.mjs` passes for every experiment on WebKit iPhone 13 and Chromium Pixel 7. The Lantern lines now switch through the button. New lines check that showing a boat does not wear it, that "Use it" does wear it, that a crash and a victory each play twice, that a showing changes no save and leaves no wreck behind, that the scroll position comes back, and that an ability is taken during the look. If the crash is not cleared between showings, the check fails (tried). There are phone-sized Chromium screenshots of all five crashes, all five victories, three abilities and a boat, with no page errors.

Not checked: sound and feel on a real phone. Magnet and Flare show only their ring and pickup, because a calm river has no embers to pull and the light is already full.

### Left as a proposal (2026-11-23, note #112)
- **A drawing error stops the game for good.** Any error thrown in `draw` ends the frame loop, since `requestAnimationFrame` is called after it. Calling it first, or catching the error, would keep a rare bad frame from freezing the screen. **Done 2026-11-23** (see below).
- **A setting for showing on tap.** The note's "a button to enable and disable the feature" is read as the on/off button for each thing. If the tester meant a setting that turns the whole-screen showing itself off, that is a new saved setting. A question was sent. **Closed 2026-11-23:** the tester answered "It is good as it is" (note #134); no setting is built.

## 2026-11-23: fair endless river, hearts and force field as abilities, a random first ability, showings that show (tester t1, notes #119 to #123)

The notes, in short: the tester shared the game with friends and wants the endless river fair for competition, so no stats there and a warning that says so (#119, "only on endless" #120). Hearts and the force field should not be free; they should be in the Abilities pack (#121). A new player, and a rebirth, should start with a random ability, not Boost (#122). The ability showings in the shop were confusing: slow and boost showed no change of speed, the magnet had no embers to pull, the flare did not brighten anything; make them clear with real examples (#123).

### Done
| Note | What changed |
| --- | --- |
| #119, #120 | An endless run neither uses stats nor spends them; they wait for the next night or tower climb. The shop's stat warning, the menu's stat line and the leaderboard say stats never work on the endless river. Starting the endless river with stats waiting says "No stats here: they wait for your next night or climb". Nights and the tower are unchanged. |
| #121 | The Abilities pack holds seven: the five powers, Heart and Force field. A heart or force field lies in the river only when it is found and switched on, and it takes one of the two places. The gifts keep their places and their random draws, so with both switched on a seed's river is the same as before (960 of 960 rivers identical); with one off, its pickups are laid down and left out. The Hearts stat (start with more hearts) is unchanged. |
| #122 | A new player, and every rebirth, starts with one of the seven abilities at random. New key `lantern-start`, the id, text; it is not in `lantern-owned`. A save from before this key (any of `lantern-bank`, `-owned`, `-night`, `-stats`, `-off`) keeps Boost. "Erase everything" makes a new player, with a new random start. The rebirth message names the new first ability. |
| #123 | Each ability is shown on a short stretch of real river, run by the game's own rules, at the size and darkness of a run, with a line saying what to watch and then what happened. Boost and slow water: rocks line both banks so the change of speed shows, and boost goes through a rock in its path. Size: a gap too narrow for the usual boat. Magnet: five embers out of reach swim in, and the ember count rises. Flare: the flame starts low on a dark river and fills. Heart: one heart, take the heart (two), a rock hits, back to one and still going. Force field: three rocks in the way are pushed aside. The hearts and ember count show during a showing. It still changes no save and sends nothing. |
| (Lab) | The shop's rows of things wrap on a narrow phone; seven abilities did not fit in one row at 360 px. Heart and force field have their own marks on the shop button. The ability event sounds and captions of a run now live in one function, `react`, used by the run and by the showings. |

**Rebirth goal.** It now counts 35 things, not 33: a player who had found everything must find Heart and Force field before the next rebirth.

Effect on play: a player with neither Heart nor Force field switched on gets no spare hearts in the river. This makes nights harder, which matches the tester's earlier wish for a harder game (note #69), but it was not measured with the bots.

Checks:
- Phone check, Chromium Pixel 7: all Lantern lines pass, with new lines for: an old save keeps Boost; the stat warning on the menu and shop; an endless run with a stat waiting starts with one heart and leaves the stat saved, and the next night uses it; a rebirth's random start; a new player's random start after Erase; each of the seven showings doing its work, with no save changed and nothing sent. With stats put back on the endless river the check fails at "no stats on the endless river" (tried).
- Node: 100 rivers on night 5 for each ability set: no heart or field pickups with neither on, hearts only with Heart on, fields only with Force field on. `bots.mjs 30 audit`: no closed river, no buried pickup.
- Phone check, WebKit iPhone 13: all Lantern lines pass (159 s). The Lantern check now has 240 s, not 150 s, because the seven showings took it past 150 s on WebKit. One line that this change does not touch, "vbow ends" (the victory showing), fails about one run in two on WebKit on the lab Mac, on clean `main` as well (2 of 4 runs, 2026-11-23). Unresolved.
- Full phone check: 31 passing on this branch and 31 on clean `main`, run on the same machine. On both, the WebKit hint lines ("hidden under the pause card") and the kit self-test fail; those failures were already on `main`.

Not checked: a real phone; whether the friends' leaderboard is fair in other ways (the page still reports its own score, as noted before).

### Left as a proposal (2026-11-23, notes #119 to #123)
- **Abilities on the endless river.** The tester asked only about stats. Abilities still work there. If the competition should be plainer still, the endless river could run with no abilities, or with the same fixed two for everyone.
- **A showing for the bigger boat.** The size showing always shrinks the boat; the one-in-five bigger boat is only told in words.

## 2026-11-23: the shop's showings are good as they are (tester t1, note #134)

The lab asked (#118) what should come next for looking at effects in the shop: a test night with the effect, a switch to turn the full-screen look off, all switched-on effects one after another, or nothing. The tester tapped "It is good as it is". No change. This closes the proposal "A setting for showing on tap" under note #112.

## 2026-11-23: one bad frame no longer freezes the game (lab, from the note #112 proposal)

Not asked for by a note; it closes a proposal recorded under note #112. The frame loop asked for the next frame only after `draw` returned, so a single error thrown while drawing stopped the game for good on a frozen screen. The next frame is now asked for first. The error still reaches the console as before, so checks still see it. If `draw` throws, the blend mode and alpha are put back, so the next frame is not drawn in the `lighter` blend a half-drawn frame can leave behind.

Check: a new line at the start of the Lantern phone check makes one `fillRect` throw, waits up to 5 s for that frame, then waits up to 5 s for one more frame. Headless WebKit in CI drew no frame in the first version's 0.2 s. It passes on Chromium Pixel 7 and WebKit iPhone 13. With the old loop it fails with 0 frames (tried). The thrown error is filtered out of that page's errors by its own text. Chromium runs on the fix failed twice in nine, both on "page errors" from a failed request to `human.adamwhite.work/lab/api/linked` (a live lab server reached from the local check), not from this change.

Not checked: a real phone. No error has been seen in play that this would have caught; the change is a guard.
