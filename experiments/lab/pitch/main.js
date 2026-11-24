import { create, clone, legal, apply, xy, target, bounces, botTurn, daily, mulberry32, hashString, snapshot, LEVELS, DX, DY } from './sim.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const KEY = 'pitch:v1';
const INK = ['#1d4fb8', '#c4302b'], GRAPHITE = '#4b4a47', PAPER = '#f6f1e4', GRID = '#a9c3e099';
const HUMAN_MS = 150, BOT_MS = 250, BOT_WAIT = 380, DEMO_MS = 420;
const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const loaded = readJson(KEY, null);
const save = Object.assign({ played: 0, level: 0, lossStreak: 0, wins: 0, sound: true, daily: {} }, loaded || {});
const store = () => writeJson(KEY, save);
const snd = sound({ on: () => save.sound });
const show = screens(['menu', 'paused', 'between', 'end'], name => { screen = name || 'play'; });

let screen = 'menu', mode = 'demo', paused = false, clock = 0, last = performance.now();
// One match or daily round. s: sim state; seats: which players the bot plays; anim: the segment being drawn.
let s = null, seats = [false, true], level = 0, score = [0, 0], game = 0, queue = [], anim = null, botAt = -1, after = [], ended = false;
let first = false, pop = null, drag = null, today = null, dailyRec = null, attemptStart = 0, reveal = false, pictureBlob = null, pictureUrl = '';
let L = { cell: 40, ox: 0, oy: 0 }, W = innerWidth, H = innerHeight, dpr = 1, safe = { top: 0, bottom: 0 };
const paperLayer = document.createElement('canvas'), inkLayer = document.createElement('canvas');

// ---------- drawing

function seg(rng) { return (rng() - 0.5); }
// A hand-drawn line from a to b: a slight bow and jitter seeded by the segment, drawn up to fraction t.
function wobbly(c, a, b, cell, color, t = 1, width = 2.4, key = 0) {
  const rng = mulberry32(key || hashString(`${a.x},${a.y}|${b.x},${b.y}`));
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const bow = seg(rng) * 0.14 * cell, j = 0.035 * cell;
  const a2 = { x: a.x + seg(rng) * j, y: a.y + seg(rng) * j }, b2 = { x: b.x + seg(rng) * j, y: b.y + seg(rng) * j };
  const mid = { x: (a2.x + b2.x) / 2 + nx * bow, y: (a2.y + b2.y) / 2 + ny * bow };
  const n = 12, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * t, w1 = (1 - u) ** 2, w2 = 2 * (1 - u) * u, w3 = u * u, wob = i && i < n ? seg(rng) * 0.02 * cell : 0;
    pts.push({ x: w1 * a2.x + w2 * mid.x + w3 * b2.x + nx * wob, y: w1 * a2.y + w2 * mid.y + w3 * b2.y + ny * wob });
  }
  const scale = Math.max(0.8, cell / 42);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color;
  for (const [alpha, w, off] of [[0.92, width * scale * (0.9 + rng() * 0.25), 0], [0.35, width * scale * 0.55, 0.6 * scale]]) {
    c.globalAlpha = alpha; c.lineWidth = w; c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x + off, p.y - off) : c.moveTo(p.x + off, p.y - off)));
    c.stroke();
  }
  c.globalAlpha = 1;
  return pts[pts.length - 1];
}
const at = (lay, x, y) => ({ x: lay.ox + x * lay.cell, y: lay.oy + y * lay.cell });
const pxy = (lay, st, p) => { const q = xy(st, p); return at(lay, q.x, q.y); };

