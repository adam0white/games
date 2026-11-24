// Ant Promotion: The Nest. Rules only, no drawing, no DOM.
// Deterministic for a seed and an input sequence. One step is 1/20 s of game time.
// The player marks soil cells to dig and places one queen's room. The ants choose their own work.

export const COLS = 14, ROWS = 20, DT = 1 / 20;
export const RAIN_AT = 95, RAIN_FOR = 18, SETTLE = 4, END_AT = RAIN_AT + RAIN_FOR + SETTLE;
export const WARN = 8; // seconds before the rain when ants stop work and go in
export const RAIN_RATE = 0.62; // cells of water per second through the entrance while it rains
export const EARTH = 0, CLAY = 1, STONE = 2, SEEDS = 3, POCKET = 4, OPEN = 5;
export const KIND_NAME = ['soft earth', 'hard clay', 'stone', 'buried seeds', 'water pocket', 'tunnel'];
const DIG_TIME = [1.0, 3.2, 0, 1.0, 1.0];
const SPEED = 3.2, QUEEN_SPEED = 1.8, MAX_ANTS = 14, START_ANTS = 5, EGG_TIME = 6, CACHE_FOOD = 3;

function rng(seed) { let a = seed >>> 0 || 1; const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; f.state = () => a; return f; }
export const idx = (x, y) => y * COLS + x;
const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
// The surface strip is row -1. It is walkable along its whole width; it meets the nest only at the entrance.
export const walkable = (s, x, y) => y === -1 ? x >= 0 && x < COLS : inside(x, y) && s.kind[idx(x, y)] === OPEN;
const N4 = [[0, 1], [-1, 0], [1, 0], [0, -1]];

export function create(seed = 1) {
  const r = rng(seed);
  const s = {
    seed, r, t: 0, tick: 0, E: 0, kind: new Array(COLS * ROWS).fill(EARTH), water: new Array(COLS * ROWS).fill(0), mark: new Array(COLS * ROWS).fill(0),
    room: null, roomDone: false, ants: [], queen: null, food: 2, delivered: 0, eggs: [], mound: 0, seeds: [], loose: [], pellets: [], nextId: 1, events: [],
    over: false, result: null, queenWet: false, foodWet: false, pocketBroken: false, lostOutside: 0, lostWater: 0, hatched: 0, dug: 0, seedT: 0, claim: new Map(),
  };
  generate(s);
  return s;
}

function generate(s) {
  const r = s.r, E = s.E = 4 + Math.floor(r() * 6); // entrance column 4..9
  const set = (x, y, k) => { if (inside(x, y)) s.kind[idx(x, y)] = k; };
  const free = (x, y) => x !== E && !(y <= 3 && x >= E - 1 && x <= E + 2); // keep the entrance column and the first room clear
  // hard clay in a few flat lenses
  for (let n = 0; n < 4; n++) {
    const cx = r() * COLS, cy = 4 + r() * 15, rx = 1.5 + r() * 3, ry = 0.6 + r() * 1.1;
    for (let y = 1; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, CLAY);
  }
  // stones: single cells and pairs
  for (let n = 0, want = 9 + Math.floor(r() * 4), tries = 0; n < want && tries < 200; tries++) {
    const x = Math.floor(r() * COLS), y = 2 + Math.floor(r() * (ROWS - 2)), pair = r() < 0.4, x2 = x + 1;
    if (!free(x, y) || (pair && (x2 >= COLS || !free(x2, y)))) continue;
    set(x, y, STONE); if (pair) set(x2, y, STONE); n++;
  }
  // one water pocket of three cells, not next to the entrance column
  for (let tries = 0; tries < 100; tries++) {
    const x = Math.floor(r() * (COLS - 1)), y = 7 + Math.floor(r() * 8);
    if (Math.abs(x - E) < 2 || Math.abs(x + 1 - E) < 2) continue;
    set(x, y, POCKET); set(x + 1, y, POCKET); set(x, y + 1, POCKET); break;
  }
  // three caches of buried seeds
  for (let n = 0, tries = 0; n < 3 && tries < 200; tries++) {
    const x = Math.floor(r() * COLS), y = 4 + Math.floor(r() * 13), k = s.kind[idx(x, y)];
    if (!free(x, y) || k === STONE || k === POCKET || k === SEEDS) continue;
    let nearPocket = false; for (const [dx, dy] of N4) if (inside(x + dx, y + dy) && s.kind[idx(x + dx, y + dy)] === POCKET) nearPocket = true;
    if (nearPocket) continue;
    set(x, y, SEEDS); n++;
  }
  for (let y = 0; y < ROWS; y++) if (s.kind[idx(E, y)] !== CLAY) set(E, y, EARTH);
  // the entrance, a short way down and a small first room for the queen
  for (const [x, y] of [[E, 0], [E, 1], [E, 2], [E + 1, 2]]) set(x, y, OPEN);
  s.queen = { x: E + 1, y: 2, cx: E + 1, cy: 2, path: [], home: [E + 1, 2], ph: 0 };
  for (let i = 0; i < START_ANTS; i++) {
    const [x, y] = [[E, 2], [E + 1, 2], [E, 1], [E - 1, -1], [E + 1, -1]][i];
    addAnt(s, x, y);
  }
  for (let i = 0; i < 3; i++) spawnSeed(s);
}

