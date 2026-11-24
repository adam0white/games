# games-lab-ai

A small Cloudflare Worker that writes a rival's name, title and five short lines for the experiment
`experiments/lab/ant-nemesis/` ("Ant Promotion: Nemesis").

**Status: not deployed yet.** The game works fully without it: it uses its own offline table of names
and lines, and only swaps in the model's text when this Worker answers within 4 seconds.

## What it does

Model endpoints: `POST /lab-api/persona` and `POST /lab-api/quest` on `play.adamwhite.work`.
The persona request and response are described first; quest, spend, boards and rooms follow below.

Request body (JSON, at most 2 KB, every field checked; any other field gives 400):

| Field | Allowed values |
|---|---|
| `event` | `rise` or `kill` |
| `form` | one of the game's 55 animal names, exact spelling |
| `playerForm` | one of the game's 55 animal names, exact spelling |
| `kills` | whole number 1 to 9 |
| `escapes` | whole number 0 to 20 |
| `kin` | whole number 0 to 20 |
| `variant` | whole number 0 to 3 |
| `previousName` | optional, letters and spaces, 1 to 24 characters; checked, then dropped (it never reaches the prompt or the cache key) |

No text written by the client reaches the prompt. The prompt is built only from the allow-listed
names and the numbers, so the endpoint cannot be used as a general model proxy.

Answer (200): `{ name, title, temperament, persistence, territory, lines: { rise, notice, escape, kill, beaten } }`

- `temperament` is one of `ambusher`, `stalker`, `brute`, `coward`; `persistence` and `territory` are 1 to 3.
- `name` at most 24 characters, `title` at most 32, each line at most 60. Plain letters, digits and simple punctuation only.
- A word list rejects swearing, gore, weapons, religion, politics and real-person titles. If any field fails, the answer is 502.

Other answers: 400 bad body, 403 wrong origin, 404 other path, 405 other method, 413 body too big,
429 rate limit, 503 daily cap reached (or the counter could not be reached), 502 model failed or gave unusable output. The page treats every non-200 the same way:
it keeps the offline text.

Model: `@cf/meta/llama-3.1-8b-instruct-fast` (set in `wrangler.jsonc` as `MODEL`), JSON mode with a
JSON schema, `max_tokens` 220, a 6 second limit inside the Worker. In tests through `wrangler dev`
with the real binding it answered in 0.7 to 1.3 seconds and used 6 to 8 neurons per call.
Note: this model is not listed by `wrangler ai models list` and its docs page returns 404; the
Workers AI changelog of 2026-05-08 says the `-fast` variants stay active, and the 2026-11-20
deprecation list does not name it. If it goes away, change `MODEL`; the code reads both the
`choices[0].message.content` and `response` answer shapes.

## The shared leaderboard (2026-11-23)

The endpoint `/lab-api/board/<game>` serves a leaderboard shared between players. The allow-list is
`lantern`, `sling`, `breath`, `matchmaker`, `lantern-fp` and `ant-swarm`. Each game has its own object and cache entry;
only the allow-list changed. Storage, score limits, guards and cost are the same for all six games. The code is in `src/board.mjs`; the tests are `test/board.test.mjs`.
The owner approved shared features in any game on 2026-11-23.

- `GET /lab-api/board/lantern` answers `{ rows: [{ n, s }] }`: the 20 best, best first.
- `POST /lab-api/board/lantern` with `{ id, n, s }` keeps that player's best score and newest name
  and answers `{ place, rows }`. With `{ id, remove: true }` it deletes the player's row.

What is stored, per player: a random id made on the player's phone (never sent back to anyone), the
name the player typed, the best score and the time of that score. Nothing else: no account, no
password, no email, no address. One SQLite-backed Durable Object per game (`Board`, binding `BOARD`,
named by the game) holds the rows. The 500 best rows are kept and the rest are deleted.

Guards:

- Names are cut down on the server to letters, digits, space and `_ . -`, at most 16 characters.
  A basic word filter (a short English list, with digit-for-letter swaps undone) stores a rude name
  as "Player". It will miss things; it is not a moderation system.
- Scores are whole numbers from 1 to 1,000,000. They are reported by the page, so a player who
  edits the page can post a false score up to that cap. There is no check that a run was played.
