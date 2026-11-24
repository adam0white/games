// The world of one room: ants, food, four colonies, rounds. Pure and deterministic: no clock, no network, no
// Math.random. The Durable Object, the bots, the tests and the load bench all drive it through the same calls:
// addAnt, removeAnt, setInput, step. Everything is measured in ticks.
import * as C from '../public/crumbwar/shared/config.js';
import classic from './modes/classic.mjs';
import feast from './modes/feast.mjs';
import rush from './modes/rush.mjs';
import { getMode, rankOf, inGrass } from '../public/crumbwar/shared/modes.js';
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

export function createWorld(seed, mode = 'classic') {
  const rules = getMode(mode) && { classic, feast, rush }[mode];
  if (!rules) throw new Error('unknown mode');
  const w = {
    rules, seed, tick: 0, rand: rng(seed), ants: new Array(MAX_ANTS).fill(null), count: 0,
    colonyScore: [0, 0, 0, 0], roundStart: 0, roundEnd: rules.roundSeconds * C.TICK_HZ, feature: { x: 1600, y: 1600, kind: 1 }, breakUntil: 0, lastWinner: -1, round: 1,
    fx: new Float32Array(C.MAX_FOOD), fy: new Float32Array(C.MAX_FOOD), fkind: new Uint8Array(C.MAX_FOOD),
    fgen: new Uint16Array(C.MAX_FOOD), foodCount: 0, freeFood: [], foodSpread: 360,
    fgrid: Array.from({ length: FGRID * FGRID }, () => []), grid: Array.from({ length: GRID * GRID }, () => []),
    goldenId: -1,
    events: [], // [type, a, b] for this tick only: 1 kill (killer, victim), 2 round over (winner), 3 round start
  };
  for (let i = C.MAX_FOOD - 1; i >= 0; i--) w.freeFood.push(i);
  return w;
}

const fcell = (x, y) => Math.min(FGRID - 1, x / FCELL | 0) + Math.min(FGRID - 1, y / FCELL | 0) * FGRID;
const cell = (x, y) => Math.min(GRID - 1, x / CELL | 0) + Math.min(GRID - 1, y / CELL | 0) * GRID;

