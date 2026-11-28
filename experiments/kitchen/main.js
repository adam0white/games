// Sky Kitchen: the page. Cards, input, sound, save, the order of a guest's visit. The rules are in sim.js, the 3D in art.js.
import * as sim from './sim.js';
import { ING, JUNK, RECIPES, TIERS, BUILDINGS, BUILDING_IDS, STATION, TUNE } from './sim.js';
import { createView, LANE, TOP, PAN, LOOK_IDS, elasticOut } from './art.js';
import { W, t, many, one } from './words.js';
import { read, write, readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { music } from '../kit/music.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { settings } from '../kit/settings.js';
import * as story from './story.js';
import * as sh from './shift.js';
// Story beats and daily specials (data). A failed load just means a day without story.
const storyData = Promise.all(['beats', 'specials'].map(n => fetch(`./story/${n}.json`).then(r => r.json()).catch(() => null))).then(([beats, sp]) => ({ beats: beats ?? [], specials: sp?.specials ?? [] }));
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js'; noZoom();

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
W.apply();

// ---------- the save: one JSON blob; fields only ever grow. Keys never change once shipped.
const KEY = 'kitchen-save', MUSIC_KEY = 'kitchen-music', LOOK_KEY = 'kitchen-look', PEOPLE_KEY = 'kitchen-people';
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
// The story's progress lives in its own key so the game save keeps its first shape.
const STORY_KEY = 'kitchen-story';
{ const st = readJson(STORY_KEY, null); if (st && typeof st === 'object' && Array.isArray(st.seen)) save.story = st; }
const store = () => { writeJson(KEY, { ...save, story: undefined }); if (save.story) writeJson(STORY_KEY, save.story); };
// Tool skins (cosmetic; their own key): what the glove holds when chopping, and the sound it makes.
const TOOLS_KEY = 'kitchen-tools';
const TOOLS = [
  { id: 'chef', cost: 0, tier: 0, icon: '🔪' }, { id: 'chopsticks', cost: 30, tier: 0, icon: '🥢' },
  { id: 'spatula', cost: 60, tier: 1, icon: '🍳' }, { id: 'cleaver', cost: 150, tier: 2, icon: '🪓' },
  { id: 'fish', cost: 220, tier: 3, icon: '🐟' }, { id: 'machete', cost: 400, tier: 4, icon: '🗡️' },
  { id: 'golden', cost: 900, tier: 5, icon: '✨' },
];
const tools = (() => { const o = readJson(TOOLS_KEY, null), ids = TOOLS.map(x => x.id); const own = Array.isArray(o?.own) ? o.own.filter(x => ids.includes(x)) : []; if (!own.includes('chef')) own.unshift('chef'); return { own, use: ids.includes(o?.use) && own.includes(o.use) ? o.use : 'chef' }; })();
const storeTools = () => writeJson(TOOLS_KEY, tools);
// Staff (own key): guests hired with the wheel, or beaten in a fist fight and owing a free shift.
const STAFF_KEY = 'kitchen-staff';
const staff = (() => { const o = readJson(STAFF_KEY, null); return Array.isArray(o) ? o.filter(x => x && Number.isFinite(x.look) && (x.kind === 'hired' || x.kind === 'owed')).slice(0, sim.STAFF_MAX).map(x => ({ look: x.look | 0, kind: x.kind, name: String(x.name ?? 'Pip').slice(0, 12), fresh: !!x.fresh })) : []; })();
const storeStaff = () => writeJson(STAFF_KEY, staff.map(({ look, kind, name, fresh }) => ({ look, kind, name, ...(fresh ? { fresh } : {}) })));
// No look button: art directions are picked by link (?look=storybook), and the pick sticks on this device.
let lookId = LOOK_IDS.includes(query.get('look')) ? query.get('look') : LOOK_IDS.includes(read(LOOK_KEY)) ? read(LOOK_KEY) : 'diner';
if (LOOK_IDS.includes(query.get('look'))) write(LOOK_KEY, lookId);
// Taste choices are player settings with a default; each change is recorded (from, to) so the default can follow players.
const LOOK_ORDER = ['diner', 'storybook', 'diorama', 'comic', 'toon', 'night', 'clay'].filter(id => LOOK_IDS.includes(id));
// Recorded through the kit's settings (kit/settings.js): setting {id, value, from, def}.
const settingChanged = (id, from, to) => opts.track(id, to, from);

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
  thunk() { noise(0.05, 0.12, 500); tone(110, 0.08, 0.08, 'triangle', -40); },
  // Each tool's own cut sound, on top of the chop.
  toolCut() { const u = tools.use; if (u === 'chopsticks') { tone(2400, 0.03, 0.05, 'square'); later(40, () => tone(2600, 0.03, 0.04, 'square')); } else if (u === 'fish') { noise(0.09, 0.14, 700); tone(140, 0.12, 0.06, 'sine', -60); } else if (u === 'cleaver') { tone(80, 0.12, 0.12, 'square', -30); } else if (u === 'machete') { noise(0.14, 0.06, 6500); } else if (u === 'golden') { tone(2093, 0.25, 0.04); } else if (u === 'spatula') { tone(700, 0.08, 0.05, 'triangle', -300); } },
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
  key() { tone(1200 + Math.random() * 200, 0.03, 0.035, 'square'); noise(0.02, 0.04, 3000); },
  bill() { noise(0.07, 0.05, 4200); tone(600, 0.04, 0.015, 'triangle', 200); },
  clunk() { noise(0.09, 0.18, 380); tone(95, 0.16, 0.14, 'square', -40); later(60, () => noise(0.05, 0.08, 900)); },
  build() { [392, 523, 659, 784].forEach((f, i) => later(i * 80, () => tone(f, 0.2, 0.07, 'triangle'))); noise(0.2, 0.05, 1200); },
  star() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => later(i * 110, () => { tone(f, 0.4, 0.08, 'triangle'); tone(f / 2, 0.35, 0.04); })); },
  happy() { tone(880, 0.1, 0.05, 'sine', 300); later(110, () => tone(1175, 0.15, 0.05, 'sine', 200)); },
  step() { noise(0.03, 0.02, 700); },
  // Slapstick: the wheel's sounds.
  spin() { for (let i = 0; i < 10; i++) later(i * 60, () => tone(900 - i * 40, 0.04, 0.03, 'square')); },
  slap() { noise(0.05, 0.25, 3200); tone(300, 0.08, 0.06, 'triangle', -200); },
  boing() { tone(180, 0.45, 0.09, 'sine', 500); },
  crash() { noise(0.35, 0.16, 900); later(120, () => noise(0.2, 0.1, 2400)); tone(90, 0.2, 0.1, 'square', -30); },
  punch() { noise(0.06, 0.22, 700); tone(120, 0.08, 0.12, 'square', -60); },
  splat() { noise(0.18, 0.2, 500); tone(200, 0.2, 0.07, 'sine', -150); },
  jingle() { for (let i = 0; i < 8; i++) later(i * 70, () => tone(1800 + Math.random() * 900, 0.06, 0.03, 'square')); },
};
const buzz = ms => { if (save.sound && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };

// ---------- lab recording
const rec = lab('kitchen', { lang: W.lang });
const opts = settings('kitchen', { look: { values: LOOK_ORDER, def: 'diner', key: LOOK_KEY }, people: { values: ['on', 'off'], def: 'on', key: PEOPLE_KEY } }, { rec });
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);

// ---------- run state
let screen = 'menu', paused = false, before = 'play', clock = 0, last = performance.now();
let art = null, ready = null;
// Play waits for the models, so nothing starts in a half-built kitchen.
$('play').disabled = true; $('play').classList.add('loading');
let day = null;        // { plan, i, served, earned, tips, stars[], seed }
let g = null;          // the guest being served: { recipe, model, phase, catch, q[], wait, ... }
let goldenNext = false, skipCatch = false, peopleIn = false, phase = 'idle', trayX = 0, trayTarget = 0, finger = null, keys = new Set(), touched = false;
const meshes = new Map();  // falling item n -> mesh

// The Chop button, for touch screens.
const coarse = matchMedia('(pointer: coarse)').matches;
let chopShown = false;
function chopBtn(on) { on = on && (coarse || touchSeen); if (on !== chopShown) { chopShown = on; $('chopBtn').style.display = on ? 'flex' : 'none'; } }
let touchSeen = false, visits = 0;   // visits: counts screen changes, so a start that waited for loading can tell the menu was left
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchSeen = true; }, true);

