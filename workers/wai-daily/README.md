# Daily Workers AI player (Worker cron)

Worker `games-wai-daily` replaces the Mac LaunchAgent `work.adamwhite.lab-wai-play`. **Status, 2026-11-14: deployed; the first scheduled run worked as infrastructure but produced no model report (see Operating it).** It is a separate Worker from `games-static`; the static site keeps no server bindings.

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
- **Vision models are refused.** The plan uses Gemma 4 26B only (`@cf/google/gemma-4-26b-a4b-it`, 9,091 and 27,273 neurons per million input and output tokens, about twice Qwen's input rate). It replaced Qwen3 30B on 2026-11-25 by owner decision: Cloudflare retired Qwen3 30B on 2026-11-20 and every run from then to 2026-11-24 halted on its first request. The request turns Gemma's reasoning off with `chat_template_kwargs.enable_thinking: false`; with reasoning on, the same test request used 201 output tokens instead of 14. A failed request now records the error's class name and code, never its message.
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

The token needs Workers Scripts Edit, Workers R2 Storage Edit, Workers AI Read and Browser Rendering Edit on the account. To stop the job, delete the Worker or remove its cron triggers.

First live run, 2026-11-14 (version `f50390ef`): the 21:00 UTC cron exited `not-due` and spent nothing; the 22:00 UTC cron ran 117 s without exceptions, made 11 requests for 594 neurons ($0.0065), and stored every receipt. Both sessions ended `incomplete` ("model returned invalid operation twice"). Cause, measured the same day with five direct requests: the binding ignores a top-level `enable_thinking: false`, so Qwen3 spent its token allowance reasoning. Only ` /no_think` at the end of the user message returned the answer in `content` with no reasoning; `chat_template_kwargs` moved the answer into `reasoning_content`. The Worker now sends `/no_think`. A Dark Room exposes no named controls, so the prompt now tells the model to tap visible words there. Second run, 2026-11-15 (version `ed05dcbb`): no reasoning text in any reply; 70 requests, 3,556 neurons. His Word played 65 valid turns to an ending; A Dark Room failed on turn 3. Both sessions were lost to reply shapes: a stop sent as `{"op":"stop"}` with an object report, and operations followed by a long report that hit the 768-token limit mid-string. The parser now accepts the first and salvages the operation from the second. Still owed: a run that ends with a model report, and a live refusal of a duplicate claim (only one cron per day is due, so it has not occurred).

After the owner accepts the cutover, the lab Worker's `WAI_BUDGET_KEY` secret and `/lab/api/wai-budget` route have no remaining caller and can be removed (review 2026-11-27).

## Checks

`pnpm run check` runs the typecheck, the ledger and run tests with in-memory bindings, and a bundle dry run. CI runs it in the `workers` job on every pull request; a change under `workers/` alone starts no game lane. Set `PLAYWRIGHT_MODULE` to an installed Playwright with Chromium to include the real-browser session test.
