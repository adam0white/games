// Sky Kitchen: the page. Cards, input, sound, save, the order of a guest's visit. The rules are in sim.js, the 3D in art.js.
import * as sim from './sim.js';
import { ING, JUNK, RECIPES, TIERS, BUILDINGS, BUILDING_IDS, STATION, TUNE } from './sim.js';
import { createView, LANE, TOP, LOOK_IDS, elasticOut } from './art.js';
import { W, t, many, one } from './words.js';
import { read, write, readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { music } from '../kit/music.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js'; noZoom();

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
W.apply();

// ---------- the save: one JSON blob; fields only ever grow. Keys never change once shipped.
const KEY = 'kitchen-save', MUSIC_KEY = 'kitchen-music', LOOK_KEY = 'kitchen-look';
const hadSave = readJson(KEY, null) !== null;
const save = sim.newSave();
{
  const old = readJson(KEY, null);
  if (old && typeof old === 'object') {
    for (const k of ['coins', 'tier', 'day', 'served', 'best', 'dayAtTier']) if (Number.isFinite(old[k]) && old[k] >= 0) save[k] = Math.floor(old[k]);
    for (const k of ['tutorial', 'sound']) if (typeof old[k] === 'boolean') save[k] = old[k];
    save.tier = Math.min(save.tier, TIERS.length - 1); save.day = Math.max(1, save.day);
    if (old.built && typeof old.built === 'object') for (const id of BUILDING_IDS) if (Number.isFinite(old.built[id])) save.built[id] = Math.max(0, Math.min(BUILDINGS[id].max.at(-1), Math.floor(old.built[id])));
  }
}
const store = () => writeJson(KEY, save);
let lookId = LOOK_IDS.includes(query.get('look')) ? query.get('look') : LOOK_IDS.includes(read(LOOK_KEY)) ? read(LOOK_KEY) : 'diner';

// ---------- sound: made in code (kit/audio.js); music from kit/music.js
let musicOn = read(MUSIC_KEY) !== '0', song = null;
const snd = sound({ on: () => save.sound, setup: ac => { song = music(ac, { preset: 'bell', bpm: 92, key: 3, turn: 0.75 }); song.volume(0.32); } });
const tone = (f, d, v, type = 'sine', slide = 0) => { if (snd.ctx) snd.tone(f, d, v, type, slide); };
const noise = (d, v, hz) => { if (snd.ctx) snd.noise(d, v, hz); };
const later = (ms, fn) => setTimeout(() => { if (!paused) fn(); }, ms);
const SFX = {
  tap() { tone(520, 0.06, 0.04, 'triangle'); },
  catch(k) { const f = 523 * 2 ** (k / 12); tone(f, 0.12, 0.08, 'triangle', 80); later(50, () => tone(f * 1.5, 0.1, 0.04, 'sine')); },
  wrong() { tone(180, 0.25, 0.09, 'square', -60); later(120, () => tone(150, 0.3, 0.07, 'square', -40)); },
  miss() { tone(300, 0.1, 0.03, 'triangle', -120); },
  whoosh() { noise(0.18, 0.05, 2600); },
  chop() { noise(0.06, 0.16, 2400); tone(160, 0.07, 0.1, 'triangle', -80); },
  swish() { noise(0.12, 0.04, 5200); },
  sizzle() { noise(0.09, 0.035, 6000 + Math.random() * 2000); },
  hum() { tone(120, 0.12, 0.025, 'sawtooth'); },
  ding() { tone(1568, 0.6, 0.07); tone(2093, 0.5, 0.04); },
  blend() { noise(0.08, 0.06, 900 + Math.random() * 600); tone(90 + Math.random() * 30, 0.08, 0.03, 'sawtooth'); },
  good() { [659, 784, 1047].forEach((f, i) => later(i * 70, () => tone(f, 0.16, 0.06, 'triangle'))); },
  burnt() { tone(220, 0.4, 0.07, 'sawtooth', -120); noise(0.4, 0.06, 700); },
  // The register: a bright bell and coins as the drawer opens; a heavy clunk as it closes.
  open() { tone(2637, 0.9, 0.09); tone(3520, 0.7, 0.04); later(70, () => tone(2637, 0.7, 0.05)); noise(0.06, 0.08, 1800); for (let i = 0; i < 6; i++) later(120 + i * 55, () => tone(3000 + Math.random() * 1600, 0.06, 0.025, 'square')); },
  coin() { tone(1900 + Math.random() * 500, 0.07, 0.03, 'square'); },
  clunk() { noise(0.09, 0.18, 380); tone(95, 0.16, 0.14, 'square', -40); later(60, () => noise(0.05, 0.08, 900)); },
  build() { [392, 523, 659, 784].forEach((f, i) => later(i * 80, () => tone(f, 0.2, 0.07, 'triangle'))); noise(0.2, 0.05, 1200); },
  star() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => later(i * 110, () => { tone(f, 0.4, 0.08, 'triangle'); tone(f / 2, 0.35, 0.04); })); },
  happy() { tone(880, 0.1, 0.05, 'sine', 300); later(110, () => tone(1175, 0.15, 0.05, 'sine', 200)); },
  step() { noise(0.03, 0.02, 700); },
};
const buzz = ms => { if (save.sound && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };

// ---------- lab recording
const rec = lab('kitchen', { lang: W.lang });
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);

// ---------- run state
let screen = 'menu', paused = false, before = 'play', clock = 0, last = performance.now();
let art = null, ready = null;
let day = null;        // { plan, i, served, earned, tips, stars[], seed }
let g = null;          // the guest being served: { recipe, model, phase, catch, q[], wait, ... }
let peopleIn = false, phase = 'idle', trayX = 0, trayTarget = 0, finger = null, keys = new Set(), touched = false;
const meshes = new Map();  // falling item n -> mesh

