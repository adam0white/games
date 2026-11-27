// Bots for the catch: how hard is each star? node experiments/kitchen/bots.mjs [runs] [--mutate]
// A bot sees the falling items `react` seconds late and moves the tray at most TUNE.traySpeed.
// It chases the lowest item it still needs and steps away from an item it does not want that is about to land.
// --mutate breaks the rule that an extra stops the catch; the check must then fail.
import assert from 'node:assert/strict';
import * as sim from './sim.js';

const runs = Number(process.argv[2]) || 60;
const mutate = process.argv.includes('--mutate');

function play({ need, hard, trayLevel, seed, react, skill, twist = null }) {
  const c = sim.newCatch({ need, hard, trayLevel, seed, twist });
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
  ['garden', { tier: 6, dayAtTier: 2, built: { tray: 7 } }],
  ['galley', { tier: 7, dayAtTier: 2, built: { tray: 7 } }],
  ['cloud', { tier: 8, dayAtTier: 2, built: { tray: 8 } }],
  ['starlight', { tier: 9, dayAtTier: 2, built: { tray: 8 } }],
  ['top table', { tier: 10, dayAtTier: 4, built: { tray: 9 } }],
]) {
  const hard = sim.hardness(save);
  const menu = sim.RECIPE_IDS.filter(id => sim.RECIPES[id].tier <= save.tier);
  for (const [who, react, skill] of [['new', 0.45, 0.6], ['good', 0.25, 0.9]]) {
    let clean = 0, time = 0, extras = 0;
    for (let i = 0; i < runs; i++) {
      const need = sim.RECIPES[menu[i % menu.length]].need;
      const r = play({ need, hard, trayLevel: save.built.tray, seed: 1000 + i, react, skill, twist: sim.twistFor(save.tier) });
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
assert.ok(get('top table', 'good').clean >= 0.1, 'the top table stays possible for a good player');
assert.ok(get('top table', 'good').clean <= get('five stars', 'good').clean + 0.05, 'the ranks above five stars are not easier than five stars');
assert.ok(get('five stars', 'new').clean < get('cart day 1', 'new').clean - 0.3, 'five stars is clearly harder than day 1');
assert.ok(get('cart day 1', 'good').seconds < 30, 'a first catch takes under half a minute');
if (mutate) assert.ok(rows.every(r => r.extras === 0), 'mutation: extras no longer stop a catch');
// Variety (Adam 2026-11-26: "everybody wanted carrots, then everybody wants hot dogs"): every rank offers at least
// five dishes, a day never serves the same dish twice in a row, and no dish takes more than half of a day.
for (let tier = 0; tier < sim.TIERS.length; tier++) {
  const save = { ...sim.newSave(), tier, built: { tray: 3, knife: 3, stove: 1, micro: 1, blender: 1, tables: 3, decor: 1 } };
  const menu = sim.menuFor(save);
  assert.ok(menu.length >= 5, `rank ${sim.TIERS[tier].name} offers ${menu.length} dishes, want 5 or more`);
  const seen = new Set();
  for (let d = 0; d < 30; d++) {
    const plan = sim.dayPlan(save, 77 + d * 131 + tier).map(p => p.recipe);
    plan.forEach(r => seen.add(r));
    for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i], plan[i - 1], `rank ${tier} day ${d}: ${plan[i]} twice in a row`);
    const most = Math.max(...plan.map(r => plan.filter(x => x === r).length));
    assert.ok(most <= Math.ceil(plan.length / 2), `rank ${tier} day ${d}: one dish takes ${most} of ${plan.length}`);
  }
  assert.ok(seen.size >= Math.min(menu.length, 8), `rank ${tier}: 30 days served only ${seen.size} of ${menu.length} dishes`);
}
console.log('bots: ok');

// ---------- the story: beats come in order, missed plot beats catch up, missions count and pay, mission dishes get served
{
  const story = await import('./story.js');
  const { readFileSync } = await import('node:fs');
  const beats = JSON.parse(readFileSync(new URL('./story/beats.json', import.meta.url)));
  const specials = JSON.parse(readFileSync(new URL('./story/specials.json', import.meta.url))).specials;
  for (const b of beats) {
    for (const l of b.lines) assert.ok(l.length <= 90, `${b.id}: line too long`);
    if (b.mission?.goal.type === 'dish') assert.ok(sim.RECIPES[b.mission.goal.dish], `${b.id}: unknown dish ${b.mission.goal.dish}`);
  }
  const fresh = () => ({ v: 1, coins: 0, tier: 0, day: 1, served: 0, best: 0, tutorial: true, sound: true, dayAtTier: 0, built: { tray: 1, knife: 1, stove: 0, micro: 0, blender: 0, tables: 1, decor: 1 } });
  const s0 = fresh();
  const d1 = story.due(s0, beats);
  assert.equal(d1.cards[0].id, beats[0].id, 'the first card is the opening');
  assert.ok(d1.cards.every(b => b.rank === 0 && b.day === 1), 'day 1 shows only day-1 beats');
  // A player who jumps to rank 2 still gets every spine beat, three cards a day at most.
  const s2 = { ...fresh(), tier: 2, dayAtTier: 0 };
  const spine = beats.filter(b => b.spine && (b.rank < 2 || (b.rank === 2 && b.day === 1))).map(b => b.id);
  const shown = [];
  for (let d = 0; d < 12; d++) { const { cards } = story.due(s2, beats); assert.ok(cards.length <= 3); for (const b of cards) { story.see(s2, b); shown.push(b.id); } }
  for (const id of spine) assert.ok(shown.includes(id), `spine beat ${id} never shown after a quick rank-up`);
  // A dish mission counts the right dish only, and pays once.
  const s3 = fresh(); const m = beats.find(b => b.mission?.goal.type === 'dish'); story.see(s3, m);
  const coins0 = s3.coins;
  story.count(s3, { type: 'serve', recipe: '__nope', stars: 3, tip: 1, coins: 5 });
  assert.equal(s3.story.open.length, 1, 'the wrong dish does not finish it');
  for (let i = 0; i < m.mission.goal.n; i++) story.count(s3, { type: 'serve', recipe: m.mission.goal.dish, stars: 1, tip: 0, coins: 5 });
  assert.equal(s3.story.open.length, 0); assert.equal(s3.coins - coins0, m.reward, 'mission pays its reward once');
  // The day plan serves a mission dish that is on the menu.
  const plan = story.forceDishes(sim.dayPlan(s0, 5), ['sticks'], sim.menuFor(s0));
  assert.ok(plan.some(p => p.recipe === 'sticks'));
  // Specials: one a day, deterministic, countable.
  const sp = story.pickSpecial(s0, specials, sim.menuFor(s0), 77);
  assert.ok(sp && story.COUNTABLE.has(sp.goal.type) && sp.pay > 0);
  console.log('story: ok');
}

// Every rank must be reachable: what rank t needs must be buildable at rank t-1, at a real price.
for (let t = 1; t < sim.TIERS.length; t++) for (const [k, v] of Object.entries(sim.TIERS[t].needs ?? {})) {
  assert.ok(v <= sim.BUILDINGS[k].max[t - 1], `rank ${sim.TIERS[t].name} needs ${k} ${v}, but rank ${sim.TIERS[t - 1].name} caps it at ${sim.BUILDINGS[k].max[t - 1]}`);
  for (let l = 1; l <= v; l++) assert.ok(Number.isFinite(sim.BUILDINGS[k].cost(l)), `${k} level ${l} has no price`);
}
for (const k of sim.BUILDING_IDS) for (let l = 1; l <= sim.BUILDINGS[k].max.at(-1); l++) assert.ok(Number.isFinite(sim.BUILDINGS[k].cost(l)), `${k} level ${l} has no price`);
console.log('ranks reachable: ok');
