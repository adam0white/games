// Border Tournament: the page. Rules are in sim.js (pure, seeded); the neighbour's pacers are in pacers.js.
// This file draws, takes the three verbs, and wires the kit (sound, pause, words, lab recording, first-time help).
import { create, step, command, look, tally, seen, posture, TPS, LENGTH, CAP, BREAK, FULL, SAG, NEST, OUT, EDGE, RING, HOME, DEAD } from './sim.js';
import { NEIGHBOURS, PLAYER_ANTS } from './pacers.js';
import { W as WORDS } from './words.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { lab } from '../../kit/lab.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const t = WORDS.t, $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Storage: one key, one JSON object. A new field gets a default here and never changes meaning.
const KEY = 'cinderhill-tournament:save', HINT = 'cinderhill-tournament:hint';
const FOES = Object.keys(NEIGHBOURS);
const save = { v: 1, sound: true, foe: 'thornbacks', played: 0, won: {} };
{
  const old = readJson(KEY);
  if (old && typeof old === 'object') {
    if (typeof old.sound === 'boolean') save.sound = old.sound;
    if (FOES.includes(old.foe)) save.foe = old.foe;
    if (Number.isInteger(old.played) && old.played >= 0) save.played = old.played;
    if (old.won && typeof old.won === 'object') for (const f of FOES) if (Number.isInteger(old.won[f]) && old.won[f] >= 0) save.won[f] = old.won[f];
  }
  if (FOES.includes(query.get('foe'))) save.foe = query.get('foe');
}
const store = () => writeJson(KEY, save);

// Colours: Cinderhill's ants are ember-red; each neighbour has its own.
const LOOK = {
  me: { body: [196, 86, 44], dark: [92, 38, 22] },
  thornbacks: { body: [70, 62, 60], dark: [28, 24, 24], spines: true },
  jarkeepers: { body: [204, 146, 52], dark: [110, 70, 20], jar: true },
  leafstitchers: { body: [118, 128, 64], dark: [52, 58, 26] },
};
const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));

const snd = sound({ on: () => save.sound });
const rec = lab('cinderhill-tournament', { lang: WORDS.lang });

let mode = 'menu', game = null, mind = null, foe = save.foe, acc = 0, last = performance.now(), overAt = 0, clock = 0;
let pulls = { num: 0, fresh: 0, waited: 0, sagged: 0, ringTicks: 0 }, seedUsed = 0;
const show = screens(['menu', 'paused', 'end'], name => {
  mode = name;
  const live = name === 'play' || name === 'over';
  $('pause').style.display = name === 'play' ? 'block' : 'none';
  $('hud').classList.toggle('on', live); $('controls').classList.toggle('on', name === 'play');
});

// ---------- Menu ----------
function drawFoes() {
  const box = $('foes'); box.textContent = '';
  for (const f of FOES) {
    const b = document.createElement('button'); b.dataset.foe = f; b.setAttribute('aria-pressed', String(f === save.foe));
    const dot = document.createElement('i'); dot.style.background = css(LOOK[f].body);
    const name = document.createElement('b'); name.textContent = t(f) + (save.won[f] ? `  ✦${save.won[f]}` : '');
    const about = document.createElement('span'); about.textContent = t(`${f}About`, { n: NEIGHBOURS[f].ants });
    b.append(dot, name, about);
    b.addEventListener('click', () => { save.foe = f; store(); drawFoes(); });
    box.append(b);
  }
}
function texts() {
  WORDS.apply();
  $('yourAnts').textContent = t('yourAnts', { n: PLAYER_ANTS });
  for (const id of ['sound1', 'sound']) $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff');
  for (const id of ['lang1', 'lang2']) $(id).textContent = t('lang');
  document.title = t('title');
  drawFoes(); rec.retext?.();
}
function toggleSound() {
  save.sound = !save.sound; store(); texts();
  if (save.sound) snd.unlock(); else snd.hold();
  if (save.sound && mode !== 'paused') snd.release();
}
$('sound1').addEventListener('click', toggleSound); $('sound').addEventListener('click', toggleSound);
for (const id of ['lang1', 'lang2']) $(id).addEventListener('click', () => { WORDS.setLang(WORDS.lang() === 'en' ? 'tr' : 'en'); texts(); });
rec.notice(document.querySelector('#menu .card'));
rec.toggle(document.querySelector('#paused .card'));

