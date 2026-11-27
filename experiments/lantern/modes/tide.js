// Lantern Tide, a mode of Lantern. Ride the bright water: in the channel the boat runs fast and the flame holds; in slack water
// the flame burns down. The rules are Lantern's (../sim.js, unchanged) under the tide layer (./tide-sim.js). index.html draws the
// river, the boat, the dark and the embers as on a story night; this file draws the water on it (the channel, its flecks, the
// lees) through the page's water() hook, plays the water's sounds and keeps Tide's own save. How a mode plugs in is in
// ../NOTES.md ("How a mode plugs in"); why Tide is built this way is under "Tide is a mode inside Lantern".
import { start, tick, jet, strength, rating, reach, centre, half, NIGHTS } from './tide-sim.js?v=1';
import { read, readJson, writeJson } from '../../kit/save.js';
import { t } from '../words.js?v=1';

// Save. lantern-mode-tide:save is { v: 1, best: highest stage open, stars: { stage: 0..3 }, far: { stage: best % reached }, played: runs }.
// The lab page's save (lantern-tide:night, '2' once its first night was won) is read once to open stage 2, and never written.
const KEY = 'lantern-mode-tide:save', OLD = 'lantern-tide:night';
function load() {
  let raw = readJson(KEY);
  if (raw === null && read(OLD) === '2') { raw = { v: 1, best: 2, stars: {}, far: {}, played: 0 }; writeJson(KEY, clean(raw)); }
  return clean(raw);
}
function clean(raw) {
  const v = raw && typeof raw === 'object' ? raw : {}, stars = {}, far = {};
  for (let n = 1; n <= NIGHTS; n++) {
    const k = Math.floor(v.stars?.[n]); if (k > 0) stars[n] = Math.min(3, k);
    const f = Math.floor(v.far?.[n]); if (f > 0) far[n] = Math.min(100, f);
  }
  return { v: 1, best: Math.max(1, Math.min(NIGHTS, Math.floor(v.best) || 1)), stars, far, played: Math.max(0, Math.floor(v.played) || 0) };
}

const STYLE = `
#modePanel .nights { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: .6em 0 .3em; }
#modePanel .nights button { min-width: 48px; width: 48px; height: 56px; padding: 0; margin: 0; border-radius: 14px; display: grid; place-items: center; line-height: 1; font-size: 18px; }
#modePanel .nights button small { display: block; font-size: 14px; color: #ffcf6e; letter-spacing: -1px; margin-top: 2px; }
#modePanel .nights button.on { border-color: #ffd9a0; background: #ffd9a022; box-shadow: 0 0 14px #ffb45a55; }
#modePanel .nights button:disabled { opacity: .3; }
`;
const idea = n => t(`tideIdea${n}`);

