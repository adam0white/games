// Lantern Duet, a mode of Lantern. Two boats, one thumb each, joined by a rope of light. The rope takes the embers it sweeps over;
// a rock that passes between the boats snags it, and after 0.5 s the snag costs a shared heart. The rules are the lab page's
// (./duet-sim.js, a byte-for-byte copy of archive/lab/lantern-duet/sim.js). This file draws them as the lab page did, with its own
// camera, steers each boat from its own half of the screen, and keeps Duet's own save. How a mode plugs in is in ../NOTES.md
// ("How a mode plugs in"); why Duet is built this way is under "Duet is a mode inside Lantern".
import { create, step, centre, half, fall, progress, speed, NIGHTS } from './duet-sim.js';
import { hull, wake, reeds } from '../looks.js?v=4';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';
import { read, readJson, writeJson } from '../../kit/save.js';
import { t } from '../words.js?v=1';

// Save. lantern-mode-duet:save is { v: 1, best: { night, pct }, unlocked: nights open, played: runs }.
// The lab page's save (lantern-duet:v1, { best, unlocked, sound }) is read once for its best and its nights, and never written.
const KEY = 'lantern-mode-duet:save', OLD = 'lantern-duet:v1', HINT_KEY = 'lantern-mode-duet:hint';
function load() {
  let raw = readJson(KEY);
  if (raw === null) { const old = readJson(OLD); if (old && typeof old === 'object') { raw = { v: 1, best: old.best, unlocked: old.unlocked, played: 0 }; writeJson(KEY, clean(raw)); } }
  return clean(raw);
}
function clean(raw) {
  const v = raw && typeof raw === 'object' ? raw : {}, n = Math.floor(v.best?.night) || 0, p = Math.floor(v.best?.pct) || 0;
  const best = n >= 1 && n <= NIGHTS ? { night: n, pct: Math.max(0, Math.min(100, p)) } : { night: 0, pct: 0 };
  return { v: 1, best, unlocked: Math.max(1, Math.min(NIGHTS, Math.floor(v.unlocked) || 1)), played: Math.max(0, Math.floor(v.played) || 0) };
}

// Framing, from the lab page. The camera follows the river and zooms so the river ahead always shows for SHOW_AHEAD seconds.
const BOAT_ROW = 0.8; // the boats' row, as a share of the screen height from the top
const HUD_PX = 64; // CSS px at the top that Lantern's HUD covers
const VIEW_WIDTH = 0.8; // river units across the screen at the closest zoom
const SHOW_AHEAD = 1.35; // seconds of river shown above the boats, below the HUD
const MIN_AHEAD = 0.95; // river units always shown above the boats
const GAIN = 1.3; // river units a boat moves for one screen unit of finger travel
const KEY_STEP = 0.08; // river units ahead of a boat that a held key aims
const BANK = '#0e1a12', EDGE = '#5c8468', DARK = 0.8, ROPE = '226,184,116', WARN = '255,138,74';

const STYLE = `
#modePanel .nights { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: .6em 0 .3em; }
#modePanel .nights button { min-width: 48px; width: 48px; height: 56px; padding: 0; margin: 0; border-radius: 14px; display: grid; place-items: center; line-height: 1; font-size: 18px; }
#modePanel .nights button.on { border-color: #ffd9a0; background: #ffd9a022; box-shadow: 0 0 14px #ffb45a55; }
#modePanel .nights button:disabled { opacity: .3; }
.duetPad { position: fixed; top: calc(64px + env(safe-area-inset-top)); bottom: 0; width: 50%; touch-action: none; display: none; }
.duetPad.on { display: block; }
#duetL { left: 0; } #duetR { right: 0; }
#duetSplit { position: fixed; top: calc(64px + env(safe-area-inset-top)); bottom: 0; left: 50%; width: 1px; background: linear-gradient(#ffffff00, #ffffff14 40%, #ffffff00); pointer-events: none; display: none; }
#duetKeys { position: fixed; bottom: calc(14px + env(safe-area-inset-bottom)); left: 0; right: 0; display: none; justify-content: space-around; pointer-events: none; font: 11px sans-serif; letter-spacing: .12em; color: #d8c6a888; text-transform: uppercase; }
#duetSplit.on { display: block; } #duetKeys.on { display: flex; }
`;

