// Paper Boat: the page. Rules live in sim.js; this file draws, listens and saves.
import { create, step, flow, items, advise, stars, score, pawState, length, dailySeed, pebbleHint, grateParted, STAR_SOAK, LEVELS, DT, BOAT_R, RIPPLE_LIFE, STONE_LIFE, PAW_R, PAW_WARN } from './sim.js';
import { read, write, readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { music } from '../kit/music.js';
import { SONG, mood, look, heard } from './song.js';
import { t, lang } from './words.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { noZoom } from '../kit/zoom.js';
import { screens } from '../kit/screens.js';
import { hint } from '../kit/hint.js';
import { lab } from '../kit/lab.js';
noZoom();
const $ = (id) => document.getElementById(id);
const cv = $('c'), g = cv.getContext('2d');
const query = new URLSearchParams(location.search);
const KEY = 'boat-save';
const old = readJson(KEY);
const save = Object.assign({ v: 1, stars: {}, opened: 1, sound: true, daily: {}, best: 0 }, old || {});
const persist = () => writeJson(KEY, save);
const rec = lab('boat');
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);
// Music (kit/music.js, 2026-11-24): the river preset, played by the boat's run (song.js). Its own key, '0' when turned off.
const MUSIC = 'boat-music';
let musicOn = read(MUSIC) !== '0', song = null, songFor = null;
const snd = sound({ on: () => save.sound, setup: ac => { song = music(ac, SONG); song.volume(SONG.volume); } });
const tone = (...a) => snd.tone(...a), noise = (...a) => snd.noise(...a);
const later = (ms, f) => setTimeout(() => { if (mode === 'play' || mode === 'end') f(); }, ms);

let W = 0, H = 0, cw = 0, x0 = 0, dpr = 1, top = 0;
let mode = 'menu', s = create({ level: 1, seed: 1 }), level = 1, daily = false, runDate = '', cam = 0, acc = 0, last = 0, now = 0;
let queue = [], overAt = 0, shake = 0, fxCount = 0, endStars = 0, newBest = false, live = false;
let stroke = null; // the finger's current stroke, in screen px
const fx = [], rings = [], wake = [], motes = [];
const sx = (x) => x0 + x * cw, sy = (y) => H * 0.7 - (y - cam) * cw;
const wx = (px) => (px - x0) / cw, wy = (py) => cam + (H * 0.7 - py) / cw;

function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cw = Math.min(W * 0.84, 440, H * 0.62); x0 = (W - cw) / 2;
  top = parseFloat(getComputedStyle($('probe')).paddingTop) || 0;
}
addEventListener('resize', resize);
resize();

// ---- screens ----
const show = screens(['menu', 'select', 'paused', 'end'], (name) => {
  mode = name;
  $('pause').style.display = name === 'play' ? 'flex' : 'none';
  if (name === 'play') snd.release(); else if (name === 'paused') snd.hold();
});
function menu() {
  document.body.classList.toggle('has-played', !!old || save.opened > 1 || Object.keys(save.stars).length > 0 || save.best > 0);
  const got = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $('bestLine').textContent = `★ ${got} / 30` + (save.best ? `  ·  Best stream ${save.best}` : '');
  $('play').textContent = save.opened > 1 && save.opened <= 10 ? `Street ${save.opened}` : save.opened > 10 ? "Today's stream" : 'Play';
  if (mode !== 'menu' || !live) { s = create({ level: 1, seed: 7 }); cam = 0; live = false; }
  show('menu');
}
function start(n, isDaily = false) {
  snd.unlock();
  level = n; daily = isDaily;
  const d = new Date();
  runDate = d.toISOString().slice(0, 10);
  const seed = Number(query.get('seed')) || (daily ? dailySeed(d) : 1 + ((save.runs = (save.runs || 0) + 1) % 9973));
  s = create({ level: n, seed, daily });
  cam = s.b.y; acc = 0; queue = []; overAt = 0; fx.length = 0; rings.length = 0; wake.length = 0; stroke = null; live = true; newBest = false;
  rec.start({ level: daily ? 0 : n, daily, seed, date: daily ? runDate : undefined });
  tone(392, 0.14, 0.05, 'triangle', 130);
  show('play');
}
function finish() {
  const win = s.over === 'win';
  endStars = daily ? 0 : stars(s);
  const pts = score(s);
  if (daily) {
    newBest = pts > (save.best || 0);
    save.daily[runDate] = Math.max(save.daily[runDate] || 0, pts);
    save.best = Math.max(save.best || 0, pts);
    const days = Object.keys(save.daily).sort();
    while (days.length > 60) delete save.daily[days.shift()];
  } else if (win) {
    save.stars[level] = Math.max(save.stars[level] || 0, endStars);
    save.opened = Math.max(save.opened, Math.min(11, level + 1));
  }
  persist();
  rec.end(s.over, { level: daily ? 0 : level, daily, stars: endStars, score: pts, riders: s.riders.length, soak: Math.round(s.soak * 100), moves: s.acts, t: Math.round(s.tick * DT) });
  $('endLabel').textContent = daily ? `Today's stream · ${runDate}` : `Street ${level} · ${LEVELS[level - 1].name}`;
  $('endTitle').textContent = win ? (level === 10 ? 'Home at the pond!' : 'The pond!') : s.over === 'drain' ? 'Down the drain' : daily ? 'Soaked through' : 'Too soggy';
  $('stars').style.display = daily ? 'none' : '';
  [...$('stars').children].forEach((el, i) => { el.className = ''; void el.offsetWidth; el.className = i < endStars ? 'on' : ''; });
  $('big').style.display = daily ? '' : 'none';
  $('big').textContent = pts;
  $('endRiders').textContent = daily ? String(s.riders.length) : `${s.riders.length} / ${LEVELS[level - 1].bugs}`;
  $('endStatName').textContent = daily ? 'Best' : 'Dry paper left';
  $('endStat').textContent = daily ? `${save.best}${newBest ? ' · new!' : ''}` : `${Math.round((1 - s.soak) * 100)}%`;
  $('endTip').textContent = win ? (endStars === 3 ? '' : endStars === 2 ? 'Keep over 47% dry paper for the third star. Ripples splash.' : 'Bring every passenger for more stars.')
    : daily ? 'Passengers bail water. Same stream for everyone today.' : s.over === 'drain' ? (LEVELS[level - 1]?.teach === 'pebble' ? 'A pebble parts the current.' : 'Swipe the water to push the boat aside.') : 'Ripples splash. Leaves and paws soak the paper.';
  const next = $('next');
  next.style.display = win || daily ? '' : 'none';
  next.textContent = daily ? 'Again' : level < 10 ? 'Next street' : "Today's stream";
  $('again').textContent = daily ? 'Streets' : 'Retry';
  $('again').className = win || daily ? '' : 'primary';
  show('end');
  if (win) [523, 659, 784, 1047].forEach((f, i) => later(i * 110, () => tone(f, 0.3, 0.06, 'triangle')));
}
function pause() {
  if (mode !== 'play') return;
  stroke = null;
  show('paused');
}
function resume() { if (mode === 'paused') { last = 0; show('play'); tone(520, 0.08, 0.04); } }
function leave(why) { if (live && !s.over) rec.end(why, { level: daily ? 0 : level, daily, score: score(s), t: Math.round(s.tick * DT) }); if (daily && live && !s.over) { save.daily[runDate] = Math.max(save.daily[runDate] || 0, score(s)); save.best = Math.max(save.best, score(s)); persist(); } }
$('play').onclick = () => (save.opened > 10 ? start(0, true) : start(save.opened));
$('daily').onclick = () => start(0, true);
$('choose').onclick = () => {
  const box = $('levels');
  box.textContent = '';
  for (const l of LEVELS) {
    const b = document.createElement('button'), st = save.stars[l.n] || 0;
    b.innerHTML = `${l.n}<small>${'★'.repeat(st)}</small>`;
    b.disabled = l.n > save.opened;
    b.setAttribute('aria-label', `Street ${l.n}, ${st} stars`);
    b.onclick = () => start(l.n);
    box.append(b);
  }
  show('select');
};
$('selectBack').onclick = menu;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('restart').onclick = () => { leave('restart'); start(level, daily); };
$('toMenu').onclick = () => { leave('left'); live = false; menu(); };
$('endMenu').onclick = () => { live = false; menu(); };
$('again').onclick = () => (daily ? $('choose').onclick() : start(level));
$('next').onclick = () => (daily ? start(0, true) : level < 10 ? start(level + 1) : start(0, true));
$('sound').onclick = () => { save.sound = !save.sound; persist(); $('sound').textContent = `Sound: ${save.sound ? 'on' : 'off'}`; if (save.sound) { snd.unlock(); } };
$('sound').textContent = `Sound: ${save.sound ? 'on' : 'off'}`;
const musicShow = () => { $('music').textContent = t(musicOn ? 'musicOn' : 'musicOff'); $('music').lang = lang(); $('music').setAttribute('aria-pressed', String(musicOn)); };
$('music').onclick = () => { musicOn = !musicOn; write(MUSIC, musicOn ? '1' : '0'); musicShow(); };
musicShow();
onLeave(pause);

