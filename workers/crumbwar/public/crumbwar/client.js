// The page. Plain canvas drawing on purpose: the look comes later, the netcode is the point of this build.
// It keeps three clocks apart: its own 20-a-second input ticks (predict.js), the server's ticks as they arrive
// in snapshots, and the screen's frames. Its own ant is drawn ahead of the server from prediction; every other
// ant is drawn 150 ms behind the server, between two snapshots, so it moves smoothly whatever the network does.
import * as C from '/crumbwar/shared/config.js';
import { getMode, RANKS, RANK_AT, rankOf, GRASS, inGrass } from '/crumbwar/shared/modes.js';
import * as P from '/crumbwar/shared/proto.js';
import { byteOf, angleOf } from '/crumbwar/shared/move.js';
import { Predictor } from '/crumbwar/shared/predict.js';
import { UPDATE_CODE, mayReload } from '/crumbwar/shared/version.js';

const $ = id => document.getElementById(id), canvas = $('view'), g = canvas.getContext('2d');
const COLORS = ['#e2574c', '#4c8fe2', '#5fbf6a', '#e8c84a'], TICK_MS = 1000 / C.TICK_HZ, DELAY = 3;
const mode = getMode(location.pathname.split('/')[2] || 'classic');
document.body.dataset.mode = mode.name;
for (const a of document.querySelectorAll('[data-mode-link]')) if (a.dataset.modeLink === mode.name) a.setAttribute('aria-current', 'page');
const agent = new URLSearchParams(location.search).get('labRunSource') === 'agent';
let ws = null, me = null, pred = null, ants = new Map(), food = new Map(), scores = null, snap = null;
let offset = null, acc = 0, last = 0, retries = 0, bytesIn = 0, kbps = 0, rtt = 0, pingAt = new Map(), nonce = 0, lastTick = 0, session = null;
let prevX = 0, prevY = 0, joined = false, feedUntil = 0, playing = false, avoid = '', avoided = 0;
const feast = mode.name === 'feast', rush = mode.name === 'rush';
const GOALS = ['Deliver 3 crumbs', 'Hold hill 5 seconds', 'Grab the golden crumb', 'Bite a carrier'];
const GOAL_NEED = [3, 5, 1, 1];
const sizeOf = mass => Math.min(3.6, Math.sqrt(Math.max(10, mass ?? 10) / 10));
const input = { angle: 0, move: false, sprint: false, keys: new Set(), stick: null, mouse: false };

function resize() { const d = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * d; canvas.height = innerHeight * d; }
addEventListener('resize', resize); resize();

// kind: '' for a plain line, 'event' for something on the field, 'good' for the player's own success. Each new line
// pops in (a CSS animation restarted by toggling the class), so a change is noticed without reading.
function say(text, ms = 2500, kind = '') {
  const e = $('feed'); e.textContent = text; feedUntil = performance.now() + ms;
  e.className = ''; void e.offsetWidth; e.className = 'pop' + (kind ? ' ' + kind : '');
}
// Short effects over the world: rings and bursts at the player's ant, and points that fly to the score. Each ends by itself.
const fx = [];
function effect(kind, o) { fx.push({ kind, t0: performance.now(), dur: 700, ...o }); if (fx.length > 30) fx.shift(); }
function points(n) {
  const f = fx.findLast(f => f.kind === 'points' && performance.now() - f.t0 < 300);
  if (f) { f.n += n; f.t0 = performance.now(); } else effect('points', { n, dur: 1000 });
}
let peakRank = 0, hillPulse = -1e9, hudBottom = 0, selfTop = 1e9, lastFeature = null, lastLeft = -1, respawnAs = '';
const nameOf = (a, b) => a === 255 ? 'the nest guards' : `${C.NAMES_A[a]} ${C.NAMES_B[b]}`;

