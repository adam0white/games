// Thumb Duel: the rules. Pure: runs in the page and in Node (bots.mjs). Seeded RNG, fixed 60 Hz step, no clocks.
//
// The board is 1 wide and 2 tall: x from 0 (left, as the bottom player sees it) to 1, y from -1 (top edge) to 1
// (bottom edge). Side 0 sits at the bottom (y > 0), side 1 at the top (y < 0). Side 1 sees the board turned
// half round, so a point (x, y) in side 0's own frame is (1 - x, -y) for side 1: see `mirror`.
//
// Every tick takes one input per side: { held, taps: [{ x, y }], px, py }. held: a finger of that side is down.
// taps: fingers that went down since the last tick, in board coordinates. px, py: where that side's newest finger
// is (null when none). Gesture duels also receive heldFor (seconds) and completed releases with start and end coordinates.
// Both sides' inputs for a tick are resolved together; same-tick ties have a rule in each duel.
export const DT = 1 / 60;
export const KINDS = ['tug', 'draw', 'sumo', 'catch', 'hockey', 'memory', 'balance', 'swipe', 'launch'];
export const CONTROL = { tug: 'tap', draw: 'tap', sumo: 'hold', catch: 'tap', hockey: 'drag', memory: 'tap', balance: 'hold', swipe: 'swipe', launch: 'release' };
export const WIN = 3; // first to 3 duels: best of 5
export const INTRO = 3, RESULT = 1.6, MAX_DUELS = 12;

// One deliberate rule break for `node bots.mjs --mutate` (see bots.mjs): never set by the page.
let MUT = null;
export const mutate = name => { MUT = name; };
// The three functions that may differ in the last bit between JavaScript engines. One phone and the bots use Math, as
// before; two phones playing one duel by link both switch to the kit's sameMath (kit/samemath.js), so an iPhone and an
// Android phone compute every tick alike. Everything else in this file is exact arithmetic or integer work.
let M = Math;
export const useMath = m => { M = m && typeof m.exp === 'function' ? m : Math; };

