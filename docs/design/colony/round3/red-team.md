# Cinderhill red-team review (round 3)

Lens: adversarial. Assume the rebuild follows the docs faithfully and still fails with outside players.

## Five-line summary

1. The slowness is in the spec, not only in the build: the spec makes "one day" (8 to 12 min) the unit of every clock — growth, threats, new verbs, goals, bloom and teaching — so the first consequence of any decision lands 10 or more minutes in. The spec's own first minute (one worker, payoff "at dawn of Day 2") is *slower* than what was built.
2. Every review round added safety rails (saves, desync, pinch-cancel, hashes). None added a pacing number. The 12 ranked traps in 09 do not mention slowness once, so the agents tuned what could be measured and passed every gate except the only one a person grades.
3. The premises that fail hardest with outsiders are a 24-day, 4-to-5-hour campaign as the release definition, a bloom score that pays out over days, stakes removed on every axis (Tide can't win, queen can't die, all three endings are wins, days restart), and tournaments that are a direct-control minigame dressed as indirect control.
4. Cut list: the 24-day arc down to one 20-to-30-minute run; Winter, wedding flight, New Hill+, the Changeling and two of three neighbour species; lockstep friends' play from the release path; the day as a pacing unit (keep it only as a save point). Add hard pacing budgets that bots and `replay-lab.mjs` check.
5. Clean room is mostly sound. The remaining closeness is in natural-history framing (field guide, "real basis" everywhere, a field-guide-plate look), which recreates the reference game's documentary identity without the narrator. Ladybirds on aphids, phorid flies and night raids each echo its advertised features.

## Answer to the central question

Both, with the spec as the main cause. The build drifted in one direction only: it started with 20 workers and a delivery quota instead of the founding scene (evidence.md, last section). That drift made the opening *faster* than the spec's. Every slow number in the evidence is a spec number, taken literally:

| Pace fact in the replays (evidence.md) | Spec sentence that produces it (checked) |
| --- | --- |
| No birth in any session; egg to adult 9.5 min | 02-spec §10 line 259 "Egg to adult: about 1 day of play"; 03-features line 16 "1 queen to 100 ants in three days of play" (30 min to reach 100 ants) |
| No threat in any session | 02-spec §8 line 238 "Each day adds at most one new verb or threat, first in a safe form"; NOTES "The spider" — the Day 2 visit eats no one, so the first threat with a cost arrives at about minute 20 |
| First food at 73 s or never | 02-spec §10 line 255 a 256 × 256 map at "one cell about one ant length"; ants walk about 1.9 cells a second (`sim.js` line 46, checked), so a 47-cell trail is about a 50 s round trip |
| Nothing to decide in the first two minutes | 02-spec §6.9 line 212 "One goal per day"; line 214 "a decision floor: each day must pose at least one choice the day before could not" — a floor of one new choice per 10 minutes |
| Longest session was the goal-less 5,000-ant sandbox | 02-spec §10 line 253 "300 to 600 ants by end of Spring" — the spectacle people stayed for is withheld until hour one |

The rebuilt spec must state pace as numbers with the same force it gives to frame rate and determinism (see the proposed budgets in finding 1).

## Findings