const show = screens(['menu', 'paused', 'extra', 'dayEnd', 'shop'], name => {
  screen = name === 'dayEnd' ? 'dayend' : name; visits++;
  const playing = name === 'play' || name === 'extra';
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  $('hud').style.display = playing || name === 'paused' ? 'flex' : 'none';
  for (const id of ['ticket', 'gauge', 'coach', 'banner', 'finger', 'mission']) if (!playing && name !== 'paused') $(id).style.display = 'none';
  if (playing && g && ['catch', 'chop', 'fry', 'micro', 'blend', 'ring', 'close', 'serve', 'plate'].includes(phase)) $('ticket').style.display = 'block';
  // Off play, nothing of a station stays out: no Chop button; and off the pause card the knife, flames and pan go back.
  if (name !== 'play') chopBtn(false);
  { const on = !!rush && (playing || name === 'paused'); $('rail').style.display = on ? 'flex' : 'none'; $('rail').style.visibility = playing ? '' : 'hidden'; $('rushHud').style.display = on ? 'flex' : 'none'; $('rank').style.display = on ? 'none' : ''; $('coins').style.display = on ? 'none' : ''; document.body.classList.toggle('rush', on); $('rushMission').style.visibility = playing ? '' : 'hidden'; }
  if (art && !playing && name !== 'paused') { art.knife.rest(); if (flames) flames.visible = false; art.pan.rotation.x = 0; art.panGlow.material.opacity = 0; }
  if (name === 'menu') menu();
  if (name === 'play') missionChip();
  // A story card waits under the pause and extra cards; leaving for the menu drops it.
  $('story').style.visibility = name === 'play' ? '' : 'hidden';
  if (name === 'menu' || name === 'dayEnd' || name === 'shop') $('story').style.display = 'none';
  if (name === 'shop') shop();
  labels(); hud();
});
function labels() {
  for (const id of ['sound1', 'sound2']) { $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff'); $(id).setAttribute('aria-pressed', String(save.sound)); }
  for (const id of ['music1', 'music2']) { $(id).textContent = t(musicOn ? 'musicOn' : 'musicOff'); $(id).setAttribute('aria-pressed', String(musicOn)); }
  for (const id of ['look1', 'look2']) $(id).textContent = t('look', { name: t('looks_' + lookId) });
  $('people2').textContent = t(peopleOn() ? 'peopleOn' : 'peopleOff');
  $('chopBtnText').textContent = t('chop'); $('wheelBtnText').textContent = t('wheelBtn');
}
const rankName = tier => t('rank_' + TIERS[tier].name);
// Five stars, then a moon for each rank above the clouds.
const starText = tier => '★'.repeat(Math.min(5, tier)) + '☆'.repeat(Math.max(0, 5 - tier)) + '☾'.repeat(Math.max(0, tier - 5));
function hud() {
  $('coinText').textContent = save.coins;
  $('rankStars').textContent = starText(save.tier);
  $('dayText').textContent = t('day', { n: save.day });
}
function menu() {
  $('play').textContent = save.tutorial ? t('cont', { n: save.day }) : t('play');
  $('toShop').style.display = save.tutorial ? '' : 'none';
  $('rush').style.display = save.tutorial ? '' : 'none';
  nightMenu();
  $('menuLine').textContent = save.tutorial ? t('menuLine', { coins: save.coins, rank: rankName(save.tier) }) : '';
  art?.view('menu');
}

// ---------- the 3D view
const canvas = $('c');
ready = createView(canvas, lookId).then(v => {
  art = v; art.setRestaurant(save); art.view('menu', true); art.knife.setSkin(tools.use);
  // A guest at the counter on the menu: the restaurant is open.
  art.peopleReady.then(() => { peopleIn = true; $('play').disabled = false; $('play').classList.remove('loading'); });
  art.peopleReady.then(async () => { if (screen === 'menu' && !g) { const m = await art.guest(2); if (m) { m.g.position.set(1.6, 0, 1.7); m.play('idle'); m.face = 0.3; menuGuest = m; } } });
  return storyData.then(() => v);
}).catch(e => { console.error(e); });
let menuGuest = null;

// ---------- a day
function beginDay() {
  rush = null; clearRush(); $('nextDay').textContent = t('nextDay');
  art.register.reset?.();
  if (menuGuest) { menuGuest.gone = true; menuGuest = null; }
  for (const m of art.guests) m.gone = true;
  const seed = query.has('seed') ? Number(query.get('seed')) >>> 0 : (Date.now() ^ save.day * 7919) >>> 0;
  let plan = save.tutorial ? sim.dayPlan(save, seed) : sim.TUTORIAL_DAY.slice();
  if (save.tutorial && query.get('recipe') in RECIPES) plan = plan.map(p => ({ ...p, recipe: query.get('recipe') })); // for checks and the owner's tries
  if (save.tutorial && storyBook) {
    if (story.reopen(save, storyBook.beats).length) store();
    const menuNow = sim.menuFor(save);
    story.pickSpecial(save, storyBook.specials, menuNow, seed);
    plan = story.forceDishes(plan, story.wantedDishes(save), menuNow);
    if (save.tier >= sim.MOOD_FROM) plan = sim.forceMoods(plan, story.wantedMoods(save));
  }
  day = { plan, i: -1, served: 0, earned: 0, tips: 0, stars: [], seed, t0: clock, extras: 0, robbed: 0, rebels: [], line: sim.lineOn(save) ? [] : null, next: 0, arriveT: 0.3, lost: 0, pickT: 0 };
  // Staff come in for the shift. A guest who owes a shift may rebel at some point today.
  const rr = sim.rng(seed ^ 0xbad);
  staff.forEach(m => { m.model = null; if (m.kind === 'owed' && rr() < sim.REBEL_CHANCE) day.rebels.push({ at: 1 + Math.floor(rr() * Math.max(1, plan.length - 1)), who: m }); });
  staffIn();
  song?.start(seed);
  rec.start({ day: save.day, tier: save.tier, tutorial: !save.tutorial, look: lookId, tool: tools.use, sound: save.sound, music: musicOn });
  paused = false; snd.release(); show('play'); hud();
  if (storyBook) { const d = story.due(save, storyBook.beats); storyQueue = d.cards.slice(); storyToasts = d.toasts.slice(); for (const b of d.toasts) story.see(save, b); store(); }
  nextStory(); missionChip();
  nextGuest();
}
async function nextGuest() {
  day.i++;
  clearCatch(); g = null;
  if (!day.line && day.i >= day.plan.length) return endDay();
  const reb = day.rebels.find(x => x.at === day.i && staff.includes(x.who));
  if (reb) { day.rebels = day.rebels.filter(x => x !== reb); day.i--; return rebel(reb.who); }
  if (day.line) return pickPhase();
  startGuest(day.plan[day.i], null);
}
// The guest at the counter. With the line, `model` is the guest already waiting in the room.
async function startGuest(p, model) {
  const r = RECIPES[p.recipe];
  g = { mood: p.mood ?? null, look: p.look, recipe: p.recipe, q: [], steps: r.steps.slice(), step: -1, wait: 0, extras: 0, restarts: 0, paid: 0, model: null, tut: !save.tutorial ? day.i : -1 };
  // A golden recipe: rare, more ingredients, a harder catch, and triple pay if every step is clean.
  g.golden = goldenNext || (save.tutorial && save.tier >= 1 && day.i > 0 && sim.rng(day.seed * 7 + day.i * 131)() < sim.TUNE.golden);
  goldenNext = false;
  g.need = g.golden ? Object.fromEntries(Object.entries(r.need).map(([k, n]) => [k, n + Math.max(1, Math.round(n * 0.6))])) : { ...r.need };
  const me = g;
  phase = 'enter'; art.view('serve');
  $('ticket').style.display = 'none';
  const m = model ?? await art.guest(p.look);
  if (me !== g) { if (m) m.gone = true; return; }
  m?.bubble.hide();
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
  if (g.mood) { g.model?.bubble.show(null, g.mood); coach(t('mood_' + g.mood), 3); later(1100, () => { if (g?.model && phase === 'order') g.model.bubble.show(art.thumb(dishModel(g.recipe))); }); }
  wheelBtn(wheelOn());
  wait(g.tut === 0 ? 2.2 : g.mood ? 3.2 : wheelOn() ? 1.6 : 1.1, () => { if (phase !== 'order') return; wheelBtn(false); if (storyOpen()) pendingCatch = g; else startCatch(); });
}
function dishModel(id) { const r = RECIPES[id]; if (r.dish) return r.dish; if (r.bowl) return 'bowl'; const first = Object.keys(r.need)[0]; return ING[first]?.chop ?? ING[first]?.model ?? 'carrot'; }
const itemModel = id => (ING[id] ?? JUNK[id]).model;

// ---------- the catch
function startCatch() {
  phase = 'catch'; art.view('catch');
  const tutorial = g.tut === 0 ? 'first' : g.tut >= 1 ? true : false;
  g.catch = sim.newCatch({ need: g.need, hard: sim.hardness(save) + (g.golden ? 2.5 : 0), trayLevel: save.built.tray, twist: sim.twistFor(save.tier), seed: day.seed + day.i * 101 + g.restarts * 7, tutorial });
  g.catchT0 = clock;
  banner(g.golden ? t('golden') : t('catch'), g.golden ? t('goldenSub') : '');
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
  // Small steps so a slow frame cannot drop an item through the tray.
  const ev = []; for (let left = dt; left > 1e-6; left -= 0.034) ev.push(...sim.stepCatch(c, trayX / LANE.s, Math.min(0.034, left)));
  if (skipCatch && !c.done && !c.extra) { skipCatch = false; c.got = { ...c.need }; c.done = true; ev.push({ type: 'done' }); }
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
      g.extras++; day.extras++; SFX.wrong(); buzz([40, 60, 40]); art.shake(1); art.tray.bump();
      $('ticket').classList.remove('shake'); void $('ticket').offsetWidth; $('ticket').classList.add('shake');
      floater(worldPx(trayX, LANE.y0 + 0.35), '✗', 'bad');
      song?.hit();
      later(500, () => { if (g?.catch === c && c.extra) extraCard(); });
    } else if (e.type === 'missed') {
      const m = meshes.get(e.it.n); meshes.delete(e.it.n); if (m) art.world.remove(m);
      if (!sim.isJunk(e.it.id) && g.need[e.it.id]) { SFX.miss(); song?.miss(); }
    } else if (e.type === 'done') {
      g.wait = clock - g.catchT0;
      g.q.push(g.extras ? 0.85 : 1);
      tally({ type: 'catch', clean: g.extras === 0 && g.restarts === 0 });
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
    if (!m) { m = art.item(itemModel(it.id), 0.27); m.userData.spin = (it.spin % 1) * 1.4 - 0.7; art.world.add(m); meshes.set(it.n, m); }
    m.position.set(it.x * LANE.s, LANE.y0 + it.y * LANE.h - 0.12, LANE.z);
    m.rotation.z += m.userData.spin * dt; m.rotation.y += dt * 0.5;
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
  $('extraNote').textContent = t('extraNote');
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
  $('ticket').classList.toggle('gold', !!g.golden);
  $('ticketHead').innerHTML = `${g.golden ? `<b class="goldTag">${t('golden')}</b>` : ''}<img alt="" src="${art.thumb(dishModel(g.recipe))}"><span>${t('r_' + g.recipe)}</span>`;
  $('ticketRows').innerHTML = Object.entries(g.need).map(([id, n]) => {
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
// Chop: aim the knife over a piece and strike. Mouse: the knife follows the pointer, a click strikes. Touch: drag aims, a tap
// or the Chop button strikes. Keys: arrows aim, Space strikes. A piece takes 1-3 strikes by rank; from the Diner on it slides.
let cook = null;
function startChop() {
  phase = 'chop'; art.view('chop');
  const need = g.need, ids = Object.entries(need).flatMap(([id, n]) => Array(n).fill(id));
  const n = ids.length, span = Math.min(0.72, n * 0.17);
  const pieces = ids.map((id, i) => {
    const m = lie(art.item(itemModel(id), 0.24)); const x = n === 1 ? 0 : -span / 2 + span * i / (n - 1);
    m.position.set(x, TOP + 0.045, 0.12 + (i % 2 ? 0.07 : -0.05)); m.rotation.y = (Math.random() - 0.5) * 0.6; art.world.add(m);
    const hw = Math.min(0.13, new art.THREE.Box3().setFromObject(m).getSize(new art.THREE.Vector3()).x / 2), s0 = m.scale.x;
    art.popIn(m, false);
    return { id, m, cuts: 0, x, z0: m.position.z, ph: Math.random() * 6.28, hw, s0 };
  });
  cook = { kind: 'chop', pieces, t0: clock, cuts: sim.chopCuts(save), slide: sim.chopSlide(save) * sim.knifeCalm(save.built.knife), reach: sim.knifeReach(save.built.knife), bits: [] };
  banner(t('chop'), t('chopSub'));
  aim = 0; art.knife.position.x = 0.45;
  if (g.rush && (rushSave.plays ?? 0) < 2) coach(t('t3'), 5);
  if (g.tut === 0) { coach(t('t3')); fingerTap(pieces[0].m.position.clone().add(new art.THREE.Vector3(0, 0.05, 0))); }
  gauge(null);
}
// A tall piece (a carrot, a leek) lies down on the board.
function lie(g) {
  const box = new art.THREE.Box3().setFromObject(g), d = box.getSize(new art.THREE.Vector3());
  if (d.y > Math.max(d.x, d.z) * 1.4) { const inner = g.children[0]; inner.rotation.z = Math.PI / 2; inner.position.y += d.x / 2; const b2 = new art.THREE.Box3().setFromObject(g); inner.position.y -= b2.min.y; const c = b2.getCenter(new art.THREE.Vector3()); inner.position.x -= c.x; }
  return g;
}
function cutAt(p, x = p.m.position.x) {
  p.cuts++;
  SFX.chop(); SFX.toolCut(); buzz(15); art.shake(0.4);
  const pos = new art.THREE.Vector3(x, TOP + 0.08, p.m.position.z);
  art.burst(pos, { n: 12, color: juice(p.id), speed: 1.1, up: 1.3, size: 0.022, life: 0.55 });
  if (p.cuts < cook.cuts) {
    // A slice falls off on the knife's side, and the piece gets shorter.
    const side = x >= p.m.position.x ? 1 : -1, half = ING[p.id]?.chop;
    const sl = art.item(half ?? itemModel(p.id), half ? 0.1 : 0.08); if (!half) sl.scale.x *= 0.4;
    sl.position.set(x + side * 0.03, TOP + 0.05, p.m.position.z); art.world.add(sl);
    cook.bits.push({ m: sl, v: new art.THREE.Vector3(side * 0.6, 0.9, (Math.random() - 0.5) * 0.3), y0: TOP + 0.03, t: 0 });
    p.m.scale.multiplyScalar(0.88); return;
  }
  // Two halves fly apart and settle.
  art.world.remove(p.m); p.done = true;
  { const next = cook.pieces.find(q => !q.done); if (fingerAnim && next) fingerAnim.world = next.m.position.clone().add(new art.THREE.Vector3(0, 0.05, 0)); }
  const half = ING[p.id]?.chop;
  for (const s of [-1, 1]) {
    const h = art.item(half ?? itemModel(p.id), half ? 0.15 : 0.13);
    if (!half) h.scale.x *= 0.55;
    h.position.copy(p.m.position); h.rotation.y = s > 0 ? 0 : Math.PI;
    art.world.add(h); cook.bits.push({ m: h, v: new art.THREE.Vector3(s * 0.35, 1.1, (Math.random() - 0.5) * 0.4), y0: TOP + 0.03, t: 0 });
  }
  floater(worldPx(p.m.position.x, TOP + 0.25, p.m.position.z), cook.pieces.every(q => q.done) ? t('yum') : '✂');
  if (cook.pieces.every(q => q.done)) {
    const q = sim.chopQuality(clock - cook.t0, cook.pieces.length * cook.cuts, save.built.knife);
    finishStep('chop', q);
  }
}
let aim = 0, tapStart = null;
const KNIFE = { y: TOP + 0.035, up: 0.26, tilt: 0.45, hitW: 0.025, down: 0.07, back: 0.14 };
function aimAt(cx, cy) { const w = art.toY(cx, cy, TOP + 0.05); if (Number.isFinite(w.x)) aim = Math.max(-0.55, Math.min(0.55, w.x)); }
function strike() {
  if (phase !== 'chop' || !cook || cook.kind !== 'chop' || cook.over || cook.strike) return;
  cook.strike = { t: 0, x: aim }; SFX.swish();
}
// The knife each chop frame: it hangs over the aim, raised and tipped up; a strike drops it flat on the board, then lifts it.
function stepKnife(dt) {
  const k = art.knife, L = art.knifeLift; k.userData.glove.visible = true;
  k.rotation.set(0, 0, 0); L.rotation.set(0, 0, 0);
  let lift = 1; const s = cook?.kind === 'chop' ? cook.strike : null;
  if (s) {
    s.t += dt;
    if (s.t < KNIFE.down) { const e = s.t / KNIFE.down; lift = 1 - e * e; }
    else { if (!s.hit) { s.hit = true; land(s.x); } const e = Math.min(1, (s.t - KNIFE.down) / KNIFE.back); lift = e * (2 - e); if (s.t >= KNIFE.down + KNIFE.back && cook) cook.strike = null; }
  }
  const x = s ? s.x : k.position.x + (aim - k.position.x) * (1 - Math.exp(-dt * 28));
  k.position.set(x, KNIFE.y + KNIFE.up * lift, 0.42); L.rotation.x = KNIFE.tilt * lift;
}
function land(x) {
  if (!cook || cook.kind !== 'chop' || cook.over) return;
  // The blade cuts what is under it: half the piece's width (it shrinks with each slice), plus a little.
  const hits = cook.pieces.filter(p => !p.done && Math.abs(p.m.position.x - x) < p.hw * p.m.scale.x / p.s0 + (cook.reach ?? KNIFE.hitW));
  if (!hits.length) { SFX.thunk(); art.shake(0.15); buzz(6); cook.misses = (cook.misses ?? 0) + 1; return; }
  if (hits.length >= 2) combo(hits.length, art.toScreen(hits[0].m.position.clone().add(new art.THREE.Vector3(0, 0.1, 0))));
  for (const p of hits) { cutAt(p, x); if (cook?.over) break; }
}
function combo(n, s) { floater({ x: s.x, y: s.y - 40 }, t('combo', { n }), 'gold'); SFX.coin(); g.combo = Math.max(g.combo ?? 0, n); }
const reach = () => Math.max(34, Math.min(innerWidth, innerHeight) * 0.09);
function stepChop() {
  for (const p of cook.pieces) if (!p.done) { p.m.position.x = p.x + Math.sin(clock * (1.1 + cook.slide * 3.5) + p.ph) * cook.slide * 0.7; p.m.position.z = p.z0 + Math.cos(clock * 1.1 + p.ph) * cook.slide * 0.15; }
}

// Fry: hold to heat, let go in the green. The food sits in the pan's bowl, flips twice, and browns golden, then brown, then black.
const FRY_MODEL = { egg: 'egg-cooked', sausage: 'hot-dog-raw', patty: 'meat-patty', steak: 'meat-raw', bacon: 'bacon-raw' };
const C = hex => new art.THREE.Color(hex);
let flames = null;
function startFry() {
  phase = 'fry'; art.view('fry');
  const items = cookItems(PAN.x, TOP + 0.07, PAN.z, art.panR * 2, 'fry');
  for (const m of items) m.traverse(o => { if (o.isMesh) o.material = [].concat(o.material).map(x => x.clone()).at(0); });
  cook = { kind: 'fry', items, d: 0, held: false, band: sim.fryBand(save.built.stove, save.tier), t: 0, tick: 0, flips: 0 };
  banner(t('fry'), t('frySub')); gauge('fry');
  if ((g.tut >= 0 && !save.tutorial) || (g.rush && (rushSave.plays ?? 0) < 2)) coach(t('frySub'), g.rush ? 5 : 0);
}
// What goes into a pan or a microwave. Food chopped earlier in this dish goes in cut: potatoes as fry sticks, others as halves.
function cookItems(x, y, z, span, where = 'micro') {
  const need = g.need, ids = Object.entries(need).flatMap(([id, n]) => Array(n).fill(id));
  const cut = g.steps.slice(0, g.step).includes('chop');
  return ids.map((id, i) => {
    let m;
    if (cut && id === 'potato') m = sticks();
    else if (cut) { const half = ING[id]?.chop; m = art.item(half ?? itemModel(id), half ? 0.13 : 0.11); if (!half) m.scale.x *= 0.6; }
    else m = art.item((where === 'fry' && FRY_MODEL[id]) || itemModel(id), 0.13);
    const a = i / ids.length * Math.PI * 2 + 0.4, r = ids.length > 1 ? Math.min(span * 0.3, 0.05 + ids.length * 0.025) : 0;
    m.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r * 0.8); m.rotation.y = Math.random() * 6; m.userData.y0 = y; art.world.add(m); return m;
  });
}
function sticks() {
  const grp = new art.THREE.Group();
  for (let i = 0; i < 5; i++) {
    const b = new art.THREE.Mesh(new art.THREE.BoxGeometry(0.02, 0.02, 0.12), new art.THREE.MeshStandardMaterial({ color: '#f6e3a1', roughness: 0.7 }));
    b.position.set((i - 2) * 0.024, 0.012 + (i % 2) * 0.012, (Math.random() - 0.5) * 0.03); b.rotation.y = (Math.random() - 0.5) * 0.5; b.castShadow = true; grp.add(b);
  }
  return grp;
}
// Gas flames around the pan's rim while the player holds.
function flameRing() {
  if (flames) return flames;
  flames = new art.THREE.Group();
  const mat = new art.THREE.MeshBasicMaterial({ color: '#ff6a10', transparent: true, opacity: 0.92, depthWrite: false });
  const blue = new art.THREE.MeshBasicMaterial({ color: '#2f7dff', transparent: true, opacity: 0.9, depthWrite: false });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, f = new art.THREE.Group();
    const o = new art.THREE.Mesh(new art.THREE.ConeGeometry(0.022, 0.09, 8), mat); o.position.y = 0.045; f.add(o);
    const b = new art.THREE.Mesh(new art.THREE.ConeGeometry(0.014, 0.04, 8), blue); b.position.y = 0.02; f.add(b);
    const rr = art.panR / 0.8 + 0.015; f.position.set(PAN.x + Math.cos(a) * rr, TOP + 0.005, PAN.z + Math.sin(a) * rr); f.userData.ph = Math.random() * 6; flames.add(f);
  }
  art.world.add(flames); return flames;
}
function stepFry(dt) {
  if (cook.over) return;
  if (cook.held) cook.d = Math.min(1, cook.d + sim.FRY_RATE * dt);
  cook.tick -= dt;
  art.panGlow.material.opacity = cook.held ? 0.55 * (0.8 + Math.random() * 0.2) : 0;
  const fl = flameRing(); fl.visible = cook.held;
  if (cook.held) for (const f of fl.children) f.scale.set(1, 0.7 + Math.abs(Math.sin(clock * 17 + f.userData.ph)) * 0.6, 1);
  const smoke = cook.d > 0.85;
  if (cook.tick <= 0) {
    cook.tick = cook.held ? 0.07 : 0.25; if (cook.held) SFX.sizzle();
    art.steam(new art.THREE.Vector3(PAN.x, TOP + 0.12, PAN.z), cook.held ? (smoke ? 4 : 2) : 1);
    if (cook.held && Math.random() < 0.5) art.burst(new art.THREE.Vector3(PAN.x, TOP + 0.1, PAN.z), { n: 2, color: smoke ? '#555' : '#fff3b0', speed: 0.8, up: 1.4, size: 0.012, life: 0.4 });
  }
  // The chef flips everything at a third and two thirds: a hop and a full turn in the air, with a pan jerk.
  if (cook.flips < 2 && cook.d >= (cook.flips + 1) / 3) { cook.flips++; SFX.whoosh(); for (const m of cook.items) m.userData.flip = { t: 0, r0: m.rotation.x, dir: Math.random() < 0.5 ? 1 : -1 }; cook.jerk = 0.2; }
  if (cook.jerk > 0) { cook.jerk = Math.max(0, cook.jerk - dt); art.pan.rotation.x = Math.sin(cook.jerk / 0.2 * Math.PI) * 0.12; } else art.pan.rotation.x = 0;
  // Browning: toward golden first, then brown, then black past the end.
  const d = cook.d, gold = Math.min(1, d / 0.45) * 0.45, brown = Math.max(0, Math.min(1, (d - 0.45) / 0.4)) * 0.55, black = Math.max(0, (d - 0.85) / 0.15) * 0.9;
  for (const m of cook.items) {
    const f = m.userData.flip;
    let y = m.userData.y0 + (cook.held ? Math.abs(Math.sin(clock * 20 + m.id)) * 0.012 : 0);
    if (f) { f.t = Math.min(1, f.t + dt * 2.6); y += Math.sin(f.t * Math.PI) * 0.22; m.rotation.x = f.r0 + f.dir * f.t * Math.PI * 2; if (f.t >= 1) { m.rotation.x = f.r0; m.userData.flip = null; } }
    m.position.y = y;
    m.traverse(o => { if (o.isMesh && o.material.color) { o.userData.c0 ??= o.material.color.clone(); o.material.color.copy(o.userData.c0).lerp(C('#e2a640'), gold).lerp(C('#7a3f14'), brown).lerp(C('#1c120b'), black); } });
  }
  gaugeSet(cook.d, cook.band);
  if (cook.d >= 1) letGo();
}
function letGo() {
  if (!cook || cook.kind !== 'fry' || cook.over || cook.d < 0.04) { if (cook) cook.held = false; return; }
  cook.held = false;
  const q = sim.fryQuality(cook.d, cook.band);
  art.panGlow.material.opacity = 0; if (flames) flames.visible = false; art.pan.rotation.x = 0;
  finishStep('fry', q);
}

// Microwave: a needle sweeps; tap to stop in the green.
function startMicro() {
  phase = 'micro'; art.view('micro');
  const items = cookItems(1.02, TOP + 0.1, -0.05, 0.2, 'micro');
  cook = { kind: 'micro', items, p: 0, dir: 1, band: sim.microBand(save.built.micro, save.tier), speed: sim.microSpeed(save.tier), tick: 0 };
  art.microLight.intensity = 2.2; art.microGlass.material.opacity = 0.35;
  banner(t('micro'), t('microSub')); gauge('micro');
  if ((g.tut >= 0 && !save.tutorial) || (g.rush && (rushSave.plays ?? 0) < 2)) coach(t('microSub'), g.rush ? 5 : 0);
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
  if ((g.tut >= 0 && !save.tutorial) || (g.rush && (rushSave.plays ?? 0) < 2)) coach(t('blendSub'), g.rush ? 5 : 0);
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
  if (word === 'burnt') { SFX.burnt(); art.steam(new art.THREE.Vector3(PAN.x, TOP + 0.15, PAN.z), 8); } else SFX.good();
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
  wait(rush ? 0.5 : 0.9, rush ? rushServe : serve);
}
function serve() {
  phase = 'serve';
  slide = { from: dish.position.clone(), to: new art.THREE.Vector3(2.9, TOP, 0.42), t: 0 };
  const q = g.q.reduce((a, b) => a + b, 0) / g.q.length;
  g.bill = sim.bill(save, g.recipe, q, g.wait);
  if (g.sorted != null) { g.bill.tip = Math.round(g.bill.tip * g.sorted); g.bill.total = g.bill.price + g.bill.tip; }
  else if (g.mood) g.bill = sim.moodBill(g.bill, g.mood);
  if (staff.length && g.bill.tip) { g.bill.tip = Math.round(g.bill.tip * sim.staffTip(staff.length)); g.bill.total = g.bill.price + g.bill.tip; }
  if (g.q.some(x => x === 0)) g.bill.thrown = true; // burnt food comes back, whoever ordered it
  if (throwNext) { throwNext = false; g.bill.thrown = true; }
  if (g.golden) {
    g.goldenWon = g.extras === 0 && g.paid === 0 && g.q.every(x => x >= 0.75);
    if (g.goldenWon) { g.bill.price *= 3; g.bill.tip *= 3; g.bill.total = g.bill.price + g.bill.tip; }
  }
  wait(0.6, () => (g.bill.thrown ? thrown() : payUp()));
}
// The guest is happy (or at least paying): stars, the total keyed in, then the register.
function payUp() {
  phase = 'serve';
  {
    g.model?.play('emote-yes', true); g.model?.bubble.show(null, g.bill.thrown ? 'rude' : 'happy'); if (!g.bill.thrown) SFX.happy();
    floater(worldPx(3.25, 1.9, 0.95), '★'.repeat(g.bill.stars), 'gold');
    if (g.golden) { banner(t(g.goldenWon ? 'goldenWon' : 'goldenLost')); if (g.goldenWon) { flash(); SFX.star(); } }
    // The total is keyed in digit by digit, a click a key.
    const digits = String(g.bill.total);
    for (let i = 1; i <= digits.length; i++) later(i * 85, () => { if (!g) return; art.register.press(i * 5 + (+digits[i - 1])); art.register.display(digits.slice(0, i)); SFX.key(); });
    wait(0.8, ringUp);
  }
}
let slide = null;
function ringUp() {
  phase = 'ring'; banner(t('ring'), t('ringSub'));
  if (g.bill.dashed) coach(t('dashed'), 3);
  if (g.tut === 0) coach(t('t4'));
  if (g.tut === 0 || save.day <= 2) { fingerTap(art.register.group.position.clone().add(new art.THREE.Vector3(0, 0.45, 0))); }
  art.view('serve');
}
function openRegister() {
  if (phase !== 'ring') return;
  phase = 'open';
  art.register.open(); SFX.open(); buzz(20); fingerOff();
  const b = g.bill; let given = 0;
  art.register.display(String(b.total));
  // The guest pays in bills and coins; they flutter into their slots in the drawer.
  art.register.pay(b.total, new art.THREE.Vector3(3.05, TOP + 0.45, 0.85), kind => (kind === 'coin' ? SFX.coin() : SFX.bill()));
  const from = art.toScreen(art.register.drawerWorld()), to = $('coins').getBoundingClientRect();
  const n = Math.min(14, 3 + Math.round(b.total / 4));
  for (let i = 0; i < n; i++) {
    const share = Math.round(b.total * (i + 1) / n) - Math.round(b.total * i / n);
    later(380 + i * 60, () => flyCoin(from, { x: to.left + 16, y: to.top + 14 }, () => { given += share; save.coins += share; hud(); SFX.coin(); $('coins').firstElementChild.classList.remove('bump'); void $('coins').offsetWidth; $('coins').firstElementChild.classList.add('bump'); }));
  }
  floater(from, `+${b.total}`, 'gold');
  // The coins are the guest's: count them as served now, whatever happens next.
  save.served++; day.served++; day.earned += b.price; day.tips += b.tip; day.stars.push(b.stars);
  tally({ type: 'serve', recipe: g.recipe, stars: b.stars, tip: b.tip, coins: b.total, quick: g.wait <= TUNE.patience });
  setTimeout(() => { if (given < b.total) { save.coins += b.total - given; given = b.total; hud(); } store(); }, 380 + n * 60 + 900);
  rec.event('serve', { recipe: g.recipe, stars: b.stars, coins: b.total });
  wait(0.95, () => { phase = 'close'; closeRegister(); });
}
function closeRegister() {
  if (phase !== 'close') return;
  phase = 'leave'; art.register.close(); SFX.clunk(); buzz(30); art.shake(0.5); fingerOff(); coach(null);
  art.register.display('0');
  const m = g.model, d = dish; dish = null;
  wait(0.5, () => {
    if (d) art.world.remove(d);
    $('ticket').style.display = 'none';
    if (m && g.joinAfter && addStaff('owed', m)) { m.bubble.hide(); }
    else if (m) { m.bubble.hide(); if (g.bill.dashed) { m.speed = 4.2; m.play('sprint'); } art.walkTo(m, 6.5, 1.6, () => { m.gone = true; }); if (g.bill.dashed) m.play('sprint'); }
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
  lastMode = 'day';
  showFocus(false);
  phase = 'idle'; g = null; $('line').style.display = 'none';
  const first = !save.tutorial;
  const fin = save.tutorial ? tally({ type: 'dayEnd', extras: day.extras }) ?? [] : [];
  save.tutorial = true; save.day++; save.dayAtTier++;
  save.best = Math.max(save.best, day.earned + day.tips);
  // Wages for hired staff (as much as there is); owed shifts are done.
  let wages = 0;
  for (const m of staff) if (m.kind === 'hired') { const w = Math.min(save.coins, sim.wage(save.tier)); save.coins -= w; wages += w; }
  // A beaten guest works the rest of today and all of tomorrow, then goes home.
  const freed = staff.filter(m => m.kind === 'owed' && !m.fresh); for (const m of freed) staff.splice(staff.indexOf(m), 1);
  for (const m of staff) delete m.fresh;
  storeStaff(); hud();
  store();
  const stars = day.stars.length ? Math.round(day.stars.reduce((a, b) => a + b, 0) / day.stars.length) : 0;
  rec.end('day', { day: save.day - 1, tier: save.tier, served: day.served, coins: day.earned + day.tips, stars });
  $('dayTitle').textContent = t('dayDone', { n: save.day - 1 });
  $('dayStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('ledger').innerHTML = `<tr><td>${t('served')}</td><td>${day.served}</td></tr><tr><td>${t('earned')}</td><td>${day.earned}</td></tr><tr><td>${t('tips')}</td><td>${day.tips}</td></tr>${day.lost ? `<tr><td>${t('walkouts')}</td><td>${day.lost}</td></tr>` : ''}${day.robbed ? `<tr><td>${t('robbed')}</td><td>${day.robbed}</td></tr>` : ''}${wages ? `<tr><td>${t('wages')}</td><td>−${wages}</td></tr>` : ''}<tr class="total"><td><i class="coin"></i></td><td>${save.coins}</td></tr>`;
  $('dayLine').textContent = first ? t('t7') : '';
  $('dayMissions').innerHTML = fin.map(o => `<li class="won">✓ ${esc(o.text)} <b>+${o.reward}</b></li>`).join('') + (save.story?.open ?? []).slice(0, 3).map(o => `<li>${esc(o.text)} <b>${story.progress(o)}</b></li>`).join('');
  coach(null); fingerOff(); gauge(null);
  SFX.star(); art.view('room');
  show('dayEnd');
}
$('nextDay').addEventListener('click', () => { snd.unlock(); SFX.tap(); if (lastMode === 'rush') { rushNight = sh.nightsFor(save).includes(lastNight) ? lastNight : null; beginRush(); } else beginDay(); });
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
  if (!next) $('starBox').innerHTML = `<div class="title">${starText(save.tier)}</div><div>${t('starDone')}</div>`;
  else {
    const c = sim.canStar(save);
    const needs = Object.entries(next.needs).map(([k, v]) => `<span class="${save.built[k] >= v ? 'ok' : ''}">${t('b_' + k)} ${t('lv', { n: v })}${save.built[k] >= v ? ' ✓' : ''}</span>`).join('');
    // One clear next step: the cheapest building the next rank still needs, else the coins to save, else the rank itself.
    const missing = Object.entries(next.needs).filter(([k, v]) => save.built[k] < v).map(([k]) => ({ k, cost: sim.canBuild(save, k).cost ?? 1e9 })).sort((a, b) => a.cost - b.cost);
    const step = c.ok ? t('rankReady') : missing.length ? t('nextUp', { what: `${t('b_' + missing[0].k)} ${t('lv', { n: save.built[missing[0].k] + 1 })}` }) : t('saveFor', { n: next.cost - save.coins });
    $('starBox').innerHTML = `<div class="title">${starText(save.tier + 1)} ${t('starUp', { rank: rankName(save.tier + 1) })}</div><div class="need">${needs}</div><div class="nextStep">➜ ${step}</div>${sim.twistFor(save.tier + 1) && sim.twistFor(save.tier + 1) !== sim.twistFor(save.tier) ? `<div class="twist">🌬 ${t('twistNew')}: ${t('tw_' + sim.twistFor(save.tier + 1).id)}</div>` : ''}<button id="starGo" class="main${c.ok ? ' ready' : ''}" ${c.ok ? '' : 'disabled'}><i class="coin"></i> ${next.cost}</button>`;
    $('starGo').addEventListener('click', starUp);
  }
  const goal = id => TIERS[save.tier + 1] && save.built[id] < (TIERS[save.tier + 1].needs[id] ?? 0);
  const order = BUILDING_IDS.slice().sort((a, b) => goal(b) - goal(a));
  $('builds').innerHTML = order.map(id => {
    const lv = save.built[id], c = sim.canBuild(save, id);
    const label = c.why === 'max' || (c.why === 'star' && BUILDINGS[id].max.at(-1) <= lv) ? t('maxed') : c.why === 'star' ? t('needStar', { stars: t('rank_' + TIERS[BUILDINGS[id].max.findIndex(m => m > lv)].name) }) : `<i class="coin"></i>${c.cost}`;
    const pic = art ? `<img alt="" src="${art.thumb(THUMB[id], 64)}">` : '';
    return `<div class="bld${fresh === id ? ' new' : ''}${goal(id) ? ' goal' : ''}">${pic}<div class="name">${t('b_' + id)}${goal(id) ? ` <small class="for">${t('forRank', { rank: rankName(save.tier + 1) })}</small>` : ''}</div><div class="lv">${lv ? t('lv', { n: lv }) : t('notBuilt')}</div><div class="what">${t('w_' + id)}</div><button data-b="${id}" ${c.ok ? '' : 'disabled'}>${lv ? '' : t('build') + ' '}${label}</button></div>`;
  }).join('');
  for (const b of $('builds').querySelectorAll('button[data-b]')) b.addEventListener('click', () => buildIt(b.dataset.b));
  // Tools: pick what the glove holds. Buy once, switch any time.
  $('builds').insertAdjacentHTML('beforeend', `<div class="toolsBox"><div class="name">${t('toolsTitle')}</div><div class="tools">${TOOLS.map(x => {
    const own = tools.own.includes(x.id), on = tools.use === x.id, locked = save.tier < x.tier;
    const label = on ? t('toolOn') : own ? t('toolUse') : locked ? t('needStar', { stars: rankName(x.tier) }) : `<i class="coin"></i>${x.cost}`;
    return `<button class="tool${on ? ' on' : ''}" data-tool="${x.id}" ${on || (!own && (locked || save.coins < x.cost)) ? 'disabled' : ''}><span class="ic">${x.icon}</span><span>${t('tool_' + x.id)}</span><small>${label}</small></button>`;
  }).join('')}</div></div>`);
  for (const b of $('builds').querySelectorAll('button[data-tool]')) b.addEventListener('click', () => toolIt(b.dataset.tool));
}
function toolIt(id) {
  const x = TOOLS.find(k => k.id === id); if (!x) return;
  if (!tools.own.includes(id)) { if (save.tier < x.tier || save.coins < x.cost) return; save.coins -= x.cost; tools.own.push(id); store(); SFX.build(); rec.event('tool', { id, cost: x.cost }); }
  else SFX.tap();
  if (tools.use !== id) settingChanged('tool', tools.use, id);
  tools.use = id; storeTools(); art.knife.setSkin(id); hud();
  const sc = $('builds').scrollTop; shop(); $('builds').scrollTop = sc;
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
  const tw = sim.twistFor(save.tier);
  if (tw) floater({ x: innerWidth / 2, y: innerHeight * 0.38 }, `${t('twistNew')}: ${t('tw_' + tw.id)}`, 'gold');
}



// ---------- the line: guests wait by the tables; tap who comes to the counter next.
function lineDue() { return day?.line && day.next >= day.plan.length && !day.line.length; }
function pickPhase() {
  if (lineDue()) return endDay();
  phase = 'pick'; day.pickT = 0; day.looking = false; focusI = 0; art.view('room'); showFocus(true); $('ticket').style.display = 'none';
  if (!day.pickTold) { day.pickTold = true; coach(t('pickWho'), 3); }
  renderLine();
}
async function arrive() {
  const idx = day.next++, p = day.plan[idx], me = day;
  const used = new Set(day.line.map(e => e.spot));
  const spot = [0, 1, 2, 3].find(i => !used.has(i)) ?? 0;
  const e = { idx, p, spot, left: sim.patienceFor(save.tier, p.mood), full: sim.patienceFor(save.tier, p.mood), model: null };
  day.line.push(e); renderLine();
  rec.event('arrive', { recipe: p.recipe, mood: p.mood ?? null });
  const m = await art.guest(p.look);
  if (me !== day || !day.line.includes(e)) { if (m) m.gone = true; return; }
  e.model = m; if (!m) return; m.speed = 2.6;
  const [x, z] = art.waitSpots[spot];
  art.walkTo(m, x, z, () => { if (!day.line.includes(e)) return; m.face = Math.PI; m.play('idle'); m.bubble.show(art.thumb(dishModel(p.recipe)), p.mood ?? 'want'); });
}
function callGuest(e) {
  if (phase !== 'pick' || !day.line.includes(e)) return;
  day.line.splice(day.line.indexOf(e), 1); e.called = true; showFocus(false); renderLine(); SFX.tap(); coach(null);
  rec.event('call', { recipe: e.p.recipe, left: Math.round(e.left), waiting: day.line.length });
  art.view('serve');
  startGuest(e.p, e.model);
}
function walkOut(e) {
  day.line.splice(day.line.indexOf(e), 1); day.lost++;
  const m = e.model;
  if (m) { m.bubble.show(null, 'angry'); m.speed = 2.6; art.walkTo(m, 6.5, 1.6, () => { m.gone = true; }); }
  else e.called = true; // the model may still be loading: drop it when it lands
  SFX.wrong(); floater({ x: innerWidth / 2, y: innerHeight * 0.22 }, t('walkout', { what: t('r_' + e.p.recipe) }), 'bad');
  rec.event('walkout', { recipe: e.p.recipe, mood: e.p.mood ?? null });
  renderLine();
}
function stepLine(dt) {
  if (!day?.line || storyOpen() || $('fight').style.display === 'flex') return;
  if (day.next < day.plan.length && day.line.length < sim.lineSeats(save)) {
    if (phase === 'pick' && !day.line.length) day.arriveT = Math.min(day.arriveT, 0.6);
    if ((day.arriveT -= dt) <= 0) { day.arriveT = day.next < sim.LINE_OPEN - 1 ? 1.2 : sim.arriveEvery(save.tier); arrive(); }
  }
  for (const e of sim.stepLine(day.line, dt)) walkOut(e);
  if (phase === 'pick') {
    if (lineDue()) return endDay();
    if (day.line.length && !day.looking && (day.pickT += dt) > sim.AUTO_CALL) callGuest(sim.nextInLine(day.line));
  }
  lineBars();
}
// Look around while guests wait: swipe or the arrows walk the camera through the restaurant. Tap a guest to call them.
const FOCUS = ['room', 'tables', 'serve', 'door', 'kitchen'];
let focusI = 0;
function focusTo(i) {
  focusI = (i + FOCUS.length) % FOCUS.length; day.looking = true; // a player looking around picks for themselves: no auto-call
  art.view(FOCUS[focusI]); flashFocusName(); SFX.tap();
  rec.event('focus', { view: FOCUS[focusI] });
}
let focusNameT = 0;
function flashFocusName() { const el = $('focusName'); el.textContent = t('focus_' + FOCUS[focusI]); el.classList.add('on'); clearTimeout(focusNameT); focusNameT = setTimeout(() => el.classList.remove('on'), 1100); }
function showFocus(on) { $('focus').style.display = on ? 'block' : 'none'; if (!on) $('focusName').classList.remove('on'); }
const MOOD_ICON = { rude: '😤', picky: '🧐', sneaky: '👀' };
function renderLine() {
  const el = $('line');
  if (!day?.line || screen !== 'play') { el.style.display = 'none'; showFocus(false); return; }
  el.style.display = 'flex'; el.classList.toggle('mini', phase !== 'pick');
  el.innerHTML = day.line.map((e, i) => `<button data-i="${i}" class="${e.p.mood ? 'mood' : ''}"><img alt="" src="${art.thumb(dishModel(e.p.recipe))}"><span class="nm">${esc(t('r_' + e.p.recipe))}</span><span class="pr"><i class="coin"></i>${sim.bill(save, e.p.recipe, 1, 0).price}${e.p.mood ? ' ' + MOOD_ICON[e.p.mood] : ''}</span><span class="pat"><i></i></span></button>`).join('');
  [...el.children].forEach((b, i) => b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); callGuest(day.line[i]); }));
  lineBars();
}
function lineBars() {
  const el = $('line'); if (!day?.line) return;
  el.classList.toggle('mini', phase !== 'pick');
  day.line.forEach((e, i) => { const bar = el.children[i]?.querySelector('.pat i'); if (!bar) return; const k = Math.max(0, e.left / e.full); bar.style.transform = `scaleX(${k})`; bar.style.background = k < 0.25 ? '#ff5a4a' : k < 0.5 ? '#ffb347' : '#6fd36f'; });
}

// ---------- the Manners Wheel: "Feed everyone. Throw food? Spin first. THEN feed."
const WHEEL_ICON = { kick_out: '🥾', slap: '🐟', fridge: '🧊', pan: '🍳', microwave: '⏲️', cook_self: '👨‍🍳', lock_out: '🔒', trash: '🗑️', rob: '💰', hire: '🤝', fight: '🥊' };
const NAMES = ['Gus', 'Pip', 'Mo', 'Dot', 'Bo', 'Fig', 'Lou', 'Tib', 'Nell', 'Ozzy', 'Rue', 'Wim'];
let wheelCtx = null, fight = null, throwNext = false;
const wheelOn = () => save.tutorial && save.tier >= sim.MOOD_FROM && !!g?.model;
function wheelBtn(on) { $('wheelBtn').style.display = on ? 'flex' : 'none'; $('wheelBtn').classList.toggle('hot', on && !!g?.mood); }
function openWheel(ctx) {
  if (!g?.model) return;
  wheelCtx = ctx; phase = 'wheel'; wheelBtn(false); coach(null); fingerOff(); SFX.spin();
  const ids = sim.WHEEL_IDS.filter(id => !(ctx === 'payback' && (id === 'rob' || id === 'hire')));
  $('wheelItems').innerHTML = ids.map((id, i) => {
    const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2, r = 40, off = id === 'hire' && staff.length >= sim.STAFF_MAX;
    return `<button data-w="${id}" style="left:${50 + Math.cos(a) * r}%;top:${50 + Math.sin(a) * r}%" ${off ? 'disabled' : ''}><span>${WHEEL_ICON[id]}</span><small>${t('w_' + id)}</small></button>`;
  }).join('');
  $('wheelMid').textContent = ctx === 'payback' ? t('letGo') : '✖';
  $('wheel').style.display = 'block'; $('wheelRing').style.animation = 'none'; void $('wheelRing').offsetWidth; $('wheelRing').style.animation = '';
  for (const b of $('wheelItems').querySelectorAll('button')) b.addEventListener('click', e => { e.stopPropagation(); pickWheel(b.dataset.w); });
}
function closeWheel() { $('wheel').style.display = 'none'; }
$('wheelMid').addEventListener('click', e => { e.stopPropagation(); SFX.tap(); closeWheel(); if (!g) return; if (wheelCtx === 'payback') { phase = 'serve'; payUp(); } else { phase = 'order'; wait(0.4, () => { if (phase === 'order') goCatch(); }); } });
for (const [id, d] of [['focusL', -1], ['focusR', 1]]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (phase === 'pick') focusTo(focusI + d); });
$('wheelBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (phase === 'order' && wheelOn()) openWheel('order'); });
function pickWheel(id) {
  const ctx = wheelCtx, me = g, w = sim.WHEEL[id];
  closeWheel(); if (!g?.model || !w) return;
  if (id === 'hire' && staff.length >= sim.STAFF_MAX) return;
  phase = 'stunt'; g.model.bubble.hide(); g.wheeled = id;
  const fin = tally({ type: 'wheel', action: id }); rec.event('wheel', { action: id, mood: g.mood, when: ctx });
  for (const o of fin ?? []) floater({ x: innerWidth / 2, y: innerHeight * 0.3 }, `✓ ${o.text} +${o.reward}`, 'gold');
  ({ kick_out: SFX.boing, slap: SFX.slap, fridge: SFX.whoosh, pan: SFX.sizzle, microwave: SFX.hum, cook_self: SFX.sizzle, lock_out: SFX.clunk, trash: SFX.crash, rob: SFX.jingle, hire: SFX.happy, fight: SFX.punch }[id] ?? SFX.tap)();
  if (w.stunt === 'fight') return fightStart(won => afterFight(won, me, ctx));
  art.view(['fridge', 'microwave', 'cook_self'].includes(id) ? 'left' : ['fly', 'into', 'out', 'join', 'shake'].includes(w.stunt) ? 'stunt' : 'serve');
  if (id === 'microwave') later(1100, () => SFX.ding()); if (id === 'trash') later(800, () => SFX.crash());
  art.stunt(g.model, w.stunt, { at: w.at, staffSlot: staff.length }, () => afterStunt(id, me, ctx));
}
function afterStunt(id, me, ctx) {
  if (me !== g) return;
  coach(t('p_' + id), 4);
  if (id === 'rob') { const n = sim.robTake(save, g.recipe); save.coins += n; day.robbed += n; hud(); store(); floater(worldPx(3.25, 1.9, 0.95), `+${n}`, 'gold'); return leaveNow(); }
  if (id === 'hire') { addStaff('hired', g.model, false); $('ticket').style.display = 'none'; return wait(1.0, nextGuest); }
  resumeAfter(ctx);
}
function afterFight(won, me, ctx) {
  if (me !== g) return;
  if (won) {
    coach(t('p_fight'), 4);
    if (ctx === 'payback') { g.joinAfter = true; phase = 'serve'; return payUp(); }
    if (addStaff('owed', g.model)) { $('ticket').style.display = 'none'; return wait(1.0, nextGuest); }
    return resumeAfter(ctx);
  }
  coach(t('fightLostLine'), 3); g.model?.play('emote-yes', true);
  if (ctx === 'payback') { phase = 'serve'; return payUp(); }
  g.sorted = 0; g.mood = null; phase = 'order'; art.view('serve'); wait(1.2, () => { if (phase === 'order') goCatch(); });
}
function resumeAfter(ctx) {
  art.view('serve');
  if (ctx === 'payback') { phase = 'serve'; return payUp(); }
  g.sorted = sim.wheelTip(g.mood); g.mood = null; phase = 'order';
  if (g.model) { g.model.face = -Math.PI * 0.6; g.model.bubble.show(null, g.sorted ? 'sorry' : 'angry'); }
  later(1000, () => { if (g?.model && phase === 'order') g.model.bubble.show(art.thumb(dishModel(g.recipe))); });
  wait(1.5, () => { if (phase === 'order') goCatch(); });
}
const goCatch = () => { if (storyOpen()) pendingCatch = g; else startCatch(); };
function leaveNow() {
  const m = g.model; $('ticket').style.display = 'none';
  if (m) { m.bubble.hide(); m.speed = 4; art.walkTo(m, 6.5, 1.6, () => { m.gone = true; }); m.play('sprint'); }
  wait(0.9, nextGuest);
}
// Burnt food, or a rude guest's dish under three stars, comes back: in your face.
function thrown() {
  phase = 'thrown'; const m = g.model;
  m?.play('attack-melee-right', true); m?.bubble.show(null, 'rude');
  g.bill.tip = 0; g.bill.total = g.bill.price;
  later(320, () => { SFX.splat(); splat(); art.shake(0.9); buzz([40, 30, 60]); if (dish) { art.world.remove(dish); dish = null; } });
  banner(t('thrown'), wheelOn() ? t('thrownSub') : '');
  rec.event('thrown', { recipe: g.recipe, mood: g.mood });
  wait(1.1, () => { if (phase !== 'thrown') return; if (wheelOn()) openWheel('payback'); else payUp(); });
}
function splat() {
  const el = $('splat'); el.innerHTML = '';
  const col = ['#ff6b4a', '#ffb347', '#a3d65c', '#e8524a'][Math.floor(Math.random() * 4)];
  for (let i = 0; i < 7; i++) { const b = document.createElement('i'); const r = 60 + Math.random() * 140; b.style.cssText = `left:${15 + Math.random() * 70}%;top:${20 + Math.random() * 55}%;width:${r}px;height:${r * (0.7 + Math.random() * 0.5)}px;background:${col}`; el.append(b); }
  if (g) { const img = document.createElement('img'); img.src = art.thumb(dishModel(g.recipe), 160); el.append(img); }
  el.style.display = 'block'; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(splat.t); splat.t = setTimeout(() => { el.style.display = 'none'; }, 1900);
}
// A fist fight: tap faster than they can swing.
function fightStart(done) {
  fight = { t: 0, taps: 0, need: sim.fightTaps(save.tier), done, over: false };
  g?.model?.play('attack-melee-right'); art.view('serve');
  $('fightTitle').textContent = t('fight'); $('fightHint').textContent = t('fightHint', { n: fight.need });
  $('fight').style.display = 'flex'; fightBars();
}
function fightBars() { $('fightYou').style.width = `${Math.min(100, (fight.taps / fight.need) * 100)}%`; $('fightThem').style.width = `${Math.min(100, (fight.t / sim.FIGHT_SECS) * 100)}%`; }
function fightTap() {
  if (!fight || fight.over) return;
  fight.taps++; SFX.punch(); art.shake(0.25); buzz(8); fightBars();
  if (fight.taps >= fight.need) fightEnd(true);
}
function stepFight(dt) { if (!fight || fight.over) return; fight.t += dt; fightBars(); if (fight.t >= sim.FIGHT_SECS) fightEnd(false); }
function fightEnd(won) {
  const f = fight; f.over = true; fight = null;
  $('fight').style.display = 'none'; banner(t(won ? 'fightWon' : 'fightLost'));
  if (won) { SFX.star(); g?.model?.play('die', true); } else { SFX.wrong(); }
  rec.event('fight', { won, taps: f.taps, need: f.need });
  setTimeout(() => f.done(won), 900);
}
$('fightTap').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fightTap(); });
// Staff stand in the dining room: hired ones cost a wage at day end; a beaten guest works one free shift.
function addStaff(kind, model, walk = true) {
  if (staff.length >= sim.STAFF_MAX) { coach(t('staffFull'), 3); return false; }
  const m = { look: g?.look ?? 0, kind, name: NAMES[Math.floor(Math.random() * NAMES.length)], model, ...(kind === 'owed' ? { fresh: true } : {}) };
  staff.push(m); storeStaff();
  if (model) { model.bubble.hide(); if (walk) art.stunt(model, 'join', { staffSlot: staff.length - 1 }); }
  floater({ x: innerWidth / 2, y: innerHeight * 0.36 }, t(kind === 'hired' ? 'hiredLine' : 'owedLine', { name: m.name }), 'gold');
  rec.event('staff', { kind, n: staff.length });
  return true;
}
function staffIn() {
  staff.forEach((m, i) => art.guest(m.look).then(model => {
    if (!model || !staff.includes(m)) { if (model) model.gone = true; return; }
    m.model = model; const [x, z] = art.staffSpots[i % art.staffSpots.length]; model.g.position.set(x, 0, z); model.face = 0; model.play('idle');
  }));
}
function rebel(who) {
  phase = 'rebel'; g = null; art.view('serve');
  banner(t('rebel', { name: who.name }), t('rebelSub'));
  if (who.model) { art.walkTo(who.model, 3.25, 0.95, () => who.model?.play('attack-melee-right')); }
  rec.event('rebel', { name: who.name });
  wait(1.6, () => fightStart(won => {
    if (won) { coach(t('rebelWon', { name: who.name }), 3); if (who.model) { const [x, z] = art.staffSpots[staff.indexOf(who) % art.staffSpots.length]; art.walkTo(who.model, x, z, () => { who.model.face = 0; }); } }
    else { coach(t('rebelQuit', { name: who.name }), 3); staff.splice(staff.indexOf(who), 1); storeStaff(); if (who.model) { who.model.speed = 4; art.walkTo(who.model, 6.5, 1.6, () => { who.model.gone = true; }); } }
    wait(1.2, nextGuest);
  }));
}


