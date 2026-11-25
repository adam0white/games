// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node experiments/lab/pitch/check.mjs [webkit|chromium]
// Serves experiments/ (so ../../kit/ resolves) and taps the screen points the page reports; moves are chosen by the rules in Node.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { create, restore, snapshot, botTurn, mulberry32, daily, legal, apply, clone, solve, fromMoves } from './sim.js';
import { PUZZLES } from './puzzles.js';
import { tables } from './words.js';
import { answerLab, allowLocalSend, withAgent, assertNotice, assertRun, assertNoLeak, assertOffSendsNothing, waitForRuns, runRecords } from '../../kit/check/lab-record.mjs';
import { TABLE, tableName, tableMessage, freshTable, sit, move, again, shown } from '../../../workers/lab-ai/src/table.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/tmp/claude-improve-pitch/pitch-shots';
const TABLE_SHOTS = join(dirname(SHOTS), 'pitch-table-shots');
const WORD_SHOTS = process.env.WORD_SHOTS || '/tmp/claude-improve-pitch/i18n-shots';
await Promise.all([mkdir(SHOTS, { recursive: true }), mkdir(TABLE_SHOTS, { recursive: true }), mkdir(WORD_SHOTS, { recursive: true })]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    assert.ok(file.startsWith(root + sep));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url);
const { webkit, chromium, devices } = require(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'playwright') : 'playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const DATE = '2026-11-24', URL_ = `${base}/lab/pitch/?date=${DATE}&lang=en`;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const P = (page, expr, arg) => page.evaluate(expr, arg);
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });
async function until(page, fn, label, timeout = 25000) {
  try { await page.waitForFunction(fn, null, { timeout }); }
  catch { throw new Error(`timed out: ${label}; state=${JSON.stringify(await P(page, () => window.__pitch && { screen: __pitch.screen, mode: __pitch.mode, canTap: __pitch.canTap, busy: __pitch.busy, turn: __pitch.turn, winner: __pitch.winner }).catch(() => null))}`); }
}
async function open(browser, device, friend = false) {
  const context = await browser.newContext({ ...device, acceptDownloads: true }), page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [], outside = [];
  await context.addInitScript(friend => {
    window.__shared = [];
    if (friend || navigator.share) Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.__shared.push((data.files || []).length);
      window.__sharedLink = data.url ? { url: data.url, text: data.text } : null;
    } });
  }, friend);
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    outside.push(url); return route.abort();
  });
  // The lab endpoint is answered here (registered after the catch-all above, so it takes the request first).
  const lab = await answerLab(context, base);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors, outside, lab };
}
async function tapPoint(page, x, y) {
  const before = await P(page, () => __pitch.segments);
  await page.touchscreen.tap(x, y);
  const drew = () => page.waitForFunction(n => __pitch.segments > n, before, { timeout: 4000 });
  try { await drew(); }
  catch {
    // Some engines give no pointer events for an emulated touch; a mouse click is the same pointer path.
    usedMouse++; console.log(`touch fallback at ${x|0},${y|0} canTap=${await P(page, () => __pitch.canTap)} mode=${await P(page, () => __pitch.mode)} seg=${await P(page, () => __pitch.segments)}`); await page.mouse.click(x, y); await drew();
  }
}
let usedMouse = 0, betweenCheck = null;
async function tapDir(page, d) {
  await until(page, () => __pitch.canTap, 'input open before a tap');
  const t = (await P(page, () => __pitch.legal)).find(m => m.d === d);
  assert.ok(t, `direction ${d} is legal on the page`);
  await tapPoint(page, t.sx, t.sy);
}
async function noOverflow(page, label) {
  assert.ok(await P(page, () => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth), `${label}: no horizontal overflow`);
}
const visibleIn = async (page, sel) => P(page, s => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }, sel);

