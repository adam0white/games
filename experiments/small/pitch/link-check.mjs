// Two phones at one table by link: PLAYWRIGHT=<dir with playwright> node experiments/small/pitch/link-check.mjs [webkit|chromium]
// One iPhone 13 (WebKit) and one Pixel 7 (Chromium), so the pair is also two different JavaScript engines; each run swaps
// which one makes the table. Their sockets go to the real table (workers/lab-ai Table class and handleTable, with
// stand-ins for the platform and its storage) through Playwright's WebSocket routing, with a delay each way, as
// experiments/duel/link-check.mjs does for the relay room.
// Covers: the code and the shared link, an old save on the host, the guest in Turkish, a whole match by touch on both
// phones with the same sheet after every move, a cut and reconnect mid-match, the end card on both, and the rematch.
// The argument names the engine that hosts; with none, both orders run. Screenshots go to $SHOTS.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { answerLab } from '../../kit/check/lab-record.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..'), worker = resolve(root, '../workers/lab-ai/src');
const SHOTS = process.env.SHOTS || '/tmp/claude-improve-pitch/link-shots';
await mkdir(SHOTS, { recursive: true });

// ---------------------------------------------------------------- the real table, off the platform (as in workers/lab-ai/test/table.test.mjs)
let source = await readFile(join(worker, 'index.mjs'), 'utf8');
source = source.replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }')
  .replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${new URL(p, 'file://' + worker + '/').href}'`);
const { Table, handleTable } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const NativeResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init) { return init?.status === 101 ? { ...init, body } : new NativeResponse(body, init); } };
class ServerSocket { // the server's end; frames wait until the bridge to the page is attached
  constructor() { this.readyState = 1; this.attachment = null; this.out = []; this.to = null; }
  accept() {}
  send(q) { if (this.readyState !== 1) throw new Error('closed'); this.to ? this.to.message(q) : this.out.push(['m', q]); }
  close(code) { if (this.readyState === 3) return; this.readyState = 3; this.to ? this.to.close(code) : this.out.push(['c', code]); }
  attach(to) { this.to = to; for (const [kind, v] of this.out.splice(0)) kind === 'm' ? to.message(v) : to.close(v); }
  serializeAttachment(c) { this.attachment = structuredClone(c); }
  deserializeAttachment() { return structuredClone(this.attachment); }
}
globalThis.WebSocketPair = class { constructor() { this[0] = { server: null }; this[1] = new ServerSocket(); this[0].server = this[1]; } };
const tables = new Map();
function ctxFor() {
  const kept = new Map();
  return { sockets: [], getWebSockets() { return this.sockets.filter(s => s.readyState === 1); }, acceptWebSocket(ws) { this.sockets.push(ws); },
    blockConcurrencyWhile: fn => fn(),
    storage: { get: async k => structuredClone(kept.get(k)), put: async (k, v) => { kept.set(k, structuredClone(v)); }, deleteAll: async () => { kept.clear(); }, setAlarm: async () => {} } };
}
const env = { TABLE_JOIN: { limit: async () => ({ success: true }) }, TABLE: { idFromName: n => n, get: n => { if (!tables.has(n)) { const t = new Table(ctxFor(), {}); t.queue = Promise.resolve(); tables.set(n, t); } return tables.get(n); } } };
// A Durable Object runs one event at a time; the stand-in keeps that order with a queue per table.
const inOrder = (t, fn) => (t.queue = t.queue.then(fn).catch(e => console.error(e)));

// One page's line to the table: `latency` ms each way plus up to `jitter`, in order (a socket keeps order).
function line(net) {
  return async ws => {
    const url = new URL(ws.url()), held = [];
    let server = null, table = null, lastIn = 0, lastOut = 0, open = true;
    const later = (dir, fn) => { const t = Date.now(), at = Math.max(dir === 'in' ? lastIn : lastOut, t + net.latency + Math.random() * net.jitter); if (dir === 'in') lastIn = at; else lastOut = at; setTimeout(fn, at - t); };
    ws.onMessage(text => { if (!net.cut) (server ? later('in', () => server.readyState === 1 && inOrder(table, () => table.webSocketMessage(server, text))) : held.push(text)); });
    ws.onClose(() => { open = false; if (server) later('in', () => { if (server.readyState === 1) { server.readyState = 3; inOrder(table, () => table.webSocketClose(server, 1000, '')); } }); });
    net.sockets.add(ws);
    while (net.cut) await new Promise(r => setTimeout(r, 50)); // the line is down: the socket hangs until it is back
    const res = await handleTable(new Request(`https://play.adamwhite.work${url.pathname}`, { headers: { Origin: 'https://play.adamwhite.work', Upgrade: 'websocket', 'CF-Connecting-IP': '203.0.113.9' } }), env);
    if (res.status !== 101) { ws.close({ code: 1011 }); return; }
    server = res.webSocket.server; table = tables.get(url.pathname.split('/').slice(-2).join('/'));
    server.attach({ message: q => later('out', () => open && !net.cut && ws.send(q)), close: code => later('out', () => { open = false; ws.close({ code }).catch(() => {}); }) });
    for (const text of held.splice(0)) inOrder(table, () => table.webSocketMessage(server, text));
  };
}
async function cutLine(net) {
  net.cut = true;
  for (const ws of net.sockets) await ws.close({ code: 1011 }).catch(() => {});
  net.sockets.clear();
}

