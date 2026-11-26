# Cinderhill: roadmap

Round 3, 2026-11-26. From the M1 build to the first release. Milestones are ordered by dependency; there are no dates or time estimates. A milestone starts when the one before it passes its gate. Each is filed in the todo list (`docs/todo.md`, epic `lab-5w7`, label `cinderhill`). Feature numbers are from [03-features.md](03-features.md); numbers and pace lines are in [02-spec.md](02-spec.md) section 3.

## What changed from round 2

Round 2 had gates for hashes, frames, snapshots and unintended orders, and none for pace. Its first outside players came at M3, after Summer content. Both are fixed here: **the pace gate runs in CI on every pull request from R1's first step**, and **outside players come at R1**, on chapter 1 alone.

## Already done (kept from M0 and M1)

Spikes S1 to S4 passed (tick cost, determinism on four engines, phone frames emulated, snapshot size; numbers in `experiments/cinderhill/sim/SPIKES.md`). The M1 build has the sim, flow fields, scent, trails, digs, brood, the spider, Recall, the tactical hold, three looks, the lab replay record and `replay-lab.mjs`. The relay room role was chosen (05). The rebuild keeps what 05 marks "keep" and rewrites the rest.

## Milestones

| Milestone | What a player gets | Gate (who closes it) |
| --- | --- | --- |
| **R0 Pace harness** | Nothing new to play. replay-lab gains births, decision events and idle share; the median, passive and idle bots; the quota fixture (feature 1) | Agent: CI runs the gate on every pull request. The current build **fails** it, and the quota fixture fails it. A planted slow-down (brood ×10) fails it too |
| **R1 Chapter 1** | 02 section 4, on a phone: the swarm up from the deep, trails with crews, the husk, the bird, births, the sprout, the door jam, the chapter card (features 2 to 14) | Agent: the pace gate passes on 20 seeds. Five fresh phone players: 4 of 5 finish chapter 1 without help, and 4 of 5 place the husk on purpose. Then the owner plays it and says go on, change or stop |
| **Real-phone check** | The same build on one real mid-range phone | 30 frames a second at 2,000 ants in the free hill; chapter 1 at full speed. If it fails, lower the cap or draw far ants as density before R2 |
| **R2a Chapters 2 and 3** | Rain, water, structures, rooms, the spider, majors, the first now-or-later bill (15 to 20) | Pace gate on chapters 2 and 3. Owner plays both |
| **Depth check** | Two saves of chapter 3 with the same ants and stores, on two hills where a different plan wins | The owner plays both and changes crews or structures on the second for a reason they can name. If not, fix the systems before more chapters |
| **R2b Chapters 4 to 6** | Antlion slope, the neighbour colony and shared scent, storm night (21 to 23) | Pace gate on all chapters. Owner finishes Spring |
| **R2c Release** | Free hill, daily hill, share picture, accessibility, help, name check, listing page (24 to 29) | The release gates in 02 section 0 measured on outside players. Owner decides to list |
| **R3 Friends** | Same-seed challenge, ghost trails, then one shared colony, then versus (30 to 33) | Each step: four test clients (one sleeps, one retries an acknowledged order, the room restarts mid-join, a deploy lands mid-match), then the owner and one friend play on two phones |
| **After Spring** | Summer onward, re-cut into chapters with the same pace budget | Owner decides after R2c |

The lab toys in 03 (founding runs, fluid colony, ghost trails) can run beside R1 and R2. The founding runs toy answers decision 1 before R2b.

## R1 in build order

Each step is a pull request with bots, the pace gate and a phone check.

1. R0 first: the gate fails today's build.
2. New starting values and the porch store (feature 3). First delivery and first birth lines pass.
3. Crews, the who-goes rule, route cards, gap reasons (4). Doors and traffic (5).
4. Navigation goal manager (10), so crews, doors and structures do not run out of flow slots.
5. Husk, roof, bird (6). Sprouts and the bloom map (7).
6. Nest cutaway in place (8). Chapter card, Field into Ember (11).
7. Saves (9). Teaching (12). Recording, sound, words (13). Phone check (14).
8. Deploy unlisted at `/cinderhill/`; five fresh players; tell the owner.

## How we know it works

- **Pace gate** (02 section 3.1): bots on 20 seeds in CI; people from lab records. The quota fixture must fail.
- **Bots:** median, passive and idle on every chapter. The median bot must finish; the passive bot must finish chapter 1; the idle bot must lose by chapter 3; no seed may soft-lock.
- **Replays:** every lab record and bug report replays to the same hash with `replay-lab.mjs`.
- **Phone check:** `experiments/kit/check/phone.mjs`, plus one real phone at R1.
- **Not verifiable by agents:** fun, feel and real-phone audio. These are owner and tester gates.

## Risks

| Risk | Where it bites | Plan |
| --- | --- | --- |
| Fast pace makes it a toy with no depth | R2a | Depth check before chapters 4 to 6; the now-or-later bill; shared scent |
| 300 ants at the start are too many to read | R1 | Crews and route cards make the swarm readable; testers at R1; decision 6 has smaller starts |
| Faster walking makes trails look like streams, not ants | R1 | Owner plays R1; walk speed is a starting value |
| Water and structures cost too much CPU on phones | R2a | Water in dirty chunks; measured in the free hill at 2,000 ants before R2a ends |
| Shared-scent rivals feel unfair | R2b | The rival uses only the player's verbs; its scouts are visible; decoys work both ways |
| Real phones miss the frame line | Real-phone check | Lower the cap, density drawing at far zoom |
| The rebuild drifts from the spec again | All | The pace gate is in CI; 02 is the one source of numbers; changes to it go in NOTES.md and the pull request |
| Name collision | R2c | Name and trademark check before listing |
| A deploy resets live rooms | R3 | Rooms checkpoint to SQLite; clients reconnect and resume (05) |
