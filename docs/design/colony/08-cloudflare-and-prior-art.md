# 08 — Cloudflare fit and prior art

Status: research, 2026-11-25. It adds to 05-tech.md and 06-tech-research.md and does not repeat them.

## Labels

- **[opened]**: a page read during this research. The URL is given.
- **[docs search]**: text returned by the Cloudflare docs search tool for that URL. The page was not opened in full.
- **[snippet]**: a search-result snippet only.
- **[memory]**: from prior knowledge, not checked in this research. Treat it as a lead.
- **[calc]**: my own arithmetic from the numbers cited.

All prices are for the Workers Paid plan ($5/month minimum) unless marked Free.

## The ten findings that change the plan

1. **A ticking room must hear from clients.** A Durable Object (DO) gets 30 s of CPU per request. Each incoming WebSocket message resets it to 30 s. If the server runs the sim at 5,000 ants, linear scaling of Crumbwar's tick cost gives about 300 ms of CPU per second, so 100 s with no incoming message can spend the 30 s. Send a hash from every client each second. [opened: DO limits]
2. **Every deploy ends live rooms within 5 minutes.** Code updates are deferred by default, with a maximum delay of 300 s. A ticking room never hibernates, so it is reset at the deadline. Persist the snapshot and command log in DO SQLite, put a protocol and sim version in the handshake, and resume on reconnect. [docs search: code updates]
3. **A 20 Hz room is cheap.** One room-hour is about $0.0056 of duration. The included 400,000 GB-s covers about 889 room-hours per month. Lockstep messages cost almost nothing. [calc from opened pricing]
4. **Use setInterval for the tick, alarms only for slow events.** Alarms cost one row written each and can be delayed up to a minute in failover. [docs search: alarms]
5. **The leaderboard belongs in DO SQLite or D1, not KV.** KV is eventually consistent and allows one write per second per key. [docs search: KV]
6. **Replays belong in R2.** $0.015/GB-month with free egress. A command log is small. [opened: R2 pricing]
7. **Telemetry fits Analytics Engine, as Crumbwar already does.** 10M data points per month included. Billing has not started. [docs search: AE pricing]
8. **Turnstile in invisible mode can gate leaderboard posts without accounts.** It is free. The token is single use and must be checked server side. [docs search]
9. **Logs pricing changes on 2026-12-01.** Crumbwar logs at 100% head sampling. Check its volume before then. [docs search: observability pricing]
10. **Containers and Realtime are not needed for the first build.** The JS sim fits in a DO. Realtime DataChannels are a possible later path for peer traffic, not for authority. [opened/docs search]

## Part A — Cloudflare, product by product

### Summary table

| Product | Fit for Cinderhill | Key numbers | Source |
|---|---|---|---|
| Durable Objects (SQLite) | Yes. One DO per room, one per daily hill board | 128 MB memory; 30 s CPU per request, configurable to 5 min; 10 GB storage per object; soft limit 1,000 req/s | [opened] DO limits |
| DO WebSocket Hibernation | Yes, for lobby and idle rooms. A ticking room cannot hibernate | Incoming messages billed at 20:1; outgoing free; attachment max 16,384 bytes | [opened] DO pricing, WebSockets best practices |
| DO alarms | Room expiry and day rollover only | 1 alarm per object; at least once; 6 retries from 2 s; 1 row written each | [docs search] alarms |
| Workers static assets | Yes. Serve the page from the same Worker | Static asset requests free; 100,000 files; 25 MiB per file | [opened] Workers limits and pricing |
| Pages | No. Docs say new projects should use Workers | — | [opened] Workers best practices |
| D1 | Possible for a global, cross-day leaderboard | 10 GB per DB; single threaded; 1 ms queries give at most 1,000 queries/s | [docs search] D1 limits |
| KV | Cached daily seed and config only | 1 write/s per key; eventually consistent | [docs search] |
| R2 | Replays and shared saves | $0.015/GB-month; free egress; 10 GB-month free | [opened] R2 pricing |
| Analytics Engine | Play-record telemetry | 20 blobs, 20 doubles, 1 index per point; 3-month retention; 10M points/month included | [opened] limits; [docs search] pricing |
| Queues | Not needed | 1M ops included, then $0.40/M | [opened] Workers pricing |
| Workflows | Not needed; maybe a nightly hill job later | 500k steps included | [opened] Workers pricing |
| Rate limiting binding | Join and post limits | Period 10 or 60 s; per location; approximate | [docs search] |
| Turnstile | Gate leaderboard posts | Free; 20 widgets; 10 hostnames per widget | [docs search] |
| Realtime (SFU, TURN) | Not for v1 | $0.05/GB after 1,000 GB/month free; STUN free | [docs search] Realtime pricing |
| Containers | No | Paid only; smallest type 1/16 vCPU, 256 MiB | [docs search] Containers pricing |
| Workers AI | No sensible use in the sim. Possible offline use for name lists or tooltips; not worth a binding | — | judgement |