// ---------- the Rush shift: one shift on a clock with one shared sky. The rules are in shift.js.
// Every seated guest's food falls at once, two things at a time and far apart. The ring round a falling thing is the
// colour of the guest it would go to. The tray holds only so much; one more pushes the oldest off.
const RUSH_KEY = 'kitchen-rush';                       // { plays, best: { tier: coins }, stars: { tier: n } }; its own key
// Read defensively: a damaged record must not break the menu or the end of a shift.
const readRush = () => {
  const raw = readJson(RUSH_KEY, null), ok = raw && typeof raw === 'object' && !Array.isArray(raw), out = { plays: 0, best: {}, stars: {}, nights: {}, night: 'rush', tried: {}, done: {}, turn: 0 };
  if (!ok) return out;
  if (Number.isFinite(raw.plays)) out.plays = Math.max(0, Math.floor(raw.plays));
  for (const [k, v] of Object.entries(raw.best && typeof raw.best === 'object' ? raw.best : {})) if (Number.isFinite(v)) out.best[k] = Math.max(0, Math.floor(v));
  for (const [k, v] of Object.entries(raw.stars && typeof raw.stars === 'object' ? raw.stars : {})) if (Number.isFinite(v)) out.stars[k] = Math.max(0, Math.min(3, Math.floor(v)));
  if (typeof raw.night === 'string' && sh.NIGHTS[raw.night]) out.night = raw.night;
  for (const id of sh.NIGHT_IDS) {
    if (raw.tried && typeof raw.tried === 'object' && raw.tried[id]) out.tried[id] = 1;
    const n = raw.nights && typeof raw.nights === 'object' ? raw.nights[id] : null; if (id === 'rush' || !n || typeof n !== 'object') continue;
    const book = out.nights[id] = { best: {}, stars: {} };
    for (const [k, v] of Object.entries(n.best && typeof n.best === 'object' ? n.best : {})) if (Number.isFinite(v)) book.best[k] = Math.max(0, Math.floor(v));
    for (const [k, v] of Object.entries(n.stars && typeof n.stars === 'object' ? n.stars : {})) if (Number.isFinite(v)) book.stars[k] = Math.max(0, Math.min(3, Math.floor(v)));
  }
  for (const id of Object.keys(sh.MISSIONS)) if (raw.done && typeof raw.done === 'object' && Number.isFinite(raw.done[id]) && raw.done[id] >= 1) out.done[id] = Math.min(999, Math.floor(raw.done[id]));   // missions done, by id
  if (Number.isFinite(raw.turn)) out.turn = Math.max(0, Math.floor(raw.turn) % 1e6);
  if (raw.seen && typeof raw.seen === 'object') out.seen = Object.fromEntries(['rich', 'rude', 'picky', 'sneaky'].filter(m => raw.seen[m]).map(m => [m, 1]));
  return out;
};
const rushSave = readRush();
// Another tab may have played since this page loaded: keep the higher best and stars of the two before writing.
function storeRush() {
  const there = readRush(), up = (mine, theirs) => { for (const f of ['best', 'stars']) for (const [k, v] of Object.entries(theirs?.[f] ?? {})) mine[f][k] = Math.max(mine[f][k] ?? 0, v); };
  up(rushSave, there); for (const id of Object.keys(there.nights)) up(nightBook(id), there.nights[id]);
  rushSave.plays = Math.max(rushSave.plays, there.plays); rushSave.turn = Math.max(rushSave.turn, there.turn); for (const [k, v] of Object.entries(there.done)) rushSave.done[k] = Math.max(rushSave.done[k] ?? 0, v); rushSave.tried = { ...there.tried, ...rushSave.tried }; if (there.seen || rushSave.seen) rushSave.seen = { ...there.seen, ...rushSave.seen };
  writeJson(RUSH_KEY, rushSave);
}
// Nights: Rush hour, and from the second rank a Lunch rush. Each keeps its own best and stars.
const NIGHT_ICON = { rush: '🔥', lunch: '🥪' };
const nightNow = () => (sh.nightsFor(save).includes(rushSave.night) ? rushSave.night : 'rush');
const nightBook = id => (id === 'rush' ? rushSave : (rushSave.nights[id] ??= { best: {}, stars: {} }));
// A mission inside a shift (shift.js MISSIONS): offered from the fourth Rush, so it never shares the screen with a first hint.
const MISSION_AFTER = 3;
const missionText = id => (id === 'trio' || id === 'seat' ? t('mis_' + id) : id === 'use_fight' ? t('mis_fight') : t('mis_use', { a: `${WHEEL_ICON[id.slice(4)]} ${t('w_' + id.slice(4))}` }));
const starRow = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function nightMenu() {
  const more = rushSave.plays ? sh.nightsFor(save).filter(id => id !== 'rush') : [], btn   /* another night shows after one Rush hour */ = id => `${NIGHT_ICON[id]} ${esc(t('night_' + id))} <small>${starRow(nightBook(id).stars?.[save.tier] ?? 0)}</small>`;
  $('rush').innerHTML = more.length ? btn('rush') : `${esc(t('rush'))} <small>${starRow(rushSave.stars?.[save.tier] ?? 0)}</small>`;
  $('nights').innerHTML = save.tutorial ? more.map(id => `<button class="${rushSave.tried?.[id] ? '' : 'fresh'}" data-night="${id}">${btn(id)}</button>`).join('') : '';
}
$('nights').addEventListener('click', async ev => {
  const b = ev.target.closest('[data-night]'); if (!b) return;
  const was = visits; snd.unlock(); await ready; await art.peopleReady; if (screen !== 'menu' || visits !== was || rush || !sh.nightsFor(save).includes(b.dataset.night)) return;
  rushSave.night = b.dataset.night; storeRush(); beginRush();
});
const SEAT_COLOR = ['#ff7a4d', '#3fb6ff', '#a97bff', '#4fcf7a', '#ffc933'];
let rush = null, lastMode = 'day', rushSeed = null, rushNight = null, lastNight = 'rush', rushMission;   // rushMission: a mission forced by the test hook (null forces none)
const rings = new Map();                               // falling item n -> ring mesh
let ringGeo = null;
function clearRush() {
  clearPeople();
  for (const n of [...rings.keys()]) dropRing(n);
  $('rushMission').style.display = 'none'; chipWas = ''; document.body.classList.remove('mis');
  $('rail').style.display = 'none'; $('rushHud').style.display = 'none'; $('rail').innerHTML = ''; $('acts').style.display = 'none'; actsFor = null; document.body.classList.remove('sky'); if (fight) { fight.over = true; fight = null; $('fight').style.display = 'none'; }
}
function beginRush() {
  art.register.reset?.();
  if (menuGuest) { menuGuest.gone = true; menuGuest = null; }
  for (const m of art.guests) m.gone = true;
  const seed = rushSeed ?? (query.has('seed') ? Number(query.get('seed')) >>> 0 : (Date.now() ^ 0x9e3779b1) >>> 0); rushSeed = null;
  clearCatch(); clearRush(); cook = null; g = null; waits = [];
  const night = rushNight ?? nightNow(); rushNight = null; lastNight = night;
  trayX = trayTarget = 0;
  storeRush();   // another tab may have played: take its plays and done missions before choosing
  const firstNight = night !== 'rush' && !rushSave.tried[night];
  const mission = rushMission !== undefined ? rushMission : (rushSave.plays >= MISSION_AFTER && !firstNight ? sh.missionFor(save, rushSave.done, rushSave.turn) : null); rushMission = undefined;
  rush = sh.newShift({ save, seed, night, mission });
  if (!rushSave.tried[night]) { rushSave.tried[night] = 1; storeRush(); }
  day = { rush, plan: [], i: 0, served: 0, earned: 0, tips: 0, stars: [], seed, t0: clock, extras: 0, robbed: 0, rebels: [], line: null, next: 0, arriveT: 0, lost: 0, pickT: 0 };
  lastMode = 'rush';
  song?.start(seed);
  rec.start({ mode: 'rush', night, mission: rush.mission, people: opts.get('people'), day: save.day, tier: save.tier, tutorial: false, look: lookId, tool: tools.use, sound: save.sound, music: musicOn });
  paused = false; snd.release(); show('play'); hud();
  toSky();
  banner(t(night === 'rush' ? 'rushGo' : 'night_' + night), t(night === 'rush' ? 'rushGoSub' : 'nightGo_' + night));
  rushCaught = false; rushChip(); if (firstNight) coach(t('nightSub_' + night), 8); else if (rush.mission) coach(t('misGo', { m: missionText(rush.mission) + (rush.mission === 'seat' ? '' : t('misHow')), n: sh.missionPay(save, night) }), 8); else if ((rushSave.plays ?? 0) < 2) coach(t(matchMedia('(pointer: coarse)').matches ? 'rushDrag' : 'rushDragKeys'));   // first the control, then the rules
}
function toSky() {
  phase = 'sky'; g = null; cook = null; document.body.classList.add('sky'); art.view('catch'); $('ticket').style.display = 'none'; gauge(null);
  redrawTray(); rail();
}
function redrawTray(newest = null) {
  art.tray.load.clear();
  for (const it of rush.sky.tray) {
    const m = art.item(itemModel(it.id), 0.27);
    landOnTray(m, it); if (it !== newest) m.userData.drop = 0;
  }
}
function seatOf(e) { if (e.seat == null) { const used = new Set(rush.line.map(x => x.seat)); e.seat = [0, 1, 2, 3, 4].find(i => !used.has(i)) ?? 0; } return e.seat; }
function rail() {
  const s = rush; if (!s) return;
  // One column per seat, so a ticket stays over its guest and nothing shifts when somebody leaves.
  const cols = Array.from({ length: Math.max(s.seats, ...s.line.map(e => seatOf(e) + 1)) }, (_, i) => s.line.find(e => seatOf(e) === i));
  $('rail').innerHTML = cols.map(e => {
    if (!e) return '<div class="chip gap"></div>';
    const icons = Object.entries(e.need).flatMap(([id, n]) => Array.from({ length: n }, (_, i) => `<img alt="" class="${i < (e.got[id] ?? 0) ? 'got' : ''}" src="${art.thumb(itemModel(id))}">`)).join('');
    return `<div class="chip${e.ready ? ' ready' : ''}${e.kind === 'rich' ? ' rich' : ''}" data-n="${e.n}" style="--c:${SEAT_COLOR[seatOf(e)]}"><div class="top"><img alt="" src="${art.thumb(dishModel(e.recipe))}"><b>${e.kind === 'rich' ? '💎' : ''}${e.mood ? MOOD_ICON[e.mood] : ''}${e.frozen > 0 ? '🧊' : ''}${e.self ? '👨‍🍳' : ''}<i class="coin"></i>${e.price}</b></div><div class="need">${icons}</div><div class="pat"><i></i></div></div>`;
  }).join('');
  railBars(); syncPeople();
  const rb = $('rail').getBoundingClientRect(); if (rb.height) $('rushMission').style.top = `${Math.round(rb.bottom + 7)}px`;   // the mission chip sits under the tickets, however tall they are
}
// ---------- people in a Rush: every guest in the line stands in front of the counter, on a spot in their ticket's
// colour. They only show what the shift (shift.js) already decided: nothing here changes a rule, a clock or a coin.
// One entry per guest: { e, seat, m (the model, once loaded), ring, state: 'in' | 'wait' | 'busy' | 'out', then }.
const SEAT_SPOT = [[-0.72, 1.5], [0, 1.66], [0.72, 1.5], [-0.36, 2.2], [0.36, 2.2]], DOOR = [5.2, 1.2], PASS = [3.25, 0.95];
const people = new Map();
const WIDE_TALL = 0.66, WIDE_ROOM = 1.2;   // a screen wider than tall: smaller guests, and the catching camera steps back and looks lower so their faces show
let peopleGen = 0, ringGeoP = null, haloGeo = null, TALL = 1.0;
const haloMat = [];
const peopleOn = () => opts.get('people') === 'on';
function clearPeople() { peopleGen++; art.setRoom(1); for (const p of people.values()) { if (p.m) p.m.gone = true; dropSpot(p); } people.clear(); }
function dropSpot(p) { if (p.ring) { art.world.remove(p.ring); p.ring.material.dispose(); p.ring = null; } }
// Called whenever the line changes: new guests walk in, guests no longer in the line go.
function syncPeople() {
  const s = rush; if (!s) return;
  if (!peopleOn()) { if (people.size) clearPeople(); return; }   // switched off, here or in another tab
  if (!people.size) { const wide = innerWidth > innerHeight; TALL = wide ? WIDE_TALL : 1.0; art.setRoom(wide ? WIDE_ROOM : 1); }
  for (const e of s.line) if (!people.has(e.n)) addPerson(e);
  for (const p of people.values()) if (p.state !== 'out' && !s.line.includes(p.e)) personOut(p, p.how ?? (s.at === p.e ? 'cook' : 'walk'));
}
async function addPerson(e) {
  const gen = peopleGen, seat = seatOf(e), [x, z] = SEAT_SPOT[seat], p = { e, seat, m: null, ring: null, state: 'in', then: null, how: null, low: false };
  people.set(e.n, p);
  ringGeoP ??= new art.THREE.RingGeometry(0.2, 0.3, 28);
  p.ring = new art.THREE.Mesh(ringGeoP, new art.THREE.MeshBasicMaterial({ color: SEAT_COLOR[seat], transparent: true, opacity: 0.9, side: art.THREE.DoubleSide }));
  p.ring.rotation.x = -Math.PI / 2; p.ring.position.set(x, 0.02, z); art.world.add(p.ring);
  const m = await art.guest(e.look, TALL);
  if (gen !== peopleGen || people.get(e.n) !== p) { if (m) m.gone = true; return; }   // the shift ended, or they left, while the model loaded
  if (!m) return dropSpot(p);   // no model: the ticket alone
  p.m = m; m.speed = 3.2; m.g.position.set(2.4, 0, 2.2);
  // The same ring that marks their food in the sky sits over their head.
  haloGeo ??= new art.THREE.TorusGeometry(0.17, 0.03, 8, 28);
  p.halo = new art.THREE.Mesh(haloGeo, haloMat[seat] ??= new art.THREE.MeshBasicMaterial({ color: SEAT_COLOR[seat] })); p.halo.rotation.x = Math.PI / 2; p.halo.scale.setScalar(TALL); p.halo.position.set(0, TALL * 1.1, 0); m.g.add(p.halo);
  if (p.state === 'out') return personOut(p, p.how, true);
  art.walkTo(m, x, z, () => { if (p.state !== 'in') return; p.state = 'wait'; m.face = 0; m.play('idle'); personNext(p); });
}
function personNext(p) { const f = p.then; p.then = null; f?.(); }
// A short show on the spot (a stunt from the ordinary day's wheel), with the shift still running underneath.
function personShow(p, kind, opt = {}) {
  if (!p?.m || p.state !== 'wait') return;
  p.state = 'busy';
  art.stunt(p.m, kind, opt, () => { if (p.state !== 'busy') return; p.state = 'wait'; p.m.face = 0; p.m.play('idle'); p.low = false; if (people.get(p.e.n) === p && !rush?.line.includes(p.e)) personOut(p, p.how ?? 'walk'); else personNext(p); });
}
function personCheer(p, clip = 'jump') { if (!p?.m || p.state !== 'wait') return; const m = p.m; m.play(clip, true); p.due = { at: clock + 0.7, fn: () => { if (p.state === 'wait' && !m.gone) { p.low = false; m.play('idle'); } } }; }   // due: on the game's clock, so a pause holds it
// how: 'walk' (gave up), 'cook' (their food is on the board: they wait at the pass), 'happy', 'boot', 'join'.
function personOut(p, how, now = false) {
  p.how = how; dropSpot(p);
  if (p.state === 'busy' && !now) return;   // the show ends first, then they go
  const m = p.m; p.state = 'out'; if (!m) { if (people.get(p.e.n) === p) people.delete(p.e.n); return; }
  const off = () => { m.gone = true; if (people.get(p.e.n) === p) people.delete(p.e.n); };
  if (how === 'cook') { m.speed = 3.2; return art.walkTo(m, PASS[0], PASS[1], () => { m.face = -Math.PI * 0.6; m.play('idle'); p.atPass = true; if (p.paid) personPaid(p); }); }
  if (how === 'boot') return art.stunt(m, 'boot', {}, off);
  if (how === 'join') { m.speed = 2.6; return art.walkTo(m, -2.6, 2.4, off); }
  m.speed = how === 'happy' ? 2.6 : 2.0; if (how === 'walk') m.bubble.show(null, 'angry');
  art.walkTo(m, DOOR[0], DOOR[1], off);
}
function personPaid(p) {
  const m = p.m; p.paid = true; if (!m || !p.atPass) return;
  m.bubble.show(null, 'happy'); m.play('emote-yes', true);
  p.due = { at: clock + 0.9, fn: () => { if (m.gone) return; m.bubble.hide(); m.speed = 2.6; art.walkTo(m, DOOR[0], DOOR[1], () => { m.gone = true; if (people.get(p.e.n) === p) people.delete(p.e.n); }); } };
}
// The show for each wheel action in a Rush.
const PERSON_SHOW = { slap: ['spin'], fridge: ['into', { at: 'fridge' }], pan: ['hop'], microwave: ['into', { at: 'micro' }], trash: ['into', { at: 'trash' }], fight: ['spin'] };
function personAct(e, id, out) {
  const p = people.get(e.n); if (!p) return;
  if (out.gone) { p.how = id === 'hire' ? 'join' : id === 'kick_out' ? 'boot' : 'walk'; if (id === 'rob' && p.state === 'wait') personShow(p, 'shake'); return; }
  const show = PERSON_SHOW[id]; if (!show) return personCheer(p, 'emote-no');
  if (p.state !== 'wait') p.then = () => personShow(p, ...show); else personShow(p, ...show);   // still walking in, or mid-show: next
}
// Once a frame: a guest whose patience is nearly gone fidgets.
let liftAt = 0, lift = 0;
function stepPeople() {
  // On a wide screen the floor is out of view: lift everyone until the face shows, but never over the tray.
  if (people.size && phase === 'sky' && art.cam.name === 'catch' && art.cam.pos.distanceTo(art.cam.wantPos) < 0.02 && clock - liftAt > 0.5) {
    liftAt = clock; const V = art.THREE.Vector3, trayPx = art.toScreen(new V(0, LANE.y0 - 0.14, LANE.z)).y; let best = 0;
    for (let l = 0; l <= 0.9; l += 0.03) { if (art.toScreen(new V(0, l + TALL * 1.16, SEAT_SPOT[0][1])).y < trayPx + 14) break; best = l; if (art.toScreen(new V(0, l + TALL * (innerWidth > innerHeight ? 0.25 : 0.5), SEAT_SPOT[0][1])).y <= innerHeight - 4) break; }
    lift = best;
  }
  for (const p of people.values()) {
    if (p.due && clock >= p.due.at) { const f = p.due.fn; p.due = null; f(); }
    if (p.m && (p.state === 'wait' || p.state === 'in')) p.m.g.position.y += (lift - p.m.g.position.y) * 0.2;
    if (p.state !== 'wait' || !p.m) continue;
    const low = p.e.left / p.e.full < 0.2 && !(p.e.frozen > 0);
    if (low !== p.low) { p.low = low; p.m.play(low ? 'emote-no' : 'idle'); }
  }
}
// ---------- the wheel in a Rush: tap a guest's ticket. The rules and the prices are in shift.js (act).
let actsFor = null, actsAt = 0, rushHinted = false, rushCaught = true;
// A tap on a ticket. The tickets are redrawn whenever anything is caught, so the node under the finger can be replaced
// between press and release and a click on it would be lost: remember the guest at the press and open at the release.
let chipDown = null;
$('rail').addEventListener('pointerdown', ev => { const c = ev.target.closest?.('.chip'); chipDown = c ? { n: Number(c.dataset.n), x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId } : null; ev.stopPropagation(); });
addEventListener('pointerup', ev => {
  const d = chipDown; if (!d || d.id !== ev.pointerId) return; chipDown = null;
  if (performance.now() - d.t > 700 || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 16) return;
  const e = rush?.line.find(x => x.n === d.n); if (e) openActs(e);
}, true);
addEventListener('pointercancel', () => { chipDown = null; }, true);
function openActs(e) {
  const s = rush; if (!s || phase !== 'sky' || s.at || paused || fight || actsFor) return;
  if (s.nerve <= 0) { floater({ x: innerWidth / 2, y: innerHeight * 0.3 }, t('actsNone'), 'bad'); SFX.wrong(); return; }
  if (e.ready) return;
  actsFor = e; actsAt = performance.now(); s.hold = true; SFX.spin(); coach(null);
  $('actsHead').innerHTML = `<img alt="" src="${art.thumb(dishModel(e.recipe))}"><b style="color:${SEAT_COLOR[seatOf(e)]}">●</b> ${esc(t('r_' + e.recipe))} <span>${esc(t('actsLeft', { n: s.nerve }))}</span>`;
  $('actsList').innerHTML = sh.ACTS.map(id => `<button data-a="${id}" ${sh.canAct(s, e, id) ? '' : 'disabled'}><span>${WHEEL_ICON[id]}</span><b>${esc(t('w_' + id))}</b><small>${esc(t((sh.canAct(s, e, id) ? 'ra_' : 'rn_') + id))}</small></button>`).join('');
  for (const b of $('actsList').children) b.addEventListener('click', ev => { ev.stopPropagation(); doAct(b.dataset.a); });
  $('acts').style.display = 'flex';
}
function closeActs() { $('acts').style.display = 'none'; actsFor = null; if (rush && !fight) rush.hold = false; }
$('actsClose').addEventListener('click', e => { e.stopPropagation(); SFX.tap(); closeActs(); });
function doAct(id) {
  const s = rush, e = actsFor; if (!s || !e || performance.now() - actsAt < 250) return;
  if (id === 'fight') { $('acts').style.display = 'none'; actsFor = null; if (!sh.canAct(s, e, id)) { s.hold = false; return; } return fightStart(won => { if (rush !== s) return; s.hold = false; art.view('catch'); applyAct(e, id, won); }); }
  closeActs(); applyAct(e, id, false);
}
function applyAct(e, id, won) {
  const s = rush, out = sh.act(s, e, id, won); if (!out) return;
  ({ kick_out: SFX.boing, slap: SFX.slap, fridge: SFX.whoosh, pan: SFX.sizzle, microwave: SFX.ding, cook_self: SFX.sizzle, lock_out: SFX.clunk, trash: SFX.crash, rob: SFX.jingle, hire: SFX.happy, fight: SFX.punch }[id] ?? SFX.tap)();
  const fin = tally({ type: 'wheel', action: id }); for (const o of fin ?? []) floater({ x: innerWidth / 2, y: innerHeight * 0.36 }, `✓ ${o.text} +${o.reward}`, 'gold');
  rec.event('wheel', { action: id, mood: e.mood, when: 'rush', left: Math.round(e.left), won: id === 'fight' ? won : undefined });
  const at = { x: innerWidth / 2, y: innerHeight * 0.3 };
  floater(at, `${WHEEL_ICON[id]} ${t('rd_' + id + (id === 'fight' && !won ? '_lost' : ''), { n: out.coins })}`, out.closed || (id === 'fight' && !won) ? 'bad' : 'gold');
  art.shake(id === 'pan' || id === 'slap' || id === 'fight' ? 0.9 : 0.4); buzz(25);
  if (out.coins) { SFX.coin(); }
  if (out.closed) { banner(t('rushClosed'), t('rushClosedSub')); }
  else if (id === 'rob' || (id === 'fight' && !won)) floater({ x: innerWidth / 2, y: innerHeight * 0.36 }, t('rushStrike', { n: Math.min(s.strikes, sh.RUSH.strikes), of: sh.RUSH.strikes }), 'bad');
  personAct(e, id, out);
  redrawTray(); rail();
}

