# Prototype kit

Shared code for the games under `prototypes/`. It is served at `/proto/kit/` as plain ES modules. There is no build step: a game imports `../kit/<file>.js`.

| File | What it gives a game |
| --- | --- |
| `save.js` | `read`, `write`, `readNumber`, `readJson`, `writeJson`: localStorage that never throws |
| `audio.js` | `sound()`: phone audio unlock with the iOS retry, `tone`, `noise`, `hold` and `release` for pause |
| `pause.js` | `onLeave(pause)`: pause when the page loses the screen; `isPauseKey` |
| `screens.js` | `screens(ids, after)`: show one full-page card |
| `lab.js` | `lab(slug)`: play recording for the game lab, with its notice and off switch; see below |
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

## Lab recording (`lab.js`)

A game calls `const rec = lab('<slug>')`, then `rec.notice(menuCard)`, `rec.toggle(pauseCard)`, `rec.start(info)`, `rec.event(type, data)` and `rec.end(outcome, summary)`. It sends to the lab's existing endpoint, `POST https://human.adamwhite.work/lab/api/linked`, in the linked v2 format the Worker validates (`apps/site/src/lab/linked.ts` in human-framework): one `run` record per run with `{format: 'kit-lab/1', started, ended, outcome, summary, start, events}`, one `events` record per run for the lab dashboard (`run started`, `ending reached`), and one small `run` record with outcome `between-runs` for a choice made outside a run (a shop purchase, a skin).

- **The server must know the slug.** The Worker answers `400 bad game` for any id it does not list. Prototypes are listed in `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts` (human-framework PR 136 adds `lantern` and `ant-promotion`). A new prototype needs its slug there, deployed, before anything it sends is stored. Until then every send is refused and dropped.
- **Notice and switch.** Nothing is recorded, no player id is created and nothing is sent until `rec.notice()` has put the notice on the page. The notice text is the one the lab games already show (Smoke on the Stairs); the switch label is Smoke's. The notice must sit on a card the player sees before play, and the switch on the pause card, because the notice says it is there.
- **Shared with the lab games on this origin.** The player id (`hf-lab-player`) and the off switch (`hf-lab-recording-off`, and `hf-lab-events-off:<slug>`) are the lab client's own keys on play.adamwhite.work. Switching off here switches off every lab game on this origin and deletes the player id, as the lab client does. Do Not Track and Global Privacy Control mean off unless the player ticks the switch.
- **Agent runs.** A page opened with `?labRunSource=agent` marks every record `runSource: 'agent'`. Unlike the lab client, the parameter stays in the address bar, so a reload stays marked.
- **Never in the way.** Every call returns at once and never throws. A failed send is dropped; nothing is queued or retried. Pages on localhost send nothing unless `localStorage['hf-lab-send-localhost'] = '1'` (the phone check sets it and answers the endpoint itself).
- **Why not `@adam0white/lab-client`.** Its ES modules import `@adam0white/human-framework` (the cast and life code), so a no-build page would need a bundle of about 800 KB (the size of the archived prototypes' `hf.js`). Its full recording also expects replay exports these games do not have. `lab.js` is about 130 lines and uses the same wire format and storage keys.
- **Not covered, compared with the lab client:** the central identity frame at `/lab/identity/` (so linking is per origin: play.adamwhite.work only), the shared first-visit notice claim (this notice shows on every visit), retries and the offline queue, console error logs, and a run that is still open when the tab closes (a snapshot is sent when the page is hidden, which can be cut short).

## Deliberate differences from the code the kit replaced

- `readNumber` gives the fallback for stored text that is not a finite number. Lantern's old code gave `NaN`, which then could never buy anything and was written back. Reviewed 2026-11-23.
- A page two levels down (`/proto/lab/<name>/`) imports `../../kit/`.

## Not shared yet, and why

- **Steering.** Lantern steers by how far a finger has moved (with a gain and a dead zone after a pause). Ant Promotion uses a floating joystick. They are different models on purpose. A third game that wants one of them moves it here.
- **Shop.** Lantern has a bank and packs; Ant Promotion has free skins. When Ant Promotion gets a currency, the bank and the pack draw move here.
- **Page styles.** Both games have the same card and button layout with different colours. A shared stylesheet needs before and after screenshots to prove nothing moved.
