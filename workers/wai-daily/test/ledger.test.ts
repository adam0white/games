import { expect, it } from 'vitest';
import { dailyKey } from '../src/instrument/daily-counter.ts';
import { createBudget, LEDGER_KEY, type Ledger, SEED_USD } from '../src/ledger.ts';
import { ai, bucket } from './fakes.ts';

const QWEN = '@cf/qwen/qwen3-30b-a3b-fp8';
const DAY = '2026-11-13';
const at = () => Date.parse(`${DAY}T22:00:00Z`);
const messages = [{ role: 'user', content: 'x'.repeat(2000) }];
// Qwen: 4,625 neurons per million input tokens and 30,475 per million output tokens.
const spent = (6000 * 4625 + 60 * 30475) / 1e6;

it('continues the archived Mac ledger and refunds a completed request down to its usage', async () => {
  const b = bucket();
  const budget = createBudget({ LAB: b.api, AI: ai(['{"ok":1}']).binding }, at);
  expect((await budget.summary())?.reservedUSD).toBe(SEED_USD);
  expect(await budget.infer(QWEN, messages, 768, DAY, 'control')).toBe('{"ok":1}');
  const ledger = b.json<Ledger>(LEDGER_KEY);
  expect(ledger.days[DAY]).toEqual({ reserved: spent, neurons: spent, calls: 1 });
  expect(ledger.reservedUSD).toBeCloseTo(SEED_USD + spent * 0.000011, 12);
  expect(b.json<{ cron: number }>(dailyKey(DAY)).cron).toBeGreaterThan(spent);
  expect(budget.receipts.map((r) => r.status)).toEqual(['reserved', 'complete']);
});

it('keeps the whole reservation when the request fails or its usage cannot be read', async () => {
  const b = bucket();
  const fake = ai([
    () => {
      throw new Error('upstream');
    },
    '{"ok":1}',
  ]);
  const original = fake.binding.run.bind(fake.binding);
  let call = 0;
  fake.binding.run = async (model, input) =>
    call++ === 0 ? original(model, input) : { response: '{"ok":1}', usage: {} };
  const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('reservation retained');
  const first = b.json<Ledger>(LEDGER_KEY).days[DAY];
  expect(first?.neurons).toBe(0);
  expect(first?.reserved).toBeGreaterThan(20);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('reservation retained');
  const second = b.json<Ledger>(LEDGER_KEY).days[DAY];
  expect(second?.reserved).toBe((first?.reserved ?? 0) * 2);
  expect(b.json<Ledger>(LEDGER_KEY).reservedUSD).toBeCloseTo(
    SEED_USD + (second?.reserved ?? 0) * 0.000011,
    12,
  );
});

it('refuses before any request at the daily ceiling, the play headroom and the lifetime cap', async () => {
  const cases: [Partial<Ledger>, 'focused' | 'control', string][] = [
    [
      { days: { [DAY]: { reserved: 7990, neurons: 7990, calls: 9 } } },
      'control',
      'STOP: daily neuron cap reached',
    ],
    [
      { days: { [DAY]: { reserved: 6990, neurons: 6990, calls: 9 } } },
      'focused',
      'STOP: protected play headroom',
    ],
    [{ reservedUSD: 3.9999 }, 'control', 'STOP: $4 local experiments allocation exhausted'],
  ];
  for (const [state, phase, message] of cases) {
    const b = bucket();
    b.seed(LEDGER_KEY, { v: 1, reservedUSD: SEED_USD, days: {}, ...state });
    const before = b.text(LEDGER_KEY);
    const fake = ai(['{"ok":1}']);
    const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
    await expect(budget.infer(QWEN, messages, 768, DAY, phase)).rejects.toThrow(message);
    expect(fake.calls).toHaveLength(0);
    expect(b.text(LEDGER_KEY)).toBe(before);
  }
  // The same 6,990 leaves the smaller control stage available.
  const b = bucket();
  b.seed(LEDGER_KEY, {
    v: 1,
    reservedUSD: SEED_USD,
    days: { [DAY]: { reserved: 6990, neurons: 6990, calls: 9 } },
  });
  const budget = createBudget({ LAB: b.api, AI: ai(['{"ok":1}']).binding }, at);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).resolves.toBe('{"ok":1}');
});

