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