const show = screens(['menu', 'paused', 'extra', 'dayEnd', 'shop'], name => {
  screen = name === 'dayEnd' ? 'dayend' : name;
  const playing = name === 'play' || name === 'extra';
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  $('hud').style.display = playing || name === 'paused' ? 'flex' : 'none';
  for (const id of ['ticket', 'gauge', 'coach', 'banner', 'finger']) if (!playing && name !== 'paused') $(id).style.display = 'none';
  if (playing && g && ['catch', 'chop', 'fry', 'micro', 'blend', 'ring', 'close', 'serve', 'plate'].includes(phase)) $('ticket').style.display = 'block';
  if (name === 'menu') menu();
  if (name === 'shop') shop();
  labels(); hud();
});
function labels() {
  for (const id of ['sound1', 'sound2']) { $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff'); $(id).setAttribute('aria-pressed', String(save.sound)); }
  for (const id of ['music1', 'music2']) { $(id).textContent = t(musicOn ? 'musicOn' : 'musicOff'); $(id).setAttribute('aria-pressed', String(musicOn)); }
  $('look').textContent = t('look', { name: t('looks_' + lookId) });
}
const rankName = tier => t('rank_' + TIERS[tier].name);
const starText = tier => '★'.repeat(tier) + '☆'.repeat(5 - tier);
function hud() {
  $('coinText').textContent = save.coins;
  $('rankStars').textContent = starText(save.tier);
  $('dayText').textContent = t('day', { n: save.day });
}
function menu() {
  $('play').textContent = save.tutorial ? t('cont', { n: save.day }) : t('play');
  $('toShop').style.display = save.tutorial ? '' : 'none';
  $('menuLine').textContent = save.tutorial ? t('menuLine', { coins: save.coins, rank: rankName(save.tier) }) : '';
  art?.view('menu');
}

// ---------- the 3D view
const canvas = $('c');
ready = createView(canvas, lookId).then(v => {
  art = v; art.setRestaurant(save); art.view('menu', true);
  // A guest at the counter on the menu: the restaurant is open.
  art.peopleReady.then(() => { peopleIn = true; });
  art.peopleReady.then(async () => { if (screen === 'menu' && !g) { const m = await art.guest(2); if (m) { m.g.position.set(1.6, 0, 1.7); m.play('idle'); m.face = 0.3; menuGuest = m; } } });
  return v;
}).catch(e => { console.error(e); });
let menuGuest = null;

// ---------- a day
function beginDay() {
  if (menuGuest) { menuGuest.gone = true; menuGuest = null; }
  for (const m of art.guests) m.gone = true;
  const seed = query.has('seed') ? Number(query.get('seed')) >>> 0 : (Date.now() ^ save.day * 7919) >>> 0;
  let plan = save.tutorial ? sim.dayPlan(save, seed) : sim.TUTORIAL_DAY.slice();
  if (save.tutorial && query.get('recipe') in RECIPES) plan = plan.map(p => ({ ...p, recipe: query.get('recipe') })); // for checks and the owner's tries
  day = { plan, i: -1, served: 0, earned: 0, tips: 0, stars: [], seed, t0: clock };
  song?.start(seed);
  rec.start({ day: save.day, tier: save.tier, tutorial: !save.tutorial });
  paused = false; snd.release(); show('play'); hud();
  nextGuest();
}
async function nextGuest() {
  day.i++;
  clearCatch(); g = null;
  if (day.i >= day.plan.length) return endDay();
  const p = day.plan[day.i], r = RECIPES[p.recipe];
  g = { recipe: p.recipe, q: [], steps: r.steps.slice(), step: -1, wait: 0, extras: 0, restarts: 0, paid: 0, model: null, tut: !save.tutorial ? day.i : -1 };
  const me = g;
  phase = 'enter'; art.view('serve');
  $('ticket').style.display = 'none';
  const m = await art.guest(p.look);
  if (me !== g) { if (m) m.gone = true; return; }
  g.model = m;
  const arrive = () => { if (me !== g) return; m && (m.face = -Math.PI * 0.6); order(); };
  if (m) art.walkTo(m, 3.25, 0.95, arrive); else arrive();
}
function order() {
  phase = 'order';
  const r = RECIPES[g.recipe];
  g.model?.bubble.show(art.thumb(dishModel(g.recipe)));
  ticket();
  $('ticket').style.display = 'block'; $('ticket').classList.remove('pop'); void $('ticket').offsetWidth; $('ticket').classList.add('pop');
  SFX.happy();
  if (g.tut === 0) coach(t('t1'));
  wait(g.tut === 0 ? 2.2 : 1.1, () => startCatch());
}
function dishModel(id) { const r = RECIPES[id]; return r.dish ?? (r.bowl ? 'bowl' : 'carrot'); }
const itemModel = id => (ING[id] ?? JUNK[id]).model;

// ---------- the catch
function startCatch() {
  phase = 'catch'; art.view('catch');
  const tutorial = g.tut === 0 ? 'first' : g.tut >= 1 ? true : false;
  g.catch = sim.newCatch({ need: RECIPES[g.recipe].need, hard: sim.hardness(save), trayLevel: save.built.tray, seed: day.seed + day.i * 101 + g.restarts * 7, tutorial });
  g.catchT0 = clock;
  banner(t('catch'));
  if (g.tut === 0) coach(t('t2'), 4); else if (g.tut === 1) coach(t('t6'), 6); else coach(null);
  ticket();
}
function clearCatch() {
  for (const m of meshes.values()) art?.world.remove(m);
  meshes.clear();
  art?.tray.load.clear();
}
function stepCatch(dt) {
  const c = g.catch;
  const ev = sim.stepCatch(c, trayX / LANE.s, dt);
  for (const e of ev) {
    if (e.type === 'caught') {
      const m = meshes.get(e.it.n); meshes.delete(e.it.n);
      if (m) landOnTray(m, e.it);
      const k = Object.values(c.got).reduce((a, b) => a + b, 0);
      SFX.catch(k); buzz(12); art.tray.bump();
      art.burst(new art.THREE.Vector3(trayX, LANE.y0 + 0.05, LANE.z), { n: 8, color: juice(e.it.id), speed: 1.2, up: 1.4, size: 0.03, life: 0.5 });
      floater(worldPx(trayX, LANE.y0 + 0.3), '+1');
      if (musicOn) song?.ember();
      ticket(e.it.id);
    } else if (e.type === 'extra') {
      const m = meshes.get(e.it.n); meshes.delete(e.it.n);
      if (m) landOnTray(m, e.it);
      g.extras++; SFX.wrong(); buzz([40, 60, 40]); art.shake(1); art.tray.bump();
      $('ticket').classList.remove('shake'); void $('ticket').offsetWidth; $('ticket').classList.add('shake');
      floater(worldPx(trayX, LANE.y0 + 0.35), '✗', 'bad');
      song?.hit();
      later(500, () => { if (g?.catch === c && c.extra) extraCard(); });
    } else if (e.type === 'missed') {
      const m = meshes.get(e.it.n); meshes.delete(e.it.n); if (m) art.world.remove(m);
      if (!sim.isJunk(e.it.id) && RECIPES[g.recipe].need[e.it.id]) { SFX.miss(); song?.miss(); }
    } else if (e.type === 'done') {
      g.wait = clock - g.catchT0;
      g.q.push(g.extras ? 0.85 : 1);
      rec.event('catch', { recipe: g.recipe, t: +g.wait.toFixed(1), extras: g.extras, restarts: g.restarts, paid: g.paid });
      // Whatever is still falling puffs away.
      for (const m of meshes.values()) { art.burst(m.position, { n: 6, color: '#ffffff', speed: 0.8, up: 0.6, size: 0.04, life: 0.4, gravity: 0 }); art.world.remove(m); }
      meshes.clear();
      SFX.good(); banner(t(g.extras ? 'good' : 'perfect'));
      coach(null);
      wait(0.9, nextStep);
      phase = 'caught';
    }
  }
  // Falling items: make the new ones, move them all.
  if (!c.done) for (const it of c.items) {
    let m = meshes.get(it.n);
    if (!m) { m = art.item(itemModel(it.id), 0.27); m.userData.spin = (it.spin % 1) * 4 - 2; art.world.add(m); meshes.set(it.n, m); }
    m.position.set(it.x * LANE.s, LANE.y0 + it.y * LANE.h - 0.12, LANE.z);
    m.rotation.z += m.userData.spin * dt; m.rotation.y += dt * 1.3;
  }
}
function landOnTray(m, it) {
  art.world.remove(m);
  const n = art.tray.load.children.length;
  m.position.set(Math.max(-0.4, Math.min(0.4, (it.dx ?? 0) * 0.6 + ((n % 5) - 2) * 0.06)), 0.04 + Math.floor(n / 5) * 0.12, ((n % 2) - 0.5) * 0.1);
  m.rotation.set(0, Math.random() * 6, 0); m.scale.multiplyScalar(0.85);
  m.userData.drop = 0.25;
  art.tray.load.add(m);
}
function juice(id) { return { tomato: '#ff4b3a', strawberry: '#ff3b5c', apple: '#ffd9a0', carrot: '#ff9a2e', lemon: '#ffe14a', banana: '#fff09a', cabbage: '#9be37a', avocado: '#9bd35a', pear: '#e9f59a', egg: '#fff3c4', onion: '#f5e6ff', cheese: '#ffd34a' }[id] ?? '#ffe0a8'; }

// The extra card: catch again from an empty tray, or pay to toss the extra and keep going.
function extraCard() {
  const c = g.catch, id = c.extra.id, cost = sim.payCost(save);
  $('extraPic').innerHTML = `<img alt="" src="${art.thumb(itemModel(id))}">`;
  $('extraLine').textContent = t('extraLine', { what: one(id) });
  const can = save.coins >= cost;
  $('payOn').innerHTML = `<i class="coin"></i> ${t(can ? 'pay' : 'payPoor', { n: cost })}`;
  $('payOn').disabled = !can;
  show('extra');
}
$('restart').addEventListener('click', () => {
  if (!g?.catch) return;
  SFX.tap(); g.restarts++;
  sim.restartCatch(g.catch); clearCatch(); ticket();
  show('play'); banner(t('catch'));
});
$('payOn').addEventListener('click', () => {
  const c = g?.catch; if (!c?.extra) return;
  const cost = sim.payCost(save); if (save.coins < cost) return;
  save.coins -= cost; g.paid += cost; store(); hud(); SFX.coin();
  const bad = art.tray.load.children.at(-1);
  if (bad) { art.tray.load.remove(bad); const w = bad.getWorldPosition?.(new art.THREE.Vector3()); flyAway(bad, trayX); }
  sim.tossExtra(c);
  for (const [n, m] of meshes) if (!c.items.some(it => it.n === n)) { art.world.remove(m); meshes.delete(n); }
  show('play');
});
function flyAway(m, x) { m.position.set(x, LANE.y0 + 0.1, LANE.z); art.world.add(m); flying.push({ m, v: new art.THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * 2.4, 3.2, 0.6), t: 0 }); SFX.whoosh(); }
const flying = [];