it('refuses when the shared counter is capped by the translator, and keeps the reservation', async () => {
  const b = bucket();
  b.seed(dailyKey(DAY), { local: 0, translator: 11_990 });
  const fake = ai(['{"ok":1}']);
  const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow(
    'shared daily admission unavailable or capped; reservation retained',
  );
  expect(fake.calls).toHaveLength(0);
  expect(b.json<Ledger>(LEDGER_KEY).days[DAY]?.reserved).toBeGreaterThan(20);
});

it('freezes the lifetime budget when usage exceeds the reservation', async () => {
  const b = bucket();
  const fake = ai(['{"ok":1}'], { prompt_tokens: 900_000, completion_tokens: 60 });
  const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow(
    'budget frozen pending audit',
  );
  expect(b.json<Ledger>(LEDGER_KEY).reservedUSD).toBe(4);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('allocation exhausted');
});

it('refuses a stale day, an unlisted model, a vision model and an invalid stored ledger', async () => {
  const b = bucket();
  const fake = ai([]);
  const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
  await expect(budget.infer(QWEN, messages, 768, '2026-11-12', 'control')).rejects.toThrow(
    'STOP: UTC day ended',
  );
  await expect(budget.infer('@cf/other/model', messages, 768, DAY, 'control')).rejects.toThrow(
    'not allowlisted',
  );
  await expect(
    budget.infer('@cf/meta/llama-3.2-11b-vision-instruct', messages, 768, DAY, 'control'),
  ).rejects.toThrow('Vision models');
  expect(b.keys()).toEqual([LEDGER_KEY]);
  // A ledger below the archived seed means the counter was reset; never spend against it.
  b.seed(LEDGER_KEY, { v: 1, reservedUSD: 0, days: {} });
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('Budget state invalid');
  expect(fake.calls).toHaveLength(0);
});

it('serializes concurrent reservations so none is lost', async () => {
  const b = bucket();
  const fake = ai(Array.from({ length: 4 }, () => '{"ok":1}'));
  const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
  await Promise.all(Array.from({ length: 4 }, () => budget.infer(QWEN, messages, 768, DAY, 'control')));
  const day = b.json<Ledger>(LEDGER_KEY).days[DAY];
  expect(day?.calls).toBe(4);
  expect(day?.neurons).toBeCloseTo(spent * 4, 9);
  expect(day?.reserved).toBeCloseTo(spent * 4, 9);
});

it('refuses to start a fresh ledger when the stored one is missing', async () => {
  const b = bucket(false);
  const fake = ai(['{"ok":1}']);
  const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
  await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('Budget ledger missing');
  expect(fake.calls).toHaveLength(0);
  expect(b.keys()).toEqual([]);
});

it('treats a storage error as a budget stop and never sends the request', async () => {
  for (const method of ['get', 'put'] as const) {
    const b = bucket();
    const fake = ai(['{"ok":1}']);
    b.failNext(method, LEDGER_KEY);
    const budget = createBudget({ LAB: b.api, AI: fake.binding }, at);
    await expect(budget.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow(/^Budget ledger/);
    expect(fake.calls).toHaveLength(0);
  }
});

it('reads the chat-completion response shape and its token usage', async () => {
  const b = bucket();
  const binding = {
    run: async () => ({
      choices: [{ message: { content: '{"ok":2}' } }],
      usage: { prompt_tokens: 6000, completion_tokens: 60, total_tokens: 6060 },
    }),
  };
  const budget = createBudget({ LAB: b.api, AI: binding }, at);
  expect(await budget.infer(QWEN, messages, 768, DAY, 'control')).toBe('{"ok":2}');
  expect(b.json<Ledger>(LEDGER_KEY).days[DAY]?.neurons).toBe(spent);
});

it('refuses a request near the run deadline and gives up on one that outlives it', async () => {
  const b = bucket();
  const fake = ai(['{"ok":1}']);
  const late = createBudget({ LAB: b.api, AI: fake.binding }, at, at() + 4_000);
  await expect(late.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('STOP: run deadline reached');
  expect(fake.calls).toHaveLength(0);
  const hung = createBudget({ LAB: b.api, AI: { run: () => new Promise(() => {}) } }, at, at() + 5_050);
  const started = Date.now();
  await expect(hung.infer(QWEN, messages, 768, DAY, 'control')).rejects.toThrow('reservation retained');
  expect(Date.now() - started).toBeLessThan(8_000);
  expect(b.json<Ledger>(LEDGER_KEY).days[DAY]?.reserved).toBeGreaterThan(20);
});
