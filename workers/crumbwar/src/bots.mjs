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
  const b = a.brain ??= { bold: 0.3 + w.rand() * 0.6 };
  const [nx, ny] = C.NESTS[a.colony];
  let tx, ty, sprint = false, foe = null, fd = 1e9, threat = null, td = 1e9;
  antsNear(w, a.x, a.y, C.VIEW, o => {
    if (o.colony === a.colony || w.tick < o.protectUntil) return;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    const stronger = !o.carry && (o.tier > a.tier || o.hp > a.hp + 1);
    if (stronger) { if (d < td) { td = d; threat = o; } } else if (d < fd) { fd = d; foe = o; }
  });
  if (a.carry) { tx = nx; ty = ny; sprint = td < 220 || fd < 160; }
  else if (foe && fd < 70 && foe.hp <= a.hp) { tx = foe.x; ty = foe.y; sprint = fd > 30 && a.stamina > 20; } // a fight it is winning: finish it
  else if (a.hp * 2 <= C.TIER_HP[a.tier]) { tx = nx; ty = ny; sprint = td < 250 || fd < 250; }
  else if (threat && td < 170) { tx = a.x * 2 - threat.x; ty = a.y * 2 - threat.y; sprint = td < 110; }
  else if (foe && fd < 200 + 300 * b.bold && (foe.carry || b.bold > 0.3)) { tx = foe.x; ty = foe.y; sprint = fd > 50 && a.stamina > 40; }
  else {
    let best = -1, bd = 1e12;
    foodNear(w, a.x, a.y, C.VIEW, id => { const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2 - (w.fkind[id] === 2 ? 40000 : 0); if (d < bd) { bd = d; best = id; } });
    if (best >= 0) { tx = w.fx[best]; ty = w.fy[best]; }
    else {
      // The middle is public. Search there when nothing is in sight.
      tx = C.WORLD / 2; ty = C.WORLD / 2;
    }
  }
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
