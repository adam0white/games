// Checks and measured play for Ant Promotion: Nemesis. node prototypes/lab/ant-nemesis/bots.mjs [seeds] [minutes]
// 1. the contact rule   2. with no Nemesis the sim matches the main game tick for tick   3. determinism
// 4. a death creates a Nemesis; it persists and gains power   5. each temperament changes measured behaviour
// 6. the careful bot still climbs with a Nemesis in the world   7. the Nemesis can be eaten in play
import assert from 'node:assert/strict';
import * as N from './sim.js';
import * as Main from '../../ant-promotion/sim.js';
const { FORMS, ANT, CONE, encounter, create, step, choose, revive, me, level, crown, powerOf, nemesisMob, nemesisSave, TEMPERAMENT_NAMES, NEM_STEP, optionsFor } = N;
const seeds = Number(process.argv[2] ?? 10), minutes = Number(process.argv[3] ?? 12);
const mid = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// 1. Rule table, copied from the main game's checks. Player: power 50, speed 124.
const P = { power: 50, speed: 124 };
const cells = [
  ['weaker, has not noticed, slower', { power: 40, speed: 104, alert: false }, 'eat'],
  ['weaker, has not noticed, faster (sneak-up)', { power: 40, speed: 150, alert: false }, 'eat'],
  ['weaker, noticed, slower', { power: 40, speed: 104, alert: true }, 'eat'],
  ['weaker, noticed, same speed', { power: 40, speed: 124, alert: true }, 'eat'],
  ['weaker, noticed, faster', { power: 40, speed: 150, alert: true }, 'none'],
  ['stronger, noticed, faster', { power: 60, speed: 150, alert: true }, 'die'],
  ['stronger, noticed, slower (contact)', { power: 60, speed: 104, alert: true }, 'die'],
  ['stronger, has not noticed (contact)', { power: 60, speed: 104, alert: false }, 'die'],
  ['same power', { power: 50, speed: 150, alert: true }, 'none'],
];
for (const [name, mob, want] of cells) { assert.equal(encounter(P, mob), want, name); assert.equal(Main.encounter(P, mob), want, 'main: ' + name); }
assert.equal(encounter.toString(), Main.encounter.toString(), 'encounter() is the main game\'s, unchanged');
console.log(`rule table: ${cells.length} cells pass; encounter() is identical to the main game's`);

// Bots. Written against a sim module so the same policy drives both sims. pow gives a mob's power in that sim.
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
const powMain = m => FORMS[m.f].power;
function careful(s, pow = powerOf) {
  const p = s.player, F = FORMS[p.stack.at(-1)]; let vx = 0, vy = 0, best = null, bd = Infinity;
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = pow(m);
    if (pw > F.power) {
      const reach = M.range * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < CONE + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; }
    } else if (pw < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
  }
  if (best) {
    const M = FORMS[best.f]; let tx = best.x, ty = best.y;
    if (M.speed > F.speed && bd > 40) { const back = Math.min(bd * 0.7, 70); tx -= Math.cos(best.a) * back; ty -= Math.sin(best.a) * back; }
    const d = Math.hypot(tx - p.x, ty - p.y) || 1; vx += (tx - p.x) / d; vy += (ty - p.y) / d;
  }
  return { x: vx, y: vy };
}
function reckless(s, pow = powerOf) {
  const p = s.player, F = FORMS[p.stack.at(-1)]; let best = null, bd = Infinity;
  for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (pow(m) < F.power && d < bd) { bd = d; best = m; } }
  return best ? { x: best.x - p.x, y: best.y - p.y } : { x: 0, y: 0 };
}
const snap = s => [s.tick, s.player.x.toFixed(6), s.player.y.toFixed(6), s.player.xp, s.deaths, s.eaten, s.mobs.length, s.mobs.map(m => m.x.toFixed(3) + ',' + m.y.toFixed(3)).join(';')].join('|');