// ---------- the ticket, bottom left
function ticket(bumped = null) {
  if (!g) return;
  const r = RECIPES[g.recipe], c = g.catch;
  $('ticketHead').innerHTML = `<img alt="" src="${art.thumb(dishModel(g.recipe))}"><span>${t('r_' + g.recipe)}</span>`;
  $('ticketRows').innerHTML = Object.entries(r.need).map(([id, n]) => {
    const got = Math.min(n, c?.got[id] ?? 0);
    return `<div class="trow${got >= n ? ' done' : ''}${bumped === id ? ' bump' : ''}"><img alt="" src="${art.thumb(itemModel(id))}"><span class="n">${c ? `${got}/${n}` : n}</span><span>${many(id, n).replace(/^\d+ /, '')}</span></div>`;
  }).join('');
}

// ---------- cooking
function nextStep() {
  if (!g) return;
  g.step++;
  art.tray.load.clear();
  const s = g.steps[g.step];
  if (!s) return plate();
  ({ chop: startChop, fry: startFry, micro: startMicro, blend: startBlend })[s]();
}
// Chop: every piece on the board, one swipe across each (two from the Restaurant star on).
let cook = null;
function startChop() {
  phase = 'chop'; art.view('chop');
  const need = RECIPES[g.recipe].need, ids = Object.entries(need).flatMap(([id, n]) => Array(n).fill(id));
  const n = ids.length, span = Math.min(0.72, n * 0.17);
  const pieces = ids.map((id, i) => {
    const m = lie(art.item(itemModel(id), 0.24)); const x = n === 1 ? 0 : -span / 2 + span * i / (n - 1);
    m.position.set(x, TOP + 0.045, 0.12 + (i % 2 ? 0.07 : -0.05)); m.rotation.y = (Math.random() - 0.5) * 0.6; art.world.add(m);
    art.popIn(m, false);
    return { id, m, cuts: 0, x };
  });
  cook = { kind: 'chop', pieces, t0: clock, cuts: sim.chopCuts(save), bits: [] };
  banner(t('chop'), t('chopSub'));
  if (g.tut === 0) { coach(t('t3')); fingerSwipe(); }
  gauge(null);
}
// A tall piece (a carrot, a leek) lies down on the board.
function lie(g) {
  const box = new art.THREE.Box3().setFromObject(g), d = box.getSize(new art.THREE.Vector3());
  if (d.y > Math.max(d.x, d.z) * 1.4) { const inner = g.children[0]; inner.rotation.z = Math.PI / 2; inner.position.y += d.x / 2; const b2 = new art.THREE.Box3().setFromObject(g); inner.position.y -= b2.min.y; const c = b2.getCenter(new art.THREE.Vector3()); inner.position.x -= c.x; }
  return g;
}
function cutAt(p) {
  p.cuts++;
  SFX.chop(); buzz(15); art.shake(0.4);
  const pos = p.m.position.clone().add(new art.THREE.Vector3(0, 0.06, 0));
  art.burst(pos, { n: 12, color: juice(p.id), speed: 1.1, up: 1.3, size: 0.022, life: 0.55 });
  if (p.cuts < cook.cuts) { p.m.scale.multiplyScalar(0.9); p.m.rotation.y += 0.8; return; }
  // Two halves fly apart and settle.
  art.world.remove(p.m); p.done = true;
  const half = ING[p.id]?.chop;
  for (const s of [-1, 1]) {
    const h = art.item(half ?? itemModel(p.id), half ? 0.15 : 0.13);
    if (!half) h.scale.x *= 0.55;
    h.position.copy(p.m.position); h.rotation.y = s > 0 ? 0 : Math.PI;
    art.world.add(h); cook.bits.push({ m: h, v: new art.THREE.Vector3(s * 0.7, 1.1, (Math.random() - 0.5) * 0.4), y0: TOP + 0.03, t: 0 });
  }
  floater(worldPx(p.m.position.x, TOP + 0.25, p.m.position.z), cook.pieces.every(q => q.done) ? t('yum') : '✂');
  if (cook.pieces.every(q => q.done)) {
    const q = sim.chopQuality(clock - cook.t0, cook.pieces.length, save.built.knife);
    finishStep('chop', q);
  }
}
let swipe = null;
function swipeTo(x, y) {
  if (!swipe || !cook || cook.kind !== 'chop' || cook.over) return;
  const dx = x - swipe.x, dy = y - swipe.y, L = Math.hypot(dx, dy);
  // The knife follows the finger above the board.
  const w = art.toY(x, y, TOP + 0.16); art.knife.position.set(w.x, TOP + 0.16, w.z); art.knife.rotation.set(0, Math.atan2(-dy, dx) * 0.4 - 0.4, -0.5);
  if (L < 6) return;
  if (L > 30) SFX.swish();
  for (const p of cook.pieces) {
    if (p.done || p.hitBy === swipe.id) continue;
    const s = art.toScreen(p.m.position.clone().add(new art.THREE.Vector3(0, 0.05, 0)));
    // Distance from the piece to the finger's segment.
    const k = Math.max(0, Math.min(1, ((s.x - swipe.x) * dx + (s.y - swipe.y) * dy) / (L * L)));
    const d = Math.hypot(swipe.x + dx * k - s.x, swipe.y + dy * k - s.y);
    if (d < reach() && (swipe.len + L) > 24) { p.hitBy = swipe.id; cutAt(p); if (cook?.over) break; }
  }
  swipe.len += L; swipe.x = x; swipe.y = y;
}
const reach = () => Math.max(34, Math.min(innerWidth, innerHeight) * 0.09);
function cutNext() { const p = cook?.pieces?.find(q => !q.done); if (p) cutAt(p); }

