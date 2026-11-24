// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node check.mjs [webkit|chromium]
// Serves experiments/ (so ../../kit/ resolves), plays with real taps, and mirrors each hand in Node
// with the same rules and bot to check the page's final score.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { deal, play, score, view, rank, isJack, capturesWith, dailySeed } from './sim.js';
import { choose } from './brain.js';
import { tables } from './words.js';
import { TABLE, tableName, tableMessage, freshTable, sit, move, again, shown } from '../../../workers/lab-ai/src/table.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/claude-504/-Users-abdul-code/e727a231-6be3-4081-a695-31f6b5ca1a96/scratchpad/pisti-shots';
const TABLE_SHOTS = join(dirname(SHOTS), 'pisti-table-shots');
const LANG_SHOTS = process.env.LANG_SHOTS || join(dirname(SHOTS), 'i18n-shots', 'pisti');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    assert.ok(file.startsWith(root + sep));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((done, fail) => {
  server.once('error', fail);
  server.listen(0, '127.0.0.1', done);
}).catch(error => {
  console.error(`Pişti phone check could not start: ${error.message}`);
  process.exit(1);
});
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url);
const { webkit, chromium, devices } = require(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'playwright') : 'playwright');
await Promise.all([mkdir(SHOTS, { recursive: true }), mkdir(TABLE_SHOTS, { recursive: true }), mkdir(LANG_SHOTS, { recursive: true })]);
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const DATE = '2026-11-24';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const P = page => page.evaluate(() => {
  const p = window.__pisti;
  return { room: p.room, pile: p.pile, totals: p.totals, handNo: p.handNo, dealer: p.dealer, matchOver: p.matchOver, screen: p.screen, mode: p.mode, hand: p.hand, pileTop: p.pileTop, pileSize: p.pileSize, scores: p.scores, turn: p.turn, viewer: p.viewer, canPlay: p.canPlay, practice: p.practice, level: p.level, done: p.done, scored: p.scored, ply: p.ply, paused: p.paused, save: p.save, seed: p.seed };
});
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });
async function until(page, fn, label, timeout = 15000, arg = null) {
  try { await page.waitForFunction(fn, arg, { timeout }); }
  catch { throw new Error(`timed out: ${label}; state=${JSON.stringify(await P(page).catch(() => null))}`); }
}

// The scripted player: a pişti if there is one, else any capture by match, else a jack capture, else the first card.
function pick(hand, pileTop, pileSize) {
  if (pileSize === 1) { const p = hand.find(c => !isJack(c) && rank(c) === rank(pileTop)); if (p !== undefined) return p; }
  if (pileSize) {
    const m = hand.find(c => !isJack(c) && rank(c) === rank(pileTop)); if (m !== undefined) return m;
    const j = hand.find(isJack); if (j !== undefined && pileSize >= 3) return j;
  }
  return hand[0];
}
const pickState = s => pick(s.hands[s.turn], s.pile[s.pile.length - 1], s.pile.length);
function mirror(seed, level, dealer = 1) {
  let s = deal(seed, dealer);
  while (!s.done) s = play(s, s.turn === 0 ? pickState(s) : choose(view(s, 1), level));
  return s;
}
// A seed where the scripted player makes a pişti against the easy bot, so the moment can be photographed.
function pistiSeed() {
  for (let seed = 1; ; seed++) {
    const s = mirror(seed, 'easy');
    if (s.log.some(e => e.seat === 0 && e.kind === 'pisti' && e.ply < 40)) return seed;
  }
}

