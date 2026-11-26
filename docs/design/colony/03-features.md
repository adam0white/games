# Cinderhill: features ranked

Round 3, 2026-11-26. Ranked by what the rebuild needs, in build order inside each tier. Section numbers point to [02-spec.md](02-spec.md); numbers and pace lines are in 02 section 3 only. "Old" gives the round-2 feature number where one exists.

- **R1: chapter 1.** The first five minutes of 02 section 4, playable on a phone, passing the pace budget. Nothing else is judged until this passes.
- **R2: Spring.** Six chapters, free hill, daily hill. The first release for outside players.
- **R3: friends.** In the order of 02 section 9.
- **Later.** After Spring proves the game.

## R1: chapter 1

| # | Feature | Spec | Old | Done when |
| --- | --- | --- | --- | --- |
| 1 | Pace gate: replay-lab reports births, decision events, idle share and first-delivery times; the median, passive and idle bots; the old quota opening as a failing fixture; runs on every pull request | 3.1 | new | CI fails a pull request that breaks any line of 02 section 3.1, and fails if the quota fixture passes |
| 2 | Deterministic integer sim kept: typed arrays, seeded random numbers, 20 Hz tick, per-subsystem hashes | 05 | 1 | As round 2: same hash in Node, workerd, Chromium and WebKit; a flipped byte names its subsystem |
| 3 | New starting values: walk speeds, porch store, shallow nest, start colony with pupae, 60 s brood | 3.2 | 6 | Pace lines for first delivery and first birth pass |
| 4 | Crews and route cards (Light, Steady, Surge, plus and minus), the who-goes rule, gap reasons | 6.2 | 5 | A bot changes a crew and loads a minute change within 5 s; every card names its gap reason |
| 5 | Doors with throughput, jam marker, loads a minute on routes | 6.2 | new | 300 ants through one door jam; a second door clears it |
| 6 | Husk as a placeable object; roof cover; bird with a shadow telegraph | 4, 6.4, 6.5 | 53, 18 | A new player places the husk on purpose and sees the bird's result inside a minute (4 of 5) |
| 7 | Midden sprouts in 45 to 90 s; bloom map | 6.6 | 29 | A sprout stands by minute 2 in the median bot run |
| 8 | Nest cutaway that opens in place over the entrance | 6.7 | 2 | Births and stores are visible without leaving the surface |
| 9 | Saves: IndexedDB checkpoint every 20 s and at chapter start, previous good save kept, one tab owns a game | 05 | 8 | Kill the tab before, during and after a save; reload loses at most 20 s and matches uninterrupted play |
| 10 | Navigation goal manager: goals beyond 16, incremental rebuilds, no `Uint16` saturation | 05 | 3 | 64 goals live at 2,000 ants inside the tick budget |
| 11 | Chapter card at dusk, Field into Ember | 4, 12 | 8 | The card shows stores, ants, sprouts, losses and a continue button |
| 12 | Wordless first-minute teaching with `kit/hint.js` | 4 | 11 | 4 of 5 fresh phone players finish chapter 1 without help |
| 13 | Lab recording with full replays, sound in code, English and Turkish | 12 | 13 | A record arrives in the lab and replays to the same hash |
| 14 | Phone check section for Cinderhill | 05 | 25 | `phone.mjs` passes before and after |

## R2: Spring (first release)

| # | Feature | Spec | Old |
| --- | --- | --- | --- |
| 15 | Water automaton as its own hashed subsystem; rain pulses with telegraphs | 6.5 | 15 |
| 16 | Structures: span, ramp, roof, plug, channel, mound; marked spots, then free placement | 6.5 | new |
| 17 | Rooms with painted purpose and a worth number | 6.5 | 7 |
| 18 | Now-or-later bill at chapter end; starvation warning | 6.1 | 17 |
| 19 | Caste dial and majors; frontage contact slots in combat | 6.3, 6.4 | 19 |
| 20 | The scent-wearing spider; Alarm; decoy trails | 6.4 | 12 |
| 21 | Antlion pits; spoil spots | 6.4 | 31 |
| 22 | Neighbour colony: AI on the player's verbs and rules; shared scent; raids | 6.4 | new |
| 23 | Chapters 2 to 6 with their ends; stakes, retry from checkpoint, floor; Gentle, Standard, Hard | 8 | 22 |
| 24 | Free hill (200 to 5,000 ants, toggles) | 8.3 | 42 |
| 25 | Daily hill, 5 min, lab board, replay link to the best run | 8.3 | 24 |
| 26 | Share picture of the bloom map (`kit/share.js`) | 6.6 | 50 |
| 27 | Accessibility: spider toggle, colour-blind palettes, one-finger camera, zoom buttons, undo, tap trails, reduced motion | 12 | 26 |
| 28 | Help "?" on every thing (one line, words only if decision 4 allows) | 5 | 23 |
| 29 | Name and trademark check, listing page | 2 | new |

## R3: friends

| # | Feature | Spec | Old |
| --- | --- | --- | --- |
| 30 | Same-seed challenge by link | 9 | new |
| 31 | Ghost trails on the daily hill | 9 | new |
| 32 | One shared colony, 2 to 4 players, relay room lockstep | 9, 05 | 27, 28 |
| 33 | Versus on one hill | 9 | 27 |

## Later

Seasons after Spring (old 31, 32, 39), the invading supercolony and allies (32, 36, 37), scent disguise (33), traits (38), wedding flight and New Hill+ (41, 43), more playable species (44), living bridges (45), quorum nest move (46), tournaments as an optional set piece (30), the Changeling (34, kept in 07), guest book (49), the 3D look (48), a many-player public hill (52). Bands stay out (old 21, 47b). Rescue of wounded ants stays out (old 47). Aphid herds return only without ladybirds (old 35).

## Lab toys (one page each under `experiments/lab/`, each with an owner pass line)

| Toy | Tests | Pass line |
| --- | --- | --- |
| Founding runs | A 20-min roguelite run per queen, bloom kept between runs, against chapters (decision 1) | The owner plays two runs and says whether they would rather have this than chapters |
| Fluid colony | Far ants as a density field moved by the flow fields, near ants as individuals, Ember look, 50,000 ants | 30 frames a second on a real phone at 50,000, and the owner keeps it open for five minutes |
| Ghost trails | Shared fading scent from past runs on one seed | Testers say the ghosts changed a route they drew |
| Bridge crew | Ants that lock into a span cannot work | Kept from round 2 |
