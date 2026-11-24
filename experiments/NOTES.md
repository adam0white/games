# Experiment lane notes

Notes that are about the lane as a whole, not one experiment.

## 2026-11-22: where the work goes (tester t1, note #33)

The lab asked "Which game should we put the most work into?". Tester t1, a second owner of the games, answered: Lantern and Ant Promotion are the best current games; put most of the time and effort into those two and drop The Long Road and Copper Afternoon.

### Left as a proposal (2026-11-22)

Focus new work on Lantern and Ant Promotion. Stop new work on The Long Road and Copper Afternoon. Removing them from the site is a separate decision; nothing has been deleted, and both stay playable at `/proto/long-road/` and `/proto/copper-afternoon/`.

## 2026-11-23: the owner's decision

The owner dropped The Long Road and Copper Afternoon. Both moved to `archive/prototypes/` and are no longer served. Copper Afternoon is kept intact there for reuse; see `archive/README.md`.

## 2026-11-23: shared code (owner)

The owner asked for the live games to be kept on shared code as a standing practice. The shared code is `experiments/kit/`; its `README.md` holds the rules and lists what is deliberately not shared yet. `experiments/kit/check/phone.mjs` runs every live experiment in two phone profiles with saves seeded in the formats players already have.

## 2026-11-23: lane test under a path with a space

`npm run check:lane` fails one test, "the real checkout plans without a collision", in a clone whose path contains a space, such as the feedback watcher's `~/Library/Application Support/...`. The test reads `new URL('..', import.meta.url).pathname`, which keeps the `%20` escape. Clean `main` fails the same way, and CI passes. Unresolved; the fix would be `fileURLToPath`.

## 2026-11-23: no zoom on the game pages (tester t1, note #74)

The tester zoomed in by accident with a double tap and could not zoom back out without closing the tab. iOS Safari ignores `user-scalable=no`. Both games set `touch-action: none` on the page, which blocks the pinch that would zoom back out.

`kit/zoom.js` adds `noZoom()`, and Lantern and Ant Promotion both call it. It does four things:
- Caps the viewport scale at 1.
- Gives every element without its own `touch-action` the value `manipulation`, which turns off double-tap zoom. It uses a zero-specificity rule, so each game's own values still win, and the canvas keeps `none`.
- Cancels pinch gestures, `dblclick`, and the second tap of a double tap on anything that is not a control.
- If the page is zoomed anyway, sets the viewport again so the browser goes back to scale 1.

The phone check now asserts, in both games, that the viewport caps the scale, that no visible element is left at `touch-action: auto`, and that a double click's default is cancelled. Without the `noZoom()` call, it fails.

Not verified: a real phone. Emulated browsers do not zoom on a double tap, so the check shows the guards are in place, not that an iPhone stays at scale 1. Whether the snap-back works on the tester's iOS version is unknown.

## 2026-11-23: three new experiments from archived ideas

The owner asked for one or two new games, or a rebuild of a good idea that was wasted earlier. Three were built, each taking one idea from `archive/README.md` ("Ideas worth reusing") and none of the archived code, in the one-thumb form with no reading that tester t1 preferred:

| Experiment | Served at | Idea it rebuilds | From |
| --- | --- | --- | --- |
| Grapevine | `/grapevine/` | News changes as each person repeats it | Hearsay |
| Fix-It Stall | `/fixit/` | Hands on the object, one clear repair at a time | Copper Afternoon |
| Follow Me | `/ducklings/` | The little one does what it watched you do | What the Child Saw |

Each directory has `sim.js` (rules, runs in Node), `bots.mjs` (proves the rules and measures difficulty), `check.mjs` (its own phone-browser check) and `NOTES.md`. The shared phone check has a short section for each. None has been played by a person or on a real phone. Which of the three gets more work is the owners' call after playing.

## 2026-11-23: answers about older and online games (tester t1, notes #82 and #90)