function addAnt(s, x, y) {
  const r = s.r;
  s.ants.push({ id: s.nextId++, x, y, cx: x, cy: y, path: [], task: 'idle', tgt: null, carry: null, hunger: r() * 0.3, tired: r() * 0.2, think: 'Looking around', work: 0, wait: 0, wet: 0, idleT: 1.2 + r() * 0.25, face: 0, ph: r() * 6, eat: false });
}

export const moundX = s => s.E >= 2 ? s.E - 1 : s.E + 1;
function spawnSeed(s) {
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.floor(s.r() * COLS);
    if (x === s.E || x === moundX(s) || s.seeds.some(q => q.x === x)) continue;
    s.seeds.push({ id: s.nextId++, x, y: -1 }); return;
  }
}

// ---------- player input
// Mark (on = true) or unmark one soil cell. Row 0 is turf and cannot be dug; stone cannot be dug.
export function setMark(s, x, y, on) {
  if (s.over || !inside(x, y) || y < 1) return false;
  const i = idx(x, y), k = s.kind[i];
  if (k === OPEN || k === STONE || k === POCKET) return false; // water is let out by digging next to it
  if (on && !s.mark[i]) { s.mark[i] = 1; return true; }
  if (!on && s.mark[i]) { if (s.mark[i] === 2) return false; s.mark[i] = 0; return true; }
  return false;
}
export const roomCells = (x, y) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
// Place the queen's room: 2 by 2 cells with its top-left at (x, y). Moving it clears the old marks that are not dug yet.
export function placeRoom(s, x, y) {
  if (s.over || s.roomDone) return false;
  x = Math.max(0, Math.min(COLS - 2, x)); y = Math.max(1, Math.min(ROWS - 2, y));
  const cells = roomCells(x, y);
  if (cells.some(([cx, cy]) => { const k = s.kind[idx(cx, cy)]; return k === STONE || k === POCKET; })) return false;
  for (let i = 0; i < s.mark.length; i++) if (s.mark[i] === 2) s.mark[i] = 0;
  s.room = { x, y };
  for (const [cx, cy] of cells) if (s.kind[idx(cx, cy)] !== OPEN) s.mark[idx(cx, cy)] = 2;
  checkRoom(s);
  return true;
}
function checkRoom(s) {
  if (!s.room || s.roomDone) return;
  if (roomCells(s.room.x, s.room.y).every(([x, y]) => s.kind[idx(x, y)] === OPEN)) {
    s.roomDone = true;
    const home = [s.room.x, s.room.y + 1], q = s.queen;
    q.home = home; q.path = pathTo(search(s, q.cx, q.cy), home) || [];
    s.events.push({ t: 'room' });
  }
}

