// node bots.mjs [--mutate] [--seeds=40]
// Bots play the rules through thread positions only. --mutate makes mixed rings score and expects an assertion to fail.
import assert from 'node:assert/strict';
import { create, step, JAR, levelDef, dailySeed, hashState, stars, NIGHT, MAXC, FLY, MOTH, GOLD, THREAD, LEVELS, W, H } from './sim.js';

const MUTATE = process.argv.includes('--mutate');
const SEEDS = Number(process.argv.find(a => a.startsWith('--seeds='))?.slice(8)) || 40;
const OPTS = MUTATE ? { mixedScores: true } : {};
const SPEED = 9;
const RMAX = Math.floor(THREAD / (2 * Math.PI + 0.9)) - 4;

// A lasso: comes in from outside, dips inside, then goes once round and crosses its own lead-in.
function radiusAt(t) { return t < 0.8 ? 1.25 - 0.4 * t / 0.8 : t < 1.4 ? 0.85 + 0.15 * (t - 0.8) / 0.6 : 1; }
// The finger is never teleported: between rings it travels (lifted) at TRAVEL units a step to the lasso's start.
const TRAVEL = 14;
function lasso() {
  let plan = null, fx = W / 2, fy = H * 0.8;
  return {
    get busy() { return !!plan; },
    get at() { return [fx, fy]; },
    start(cx, cy, r, members) { plan = { cx, cy, r, t: 0, a0: Math.atan2(H / 2 - cy, W / 2 - cx), members, travel: true }; },
    stop() { plan = null; },
    next(s) {
      if (!plan) return null;
      if (plan.travel) {
        const r0 = plan.r * radiusAt(0), tx = plan.cx + Math.cos(plan.a0) * r0, ty = plan.cy + Math.sin(plan.a0) * r0, d = Math.hypot(tx - fx, ty - fy);
        if (d > TRAVEL) { fx += (tx - fx) / d * TRAVEL; fy += (ty - fy) / d * TRAVEL; return null; }
        fx = tx; fy = ty; plan.travel = false;
        if (s.rekindle > 0) { plan.travel = true; return null; }
        return [fx, fy];
      }
      let mx = 0, my = 0, m = 0;
      for (const i of plan.members) if (s.kind[i] === FLY || s.kind[i] === GOLD) { mx += s.x[i]; my += s.y[i]; m++; }
      if (m) { plan.cx += (mx / m - plan.cx) * 0.2; plan.cy += (my / m - plan.cy) * 0.2; }
      const rr = plan.r * radiusAt(plan.t);
      plan.t += SPEED / Math.max(rr, 12);
      if (plan.t > 2 * Math.PI + 0.9) { plan = null; return null; }
      const a = plan.a0 + plan.t, r = plan.r * radiusAt(plan.t);
      fx = plan.cx + Math.cos(a) * r; fy = plan.cy + Math.sin(a) * r;
      return [fx, fy];
    },
  };
}
function mothNear(s, cx, cy, r) {
  for (let i = 0; i < MAXC; i++) if (s.kind[i] === MOTH && s.cool[i] === 0 && Math.hypot(s.x[i] - cx, s.y[i] - cy) < r) return true;
  return false;
}

