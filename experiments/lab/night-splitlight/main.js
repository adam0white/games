import { sound } from '../../kit/audio.js';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';
import { home } from '../../kit/home.js';
import { lab } from '../../kit/lab.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { shareLink } from '../../kit/room.js';
import { read, readJson, readNumber, write, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';
import { bandColour, draw } from './art.js';
import { controlsOf, denseLights, expose, fed, makeBench, setValue, trace } from './bench.js';
import { dailyLevel, today } from './daily.js';
import { LEVELS } from './levels.js';
import { par as parOf } from './solver.js';
import { lang } from './words.js';

const { t } = lang;
const el = id => document.getElementById(id);
const canvas = el('field'), ctx = canvas.getContext('2d'), slider = el('angle');
const key = 'night-splitlight:';
const look = new URLSearchParams(location.search).get('look') === 'oxide' ? 'oxide' : 'nocturne';
document.documentElement.dataset.look = look;
noZoom();
const COUNT = LEVELS.length;
// The saved plate is the highest unlocked plate, a plain number, as in the first version (1 to 6 then, 1 to 18 now).
const lastPlate = () => Math.min(COUNT, Math.max(1, Math.trunc(readNumber(key + 'plate', 1))));
let high = lastPlate(), audible = read(key + 'sound') !== 'off';
const audio = sound({ on: () => audible });
let level, state, rules, dense, screen, reveal = 0, previous = performance.now(), redraw = true, mode = 'plates';
let parInfo = { par: 1 }, gesture = null, lastKeyTurn = -1e9, nextTickSound = 0;
// Each colour is a pitch of a pentatonic scale on C, red lowest, so any set of receivers sounds as a chord.
const PITCH = [261.63, 293.66, 329.63, 392, 440, 523.25];
// White sounds as an open C major triad on the same pitches as the colours, so it never beats against red.
const WHITE = [261.63, 392, 523.25];
const litCount = () => state.targets.filter(target => target.lit || target.fed).length;
const best = () => { const b = readJson(key + 'best', {}); return b && typeof b === 'object' ? b : {}; };

const show = screens(['paused', 'result'], name => {
  const returningToPlay = name === 'play' && (screen === 'paused' || screen === 'result');
  screen = name;
  document.querySelector('.instrument').inert = name === 'paused';
  el('pause').disabled = name === 'result';
  slider.disabled = name === 'result';
  document.body.classList.toggle('finished', name === 'result');
  previous = performance.now();
  if (returningToPlay) slider.focus({ preventScroll: true });
  else if (name !== 'play') el(name === 'paused' ? 'resume' : 'next').focus({ preventScroll: true });
});

// Play recording for the game lab (kit/lab.js): one run for each plate the player starts to turn. kit/home.js adds
// the way back to /small/ and tells the home how the run ended.
const rec = home(lab('night-splitlight'), { back: ['#paused .card', '#result .pair'] });
let runOpen = false;
function summary() {
  return { level: state.id, mode, day: mode === 'daily' ? today : undefined, captured: litCount(), targets: state.targets.length,
    seconds: Math.round(state.elapsed * 10) / 10, plate: high, turns: state.turns, par: parInfo.par };
}
function runEnd(outcome) {
  if (!runOpen) return;
  runOpen = false;
  rec.end(outcome, summary());
}

// ---------- words ----------
const CONTROL_WORD = { prism: { turn: 'turnPrism', slide: 'slidePrism' }, mirror: { turn: 'turnMirror', slide: 'slideMirror' },
  grating: { turn: 'turnGrating', slide: 'slideGrating' }, lens: { turn: 'turnLens', slide: 'slideLens' } };
const controlWord = ([p, dof]) => {
  const part = level.parts[p];
  if (part.kind === 'prism' && part.cut.length === 3 && part.cut[1] - part.cut[0] === 90 && level.parts.length > 1) return t('turnGlass');
  return t(CONTROL_WORD[part.kind]?.[dof] || 'turnPrism');
};
const dayLabel = () => { try { return new Date(today + 'T12:00:00Z').toLocaleDateString(lang.lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch { return today; } };
function texts() {
  lang.apply();
  document.title = t('title');
  canvas.setAttribute('aria-label', t('canvasAria'));
  el('pause').setAttribute('aria-label', t('pause'));
  if (!state) return;
  el('plate').textContent = mode === 'daily' ? t('dailyPlate', { day: dayLabel() }) : t('plate', { n: String(state.id).padStart(2, '0'), of: String(COUNT).padStart(2, '0') });
  el('plate-name').textContent = mode === 'daily' ? t('dailyName') : t(level.key);
  el('daily').textContent = mode === 'daily' ? t('plates') : t('today');
  el('daily').setAttribute('aria-label', el('daily').textContent);
  el('daily').classList.toggle('done', mode !== 'daily' && dailySave()?.day === today);
  el('dial-label').textContent = controlWord(controlsOf(level)[state.selected]);
  el('sound').textContent = audible ? t('soundOn') : t('soundOff');
  el('sound').setAttribute('aria-pressed', String(audible));
  readout();
}
function readout() {
  el('captured').textContent = litCount() + ' / ' + state.targets.length;
  const counts = { n: state.turns, par: parInfo.par };
  el('turns').replaceChildren(Object.assign(document.createElement('span'), { className: 'long', textContent: t('turns', counts) }),
    Object.assign(document.createElement('span'), { className: 'short', textContent: t('turnsShort', counts) }));
}

// ---------- the parts the dial can move ----------
const ICON = {
  prism: '<path d="M12 4 21 19H3Z"/>', mirror: '<path d="M5 19 19 5"/><path d="M8 20 20 8" opacity=".45"/>',
  grating: '<path d="M6 4v16M10 4v16M14 4v16M18 4v16"/>', lens: '<path d="M12 3c4 4 4 14 0 18c-4-4-4-14 0-18Z"/>',
  slide: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>', glass: '<path d="M5 19V5h0L19 19Z"/>',
};
function chips() {
  const box = el('parts');
  const list = controlsOf(level);
  box.hidden = list.length < 2;
  box.replaceChildren(...(list.length < 2 ? [] : list.map(([p, dof], i) => {
    const part = level.parts[p];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.control = i;
    const glass = part.kind === 'prism' && part.cut.length === 3 && part.cut[1] - part.cut[0] === 90;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[dof === 'slide' ? 'slide' : glass ? 'glass' : part.kind]}</svg>`;
    b.setAttribute('aria-label', controlWord([p, dof]));
    b.onclick = () => select(i);
    return b;
  })));
  markChips();
}
function markChips() {
  for (const b of el('parts').children) {
    const on = Number(b.dataset.control) === state.selected;
    b.setAttribute('aria-pressed', String(on));
  }
  document.body.classList.toggle('teach-parts', controlsOf(level).length > 1 && !read(key + 'parts'));
}
function select(i) {
  if (!state || screen !== 'play' || i === state.selected) return;
  state.selected = i;
  lastKeyTurn = -1e9; // moving another part is another turn
  if (controlsOf(level).length > 1) write(key + 'parts', '1');
  slider.value = Math.round(state.values[i] * 1000);
  el('dial-label').textContent = controlWord(controlsOf(level)[i]);
  markChips();
  redraw = true;
}

// ---------- plates ----------
function dailySave() { const d = readJson(key + 'daily', null); return d && typeof d === 'object' ? d : null; }
function open(next, nextMode = 'plates') {
  if (state) runEnd('quit');
  steering.reset();
  mode = nextMode;
  level = mode === 'daily' ? dailyLevel(today) : LEVELS[next - 1];
  state = makeBench(level);
  parInfo = parOf(level, state.targets, state.start, level.answer);
  retrace();
  reveal = 0;
  redraw = true;
  slider.value = Math.round(state.values[0] * 1000);
  document.body.classList.toggle('guide', mode === 'plates' && state.id === 1);
  document.body.classList.toggle('daily', mode === 'daily');
  chips();
  texts();
  audio.release();
  show('play');
}
function retrace() {
  rules = trace(level, state.values);
  dense = trace(level, state.values, denseLights(level.parts.some(p => p.kind === 'grating') ? 15 : 25), 240);
}
function setControl(i, position) {
  if (screen !== 'play' || state.won) return;
  advance(performance.now());
  if (state.won) return;
  const changed = setValue(state, i, position);
  if (!runOpen && state.started) { runOpen = true; rec.start({ level: state.id, mode, day: mode === 'daily' ? today : undefined }); }
  help.done();
  if (!changed) return;
  // A turn is one gesture that moves a part: a press-and-drag or tap on the dial or the bench, or a run of keys.
  const now = performance.now();
  if (gesture) { if (!gesture.counted) { gesture.counted = true; state.turns++; } }
  else { if (now - lastKeyTurn > 700) state.turns++; lastKeyTurn = now; }
  const before = rules;
  retrace();
  // A soft note sounds when a colour arrives at its receiver.
  if (now >= nextTickSound) {
    for (const target of state.targets) {
      const was = target.fed;
      if (fedNow(target, rules) && !was && !fedNow(target, before)) {
        tone(target.band, .35, .04);
        nextTickSound = now + 90;
        break;
      }
    }
  }
  redraw = true;
  slider.value = Math.round(state.values[state.selected] * 1000);
  slider.setAttribute('aria-valuetext', Math.round(state.values[state.selected] * 100) + '%');
  document.body.classList.toggle('guide', mode === 'plates' && state.id === 1 && state.values[0] < .3);
  readout();
}
const fedNow = (target, field) => fed(target, field.rays, state.elapsed);
function tone(band, dur, vol) {
  if (band < 0) { for (const f of WHITE) audio.tone(f, dur, vol * .6, 'sine'); return; }
  audio.tone(PITCH[band], dur, vol, 'sine');
}
// The chord of a solved bench: every receiver's pitch at once, a low root under it, and an octave shimmer above.
function chord() {
  const notes = new Set();
  for (const target of state.targets) {
    if (target.band < 0) WHITE.forEach(f => notes.add(f)); else notes.add(PITCH[target.band]);
  }
  const list = [...notes].sort((a, b) => a - b);
  audio.tone(65.41 * 2, 2.2, .05, 'sine');
  list.forEach(f => { audio.tone(f, 2.4, .05, 'triangle'); audio.tone(f * 2, 1.4, .012, 'sine'); });
  window.splitlightChord = list;
}

function pause() {
  if (screen !== 'play') return;
  advance(performance.now());
  if (screen !== 'play') return;
  steering.reset();
  audio.hold();
  show('paused');
}
function resume() {
  if (screen !== 'paused') return;
  audio.release();
  show('play');
}
el('pause').onclick = pause;
el('resume').onclick = resume;
onLeave(pause);
addEventListener('keydown', event => {
  if (!isPauseKey(event) || event.repeat || screen === 'result') return;
  event.preventDefault();
  if (screen === 'paused') resume(); else pause();
});
function restart(n, nextMode = mode) { open(n, nextMode); audio.unlock(); }
el('restart').onclick = el('again').onclick = () => restart(state.id, mode);
el('next').onclick = () => {
  if (mode === 'daily') return restart(high, 'plates');
  restart(state.id === COUNT ? 1 : state.id + 1, 'plates');
};
el('first').onclick = () => restart(1, 'plates');
el('daily').onclick = () => { if (screen === 'play') restart(high, mode === 'daily' ? 'plates' : 'daily'); };
el('sound').onclick = () => {
  audible = !audible;
  write(key + 'sound', audible ? 'on' : 'off');
  texts();
};
el('lang').onclick = () => { lang.setLang(lang.lang() === 'tr' ? 'en' : 'tr'); texts(); chips(); };
el('share').onclick = shareResult;

// ---------- input ----------
const openGesture = () => { gesture = { counted: false }; };
const closeGesture = () => { gesture = null; };
slider.addEventListener('pointerdown', () => { audio.unlock(); openGesture(); });
addEventListener('pointerup', closeGesture);
addEventListener('pointercancel', closeGesture);
slider.addEventListener('input', () => { audio.unlock(); setControl(state.selected, Number(slider.value) / 1000); });
canvas.style.touchAction = 'none';
let mouseX = null;
// A tap on a part chooses it; a drag anywhere on the bench moves the chosen part.
function pickPart(event) {
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) * 360 / box.width, y = (event.clientY - box.top) * 400 / box.height;
  const list = controlsOf(level);
  let bestI = -1, bestD = 40;
  for (const part of rules.parts) {
    const i = rules.parts.indexOf(part);
    const d = Math.hypot(part.x - x, part.y - y) - (part.vertices ? (part.r || 55) * .6 : part.len / 2 * .6);
    if (d < bestD && list.some(([p]) => p === i)) { bestD = d; bestI = i; }
  }
  if (bestI < 0) return;
  const mine = list.map(([p], c) => p === bestI ? c : -1).filter(c => c >= 0);
  if (!mine.length) return;
  const nextC = mine.includes(state.selected) ? mine[(mine.indexOf(state.selected) + 1) % mine.length] : mine[0];
  if (nextC !== state.selected && (!mine.includes(state.selected) || mine.length > 1)) select(nextC);
}
let downAt = null;
canvas.addEventListener('pointerdown', event => {
  if (screen !== 'play' || !event.isPrimary || event.button !== 0) { event.stopImmediatePropagation(); return; }
  canvas.setPointerCapture(event.pointerId);
  mouseX = event.clientX;
  downAt = { x: event.clientX, y: event.clientY, moved: false };
  openGesture();
  audio.unlock();
});
canvas.addEventListener('pointermove', event => { if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) downAt.moved = true; });
canvas.addEventListener('pointerup', event => { if (downAt && !downAt.moved && controlsOf(level).length > 1) pickPart(event); downAt = null; });
canvas.addEventListener('lostpointercapture', event => { if (event.isPrimary) steering.drop(); });
const steering = drag(canvas, {
  playing: () => screen === 'play' && !state.won, paused: () => false, resume,
  from: () => state.values[state.selected], travel: dx => dx / (canvas.clientWidth * .7),
  aim: position => {
    setControl(state.selected, position);
    if (position < 0 || position > 1) steering.rebase();
  },
  settle: 0,
  mouse: event => {
    if ((event.buttons & 1) && mouseX !== null) {
      setControl(state.selected, state.values[state.selected] + (event.clientX - mouseX) / (canvas.clientWidth * .7));
      mouseX = event.clientX;
    }
  },
});
const help = hint(document.querySelector('.cue'), {
  kind: 'drag', key: key + 'hint', played: high > 1, delay: 2200, reach: 37,
  when: () => screen === 'play' && mode === 'plates' && state.id === 1 && !state.started,
  label: t('hint'),
});

// ---------- drawing ----------
new ResizeObserver(() => { redraw = true; }).observe(canvas);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function paint(time) {
  const scale = Math.min(devicePixelRatio || 1, 2) * canvas.clientWidth / 360;
  const w = Math.round(360 * scale), h = Math.round(400 * scale);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(w / 360, 0, 0, h / 400, 0, 0);
  const selectedPart = controlsOf(level).length > 1 ? controlsOf(level)[state.selected][0] : -1;
  draw(ctx, state, rules, dense, reducedMotion.matches ? 0 : time, look, selectedPart);
  redraw = false;
}
const moving = () => state.targets.some(target => target.swing) && state.started && !state.won;
const glowing = () => state.won || state.targets.some(target => target.fed) || level.parts.some(p => p.kind === 'grating');

// ---------- results and sharing ----------
const turnWords = n => t(n === 1 ? 'turn1' : 'turnN', { n });
function finishPlate() {
  rec.event('plate-exposed', { level: state.id, mode, seconds: Math.round(state.elapsed * 10) / 10, turns: state.turns, par: parInfo.par });
  let saved = true;
  if (mode === 'daily') {
    const was = dailySave();
    const mine = { day: today, turns: state.turns, par: parInfo.par, seconds: Math.round(state.elapsed * 10) / 10 };
    const same = was?.day === today;
    const keep = same && was.turns <= mine.turns ? { ...was } : { ...mine };
    keep.first = same && was.first ? was.first : same ? { turns: was.turns, seconds: was.seconds } : { turns: mine.turns, seconds: mine.seconds };
    saved = writeJson(key + 'daily', keep);
  } else {
    high = Math.max(high, lastPlate(), Math.min(COUNT, state.id + 1));
    saved = write(key + 'plate', high);
    const b = best();
    if (!(b[state.id] <= state.turns)) { b[state.id] = state.turns; writeJson(key + 'best', b); }
    if (state.id === COUNT) write(key + 'done', '1');
  }
  runEnd('won');
  const secs = (Math.round(state.elapsed * 10) / 10).toFixed(1);
  let line = t('resultLine', { turns: turnWords(state.turns), par: parInfo.par, secs });
  if (state.turns <= parInfo.par) line += ' · ' + t('atPar');
  const parts = [line + '.'];
  const bestToday = dailySave()?.turns;
  if (mode === 'daily' && bestToday < state.turns) parts.push(t('dailyBest', { turns: turnWords(bestToday) }));
  if (!saved) parts.push(t('savedSession'));
  el('result-line').textContent = parts.join(' ');
  chord();
  const finale = mode === 'plates' && state.id === COUNT;
  el('result-title').textContent = mode === 'daily' ? t('dailyExposed') : finale ? t('complete') : t('exposed');
  el('next').textContent = mode === 'daily' ? t('plates') : finale ? t('fromStart') : t('next');
  el('share').hidden = mode !== 'daily';
  el('again').hidden = mode === 'daily';
  slider.disabled = true;
  document.body.classList.remove('guide');
}
function shareLine() {
  const d = dailySave();
  const turns = d?.day === today ? d.turns : state.turns;
  const bar = state.targets.map(target => target.band < 0 ? '⬜' : ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'][target.band]).join('');
  return `${t('shareText', { day: today, turns: turnWords(turns), par: parInfo.par, secs: (Math.round(state.elapsed * 10) / 10).toFixed(1) })} ${bar}`;
}
// The share picture: the solved bench as it looks now, with the day and the result under it (1080 × 1350).
function picture() {
  try {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const g = c.getContext('2d');
    g.fillStyle = '#080f1c'; g.fillRect(0, 0, 1080, 1350);
    g.setTransform(1080 / 360, 0, 0, 1080 / 360, 0, 20);
    draw(g, state, rules, dense, 1, look, -1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#f5ebd9'; g.font = '64px Georgia, serif'; g.fillText('Splitlight', 70, 1250);
    g.font = '36px ui-monospace, monospace'; g.fillStyle = '#e8c493';
    const d = dailySave();
    g.fillText(`${today} · ${t('resultLine', { turns: turnWords(d?.day === today ? d.turns : state.turns), par: parInfo.par, secs: (Math.round(state.elapsed * 10) / 10).toFixed(1) })}`, 70, 1310);
    state.targets.forEach((target, i) => { g.fillStyle = bandColour(target.band); g.beginPath(); g.arc(760 + i * 44, 1236, 16, 0, Math.PI * 2); g.fill(); });
    return new Promise(ok => c.toBlob(blob => ok(blob), 'image/png'));
  } catch { return Promise.resolve(null); }
}
async function shareResult() {
  const text = shareLine(), url = location.origin + location.pathname;
  rec.event('share', { mode, day: today });
  try {
    const blob = await picture();
    const file = blob && new File([blob], `splitlight-${today}.png`, { type: 'image/png' });
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text}\n${url}` }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  if (await shareLink(url, text) === 'copied') { el('share').textContent = t('copied'); setTimeout(() => { el('share').textContent = t('share'); }, 1600); }
}

// Integrate dwell at the previous setting before a gesture changes the optics.
function advance(now) {
  const dt = Math.max(0, (now - previous) / 1000);
  previous = Math.max(previous, now);
  if (screen !== 'play') return;
  if (state.won) {
    reveal += dt;
    if (reveal > (reducedMotion.matches ? .45 : 1.4)) show('result');
    return;
  }
  if (!state.started) return;
  const before = state.targets.map(target => target.fed).join() + state.charge;
  expose(state, rules, dt);
  if (before !== state.targets.map(target => target.fed).join() + state.charge) { redraw = true; readout(); }
  if (state.won) finishPlate();
}
function frame(now) {
  advance(now);
  if (redraw || moving() || glowing()) paint(now / 1000);
  requestAnimationFrame(frame);
}
// The recording notice is on the page from the first look; its switch is on the pause card.
rec.notice(document.querySelector('.instrument'));
rec.toggle(document.querySelector('#paused .card'));
texts();
open(high, new URLSearchParams(location.search).has('daily') ? 'daily' : 'plates');
paint(0);
window.splitlightState = () => ({
  level: state.id, mode, day: mode === 'daily' ? today : null, position: state.values[state.selected], values: state.values.slice(), selected: state.selected,
  elapsed: state.elapsed, started: state.started, won: state.won, screen, sound: audible, turns: state.turns, par: parInfo.par, charge: state.charge,
  targets: state.targets.map(target => ({ ...target })),
});
// For checks and the bots' page runs: the answer the receivers were placed from.
window.splitlightAnswer = () => level.answer.slice();
window.splitlightShareLine = () => shareLine();
requestAnimationFrame(frame);
