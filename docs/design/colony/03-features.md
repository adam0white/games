# Cinderhill: features ranked

Ranked by what the game needs, in order. P0 is the vertical slice. Without it there is no game to judge. P1 is needed for season one to reach outside players. P2 is needed for the full campaign and friends' play. P3 is for later or wildcard. Inside each tier, items are in build order. Section numbers point to [02-spec.md](02-spec.md).

"Goal" names the design goal a feature serves (spec section 1, design goals), or "own" for one of our own twists.

## P0: vertical slice (one colony, three days, solo)

| # | Feature | Spec | Goal | Done when |
| --- | --- | --- | --- | --- |
| 1 | Deterministic integer sim: typed arrays, seeded random numbers, a 20 Hz tick, a state hash | 05-tech | saves | Same seed and commands give the same hash in Node, workerd, Chromium, WebKit and Firefox. The hash covers random-number state and pending events, not only ants. Flipping one known byte at a known tick makes the replay tool name the first subsystem that diverged |
| 2 | Surface grid and nest grid with entrances between them | 6.1 | | Ants walk between layers |
| 3 | Flow fields per goal and separation steering | 6.6 | no stuck goals | 2,000 ants reach 10 goals with none stuck for over 5 s in a 10-minute bot run |
| 4 | Scent field: lay, follow, fade and reinforce | 6.4 | | A trail to food grows stronger without input; an unused trail fades. An isolated trail's half-life is measured and matches the spec within 10% (8-bit decay by multiply-and-round can stall and never fade). Scent is double-buffered and does not leak through walls |
| 5 | Verbs: Trail, Dig, Recall, Alarm, with the tool strip and two-finger camera | 6.4 | retreat, fast orders | Each order shows a visible effect in under 0.5 s. A stroke commits on release; a second touch cancels it. After pinches, an interruption and a layer switch on real phones, the command log holds zero unintended orders. Crew counts and "why waiting" show on every order |
| 6 | Queen, eggs, larvae, pupae, adults; sugar and protein | 6.3 | | A colony grows from 1 queen to 100 ants in three days of play |
| 7 | Rooms by painting, with a worth number | 6.2 | | Each room shows its worth and the reason for it |
| 8 | Day length, one goal per day, dusk summary, dawn restart, autosave every 30 s and at dusk | 6.8, 6.9 | saves, short days | Kill the tab before, during and after a save; a reload resumes losing at most 30 s and matches uninterrupted play. Saves are versioned checkpoints plus a command suffix with a committed cursor, the previous good save kept. A full quota, an old save under a new build and two open tabs each have a defined, tested outcome |
| 9 | Tactical pause that takes orders | 6.4 | no active pause | Orders given while paused take effect on resume |
| 10 | Procedural ants with rig.js (close) and instanced shapes (far); the other-layer inset with alert pips | 9, 6.1 | smooth swarms | 2,000 ants at 30 frames a second on an iPhone 13 class phone |
| 11 | First-minute teaching with `kit/hint.js`, no reading | 8 | teaching | 4 of 5 first-time testers finish Day 1 with no help |
| 12 | One threat: the ant-eating spider that walks the trails, with a readable pattern | 6.5 | | Bots survive with Recall and die without it |
| 13 | Lab recording, English and Turkish, sound in code | 8, 9 | | A play record arrives in the lab |
| 14 | Bot players for tests (careful, greedy and idle) | 05-tech | | Bots finish the slice; the idle bot loses by Day 3 |
| 53 | Founding bloom: seed husks, two midden spots, a sprout at dawn that shelters foragers from a bird's shadow (the first part of 29) | 6.8, 8 | a world that changes, own | A new player places the second husk on purpose and predicts the safer route without help |

## P1: season one for outside players (Spring, 6 days)

