// Thumb Duel: the page. Input, drawing, sound, save, cards. The rules are in sim.js and the bot in brain.js.
import { createMatch, step, blank, mirror, useMath, DT, KINDS, CONTROL, WIN, PADS, MEMORY, HOCKEY, SUMO, BALANCE, TUG, CATCH, DRAW, SWIPE, LAUNCH } from './sim.js';
import { makeBot, STRENGTHS } from './brain.js';
import { C, side as cols, TAU, rrect, circle, shadow, noShadow, star, critter, beetle, lantern, firefly, seed, paddle, drop, finger } from './art.js';
import { readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js'; noZoom(); // no double-tap or pinch zoom (note #74)
import { newCode, cleanCode, codeFromLink, linkFor, share } from '../kit/room.js';
import { sameMath } from '../kit/samemath.js';
import { FRIEND_KINDS, drive, stateHash } from './net.js';
import { friendLink } from './friend.js';
import { t as tr, apply as applyWords } from './words.js';

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)');
const ONLY = KINDS.includes(query.get('only')) ? query.get('only') : null;
const FAST = query.get('fast') === '1'; // tests only: short intros

// ---------------------------------------------------------------- save: one JSON blob, fields only ever grow (NOTES.md)
const KEY = 'duel-save';
const save = { v: 1, sound: true, matches: 0, friend: { side: -1, run: 0, best: 0 }, solo: { easy: { won: 0, run: 0, best: 0 }, medium: { won: 0, run: 0, best: 0 }, hard: { won: 0, run: 0, best: 0 } } };
{
  const old = readJson(KEY, null);
  const num = v => Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  if (old && typeof old === 'object') {
    if (typeof old.sound === 'boolean') save.sound = old.sound;
    save.matches = num(old.matches);
    if (old.friend && typeof old.friend === 'object') save.friend = { side: [0, 1].includes(old.friend.side) ? old.friend.side : -1, run: num(old.friend.run), best: num(old.friend.best) };
    for (const l of STRENGTHS) { const o = old.solo?.[l]; if (o && typeof o === 'object') save.solo[l] = { won: num(o.won), run: num(o.run), best: num(o.best) }; }
  }
}
const store = () => writeJson(KEY, save);
const open = l => l === 'easy' || save.solo[STRENGTHS[STRENGTHS.indexOf(l) - 1]].won > 0;
const starsOf = l => Math.min(3, save.solo[l].best);

// ---------------------------------------------------------------- canvas and layout (CSS px)
const cv = $('c'), g = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, inset = 0, k = 300, bx = 0, cy = 0;
function layout() {
  const { width, height } = cv.getBoundingClientRect();
  if (W && (W !== width || H !== height)) clearInput();
  dpr = Math.min(2, devicePixelRatio || 1);
  W = width; H = height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe'));
  inset = Math.max(parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0); // the larger inset on both halves, so neither player gets less
  k = Math.min(W - 8, (H - 2 * inset - 8) / 2, 520);
  bx = (W - k) / 2; cy = H / 2;
}
const P = (x, y) => [bx + x * k, cy + y * k];
// Playing a friend by link, the guest is side 1 and sees the whole canvas turned half round, so its own side is at the
// bottom the right way up. `view` takes a point on the glass to the canvas's own (unturned) frame.
let flip = false;
const view = (x, y) => flip ? [W - x, H - y] : [x, y];
const toBoard = (sx, sy) => [(sx - bx) / k, (sy - cy) / k];
// Draw in side `i`'s own frame: side 1's half is the board turned half round about its middle.
function withSide(i, fn) { if (i === 0) return fn(); g.save(); g.translate(2 * (bx + k / 2), 2 * cy); g.scale(-1, -1); fn(); g.restore(); }

// ---------------------------------------------------------------- sound: all synthesized through the kit
const snd = sound({ on: () => save.sound });
const tone = (f, d, v, type = 'sine', slide = 0) => { if (snd.ctx) snd.tone(f, d, v, type, slide); };
const noise = (d, v, hz) => { if (snd.ctx) snd.noise(d, v, hz); };
const later = (ms, fn) => setTimeout(() => { if (!paused) fn(); }, ms);
const NOTES = [523.25, 659.25, 783.99, 987.77];
const voice = {
  tap: i => tone(i ? 620 : 720, 0.05, 0.05, 'triangle'),
  pull: i => { tone((i ? 180 : 210) + Math.random() * 30, 0.09, 0.08, 'sawtooth', -60); noise(0.06, 0.06, 900); },
  lit: () => { tone(1320, 0.6, 0.12); tone(1760, 0.45, 0.06); },
  shot: () => { noise(0.12, 0.25, 1500); tone(900, 0.25, 0.08, 'square', -500); },
  early: () => tone(170, 0.4, 0.12, 'sawtooth', -70),
  soft: () => tone(400, 0.15, 0.05, 'triangle', -100),
  shove: () => { noise(0.2, 0.3, 280); tone(110, 0.22, 0.15, 'sine', -40); },
  whiff: () => { noise(0.25, 0.12, 3200); tone(620, 0.3, 0.06, 'sine', -450); },
  catch: () => [988, 1319, 1568].forEach((f, i) => later(i * 60, () => tone(f, 0.25, 0.08, 'triangle'))),
  miss: () => tone(200, 0.25, 0.08, 'square', -60),
  appear: () => tone(1500, 0.12, 0.03, 'sine', 300),
  hit: p => { noise(0.05, 0.15 + p * 0.25, 2400); tone(600 + p * 600, 0.06, 0.07, 'square'); },
  wall: () => noise(0.04, 0.08, 1800),
  goal: () => [523, 659, 784, 1047].forEach((f, i) => later(i * 70, () => tone(f, 0.3, 0.1, 'triangle'))),
  show: p => tone(NOTES[p], 0.36, 0.1, 'triangle'),
  pad: (p, ok) => ok ? tone(NOTES[p], 0.2, 0.1, 'triangle') : tone(140, 0.45, 0.12, 'sawtooth', -40),
  round: () => [784, 1175].forEach((f, i) => later(i * 90, () => tone(f, 0.3, 0.08, 'triangle'))),
  fall: () => { tone(520, 0.45, 0.08, 'sine', -400); later(380, () => noise(0.15, 0.12, 1200)); },
  back: () => tone(880, 0.1, 0.04, 'sine', 200),
  beep: n => tone(n ? 660 : 990, n ? 0.12 : 0.3, 0.1, 'square'),
  point: () => { tone(784, 0.15, 0.1, 'triangle'); later(110, () => tone(1047, 0.35, 0.11, 'triangle')); },
  draw: () => { tone(440, 0.2, 0.08, 'triangle'); later(150, () => tone(440, 0.25, 0.08, 'triangle')); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 110, () => { tone(f, 0.4, 0.1, 'triangle'); tone(f / 2, 0.4, 0.05, 'sine'); })),
  ready: () => tone(880, 0.12, 0.08, 'triangle', 200),
};

// ---------------------------------------------------------------- state
let link = null; // playing a friend by link: { f (friend.js), me (my side), m (the match for net.js drive), acc, since, ... }
let screen = 'menu', paused = false, s = null, solo = null, bot = null, matchNo = 0, acc = 0, ready = [false, false], lastBeep = -1;
const pointers = new Map(); // pointerId -> { side, x, y, at }: a finger belongs to the half it went down in, for as long as it is down
const pending = [[], []];   // taps waiting for the next tick
const releases = [[], []];  // completed gestures waiting for the next tick
const kb = { held: false, chargeAt: null, tap: 0, px: 0.5, py: 0.75, keys: new Set(), pads: [] }; // the keyboard is side 0's thumb
let fx = [], texts = [], shake = 0, flash = [0, 0], confetti = 0, seedNo = 0;
const show = screens(['menu', 'solo', 'friend', 'gone', 'paused', 'end'], name => { $('pause').style.display = name === 'play' ? 'grid' : 'none'; });

// ---------------------------------------------------------------- lab recording
const rec = lab('duel');
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);

