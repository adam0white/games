import { expect, it } from 'vitest';
import { LEDGER_KEY, type Ledger } from '../src/ledger.ts';
import { CEILINGS, dayPrefix, RUN_DEADLINE_MS, type RunDeps, runScheduled } from '../src/run.ts';
import { ai, bucket, op, page, stopOp } from './fakes.ts';

const protocol = 'PROTOCOL';
const panel = ['Maya Chen', 'Emre Kaya', 'Nia Okafor']
  .map((name) => `### ${name}\nBrief of ${name}.\n`)
  .join('');
// 2026-11-13 is in CST: 16:00 Chicago is 22:00 UTC.
const DUE = Date.parse('2026-11-13T22:00:05Z');
const prefix = dayPrefix('2026-11-13');

function deps(
  b: ReturnType<typeof bucket>,
  replies: Parameters<typeof ai>[0],
  start = DUE,
  usage?: Parameters<typeof ai>[1],
) {
  let clock = start;
  const fake = ai(replies, usage);
  const pages: ReturnType<typeof page>[] = [];
  const closed: number[] = [];
  const value: RunDeps = {
    LAB: b.api,
    AI: fake.binding,
    protocol,
    panel,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    openPage: async () => {
      const next = page();
      pages.push(next);
      return { page: next.page, close: async () => void closed.push(pages.length) };
    },
  };
  return { value, fake, pages, closed, advance: (ms: number) => (clock += ms) };
}
const play = [op({ op: 'tap', name: 'Begin', reaction: 'Trying it.' }), stopOp('Focused report.')];

it('does nothing outside the 16:00 Chicago window, in either season', async () => {
  for (const time of [
    '2026-11-13T21:00:05Z',
    '2026-11-13T23:45:00Z',
    '2026-07-01T20:00:00Z',
    '2026-07-01T00:30:00Z',
  ]) {
    const b = bucket();
    const d = deps(b, [], Date.parse(time));
    expect(await runScheduled(d.value)).toEqual({ status: 'not-due' });
    expect(b.keys()).toEqual([LEDGER_KEY]);
    expect(d.pages).toHaveLength(0);
  }
  // CDT: 21:00 UTC is 16:00 Chicago.
  const b = bucket();
  const d = deps(b, [stopOp('a'), stopOp('b')], Date.parse('2026-07-01T21:00:05Z'));
  expect((await runScheduled(d.value)).status).toBe('ran');
});

it('plays the focused game and the control once, and keeps every receipt privately', async () => {
  const b = bucket();
  const d = deps(b, [...play, stopOp('Control report.')]);
  const outcome = await runScheduled(d.value);
  expect(outcome).toMatchObject({ status: 'ran', halted: false });
  if (outcome.status !== 'ran') throw new Error('unreachable');
  expect(outcome.sessions.map((s) => s.status)).toEqual(['model-report', 'model-report']);
  expect(outcome.sessions[1]?.game).toBe('darkroom');
  const plan = b.json<{ plan: { game: string; ceiling: number; control: boolean; url: string }[] }>(
    `${prefix}plan.json`,
  );
  expect(plan.plan.map((s) => s.ceiling)).toEqual([CEILINGS.focused, CEILINGS.control]);
  // The page is opened at the planned address, tapped once, and each session gets its own browser.
  expect(d.pages.map((p) => p.state)).toEqual([
    { opened: plan.plan[0]?.url, taps: 1 },
    { opened: 'https://adarkroom.doublespeakgames.com/', taps: 0 },
  ]);
  expect(d.closed).toEqual([1, 2]);
  const focused = `${prefix}0-${plan.plan[0]?.game}/`;
  const report = b.json<{ stop: { report: string }; status: string; failure: null }>(`${focused}report.json`);
  expect(report).toMatchObject({
    status: 'model-report',
    failure: null,
    stop: { report: 'Focused report.' },
  });
  // The model saw the page before and after its tap, and nothing else.
  const turns = [0, 1].map((n) => b.json<{ snapshot: { visible: string } }>(`${focused}turns/000${n}.json`));
  expect(turns.map((t) => t.snapshot.visible)).toEqual(['A dark room.', 'The lamp is lit.']);
  const sent = JSON.stringify(d.fake.calls[0]?.input);
  expect(sent).toContain('PROTOCOL');
  expect(sent).toContain('Brief of');
  expect(b.text(`${focused}wall-clock.jsonl`).trim().split('\n')).toHaveLength(3);
  expect(b.keys().every((key) => key.startsWith(prefix) || key.startsWith('ai-budget/'))).toBe(true);
  expect(b.text(`${prefix}inference.jsonl`).trim().split('\n')).toHaveLength(6);
  expect(b.text(`${prefix}live-text.jsonl`)).not.toContain('darkroom');
  const summary = b.json<{ ledgerDay: { calls: number }; halted: boolean }>(`${prefix}summary.json`);
  expect(summary).toMatchObject({ halted: false, ledgerDay: { calls: 3 } });

  // The second cron of the day, or a duplicate delivery, spends nothing and changes nothing.
  const before = b.keys().map((key) => [key, b.text(key)]);
  const again = deps(b, [stopOp('must not be used')]);
  expect(await runScheduled(again.value)).toEqual({ status: 'already-claimed' });
  expect(again.fake.calls).toHaveLength(0);
  expect(again.pages).toHaveLength(0);
  expect(b.keys().map((key) => [key, b.text(key)])).toEqual(before);
});