// ---- input: a swipe draws a ripple that pushes the water its way; a tap drops a pebble the water bends round ----
function ripple(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  queue.push({ k: 'ripple', x: wx(ax), y: wy(ay), dx: dx / len, dy: -dy / len, a: Math.min(1, len / (cw * 0.34)) });
}
cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || s.over || stroke) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch {}
  stroke = { id: e.pointerId, x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, made: 0 };
});
cv.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== stroke.id) return;
  stroke.px = e.clientX; stroke.py = e.clientY;
  // A long stroke lays a ripple every third of the gutter, so drawing on feels continuous.
  if (Math.hypot(stroke.px - stroke.x, stroke.py - stroke.y) > cw * 0.34) { ripple(stroke.x, stroke.y, stroke.px, stroke.py); stroke.x = stroke.px; stroke.y = stroke.py; stroke.made++; }
});
function lift(e) {
  if (!stroke || e.pointerId !== stroke.id) return;
  const len = Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y);
  if (mode === 'play' && !s.over && e.type === 'pointerup') {
    if (len > 14) ripple(stroke.x, stroke.y, e.clientX, e.clientY);
    else if (!stroke.made) queue.push({ k: 'pebble', x: wx(e.clientX), y: wy(e.clientY) });
  }
  stroke = null;
}
cv.addEventListener('pointerup', lift);
cv.addEventListener('pointercancel', lift);
addEventListener('keydown', (e) => {
  if (isPauseKey(e)) { if (mode === 'play') pause(); else if (mode === 'paused') resume(); return; }
  if (mode !== 'play' || s.over || e.repeat) return;
  const b = s.b, dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], a: [-1, 0], d: [1, 0], w: [0, 1], s: [0, -1] }[e.key];
  if (dir) { queue.push({ k: 'ripple', x: b.x - dir[0] * 0.1, y: b.y - dir[1] * 0.1, dx: dir[0], dy: dir[1], a: 1 }); e.preventDefault(); }
  else if (e.key === ' ') { queue.push({ k: 'pebble', x: b.x + (b.x > 0.5 ? 0.1 : -0.1), y: b.y + 0.16 }); e.preventDefault(); }
});
const help = hint(cv, { kind: 'hold-and-move', key: 'boat:hint', when: () => mode === 'play' && !s.over && !pebbleHint(s), played: !!old && (old.opened > 1 || (old.best || 0) > 0), delay: 2500, bottom: 150 });

