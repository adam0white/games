import { aim, createBed, cue, CUE, prune, tick } from './sim.js';
import { draw } from './art.js';
import { sound } from '../kit/audio.js';
import { hint } from '../kit/hint.js';
import { lab } from '../kit/lab.js';
import { isPauseKey, onLeave } from '../kit/pause.js';
import { readJson, writeJson } from '../kit/save.js';
import { screens } from '../kit/screens.js';
import { stick } from '../kit/stick.js';
import { noZoom } from '../kit/zoom.js';
import { t, lang, setLang, apply } from './words.js';

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
// The finger the bed shows (sim.js cue): what it points at, how long the player has been idle, how long a flower
// has been in shade, and when the finger appeared (its motion restarts when it changes).
let shown = null, idle = 0, shaded = 0, cueAt = 0, cueKey = '', planned = null, plannedAt = -1, wonAt = 0;
const rec = lab('vine');
let tally = null;
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
const edition = () => t(s.endless ? 'arbour' : 'glasshouse', { n: label(s.level) });
function setText(id, value) {
  if (el(id).textContent !== value) el(id).textContent = value;
}
const use = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><use href="#i-${id}"/></svg>`;
let stepsKey = '';
function objective() {
  const shadow = s.flowers.some(f => f.shade > .38);
  const ripe = s.arms.filter(a => a.ripe).length;
  let glyph = 'window', title = t('goalWindow');
  if (shadow) { glyph = 'flower'; title = t('goalShade'); }
  else if (ripe < s.arms.length) {
    glyph = 'grapes';
    title = t('goalGrapes');
  }
  setText('goal', title);
  // Progress as pictures: one bunch per trellis arm, filled when ripe, then the window, lit once reached.
  const key = [lang(), started, ...s.arms.map(a => a.ripe ? 2 : a.grip >= 0 ? 1 : 0), s.window.reached,
    ...s.flowers.map(f => f.shade > .38)].join();
  if (key !== stepsKey) {
    stepsKey = key;
    el('steps').innerHTML = s.arms.map(a => use('grapes', a.ripe ? 'done' : a.grip >= 0 ? 'held' : '')).join('') +
      (s.arms.length ? '<i>→</i>' : '') + use('window', s.window.reached ? 'done' : ripe === s.arms.length ? 'held' : '') +
      s.flowers.map(f => use('flower', f.shade > .38 ? 'warn' : 'done')).join('');
    el('steps').setAttribute('aria-label', t('steps', { ripe, arms: s.arms.length, window: t(s.window.reached ? 'windowOpen' : 'windowShut') }));
    el('notice').hidden = started;
  }
  const icon = el('goalMark').firstElementChild;
  if (icon.getAttribute('href') !== '#i-' + glyph) icon.setAttribute('href', '#i-' + glyph);
}
function begin(level, endless = false) {
  const seed = endless ? (arbourSeed + Math.imul(level, 65537)) >>> 0 : 8731 + level * 271;
  s = createBed(level, seed, endless);
  started = false; cuts = 0; snip = null; reveal = 0; debt = 0; lastDraw = -1;
  shown = null; idle = 0; shaded = 0; planned = null; plannedAt = -1; wonAt = 0; stepsKey = '';
  tally = { grips: 0, ripe: 0 };
  rec.start({ level, endless, seed, lang: lang() });
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
  rec.end(s.status, { level: s.level, endless: s.endless, time: Math.round(s.time * 10) / 10, cuts,
    ripe: s.arms.filter(a => a.ripe).length, arms: s.arms.length, nodes: s.nodes.filter(n => n.alive).length, score });
  wonAt = elapsed;
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
  reveal = elapsed + (s.status === 'won' ? 1.2 : .85);
}
function result() {
  const won = s.status === 'won', last = s.level === 10 && !s.endless;
  setText('resultTitle', t(won ? (last ? 'bloomed' : 'reached') : 'wilted'));
  const n = s.arms.length;
  const harvest = n ? (n === 1 ? t('oneBunch') : t('bunches', { n })) : t('tended', { n: label(s.level) });
  el('finishIcon').setAttribute('href', won ? (n ? '#i-grapes' : '#i-window') : '#i-cut');
  setText('outcome', won ? (s.endless ? t('tendedEndless', { n: score, best: saved.best }) :
    last ? t('allBeds') : harvest + (s.flowers.length ? ' · ' + t('inBloom') : '')) : t('goalShade'));
  if (!storageAvailable) el('outcome').textContent += ' ' + t('noStorage');
  setText('next', won ? (last ? t('enterEndless') : t('next')) : (s.endless ? t('newArbour') : t('replant')));
  const replayLabel = s.endless ? t('newArbour') : t('replant');
  el('replay').title = replayLabel;
  el('replay').setAttribute('aria-label', replayLabel);
  el('replay').hidden = !won;
  show('result');
}
function pause() {
  if (screen !== 'play') return;
  if (s.status !== 'growing') { result(); return; }
  pauseText();
  buttons();
  show('pause');
}
function pauseText() {
  setText('pausedBed', edition());
  setText('campaign', t(s.endless ? 'toGlasshouse' : 'choose'));
  setText('endless', s.endless ? t('newArbour') : t('endless') + '　∞');
  setText('record', t('record', { n: saved.best }));
}
function buttons() {
  document.body.dataset.look = saved.look;
  setText('ink', t(saved.look));
  setText('sound', t(saved.sound ? 'soundOn' : 'soundOff'));
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
  b.dataset.bed = level;
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

function point(e, r) {
  return { x: (e.clientX - r.left) * 360/r.width, y: (e.clientY - r.top) * 480/r.height };
}
function dragPoint(e) {
  const r = field.getBoundingClientRect();
  const before = gesture.bounds;
  if (Math.abs(r.left - before.left) > 1 || Math.abs(r.top - before.top) > 1 ||
      Math.abs(r.width - before.width) > 1 || Math.abs(r.height - before.height) > 1) {
    // Moving or resizing the glass can turn a stationary finger into a flick.
    gesture = null;
    pad.drop();
    return null;
  }
  return point(e, r);
}
function place(p) {
  const w = s.window;
  if (!s.endless && s.level === 1 && Math.hypot(p.x-w.x,p.y-w.y) <= 36) aim(s,w.x,w.y);
  else aim(s,p.x,p.y);
}
field.addEventListener('pointerdown', e => {
  if (screen !== 'play' || s.status !== 'growing' || pad.touch?.id !== e.pointerId) return;
  const r = field.getBoundingClientRect();
  const p = point(e, r);
  gesture = { id:e.pointerId, p, at:e.timeStamp, lamp:{...s.lamp}, bounds:r };
  if (!started) { audio.tone(440,.14,.035,'sine'); rec.event('touch', { x: Math.round(p.x), y: Math.round(p.y) }); }
  idle = 0; started = true; place(p);
});
field.addEventListener('pointermove', e => {
  if (gesture?.id !== e.pointerId || screen !== 'play' || s.status !== 'growing') return;
  const p = dragPoint(e);
  if (p) place(p);
});
function cut(a, b) {
  if (!prune(s,a.x,a.y,b.x,b.y)) return false;
  cuts++; snip = { a,b, at:elapsed };
  audio.noise(.07,.065,2900);
  rec.event('cut', { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2), followed: !!shown && shown.kind === 'flick',
    shade: s.flowers.map(f => Math.round(f.shade * 100) / 100) });
  return true;
}
field.addEventListener('pointerup', e => {
  if (gesture?.id !== e.pointerId) return;
  const {p,at,lamp} = gesture, end = dragPoint(e);
  gesture = null;
  if (!end || screen !== 'play' || s.status !== 'growing') return;
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
  idle = 0;
  const p = s.lamp, keys = { ArrowLeft:[-14,0], ArrowRight:[14,0], ArrowUp:[0,-14], ArrowDown:[0,14] };
  if (keys[e.key]) {
    const [dx,dy] = keys[e.key]; place({x:p.x+dx,y:p.y+dy}); started = true; e.preventDefault();
  } else if (e.key.toLowerCase() === 'x') {
    cut({x:p.x-23,y:p.y},{x:p.x+23,y:p.y}); started = true; e.preventDefault();
  }
});
const help = hint(field, {
  kind:'tap', key:'night-vine:hint', when:() => screen === 'play' && !started,
  played: old.unlocked > 1, delay:3100, look:'hand', label:t('tapHint')
});
// The first-time help (kit/hint.js) taps the first window; until it is put away, the bed's own finger waits.
const helpPending = () => !!document.querySelector('#frame .kit-hint');
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
  if (s.status !== 'growing') beat(elapsed - wonAt);
  else if (shown && screen === 'play') finger(shown, elapsed - cueAt);
}
// The pointing hand of kit/hint.js, fingertip at (16.5, 3), drawn on the bed in field units.
const HAND = [[12,1,9,32,4.5],[20,17,8.5,17,4.25],[27.5,20,8,15,4],[8,25,28,26,9]];
function hand(x, y, press) {
  const lift = 18 * (1 - press);
  ctx.save();
  ctx.translate(x - 16.5 * .8 + lift * .4, y - 3 * .8 + lift); ctx.scale(.8, .8);
  ctx.shadowColor = '#000c'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#ffffffeb';
  for (const [rx, ry, w, h, r] of HAND) { ctx.beginPath(); ctx.roundRect(rx, ry, w, h, r); ctx.fill(); }
  ctx.translate(6, 40); ctx.rotate(-32 * Math.PI / 180);
  ctx.beginPath(); ctx.roundRect(-4, -13, 8, 17, 4); ctx.fill();
  ctx.restore();
}
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
// The bed's own finger: a tap on the next goal, or a quick flick across the stem that shades a flower.
function finger(c, age) {
  const still = reducedMotion.matches;
  ctx.save();
  ctx.globalAlpha = Math.min(1, age / .4);
  if (c.kind === 'tap') {
    const u = still ? .5 : (age % 1.7) / 1.7;
    const press = still ? 1 : u < .3 ? ease(u / .3) : u < .45 ? 1 : 1 - ease((u - .45) / .2);
    const ring = still ? .3 : Math.max(0, (u - .3) / .5);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(255,255,255,${.85 * (1 - ring)})`;
    ctx.beginPath(); ctx.arc(c.at.x, c.at.y, 12 + 22 * ring, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff66';
    ctx.beginPath(); ctx.arc(c.at.x, c.at.y, 16, 0, Math.PI * 2); ctx.stroke();
    hand(c.at.x, c.at.y, press);
  } else {
    const u = still ? .7 : (age % 1.9) / 1.9;
    const go = still ? 1 : ease((u - .3) / .22), press = still ? 1 : u < .25 ? ease(u / .25) : u < .6 ? 1 : 1 - ease((u - .6) / .15);
    const x = c.from.x + (c.to.x - c.from.x) * go, y = c.from.y + (c.to.y - c.from.y) * go;
    ctx.setLineDash([3, 5]); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff70';
    ctx.beginPath(); ctx.moveTo(c.from.x, c.from.y); ctx.lineTo(c.to.x, c.to.y); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 3.2; ctx.strokeStyle = '#fff5c7';
    ctx.beginPath(); ctx.moveTo(c.from.x, c.from.y); ctx.lineTo(x, y); ctx.stroke();
    if (go >= 1 && u < .8) {
      // A small burst where the stem parts.
      const mx = (c.from.x + c.to.x) / 2, my = (c.from.y + c.to.y) / 2;
      ctx.strokeStyle = '#ffe4a6'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + .3;
        ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 6, my + Math.sin(a) * 6); ctx.lineTo(mx + Math.cos(a) * 11, my + Math.sin(a) * 11); ctx.stroke();
      }
    }
    hand(x, y, press);
  }
  ctx.restore();
}
// The end of a bed: the window throws light across the glass; a wilted bed goes dark.
function beat(age) {
  const u = Math.min(1, age / 1.1);
  ctx.save();
  if (s.status === 'won') {
    const w = s.window, last = s.level === 10 && !s.endless;
    const r = 30 + (last ? 420 : 160) * ease(u);
    const glow = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
    glow.addColorStop(0, `rgba(255,236,180,${.55 * (1 - u * .4)})`); glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 360, 480);
    ctx.strokeStyle = `rgba(255,240,200,${.8 * (1 - u)})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8 + age * .4, d = 26 + 70 * ease(u);
      ctx.beginPath(); ctx.moveTo(w.x + Math.cos(a) * d * .6, w.y + Math.sin(a) * d * .6); ctx.lineTo(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d); ctx.stroke();
    }
    for (const a of s.arms) {
      ctx.fillStyle = `rgba(255,230,190,${.9 * (1 - u)})`;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(a.x + Math.cos(i * 1.3 + age * 3) * 14 * u, a.y + 18 - 30 * u + Math.sin(i * 2.1) * 6, 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
    if (last) for (let i = 0; i < 26; i++) {
      const px = (i * 53 % 360) + Math.sin(age * 1.3 + i) * 10, py = 470 - ((age * 60 + i * 37) % 470);
      ctx.fillStyle = i % 2 ? '#f2c4b3cc' : '#fff0c4cc';
      ctx.beginPath(); ctx.ellipse(px, py, 3, 1.8, i + age, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = `rgba(16,18,30,${.45 * ease(u)})`; ctx.fillRect(0, 0, 360, 480);
  }
  ctx.restore();
}
// Which finger to show. The plan is worked out four times a second; the finger stays put while the goal holds.
function steer(dt) {
  if (s.status !== 'growing') { shown = null; return; }
  idle += dt;
  shaded = s.flowers.some(f => f.shade > .38) ? shaded + dt : 0;
  if (elapsed - plannedAt >= .25 || plannedAt < 0) { planned = cue(s); plannedAt = elapsed; }
  let next = null;
  if (planned && !(!started && helpPending())) {
    if (planned.kind === 'flick' && shaded >= CUE.flickAfter) next = planned;
    else if (planned.kind === 'tap' && idle >= CUE.tapIdle) next = planned;
  }
  const key = !next ? '' : next.kind === 'tap' ? 'tap' + Math.round(next.at.x / 12) + ':' + Math.round(next.at.y / 12) : 'flick';
  if (key !== cueKey) {
    cueKey = key; cueAt = elapsed; shown = next;
    if (next) rec.event('cue', { kind: next.kind });
  } else if (next && next.kind === 'flick') shown = shown ?? next;
}
function frame(now) {
  const dt = previous === null ? 0 : Math.min(.2,(now-previous)/1000);
  previous = now;
  if (screen === 'play') {
    elapsed += dt;
    if (started && s.status === 'growing') {
      debt += dt;
      while (debt >= 1/30 && s.status === 'growing') {
        tick(s); debt -= 1/30;
        noteProgress();
        if (s.status !== 'growing') markOutcome();
      }
    }
    steer(dt);
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
// A few choices that matter, for the lab: a tendril catching, a bunch ripening, the window reached.
function noteProgress() {
  const grips = s.arms.filter(a => a.grip >= 0).length, ripe = s.arms.filter(a => a.ripe).length;
  if (grips > tally.grips) rec.event('grip', { n: grips });
  if (ripe > tally.ripe) rec.event('ripe', { n: ripe });
  if (s.window.reached && !tally.window) rec.event('window', { t: Math.round(s.time * 10) / 10 });
  Object.assign(tally, { grips, ripe, window: s.window.reached });
}
// Recording notice on the bed before the first touch; its switch on the pause card. Words follow the language.
const notice = rec.notice(el('notice'));
const recordToggle = rec.toggle(el('recordSlot'));
function recordText() {
  const box = recordToggle?.querySelector('input');
  if (notice) {
    notice.firstChild.data = t(box && !box.checked ? 'recordingOff' : 'recordingOn') + ' ';
    notice.querySelector('a').textContent = t('privacy');
  }
  if (recordToggle) recordToggle.lastChild.data = ' ' + t('recordingToggle');
}
recordToggle?.querySelector('input').addEventListener('change', recordText);
addEventListener('storage', recordText);
function translatePage() {
  document.title = t('title');
  apply();
  for (const b of el('beds').children) b.setAttribute('aria-label', t('bed', { n: b.dataset.bed }));
  for (const b of document.querySelectorAll('.language')) b.lastElementChild.textContent = t('lang');
  document.getElementById('notes-button')?.setAttribute('aria-label', t('notes'));
  const words = document.querySelector('.kit-hint .label');
  if (words) words.textContent = t('tapHint');
  recordText(); buttons(); pauseText(); setText('edition', edition());
  stepsKey = ''; objective();
  if (screen === 'result') result();
}
for (const id of ['langBoard', 'langPause']) {
  const b = el(id);
  b.append(document.getElementById('languageIcon').content.cloneNode(true));
  b.addEventListener('click', () => {
    setLang(lang() === 'en' ? 'tr' : 'en');
    // An explicit ?lang= in the address follows the choice, so a reload keeps it.
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', lang()); history.replaceState(history.state, '', url); }
    rec.event('language', { lang: lang() });
    translatePage();
  });
}
document.addEventListener('DOMContentLoaded', () => document.getElementById('notes-button')?.setAttribute('aria-label', t('notes')), { once: true });
window.vineState = () => structuredClone({
  screen,started,time:s.time,level:s.level,endless:s.endless,score,cuts,status:s.status,
  lamp:s.lamp,window:s.window,arms:s.arms,flowers:s.flowers,nodes:s.nodes,tips:s.tips,
  best:saved.best,unlocked:saved.unlocked,lang:lang(),cue:shown,
  recording:rec.on
});
buttons();
begin(saved.level);
translatePage();
requestAnimationFrame(frame);
