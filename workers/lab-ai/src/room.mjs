// Race rooms: only protocol rules here. Sockets and their short-lived attachments live in index.mjs.
import { shownName } from './board.mjs';

export const ROOM = { games: ['lantern-race'], sockets: 8, bytes: 200, messages: 12, windowMs: 1000, roundMs: 150_000, countdownMs: 4000, readyMs: 8000 };
export function roomName(path) {
  const m = /^\/lab-api\/room\/([a-z-]+)\/(open|[A-Z]{4})$/.exec(path);
  return m && ROOM.games.includes(m[1]) ? `${m[1]}/${m[2]}` : null;
}

// JSON text only, including the byte limit (names may contain multi-byte letters). Unknown fields are refused.
export function roomMessage(text) {
  if (typeof text !== 'string' || text.length > ROOM.bytes || new TextEncoder().encode(text).length > ROOM.bytes) return null;
  let q; try { q = JSON.parse(text); } catch { return null; }
  if (!q || typeof q !== 'object' || Array.isArray(q)) return null;
  const keys = Object.keys(q), only = fields => keys.length === fields.length && fields.every(k => Object.hasOwn(q, k));
  const number = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  if (q.t === 'hi' && only(['t', 'n']) && typeof q.n === 'string') return { t: 'hi', n: shownName(q.n) || 'Boat' };
  if (q.t === 'ready' && only(['t'])) return { t: 'ready' };
  if (q.t === 'p' && only(['t', 'x', 'd', 'a']) && number(q.x, -1, 1) && number(q.d, 0, 100_000) && (q.a === 0 || q.a === 1)) return { t: 'p', x: q.x, d: q.d, a: q.a };
  if (q.t === 'done' && only(['t', 's']) && Number.isInteger(q.s) && number(q.s, 0, 1_000_000)) return { t: 'done', s: q.s };
  return null;
}

// A rolling second, not a fixed clock bucket: a burst across a bucket boundary must still be limited.
// Count invalid frames too. At most 13 timestamps are ever attached, and the thirteenth closes the socket.
export function rateWindow(times, now) {
  const next = times.filter(t => t > now - ROOM.windowMs); next.push(now);
  return { ok: next.length <= ROOM.messages, times: next };
}
// Only the connected racers can keep a round open. Spectators and departed racers do not count.
export const needsRound = (round, clients, now) => !round || now - round.start > ROOM.roundMs || clients.filter(c => c.inRound).every(c => c.done);
export const freshRound = (seed, now) => ({ seed: seed >>> 0, start: now + ROOM.countdownMs });
export const freeId = clients => Array.from({ length: ROOM.sockets }, (_, i) => i + 1).find(id => !clients.some(c => c.id === id)) ?? null;