export function rand(box) { // mulberry32 on a { r } state box
  let t = (box.r = (box.r + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const shuffle = (a, box) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(box) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mirror = (side, x, y) => side === 0 ? [x, y] : [1 - x, -y];
export const blank = () => ({ held: false, taps: [], px: null, py: null, heldFor: 0, releases: [] });
const sideOfY = y => y > 0.04 ? 0 : y < -0.04 ? 1 : -1;

// ---------------------------------------------------------------- the match
// options: seed; only (every duel is that kind); first (the first duel's kind; the page uses 'tug' for a first-ever match,
// so the tap hint never meets quick draw, where an early tap loses); intro and result (seconds, shortened only by tests).
// kinds: the deck to deal from (by default every kind; a match by link leaves out the duels a network delay spoils).
export function createMatch({ seed = 1, only = null, first = null, intro = INTRO, result = RESULT, kinds = null } = {}) {
  const deck = Array.isArray(kinds) && kinds.some(k => KINDS.includes(k)) ? KINDS.filter(k => kinds.includes(k)) : null;
  const s = { seed, box: { r: (seed >>> 0) || 1 }, score: [0, 0], duels: [], pool: [], kind: null, d: null, phase: 'intro', timer: intro,
    t: 0, over: false, winner: -1, events: [], intro, result, only: KINDS.includes(only) ? only : null, first: KINDS.includes(first) && (!deck || deck.includes(first)) ? first : null, kinds: deck };
  nextKind(s);
  return s;
}
function nextKind(s) {
  if (s.only) s.kind = s.only;
  else {
    if (!s.pool.length) {
      const p = shuffle((s.kinds ?? KINDS).slice(), s.box);
      if (!s.duels.length && s.first) { p.splice(p.indexOf(s.first), 1); p.unshift(s.first); }
      if (p[0] === s.kind) p.push(p.shift()); // a fresh deck never repeats the duel just played
      s.pool = p;
    }
    s.kind = s.pool.shift();
  }
  s.phase = 'intro'; s.timer = s.intro; s.d = null;
}
export function step(s, inputs) {
  s.t += DT;
  if (s.over) return;
  if (s.phase === 'intro') {
    s.timer -= DT;
    if (s.timer <= 1e-9) {
      s.phase = 'play';
      s.d = DUELS[s.kind].init({ r: Math.floor(rand(s.box) * 4294967296) >>> 0 || 7 });
      s.d.t = 0;
      s.events.push({ e: 'go', kind: s.kind });
    }
    return;
  }
  if (s.phase === 'play') {
    const d = s.d; d.t += DT;
    const w = DUELS[s.kind].step(d, inputs, s.events);
    if (w !== null) {
      s.duels.push({ kind: s.kind, winner: w, t: Math.round(d.t * 100) / 100 });
      if (w >= 0) s.score[w]++;
      s.events.push({ e: 'point', winner: w, kind: s.kind, t: d.t });
      s.phase = 'result'; s.timer = s.result; d.winner = w;
    }
    return;
  }
  if (s.phase === 'result') {
    s.timer -= DT;
    if (s.timer <= 1e-9) {
      if (s.score[0] >= WIN || s.score[1] >= WIN || s.duels.length >= MAX_DUELS) {
        s.over = true; s.phase = 'over';
        s.winner = s.score[0] > s.score[1] ? 0 : s.score[1] > s.score[0] ? 1 : -1;
        s.events.push({ e: 'over', winner: s.winner });
      } else nextKind(s);
    }
  }
}

// ---------------------------------------------------------------- the duels
// Each is { limit, init(box), step(d, [in0, in1], events) -> winner (0, 1), -1 for a draw, or null while it runs }.

// Tug of war: every tap pulls the rope toward the tapper. The ribbon reaching your mark wins; at the time limit the
// side the ribbon is on wins. p > 0: toward the bottom.
export const TUG = { pull: 0.07, drag: 2.2, mark: 1, limit: 15 };
const tug = {
  limit: TUG.limit,
  init: box => ({ box, p: 0, v: 0, taps: [0, 0], jerk: [0, 0] }),
  step(d, inp, ev) {
    for (const side of [0, 1]) for (let i = 0; i < inp[side].taps.length; i++) {
      const dir = side === 0 || MUT === 'tug' ? 1 : -1;
      d.v += TUG.pull * dir; d.taps[side]++; d.jerk[side] = 1; ev.push({ e: 'pull', side });
    }
    d.jerk = d.jerk.map(j => Math.max(0, j - DT * 6));
    d.v *= M.exp(-TUG.drag * DT); d.p += d.v * DT;
    if (d.p >= TUG.mark) return 0;
    if (d.p <= -TUG.mark) return 1;
    if (d.t >= TUG.limit) return Math.abs(d.p) < 0.02 ? -1 : d.p > 0 ? 0 : 1;
    return null;
  },
};

// Quick draw: the lantern lights after a random wait; the first tap after it wins the flash; a tap before it loses it.
// Both early on the same tick, or both on time on the same tick, or nobody within 2.5 s: the flash is void.
// First to 2 flashes; after 5 flashes or 20 s the side with more wins, or it is a draw.
export const DRAW = { wait: [1.4, 3.6], late: 2.5, gap: 1.2, need: 2, max: 5, limit: 20 };
const drawWait = box => DRAW.wait[0] + rand(box) * (DRAW.wait[1] - DRAW.wait[0]);
const quick = {
  limit: DRAW.limit,
  init: box => ({ box, st: 'wait', timer: drawWait(box), lit: 0, wins: [0, 0], flashes: 0, last: null }),
  step(d, inp, ev) {
    if (d.t >= DRAW.limit) return d.wins[0] > d.wins[1] ? 0 : d.wins[1] > d.wins[0] ? 1 : -1;
    const tapped = [inp[0].taps.length > 0, inp[1].taps.length > 0];
    const settle = (winner, why) => {
      d.flashes++; if (winner >= 0) d.wins[winner]++;
      d.last = { winner, why, ms: Math.round(d.lit * 1000) };
      ev.push({ e: why, side: winner, ms: d.last.ms });
      d.st = 'gap'; d.timer = DRAW.gap;
    };
    if (d.st === 'wait') {
      d.timer -= DT;
      if (tapped[0] && tapped[1]) settle(-1, 'early-both');
      else if (tapped[0] || tapped[1]) settle(tapped[0] ? 1 : 0, 'early'); // the one who did NOT tap gets the flash
      else if (d.timer <= 0) { d.st = 'lit'; d.lit = 0; ev.push({ e: 'lit' }); }
    } else if (d.st === 'lit') {
      d.lit += DT;
      if (tapped[0] && tapped[1]) settle(-1, 'tie');
      else if (tapped[0] || tapped[1]) settle(tapped[0] ? 0 : 1, 'shot');
      else if (d.lit >= DRAW.late) settle(-1, 'void');
    } else if (d.st === 'gap') {
      d.timer -= DT;
      if (d.timer <= 0) {
        if (d.wins[0] >= DRAW.need) return 0;
        if (d.wins[1] >= DRAW.need) return 1;
        if (d.flashes >= DRAW.max) return d.wins[0] > d.wins[1] ? 0 : d.wins[1] > d.wins[0] ? 1 : -1;
        d.st = 'wait'; d.timer = drawWait(d.box); d.last = null;
      }
    }
    return null;
  },
};

// Sumo beetles: two beetles meet at c (board y). Holding pushes with a force that fades as stamina drains; letting go
// rests. Pressing starts a shove: three times the force for a moment. A shove into a beetle that is not holding (it
// dodged) misses: the shover stumbles back and is dazed. A beetle pushed past the ring's edge loses; at the time limit
// the side the contact point is on loses.
export const SUMO = { push: 1, shove: 2.6, shoveT: 0.3, cost: 0.12, drain: 0.32, rest: 0.55, k: 0.3, stun: 0.7, stumble: 0.1, edge: 0.85, limit: 15 };
const sumo = {
  limit: SUMO.limit,
  init: box => ({ box, c: 0, held: [false, false], stam: [1, 1], shove: [0, 0], stun: [0, 0], f: [0, 0], whiffs: [0, 0] }),
  step(d, inp, ev) {
    const was = d.held.slice(), now = [inp[0].held, inp[1].held];
    // Presses are judged against what the other beetle was doing at the start of this tick, for both at once.
    const start = [0, 1].map(i => now[i] && !was[i] && d.stun[i] <= 0);
    for (const i of [0, 1]) {
      if (!start[i]) continue;
      const o = 1 - i;
      if (!was[o] && !start[o] && d.stun[o] <= 0) { // dodged: the shove meets air (a dazed beetle cannot dodge)
        d.stun[i] = SUMO.stun; d.whiffs[i]++; d.c += (i === 0 ? 1 : -1) * SUMO.stumble; ev.push({ e: 'whiff', side: i });
      } else { d.shove[i] = SUMO.shoveT; d.stam[i] = Math.max(0, d.stam[i] - SUMO.cost); ev.push({ e: 'shove', side: i }); }
    }
    for (const i of [0, 1]) {
      d.held[i] = now[i];
      if (d.stun[i] > 0) { d.stun[i] -= DT; d.f[i] = 0; d.shove[i] = 0; continue; }
      if (now[i]) {
        d.f[i] = (d.shove[i] > 0 ? SUMO.shove : SUMO.push) * (0.3 + 0.7 * d.stam[i]);
        d.stam[i] = Math.max(0, d.stam[i] - SUMO.drain * DT);
      } else { d.f[i] = 0; d.stam[i] = Math.min(1, d.stam[i] + SUMO.rest * DT); }
      d.shove[i] = Math.max(0, d.shove[i] - DT);
    }
    d.c -= (d.f[0] - d.f[1]) * SUMO.k * DT; // side 0 pushes toward the top edge (-1)
    if (d.c <= -SUMO.edge) return 0;
    if (d.c >= SUMO.edge) return 1;
    if (d.t >= SUMO.limit) return Math.abs(d.c) < 0.03 ? -1 : d.c < 0 ? 0 : 1;
    return null;
  },
};

// Catch: a firefly hovers on one side, then crosses the middle (or feints toward it and turns back). A tap while it
// is on your side catches it; a tap while it is not leaves you dazed for a moment. Catches alternate sides: a caught
// firefly comes back on the other side. First to 5; at the limit, more catches wins.
export const CATCH = { need: 5, cross: 0.3, feint: 0.28, dwell: [0.5, 0.55], feintP: 0.25, stun: 0.7, hide: 0.6, limit: 20 };
const flyTo = (d, x, y, dur, then) => { d.mode = 'move'; d.from = [d.x, d.y]; d.to = [x, y]; d.mt = 0; d.md = dur; d.then = then; };
const dwellSpot = (d, side) => { const y = 0.3 + rand(d.box) * 0.3; return [0.2 + rand(d.box) * 0.6, side === 0 ? y : -y]; };
const dwellTime = d => (CATCH.dwell[0] + rand(d.box) * CATCH.dwell[1]) * Math.max(0.65, 1 - 0.06 * (d.caught[0] + d.caught[1]));
const catcher = {
  limit: CATCH.limit,
  init(box) {
    const d = { box, x: 0.5, y: 0, mode: 'move', from: null, to: null, mt: 0, md: 0, then: null, timer: 0, caught: [0, 0], stun: [0, 0], next: 0, feints: 0, lastFeint: false };
    d.next = rand(box) < 0.5 ? 0 : 1;
    const [x, y] = dwellSpot(d, d.next); flyTo(d, x, y, 0.6, 'dwell');
    return d;
  },
  step(d, inp, ev) {
    // the firefly moves
    if (d.mode === 'move') {
      d.mt += DT; const u = Math.min(1, d.mt / d.md), e = u * u * (3 - 2 * u);
      d.x = d.from[0] + (d.to[0] - d.from[0]) * e; d.y = d.from[1] + (d.to[1] - d.from[1]) * e;
      if (u >= 1) {
        if (d.then === 'back') { const back = d.back; flyTo(d, back[0], back[1], CATCH.feint, 'dwell'); }
        else { d.mode = 'dwell'; d.timer = dwellTime(d) * (d.then === 'short' ? 0.6 : 1); }
      }
    } else if (d.mode === 'dwell') {
      d.timer -= DT;
      if (d.timer <= 0) {
        const here = sideOfY(d.y), sign = here === 0 ? 1 : -1;
        if (!d.lastFeint && rand(d.box) < CATCH.feintP) { d.lastFeint = true; d.feints++; d.back = [d.x, d.y]; flyTo(d, d.x, sign * 0.07, CATCH.feint, 'back'); }
        else { d.lastFeint = false; const [x, y] = dwellSpot(d, 1 - here); flyTo(d, x, y, CATCH.cross, 'dwell'); }
      }
    } else if (d.mode === 'hidden') {
      d.timer -= DT;
      if (d.timer <= 0) { const [x, y] = dwellSpot(d, d.next); d.x = x; d.y = y; d.mode = 'dwell'; d.timer = dwellTime(d); ev.push({ e: 'appear', side: d.next }); }
    }
    // the taps, both sides at once
    const on = d.mode === 'hidden' ? -1 : sideOfY(d.y);
    const tries = [0, 1].map(i => inp[i].taps.length > 0 && d.stun[i] <= 0);
    for (const i of [0, 1]) d.stun[i] = Math.max(0, d.stun[i] - DT);
    for (const i of [0, 1]) {
      if (!tries[i]) continue;
      if (on === i) { d.caught[i]++; d.mode = 'hidden'; d.timer = CATCH.hide; d.next = 1 - i; ev.push({ e: 'catch', side: i, x: d.x, y: d.y }); }
      else { d.stun[i] = CATCH.stun; ev.push({ e: 'miss', side: i }); }
    }
    if (d.caught[0] >= CATCH.need) return 0;
    if (d.caught[1] >= CATCH.need) return 1;
    if (d.t >= CATCH.limit) return d.caught[0] > d.caught[1] ? 0 : d.caught[1] > d.caught[0] ? 1 : -1;
    return null;
  },
};

// Air hockey with a seed: each side drags its own paddle inside its own half. Goals are the gaps at each end.
// First to 3 goals; at the limit, more goals wins.
export const HOCKEY = { puck: 0.05, pad: 0.09, goal: 0.35, padSpeed: 7, max: 3.2, e: 0.9, fric: 0.35, serve: 0.6, wait: 0.8, need: 3, limit: 20, slow: 0.25, bowl: 0.5 };
const resetPuck = (d, toward) => { d.puck = { x: 0.5, y: toward === 0 ? 0.12 : -0.12, vx: 0, vy: 0 }; d.wait = HOCKEY.wait; d.serve = toward; };
const hockey = {
  limit: HOCKEY.limit,
  init(box) {
    const d = { box, pads: [{ x: 0.5, y: 0.78, vx: 0, vy: 0 }, { x: 0.5, y: -0.78, vx: 0, vy: 0 }], goals: [0, 0], wait: 0, serve: 0, hits: [0, 0] };
    resetPuck(d, rand(box) < 0.5 ? 0 : 1);
    return d;
  },
  step(d, inp, ev) {
    const H = HOCKEY, r = H.pad;
    for (const i of [0, 1]) {
      const p = d.pads[i], ip = inp[i];
      let tx = p.x, ty = p.y;
      if (ip.px !== null && ip.py !== null) { tx = ip.px; ty = ip.py; }
      tx = clamp(tx, r, 1 - r);
      ty = i === 0 ? clamp(ty, r * 0.6, 1 - r) : clamp(ty, -1 + r, -r * 0.6); // never past the middle
      const dx = tx - p.x, dy = ty - p.y, dist = M.hypot(dx, dy), maxStep = H.padSpeed * DT;
      const k = dist > maxStep ? maxStep / dist : 1;
      p.vx = dx * k / DT; p.vy = dy * k / DT; p.x += dx * k; p.y += dy * k;
    }
    if (d.wait > 0) {
      d.wait -= DT;
      if (d.wait <= 0) { d.puck.vy = d.serve === 0 ? H.serve : -H.serve; d.puck.vx = (rand(d.box) - 0.5) * 0.5; }
    }
    const pk = d.puck, N = 4, h = DT / N;
    for (let n = 0; n < N; n++) {
      pk.x += pk.vx * h; pk.y += pk.vy * h;
      if (pk.x < H.puck) { pk.x = H.puck; pk.vx = Math.abs(pk.vx) * H.e; ev.push({ e: 'wall' }); }
      if (pk.x > 1 - H.puck) { pk.x = 1 - H.puck; pk.vx = -Math.abs(pk.vx) * H.e; ev.push({ e: 'wall' }); }
      const inMouth = Math.abs(pk.x - 0.5) < H.goal;
      if (Math.abs(pk.y) > 1 - H.puck && !inMouth) { pk.y = Math.sign(pk.y) * (1 - H.puck); pk.vy = -pk.vy * H.e; ev.push({ e: 'wall' }); }
      if (pk.y < -1 - H.puck) { d.goals[0]++; ev.push({ e: 'goal', side: 0 }); resetPuck(d, 1); break; }
      if (pk.y > 1 + H.puck) { d.goals[1]++; ev.push({ e: 'goal', side: 1 }); resetPuck(d, 0); break; }
      for (const i of [0, 1]) {
        const p = d.pads[i], dx = pk.x - p.x, dy = pk.y - p.y, dist = M.hypot(dx, dy), min = H.pad + H.puck;
        if (dist < min && dist > 1e-6) {
          const nx = dx / dist, ny = dy / dist;
          pk.x = p.x + nx * min; pk.y = p.y + ny * min;
          const rv = (pk.vx - p.vx) * nx + (pk.vy - p.vy) * ny;
          if (rv < 0) { pk.vx -= (1 + H.e) * rv * nx; pk.vy -= (1 + H.e) * rv * ny; d.hits[i]++; ev.push({ e: 'hit', side: i, power: Math.min(1, -rv / 3) }); }
        }
      }
      const sp = M.hypot(pk.vx, pk.vy);
      if (sp > H.max) { pk.vx *= H.max / sp; pk.vy *= H.max / sp; }
    }
    const f = M.exp(-H.fric * DT); pk.vx *= f; pk.vy *= f;
    // A slow seed slides back toward the middle (the table is gently bowled), so it never rests out of one side's reach.
    if (d.wait <= 0 && M.hypot(pk.vx, pk.vy) < H.slow) pk.vy -= Math.sign(pk.y) * H.bowl * DT;
    if (d.goals[0] >= H.need) return 0;
    if (d.goals[1] >= H.need) return 1;
    if (d.t >= H.limit) return d.goals[0] > d.goals[1] ? 0 : d.goals[1] > d.goals[0] ? 1 : -1;
    return null;
  },
};

// Memory flash: four pads on each side light up in a sequence, the same on both sides (mirrored). Then each player
// taps it back on their own pads. First to finish wins the round; a wrong pad puts you out of the round; finishing on
// the same tick, both out, or nobody in 6 s makes it void. Rounds of 3, 4, 5, 5 lights; first to 2 rounds; at 20 s more
// rounds wins.
export const PADS = [{ x: 0.29, y: 0.36 }, { x: 0.71, y: 0.36 }, { x: 0.29, y: 0.72 }, { x: 0.71, y: 0.72 }];
export const MEMORY = { r: 0.17, on: 0.42, off: 0.14, answer: 6, gap: 1.1, lens: [3, 4, 5, 5], need: 2, limit: 20 };
export function padAt(side, x, y) {
  const [lx, ly] = mirror(side, x, y);
  let best = -1, bd = MEMORY.r * 1.15;
  PADS.forEach((p, i) => { const dd = M.hypot(lx - p.x, ly - p.y); if (dd < bd) { bd = dd; best = i; } });
  return best;
}
function newRound(d) {
  const len = MEMORY.lens[Math.min(d.round, MEMORY.lens.length - 1)], seq = [];
  for (let i = 0; i < len; i++) { let p; do p = Math.floor(rand(d.box) * 4); while (p === seq[i - 1]); seq.push(p); }
  d.seq = seq; d.st = 'show'; d.timer = 0.5; d.idx = [0, 0]; d.out = [false, false]; d.lit = -1; d.press = [null, null];
}
const memory = {
  limit: MEMORY.limit,
  init(box) { const d = { box, round: 0, wins: [0, 0], last: null }; newRound(d); d.timer = 0.6; return d; },
  step(d, inp, ev) {
    if (d.t >= MEMORY.limit) return d.wins[0] > d.wins[1] ? 0 : d.wins[1] > d.wins[0] ? 1 : -1;
    for (const i of [0, 1]) if (d.press[i]) { d.press[i].t -= DT; if (d.press[i].t <= 0) d.press[i] = null; }
    const close = winner => { if (winner >= 0) d.wins[winner]++; d.last = winner; d.st = 'gap'; d.timer = MEMORY.gap; d.round++; ev.push({ e: 'round', side: winner }); };
    if (d.st === 'show') {
      d.timer -= DT;
      const per = MEMORY.on + MEMORY.off, k = Math.floor(-d.timer / per), into = -d.timer - k * per;
      const lit = d.timer < 0 && k < d.seq.length && into < MEMORY.on ? d.seq[k] : -1;
      if (lit !== d.lit && lit >= 0) ev.push({ e: 'show', pad: lit });
      d.lit = lit;
      if (k >= d.seq.length) { d.st = 'answer'; d.timer = MEMORY.answer; d.lit = -1; ev.push({ e: 'answer' }); }
      return null;
    }
    if (d.st === 'answer') {
      d.timer -= DT;
      const done = [false, false];
      for (const i of [0, 1]) for (const tp of inp[i].taps) {
        if (d.out[i] || d.idx[i] >= d.seq.length) break;
        const pad = padAt(i, tp.x, tp.y);
        if (pad < 0) continue;
        d.press[i] = { pad, t: 0.2 };
        if (pad === d.seq[d.idx[i]]) { d.idx[i]++; ev.push({ e: 'pad', side: i, pad, ok: true }); if (d.idx[i] === d.seq.length) done[i] = true; }
        else { d.out[i] = true; ev.push({ e: 'pad', side: i, pad, ok: false }); }
      }
      if (done[0] && done[1]) close(-1);
      else if (done[0] || done[1]) close(done[0] ? 0 : 1);
      else if ((d.out[0] && d.out[1]) || d.timer <= 0) close(-1);
      return null;
    }
    // gap between rounds
    d.timer -= DT;
    if (d.timer <= 0) {
      if (d.wins[0] >= MEMORY.need) return 0;
      if (d.wins[1] >= MEMORY.need) return 1;
      if (d.round >= MEMORY.lens.length) return d.wins[0] > d.wins[1] ? 0 : d.wins[1] > d.wins[0] ? 1 : -1;
      newRound(d);
    }
    return null;
  },
};

// Balance: each side has its own dewdrop on a leaf. Holding tips the leaf so the drop rolls right (as that player sees
// it), letting go tips it left. The same wobble pushes both drops. Time with the drop near the middle scores; a drop
// that rolls off is lost for a second. At the limit, more time in the middle wins.
export const BALANCE = { tilt: 1.7, wobble: 1.05, damp: 1.3, band: 0.28, fall: 1.0, limit: 14 };
export const wobble = (d, t) => BALANCE.wobble * (0.6 * M.sin(1.3 * t + d.ph[0]) + 0.35 * M.sin(2.7 * t + d.ph[1]) + 0.45 * M.sin(0.55 * t + d.ph[2]));
const balance = {
  limit: BALANCE.limit,
  init: box => ({ box, x: [0, 0], v: [0, 0], score: [0, 0], fall: [0, 0], tilt: [0, 0], ph: [rand(box) * 6.283, rand(box) * 6.283, rand(box) * 6.283] }),
  step(d, inp, ev) {
    const w = wobble(d, d.t);
    for (const i of [0, 1]) {
      d.tilt[i] += ((inp[i].held ? 1 : -1) - d.tilt[i]) * Math.min(1, DT * 12);
      if (d.fall[i] > 0) { d.fall[i] -= DT; if (d.fall[i] <= 0) { d.x[i] = 0; d.v[i] = 0; ev.push({ e: 'back', side: i }); } continue; }
      const a = (inp[i].held ? BALANCE.tilt : -BALANCE.tilt) + w;
      d.v[i] = (d.v[i] + a * DT) * M.exp(-BALANCE.damp * DT); d.x[i] += d.v[i] * DT;
      if (Math.abs(d.x[i]) > 1) { d.fall[i] = BALANCE.fall; ev.push({ e: 'fall', side: i, dir: Math.sign(d.x[i]) }); }
      else if (Math.abs(d.x[i]) < BALANCE.band) d.score[i] += DT;
    }
    if (d.t >= BALANCE.limit) return Math.abs(d.score[0] - d.score[1]) < 0.05 ? -1 : d.score[0] > d.score[1] ? 0 : 1;
    return null;
  },
};

const compare = ([a, b]) => a > b ? 0 : b > a ? 1 : -1;

// Swipe race: flick toward the center and lift. A tap, slow drag or sideways stroke does not move the racer.
export const SWIPE = { start: 0.23, travel: 0.22, sideways: 0.22, maxTime: 0.45, gap: 0.18, need: 17, limit: 17 };
const swipe = {
  limit: SWIPE.limit,
  init: () => ({ strokes: [0, 0], last: [-Infinity, -Infinity] }),
  step(d, inp, ev) {
    for (const i of [0, 1]) {
      if (d.t - d.last[i] < SWIPE.gap) continue;
      const valid = inp[i].releases.some(({ x0, y0, x, y, seconds }) => {
        const [, from] = mirror(i, x0, y0), [, to] = mirror(i, x, y);
        return x0 >= 0 && x0 <= 1 && from >= SWIPE.start && from <= 1 && from - to >= SWIPE.travel
          && Math.abs(x - x0) <= SWIPE.sideways && seconds <= SWIPE.maxTime;
      });
      if (valid) { d.strokes[i]++; d.last[i] = d.t; ev.push({ e: 'stroke', side: i }); }
    }
    return Math.max(...d.strokes) >= SWIPE.need || d.t >= SWIPE.limit - 1e-9 ? compare(d.strokes) : null;
  },
};

// Seed launch: build charge by holding, then lift when the meter reaches the mark. Each shot has the same
// mark for both players, and a shot's score falls with distance from the mark. The higher total wins.
export const LAUNCH = { shots: 6, low: 0.95, high: 1.55, scale: 2.15, minHold: 0.15, tolerance: 0.45, limit: 16 };
const launch = {
  limit: LAUNCH.limit,
  init(box) {
    const targets = Array.from({ length: LAUNCH.shots }, () => LAUNCH.low + rand(box) * (LAUNCH.high - LAUNCH.low));
    return { targets, shots: [0, 0], scores: [0, 0], charge: [0, 0], last: [null, null] };
  },
  step(d, inp, ev) {
    for (const i of [0, 1]) {
      if (d.shots[i] >= LAUNCH.shots) { d.charge[i] = 0; continue; }
      d.charge[i] = inp[i].heldFor;
      const shot = inp[i].releases.find(release => release.seconds >= LAUNCH.minHold);
      if (!shot) continue;
      const error = Math.abs(shot.seconds - d.targets[d.shots[i]]);
      const points = Math.max(0, Math.round(100 * (1 - error / LAUNCH.tolerance)));
      d.shots[i]++; d.scores[i] += points; d.last[i] = { points, at: d.t };
      ev.push({ e: 'launch', side: i, points });
    }
    return d.shots.every(n => n >= LAUNCH.shots) || d.t >= LAUNCH.limit - 1e-9 ? compare(d.scores) : null;
  },
};

export const DUELS = { tug, draw: quick, sumo, catch: catcher, hockey, memory, balance, swipe, launch };
