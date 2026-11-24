// The world of one room: ants, food, four colonies, rounds. Pure and deterministic: no clock, no network, no
// Math.random. The Durable Object, the bots, the tests and the load bench all drive it through the same calls:
// addAnt, removeAnt, setInput, step. Everything is measured in ticks.
import * as C from '../public/crumbwar/shared/config.js';
import { stepMove } from '../public/crumbwar/shared/move.js';

export const ROUND_TICKS = 6 * 60 * C.TICK_HZ;
export const BREAK_TICKS = 12 * C.TICK_HZ;
export const MAX_ANTS = 250; // ids are one byte; 255 means "nobody"
const BITE_RANGE = 32, BITE_ARC = Math.cos(70 * Math.PI / 180), BITE_EVERY = 10;
const RESPAWN = 3 * C.TICK_HZ, PROTECT = 2 * C.TICK_HZ, PICK_R = 22;
const CELL = 200, GRID = Math.ceil(C.WORLD / CELL);
const FCELL = 100, FGRID = Math.ceil(C.WORLD / FCELL);

// mulberry32: small, fast, good enough for spawn points and bot noise.
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = s + 0x6D2B79F5 >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createWorld(seed) {
  const w = {
    tick: 0, rand: rng(seed), ants: new Array(MAX_ANTS).fill(null), count: 0,
    colonyScore: [0, 0, 0, 0], roundEnd: ROUND_TICKS, breakUntil: 0, lastWinner: -1, round: 1,
    fx: new Float32Array(C.MAX_FOOD), fy: new Float32Array(C.MAX_FOOD), fkind: new Uint8Array(C.MAX_FOOD),
    fgen: new Uint16Array(C.MAX_FOOD), foodCount: 0, freeFood: [], foodSpread: 360,
    fgrid: Array.from({ length: FGRID * FGRID }, () => []), grid: Array.from({ length: GRID * GRID }, () => []),
    events: [], // [type, a, b] for this tick only: 1 kill (killer, victim), 2 round over (winner), 3 round start
  };
  for (let i = C.MAX_FOOD - 1; i >= 0; i--) w.freeFood.push(i);
  return w;
}

const fcell = (x, y) => Math.min(FGRID - 1, x / FCELL | 0) + Math.min(FGRID - 1, y / FCELL | 0) * FGRID;
const cell = (x, y) => Math.min(GRID - 1, x / CELL | 0) + Math.min(GRID - 1, y / CELL | 0) * GRID;

export function addFood(w, x, y, kind) {
  if (!w.freeFood.length) return -1;
  const id = w.freeFood.pop();
  x = Math.min(C.WORLD - 12, Math.max(12, x)); y = Math.min(C.WORLD - 12, Math.max(12, y));
  w.fx[id] = x; w.fy[id] = y; w.fkind[id] = kind; w.fgen[id] = w.fgen[id] + 1 & 0xffff; w.foodCount++;
  w.fgrid[fcell(x, y)].push(id);
  return id;
}
function takeFood(w, id) {
  const list = w.fgrid[fcell(w.fx[id], w.fy[id])];
  list[list.indexOf(id)] = list[list.length - 1]; list.pop();
  w.fkind[id] = 0; w.foodCount--; w.freeFood.push(id);
}
// Calls back with each food id inside the square around (x, y). Used for pickup, bots and client views.
export function foodNear(w, x, y, half, each) {
  const x0 = Math.max(0, (x - half) / FCELL | 0), x1 = Math.min(FGRID - 1, (x + half) / FCELL | 0);
  const y0 = Math.max(0, (y - half) / FCELL | 0), y1 = Math.min(FGRID - 1, (y + half) / FCELL | 0);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const list = w.fgrid[cx + cy * FGRID];
    for (let i = 0; i < list.length; i++) { const id = list[i]; if (Math.abs(w.fx[id] - x) <= half && Math.abs(w.fy[id] - y) <= half) each(id); }
  }
}
// Calls back with each living ant inside the square. The grid is rebuilt in every step, after movement.
export function antsNear(w, x, y, half, each) {
  const x0 = Math.max(0, (x - half) / CELL | 0), x1 = Math.min(GRID - 1, (x + half) / CELL | 0);
  const y0 = Math.max(0, (y - half) / CELL | 0), y1 = Math.min(GRID - 1, (y + half) / CELL | 0);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const list = w.grid[cx + cy * GRID];
    for (let i = 0; i < list.length; i++) { const a = list[i]; if (a.alive && Math.abs(a.x - x) <= half && Math.abs(a.y - y) <= half) each(a); }
  }
}

