// The rival's mind. It reads the sim's state and queues the same orders a player can, under its own seat, so its
// play is in the order log and a run replays without it. It keeps no state of its own.
//
// It knows where every pile is (there is no fog yet; when sight arrives it gets the same sight as a player).

import { CMD, KIND, CG, TRAILS, PATH_MAX, MAX_PILES, FOOD, TEAMS, ROOM, MODE, MAT, C, PLUG } from './sim.js';
import { MAPS, TIERS } from './tables.js';

const FAR = 0xFFFF;

export const THINK_EVERY = 20;

// Where it digs, as [kind, x0, y0, x1, y1] offsets from its shaft: stores beside the porch, quarters beside the tunnels,
// nursery wings. It takes the first of a kind it has not painted yet.
const SLOTS = [
  [ROOM.STORE, 3, 4, 6, 6], [ROOM.STORE, -6, 4, -3, 6],
  [ROOM.REST, 1, 7, 5, 8], [ROOM.REST, -5, 7, -1, 8], [ROOM.REST, 3, 14, 7, 15], [ROOM.REST, -7, 14, -3, 15], [ROOM.REST, 6, 7, 10, 8], [ROOM.REST, -10, 7, -6, 8],
  [ROOM.NURSERY, 6, 10, 9, 13], [ROOM.NURSERY, 10, 10, 13, 13],
  [ROOM.GARDEN, -10, 10, -7, 13], // off the far end of the first nursery, away from the shaft and the queen
  [ROOM.POST, 0, 2, 0, 3], [ROOM.POST, 0, 7, 0, 9], // the throat above the store, then the shaft below it
];

// A mind that keeps its food deep digs its stores beside the queen's chamber, a long walk from the door.
const DEEP = [[ROOM.STORE, 3, 16, 6, 18], [ROOM.STORE, -6, 16, -3, 18], [ROOM.STORE, 7, 16, 10, 18], [ROOM.STORE, -10, 16, -7, 18]];

/** The dig and room orders for the next room of a kind, or none when every slot of it is taken. */
export function buildNext(sim, t, kind, deep = false) {
  const L = sim.L, dx = sim.door[t] % L.sw;
  for (const [k, x0, y0, x1, y1] of deep && kind === ROOM.STORE ? DEEP : SLOTS) {
    if (k !== kind || sim.room[y0 * L.nw + dx + x0] === kind) continue;
    const cells = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push(dx + x, y);
    return [{ team: t, type: CMD.ROOM, cells, kind, dig: 1 }];
  }
  return [];
}

/** The cells to dig to reach this colony's nearest cache through its own clay, as [x, y, ...] (the cache last), or none. */
export function cacheRun(sim, t, fits = () => true) {
  const L = sim.L, nw = L.nw, nh = L.nh, NN = nw * nh, prev = new Int32Array(NN).fill(-2), q = [];
  // From every open cell of its own, outward through its own clay.
  // (Where a rival may tunnel into this ground, only the cells its own ants can walk to: the rival's tunnel is not a place to dig from.)
  const U = sim.underF[t];
  for (let k = 0; k < NN; k++) if (sim.mat[L.nestBase + k] === MAT.OPEN && sim.owner(k) === t && (!U || U[L.nestBase + k] !== 0xFFFF)) { prev[k] = -1; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % nw, y = Math.floor(k / nw);
    if (sim.cache[k] && fits(sim.cache[k])) { const cells = []; for (let c = k; prev[c] !== -1; c = prev[c]) cells.unshift(c % nw, Math.floor(c / nw)); return cells; }
    for (const [ax, ay] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (ax < 1 || ax >= nw - 1 || ay < 2 || ay >= nh - 1) continue;
      const a = ay * nw + ax;
      if (prev[a] === -2 && sim.mat[L.nestBase + a] === MAT.CLAY && sim.owner(a) === t) { prev[a] = k; q.push(a); }
    }
  }
  return [];
}

