# Logs, traces and Issues for Workers

Owner direction, 2026-11-24: every Worker in this project has Workers Observability logs and traces on and
Cloudflare Issues detection on, and a new issue starts a Claude run that fixes it.

## The rule

A Worker that runs code (its config has `main`) carries this block. Copy `workers/observability/template.wrangler.jsonc`.

```jsonc
"upload_source_maps": true,
"observability": {
  "enabled": true,
  "redact_query_string": true,
  "logs": { "enabled": true, "invocation_logs": true, "head_sampling_rate": 1 },
  "traces": { "enabled": true, "head_sampling_rate": 1 },
  "issues": { "enabled": true }
}
```

- `scripts/observability.test.mjs` runs in `npm test` and fails when a config with `main` lacks the block. It skips `archive/`.
- `games-static` deploys with `cf` from `cloudflare.config.ts`, which reads `observability` from `worker-settings.mjs`. `wrangler.jsonc` is the rollback path and repeats it; the test keeps the two equal.
- A Wrangler deploy without `observability.issues.enabled` turns Issues off for that Worker, so the block stays in the file.
- Trace sampling: 1 for a Worker with little traffic, 0.1 for one that runs on every page or asset request (`games-static`, `games-crumbwar`). Issues does not depend on the sampling rate.
- Report a handled failure with `console.error(error)` before the fallback response; Issues picks it up. Log structured JSON, and never log note text, tokens, tester ids or player ids.

## What is stored

Sources: Cloudflare docs read on 2026-11-24 (Workers Logs, Traces spans and attributes, Issues), and measurements on the same day.

- Invocation logs, measured on `games-crumbwar`: one event per request, kept seven days. It holds the method, the URL without the query string, the response status, and the request headers and Cloudflare request metadata. That includes the client IP address (`cf-connecting-ip`, `x-real-ip`), the user agent, and the location Cloudflare derives from the address (city, region, postal code, coordinates, network). Cloudflare masks the `Authorization` header (`********`) and the `Cookie` header (`REDACTED`). Any other header is stored as sent, so never put a secret or an id in a custom header.
- Traces: the request URL and path, user agent, accept headers, country and region, Cloudflare location. No client IP attribute is listed in the docs. A binding call adds a span: an R2 span holds the object key (`cloudflare.r2.request.key`), so an id that is part of a key reaches traces. Keep secrets out of object keys.
- Issues, measured with a throwaway Worker: an occurrence holds the error name, message and stack, the Worker version, the request method, URL and path (query string removed), the `cf-ipcountry`, `cf-ray` and `user-agent` headers, and trace ids. No client IP, no `Authorization` header and no body. Only failing requests produce an occurrence. Occurrences are kept seven days.
- Issues appeared about 20 seconds after the failing request: one for an uncaught exception, one for `console.error(new Error(...))` with a 200 response, and one for a returned 503.
- The first `wrangler deploy` of a brand-new Worker with this block failed once with "This Worker does not exist on your account [code: 10007]"; running the same deploy again succeeded.
- Request bodies are never stored. What the code passes to `console.*` is stored, so the rule on what not to log stands.

## Exceptions

None. Until 2026-11-24 `games-feedback`, `games-lab-ai` and `human-framework` kept request logging off. The owner then decided: "I think it would be simpler to just enable all everywhere." All three now carry the standard block, and the human-framework lab privacy page states what the logs hold. `EXCEPTIONS` in `scripts/observability.test.mjs` is empty; adding an entry is an owner decision.

Some Workers answer 5xx on purpose (`games-lab-ai` at its daily cap, `games-crumbwar` when a room is busy). Issues reports those too. The routine's run marks one `ignored` and adds a line under "Ignored on purpose" below.

## The routine

Cloudflare starts a Claude routine when an issue appears. A daily run of the same routine sweeps for anything missed. Nothing needs watching.

