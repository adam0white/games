// A leaderboard shared between players: GET and POST /lab-api/board/<game>. One SQLite-backed Durable Object per
// game holds one row per player: a random id made on the player's phone, the name they typed, their best score.
// No account, no password, no address and nothing else about the player is stored, and nothing is logged.
// Scores are reported by the page, so a player who edits the page can post any score up to the cap.
import { originAllowed, utcDay } from './core.mjs';

// maxScore: Lantern's endless score is ten points a second, so one million is more than a day of play.
export const BOARD = { games: ['lantern'], top: 20, keep: 500, name: 16, maxScore: 1_000_000, body: 256, dailyNew: 2000, cacheSeconds: 20, cacheVersion: 1 };

// Stricter than the game's own name field: letters, digits, space and _ . - only, at most 16 characters. Markup characters never reach another player's screen as typed.
export const tidyName = v => (typeof v === 'string' ? v.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, BOARD.name).trim() : '');
// A basic filter for rude names (owner, 2026-11-23). The name is compared without spaces, dots, dashes and underscores, in
// lower case, with the usual digit-for-letter swaps undone. A name that contains a listed word is stored as "Player".
// It is a short English list and it will miss things; it is not a moderation system.
const RUDE = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'asshole', 'bastard', 'nazi', 'hitler', 'porn', 'retard'];
// Left out on purpose because they sit inside ordinary names and words: sex (Essex), dick (Dickens), cock (Hancock), rape (grape).
const SWAPS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };
export const rudeName = n => { const flat = n.toLowerCase().replace(/[ _.-]/g, '').replace(/[0134578]/g, d => SWAPS[d]); return RUDE.some(w => flat.includes(w)); };
export const shownName = v => { const n = tidyName(v); return n && rudeName(n) ? 'Player' : n; };
const goodId = v => typeof v === 'string' && /^[A-Za-z0-9-]{20,64}$/.test(v);

// Accepts { id, n, s } to post a score or { id, remove: true } to take the player's row away. Returns the clean request or null.
export function validateScore(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !goodId(body.id)) return null;
  const keys = Object.keys(body);
  if (body.remove === true) return keys.length === 2 ? { id: body.id, remove: true } : null;
  if (keys.length !== 3 || !('n' in body) || !('s' in body)) return null;
  const n = shownName(body.n);
  if (!n || !Number.isInteger(body.s) || body.s < 1 || body.s > BOARD.maxScore) return null;
  return { id: body.id, n, s: body.s };
}

// The storage, run inside the Durable Object against its SQLite (sql.exec as in ctx.storage.sql). A Durable
// Object handles one call at a time, so each function below is one step that nothing else can interleave.
function tables(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, n TEXT NOT NULL, s INTEGER NOT NULL, t INTEGER NOT NULL)');
  sql.exec('CREATE INDEX IF NOT EXISTS scores_best ON scores (s DESC, t ASC)');
  sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
}
/** The best rows, best first. The ids stay inside: a row is { n, s }. */
export function boardTop(sql, limit = BOARD.top) {
  tables(sql);
  return sql.exec('SELECT n, s FROM scores ORDER BY s DESC, t ASC LIMIT ?', limit).toArray().map(r => ({ n: r.n, s: r.s }));
}
/** Keep the player's best score and newest name. A new player counts against the day's cap. Returns { ok, place, rows }. */
export function boardPut(sql, { id, n, s }, now, cap = BOARD.dailyNew) {
  tables(sql);
  const old = sql.exec('SELECT s FROM scores WHERE id = ?', id).toArray()[0];
  if (!old) {
    const day = utcDay(now), made = sql.exec('SELECT n FROM days WHERE day = ?', day).toArray()[0]?.n ?? 0;
    if (made >= cap) return { ok: false, place: 0, rows: boardTop(sql) };
    sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', day);
    sql.exec('DELETE FROM days WHERE day < ?', day);
    sql.exec('INSERT INTO scores (id, n, s, t) VALUES (?, ?, ?, ?)', id, n, s, now);
    // Only the best rows are kept, so the table cannot grow without limit.
    sql.exec('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY s DESC, t ASC LIMIT ?)', BOARD.keep);
  } else if (s > old.s) sql.exec('UPDATE scores SET n = ?, s = ?, t = ? WHERE id = ?', n, s, now, id);
  else sql.exec('UPDATE scores SET n = ? WHERE id = ?', n, id);
  const mine = sql.exec('SELECT s, t FROM scores WHERE id = ?', id).toArray()[0];
  const place = mine ? sql.exec('SELECT COUNT(*) AS c FROM scores WHERE s > ? OR (s = ? AND t < ?)', mine.s, mine.s, mine.t).toArray()[0].c + 1 : 0;
  return { ok: true, place, rows: boardTop(sql) };
}
export function boardRemove(sql, id) {
  tables(sql);
  sql.exec('DELETE FROM scores WHERE id = ?', id);
  return { ok: true, place: 0, rows: boardTop(sql) };
}

