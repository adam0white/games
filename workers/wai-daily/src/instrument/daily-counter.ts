/**
 * Copied from human-framework apps/site/worker/wai-budget.ts: the lab Worker's translator writes the same
 * R2 object, so both copies must keep the same key, fields and ceiling.
 *
 * One UTC-day ceiling for local scripts, the daily cron Worker and the translator. R2 CAS serializes admissions.
 * Local scripts submit their durable cumulative high-water mark under a machine-wide lock.
 * The cron Worker submits the high-water mark of its own R2 ledger the same way.
 * Translator reservations are never refunded. This cannot bound unrelated account callers.
 */
import type { Bucket } from '../r2.ts';
export const DAILY_HARD_NEURONS = 12_000;
export const dailyKey = (day: string) => `ai-budget/daily-v1/${day}.json`;
type Daily = { local: number; translator: number; cron?: number };
export async function admitDaily(
  bucket: Bucket,
  day: string,
  caller: 'local' | 'translator' | 'cron',
  neurons: number,
): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(neurons) || neurons < 0) return false;
  for (let i = 0; i < 8; i++) {
    const old = await bucket.get(dailyKey(day));
    const state: Daily = old ? await old.json<Daily>() : { local: 0, translator: 0 };
    const cron = state.cron ?? 0;
    if (![state.local, state.translator, cron].every((n) => Number.isFinite(n) && n >= 0)) return false;
    const next =
      caller === 'local'
        ? { ...state, local: Math.max(state.local, neurons) }
        : caller === 'cron'
          ? { ...state, cron: Math.max(cron, neurons) }
          : { ...state, translator: state.translator + neurons };
    if (next.local + next.translator + (next.cron ?? 0) > DAILY_HARD_NEURONS) return false;
    if (
      await bucket.put(dailyKey(day), JSON.stringify(next), {
        onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: '*' },
      })
    )
      return true;
  }
  return false;
}