// Careful: waits for the largest single-colour cluster that fits the thread, rings it whole.
function careful() {
  const pen = lasso();
  let tick = 0;
  return s => {
    if (s.phase !== 'play') { pen.stop(); return null; }
    if (pen.busy) {
      const p = pen.next(s);
      if (p && mothNear(s, p[0], p[1], 34)) { pen.stop(); return null; }
      return p;
    }
    if (++tick % 4) return null;
    let best = null, mothBlocked = false;
    for (let i = 0; i < MAXC; i++) {
      const k = s.kind[i];
      if ((k !== FLY && k !== GOLD) || s.scare[i] > 0) continue;
      let cx = 0, cy = 0, m = 0;
      for (let j = 0; j < MAXC; j++) {
        if (!((s.kind[j] === FLY && (k === GOLD || s.col[j] === s.col[i])) || s.kind[j] === GOLD)) continue;
        if (Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]) < RMAX) { cx += s.x[j]; cy += s.y[j]; m++; }
      }
      cx /= m; cy /= m;
      if (cx < 30 || cx > W - 30 || cy < 30 || cy > H - 30) continue;
      const colour = k === GOLD ? -1 : s.col[i];
      let other = Infinity;
      for (let j = 0; j < MAXC; j++) if (s.kind[j] === FLY && colour >= 0 && s.col[j] !== colour) other = Math.min(other, Math.hypot(s.x[j] - cx, s.y[j] - cy));
      const limit = Math.min(RMAX, other - 22);
      const members = []; let far = 0, gold = 0;
      for (let j = 0; j < MAXC; j++) {
        const ok = s.kind[j] === GOLD || (s.kind[j] === FLY && (colour < 0 ? false : s.col[j] === colour));
        if (!ok) continue;
        const d = Math.hypot(s.x[j] - cx, s.y[j] - cy);
        if (d + 16 <= limit) { members.push(j); far = Math.max(far, d); if (s.kind[j] === GOLD) gold++; }
      }
      if (!members.length || limit < 20) continue;
      const r = Math.max(20, far + 16);
      if (mothNear(s, cx, cy, r + 60)) { mothBlocked = true; continue; }
      const batWants = s.batPhase > 0 && members.includes(s.batTarget);
      const value = members.length ** 2 + gold * JAR + (batWants ? 30 : 0);
      if (!best || value > best.value) best = { cx, cy, r, members, value, n: members.length, batWants, gold };
    }
    if (globalThis.SEEN && tick % 60 === 0) globalThis.SEEN.push(best ? `${best.n}${best.batWants ? 'b' : ''}` : (mothBlocked ? 'm' : '-'));
    if (!best) return null;
    const left = s.dawn / s.dawnMax, need = s.target - s.light;
    const go = best.value >= need || best.gold || (best.batWants && best.n >= 2) || best.n >= 6 || (left < 0.6 && best.n >= 4) || (left < 0.35 && best.n >= 3) || (left < 0.15);
    if (go) pen.start(best.cx, best.cy, best.r, best.members);
    return null;
  };
}

// Greedy: rings the nearest firefly at once, small and tight, whatever is next to it.
function greedy() {
  const pen = lasso();
  return s => {
    if (s.phase !== 'play') { pen.stop(); return null; }
    if (pen.busy) {
      const p = pen.next(s);
      if (p && mothNear(s, p[0], p[1], 34)) { pen.stop(); return null; }
      return p;
    }
    let best = -1, bd = Infinity;
    for (let i = 0; i < MAXC; i++) {
      if (s.kind[i] !== FLY && s.kind[i] !== GOLD) continue;
      const d = Math.hypot(s.x[i] - pen.at[0], s.y[i] - pen.at[1]);
      if (d < bd && s.x[i] > 25 && s.x[i] < W - 25 && s.y[i] > 25 && s.y[i] < H - 25) { bd = d; best = i; }
    }
    if (best >= 0) pen.start(s.x[best], s.y[best], 22, [best]);
    return null;
  };
}
const idle = () => () => null;

function play(seed, bot, opts = OPTS) {
  const s = create(seed, opts), b = bot();
  let guard = 0;
  while (s.phase !== 'done' && guard++ < 60 * 60 * 10) {
    const p = b(s);
    step(s, p ? p[0] : NaN, p ? p[1] : NaN);
  }
  assert.equal(s.phase, 'done', 'run ends');
  let creatures = 0;
  for (let i = 0; i < MAXC; i++) if (s.kind[i]) creatures++;
  return { s, cleared: s.cleared, score: s.score, wicks: s.wicks, stars: stars(s), hash: hashState(s), creatures, l1: s.results[0] >= 1, best: s.bestRing, mixed: s.counts.mixed, mixedPoints: s.counts.mixedPoints, snapsLost: s.counts.snaps === s.counts.wicksLost && 3 - s.wicks === s.counts.wicksLost, rings: s.counts.rings, snaps: s.counts.snaps, eaten: s.counts.eaten };
}

const TRACE = process.argv.find(a => a.startsWith('--trace='));
if (TRACE) {
  globalThis.SEEN = [];
  for (const name of ['careful', 'greedy']) {
    const s = create(Number(TRACE.slice(8)), OPTS), b = { careful, greedy }[name]();
    let rings = [];
    while (s.phase !== 'done') {
      const p = b(s); step(s, p ? p[0] : NaN, p ? p[1] : NaN);
      for (const e of s.ev) {
        if (e.type === 'ring' || e.type === 'mixed') rings.push(e.type === 'mixed' ? `x${e.n}` : e.n);
        if (e.type === 'end') { console.log(`${name} L${e.level + 1} ${e.full ? 'full' : 'short'} light ${s.light}/${s.target} dawn left ${Math.round(100 * s.dawn / s.dawnMax)}% rings ${rings.join(' ')}${globalThis.SEEN ? ' seen ' + globalThis.SEEN.join(',') : ''}`); rings = []; if (globalThis.SEEN) globalThis.SEEN = []; }
      }
    }
  }
  process.exit(0);
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const t0 = performance.now();
const seeds = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 7919);
const results = { careful: [], greedy: [], idle: [] };
let failures = 0;
function check(label, fn) {
  try { fn(); console.log(`ok   ${label}`); }
  catch (e) { failures++; console.log(`FAIL ${label}: ${e.message}`); }
}

