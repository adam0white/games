import { create, step, view, LEVELS, CLASSIC, DT, dailySpec, dayNumber } from './sim.js';
import { W as WORDS } from './words.js';
import { read, write, readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { lab } from '../../kit/lab.js';
import { home } from '../../kit/home.js';
import { shareLink } from '../../kit/room.js';
import { shareImage } from '../../kit/share.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const t = WORDS.t;
const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const landscape = matchMedia('(orientation: landscape) and (max-height: 480px)');
// Storage. `night-bells:save` keeps main's format exactly (stars for nights 1-8). New state has new keys.
const KEY = 'night-bells:save', MORE = 'night-bells:more', MUSIC = 'night-bells:music', DAILY = 'night-bells:daily';
const HINT_LIFT = 20, HINT_HEIGHT = 53;
const palettes = {
  amber: { sky:'#111e30', horizon:'#334956', stone:'#304150', edge:'#4d5d65', accent:'#ffcd75', ink:'#f9e7be', panel:'#192b3e', bells:['#f4c878','#98cebf','#d5aece'] },
  moon: { sky:'#101d30', horizon:'#365a73', stone:'#2b425c', edge:'#536b83', accent:'#a6dfef', ink:'#e5f5ff', panel:'#172f49', bells:['#a6dfef','#bab9f0','#f4d8a3'] },
  rose: { sky:'#291e36', horizon:'#725166', stone:'#4a354c', edge:'#715569', accent:'#f0abc1', ink:'#ffe6de', panel:'#3e2a45', bells:['#f0abc1','#e5c48a','#a9cdc8'] },
};
const starOk = v => Number.isFinite(v) ? Math.max(0, Math.min(3, Math.floor(v))) : 0;
const save = { v:1, stars:Array(CLASSIC).fill(0), best:0, sound:true, tries:0, look:'amber' };
const old = readJson(KEY);
if (old && typeof old === 'object') {
  if (Array.isArray(old.stars)) save.stars = save.stars.map((_,i) => starOk(old.stars[i]));
  if (Number.isFinite(old.best)) save.best = Math.max(0,Math.floor(old.best));
  if (Number.isFinite(old.tries)) save.tries = Math.max(0,Math.floor(old.tries));
  if (typeof old.sound === 'boolean') save.sound = old.sound;
  if (Object.hasOwn(palettes,old.look)) save.look = old.look;
}
if (Object.hasOwn(palettes,query.get('look'))) save.look = query.get('look');
const more = { v:1, stars:Array(LEVELS - CLASSIC).fill(0) };
const oldMore = readJson(MORE);
if (oldMore && Array.isArray(oldMore.stars)) more.stars = more.stars.map((_,i) => starOk(oldMore.stars[i]));
let musicOn = read(MUSIC, '1') !== '0';
const asked = query.get('day'), today = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : new Date().toISOString().slice(0, 10);
const freshDaily = () => ({ v:1, day:today, plays:0, best:0, won:false, rings:0, together:0, misses:0, peal:[] });
let daily = readJson(DAILY);
if (!daily || daily.v !== 1 || daily.day !== today || !Number.isFinite(daily.best) || !Array.isArray(daily.peal)) daily = freshDaily();
const store = () => writeJson(KEY, save);
const storeMore = () => writeJson(MORE, more);
const star = n => n <= CLASSIC ? save.stars[n - 1] : more.stars[n - CLASSIC - 1];
function setStar(n, v) { if (n <= CLASSIC) save.stars[n - 1] = Math.max(save.stars[n - 1], v); else { more.stars[n - CLASSIC - 1] = Math.max(more.stars[n - CLASSIC - 1], v); storeMore(); } }
const unlocked = () => { let n = 1; while (n < LEVELS && star(n)) n++; return n; };
const chapterOf = n => Math.ceil(n / 8);

let palette = palettes[save.look], mode = 'menu', selected = unlocked(), chapter = chapterOf(selected), s = create(3, 17);
let W = 0, H = 0, dpr = 1, top = 0, bottom = 0, safeLeft = 0, safeRight = 0;
let accumulator = 0, last = performance.now(), queue = [], activePointer = null, burst = 0, ringTime = 0;
let pads = [], positions = [], markers = [], gallery = {}, fx = [], winPos = [], pops = new Float32Array(88), cueKey = '';
let strikes = [], replay = null, replayFlash = [0, 0, 0], ropeFlash = 0, songAt = 0;
const costs = new Float32Array(240); let costAt = 0;
const cv = $('c'), g = cv.getContext('2d'), objective = $('objective');
// Sound: the kit's song (preset 'bell') plays under a night; each strike is a note in the song's chord.
let song = null;
const snd = sound({ on: () => save.sound, setup: ac => { try { song = music(ac, { preset: 'bell' }); song.volume(.5); } catch { song = null; } } });

const show = screens(['menu','paused','end'], name => {
  mode = name; $('pause').style.display = name === 'play' ? 'block' : 'none';
  for (let i = 0; i < 3; i++) $('pad'+i).style.display = name === 'play' && i < s.bells.length && !s.bells[i].free ? 'block' : 'none';
  cue();
});
function applyPalette() {
  palette = palettes[save.look];
  for (const [name, value] of Object.entries({ ink:palette.ink, accent:palette.accent, panel:palette.panel })) document.documentElement.style.setProperty('--'+name, value);
  document.querySelector('meta[name="theme-color"]').content = palette.sky;
  for (const b of document.querySelectorAll('[data-look]')) b.setAttribute('aria-pressed', String(b.dataset.look === save.look));
}
// Play recording for the game lab: one run is one try at a night, the endless mode or the daily peal.
const rec = home(lab('night-bells', { lang: WORDS.lang }), { back: ['#menu .card', '#end .card'], lang: WORDS.lang });
let running = false;
function recStart(level, endless) { running = true; rec.start({ level, endless, daily: s.daily || '', idea: s.idea, look: save.look, lang: WORDS.lang(), music: musicOn }); }
function recEnd(outcome, extra) {
  if (!running) return; running = false;
  rec.end(outcome, { level: s.level, endless: !!s.endless, daily: s.daily || '', t: Math.round(s.t*10)/10, hits: s.hits, harmony: s.harmony, chords: s.chords, misses: s.misses, score: Math.floor(s.score), ...extra });
}
function labels() {
  WORDS.apply();
  for (const id of ['sound1','sound2']) { $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff'); $(id).setAttribute('aria-pressed', String(save.sound)); }
  for (const id of ['music1','music2']) { $(id).textContent = t(musicOn ? 'musicOn' : 'musicOff'); $(id).setAttribute('aria-pressed', String(musicOn)); $(id).disabled = !save.sound; }
  $('daily').textContent = t('daily'); $('endless').textContent = t('endless');
  for (let i = 0; i < 3; i++) $('pad'+i).setAttribute('aria-label', t('ring', { n: i + 1 }));
  document.title = t('title');
}
function menu() {
  recEnd('quit'); stopReplay();
  queue = []; activePointer = null; song?.set({ on: false }); snd.hold();
  s = create(3, 17); show('menu');
  selected = Math.min(selected, unlocked()); chapter = chapterOf(selected);
  drawMenu(); layout();
}
function drawMenu() {
  const open = unlocked();
  $('chapters').replaceChildren(...[1, 2, 3].map(c => {
    const b = document.createElement('button'), a = (c - 1) * 8 + 1;
    b.textContent = `${a}–${a + 7}`; b.setAttribute('aria-label', t('chapter', { a, b: a + 7 })); b.dataset.chapter = c; b.disabled = a > open;
    b.setAttribute('aria-pressed', String(c === chapter)); b.onclick = () => { chapter = c; drawMenu(); };
    return b;
  }));
  $('levels').replaceChildren();
  for (let i = (chapter - 1) * 8 + 1; i <= chapter * 8; i++) {
    const b = document.createElement('button'), done = star(i) > 0;
    b.dataset.level = i; b.textContent = done ? '✦ '+i : String(i); b.disabled = i > open;
    b.className = (done ? 'done ' : '') + (selected === i ? 'selected' : '');
    b.setAttribute('aria-label', t(done ? 'levelDone' : 'level', { n: i }));
    b.onclick = () => { selected = i; start(i, false); }; $('levels').append(b);
  }
  $('best').textContent = t('best', { n: save.best }) + (daily.plays ? ' · ' + t('dailyBest', { n: daily.best }) : '');
  $('play').setAttribute('aria-label', t('play', { n: selected }));
  labels();
}
function rank(i) { return s.bells.filter(b => b.length > s.bells[i].length).length; } // the longest bell is the lowest note
function startSong() {
  const on = save.sound && musicOn;
  if (song) { if (on) { song.start(s.seed); songAt = 0; } song.set({ on, progress: 0, danger: 0, light: 1 }); }
}
function start(level, endless, isDaily = false) {
  recEnd('quit'); stopReplay();
  const seed = isDaily ? dayNumber(today) : Number(query.get('seed')) || ((save.tries + 1) * 9137);
  s = isDaily ? create(1, seed, false, dailySpec(today)) : create(level, seed, endless);
  save.tries++; store();
  queue = []; activePointer = null; fx = []; strikes = []; burst = 0; accumulator = 0; ropeFlash = 0; pops.fill(0); last = performance.now();
  snd.unlock(); snd.release(); startSong();
  recStart(s.level, !!endless); show('play'); layout();
}
function pause() { if (mode !== 'play') return; queue = []; activePointer = null; accumulator = 0; snd.hold(); show('paused'); }
function resume() { if (mode !== 'paused') return; queue = []; last = performance.now(); accumulator = 0; snd.unlock(); snd.release(); show('play'); }
const ideaKey = () => s.daily && s.idea === 'handstroke' ? 'idea_handstroke3' : 'idea_' + s.idea;
function cue() {
  let key = '';
  if (mode === 'play') {
    const full = !s.endless && s.lights >= s.target;
    if (full && s.hold && !s.over) key = s.wake && !s.woke ? 'heldWake' : s.chords < s.chordNeed ? 'heldChord' : s.harmony < s.need ? 'held' : '';
    else if (s.t < 9 && !(s.level === 1 && !s.daily && !s.endless)) key = ideaKey();
  }
  if (key === cueKey) return;
  cueKey = key; objective.hidden = !key;
  objective.textContent = !key ? '' : (s.daily && key.startsWith('idea_') ? t('daily_lead') : '') + t(key);
}
function finish() {
  queue = []; activePointer = null; song?.set({ on: false });
  const isDaily = !!s.daily;
  if (s.endless) save.best = Math.max(save.best, Math.floor(s.score));
  else if (isDaily) {
    daily.plays++;
    if (Math.floor(s.score) >= daily.best) Object.assign(daily, { best: Math.floor(s.score), won: s.won, rings: s.hits, together: s.harmony + s.chords, misses: s.misses,
      peal: strikes.slice(0, 160).map(n => [n.i, Math.round(n.t * 10)]) });
    writeJson(DAILY, daily);
  } else if (s.won) { setStar(s.level, s.misses === 0 ? 3 : s.misses < 4 ? 2 : 1); selected = Math.min(LEVELS, s.level + 1); }
  store();
  const stars = !s.endless && !isDaily ? star(s.level) : 0;
  if (s.won && !s.endless && !isDaily) rec.event('level-complete', { level: s.level, stars, idea: s.idea });
  if (s.endless) rec.event('endless-finished', { score: Math.floor(s.score), best: save.best });
  if (isDaily) rec.event('daily-finished', { day: s.daily, idea: s.idea, won: s.won, score: Math.floor(s.score) });
  recEnd(s.won ? 'won' : 'lost', s.won && !s.endless && !isDaily ? { stars } : {});
  show('end');
  $('endMark').textContent = s.won ? (isDaily ? '✦' : '✦ '.repeat(stars).trim()) : '☾';
  $('endLabel').textContent = s.endless ? t('endlessLabel') : isDaily ? t('pictureDaily', { day: dayLabel(today) }) : s.won ? t('nightDone', { n: s.level }) : t('quiet');
  $('endTitle').textContent = s.endless ? t('lightsN', { n: Math.floor(s.score) }) : isDaily && s.won ? t('dailyDone') : s.won ? (s.level === LEVELS ? t('awake') : t('brighter')) : t('oneMore');
  $('endLine').textContent = s.endless ? t('lineEndless', { best: save.best, hits: s.hits, together: s.harmony })
    : t(s.bells.length > 1 ? 'line' : 'lineOne', { hits: s.hits, together: s.harmony + s.chords, secs: s.t.toFixed(1) });
  const why = $('endWhy'); why.hidden = s.won || s.endless;
  if (!why.hidden) why.textContent = s.why === 'time' ? t('whyTime', { n: Math.min(s.target, Math.floor(s.lights)), of: s.target }) : t('whyFaded', { n: (s.faded ?? 0) + 1 });
  // A loss has one way to try again: the primary button. A win keeps Again beside Next.
  $('next').textContent = s.won && !s.endless && !isDaily ? (s.level < LEVELS ? t('next') : t('endlessNext')) : s.won ? t('again') : t('retry');
  $('retry').hidden = !s.won || isDaily;
  $('replay').hidden = !s.won || !strikes.length; $('share').hidden = !isDaily;
  $('tuneLine').hidden = !s.won || !strikes.length; $('tuneText').textContent = t('tune');
  $('toast').hidden = true;
  if (s.won) { chime(-1); playTune(); buzz([25, 50, 25, 50, 60]); } else buzz([70, 50, 70]);
  if (isDaily) makePicture().then(p => { picture = p; });
}
function bellVoice(f, vol = 1) { snd.tone(f, .85, .075 * vol); snd.tone(f * 2.01, .32, .025 * vol); snd.tone(f * 3, .18, .009 * vol); }
function chime(i) {
  if (!save.sound) return 0;
  const f = i < 0 ? 523.25 : pitch(i); bellVoice(f); return f;
}
const FIXED = [523.25, 659.25, 783.99];
let voice = 'fixed'; // where the last strike's pitch came from: 'music' (kit/music.js chord) or 'fixed'
function pitch(i) {
  const r = rank(i);
  if (song && musicOn && save.sound) { try { const f = song.chime(r); if (Number.isFinite(f) && f > 0) { voice = 'music'; return f; } } catch {} }
  voice = 'fixed'; return FIXED[Math.min(2, r)];
}
// The village plays back what the player rang: the same bells in the same order, gaps tightened.
function playTune() {
  const notes = []; let at = .5;
  const list = strikes.slice(-24);
  list.forEach((n, k) => { if (k) at += Math.max(.16, Math.min(.42, (n.t - list[k - 1].t) * .5)); notes.push({ at, i: n.i, f: n.f || FIXED[Math.min(2, rank(n.i))] }); });
  replay = notes.length ? { t0: performance.now() / 1000, notes, k: 0 } : null;
  $('tuneDots').replaceChildren(...notes.map(n => { const d = document.createElement('i'); d.style.background = palette.bells[n.i]; return d; }));
}
function stopReplay() { replay = null; }
function tickReplay() {
  if (!replay) return;
  const now = performance.now() / 1000 - replay.t0;
  while (replay.k < replay.notes.length && replay.notes[replay.k].at <= now) {
    const n = replay.notes[replay.k], rankK = Math.floor(replay.k / replay.notes.length * 88);
    if (save.sound) bellVoice(n.f, .8);
    replayFlash[n.i] = .28; spark(n.i, rankK); $('tuneDots').children[replay.k]?.classList.add('on'); replay.k++;
  }
  if (replay.k >= replay.notes.length && now > replay.notes[replay.notes.length - 1].at + 1) replay = null;
}
// Share a daily result: a picture of the peal (SVG drawn to a 1080x1350 PNG), else the link with a line of text.
let picture = null;
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const dayLabel = day => { try { return new Date(day + 'T12:00:00Z').toLocaleDateString(WORDS.lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch { return day; } };
function pictureSvg() {
  const peal = daily.peal, end = Math.max(10, ...peal.map(p => p[1])), cols = ['#f4c878', '#98cebf', '#d5aece'];
  const dots = peal.map(([i, at]) => `<circle cx="${(90 + at / end * 900).toFixed(1)}" cy="${470 + i * 130}" r="17" fill="${cols[i] || cols[0]}"/>`).join('');
  const lanes = [0, 1, 2].map(i => `<path d="M90 ${470 + i * 130}h900" stroke="#ffffff22" stroke-width="2"/><text x="60" y="${480 + i * 130}" font-size="30" text-anchor="middle" fill="${cols[i]}">${i + 1}</text>`).join('');
  const towers = [0, 1, 2].map(i => { const x = 360 + i * 180; return `<g fill="${cols[i]}" opacity="${daily.won ? 1 : .45}"><path d="M${x - 44} 1080C${x - 44} 1060 ${x - 30} 1056 ${x - 30} 1030C${x - 30} 996 ${x - 15} 984 ${x} 984C${x + 15} 984 ${x + 30} 996 ${x + 30} 1030C${x + 30} 1056 ${x + 44} 1060 ${x + 44} 1080Z"/><circle cx="${x}" cy="1090" r="10"/><circle cx="${x}" cy="978" r="7" fill="none" stroke="${cols[i]}" stroke-width="4"/></g>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="Georgia, 'Times New Roman', serif">
    <defs><radialGradient id="glow" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#ffcd75" stop-opacity=".2"/><stop offset="1" stop-color="#ffcd75" stop-opacity="0"/></radialGradient></defs>
    <rect width="1080" height="1350" fill="#111e30"/><rect width="1080" height="760" fill="url(#glow)"/>
    <text x="90" y="170" font-size="96" fill="#ffcd75">${esc(t('pictureTitle'))}</text>
    <text x="92" y="240" font-family="-apple-system, system-ui, sans-serif" font-size="30" letter-spacing="4" fill="#f9e7be99">${esc(t('pictureDaily', { day: dayLabel(today) }).toLocaleUpperCase(WORDS.lang()))}</text>
    <text x="92" y="330" font-size="34" fill="#f9e7becc">${esc(t(ideaKey()).slice(0, 64))}</text>
    ${lanes}${dots}${towers}
    <path d="M90 1172h900" stroke="#ffcd7533" stroke-width="2"/>
    <text x="90" y="1236" font-size="40" fill="#f9e7be">${esc(t('pictureStats', { rings: daily.rings, together: daily.together, misses: daily.misses }))}</text>
    <text x="990" y="1290" font-family="-apple-system, system-ui, sans-serif" font-size="28" text-anchor="end" fill="#f9e7be99">${esc(location.host + location.pathname)}</text>
  </svg>`;
}
async function makePicture() {
  try {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pictureSvg());
    await img.decode();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
    return blob ? new File([blob], `night-bells-${today}.png`, { type: 'image/png' }) : null;
  } catch { return null; }
}
const shareText = () => t('shareText', { day: dayLabel(today), rings: daily.rings, together: daily.together });
async function shareDaily() {
  const url = location.origin + location.pathname, text = shareText();
  rec.event('share', { what: 'daily', picture: !!picture });
  // The picture through the kit (share sheet, else a download); the text and link when there is no picture.
  if (picture && await shareImage(picture, { name: picture.name, text: `${text}\n${url}` }) !== 'failed') return;
  if (await shareLink(url, text) === 'copied') { $('toast').textContent = t('copied'); $('toast').hidden = false; }
}

for (const id of ['sound1','sound2']) $(id).onclick = () => {
  save.sound = !save.sound; store(); labels();
  if (save.sound) { snd.unlock(); if (mode !== 'paused') snd.release(); if (mode === 'play') startSong(); chime(0); }
  else { song?.set({ on: false }); snd.hold(); }
};
for (const id of ['music1','music2']) $(id).onclick = () => {
  musicOn = !musicOn; write(MUSIC, musicOn ? '1' : '0'); labels();
  if (mode === 'play' || mode === 'paused') { snd.unlock(); if (mode === 'play') startSong(); }
};
$('play').onclick = () => start(selected, false); $('endless').onclick = () => start(1, true); $('daily').onclick = () => start(1, false, true);
$('pause').onclick = pause; $('resume').onclick = resume; $('quit').onclick = menu; $('toMenu').onclick = menu;
const again = () => s.daily ? start(1, false, true) : start(s.level, s.endless);
$('retry').onclick = again;
$('next').onclick = () => s.won && !s.endless && !s.daily ? (s.level < LEVELS ? start(s.level + 1, false) : start(1, true)) : again();
$('replay').onclick = () => { snd.unlock(); snd.release(); playTune(); };
$('share').onclick = shareDaily;
for (const b of document.querySelectorAll('[data-look]')) b.onclick = () => { save.look = b.dataset.look; applyPalette(); store(); };
onLeave(pause);
const learning = () => mode === 'play' && !s.endless && !s.daily && s.level === 1;
function tap(i) { if (mode !== 'play' || i >= s.bells.length || s.bells[i].free || queue.length) return; queue.push(i); if (learning()) help.done(); snd.unlock(); }
for (let i = 0; i < 3; i++) {
  $('pad'+i).addEventListener('pointerdown', e => { e.preventDefault(); if (!e.isPrimary || activePointer !== null) return; activePointer = e.pointerId; tap(i); });
  $('pad'+i).addEventListener('click', e => { if (e.detail === 0) tap(i); });
}
cv.addEventListener('pointerdown', e => {
  if (!e.isPrimary || activePointer !== null || mode !== 'play') return; e.preventDefault();
  let best = -1, d = Infinity;
  positions.forEach((p, i) => { const n = Math.hypot(e.clientX - p.x, e.clientY - p.y); if (!s.bells[i]?.free && n < d && n < p.hitRadius) { best = i; d = n; } });
  if (best >= 0) { activePointer = e.pointerId; tap(best); }
});
for (const type of ['pointerup','pointercancel']) addEventListener(type, e => { if (e.pointerId === activePointer) activePointer = null; });
addEventListener('keydown', e => {
  if (isPauseKey(e)) { e.preventDefault(); mode === 'play' ? pause() : resume(); return; }
  if (e.repeat) return;
  const i = Number(e.key) - 1; if (i >= 0 && i < 3) { e.preventDefault(); tap(i); }
  if (e.code === 'Space' && mode === 'play' && s.bells.filter(b => !b.free).length === 1) { e.preventDefault(); tap(s.bells.findIndex(b => !b.free)); }
});
const help = hint($('pad0'), { kind:'tap', key:'night-bells:hint', when:learning, played:save.stars[0] > 0, delay:1600, label:t('hint') });
function layout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe')); top = parseFloat(cs.paddingTop) || 0; bottom = parseFloat(cs.paddingBottom) || 0;
  safeLeft = parseFloat(cs.paddingLeft) || 0; safeRight = parseFloat(cs.paddingRight) || 0;
  const n = s.bells.length, span = Math.min(W - 36, 460), left = (W - span) / 2;
  const clearance = Math.max(HINT_LIFT + HINT_HEIGHT + 5, Math.min(100, H * .13));
  document.documentElement.style.setProperty('--pad-clearance', `${clearance}px`);
  pads = s.bells.map((_, i) => ({ x: left + span * (i + .5) / n, y: H - bottom - clearance, r: Math.min(43, (span / n - 16) / 2) }));
  pads.forEach((p, i) => Object.assign($('pad'+i).style, { left:`${p.x-p.r-7}px`, top:`${p.y-p.r-7}px`, width:`${2*p.r+14}px`, height:`${2*p.r+14}px` }));
}
addEventListener('resize', layout);
function spark(i, rankK) {
  const p = positions[i]; if (!p || reduced) { pops[Math.max(0, Math.min(87, rankK))] = .5; return; }
  fx.push({ kind: 'spark', x: p.x, y: p.y, k: Math.max(0, Math.min(87, rankK)), t: 0, life: .55, c: palette.bells[i] });
}
// Haptics where the phone has them (Android browsers; iOS Safari ignores it). Off with the sound switch.
const buzz = pattern => { if (!reduced && save.sound) try { navigator.vibrate?.(pattern); } catch {} };
// How well a strike was timed, said above the bell: quality is 1 at the very top of the swing, 0 at the window's edge (no word there).
const grade = q => q >= .7 ? 'perfect' : q >= .35 ? 'good' : 'edge';
function litShare() { return s.endless ? Math.min(1, s.score / 50) : Math.min(1, s.lights / Math.max(1, s.target)); }
function update() {
  step(s, queue.splice(0, 1));
  for (const e of s.events) {
    if (e.type === 'hit') {
      voice = 'silent'; const f = chime(e.index); strikes.push({ i: e.index, t: s.t, f, voice });
      const p = positions[e.index]; if (p && !reduced) fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, life: .8, c: palette.bells[e.index] });
      spark(e.index, Math.round(litShare() * 88) - 1); ringTime = s.t;
      const word = grade(e.quality);
      if (p && word !== 'edge') fx.push({ kind: 'word', x: p.x, y: p.y - 34, t: 0, life: .7, c: palette.bells[e.index], text: t(word) + (s.combo >= 3 ? ' ×' + s.combo : '') });
      buzz(word === 'perfect' ? 14 : 8);
    } else if (e.type === 'harmony' || e.type === 'chord' || e.type === 'woke') { burst = 1; chime(-1); buzz([18, 40, 18]); }
    else if (e.type === 'miss') { if (save.sound) snd.tone(130, .08, .015, 'triangle', -45); song?.miss(); buzz(35); }
    else if (e.type === 'rope' || e.type === 'gust') ropeFlash = 1.2;
  }
  if (s.endless && s.score > save.best) { save.best = Math.floor(s.score); store(); }
  if (song && s.t - songAt > .25) {
    songAt = s.t;
    const weak = Math.min(...s.bells.filter(b => !b.free).map(b => b.energy));
    song.set({ on: save.sound && musicOn, progress: litShare(), danger: Math.max(0, Math.min(1, (.4 - weak) / .25)), light: Math.min(1, weak * 1.6) });
  }
  if (s.over) finish();
}
function circle(x, y, r, fill, stroke, width = 1) { g.beginPath(); g.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); } }
function line(x, y, a, b, c, w = 1) { g.beginPath(); g.moveTo(x, y); g.lineTo(a, b); g.strokeStyle = c; g.lineWidth = w; g.stroke(); }
function bell(x, y, size, color, angle = 0, pulse = 0, muffled = false) {
  g.save(); g.translate(x, y); g.rotate(-angle * .4); g.scale(1 + pulse * .1, 1 - pulse * .08);
  const grad = g.createLinearGradient(-size, 0, size, 0); grad.addColorStop(0, color); grad.addColorStop(.44, '#fff0c5'); grad.addColorStop(.6, color); grad.addColorStop(1, color + '88');
  circle(0, size * .48, size * .13, muffled ? '#5a3b26' : color);
  g.beginPath(); g.moveTo(-size * .48, size * .34); g.quadraticCurveTo(-size * .32, size * .12, -size * .31, -size * .23); g.quadraticCurveTo(-size * .28, -size * .56, 0, -size * .56); g.quadraticCurveTo(size * .28, -size * .56, size * .31, -size * .23); g.quadraticCurveTo(size * .32, size * .12, size * .48, size * .34); g.closePath(); g.fillStyle = grad; g.fill(); g.strokeStyle = '#101e3055'; g.lineWidth = 2; g.stroke();
  line(-size * .48, size * .34, size * .48, size * .34, color, 4); circle(0, -size * .6, size * .08, null, color, 3);
  if (muffled) { g.fillStyle = '#5a3b26cc'; g.fillRect(-size * .3, -size * .02, size * .6, size * .14); }
  g.restore();
}
// Windows light in a fixed order; a ring sends a spark to the next one.
const ORDER = (() => { const all = []; for (let j = 0; j < 2; j++) for (let i = 0; i < 11; i++) for (let k = 0; k < 4; k++) all.push({ j, i, k, key: ((i * 13 + k * 7 + j * 19) % 44) / 44 }); all.sort((a, b) => a.key - b.key); const at = {}; all.forEach((w, r) => { at[`${w.j}.${w.i}.${w.k}`] = r; }); return at; })();
function village() {
  const ground = H * .69, n = 11, litCount = Math.round(litShare() * 88) - fx.filter(f => f.kind === 'spark').length;
  const replayCount = replay ? Math.floor(replay.k / Math.max(1, replay.notes.length) * 88) : -1;
  g.fillStyle = palette.horizon; g.globalAlpha = .38; g.beginPath(); g.moveTo(0, H * .65); g.bezierCurveTo(W * .3, H * .5, W * .6, H * .68, W, H * .56); g.lineTo(W, H); g.lineTo(0, H); g.fill(); g.globalAlpha = 1;
  for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) {
    const width = W / n + 3, x = i * W / n + (j ? -13 : 0), height = 29 + ((i * 17 + j * 29) % 30), y = ground + j * 32 - height;
    g.fillStyle = j ? '#132638' : palette.stone; g.fillRect(x, y, width - 2, height + 24);
    g.beginPath(); g.moveTo(x - 4, y + 1); g.lineTo(x + width * .47, y - 13 - (i % 3) * 3); g.lineTo(x + width + 2, y + 1); g.closePath(); g.fillStyle = j ? '#203443' : palette.edge; g.fill();
    g.fillStyle = '#152538'; g.fillRect(x + width * .65, y - 16, 4, 11);
    for (let k = 0; k < 4; k++) {
      const wx = x + 6 + (k % 2) * (width * .43), wy = y + 8 + Math.floor(k / 2) * 13, r = ORDER[`${j}.${i}.${k}`];
      winPos[r] = [wx + 2, wy + 3];
      const on = (mode === 'end' && replay ? r < replayCount : r < litCount) || burst > .25, pop = pops[r];
      if (on || pop > 0) { g.shadowColor = palette.accent; g.shadowBlur = reduced ? 0 : 8 + burst * 12 + pop * 30; g.fillStyle = pop > 0 ? '#fff6dc' : palette.accent; } else { g.shadowBlur = 0; g.fillStyle = '#09192a'; }
      const grow = pop * 3; g.fillRect(wx - grow / 2, wy - grow / 2, 4.5 + grow, 7 + grow); g.shadowBlur = 0;
    }
  }
  const grad = g.createLinearGradient(0, ground, 0, H * .87); grad.addColorStop(0, '#101e3000'); grad.addColorStop(1, palette.sky); g.fillStyle = grad; g.fillRect(0, ground, W, H - ground);
}
function tower() {
  const n = s.bells.length, sideMenu = mode === 'menu' && landscape.matches;
  const span = Math.min(sideMenu ? W * .3 : W - 34, 480), center = sideMenu ? W * .2 : W / 2, left = center - span / 2;
  const roof = top + Math.max(H * .17, mode === 'menu' ? 0 : 112), base = roof + H * .29;
  g.fillStyle = palette.stone; g.fillRect(left - 10, roof - 14, span + 20, 16); g.fillStyle = palette.edge; g.fillRect(left - 15, roof - 18, span + 30, 5);
  g.fillStyle = palette.stone; g.fillRect(left - 7, roof, 9, base - roof + 8); g.fillRect(left + span - 2, roof, 9, base - roof + 8);
  // A shared beam (coupled or synced bells) is drawn as one heavy beam through the pivots.
  if ((s.couple || s.sync) && mode !== 'menu') { g.fillStyle = palette.edge; g.fillRect(left, roof + 11, span, 8); }
  positions = []; markers = [];
  const lengths = s.bells.map(b => b.length), shortest = Math.min(...lengths), range = Math.max(...lengths) - shortest;
  const swingLength = Math.min(H * .20, n === 1 ? 135 : n === 2 ? 105 : 78), column = span / n / 2;
  s.bells.forEach((b, i) => {
    const v = view(s, i), cx = left + span * (i + .5) / n, py = roof + 15, color = palette.bells[i];
    const size = (n === 1 ? 57 : n === 2 ? 44 : 36) * (b.heavy !== undefined && b.heavy < 1 ? 1.25 : 1);
    const lengthOffset = range ? (b.length - shortest) / range * (n === 3 ? 18 : 25) : 0;
    // The widest swing this night can reach stays inside the bell's own column.
    const reach = Math.sin(Math.min(Math.PI / 2, s.amp)), fit = reach > 0 ? (column - size * .5) / reach : Infinity;
    const len = Math.max(20, Math.min(base - py - size * .65 - 4, swingLength + lengthOffset, fit));
    const theta = v.angle, x = cx + Math.sin(theta) * len, y = py + Math.cos(theta) * len;
    positions.push({ x, y, hitRadius: Math.max(24, size * .65), lowest: py + len + size * .65 });
    const peak = s.amp * Math.sqrt(Math.max(.015, v.energy));
    if (mode !== 'menu') { g.save(); g.setLineDash([2, 6]); g.strokeStyle = color + '40'; g.lineWidth = 1; g.beginPath(); g.arc(cx, py, len, Math.PI / 2 - peak, Math.PI / 2 + peak); g.stroke(); g.restore(); }
    // The top of each swing: a small ring, only on a side where this bell may ring.
    if (!b.free && mode !== 'menu') for (const side of [1, -1]) {
      if (v.side >= 0 && (side === 1 ? 0 : 1) !== v.side) continue;
      const ax = cx + Math.sin(peak * side) * len, ay = py + Math.cos(peak) * len, r = size * .34;
      markers.push({ i, x: ax, y: ay, r });
      circle(ax, ay, r, v.ready ? color + '22' : null, v.ready ? color + 'dd' : color + '40', v.ready ? 2.5 : 1);
    }
    if (n > 1 && !s.couple && !s.sync) { g.strokeStyle = palette.edge; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, roof + 34, span / n * .43, Math.min(55, H * .07), 0, Math.PI, 0); g.stroke(); }
    line(cx, py, x, y - size * .49, color + '99', 2.5); circle(cx, py, 4, palette.accent);
    if (v.ready) { g.shadowColor = color; g.shadowBlur = reduced ? 0 : 22; circle(x, y, size * .68, color + '14'); g.shadowBlur = 0; }
    g.globalAlpha = b.free && !s.woke ? .55 : 1;
    bell(x, y, size, color, theta, Math.min(1, Math.max(v.hitFlash, replayFlash[i]) * 5), b.muffle > 1);
    g.globalAlpha = 1;
    if (v.missFlash > 0) { line(x - 7, y - 8, x + 7, y + 6, '#f18f86', 3); line(x + 7, y - 8, x - 7, y + 6, '#f18f86', 3); }
    if (mode !== 'menu' && pads[i] && !b.free) line(cx, base + 8, pads[i].x, pads[i].y - pads[i].r - 15, color + '22', 1);
  });
  g.fillStyle = palette.stone; g.fillRect(left - 10, base, span + 20, 10); g.fillStyle = palette.edge; g.fillRect(left - 12, base - 2, span + 24, 3);
  const rx = n === 1 ? left + span * .08 : center, ry = base - 23, lift = s.t - ringTime < .25 ? 10 : 0;
  gallery = { left, right: left + span, y: base, ringerX: rx };
  circle(rx, ry - 8, 5, palette.ink); g.fillStyle = palette.ink; g.beginPath(); g.moveTo(rx - 4, ry - 2); g.lineTo(rx + 4, ry - 2); g.lineTo(rx + 7, base); g.lineTo(rx - 7, base); g.fill(); line(rx - 3, ry, rx - 14, ry - 7 - lift, palette.ink, 3); line(rx + 3, ry, rx + 14, ry - 7 - lift, palette.ink, 3);
  // A gust is announced: leaves cross the bell's column for the second before it lands.
  const gust = s.gusts?.[s.gustAt];
  if (gust && mode === 'play') {
    const lead = gust.at - s.t, cx = left + span * (gust.bell + .5) / n;
    if (lead > 0 && lead < 1.2) for (let k = 0; k < 5; k++) {
      const p = 1 - lead / 1.2, dir = gust.push > 0 ? 1 : -1, x = cx - dir * 70 + dir * p * 140 + k * 9 * dir, y = roof + 30 + k * 14 + Math.sin(p * 9 + k) * 5;
      g.save(); g.translate(x, y); g.rotate(p * 6 + k); g.fillStyle = palette.accent + 'cc'; g.beginPath(); g.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
}
function controls() {
  const ordered = !!s.order;
  // The order to ring in (rounds, plain hunt): the next six bells above the pads, the first one large.
  if (ordered && pads[0]) {
    const y = pads[0].y - pads[0].r - 34; g.textAlign = 'center';
    for (let k = 0; k < 6; k++) {
      const i = s.order[(s.orderAt + k) % s.order.length];
      g.font = k ? '15px Georgia' : 'bold 22px Georgia'; g.fillStyle = k ? palette.bells[i] + '99' : palette.bells[i];
      g.fillText(String(i + 1), W / 2 - 50 + k * 22 - (k ? 0 : 6), y);
    }
  }
  s.bells.forEach((b, i) => {
    if (b.free) return;
    const p = pads[i], v = view(s, i), color = palette.bells[i];
    circle(p.x, p.y, p.r + 6, null, color + '20', 1);
    if (v.ready) { g.shadowColor = color; g.shadowBlur = reduced ? 0 : 24; circle(p.x, p.y, p.r, color + '30', color, 3); g.shadowBlur = 0; }
    else circle(p.x, p.y, p.r, palette.panel, color + '60', 1.5);
    if (ordered && v.next) circle(p.x, p.y, p.r + 11, null, palette.ink, 2);
    g.beginPath(); g.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, v.energy))); g.lineWidth = 3; g.strokeStyle = color; g.stroke();
    bell(p.x, p.y, 26, color, 0, Math.min(1, v.hitFlash * 5), b.muffle > 1);
    const phase = v.phase % (Math.PI * 2); circle(p.x + Math.sin(phase) * (p.r + 6), p.y - Math.cos(phase) * (p.r + 6), 3.2, palette.ink);
    if (s.bells.length > 1) { g.textAlign = 'center'; g.font = (ordered && v.next ? 'bold 15px' : '12px') + ' system-ui'; g.fillStyle = ordered && !v.next ? palette.ink + '66' : palette.ink; g.fillText(String(i + 1), p.x, p.y + p.r + 22); }
    if (v.missFlash > 0) { g.fillStyle = '#ef9b93'; g.font = 'bold 18px system-ui'; g.textAlign = 'center'; g.fillText('×', p.x, p.y - p.r - 14); }
  });
}
function hud() {
  const hudX = 22 + safeLeft;
  g.textAlign = 'left'; g.fillStyle = palette.ink; g.font = '11px system-ui';
  g.fillText(s.endless ? t('hudEndless') : s.daily ? t('hudDaily') : t('hudNight', { n: s.level, of: LEVELS }), hudX, top + 30);
  g.font = '23px Georgia';
  const count = s.endless ? t('lightsN', { n: Math.floor(s.score) }) : `${Math.min(s.target, Math.floor(s.lights))} / ${s.target}`;
  g.fillText(count, hudX, top + 57);
  if (!s.endless) {
    const parts = [];
    if (s.need > 1 || (s.need === 1 && s.bells.length > 1 && s.lights >= s.target)) parts.push(t('needTogether', { n: Math.min(s.harmony, s.need), of: s.need }));
    if (s.chordNeed) parts.push(t('needChord', { n: Math.min(s.chords, s.chordNeed), of: s.chordNeed }));
    if (parts.length) { const w = g.measureText(count).width; g.font = '13px system-ui'; g.fillStyle = palette.accent; g.fillText(parts.join('   '), hudX + w + 14, top + 55); }
  }
  const width = Math.min(W - 110 - safeLeft - safeRight, 240), full = !s.endless && s.lights >= s.target;
  g.fillStyle = '#ffffff16'; g.fillRect(hudX, top + 70, width, 3);
  g.fillStyle = palette.accent; g.globalAlpha = full && s.hold && !reduced ? .6 + .4 * Math.sin(s.t * 6) : 1;
  g.fillRect(hudX, top + 70, width * (s.endless ? Math.min(1, s.bells.reduce((a, b) => a + b.energy, 0) / s.bells.length) : litShare()), 3); g.globalAlpha = 1;
}
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, palette.sky); bg.addColorStop(.7, palette.horizon); bg.addColorStop(1, palette.sky); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 45; i++) { const x = ((i * 83 + 19) % 397) / 397 * W, y = ((i * 47 + 13) % 271) / 271 * H * .55; circle(x, y, i % 5 === 0 ? 1.4 : .7, palette.ink + (i % 3 === 0 ? '88' : '40')); }
  circle(W * .83, H * .11 + top, 17, palette.ink); circle(W * .83 - 7, H * .11 + top - 5, 16, palette.sky);
  village(); tower();
  if (burst > 0 && !reduced) { g.globalAlpha = burst * .10; g.fillStyle = palette.accent; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  if (mode !== 'menu') {
    hud(); controls();
    if (help.shown && !reduced && s.level === 1 && !s.daily) {
      const p = pads[0], ready = view(s, 0).ready, lift = ready ? 0 : HINT_LIFT;
      g.save(); g.translate(p.x + 8, p.y + lift); g.globalAlpha = .88; g.fillStyle = palette.ink; g.shadowColor = '#0008'; g.shadowBlur = 6;
      g.beginPath(); g.roundRect(-4, 0, 9, 35, 4); g.fill(); g.beginPath(); g.roundRect(-4, 24, 31, HINT_HEIGHT - 24, 9); g.fill();
      g.beginPath(); g.roundRect(5, 16, 8, 22, 4); g.roundRect(13, 20, 8, 20, 4); g.roundRect(21, 25, 7, 18, 4); g.fill();
      g.restore(); if (ready) circle(p.x, p.y, p.r - 5, null, palette.ink, 2);
    }
    if (burst > .1 && mode === 'play') {
      const word = s.woke && !s.harmony && !s.chords ? 'woke' : s.chordNeed ? 'chord' : 'together';
      g.textAlign = 'center'; g.font = '14px Georgia'; g.fillStyle = palette.ink; g.fillText(s.bells.length > 1 ? t(word) : '✦', W / 2, H * .58);
    }
    if (ropeFlash > 0 && s.shorten?.done && mode === 'play') { g.textAlign = 'center'; g.font = '13px system-ui'; g.fillStyle = palette.accent; g.globalAlpha = Math.min(1, ropeFlash); g.fillText(t('rope'), W / 2, H * .62); g.globalAlpha = 1; }
    if (s.timeLimit > 0 && !s.endless && mode === 'play') {
      g.textAlign = 'right'; g.font = '11px system-ui'; g.fillStyle = palette.ink + '99';
      g.fillText(`${Math.ceil(Math.max(0, s.timeLimit - (s.t - s.held)))}s`, W - 22 - safeRight, H - bottom - 25);
    }
  }
  for (const f of fx) {
    const p = f.t / f.life;
    if (f.kind === 'word') { g.save(); g.globalAlpha = Math.max(0, 1 - p * p); g.textAlign = 'center'; g.font = 'bold 15px Georgia'; const wy = f.y - (reduced ? 0 : p * 22); g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = '#0b1622c0'; g.strokeText(f.text, f.x, wy); g.fillStyle = f.c; g.fillText(f.text, f.x, wy); g.restore(); continue; }
    if (f.kind === 'ring') { g.globalAlpha = Math.max(0, 1 - p); circle(f.x, f.y, 24 + f.t * 90, null, f.c, 2); g.globalAlpha = 1; }
    else { const to = winPos[f.k]; if (!to) continue; const e = p * p * (3 - 2 * p), x = f.x + (to[0] - f.x) * e, y = f.y + (to[1] - f.y) * e - Math.sin(p * Math.PI) * 40; circle(x, y, 3.5, f.c); g.globalAlpha = .35; circle(x, y, 8, f.c); g.globalAlpha = 1; }
  }
}
function frame(now) {
  const a = performance.now();
  const elapsed = Math.min(.075, Math.max(0, (now - last) / 1000)); last = now;
  if (mode === 'play') { accumulator += elapsed; while (accumulator >= DT && mode === 'play') { update(); accumulator -= DT; } cue(); }
  else if (mode === 'menu') { s.t += elapsed; for (const b of s.bells) b.phase += elapsed * b.omega; }
  if (mode !== 'paused') {
    burst = Math.max(0, burst - elapsed * .65); ropeFlash = Math.max(0, ropeFlash - elapsed);
    for (let i = 0; i < 3; i++) replayFlash[i] = Math.max(0, replayFlash[i] - elapsed);
    for (let r = 0; r < 88; r++) if (pops[r] > 0) pops[r] = Math.max(0, pops[r] - elapsed);
    fx = fx.filter(f => { f.t += elapsed; if (f.kind === 'spark' && f.t >= f.life) pops[f.k] = .5; return f.t < f.life; });
    tickReplay();
  }
  draw();
  costs[costAt++ % costs.length] = performance.now() - a;
  requestAnimationFrame(frame);
}
function frameCost() { const c = [...costs.slice(0, Math.min(costAt, costs.length))].sort((x, y) => x - y); return c.length ? { n: c.length, median: c[c.length >> 1], p95: c[Math.floor(c.length * .95)], max: c[c.length - 1] } : null; }
window.bellsState = () => ({
  ...structuredClone(s), screen: mode, W, H, views: s.bells.map((_, i) => view(s, i)), saved: structuredClone(save),
  more: structuredClone(more), dailySave: structuredClone(daily), music: musicOn, lang: WORDS.lang(), today, chapter, cue: objective.hidden ? '' : objective.textContent,
  pads: structuredClone(pads), positions: structuredClone(positions), markers: structuredClone(markers), gallery: { ...gallery }, hintBottom: pads[0]?.y + HINT_LIFT + HINT_HEIGHT,
  replay: replay ? { k: replay.k, of: replay.notes.length } : null, strikes: strikes.length, voices: strikes.reduce((o, n) => (o[n.voice] = (o[n.voice] || 0) + 1, o), {}), frame: frameCost(), picture: !!picture,
  minTouchPx: Math.min(...[...document.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))),
});
if (query.get('test') === '1') window.bellsPicture = async () => { const p = picture || await makePicture(); if (!p) return null; return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(p); }); };
if (query.get('test') === '1') window.bellsAdvance = seconds => { if (mode === 'play') { for (let i = 0; i < Math.ceil(Math.min(120, Math.max(0, seconds)) / DT) && mode === 'play'; i++) update(); } return window.bellsState(); };
applyPalette(); menu(); requestAnimationFrame(frame);

// The notice is on the menu card, seen before Play; the switch is on the pause card.
rec.notice($('menu').firstElementChild); rec.toggle($('paused').firstElementChild);