// 2. Reference check: with no Nemesis (nobody is crowned) the copy runs exactly as the main game.
for (const [name, policy] of [['careful', careful], ['reckless', reckless]]) for (const seed of [1, 2, 3]) {
  const a = create(seed), b = Main.create(seed);
  for (let i = 0; i < 3 * 3600; i++) {
    step(a, policy(a, powerOf)); Main.step(b, policy(b, powMain));
    for (const s of [a, b]) { if (s.choosing) (s === a ? choose : Main.choose)(s, 1); if (s.dead) (s === a ? revive : Main.revive)(s, false); }
    if (i % 600 === 0) assert.equal(snap(a), snap(b), `${name} seed ${seed} tick ${i}`);
  }
  assert.equal(snap(a), snap(b));
}
console.log('reference: with no Nemesis the sim matches the main game tick for tick (2 bots x 3 seeds x 3 min)');

// A run where every death to a stronger animal crowns the killer if no Nemesis is alive.
const KNOBS = t => ({ temperament: t, persistence: 2, territory: 2 });
function play(seed, policy, { ticks, knobs = KNOBS('stalker'), stack, nemesis, pick = 0, onEvent } = {}) {
  const s = create(seed, stack, 0, undefined, nemesis);
  const log = { rise: 0, kills: 0, escapes: 0, eaten: 0, notices: 0, chases: [], chase: 0, idleMoves: [], closing: [], top: 1 };
  for (let i = 0; i < ticks; i++) {
    const nm = nemesisMob(s), before = nm ? { x: nm.x, y: nm.y, alert: nm.alert, d: Math.hypot(nm.x - s.player.x, nm.y - s.player.y) } : null;
    step(s, policy(s));
    for (const e of s.events) {
      if (e.t === 'die' && !s.nemesis && crown(s, e.killer, knobs)) log.rise++;
      if (e.t === 'nemKill') log.kills++;
      if (e.t === 'nemEscape') log.escapes++;
      if (e.t === 'nemEaten') log.eaten++;
      if (e.t === 'notice' && e.nem) log.notices++;
      onEvent?.(e, s);
    }
    const after = nemesisMob(s);
    if (nm && after) {
      if (after.alert) { log.chase += 1 / 60; if (powerOf(after) > me(s).power && powerOf(after) - me(s).power <= 12) log.closing.push(Math.hypot(after.x - s.player.x, after.y - s.player.y) < before.d ? 1 : 0); } else if (log.chase) { log.chases.push(log.chase); log.chase = 0; }
      if (!before.alert && !after.alert) log.idleMoves.push(Math.hypot(after.x - before.x, after.y - before.y) < 1e-9 ? 1 : 0);
    }
    if (s.choosing) choose(s, pick);
    if (s.dead) revive(s, false);
    log.top = Math.max(log.top, level(s));
  }
  return { s, log };
}
const stackTo = (lv, pick = 0) => { const st = [ANT]; for (let l = 2; l <= lv; l++) st.push(optionsFor(l - 1)[pick].id); return st; };

// 3. Determinism: the same seed, inputs and knobs give the same world.
{
  const a = play(7, reckless, { ticks: 4 * 3600 }), b = play(7, reckless, { ticks: 4 * 3600 });
  assert.equal(snap(a.s), snap(b.s)); assert.deepEqual(nemesisSave(a.s), nemesisSave(b.s));
  const c = play(7, reckless, { ticks: 4 * 3600, knobs: KNOBS('brute') });
  assert.ok(a.log.rise > 0, 'the reckless bot made a Nemesis');
  assert.notEqual(snap(a.s), snap(c.s), 'different knobs give a different world');
  console.log('determinism: same seed, inputs and knobs give the same world; other knobs give another');
}