- A post must carry the site's `Origin` (or localhost). A read from another site is refused.
- Posts are limited per address with the `PER_IP` limiter (6 per 60 s, keyed apart from the persona
  endpoint). The address is the limiter's key only and is not stored. A limiter error refuses.
- At most 2000 new players a UTC day are added; known players can still post. Over it: 503.
- Reads are answered from the Cache API for 20 seconds; a post clears that entry at the location
  that handled it, so another location can show a list up to 20 seconds old.
- Cost: no model call. A post is one Durable Object request with a few SQLite rows written.

The game sends nothing until the player taps "Share my best run" on its leaderboard screen, which
says what is sent. "Stop sharing" deletes the row. If the endpoint does not answer well within 4
seconds, the game shows only the phone's own board.

Checked on 2026-11-23: the unit tests (storage on real SQLite through `node:sqlite`), and a run under
`wrangler dev --local` (with `--compatibility-date 2026-10-26`, because the local runtime was older
than the date in the config): post, read, a lower score keeping the best, rename, remove, a post
without `Origin` refused, and the seventh post in a minute refused with 429. Not checked: the
deployed Worker, the migration `v2` on Cloudflare, and the cache across locations.

## Meadow quests and spend totals

`POST /lab-api/quest` writes a quest-giver for `experiments/lab/ant-quests/`. Every field is required;
unknown fields give 400. The JSON body limit is the same 2 KB as persona.

| Field | Allowed values |
|---|---|
| `giver` | `beetle`, `snail`, `spider`, `frog`, `bird`, `mouse`, `ant-queen`, `firefly` |
| `kind` | `fetch`, `hunt`, `escort`, `race`, `hide` |
| `target` | `seed`, `berry`, `crumb`, `dewdrop`, `feather`, `aphid`, `ladybird`, `lost-ant`, `pebble` |
| `count` | integer 1 to 9 |
| `mood` | `grumpy`, `kind`, `sly`, `proud`, `sleepy` |
| `variant` | integer 0 to 3 |

Answer: `{ name, ask, thanks, scold, secret }`. The name has at most 24 characters and contains only
letters, spaces, apostrophes and hyphens. `ask` and `secret` have at most 70 characters; `thanks` and
`scold` have at most 60. The prompt asks for short, warm, funny, child-safe English. The giver asks the
player for the task; `ask` must still contain the numeric count and target after cleaning, allowing
natural plurals and “lost ants”. Otherwise the answer is 502. `secret` is one small piece of invented
meadow lore. There is no client-written prompt text.

Guards: the same Origin check, shared per-IP and global model rate-limit keys, JSON-schema output,
`plain()` and banned-word filters, 6 second timeout, model, 220 output-token budget and error statuses
as persona. Successful output is cached for one hour by all six inputs, apart from persona's cache.
A cache hit consumes no model call, rate-limit count or daily allowance. The filters are a basic word
list and cannot guarantee tone or meaning; rejected output leaves the page's offline text in place.

What is stored: the Cache API holds validated quest inputs in the key and cleaned output for one hour.
The existing `DailyCounter` (the same `global` object and `DAILY_CAP`) holds only the UTC day, combined
call count and counts for `persona` and `quest`. No request bodies, addresses or personal data are
stored in it. Calls count when admitted immediately before inference, including failed or timed-out
inference; cache hits and requests refused by a guard do not count. Existing daily counts are preserved
and attributed to persona once, because quest did not exist when they were made. Old days are pruned
on the next admitted call, as before.

`GET /lab-api/spend` returns `{ day, calls: { persona, quest }, cap }` for the current UTC day. It uses
the same allowed Origins; a GET without Origin is allowed for same-site reads, as on boards. It returns
`Cache-Control: no-store`, calls no model, consumes no model rate limits or allowance, and gives 503
if the counter is unavailable. A new day reads as zero even before its first model call.

Cost: quest shares the existing **2000 combined calls per UTC day**, rather than receiving another
allowance. Its shorter prompt and identical output-token limit stay within the existing model estimate
below. The added totals require small SQLite writes in the same counter request. Each spend read adds
one Durable Object request; it is not covered by the model-call cap. No model spend is introduced by
boards or rooms.

## Race rooms

