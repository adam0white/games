# Crumbwar: decisions and their costs

Written 2026-11-23. Numbers marked "local" were measured on a Mac mini; numbers marked "deployed" were measured against Cloudflare. Where a claim comes from the Cloudflare documentation and was not measured here, it says so.

## The game, in one paragraph

Four colonies sit in the corners of a square field 3200 units wide. An ant carries crumbs (1 point) and sugar (5 points) home. An ant bites an enemy in a 70 degree arc in front of it, within 32 units. An ant that carries cannot bite. An ant's own nest is safe, and an enemy nest hurts. An ant grows at 5, 15 and 30 points delivered: more health, a harder bite, less speed. A round lasts 6 minutes, then a 12 second break. The game was designed for this base; it shares no code and no rules with Ant Promotion.

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
5. **No storage.** A deploy or an eviction ends the round for that room. The page reconnects by itself (4 tries) and a ghost of a dropped player is kept 30 seconds so a short network gap resumes the same ant.

## Netcode

- **Binary messages.** An input is 5 bytes, a ping 7 bytes. Positions of other ants are quarter-unit `u16`, or `i8` deltas when the ant moved less than 32 units. The player's own ant uses sixteenth-units, so prediction has less rounding to correct.
- **Interest management.** A client is told about ants and food inside a square 620 units from its ant. An ant stays known until it is 700 away, so an ant at the edge does not flicker. A test checks that no ant outside the square is ever sent. This is also the anti-cheat for vision: a modified client cannot show what it was never sent.
- **Delta against the last snapshot sent.** WebSocket is reliable and ordered, so the server knows what the client has, and no snapshot acknowledgement is needed. Cost: a slow client is not skipped ahead; its messages queue. The guard is the lag kick below.
- **Prediction.** The page runs the same `stepMove` as the server. Each snapshot carries the last input sequence the server applied and how many ticks it has applied it for. The page replays from there. Inputs are sent when they change, not every tick, and carry no tick stamp. Cost: the server may apply an input one tick earlier or later than the page assumed. Measured locally with no latency: correction p50 0, p99 7.5, max 12 units (12 units is one tick of sprinting). The page smooths the correction. Stamping inputs with a tick would remove it and add 2 bytes and a server-side input queue; do it if corrections are visible on real networks.
- **Scores and names** go on a slow channel: once a second, top five plus your own rank.

Measured bytes (local, Node bench, each person steering): 544 B/s per client with 12 people, 974 B/s with 60, 1560 B/s with 120, 2547 B/s with 240.

## Fairness and anti-cheat

- The server ignores everything but heading, move and sprint. Speed, position and damage cannot be claimed by a client.
- A message must be binary and at most 8 bytes. Each socket has a token bucket: 30 messages a second, burst 60. Breaking either closes the socket (1008).
- The socket's `Origin` must name the host that served the page, so another site cannot embed the game's sockets. A non-browser client can forge `Origin`; this stops embedding, not scripts.
- At most 4 sockets per IP address per room. This limits one person filling a colony. It also limits a household or a school behind one address to 4: the fifth is refused (429), because the directory offers the same room again. Sending the fifth to another room would let one address hold 4 sockets in every room, so that waits for an edge rate limit.
- A client 8 seconds behind the room is closed (4004), so one stalled socket cannot hold memory. A person who sends nothing for 90 seconds is closed (4003).
- Nobody picks a colony. A new person joins the colony with the fewest people, then the lowest score.
- All bites in a tick land together, so ant id order gives nobody the first bite.
- **Bots.** Every colony has the same number of ants: the larger of 6 and the most people in any colony. Bots make up the difference and leave as people join. A bot sees the same 620 unit square, acts through the same input call, decides 4 times a second and aims with an error. Bots are sent with a bot flag and the page labels them "(bot)". Cost of the honesty: players know. The other option, disguised bots, was rejected: it is a lie, and it is found out.
- **Not stopped:** a script that plays well through the real protocol (an aimbot); two people in different colonies helping each other. Both need behaviour statistics, which need players first.

## Rooms and scaling