it('still attempts the control after a definite local refusal, and never retries the day', async () => {
  const b = bucket();
  // 6,990 reserved: a focused call would cut into the control's 1,000 protected neurons.
  b.seed(LEDGER_KEY, {
    v: 1,
    reservedUSD: 2,
    days: { '2026-11-13': { reserved: 6990, neurons: 6990, calls: 1 } },
  });
  const d = deps(b, [stopOp('Control report.')]);
  const outcome = await runScheduled(d.value);
  expect(outcome).toMatchObject({ status: 'ran', halted: false });
  if (outcome.status !== 'ran') throw new Error('unreachable');
  expect(outcome.sessions.map((s) => s.status)).toEqual(['incomplete', 'model-report']);
  expect(b.text(`${prefix}skipped.jsonl`)).toContain('STOP: protected play headroom');
  expect(d.fake.calls).toHaveLength(1);
  expect(await runScheduled(deps(b, []).value)).toEqual({ status: 'already-claimed' });
});

it('halts the day when a request has an unknown outcome, keeping its reservation', async () => {
  const b = bucket();
  const d = deps(b, [
    () => {
      throw new Error('upstream');
    },
    stopOp('must not be used'),
  ]);
  const outcome = await runScheduled(d.value);
  expect(outcome).toMatchObject({ status: 'ran', halted: true, sessions: [{ status: 'incomplete' }] });
  expect(d.fake.calls).toHaveLength(1);
  expect(d.closed).toEqual([1]);
  const day = b.json<Ledger>(LEDGER_KEY).days['2026-11-13'];
  expect(day?.neurons).toBe(0);
  expect(day?.reserved).toBeGreaterThan(20);
  expect(b.text(`${prefix}skipped.jsonl`)).toContain('reservation retained');
});

it('stops a session after two invalid operations without executing any input', async () => {
  const b = bucket();
  const d = deps(b, ['not json', op({ op: 'open' }), stopOp('Control report.')]);
  const outcome = await runScheduled(d.value);
  if (outcome.status !== 'ran') throw new Error('unreachable');
  expect(outcome.sessions.map((s) => s.status)).toEqual(['incomplete', 'model-report']);
  expect(d.pages[0]?.state.taps).toBe(0);
  const game = outcome.sessions[0]?.game;
  expect(b.json<{ failure: string }>(`${prefix}0-${game}/report.json`).failure).toBe(
    'TOOL: model returned invalid operation twice; no input executed',
  );
});

it('asks for the report at the ceiling and ends the session when the closing minute passes', async () => {
  const b = bucket();
  const note = op({ op: 'log', kind: 'note', reaction: 'Still looking.' });
  // Each turn advances the fake clock by the runner's 1.5 s pause; the focused ceiling is seven minutes.
  // Small usage keeps the 8,000-neuron day ceiling out of this case.
  const d = deps(b, [...Array.from({ length: 400 }, () => note), stopOp('never reached')], DUE, {
    prompt_tokens: 100,
    completion_tokens: 10,
  });
  const outcome = await runScheduled({ ...d.value, closingMs: 60_000 });
  if (outcome.status !== 'ran') throw new Error('unreachable');
  const game = outcome.sessions[0]?.game;
  const report = b.json<{ status: string; failure: null; timing: { started: string; ended: string } }>(
    `${prefix}0-${game}/report.json`,
  );
  expect(report).toMatchObject({ status: 'incomplete', failure: null });
  const minutes = (Date.parse(report.timing.ended) - Date.parse(report.timing.started)) / 60_000;
  expect(minutes).toBeGreaterThanOrEqual(CEILINGS.focused);
  expect(minutes).toBeLessThanOrEqual(CEILINGS.focused + 1.5);
  expect(b.text(`${prefix}0-${game}/wall-clock.jsonl`)).toContain('Coordinator ceiling reached');
});

it('ends every session by the run deadline when requests are slow, and still stores the receipts', async () => {
  const b = bucket();
  const note = op({ op: 'log', kind: 'note', reaction: 'Still looking.' });
  const d = deps(b, Array.from({ length: 60 }, () => note), DUE, { prompt_tokens: 100, completion_tokens: 10 });
  // Every model call takes 50 s of the fake clock, close to the 60 s request limit. The fake cannot be
  // cut short as a real request is, so the invariant checked is when the last request may start.
  const run = d.fake.binding.run.bind(d.fake.binding);
  const starts: number[] = [];
  d.fake.binding.run = async (model, input) => {
    starts.push(d.value.now?.() ?? 0);
    d.advance(50_000);
    return run(model, input);
  };
  const outcome = await runScheduled(d.value);
  if (outcome.status !== 'ran') throw new Error('unreachable');
  expect(starts.length).toBeGreaterThan(5);
  expect(Math.max(...starts)).toBeLessThanOrEqual(DUE + RUN_DEADLINE_MS - 5_000);
  expect(outcome.sessions).toHaveLength(2);
  // Receipts were stored after each request, not only at the end.
  expect(b.text(`${prefix}inference.jsonl`).trim().split('\n').length).toBe(d.fake.calls.length * 2);
});

it('halts the day as a budget stop when the ledger cannot be written', async () => {
  const b = bucket();
  const d = deps(b, [stopOp('must not be used')]);
  b.failNext('put', LEDGER_KEY);
  const outcome = await runScheduled(d.value);
  expect(outcome).toMatchObject({ status: 'ran', halted: true, sessions: [{ status: 'incomplete' }] });
  expect(d.fake.calls).toHaveLength(0);
});