// ---------- paths: breadth-first over open cells and the surface strip
const NODE = (x, y) => (y + 1) * COLS + x;
export function search(s, sx, sy) {
  const n = (ROWS + 1) * COLS, dist = new Int16Array(n).fill(-1), prev = new Int16Array(n).fill(-1), q = [NODE(sx, sy)];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % COLS, y = Math.floor(c / COLS) - 1;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (ny < -1 || !walkable(s, nx, ny)) continue;
      const m = NODE(nx, ny); if (dist[m] >= 0) continue;
      dist[m] = dist[c] + 1; prev[m] = c; q.push(m);
    }
  }
  return { dist, prev };
}
const distTo = (S, [x, y]) => S.dist[NODE(x, y)];
function pathTo(S, [x, y]) {
  let c = NODE(x, y); if (S.dist[c] < 0) return null;
  const out = [];
  while (S.prev[c] >= 0) { out.push([c % COLS, Math.floor(c / COLS) - 1]); c = S.prev[c]; }
  return out.reverse();
}

// ---------- what an ant can see when it decides
export const waterAt = (s, x, y) => inside(x, y) ? s.water[idx(x, y)] : 0;
const wetNear = (s, x, y) => N4.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return inside(nx, ny) && s.water[idx(nx, ny)] > 0.2; });
// A marked cell is work for an ant when a cell next to it is open and the ant can walk there.
export function marksFor(s, S) {
  const out = { work: [], cut: 0, wet: 0, taken: 0, any: 0 };
  for (let i = 0; i < s.mark.length; i++) {
    if (!s.mark[i]) continue;
    out.any++;
    const x = i % COLS, y = Math.floor(i / COLS);
    let best = null, bd = 1e9;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (ny < 0 || !walkable(s, nx, ny)) continue; const d = S ? distTo(S, [nx, ny]) : 0; if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; } }
    if (!best) { out.cut++; continue; }
    if (wetNear(s, x, y) || waterAt(s, ...best) > 0.2) { out.wet++; continue; }
    if (s.claim.has(i)) { out.taken++; out.claimedReach = true; continue; }
    out.work.push({ i, x, y, at: best, d: bd });
  }
  return out;
}
export const touching = (s, x, y) => N4.some(([dx, dy]) => walkable(s, x + dx, y + dy) && y + dy >= 0);

function release(s, a) { for (const [i, id] of s.claim) if (id === a.id) s.claim.delete(i); for (const q of s.seeds) if (q.by === a.id) q.by = 0; for (const q of s.loose) if (q.by === a.id) q.by = 0; for (const q of s.pellets) if (q.by === a.id) q.by = 0; }
const go = (a, task, S, cell, think, tgt = null) => { a.task = task; a.path = pathTo(S, cell) || []; a.think = think; a.tgt = tgt; a.work = 0; a.wait = 0; };

