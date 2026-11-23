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
- Smoke on the Stairs: the tester's answer is "drop". The owner decides whether to archive it.
- Fix-It Stall: the next working session on the three new experiments goes to Fix-It Stall first.

## 2026-11-23: a new game idea from tester t1 (note #107)

The note, in short: a new game where you have several abilities and must uncover your own past, because you have forgotten everything about yourself. Every use of an ability takes time off your lifespan, so you must find out who you are before you die.

Not built in this run. A new experiment must also be added to the notes page's game list (`workers/feedback/public/notes/app.js`), which a run started by a tester's note may not change. The lane's direction is also "fewer, focused directions" (owner, 2026-11-14), so a new game is the owner's call as much as the tester's. A question went to the tester about which form the game should take.

### Left as a proposal (2026-11-23, note #107): concept card
- **Working title:** Spent.
- **One line:** you wake with no memory and a lifespan bar. Each power you use costs years, and each one shows you a piece of who you were. Find out before the bar runs out.
- **Loop (one run, 10 to 15 minutes):** a small place (a house, a street, a ward) holds about 12 clues. Some can be read for free by looking. Most need a power: *Echo* (hear what was said in a room, 3 years), *Touch* (see an object's last owner, 2 years), *Open* (a locked door or box, 5 years), *Read* (a person's thoughts, 4 years), *Rewind* (relive the last minute, 8 years). Clues fill a portrait with name, work, who you loved and what you did. You win by naming yourself correctly before death; a wrong name costs 10 years.
- **Why it can be fun:** every power is a spend decision, so the player weighs "is this clue worth a year?" as a shop does. Each run reshuffles which of several pasts is true (a doctor, a thief, a soldier...), so a second run is a new mystery, and what you learned of the powers carries over.
- **Smallest slice that would test it:** one room, three powers, one true past out of three, a lifespan bar and the naming at the end. About a day's work as a no-build experiment under `experiments/`, once the owner or the next lab session agrees and someone adds it to the notes page.
- **Open questions:** the form (asked of the tester); whether death ends the run or loops back with memory kept (a time-loop variant).