// ---------------------------------------------------------------- input: every pointer is owned by the half it went down in
function sideAt(y) { return y < cy ? 1 : 0; }
const local = i => link ? i === link.me : solo ? i === 0 : true; // a side played on this phone
const keySide = () => link ? link.me : 0;                        // the side the keyboard plays
const inPlay = () => screen === 'play' && !paused && s?.phase === 'play';
const gesturePlay = () => inPlay() && (s.kind === 'swipe' || s.kind === 'launch');
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  snd.unlock();
  const [vx, vy] = view(e.clientX, e.clientY), side = sideAt(vy), [x, y] = toBoard(vx, vy);
  const at = performance.now();
  const gesture = gesturePlay() && local(side)
    && ![...pointers.values()].some(p => p.side === side && p.duel === s.d);
  pointers.set(e.pointerId, { side, x, y, x0: x, y0: y, at, duel: gesture ? s.d : null });
  try { cv.setPointerCapture(e.pointerId); } catch {} // synthetic ids in tests have no capture; never let that throw
  if (screen !== 'play' || paused) return;
  if (!local(side)) return; // the bot or the friend plays the top half
  if (hintFor(side)) for (const copy of help) copy.done();
  pending[side].push({ x, y });
  ring(vx, vy, side);
  voice.tap(side);
});
const moved = e => { const p = pointers.get(e.pointerId); if (!p) return; [p.x, p.y] = toBoard(...view(e.clientX, e.clientY)); };
cv.addEventListener('pointermove', moved);
cv.addEventListener('pointerup', e => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p?.duel || !gesturePlay() || p.duel !== s.d) return;
  const [x, y] = toBoard(...view(e.clientX, e.clientY));
  releases[p.side].push({ x0: p.x0, y0: p.y0, x, y, seconds: (performance.now() - p.at) / 1000 });
});
const forgetPointer = e => { pointers.delete(e.pointerId); };
cv.addEventListener('pointercancel', forgetPointer);
cv.addEventListener('lostpointercapture', forgetPointer);
cv.addEventListener('contextmenu', e => e.preventDefault());

function inputFor(i) {
  const inp = blank();
  let latest = null;
  for (const p of pointers.values()) if (p.side === i) {
    inp.held = true;
    if (!latest || p.at > latest.at) latest = p;
    if (p.duel && p.duel === s.d) inp.heldFor = (performance.now() - p.at) / 1000;
  }
  if (latest) { inp.px = latest.x; inp.py = latest.y; }
  inp.taps = pending[i].splice(0);
  inp.releases = releases[i].splice(0);
  if (i === keySide()) { // the keyboard, in this side's own frame
    if (kb.held) inp.held = true;
    if (kb.chargeAt !== null && inp.heldFor === 0) inp.heldFor = (performance.now() - kb.chargeAt) / 1000;
    for (; kb.tap > 0; kb.tap--) { const [x, y] = mirror(i, 0.5, 0.5); inp.taps.push({ x, y }); }
    for (const pad of kb.pads.splice(0)) { const [x, y] = mirror(i, PADS[pad].x, PADS[pad].y); inp.taps.push({ x, y }); }
    if (kb.keys.size && !latest) [inp.px, inp.py] = mirror(i, kb.px, kb.py);
  }
  return inp;
}

addEventListener('keydown', e => {
  if (isPauseKey(e)) {
    if (!e.repeat && screen === 'play') { paused ? resume() : pause(); }
    e.preventDefault();
    return;
  }
  if (screen !== 'play' || paused) return;
  if (e.key === ' ') {
    e.preventDefault();
    if (!e.repeat) {
      kb.tap++; voice.tap(keySide());
      if (inPlay() && s.kind === 'launch') kb.chargeAt = performance.now();
    }
    kb.held = true;
  }
  if (/^[1-4]$/.test(e.key) && !e.repeat) { kb.pads.push(Number(e.key) - 1); voice.tap(keySide()); }
  if (e.key.startsWith('Arrow')) {
    kb.keys.add(e.key); e.preventDefault();
    if (e.key === 'ArrowUp' && !e.repeat && inPlay() && s.kind === 'swipe') {
      const i = keySide(), [x0, y0] = mirror(i, 0.5, 0.76), [x, y] = mirror(i, 0.5, 0.34);
      releases[i].push({ x0, y0, x, y, seconds: 0.18 });
    }
  }
});
addEventListener('keyup', e => {
  if (e.key === ' ') {
    if (kb.chargeAt !== null && inPlay() && s.kind === 'launch') releases[keySide()].push({ seconds: (performance.now() - kb.chargeAt) / 1000 });
    kb.held = false; kb.chargeAt = null;
  }
  kb.keys.delete(e.key);
});
function moveKeys() {
  const v = 1.6 * DT;
  if (kb.keys.has('ArrowLeft')) kb.px -= v; if (kb.keys.has('ArrowRight')) kb.px += v;
  if (kb.keys.has('ArrowUp')) kb.py -= v; if (kb.keys.has('ArrowDown')) kb.py += v;
  kb.px = Math.max(0.1, Math.min(0.9, kb.px)); kb.py = Math.max(0.06, Math.min(0.9, kb.py));
}

function clearInput() {
  pointers.clear();
  for (const list of [...pending, ...releases, kb.pads]) list.length = 0;
  kb.held = false; kb.chargeAt = null; kb.tap = 0; kb.keys.clear();
}
addEventListener('resize', layout);
layout();

// ---------------------------------------------------------------- matches
function start(strength) {
  closeLink();
  solo = strength; matchNo++;
  const seedValue = query.has('seed') ? (Number(query.get('seed')) >>> 0) + seedNo++ : (crypto.getRandomValues(new Uint32Array(1))[0] || 1);
  s = createMatch({ seed: seedValue, only: ONLY, first: save.matches === 0 ? 'tug' : null, intro: FAST ? 1 : undefined });
  bot = solo ? makeBot(solo, seedValue ^ 0x5bd1e995) : null;
  clearInput();
  ready = [false, false]; fx = []; texts = []; confetti = 0; acc = 0; paused = false; lastBeep = -1;
  screen = 'play'; show('play');
  snd.unlock(); snd.release();
  rec.start({ solo: !!solo, strength: solo, only: ONLY, first: s.first });
}
function endMatch() {
  const w = s.winner;
  save.matches++;
  if (link) return endLinkMatch(w);
  let line = ['', ''];
  if (solo) {
    const r = save.solo[solo];
    if (w === 0) { r.won++; r.run++; r.best = Math.max(r.best, r.run); } else r.run = 0;
    const st = '★'.repeat(starsOf(solo)) + '☆'.repeat(3 - starsOf(solo));
    line[0] = w === 0 ? (r.run >= 2 ? `${r.run} in a row! ${st}` : st) : st;
  } else {
    const f = save.friend;
    if (w < 0) { f.side = -1; f.run = 0; }
    else { if (f.side === w) f.run++; else { f.side = w; f.run = 1; } f.best = Math.max(f.best, f.run); }
    if (w >= 0) line[w] = f.run >= 2 ? `${f.run} in a row!` : f.best >= 2 ? `Best run: ${f.best}` : '';
  }
  store();
  rec.end(solo ? (w === 0 ? 'won' : 'lost') : 'played', { score: s.score.slice(), winner: w, solo: !!solo, strength: solo, duels: s.duels.length, run: solo ? save.solo[solo].run : save.friend.run });
  for (const i of [0, 1]) {
    $(`endT${i}`).textContent = w < 0 ? 'Draw!' : w === i ? (solo && i === 1 ? 'Bot wins' : 'You win!') : 'So close!';
    $(`endL${i}`).textContent = line[i];
    $(`re${i}`).classList.remove('ready'); $(`re${i}`).textContent = 'Rematch';
  }
  $('half1').classList.toggle('ghost', !!solo);
  ready = [false, !!solo]; // the bot is always ready
  screen = 'end'; show('end');
  confetti = calm ? 40 : 160; burst(w);
  voice.win();
}
function rematch(i) {
  if (screen !== 'end') return;
  if (link) { // my vote goes to the friend; the host starts the next match when both have voted
    if (i !== 0 || !['match', 'meeting'].includes(link.f.state)) return;
    link.f.again(); $('re0').classList.add('ready'); $('re0').textContent = 'Ready!'; voice.ready();
    return;
  }
  ready[i] = true; $(`re${i}`).classList.add('ready'); $(`re${i}`).textContent = 'Ready!';
  voice.ready();
  if (ready[0] && ready[1]) setTimeout(() => { if (screen === 'end') start(solo); }, 250);
}
function toMenu() {
  if (s && !s.over) rec.end('left', { score: s.score.slice(), solo: !!solo, strength: solo, duels: s.duels.length, ...(link ? { link: true } : {}) });
  closeLink();
  s = null; screen = 'menu'; paused = false; snd.release(); pointers.clear(); menu(); show('menu');
}
function pause() {
  if (screen !== 'play' || paused) return;
  // By link the duel cannot stop for one phone: the card opens, this thumb lets go, and the match goes on.
  $('linkPauseLine').hidden = !link;
  paused = true; clearInput(); show('paused'); snd.hold();
}
function resume() { if (!paused) return; paused = false; screen = 'play'; show('play'); snd.release(); }
onLeave(pause);

