// A leaderboard shared between players: GET and POST /lab-api/board/<game>. One SQLite-backed Durable Object per
// game holds one row per player: a random id made on the player's phone, the name they typed, their best score.
// No account, no password, no address and nothing else about the player is stored, and nothing is logged.
// Scores are reported by the page. A run ticket limits them: the page says when an endless run starts, and a score
// is accepted only if that much time has passed. This caps how fast a false score can grow; it does not prove a run.
import { originAllowed, utcDay } from './core.mjs';

// maxScore: Lantern's endless score is ten points a second, so one million is more than a day of play.
export const BOARD = { games: ['lantern', 'sling', 'breath', 'matchmaker', 'lantern-fp', 'ant-swarm'], top: 20, keep: 500, name: 16, maxScore: 1_000_000, body: 256, dailyNew: 2000, cacheSeconds: 20, cacheVersion: 1 };
// Run tickets. perSecond: Lantern's endless score grows by 10 a second, 18 during a boost. slack covers clock and network delay.
// need: the games whose scores are refused without a ticket. A game joins it once its page with tickets is live everywhere.
// Daily boards: every player gets the same river for one UTC day, and the board starts empty each day. The first read or
// post of a new day removes the day before's rows.
export const DAILY = ['lantern-daily'];
export const RUN = { perSecond: 18, slack: 50, hours: 6, keep: 20000, need: [] };

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

// Accepts { start: true, r } for a run ticket, { id, n, s } or { id, n, s, r } to post a score, or { id, remove: true } to take
// the player's row away. r is a random id for one run; it is not the player's id. Returns the clean request or null.
export function validateScore(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (body.start === true) return keys.length === 2 && goodId(body.r) ? { start: true, r: body.r } : null;
  if (!goodId(body.id)) return null;
  if (body.remove === true) return keys.length === 2 ? { id: body.id, remove: true } : null;
  const ticket = 'r' in body;
  if (keys.length !== (ticket ? 4 : 3) || !('n' in body) || !('s' in body) || (ticket && !goodId(body.r))) return null;
  const n = shownName(body.n);
  if (!n || !Number.isInteger(body.s) || body.s < 1 || body.s > BOARD.maxScore) return null;
  return ticket ? { id: body.id, n, s: body.s, r: body.r } : { id: body.id, n, s: body.s };
}

// The storage, run inside the Durable Object against its SQLite (sql.exec as in ctx.storage.sql). A Durable
// Object handles one call at a time, so each function below is one step that nothing else can interleave.
function tables(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, n TEXT NOT NULL, s INTEGER NOT NULL, t INTEGER NOT NULL)');
  sql.exec('CREATE INDEX IF NOT EXISTS scores_best ON scores (s DESC, t ASC)');
  sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS runs (r TEXT PRIMARY KEY, t INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
}
// A daily board keeps one day's rows. day is the UTC day (YYYY-MM-DD) for a daily board and nothing for the others.
function roll(sql, day) {
  tables(sql);
  if (!day || sql.exec("SELECT v FROM meta WHERE k = 'day'").toArray()[0]?.v === day) return;
  sql.exec('DELETE FROM scores');
  sql.exec("INSERT INTO meta (k, v) VALUES ('day', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", day);
}
/** A run ticket: the run's random id and the time it started. Old tickets go; a full table refuses new ones. */
export function boardStart(sql, r, now) {
  tables(sql);
  sql.exec('DELETE FROM runs WHERE t < ?', now - RUN.hours * 3600_000);
  if (sql.exec('SELECT COUNT(*) AS c FROM runs').toArray()[0].c >= RUN.keep) return { ok: false };
  sql.exec('INSERT OR IGNORE INTO runs (r, t) VALUES (?, ?)', r, now);
  return { ok: true };
}
/** The best rows, best first. The ids stay inside: a row is { n, s }. */
export function boardTop(sql, limit = BOARD.top, day = null) {
  roll(sql, day);
  return sql.exec('SELECT n, s FROM scores ORDER BY s DESC, t ASC LIMIT ?', limit).toArray().map(r => ({ n: r.n, s: r.s }));
}
/** Keep the player's best score and newest name. A new player counts against the day's cap. Returns { ok, place, rows };
 * a refusal carries why: 'run' (no ticket, or more score than the run's time allows) or 'cap'. A ticket works once. */