| # | Finding | Evidence | Severity | Proposed change |
| --- | --- | --- | --- | --- |
| 1 | The spec has gates for hashes, frames, snapshot bytes and unintended orders, but no number for time-to-first-consequence, decisions per minute or idle gaps. Agents optimised what had a pass line. | 02-spec §0 lines 11–19 (checked); 04-roadmap S1–S4 lines 20–23 (checked); all four spikes passed in about a day (evidence.md) | blocker | Add a §0 "Pace budget", checked by bots and `replay-lab.mjs` on every PR: first delivery ≤ 15 s; first birth ≤ 90 s; first threat that can cost something ≤ 3 min; no 30 s stretch without a pending decision (replay-lab already flags 60 s stalls); a meaningful choice at least every 60 s. Each one fails CI when it is missed. |
| 2 | "Day" is a save boundary taken from the save complaint (the reference's 40-minute missions), then reused as the pacing unit for everything. Saves and pause already answer that complaint, so days are not needed for it. | 02-spec §1 line 59 "Short days (8 to 12 minutes) that end in a save"; 01 line 256 (checked) | blocker | Decouple: days stay as autosave chapters and a story beat. Growth, threats and verbs run on their own clocks, measured in seconds (see 1). |
| 3 | The spec's own first minute is sparser than the build: one queen, one larva, one worker, one seed. The only Day 1 decision (where the husk goes) pays off "at dawn of Day 2", so after 10 minutes. The founding gate needs a player to survive 10 minutes on one decision. | 02-spec §8 lines 235–237 (checked); feature 53 line 25 | blocker | Compress the founding loop to 90 s: seed in at 15 s, husk choice at 30 s, sprout and a bird shadow by 60 to 90 s. Keep the premise and drop the clock. |
| 4 | Indirect control by scent is a commit-and-wait verb. "Effect within 0.5 s" (ants turn) is not the consequence; the consequence (food home, a birth) is 50 s to 10 min away. On a phone at 20 ants that reads as watching. The risk table answers "feels like watching" with "one goal per day", which is the cause. | 02-spec §6.4 line 173; 04-roadmap line 56 (checked); replays c to g | major | Give every order an outcome readout within 5 s (predicted trip time, loads per minute, a crew bar filling). Start with 60+ ants so trails visibly fill. Shorten maps around the nest: food within 10 to 15 cells on Day 1. |
| 5 | Stakes are removed on every axis at once: the Tide is "never beaten" and cannot end you; a dead queen is replaced by a gamergate; all three endings are wins; a lost day restarts from dawn; a floor gifts seeds. Combined with slow pace, nothing is at risk while you wait. | 02-spec lines 93, 106, 185, 213 (checked); NOTES days floor rule | major | Keep the mercy features (restart, floor) but make loss real inside a run: the Tide *can* take the hill on Standard; a queen loss ends the run on Standard and Hard. Then "holding the top" means something. |
| 6 | Release is defined against a 24-day, 4-to-5-hour campaign, and the solo release gate is measured on outsiders only at M3, after Summer content. Outside players meet the game for the first time after the most expensive content is built. Browser players in the replays left in 1 s to 2 min. | 02-spec §0 lines 13–15, §7 line 226; 04-roadmap line 11 (checked); replays a to f | major | Put outside players at M1. Define release as one 20-to-30-minute run (one season) that outsiders finish and replay. The campaign is post-release. |
| 7 | Bloom is the campaign score, and it grows "over days". The reward a player shows a friend is days away from the action that earned it. | 02-spec §6.8 line 207 (checked) | major | Make a sprout appear within a minute of a husk landing, and plants grow within one session. Bloom map shareable after the first run. |
| 8 | Tournaments, the main path to allies, are in practice a direct-control timing minigame (Send wave, Hold, Rotate) inside an indirect-control game, and they arrive in Summer, about hour one. The toy is proven only by bots; the careful bot beats the Leafstitchers 18% of the time; no person has played it. | 02-spec §6.7 lines 197–200; `experiments/lab/cinderhill-tournament/NOTES.md` rules and "Not verified" (checked) | major | Treat the tournament as an optional set piece, not the only ally path. Allies also come from trade or shared defence. Owner and two outsiders play the toy before it is kept. |
| 9 | The depth gate tests late-campaign strategy (hour three) while minute three is failing. | 04-roadmap line 10; feature 54 (checked) | major | Move the depth gate after a pace gate. The first depth test is "two different openings on two seeds within 10 minutes". |
| 10 | Lockstep friends' play shaped the whole sim (integer, typed arrays, determinism spikes) for a mode that lands at M4. The determinism did pay off: every replay in evidence.md exists because of it. The cost is that M0 spent its effort on infrastructure, and the owner's first touch was a sandbox. | 05-tech lines 15, 30; 04-roadmap M0 lines 7, 20–23 (checked) | minor (cost already paid) | Keep the deterministic sim for replays. Remove lockstep from the release path. The first friends' mode is a short co-op or tournament match with a relay room, after solo pace passes. |
| 11 | "Agents cannot verify fun" was used to leave fun with no proxy at all. Several fun proxies can be read from replays: session length, time to first order and the gap after it, voluntary replays, sandbox time vs colony time. | 04-roadmap line 46 (checked); `spikes/replay-lab.mjs` header lines 6–9 (checked) | major | Agents gate on these proxies; the owner gates on taste. A build may not go to the owner until bots and a replay of a scripted novice meet the pace budget. |
| 12 | Two layers plus an inset plus a tool strip on a phone at 20 ants splits attention while there is little to look at on either layer. | 02-spec §6.1 lines 128–131; risk line 54 (checked) | minor | First session on the surface only, with the nest as a tap-in close-up. The nest layer opens when the first dig matters. |
| 13 | The campaign ask exceeds what the map holds: later days ask for more food than the piles contain, so a long campaign ends in lost days. | NOTES "Days" open item (checked) | minor | Regrowing food tied to bloom; this also links the score to the economy. |

## Three post-mortems

### Post-mortem A: "Nothing happened for ten minutes"

We built it to spec. A stranger opened the link on a phone: one queen, one larva, one worker. They drew a line to a seed. The worker walked for about half a minute. The larva ate. The game asked where the husk should go and then showed nothing until dusk, eight minutes later. Most testers left before the first sprout. The 80% Day-1 gate (02-spec line 13) was measured only on those who stayed, and the end-card majority came from the same survivors, despite the denominator rule.

Traced to: 02-spec §8 lines 235–237 (payoff "at dawn of Day 2"); §10 line 259 (egg to adult about one day); line 238 (one new thing per day); 03-features line 16 (100 ants after 30 minutes). Replays a to f are the early form of this failure.

What would have prevented it: the pace budget (finding 1), with every clock in seconds, and the day kept only as a save.

### Post-mortem B: "A beautiful, safe, four-hour documentary nobody finished"

We built all four seasons. Each passed its owner gate, because the owner played each one alone in a separate sitting. Outsiders met the game at M3 (roadmap line 11), after Summer. They found a game they could not lose: the Tide cannot win, the queen is replaced, every ending is a win, every bad day restarts. Tournaments asked them to switch into a timing minigame. Allies and bloom paid out in hours two and three. Season one (one hour) was finished by too few people to read a recommend rate.

Traced to: 02-spec §0 lines 13–15 (gates for Day 2 and the 6-day season); §4 lines 93, 106; §6.5 line 185; §6.7; §6.8 line 207; §7 line 226 (24 days, 4 to 5 hours); 04-roadmap lines 10–13 (outsiders after the depth gate and Summer).

What would have prevented it: release as one 20-to-30-minute run with real loss, outsiders at M1, and allies and bloom paying out inside the run.

### Post-mortem C: "Every gate passed; the game was not fun"

Every gate an agent could close passed in a day: hashes on five engines, 70 fps, 60.7 KB snapshots, zero unintended orders, bots that win when careful and lose when idle. Each review round added the next rail: saves, desync, eviction, pinch-cancel. The spec reached its third review with twelve ranked traps, none of them pace. The only gate about fun was the owner playing 30 minutes per milestone. He gave it 7 minutes and said "too slow and still too basic."

Traced to: 09-round2-findings lines 54–69 (the trap list, checked: no trap on pace or slowness); lines 26–52 (25 rows: most prevent failures; a few touch fun, such as the founding bloom, the depth gate and crew readouts; none touch tempo); 04-roadmap line 41 (bots must win when careful and lose when idle — this shows a goal is not trivial, not that it is interesting); line 46.

What would have prevented it: pass lines for fun proxies that agents can measure (finding 11), written before the engineering spikes, with the same CI force.

## Where the spec optimises for being reviewable over being played

- Every system has a "Real basis" column or a biology citation (02-spec §5, §6.2, §6.3, §6.7, §6.8). Defensibility drove the numbers: real brood takes weeks, so "one day" felt like a generous compression. The players never see the column.
- The clean-room table, the gates with denominators, the planted-mutation tests and the ranked traps all show diligence to a reviewer. None of them tells a builder how fast the first ant should come home.
- Every number has a pass line except the ones that decide fun. Frame rate has a target (30 fps at 2,000 ants). Pace has "8 to 12 minutes" for a day and nothing per minute.
- NOTES' "Choices the owner may want to change" lists defer pace to the owner as if it were taste. Pace is measurable, and an agent can own it.
- The decision floor ("can they say what they decided today") is a gate a reviewer can read off a transcript. It sets the bar at one decision per day.

## What I would cut

| Cut | Why | Keep instead |
| --- | --- | --- |
| The 24-day campaign as the definition of done | Hours of content before any outsider plays | One season as a 20-to-30-minute run, replayable on new seeds |
| Winter, Spring-again, the wedding flight, New Hill+ | Content for players who finished a campaign that does not exist yet | A daughter queen as the run's ending, if a scene is wanted |
| Two of the three neighbour species | Three rival AIs plus three ally behaviours | One neighbour, one ally rule |
| The Changeling | A whole-campaign payoff (adopted Summer, pays Autumn) | Revisit once a run is fun |
| Lockstep friends' play on the release path | Highest engineering risk; arrives after release anyway | Short co-op or tournament match later, relay room |
| The day as a pacing unit | Root cause of slowness | Day as autosave chapter and dawn card only |
| An unbeatable Tide | Removes stakes | A Tide that can win on Standard; held off by allies and terrain |

## Clean-room line

Mostly sound. The narrator, the hex tiles and their adjacency upgrades, the numbered pheromone groups, the gene-stealing species and jelly, the lab framing and named bosses are all gone (02-spec §1 table, checked against 01). Honeypot ants are close to the reference only on paper: 01 line 103 lists honeypot as a cancelled species there.

Remaining closeness, from most to least:

1. **Natural-history framing as identity.** The reference game is sold as a narrated wildlife documentary, and reviewers cite "I learned about ants" (01 line 219, checked). Cinderhill removes the narrator but rebuilds the same identity elsewhere: field-guide pages (02-spec §8 line 239), "real basis" notes on every system, the gamergate rule that "the game says so in its field guide" (line 106), and the Field look, styled as a "field-guide plate" (NOTES Looks). Each piece is fine alone. Together they recreate the reference's tone through another channel. This is a judgment call, not a rule breach. The owner should decide it as taste, alongside the look pick.
2. **Ladybirds that thin an aphid herd.** The reference's store page advertises this exact pairing (01 line 48). The 09 fix changed the decision but kept the pair (02-spec line 208). Drop ladybirds, or make the threat something else (ants farming aphids also fight parasitoid wasps, from memory).
3. **Phorid fly parasites.** These are a formicarium challenge in the reference (01 lines 107, checked). Ours are ambient over crowds, which is a different shape. Keep them, but do not stage them as a challenge.
4. **Night raids and nocturnal hunters.** Advertised in the reference (01 line 74). This is a genre convention (SimAnt and others, from memory). Low risk.
5. **Spider-to-beetle toggle.** The reference has an arachnophobia mode (01 line 110). Many games have this; it is an accessibility convention. Low risk.

## Claim status

Checked (I read the files): every 02-spec, 03-features, 04-roadmap, 05-tech and 09 line cited; `experiments/cinderhill/NOTES.md`; `sim/sim.js` line 46 (walk speed); `sim/colony.js` constants; `experiments/lab/cinderhill-tournament/NOTES.md`; the `replay-lab.mjs` header; the 01 lines cited; evidence.md.
From memory: horned-lizard and parasitoid-wasp biology; SimAnt having night threats.
Not checked: the real-phone feel of any of this; whether the owner has played the tournament toy (no verdict is recorded in `experiments/lab/NOTES.md`).