1. Two Issues automations cover every Worker in the account, now and later: "All Workers: new issue to Claude routine" fires on an issue's first occurrence, and "All Workers: issue returned to Claude routine" fires when an issue recurs after 24 quiet hours. List them with `cf o11y issues automations list`.
2. Both send to the routine "Fix Cloudflare Worker issues" (`trig_01RSFhq8pXhq1p4W79gh6xh3`, https://claude.ai/code/routines). Cloudflare's summary of the issue, with the issue id, arrives in the run as untrusted data.
3. The routine runs on the lab's Mac, because the fix needs the `cf`, `wrangler` and `gh` sign-ins there. It works in a fresh clone under `~/code/lab/issue-runs/`. It fixes the fault, merges, deploys and marks the issue resolved, or it leaves the issue active for the owner. If the Mac is off, the run does not start; run the routine by hand afterwards.
4. The record is a GitHub issue in this repository with the label `worker-issue`. An open one with the label `needs-owner` is a decision waiting for the owner: https://github.com/adam0white/games/issues?q=is%3Aopen+label%3Aneeds-owner
5. Issues on Workers outside this project are out of scope. `security` issues ("Potential vulnerability scan") on this project's Workers are in scope since 2026-11-25 (owner decision): see "Scanner probes". On 2026-11-25 scanner traffic started nine runs in one night while the return window was one hour, five of them in the same second, so the window went back to 24 hours.

The routine's prompt is `workers/observability/routine/prompt.md`. The routine holds its own copy: after a change here merges, save the same text into the routine. Every run, fired or started by hand with the Run button, also sweeps every active issue that has no open record.

Tested 2026-11-24: a throwaway Worker that threw on every request started a run 20 seconds after its first error, with the issue id in the payload, and the run left it alone as out of scope. The same day a hand-started run recorded one issue as `needs-owner` and resolved one that had recovered. Not yet exercised by a real issue: the fix, merge and deploy path.

Known gap, measured the same day: an issue that is marked resolved and returns within the quiet window reopens in Cloudflare but starts no run. The next run sweeps it up: the routine also runs every day at 13:00 UTC (owner decision, 2026-11-25).

Until 2026-11-24 a launchd job on the Mac polled for issues every five minutes (`workers/observability/watch/`, removed). The owner replaced it because nobody watched the watcher.

Any session can look by hand, from a folder outside the checkout: `CLOUDFLARE_ACCOUNT_ID=a20259cba74e506296745f9c67c1f3bc cf o11y issues list --status active --quiet`.

## Scanner probes

Cloudflare Issues reports a request for a known probe path (`/.env`, `/.git/config`, `/wp-login.php`) that reaches a Worker. There is no setting for this issue type alone, and the automations cannot filter by type (docs and CLI read 2026-11-25).

- Measured on `games-static`, 2026-11-25: when the Worker passed the path to the static assets, one request made one high-risk occurrence. When the Worker answered 404 itself, twelve probes made no high-risk occurrence and twelve low-risk ones. Worker code lowers the grade and does not stop the report.
- The fix is a WAF custom rule that blocks the paths before any Worker runs: `lab_scanner_probe_paths` on the zone `adamwhite.work`, for `play.adamwhite.work` and `human.adamwhite.work`. Its body is `workers/observability/scanner-probe-rule.json`. Measured the same day: 134 recorded paths on each host got 403 and made no occurrence; real pages answered as before.
- The zone's plan has five custom rules and no regular expressions. Two rules belong to other services; leave them alone. Add and change a rule with `cf rulesets rules create` and `cf rulesets rules update <rule-id> --ruleset-id <id>`, never `cf rulesets entrypoint update`, which replaces all of them.
- A change to the rule is an owner decision. A run proposes it; it does not make it. After a change, update the JSON file in the same pull request.
- A new site file must not match the rule: no dotfiles except `/.well-known/`, and none of the extensions in it. The `games-static` build fails on most of these (`src/probe.mjs`).
- A path the rule does not cover still makes an issue and starts a run.

## Ignored on purpose

Dated lines: the issue, the Worker, and why it is working as designed.