// ---------------------------------------------------------------- pages
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url);
const { webkit, chromium, devices } = require(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'playwright') : 'playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const P = (page, fn, arg) => page.evaluate(fn, arg);
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`), timeout: 60000 });
async function until(page, fn, what, ms = 25000, arg) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); }
  catch { throw new Error(`timed out waiting for: ${what}; state=${JSON.stringify(await P(page, () => window.__pitch && { screen: __pitch.screen, mode: __pitch.mode, canTap: __pitch.canTap, room: __pitch.room, score: __pitch.score }).catch(() => null))}`); }
}

async function phone(browser, name, device, net) {
  const context = await browser.newContext({ ...device }), page = await context.newPage(), errors = [];
  await context.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__sharedLink = d; } }); });
  await context.route('**/*', route => { const u = route.request().url(); return u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.abort(); });
  await answerLab(context, base);
  await context.routeWebSocket(/\/lab-api\/table\//, line(net));
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { name, context, page, errors, net };
}

// The player whose turn it is taps one legal point with a touch; a random pick that avoids an own goal when it can.
let touches = 0, clicks = 0;
async function oneMove(pages, rng) {
  const who = await Promise.race(pages.map((p, i) => p.page.waitForFunction(() => __pitch.canTap || __pitch.screen === 'end', null, { timeout: 30000, polling: 50 }).then(() => i)));
  const { page } = pages[who];
  if (await P(page, () => __pitch.screen === 'end')) return null;
  const before = await P(page, () => __pitch.room.moves), legal = await P(page, () => __pitch.legal);
  const { h } = await P(page, () => __pitch.size), mine = await P(page, () => __pitch.room.seat);
  const own = m => m.y === (mine === 0 ? h + 1 : -1); // blue attacks the top goal (y = -1), red the bottom
  const pool = legal.filter(m => !own(m)), pick = (pool.length ? pool : legal)[Math.floor(rng() * (pool.length || legal.length))];
  await page.touchscreen.tap(pick.sx, pick.sy);
  try { await page.waitForFunction(n => __pitch.room.moves > n || __pitch.room.waiting, before, { timeout: 3000 }); touches++; }
  catch { await page.mouse.click(pick.sx, pick.sy); clicks++; }
  return before + 1;
}
async function sameSheet(pages, moves) {
  moves ??= await P(pages[0].page, () => __pitch.room.moves);
  await Promise.all(pages.map(p => until(p.page, n => __pitch.room?.moves === n && !__pitch.room.waiting, `${p.name} at move ${moves}`, 15000, moves)));
  const [a, b] = await Promise.all(pages.map(p => P(p.page, () => ({ sheet: __pitch.state(), score: __pitch.score, game: __pitch.room.game }))));
  assert.deepEqual(b, a, `both phones show the same sheet after ${moves} moves`);
  return moves;
}

let failed = 0;
async function run(hostEngine, guestEngine) {
  const tag = `${hostEngine}-hosts`;
  const [hb, gb] = await Promise.all([PHONES[hostEngine][0].launch(), PHONES[guestEngine][0].launch()]);
  const netA = { latency: 40, jitter: 30, cut: false, sockets: new Set() }, netB = { latency: 40, jitter: 30, cut: false, sockets: new Set() };
  const A = await phone(hb, 'host', PHONES[hostEngine][1], netA), B = await phone(gb, 'guest', PHONES[guestEngine][1], netB), pages = [A, B];
  let seed = hostEngine === 'webkit' ? 11 : 12;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  try {
    // The host has played before (an old save, no pitch:more); the guest has never opened the page.
    await A.page.goto(`${base}/small/pitch/?lang=en`);
    await P(A.page, () => localStorage.setItem('pitch:v1', JSON.stringify({ played: 3, level: 2, lossStreak: 1, wins: 2, sound: false, daily: {} })));
    await A.page.reload();
    await until(A.page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'host menu');
    await A.page.click('#friend');
    await A.page.fill('#friendName', 'Ada');
    await A.page.click('#newTable');
    await until(A.page, () => __pitch.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent.includes('Waiting for your friend'), 'host waits at the table');
    await A.page.click('#shareLink');
    await until(A.page, () => !!window.__sharedLink, 'the link is shared');
    const link = await P(A.page, () => window.__sharedLink.url), code = await P(A.page, () => __pitch.room.code);
    assert.equal(new URL(link).searchParams.get('room'), code, 'the shared link carries the code');
    await shot(A.page, `${tag}-host-waiting`);

    // The friend opens the link in Turkish and both are seated.
    await B.page.goto(link.replace(/^https?:\/\/[^/]+/, base) + '&lang=tr');
    await Promise.all(pages.map((p, seat) => until(p.page, seat => __pitch.room?.seat === seat && __pitch.room.status === 'live' && document.querySelectorAll('#score .seat-light.on').length === 2, `${p.name} seated`, 25000, seat)));
    assert.match(await B.page.textContent('#turnText'), /^Sıra/, 'the guest plays in Turkish');
    await shot(B.page, `${tag}-guest-start`);

    // Touch play on both phones; the sheets agree after every move. Mid-match the guest's line drops for two seconds.
    let moves = 0, cutDone = false;
    for (let i = 0; i < 400; i++) {
      const n = await oneMove(pages, rng);
      if (n === null) break;
      moves = await sameSheet(pages, n);
      if (!cutDone && moves >= 12) {
        cutDone = true;
        await cutLine(netB);
        await until(A.page, () => document.querySelector('#roomStatus').textContent.includes('dropped'), 'the host is told the friend dropped', 15000);
        await until(B.page, () => document.querySelector('#roomStatus').textContent === 'Yeniden bağlanıyor', 'the guest says it is reconnecting', 15000);
        await shot(A.page, `${tag}-host-friend-dropped`);
        await new Promise(r => setTimeout(r, 2000));
        netB.cut = false;
        await Promise.all(pages.map(p => until(p.page, () => __pitch.room.status === 'live' && document.querySelectorAll('#score .seat-light.on').length === 2, `${p.name} back together`, 25000)));
        moves = await sameSheet(pages);
      }
      if (await P(A.page, () => __pitch.screen === 'end')) break;
    }
    assert.ok(cutDone, 'the cut happened mid-match');
    await Promise.all(pages.map(p => until(p.page, () => __pitch.screen === 'end', `${p.name} end card`, 30000)));
    const [ea, eb] = await Promise.all(pages.map(p => P(p.page, () => ({ score: __pitch.score, title: document.querySelector('#endTitle').textContent }))));
    assert.deepEqual(eb.score, ea.score, 'both phones end with the same score');
    assert.equal(Math.max(...ea.score), 2, 'the table match is best of three goals');
    console.log(`     ${tag}: ${moves} segments in the match, score ${ea.score.join('-')}; host "${ea.title}", guest "${eb.title}"`);
    await Promise.all(pages.map(p => until(p.page, () => document.querySelector('#pic').naturalWidth > 0, `${p.name} picture`)));
    await shot(A.page, `${tag}-host-end`); await shot(B.page, `${tag}-guest-end`);
    const hostSave = await P(A.page, () => __pitch.save());
    assert.equal(hostSave.level, 2, 'a table match leaves the bot level of an old save alone');

    // Rematch: one vote waits, both votes start game 1 on both phones with the same seed.
    await B.page.click('#again');
    await until(A.page, () => /again|tekrar|rematch/i.test(document.querySelector('#endLine').textContent), 'the host sees the friend wants a rematch');
    await A.page.click('#again');
    await Promise.all(pages.map(p => until(p.page, () => __pitch.room?.game === 1 && __pitch.screen === 'play', `${p.name} in the rematch`)));
    assert.equal(await P(A.page, () => __pitch.room.seed), await P(B.page, () => __pitch.room.seed), 'the rematch has one seed');
    for (let i = 0; i < 4; i++) await sameSheet(pages, await oneMove(pages, rng));
    for (const p of pages) assert.deepEqual(p.errors, [], `${tag}: ${p.name} raised no page, console or network errors`);
    console.log(`ok   pitch by link, ${hostEngine} hosts and ${guestEngine} joins: seated, cut and back, match to the end, rematch`);
  } catch (e) {
    failed++; console.error(`FAIL pitch by link, ${tag}: ${e.stack}`);
    for (const p of pages) if (p.errors.length) console.error(`${p.name} errors: ${p.errors.join('\n')}`);
    await shot(A.page, `${tag}-failure-host`).catch(() => {}); await shot(B.page, `${tag}-failure-guest`).catch(() => {});
  } finally { await Promise.all([hb.close(), gb.close()]); }
}

try {
  const only = process.argv[2];
  for (const [h, g] of [['webkit', 'chromium'], ['chromium', 'webkit']]) if (!only || only === h) await run(h, g);
} finally { await new Promise(done => server.close(done)); }
console.log(`taps: ${touches} by touch, ${clicks} by mouse after a touch gave no move; screenshots in ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
