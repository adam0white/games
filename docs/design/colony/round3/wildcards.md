# Cinderhill review, lens: wildcards

1. Slowness is in the spec and in the build. The spec sets the tempo in days (8 to 12 minute days, egg to adult in one day, one new thing per day). The build then dropped the only first-minute hook and started from 20 ants and a quota.
2. No review round asked for a time to first decision or a time to first payoff. The round-2 traps are almost all about robustness.
3. The one long session (17 min) had no goals and 5,000 ants. Scale as spectacle is the strongest signal we have, but it is one session.
4. Seven wildcards follow. They cover structure (founding runs, bivouac), shared play (ghost trails, raid by replay), scale (a fluid colony of 50,000), control and camera (ride one ant), and a method from another field (trails as a sequencer).
5. Build first: **Founding runs**, which fixes tempo and structure, and **Fluid colony**, which tests the spectacle signal at a scale the painter cannot reach. Ghost trails come third, as the cheapest shared-play idea.

Speed baseline for every wildcard: in the owner's replays, first food arrived after 73 s or never, the first birth came at 9.5 min and the first threat at 10 min (evidence.md, checked). Ants walk 24/256 cell a tick, about 1.9 cells/s, so a 47-cell trail is a round trip of about 50 s before any search (`sim/sim.js:46`, checked).

## Findings

| # | Finding | Evidence | Severity | Proposed change |
| --- | --- | --- | --- | --- |
| 1 | The spec's own numbers set a slow tempo. Days run 8 to 12 min. Egg to adult takes about one day. Each day adds at most one verb or threat. The slice target is "1 queen to 100 ants in three days" | 02-spec.md:258-259, :238; 03-features.md:16 (checked) | blocker | Replace the day as the unit of tempo with a tempo table that gates M1: first decision ≤10 s, first payoff (a delivery or a hatch) ≤30 s, first birth ≤90 s, first threat or surprise ≤3 min, something new every ≤2 min. Each line is read from the lab replay (`spikes/replay-lab.mjs` already reports time to first delivery and stalls) |
| 2 | The build drifted from the first minute in the spec. Feature 53 (seed, husk, sprout, bird shadow) was in P0. The build started instead with 20 workers, 40 sugar and a 40-load quota | 02-spec.md:235-237; 03-features.md:25; NOTES.md Days table (checked) | major | Name the first minute as a P0 gate the build cannot replace with a quota. State that a goal counted over a whole day does not count as a first-minute decision |
| 3 | The reviews checked robustness, not tempo or fun. Of the 12 ranked traps, 10 are about netcode, saves, scent correctness or benchmarks. Only #1 and #10 touch play | 09-round2-findings.md:58-69 (checked) | major | Before the rebuild, add a tempo and spectacle trap list. Have one reviewer play a bot-length replay at real speed and write down each wait over 20 s |
| 4 | The spec treats swarm size as a cost to manage, not as the draw. It plans 300 to 600 ants at the end of Spring and starts the colony at 20. The longest session was the 5,000-ant sandbox (1,035 s, 2,122 deliveries, 81 orders). The 2,000-ant sandbox lasted 73 s, so the signal is real but rests on one session | 02-spec.md:253; evidence.md sessions h, i (checked) | major | Make visible scale part of the core loop, not a reward for the late campaign (wildcards 1, 4, 7). Test it with a toy before writing it into the spec |
| 5 | Every lab wildcard tests a mechanic inside the same 24-day campaign. None tests the structure or the session length, which is where the verdict points | 03-features.md:82-88; 02-spec.md:226 (checked) | major | Add structure toys to M0 (wildcards 1 and 7) before M1 commits to a campaign of 4 to 5 hours |
| 6 | Trail lengths are specified in cells, not in seconds | evidence.md "45 to 50 cells"; sim.js:46 (checked) | minor | Specify trips in seconds: the first loop ≤20 s round trip. Then derive the map distances from that |

## Wildcards

### 1. Founding runs (structure: roguelite on one hill)

**Pitch.** Each run is one founding queen on a fresh seeded patch of Cinderhill, from sealing in to the wedding flight, in about 20 minutes. Bloom you leave behind stays on the hill, so the next queen lands on greener ground. Each run's daughters carry one trait you pick into the next run.

**Replaces or adds.** Replaces the 24-day campaign as the main mode. The campaign's seasons become escalating phases inside one run: Spring in minutes 0 to 5, Summer in 5 to 12, Autumn in 12 to 17, a Tide push, then the flight. New Hill+ (P3 #43) becomes the core loop.

**Why it answers the verdict.** Brood time drops from 9.5 min to about 40 s. A new threat comes every 2 to 3 minutes, not every 10. Losing costs one run, not hours. First decision at 0 to 5 s (where to dig the founding chamber). First payoff at about 20 s (the first worker hatches from the starting pupae).