// ---- effects ----
function burst(x, y, n, colour, speed = 0.5, life = 0.6, size = 3) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random()); fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, age: 0, colour, size: size * (0.6 + Math.random() * 0.8) }); }
  fxCount += n;
}
const ring = (x, y, max = 0.2, life = 0.7, w = 2) => rings.push({ x, y, max, life, age: 0, w });
// With the music on, each passenger taken and each drain or paw got past plays the next note of the street's tune
// (song.js); the passenger's own two notes play only when the tune's queue is full (as chord tones then). With it off,
// every sound as before.
function events(sung) {
  for (const e of s.ev) {
    if (e.type === 'ripple') { noise(0.2, 0.1, 700 + Math.random() * 500); tone(260 + Math.random() * 80, 0.16, 0.035, 'sine', 180); burst(e.x, e.y, 5, '#ffffff', 0.25, 0.5, 2.5); }
    else if (e.type === 'pebble') { tone(210, 0.14, 0.1, 'sine', -120); noise(0.07, 0.16, 2600); ring(e.x, e.y, 0.2); ring(e.x, e.y, 0.12, 0.5); burst(e.x, e.y, 9, '#e9fbff', 0.5, 0.45); }
    else if (e.type === 'pickup') { if (!(musicOn && song)) { tone(e.kind === 'snail' ? 523 : 659, 0.1, 0.07, 'triangle'); later(90, () => tone(e.kind === 'snail' ? 784 : 988, 0.2, 0.07, 'triangle')); } else if (!sung) { tone(song.chime(s.riders.length), 0.1, 0.07, 'triangle'); later(90, () => tone(song.chime(s.riders.length + 2), 0.2, 0.07, 'triangle')); } burst(e.x, e.y, 14, '#ffc857', 0.55, 0.7, 3.5); ring(e.x, e.y, 0.22, 0.6, 3); rec.event('pickup', { kind: e.kind, y: Math.round(e.y * 10) / 10 }); }
    else if (e.type === 'swat') { noise(0.3, 0.32, 420); tone(110, 0.25, 0.1, 'square', -50); shake = 14; burst(e.x, e.y, 22, '#e9fbff', 0.9, 0.7, 4); ring(e.x, e.y, 0.35, 0.8, 4); rec.event('swat', { y: Math.round(e.y * 10) / 10 }); }
    else if (e.type === 'paw') { if (Math.abs(e.y - s.b.y) < 2) { noise(0.22, 0.2, 600); shake = Math.max(shake, 5); burst(e.x, e.y, 14, '#e9fbff', 0.7, 0.6, 3.5); ring(e.x, e.y, 0.3, 0.7, 3); } }
    else if (e.type === 'bump') { tone(150, 0.07, 0.06, 'triangle', -40); shake = Math.max(shake, 4); burst(e.x, e.y, 6, '#e9fbff', 0.35, 0.4); }
    else if (e.type === 'knock') { tone(320, 0.05, 0.05, 'triangle'); }
    else if (e.type === 'leaf') { noise(0.12, 0.09, 3200); burst(e.x, e.y, 5, '#f2a65a', 0.25, 0.6); }
    else if (e.type === 'drain') { tone(330, 0.8, 0.09, 'sawtooth', -280); noise(0.5, 0.2, 500); shake = 10; rec.event('drain', { y: Math.round(e.y * 10) / 10 }); }
    else if (e.type === 'sink') { tone(260, 0.7, 0.08, 'sine', -200); later(250, () => tone(180, 0.6, 0.06, 'sine', -120)); burst(e.x, e.y, 16, '#bfe9f2', 0.3, 1.0); }
    else if (e.type === 'win') { for (let i = 0; i < 5; i++) later(i * 140, () => burst(s.b.x + (Math.random() - 0.5) * 0.5, s.b.y + Math.random() * 0.5, 16, ['#ffc857', '#e5484d', '#8fd8d2', '#fff'][i % 4], 0.8, 1.1, 4)); tone(784, 0.2, 0.07, 'triangle'); }
  }
}
let drip = 0;
function update(dt) {
  if (song && live && songFor !== s) { songFor = s; song.start((s.seed * 31 + s.level) >>> 0); } // each run its own tune, from its seed
  song?.set({ on: musicOn && save.sound && live && mode === 'play' && !s.over, ...(live ? mood(s) : {}) });
  if (mode === 'play') {
    acc += Math.min(dt, 0.1);
    while (acc >= DT) {
      acc -= DT;
      if (!s.over) {
        const before = look(s);
        step(s, queue); queue = [];
        const h = heard(before, s); let sung = 0;
        if (musicOn && song) for (let i = 0; i < h.notes; i++) if (song.ember()) sung++;
        for (let i = 0; i < h.misses; i++) song?.miss();
        for (let i = 0; i < h.blows; i++) song?.hit();
        events(sung);
        if (s.over) overAt = now;
      }
      else if (s.over === 'win') { s.b.y += 0.25 * DT; s.b.wob *= 0.97; }
    }
    if (s.over && now - overAt > (s.over === 'win' ? 1500 : 1300)) finish();
    if (!s.over && Math.random() < dt * 9) wake.push({ x: s.b.x + (Math.random() - 0.5) * 0.05, y: s.b.y - 0.07, age: 0 });
    drip -= dt;
    if (drip < 0) { drip = 0.25 + Math.random() * 0.5; tone(900 + Math.random() * 1400, 0.03, 0.006, 'sine'); }
  } else if (mode === 'menu') {
    // The menu shows a live stream behind the card: an empty street, the boat carried along it for ever.
    step(s);
    if (s.over) { s = create({ level: 1, seed: 7 + Math.floor(now) }); cam = 0; }
  }
  if (mode !== 'paused') {
    cam += (s.b.y - cam) * Math.min(1, dt * 5);
    shake *= Math.pow(0.002, dt);
    for (const p of fx) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].age > fx[i].life) fx.splice(i, 1);
    for (const r of rings) r.age += dt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].age > rings[i].life) rings.splice(i, 1);
    for (const w of wake) w.age += dt;
    while (wake.length && wake[0].age > 1.2) wake.shift();
    // Rain on the water, and streamlines carried by the same flow field the boat feels.
    if (Math.random() < dt * 14) ring(Math.random(), wy(Math.random() * H), 0.03 + Math.random() * 0.03, 0.5, 1.2);
    const yTop = wy(-20), yBot = wy(H + 20);
    while (motes.length < 95) motes.push({ x: Math.random(), y: yBot + Math.random() * (yTop - yBot), age: Math.random() * 3, life: 2 + Math.random() * 2.5, vx: 0, vy: 0 });
    for (const m of motes) {
      const [vx, vy] = flow(s, m.x, m.y);
      m.vx = vx; m.vy = vy; m.x += vx * dt; m.y += vy * dt; m.age += dt;
      if (m.age > m.life || m.y > yTop || m.y < yBot || m.x < 0.02 || m.x > 0.98) { m.x = 0.04 + Math.random() * 0.92; m.y = yBot + Math.random() * (yTop - yBot); m.age = 0; m.life = 2 + Math.random() * 2.5; m.vx = m.vy = 0; }
    }
  }
}