### The 20 Hz room in detail

Crumbwar already runs a 20 Hz room (see workers/crumbwar/DECISIONS.md). Cinderhill differs in one way that matters: in lockstep, the server may not run the sim at all. The facts below apply either way.

**Hibernation.** Hibernation is blocked by alarms, in-flight requests, setTimeout or setInterval, and open outbound WebSockets. Protocol ping and pong do not block it. [opened: WebSockets best practices] So a room with a running setInterval never hibernates and pays duration for the whole match. This is fine at our scale (see cost below). Still use `ctx.acceptWebSocket` so that a room whose players have all paused or left can sleep. Stop the interval when no human is connected, as Crumbwar does after 5 s.

**CPU budget.** The limits page says each incoming HTTP request or WebSocket message resets the remaining CPU to 30 s, and that using more than 30 s between incoming requests raises the chance of eviction. [opened: DO limits] Two consequences:

- Crumbwar measured 0.56-0.76 ms per tick at 240 ants. 05-tech.md targets about 5,000 visible ants. If cost scales linearly, a server-side sim takes about 15 ms per tick, 300 ms of CPU per second, and spends 30 s after about 100 s of silence. [calc, unmeasured] At 240 ants it would take about 25 minutes. The risk is real at the target size.
- Fix it in protocol, not in config: every client sends a state hash once per second. This also gives desync detection, which we want anyway. Raising `limits.cpu_ms` to 300,000 is the backup.

**Alarms vs setInterval.** Alarms have millisecond granularity and usually fire within a few ms. They are at least once, retry 6 times with backoff from 2 s, and can be delayed up to a minute during failover. The Rules of Durable Objects page says not to wake objects on short intervals. Each setAlarm counts as one row written. [docs search: alarms, rules] At 20 Hz that is 72,000 rows written per room-hour, and the included 50M rows covers about 694 room-hours. [calc] Use setInterval for the tick. Use one alarm for "expire this room" and one for "close today's hill".

**Eviction and lifecycle.** An idle, non-hibernatable object is evicted after 70-140 s. Since compat date 2026-10-01, pending timers and I/O keep an object alive for up to 15 minutes per operation (flag `durable_object_io_tasks_prevent_eviction`). On shutdown, WebSockets are closed. [docs search: lifecycle] The client must treat a close as "reconnect and resume", not "game over".

**Code updates.** The 2026-10-30 changelog and the code-updates page describe a deferred update by default with `max_delay` 300 s. It is set with `durable_objects.code_update_strategy` (`mode` "deferred" or "immediate", `max_delay` 0-86,400 s) or the deploy flag `--durable-objects-code-update-mode`. A new Worker version can reach an old DO version during the change. [docs search] Rules for us:

- Store the room's seed, tick number, last snapshot and command log in DO SQLite every few seconds. A snapshot every 30 s plus the log since then is enough to replay forward.
- Put `PROTO` and a sim build hash in the join message. Refuse mismatched clients with a "reload" message, not a silent desync.
- For a long friends' match, consider `max_delay` up to 86,400 s on the room class only, if the setting allows per class. I have not confirmed per-class scope. [unconfirmed]