function place(w, a) {
  const [nx, ny] = C.NESTS[a.colony], r = 40 * Math.sqrt(w.rand()), t = w.rand() * Math.PI * 2;
  a.x = nx + Math.cos(t) * r; a.y = ny + Math.sin(t) * r;
  a.heading = Math.atan2(C.WORLD / 2 - ny, C.WORLD / 2 - nx); a.heading -= Math.floor(a.heading / (Math.PI * 2)) * Math.PI * 2;
  a.hp = C.TIER_HP[a.tier]; a.carry = 0; a.stamina = C.STAMINA; a.alive = true; a.protectUntil = w.tick + PROTECT; a.hurtAt = -999;
}

export function addAnt(w, colony, bot, nameA, nameB) {
  const id = w.ants.indexOf(null);
  if (id < 0) return null;
  const a = {
    id, colony, bot, nameA, nameB, x: 0, y: 0, heading: 0, hp: 0, tier: 0, carry: 0, stamina: 0, alive: true,
    respawnAt: 0, protectUntil: 0, biteAt: 0, hurtAt: -999, score: 0, delivered: 0, kills: 0, deaths: 0,
    angle: 0, move: false, sprint: false, inputTick: 0, // inputTick: the tick the current input first applied to
  };
  place(w, a); w.ants[id] = a; w.count++;
  return a;
}
export function removeAnt(w, a) {
  if (w.ants[a.id] !== a) return;
  if (a.alive && a.carry) addFood(w, a.x, a.y, a.carry);
  a.alive = false; w.ants[a.id] = null; w.count--;
}
// Input is three small values. Whatever a client sends, this is all it can change about the world.
export function setInput(w, a, angle, move, sprint) {
  a.angle = angle & 255; a.move = !!move; a.sprint = !!sprint; a.inputTick = w.tick;
}

function kill(w, a, killer) {
  if (a.carry) addFood(w, a.x, a.y, a.carry);
  a.alive = false; a.carry = 0; a.deaths++; a.respawnAt = w.tick + RESPAWN; a.delivered = 0;
  if (killer) { killer.kills++; killer.score += 2 + a.tier; }
  a.tier = Math.max(0, a.tier - 1);
  w.events.push([1, killer ? killer.id : 255, a.id]);
}
function hurt(w, a, by, killer) {
  a.hp -= by; a.hurtAt = w.tick;
  if (a.hp <= 0) kill(w, a, killer);
}

function spawnFood(w) {
  // Small rooms share one patch. Crowded rooms forage farther out.
  const spread = Math.min(C.WORLD - 300, Math.max(360, (w.count - 32) * 24));
  if (spread < w.foodSpread) {
    const half = spread / 2 + 70;
    for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id] && (Math.abs(w.fx[id] - C.WORLD / 2) > half || Math.abs(w.fy[id] - C.WORLD / 2) > half)) takeFood(w, id);
  }
  w.foodSpread = spread;
  const target = Math.min(C.MAX_FOOD - 40, Math.max(150, w.count * 7));
  if (w.foodCount >= target) return;
  const x = C.WORLD / 2 + (w.rand() - 0.5) * spread, y = C.WORLD / 2 + (w.rand() - 0.5) * spread;
  for (const [nx, ny] of C.NESTS) if (Math.hypot(x - nx, y - ny) < C.NEST_R + 120) return; // none on a doorstep
  const n = 7 + (w.rand() * 8 | 0);
  for (let i = 0; i < n; i++) { const r = 70 * Math.sqrt(w.rand()), t = w.rand() * Math.PI * 2; addFood(w, x + Math.cos(t) * r, y + Math.sin(t) * r, 1); }
  if (Math.abs(x - C.WORLD / 2) < C.WORLD / 5 && Math.abs(y - C.WORLD / 2) < C.WORLD / 5 && w.rand() < 0.5) addFood(w, x, y, 2);
}

