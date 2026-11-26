// Cinderhill's trail painter (04-roadmap S3, 03-features "trail painter toy"): the deterministic sim at 20 ticks a
// second, drawn with WebGL2, and the touch rules of 02-spec section 6.4. No goals; draw trails and watch the ants.
import { Host, CMD, SURFACE, NEST, FIELD, COUNTS, TICK_MS, G as GI } from './host.js';
import { makeGestures } from './gestures.js';
import { Renderer } from './render.js';
import { WORDS } from './words.js';
import { line } from './sim/sim.js';
import { noZoom } from '../kit/zoom.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { sound } from '../kit/audio.js';
import { hint } from '../kit/hint.js';
import { lab } from '../kit/lab.js';
import { readJson, writeJson } from '../kit/save.js';

noZoom();
const { t, lang, setLang, apply } = WORDS;
const $ = id => document.getElementById(id);
const SAVE = 'cinderhill:save', HINT = 'cinderhill:hint';
const saved0 = readJson(SAVE);
const save = { v: 1, sound: true, ants: 2000, tapTrail: false, ...(saved0 && typeof saved0 === 'object' ? saved0 : {}) };
if (!COUNTS.includes(save.ants)) save.ants = 2000;
const persist = () => writeJson(SAVE, save);
const query = new URLSearchParams(location.search);
const qAnts = Number(query.get('ants'));

let host = new Host(COUNTS.includes(qAnts) ? qAnts : save.ants);
let screen = 'menu', tool = 'trail', layer = SURFACE;
const G = makeGestures();
const snd = sound({ on: () => save.sound });
const rec = lab('cinderhill', { lang });
rec.notice($('menuCard')); rec.toggle($('pauseCard'));
let running = false; // a lab run is open

// ---- canvases, camera ----
const glCanvas = $('gl'), ui = $('c'), ctx = ui.getContext('2d');
const DPR_CAP = 2;
let W = innerWidth, H = innerHeight, dpr = Math.min(DPR_CAP, devicePixelRatio || 1);
let renderer = null, glFailed = '';
try { renderer = Renderer.create(glCanvas, { lost: () => {}, restored: () => { uploadAll(); } }); } catch (e) { glFailed = String(e.message || e).slice(0, 200); renderer = null; }
if (!renderer) $('nogl').classList.add('on');
const dims = l => (l === SURFACE ? { w: host.sim.L.sw, h: host.sim.L.sh, base: 0 } : { w: host.sim.L.nw, h: host.sim.L.nh, base: host.sim.L.nestBase });
const cams = [null, null];
function fitCams() {
  const L = host.sim.L, z0 = Math.max(3, Math.min(W, H) / 105);
  cams[SURFACE] = { x: L.sw / 2 + 0.5, y: L.sh / 2 + 0.5, z: z0 };
  cams[NEST] = { x: L.nw / 2, y: 30, z: Math.max(W / 70, 3) };
}
const zMin = () => { const d = dims(layer); return Math.min(W / d.w, H / d.h) * 0.8; };
function clampCam() {
  const c = cams[layer], d = dims(layer);
  c.z = Math.max(zMin(), Math.min(48, c.z));
  c.x = Math.max(0, Math.min(d.w, c.x)); c.y = Math.max(0, Math.min(d.h, c.y));
}
const toWorld = (sx, sy) => { const c = cams[layer]; return { x: c.x + (sx - W / 2) / c.z, y: c.y + (sy - H / 2) / c.z }; };
const toScreen = (wx, wy, l = layer) => { const c = cams[l]; return { x: (wx - c.x) * c.z + W / 2, y: (wy - c.y) * c.z + H / 2 }; };
function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(DPR_CAP, devicePixelRatio || 1);
  ui.width = Math.round(W * dpr); ui.height = Math.round(H * dpr);
  renderer?.resize(W, H, dpr);
  if (cams[0]) clampCam();
}
addEventListener('resize', resize);
fitCams(); resize();

