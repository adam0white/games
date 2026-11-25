# Experiment kit

Shared code for the games under `experiments/`. It is served at `/kit/` as plain ES modules. There is no build step: a game imports `../kit/<file>.js`.

| File | What it gives a game |
| --- | --- |
| `save.js` | `read`, `write`, `readNumber`, `readJson`, `writeJson`: localStorage that never throws |
| `audio.js` | `sound()`: phone audio unlock with the iOS retry, the 'playback' audio session so an iPhone plays through its silent switch, `tone`, `noise`, `hold` and `release` for pause |
| `music.js` | `music(ac, { preset })`: a score made in code on the audio clock, with a tune that pickups play; presets `lantern`, `river`, `bell`, `flute`; see below |
| `pause.js` | `onLeave(pause)`: pause when the page loses the screen; `isPauseKey` |
| `zoom.js` | `noZoom()`: no double-tap or pinch zoom, and a zoomed page asked back to scale 1 (iOS ignores `user-scalable=no`) |
| `screens.js` | `screens(ids, after)`: show one full-page card |
| `stick.js` | `stick(el, { when, reach, leash, dead })`: a floating joystick; the game owns the numbers and draws it from `touch` |
| `drag.js` | `drag(el, { playing, paused, resume, from, travel, aim, mouse, settle })`: steering by relative finger travel, with the settle distance after a pause; the game owns the gain |
| `sides.js` | `sides(el, { on, playing, paused, resume })`: press the left or right half to steer, hold to keep turning (Lantern's first-person view) |
| `tilt.js` | `tiltSteer()`: steering by leaning the phone, with the iPhone permission, a straight position, and the screen kept on (Lantern's first person) |
| `hint.js` | `hint(el, { kind, key, when, played, delay, look, label, reach, bottom })`: help for a first-time player who does not touch: a see-through copy of the control with a finger showing how; see below |
| `i18n.js` | `words({ en: {...}, tr: {...} })` gives `{ t, lang, setLang, apply, langs }`: text in the player's language, chosen by `?lang=`, a remembered choice (`kit:lang`, shared by every game) or the browser; `apply()` fills `data-i18n` elements |
| `room.js` | `table({ game, version, name, onState, onMove, ... })`, `newCode`, `linkFor`, `codeFromLink`, `share` (and `shareLink(url, words)` for any other link): a table for friends by four-letter code or link, no account, for turn-based games; see below |
| `lab.js` | `lab(slug)`: play recording for the game lab, with its notice and off switch; see below |
| `home.js` | `home(rec, { back })`: the way back to the small games' home at `/small/` and a finished run reported to it, in one line; see below |
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

## Music (`music.js`)

A score made in code (Web Audio only, no samples) that follows play. It came from Lantern (the lab's Lantern Song, 2026-11-24) and the melody made of embers from the lab's Lantern Rhythm. The owner moved it here for Night Flock, Night Vine, Paper Boat and Harvest Morning.

- **`music(ac, opts)`** builds the score once on an audio context. Options: `preset` (`'lantern'`, the default, `'river'`, `'bell'`, `'flute'`), `dest` (a node to play into; the context's speakers by default), and any preset field to override: `bpm`, `key` (semitones from D), `minor` and `major` (four chords of four MIDI notes, one chord every 16 eighths), `turn` (the progress at which the chords turn major), `voice` (a preset name or an object of layer functions, see `VOICES`), `strip` (eighths a blow thins the music; 16, two bars). `music(ac, node)` is the same as `{ dest: node }`.
- **`start(seed)`** at each new level or night. The seed picks the walk and the tune, so the same seed gives the same music.
- **`set({ on, progress, danger, light })`** every frame. `on`: a run is in play and not paused; false fades to silence in about a second, true fades in. `progress` 0 to 1: the walk gets busier, the pad opens, and past `turn` the chords turn major (the ending is heard before it is seen). `danger` 0 to 1: a low heartbeat above 0.15. `light` 0 to 1: below 0.28 one thin high note is held each bar (use it for any "nearly out" signal: health, fuel, time).
- **`ember()`** when the player takes a pickup: the next note of the night's tune, on the next sixteenth at least 30 ms away (at most 238 ms at 72 a minute), pitched as a chord tone of the chord sounding then, so it always fits. Returns `{ at, midi, freq, step, index }`, or `null` when the song is not on or the audio clock is stopped; the game then plays its own sound. A streak of 4 adds a second voice under each note; a streak of 8 adds a climbing arpeggio; the walk steps back while the streak runs. At most four notes wait; a pickup beyond that returns `null` (the game's own sound plays). A pickup note takes the key (minor or major) of the pad its chord started with, so at the turn it never clashes with the pad still sounding.
- **`miss()`** when a pickup passes by untaken (the streak ends). **`hit()`** on a blow: the streak ends; pad, bass, walk and harmony drop at once and come back on the beat two bars later. The pickups' tune, the heartbeat and the high note stay.
- **`melody`**: `{ played, missed, streak, best, index, share }` for this run (`share` = played / (played + missed)). Pickups count even while the song is off.
- **`chime(n)`** a pitch in the chord now playing, for a sound the game makes itself. **`volume(v)`**, **`stop()`**. **`log`** keeps the last 400 scheduled notes `{ kind, at, step, n }` for checks; `bare` is true while a blow has the music thinned.
- **Timing.** The score schedules eighth notes 0.35 s ahead on the audio clock from a 100 ms timer. A pause that suspends the context (`snd.hold()`) stops the clock, so nothing drifts and the music goes on from the same beat. After a slow background tab it goes on from now instead of catching up. A check can drive it with `{ timer: false, now, running }` and call `pump()` (the kit self-test does, on an `OfflineAudioContext`).
- **Loudness** (peak of the score alone at volume 1, rendered offline in Chromium, worst case: full danger, the ending, light nearly out, a pickup every 0.2 s with harmony on, and a blow): lantern 0.31, river 0.31, bell 0.31, flute 0.24. Lantern plays it at volume 0.8; the whole Lantern mix through an analyser in Chromium peaked at 0.20 to 0.23 with music on and 0.16 with it off, and at 0.38 (WebKit 0.43) during a crash with music on. No compressor; nothing near clipping.
- **Not verified:** any of it by ear. The `river`, `bell` and `flute` presets have been measured, never heard. The self-test page `/kit/` has a Start button, a preset menu, Take an ember and A blow, for a person to listen.

### How to add music to a game

1. In the kit sound setup, build it once: `const snd = sound({ setup: ac => { song = music(ac, { preset: 'river' }); song.volume(0.8); } });`
2. Add a Music switch next to Sound with its own storage key (`<slug>-music`, `'0'` when off; on when the key is missing) and two words in `words.js`, English and Turkish (Lantern's: `musicOn: 'Music: on'`, `musicOff: 'Music: off'`, `'Müzik: açık'`, `'Müzik: kapalı'`). Add the key to the game's seed in `check/phone.mjs`.
3. When a level starts (after `snd.unlock()`): `song?.start(seed)`.
4. Every frame: `song?.set({ on: musicOn && playing && !paused, progress, danger, light })`. Pause with `snd.hold()` as now; the music stops with it.
5. On a pickup: `if (!(musicOn && song?.ember())) snd.tone(...)` (the game's own sound when the music is off or not in play). On a blow: `song?.hit()`. When a pickup passes by: `song?.miss()`.
6. Optional: `song.melody.share` on the end card (Lantern: "Melody played: 92%.", `melodyPlayed`).
7. Music must never touch the rules: call it from the page, never from `sim.js`, and show it with the game's `bots.mjs` (Lantern's `node experiments/lantern/bots.mjs 30 music` is a model).

## Friends' tables (`room.js`)

For a turn-based game two friends play on two phones. One player makes a code (`newCode()`), shares the link (`share(code)` uses the phone's share sheet, else copies `linkFor(code)`), and both pages call `t.open(code)`; a page opened with `?room=CODE` reads it with `codeFromLink()`. The server side is the `Table` object in `workers/lab-ai` (`/lab-api/table/<game>/<CODE>`); its README says what is stored and for how long.

- **The server orders, the page judges.** A move is a short array of integers (`t.move([direction])`). The page applies a move only when `onMove(seat, ints, index)` hands it over, its own moves included. `onState` gives the whole game (seat, seed, seats, move list) on joining and after every reconnect: rebuild the game from the seed and replay the list.
- **Check every move with the game's own `sim.js`** before applying it, and ignore one that is not legal. The server does not know the rules.
- **The game must be listed** in `TABLE.games` in `workers/lab-ai/src/table.mjs`, and that Worker deployed. Raise `version` when the rules or the meaning of a move change: two pages on different versions are not seated together.
- **Seats.** `onSeats` gives `[{ n, on } | null]`; show `on` as a light so a player sees a friend drop and return. The seat belongs to a key kept in this browser (`kit-room:<game>:<code>`), so the same phone gets its seat back for 24 hours.
- **Status.** `onStatus`: `connecting`, `live`, `waiting` (lost, retrying by itself), `full`, `version`, `closed` (the seat was opened in another tab, or the table expired), `off`.
- **Rematch.** `t.again()` votes; `onAgain(seat)` shows who has; `onGame({ game, seed })` starts the next game when every seat has voted.
- **Never feed a shared board from a table.** Both pages know the seed, and the server does not check moves.

## Lab recording (`lab.js`)

A game calls `const rec = lab('<slug>')`, then `rec.notice(menuCard)`, `rec.toggle(pauseCard)`, `rec.start(info)`, `rec.event(type, data)` and `rec.end(outcome, summary)`. It sends to the lab's existing endpoint, `POST https://human.adamwhite.work/lab/api/linked`, in the linked v2 format the Worker validates (`apps/site/src/lab/linked.ts` in human-framework): one `run` record per run with `{format: 'kit-lab/1', started, ended, outcome, summary, start, events}`, one `events` record per run for the lab dashboard (`run started`, `ending reached`), and one small `run` record with outcome `between-runs` for a choice made outside a run (a shop purchase, a skin).

- **The server must know the slug.** The Worker answers `400 bad game` for any id it does not list. Experiments are listed in `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts` (human-framework PR 136 adds `lantern` and `ant-promotion`). A new prototype needs its slug there, deployed, before anything it sends is stored. Until then every send is refused and dropped.
- **Notice and switch.** Nothing is recorded, no player id is created and nothing is sent until `rec.notice()` has put the notice on the page. The notice text is the one the lab games already show (Smoke on the Stairs); the switch label is Smoke's. The notice must sit on a card the player sees before play, and the switch on the pause card, because the notice says it is there.
- **Shared with the lab games on this origin.** The player id (`hf-lab-player`) and the off switch (`hf-lab-recording-off`, and `hf-lab-events-off:<slug>`) are the lab client's own keys on play.adamwhite.work. Switching off here switches off every lab game on this origin and deletes the player id, as the lab client does. Do Not Track and Global Privacy Control mean off unless the player ticks the switch.
- **Agent runs.** A page opened with `?labRunSource=agent` marks every record `runSource: 'agent'`. Unlike the lab client, the parameter stays in the address bar, so a reload stays marked.
- **Never in the way.** Every call returns at once and never throws. A failed send is dropped; nothing is queued or retried. Pages on localhost send nothing unless `localStorage['hf-lab-send-localhost'] = '1'` (the phone check sets it and answers the endpoint itself).
- **Why not `@adam0white/lab-client`.** Its ES modules import `@adam0white/human-framework` (the cast and life code), so a no-build page would need a bundle of about 800 KB (the size of the archived experiments' `hf.js`). Its full recording also expects replay exports these games do not have. `lab.js` is about 130 lines and uses the same wire format and storage keys.
- **Not covered, compared with the lab client:** the central identity frame at `/lab/identity/` (so linking is per origin: play.adamwhite.work only), the shared first-visit notice claim (this notice shows on every visit), retries and the offline queue, console error logs, and a run that is still open when the tab closes (a snapshot is sent when the page is hidden, which can be cut short).

## The way back to the small games (`home.js`)

The home at `/small/` opens every game with `?from=small`. A game wired to it shows a "‹ Small games" link ("‹ Küçük oyunlar" in Turkish) on the cards it names, and tells the home how each run ended, so "Three tonight" can show a win (★) and not only "moved forward" (✦). The one line, in place of the game's `const rec = lab('<slug>')`:

```js
import { home } from '../../kit/home.js';           // from a page in experiments/lab/<slug>/ (top-level games: '../kit/home.js')
const rec = home(lab('night-bells'), { back: ['#menu .card', '#end .card'] });
```

- `back`: the menu and end cards, as selectors or elements, that get the link. Nothing is added when the page was not opened from the home (the `from` is remembered for the tab, so a reload or the next level keeps it). The link goes back in history when the player came from the home, so the home keeps its scroll and its deck position.
- `rec` is the same recorder: `notice`, `toggle`, `start` and `event` are unchanged, and `end(outcome, summary)` still goes to the lab. A run whose outcome is `'won'` counts as a win. A game with other words for a win passes `'won'` or calls `homeResult('<slug>', 'won')` itself.
- What it writes: the home's own key `hub:results` (`{ <slug>: { runs, wins, last, at, wonAt } }`). It never reads or writes the game's keys. `home(null, ...)` works without a recorder.
- `home()` adds the links once, when it is called. A game that redraws a card with `innerHTML` calls `backLink(card)` (also exported) after drawing it; it adds nothing when the page was not opened from the home, and never adds a second link.
- Until a game has this line, nothing changes for it: the browser's back button returns to the home, and the home reads the game's own save to mark it "moved forward".
- The slug comes from the folder in the address and must be the game's name in `experiments/small/catalog.js` (they are equal today).

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