async function open(browser, device) {
  const context = await browser.newContext({ ...device, acceptDownloads: true }), page = await context.newPage();
  const errors = [], external = [];
  await context.route('**/*', route => { const u = route.request().url(); if (!u.startsWith(base)) { external.push(u); return route.abort(); } return route.continue(); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors, external };
}
const noOverflow = page => page.evaluate(() => {
  const screen = document.querySelector('.screen.on');
  return document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1
    && (!screen || screen.scrollWidth <= screen.clientWidth);
});

// The actual table state and frame parsers run in Node. Only the socket transport and storage are in memory.
function tableWire() {
  const rooms = new Map();
  let nextId = 0, nextSeed = 24;
  const live = room => [...room.sockets.values()].filter(s => s.seat !== null);
  const seats = room => shown(room.state, live(room).map(s => s.seat));
  const deliver = (socket, event, data) => socket.page.evaluate(({ id, event, data }) => window.__pistiWireReceive?.(id, event, data), { id: socket.id, event, data });
  const send = (socket, frame) => deliver(socket, 'message', JSON.stringify(frame));
  const broadcast = (room, frame) => Promise.all(live(room).map(socket => send(socket, frame)));
  const announce = room => broadcast(room, { t: 'seats', seats: seats(room) });
  function you(socket) {
    const { room, seat } = socket, { v, game, seed, log, again } = room.state;
    return send(socket, { t: 'you', seat, v, game, seed, log, again, seats: seats(room) });
  }
  async function close(socket, code, notify) {
    const { room, id, seat } = socket;
    if (!room.sockets.delete(id)) return;
    if (notify) await deliver(socket, 'close', code);
    if (seat !== null) await announce(room);
  }
  async function acceptMove(room, seat, frame) {
    const result = move(room.state, seat, frame, Date.now());
    if (result === 'ok') await broadcast(room, { t: 'm', i: frame.i, s: seat, m: frame.m });
    return result;
  }
  return {
    async attach(page) {
      let socket = null, reconnectGate = null, openGate = null, sendGate = null, sawSend = null;
      await page.exposeFunction('__pistiWireOpen', async addr => {
        const url = new URL(addr);
        assert.equal(url.origin, base.replace(/^http/, 'ws'), 'table socket is same-origin');
        const named = tableName(url.pathname);
        assert.equal(named?.game, 'pisti');
        if (reconnectGate) await reconnectGate;
        if (!rooms.has(named.name)) rooms.set(named.name, { state: freshTable(TABLE.games[named.game].seats, nextSeed++, Date.now()), sockets: new Map() });
        const room = rooms.get(named.name), id = ++nextId;
        socket = { page, id, room, seat: null };
        room.sockets.set(id, socket);
        return id;
      });
      await page.exposeFunction('__pistiWireSend', async (id, text) => {
        if (!socket || id !== socket.id || !socket.room.sockets.has(id)) return;
        const current = socket, { room } = current, frame = tableMessage(text);
        assert.ok(frame, `invalid client frame ${text.replace(/"k":"[^"]+"/, '"k":"…"')}`);
        if (frame.t === 'hi') {
          const result = sit(room.state, frame, live(room).map(s => s.seat), nextSeed, Date.now());
          if (result.refuse) { await close(current, result.refuse === 'full' ? 4001 : 4002, true); return; }
          const other = live(room).find(s => s !== current && s.seat === result.seat);
          current.seat = result.seat;
          if (other) await close(other, 4003, true);
          await you(current);
          await announce(room);
        } else if (frame.t === 'm') {
          if (sendGate) { sawSend(); await sendGate; }
          const result = await acceptMove(room, current.seat, frame);
          if (result === 'stale' || result === 'long') await you(current);
        } else if (frame.t === 'again') {
          const started = again(room.state, current.seat, nextSeed, Date.now());
          if (started) nextSeed++;
          await broadcast(room, started ? { t: 'game', game: room.state.game, seed: room.state.seed } : { t: 'again', s: current.seat });
        }
      });
      await page.exposeFunction('__pistiWireClose', id => socket?.id === id ? close(socket, 1000, false) : undefined);
      await page.addInitScript(() => {
        const sockets = new Map();
        window.__pistiWireReceive = (id, event, data) => {
          const socket = sockets.get(id);
          if (!socket) return;
          if (event === 'message') socket.onmessage?.({ data });
          else {
            sockets.delete(id);
            socket.readyState = 3;
            socket.onclose?.({ code: data });
          }
        };
        window.__pistiSocket = class {
          constructor(addr) {
            this.readyState = 0;
            window.__pistiWireOpen(addr).then(id => {
              if (this.readyState === 3) return window.__pistiWireClose(id);
              this.id = id;
              this.readyState = 1;
              sockets.set(id, this);
              this.onopen?.();
            });
          }
          send(text) { void window.__pistiWireSend(this.id, text); }
          close() {
            if (this.readyState === 3) return;
            this.readyState = 3;
            sockets.delete(this.id);
            if (this.id !== undefined) void window.__pistiWireClose(this.id);
          }
        };
      });
      return {
        async cut() {
          reconnectGate = new Promise(resolve => { openGate = resolve; });
          await close(socket, 1006, true);
        },
        reconnect() { reconnectGate = null; openGate(); },
        navigateAway: () => close(socket, 1000, false),
        holdMove() {
          let release;
          const sent = new Promise(resolve => { sawSend = resolve; });
          sendGate = new Promise(resolve => { release = resolve; });
          return { sent, release() { sendGate = null; release(); } };
        },
        async inject(seat, cards) {
          const { room } = socket, i = room.state.log.length;
          const frame = tableMessage(JSON.stringify({ t: 'm', i, m: cards }));
          assert.ok(frame, 'the illegal game move is valid wire data');
          assert.equal(await acceptMove(room, seat, frame), 'ok', 'server broadcasts it');
        },
      };
    },
  };
}

async function playFriend(browser, device, phone) {
  const wire = tableWire();
  const tests = [];
  const url = `${base}/lab/pisti/?lang=en&speed=20&date=${DATE}`;
  const oldSave = { v: 1, level: 2, losses: 1, hands: 2, len: '51', four: false, sound: false, daily: { [DATE]: { started: true } } };
  async function friendPage() {
    const test = await open(browser, device);
    tests.push(test);
    await test.context.addInitScript(save => {
      if (!localStorage.getItem('pisti:v1')) localStorage.setItem('pisti:v1', JSON.stringify(save));
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.sharedLink = data; } });
    }, oldSave);
    return { page: test.page, socket: await wire.attach(test.page) };
  }
  const friendShot = (page, name) => page.screenshot({ path: join(TABLE_SHOTS, `${phone}-${name}.png`), timeout: 25000 });
  const seatsReady = (page, seat) => until(page, seat => __pisti.room?.seat === seat && __pisti.screen === 'play'
    && document.querySelectorAll('#table .seat-light.on').length === 2, 'both seats connected', 25000, seat);
  const tap = (page, selector) => page.locator(selector).tap({ timeout: 25000 });
  try {
    const { page: a, socket: aSocket } = await friendPage();
    const { page: b, socket: bSocket } = await friendPage();
    const pages = [a, b], sockets = [aSocket, bSocket], names = ['WWWWWWWWWWWWWWWW', 'Ben'];
    for (const [seat, page] of pages.entries()) {
      await page.goto(url);
      await tap(page, '#friend');
      assert.equal(await page.locator('#friendName').inputValue(), '', 'an old save has no name');
      await page.locator('#friendName').fill(names[seat]);
    }
    await friendShot(a, 'entry');
    await tap(a, '#newTable');
    await until(a, () => __pisti.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent === 'Waiting for your friend', 'creator waits for friend');
    const code = await a.locator('#roomCode').textContent();
    assert.match(code, /^[A-Z]{4}$/);
    await friendShot(a, 'invite');
    await aSocket.navigateAway();
    await a.reload();
    await until(a, () => __pisti.room?.seat === 0 && !document.querySelector('#roomInvite').hidden, 'creator can share after reloading');
    await tap(a, '#shareLink');
    const link = await a.evaluate(() => window.sharedLink);
    assert.deepEqual(link, { text: 'Play Pişti with me', url: `${base}/lab/pisti/?room=${code}` });
    await b.goto(link.url);
    await Promise.all(pages.map(seatsReady));
    const initial = (await P(a)).room;
    let model = deal(initial.seed, initial.seed % 2), frames = 0;
    const moves = [];

    async function agree(active = pages) {
      for (const page of active) {
        await until(page, frame => __pisti.room?.moves === frame, `wire frame ${frames}`, 25000, frames);
        const actual = await P(page), seat = pages.indexOf(page);
        assert.equal(actual.seed, model.seed);
        assert.equal(actual.ply, model.ply);
        assert.equal(actual.turn, model.turn);
        assert.equal(actual.viewer, seat);
        assert.equal(actual.dealer, model.dealer);
        assert.equal(actual.pileSize, model.pile.length);
        assert.deepEqual(actual.pile, model.pile.slice(model.hidden));
        assert.deepEqual(actual.scores, score(model).map(row => row.total));
        assert.deepEqual(actual.hand, model.hands[seat]);
        const mine = await page.locator('#hand [data-card]').evaluateAll(cards => cards.map(card => Number(card.dataset.card)));
        assert.deepEqual(mine, model.hands[seat], 'own cards are face up at the bottom');
        const top = page.locator('#oppHand');
        assert.equal(await top.locator('.card').count(), model.hands[1 - seat].length);
        assert.equal(await top.locator('.card:not(.back), [data-card], button, .r, .s, .b').count(), 0, 'other cards have no faces in the DOM');
      }
    }

    async function turn(active = pages, hold = false) {
      const seat = model.turn, card = pickState(model), page = pages[seat];
      await until(page, () => __pisti.canPlay, 'active seat can tap', 25000);
      const held = hold ? sockets[seat].holdMove() : null;
      try {
        await tap(page, `#hand [data-card="${card}"]`);
        if (held) {
          await until(page, () => __pisti.room.waiting, 'waiting for move echo');
          await held.sent;
          assert.equal((await P(page)).canPlay, false);
          await agree(active);
          assert.equal(await page.locator('#hand [data-card]').count(), model.hands[seat].length);
          await until(page, () => document.querySelector('#roomStatus').textContent === 'Sending move…', 'slow move status');
        }
      } finally { held?.release(); }
      moves.push([seat, card]);
      model = play(model, card);
      frames++;
      await agree(active);
    }

    await agree();
    for (const [seat, page] of pages.entries()) {
      assert.equal(await page.locator('#myPlayer .seat-name').textContent(), names[seat]);
      assert.equal(await page.locator('#oppPlayer .seat-name').textContent(), names[1 - seat]);
      assert.equal(await page.locator('#hand .card').count(), 4);
    }
    await friendShot(a, 'play');
    await turn(pages, true);

    const invalid = model.hands[1 - model.turn][0];
    await aSocket.inject(model.turn, [invalid]);
    frames++;
    await agree();
    while (model.ply < 9 || model.turn !== 0) await turn();

    await bSocket.navigateAway();
    await b.reload();
    await seatsReady(b, 1);
    await agree();

    await bSocket.cut();
    await until(a, () => document.querySelector('#roomStatus').textContent === 'Ben dropped. Waiting for them to come back.', 'friend disconnected');
    assert.equal(await a.locator('#oppPlayer .seat-light.on').count(), 0);
    await until(b, () => __pisti.room.status === 'waiting' && document.querySelector('#roomStatus').textContent === 'Reconnecting', 'dropped phone retries');
    await friendShot(a, 'dropped');
    await turn([a]);
    bSocket.reconnect();
    await seatsReady(b, 1);
    await agree();

    const { page: c } = await friendPage();
    await c.goto(link.url);
    await until(c, () => __pisti.room?.status === 'full' && document.querySelector('#lobbyStatus').textContent === 'This table is full', 'third phone refused');
    assert.ok(await c.locator('#lobbyStatus').isVisible());

    while (!model.done) await turn();
    let replay = deal(initial.seed, initial.seed % 2);
    for (const [seat, card] of moves) {
      assert.equal(replay.turn, seat);
      replay = play(replay, card);
    }
    assert.equal(moves.length, 48);
    const finalScores = score(replay).map(row => row.total);
    await a.setViewportSize({ width: 360, height: 640 });
    for (const [seat, page] of pages.entries()) {
      await until(page, () => __pisti.screen === 'score' && __pisti.scored, 'score card counted');
      assert.deepEqual(await page.locator('#scoreT .head th').allTextContents(), ['', ...names]);
      assert.deepEqual((await page.locator('#scoreT .total td').allTextContents()).slice(1).map(Number), finalScores);
      assert.equal(await page.locator('#again').textContent(), 'Deal again');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pisti:v1')));
      assert.deepEqual(saved, { ...oldSave, name: names[seat] }, 'table play leaves the rest of the old save alone');
    }
    assert.ok(await noOverflow(a), '360x640 table score fits with a long name');
    await friendShot(a, 'score');
    await tap(a, '#again');
    await until(b, name => document.querySelector('#matchLine').textContent === `${name} wants another hand`, 'friend sees first vote', 25000, names[0]);
    assert.equal(await a.locator('#matchLine').textContent(), 'Waiting for Ben');
    for (const page of pages) {
      assert.equal((await P(page)).room.game, initial.game);
      assert.equal((await P(page)).screen, 'score');
    }
    await tap(b, '#again');
    for (const page of pages) await until(page, game => __pisti.room.game === game && __pisti.screen === 'play', 'second vote starts a hand', 25000, initial.game + 1);
    const newSeed = (await P(a)).seed;
    assert.notEqual(newSeed, initial.seed);
    frames = 0;
    model = deal(newSeed, newSeed % 2);
    await agree();

    await c.setViewportSize({ width: 360, height: 640 });
    await c.locator('#roomLeave').click();
    await c.locator('#friend').click();
    assert.ok(await noOverflow(c), '360x640 friend entry fits');
    await c.locator('#joinCode').fill(code.toLowerCase());
    await c.locator('#joinTable').click();
    await until(c, () => __pisti.room?.status === 'full', 'typing the same code reaches the same room');
    assert.ok(await noOverflow(a), '360x640 table fits');
    const cardsFit = await a.locator('#hand .card, #oppHand .card, #myPlayer, #oppPlayer').evaluateAll(els => els.every(el => {
      const { left, right } = el.getBoundingClientRect();
      return left >= 0 && right <= innerWidth;
    }));
    assert.ok(cardsFit, '360x640 cards and names stay in view');
    await c.locator('#roomLeave').click();
    await c.locator('#friend').click();
    await c.locator('#newTable').click();
    await until(c, () => __pisti.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent === 'Waiting for your friend', 'second host waits');
    const secondCode = await c.locator('#roomCode').textContent();
    await b.locator('#pause').click();
    await b.locator('#quit').click();
    assert.equal(new URL(b.url()).searchParams.has('room'), false);
    await b.locator('#friend').click();
    await b.locator('#joinCode').fill(secondCode.toLowerCase());
    await b.locator('#joinTable').click();
    await seatsReady(b, 1);
    assert.equal((await P(b)).room.code, secondCode);

    for (const test of tests) {
      assert.deepEqual(test.external, [], 'table makes no external network requests');
      assert.deepEqual(test.errors, [], 'table produces no console, page or HTTP errors');
    }
    console.log(`ok   pisti friends on ${phone}: 48 cards, replay, reconnect, full table, illegal move, rematch and 360x640`);
  } finally {
    await Promise.all(tests.map(test => test.context.close()));
  }
}