// page: what index.html lends a mode. See ../NOTES.md for each name.
export function mode(page) {
  const save = load();
  let night = save.best, e = null, rushGain = null, lastLee = 0, W = 1, H = 1, unit = 1, left = 0, dpr = 1;
  if (!document.getElementById('modeNightsStyle')) { const css = document.createElement('style'); css.id = 'modeNightsStyle'; css.textContent = STYLE; document.head.append(css); }
  const size = () => ({ W, H, unit, left, dpr } = page.size());
  const sx = x => left + x * unit, sy = y => H * 0.74 - (y - e.s.y) * unit;

  // ------------------------------------------------------------ the mode's card: stages, stars, play
  function card(box) {
    box.textContent = '';
    const h = document.createElement('h2'); h.textContent = t('modeTide');
    const what = document.createElement('p'); what.textContent = t('modeTideWhat');
    const row = document.createElement('div'); row.className = 'nights';
    for (let n = 1; n <= NIGHTS; n++) {
      const b = document.createElement('button'), st = save.stars[n] | 0;
      b.innerHTML = `${n}<small>${'★'.repeat(st)}${'·'.repeat(3 - st)}</small>`; b.dataset.night = n;
      b.disabled = n > save.best; b.classList.toggle('on', n === night); b.setAttribute('aria-label', t('tideNightAria', { n, k: st }));
      b.addEventListener('click', () => { night = n; page.tone(520 + 50 * n, 0.12, 0.06, 'triangle'); card(box); });
      row.append(b);
    }
    const now = document.createElement('p'); now.className = 'hint'; now.textContent = t('tideSay', { n: night, idea: idea(night) });
    const go = document.createElement('button'); go.className = 'main'; go.id = 'modePlay'; go.textContent = t('tidePlay', { n: night }); go.addEventListener('click', () => page.play());
    const p = document.createElement('p'); p.append(go);
    const rule = document.createElement('p'); rule.className = 'hint'; rule.textContent = t('tideStars');
    box.append(h, what, row, now, p, rule);
    if (read('lantern-view', '2d') !== '2d') { const flat = document.createElement('p'); flat.className = 'hint'; flat.textContent = t('tideFlat'); box.append(flat); }
  }

  // ------------------------------------------------------------ the run
  function begin() {
    e = start((Math.random() * 2 ** 31) | 0, night); // Tide lays no abilities: a flare or a boost would hold the flame up and the water would not matter
    lastLee = 0;
    return e.s;
  }
  function step(target) {
    tick(e, target);
    return [...e.s.events, ...e.events];
  }
  function react(ev) { // the page has already played its own sound for Lantern's events; these are the water's
    if (ev === 'fast') { page.noise(0.35, 0.08, 1800); page.tone(392, 0.25, 0.03, 'sine', 40); }
    if (ev === 'lee' && performance.now() - lastLee > 900) { lastLee = performance.now(); page.tone(1046.5, 0.7, 0.04, 'sine'); setTimeout(() => page.tone(1568, 0.6, 0.025, 'sine'), 90); }
  }
  // The end of a run: Tide's own save, then the card's words. Nothing here touches Lantern's nights, bests or board.
  function end() {
    const won = e.s.over === 'dawn', st = rating(e), n = night, pct = Math.floor(reach(e) * 100);
    save.played++; save.far[n] = Math.max(save.far[n] | 0, won ? 100 : pct);
    if (won) { save.stars[n] = Math.max(save.stars[n] | 0, st); if (n < NIGHTS) save.best = Math.max(save.best, n + 1); }
    writeJson(KEY, save);
    const mark3 = ' ' + '★'.repeat(st) + '☆'.repeat(3 - st);
    if (won && n >= NIGHTS) return { title: t('dawn') + mark3, line: t('tideAll', { n: NIGHTS }), go: t('tidePlay', { n }) };
    if (won) { night = n + 1; return { title: t('dawn') + mark3, line: t('tideWon', { s: Math.round(e.ridden), next: n + 1, idea: idea(n + 1) }), go: t('tidePlay', { n: night }) }; }
    const why = t(['dark', 'bank', 'ice', 'log', 'pool', 'geyser', 'isle'].includes(e.s.over) ? `why_${e.s.over}` : 'why_rock');
    return { title: t('dawnResult', { n: pct }), line: t('tideLost', { why, far: save.far[n] }), go: t('playAgain') };
  }

  // ------------------------------------------------------------ sound between frames: the rush of fast water under the hull
  function frame(dt, now, playing) {
    const ac = page.ctx(); if (!ac || !e) return;
    if (!rushGain) {
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
      rushGain = ac.createGain(); rushGain.gain.value = 0; src.connect(bp).connect(rushGain).connect(ac.destination); src.start();
    }
    rushGain.gain.setTargetAtTime(playing ? 0.18 * e.flow.rush : 0, ac.currentTime, 0.12);
  }
  function quiet() { if (rushGain && page.ctx()) rushGain.gain.setTargetAtTime(0, page.ctx().currentTime, 0.05); }

  // ------------------------------------------------------------ the water, drawn on the page's river under the rocks and the dark
  const hash = i => { const f = Math.sin(i * 12.9898) * 43758.5453; return f - Math.floor(f); };
  function water(now) {
    if (!e) return;
    size();
    const g = page.g(), s = e.s, tt = now / 1000, top = s.y + 0.74 * H / unit + 0.1, bot = s.y - 0.3 * H / unit - 0.1;
    const edge = (y, side) => { const c = centre(s, y), h = half(s, y), j = jet(e, y, s.t); return sx(c + h * Math.max(-1, Math.min(1, j + side * 0.3))); };
    // The channel: a band of bright water that winds down the river, dim where the tide is slack.
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let y = bot; y < top; y += 0.06) {
      const a = 0.16 * strength(e, y + 0.03);
      g.fillStyle = `rgba(150,215,255,${a})`; g.beginPath();
      g.moveTo(edge(y, -1), sy(y)); g.lineTo(edge(y, 1), sy(y)); g.lineTo(edge(y + 0.061, 1), sy(y + 0.061)); g.lineTo(edge(y + 0.061, -1), sy(y + 0.061)); g.closePath(); g.fill();
    }
    // Flecks in the channel run with the current, faster than the boat drifts in slack water, so they slide ahead of it.
    g.lineCap = 'round'; g.lineWidth = 2 * dpr;
    for (let i = Math.floor(bot * 9); i < top * 9; i++) for (const lane of [-0.18, 0, 0.18]) {
      const y = i / 9 + ((tt * 0.45 + hash(i) * 0.3) % (1 / 9)) - 0.04 * lane, a = strength(e, y);
      if (a < 0.3) continue;
      const x = centre(s, y) + half(s, y) * (jet(e, y, s.t) + lane + 0.06 * (hash(i + lane * 7) - 0.5));
      g.strokeStyle = `rgba(225,245,255,${0.5 * a})`; g.beginPath(); g.moveTo(sx(x), sy(y)); g.lineTo(sx(x), sy(y - 0.05)); g.stroke();
    }
    // Lees: still, warm water behind a rock, with slow level ripples (a whirlpool spins and is dark in the middle; a lee does neither).
    if (e.cf.relight > 0) for (const k of s.rocks) {
      if (!k.on || k.y < bot - 0.7 || k.y > top) continue;
      const X = sx(k.x), Y = sy(k.y + k.rad + 0.22), RX = (k.rad + 0.045) * unit, RY = 0.26 * unit;
      const lg = g.createRadialGradient(X, Y, 0, X, Y, RY); lg.addColorStop(0, 'rgba(255,210,130,.22)'); lg.addColorStop(1, 'rgba(255,210,130,0)');
      g.fillStyle = lg; g.beginPath(); g.ellipse(X, Y, RX, RY, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,225,170,.35)'; g.lineWidth = 1.5 * dpr;
      for (let j = 0; j < 3; j++) { const yy = Y + (j - 1) * RY * 0.45 + Math.sin(tt * 0.8 + j) * 2 * dpr, w = RX * (0.75 - 0.15 * Math.abs(j - 1)); g.beginPath(); g.moveTo(X - w, yy); g.lineTo(X + w, yy); g.stroke(); }
    }
    g.restore();
  }

  return {
    id: 'tide',
    card,
    start: () => begin(), // abilities are not laid in Tide
    step, react,
    reach: () => e ? reach(e) : 0,
    night: () => night,
    hello: () => t('tideSay', { n: night, idea: idea(night) }),
    pauseLine: () => t('tidePause', { n: night, pct: Math.floor(reach(e) * 100) }),
    end, frame,
    water, // no draw(): the page draws the river, and this draws the tide on it
    screen(name, box) {
      if (name !== 'play') quiet();
      if (name === 'mode') card(box);
      if (name === 'menu') e = null;
    },
    state: () => ({ night, best: save.best, stars: save.stars, far: save.far, played: save.played, reach: e ? reach(e) : 0, rush: e?.flow.rush, lee: e?.flow.lee, ridden: e?.ridden, light: e?.s.light, stage: e?.cf.n }),
    game: () => e, // the browser check reads the river through this
  };
}
