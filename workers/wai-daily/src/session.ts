/**
 * One source-unread playtest session inside the Worker. The model receives only the page's visible text
 * and accessible controls, through the same operation rules as the local lab:play driver.
 */
import {
  makeLogLine,
  makePlayReply,
  type PlayOp,
  type PlaySnapshot,
  runPlayOperation,
  validatePlayOp,
} from './instrument/play-helpers.ts';
import { type Page, pageActor } from './instrument/play-page.ts';
import {
  answer,
  type DailySession,
  type DriverReply,
  type ModelAnswer,
  normalizeTapName,
  personaBrief,
  systemPrompt,
  turnPrompt,
} from './instrument/wai-core.ts';
import type { BudgetPhase } from './instrument/wai-rates.ts';
import { utcDay } from './ledger.ts';

export interface SessionOptions {
  session: DailySession;
  page: Page;
  protocol: string;
  panel: string;
  expectedDay: string;
  infer(
    model: string,
    messages: { role: string; content: string }[],
    maxTokens: number,
    expectedDay: string,
    phase: BudgetPhase,
  ): Promise<string>;
  /** Stores one receipt for this session under its own prefix. */
  store(name: string, body: string | Uint8Array): Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Time the model has to file its report after the ceiling. */
  closingMs?: number;
  /** Absolute time by which the session must have ended, whatever its ceiling. */
  deadline?: number;
}
export interface SessionResult {
  stop: ModelAnswer | null;
  failure: string | null;
  /** True when the failure is a budget, admission or inference stop rather than a tool fault. */
  budgetStop: boolean;
  started: string;
  ended: string;
  turns: number;
  /** Visible text the model was shown, for the later reading stage. */
  liveText: { text: string; timestamp: string }[];
}
const BUDGET_STOP = /STOP:|USAGE LIMIT|reservation retained|Budget |budget |authentication|HTTP 429/iu;

/** The lab:play request handler without the HTTP server: validate, act, snapshot, log, reply. */
function createDriver(
  page: Page,
  o: { url: string; ceilingMs: number; now: () => number; sleep: (ms: number) => Promise<void> },
  store: SessionOptions['store'],
) {
  let openedAt: number | null = null;
  let stopped = false;
  let cached: PlaySnapshot | null = null;
  const wall: unknown[] = [];
  const act = pageActor(page, {
    phone: false,
    url: o.url,
    opened: () => openedAt !== null,
    startClock: () => {
      openedAt = o.now();
    },
    screenshot: async (file) => {
      const bytes = (await page.screenshot({ fullPage: false, timeout: 10_000 })) as Uint8Array;
      await store(file, bytes);
      return file;
    },
  });
  return {
    wall,
    async send(raw: Record<string, unknown>): Promise<DriverReply> {
      const started = o.now();
      const result = await runPlayOperation(raw, {
        previous: cached,
        now: o.now,
        act: async (resolvedName) => {
          let op: PlayOp;
          try {
            op = validatePlayOp(raw);
          } catch (error) {
            throw new Error(
              `${error instanceof Error ? error.message : String(error)} (invalid request, not a driver failure)`,
            );
          }
          if (op.op !== 'log') {
            if (!stopped && openedAt !== null && o.now() - openedAt >= o.ceilingMs) {
              stopped = true;
              wall.push(
                makeLogLine(
                  { op: 'ceiling', kind: 'stop', reason: 'BUDGET' },
                  { now: o.now(), openedAt, op_ms: 0 },
                ),
              );
            }
            if (stopped)
              throw new Error(
                'Session ceiling reached; browser operations are refused (stop reason BUDGET, not a driver failure)',
              );
            if (op.op !== 'open' && openedAt === null)
              throw new Error('Call open first (invalid request, not a driver failure)');
          }
          // A resolved tap uses the full current control name, exactly, never the tester's fragment.
          if (resolvedName !== undefined && op.op === 'tap') {
            const { text: _text, ...named } = op as PlayOp & { text?: string };
            op = { ...named, name: resolvedName } as PlayOp;
          }
          const shot = await act(op);
          if (op.op !== 'log') await o.sleep(100);
          return shot;
        },
        snapshot: async (timeout) => ({
          // biome-ignore lint/performance/useDomNodeTextContent: The agent snapshot must contain only rendered text.
          visible: await page.locator('body').innerText({ timeout }),
          controls: await page.locator('body').ariaSnapshot({ timeout }),
        }),
      });
      cached = result.snapshot;
      wall.push(
        makeLogLine(
          raw,
          { now: o.now(), openedAt, op_ms: o.now() - started },
          result.error,
          result.requested_control_present_before,
          result.error === undefined ? result.resolved : undefined,
        ),
      );
      return makePlayReply(result, { now: o.now(), started, openedAt });
    },
  };
}