// ---- uploads at tick rate ----
let inst = new Float32Array(5000 * 8), drawnAnts = 0, scentBuf = null, uploadedTerrain = -1;
function uploadAnts() {
  if (!renderer) return;
  const s = host.sim, n = s.n, need = n * 8;
  if (inst.length < need) inst = new Float32Array(need);
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (s.layer[i] !== layer) continue;
    const jump = host.pl[i] !== s.layer[i];
    const x = s.x[i] / 256, y = s.y[i] / 256;
    inst[k] = jump ? x : host.px[i] / 256; inst[k + 1] = jump ? y : host.py[i] / 256; inst[k + 2] = x; inst[k + 3] = y;
    inst[k + 4] = s.heading[i] * (Math.PI / 128); inst[k + 5] = s.job[i]; inst[k + 6] = s.carry[i]; inst[k + 7] = (i * 0.618034) % 1;
    k += 8;
  }
  drawnAnts = k / 8;
  renderer.setAnts(inst, drawnAnts);
}
// Scent to bytes: a log scale, 16 steps per doubling, from about 1,000 (faint) to the 24-bit cap.
const byteOf = v => { if (v < 1024) return 0; const e = 31 - Math.clz32(v), m = (v >>> (e - 4)) & 15, L = e * 16 + m - 160; return L > 255 ? 255 : L * 1.15 > 255 ? 255 : (L * 1.15) | 0; };
function uploadScent() {
  if (!renderer) return;
  const d = dims(layer), n = d.w * d.h, S = host.sim.scent.cur;
  if (!scentBuf || scentBuf.length !== n * 4) scentBuf = new Uint8Array(n * 4);
  const tr = S[FIELD.TRAIL], fo = S[FIELD.FOOD], al = S[FIELD.ALARM];
  for (let i = 0, c = d.base; i < n; i++, c++) { const o = i * 4; scentBuf[o] = byteOf(tr[c]); scentBuf[o + 1] = byteOf(fo[c]); scentBuf[o + 2] = byteOf(al[c]); }
  renderer.setScent(layer, d.w, d.h, scentBuf);
}
function uploadTerrain() {
  if (!renderer) return;
  for (const l of [SURFACE, NEST]) { const d = dims(l); renderer.setTerrain(l, d.w, d.h, host.sim.mat.subarray(d.base, d.base + d.w * d.h), host.sim.dig.subarray(d.base, d.base + d.w * d.h)); }
  uploadedTerrain = host.terrainVersion;
}
function uploadAll() { uploadTerrain(); uploadScent(); uploadAnts(); }
uploadAll();

// ---- words and controls ----
function retext() {
  apply();
  $('layer').textContent = layer === SURFACE ? t('nest') : t('surface');
  $('recall').textContent = host.sim.g[GI.RECALL] ? t('sendOut') : t('recall');
  $('recall').setAttribute('aria-pressed', String(!!host.sim.g[GI.RECALL]));
  $('sound').textContent = save.sound ? t('soundOn') : t('soundOff');
  $('tapTrail').textContent = save.tapTrail ? t('tapTrailOn') : t('tapTrailOff');
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  for (const b of document.querySelectorAll('[data-count]')) b.setAttribute('aria-pressed', String(Number(b.dataset.count) === host.ants));
}
retext();
let toastTimer = 0;
function toast(key) { const el = $('toast'); el.textContent = t(key); el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1800); }