// Fry: hold to heat, let go in the green.
function startFry() {
  phase = 'fry'; art.view('fry');
  const items = cookItems(-1.9, TOP + 0.08, 0.05, 0.36);
  for (const m of items) m.traverse(o => { if (o.isMesh) o.material = [].concat(o.material).map(x => x.clone()).at(0); });
  cook = { kind: 'fry', items, d: 0, held: false, band: sim.fryBand(save.built.stove, save.tier), t: 0, tick: 0 };
  banner(t('fry'), t('frySub')); gauge('fry');
  if (g.tut >= 0 && !save.tutorial) coach(t('frySub'));
}
function cookItems(x, y, z, span) {
  const need = RECIPES[g.recipe].need, ids = Object.entries(need).flatMap(([id, n]) => Array(n).fill(id));
  return ids.map((id, i) => {
    const half = ING[id]?.chop, m = art.item(half ?? itemModel(id), 0.13);
    const a = i / ids.length * Math.PI * 2, r = ids.length > 1 ? span * 0.3 : 0;
    m.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r * 0.7); m.rotation.y = Math.random() * 6; art.world.add(m); return m;
  });
}
function stepFry(dt) {
  if (cook.over) return;
  if (cook.held) cook.d = Math.min(1, cook.d + sim.FRY_RATE * dt);
  cook.tick -= dt;
  art.panGlow.material.opacity = cook.held ? 0.55 * (0.8 + Math.random() * 0.2) : 0;
  if (cook.tick <= 0) { cook.tick = cook.held ? 0.07 : 0.25; if (cook.held) SFX.sizzle(); art.steam(new art.THREE.Vector3(-1.9, TOP + 0.12, 0.05), cook.held ? 2 : 1); if (cook.held && Math.random() < 0.5) art.burst(new art.THREE.Vector3(-1.9, TOP + 0.1, 0.05), { n: 2, color: '#fff3b0', speed: 0.8, up: 1.4, size: 0.012, life: 0.4 }); }
  const brown = Math.min(1, cook.d * 1.1);
  for (const m of cook.items) { m.position.y = TOP + 0.08 + (cook.held ? Math.abs(Math.sin(clock * 20 + m.id)) * 0.015 : 0); m.traverse(o => { if (o.isMesh && o.material.color) { o.userData.c0 ??= o.material.color.clone(); o.material.color.copy(o.userData.c0).lerp(new art.THREE.Color(brown > 0.9 ? '#2a1a10' : '#9a5a22'), brown * (brown > 0.9 ? 1 : 0.55)); } }); }
  gaugeSet(cook.d, cook.band);
  if (cook.d >= 1) letGo();
}
function letGo() {
  if (!cook || cook.kind !== 'fry' || cook.over || cook.d < 0.04) { if (cook) cook.held = false; return; }
  cook.held = false;
  const q = sim.fryQuality(cook.d, cook.band);
  art.panGlow.material.opacity = 0;
  finishStep('fry', q);
}

