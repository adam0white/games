// The page. Plain canvas drawing on purpose: the look comes later, the netcode is the point of this build.
// It keeps three clocks apart: its own 20-a-second input ticks (predict.js), the server's ticks as they arrive
// in snapshots, and the screen's frames. Its own ant is drawn ahead of the server from prediction; every other
// ant is drawn 150 ms behind the server, between two snapshots, so it moves smoothly whatever the network does.
import * as C from './shared/config.js';
import * as P from './shared/proto.js';
import { byteOf, angleOf } from './shared/move.js';
import { Predictor } from './shared/predict.js';

const $ = id => document.getElementById(id), canvas = $('view'), g = canvas.getContext('2d');
const COLORS = ['#e2574c', '#4c8fe2', '#5fbf6a', '#e8c84a'], TICK_MS = 1000 / C.TICK_HZ, DELAY = 3;
const agent = new URLSearchParams(location.search).get('labRunSource') === 'agent';
let ws = null, me = null, pred = null, ants = new Map(), food = new Map(), scores = null, snap = null;
let offset = null, acc = 0, last = 0, retries = 0, bytesIn = 0, kbps = 0, rtt = 0, pingAt = new Map(), nonce = 0, lastTick = 0, session = null;
let prevX = 0, prevY = 0, feedUntil = 0, playing = false;
const input = { angle: 0, move: false, sprint: false, keys: new Set(), stick: null, mouse: false };

function resize() { const d = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * d; canvas.height = innerHeight * d; }
addEventListener('resize', resize); resize();

function say(text, ms = 2500) { $('feed').textContent = text; feedUntil = performance.now() + ms; }
const nameOf = (a, b) => a === 255 ? 'the nest guards' : `${C.NAMES_A[a]} ${C.NAMES_B[b]}`;

function connect() {
  $('play').disabled = true; $('status').textContent = 'Finding a room…';
  const u = new URL('play', location.href); u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (session) { u.searchParams.set('room', session.room); u.searchParams.set('resume', session.token); }
  const s = ws = new WebSocket(u); s.binaryType = 'arraybuffer';
  heard = performance.now();
  s.onmessage = e => { if (s === ws) { heard = performance.now(); bytesIn += e.data.byteLength; receive(new P.Reader(e.data)); } };
  s.onclose = e => {
    if (s !== ws) return;
    ws = null; playing = false;
    // 4003: idle too long. Anything else is the network or a new version of the server: come back by itself.
    if (e.code !== 4003 && me && retries < 4) { say('Reconnecting…', 60000); setTimeout(connect, 400 * 2 ** retries++); return; }
    me = null; session = null; $('hud').hidden = true; $('card').hidden = false; $('play').disabled = false;
    $('status').textContent = e.code === 4003 ? 'You were away, so your place went to someone else.' : e.code === 1006 || !e.code ? 'Could not reach the game. Try again.' : `Disconnected (${e.code}).`;
  };
}

// A socket can go quiet without closing (a dead network path, or a close that never completes). The server
// sends at least ten messages a second, so five silent seconds means the socket is gone: end it and reconnect.
let heard = 0;
setInterval(() => { const s = ws; if (s && performance.now() - heard > 5000) { const end = s.onclose; try { s.close(); } catch {} end({ code: 0 }); } }, 1000);

