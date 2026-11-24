// Harvest Morning: the rules. Pure; runs in Node for the bots. No Date.now or Math.random: every chance comes from the
// seeded rng in the state. World units are field cells: the field is cols x rows cells, y grows downward, and below the
// last row runs the lane (the verge) where the cart stands.
export const DT = 1 / 30;
export const SWEEP = 5; // seconds the rain takes to cross the field from left to right once the storm arrives

// Player
export const SPEED = 3.1, WADE = 2.3, CARRY_SLOW = 0.03; // cells/s on open ground, in standing wheat; slower per sheaf carried
export const CUT = 3.6, BLUNT = 0.3, FLAT = 0.38, REACH = 1.05; // cut progress per second, times when blunt / when wheat is flattened
export const PICK = 0.7, CARRY = 3, CART_R = 1.15, WHET_T = 1.0;
// Hazards
export const CROW_EAT = 0.09, CROW_FLY = 4.5, SCARE = 1.7, CHILD_SCARE = 1.1, NEST_BONUS = 12, WIND_R = 1.9;
export const LANE = 1.7; // depth of the lane below the field

// The neighbours. price: grain for a whole morning's work; pay is taken pro rata for the time they actually worked
// (hired to sent home, or to the end). Each has their own reason, drawn as a picture on the page (see art.js).
export const HELP = {
  strong: { price: 22, speed: 2.2, wade: 1.8, carry: 10 },             // carries sheaves to the cart; reason: a hungry baby
  child: { price: 6, speed: 3.9 },                                     // chases crows; reason: a sweet
  old: { price: 10 },                                                  // ties bundles at the cart: you carry double; reason: bread for winter
  fast: { price: 8, speed: 3.3, wade: 2.8, cut: 4.2, carry: 3, trample: 0.12 }, // cuts fast but tramples some; reason: a wedding ring
};
export const HELPERS = ['strong', 'child', 'old', 'fast'];
export const RIVAL = { fast: 'strong' }; // the fast one will not work beside the strong one (and says so with a picture)

// Twelve mornings. Introduce hazards first, then shorter mornings that reward hired help. stars: grain kept for one, two and three stars; one star passes.
// crows: seconds between crows (0: none). wind: times a gust flattens a patch. stone: hidden stones. nest: a hare's nest.
export const LEVELS = [
  { cols: 5, rows: 5, shape: 'rect', time: 90, cart: 2.5, crows: 0, wind: [], stone: 0, nest: false, help: [], stars: [15, 21, 25], learn: 'cut' },
  { cols: 6, rows: 6, shape: 'oval', time: 95, cart: 1.5, crows: 11, wind: [], stone: 0, nest: false, help: [], stars: [20, 26, 30], learn: 'crows' },
  { cols: 8, rows: 10, shape: 'rect', time: 90, cart: 0.6, crows: 11, wind: [], stone: 0, nest: false, help: ['strong'], stars: [34, 50, 61], learn: 'strong' },
  { cols: 8, rows: 9, shape: 'oval', time: 105, cart: 1.5, crows: 10, wind: [], stone: 1, nest: false, help: ['strong'], stars: [37, 46, 51], learn: 'stone' },
  { cols: 8, rows: 10, shape: 'rect', time: 110, cart: 6.5, crows: 5, wind: [], stone: 1, nest: false, help: ['strong', 'child'], stars: [39, 56, 64], learn: 'child' },
  { cols: 9, rows: 10, shape: 'L', time: 115, cart: 2.5, crows: 6, wind: [30, 70], stone: 1, nest: false, help: ['strong', 'child'], stars: [42, 58, 65], learn: 'wind' },
  { cols: 9, rows: 12, shape: 'rect', time: 50, cart: 4.5, crows: 6, wind: [20], stone: 1, nest: false, help: ['strong', 'child', 'old', 'fast'], stars: [56, 64, 68], learn: 'fast' },
  { cols: 10, rows: 14, shape: 'diamond', time: 60, cart: 5, crows: 6, wind: [25], stone: 1, nest: true, help: ['strong', 'child', 'old', 'fast'], stars: [61, 68, 74], learn: 'nest' },
  { cols: 10, rows: 13, shape: 'rect', time: 60, cart: 5, crows: 5, wind: [20, 45], stone: 1, nest: false, help: ['strong', 'child', 'old', 'fast'], stars: [66, 76, 80], learn: 'wind' },
  { cols: 10, rows: 14, shape: 'ring', time: 65, cart: 7.5, crows: 5, wind: [30, 50], stone: 2, nest: true, help: ['strong', 'child', 'old', 'fast'], stars: [71, 79, 88], learn: 'pond' },
  { cols: 10, rows: 15, shape: 'two', time: 70, cart: 9, crows: 4.5, wind: [30, 55], stone: 2, nest: true, help: ['strong', 'child', 'old', 'fast'], stars: [73, 80, 88], learn: 'far' },
  { cols: 10, rows: 16, shape: 'hourglass', time: 75, cart: 5, crows: 4, wind: [25, 45, 60], stone: 2, nest: true, help: ['strong', 'child', 'old', 'fast'], stars: [75, 82, 90], learn: 'all' },
];
export const SHAPES = ['rect', 'oval', 'L', 'diamond', 'ring', 'two', 'hourglass'];