function newRound(w) {
  w.colonyScore = [0, 0, 0, 0]; w.round++; w.roundEnd = w.tick + ROUND_TICKS; w.breakUntil = 0;
  for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id]) takeFood(w, id);
  for (const a of w.ants) if (a) { a.score = 0; a.delivered = 0; a.kills = 0; a.deaths = 0; a.tier = 0; place(w, a); }
  w.events.push([3, 0, 0]);
}

export function step(w) {
  w.tick++; w.events.length = 0;
  const inBreak = w.breakUntil > 0;
  if (inBreak && w.tick >= w.breakUntil) newRound(w);
  else if (!inBreak && w.tick >= w.roundEnd) {
    w.lastWinner = w.colonyScore.indexOf(Math.max(...w.colonyScore)); w.breakUntil = w.tick + BREAK_TICKS;
    w.events.push([2, w.lastWinner, 0]);
  }
  if (!inBreak) spawnFood(w);
  for (const a of w.ants) {
    if (!a) continue;
    if (!a.alive) { if (w.tick >= a.respawnAt) place(w, a); continue; }
    stepMove(a, a.angle, a.move, a.sprint);
    const [nx, ny] = C.NESTS[a.colony], home = Math.hypot(a.x - nx, a.y - ny);
    if (a.carry && home < C.DROP_R && !inBreak) {
      const v = C.FOOD_VALUE[a.carry];
      a.carry = 0; a.score += v; a.delivered += v; w.colonyScore[a.colony] += v;
      while (a.tier < 3 && a.delivered >= C.TIER_AT[a.tier]) { a.tier++; a.hp = C.TIER_HP[a.tier]; }
    }
    if (!a.carry && !inBreak) {
      let best = -1, bd = PICK_R * PICK_R;
      foodNear(w, a.x, a.y, PICK_R, id => { const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2; if (d < bd) { bd = d; best = id; } });
      if (best >= 0) { a.carry = w.fkind[best]; takeFood(w, best); }
    }
    const max = C.TIER_HP[a.tier];
    if (a.hp < max && w.tick - a.hurtAt > 60 && w.tick % (home < C.NEST_R ? 10 : 80) === 0) a.hp++;
    if (w.tick % 10 === 0) for (let c = 0; c < C.COLONIES; c++) {
      if (c !== a.colony && Math.hypot(a.x - C.NESTS[c][0], a.y - C.NESTS[c][1]) < C.NEST_R) { hurt(w, a, 1, null); break; }
    }
  }
  for (const list of w.grid) list.length = 0;
  for (const a of w.ants) if (a && a.alive) w.grid[cell(a.x, a.y)].push(a);
  // Bites use positions after everyone moved. All bites of a tick are chosen first and land together, so two
  // ants that bite each other on the same tick both take the damage and a low id is no advantage. An ant that
  // is carrying, or still protected after a respawn, does not bite; a protected ant or one at home is not bitten.
  if (!inBreak) {
    const bites = [];
    for (const a of w.ants) {
      if (!a || !a.alive || a.carry || w.tick < a.biteAt || w.tick < a.protectUntil) continue;
      let target = null, bd = BITE_RANGE * BITE_RANGE;
      const hx = Math.cos(a.heading), hy = Math.sin(a.heading);
      antsNear(w, a.x, a.y, BITE_RANGE, b => {
        if (b.colony === a.colony || w.tick < b.protectUntil) return;
        const dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
        if (d >= bd || dx * hx + dy * hy < BITE_ARC * Math.sqrt(d)) return;
        if (Math.hypot(b.x - C.NESTS[b.colony][0], b.y - C.NESTS[b.colony][1]) < C.NEST_R) return;
        bd = d; target = b;
      });
      if (target) { a.biteAt = w.tick + BITE_EVERY; bites.push(a, target); }
    }
    for (let i = 0; i < bites.length; i += 2) if (bites[i + 1].alive) hurt(w, bites[i + 1], C.TIER_BITE[bites[i].tier], bites[i]);
  }
}