function setScreen(s) {
  screen = s;
  $('menu').classList.toggle('on', s === 'menu');
  $('paused').classList.toggle('on', s === 'paused');
  document.body.classList.toggle('playing', s !== 'menu');
}
function play() {
  snd.unlock();
  if (saved0 === null && readJson(SAVE) === null) persist();
  if (!running) { rec.start({ ants: host.ants }); running = true; }
  setScreen('play'); host.last = null; snd.release();
}
function pauseGame() {
  if (screen !== 'play') return;
  run(G.reset('pause'));
  setScreen('paused'); snd.hold();
}
function resume() { setScreen('play'); host.last = null; snd.release(); }
function toMenu() {
  if (running) { rec.end('left', { ticks: host.tick, orders: host.log.length, delivered: host.delivered, ants: host.ants }); running = false; }
  setScreen('menu'); snd.hold();
}
function setCount(n) {
  if (!COUNTS.includes(n) || n === host.ants) return;
  run(G.reset('count'));
  host = new Host(n); save.ants = n; persist();
  selected = -1; tapStart = null; stats = host.stats();
  uploadAll(); retext();
}
function setLayer(l) {
  run(G.reset('layer'));
  layer = l; tapStart = null; selected = -1;
  clampCam(); uploadScent(); uploadAnts(); retext();
}
function setTool(next) { if (next === tool) return; run(G.reset('tool')); tool = next; tapStart = null; retext(); if (tool === 'alarm') toast('alarmHold'); }
$('play').addEventListener('click', play);
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resume);
$('toMenu').addEventListener('click', toMenu);
$('layer').addEventListener('click', () => setLayer(layer === SURFACE ? NEST : SURFACE));
$('zin').addEventListener('click', () => { cams[layer].z *= 1.4; clampCam(); });
$('zout').addEventListener('click', () => { cams[layer].z /= 1.4; clampCam(); });
$('recall').addEventListener('click', () => { const on = !host.sim.g[GI.RECALL]; order({ type: CMD.RECALL, on: on ? 1 : 0 }); setTimeout(retext, 80); });
$('sound').addEventListener('click', () => { save.sound = !save.sound; persist(); if (!save.sound) snd.hold(); retext(); });
$('tapTrail').addEventListener('click', () => { save.tapTrail = !save.tapTrail; persist(); retext(); });
for (const id of ['langMenu', 'langPause']) $(id).addEventListener('click', () => { setLang(lang() === 'en' ? 'tr' : 'en'); rec.retext?.(); retext(); });
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
for (const b of document.querySelectorAll('[data-count]')) b.addEventListener('click', () => setCount(Number(b.dataset.count)));
$('antClose').addEventListener('click', () => { selected = -1; $('antCard').classList.remove('on'); });
onLeave(pauseGame);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (screen === 'play') pauseGame(); else if (screen === 'paused') resume(); e.preventDefault(); }
});
const help = hint(ui, { kind: 'path', key: HINT, when: () => screen === 'play' && tool === 'trail' && layer === SURFACE, played: saved0 !== null, bottom: 200 });

