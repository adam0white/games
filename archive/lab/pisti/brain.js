// The bot. Pure: a choice depends only on the public view (sim.view), the level and the deal seed,
// so the same plays always get the same replies. It never sees the other hand or the stock order.
import { mulberry32, rank, isJack, points, JACK, totalPlies } from './sim.js';

export const LEVELS = ['easy', 'medium', 'hard'];
const CARD = 0.2;
const value = cards => cards.reduce((v, c) => v + points(c) + CARD, 0);
const rngFor = v => mulberry32((v.seed ^ Math.imul(v.ply + 1, 0x9e3779b1) ^ (v.seat * 0x85ebca6b)) >>> 0);

function captures(v) {
  if (!v.pileSize) return [];
  const top = v.pile[v.pile.length - 1];
  return v.hand.filter(c => rank(c) === rank(top) || (v.rules.jackCaptures && isJack(c)));
}

export function choose(v, level = 'medium') {
  if (v.hand.length === 1) return v.hand[0];
  if (level === 'easy') return easy(v);
  if (level === 'hard') return hard(v);
  return medium(v);
}

function easy(v) {
  const caps = captures(v), top = v.pile[v.pile.length - 1];
  if (caps.length) return caps.find(c => rank(c) === rank(top)) ?? caps[0];
  return v.hand[Math.floor(rngFor(v)() * v.hand.length)];
}

function knownRanks(v) {
  const n = new Array(14).fill(0);
  for (const c of v.seen) n[rank(c)]++;
  for (const c of v.hand) n[rank(c)]++;
  return n;
}

function medium(v) {
  const top = v.pile[v.pile.length - 1], caps = captures(v);
  const match = caps.filter(c => !isJack(c) || (top !== undefined && isJack(top)));
  if (match.length) return match[0];
  const pileValue = value(v.pile) + v.hidden * 0.35;
  const endgame = v.stockLeft === 0 && v.hand.length <= 2;
  const jack = caps.find(isJack);
  if (jack && (v.pileSize >= 4 || pileValue >= 2 || endgame)) return jack;
  const known = knownRanks(v), r = rngFor(v);
  let best = v.hand[0], bestRisk = Infinity;
  for (const c of v.hand) {
    if (isJack(c) && v.hand.some(d => !isJack(d))) continue;
    const left = 4 - known[rank(c)];
    const risk = (v.pileSize === 0 ? left * 3 : 0) + points(c) * 2 + r() * 0.5;
    if (risk < bestRisk) { bestRisk = risk; best = c; }
  }
  return best;
}

// Hypergeometric: chance that `h` cards drawn from a pool of `u` include at least one of `m` marked cards.
function anyOf(m, u, h) {
  if (m <= 0 || h <= 0) return 0;
  if (m + h > u) return 1;
  let none = 1;
  for (let i = 0; i < h; i++) none *= (u - m - i) / (u - i);
  return 1 - none;
}

function pool(v) {
  const out = new Set([...v.seen, ...v.hand]), oppKnown = [];
  if (v.bottomDealt && v.dealer !== v.seat && !v.hand.includes(v.bottom) && !v.bottomPlayed) oppKnown.push(v.bottom);
  const unknown = [];
  for (let c = 0; c < 52; c++) if (!out.has(c)) unknown.push(c);
  return { unknown, oppKnown, h: Math.max(0, v.oppCount - oppKnown.length) };
}

// Hard: counts every card seen exactly. For each card it could play it weighs what it takes now against
// the chance the other player can take the pile next (a one-reply look-ahead over the unseen cards).
// In the last deal it searches every hand the other player could hold to the end.
function hard(v) {
  const p = pool(v);
  if (v.stockLeft === 0 && combos(p.unknown.length, p.h) <= 70) return exact(v, p);
  const top = v.pile[v.pile.length - 1], caps = captures(v);
  const hiddenValue = v.hidden * (value(p.unknown) / Math.max(1, p.unknown.length));
  const pileValue = value(v.pile) + hiddenValue;
  const u = p.unknown.length, h = p.h;
  const unknownRank = rk => p.unknown.filter(c => rank(c) === rk).length;
  const oppHasRank = rk => p.oppKnown.some(c => rank(c) === rk) ? 1 : anyOf(unknownRank(rk), u, h);
  const myJacks = v.hand.filter(isJack).length;
  const playsLeft = totalPlies - v.ply;
  const lastPly = v.ply === totalPlies - 1;
  let best = v.hand[0], bestEv = -Infinity;
  for (const c of v.hand) {
    let ev;
    if (caps.includes(c)) {
      const eligible = v.pileSize === 1 && v.ply > 0 && !lastPly && rank(c) === rank(top);
      ev = pileValue + value([c]) + (eligible ? (isJack(c) ? 20 : 10) : 0);
      if (isJack(c) && !eligible) ev -= Math.min(K.jackMax, K.jackRate * playsLeft);
      ev += K.lead;
    } else {
      const n = v.pileSize + 1, V = pileValue + value([c]);
      const loneOk = n === 1 && v.ply + 1 < totalPlies - 1;
      const pm = oppHasRank(rank(c));
      const pisti = loneOk ? (isJack(c) ? 20 : 10) : 0;
      const jackRisk = V >= 2 || n >= 4 ? oppHasRank(JACK) : 0;
      const pAny = Math.min(1, pm + (1 - pm) * (isJack(c) ? 0 : jackRisk));
      ev = -(pm * (V + pisti) + (pAny - pm) * V);
      const keep = myJacks - (isJack(c) ? 1 : 0) > 0 ? K.keepJ : K.keep;
      ev += (1 - pAny) * keep * V;
      ev -= points(c) * K.spend;
    }
    if (ev > bestEv) { bestEv = ev; best = c; }
  }
  return best;
}
const K = { jackMax: 2.5, jackRate: 0.08, lead: 0.4, keepJ: 0.45, keep: 0.15, spend: 0.3 };

