# Crumbwar: decisions and their costs

Written 2026-11-23. Numbers marked "local" were measured on a Mac mini; numbers marked "deployed" were measured against Cloudflare. Where a claim comes from the Cloudflare documentation and was not measured here, it says so.

## The game, in one paragraph

Four colonies sit at the corners of a 1200-unit square inside a field 3200 units wide. Small rooms have 32 ants, with labelled bots filling the colonies. Food replenishes in a 500-unit square around the middle; bots search there when nothing is visible, and a canvas arrow points people there. Food spreads farther out as the room fills. An ant carries crumbs (1 point) and sugar (5 points) home. An ant bites an enemy in a 70 degree arc in front of it, within 32 units. An ant that carries cannot bite. An ant's own nest is safe, and an enemy nest hurts. An ant grows at 5, 15 and 30 points delivered: more health, a harder bite, less speed. A round lasts 6 minutes, then a 12 second break. The game was designed for this base; it shares no code and no rules with Ant Promotion.

## Density, 2026-11-24

Shorten the food run and make colonies meet. Nests moved from inset 480 to 1000; movement and the 3200-unit boundary did not change. The floor rose from 24 to 32 ants (eight per colony). New food stays within 250 units of the middle on each axis in small rooms. Bots search the public middle instead of wandering. The page draws a direction arrow and a map marker, and explicitly counts humans and bots. Bots keep their labels. No event or wire-format change was needed.

Crowded rooms widen the food distribution: cluster centers span `min(2900, max(360, (ants - 32) * 24))` units, with crumbs scattered up to 70 farther out. This keeps dense-room snapshot cost down. When the spread shrinks, food outside the smaller bounds is removed so scattered leftovers cannot block central replenishment. Carried food stays carried. Dropped food can still appear where an ant dies or leaves.

Measured locally with pinned Node 26.12.0 using `node loadtest/bench.mjs`, 3000 measured ticks after 200 warmup ticks. Before used the original sim and bots with the original nest positions; after used this change. This includes simulation, bot decisions, snapshots and scores, without sockets. Tick times vary between runs.

| People | Ants before / after | Mean tick ms before / after | p99 ms before / after | Max ms before / after | Bytes/client/s before / after |
|---|---|---|---|---|---|
| 12 | 24 / 32 | 0.030 / 0.038 | 0.104 / 0.093 | 0.305 / 0.288 | 544 / 820 |
| 60 | 60 / 60 | 0.082 / 0.143 | 0.134 / 0.247 | 0.388 / 0.345 | 974 / 1163 |
| 120 | 120 / 120 | 0.201 / 0.340 | 0.271 / 0.467 | 0.776 / 0.945 | 1560 / 2060 |
| 240 | 240 / 240 | 0.563 / 0.757 | 0.829 / 1.010 | 3.128 / 2.328 | 2547 / 3578 |

Both limits pass: mean tick at 240 people below 1.0 ms, and 12-person bandwidth below 900 B/s. Peak snapshots at 12 people reached 1061 bytes; the bandwidth limit is a sustained average, not a packet limit.

`node --test test/` passes 20 tests. The traffic test follows the middle marker, then waits there, for 120 seconds with one through five scripted people and seeds 1, 7 and 42. It uses the actual 390×844 viewport (1100 world units tall). Across those 15 runs, the latest first visible enemy was 3.35 seconds. After 20 seconds, the worst empty fraction was 12.9%, and the longest empty stretch was 4.4 seconds. Tests also cover bot flags, food replenishment after round reset, and crowded-to-small food cleanup through snapshot deltas. The new count and food-bound checks fail against the old sim and bot rules.

These are synthetic traffic and local CPU/byte measurements. They do not establish that the game feels busy or fun to a person. There are still quiet stretches. Human play, deployed cost and real phones were not verified. No deployment was made.

Seen in headless Chromium against `wrangler dev` (2026-11-23) at 390×844, 360×640 and 1280×800, 40 s each, with a script that walks to the middle and carries food home: food and ants of several colonies were on screen within 4 s of joining; the scripted player delivered food (2 points by 36 s at 360×640). Page fixes made then: on narrow screens the top five and the human and bot counts sat on the colony scores, so they moved below the clock; the rank line no longer wraps; names are 11 screen pixels high at every zoom (they were about 6 px on a 360×640 phone); crowded names are thinned nearest first, and a kept label adds the hidden count and how many are bots (seen: "Tawny Sentry · bot +1 bot"); the arrow hides while the middle is on screen, and its label reads "Food in the middle · N", outlined; the map's middle marker scales with the map; the camera no longer starts one frame from a stale position. Seen and not changed (sim): bots of several colonies stack on one spot in fights, about ten at once.

## Bots, 2026-11-24

The first separation change removed the pile but also removed decisive combat. This retune keeps 100-unit ally separation and 75-unit separation from enemies other than the current target. Bots admit a small group by visible distance: yield behind two healthy allies for a healthy enemy, three for a carrier or wounded enemy. A 12-unit tolerance prevents switching on tiny distance changes; this is approximate admission, not a hard reservation. Protected or badly wounded allies do not suppress a pursuit. No bot reads another ant's private plan or distinguishes human enemies from bot enemies.

Each four ids have two foragers, one raider and one guard. Healthy-target pursuit ranges are 85/200/150/85 units; vulnerable-target ranges are 150/330/180/150. Guards answer enemies within 360 units of their nest from up to 300 units away. Visible carriers and wounded enemies have priority; a modest preference for the current target maintains pursuit. Targets outside pursuit range cannot suppress a reachable fight. Bots approach a rear quarter with a 12-unit offset, then face the target within 55 units. Raiders retreat at one HP; guards at 30% of maximum HP (rounded down), foragers at 40%. All keep retreating until fully healed. Carriers return home and sprint near enemies. Vision, client input calls, decision cadence and aim error remain unchanged. No simulation rule changed.

**Acceptance.** Six simulated minutes in 1- and 12-person rooms, seeds 1/7/42. Deaths must average 40–80. Each colony must lose at least four ants in every seed. Each colony's food must reach the original BEFORE mean floor below in every seed. Every seed must have score CV at most 0.15, cluster max at most five and crowded share below 2%. The 1-person scripted human must take bites on at least six ticks and die to bites 1–4 times in each seed. Bot-only mean decision cost must be below 0.15 ms per tick, taking the lowest of three runs. This is local simulation acceptance; owner play acceptance remains separate.

Measured with Node 26.12.0 and `node loadtest/bots.mjs`. People are independent scripted foragers: nearest visible food, home when carrying, center when searching, 4 Hz input with the same aim error. No combat or retreat policy is added to the people. Room joins balance after each person arrives. Every second checks the exact maximum occupancy of any radius-40 disk among living ants, starting at second one, with 360 samples per seed. **The cluster maximum is a one-second sampled maximum, not a bound on intervening ticks.** Median/max cover 1080 samples per room size; food, bites, deaths and CV below are seed means. Colony order is Red/Blue/Green/Gold. CV is population standard deviation divided by mean.

| People | Brain | Cluster median / max | Samples with at least 6 | Food points per colony | Bites | Deaths | Score CV |
|---|---|---|---|---|---|---|---|
| 1 | Original BEFORE | 3 / 9 | 3.52% | 102.3 / 73.7 / 68.0 / 73.0 | 1907.3 | 97.7 | 0.172 |
| 1 | Before this retune | 2 / 4 | 0% | 225.7 / 242.0 / 225.3 / 220.0 | 391.7 | 9.7 | 0.055 |
| 1 | After this retune | 3 / 5 | 0% | 156.3 / 159.0 / 144.3 / 160.3 | 1337.0 | 68.3 | 0.062 |
| 12 | Original BEFORE | 3 / 8 | 2.59% | 170.7 / 154.3 / 133.7 / 157.7 | 1468.3 | 73.3 | 0.110 |
| 12 | Before this retune | 2 / 4 | 0% | 244.7 / 256.0 / 240.0 / 243.3 | 390.7 | 14.7 | 0.049 |
| 12 | After this retune | 3 / 5 | 0% | 200.7 / 195.0 / 217.0 / 210.7 | 975.0 | 47.3 | 0.059 |