// Plays the hand on screen by tapping cards until the score card is complete. Returns the plays made.
async function playHand(page, phone, { shots = false, pistiShot = false, last = false } = {}) {
  let midDone = false, pistiDone = false;
  for (let n = 0; n < 60; n++) {
    await until(page, () => window.__pisti.canPlay || window.__pisti.scored || window.__pisti.screen === 'cover', 'a human turn or the end', 20000);
    let st = await P(page);
    if (st.scored) break;
    if (st.screen === 'cover') { await page.locator('#reveal').tap(); st = await P(page); }
    const card = last ? st.hand[st.hand.length - 1] : pick(st.hand, st.pileTop, st.pileSize);
    if (shots && !midDone && st.ply >= 12) { midDone = true; await shot(page, phone, '2-mid-hand'); }
    const isPisti = st.pileSize === 1 && !isJack(card) && rank(card) === rank(st.pileTop) && st.ply > 0;
    await page.locator(`#hand [data-card="${card}"]`).tap();
    if (pistiShot && isPisti && !pistiDone) {
      pistiDone = true;
      await until(page, () => document.getElementById('shout').classList.contains('on'), 'pişti flame shown', 4000);
      await sleep(300);
      await shot(page, phone, '3-pisti');
    }
    await until(page, ply => window.__pisti.ply > ply || window.__pisti.done, 'the tapped card is played', 6000, st.ply);
  }
  await until(page, () => window.__pisti.scored, 'score card counted', 20000);
  if (pistiShot) assert.ok(pistiDone, 'the scripted seed reached a pişti on screen');
}