**Clean-room check.** EotU's formicarium "experiments" are scripted waves on one persistent lab colony, paid for with Royal Jelly (01:27, :50, :116, checked). Here nothing between runs is currency or tile stock. What persists is the hill's terrain and one inherited trait. Roguelite colony games exist (from memory, none opened); the run arc from founding to flight is ours.

**Cheapest toy.** `experiments/cinderhill-runs/` reuses the sim with `?day=1200` (the knob exists, NOTES Days) and brood timers cut by 15×. The toy has four phases on a timer, the spider in phase 2, and a bloom mask saved to localStorage between runs.

**Pass line.** The owner starts a second run without being asked. The replay shows no stall over 30 s in the first 5 minutes and a birth before 90 s. The owner names one thing done differently in run 2 because of run 1.

### 2. Ghost trails (persistent shared hill by stigmergy)

**Pitch.** The hill is shared. The trails every past visitor drew stay as fading scent, and your ants follow the strong ones. You start on a hill that other people's colonies have already shaped. Your good routes outlive your session and help strangers.

**Adds.** A shared layer for Daily hill (02 §7). It is not real-time multiplayer.

**Why it answers the verdict.** On the first visit, the map already holds working routes, so the first delivery comes at about 15 s, not 73 s. It answers "too basic" with authorship: the hill is a record of people. The emotional hook is leaving a mark.

**Clean-room check.** EotU has no multiplayer (01:19, :145, checked). The nearest relative is asynchronous traces between players in other games, such as Death Stranding's shared structures (from memory).

**Cheapest toy.** Use the trail painter. On leaving, post your trail polylines (a few hundred bytes, no player data) to the lab board Worker (`workers/lab-ai/`, board allowlist, 09:22, checked). On load, fetch the last 20 sets and seed them into the trail scent field at a strength set by their age. Storing shared data falls under the owner's 2026-11-23 rule (AGENTS.md). The PR says what is stored.

**Pass line.** On a second visit, the owner points to a trail they did not draw and says whether it helped. The replay shows deliveries in the first minute along inherited trails.

### 3. Raid by replay (asynchronous raids between friends)

**Pitch.** You send a friend a link to your colony. They raid it against your saved defences: your guards, plugs and alarm points. Their run comes back to you as a replay you can watch.

**Adds.** Turns Friends' hill versus (02 §7) into an asynchronous mode. It needs no lockstep room and no shared clock.

**Why it answers the verdict.** A raid is a 3 to 5 minute contest with a clear stake. Defence becomes a design puzzle to tune between raids. Watching your nest hold is the payoff. The tech is already built: the sim is deterministic, a snapshot is 60.7 KB at 5,000 ants, and lab replays reproduce exact hashes (evidence.md, checked).

**Clean-room check.** EotU has no multiplayer (01:19). The nearest neighbour is mobile base raiding. The Ants: Underground Kingdom ties raiding to timers and premium currency (01:204, checked), so this mode has no timers, no currency and no loss beyond the raid.

**Cheapest toy.** Use the sim's two teams and the fight hook, with bites built (NOTES colony section: hook ready, no battles). Store a snapshot in a URL fragment or on the board. The raider draws Alarm and Trail orders against an AI defence that is only the stored guard posts. The result comes back as a replay link.

**Pass line.** The owner and one friend each raid the other once. Each changes a defence after watching the replay. Both replays verify their hashes.

### 4. Fluid colony: one ant to 50,000 (scale and camera; fluid dynamics)

**Pitch.** Zoom out and the colony stops being ants. It becomes a glowing fluid that pours down tunnels, pools in chambers and floods toward food. Zoom in and every drop is still an ant with a job.

**Replaces or adds.** Adds a macroscopic layer. Far from the camera, ants are a density and velocity field advected along the flow fields (an Eulerian crowd model, as in continuum crowds, Treuille et al. 2006, from memory). Near the camera, they are individuals. You command by pressure: press to raise or lower the colony's urge at a spot, and the fluid answers.

**Why it answers the verdict.** It doubles down on the one signal we have (the 17-minute session) and goes past what the painter can show. Every order has a visible effect over the whole screen in under 0.5 s. Built on the Ember look (glowing embers, sparks at a distance), which the owner picked.

**Clean-room check.** EotU draws individual units in groups (01:65). No fluid colony is cited in 01. Treating crowds as a continuum is an established method from crowd simulation, not from a game.

**Cheapest toy.** `experiments/cinder-fluid/`, client-only, no determinism needed. Use a WebGL2 ping-pong density texture on the 256×256 grid, advected by the existing flow fields, with 2,000 instanced ants spawned and absorbed at the camera's edge. Scale at 50,000 is **untested**. S1 measured 5,000 ants at about 2 ms a tick in Node, but no real phone has been measured.

**Pass line.** On a real mid-range phone, 50,000 equivalent ants run at 30 fps or better. The owner zooms from one ant to the whole hill and back without seeing a seam. The owner plays longer than the 2,000-ant sandbox session (73 s) without a goal.

### 5. Trails as a sequencer (music sequencing)