`GET /lab-api/room/lantern-race/<code>` upgrades to a WebSocket. A code is exactly `open` or four
uppercase ASCII letters. No other game or path is accepted. One SQLite-backed `Room` Durable Object,
named `lantern-race/<code>` through binding `ROOM`, serves each room. Migration `v3` adds this class;
its SQLite storage is deliberately unused.

What is stored: only the current round (seed, start), connected peers (slot id and cleaned name),
participant/done flags and each socket's last-second message timestamps. This state lives in memory
and socket attachments, never in SQLite. Attachments preserve it through hibernation, then disappear
with the sockets. Names are not saved beyond the connection. There is no address in an attachment,
no history and no account, and the code logs nothing from a room. An empty room loses its round. A restart can disconnect clients;
the page must reconnect and accept the current round or ask for a new one.

| Client text frame | Server action |
|---|---|
| `{t:'hi', n}` | Clean the name with board `shownName`; empty becomes `Boat`. Announce `{t:'join', id, n}` to others. |
| `{t:'ready'}` | If no round, the round started more than 150 seconds ago, or its remaining participants are all done, announce `{t:'round', seed, start}` to everyone. `seed` is uint32; `start` is now + 4000 ms. |
| `{t:'p', x, d, a}` | Relay `{t:'p', id, x, d, a}` to others. `x` is -1..1, `d` is 0..100000, `a` is 0 or 1. |
| `{t:'done', s}` | Announce `{t:'done', id, s}` to everyone and mark that participant done. Score is an integer 0..1000000. |

Frames are JSON (the table uses single quotes only for readability). On connection the socket gets
`{t:'you', id, peers:[{id,n}], round:{seed,start}|null}`; `peers` excludes itself. Others get a `join`
with its initial name `Boat`. Another `join` announces its cleaned name after `hi`. Disconnecting
announces `{t:'leave', id}` once and frees its slot, including a close that wakes a hibernated object.
Sockets present when a round is created are its participants; arrivals during a round see it, relay
positions, and join the next round. Departures leave the participant set.

Guards: Origin must be the game site or allowed localhost Origin, including on upgrades. Non-GET
gets 405; a GET without WebSocket Upgrade gets 426. `PER_IP` limits upgrades to 6 per minute per
address per Cloudflare location, using `room:<address>` apart from model and board keys. A limiter
failure refuses with 429; an unavailable room gives 503. A ninth socket upgrades then closes with
code 4001. Each client frame must be JSON text at most 200 UTF-8 bytes, with exactly the expected
fields and finite numeric ranges; invalid frames are ignored. A rolling second counts every frame,
including invalid frames. More than 12 closes that socket with 1008. Position and score reports are
client claims, with no authoritative race simulation or score verification.