// Today's field: everyone on a date gets the same field from one seed.
// The seed of today's field for a UTC date 'YYYY-MM-DD' (FNV-1a), the same on every device.
export const dateSeed = d => { let h = 2166136261; for (const ch of 'harvest-' + d) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function dailyLevel(seed) {
  const r = rng(seed ^ 0x9e3779b9);
  const rows = 11 + Math.floor(r() * 3), shape = SHAPES[1 + Math.floor(r() * (SHAPES.length - 1))];
  return { cols: 10, rows, shape, time: 130, cart: 1.5 + Math.floor(r() * 8), crows: 5, wind: [35 + Math.floor(r() * 20), 85], stone: 2, nest: true, help: HELPERS.slice(), stars: null, learn: 'daily' };
}

let MUT = null; // a deliberately broken rule for `node bots.mjs --mutate`
export function mutate(name) { MUT = name; }

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function mask(cols, rows, shape) {
  const m = new Uint8Array(cols * rows), cx = cols / 2, cy = rows / 2;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = x + 0.5, py = y + 0.5, dx = (px - cx) / cx, dy = (py - cy) / cy;
    let on = true;
    if (shape === 'oval') on = dx * dx + dy * dy <= 1.12;
    else if (shape === 'L') on = !(px > cols * 0.56 && py < rows * 0.45);
    else if (shape === 'diamond') on = Math.abs(dx) + Math.abs(dy) <= 1.25;
    else if (shape === 'ring') on = Math.hypot(px - cx, py - cy * 0.9) > Math.min(cols, rows) * 0.2;
    else if (shape === 'two') on = !(Math.abs(py - rows * 0.42) < 0.6) && !(px > cols * 0.7 && py < rows * 0.42);
    else if (shape === 'hourglass') on = Math.abs(dx) <= 0.45 + 0.6 * Math.abs(dy);
    m[y * cols + x] = on ? 1 : 0;
  }
  return m;
}

// Cell states
export const NONE = 0, STAND = 1, LYING = 2, GONE = 3;

export function create({ level = 0, seed = 1, L = null } = {}) {
  L = L ?? LEVELS[level];
  const r = rng(seed), cols = L.cols, rows = L.rows, n = cols * rows, m = mask(cols, rows, L.shape);
  const st = new Uint8Array(n), grain = new Float32Array(n), prog = new Float32Array(n), flat = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (m[i]) { st[i] = STAND; grain[i] = 1; }
  const cart = { x: L.cart, y: rows + LANE / 2, grain: 0 };
  const far = i => Math.hypot((i % cols) + 0.5 - cart.x, Math.floor(i / cols) + 0.5 - cart.y) > 3;
  const cells = [...st.keys()].filter(i => st[i] === STAND);
  // the hare's nest: a plus of five standing cells away from the cart
  let nest = [];
  if (L.nest) {
    const ok = i => { const x = i % cols, y = Math.floor(i / cols); return x > 0 && x < cols - 1 && y > 0 && y < rows - 1 && far(i) && [i, i - 1, i + 1, i - cols, i + cols].every(j => st[j] === STAND); };
    const can = cells.filter(ok); const c = can[Math.floor(r() * can.length)];
    if (c !== undefined) nest = [c, c - 1, c + 1, c - cols, c + cols];
  }
  const stones = [];
  for (let k = 0; k < L.stone; k++) {
    const can = cells.filter(i => far(i) && !nest.includes(i) && !stones.includes(i));
    if (can.length) stones.push(can[Math.floor(r() * can.length)]);
  }
  const helpers = {};
  for (const id of HELPERS) helpers[id] = { id, offered: L.help.includes(id), hired: false, ever: false, gone: false, worked: 0, x: cart.x, y: cart.y + 0.2, carry: 0, carryN: 0, tx: null, ty: null, think: 0, face: 0, cutting: 0 };
  return {
    L, level, seed, r, t: 0, cols, rows, st, grain, prog, flat, nest, nestAlive: nest.length > 0, stones, found: [],
    total: cells.length, cart,
    me: { x: cart.x, y: cart.y - 0.3, carry: 0, carryN: 0, blunt: false, whet: 0, face: 0, moving: false, cutting: 0 },
    helpers, crows: [], nextCrow: L.crows ? 4 + L.crows * 0.5 : Infinity, winds: L.wind.slice(), front: -1,
    over: false, why: null, result: null, ev: [], stats: { cut: 0, eaten: 0, trampled: 0, soaked: 0, scared: 0, hires: 0 },
  };
}

