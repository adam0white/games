// Firefly Ring: rules only. Pure, seeded (mulberry32), fixed step of 1/60 s, runs in Node.
// Input per step is the thread head (x, y) in field units, or NaN for no finger.
export const DT = 1 / 60, W = 360, H = 600, LX = 180, LY = 330;
export const JAR = 20, THREAD = 600, CLOSE = 34, MIN_RING = 90, SPACING = 4, TOUCH = 7, EAT = 16;
export const COHESION = 0.02, REPEL = 0.03, MAXC = 40, NONE = 0, FLY = 1, MOTH = 2, GOLD = 3;
const CAP = 512, SCARE = 120, BAT_WARN = 60;
// After a ring closes, the lantern takes the lights and the thread cannot be drawn for this many steps.
export const REKINDLE = 30, DAWN_BONUS = 3;

// One new thing per level; everything before it stays.
export const LEVELS = [
  { name: 'One colour', colors: 1, flies: 14, moths: 0, bat: false, wind: false, golden: false, jars: 5, secs: 32 },
  { name: 'Two colours', colors: 2, flies: 18, moths: 0, bat: false, wind: false, golden: false, jars: 5, secs: 32 },
  { name: 'Moths', colors: 2, flies: 18, moths: 2, bat: false, wind: false, golden: false, jars: 5, secs: 34 },
  { name: 'The bat', colors: 2, flies: 20, moths: 2, bat: true, wind: false, golden: false, jars: 5, secs: 35 },
  { name: 'Three colours', colors: 3, flies: 24, moths: 2, bat: true, wind: false, golden: false, jars: 4, secs: 36 },
  { name: 'Wind', colors: 3, flies: 24, moths: 2, bat: true, wind: true, golden: false, jars: 5, secs: 38 },
  { name: 'The golden one', colors: 3, flies: 24, moths: 3, bat: true, wind: true, golden: true, jars: 5, secs: 38 },
  { name: 'All of it', colors: 3, flies: 26, moths: 3, bat: true, wind: true, golden: true, jars: 5, secs: 40 },
];
export const NIGHT = LEVELS.length;

// Every level reads these from its definition; the defaults are the first night's constants, so levels 1 to 8, the
// endless meadow and today's meadow play exactly as before.
export const THORN = 15, SLEEP = 0.7, NOTICE = 30;
export const DEFAULTS = { thread: THREAD, speed: 0.55, cohesion: COHESION, repel: REPEL, pull: 0.005, rekindle: REKINDLE, thorns: 0, big: 0, call: false, sleep: false, shy: 0, life: 0, batGap: 420, gust: 0.05, gustEvery: 300 };
// The second and third nights: each level is the night's plain meadow plus one new idea from the same rule
// (one colour to a ring, the square of the catch). `idea` names it for the tip and for NOTES.
const N2 = { colors: 2, flies: 20, moths: 2, bat: false, wind: false, golden: false, jars: 5, secs: 36 };
const N3 = { colors: 3, flies: 24, moths: 2, bat: true, wind: false, golden: false, jars: 5, secs: 38 };
export const NIGHTS = [
  LEVELS,
  [
    { ...N2, idea: 'crowd', flies: 32, jars: 6, secs: 34 },
    { ...N2, idea: 'big', big: 4, secs: 33 },
    { ...N2, idea: 'call', call: true, secs: 32 },
    { ...N2, idea: 'short', thread: 420, secs: 34 },
    { ...N2, idea: 'quick', speed: 0.85, secs: 31 },
    { ...N2, idea: 'restless', cohesion: 0.014, jars: 4, secs: 34 },
    { ...N2, idea: 'thorns', thorns: 3, secs: 32 },
    { ...N2, idea: 'sleep', sleep: true, secs: 38 },
  ],
  [
    { ...N3, idea: 'pull', pull: 0.03, secs: 32 },
    { ...N3, idea: 'life', life: 16, jars: 4, secs: 38 },
    { ...N3, idea: 'hungry', batGap: 120, secs: 32 },
    { ...N3, idea: 'swarm', moths: 5, secs: 32 },
    { ...N3, idea: 'mingle', repel: 0.012, jars: 4, secs: 32 },
    { ...N3, idea: 'shy', shy: 0.05, secs: 32 },
    { ...N3, idea: 'slowLamp', rekindle: 72, secs: 33 },
    { ...N3, idea: 'gale', wind: true, gust: 0.11, gustEvery: 150, secs: 33 },
  ],
];