// Microwave: a needle sweeps; tap to stop in the green.
function startMicro() {
  phase = 'micro'; art.view('micro');
  const items = cookItems(1.02, TOP + 0.1, -0.05, 0.2);
  cook = { kind: 'micro', items, p: 0, dir: 1, band: sim.microBand(save.built.micro, save.tier), speed: sim.microSpeed(save.tier), tick: 0 };
  art.microLight.intensity = 2.2; art.microGlass.material.opacity = 0.35;
  banner(t('micro'), t('microSub')); gauge('micro');
  if (g.tut >= 0 && !save.tutorial) coach(t('microSub'));
}
function stepMicro(dt) {
  if (cook.over) return;
  cook.p += cook.dir * cook.speed * dt;
  if (cook.p >= 1) { cook.p = 1; cook.dir = -1; } else if (cook.p <= 0) { cook.p = 0; cook.dir = 1; }
  cook.tick -= dt; if (cook.tick <= 0) { cook.tick = 0.12; SFX.hum(); }
  for (const m of cook.items) m.rotation.y += dt * 2;
  art.microGlass.material.opacity = 0.3 + Math.sin(clock * 9) * 0.06;
  gaugeSet(cook.p, cook.band);
}
function stopMicro() {
  if (!cook || cook.kind !== 'micro' || cook.over) return;
  const q = sim.microQuality(cook.p, cook.band);
  SFX.ding(); art.microLight.intensity = 0; art.microGlass.material.opacity = 0;
  finishStep('micro', q);
}

// Blend: tap fast to fill the jug before it settles.
function startBlend() {
  phase = 'blend'; art.view('blend');
  cook = { kind: 'blend', taps: 0, need: sim.blendTaps(save.built.blender, save.tier), fill: 0, t0: clock };
  banner(t('blend'), t('blendSub')); gauge('blend');
  if (g.tut >= 0 && !save.tutorial) coach(t('blendSub'));
}
function tapBlend() {
  if (!cook || cook.kind !== 'blend' || cook.over) return;
  cook.fill = Math.min(1, cook.fill + 1 / cook.need); SFX.blend(); buzz(8);
  art.blender.rotation.z = (Math.random() - 0.5) * 0.08; art.shake(0.15);
  art.burst(art.blender.position.clone().add(new art.THREE.Vector3(0, 0.45, 0)), { n: 3, color: ['#ff5d8f', '#ffd84a', '#ffffff'][cook.taps++ % 3], speed: 0.6, up: 1.2, size: 0.02, life: 0.4 });
  if (cook.fill >= 1) { const sec = clock - cook.t0, par = cook.need * 0.22 + 1; finishStep('blend', sec <= par ? 1 : Math.max(0.4, 1 - (sec - par) / (par * 1.5))); art.blender.rotation.z = 0; }
}
function stepBlend(dt) { if (cook.over) return; cook.fill = Math.max(0, cook.fill - dt * 0.06); gaugeSet(cook.fill, null); }

function finishStep(kind, q) {
  cook.over = true; g.q.push(q);
  const word = kind === 'fry' && q === 0 ? 'burnt' : q >= 0.9 ? 'perfect' : q >= 0.6 ? 'good' : 'ok';
  if (word === 'burnt') { SFX.burnt(); art.steam(new art.THREE.Vector3(-1.9, TOP + 0.15, 0.05), 8); } else SFX.good();
  banner(t(word)); coach(null); fingerOff();
  rec.event('cook', { step: kind, q: +q.toFixed(2) });
  const done = cook;
  wait(1.0, () => { for (const m of done.items ?? []) art.world.remove(m); for (const b of done.bits ?? []) art.world.remove(b.m); gauge(null); nextStep(); });
}