function railBars() {
  const s = rush, el = $('rail');
  s.line.forEach(e => {
    const c = el.querySelector(`[data-n="${e.n}"]`); if (!c) return;
    const f = Math.max(0, e.left / e.full), bar = c.lastElementChild.firstElementChild;
    bar.style.transform = `scaleX(${f})`; bar.style.background = f < 0.2 ? '#ff5a5a' : f < 0.5 ? '#ffb347' : '#6fd36f';
    c.classList.toggle('hot', f < 0.2 && !(e.frozen > 0)); c.classList.toggle('iced', e.frozen > 0);
    if (f < 0.35 && s.nerve > 0 && !e.ready && !rushHinted && !actsFor && phase === 'sky' && !s.at && Object.keys(s.acts).length === 0 && rushSave.plays < 4) { rushHinted = true; const r = c.getBoundingClientRect(); floater({ x: r.left + r.width / 2, y: r.bottom + 26 }, t('actsHint'), 'gold'); }
  });
  const left = Math.max(0, s.secs - s.t), tg = sh.targets(save, s.night), next = tg.find(x => s.coins < x);
  $('rushClock').textContent = s.doors ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : t('rushLast');
  $('rushClock').classList.toggle('low', s.doors && left < 15);
  $('rushStrikes').textContent = '✗'.repeat(Math.min(3, s.strikes)) + '·'.repeat(Math.max(0, 3 - s.strikes));
  $('rushBuzz').textContent = s.buzz ? `🔥${s.buzz}` : '';
  $('rushNerve').textContent = `🎡${s.nerve}`; document.body.classList.toggle('nerve', s.nerve > 0);
  $('rushCoins').textContent = next ? `${s.coins}/${next}` : `${s.coins}`;
  $('rushStars').textContent = '★'.repeat(tg.filter(x => s.coins >= x).length);
  $('rushTray').textContent = `${s.sky.tray.length}/${s.holds}`;
  $('rushTray').classList.toggle('full', s.sky.tray.length >= s.holds);
  rushChip(); stepPeople();
}
// The mission chip under the tickets: what to do, a tick once it holds, struck out once it cannot be done.
let chipWas = '';
function rushChip() {
  const s = rush, el = $('rushMission'), id = s?.mission;
  document.body.classList.toggle('mis', !!id);   // the banner sits a line lower while the chip is up
  if (!id) { if (chipWas) { el.style.display = 'none'; chipWas = ''; } return; }
  const M = sh.MISSIONS[id], holds = sh.missionHolds(s), star = s.coins >= sh.targets(save, s.night)[0], state = holds ? (M.keep ? 'keep' : 'done') : sh.missionLost(s) && !fight ? 'lost' : 'todo', key = id + state + (holds && star);
  if (key === chipWas) return;
  if (chipWas && chipWas.startsWith(id) && state === 'done') { SFX.star(); const r = el.getBoundingClientRect(); floater({ x: r.left + r.width / 2, y: r.bottom + 18 }, '✓', 'gold'); }
  chipWas = key; el.className = state; el.style.display = 'block'; el.textContent = `${state === 'done' ? '✓' : state === 'lost' ? '✗' : '🎯'} ${missionText(id)}${!holds ? '' : star ? ` · +${sh.missionPay(save, s.night)}` : ' · ☆'}`;   // ☆: the star it still needs
}
function stepRush(dt) {
  const s = rush;
  if (storyOpen()) return;
  const ev = []; for (let left = dt; left > 1e-6; left -= 0.034) ev.push(...sh.stepShift(s, Math.min(0.034, left), trayX / LANE.s));
  let redraw = false, changed = false;
  for (const e of ev) {
    if (e.type === 'arrive') { changed = true; SFX.tap(); const mark = e.e.kind === 'rich' ? 'rich' : e.e.mood; if (mark && s.t > 6 && !rushSave.seen?.[mark]) { rushSave.seen = { ...rushSave.seen, [mark]: 1 }; storeRush(); floater({ x: innerWidth / 2, y: innerHeight * 0.4 }, t('rushMark_' + mark), 'gold'); } rec.event('arrive', { recipe: e.e.recipe, kind: e.e.kind, mood: e.e.mood }); }
    else if (e.type === 'turned') { floater({ x: innerWidth / 2, y: innerHeight * 0.2 }, t('rushTurned'), 'bad'); rec.event('turned', { recipe: e.e.recipe }); }
    else if (e.type === 'walkout') {
      changed = redraw = true; day.lost++; SFX.wrong(); buzz([60, 40, 60]); art.shake(0.8);
      floater({ x: innerWidth / 2, y: innerHeight * 0.24 }, `${t('walkout', { what: t('r_' + e.e.recipe) })} ${t('rushStrike', { n: Math.min(s.strikes, sh.RUSH.strikes), of: sh.RUSH.strikes })}`, 'bad');
      rec.event('walkout', { recipe: e.e.recipe, kind: e.e.kind, strikes: s.strikes });
    } else if (e.type === 'bell') { banner(t('rushBell'), t('rushBellSub')); SFX.star(); }
    else if (e.type === 'closed') { banner(t('rushClosed'), t('rushClosedSub')); SFX.burnt?.(); }
    else if (e.type === 'caught') {
      if (!rushCaught) { rushCaught = true; if (!rushSave.plays) coach(t('rushCoach'), 9); else coach(null); }
      changed = true; dropMesh(e.it.n); redrawTray(e.it);
      SFX.catch(s.sky.tray.length); buzz(12); art.tray.bump();
      art.burst(new art.THREE.Vector3(trayX, LANE.y0 + 0.05, LANE.z), { n: 8, color: SEAT_COLOR[seatOf(e.e)], speed: 1.2, up: 1.4, size: 0.03, life: 0.5 });
      if (musicOn) song?.ember();
      personCheer(people.get(e.e.n));
    } else if (e.type === 'pushed') { changed = redraw = true; SFX.whoosh(); floater(worldPx(trayX, LANE.y0 + 0.3), t('rushPushed'), 'bad'); const m = art.item(itemModel(e.it.id), 0.25); flyAway(m, trayX); }
    else if (e.type === 'clatter') {
      changed = redraw = true; day.extras++; const m = meshes.get(e.it.n); meshes.delete(e.it.n); dropRing(e.it.n); if (m) { art.world.remove(m); flyAway(m, trayX); }
      if (e.lost) flyAway(art.item(itemModel(e.lost.id), 0.25), trayX);
      SFX.wrong(); buzz([40, 60, 40]); art.shake(1); floater(worldPx(trayX, LANE.y0 + 0.35), t(e.lost ? 'rushWrongLost' : 'rushWrong'), 'bad'); song?.hit();
    } else if (e.type === 'ready') { changed = true; SFX.good(); personCheer(people.get(e.e.n), 'emote-yes'); }
    else if (e.type === 'selfserved') {
      changed = redraw = true; day.served++; save.served++; day.earned += e.bill.price; day.stars.push(e.bill.stars);
      floater({ x: innerWidth / 2, y: innerHeight * 0.26 }, `👨‍🍳 +${e.bill.total}`, 'gold'); SFX.coin();
      rec.event('serve', { recipe: e.e.recipe, stars: e.bill.stars, coins: e.bill.total, buzz: s.buzz, self: true });
      { const p = people.get(e.e.n); if (p) p.how = 'happy'; }
    }
    else if (e.type === 'missed') { dropMesh(e.it.n); }
  }
  if (redraw) redrawTray();
  if (changed) rail();
  // Falling things and their rings.
  const live = new Set();
  if (phase === 'sky' && !s.at) for (const it of s.sky.items) {
    if (it.state !== 'fall') continue;
    live.add(it.n);
    let m = meshes.get(it.n);
    if (!m) { m = art.item(itemModel(it.id), 0.27); m.userData.spin = (it.spin % 1) * 1.4 - 0.7; art.world.add(m); meshes.set(it.n, m); }
    m.position.set(it.x * LANE.s, LANE.y0 + it.y * LANE.h - 0.12, LANE.z);
    m.rotation.z += m.userData.spin * dt; m.rotation.y += dt * 0.5;
    const owner = sim.isJunk(it.id) ? null : sh.ownerOf(s, it.id);
    let r = rings.get(it.n);
    if (owner) {
      if (!r) { ringGeo ??= new art.THREE.TorusGeometry(0.2, 0.022, 8, 28); r = new art.THREE.Mesh(ringGeo, new art.THREE.MeshBasicMaterial({ color: SEAT_COLOR[seatOf(owner)], transparent: true, opacity: 0.95 })); art.world.add(r); rings.set(it.n, r); }
      r.visible = true; r.material.color.set(SEAT_COLOR[seatOf(owner)]); r.position.set(m.position.x, m.position.y + 0.12, LANE.z);
    } else if (r) r.visible = false;
  }
  for (const n of [...meshes.keys()]) if (!live.has(n)) dropMesh(n);
  railBars();
  if (phase === 'sky' && !s.at) { const e = s.line.filter(x => x.ready).sort((a, b) => a.left - b.left)[0]; if (e) rushCook(e); }
  if (actsFor && (s.over || actsFor.ready || !s.line.includes(actsFor))) closeActs();   // the guest left, or the shift ended, under the open sheet
  if (s.over && phase === 'sky' && !fight) rushEnd();
}
function dropRing(n) { const r = rings.get(n); if (r) { art.world.remove(r); r.material.dispose(); rings.delete(n); } }
function dropMesh(n) { const m = meshes.get(n); if (m) { art.world.remove(m); meshes.delete(n); } dropRing(n); }
// A guest's food is all on the tray: off to the board and the stove. The sky waits; the other guests do not.
function rushCook(e) {
  if (!sh.startCook(rush, e)) return;
  for (const n of [...meshes.keys()]) dropMesh(n);
  g = { rush: e, mood: e.mood, look: e.look, recipe: e.recipe, need: { ...e.need }, q: [], steps: RECIPES[e.recipe].steps.slice(), step: -1, wait: 0, extras: 0, restarts: 0, paid: 0, model: null, tut: -1, golden: false };
  phase = 'caught'; document.body.classList.remove('sky'); coach(null); rail(); redrawTray();
  banner(t('r_' + e.recipe)); ticket(); $('ticket').style.display = 'block';
  rec.event('catch', { recipe: e.recipe, left: Math.round(e.left), tip: e.tipShare });
  wait(0.3, nextStep);
}
function rushServe() {
  const e = g.rush, q = g.q.length ? g.q.reduce((a, b) => a + b, 0) / g.q.length : 1;
  const b = sh.finish(rush, q);
  phase = 'serve'; day.served++; save.served++; day.earned += b.price; day.tips += b.tip; day.stars.push(b.stars);
  const at = dish ? art.toScreen(dish.position.clone().add(new art.THREE.Vector3(0, 0.35, 0))) : { x: innerWidth / 2, y: innerHeight / 2 };
  floater(at, `+${b.total}`, 'gold'); floater({ x: at.x, y: at.y - 34 }, '★'.repeat(b.stars), 'gold');
  SFX.coin(); later(120, () => SFX.coin()); buzz(20);
  if (b.thrown) { later(200, () => { SFX.splat(); splat(); art.shake(0.9); }); }
  if (rush.buzz >= 2) floater({ x: innerWidth / 2, y: innerHeight * 0.3 }, `🔥 ×${sh.buzzPay(rush).toFixed(2)}`, 'gold');
  rec.event('serve', { recipe: e.recipe, stars: b.stars, coins: b.total, buzz: rush.buzz });
  const d = dish; dish = null; later(550, () => { if (d) art.world.remove(d); });
  { const p = people.get(e.n); if (p) personPaid(p); }
  toSky();   // the sky is falling again from this moment, so the player sees it at once
}
function rushEnd() {
  const s = rush, r = sh.result(s);
  phase = 'idle'; g = null;
  save.coins += r.share; store();
  rushSave.plays = (rushSave.plays ?? 0) + 1;
  const bonus = r.missionDone ? sh.missionPay(save, s.night) : 0;
  if (r.mission) { rushSave.turn++; if (r.missionDone) { rushSave.done[r.mission] = (rushSave.done[r.mission] ?? 0) + 1; save.coins += bonus; store(); } }
  const book = nightBook(s.night);
  book.best = { ...book.best, [save.tier]: Math.max(book.best?.[save.tier] ?? 0, r.coins) };
  const newStars = r.stars > (book.stars?.[save.tier] ?? 0);
  book.stars = { ...book.stars, [save.tier]: Math.max(book.stars?.[save.tier] ?? 0, r.stars) };
  storeRush();
  rec.end('rush', { mode: 'rush', night: s.night, mission: r.mission, missionDone: r.missionDone, missionHeld: r.mission ? sh.missionHolds(s) : false, acts: Object.keys(s.acts).join(' '), tier: save.tier, coins: r.coins, share: r.share, stars: r.stars, served: r.served, strikes: r.strikes, turned: r.turned, bestBuzz: r.bestBuzz, closedEarly: r.closedEarly, clatters: s.clatters, pushed: s.pushed, secs: Math.round(s.t) });
  clearRush(); clearCatch(); art.tray.load.clear();
  $('dayTitle').textContent = r.closedEarly ? t('rushOverClosed') : s.night === 'rush' ? t('rushOver') : `${NIGHT_ICON[s.night]} ${t('night_' + s.night)}`;
  $('dayStars').textContent = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  const next = r.targets.find(x => r.coins < x);
  $('ledger').innerHTML = `<tr><td>${t('served')}</td><td>${r.served}</td></tr><tr><td>${t('walkouts')}</td><td>${day.lost}</td></tr><tr><td>${t('rushTook')}</td><td>${r.coins}</td></tr><tr><td>${t('rushBest')}</td><td>${book.best[save.tier]}</td></tr><tr><td>${t('rushShare')}</td><td>+${r.share}</td></tr><tr class="total"><td><i class="coin"></i></td><td>${save.coins}</td></tr>`;
  $('dayLine').textContent = next ? t('rushNext', { n: next - r.coins, s: r.stars + 1 }) : t('rushAll');
  const all = sh.missionsFor(save), got = all.filter(id => rushSave.done[id]).length;
  $('dayMissions').innerHTML = r.mission ? `<li class="rm ${r.missionDone ? 'won' : ''}">${r.missionDone ? '✓' : '✗'} ${esc(missionText(r.mission))}${r.missionDone ? ` <b>+${bonus}</b>` : sh.missionHolds(s) ? ` · ${esc(t('misNoStar'))}` : ''}</li><li class="rm count">🎯 ${esc(t('misCount', { n: got, m: all.length }))}</li>` : '';
  $('nextDay').textContent = t('rushAgain');
  coach(null); fingerOff(); gauge(null);
  SFX.star(); if (newStars && r.stars) flash(); art.view('room');
  rush = null; hud(); rushChip();
  show('dayEnd');
}

