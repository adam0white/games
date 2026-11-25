// Two phones playing each other by link: PLAYWRIGHT=<dir with playwright> node experiments/duel/link-check.mjs [webkit|chromium]
// Two pages in one run, one iPhone 13 (WebKit) and one Pixel 7 (Chromium), so the pair is also two different JavaScript
// engines; each run swaps which one makes the code. Their sockets go to the real relay room (workers/lab-ai Room class
// and handleRoom, with stand-ins for the platform) through Playwright's WebSocket routing, with a delay each way.
// Covers: the code and the link, the match on both phones to the same result tick for tick, a cut and reconnect mid-duel
// (the waiting banner), a rematch, one side leaving mid-duel (the other is offered the bot), a phone that just vanishes,
// and the relay not deployed (a 404: "could not reach your friend", then the bot). Screenshots go to $SHOTS.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SHOTS = process.env.SHOTS || '/tmp/claude-duel-friend-link/link-shots';
await mkdir(SHOTS, { recursive: true });

// ---------------------------------------------------------------- the real relay room, off the platform (as in workers/lab-ai/test)
let source = await readFile(resolve(root, '../workers/lab-ai/src/index.mjs'), 'utf8');
source = source.replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }')
  .replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${new URL(p, 'file://' + resolve(root, '../workers/lab-ai/src') + '/').href}'`);
const { Room, handleRoom } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
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
const rooms = new Map();
const ctxFor = () => ({ sockets: [], getWebSockets() { return this.sockets.filter(s => s.readyState === 1); }, acceptWebSocket(ws) { this.sockets.push(ws); }, storage: { setAlarm: async () => {} } });
const env = { PER_IP: { limit: async () => ({ success: true }) }, ROOM: { idFromName: n => n, get: n => { if (!rooms.has(n)) rooms.set(n, new Room(ctxFor(), {})); return rooms.get(n); } } };

// One page's line to the room: `latency` ms each way plus up to `jitter`, in order (a socket keeps order).
function line(net) {
  return async ws => {
    const path = new URL(ws.url()).pathname + new URL(ws.url()).search, held = [];
    let server = null, room = null, lastIn = 0, lastOut = 0, open = true;
    const later = (dir, fn) => { const t = Date.now(), at = Math.max(dir === 'in' ? lastIn : lastOut, t + net.latency + Math.random() * net.jitter); if (dir === 'in') lastIn = at; else lastOut = at; setTimeout(fn, at - t); };
    ws.onMessage(text => { if (!net.cut) (server ? later('in', () => server.readyState === 1 && room.webSocketMessage(server, text)) : held.push(text)); });
    // A close arrives after the frames sent before it, as on a real socket.
    ws.onClose(() => { open = false; if (server) later('in', () => { if (server.readyState === 1) { server.readyState = 3; room.webSocketClose(server, 1000, ''); } }); });
    net.sockets.add(ws);
    while (net.cut) await new Promise(r => setTimeout(r, 50)); // the line is down: the socket hangs until it is back
    const res = await handleRoom(new Request(`https://play.adamwhite.work${path}`, { headers: { Origin: 'https://play.adamwhite.work', Upgrade: 'websocket', 'CF-Connecting-IP': '203.0.113.9' } }), env);
    if (res.status !== 101) { ws.close({ code: 1011 }); return; }
    server = res.webSocket.server; room = rooms.get(new URL(ws.url()).pathname.split('/').slice(-2).join('/'));
    server.attach({ message: q => later('out', () => open && !net.cut && ws.send(q)), close: code => later('out', () => { open = false; ws.close({ code }).catch(() => {}); }) });
    for (const text of held.splice(0)) room.webSocketMessage(server, text);
  };
}
// Drops every socket on this line (as a phone that loses its network) and keeps new ones hanging until `up()`.
async function cutLine(net) {
  net.cut = true;
  for (const ws of net.sockets) await ws.close({ code: 1011 }).catch(() => {});
  net.sockets.clear();
}