function receive(r) {
  const type = r.u8();
  if (type === P.WELCOME) {
    me = P.readWelcome(r); session = { room: me.room, token: me.token };
    if (me.proto !== C.PROTO) { location.reload(); return; } // the server is newer than this page
    pred = new Predictor(); ants = new Map(); food = new Map(); offset = null; acc = 0; retries = 0; playing = true;
    $('card').hidden = true; $('hud').hidden = false; say(`You are ${nameOf(me.nameA, me.nameB)} of ${C.COLONY_NAMES[me.colony]}`, 3500);
  } else if (type === P.SNAP && pred) {
    const s = P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q), now = performance.now();
    pred.onSnap(s); snap = s; lastTick = s.tick;
    // Where server time is, in this page's clock. The fastest arrivals are the truest, so lean toward them.
    const est = s.tick * TICK_MS - now;
    offset = offset === null ? est : est > offset ? est : offset * 0.98 + est * 0.02;
    for (const a of ants.values()) {
      if (a.fresh) { a.buf = []; a.fresh = false; }
      a.buf.push(s.tick, a.x, a.y, a.heading); if (a.buf.length > 16) a.buf.splice(0, 4);
    }
  } else if (type === P.SCORES) { scores = P.readScores(r); hud(); }
  else if (type === P.EVENT) {
    const t = r.u8(), a = r.u8(), b = r.u8(), c = r.u8();
    if (t === 1) say(`You bit ${nameOf(a, b)}`);
    else if (t === 4) say(`Bitten by ${nameOf(a, b)}`);
    else if (t === 2) say(`${C.COLONY_NAMES[a]} wins the round`, 8000);
    else if (t === 3) say('New round');
  } else if (type === P.PONG) { const n = r.u16(), at = pingAt.get(n); if (at) { rtt = rtt ? rtt * 0.7 + (performance.now() - at) * 0.3 : performance.now() - at; pingAt.delete(n); } }
}

function hud() {
  const s = scores;
  $('colonies').replaceChildren(...s.colony.map((v, i) => { const e = document.createElement('span'); e.textContent = v; e.style.background = COLORS[i]; if (me && i === me.colony) e.className = 'mine'; return e; }));
  $('clock').textContent = (s.inBreak ? 'next round in ' : '') + `${s.left / 60 | 0}:${String(s.left % 60).padStart(2, '0')}`;
  $('top').replaceChildren(...s.top.map(t => { const e = document.createElement('li'); e.textContent = `${nameOf(t.nameA, t.nameB)}${t.bot ? ' (bot)' : ''}  ${t.score}`; e.style.color = COLORS[t.colony]; if (t.you) e.className = 'you'; return e; }));
  $('rank').textContent = snap ? `#${s.rank} of ${s.ants}  ·  ${snap.score} pts  ·  size ${snap.tier + 1}` : '';
  $('net').textContent = `${s.people} here · ${Math.round(rtt)} ms · ${kbps.toFixed(1)} kB/s${agent ? ' · agent' : ''}`;
}
setInterval(() => {
  kbps = bytesIn / 2000; bytesIn = 0;
  if (ws?.readyState === 1 && pred) { nonce = nonce + 1 & 0xffff; pingAt.set(nonce, performance.now()); ws.send(P.writePing(nonce, lastTick)); if (pingAt.size > 8) pingAt.clear(); }
}, 2000);

// Input. Touch: a stick that starts wherever the finger lands. Mouse: the ant walks toward the pointer.
const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
function readKeys() { let x = 0, y = 0; for (const k of input.keys) if (KEYS[k]) { x += KEYS[k][0]; y += KEYS[k][1]; } if (x || y) { input.angle = byteOf(Math.atan2(y, x)); input.move = true; } else if (!input.stick && !input.pointer) input.move = false; }
addEventListener('keydown', e => { if (e.code === 'Space') { input.sprint = true; e.preventDefault(); } else if (KEYS[e.code]) { input.keys.add(e.code); readKeys(); e.preventDefault(); } });
addEventListener('keyup', e => { if (e.code === 'Space') input.sprint = false; else if (KEYS[e.code]) { input.keys.delete(e.code); readKeys(); } });
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') { input.sprint = true; return; }
  if (!input.stick) { input.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') {
    const dx = e.clientX - innerWidth / 2, dy = e.clientY - innerHeight / 2;
    input.pointer = true; input.move = Math.hypot(dx, dy) > 28; if (input.move) input.angle = byteOf(Math.atan2(dy, dx));
  } else if (input.stick?.id === e.pointerId) {
    const s = input.stick; s.cx = e.clientX; s.cy = e.clientY;
    const dx = s.cx - s.x, dy = s.cy - s.y;
    input.move = Math.hypot(dx, dy) > 10; if (input.move) input.angle = byteOf(Math.atan2(dy, dx));
  }
});
const lift = e => { if (e.pointerType === 'mouse') input.sprint = false; else if (input.stick?.id === e.pointerId) { input.stick = null; input.move = false; } };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('contextmenu', e => e.preventDefault());
const sprint = $('sprint');
sprint.addEventListener('pointerdown', e => { input.sprint = true; sprint.classList.add('on'); sprint.setPointerCapture(e.pointerId); });
for (const t of ['pointerup', 'pointercancel']) sprint.addEventListener(t, () => { input.sprint = false; sprint.classList.remove('on'); });
addEventListener('blur', () => { input.keys.clear(); input.sprint = false; input.move = false; input.stick = null; });
$('play').addEventListener('click', connect);

