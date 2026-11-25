// Proves the creature rig and measures the run it is drawn on: node experiments/lab/ant-creatures/bots.mjs [--mutate[=gait|clamp|spine]]
// 1. Every species of Ant Promotion builds and walks 10,000 steps of random motion (walks, runs, pounces, snap turns, jumps)
//    without a NaN; spine and chain segments keep their lengths; feet never reach past the leg; the gait alternates.
// 2. Determinism: same seed and inputs give the same pose, number for number.
// 3. The rigs ride on the real sim (imported from ant-promotion) for whole runs, every animal on the field at once.
// 4. The run itself (rules from ant-promotion/sim.js, not changed here): a clumsy bot finishes level 1, a careful bot climbs,
//    and the clumsy bot's success falls as the levels rise.
// --mutate breaks one rule in rig.js (a test-only switch): gait (default) lets every leg step when it likes; clamp stops
// holding feet within the leg; spine lets points drift instead of keeping their distance. Each must make a check fail.
import { FORMS, ANT, TOP, create, step, choose, revive, me, level, powerOf, sightOf, optionsFor, needFor, SPAWN_WEIGHTS } from './sim.js';
import { build, update, numbers, mutate } from './rig.js';
import { speciesFor, creature } from './creature.js';

const arg = process.argv.find(a => a.startsWith('--mutate'));
if (arg) { const m = arg.split('=')[1] || 'gait'; mutate(m); console.log(`MUTATION ON: ${m}`); }
let failed = 0;
const claim = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; };
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const DT = 1 / 60, TAU = Math.PI * 2;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// What the rig promises, measured from the outside on its points.
function measure(c, m) {
  const { spec, r } = c;
  for (let i = 1; i < c.spine.length; i++) { const g = spec.gaps[i - 1] * r, d = Math.hypot(c.spine[i].x - c.spine[i - 1].x, c.spine[i].y - c.spine[i - 1].y); m.seg = Math.max(m.seg, Math.abs(d - g) / g); }
  for (const ch of c.chains) for (let k = 1; k < ch.pts.length; k++) { const g = ch.C.seg * r, p = ch.pts[k], q = ch.pts[k - 1]; m.chain = Math.max(m.chain, Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - g) / g); }
  for (const l of c.legs) {
    m.stretch = Math.max(m.stretch, Math.hypot(l.foot.x - l.hip.x, l.foot.y - l.hip.y) / l.len);
    const s = c.spine[l.L.at], reachFromSpine = l.len + spec.pts[l.L.at] * r * l.L.out + Math.abs(l.L.fwd) * r; // the hip itself sits on the body
    m.spineFoot = Math.max(m.spineFoot, Math.hypot(l.foot.x - s.x, l.foot.y - s.y) / reachFromSpine);
    const kn = Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y), fk = Math.hypot(l.foot.x - l.knee.x, l.foot.y - l.knee.y); // the knee splits the leg in two halves
    m.knee = Math.max(m.knee, Math.abs(kn - l.len / 2) / l.len, Math.abs(fk - l.len / 2) / l.len);
  }
  if (!numbers(c).every(Number.isFinite)) m.nan++;
}

// A random walker: rest, walk, run and pounce phases; mob-style turns and player-style snap turns; now and then a jump.
function walk(F, seed, steps = 10000, onStep = null) {
  const R = rng(seed), c = creature(F, 0, 0, 0), m = { seg: 0, chain: 0, stretch: 0, spineFoot: 0, knee: 0, nan: 0, drag: { walk: [0, 0], run: [0, 0], pounce: [0, 0] } };
  let x = 0, y = 0, a = 0, want = 0, v = 0, mode = 'rest', left = 0, snap = false;
  for (let i = 0; i < steps; i++) {
    if ((left -= DT) <= 0) {
      const roll = R(); mode = roll < 0.15 ? 'rest' : roll < 0.6 ? 'walk' : roll < 0.9 ? 'run' : 'pounce'; left = 0.3 + R() * 2.2;
      v = { rest: 0, walk: 0.38 * F.speed, run: F.speed, pounce: Math.min(2.5 * F.speed, 360) }[mode];
      want = a + (R() - 0.5) * 4; snap = R() < 0.25;
      if (R() < 0.03) { x += (R() - 0.5) * 1200; y += (R() - 0.5) * 1200; } // a jump: spawn, revive, thrown clear
    }
    if (snap) a = want; else a += Math.max(-7 * DT, Math.min(7 * DT, wrap(want - a)));
    x += Math.cos(a) * v * DT; y += Math.sin(a) * v * DT;
    const d0 = c.stat.drag, f0 = c.stat.legFrames;
    update(c, x, y, a, DT, R() < 0.5 ? { x: x + 100, y: y - 40 } : null);
    if (mode !== 'rest') { const b = m.drag[mode]; b[0] += c.stat.drag - d0; b[1] += c.stat.legFrames - f0; }
    measure(c, m); onStep?.(c, i);
  }
  return { c, m };
}

