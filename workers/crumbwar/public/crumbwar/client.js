// The page. Plain canvas drawing on purpose: the look comes later, the netcode is the point of this build.
// It keeps three clocks apart: its own 20-a-second input ticks (predict.js), the server's ticks as they arrive
// in snapshots, and the screen's frames. Its own ant is drawn ahead of the server from prediction; every other
// ant is drawn 150 ms behind the server, between two snapshots, so it moves smoothly whatever the network does.
import * as C from './shared/config.js';
import * as P from './shared/proto.js';
import { byteOf, angleOf } from './shared/move.js';
import { Predictor } from './shared/predict.js';
import { UPDATE_CODE, mayReload } from './shared/version.js';

const $ = id => document.getElementById(id), canvas = $('view'), g = canvas.getContext('2d');
const COLORS = ['#e2574c', '#4c8fe2', '#5fbf6a', '#e8c84a'], TICK_MS = 1000 / C.TICK_HZ, DELAY = 3;
const agent = new URLSearchParams(location.search).get('labRunSource') === 'agent';
let ws = null, me = null, pred = null, ants = new Map(), food = new Map(), scores = null, snap = null;
let offset = null, acc = 0, last = 0, retries = 0, bytesIn = 0, kbps = 0, rtt = 0, pingAt = new Map(), nonce = 0, lastTick = 0, session = null;
let prevX = 0, prevY = 0, joined = false, feedUntil = 0, playing = false, avoid = '', avoided = 0;
const input = { angle: 0, move: false, sprint: false, keys: new Set(), stick: null, mouse: false };

function resize() { const d = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * d; canvas.height = innerHeight * d; }
addEventListener('resize', resize); resize();

function say(text, ms = 2500) { $('feed').textContent = text; feedUntil = performance.now() + ms; }
const nameOf = (a, b) => a === 255 ? 'the nest guards' : `${C.NAMES_A[a]} ${C.NAMES_B[b]}`;

function connect() {
  $('play').disabled = true; $('status').textContent = 'Finding a room…';
  const u = new URL('play', location.href); u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('v', C.PROTO); // the Worker tells a page of another version to reload (UPDATE_CODE)
  if (avoid) u.searchParams.set('avoid', avoid);
  if (session) { u.searchParams.set('room', session.room); u.searchParams.set('resume', session.token); }
  const s = ws = new WebSocket(u); s.binaryType = 'arraybuffer';
  heard = performance.now();
  s.onmessage = e => { if (s === ws) { heard = performance.now(); bytesIn += e.data.byteLength; receive(new P.Reader(e.data)); } };
  s.onclose = e => {
    if (s !== ws) return;
    ws = null; playing = false;
    if (e.code === UPDATE_CODE) return updated();
    // 4003: idle too long. Anything else is the network or a new version of the server: come back by itself.
    if (e.code !== 4003 && me && retries < 4) { say('Reconnecting…', 60000); setTimeout(connect, 400 * 2 ** retries++); return; }
    record.end(e.code === 4003 ? 'idle' : 'lost-connection');
    me = null; session = null; $('hud').hidden = true; $('card').hidden = false; $('play').disabled = false;
    $('status').textContent = e.code === 4003 ? 'You were away, so your place went to someone else.' : e.code === 1006 || !e.code ? 'Could not reach the game. Try again.' : `Disconnected (${e.code}).`;
  };
}

// The server runs another version of the game than this page. Reload once to fetch the page it serves. A second
// ask within a minute means the reload did not help (a cache, or two versions served at once): say so and stop.
function updated() {
  ws = null; playing = false; record.end('lost-connection');
  me = null; session = null; $('hud').hidden = true; $('card').hidden = false;
  let store = null; try { store = sessionStorage; } catch {}
  if (mayReload(store, Date.now())) { $('play').disabled = true; $('status').textContent = 'Game updated, reloading…'; location.reload(); return; }
  $('play').disabled = false; $('status').textContent = 'The game was updated. Reload the page to play.';
}

// A socket can go quiet without closing (a dead network path, or a close that never completes). The server
// sends at least ten messages a second, so five silent seconds means the socket is gone: end it and reconnect.
let heard = 0;
setInterval(() => { const s = ws; if (s && performance.now() - heard > 5000) { const end = s.onclose; try { s.close(); } catch {} end({ code: 0 }); } }, 1000);

