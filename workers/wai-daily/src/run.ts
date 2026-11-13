/**
 * The scheduled daily run: gate on local time, claim the UTC day once, play the focused game and the
 * control, and keep every receipt in the lab's private bucket.
 */
import type { Page } from './instrument/play-page.ts';
import { dailyPlan, scheduledDue } from './instrument/wai-core.ts';
import { HEADROOM_STOP } from './instrument/wai-rates.ts';
import { type Ai, type Bucket, createBudget, utcDay } from './ledger.ts';
import { playSession } from './session.ts';

/**
 * A Worker cron invocation ends after 15 minutes of wall time. Recorded Mac sessions from 2026-11-09
 * to 2026-11-11 ran 0.2 to 3.9 minutes. Seven and three minutes, plus one closing minute each, fit in
 * the run deadline below. The deadline is absolute: no session, request or wait may pass it, which
 * leaves the remaining time for the final receipts.
 */
export const CEILINGS = { focused: 7, control: 3 };
export const RUN_DEADLINE_MS = 13 * 60_000;
/** A session that cannot get at least this long is skipped instead of started. */
const MINIMUM_SESSION_MS = 2 * 60_000;
export const dayPrefix = (day: string) => `private/wai-daily/${day}/`;

export interface RunDeps {
  LAB: Bucket;
  AI: Ai;
  /** A fresh browser page per session, so no session sees another's storage. */
  openPage(): Promise<{ page: Page; close(): Promise<void> }>;
  protocol: string;
  panel: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  closingMs?: number;
}
export type RunOutcome =
  | { status: 'not-due' | 'already-claimed' }
  | { status: 'ran'; day: string; halted: boolean; sessions: { game: string; status: string }[] };

export async function runScheduled(deps: RunDeps): Promise<RunOutcome> {
  const now = deps.now ?? Date.now;
  const started = new Date(now());
  // A cron can fire late. Outside the window nothing is read, written or spent.
  if (!scheduledDue(started)) return { status: 'not-due' };
  const day = utcDay(now());
  const prefix = dayPrefix(day);
  const put = (name: string, body: string | Uint8Array, contentType = 'application/json') =>
    deps.LAB.put(prefix + name, body, { httpMetadata: { contentType } });
  const plan = dailyPlan(started, CEILINGS);
  // The exclusive claim permits one scheduled attempt per UTC day, even after a failure.
  const claimed = await deps.LAB.put(
    `${prefix}plan.json`,
    JSON.stringify(
      { plan, mode: 'daily round', runner: 'worker-cron', started: started.toISOString() },
      null,
      2,
    ),
    { httpMetadata: { contentType: 'application/json' }, onlyIf: { etagDoesNotMatch: '*' } },
  );
  if (!claimed) return { status: 'already-claimed' };
  const deadline = now() + RUN_DEADLINE_MS;
  const budget = createBudget(deps, now, deadline);
  const jsonl = (rows: unknown[]) => rows.map((row) => `${JSON.stringify(row)}\n`).join('');
  // A killed invocation runs no cleanup, so a receipt that failed to store is at least logged by name.
  const keep = (name: string, body: string) =>
    put(name, body).then(
      () => {},
      () => console.log(JSON.stringify({ wai_daily: 'receipt not stored', name })),
    );
  // Every request's receipts are stored as soon as it settles, whether it succeeded or not.
  const infer: typeof budget.infer = async (...request) => {
    try {
      return await budget.infer(...request);
    } finally {
      await keep('inference.jsonl', jsonl(budget.receipts));
    }
  };
  const sessions: { game: string; status: string }[] = [];
  const skipped: unknown[] = [];
  const liveText: unknown[] = [];
  let halted = false;
  try {
    for (const [index, session] of plan.entries()) {
      if (utcDay(now()) !== day) {
        halted = true;
        break;
      }
      const out = `${index}-${session.game}/`;
      if (deadline - now() < MINIMUM_SESSION_MS) {
        skipped.push({ session, reason: 'Run deadline too close to start this session' });
        sessions.push({ game: session.game, status: 'skipped' });
        continue;
      }
      let browser: Awaited<ReturnType<RunDeps['openPage']>> | undefined;
      let result: Awaited<ReturnType<typeof playSession>>;
      try {
        browser = await deps.openPage();
        result = await playSession({
          session,
          page: browser.page,
          protocol: deps.protocol,
          panel: deps.panel,
          expectedDay: day,
          infer,
          deadline,
          store: async (name, body) => {
            await put(out + name, body, name.endsWith('.png') ? 'image/png' : 'application/json');
          },
          now,
          sleep: deps.sleep,
          closingMs: deps.closingMs,
        });
      } catch (error) {
        const at = new Date(now()).toISOString();
        const reason = error instanceof Error ? error.message : 'Session failed';
        result = {
          stop: null,
          failure: `Browser unavailable: ${reason}`,
          budgetStop: false,
          started: at,
          ended: at,
          turns: 0,
          liveText: [],
        };
      } finally {
        await browser?.close().catch(() => {});
      }
      // A stop without a written report is not a model report: the evidence the task asked for is missing.
      const reported = typeof result.stop?.report === 'string' && result.stop.report.trim() !== '';
      const failure = result.failure ?? (result.stop && !reported ? 'Model stopped without a final report' : null);
      const status = !failure && reported ? 'model-report' : 'incomplete';
      sessions.push({ game: session.game, status });
      for (const entry of result.liveText) liveText.push({ game: session.game, url: session.url, ...entry });
      await put(
        `${out}report.json`,
        JSON.stringify(
          {
            session,
            stop: result.stop,
            status,
            failure,
            feedback: 'Not submitted; report retained privately',
            timing: { started: result.started, ended: result.ended },
            turns: result.turns,
          },
          null,
          2,
        ),
      );
      if (!result.budgetStop || !result.failure) continue;
      // A definite local refusal leaves the smaller control stage available. Anything uncertain stops the day.
      if (result.failure === HEADROOM_STOP || result.failure === 'STOP: daily neuron cap reached') {
        skipped.push({ session, reason: result.failure });
        continue;
      }
      halted = true;
      skipped.push({ remaining: plan.slice(index + 1), reason: result.failure });
      break;
    }
  } finally {
    if (skipped.length) await keep('skipped.jsonl', jsonl(skipped));
    if (liveText.length) await keep('live-text.jsonl', jsonl(liveText));
    const ledger = await budget.summary().catch(() => null);
    await keep(
      'summary.json',
      JSON.stringify(
        {
          day,
          started: started.toISOString(),
          ended: new Date(now()).toISOString(),
          halted,
          sessions,
          ledgerDay: ledger?.days[day] ?? null,
          reservedUSD: ledger?.reservedUSD ?? null,
          note: 'Synthetic evidence only. Incomplete sessions and skipped coverage are not player verdicts. Dollar amounts estimate inference costs, not billed charges.',
        },
        null,
        2,
      ),
    );
  }
  return { status: 'ran', day, halted, sessions };
}
