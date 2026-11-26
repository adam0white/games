import { create, grab, pull, release, tick, cancel, fret, heldShape, pitchOf, partials, daily, podX, TICK, plates, PARS, MAX_PULL, COUNT } from './sim.js';
import { draw, backdrop, PEG_Y, PEG_REACH } from './art.js';
import { parSteps } from './solve.js';
import { t, lang, setLang, apply, plantName, roman, dateLabel } from './words.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { screens } from '../../kit/screens.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { lab } from '../../kit/lab.js';
import { home } from '../../kit/home.js';
import { noZoom } from '../../kit/zoom.js';
import { shareLink } from '../../kit/room.js';

noZoom();
const $ = id => document.getElementById(id);
const board = $('board'), ctx = board.getContext('2d');
// Saves. `progress` keeps its shipped meaning (plates I-VI: next 1-6, complete when VI is done) so older
// readers and the hub stay right. Plates VII on, bests and the daily plate live under new keys.
const key = 'night-podwire:progress', bookKey = 'night-podwire:book', dayKey = 'night-podwire:daily';
const SIX = 6, TOTAL = plates.length;
function readSave() {
  const stored = readJson(key);
  return stored?.v === 1 && Number.isInteger(stored.next) && stored.next >= 1 && stored.next <= SIX ? stored : null;
}
function readBook() {
  const b = readJson(bookKey);
  return b?.v === 1 && Number.isInteger(b.reached) && b.reached >= 1 && b.reached <= TOTAL ? b : null;
}
function readDays() {
  const d = readJson(dayKey);
  return d?.v === 1 && d.days && typeof d.days === 'object' ? d : null;
}
const stored = readSave(), storedBook = readBook();
const save = stored ? { v: 1, next: stored.next, complete: stored.complete === true, sound: stored.sound !== false }
  : { v: 1, next: 1, complete: false, sound: true };
const book = { v: 1, reached: Math.max(storedBook?.reached || 1, save.complete ? SIX + 1 : save.next), done: storedBook?.done === true,
  best: { ...(storedBook?.best || {}) } };