// ---- orders ----
let preview = null, tapStart = null, selected = -1, alarmAt = null, pulses = [], stats = host.stats();
function order(o) {
  const e = host.order(o);
  rec.event('order', { type: e.type });
  return e;
}
const cellOf = (sx, sy) => { const w = toWorld(sx, sy); return [Math.floor(w.x), Math.floor(w.y)]; };
function trailPoints(screenPts) {
  const pts = [];
  for (const [sx, sy] of screenPts) { const [x, y] = cellOf(sx, sy); const l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
  if (pts.length < 2) return null;
  const keep = pts.length <= 64 ? pts : Array.from({ length: 64 }, (_, k) => pts[Math.round(k * (pts.length - 1) / 63)]);
  return keep.flat();
}
function digCells(screenPts) {
  const seen = new Set(), out = [], d = dims(NEST);
  const add = (x, y) => { for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const cx = x + ox, cy = y + oy; if (cx < 0 || cy < 0 || cx >= d.w || cy >= d.h) continue; const k = cy * d.w + cx; if (!seen.has(k) && out.length < 512) { seen.add(k); out.push(cx, cy); } } };
  let prev = null;
  for (const [sx, sy] of screenPts) { const c = cellOf(sx, sy); if (prev) line(prev[0], prev[1], c[0], c[1], add); else add(c[0], c[1]); prev = c; }
  return out;
}
function act(a) {
  switch (a.type) {
    case 'preview': preview = a; break;
    case 'clear': preview = null; break;
    case 'pan': { const c = cams[layer]; c.x -= a.dx / c.z; c.y -= a.dy / c.z; clampCam(); break; }
    case 'zoom': {
      const c = cams[layer], before = toWorld(a.x, a.y);
      c.z *= a.f; clampCam();
      const after = toWorld(a.x, a.y); c.x += before.x - after.x; c.y += before.y - after.y; clampCam();
      break;
    }
    case 'order':
      if (a.tool === 'trail') {
        if (layer !== SURFACE) { toast('trailSurface'); break; }
        const points = trailPoints(a.points); if (!points) break;
        order({ type: CMD.TRAIL, layer: SURFACE, points });
        pulses.push({ pts: points, at: performance.now() }); snd.tone(620, 0.14, 0.06, 'triangle', -180);
      } else if (a.tool === 'dig') {
        if (layer !== NEST) { toast('digNest'); break; }
        const cells = digCells(a.points); if (!cells.length) break;
        for (let k = 0; k < cells.length; k += 512) order({ type: CMD.DIG, cells: cells.slice(k, k + 512) });
        snd.tone(180, 0.1, 0.06, 'square', -60);
      }
      break;
    case 'alarm': {
      const w = toWorld(a.x, a.y), x = Math.floor(w.x), y = Math.floor(w.y);
      order({ type: CMD.ALARM, layer, x, y, hold: a.phase === 'end' ? 1 : 400 });
      alarmAt = a.phase === 'end' ? null : { x: x + 0.5, y: y + 0.5, layer };
      if (a.phase === 'start') snd.tone(880, 0.25, 0.05, 'sawtooth', -300);
      break;
    }
    case 'tap': {
      if (tool === 'trail' && save.tapTrail && layer === SURFACE) {
        if (!tapStart) { tapStart = toWorld(a.x, a.y); toast('tapStart'); break; }
        const s = toScreen(tapStart.x, tapStart.y), points = trailPoints([[s.x, s.y], [a.x, a.y]]);
        tapStart = null;
        if (points) { order({ type: CMD.TRAIL, layer: SURFACE, points }); pulses.push({ pts: points, at: performance.now() }); snd.tone(620, 0.14, 0.06, 'triangle', -180); }
        break;
      }
      inspectAt(a.x, a.y);
      break;
    }
  }
}
function run(actions) { for (const a of actions) act(a); }
function inspectAt(sx, sy) {
  const w = toWorld(sx, sy), s = host.sim, r = Math.max(1.5, 22 / cams[layer].z), r2 = r * r;
  let best = -1, bd = r2;
  for (let i = 0; i < s.n; i++) {
    if (s.layer[i] !== layer) continue;
    const dx = s.x[i] / 256 - w.x, dy = s.y[i] / 256 - w.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  selected = best;
  $('antCard').classList.toggle('on', best >= 0);
  showAnt();
}
function showAnt() {
  if (selected < 0) return;
  const a = host.inspect(selected); if (!a) return;
  $('antText').innerHTML = `<b>${t(a.job)} #${a.i + 1}</b>${t(a.carry ? 'load_food' : 'load_none')}<br>${t('to_' + a.to)}<br><i>${t('why_' + a.why)}</i>`;
}

// ---- pointers: thin glue over gestures.js ----
const P = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: e.pointerType, button: e.button, primary: e.isPrimary });
ui.addEventListener('pointerdown', e => {
  if (screen !== 'play') return;
  try { ui.setPointerCapture(e.pointerId); } catch { /* synthetic pointers are not active pointers */ }
  run(G.down(P(e), tool));
});
ui.addEventListener('pointermove', e => { if (screen === 'play') run(G.move(P(e))); });
ui.addEventListener('pointerup', e => run(G.up(P(e))));
ui.addEventListener('pointercancel', e => run(G.cancel(e.pointerId, 'pointercancel')));
ui.addEventListener('lostpointercapture', e => run(G.cancel(e.pointerId, 'lostpointercapture')));
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('wheel', e => { if (screen !== 'play') return; e.preventDefault(); act({ type: 'zoom', f: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });

// ---- the overlay (Canvas 2D): stroke preview, crews at trail ends, the selected ant, order pulses ----
function drawOverlay(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (layer === SURFACE) {
    for (const tr of stats.trails) {
      const p = toScreen(tr.x + 0.5, tr.y + 0.5);
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
      ctx.fillStyle = tr.newest ? '#2b1d12' : '#2b1d1288'; ctx.strokeStyle = '#f4ecdc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4ecdc'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(tr.crew), p.x, p.y + 0.5);
    }
    for (const pu of pulses) {
      const k = (now - pu.at) / 900; if (k > 1) continue;
      ctx.strokeStyle = `rgba(255, 240, 200, ${1 - k})`; ctx.lineWidth = 3 + 6 * k;
      ctx.beginPath(); for (let i = 0; i < pu.pts.length; i += 2) { const p = toScreen(pu.pts[i] + 0.5, pu.pts[i + 1] + 0.5); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
    }
    pulses = pulses.filter(pu => now - pu.at < 900);
  }
  if (preview && preview.points.length) {
    ctx.strokeStyle = preview.tool === 'dig' ? '#f2d25a' : '#2b1d12'; ctx.lineWidth = preview.tool === 'dig' ? Math.max(6, 3 * cams[layer].z) : 4;
    ctx.setLineDash(preview.tool === 'dig' ? [] : [2, 8]);
    ctx.beginPath(); preview.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.setLineDash([]);
  }
  const st = G.state.stroke;
  if (st && st.tool === 'alarm' && !st.alarm && !G.state.dead) {
    const k = Math.min(1, (now - st.t0) / 300);
    ctx.strokeStyle = '#b8432f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(st.x0, st.y0, 26, -Math.PI / 2, -Math.PI / 2 + k * 2 * Math.PI); ctx.stroke();
  }
  if (tapStart) { const p = toScreen(tapStart.x, tapStart.y); ctx.fillStyle = '#2b1d12'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); }
  if (selected >= 0 && host.sim.layer[selected] === layer) {
    const s = host.sim, a = host.alpha, j = host.pl[selected] !== s.layer[selected];
    const x = j ? s.x[selected] / 256 : (host.px[selected] + (s.x[selected] - host.px[selected]) * a) / 256;
    const y = j ? s.y[selected] / 256 : (host.py[selected] + (s.y[selected] - host.py[selected]) * a) / 256;
    const p = toScreen(x, y);
    ctx.strokeStyle = '#e2913a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(10, cams[layer].z * 1.2), 0, 7); ctx.stroke();
  }
}

// ---- the HUD (a few times a second) ----
function hud() {
  stats = host.stats();
  $('stats').textContent = t('hud', { out: stats.surface.toLocaleString(lang()), carrying: stats.carrying.toLocaleString(lang()), home: stats.stores.toLocaleString(lang()) });
  const lines = [];
  const newest = stats.trails.find(tr => tr.newest);
  stats.trails.slice().sort((a, b) => b.seq - a.seq).forEach((tr, k) => {
    if (k > 1) return;
    const why = tr.why ? t('why_' + tr.why) : '';
    lines.push(`${t('trailCrew', { n: stats.trails.length - k, crew: tr.crew })}${why ? ` <small>· ${why}</small>` : ''}`);
  });
  const food = stats.piles.reduce((a, p) => a + p.crew, 0);
  if (food) lines.push(t('foodCrew', { crew: food }));
  if (stats.dig.marked) lines.push(`${t('digCrew', stats.dig)}${stats.dig.crew >= stats.dig.cap ? ` <small>· ${t('digFull')}</small>` : ''}`);
  if (stats.alarm) lines.push(t('alarmCrew', stats.alarm));
  if (lines.length && newest) lines.push(`<small>${t('noWanted')}</small>`);
  $('crew').innerHTML = lines.join('<br>');
  showAnt();
  if ($('recall').getAttribute('aria-pressed') !== String(stats.recall)) retext();
}

// ---- frame loop, with a frame-time sampler (S3) ----
const frames = { on: false, dt: [], work: [], last: 0, drawn: 0 };
const fpsOn = query.get('fps') === '1';
if (fpsOn) $('fps').classList.add('on');
let lastHud = 0, lastStores = 0, lastClick = 0, lastFps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  run(G.tick(t0));
  const stepped = host.advance(now, screen !== 'play');
  if (stepped) {
    uploadAnts(); uploadScent();
    if (host.terrainVersion !== uploadedTerrain) uploadTerrain();
    if (host.delivered > lastStores && save.sound && now - lastClick > 140) { snd.tone(1700 + 300 * Math.random(), 0.03, 0.015, 'square'); lastClick = now; }
    lastStores = host.delivered;
  }
  const L = host.sim.L, ent = { x: L.sw / 2 + 1, y: L.sh / 2 + 0.5 };
  const alarmLive = stats.alarm && alarmAt && alarmAt.layer === layer ? alarmAt : null;
  if (renderer && renderer.draw({ layer, cam: cams[layer], alpha: screen === 'play' ? host.alpha : 1, time: now / 1000, piles: layer === SURFACE ? stats.piles : [], entrance: layer === SURFACE ? ent : null, alarm: alarmLive })) frames.drawn++;
  drawOverlay(now);
  if (now - lastHud > 250) { lastHud = now; if (screen !== 'menu') hud(); }
  const work = performance.now() - t0;
  if (frames.last) { const dt = now - frames.last; if (frames.on || fpsOn) { frames.dt.push(dt); frames.work.push(work); if (!frames.on && frames.dt.length > 240) { frames.dt.splice(0, 120); frames.work.splice(0, 120); } } }
  frames.last = now;
  if (fpsOn && now - lastFps > 1000) { lastFps = now; const f = summary(frames.dt), w = summary(frames.work), s = host.tickStats(); $('fps').textContent = `frame ${f.mean.toFixed(1)} ms (p95 ${f.p95.toFixed(1)})  ${(1000 / f.mean).toFixed(0)} fps\nwork ${w.mean.toFixed(1)} ms (p95 ${w.p95.toFixed(1)})\nsim tick ${s ? s.mean.toFixed(2) : '-'} ms (p95 ${s ? s.p95.toFixed(2) : '-'})\nants ${host.ants}, drawn ${drawnAnts}, dpr ${dpr}\n${renderer?.gpu ?? 'no WebGL2'}`; }
}
function summary(a) {
  if (!a.length) return { n: 0, mean: 0, p95: 0, max: 0 };
  const s = a.slice().sort((p, q) => p - q);
  return { n: s.length, mean: s.reduce((p, q) => p + q, 0) / s.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
}
requestAnimationFrame(frame);

// ---- hooks for the phone check and the S3 script ----
window.painter = {
  state: () => ({ screen: screen === 'paused' ? 'paused' : screen, t: host.tick, paused: screen === 'paused', ants: host.ants, sound: save.sound, tapTrail: save.tapTrail, tool, layer, preview: preview ? preview.points.length : 0, orders: host.log.length, gl: !!renderer && !renderer.lost, glLosses: renderer?.losses ?? 0, glRestored: renderer?.restored ?? 0, glFailed, drawn: frames.drawn, selected, help: help.shown }),
  log: () => JSON.parse(JSON.stringify(host.log)),
  stats: () => host.stats(),
  inspect: i => host.inspect(i),
  toScreen: (x, y, l) => toScreen(x, y, l),
  camera: () => ({ ...cams[layer] }),
  setCamera: c => { Object.assign(cams[layer], c); clampCam(); },
  setAnts: n => setCount(n),
  setTool, setLayer,
  frames: {
    start() { frames.on = true; frames.dt = []; frames.work = []; host.tickMs = []; },
    stop() { frames.on = false; return { frame: summary(frames.dt), work: summary(frames.work), tick: host.tickStats(), ants: host.ants, drawn: drawnAnts, dpr, view: [W, H], gpu: renderer?.gpu ?? null }; },
  },
  loseContext: () => { const e = renderer?.loseForTest(); window.__lose = e; return !!e; },
  restoreContext: () => { window.__lose?.restoreContext(); },
  TICK_MS,
};