function combos(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return r;
}

function* subsets(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i <= arr.length - (k - acc.length); i++) { acc.push(arr[i]); yield* subsets(arr, k, i + 1, acc); acc.pop(); }
}

// Exact search to the end of the hand for each possible other hand, averaged. Scores are the change in
// (my points - their points) from here, with the majority bonus from the known capture counts.
function exact(v, p) {
  const hands = [...subsets(p.unknown, p.h)].map(rest => [...p.oppKnown, ...rest]);
  const hv = value(p.unknown) / Math.max(1, p.unknown.length) - CARD;
  const totals = v.hand.map(() => 0);
  const top = v.pile.length ? rank(v.pile[v.pile.length - 1]) : 0;
  const pts0 = v.pile.reduce((s, d) => s + points(d), 0) + v.hidden * hv;
  const last = v.last === v.seat ? 0 : v.last === -1 ? -1 : 1, dz = v.dealer === v.seat ? 0 : 1;
  for (const opp of hands) {
    const ctx = { me: v.hand, opp, jc: v.rules.jackCaptures, dz };
    const full = (1 << v.hand.length) - 1, oFull = (1 << opp.length) - 1;
    v.hand.forEach((c, i) => {
      totals[i] += move(ctx, full & ~(1 << i), oFull, top, v.pileSize, pts0, last, v.myCards, v.oppCards, v.ply, 0, c, -Infinity, Infinity);
    });
  }
  let best = 0;
  for (let i = 1; i < v.hand.length; i++) if (totals[i] > totals[best]) best = i;
  return v.hand[best];
}

// Side `who` (0 me, 1 them) plays card c; then alpha-beta to the end. Returns my advantage gained from here.
function move(ctx, mm, om, top, n, pts, last, mc, oc, ply, who, c, alpha, beta) {
  let gain = 0;
  const r = rank(c);
  if (n && (r === top || (ctx.jc && r === JACK))) {
    const eligible = n === 1 && ply > 0 && ply < totalPlies - 1 && r === top;
    gain = pts + points(c) + (eligible ? (r === JACK ? 20 : 10) : 0);
    if (who === 0) mc += n + 1; else oc += n + 1;
    top = 0; n = 0; pts = 0; last = who;
  } else { top = r; n++; pts += points(c); }
  if (who === 1) gain = -gain;
  ply++;
  if (!mm && !om) {
    if (n) {
      const to = last === -1 ? ctx.dz : last;
      gain += to === 0 ? pts : -pts;
      if (to === 0) mc += n; else oc += n;
    }
    return gain + (mc > oc ? 3 : mc < oc ? -3 : 0);
  }
  const mover = 1 - who, hand = mover === 0 ? ctx.me : ctx.opp, mask = mover === 0 ? mm : om;
  let best = mover === 0 ? -Infinity : Infinity;
  for (let i = 0; i < hand.length; i++) {
    if (!(mask & (1 << i))) continue;
    const res = mover === 0
      ? move(ctx, mm & ~(1 << i), om, top, n, pts, last, mc, oc, ply, 0, hand[i], alpha - gain, beta - gain)
      : move(ctx, mm, om & ~(1 << i), top, n, pts, last, mc, oc, ply, 1, hand[i], alpha - gain, beta - gain);
    if (mover === 0) { if (res > best) best = res; if (best + gain > alpha) alpha = best + gain; }
    else { if (res < best) best = res; if (best + gain < beta) beta = best + gain; }
    if (alpha >= beta) break;
  }
  return gain + best;
}
