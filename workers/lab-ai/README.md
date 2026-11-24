# games-lab-ai

A small Cloudflare Worker that writes a rival's name, title and five short lines for the experiment
`experiments/lab/ant-nemesis/` ("Ant Promotion: Nemesis").

**Status: not deployed yet.** The game works fully without it: it uses its own offline table of names
and lines, and only swaps in the model's text when this Worker answers within 4 seconds.

## What it does

One endpoint: `POST /lab-api/persona` on `play.adamwhite.work`.

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

A second endpoint, `/lab-api/board/<game>`, for a leaderboard shared between players. Only `lantern`
is on the allow-list. The code is in `src/board.mjs`; the tests are `test/board.test.mjs`.
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

## Spend guards

- Origin check: only `https://play.adamwhite.work`, `http://localhost[:port]` and `http://127.0.0.1[:port]`.
  Non-browser clients can fake this header, so the rate limits below are the real guard.
- Rate limits (Workers Rate Limiting binding): `PER_IP` 6 requests per 60 s per address,
  `GLOBAL` 10 requests per 60 s in total. Both counts are per Cloudflare location and approximate.
  If a limiter errors, the request is refused (429), not let through.
- Cache API: identical requests (same event, animals, numbers and variant) are served from the
  cache for an hour without calling the model or counting against the limits.
- Daily cap: one SQLite-backed Durable Object (`DailyCounter`, binding `DAILY`, one instance named
  `global`) counts model calls per UTC day for the whole world. The Worker asks it after the rate limits
  and before every model call; cache hits are not counted. Over `DAILY_CAP` (a var, default 2000) the
  answer is 503 and no model call is made. If the counter cannot be reached, the answer is also 503.
  A call that reaches the model counts even if the model then fails.
- No logging of requests or addresses. `observability` is off. No D1, R2, KV or secrets.
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
- The Durable Object adds one small request per model call (at most 2000 a day) and a one-row table.
  Its price is not included above; I did not open the Durable Objects pricing page.
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

The tests use stand-ins for the AI binding, the rate limiters and the cache. They check the
allow-lists against the game's own `sim.js`, rejection of free text and unknown fields, the origin
check, the limits, the cache, 502 on every kind of bad model output, and the clamping of output.

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

### Run tickets (2026-11-24)

The page reports its own score, so an edited page could post any number. A run ticket limits that. When a player who
shares starts an endless run, the page posts `{ start: true, r }`, where `r` is a random id for that run (not the
player's id). The server stores `r` and the time in a `runs` table. The score post carries `r`, and the server takes the
score only if it is at most `seconds since the start * 18 + 50` (the endless score grows by 10 a second, 18 during a
boost). A ticket works once, is dropped after 6 hours, and the table holds at most 20,000. A refused score gets 422
`{ error: 'run' }` and changes nothing. Starts are limited per address under their own key (`boardrun:<address>`).

What this does and does not do: it caps how fast a false score can grow. A person who waits an hour can still post an
hour's worth of points without playing. It does not prove a run.

Stored for a ticket: the run id and a time. Nothing about the player. No ticket is asked for before the player has
chosen to share.

`RUN.need` lists the games whose scores are refused without a ticket. It starts empty, so pages loaded before tickets
existed can still post. Add `'lantern'` and deploy once the page with tickets is live. Other games on the board are not
affected: the 18 points a second is Lantern's rule and applies only to a post that carries a ticket.