// 4. A bot that dies creates a Nemesis; it stays through deaths and promotions, and gains power on a repeat kill.
{
  let first = null, repeat = null, promoted = false, survivedPromotion = false;
  const { s, log } = play(3, reckless, {
    ticks: 12 * 3600, knobs: KNOBS('brute'),
    onEvent: (e, s) => {
      if (e.t === 'nemRise' && !first) first = { f: e.f, power: powerOf(nemesisMob(s)), id: s.nemesis.id };
      if (e.t === 'nemKill' && !repeat && s.nemesis.id === first.id) repeat = { kills: e.kills, bonus: e.bonus, power: powerOf(nemesisMob(s)) };
      if (e.t === 'full' && first && s.nemesis?.id === first.id) promoted = true; // the bot picks a new form right after this event
      if (promoted && first && ['nemKill', 'nemEscape', 'notice'].includes(e.t) && s.nemesis?.id === first.id) survivedPromotion = true;
    },
  });
  assert.ok(first, 'a death made a Nemesis');
  assert.ok(repeat, 'the Nemesis killed the player again');
  assert.equal(repeat.kills, 2); assert.equal(repeat.bonus, NEM_STEP); assert.equal(repeat.power, first.power + NEM_STEP);
  assert.ok(survivedPromotion, 'the Nemesis stayed through a promotion');
  // saving and loading keeps it
  const saved = nemesisSave(s) ?? { f: first.f, bonus: 10, kills: 2, escapes: 0, kin: 0, knobs: KNOBS('brute') };
  const again = create(99, [ANT], 0, undefined, saved);
  assert.equal(nemesisMob(again).f, saved.f); assert.equal(powerOf(nemesisMob(again)), FORMS[saved.f].power + saved.bonus);
  assert.ok(Math.hypot(nemesisMob(again).x - 1000, nemesisMob(again).y - 1000) > 600, 'a loaded Nemesis starts away from the player');
  console.log(`nemesis: rose as ${FORMS[first.f].name} (power ${first.power}); repeat kill -> power ${repeat.power}; stayed through promotions; reloads from a save. Run: ${log.rise} rise, ${log.kills} repeat kills, ${log.escapes} escapes, ${log.eaten} eaten`);
}
// 4b. A small coward rival (power 20) chases the Ant (power 10) it has just eaten; it does not run from it.
{
  const spider = FORMS.find(f => f.name === 'Spider'), s = create(7, [ANT], 0, undefined, { f: spider.id, bonus: 0, kills: 1, escapes: 0, kin: 0, knobs: KNOBS('coward') });
  const m = nemesisMob(s); m.x = s.player.x + spider.range * 0.5; m.y = s.player.y; m.a = Math.PI; s.player.safe = 0;
  const d0 = Math.hypot(m.x - s.player.x, m.y - s.player.y);
  for (let i = 0; i < 30 && !s.dead; i++) step(s, { x: 0, y: 0 });
  assert.ok(Math.hypot(m.x - s.player.x, m.y - s.player.y) < d0 - 20, 'a coward Spider comes at an Ant (here it reaches and eats it)');
  console.log('coward: a power 20 coward chases a power 10 Ant (flee margin is at most a quarter of its power)');
}

// 5. Temperaments. Same seeds and Nemesis form; only the temperament changes. Player starts at level 3 against a level 5
// Nemesis. Two test subjects: the reckless bot ignores danger (catches per minute), and the wary bot eats like the
// reckless one but runs straight away from the Nemesis once it has noticed (chase length, escapes).
function wary(s) {
  const n = nemesisMob(s), p = s.player;
  if (n && n.alert && powerOf(n) > me(s).power) return { x: p.x - n.x, y: p.y - n.y };
  return reckless(s);
}
{
  const nemForm = optionsFor(4)[0].id, rows = {}, mins = 4;
  const measure = (policy, t, stack) => {
    const chases = [], idle = [], closing = [], per = { kills: 0, escapes: 0, notices: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      const { log } = play(seed, policy, { ticks: mins * 3600, stack, nemesis: { f: nemForm, bonus: 0, knobs: KNOBS(t) } });
      chases.push(...log.chases); idle.push(...log.idleMoves); closing.push(...log.closing);
      per.kills += log.kills; per.escapes += log.escapes; per.notices += log.notices;
    }
    return { chase: mean(chases), closing: mean(closing), chases: chases.length, idle: mean(idle), kpm: per.kills / (seeds * mins), epm: per.escapes / (seeds * mins), npm: per.notices / (seeds * mins) };
  };
  // fast: a fast, weaker player that can outrun the slow Nemesis once it runs; close: a player one level below it
  for (const t of TEMPERAMENT_NAMES) rows[t] = { r: measure(reckless, t, stackTo(3)), w: measure(wary, t, stackTo(3, 1)), close: measure(wary, t, stackTo(4)) };
  console.log(`\ntemperaments, ${seeds} seeds x ${mins} min each. Nemesis: ${FORMS[nemForm].name}, level 5, power ${FORMS[nemForm].power}, slow.`);
  console.log(`  A: wary bot as a level 3 ${FORMS[stackTo(3, 1).at(-1)].name} (fast). B: reckless bot as a level 3 ${FORMS[stackTo(3).at(-1)].name}. C: wary bot as a level 4 ${FORMS[stackTo(4).at(-1)].name} (power ${FORMS[stackTo(4).at(-1)].power}); \"closing in\" counts alert ticks while the Nemesis is stronger by 12 or less.`);
  console.log('temperament  A: still while   A: notices  A: mean     A: escapes  B: catches  C: closing in   C: catches');
  console.log('             unalerted        per min     chase s     per min     per min     while alert    per min');
  for (const [t, { r, w, close }] of Object.entries(rows)) console.log(`${t.padEnd(12)} ${(w.idle * 100).toFixed(0).padStart(9)}%     ${w.npm.toFixed(2).padStart(10)} ${w.chase.toFixed(2).padStart(10)} ${w.epm.toFixed(2).padStart(11)} ${r.kpm.toFixed(2).padStart(11)} ${(close.closing * 100).toFixed(0).padStart(11)}%   ${close.kpm.toFixed(2).padStart(10)}`);
  assert.ok(rows.ambusher.w.idle > rows.stalker.w.idle + 0.2, 'an ambusher stands still more while waiting');
  assert.ok(rows.brute.w.chase > rows.coward.w.chase, 'a brute chases longer than a coward');
  assert.ok(rows.ambusher.w.npm > rows.brute.w.npm, 'an ambusher notices more often (wider wedge)');
  assert.ok(rows.coward.close.closing < 0.5 && rows.brute.close.closing > 0.5, 'a coward runs from a player close to its power; a brute closes in');
}