Per-seed after results (all pass):

| People | Seed | Food points | Deaths | Colony deaths | Score CV | Cluster max |
|---|---|---|---|---|---|---|
| 1 | 1 | 160/152/136/142 | 74 | 16/16/20/22 | 0.062 | 5 |
| 1 | 7 | 157/152/138/168 | 68 | 20/15/20/13 | 0.070 | 4 |
| 1 | 42 | 152/173/159/171 | 63 | 19/13/17/14 | 0.053 | 4 |
| 12 | 1 | 209/210/219/204 | 50 | 10/11/18/11 | 0.026 | 5 |
| 12 | 7 | 206/174/217/231 | 42 | 13/12/12/5 | 0.102 | 5 |
| 12 | 42 | 187/201/215/197 | 50 | 16/8/15/11 | 0.050 | 5 |

The original BEFORE is `src/bots.mjs` at `10052b05fb33b3ed3e1a7fd6ec9d7b095a9d1f31`; its previously recorded numbers remain the food floor. Before this retune is the uncommitted brain received at the start of this task, SHA-256 `4d9e369c0e314ea619482739022d9939d5191c5dd874abfe37b2f43672f9aa26`. Both before/after use the same updated harness. A temporary copy of that starting brain remains at `/tmp/crumbwar-bots-before-2026-11-24.mjs`; copy it into `src/.bots-before.mjs` to run `node loadtest/bots.mjs --bots ./src/.bots-before.mjs`, then remove the temporary source file. Changed random consumption changes later food history.

**Human threat, one person.** Bitten counts applied-damage ticks, including lethal bites; simultaneous bites count once, so this conservatively undercounts individual bites. Killed counts simulation kill events attributed to an ant; nest-guard deaths are counted separately and are zero in every before/after run. Bites for all ants in the table above count selected attacks, which can exceed damage applications.

| Brain | Bitten ticks, seeds 1/7/42 | Mean bitten ticks / minute | Killed, seeds 1/7/42 | Mean killed |
|---|---|---|---|---|
| Before this retune | 11/24/7 | 2.33 | 1/4/0 | 1.67 |
| After this retune | 25/34/26 | 4.72 | 2/2/2 | 2.00 |

**Bot decision cost.** `loadtest/bots.mjs` times only the complete bot decision pass in a 1-person room (31 bots), including staggered no-op calls. Human input, simulation, cluster sampling and snapshots are outside the interval. Each timing starts a fresh seed-42 world, warms 200 ticks, then averages the remaining 7000 ticks. `--timing-only` runs the three timing trials without the metrics suite. The room's 240-person benchmark cannot isolate this cost because that room has no filler bots.

| Brain | Mean ms/tick, three runs | Lowest ms/tick |
|---|---|---|
| Before this retune | 0.10510 / 0.06950 / 0.03270 | 0.03270 |
| After this retune | 0.02964 / 0.02493 / 0.02106 | 0.02106 |

Both lowest means pass 0.15 ms. The machine was busy; these local timings establish the budget check, not a controlled speedup.

**Verification.** `node --test test/` passes 33 tests. Requirement-derived six-minute regression checks cover all six cases, including each seed's colony losses, CV, crowd samples and human threat. Focused tests cover small-group admission, healthy even fights, wounded allies, nest defence and identical human/bot targeting. The old brain's 8/13/8 deaths (mean 9.67) fail the new 40–80 death gate. Review found and fixed unreachable targets masking reachable fights, unhealthy/protected allies suppressing pursuit, and nest deaths being counted as human kills. An intermediate candidate killed the human six times in one seed; the final gate checks each seed rather than allowing a passing mean to hide that miss.

Nobody has looked at this retune in a browser. Real players, phones, deployed CPU and game feel remain unverified. Live rooms warm bots for ten seconds; this measurement starts cold. No server, commit, push or deployment was made. Protected room, routing, client and simulation-configuration files were unchanged.

## Telemetry, 2026-11-23

The page records play through the shared kit recorder (`/kit/lab.js`). The import is dynamic. Where the file is not served (under `wrangler dev`), the game plays and records nothing.