// ---------------------------------------------------------------- pages
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
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
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.duelState());
async function until(page, fn, what, ms = 20000, arg) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); }
  catch { throw new Error(`timed out waiting for: ${what}; state=${JSON.stringify(await page.evaluate(() => { const s = window.duelState(); return { screen: s.screen, link: s.link, phase: s.phase, score: s.score }; }).catch(() => null))}`); }
}
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`), scale: 'css', timeout: 90000 });

async function phone(browser, name, device, net, { route = true, expectedErrors = null } = {}) {
  const context = await browser.newContext({ ...device }), page = await context.newPage(), errors = [];
  await context.addInitScript(() => { window.__shared = []; Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__shared.push(d.url); } }); });
  if (route) await context.routeWebSocket(/\/lab-api\/room\//, line(net));
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !(expectedErrors && expectedErrors.test(m.text()))) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !(expectedErrors && expectedErrors.test(r.url()))) errors.push(`${r.status()} ${r.url()}`); });
  return { name, context, page, errors, net };
}
// A thumb that taps the bottom of the glass (its own half on either phone) every `ms`, inside the page so the
// test runner's own timing cannot bunch the taps.
const thumb = (page, ms) => page.evaluate(ms => {
  clearInterval(window.__thumb);
  const c = document.getElementById('c'); let id = 500;
  window.__thumb = setInterval(() => {
    const x = innerWidth * (0.3 + Math.random() * 0.4), y = innerHeight * (0.7 + Math.random() * 0.15), pointerId = ++id;
    c.dispatchEvent(new PointerEvent('pointerdown', { pointerId, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    setTimeout(() => c.dispatchEvent(new PointerEvent('pointerup', { pointerId, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true })), 30);
  }, ms);
}, ms);
const stopThumb = page => page.evaluate(() => clearInterval(window.__thumb));
const summary = s => ({ score: s.score, winner: s.winner, duels: s.duels.map(d => [d.kind, d.winner, Math.round(d.t * 1000)]), tick: s.link?.tick, hash: s.link?.hash, id: s.link?.id });

let failed = 0;
async function run(hostEngine, guestEngine) {
  const tag = `${hostEngine}-hosts`;
  const [hb, gb] = await Promise.all([PHONES[hostEngine][0].launch(), PHONES[guestEngine][0].launch()]);
  const netA = { latency: 40, jitter: 30, cut: false, sockets: new Set() }, netB = { latency: 40, jitter: 30, cut: false, sockets: new Set() };
  const A = await phone(hb, 'host', PHONES[hostEngine][1], netA), B = await phone(gb, 'guest', PHONES[guestEngine][1], netB);
  try {
    // The host makes a code and sends the link.
    await A.page.goto(`${base}/duel/?fast=1&only=tug&seed=11&lang=en`);
    await until(A.page, () => window.duelState?.().screen === 'menu', 'host menu');
    await B.page.addInitScript(() => localStorage.setItem('duel-save', JSON.stringify({ v: 1, sound: true, matches: 4, friend: { side: 1, run: 2, best: 3 }, solo: { easy: { won: 2, run: 1, best: 2 }, medium: { won: 0, run: 0, best: 0 }, hard: { won: 0, run: 0, best: 0 } } })));
    assert.equal(await A.page.locator('#toFriend').textContent(), 'Play a friend');
    await A.page.click('#toFriend');
    await until(A.page, () => window.duelState().link?.state === 'alone', 'host room open, nobody there yet');
    const code = (await state(A.page)).link.code;
    assert.match(code, /^[A-Z]{4}$/); assert.equal(await A.page.locator('#fCode').textContent(), code);
    assert.equal(await A.page.locator('#fStatus').textContent(), 'Waiting for your friend…');
    await A.page.click('#fShare');
    const shared = await A.page.evaluate(() => window.__shared[0]);
    assert.equal(new URL(shared).searchParams.get('room'), code, 'the shared link carries the code');
    await shot(A.page, `${tag}-host-code`);

    // The friend opens the link (in Turkish) and the duel starts on both.
    await B.page.goto(shared.replace(/^https?:\/\/[^/]+/, base) + '&lang=tr');
    await Promise.all([A, B].map(p => until(p.page, () => window.duelState().screen === 'play' && window.duelState().link?.state === 'match', `${p.name} in the match`)));
    const [a0, b0] = await Promise.all([state(A.page), state(B.page)]);
    assert.equal(a0.link.me, 0); assert.equal(b0.link.me, 1); assert.equal(a0.flip, false); assert.equal(b0.flip, true, 'the guest sees its own side at the bottom');
    assert.equal(a0.link.delay, b0.link.delay); assert.ok(a0.link.delay >= 6 && a0.link.delay <= 15, `delay ${a0.link.delay}`);
    console.log(`     ${tag}: code ${code}, measured round trip ${Math.round(a0.link.rtt)} ms, input delay ${a0.link.delay} ticks (${Math.round(a0.link.delay * 1000 / 60)} ms)`);
    await sleep(700); await shot(B.page, `${tag}-guest-countdown`);

    // Thumbs on both phones: a tap on the guest's own bottom half is the TOP side of the shared board.
    await until(A.page, () => window.duelState().phase === 'play', 'the duel is on', 15000);
    await Promise.all([thumb(A.page, 110), thumb(B.page, 170)]);
    await until(A.page, () => window.duelState().d?.p !== undefined && window.duelState().d.p !== 0, 'the rope moves', 8000);
    await shot(B.page, `${tag}-guest-play`);

    // The guest's line goes down for 2.5 s mid-duel: the host stalls and says so, then both carry on.
    await cutLine(netB);
    await until(A.page, () => window.duelState().link.wait === true, 'the host shows the waiting banner', 8000);
    assert.equal(await A.page.locator('#waitLine').textContent(), 'Waiting for your friend…');
    await shot(A.page, `${tag}-host-waiting`);
    const stalled = await state(A.page); await sleep(1000);
    assert.equal((await state(A.page)).link.tick, stalled.link.tick, 'no tick is stepped without the friend\'s input');
    netB.cut = false;
    await until(B.page, () => ['match'].includes(window.duelState().link?.state), 'the guest is back in the room', 15000);
    await until(A.page, (t) => window.duelState().link.tick > t + 60 && !window.duelState().link.wait, 'the duel goes on after the reconnect', 15000, stalled.link.tick);

    // To the end of the match: both phones agree on every duel, the score, the winner and the last tick's state.
    await Promise.all([A, B].map(p => until(p.page, () => window.duelState().screen === 'end', `${p.name} end card`, 90000)));
    await Promise.all([stopThumb(A.page), stopThumb(B.page)]);
    await sleep(600);
    const [a1, b1] = await Promise.all([state(A.page), state(B.page)]);
    assert.deepEqual(summary(b1), summary(a1), 'both phones end the match identically');
    assert.equal(a1.link.mismatch, null); assert.equal(b1.link.mismatch, null);
    assert.ok(a1.winner === 0 || a1.winner === 1 || a1.winner === -1);
    const word = (p, w) => w < 0 ? 'Draw!' : w === p ? 'You win!' : 'So close!';
    assert.equal(await A.page.locator('#endT0').textContent(), word(0, a1.winner)); assert.equal(await B.page.locator('#endT0').textContent(), word(1, a1.winner));
    console.log(`     ${tag}: match 1 ${a1.score.join('-')} after ${a1.link.tick} ticks, identical on both; host stalls ${a1.link.stalls}`);
    await shot(B.page, `${tag}-guest-end`);
    assert.deepEqual(b1.save.friend, { side: 1, run: 2, best: 3 }, 'the one-phone streak is not touched by a link match');
    assert.equal(b1.save.matches, 5, 'the match is counted');

    // Rematch: the guest says ready, the host sees it, and match 2 starts on both.
    await B.page.click('#re0');
    await until(A.page, () => document.getElementById('endL0').textContent === 'Your friend is ready', 'the host sees the friend is ready');
    await A.page.click('#re0');
    await Promise.all([A, B].map(p => until(p.page, () => window.duelState().link?.id === 2 && window.duelState().screen === 'play', `${p.name} in match 2`)));
    await Promise.all([thumb(A.page, 140), thumb(B.page, 140)]);
    await until(A.page, () => window.duelState().phase === 'play', 'match 2 duel is on', 15000); await sleep(800);

    // The host leaves mid-duel through the pause card: the guest is told and offered the bot.
    await A.page.click('#pause');
    assert.equal(await A.page.locator('#linkPauseLine').isVisible(), true);
    await shot(A.page, `${tag}-host-pause`);
    await A.page.click('#quit');
    await until(B.page, () => window.duelState().screen === 'gone', 'the guest is told the friend left', 10000);
    assert.equal(await B.page.locator('#goneLine').textContent(), 'Arkadaşın ayrıldı.');
    await shot(B.page, `${tag}-guest-friend-left`);
    await B.page.click('#goneBot');
    await until(B.page, () => window.duelState().screen === 'solo', 'the guest is on the bot card');
    const b2 = await state(B.page);
    assert.equal(b2.flip, false); assert.equal(b2.link, null);
    assert.deepEqual(b2.save.solo.easy, { won: 2, run: 1, best: 2 });
    await B.page.click('[data-level="easy"]');
    await until(B.page, () => window.duelState().screen === 'play' && window.duelState().solo === 'easy', 'a bot match starts');
    await stopThumb(A.page); await stopThumb(B.page);

    // A phone that vanishes (closed, no goodbye): the other one waits, then offers the bot.
    await B.page.goto(`${base}/duel/?fast=1&only=tug&seed=5&lang=en`);
    await until(B.page, () => window.duelState?.().screen === 'menu', 'guest menu');
    await B.page.click('#toFriend');
    await until(B.page, () => window.duelState().link?.state === 'alone', 'second room open');
    const code2 = (await state(B.page)).link.code;
    await A.page.goto(`${base}/duel/?room=${code2}&lang=en`);
    await Promise.all([A, B].map(p => until(p.page, () => window.duelState().link?.state === 'match', `${p.name} in the second room's match`)));
    await A.context.close(); A.closed = true;
    await until(B.page, () => window.duelState().link?.wait === true, 'the host waits for the vanished friend', 8000);
    await until(B.page, () => !document.getElementById('waitButtons').hidden, 'after 10 s the bot and the menu are offered', 15000);
    await shot(B.page, `${tag}-host-friend-vanished`);
    await until(B.page, () => window.duelState().screen === 'gone', 'after 20 s the friend is gone', 20000);
    assert.equal(await B.page.locator('#goneLine').textContent(), 'Your friend left.');
  } finally {
    for (const p of [A, B]) if (p.errors.length) { failed++; console.log(`FAIL page errors on ${p.name}: ${p.errors.join(' | ')}`); }
    if (!A.closed) await A.context.close().catch(() => {});
    await B.context.close().catch(() => {});
    await Promise.all([hb.close(), gb.close()]);
  }
}