function receive(r) {
  const type = r.u8();
  if (type === P.WELCOME) {
    const hello = P.readWelcome(r);
    // The Worker already checked that this page is its version, so a room of another protocol is old code still
    // running after a deploy (from before rooms refused such joins). Leave it and ask for another room, twice at most.
    if (hello.proto !== C.PROTO) {
      const s = ws; ws = null; try { s.close(); } catch {}
      if (avoided++ < 2) { avoid = hello.room; session = null; connect(); } else updated();
      return;
    }
    me = hello; session = { room: me.room, token: me.token }; avoided = 0;
    pred = new Predictor(); ants = new Map(); food = new Map(); offset = null; acc = 0; retries = 0; playing = true; snap = null; joined = true;
    record.joined(); $('card').hidden = true; $('hud').hidden = false; say(`You are ${nameOf(me.nameA, me.nameB)} of ${C.COLONY_NAMES[me.colony]}`, 3500);
  } else if (type === P.SNAP && pred) {
    const s = P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q), now = performance.now();
    record.snap(s, snap); pred.onSnap(s); snap = s; lastTick = s.tick;
    if (joined) { prevX = pred.me.x; prevY = pred.me.y; joined = false; } // first snapshot: no blend from a stale position
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
    if (t === 1) { say(`You bit ${nameOf(a, b)}`); record.kill(); }
    else if (t === 4) { say(`Bitten by ${nameOf(a, b)}`); record.death(); }
    else if (t === 2) { say(`${C.COLONY_NAMES[a]} wins the round`, 8000); record.end('round', a === me?.colony ? 1 : 0); }
    else if (t === 3) { say('New round'); record.round(); }
  } else if (type === P.PONG) { const n = r.u16(), at = pingAt.get(n); if (at) { rtt = rtt ? rtt * 0.7 + (performance.now() - at) * 0.3 : performance.now() - at; pingAt.delete(n); record.rtt(performance.now() - at); } }
}

