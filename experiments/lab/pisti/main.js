import { deal, play, score, view, dailySeed, rank, suit, isJack, capturesWith, tableMove, RANKS, SUITS, totalPlies } from './sim.js';
import { choose, LEVELS } from './brain.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { table, newCode, cleanCode, linkFor, codeFromLink, share } from '../../kit/room.js';
import { t, lang, apply, setLang, dateLabel } from './words.js';

noZoom();
const KEY = 'pisti:v1';
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const SPEED = Math.max(0.25, Math.min(20, Number(q.get('speed')) || 1));
const BOT_MS = 600;
const DAILY_LEVEL = 'medium';
const today = /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : new Date().toISOString().slice(0, 10);

const blank = () => ({ v: 1, level: 0, losses: 0, hands: 0, len: 'one', four: false, sound: true, daily: {}, name: '' });
const loaded = readJson(KEY);
const save = { ...blank(), ...(loaded && typeof loaded === 'object' ? loaded : {}) };
if (!save.daily || typeof save.daily !== 'object') save.daily = {};
save.level = Math.max(0, Math.min(2, save.level | 0));
if (typeof save.name !== 'string') save.name = '';
const store = () => {
  const days = Object.keys(save.daily).sort();
  for (const d of days.slice(0, Math.max(0, days.length - 60))) delete save.daily[d];
  writeJson(KEY, save);
};

const snd = sound({ on: () => save.sound });
const show = screens(['menu', 'friendCard', 'paused', 'cover', 'score'], name => { screen = name || 'play'; });
let screen = 'menu';

// Game state for the page.
let g = null;
let token = 0;
let paused = false;
let busy = false;
let anim = { flames: [], heat: 0, shimmer: 0, burst: 0 };

const isHuman = seat => g.mode === 'two' || seat === (g.mode === 'table' ? g.seat : 0);
// Pass-and-play follows the viewer. A table keeps the local seat at the bottom.
const bottomSeat = () => g.mode === 'two' ? g.viewer : g.mode === 'table' ? g.seat : 0;
const levelName = () => LEVELS[save.level];

function newGame(mode) {
  const daily = mode === 'daily';
  const dayInfo = save.daily[today];
  const practice = daily && !!dayInfo;
  const seed = daily ? dailySeed(today) : q.has('seed') ? Number(q.get('seed')) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
  g = {
    mode, seed, practice, level: daily ? DAILY_LEVEL : levelName(), match: mode === 'play' && save.len === '51',
    totals: [0, 0], handNo: 0, dealer: 1, viewer: 0, s: null, captures: [],
  };
  startHand();
}

function startHand() {
  const myToken = ++token;
  g.s = deal(g.handNo === 0 ? g.seed : (g.seed + g.handNo * 7919) >>> 0, g.dealer);
  g.captures = [];
  scoreView = null;
  g.viewer = g.s.turn;
  g.hints = save.hands < 3;
  show(null);
  $('table').classList.add('on');
  $('practice').style.display = g.practice ? 'block' : 'none';
  layout();
  render();
  dealIn(myToken).then(() => next(myToken));
}