**Pitch.** Each trail is a looping track. Each food is an instrument, and each delivery plays a note quantized to the beat. A healthy colony sounds like a song; a cut trail drops a part.

**Adds.** Turns `kit/music.js` from a backing track (02 §9) into feedback driven by the sim. Trail length sets phrase length. Traffic sets density. An alarm adds a minor drone.

**Why it answers the verdict.** It gives feedback in seconds: drawing a trail is composing. It adds a non-violent goal: build the colony whose song you like, or match the daily hill's target rhythm. Musical toys hold attention without goals (Electroplankton, from memory).

**Clean-room check.** Nothing in 01 is close (checked). Ours.

**Cheapest toy.** Use the trail painter plus a listener on the delivery event. Assign each pile a pitch set, quantize to a 16-step grid in WebAudio, and turn up the volume of a part as more ants travel its trail.

**Pass line.** The owner redraws a trail to change the sound, not to collect food. The replay shows orders placed after a delivery sound with no shortfall in food.

### 6. Ride one ant (control and camera: tandem recruitment)

**Pitch.** You are Tally, one scout, seen at ant height. Where you walk, you lay the trail. Ants you touch tandem-run behind you and then recruit others, so your route becomes a highway you watch grow behind you.

**Replaces or adds.** Replaces finger-drawn trails with a scout you steer in the first minutes. Painting comes back once the colony outgrows one scout. Recruitment grows geometrically by tandem running (Temnothorax, 07 §2.3, checked heading), not by group selection.

**Why it answers the verdict.** The first decision comes at 0 s, and the first follower at about 5 s. The camera close up makes 20 ants feel like plenty.

**Clean-room check.** This is closest to SimAnt's yellow ant (01:202) and Empire of the Ants' third-person ant (01:203), not to EotU. Two differences: your ant never fights, and recruitment is a chain of ants following one another, not an army that obeys. SimAnt predates EotU and belongs to the genre (02:39).

**Cheapest toy.** Use the painter, with the selected ant steered by joystick or tap-to-go. Its path is fed in as a growing trail order every second. Touched idle ants switch to the follow state behind it. Add a camera lock at 6× zoom with the Field look.

**Pass line.** The owner leads 3 or more tandem chains in the first minute. The owner then reports switching to painting because they wanted to, not because they had to.

### 7. Bivouac (structure: army-ant nomad cycle)

**Pitch.** Your colony has no nest. Each night it forms a living bivouac. Each day it sends one raid front sweeping a fan of ground, then you choose where to camp next. Every few days the colony settles into a static phase while pupae mature, and the hunters come.

**Replaces or adds.** An alternative core loop or a second species mode. It replaces digging with choosing a site and shaping the raid front.

**Why it answers the verdict.** The raid front is a large, self-organizing shape, a branching swarm raid (Franks 1991, from memory; army ants, 07 §1.4, checked). Each phase is 2 to 4 minutes and ends in a clear choice (march on or settle). Scale and spectacle come from the first minute.

**Clean-room check.** In EotU, army ants appear only as enemies (01:38, :106, checked). Playing as them, with the phase cycle as the clock, is ours. The cycle is real biology (07 §1.4).

**Cheapest toy.** Run the painter with 5,000 ants and no home. One Alarm-like "front" order spreads with a branching rule (a diffusion-limited, reinforced scent field). Prey cells are eaten on contact. Pressing the bivouac spot moves the home flow field.

**Pass line.** The owner plays three cycles and picks camp sites for a reason they can name (prey density, cover). The replay shows the front's area and its prey per minute changing with the chosen site.

## Ranking

The criteria, in order: does it answer "too slow and basic"? How cheap is the toy on the existing sim and page? What does it risk on the clean-room line? Can it still feed the main rebuild if it fails?

1. **Founding runs.** It answers the structural cause directly (finding 1). It is the cheapest: timers, phases, and a bloom mask in localStorage. If it wins, it reshapes the spec; if it loses, its tempo table still holds.
2. **Fluid colony.** It tests the only positive signal, at a scale the painter cannot reach. The Ember look is ready for it. The risk is real-phone performance at 50,000 (untested), which is exactly what the toy measures.
3. **Ghost trails.** The cheapest shared feature, and the board already exists. It also improves Daily hill.
4. **Bivouac.** The boldest alternative structure. It is cheaper to try after toy 1 shows whether short phases work.
5. **Raid by replay.** Strong reuse of determinism, but it needs battles that do not exist yet.
6. **Trails as a sequencer.** A cheap add-on and a good feedback layer. It can ride on any of the above.
7. **Ride one ant.** It fixes the first minute well, but it carries the most clean-room risk (SimAnt, Empire of the Ants).

**Build as lab toys next to the rebuild:** Founding runs and Fluid colony. They test two independent hypotheses: tempo and structure, and scale as spectacle. Neither blocks the M1 rebuild. Each has a pass line read from owner play plus a replay fact.