// ---------------------------------------------------------------- playing a friend by link (friend.js, net.js, kit lockstep)
// Each phone runs the same seeded match; a tick is stepped once both thumbs' inputs for it are here. Portable maths
// (kit/samemath.js) while linked, so an iPhone and an Android compute the same duel; the plain Math otherwise, as before.
const WAIT_SHOW = 300, WAIT_HIDE = 500, WAIT_OFFER = 10000, GUEST_OFFER = 15000;
function openFriend(code, role) {
  closeLink(); s = null; solo = null;
  const seedFor = query.has('seed') ? () => (Number(query.get('seed')) >>> 0) + seedNo++ : undefined;
  link = { me: role === 'host' ? 0 : 1, m: null, acc: 0, since: performance.now(), stalledAt: null, clearAt: 0, wait: false, stalls: 0, matches: 0 };
  link.f = friendLink({ role, onGo: startLink, onAgain: friendReady, onLeft: () => endLink('friendLeft'), onState: friendState,
    only: ONLY, intro: FAST ? 1 : 0, ...(seedFor ? { newSeed: seedFor } : {}) });
  $('fHost').hidden = role !== 'host'; $('fCode').textContent = code; $('fNote').textContent = '';
  $('fJoin').value = role === 'host' ? '' : code; $('fFallback').hidden = true;
  screen = 'friend'; show('friend');
  link.f.open(code);
  friendState(link.f.state);
}
function closeLink() {
  if (link) { link.f.leave(); link = null; }
  flip = false; useMath(Math); $('wait').hidden = true;
}
const STATUS = { off: 'connecting', connecting: 'connecting', alone: 'waitingFriend', meeting: 'friendHere', match: 'friendHere', lost: 'connecting',
  failed: 'unreachable', full: 'full', closed: 'elsewhere', version: 'version', left: 'friendLeft' };
const STUCK = ['failed', 'full', 'closed', 'version'];
function friendState(state) {
  if (!link) return;
  if (link.m && STUCK.includes(state)) return endLink('unreachable');
  $('fStatus').textContent = tr(STATUS[state] ?? 'connecting');
  if (STUCK.includes(state)) $('fFallback').hidden = false;
}
function startLink(go, ls) {
  if (!link) return;
  useMath(sameMath); flip = link.me === 1; matchNo++; link.matches++;
  s = createMatch({ seed: go.seed, only: go.only, first: go.first, intro: go.intro || undefined, kinds: FRIEND_KINDS });
  solo = null; bot = null;
  link.m = { ls, s, me: link.me, onTick };
  link.acc = 0; link.stalledAt = null; link.wait = false;
  clearInput();
  ready = [false, false]; fx = []; texts = []; confetti = 0; acc = 0; paused = false; lastBeep = -1;
  $('wait').hidden = true;
  screen = 'play'; show('play');
  snd.unlock(); snd.release();
  rec.start({ solo: false, link: true, only: go.only, first: s.first });
}
function onTick() { // after each stepped tick, on both phones alike
  for (const e of s.events) handle(e);
  s.events.length = 0;
  if (s.phase === 'intro') { const n = Math.ceil(s.timer); if (n !== lastBeep && n >= 1 && n <= 3) { lastBeep = n; voice.beep(n); } }
  else lastBeep = -1;
  if (s.over) link.m.ls.check(link.m.ls.tick, stateHash(s)); // the last word: both phones compare the finished match
}
function endLinkMatch(w) { // my half of the end card only; the friend sees theirs on their own phone
  store(); paused = false;
  rec.end('played', { score: s.score.slice(), winner: w, solo: false, link: true, duels: s.duels.length });
  const me = link.me;
  $('endT0').textContent = w < 0 ? 'Draw!' : w === me ? 'You win!' : 'So close!';
  $('endL0').textContent = link.f.peerReady ? tr('friendReady') : '';
  $('re0').classList.remove('ready'); $('re0').textContent = 'Rematch';
  $('half1').classList.add('ghost');
  ready = [false, false]; $('wait').hidden = true;
  screen = 'end'; show('end');
  confetti = calm ? 40 : 160; burst(w);
  voice.win();
}
function friendReady() { if (screen === 'end' && link) $('endL0').textContent = tr('friendReady'); }
function endLink(key) { // the link is over: the friend left, could not be reached, or the phones disagreed
  if (!link) return;
  if (s && !s.over) rec.end('left', { score: s.score.slice(), solo: false, link: true, duels: s.duels.length, why: key });
  closeLink(); s = null; paused = false; snd.release();
  $('goneLine').textContent = tr(key);
  screen = 'gone'; show('gone');
}
function linkFrame(now, dt) {
  const L = link;
  L.f.pump(now);
  if (link !== L) return;
  if (L.m && s && !s.over && screen === 'play') {
    const r = drive(L.m, Math.min(0.1, L.acc + dt), () => { moveKeys(); return inputFor(L.me); });
    if (link !== L) return;
    L.acc = r.acc;
    const waited = L.m.ls.waited(now, r.stalled);
    if (r.stalled) { if (L.stalledAt === null) { L.stalledAt = now; L.stalls++; } L.clearAt = now; }
    else L.stalledAt = null;
    if (r.stalled && waited >= WAIT_SHOW) L.wait = true;
    else if (!r.stalled && now - L.clearAt >= WAIT_HIDE) L.wait = false;
    $('wait').hidden = !L.wait;
    if (L.wait) {
      $('waitLine').textContent = tr(L.f.state === 'lost' ? 'slow' : 'waitBanner');
      $('waitButtons').hidden = waited < WAIT_OFFER;
    }
  }
  if (L.m?.ls.mismatch !== null && L.m?.ls.mismatch !== undefined) return endLink('outOfStep');
  if (L.m && s?.over && screen === 'play') endMatch();
  // A guest whose host has not turned up: keep waiting, and offer the bot.
  if (!L.m && screen === 'friend' && L.f.role === 'guest' && now - L.since >= GUEST_OFFER) $('fFallback').hidden = false;
}
function toBot() { closeLink(); s = null; paused = false; menu(); screen = 'solo'; show('solo'); }
$('toFriend').addEventListener('click', () => { snd.unlock(); openFriend(newCode(), 'host'); });
$('fShare').addEventListener('click', async () => {
  if (!link) return;
  const code = link.f.code, how = await share(code, tr('shareText'));
  $('fNote').textContent = how === 'copied' ? tr('linkCopied') : how === 'shown' ? `${tr('linkShown')} ${linkFor(code)}` : '';
});
$('fJoinForm').addEventListener('submit', e => {
  e.preventDefault();
  const code = cleanCode($('fJoin').value);
  if (code) { $('fJoin').blur(); openFriend(code, 'guest'); }
});
$('fJoin').addEventListener('input', () => { const v = $('fJoin').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (v !== $('fJoin').value) $('fJoin').value = v; });
$('fRetry').addEventListener('click', () => { if (link) openFriend(link.f.code, link.f.role); });
for (const id of ['fBot', 'goneBot', 'waitBot']) $(id).addEventListener('click', toBot);
$('fBack').addEventListener('click', () => { closeLink(); menu(); screen = 'menu'; show('menu'); });
$('goneMenu').addEventListener('click', toMenu);
$('waitMenu').addEventListener('click', toMenu);

