import { create, clone, legal, apply, xy, target, bounces, botTurn, daily, mulberry32, hashString, snapshot, DX, DY } from './sim.js';
import { t, lang, apply as applyWords, setLang, levelName, dateLabel } from './words.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { lab } from '../../kit/lab.js';
import { table, newCode, cleanCode, linkFor, codeFromLink, share } from '../../kit/room.js';

noZoom();
const KEY = 'pitch:v1';
const INK = ['#1d4fb8', '#c4302b'], GRAPHITE = '#4b4a47', PAPER = '#f6f1e4', GRID = '#a9c3e099';
const HUMAN_MS = 150, BOT_MS = 250, BOT_WAIT = 380, DEMO_MS = 420;
const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const loaded = readJson(KEY, null);
const save = Object.assign({ played: 0, level: 0, lossStreak: 0, wins: 0, sound: true, daily: {}, name: '' }, loaded || {});
const store = () => writeJson(KEY, save);
const snd = sound({ on: () => save.sound });
const show = screens(['menu', 'friendCard', 'paused', 'between', 'end'], name => {
  screen = name === 'friendCard' ? 'friend' : name || 'play';
  updateRoomNotice();
});

let screen = 'menu', mode = 'demo', paused = false, clock = 0, last = performance.now();
// One match or daily round. s: sim state; seats: which players the bot plays; anim: the segment being drawn.
let s = null, seats = [false, true], level = 0, score = [0, 0], game = 0, queue = [], anim = null, botAt = -1, after = [], ended = false;
let first = false, pop = null, drag = null, today = null, dailyRec = null, attemptStart = 0, reveal = false, pictureBlob = null, pictureUrl = '';
let room = null, roomSeat = null, roomSeats = [], roomGame = 0, roomSeed = 0, roomMoves = 0, roomVotes = [];
let roomNext = null, roomInviting = false, roomLag = false, roomLagTimer = 0;
let L = { cell: 40, ox: 0, oy: 0 }, W = innerWidth, H = innerHeight, dpr = 1, safe = { top: 0, bottom: 0 };
// Play recording for the game lab. One run is a match against the bot, a two-player match, a friend's table match
// or today's pitch. The data holds modes, levels and results only: never a name, a typed word or a table code.
const rec = lab('pitch');
let running = false;
function recStart(info) { recEnd('quit'); running = true; rec.start(info); }
function recEnd(outcome) { if (!running) return; running = false; rec.end(outcome, recSummary()); }
function recSummary() { return { mode, level, goals: score.slice(), games: game + 1, ...(mode === 'daily' && dailyRec ? { tries: dailyRec.used, solved: dailyRec.solved } : {}) }; }
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
const viewSign = () => mode === 'table' && roomSeat === 1 ? -1 : 1;
function viewPoint(p, lay = L, st = s) {
  if (viewSign() === 1) return p;
  return { x: 2 * lay.ox + st.w * lay.cell - p.x, y: 2 * lay.oy + st.h * lay.cell - p.y };
}
const viewBall = p => viewPoint(pxy(L, s, p));
function orient(c, lay = L, st = s) {
  if (viewSign() === 1) return;
  c.translate(2 * lay.ox + st.w * lay.cell, 2 * lay.oy + st.h * lay.cell);
  c.scale(-1, -1);
}

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
function drawRoomGoals(c, lay, st) {
  for (const [seat, y] of [[0, st.h + 1], [1, -1]]) {
    wobbly(c, at(lay, st.w / 2 - 1, y), at(lay, st.w / 2 + 1, y), lay.cell, INK[seat]);
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
  const st = s || create(8, 10), top = safe.top + (mode === 'table' ? 128 : 64), bottom = safe.bottom + (mode === 'table' ? 72 : 60), availH = H - top - bottom;
  const cell = Math.floor(Math.min((W - 48) / st.w, availH / (st.h + 2), 64));
  L = { cell, ox: Math.round((W - st.w * cell) / 2), oy: Math.round(top + (availH - (st.h + 2) * cell) / 2 + cell) };
  for (const layer of [paperLayer, inkLayer]) { layer.width = canvas.width; layer.height = canvas.height; }
  const pc = paperLayer.getContext('2d'); pc.setTransform(dpr, 0, 0, dpr, 0, 0); drawPaper(pc, W, H, L);
  redrawInk();
}
function redrawInk() {
  const c = inkLayer.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, inkLayer.width, inkLayer.height); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!s) return;
  c.save();
  orient(c);
  drawPitch(c, L, s, s.log.length - (anim ? 1 : 0), reveal ? revealSegs() : []);
  if (mode === 'table') drawRoomGoals(c, L, s);
  c.restore();
}