function connect() {
  $('play').disabled = true; $('status').textContent = 'Finding a room…';
  const u = new URL('/crumbwar/play', location.href); u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('mode', mode.name);
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
    if (hello.proto !== C.PROTO || (hello.mode ?? 0) !== mode.id) {
      const s = ws; ws = null; try { s.close(); } catch {}
      if (avoided++ < 2) { avoid = hello.room; session = null; connect(); } else updated();
      return;
    }
    me = hello; session = { room: me.room, token: me.token }; avoided = 0;
    pred = new Predictor(mode.name); ants = new Map(); food = new Map(); offset = null; acc = 0; retries = 0; playing = true; snap = null; joined = true;
    record.joined(); $('card').hidden = true; $('hud').hidden = false; say(feast ? '+ you can eat · ! can eat you · ◇ safe' : `You are ${nameOf(me.nameA, me.nameB)} of ${C.COLONY_NAMES[me.colony]}`, 3500);
  } else if (type === P.SNAP && pred) {
    const s = P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q), now = performance.now();
    if (snap && s.alive && snap.alive) {
      const gain = feast ? Math.floor(s.mass) - Math.floor(snap.mass) : s.score - snap.score;
      if (gain > 0) points(gain);
      if (rush && gain > 0 && !snap.carry === !s.carry && Math.hypot(s.x - 1600, s.y - 1600) < mode.hillRadius) hillPulse = now;
    }
    if (rush && snap && s.goal !== snap.goal && s.score - snap.score >= 5) { say(`Goal done · +${s.score - snap.score} · next: ${GOALS[s.goal ?? 0]}`, 3000, 'good'); effect('ring', { r1: 120, color: '#ffd549', dur: 800 }); }
    else if (rush && snap && s.goal !== snap.goal && s.score >= snap.score) say(`New goal · ${GOALS[s.goal ?? 0]}`, 2500, 'event');
    if (rush && snap && s.boostLeft && !snap.boostLeft) say('↑ Speed for 6 seconds', 1800, 'good');
    if (rush && snap && s.shieldLeft && !snap.shieldLeft) say('◇ Shield for 6 seconds · bites miss you', 1800, 'good');
    // A promotion is announced once per climb: shrinking back under a threshold and growing over it again is not news.
    if (feast && snap && s.rank > peakRank && s.alive) { say(`Promoted · ${RANKS[s.rank]}${s.rank === 5 ? ' · you leave crumbs' : ''}`, 3000, 'good'); effect('ring', { r1: 190, color: '#a6e38b', dur: 1000, width: 7 }); effect('ring', { r1: 120, color: '#fff', dur: 700, width: 3 }); }
    if (feast && s.alive) peakRank = Math.max(peakRank, s.rank ?? 0);
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
    if (t === 1) { say(`${feast ? 'You ate' : 'You bit'} ${nameOf(a, b)}`, 2000, 'good'); effect('burst', { color: feast ? '#78e9ed' : '#fff', dur: 550 }); effect('ring', { r1: 70, color: feast ? '#78e9ed' : '#fff', dur: 450 }); record.kill(); }
    else if (t === 4) {
      // Feast: say what the player keeps, in the rank words they see, so being eaten reads as a setback, not a reset.
      const kept = Math.max(10, (snap?.mass ?? 10) * (mode.retain ?? 1));
      peakRank = rankOf(kept);
      respawnAs = feast ? ` as ${RANKS[rankOf(kept)]} · size ${Math.floor(kept)}` : '';
      say(`${feast ? 'Eaten by' : 'Bitten by'} ${nameOf(a, b)}`, 3000);
      record.death();
    }
    else if (t === 2) { if (feast || rush) say(''); else say(`${C.COLONY_NAMES[a]} wins the round`, 8000); record.end('round', feast ? a === me?.id ? 1 : 0 : a === me?.colony ? 1 : 0); }
    else if (t === 3) { say('New round', 2500, 'event'); peakRank = 0; record.round(); }
  } else if (type === P.PONG) { const n = r.u16(), at = pingAt.get(n); if (at) { rtt = rtt ? rtt * 0.7 + (performance.now() - at) * 0.3 : performance.now() - at; pingAt.delete(n); record.rtt(performance.now() - at); } }
}

