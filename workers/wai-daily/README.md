# Daily Workers AI player (Worker cron)

Worker `games-wai-daily` replaces the Mac LaunchAgent `work.adamwhite.lab-wai-play`. **Status, 2026-11-13: source only. It has not been deployed, and no live run has been verified.** It is a separate Worker from `games-static`; the static site keeps no server bindings.

Each day at 16:00 America/Chicago it plays one rotating game and the A Dark Room control with a Workers AI model, under [Protocol 2](docs/playtester-prompt.md). The model receives only the page's visible text and accessible controls. This is synthetic playtest evidence; see [the instrument's limits](https://github.com/adam0white/human-framework/blob/main/docs/lab/wai-playtesters.md). The games come from the root `games.json`; a `recorded-viewer` entry is not played.

## How it runs

| Concern        | Rule                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule       | Crons at 21:00 and 22:00 UTC. `scheduledDue` admits a run only from 16:00 Chicago on the same UTC date, at least 30 minutes before the 00:00 UTC quota reset. One of the two fires in each season.                                |
| Once per day   | A conditional create of `private/wai-daily/<UTC-date>/plan.json` claims the day. A second cron, a duplicate delivery or a retry finds the claim and spends nothing. A failed attempt is not retried.                              |
| Browser        | Cloudflare Browser Rendering through `@cloudflare/playwright`. Each session gets a fresh browser. The page actions are the lab driver's own code, copied into `src/instrument/`.                                                  |
| Time           | A cron invocation ends after 15 minutes of wall time. The focused session has 7 minutes and the control 3, plus one closing minute each. The whole run has an absolute 13-minute deadline; no request starts within 5 seconds of it, and a session that cannot get 2 minutes is skipped. The Mac allowed 25 and 5; its recorded sessions from 2026-11-09 to 11-11 ran 0.2 to 3.9. |
| Inference      | The `AI` binding. No API token, secret or environment variable is configured.                                                                                                                                                     |
| Budget         | `ai-budget/cron-ledger-v1.json` in the private `hf-lab` bucket. It continues the archived Mac ledger from $1.68 of the $4 envelope. A missing or unreadable ledger refuses inference. Never delete it to recover capacity.                                                          |
| Daily ceilings | 8,000 neurons on this ledger, because the Worker cannot read account analytics. The shared 12,000-neuron counter (`ai-budget/daily-v1/<date>.json`) still bounds this ledger and the translator together.                         |
| Receipts       | `private/wai-daily/<UTC-date>/`: `plan.json`, `<n>-<game>/{report.json,turns/*.json,wall-clock.jsonl}`, `inference.jsonl` (rewritten after every request), `live-text.jsonl`, `skipped.jsonl`, `summary.json`. Reports are not submitted as feedback.             |

Bindings: `AI` (Workers AI), `BROWSER` (Browser Rendering), `LAB` (R2 bucket `hf-lab`).

## Differences from the Mac runner

- **Stages not yet ported (target 2026-11-20):** the reading sweep, narration variants, inbox suggestions, the reading refill and the Clef label on a report. They need game source and inbox access from the Worker. Until then a day spends roughly the two play sessions only.
- **No live catalogue check.** The Worker has no account API credential. A missing model fails the first request; that reservation is kept and the day halts.
- **No account-analytics gate.** The 8,000-neuron fallback applies every day. Unrelated account callers remain unbounded, as before.
- **Vision models are refused.** The plan uses Qwen3 30B only.
- **No first-minute screenshot** and no screenshots at all; the receipts are text.
- **Shorter sessions.** 7 and 3 minutes instead of 25 and 5.

## Copied code

`src/instrument/` and `docs/` are copies from Human Framework at `c2f7d0d` plus its pull request 130. `src/instrument/daily-counter.ts` must stay in step with the translator's `admitDaily` in Human Framework: both write `ai-budget/daily-v1/<date>.json`. The translator must know the `cron` field before this Worker's first run, or the shared 12,000-neuron ceiling undercounts.

## Operating it

Deploying is an owner decision, and nothing deploys this Worker automatically. Order matters:

1. Deploy the Human Framework lab Worker with the `cron` counter field (its pull request 130).
2. Store the seed once. Storing it again would reset the lifetime spend to the seed:
   ```sh
   pnpm exec wrangler r2 object put hf-lab/ai-budget/cron-ledger-v1.json --file seed/cron-ledger-v1.json --content-type application/json --remote
   ```
   Check first that the object does not exist (`wrangler r2 object get ... --remote --pipe`); `wrangler` has no create-only upload.
3. From exact green `main`, in this directory:
   ```sh
   pnpm run check                 # typecheck, tests, bundle dry run; no credentials
   pnpm exec wrangler deploy      # needs CLOUDFLARE_API_TOKEN
   pnpm exec wrangler r2 object get hf-lab/private/wai-daily/<UTC-date>/summary.json --remote --pipe
   ```

The token needs Workers Scripts Edit, Workers R2 Storage Edit, Workers AI Read and Browser Rendering Edit on the account. To stop the job, delete the Worker or remove its cron triggers. Qualification still owed after the first deploy: one scheduled run with its receipts, the ledger before and after, and no second spend from the other cron of that day. Not yet verified against the live binding: the `usage` fields Qwen3 returns, and that it accepts `response_format` with `enable_thinking`.

After the owner accepts the cutover, the lab Worker's `WAI_BUDGET_KEY` secret and `/lab/api/wai-budget` route have no remaining caller and can be removed (review 2026-11-27).

## Checks

`pnpm run check` runs the typecheck, the ledger and run tests with in-memory bindings, and a bundle dry run. CI runs it in the `workers` job on every pull request; a change under `workers/` alone starts no game lane. Set `PLAYWRIGHT_MODULE` to an installed Playwright with Chromium to include the real-browser session test.
