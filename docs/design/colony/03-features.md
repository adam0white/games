# Cinderhill: features ranked

Ranked by what the game needs, in order. P0 is the vertical slice. Without it there is no game to judge. P1 is needed for season one to reach outside players. P2 is needed for the full campaign and friends' play. P3 is for later or wildcard. Inside each tier, items are in build order. Section numbers point to [02-spec.md](02-spec.md).

"Answers" names the reference game complaint a feature fixes (see the spec, section 1), or "own" for our own twist.

## P0: vertical slice (one colony, three days, solo)

| # | Feature | Spec | Answers | Done when |
| --- | --- | --- | --- | --- |
| 1 | Deterministic integer sim: typed arrays, seeded random numbers, a 20 Hz tick, a state hash | 05-tech | crashes, saves | Same seed and commands give the same hash in Node, Chromium, WebKit and Firefox |
| 2 | Surface grid and nest grid with entrances between them | 6.1 | | Ants walk between layers |
| 3 | Flow fields per goal and separation steering | 6.6 | pathing soft-locks | 2,000 ants reach 10 goals with none stuck for over 5 s in a 10-minute bot run |
| 4 | Scent field: lay, follow, fade and reinforce | 6.4 | | A trail to food grows stronger without input; an unused trail fades |
| 5 | Verbs: Trail, Dig, Recall, Alarm | 6.4 | no retreat, slow orders | Each order shows a visible effect in under 0.5 s |
| 6 | Queen, eggs, larvae, pupae, adults; sugar and protein | 6.3 | | A colony grows from 1 queen to 100 ants in three days of play |
| 7 | Rooms by painting, with a worth number | 6.2 | | Each room shows its worth and the reason for it |
| 8 | Day length, dusk summary, autosave every 30 s and at dusk | 6.8, 1 | no save, long missions | Kill the tab at any time; a reload resumes losing at most 30 s |
| 9 | Tactical pause that takes orders | 6.4 | no active pause | Orders given while paused take effect on resume |
| 10 | Procedural ants with rig.js (close) and instanced shapes (far) | 9 | performance | 2,000 ants at 30 frames a second on an iPhone 13 class phone |
| 11 | First-minute teaching with `kit/hint.js`, no reading | 8 | onboarding | 4 of 5 first-time testers finish Day 1 with no help |
| 12 | One threat: the wolf spider, with a readable pattern | 6.5 | | Bots survive with Recall and die without it |
| 13 | Lab recording, English and Turkish, sound in code | 8, 9 | | A play record arrives in the lab |
| 14 | Bot players for tests (careful, greedy and idle) | 05-tech | | Bots finish the slice; the idle bot loses by Day 3 |

## P1: season one for outside players (Spring, 6 days)

| # | Feature | Spec | Answers |
| --- | --- | --- | --- |
| 15 | Rain and flooding through water cells; mounds and plugs | 6.2, 6.8 | own |
| 16 | Job sliders with response thresholds and age jobs | 6.3 | tedious micro |
| 17 | Starvation guard: warning with cause and fix; queen's reserve | 6.3 | starvation spirals |
| 18 | Antlion pits and birds (threats that punish crowds) | 6.5 | bigger swarm wins |
| 19 | Caste dial (larval feeding decides majors) | 6.3 | |
| 20 | Burr and the scent-note story scenes for Spring | 4 | own |
| 21 | Bands: up to three, optional | 6.4 | late-game group management |
| 22 | Difficulty: Gentle (rewind 1 minute), Standard, Hard | 1 | difficulty spikes |
| 23 | Help "?" on every thing, field guide pages | 8 | onboarding |
| 24 | Daily hill with the lab's shared board | 7 | own |
| 25 | Phone check lines in `experiments/kit/check/phone.mjs` | 05-tech | |
| 26 | Spider toggle, colour-blind palettes, reduced motion | 9 | |

## P2: full campaign and friends

| # | Feature | Spec | Answers |
| --- | --- | --- | --- |
| 27 | Friends' hill by link: server-ordered lockstep through a Durable Object, 2 to 4 players | 7, 05-tech | no multiplayer |
| 28 | Co-op campaign: a sister nest on the same hill | 7 | no multiplayer |
| 29 | Seeds, middens and bloom; plant growth changes the map | 6.8 | thin content, own |
| 30 | Tournaments: display contests with neighbours; alliances | 6.7 | bigger swarm wins, own |
| 31 | Summer, Autumn and Winter: heat, night raids, diapause | 4, 6.8 | |
| 32 | The Pale Tide: a front that moves each day | 6.5 | own |
| 33 | Scent disguise: wear a rival's scent to pass its guards | 6.5, bio 2.10 | own |
| 34 | The Changeling choice | 4 | own |
| 35 | Aphid herds, ladybirds | 6.8 | own |
| 36 | Repletes (Jar-keeper allies) and living storage that can be stolen | 5, bio 1.1 | own |
| 37 | Head-plug doors (Thornback allies) | 5, bio 1.6 | own |
| 38 | Colony traits at each season's end | 6.9 | grind for meta-currency |
| 39 | Season beasts 2 to 4 (centipede, mole, shrew) | 6.5 | |
| 40 | Fly parasites over crowds | 6.5 | bigger swarm wins |
| 41 | Wedding flight ending, three closing scenes | 4 | |
| 42 | Skirmish against bots, Sandbox | 7 | |

## P3: later and wildcard

| # | Feature | Note |
| --- | --- | --- |
| 43 | New Hill+: daughter colony on a new seeded hill | Replay without grind |
| 44 | Second and third playable species in Friends' hill (Thornbacks, Jar-keepers, Leafstitchers) | Each needs its castes and a bot |
| 45 | Living bridges and chains (Leafstitchers) | Bio 2.8; needs pathing over changing cells |
| 46 | Quorum vote to move the nest (co-op) | Bio 2.7; a speed or accuracy choice |
| 47 | Rescue of wounded ants carried home | Bio 1.14. The reference game has a medic caste on this behaviour, so keep ours different (any worker can carry, timed window) or drop it |
| 48 | 3D look via `look3d.js` | Only if the frame gate allows |
| 49 | Guest book of myrmecophiles (beetles, crickets, caterpillars) | Collection for families |
| 50 | Share a picture of the bloom map (`kit/share.js`) | Reason to show a friend |
| 51 | Tide night: a co-op survival event mode | Wildcard |
| 52 | Many-player public hill on the Crumbwar model | Only if Friends' hill proves the demand |

## Wildcards for the lab (cheap experiments)

- **Trail painter toy:** the scent field and 5,000 ants on one page, no goals. Tests feel and frame rate on phones before the game exists.
- **Tournament toy:** two bot colonies display in a ring while the player paces waves. Tests whether display contests are fun on their own.
- **Ant mill trap:** a looping trail makes ants circle until they tire (a real behaviour). Could be a hazard the Tide falls into.
