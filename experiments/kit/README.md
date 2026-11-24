# Experiment kit

Shared code for the games under `experiments/`. It is served at `/kit/` as plain ES modules. There is no build step: a game imports `../kit/<file>.js`.

| File | What it gives a game |
| --- | --- |
| `save.js` | `read`, `write`, `readNumber`, `readJson`, `writeJson`: localStorage that never throws |
| `audio.js` | `sound()`: phone audio unlock with the iOS retry, the 'playback' audio session so an iPhone plays through its silent switch, `tone`, `noise`, `hold` and `release` for pause |
| `pause.js` | `onLeave(pause)`: pause when the page loses the screen; `isPauseKey` |
| `zoom.js` | `noZoom()`: no double-tap or pinch zoom, and a zoomed page asked back to scale 1 (iOS ignores `user-scalable=no`) |
| `screens.js` | `screens(ids, after)`: show one full-page card |
| `stick.js` | `stick(el, { when, reach, leash, dead })`: a floating joystick; the game owns the numbers and draws it from `touch` |
| `drag.js` | `drag(el, { playing, paused, resume, from, travel, aim, mouse, settle })`: steering by relative finger travel, with the settle distance after a pause; the game owns the gain |
| `sides.js` | `sides(el, { on, playing, paused, resume })`: press the left or right half to steer, hold to keep turning (Lantern's first-person view) |
| `tilt.js` | `tiltSteer()`: steering by leaning the phone, with the iPhone permission, a straight position, and the screen kept on (Lantern's first person) |
| `hint.js` | `hint(el, { kind, key, when, played, delay, look, label, reach, bottom })`: help for a first-time player who does not touch: a see-through copy of the control with a finger showing how; see below |
| `i18n.js` | `words({ en: {...}, tr: {...} })` gives `{ t, lang, setLang, apply, langs }`: text in the player's language, chosen by `?lang=`, a remembered choice (`kit:lang`, shared by every game) or the browser; `apply()` fills `data-i18n` elements |
| `room.js` | `table({ game, version, name, onState, onMove, ... })`, `newCode`, `linkFor`, `codeFromLink`, `share` (and `shareLink(url, words)` for any other link): a table for friends by four-letter code or link, no account, for turn-based games; and `relay({ game, onFrame, onPeer, onStatus })`, a two-phone room that passes frames on and stores nothing, for real-time games; see below |
| `lockstep.js` | `lockstep({ id, delay })`: two phones step one seeded game tick by tick, each tick only once both players' inputs for it are here; inputs stamped `delay` ticks ahead, resent until confirmed, state checks every 30 ticks; pure, no timers; see below |
| `samemath.js` | `sameMath` (`exp`, `sin`, `cos`, `hypot`): the same bits on every JavaScript engine, for a sim that two phones run in lockstep; see below |
| `lab.js` | `lab(slug)`: play recording for the game lab, with its notice and off switch; see below |
| `/notes/button.js` | the notes button for testers (it lives in `workers/feedback/public/notes/`) |
| `check/phone.mjs` | phone runs of every live experiment, of the lab pages under `/lab/` and of this kit, on WebKit iPhone 13 and Chromium Pixel 7 |
| `index.html` | a self-test page at `/kit/` |
| `games.json` | the list of every game a tester can open; the notes page builds its games menu and game picker from it, and the phone check fails if an experiment is missing |

## Rules

1. **Write it once.** Code that two games need lives here. Before writing input, sound, pause, menu, save or shop code in a game, look here. If a second game needs something only one game has, move it here in the same change and make both games import it.
2. **Game feel stays in the game.** Rules, steering model, tuning, art and words belong to each game. The kit holds plumbing.
3. **Saves never break.** A game's storage keys and formats are a contract with the players who already have them. `check/phone.mjs` seeds a save in each game's existing format; add to that seed when a game gains a key, and never remove from it.
4. **Exports only grow.** Pages are served with `max-age=0, must-revalidate`, so a browser checks each file on every load, but a page already open can fetch a newer module. Never remove an export or change what it means. Add a new name instead, and delete the old one only after no page imports it.
5. **Modules that touch the page stay separate from rules.** `sim.js` files run in Node for the bots. Kit files that use `window` or `document` are imported by pages only.
6. **Run the phone check before and after.** `PLAYWRIGHT=<dir with playwright> node experiments/kit/check/phone.mjs`. CI does not run it yet. A new screen, control or save key in a game comes with a line in that game's section of the check.
7. **Not verifiable here:** audio on a real iPhone. Keep the unlock wiring in `audio.js` as it is unless a person has tested the change on a phone. The 'playback' audio session (2026-11-23, note #80) leaves the unlock as it was; it answers a tester who heard no sound on a phone, and is itself not yet confirmed on one.

## First-time help (`hint.js`)

The owner asked (2026-11-23) for help at the start for beginners: after a few seconds of play with no input, a see-through copy of the control near the bottom of the screen and a finger moving it, so the controls need no words. To adopt it, import it and make one call after the game's input is set up:

```js
import { hint } from '../kit/hint.js';
hint(canvas, { kind: 'stick', key: '<slug>:hint', when: () => mode === 'play', played: readJson(KEY) !== null });
```

- `kind`: one of
  - `stick`: a floating joystick. The finger presses the knob and takes it once round.
  - `drag`: relative steering. The finger slides side to side along a track.
  - `tap`: the finger taps a spot inside a ring, lifts, and taps again; a ring spreads from each tap.
  - `hold-and-move`: the finger presses, holds, and moves slowly along a dotted arc, then lifts.
  - `path`: the finger presses on the first of four dots in a zigzag and drags through each in turn; the line behind it brightens. Then it lifts.

  A new kind is a new entry in `KINDS` in `hint.js`; callers do not change.
- The look is a constructed stylesheet (`adoptedStyleSheets`), with a `<style>` element where the browser has none, so a page whose policy is `style-src 'self'` (Crumbwar) still gets it.
- `key`: a new key, never an existing one. It is `'1'` once the player has given input in play, and then the hint never shows again on that device. Add it to the game's seed in `check/phone.mjs`.
- `when`: true only while a run is in play with no card over it. Idle time counts only then, and adds up across runs, so a run that ends quickly still leads to the hint in the next one. A tap on Play or on a card is not counted as input.
- `played`: true when the game's own save, read at load, shows the player has played. Without it, every current player would see the hint once after it ships. A page with no save (lab/lantern-3d) has only the hint's key.
- `delay` (3000 ms), `bottom` (120 px above the safe area, to the middle of the copy; or a function, asked each time the copy appears), `reach` (55 px, the stick's reach, so the copy is the size of the real stick), `label` (words for reduced motion), `look` (`hand`, the default, a pointing hand; `ring`, the knob alone with a press ring).
- It never takes input (`pointer-events: none` on all of it) and never cancels an event. It is placed right after `el`, so every card later in the page covers it.
- With `prefers-reduced-motion: reduce` it shows a still copy with a short line of words instead of motion.
- `?hint=hand` or `?hint=ring` on any page that uses it shows it whatever the save says, with that look; `?hint=0` turns it off. This is how to see it on a phone that has played already.

Used by: `ant-promotion` (stick, 3 s), `lantern` (drag, 1.5 s, low, because a boat left alone meets a rock in 3 to 9 s), `lab/ant-nemesis`, `lab/ant-wilds` (stick), `lab/lantern-3d` (drag), `borrowed` (tap, `bottom` as a function that finds a clear tile above the player), `ducklings` (hold-and-move, above Quack), `grapevine` (path, between the teller's row and the next) and Crumbwar (`workers/crumbwar`, stick, loaded from `/kit/hint.js` on the same origin, so it shows only once this site serves that file). In Borrowed, Follow Me and Grapevine the game's own first-level ghost finger waits while the shared hint shows. Not verified on a real phone.

## Friends' tables (`room.js`)

For a turn-based game two friends play on two phones. One player makes a code (`newCode()`), shares the link (`share(code)` uses the phone's share sheet, else copies `linkFor(code)`), and both pages call `t.open(code)`; a page opened with `?room=CODE` reads it with `codeFromLink()`. The server side is the `Table` object in `workers/lab-ai` (`/lab-api/table/<game>/<CODE>`); its README says what is stored and for how long.

- **The server orders, the page judges.** A move is a short array of integers (`t.move([direction])`). The page applies a move only when `onMove(seat, ints, index)` hands it over, its own moves included. `onState` gives the whole game (seat, seed, seats, move list) on joining and after every reconnect: rebuild the game from the seed and replay the list.
- **Check every move with the game's own `sim.js`** before applying it, and ignore one that is not legal. The server does not know the rules.
- **The game must be listed** in `TABLE.games` in `workers/lab-ai/src/table.mjs`, and that Worker deployed. Raise `version` when the rules or the meaning of a move change: two pages on different versions are not seated together.
- **Seats.** `onSeats` gives `[{ n, on } | null]`; show `on` as a light so a player sees a friend drop and return. The seat belongs to a key kept in this browser (`kit-room:<game>:<code>`), so the same phone gets its seat back for 24 hours.
- **Status.** `onStatus`: `connecting`, `live`, `waiting` (lost, retrying by itself), `full`, `version`, `closed` (the seat was opened in another tab, or the table expired), `off`.
- **Rematch.** `t.again()` votes; `onAgain(seat)` shows who has; `onGame({ game, seed })` starts the next game when every seat has voted.
- **Never feed a shared board from a table.** Both pages know the seed, and the server does not check moves.

## Two phones in lockstep (`relay()`, `lockstep.js`, `samemath.js`)

For a real-time game between two phones (first used by Thumb Duel's "Play a friend", 2026-11-24). Each phone runs the same seeded sim; the server only passes frames on.

- **Room.** `relay({ game, onFrame, onPeer, onStatus })` opens `/lab-api/room/<game>/<CODE>` (`r.open(code)`); `r.send([...ints])` reaches the other phone as `onFrame(ints)`. Nothing is stored and nothing comes back after a reload. The game must be in `RELAY` in `workers/lab-ai/src/room.mjs` (two seats, 30 frames a second, 64 integers, 200 bytes), and that Worker deployed. The seat key is in sessionStorage (`kit-relay:<game>:<code>`), so a reconnecting phone takes its own seat back. Status: `connecting`, `live`, `waiting` (lost, retrying), `full`, `closed` (opened in another tab), `failed` (the first try and three more, or six in a row after being in: offer the bot), `off`. A page that is not yet deployed against gets `failed` in about 3.5 s.
- **Lockstep.** `lockstep({ id, delay })`. Each tick: `if (ls.canSample()) ls.push(myInts)`; `ls.ready()` gives `{ mine, theirs }` or null (stall, and say so); step the sim with both; `ls.advance()`. Every ~50 ms send `ls.frame(now)`; feed the friend's frames to `ls.receive(ints, now)`; after a reconnect call `ls.resend()`. `ls.check(tick, hash)` on both phones at the same ticks; `ls.mismatch` is the first tick they disagree. The same `delay` on both phones, so neither thumb is faster.
- **Apply the decoded input, your own included.** Quantize what goes on the wire (whole thousandths, whole ms) and step the sim with the decoded values on both phones.
- **Same maths.** `Math.exp`, `Math.sin` and `Math.hypot` differ in the last bit between WebKit, Chromium and Node (measured 2026-11-24: 5-37% of 20,000 arguments; replayed Thumb Duel matches came apart in 104 of 200 between WebKit and Node). Route the sim's calls through `sameMath` while linked (Thumb Duel: `useMath(sameMath)`), and keep `Math` otherwise so one-phone play is unchanged. `+ - * /` and `Math.sqrt` are the same everywhere.
- **No shared board** from a linked match: both phones know the seed and the server checks nothing.
- Proof for Thumb Duel: `experiments/duel/link-bots.mjs` (identity under delay, jitter, loss and cuts; `--mutate=late` must fail) and `experiments/duel/link-check.mjs` (two pages, WebKit against Chromium, through the real `Room` class).

## Lab recording (`lab.js`)

A game calls `const rec = lab('<slug>')`, then `rec.notice(menuCard)`, `rec.toggle(pauseCard)`, `rec.start(info)`, `rec.event(type, data)` and `rec.end(outcome, summary)`. It sends to the lab's existing endpoint, `POST https://human.adamwhite.work/lab/api/linked`, in the linked v2 format the Worker validates (`apps/site/src/lab/linked.ts` in human-framework): one `run` record per run with `{format: 'kit-lab/1', started, ended, outcome, summary, start, events}`, one `events` record per run for the lab dashboard (`run started`, `ending reached`), and one small `run` record with outcome `between-runs` for a choice made outside a run (a shop purchase, a skin).

- **The server must know the slug.** The Worker answers `400 bad game` for any id it does not list. Experiments are listed in `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts` (human-framework PR 136 adds `lantern` and `ant-promotion`). A new prototype needs its slug there, deployed, before anything it sends is stored. Until then every send is refused and dropped.
- **Notice and switch.** Nothing is recorded, no player id is created and nothing is sent until `rec.notice()` has put the notice on the page. The notice text is the one the lab games already show (Smoke on the Stairs); the switch label is Smoke's. The notice must sit on a card the player sees before play, and the switch on the pause card, because the notice says it is there.
- **Shared with the lab games on this origin.** The player id (`hf-lab-player`) and the off switch (`hf-lab-recording-off`, and `hf-lab-events-off:<slug>`) are the lab client's own keys on play.adamwhite.work. Switching off here switches off every lab game on this origin and deletes the player id, as the lab client does. Do Not Track and Global Privacy Control mean off unless the player ticks the switch.
- **Agent runs.** A page opened with `?labRunSource=agent` marks every record `runSource: 'agent'`. Unlike the lab client, the parameter stays in the address bar, so a reload stays marked.
- **Never in the way.** Every call returns at once and never throws. A failed send is dropped; nothing is queued or retried. Pages on localhost send nothing unless `localStorage['hf-lab-send-localhost'] = '1'` (the phone check sets it and answers the endpoint itself).
- **Why not `@adam0white/lab-client`.** Its ES modules import `@adam0white/human-framework` (the cast and life code), so a no-build page would need a bundle of about 800 KB (the size of the archived experiments' `hf.js`). Its full recording also expects replay exports these games do not have. `lab.js` is about 130 lines and uses the same wire format and storage keys.
- **Not covered, compared with the lab client:** the central identity frame at `/lab/identity/` (so linking is per origin: play.adamwhite.work only), the shared first-visit notice claim (this notice shows on every visit), retries and the offline queue, console error logs, and a run that is still open when the tab closes (a snapshot is sent when the page is hidden, which can be cut short).

## Deliberate differences from the code the kit replaced

- `readNumber` gives the fallback for stored text that is not a finite number. Lantern's old code gave `NaN`, which then could never buy anything and was written back. Reviewed 2026-11-23.
- A page two levels down (`/lab/<name>/`) imports `../../kit/`.
- The lab pages (`lab/ant-nemesis`, `lab/ant-wilds`, `lab/ant-nest`, `lab/lantern-3d`) moved onto `save.js`, `audio.js`, `pause.js` and `screens.js` on 2026-11-23. The three ant pages now also pause when the window loses focus or the page is put away, take capital P as a pause key, and retry the audio start when a finger lifts, as Ant Promotion did when it moved. `lantern-3d` already did all three. Storage keys and formats are unchanged.

## Not shared yet, and why

- **One steering model.** Lantern steers by how far a finger has moved (`drag.js`, used by `lantern` and `lab/lantern-3d`); Ant Promotion uses a floating joystick (`stick.js`, used by `ant-promotion`, `lab/ant-nemesis` and `lab/ant-wilds`). They are different models on purpose, so each is shared among its own pages and they are not merged. The numbers stay in each page: gain 1.3 and settle 12 px; reach 55 px, leash 70 px, dead zone 0.15. Each page keeps its own keyboard keys, its mouse mapping (lantern-3d maps a mouse to the boat's row in 3D) and its drawing of the stick. The `?gain=` query on both Lantern pages stays a page option.
- **The nest's soil painting.** `lab/ant-nest` paints cells along the finger's path and treats an unmoved touch on a tunnel as a tap on an ant. It is a third input model with one user.
- **Shop.** Lantern has a bank and packs; Ant Promotion has free skins. When Ant Promotion gets a currency, the bank and the pack draw move here.
- **Looping noise.** `lab/ant-nest` plays its rain as a noise loop that runs until it is stopped. It is the only page that needs one, so it stays in that page on the kit's audio context.
- **Page styles.** Both games have the same card and button layout with different colours. A shared stylesheet needs before and after screenshots to prove nothing moved.