const cx = (s, i) => (i % s.cols) + 0.5, cy = (s, i) => Math.floor(i / s.cols) + 0.5;
const idx = (s, x, y) => (x < 0 || y < 0 || x >= s.cols || y >= s.rows) ? -1 : Math.floor(y) * s.cols + Math.floor(x);
export const limit = s => (s.helpers.old.hired ? 2 : 1) * CARRY;
export const timeLeft = s => s.L.time - s.t;
export const raining = s => s.t >= s.L.time;

function emit(s, type, data = {}) { if (s.ev.length < 400) s.ev.push({ type, t: s.t, ...data }); }

// Move an agent toward (tx, ty) at its speed; slower in standing wheat. Returns true when it arrived.
function move(s, a, tx, ty, speed, wade) {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  const i = idx(s, a.x, a.y), sp = (i >= 0 && s.st[i] === STAND ? wade : speed) * DT;
  if (d < 1e-3) return true;
  const k = Math.min(1, sp / d);
  a.x += dx * k; a.y += dy * k; a.face = Math.atan2(dy, dx);
  a.x = Math.max(0.25, Math.min(s.cols - 0.25, a.x)); a.y = Math.max(0.25, Math.min(s.rows + LANE - 0.25, a.y));
  return d <= sp;
}

function cutCell(s, i, who) {
  s.st[i] = LYING; s.prog[i] = 0; s.stats.cut++;
  if (s.nest.includes(i) && s.nestAlive) { s.nestAlive = false; emit(s, 'hare', { x: cx(s, i), y: cy(s, i) }); }
  const k = s.stones.indexOf(i);
  if (k >= 0) {
    s.stones.splice(k, 1); s.found.push(i);
    if (who === 'me') { s.me.blunt = true; emit(s, 'stone', { x: cx(s, i), y: cy(s, i) }); }
  }
  if (who === 'fast' && s.r() < HELP.fast.trample) { s.st[i] = GONE; s.grain[i] = 0; s.stats.trampled++; emit(s, 'trample', { x: cx(s, i), y: cy(s, i) }); return; }
  emit(s, 'cut', { x: cx(s, i), y: cy(s, i), who });
}

// Standing wheat within reach of (x, y) is cut at `rate` progress per second.
function swing(s, a, rate, who) {
  let any = 0;
  for (let y = Math.floor(a.y - REACH); y <= Math.floor(a.y + REACH); y++) for (let x = Math.floor(a.x - REACH); x <= Math.floor(a.x + REACH); x++) {
    const i = idx(s, x, y); if (i < 0 || s.st[i] !== STAND) continue;
    if (Math.hypot(x + 0.5 - a.x, y + 0.5 - a.y) > REACH) continue;
    if ((who === 'me' || who === 'fast') && s.nestAlive && s.nest.includes(i) && !s.nest.includes(idx(s, a.x, a.y))) continue; // the nest is cut only by walking into it
    s.prog[i] += rate * (s.flat[i] && who !== 'fast' ? FLAT : 1) * DT; // the fast one's swing goes through flattened wheat
    any = 1;
    if (s.prog[i] >= 1) cutCell(s, i, who);
  }
  return any;
}
// Lying sheaves within reach are bundled onto the back, up to `max`.
function gather(s, a, max, who) {
  for (let y = Math.floor(a.y - PICK); y <= Math.floor(a.y + PICK); y++) for (let x = Math.floor(a.x - PICK); x <= Math.floor(a.x + PICK); x++) {
    if (a.carryN >= max) return;
    const i = idx(s, x, y); if (i < 0 || s.st[i] !== LYING) continue;
    if (Math.hypot(x + 0.5 - a.x, y + 0.5 - a.y) > PICK) continue;
    a.carry += s.grain[i]; a.carryN++; s.st[i] = GONE; s.grain[i] = 0;
    emit(s, 'pick', { x: x + 0.5, y: y + 0.5, who, n: a.carryN });
  }
}
function unload(s, a, who) {
  if (a.carryN > 0 && Math.hypot(a.x - s.cart.x, a.y - s.cart.y) < CART_R) {
    s.cart.grain += a.carry; emit(s, 'drop', { n: a.carryN, grain: a.carry, who }); a.carry = 0; a.carryN = 0;
  }
}