// ---------- plate, serve, ring up
let dish = null;
function plate() {
  phase = 'plate'; cook = null; art.view('serve');
  const r = RECIPES[g.recipe];
  dish = new art.THREE.Group();
  const p = art.item('plate', 0.42); dish.add(p);
  const top = art.item(dishModel(g.recipe), r.dish ? 0.34 : 0.22); top.position.y = 0.03; dish.add(top);
  if (!r.dish && !r.bowl) for (let i = 0; i < 3; i++) { const s = art.item('carrot', 0.16); s.position.set(-0.08 + i * 0.08, 0.04, 0); s.rotation.set(0, 0, Math.PI / 2); dish.add(s); }
  dish.position.set(1.75, TOP, 0.3); art.world.add(dish); art.popIn(dish);
  art.burst(new art.THREE.Vector3(1.75, TOP + 0.3, 0.3), { n: 20, color: '#ffe37a', speed: 1.4, up: 1.6, size: 0.025, life: 0.8, glow: true });
  SFX.good();
  wait(0.9, serve);
}
function serve() {
  phase = 'serve';
  slide = { from: dish.position.clone(), to: new art.THREE.Vector3(2.9, TOP, 0.42), t: 0 };
  const q = g.q.reduce((a, b) => a + b, 0) / g.q.length;
  g.bill = sim.bill(save, g.recipe, q, g.wait);
  wait(0.6, () => {
    g.model?.play('emote-yes', true); g.model?.bubble.show(null, 'happy'); SFX.happy();
    floater(worldPx(3.25, 1.9, 0.95), '★'.repeat(g.bill.stars), 'gold');
    art.register.display(String(g.bill.total));
    wait(0.8, ringUp);
  });
}
let slide = null;
function ringUp() {
  phase = 'ring'; banner(t('ring'), t('ringSub'));
  if (g.tut === 0) { coach(t('t4')); fingerTap(art.register.group.position.clone().add(new art.THREE.Vector3(0, 0.45, 0))); }
  art.view('serve');
}
function openRegister() {
  if (phase !== 'ring') return;
  phase = 'open';
  art.register.open(); SFX.open(); buzz(20); fingerOff();
  const b = g.bill; let given = 0;
  const from = art.toScreen(art.register.drawerWorld()), to = $('coins').getBoundingClientRect();
  const n = Math.min(14, 3 + Math.round(b.total / 4));
  for (let i = 0; i < n; i++) {
    const share = Math.round(b.total * (i + 1) / n) - Math.round(b.total * i / n);
    later(140 + i * 70, () => flyCoin(from, { x: to.left + 16, y: to.top + 14 }, () => { given += share; save.coins += share; hud(); SFX.coin(); $('coins').firstElementChild.classList.remove('bump'); void $('coins').offsetWidth; $('coins').firstElementChild.classList.add('bump'); }));
  }
  floater(from, `+${b.total}`, 'gold');
  // The coins are the guest's: count them as served now, whatever happens next.
  save.served++; day.served++; day.earned += b.price; day.tips += b.tip; day.stars.push(b.stars);
  setTimeout(() => { if (given < b.total) { save.coins += b.total - given; given = b.total; hud(); } store(); }, 140 + n * 70 + 900);
  rec.event('serve', { recipe: g.recipe, stars: b.stars, coins: b.total });
  wait(0.9, () => { phase = 'close'; banner(t('ring'), t('closeSub')); if (g.tut === 0) { coach(t('t5')); fingerTap(art.register.drawerWorld()); } });
}
function closeRegister() {
  if (phase !== 'close') return;
  phase = 'leave'; art.register.close(); SFX.clunk(); buzz(30); art.shake(0.5); fingerOff(); coach(null);
  art.register.display('0');
  const m = g.model, d = dish; dish = null;
  wait(0.5, () => {
    if (d) art.world.remove(d);
    $('ticket').style.display = 'none';
    if (m) { m.bubble.hide(); art.walkTo(m, 6.5, 1.6, () => { m.gone = true; }); }
    wait(0.7, nextGuest);
  });
}
function flyCoin(from, to, done) {
  const el = document.createElement('i'); el.className = 'coin flycoin';
  el.style.left = from.x + 'px'; el.style.top = from.y + 'px'; document.body.append(el);
  const jx = (Math.random() - 0.5) * 80, jy = -40 - Math.random() * 50;
  el.animate([{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${jx}px,${jy}px) scale(1.2)`, offset: 0.35 }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px) scale(.8)` }], { duration: calm ? 300 : 750, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = () => { el.remove(); done(); };
}

// ---------- the end of a day
function endDay() {
  phase = 'idle'; g = null;
  const first = !save.tutorial;
  save.tutorial = true; save.day++; save.dayAtTier++;
  save.best = Math.max(save.best, day.earned + day.tips);
  store();
  const stars = day.stars.length ? Math.round(day.stars.reduce((a, b) => a + b, 0) / day.stars.length) : 0;
  rec.end('day', { day: save.day - 1, tier: save.tier, served: day.served, coins: day.earned + day.tips, stars });
  $('dayTitle').textContent = t('dayDone', { n: save.day - 1 });
  $('dayStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('ledger').innerHTML = `<tr><td>${t('served')}</td><td>${day.served}</td></tr><tr><td>${t('earned')}</td><td>${day.earned}</td></tr><tr><td>${t('tips')}</td><td>${day.tips}</td></tr><tr class="total"><td><i class="coin"></i></td><td>${save.coins}</td></tr>`;
  $('dayLine').textContent = first ? t('t7') : '';
  coach(null); fingerOff(); gauge(null);
  SFX.star(); art.view('room');
  show('dayEnd');
}
$('nextDay').addEventListener('click', () => { snd.unlock(); SFX.tap(); beginDay(); });
$('dayMenu').addEventListener('click', () => { SFX.tap(); show('menu'); });
$('toShop2').addEventListener('click', () => { SFX.tap(); show('shop'); });
$('toShop').addEventListener('click', async () => { snd.unlock(); SFX.tap(); await ready; show('shop'); });
$('shopBack').addEventListener('click', () => { SFX.tap(); show('menu'); });
$('shopGo').addEventListener('click', async () => { snd.unlock(); SFX.tap(); await ready; beginDay(); });

// ---------- the restaurant: build and upgrade, then earn the next star
const THUMB = { tray: 'tray', knife: 'cooking-knife', stove: 'frying-pan', micro: 'room:kitchenMicrowave', blender: 'room:kitchenBlender', tables: 'room:tableRound', decor: 'room:pottedPlant' };
function shop(fresh = null) {
  art?.view('room');
  $('shopCoins').textContent = save.coins;
  const next = TIERS[save.tier + 1];
  if (!next) $('starBox').innerHTML = `<div class="title">${starText(5)}</div><div>${t('starDone')}</div>`;
  else {
    const c = sim.canStar(save);
    const needs = Object.entries(next.needs).map(([k, v]) => `<span class="${save.built[k] >= v ? 'ok' : ''}">${t('b_' + k)} ${t('lv', { n: v })}${save.built[k] >= v ? ' ✓' : ''}</span>`).join('');
    $('starBox').innerHTML = `<div class="title">${starText(save.tier + 1)} ${t('starUp', { rank: rankName(save.tier + 1) })}</div><div class="need">${needs}</div><button id="starGo" class="main" ${c.ok ? '' : 'disabled'}><i class="coin"></i> ${next.cost}</button>`;
    $('starGo').addEventListener('click', starUp);
  }
  $('builds').innerHTML = BUILDING_IDS.map(id => {
    const lv = save.built[id], c = sim.canBuild(save, id);
    const label = c.why === 'max' || (c.why === 'star' && BUILDINGS[id].max.at(-1) <= lv) ? t('maxed') : c.why === 'star' ? t('needStar', { stars: '★'.repeat(BUILDINGS[id].max.findIndex(m => m > lv)) }) : `<i class="coin"></i>${c.cost}`;
    const pic = art ? `<img alt="" src="${art.thumb(THUMB[id], 64)}">` : '';
    return `<div class="bld${fresh === id ? ' new' : ''}">${pic}<div class="name">${t('b_' + id)}</div><div class="lv">${lv ? t('lv', { n: lv }) : t('notBuilt')}</div><div class="what">${t('w_' + id)}</div><button data-b="${id}" ${c.ok ? '' : 'disabled'}>${lv ? '' : t('build') + ' '}${label}</button></div>`;
  }).join('');
  for (const b of $('builds').querySelectorAll('button[data-b]')) b.addEventListener('click', () => buildIt(b.dataset.b));
}
function buildIt(id) {
  if (!sim.build(save, id)) return;
  store(); SFX.build(); buzz(25);
  art.setRestaurant(save, id);
  rec.event('build', { id, level: save.built[id], tier: save.tier });
  shop(id); hud();
}
function starUp() {
  const before = sim.menuFor(save);
  if (!sim.star(save)) return;
  save.dayAtTier = 0; store(); SFX.star(); buzz([30, 40, 60]);
  art.setRestaurant(save, 'decor');
  const added = sim.menuFor(save).filter(id => !before.includes(id)).map(id => t('r_' + id));
  rec.event('star', { tier: save.tier });
  if (save.tier === TIERS.length - 1) rec.end('won', { day: save.day, served: save.served });
  shop(); hud();
  flash();
  if (added.length) floater({ x: innerWidth / 2, y: innerHeight * 0.3 }, t('unlocked', { what: added.join(', ') }), 'gold');
}

// ---------- small helpers for the page
let waits = [];
function wait(sec, fn) { waits.push({ at: clock + sec, fn, g }); }
function banner(text, sub = '') {
  const b = $('banner'); b.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); b.style.display = 'block';
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('on'), sub ? 1800 : 1000);
}
function coach(text, secs = 0) { const c = $('coach'); clearTimeout(coach.t); if (!text) { c.style.display = 'none'; return; } if (secs) coach.t = setTimeout(() => { if ($('coachText').textContent === text) c.style.display = 'none'; }, secs * 1000); $('coachText').textContent = text; c.style.display = 'block'; $('coachText').style.animation = 'none'; void c.offsetWidth; $('coachText').style.animation = ''; }
function floater(p, text, cls = '') { const el = document.createElement('div'); el.className = 'floater ' + cls; el.textContent = text; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; $('float').append(el); setTimeout(() => el.remove(), 1100); }
function worldPx(x, y, z = LANE.z) { return art.toScreen(new art.THREE.Vector3(x, y, z)); }
function flash() { $('flash').style.opacity = 0.8; setTimeout(() => { $('flash').style.opacity = 0; }, 120); }
function gauge(kind) {
  const el = $('gauge');
  if (!kind) { el.style.display = 'none'; return; }
  el.style.display = 'block'; el.classList.toggle('taps', kind === 'blend');
  $('gaugeLabel').textContent = kind === 'fry' ? t('hold') + '!' : kind === 'micro' ? t('tap') + '!' : t('blendSub');
  $('gaugeNeedle').style.display = kind === 'blend' ? 'none' : 'block';
}
function gaugeSet(v, band) {
  if (band) { $('gaugeBand').style.left = band[0] * 100 + '%'; $('gaugeBand').style.width = (band[1] - band[0]) * 100 + '%'; }
  else { $('gaugeBand').style.left = '0'; $('gaugeBand').style.width = v * 100 + '%'; }
  $('gaugeNeedle').style.left = v * 100 + '%';
}
// The tutorial's pointing finger (Adam likes it in the other games): a swipe across the board, or a tap on the register.
let fingerAnim = null;
function fingerOff() { $('finger').style.display = 'none'; fingerAnim = null; }
function fingerSwipe() { fingerAnim = { kind: 'swipe', t: 0 }; $('finger').style.display = 'block'; }
function fingerTap(world) { fingerAnim = { kind: 'tap', t: 0, world }; $('finger').style.display = 'block'; }
function stepFinger(dt) {
  if (!fingerAnim || calm && fingerAnim.t > 0) return;
  fingerAnim.t += dt;
  const el = $('finger');
  let p, press = false;
  if (fingerAnim.kind === 'swipe') {
    const a = art.toScreen(new art.THREE.Vector3(-0.42, TOP + 0.08, 0.32)), b = art.toScreen(new art.THREE.Vector3(0.42, TOP + 0.08, -0.05));
    const k = (fingerAnim.t % 1.6) / 1.1; const e = Math.min(1, k);
    p = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; press = k < 1;
  } else {
    p = art.toScreen(fingerAnim.world); press = (fingerAnim.t % 0.9) < 0.25;
  }
  el.style.transform = `translate(${p.x - 10}px, ${p.y - 4}px)`; el.classList.toggle('press', press);
}