// page: what index.html lends a mode. See ../NOTES.md for each name.
export function mode(page) {
  const save = load();
  let night = Math.min(NIGHTS, save.unlocked), s = null, target = [0, 0], saidEmber = false, overAt = 0, on = false;
  let W = 1, H = 1, dpr = 1, unit = 400, camX = 0.5;
  const keys = new Set();
  if (!document.getElementById('duetStyle')) { const css = document.createElement('style'); css.id = 'duetStyle'; css.textContent = STYLE; document.head.append(css); }
  const shade = document.createElement('canvas'), sg = shade.getContext('2d');
  window.lanternDuetAim = (l, r) => { target = [l, r]; }; // the browser check steers both boats with this, as the lab page's lanternAim

  // Each half of the screen steers its own boat by relative drag (kit/drag.js), as on the lab page. The pads lie over the canvas
  // only while a run is on the screen, so the page's own steering never sees these fingers.
  const pad = id => { const el = document.createElement('div'); el.className = 'duetPad'; el.id = id; return el; };
  const pads = [pad('duetL'), pad('duetR')], split = document.createElement('div'), labels = document.createElement('div');
  split.id = 'duetSplit'; labels.id = 'duetKeys'; labels.innerHTML = '<span></span><span></span>';
  document.getElementById('hud').before(...pads, split, labels); // before the HUD, the pause button and every card, and after the page's own hint (its label is the first .kit-hint the page renames)
  const clampToRiver = x => Math.max(centre(s, s.y) - half(s, s.y), Math.min(centre(s, s.y) + half(s, s.y), x));
  const steer = pads.map((el, i) => drag(el, {
    playing: () => page.live(), paused: () => page.paused(), resume: () => page.resume(),
    from: () => (i ? s.right : s.left),
    travel: dx => dx * dpr / unit * GAIN,
    aim: x => { target[i] = clampToRiver(x); },
    mouse: e => { if (e.buttons) target[i] = clampToRiver(camX + (e.clientX * dpr - W / 2) / unit); },
    settle: 12,
  }));
  const help = hint(pads[0], { kind: 'drag', key: HINT_KEY, delay: 2000, bottom: 70, played: save.played > 0 || save.best.night > 0, when: () => on && page.live(), label: t('duetHint') });
  pads[1].addEventListener('pointerdown', () => { if (page.live()) help.done(); });
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (on && page.live() && ['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { e.preventDefault(); keys.add(k); } });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  function words() {
    pads[0].setAttribute('aria-label', t('duetPadL')); pads[1].setAttribute('aria-label', t('duetPadR'));
    const [l, r] = labels.children; l.textContent = t('duetLeft'); r.textContent = t('duetRight');
    const box = pads[0].nextElementSibling; if (box?.classList.contains('kit-hint')) box.querySelector('.label').textContent = t('duetHint');
  }
  // The pads stay over the canvas while the pause card is up: the card lets touches through, and a touch on a pad resumes the run
  // and steers that boat (kit/drag.js), as a touch on the canvas does in Lantern. The split line and the side labels show only in play.
  function shown(name) {
    const play = name === 'play';
    on = s !== null && (play || (name === 'card' && page.paused()));
    for (const el of pads) el.classList.toggle('on', on);
    for (const el of [split, labels]) el.classList.toggle('on', on && play);
    if (!play) { steer.forEach(a => a.drop()); keys.clear(); }
    words();
  }

  // ------------------------------------------------------------ the mode's card: nights, best, play
  const bestText = () => save.best.night ? t('duetBest', { n: save.best.night, pct: save.best.pct }) : '';
  function card(box) {
    box.textContent = '';
    const h = document.createElement('h2'); h.textContent = t('modeDuet');
    const what = document.createElement('p'); what.textContent = t('modeDuetWhat');
    const rule = document.createElement('p'); rule.className = 'hint'; rule.textContent = t('duetRule');
    const row = document.createElement('div'); row.className = 'nights';
    for (let n = 1; n <= NIGHTS; n++) {
      const b = document.createElement('button'); b.textContent = n; b.dataset.night = n;
      b.disabled = n > save.unlocked; b.classList.toggle('on', n === night); b.setAttribute('aria-label', t('nightTitle', { n }));
      b.addEventListener('click', () => { night = n; page.tone(520 + 60 * n, 0.12, 0.06, 'triangle'); card(box); });
      row.append(b);
    }
    const go = document.createElement('button'); go.className = 'main'; go.id = 'modePlay'; go.textContent = t('playNight', { n: night }); go.addEventListener('click', () => page.play());
    const p = document.createElement('p'); p.append(go);
    const best = document.createElement('p'); best.className = 'hint'; best.textContent = bestText();
    const keyLine = document.createElement('p'); keyLine.className = 'hint'; keyLine.textContent = t('duetKeys') + ' ' + t('duetShare');
    box.append(h, what, rule, row, p, best, keyLine);
    if (read('lantern-view', '2d') !== '2d') { const flat = document.createElement('p'); flat.className = 'hint'; flat.textContent = t('duetFlat'); box.append(flat); }
  }

  // ------------------------------------------------------------ the run
  // Lantern's page reads a few of Lantern's own fields off the run's state (its progress line, the waterfall warning, the weather,
  // the melody's missed notes). Duet's state is its own; these fields are set to what a plain story night has, so the page reads
  // them as it would there and nothing in Duet's rules sees them.
  function begin() {
    s = create((Math.random() * 2 ** 32) >>> 0, night);
    Object.assign(s, { bonus: 0, endless: false, tower: false, calm: 1, boost: 0, slow: 0, size: 0, field: 0, shield: 0, st: {}, on: [], powers: [] });
    for (const m of s.embers) m.kind = 'ember';
    target = [s.left, s.right]; saidEmber = false; overAt = 0; keys.clear();
    steer.forEach(a => a.reset());
    return s;
  }
  function stepRun() {
    for (const [i, minus, plus] of [[0, 'a', 'd'], [1, 'arrowleft', 'arrowright']]) {
      const at = i ? s.right : s.left;
      if (keys.has(minus)) target[i] = at - KEY_STEP;
      if (keys.has(plus)) target[i] = at + KEY_STEP;
    }
    step(s, target);
    if (s.events.includes('hurt')) { target = [s.left, s.right]; steer.forEach(a => a.rebase()); } // a held finger steers on from where the boats now are
    if (s.over && !overAt) overAt = performance.now();
    return s.events;
  }
  // The page has played its own sound and words for Lantern's events (an ember's note, a blow, the end); these are Duet's.
  const LINES = { warn: 'duetWarn', narrow: 'duetNarrow', snag: 'duetSnag', free: 'duetFree', snap: 'duetSnap' };
  function react(ev) {
    if (ev === 'warn') page.tone(440, 0.22, 0.07, 'square', 440); // a short rising warning
    else if (ev === 'narrow') page.tone(330, 0.22, 0.06, 'square', 330);
    else if (ev === 'snag') page.tone(220, 0.45, 0.08, 'sawtooth');
    else if (ev === 'free') page.tone(880, 0.15, 0.07, 'triangle', 220);
    else if (ev === 'snap') page.noise(0.2, 0.18, 900);
    if (ev === 'ember' && !saidEmber) { saidEmber = true; page.say(t('duetEmber'), 2000); }
    else if (LINES[ev]) page.say(t(LINES[ev]), 2000);
  }
  // The end of a run: Duet's own save, then the card's words. Nothing here touches Lantern's nights, bests or board.
  function end() {
    const won = s.over === 'dawn', n = night, pct = Math.floor(progress(s) * 100);
    save.played++;
    if ((pct > 0 || won) && (n > save.best.night || (n === save.best.night && pct > save.best.pct))) save.best = { night: n, pct }; // the lab page saved a loss at 0% as a best
    if (won) save.unlocked = Math.max(save.unlocked, Math.min(NIGHTS, n + 1));
    writeJson(KEY, save);
    if (won && n >= NIGHTS) { night = 1; return { title: t('dawn'), line: t('duetAll'), go: t('playNight', { n: 1 }) }; }
    if (won) { night = n + 1; return { title: t('dawn'), line: t('duetWon', { taken: s.taken, snags: s.snags, next: night }), go: t('playNight', { n: night }) }; }
    const why = t(['dark', 'bank', 'rope'].includes(s.over) ? `why_${s.over}` : 'why_rock');
    return { title: t('dawnResult', { n: pct }), line: t('duetLost', { why, snags: s.snags }) + (bestText() ? ' ' + bestText() + '.' : ''), go: t('playAgain') };
  }

  // ------------------------------------------------------------ drawing, from the lab page, in the canvas's device pixels
  const sx = x => W / 2 + (x - camX) * unit, sy = y => H * BOAT_ROW - (y - s.y) * unit;
  const aheadPx = () => H * BOAT_ROW - HUD_PX * dpr;
  const cruise = () => speed(s) / (1 + 0.7 * fall(s, s.y)); // nothing lies in or just after a waterfall, so the zoom stays calm there
  function camera() {
    const need = Math.max(MIN_AHEAD, cruise() * SHOW_AHEAD);
    unit = Math.min(W / VIEW_WIDTH, aheadPx() / need);
    const lo = s.y - (H - H * BOAT_ROW) / unit, hi = s.y + aheadPx() / unit; // centre on the middle of both banks over the visible stretch
    let a = Infinity, b = -Infinity;
    for (let y = lo; y <= hi + 0.05; y += 0.05) { const c = centre(s, y), h = half(s, y); a = Math.min(a, c - h); b = Math.max(b, c + h); }
    const room = W / 2 / unit - 0.03;
    camX = Math.max(s.right - room, Math.min(s.left + room, (a + b) / 2));
  }
  function draw(now, day) {
    ({ W, H, dpr } = page.size());
    const g = page.g();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (!s) { g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H); return; } // the mode's card, before its first run
    camera();
    const tt = now / 1000, lo = s.y - (H - H * BOAT_ROW) / unit - 0.1, hi = s.y + H * BOAT_ROW / unit + 0.1;
    const dawn = Math.max(0, (progress(s) - 0.9) / 0.1);
    g.fillStyle = BANK; g.fillRect(0, 0, W, H);
    riverShape(g, lo, hi); g.fillStyle = page.skin('water')[2]; g.fill();
    reeds(g, (y, side) => sx(centre(s, y) + side * half(s, y)), sy, unit, lo, hi, tt);
    streaks(g, lo, hi);
    waterfall(g, lo, hi, now);
    for (const k of s.rocks) if (k.y > lo && k.y < hi) rockBody(g, k);
    darkness(g, Math.min(1, dawn + day));
    // Above the dark: the banks' edge, rock rims and embers stay readable all the way up the screen.
    riverShape(g, lo, hi); g.strokeStyle = EDGE; g.globalAlpha = 0.55; g.lineWidth = 2 * dpr; g.stroke(); g.globalAlpha = 1;
    if (s.tight) narrowWarning(g, s.tight, tt);
    for (const k of s.rocks) if (k.y > lo && k.y < hi) rockRim(g, k, tt);
    embers(g, lo, hi, tt);
    const gone = s.over && s.over !== 'dawn' ? Math.min(1, (now - overAt) / 900) : 0; // after a crash both boats sink and fade, and the rope with them
    g.globalAlpha = 1 - gone; rope(g, tt); g.globalAlpha = 1;
    boats(g, now, gone);
    if (day > 0) { const dg = g.createLinearGradient(0, 0, 0, H * 0.8); dg.addColorStop(0, `rgba(255,170,110,${0.35 * day})`); dg.addColorStop(1, 'rgba(255,170,110,0)'); g.fillStyle = dg; g.fillRect(0, 0, W, H); }
    page.win(now);
    g.fillStyle = 'rgba(255,217,160,.5)'; g.fillRect(0, 0, W * progress(s), 3 * dpr); // how far to dawn, as on a story night
  }
  function riverShape(g, lo, hi) {
    g.beginPath();
    for (let y = lo; y <= hi; y += 0.04) g.lineTo(sx(centre(s, y) - half(s, y)), sy(y));
    for (let y = hi; y >= lo; y -= 0.04) g.lineTo(sx(centre(s, y) + half(s, y)), sy(y));
    g.closePath();
  }
  function streaks(g, lo, hi) {
    g.strokeStyle = '#5a95cc'; g.lineWidth = 1.5 * dpr; g.globalAlpha = 0.35; g.beginPath();
    for (let i = Math.floor(lo * 4); i < hi * 4; i++) {
      const y = i / 4, k = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1), c = centre(s, y), h = half(s, y), x = c + (k * 2 - 1) * (h - 0.03);
      g.moveTo(sx(x), sy(y)); g.lineTo(sx(x + centre(s, y + 0.12) - c), sy(y + 0.12));
    }
    g.stroke(); g.globalAlpha = 1;
  }
  function waterfall(g, lo, hi, now) {
    g.strokeStyle = '#eaf6ff'; g.lineWidth = 3 * dpr;
    for (let i = Math.floor(lo * 14); i < hi * 14; i++) {
      const y = i / 14 - (now / 260 % 1) / 14, f = fall(s, y);
      if (f <= 0) continue;
      const c = centre(s, y), h = half(s, y) - 0.01;
      g.globalAlpha = 0.15 + 0.5 * f; g.beginPath(); g.moveTo(sx(c - h), sy(y));
      for (let j = 1; j <= 8; j++) g.lineTo(sx(c - h + 2 * h * j / 8), sy(y + 0.012 * Math.sin(j * 2.1 + i)));
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  function rockBody(g, k) {
    const x = sx(k.x), y = sy(k.y), r = k.rad * unit;
    g.fillStyle = '#2b3a44'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#4a5c68'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, 7); g.fill();
  }
  // The dark, drawn at half CSS resolution, with a hole of light round each lantern.
  function darkness(g, dawn) {
    const w = Math.ceil(W / dpr / 2), h = Math.ceil(H / dpr / 2);
    if (shade.width !== w || shade.height !== h) { shade.width = w; shade.height = h; }
    const k = w / W, dark = DARK * (1 - 0.7 * dawn);
    sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, w, h);
    sg.fillStyle = `rgba(3,5,10,${dark})`; sg.fillRect(0, 0, w, h);
    sg.globalCompositeOperation = 'destination-out';
    const r = (0.16 + 0.2 * s.light) * unit * k;
    for (const x of [s.left, s.right]) {
      const bx = sx(x) * k, by = sy(s.y) * k - r * 0.25, m = sg.createRadialGradient(bx, by, r * 0.15, bx, by, r);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,.55)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = m; sg.fillRect(bx - r, by - r, 2 * r, 2 * r);
    }
    g.drawImage(shade, 0, 0, W, H);
  }
  // A rock's outline. A rock the rope is about to catch is outlined in the warning colour; a snagged one flashes.
  function rockRim(g, k, tt) {
    const x = sx(k.x), y = sy(k.y), r = k.rad * unit;
    g.beginPath(); g.arc(x, y, r, 0, 7);
    if (k === s.snag) { g.strokeStyle = Math.sin(tt * 30) > 0 ? '#ff5a4a' : '#ffe2b5'; g.lineWidth = 4 * dpr; }
    else if (k === s.danger) {
      g.strokeStyle = `rgba(${WARN},${0.75 + 0.25 * Math.sin(tt * 14)})`; g.lineWidth = 3.5 * dpr; g.stroke();
      g.beginPath(); g.arc(x, y, r + (6 + 2 * Math.sin(tt * 14)) * dpr, 0, 7); g.lineWidth = 1.5 * dpr;
    } else { g.strokeStyle = k.spent ? 'rgba(159,180,194,.25)' : 'rgba(170,192,206,.7)'; g.lineWidth = 1.5 * dpr; }
    g.stroke();
  }
  function narrowWarning(g, n, tt) {
    g.strokeStyle = `rgba(${WARN},${0.55 + 0.3 * Math.sin(tt * 12)})`; g.lineWidth = 3 * dpr;
    for (const side of [-1, 1]) { g.beginPath(); for (let y = n.y0 - 0.6; y <= n.y1 + 0.6; y += 0.04) g.lineTo(sx(centre(s, y) + side * half(s, y)), sy(y)); g.stroke(); }
  }
  function embers(g, lo, hi, tt) {
    const bob = e => Math.sin(tt * 3 + e.y * 9) * 1.5 * dpr;
    g.globalCompositeOperation = 'lighter';
    for (const e of s.embers) {
      if (e.got || e.y < lo || e.y > hi) continue;
      const x = sx(e.x), y = sy(e.y) + bob(e), r = 0.035 * unit, m = g.createRadialGradient(x, y, 0, x, y, r);
      m.addColorStop(0, 'rgba(255,210,140,.9)'); m.addColorStop(0.3, 'rgba(255,150,60,.45)'); m.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = m; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff1d0';
    for (const e of s.embers) { if (e.got || e.y < lo || e.y > hi) continue; g.beginPath(); g.arc(sx(e.x), sy(e.y) + bob(e), Math.max(2 * dpr, 0.007 * unit), 0, 7); g.fill(); }
  }
  // The rope of light: amber when slack, the warning colour when a rock ahead lies between the boats or a narrow reach is too
  // tight for it, and flashing while snagged.
  function rope(g, tt) {
    const y = sy(s.y) - 0.007 * unit;
    const path = () => { g.beginPath(); g.moveTo(sx(s.left), y); if (s.snag) g.lineTo(sx(s.snag.x), sy(s.snag.y)); g.lineTo(sx(s.right), y); };
    let colour = `rgba(${ROPE},.85)`, width = 2;
    if (s.snag) { colour = Math.sin(tt * 35) > 0 ? '#ff5a4a' : '#ffe2b5'; width = 3.5; }
    else if (s.danger || s.tight) { colour = `rgba(${WARN},${0.8 + 0.2 * Math.sin(tt * 14)})`; width = 3; }
    path(); g.strokeStyle = s.snag || s.danger || s.tight ? `rgba(${WARN},.25)` : `rgba(${ROPE},.18)`; g.lineWidth = (width + 6) * dpr; g.stroke();
    path(); g.strokeStyle = colour; g.lineWidth = width * dpr; g.stroke();
  }
  // The boats in the player's boat and flame (Lantern's shop). After a crash both sink and fade.
  function boats(g, now, gone) {
    const [id, , col] = page.skin('boat'), fire = page.skin('flame')[2], tt = now / 1000;
    for (const [i, x] of [s.left, s.right].entries()) {
      const bx = sx(x), by = sy(s.y);
      g.save(); g.translate(bx, by); g.rotate(Math.max(-0.25, Math.min(0.25, (target[i] - x) * 3)));
      if (gone) { g.globalAlpha = 1 - gone; g.scale(1 - 0.5 * gone, 1 - 0.5 * gone); }
      if (page.live()) wake(g, unit, tt + i * 0.37);
      hull(g, id, unit, s.safe && Math.sin(s.t * 30) > 0 ? '#ddc6a4' : col, tt);
      g.restore();
      if (gone >= 1) continue;
      g.globalAlpha = 1 - gone; g.globalCompositeOperation = 'lighter';
      const r = (0.05 + 0.05 * s.light) * unit, m = g.createRadialGradient(bx, by, 0, bx, by, r); // the lantern and its warm wash
      m.addColorStop(0, `rgba(${fire},${0.35 + 0.3 * s.light})`); m.addColorStop(1, `rgba(${fire},0)`);
      g.fillStyle = m; g.fillRect(bx - r, by - r, 2 * r, 2 * r);
      g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff0c8';
      g.beginPath(); g.arc(bx, by, Math.max(2.5 * dpr, 0.006 * unit), 0, 7); g.fill(); g.globalAlpha = 1;
    }
  }

  return {
    id: 'duet',
    own: true, // the run's state is Duet's own (./duet-sim.js), not Lantern's: the page takes a fresh river of its own on the way back to the menu
    steers: true, // the mode steers with its own pads; the page's one-finger hint stays away
    share: 0.5, // the rope takes about twice the embers a minute of a story night (duet-bots.mjs measures it), so half go to the bank
    card,
    start: () => begin(), // abilities and stats are not used in Duet
    step: () => stepRun(), // the page's one target is not used: each boat has its own
    react,
    reach: () => s ? progress(s) : 0,
    night: () => night,
    hello: () => night === 1 ? t('duetSay1') : t('duetSayN', { n: night }),
    pauseLine: () => t('duetPause', { n: night, pct: Math.floor(progress(s) * 100) }),
    end,
    frame() {}, // no sound between frames
    draw,
    screen(name, box) {
      shown(name);
      if (name === 'mode') card(box);
      if (name === 'menu') s = null;
    },
    state: () => ({ night, best: save.best, unlocked: save.unlocked, played: save.played, left: s?.left, right: s?.right, target: [...target], taken: s?.taken, snags: s?.snags,
      danger: !!s?.danger, tight: !!s?.tight, snag: !!s?.snag, light: s?.light, unit, camX, dpr, secondsAhead: s ? (H * BOAT_ROW - HUD_PX * dpr) / unit / cruise() : 0,
      boats: s ? [s.left, s.right].map(x => [sx(x) / dpr, sy(s.y) / dpr]) : [], pads: on }),
    game: () => s, // the browser check reads the river through this
  };
}