// --- the player's actions (the page and the bots call the same functions)
export function whet(s) {
  if (s.over || !s.me.blunt || s.me.whet > 0) return false;
  s.me.whet = WHET_T; emit(s, 'whet'); return true;
}
// Tap a neighbour: hire them, or send home one who is working. Returns 'hired', 'refused', 'home' or 'no'.
export function hire(s, id) {
  const h = s.helpers[id];
  if (s.over || !h || !h.offered || h.gone) return 'no';
  if (h.hired) { // sent home: they drop what they carry at the cart on the way
    h.hired = false; h.gone = true; if (h.carry) { s.cart.grain += h.carry; h.carry = 0; h.carryN = 0; }
    emit(s, 'home', { id }); return 'home';
  }
  const rival = RIVAL[id];
  if (rival && s.helpers[rival].ever) { emit(s, 'refuse', { id, rival }); return 'refused'; }
  h.hired = true; h.ever = true; s.stats.hires++; emit(s, 'hire', { id }); return 'hired';
}
export function wages(s) {
  let pay = 0; const each = {};
  for (const id of HELPERS) { const h = s.helpers[id]; const w = Math.ceil(HELP[id].price * Math.min(1, h.worked / s.L.time) - 1e-9); each[id] = w; pay += w; }
  return { pay: MUT === 'free-help' ? 0 : pay, each };
}

// One tick. inp: { x, y } in world cells (where the finger points) or null (finger up).
export function step(s, inp = null) {
  if (s.over) return;
  s.t += DT;
  const me = s.me;
  // The player
  me.moving = false; me.cutting = 0;
  if (me.whet > 0) { me.whet -= DT; if (me.whet <= 0) { me.whet = 0; me.blunt = false; emit(s, 'sharp'); } }
  else {
    if (inp) {
      const slow = Math.max(0.6, 1 - CARRY_SLOW * me.carryN);
      const ox = me.x, oy = me.y;
      move(s, me, inp.x, inp.y, SPEED * slow, WADE * slow);
      me.moving = Math.hypot(me.x - ox, me.y - oy) > 1e-4;
    }
    me.cutting = swing(s, me, CUT * (me.blunt ? BLUNT : 1), 'me');
  }
  gather(s, me, limit(s), 'me');
  unload(s, me, 'me');
  // The neighbours
  for (const id of HELPERS) { const h = s.helpers[id]; if (h.hired) { h.worked += DT; ACT[id](s, h); } }
  // Crows
  crows(s);
  // Wind
  while (s.winds.length && s.t >= s.winds[0]) { s.winds.shift(); gust(s); }
  // The storm: the rain front crosses the field from left to right; what it reaches is lost unless it is in the cart.
  if (s.t >= s.L.time) {
    if (s.front < 0) { s.front = 0; emit(s, 'storm'); }
    const f = Math.min(s.cols, Math.ceil((s.t - s.L.time) / SWEEP * s.cols));
    while (s.front < f) { // s.front: columns soaked so far
      const col = s.front++;
      for (let y = 0; y < s.rows; y++) { const i = y * s.cols + col; if (s.st[i] === STAND || s.st[i] === LYING) { s.st[i] = GONE; s.grain[i] = 0; s.stats.soaked++; } }
      emit(s, 'soak', { col });
    }
    if (s.t >= s.L.time + SWEEP) return finish(s, 'rain');
  }
  if (s.t < s.L.time && cleared(s)) finish(s, 'cleared'); // once the rain has begun, the morning runs to its end
}