**Naming and location.** `getByName(name, {locationHint, retry})` returns a stub at once. `retry` takes `maxRetries` 0-10 (default 4) and `timeoutMs` 500-60,000 (default 10,000). The location hint is best effort and only counts on the first `get`. New hints apac-ne and apac-se arrived 2026-06-19. Jurisdictions are eu, us (added 2026-06-26) and fedramp. `ctx.id.name` exists since 2026-03-15. [docs search: data location, changelog] For friends by link, name the room from the link code and pass the creator's region as the hint. The creator picks the location; friends far away pay the latency.

**Cost of a 20 Hz room.** [calc from opened DO pricing]

| Item | Per room-hour | Included per month |
|---|---|---|
| Duration, 128 MB billed whether used or not | 3,600 s × 0.125 GB = 450 GB-s, about $0.0056 | 400,000 GB-s, about 889 room-hours |
| Incoming messages, 4 clients × 2 msg/s | 28,800 messages = 1,440 billed requests | 1M requests |
| Outgoing messages | free | — |
| SQLite snapshot every 30 s | 120 rows written | 50M rows |

The docs' own worked examples put 100 objects with 100 hibernating sockets each at $20.65/month and a non-hibernating broadcast example at $142.95/month. [opened: DO pricing] We are far below both.

**Lockstep server shape.** Two options. I lean to the first for 2-4 friends.

| | Relay only | Relay plus sim |
|---|---|---|
| Server work | Order commands, stamp tick, compare hashes | Also run the sim |
| CPU | Near zero | 0.56-0.76 ms per tick at 240 ants (measured); about 15 ms at 5,000 (linear guess) |
| Late join | Copy a snapshot from a client | Server snapshot |
| Trust | Clients are trusted; a cheater only spoils a friends' game | Server can arbitrate |
| Leaderboard | Not valid for ranked play | Valid |

For the daily hill, which is single player, the server can replay the submitted command log to verify the score. That is where server-side sim pays off. A 10-minute hill at 20 Hz is 12,000 ticks: about 9 s of CPU at 240 ants, about 180 s at 5,000 if cost is linear. [calc] The larger figure exceeds the 30 s default but fits the 5-minute maximum. Raise `limits.cpu_ms` on the board DO, verify only top scores, and measure. At 300 ms per second, a server-side sim in friends' rooms is a further reason to choose relay only.

### Workers platform

- **Static assets, not Pages.** The best-practices page says new projects should use Workers with static assets. Static asset requests are free and unlimited. [opened] Crumbwar already uses `assets` with `run_worker_first`.
- **wrangler.jsonc.** Set `compatibility_date` to the build date (the docs example is "2026-11-19") and add `nodejs_compat`. [opened] Crumbwar is on "2026-11-05". Two relevant changes are already in effect at that date: `web_socket_auto_reply_to_close` (2026-04-07) and the I/O eviction rule (2026-10-01). [docs search]
- **Floating promises.** Await, return or `ctx.waitUntil` every promise. Do not destructure `ctx`. Keep no request state in module globals. [opened] In a DO, module-level state is per isolate, not per object; keep room state on `this`.
- **Observability.** Turn on logs and traces with a sampling rate and log JSON. [opened] From 2026-12-01, logs and traces share one ingestion and storage allowance; the example gives 50 GB ingestion included, then $0.25/GB, and 10 GB-month storage, then $0.10/GB-month. Logs can now be filtered by `$workers.durableObjectId`. [docs search: observability pricing] Never log per tick.
- **Testing.** The integration was renamed `@cloudflare/vitest-plugin` (v1.0, 2026-08-19); the codemod is `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin`. `runInDurableObject`, `runDurableObjectAlarm` and, from 0.16.20, `evictDurableObject(stub, {webSockets: "close"})` are in `cloudflare:test`. [docs search: changelog, migration guide] The eviction helper lets us test "deploy mid-match, reconnect, resume" in CI. The best-practices page notes the plugin injects `nodejs_compat`, so tests can pass when production config lacks it. [opened]

