// The rival's mind. It reads the sim's state and queues the same orders a player can, under its own seat, so its
// play is in the order log and a run replays without it. It keeps no state of its own.
//
// It knows where every pile is (there is no fog yet; when sight arrives it gets the same sight as a player).

import { CMD, KIND, CG, TRAILS, PATH_MAX, MAX_PILES, FOOD, TEAMS } from './sim.js';

export const THINK_EVERY = 20;

/** The orders this seat gives now. `mood`: 0 timid (never raids), 1 steady, 2 bold (raids early). */
export function think(sim, t, mood = 1) {
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
  const diet = adults < 36 ? 0 : adults < 60 ? 1 : 2;
  if (cg[o + CG.DIET] !== diet) out.push({ team: t, type: CMD.DIET, share: diet });
  // Defence: enemies by the door call the guard and the resting to it.
  let foes = 0;
  for (let i = 0; i < sim.n; i++) if (sim.team[i] !== t && sim.hp[i] > 0 && sim.layer[i] === 0 && Math.abs((sim.x[i] >> 8) - dx) <= 10 && Math.abs((sim.y[i] >> 8) - dy) <= 10) foes++;
  if (foes >= 3 && cg[o + CG.RALLY_HOLD] < 100) out.push({ team: t, type: CMD.RALLY, x: dx, y: dy, hold: 400 });
  // Attack: with enough majors, raid the enemy's door; pull back when the raid is spent.
  const need = mood === 2 ? 6 : 10, from = mood === 2 ? 2400 : 4200;
  if (mood > 0 && !raids.length && majors >= need && sim.tick >= from && live.length < TRAILS) {
    for (let e = 0; e < TEAMS; e++) if (e !== t && cg[e * CG.SIZE + CG.QUEEN_HP] > 0) {
      const ed = sim.door[e];
      out.push({ team: t, type: CMD.TRAIL, kind: KIND.RAID, level: majors >= need * 2 ? 3 : 2, points: [ed % sw, Math.floor(ed / sw)] });
      break;
    }
  } else if (raids.length && majors < 3) for (const k of raids) out.push({ team: t, type: CMD.ERASE, trail: k });
  return out;
}