- **Notice first.** The recording notice and the "Record this play" switch sit under Play on the start card. The kit's notice text says the switch is in the pause menu; this game has none, so the page changes that phrase to "with the switch below". A record starts only if the notice was on the visible card when Play was pressed. If the kit loads after Play, nothing is recorded until the next Play.
- **One record per round or per visit, whichever ends first.** A record starts when the player's ant joins and at each new round. It ends with an outcome: `round` (round over, with `won` 1 or 0), `idle` (closed for 90 s without input), `lost-connection` (reconnects gave up, or a resume gave a new ant), or `left` (page hidden or unloaded). A resume of the same ant continues the record and counts a reconnect. Coming back to a hidden page still in play starts a new record.
- **Summary, numbers only:** `seconds`, `score`, `food` (points delivered), `trips`, `kills`, `deaths`, `tier` (largest reached, 1 to 4), `people` and `ants` in the room at the end, `rttMedianMs` (median of raw ping round trips), `reconnects`, and `won` for a round. Start info: `colony` (0 to 3) and `roundStart` (1 if the record began at a round start). Events: `tier` on growth and `death`, each with a tier number; the recorder caps events at 300.
- **Derived, not sent by the server.** Food delivered is counted when the ant's load goes to nothing while alive and its score rises by at least that load's value. Kills and deaths count the events the server already sends to this player. No wire message was added.
- **Not recorded:** room name, ant names, other players' names, addresses, free text. The kit adds its own player id, session id and viewport class, as for every lab game on this origin.
- **Content policy.** `connect-src` adds `https://human.adamwhite.work`, the lab endpoint's origin, and nothing else.
- **Why the record ends when the page is hidden.** In headless Chromium, a record ended by an unload was not captured. On a navigation the page never called `fetch` (the kit compresses first, and the page was gone before that finished). On a closed page it called `fetch` twice, but the test's interception saw no request, so whether a browser delivers it is unknown. A phone that switches app hides the page and keeps it running, so the send completes there. A page hidden and shown again during play starts a new record, unless the round is in its break.
- **Tested** with Playwright against `wrangler dev`, at 360×640, with `/kit/*.js` served from `experiments/kit/` and the lab endpoint intercepted and answered with 204 (and the endpoint's host mapped to 127.0.0.1 as a backstop): with recording on, nothing was sent while the card showed the notice or during play; after 35 s of play, hiding the page sent one `run` record (outcome `left`, score 7, food 7, trips 3, tier 2, one `tier` event) and one `events` record. A dispatched `pagehide` also sent both. With the switch clicked off (it then read unchecked), hiding the page sent nothing. With the kit held back until after Play, the notice appeared later and hiding the page sent nothing. A direct recorder call sent 2 requests under the served policy and 0 under the old `connect-src 'self'`, with the browser reporting the violation.
- **Not tested:** a round end (6 minutes), the idle close, a reconnect, the real lab server (`crumbwar` was added to `LAB_PROTOTYPES` in human-framework on 2026-11-24, after these tests), WebKit, a real phone.

## What was dropped, and why

| Dropped | Reason |
|---|---|
| Ant-to-ant collision | Movement then depends only on the ant's own input, so the client predicts it exactly. Collision would make every prediction depend on ants the client knows late. |
| Free-text names and chat | No moderation is needed. A name is two words from fixed lists, sent as two bytes. |
| Accounts, saved progress, any storage | A room is disposable. Nothing to migrate, leak or restore. |
| Picking a colony or a room | The server balances colonies. Friends cannot yet play together on purpose (see "Not built"). |
| Terrain, tunnels, items | Each one adds state to every snapshot. Add them one at a time, with the byte cost measured. |

## Architecture

```
browser ── WebSocket ──> Worker (/crumbwar/play)
                           │ 1. Directory DO for the region: "which room?"
                           │ 2. Room DO: accepts the socket
                           v
                         Room DO: 20 ticks a second, all game state in memory
```

1. **One Room Durable Object per room, server-authoritative.** The client sends only a heading, a move flag and a sprint flag. The server owns position, health, score and food. Cost: every room pays for its own tick loop; nothing is shared between rooms.
2. **A separate Worker**, `games-crumbwar`, on routes more specific than the static site's. The static site's deploy and this one cannot break each other. Cost: one more Worker to deploy; `crumbwar` is listed in `reservedPaths` so no experiment can take the path.
3. **Fixed 20 Hz tick, snapshots at 10 Hz.** Each client gets its snapshot on the tick that matches its ant id (odd or even), so the send cost is spread over both ticks. Other ants are drawn 150 ms in the past and interpolated. Cost: you see other ants 150 ms plus latency late. Bites are resolved on the server, so a bite that looked like a hit can miss. There is no lag compensation yet.
4. **A room cannot hibernate while it runs.** The tick loop is a timer, and a timer keeps the object in memory (Cloudflare documentation). The room uses the hibernation WebSocket API anyway, because it is the documented API and costs nothing. When the last person leaves, the room stops its loop after 5 seconds, drops the world and can then be evicted. Bots never play alone.
5. **No game state in storage.** The world lives in memory only. Storage holds two small things for alerts (see "Alerts"): one row per running room, and the regional list of alerts. A deploy or an eviction ends the round for that room. The page reconnects by itself (4 tries) and a ghost of a dropped player is kept 30 seconds so a short network gap resumes the same ant.

## Netcode

- **Binary messages.** An input is 5 bytes, a ping 7 bytes. Positions of other ants are quarter-unit `u16`, or `i8` deltas when the ant moved less than 32 units. The player's own ant uses sixteenth-units, so prediction has less rounding to correct.
- **Interest management.** A client is told about ants and food inside a square 620 units from its ant. An ant stays known until it is 700 away, so an ant at the edge does not flicker. A test checks that no ant outside the square is ever sent. This is also the anti-cheat for vision: a modified client cannot show what it was never sent.
- **Delta against the last snapshot sent.** WebSocket is reliable and ordered, so the server knows what the client has, and no snapshot acknowledgement is needed. Cost: a slow client is not skipped ahead; its messages queue. The guard is the lag kick below.
- **Prediction.** The page runs the same `stepMove` as the server. Each snapshot carries the last input sequence the server applied and how many ticks it has applied it for. The page replays from there. Inputs are sent when they change, not every tick, and carry no tick stamp. Cost: the server may apply an input one tick earlier or later than the page assumed. Measured locally with no latency: correction p50 0, p99 7.5, max 12 units (12 units is one tick of sprinting). The page smooths the correction. Stamping inputs with a tick would remove it and add 2 bytes and a server-side input queue; do it if corrections are visible on real networks.
- **Scores and names** go on a slow channel: once a second, top five plus your own rank.

Original base measurements (local, Node bench, each person steering; superseded by the density measurements below): 544 B/s per client with 12 people, 974 B/s with 60, 1560 B/s with 120, 2547 B/s with 240.

## Fairness and anti-cheat

- The server ignores everything but heading, move and sprint. Speed, position and damage cannot be claimed by a client.
- A message must be binary and at most 8 bytes. Each socket has a token bucket: 30 messages a second, burst 60. Breaking either closes the socket (1008).
- The socket's `Origin` must name the host that served the page, so another site cannot embed the game's sockets. A non-browser client can forge `Origin`; this stops embedding, not scripts.
- At most 4 sockets per IP address per room. This limits one person filling a colony. It also limits a household or a school behind one address to 4: the fifth is refused (429), because the directory offers the same room again. Sending the fifth to another room would let one address hold 4 sockets in every room, so that waits for an edge rate limit.
- A client 8 seconds behind the room is closed (4004), so one stalled socket cannot hold memory. A person who sends nothing for 90 seconds is closed (4003).
- Nobody picks a colony. A new person joins the colony with the fewest people, then the lowest score.
- All bites in a tick land together, so ant id order gives nobody the first bite.
- **Bots.** Every colony has the same number of ants: the larger of 8 and the most people in any colony. Bots make up the difference and leave as people join. A bot sees the same 620 unit square, acts through the same input call, decides 4 times a second and aims with an error. Bots are sent with a bot flag and the page labels them "(bot)". Cost of the honesty: players know. The other option, disguised bots, was rejected: it is a lie, and it is found out.
- **Not stopped:** a script that plays well through the real protocol (an aimbot); two people in different colonies helping each other. Both need behaviour statistics, which need players first.

## Rooms and scaling

- **Assignment.** The Worker maps the caller's continent to a region hint and asks that region's Directory object for a room. The Directory fills the fullest room that has space, so players meet each other before they meet bots, and opens a new room when all are full. Rooms report their head count every few seconds. The Directory keeps this in memory only; after an eviction it relearns from the reports within seconds.
- **Placement.** A room is created with the region as `locationHint`, so it runs near its first players. Players from other continents get their own regions.
- **Room cap.** 60 people (`HUMAN_CAP`). This is a density choice for a 3200 unit field, not a CPU limit: a tick with 240 people costs 0.6 ms locally (table below). The hard limits are far away: 32,768 sockets per object (Cloudflare documentation) and one thread per object.
- **The bottleneck at scale is the Directory**, which handles one call per join for a whole region. One object can serve on the order of a thousand simple calls a second. Before that matters, shard it: `dir:<region>:<hash of IP mod N>`. This is a change to one line in the Worker.
- **Join rate limit (2026-11-24).** The Worker checks the Workers rate limit binding `JOIN_LIMIT` on every join, keyed by the caller's address: 60 joins per 60 seconds. Over the limit the answer is 429 with `Retry-After: 30`, and the page shows "too many joins, wait a minute". The binding counts per Cloudflare location and is approximate by design (Cloudflare documentation). Measured on the deployed Worker: of 80 joins in a row from one address, the first 64 were accepted and most of the rest refused. If the binding throws, the join is allowed. The load test key skips the limit. A household behind one address shares the 60.

## Cost

From the Cloudflare pricing page, read 2026-11-23, Workers Paid:

- A room that runs all month is 128 MB for 2.59 million seconds, about 331,776 GB-s, about $4.15 at $12.50 per million GB-s. A room runs only while a person is in it.
- An incoming WebSocket message is billed as 1/20 of a request. A player who sends 20 messages a second for an hour costs about $0.0005. Outgoing messages are free.
- So 1000 people online around the clock, 60 to a room, is about 17 rooms, about $70 a month in duration, plus about $390 a month in messages if every one of them steers 20 times a second. Real play sends far fewer: the page sends only when the heading changes by 2 steps or a flag changes. Measure the real rate with players before trusting either figure.

## Measurements

### Original base, local Node bench (`loadtest/bench.mjs`): cost of one tick, including building every snapshot

| People | Ants | Mean tick ms | p99 ms | Max ms | Bytes per client per second |
|---|---|---|---|---|---|
| 12 | 24 | 0.029 | 0.102 | 0.324 | 544 |
| 60 | 60 | 0.091 | 0.144 | 0.168 | 974 |
| 120 | 120 | 0.220 | 0.304 | 0.765 | 1560 |
| 240 | 240 | 0.599 | 0.730 | 1.819 | 2547 |

The budget is 50 ms a tick. Workers CPUs are slower than this Mac; even at ten times slower, 240 people fit.

### Local, `wrangler dev`, 20 simulated clients for 15 seconds

All joined. No snapshot arrived out of step. Round trip p50 2 ms, p99 4.8 ms. Prediction correction p50 0, p99 7.5, max 12 units. Ticks late by more than 10 ms: 0. Ticks dropped: 0.

### Deployed

Measured 2026-11-23 against `play.adamwhite.work`, from one machine in North America, every client in one room placed in `enam`. All clients share one network path, so this shows what a room can carry, not what distant players feel.

| People | Seconds | Joined | Closed early | Ticks per second | Snapshot gap p50 / p99 ms | Round trip p50 / p99 ms | Bytes per client per second | Snapshots out of step |
|---|---|---|---|---|---|---|---|---|
| 20 | 30 | 20 | 0 | 20 | 99.9 / 108.8 | 32 / 59 | 457 | 0 |
| 60 | 40 | 60 | 0 | 20 | 99.7 / 118.4 | 52 / 67 | 648 | 0 |
| 120 | 40 | 120 | 0 | 20 | 99.4 / 130.2 | 64 / 107 | 984 | 0 |
| 240 | 40 | 240 | 0 | 20 | 99.3 / 122.3 | 71 / 91 | 1692 | 0 |
| 60 | 600 | 60 | 0 | 20.0 | 99.8 / 112.2 | 66 / 80 | 655 | 0 |
| 240 | 600 | 240 | 0 | 20.0 | 99.2 / 128.6 | 54 / 86 | 1645 | 0 |

- Prediction correction stayed at p50 0 and p99 0.2 to 7.5 units. The reported maximum in long runs is about 3500 units: that is a respawn moving the ant to its nest, which the test counts as a correction. It is not a prediction error.
- The live page also ran seven minutes in headless Chromium on one socket, with the same ant throughout, through a round end and into the next round, with no errors. After the tests, the status call showed every used room stopped with no world in memory, so an empty room does stop on Cloudflare.
- Every run has one snapshot gap of about 400 ms at the start. The 240 person ten-minute run had one gap of 1.3 seconds. The cause of that one gap was not recorded and cannot be known now. See "Snapshot gaps" below for what later runs showed.

### Snapshot gaps, 2026-11-24

The load test now records every gap over 300 ms between two snapshots on one socket: which client, when, how many ticks the room advanced across the gap, and how late the test machine's own timer was. The room counts two things from incoming messages, whose clock is fresh on Cloudflare: `stallMax` (how far the tick count fell behind real time in a 2 second window) and `quietMax` (the longest time with no incoming message at all). Three runs of 240 people for 600 seconds against the deployed game, one machine, room in `enam`:

| Run | Gaps over 300 ms | Longest silence on all sockets at once | Longest single gap | Test machine timer lag, max | Room `stallMax` | Room `quietMax` | Closed early |
|---|---|---|---|---|---|---|---|
| 1 | 62 | 107 ms | 851 ms | 11 ms | 26 ms | 133 ms | 6 |
| 2 | 75 | 91 ms | 637 ms | 47 ms | 39 ms | 87 ms | 3 |
| 3 | 1384 | 1338 ms | 1487 ms | 1040 ms | 46 ms | 1064 ms | 0 |

What was seen:

1. **The 1.3 second gap happened again once, in run 3, and that time the test machine was the cause.** Every socket was silent for 1338 ms at second 521. In the same run the test machine's timer was 1040 ms late, the room heard nothing for 1064 ms, and the room's tick count never fell more than 46 ms behind. So the room kept ticking and the machine that runs all 240 clients paused. The machine was also running browser tests at the time. Whether the first 1.3 second gap (2026-11-23) had the same cause is an inference: that run did not record timer lag.
2. **A room stall was not seen.** `stallMax` stayed under 50 ms (one tick) in all three runs, 36,000 ticks in total. Ticks per second read 20.0 at the end of each.
3. **Short gaps on one socket are normal on this path.** Each run had about 60 to 75 gaps of 300 to 850 ms that hit one to four sockets at a time. The room advanced the usual 2 ticks between the two snapshots and 2 to 6 snapshots arrived together afterwards. That is late delivery on one connection, then a catch-up, not a missed send. All 240 sockets share one home network path, so this says little about real players. The page draws other ants 150 ms in the past, so a gap this long shows as a short freeze of the other ants.
4. **Not explained:** 6 and 3 sockets closed with 1006 in runs 1 and 2 and the room counted the same number of kicks. The kick reason was not recorded. The likely one is the 8 second lag kick or the ping timeout; this is a guess. Kicks are now counted by reason (see "Kick reasons"), so the next run will say.
- The live page was run in headless Chromium at phone size: it joined a room through the directory, steered at 150 units a second and stopped on release. Cloudflare's analytics beacon is blocked by the page's content security policy, which is intended.

### Overload, on purpose

A load test room can waste CPU on every tick (`--burn N`, N million square roots). One client per room, pinging four times a second:

| Burn | Result |
|---|---|
| 0 | Ran 62 seconds until the test ended. |
| 1 (20 clients) | Ran 150 seconds at 20 ticks a second until the test ended. |
| 2 | Cloudflare reset the object after 39 seconds. Every socket closed with 1006 and the round was lost. |
| 4, 6, 8 | Reset after 6 to 9 seconds. Before the reset the clients received 13, 12 and 8.5 messages a second instead of 15. |
| 10 | Reset after 3 seconds. |

What this shows:

1. **An overloaded room is not slow, it is gone.** Cloudflare discards an object that uses too much CPU. The documentation gives a budget of 30 CPU seconds that each incoming message refills; these resets came sooner than that rule alone predicts, so the exact rule is not understood. The safe reading: keep a tick far below the 50 ms budget. A 240 person tick is under 1 ms locally and ran ten minutes deployed without a reset.
2. **The late-tick counters do not work on Cloudflare.** `late10`, `late50`, `maxLate` and `dropped` stayed 0 in every deployed run, the overloaded ones included, because the clock inside a timer does not show the delay there. They work under `wrangler dev` only. The measures that do work are `ticksPerSecond` in the status call, the snapshot rate the clients see, and sockets closing with 1006.
3. **A deploy-only bug was found this way.** A room name with no region in it gave an invalid `locationHint`, which is an error on Cloudflare and is ignored locally. Every load test join failed with 500 until it was fixed. Local runs cannot stand in for deployed ones.
4. The close sent to a lagging client arrives as code 4004 on Cloudflare. The missing close event seen under `wrangler dev` is local only.

## Alerts, 2026-11-24

The question an alert answers: did players lose a round, or play a slow one, without anyone being told?

- **The mark.** A running room writes one row to its own storage each time it reports its head count (every few seconds): head count, tick rate, time, and the Worker version. A room that stops cleanly deletes the row. A room that starts and finds a row was killed while it ran.
- **`room_lost`.** The row was written by the same Worker version. Cloudflare reset the object (overload, see "Overload, on purpose") or evicted it. Tested twice on the deployed game with `--burn 4`: both rooms were reset, every socket closed with 1006, and each produced one alert with the head count (20), the last tick rate (19.9) and the age of the mark (39 s).
- **`room_redeployed`.** The row was written by another version, so a deploy ended the round. This is logged and counted but is not an alert, because the person deploying already knows.
- **`room_slow`.** Two 2 second windows in a row in which the tick count fell more than 200 ms behind real time, at most once a minute. Never seen to fire: in the overload tests the room measured 19.9 ticks a second until Cloudflare removed it. It may only matter for a slowdown that stops short of a reset.
- **Where alerts go.** Each alert is a log line, an Analytics Engine point, and a row in a Directory object named `alerts` (kept 14 days). `GET /crumbwar/api/health` returns the last 6 hours of them. The workflow `.github/workflows/crumbwar-watch.yml` reads that twice an hour and writes new alerts into one open GitHub issue labelled `crumbwar-alert`, so GitHub's notifications carry them. It also fails when the game cannot be reached.
- **Decision: the health list is public and has no key.** An alert holds a room name (a region and a number), a head count and a tick rate, and never a player. A key would have meant a new secret in three places. Alerts from load test rooms (`lt-` names) are shown only with the load test key, so tests do not open issues.
- **What to do with an alert.** One `room_lost` with few people: nothing. Repeated `room_lost` in rooms with many people: the tick costs too much; run `loadtest/bench.mjs` and the deployed load test, and lower `HUMAN_CAP` until it stops.
- **Limits.** A room that is lost and never joined again raises no alert until someone opens it. Its players reconnect within seconds, so in practice the alert follows. A lost room is detected by the next start, up to half an hour later through the workflow. Alerts in the Directory are lost if that object's storage is deleted, not on a deploy.

### Server metrics

The Worker writes to the Analytics Engine dataset `crumbwar`: one point a minute per running room (people, ants, tick rate, bytes out, messages in, `stallMax`, `quietMax`), one per alert, and one per refused join (wrong origin or rate limited, by continent). No address, name or room member is written. Nothing reads the dataset yet; query it with the Analytics Engine SQL API when a question needs it. Kick reasons were added to the room point on 2026-11-24 (see "Kick reasons"), and hourly totals that need no token are kept in the directories (see "Metrics read path"). The status call also reports `version` and `windowTicksPerSecond`.

## Version check, 2026-11-24

The problem, seen 2026-11-24: an occupied room kept running the old Worker code for minutes after a deploy, while every page loaded afterwards was the new one (see "Known gaps"). A deploy that changes the wire format or `shared/config.js` would then put a new page on an old room.

`PROTO` in `shared/config.js` names what a page and a room must agree on. It already existed, was already the second byte of WELCOME, and was 1 from the first commit. It is reused, unchanged. No value in `config.js` changed.

The rule: the page and the Worker are deployed together, so the Worker's `PROTO` is the truth. Each check compares against it.

| Who differs from the Worker | How it is found | What happens |
|---|---|---|
| The page (cached, open across a deploy, or open across a rollback) | The page sends `v=<PROTO>` in the join URL. | The Worker accepts the socket and closes it with 4005 "game updated". A refused upgrade would reach the page only as 1006. The page shows "Game updated, reloading" and reloads. |
| The room (old code still running) | The Worker sends `v=<PROTO>` to the room. The room compares it with its own. | The room refuses with 421. The Worker asks the directory again with that room excluded, as it does for a full room. People already in the room play on. |
| A room from before this change | It cannot refuse. Its WELCOME carries its `PROTO`. | The page closes the socket and joins again with `avoid=<room>`, which the Worker excludes. At most twice, then the reload path. |

- **Both directions reload.** A page with a higher number than the Worker is also not the page the Worker serves now (after a rollback). A reload fetches the right one.
- **No reload loop.** The page reloads at most once a minute for an update (`mayReload` in `shared/version.js`, kept in `sessionStorage`). A second ask within the minute shows "The game was updated. Reload the page to play." If storage cannot be written, the page does not reload at all, because nothing would stop a loop.
- **The directory stops offering an old room.** Rooms now send their `PROTO` with each head count report. `assign` skips a room whose protocol differs from the asking Worker's. A room that never sent one is treated as protocol 1 (`LEGACY_PROTO`). An old room leaves the list when it reports that it is empty. An empty room of another protocol stays listed with no people until it goes stale (45 s), so its name is not handed out again while the old code may still run there. The directory list is memory only, so its filter is an optimisation. The room's own refusal is the guard.
- **Pages from before this change** send no `v`. The Worker lets them through. If `PROTO` changed, the old page's own WELCOME check reloads it (the old code reloads without a guard; it fetches the new page, which has the guard).
- **The WELCOME layout must keep its first two bytes** (type, then `PROTO`) in every future version, because that is how old pages and old rooms are recognised.
- **When to bump `PROTO`.** A test fingerprints `config.js`, `proto.js`, `move.js`, `predict.js` and `net.mjs` together with `PROTO`. Any change to those files fails it until someone decides: if an old page and a new room (or the reverse) cannot play together, raise `PROTO`; then record the new fingerprint. A comment-only change also trips it. That is the cost of a manual number: a person must decide, and the test makes sure the decision is not skipped.
- **Cost.** No new Durable Object call. One query parameter each way. A page that is stale costs one socket accept and close in the Worker. A stale room costs one extra room fetch per join until the directory hears its report.

Tested without Cloudflare (`node --test test/`): the Worker's verdict for current, older, newer, missing and garbage numbers; the reload guard (once, then refused for a minute; no storage, throwing storage and storage that drops writes all refuse; a clock that went backwards does not block); the directory filter, including the known bad case (without the filter the old, fuller room wins); the fingerprint. Two mutations were checked to fail the tests: removing the directory filter, and removing the one-a-minute guard.

Seen on `wrangler dev` (2026-11-24), over real sockets from Node: `v=0` and `v=2` were closed with 4005 "game updated"; `v=1` and no `v` joined; `avoid=enam-0` was sent to `enam-1`. A stale room was made by fault injection, temporarily (the room's own protocol read as 2 after its first join), and the injection was removed afterwards. With the room's report carrying protocol 2, the next two joins went to `enam-1` without touching `enam-0`, and the directory listed `enam-0` with protocol 2. With the report left at 1 (so only the refusal worked), `enam-0` refused two joins (`refusedProtocol` 2) and both landed in `enam-1`. In both runs the first player in `enam-0` kept receiving about 11 messages a second, and after it left, the next join went to `enam-1`.

The page's WELCOME check was exercised in both browsers by a temporary fault injection in the room (the WELCOME's protocol byte set to 9), removed afterwards. With only `enam-0` wrong, the page closed that socket, joined again with `avoid=enam-0` and played in `enam-1`, with one page load. With every room wrong, the page tried three rooms, reloaded once, tried three rooms again and showed "The game was updated. Reload the page to play.", with two page loads in all.

Seen in Playwright against `wrangler dev`, at 390x844, in Chromium and in WebKit, with `config.js` routed: patched to `PROTO = 0` or `PROTO = 2` on every load, the page loaded twice (one reload), and pressing Play after the reload showed "The game was updated. Reload the page to play." with no further load. Patched on the first load only, the page reloaded once, then joined and played. Unpatched, both browsers joined and moved 280 to 300 units in 2 s. The only failed requests were `/kit/hint.js`, `/kit/lab.js` and `/notes/button.js`, which the static site serves, not this Worker.

A known cost: after a `PROTO` bump, a directory that restarted knows no rooms, so it can offer three old rooms in a row. That join gets 503 until the rooms' reports arrive, within 15 s.

Not verified: two code versions running at once on Cloudflare (this cannot be made locally; the stale room above was simulated in one version). A real cache serving an old page. Gradual deployments (two Worker versions serving at once) were not considered beyond the loop guard. After an update reload, the page shows the start card with no note, and the person presses Play again; a join that starts by itself would skip the recording notice rule.

**Deploy order.** Deploy this change alone, with `PROTO` still 1. Every room and page then agrees. Rooms from before it keep running until they empty and need no check, because their protocol is also 1. A later deploy that changes the wire format or the shared constants raises `PROTO` in the same commit. A rollback past this change removes the check; the rolled-back page and rooms then behave as before it.

## Kick reasons, 2026-11-24

`kick` now takes a reason, and the room counts each one (`src/metrics.mjs` lists them): `kickIdle` (4003), `kickNoPing` (4004, no ping for 8 s), `kickBehind` (4004, pings arrive but name a tick 8 s old), `kickText`, `kickSize`, `kickRate`, `kickType` (all 1008), and `sendFailed` (a send threw and the socket was dropped, which was not counted before). Other ends of a socket are counted too: `closedByClient` and `socketErrors`. Joins a room refused are counted by reason: `refusedFull`, `refusedIp`, `refusedGone`, `refusedProtocol`.

The status call returns them, plus `kicksByReason`. The load test prints `kicksByReason` and `closeReasons` at the top level, and the full counters in `roomCounters`. The once-a-minute Analytics Engine point gained seven doubles after the first seven, which did not move: 8 `kickIdle`, 9 `kickNoPing`, 10 `kickBehind`, 11 all four 1008 kinds, 12 `sendFailed`, 13 `closedByClient` plus `socketErrors`, 14 `joins`, each a change over the minute. Analytics Engine takes up to 20 doubles (Cloudflare documentation, limits page, read 2026-11-24).

Seen on `wrangler dev`: a text message, a 9 byte message, an unknown type and a 200 message burst each closed with 1008; a socket that never pinged and one that pinged with tick 0 each closed with 4004. The room's counts arrived in the hourly totals as one of each of `kickText`, `kickSize`, `kickType`, `kickRate`, `kickNoPing` and `kickBehind` per run. A status call 25 s after the first join, after the room had emptied and stopped, returned `joins` 0 and `tick` 0: the room had been evicted and the call met a fresh object. Room counters live in memory only. The hourly totals, sent when the room stops, are the record that survives. The 6 and 3 unexplained kicks of 2026-11-24 remain unexplained until the next deployed 240 client run.

## Metrics read path, 2026-11-24

Nothing read the Analytics Engine dataset, and reading it needs an API token. Instead each regional Directory object keeps hourly totals for 14 days in a small SQLite table (`metrics`: hour, key, value). `GET /crumbwar/api/metrics?lt=<key>[&hours=N]` returns them per region, newest hour first, and totals over the window. It uses the same key check as the status call and is 404 without it. It holds numbers only.

- **Fed by calls that already existed.** A room already reported its head count to its region's directory every 15 seconds. Once a minute, and once when it stops, that report now also carries the counts since the last one: `joins`, `roomMinutes` (to two decimals, so short rooms count), kicks by reason, refusals by reason. No new call per join. One SQLite upsert per key per report, at most once a minute per running room.
- **Joins the Worker refuses** before any room is asked (`refusedForbidden`, `refusedLimited`, `refusedBusy`, `refusedStalePage`) are held in the Worker isolate and sent to the region's directory at most once a minute per isolate. A flood of refused joins therefore buys at most one Durable Object write a minute per isolate. Counts held in an isolate that ends are lost; Analytics Engine has the exact numbers. Seen locally: 10 stale page refusals were made across two runs of the local server and 8 arrived.
- **Peak people.** `peakPeople` is the sum of people over a region's rooms that reported in the last 45 s, taken at each report, the largest in the hour. `peakRoom` is the largest single room. Both are kept in memory between the minute reports, so a directory restart can lose part of an hour's peak. In the totals over regions, a peak is the largest regional value, not a sum.
- **Load test rooms** send their counts to a separate object, `dir:lt`, which never offers rooms. It is shown under the region `lt` and left out of the totals.
- **Why the regional directories and not the `alerts` object.** The regional directory already receives each room's report, so the counts ride on it. Writing to `alerts` would have added one call a minute per room. The cost: the read path asks seven objects (six regions and `lt`), which only happens when someone with the key asks.
- **Old directory code** ignores the extra arguments, so a deploy in which a directory still runs old code loses those counts and nothing else.

Seen on `wrangler dev`: an `lt-` room run for 80 s reported once from its minute block while running (`joins` +5, `roomMinutes` +0.83, read at about 68 s) and kept 20 ticks a second apart from one pause. In that run the test machine itself stalled for 3.5 s (the load generator's timer was 3497 ms late and the local room's `stallMax` was 4880 ms at the same second), and the local room raised `room_slow` (7.6 ticks a second). This is the first time `room_slow` was seen to fire; it was a local machine pause, not a Cloudflare one. After browser joins and a load test, the endpoint returned `enam` with `joins` 11, `closedByClient` 11, `peakPeople` 1, `peakRoom` 1, `refusedStalePage` 8, `roomMinutes` 1.05, and `lt` with the kick counts above. Without the key: 404. Not verified on Cloudflare. Not checked: the 14 day pruning (it runs once an hour per directory and deletes hours older than 14 days), and the size of the table after 14 days (at most about 25 keys an hour, 336 hours, so under 10,000 rows a region).

## Spend

Logged 2026-11-23. All of the load tests together used about 300 GB-s of Durable Object duration (roughly 40 room-minutes at 128 MB), about 300,000 incoming WebSocket messages (billed as about 15,000 requests) and about 1,500 connection requests. This is an estimate from the test counters, not a reading of the bill. It is far inside the monthly amounts the Workers Paid plan includes (400,000 GB-s and 1 million requests for Durable Objects), so the expected added cost is $0. No domain was bought.

Logged 2026-11-24. The gap, burn and rate limit tests used about 250 GB-s of duration (three rooms for ten minutes, plus short ones), about 650,000 incoming WebSocket messages (billed as about 32,000 requests) and about 1,000 connection requests. Same kind of estimate, still inside the included amounts, expected added cost $0. Analytics Engine and the rate limit binding have no charge at this volume (Cloudflare pricing page, from memory; not re-read).

## Known gaps

- A play record from the live page was accepted by the real lab on 2026-11-24 (two POSTs returned 200 from an agent-marked run). A full round ending with a record, and a record from Feast or Rush, have not been seen.
- A 240-client, 10 minute live run on 2026-11-24 (`kick1`) closed all 240 sockets as lagging. The test machine was overloaded (its timer lagged up to 6966 ms), so the run says nothing about the room. The earlier unexplained kicks stay unexplained.
- No lag compensation for bites.
- No way for friends to share a room.
- The `room_slow` alert has never been seen to fire, and an alert has not yet been seen to arrive as a GitHub issue (see "Alerts").
- Server metrics are written to Analytics Engine and nothing reads them yet. A small hourly summary is readable with the load test key (see "Metrics read path").
- All deployed tests ran from one place into one region. Rooms in other regions and players far from their room are untested.
- **A deploy and a running room (seen 2026-11-24).** A room with 10 test clients ran across a deploy. No socket closed, no alert was raised, and four minutes later the room still ran the old version and accepted new joins, while a new room ran the new version. So a deploy does not end a round at once; an occupied room keeps the old server code until Cloudflare restarts it, and the page is the new one. A deploy that changes the wire format or `shared/config.js` can therefore put a new page on an old room. The density change did this for a few minutes with test clients only. A version check at join now handles this (see "Version check"); it was not tested across a real deploy. The `room_redeployed` path was not exercised by this test.
- The time a tick takes cannot be measured inside a deployed object, because the clock does not advance during execution there (from memory of the Workers security model; not re-read). The late-tick counters do not show it either (see "Overload, on purpose"); use `ticksPerSecond`.
- Exercised once by hand over real sockets against `wrangler dev` (2026-11-23), not by an automated test: resume returns the same ant; a 9 byte message, a text message and a 200 message burst each close the socket with 1008; the fifth socket from one address is refused; a client that never pings is removed after 8 to 9 seconds. Never exercised: the idle kick and the 3 retries when a room is full.
- Under `wrangler dev` only, a socket the room closes from its tick loop stays in the closing state. The page does not depend on the close event: five seconds without a message ends the socket and reconnects.
- The page was checked in headless Chromium at phone size only (joins through the directory, steers at 150 units a second in the direction dragged, stops on release, no console errors). It has not been checked on a real phone or in WebKit.

## Modes, 2026-11-24

Three modes share one Worker, one simulation loop and one client module. Classic stays at `/crumbwar/`. Feast is at `/crumbwar/feast/`. Rush is at `/crumbwar/rush/`. Each card links to all three. Each mode has an accent colour.

The rules objects live in `public/crumbwar/shared/modes.js`. The server imports them through `src/modes/`. Bots and the page read the same objects. Ant Promotion was read as a reference. Its promotions branch into animal species. Feast instead uses six ant ranks. It keeps visible power comparisons and a clear promotion message.

### Rooms and protocol

Classic keeps `enam-0` and `dir:enam`, and the equivalent names in other regions. Feast uses `feast:enam-0` and `dir:feast:enam`. Rush uses `rush:enam-0` and `dir:rush:enam`. The page still sees `enam-0`. Load-test directories are also separate. Unknown modes are refused before assignment. A room refuses a join for another mode or protocol. A reconnect cannot restore progress from a previous round.

PROTO rose from 1 to 2. The first two WELCOME bytes stay type and protocol. New modes append a mode byte. Snapshots add size and rank data for Feast, and goal and boost data for Rush. Scoreboards add the public event marker and personal results. The fingerprint now includes `shared/modes.js`. The existing reload and stale-room guards remain. Classic's game rules and packet contents remain the same apart from PROTO.

Alerts carry mode in their detail and response. Analytics Engine points append mode as a blob. Hourly totals live in each mode's directory. The metrics and status URLs take `mode=`. No binding changed.

The recorder always calls `lab('crumbwar')`. Start info adds numeric `mode`: 0 Classic, 1 Feast, 2 Rush. The notice must be visible on the card when Play is pressed. A late import cannot arm a record. Summaries and event fields remain numbers. Feast records its six-rank maximum. No room or ant name is recorded.

### Feast rules

| Rule | Number |
|---|---|
| Round / break | 240 / 10 seconds |
| Ant floor | 24, filled by labelled bots |
| Starting size / cap | 10 / 500 |
| Crumb / cake growth | 1 / 10 size |
| Cake eating time | 60 uninterrupted ticks, 3 seconds |
| Eating ratio | At least 1.25 times the victim's size |
| Retained size | 60%, with a floor of 10 |
| Eater's gain | 50% of the size the victim lost |
| Respawn / protection | 2 / 4 seconds |
| Walking speed | `190 / (1 + max(0, size - 10) * 0.009)` |
| Sprint | 1.6 times speed; costs 0.6 size per second, floor 10 |
| Shrink | 1.5% of size above 16 per second |
| Cluster / cake schedule | A cluster every 25 seconds; a cake every 50 seconds |

There are no colonies, nests, guard damage, carried food or stamina cost in Feast. Contact from any side can eat. Both ants must be unprotected and outside grass. The victim selects its largest touching predator. All victims retain size before any eater gains size. A three-ant chain therefore has the same result with any ant IDs. Respawn selects the safest of 24 seeded candidate positions against dangerous ants.

Ranks start at sizes 10, 16, 28, 46, 75 and 120: Egg, Worker, Forager, Soldier, Major and Queen. Growth numbers live in the Feast rules object, not in `sim.mjs`. The page shows promotion progress and a promotion message. Queen leaves a crumb every two seconds, at a cost of one size. The other ranks have no extra button or special ability. This keeps the input unchanged.

Grass patches are marked and hatched. They reject all food, including trails. Fresh clusters and cake have a map mark and an off-screen arrow. Ant outlines also use symbols: `+` for edible, `!` for danger, `=` for a similar size, and a diamond for safety. Symbols work without colour. Other ants' sizes use integer precision to reduce traffic. Own size uses quarter units on the wire. The outline comparison is conservative about that quantization: it understates edible targets and overstates possible danger near a threshold.

Bots use the same vision square and four decisions per second. Their stable temperaments alter pursuit and rest. They flee dangerous ants and one temperament hunts nearby edible ants. They use the same movement and eating rules as people. During the break, movement, growth, eating and respawns freeze. The top five and personal best rank stay visible. The next round resets size and rank.

### Rush rules

Rush keeps four colonies, nests, carrying, directional bites, growth and stamina. A round lasts 120 seconds, then an 8-second frozen break. Starter crumbs appear near each nest every four seconds. A new arrival can deliver before crossing the field.

Four features were selected. Heavy carrying, beetles and nest theft were left out.

| Feature | Rule |
|---|---|
| Golden crumb | One scheduled every 20 seconds. Worth 5 at home. Has a public map mark. Ordinary random sugar does not spawn in Rush. |
| Seeds | Eight every 12 seconds. Half give 1.3 times speed; half block damage. Both last 6 seconds. They consume no carry slot and give one personal point. |
| Hill | Centre `(1600,1600)`, radius 140. A unique colony majority earns 2 every 4 seconds. Each ant of that colony inside also earns 2. A tie pays nothing. |
| Frenzy | The final 20 seconds double deliveries, seeds, hill payments, kills and goal rewards. The HUD changes. No audio was added. |

Golden and seed positions use a separate stream derived from room seed, round number and scheduled time. Bot noise and input do not choose their positions. A reset starts scheduled events at age one, not twice at ages zero and one.

People cycle through four goals: deliver three loads; stand on the hill for five cumulative seconds; grab a golden crumb; bite an enemy carrier. Each pays 5 personal and colony points, doubled in frenzy. A goal with no progress for 30 seconds (`goalSkipSeconds`) moves to the next goal without a reward. Bots get no goal rewards. Their existing colony roles remain; one role holds the hill. They still use the same vision and decision cadence. The break shows the winning colony, food points delivered, kills and deaths. Awards name the most deliveries and most kills. Delivery totals survive a death. The next round starts by itself.

### Acceptance and evidence

Behavior targets were fixed in `loadtest/bots.mjs`: first growth within 10 seconds, first score within 15 seconds, at most two deaths per minute, and another ant on screen for at least 70% of sampled seconds. Feast also needs top half by 120 seconds and at least one leader change. Rush needs at least three participation kinds and colony score CV at most 0.4. These are synthetic gates. They do not establish enjoyment.

The controller takes the nearest visible food and goes home with a load. In Feast it retreats from a visibly larger ant within 180 units. It stops on a cake to chew. In Rush it follows its hill and golden goals. It uses no combat policy or sprint. It has the same vision and four-Hz cadence as bots. A food-only Feast comparison failed the gentleness target in one 12-person seed: 3.25 deaths per minute. That result is retained as a negative comparison. Reading the visible danger mark matters.

Measurements use pinned Node 26.12.0, seeds 1, 7 and 42, and both one and twelve people. Bots warm for ten seconds before people join, as in `Room.fresh`. The observation then covers the rest of that round: Classic 350 seconds, Feast 230, Rush 110. Times below start at the join. The screen is 390 by 844, with the page's 1100-unit long axis. Dead seconds count as no encounter. Leader changes mean changes in the highest-size living ant's ID. Rush participation kinds are delivery, golden pickup, seed pickup, hill presence and a frenzy payout.

| Mode | First score or growth | Deaths per minute | Seconds with another ant on screen | Mode-specific result |
|---|---|---|---|---|
| Classic | 0.75–10.6 s | 0–1.029 | 93.7–100% | All six behavior cases pass |
| Feast | 0.2–0.55 s | 0 | 100% | Top half in 2–97 s; 3–22 leader changes; Queen reached |
| Rush | 1.95–3.75 s | 0 | 100% | 4–5 participation kinds; colony CV 0.015–0.106; score range 8–43 |

The local benchmark includes decisions, simulation, per-client snapshots, scoreboards and correctly targeted event notices. It runs 200 warmup ticks and 3000 measured ticks. Twelve people must stay below 1200 bytes per client per second. Sixty must stay below 1800. The full tick at 240 ants must average below 1 ms. The benchmark drives its scripted people with the bot brain, so it also charges those decisions to the tick. It includes no sockets or actual send cost. Raw results are stored under `loadtest/results/`. The final CPU check uses three fresh Node processes per mode, each with the same workload. Mode order is counterbalanced. The table reports the pooled mean of all 9000 measured ticks, plus the median and range of the three per-run means. Every run is retained. `loadtest/repeat-bench.mjs` reproduces that recipe. `--assert-targets` fails on a missed byte target or pooled mean tick target.

| Mode | Bytes/client/s, 12 people | Bytes/client/s, 60 people | Mean tick, 240 ants | Median / range of run means |
|---|---:|---:|---:|---|
| Classic | 1040.2 | 1522.9 | 0.820 ms | 0.836 / 0.747–0.877 ms |
| Feast | 1147.4 | 1679.0 | 0.921 ms | 0.922 / 0.896–0.946 ms |
| Rush | 952.5 | 1355.5 | **1.085 ms: fails** | 1.087 / 1.027–1.142 ms |

All byte targets pass. Rush misses the 240-ant CPU target by 8.5%. This is an unresolved acceptance failure. Rush is implemented and linked, but it does not meet every requested gate.

An optional ally-count optimization matched 460800 command tuples and world hashes in twelve seeded cases. A subsequent benchmark was aborted after nine rows during severe host slowdown: Rush measured 103.311 ms elapsed per tick versus 3.327 ms process CPU. A final test rerun also reached its 120-second limit without results. The optional optimization was reverted. The delivered bot code matches the completed benchmark and the completed 65-test suite. No performance pass is inferred from the interrupted runs.

The completed pinned-Node test output is retained in `loadtest/results/modes-tests-2026-11-24.txt`: 65 tests, 65 pass, zero fail. That file predates the browser pass below, which added one test. The original Classic tests remain unchanged except for the protocol fingerprint. Tests cover mode isolation, protocol refusal, deterministic events, Feast predation and recovery, safety, ranks and breaks, Rush features and goals, packet deltas and snapshot cadence.

Rush sends snapshots at 5 Hz above 120 ants. Every other case stays at 10 Hz. Simulation and input stay at 20 Hz. Interest bounds stay unchanged. The page interpolates crowded Rush ants 250 ms behind server time instead of 150 ms. The normal 60-person room does not enter this lane. This is a visible density tradeoff. It has not been seen in a browser. Before that change, the full 240-ant Rush benchmark averaged 1.527 ms even after direct view lookup and cached awards. The original Classic benchmark on the same machine also missed 1 ms in one comparison, so old recorded timing was not accepted as current evidence.

Serialization now quantizes an ant once per tick, uses direct ID lookup with an ordered known-ant list, and caches Rush awards once per scoreboard tick. Food searches use the entry square; known food keeps the existing larger exit square. Reference comparisons preserved 3000 observer snapshot packets byte for byte across all three modes. Interest management and game rules did not change for these optimizations.

### Browser pass, 2026-11-24

The pages were played in headless Chromium through `wrangler dev`. A script played like a person: in Feast it ate crumbs, fled bigger ants, hid in grass and chased smaller ants; in Rush it carried food home, went for the golden crumb and seeds, and stood on the hill. Screenshots were taken every 6 to 8 seconds and at each promotion, eat and death. Requests to the lab host were answered locally, so nothing was recorded.

Seen:

- All three cards at 360×640, 390×844 and 1280×800: no clipped text, no scrolling, the recording notice and switch visible, mode links 46 px tall, the switch 44 px, each mode in its own accent.
- Feast, full rounds at 360×640: promotion text with a ring, the eat burst, "+N" floats, the edge arrow to cake and fresh crumbs, the death message ("Eaten by X / Back in 2 as Worker · size 25"), the results panel, and the next round starting by itself.
- Rush, full rounds at 360×640 and 390×844: the goal line under the score lists, event messages, the frenzy frame and clock, the last-ten-seconds countdown, the results panel with awards and counts, and the next round starting by itself.
- Classic, 20 to 25 seconds at both phone sizes: no visible change apart from the shared page fixes.
- No HUD element overlapped another in the final runs.

Changed after looking:

- Feast growth was too fast. A food-only player passed all six ranks within 20 to 35 seconds, and 18 to 19 of 23 bots ended as Queen. Growth now comes from the rules object: crumb 1 (was 2), cake 10 (was 14), shrink 1.5% (was 1%), eater's gain 50% (was 25%), ranks at 10, 16, 28, 46, 75 and 120. In headless traces most bots now end as Major and 0 to 5 as Queen. In the browser the scripted player reached Major once and Soldier once in four minutes.
- Rush goals could stall. In one round "Hold hill 5 seconds" stayed from second 6 to the end. A goal with no progress for 30 seconds now moves on without a reward. The page says "New goal · …".
- Awards now carry their count on the wire ("Most deliveries · name · 27"). `shared/proto.js`, `net.mjs` and `shared/modes.js` changed. PROTO stays 2 because PROTO 2 was never deployed. The fingerprint is `8b9e99349784bddd`.
- Page effects, with no inline script or style: a pop on each new message, a ring on promotion and on goal completion, a burst on eating, "+N" floats that fly to the bottom left, a hill pulse, event messages (golden crumb, seeds, frenzy, cake, fresh crumbs), an edge arrow with a short label, a growing clock in the last ten seconds, a pulsing frame in the frenzy, and a results panel in the break.
- Layout: the hill, grass, seed and golden-crumb labels are at least 12 CSS px; names are not drawn under the top HUD or over the own line at the bottom left; the top five has a dim backing; the frenzy clock stays clear of the lists on a 360 px screen.

Tried and reverted: a Feast bot brain that sprints for 1.5 seconds and then walks for 3, so a person can catch a marked ant. A scripted hunter then ate 2 to 8 ants per round instead of 0 or 1. It raised Feast traffic to 1268.6 and 2161.5 bytes per client per second, over both byte targets. No tested variant passed at 60 people. The original brain stays. Its traffic with the new growth rules is 1157.8 and 1772.7.

Measured after the changes, pinned Node 26.12.0:

- `node --test test/`: 66 tests, 66 pass (Node 26.13.1).
- `loadtest/bots.mjs`: 17 of 18 cases pass. Feast with 12 people, seed 42, reaches the top half at 155 seconds against a 120-second target. With the old growth rules in the same code that case never reached the top half.
- Bytes per client per second are unchanged for Classic and Rush (1040.2 / 1522.9 and 954.5 / 1357.5).
- CPU is inconclusive. The host load average was 8 to 104. Classic at 240 ants measured 1.02 to 1.91 ms against the recorded 0.82. Rush at 240 ants measured 1.02 ms at best. A profile puts 34% of Rush time in snapshot building, 14% in `antsNear` and 13% in bot decisions. No optimization was made.

Still unverified: a real phone, touch input (the script used the mouse and the Space key), WebKit and Safari, safe areas on a notched phone, real people's difficulty and enjoyment, the live Cloudflare integration, and Rush CPU on a quiet host. `/notes/button.js` returns 404 under `wrangler dev` because another worker serves it.