| # | Feature | Spec | Goal |
| --- | --- | --- | --- |
| 15 | Rain and flooding through water cells; mounds and plugs | 6.2, 6.8 | own |
| 16 | Job sliders with response thresholds and age jobs | 6.3 | less busywork |
| 17 | Starvation guard: warning with cause and fix; queen's reserve | 6.3 | no starvation spiral |
| 18 | Birds, shown first as a shadow (a threat that punishes crowds in the open) | 6.5 | swarm does not simply win |
| 19 | Caste dial (larval feeding decides majors) | 6.3 | |
| 20 | Burr and the scent-note story scenes for Spring | 4 | own |
| 21 | Bands: up to three, optional | 6.4 | optional control |
| 22 | Difficulty: Gentle (rewind 1 minute), Standard, Hard | 1 | even difficulty |
| 23 | Help "?" on every thing, field guide pages | 8 | teaching |
| 24 | Daily hill with the lab's shared board | 7 | own |
| 25 | Phone check lines in `experiments/kit/check/phone.mjs` | 05-tech | |
| 26 | Spider toggle, colour-blind palettes, reduced motion, one-finger camera, zoom buttons, undo, tap-start/tap-end trails | 9, 6.4 | |
| 54 | Two strategic-depth test hills: late-campaign saves with the same ants and stores where the same commitment wins on one hill and loses on the other | roadmap | swarm does not simply win | An experienced player inspects the hill, changes plan, and cares about the ground kept |

## P2: full campaign and friends

| # | Feature | Spec | Goal |
| --- | --- | --- | --- |
| 27 | Friends' hill by link: server-ordered lockstep through a Durable Object, 2 to 4 players | 7, 05-tech | friends by link |
| 28 | Co-op campaign: a sister nest on the same hill | 7 | friends by link |
| 29 | Seeds, middens and bloom; plant growth changes the map | 6.8 | a world that changes, own |
| 30 | Tournaments: display contests with neighbours, ring capped at 30 a side; alliances | 6.7 | swarm does not simply win, own |
| 31 | Summer days: heat that closes the midday, antlion pits, the horned lizard | 4, 6.5, 6.8 | swarm does not simply win |
| 32 | Autumn and Winter days: night raids, the Pale Tide's front that moves each day, diapause | 4, 6.5, 6.8 | own |
| 33 | Scent disguise: wear a rival's scent to pass its guards | 6.5, bio 2.10 | own |
| 34 | The Changeling choice | 4 | own |
| 35 | Aphid herds placed on a chosen plant (route length against exposure); ladybirds ambient | 6.8 | own |
| 36 | Repletes (Jar-keeper allies) and living storage that can be stolen | 5, bio 1.1 | own |
| 37 | Head-plug doors (Thornback allies) | 5, bio 1.6 | own |
| 38 | Colony traits at each season's end | 6.10 | progress without grind |
| 39 | Autumn and Winter large animals (mole in the nest, shrew at the entrance) | 6.5 | |
| 40 | Fly parasites over crowds (ambient, never a scripted wave) | 6.5 | swarm does not simply win |
| 41 | Wedding flight ending, three closing scenes | 4 | |
| 42 | Skirmish against bots, Sandbox | 7 | |

## P3: later and wildcard

| # | Feature | Note |
| --- | --- | --- |
| 43 | New Hill+: daughter colony on a new seeded hill | Replay without grind |
| 44 | Second and third playable species in Friends' hill (Thornbacks, Jar-keepers, Leafstitchers) | Each needs its castes and a bot |
| 45 | Living bridges and chains (Leafstitchers) | Bio 2.8; needs pathing over changing cells |
| 46 | Quorum vote to move the nest (co-op) | Bio 2.7; a speed or accuracy choice |
| 47b | Bands: named groups with their own orders | Only if crews and job sliders prove too coarse; group selection is close to the reference game's rhythm |
| 47 | Rescue of wounded ants carried home | Bio 1.14. Another game in the genre has a medic caste built on this behaviour, so keep ours different (any worker can carry, timed window) or drop it |
| 48 | 3D look via `look3d.js` | Only if the frame gate allows |
| 49 | Guest book of myrmecophiles (beetles, crickets, caterpillars) | Collection for families |
| 50 | Share a picture of the bloom map (`kit/share.js`) | Reason to show a friend |
| 51 | Tide night: a co-op survival event mode | Wildcard |
| 52 | Many-player public hill on the Crumbwar model | Only if Friends' hill proves the demand |

## Wildcards for the lab (cheap experiments)

- **Bridge crew toy** (from the independent design, 10-fresh-design.md): ants lock together to span a crack, and every ant in the span is an ant not working. Tests whether "how many ants can I spare to stand still" is a decision people enjoy. If it is, it joins feature 45.

- **Trail painter toy:** the scent field and 5,000 ants on one page, no goals. Tests feel and frame rate on phones before the game exists.
- **Tournament toy (part of M0):** two colonies display in a ring capped at 30 a side while the player paces waves. Tests early whether display contests are fun, and whether freshness and timing beat raw numbers.
- **Ant mill trap:** a looping trail makes ants circle until they tire (a real behaviour). Could be a hazard the Tide falls into.