function decide(s, a) {
  release(s, a);
  const S = search(s, a.cx, a.cy), home = s.queen.home, warn = s.t >= RAIN_AT - WARN, here = waterAt(s, a.cx, a.cy);
  a.idleT = 0;
  // water at my feet: climb to the nearest dry cell inside
  if (a.cy >= 0 && here >= 0.3) {
    const dry = dryCell(s, a, S);
    if (dry) return go(a, 'flee', S, dry, 'Water! Climbing to dry ground', dry);
    a.task = 'stuck'; a.path = []; a.think = 'Nowhere dry to go'; return;
  }
  if (warn) {
    if (a.carry === 'soil') a.carry = null; // drops the pellet and runs
    if (s.t >= RAIN_AT && a.cy >= 0 && waterAt(s, ...home) >= 0.3) {
      const dry = dryCell(s, a, S);
      if (dry) { if (dry[0] === a.cx && dry[1] === a.cy) { a.task = 'shelter'; a.path = []; a.think = 'Staying dry'; return; } return go(a, 'flee', S, dry, 'Home is flooding. Climbing up', dry); }
    }
    if (a.carry === 'seed' && distTo(S, home) >= 0 && !(a.cx === home[0] && a.cy === home[1])) return go(a, 'store', S, home, 'Rain is coming. Taking a seed in');
    const spot = restSpot(s, a, S);
    if (a.cx === spot[0] && a.cy === spot[1]) { a.task = 'shelter'; a.path = []; a.think = s.t < RAIN_AT ? 'Rain is coming. Staying in' : 'Waiting out the rain'; return; }
    if (distTo(S, spot) >= 0) return go(a, 'shelter', S, spot, 'Rain is coming. Going in', spot);
    a.task = 'shelter'; a.path = []; a.think = 'Waiting out the rain'; return;
  }
  if (a.carry === 'soil') return go(a, 'haul', S, [moundX(s), -1], 'Carrying soil out');
  if (a.carry === 'seed') return go(a, 'store', S, home, 'Carrying a seed home');
  const M = marksFor(s, S), hungry = a.hunger > 0.7, tired = a.tired > 0.75, hasWork = M.work.length > 0;
  if (hungry) {
    if (s.food > 0 && distTo(S, home) >= 0) return go(a, 'eat', S, home, hasWork ? 'Too hungry to dig. Going to eat' : 'Hungry. Going to eat');
    const f = foodTarget(s, S); if (f) { f.item.by = a.id; a.eat = true; return go(a, 'forage', S, f.at, hasWork ? 'Too hungry to dig. Finding food' : 'Hungry. Finding food', f.item); }
  }
  if (tired && distTo(S, home) >= 0) { const spot = restSpot(s, a, S); return go(a, 'rest', S, spot, hasWork ? 'Too tired to dig. Resting' : 'Tired. Resting', spot); }
  let dig = null; for (const m of M.work) if (!dig || m.d < dig.d) dig = m;
  const f = foodTarget(s, S), p = pelletTarget(s, S);
  const uDig = dig ? 1.2 - 0.02 * dig.d - 0.4 * a.tired - 0.3 * a.hunger : -1;
  const uFood = f ? (s.food < 3 ? 1.0 : 0.45) + (f.loose ? 0.35 : 0) - 0.015 * f.d : -1;
  const uHaul = p ? 0.8 + Math.min(0.3, s.pellets.length * 0.05) - 0.015 * p.d - 0.2 * a.tired : -1;
  if (p && uHaul > uDig && uHaul >= uFood) { p.item.by = a.id; return go(a, 'fetch', S, p.at, 'Fetching loose soil to carry out', p.item); }
  if (dig && uDig >= uFood) { s.claim.set(dig.i, a.id); return go(a, 'dig', S, dig.at, s.kind[dig.i] === CLAY ? 'Digging hard clay' : s.kind[dig.i] === SEEDS ? 'Digging toward buried seeds' : 'Digging', dig.i); }
  if (f) { f.item.by = a.id; a.eat = false; return go(a, 'forage', S, f.at, f.loose ? 'Fetching seeds from the dig' : 'Going out for seeds', f.item); }
  // nothing to do; say why
  a.task = 'idle'; a.path = [];
  a.think = M.any === 0 ? 'Nothing to dig. Draw where to dig' : M.cut === M.any ? 'Cannot reach the marks. They must touch a tunnel'
    : M.wet && !M.taken ? 'Too dangerous: water there' : M.taken ? 'Others are digging. Waiting' : 'Nothing to do';
}

// Ants rest and shelter in the queen's room, spread over its four cells; before it is dug, in the first room.
function restSpot(s, a, S) {
  const cells = s.roomDone ? roomCells(s.room.x, s.room.y) : [s.queen.home, [s.E, 2]];
  let best = null, bn = 1e9;
  for (const c of cells) {
    if (distTo(S, c) < 0) continue;
    const n = s.ants.reduce((k, b) => k + (b !== a && ((b.tgt && b.tgt[0] === c[0] && b.tgt[1] === c[1] && (b.task === 'rest' || b.task === 'shelter')) || (!b.path.length && b.cx === c[0] && b.cy === c[1])) ? 1 : 0), 0);
    if (n < bn) { bn = n; best = c; }
  }
  return best || s.queen.home;
}
// The nearest dry cell inside, avoiding cells other ants already crowd.
function dryCell(s, a, S) {
  let best = null, bs = 1e9;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const d = S.dist[NODE(x, y)]; if (d < 0 || s.water[idx(x, y)] >= 0.15) continue;
    const n = s.ants.reduce((k, b) => k + (b !== a && ((b.tgt && b.tgt[0] === x && b.tgt[1] === y && b.task === 'flee') || (b.cx === x && b.cy === y && !b.path.length)) ? 1 : 0), 0);
    const sc = d + n * 1.5; if (sc < bs) { bs = sc; best = [x, y]; }
  }
  return best;
}
function pelletTarget(s, S) {
  let best = null;
  for (const q of s.pellets) if (!q.by) { const d = distTo(S, [q.x, q.y]); if (d >= 0 && (!best || d < best.d)) best = { item: q, at: [q.x, q.y], d }; }
  return best;
}
function foodTarget(s, S) {
  let best = null;
  for (const q of s.loose) if (!q.by) { const d = distTo(S, [q.x, q.y]); if (d >= 0 && (!best || d < best.d)) best = { item: q, at: [q.x, q.y], d, loose: true }; }
  if (best) return best;
  for (const q of s.seeds) if (!q.by) { const d = distTo(S, [q.x, -1]); if (d >= 0 && (!best || d < best.d)) best = { item: q, at: [q.x, -1], d, loose: false }; }
  return best;
}

