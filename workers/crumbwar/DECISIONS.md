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
4. **Not explained:** 6 and 3 sockets closed with 1006 in runs 1 and 2 and the room counted the same number of kicks. The kick reason was not recorded. The likely one is the 8 second lag kick or the ping timeout; this is a guess.
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

The Worker writes to the Analytics Engine dataset `crumbwar`: one point a minute per running room (people, ants, tick rate, bytes out, messages in, `stallMax`, `quietMax`), one per alert, and one per refused join (wrong origin or rate limited, by continent). No address, name or room member is written. Nothing reads the dataset yet; query it with the Analytics Engine SQL API when a question needs it. The status call also reports `version` and `windowTicksPerSecond`.

## Spend

Logged 2026-11-23. All of the load tests together used about 300 GB-s of Durable Object duration (roughly 40 room-minutes at 128 MB), about 300,000 incoming WebSocket messages (billed as about 15,000 requests) and about 1,500 connection requests. This is an estimate from the test counters, not a reading of the bill. It is far inside the monthly amounts the Workers Paid plan includes (400,000 GB-s and 1 million requests for Durable Objects), so the expected added cost is $0. No domain was bought.

Logged 2026-11-24. The gap, burn and rate limit tests used about 250 GB-s of duration (three rooms for ten minutes, plus short ones), about 650,000 incoming WebSocket messages (billed as about 32,000 requests) and about 1,000 connection requests. Same kind of estimate, still inside the included amounts, expected added cost $0. Analytics Engine and the rate limit binding have no charge at this volume (Cloudflare pricing page, from memory; not re-read).

## Known gaps

- No real play record from Crumbwar has been seen in the lab yet. `crumbwar` was added to `LAB_PROTOTYPES` in human-framework on 2026-11-24 (see "Telemetry").
- No lag compensation for bites.
- No way for friends to share a room.
- The `room_slow` alert has never been seen to fire, and an alert has not yet been seen to arrive as a GitHub issue (see "Alerts").
- Server metrics are written to Analytics Engine and nothing reads them yet.
- The reason for a kick is not counted by kind.
- All deployed tests ran from one place into one region. Rooms in other regions and players far from their room are untested.
- **A deploy and a running room (seen 2026-11-24).** A room with 10 test clients ran across a deploy. No socket closed, no alert was raised, and four minutes later the room still ran the old version and accepted new joins, while a new room ran the new version. So a deploy does not end a round at once; an occupied room keeps the old server code until Cloudflare restarts it, and the page is the new one. A deploy that changes the wire format or `shared/config.js` can therefore put a new page on an old room. The density change did this for a few minutes with test clients only. Before such a deploy with real players, add a version check at join. The `room_redeployed` path was not exercised by this test.
- The time a tick takes cannot be measured inside a deployed object, because the clock does not advance during execution there (from memory of the Workers security model; not re-read). The late-tick counters do not show it either (see "Overload, on purpose"); use `ticksPerSecond`.
- Exercised once by hand over real sockets against `wrangler dev` (2026-11-23), not by an automated test: resume returns the same ant; a 9 byte message, a text message and a 200 message burst each close the socket with 1008; the fifth socket from one address is refused; a client that never pings is removed after 8 to 9 seconds. Never exercised: the idle kick and the 3 retries when a room is full.
- Under `wrangler dev` only, a socket the room closes from its tick loop stays in the closing state. The page does not depend on the close event: five seconds without a message ends the socket and reconnects.
- The page was checked in headless Chromium at phone size only (joins through the directory, steers at 150 units a second in the direction dragged, stops on release, no console errors). It has not been checked on a real phone or in WebKit.