const json = (status, body, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(originAllowed(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) },
});
const cacheKey = game => new Request(`https://games-lab-ai.cache/board/v${BOARD.cacheVersion}/${game}`);

// deps.cache is a Cache (caches.default in the Worker); deps.now is a clock for the tests.
export async function handleBoard(request, env, ctx = { waitUntil() {} }, deps = {}) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const game = /^\/lab-api\/board\/([a-z0-9-]{1,40})$/.exec(url.pathname)?.[1];
  if (!game || !BOARD.games.includes(game)) return json(404, { error: 'not found' }, origin);
  // A page on the game's own site sends no Origin header with a GET, so only a foreign Origin is refused.
  if (origin ? !originAllowed(origin) : request.method !== 'GET') return json(403, { error: 'origin' }, null);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
  }
  const board = () => env.BOARD.get(env.BOARD.idFromName(game)), cache = deps.cache;

  if (request.method === 'GET') {
    // Reads are answered from the cache for a few seconds, so a flood of reads does not reach the Durable Object.
    if (cache) { const hit = await cache.match(cacheKey(game)); if (hit) return json(200, await hit.json(), origin); }
    let rows;
    try { rows = await board().top(BOARD.top); } catch { return json(503, { error: 'board' }, origin); }
    if (cache) ctx.waitUntil(cache.put(cacheKey(game), new Response(JSON.stringify({ rows }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${BOARD.cacheSeconds}` } })));
    return json(200, { rows }, origin);
  }
  if (request.method !== 'POST') return json(405, { error: 'method' }, origin);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json(400, { error: 'type' }, origin);
  if (Number(request.headers.get('Content-Length') || 0) > BOARD.body) return json(413, { error: 'size' }, origin);
  let text;
  try { text = await request.text(); } catch { return json(400, { error: 'body' }, origin); }
  if (text.length > BOARD.body) return json(413, { error: 'size' }, origin);
  let body;
  try { body = JSON.parse(text); } catch { return json(400, { error: 'json' }, origin); }
  const q = validateScore(body);
  if (!q) return json(400, { error: 'fields' }, origin);

  // The same per-address limit as the persona endpoint, counted apart from it. The address is the limiter's key only; it is not stored.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try { if (!(await env.PER_IP.limit({ key: `board:${ip}` })).success) return json(429, { error: 'busy' }, origin); } catch { return json(429, { error: 'busy' }, origin); }

  let out;
  try { out = q.remove ? await board().remove(q.id) : await board().put(q, deps.now ? deps.now() : Date.now()); } catch { return json(503, { error: 'board' }, origin); }
  if (!out.ok) return json(503, { error: 'daily cap' }, origin);
  if (cache) ctx.waitUntil(cache.delete(cacheKey(game)));
  return json(200, { place: out.place, rows: out.rows }, origin);
}
