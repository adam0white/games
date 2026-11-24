// Bots fill a room when people are few. A bot is an ordinary ant: it sees the same square a client is sent
// (VIEW), acts through setInput like a client, and gets no numbers a player lacks. It decides four times a
// second, on a tick staggered by its id, with a small aim error, so it reacts later and steers worse than a
// practised person. Bots are marked as bots on the wire and the page labels them.
import * as C from '../public/crumbwar/shared/config.js';
import { byteOf } from '../public/crumbwar/shared/move.js';
import { addAnt, removeAnt, setInput, antsNear, foodNear } from './sim.mjs';

export const MIN_ANTS = 32; // eight ants per colony; bots make up the difference
const THINK = 5;

export function think(w, a) {
  if (!a.alive || (w.tick + a.id) % THINK) return;
  // Two foragers, one raider and one guard per four ids. Roles and passing
  // sides survive respawns; reaction time and aim error stay the same.
  const b = a.brain ??= { role: a.id % 4, side: a.id % 2 ? 1 : -1, retreat: false };
  const [nx, ny] = C.NESTS[a.colony];
  const visible = [];
  let tx, ty, sprint = false, foe = null, bestPriority = Infinity, td = Infinity;
  antsNear(w, a.x, a.y, C.VIEW, o => { if (o !== a) visible.push(o); });
  for (const o of visible) {
    if (o.colony === a.colony || w.tick < o.protectUntil) continue;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    td = Math.min(td, d);
    const vulnerable = o.carry || o.hp < C.TIER_HP[o.tier];
    const defending = b.role === 2 && Math.hypot(o.x - nx, o.y - ny) < C.NEST_R + 200;
    const reach = defending ? 300 : vulnerable ? [150, 330, 180, 150][b.role] : [85, 200, 150, 85][b.role];
    if (d >= reach) continue;
    // Yield behind two healthy allies for an ordinary duel, three for a
    // vulnerable target. The 12-unit tolerance avoids switching on small
    // distance changes. This is admission by visible position, not a reservation.
    const limit = vulnerable ? 3 : 2;
    let closer = 0;
    for (const p of visible) if (p.colony === a.colony && !p.carry && p.hp > C.TIER_HP[p.tier] * 0.4 && w.tick >= p.protectUntil &&
      Math.hypot(p.x - o.x, p.y - o.y) < d - 12) closer++;
    if (closer >= limit) continue;
    const priority = d - (o.carry ? 140 : 0) - (C.TIER_HP[o.tier] - o.hp) * 25 - (b.target === o.id ? 30 : 0);
    if (priority < bestPriority) { bestPriority = priority; foe = o; }
  }
  const fd = foe ? Math.hypot(foe.x - a.x, foe.y - a.y) : Infinity;
  const maxHP = C.TIER_HP[a.tier];
  const retreatHP = b.role === 1 ? 1 : Math.floor(maxHP * (b.role === 2 ? 0.3 : 0.4));
  if (a.hp <= retreatHP) b.retreat = true;
  if (a.hp >= maxHP) b.retreat = false;
  if (a.carry || b.retreat) {
    tx = nx; ty = ny; sprint = td < 220;
    // Heal inside the safe nest without converging on its exact centre.
    if (!a.carry) { const t = a.id * 2.4; tx += Math.cos(t) * 95; ty += Math.sin(t) * 95; }
  } else if (foe) {
    b.target = foe.id;
    // Foragers defend nearby, raiders pursue farther, guards pursue between those ranges. Approach the rear quarter.
    // At bite range face the target itself.
    const flank = fd > 55 ? 12 : 0;
    tx = foe.x - Math.cos(foe.heading) * flank - Math.sin(foe.heading) * flank * b.side;
    ty = foe.y - Math.sin(foe.heading) * flank + Math.cos(foe.heading) * flank * b.side;
    sprint = fd > 80 && a.stamina > 40;
  } else {
    b.target = null;
    let best = -1, bd = Infinity;
    foodNear(w, a.x, a.y, C.VIEW, id => {
      const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2 - (w.fkind[id] === 2 ? 16000 : 0);
      if (d < bd) { bd = d; best = id; }
    });
    if (best >= 0) { tx = w.fx[best]; ty = w.fy[best]; }
    else { tx = C.WORLD / 2; ty = C.WORLD / 2; }
  }
  // Steering changes input only. Give allies room and leave crowded fights.
  let sx = 0, sy = 0;
  for (const o of visible) {
    const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy);
    const radius = o.colony === a.colony ? 100 : (a.carry || b.retreat || o !== foe ? 75 : 0);
    if (d >= radius) continue;
    const t = (a.id + o.id) * 2.4, sign = a.id < o.id ? 1 : -1;
    const ux = d > 0.01 ? dx / d : Math.cos(t) * sign;
    const uy = d > 0.01 ? dy / d : Math.sin(t) * sign;
    const weight = (1 - d / radius) * 2.5;
    sx += ux * weight; sy += uy * weight;
  }
  const goal = Math.hypot(tx - a.x, ty - a.y) || 1;
  tx = a.x + (tx - a.x) / goal + sx;
  ty = a.y + (ty - a.y) / goal + sy;
  // An enemy nest hurts. Walk away from one that is close, whatever the plan was.
  for (let c = 0; c < C.COLONIES; c++) {
    if (c === a.colony) continue;
    const dx = a.x - C.NESTS[c][0], dy = a.y - C.NESTS[c][1];
    if (dx * dx + dy * dy < (C.NEST_R + 50) ** 2) { tx = a.x + dx; ty = a.y + dy; }
  }
  const aim = Math.atan2(ty - a.y, tx - a.x) + (w.rand() - 0.5) * 0.35;
  const angle = byteOf(aim);
  if (angle !== a.angle || !a.move || sprint !== a.sprint) setInput(w, a, angle, true, sprint);
}

// Makes the bot count match the people in the room. Every colony gets the same number of ants: the larger of
// MIN_ANTS / 4 and the most people any colony has. Bots leave as people join, and return when they leave.
export function balance(w) {
  const people = [0, 0, 0, 0], bots = [[], [], [], []];
  for (const a of w.ants) if (a) (a.bot ? bots[a.colony].push(a) : people[a.colony]++);
  const each = Math.max(MIN_ANTS / C.COLONIES, ...people);
  for (let c = 0; c < C.COLONIES; c++) {
    let want = each - people[c];
    while (bots[c].length > want) removeAnt(w, bots[c].sort((x, y) => y.score - x.score).pop()); // the weakest leaves
    while (bots[c].length < want) {
      const a = addAnt(w, c, true, w.rand() * C.NAMES_A.length | 0, w.rand() * C.NAMES_B.length | 0);
      if (!a) return;
      bots[c].push(a);
    }
  }
}

// The colony a new person joins: fewest people, then lowest score. Nobody picks their own side.
export function pickColony(w) {
  const people = [0, 0, 0, 0];
  for (const a of w.ants) if (a && !a.bot) people[a.colony]++;
  let best = 0;
  for (let c = 1; c < C.COLONIES; c++) if (people[c] < people[best] || (people[c] === people[best] && w.colonyScore[c] < w.colonyScore[best])) best = c;
  return best;
}