// ---------- Contest ----------
function newSeed() {
  const asked = Number(query.get('seed'));
  if (Number.isInteger(asked) && asked > 0) return asked >>> 0;
  const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] || 1;
}
function start() {
  foe = save.foe; seedUsed = newSeed();
  game = create(seedUsed, { a: { ants: PLAYER_ANTS }, b: { ants: NEIGHBOURS[foe].ants } });
  mind = NEIGHBOURS[foe].pacer();
  acc = 0; last = performance.now(); clock = 0;
  pulls = { num: 0, fresh: 0, waited: 0, sagged: 0, ringTicks: 0 };
  resetBodies();
  $('meName').textContent = t('you'); $('themName').textContent = t(foe);
  document.documentElement.style.setProperty('--theirs', css(mix(LOOK[foe].body, [230, 230, 230], 0.25)));
  const day = side => { const s = game.sides[side]; return t('day', { who: side ? t(foe) : t('you'), fed: t(['lean', 'fed', 'wellFed'][s.fed]), big: s.big }); };
  $('myDay').textContent = day(0); $('theirDay').textContent = day(1);
  rec.start({ foe, ants: PLAYER_ANTS, theirs: NEIGHBOURS[foe].ants, seed: seedUsed, lang: WORDS.lang() });
  show('play'); hud();
}
$('play').addEventListener('click', () => { snd.unlock(); snd.release(); start(); snd.tone(330, 0.15, 0.08, 'triangle', 110); });
$('again').addEventListener('click', () => { snd.unlock(); snd.release(); start(); });
$('toMenu').addEventListener('click', () => { texts(); show('menu'); });
$('quit').addEventListener('click', () => { if (game && !game.over) rec.end('quit', summary()); snd.release(); texts(); show('menu'); });

function verb(name) {
  if (mode !== 'play' || !game || game.over) return;
  const did = command(game, 0, name);
  rec.event(name, { t: game.t, did });
  const b = $(name); b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 160);
  if (!did) { snd.tone(120, 0.08, 0.05, 'square'); return; }
  if (name === 'send') { snd.tone(392, 0.12, 0.08, 'triangle', 196); }
  else if (name === 'rotate') { snd.tone(330, 0.1, 0.07, 'triangle'); setTimeout(() => snd.tone(494, 0.12, 0.07, 'triangle'), 90); }
  else snd.tone(196, 0.16, 0.07, 'sine', -60);
  hud();
}
for (const name of ['send', 'hold', 'rotate']) $(name).addEventListener('click', () => verb(name));

function tick() {
  if (game.t % 5 === 0) { const v = mind(seen(game, 1)); if (v) command(game, 1, v); }
  const a = look(game, 0), b = look(game, 1), me = tally(game, 0);
  pulls.num += a.count - b.count; pulls.fresh += a.fresh - b.fresh;
  pulls.waited += me.edge; pulls.ringTicks += me.ring;
  for (let i = 0; i < game.sides[0].ants; i++) if (game.sides[0].where[i] === RING && game.sides[0].stam[i] < SAG) pulls.sagged++;
  const over = step(game);
  if (over) finish(over);
}

function summary() {
  const s = game.sides[0];
  return { t: game.t, tug: game.tug, waves: s.sent, rotations: s.rotations, holds: s.holds, dead: s.dead, theirDead: game.sides[1].dead,
    numbers: Math.round(pulls.num / TPS), freshness: Math.round(pulls.fresh / TPS), seed: seedUsed };
}

