// Friends' tables for turn-based games: only protocol rules and state changes here. Sockets and storage live in index.mjs.
// A table is one game between friends who share a four-letter code. No account: a seat belongs to a random key the page keeps.
// The server holds the one true order of moves. It does not know any game's rules; each page checks moves with its own sim.js.
import { shownName } from './board.mjs';

// Add a game here to give it tables. `seats` is how many players a game needs before it can start.
export const TABLE = {
  games: { pitch: { seats: 2 }, pisti: { seats: 2 } },
  bytes: 300, messages: 12, windowMs: 1000,
  moves: 800, ints: 8, span: 1_000_000,
  // A table nobody has touched for this long is deleted, with its names and moves.
  idleMs: 24 * 60 * 60 * 1000,
};

export function tableName(path) {
  const m = /^\/lab-api\/table\/([a-z-]+)\/([A-Z]{4})$/.exec(path);
  return m && Object.hasOwn(TABLE.games, m[1]) ? { game: m[1], code: m[2], name: `${m[1]}/${m[2]}` } : null;
}

// JSON text only, within the byte limit. Unknown fields are refused. Returns the clean frame or null.
export function tableMessage(text) {
  if (typeof text !== 'string' || text.length > TABLE.bytes || new TextEncoder().encode(text).length > TABLE.bytes) return null;
  let q; try { q = JSON.parse(text); } catch { return null; }
  if (!q || typeof q !== 'object' || Array.isArray(q)) return null;
  const keys = Object.keys(q), only = fields => keys.length === fields.length && fields.every(k => Object.hasOwn(q, k));
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  // k is the seat key: random, made by the page, sent only inside this frame and never echoed to anyone.
  // v is the page's rules version; two pages with different rules must not share a table.
  if (q.t === 'hi' && only(['t', 'n', 'k', 'v']) && typeof q.n === 'string' && typeof q.k === 'string' && /^[A-Za-z0-9]{16,40}$/.test(q.k) && int(q.v, 1, 9999)) return { t: 'hi', n: shownName(q.n) || 'Friend', k: q.k, v: q.v };
  // i is the place in the game's move list the sender believes this move takes. m is the move: a few small integers.
  if (q.t === 'm' && only(['t', 'i', 'm']) && int(q.i, 0, TABLE.moves - 1) && Array.isArray(q.m) && q.m.length >= 1 && q.m.length <= TABLE.ints && q.m.every(x => int(x, -TABLE.span, TABLE.span))) return { t: 'm', i: q.i, m: q.m };
  if (q.t === 'again' && only(['t'])) return { t: 'again' };
  return null;
}

export const freshTable = (seats, seed, now) => ({ v: 0, game: 0, seed: seed >>> 0, seats: Array.from({ length: seats }, () => null), log: [], again: [], touched: now });

// Seat a player. `on` lists the seats that have a live socket. Returns { seat } or { refuse }.
// The same key always gets its own seat back, which is how a dropped player returns to the game.
export function sit(table, hi, on, seed, now) {
  const mine = table.seats.findIndex(s => s && s.k === hi.k);
  const others = on.filter(seat => seat !== mine).length;
  if (table.v && table.v !== hi.v) {
    // A different rules version may not join people who are playing. Alone, it starts the table again on its own version.
    if (others) return { refuse: 'version' };
    Object.assign(table, freshTable(table.seats.length, seed, now));
  }
  let seat = table.seats.findIndex(s => s && s.k === hi.k);
  if (seat < 0) seat = table.seats.findIndex(s => !s);
  if (seat < 0) return { refuse: 'full' };
  table.v = hi.v; table.seats[seat] = { k: hi.k, n: hi.n }; table.touched = now;
  return { seat };
}

// Add a move. Only the next place in the list is accepted, so every page sees the same order.
// 'again' means this exact move is already there (a resend after a reconnect); 'stale' means the sender is behind.
export function move(table, seat, q, now) {
  if (table.seats.some(s => !s)) return 'early';
  if (q.i === table.log.length) {
    if (table.log.length >= TABLE.moves) return 'long';
    table.log.push([seat, ...q.m]); table.touched = now; table.again = [];
    return 'ok';
  }
  const old = table.log[q.i];
  return old && old[0] === seat && old.length === q.m.length + 1 && q.m.every((x, j) => old[j + 1] === x) ? 'again' : 'stale';
}

// A vote for another game. When every seat has voted, the list empties, the game number rises and a new seed is drawn.
export function again(table, seat, seed, now) {
  if (table.seats.some(s => !s)) return false;
  if (!table.again.includes(seat)) table.again.push(seat);
  table.touched = now;
  if (table.again.length < table.seats.length) return false;
  table.game++; table.seed = seed >>> 0; table.log = []; table.again = [];
  return true;
}

// What every player may see. Seat keys never leave the server.
export const shown = (table, on) => table.seats.map((s, i) => s ? { n: s.n, on: on.includes(i) } : null);