// ---------------------------------------------------------------- cards
function menu() {
  for (const n of [1, 2]) $(`sound${n}`).textContent = `Sound: ${save.sound ? 'on' : 'off'}`;
  const f = save.friend;
  // The first screen shows one short line: the streak once there is one; before that the keyboard line on a
  // computer, the tagline on a phone.
  $('deskLine').hidden = !!(f.best >= 2);
  const streak = f.best >= 2 ? `Best run: ${f.best} wins in a row` : '';
  $('streakLine').textContent = streak;
  $('streakLine').hidden = !streak;
  $('tagline').hidden = !!streak;
  for (const b of document.querySelectorAll('[data-level]')) {
    const l = b.dataset.level, n = starsOf(l);
    b.disabled = !open(l);
    b.querySelector('.stars').innerHTML = open(l) ? '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>` : '🔒';
  }
}
$('play').addEventListener('click', () => start(null));
$('toSolo').addEventListener('click', () => { menu(); screen = 'solo'; show('solo'); });
for (const b of document.querySelectorAll('[data-level]')) b.addEventListener('click', () => { if (open(b.dataset.level)) start(b.dataset.level); });
document.querySelector('#solo .back').addEventListener('click', () => { screen = 'menu'; show('menu'); });
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', toMenu);
$('endMenu').addEventListener('click', toMenu);
for (const i of [0, 1]) $(`re${i}`).addEventListener('click', () => rematch(i));
for (const n of [1, 2]) $(`sound${n}`).addEventListener('click', () => { save.sound = !save.sound; store(); menu(); if (save.sound) { snd.unlock(); voice.ready(); } });

// ---------------------------------------------------------------- effects
function ring(x, y, i) { fx.push({ t: 'ring', x, y, r: 8, life: 0.45, max: 0.45, color: cols(i)[1] }); }
function sparks(x, y, color, n = 12, speed = 260) {
  if (calm) n = Math.ceil(n / 3);
  for (let j = 0; j < n; j++) { const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.8); fx.push({ t: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + Math.random() * 3.5, life: 0.5 + Math.random() * 0.4, max: 0.9, color }); }
}
function say(i, text, color, y = 0.3, size = 30) { texts.push({ side: i, text, color, y, size, life: 1.1, max: 1.1 }); }
function burst(w) { // confetti from the middle toward the winner's side
  const dir = w === 1 ? -1 : 1;
  const palette = w < 0 ? [...C.warm, ...C.cool, C.gold] : [...cols(w), C.gold, '#fff'];
  for (let j = 0; j < confetti; j++) {
    const a = (Math.random() - 0.5) * 1.6, v = 300 + Math.random() * 600;
    fx.push({ t: 'conf', x: W / 2 + (Math.random() - 0.5) * W * 0.6, y: cy, vx: Math.sin(a) * v * 0.6, vy: dir * Math.cos(a) * v * (w < 0 ? (Math.random() < 0.5 ? 1 : -1) : 1), r: 4 + Math.random() * 4, spin: Math.random() * TAU, vs: (Math.random() - 0.5) * 18, life: 2.6 + Math.random(), max: 3.5, color: palette[j % palette.length], g: dir * 260 });
  }
}
function hitShake(n) { if (!calm) shake = Math.max(shake, n); }

function handle(e) {
  const d = s.d;
  switch (e.e) {
    case 'go': voice.beep(0); flash = [0.5, 0.5]; break;
    case 'pull': voice.pull(e.side); { const [x, y] = P(0.5, (e.side === 0 ? 1 : -1) * 0.82 + d.p * 0.6); sparks(x, y, C.rope, 4, 120); } break;
    case 'lit': voice.lit(); flash = [0.8, 0.8]; break;
    case 'shot': voice.shot(); { const [x, y] = P(0.5, e.side === 0 ? 0.55 : -0.55); sparks(x, y, C.gold, 22, 380); say(e.side, `${e.ms} ms`, C.gold, 0.76, 22); } hitShake(5); break;
    case 'early': voice.early(); say(1 - e.side, 'Too soon!', '#ff6b6b', 0.3, 30); break;
    case 'tie': case 'early-both': case 'void': voice.soft(); for (const i of [0, 1]) say(i, e.e === 'void' ? 'Too slow!' : e.e === 'tie' ? 'Tie!' : 'Too soon!', C.cream, 0.3, 28); break;
    case 'shove': voice.shove(); { const [x, y] = P(0.5, d.c); sparks(x, y, '#c8e6a0', 10, 220); } hitShake(4); break;
    case 'whiff': voice.whiff(); say(1 - e.side, 'Dodged!', cols(1 - e.side)[1], 0.3, 28); break;
    case 'catch': voice.catch(); { const [x, y] = P(e.x, e.y); sparks(x, y, '#e8ff8a', 20, 300); } flash[e.side] = 0.6; break;
    case 'miss': voice.miss(); break;
    case 'appear': voice.appear(); break;
    case 'hit': voice.hit(e.power); { const pk = d.puck, [x, y] = P(pk.x, pk.y); sparks(x, y, '#fff', 3 + Math.round(e.power * 8), 200); } if (e.power > 0.6) hitShake(3); break;
    case 'wall': voice.wall(); break;
    case 'goal': voice.goal(); { const [x, y] = P(0.5, e.side === 0 ? -1 : 1); sparks(x, y, cols(e.side)[0], 30, 420); } say(e.side, 'Goal!', cols(e.side)[1], 0.3, 34); hitShake(9); flash[e.side] = 0.6; break;
    case 'show': voice.show(e.pad); break;
    case 'answer': voice.beep(1); break;
    case 'pad': voice.pad(e.pad, e.ok); if (e.ok) { const pd = PADS[e.pad], [x, y] = e.side === 0 ? P(pd.x, pd.y) : P(1 - pd.x, -pd.y); sparks(x, y, C.pads[e.pad], 8, 200); } else hitShake(3); break;
    case 'round': voice.round(); if (e.side >= 0) { say(e.side, 'Got it!', C.gold, 0.2, 28); flash[e.side] = 0.5; } else for (const i of [0, 1]) say(i, 'Again!', C.cream, 0.2, 26); break;
    case 'fall': voice.fall(); { const [x, y] = e.side === 0 ? P(0.5 + e.dir * 0.42, 0.6) : P(0.5 - e.dir * 0.42, -0.6); sparks(x, y, '#bfefff', 14, 240); } break;
    case 'back': voice.back(); break;
    case 'stroke': voice.tap(e.side); break;
    case 'launch': e.points ? voice.back() : voice.miss(); break;
    case 'point':
      kb.chargeAt = null;
      if (e.winner >= 0) { voice.point(); flash[e.winner] = 1; sparks(...pipAt(e.winner, s.score[e.winner] - 1), C.gold, 26, 320); hitShake(6); }
      else voice.draw();
      rec.event('duel', { kind: e.kind, winner: e.winner, ms: Math.round(e.t * 1000), solo: !!solo });
      break;
  }
}

// ---------------------------------------------------------------- the loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (link) linkFrame(now, dt);
  else if (screen === 'play' && !paused && s) {
    acc += dt;
    while (acc >= DT && !s.over) {
      moveKeys();
      const inputs = [inputFor(0), solo ? bot.act(s, 1) : inputFor(1)];
      if (solo) pending[1].length = 0;
      step(s, inputs);
      for (const e of s.events) handle(e);
      s.events.length = 0;
      if (s.phase === 'intro') { const n = Math.ceil(s.timer); if (n !== lastBeep && n >= 1 && n <= 3) { lastBeep = n; voice.beep(n); } }
      else lastBeep = -1;
      acc -= DT;
    }
    if (s.over) endMatch();
  }
  tick(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}
function tick(dt) {
  for (const p of fx) {
    p.life -= dt;
    if (p.t === 'dot') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
    if (p.t === 'ring') p.r += 220 * dt;
    if (p.t === 'conf') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.985; p.spin += p.vs * dt; }
  }
  fx = fx.filter(p => p.life > 0);
  for (const t of texts) t.life -= dt;
  texts = texts.filter(t => t.life > 0);
  shake = Math.max(0, shake - dt * 30);
  flash = flash.map(f => Math.max(0, f - dt * 1.6));
}