// ---------- input
// The tray follows the finger's x at the tray's depth; arrows and A/D move it too. A tap stops the microwave, a hold fries.
function pointerX(e) { const w = art.toPlane(e.clientX, e.clientY, LANE.z); return Math.max(-1, Math.min(1, w.x)); }
let swipeId = 0;
canvas.addEventListener('pointerdown', e => {
  if (screen !== 'play' || paused || !art) return;
  e.preventDefault(); touched = true;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  finger = { id: e.pointerId };
  trayTarget = pointerX(e);
  if (phase === 'chop') { swipe = { id: ++swipeId, x: e.clientX, y: e.clientY, len: 0 }; swipeTo(e.clientX, e.clientY); }
  else if (phase === 'fry' && cook && !cook.over) cook.held = true;
  else if (phase === 'micro') stopMicro();
  else if (phase === 'blend') tapBlend();
  else if (phase === 'ring') openRegister();
  else if (phase === 'close') closeRegister();
});
canvas.addEventListener('pointermove', e => {
  if (screen !== 'play' || paused || !art) return;
  if (finger && finger.id === e.pointerId) { trayTarget = pointerX(e); if (phase === 'chop') swipeTo(e.clientX, e.clientY); }
  else if (e.pointerType === 'mouse' && phase === 'catch') { trayTarget = pointerX(e); touched = true; }
});
const up = e => { if (finger && finger.id === e.pointerId) finger = null; swipe = null; if (phase === 'fry') letGo(); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (screen === 'paused') resume(); else if (screen === 'play') pause(); return; }
  if (screen !== 'play' || paused) return;
  keys.add(e.key); touched = true;
  if (e.repeat) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (phase === 'fry' && cook && !cook.over) cook.held = true;
    else if (phase === 'micro') stopMicro();
    else if (phase === 'blend') tapBlend();
    else if (phase === 'chop') cutNext();
    else if (phase === 'ring') openRegister();
    else if (phase === 'close') closeRegister();
  }
});
addEventListener('keyup', e => { keys.delete(e.key); if ((e.key === ' ' || e.key === 'Enter') && phase === 'fry') letGo(); });