// ---------- the story: cards before the first catch, toasts, missions
let storyBook = null, storyQueue = [], storyToasts = [], pendingCatch = null;
storyData.then(d => { storyBook = d; });
const storyOpen = () => $('story').style.display === 'block';
function nextStory() {
  const b = storyQueue.shift();
  if (!b) { $('story').style.display = 'none'; if (pendingCatch && pendingCatch === g && phase === 'order') { pendingCatch = null; startCatch(); } else pendingCatch = null; toastNext(); return; }
  const m = story.see(save, b); store();
  $('storyWho').textContent = b.speaker ?? '';
  $('story').className = 'k-' + b.kind;
  $('storyLines').innerHTML = b.lines.map(l => `<p>${esc(l)}</p>`).join('');
  $('storyMission').innerHTML = m ? `<b>${t('mission')}</b> ${esc(m.text)}${m.reward ? ` <span class="rw"><i class="coin"></i>${m.reward}</span>` : ''}` : '';
  const btns = $('storyBtns');
  if (b.choice) {
    btns.innerHTML = b.choice.map(c => `<button data-c="${c.id}">${esc(c.text)}</button>`).join('');
    for (const el of btns.querySelectorAll('button')) el.onclick = e => { e.stopPropagation(); SFX.tap(); const c = b.choice.find(x => x.id === el.dataset.c); save.story.choice[b.id] = c.id; store(); rec.event('choice', { beat: b.id, choice: c.id }); storyQueue.unshift({ ...b, id: b.id + ':' + c.id, choice: null, mission: null, lines: c.lines }); nextStory(); };
  } else { btns.innerHTML = `<button class="main">${t('okBtn')}</button>`; btns.firstChild.onclick = e => { e.stopPropagation(); SFX.tap(); nextStory(); }; }
  $('story').style.display = 'block';
  SFX.happy();
}
function toastNext() { const b = storyToasts.shift(); if (!b) return; coach(`${b.speaker ? b.speaker + ': ' : ''}${b.lines.join(' ')}`, 5); later(5500, toastNext); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function tally(ev) {
  if (!storyBook || !save.tutorial) return [];
  const done = story.count(save, ev);
  for (const o of done) {
    if (ev.type !== 'dayEnd') later(400, () => { banner(t(o.special ? 'specialDone' : 'missionDone'), `${o.text}  +${o.reward}`); SFX.star(); hud(); });
    rec.event('mission', { id: o.id, reward: o.reward });
  }
  if (done.length) store();
  missionChip();
  return done;
}
function missionChip() {
  const s = save.story, o = s?.open?.[0], sp = s?.special?.day === save.day && !s.special.paid ? s.special : null;
  const el = $('mission');
  if (!save.tutorial || (!o && !sp)) { el.style.display = 'none'; return; }
  const dish = d => t('r_' + d);
  el.innerHTML = [o && `<div>📜 ${esc(o.text)} <b>${story.progress(o)}</b></div>`, sp && `<div>⭐ ${esc(story.specialText(sp, dish))} <b>${Math.min(sp.got, sp.n)}/${sp.n}</b></div>`].filter(Boolean).join('');
  el.style.display = screen === 'play' ? 'block' : 'none';
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
// The tutorial's pointing finger (the owner likes it in the other games): a tap on a piece, or on the register.
let fingerAnim = null;
function fingerOff() { $('finger').style.display = 'none'; fingerAnim = null; }
function fingerTap(world) { fingerAnim = { kind: 'tap', t: 0, world }; $('finger').style.display = 'block'; }
function stepFinger(dt) {
  if (!fingerAnim || calm && fingerAnim.t > 0) return;
  fingerAnim.t += dt;
  const el = $('finger');
  const p = art.toScreen(fingerAnim.world), press = (fingerAnim.t % 0.9) < 0.25;
  el.style.transform = `translate(${p.x - 10}px, ${p.y - 4}px)`; el.classList.toggle('press', press);
}

// ---------- input
// The tray follows the finger's x at the tray's depth; arrows and A/D move it too. A tap stops the microwave, a hold fries.
// How far the tray may go and stay at least half on screen on a narrow phone.
function trayEdge() {
  if (phase !== 'catch' && phase !== 'sky') return 1;
  const p = art.toScreen(art.tray.group.getWorldPosition(new art.THREE.Vector3()));
  const right = art.toPlane(innerWidth, p.y, LANE.z).x / LANE.s;
  return Number.isFinite(right) ? Math.max(0.6, Math.min(1, right - 0.1)) : 1;
}
function pointerX(e) { const w = art.toPlane(e.clientX, e.clientY, LANE.z); return Math.max(-1, Math.min(1, w.x)); }
canvas.addEventListener('pointerdown', e => {
  if (screen !== 'play' || paused || !art) return;
  e.preventDefault(); touched = true;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  finger = { id: e.pointerId };
  trayTarget = pointerX(e);
  if (phase === 'pick') { pickStart = { x: e.clientX, y: e.clientY, id: e.pointerId }; return; }
  if (phase === 'chop') { aimAt(e.clientX, e.clientY); if (e.pointerType === 'mouse') strike(); else tapStart = { at: performance.now(), x: e.clientX, y: e.clientY, id: e.pointerId }; }
  else if (phase === 'fry' && cook && !cook.over) cook.held = true;
  else if (phase === 'micro') stopMicro();
  else if (phase === 'blend') tapBlend();
  else if (phase === 'ring') openRegister();
  else if (phase === 'close') closeRegister();
});
canvas.addEventListener('pointermove', e => {
  if (screen !== 'play' || paused || !art) return;
  if (phase === 'chop' && (e.pointerType === 'mouse' || finger?.id === e.pointerId)) { aimAt(e.clientX, e.clientY); if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 14) tapStart = null; }
  if (finger && finger.id === e.pointerId) trayTarget = pointerX(e);
  else if (e.pointerType === 'mouse' && (phase === 'catch' || phase === 'sky')) { trayTarget = pointerX(e); touched = true; }
});
let pickStart = null;
const up = e => {
  if (phase === 'pick' && pickStart?.id === e.pointerId && e.type === 'pointerup') {
    const dx = e.clientX - pickStart.x; pickStart = null;
    if (Math.abs(dx) > 50) focusTo(focusI + (dx < 0 ? 1 : -1));
    else { const m = art.guestAt(e.clientX, e.clientY), hit = m && day.line.find(x => x.model === m); if (hit) callGuest(hit); }
  }
  if (finger && finger.id === e.pointerId) finger = null;
  // A short touch that did not drag is a tap: strike where it landed. A drag only aims.
  if (tapStart?.id === e.pointerId && e.type === 'pointerup' && performance.now() - tapStart.at < 350) strike();
  tapStart = null;
  if (phase === 'fry') letGo();
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
addEventListener('keydown', e => {
  if (actsFor && e.key === 'Escape') { closeActs(); return; }   // Escape shuts the sheet before it pauses
  if (isPauseKey(e)) { if (screen === 'paused') resume(); else if (screen === 'play') pause(); return; }
  if (screen !== 'play' || paused) return;
  keys.add(e.key); touched = true;
  if (e.repeat) return;
  if (phase === 'pick' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { focusTo(focusI + (e.key === 'ArrowRight' ? 1 : -1)); return; }
  if (actsFor) { if (e.key === 'Escape') closeActs(); return; }   // the sheet's own buttons take Space and Enter
  if (phase === 'sky' && rush && !actsFor && '123'.includes(e.key)) { const el = rush.line.find(x => seatOf(x) === Number(e.key) - 1); if (el) openActs(el); return; }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (fight) { fightTap(); return; }
    if (phase === 'pick' && day?.line?.length) { callGuest(sim.nextInLine(day.line)); return; }
    if (phase === 'fry' && cook && !cook.over) cook.held = true;
    else if (phase === 'micro') stopMicro();
    else if (phase === 'blend') tapBlend();
    else if (phase === 'chop') strike();
    else if (phase === 'ring') openRegister();
    else if (phase === 'close') closeRegister();
  }
});
addEventListener('keyup', e => { keys.delete(e.key); if ((e.key === ' ' || e.key === 'Enter') && phase === 'fry') letGo(); });

$('chopBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); strike(); });

// ---------- pause
function pause() {
  if (paused || (screen !== 'play' && screen !== 'extra')) return;
  if (actsFor) closeActs();
  before = screen; paused = true; snd.hold(); finger = null; tapStart = null; if (cook?.kind === 'fry') cook.held = false;
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
  if (rush) rec.end('left', { mode: 'rush', night: rush.night, tier: save.tier, t: Math.round(rush.t), served: rush.served, coins: rush.coins });
  else if (day && g) rec.end('left', { day: save.day, tier: save.tier, served: day.served, guest: day.i });
  if (g?.model) g.model.gone = true;
  clearCatch(); for (const m of cook?.items ?? []) art.world.remove(m); for (const b of cook?.bits ?? []) art.world.remove(b.m); if (dish) { art.world.remove(dish); dish = null; }
  g = null; cook = null; day = null; rush = null; clearRush(); phase = 'idle'; waits = []; fingerOff(); coach(null); gauge(null);
  art?.register.close();
  show('menu');
});
onLeave(pause);
$('play').addEventListener('click', async () => { snd.unlock(); await ready; if (screen === 'menu') beginDay(); });
$('rush').addEventListener('click', async () => { const was = visits; snd.unlock(); await ready; await art.peopleReady; if (screen === 'menu' && visits === was && !rush) { if (rushSave.night !== 'rush') { rushSave.night = 'rush'; storeRush(); } beginRush(); } });
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => { save.sound = !save.sound; store(); settingChanged('sound', !save.sound, save.sound); if (save.sound) { snd.unlock(); if (!paused) snd.release(); SFX.tap(); } labels(); });
for (const id of ['music1', 'music2']) $(id).addEventListener('click', () => { musicOn = !musicOn; write(MUSIC_KEY, musicOn ? '1' : '0'); settingChanged('music', !musicOn, musicOn); labels(); });
$('people2').addEventListener('click', () => { opts.set('people', peopleOn() ? 'off' : 'on'); if (!peopleOn()) clearPeople(); else if (rush) syncPeople(); SFX.tap(); labels(); });
for (const id of ['look1', 'look2']) $(id).addEventListener('click', () => {
  lookId = opts.set('look', LOOK_ORDER[(LOOK_ORDER.indexOf(lookId) + 1) % LOOK_ORDER.length]);
  art?.setLook(lookId); SFX.tap(); labels();
});

$('lang').addEventListener('click', () => { const from = W.lang(); W.setLang(from === 'en' ? 'tr' : 'en'); settingChanged('lang', from, W.lang()); W.apply(); labels(); menu(); SFX.tap(); });

// ---------- the frame
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  if (!art) return;
  const live = screen === 'play' && !paused;
  if (live) {
    clock += dt;
    for (const w of waits.splice(0)) { if (w.g !== g) continue; if (clock >= w.at) w.fn(); else waits.push(w); }
    // The tray: keys move the target; the tray follows it quickly.
    const kx = (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0);
    if (kx && phase === 'chop') aim = Math.max(-0.55, Math.min(0.55, aim + kx * 1.3 * dt));
    else if (kx) trayTarget = Math.max(-1, Math.min(1, trayTarget + kx * 2.4 * dt));
    trayX += (trayTarget - trayX) * (1 - Math.exp(-dt * 45));
    { const lim = trayEdge(); trayX = Math.max(-lim, Math.min(lim, trayX)); }
    art.tray.setX(trayX);
    art.tray.group.visible = phase === 'catch' || phase === 'caught' || phase === 'order' || phase === 'enter' || phase === 'sky';
    if (phase === 'catch' && g?.catch) stepCatch(dt);
    else if (phase === 'fry' && cook) stepFry(dt);
    else if (phase === 'micro' && cook) stepMicro(dt);
    else if (phase === 'chop' && cook) { if (cook.slide) stepChop(dt); stepKnife(dt); }
    else if (phase === 'blend' && cook) stepBlend(dt);
    if (fight) stepFight(dt);
    stepLine(dt);
    if (rush) stepRush(dt);
    if (!(g && phase === 'catch')) { const bar = $('patience').firstElementChild; bar.style.transform = ''; bar.style.background = ''; }
    if (g && phase === 'catch') { const w = (clock - g.catchT0) / TUNE.patience; $('patience').firstElementChild.style.transform = `scaleX(${Math.max(0, 1 - w)})`; $('patience').firstElementChild.style.background = w > 0.75 ? '#ff6b6b' : w > 0.5 ? '#ffb347' : ''; }
    for (const b of cook?.bits ?? []) { if (b.t > 0.6) continue; b.t += dt; b.v.y -= 6 * dt; b.m.position.addScaledVector(b.v, dt); if (b.m.position.y < b.y0) { b.m.position.y = b.y0; b.v.set(0, 0, 0); b.t = 1; } b.m.rotation.z += dt * 6 * Math.sign(b.v.x); }
    for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.z += dt * 10; if (f.t > 1.2) { art.world.remove(f.m); flying.splice(i, 1); } }
    for (const m of art.tray.load.children) if (m.userData.drop > 0) { m.userData.drop = Math.max(0, m.userData.drop - dt); m.position.y += -m.userData.drop * dt * 2; }
    if (slide && dish) { slide.t = Math.min(1, slide.t + dt * 2.2); dish.position.lerpVectors(slide.from, slide.to, elasticOut(slide.t) * 0.3 + slide.t * 0.7); dish.position.y = TOP + Math.sin(slide.t * Math.PI) * 0.15; if (slide.t >= 1) slide = null; }
    if (phase !== 'chop') art.knife.rest();
    if (phase !== 'fry' && flames?.visible) flames.visible = false;

    stepFinger(dt);
  }
  if (art) chopBtn(live && phase === 'chop' && !cook?.over);
  if ((phase !== 'order' || !live) && $('wheelBtn').style.display === 'flex') wheelBtn(false);
  if (screen !== 'play' && $('line').style.display === 'flex') $('line').style.display = 'none';
  song?.set({ on: musicOn && live, progress: rush ? Math.min(1, rush.t / rush.secs) : day ? Math.min(1, (day.i + 0.5) / day.plan.length) : 0, danger: rush ? Math.min(0.8, rush.strikes * 0.3) : phase === 'catch' && g?.catch ? Math.min(1, (clock - g.catchT0) / TUNE.patience) * 0.6 : 0, light: 1 });
  art.frame(paused ? 0 : dt);
}
requestAnimationFrame(frame);
labels(); hud(); menu();

