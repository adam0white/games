# Cinderhill hill room: notes

The friends' hill room for Cinderhill, built for spike S1 (deployed) in `docs/design/colony/04-roadmap.md`. It implements the room protocol in `docs/design/colony/05-tech.md`. Results are in `experiments/cinderhill/sim/SPIKES.md` (S1 deployed, S2 soak). There is no game page that uses it yet.

## What exists (2026-11-25)

| Path | What it is |
| --- | --- |
| `src/hill.mjs` | The room: clock, sealing, repeats, SQLite, seats, hashes, authority sim. No Cloudflare imports, so Node tests drive it |
| `src/room.mjs` | `HillRoom`, the Durable Object around it: SQLite storage, hibernatable WebSockets |
| `src/index.mjs` | The Worker: `/room/<code>/ws`, `/stats`, and with `DEBUG_ROLES` on, `/log` and `/bench`; join rate limit |
| `src/protocol.mjs` | Wire format, `PROTO`; shared with the clients and tests |
| `test/hill.test.mjs` | Protocol tests in Node (node:sqlite for SQLite, a fake clock): version refusal, the clock, repeats, late commands, durable before acknowledged, restart, desync detection in both roles, seats, the clock stopping |
| `test/workerd.test.mjs` | The restart test in workerd: `wrangler dev` with a persisted directory, killed with SIGKILL mid-match and started again |
| `loadtest/client.mjs` | One scripted player: runs the sim in lockstep, sends orders and a hash a second, reconnects and resumes |
| `loadtest/run.mjs` | N clients in one room, then the room's counters and an offline replay of its command log against every client hash |
| `loadtest/cpu.mjs` | The room's CPU, duration and rows written from Cloudflare's Durable Object analytics (GraphQL) |
| `loadtest/results/` | The measured runs (summaries, no hash lists) |

Deployed as the Worker `games-cinderhill` at `https://games-cinderhill.adamwhite.workers.dev`, unlisted. Not on play.adamwhite.work: `/cinderhill/` there is the experiment page, and a Worker route needs a new entry in `reservedPaths` (`worker-settings.mjs`), a shared file. The cost: the zone's WAF probe rule (`workers/OBSERVABILITY.md`, "Scanner probes") does not cover workers.dev, so a scanner hitting this host makes low-risk Issues (the Worker answers 404 itself).

## The protocol as built

- **Clock.** `setInterval` at 50 ms while a socket is open. Each fire, and each incoming message, seals every tick that is due by wall clock (at most 2 s at once; beyond that the clock slips and counts it). The room never waits for a client. The clock stops 5 s after the last socket closes; the object can then hibernate or be evicted. Time does not pass while the room is empty: the next join continues from the last sealed tick.
- **Sealed frames.** One binary frame per tick: type, the tick, and the commands of that tick in the sim's own encoding (`[tick, seat, id, type, ...]`). An empty tick is 7 bytes. After a (re)connect one frame covers every tick from the client's `have` to the last sealed tick.
- **Commands.** `{ t: 'cmd', id, tick, cmd }`. The room stamps the seat. A command for a sealed tick goes into the next open tick; more than 10 s ahead is refused. A repeat of a pending or stored (seat, id) is dropped and acknowledged again with the original tick. Clients resend every unacknowledged command after a reconnect.
- **Durable before acknowledged.** A tick's commands commit in one `transactionSync`, then the room sends the acks and the frame. The Durable Object's output gate holds those sends until the write is confirmed.
- **The sealed mark is a lease.** The spec says commands and the sealed-tick mark commit together. Writing the mark every tick is 72,000 rows an hour (about $0.07 a room-hour at $1.00 per million rows written, more than ten times the duration cost). Instead the mark says "sealed through T + 20". The room writes it once a second when the next tick passes it, and in the same transaction as any commands of that tick. A restarted room resumes at mark + 1, so no tick at or below the mark can get a new command after a restart, and every broadcast tick is covered by a durable mark (a test checks this at every frame). A command in a tick the mark already covers commits with no mark write. The cost: after a restart the clients skip up to one second of empty ticks.
- **Rows written.** One per command (the table's key is (tick, seat, id), `WITHOUT ROWID`, no second index; repeats are looked up in memory), one per mark move (about 3,600 an hour), one per authority checkpoint (120 an hour), one per new seat.
- **Handshake.** The join URL carries `proto` and `sim` (`SIM_VERSION`). A mismatch gets a `reload` message and close code 4005. The welcome carries the protocol, sim version, role, seed, ant count, seat, seat token, last sealed tick, boot count, Worker version id and object id.
- **Seats.** Up to 4. The first join of a seat gets a random token; a join with that token gets the same seat back. A fifth seat is refused with 4001. The two-minute seat hold and pause are not built.
- **Hashes.** Each client sends its sim's total hash every 20 ticks. Relay: the first hash for a tick is kept and later ones are compared with it. Authority: each is compared with the room's own. A difference is counted, logged once with `console.error` (Issues picks it up) and sent back as `desync`. The incoming hashes also keep the room's CPU allowance fresh (08-cloudflare-and-prior-art.md).
- **Role.** Fixed when the room is made. `relay` unless `DEBUG_ROLES` is `"1"` and the first join asks for `authority`. Authority runs `experiments/cinderhill/sim` at the room's ant count, writes a checkpoint (`sim/snapshot.js`) every 30 s and when the clock stops, and after a restart restores it and replays the stored commands up to the mark.
- **Lockstep rule found here:** every host must queue a tick's commands just before that tick and drain the sim's events after every step. The sim's hash covers its pending queue and its undrained events, so a host that queues early or drains late has a different hash with the same play. The first deployed smoke test failed this way; `loadtest/client.mjs`, the room and the offline check now do the same.

## How to run

```
node --test workers/cinderhill/test/        # Node tests, then the workerd restart test (WRANGLER=<command> picks the wrangler)
cd workers/cinderhill
npx wrangler deploy                          # DEBUG_ROLES "0": every room a relay; no /log, no /bench
npx wrangler deploy --var DEBUG_ROLES:1      # measurement: authority rooms, /log and /bench
node loadtest/run.mjs --url=wss://games-cinderhill.adamwhite.workers.dev --room=<code> --role=authority --ants=5000 --seconds=600 --name=<label>
node loadtest/cpu.mjs loadtest/results/<label>.json   # some minutes later: Cloudflare's analytics lag
```

Deploys are by hand with wrangler, as Crumbwar's; nothing deploys this Worker automatically. `npx wrangler rollback` returns to the previous version; `npx wrangler delete` removes it and its rooms.

## Measured

See `experiments/cinderhill/sim/SPIKES.md`, "S1 deployed" and "S2 soak".

## Open

- The unexplained reset (SPIKES.md, S1 deployed).
- Join snapshots for relay rooms (from a client checkpoint the others confirmed), the two-minute seat hold, pause.
- A game page that uses the room. `PROTO` and the client code move to the kit (`experiments/kit/`) when the page imports them (kit rule 1).
