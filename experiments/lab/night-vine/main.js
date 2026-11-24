import { aim, createBed, prune, tick } from './sim.js';
import { draw } from './art.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { readJson, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { stick } from '../../kit/stick.js';
import { noZoom } from '../../kit/zoom.js';

noZoom();
const el = id => document.getElementById(id);
const field = el('field');
const ctx = field.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saveKey = 'night-vine:save';
const old = readJson(saveKey, {});
const integer = (v, lo, hi, fallback) => Number.isSafeInteger(v) && v >= lo && v <= hi ? v : fallback;
const unlocked = integer(old.unlocked, 1, 10, 1);
const saved = {
  v: 1, unlocked, level: integer(old.level, 1, unlocked, unlocked),
  best: integer(old.best, 0, Number.MAX_SAFE_INTEGER, 0),
  sound: old.sound !== false, look: old.look === 'cobalt' ? 'cobalt' : 'vesper'
};
let storageAvailable = true;
function save() {
  const latest = readJson(saveKey, {});
  saved.unlocked = Math.max(saved.unlocked, integer(latest.unlocked, 1, 10, 1));
  saved.best = Math.max(saved.best, integer(latest.best, 0, Number.MAX_SAFE_INTEGER, 0));
  storageAvailable = writeJson(saveKey, saved);
}
const audio = sound({ on: () => saved.sound });
let s, screen, started, score = 0, cuts = 0, arbourSeed = 0, gesture = null;
let elapsed = 0, previous = null, debt = 0, lastDraw = -1, reveal = 0, snip = null;
const pad = stick(field, { when: () => screen === 'play' && s.status === 'growing', reach: 50, leash: 70, dead: 0.1 });
const show = screens(['pause', 'result'], name => {
  screen = name;
  el('book').inert = name === 'pause';
  el('book').classList.toggle('finished-bed', name === 'result');
  field.inert = name === 'result';
  el('pauseButton').disabled = name === 'result';
  el('beds').hidden = true;
  pad.drop();
  gesture = null;
  previous = null;
  if (name !== 'play') {
    audio.hold();
    el(name === 'result' ? 'next' : 'resume').focus({ preventScroll: true });
  } else audio.release();
});
const label = n => String(n).padStart(2,'0');
const edition = () => s.endless ? 'Endless arbour · Bed ' + label(s.level) : 'Glasshouse · Bed ' + label(s.level) + ' / 10';
function setText(id, value) {
  if (el(id).textContent !== value) el(id).textContent = value;
}
function objective() {
  const shadow = s.flowers.some(f => f.shade > .38);
  const ripe = s.arms.filter(a => a.ripe).length;
  let glyph = 'window', title = 'Reach the window', help = 'Touch the glass to move the lamp.';
  if (shadow) {
    glyph = 'flower'; title = 'Clear the shade'; help = 'Flick across the stem casting shade.';
  } else if (ripe < s.arms.length) {
    glyph = 'grapes';
    title = s.arms.length === 1 ? 'Ripen a bunch' : 'Ripen the grapes · ' + ripe + '/' + s.arms.length;
    help = s.arms.some(a => a.grip >= 0 && !a.ripe)
      ? 'Keep light on the bunch while it ripens.' : 'Lead a shoot to a marked trellis arm.';
  } else if (s.flowers.length) help = 'Keep the flowers below in the light.';
  else if (started) help = 'The tender shoots follow your lamp.';
  setText('goal', title);
  setText('instruction', help);
  const icon = el('goalMark').firstElementChild;
  if (icon.getAttribute('href') !== '#i-' + glyph) icon.setAttribute('href', '#i-' + glyph);
}
function begin(level, endless = false) {
  const seed = endless ? (arbourSeed + Math.imul(level, 65537)) >>> 0 : 8731 + level * 271;
  s = createBed(level, seed, endless);
  started = false; cuts = 0; snip = null; reveal = 0; debt = 0; lastDraw = -1;
  if (!endless && saved.level !== level) { saved.level = level; save(); }
  const target = s.arms[0] ?? s.window;
  el('frame').style.setProperty('--hint-left', target.x / 360 * 100 + '%');
  el('frame').style.setProperty('--hint-top', target.y / 480 * 100 + '%');
  setText('edition', edition());
  objective();
  show('play');
  paint();
}
function endless() {
  arbourSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  score = 0;
  begin(1, true);
}
function markOutcome() {
  if (s.status === 'won') {
    if (s.endless) { score++; saved.best = Math.max(saved.best, score); }
    else {
      saved.unlocked = Math.max(saved.unlocked, Math.min(10, s.level + 1));
      saved.level = Math.min(10, s.level + 1);
    }
    save();
    audio.tone(392,.35,.085,'sine');
    audio.tone(587,.48,.045,'triangle');
  } else audio.tone(196,.45,.06,'sine',-25);
  reveal = elapsed + .85;
}
function result() {
  const won = s.status === 'won';
  setText('resultTitle', won ? (s.level === 10 && !s.endless ? 'The glasshouse blooms' : 'Window reached') : 'The flowers wilted');
  const n = s.arms.length;
  const harvest = n ? n + (n === 1 ? ' ripe bunch' : ' ripe bunches') : 'Bed ' + label(s.level) + ' tended';
  el('finishIcon').setAttribute('href', won ? (n ? '#i-grapes' : '#i-window') : '#i-flower');
  setText('outcome', won ? (s.endless ? 'Beds tended · ' + score + '　 Best · ' + saved.best :
    harvest + (s.flowers.length ? ' · Flowers in bloom' : '')) : 'Prune the stem casting shade over the flowers.');
  if (!storageAvailable) el('outcome').textContent += ' Device storage is unavailable.';
  setText('next', won ? (s.level === 10 && !s.endless ? 'Enter the endless arbour' : 'Tend the next bed') : (s.endless ? 'Plant a new arbour' : 'Replant this bed'));
  const replayLabel = s.endless ? 'Start a new arbour' : 'Replant this bed';
  el('replay').title = replayLabel;
  el('replay').setAttribute('aria-label', replayLabel);
  el('replay').hidden = !won;
  show('result');
}
function pause() {
  if (screen !== 'play') return;
  if (s.status !== 'growing') { result(); return; }
  setText('pausedBed', edition());
  setText('campaign', s.endless ? 'Return to glasshouse' : 'Choose a bed');
  setText('endless', s.endless ? 'Start a new arbour' : 'Endless arbour　∞');
  setText('record', 'Best on this device · ' + saved.best + (saved.best === 1 ? ' bed' : ' beds'));
  buttons();
  show('pause');
}
function buttons() {
  document.body.dataset.look = saved.look;
  setText('ink', saved.look === 'vesper' ? 'Ink · Vesper' : 'Ink · Cobalt');
  setText('sound', saved.sound ? 'Sound on' : 'Sound off');
  el('sound').setAttribute('aria-pressed', String(saved.sound));
}
for (const sheet of document.querySelectorAll('.sheet, #result')) {
  // A release over a newly opened card still belongs to the gardening gesture.
  let pressed = null;
  sheet.addEventListener('pointerdown', e => { pressed = e.target.closest('button'); }, true);
  sheet.addEventListener('pointercancel', () => { pressed = null; }, true);
  sheet.addEventListener('click', e => {
    if (e.detail && e.target.closest('button') !== pressed) e.stopImmediatePropagation();
    pressed = null;
  }, true);
}
el('pauseButton').onclick = pause;
el('resume').onclick = () => show('play');
el('restart').onclick = () => begin(s.level, s.endless);
el('endless').onclick = endless;
el('campaign').onclick = () => {
  if (s.endless) { begin(saved.level); return; }
  el('beds').hidden = !el('beds').hidden;
  for (const b of el('beds').children) b.disabled = Number(b.dataset.level) > saved.unlocked;
};
for (let level = 1; level <= 10; level++) {
  const b = document.createElement('button');
  b.textContent = label(level);
  b.dataset.level = level;
  b.setAttribute('aria-label', 'Tend bed ' + level);
  b.onclick = () => begin(level);
  el('beds').append(b);
}
el('ink').onclick = () => {
  saved.look = saved.look === 'vesper' ? 'cobalt' : 'vesper';
  save(); buttons(); paint();
};
el('sound').onclick = () => {
  saved.sound = !saved.sound;
  save(); buttons();
};
el('next').onclick = () => {
  if (s.status !== 'won') { if (s.endless) endless(); else begin(s.level); }
  else if (s.level === 10 && !s.endless) endless();
  else begin(s.level + 1, s.endless);
};
el('replay').onclick = () => { if (s.endless) endless(); else begin(s.level); };
onLeave(pause);