function drawPaper(c, w, h, lay, seed = 7) {
  c.fillStyle = PAPER; c.fillRect(0, 0, w, h);
  const rng = mulberry32(seed);
  for (let i = 0; i < (w * h) / 90; i++) {
    c.fillStyle = rng() < 0.5 ? '#8a7a5a' : '#ffffff'; c.globalAlpha = 0.04 + rng() * 0.05;
    c.fillRect(rng() * w, rng() * h, 1 + rng() * 1.5, 1 + rng() * 1.5);
  }
  c.globalAlpha = 1; c.strokeStyle = GRID; c.lineWidth = 1;
  const cell = lay.cell;
  c.beginPath();
  for (let x = lay.ox - Math.ceil(lay.ox / cell) * cell; x <= w; x += cell) { c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, h); }
  for (let y = lay.oy - Math.ceil(lay.oy / cell) * cell; y <= h; y += cell) { c.moveTo(0, Math.round(y) + 0.5); c.lineTo(w, Math.round(y) + 0.5); }
  c.stroke();
}
// The pitch in pencil: boundary, goal nets, a faint halfway line and centre circle, then every settled segment in ink.
function drawPitch(c, lay, st, upto = st.log.length, extra = []) {
  const { w, h } = st, m = w / 2, cell = lay.cell, P = (x, y) => at(lay, x, y);
  c.save();
  c.globalAlpha = 0.28; c.strokeStyle = GRAPHITE; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(P(0, h / 2).x, P(0, h / 2).y); c.lineTo(P(w, h / 2).x, P(w, h / 2).y); c.stroke();
  c.beginPath(); c.arc(P(m, h / 2).x, P(m, h / 2).y, cell * 1.1, 0, Math.PI * 2); c.stroke();
  for (const [y0, y1] of [[-1, 0], [h, h + 1]]) {
    c.beginPath();
    for (let k = -2; k <= 4; k++) {
      const a = P(m - 1 + k * 0.5, y0), b = P(m - 1 + k * 0.5 + 1, y1);
      const ax = Math.max(P(m - 1, 0).x, Math.min(P(m + 1, 0).x, a.x)), bx = Math.max(P(m - 1, 0).x, Math.min(P(m + 1, 0).x, b.x));
      c.moveTo(ax, a.y + (ax - a.x)); c.lineTo(bx, b.y - (b.x - bx));
    }
    c.stroke();
  }
  c.restore();
  const walls = [[[m - 1, 0], [0, 0], [0, h], [m - 1, h], [m - 1, h + 1], [m + 1, h + 1], [m + 1, h], [w, h], [w, 0], [m + 1, 0], [m + 1, -1], [m - 1, -1], [m - 1, 0]]];
  for (const poly of walls) for (let i = 1; i < poly.length; i++) {
    const a = P(...poly[i - 1]), b = P(...poly[i]), steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / cell / 2));
    for (let k = 0; k < steps; k++) {
      const f0 = k / steps, f1 = (k + 1) / steps;
      wobbly(c, { x: a.x + (b.x - a.x) * f0, y: a.y + (b.y - a.y) * f0 }, { x: a.x + (b.x - a.x) * f1, y: a.y + (b.y - a.y) * f1 }, cell * 0.5, GRAPHITE, 1, 2.6, hashString(`w${i},${k},${poly[i]}`));
    }
  }
  for (let i = 0; i < upto; i++) {
    const [from, to, player] = st.log[i];
    wobbly(c, pxy(lay, st, from), pxy(lay, st, to), cell, INK[player]);
  }
  for (const [from, to] of extra) {
    c.setLineDash([cell * 0.12, cell * 0.1]);
    wobbly(c, pxy(lay, st, from), pxy(lay, st, to), cell, GRAPHITE, 1, 2);
    c.setLineDash([]);
  }
}
function drawBall(c, p, cell) {
  const r = Math.max(6, cell * 0.2);
  c.fillStyle = '#26262a22'; c.beginPath(); c.ellipse(p.x + 1.5, p.y + r * 0.8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fffefa'; c.strokeStyle = '#26262a'; c.lineWidth = 1.8;
  c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#26262a'; c.beginPath();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.4; c[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * r * 0.42, p.y + Math.sin(a) * r * 0.42); }
  c.fill();
}
// A small coil beside a point: landing there means go again.
function drawSpring(c, p, cell, color, lift = 0) {
  const x = p.x + cell * 0.24, y0 = p.y - cell * 0.08, hgt = cell * (0.36 + lift), wdt = cell * 0.09;
  c.strokeStyle = color; c.lineWidth = Math.max(1.4, cell / 26); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y0);
  for (let i = 1; i <= 6; i++) c.lineTo(x + (i % 2 ? wdt : -wdt), y0 - (hgt * i) / 6);
  c.lineTo(x, y0 - hgt - cell * 0.04); c.stroke();
}