// ---------- the step
export function step(s) {
  s.events.length = 0;
  if (s.over) return s;
  s.t = Math.round((s.t + DT) * 1000) / 1000; s.tick++;
  const raining = s.t >= RAIN_AT && s.t < RAIN_AT + RAIN_FOR;
  if (s.t < RAIN_AT - WARN && (s.seedT += DT) >= 4) { s.seedT = 0; if (s.seeds.length < 3) spawnSeed(s); }
  if (s.t >= RAIN_AT - WARN && s.t - DT < RAIN_AT - WARN) { s.events.push({ t: 'warn' }); for (const a of s.ants) decide(s, a); }
  if (s.t >= RAIN_AT && s.t - DT < RAIN_AT) s.events.push({ t: 'rain' });
  if (s.t >= RAIN_AT + RAIN_FOR && s.t - DT < RAIN_AT + RAIN_FOR) s.events.push({ t: 'dry' });
  moveQueen(s);
  for (const a of s.ants.slice()) ant(s, a, raining);
  if (raining) { const e = idx(s.E, 0); s.water[e] = Math.min(1, s.water[e] + RAIN_RATE * DT); }
  flow(s); flow(s);
  // the queen and the food store
  const q = s.queen, qw = waterAt(s, q.cx, q.cy);
  if (!s.queenWet && qw >= 0.6) { s.queenWet = true; s.events.push({ t: 'queenWet' }); }
  if (!s.foodWet && s.food > 0 && waterAt(s, ...q.home) >= 0.5) { s.foodWet = true; s.events.push({ t: 'foodWet' }); }
  for (let i = s.eggs.length - 1; i >= 0; i--) {
    if (s.queenWet) { s.eggs.splice(i, 1); continue; }
    if (s.t >= s.eggs[i]) { s.eggs.splice(i, 1); if (s.ants.length < MAX_ANTS) { addAnt(s, q.cx, q.cy); s.hatched++; s.events.push({ t: 'hatch', x: q.cx, y: q.cy }); } }
  }
  if (s.t >= END_AT) finish(s);
  return s;
}

function moveQueen(s) {
  const q = s.queen;
  if (!q.path.length) return;
  const [nx, ny] = q.path[0], dx = nx - q.x, dy = ny - q.y, d = Math.hypot(dx, dy), sp = QUEEN_SPEED * DT;
  q.ph += sp * 3; q.face = Math.atan2(dy, dx);
  if (d <= sp) { q.x = nx; q.y = ny; q.cx = nx; q.cy = ny; q.path.shift(); } else { q.x += dx / d * sp; q.y += dy / d * sp; }
}

function ant(s, a, raining) {
  const outside = a.cy === -1, w = waterAt(s, a.cx, a.cy);
  a.hunger = Math.min(1, a.hunger + DT / 80);
  // rain and water
  if (raining && outside) a.wet += DT;
  else if (!outside && w >= 0.6) a.wet += DT;
  else a.wet = Math.max(0, a.wet - DT);
  if (a.wet > 3) {
    release(s, a); s.ants.splice(s.ants.indexOf(a), 1);
    if (outside) s.lostOutside++; else s.lostWater++;
    s.events.push({ t: 'lost', x: a.cx, y: a.cy, outside }); return;
  }
  if (!outside && w >= 0.3 && a.task !== 'flee' && a.task !== 'stuck') decide(s, a);
  if (a.task === 'stuck' && (a.idleT += DT) > 1) decide(s, a);
  if (a.path.length) {
    const [nx, ny] = a.path[0], dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy);
    const sp = SPEED * DT * (w > 0.3 ? 0.5 : 1) * (a.hunger >= 1 ? 0.6 : 1) * (a.carry ? 0.85 : 1);
    a.face = Math.atan2(dy, dx); a.ph += sp * 2.2; a.tired = Math.min(1, a.tired + DT / 160);
    if (d <= sp) { a.x = nx; a.y = ny; a.cx = nx; a.cy = ny; a.path.shift(); } else { a.x += dx / d * sp; a.y += dy / d * sp; }
    return;
  }
  arrive(s, a);
}

