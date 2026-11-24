// Thumb Duel by link: what one tick of a player's input looks like on the wire, and the few messages around a match.
// Pure, like sim.js: the page and bots.mjs use the same code. The lockstep itself is experiments/kit/lockstep.js.
//
// A tick's input { held, taps, px, py, heldFor, releases } becomes a short list of integers. Positions are whole
// thousandths of the board, times are whole milliseconds. Both phones apply the DECODED input, the sender included,
// so the rounding is the same on both and the duel stays identical tick for tick.
import { blank, step, DT, KINDS } from './sim.js';

export const VERSION = 1;         // raise when the rules, the codec or the messages change: two versions are not seated together
// The duels a match by link deals. Hockey is left out: it is decided by reacting to the puck within a few ticks, and a
// network delay takes that away. In bots.mjs a careful bot beats a clumsy one at hockey 98% of matches with 1 tick of
// delay, 78% with 4 and 51% (a coin toss) with 6, the smallest delay a link uses; every other duel keeps its order.
export const FRIEND_KINDS = KINDS.filter(k => k !== 'hockey');
export const MSG = { input: 1, hello: 2, go: 3, again: 4, bye: 5, ping: 6, pong: 7 };

const q = v => Math.max(-100000, Math.min(100000, Math.round(v * 1000)));
const ms = v => Math.max(0, Math.min(100000, Math.round(v * 1000)));
// [flags, px, py, heldFor, ...taps (x, y), ...releases (x0, y0, x, y, ms)]
// flags: 1 held · 2 a pointer (px, py follow) · 4 heldFor follows · taps × 8 (up to 7) · releases × 64 (up to 7)
export function encode(inp) {
  const taps = (inp.taps ?? []).slice(0, 7), rels = (inp.releases ?? []).slice(0, 7);
  const pointer = inp.px !== null && inp.px !== undefined && inp.py !== null && inp.py !== undefined;
  const hf = inp.heldFor > 0 ? ms(inp.heldFor) : 0;
  const flags = (inp.held ? 1 : 0) | (pointer ? 2 : 0) | (hf > 0 ? 4 : 0) | (taps.length << 3) | (rels.length << 6);
  if (!flags) return [];
  const out = [flags];
  if (pointer) out.push(q(inp.px), q(inp.py));
  if (hf > 0) out.push(hf);
  for (const t of taps) out.push(q(t.x), q(t.y));
  // A keyboard launch release has only its time; its missing coordinates stay missing (NaN never reaches the sim).
  for (const r of rels) out.push(q(r.x0 ?? 0), q(r.y0 ?? 0), q(r.x ?? 0), q(r.y ?? 0), ms(r.seconds ?? 0));
  return out;
}
export function decode(a) {
  const inp = blank();
  if (!Array.isArray(a) || !a.length) return inp;
  const flags = a[0]; let i = 1;
  const next = () => (Number.isInteger(a[i]) ? a[i++] : (i++, 0));
  inp.held = !!(flags & 1);
  if (flags & 2) { inp.px = next() / 1000; inp.py = next() / 1000; }
  if (flags & 4) inp.heldFor = next() / 1000;
  for (let n = (flags >> 3) & 7; n > 0; n--) inp.taps.push({ x: next() / 1000, y: next() / 1000 });
  for (let n = (flags >> 6) & 7; n > 0; n--) inp.releases.push({ x0: next() / 1000, y0: next() / 1000, x: next() / 1000, y: next() / 1000, seconds: next() / 1000 });
  return inp;
}

// A 32-bit FNV-1a hash of the duel state, compared by both phones every 30 ticks (kit lockstep `check`).
export function stateHash(s) {
  const str = JSON.stringify([s.phase, s.kind, s.score, s.box.r, s.d]);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// The input delay for a match, in ticks, from the round trip the host measured (ms). Each phone's input must reach the
// other within the delay or the duel stalls: one way is about half the round trip, plus up to one send interval (50 ms)
// and a margin for jitter. Both phones use the same delay, so neither thumb is faster than the other.
export const DELAY = { min: 6, max: 15, sendMs: 50, marginMs: 25 };
export function delayFor(rttMs) {
  if (!Number.isFinite(rttMs) || rttMs <= 0) return DELAY.min;
  const ticks = Math.ceil((rttMs / 2 + DELAY.sendMs + DELAY.marginMs) / (1000 / 60));
  return Math.max(DELAY.min, Math.min(DELAY.max, ticks));
}

// One phone's share of a frame: sample this phone's input once per tick, step every tick both inputs are there for, and
// compare state with the friend every 30 ticks. `m` is { ls, s, me, onTick }; `acc` is the time owed (s). Returns the
// time still owed and whether the duel is held up waiting for the friend. The page and bots.mjs both run this.
export const CHECK_EVERY = 30;
export function drive(m, acc, sample) {
  while (acc >= DT && !m.s.over) {
    if (m.ls.canSample()) m.ls.push(encode(sample()));
    const pair = m.ls.ready();
    if (!pair) return { acc: Math.min(acc, DT), stalled: true };
    const mine = decode(pair.mine), theirs = decode(pair.theirs);
    step(m.s, m.me === 0 ? [mine, theirs] : [theirs, mine]);
    m.ls.advance();
    if (m.ls.tick % CHECK_EVERY === 0) m.ls.check(m.ls.tick, stateHash(m.s));
    m.onTick?.(mine, theirs);
    acc -= DT;
  }
  return { acc, stalled: false };
}