function layout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(3, devicePixelRatio || 1);
  const probe = getComputedStyle($('probe'));
  safe = { top: parseFloat(probe.paddingTop) || 0, bottom: parseFloat(probe.paddingBottom) || 0 };
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const st = s || create(8, 10), top = safe.top + 64, bottom = safe.bottom + 60, availH = H - top - bottom;
  const cell = Math.floor(Math.min((W - 48) / st.w, availH / (st.h + 2), 64));
  L = { cell, ox: Math.round((W - st.w * cell) / 2), oy: Math.round(top + (availH - (st.h + 2) * cell) / 2 + cell) };
  for (const layer of [paperLayer, inkLayer]) { layer.width = canvas.width; layer.height = canvas.height; }
  const pc = paperLayer.getContext('2d'); pc.setTransform(dpr, 0, 0, dpr, 0, 0); drawPaper(pc, W, H, L);
  redrawInk();
}
function redrawInk() {
  const c = inkLayer.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, inkLayer.width, inkLayer.height); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (s) drawPitch(c, L, s, s.log.length - (anim ? 1 : 0), reveal ? revealSegs() : []);
}

function frame(now) {
  const dt = Math.min(now - last, 100); last = now;
  if (!paused) { clock += dt; step(); }
  render();
  requestAnimationFrame(frame);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paperLayer, 0, 0); ctx.drawImage(inkLayer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!s) return;
  let ball = pxy(L, s, s.ball);
  if (anim) {
    const t = Math.min(1, (clock - anim.start) / anim.dur), ease = 1 - (1 - t) ** 2;
    ball = wobbly(ctx, pxy(L, s, anim.from), pxy(L, s, anim.to), L.cell, INK[anim.player], ease);
  }
  if (canTap() && !anim) {
    const color = INK[s.turn], pulse = 0.5 + 0.5 * Math.sin(clock / 260);
    let aim = -1;
    if (drag && drag.moved) aim = aimFrom(drag.x - ball.x, drag.y - ball.y);
    for (const d of legal(s)) {
      const p = pxy(L, s, target(s, d)), r = L.cell * (0.13 + 0.05 * pulse);
      ctx.globalAlpha = d === aim ? 0.9 : 0.25 + 0.3 * pulse; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, d === aim ? L.cell * 0.2 : r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (bounces(s, target(s, d)) && xy(s, target(s, d)).y >= 0 && xy(s, target(s, d)).y <= s.h) drawSpring(ctx, p, L.cell, color, 0.06 * pulse);
    }
    if (drag && drag.moved && aim >= 0) {
      const p = pxy(L, s, target(s, aim));
      ctx.globalAlpha = 0.35; ctx.setLineDash([4, 5]); ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  if (pop && clock - pop.t < 420) {
    const k = (clock - pop.t) / 420;
    ctx.globalAlpha = 1 - k; drawSpring(ctx, pop.p, L.cell * (1 + k * 0.6), pop.color, 0.2 * Math.sin(k * Math.PI)); ctx.globalAlpha = 1;
  }
  drawBall(ctx, ball, L.cell);
}

// ---------- game flow

const isBot = p => mode === 'demo' || (mode === 'bot' && seats[p]);
function busy() { return !!anim || queue.length > 0 || paused || screen !== 'play' || ended; }
// A player may tap again while their own bounce is still being drawn; that line is finished at once.
function canTap() {
  return !!s && mode !== 'demo' && !paused && screen === 'play' && !ended && !queue.length && s.winner < 0 && !isBot(s.turn)
    && (mode !== 'daily' || s.turn === 0) && (!anim || anim.player === s.turn);
}
function later(ms, fn) { after.push({ at: clock + ms, fn }); }

function step() {
  for (const job of after.filter(j => clock >= j.at)) { after.splice(after.indexOf(job), 1); job.fn(); }
  if (!s) return;
  if (anim && clock >= anim.start + anim.dur) settle();
  if (!anim && queue.length && clock >= botAt) startSegment(queue.shift(), mode === 'demo' ? DEMO_MS : BOT_MS);
  if (!anim && !queue.length && !ended && s.winner < 0 && isBot(s.turn) && (screen === 'play' || mode === 'demo')) {
    if (botAt < 0) botAt = clock + (mode === 'demo' ? DEMO_MS : BOT_WAIT);
    else if (clock >= botAt) {
      const rng = mulberry32(hashString(`${game}:${s.log.length}:${clock | 0}`));
      queue = botTurn(s, mode === 'demo' ? 1 : level, rng) || [];
    }
  }
}
function startSegment(d, dur) {
  if (anim) settle();
  const from = s.ball, player = s.turn, to = target(s, d), wasBounce = bounces(s, to);
  apply(s, d);
  anim = { from, to, player, start: clock, dur, bounce: wasBounce && s.winner < 0 };
  redrawInk();
  scratch(dur);
  if (mode === 'daily' && s.log.length === attemptStart + 1) { dailyRec.used++; store(); }
  if (mode !== 'demo' && s.winner < 0) updateHud();
}
function settle() {
  const a = anim; anim = null; redrawInk();
  botAt = queue.length ? clock + 40 : -1;
  if (a.bounce) { pop = { p: pxy(L, s, a.to), t: clock, color: INK[a.player] }; if (mode !== 'demo') snd.tone(480, 0.14, 0.05, 'triangle', 420); }
  if (s.winner >= 0) return gameOver();
  if (mode === 'daily' && s.turn !== 0) return dailyMiss();
  updateHud();
}
function scratch(dur) {
  if (mode === 'demo') return;
  snd.noise(Math.min(0.09, dur / 1000), 0.05, 3400);
  setTimeout(() => snd.noise(dur / 1400, 0.035, 2600), dur * 0.4);
}

function kickOff() {
  const size = mode === 'bot' && first ? [6, 8] : [8, 10];
  s = create(size[0], size[1], game % 2);
  anim = null; queue = []; botAt = -1; ended = false; pop = null; reveal = false;
  layout(); updateHud();
}
function startMatch(m) {
  snd.unlock();
  mode = m; score = [0, 0]; game = 0; after = []; paused = false;
  first = m === 'bot' && save.played === 0;
  level = m === 'bot' ? (first ? 0 : save.level) : 0;
  seats = [false, m === 'bot'];
  show(null); $('hud').classList.add('on'); $('turn').classList.add('on');
  kickOff();
}
function gameOver() {
  ended = true;
  const scorer = s.winner, how = s.how;
  if (mode === 'demo') { later(2200, () => { game++; kickOff(); }); return; }
  if (mode === 'daily') return dailyEnd();
  score[scorer]++;
  if (how === 'stuck') snd.tone(196, 0.4, 0.08, 'sine', -60);
  else { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd.tone(f, 0.22, 0.09, 'triangle'), i * 110)); }
  toast(how === 'stuck' ? 'Stuck!' : how === 'own' ? 'Own goal!' : 'Goal!', INK[scorer]);
  updateHud();
  later(1200, () => {
    if (Math.max(...score) >= 2) return matchOver();
    const names = playerNames(), lead = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
    $('betweenTitle').textContent = lead < 0 ? 'All square' : `${names[lead]} ${names[lead] === 'You' ? 'lead' : 'leads'} ${Math.max(...score)}–${Math.min(...score)}`;
    $('betweenTitle').style.color = lead < 0 ? '' : INK[lead];
    $('betweenLine').textContent = how === 'stuck' ? `${names[1 - scorer]} had nowhere to go.` : how === 'own' ? 'An own goal counts for the other side.' : 'First to two goals wins.';
    show('between');
  });
}
function matchOver() {
  const winner = score[0] > score[1] ? 0 : 1, names = playerNames();
  let line = '';
  if (mode === 'bot') {
    save.played++;
    const was = level;
    if (winner === 0) { save.wins++; save.level = Math.min(2, (first ? 0 : save.level) + 1); save.lossStreak = 0; }
    else { save.lossStreak++; if (save.lossStreak >= 2) { save.level = Math.max(0, save.level - 1); save.lossStreak = 0; } }
    store();
    line = save.level > was ? `Next up: ${LEVELS[save.level]} bot.` : save.level < was ? `Next up: ${LEVELS[save.level]} bot.` : `Next up: ${LEVELS[save.level]} bot again.`;
    if (first) line = winner === 0 ? 'Now the full-size pitch, against the Medium bot.' : 'Next: the full-size pitch.';
    $('endTitle').textContent = winner === 0 ? 'You win!' : 'The bot wins';
  } else {
    $('endTitle').textContent = `${names[winner]} wins!`;
    line = 'Pass the phone back for a rematch.';
  }
  $('endTitle').style.color = INK[winner];
  $('endLine').textContent = line;
  $('again').textContent = 'Rematch';
  $('again').parentElement.hidden = false;
  showEnd(`${score[0]} – ${score[1]}`);
}
function playerNames() { return mode === 'bot' ? ['You', 'The bot'] : ['Blue', 'Red']; }