- **Two Voices (`games/murmur`), note #82 answering #43 ("keep it or drop it?"):** "Keep, but change it". Recorded only. Keeping or dropping a game is the owner's decision, and the tester did not say what to change.
- **Crumbwar, note #90 answering #68 ("what should we build on it first?"):** "Play in a room with friends". Recorded only. Crumbwar's server is in `workers/crumbwar/`, outside `experiments/` and `games/`. Private rooms are multiplayer work beyond the owner's Crumbwar decision, so they are left for the owner.

### Left as a proposal (2026-11-23)
- Crumbwar rooms: a short code to share, and a field that holds only the people who joined with it, with bots filling the empty places. This needs an owner decision.

## 2026-11-23: answers on which games to keep (tester t1, notes #103 and #104)

- **Note #103, answering #100 ("Which of the three new games should we work on more?", Grapevine, Fix-It Stall, Follow Me or none):** "Fix-It Stall". Recorded here and in `fixit/NOTES.md`. The lane already puts most work on Lantern and Ant Promotion (note #33). Read this as: among the three new experiments, Fix-It Stall is the one to grow. Nothing was dropped; dropping Grapevine or Follow Me is the owner's decision.
- **Note #104, answering #44 ("Smoke on the Stairs: keep it or drop it?"):** "Drop". Recorded only. Dropping a game is the owner's decision, and Smoke (`games/smoke`) is a full game, not an experiment. One caution: #104 arrived 68 ms before #105, an answer the tester then withdrew as a mis-tap (#106). Both were sent from the same tap sequence, so #104 may also be a mis-tap.

### Left as a proposal (2026-11-23)
- Smoke on the Stairs: the tester's answer is "drop". Archived on 2026-11-23 on the owner's instruction (`archive/games/smoke/`; see `archive/README.md`).
- Fix-It Stall: the next working session on the three new experiments goes to Fix-It Stall first.

## 2026-11-23: a new game idea from tester t1 (note #107)

The note, in short: a new game where you have several abilities and must uncover your own past, because you have forgotten everything about yourself. Every use of an ability takes time off your lifespan, so you must find out who you are before you die.

Not built in this run. The idea fits several very different games (a story with choices, a small place to explore, an action game), and the lane starts a new game with a concept card, then looks. The lane's direction is also "fewer, focused directions" (owner, 2026-11-14). A question went to the tester about which form the game should take.

### Left as a proposal (2026-11-23, note #107): concept card
- **Working title:** Spent.
- **One line:** you wake with no memory and a lifespan bar. Each power you use costs years, and each one shows you a piece of who you were. Find out before the bar runs out.
- **Loop (one run, 10 to 15 minutes):** a small place (a house, a street, a ward) holds about 12 clues. Some can be read for free by looking. Most need a power: *Echo* (hear what was said in a room, 3 years), *Touch* (see an object's last owner, 2 years), *Open* (a locked door or box, 5 years), *Read* (a person's thoughts, 4 years), *Rewind* (relive the last minute, 8 years). Clues fill a portrait with name, work, who you loved and what you did. You win by naming yourself correctly before death; a wrong name costs 10 years.
- **Why it can be fun:** every power is a spend decision, so the player weighs "is this clue worth a year?" as a shop does. Each run reshuffles which of several pasts is true (a doctor, a thief, a soldier...), so a second run is a new mystery, and what you learned of the powers carries over.
- **Smallest slice that would test it:** one room, three powers, one true past out of three, a lifespan bar and the naming at the end. About a day's work as a no-build experiment under `experiments/`, once the tester has picked a form and the next lab session takes it up. To get the notes button, it also goes in the notes page's game list (`workers/feedback/public/notes/app.js`).
- **Open questions:** the form (asked of the tester); whether death ends the run or loops back with memory kept (a time-loop variant).

## 2026-11-23: Borrowed Time, from tester t1's note #107