async function run(test, phone, seed) {
  const { page } = test;
  await page.goto(`${base}/lab/pisti/?lang=en&date=${DATE}&speed=4&seed=${seed}`);
  await until(page, () => window.__pisti?.ready, 'page ready');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await until(page, () => window.__pisti?.screen === 'menu', 'menu');
  assert.ok(await page.isVisible('#play'), 'menu shows Play');
  assert.ok(await page.isVisible('#today') && await page.isVisible('#two'), 'menu shows Today’s deal and Two players');
  assert.ok(await noOverflow(page), 'menu has no overflow');
  await shot(page, phone, '1-menu');

  // One full hand, by taps, against the easy bot (a new player's level).
  await page.locator('#play').tap();
  let st = await P(page);
  assert.equal(st.mode, 'play'); assert.equal(st.level, 'easy');
  assert.ok(await noOverflow(page), 'play screen has no overflow');
  const box = await page.locator('#hand').boundingBox(), vp = page.viewportSize();
  assert.ok(box.y >= 0 && box.y + box.height <= vp.height, 'hand is on screen');
  await until(page, () => window.__pisti.canPlay, 'first turn');
  const glow = await page.locator('#hand .card.can').count();
  const first = await P(page);
  const expectGlow = first.hand.filter(c => first.pileSize && (rank(c) === rank(first.pileTop) || isJack(c))).length;
  assert.equal(glow, expectGlow, 'cards that capture now glow for a new player');
  await playHand(page, phone, { shots: true, pistiShot: true });
  st = await P(page);
  const ref = score(mirror(seed, 'easy')).map(x => x.total);
  assert.deepEqual(st.scores, ref, 'page score equals the Node mirror of the same plays');
  assert.equal(await page.locator('#scoreT tr.on').count(), 7, 'score card counts up all six items and the total');
  console.log(`hand ${phone}: seed ${seed}, you ${ref[0]}, bot ${ref[1]}`);
  assert.ok(ref[0] > ref[1], 'the scripted seed is a win for the player');
  assert.equal(st.save.level, 1, 'a won hand raises the bot one level');
  await shot(page, phone, '4-score-card');
  assert.ok(await noOverflow(page), 'score card fits');

  // Pause on page hide during the bot's thinking: exactly one bot card lands after resume.
  await page.locator('#again').tap();
  await until(page, () => window.__pisti.canPlay, 'second hand first turn');
  st = await P(page);
  await page.locator(`#hand [data-card="${st.hand[0]}"]`).tap();
  // Hide the page in the same frame that my card lands, so the bot is still waiting to answer.
  await page.evaluate(ply => new Promise(done => { const look = () => { if (window.__pisti.ply === ply + 1) { dispatchEvent(new Event('pagehide')); done(); } else requestAnimationFrame(look); }; look(); }), st.ply);
  assert.equal((await P(page)).screen, 'paused', 'page hide pauses');
  await sleep(1200);
  assert.equal((await P(page)).ply, st.ply + 1, 'no bot card while paused');
  await shot(page, phone, '5-paused');
  await page.locator('#resume').tap();
  await until(page, ply => window.__pisti.ply === ply + 2 && window.__pisti.canPlay, 'bot answers once after resume', 6000, st.ply);
  await sleep(500);
  assert.equal((await P(page)).ply, st.ply + 2, 'exactly one bot card after resume');
  await page.locator('#pause').tap(); await page.locator('#quit').tap();

  // Match to 51: the totals carry into the next hand and the dealer swaps, so the bot leads hand 2.
  await page.locator('#length button[data-len="51"]').tap();
  await page.locator('#play').tap();
  await playHand(page, phone);
  st = await P(page);
  assert.deepEqual(st.totals, st.scores, 'match totals after hand 1 equal the hand scores');
  assert.equal(st.matchOver, false, 'nobody reaches 51 in one hand here');
  assert.match(await page.textContent('#matchLine'), /Match to 51/);
  assert.equal(await page.textContent('#again'), 'Next hand');
  const carried = st.totals;
  await page.locator('#again').tap();
  await until(page, () => window.__pisti.handNo === 1 && window.__pisti.ply >= 1, 'hand 2 starts with the bot card', 8000);
  st = await P(page);
  assert.equal(st.dealer, 0, 'dealer swaps for hand 2');
  assert.deepEqual(st.totals, carried, 'totals carry into hand 2');
  console.log(`match ${phone}: after hand 1 ${carried.join('-')}, hand 2 led by the bot`);
  await page.locator('#pause').tap(); await page.locator('#quit').tap();
  await page.locator('#length button[data-len="one"]').tap();

  // Today's deal: scored once, then practice, and it survives a reload.
  await page.locator('#today').tap();
  st = await P(page);
  assert.equal(st.mode, 'daily'); assert.equal(st.practice, false); assert.equal(st.level, 'medium');
  await playHand(page, phone);
  assert.ok(await page.isVisible('#daily'), 'daily result shows');
  assert.match(await page.textContent('#dailyNote'), /scored/);
  const dref = score(mirror(dailySeed(DATE), 'medium')).map(x => x.total);
  assert.deepEqual((await P(page)).scores, dref, 'daily score equals the Node mirror of the date seed and the Medium bot');
  const pic = await page.evaluate(() => window.__pisti.picture());
  assert.equal(pic.width, 1080); assert.ok(pic.bytes > 10000, 'picture has PNG data');
  const dl = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await page.locator('#savePic').tap();
  const download = await dl;
  if (download) await download.saveAs(join(SHOTS, `${phone}-saved-${download.suggestedFilename()}`));
  const margin = (await P(page)).save.daily[DATE].margin;
  console.log(`daily ${phone}: you ${dref[0]}, bot ${dref[1]}, margin ${margin}, save picture ${download ? `downloaded ${download.suggestedFilename()}` : 'no download event (share path taken)'}`);
  await shot(page, phone, '6-daily-result');
  await page.locator('#scoreMenu').tap();
  await page.reload();
  await until(page, () => window.__pisti?.screen === 'menu', 'menu after reload');
  st = await P(page);
  assert.ok(st.save.daily[DATE]?.done, 'daily result survives reload');
  assert.ok(st.save.hands >= 2, 'hand count survives reload');
  assert.match(await page.textContent('#todayNote'), /practice/, 'menu marks today as practice');
  await page.locator('#today').tap();
  assert.equal((await P(page)).practice, true, 'second visit is practice');
  assert.ok(await page.isVisible('#practice'), 'practice label shown');
  await playHand(page, phone, { last: true });
  st = await P(page);
  assert.equal(st.save.daily[DATE].margin, margin, 'a practice hand does not change the scored margin');
  assert.notEqual(st.scores[0] - st.scores[1], margin, 'the practice hand had a different result');
  await page.locator('#scoreMenu').tap();

  // Two players on one phone: the cover card between turns.
  await page.locator('#two').tap();
  await until(page, () => window.__pisti.canPlay, 'player 1 turn');
  st = await P(page);
  await page.locator(`#hand [data-card="${st.hand[0]}"]`).tap();
  await until(page, () => window.__pisti.screen === 'cover', 'cover card', 5000);
  assert.match(await page.textContent('#coverWho'), /Player 2/);
  assert.equal(await page.locator('#hand [data-card]').count(), 0, 'no card face shows under the cover');
  await shot(page, phone, '7-cover');
  await page.locator('#reveal').tap();
  st = await P(page);
  assert.equal(st.viewer, 1); assert.equal(st.canPlay, true);
  await page.locator('#pause').tap(); await page.locator('#quit').tap();
  await sleep(200);
  assert.deepEqual(test.external, [], 'no outside requests');
  assert.deepEqual(test.errors, [], 'no page, console or network errors');
}