const days = { v: 1, days: { ...(readDays()?.days || {}) } };
const audio = sound({ on: () => save.sound });
const query = new URLSearchParams(location.search);
const look = query.get('look') === 'blueprint' ? 'blueprint' : 'herbarium';
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') || '') ? query.get('date') : new Date().toISOString().slice(0, 10);
document.documentElement.dataset.look = look;
document.querySelector('meta[name="theme-color"]').content = look === 'blueprint' ? '#15374b' : '#f5efde';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let state, screen, mode = 'plates', pointer = null, last = 0, carry = 0, knownOpened = 0, winTime = null;
// Feel, drawn and felt only (the wire's rules never see it): a short freeze when a pod bursts, slow motion as the
// last pod goes, a small shake, a ring where the husk split, and haptics where the phone has them (Android browsers;
// iOS Safari ignores vibrate). Reduced motion turns off the freeze, slow motion, shake and buzz; the sound switch turns off the buzz.
let freeze = 0, slow = 0, shake = 0, bursts = [], pullStep = 0;
const buzz = pattern => { if (!reduced.matches && save.sound) try { navigator.vibrate?.(pattern); } catch {} };
const burstInk = look === 'blueprint' ? '#f3d9a0' : '#b0612f';
let lastPluck = -Infinity, trail = [], frameCount = 0, parJob = null, dayPar = null;
const show = screens(['paused', 'won'], name => {
  screen = name;
  $('pause').disabled = name !== 'play';
  $('folio').inert = name === 'paused';
});
// Merge with whatever another tab wrote since, then write both saves.
function store(toggleSound = false) {
  const latest = readSave(), latestBook = readBook(), latestDays = readDays();
  if (latest) {
    save.next = Math.max(save.next, latest.next);
    save.complete ||= latest.complete === true;
    if (typeof latest.sound === 'boolean') save.sound = latest.sound;
  }
  if (latestBook) {
    book.reached = Math.max(book.reached, latestBook.reached);
    book.done ||= latestBook.done === true;
    for (const [k, n] of Object.entries(latestBook.best || {})) if (Number.isInteger(n) && !(book.best[k] <= n)) book.best[k] = n;
  }
  for (const [k, v] of Object.entries(latestDays?.days || {})) days.days[k] ??= v;
  const keys = Object.keys(days.days).sort();
  while (keys.length > 40) delete days.days[keys.shift()];
  if (toggleSound) save.sound = !save.sound;
  const ok = [writeJson(key, save), writeJson(bookKey, book), writeJson(dayKey, days)].every(Boolean);
  $('status').textContent = ok ? '' : t('visitOnly');
}
const parOf = () => mode === 'daily' ? dayPar : PARS[state.level - 1];
function resultLine() {
  const n = state.plucks, par = parOf();
  return par == null ? t(n === 1 ? 'resultOne' : 'resultOther', { n, par: '…' }) : t(n === 1 ? 'resultOne' : 'resultOther', { n, par });
}
function updateFooter() {
  const n = state.pods.length;
  $('count').textContent = screen === 'won'
    ? (mode === 'plates' && state.level === TOTAL && book.done ? t('collected') : resultLine())
    : t(n === 1 ? 'podsOne' : 'podsOther', { n: knownOpened, total: n });
  $('marks').hidden = mode === 'daily';
  [...$('marks').children].forEach((mark, i) => {
    const level = i + 1, best = book.best[level];
    mark.className = (mode === 'plates' && level === state.level ? 'current' : level < book.reached || book.done ? 'done' : '') +
      (best && best <= PARS[i] ? ' par' : '');
  });
  $('today').textContent = days.days[today] ? t('todayDone') : t('today');
  $('today').setAttribute('aria-pressed', String(mode === 'daily'));
}
// Shrink a long plant name until it fits on one line (down to 26 px); past that the ellipsis in the CSS takes over.
function fitTitle() {
  const h = $('species');
  h.style.fontSize = '';
  let size = parseFloat(getComputedStyle(h).fontSize);
  while (h.scrollWidth > h.clientWidth + 1 && size > 26) { size -= 2; h.style.fontSize = size + 'px'; }
}
addEventListener('resize', fitTitle);
function updateHeading() {
  $('number').textContent = mode === 'daily' ? t('dailyPlate', { date: dateLabel(today) })
    : t('plate', { n: roman(state.level), total: roman(TOTAL) });
  $('species').textContent = plantName(state.level);
  fitTitle();
  $('latin').textContent = plates[state.level - 1].latin;
  $('next').textContent = mode === 'daily' ? t('plates') : state.level === TOTAL ? t('again') : t('next');
  $('share').hidden = mode !== 'daily';
  $('sound').textContent = save.sound ? t('soundOn') : t('soundOff');
  document.title = t('brand');
}
// Play recording for the game lab: one run is one plate, from the first pull of the wire to all pods open,
// a restart, or leaving it for another plate. The daily plate is recorded the same way with mode 'daily'.
// Opened from the small games' home (?from=small): a way back on the pause card and beside Next plate.
const rec = home(lab('night-podwire', { lang }), { back: ['#paused .sheet', '#won'], lang });
let running = false;
function recEnd(outcome) {
  if (!running) return;
  running = false;
  rec.end(outcome, { plate: state.level, plucks: state.plucks, opened: knownOpened, pods: state.pods.length,
    secs: Math.round(state.time * 10) / 10, mode, par: parOf() });
}
function start(level, which = 'plates') {
  recEnd('quit');
  if ($('status').textContent === t('practice')) $('status').textContent = '';
  mode = which;
  if (mode === 'daily') {
    const d = daily(today);
    state = create(d.level, d.seed, { spread: d.spread });
    dayPar = Number.isInteger(days.days[today]?.par) ? days.days[today].par : null;
    parJob = dayPar === null ? parSteps(d.level, d.seed, { spread: d.spread }) : null;
  } else {
    state = create(level, level * 417);
    parJob = null;
  }
  pointer = null; last = 0; carry = 0; knownOpened = 0; winTime = null;
  lastPluck = -Infinity; trail = []; freeze = slow = shake = 0; bursts = [];
  backdrop(state, look); // draw the paper now so the first frame stays light
  updateHeading();
  audio.release(); show('play'); updateFooter();
}
function abandonGrip() {
  const previous = pointer;
  if (previous === null) return;
  pointer = null;
  cancel(state);
  if (board.hasPointerCapture(previous)) board.releasePointerCapture(previous);
}
function pause() {
  if (screen !== 'play') return;
  abandonGrip(); audio.hold(); show('paused');
  $('sound').textContent = save.sound ? t('soundOn') : t('soundOff');
  $('resume').focus({ preventScroll: true });
}
function resume() {
  last = 0; audio.release(); show('play');
}
$('pause').onclick = pause;
$('resume').onclick = resume;
$('retry').onclick = () => start(state.level, mode);
$('next').onclick = () => {
  nextHint.done();
  if (mode === 'daily') start(book.done ? TOTAL : book.reached);
  else start(state.level % TOTAL + 1);
};
$('today').onclick = () => {
  if (screen === 'paused') return;
  if (mode === 'daily') start(book.done ? TOTAL : book.reached);
  else start(1, 'daily');
};
$('sound').onclick = () => {
  store(true);
  $('sound').textContent = save.sound ? t('soundOn') : t('soundOff');
  updateFooter();
};
$('lang').onclick = () => {
  setLang(lang() === 'tr' ? 'en' : 'tr');
  apply(); updateHeading(); updateFooter();
};
$('share').onclick = async () => {
  const entry = days.days[today], n = entry?.plucks ?? state.plucks, par = entry?.par ?? dayPar ?? '…';
  const marks = '◆'.repeat(Math.min(n, Number(par) || n)) + '◇'.repeat(Math.max(0, n - (Number(par) || n)));
  const text = t(n === 1 ? 'shareLineOne' : 'shareLine', { date: today, plate: plantName(state.level), n, par, marks });
  const url = location.origin + location.pathname + '?daily';
  // Without a share sheet the kit copies only the link; copy the result line with it.
  let how;
  if (navigator.share) how = await shareLink(url, text);
  else try { await navigator.clipboard.writeText(text + ' ' + url); how = 'copied'; } catch { how = 'shown'; }
  $('status').textContent = how === 'shared' ? t('shared') : how === 'copied' ? t('copied') : text;
};
onLeave(pause);
new ResizeObserver(abandonGrip).observe(board);
addEventListener('keydown', e => {
  if (isPauseKey(e) && !e.repeat) {
    if (screen === 'paused') resume(); else pause();
  }
});
function world(e) {
  const r = board.getBoundingClientRect();
  return { x: (e.clientX - r.left) * 360 / r.width, y: (e.clientY - r.top) * 380 / r.height };
}
const nodeX = i => 24 + 312 * i / (COUNT - 1);
board.addEventListener('pointerdown', e => {
  if (screen !== 'play' || pointer !== null || e.button !== 0) return;
  const { x, y } = world(e);
  // A brass peg under the wire clamps the wire above it, or frees it.
  const k = (state.frets || []).findIndex(f => Math.abs(x - nodeX(f.i)) < PEG_REACH && Math.abs(y - PEG_Y) < PEG_REACH);
  if (k >= 0) {
    if (fret(state, k)) {
      audio.unlock();
      audio.noise(.03, .12, 2600);
      audio.tone(pitchOf(state, state.frets[k].i - 1).freq * 2, .08, .03, 'square');
      trail = [];
    }
    return;
  }
  if (!grab(state, x, y)) return;
  pullStep = 0; buzz(6);
  pointer = e.pointerId; board.setPointerCapture(pointer); audio.unlock();
});
board.addEventListener('pointermove', e => {
  if (e.pointerId !== pointer) return;
  pull(state, world(e).y);
  // The wire creaks under the finger: one small tick for every 20 units of pull.
  const step = Math.floor((state.grip?.depth || 0) / 20);
  if (step > pullStep) buzz(4);
  pullStep = step;
});
// The pluck sounds like the string it is: pitch from the plucked span's length and tension,
// and the mix of harmonics from where along it the finger let go.
function pluckSound(index, depth) {
  const { freq, position } = pitchOf(state, index);
  const amps = partials(position), loud = .025 + depth / MAX_PULL * .1;
  amps.forEach((a, n) => {
    const v = loud * Math.abs(a) * (n ? 1.5 : 1);
    if (v > .002) audio.tone(freq * (n + 1), 1.5 / (1 + n * .55), v, n ? 'sine' : 'triangle');
  });
  audio.noise(.02, .05 + depth / MAX_PULL * .05, 3800);
}
// Pods pop on notes of the same wire: the next harmonic of the open string, or a tuned pod's own one.
function popSound(pod, count) {
  const open = pitchOf(state, (COUNT - 1) >> 1).freq;
  const harmonic = pod?.type === 'tuned' ? pod.mode * 2 : [2, 3, 4, 5, 6, 8][(count - 1) % 6];
  audio.noise(.075, .09, 3100);
  audio.tone(open * harmonic, .45, .06, 'sine');
  audio.tone(open * harmonic * 2, .18, .02, 'sine');
}
board.addEventListener('pointerup', e => {
  if (e.pointerId !== pointer) return;
  pull(state, world(e).y);
  const depth = state.grip.depth;
  const index = state.grip.i;
  pointer = null;
  if (release(state)) {
    lastPluck = state.time;
    pluckSound(index, depth);
    buzz(Math.round(10 + depth / MAX_PULL * 22));
  }
});
for (const event of ['lostpointercapture', 'pointercancel']) {
  board.addEventListener(event, e => { if (e.pointerId === pointer) abandonGrip(); });
}
const marks = $('marks');
for (let i = 0; i < TOTAL; i++) marks.append(document.createElement('i'));
apply();
start(query.has('daily') ? 1 : book.done ? TOTAL : book.reached, query.has('daily') ? 'daily' : 'plates');
// The gesture must be shown on the playable length of wire. On the result,
// the kit's tap hint can point directly to the next-plate button.
const nextHint = hint($('next'), {
  kind: 'tap', key: 'night-podwire:next-hint', when: () => screen === 'won' && mode === 'plates' && state.level === 1,
  played: save.next > 1, delay: 5500, label: t('hintNext'),
  bottom: () => innerHeight - $('next').getBoundingClientRect().top - $('next').offsetHeight / 2,
});
const hintBox = $('won').querySelector('.kit-hint');
function inWorldCue() {
  return screen === 'play' && !state.won && !state.grip &&
    (state.plucks === 0 || (!knownOpened && state.time - lastPluck > 2.8));
}
function won() {
  winTime = state.time;
  rec.event('plate-complete', { plate: state.level, plucks: state.plucks, mode });
  recEnd('won');
  if (mode === 'plates') {
    book.reached = Math.max(book.reached, Math.min(TOTAL, state.level + 1));
    book.done ||= state.level === TOTAL;
    if (!(book.best[state.level] <= state.plucks)) book.best[state.level] = state.plucks;
    save.next = Math.max(save.next, Math.min(SIX, state.level + 1));
    save.complete ||= state.level >= SIX;
  } else if (!days.days[today]) {
    days.days[today] = { plucks: state.plucks, par: dayPar };
  } else {
    store();
    if (!$('status').textContent) $('status').textContent = t('practice'); // a replay of today's plate is practice
    return;
  }
  store();
}
function frame(now) {
  const began = performance.now();
  if (screen !== 'paused') {
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0;
    if (freeze > 0) freeze -= dt;
    else { carry += slow > 0 ? dt * .3 : dt; slow -= dt; }
    while (carry >= TICK) { tick(state); carry -= TICK; }
    shake = Math.max(0, shake - dt * 6);
    for (const b of bursts) b.age += dt;
    bursts = bursts.filter(b => b.age < .5);
    const opened = state.pods.filter(pod => pod.open);
    if (opened.length > knownOpened) {
      knownOpened = opened.length;
      const pod = opened.at(-1), final = opened.length === state.pods.length;
      popSound(pod, knownOpened);
      if (!reduced.matches) {
        freeze = final ? .11 : .06; slow = final ? .5 : 0; shake = final ? 1 : .6;
        bursts.push({ x: podX(state, pod), y: 250 - (pod.type === 'tuned' ? 66 : pod.height) - 26, age: 0, big: final }); // the husk's middle (art.js hang + half a pod)
      }
      buzz(final ? [30, 40, 70] : 24);
      updateFooter();
    }
    if (!running && winTime === null && state.plucks > 0 && screen === 'play') {
      running = true;
      rec.start({ plate: state.level, pods: state.pods.length, mode });
    }
    if (state.won && winTime === null) won();
    if (state.won && screen === 'play' && state.time - winTime >= .65) {
      show('won'); updateFooter();
      if (hintBox) {
        const rect = $('next').getBoundingClientRect();
        hintBox.style.left = (rect.left + rect.width / 2) + 'px';
      }
    }
  }
  last = now;
  // The wake behind a travelling wave: a few earlier shapes of the wire.
  if (state.ringing && ++frameCount % 3 === 0) {
    trail.push(state.u.slice());
    if (trail.length > 4) trail.shift();
  } else if (!state.ringing) trail.length = 0;
  const resolution = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(board.clientWidth * resolution));
  const h = Math.max(1, Math.round(board.clientHeight * resolution));
  if (board.width !== w || board.height !== h) { board.width = w; board.height = h; }
  const jolt = shake * shake * 3 * w / 360;
  ctx.setTransform(w / 360, 0, 0, h / 380, jolt * Math.sin(now * .09), jolt * Math.cos(now * .113));
  draw(ctx, state, { look, cue: inWorldCue(), reduced: reduced.matches, wire: heldShape(state), trail });
  for (const b of bursts) {
    const k = b.age / .5, r = (b.big ? 12 : 8) + k * (b.big ? 90 : 55);
    ctx.save(); ctx.globalAlpha = (1 - k) * (1 - k); ctx.strokeStyle = burstInk; ctx.lineWidth = b.big ? 3 : 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + .2;
      ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * r * .55, b.y + Math.sin(a) * r * .55); ctx.lineTo(b.x + Math.cos(a) * r * .8, b.y + Math.sin(a) * r * .8); ctx.stroke();
    }
    ctx.restore();
  }
  // Today's par is worked out by the look-ahead player a little at a time, inside what is left of the frame.
  if (parJob) {
    let r;
    while (performance.now() - began < 4 && !(r = parJob.next()).done);
    if (r?.done) {
      parJob = null;
      dayPar = r.value;
      if (days.days[today] && days.days[today].par == null) { days.days[today].par = dayPar; store(); }
      updateFooter();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.podwireView = () => ({
  level: state.level, screen, mode, grip: state.grip?.i ?? null, opened: knownOpened, total: state.pods.length,
  plucks: state.plucks, time: state.time, cue: inWorldCue(), sound: save.sound, wire: state.u.slice(),
  pods: state.pods.map(({ x, height, open, type }) => ({ x, height, open, type })), zones: state.zones.map(z => [...z]),
  frets: (state.frets || []).map(f => ({ x: nodeX(f.i), on: f.on })), par: parOf(), today, lang: lang(),
});

// The notice is under the plate from the first moment (this page has no start card); the switch is on the pause card.
rec.notice(document.querySelector('footer'));
rec.toggle(document.querySelector('#paused .sheet'));