function hud() {
  const s = scores;
  $('colonies').hidden = feast;
  $('colonies').replaceChildren(...s.colony.map((v, i) => { const e = document.createElement('span'); e.textContent = v; e.style.background = COLORS[i]; if (me && i === me.colony) e.className = 'mine'; return e; }));
  $('clock').textContent = `${mode.name.toUpperCase()} · ` + (s.inBreak ? 'next round in ' : '') + `${s.left / 60 | 0}:${String(s.left % 60).padStart(2, '0')}`;
  $('top').replaceChildren(...s.top.map(t => { const e = document.createElement('li'); e.textContent = `${nameOf(t.nameA, t.nameB)}${t.bot ? ' (bot)' : ''}  ${t.score}`; e.style.color = feast ? '#a6e38b' : COLORS[t.colony]; if (t.you) e.className = 'you'; return e; }));
  $('rank').textContent = feast && snap ? `#${s.rank} of ${s.ants} · ${RANKS[snap.rank ?? rankOf(snap.mass)]} · ${Math.floor(snap.mass ?? 10)}` : snap ? `#${s.rank} of ${s.ants}  ·  ${snap.score} pts  ·  size ${snap.tier + 1}` : '';
  document.body.classList.toggle('frenzy', rush && !s.inBreak && s.left <= 20);
  $('goal').hidden = !rush || s.inBreak;
  if (rush && snap) $('goal').textContent = `${GOALS[snap.goal ?? 0]} · ${Math.min(GOAL_NEED[snap.goal ?? 0], snap.goal === 1 ? Math.floor((snap.goalProgress ?? 0) / C.TICK_HZ) : snap.goalProgress ?? 0)}/${GOAL_NEED[snap.goal ?? 0]}${snap.boostLeft ? ' · ↑ speed' : ''}${snap.shieldLeft ? ' · ◇ shield' : ''}`;
  if (rush && !s.inBreak && s.left <= 20) $('clock').textContent = 'FRENZY ×2 · ' + $('clock').textContent;
  // Timed moments, read from the round clock the page already has: announce them once, as they happen.
  if (s.left !== lastLeft && lastLeft >= 0 && !s.inBreak && snap) {
    const age = mode.roundSeconds - s.left;
    if (rush && s.left === 20) say('FRENZY · everything pays double', 3000, 'event');
    else if (rush && s.feature?.kind === 2 && (!lastFeature || lastFeature.kind !== 2 || lastFeature.x !== s.feature.x)) say('Golden crumb in the middle · 5 points', 2500, 'event');
    else if (rush && age > 2 && age % 12 === 0) say('Seeds dropped · ↑ speed  ◇ shield', 2000, 'event');
    else if (feast && s.feature?.kind === 3 && lastFeature?.kind !== 3) say('Cake! · stay on it 3 s to eat', 2500, 'event');
    else if (feast && s.feature && lastFeature && s.feature.x !== lastFeature.x) say('Fresh crumbs', 1600, 'event');
  }
  const final = !s.inBreak && s.left <= 10 && s.left > 0;
  const clock = $('clock'); clock.classList.toggle('final', final);
  if (final && s.left !== lastLeft) { clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick'); }
  lastLeft = s.left; lastFeature = s.feature ?? null;
  hudBottom = Math.max(...['top', 'net', 'goal', 'clock'].map(id => { const e = $(id); return e.hidden || !e.textContent ? 0 : e.getBoundingClientRect().bottom; }));
  selfTop = $('self').getBoundingClientRect().top || 1e9;
  $('summary').hidden = !s.inBreak || (!feast && !rush);
  // The break is the results screen: who won, the player's own numbers, and (Rush) the two awards.
  $('summary').className = 'results';
  if (s.inBreak && feast) {
    const w = s.top[0], win = w ? (w.you ? `Biggest · you · ${w.score}` : `Biggest · ${nameOf(w.nameA, w.nameB)}${w.bot ? ' (bot)' : ''} · ${w.score}`) : 'Round over';
    $('summary').textContent = `${win}\nYour best rank · ${RANKS[s.bestRank ?? snap?.bestRank ?? 0]}\nYou ate ${s.kills ?? 0} ant${s.kills === 1 ? '' : 's'} · eaten ${s.deaths ?? 0} time${s.deaths === 1 ? '' : 's'}`;
  }
  if (s.inBreak && rush) {
    const awards = s.awards ?? [], order = s.colony.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]);
    const you = a => me && a.nameA === me.nameA && a.nameB === me.nameB ? 'you' : nameOf(a.nameA, a.nameB);
    const award = (label, a) => a ? `\n${label} · ${a.count ? `${you(a)} · ${a.count}` : 'nobody'}` : '';
    $('summary').textContent = `${C.COLONY_NAMES[order[0][1]]} wins · ${order[0][0]} to ${order[1][0]}${me && order[0][1] === me.colony ? ' · your colony!' : ''}` +
      `\nYou: ${s.delivered ?? 0} delivered · ${s.kills ?? 0} kills · ${s.deaths ?? 0} deaths` + award('Most deliveries', awards[0]) + award('Best biter', awards[1]);
  }
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
  noticed() {
    const card = $('card'), notice = $('lab').querySelector('.lab-notice');
    if (!rec || card.hidden || !notice) return false;
    const n = notice.getBoundingClientRect(), c = card.getBoundingClientRect();
    return n.height > 0 && n.top >= Math.max(0, c.top) && n.bottom <= Math.min(innerHeight, c.bottom);
  },
  begin(fresh) {
    if (!rec || !this.armed || !me || document.visibilityState === 'hidden') return;
    this.run = { at: performance.now(), token: me.token, score: 0, food: 0, trips: 0, kills: 0, deaths: 0, tier: 0, rtts: [], reconnects: 0 };
    rec.start({ mode: mode.id, colony: me.colony, roundStart: fresh ? 1 : 0 });
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
    const tier = feast ? s.rank ?? 0 : s.tier;
    if (tier > r.tier) { r.tier = tier; rec.event('tier', { tier: tier + 1 }); }
    r.score = s.score;
  },
  kill() { if (this.run) this.run.kills++; },
  death() { if (!this.run) return; this.run.deaths++; rec.event('death', { tier: (feast ? snap?.rank ?? 0 : snap?.tier ?? 0) + 1 }); },
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
  if (carry) { g.fillStyle = carry === 2 ? rush ? '#ffd549' : '#fff' : '#ecd9a4'; const s = carry === 2 ? 9 : 5; g.fillRect(12, -s / 2, s, s); }
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
  // One CSS pixel in world units: text drawn in the world uses it so it keeps its screen size at every zoom.
  const px = Math.min(2, devicePixelRatio || 1) / zoom;
  g.setTransform(zoom, 0, 0, zoom, W / 2 - mx * zoom, H / 2 - my * zoom);
  g.fillStyle = '#5a4736'; g.fillRect(0, 0, C.WORLD, C.WORLD);
  g.fillStyle = '#0000001c';
  const x0 = Math.max(0, Math.floor((mx - 620) / 80) * 80), y0 = Math.max(0, Math.floor((my - 620) / 80) * 80);
  for (let x = x0; x < Math.min(C.WORLD, mx + 620); x += 80) for (let y = y0; y < Math.min(C.WORLD, my + 620); y += 80) g.fillRect(x + (y / 80 % 2) * 40, y, 3, 3);
  if (!feast) C.NESTS.forEach(([x, y], i) => {
    g.fillStyle = COLORS[i] + '33'; g.beginPath(); g.arc(x, y, C.NEST_R, 0, 7); g.fill();
    g.fillStyle = COLORS[i] + '88'; g.beginPath(); g.arc(x, y, C.DROP_R, 0, 7); g.fill();
  });
  if (rush) {
    g.fillStyle = scores && !scores.inBreak && scores.left <= 20 ? '#ffae4933' : '#ffb06d18';
    const pulse = 1 + 0.5 * Math.max(0, 1 - ((now - hillPulse) / 600));
    g.strokeStyle = '#ffb06d'; g.lineWidth = 3 * pulse; g.setLineDash([18, 10]); g.beginPath(); g.arc(1600, 1600, 140, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffdbb5'; g.font = `bold ${13 * px}px system-ui`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 3 * px; g.strokeStyle = '#000a';
    g.strokeText('HILL · hold it to score', 1600, 1600 - 140 - 8 * px); g.fillText('HILL · hold it to score', 1600, 1600 - 140 - 8 * px);
  }
  if (feast) for (const [x, y, r] of GRASS) {
    g.fillStyle = '#467049'; g.strokeStyle = '#b3e2a8'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip(); g.strokeStyle = '#a6e38b44';
    for (let off = -r; off < r; off += 16) { g.beginPath(); g.moveTo(x + off, y - r); g.lineTo(x + off + r, y + r); g.stroke(); }
    g.restore(); g.fillStyle = '#fff'; g.font = `bold ${15 * px}px system-ui`; g.textAlign = 'center'; g.fillText('◇ safe', x, y + 5 * px);
  }
  for (const f of food.values()) {
    if (rush && f.kind >= 3) {
      const shield = f.kind === 4, r = Math.max(12, 9 * px); g.fillStyle = shield ? '#a9e4ff' : '#c0f08a'; g.beginPath(); g.arc(f.x, f.y, r, 0, 7); g.fill();
      g.fillStyle = '#18211a'; g.font = `bold ${13 * px}px system-ui`; g.textAlign = 'center'; g.fillText(shield ? '◇' : '↑', f.x, f.y + 4.5 * px); continue;
    }
    if (rush && f.kind === 2) {
      const r = Math.max(13, 11 * px) * (1 + 0.12 * Math.sin(now / 160));
      g.fillStyle = '#ffd5493a'; g.beginPath(); g.arc(f.x, f.y, r * 2, 0, 7); g.fill();
      g.fillStyle = '#ffd549'; g.strokeStyle = '#fff7ce'; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x, f.y - r); g.lineTo(f.x + r * 0.92, f.y); g.lineTo(f.x, f.y + r); g.lineTo(f.x - r * 0.92, f.y); g.closePath(); g.fill(); g.stroke();
      g.font = `bold ${12 * px}px system-ui`; g.textAlign = 'center'; g.fillStyle = '#402c00'; g.fillText('5', f.x, f.y + 4 * px); continue;
    }
    if (feast && f.kind === 3) { g.fillStyle = '#f5adce'; g.fillRect(f.x - 19, f.y - 16, 38, 32); g.fillStyle = '#fff2d5'; g.fillRect(f.x - 19, f.y - 6, 38, 7); g.fillStyle = '#e75b88'; g.beginPath(); g.arc(f.x, f.y - 20, 5, 0, 7); g.fill(); continue; } g.fillStyle = f.kind === 2 ? '#fff' : '#ecd9a4'; const s = f.kind === 2 ? 11 : 6; g.fillRect(f.x - s / 2, f.y - s / 2, s, s); }
  const delay = rush && scores?.ants > mode.crowdedAt ? mode.crowdedSnapEvery + 1 : DELAY;
  const at = (now + offset) / TICK_MS - delay;
  // Names are 11 screen pixels high whatever the zoom, so they stay readable on a phone.
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
    ant(x, y, angleOf(h), feast ? '#d9a97a' : COLORS[a.colony], feast ? sizeOf(a.mass) : 1 + a.tier * 0.18, a.carry, a.prot ? 0.5 : 1);
    if (feast) {
      const safe = a.prot || snap.prot || inGrass(x, y) || inGrass(mx, my);
      const edible = !safe && Math.max(10, snap.mass - 0.125) >= (a.mass + 1) * mode.eatRatio, danger = !safe && (a.mass + 1) >= Math.max(10, snap.mass - 0.125) * mode.eatRatio;
      g.strokeStyle = safe ? '#fff9' : danger ? '#ff8ab7' : edible ? '#78e9ed' : '#fff5'; g.lineWidth = (danger || edible ? 3 : 1.5) * px;
      g.beginPath(); g.arc(x, y, 19 * sizeOf(a.mass), 0, 7); g.stroke();
      g.fillStyle = g.strokeStyle; g.font = `bold ${15 * px}px system-ui`; g.fillText(safe ? '◇' : danger ? '!' : edible ? '+' : '=', x + 24 * sizeOf(a.mass), y + 5 * px);
      g.font = `${11 * px}px system-ui`;
    }
    labels.push({ x, y: y - (feast ? 24 * sizeOf(a.mass) : 22 + a.tier * 3), d: (x - mx) ** 2 + (y - my) ** 2, text: `${C.NAMES_A[a.nameA]} ${C.NAMES_B[a.nameB]}${a.bot ? ' · bot' : ''}`, bot: a.bot, more: 0, bots: 0 });
    const max = C.TIER_HP[a.tier];
    if (!feast && a.hp < max) { g.fillStyle = '#0008'; g.fillRect(x - 14, y - 19 - a.tier * 3, 28, 3); g.fillStyle = '#e2574c'; g.fillRect(x - 14, y - 19 - a.tier * 3, 28 * a.hp / max, 3); }
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
  // Names that would print under the score lists at the top, or over the own line and bars at the bottom left, are left
  // out; the ants themselves still show.
  const dpr = Math.min(2, devicePixelRatio || 1), topY = my + ((hudBottom + 4) * dpr - H / 2) / zoom;
  const lowY = my + ((selfTop - 2) * dpr - H / 2) / zoom, lowX = mx + ((($('self').getBoundingClientRect().right || 0) + 8) * dpr - W / 2) / zoom;
  for (const l of placed) if (l.y > topY && !(l.y > lowY && l.x - l.w < lowX)) g.fillText(l.more ? `${l.text} +${l.more}${l.bots === l.more ? ' bot' + (l.more > 1 ? 's' : '') : l.bots ? ` (${l.bots} bot${l.bots > 1 ? 's' : ''})` : ''}` : l.text, l.x, l.y);
  if (snap.alive) {
    g.strokeStyle = '#fff9'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, feast ? 20 * sizeOf(snap.mass) : 20 + snap.tier * 3, 0, 7); g.stroke();
    ant(mx, my, pred.me.heading, feast ? '#a6e38b' : COLORS[me.colony], feast ? sizeOf(snap.mass) : 1 + snap.tier * 0.18, snap.carry, snap.prot ? 0.5 : 1);
  }
  // Rings and bursts around the player's own ant.
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i], t = (now - f.t0) / f.dur;
    if (t >= 1) { fx.splice(i, 1); continue; }
    if (f.kind === 'ring') { g.globalAlpha = 1 - t; g.strokeStyle = f.color; g.lineWidth = (f.width ?? 4) * px; g.beginPath(); g.arc(mx, my, 20 + (f.r1 - 20) * (1 - (1 - t) ** 3), 0, 7); g.stroke(); }
    else if (f.kind === 'burst') { g.globalAlpha = 1 - t; g.fillStyle = f.color; for (let j = 0; j < 10; j++) { const a = j * 0.628 + 0.3, r = 18 + 60 * (1 - (1 - t) ** 2); g.beginPath(); g.arc(mx + Math.cos(a) * r, my + Math.sin(a) * r, 4 * px * (1 - t * 0.6), 0, 7); g.fill(); } }
  }
  g.globalAlpha = 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const d = Math.min(2, devicePixelRatio || 1);
  // Points fly from the ant up to the score line at the bottom left.
  for (const f of fx) if (f.kind === 'points') {
    const t = (now - f.t0) / f.dur, e = t * t, sx = W / 2 + (60 * d - W / 2) * e, sy = H / 2 - 30 * d + (H - 60 * d - (H / 2 - 30 * d)) * e;
    g.globalAlpha = Math.min(1, 2.2 - 2 * t); g.font = `800 ${(17 - 5 * t) * d}px system-ui`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 3 * d; g.strokeStyle = '#000b'; g.fillStyle = feast ? '#a6e38b' : '#ffe58a';
    g.strokeText(`+${f.n}`, sx, sy); g.fillText(`+${f.n}`, sx, sy);
  }
  g.globalAlpha = 1;
  // Frenzy: a warm, pulsing frame around the whole field, so the last seconds look different, not only read different.
  if (rush && scores && !scores.inBreak && scores.left <= mode.frenzySeconds) {
    const p = 0.55 + 0.45 * Math.sin(now / 140);
    g.fillStyle = '#ff6a1a14'; g.fillRect(0, 0, W, H);
    g.strokeStyle = `rgba(255, 150, 70, ${p})`; g.lineWidth = 10 * d; g.strokeRect(5 * d, 5 * d, W - 10 * d, H - 10 * d);
  }
  // Point toward the current event (food patch, cake, golden crumb, hill) from the edge of the screen, with its name.
  const target = feast || rush ? scores?.feature ?? { x: C.WORLD / 2, y: C.WORLD / 2, kind: 1 } : { x: C.WORLD / 2, y: C.WORLD / 2 };
  const dx = target.x - mx, dy = target.y - my, distance = Math.hypot(dx, dy);
  const feedBox = $('feed').textContent ? $('feed').getBoundingClientRect().bottom + 26 : 0;
  const top = Math.max(hudBottom + 34, feedBox) * d, bottom = H - 150 * d, left = 26 * d, right = W - 26 * d;
  const onScreen = W / 2 + dx * zoom > left && W / 2 + dx * zoom < right && H / 2 + dy * zoom > top && H / 2 + dy * zoom < bottom;
  if (distance > 300 && !onScreen && !scores?.inBreak && bottom > top) {
    const heading = Math.atan2(dy, dx), c = Math.cos(heading), s = Math.sin(heading);
    // The point where a ray from the centre leaves the clear rectangle.
    const tx = c > 0 ? (right - W / 2) / c : c < 0 ? (left - W / 2) / c : Infinity, ty = s > 0 ? (bottom - H / 2) / s : s < 0 ? (top - H / 2) / s : Infinity;
    const r = Math.min(tx, ty), ax = W / 2 + c * r, ay = H / 2 + s * r;
    const hue = rush && target.kind === 2 ? '#ffd549' : feast && target.kind === 3 ? '#f5adce' : rush ? '#ffb06d' : '#ecd9a4';
    const bob = 3 * d * Math.sin(now / 180);
    g.save(); g.translate(ax + c * bob, ay + s * bob); g.rotate(heading); g.fillStyle = hue; g.strokeStyle = '#000a'; g.lineWidth = 2 * d;
    g.beginPath(); g.moveTo(16 * d, 0); g.lineTo(-8 * d, -11 * d); g.lineTo(-8 * d, 11 * d); g.closePath(); g.stroke(); g.fill(); g.restore();
    g.font = `600 ${13 * d}px system-ui`; g.lineJoin = 'round'; g.lineWidth = 3 * d; g.strokeStyle = '#000a'; g.fillStyle = '#fff';
    const label = feast ? target.kind === 3 ? 'Cake' : 'Fresh crumbs' : rush ? target.kind === 2 ? 'Golden crumb · 5' : 'Hill' : 'Food in the middle';
    const lw = g.measureText(label).width, lx = Math.max(8 * d + lw / 2, Math.min(W - 8 * d - lw / 2, ax - c * 34 * d)), ly = ay - s * 26 * d + 5 * d;
    g.textAlign = 'center'; g.strokeText(label, lx, ly); g.fillText(label, lx, ly);
  }
  if (input.stick) { const s = input.stick, d = Math.min(2, devicePixelRatio || 1); g.strokeStyle = '#fff5'; g.lineWidth = 2 * d; g.beginPath(); g.arc(s.x * d, s.y * d, 38 * d, 0, 7); g.stroke(); g.fillStyle = '#fff5'; g.beginPath(); g.arc(s.cx * d, s.cy * d, 14 * d, 0, 7); g.fill(); }
  // A map of the field: nests, the public food patch and yourself.
  const m = Math.min(W, H) * 0.16, ox = W - m - 12, oy = H - m - 12 - (matchMedia('(hover: hover) and (pointer: fine)').matches ? 0 : 110 * Math.min(2, devicePixelRatio || 1));
  g.fillStyle = '#0005'; g.fillRect(ox, oy, m, m);
  if (!feast) C.NESTS.forEach(([x, y], i) => { g.fillStyle = COLORS[i]; g.beginPath(); g.arc(ox + x / C.WORLD * m, oy + y / C.WORLD * m, m * 0.05, 0, 7); g.fill(); });
  if (feast) for (const [x, y, r] of GRASS) { g.fillStyle = '#a6e38b88'; g.beginPath(); g.arc(ox + x / C.WORLD * m, oy + y / C.WORLD * m, Math.max(3, r / C.WORLD * m), 0, 7); g.fill(); }
  if (rush) { g.strokeStyle = '#ffb06d'; g.lineWidth = 2; g.beginPath(); g.arc(ox + m / 2, oy + m / 2, Math.max(3, 140 / C.WORLD * m), 0, 7); g.stroke(); }
  g.fillStyle = rush && target.kind === 2 ? '#ffd549' : feast && target.kind === 3 ? '#f5adce' : '#ecd9a4'; const fm = Math.max(4, m * 0.06); g.fillRect(ox + target.x / C.WORLD * m - fm / 2, oy + target.y / C.WORLD * m - fm / 2, fm, fm);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + mx / C.WORLD * m, oy + my / C.WORLD * m, m * 0.03, 0, 7); g.fill();
  if (feast) {
    const rank = snap.rank ?? rankOf(snap.mass), lo = RANK_AT[rank], hi = RANK_AT[rank + 1];
    $('hp').style.transform = `scaleX(${hi ? Math.max(0, Math.min(1, (snap.mass - lo) / (hi - lo))) : 1})`;
    $('hp').parentElement.setAttribute('aria-label', hi ? `Promotion progress ${Math.floor(snap.mass)} of ${hi}` : 'Top rank');
    $('stamina').parentElement.hidden = true;
  } else {
    $('hp').style.transform = `scaleX(${Math.max(0, snap.hp) / C.TIER_HP[snap.tier]})`;
    $('stamina').style.transform = `scaleX(${pred.me.stamina / C.STAMINA})`;
  }
  if (!snap.alive && ((!feast && !rush) || !scores?.inBreak)) $('feed').textContent = `${$('feed').textContent.split('\n')[0]}\nBack in ${Math.ceil(snap.respawn / C.TICK_HZ)}${respawnAs}`;
  else if (now > feedUntil) $('feed').textContent = '';
  else if ($('feed').textContent.includes('\nBack in')) $('feed').textContent = $('feed').textContent.split('\n')[0];
}
requestAnimationFrame(frame);
// For automated checks and the load test's browser probe: read-only numbers, nothing that can steer the game.
window.crumbwar = {
  get state() { return { playing, me, x: pred?.me.x, y: pred?.me.y, ants: ants.size, food: food.size, rtt, kbps, corrected: pred?.corrected, replayed: pred?.replayed, scores, alive: snap?.alive, carry: snap?.carry, score: snap?.score, tier: snap?.tier, tick: lastTick,
    mass: snap?.mass, rank: snap?.rank, prot: snap?.prot, goal: snap?.goal, goalProgress: snap?.goalProgress, boostLeft: snap?.boostLeft, shieldLeft: snap?.shieldLeft }; },
  // What this page was already told: the ants and food in its own view square.
  get view() { return { ants: [...ants.values()].map(a => ({ x: a.x, y: a.y, mass: a.mass, colony: a.colony, carry: a.carry, prot: a.prot, heading: a.heading })), food: [...food.values()] }; },
};