// The relay is not deployed yet: the room's address answers 404. The page says it could not reach the friend and offers the bot.
async function notDeployed(engine) {
  const browser = await PHONES[engine][0].launch();
  const P = await phone(browser, 'alone', PHONES[engine][1], null, { route: false, expectedErrors: /lab-api\/room|WebSocket/ });
  try {
    await P.page.goto(`${base}/duel/?room=QWER&lang=en`);
    await until(P.page, () => window.duelState?.().link?.state === 'failed', 'the room cannot be reached', 15000);
    assert.equal(await P.page.locator('#fStatus').textContent(), 'Could not reach your friend.');
    assert.equal(await P.page.locator('#fFallback').isVisible(), true);
    await shot(P.page, `${engine}-not-deployed`);
    await P.page.click('#fBot');
    await until(P.page, () => window.duelState().screen === 'solo', 'the bot is offered');
    await P.page.goto(`${base}/duel/?lang=tr`); await P.page.click('#toFriend');
    await until(P.page, () => window.duelState().link?.state === 'failed', 'a new code cannot open a room either', 15000);
    assert.equal(await P.page.locator('#fStatus').textContent(), 'Arkadaşına ulaşılamadı.');
    await shot(P.page, `${engine}-not-deployed-host-tr`);
    if (P.errors.length) throw new Error(P.errors.join(' | '));
  } finally { await browser.close(); }
}

const only = process.argv[2];
for (const [name, fn] of [
  ['webkit hosts, chromium joins', () => run('webkit', 'chromium')],
  ['chromium hosts, webkit joins', () => run('chromium', 'webkit')],
  ['not deployed on webkit', () => notDeployed('webkit')],
  ['not deployed on chromium', () => notDeployed('chromium')],
]) {
  if (only && !name.startsWith(only)) continue;
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); if (process.env.CHECK_STACK) console.log(e.stack); }
}
server.close();
process.exit(failed ? 1 : 0);