function frame(now) {
  const dt = Math.min(now - last, 100); last = now;
  if (!paused || mode === 'table') { clock += dt; step(); }
  render();
  requestAnimationFrame(frame);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paperLayer, 0, 0); ctx.drawImage(inkLayer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!s) return;
  let ball = viewBall(s.ball);
  if (anim) {
    const t = Math.min(1, (clock - anim.start) / anim.dur), ease = 1 - (1 - t) ** 2;
    ctx.save();
    orient(ctx);
    ball = viewPoint(wobbly(ctx, pxy(L, s, anim.from), pxy(L, s, anim.to), L.cell, INK[anim.player], ease));
    ctx.restore();
  }
  if (canTap() && !anim) {
    const color = INK[s.turn], pulse = 0.5 + 0.5 * Math.sin(clock / 260);
    let aim = -1;
    if (drag && drag.moved) aim = aimFrom(drag.x - ball.x, drag.y - ball.y);
    for (const d of legal(s)) {
      const p = viewBall(target(s, d)), r = L.cell * (0.13 + 0.05 * pulse);
      ctx.globalAlpha = d === aim ? 0.9 : 0.25 + 0.3 * pulse; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, d === aim ? L.cell * 0.2 : r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (bounces(s, target(s, d)) && xy(s, target(s, d)).y >= 0 && xy(s, target(s, d)).y <= s.h) drawSpring(ctx, p, L.cell, color, 0.06 * pulse);
    }
    if (drag && drag.moved && aim >= 0) {
      const p = viewBall(target(s, aim));
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
const canSound = () => mode !== 'demo' && (mode !== 'table' || (!paused && snd.ctx));
function busy() { return !!anim || queue.length > 0 || paused || screen !== 'play' || ended; }
// A player may tap again while their own bounce is still being drawn; that line is finished at once.
function canTap() {
  return !!s && mode !== 'demo' && !paused && screen === 'play' && !ended && !queue.length && s.winner < 0 && !isBot(s.turn)
    && (mode !== 'daily' || s.turn === 0) && (!anim || anim.player === s.turn)
    && (mode !== 'table' || (roomSeat === s.turn && room.status === 'live' && !room.waiting && roomSeats[1 - roomSeat]));
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
  if (a.bounce) {
    pop = { p: viewBall(a.to), t: clock, color: INK[a.player] };
    if (canSound()) snd.tone(480, 0.14, 0.05, 'triangle', 420);
  }
  if (s.winner >= 0) return gameOver();
  if (mode === 'daily' && s.turn !== 0) return dailyMiss();
  updateHud();
}
function scratch(dur) {
  if (!canSound()) return;
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
  recEnd('quit');
  snd.unlock();
  mode = m; score = [0, 0]; game = 0; after = []; paused = false;
  first = m === 'bot' && save.played === 0;
  level = m === 'bot' ? (first ? 0 : save.level) : 0;
  seats = [false, m === 'bot'];
  show(null); $('hud').classList.add('on'); $('turn').classList.add('on');
  recStart({ mode: m, level, first });
  kickOff();
}
function gameOver() {
  ended = true;
  const scorer = s.winner, how = s.how;
  if (mode === 'demo') { later(2200, () => { game++; kickOff(); }); return; }
  if (mode === 'daily') return dailyEnd();
  if (mode !== 'table') score[scorer]++;
  rec.event('goal', { by: mode === 'table' ? (scorer === roomSeat ? 'you' : 'friend') : scorer, how });
  if (canSound()) {
    if (how === 'stuck') snd.tone(196, 0.4, 0.08, 'sine', -60);
    else { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd.tone(f, 0.22, 0.09, 'triangle'), i * 110)); }
  }
  toast(t(how === 'stuck' ? 'stuck' : how === 'own' ? 'ownGoal' : 'goal'), INK[scorer]);
  updateHud();
  later(1200, () => {
    if (Math.max(...score) >= 2) return matchOver();
    if (mode === 'table') return showRoomSheet();
    const names = playerNames(), lead = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
    const lines = { a: Math.max(...score), b: Math.min(...score) };
    $('betweenTitle').textContent = lead < 0 ? t('allSquare') : mode === 'bot' && lead === 0 ? t('leadYou', lines) : t('leadName', { name: names[lead], ...lines });
    $('betweenTitle').style.color = lead < 0 ? '' : INK[lead];
    const stuckKey = mode === 'bot' ? (scorer === 0 ? 'stuckBot' : 'stuckYou') : 'stuckName';
    $('betweenLine').textContent = how === 'stuck' ? t(stuckKey, { name: names[1 - scorer] }) : t(how === 'own' ? 'ownGoalLine' : 'firstToTwo');
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
    line = save.level !== was ? t('nextUp', { level: levelName(save.level) }) : t('nextUpAgain', { level: levelName(save.level) });
    if (first) line = t(winner === 0 ? 'nowFullPitchMedium' : 'nextFullPitch');
    $('endTitle').textContent = t(winner === 0 ? 'youWin' : 'botWins');
  } else if (mode === 'table') {
    $('endTitle').textContent = winner === roomSeat ? t('youWin') : t('nameWins', { name: names[winner] });
  } else {
    $('endTitle').textContent = t('nameWins', { name: names[winner] });
    line = t('passPhone');
  }
  $('endTitle').style.color = INK[winner];
  $('endLine').textContent = line;
  $('again').textContent = t('rematch');
  $('again').disabled = false;
  $('again').parentElement.hidden = false;
  recEnd(mode === 'two' ? 'finished' : winner === (mode === 'table' ? roomSeat : 0) ? 'won' : 'lost');
  showEnd(`${score[0]} – ${score[1]}`);
  if (mode === 'table') updateRoomEnd();
}
function playerNames() {
  if (mode === 'table') return [roomSeats[0]?.n ?? t('blue'), roomSeats[1]?.n ?? t('red')];
  return mode === 'bot' ? [t('you'), t('theBot')] : [t('blue'), t('red')];
}

// ---------- friends' tables

function friendCard() {
  $('friendName').value = save.name;
  $('joinCode').value = '';
  $('friendEntry').hidden = false;
  $('roomInvite').hidden = true;
  $('roomLinkField').hidden = true;
  show('friendCard');
}
function openRoom(code, inviting) {
  roomInviting = inviting;
  roomSeat = null; roomSeats = [];
  mode = 'table';
  document.body.classList.add('table');
  setPauseLabel();
  $('friendEntry').hidden = true;
  $('roomInvite').hidden = !inviting;
  $('roomCode').textContent = code;
  $('roomLink').value = linkFor(code);
  $('roomLinkField').hidden = true;
  $('shareLink').textContent = t('shareLink');
  show('friendCard');
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  history.replaceState(null, '', url);
  room ??= table({
    game: 'pitch', version: 1, Socket: window.__pitchSocket ?? window.WebSocket, name: () => save.name,
    onState: receiveRoomState, onMove: receiveRoomMove, onSeats: receiveRoomSeats,
    onGame: ({ game, seed }) => receiveRoomState({ seat: roomSeat, game, seed, seats: roomSeats, log: [], again: [] }),
    onAgain: recordRoomVote, onStatus: () => { watchRoomLag(); updateRoomView(); },
  });
  room.open(code);
}
function leaveRoom() {
  room.leave();
  roomNext = null;
  clearTimeout(roomLagTimer);
  roomLag = false;
  document.body.classList.remove('table');
  setPauseLabel();
  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState(null, '', url);
}
function newRoomSheet() {
  return create(8, 10, (roomSeed + score[0] + score[1]) % 2);
}
function recordRoomPoint(st) {
  score[st.winner]++;
  return score[st.winner] < 2 ? newRoomSheet() : null;
}
function validRoomMove(st, seat, ints) {
  return st?.turn === seat && ints.length === 1 && legal(st).includes(ints[0]);
}
function receiveRoomState(state) {
  roomSeat = state.seat; roomSeats = state.seats; roomSeed = state.seed; roomGame = state.game;
  roomMoves = state.log.length; roomVotes = state.again.slice();
  score = [0, 0]; roomNext = null;
  s = newRoomSheet();
  for (const [seat, ...ints] of state.log) {
    if (!validRoomMove(s, seat, ints)) continue;
    apply(s, ints[0]);
    if (s.winner >= 0) s = recordRoomPoint(s) ?? s;
  }
  resetRoomDrawing();
  receiveRoomSeats(roomSeats);
  if (ended) matchOver();
  watchRoomLag();
}
function resetRoomDrawing() {
  anim = null; queue = []; after = []; pop = null; drag = null; reveal = false;
  ended = s.winner >= 0;
  clearTimeout(toastTimer);
  $('toast').classList.remove('on');
  layout();
}
function showRoomSheet() {
  s = roomNext; roomNext = null;
  resetRoomDrawing();
  updateHud();
}
function receiveRoomMove(seat, ints, index) {
  roomMoves = index + 1;
  watchRoomLag();
  if (roomSeat === null || !validRoomMove(roomNext ?? s, seat, ints)) return;
  if (roomNext) showRoomSheet();
  startSegment(ints[0], HUMAN_MS);
  if (s.winner >= 0) {
    roomNext = recordRoomPoint(s);
    updateHud();
  }
}
function receiveRoomSeats(nextSeats) {
  roomSeats = nextSeats;
  if (roomSeat === null) return;
  if (screen === 'friend') $('roomInvite').hidden = !!roomSeats[1 - roomSeat];
  if (roomSeats.every(Boolean) && (screen === 'friend' || (screen === 'end' && !ended))) {
    $('hud').classList.add('on'); $('turn').classList.add('on');
    show(null);
    rec.event('table-joined', { seat: roomSeat, rematch: screen === 'end' });
    recStart({ mode: 'table', seat: roomSeat });
  }
  updateRoomView();
}
function watchRoomLag() {
  if (!room?.waiting) {
    clearTimeout(roomLagTimer);
    roomLagTimer = 0;
    roomLag = false;
  } else if (!roomLagTimer) {
    roomLagTimer = setTimeout(() => {
      roomLag = room.waiting;
      updateRoomNotice();
    }, 600);
  }
  updateRoomNotice();
}
function roomMessage() {
  switch (room?.status) {
    case 'connecting': return t(roomInviting ? 'waitingFriend' : 'connecting');
    case 'waiting': return t('reconnecting');
    case 'full': return t('tableFull');
    case 'version': return t('reloadVersion');
    case 'closed': return t('tableClosed');
    case 'live': {
      const friend = roomSeats[1 - roomSeat];
      if (!friend) return t('waitingFriend');
      const messages = [];
      if (!friend.on) messages.push(t('friendDropped', { name: friend.n }));
      if (roomLag) messages.push(t('sendingMove'));
      return messages.join(' ');
    }
    default: return '';
  }
}
function updateRoomNotice() {
  const message = mode === 'table' ? roomMessage() : '';
  for (const [id, visible] of [['lobbyStatus', screen === 'friend'], ['roomStatus', screen === 'play'], ['roomEndStatus', screen === 'end']]) {
    const el = $(id);
    if (el.textContent !== message && visible) el.textContent = message;
    el.hidden = !visible || !message;
  }
}
function updateRoomView() {
  if (roomSeat !== null) updateHud();
  updateRoomNotice();
  if (screen === 'end') updateRoomEnd();
}
function recordRoomVote(seat) {
  if (!roomVotes.includes(seat)) roomVotes.push(seat);
  if (screen === 'end') updateRoomEnd();
}
function updateRoomEnd() {
  const friend = playerNames()[1 - roomSeat], voted = roomVotes.includes(roomSeat);
  $('endLine').textContent = voted ? t('waitingFor', { name: friend }) : roomVotes.includes(1 - roomSeat) ? t('wantsRematch', { name: friend }) : '';
  $('again').disabled = voted || room.status !== 'live';
}

// ---------- daily

function utcDate() {
  const q = new URLSearchParams(location.search).get('date');
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Date().toISOString().slice(0, 10);
}
function startDaily() {
  recEnd('quit');
  snd.unlock();
  const date = utcDate();
  if (!today || today.date !== date) today = daily(date);
  dailyRec = save.daily[date] || (save.daily[date] = { used: 0, solved: false });
  mode = 'daily'; after = []; paused = false; game = 0;
  show(null); $('hud').classList.add('on'); $('turn').classList.add('on');
  if (dailyRec.solved || dailyRec.used >= 3) return dailyResult();
  recStart({ mode: 'daily', triesUsed: dailyRec.used });
  resetAttempt();
}
function resetAttempt() {
  s = clone(today.state); attemptStart = s.log.length;
  anim = null; queue = []; botAt = -1; ended = false; reveal = false; pop = null;
  layout(); updateHud();
}
function dailyMiss() {
  ended = true; snd.tone(196, 0.3, 0.06, 'sine', -40);
  toast(t(dailyRec.used >= 3 ? 'noMoreTries' : 'notThisTime'), INK[1]);
  updateHud();
  later(1300, () => (dailyRec.used >= 3 ? dailyResult() : resetAttempt()));
}
function dailyEnd() {
  if (s.winner === 0 && s.how === 'goal') {
    dailyRec.solved = true; dailyRec.path = s.log.slice(attemptStart).map(e => [e[0], e[1]]); store();
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd.tone(f, 0.22, 0.09, 'triangle'), i * 110));
    toast(t('goal'), INK[0]); updateHud();
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
  if (running) { rec.event('daily-finished', { solved: !!dailyRec.solved, tries: dailyRec.used }); recEnd(dailyRec.solved ? 'won' : 'lost'); }
  $('endTitle').textContent = t(dailyRec.solved ? 'scored' : 'hereWasTheWay');
  $('endTitle').style.color = dailyRec.solved ? INK[0] : '';
  const hours = Math.max(1, Math.ceil((Date.UTC(...nextDay()) - Date.now()) / 3600000));
  $('endLine').innerHTML = `${dotsHtml()} &nbsp;${t('newPitchIn', { hours })}`;
  $('again').parentElement.hidden = true;
  showEnd(dailyRec.solved ? t('goalTry', { n: dailyRec.used }) : t('noGoal'));
}
function nextDay() { const d = new Date(); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1]; }
function dotsHtml(rec = dailyRec) {
  let h = `<span class="dots" aria-label="${t('tries')}">`;
  for (let i = 0; i < 3; i++) h += `<i class="${rec && i < rec.used ? (rec.solved && i === rec.used - 1 ? 'won' : 'used') : ''}"></i>`;
  return h + '</span>';
}
function renderDailyHud() { if (mode === 'daily') $('tag').innerHTML = dotsHtml(); }

