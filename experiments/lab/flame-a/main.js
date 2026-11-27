import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { lab } from '../../kit/lab.js';
import { drag } from '../../kit/drag.js';
import { settings } from '../../kit/settings.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { read, write } from '../../kit/save.js';
import { shareLink } from '../../kit/room.js';
import { noZoom } from '../../kit/zoom.js';
import { createRun, step, addCarrier, newChain, encodeLink, decodeLink, validName } from './sim.js';
import { river } from './render.js';
import { t, lang, setLang, apply } from './words.js';

const el = id => document.getElementById(id);
const canvas = el('river');
const draw = river(canvas);
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const rec = lab('flame-a', { lang });
const prefs = settings('flame', {
  look: { values: ['paper', 'thermal', 'storm'], def: 'paper' },
  drop: { values: ['dims', 'ends'], def: 'dims' },
  retryRule: { values: ['allow', 'once'], def: 'allow' },
  sound: { values: ['on', 'off'], def: 'on' },
  haptics: { values: ['on', 'off'], def: 'on' }
}, { rec });
noZoom();
rec.notice(el('notice'));
rec.toggle(el('recording'));

let chain = decodeLink(location.hash);
let byLink = Boolean(chain);
chain ??= newChain(randomSeed());
let run = createRun(chain);
let screen = 'arrival', age = 0, time = 0, target = 0;
let paused = false, revealed = false, sending = false;
let nextSeed, dropRule, notesPlayed = 0, heldKey = 0;
let options = prefs.snapshot();
let song, drone;
const snd = sound({
  on: () => options.sound === 'on',
  setup(ac) {
    song = music(ac, { preset: 'river' });
    song.volume(0.56);
    song.start(chain.seed);
    const pitch = ac.createOscillator(), gain = ac.createGain(), filter = ac.createBiquadFilter();
    pitch.type = 'sawtooth';
    pitch.frequency.value = 73.42;
    filter.type = 'lowpass';
    filter.frequency.value = 110;
    gain.gain.value = 0;
    pitch.connect(filter).connect(gain).connect(ac.destination);
    pitch.start();
    drone = { gain, filter, ac };
  }
});
function score() {
  const on = screen === 'leg' && !paused && options.sound === 'on';
  const light = run.flame / 100;
  song?.set({ on, progress: run.progress, danger: 1 - light, light });
  if (drone) {
    drone.gain.gain.setTargetAtTime(on ? 0.023 : 0, drone.ac.currentTime, 0.15);
    drone.filter.frequency.setTargetAtTime(110 + 470 * light, drone.ac.currentTime, 0.2);
  }
}
function chime() {
  snd.tone(392, 0.55, 0.09, 'sine', 132);
  snd.tone(784, 1.05, 0.042, 'triangle');
}
const nickname = el('nickname');
const storedName = read('flame:name', '');
nickname.value = validName(storedName) ? storedName : '';
const displayName = () => nickname.value.trim().normalize('NFC');
const number = n => Math.round(n).toLocaleString(lang());
const resultScreen = () => screen === 'drop' || screen === 'handoff';
const mayPass = () => screen === 'handoff' || (screen === 'drop' && dropRule === 'dims');
const passLevel = () => screen === 'drop' ? 18 : Math.max(1, Math.round(run.flame));
let historyLabels = [];
function updateNames() {
  historyLabels = chain.carriers.map(c => ({ ...c, name: c.name || t('anonymous') }));
  if (!resultScreen()) return;
  const current = validName(displayName()) && displayName() || t('you');
  historyLabels.push({ name: current, distance: Math.round(run.distance) });
  const list = el('carriers');
  list.replaceChildren();
  const add = text => {
    const li = document.createElement('li');
    li.textContent = text;
    list.append(li);
  };
  if (chain.count > chain.carriers.length) add(t('older', { n: number(chain.count - chain.carriers.length) }));
  for (const c of historyLabels) add(c.name);
}
function updateText() {
  apply();
  el('language').value = lang();
  const prev = chain.carriers.at(-1);
  el('arrivalTitle').textContent = prev ? t('linkedTitle', { count: number(chain.count) }) : t('virginTitle');
  el('arrivalStory').textContent = prev ? t('linkedStory', { name: prev.name || t('anonymous'), distance: number(prev.distance) }) : t('virginStory');
  if (resultScreen()) {
    el('resultTitle').textContent = t(screen === 'handoff' ? 'handoffTitle' : mayPass() ? 'dimTitle' : 'dropTitle');
    el('resultStats').textContent = t('stats', { distance: number(run.distance), flame: mayPass() ? passLevel() : 0 });
  }
  updateNames();
}
function panels() {
  el('arrival').hidden = screen !== 'arrival';
  el('progress').hidden = screen !== 'leg';
  el('result').hidden = !revealed;
  el('pass').hidden = !mayPass();
  el('nameField').hidden = !mayPass();
  el('newFlame').hidden = screen !== 'drop';
  el('retry').hidden = screen !== 'drop' || options.retryRule !== 'allow';
  el('paused').hidden = !paused || el('settings').open;
}
function reset(next, linked) {
  chain = next;
  byLink = linked;
  run = createRun(chain);
  screen = 'arrival';
  age = target = heldKey = 0;
  revealed = paused = false;
  el('shareUrl').hidden = true;
  el('shareStatus').textContent = '';
  nickname.setCustomValidity('');
  steer.reset();
  updateText();
  panels();
  canvas.focus({ preventScroll: true });
}
function start() {
  if (screen !== 'arrival' || el('settings').open) return;
  screen = 'leg';
  age = 0;
  snd.release();
  snd.unlock();
  song?.start(chain.seed);
  rec.start({ ...options, chain: chain.count, byLink });
  chime();
  panels();
}
function end() {
  screen = run.outcome;
  dropRule = options.drop;
  age = notesPlayed = heldKey = 0;
  nextSeed = randomSeed();
  steer.drop();
  rec.event(screen, { distance: Math.round(run.distance), flame: Math.round(run.flame) });
  rec.end(screen, { distance: Math.round(run.distance), flame: Math.round(run.flame) });
  if (screen === 'handoff') chime();
  score();
  updateText();
  panels();
}
function pause() {
  if (screen !== 'leg' || paused) return;
  paused = true;
  heldKey = 0;
  steer.drop();
  score();
  snd.hold();
  panels();
}
function resume() {
  if (el('settings').open || !paused) return;
  paused = false;
  snd.release();
  panels();
}
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  start();
});
const steer = drag(canvas, {
  playing: () => screen === 'leg' && !el('settings').open,
  paused: () => paused, resume, from: () => run.x,
  travel: dx => dx * 2.65 / Math.min(canvas.clientWidth, canvas.clientHeight),
  aim: x => { target = Math.max(-1, Math.min(1, x)); },
  mouse: e => { target = draw.aim(e.clientX); }, settle: 8
});
onLeave(pause);
el('resume').onclick = resume;
el('gear').onclick = () => {
  pause();
  el('settings').showModal();
  panels();
};
el('closeSettings').onclick = () => el('settings').close();
el('settings').addEventListener('close', () => { resume(); panels(); });
const redrawOptions = prefs.panel(el('options'), {
  label: id => t(id), name: (_, value) => t(value),
  onChange(id) {
    options = prefs.snapshot();
    document.documentElement.dataset.look = options.look;
    if (id === 'sound') {
      if (options.sound === 'on') { if (!paused) snd.release(); snd.unlock(); }
      else snd.hold();
    }
    panels();
  }
});
el('language').onchange = () => {
  setLang(el('language').value);
  el('shareStatus').textContent = '';
  nickname.setCustomValidity('');
  updateText();
  redrawOptions();
};
addEventListener('keydown', e => {
  if (el('settings').open || e.target.closest('input,select,textarea')) return;
  if (isPauseKey(e)) { if (!e.repeat) paused ? resume() : pause(); return; }
  if (e.target.closest('button,a')) return;
  if (['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
    e.preventDefault();
    if (paused) resume(); else start();
    if (screen === 'leg' && e.key.startsWith('Arrow')) heldKey = e.key === 'ArrowLeft' ? -1 : 1;
  }
});
addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) heldKey = 0; });
el('retry').onclick = () => reset(chain, byLink);
el('newFlame').onclick = () => {
  const clean = new URL(location.href);
  clean.hash = '';
  history.replaceState(null, '', clean);
  reset(newChain(randomSeed()), false);
};
nickname.addEventListener('input', () => {
  nickname.setCustomValidity('');
  el('shareUrl').hidden = true;
  el('shareStatus').textContent = '';
  updateNames();
});
el('pass').onclick = async () => {
  if (!mayPass() || sending) return;
  const name = displayName();
  if (!validName(name)) {
    nickname.setCustomValidity(t('invalidName'));
    nickname.reportValidity();
    return;
  }
  write('flame:name', name);
  const next = addCarrier(chain, name, run.distance, passLevel(), nextSeed);
  const url = new URL(location.pathname, location.href);
  url.hash = encodeLink(next);
  sending = true;
  try {
    const how = await shareLink(url.href, t('shareText', { count: number(next.count), distance: number(run.distance) }));
    rec.event('pass_send', { how });
    el('shareStatus').textContent = t(how === 'shown' ? 'manual' : how);
    el('shareUrl').hidden = how !== 'shown';
    if (how === 'shown') {
      el('shareUrl').value = url.href;
      el('shareUrl').focus();
      el('shareUrl').select();
    }
  } finally { sending = false; }
};

