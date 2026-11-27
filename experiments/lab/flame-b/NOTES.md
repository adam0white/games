# Pass the Flame (flame-b)

A relay flame carried down a dark river. The link is the flame; there is no menu. You open a link, the camera runs back down the named lights of the people who carried it, the last carrier's boat comes out of the dark, and a touch-and-slide makes the flame jump to your boat. You steer one leg of about 60 s with one thumb: embers raise the flame, rocks and banks lower it, and the light around you is as wide as the flame is strong. At the buoy you add your name (optional) and pass a new link to one friend. If the flame goes out, the names go dark one by one back to the first.

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

`?flame=1.<chain>.<flame>.<total>.<seed>.<name>*<dist>*<name>*<dist>...`

| Field | Rule |
|---|---|
| `1` | format version |
| `chain` | whole number 1 to 99,999: how many people have carried it |
| `flame` | whole percent 1 to 100 handed on (the next leg starts at this) |
| `total` | whole metres 0 to 99,999,999, at least the sum of the listed legs |
| `seed` | base 36, 1 to 2^31-1, no leading zero: the next carrier's river |
| carriers | the last 8 at most, never more than `chain`; name 0 to 16 chars of letters, digits, space, `_ . -` (NFKC, trimmed, single spaces), distance 0 to 9,999 |

Decoding is all-or-nothing: the whole field must match one anchored pattern (max 320 chars), every number is range-checked, every name must equal its cleaned form, and fields that disagree (more carriers than `chain`, `total` below the listed legs) refuse the link. A refused link plays as "a flame nobody has carried yet" with a one-line note. Names only ever reach the page through `textContent` and canvas `fillText`. The outgoing link keeps only origin and path from the current address, so `lang`, `labRunSource` and other parameters are not passed on.

## Rules chosen

- Drop rule (setting `drop`, default `dims`). `dims`: "Try again" relights from the coals on the same river and chain, starting at 12 to 25% flame; "Light a new flame" is also offered. `ends`: only "Light a new flame". A new flame drops the link from the address and you become carrier 1, lit from a dock lamp.
- No rocks in the first 8 s (240 m); the first ember sits on the line at 105 m, so an idle boat takes it. A weak inherited flame (under 50%) gets three more embers on the line early.
- Rock and bank damage scale with the flame (`0.45 + 0.55 * flame`), so a weak flame is fragile but not hopeless.
- The flame handed on is the flame at the buoy, as a whole percent.

## Storage keys (localStorage, through `kit/save.js` and `kit/settings.js`)

- `flame:name`: your last name on the flame
- `flame:played`: set after the first finished leg (turns the drag hint off)
- `flame:hint`: the drag hint's own state (`kit/hint.js`)
- `flame:set:look`, `flame:set:drop`, `flame:set:sound`, `flame:set:haptics`: settings
- `kit/lab.js` keeps its own recording switch. This page records under its own lab slug, `flame-b` (flame-a records under `flame-a`); the settings slug `flame` is shared with flame-a.

## Test hooks

`window.flameState()` gives `{screen, playing, flame, progress, chain, carrier, paused, taking, source, link, look}`. `window.flameSim()` returns the live sim state. `window.flameAim(v)` steers as a finger would (`null` lets go). `window.flameWarp(sec, policy)` runs the leg on without waiting.

## Verified (2026-11-26)

- `node check.mjs` passes: link round trip; 35+ hostile links refused; seeker hands on 200/200 seeds (mean flame 89%); doing nothing lasts at least 20.5 s from a 25% flame and 26.2 s from a full flame, and finishes 11/200 against the seeker's 200/200; no rocks in the first 8 s; deterministic. `--mutate` (a river walled with rocks) must drop and does.
- A Playwright pass in headless Chromium (Pixel 7 profile) and WebKit (iPhone 13 profile), with touch pointer events: arrival text from a 23-carrier link; take; a steered leg; the handoff card with 8 names and yours; a hostile name cleaned; Pass gives a link (headless reports "copied"); the made link opened in a fresh context shows "Flame 24. <name> carried it ..." and starts at exactly the handed-on percent; a drop under `dims`, with screenshots of the named lights lit and then going dark (Try again relights from the coals at 25%); a hostile link refused with no injected element; a drop under `ends` and Light a new flame; settings and the Turkish switch; a real touch slide steers the boat both ways; P pauses and stops the sim, and a touch resumes it. No console errors and no requests off the local server in either engine.

## Faked or not done

- The `flame` slug is not registered in human-framework's lab prototypes, so a live recording would be refused. Registering it is outside this folder.
- No entry in `games.json` or `lab/index.html`: outside this folder. The phone check entry (`kit/check/lab-pages.mjs`, 2026-11-27) exists.
- Sam's boat in the arrival, and the chain lights behind it, are staged from the link's names and distances. They are not replays of anyone's leg.
- Carriers older than the last 8 have no names in the link. They show as up to 6 small unnamed lights.
- Links are not signed. Anyone can write a link with any chain, names and distances inside the valid ranges, so the numbers are a story, not a record.

## Could not check

- A real phone: frame rate (headless desktop showed a steady 16.7 ms frame, which says nothing about a mid phone), the share sheet (headless takes the copy path), vibration.
- Sound by ear.
- The Turkish has not been read by a native speaker.
- Difficulty with real thumbs: the seeker never drops, so the leg may be too easy for anyone who steers.