check('every run reaches its end', () => {
  for (const seed of seeds) for (const [name, bot] of [['careful', careful], ['greedy', greedy], ['idle', idle]]) results[name].push(play(seed, bot));
});
check('mixed rings never score (every bot run)', () => {
  const all = [...results.careful, ...results.greedy], bad = all.filter(x => x.mixedPoints > 0);
  console.log(`     mixed rings closed: ${all.reduce((n, x) => n + x.mixed, 0)}, points from them: ${all.reduce((n, x) => n + x.mixedPoints, 0)}`);
  assert.equal(bad.length, 0, `${bad.length} runs scored from mixed rings`);
});
check('every snap cost exactly one wick (every bot run)', () => {
  assert.ok([...results.careful, ...results.greedy, ...results.idle].every(x => x.snapsLost));
});
const summary = name => {
  const r = results[name];
  if (!r.length) return `${name}: no runs`;
  const all = r.filter(x => x.cleared === NIGHT).length;
  const perLevel = Array.from({ length: NIGHT }, (_, l) => r.filter(x => x.s.results[l] >= 1).length);
  return `${name.padEnd(8)} all-8 ${all}/${r.length} (${Math.round(100 * all / r.length)}%)  mean cleared ${mean(r.map(x => x.cleared)).toFixed(2)}  mean score ${Math.round(mean(r.map(x => x.score)))}  min ${Math.min(...r.map(x => x.score))}  best ring mean ${mean(r.map(x => x.best)).toFixed(1)}  rings ${Math.round(mean(r.map(x => x.rings)))}  mixed ${mean(r.map(x => x.mixed)).toFixed(1)}  snaps ${mean(r.map(x => x.snaps)).toFixed(2)}  eaten ${mean(r.map(x => x.eaten)).toFixed(1)}  stars ${mean(r.map(x => x.stars)).toFixed(2)}  per level ${perLevel.join(' ')}`;
};
for (const name of ['careful', 'greedy', 'idle']) console.log(summary(name));