// Everything that can be saved is in the cart (a hare's nest left standing on purpose does not count against it).
export function cleared(s) {
  for (let i = 0; i < s.st.length; i++) { if (s.st[i] === LYING) return false; if (s.st[i] === STAND && !(s.nestAlive && s.nest.includes(i))) return false; }
  if (s.me.carryN) return false;
  for (const id of HELPERS) if (s.helpers[id].carryN) return false;
  return true;
}

function finish(s, why) {
  s.over = true; s.why = why;
  for (const id of HELPERS) s.helpers[id].hired = false;
  const { pay, each } = wages(s), cart = Math.floor(s.cart.grain + 1e-6), bonus = s.nestAlive ? NEST_BONUS : 0;
  const kept = Math.max(0, cart - pay) + bonus;
  const stars = s.L.stars ? s.L.stars.filter(v => kept >= v).length : 0;
  s.result = { why, cart, pay, each, bonus, kept, stars, passed: s.L.stars ? stars >= 1 : true, t: s.t };
  emit(s, 'end', { kept, stars });
}
// Leave the field before the rain: what is in the cart counts, helpers are paid for what they worked.
export function stop(s) { if (!s.over) finish(s, 'stopped'); }

function gust(s) {
  const stand = [...s.st.keys()].filter(i => s.st[i] === STAND);
  if (!stand.length) return;
  const c = stand[Math.floor(s.r() * stand.length)], x = cx(s, c), y = cy(s, c);
  for (const i of stand) if (Math.hypot(cx(s, i) - x, cy(s, i) - y) <= WIND_R) s.flat[i] = 1;
  emit(s, 'wind', { x, y });
}

function crows(s) {
  if (s.t >= s.nextCrow) {
    s.nextCrow += s.L.crows;
    if (s.crows.length < 4 && s.t < s.L.time) {
      const x = 0.5 + s.r() * (s.cols - 1);
      const c = { x, y: -1.5, tx: x, ty: 0, target: -1, eating: false, flee: false, flap: s.r() * 6 };
      pickTarget(s, c); s.crows.push(c); emit(s, 'crow', { x: c.x });
    }
  }
  const child = s.helpers.child;
  for (const c of s.crows) {
    if (!c.flee) {
      const near = Math.hypot(s.me.x - c.x, s.me.y - c.y) < SCARE || (child.hired && Math.hypot(child.x - c.x, child.y - c.y) < CHILD_SCARE) || raining(s);
      if (near && c.y > -1) { c.flee = true; c.eating = false; c.tx = c.x + (c.x < s.cols / 2 ? -4 : 4); c.ty = -3; s.stats.scared++; emit(s, 'scare', { x: c.x, y: c.y }); continue; }
      if (c.target < 0 || !(s.st[c.target] === LYING || s.st[c.target] === STAND)) { c.eating = false; if (!pickTarget(s, c)) { c.flee = true; c.tx = c.x; c.ty = -3; continue; } }
      if (!c.eating) {
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy), sp = CROW_FLY * DT;
        if (d <= sp) { c.x = c.tx; c.y = c.ty; c.eating = true; emit(s, 'land', { x: c.x, y: c.y }); } else { c.x += dx / d * sp; c.y += dy / d * sp; }
      } else {
        const i = c.target;
        s.grain[i] -= CROW_EAT * DT;
        if (s.grain[i] <= 0.02) { s.grain[i] = 0; s.st[i] = GONE; s.stats.eaten++; emit(s, 'eaten', { x: c.x, y: c.y }); c.target = -1; c.eating = false; }
      }
    } else {
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy), sp = CROW_FLY * 1.4 * DT;
      if (d <= sp) c.gone = true; else { c.x += dx / d * sp; c.y += dy / d * sp; }
    }
  }
  s.crows = s.crows.filter(c => !c.gone);
}
// A crow goes for lying sheaves first (easy pickings), else standing wheat; never one another crow is on, never the hare's nest.
function pickTarget(s, c) {
  const taken = new Set(s.crows.map(o => o.target));
  let best = -1, bd = Infinity;
  for (const want of [LYING, STAND]) {
    for (let i = 0; i < s.st.length; i++) if (s.st[i] === want && !taken.has(i) && !(s.nestAlive && s.nest.includes(i))) { const d = Math.hypot(cx(s, i) - c.x, cy(s, i) - c.y) + s.r() * 3; if (d < bd) { bd = d; best = i; } }
    if (best >= 0) break;
  }
  if (best < 0) return false;
  c.target = best; c.tx = cx(s, best) + (s.r() - 0.5) * 0.3; c.ty = cy(s, best) + (s.r() - 0.5) * 0.3; return true;
}