Tester t1 asked for a game where you have forgotten who you are, have several abilities, and every use of an ability shortens your life. It is built as `experiments/borrowed/` (served at `/borrowed/`): three chapters on one candle, four abilities, and at the end of each chapter you pick your own face out of six. It is a new idea, not a rebuild of an archived game. See its `NOTES.md` for rules, bot results and what is not verified. The same day tester t1 picked Fix-It Stall as the game to work on more (note #103); that round is recorded in `experiments/fixit/NOTES.md`.

## 2026-11-23: two check findings (from the Lantern note #112 run)

- **`npm run check:lane` fails in a path with a space.** `scripts/experiments.test.mjs` builds a path with `new URL('..', import.meta.url).pathname`, which keeps `%20`. So "the real checkout plans without a collision" fails in any clone under `~/Library/Application Support/`, which includes every notes watcher run. It passes in a path without spaces. `fileURLToPath` would fix it. Not changed here, because it is shared code outside `experiments/`.
- **The kit self-test is flaky on Chromium.** The line `hint: not before the delay` (from `kit/hint.js`, PR #110) failed in 2 of 3 runs on the lab Mac and passed in the third. Not investigated.

## 2026-11-23: Crumbwar is boring for now (tester t1, notes #135 and #136)

- **Note #135, answering #124 ("Crumbwar: was it fun?"):** "Sıkıcı" (boring).
- **Note #136, answering #125 ("would you invite a friend to play it with you?"):** "Henüz değil, daha gelişmeli" (not yet, it needs to develop further).

Recorded only. Crumbwar's page and server are in `workers/crumbwar/`, outside `experiments/` and `games/`, so a tester note does not change them. Nothing there was edited.

What the lab saw on the live page the same evening (Chromium, Pixel 7 size, about ten seconds): one person in the room and 23 bots, a plain brown field with no food in view of the nest, and nothing on screen to aim for until the player walks out. That fits "boring", but which part bored the tester is unknown. One question went back to the tester asking what was missing.

**Follow-up, notes #146 and #147 (answers to the lab's "what made it boring?").** The tester tapped two answers: "Alan boş, pek bir şey olmuyor" (the field is empty, not much happens) and "Sadece botlar var, gerçek insan yok" (only bots, no real people). Recorded only, for the same reason as above. The second needs players, which waits on publishing; the friends room (note #90) is the part of it the lab could build.

### Left as a proposal (2026-11-23, notes #135 and #136)
- The answer is in (#146, #147). The first Crumbwar change the lab would make is a fuller field: food in sight of every nest, food that drifts in, and events every minute or so, such as a sugar spill in the middle that all four colonies race to.
- With note #90 ("play in a room with friends"), the tester's wish list for Crumbwar is a friends room and more to do. Both need work in `workers/crumbwar/`, so both wait for a lab session that the owner sends there.

## 2026-11-24: three more experiments (owner asked for further games)

| Experiment | Served at | Idea | From |
| --- | --- | --- | --- |
| Hold Your Breath | `/breath/` | Smoke comes in waves on a visible clock; hold to run, release to shelter, and the line of neighbours behind you is the risk | Smoke on the Stairs (archived) |
| Good Match | `/matchmaker/` | Match helpers to homes from clues that can mislead: seen beats heard beats said | Good Hands (archived) |
| Seed Sling | `/sling/` | Fling seeds; each flower is a new launch point; a daily garden shared by everyone and a shared name board | new |

Each was written by a Codex builder from a shared brief and has `sim.js`, `bots.mjs` (with a `--mutate` run that must fail), `check.mjs` and `NOTES.md`. The lab reran the bots, the mutation run and the phone check of each and looked at the screenshots. None has been played by a person or on a real phone. Not yet in the shared `kit/check/phone.mjs`; each game's own `check.mjs` covers it until then. Seed Sling's board is `/lab-api/board/sling` (a random device id, the typed name, the best score; sent only on Share).

## 2026-11-24: two more (Thumb Duel, Harvest Morning)

| Experiment | Served at | Idea | From |
| --- | --- | --- | --- |
| Thumb Duel | `/duel/` | Two players share one phone, the top half upside down; first to 3 of seven tiny duels; a solo ladder against three bots | new |
| Harvest Morning | `/harvest/` | Cut wheat before the rain; hire neighbours who each cost grain and each help in one way; a daily field with a device-only board | new |

Each was written by a Claude builder agent from a brief and has `sim.js`, `bots.mjs` (with a failing `--mutate` run), `check.mjs` and `NOTES.md`. The lab reran the bots and the mutation run and looked at the screenshots; the builders ran the phone checks. Neither has been played by a person or on a real phone. Thumb Duel has not had two real thumbs on one screen. Harvest Morning's fields 7 to 12 are probably too hard: the clumsy bot passes none of them. Not yet in the shared `kit/check/phone.mjs`.

Paper Boat (`/boat/`, same day): a paper boat rides a gutter stream; the player bends the current with swipes (ripples) and taps (pebbles) and never steers the boat. Ten streets and a daily stream with a device-only best. Bots: careful 30 of 30, clumsy 91% on streets 1 to 3 falling to 42% on 8 to 10 (street 7 is harder than street 8); mutation run fails. A second build of the same brief by another builder is at `/lab/boat-b/` when it lands.

## 2026-11-24: Alibi

`experiments/alibi/` (served at `/alibi/`) is a new wordless whodunit: scrub a clock to replay the evening in a cutaway house, tap suspects for picture alibis, and stamp the one whose alibi the replay contradicts. 21 seeded cases in three chapters and a daily case, each proven to have exactly one visible contradiction. It is a new idea, not a rebuild of an archived game. See its `NOTES.md` for bot results and what is not verified.

## 2026-11-24: Tiptoe Museum

`experiments/nightshift/` (served at `/nightshift/`) is a new one-thumb game: a night guard drags a torch beam and exhibits creep toward the exit only while unlit. 18 nights in three wings, a long night and a daily night. It is a new idea, not a rebuild of an archived game. See its `NOTES.md` for bot results and what is not verified.

## 2026-11-24: Night Vine promoted to /vine/

`experiments/lab/night-vine/` moved to `experiments/vine/` (served at `/vine/`); `/lab/night-vine/` redirects there and keeps the query string. The page now teaches with pictures and a moving finger instead of sentences, has Turkish (`?lang=tr` or the language button), and records play with `kit/lab.js` under slug `vine` after a notice. It is in `kit/games.json` as fresh and in `kit/check/pages.mjs`. Production recording needs `vine` added to the lab's accepted games in human-framework before sends are accepted. See `vine/NOTES.md` for bot numbers and what is not verified.

## 2026-11-24: Night Flock promoted to /flock/

`experiments/lab/night-flock-2/` moved to `experiments/flock/` (served at `/flock/`); `/lab/night-flock-2/` redirects there and keeps the query string, and the storage keys keep their `night-flock-2:` names. The page opens on a first card (Play, language, recording notice), teaches with pictures on the field and a moving finger instead of sentences, has Turkish (`?lang=tr` or the language button), and records play with `kit/lab.js` under slug `flock`. It is in `kit/games.json` as fresh and in `kit/check/pages.mjs`. Bots over 60 fresh seeds per evening: careful 98% or better on all 20 evenings, clumsy (150 ms late, 15% wrong inputs) 95% or better; a bot that knows only what the field pictures (a dotted line to the next opening or the fold, a ring, a hand, an arrow) clears all 20 evenings as dealt and 100% of 20 fresh seeds each; before the changes it won evening 1 only. The banks are forgiving from evening 2 for that reason; time limits are unchanged. Production recording needs `flock` added to the lab's accepted games in human-framework before sends are accepted. No person has played it. See `flock/NOTES.md` for numbers and what is not verified.


## 2026-11-24: Night Flock and Night Vine (tester t1, note #208, answering #198)

Asked which of Night Flock and Night Vine they would keep playing, the tester chose "None". Recorded only: dropping a game is the owner's decision.

## 2026-11-24: which small games and lab pages to keep (tester t1, notes #206, #207)

- **#206, answering #174:** the best of the six are Thumb Duel, Paper Boat and Seed Sling, between which the tester did not choose. Recorded; no game was dropped.
- **#207, answering #175:** keep Ant Draft A, Lantern Spark, Lantern Race and one the transcript calls "Lantern pulls", which matches no page (asked back). The tester wants the Lantern ones inside Lantern as modes. Ant Draft changes are in `lab/ant-draft/NOTES.md`.