function point(e) {
  const r = field.getBoundingClientRect();
  return { x: (e.clientX - r.left) * 360/r.width, y: (e.clientY - r.top) * 480/r.height };
}
function place(p) {
  const w = s.window;
  if (!s.endless && s.level === 1 && Math.hypot(p.x-w.x,p.y-w.y) <= 36) aim(s,w.x,w.y);
  else aim(s,p.x,p.y);
}
field.addEventListener('pointerdown', e => {
  if (screen !== 'play' || s.status !== 'growing' || pad.touch?.id !== e.pointerId) return;
  const p = point(e);
  gesture = { id:e.pointerId, p, at:e.timeStamp, lamp:{...s.lamp} };
  if (!started) audio.tone(440,.14,.035,'sine');
  started = true; place(p);
});
field.addEventListener('pointermove', e => {
  if (gesture?.id === e.pointerId && screen === 'play' && s.status === 'growing') place(point(e));
});
function cut(a, b) {
  if (!prune(s,a.x,a.y,b.x,b.y)) return false;
  cuts++; snip = { a,b, at:elapsed };
  audio.noise(.07,.065,2900);
  return true;
}
field.addEventListener('pointerup', e => {
  if (gesture?.id !== e.pointerId) return;
  const {p,at,lamp} = gesture, end = point(e);
  gesture = null;
  if (screen !== 'play' || s.status !== 'growing') return;
  if (e.timeStamp-at <= 320 && Math.hypot(end.x-p.x,end.y-p.y) >= 30 && cut(p,end)) {
    aim(s,lamp.x,lamp.y);
  } else place(end);
});
for (const type of ['pointercancel','lostpointercapture']) field.addEventListener(type, e => {
  if (gesture?.id === e.pointerId) gesture = null;
});
window.addEventListener('keydown', e => {
  if (isPauseKey(e)) {
    if (screen === 'pause') show('play'); else pause();
    e.preventDefault(); return;
  }
  if (screen !== 'play' || s.status !== 'growing') return;
  const p = s.lamp, keys = { ArrowLeft:[-14,0], ArrowRight:[14,0], ArrowUp:[0,-14], ArrowDown:[0,14] };
  if (keys[e.key]) {
    const [dx,dy] = keys[e.key]; place({x:p.x+dx,y:p.y+dy}); started = true; e.preventDefault();
  } else if (e.key.toLowerCase() === 'x') {
    cut({x:p.x-23,y:p.y},{x:p.x+23,y:p.y}); started = true; e.preventDefault();
  }
});
hint(field, {
  kind:'tap', key:'night-vine:hint', when:() => screen === 'play' && !started,
  played: old.unlocked > 1, delay:3100, look:'hand', label:'Touch to move the lamp'
});
function paint() {
  const width = Math.max(1,Math.round(field.clientWidth * Math.min(devicePixelRatio,2)));
  const height = Math.round(width * 4/3);
  if (field.width !== width || field.height !== height) { field.width = width; field.height = height; }
  ctx.setTransform(width/360,0,0,height/480,0,0);
  draw(ctx,s,elapsed,{reduced:reducedMotion.matches,started,look:saved.look});
  if (snip && elapsed-snip.at < .4) {
    ctx.save();
    ctx.globalAlpha = Math.max(0,1-(elapsed-snip.at)/.4);
    ctx.lineWidth = 1.7; ctx.strokeStyle = '#fff5c7'; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(snip.a.x,snip.a.y); ctx.lineTo(snip.b.x,snip.b.y); ctx.stroke();
    ctx.restore();
  }
}
function frame(t) {
  const dt = previous === null ? 0 : Math.min(.2,(t-previous)/1000);
  previous = t;
  if (screen === 'play') {
    elapsed += dt;
    if (started && s.status === 'growing') {
      debt += dt;
      while (debt >= 1/30 && s.status === 'growing') {
        tick(s); debt -= 1/30;
        if (s.status !== 'growing') markOutcome();
      }
    }
    if (elapsed-lastDraw >= 1/30 || lastDraw < 0) {
      paint(); objective(); lastDraw = elapsed;
    }
    if (reveal && elapsed >= reveal) result();
  } else if (screen === 'result' && !reducedMotion.matches) {
    elapsed += dt;
    if (elapsed-lastDraw >= 1/18) { paint(); lastDraw = elapsed; }
  }
  requestAnimationFrame(frame);
}
window.vineState = () => structuredClone({
  screen,started,time:s.time,level:s.level,endless:s.endless,score,cuts,status:s.status,
  lamp:s.lamp,window:s.window,arms:s.arms,flowers:s.flowers,nodes:s.nodes,tips:s.tips,
  best:saved.best,unlocked:saved.unlocked
});
buttons();
begin(saved.level);
requestAnimationFrame(frame);