// 6. The careful bot still climbs with a Nemesis in the world, next to the main game's numbers.
{
  console.log(`\ncareful bot, ${seeds} seeds x ${minutes} min, a level 3 Nemesis present from the start (median highest level / median deaths):`);
  const head = ['pick', 'main game', ...TEMPERAMENT_NAMES];
  console.log(head.map(h => h.padEnd(12)).join(''));
  for (const pick of [0, 1, 2]) {
    const cells = [];
    { const tops = [], deaths = []; for (let seed = 1; seed <= seeds; seed++) { const s = Main.create(seed); let top = 1; for (let i = 0; i < minutes * 3600; i++) { Main.step(s, careful(s, powMain)); if (s.choosing) Main.choose(s, pick); if (s.dead) Main.revive(s, false); top = Math.max(top, Main.level(s)); } tops.push(top); deaths.push(s.deaths); } cells.push(`${mid(tops)} / ${mid(deaths)}`); }
    for (const t of TEMPERAMENT_NAMES) {
      const tops = [], deaths = [];
      for (let seed = 1; seed <= seeds; seed++) { const { s, log } = play(seed, careful, { ticks: minutes * 3600, pick, nemesis: { f: optionsFor(2)[pick].id, bonus: 0, knobs: KNOBS(t) } }); tops.push(log.top); deaths.push(s.deaths); }
      cells.push(`${mid(tops)} / ${mid(deaths)}`);
      assert.ok(mid(tops) >= 6, `careful bot climbs with a ${t} Nemesis (pick ${pick})`);
    }
    console.log([['strong', 'fast', 'sneaky'][pick], ...cells].map(h => h.padEnd(12)).join(''));
  }
}

// 7. The payoff can happen in play: a bot that is reckless until its first death, then careful, grows past and eats the Nemesis.
{
  let eaten = 0; const when = [];
  for (let seed = 1; seed <= seeds; seed++) {
    let died = false, at = null;
    const { log } = play(seed, x => (died ? careful(x) : reckless(x)), { ticks: minutes * 3600, knobs: KNOBS(TEMPERAMENT_NAMES[seed % 4]), onEvent: (e, s) => { if (e.t === 'die') died = true; if (e.t === 'nemEaten' && at === null) at = s.t / 60; } });
    if (log.eaten) { eaten++; when.push(at); }
  }
  console.log(`\npayoff: reckless-then-careful bot ate its Nemesis in ${eaten}/${seeds} runs (median at ${mid(when)?.toFixed(1) ?? '-'} min)`);
  assert.ok(eaten >= Math.ceil(seeds / 2), 'the Nemesis can be eaten in play');
}
console.log('\nall nemesis checks pass');