// ---------- pause
function pause() {
  if (paused || (screen !== 'play' && screen !== 'extra')) return;
  before = screen; paused = true; snd.hold(); finger = null; swipe = null; if (cook?.kind === 'fry') cook.held = false;
  show('paused');
}
function resume() {
  if (!paused) return;
  paused = false; last = performance.now(); snd.release(); show(before === 'extra' ? 'extra' : 'play');
}
$('pause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pause(); });
$('pause').addEventListener('click', e => { e.preventDefault(); pause(); });
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', () => {
  paused = false; snd.release();
  if (day && g) rec.end('left', { day: save.day, tier: save.tier, served: day.served, guest: day.i });
  if (g?.model) g.model.gone = true;
  clearCatch(); for (const m of cook?.items ?? []) art.world.remove(m); for (const b of cook?.bits ?? []) art.world.remove(b.m); if (dish) { art.world.remove(dish); dish = null; }
  g = null; cook = null; day = null; phase = 'idle'; waits = []; fingerOff(); coach(null); gauge(null);
  art?.register.close();
  show('menu');
});
onLeave(pause);
$('play').addEventListener('click', async () => { snd.unlock(); await ready; if (screen === 'menu') beginDay(); });
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => { save.sound = !save.sound; store(); if (save.sound) { snd.unlock(); if (!paused) snd.release(); SFX.tap(); } labels(); });
for (const id of ['music1', 'music2']) $(id).addEventListener('click', () => { musicOn = !musicOn; write(MUSIC_KEY, musicOn ? '1' : '0'); labels(); });
$('look').addEventListener('click', () => {
  lookId = LOOK_IDS[(LOOK_IDS.indexOf(lookId) + 1) % LOOK_IDS.length]; write(LOOK_KEY, lookId);
  art?.setLook(lookId); SFX.tap(); labels();
});
$('lang').addEventListener('click', () => { W.setLang(W.lang() === 'en' ? 'tr' : 'en'); W.apply(); labels(); menu(); SFX.tap(); });

// ---------- the frame
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!art) return;
  const live = screen === 'play' && !paused;
  if (live) {
    clock += dt;
    for (const w of waits.splice(0)) { if (w.g !== g) continue; if (clock >= w.at) w.fn(); else waits.push(w); }
    // The tray: keys move the target; the tray follows it quickly.
    const kx = (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0);
    if (kx) trayTarget = Math.max(-1, Math.min(1, trayTarget + kx * 2.4 * dt));
    trayX += (trayTarget - trayX) * (1 - Math.exp(-dt * 22));
    art.tray.setX(trayX);
    art.tray.group.visible = phase === 'catch' || phase === 'caught' || phase === 'order';
    if (phase === 'catch' && g?.catch) stepCatch(dt);
    else if (phase === 'fry' && cook) stepFry(dt);
    else if (phase === 'micro' && cook) stepMicro(dt);
    else if (phase === 'blend' && cook) stepBlend(dt);
    if (g && phase === 'catch') { const w = (clock - g.catchT0) / TUNE.patience; $('patience').firstElementChild.style.transform = `scaleX(${Math.max(0, 1 - w)})`; $('patience').firstElementChild.style.background = w > 0.75 ? '#ff6b6b' : w > 0.5 ? '#ffb347' : ''; }
    for (const b of cook?.bits ?? []) { if (b.t > 0.6) continue; b.t += dt; b.v.y -= 6 * dt; b.m.position.addScaledVector(b.v, dt); if (b.m.position.y < b.y0) { b.m.position.y = b.y0; b.v.set(0, 0, 0); b.t = 1; } b.m.rotation.z += dt * 6 * Math.sign(b.v.x); }
    for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.z += dt * 10; if (f.t > 1.2) { art.world.remove(f.m); flying.splice(i, 1); } }
    for (const m of art.tray.load.children) if (m.userData.drop > 0) { m.userData.drop = Math.max(0, m.userData.drop - dt); m.position.y += -m.userData.drop * dt * 2; }
    if (slide && dish) { slide.t = Math.min(1, slide.t + dt * 2.2); dish.position.lerpVectors(slide.from, slide.to, elasticOut(slide.t) * 0.3 + slide.t * 0.7); dish.position.y = TOP + Math.sin(slide.t * Math.PI) * 0.15; if (slide.t >= 1) slide = null; }
    if (phase !== 'chop') art.knife.position.set(0.55, TOP + 0.02, 0.32), art.knife.rotation.set(0, -0.4, 0);
    stepFinger(dt);
  }
  song?.set({ on: musicOn && live, progress: day ? Math.min(1, (day.i + 0.5) / day.plan.length) : 0, danger: phase === 'catch' && g?.catch ? Math.min(1, (clock - g.catchT0) / TUNE.patience) * 0.6 : 0, light: 1 });
  art.frame(paused ? 0 : dt);
}
requestAnimationFrame(frame);
labels(); hud(); menu();

// First-time help (kit/hint.js): a see-through finger slides side to side under the tray.
hint(canvas, {
  kind: 'drag', key: 'kitchen:hint', delay: 1500,
  when: () => screen === 'play' && !paused && phase === 'catch',
  played: hadSave, bottom: () => Math.max(120, innerHeight * 0.3),
});

// ---------- for checks
// Defined once the 3D kitchen has loaded, so checks that reload the page wait for the models first.
window.kitchenState = () => art && peopleIn && ({
  screen, paused, t: +clock.toFixed(3), phase, coins: save.coins, tier: save.tier, day: save.day, tray: +trayX.toFixed(3), sound: save.sound,
  built: { ...save.built }, tutorial: save.tutorial, served: save.served, touched, ready: !!art, recipe: g?.recipe ?? null,
  guest: day?.i ?? -1, guests: day?.plan.length ?? 0, need: g?.catch ? { ...g.catch.need } : null, got: g?.catch ? { ...g.catch.got } : null,
  extra: g?.catch?.extra?.id ?? null, items: g?.catch ? g.catch.items.map(it => ({ id: it.id, x: it.x, y: it.y })) : [], half: g?.catch?.half ?? 0,
  cook: cook ? { kind: cook.kind, d: cook.d, p: cook.p, band: cook.band, fill: cook.fill, left: cook.pieces?.filter(p => !p.done).length } : null,
  look: lookId, hint: !!document.querySelector('.kit-hint.on'),
});
window.kitchenMusic = () => song && { ...song.melody, on: song.state.on, step: song.step, notes: song.log.length, kinds: song.log.map(l => l.kind) };
// Keeps a catch going for checks that wait on the hint: nothing is caught or finished while it runs.
window.kitchenAlive = () => { if (g?.catch) { g.catch.got = {}; g.catch.tray = []; g.catch.done = false; } };
window.kitchenScreen = (x, y, z) => art && art.toScreen(new art.THREE.Vector3(x, y, z));