Cost: no model calls and no SQLite writes. Upgrades and messages consume Durable Object resources;
fan-out is bounded to eight connected sockets and at most 12 accepted incoming frames per second
per socket. The class uses `ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose` and
`serializeAttachment`, with no timer keeping an idle room awake. See the
[Cloudflare hibernation API](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
Hibernation avoids idle duration charges; active rooms and upgrade attempts still incur charges and
are not subject to the model daily cap.

## Spend guards

- Origin check: only `https://play.adamwhite.work`, `http://localhost[:port]` and `http://127.0.0.1[:port]`.
  Non-browser clients can fake this header, so the rate limits below are the real guard.
- Rate limits (Workers Rate Limiting binding): `PER_IP` 6 requests per 60 s per address,
  `GLOBAL` 10 requests per 60 s in total. Both counts are per Cloudflare location and approximate.
  If a limiter errors, the request is refused (429), not let through.
- Cache API: identical requests (same event, animals, numbers and variant) are served from the
  cache for an hour without calling the model or counting against the limits.
- Daily cap: one SQLite-backed Durable Object (`DailyCounter`, binding `DAILY`, one instance named
  `global`) counts persona and quest model calls together per UTC day for the whole world. The Worker asks it after the rate limits
  and before every model call; cache hits are not counted. Over `DAILY_CAP` (a var, default 2000) the
  answer is 503 and no model call is made. If the counter cannot be reached, the answer is also 503.
  A call that reaches the model counts even if the model then fails.
- Cloudflare logs, traces and Issues are on (owner decision, 2026-11-24; `workers/OBSERVABILITY.md`). A request log holds the address, user agent, location and URL path for seven days. The code logs no names or prompt text. No D1, R2, KV or secrets.
- The page calls at most once per rival event that needs text (the rise, and each repeat kill),
  never in the first 8 seconds of a run, with a 4 second timeout, and never waits for the answer.

## Worst case cost

Pricing used (Workers AI pricing page, row for llama-3.1-8b-instruct-fp8-fast): 4,119 neurons per
million input tokens, 34,868 neurons per million output tokens, $0.011 per 1,000 neurons,
10,000 neurons free per day.

- One call at most: about 500 input tokens and 220 output tokens, which is about 9.7 neurons, about $0.00011.
- **Hard cap: `DAILY_CAP` = 2000 model calls per UTC day, for all locations together.**
  Worst case 2000 x 9.7 = about 19,400 neurons, about **$0.21 per day** before the free 10,000 neurons
  (about $0.10 after them). At the measured 6 to 8 neurons per call it is about $0.13 to $0.18 before
  the free allowance. This no longer depends on the per-location rate limits.
- The Durable Object adds one small request per model call (at most 2000 a day) and two one-row tables for the current day.
  The per-endpoint totals add a second tiny table. Spend reads add Durable Object requests but no model calls.
  Durable Object pricing is not included above.
- The rate limits still matter for fairness: `GLOBAL` allows 10 per minute per location, so without
  them the day's cap could be used up in minutes by one sender. Once the cap is used, everyone gets the
  offline text until 00:00 UTC.
- To change the cap, edit `DAILY_CAP` in `wrangler.jsonc` and deploy again. A value that is not a whole
  number from 1 up falls back to 2000.
- Optional extra: put the calls through an AI Gateway by setting `AI_GATEWAY` in `vars` to a gateway id.
  The code passes `{ gateway: { id } }` when that variable is set.

## Test

```
node --test workers/lab-ai/test/
```

The tests use stand-ins for the AI binding, rate limiters, cache and sockets, with real SQLite for
counter and board storage. They check the persona allow-list against the game's `sim.js`, quest
allow-lists and required fields, rejection of free text, Origins, limits, cache, output filtering,
shared spend and legacy-count upgrades. Room tests cover the pure protocol, rolling rate window,
round membership, relays, slot reuse and reconstruction from attachments. A regression test covers
a close that wakes the object after the runtime has omitted the disconnected socket.

Verified for these additions (2026-11-23): **41/41 tests pass**. The production entry bundles with
`npx wrangler deploy --dry-run -c workers/lab-ai/wrangler.jsonc` at its configured compatibility date;
no date override was needed. Under `wrangler dev --local` (4.164.0), a Node script exercised two real
WebSocket clients: welcome/peers, cleaned name, common seed/start, positions without echo, done to
both, a next round, and leave. It also checked a 13-invalid-frame flood closing with 1008, the ninth
socket closing with 4001, and a non-upgrade GET returning 426. A temporary local-only entry stubbed
`AI.run`; quest returned 200 through the real route and the real SQLite counter reported its quest
call through spend. The temporary entry did not change the production entry or call Workers AI.

Local route inference rewrites localhost Origins; that smoke script used the allowed
`https://play.adamwhite.work` Origin header. Unit tests also exercise localhost Origins directly.
Not verified: live Workers AI quest quality/schema support, actual runtime eviction and wake from
hibernation (attachment reconstruction is unit-tested), production migration `v3`, production
WebSockets or cross-location cache behavior. No deployment was made.

Local run (needs a Cloudflare login; the AI binding calls the real model even in local dev, so calls are billed):

```
npx wrangler dev -c workers/lab-ai/wrangler.jsonc
```

## Deploy

```
npx wrangler deploy -c workers/lab-ai/wrangler.jsonc
```

Check first with `npx wrangler deploy -c workers/lab-ai/wrangler.jsonc --dry-run --outdir /tmp/lab-ai-dry`.

## Turn it off

Fastest, keeps the code: in the Cloudflare dashboard, Workers & Pages, `games-lab-ai`, Settings,
Domains & Routes, remove the route `play.adamwhite.work/lab-api/*`. The page then gets errors and
uses its offline text.

Remove it completely (this also deletes the Durable Object and its daily count):

```
npx wrangler delete -c workers/lab-ai/wrangler.jsonc
```

Either way the game keeps working.
