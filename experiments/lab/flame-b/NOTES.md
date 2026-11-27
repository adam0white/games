# Pass the Flame (flame-b)

A relay flame carried down a dark river. The link is the flame; there is no menu. You open a link, the last carrier's lit boat glides up beside your unlit one, the camera pulls back over the named lights of the people who carried it, and a touch-and-slide makes the flame jump to your boat. You steer one leg of about 60 s with one thumb: embers raise the flame, rocks and banks lower it, and the light around you is as wide as the flame is strong. At the buoy you add your name (optional) and pass a new link to one friend. If the flame goes out, the names go dark one by one back to the first.

Built from `dist/review/brief-flame.md`. Canvas 2D, no external requests, no build step.

## Files

| File | What it holds |
|---|---|
| `index.html` | page, cards, CSS per look |
| `main.js` | screens (arrive, leg, handoff, drop), input, sound, recording, settings, test hooks |
| `sim.js` | pure seeded river, rocks, embers and the fixed-step leg (60 Hz); `seeker` policy |
| `link.js` | pure link encode, strict decode, `passOn` |
| `draw.js` | the three looks, light and darkness, effects |
| `words.js` | English and Turkish |
| `check.mjs` | `node check.mjs` (add `--mutate` for the known-bad case) |

## Link format

`?flame=1.<chain>.<flame>.<total>.<seed>.<name>*<dist>*<name>*<dist>...~<sum>`

| Field | Rule |
|---|---|
| `1` | format version |
| `chain` | whole number 1 to 99,999: how many people have carried it |
| `flame` | whole percent 1 to 100 handed on (the next leg starts at this) |
| `total` | whole metres 0 to 99,999,999, at least the sum of the listed legs |
| `seed` | base 36, 1 to 2^31-1, no leading zero: the next carrier's river |
| `~sum` | 8 base-36 characters: cyrb53 over `KEY + '|' + body`, where `KEY` is a constant in `link.js` |
| carriers | the last 8 at most, never more than `chain`; name 0 to 16 chars of letters, digits, space, `_ . -` (NFKC, trimmed, single spaces), distance 0 to 9,999 |

Decoding is all-or-nothing: the whole field must match one anchored pattern (max 320 chars), every number is range-checked, every name must equal its cleaned form, and fields that disagree (more carriers than `chain`, `total` below the listed legs) refuse the link. A refused link plays as "a flame nobody has carried yet" with a one-line note. Names only ever reach the page through `textContent` and canvas `fillText`. The checksum only deters casual editing. The key ships in the page source, so anyone who reads `link.js` can sign any link they like (check.mjs asserts that a recomputed checksum passes, so nobody mistakes it for security). A link with a `~` and a wrong checksum is refused. A link without a `~` (written by hand, or from before 2026-11-27) is accepted only if every listed distance is a plausible leg (1,700 to 1,960 m), `total` is no more than 1,960 m a carrier, and the chain is clamped to what the names and distances support: with fewer than 8 names the chain is the number of names; with 8 it is 8 plus the unlisted metres divided by 1,700. So `chain=99999` with 2 names plays as carrier 3, and `pct=100` edited into a signed link is refused.

The outgoing link keeps only origin and path from the current address, so `lang`, `labRunSource` and other parameters are not passed on.

## Rules chosen

- Drop rule (setting `drop`, default `dims`). `dims`: "Try again" relights from the coals on the same river and chain, starting at 12 to 25% flame; "Light a new flame" is also offered. `ends`: only "Light a new flame". A new flame drops the link from the address and you become carrier 1, lit from a dock lamp.
- No rocks in the first 8 s (240 m); the first ember sits on the line at 105 m, so an idle boat takes it. A weak inherited flame (under 50%) gets three more embers on the line early.
- Rock and bank damage scale with the flame (`0.45 + 0.55 * flame`), so a weak flame is fragile but not hopeless.
- The flame handed on is the flame at the buoy, as a whole percent.

## Screens and timing (2026-11-27)

- Arrival. In the first second: Sam's lit boat glides in from upriver-right (1.2 s), your unlit boat sits in its own pool of light, both banks are on screen, "You are carrier N" and the touch cue show at 0.4 s. The camera pulls back from 1.6 s to 4.8 s to show the chain lights (22 m apart, up to 6 small unnamed ones behind). On touch the camera moves to the leg view and the flame jumps across in 0.65 s.
- Leg camera. The boat sits at 72% of the height in portrait and 80% in landscape; px per metre is `min(W/64, H*A/96)`, so 96 m of river show ahead in both orientations (landscape showed about 63 m before). The camera x leans 70% towards the river centre 45 m ahead, so the next bend and both banks are in view.
- Light. `pool(flame) = 7 + 25*flame` m around your boat, plus an ambient night level per look (`night: [at low flame, at full flame]`), so the river upstream stays readable at full flame and closes in as the flame weakens. Paper keeps two hard tones at the pool edge; thermal and storm are soft.
- Drop. 0.7 s after the flame dies, the lights behind you go out one by one (at most 0.42 s apart, 3.2 s for all), each with a falling note; the card follows 0.6 s after the last. Lights are spaced in screen px so names never touch.
- Handoff. A buoy with a lantern marks the end; no word on the canvas.
- Hint. The page used `kit/hint.js` in its automatic mode. There the hint is dismissed only by a `pointerdown` (or key) that arrives while `when()` is true, and its idle clock never resets on movement. The take is a touch-and-slide made during arrival, when `when()` is false; a player who keeps that thumb down and steers never makes a new `pointerdown` in the leg, so the hint showed after 3 s and stayed (reproduced before the fix: a held, steering thumb left the hint on with `flame:hint` unset). It now runs with `manual: true`; the page calls `done()` on the first deliberate steer (more than 10 px of drag, or a key) and the hint does not return in that leg.