export async function playSession(options: SessionOptions): Promise<SessionResult> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const { session, expectedDay } = options;
  const phase: BudgetPhase = session.control ? 'control' : 'focused';
  const driver = createDriver(
    options.page,
    // The driver's own hard ceiling sits one minute past the runner's, as a backstop.
    { url: session.url, ceilingMs: (session.ceiling + 1) * 60_000, now, sleep },
    options.store,
  );
  const start = now();
  const closingMs = options.closingMs ?? 60_000;
  const deadline = options.deadline ?? Number.POSITIVE_INFINITY;
  const liveText: SessionResult['liveText'] = [];
  let stop: ModelAnswer | undefined;
  let failure: string | undefined;
  let opened = false;
  let turns = 0;
  let invalidReplies = 0;
  try {
    const system = systemPrompt(options.protocol, personaBrief(options.panel, session.persona), session);
    let reply = await driver.send({ op: 'open' });
    opened = true;
    let history: { role: string; content: string }[] = [];
    let closing = false;
    let closingDeadline = 0;
    for (let turn = 0; turn < 500; turn++) {
      if (utcDay(now()) !== expectedDay) throw new Error('STOP: UTC day ended');
      const elapsed = (now() - start) / 60_000;
      if (!closing && (elapsed >= session.ceiling || now() >= deadline - closingMs)) {
        await driver.send({
          op: 'log',
          kind: 'stop',
          reason: 'BUDGET',
          reaction: 'Coordinator ceiling reached; no player verdict inferred.',
        });
        closing = true;
        closingDeadline = Math.min(now() + closingMs, deadline);
      }
      if (closing && now() >= closingDeadline) break;
      const user = turnPrompt(elapsed, session, closing, reply);
      if (!session.control && reply.visible?.trim())
        liveText.push({ text: reply.visible, timestamp: new Date(now()).toISOString() });
      const raw = await options.infer(
        session.model,
        [{ role: 'system', content: system }, ...history, { role: 'user', content: user }],
        768,
        expectedDay,
        phase,
      );
      await options.store(
        `turns/${String(turns++).padStart(4, '0')}.json`,
        JSON.stringify({ t: new Date(now()).toISOString(), snapshot: reply, response: raw }),
      );
      let parsed: ModelAnswer;
      try {
        parsed = answer(raw);
        invalidReplies = 0;
      } catch {
        invalidReplies++;
        if (invalidReplies > 1)
          throw new Error('TOOL: model returned invalid operation twice; no input executed');
        reply = {
          ...reply,
          coordinator:
            'Your last JSON operation was invalid. Retry once using only the documented operation schema and current controls.',
        };
        continue;
      }
      const op = normalizeTapName(parsed.op as PlayOp, reply.controls ?? '');
      if ((op.kind === 'first_minute' && elapsed < 1) || (op.kind === 'pulse' && elapsed < 3)) {
        reply = {
          ...reply,
          coordinator:
            'That elapsed checkpoint has not happened. Choose a real next input without inventing time or observations.',
        };
        continue;
      }
      if (op.op === 'log' && op.kind === 'stop') {
        if (!closing && elapsed < session.floor && !['TOOL', 'FINISHED'].includes(op.reason ?? '')) {
          reply = {
            ...reply,
            coordinator:
              'Floor not reached. Log want_quit and continue. Broken game or driver block must be described accurately.',
          };
          continue;
        }
        stop = parsed;
        await driver.send(op as unknown as Record<string, unknown>);
        break;
      }
      // A wait may not carry the session past its ceiling or the run deadline.
      const left = Math.min(start + session.ceiling * 60_000, deadline - closingMs) - now();
      const bounded =
        op.op === 'wait' ? { ...op, s: Math.max(0, Math.min(op.s, Math.floor(left / 1000))) } : op;
      reply = await driver.send(bounded as unknown as Record<string, unknown>);
      history = [...history, { role: 'user', content: user }, { role: 'assistant', content: raw }].slice(-8);
      await sleep(1500);
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Session failed';
    if (opened)
      await driver
        .send({
          op: 'log',
          kind: 'stop',
          reason: BUDGET_STOP.test(failure) ? 'BUDGET' : 'TOOL',
          reaction: `Coordinator interruption: ${failure}. No player verdict inferred.`,
        })
        .catch(() => {});
  }
  await options
    .store('wall-clock.jsonl', driver.wall.map((line) => `${JSON.stringify(line)}\n`).join(''))
    .catch(() => {});
  return {
    stop: stop ?? null,
    failure: failure ?? null,
    budgetStop: failure !== undefined && BUDGET_STOP.test(failure),
    started: new Date(start).toISOString(),
    ended: new Date(now()).toISOString(),
    turns,
    liveText,
  };
}
