/** Pure Workers AI budget arithmetic shared by the local scripts and the Worker cron: no Node imports. */
import { DAILY_HARD_NEURONS } from './daily-counter.ts';

export const LOCAL_BUDGET_USD = 4;
// Token models: neurons per million input/output tokens. Whisper: neurons per audio minute, 0.
// Token rates checked 2026-10-23; Whisper checked 2026-11-03.
// https://developers.cloudflare.com/workers-ai/platform/pricing/
export const RATES: Record<string, readonly [number, number]> = {
  '@cf/openai/whisper-large-v3-turbo': [46.63, 0],
  '@cf/qwen/qwen3-30b-a3b-fp8': [4625, 30475],
  '@cf/meta/llama-3.2-3b-instruct': [4625, 30475],
  '@cf/mistralai/mistral-small-3.1-24b-instruct': [31876, 50488],
  '@cf/meta/llama-3.2-11b-vision-instruct': [4410, 61493],
  '@cf/cloudflare/clef': [21818, 0],
  '@cf/cloudflare/clairic': [9091, 0],
};
/** UTF-8 bytes upper-bound text BPE tokens, plus framing. Clairic bills each field pass.
 * Images reserve the whole documented 128k Mistral context, so the hard guard may reject them.
 */
export function textReservation(model: string, body: Record<string, unknown>): number {
  const rate = RATES[model];
  if (!rate) throw new Error('Model not allowlisted');
  if (model === '@cf/openai/whisper-large-v3-turbo') throw new Error('Audio is reserved by duration');
  const raw = JSON.stringify(body);
  const image = raw.includes('image_url') || raw.includes('"image"');
  const input = image ? 128_000 : new TextEncoder().encode(raw).length + 1024;
  const output = model.includes('/clef') || model.includes('/clairic') ? 0 : Number(body.max_tokens);
  if (!Number.isInteger(output) || output < 0 || output > 1024)
    throw new Error('max_tokens must be bounded at 1024');
  const fields = model.endsWith('/clairic')
    ? Math.max(1, Object.keys((body.fields ?? body.schema ?? body.queries ?? {}) as object).length)
    : 1;
  return Math.ceil((input * rate[0] * fields + output * rate[1]) / 1e6);
}
export function usageNeurons(model: string, result: Record<string, unknown>): number {
  const usage = result.usage as Record<string, unknown> | undefined;
  const direct = usage?.neurons;
  if (typeof direct === 'number' && Number.isFinite(direct) && direct >= 0) return direct;
  const input = usage?.input_tokens ?? usage?.prompt_tokens;
  const output =
    usage?.output_tokens ??
    usage?.completion_tokens ??
    (model.endsWith('/clef') || model.endsWith('/clairic') ? 0 : undefined);
  if (
    typeof input !== 'number' ||
    !Number.isInteger(input) ||
    input < 0 ||
    typeof output !== 'number' ||
    !Number.isInteger(output) ||
    output < 0
  )
    throw new Error('Response usage unreadable; reservation retained');
  const rate = RATES[model];
  if (!rate) throw new Error('Model not allowlisted');
  return (input * rate[0] + output * rate[1]) / 1e6;
}
/** Analytics can lag; the local hard limit remains independent of the account high-water gate. */
export function admissionAllowed(
  accountNeurons: number | null,
  localReserved: number,
  reserve: number,
): boolean {
  return (
    (accountNeurons === null
      ? localReserved + reserve <= 8_000
      : Math.max(accountNeurons, localReserved) + reserve <= 9_900) &&
    localReserved + reserve <= DAILY_HARD_NEURONS
  );
}
// Best-effort local headroom; other account callers and shared admission can still consume capacity.
export type BudgetPhase = 'preplay' | 'focused' | 'control';
export const HEADROOM_STOP = 'STOP: protected play headroom';
export function headroomAllowed(
  phase: BudgetPhase,
  accountNeurons: number | null,
  localReserved: number,
  reserve: number,
  reservedUSD: number,
): boolean {
  const headroom = phase === 'preplay' ? 5_500 : phase === 'focused' ? 1_000 : 0;
  return (
    admissionAllowed(accountNeurons, localReserved, reserve + headroom) &&
    reservedUSD + (reserve + headroom) * 0.000011 <= LOCAL_BUDGET_USD
  );
}
