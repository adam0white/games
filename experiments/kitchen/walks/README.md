# Walks through the real page

Scratch-quality Playwright scripts behind the claims in `../NOTES.md`. They are not run in CI. Each serves the
`experiments/` folder itself, plays through the page's own test hooks (`kitchenState`, `kitchenRush`, `kitchenRushAct`)
and real pointer and key input, writes screenshots, and prints one JSON result and an `errors [...]` line.

Run from anywhere, one at a time (two walks at once starve each other's frames):

    PLAYWRIGHT=<a node_modules folder with playwright> VW=390 VH=844 node people.mjs <path to experiments> <shots dir> <tag>

| script | what it walks | extra env |
|---|---|---|
| `people.mjs` | a full Rush with guests as people: halos clear of the tray, models gone after quit | `LOC`, `PEOPLE=off`, `MEM=1` |
| `edge.mjs`, `edge-day.mjs` | pause, quit and setting changes mid-stunt; the ordinary day's wheel | |
| `wide.mjs` | wide-screen camera: Guests off and on, a turn and a turn back, tray height after quit | `END=1` |
| `sizes.mjs` | one staged catch shot per size; `WxH:via` arrives from landscape | `SIZES=320x568:via,1280x720`, `PART=turn` or `slap` |
| `trays.mjs` | tray unlocks at six and at all stamps, kept after reload, junk storage | `PART=looks LOOKS=diner,toon` |
| `shop.mjs` | the shop's tray box in two languages; the slap mission to its end card | |
| `journey.mjs` | nine shots of one sitting for a cold outside read | |
| `ladder.mjs` | the Rush ladder from a pre-ladder save: shift 1, shift 2 with its mission, pips, the locked pip, a replay | `FIRST=1` for a first-ever Rush |

Lessons that cost time: an ordinary-day walk must tap Play, tap the story card's button, and retry `kitchenCall(0)`
until it returns true; frying needs Space held to the middle of the band; never edit game files while a walk is
loading pages; when a walk reports the game stuck, suspect the walk first.
