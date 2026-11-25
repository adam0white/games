# Cinderhill: roadmap

From spikes to release. Each milestone ends in something a person can play at `/cinderhill/` (unlisted until M4), and in a gate that only the owner closes by playing. Feature numbers are from [03-features.md](03-features.md). Dates are targets at the lab's current pace (several agent threads a day), not promises. Each milestone and spike is filed in the todo list (`docs/todo.md`, label `cinderhill`).

| Milestone | Target | What a player gets | Gate (who closes it) |
| --- | --- | --- | --- |
| M0 Spikes | 2026-11-30 | Three lab pages: trail painter, determinism check, phone frame test | Numbers below pass (agent) |
| M1 Vertical slice | 2026-12-10 | Days 1 to 3 solo: trail, dig, rooms, brood, spider, saves (features 1 to 14) | Owner plays Day 1 to 3 and says go on, change or stop |
| M2 Spring | 2026-12-24 | Six days of Spring with rain, threats, jobs, difficulty, help, daily hill (15 to 26) | 5 lab testers: 4 of 5 finish Day 1 unaided (agent reads records); owner plays |
| M3 Friends | 2027-01-10 | Friends' hill by link, co-op Spring with a sister nest (27, 28) | Owner and one friend play a match on two phones |
| M4 Summer and outside players | 2027-01-31 | Bloom, tournaments, Summer days, Changeling (29, 30, 34, 35) | Listed on the site. Release gates in 02-spec section 0 measured on outside players |
| M5 Full campaign | 2027-03 | Autumn, Winter, the Tide, allies, traits, wedding flight (31 to 42) | Owner finishes the campaign |
| M6 Release | after M5 | Polish, name check, store-ready page | Owner decides to publish |

## M0: spikes (each has a pass line and a fail plan)

| Spike | Measures | Pass | If it fails |
| --- | --- | --- | --- |
| S1 Tick cost | Integer sim, 5,000 ants, 3 scent fields at 256 by 256 and 4 flow fields, in Node and in a Durable Object (`wrangler dev`, then deployed) | Under 10 ms a tick locally; 20.0 ticks a second deployed for 10 minutes | Cap ants at 2,000, or coarse fields at half resolution; Bevy/WASM sim is the last resort |
| S2 Determinism | Same seed and 10 minutes of recorded commands in Node, workerd, Chromium, WebKit and Firefox | Same hash everywhere. A planted `Math.sin` must make the check fail | Use coarse server state (05-tech option B) for friends' play; solo is not affected |
| S3 Phone frames | Instanced ants plus terrain and scent overlay at 2,000 and 5,000 ants, Playwright WebKit (iPhone 13) and Chromium (Pixel 7), then a real phone | 30 frames a second at 2,000 | Lower the cap, or draw far ants as density shading |
| S4 Snapshot size | Late-join snapshot of a dug nest plus 5,000 ants, compressed | Under 64 KB | Send terrain as a seed plus a dig log |

The trail painter (S3's page) is also the first thing the owner can touch: a phone page where you draw trails and watch thousands of ants find food.

## M1: vertical slice, in build order

1. `shared/` sim core: grids, ants as typed arrays, tick, hash, seeded random numbers, command log (feature 1).
2. Layers, flow fields, scent field (2 to 4). Bot harness from the first day (14).
3. Verbs and the pause (5, 9). Brood and economy (6). Rooms (7).
4. Renderer: instanced far ants, `rig.js` near ants, ink-and-wash terrain (10).
5. Days, dusk summary, saves (8). Spider (12).
6. First minute (11). Lab recording, words, sound (13).
7. Phone check lines; deploy unlisted; tell the owner.

Each step is a pull request with bots and a phone check, as in Ant Promotion.

## How we know it works

- **Bots** (`bots.mjs`, Ant Promotion style): careful, greedy and idle players run every day on many seeds. The careful bot must finish, the idle bot must lose, and no seed may soft-lock.
- **Replays:** every bug report carries the seed and command log, so an agent can replay the exact game.
- **Phone check:** `experiments/kit/check/phone.mjs` gets Cinderhill's section and seed save at M1.
- **Lab records:** Day 1 completion and help opened, read with the lab tools after each test round.
- **Not verifiable by agents:** feel, fun and real-phone audio. These are owner and tester gates.

## Risks

| Risk | Where it bites | Plan |
| --- | --- | --- |
| Lockstep desyncs | M3 | S2 first; hash per subsystem; replay harness; snapshot on mismatch |
| Indirect control feels vague on a phone | M1 | Order feedback in under 0.5 s; owner gate at M1 before building more |
| Two layers confuse new players | M1 to M2 | One gesture to switch; the first two days stay mostly on one layer |
| Scope: four seasons, five species | M5 | Seasons ship one at a time; species beyond the player's are P3 |
| Name collision | M6 | A trademark and store search before anything public |
