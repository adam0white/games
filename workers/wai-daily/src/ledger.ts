/**
 * The cron Worker's Workers AI budget. One private R2 object holds the lifetime dollar reservation and
 * each UTC day's neurons. Every change is a conditional write, and a reservation is stored before its
 * request. Timeouts, crashes and unreadable usage keep the reservation.
 *
 * The Worker has no account-analytics credential. It therefore always applies the 8,000-neuron ceiling
 * that the local scripts applied when analytics could not be read. The shared 12,000-neuron counter
 * still bounds this ledger and the translator together. Neither bounds unrelated account callers.
 */

import { responseText } from './instrument/wai-core.ts';
import {
  admissionAllowed,
  type BudgetPhase,
  HEADROOM_STOP,
  headroomAllowed,
  LOCAL_BUDGET_USD,
  textReservation,
  usageNeurons,
} from './instrument/wai-rates.ts';
import { admitDaily } from './instrument/daily-counter.ts';

import type { Ai, Bucket } from './r2.ts';

export type { Ai, Bucket };
/** Keep forever: deleting this object resets the lifetime spend ceiling. */
export const LEDGER_KEY = 'ai-budget/cron-ledger-v1.json';
/**
 * The Mac ledger's last lifetime reservation, rounded up to the cent. Source: `reservedUSD`
 * 1.6797887647 in wai-daily-state/budget.json of the private lab archive; its last spending day is
 * 2026-11-12. The Worker continues that ledger. The owner stores seed/cron-ledger-v1.json once before
 * the first run; a missing object refuses inference instead of starting a fresh ledger.
 */
export const SEED_USD = 1.68;
const USD_PER_NEURON = 0.000011;
const KEEP_DAYS = 35;
export interface LedgerDay {
  reserved: number;
  neurons: number;
  calls: number;
}
export interface Ledger {
  v: 1;
  reservedUSD: number;
  days: Record<string, LedgerDay>;
}
export interface Receipt {
  model: string;
  phase: BudgetPhase;
  reserve: number;
  neurons?: number;
  status: 'reserved' | 'complete';
  timestamp: string;
}
export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const amount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function parse(raw: unknown): Ledger {
  const value = raw as Ledger;
  if (
    value?.v !== 1 ||
    !amount(value.reservedUSD) ||
    value.reservedUSD < SEED_USD - 1e-9 ||
    !value.days ||
    typeof value.days !== 'object' ||
    !Object.values(value.days).every(
      (day) => day && amount(day.reserved) && amount(day.neurons) && Number.isInteger(day.calls),
    )
  )
    throw new Error('Budget state invalid; refusing inference');
  return value;
}

