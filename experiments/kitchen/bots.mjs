// Bots for the catch: how hard is each star? node experiments/kitchen/bots.mjs [runs] [--mutate]
// A bot sees the falling items `react` seconds late and moves the tray at most TUNE.traySpeed.
// It chases the lowest item it still needs and steps away from an item it does not want that is about to land.
// --mutate breaks the rule that an extra stops the catch; the check must then fail.
import assert from 'node:assert/strict';
import * as sim from './sim.js';

const runs = Number(process.argv[2]) || 60;
const mutate = process.argv.includes('--mutate');

function play({ need, hard, trayLevel, seed, react, skill }) {
  const c = sim.newCatch({ need, hard, trayLevel, seed });
  const seen = []; let x = 0, extras = 0;
  for (let step = 0; step < 60 * 180 && !c.done; step++) {
    seen.push(c.items.map(it => ({ ...it })));
    const view = seen[Math.max(0, seen.length - 1 - Math.round(react * 60))];
    const wanted = it => !sim.isJunk(it.id) && (c.got[it.id] ?? 0) < (c.need[it.id] ?? 0);
    const goals = view.filter(wanted).sort((a, b) => a.y - b.y);
    let target = goals.length ? goals[0].x : x;
    for (const it of view) {
      if (wanted(it) || it.y > 0.35) continue;
      if (Math.abs(it.x - target) < c.half + sim.TUNE.size * 0.6) target = it.x + Math.sign(target - it.x || 1) * (c.half + sim.TUNE.size + 0.05);
    }
    target += (Math.sin(step * 0.13 + seed) * (1 - skill)) * 0.25; // a hand is never exact
    const move = sim.TUNE.traySpeed * sim.DT;
    x += Math.max(-move, Math.min(move, target - x));
    const ev = sim.stepCatch(c, x);
    if (ev.some(e => e.type === 'extra')) { extras++; if (mutate) { c.extra = null; } else sim.tossExtra(c); }
  }
  return { done: c.done, t: c.t, extras };
}

const rows = [];
for (const [label, save] of [
  ['cart day 1', { tier: 0, dayAtTier: 0, built: { tray: 1 } }],
  ['cart day 4', { tier: 0, dayAtTier: 3, built: { tray: 2 } }],
  ['diner', { tier: 1, dayAtTier: 1, built: { tray: 2 } }],
  ['bistro', { tier: 2, dayAtTier: 1, built: { tray: 3 } }],
  ['restaurant', { tier: 3, dayAtTier: 1, built: { tray: 4 } }],
  ['fine', { tier: 4, dayAtTier: 2, built: { tray: 5 } }],
  ['five stars', { tier: 5, dayAtTier: 4, built: { tray: 6 } }],
]) {
  const hard = sim.hardness(save);
  const menu = sim.RECIPE_IDS.filter(id => sim.RECIPES[id].tier <= save.tier);
  for (const [who, react, skill] of [['new', 0.45, 0.6], ['good', 0.25, 0.9]]) {
    let clean = 0, time = 0, extras = 0;
    for (let i = 0; i < runs; i++) {
      const need = sim.RECIPES[menu[i % menu.length]].need;
      const r = play({ need, hard, trayLevel: save.built.tray, seed: 1000 + i, react, skill });
      if (r.done && r.extras === 0) clean++; time += r.t; extras += r.extras;
    }
    rows.push({ label, who, hard: +hard.toFixed(1), clean: clean / runs, seconds: +(time / runs).toFixed(1), extras: +(extras / runs).toFixed(2) });
  }
}
console.table(rows);

// What the curve must look like: easy at first, harder later, never hopeless for a good player.
const get = (label, who) => rows.find(r => r.label === label && r.who === who);
assert.ok(get('cart day 1', 'new').clean >= 0.7, 'a new player finishes most first catches without an extra');
assert.ok(get('five stars', 'good').clean >= 0.2, 'five stars stays possible for a good player');
assert.ok(get('five stars', 'new').clean < get('cart day 1', 'new').clean - 0.3, 'five stars is clearly harder than day 1');
assert.ok(get('cart day 1', 'good').seconds < 30, 'a first catch takes under half a minute');
if (mutate) assert.ok(rows.every(r => r.extras === 0), 'mutation: extras no longer stop a catch');
console.log('bots: ok');