// ---------- 1. every species
const t0 = Date.now(), worst = { seg: 0, chain: 0, stretch: 0, spineFoot: 0, knee: 0, nan: 0 }, drag = { walk: [0, 0], run: [0, 0], pounce: [0, 0] };
let overlap = 0, waves = 0, alts = 0, walkers = 0, legless = 0, resets = 0;
const perAlt = [];
for (const F of FORMS) {
  const { spec } = speciesFor(F);
  const { c, m } = walk(F, 1000 + F.id);
  for (const k of Object.keys(worst)) worst[k] = k === 'nan' ? worst[k] + m.nan : Math.max(worst[k], m[k]);
  for (const k of Object.keys(drag)) { drag[k][0] += m.drag[k][0]; drag[k][1] += m.drag[k][1]; }
  if (m.nan) console.log(`     NaN in ${F.name}`);
  if (spec.gait === 'walk' && c.legs.length) { walkers++; overlap += c.stat.overlap; waves += c.stat.waves; alts += c.stat.alts; perAlt.push([F.name, c.stat.alts / Math.max(1, c.stat.waves), c.stat.waves]); }
  if (!c.legs.length) legless++;
  resets += c.stat.resets;
}
const pct = ([a, b]) => (100 * a / Math.max(1, b)).toFixed(2) + '%';
console.log(`species: ${FORMS.length} built and walked 10,000 steps each in ${((Date.now() - t0) / 1000).toFixed(1)} s (${walkers} walk on legs, ${legless} without legs, ${resets} jumps re-laid)`);
claim(worst.nan === 0, `no NaN or Infinity in any rig number (${worst.nan} bad steps)`);
claim(worst.seg < 1e-6, `spine segments keep their length: worst error ${(worst.seg * 100).toExponential(2)}%`);
claim(worst.chain < 1e-6, `chain segments (antennae, tails, necks, trunks, stings) keep their length: worst error ${(worst.chain * 100).toExponential(2)}%`);
claim(worst.stretch <= 0.98 + 1e-9, `no foot is ever further from its hip than the leg: worst ${(worst.stretch * 100).toFixed(2)}% of leg length`);
claim(worst.spineFoot <= 1 + 1e-9, `no foot is further from its body point than leg plus hip offset: worst ${(worst.spineFoot * 100).toFixed(1)}%`);
claim(worst.knee < 1e-6, `IK: hip-knee and knee-foot are each half the leg (worst error ${(worst.knee * 100).toExponential(2)}% of the leg)`);
claim(overlap === 0, `gait: the two leg groups never step at the same time (${overlap} frames where both did)`);
const altRate = alts / Math.max(1, waves), worstAlt = perAlt.reduce((w, p) => (p[1] < w[1] ? p : w), ['', 1, 0]);
claim(altRate > 0.9 && worstAlt[1] > 0.8, `gait: consecutive steps alternate groups ${(altRate * 100).toFixed(1)}% of ${waves} waves (lowest: ${worstAlt[0]} ${(worstAlt[1] * 100).toFixed(0)}% of ${worstAlt[2]})`);
console.log(`     feet dragged (the leg reached its end before a step came): walking ${pct(drag.walk)}, running ${pct(drag.run)}, pouncing ${pct(drag.pounce)} of leg-frames`);
{ // steady driving on a curving path: the feet must step, not slide
  let wd = [0, 0], rd = [0, 0], worstName = '', worst = 0;
  for (const F of FORMS) {
    if (speciesFor(F).spec.gait !== 'walk' || !speciesFor(F).spec.legs.length) continue;
    for (const [mul, acc] of [[0.38, wd], [1, rd]]) {
      const c = creature(F, 0, 0, 0); let x = 0, y = 0, a = 0;
      for (let i = 0; i < 1200; i++) { a += Math.sin(i / 90) * 0.02; x += Math.cos(a) * F.speed * mul * DT; y += Math.sin(a) * F.speed * mul * DT; update(c, x, y, a, DT); }
      acc[0] += c.stat.drag; acc[1] += c.stat.legFrames; const k = c.stat.drag / c.stat.legFrames; if (k > worst) { worst = k; worstName = `${F.name} at ${mul === 1 ? 'a run' : 'a walk'}`; }
    }
  }
  claim(wd[0] / wd[1] < 0.01 && rd[0] / rd[1] < 0.02, `steady walking feet step rather than slide: dragged ${pct(wd)} of leg-frames at a walk, ${pct(rd)} at a run (worst ${worstName} ${(worst * 100).toFixed(1)}%)`);
}
// a snap turn: the player reverses in one tick (the sim sets p.a straight from the stick)
{
  const F = FORMS.find(f => f.name === 'Lizard'), c = creature(F, 0, 0, 0); let x = 0, flips = 0, maxJump = 0;
  for (let i = 0; i < 600; i++) {
    const a = Math.floor(i / 40) % 2 ? Math.PI : 0; if (i % 40 === 0) flips++;
    x += Math.cos(a) * F.speed * DT; const before = c.spine.map(p => ({ ...p }));
    update(c, x, 0, a, DT);
    for (let k = 0; k < c.spine.length; k++) maxJump = Math.max(maxJump, Math.hypot(c.spine[k].x - before[k].x, c.spine[k].y - before[k].y));
  }
  claim(maxJump < F.r * 1.2, `a snap reversal (${flips} flips) moves no body point more than ${(maxJump / F.r).toFixed(2)} r in one frame (limit 1.2 r)`);
}