/** The clay cells to dig, in order, to join this colony's nest to the rival's under ground, as [x, y, ...]; none when
 *  they are joined already or there is no way. aim: 0 the nearest open cell of the rival's, 1 its queen's chamber, 2 its stores. */
export function breachRun(sim, t, foe, aim = 0) {
  const L = sim.L, nw = L.nw, nh = L.nh, NN = nw * nh, base = L.nestBase, U = sim.underF[t], V = sim.underF[foe];
  if (!U || !V || sim.linked) return [];
  const qk = sim.queen[foe] - base, qx = qk % nw, qy = Math.floor(qk / nw);
  const goal = k => V[base + k] !== FAR && (aim === 1 ? Math.abs((k % nw) - qx) <= 3 && Math.abs(Math.floor(k / nw) - qy) <= 2 : aim === 2 ? sim.room[k] === ROOM.STORE : true);
  const prev = new Int32Array(NN).fill(-2), q = [];
  for (let k = 0; k < NN; k++) if (U[base + k] !== FAR) { prev[k] = -1; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % nw, y = Math.floor(k / nw);
    for (const [ax, ay] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (ax < 1 || ax >= nw - 1 || ay < 2 || ay >= nh - 1) continue;
      const a = ay * nw + ax;
      if (prev[a] !== -2) continue;
      if (goal(a)) { const cells = []; for (let c = k; prev[c] !== -1; c = prev[c]) cells.unshift(c % nw, Math.floor(c / nw)); return cells; }
      if (sim.mat[base + a] === MAT.CLAY && (!sim.mark[a] || sim.mark[a] === t + 1)) { prev[a] = k; q.push(a); } // clay the rival has marked is the rival's to dig: go round it
    }
  }
  return [];
}

/** Where a breach comes into this colony's nest: the last cells of the rival's way to its queen before its own rooms,
 *  as [x, y, ...] (up to `n` cells), for a guard post. None when the nests are not joined. */
export function mouth(sim, t, foe, n) {
  const L = sim.L, nw = L.nw, base = L.nestBase, U = sim.underF[t];
  if (!sim.linked || !U) return [];
  const mine = [];
  for (let c = sim.queen[foe], guard = 0; U[c] > 1 && guard < 4096; guard++) {
    let m = -1; for (let d = 0; d < 4; d++) { const a = L.nb[c * 4 + d]; if (a >= base && U[a] < U[c] && (m < 0 || U[a] < U[m])) m = a; }
    if (m < 0) break;
    c = m; const k = c - base;
    if (sim.owner(k) !== t) continue;
    if (sim.room[k] && sim.room[k] !== ROOM.POST) { if (mine.length) break; continue; } // its own rooms begin here; a tunnel that comes straight into a room is guarded on the way on from it
    mine.push(k);
  }
  const out = [];
  for (const k of mine.slice(-n)) out.push(k % nw, Math.floor(k / nw));
  return out;
}

/** The orders this seat gives now. `mood`: 0 timid (never raids), 1 steady, 2 bold (raids early); or { mood, build: false }
 *  for a mind that never digs, or { mood, rooms: [kinds] } for one that digs only those;
 *  { mood, pick, special } chooses a caste and its share of the brood in four; { deep: true } keeps its stores by the queen;
 *  { loot: true } sends its soldiers for the other hill's stores when it is not strong enough to go for the queen. */