function finish(over) {
  const outcome = over.winner === 0 ? 'won' : over.winner === 1 ? 'lost' : 'draw';
  save.played++; if (outcome === 'won') save.won[foe] = (save.won[foe] ?? 0) + 1; store();
  rec.end(outcome, { ...summary(), broke: over.broke, margin: over.margin });
  mode = 'over'; overAt = performance.now();
  $('pause').style.display = 'none'; $('controls').classList.remove('on');
  if (outcome === 'won') { snd.tone(392, 0.3, 0.08, 'triangle'); setTimeout(() => snd.tone(523, 0.3, 0.08, 'triangle'), 140); setTimeout(() => snd.tone(659, 0.5, 0.08, 'triangle'), 280); }
  else if (outcome === 'lost') { snd.tone(220, 0.4, 0.08, 'sine', -80); }
  else snd.tone(330, 0.4, 0.06, 'sine');
  if (over.broke) snd.noise?.(0.35, 0.05, 900);
  const n = over.deaths, foeName = t(foe);
  $('endMark').textContent = outcome === 'won' ? '✦' : outcome === 'lost' ? '✕' : '═';
  $('endTitle').textContent = t(outcome === 'won' ? 'won' : outcome === 'lost' ? 'lost' : 'drawn');
  $('endLine').textContent = over.broke
    ? t(outcome === 'won' ? (n ? 'wonBroke' : 'wonBrokeNone') : (n ? 'lostBroke' : 'lostBrokeNone'), { foe: foeName, n })
    : t(outcome === 'won' ? 'wonTime' : outcome === 'lost' ? 'lostTime' : 'drawTime');
  const way = v => t(Math.abs(v) < 2000 ? 'pullNone' : v > 0 ? 'pullYou' : 'pullThem');
  $('endWhy').textContent = t('endWhy', { num: way(pulls.num), fresh: way(pulls.fresh) });
  const ringAvg = pulls.ringTicks / Math.max(1, game.t);
  $('endTip').textContent = pulls.sagged > game.t * 2 ? t('tip1') : pulls.waited > game.t * 6 ? t('tip2') : outcome === 'won' && ringAvg > 20 ? '' : t('tip3');
  const s = game.sides[0];
  $('endStats').textContent = t('endStats', { waves: Math.ceil(s.sent / 10), rot: s.rotations, hold: s.holds, secs: Math.round(game.t / TPS) });
}

// ---------- Pause ----------
function pauseGame() { if (mode !== 'play') return; snd.hold(); show('paused'); }
function resumeGame() { if (mode !== 'paused') return; snd.release(); last = performance.now(); acc = 0; show('play'); }
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resumeGame);
onLeave(pauseGame);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (mode === 'play') pauseGame(); else if (mode === 'paused') resumeGame(); e.preventDefault(); return; }
  if (mode !== 'play' || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 's' || k === ' ' || k === 'enter') { verb('send'); e.preventDefault(); }
  else if (k === 'r') verb('rotate');
  else if (k === 'h') verb('hold');
});

// ---------- HUD ----------
function hud() {
  if (!game) return;
  const a = look(game, 0), b = look(game, 1), me = tally(game, 0);
  const u = Math.max(-1, Math.min(1, game.tug / BREAK));
  // The bar shows ground: your colour pushes right as you win, as the front line does in the ring.
  $('knot').style.left = `${50 + u * 50}%`;
  $('tug').style.background = `linear-gradient(90deg,var(--mine) 0 ${50 + u * 50}%,var(--theirs) ${50 + u * 50}% 100%)`;
  $('tug').setAttribute('aria-valuenow', String(Math.round(u * 100)));
  const bar = (el, v, scale) => {
    const w = Math.min(50, Math.abs(v) / scale * 50);
    el.style.left = v >= 0 ? '50%' : `${50 - w}%`; el.style.width = `${w}%`;
    el.style.background = v >= 0 ? 'var(--mine)' : 'var(--theirs)';
  };
  const dn = a.count - b.count, df = a.fresh - b.fresh, total = dn + df;
  bar($('numBar'), dn, 700); bar($('freshBar'), df, 700);
  const who = t(total > 0 ? 'youWho' : 'theyWho');
  let why;
  if (Math.abs(total) < 60) why = t('whyEven');
  else if (Math.sign(dn) === Math.sign(total) && Math.sign(df) === Math.sign(total) && Math.abs(dn) > 60 && Math.abs(df) > 60) why = t('whyBoth', { who });
  else why = t(Math.sign(df) === Math.sign(total) && Math.abs(df) >= Math.abs(dn) || Math.sign(dn) !== Math.sign(total) ? 'whyFresh' : 'whyNumbers', { who });
  $('whyLine').textContent = why;
  const left = Math.max(0, LENGTH - game.t) / TPS | 0;
  $('clock').textContent = `${left / 60 | 0}:${String(left % 60).padStart(2, '0')}`;
  $('cHome').textContent = t('home', { n: me.nest });
  $('cWay').textContent = t('coming', { n: me.out + me.edge });
  $('cRing').textContent = t('ring', { n: me.ring });
  $('sendSub').textContent = t('sendSub', { n: me.ready });
}

// ---------- Scene ----------
const cv = $('c'), g = cv.getContext('2d');
let Wd = 0, Ht = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); Wd = innerWidth; Ht = innerHeight;
  cv.width = Math.round(Wd * dpr); cv.height = Math.round(Ht * dpr);
}
addEventListener('resize', resize); resize();