### Storage and data

**Daily-hill leaderboard.** One DO per hill-day, named for example `hill:2026-11-25`, with a SQLite table of (player tag, score, replay key, verified flag). It is strongly consistent, single writer, and cheap. A D1 database is the better choice only for queries across all days ("best this month"); D1 is itself backed by one DO and is single threaded. [docs search: D1 limits] The lab-ai `/lab-api/board/` service from 05-tech.md may already cover this; check before building a new one.

**Replays.** A command log is a few bytes per command. Store it in R2 under the replay key. Free egress makes "watch the top run" cost nothing to serve. [opened: R2] Do not store replays in Analytics Engine; blobs max 16 KB total per point. [opened: AE limits]

**Analytics Engine.** Per point: 20 blobs (16 KB total), 20 doubles, 1 index of at most 96 bytes; 250 points per invocation; 3-month retention. [opened] Pricing: 10M points written and 1M read queries per month included, then $0.25/M and $1.00/M; Cloudflare says it does not bill yet. [docs search: AE pricing] One point per play session plus one per hill result is enough. Do not write per tick.


### Abuse and networking

- **Rate limiting binding.** Period is 10 or 60 s. Counts are per Cloudflare location and approximate. [docs search] Good for "joins per IP", as Crumbwar does (60 per 60 s). Not a hard cap. Keep the in-room token bucket.
- **Turnstile.** Free. Managed, non-interactive and invisible modes. Validate each token with siteverify; tokens are single use. Pre-clearance can set a `cf_clearance` cookie so one check covers a session. `wrangler turnstile widget create` exists. [docs search] Use invisible mode on "post score" only, not on play. A bot that passes Turnstile still has to produce a command log that replays to its score.
- **Realtime.** SFU and TURN egress cost $0.05/GB after 1,000 GB/month free; STUN is free. SFU DataChannels gained unordered and partially reliable delivery on 2026-08-13, and the SFU WebSocket adapter went GA on 2026-09-30. [docs search] Lockstep wants ordered, reliable delivery, which a DO WebSocket already gives. Realtime adds a second system without a gain at 2-4 players. Revisit only if latency between distant friends becomes the main complaint.

### Containers

Paid only. Memory $0.0000025/GiB-s after 25 GiB-hours, CPU $0.000020/vCPU-s after 375 vCPU-minutes, billed on active use since 2025-11-21. Types range from lite (1/16 vCPU, 256 MiB) to standard-4 (4 vCPU, 12 GiB). Custom types since 2026-01-05. [docs search] A container is better than a DO only if the sim needs more than 128 MB, a native or WASM build, or long uninterrupted CPU. None of these is true for an integer JS sim of a few thousand ants. Keep Node bots off Cloudflare; run them in CI.

### New in 2025-2026 that touches us

| Date | Change | Effect |
|---|---|---|
| 2026-01 | DO SQLite storage billing begins | Delete old hill DOs' rows after a season |
| 2026-03-15 / 03-26 | `ctx.id.name`, `ctx.id.jurisdiction` | The room can read its own link code |
| 2026-04-07 | `web_socket_auto_reply_to_close` | Close handling changes on new compat dates |
| 2026-06-19 | Hints apac-ne, apac-se | Better placement for East Asia and Australia |
| 2026-06-25 | Eviction test helpers | Test resume in CI |
| 2026-08-19 | `@cloudflare/vitest-plugin` v1 | Use the new name |
| 2026-10-01 | I/O keeps objects alive up to 15 min | Pending timers keep a room warm |
| 2026-10-30 | Configurable DO code-update strategy | Set `max_delay` for rooms |
| 2026-12-01 | Logs and traces share pricing | Review sampling |

## Part B — prior art by aspect

Additions to the sources in 05-tech.md and 06-tech-research.md. A repeated source appears only where a newly opened page adds a fact.