// ---------- daily

function utcDate() {
  const q = new URLSearchParams(location.search).get('date');
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Date().toISOString().slice(0, 10);
}
function startDaily() {
  snd.unlock();
  const date = utcDate();
  if (!today || today.date !== date) today = daily(date);
  dailyRec = save.daily[date] || (save.daily[date] = { used: 0, solved: false });
  mode = 'daily'; after = []; paused = false; game = 0;
  show(null); $('hud').classList.add('on'); $('turn').classList.add('on');
  if (dailyRec.solved || dailyRec.used >= 3) return dailyResult();
  resetAttempt();
}
function resetAttempt() {
  s = clone(today.state); attemptStart = s.log.length;
  anim = null; queue = []; botAt = -1; ended = false; reveal = false; pop = null;
  layout(); updateHud();
}
function dailyMiss() {
  ended = true; snd.tone(196, 0.3, 0.06, 'sine', -40);
  toast(dailyRec.used >= 3 ? 'No more tries' : 'Not this time', INK[1]);
  updateHud();
  later(1300, () => (dailyRec.used >= 3 ? dailyResult() : resetAttempt()));
}
function dailyEnd() {
  if (s.winner === 0 && s.how === 'goal') {
    dailyRec.solved = true; dailyRec.path = s.log.slice(attemptStart).map(e => [e[0], e[1]]); store();
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd.tone(f, 0.22, 0.09, 'triangle'), i * 110));
    toast('Goal!', INK[0]); updateHud();
    later(1200, dailyResult);
  } else dailyMiss();
}
function revealSegs() {
  const t = clone(today.state), out = [];
  for (const d of today.solution) { const from = t.ball; apply(t, d); out.push([from, t.ball]); }
  return out;
}
function dailyResult() {
  // The picture: the winning chain in blue ink, or the answer in dashed pencil after three misses.
  s = clone(today.state); attemptStart = s.log.length; ended = true; anim = null; queue = [];
  if (dailyRec.solved && dailyRec.path) for (const [from, to] of dailyRec.path) { const d = DX.findIndex((_, k) => s.g.next[from * 8 + k] === to); if (d >= 0 && s.ball === from) apply(s, d); }
  reveal = !dailyRec.solved;
  if (reveal) { const t = clone(today.state); for (const d of today.solution) apply(t, d); s.ball = t.ball; }
  layout(); updateHud();
  $('endTitle').textContent = dailyRec.solved ? 'Scored!' : 'Here was the way';
  $('endTitle').style.color = dailyRec.solved ? INK[0] : '';
  const hours = Math.max(1, Math.ceil((Date.UTC(...nextDay()) - Date.now()) / 3600000));
  $('endLine').innerHTML = `${dotsHtml()} &nbsp;A new pitch in ${hours} h.`;
  $('again').parentElement.hidden = true;
  showEnd(dailyRec.solved ? `Goal, try ${dailyRec.used}` : 'No goal');
}
function nextDay() { const d = new Date(); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1]; }
function dotsHtml(rec = dailyRec) {
  let h = '<span class="dots" aria-label="tries">';
  for (let i = 0; i < 3; i++) h += `<i class="${rec && i < rec.used ? (rec.solved && i === rec.used - 1 ? 'won' : 'used') : ''}"></i>`;
  return h + '</span>';
}
function renderDailyHud() { if (mode === 'daily') $('tag').innerHTML = dotsHtml(); }