// Default pace: the bot answers in about 600 ms.
async function pace(browser) {
  const test = await open(browser, devices['Pixel 7']), { page } = test;
  try {
    await page.goto(`${base}/lab/pisti/?lang=en&seed=7`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    await page.locator('#play').tap();
    await until(page, () => window.__pisti.canPlay, 'turn');
    const st = await P(page);
    const t0 = Date.now();
    await page.locator(`#hand [data-card="${st.hand[0]}"]`).tap();
    await until(page, ply => window.__pisti.ply >= ply + 2, 'bot reply', 5000, st.ply);
    const ms = Date.now() - t0;
    console.log(`pace: tap to bot card landing ${ms} ms`);
    assert.ok(ms > 650 && ms < 2500, 'bot plays at human pace');
  } finally { await test.context.close(); }
}

// Paths the main run skips: drag up to play, quitting the scored daily, and a match played to its end.
async function extras(browser) {
  const test = await open(browser, devices['Pixel 7']), { page } = test;
  const DAY = '2026-11-25';
  try {
    await page.goto(`${base}/lab/pisti/?lang=en&seed=11&speed=4&date=${DAY}`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    await page.locator('#today').tap();
    await until(page, () => window.__pisti.canPlay, 'daily first turn');
    let st = await P(page);
    const b = await page.locator(`#hand [data-card="${st.hand[0]}"]`).boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - i * 15);
    await page.mouse.up();
    await until(page, ply => window.__pisti.ply > ply, 'a drag up plays the card', 4000, st.ply);
    console.log('drag: a drag up plays the card');
    await page.locator('#pause').tap(); await page.locator('#quit').tap();
    assert.ok((await P(page)).save.daily[DAY]?.started, 'the first card marks the daily attempt as started');
    assert.match(await page.textContent('#todayNote'), /practice/, 'after quitting, today is practice');
    await page.locator('#today').tap();
    assert.equal((await P(page)).practice, true, 'quitting gives no second scored try');
    await playHand(page, 'extras');
    st = await P(page);
    assert.equal(st.save.daily[DAY].margin, undefined, 'no scored margin for an abandoned day');
    assert.equal(await page.isVisible('#savePic'), false, 'Save picture hidden when there is no scored result');
    assert.match(await page.textContent('#dailyNote'), /left unfinished/);
    console.log('daily quit: no second scored try, Save picture hidden');
    await page.locator('#scoreMenu').tap();

    await page.locator('#length button[data-len="51"]').tap();
    await page.locator('#play').tap();
    let hands = 0;
    for (;;) {
      await playHand(page, 'extras'); hands++;
      st = await P(page);
      if (st.matchOver) break;
      assert.ok(hands < 12, 'the match ends');
      await page.locator('#again').tap();
    }
    assert.ok(Math.max(...st.totals) >= 51 && st.totals[0] !== st.totals[1], `match ends at 51 or more, not level ${st.totals}`);
    assert.equal(await page.textContent('#again'), 'Play again');
    assert.match(await page.textContent('#matchLine'), /^Match \d+–\d+$/);
    const final = st.totals;
    await page.locator('#again').tap();
    await until(page, () => window.__pisti.handNo === 0 && window.__pisti.ply <= 1, 'a new match starts', 8000);
    st = await P(page);
    assert.deepEqual(st.totals, [0, 0], 'a new match starts at 0-0');
    console.log(`match end: ${hands} hands, final ${final.join('-')}, Play again starts 0-0`);
    assert.deepEqual(test.errors, [], 'extras: no errors');
    assert.deepEqual(test.external, [], 'extras: no outside requests');
  } finally { await test.context.close(); }
}

// The smallest phone the brief names: 360x640.
async function small(browser, seed) {
  const device = { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const test = await open(browser, device), { page } = test;
  try {
    await page.goto(`${base}/lab/pisti/?lang=en&seed=${seed}&speed=4&date=${DATE}`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    const play = await page.locator('#play').boundingBox(), two = await page.locator('#two').boundingBox();
    assert.ok(play.y >= 0 && two.y + two.height <= 640, '360x640: menu buttons visible');
    assert.ok(await noOverflow(page), '360x640: menu no overflow');
    await shot(page, 'small', '1-menu');
    await page.locator('#play').tap();
    await until(page, () => window.__pisti.canPlay, 'turn');
    for (const sel of ['#hand', '#pile', '#oppHand', '#pause']) {
      const b = await page.locator(sel).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 360 && b.y + b.height <= 640, `360x640: ${sel} in view ${JSON.stringify(b)}`);
    }
    const cards = await page.locator('#hand .card').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => [r.left, r.right]));
    assert.ok(cards.every(([l, r]) => l >= 0 && r <= 360), '360x640: all four cards fit across');
    assert.ok(await noOverflow(page), '360x640: no scroll in play');
    await shot(page, 'small', '2-play');
    await playHand(page, 'small');
    await shot(page, 'small', '3-score');
    assert.ok(await noOverflow(page), '360x640: score card fits');
    await page.locator('#scoreMenu').tap();
    await page.locator('#today').tap();
    await playHand(page, 'small');
    const back = await page.locator('#scoreMenu').boundingBox(), save = await page.locator('#savePic').boundingBox();
    assert.ok(back.y >= 0 && back.y + back.height <= 640, `360x640: Menu button in view on the daily result ${JSON.stringify(back)}`);
    assert.ok(save && save.y + save.height <= 640, '360x640: Save picture in view');
    assert.ok(await noOverflow(page), '360x640: daily result fits');
    await shot(page, 'small', '4-daily');
    assert.deepEqual(test.errors, [], '360x640: no errors');
    console.log('ok   pisti on 360x640');
  } finally { await test.context.close(); }
}