export function mulberry(a) {
  let t = (a + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rnd(s) { const v = mulberry(s.r); s.r = (s.r + 0x6D2B79F5) | 0; return v; }
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const dailySeed = date => hashString(`ring:${date}`);

// The layout of level i for a seed: which colours, where the fireflies start, wind direction, when the golden one comes.
export function levelDef(seed, i, night = 0) {
  const base = { ...DEFAULTS, ...NIGHTS[night][i] }, g = { r: hashString(night ? `${seed}:${night}:${i}` : `${seed}:${i}`) | 0 };
  const pick = [0, 1, 2];
  for (let k = 2; k > 0; k--) { const j = Math.floor(rnd(g) * (k + 1)); const t = pick[k]; pick[k] = pick[j]; pick[j] = t; }
  const colors = pick.slice(0, base.colors), pos = new Float64Array(base.flies * 2), cols = new Int8Array(base.flies);
  for (let k = 0; k < base.flies; k++) {
    pos[2 * k] = 24 + rnd(g) * (W - 48); pos[2 * k + 1] = 30 + rnd(g) * (H - 60);
    cols[k] = colors[k % colors.length];
  }
  const def = { ...base, index: i, night, colors, pos, cols, windDir: rnd(g) < 0.5 ? -1 : 1, goldenAt: Math.floor((0.2 + rnd(g) * 0.3) * base.secs * 60), batFirst: Math.floor((4 + rnd(g) * 4) * 60), thorn: new Float64Array(base.thorns * 2) };
  // Thorn bushes stand apart from each other and from the lantern.
  for (let k = 0; k < base.thorns; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 50 + rnd(g) * (W - 100), y = 80 + rnd(g) * (H - 160);
      let ok = Math.hypot(x - LX, y - LY) > 70;
      for (let m = 0; m < k && ok; m++) ok = Math.hypot(x - def.thorn[2 * m], y - def.thorn[2 * m + 1]) > 110;
      def.thorn[2 * k] = x; def.thorn[2 * k + 1] = y;
      if (ok) break;
    }
  }
  return def;
}

export function create(seed, opts = {}) {
  const s = {
    seed: seed >>> 0, r: (seed ^ 0x9E3779B9) | 0, opts: { mode: 'night', start: 0, mixedScores: false, night: 0, relight: false, fair: false, ...opts },
    phase: 'play', wait: 0, tick: 0, levelTick: 0, level: 0, round: 0, def: null,
    dawn: 0, dawnMax: 1, light: 0, target: 1, score: 0, wicks: 3, bestRing: 0,
    results: new Float64Array(NIGHT), cleared: 0, reason: '', lastBonus: 0,
    kind: new Int8Array(MAXC), col: new Int8Array(MAXC), x: new Float64Array(MAXC), y: new Float64Array(MAXC),
    vx: new Float64Array(MAXC), vy: new Float64Array(MAXC), head: new Float64Array(MAXC), scare: new Int16Array(MAXC),
    wait2: new Int16Array(MAXC), age: new Int32Array(MAXC), cool: new Int16Array(MAXC), blink: new Float64Array(MAXC), heavy: new Int8Array(MAXC), notice: new Int16Array(MAXC), bigN: 0, call: -1,
    tx: new Float64Array(CAP), ty: new Float64Array(CAP), t0: 0, t1: 0, tlen: 0, hx: NaN, hy: NaN, rekindle: 0,
    poly: new Float64Array(CAP * 2 + 4), pn: 0, ix: 0, iy: 0, cx: new Float64Array(3), cy: new Float64Array(3), cn: new Int16Array(3),
    batPhase: 0, batT: 0, batX: 0, batY: 0, batVX: 0, batVY: 0, batTarget: -1,
    gust: 0, gustT: 0, gustDir: 1, mothT: 0, goldenDone: false,
    counts: { rings: 0, pure: 0, mixed: 0, mixedPoints: 0, mothRings: 0, snaps: 0, wicksLost: 0, eaten: 0, golden: 0 },
    ev: [],
  };
  startLevel(s, Math.max(0, Math.min(NIGHT - 1, s.opts.start | 0)));
  return s;
}

function free(s) { for (let i = 0; i < MAXC; i++) if (s.kind[i] === NONE && s.wait2[i] === 0) return i; return -1; }
function spawn(s, i, kind, col, x, y) {
  s.kind[i] = kind; s.col[i] = col; s.x[i] = x; s.y[i] = y; s.vx[i] = 0; s.vy[i] = 0;
  s.notice[i] = 0;
  s.heavy[i] = kind === FLY && s.def && s.def.big ? (s.bigN++ % s.def.big === 0 ? 1 : 0) : 0;
  s.head[i] = rnd(s) * Math.PI * 2; s.scare[i] = 0; s.wait2[i] = 0; s.age[i] = 0; s.cool[i] = 0; s.blink[i] = rnd(s);
}
function edge(s, i, kind, col) {
  const side = Math.floor(rnd(s) * 4), t = rnd(s);
  const x = side === 0 ? -8 : side === 1 ? W + 8 : 20 + t * (W - 40), y = side === 2 ? -8 : side === 3 ? H + 8 : 20 + t * (H - 40);
  spawn(s, i, kind, col, x, y);
}

function startLevel(s, i) {
  const endless = s.opts.mode === 'endless';
  s.level = endless ? NIGHT - 1 : i;
  const def = s.def = levelDef(s.seed, s.level, endless ? 0 : s.opts.night);
  s.kind.fill(0); s.wait2.fill(0); s.batPhase = 0; s.gust = 0; s.goldenDone = false; s.batTarget = -1; s.bigN = 0;
  for (let k = 0; k < def.flies; k++) spawn(s, k, FLY, def.cols[k], def.pos[2 * k], def.pos[2 * k + 1]);
  // Short lives: the first fireflies are of different ages, so they do not all go out at once.
  if (def.life) for (let k = 0; k < def.flies; k++) s.age[k] = Math.floor(def.life * 60 * 0.85 * k / def.flies);
  s.call = def.call ? def.colors[Math.floor(rnd(s) * def.colors.length)] : -1;
  s.levelTick = 0; s.light = 0;
  const jars = endless ? Math.min(7, def.jars + s.round) : def.jars;
  s.target = jars * JAR;
  s.dawnMax = s.dawn = (endless ? Math.max(24, def.secs - 2 * s.round) : def.secs) * 60;
  s.batT = def.batFirst; s.gustT = def.gustEvery + Math.floor(rnd(s) * 120); s.mothT = 120;
  clearThread(s);
  s.ev.push({ type: 'level', level: s.level, round: s.round });
}

function clearThread(s) { s.t0 = 0; s.t1 = 0; s.tlen = 0; }
// The finger was taken away without lifting (a pause, a cancelled touch): the thread goes without closing a ring.
export const dropThread = clearThread;
function pushPoint(s, x, y) {
  if (s.t1 >= CAP) {
    const n = s.t1 - s.t0;
    s.tx.copyWithin(0, s.t0, s.t1); s.ty.copyWithin(0, s.t0, s.t1); s.t0 = 0; s.t1 = n;
  }
  s.tx[s.t1] = x; s.ty[s.t1] = y; s.t1++;
}
export const threadCount = s => s.t1 - s.t0;

// Segment p1-p2 against p3-p4; the crossing point goes into s.ix, s.iy.
function cross(s, x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return false;
  const u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  s.ix = x1 + u * (x2 - x1); s.iy = y1 + u * (y2 - y1);
  return true;
}
export function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l > 0 ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = x1 + t * dx - px, ey = y1 + t * dy - py;
  return Math.sqrt(ex * ex + ey * ey);
}
export function inPoly(poly, n, px, py) {
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[2 * i], yi = poly[2 * i + 1], xj = poly[2 * j], yj = poly[2 * j + 1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function input(s, hx, hy) {
  const down = hx === hx;
  s.hx = hx; s.hy = hy;
  if (!down && s.rekindle > 0) s.rekindle--;
  if (!down) {
    const n = s.t1 - s.t0;
    if (n >= 3 && s.tlen >= MIN_RING && Math.hypot(s.tx[s.t1 - 1] - s.tx[s.t0], s.ty[s.t1 - 1] - s.ty[s.t0]) < CLOSE) {
      s.pn = 0;
      for (let k = s.t0; k < s.t1; k++) { s.poly[2 * s.pn] = s.tx[k]; s.poly[2 * s.pn + 1] = s.ty[k]; s.pn++; }
      ring(s);
    }
    clearThread(s);
    return;
  }
  if (s.rekindle > 0) { s.rekindle--; clearThread(s); return; }
  if (s.t1 === s.t0) { pushPoint(s, hx, hy); return; }
  const lx = s.tx[s.t1 - 1], ly = s.ty[s.t1 - 1], d = Math.hypot(hx - lx, hy - ly);
  if (d < SPACING) return;
  // The new segment against every older one that does not share a point with it; the earliest crossing makes the largest loop.
  for (let k = s.t0; k < s.t1 - 2; k++) {
    if (cross(s, lx, ly, hx, hy, s.tx[k], s.ty[k], s.tx[k + 1], s.ty[k + 1])) {
      s.pn = 0;
      s.poly[0] = s.ix; s.poly[1] = s.iy; s.pn = 1;
      for (let m = k + 1; m < s.t1; m++) { s.poly[2 * s.pn] = s.tx[m]; s.poly[2 * s.pn + 1] = s.ty[m]; s.pn++; }
      ring(s);
      clearThread(s); pushPoint(s, hx, hy);
      return;
    }
  }
  pushPoint(s, hx, hy); s.tlen += d;
  // The thread burns from the tail: it never holds more than THREAD units.
  while (s.tlen > s.def.thread && s.t1 - s.t0 > 2) {
    s.tlen -= Math.hypot(s.tx[s.t0 + 1] - s.tx[s.t0], s.ty[s.t0 + 1] - s.ty[s.t0]);
    s.t0++;
  }
}

function ring(s) {
  if (s.pn < 3) return;
  let mask = 0, n = 0, gold = 0, moths = 0, cx = 0, cy = 0;
  for (let i = 0; i < s.pn; i++) { cx += s.poly[2 * i]; cy += s.poly[2 * i + 1]; }
  cx /= s.pn; cy /= s.pn;
  for (let i = 0; i < MAXC; i++) {
    const k = s.kind[i];
    if (k === NONE || asleep(s, i) || !inPoly(s.poly, s.pn, s.x[i], s.y[i])) continue;
    if (k === FLY) { mask |= 1 << s.col[i]; n += s.heavy[i] ? 2 : 1; } else if (k === GOLD) gold++; else moths++;
  }
  s.counts.rings++; s.rekindle = s.def.rekindle;
  const colours = (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
  const poly = Array.from(s.poly.subarray(0, 2 * s.pn));
  if (colours > 1) {
    const pts = s.opts.mixedScores ? n * n : 0;
    s.score += pts; s.light += pts; s.counts.mixed++; s.counts.mixedPoints += pts;
    for (let i = 0; i < MAXC; i++) {
      if (s.kind[i] === NONE || !inPoly(s.poly, s.pn, s.x[i], s.y[i])) continue;
      const a = Math.atan2(s.y[i] - cy, s.x[i] - cx) + (rnd(s) - 0.5) * 0.6;
      s.vx[i] = Math.cos(a) * 3.2; s.vy[i] = Math.sin(a) * 3.2; s.scare[i] = SCARE;
    }
    s.ev.push({ type: 'mixed', n, poly, x: cx, y: cy, points: pts });
    return;
  }
  const caught = [];
  for (let i = 0; i < MAXC; i++) {
    const k = s.kind[i];
    if (k === NONE || asleep(s, i) || !inPoly(s.poly, s.pn, s.x[i], s.y[i])) continue;
    if (k === MOTH) {
      const a = Math.atan2(s.y[i] - cy, s.x[i] - cx);
      s.vx[i] = Math.cos(a) * 2.6; s.vy[i] = Math.sin(a) * 2.6; s.cool[i] = 240;
      continue;
    }
    caught.push(s.x[i], s.y[i], k === GOLD ? 3 : s.col[i]);
    s.kind[i] = NONE; s.wait2[i] = k === GOLD ? 0 : 120 + Math.floor(rnd(s) * 90);
  }
  const N = n + gold;
  if (N > 0) {
    // The called colour: a ring of the colour the lantern asks for scores double, and the lantern asks for another.
    const called = s.call >= 0 && mask === 1 << s.call;
    const pts = (N * N) * (called ? 2 : 1) + gold * JAR;
    if (called) { const others = s.def.colors.filter(c => c !== s.call); s.call = others[Math.floor(rnd(s) * others.length)]; s.ev.push({ type: 'call', color: s.call }); }
    s.score += pts; s.light += pts; s.counts.pure++; s.counts.golden += gold;
    if (N > s.bestRing) s.bestRing = N;
    s.ev.push({ type: 'ring', n: N, gold, poly, x: cx, y: cy, points: pts, caught, color: mask ? Math.log2(mask) : 3, called });
  } else if (moths > 0) {
    s.score += moths; s.counts.mothRings++;
    s.ev.push({ type: 'moths', n: moths, poly, x: cx, y: cy, points: moths });
  } else s.ev.push({ type: 'empty', poly, x: cx, y: cy });
}

// Sleepers: on that level a firefly in the dark part of its blink is not caught and does not spoil a ring.
export const asleep = (s, i) => s.def.sleep && s.kind[i] === FLY && s.blink[i] >= SLEEP;

function snapCheck(s) {
  const a = s.t0, b = s.t1;
  if (b - a < 1) return;
  // Thorns cut the thread where it touches them. No wick is lost; the ring so far is.
  const th = s.def.thorn;
  for (let m = 0; m < th.length; m += 2) {
    let hit = b - a === 1 ? Math.hypot(th[m] - s.tx[a], th[m + 1] - s.ty[a]) < THORN : false;
    for (let k = a; k < b - 1 && !hit; k++) hit = segDist(th[m], th[m + 1], s.tx[k], s.ty[k], s.tx[k + 1], s.ty[k + 1]) < THORN;
    if (hit) { s.counts.thorns = (s.counts.thorns || 0) + 1; s.ev.push({ type: 'thorn', x: th[m], y: th[m + 1] }); clearThread(s); return; }
  }
  for (let i = 0; i < MAXC; i++) {
    if (s.kind[i] !== MOTH) continue;
    let hit = b - a === 1 ? Math.hypot(s.x[i] - s.tx[a], s.y[i] - s.ty[a]) < TOUCH : false;
    for (let k = a; k < b - 1 && !hit; k++) hit = segDist(s.x[i], s.y[i], s.tx[k], s.ty[k], s.tx[k + 1], s.ty[k + 1]) < TOUCH;
    if (!hit) continue;
    s.counts.snaps++; s.counts.wicksLost++; s.wicks--;
    s.ev.push({ type: 'snap', x: s.x[i], y: s.y[i], wicks: s.wicks });
    const ang = rnd(s) * Math.PI * 2;
    s.vx[i] = Math.cos(ang) * 2.4; s.vy[i] = Math.sin(ang) * 2.4; s.cool[i] = 240;
    clearThread(s);
    return;
  }
}

// Nearest point of the thread to (x, y), into s.ix, s.iy; returns the distance or Infinity.
function nearestThread(s, x, y) {
  let best = Infinity;
  for (let k = s.t0; k < s.t1; k += 3) {
    const d = Math.hypot(s.tx[k] - x, s.ty[k] - y);
    if (d < best) { best = d; s.ix = s.tx[k]; s.iy = s.ty[k]; }
  }
  return best;
}

function move(s) {
  const def = s.def, down = s.hx === s.hx;
  const wind = s.gust > 0 ? s.gustDir * def.gust * Math.sin(Math.PI * s.gust / 90) : 0;
  s.cx.fill(0); s.cy.fill(0); s.cn.fill(0);
  for (let i = 0; i < MAXC; i++) if (s.kind[i] === FLY && s.scare[i] === 0) { const c = s.col[i]; s.cx[c] += s.x[i]; s.cy[c] += s.y[i]; s.cn[c]++; }
  for (let c = 0; c < 3; c++) if (s.cn[c]) { s.cx[c] /= s.cn[c]; s.cy[c] /= s.cn[c]; }
  for (let i = 0; i < MAXC; i++) {
    const k = s.kind[i];
    if (k === NONE) {
      if (s.wait2[i] > 0 && --s.wait2[i] === 0) {
        let fewest = def.colors[0], least = Infinity;
        for (const c of def.colors) {
          let m = 0;
          for (let j = 0; j < MAXC; j++) if (s.kind[j] === FLY && s.col[j] === c) m++;
          if (m < least) { least = m; fewest = c; }
        }
        edge(s, i, FLY, fewest);
      }
      continue;
    }
    s.age[i]++;
    let ax = 0, ay = 0, max = 0.55;
    if (k === FLY && def.life && s.age[i] > def.life * 60) { s.kind[i] = NONE; s.wait2[i] = 40; s.ev.push({ type: 'fade', x: s.x[i], y: s.y[i], color: s.col[i] }); continue; }
    s.head[i] += (rnd(s) - 0.5) * 0.35;
    if (k === FLY) {
      ax += Math.cos(s.head[i]) * 0.02; ay += Math.sin(s.head[i]) * 0.02;
      if (s.scare[i] > 0) { s.scare[i]--; max = def.speed + 2.65 * s.scare[i] / SCARE; }
      else {
        max = def.speed;
        // Drawn toward the middle of their own colour, pushed off other colours close by, and slowly toward the lantern.
        for (let j = 0; j < MAXC; j++) {
          if (j === i || s.kind[j] !== FLY) continue;
          const dx = s.x[j] - s.x[i], dy = s.y[j] - s.y[i];
          if (dx > 60 || dx < -60 || dy > 60 || dy < -60) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 < 196) { const d = Math.sqrt(d2) + 0.01; ax -= dx / d * 0.04; ay -= dy / d * 0.04; }
          else if (s.col[j] !== s.col[i] && d2 < 3600) { const d = Math.sqrt(d2) + 0.01; ax -= dx / d * def.repel; ay -= dy / d * def.repel; }
        }
        const c = s.col[i], m = s.cn[c];
        if (m > 1) {
          const gx = (s.cx[c] - s.x[i]) / (m - 1) * m, gy = (s.cy[c] - s.y[i]) / (m - 1) * m, d = Math.hypot(gx, gy) + 0.01;
          if (d > 18) { ax += gx / d * def.cohesion; ay += gy / d * def.cohesion; }
        }
        const lx = LX - s.x[i], ly = LY - s.y[i], ld = Math.hypot(lx, ly) + 0.01;
        if (ld > 90) { ax += lx / ld * def.pull; ay += ly / ld * def.pull; }
        if (def.shy && down) {
          const dx = s.x[i] - s.hx, dy = s.y[i] - s.hy, d = Math.hypot(dx, dy) + 0.01;
          if (d < 70) { ax += dx / d * def.shy; ay += dy / d * def.shy; }
        }
      }
    } else if (k === MOTH) {
      max = 0.85;
      if (s.cool[i] > 0) { s.cool[i]--; max = 2.4; }
      // Fair moths (the page's rules since 2026-11-24): a moth chases only a thread within 150, and only after
      // noticing it for half a second, while it flutters in place and the page shows it.
      else if (s.t1 > s.t0 && nearestThread(s, s.x[i], s.y[i]) < (s.opts.fair ? 150 : 260)) {
        if (s.opts.fair && ++s.notice[i] <= NOTICE) max = 0.25; // noticing: it hovers
        else {
          const dx = s.ix - s.x[i], dy = s.iy - s.y[i], d = Math.hypot(dx, dy) + 0.01;
          ax += dx / d * 0.05; ay += dy / d * 0.05;
        }
      } else {
        s.notice[i] = 0;
        ax += Math.cos(s.head[i]) * 0.03; ay += Math.sin(s.head[i]) * 0.03;
        const lx = LX - s.x[i], ly = LY - s.y[i], ld = Math.hypot(lx, ly) + 0.01;
        if (ld > 120) { ax += lx / ld * 0.01; ay += ly / ld * 0.01; }
      }
    } else {
      max = 0.7;
      ax += Math.cos(s.head[i]) * 0.03; ay += Math.sin(s.head[i]) * 0.03;
      if (down) {
        const dx = s.x[i] - s.hx, dy = s.y[i] - s.hy, d = Math.hypot(dx, dy) + 0.01;
        if (d < 80) { ax += dx / d * 0.14; ay += dy / d * 0.14; max = 1.7; }
      }
      if (s.age[i] > 14 * 60) { ax += (s.x[i] < LX ? -0.05 : 0.05); max = 1.2; }
      if (s.scare[i] > 0) { s.scare[i]--; max = 3.2; }
    }
    ax += wind;
    for (let m = 0; m < def.thorn.length; m += 2) {
      const dx = s.x[i] - def.thorn[m], dy = s.y[i] - def.thorn[m + 1], d = Math.hypot(dx, dy) + 0.01;
      if (d < THORN + 16) { ax += dx / d * 0.08; ay += dy / d * 0.08; }
    }
    const leaving = k === GOLD && s.age[i] > 14 * 60;
    if (!leaving) {
      if (s.x[i] < 12) ax += 0.06; else if (s.x[i] > W - 12) ax -= 0.06;
      if (s.y[i] < 12) ay += 0.06; else if (s.y[i] > H - 12) ay -= 0.06;
    }
    let vx = (s.vx[i] + ax) * 0.985, vy = (s.vy[i] + ay) * 0.985;
    const sp = Math.hypot(vx, vy);
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    s.vx[i] = vx; s.vy[i] = vy; s.x[i] += vx; s.y[i] += vy;
    if (s.x[i] < -40 || s.x[i] > W + 40 || s.y[i] < -40 || s.y[i] > H + 40) {
      if (k === GOLD) s.kind[i] = NONE;
      else { s.x[i] = Math.min(W + 30, Math.max(-30, s.x[i])); s.y[i] = Math.min(H + 30, Math.max(-30, s.y[i])); }
    }
    s.blink[i] += k === FLY ? 0.011 + 0.003 * s.col[i] : 0.02;
    if (s.blink[i] >= 1) s.blink[i] -= 1;
  }
}

function events(s) {
  const def = s.def;
  if (def.moths) {
    let m = 0;
    for (let i = 0; i < MAXC; i++) if (s.kind[i] === MOTH) m++;
    if (m < def.moths && --s.mothT <= 0) {
      const i = free(s);
      if (i >= 0) { edge(s, i, MOTH, 0); s.ev.push({ type: 'moth' }); }
      s.mothT = 240 + Math.floor(rnd(s) * 180);
    }
  }
  if (def.wind) {
    if (s.gust > 0) s.gust--;
    else if (--s.gustT <= 0) { s.gust = 90; s.gustDir = rnd(s) < 0.5 ? -1 : 1; s.gustT = def.gustEvery + Math.floor(rnd(s) * 180); s.ev.push({ type: 'gust', dir: s.gustDir }); }
  }
  if (def.golden && !s.goldenDone && s.levelTick >= def.goldenAt) {
    s.goldenDone = true;
    const i = free(s);
    if (i >= 0) { edge(s, i, GOLD, 3); s.ev.push({ type: 'golden' }); }
  }
  if (def.bat) bat(s);
}

// The bat picks the firefly with the most same-colour neighbours, warns for a second, then homes on it and eats what it passes.
function bat(s) {
  if (s.batPhase === 0) {
    if (--s.batT > 0) return;
    let best = -1, most = -1;
    for (let i = 0; i < MAXC; i++) {
      if (s.kind[i] !== FLY) continue;
      let m = 0;
      for (let j = 0; j < MAXC; j++) if (s.kind[j] === FLY && s.col[j] === s.col[i] && Math.abs(s.x[j] - s.x[i]) + Math.abs(s.y[j] - s.y[i]) < 70) m++;
      if (m > most) { most = m; best = i; }
    }
    if (best < 0) { s.batT = 60; return; }
    s.batTarget = best; s.batPhase = 1; s.batT = BAT_WARN;
    const left = s.x[best] > LX;
    s.batX = left ? -30 : W + 30; s.batY = Math.max(40, Math.min(H - 40, s.y[best] + (rnd(s) - 0.5) * 200));
    s.ev.push({ type: 'bat', x: s.batX, y: s.batY });
    return;
  }
  if (s.batPhase === 1) {
    if (--s.batT > 0) return;
    s.batPhase = 2;
    const t = s.batTarget, dx = (s.kind[t] === FLY ? s.x[t] : LX) - s.batX, dy = (s.kind[t] === FLY ? s.y[t] : LY) - s.batY, d = Math.hypot(dx, dy);
    s.batVX = dx / d * 2.4; s.batVY = dy / d * 2.4;
    return;
  }
  const t = s.batTarget;
  if (t >= 0 && s.kind[t] === FLY) {
    const dx = s.x[t] - s.batX, dy = s.y[t] - s.batY, d = Math.hypot(dx, dy) + 0.01;
    s.batVX += dx / d * 0.08; s.batVY += dy / d * 0.08;
    const sp = Math.hypot(s.batVX, s.batVY); s.batVX *= 2.4 / sp; s.batVY *= 2.4 / sp;
  } else s.batTarget = -1;
  s.batX += s.batVX; s.batY += s.batVY;
  for (let i = 0; i < MAXC; i++) {
    const k = s.kind[i];
    if ((k !== FLY && k !== GOLD) || Math.abs(s.x[i] - s.batX) > EAT || Math.abs(s.y[i] - s.batY) > EAT) continue;
    if (Math.hypot(s.x[i] - s.batX, s.y[i] - s.batY) > EAT) continue;
    s.ev.push({ type: 'eat', x: s.x[i], y: s.y[i], color: k === GOLD ? 3 : s.col[i] });
    s.kind[i] = NONE; s.wait2[i] = k === GOLD ? 0 : 150 + Math.floor(rnd(s) * 90); s.counts.eaten++;
    if (i === t) s.batTarget = -1;
  }
  if (s.batX < -50 || s.batX > W + 50 || s.batY < -50 || s.batY > H + 50) { s.batPhase = 0; s.batT = s.def.batGap + Math.floor(rnd(s) * 240); s.batTarget = -1; }
}

function endLevel(s, full) {
  const endless = s.opts.mode === 'endless';
  // Jars filled before dawn: every whole second of dawn left is worth DAWN_BONUS points.
  const bonus = full ? DAWN_BONUS * Math.floor(s.dawn / 60) : 0;
  s.score += bonus; s.lastBonus = bonus;
  // Relight (the page's rules since 2026-11-24): full jars give back one wick, up to three.
  if (s.opts.relight && full && s.wicks < 3) { s.wicks++; s.ev.push({ type: 'relight', wicks: s.wicks }); }
  if (endless && full) { s.round++; s.ev.push({ type: 'full', round: s.round, bonus }); s.phase = 'interlude'; s.wait = 75; clearThread(s); return; }
  if (!endless) {
    s.results[s.level] = Math.min(1, s.light / s.target);
    if (full) s.cleared++;
  }
  s.ev.push({ type: 'end', level: s.level, full, fill: Math.min(1, s.light / s.target), bonus });
  clearThread(s);
  if (endless || s.level === NIGHT - 1 || (s.opts.single && !endless)) { s.phase = 'done'; s.reason = 'dawn'; s.ev.push({ type: 'over', reason: s.reason }); return; }
  s.phase = 'interlude'; s.wait = 90;
}

export function step(s, hx, hy) {
  s.ev.length = 0;
  if (s.phase === 'done') return s;
  if (s.phase === 'interlude') {
    clearThread(s); s.hx = NaN;
    if (--s.wait <= 0) { s.phase = 'play'; startLevel(s, s.opts.mode === 'endless' ? s.level : s.level + 1); }
    return s;
  }
  s.tick++; s.levelTick++; s.dawn--;
  input(s, hx, hy);
  move(s);
  events(s);
  snapCheck(s);
  if (s.wicks <= 0) {
    if (s.opts.mode !== 'endless') s.results[s.level] = Math.min(1, s.light / s.target);
    s.phase = 'done'; s.reason = 'wicks'; clearThread(s); s.ev.push({ type: 'over', reason: 'wicks' }); return s;
  }
  if (s.light >= s.target) endLevel(s, true);
  else if (s.dawn <= 0) endLevel(s, false);
  return s;
}

// 1 star for any finished run, a second for 6 full levels, a third for all 8. Running out of wicks keeps 1.
export function stars(s) {
  if (s.reason === 'wicks') return 1;
  return 1 + (s.cleared >= 6 ? 1 : 0) + (s.cleared >= NIGHT ? 1 : 0);
}

export function hashState(s) {
  let h = 2166136261;
  const mix = v => { h = Math.imul(h ^ (Math.round(v * 1000) | 0), 16777619); };
  mix(s.tick); mix(s.level); mix(s.score); mix(s.wicks); mix(s.light); mix(s.r); mix(s.batX); mix(s.batY); mix(s.cleared);
  for (let i = 0; i < MAXC; i++) { mix(s.kind[i]); mix(s.col[i]); mix(s.x[i]); mix(s.y[i]); }
  return (h >>> 0).toString(16);
}
