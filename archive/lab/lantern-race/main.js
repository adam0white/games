import { create, step, centre, half, progress, DT } from '../../lantern/sim.js';
import { hull, wake, reeds } from '../../lantern/looks.js';
import { read, readNumber, write } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';
import { DISTANCE, SEND_MS, clamp, cleanName, roomCode, makeCode, dailySeed, countdown, decodeRoomFrame, position, ranking, ghostTrack, interpolate, nightForSeed, botControl, bytes } from './sim.js';
noZoom();
const $ = id => document.getElementById(id), canvas = $('c'), g = canvas.getContext('2d');
const query = new URLSearchParams(location.search), linkedRoom = roomCode(query.get('room'));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let best = clamp(readNumber('lantern-race-best'), 0, DISTANCE), muted = read('lantern-race-sound') === '0';
$('name').value = cleanName(read('lantern-race-name', 'Lantern'));
$('bestLine').textContent = best ? `Best crossing · ${Math.round(best / 1000)}%` : '';
if (linkedRoom) $('quick').textContent = 'Join room';
const snd = sound({ on: () => !muted });
const tone = (f = 550, duration = .1, volume = .045) => { if (snd.ctx) snd.tone(f, duration, volume, 'triangle'); };
const keys = new Set();
let W, H, dpr, unit, left;
function layout() { W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1); unit = Math.min(760, W * 1.35); left = (W - unit) / 2; canvas.width = W * dpr; canvas.height = H * dpr; }
addEventListener('resize', layout); layout();
let phase = 'menu', pausedPhase = null, pauseAt = 0, s = create(3, 1, false, []), target = s.x;
let room = 'open', socket = null, connection = 0, timeout = null, online = false, offline = false, id = 1;
let peers = new Map(), tracks = new Map(), racers = new Map(), bots = [];
let pendingRoster = null, watching = new Map(), watchStart = 0, watchUntil = 0, readyUntil = 0, watchingOwnRound = false;
let seed = 3, night = 1, startAt = 0, roundKey = '', endAt = 0, last = performance.now(), acc = 0, sendAt = 0, readyRetryAt = 0;
let ready = false, finished = false, offlineRound = 0, particles = [], shake = 0, glow = 0, countLast = -1, uiLast = '';
const received = { p: 0, done: 0 }, sent = { p: 0, done: 0 };
const colors = ['#ffd28a', '#8ae5dd', '#e2a7e9', '#a7c9ff', '#c8e59a', '#ffa999', '#d4cdff', '#e8b998'];
const color = i => colors[Math.abs(Number(i)) % colors.length];
const show = screens(['menu', 'friendsCard', 'lobby', 'paused', 'end'], name => {
  phase = name;
  const active = ['race', 'countdown', 'end'].includes(name);
  $('strip').style.display = active ? 'block' : 'none'; $('racebar').style.display = active ? 'block' : 'none';
  $('pause').style.display = ['race', 'countdown'].includes(name) ? 'block' : 'none';
  $('count').classList.toggle('on', name === 'countdown');
});
function send(m) {
  if (!online || socket?.readyState !== WebSocket.OPEN || bytes(m) > 200) return false;
  try { socket.send(JSON.stringify(m)); if (m.t in sent) sent[m.t]++; return true; } catch { fallback('offline'); return false; }
}
function lobbyClock(now = performance.now()) {
  let text = 'Starts when everyone is ready or 8s after the first Ready.';
  if (offline) text = 'offline · Race the daily river with bots.';
  else if (now < watchStart) text = `Watching · starts in ${Math.ceil((watchStart - now) / 1000)}s`;
  else if (watchUntil > now) text = ready ? 'Ready sent · watching the room.' : 'Watching the room · Ready queues you for the next race.';
  else if (ready) {
    const remaining = Math.ceil((readyUntil - now) / 1000);
    text = remaining > 0 ? `Ready sent · up to ${remaining}s to gather racers` : 'Ready sent · waiting for the room';
  }
  if ($('lobbyLine').textContent !== text) $('lobbyLine').textContent = text;
}
function lobby() {
  $('roomTitle').textContent = room === 'open' ? 'Quick race' : room;
  $('peers').replaceChildren();
  for (const p of peers.values()) {
    const el = document.createElement('span'), observed = watching.get(p.id);
    el.className = 'tag' + (p.id === id ? ' me' : '');
    el.textContent = p.n + (p.id === id ? (ready ? ' · you · Ready sent' : ' · you') : observed ? ` · ${observed.done ? 'Finished' : `${Math.round(observed.d / 1000)}% to dawn`}` : '');
    $('peers').append(el);
  }
  lobbyClock();
  $('ready').disabled = ready; $('ready').textContent = ready ? 'Ready ✓' : 'Ready';
}
function disconnect() { connection++; clearTimeout(timeout); online = false; const old = socket; socket = null; if (old) { old.onclose = old.onerror = old.onmessage = old.onopen = null; old.close(); } }
function enter(code) {
  snd.unlock(); tone(); disconnect(); room = code; id = 1; peers = new Map([[1, { id: 1, n: cleanName($('name').value) }]]); tracks.clear(); racers.clear(); ready = false; offline = false; roundKey = ''; finished = false; bots = [];
  pendingRoster = null; watching.clear(); watchStart = watchUntil = readyUntil = 0; watchingOwnRound = false;
  $('name').value = cleanName($('name').value); write('lantern-race-name', $('name').value);
  $('connection').textContent = 'connecting…'; $('shareStatus').textContent = ''; show('lobby'); lobby();
  const epoch = connection;
  const fail = note => { if (epoch === connection) fallback(note); };
  try {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/lab-api/room/lantern-race/${room}`);
    socket.onopen = () => { if (epoch !== connection) return; online = true; send({ t: 'hi', n: cleanName($('name').value) }); };
    socket.onmessage = event => { if (epoch !== connection) return; const m = decodeRoomFrame(event.data); if (m) receive(m); };
    socket.onerror = () => fail('offline');
    socket.onclose = event => fail(event.code === 4001 ? 'Room full · offline' : 'offline');
    timeout = setTimeout(() => fail('offline'), 2500);
  } catch { fail('offline'); }
}
function fallback(note) {
  if (offline || phase === 'menu' || phase === 'friendsCard') return;
  disconnect(); offline = true; $('connection').textContent = note;
  peers = new Map([[id, { id, n: cleanName($('name').value) }]]);
  watching.clear(); watchStart = watchUntil = 0; pendingRoster = null; watchingOwnRound = false;
  for (const key of racers.keys()) if (key !== id) opponentLeft(key);
  if (phase === 'end') renderResults();
  lobby();
  if (ready && phase === 'lobby') localRound();
}
function opponentLeft(key) {
  const p = racers.get(key);
  tracks.delete(key);
  if (!p || p.bot || p.left || p.s !== undefined) return;
  const bot = bots.find(b => b.id === key);
  if (bot && p.a && !finished) {
    bot.active = true;
    racers.set(key, botEntry(bot));
  } else {
    p.a = 0; p.left = true;
  }
}
function observe(m, now) {
  if (!peers.has(m.id) || m.id === id) return;
  if (now >= watchUntil) { watching.clear(); watchStart = 0; watchUntil = now + 150000; }
  let prior = watching.get(m.id);
  if (m.t === 'p' && prior?.done && m.a) { watching.clear(); prior = undefined; watchUntil = now + 150000; }
  if (m.t === 'p' && prior?.d > m.d) return;
  const next = m.t === 'done' ? { d: prior?.d ?? 0, done: true } : { d: m.d, done: !m.a };
  watching.set(m.id, next);
  if (next.done !== prior?.done || Math.round(next.d / 1000) !== Math.round(prior?.d / 1000)) lobby();
}
function waitingForRacers() {
  return [...racers.values()].some(p => !p.bot && !p.left && p.s === undefined);
}
function settleWatch() {
  if (!watchingOwnRound || waitingForRacers()) return;
  watchingOwnRound = false; watching.clear(); watchStart = watchUntil = 0; lobby();
}
function receive(m) {
  const now = performance.now();
  if (m.t === 'you') {
    clearTimeout(timeout); id = m.id; peers = new Map(m.peers.map(p => [p.id, p])); peers.set(id, { id, n: cleanName($('name').value) });
    offline = false; $('connection').textContent = 'live · ' + (room === 'open' ? 'open river' : room);
    if (m.round) {
      const offset = m.round.start - Date.now();
      watchStart = now + clamp(offset, 0, 6000); watchUntil = now + clamp(offset + 150000, 0, 156000); readyUntil = 0;
    }
    lobby();
    if (ready) transmitReady(now);
  } else if (m.t === 'join') {
    peers.set(m.id, { id: m.id, n: m.n }); lobby();
    const p = racers.get(m.id);
    if (p && !p.bot && !p.left && p.s === undefined) p.n = m.n;
  } else if (m.t === 'leave') {
    peers.delete(m.id); watching.delete(m.id);
    const pending = pendingRoster?.get(m.id);
    if (pending) pending.left = true;
    opponentLeft(m.id); settleWatch();
    lobby(); if (phase === 'end') renderResults();
  } else if (m.t === 'roster') {
    pendingRoster = new Map(m.ids.map(key => [key, { id: key, n: peers.get(key)?.n ?? 'Boat' }]));
  } else if (m.t === 'round') {
    const roster = pendingRoster; pendingRoster = null;
    if (roster?.has(id)) beginRound(m, roster);
  } else if (m.t === 'p' || m.t === 'done') {
    const p = racers.get(m.id);
    if (phase === 'lobby' && (!roundKey || finished) && !p?.bot && !p?.left) observe(m, now);
    if (!roundKey || !p || p.bot || p.left) return;
    if (m.t === 'p') {
      if (m.id === id || p.s !== undefined || (phase === 'countdown' && m.a) || (p.a === 0 && m.a)) return;
      received.p++; tracks.set(m.id, ghostTrack(m, now, tracks.get(m.id)));
      if (m.d >= p.d) { p.d = m.d; p.a = m.a; } updateBar();
    } else {
      received.done++; if (p.s !== undefined) return; p.s = m.s; p.a = 0; tracks.delete(m.id); settleWatch();
    }
    if (phase === 'end') renderResults();
  }
}
function localRound() { const daily = dailySeed(new Date().toISOString().slice(0, 10)); beginRound({ seed: (daily + offlineRound++) >>> 0, start: Date.now() + 3200 }, peers); }
function transmitReady(now) {
  if (send({ t: 'ready' }) && !readyUntil && now >= watchUntil) readyUntil = now + 8000;
  readyRetryAt = now + 2000;
}
function requestReady() {
  if (ready || !['lobby', 'end'].includes(phase)) return;
  snd.unlock(); snd.release(); tone(660, .15); ready = true;
  if (phase === 'end' && waitingForRacers()) { watchingOwnRound = true; watchUntil = endAt; }
  if (phase === 'end') show('lobby'); lobby();
  if (offline) localRound(); else if (online) transmitReady(performance.now());
}
function beginRound(round, roster) {
  const key = `${round.seed}:${round.start}`; if (roundKey === key) return;
  roundKey = key; seed = round.seed; night = nightForSeed(seed); startAt = performance.now() + countdown(round.start, Date.now()); endAt = startAt + 150000;
  s = create(seed, night, false, []); target = s.x; acc = 0; last = performance.now(); sendAt = startAt; finished = false; ready = false; tracks.clear(); particles = []; shake = 0; countLast = -1; uiLast = ''; steer.reset(); keys.clear(); snd.release();
  watching.clear(); watchStart = watchUntil = readyUntil = 0; watchingOwnRound = false;
  racers = new Map([...roster].map(([key, p]) => [key, { id: key, n: p.n, d: 0, a: 1 }]));
  const botIds = offline ? [9, 10, 11] : [...racers.keys()].filter(key => key !== id);
  bots = botIds.map((key, i) => ({ id: key, n: offline ? `${['Reed', 'Glimmer', 'Drift'][i]} · bot` : `${racers.get(key).n} · bot`, s: create(seed, night, false, []), policy: { skill: i % 3, id: i, next: 0 }, elapsed: null, active: offline }));
  for (const b of bots) if (b.active) racers.set(b.id, botEntry(b));
  for (const p of roster.values()) if (p.left) opponentLeft(p.id);
  $('countRoster').textContent = offline ? '' : `Ready · ${[...roster.values()].map(p => p.n).join(' · ')}`;
  $('raceLabel').textContent = `Night ${night} · ${racers.size} ${racers.size === 1 ? 'boat' : 'boats'}`;
  disarm(); show('countdown'); updateBar();
}
function botEntry(b) { return { id: b.id, n: b.n, bot: true, d: Math.round(progress(b.s) * DISTANCE), s: b.elapsed ?? undefined, a: b.s.over ? 0 : 1 }; }
function burst(x, y, col, count = 12) {
  for (let i = 0; i < count; i++) { const a = i * 2.399 + performance.now() * .001; particles.push({ x, y, vx: Math.cos(a) * (30 + i * 2), vy: Math.sin(a) * (30 + i * 2), life: 1, col }); }
}
function publish(final = false) {
  const p = position(s.x, Math.round(progress(s) * DISTANCE), !finished);
  send(p); const now = performance.now(); sendAt = final || sendAt < now - SEND_MS ? now + SEND_MS : sendAt + SEND_MS;
  if (final) send({ t: 'done', s: Math.round(s.t * 1000) });
}
function finish(reason = s.over) {
  if (finished) return; finished = true; steer.drop(); keys.clear(); disarm();
  const p = racers.get(id); p.d = Math.round(progress(s) * DISTANCE); p.s = Math.round(s.t * 1000); p.a = 0;
  publish(true); best = Math.max(best, p.d); write('lantern-race-best', best); write('lantern-race-played', '1');
  $('bestLine').textContent = `Best crossing · ${Math.round(best / 1000)}%`;
  $('endTitle').textContent = reason === 'dawn' ? 'First light!' : reason === 'left' ? 'Boat retired' : reason === 'dark' ? 'Lantern out' : reason === 'bank' ? 'Run aground' : 'Wrecked';
  if (reason === 'dawn') { burst(W / 2, H * .3, '#ffe1a7', 65); [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .5, .06), i * 90)); glow = 1; }
  else { tone(180, .4); shake = .6; burst(left + s.x * unit, H * .68, '#a7d7da', 25); }
  show('end'); renderResults();
}
function renderResults() {
  const list = ranking([...racers.values()]); $('rankList').replaceChildren();
  for (const [i, p] of list.entries()) {
    const row = document.createElement('div'); row.className = 'rank' + (p.id === id ? ' me' : '');
    const r = document.createElement('span'), n = document.createElement('span'), d = document.createElement('span');
    r.textContent = String(i + 1).padStart(2, '0'); n.textContent = p.n + (p.id === id ? ' · you' : '');
    d.textContent = p.d >= DISTANCE ? `${((p.s ?? 0) / 1000).toFixed(1)}s` : `${Math.round(p.d / 1000)}%${p.a ? ' ↗' : ''}`;
    row.append(r, n, d); $('rankList').append(row);
  }
  const pending = list.filter(p => p.a && p.id !== id).length;
  $('endLine').textContent = pending ? `${pending} boat${pending === 1 ? '' : 's'} still racing · places may change` : `Night ${night} · ${list.length} boats`;
  $('endBest').textContent = `Best crossing · ${Math.round(best / 1000)}%`;
}
function updateBar() {
  const data = [...racers.values()], key = data.map(p => `${p.id}:${Math.round(p.d / 500)}:${p.a}`).join(','); if (uiLast === key) return; uiLast = key;
  $('racebar').replaceChildren();
  for (const p of data) { const el = document.createElement('span'); el.className = 'dot' + (p.id === id ? ' me' : ''); el.style.setProperty('--color', p.id === id ? '#ffd28a' : color(p.id)); el.style.bottom = `calc(${p.d / 1000}% - ${p.d / DISTANCE * 14}px)`; el.style.left = `${4 + (p.id % 3) * 4}px`; el.title = p.n; $('racebar').append(el); }
}
function pause() {
  if (phase !== 'race' && phase !== 'countdown') return;
  steer.drop(); keys.clear();
  // A live race cannot freeze its clock. Retire before opening a pause card.
  if (!offline) { finish('left'); return; }
  pausedPhase = phase; pauseAt = performance.now(); show('paused'); snd.hold(); $('pauseLine').textContent = 'The river will wait.';
}
function resume() {
  if (phase !== 'paused') return;
  if (pausedPhase === 'countdown') { startAt = performance.now() + 3000; endAt = startAt + 150000; }
  else endAt += performance.now() - pauseAt;
  acc = 0; last = performance.now(); target = s.x; snd.release(); show(pausedPhase); tone();
}
function menu() {
  if (phase === 'race' || phase === 'countdown' || phase === 'paused') { if (!finished) finish('left'); }
  disconnect(); offline = false; ready = false; finished = true; bots = []; roundKey = ''; $('connection').textContent = ''; show('menu'); snd.release();
}
function aim(x) { target = clamp(x, 0, 1); }
const steer = drag(canvas, { playing: () => phase === 'race', paused: () => phase === 'paused', resume, from: () => s.x, travel: dx => dx / unit * 1.3, aim, mouse: e => aim((e.clientX - left) / unit), settle: 12 });
hint(canvas, { kind: 'drag', key: 'lantern-race:hint', delay: 1500, bottom: 70, when: () => phase === 'race', played: read('lantern-race-played') === '1' });
canvas.addEventListener('pointerdown', e => { if (phase !== 'race') return; snd.unlock(); tone(400, .06, .02); burst(e.clientX, e.clientY, '#bfe4d9', 6); try { canvas.setPointerCapture?.(e.pointerId); } catch {} });
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (isPauseKey(e)) { e.preventDefault(); phase === 'paused' ? resume() : pause(); return; }
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { e.preventDefault(); keys.add(e.key.toLowerCase()); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); onLeave(pause);
$('quick').onclick = () => enter(linkedRoom || 'open'); $('friends').onclick = () => { tone(); show('friendsCard'); };
$('create').onclick = () => { const buf = new Uint32Array(1); crypto.getRandomValues(buf); enter(makeCode(buf[0])); };
$('join').onclick = () => { const code = roomCode($('code').value); if (!code || code === 'open') { $('codeError').textContent = 'Use four letters.'; tone(180); } else enter(code); };
$('code').oninput = () => { $('code').value = $('code').value.replace(/[^a-z]/gi, '').toUpperCase(); $('codeError').textContent = ''; };
$('ready').onclick = requestReady; $('rematch').onclick = requestReady; $('resume').onclick = resume;
// A live race cannot pause, so the button retires the boat. One stray tap must not end a race: the first tap asks.
let retireArmed = 0, retireTimer = null;
function disarm() { clearTimeout(retireTimer); retireArmed = 0; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Pause'); $('roomLine').textContent = room === 'open' ? 'OPEN RIVER' : `ROOM ${room}`; }
$('pause').onclick = () => {
  if (offline || !['race', 'countdown'].includes(phase)) { pause(); return; }
  if (performance.now() < retireArmed) { disarm(); pause(); return; }
  retireArmed = performance.now() + 2500; $('pause').textContent = '✕'; $('pause').setAttribute('aria-label', 'Retire boat'); $('roomLine').textContent = 'TAP ✕ AGAIN TO RETIRE'; tone(330, .08);
  clearTimeout(retireTimer); retireTimer = setTimeout(disarm, 2500);
};
for (const b of document.querySelectorAll('.toMenu')) b.onclick = menu;
$('sound').textContent = `Sound: ${muted ? 'off' : 'on'}`;
$('sound').onclick = () => { muted = !muted; write('lantern-race-sound', muted ? '0' : '1'); $('sound').textContent = `Sound: ${muted ? 'off' : 'on'}`; if (!muted) { snd.unlock(); tone(); } };
$('share').onclick = async () => {
  tone(); const link = new URL(`/lab/lantern-race/?room=${room}`, location.origin).href;
  try { await navigator.clipboard.writeText(link); $('shareStatus').textContent = 'Link copied'; } catch { $('shareStatus').textContent = link; }
};
function ghosts(now) {
  return [
    ...bots.filter(b => b.active).map(b => ({ ...botEntry(b), x: b.s.x * 2 - 1, y: b.s.y })),
    ...[...tracks].map(([key, track]) => ({ ...racers.get(key), ...interpolate(track, now) })),
  ];
}
// Read-only snapshots for checks. No method can change the simulation or bypass input.
window.raceState = () => ({ phase, seed, night, id, offline, room, peers: [...peers.values()], x: s.x, y: s.y, d: Math.round(progress(s) * DISTANCE), t: s.t, target, over: s.over, unit, best, ghosts: ghosts(performance.now()), results: ranking([...racers.values()]), river: JSON.parse(JSON.stringify(s)), received: { ...received }, sent: { ...sent } });
function tick() {
  if (phase === 'race' && !finished) {
    if (keys.has('arrowleft') || keys.has('a')) target = s.x - .08;
    if (keys.has('arrowright') || keys.has('d')) target = s.x + .08;
    step(s, target);
    const p = racers.get(id); p.d = Math.round(progress(s) * DISTANCE);
    for (const event of s.events) {
      if (event === 'ember') { tone(740 + s.taken % 5 * 110, .2); glow = .5; burst(left + s.x * unit, H * .68, '#ffd28a', 16); }
      else if (event === 'graze') tone(1400, .08, .025);
      else if (event === 'hit') { shake = .6; snd.noise(.18, .08, 900); }
    }
    if (s.over) finish();
  }
  // Keep simulated opponents running after your finish so results can settle.
  for (const b of bots) if (!b.s.over && (!finished || b.active)) {
    step(b.s, botControl(b.s, b.policy));
    if (b.s.over) b.elapsed = Math.round(b.s.t * 1000);
    if (b.active) racers.set(b.id, botEntry(b));
  }
}
function boatDraw(x, y, col, label, ghost, now, light = .8, angle = 0) {
  g.save(); g.translate(x, y); g.globalAlpha = ghost ? .55 : 1;
  const r = unit * (ghost ? .1 : .27) * Math.max(.3, light), gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, ghost ? `${col}38` : '#ffca7338'); gr.addColorStop(1, '#ffd58a00'); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
  g.save(); g.rotate(angle); const squash = 1 + Math.sin(now / 190) * .025; g.scale(squash, 1 / squash);
  wake(g, unit * .85, now / 1000); hull(g, 'oak', unit * .85, ghost ? '#99bab5' : '#b9804d', now / 1000);
  g.shadowColor = col; g.shadowBlur = 12; g.fillStyle = '#fff4d0'; g.beginPath(); g.ellipse(0, -3, 3.5 + Math.sin(now / 87) * .5, 7, Math.sin(now / 200) * .12, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; g.restore();
  if (label) { g.globalAlpha = .95; g.font = '14px system-ui'; g.textAlign = 'center'; const width = g.measureText(label).width + 16; g.fillStyle = '#0b2025df'; const labelX = clamp(x, width / 2 + 6, W - width / 2 - 38) - x; g.fillRect(labelX - width / 2, 28, width, 24); g.fillStyle = col; g.fillText(label, labelX, 45); }
  g.restore();
}
function draw(now) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const sx = x => left + x * unit, sy = y => H * .68 - (y - s.y) * unit;
  if (shake && !calm) g.translate(Math.sin(now * .1) * shake * 8, Math.cos(now * .13) * shake * 5);
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#15332d'); bg.addColorStop(1, '#071b22'); g.fillStyle = bg; g.fillRect(-10, -10, W + 20, H + 20);
  const lo = s.y - H * .4 / unit, hi = s.y + H * .8 / unit;
  g.beginPath(); for (let y = lo; y <= hi + .04; y += .025) g.lineTo(sx(centre(s, y) - half(s, y)), sy(y)); for (let y = hi; y >= lo - .04; y -= .025) g.lineTo(sx(centre(s, y) + half(s, y)), sy(y)); g.closePath();
  const water = g.createLinearGradient(0, 0, 0, H); water.addColorStop(0, '#1c4850'); water.addColorStop(1, '#102b3a'); g.fillStyle = water; g.fill(); g.strokeStyle = '#6f9a7b88'; g.lineWidth = 3; g.stroke();
  reeds(g, (y, side) => sx(centre(s, y) + side * half(s, y)), sy, unit, lo, hi, now / 1000);
  g.strokeStyle = '#92b9b724'; g.lineWidth = 1;
  for (let i = Math.floor(lo * 12); i < hi * 12; i++) { const y = i / 12, x = centre(s, y) + Math.sin(i * 79.9) * half(s, y) * .8; g.beginPath(); g.moveTo(sx(x), sy(y)); g.lineTo(sx(x) + 5, sy(y) + 20); g.stroke(); }
  for (const k of s.rocks) {
    const x = sx(k.x), y = sy(k.y), r = k.rad * unit; if (y < -80 || y > H + 80) continue;
    g.shadowColor = '#0005'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.fillStyle = k.ice ? '#9fced8' : k.kind === 'log' ? '#886541' : '#30424a'; g.beginPath(); g.ellipse(x, y, r + k.len * unit, r * .8, -.15, 0, 7); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = k.ice ? '#d6eceb' : '#64787d'; g.beginPath(); g.ellipse(x - r * .23, y - r * .28, r * .55, r * .27, -.3, 0, 7); g.fill();
  }
  for (const e of s.embers) if (!e.got) { const x = sx(e.x), y = sy(e.y) + Math.sin(now / 300 + e.y) * 3; g.shadowColor = '#ffd08a'; g.shadowBlur = 16; g.fillStyle = '#ffe5ac'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.shadowBlur = 0; }
  const visible = ghosts(now).filter(p => p.a && Math.abs(p.d / DISTANCE * 78 - s.y) < H / unit);
  visible.forEach((p, i) => {
    // The report's distance is progress to dawn, including slow-water credit. No powers in race setup.
    let y = sy(p.y ?? p.d / DISTANCE * 78); if (Math.abs(y - H * .68) < 34) y -= 84 + i * 34; // label hangs 28-52 px below a ghost: clear your own boat
    boatDraw(sx((p.x + 1) / 2), y, color(p.id), p.n, true, now);
  });
  if (!finished || phase === 'menu' || phase === 'lobby') boatDraw(sx(s.x), sy(s.y), '#ffd28a', '', false, now, s.light, clamp((target - s.x) * 2, -.3, .3));
  // Soft night edges preserve the path and each ghost's name.
  const vignette = g.createRadialGradient(sx(s.x), sy(s.y), unit * .08, sx(s.x), sy(s.y), Math.max(W, H)); vignette.addColorStop(0, '#03101700'); vignette.addColorStop(1, '#031017bb'); g.fillStyle = vignette; g.fillRect(0, 0, W, H);
  if (s.over === 'dawn') { const dawn = g.createLinearGradient(0, 0, 0, H); dawn.addColorStop(0, '#f4c38b88'); dawn.addColorStop(1, '#f4c38b00'); g.fillStyle = dawn; g.fillRect(0, 0, W, H); }
  for (const p of particles) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 2.5, 0, 7); g.fill(); } g.globalAlpha = 1;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (phase === 'lobby') {
    if (watchUntil && now >= watchUntil) { watchStart = watchUntil = 0; watching.clear(); lobby(); }
    if (ready && online && now >= readyRetryAt) transmitReady(now);
    if (now - lastLobbyPaint >= 100) { lobbyClock(now); lastLobbyPaint = now; }
  }
  const dt = Math.min(.2, (now - last) / 1000); last = now;
  if (phase === 'countdown') {
    const remaining = Math.ceil((startAt - now) / 1000);
    if (remaining !== countLast) { $('countNumber').textContent = String(Math.max(1, remaining)); countLast = remaining; tone(remaining > 0 ? 440 : 880, .14); }
    if (now >= startAt) { show('race'); acc = 0; }
  }
  if (phase === 'race' || phase === 'end') {
    acc += dt; while (acc >= DT) { tick(); acc -= DT; }
    if (phase === 'race' && !finished && now >= sendAt) publish();
    if (now >= endAt) { if (!finished) finish('left'); for (const p of racers.values()) if (p.a) { p.a = 0; p.left = true; } }
    updateBar(); if (phase === 'end') renderResults();
    if (phase === 'race') $('raceLabel').textContent = `${Math.round(progress(s) * 100)}% to dawn`;
  }
  if (phase !== 'paused') for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 25 * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0); shake = Math.max(0, shake - dt * 2); glow = Math.max(0, glow - dt);
  draw(now);
}
let lastLobbyPaint = 0;
show('menu'); requestAnimationFrame(frame);