function nearest(s, a, test) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < s.st.length; i++) if (test(i)) { const d = Math.hypot(cx(s, i) - a.x, cy(s, i) - a.y); if (d < bd) { bd = d; best = i; } }
  return best;
}
const homeSpot = (s, h, k) => ({ x: Math.max(0.6, Math.min(s.cols - 0.6, s.cart.x + k)), y: s.rows + LANE * 0.6 });

// How each neighbour works.
const ACT = {
  strong(s, h) {
    const P = HELP.strong;
    if ((h.think -= DT) <= 0 || h.tx === null) {
      h.think = 0.4;
      const i = h.carryN < P.carry ? nearest(s, h, j => s.st[j] === LYING) : -1;
      if (i >= 0) { h.tx = cx(s, i); h.ty = cy(s, i); } else if (h.carryN > 0) { h.tx = s.cart.x; h.ty = s.cart.y; } else { const p = homeSpot(s, h, -1.2); h.tx = p.x; h.ty = p.y; }
    }
    move(s, h, h.tx, h.ty, P.speed, P.wade);
    gather(s, h, P.carry, 'strong');
    if (h.carryN >= P.carry) { h.tx = s.cart.x; h.ty = s.cart.y; }
    const before = h.carryN; unload(s, h, 'strong'); if (before && !h.carryN) h.think = 0;
  },
  fast(s, h) {
    const P = HELP.fast;
    // Cut and carry a small load. Cutting alone leaves grain for the crows, not the cart.
    // Once returning, keep the cart as the goal until the load is delivered.
    const returning = h.carryN >= P.carry || (h.carryN > 0 && h.tx === s.cart.x && h.ty === s.cart.y);
    if (returning) { h.tx = s.cart.x; h.ty = s.cart.y; }
    else if ((h.think -= DT) <= 0 || h.tx === null || s.st[idx(s, h.tx, h.ty)] === GONE) {
      h.think = 0.3;
      const safe = j => !(s.nestAlive && s.nest.includes(j));
      let i = nearest(s, h, j => s.st[j] === LYING && safe(j));
      if (i < 0) i = nearest(s, h, j => s.st[j] === STAND && safe(j));
      if (i >= 0) { h.tx = cx(s, i); h.ty = cy(s, i); }
      else if (h.carryN) { h.tx = s.cart.x; h.ty = s.cart.y; }
      else { const p = homeSpot(s, h, 1.4); h.tx = p.x; h.ty = p.y; }
    }
    move(s, h, h.tx, h.ty, P.speed, P.wade);
    h.cutting = returning ? 0 : swing(s, h, P.cut, 'fast');
    gather(s, h, P.carry, 'fast');
    const before = h.carryN; unload(s, h, 'fast'); if (before && !h.carryN) { h.think = 0; h.tx = null; }
  },
  child(s, h) {
    const P = HELP.child;
    let best = null, bd = Infinity;
    for (const c of s.crows) if (!c.flee && c.y > -0.5) { const d = Math.hypot(c.x - h.x, c.y - h.y); if (d < bd) { bd = d; best = c; } }
    if (best) { h.tx = best.x; h.ty = best.y; } else { const p = homeSpot(s, h, 2.2); h.tx = p.x; h.ty = p.y; }
    move(s, h, h.tx, h.ty, P.speed, P.speed);
  },
  old(s, h) { const p = homeSpot(s, h, 0.9); h.tx = p.x; h.ty = s.cart.y - 0.1; move(s, h, h.tx, h.ty, 1.2, 1.2); },
};

// A short fingerprint of the state, for the determinism check.
export function digest(s) {
  let h = 2166136261;
  const mix = v => { h ^= Math.round(v * 1000) | 0; h = Math.imul(h, 16777619) >>> 0; };
  mix(s.t); mix(s.me.x); mix(s.me.y); mix(s.cart.grain); for (let i = 0; i < s.st.length; i++) mix(s.st[i] * 7 + s.grain[i]);
  for (const c of s.crows) { mix(c.x); mix(c.y); }
  for (const id of HELPERS) { const a = s.helpers[id]; mix(a.x); mix(a.y); mix(a.carry); }
  return h.toString(16);
}
export const counts = s => { let stand = 0, lying = 0; for (const v of s.st) { if (v === STAND) stand++; else if (v === LYING) lying++; } return { stand, lying }; };
export const center = (s, i) => ({ x: cx(s, i), y: cy(s, i) });