// Languages. The key tables agree in Node; then the page in Turkish, on each phone and at 360x640.
function tablesAgree() {
  const en = Object.keys(tables.en).sort(), tr = Object.keys(tables.tr).sort();
  assert.deepEqual(tr, en, 'every key in tables.en exists in tables.tr and the other way round');
  const vars = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for (const key of en) {
    assert.ok(tables.tr[key].trim() && tables.en[key].trim(), `${key} is not empty`);
    assert.equal(vars(tables.tr[key]), vars(tables.en[key]), `${key}: same {variables} in both languages`);
  }
  console.log(`ok   pisti words: ${en.length} keys in English and Turkish, same variables`);
}
const visibleTexts = page => page.evaluate(() => [...document.body.querySelectorAll('*')]
  .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')
  .flatMap(el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean)));
async function noRawKeys(page, what) {
  const keys = new Set(Object.keys(tables.en));
  for (const text of await visibleTexts(page)) {
    assert.ok(!keys.has(text), `${what}: visible text "${text}" is a raw key`);
    assert.ok(!/[{}]/.test(text), `${what}: visible text "${text}" has an unfilled variable`);
  }
}
const SUIT_TR = ['sinek', 'karo', 'kupa', 'maça'], SUIT_EN = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANK_TR = ['', 'as', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'vale', 'kız', 'papaz'];
const RANK_EN = ['', 'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
const nameTr = c => `${SUIT_TR[(c / 13) | 0]} ${RANK_TR[c % 13 + 1]}`;
const nameEn = c => `${RANK_EN[c % 13 + 1]} of ${SUIT_EN[(c / 13) | 0]}`;
const labels = page => page.locator('#hand [data-card]').evaluateAll(els => els.map(el => [Number(el.dataset.card), el.getAttribute('aria-label')]));
const text = (page, selector) => page.locator(selector).first().textContent().then(x => x.trim());
const langShot = (page, phone, name) => page.screenshot({ path: join(LANG_SHOTS, `${phone}-tr-${name}.png`) });

async function turkish(browser, device, phone, seed, small = false) {
  const test = await open(browser, device), { page } = test;
  const wire = tableWire();
  try {
    await wire.attach(page);
    const home = `${base}/lab/pisti/?date=${DATE}&speed=4&seed=${seed}`;
    await page.goto(`${home}&lang=tr`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'tr', 'the page language is Turkish');
    assert.equal(await text(page, '#play'), 'Oyna');
    assert.equal(await text(page, '#today'), 'Günün eli' + await text(page, '#todayNote'));
    assert.equal(await text(page, '#friend'), 'Arkadaşla oyna');
    assert.equal(await text(page, '#two'), 'İki kişi, tek telefon');
    assert.equal(await text(page, '#length button[data-len="one"]'), 'Tek el');
    assert.match(await text(page, '#todayNote'), /herkese aynı kartlar/);
    assert.equal(await text(page, '#langMenu'), 'English');
    assert.equal(await page.locator('#levelDots').getAttribute('aria-label'), 'Botun gücü: kolay');
    assert.ok(await noOverflow(page), 'Turkish menu has no overflow');
    const sw = await page.locator('#langMenu').boundingBox(), vp = page.viewportSize();
    assert.ok(sw.height >= 44 && sw.width >= 44 && sw.x >= 0 && sw.x + sw.width <= vp.width && sw.y >= 0, `language button is at least 44 px and on screen ${JSON.stringify(sw)}`);
    await noRawKeys(page, 'Turkish menu');
    await langShot(page, small ? 'small' : phone, '1-menu');

    // Friend card: entry, then a table waiting for a friend.
    await page.locator('#friend').tap();
    assert.equal(await text(page, '#friendTitle'), 'Arkadaşla oyna');
    assert.equal(await text(page, '#friendEntry .field span'), 'Adın (isteğe bağlı)');
    assert.equal(await text(page, '#newTable'), 'Yeni masa');
    assert.equal(await text(page, '#joinTable'), 'Katıl');
    assert.equal(await page.locator('#joinCode').evaluate(el => el.lang), 'en', 'the code field uppercases as Latin A-Z, not Turkish İ');
    assert.ok(await noOverflow(page), 'Turkish friend entry has no overflow');
    await noRawKeys(page, 'Turkish friend entry');
    await page.locator('#newTable').tap();
    await until(page, () => document.querySelector('#lobbyStatus').textContent === 'Arkadaşın bekleniyor', 'Turkish waiting line');
    assert.equal(await text(page, '#shareLink'), 'Bağlantıyı paylaş');
    assert.equal(await page.locator('#roomCode').getAttribute('aria-label'), 'Masa kodu');
    assert.ok(await noOverflow(page), 'Turkish invite card has no overflow');
    await noRawKeys(page, 'Turkish invite');
    await langShot(page, small ? 'small' : phone, '3-friend');
    await page.locator('#roomLeave').tap();

    // Play screen: hint, card names, pause and the switch.
    await page.locator('#play').tap();
    await until(page, () => window.__pisti.canPlay, 'turn');
    assert.equal(await page.locator('.kit-hint .label').textContent(), 'Oynamak için bir karta dokun');
    assert.equal(await page.locator('#hand').getAttribute('aria-label'), 'Kartların');
    assert.equal(await page.locator('#pause').getAttribute('aria-label'), 'Duraklat');
    for (const [card, label] of await labels(page)) assert.equal(label, nameTr(card), 'Turkish card name');
    assert.ok(await noOverflow(page), 'Turkish play screen has no overflow');
    await langShot(page, small ? 'small' : phone, '2-play');
    await page.locator('#pause').tap();
    assert.equal(await text(page, '#pauseTitle'), 'Duraklatıldı');
    assert.equal(await text(page, '#resume'), 'Devam et');
    assert.equal(await text(page, '#sound'), 'Ses: açık');
    assert.equal(await text(page, '#colours'), 'Dört renk: kapalı');
    assert.ok(await noOverflow(page), 'Turkish pause screen has no overflow');
    const sw2 = await page.locator('#langPause').boundingBox();
    assert.ok(sw2.height >= 44 && sw2.y + sw2.height <= vp.height, 'pause language button is at least 44 px and on screen');
    await langShot(page, small ? 'small' : phone, '5-paused');
    // The switch redraws the open pause card and the cards on screen, with no reload.
    await page.locator('#langPause').tap();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await text(page, '#pauseTitle'), 'Paused');
    assert.equal(await text(page, '#langPause'), 'Türkçe');
    for (const [card, label] of await labels(page)) assert.equal(label, nameEn(card), 'English card name after the switch');
    assert.equal(await page.locator('.kit-hint .label').textContent(), 'Tap a card to play it');
    assert.equal(await page.locator('#hand').getAttribute('aria-label'), 'Your cards');
    await page.locator('#langPause').tap();
    assert.equal(await text(page, '#pauseTitle'), 'Duraklatıldı');
    await page.locator('#resume').tap();

    // A whole hand in Turkish, then the score card.
    await playHand(page, phone);
    assert.equal(await text(page, '#scoreT .head th:nth-child(2)'), 'Sen');
    assert.equal(await text(page, '#scoreT .head th:nth-child(3)'), 'Bot');
    const rows = await page.locator('#scoreT tr[data-k] td:first-child').allTextContents();
    assert.deepEqual(rows.map(x => x.replace(/ \(\d+–\d+\)/, '').replace(/[︎]/g, '')), ['Vale · her biri 1', 'As · her biri 1', 'Sinek ikili · 2', 'Karo onlu · 3', 'Kart çoğunluğu · 3', 'Pişti · 10 (vale/vale · 20)']);
    assert.match(rows[4], /\(\d+–\d+\)$/, 'the card count shows beside the most-cards row');
    assert.equal(await text(page, '#scoreT .total td:first-child'), 'Toplam');
    assert.equal(await text(page, '#scoreTitle'), 'Sen kazandın');
    assert.equal(await text(page, '#again'), 'Tekrar oyna');
    assert.equal(await text(page, '#scoreMenu'), 'Menü');
    assert.ok(await noOverflow(page), 'Turkish score card has no overflow');
    const cells = await page.locator('#scoreT td, #scoreT th').evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth + 1));
    assert.ok(cells, 'no score card cell is clipped');
    await noRawKeys(page, 'Turkish score card');
    await langShot(page, small ? 'small' : phone, '4-score');
    if (small) {
      await page.locator('#scoreMenu').tap();
      await page.locator('#today').tap();
      await playHand(page, phone);
      assert.match(await text(page, '#dailyNote'), /^Günün eli .*2026.* · puanlandı$/);
      assert.match(await text(page, '#matchLine'), /^Fark [+−]?\d+$/);
      assert.equal(await text(page, '#savePic'), 'Resmi kaydet');
      assert.ok(await noOverflow(page), 'Turkish daily result has no overflow');
      const back = await page.locator('#scoreMenu').boundingBox(), save = await page.locator('#savePic').boundingBox();
      assert.ok(back.y + back.height <= 640 && save.y + save.height <= 640, 'Turkish daily result keeps Menu and Save picture in view');
      await langShot(page, 'small', '6-daily');
      const pic = await page.evaluate(() => window.__pisti.picture());
      assert.ok(pic.bytes > 10000, 'the Turkish picture draws');
    }

    // The score card redraws in place: open, switch is not on this card, so use the pause path on a fresh hand.
    await page.locator('#scoreMenu').tap();
    await page.reload();
    await until(page, () => window.__pisti?.screen === 'menu', 'menu after reload');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'tr', 'Turkish survives a reload');
    assert.equal(await text(page, '#play'), 'Oyna');
    // The switch on the menu, no reload; the choice survives a reload with no ?lang= on the address.
    await page.locator('#langMenu').tap();
    assert.equal(await text(page, '#play'), 'Play');
    assert.equal(await text(page, '#langMenu'), 'Türkçe');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.match(await text(page, '#todayNote'), /^[A-Z][a-z]{2} \d+, 2026 · /, 'the date follows the language');
    await page.goto(`${base}/lab/pisti/?date=${DATE}&speed=4&seed=${seed}`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu, no ?lang=');
    assert.equal(await text(page, '#play'), 'Play', 'the choice is remembered');
    await page.locator('#langMenu').tap();
    assert.equal(await text(page, '#play'), 'Oyna');
    await page.goto(`${base}/lab/pisti/?date=${DATE}&speed=4&seed=${seed}`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu, no ?lang= again');
    assert.equal(await text(page, '#play'), 'Oyna', 'Turkish is remembered too');
    assert.deepEqual(test.external, [], 'no outside requests');
    assert.deepEqual(test.errors, [], 'Turkish run: no console, page or network errors');
    console.log(`ok   pisti in Turkish on ${phone}${small ? ' (360x640)' : ''}`);
  } finally { await test.context.close(); }
}

let failed = 0;
tablesAgree();
const seed = pistiSeed();
console.log(`pişti seed ${seed}`);
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(arg => !arg.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch();
    const test = await open(browser, device);
    try {
      await run(test, phone, seed);
      await playFriend(browser, device, phone);
      await turkish(browser, device, phone, seed);
      console.log(`ok   pisti on ${phone}`);
      if (phone === 'chromium') { await pace(browser); await small(browser, seed + 1); await turkish(browser, { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'small', seed, true); await extras(browser); console.log('ok   pisti extras on chromium'); }
    } catch (e) { failed++; console.error(`FAIL pisti on ${phone}: ${e.stack}`); if (test.errors.length) console.error(test.errors.join('\n')); await shot(test.page, phone, 'failure').catch(() => {}); }
    finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`screenshots in ${SHOTS}`);
console.log(`friend screenshots in ${TABLE_SHOTS}`);
console.log(failed ? `FAILED on ${failed} phone(s)` : 'ALL PASS');
process.exitCode = failed ? 1 : 0;