export function boardPut(sql, { id, n, s, r }, now, cap = BOARD.dailyNew, need = false, day = null) {
  roll(sql, day);
  if (r) {
    const run = sql.exec('SELECT t FROM runs WHERE r = ?', r).toArray()[0];
    if (!run || now < run.t || s > (now - run.t) / 1000 * RUN.perSecond + RUN.slack) return { ok: false, why: 'run', place: 0, rows: [] };
  } else if (need) return { ok: false, why: 'run', place: 0, rows: [] };
  const old = sql.exec('SELECT s FROM scores WHERE id = ?', id).toArray()[0];
  if (!old) {
    const day = utcDay(now), made = sql.exec('SELECT n FROM days WHERE day = ?', day).toArray()[0]?.n ?? 0;
    if (made >= cap) return { ok: false, why: 'cap', place: 0, rows: boardTop(sql) };
    sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', day);
    sql.exec('DELETE FROM days WHERE day < ?', day);
    sql.exec('INSERT INTO scores (id, n, s, t) VALUES (?, ?, ?, ?)', id, n, s, now);
    // Only the best rows are kept, so the table cannot grow without limit.
    sql.exec('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY s DESC, t ASC LIMIT ?)', BOARD.keep);
  } else if (s > old.s) sql.exec('UPDATE scores SET n = ?, s = ?, t = ? WHERE id = ?', n, s, now, id);
  else sql.exec('UPDATE scores SET n = ? WHERE id = ?', n, id);
  if (r) sql.exec('DELETE FROM runs WHERE r = ?', r);
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
  if (!game || !(BOARD.games.includes(game) || DAILY.includes(game))) return json(404, { error: 'not found' }, origin);
  // A page on the game's own site sends no Origin header with a GET, so only a foreign Origin is refused.
  if (origin ? !originAllowed(origin) : request.method !== 'GET') return json(403, { error: 'origin' }, null);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
  }
  const board = () => env.BOARD.get(env.BOARD.idFromName(game)), cache = deps.cache;
  const now = deps.now ? deps.now() : Date.now(), day = DAILY.includes(game) ? utcDay(now) : null, key = cacheKey(day ? `${game}/${day}` : game);

  if (request.method === 'GET') {
    // Reads are answered from the cache for a few seconds, so a flood of reads does not reach the Durable Object.
    if (cache) { const hit = await cache.match(key); if (hit) return json(200, await hit.json(), origin); }
    let rows;
    try { rows = await board().top(BOARD.top, day); } catch { return json(503, { error: 'board' }, origin); }
    if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify({ rows }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${BOARD.cacheSeconds}` } })));
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
  try { if (!(await env.PER_IP.limit({ key: `${q.start ? 'boardrun' : 'board'}:${ip}` })).success) return json(429, { error: 'busy' }, origin); } catch { return json(429, { error: 'busy' }, origin); }

  // A ticket changes no score, so it leaves the read cache alone. Its count is apart from the score posts' count.
  if (q.start) {
    try { return (await board().start(q.r, now)).ok ? json(200, { ok: true }, origin) : json(503, { error: 'runs' }, origin); } catch { return json(503, { error: 'board' }, origin); }
  }
  let out;
  try { out = q.remove ? await board().remove(q.id) : await board().put(q, now, RUN.need.includes(game), day); } catch { return json(503, { error: 'board' }, origin); }
  if (!out.ok) return out.why === 'run' ? json(422, { error: 'run' }, origin) : json(503, { error: 'daily cap' }, origin);
  if (cache) ctx.waitUntil(cache.delete(key));
  return json(200, { place: out.place, rows: out.rows }, origin);
}
