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

Some Workers answer 5xx on purpose (`games-lab-ai` at its daily cap, `games-crumbwar` when a room is busy). Issues reports those too. The watcher's run marks one `ignored` and adds a line under "Ignored on purpose" below.

## The watcher

`workers/observability/watch/check.sh` runs from launchd on the lab's Mac every five minutes.

1. `issues.mjs` lists active issues with the `cf` CLI (`cf o11y issues list`) and keeps those on a Worker named in a config in this repository, or in `ELSEWHERE`. A new Worker is covered as soon as its config is on main and the watcher's checkout is updated. Cloudflare's "Potential vulnerability scan" issues (type `security`) are skipped.
2. With nothing new it exits. No model starts.
3. A new issue, or one that was resolved and came back, starts headless `claude -p` with `handle-issue.md` in a fresh clone. The run fixes the fault, merges, deploys, and marks the issue resolved, or reports that the owner must decide.
4. State and log: `~/Library/Application Support/worker-issues/` (`watch.log`, `fired`, `failed`, `last-run.txt`). A failure nobody would see in the log raises one macOS notification.

Install or update (the watcher runs from its own pinned checkout, so a change to `watch/` takes effect only after a reviewed `git pull` there):

```sh
git clone https://github.com/adam0white/games.git "$HOME/Library/Application Support/worker-issues/watcher"
cp workers/observability/watch/work.adamwhite.worker-issues-watch.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/work.adamwhite.worker-issues-watch.plist
```

Stop it: `launchctl bootout gui/$(id -u)/work.adamwhite.worker-issues-watch`. Try it without starting a model: `WORKER_ISSUES_DRY_RUN=1 bash workers/observability/watch/check.sh`.

Any session can look by hand, from a folder outside the checkout: `CLOUDFLARE_ACCOUNT_ID=a20259cba74e506296745f9c67c1f3bc cf o11y issues list --status active --quiet`.

## Ignored on purpose

Dated lines: the issue, the Worker, and why it is working as designed.