// The actual table state and frame parsers run in Node. Only the socket transport and storage are in memory.
function tableWire() {
  const rooms = new Map();
  let nextId = 0, nextSeed = 24;
  const live = room => [...room.sockets.values()].filter(s => s.seat !== null);
  const seats = room => shown(room.state, live(room).map(s => s.seat));
  const deliver = (socket, event, data) => P(socket.page, ({ id, event, data }) => window.__pitchWireReceive?.(id, event, data), { id: socket.id, event, data });
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
      await page.exposeFunction('__pitchWireOpen', async addr => {
        const url = new URL(addr);
        assert.equal(url.origin, base.replace(/^http/, 'ws'), 'table socket is same-origin');
        const named = tableName(url.pathname);
        assert.equal(named?.game, 'pitch');
        if (reconnectGate) await reconnectGate;
        if (!rooms.has(named.name)) rooms.set(named.name, { state: freshTable(TABLE.games[named.game].seats, nextSeed++, Date.now()), sockets: new Map() });
        const room = rooms.get(named.name), id = ++nextId;
        socket = { page, id, room, seat: null };
        room.sockets.set(id, socket);
        return id;
      });
      await page.exposeFunction('__pitchWireSend', async (id, text) => {
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
      await page.exposeFunction('__pitchWireClose', id => socket?.id === id ? close(socket, 1000, false) : undefined);
      await page.addInitScript(() => {
        const sockets = new Map();
        window.__pitchWireReceive = (id, event, data) => {
          const socket = sockets.get(id);
          if (!socket) return;
          if (event === 'message') socket.onmessage?.({ data });
          else {
            sockets.delete(id);
            socket.readyState = 3;
            socket.onclose?.({ code: data });
          }
        };
        window.__pitchSocket = class {
          constructor(addr) {
            this.readyState = 0;
            window.__pitchWireOpen(addr).then(id => {
              if (this.readyState === 3) return window.__pitchWireClose(id);
              this.id = id;
              this.readyState = 1;
              sockets.set(id, this);
              this.onopen?.();
            });
          }
          send(text) { void window.__pitchWireSend(this.id, text); }
          close() {
            if (this.readyState === 3) return;
            this.readyState = 3;
            sockets.delete(this.id);
            if (this.id !== undefined) void window.__pitchWireClose(this.id);
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
        async inject(seat, directions) {
          const { room } = socket, i = room.state.log.length;
          const frame = tableMessage(JSON.stringify({ t: 'm', i, m: directions }));
          assert.ok(frame, 'the illegal game move is valid wire data');
          assert.equal(await acceptMove(room, seat, frame), 'ok', 'server broadcasts it');
        },
      };
    },
  };
}

// Play recording: the notice is on the menu before Play, a played match sends one run record under 'pitch',
// and with the switch off in the pause card the next match sends nothing.
async function recording(browser, device, phone) {
  const test = await open(browser, device), { page, lab } = test;
  try {
    await allowLocalSend(test.context);
    await page.goto(withAgent(URL_));
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu');
    await assertNotice(page, '#play');
    assert.equal(lab.sent.length, 0, 'nothing is sent before Play');
    await page.click('#play');
    await until(page, () => __pitch.mode === 'bot' && __pitch.canTap, 'match starts');
    await playMatch(page, phone, null);
    await waitForRuns(lab, 'pitch', 1);
    const run = assertRun(lab, 'pitch', { outcomes: ['won', 'lost'], summaryKeys: ['mode', 'goals', 'level'] });
    assert.equal(run.data.summary.mode, 'bot'); assert.ok(run.data.events.some(e => e.type === 'goal'), 'goals are events');
    await page.click('#endMenu');
    await until(page, () => __pitch.screen === 'menu', 'menu again');
    await page.click('#play');
    await until(page, () => __pitch.mode === 'bot' && __pitch.canTap, 'second match');
    await page.click('#pauseBtn');
    await assertOffSendsNothing(page, lab, 'pitch', { play: async () => { await page.click('#resume'); await playMatch(page, phone, null); } });
    assert.deepEqual(test.outside, [], 'nothing reached outside'); assert.deepEqual(test.errors, []);
    console.log(`ok   pitch recording on ${phone}`);
  } finally { await test.context.close(); }
}
async function playFriend(browser, device, phone) {
  const tests = [], wire = tableWire();
  const friendShot = (page, name) => page.screenshot({ path: join(TABLE_SHOTS, `${phone}-${name}.png`), timeout: 25000 });
  async function friendPage() {
    const test = await open(browser, device, true);
    tests.push(test);
    await allowLocalSend(test.context);
    return { page: test.page, socket: await wire.attach(test.page), lab: test.lab };
  }
  const oldSave = { played: 3, level: 2, lossStreak: 1, wins: 2, sound: false, daily: { [DATE]: { used: 2, solved: false } } };
  try {
    const { page: a, socket: aSocket, lab: aLab } = await friendPage(), { page: b, socket: bSocket } = await friendPage();
    const pages = [a, b], names = ['Ada', 'Ben'];
    await Promise.all(pages.map(async page => {
      await page.goto(URL_);
      await P(page, data => localStorage.setItem('pitch:v1', JSON.stringify(data)), oldSave);
      await page.reload();
      await page.click('#friend');
      assert.equal(await page.locator('#friendName').inputValue(), '', 'old saves default to an empty name');
      assert.equal(await page.locator('#friendName').getAttribute('maxlength'), '24');
    }));
    await friendShot(a, 'friend-card');
    await Promise.all(pages.map((page, seat) => page.fill('#friendName', names[seat])));
    await a.click('#newTable');
    await until(a, () => __pitch.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent.includes('Waiting for your friend'), 'creator seated and waiting');
    assert.ok(await a.isVisible('#lobbyStatus'), 'the waiting message is visible');
    const code = (await a.textContent('#roomCode')).trim();
    assert.match(code, /^[A-HJ-NP-Z]{4}$/);
    await friendShot(a, 'waiting');
    await aSocket.navigateAway();
    await a.reload();
    await until(a, () => __pitch.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent.includes('Waiting for your friend'), 'host reload keeps the waiting seat');
    assert.equal((await a.textContent('#roomCode')).trim(), code);
    await a.click('#shareLink');
    await until(a, () => !!window.__sharedLink, 'Share link supplies a URL');
    const link = await P(a, () => window.__sharedLink);
    assert.deepEqual(link, { text: 'Play Paper Pitch with me', url: `${base}/lab/pitch/?room=${code}` });
    await b.goto(link.url);

    async function bothSeated() {
      await Promise.all(pages.map((page, seat) => page.waitForFunction(seat =>
        __pitch.room?.seat === seat && __pitch.room.status === 'live' && document.querySelectorAll('#score .seat-light.on').length === 2,
      seat, { timeout: 25000 })));
      for (const page of pages) {
        assert.deepEqual(await page.locator('#score .seat-name').allTextContents(), names);
        for (const seat of [0, 1]) assert.ok(await page.isVisible(`#score [data-seat="${seat}"] .seat-light.on`));
      }
    }
    await bothSeated();
    for (const [seat, page] of pages.entries()) {
      const goals = await P(page, () => __pitch.goalEnds);
      assert.ok(goals[seat].y > goals[1 - seat].y, `${names[seat]} has their own goal at the bottom`);
    }
    const aTargets = await P(a, () => __pitch.legal), bTargets = await P(b, () => __pitch.legal);
    const goals = await P(a, () => __pitch.goalEnds);
    for (const point of aTargets) {
      const rotated = bTargets.find(p => p.d === point.d);
      assert.ok(rotated);
      assert.equal(rotated.sx + point.sx, goals[0].x + goals[1].x, 'horizontal targets are mirrored');
      assert.equal(rotated.sy + point.sy, goals[0].y + goals[1].y, 'vertical targets are mirrored');
    }

    const initialRoom = await P(a, () => __pitch.room), first = initialRoom.seed % 2;
    let state = create(8, 10, first), frames = 0, taps = 0;
    const score = [0, 0];
    async function sameMatch(active = pages) {
      for (const page of active) {
        await page.waitForFunction(count => __pitch.room?.moves === count, frames, { timeout: 25000 });
        assert.deepEqual(await P(page, () => __pitch.state()), snapshot(state), `sheet after frame ${frames}`);
        assert.deepEqual(await P(page, () => __pitch.score), score, `score after frame ${frames}`);
      }
    }
    await sameMatch();

    async function takeSegment({ direction, active = pages, hold } = {}) {
      const seat = state.turn, player = pages[seat];
      await until(player, () => __pitch.canTap, `${names[seat]}'s turn on move ${taps + 1}`);
      assert.equal(await P(pages[1 - seat], () => __pitch.canTap), false, 'input locked for the other seat');
      const d = direction ?? botTurn(state, seat === 0 ? 1 : 0, mulberry32(31 + taps))[0];
      const point = (await P(player, () => __pitch.legal)).find(p => p.d === d);
      assert.ok(point, `direction ${d} appears on ${names[seat]}'s screen`);
      try {
        if (hold) await P(player, () => document.querySelector('#c').addEventListener('pointerup', () => {
          window.__pitchPendingAtTap = { waiting: __pitch.room.waiting, hidden: document.querySelector('#roomStatus').hidden };
        }, { once: true }));
        await player.touchscreen.tap(point.sx, point.sy);
        if (hold) {
          await until(player, () => __pitch.room.waiting, 'waiting for our own segment echo');
          await hold.sent;
          await sameMatch(active);
          assert.deepEqual(await P(player, () => window.__pitchPendingAtTap), { waiting: true, hidden: true }, 'ordinary move latency is hidden');
          assert.equal(await P(player, () => __pitch.canTap), false, 'no second move until the echo');
          await until(player, () => !document.querySelector('#roomStatus').hidden && document.querySelector('#roomStatus').textContent.includes('Sending move'), 'a slow echo gets a status');
        }
      } finally { hold?.release(); }
      apply(state, d);
      frames++; taps++;
      if (state.winner >= 0) {
        score[state.winner]++;
        if (Math.max(...score) < 2) state = create(8, 10, (first + score[0] + score[1]) % 2);
      }
      await sameMatch(active);
      if (hold) assert.equal(await player.isVisible('#roomStatus'), false, 'the status clears on the echo');
    }

    const firstSocket = first === 0 ? aSocket : bSocket;
    await takeSegment({ hold: firstSocket.holdMove() });
    await aSocket.inject(state.turn, [99]);
    frames++;
    await sameMatch();

    function passesToRed() {
      if (state.turn !== 0) return;
      return legal(state).find(d => {
        const next = clone(state);
        apply(next, d);
        return next.winner < 0 && next.turn === 1;
      });
    }
    while (taps < 4 || passesToRed() === undefined) {
      assert.ok(taps < 30 && Math.max(...score) === 0, 'find a mid-sheet move that passes to Ben');
      await takeSegment();
    }
    await Promise.all(pages.map(page => until(page, () => !__pitch.busy, 'ink settled on the mid-match sheet')));
    await friendShot(a, 'mid-blue');
    await friendShot(b, 'mid-red');
    await bSocket.cut();
    await until(a, () => document.querySelector('#roomStatus').textContent.includes('Ben dropped. Waiting for them to come back.'), 'the dropped friend message');
    assert.ok(await a.isVisible('#roomStatus'), 'the dropped friend message is visible');
    assert.equal(await a.locator('#score .seat-light.on').count(), 1, 'only the remaining seat is lit');
    await until(b, () => __pitch.room.status === 'waiting' && document.querySelector('#roomStatus').textContent.includes('Reconnecting'), 'the dropped page is reconnecting');
    assert.ok(await b.isVisible('#roomStatus'), 'the reconnecting message is visible');
    await friendShot(a, 'dropped-friend');
    await takeSegment({ direction: passesToRed(), active: [a] });
    bSocket.reconnect();
    await bothSeated();
    await sameMatch();
    assert.equal(state.turn, 1, 'the move while Ben was away passed the turn to Ben');
    await takeSegment();

    while (score[0] + score[1] === 0) {
      assert.ok(taps < 100, 'first sheet finishes');
      await takeSegment();
    }
    assert.equal(await a.isVisible('#next'), false, 'friend matches have no Next kick-off card');
    await takeSegment();
    await bSocket.navigateAway();
    await b.reload();
    await bothSeated();
    await sameMatch();
    assert.equal(new URL(b.url()).searchParams.get('room'), code, 'reload is still on the same link');

    const { page: c } = await friendPage();
    await c.goto(link.url);
    await until(c, () => __pitch.room?.status === 'full' && document.querySelector('#lobbyStatus').textContent.includes('This table is full'), 'third visitor is refused');
    assert.ok(await c.isVisible('#lobbyStatus'), 'the full-table message is visible');

    while (Math.max(...score) < 2) {
      assert.ok(taps < 300, 'the table match finishes within 300 valid segments');
      await takeSegment();
    }
    await Promise.all(pages.map(page => until(page, () => __pitch.screen === 'end', 'table end card')));
    for (const [seat, page] of pages.entries()) {
      assert.equal(await page.textContent('#endTitle'), state.winner === seat ? 'You win!' : `${names[state.winner]} wins!`);
      assert.equal(await page.textContent('#again'), 'Rematch');
      const { played, name, ...other } = await P(page, () => __pitch.save());
      const { played: wasPlayed, ...untouched } = oldSave;
      assert.equal(name, names[seat]);
      assert.ok(played === wasPlayed || played === wasPlayed + 1);
      assert.deepEqual(other, untouched, 'no change to bot and daily progress');
    }
    // Play recording at a table: one run for the match, a table-joined event, and no name or code in anything sent.
    await waitForRuns(aLab, 'pitch', 1);
    const tableRun = runRecords(aLab, 'pitch').find(r => r.data.start?.mode === 'table');
    assert.ok(tableRun, 'the table match was recorded');
    assert.ok(['won', 'lost'].includes(tableRun.data.outcome)); assert.equal(tableRun.data.summary.mode, 'table');
    assert.ok(tableRun.data.events.some(e => e.type === 'table-joined') || runRecords(aLab, 'pitch').some(r => r.data.events?.some(e => e.type === 'table-joined')), 'a table-joined event');
    assertNoLeak(aLab, ['Ada', 'Ben', code]);
    await a.click('#again');
    await until(a, () => document.querySelector('#endLine').textContent.includes('Waiting for Ben'), 'own rematch vote waits');
    await until(b, () => document.querySelector('#endLine').textContent.includes('Ada wants a rematch'), 'friend sees the first vote');
    await sameMatch();
    for (const page of pages) {
      assert.equal(await P(page, () => __pitch.room.game), initialRoom.game, 'one vote does not start another game');
      assert.equal(await P(page, () => __pitch.screen), 'end');
    }
    await friendShot(a, 'rematch-wait');
    await b.click('#again');
    await Promise.all(pages.map(page => until(page, () => __pitch.room.game === 1 && __pitch.screen === 'play', 'both votes start the rematch')));
    const seed = await P(a, () => __pitch.room.seed);
    assert.equal(seed, await P(b, () => __pitch.room.seed));
    assert.notEqual(seed, initialRoom.seed, 'rematch uses its new server seed');
    state = create(8, 10, seed % 2);
    score.fill(0);
    frames = 0;
    await sameMatch();

    // Check a narrow viewport with real friend content, including the join input and waiting card.
    await a.setViewportSize({ width: 360, height: 640 });
    await noOverflow(a, '360x640 friend pitch');
    await c.setViewportSize({ width: 360, height: 640 });
    await noOverflow(c, '360x640 full table card');
    await c.click('#roomLeave');
    await c.click('#friend');
    await noOverflow(c, '360x640 friend card');
    await c.fill('#joinCode', code.toLowerCase());
    await c.click('#joinTable');
    await until(c, () => __pitch.room?.status === 'full', 'entering the same code reaches the same table');
    await c.click('#roomLeave');
    await c.click('#friend');
    await c.click('#newTable');
    await until(c, () => __pitch.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent.includes('Waiting for your friend'), 'new table is waiting');
    await noOverflow(c, '360x640 waiting card');
    const secondCode = (await c.textContent('#roomCode')).trim();
    await c.click('#roomLeave');
    await until(c, () => __pitch.screen === 'menu' && !new URL(location.href).searchParams.has('room'), 'creator leaves the waiting table');
    async function joinByCode(page) {
      await page.click('#friend');
      await page.fill('#joinCode', secondCode.toLowerCase());
      await page.click('#joinTable');
    }
    await joinByCode(c);
    await until(c, () => __pitch.room?.seat === 0 && __pitch.room.status === 'live', 'code recovers the host seat');
    await bSocket.navigateAway();
    await b.goto(URL_);
    await joinByCode(b);
    await until(b, () => __pitch.room?.seat === 1 && __pitch.screen === 'play', 'a friend joins successfully by code');
    assert.equal(await P(b, () => __pitch.room.code), secondCode);

    for (const { errors, outside } of tests) {
      assert.deepEqual(outside, [], 'friend play makes no external network requests');
      assert.deepEqual(errors, [], 'friend play raises no page, console or network errors');
    }
    console.log(`ok   pitch friends on ${phone}: ${taps} segments, replay, reconnect, full table, rematch and 360x640`);
  } finally { await Promise.all(tests.map(test => test.context.close())); }
}

async function playMatch(page, phone, name, mine = 1) {
  let taps = 0;
  for (let i = 0; i < 600; i++) {
    await until(page, () => __pitch.canTap || __pitch.screen === 'between' || __pitch.screen === 'end', 'my turn or a card', 20000);
    const screen = await P(page, () => __pitch.screen);
    if (screen === 'end') return taps;
    if (screen === 'between') {
      assert.ok(await visibleIn(page, '#next'), 'Next kick-off is on screen');
      if (name) await shot(page, phone, `${name}-between`);
      if (betweenCheck) await betweenCheck(page);
      await page.click('#next'); continue;
    }
    const s = restore(await P(page, () => __pitch.state()));
    const chain = botTurn(s, mine, mulberry32(i + 1));
    await tapDir(page, chain[0]); taps++;
    if (taps === 3 && name) await shot(page, phone, `${name}-mid`);
  }
  throw new Error('match did not end within 600 steps');
}

async function run(test, phone) {
  const { page, errors, outside } = test;
  await page.goto(URL_);
  await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu');
  for (const id of ['#play', '#daily', '#two']) assert.ok(await visibleIn(page, id), `${id} visible on the menu`);
  await noOverflow(page, 'menu');
  await shot(page, phone, '1-menu');

  // First match: small pitch, Easy bot.
  await page.click('#play');
  await until(page, () => __pitch.mode === 'bot' && __pitch.canTap, 'first match starts on my turn');
  assert.deepEqual(await P(page, () => __pitch.size), { w: 6, h: 8 }, 'first match is on a 6 x 8 pitch');
  assert.equal(await P(page, () => __pitch.level), 0, 'first match is against Easy');
  const legalCount = (await P(page, () => __pitch.legal)).length;
  assert.equal(legalCount, 8, 'eight legal points at kick-off');
  await noOverflow(page, 'play');
  const targets = await P(page, () => __pitch.legal);
  for (const t of targets) assert.ok(t.sx > 10 && t.sx < page.viewportSize().width - 10, 'legal points on screen');

  // Pause on page hide while the bot is to move: nothing is drawn while paused.
  const s0 = restore(await P(page, () => __pitch.state()));
  const nonBounce = legal(s0).find(d => { const t = clone(s0); apply(t, d); return t.turn === 1 && t.winner < 0; });
  await tapDir(page, nonBounce);
  await P(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await P(page, () => __pitch.paused), true, 'page hide pauses');
  assert.ok(await page.isVisible('#paused'), 'pause card shows');
  await shot(page, phone, '2-paused');
  const frozen = await P(page, () => __pitch.segments);
  await sleep(900);
  assert.equal(await P(page, () => __pitch.segments), frozen, 'the bot does not draw while paused');
  await P(page, () => { delete document.hidden; });
  await page.click('#resume');
  await until(page, () => __pitch.canTap || __pitch.screen !== 'play', 'the bot plays after resume');

  const taps = await playMatch(page, phone, '2');
  assert.ok(await page.isVisible('#end'), 'end card');
  await until(page, () => document.querySelector('#pic').naturalWidth > 0, 'picture on the end card');
  for (const id of ['#endTitle', '#pic', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${id} fits on the end card`);
  const result = await P(page, () => ({ score: __pitch.score, save: __pitch.save(), title: document.querySelector('#endTitle').textContent }));
  console.log(`match ${phone}: ${taps} taps, score ${result.score.join('-')}, "${result.title}", next level ${result.save.level}`);
  assert.equal(Math.max(...result.score), 2, 'best of three ends at two goals');
  assert.equal(result.save.played, 1, 'the match is saved');
  await shot(page, phone, '3-end');

  // Save picture: a share with one file where the browser can share files, a PNG download otherwise.
  const download = page.waitForEvent('download', { timeout: 5000 }).then(d => d.suggestedFilename()).catch(() => null);
  await page.click('#savePic');
  const shared = await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 3000 }).then(() => P(page, () => window.__shared[0])).catch(() => 0);
  const file = shared ? null : await download;
  assert.ok(shared === 1 || file === 'paper-pitch.png', `Save picture shares or downloads a PNG (shared ${shared}, file ${file})`);
  console.log(`save picture ${phone}: ${shared ? 'navigator.share with 1 file' : `download ${file}`}`);

  // Rematch is one tap, on the full pitch.
  await page.click('#again');
  await until(page, () => __pitch.mode === 'bot' && __pitch.screen === 'play', 'rematch');
  assert.deepEqual(await P(page, () => __pitch.size), { w: 8, h: 10 }, 'rematch uses the full 8 x 10 pitch');

  // The save survives a reload.
  await page.reload();
  await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu after reload');
  const saved = await P(page, () => __pitch.save());
  assert.equal(saved.played, 1, 'played count survives reload');
  assert.equal(saved.level, result.save.level, 'level survives reload');
  // Changed on purpose (2026-11-24): the bot is now one of eight levels, named by number.
  assert.match(await page.textContent('#playSub'), /vs Level [1-8] bot/, 'menu shows the next bot');

  // Today's pitch: one missed attempt, then the solver's chain.
  await page.click('#daily');
  await until(page, () => __pitch.mode === 'daily' && __pitch.canTap, 'daily starts');
  const d = await P(page, () => __pitch.daily);
  assert.equal(d.date, DATE); assert.equal(d.used, 0);
  const puzzle = daily(DATE), pageState = await P(page, () => __pitch.state());
  assert.deepEqual(pageState.log, puzzle.state.log.map(e => e.slice()), 'page and Node generate the same puzzle');
  assert.equal(await page.locator('#tag .dots i').count(), 3, 'three attempt dots');
  await shot(page, phone, '4-daily');
  for (let i = 0; i < 40; i++) {
    await until(page, () => __pitch.canTap, 'daily input opens');
    const st = await P(page, () => ({ used: __pitch.daily.used, at: __pitch.segments, start: __pitch.daily.attemptStart, canTap: __pitch.canTap }));
    if (st.used === 1 && st.at === st.start && st.canTap) break;
    const s = restore(await P(page, () => __pitch.state()));
    const ends = m => { const t = clone(s); apply(t, m); return t.turn === 1 || (t.winner >= 0 && t.how !== 'goal'); };
    const safe = m => { const t = clone(s); apply(t, m); return t.winner < 0; };
    await tapDir(page, legal(s).find(ends) ?? legal(s).find(safe));
  }
  await until(page, () => __pitch.daily.used === 1 && __pitch.canTap && __pitch.segments === __pitch.daily.attemptStart, 'the pitch resets for attempt two');
  assert.equal(await page.locator('#tag .dots i.used').count(), 1, 'one dot used');
  for (const step of puzzle.solution) await tapDir(page, step);
  await until(page, () => __pitch.screen === 'end', 'daily result card');
  const dr = await P(page, () => __pitch.daily);
  assert.equal(dr.solved, true, 'the solver chain scores on the page'); assert.equal(dr.used, 2);
  await until(page, () => document.querySelector('#pic').naturalWidth > 0, 'daily picture');
  assert.ok(await visibleIn(page, '#endMenu'), 'daily card fits');
  assert.equal(await page.isVisible('#again'), false, 'no Rematch on the daily card');
  await shot(page, phone, '5-daily-end');
  // Feedback (2026-11-24): every action since the reload (daily: a miss, then the chain) went through fx(), so it had a sound and a motion.
  const fxSeen = new Set(await P(page, () => __pitch.fx));
  for (const name of ['button', 'draw', 'miss', 'goal']) assert.ok(fxSeen.has(name), `fx ${name} fired (seen: ${[...fxSeen].join(',')})`);
  await page.reload();
  await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu after daily');
  assert.equal(await page.locator('#dailyDots i.won').count(), 1, 'menu shows today solved');
  await page.click('#daily');
  await until(page, () => __pitch.screen === 'end', 'a finished daily reopens to its result');
  await page.click('#endMenu');

  // Puzzle book (2026-11-24): 18 pages, two open at the start, a miss counts a try, the solver's chain clears it.
  await page.click('#puzzles');
  await until(page, () => __pitch.screen === 'book', 'puzzle book');
  assert.equal(await page.locator('#bookGrid button').count(), PUZZLES.length, 'one tile per puzzle');
  assert.equal(await page.locator('#bookGrid button:not([disabled])').count(), 2, 'two puzzles open before any is solved');
  assert.ok(await visibleIn(page, '#bookMenu'), 'the book fits');
  await shot(page, phone, '5b-book');
  await page.locator('#bookGrid button').nth(1).click();
  await until(page, () => __pitch.mode === 'puzzle' && __pitch.canTap, 'puzzle 2 starts');
  const p2 = PUZZLES[1], ps = await P(page, () => __pitch.state());
  assert.deepEqual(ps.log, fromMoves(p2.w, p2.h, p2.first, p2.moves).log.map(e => e.slice()), 'page and Node build the same puzzle');
  for (let i = 0; i < 40; i++) {
    await until(page, () => __pitch.canTap, 'puzzle input opens');
    const st = await P(page, () => __pitch.puzzle);
    if (st.misses === 1) break;
    const t = restore(await P(page, () => __pitch.state()));
    const ends = m => { const u = clone(t); apply(u, m); return u.turn === 1 || (u.winner >= 0 && u.how !== 'goal'); };
    const safe = m => { const u = clone(t); apply(u, m); return u.winner < 0; };
    await tapDir(page, legal(t).find(ends) ?? legal(t).find(safe));
  }
  await until(page, () => __pitch.puzzle.misses === 1 && __pitch.canTap && __pitch.segments === __pitch.puzzle.attemptStart, 'the puzzle resets after a miss');
  assert.equal((await P(page, () => __pitch.puzzle)).tries, 1, 'the miss counted one try');
  assert.ok((await P(page, () => __pitch.fx)).includes('reset'), 'the reset after a miss has its own feedback');
  for (const step of solve(restore(await P(page, () => __pitch.state())), 7)) await tapDir(page, step);
  await until(page, () => __pitch.screen === 'end', 'puzzle result card');
  const book = await P(page, () => __pitch.more().book);
  assert.deepEqual(book[p2.id], { tries: 2, solved: true, at: 2 }, 'puzzle 2 saved as solved on try 2');
  assert.match(await P(page, () => __pitch.shareLine), /puzzle 2: solved on try 2/, 'the share line names the puzzle');
  assert.equal(await page.textContent('#again'), 'Next puzzle');
  for (const id of ['#endTitle', '#pic', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${id} fits on the puzzle card`);
  await shot(page, phone, '5c-puzzle-end');
  const stored = await P(page, () => JSON.parse(localStorage.getItem('pitch:more')));
  assert.equal(stored.book[p2.id].solved, true, 'the book is stored under its own key');
  await page.click('#endMenu');
  assert.match(await page.textContent('#bookDone'), /^1\/18$/, 'the menu shows the book count');

  // Two players on one phone: the turn passes and the pill takes the ink colour.
  await page.click('#two');
  await until(page, () => __pitch.mode === 'two' && __pitch.canTap, 'two players');
  const s2 = restore(await P(page, () => __pitch.state()));
  await tapDir(page, legal(s2).find(m => { const t = clone(s2); apply(t, m); return t.turn === 1; }));
  await until(page, () => __pitch.canTap && __pitch.turn === 1, 'red to move');
  assert.match(await page.textContent('#turnText'), /Red/);
  await shot(page, phone, '6-two-players');
  // A drag from the ball toward a legal point draws that line.
  const pick = (await P(page, () => __pitch.legal))[0], before = await P(page, () => __pitch.segments);
  const centre = await P(page, () => { const l = __pitch.legal, n = l.length; return { x: l.reduce((a, m) => a + m.sx, 0) / n, y: l.reduce((a, m) => a + m.sy, 0) / n }; });
  await page.mouse.move(centre.x, centre.y); await page.mouse.down();
  await page.mouse.move(centre.x + (pick.sx - centre.x) * 0.7, centre.y + (pick.sy - centre.y) * 0.7, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(n => __pitch.segments === n + 1, before, { timeout: 4000 });
  const last = (await P(page, () => __pitch.state())).log.at(-1), back = restore(await P(page, () => __pitch.state()));
  const lastTo = { x: last[1] % (back.w + 1), y: Math.floor(last[1] / (back.w + 1)) - 1 };
  assert.deepEqual(lastTo, { x: pick.x, y: pick.y }, 'a drag from the ball draws the line it points at');
  // Two players to the end card: both sides tap, chosen by Medium.
  for (let i = 0; i < 600; i++) {
    await until(page, () => __pitch.canTap || __pitch.screen === 'between' || __pitch.screen === 'end', 'two-player turn or card', 20000);
    const sc = await P(page, () => __pitch.screen);
    if (sc === 'end') break;
    if (sc === 'between') { await page.click('#next'); continue; }
    const st = restore(await P(page, () => __pitch.state()));
    await tapDir(page, botTurn(st, 1, mulberry32(900 + i))[0]);
  }
  assert.match(await page.textContent('#endTitle'), /^(Blue|Red) wins!$/, 'two-player match reaches its end card');
  console.log(`two players ${phone}: ${await page.textContent('#endTitle')} ${(await P(page, () => __pitch.score)).join('-')}`);
  await page.click('#endMenu');

  await noOverflow(page, 'end');
  assert.deepEqual(outside, [], 'no request leaves the local server');
  assert.deepEqual(errors, [], 'no page, console or network errors');
}

// From the small games' home at 320 x 568 (2026-11-24): the return link on the menu and end card, nothing scrolls,
// and a solved puzzle is reported to hub:results.
async function fromSmall(browser, phone) {
  const still = async (page, label) => { await noOverflow(page, label); assert.ok(await P(page, () => document.documentElement.scrollHeight <= innerHeight && [...document.querySelectorAll('.screen:not([hidden]) .card')].every(c => c.scrollHeight <= c.clientHeight + 1)), `${label}: nothing scrolls`); };
  const test = await open(browser, { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), { page } = test;
  try {
    await page.goto(`${base}/lab/pitch/?date=${DATE}&lang=en&from=small`);
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu from small');
    assert.ok(await visibleIn(page, '#menu .kit-home'), 'the return link is on the menu');
    for (const id of ['#play', '#daily', '#puzzles', '#friend', '#two']) assert.ok(await visibleIn(page, id), `320: ${id} visible`);
    await still(page, '320 menu');
    await page.click('#puzzles');
    await until(page, () => __pitch.screen === 'book', '320 book');
    await still(page, '320 book');
    assert.ok(await visibleIn(page, '#bookMenu'), '320: the book fits');
    await page.locator('#bookGrid button').first().click();
    await until(page, () => __pitch.mode === 'puzzle' && __pitch.canTap, '320 puzzle 1');
    await still(page, '320 puzzle');
    for (const step of solve(restore(await P(page, () => __pitch.state())), 7)) await tapDir(page, step);
    await until(page, () => __pitch.screen === 'end', '320 puzzle card');
    await until(page, () => document.querySelector('#pic').naturalWidth > 0, '320 puzzle picture');
    await still(page, '320 puzzle card');
    for (const id of ['#again', '#savePic', '#endMenu', '#end .kit-home']) assert.ok(await visibleIn(page, id), `320: ${id} fits on the puzzle card`);
    const hub = await P(page, () => JSON.parse(localStorage.getItem('hub:results') || '{}'));
    assert.equal(hub.pitch?.wins, 1, 'the solved puzzle is reported to the small games home');
    assert.equal(hub.pitch?.last, 'won');
    await shot(page, `320-${phone}`, 'puzzle-end');
    assert.deepEqual(test.errors, [], '320: no page errors');
    console.log(`ok   pitch from the small games home on ${phone} 320x568`);
  } finally { await test.context.close(); }
}

async function small(browser, width, height) {
  const test = await open(browser, { viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), { page } = test;
  const tag = `${width}x${height}`;
  try {
    await page.goto(URL_);
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'small menu');
    for (const id of ['#play', '#daily', '#two', '#soundMenu']) assert.ok(await visibleIn(page, id), `small: ${id} visible`);
    await noOverflow(page, 'small menu');
    await shot(page, tag, '1-menu');
    await page.evaluate(d => localStorage.setItem('pitch:v1', JSON.stringify({ played: 3, level: 2, lossStreak: 1, wins: 2, sound: true, daily: { [d]: { used: 2, solved: false } } })), DATE);
    await page.reload();
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'small menu again');
    await page.click('#play');
    await until(page, () => __pitch.canTap, 'small play');
    assert.deepEqual(await P(page, () => __pitch.size), { w: 8, h: 10 });
    // Changed on purpose (2026-11-24): __pitch.level is the rung now; a saved Hard (level 2) is rung 8 (index 7), which plays Hard.
    assert.equal(await P(page, () => __pitch.level), 7, 'a saved Hard level plays the top rung, Hard');
    assert.equal(await P(page, () => __pitch.rung), 7, 'an old save with no pitch:more starts on its own level');
    const t = await P(page, () => __pitch.legal);
    for (const m of t) assert.ok(m.sx >= 22 && m.sx <= width - 22 && m.sy > 60 && m.sy < height - 40, 'small: targets on screen');
    await noOverflow(page, 'small play');
    await shot(page, tag, '2-play');
    const st = restore(await P(page, () => __pitch.state()));
    const t0 = Date.now();
    await tapDir(page, legal(st).find(m => { const q = clone(st); apply(q, m); return q.turn === 1; }));
    await until(page, () => __pitch.canTap || __pitch.screen !== 'play', 'Hard replies', 20000);
    console.log(`${tag}: Hard replied in ${Date.now() - t0} ms including drawing`);
    await shot(page, tag, '3-after-hard');
    // Lose to Hard on purpose (Easy moves): the second loss in a row drops the level.
    await playMatch(page, tag, null, 0);
    const lost = await P(page, () => ({ title: document.querySelector('#endTitle').textContent, save: __pitch.save(), score: __pitch.score }));
    console.log(`${tag}: played Easy moves against Hard: ${lost.score.join('-')}, "${lost.title}", level now ${lost.save.level}`);
    if (lost.score[1] > lost.score[0]) {
      assert.equal(lost.title, 'The bot wins');
      assert.equal(lost.save.level, 1, 'two losses in a row drop Hard to Medium');
    }
    for (const id of ['#pic', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${tag}: ${id} fits on the end card`);
    await shot(page, tag, '4-end');
    await page.click('#endMenu');
    // The last daily try: one miss shows the answer in pencil.
    await page.click('#daily');
    await until(page, () => __pitch.mode === 'daily' && __pitch.canTap, 'last daily try');
    for (let i = 0; i < 40; i++) {
      await until(page, () => __pitch.canTap || __pitch.screen === 'end', 'last daily input or result');
      if (await P(page, () => __pitch.screen === 'end')) break;
      const s = restore(await P(page, () => __pitch.state()));
      const ends = m => { const q = clone(s); apply(q, m); return q.turn === 1 || (q.winner >= 0 && q.how !== 'goal'); };
      const safe = m => { const q = clone(s); apply(q, m); return q.winner < 0; };
      await tapDir(page, legal(s).find(ends) ?? legal(s).find(safe));
    }
    await until(page, () => __pitch.screen === 'end', 'three misses end on the answer card');
    assert.match(await page.textContent('#endTitle'), /Here was the way/);
    assert.equal(await page.isVisible('#again'), false, 'no Rematch on the daily card');
    for (const id of ['#pic', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${tag}: ${id} fits on the daily card`);
    await shot(page, tag, '5-daily-answer');
    assert.deepEqual(test.errors, [], 'small: no errors');
    assert.deepEqual(test.outside, [], 'small: nothing leaves the local server');
  } finally { await test.context.close(); }
}


// ---------- Turkish and the language switch

const pairs = Object.keys(tables.en).map(k => [k, tables.en[k], tables.tr[k]]);
const wordsInPage = { keys: Object.keys(tables.en), englishOnly: pairs.filter(([, en, tr]) => en !== tr).map(([, en]) => en) };
const slots = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
function checkTables() {
  const en = Object.keys(tables.en).sort(), tr = Object.keys(tables.tr).sort();
  assert.deepEqual(tr, en, 'every key in the English table exists in the Turkish table and the reverse');
  for (const k of en) {
    assert.equal(slots(tables.tr[k]), slots(tables.en[k]), `${k}: the Turkish string uses the same {variables}`);
    assert.ok(String(tables.tr[k]).trim() !== '' && String(tables.en[k]).trim() !== '', `${k}: not empty`);
  }
  console.log(`ok   words: ${en.length} keys in both tables, same variables`);
}
// Visible text, aria-labels and titles that are a raw key, or (in Turkish) an English string that has a different Turkish one.
const strayWords = (page, lang) => P(page, ({ keys, englishOnly, lang }) => {
  const seen = new Set(), bad = [];
  const visible = el => { const st = getComputedStyle(el); return st.visibility !== 'hidden' && st.display !== 'none' && el.getClientRects().length > 0; };
  const judge = (text, where) => {
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (keys.includes(text)) bad.push(`raw key "${text}" in ${where}`);
    else if (lang === 'tr' && englishOnly.includes(text)) bad.push(`English "${text}" in ${where}`);
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || seen.has(el)) continue;
    const where = el.id ? `#${el.id}` : el.tagName.toLowerCase();
    for (const n of el.childNodes) if (n.nodeType === 3) judge(n.nodeValue, where);
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) if (el.hasAttribute(a)) judge(el.getAttribute(a), `${where}[${a}]`);
  }
  return bad;
}, { ...wordsInPage, lang });
const stray = async (page, lang, label) => assert.deepEqual(await strayWords(page, lang), [], `${label}: no raw key and no stray English`);
const text = (page, sel) => page.evaluate(sel => document.querySelector(sel).textContent.replace(/\s+/g, ' ').trim(), sel);
async function fitsCard(page, label) {
  await noOverflow(page, label);
  const clipped = await P(page, () => [...document.querySelectorAll('.screen.on .card, .screen.on .card *, #turn, #roomStatus, #hud *')]
    .filter(el => el.getClientRects().length && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'hidden' && !el.matches('input, output'))
    .map(el => el.id || el.tagName.toLowerCase()));
  assert.deepEqual(clipped, [], `${label}: nothing is wider than its box`);
}
async function turkish(browser, device, phone, tag) {
  const tests = [], wire = tableWire();
  const shotTr = (page, name) => page.screenshot({ path: join(WORD_SHOTS, `${tag}-${name}.png`), timeout: 25000 });
  const TR = `${base}/lab/pitch/?date=${DATE}&lang=tr`;
  async function mk() {
    const test = await open(browser, device, true);
    tests.push(test);
    return test;
  }
  try {
    // Menu, the hint, the pause card, an end card, the daily.
    const main = await mk(), { page } = main;
    await page.goto(TR);
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'Turkish menu');
    assert.equal(await P(page, () => document.documentElement.lang), 'tr', 'the document language is Turkish');
    assert.equal(await page.title(), 'Kâğıt Futbolu');
    assert.equal(await text(page, 'h1'), 'Kâğıt Futbolu');
    assert.match(await text(page, '#menu .quiet'), /^Topu çizerek üstteki kaleye sok\./);
    assert.match(await text(page, '#play'), /^Oyna/);
    assert.equal(await text(page, '#playSub'), 'İlk maç: küçük saha, Kolay bot');
    assert.match(await text(page, '#daily'), /^Günün sahası/);
    assert.equal(await text(page, '#friend'), 'Arkadaşla oyna');
    assert.equal(await text(page, '#two'), 'İki kişi, tek telefon');
    assert.equal(await text(page, '#soundMenu'), 'Ses açık');
    assert.equal(await text(page, '#langMenu'), 'EN');
    assert.equal(await page.getAttribute('#langMenu', 'aria-label'), 'İngilizceye geç');
    assert.equal(await page.getAttribute('#c', 'aria-label'), tables.tr.canvasLabel);
    assert.ok((await page.locator('#langMenu').boundingBox()).height >= 44, 'the language button is at least 44 px tall');
    for (const id of ['#play', '#daily', '#friend', '#two', '#soundMenu', '#langMenu']) assert.ok(await visibleIn(page, id), `${tag}: ${id} fits`);
    await stray(page, 'tr', `${tag} menu`);
    await fitsCard(page, `${tag} Turkish menu`);
    await shotTr(page, '1-menu');

    // The first match: the hint, the pause card, the play screen.
    await page.click('#play');
    await until(page, () => __pitch.mode === 'bot' && __pitch.canTap, 'Turkish first match');
    assert.equal(await text(page, '#turnText'), 'Sıra sende');
    assert.equal(await text(page, '#tag'), 'Küçük saha');
    assert.equal(await text(page, '#score div:last-child small'), 'Seviye 1 bot'); // was 'Kolay bot' before the eight levels
    await shotTr(page, '2-play');
    await page.waitForSelector('.kit-hint.on .label', { timeout: 12000 }).catch(() => null);
    if (await P(page, () => !!document.querySelector('.kit-hint.on'))) {
      assert.equal(await text(page, '.kit-hint .label'), 'Gitmek istediğin noktaya dokun');
      await stray(page, 'tr', `${tag} hint`);
      await shotTr(page, '3-hint');
    } else console.log(`note: ${tag}: the first-play hint did not show in time, so its Turkish was not read`);
    await P(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await until(page, () => __pitch.paused, 'Turkish pause');
    assert.equal(await text(page, '#pauseTitle'), 'Duraklatıldı');
    assert.equal(await text(page, '#resume'), 'Devam');
    assert.equal(await text(page, '#restart'), 'Yeniden başla');
    assert.equal(await text(page, '#quit'), 'Menü');
    assert.equal(await text(page, '#langPause'), 'EN');
    assert.ok((await page.locator('#langPause').boundingBox()).height >= 44, 'the pause language button is at least 44 px tall');
    await stray(page, 'tr', `${tag} pause`);
    await fitsCard(page, `${tag} Turkish pause`);
    await shotTr(page, '4-pause');
    await P(page, () => { delete document.hidden; });
    // The switch on the pause card changes the words under it without a reload.
    await page.click('#langPause');
    assert.equal(await text(page, '#resume'), 'Resume');
    assert.equal(await text(page, '#pauseTitle'), 'Pencils down');
    assert.equal(await text(page, '#turnText'), 'Your turn');
    assert.equal(await P(page, () => document.documentElement.lang), 'en');
    await stray(page, 'en', `${tag} pause after switch`);
    await page.click('#langPause');
    assert.equal(await text(page, '#resume'), 'Devam');
    assert.equal(await text(page, '#turnText'), 'Sıra sende');
    await page.click('#resume');
    await until(page, () => __pitch.canTap || __pitch.screen !== 'play', 'play after Turkish resume');

    // Play to the end card and read the Turkish on the between and end cards.
    let shotBetween = false;
    betweenCheck = async pg => {
      assert.match(await text(pg, '#betweenTitle'), /^(Berabere|Öndesin \d–\d|Bot önde \d–\d)$/);
      assert.match(await text(pg, '#betweenLine'), /gidecek yer|Kendi kalesine atılan gol|İlk iki golü atan kazanır/);
      assert.equal(await text(pg, '#next'), 'Sıradaki santra');
      await stray(pg, 'tr', `${tag} between card`);
      await fitsCard(pg, `${tag} Turkish between card`);
      if (!shotBetween) { shotBetween = true; await shotTr(pg, '5-between'); }
    };
    try { await playMatch(page, tag, null, 1); } finally { betweenCheck = null; }
    await until(page, () => document.querySelector('#pic').naturalWidth > 0, 'Turkish picture');
    assert.match(await text(page, '#endTitle'), /^(Kazandın!|Bot kazandı)$/);
    assert.match(await text(page, '#endLine'), /^Sıradaki: (yine )?Seviye [1-8] bot\.$|^Şimdi tam boy saha, 2\. seviye bota karşı\.$|^Sıradaki: tam boy saha\.$/);
    assert.equal(await text(page, '#again'), 'Rövanş');
    assert.equal(await text(page, '#savePic'), 'Resmi kaydet');
    assert.equal(await text(page, '#endMenu'), 'Menü');
    assert.equal(await page.getAttribute('#pic', 'alt'), 'Bitmiş saha');
    for (const id of ['#endTitle', '#pic', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${tag}: ${id} fits on the Turkish end card`);
    await stray(page, 'tr', `${tag} end card`);
    await fitsCard(page, `${tag} Turkish end card`);
    await shotTr(page, '6-end');
    const download = page.waitForEvent('download', { timeout: 5000 }).then(d => d.suggestedFilename()).catch(() => null);
    await page.click('#savePic');
    const shared = await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 3000 }).then(() => 1).catch(() => 0);
    const file = shared ? null : await download;
    assert.ok(shared === 1 || file === 'kagit-futbolu.png', `Turkish Save picture shares or downloads kagit-futbolu.png (shared ${shared}, file ${file})`);
    await page.click('#endMenu');

    // The daily: Turkish date and card.
    await page.click('#daily');
    await until(page, () => __pitch.mode === 'daily' && __pitch.canTap, 'Turkish daily');
    assert.equal(await text(page, '#score div span'), 'Bugün');
    assert.equal(await text(page, '#score div small'), '24 Kas 2026');
    assert.equal(await text(page, '#turnText'), 'Bu turda gol at');
    assert.equal(await page.getAttribute('#tag .dots', 'aria-label'), 'Denemeler');
    await stray(page, 'tr', `${tag} daily`);
    await shotTr(page, '7-daily');
    const puzzle = daily(DATE);
    for (const step of puzzle.solution) await tapDir(page, step);
    await until(page, () => __pitch.screen === 'end', 'Turkish daily result');
    await until(page, () => document.querySelector('#pic').naturalWidth > 0, 'Turkish daily picture');
    assert.equal(await text(page, '#endTitle'), 'Gol oldu!');
    assert.match(await text(page, '#endLine'), /^Yeni saha \d+ saat sonra\.$/);
    await stray(page, 'tr', `${tag} daily result`);
    await fitsCard(page, `${tag} Turkish daily card`);
    await shotTr(page, '8-daily-end');
    await page.click('#endMenu');

    // Two players: Turkish colours.
    await page.click('#two');
    await until(page, () => __pitch.mode === 'two' && __pitch.canTap, 'Turkish two players');
    assert.equal(await text(page, '#turnText'), "Sıra Mavi'de");
    assert.deepEqual(await page.locator('#score small').allTextContents(), ['Mavi', 'Kırmızı']);
    await page.click('#pauseBtn');
    await page.click('#quit');
    await until(page, () => __pitch.screen === 'menu', 'menu again');

    // The switch on the menu: no reload, and the choice survives a reload.
    if (!tag.endsWith('360x640')) {
      await page.click('#langMenu');
      assert.equal(await text(page, '#play'), 'Play' + (await text(page, '#playSub')));
      assert.equal(await text(page, '#friend'), 'Play a friend');
      assert.equal(await text(page, '#langMenu'), 'TR');
      assert.equal(await page.title(), 'Paper Pitch');
      assert.equal(await P(page, () => document.documentElement.lang), 'en');
      assert.equal(await page.getAttribute('#c', 'aria-label'), tables.en.canvasLabel);
      await stray(page, 'en', `${tag} English menu after switch`);
      await page.goto(`${base}/lab/pitch/?date=${DATE}`);
      await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'English menu after reload');
      assert.equal(await text(page, '#friend'), 'Play a friend', 'English is remembered without ?lang=');
      await page.click('#langMenu');
      assert.equal(await text(page, '#friend'), 'Arkadaşla oyna');
      await page.reload();
      await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'Turkish menu after reload');
      assert.equal(await text(page, '#friend'), 'Arkadaşla oyna', 'Turkish is remembered after a reload');
      assert.equal(await P(page, () => document.documentElement.lang), 'tr');
    }

    // The friend card and the table messages, with two pages and a third turned away.
    const a = await mk(), b = await mk(), c = await mk();
    const aSocket = await wire.attach(a.page), bSocket = await wire.attach(b.page);
    await wire.attach(c.page);
    await a.page.goto(TR);
    await until(a.page, () => window.__pitch?.ready, 'host menu');
    await a.page.click('#friend');
    assert.equal(await text(a.page, '#friendTitle'), 'Arkadaşla oyna');
    assert.equal(await text(a.page, '#friendEntry label.field:first-child'), 'Adın (isteğe bağlı)');
    assert.equal(await text(a.page, '#newTable'), 'Yeni masa');
    assert.equal(await text(a.page, '#joinForm label'), 'Masa kodu');
    assert.equal(await text(a.page, '#joinTable'), 'Katıl');
    assert.equal(await text(a.page, '#roomLeave'), 'Menü');
    await stray(a.page, 'tr', `${tag} friend card`);
    await fitsCard(a.page, `${tag} Turkish friend card`);
    await shotTr(a.page, '9-friend-card');
    await a.page.fill('#friendName', 'Ada');
    await a.page.click('#newTable');
    await until(a.page, () => __pitch.room?.seat === 0 && document.querySelector('#lobbyStatus').textContent === 'Arkadaşın bekleniyor', 'Turkish waiting line');
    assert.equal(await text(a.page, '#shareLink'), 'Bağlantıyı paylaş');
    assert.equal(await a.page.getAttribute('#roomCode', 'aria-label'), 'Masa kodu');
    await stray(a.page, 'tr', `${tag} waiting card`);
    await fitsCard(a.page, `${tag} Turkish waiting card`);
    await shotTr(a.page, '10-friend-waiting');
    await a.page.click('#shareLink');
    await until(a.page, () => !!window.__sharedLink, 'Turkish share text');
    const link = await P(a.page, () => window.__sharedLink);
    assert.equal(link.text, 'Benimle Kâğıt Futbolu oyna');
    await b.page.goto(TR);
    await P(b.page, () => localStorage.setItem('pitch:v1', JSON.stringify({ name: 'Ben' })));
    await b.page.goto(`${link.url}&lang=tr`);
    await Promise.all([a, b].map(({ page: pg }, seat) => pg.waitForFunction(seat => __pitch.room?.seat === seat && __pitch.room.status === 'live' && document.querySelectorAll('#score .seat-light.on').length === 2, seat, { timeout: 25000 })));
    assert.equal(await text(a.page, '#turnText').then(x => x.startsWith('Sıra')), true, 'the table turn line is Turkish');
    await c.page.goto(`${link.url}&lang=tr`);
    await until(c.page, () => __pitch.room?.status === 'full' && document.querySelector('#lobbyStatus').textContent === 'Bu masa dolu', 'Turkish full table');
    await fitsCard(c.page, `${tag} Turkish full table`);
    await shotTr(c.page, '11-friend-full');
    await bSocket.cut();
    await until(a.page, () => document.querySelector('#roomStatus').textContent === 'Bağlantı koptu: Ben. Geri dönmesi bekleniyor.', 'Turkish dropped line');
    await until(b.page, () => document.querySelector('#roomStatus').textContent === 'Yeniden bağlanıyor', 'Turkish reconnecting line');
    assert.equal(await a.page.getAttribute('#score [data-seat="1"] .seat-light', 'aria-label'), 'Bağlı değil');
    assert.equal(await a.page.getAttribute('#score [data-seat="0"] .seat-light', 'aria-label'), 'Bağlı');
    await fitsCard(a.page, `${tag} Turkish dropped line`);
    await stray(a.page, 'tr', `${tag} dropped line`);
    await shotTr(a.page, '12-friend-dropped');
    assert.equal(await a.page.getAttribute('#pauseBtn', 'aria-label'), 'Masa menüsü');
    await a.page.click('#pauseBtn');
    assert.equal(await text(a.page, '#pauseTitle'), 'Masa menüsü');
    await a.page.click('#resume');
    bSocket.reconnect();
    await aSocket.navigateAway();
    for (const t of tests) {
      assert.deepEqual(t.outside, [], `${tag}: Turkish pages make no external requests`);
      assert.deepEqual(t.errors, [], `${tag}: Turkish pages raise no page, console or network errors`);
    }
    console.log(`ok   turkish on ${phone} ${tag}: menu, hint, pause, between and end cards, daily, switch, friend card and table lines`);
  } finally { await Promise.all(tests.map(test => test.context.close().catch(() => {}))); }
}

let failed = 0;
checkTables();
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(a => !a.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch(), test = await open(browser, device);
    try {
      if (process.argv.includes('--recording-only')) { await recording(browser, device, phone); continue; }
      if (!process.argv.includes('--friends-only')) {
        await run(test, phone); console.log(`ok   pitch on ${phone} (${device.viewport.width}x${device.viewport.height})`);
        if (phone === 'chromium') for (const [w, h] of [[360, 640], [390, 844]]) { await small(browser, w, h); console.log(`ok   pitch on chromium ${w}x${h}`); }
      }
      if (!process.argv.includes('--friends-only')) await recording(browser, device, phone);
      if (!process.argv.includes('--friends-only')) await fromSmall(browser, phone);
      await playFriend(browser, device, phone);
      if (!process.argv.includes('--friends-only')) {
        await turkish(browser, device, phone, `${phone}-${device.viewport.width}x${device.viewport.height}`);
        await turkish(browser, { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, phone, `${phone}-360x640`);
      }
    } catch (e) {
      failed++; console.error(`FAIL pitch on ${phone}: ${e.stack}`);
      if (test.errors.length) console.error(test.errors.join('\n'));
      await shot(test.page, phone, 'failure').catch(() => {});
    } finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
if (usedMouse) console.log('note: some taps fell back to mouse clicks');
console.log(`screenshots in ${SHOTS}`);
console.log(`friend screenshots in ${TABLE_SHOTS}`);
console.log(`Turkish screenshots in ${WORD_SHOTS}`);
process.exitCode = failed ? 1 : 0;