export function think(sim, t, mind = 1) {
  // A mission may set the least mood its rival plays at (`rivalMood`): behind a whole wall a rival that never raids would never dig.
  const mood = Math.max(typeof mind === 'number' ? mind : mind.mood ?? 1, mind.meek ? 0 : sim.mission.rivalMood ?? 0), build = typeof mind === 'number' ? true : mind.build !== false;
  const may = k => typeof mind === 'number' || !mind.rooms || mind.rooms.includes(k); // rooms: the only kinds this mind digs
  const out = [], L = sim.L, sw = L.sw, o = t * CG.SIZE, cg = sim.cg;
  if (cg[o + CG.QUEEN_HP] <= 0 || sim.result) return out;
  if (typeof mind === 'number') mind = { mood };
  // breach: it may dig for the other nest. sealed: the map has a wall with no gap, so there is no way over the ground.
  const M = MAPS[sim.mission.map], sealed = !!M && !!M.wall && !M.gaps.length, breach = sim.mayBreach(t) && mind.breach !== false;
  // Before a frost it plans for the winter: stores for every mouth first, and no more housing than the stores can feed.
  const cfg = sim.cfg, winter = cfg.frostTick > 0 && (typeof mind === 'number' || mind.winter !== false), frozen = winter && sim.tick >= cfg.frostTick;
  const meals = winter ? Math.ceil((cfg.duskTick - Math.max(sim.tick, cfg.frostTick)) / cfg.frostEat) : 0, feed = mouths => Math.ceil(mouths / sim.stat[t].eatPer) * meals;
  const door = sim.door[t], dx = door % sw, dy = Math.floor(door / sw);
  const ends = [], live = [];
  for (let k = 0; k < TRAILS; k++) {
    const s = t * TRAILS + k;
    if (!sim.trLive[s]) continue;
    if (sim.trDry[s] && sim.trKind[s] === KIND.FORAGE) { out.push({ team: t, type: CMD.ERASE, trail: k }); continue; }
    live.push(k); ends.push(sim.trPath[s * PATH_MAX + sim.trLen[s] - 1]);
  }
  const forage = live.filter(k => sim.trKind[t * TRAILS + k] === KIND.FORAGE), raids = live.filter(k => sim.trKind[t * TRAILS + k] === KIND.RAID);
  const near = (c, r) => ends.some(e => Math.abs((e % sw) - (c % sw)) <= r && Math.abs(Math.floor(e / sw) - Math.floor(c / sw)) <= r);
  // Forage: up to three trails, to the nearest pile of the food it is shorter of.
  if (forage.length < 3) {
    const want = (winter ? cg[o + CG.PROTEIN] >= 6 : cg[o + CG.SUGAR] <= cg[o + CG.PROTEIN] * 2) ? FOOD.SUGAR : FOOD.PROTEIN;
    let best = -1, bd = 1e9;
    for (let p = 0; p < MAX_PILES; p++) {
      if (sim.pileAmount[p] < 6) continue;
      const c = sim.pileCell[p];
      if (near(c, 2)) continue;
      if (sealed && (c % sw < sw >> 1) !== (dx < sw >> 1)) continue; // the far side of a wall with no gap
      if (winter && sim.pileKind[p] === FOOD.PROTEIN && cg[o + CG.PROTEIN] >= 12) continue; // meat does not keep a hill through the frost
      const d = sim.doorF[t][c] + (sim.pileKind[p] === want ? 0 : 40);
      if (d < bd) { bd = d; best = c; }
    }
    if (best >= 0) out.push({ team: t, type: CMD.TRAIL, kind: KIND.FORAGE, level: 2, points: [best % sw, Math.floor(best / sw)] });
  }
  // Diet: workers first, then one in four a major, then two in four.
  const adults = cg[o + CG.ADULTS], majors = cg[o + CG.MAJORS];
  // Bold raises soldiers from the first brood: it means to strike before a growing hill's rooms have paid.
  const diet = mood === 2 || sim.sites.length || sim.mission.goals.haul ? (adults < 34 ? 1 : 2) : adults < 36 ? 0 : adults < 60 ? 1 : 2;
  // Its chosen caste (mind.pick), if the mission allows one: picked at the start, then raised beside the soldiers.
  const pick = typeof mind === 'number' ? 0 : mind.pick | 0, special = pick && diet ? Math.min(4 - diet, mind.special ?? 1) : 0;
  if (pick && !cg[o + CG.PICK] && sim.mayPick(t)) out.push({ team: t, type: CMD.PICK, caste: pick });
  // Growing the chamber (missions with tiers): the branch its mind names, once the hill is `growAt` strong and the
  // stores can pay with a meal to spare; the second growth when it can pay again.
  // (A mind that names no branch takes one by the seed and its seat; `grow: 0` never grows.)
  const grow = mind.grow ?? (mind.pick ? 1 : 1 + ((Math.abs(cfg.seed | 0) + t) & 1)); // a mind with a caste to raise goes to war for it; one that plans for a frost keeps its seeds
  if (grow && !winter && sim.mayGrow(t) === 0 && (cg[o + CG.TIER] === 0 || mind.grow2 !== false) && adults >= (mind.growAt ?? 45) + 40 * cg[o + CG.TIER] && cg[o + CG.SUGAR] >= TIERS.grow[cg[o + CG.TIER]].sugar + (cg[o + CG.TIER] ? mind.spare2 ?? 60 : 6)) out.push({ team: t, type: CMD.GROW, branch: grow });
  if (cg[o + CG.DIET] !== diet || (cg[o + CG.PICK] && cg[o + CG.DIET2] !== special)) out.push({ team: t, type: CMD.DIET, share: diet, special });
  const outnumbered = cg[(1 - t) * CG.SIZE + CG.MAJORS] * 2 > cg[o + CG.MAJORS] * 3 + 4; // the other hill has half as many soldiers again, and more
  // Building, one room at a time: a store when the stores are nearly full, quarters when the hill is, a nursery wing when the brood is.
  if (build && cg[o + CG.MARKS] > 0 && !sim.digF[t]) {
    // Marks no worker can reach would stall it for good: take them off.
    const cells = []; for (let k = 0; k < sim.mark.length; k++) if (sim.mark[k] === t + 1) cells.push(k % L.nw, Math.floor(k / L.nw));
    out.push({ team: t, type: CMD.ROOM, cells, kind: ROOM.NONE });
  }
  if (build && cg[o + CG.MARKS] === 0) {
    let brood = 0; for (let b = 0; b < sim.bn; b++) if (sim.bTeam[b] === t) brood++;
    const capF = cg[o + CG.CAP_FOOD];
    // Every kind it wants now, most pressing first; it digs the first that still has a slot.
    const wants = [], deep = typeof mind !== 'number' && !!mind.deep;
    // Keeping food deep: its first deep store comes before anything else, and then the porch is a store no longer.
    if (deep && may(ROOM.STORE)) {
      const porch = 5 * L.nw + dx, first = 17 * L.nw + dx + 3;
      if (sim.room[first] !== ROOM.STORE) wants.push(ROOM.STORE);
      else if (sim.room[porch] === ROOM.STORE && sim.mat[L.nestBase + first] === 0) { const cells = []; for (let y = 4; y <= 6; y++) for (let x = -2; x <= 2; x++) cells.push(dx + x, y); out.push({ team: t, type: CMD.ROOM, cells, kind: ROOM.NONE }); }
    }
    if (may(ROOM.STORE) && (winter ? !frozen && cg[o + CG.SUGAR] >= 30 && capF < (feed(adults + brood + 2 * majors) * 5 >> 2) + 16 : Math.max(cg[o + CG.SUGAR], cg[o + CG.PROTEIN]) * 5 >= capF * 4)) wants.push(ROOM.STORE);
    if (may(ROOM.REST) && adults + brood >= cg[o + CG.CAP_ADULTS] - 10 && (!winter || (frozen ? cg[o + CG.SUGAR] : capF) >= feed(cg[o + CG.CAP_ADULTS] + 20))) wants.push(ROOM.REST);
    if (may(ROOM.NURSERY) && brood >= cg[o + CG.CAP_BROOD] - 4) wants.push(ROOM.NURSERY);
    // Fungus gardens, once it has grown to them: food that needs no trail. Not past a third of what its quarters house.
    if (mind.garden !== false && may(ROOM.GARDEN) && sim.mayRoom(t, ROOM.GARDEN) && adults >= 40 && sim.gardens[t] < (mind.gardens ?? 16) && cg[o + CG.SUGAR] >= 14) wants.push(ROOM.GARDEN);
    // A guard post in the throat of the shaft, where a break-in must pass, once there is a guard worth posting.
    if (may(ROOM.POST) && sim.mayRoom(t, ROOM.POST) && majors >= 4) wants.push(ROOM.POST);
    let dug = false;
    for (const kind of wants) { const b = buildNext(sim, t, kind, deep); if (b.length) { out.push(...b); dug = true; break; } }
    // With nothing pressing to build and hands to spare, it digs for the nearest cache: a seed a cell, paid back at the end.
    if (!dug && adults >= 40 && (typeof mind === 'number' || mind.caches !== false)) {
      const run = cacheRun(sim, t, v => cg[o + (v & 1 ? CG.PROTEIN : CG.SUGAR)] + (v >> 1) <= capF), cells = run.length >> 1;
      if (cells && cells <= 24 && cg[o + CG.SUGAR] >= cells * C.DIG_SUGAR + C.DIG_KEEP + 6 && !frozen) {
        out.push({ team: t, type: CMD.DIG, cells: run }); dug = true;
      }
    }
    // A breach: where the mission lets it, a rival that raids digs for the other nest, eight cells at a time so that a
    // room it comes to need is not kept waiting. Where it aims (the nearest room, the queen, the stores) goes by the seed.
    if (!dug && breach && mood > 0 && !sim.linked && !outnumbered && adults >= 40 && sim.tick >= (mood === 2 ? 600 : 1500) && cg[o + CG.SUGAR] >= 8 * C.DIG_SUGAR + C.DIG_KEEP + 4) {
      const foe2 = 1 - t, aim = mind.aim ?? (Math.abs(cfg.seed | 0) + t) % 3;
      let run = breachRun(sim, t, foe2, aim); if (!run.length && aim) run = breachRun(sim, t, foe2, 0); // no stores to aim at, or no way to them: the nearest room will do
      if (run.length) out.push({ team: t, type: CMD.DIG, cells: run.slice(0, 16) });
    }
  }
  // Badly outnumbered in soldiers and joined: it packs the tunnel shut where it comes in (a few seeds), and digs no way back while that lasts.
  if (sim.linked && (outnumbered || mind.plug === 'always') && build && sim.mayPlug() && mind.plug !== false && cg[o + CG.SUGAR] >= C.PLUG_SUGAR + C.DIG_KEEP + 4) {
    const cells = mouth(sim, t, 1 - t, 99);
    // (Not with the rival's ants near: the sim would refuse it, every think.)
    const near = (x, y) => { for (let i = 0; i < sim.n; i++) if (sim.team[i] !== t && sim.hp[i] > 0 && sim.layer[i] === 1 && Math.abs((sim.x[i] >> 8) - x) <= C.PLUG_CLEAR && Math.abs((sim.y[i] >> 8) - y) <= C.PLUG_CLEAR) return true; return false; };
    for (let j = 0; j + 1 < cells.length; j += 2) if (!sim.room[cells[j + 1] * L.nw + cells[j]]) { if (!near(cells[j], cells[j + 1])) out.push({ team: t, type: CMD.FILL, cells: [cells[j], cells[j + 1]] }); break; }
  }
  // A breach is answered with a guard post where it comes in, as soon as the nests are joined and there are soldiers to stand on it.
  if (sim.linked && build && may(ROOM.POST) && sim.mayRoom(t, ROOM.POST) && cg[o + CG.MAJORS] >= 2 && (typeof mind === 'number' || mind.guard !== false)) {
    const cells = mouth(sim, t, 1 - t, sealed ? 6 : 3);
    let need = false; for (let j = 0; j + 1 < cells.length; j += 2) if (sim.room[cells[j + 1] * L.nw + cells[j]] !== ROOM.POST) need = true;
    if (need) out.push({ team: t, type: CMD.ROOM, cells, kind: ROOM.POST });
  }
  // Defence: enemies by the door call the guard and the resting to it.
  let foes = 0;
  for (let i = 0; i < sim.n; i++) if (sim.team[i] !== t && sim.hp[i] > 0 && sim.layer[i] === 0 && Math.abs((sim.x[i] >> 8) - dx) <= 10 && Math.abs((sim.y[i] >> 8) - dy) <= 10) foes++;
  if (foes >= 3 && cg[o + CG.RALLY_HOLD] < 100) out.push({ team: t, type: CMD.RALLY, x: dx, y: dy, hold: 400 });
  // Stones that pay while held: its soldiers stand on the nearest ones (timid one, steady two, bold three), a raid trail each.
  if (sim.sites.length) {
    const want = sim.sites.map(c => [sim.doorF[t][c], c]).sort((a, b) => a[0] - b[0]).slice(0, Math.max(1, Math.min(1 + mood, Math.floor(majors / 3)))).map(e => e[1]); // three soldiers a stone, or it cannot hold one
    const by = (e, c) => Math.abs((e % sw) - (c % sw)) <= 2 && Math.abs(Math.floor(e / sw) - Math.floor(c / sw)) <= 2;
    const end = k => { const s2 = t * TRAILS + k; return sim.trPath[s2 * PATH_MAX + sim.trLen[s2] - 1]; };
    const kept = raids.filter(k => majors >= 2 && want.some(c => by(end(k), c)));
    for (const k of raids) if (!kept.includes(k)) out.push({ team: t, type: CMD.ERASE, trail: k });
    let room = TRAILS - live.length;
    if (majors >= 3) for (const c of want) if (room > 0 && !kept.some(k => by(end(k), c))) { out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: mood ? 1 : 2, points: [c % sw, Math.floor(c / sw)] }); room--; }
    return out;
  }
  // A haul mission: the loads in the other store are the goal. A rival that fights sends everything through the door
  // (a Surge raid takes workers along to carry), and calls it off when the soldiers are spent.
  if (sim.mission.goals.haul) {
    // Half its soldiers stand on the richest ford (so half the guard is away from its store, which is the opening a
    // thief needs). A rival that fights breaks in with everything when it has the numbers, workers along to carry.
    let foe = -1, foeMajors = 0; for (let e = 0; e < TEAMS; e++) if (e !== t && cg[e * CG.SIZE + CG.QUEEN_HP] > 0) { foe = e; foeMajors = cg[e * CG.SIZE + CG.MAJORS]; }
    const atDoor = k => { const s2 = t * TRAILS + k, e = sim.trPath[s2 * PATH_MAX + sim.trLen[s2] - 1]; return foe >= 0 && sim.doorF[foe][e] <= 4; };
    const strike = mood > 0 && foe >= 0 && majors >= (mood === 2 ? Math.max(6, Math.ceil(foeMajors * 1.25)) : Math.max(8, Math.ceil(foeMajors * 1.5)));
    if (raids.length && (majors < 3 || (strike && !atDoor(raids[0])) || (atDoor(raids[0]) && majors * 2 < foeMajors))) for (const k of raids) out.push({ team: t, type: CMD.ERASE, trail: k });
    else if (!raids.length && live.length < TRAILS && foe >= 0) {
      if (strike) { const ed = sim.door[foe]; out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: 3, points: [ed % sw, Math.floor(ed / sw)] }); }
      else if (majors >= 4) {
        let best = -1, amount = 0; const mid = sw >> 1;
        for (let p = 0; p < MAX_PILES; p++) { const c = sim.pileCell[p]; if (c >= 0 && sim.pileAmount[p] > amount && Math.abs((c % sw) - mid) <= 6) { amount = sim.pileAmount[p]; best = c; } }
        if (best >= 0) out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: [best % sw, Math.floor(best / sw)] });
      }
    }
    return out;
  }
  // War. It breaks into the enemy nest only with the numbers for it (bold: at parity; steady: a quarter more), since a
  // raid into an equal guard is thrown away. Short of that, its soldiers hold the richest food on the fords.
  let foeMajors = 0, foe = -1;
  for (let e = 0; e < TEAMS; e++) if (e !== t && cg[e * CG.SIZE + CG.QUEEN_HP] > 0) { foe = e; foeMajors = Math.max(foeMajors, cg[e * CG.SIZE + CG.MAJORS]); }
  const need = mood === 2 ? 8 : 10, from = mood === 2 ? 1600 : 4200;
  // A siege: the colony under attack never marches on the other hill; the attacker must, and goes at the half-way mark
  // with what it has if it has not found the numbers before.
  const siege = sim.mission.goals.dusk === 'holder', late = siege && t !== 1 && sim.tick * 2 >= cfg.duskTick && majors >= 6;
  const strike = !(siege && t === 1) && foe >= 0 && (late || (mood > 0 && majors >= need && sim.tick >= from && (mood === 2 ? majors >= foeMajors : majors * 4 >= foeMajors * 5)));
  // The other hill's soldiers out on its raid trails: a thief's opening is a guard that is away.
  const away = () => { let n = 0; for (let k = 0; k < TRAILS; k++) { const s2 = foe * TRAILS + k; if (sim.trLive[s2] && sim.trKind[s2] === KIND.RAID) n += sim.crew[s2]; } return n; };
  const atDoor = k => { const s2 = t * TRAILS + k, e = sim.trPath[s2 * PATH_MAX + sim.trLen[s2] - 1]; return foe >= 0 && (e >= L.nestBase || sim.doorF[foe][e] <= 4); };
  // Joined under ground, it goes through the breach for the queen. Behind a whole wall there is no other way, and it waits for one.
  if (sim.linked && foe >= 0 && sim.mayBreach(t)) {
    // Steady waits for a quarter more soldiers than the other hill, and no longer than three fifths of the day.
    const go = mood > 0 && majors >= (mood === 2 ? 6 : 8) && (mood === 2 ? majors >= foeMajors : majors * 4 >= foeMajors * 5 || sim.tick * 5 >= cfg.duskTick * 3);
    if (raids.length && (majors < 3 || (!go && majors * 2 < foeMajors))) for (const k of raids) out.push({ team: t, type: CMD.ERASE, trail: k });
    else if (!raids.length && live.length < TRAILS && go) { const qk = sim.queen[foe] - L.nestBase; out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: majors >= 16 ? 3 : 2, under: [qk % L.nw, Math.floor(qk / L.nw)] }); }
    return out;
  }
  if (sealed) return out;
  if (raids.length && (majors < 3 || (strike && (!atDoor(raids[0]) || sim.trMode[t * TRAILS + raids[0]] === MODE.LOOT)) || (!strike && atDoor(raids[0]) && majors * 2 < foeMajors))) for (const k of raids) out.push({ team: t, type: CMD.ERASE, trail: k });
  else if (!raids.length && live.length < TRAILS && foe >= 0) {
    if (strike) { const ed = sim.door[foe]; out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: majors >= need * 2 ? 3 : 2, points: [ed % sw, Math.floor(ed / sw)] }); }
    else if (typeof mind !== 'number' && mind.loot && majors >= 4 && sim.has(t, 'loot') && away() * 2 >= foeMajors) { const ed = sim.door[foe]; out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: 2, mode: MODE.LOOT, points: [ed % sw, Math.floor(ed / sw)] }); }
    else if (mood > 0 && majors >= 4 && sim.tick >= 1500) {
      let best = -1, amount = 20; const mid = sw >> 1;
      for (let p = 0; p < MAX_PILES; p++) { const c = sim.pileCell[p]; if (c >= 0 && sim.pileAmount[p] > amount && Math.abs((c % sw) - mid) <= 6) { amount = sim.pileAmount[p]; best = c; } }
      if (best >= 0) out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: [best % sw, Math.floor(best / sw)] });
    }
  }
  return out;
}