// ---------- HUD, cards, picture

function updateHud() {
  if (!s) return;
  if (mode === 'daily') {
    $('score').innerHTML = `<div><span class="b">Today</span><small>${today.date}</small></div>`;
    renderDailyHud();
  } else {
    const names = playerNames();
    $('score').innerHTML = `<div><span class="b">${score[0]}</span><small>${names[0]}</small></div><span>–</span><div><span class="r">${score[1]}</span><small>${mode === 'bot' ? `${LEVELS[level]} bot` : names[1]}</small></div>`;
    $('tag').textContent = mode === 'bot' && first ? 'Small pitch' : '';
  }
  const p = s.turn, names = mode === 'bot' ? ['Your turn', 'Bot is drawing'] : mode === 'daily' ? ['Score this turn', 'Turn over'] : ["Blue's turn", "Red's turn"];
  document.documentElement.style.setProperty('--turn', INK[p]);
  $('turnText').textContent = s.winner >= 0 ? (s.winner === 0 ? 'Blue scores' : 'Red scores') : names[p];
  if (mode === 'bot' && s.winner >= 0) $('turnText').textContent = s.winner === 0 ? 'Your point' : "Bot's point";
}
let toastTimer = 0;
function toast(text, color) {
  const t = $('toast'); t.textContent = text; t.style.color = color || ''; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1300);
}
function picture(scoreText) {
  const cell = 64, pad = 36, head = 64, w = s.w * cell + pad * 2, h = (s.h + 2) * cell + pad * 2 + head;
  const pc = document.createElement('canvas'); pc.width = w; pc.height = h;
  const c = pc.getContext('2d'), lay = { cell, ox: pad, oy: pad + head + cell };
  drawPaper(c, w, h, lay, 11);
  drawPitch(c, lay, s, s.log.length, reveal ? revealSegs() : []);
  drawBall(c, pxy(lay, s, s.ball), cell);
  c.fillStyle = '#26262a'; c.textBaseline = 'middle';
  c.font = `700 30px ${getComputedStyle(document.documentElement).getPropertyValue('--hand')}`;
  c.fillText(mode === 'daily' ? `Paper Pitch ${today.date}` : 'Paper Pitch', pad, pad + 18);
  c.textAlign = 'right';
  if (mode === 'daily') { c.fillStyle = dailyRec.solved ? INK[0] : GRAPHITE; c.fillText(scoreText, w - pad, pad + 18); }
  else {
    c.fillStyle = INK[1]; c.fillText(String(score[1]), w - pad, pad + 18);
    const rw = c.measureText(String(score[1])).width;
    c.fillStyle = '#26262a'; c.fillText(' – ', w - pad - rw, pad + 18);
    const dw = c.measureText(' – ').width;
    c.fillStyle = INK[0]; c.fillText(String(score[0]), w - pad - rw - dw, pad + 18);
  }
  return pc;
}
function showEnd(scoreText) {
  pictureBlob = null; $('toast').classList.remove('on');
  const pc = picture(scoreText);
  if (pictureUrl) URL.revokeObjectURL(pictureUrl);
  $('pic').src = pc.toDataURL('image/png');
  pc.toBlob(b => { pictureBlob = b; });
  $('hud').classList.remove('on'); $('turn').classList.remove('on');
  show('end');
}
function savePicture() {
  if (!pictureBlob) return;
  const name = mode === 'daily' ? `paper-pitch-${today.date}.png` : 'paper-pitch.png';
  const file = new File([pictureBlob], name, { type: 'image/png' });
  const download = () => {
    const a = document.createElement('a'); pictureUrl = URL.createObjectURL(pictureBlob);
    a.href = pictureUrl; a.download = name; document.body.append(a); a.click(); a.remove();
  };
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Paper Pitch' }).catch(e => { if (e && e.name !== 'AbortError') download(); });
      return;
    }
  } catch {}
  download();
}