let last = performance.now(), soundAt = -1;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!paused && !el('settings').open && !document.hidden) {
    age += dt;
    time += dt;
    if (screen === 'leg' && age > 0.85) {
      if (heldKey) target = Math.max(-1, Math.min(1, target + heldKey * dt * 1.6));
      for (const event of step(run, dt, target)) {
        rec.event(event.type, { kind: event.kind, flame: Math.round(run.flame) });
        if (event.type === 'ember') song?.ember();
        else {
          song?.hit();
          snd.noise(0.15, 0.16, 410);
          if (options.haptics === 'on') navigator.vibrate?.(22);
        }
      }
      if (run.outcome) end();
    }
    if (time - soundAt > 0.15) { score(); soundAt = time; }
    if (resultScreen() && !revealed) {
      const lights = Math.min(64, chain.count + 1);
      const interval = Math.min(0.32, 2.6 / lights);
      if (screen === 'drop' && notesPlayed < lights && age >= 0.22 + notesPlayed * interval) {
        snd.tone(440 * 2 ** (-2 * notesPlayed / lights), 0.52, 0.065, 'sine', -35);
        notesPlayed++;
      }
      if (age > (screen === 'drop' ? 0.8 + lights * interval : 0.95)) { revealed = true; panels(); }
    }
  }
  el('progress').value = run.progress;
  const objects = screen !== 'leg' ? [] : run.items.filter(item =>
    !item.used && (item.kind !== 'rock' || run.elapsed >= 8) &&
    item.at - run.elapsed < 8 && item.at - run.elapsed > -1)
    .map(item => ({ kind: item.kind, x: item.x, ahead: item.at - run.elapsed }));
  draw({ screen, look: options.look, time, age, x: run.x, flame: run.flame / 100, objects,
    history: historyLabels, chain: chain.count + Number(resultScreen()), progress: run.progress, emberAge: run.elapsed - run.lastEmber,
    hitAge: run.elapsed - run.lastHit, transferAge: screen === 'leg' ? age : Infinity });
  requestAnimationFrame(frame);
}
window.flameState = () => ({ screen, playing: screen === 'leg' && !paused, flame: run.flame, progress: run.progress, chain: chain.count });
window.flameSim = () => run;
document.documentElement.dataset.look = options.look;
updateText();
panels();
requestAnimationFrame(frame);