## Storage keys (localStorage, through `kit/save.js` and `kit/settings.js`)

- `flame:name`: your last name on the flame
- `flame:played`: set after the first finished leg (turns the drag hint off)
- `flame:hint`: the drag hint's own state (`kit/hint.js`)
- `flame:set:look`, `flame:set:drop`, `flame:set:sound`, `flame:set:haptics`: settings
- `kit/lab.js` keeps its own recording switch. This page records under its own lab slug, `flame-b` (flame-a records under `flame-a`); the settings slug `flame` is shared with flame-a.

## Test hooks

`window.flameState()` gives `{screen, playing, flame, progress, chain, carrier, paused, taking, source, link, look}`. `window.flameSim()` returns the live sim state. `window.flameAim(v)` steers as a finger would (`null` lets go). `window.flameWarp(sec, policy)` runs the leg on without waiting.

## Verified (2026-11-27, after the round-2 fixes)

- `node check.mjs` passes, now including: signed links refuse any edit (and a re-signed forgery passes, by design); unsigned links obey the strict ranges and the chain clamp.
- `kit/check/phone.mjs lab/flame-b` passes on chromium and webkit (page and hint).
- Playwright screenshots. On both Pixel 7 Chromium and iPhone 13 WebKit: arrival at 1 s and 3.5 s, landscape arrival and pull-back, handoff for chains 1 and 23, a drop for chain 23 in portrait and landscape, Turkish handoff and drop cards. Leg looks: paper, thermal and storm on Chromium; paper, thermal and storm on WebKit. Landscape leg shows about 100 m ahead. No console errors.
- After pressing Pass, on both engines, for chains 1 and 23, in three branches (share sheet, clipboard, both refused, with stubs): the button reads "Pass it again", the status matches the branch, the shared text uses the singular for chain 1 ("I lit this flame and carried it 1,911 m."), and no "1 people" or "1 hands" appears. After a switch to Turkish both re-render ("Yeniden devret" and the branch's status).
- Forged links in the page, both engines: a signed link with one name letter changed, and a signed link with its percent edited to 100, both play as the broken-link message and carrier 1. An unsigned `chain=99999` link with 2 names plays as "You are carrier 3". The good link plays as carrier 24.
- `en` and `tr` have the same keys, and every `t('...')` and `data-i18n` key used exists.
- A touch script (CDP): a thumb held and steering for 7 s keeps the hint off; 4.5 s idle with no steer shows it; one slide removes it and it stays off.

## Verified (2026-11-26)

- `node check.mjs` passes: link round trip; 35+ hostile links refused; seeker hands on 200/200 seeds (mean flame 89%); doing nothing lasts at least 20.5 s from a 25% flame and 26.2 s from a full flame, and finishes 11/200 against the seeker's 200/200; no rocks in the first 8 s; deterministic. `--mutate` (a river walled with rocks) must drop and does.
- A Playwright pass in headless Chromium (Pixel 7 profile) and WebKit (iPhone 13 profile), with touch pointer events: arrival text from a 23-carrier link; take; a steered leg; the handoff card with 8 names and yours; a hostile name cleaned; Pass gives a link (headless reports "copied"); the made link opened in a fresh context shows "Flame 24. <name> carried it ..." and starts at exactly the handed-on percent; a drop under `dims`, with screenshots of the named lights lit and then going dark (Try again relights from the coals at 25%); a hostile link refused with no injected element; a drop under `ends` and Light a new flame; settings and the Turkish switch; a real touch slide steers the boat both ways; P pauses and stops the sim, and a touch resumes it. No console errors and no requests off the local server in either engine.

## Faked or not done

- The `flame` slug is not registered in human-framework's lab prototypes, so a live recording would be refused. Registering it is outside this folder.
- No entry in `games.json` or `lab/index.html`: outside this folder. The phone check entry (`kit/check/lab-pages.mjs`, 2026-11-27) exists.
- Sam's boat in the arrival, and the chain lights behind it, are staged from the link's names and distances. They are not replays of anyone's leg.
- Carriers older than the last 8 have no names in the link. They show as up to 6 small unnamed lights.
- The link checksum is not security (see Link format). The numbers are a story, not a record.
- In landscape (and the 390 px-wide iPhone portrait) the end of a long chain runs under the touch cue and the lab notice during the arrival pull-back. Names keep at least 30 px apart, so the upper names stay readable, and the tail runs off the bottom of the screen.

## Could not check

- A real phone: frame rate (headless desktop showed a steady 16.7 ms frame, which says nothing about a mid phone), the share sheet (headless takes the copy path), vibration.
- Sound by ear.
- The Turkish has not been read by a native speaker (new strings 2026-11-27 included).
- Difficulty with real thumbs: the seeker never drops, so the leg may be too easy for anyone who steers.