- **Assignment.** The Worker maps the caller's continent to a region hint and asks that region's Directory object for a room. The Directory fills the fullest room that has space, so players meet each other before they meet bots, and opens a new room when all are full. Rooms report their head count every few seconds. The Directory keeps this in memory only; after an eviction it relearns from the reports within seconds.
- **Placement.** A room is created with the region as `locationHint`, so it runs near its first players. Players from other continents get their own regions.
- **Room cap.** 60 people (`HUMAN_CAP`). This is a density choice for a 3200 unit field, not a CPU limit: a tick with 240 people costs 0.6 ms locally (table below). The hard limits are far away: 32,768 sockets per object (Cloudflare documentation) and one thread per object.
- **The bottleneck at scale is the Directory**, which handles one call per join for a whole region. One object can serve on the order of a thousand simple calls a second. Before that matters, shard it: `dir:<region>:<hash of IP mod N>`. This is a change to one line in the Worker.
- **Not built:** rate limiting of joins at the edge. Add a WAF rate rule or the Workers rate limit binding on `/crumbwar/play` before the link is public.

## Cost

From the Cloudflare pricing page, read 2026-11-23, Workers Paid:

- A room that runs all month is 128 MB for 2.59 million seconds, about 331,776 GB-s, about $4.15 at $12.50 per million GB-s. A room runs only while a person is in it.
- An incoming WebSocket message is billed as 1/20 of a request. A player who sends 20 messages a second for an hour costs about $0.0005. Outgoing messages are free.
- So 1000 people online around the clock, 60 to a room, is about 17 rooms, about $70 a month in duration, plus about $390 a month in messages if every one of them steers 20 times a second. Real play sends far fewer: the page sends only when the heading changes by 2 steps or a flag changes. Measure the real rate with players before trusting either figure.

## Measurements

### Local, Node bench (`loadtest/bench.mjs`): cost of one tick, including building every snapshot

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

Measured 2026-11-23 against `play.adamwhite.work`, from one Mac in Texas, every client in one room placed in `enam`. All clients share one network path, so this shows what a room can carry, not what distant players feel.

| People | Seconds | Joined | Closed early | Ticks per second | Snapshot gap p50 / p99 ms | Round trip p50 / p99 ms | Bytes per client per second | Snapshots out of step |
|---|---|---|---|---|---|---|---|---|
| 20 | 30 | 20 | 0 | 20 | 99.9 / 108.8 | 32 / 59 | 457 | 0 |
| 60 | 40 | 60 | 0 | 20 | 99.7 / 118.4 | 52 / 67 | 648 | 0 |
| 120 | 40 | 120 | 0 | 20 | 99.4 / 130.2 | 64 / 107 | 984 | 0 |
| 240 | 40 | 240 | 0 | 20 | 99.3 / 122.3 | 71 / 91 | 1692 | 0 |
| 60 | 600 | 60 | 0 | 20.0 | 99.8 / 112.2 | 66 / 80 | 655 | 0 |
| 240 | 600 | 240 | 0 | 20.0 | 99.2 / 128.6 | 54 / 86 | 1645 | 0 |

- Prediction correction stayed at p50 0 and p99 0.2 to 7.5 units. The reported maximum in long runs is about 3500 units: that is a respawn moving the ant to its nest, which the test counts as a correction. It is not a prediction error.
- Every run has one snapshot gap of about 400 ms at the start. The 240 person ten-minute run had one gap of 1.3 seconds. The cause is not known.
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

## Known gaps

- No lag compensation for bites.
- No edge rate limit on joins.
- No way for friends to share a room.
- No alert when a room is reset. Add one from Workers logs or analytics before the link is public.
- All deployed tests ran from one place into one region. Rooms in other regions and players far from their room are untested.
- A deploy ends every round in progress.
- The time a tick takes cannot be measured inside a deployed object, because the clock does not advance during execution there (from memory of the Workers security model; not re-read). The late-tick counters do not show it either (see "Overload, on purpose"); use `ticksPerSecond`.
- Exercised once by hand over real sockets against `wrangler dev` (2026-11-23), not by an automated test: resume returns the same ant; a 9 byte message, a text message and a 200 message burst each close the socket with 1008; the fifth socket from one address is refused; a client that never pings is removed after 8 to 9 seconds. Never exercised: the idle kick and the 3 retries when a room is full.
- Under `wrangler dev` only, a socket the room closes from its tick loop stays in the closing state. The page does not depend on the close event: five seconds without a message ends the socket and reconnects.
- The page was checked in headless Chromium at phone size only (joins through the directory, steers at 150 units a second in the direction dragged, stops on release, no console errors). It has not been checked on a real phone or in WebKit.