check('careful clears all 8 levels in at least 80% of runs', () => {
  const all = results.careful.filter(x => x.cleared === NIGHT).length;
  assert.ok(all >= 0.8 * SEEDS, `careful cleared all 8 in ${all}/${SEEDS}`);
});
check('careful does not coast: levels need most of the dawn (mean leftover under 55%)', () => {
  const left = [], per = Array.from({ length: NIGHT }, () => []), secs = [];
  for (const seed of seeds) {
    const s = create(seed, OPTS), b = careful();
    let ticks = 0;
    while (s.phase !== 'done') { const p = b(s); step(s, p ? p[0] : NaN, p ? p[1] : NaN); ticks++; for (const e of s.ev) if (e.type === 'end' && e.full) { left.push(s.dawn / s.dawnMax); per[e.level].push(s.dawn / s.dawnMax); } }
    secs.push(ticks / 60);
  }
  console.log(`     careful dawn left at a full level: mean ${(100 * mean(left)).toFixed(0)}%, min ${(100 * Math.min(...left)).toFixed(0)}%, max ${(100 * Math.max(...left)).toFixed(0)}%; per level ${per.map(a => Math.round(100 * mean(a))).join(' ')}; run length ${Math.round(mean(secs))} s (min ${Math.round(Math.min(...secs))}, max ${Math.round(Math.max(...secs))})`);
  assert.ok(mean(left) < 0.55, 'careful finishes levels with too much dawn left');
});
check('greedy clears fewer levels and scores clearly less than careful', () => {
  const c = mean(results.careful.map(x => x.cleared)), g = mean(results.greedy.map(x => x.cleared));
  const cs = mean(results.careful.map(x => x.score)), gs = mean(results.greedy.map(x => x.score));
  assert.ok(g < c, `greedy cleared ${g} vs careful ${c}`);
  assert.ok(gs < 0.6 * cs, `greedy scored ${gs} vs careful ${cs}`);
});
check('idle never clears level 1', () => {
  assert.equal(results.idle.filter(x => x.l1).length, 0);
});
check('creature count stays under 60', () => {
  assert.ok(MAXC < 60);
  assert.ok(Math.max(...LEVELS.map(l => l.flies + l.moths + 1)) < MAXC);
});
check('a moth touching the live thread always costs a wick (200 placements)', () => {
  for (let trial = 0; trial < 200; trial++) {
    const s = create(500 + trial, { ...OPTS, start: 2 });
    const y = 150 + (trial % 7) * 40;
    for (let x = 60; x <= 200; x += 6) step(s, x, y);
    const slot = Array.from(s.kind).findIndex(k => k === 0);
    const t = s.t0 + Math.floor((s.t1 - s.t0) * (trial % 10) / 10);
    s.kind[slot] = MOTH; s.x[slot] = s.tx[t] + 2; s.y[slot] = s.ty[t] - 2; s.vx[slot] = 0; s.vy[slot] = 0; s.cool[slot] = trial % 2 ? 200 : 0;
    const before = s.wicks;
    step(s, 206, y);
    assert.equal(s.wicks, before - 1, `trial ${trial}: wick lost`);
    assert.equal(s.t1 - s.t0, 0, 'thread snapped');
  }
});
check('a mixed ring scores nothing and startles; a pure ring scores n squared (constructed)', () => {
  const s = create(7, { ...OPTS, start: 1 });
  s.kind.fill(0);
  const put = (i, c, x, y) => { s.kind[i] = FLY; s.col[i] = c; s.x[i] = x; s.y[i] = y; s.vx[i] = 0; s.vy[i] = 0; };
  const c0 = s.def.colors[0], c1 = s.def.colors[1];
  put(0, c0, 180, 300); put(1, c1, 190, 305);
  const draw = (cx, cy, r) => { const b = lasso(); b.start(cx, cy, r, []); while (b.busy) { const p = b.next(s); step(s, p ? p[0] : NaN, p ? p[1] : NaN); } step(s, NaN, NaN); };
  const score = s.score; draw(185, 302, 45);
  assert.equal(s.score, score, 'mixed ring added nothing');
  assert.ok(s.scare[0] > 0 && s.scare[1] > 0, 'both startled');
  s.kind.fill(0); s.wait2.fill(0);
  for (let i = 0; i < 4; i++) put(i, c0, 170 + i * 8, 300 + (i % 2) * 8);
  const before = s.score; draw(182, 304, 50);
  assert.equal(s.score - before, 16, 'four fireflies score 16');
});
check('endless: rounds refill the jars with a shorter dawn, and the run ends', () => {
  const rounds = [], scores = [];
  for (const seed of seeds.slice(0, 10)) {
    const s = create(seed, { ...OPTS, mode: 'endless' }), b = careful();
    let guard = 0;
    while (s.phase !== 'done' && guard++ < 60 * 60 * 20) { const p = b(s); step(s, p ? p[0] : NaN, p ? p[1] : NaN); }
    assert.equal(s.phase, 'done', 'endless run ends');
    rounds.push(s.round); scores.push(s.score);
  }
  console.log(`     careful endless: rounds mean ${mean(rounds).toFixed(1)} (min ${Math.min(...rounds)}, max ${Math.max(...rounds)}), score mean ${Math.round(mean(scores))}`);
  assert.ok(Math.min(...rounds) >= 1);
});
check('daily seeds for 30 consecutive dates give 30 distinct level sets', () => {
  const sets = new Set(), day = Date.UTC(2026, 10, 24);
  for (let d = 0; d < 30; d++) {
    const date = new Date(day + d * 86400000).toISOString().slice(0, 10), seed = dailySeed(date);
    const parts = [];
    for (let l = 0; l < NIGHT; l++) { const def = levelDef(seed, l); parts.push(def.colors.join(','), Array.from(def.pos, v => v.toFixed(2)).join(','), Array.from(def.cols).join(''), def.windDir, def.goldenAt, def.batFirst); }
    sets.add(parts.join('|'));
  }
  assert.equal(sets.size, 30);
});
check('determinism: same seed and inputs give the same final state hash', () => {
  for (const seed of seeds.slice(0, 5)) {
    const a = play(seed, careful), b = play(seed, careful);
    assert.equal(a.hash, b.hash);
  }
  assert.notEqual(play(seeds[0], careful).hash, play(seeds[1], careful).hash, 'different seeds differ');
});
console.log(`${failures ? `${failures} check(s) failed` : 'all checks passed'} in ${((performance.now() - t0) / 1000).toFixed(1)} s${MUTATE ? ' (mutated rules: mixed rings score)' : ''}`);
if (MUTATE) {
  if (failures) console.log('mutation caught: an assertion failed, as it should');
  else console.log('mutation NOT caught');
  process.exitCode = failures ? 0 : 1;
} else process.exitCode = failures ? 1 : 0;