// ---------- input

function aimFrom(dx, dy) {
  let best = -1, bestDot = 0.75;
  const len = Math.hypot(dx, dy) || 1;
  for (const d of legal(s)) {
    const dl = Math.hypot(DX[d], DY[d]), dot = (dx * DX[d] + dy * DY[d]) / (len * dl);
    if (dot > bestDot) { bestDot = dot; best = d; }
  }
  return best;
}
function nearest(x, y) {
  let best = -1, bestDist = Math.max(44, L.cell * 1.3);
  for (const d of legal(s)) {
    const p = pxy(L, s, target(s, d)), dist = Math.hypot(p.x - x, p.y - y);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}
canvas.addEventListener('pointerdown', e => {
  if (!canTap()) return;
  const b = pxy(L, s, s.ball);
  drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, fromBall: Math.hypot(e.clientX - b.x, e.clientY - b.y) < Math.max(30, L.cell * 0.6), moved: false };
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.fromBall && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > L.cell * 0.35) drag.moved = true;
});
canvas.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const g = drag; drag = null;
  if (!canTap()) return;
  const b = pxy(L, s, s.ball);
  const d = g.moved ? aimFrom(e.clientX - b.x, e.clientY - b.y) : nearest(e.clientX, e.clientY);
  if (d >= 0) startSegment(d, HUMAN_MS);
});
canvas.addEventListener('pointercancel', () => { drag = null; });