// ---- drawing ----
const h32 = (id) => { let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function drawStreet(t) {
  // pavement
  g.fillStyle = '#3a3944'; g.fillRect(0, 0, W, H);
  const tile = cw * 0.34, off = ((cam * cw) % tile + tile) % tile;
  g.strokeStyle = '#2f2e38'; g.lineWidth = 2; g.beginPath();
  for (let y = -tile + off; y < H + tile; y += tile) { g.moveTo(0, y); g.lineTo(W, y); }
  for (let i = 0, row = Math.floor(cam * cw / tile); i < 40; i++) { const y = -tile + off + i * tile; if (y > H) break; const shift = ((row - i) & 1) * tile * 0.5; for (let x = (x0 % tile) - tile + shift; x < W; x += tile) { g.moveTo(x, y); g.lineTo(x, y + tile); } }
  g.stroke();
  // water
  const len = length(s), yEnd = Number.isFinite(len) ? sy(len) : -1e6;
  if (yEnd > -cw * 2.4) {
    const cy = yEnd - cw * 0.95;
    g.fillStyle = '#4f4a44'; g.beginPath(); g.ellipse(W / 2, cy, cw * 1.22, cw * 1.12, 0, 0, 6.3); g.fill();
    const pg = g.createRadialGradient(W / 2, cy, cw * 0.1, W / 2, cy, cw * 1.15);
    pg.addColorStop(0, '#5bb8ad'); pg.addColorStop(1, '#2f7f84');
    g.fillStyle = pg; g.beginPath(); g.ellipse(W / 2, cy, cw * 1.14, cw * 1.04, 0, 0, 6.3); g.fill();
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, px = W / 2 + Math.cos(a) * cw * (0.55 + (i % 3) * 0.16), py = cy - Math.abs(Math.sin(a)) * cw * 0.55 - cw * 0.05, r = cw * (0.07 + (i % 2) * 0.03); g.fillStyle = i % 2 ? '#7cc47a' : '#63ad69'; g.beginPath(); g.moveTo(px, py); g.arc(px, py, r, 0.4 + i, 6.0 + i); g.closePath(); g.fill(); if (i % 3 === 0) { g.fillStyle = '#ffd9e6'; g.beginPath(); g.arc(px, py, r * 0.3, 0, 6.3); g.fill(); } }
  }
  const wg = g.createLinearGradient(x0, 0, x0 + cw, 0);
  wg.addColorStop(0, '#22596b'); wg.addColorStop(0.5, '#2f7a8a'); wg.addColorStop(1, '#22596b');
  g.fillStyle = wg; g.fillRect(x0, Math.max(-5, yEnd), cw, H + 10);
  // slow bands of light drifting with the current
  g.save(); g.beginPath(); g.rect(x0, Math.max(0, yEnd), cw, H); g.clip();
  g.strokeStyle = '#ffffff0d'; g.lineWidth = cw * 0.05;
  for (let i = 0; i < 9; i++) { const yy = ((i * 0.37 - t * 0.12 - cam) % 3 + 3) % 3; const py = H - (yy / 3) * (H + 80) + 40; g.beginPath(); g.moveTo(x0, py); g.bezierCurveTo(x0 + cw * 0.3, py - 22, x0 + cw * 0.7, py + 22, x0 + cw, py); g.stroke(); }
  // bands: downpipe gushes and rapids
  for (const it of items(s, cam - 1.2, cam + 2.6)) {
    if (it.k === 'gush') {
      const ya = sy(it.y + it.h), yb = sy(it.y);
      const gg = g.createLinearGradient(it.dir > 0 ? x0 : x0 + cw, 0, it.dir > 0 ? x0 + cw : x0, 0);
      gg.addColorStop(0, '#ffffff40'); gg.addColorStop(1, '#ffffff05');
      g.fillStyle = gg; g.fillRect(x0, ya, cw, yb - ya);
      g.strokeStyle = '#ffffff90'; g.lineWidth = 2.5; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const u = ((i / 9 + t * 0.7) % 1), yy = ya + ((i * 53) % 97) / 97 * (yb - ya), xx = it.dir > 0 ? x0 + u * cw : x0 + cw - u * cw; g.globalAlpha = 1 - u; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + it.dir * cw * 0.09, yy - 3); g.stroke(); }
      g.globalAlpha = 1;
    } else if (it.k === 'rapid') {
      const ya = sy(it.y + it.h), yb = sy(it.y);
      g.fillStyle = '#ffffff12'; g.fillRect(x0, ya, cw, yb - ya);
      g.strokeStyle = '#ffffff75'; g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
      const n = Math.ceil(it.h * 5);
      for (let i = 0; i < n; i++) { const u = ((i / n + t * 0.45) % 1), yy = yb - u * (yb - ya), xx = x0 + cw * (0.15 + ((i * 37) % 71) / 71 * 0.7), w = cw * 0.045; g.globalAlpha = Math.sin(u * 3.14); g.beginPath(); g.moveTo(xx - w, yy + w * 0.7); g.lineTo(xx, yy); g.lineTo(xx + w, yy + w * 0.7); g.stroke(); }
      g.globalAlpha = 1;
    }
  }
  // streamlines
  g.lineCap = 'round'; g.lineWidth = 2;
  for (const m of motes) {
    const a = Math.sin((m.age / m.life) * 3.14) * 0.42, k = 0.24 * cw;
    const px = sx(m.x), py = sy(m.y);
    g.strokeStyle = `rgba(214,244,247,${a.toFixed(3)})`;
    g.beginPath(); g.moveTo(px - m.vx * k, py + m.vy * k); g.lineTo(px, py); g.stroke();
  }
  g.restore();
}
function drawKerbs() {
  const k = Math.max(12, cw * 0.06), block = cw * 0.5, off = ((cam * cw) % block + block) % block, len = length(s), yEnd = Number.isFinite(len) ? sy(len) : -1e6;
  for (const side of [0, 1]) {
    const x = side ? x0 + cw : x0 - k;
    g.fillStyle = '#00000038'; g.fillRect(side ? x - 5 : x + k, Math.max(0, yEnd), 5, H);
    for (let y = -block + off; y < H + block; y += block) {
      if (y + block < yEnd) continue;
      const ya = Math.max(y, yEnd);
      g.fillStyle = '#9a968f'; g.fillRect(x, ya + 1, k, y + block - ya - 2);
      g.fillStyle = '#b8b3aa'; g.fillRect(x + (side ? 0 : k * 0.55), ya + 1, k * 0.45, y + block - ya - 2);
    }
    // pipes for gushes
    for (const it of items(s, cam - 1.2, cam + 2.6)) if (it.k === 'gush' && (it.dir > 0) === !side) { const py = sy(it.y + it.h / 2); g.fillStyle = '#5d6b72'; g.beginPath(); g.roundRect(side ? x - 4 : x - 6, py - cw * 0.09, k + 10, cw * 0.18, 6); g.fill(); g.fillStyle = '#1b2a31'; g.beginPath(); g.ellipse(side ? x - 2 : x + k + 2, py, 5, cw * 0.065, 0, 0, 6.3); g.fill(); }
  }
}
function drawItem(it, t) {
  const px = sx(it.x), py = sy(it.y), h = h32(it.id + it.k);
  if (it.k === 'drain') {
    if (it.grate) {
      const parted = grateParted(s, it);
      g.fillStyle = parted ? '#163d43' : '#0a151b'; g.fillRect(x0, py - cw * 0.045, cw, cw * 0.09);
      g.strokeStyle = '#839399'; g.lineWidth = 3;
      for (let i = 0; i < 15; i++) { const x = x0 + (i + 0.5) * cw / 15; g.beginPath(); g.moveTo(x - 3, py - cw * 0.04); g.lineTo(x + 3, py + cw * 0.04); g.stroke(); }
      if (parted) {
        g.strokeStyle = '#8fd8d2'; g.lineWidth = 5;
        for (const dir of [-1, 1]) { g.beginPath(); g.moveTo(px, py + cw * 0.42); g.quadraticCurveTo(px + dir * cw * 0.28, py + cw * 0.22, px + dir * cw * 0.24, py - cw * 0.2); g.stroke(); }
      }
    }
    const r = cw * 0.105;
    g.fillStyle = '#0c1c2499'; g.beginPath(); g.arc(px, py, r * 1.7, 0, 6.3); g.fill();
    g.strokeStyle = '#d6f4f7'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = -t * 2.6 + i * 2.09; g.globalAlpha = 0.5; g.beginPath(); g.arc(px, py, r * (1.25 + 0.2 * i), a, a + 1.5); g.stroke(); g.beginPath(); g.arc(px, py, r * 2.1, -t * 1.3 + i * 2.09, -t * 1.3 + i * 2.09 + 0.8); g.globalAlpha = 0.22; g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = '#0a151b'; g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill();
    g.strokeStyle = '#56646b'; g.lineWidth = 3; g.beginPath(); g.arc(px, py, r, 0, 6.3); g.stroke();
    g.save(); g.beginPath(); g.arc(px, py, r - 1, 0, 6.3); g.clip(); g.lineWidth = 3.5; g.beginPath();
    for (let i = -2; i <= 2; i++) { g.moveTo(px + i * r * 0.42, py - r); g.lineTo(px + i * r * 0.42, py + r); }
    g.stroke(); g.restore();
  } else if (it.k === 'leaf') {
    const r = it.r * cw, cols = ['#e08a3c', '#d9a441', '#c8553d', '#b9892f'];
    g.save(); g.translate(px, py + Math.sin(t * 1.7 + h) * 2); g.rotate((h % 628) / 100 + Math.sin(t * 0.8 + h) * 0.12);
    g.fillStyle = '#0003'; g.beginPath(); g.ellipse(3, 5, r * 1.05, r * 0.62, 0, 0, 6.3); g.fill();
    g.fillStyle = cols[h % 4]; g.beginPath(); g.moveTo(-r * 1.15, 0); g.quadraticCurveTo(0, -r * 1.05, r * 1.15, 0); g.quadraticCurveTo(0, r * 1.05, -r * 1.15, 0); g.fill();
    g.strokeStyle = '#0000002e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-r * 1.3, 0); g.lineTo(r * 1.05, 0);
    for (let i = -2; i <= 2; i++) { g.moveTo(i * r * 0.36, 0); g.lineTo(i * r * 0.36 + r * 0.2, -r * 0.34); g.moveTo(i * r * 0.36, 0); g.lineTo(i * r * 0.36 + r * 0.2, r * 0.34); }
    g.stroke(); g.restore();
  } else if (it.k === 'bug' && !s.got[it.id]) {
    const bob = Math.sin(t * 2.4 + h) * 2.5, r = cw * 0.052;
    g.strokeStyle = '#ffc85799'; g.lineWidth = 2.5; const pr = cw * (0.085 + 0.012 * Math.sin(t * 4 + h));
    g.beginPath(); g.arc(px, py, pr * 1.25, 0, 6.3); g.stroke();
    g.fillStyle = '#0003'; g.beginPath(); g.ellipse(px + 2, py + 4, pr, pr * 0.9, 0, 0, 6.3); g.fill();
    g.fillStyle = '#b08a55'; g.beginPath(); g.ellipse(px, py + bob * 0.3, pr, pr * 0.86, 0, 0, 6.3); g.fill(); // a cork raft
    g.fillStyle = '#c9a36b'; g.beginPath(); g.ellipse(px - 1, py - 1 + bob * 0.3, pr * 0.78, pr * 0.64, 0, 0, 6.3); g.fill();
    rider(it.kind, px, py + bob * 0.3 - 1, r, t + h);
  }
}
function rider(kind, px, py, r, t) {
  if (kind === 'ladybird') {
    g.fillStyle = '#16242c'; g.beginPath(); g.arc(px, py - r * 0.75, r * 0.5, 0, 6.3); g.fill();
    g.fillStyle = '#e5484d'; g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill();
    g.strokeStyle = '#16242c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py - r); g.lineTo(px, py + r); g.stroke();
    g.fillStyle = '#16242c'; for (const [a, b] of [[-0.45, -0.25], [0.45, -0.25], [-0.4, 0.4], [0.4, 0.4]]) { g.beginPath(); g.arc(px + a * r, py + b * r, r * 0.2, 0, 6.3); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px - r * 0.2, py - r * 0.85, r * 0.12, 0, 6.3); g.arc(px + r * 0.2, py - r * 0.85, r * 0.12, 0, 6.3); g.fill();
  } else {
    const st = Math.sin(t * 2) * r * 0.1;
    g.fillStyle = '#e9d8a6'; g.beginPath(); g.ellipse(px, py - r * 0.5, r * 0.42, r * 1.1, 0, 0, 6.3); g.fill();
    g.strokeStyle = '#e9d8a6'; g.lineWidth = 2; g.beginPath(); g.moveTo(px - r * 0.2, py - r * 1.4); g.lineTo(px - r * 0.45 + st, py - r * 1.95); g.moveTo(px + r * 0.2, py - r * 1.4); g.lineTo(px + r * 0.45 - st, py - r * 1.95); g.stroke();
    g.fillStyle = '#b5651d'; g.beginPath(); g.arc(px, py + r * 0.15, r * 0.95, 0, 6.3); g.fill();
    g.strokeStyle = '#7a3e12'; g.lineWidth = 2; g.beginPath();
    for (let a = 0; a < 11; a += 0.3) { const rr = r * 0.07 * a, x = px + Math.cos(a) * rr, y = py + r * 0.15 + Math.sin(a) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
}
function drawPaw(it, t) {
  const p = pawState(s, it), px = sx(it.x), py = sy(it.y), r = PAW_R * cw;
  const kerb = it.side < 0 ? x0 - 40 : x0 + cw + 40;
  let reach = 0, lift = 1; // reach 0..1 from kerb to target; lift 1 = high above water
  if (p.down) { reach = 1; lift = 0; }
  else if (p.warn) { const u = 1 - (p.left - 0.25) / (PAW_WARN - 0.25); reach = Math.min(1, u * 1.6); lift = 1 - Math.max(0, u - 0.75) * 2; }
  else if (p.c < 0.5) { reach = 1 - p.c / 0.5; lift = 0.4 + p.c; }
  if (p.warn) { // shadow where it will land
    const u = 1 - p.left / PAW_WARN;
    g.fillStyle = `rgba(8,18,24,${(0.15 + 0.4 * u).toFixed(2)})`; g.beginPath(); g.arc(px, py, r * (0.6 + 0.4 * u), 0, 6.3); g.fill();
    g.strokeStyle = `rgba(255,200,87,${(0.4 + 0.5 * Math.abs(Math.sin(t * 9))).toFixed(2)})`; g.lineWidth = 3; g.setLineDash([8, 7]); g.beginPath(); g.arc(px, py, r, t, t + 6.3); g.stroke(); g.setLineDash([]);
  }
  if (reach <= 0.01) { // the cat waits: two ears over the kerb
    g.fillStyle = '#d98a3d'; const ex = it.side < 0 ? x0 - cw * 0.06 - 16 : x0 + cw + cw * 0.06 + 16;
    g.beginPath(); g.arc(ex, py, 20, 0, 6.3); g.fill();
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(ex - it.side * 4, py + d * 8); g.lineTo(ex - it.side * 20, py + d * 20); g.lineTo(ex - it.side * 14, py + d * 2); g.fill(); }
    return;
  }
  const tx = kerb + (px - kerb) * reach, s2 = 1 + lift * 0.35, off = -lift * 26;
  g.save(); g.globalAlpha = 0.55 + 0.45 * (1 - lift);
  g.strokeStyle = '#d98a3d'; g.lineWidth = r * 0.95 * s2; g.lineCap = 'round'; g.beginPath(); g.moveTo(kerb, py + off * 0.4); g.lineTo(tx, py + off); g.stroke();
  g.strokeStyle = '#c0732b'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { const ux = kerb + (tx - kerb) * (i / 4.4); g.beginPath(); g.moveTo(ux, py + off - r * 0.35); g.lineTo(ux + 4, py + off + r * 0.35); g.stroke(); }
  g.fillStyle = '#f4e3cf'; g.beginPath(); g.arc(tx, py + off, r * 0.72 * s2, 0, 6.3); g.fill();
  g.fillStyle = '#e79aa5'; g.beginPath(); g.ellipse(tx, py + off + r * 0.12, r * 0.3 * s2, r * 0.24 * s2, 0, 0, 6.3); g.fill();
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(tx + i * r * 0.36 * s2 * (it.side < 0 ? 1 : 1), py + off - r * 0.34 * s2 + Math.abs(i) * r * 0.1, r * 0.15 * s2, 0, 6.3); g.fill(); }
  g.restore();
}
function drawBoat(t) {
  const b = s.b, px = sx(b.x), py = sy(b.y), r = BOAT_R * cw * 1.4;
  let sc = 1 + 0.03 * Math.sin(t * 3.1), alpha = 1, spin = 0;
  if (s.over === 'drain') { const u = Math.min(1, (now - overAt) / 900); sc *= 1 - u; spin = u * u * 14; }
  if (s.over === 'soak') { const u = Math.min(1, (now - overAt) / 1100); alpha = 1 - u; sc *= 1 - 0.35 * u; }
  for (const w of wake) { const a = 0.3 * (1 - w.age / 1.2); g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; g.beginPath(); g.arc(sx(w.x), sy(w.y), 2 + w.age * 5, 0, 6.3); g.fill(); }
  if (sc <= 0.01) return;
  const wob = Math.sin(t * 11) * b.wob * 0.22, sq = 1 + Math.sin(t * 14) * b.wob * 0.12;
  g.save(); g.globalAlpha = alpha; g.translate(px, py); g.rotate(b.a + wob + spin); g.scale(sc * sq, sc / sq);
  g.fillStyle = '#06141b40'; g.beginPath(); g.ellipse(4, 7, r * 0.95, r * 1.7, 0, 0, 6.3); g.fill();
  // foam at the bow
  g.strokeStyle = '#ffffffb0'; g.lineWidth = 2; g.beginPath(); g.arc(0, -r * 1.25, r * 0.9, 3.5 + Math.sin(t * 6) * 0.1, 5.9 + Math.sin(t * 5) * 0.1); g.stroke();
  const wet = Math.min(1, s.soak), mix = (a, c) => Math.round(a + (c - a) * wet * 0.75);
  const hull = (l) => `rgb(${mix(247 * l, 120)},${mix(241 * l, 160)},${mix(225 * l, 178)})`;
  g.fillStyle = hull(1); g.beginPath(); g.moveTo(0, -r * 1.75); g.quadraticCurveTo(r * 1.05, -r * 0.2, r * 0.8, r * 0.3); g.lineTo(0, r * 1.75); g.lineTo(-r * 0.8, r * 0.3); g.quadraticCurveTo(-r * 1.05, -r * 0.2, 0, -r * 1.75); g.fill();
  g.fillStyle = hull(0.88); g.beginPath(); g.moveTo(0, -r * 1.75); g.quadraticCurveTo(-r * 1.05, -r * 0.2, -r * 0.8, r * 0.3); g.lineTo(0, r * 1.75); g.closePath(); g.fill();
  // the folded peak
  g.fillStyle = hull(1.03); g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(r * 0.5, r * 0.15); g.lineTo(0, r * 0.85); g.closePath(); g.fill();
  g.fillStyle = hull(0.8); g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(-r * 0.5, r * 0.15); g.lineTo(0, r * 0.85); g.closePath(); g.fill();
  // the damp line climbs from the stern
  if (wet > 0.05) { g.save(); g.beginPath(); g.rect(-r * 1.2, r * 1.75 - wet * r * 3.5, r * 2.4, r * 4); g.clip(); g.fillStyle = '#3d7d9455'; g.beginPath(); g.moveTo(0, -r * 1.75); g.quadraticCurveTo(r * 1.05, -r * 0.2, r * 0.8, r * 0.3); g.lineTo(0, r * 1.75); g.lineTo(-r * 0.8, r * 0.3); g.quadraticCurveTo(-r * 1.05, -r * 0.2, 0, -r * 1.75); g.fill(); g.restore(); }
  s.riders.slice(-4).forEach((kind, i) => rider(kind, (i % 2 ? -1 : 1) * r * 0.36, r * (0.55 - 0.62 * Math.floor(i / 2)) + (i % 2) * r * 0.5 - r * 0.9, r * 0.36, t + i));
  g.restore();
}
function drawHud(t) {
  const y = top + 14, bw = Math.min(150, W * 0.36), x = Math.max(12, (W - 560) / 2 + 12);
  g.fillStyle = '#16242cc9'; g.beginPath(); g.roundRect(x, y, bw + 44, 40, 20); g.fill();
  // a drop, then the paper that is still dry
  const danger = s.soak > 0.72, pulse = danger ? 1 + 0.12 * Math.sin(t * 10) : 1;
  g.save(); g.translate(x + 21, y + 21); g.scale(pulse, pulse); g.fillStyle = danger ? '#ff8f6b' : '#8fd8d2'; g.beginPath(); g.moveTo(0, -11); g.bezierCurveTo(9, 0, 8, 9, 0, 9); g.bezierCurveTo(-8, 9, -9, 0, 0, -11); g.fill(); g.restore();
  if (s.riders.includes('snail')) { // a shell round the rain drop: its passenger shelters the paper
    g.strokeStyle = '#8fd8d2'; g.lineWidth = 2; g.beginPath(); g.arc(x + 21, y + 21, 16, -2.7, 0.4); g.stroke();
  }
  g.fillStyle = '#ffffff22'; g.beginPath(); g.roundRect(x + 38, y + 13, bw - 6, 14, 7); g.fill();
  const dry = Math.max(0, 1 - s.soak);
  g.fillStyle = danger ? '#ff8f6b' : '#f7f1e1'; g.beginPath(); g.roundRect(x + 38, y + 13, Math.max(8, (bw - 6) * dry), 14, 7); g.fill();
  if (!daily) { const xx = x + 38 + (bw - 6) * (1 - STAR_SOAK); g.strokeStyle = '#ffc857'; g.lineWidth = 3; g.beginPath(); g.moveTo(xx, y + 10); g.lineTo(xx, y + 30); g.stroke(); g.fillStyle = '#ffc857'; g.font = '14px system-ui'; g.textAlign = 'center'; g.fillText('★', xx, y + 42); }
  // passengers aboard, and those still waiting
  const total = daily ? s.riders.length : LEVELS[level - 1].bugs;
  for (let i = 0; i < Math.min(total, 6); i++) { const cx = x + 20 + i * 30, cy = y + 64; g.fillStyle = '#16242cc9'; g.beginPath(); g.arc(cx, cy, 14, 0, 6.3); g.fill(); if (i < s.riders.length) rider(s.riders[i], cx, cy + (s.riders[i] === 'snail' ? 3 : 1), 8, t); else { g.strokeStyle = '#ffffff55'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(cx, cy, 8, 0, 6.3); g.stroke(); g.setLineDash([]); } }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (daily) { g.textAlign = 'left'; g.font = '900 26px ui-rounded, "Trebuchet MS", system-ui, sans-serif'; g.fillStyle = '#0008'; g.fillText(score(s), x + bw + 55, y + 23); g.fillStyle = '#ffc857'; g.fillText(score(s), x + bw + 54, y + 21); }
  else { // progress down the street, on the right kerb
    const len = LEVELS[level - 1].len, u = Math.min(1, s.b.y / len), bx = x0 + cw + Math.max(12, cw * 0.06) + 9, by0 = H * 0.78, by1 = H * 0.3;
    if (bx + 8 < W) { g.strokeStyle = '#ffffff30'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by0); g.lineTo(bx, by1); g.stroke(); g.strokeStyle = '#8fd8d2'; g.beginPath(); g.moveTo(bx, by0); g.lineTo(bx, by0 + (by1 - by0) * u); g.stroke(); g.fillStyle = '#5bb8ad'; g.beginPath(); g.arc(bx, by1 - 9, 6, 0, 6.3); g.fill(); }
  }
}
function drawCue(t) {
  // This street's ghost taps the upstream intake; it stays until a pebble parts the grate.
  const tap = mode === 'play' && !help.shown ? pebbleHint(s) : null;
  if (tap) {
    const px = sx(tap.x), py = sy(tap.y), phase = (t % 1.8) / 1.8;
    g.save(); g.translate(px, py);
    g.strokeStyle = '#ffc857'; g.lineWidth = 3; g.globalAlpha = 0.85;
    g.beginPath(); g.arc(0, 0, 16 + phase * 20, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.75; g.fillStyle = '#fff'; g.translate(0, 10 + Math.sin(phase * Math.PI) * 14);
    g.beginPath(); g.roundRect(-5, -10, 10, 34, 5); g.roundRect(-12, 8, 30, 25, 9); g.fill();
    g.restore();
    return;
  }
  // Street 1 and 2, before the first touch: chevrons on the water show which way to sweep it.
  if (mode !== 'play' || daily || level > 2 || s.acts > 0 || s.over) return;
  const b = s.b;
  let dir = 0;
  for (const it of LEVELS[level - 1].items) { if (it.y < b.y + 0.1 || it.y > b.y + 2.4) continue; if (it.k === 'bug') dir = it.x > b.x ? 1 : -1; else if (it.k === 'drain') dir = b.x >= it.x ? 1 : -1; break; }
  if (!dir) return;
  const px = sx(b.x), py = sy(b.y) + cw * 0.02;
  g.strokeStyle = '#ffc857'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { const u = ((t * 1.1 + i / 3) % 1), xx = px - dir * cw * 0.3 + dir * u * cw * 0.34, w = cw * 0.03; g.globalAlpha = Math.sin(u * 3.14) * 0.9; g.beginPath(); g.moveTo(xx - dir * w, py - w * 1.3); g.lineTo(xx, py); g.lineTo(xx - dir * w, py + w * 1.3); g.stroke(); }
  g.globalAlpha = 1;
}
function draw(t) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.save();
  if (shake > 0.3) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawStreet(t);
  const near = items(s, cam - 1.2, cam + 2.8).filter((it) => it.y > cam - 1.2 && it.y < cam + 2.8);
  g.save(); g.beginPath(); g.rect(x0, -10, cw, H + 20); const len = length(s); if (Number.isFinite(len)) g.rect(0, -10, W, Math.max(0, sy(len) + 10)); g.clip();
  for (const it of near) if (it.k === 'drain') drawItem(it, t);
  for (const r of rings) { const u = r.age / r.life; g.strokeStyle = `rgba(233,251,255,${(0.6 * (1 - u)).toFixed(2)})`; g.lineWidth = r.w; g.beginPath(); g.ellipse(sx(r.x), sy(r.y), r.max * cw * u, r.max * cw * u * 0.9, 0, 0, 6.3); g.stroke(); }
  for (const rp of s.ripples) {
    const u = rp.age / RIPPLE_LIFE, px = sx(rp.x), py = sy(rp.y), a = Math.atan2(-rp.dy, rp.dx);
    g.save(); g.translate(px, py); g.rotate(a); g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${((1 - u) * (0.85 - i * 0.22) * (0.5 + rp.a * 0.5)).toFixed(2)})`; g.lineWidth = 4 - i; g.beginPath(); g.arc(-cw * (0.1 + i * 0.055), 0, cw * (0.13 + i * 0.012), -0.75, 0.75); g.stroke(); }
    g.restore();
  }
  for (const it of near) if (it.k === 'leaf' || it.k === 'bug') drawItem(it, t);
  for (const st of s.stones) {
    const px = sx(st.x), py = sy(st.y), r = cw * 0.04, a = Math.min(1, (STONE_LIFE - st.age) / 0.6), drop = Math.min(1, st.age / 0.12);
    g.globalAlpha = a;
    g.strokeStyle = '#ffffffa8'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.arc(px, py + r * 0.2, r * 1.5 + Math.sin(t * 7 + px) * 1.2, 0.5, 2.64); g.stroke();
    g.beginPath(); g.moveTo(px - r * 1.3, py - r * 0.4); g.lineTo(px - r * 1.7, py - r * 2.4); g.moveTo(px + r * 1.3, py - r * 0.4); g.lineTo(px + r * 1.7, py - r * 2.4); g.globalAlpha = a * 0.4; g.stroke(); g.globalAlpha = a;
    g.fillStyle = '#0003'; g.beginPath(); g.ellipse(px + 2, py + 3, r, r * 0.85, 0, 0, 6.3); g.fill();
    g.fillStyle = '#8c8f96'; g.beginPath(); g.ellipse(px, py, r * (1.5 - 0.5 * drop), r * 0.85 * (1.5 - 0.5 * drop), 0.4, 0, 6.3); g.fill();
    g.fillStyle = '#c5c8cf'; g.beginPath(); g.ellipse(px - r * 0.25, py - r * 0.25, r * 0.45, r * 0.3, 0.4, 0, 6.3); g.fill();
    g.globalAlpha = 1;
  }
  drawCue(t);
  drawBoat(t);
  for (const p of fx) { const u = p.age / p.life; g.globalAlpha = 1 - u; g.fillStyle = p.colour; g.beginPath(); g.arc(sx(p.x), sy(p.y), p.size * (1 - u * 0.5), 0, 6.3); g.fill(); }
  g.globalAlpha = 1;
  g.restore();
  drawKerbs();
  for (const it of near) if (it.k === 'paw') drawPaw(it, t);
  if (stroke) { // the stroke under the finger
    const len = Math.hypot(stroke.px - stroke.x, stroke.py - stroke.y);
    if (len > 14) { g.strokeStyle = '#ffffffc0'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(stroke.x, stroke.y); g.lineTo(stroke.px, stroke.py); g.stroke(); const a = Math.atan2(stroke.py - stroke.y, stroke.px - stroke.x); g.beginPath(); g.moveTo(stroke.px - Math.cos(a - 0.5) * 14, stroke.py - Math.sin(a - 0.5) * 14); g.lineTo(stroke.px, stroke.py); g.lineTo(stroke.px - Math.cos(a + 0.5) * 14, stroke.py - Math.sin(a + 0.5) * 14); g.stroke(); }
  }
  // rain
  g.strokeStyle = '#d6f4f718'; g.lineWidth = 1.5; g.beginPath();
  for (let i = 0; i < 16; i++) { const rx = ((i * 97.3 - t * 150) % (W + 60) + W + 60) % (W + 60) - 30, ry = ((i * 61.7 + t * (640 + (i % 5) * 60)) % (H + 80)) - 40; g.moveTo(rx, ry); g.lineTo(rx - 9, ry + 20); }
  g.stroke();
  g.restore();
  if (mode === 'play' || mode === 'paused' || mode === 'end') drawHud(t);
}
function frame(ms) {
  now = ms;
  const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
  last = ms;
  update(dt);
  draw(ms / 1000);
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);

// For check.mjs and for looking at a run from the console. Nothing here changes the game.
window.boatState = () => ({ screen: mode, over: s.over, level, daily, seed: s.seed, x: s.b.x, y: s.b.y, soak: s.soak, riders: s.riders.length, t: s.tick * DT, tick: s.tick, moves: s.acts,
  ripples: s.ripples.length, stones: s.stones.length, fx: fxCount, stars: endStars, sound: save.sound, music: musicOn, len: length(s), boat: { x: sx(s.b.x), y: sy(s.b.y) }, cw, ghostTap: pebbleHint(s) ? { x: sx(pebbleHint(s).x), y: sy(pebbleHint(s).y) } : null });
window.boatMusic = () => song && { ...song.melody, on: song.state.on, step: song.step, notes: song.log.length, kinds: song.log.map(l => l.kind) }; // read by the phone check
window.boatAdvice = () => {
  if (mode !== 'play' || s.over) return null;
  const a = advise(s);
  if (!a) return null;
  const px = sx(a.x), py = sy(a.y);
  return a.k === 'pebble' ? { k: 'pebble', x: px, y: py } : { k: 'ripple', x: px, y: py, ex: px + a.dx * cw * 0.33 * a.a, ey: py - a.dy * cw * 0.33 * a.a };
};