export function addFood(w, x, y, kind) {
  if (!w.freeFood.length || w.rules.name === 'feast' && inGrass(x,y)) return -1;
  const id = w.freeFood.pop();
  x = Math.min(C.WORLD - 12, Math.max(12, x)); y = Math.min(C.WORLD - 12, Math.max(12, y));
  w.fx[id] = x; w.fy[id] = y; w.fkind[id] = kind; w.fgen[id] = w.fgen[id] + 1 & 0xffff; w.foodCount++;
  w.fgrid[fcell(x, y)].push(id);
  return id;
}
function takeFood(w, id) {
  if (w.rules.name === 'rush' && id === w.goldenId) { w.goldenId=-1; w.feature={x:1600,y:1600,kind:5}; }
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

function place(w, a, catchup = true) {
  if (!w.rules.colonies) {
    // People join or return near the field's middle size, rather than as free meals.
    if (!a.bot && catchup) {
      const peers = w.ants.filter(b => b && b !== a && b.alive).map(b => b.mass).sort((x,y) => x-y);
      if (peers.length >= w.rules.spawnPeers) a.mass = Math.min(500, Math.max(a.mass, peers[Math.floor((peers.length-1)*w.rules.spawnQuantile)] * w.rules.spawnMassFactor));
      a.rank = rankOf(a.mass); a.bestRank = Math.max(a.bestRank, a.rank); a.score = Math.floor(a.mass);
    }
    // Maximise distance from dangerous ants among seeded candidate positions.
    let best = -1;
    for (let i = 0; i < 24; i++) {
      const x = 1100 + w.rand() * 1000, y = 1100 + w.rand() * 1000;
      let near = 1000000;
      for (const b of w.ants) if (b && b !== a && b.alive && b.mass >= a.mass * w.rules.eatRatio) near = Math.min(near, (b.x-x)**2+(b.y-y)**2);
      if (near > best) { best = near; a.x = x; a.y = y; }
    }
    a.heading = 0; a.hp = 5; a.carry = 0; a.stamina = 100; a.alive = true; a.protectUntil = w.tick + w.rules.protectionSeconds * C.TICK_HZ; a.chew = 0;
    return;
  }
  const [nx, ny] = C.NESTS[a.colony], r = 40 * Math.sqrt(w.rand()), t = w.rand() * Math.PI * 2;
  a.x = nx + Math.cos(t) * r; a.y = ny + Math.sin(t) * r;
  a.heading = Math.atan2(C.WORLD / 2 - ny, C.WORLD / 2 - nx); a.heading -= Math.floor(a.heading / (Math.PI * 2)) * Math.PI * 2;
  a.hp = C.TIER_HP[a.tier]; a.carry = 0; a.stamina = C.STAMINA; a.alive = true; a.protectUntil = w.tick + PROTECT; a.hurtAt = -999;
}

export function addAnt(w, colony, bot, nameA, nameB) {
  const id = w.ants.indexOf(null);
  if (id < 0) return null;
  const a = {
    id, colony: w.rules.colonies ? colony : 0, bot, nameA, nameB, mode: w.rules.name, mass: 10, rank: 0, bestRank: 0, x: 0, y: 0, heading: 0, hp: 0, tier: 0, carry: 0, stamina: 0, alive: true,
    roundDelivered: 0, deliveries: 0, goal: 0, goalProgress: 0, goalIndex: 0, goalSince: w.tick, participation: 0, boostUntil: 0, shieldUntil: 0,
    respawnAt: 0, protectUntil: 0, biteAt: 0, hurtAt: -999, score: 0, delivered: 0, kills: 0, deaths: 0,
    angle: 0, move: false, sprint: false, inputTick: 0, // inputTick: the tick the current input first applied to
  };
  if (w.rules.name === 'feast') a.score = 10;
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
  if (killer) { killer.kills++; killer.score += (2 + a.tier) * (w.rules.name === 'rush' ? rushMultiplier(w) : 1); if (w.rules.name === 'rush' && rushMultiplier(w)===2) killer.participation|=16; }
  a.tier = Math.max(0, a.tier - 1);
  w.events.push([1, killer ? killer.id : 255, a.id]);
}
function hurt(w, a, by, killer) {
  if (w.rules.name === 'rush' && w.tick < a.shieldUntil) return;
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
  if (w.rules.name !== 'rush' && Math.abs(x - C.WORLD / 2) < C.WORLD / 5 && Math.abs(y - C.WORLD / 2) < C.WORLD / 5 && w.rand() < 0.5) addFood(w, x, y, 2);
}

function newRound(w) {
  w.colonyScore = [0, 0, 0, 0]; w.goldenId = -1; w.round++; w.roundStart = w.tick; w.roundEnd = w.tick + w.rules.roundSeconds * C.TICK_HZ; w.breakUntil = 0;
  for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id]) takeFood(w, id);
  for (const a of w.ants) if (a) { a.score = w.rules.name === 'feast' ? 10 : 0; a.delivered = 0; a.kills = 0; a.deaths = 0; a.tier = 0; a.mass = 10; a.rank = 0; a.bestRank = 0; a.chew = 0; a.roundDelivered = 0; a.deliveries = 0; a.goal = 0; a.goalProgress = 0; a.goalIndex = 0; a.goalSince = w.tick; a.participation = 0; a.boostUntil = 0; a.shieldUntil = 0; place(w, a, false); }
  w.events.push([3, 0, 0]);
}