// ---------- 2. determinism
{
  const F = FORMS.find(f => f.name === 'Fire Ant'), run = seed => JSON.stringify(numbers(walk(F, seed, 3000).c));
  claim(run(7) === run(7), 'determinism: the same seed and inputs give the same pose, every number');
  claim(run(7) !== run(8), 'a different seed gives a different pose');
}

// ---------- 3 and 4. on the real run
const ang = (a, b) => Math.abs(wrap(a - b));
function careful(s) { // from ant-promotion/bots.mjs: hunt what it can catch, keep out of stronger animals' sight
  const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity;
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = powerOf(m);
    if (pw > F.power) {
      const [far, half] = sightOf(M), reach = M.range * far * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < half + 0.4;
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
// A clumsy thumb: it reacts only every 0.3 to 0.5 s, sees danger only when close, wobbles and sometimes turns the wrong way.
function clumsy(seed) {
  const R = rng(seed); let held = { x: 0, y: 0 }, wait = 0;
  return s => {
    if ((wait -= DT) > 0) return held;
    wait = 0.3 + R() * 0.2;
    const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity;
    for (const m of s.mobs) {
      const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = powerOf(m);
      if (pw > F.power && d < 150) { vx -= dx / d * 2; vy -= dy / d * 2; }
      else if (pw < F.power && d < bd) { bd = d; best = m; }
    }
    if (best) { const d = bd || 1; vx += (best.x - p.x) / d; vy += (best.y - p.y) / d; }
    const w = R() * TAU; held = { x: vx + Math.cos(w) * 0.5, y: vy + Math.sin(w) * 0.5 };
    if (R() < 0.1) held = { x: Math.cos(w), y: Math.sin(w) }; // a wrong turn
    return held;
  };
}
const stackTo = (L, pick) => { const st = [ANT]; for (let l = 1; l < L; l++) st.push(optionsFor(l)[(pick + l) % 3].id); return st; };
// One attempt at a level, as a player meets it: start there in a fresh world (Wild rules, the main game's default) and play
// until promoted, dead or out of time (150 s). A death costs a try; a level counts as finished within three tries.
function attempt(L, seed, policy, secs = 150) {
  const s = create(seed, stackTo(L, seed % 3), 0, SPAWN_WEIGHTS, true);
  for (let i = 0; i < secs * 60; i++) { step(s, policy(s)); if (s.choosing || s.won) return 'up'; if (s.dead) return 'dead'; }
  return 'time';
}
const tries = (L, seed, make) => { for (let t = 0; t < 3; t++) { const sd = seed * 7 + t; if (attempt(L, sd, make(sd)) === 'up') return t + 1; } return 0; };
{ // 3. rigs on the real sim: a careful run of 4 minutes, a rig for every animal in the world and the player
  const s = create(42, [ANT], 0, SPAWN_WEIGHTS, true), rigs = new Map(), m = { seg: 0, chain: 0, stretch: 0, spineFoot: 0, knee: 0, nan: 0 };
  let you = creature(me(s), s.player.x, s.player.y, s.player.a), youId = me(s).id, most = 0, frames = 0, built = 0;
  for (let i = 0; i < 4 * 3600; i++) {
    step(s, careful(s));
    if (s.choosing) choose(s, i % 3); if (s.dead) revive(s, false);
    if (me(s).id !== youId) { youId = me(s).id; you = creature(me(s), s.player.x, s.player.y, s.player.a); built++; }
    update(you, s.player.x, s.player.y, s.player.a, DT); measure(you, m);
    const live = new Set();
    for (const mob of s.mobs) {
      let c = rigs.get(mob.id); if (!c) { rigs.set(mob.id, c = creature(FORMS[mob.f], mob.x, mob.y, mob.a)); built++; }
      update(c, mob.x, mob.y, mob.a, DT, mob.alert ? s.player : mob.chase || null); measure(c, m); live.add(mob.id);
    }
    for (const id of rigs.keys()) if (!live.has(id)) rigs.delete(id);
    most = Math.max(most, rigs.size); frames++;
  }
  claim(m.nan === 0 && m.seg < 1e-6 && m.chain < 1e-6 && m.stretch <= 0.98 + 1e-9, `on the real sim: ${frames} ticks, up to ${most} rigs at once, ${built} built, reached level ${level(s)}; no NaN, worst segment error ${(m.seg * 100).toExponential(1)}%, worst foot ${(m.stretch * 100).toFixed(1)}% of leg`);
}
{ // 4. the run's difficulty, measured with the main game's rules
  const N = 20, rows = [];
  for (const L of [1, 2, 4, 6, 8, 11, 14, 17]) {
    let cu = 0, cc = 0, cu1 = 0, cc1 = 0;
    for (let k = 0; k < N; k++) { const seed = 500 + L * 97 + k, a = tries(L, seed, clumsy), b = tries(L, seed, () => careful); if (a) cu++; if (a === 1) cu1++; if (b) cc++; if (b === 1) cc1++; }
    rows.push([L, cu / N, cc / N, cu1 / N, cc1 / N]);
    console.log(`     level ${String(L).padStart(2)}: clumsy finishes ${String(cu).padStart(2)}/${N} within 3 tries (${String(cu1).padStart(2)} on the first), careful ${String(cc).padStart(2)}/${N} (${String(cc1).padStart(2)} on the first)`);
  }
  claim(rows[0][1] >= 0.8, `a clumsy bot finishes level 1: ${(rows[0][1] * 100).toFixed(0)}% within three tries, ${(rows[0][3] * 100).toFixed(0)}% on the first`);
  // The page plays like the main game: a death drops one form (revive(s, false)) and the run goes on, until the third death
  // ends it (the page's run). Runs of up to 4 minutes from Ant, today's-seed style (a fresh seed each):
  const run = (policy, seed) => { const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, true); let top = 1; for (let i = 0; i < 4 * 3600; i++) { step(s, policy(s)); if (s.choosing) choose(s, seed % 3); if (s.dead) { if (s.deaths >= 3) break; revive(s, false); } if (s.won) break; top = Math.max(top, level(s)); } return [top, s.deaths, s.t]; };
  const mid = a => [...a].sort((x, y) => x - y)[a.length >> 1], cr = [], kr = [];
  for (let seed = 1; seed <= 9; seed++) { cr.push(run(careful, seed)); kr.push(run(clumsy(seed), seed)); }
  console.log(`     4-minute runs from Ant, 9 seeds: careful reaches level ${cr.map(r => r[0]).join(' ')} (deaths ${cr.map(r => r[1]).join(' ')}); clumsy ${kr.map(r => r[0]).join(' ')} (deaths ${kr.map(r => r[1]).join(' ')})`);
  console.log(`     run length in seconds (240 = still alive at the cap): careful ${cr.map(r => Math.round(r[2])).join(' ')}; clumsy ${kr.map(r => Math.round(r[2])).join(' ')}`);
  const lasts = cr.filter(r => r[1] < 3).length; // the page's run ends on the third death
  claim(lasts >= 6 && mid(cr.map(r => r[0])) >= 6, `a careful bot lasts long: ${lasts}/9 careful runs reach the 4-minute mark with lives left (a run ends on the third death; clumsy: ${kr.filter(r => r[1] < 3).length}/9), median level ${mid(cr.map(r => r[0]))} (the main game's bar is 6), lowest ${Math.min(...cr.map(r => r[0]))}; it finishes ${rows.filter(r => r[2] >= 0.5).length} of ${rows.length} sampled levels at least half the time within three fresh tries`);
  claim(mid(cr.map(r => r[0])) > mid(kr.map(r => r[0])), `care pays: careful median level ${mid(cr.map(r => r[0]))} against clumsy ${mid(kr.map(r => r[0]))}`);
  const first = rows.slice(0, 3).reduce((a, r) => a + r[1], 0) / 3, last = rows.slice(-3).reduce((a, r) => a + r[1], 0) / 3;
  claim(last < first - 0.3, `difficulty rises: the clumsy bot finishes ${(first * 100).toFixed(0)}% of the first three sampled levels and ${(last * 100).toFixed(0)}% of the last three`);
}

console.log(failed ? `${failed} check(s) FAILED` : 'all checks pass');
process.exit(failed ? 1 : 0);