function arrive(s, a) {
  const home = s.queen.home, atHome = a.cx === home[0] && a.cy === home[1];
  switch (a.task) {
    case 'dig': {
      const i = a.tgt;
      if (!s.mark[i] || s.kind[i] === OPEN) return decide(s, a);
      const x = i % COLS, y = Math.floor(i / COLS);
      a.face = Math.atan2(y - a.cy, x - a.cx); a.ph += DT * 9;
      a.tired = Math.min(1, a.tired + DT / 30);
      if ((a.work += DT) < DIG_TIME[s.kind[i]]) return;
      const was = s.kind[i];
      s.kind[i] = OPEN; s.mark[i] = 0; s.claim.delete(i); s.dug++;
      s.pellets.push({ id: s.nextId++, x: a.cx, y: a.cy, by: 0 }); // the dug soil waits here for a carrier
      if (was === SEEDS) { for (let k = 0; k < CACHE_FOOD; k++) s.loose.push({ id: s.nextId++, x, y }); s.events.push({ t: 'cache', x, y }); }
      s.events.push({ t: 'dig', x, y, clay: was === CLAY });
      for (const [dx, dy] of N4) if (inside(x + dx, y + dy) && s.kind[idx(x + dx, y + dy)] === POCKET) breach(s, x + dx, y + dy);
      checkRoom(s);
      return decide(s, a);
    }
    case 'fetch': {
      const q = a.tgt;
      if (q && s.pellets.includes(q) && q.x === a.cx && q.y === a.cy) { s.pellets.splice(s.pellets.indexOf(q), 1); a.carry = 'soil'; }
      return decide(s, a);
    }
    case 'haul': if (a.cy === -1 && a.cx === moundX(s)) { a.carry = null; s.mound++; s.events.push({ t: 'drop', x: a.cx }); } return decide(s, a);
    case 'forage': {
      const q = a.tgt, list = q && (s.loose.includes(q) ? s.loose : s.seeds.includes(q) ? s.seeds : null);
      if (list && q.x === a.cx && q.y === a.cy) {
        list.splice(list.indexOf(q), 1);
        if (a.eat) { a.hunger = 0.05; a.think = 'Ate a seed'; s.events.push({ t: 'eat' }); } else { a.carry = 'seed'; s.events.push({ t: 'pick' }); }
      }
      return decide(s, a);
    }
    case 'store':
      if (atHome && a.carry === 'seed') {
        a.carry = null; s.food++; s.delivered++; s.events.push({ t: 'store' });
        if (s.roomDone && s.delivered % 3 === 0 && s.ants.length + s.eggs.length < MAX_ANTS && !s.queenWet) { s.eggs.push(s.t + EGG_TIME); s.events.push({ t: 'egg' }); }
      }
      return decide(s, a);
    case 'eat':
      if (atHome && s.food > 0) { s.food--; a.hunger = 0.05; a.think = 'Ate from the store'; s.events.push({ t: 'eat' }); }
      return decide(s, a);
    case 'rest':
      a.tired = Math.max(0, a.tired - DT / 4); a.think = 'Resting';
      if (a.tired < 0.08) decide(s, a);
      return;
    case 'flee': a.task = 'shelter'; a.think = 'Staying dry'; return;
    case 'shelter': if ((a.idleT += DT) > 1) decide(s, a); return;
    default: if ((a.idleT += DT) > 1.5) decide(s, a);
  }
}