export function createBudget(
  env: { LAB: Bucket; AI: Ai },
  now: () => number = Date.now,
  /** No request may outlive this time; the cron invocation ends soon after it. */
  deadline = Number.POSITIVE_INFINITY,
) {
  const receipts: Receipt[] = [];
  /** Apply one change under compare-and-swap. A change that throws is never written. */
  async function mutate(day: string, change: (ledger: Ledger, today: LedgerDay) => void): Promise<Ledger> {
    for (let attempt = 0; attempt < 6; attempt++) {
      let old: Awaited<ReturnType<Bucket['get']>>;
      let stored: unknown;
      try {
        old = await env.LAB.get(LEDGER_KEY);
        stored = old ? await old.json<unknown>() : null;
      } catch {
        throw new Error('Budget ledger unreadable; refusing inference');
      }
      if (!old) throw new Error('Budget ledger missing; refusing inference until the owner stores the seed');
      const ledger = parse(stored);
      ledger.days[day] ??= { reserved: 0, neurons: 0, calls: 0 };
      change(ledger, ledger.days[day]);
      const oldest = utcDay(Date.parse(`${day}T00:00:00Z`) - KEEP_DAYS * 86_400_000);
      for (const key of Object.keys(ledger.days)) if (key < oldest) delete ledger.days[key];
      let saved: unknown;
      try {
        saved = await env.LAB.put(LEDGER_KEY, JSON.stringify(ledger), {
          httpMetadata: { contentType: 'application/json' },
          onlyIf: { etagMatches: old.etag },
        });
      } catch {
        // The write may or may not have landed. Treat it as a budget stop, never as a tool fault.
        throw new Error('Budget ledger write failed with an unknown outcome; reservation retained');
      }
      if (saved) return ledger;
    }
    throw new Error('Budget ledger write contended; reservation state unchanged by this attempt');
  }
  return {
    receipts,
    /** One guarded text request. Returns the model's text; throws a STOP or "reservation retained" error. */
    async infer(
      model: string,
      messages: { role: string; content: string }[],
      maxTokens: number,
      expectedDay: string,
      phase: BudgetPhase,
    ): Promise<string> {
      const day = utcDay(now());
      if (expectedDay !== day) throw new Error('STOP: UTC day ended');
      if (model.includes('vision')) throw new Error('Vision models are not supported by the cron Worker');
      const patience = Math.min(60_000, deadline - now());
      if (patience < 5_000) throw new Error('STOP: run deadline reached');
      const body = {
        messages,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        ...(model.includes('/qwen/') ? { enable_thinking: false } : {}),
      };
      const reserve = textReservation(model, body);
      const reserved = await mutate(day, (ledger, today) => {
        if (!admissionAllowed(null, today.reserved, reserve))
          throw new Error('STOP: daily neuron cap reached');
        if (ledger.reservedUSD + reserve * USD_PER_NEURON > LOCAL_BUDGET_USD)
          throw new Error('STOP: $4 local experiments allocation exhausted');
        if (!headroomAllowed(phase, null, today.reserved, reserve, ledger.reservedUSD))
          throw new Error(HEADROOM_STOP);
        ledger.reservedUSD += reserve * USD_PER_NEURON;
        today.reserved += reserve;
        today.calls++;
      });
      receipts.push({ model, phase, reserve, status: 'reserved', timestamp: new Date(now()).toISOString() });
      // Stored first: an ambiguous shared admission must never let a retry reclaim spend.
      let admitted = false;
      try {
        admitted = await admitDaily(env.LAB, day, 'cron', reserved.days[day]?.reserved ?? Number.NaN);
      } catch {
        admitted = false;
      }
      if (!admitted || utcDay(now()) !== day)
        throw new Error('STOP: shared daily admission unavailable or capped; reservation retained');
      let result: unknown;
      try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const request = env.AI.run(model, body);
        // A request that loses the race may still reject later; that outcome is already accounted for.
        request.catch(() => {});
        result = await Promise.race([
          request,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), patience);
          }),
        ]).finally(() => clearTimeout(timer));
      } catch {
        throw new Error('Inference unavailable; reservation retained');
      }
      if (!result || typeof result !== 'object') throw new Error('Inference failed; reservation retained');
      const neurons = usageNeurons(model, result as Record<string, unknown>);
      if (neurons > reserve) {
        await mutate(day, (ledger, today) => {
          ledger.reservedUSD = LOCAL_BUDGET_USD;
          today.neurons += neurons;
        });
        throw new Error('STOP: response exceeded conservative reservation; budget frozen pending audit');
      }
      const refund = reserve - neurons;
      await mutate(day, (ledger, today) => {
        today.neurons += neurons;
        today.reserved -= refund;
        ledger.reservedUSD -= refund * USD_PER_NEURON;
      });
      receipts.push({
        model,
        phase,
        reserve,
        neurons,
        status: 'complete',
        timestamp: new Date(now()).toISOString(),
      });
      return responseText(result as Record<string, unknown>);
    },
    /** The stored ledger, or null when it is missing. */
    async summary(): Promise<Ledger | null> {
      const stored = await env.LAB.get(LEDGER_KEY);
      return stored ? parse(await stored.json<unknown>()) : null;
    },
  };
}
