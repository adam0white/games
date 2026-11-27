// The rival's mind. It reads the sim's state and queues the same orders a player can, under its own seat, so its
// play is in the order log and a run replays without it. It keeps no state of its own.
//
// It knows where every pile is (there is no fog yet; when sight arrives it gets the same sight as a player).

import { CMD, KIND, CG, TRAILS, PATH_MAX, MAX_PILES, FOOD, TEAMS, ROOM } from './sim.js';

export const THINK_EVERY = 20;

// Where it digs, as [kind, x0, y0, x1, y1] offsets from its shaft: stores beside the porch, quarters beside the tunnels,
// nursery wings. It takes the first of a kind it has not painted yet.
const SLOTS = [
  [ROOM.STORE, 3, 4, 6, 6], [ROOM.STORE, -6, 4, -3, 6],
  [ROOM.REST, 1, 7, 5, 8], [ROOM.REST, -5, 7, -1, 8], [ROOM.REST, 3, 14, 7, 15], [ROOM.REST, -7, 14, -3, 15], [ROOM.REST, 6, 7, 10, 8], [ROOM.REST, -10, 7, -6, 8],
  [ROOM.NURSERY, 6, 10, 9, 13], [ROOM.NURSERY, -10, 10, -7, 13],
];

/** The dig and room orders for the next room of a kind, or none when every slot of it is taken. */
export function buildNext(sim, t, kind) {
  const L = sim.L, dx = sim.door[t] % L.sw;
  for (const [k, x0, y0, x1, y1] of SLOTS) {
    if (k !== kind || sim.room[y0 * L.nw + dx + x0] === kind) continue;
    const cells = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push(dx + x, y);
    return [{ team: t, type: CMD.ROOM, cells, kind, dig: 1 }];
  }
  return [];
}

/** The orders this seat gives now. `mood`: 0 timid (never raids), 1 steady, 2 bold (raids early); or { mood, build: false }
 *  for a mind that never digs, or { mood, rooms: [kinds] } for one that digs only those;
 *  { mood, pick, special } chooses a caste and its share of the brood in four. */
export function think(sim, t, mind = 1) {
  const mood = typeof mind === 'number' ? mind : mind.mood ?? 1, build = typeof mind === 'number' ? true : mind.build !== false;
  const may = k => typeof mind === 'number' || !mind.rooms || mind.rooms.includes(k); // rooms: the only kinds this mind digs
  const out = [], L = sim.L, sw = L.sw, o = t * CG.SIZE, cg = sim.cg;
  if (cg[o + CG.QUEEN_HP] <= 0 || sim.result) return out;
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
    const want = cg[o + CG.SUGAR] <= cg[o + CG.PROTEIN] * 2 ? FOOD.SUGAR : FOOD.PROTEIN;
    let best = -1, bd = 1e9;
    for (let p = 0; p < MAX_PILES; p++) {
      if (sim.pileAmount[p] < 6) continue;
      const c = sim.pileCell[p];
      if (near(c, 2)) continue;
      const d = sim.doorF[t][c] + (sim.pileKind[p] === want ? 0 : 40);
      if (d < bd) { bd = d; best = c; }
    }
    if (best >= 0) out.push({ team: t, type: CMD.TRAIL, kind: KIND.FORAGE, level: 2, points: [best % sw, Math.floor(best / sw)] });
  }
  // Diet: workers first, then one in four a major, then two in four.
  const adults = cg[o + CG.ADULTS], majors = cg[o + CG.MAJORS];
  // Bold raises soldiers from the first brood: it means to strike before a growing hill's rooms have paid.
  const diet = mood === 2 ? (adults < 34 ? 1 : 2) : adults < 36 ? 0 : adults < 60 ? 1 : 2;
  // Its chosen caste (mind.pick), if the mission allows one: picked at the start, then raised beside the soldiers.
  const pick = typeof mind === 'number' ? 0 : mind.pick | 0, special = pick && diet ? Math.min(4 - diet, mind.special ?? 1) : 0;
  if (pick && !cg[o + CG.PICK]) out.push({ team: t, type: CMD.PICK, caste: pick });
  if (cg[o + CG.DIET] !== diet || (cg[o + CG.PICK] && cg[o + CG.DIET2] !== special)) out.push({ team: t, type: CMD.DIET, share: diet, special });
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
    const wants = [];
    if (may(ROOM.STORE) && Math.max(cg[o + CG.SUGAR], cg[o + CG.PROTEIN]) * 5 >= capF * 4) wants.push(ROOM.STORE);
    if (may(ROOM.REST) && adults + brood >= cg[o + CG.CAP_ADULTS] - 10) wants.push(ROOM.REST);
    if (may(ROOM.NURSERY) && brood >= cg[o + CG.CAP_BROOD] - 4) wants.push(ROOM.NURSERY);
    for (const kind of wants) { const b = buildNext(sim, t, kind); if (b.length) { out.push(...b); break; } }
  }
  // Defence: enemies by the door call the guard and the resting to it.
  let foes = 0;
  for (let i = 0; i < sim.n; i++) if (sim.team[i] !== t && sim.hp[i] > 0 && sim.layer[i] === 0 && Math.abs((sim.x[i] >> 8) - dx) <= 10 && Math.abs((sim.y[i] >> 8) - dy) <= 10) foes++;
  if (foes >= 3 && cg[o + CG.RALLY_HOLD] < 100) out.push({ team: t, type: CMD.RALLY, x: dx, y: dy, hold: 400 });
  // War. It breaks into the enemy nest only with the numbers for it (bold: at parity; steady: a quarter more), since a
  // raid into an equal guard is thrown away. Short of that, its soldiers hold the richest food on the fords.
  let foeMajors = 0, foe = -1;
  for (let e = 0; e < TEAMS; e++) if (e !== t && cg[e * CG.SIZE + CG.QUEEN_HP] > 0) { foe = e; foeMajors = Math.max(foeMajors, cg[e * CG.SIZE + CG.MAJORS]); }
  const need = mood === 2 ? 8 : 10, from = mood === 2 ? 1600 : 4200;
  const strike = mood > 0 && foe >= 0 && majors >= need && sim.tick >= from && (mood === 2 ? majors >= foeMajors : majors * 4 >= foeMajors * 5);
  const atDoor = k => { const s2 = t * TRAILS + k, e = sim.trPath[s2 * PATH_MAX + sim.trLen[s2] - 1]; return foe >= 0 && sim.doorF[foe][e] <= 4; };
  if (raids.length && (majors < 3 || (strike && !atDoor(raids[0])) || (!strike && atDoor(raids[0]) && majors * 2 < foeMajors))) for (const k of raids) out.push({ team: t, type: CMD.ERASE, trail: k });
  else if (!raids.length && live.length < TRAILS && foe >= 0) {
    if (strike) { const ed = sim.door[foe]; out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: majors >= need * 2 ? 3 : 2, points: [ed % sw, Math.floor(ed / sw)] }); }
    else if (mood > 0 && majors >= 4 && sim.tick >= 1500) {
      let best = -1, amount = 20; const mid = sw >> 1;
      for (let p = 0; p < MAX_PILES; p++) { const c = sim.pileCell[p]; if (c >= 0 && sim.pileAmount[p] > amount && Math.abs((c % sw) - mid) <= 6) { amount = sim.pileAmount[p]; best = c; } }
      if (best >= 0) out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: [best % sw, Math.floor(best / sw)] });
    }
  }
  return out;
}