// First-time help (kit/hint.js): a see-through finger slides side to side under the tray.
hint(canvas, {
  kind: 'drag', key: 'kitchen:hint', delay: 1500,
  when: () => screen === 'play' && !paused && (phase === 'enter' || phase === 'order' || phase === 'catch' || phase === 'sky'),
  played: hadSave, bottom: () => Math.max(120, innerHeight * 0.3),
});

// ---------- for checks
// Defined once the 3D kitchen has loaded, so checks that reload the page wait for the models first.
window.kitchenState = () => art && peopleIn && ({
  screen, paused, t: +clock.toFixed(3), phase, coins: save.coins, tier: save.tier, day: save.day, tray: +trayX.toFixed(3), sound: save.sound,
  built: { ...save.built }, tutorial: save.tutorial, served: save.served, touched, ready: !!art, recipe: g?.recipe ?? null,
  guest: day?.i ?? -1, guests: day?.plan.length ?? 0, need: g?.catch ? { ...g.catch.need } : null, got: g?.catch ? { ...g.catch.got } : null,
  extra: g?.catch?.extra?.id ?? null, items: g?.catch ? g.catch.items.map(it => ({ id: it.id, x: it.x, y: it.y })) : [], half: g?.catch?.half ?? 0,
  cook: cook ? { kind: cook.kind, d: cook.d, p: cook.p, band: cook.band, fill: cook.fill, left: cook.pieces?.filter(p => !p.done).length, misses: cook.misses ?? 0, striking: !!cook.strike, cuts: cook.pieces?.reduce((n, p) => n + p.cuts, 0), xs: cook.pieces?.map(p => p.done ? null : [p.m.position.x, p.m.position.z]), aim } : null, q: g?.q,
  look: lookId, hint: !!document.querySelector('.kit-hint.on'),
  line: day?.line ? day.line.map(e => ({ recipe: e.p.recipe, left: +e.left.toFixed(1) })) : null, lost: day?.lost ?? 0,
  mem: art.memory(), models: art.guests.length,
  rush: rush ? { people: [...people.values()].filter(p => p.m && p.state !== 'out').length, peopleAll: people.size, lift: +lift.toFixed(2), halos: [...people.values()].filter(p => p.halo && p.state === 'wait').map(p => { const h = art.toScreen(p.halo.getWorldPosition(new art.THREE.Vector3())); return { seat: p.seat, x: Math.round(h.x), y: Math.round(h.y) }; }), trayPx: Math.round(art.toScreen(new art.THREE.Vector3(0, LANE.y0 - 0.14, LANE.z)).y), mission: rush.mission, missionHolds: sh.missionHolds(rush), night: rush.night, secs: rush.secs, t: +rush.t.toFixed(2), coins: rush.coins, strikes: rush.strikes, buzz: rush.buzz, nerve: rush.nerve, acts: { ...rush.acts }, served: rush.served, turned: rush.turned, doors: rush.doors, over: rush.over, holds: rush.holds, at: rush.at?.recipe ?? null, tray: rush.sky.tray.map(it => it.id), line: rush.line.map(e => ({ n: e.n, recipe: e.recipe, kind: e.kind, left: +e.left.toFixed(1), full: e.full, need: { ...e.need }, got: { ...e.got }, ready: e.ready, price: e.price, mood: e.mood ?? null, frozen: e.frozen > 0, self: !!e.self })), sheet: !!actsFor, hold: rush.hold, calm: rush.calm > 0, locked: rush.locked > 0, items: rush.sky.items.map(it => ({ id: it.id, x: it.x, y: it.y, owner: sh.ownerOf(rush, it.id)?.n ?? null })) } : null,
  mood: g?.mood ?? null, staff: staff.map(m => m.kind), wheel: $('wheel').style.display === 'block', fight: fight ? { taps: fight.taps, need: fight.need } : null,
});
window.kitchenMusic = () => song && { ...song.melody, on: song.state.on, step: song.step, notes: song.log.length, kinds: song.log.map(l => l.kind) };
// Keeps a catch going for checks that wait on the hint: nothing is caught or finished while it runs.
// Checks only: finish the current catch at once, to reach the cooking steps of any dish.
// Test hook: put the knife over the next uncut piece.
window.kitchenAim = () => { const p = cook?.kind === 'chop' && cook.pieces.find(q => !q.done); if (p) { aim = p.m.position.x; art.knife.position.x = aim; } return !!p; };
// Test hooks: open the wheel and pick an action; settle a fight.
window.kitchenWheel = id => { if (phase === 'order' || phase === 'thrown') openWheel(phase === 'order' ? 'order' : 'payback'); if (phase === 'wheel') pickWheel(id); return phase; };
window.kitchenFight = win => { if (!fight) return false; if (win) { fight.taps = fight.need - 1; fightTap(); } else fight.t = sim.FIGHT_SECS; return true; };
window.kitchenCall = i => { const e = day?.line?.[i]; if (e) callGuest(e); return !!e; };
window.kitchenThrow = () => { throwNext = true; };
window.kitchenMood = m => { if (g) g.mood = m; return !!g; };
window.kitchenRush = (seed, night, mission) => { if (screen !== 'menu' && phase !== 'sky') return false; if (seed != null) rushSeed = seed; if (night && sh.nightsFor(save).includes(night)) rushNight = night; if (mission !== undefined) rushMission = typeof mission === 'string' && Object.hasOwn(sh.MISSIONS, mission) ? mission : null; beginRush(); return true; };
window.kitchenRushAct = (n, id, won = true) => { const e = rush?.line.find(x => x.n === n); if (!e || phase !== 'sky' || actsFor) return false; openActs(e); if (actsFor !== e) return false; actsAt = 0; doAct(id); if (id === 'fight' && fight) window.kitchenFight(won); return true; };
window.kitchenSkipCatch = () => { skipCatch = true; };
window.kitchenGolden = () => { goldenNext = true; };
window.kitchenAlive = () => { if (g?.catch) { g.catch.got = {}; g.catch.tray = []; g.catch.done = false; } };
window.kitchenScreen = (x, y, z) => art && art.toScreen(new art.THREE.Vector3(x, y, z));