// A first-time player who does not touch for 3 s in play sees a see-through stick with a finger using it. The shared kit
// serves it on this origin (/kit/hint.js, from the games-static site, not this Worker). Where it is not served (wrangler
// dev, or before the site has it) the import fails and the page plays on without it. reach 38: the ring drawn above.
import('/kit/hint.js')
  .then(({ hint }) => hint(canvas, {
    kind: 'stick',
    key: 'crumbwar:hint',
    reach: 38,
    when: () => playing && $('card').hidden,
  }))
  .catch(() => {});

function ant(x, y, heading, color, size, carry, alpha) {
  g.save(); g.translate(x, y); g.rotate(heading); g.globalAlpha = alpha; g.scale(size, size);
  g.strokeStyle = '#1b1410'; g.lineWidth = 1.6; g.beginPath();
  for (const lx of [-4, 1, 6]) { g.moveTo(lx, -4); g.lineTo(lx - 2, -11); g.moveTo(lx, 4); g.lineTo(lx - 2, 11); }
  g.stroke();
  g.fillStyle = color;
  g.beginPath(); g.ellipse(-8, 0, 7, 5, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(1, 0, 4, 3.4, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(8, 0, 4.4, 4, 0, 0, 7); g.fill();
  if (carry) { g.fillStyle = carry === 2 ? '#fff' : '#ecd9a4'; const s = carry === 2 ? 9 : 5; g.fillRect(12, -s / 2, s, s); }
  g.restore();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(250, now - last); last = now;
  if (playing && pred && ws?.readyState === 1) {
    acc += dt;
    while (acc >= TICK_MS) {
      acc -= TICK_MS; prevX = pred.me.x; prevY = pred.me.y;
      const out = pred.step(input.angle, input.move, input.sprint);
      if (out) ws.send(out);
      pred.ex *= 0.8; pred.ey *= 0.8; // a correction fades over a few ticks, not in one jump
    }
  }
  const W = canvas.width, H = canvas.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, W, H);
  if (!pred || !snap) return;
  // The same world on every screen: the longer side shows 1100 units, so no screen shape sees farther than VIEW.
  const k = acc / TICK_MS, mx = prevX + (pred.me.x - prevX) * k + pred.ex, my = prevY + (pred.me.y - prevY) * k + pred.ey, zoom = Math.max(W, H) / 1100;
  g.setTransform(zoom, 0, 0, zoom, W / 2 - mx * zoom, H / 2 - my * zoom);
  g.fillStyle = '#5a4736'; g.fillRect(0, 0, C.WORLD, C.WORLD);
  g.fillStyle = '#0000001c';
  const x0 = Math.max(0, Math.floor((mx - 620) / 80) * 80), y0 = Math.max(0, Math.floor((my - 620) / 80) * 80);
  for (let x = x0; x < Math.min(C.WORLD, mx + 620); x += 80) for (let y = y0; y < Math.min(C.WORLD, my + 620); y += 80) g.fillRect(x + (y / 80 % 2) * 40, y, 3, 3);
  C.NESTS.forEach(([x, y], i) => {
    g.fillStyle = COLORS[i] + '33'; g.beginPath(); g.arc(x, y, C.NEST_R, 0, 7); g.fill();
    g.fillStyle = COLORS[i] + '88'; g.beginPath(); g.arc(x, y, C.DROP_R, 0, 7); g.fill();
  });
  for (const f of food.values()) { g.fillStyle = f.kind === 2 ? '#fff' : '#ecd9a4'; const s = f.kind === 2 ? 11 : 6; g.fillRect(f.x - s / 2, f.y - s / 2, s, s); }
  const at = (now + offset) / TICK_MS - DELAY;
  g.font = '11px system-ui'; g.textAlign = 'center';
  for (const a of ants.values()) {
    const b = a.buf; let i = b.length - 4;
    while (i > 0 && b[i] > at) i -= 4;
    let x = b[i + 1], y = b[i + 2], h = b[i + 3];
    if (i + 4 < b.length && at > b[i]) {
      const t = Math.min(1, (at - b[i]) / (b[i + 4] - b[i])), dh = ((b[i + 7] - h + 128) & 255) - 128;
      x += (b[i + 5] - x) * t; y += (b[i + 6] - y) * t; h += dh * t;
    }
    ant(x, y, angleOf(h), COLORS[a.colony], 1 + a.tier * 0.18, a.carry, a.prot ? 0.5 : 1);
    g.fillStyle = '#fffc'; g.fillText(`${C.NAMES_A[a.nameA]} ${C.NAMES_B[a.nameB]}${a.bot ? ' · bot' : ''}`, x, y - 22 - a.tier * 3);
    const max = C.TIER_HP[a.tier];
    if (a.hp < max) { g.fillStyle = '#0008'; g.fillRect(x - 14, y - 19 - a.tier * 3, 28, 3); g.fillStyle = '#e2574c'; g.fillRect(x - 14, y - 19 - a.tier * 3, 28 * a.hp / max, 3); }
  }
  if (snap.alive) {
    g.strokeStyle = '#fff9'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, 20 + snap.tier * 3, 0, 7); g.stroke();
    ant(mx, my, pred.me.heading, COLORS[me.colony], 1 + snap.tier * 0.18, snap.carry, snap.prot ? 0.5 : 1);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (input.stick) { const s = input.stick, d = Math.min(2, devicePixelRatio || 1); g.strokeStyle = '#fff5'; g.lineWidth = 2 * d; g.beginPath(); g.arc(s.x * d, s.y * d, 38 * d, 0, 7); g.stroke(); g.fillStyle = '#fff5'; g.beginPath(); g.arc(s.cx * d, s.cy * d, 14 * d, 0, 7); g.fill(); }
  // A map of the field: nests and yourself only. The server never sends what is outside your square.
  const m = Math.min(W, H) * 0.16, ox = W - m - 12, oy = H - m - 12 - (matchMedia('(hover: hover) and (pointer: fine)').matches ? 0 : 110 * Math.min(2, devicePixelRatio || 1));
  g.fillStyle = '#0005'; g.fillRect(ox, oy, m, m);
  C.NESTS.forEach(([x, y], i) => { g.fillStyle = COLORS[i]; g.beginPath(); g.arc(ox + x / C.WORLD * m, oy + y / C.WORLD * m, m * 0.05, 0, 7); g.fill(); });
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + mx / C.WORLD * m, oy + my / C.WORLD * m, m * 0.03, 0, 7); g.fill();
  $('hp').style.transform = `scaleX(${Math.max(0, snap.hp) / C.TIER_HP[snap.tier]})`; $('stamina').style.transform = `scaleX(${pred.me.stamina / C.STAMINA})`;
  if (!snap.alive) $('feed').textContent = `${$('feed').textContent.split('\n')[0]}\nBack in ${Math.ceil(snap.respawn / C.TICK_HZ)}`;
  else if (now > feedUntil) $('feed').textContent = '';
  else if ($('feed').textContent.includes('\nBack in')) $('feed').textContent = $('feed').textContent.split('\n')[0];
}
requestAnimationFrame(frame);
// For automated checks and the load test's browser probe: read-only numbers, nothing that can steer the game.
window.crumbwar = { get state() { return { playing, me, x: pred?.me.x, y: pred?.me.y, ants: ants.size, food: food.size, rtt, kbps, corrected: pred?.corrected, replayed: pred?.replayed, scores, alive: snap?.alive, tick: lastTick }; } };