// ---------- HUD, cards, picture

function updateHud() {
  if (!s) return;
  if (mode === 'daily') {
    $('score').innerHTML = `<div><span class="b">${t('today')}</span><small>${dateLabel(today.date)}</small></div>`;
    renderDailyHud();
  } else if (mode === 'table') {
    const board = $('score');
    if (!board.querySelector('[data-seat]')) {
      board.innerHTML = '<div data-seat="0"><span class="b"></span><small><i class="seat-light" role="img"></i><span class="seat-name"></span></small></div><span>–</span><div data-seat="1"><span class="r"></span><small><i class="seat-light" role="img"></i><span class="seat-name"></span></small></div>';
    }
    for (const [seat, row] of [...board.querySelectorAll('[data-seat]')].entries()) {
      const name = playerNames()[seat], connected = roomSeats[seat]?.on && (seat !== roomSeat || room.status === 'live');
      row.firstElementChild.textContent = score[seat];
      row.querySelector('.seat-name').textContent = name;
      row.title = name;
      const light = row.querySelector('.seat-light');
      light.classList.toggle('on', !!connected);
      light.setAttribute('aria-label', t(connected ? 'connected' : 'disconnected'));
    }
    $('tag').textContent = '';
  } else {
    const names = playerNames();
    $('score').innerHTML = `<div><span class="b">${score[0]}</span><small>${names[0]}</small></div><span>–</span><div><span class="r">${score[1]}</span><small>${mode === 'bot' ? t('botLevel', { level: levelName(level) }) : names[1]}</small></div>`;
    $('tag').textContent = mode === 'bot' && first ? t('smallPitch') : '';
  }
  const p = s.turn, names = (mode === 'bot' ? ['turnYou', 'turnBot'] : mode === 'daily' ? ['turnDaily', 'turnDailyOver'] : ['turnBlue', 'turnRed']).map(k => t(k));
  document.documentElement.style.setProperty('--turn', INK[mode === 'table' && s.winner >= 0 ? s.winner : p]);
  $('turnText').textContent = s.winner >= 0 ? t(s.winner === 0 ? 'blueScores' : 'redScores') : names[p];
  if (mode === 'bot' && s.winner >= 0) $('turnText').textContent = t(s.winner === 0 ? 'yourPoint' : 'botPoint');
  if (mode === 'table') {
    $('turnText').textContent = s.winner >= 0
      ? (s.winner === roomSeat ? t('yourPoint') : t('nameScores', { name: playerNames()[s.winner] }))
      : (p === roomSeat ? t('turnYou') : t('turnName', { name: playerNames()[p] }));
  }
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
  c.save();
  orient(c, lay, s);
  drawPitch(c, lay, s, s.log.length, reveal ? revealSegs() : []);
  if (mode === 'table') drawRoomGoals(c, lay, s);
  c.restore();
  drawBall(c, viewPoint(pxy(lay, s, s.ball), lay, s), cell);
  c.fillStyle = '#26262a'; c.textBaseline = 'middle';
  c.font = `700 30px ${getComputedStyle(document.documentElement).getPropertyValue('--hand')}`;
  c.fillText(mode === 'daily' ? t('pictureTitleDaily', { date: dateLabel(today.date, false) }) : t('title'), pad, pad + 18);
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
  if (mode === 'table' && paused) { paused = false; snd.release(); }
  pictureBlob = null; $('toast').classList.remove('on');
  const pc = picture(scoreText);
  if (pictureUrl) URL.revokeObjectURL(pictureUrl);
  $('pic').alt = t('pictureAlt');
  $('pic').src = pc.toDataURL('image/png');
  pc.toBlob(b => { pictureBlob = b; });
  $('hud').classList.remove('on'); $('turn').classList.remove('on');
  show('end');
}
function savePicture() {
  if (!pictureBlob) return;
  const name = mode === 'daily' ? t('fileDaily', { date: today.date }) : t('file');
  const file = new File([pictureBlob], name, { type: 'image/png' });
  const download = () => {
    const a = document.createElement('a'); pictureUrl = URL.createObjectURL(pictureBlob);
    a.href = pictureUrl; a.download = name; document.body.append(a); a.click(); a.remove();
  };
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: t('title') }).catch(e => { if (e && e.name !== 'AbortError') download(); });
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
    const dl = Math.hypot(DX[d], DY[d]), dot = viewSign() * (dx * DX[d] + dy * DY[d]) / (len * dl);
    if (dot > bestDot) { bestDot = dot; best = d; }
  }
  return best;
}
function nearest(x, y) {
  let best = -1, bestDist = Math.max(44, L.cell * 1.3);
  for (const d of legal(s)) {
    const p = viewBall(target(s, d)), dist = Math.hypot(p.x - x, p.y - y);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}
canvas.addEventListener('pointerdown', e => {
  if (!canTap()) return;
  const b = viewBall(s.ball);
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
  const b = viewBall(s.ball);
  const d = g.moved ? aimFrom(e.clientX - b.x, e.clientY - b.y) : nearest(e.clientX, e.clientY);
  if (d < 0) return;
  if (mode === 'table') {
    snd.unlock();
    if (room.move([d])) watchRoomLag();
  } else startSegment(d, HUMAN_MS);
});
canvas.addEventListener('pointercancel', () => { drag = null; });

function pause() {
  if (paused || screen !== 'play' || mode === 'demo' || !s) return;
  paused = true; drag = null; snd.hold();
  setPauseTitle();
  $('restart').hidden = mode === 'daily' || mode === 'table';
  show('paused');
}
function setPauseTitle() { $('pauseTitle').textContent = t(mode === 'table' ? 'tableMenu' : 'pencilsDown'); }
function setPauseLabel() { $('pauseBtn').setAttribute('aria-label', t(mode === 'table' ? 'tableMenu' : 'pause')); }
function resume() { paused = false; snd.release(); show(null); }
function toMenu() {
  recEnd('quit');
  if (mode === 'table') leaveRoom();
  paused = false; snd.release(); mode = 'demo'; game = 0; after = [];
  $('hud').classList.remove('on'); $('turn').classList.remove('on');
  show('menu'); refreshMenu(); kickOff();
}
function refreshMenu() {
  $('playSub').textContent = save.played === 0 ? t('firstMatch') : t('bestOf', { level: levelName(save.level) });
  const rec = save.daily[utcDate()];
  $('dailyDots').innerHTML = dotsHtml(rec || { used: 0 }).replace(/^<span class="dots"[^>]*>|<\/span>$/g, '');
  for (const id of ['soundMenu', 'soundPause']) $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff');
}
function toggleSound() { save.sound = !save.sound; store(); refreshMenu(); if (save.sound) { snd.unlock(); snd.tone(660, 0.1, 0.06, 'triangle'); } }

$('play').onclick = () => startMatch('bot');
$('two').onclick = () => startMatch('two');
$('daily').onclick = startDaily;
$('friend').onclick = friendCard;
$('friendName').oninput = e => { save.name = e.target.value.slice(0, 24); store(); };
$('newTable').onclick = () => { snd.unlock(); openRoom(newCode(), true); };
$('joinForm').onsubmit = e => {
  e.preventDefault();
  const code = cleanCode($('joinCode').value);
  if (code) { snd.unlock(); openRoom(code, false); }
};
$('shareLink').onclick = async () => {
  const code = room.code;
  const result = await share(code, t('shareText'));
  if (mode !== 'table' || room.code !== code) return;
  if (result === 'copied') $('shareLink').textContent = t('linkCopied');
  if (result === 'shown') {
    $('roomLinkField').hidden = false;
    $('roomLink').select();
  }
};
$('roomLeave').onclick = toMenu;
$('pauseBtn').onclick = pause;
$('resume').onclick = resume;
$('restart').onclick = () => startMatch(mode);
$('quit').onclick = toMenu;
$('endMenu').onclick = toMenu;
$('again').onclick = () => {
  if (mode === 'table') {
    if (room.again()) recordRoomVote(roomSeat);
  } else startMatch(mode);
};
$('next').onclick = () => { show(null); game++; kickOff(); };
$('savePic').onclick = savePicture;
$('soundMenu').onclick = toggleSound;
$('soundPause').onclick = toggleSound;
addEventListener('keydown', e => { if (isPauseKey(e)) { if (paused) resume(); else pause(); } });
addEventListener('resize', layout);
onLeave(() => {
  if (mode !== 'table') pause();
  else drag = null;
});

hint(canvas, {
  kind: 'tap', label: t('hintLabel'), key: 'pitch:hint', played: !!loaded && (loaded.played > 0 || Object.keys(loaded.daily || {}).length > 0),
  when: () => canTap(),
  // Over the legal point nearest the middle column, so the finger taps where a line can go.
  bottom: () => {
    if (!s) return 120;
    let best = null;
    for (const d of legal(s)) { const p = viewBall(target(s, d)); if (!best || Math.abs(p.x - W / 2) < Math.abs(best.x - W / 2)) best = p; }
    return best ? Math.max(40, H - best.y - safe.bottom) : 120;
  },
});

// Every visible word again after the language changes: static markup, then text the page sets from code.
function retext() {
  applyWords();
  document.title = t('title');
  $('pic').alt = t('pictureAlt');
  setPauseLabel();
  if (paused) setPauseTitle();
  const label = document.querySelector('.kit-hint .label');
  if (label) label.textContent = t('hintLabel');
  refreshMenu();
  updateHud();
  updateRoomNotice();
  if (mode === 'table' && roomSeat !== null && screen === 'end') updateRoomEnd();
}
for (const id of ['langMenu', 'langPause']) {
  $(id).addEventListener('click', () => {
    setLang(lang() === 'en' ? 'tr' : 'en');
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', lang()); history.replaceState(history.state, '', url); }
    retext();
  });
}

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
  get legal() { return s ? legal(s).map(d => { const t = target(s, d), q = xy(s, t), p = viewBall(t); return { d, x: q.x, y: q.y, sx: p.x, sy: p.y, bounce: bounces(s, t) }; }) : []; },
  get room() { return mode === 'table' && room ? { code: room.code, seat: roomSeat, game: roomGame, seed: roomSeed, moves: roomMoves, status: room.status, waiting: room.waiting } : null; },
  get goalEnds() { return s ? [s.h + 1, -1].map(y => viewPoint(at(L, s.w / 2, y))) : []; },
  get daily() { return today ? { date: today.date, used: dailyRec?.used ?? 0, solved: !!dailyRec?.solved, attemptStart } : null; },
  state() { return s ? snapshot(roomNext ?? s) : null; },
  save() { return JSON.parse(JSON.stringify(save)); },
});

retext();
const linkedRoom = codeFromLink();
if (linkedRoom) openRoom(linkedRoom, false);
else kickOff();
requestAnimationFrame(frame);

// The notice is on the menu card, which is on screen before Play; the switch is on the pause card (the table menu at a table).
rec.notice($('menu').firstElementChild);
rec.notice($('friendCard').firstElementChild); // a friend's link opens on this card, before any Play
rec.toggle($('paused').firstElementChild);