function hud() {
  const s = scores;
  $('colonies').replaceChildren(...s.colony.map((v, i) => { const e = document.createElement('span'); e.textContent = v; e.style.background = COLORS[i]; if (me && i === me.colony) e.className = 'mine'; return e; }));
  $('clock').textContent = (s.inBreak ? 'next round in ' : '') + `${s.left / 60 | 0}:${String(s.left % 60).padStart(2, '0')}`;
  $('top').replaceChildren(...s.top.map(t => { const e = document.createElement('li'); e.textContent = `${nameOf(t.nameA, t.nameB)}${t.bot ? ' (bot)' : ''}  ${t.score}`; e.style.color = COLORS[t.colony]; if (t.you) e.className = 'you'; return e; }));
  $('rank').textContent = snap ? `#${s.rank} of ${s.ants}  ·  ${snap.score} pts  ·  size ${snap.tier + 1}` : '';
  $('net').textContent = `${s.people} human${s.people === 1 ? '' : 's'} · ${s.ants - s.people} bots · ${Math.round(rtt)} ms · ${kbps.toFixed(1)} kB/s${agent ? ' · agent' : ''}`;
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
$('play').addEventListener('click', () => { record.armed = record.noticed(); connect(); });

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

// Play recording for the game lab, through the shared kit (/kit/lab.js, served by the games-static site on this
// origin; not served under wrangler dev, where the import fails and nothing is recorded). One record per round or
// per visit, whichever ends first. A record holds numbers only: no room, no ant name, no free text.
// A record starts only if the notice was on the card when Play was pressed.
let rec = null;
import('/kit/lab.js')
  .then(({ lab }) => {
    const r = lab('crumbwar'), box = $('lab'), p = r.notice(box);
    // The kit's notice points to a pause menu; this game has none, so it points to the switch under it.
    const t = p?.firstChild; if (t?.nodeType === 3) t.textContent = t.textContent.replace('in the pause menu', 'with the switch below');
    r.toggle(box); rec = r;
  })
  .catch(() => {});
const median = v => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b), h = s.length >> 1; return Math.round(s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2); };
const record = {
  armed: false, run: null,
  noticed() { return !!rec && !$('card').hidden && !!$('lab').querySelector('.lab-notice'); },
  begin(fresh) {
    if (!rec || !this.armed || !me || document.visibilityState === 'hidden') return;
    this.run = { at: performance.now(), token: me.token, score: 0, food: 0, trips: 0, kills: 0, deaths: 0, tier: 0, rtts: [], reconnects: 0 };
    rec.start({ colony: me.colony, roundStart: fresh ? 1 : 0 });
  },
  joined() {
    // A resume (same token) carries on the open record and counts a reconnect; a new ant starts a new record.
    if (this.run && this.run.token === me.token) { this.run.reconnects++; return; }
    if (this.run) this.end('lost-connection');
    this.begin(false);
  },
  round() { this.end('round'); this.begin(true); },
  snap(s, before) {
    const r = this.run; if (!r) return;
    if (before && before.carry && !s.carry && s.alive && s.score >= before.score + C.FOOD_VALUE[before.carry]) { r.food += C.FOOD_VALUE[before.carry]; r.trips++; }
    if (s.tier > r.tier) { r.tier = s.tier; rec.event('tier', { tier: s.tier + 1 }); }
    r.score = s.score;
  },
  kill() { if (this.run) this.run.kills++; },
  death() { if (!this.run) return; this.run.deaths++; rec.event('death', { tier: (snap?.tier ?? 0) + 1 }); },
  rtt(ms) { const r = this.run; if (r && r.rtts.length < 2000) r.rtts.push(ms); },
  end(outcome, won) {
    const r = this.run; if (!r) return; this.run = null;
    const summary = { seconds: Math.round((performance.now() - r.at) / 1000), score: r.score, food: r.food, trips: r.trips, kills: r.kills, deaths: r.deaths,
      tier: r.tier + 1, people: scores?.people ?? 0, ants: scores?.ants ?? 0, rttMedianMs: median(r.rtts), reconnects: r.reconnects };
    if (won !== undefined) summary.won = won;
    rec.end(outcome, summary);
  },
};
// A record ended as the page unloads (a closed tab, a navigation) did not arrive in a headless Chromium test; the
// cause is not confirmed (the kit compresses before it sends). A phone that switches app hides the page but keeps it running, so the record is ended
// there, when the send still completes; coming back to a game still in play starts a new record.
addEventListener('pagehide', () => record.end('left'));
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') record.end('left');
  else if (playing && me && !record.run && !scores?.inBreak) record.begin(false);
});

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
  // Names are 11 screen pixels high whatever the zoom, so they stay readable on a phone.
  const px = Math.min(2, devicePixelRatio || 1) / zoom;
  g.font = `${11 * px}px system-ui`; g.textAlign = 'center';
  const labels = [];
  for (const a of ants.values()) {
    const b = a.buf; let i = b.length - 4;
    while (i > 0 && b[i] > at) i -= 4;
    let x = b[i + 1], y = b[i + 2], h = b[i + 3];
    if (i + 4 < b.length && at > b[i]) {
      const t = Math.min(1, (at - b[i]) / (b[i + 4] - b[i])), dh = ((b[i + 7] - h + 128) & 255) - 128;
      x += (b[i + 5] - x) * t; y += (b[i + 6] - y) * t; h += dh * t;
    }
    ant(x, y, angleOf(h), COLORS[a.colony], 1 + a.tier * 0.18, a.carry, a.prot ? 0.5 : 1);
    labels.push({ x, y: y - 22 - a.tier * 3, d: (x - mx) ** 2 + (y - my) ** 2, text: `${C.NAMES_A[a.nameA]} ${C.NAMES_B[a.nameB]}${a.bot ? ' · bot' : ''}`, bot: a.bot, more: 0, bots: 0 });
    const max = C.TIER_HP[a.tier];
    if (a.hp < max) { g.fillStyle = '#0008'; g.fillRect(x - 14, y - 19 - a.tier * 3, 28, 3); g.fillStyle = '#e2574c'; g.fillRect(x - 14, y - 19 - a.tier * 3, 28 * a.hp / max, 3); }
  }
  // A crowd's names would print on top of each other. Nearest first: a name that would overlap one already
  // placed is not drawn, and that one says how many more ants stand there and how many of them are bots.
  labels.sort((p, q) => p.d - q.d);
  const placed = [];
  for (const l of labels) {
    const w = g.measureText(l.text).width / 2 + 3 * px, hit = placed.find(p => Math.abs(p.x - l.x) < p.w + w && Math.abs(p.y - l.y) < 13 * px);
    if (hit) { hit.more++; if (l.bot) hit.bots++; } else { l.w = w; placed.push(l); }
  }
  g.fillStyle = '#fffc';
  for (const l of placed) g.fillText(l.more ? `${l.text} +${l.more}${l.bots === l.more ? ' bot' + (l.more > 1 ? 's' : '') : l.bots ? ` (${l.bots} bot${l.bots > 1 ? 's' : ''})` : ''}` : l.text, l.x, l.y);
  if (snap.alive) {
    g.strokeStyle = '#fff9'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, 20 + snap.tier * 3, 0, 7); g.stroke();
    ant(mx, my, pred.me.heading, COLORS[me.colony], 1 + snap.tier * 0.18, snap.carry, snap.prot ? 0.5 : 1);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Point toward the food patch even before it enters the view.
  const dx = C.WORLD / 2 - mx, dy = C.WORLD / 2 - my, distance = Math.hypot(dx, dy);
  const onScreen = Math.abs(dx * zoom) < W * 0.4 && Math.abs(dy * zoom) < H * 0.4;
  if (distance > 300 && !onScreen && !scores?.inBreak) {
    const d = Math.min(2, devicePixelRatio || 1), heading = Math.atan2(dy, dx);
    const reach = Math.min(W, H) * 0.28, ax = W / 2 + Math.cos(heading) * reach, ay = H / 2 + Math.sin(heading) * reach;
    g.save(); g.translate(ax, ay); g.rotate(heading); g.fillStyle = '#ecd9a4';
    g.beginPath(); g.moveTo(16 * d, 0); g.lineTo(-8 * d, -9 * d); g.lineTo(-8 * d, 9 * d); g.closePath(); g.fill(); g.restore();
    g.font = `600 ${13 * d}px system-ui`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 3 * d; g.strokeStyle = '#000a'; g.fillStyle = '#fff';
    const label = `Food in the middle · ${Math.round(distance)}`;
    g.strokeText(label, W / 2, H / 2 + 65 * d); g.fillText(label, W / 2, H / 2 + 65 * d);
  }
  if (input.stick) { const s = input.stick, d = Math.min(2, devicePixelRatio || 1); g.strokeStyle = '#fff5'; g.lineWidth = 2 * d; g.beginPath(); g.arc(s.x * d, s.y * d, 38 * d, 0, 7); g.stroke(); g.fillStyle = '#fff5'; g.beginPath(); g.arc(s.cx * d, s.cy * d, 14 * d, 0, 7); g.fill(); }
  // A map of the field: nests, the public food patch and yourself.
  const m = Math.min(W, H) * 0.16, ox = W - m - 12, oy = H - m - 12 - (matchMedia('(hover: hover) and (pointer: fine)').matches ? 0 : 110 * Math.min(2, devicePixelRatio || 1));
  g.fillStyle = '#0005'; g.fillRect(ox, oy, m, m);
  C.NESTS.forEach(([x, y], i) => { g.fillStyle = COLORS[i]; g.beginPath(); g.arc(ox + x / C.WORLD * m, oy + y / C.WORLD * m, m * 0.05, 0, 7); g.fill(); });
  g.fillStyle = '#ecd9a4'; const fm = Math.max(4, m * 0.06); g.fillRect(ox + m / 2 - fm / 2, oy + m / 2 - fm / 2, fm, fm);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + mx / C.WORLD * m, oy + my / C.WORLD * m, m * 0.03, 0, 7); g.fill();
  $('hp').style.transform = `scaleX(${Math.max(0, snap.hp) / C.TIER_HP[snap.tier]})`; $('stamina').style.transform = `scaleX(${pred.me.stamina / C.STAMINA})`;
  if (!snap.alive) $('feed').textContent = `${$('feed').textContent.split('\n')[0]}\nBack in ${Math.ceil(snap.respawn / C.TICK_HZ)}`;
  else if (now > feedUntil) $('feed').textContent = '';
  else if ($('feed').textContent.includes('\nBack in')) $('feed').textContent = $('feed').textContent.split('\n')[0];
}
requestAnimationFrame(frame);
// For automated checks and the load test's browser probe: read-only numbers, nothing that can steer the game.
window.crumbwar = { get state() { return { playing, me, x: pred?.me.x, y: pred?.me.y, ants: ants.size, food: food.size, rtt, kbps, corrected: pred?.corrected, replayed: pred?.replayed, scores, alive: snap?.alive, carry: snap?.carry, score: snap?.score, tier: snap?.tier, tick: lastTick }; } };