// Opening a cell next to the water pocket lets all of it out.
function breach(s, x, y) {
  const st = [[x, y]];
  while (st.length) {
    const [cx, cy] = st.pop(), i = idx(cx, cy);
    if (!inside(cx, cy) || s.kind[i] !== POCKET) continue;
    s.kind[i] = OPEN; s.water[i] = 1; s.mark[i] = 0;
    for (const [dx, dy] of N4) st.push([cx + dx, cy + dy]);
  }
  s.pocketBroken = true; s.pocketRow = y; s.events.push({ t: 'breach', x, y });
}

// Water falls down when it can, else spreads sideways on a floor. It never climbs.
function flow(s) {
  const w = s.water, k = s.kind, open = i => k[i] === OPEN;
  for (let y = ROWS - 2; y >= 0; y--) for (let x = 0; x < COLS; x++) {
    const i = idx(x, y), b = i + COLS;
    if (w[i] > 0 && open(b) && w[b] < 1) { const m = Math.min(w[i], 1 - w[b]); w[i] -= m; w[b] += m; }
  }
  const dir = s.tick % 2;
  for (let y = 0; y < ROWS; y++) for (let j = 0; j < COLS - 1; j++) {
    const x = dir ? j : COLS - 2 - j, i = idx(x, y), n = i + 1;
    if (!open(i) || !open(n)) continue;
    const sup = c => y === ROWS - 1 || !open(c + COLS) || w[c + COLS] > 0.98, d = w[i] - w[n];
    if (d > 0.002 && sup(i)) { const m = d * 0.45; w[i] -= m; w[n] += m; }
    else if (d < -0.002 && sup(n)) { const m = -d * 0.45; w[n] -= m; w[i] += m; }
  }
}

export const SCORE = { ant: 10, food: 2, queen: 50 };
function finish(s) {
  s.over = true;
  const queen = !s.queenWet, food = s.foodWet ? 0 : s.food, ants = s.ants.length;
  const score = ants * SCORE.ant + food * SCORE.food + (queen ? SCORE.queen : 0);
  const room = s.room && s.roomDone, lowest = room && lowestOpenRow(s) <= s.room.y + 1;
  let why;
  if (!queen) {
    if (s.dug === 0) why = 'Nothing was dug, so the rain filled the only room.';
    else if (s.pocketBroken && s.queen.cy > pocketRow(s)) why = 'The water pocket you dug into ran down and flooded the queen.';
    else if (room && lowest) why = "The queen's room was the lowest part of the nest, so the rain filled it.";
    else if (!room) why = "The queen stayed in her small first room, and there was not enough tunnel below it to hold the rain.";
    else why = "There was not enough tunnel below the queen's room to hold the rain.";
  } else if (s.lostOutside) why = `${s.lostOutside} ${s.lostOutside === 1 ? 'ant was' : 'ants were'} caught outside in the rain.`;
  else if (s.lostWater) why = `${s.lostWater} ${s.lostWater === 1 ? 'ant was' : 'ants were'} washed out of low tunnels.`;
  else if (!room) why = "Everyone stayed dry, but without a queen's room she laid no eggs.";
  else if (s.foodWet) why = 'The queen was safe, but the food store got wet.';
  else why = 'Everything stayed dry. The rain ran into the low tunnels, away from the queen.';
  s.result = { score, queen, food, ants, hatched: s.hatched, why, win: queen };
  s.events.push({ t: 'end' });
}
function lowestOpenRow(s) { let m = 0; for (let i = 0; i < s.kind.length; i++) if (s.kind[i] === OPEN) m = Math.max(m, Math.floor(i / COLS)); return m; }
function pocketRow(s) { return s.pocketRow ?? ROWS; }

// A short fingerprint of everything that matters, for determinism checks.
export function hash(s) {
  const parts = [s.t, s.r.state(), s.kind.join(''), s.water.map(v => v.toFixed(6)).join(','), s.mark.join(''), s.food, s.mound, s.delivered, s.eggs.join(','),
    s.ants.map(a => [a.id, a.x.toFixed(4), a.y.toFixed(4), a.task, a.carry, a.hunger.toFixed(4), a.tired.toFixed(4)].join(':')).join('|'),
    s.queen.x.toFixed(4), s.queen.y.toFixed(4), s.seeds.map(q => q.x).join(','), s.loose.length, s.pellets.map(q => q.x + ',' + q.y).join(';')];
  let h = 2166136261; const str = parts.join('#');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