// Each ant's drawn position eases toward where the sim says it is. Slots in the ring are kept per ant.
let bodies = [];
function resetBodies() {
  bodies = game.sides.map(s => ({ x: new Float32Array(s.ants), y: new Float32Array(s.ants), slot: new Int16Array(s.ants).fill(-1), seen: new Uint8Array(s.ants), dir: new Int8Array(s.ants) }));
}
function geometry() {
  const top = Math.min(190, Ht * 0.24), bottom = Ht - Math.min(120, Ht * 0.18);
  const cx = Wd / 2, cy = top + (bottom - top) * 0.56;
  const rx = Math.min(Wd * 0.47, 380), ry = Math.min(rx * 0.62, (bottom - top) * 0.4);
  const unit = Math.max(7.5, Math.min(16, rx / 13));
  return { cx, cy, rx, ry, unit, top, bottom, nest: [{ x: -unit * 2, y: cy + ry * 0.55 }, { x: Wd + unit * 2, y: cy + ry * 0.55 }] };
}
// 30 slots a side: five rows by six columns, the front column nearest the middle line, rows staggered.
function slotPos(G, side, k, front) {
  const col = k / 5 | 0, row = k % 5, dir = side ? 1 : -1;
  const x = G.cx + front + dir * (G.unit * 2.2 + col * G.rx * 0.135 + (row % 2) * G.rx * 0.06);
  const y = G.cy + (row - 2) * G.ry * 0.36;
  return [x, y];
}
// Ants waiting their turn stand in a crowd on the far rim of the ring, on their own side: numbers you can see, not using.
function edgePos(G, side, k) {
  const dir = side ? 1 : -1, col = k % 15, row = k / 15 | 0;
  return [G.cx + dir * (G.rx * 0.16 + col * G.rx * 0.052 + (row % 2) * G.rx * 0.026), G.cy - G.ry * 0.98 - row * G.unit * 0.9];
}

