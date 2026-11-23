# games-lab-ai

A small Cloudflare Worker that writes a rival's name, title and five short lines for the experiment
`prototypes/lab/ant-nemesis/` ("Ant Promotion: Nemesis").

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