function pause() {
  if (paused || screen !== 'play' || mode === 'demo' || !s) return;
  paused = true; drag = null; snd.hold();
  $('restart').hidden = mode === 'daily';
  show('paused');
}
function resume() { paused = false; snd.release(); show(null); }
function toMenu() {
  paused = false; snd.release(); mode = 'demo'; game = 0; after = [];
  $('hud').classList.remove('on'); $('turn').classList.remove('on');
  show('menu'); refreshMenu(); kickOff();
}
function refreshMenu() {
  $('playSub').textContent = save.played === 0 ? 'First match: small pitch, Easy bot' : `Best of 3 goals vs ${LEVELS[save.level]} bot`;
  const rec = save.daily[utcDate()];
  $('dailyDots').innerHTML = dotsHtml(rec || { used: 0 }).replace(/^<span class="dots"[^>]*>|<\/span>$/g, '');
  for (const id of ['soundMenu', 'soundPause']) $(id).textContent = save.sound ? 'Sound on' : 'Sound off';
}
function toggleSound() { save.sound = !save.sound; store(); refreshMenu(); if (save.sound) { snd.unlock(); snd.tone(660, 0.1, 0.06, 'triangle'); } }

$('play').onclick = () => startMatch('bot');
$('two').onclick = () => startMatch('two');
$('daily').onclick = startDaily;
$('pauseBtn').onclick = pause;
$('resume').onclick = resume;
$('restart').onclick = () => startMatch(mode);
$('quit').onclick = toMenu;
$('endMenu').onclick = toMenu;
$('again').onclick = () => startMatch(mode);
$('next').onclick = () => { show(null); game++; kickOff(); };
$('savePic').onclick = savePicture;
$('soundMenu').onclick = toggleSound;
$('soundPause').onclick = toggleSound;
addEventListener('keydown', e => { if (isPauseKey(e)) { if (paused) resume(); else pause(); } });
addEventListener('resize', layout);
onLeave(pause);

hint(canvas, {
  kind: 'tap', key: 'pitch:hint', played: !!loaded && (loaded.played > 0 || Object.keys(loaded.daily || {}).length > 0),
  when: () => canTap(),
  // Over the legal point nearest the middle column, so the finger taps where a line can go.
  bottom: () => {
    if (!s) return 120;
    let best = null;
    for (const d of legal(s)) { const p = pxy(L, s, target(s, d)); if (!best || Math.abs(p.x - W / 2) < Math.abs(best.x - W / 2)) best = p; }
    return best ? Math.max(40, H - best.y - safe.bottom) : 120;
  },
});

window.__pitch = Object.freeze({
  get ready() { return !!s; },
  get mode() { return mode; },
  get screen() { return screen; },
  get paused() { return paused; },
  get busy() { return busy(); },
  get canTap() { return canTap(); },
  get turn() { return s ? s.turn : -1; },
  get winner() { return s ? s.winner : -1; },
  get ball() { return s ? xy(s, s.ball) : null; },
  get size() { return s ? { w: s.w, h: s.h } : null; },
  get score() { return score.slice(); },
  get level() { return level; },
  get segments() { return s ? s.log.length : 0; },
  get legal() { return s ? legal(s).map(d => { const t = target(s, d), q = xy(s, t), p = pxy(L, s, t); return { d, x: q.x, y: q.y, sx: p.x, sy: p.y, bounce: bounces(s, t) }; }) : []; },
  get daily() { return today ? { date: today.date, used: dailyRec?.used ?? 0, solved: !!dailyRec?.solved, attemptStart } : null; },
  state() { return s ? snapshot(s) : null; },
  save() { return JSON.parse(JSON.stringify(save)); },
});

refreshMenu();
kickOff();
requestAnimationFrame(frame);