// The burned hill behind: stems drawn from a fixed seed, so the scene does not shimmer.
const stems = Array.from({ length: 40 }, (_, i) => { const h = Math.imul(i + 1, 2654435761) >>> 0; return [(h % 1000) / 1000, ((h >>> 10) % 1000) / 1000, ((h >>> 20) % 1000) / 1000]; });
function backdrop(G) {
  const sky = g.createLinearGradient(0, 0, 0, Ht);
  sky.addColorStop(0, '#2b2030'); sky.addColorStop(0.45, '#4a3330'); sky.addColorStop(1, '#2a2220');
  g.fillStyle = sky; g.fillRect(0, 0, Wd, Ht);
  // The hill's line and its burned stems.
  const hy = G.cy - G.ry * 1.6;
  g.fillStyle = '#3a2c29'; g.beginPath(); g.moveTo(0, hy + 20);
  for (let x = 0; x <= Wd; x += 20) g.lineTo(x, hy + Math.sin(x / 90) * 10 - Math.sin(x / 37) * 4);
  g.lineTo(Wd, Ht); g.lineTo(0, Ht); g.fill();
  g.strokeStyle = '#1e1716'; g.lineCap = 'round';
  for (const [u, v, w] of stems) {
    const x = u * Wd, y = hy + Math.sin(x / 90) * 10 + 4, h = 18 + v * 40;
    g.lineWidth = 1 + w * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (w - 0.5) * 10, y - h); g.stroke();
    if (v > 0.5) { g.beginPath(); g.moveTo(x + (w - 0.5) * 6, y - h * 0.6); g.lineTo(x + (w - 0.5) * 6 + 8, y - h * 0.8); g.stroke(); }
  }
  // Ash ground and the ring.
  const ground = g.createLinearGradient(0, G.cy - G.ry, 0, Ht);
  ground.addColorStop(0, '#5a4a40'); ground.addColorStop(1, '#3b302b');
  g.fillStyle = ground; g.fillRect(0, G.cy - G.ry * 1.3, Wd, Ht);
  g.fillStyle = '#6c5b4ecc'; g.beginPath(); g.ellipse(G.cx, G.cy, G.rx, G.ry, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a776655'; g.lineWidth = 2; g.stroke();
  // Nest mounds at both edges.
  for (const [i, n] of G.nest.entries()) {
    g.fillStyle = i ? '#2e2522' : '#3d2a22'; g.beginPath(); g.ellipse(n.x + (i ? -6 : 6), n.y + G.unit, G.unit * 5, G.unit * 2.6, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#120d0c'; g.beginPath(); g.ellipse(n.x + (i ? -G.unit * 2 : G.unit * 2), n.y + G.unit * 0.6, G.unit * 1.2, G.unit * 0.6, 0, 0, Math.PI * 2); g.fill();
  }
}

// A side-on ant, standing on (x, y). k is its size in px, p its posture (percent), face +1 right or -1 left.
function ant(x, y, k, p, face, colour, stam, phase, moving, dead) {
  const fade = 0.45 * (1 - stam / FULL);
  const body = mix(colour.body, colour.dark, fade + (p < 50 ? 0.25 : 0));
  const leg = k * (0.3 + 1.1 * p / 100), lift = dead ? k * 0.3 : leg * 0.8;
  const bob = moving || reduced ? 0 : Math.sin(phase) * k * 0.08 * p / 100;
  const by = y - lift - bob;
  g.save(); g.translate(x, 0); g.scale(face, 1);
  g.fillStyle = '#00000033'; g.beginPath(); g.ellipse(0, y + 1, k * 1.3, k * 0.28, 0, 0, Math.PI * 2); g.fill();
  if (dead) {
    g.fillStyle = css(mix(body, [60, 60, 60], 0.6)); g.beginPath(); g.ellipse(0, y - k * 0.3, k * 1.1, k * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(1, k * 0.1);
    for (const lx of [-0.4, 0, 0.4]) { g.beginPath(); g.moveTo(lx * k, y - k * 0.5); g.lineTo(lx * k + k * 0.2, y - k * 1.1); g.stroke(); }
    g.restore(); return;
  }
  // Legs: three a side, the far ones fainter. Stilting ants straighten them; a walk swings them.
  g.lineCap = 'round';
  for (const far of [1, 0]) {
    g.strokeStyle = css(far ? colour.dark : body, far ? 0.6 : 1); g.lineWidth = Math.max(1, k * 0.11);
    for (let j = 0; j < 3; j++) {
      const hip = (j - 1) * k * 0.22 + k * 0.05, swing = (moving && !reduced ? Math.sin(phase * 2 + j * 2.1 + far * Math.PI) : 0) * k * 0.3;
      const foot = hip + (j - 1) * k * 0.55 + swing + (far ? k * 0.08 : 0);
      const knee = hip + (j - 1) * k * 0.35;
      g.beginPath(); g.moveTo(hip, by + k * 0.05); g.lineTo(knee, by - k * 0.25 * (p / 100)); g.lineTo(foot, y - (moving ? Math.max(0, swing) * 0.2 : 0)); g.stroke();
    }
  }
  // Gaster (raised in display), petiole, thorax, head, antennae.
  const raise = Math.max(0, (p - 60) / 60) * 0.5;
  g.fillStyle = css(body);
  g.save(); g.translate(-k * 0.55, by - k * 0.05); g.rotate(-raise);
  g.beginPath(); g.ellipse(-k * 0.45, 0, k * (colour.jar ? 0.7 : 0.58), k * (colour.jar ? 0.55 : 0.42), 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff14'; g.beginPath(); g.ellipse(-k * 0.5, -k * 0.15, k * 0.3, k * 0.14, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = css(body);
  g.beginPath(); g.ellipse(-k * 0.3, by - k * 0.05, k * 0.12, k * 0.1, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(0.05 * k, by - k * 0.1, k * 0.36, k * 0.2, -0.15, 0, Math.PI * 2); g.fill();
  if (colour.spines) { g.strokeStyle = css(colour.dark); g.lineWidth = Math.max(1, k * 0.08); g.beginPath(); g.moveTo(-k * 0.15, by - k * 0.22); g.lineTo(-k * 0.3, by - k * 0.55); g.moveTo(k * 0.05, by - k * 0.26); g.lineTo(-k * 0.05, by - k * 0.55); g.stroke(); }
  const hx = k * 0.55, hy = by - k * 0.2 - (p > 90 ? k * 0.08 : 0);
  g.beginPath(); g.ellipse(hx, hy, k * 0.26, k * 0.22, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = css(body); g.lineWidth = Math.max(1, k * 0.08);
  const ant1 = p < 50 ? 0.25 : -0.35;
  g.beginPath(); g.moveTo(hx + k * 0.1, hy - k * 0.15); g.lineTo(hx + k * 0.4, hy - k * 0.55); g.lineTo(hx + k * 0.8, hy + k * ant1); g.stroke();
  g.fillStyle = '#fff3'; g.beginPath(); g.arc(hx + k * 0.12, hy - k * 0.04, k * 0.06, 0, Math.PI * 2); g.fill();
  g.restore();
}

function scene(dt, now) {
  const G = geometry();
  backdrop(G);
  if (!game) return;
  const front = Math.max(-1, Math.min(1, game.tug / BREAK)) * G.rx * 0.22;
  // The front line, where the two sides meet: it moves as ground is won.
  g.strokeStyle = '#f3e6d244'; g.setLineDash([4, 6]); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(G.cx + front, G.cy - G.ry * 0.85); g.lineTo(G.cx + front, G.cy + G.ry * 0.85); g.stroke(); g.setLineDash([]);
  const list = [];
  for (const side of [0, 1]) {
    const s = game.sides[side], B = bodies[side], colour = side ? LOOK[foe] : LOOK.me, home = G.nest[side];
    const used = new Uint8Array(CAP); for (let i = 0; i < s.ants; i++) if (s.where[i] === RING && B.slot[i] >= 0) used[B.slot[i]] = 1;
    let edgeK = 0;
    for (let i = 0; i < s.ants; i++) {
      const w = s.where[i];
      if (w !== RING) B.slot[i] = -1;
      else if (B.slot[i] < 0) { let k = 0; while (k < CAP - 1 && used[k]) k++; B.slot[i] = k; used[k] = 1; }
      let tx, ty;
      if (w === RING) [tx, ty] = slotPos(G, side, B.slot[i], front);
      else if (w === EDGE || w === OUT) [tx, ty] = edgePos(G, side, edgeK++);
      else [tx, ty] = [home.x, home.y];
      if (!B.seen[i]) { B.x[i] = home.x; B.y[i] = home.y; B.seen[i] = 1; }
      const dx = tx - B.x[i], dy = ty - B.y[i], d = Math.hypot(dx, dy);
      const speed = (w === RING ? 2.2 : 1) * (G.rx * 1.2) / 2.5;
      const stepLen = Math.min(d, speed * dt);
      if (d > 0.01) { B.x[i] += dx / d * stepLen; B.y[i] += dy / d * stepLen; B.dir[i] = dx > 0 ? 1 : -1; }
      const atNest = w === NEST || (w === HOME && Math.hypot(B.x[i] - home.x, B.y[i] - home.y) < G.unit * 2);
      if (atNest && w !== DEAD) continue;
      const moving = d > 1.5;
      const face = w === RING || (w === EDGE && !moving) ? (side ? -1 : 1) : B.dir[i];
      const p = w === RING ? posture(s.stam[i], s.age[i]) : moving ? 60 : 50;
      list.push([B.y[i], B.x[i], G.unit * s.size[i] / 100, p, face, colour, s.stam[i], now / 160 + i * 1.7 + side, moving, w === DEAD]);
    }
  }
  list.sort((a, b) => a[0] - b[0]);
  for (const [y, x, k, p, face, colour, stam, phase, moving, dead] of list) ant(x, y, k, p, face, colour, stam, phase, moving, dead);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'play') {
    acc += dt * 1000;
    let n = 0;
    while (acc >= 1000 / TPS && n < 5) { acc -= 1000 / TPS; n++; tick(); if (mode !== 'play') break; }
    if (n) hud();
  }
  if (mode === 'over' && now - overAt > 1800) show('end');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene(mode === 'paused' ? 0 : dt, now);
  requestAnimationFrame(frame);
}

// First-time help: a finger tapping Send wave, until the player first acts in a contest.
const sendEl = $('send');
hint(sendEl, { kind: 'tap', key: HINT, when: () => mode === 'play', played: save.played > 0, delay: 2500, label: t('firstHint'),
  bottom: () => { const r = sendEl.getBoundingClientRect(); return Math.max(40, innerHeight - (r.top + r.height / 2)); } });

// For checks and the lab: what is on screen and how far the contest has run.
window.tournamentState = () => ({ screen: mode, t: game?.t ?? 0, paused: mode === 'paused', foe: save.foe, sound: save.sound, played: save.played,
  me: game ? tally(game, 0) : null, them: game ? tally(game, 1) : null, tug: game?.tug ?? 0, over: game?.over ?? null });

texts(); show('menu');
requestAnimationFrame(frame);
