# Prototype kit

Shared code for the games under `prototypes/`. It is served at `/proto/kit/` as plain ES modules. There is no build step: a game imports `../kit/<file>.js`.

| File | What it gives a game |
| --- | --- |
| `save.js` | `read`, `write`, `readNumber`, `readJson`, `writeJson`: localStorage that never throws |
| `audio.js` | `sound()`: phone audio unlock with the iOS retry, `tone`, `noise`, `hold` and `release` for pause |
| `pause.js` | `onLeave(pause)`: pause when the page loses the screen; `isPauseKey` |
| `screens.js` | `screens(ids, after)`: show one full-page card |
| `/notes/button.js` | the notes button for testers (it lives in `workers/feedback/public/notes/`) |
| `check/phone.mjs` | phone runs of every live prototype and of this kit, on WebKit iPhone 13 and Chromium Pixel 7 |
| `index.html` | a self-test page at `/proto/kit/` |

## Rules

1. **Write it once.** Code that two games need lives here. Before writing input, sound, pause, menu, save or shop code in a game, look here. If a second game needs something only one game has, move it here in the same change and make both games import it.
2. **Game feel stays in the game.** Rules, steering model, tuning, art and words belong to each game. The kit holds plumbing.
3. **Saves never break.** A game's storage keys and formats are a contract with the players who already have them. `check/phone.mjs` seeds a save in each game's existing format; add to that seed when a game gains a key, and never remove from it.
4. **Exports only grow.** Pages are served with `max-age=0, must-revalidate`, so a browser checks each file on every load, but a page already open can fetch a newer module. Never remove an export or change what it means. Add a new name instead, and delete the old one only after no page imports it.
5. **Modules that touch the page stay separate from rules.** `sim.js` files run in Node for the bots. Kit files that use `window` or `document` are imported by pages only.
6. **Run the phone check before and after.** `PLAYWRIGHT=<dir with playwright> node prototypes/kit/check/phone.mjs`. CI does not run it yet. A new screen, control or save key in a game comes with a line in that game's section of the check.
7. **Not verifiable here:** audio on a real iPhone. Keep the unlock wiring in `audio.js` as it is unless a person has tested the change on a phone.

## Deliberate differences from the code the kit replaced

- `readNumber` gives the fallback for stored text that is not a finite number. Lantern's old code gave `NaN`, which then could never buy anything and was written back. Reviewed 2026-11-23.
- A page two levels down (`/proto/lab/<name>/`) imports `../../kit/`.

## Not shared yet, and why

- **Steering.** Lantern steers by how far a finger has moved (with a gain and a dead zone after a pause). Ant Promotion uses a floating joystick. They are different models on purpose. A third game that wants one of them moves it here.
- **Shop.** Lantern has a bank and packs; Ant Promotion has free skins. When Ant Promotion gets a currency, the bank and the pack draw move here.
- **Page styles.** Both games have the same card and button layout with different colours. A shared stylesheet needs before and after screenshots to prove nothing moved.