### Indirect swarm control on touch

| Source | Label | Lesson | Trap |
|---|---|---|---|
| Pikmin, Wikipedia | [opened] | Throwing and whistling are two verbs that control a crowd. A fixed day count (30 days of about 13 minutes) gives the game its shape. | [memory] The time limit drew complaints; later games relaxed it. A hard daily clock punishes a slow learner. |
| Tooth and Tail postmortem, Game Developer ("Crafting Tooth & Tail: a gamepad RTS…") | [opened] | The team rebuilt the RTS around controller limits: the camera is tied to a commander unit, and the deck has six unit types. Design for the thumb, not for a mouse ported to touch. | Binding the camera to one unit removes overview. Players lose track of fights off screen. |
| Dungeon Keeper, Wikipedia | [opened] | Mark tiles and let workers choose; slapping speeds a creature at a health cost. Commands to places, not to units, scale to hundreds. | Players feel helpless when workers ignore a mark. Show the queue and who has taken each job. |

### Deterministic lockstep in JS and on the web

| Source | Label | Lesson | Trap |
|---|---|---|---|
| Factorio Friday Facts 302 (https://factorio.com/blog/post/fff-302) | [opened] | Every client runs the full sim. A separate "latency state" predicts local input and is thrown away; it is "not sacred". | The latency state is a second code path. Bugs there look like desyncs but are not. |
| "Synchronous RTS engines and a tale of desyncs", Game Developer (https://www.gamedeveloper.com/design/opinion-synchronous-rts-engines-and-a-tale-of-desyncs) | [opened] | Hash the whole state once per second. One desync hit about 5% of games longer than 60 minutes, so long soak tests matter. | Rare desyncs survive short tests. Run Node bot soaks of hour-long matches in CI. |
| NetplayJS (https://github.com/rameshvarun/netplayjs) | [opened] | ISC licence. WebRTC peer to peer with lockstep and rollback wrappers. The host sends corrections unless the game is marked deterministic. | Peer to peer means the host is the authority and can cheat; NAT traversal still needs TURN. |
| Spring/Beyond All Reason netcode overview | [snippet] | A long-running open source lockstep RTS with a server that relays and checks sync. | Large and C++; read for protocol ideas only. |

### Nest and tunnel digging

| Source | Label | Lesson | Trap |
|---|---|---|---|
| Dwarf Fortress designations | [memory] | Designate areas, then rooms by use. Use comes from shape plus a tag. | The interface is famous for being hard. Keep the designation list short. |
| Mindustry (https://github.com/Anuken/Mindustry) | [opened] | GPL-3.0; Android is a first-class target, so a dense tile RTS can work on phones. | GPL-3.0: read for ideas, copy no code. |

### Contests and ritualised fighting

I found no primary source in this round. All rows are [memory].

| Source | Label | Lesson | Trap |
|---|---|---|---|
| Honeypot ant tournaments (biology literature) | [memory] | Colonies settle borders by display contests, not war. Fits a "contest at the border" mode with low losses. | I have not opened a paper; check before using it in game text. |
| Sekiro posture meter | [memory] | A second bar that breaks before health gives fights a visible "who is winning". | A second bar on hundreds of ants is noise. Show it per contest, not per ant. |

### Day-based saves and short sessions

| Source | Label | Lesson | Trap |
|---|---|---|---|
| Stardew Valley mobile lost-progress thread | [snippet] | Players notice a lost day more than any other bug. | Save only at day end and a crash loses a day. Our plan of snapshot plus log every 30 s avoids this. |
| Into the Breach, Hades | [memory] | A run is a session; progress between runs is small and permanent. | Meta-progress can make the daily hill unfair; keep the hill free of carry-over. |

### Ant and colony sims (market)

| Source | Label | Lesson | Trap |
|---|---|---|---|
| SimAnt, Wikipedia | [opened] | You play one yellow ant who lays trails; rain washes trails away. Weather as a reset of pheromones is a good mechanic. | Its designer called it his biggest disappointment. Direct control of one ant did not scale to colony goals. |
| Empires of the Undergrowth (Steam) | [snippet] | Overwhelmingly Positive, about 10,554 reviews. There is demand for a serious ant RTS. | Reviews say mechanics are hard to understand. Teach with the first hill. |
| The Ants: Underground Kingdom | [snippet] | Large mobile audience for ant themes. | Criticised for timers and pay to win. |

### WebGL2 crowd rendering

| Source | Label | Lesson | Trap |
|---|---|---|---|
| MDN WebGL best practices (https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) | [opened] | MAX_TEXTURE_SIZE is at least 4096. Rendering to float needs EXT_color_buffer_float; float blending is a separate extension. A smaller backbuffer is the standard mobile fix. | Do not assume float render targets on phones. Pack positions into integer textures. |
| Phaser 4 SpriteGPULayer (https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance) | [opened] | 168 bytes per member in a static buffer; update only what moves. | The "1M+ sprites" claim has no measurements. Measure our own case. |
| Per-instance data in a texture (blog, Medium) | [snippet] | Store per-ant state in a data texture and index by instance id. | The page returned 403; method from memory. |

### Touch RTS UX

| Source | Label | Lesson | Trap |
|---|---|---|---|
| Apple design tips | [snippet] | Minimum touch target 44 pt. | Ants are smaller than a finger. Select places and groups, never single ants. |
| Android accessibility touch target | [snippet] | Minimum 48 dp. | Same. |
| Bad North, Wikipedia | [opened] | Shipped on mobile on 2019-10-16. Tap a squad, tap a tile, is enough for real-time tactics. | The page gives no touch details; the lesson is from memory. |

## Gaps and open questions

- **Per-class code-update strategy.** I did not confirm whether `code_update_strategy` can differ per DO class. Check before relying on a long `max_delay` for rooms.
- **Hash messages and CPU reset.** I assume a client WebSocket message counts as an incoming message for the CPU reset. The limits page says WebSocket messages do. I did not test it.
- **Tick cost at 5,000 ants.** The 15 ms per tick and the 9-180 s replay figures assume Crumbwar's 240-ant cost scales linearly. Measure with the real sim.
- **Analytics Engine billing.** Not billed yet; the price may start "in the coming months".
- **Contests.** No primary source for ritualised fighting in ants or games. Needs one before game text cites biology.
- **Mobile instancing numbers.** No measured figure for thousands of instances on a mid-range phone. Measure on our target devices.
- **lab-ai board.** Check whether `/lab-api/board/` already does verified scores before building a hill DO.

## Sources

Opened:

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/analytics/analytics-engine/limits/
- https://factorio.com/blog/post/fff-302
- https://www.gamedeveloper.com/design/opinion-synchronous-rts-engines-and-a-tale-of-desyncs
- https://github.com/rameshvarun/netplayjs
- https://github.com/Anuken/Mindustry
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance
- Wikipedia: Pikmin, Dungeon Keeper, SimAnt, Bad North
- Game Developer: "Crafting Tooth & Tail: a gamepad RTS…"

Read through the Cloudflare docs search tool (text returned, page not opened in full):

- https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
- https://developers.cloudflare.com/durable-objects/api/alarms/
- https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/
- https://developers.cloudflare.com/durable-objects/reference/data-location/
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/
- https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/
- https://developers.cloudflare.com/changelog/post/2026-06-25-durable-object-eviction-test-helpers/
- https://developers.cloudflare.com/changelog/post/2026-08-19-vitest-plugin/
- https://developers.cloudflare.com/observability/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/analytics/analytics-engine/pricing/
- https://developers.cloudflare.com/realtime/sfu/platform/pricing/
- https://developers.cloudflare.com/containers/platform/pricing/
- Turnstile and KV pages returned by the same tool

Snippets only: Steam store pages, a Stardew forum thread, Apple and Android touch-target pages, the Beyond All Reason netcode overview, a Medium post.