export function step(w) {
  w.tick++; w.events.length = 0;
  let inBreak = w.breakUntil > 0;
  if (inBreak && w.tick >= w.breakUntil) { newRound(w); if (w.rules.name !== 'classic') inBreak = false; }
  else if (!inBreak && w.tick >= w.roundEnd) {
    w.lastWinner = w.rules.colonies ? w.colonyScore.indexOf(Math.max(...w.colonyScore)) : w.ants.filter(Boolean).reduce((p,a)=>a.mass>p.mass?a:p, {id:255,mass:-1}).id; w.breakUntil = w.tick + w.rules.breakSeconds * C.TICK_HZ;
    w.events.push([2, w.lastWinner, 0]);
  }
  if (w.rules.name !== 'classic' && w.breakUntil) return;
  if (!inBreak) { if (w.rules.name === 'feast') feastFood(w); else if (w.rules.name === 'rush') rushFood(w); else spawnFood(w); }
  for (const a of w.ants) {
    if (!a) continue;
    if (!a.alive) { if (w.tick >= a.respawnAt) place(w, a); continue; }
    if (inBreak && w.rules.name !== 'classic') continue;
    if (w.rules.name === 'rush') a.boost = w.tick < a.boostUntil;
    stepMove(a, a.angle, a.move, a.sprint);
    if (w.rules.name === 'feast') { feastForage(w, a); continue; }
    if (w.rules.name === 'rush') {
      a.boost = w.tick < a.boostUntil;
      if (Math.hypot(a.x-1600,a.y-1600) < w.rules.hillRadius) { a.participation |= 8; rushProgress(w,a,1,1); }
      // A goal with no progress for this long moves on without a reward, so one hard goal cannot stall a player all round.
      if (!a.bot && w.tick - a.goalSince >= w.rules.goalSkipSeconds * C.TICK_HZ) { a.goalIndex++; a.goal = a.goalIndex % 4; a.goalProgress = 0; a.goalSince = w.tick; }
    }
    const [nx, ny] = C.NESTS[a.colony], home = Math.hypot(a.x - nx, a.y - ny);
    if (a.carry && home < C.DROP_R && !inBreak) {
      const v = C.FOOD_VALUE[a.carry] * (w.rules.name === 'rush' ? rushMultiplier(w) : 1);
      a.carry = 0; a.score += v; a.delivered += v; a.roundDelivered += v; a.deliveries++; w.colonyScore[a.colony] += v;
      if (w.rules.name === 'rush') { a.participation |= 1 | (rushMultiplier(w) === 2 ? 16 : 0); rushProgress(w,a,0,1); }
      while (a.tier < 3 && a.delivered >= C.TIER_AT[a.tier]) { a.tier++; a.hp = C.TIER_HP[a.tier]; }
    }
    if (!a.carry && !inBreak) {
      let best = -1, bd = PICK_R * PICK_R;
      foodNear(w, a.x, a.y, PICK_R, id => { const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2; if (d < bd) { bd = d; best = id; } });
      if (best >= 0) {
        const kind=w.fkind[best];
        if (w.rules.name === 'rush' && kind >= 3) {
          if(kind===3) a.boostUntil=w.tick+6*C.TICK_HZ; else a.shieldUntil=w.tick+6*C.TICK_HZ;
          a.participation |= 4; a.score += rushMultiplier(w); if(rushMultiplier(w)===2) a.participation|=16;
        } else {
          a.carry = kind;
          if(w.rules.name==='rush' && kind===2) { a.participation|=2; rushProgress(w,a,2,1); if(best===w.goldenId){w.goldenId=-1;w.feature={x:1600,y:1600,kind:5};} }
        }
        takeFood(w, best);
      }
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
  if (!inBreak && w.rules.name === 'rush') rushHill(w);
  if (!inBreak && w.rules.name === 'feast') { feastContact(w); return; }
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
    for (let i = 0; i < bites.length; i += 2) if (bites[i + 1].alive) {
      if(w.rules.name==='rush' && bites[i+1].carry && w.tick>=bites[i+1].shieldUntil) rushProgress(w,bites[i],3,1);
      hurt(w, bites[i + 1], C.TIER_BITE[bites[i].tier], bites[i]);
    }
  }
}

// Feast uses the same movement, food grid, ant grid and round loop as Classic.
function feastFood(w) {
  const age = w.tick - w.roundStart;
  if (age <= 0) return;
  if (age === 1 || age % (25 * C.TICK_HZ) === 0) {
    const r = rng((w.seed ^ Math.imul(w.round, 73856093) ^ Math.floor(age / 500)) >>> 0);
    w.feature = { x: 1200 + r() * 800, y: 1200 + r() * 800, kind: age % 1000 === 0 ? 3 : 1 };
    if (inGrass(w.feature.x, w.feature.y)) w.feature.x = 1600;
    // Leave room for each announced cluster even when the room has many leftovers.
    for (let id=0; id<C.MAX_FOOD && w.foodCount>400; id++) if(w.fkind[id]) takeFood(w,id);
    if (w.feature.kind === 3) addFood(w, w.feature.x, w.feature.y, 3);
    for (let i = 0; i < 28; i++) { const x = w.feature.x + (r()-.5)*160, y = w.feature.y + (r()-.5)*160; if (!inGrass(x,y)) addFood(w,x,y,1); }
  }
  if (w.foodCount < Math.min(450, Math.max(150, w.count * 5))) {
    const spread = Math.max(1000, Math.min(2800, w.count * 14));
    for (let i = 0; i < 8; i++) { const x = 1600 + (w.rand()-.5)*spread, y = 1600 + (w.rand()-.5)*spread; if (!inGrass(x,y)) addFood(w,x,y,1); }
  }
}
function feastForage(w, a) {
  // Bots forage less efficiently and shed excess size faster. Sprint costs size.
  a.mass = Math.max(10, a.mass - Math.max(0, a.mass - 16) * w.rules.shrink * C.DT - (a.bot ? Math.max(0, a.mass - w.rules.botShrinkAbove) * w.rules.botShrink * C.DT : 0));
  if (a.sprint && a.move) a.mass = Math.max(10, a.mass - (a.bot ? w.rules.botSprintCost : w.rules.sprintCost) * C.DT);
  let best = -1, bd = 24 * 24;
  foodNear(w, a.x, a.y, 24, id => { const d=(w.fx[id]-a.x)**2+(w.fy[id]-a.y)**2; if(d<bd){best=id;bd=d;} });
  if (best >= 0) {
    if (w.fkind[best] !== 3 || (a.chewId === best && ++a.chew >= 60)) {
      a.mass = Math.min(500, a.mass + (w.fkind[best] === 3 ? w.rules.cakeGrowth : w.rules.crumbGrowth) * (a.bot ? w.rules.botGrowth : 1) * (a.mass >= (a.bot ? w.rules.botFoodSoftCap : w.rules.foodSoftCap) ? w.rules.foodAboveFactor : 1)); a.delivered++; takeFood(w,best); a.chew=0;
    } else if (a.chewId !== best) { a.chewId=best; a.chew=1; }
  } else { a.chew=0; a.chewId=-1; }
  if (a.rank === 5 && w.tick % 40 === 0 && !inGrass(a.x,a.y)) { a.mass=Math.max(10,a.mass-1); addFood(w,a.x-25*Math.cos(a.heading),a.y-25*Math.sin(a.heading),1); }
  a.rank=rankOf(a.mass); a.bestRank=Math.max(a.bestRank,a.rank); a.score=Math.floor(a.mass); a.tier=Math.min(3,a.rank);
}
function feastContact(w) {
  // Choose every victim's largest touching predator from the same tick before applying any size gain.
  const meals=[];
  for (const b of w.ants) {
    if (!b?.alive || w.tick < b.protectUntil || inGrass(b.x,b.y)) continue;
    let eater=null;
    antsNear(w,b.x,b.y,100,a=>{
      if(a===b || w.tick<a.protectUntil || inGrass(a.x,a.y) || a.mass < b.mass*w.rules.eatRatio) return;
      const reach=12+Math.sqrt(a.mass)*2;
      if((a.x-b.x)**2+(a.y-b.y)**2 < reach*reach && (!eater || a.mass>eater.mass)) eater=a;
    });
    if(eater) meals.push([eater,b,b.mass]);
  }
  // Retain all victim sizes before applying any meal gains. Ant ids cannot change a chain's outcome.
  for(const [,b,mass] of meals) {
    b.alive=false; b.deaths++; b.mass=Math.max(10,mass*w.rules.retain); b.respawnAt=w.tick+w.rules.respawnSeconds*C.TICK_HZ;
  }
  for(const [a,b,mass] of meals) {
    a.mass=Math.min(500,a.mass+Math.max(0,mass-Math.max(10,mass*w.rules.retain))*w.rules.gain*(a.bot ? w.rules.botGrowth : 1)); a.kills++;
    w.events.push([1,a.id,b.id]);
  }
  for(const a of w.ants) if(a) { a.score=Math.floor(a.mass); a.rank=rankOf(a.mass); a.bestRank=Math.max(a.bestRank,a.rank); }

}

// Rush events use their own round seed stream. Player movement and bot noise cannot change the schedule.
const rushMultiplier = w => w.roundEnd-w.tick <= w.rules.frenzySeconds*C.TICK_HZ ? 2 : 1;
function rushFood(w) {
  const age=w.tick-w.roundStart;
  if (age <= 0) return;
  const r=rng((w.seed ^ Math.imul(w.round,19349663) ^ Math.floor(age/20))>>>0);
  if(age===1 || age%80===0) {
    for(const [nx,ny] of C.NESTS) for(let i=0;i<3;i++) {
      const dx=1600-nx,dy=1600-ny,d=Math.hypot(dx,dy);
      addFood(w,nx+dx/d*(100+i*32),ny+dy/d*(100+i*32),1);
    }
  }
  if(age===1 || age%(20*C.TICK_HZ)===0) {
    if(w.goldenId>=0 && w.fkind[w.goldenId]) takeFood(w,w.goldenId);
    for(let id=0;id<C.MAX_FOOD && w.freeFood.length<20;id++) if(w.fkind[id]) takeFood(w,id);
    const x=1400+r()*400,y=1400+r()*400;
    w.goldenId=addFood(w,x,y,2);w.feature={x,y,kind:2};
  }
  if(age===1 || age%(12*C.TICK_HZ)===0) for(let i=0;i<8;i++) addFood(w,1150+r()*900,1150+r()*900,3+(i%2));
  if(w.foodCount<Math.min(380,Math.max(130,w.count*4))) spawnFood(w);
}
function rushProgress(w,a,kind,n) {
  if(a.bot || a.goal!==kind) return;
  a.goalProgress+=n;a.goalSince=w.tick;
  const need=[3,100,1,1][kind];
  if(a.goalProgress>=need) {
    const reward=5*rushMultiplier(w); if(rushMultiplier(w)===2) a.participation|=16; a.score+=reward;w.colonyScore[a.colony]+=reward;
    a.goalIndex++;a.goal=a.goalIndex%4;a.goalProgress=0;a.goalSince=w.tick;
  }
}
function rushHill(w) {
  if((w.tick-w.roundStart)%(w.rules.hillEvery*C.TICK_HZ)) return;
  const counts=[0,0,0,0];
  for(const a of w.ants) if(a?.alive && Math.hypot(a.x-1600,a.y-1600)<w.rules.hillRadius) counts[a.colony]++;
  const most=Math.max(...counts), winner=counts.indexOf(most);
  if(!most || counts.filter(n=>n===most).length>1) return;
  const reward=2*rushMultiplier(w);w.colonyScore[winner]+=reward;
  for(const a of w.ants) if(a?.alive && a.colony===winner && Math.hypot(a.x-1600,a.y-1600)<w.rules.hillRadius) { a.score+=reward; if(rushMultiplier(w)===2) a.participation|=16; }
}