// Pausable waiting: time only runs while the game is not paused.
function wait(ms) {
  ms /= SPEED;
  return new Promise(done => {
    let left = ms, last = performance.now();
    const tick = now => {
      if (!paused) left -= now - last;
      last = now;
      if (left <= 0) done(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
async function pause() {
  if (screen !== 'play' || !g || g.s.done) return;
  paused = true; snd.hold(); show('paused');
}
function resume() {
  paused = false; snd.release(); show(null);
  if (g.mode === 'table') { render(); updateRoomView(); }
}

async function dealIn(myToken) {
  busy = true;
  const cards = [...document.querySelectorAll('#hand .card, #oppHand .card')];
  cards.forEach(el => { el.style.opacity = '0'; });
  for (const el of cards) {
    if (myToken !== token) return;
    el.style.opacity = '1';
    snd.noise(0.03, 0.05, 3200);
    await wait(45);
  }
  busy = false;
}

async function next(myToken) {
  if (myToken !== token) return;
  const s = g.s;
  if (s.done) return finish(myToken);
  if (isHuman(s.turn)) {
    if (g.mode === 'two' && g.viewer !== s.turn) {
      g.viewer = s.turn;
      g.covered = true;
      render();
      $('coverWho').textContent = t('player', { n: s.turn + 1 });
      const last = s.log[s.log.length - 1];
      $('coverMove').textContent = last ? t(last.capture ? 'coverTook' : 'coverPlayed', { who: t('player', { n: last.seat + 1 }), card: cardName(last.card) }) : '';
      show('cover');
      return;
    }
    render();
    return;
  }
  render();
  await wait(BOT_MS);
  if (myToken !== token) return;
  const card = choose(view(g.s, g.s.turn), g.level);
  await doPlay(card, myToken);
}

function cardName(c) { return t('cardOf', { rank: t('r' + rank(c)), suit: t('s' + suit(c)) }); }

async function doPlay(card, myToken) {
  busy = true;
  const s = g.s, seat = s.turn;
  if (g.mode === 'daily' && !g.practice && !save.daily[today]) { save.daily[today] = { started: true }; store(); }
  const from = seat === bottomSeat() ? document.querySelector(`#hand [data-card="${card}"]`) : $('oppHand').lastElementChild;
  const fromRect = from ? from.getBoundingClientRect() : $('pile').getBoundingClientRect();
  const nextState = play(s, card);
  const entry = nextState.log[nextState.log.length - 1];
  // Fly the card to the pile.
  const fly = cardEl(card);
  fly.classList.add('fly');
  const pr = $('pile').getBoundingClientRect();
  Object.assign(fly.style, { left: `${pr.left}px`, top: `${pr.top}px`, transform: `translate(${fromRect.left - pr.left}px, ${fromRect.top - pr.top}px)` });
  if (from) from.style.visibility = 'hidden';
  document.body.append(fly);
  snd.noise(0.05, 0.1, 2600);
  fly.getBoundingClientRect();
  fly.style.transitionDuration = `${240 / SPEED}ms`;
  fly.style.transform = `translate(0, 0) rotate(${tilt(card)}deg)`;
  await wait(250);
  fly.remove();
  if (myToken !== token) return;
  // Show the card on the pile before any capture.
  g.s = { ...s, hands: s.hands.map((h, i) => i === seat ? h.filter(c => c !== card) : h), pile: [...s.pile, card], log: nextState.log };
  render();
  if (entry.capture) {
    g.captures.push({ seat, kind: entry.kind });
    const big = entry.kind === 'pisti' || entry.kind === 'double';
    if (big) {
      celebratePisti(entry.kind);
      // The pişti moment keeps its full length at any test speed, so it can be seen.
      await wait(1100 * SPEED);
    } else {
      snd.tone(isJack(card) ? 392 : 523, 0.12, 0.1, 'triangle'); setTimeout(() => snd.tone(784, 0.16, 0.08, 'triangle'), 90);
      await wait(380);
    }
    if (myToken !== token) return;
    await sweep(seat);
  } else if (nextState.leftover && nextState.leftover.size) {
    // The hand is over: what is left on the table goes to the last capturer.
    await wait(450);
    if (myToken !== token) return;
    await sweep(nextState.leftover.seat);
  }
  if (myToken !== token) return;
  const newDeal = nextState.dealNo !== s.dealNo;
  g.s = nextState;
  render();
  if (newDeal) await dealIn(myToken);
  busy = false;
  next(myToken);
}

function celebratePisti(kind) {
  anim.burst = performance.now();
  $('shout').textContent = t(kind === 'double' ? 'shoutDouble' : 'shout');
  $('shout').classList.remove('on'); $('shout').getBoundingClientRect(); $('shout').classList.add('on');
  snd.tone(330, 0.7, 0.13, 'triangle', 660); snd.tone(495, 0.7, 0.08, 'sine', 990); snd.noise(0.6, 0.18, 700);
}

// Slide the pile to a seat's captured stack.
async function sweep(seat) {
  const target = (seat === bottomSeat() ? $('myStack') : $('oppStack')).getBoundingClientRect();
  const pileEl = $('pile'), r0 = pileEl.getBoundingClientRect();
  pileEl.classList.add('sweep');
  pileEl.style.transitionDuration = `${320 / SPEED}ms`;
  pileEl.style.transform = `translate(${target.left - r0.left - 20}px, ${target.top - r0.top - 30}px) scale(.35)`;
  pileEl.style.opacity = '0';
  await wait(330);
  pileEl.classList.remove('sweep'); pileEl.style.transform = ''; pileEl.style.opacity = '';
}

const tilt = c => ((c * 37) % 11) - 5;

async function finish(myToken) {
  const s = g.s, sc = score(s);
  save.hands++;
  const me = sc[0].total, them = sc[1].total;
  g.totals = [g.totals[0] + me, g.totals[1] + them];
  const matchOver = !g.match || ((g.totals[0] >= 51 || g.totals[1] >= 51) && g.totals[0] !== g.totals[1]);
  g.matchOver = matchOver;
  if (g.mode === 'play' && matchOver) {
    const won = g.match ? g.totals[0] > g.totals[1] : me > them, lost = g.match ? g.totals[0] < g.totals[1] : me < them;
    if (won) { save.level = Math.min(2, save.level + 1); save.losses = 0; }
    else if (lost) { save.losses++; if (save.losses >= 2) { save.level = Math.max(0, save.level - 1); save.losses = 0; } }
  }
  if (g.mode === 'daily' && !g.practice) {
    save.daily[today] = { started: true, done: true, me, them, margin: me - them, strip: g.captures.map(c => (c.seat ? 'b' : 'y') + c.kind[0]).join('') };
  }
  store();
  showScore(sc, matchOver, myToken);
}

const ROWS = [['rowJacks', 'jacks'], ['rowAces', 'aces'], ['rowTwo', 'two'], ['rowTen', 'ten'], ['rowMost', 'most'], ['rowPisti', 'pisti']];
const mark = text => text.replace('♦', '♦︎').replace('♣', '♣︎');

// The score card's words, drawn from the stored view so a language switch can redraw them at any moment.
let scoreView = null;
function paintScore() {
  const v = scoreView;
  if (!v || !g) return;
  const names = v.atTable ? roomSeats.map(seat => seat.n) : g.mode === 'two' ? [t('player', { n: 1 }), t('player', { n: 2 })] : [t('you'), t('bot')];
  const tb = $('scoreT').tBodies[0];
  names.forEach((name, seat) => { tb.firstElementChild.children[seat + 1].textContent = name; });
  for (const row of tb.querySelectorAll('tr[data-k]')) {
    const k = row.dataset.k, key = ROWS.find(x => x[1] === k)[0];
    row.children[0].textContent = mark(k === 'most' && row.dataset.shown ? t('rowMostCount', { a: v.sc[0].cards, b: v.sc[1].cards }) : t(key));
  }
  tb.querySelector('tr.total').children[0].textContent = t('total');
  const lead = g.match ? g.totals[0] - g.totals[1] : v.sc[0].total - v.sc[1].total;
  if (!v.counted) { $('scoreTitle').textContent = t('counting'); $('matchLine').textContent = ''; }
  else {
    $('scoreTitle').textContent = v.atTable || g.mode === 'two'
      ? (lead > 0 ? t('wins', { name: names[0] }) : lead < 0 ? t('wins', { name: names[1] }) : t('draw'))
      : (lead > 0 ? t('youWin') : lead < 0 ? t('botWins') : t('draw'));
    if (g.match) $('matchLine').textContent = t(v.matchOver ? 'matchOver' : 'matchTo51', { a: g.totals[0], b: g.totals[1] });
    else if (g.mode === 'daily') $('matchLine').textContent = t('margin', { n: fmt(v.sc[0].total - v.sc[1].total) });
  }
  $('again').textContent = v.atTable ? t('dealAgain') : g.match && !v.matchOver ? t('nextHand') : g.mode === 'daily' ? t('againDaily') : t('again');
  const kept = save.daily[today]?.margin;
  $('dailyNote').textContent = g.mode === 'daily' ? (!g.practice ? t('dailyScored', { date: dateLabel(today) }) : kept === undefined ? t('dailyUnfinished') : t('dailyKept', { margin: fmt(kept) })) : '';
  if (v.atTable) updateRoomView();
}

async function showScore(sc, matchOver, myToken) {
  const atTable = g.mode === 'table';
  scoreView = { sc, matchOver, atTable, counted: false };
  const tb = $('scoreT').tBodies[0];
  const body = ROWS.map(([, k]) => `<tr data-k="${k}"><td></td><td></td><td></td></tr>`).join('');
  tb.innerHTML = '<tr class="head"><th></th><th></th><th></th></tr>' + body + '<tr class="total"><td></td><td>0</td><td>0</td></tr>';
  const me = sc[0].total, them = sc[1].total;
  $('daily').classList.toggle('on', g.mode === 'daily');
  if (g.mode === 'daily') drawStrip($('strip'), g.captures);
  const kept = save.daily[today]?.margin;
  $('savePic').style.display = kept === undefined ? 'none' : '';
  paintScore();
  show('score');
  if (atTable) updateRoomView();
  const rows = [...tb.querySelectorAll('tr[data-k]')], total = tb.querySelector('tr.total');
  const run = [0, 0];
  for (const row of rows) {
    await wait(330);
    if (myToken !== token) return;
    const k = row.dataset.k;
    const v = [sc[0][k], sc[1][k]];
    row.children[1].textContent = v[0]; row.children[2].textContent = v[1];
    if (k === 'most') { row.children[1].textContent = `${v[0] || '–'}`; row.children[2].textContent = `${v[1] || '–'}`; row.dataset.shown = '1'; paintScore(); }
    if (k === 'pisti' && (v[0] || v[1])) row.children[v[0] > v[1] ? 1 : 2].classList.add('hot');
    row.classList.add('on');
    run[0] += v[0]; run[1] += v[1];
    total.children[1].textContent = run[0]; total.children[2].textContent = run[1];
    if (v[0] || v[1]) snd.tone(440 + 40 * rows.indexOf(row), 0.08, 0.06, 'triangle');
  }
  total.classList.add('on');
  await wait(250);
  if (myToken !== token) return;
  const lead = g.match ? g.totals[0] - g.totals[1] : me - them;
  scoreView.counted = true;
  paintScore();
  if (lead > 0) [523, 659, 784].forEach((f, i) => setTimeout(() => snd.tone(f, 0.25, 0.08, 'triangle'), i * 120));
  g.scored = true;
  if (atTable) updateRoomView();
}

const fmt = n => n === undefined ? '' : n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';

// Icons drawn in code, shared by the play screen and the picture.
const ICON = {
  flame: 'M12 1C13 6 19 9 19 15a7 7 0 0 1-14 0c0-3 2-5 3-6 0 2 1 4 3 4-1-4 0-8 1-12z',
  inner: 'M12 11c1 2 4 3 4 6a4 4 0 0 1-8 0c0-2 2-3 2-5 1 1 2 1 2-1z',
};
function flameSvg(color = '#ff8a1f') {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON.flame}" fill="${color}"/><path d="${ICON.inner}" fill="#ffe28a"/></svg>`;
}
function drawIcon(ctx, kind, x, y, s, mine) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
  const main = mine ? '#f7a531' : '#9aa6ad', dark = mine ? '#7a2a0c' : '#4c5459';
  if (kind === 'p' || kind === 'd') {
    ctx.fillStyle = mine ? '#ff6a1a' : '#9aa6ad'; ctx.fill(new Path2D(ICON.flame));
    ctx.fillStyle = mine ? '#ffe28a' : '#dfe5e8'; ctx.fill(new Path2D(ICON.inner));
    if (kind === 'd') { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(12, 13, 11, 0, Math.PI * 2); ctx.stroke(); }
  } else if (kind === 'j') {
    ctx.fillStyle = main; ctx.beginPath(); ctx.moveTo(3, 20); ctx.lineTo(3, 8); ctx.lineTo(8, 13); ctx.lineTo(12, 4); ctx.lineTo(16, 13); ctx.lineTo(21, 8); ctx.lineTo(21, 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark; ctx.fillRect(3, 17, 18, 3);
  } else {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 2 ? main : dark; ctx.fillRect(5 - i, 14 - i * 4, 16, 6); ctx.strokeStyle = '#fff6'; ctx.lineWidth = 1; ctx.strokeRect(5 - i, 14 - i * 4, 16, 6); }
  }
  ctx.restore();
}
function drawStrip(canvas, caps) {
  const dpr = Math.max(1, Math.min(3, devicePixelRatio || 1));
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 64;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const perRow = Math.max(1, Math.ceil(caps.length / 2));
  const size = Math.min(26, (w - 4) / Math.max(perRow, 10));
  caps.forEach((c, i) => {
    const row = caps.length > 12 ? (i < perRow ? 0 : 1) : 0, col = caps.length > 12 ? (i < perRow ? i : i - perRow) : i;
    const rowsN = caps.length > 12 ? 2 : 1;
    const x = (w - (caps.length > 12 ? perRow : caps.length) * size) / 2 + col * size, y = (h - rowsN * size * 1.1) / 2 + row * size * 1.1;
    drawIcon(ctx, c.kind[0], x + 1, y, size - 2, c.seat === 0);
  });
}
function picture() {
  const W = 1080, H = 720, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.7);
  grd.addColorStop(0, '#9a3d22'); grd.addColorStop(1, '#4a1a10');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fbeedb'; ctx.textAlign = 'center';
  ctx.font = '72px Georgia, serif'; ctx.fillText(t('title'), W / 2, 120);
  ctx.font = '36px system-ui, sans-serif'; ctx.fillStyle = '#fbeedbcc'; ctx.fillText(t('pictureDeal', { date: dateLabel(today) }), W / 2, 180);
  const info = save.daily[today];
  const margin = info?.margin ?? 0;
  ctx.font = 'bold 150px system-ui, sans-serif'; ctx.fillStyle = margin > 0 ? '#ffd36e' : '#fbeedb';
  ctx.fillText(fmt(margin), W / 2, 360);
  const caps = (info?.strip || '').match(/../g)?.map(t => ({ seat: t[0] === 'y' ? 0 : 1, kind: t[1] })) ?? g.captures.map(x => ({ seat: x.seat, kind: x.kind[0] }));
  const size = Math.min(64, (W - 120) / Math.max(1, Math.ceil(caps.length / 2)));
  const perRow = Math.ceil(caps.length / 2) || 1;
  caps.forEach((cap, i) => {
    const row = i < perRow ? 0 : 1, col = row ? i - perRow : i, n = row ? caps.length - perRow : perRow;
    drawIcon(ctx, cap.kind, (W - n * size) / 2 + col * size + 4, 440 + row * size * 1.15, size - 8, cap.seat === 0);
  });
  ctx.font = '28px system-ui, sans-serif'; ctx.fillStyle = '#fbeedb99';
  ctx.fillText(t('pictureKey'), W / 2, H - 40);
  return c;
}
async function savePicture() {
  const c = picture();
  const blob = await new Promise(done => c.toBlob(done, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `pisti-${today}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: t('pictureTitle', { date: dateLabel(today) }) }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Drawing the table.
function cardEl(c, faceDown = false) {
  const el = document.createElement(faceDown ? 'div' : 'button');
  if (faceDown) { el.className = 'card back'; return el; }
  el.className = `card s${suit(c)}${isJack(c) ? ' jack' : ''}`;
  el.dataset.card = c;
  el.type = 'button';
  const s = SUITS[suit(c)] + '︎';
  el.innerHTML = `<span class="r">${RANKS[rank(c)]}</span><span class="s">${s}</span><span class="b">${isJack(c) ? 'J' : s}</span>`;
  el.setAttribute('aria-label', cardName(c));
  el.cardId = c;
  return el;
}

let L = {};
function layout() {
  const W = innerWidth, H = innerHeight;
  const cw = Math.round(Math.max(60, Math.min(96, (Math.min(W, 520) - 28 - 3 * 10) / 4, (H - 300) / 4.2)));
  const ch = Math.round(cw * 1.42);
  document.documentElement.style.setProperty('--cw', `${cw}px`);
  document.documentElement.style.setProperty('--ch', `${ch}px`);
  document.documentElement.style.setProperty('--cwn', `${cw}px`);
  const hand = $('hand').getBoundingClientRect();
  const topY = $('oppRow').getBoundingClientRect().bottom;
  $('myRow').style.top = `${hand.top - 52}px`;
  const midTop = topY + 12, midBottom = hand.top - 56;
  const cy = (midTop + midBottom) / 2 - ch / 2 - 6;
  L = { cw, ch, px: W / 2 - cw / 2, py: cy, W, H };
  Object.assign($('pile').style, { left: `${L.px}px`, top: `${L.py}px` });
  const sw = cw * 0.78;
  Object.assign($('stock').style, { left: `${Math.max(10, L.px - sw - cw * 0.55)}px`, top: `${L.py + ch * 0.12}px` });
  $('turnName').style.top = `${hand.top - 30}px`;
  $('shout').style.top = `${Math.max(midTop, L.py - 70)}px`;
}

function render() {
  if (!g) return;
  const s = g.s, me = bottomSeat(), them = 1 - me;
  // Hand.
  const hand = $('hand');
  hand.innerHTML = '';
  const cards = s.hands[me];
  const gap = 10, total = cards.length * L.cw + (cards.length - 1) * gap;
  const myTurn = s.turn === me && isHuman(me) && !s.done && (g.mode !== 'table' || canPlay());
  cards.forEach((c, i) => {
    const el = g.covered ? cardEl(0, true) : cardEl(c);
    el.style.left = `${L.W / 2 - total / 2 + i * (L.cw + gap)}px`;
    el.style.top = '0px';
    if (myTurn && g.hints && capturesWith(s, c)) el.classList.add('can');
    hand.append(el);
  });
  hand.classList.toggle('wait', !myTurn);
  // Other hand, face down.
  const oh = $('oppHand');
  oh.innerHTML = '';
  s.hands[them].forEach((_, i) => { const el = cardEl(0, true); el.style.left = `${i * 22}px`; el.style.top = '0'; el.style.transform = `rotate(${(i - 1.5) * 4}deg)`; oh.append(el); });
  // Pile: face-down centre cards under the face-up ones.
  const pile = $('pile');
  pile.innerHTML = '';
  const shown = s.pile.slice(-5);
  s.pile.forEach((c, i) => {
    if (i < s.pile.length - 5) return;
    const down = i < s.hidden;
    const el = cardEl(c, down);
    const k = i - (s.pile.length - shown.length);
    el.style.transform = down ? `translate(${(k - 1) * 3}px, ${(k - 1) * -2}px) rotate(${k * 3 - 4}deg)` : `rotate(${tilt(c)}deg) translate(${(k - shown.length + 1) * 4}px, ${(k - shown.length + 1) * 3}px)`;
    if (down) el.removeAttribute('data-card');
    else el.tabIndex = -1;
    pile.append(el);
  });
  pile.classList.toggle('lone', s.pile.length === 1);
  // Stock with the exposed bottom card under it.
  const st = $('stock');
  st.innerHTML = '';
  if (s.stock.length) {
    const b = cardEl(s.bottom); b.classList.add('bottom'); b.tabIndex = -1; b.removeAttribute('data-card');
    Object.assign(b.style, { left: '14px', top: '-4px', width: `${L.cw * 0.78}px`, height: `${L.ch * 0.78}px` });
    st.append(b);
    const layers = Math.min(6, Math.ceil(s.stock.length / 8));
    for (let i = 0; i < layers; i++) {
      const el = cardEl(0, true);
      Object.assign(el.style, { left: `${-i * 1.5}px`, top: `${-i * 1.5}px`, width: `${L.cw * 0.78}px`, height: `${L.ch * 0.78}px` });
      st.append(el);
    }
  }
  // Captured stacks: height grows with the cards taken; flames count piştis.
  stack($('myStack'), s.taken[me].length);
  stack($('oppStack'), s.taken[them].length);
  flames($('myFlames'), s.piCount[me] + 2 * s.doubles[me], true);
  flames($('oppFlames'), s.piCount[them] + 2 * s.doubles[them], false);
  $('myDot').classList.toggle('them', g.mode === 'two' && me === 1);
  $('oppDot').classList.toggle('them', !(g.mode === 'two' && them === 0));
  turnText();
  anim.heat = Math.min(1, s.pile.length / 12);
  anim.lone = s.pile.length === 1;
}
function turnText() {
  const s = g.s, me = bottomSeat(), them = 1 - me;
  $('turnName').textContent = g.mode === 'table' && !s.done
    ? (s.turn === me ? t('yourTurn') : t('turnOf', { name: roomSeats[them].n }))
    : g.mode === 'two' ? t('player', { n: me + 1 }) : '';
}
function stack(el, n) {
  el.innerHTML = '';
  const layers = Math.min(14, Math.ceil(n / 3));
  for (let i = 0; i < layers; i++) { const c = document.createElement('i'); c.style.bottom = `${i * 2.5}px`; el.append(c); }
  el.style.height = `${40 + layers * 2.5}px`;
  el.style.visibility = n ? 'visible' : 'hidden';
}
function flames(el, n, mine) {
  el.innerHTML = Array.from({ length: Math.min(n, 6) }, () => flameSvg(mine ? '#ff6a1a' : '#a9b3b8')).join('');
}

// Input: tap a card, or drag it up.
let press = null;
$('hand').addEventListener('pointerdown', e => {
  const el = e.target.closest('.card');
  if (!el || !canPlay()) return;
  press = { el, id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  try { el.setPointerCapture(e.pointerId); } catch {}
  snd.unlock();
});
$('hand').addEventListener('pointermove', e => {
  if (!press || e.pointerId !== press.id) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  press.moved = Math.max(press.moved, Math.hypot(dx, dy));
  if (press.moved > 8) { press.el.style.transition = 'none'; press.el.style.transform = `translate(${dx}px, ${Math.min(20, dy)}px)`; }
});
const release = e => {
  if (!press || e.pointerId !== press.id) return;
  const p = press; press = null;
  const dy = e.clientY - p.y;
  p.el.style.transition = ''; p.el.style.transform = '';
  if (e.type === 'pointercancel') return;
  if (p.moved < 14 || dy < -40) humanPlay(Number(p.el.dataset.card));
};
$('hand').addEventListener('pointerup', release);
$('hand').addEventListener('pointercancel', release);
// Keyboard: Enter or Space on a focused card (a click with no pointer).
$('hand').addEventListener('click', e => { if (e.detail === 0) { const el = e.target.closest('.card'); if (el) humanPlay(Number(el.dataset.card)); } });

function canPlay() {
  return !!g && screen === 'play' && !busy && !paused && !g.s.done && g.s.turn === bottomSeat()
    && (g.mode !== 'table' || (room.status === 'live' && !room.waiting));
}
function humanPlay(card) {
  if (!canPlay() || !g.s.hands[g.s.turn].includes(card)) return;
  snd.unlock();
  if (g.mode === 'table') {
    if (room.move([card])) {
      $('hand').classList.toggle('wait', !canPlay());
      watchRoomLag();
    }
    return;
  }
  doPlay(card, token);
}

// The brazier, the glow and the flames, drawn every frame behind the cards.
const fx = $('fx'), fctx = fx.getContext('2d');
const coals = Array.from({ length: 14 }, (_, i) => ({ a: (i * 2.39996) % (Math.PI * 2), r: 0.2 + ((i * 0.618) % 0.75), p: i * 1.7 }));
let heatShown = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  if (fx.width !== Math.round(W * dpr) || fx.height !== Math.round(H * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); }
  const ctx = fctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = ctx.createRadialGradient(W / 2, H * 0.45, 30, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#8f3b22'); bg.addColorStop(0.55, '#6a2817'); bg.addColorStop(1, '#3d140c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (!g || screen === 'friendCard') return;
  heatShown += ((anim.heat || 0) - heatShown) * 0.06;
  const cx = L.px + L.cw / 2, cy = L.py + L.ch / 2, bw = L.cw * 1.25;
  const t = now / 1000, flick = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  // Glow: grows and warms with the pile.
  const gr = L.cw * (1.1 + heatShown * 1.6);
  const glow = ctx.createRadialGradient(cx, cy + L.ch * 0.35, 4, cx, cy + L.ch * 0.2, gr);
  glow.addColorStop(0, `rgba(255,${170 - heatShown * 60},60,${(0.25 + heatShown * 0.5) * flick})`);
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy + L.ch * 0.2, gr, 0, Math.PI * 2); ctx.fill();
  // Brazier: a shallow iron bowl on three legs, its coals showing at the rim.
  const by = cy + L.ch * 0.5 + 6;
  ctx.strokeStyle = '#2a1510'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const k of [-0.7, 0, 0.7]) { ctx.beginPath(); ctx.moveTo(cx + k * bw * 0.6, by + 8); ctx.lineTo(cx + k * bw * 0.85, by + 30 - Math.abs(k) * 4); ctx.stroke(); }
  ctx.fillStyle = '#2c1812';
  ctx.beginPath(); ctx.ellipse(cx, by, bw, 16, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#1e0f0b';
  ctx.beginPath(); ctx.ellipse(cx, by, bw, 9, 0, 0, Math.PI * 2); ctx.fill();
  for (const c of coals) {
    const x = cx + Math.cos(c.a) * c.r * bw * 0.92, y = by + Math.sin(c.a) * c.r * 7;
    const b = 0.35 + heatShown * 0.65 * (0.7 + 0.3 * Math.sin(t * 4 + c.p));
    ctx.fillStyle = `rgba(255,${Math.round(90 + 120 * b)},${Math.round(30 + 40 * b)},${0.35 + 0.6 * b})`;
    ctx.beginPath(); ctx.arc(x, y, 3.2 + b * 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#4a2a1e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, by, bw, 9, 0, 0, Math.PI * 2); ctx.stroke();
  // A lone card: heat shimmer rising from it, the sign that it is the prize.
  if (anim.lone && !g.s.done) {
    ctx.save(); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const x0 = cx + (k - 1) * L.cw * 0.3, ph = (t * 0.9 + k * 0.33) % 1;
      ctx.strokeStyle = `rgba(255,226,150,${0.55 * Math.sin(ph * Math.PI)})`;
      ctx.beginPath();
      for (let j = 0; j <= 12; j++) { const yy = L.py - 6 - ph * 34 - j * 3; const xx = x0 + Math.sin(j * 0.8 + t * 6 + k) * 4; if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // Pişti: a burst of flame up from the brazier.
  const since = (now - anim.burst) / 1000;
  if (anim.burst && since < 1.4) {
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + Math.sin(i * 12.9898) * 0.9, sp = 120 + ((i * 53) % 160);
      const life = since * (0.8 + (i % 5) * 0.1);
      const x = cx + Math.cos(a) * sp * life * 0.8 + Math.sin(life * 9 + i) * 6, y = cy + L.ch * 0.3 - Math.abs(Math.sin(a)) * sp * life * 1.3;
      const fade = Math.max(0, 1 - life / 1.1);
      const rad = (14 + (i % 4) * 6) * fade;
      if (rad <= 0) continue;
      const f = ctx.createRadialGradient(x, y, 0, x, y, rad);
      f.addColorStop(0, `rgba(255,240,170,${fade})`); f.addColorStop(0.5, `rgba(255,140,30,${0.8 * fade})`); f.addColorStop(1, 'rgba(200,40,10,0)');
      ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
}
requestAnimationFrame(frame);

// The menu's little brazier.
function hero() {
  const c = $('hero'), dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  c.width = w * dpr; c.height = h * dpr;
  // The drawing is laid out for a 120 px tall canvas and scaled down on short screens.
  const k = Math.min(1, h / 120), ctx = c.getContext('2d'); ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  const cx = w / k / 2, by = h / k - 26;
  const glow = ctx.createRadialGradient(cx, by - 20, 4, cx, by - 20, 90);
  glow.addColorStop(0, 'rgba(255,150,50,.55)'); glow.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w / k, h / k);
  const card = (x, y, a, label, red) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#d9c6a3'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-24, -34, 48, 68, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = red ? '#c3202d' : '#1d1a17'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, -19, -12);
    ctx.restore();
  };
  card(cx - 18, by - 44, -0.18, '7♥︎', true);
  card(cx + 18, by - 50, 0.16, '7♠︎', false);
  ctx.fillStyle = '#2c1812'; ctx.beginPath(); ctx.ellipse(cx, by, 70, 13, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#1e0f0b'; ctx.beginPath(); ctx.ellipse(cx, by, 70, 7, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(255,${120 + i * 12},40,.9)`; ctx.beginPath(); ctx.arc(cx - 56 + i * 14, by + Math.sin(i) * 2, 3.5, 0, Math.PI * 2); ctx.fill(); }
}

// Friends' tables.
let room, roomActive = false, roomInviting = false;
let roomSeat = null, roomSeats = [], roomGame = 0, roomSeed = 0, roomMoves = 0, roomVotes = [];
let roomLagTimer = 0, roomLag = false, shareCopied = false;

function friendCard() {
  $('friendName').value = save.name;
  $('joinCode').value = '';
  $('friendEntry').hidden = false;
  $('roomInvite').hidden = true;
  $('roomLinkField').hidden = true;
  show('friendCard');
}

function openRoom(code, inviting) {
  roomActive = true;
  roomInviting = inviting;
  roomSeat = null;
  roomSeats = [];
  $('friendEntry').hidden = true;
  $('roomInvite').hidden = !inviting;
  $('roomCode').textContent = code;
  $('roomLink').value = linkFor(code);
  $('roomLinkField').hidden = true;
  shareCopied = false;
  $('shareLink').textContent = t('shareLink');
  show('friendCard');
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  history.replaceState(null, '', url);
  room ??= table({
    game: 'pisti', version: 1, Socket: window.__pistiSocket ?? window.WebSocket, name: () => save.name,
    onState: receiveRoomState, onSeats: receiveRoomSeats, onMove: receiveRoomMove,
    onGame: ({ game, seed }) => receiveRoomState({ seat: roomSeat, game, seed, seats: roomSeats, log: [], again: [] }),
    onAgain: recordRoomVote, onStatus: () => { watchRoomLag(); updateRoomView(); },
  });
  room.open(code);
}

function leaveRoom() {
  if (!roomActive) return;
  roomActive = false;
  room.leave();
  $('table').classList.remove('friends');
  $('score').classList.remove('friends');
  pauseLabels();
  $('again').disabled = false;
  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

function receiveRoomState(state) {
  roomSeat = state.seat;
  roomGame = state.game;
  roomSeed = state.seed;
  roomMoves = state.log.length;
  roomVotes = state.again.slice();
  let s = deal(state.seed, state.seed % 2);
  for (const [seat, ...cards] of state.log) s = tableMove(s, seat, cards);
  token++;
  busy = false;
  press = null;
  anim.burst = 0;
  scoreView = null;
  $('shout').classList.remove('on');
  g = { mode: 'table', seed: state.seed, seat: state.seat, s, hints: save.hands < 3 };
  receiveRoomSeats(state.seats);
  watchRoomLag();
  if (s.done) finishRoomHand();
}

function receiveRoomSeats(seats) {
  roomSeats = seats;
  if (screen === 'friendCard' && roomSeat !== null) $('roomInvite').hidden = !!seats[1 - roomSeat];
  if ((screen === 'friendCard' || (screen === 'score' && !g.s.done)) && seats.every(Boolean)) {
    $('roomInvite').hidden = true;
    $('table').classList.add('on', 'friends');
    $('score').classList.add('friends');
    pauseLabels();
    show(null);
    layout();
  }
  updateRoomView();
  if (screen === 'play' || screen === 'paused') render();
}

function receiveRoomMove(seat, cards, index) {
  roomMoves = index + 1;
  watchRoomLag();
  const s = tableMove(g.s, seat, cards);
  if (s === g.s) {
    updateRoomView();
    return;
  }
  g.s = s;
  snd.noise(0.05, 0.1, 2600);
  const { kind } = s.log.at(-1);
  if (kind === 'pisti' || kind === 'double') celebratePisti(kind);
  render();
  if (s.done) finishRoomHand();
}

function finishRoomHand() {
  paused = false;
  snd.release();
  showScore(score(g.s), true, token);
}

function watchRoomLag() {
  if (!room.waiting) {
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
  switch (room.status) {
    case 'connecting': return t(roomInviting ? 'waitingFriend' : 'connecting');
    case 'waiting': return t('reconnecting');
    case 'full': return t('full');
    case 'version': return t('version');
    case 'closed': return t('closed');
    case 'live': {
      const friend = roomSeats[1 - roomSeat];
      if (!friend) return t('waitingFriend');
      const messages = [];
      if (!friend.on) messages.push(t('dropped', { name: friend.n }));
      if (roomLag) messages.push(t('sending'));
      return messages.join(' ');
    }
    default: return '';
  }
}

function updateRoomNotice() {
  const message = roomActive ? roomMessage() : '';
  for (const [id, visible] of [['lobbyStatus', screen === 'friendCard'], ['roomStatus', screen === 'play'], ['roomEndStatus', screen === 'score']]) {
    const el = $(id);
    if (visible && el.textContent !== message) el.textContent = message;
    el.hidden = !visible || !message;
  }
}

function updateRoomView() {
  updateRoomNotice();
  if (!roomActive || !roomSeats.every(Boolean) || roomSeat === null) return;
  for (const [id, seat] of [['myPlayer', roomSeat], ['oppPlayer', 1 - roomSeat]]) {
    const el = $(id), player = roomSeats[seat];
    const connected = player.on && (seat !== roomSeat || room.status === 'live');
    el.querySelector('.seat-light').classList.toggle('on', connected);
    el.querySelector('.seat-name').textContent = player.n;
    el.setAttribute('aria-label', t(connected ? 'seatOn' : 'seatOff', { name: player.n }));
  }
  $('hand').classList.toggle('wait', !canPlay());
  if (screen !== 'score') return;
  const friend = roomSeats[1 - roomSeat].n, voted = roomVotes.includes(roomSeat);
  $('matchLine').textContent = voted ? t('waitingFor', { name: friend }) : roomVotes.includes(1 - roomSeat) ? t('wantsAnother', { name: friend }) : '';
  $('again').disabled = !g.scored || voted || room.status !== 'live';
}

function recordRoomVote(seat) {
  if (!roomVotes.includes(seat)) roomVotes.push(seat);
  if (screen === 'score') updateRoomView();
}

// Menu.
function menu() {
  leaveRoom();
  token++;
  paused = false; busy = false;
  snd.release();
  g = null;
  scoreView = null;
  $('table').classList.remove('on');
  $('practice').style.display = 'none';
  show('menu');
  $('levelDots').innerHTML = LEVELS.map((_, i) => `<i class="${i <= save.level ? 'on' : ''}"></i>`).join('');
  for (const b of $('length').children) b.classList.toggle('on', b.dataset.len === save.len);
  menuText();
  requestAnimationFrame(hero);
}
function menuText() {
  $('levelDots').setAttribute('aria-label', t('botStrength', { level: t(LEVELS[save.level]) }));
  const d = save.daily[today], date = dateLabel(today);
  $('todayNote').textContent = d?.done ? t('todayPlayed', { date, margin: fmt(d.margin) }) : d ? t('todayStarted', { date }) : t('todaySame', { date });
}
$('play').addEventListener('click', () => { snd.unlock(); newGame('play'); });
$('today').addEventListener('click', () => { snd.unlock(); newGame('daily'); });
$('two').addEventListener('click', () => { snd.unlock(); newGame('two'); });
$('friend').onclick = friendCard;
$('friendName').oninput = e => {
  save.name = e.target.value.slice(0, 24);
  writeJson(KEY, save);
};
$('newTable').onclick = () => { snd.unlock(); openRoom(newCode(), true); };
$('joinForm').onsubmit = e => {
  e.preventDefault();
  const code = cleanCode($('joinCode').value);
  if (code) { snd.unlock(); openRoom(code, false); }
};
$('shareLink').onclick = async () => {
  const code = room.code;
  const result = await share(code, t('shareText'));
  if (!roomActive || room.code !== code) return;
  if (result === 'copied') { shareCopied = true; $('shareLink').textContent = t('linkCopied'); }
  if (result === 'shown') {
    $('roomLinkField').hidden = false;
    $('roomLink').select();
  }
};
$('roomLeave').onclick = menu;
$('length').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; save.len = b.dataset.len; store(); menu(); });
$('pause').addEventListener('click', () => pause());
$('resume').addEventListener('click', () => resume());
$('quit').addEventListener('click', () => menu());
$('scoreMenu').addEventListener('click', () => menu());
$('again').addEventListener('click', () => {
  if (!g?.scored) return;
  if (g.mode === 'table') {
    if (!$('again').disabled && room.again()) recordRoomVote(g.seat);
    return;
  }
  g.scored = false;
  if (g.match && !g.matchOver) { g.handNo++; g.dealer = 1 - g.dealer; startHand(); return; }
  if (g.match) { newGame('play'); return; }
  newGame(g.mode);
});
$('reveal').addEventListener('click', () => { if (g) g.covered = false; show(null); render(); });
$('savePic').addEventListener('click', () => { savePicture().catch(() => {}); });
const setSound = () => { $('sound').textContent = t(save.sound ? 'soundOn' : 'soundOff'); };
const setFour = () => { $('colours').textContent = t(save.four ? 'coloursOn' : 'coloursOff'); document.body.classList.toggle('four', !!save.four); };
$('sound').addEventListener('click', () => { save.sound = !save.sound; store(); setSound(); });
$('colours').addEventListener('click', () => { save.four = !save.four; store(); setFour(); });
setSound(); setFour();
addEventListener('keydown', e => {
  if (isPauseKey(e) && g && !g.s.done) { e.preventDefault(); if (screen === 'paused') resume(); else if (screen === 'play') pause(); }
});
onLeave(() => { if (g?.mode !== 'table') pause(); });
addEventListener('resize', () => {
  if (g && $('table').classList.contains('on')) { layout(); render(); }
  else if (screen === 'menu') hero();
});

hint($('hand'), {
  kind: 'tap', key: 'pisti:hint', look: 'hand', delay: 4000,
  when: () => !!g && g.mode !== 'table' && canPlay(),
  played: save.hands > 0,
  label: t('hint'),
  bottom: () => (L.ch || 108) / 2 + 14,
});

function pauseLabels() {
  const friends = $('table').classList.contains('friends');
  $('pause').setAttribute('aria-label', t(friends ? 'tableMenu' : 'pause'));
  $('pauseTitle').textContent = t(friends ? 'tableMenu' : 'paused');
}

// Every word on the page again, in the language now in use: static text, open cards, labels of cards already drawn.
function relang() {
  document.title = t('title');
  apply();
  for (const id of ['langMenu', 'langPause']) $(id).lang = lang() === 'en' ? 'tr' : 'en';
  pauseLabels(); setSound(); setFour(); menuText();
  for (const el of document.querySelectorAll('button.card')) if (el.cardId !== undefined) el.setAttribute('aria-label', cardName(el.cardId));
  $('shareLink').textContent = t(shareCopied ? 'linkCopied' : 'shareLink');
  const words = document.querySelector('.kit-hint .label');
  if (words) words.textContent = t('hint');
  if (g) turnText();
  paintScore();
  updateRoomView();
}
for (const id of ['langMenu', 'langPause']) {
  $(id).addEventListener('click', () => {
    setLang(lang() === 'en' ? 'tr' : 'en');
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', lang()); history.replaceState(history.state, '', url); }
    relang();
  });
}
relang();

const linkedRoom = codeFromLink();
if (linkedRoom) openRoom(linkedRoom, false);
else menu();

// Read-only state for the browser check.
window.__pisti = {
  get ready() { return true; },
  get screen() { return screen; },
  get mode() { return g?.mode ?? 'menu'; },
  get hand() { return g ? g.s.hands[bottomSeat()].slice() : []; },
  get pileTop() { return g && g.s.pile.length ? g.s.pile[g.s.pile.length - 1] : null; },
  get pileSize() { return g ? g.s.pile.length : 0; },
  get scores() { return g ? score(g.s).map(x => x.total) : [0, 0]; },
  get turn() { return g ? g.s.turn : -1; },
  get viewer() { return g ? bottomSeat() : -1; },
  get canPlay() { return canPlay(); },
  get busy() { return busy; },
  get paused() { return paused; },
  get practice() { return !!g?.practice; },
  get level() { return g?.level ?? levelName(); },
  get date() { return today; },
  get seed() { return g?.seed ?? null; },
  get done() { return !!g?.s.done; },
  get totals() { return g?.totals?.slice() ?? [0, 0]; },
  get handNo() { return g ? g.handNo : 0; },
  get dealer() { return g ? g.s.dealer : -1; },
  get matchOver() { return !!g?.matchOver; },
  get scored() { return !!g?.scored; },
  get ply() { return g ? g.s.ply : 0; },
  get log() { return g ? g.s.log.map(e => ({ seat: e.seat, card: e.card, capture: e.capture, kind: e.kind })) : []; },
  get captures() { return g ? g.captures.slice() : []; },
  get pile() { return g?.s.pile.slice(g.s.hidden) ?? []; },
  get room() {
    return roomActive ? { code: room.code, status: room.status, waiting: room.waiting, seat: roomSeat,
      game: roomGame, seed: roomSeed, moves: roomMoves } : null;
  },
  get save() { return JSON.parse(JSON.stringify(save)); },
  get layout() { return { ...L }; },
  picture() { const c = picture(); return new Promise(done => c.toBlob(b => done({ width: c.width, height: c.height, bytes: b ? b.size : 0 }), 'image/png')); },
  totalPlies,
};
