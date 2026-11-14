/** In-memory stand-ins for the R2 bucket, the AI binding and a one-button page. */
import type { Page } from '../src/instrument/play-page.ts';
import { LEDGER_KEY, SEED_USD } from '../src/ledger.ts';
import type { Ai, Bucket } from '../src/r2.ts';

/** Starts with the owner-stored seed ledger unless `seeded` is false. */
export function bucket(seeded = true) {
  const values = new Map<string, { raw: string | Uint8Array; revision: number }>();
  let revision = 0;
  const api: Bucket = {
    async get(key) {
      const held = values.get(key);
      if (!held) return null;
      const text = typeof held.raw === 'string' ? held.raw : new TextDecoder().decode(held.raw);
      return {
        key,
        etag: String(held.revision),
        size: text.length,
        uploaded: new Date(),
        text: async () => text,
        json: async <T>() => JSON.parse(text) as T,
      };
    },
    async put(key, value, options) {
      const held = values.get(key);
      if (options?.onlyIf?.etagMatches !== undefined && options.onlyIf.etagMatches !== String(held?.revision))
        return null;
      if (options?.onlyIf?.etagDoesNotMatch === '*' && held) return null;
      revision++;
      values.set(key, { raw: value instanceof ArrayBuffer ? new Uint8Array(value) : value, revision });
      return { key, etag: String(revision), size: 0, uploaded: new Date() };
    },
  };
  if (seeded) values.set(LEDGER_KEY, { raw: JSON.stringify({ v: 1, reservedUSD: SEED_USD, days: {} }), revision: ++revision });
  return {
    api,
    /** Makes the next matching call throw, as R2 does on an internal error. */
    failNext(method: 'get' | 'put', key: string) {
      const real = api[method].bind(api) as (...args: unknown[]) => Promise<unknown>;
      (api as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
        if (args[0] !== key) return real(...args);
        (api as unknown as Record<string, unknown>)[method] = real;
        throw new Error('R2 internal error');
      };
    },
    keys: () => [...values.keys()].sort(),
    json: <T>(key: string) => JSON.parse(String(values.get(key)?.raw)) as T,
    text: (key: string) => String(values.get(key)?.raw ?? ''),
    seed: (key: string, value: unknown) => {
      values.set(key, { raw: JSON.stringify(value), revision: ++revision });
    },
  };
}

/** Replies in order; a function reply may throw. Usage is reported in tokens, as the binding does. */
export function ai(
  replies: (string | (() => never))[],
  usage = { prompt_tokens: 6000, completion_tokens: 60 },
) {
  const calls: { model: string; input: unknown }[] = [];
  const binding: Ai = {
    async run(model, input) {
      calls.push({ model, input });
      const next = replies.shift();
      if (next === undefined) throw new Error('No scripted reply left');
      if (typeof next === 'function') return next();
      return { response: next, usage };
    },
  };
  return { binding, calls };
}
export const op = (value: unknown, report?: string) => JSON.stringify({ op: value, report });
export const stopOp = (report: string) =>
  op({ op: 'log', kind: 'stop', reason: 'FINISHED', reaction: 'I made one choice.' }, report);

/** A page with one button. Tapping it changes the visible text; the button then leaves the page. */
export function page(name = 'Begin') {
  const state = { opened: '', taps: 0 };
  const button = {
    first: () => button,
    nth: () => button,
    or: () => button,
    filter: () => button,
    isEnabled: async () => true,
    count: async () => (state.taps ? 0 : 1),
    click: async () => {
      state.taps++;
    },
  };
  const body = {
    innerText: async () => (state.taps ? 'The lamp is lit.' : 'A dark room.'),
    ariaSnapshot: async () => (state.taps ? '- paragraph: The lamp is lit.' : `- button "${name}"`),
  };
  const fake = {
    goto: async (url: string) => {
      state.opened = url;
    },
    locator: () => body,
    getByRole: () => button,
  };
  return { page: fake as unknown as Page, state };
}