// ---------------------------------------------------------------- drawing
function draw(t) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (flip) { g.translate(W, H); g.scale(-1, -1); }
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  background(t);
  g.save(); g.translate(sx, sy);
  if (s && s.d) DRAW_KIND[s.kind](s.d, t);
  else if (s) idleBoard(t);
  else titleScene(t);
  if (s && screen !== 'menu') {
    for (const i of [0, 1]) if (flash[i] > 0) { g.fillStyle = cols(i)[1] + Math.round(flash[i] * 50).toString(16).padStart(2, '0'); g.fillRect(0, i === 0 ? cy : 0, W, H / 2); }
    touches();
    if (s.phase === 'intro') intro(t);
    if (s.phase === 'result') result(t);
    strip(t);
  }
  for (const tx of texts) withSide(tx.side, () => {
    const a = Math.min(1, tx.life / 0.3), rise = (1 - tx.life / tx.max) * 0.08, [x, y] = P(0.5, tx.y - rise), sc = 1 + 0.25 * Math.max(0, (tx.life - tx.max + 0.15) / 0.15);
    g.globalAlpha = a; text(tx.text, x, y, tx.size * sc, tx.color); g.globalAlpha = 1;
  });
  g.restore();
  for (const p of fx) {
    const a = Math.max(0, Math.min(1, p.life / Math.min(0.4, p.max)));
    g.globalAlpha = a;
    if (p.t === 'ring') { g.strokeStyle = p.color; g.lineWidth = 3; circle(g, p.x, p.y, p.r); g.stroke(); }
    else if (p.t === 'dot') { g.fillStyle = p.color; circle(g, p.x, p.y, p.r); g.fill(); }
    else if (p.t === 'conf') { g.save(); g.translate(p.x, p.y); g.rotate(p.spin); g.fillStyle = p.color; g.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9); g.restore(); }
    g.globalAlpha = 1;
  }
}
function text(str, x, y, size, color, stroke = C.ink) {
  g.font = `bold ${Math.max(14, size)}px ui-rounded, 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size / 7); g.strokeStyle = stroke; g.strokeText(str, x, y);
  g.fillStyle = color; g.fillText(str, x, y);
}
const STARS = Array.from({ length: 60 }, (_, i) => [((i * 7919) % 997) / 997, ((i * 104729) % 991) / 991, 0.5 + ((i * 31) % 7) / 7]);
function background(t) {
  const top = g.createLinearGradient(0, 0, 0, cy);
  top.addColorStop(0, '#16324a'); top.addColorStop(1, C.night2);
  g.fillStyle = top; g.fillRect(0, 0, W, cy);
  const bot = g.createLinearGradient(0, cy, 0, H);
  bot.addColorStop(0, C.night2); bot.addColorStop(1, '#4a2238');
  g.fillStyle = bot; g.fillRect(0, cy, W, H - cy);
  for (const [x, y, r] of STARS) { g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.5 + x * 40); g.fillStyle = y < 0.5 ? '#bfeee8' : '#ffd8c2'; circle(g, x * W, y * H, r * 1.3); g.fill(); }
  g.globalAlpha = 1;
}
function titleScene(t) {
  // two critters, one each side, glancing at each other
  const [x0, y0] = P(0.5, 0.62), [x1, y1] = P(0.5, -0.62);
  critter(g, x0, y0, k * 0.13, C.warm, { lean: Math.sin(t * 2) * 0.3, squash: Math.max(0, Math.sin(t * 4)) * 0.4 });
  withSide(1, () => critter(g, x0, y0, k * 0.13, C.cool, { lean: Math.sin(t * 2 + 1) * 0.3, squash: Math.max(0, Math.sin(t * 4 + 2)) * 0.4 }));
  void x1; void y1;
}
function idleBoard() {}

// The score strip across the middle: each side's pips at its own right hand, a pause button at the right edge.
function pipAt(i, n) { // screen point of side i's pip n
  const gap = 26, start = W - 64 - (WIN - 1) * gap - 10;
  const x = start + n * gap;
  return i === 0 ? [x, cy] : [W - x, cy];
}
function strip(t) {
  const full = s.phase !== 'play', h = 40;
  if (full) {
    g.fillStyle = '#160f24cc'; g.fillRect(0, cy - h / 2 - 3, W, h + 6);
    g.fillStyle = C.cream; g.fillRect(0, cy - h / 2, W, h);
    g.fillStyle = cols(1)[0]; g.fillRect(0, cy - h / 2, W, 4); g.fillStyle = cols(0)[0]; g.fillRect(0, cy + h / 2 - 4, W, 4);
  } else {
    for (const i of [0, 1]) {
      const [a] = pipAt(i, 0), [b] = pipAt(i, WIN - 1), x0 = Math.min(a, b) - 18, w = Math.abs(b - a) + 36;
      shadow(g, 6, 2); rrect(g, x0, cy - 17, w, 34, 17); g.fillStyle = '#fff4dcdd'; g.fill(); noShadow(g);
      g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
    }
  }
  for (const i of [0, 1]) for (let n = 0; n < WIN; n++) {
    const [x, y] = pipAt(i, n), on = n < s.score[i], c = cols(i);
    if (on) { const pop = s.phase === 'result' && n === s.score[i] - 1 ? 1 + 0.4 * Math.max(0, Math.sin((s.result - s.timer) * 8)) : 1; star(g, x, y, 11 * pop, c[0], C.ink, 2); }
    else { circle(g, x, y, 6); g.fillStyle = c[2] + '55'; g.fill(); g.lineWidth = 2; g.strokeStyle = c[2]; g.stroke(); }
  }
}

// Where every finger is: a soft ring in its owner's colour.
function touches() {
  for (const p of pointers.values()) {
    if (!local(p.side)) continue;
    const [x, y] = P(p.x, p.y), c = cols(p.side);
    g.fillStyle = c[1] + '30'; circle(g, x, y, 34); g.fill();
    g.strokeStyle = c[1] + 'aa'; g.lineWidth = 3; circle(g, x, y, 30); g.stroke();
  }
}

// Between duels: a countdown and a picture of the next duel's control, in each half, facing its player.
function intro(t) {
  const left = s.timer, n = Math.ceil(left), frac = left - Math.floor(left);
  g.fillStyle = '#160f2499'; g.fillRect(0, 0, W, H);
  for (const i of [0, 1]) withSide(i, () => {
    if (!local(i)) return;
    const [x, y] = P(0.5, 0.2);
    const sc = 1 + 0.5 * Math.max(0, frac - 0.75) / 0.25;
    if (n >= 1 && n <= 3) text(String(n), x, y, 52 * sc, cols(i)[0]);
    pictogram(s.kind, (s.intro - left), i);
  });
}
function result(t) {
  const w = s.duels.at(-1)?.winner ?? -1, age = s.result - s.timer;
  for (const i of [0, 1]) withSide(i, () => {
    if (!local(i)) return;
    const [x, y] = P(0.5, 0.42), pop = Math.min(1, age * 5), bob = Math.sin(age * 6) * 4;
    g.save(); g.translate(x, y + bob); g.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    if (w === i) { star(g, 0, -10, 46, C.gold, C.ink, 3); text('+1', 0, -6, 26, C.ink, C.cream); text('Point!', 0, 62, 30, cols(i)[1]); }
    else if (w < 0) text('Draw', 0, 0, 34, C.cream);
    else text('Next one!', 0, 0, 28, C.cream);
    g.restore();
  });
}

// ---------------------------------------------------------------- pictograms (no words): the duel and the thumb's move
function pictogram(kind, t, i) {
  const [cx, cyy] = P(0.5, 0.58), w = Math.min(k * 0.86, 300), h = Math.min(k * 0.46, 160), c = cols(i);
  shadow(g, 16, 6); rrect(g, cx - w / 2, cyy - h / 2, w, h, 22); g.fillStyle = C.cream; g.fill(); noShadow(g);
  g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  const ix = cx - w * 0.22, fx2 = cx + w * 0.22, r = h * 0.28;
  const ctl = CONTROL[kind], beat = (t * 2.2) % 1;
  const drawLit = beat >= 0.6;
  // the duel
  if (kind === 'tug') { g.lineWidth = 9; g.strokeStyle = C.rope; g.beginPath(); g.moveTo(ix, cyy - r * 1.3); g.lineTo(ix, cyy + r * 1.3); g.stroke(); g.lineWidth = 2; g.strokeStyle = C.ropeDark; g.stroke(); const ry = cyy + Math.sin(t * 6) * r * 0.4; star(g, ix, ry, r * 0.35, '#ff6b6b'); }
  if (kind === 'draw') lantern(g, ix, cyy, r * 0.75, drawLit ? 1 : 0, t);
  if (kind === 'sumo') beetle(g, ix, cyy + r * 0.2, r * 0.6, c, { squash: ctl === 'hold' ? 0.5 : 0, t, glow: 1 });
  if (kind === 'catch') firefly(g, ix + Math.sin(t * 3) * r * 0.5, cyy + Math.cos(t * 4) * r * 0.5, r * 0.22, t);
  if (kind === 'hockey') { paddle(g, ix, cyy + r * 0.5, r * 0.5, c); seed(g, ix + Math.sin(t * 3) * r * 0.5, cyy - r * 0.6, r * 0.28, t * 2); }
  if (kind === 'memory') { const lit = Math.floor(t * 2.5) % 4; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], j) => { circle(g, ix + a * r * 0.55, cyy + b * r * 0.55, r * 0.42); g.fillStyle = j === lit ? C.pads[j] : C.pads[j] + '55'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke(); }); }
  if (kind === 'balance') { const tilt = Math.sin(t * 2.5) * 0.18; g.save(); g.translate(ix, cyy + r * 0.4); g.rotate(tilt); leafShape(0, 0, r * 2.4, r * 0.5); g.restore(); drop(g, ix + Math.sin(t * 2.5) * r * 0.4, cyy + r * 0.3, r * 0.3); }
  if (kind === 'swipe') beetle(g, ix, cyy + r * (0.55 - (calm ? 0.5 : beat)), r * 0.53, c, { t: 0 });
  if (kind === 'launch') seed(g, ix, cyy + r * (0.55 - (calm ? 0.5 : beat)), r * 0.5, -Math.PI / 2);
  // the thumb
  if (ctl === 'tap') {
    const tapBeat = kind === 'draw' ? (drawLit ? (beat - 0.6) / 0.4 : 1) : beat;
    const press = tapBeat < 0.2 ? Math.sin(tapBeat / 0.2 * Math.PI) : 0;
    if (tapBeat < 0.55) { g.strokeStyle = c[2]; g.lineWidth = 3; g.globalAlpha = 1 - tapBeat / 0.55; circle(g, fx2, cyy + r * 0.2, 10 + tapBeat * 70); g.stroke(); g.globalAlpha = 1; }
    finger(g, fx2, cyy + r * 0.2 - (1 - press) * 14, r * 1.3, press);
  } else if (ctl === 'hold') {
    const fill = (t % 1.6) / 1.6;
    g.strokeStyle = c[0]; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(fx2, cyy + r * 0.2, r * 0.7, -Math.PI / 2, -Math.PI / 2 + fill * TAU); g.stroke();
    finger(g, fx2, cyy + r * 0.2, r * 1.3, 1);
  } else if (ctl === 'swipe') {
    g.strokeStyle = c[2]; g.lineWidth = 4;
    chevron(fx2, cyy - r * 0.55, r * 0.4);
    const up = calm ? 0.65 : Math.min(1, beat * 1.65);
    finger(g, fx2, cyy + r * (0.56 - 1.02 * up), r * 1.12, up < 1 ? 1 : 0);
  } else if (ctl === 'release') {
    const press = calm ? 1 : beat < 0.77 ? 1 : 0;
    circle(g, fx2, cyy + r * 0.1, r * 0.65); g.strokeStyle = c[2]; g.lineWidth = 4; g.stroke();
    finger(g, fx2, cyy + r * (0.05 + (1 - press) * 0.38), r * 1.1, press);
  } else {
    const dx = Math.sin(t * 3) * r * 0.9;
    g.strokeStyle = c[2]; g.lineWidth = 4; g.lineCap = 'round';
    for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(fx2 + s2 * r * 1.0, cyy - r * 0.1); g.lineTo(fx2 + s2 * r * 1.3, cyy + r * 0.2); g.lineTo(fx2 + s2 * r * 1.0, cyy + r * 0.5); g.stroke(); }
    finger(g, fx2 + dx, cyy + r * 0.2, r * 1.3, 1);
  }
}
function leafShape(x, y, len, wid, fill = C.leaf) {
  g.beginPath(); g.moveTo(x - len / 2, y); g.quadraticCurveTo(x, y - wid * 1.4, x + len / 2, y); g.quadraticCurveTo(x, y + wid * 0.9, x - len / 2, y);
  g.fillStyle = fill; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
  g.beginPath(); g.moveTo(x - len / 2 + 6, y); g.lineTo(x + len / 2 - 6, y - wid * 0.1); g.strokeStyle = C.leafDark; g.lineWidth = 2; g.stroke();
}

// ---------------------------------------------------------------- each duel's scene
const winning = (d, i) => d.winner === i;
function field(color = '#2a3d36', edge = '#e9dcc0') {
  const [x0, y0] = P(0.02, -0.98);
  shadow(g, 18, 6); rrect(g, x0, y0, k * 0.96, k * 1.96, k * 0.08); g.fillStyle = color; g.fill(); noShadow(g);
  g.lineWidth = 4; g.strokeStyle = edge; g.stroke();
}
function chevron(x, y, r) {
  g.beginPath(); g.moveTo(x - r, y + r * 0.45); g.lineTo(x, y - r * 0.45); g.lineTo(x + r, y + r * 0.45); g.stroke();
}
const DRAW_KIND = {
  tug(d, t) {
    field('#2f4a3a');
    for (const i of [0, 1]) withSide(i, () => { // the marks to pull the ribbon past
      const [x0, y] = P(0.08, 0.6), [x1] = P(0.92, 0.6);
      g.setLineDash([10, 8]); g.lineWidth = 4; g.strokeStyle = cols(i)[0]; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
      star(g, x1 - 6, y - 16, 10, cols(i)[0]);
    });
    const off = d.p * 0.6, [rx, top] = P(0.5, -0.95), [, bot2] = P(0.5, 0.95);
    shadow(g, 8, 4); g.lineWidth = 14; g.strokeStyle = C.rope; g.beginPath(); g.moveTo(rx, top); g.lineTo(rx, bot2); g.stroke(); noShadow(g);
    g.lineWidth = 3; g.strokeStyle = C.ropeDark; // the braid slides with the rope
    for (let y = -0.95; y < 0.95; y += 0.06) { const yy = y + ((off % 0.06) + 0.06) % 0.06; if (yy > 0.95) continue; const [, sy2] = P(0.5, yy); g.beginPath(); g.moveTo(rx - 7, sy2 - 4); g.lineTo(rx + 7, sy2 + 4); g.stroke(); }
    const [, ry] = P(0.5, off * TUG.mark), wob = Math.sin(t * 9) * 0.15;
    g.save(); g.translate(rx, ry); g.rotate(wob);
    for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s2 * 22, -18, s2 * 26, 0); g.quadraticCurveTo(s2 * 22, 16, 0, 0); g.fillStyle = '#ff5d73'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke(); }
    circle(g, 0, 0, 7); g.fillStyle = '#ff8fa0'; g.fill(); g.stroke(); g.restore();
    for (const i of [0, 1]) withSide(i, () => {
      const me = i === 0 ? off : -off, [x, y] = P(0.5, Math.min(0.86, 0.82 + me));
      critter(g, x, y, k * 0.1, cols(i), { lean: 0.6 * d.jerk[i] + 0.15, squash: d.jerk[i] * 0.7, happy: winning(d, i), sad: winning(d, 1 - i), t });
      for (const s2 of [-1, 1]) { circle(g, x + s2 * 12, y - k * 0.08, 7); g.fillStyle = cols(i)[1]; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke(); } // paws on the rope
    });
  },
  draw(d, t) {
    field('#26223c');
    const lit = d.st === 'lit' ? 1 : d.st === 'gap' && d.last?.why === 'shot' ? Math.max(0, d.timer / DRAW.gap) : 0;
    const [lx, ly] = P(0.5, 0);
    lantern(g, lx, ly, k * 0.12, lit, t);
    for (const i of [0, 1]) withSide(i, () => {
      const [x, y] = P(0.5, 0.6), won = d.last?.winner === i && d.st === 'gap', early = d.st === 'gap' && d.last?.why === 'early' && d.last.winner === 1 - i;
      critter(g, x, y, k * 0.11, cols(i), { happy: won || winning(d, i), dizzy: early ? 1 : 0, sad: early, t, squash: won ? 0.3 : 0 });
      // a little flag, raised by the flash winner
      const up = won ? 1 : 0, [fx0, fy0] = [x + k * 0.15, y + k * 0.02];
      g.lineWidth = 4; g.strokeStyle = C.ink; g.beginPath(); g.moveTo(fx0, fy0); g.lineTo(fx0, fy0 - k * (0.1 + 0.12 * up)); g.stroke();
      g.beginPath(); g.moveTo(fx0, fy0 - k * (0.1 + 0.12 * up)); g.lineTo(fx0 + k * 0.09, fy0 - k * (0.07 + 0.12 * up)); g.lineTo(fx0, fy0 - k * (0.04 + 0.12 * up)); g.closePath(); g.fillStyle = cols(i)[0]; g.fill(); g.lineWidth = 2; g.stroke();
      for (let n = 0; n < DRAW.need; n++) { const [sx2, sy2] = P(0.42 + n * 0.16, 0.88); if (n < d.wins[i]) star(g, sx2, sy2, 13, C.gold); else { circle(g, sx2, sy2, 7); g.fillStyle = '#ffffff22'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#ffffff55'; g.stroke(); } }
      if (s.phase === 'play' && d.st !== 'gap') {
        text(d.st === 'lit' ? 'Tap now!' : 'Wait for the light', ...P(0.5, 0.31), Math.min(22, k * 0.09), lit ? C.gold : C.cream);
      }
    });
  },
  sumo(d, t) {
    field('#2f4a3a');
    const [mx, my] = P(0.5, 0);
    g.beginPath(); g.ellipse(mx, my, k * 0.46, k * 0.92, 0, 0, TAU); g.fillStyle = '#c9b27a'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#8a6a3a'; g.stroke();
    g.beginPath(); g.ellipse(mx, my, k * 0.4, k * SUMO.edge, 0, 0, TAU); g.lineWidth = 3; g.setLineDash([8, 10]); g.strokeStyle = '#6a4a2a'; g.stroke(); g.setLineDash([]);
    for (const i of [0, 1]) withSide(i, () => {
      const me = i === 0 ? d.c : -d.c, [x, y] = P(0.5, me + 0.17);
      beetle(g, x, y, k * 0.1, cols(i), { squash: d.shove[i] > 0 ? 1 : d.held[i] ? 0.35 : 0, stun: d.stun[i], t, glow: d.held[i] ? 1 : 0 });
      // stamina, at the player's edge
      const [bx0, by0] = P(0.3, 0.95), bw = k * 0.4;
      rrect(g, bx0, by0 - 8, bw, 14, 7); g.fillStyle = '#00000055'; g.fill();
      rrect(g, bx0, by0 - 8, Math.max(14, bw * d.stam[i]), 14, 7); g.fillStyle = d.stam[i] < 0.25 ? '#ff6b6b' : cols(i)[0]; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; rrect(g, bx0, by0 - 8, bw, 14, 7); g.stroke();
    });
  },
  catch(d, t) {
    field('#1c2a30');
    const [ax, ay] = P(0.06, 0), [bx2] = P(0.94, 0);
    const mid = g.createLinearGradient(0, ay - 20, 0, ay + 20); mid.addColorStop(0, '#ffffff00'); mid.addColorStop(0.5, '#ffffff22'); mid.addColorStop(1, '#ffffff00');
    g.fillStyle = mid; g.fillRect(ax, ay - 20, bx2 - ax, 40);
    for (const i of [0, 1]) withSide(i, () => {
      const dim = d.stun[i] > 0;
      for (let n = 0; n < 9; n++) { const [gx, gy] = P(0.08 + n * 0.105, 0.97); g.beginPath(); g.moveTo(gx - 8, gy); g.quadraticCurveTo(gx - 4, gy - 22 - (n % 3) * 6, gx, gy - 30 - (n % 2) * 8); g.quadraticCurveTo(gx + 2, gy - 18, gx + 8, gy); g.fillStyle = cols(i)[2]; g.fill(); }
      // the jar
      const [jx, jy] = P(0.5, 0.78), jw = k * 0.5, jh = k * 0.13;
      rrect(g, jx - jw / 2, jy - jh / 2, jw, jh, 14); g.fillStyle = '#ffffff1a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffffff88'; g.stroke();
      for (let n = 0; n < CATCH.need; n++) { const x = jx - jw / 2 + jw * (n + 0.5) / CATCH.need, y = jy + Math.sin(t * 3 + n) * 3; if (n < d.caught[i]) firefly(g, x, y, 5, t + n); else { circle(g, x, y, 5); g.fillStyle = '#ffffff22'; g.fill(); } }
      if (dim) { const [zx, zy] = P(0.5, 0.45); g.globalAlpha = 0.85; text('z z', zx, zy - Math.sin(t * 4) * 6, 26, '#cfd8ff'); g.globalAlpha = 1; }
    });
    if (d.mode !== 'hidden') { const [x, y] = P(d.x, d.y); firefly(g, x, y, k * 0.022, t); }
  },
  hockey(d, t) {
    field('#1f4a52', '#e9f4f2');
    const [mx, my] = P(0.5, 0);
    g.lineWidth = 3; g.strokeStyle = '#ffffff33'; circle(g, mx, my, k * 0.16); g.stroke();
    g.beginPath(); g.moveTo(...P(0.02, 0)); g.lineTo(...P(0.98, 0)); g.stroke();
    for (const i of [0, 1]) withSide(i, () => {
      const [gx0, gy] = P(0.5 - HOCKEY.goal, 0.985), [gx1] = P(0.5 + HOCKEY.goal, 0);
      g.lineWidth = 10; g.lineCap = 'round'; g.strokeStyle = cols(i)[0]; g.beginPath(); g.moveTo(gx0, gy); g.lineTo(gx1, gy); g.stroke();
      g.lineWidth = 3; g.strokeStyle = '#ffffff22'; g.beginPath(); g.arc(...P(0.5, 1), k * 0.3, Math.PI, TAU); g.stroke();
      for (let n = 0; n < HOCKEY.need; n++) { const [sx2, sy2] = P(0.12 + n * 0.08, 0.9); if (n < d.goals[i]) star(g, sx2, sy2, 11, cols(i)[0]); else { circle(g, sx2, sy2, 6); g.fillStyle = '#ffffff22'; g.fill(); } }
    });
    const pk = d.puck, [px, py] = P(pk.x, pk.y), sp = Math.hypot(pk.vx, pk.vy);
    if (sp > 1) { g.strokeStyle = '#ffffff22'; g.lineWidth = k * HOCKEY.puck * 1.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py); g.lineTo(px - pk.vx * k * 0.05, py - pk.vy * k * 0.05); g.stroke(); }
    if (d.wait > 0) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 14); }
    seed(g, px, py, k * HOCKEY.puck, Math.atan2(pk.vy, pk.vx) || t);
    g.globalAlpha = 1;
    for (const i of [0, 1]) { const p = d.pads[i], [x, y] = P(p.x, p.y); paddle(g, x, y, k * HOCKEY.pad, cols(i)); }
  },
  memory(d, t) {
    field('#2a2440');
    for (const i of [0, 1]) withSide(i, () => {
      const out = d.out?.[i];
      PADS.forEach((pd, j) => {
        const [x, y] = P(pd.x, pd.y), r = k * MEMORY.r, lit = d.lit === j || d.press?.[i]?.pad === j;
        if (lit) { const gl = g.createRadialGradient(x, y, r * 0.5, x, y, r * 1.6); gl.addColorStop(0, C.pads[j] + 'aa'); gl.addColorStop(1, C.pads[j] + '00'); g.fillStyle = gl; circle(g, x, y, r * 1.6); g.fill(); }
        shadow(g, 10, lit ? 2 : 6); circle(g, x, y - (lit ? 0 : 3), r); g.fillStyle = lit ? C.pads[j] : C.pads[j] + (out ? '33' : '66'); g.fill(); noShadow(g);
        g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
        circle(g, x - r * 0.3, y - r * 0.35, r * 0.16); g.fillStyle = '#ffffff55'; g.fill();
      });
      // progress: one dot per light in the sequence
      const len = d.seq.length;
      for (let n = 0; n < len; n++) { const [x, y] = P(0.5 + (n - (len - 1) / 2) * 0.09, 0.1); circle(g, x, y, 7); g.fillStyle = n < d.idx[i] ? C.gold : d.st === 'show' ? '#ffffff22' : '#ffffff44'; g.fill(); }
      for (let n = 0; n < MEMORY.need; n++) { const [sx2, sy2] = P(0.44 + n * 0.12, 0.94); if (n < d.wins[i]) star(g, sx2, sy2, 12, C.gold); else { circle(g, sx2, sy2, 6); g.fillStyle = '#ffffff22'; g.fill(); } }
      if (out) { const [x, y] = P(0.5, 0.54); g.strokeStyle = '#ff6b6b'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 30, y - 30); g.lineTo(x + 30, y + 30); g.moveTo(x + 30, y - 30); g.lineTo(x - 30, y + 30); g.stroke(); }
      if (d.st === 'answer' && !out && d.idx[i] < len) { const [x, y] = P(0.5, 0.54); g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8); circle(g, x, y, 8); g.fillStyle = cols(i)[1]; g.fill(); g.globalAlpha = 1; }
    });
  },
  balance(d, t) {
    field('#22402f');
    const w = 0.38;
    for (const i of [0, 1]) withSide(i, () => {
      const [cx, cy2] = P(0.5, 0.5), tilt = d.tilt[i] * 0.13, len = k * 0.92;
      g.save(); g.translate(cx, cy2); g.rotate(tilt);
      leafShape(0, 0, len, k * 0.07);
      g.fillStyle = '#ffffff22'; rrect(g, -len * w * BALANCE.band / 0.95, -k * 0.09, 2 * len * w * BALANCE.band / 0.95, k * 0.12, 8); g.fill();
      const fall = d.fall[i];
      if (fall <= 0) drop(g, d.x[i] * w * len / 0.95 * 0.95, -k * 0.02, k * 0.045, Math.min(1, Math.abs(d.v[i]) * 0.5));
      else { const u = 1 - fall / BALANCE.fall; g.globalAlpha = Math.max(0, 1 - u * 1.5); drop(g, Math.sign(d.x[i]) * (w * len + u * k * 0.1), -k * 0.02 + u * u * k * 0.5, k * 0.045, 0.3); g.globalAlpha = 1; }
      g.restore();
      // time in the middle so far, as a bar that fills
      const [bx0, by0] = P(0.15, 0.82), bw = k * 0.7, f = Math.min(1, d.score[i] / BALANCE.limit);
      rrect(g, bx0, by0 - 9, bw, 18, 9); g.fillStyle = '#00000055'; g.fill();
      if (f > 0) { rrect(g, bx0, by0 - 9, Math.max(18, bw * f), 18, 9); g.fillStyle = cols(i)[0]; g.fill(); }
      g.lineWidth = 2; g.strokeStyle = C.ink; rrect(g, bx0, by0 - 9, bw, 18, 9); g.stroke();
      const lead = d.score[i] > d.score[1 - i] + 0.05; if (lead) star(g, bx0 + bw + 14, by0, 11, C.gold);
      // the time left, on both sides
      const left = Math.max(0, BALANCE.limit - d.t), [tx, ty] = P(0.5, 0.13);
      text(String(Math.ceil(left)), tx, ty, 22, C.cream);
    });
  },
  swipe(d) {
    field('#273d44');
    for (const i of [0, 1]) withSide(i, () => {
      const [x, y] = P(0.5, SWIPE.start), [, end] = P(0.5, 0.76), width = 0.32 * k;
      rrect(g, x - width / 2, y, width, end - y, 16); g.fillStyle = '#10252b'; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#bbcab766'; g.stroke();
      g.setLineDash([7, 5]); g.lineWidth = 4; g.strokeStyle = C.cream;
      g.beginPath(); g.moveTo(x - width / 2, y + 12); g.lineTo(x + width / 2, y + 12); g.stroke(); g.setLineDash([]);
      g.strokeStyle = cols(i)[0] + '88'; g.lineWidth = 3;
      for (let n = 1; n <= 4; n++) chevron(x, y + (end - y) * n / 5, width * 0.12);
      const progress = d.strokes[i] / SWIPE.need;
      const [, by] = P(0.5, 0.7 - 0.43 * progress);
      beetle(g, x, by, k * 0.06, cols(i), { glow: 1 });
      text(`${d.strokes[i]}/${SWIPE.need}`, ...P(0.5, 0.14), Math.min(25, k * 0.073), cols(i)[1]);
      const prompt = i === keySide() && finePointer.matches ? 'Flick toward center or press ↑' : 'Flick toward center';
      text(prompt, ...P(0.5, 0.87), Math.min(23, k * 0.065), C.cream);
    });
  },
  launch(d) {
    field('#3f3049');
    for (const i of [0, 1]) withSide(i, () => {
      const [x, y] = P(0.22, 0.51), w = k * 0.56, h = k * 0.105;
      const shot = d.shots[i], target = d.targets[shot], last = d.last[i];
      rrect(g, x, y, w, h, 12); g.fillStyle = '#1b1328'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#f7e6c480'; g.stroke();
      if (target !== undefined) {
        const meter = Math.min(1, d.charge[i] / LAUNCH.scale);
        g.save(); rrect(g, x + 2, y + 2, w - 4, h - 4, 10); g.clip();
        g.fillStyle = cols(i)[0]; g.fillRect(x, y, w * meter, h); g.restore();
        const mark = x + w * target / LAUNCH.scale;
        g.strokeStyle = C.gold; g.lineWidth = 4; g.beginPath(); g.moveTo(mark, y - 5); g.lineTo(mark, y + h + 5); g.stroke();
        star(g, mark, y - 14, 8, C.gold);
      }
      const flight = !calm && last ? Math.max(0, 1 - (d.t - last.at) / 0.45) : 0;
      const rise = Math.sin(Math.PI * flight) * (last?.points ? 0.15 : 0.045);
      seed(g, ...P(0.5, 0.25 - rise), k * 0.055, -Math.PI / 2 - flight * TAU);
      const playing = s.phase === 'play';
      text(`${d.scores[i]} pts`, ...P(0.5, playing ? 0.39 : 0.9), Math.min(31, k * 0.08), cols(i)[1]);
      if (!playing) return;
      text(`${shot}/${LAUNCH.shots} shots${last ? ` · +${last.points}` : ''}`, ...P(0.5, 0.72), Math.min(20, k * 0.06), C.cream);
      text(target === undefined ? 'Shots complete' : 'Hold, release at the mark', ...P(0.5, 0.86), Math.min(22, k * 0.065), C.cream);
    });
  },
};

// ---------------------------------------------------------------- first-time help: one copy facing each local player
const hintFor = side => inPlay() && s.kind === 'tug' && s.duels.length === 0 && local(side);
const help = ['bottom', 'top'].map((seat, at) => hint($(`hint-${seat}`).firstElementChild, {
  kind: 'tap', key: 'duel:hint', label: 'Tap!',
  when: () => hintFor(flip ? 1 - at : at), // the copy at the bottom of the glass is for whoever plays there
  played: save.matches > 0,
}));

// ---------------------------------------------------------------- test hook (read-only)
window.duelState = () => {
  const sizes = [...document.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }).filter(v => v > 0); // hidden ones measure 0
  const d = s?.d;
  return {
    screen, paused, solo, matchNo, phase: s?.phase ?? null, kind: s?.kind ?? null, score: s?.score.slice() ?? null, duels: s?.duels.slice() ?? [],
    over: !!s?.over, winner: s?.winner ?? null, timer: s?.timer ?? null, t: s?.t ?? 0, ready: ready.slice(),
    held: [0, 1].map(i => [...pointers.values()].some(p => p.side === i)), pointers: [...pointers.entries()].map(([id, p]) => ({ id, side: p.side })),
    board: { bx, cy, k, W, H }, d: d ? JSON.parse(JSON.stringify({ ...d, box: undefined })) : null,
    save: JSON.parse(JSON.stringify(save)), hint: help[0].shown, sound: save.sound, fx: fx.length,
    flip, link: link ? { state: link.f.state, role: link.f.role, me: link.me, code: link.f.code, id: link.f.go?.id ?? 0, delay: link.f.go?.delay ?? null, rtt: link.f.rtt,
      tick: link.m?.ls.tick ?? 0, mismatch: link.m?.ls.mismatch ?? null, wait: link.wait, stalls: link.stalls, peer: link.f.peer, peerReady: link.f.peerReady,
      hash: s && link.m ? stateHash(s) : null } : null,
    minTouchPx: Math.min(...sizes, s?.kind === 'memory' ? k * MEMORY.r * 2 : Infinity, s?.kind === 'hockey' ? k * HOCKEY.pad * 2 : Infinity),
  };
};

applyWords();
menu();
{ const code = codeFromLink(); if (code) openFriend(code, 'guest'); } // a friend's link joins their room
requestAnimationFrame(frame);
