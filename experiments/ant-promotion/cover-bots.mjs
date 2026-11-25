// Checks for cover (cover.js): rocks and tall grass, from level COVER.from. bots.mjs runs this after rig-bots.mjs; it also runs
// alone: node experiments/ant-promotion/cover-bots.mjs [seeds] [minutes] [--ref=<main's sim.js>] [--mutate=rocks]
// 1. Parity. Below level COVER.from a world with cover plays tick for tick as one without (the whole state and every event).
//    With --ref=<path to main's sim.js> (git show origin/main:experiments/ant-promotion/sim.js > /tmp/x/sim.js; it needs its
//    imports beside it), a world made with { cover: false } plays exactly as main at levels 1, 6, 12 and 18, Classic and Wild.
// 2. Rules on staged scenes: a rock stops a hunter noticing you, the rival and an old animal on the hunt too; an alert hunter that
//    loses you behind a rock gives up within COVER.lose s and rests; creeping in grass hides you, running in it gives you away,
//    and a looker in the same patch sees you; a hunter does not start on prey behind a rock; nobody walks into a rock, and a
//    run straight at one slides round it; the layout is seeded, keeps out of the middle and is sparse; the first rock is taught.
// 3. Measured play (held-out seeds from 101; alone, or with --cover-play from bots.mjs): the careful bot with cover against without (cover must not be a tax), the share
//    of chases that cover broke, and a bot that uses cover against one that ignores it.
// --mutate=rocks makes rocks see-through (a test-only switch in cover.js). A rule check must fail; this file then exits non-zero.
import { FORMS, ANT, COVER, coverOn, create, step, choose, revive, me, level, powerOf, sightOf, optionsFor, nemesisMob, OLD_HUNT, SPAWN_WEIGHTS, PREY, WORLD } from './sim.js';
import { layout, mutate, rockBetween, hidden } from './cover.js';

const asked = process.argv.find(a => a.startsWith('--mutate')), MUT = asked && asked.split('=')[1] === 'rocks' ? 'rocks' : null;
if (MUT) { mutate(MUT); console.log(`MUTATION ON: ${MUT}`); }
const ref = process.argv.find(a => a.startsWith('--ref='))?.slice(6);
const nums = process.argv.slice(2).filter(a => !a.startsWith('--')), seeds = Number(nums[0] ?? 20), minutes = Number(nums[1] ?? 12);
let failed = 0;
const claim = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; };
const stackAt = (L, k = 1) => { const st = [ANT]; while (st.length < L) st.push(optionsFor(st.length)[(k + st.length) % 3].id); return st; };
const snap = s => { // the whole state; an animal held inside another (what it chases or fears) is written as its id
  const mobs = s.mobs;
  return JSON.stringify([s.tick, s.player, mobs, s.events, s.dead, s.nemesis, s.eaten, s.deaths, s.choosing?.map(f => f.id)],
    function (k, v) { if (typeof v === 'function') return undefined; if (v && typeof v === 'object' && this !== mobs && 'f' in v && 'id' in v && 'x' in v) return `mob ${v.id}`; return v; });
};
const input = (i, seed) => ({ x: Math.sin(i / 50 + seed), y: Math.cos(i / 70), power: i % 400 === 0 });

// ---- 1. Parity
{
  let ticks = 0, same = true;
  for (const seed of [1, 2, 3]) for (const wild of [false, true]) {
    const a = create(seed, [ANT], 0, SPAWN_WEIGHTS, wild, null, [], { cover: false }), b = create(seed, [ANT], 0, SPAWN_WEIGHTS, wild);
    for (let i = 0; i < 4 * 3600 && level(b) < COVER.from; i++) {
      step(a, input(i, seed)); step(b, input(i, seed));
      for (const s of [a, b]) { if (s.choosing) choose(s, 1); if (s.dead) revive(s, false); }
      if (snap(a) !== snap(b)) { same = false; break; } ticks++;
    }
  }
  claim(same && ticks > 3000, `below level ${COVER.from} a world with cover plays as one without: ${ticks} ticks identical (seeds 1-3, Classic and Wild)`);
  if (ref) {
    const R = await import(new URL(ref, 'file://' + process.cwd() + '/').href); let n = 0, ok = true;
    for (const seed of [1, 2, 3]) for (const L of [1, 6, 12, 18]) for (const wild of [false, true]) {
      const st = stackAt(L), a = R.create(seed, st, 0, R.SPAWN_WEIGHTS, wild), b = create(seed, st, 0, SPAWN_WEIGHTS, wild, null, [], { cover: false });
      for (let i = 0; i < 3600; i++) {
        R.step(a, input(i, seed)); step(b, input(i, seed));
        if (a.choosing) R.choose(a, 0); if (a.dead) R.revive(a, false); if (b.choosing) choose(b, 0); if (b.dead) revive(b, false);
        if (snap(a) !== snap(b)) { ok = false; console.log(`  first difference: seed ${seed}, level ${L}, ${wild ? 'Wild' : 'Classic'}, tick ${i}`); break; } n++;
      }
    }
    claim(ok, `{ cover: false } plays as the reference sim (${ref}): ${n} ticks identical at levels 1, 6, 12, 18, Classic and Wild, with power presses`);
  } else console.log('     (no --ref given: the check against main was skipped)');
}

// ---- 2. Rules on staged scenes. A world at level L with nothing in it but what the scene puts there.
function scene(L = 6, extra = {}) {
  const s = create(5, stackAt(L), 0, SPAWN_WEIGHTS, false, extra.nem ?? null, extra.old ?? [], { cover: true }), p = s.player;
  s.cover.rocks = []; s.cover.grass = []; s.cover.taught = true; p.x = 1000; p.y = 1000; p.a = 0; p.safe = 0;
  return { s, p, F: me(s) };
}
const hunterFor = (F, L) => FORMS.filter(M => M.level > L && M.level <= L + 2 && M.power > F.power).sort((a, b) => b.range * sightOf(b)[0] - a.range * sightOf(a)[0])[0];
const mob = (M, x, y, a, more = {}) => ({ id: 900 + Math.floor(x), f: M.id, x, y, a, alert: false, lost: 0, timer: 60, want: a, walk: false, ph: 0, ...more });
const reachOf = (M, F) => M.range * sightOf(M)[0] * F.stealth + F.r;
function run(s, mobs, n, inp = () => ({ x: 0, y: 0 }), each) { for (let i = 0; i < n; i++) { s.mobs = mobs.slice(); step(s, inp(i)); each?.(i); if (s.dead) return i; } return -1; }
{
  // a rock between: no notice. The same scene without it: noticed.
  const notice = withRock => { const { s, p, F } = scene(), M = hunterFor(F, 6), d = reachOf(M, F) * 0.55, m = mob(M, p.x - d, p.y, 0);
    if (withRock) s.cover.rocks.push({ x: p.x - d / 2, y: p.y, r: 32, k: 0.5 }); run(s, [m], 30); return m.alert; };
  const a = notice(false), b = notice(true);
  claim(a && !b, `a rock between stops a hunter noticing you (open: ${a ? 'noticed' : 'not'}, behind a rock: ${b ? 'noticed' : 'not'})`);
}
{
  // an alert hunter that loses you behind a rock gives up within COVER.lose s, rests, and the loss is an event
  const lose = withRock => { const { s, p, F } = scene(), M = hunterFor(F, 6), d = reachOf(M, F) * 0.6, m = mob(M, p.x - d, p.y, 0, { alert: true, seen: { x: p.x, y: p.y } });
    if (withRock) s.cover.rocks.push({ x: p.x - 60, y: p.y, r: 34, k: 0.5 }); let at = -1, ev = 0;
    run(s, [m], 120, () => ({ x: 0, y: 0 }), i => { if (!m.alert && at < 0) at = i; ev += s.events.filter(e => e.t === 'coverLost').length; }); return { at, ev, rest: m.winded > 0, x: m.x - p.x }; };
  const open = lose(false), rock = lose(true);
  claim(open.at < 0 && rock.at >= 0 && rock.at <= Math.ceil(COVER.lose * 60) + 1 && rock.ev === 1 && rock.rest,
    `an alert hunter loses you behind a rock after ${(rock.at / 60).toFixed(2)} s (limit ${COVER.lose} s), once, and rests; in the open it keeps on (${open.at < 0 ? 'still alert' : 'gave up'} after 2 s)`);
}
{
  // tall grass: creeping hides you, running in it gives you away, a looker in the same patch sees you
  const grass = (mv, inPatch) => { const { s, p, F } = scene(), M = hunterFor(F, 6), d = reachOf(M, F) * 0.6, m = mob(M, p.x - d, p.y, 0);
    s.cover.grass.push(inPatch ? { x: p.x - d / 2, y: p.y, r: d * 0.75, k: 0.3 } : { x: p.x, y: p.y, r: 70, k: 0.3 });
    run(s, [m], 40, i => (mv ? { x: 0, y: i % 20 < 10 ? 1 : -1 } : { x: 0, y: 0 })); return m.alert; };
  const still = grass(false, false), runs = grass(true, false), shared = grass(false, true);
  claim(!still && runs && shared, `grass: standing still unseen (${still ? 'seen' : 'unseen'}), running in it seen (${runs ? 'seen' : 'unseen'}), seen by a looker in the same patch (${shared ? 'seen' : 'unseen'})`);
}
{
  // the rival and an old animal on the hunt (which see you wherever they face) do not see through a rock
  const nem = withRock => { const big = FORMS.find(f => f.level === 8); const { s, p, F } = scene(6, { nem: { f: big.id, bonus: 0, kills: 1, knobs: { temperament: 'brute', persistence: 3, territory: 2 } } });
    const m = nemesisMob(s); if (!m) return null; m.x = p.x - 150; m.y = p.y; m.a = 0; m.alert = false; m.timer = 60; m.walk = false;
    if (withRock) s.cover.rocks.push({ x: p.x - 75, y: p.y, r: 34, k: 0.5 }); run(s, [m], 30); return m.alert; };
  const old = withRock => { const O = FORMS.find(f => f.level === 9); const { s, p } = scene(6, { old: [O.id] }); const m = s.mobs.find(x => x.old);
    m.x = p.x - 150; m.y = p.y; m.a = Math.PI; m.hunt = OLD_HUNT; m.alert = false; if (withRock) s.cover.rocks.push({ x: p.x - 75, y: p.y, r: 34, k: 0.5 }); run(s, [m], 30); return m.alert; };
  const n0 = nem(false), n1 = nem(true), o0 = old(false), o1 = old(true);
  claim(n0 === true && n1 === false && o0 && !o1, `the rival (open ${n0}, rock ${n1}) and an old animal on the hunt (open ${o0}, rock ${o1}) do not see through a rock`);
}
{
  // animals hunt each other by sight too: no chase starts on prey behind a rock
  const chase = withRock => { const { s, p } = scene(6); p.x = 300; p.y = 300; p.safe = 99;
    const A = FORMS.find(f => f.level === 9), B = FORMS.find(f => f.level === 8 && f.power < A.power), e = Math.min(200, A.range * PREY.sight * 0.6);
    const a = mob(A, 1000, 1000, 0), b = mob(B, 1000 + e, 1000, 0, { timer: 60 }); if (withRock) s.cover.rocks.push({ x: 1000 + e / 2, y: 1000, r: 30, k: 0.5 });
    run(s, [a, b], 30); return a.chase === b; };
  const c0 = chase(false), c1 = chase(true);
  claim(c0 && !c1, `a hunter starts on prey in the open (${c0}) and not on prey behind a rock (${c1})`);
}
{
  // rocks are solid and do not pin: running straight at one, you never end a step inside it and you get past it
  const { s, p, F } = scene(6), k = { x: p.x + 160, y: p.y, r: 40, k: 0.5 }; s.cover.rocks.push(k); let inside = 0;
  run(s, [], 240, () => ({ x: 1, y: 0 }), () => { if (Math.hypot(p.x - k.x, p.y - k.y) < k.r + F.r - 1e-6) inside++; });
  claim(inside === 0 && p.x > k.x + k.r, `running straight at a rock slides round it: ${inside} steps inside, ${(p.x - k.x).toFixed(0)} past its middle after 4 s`);
}
{
  // layout: the same seed gives the same layout; nothing near the middle; sparse (rocks and patches per 400 x 400)
  const A = layout(7, WORLD), B = layout(7, WORLD), C = layout(8, WORLD); let rocks = 0, grass = 0, near = 0;
  for (let seed = 1; seed <= 100; seed++) { const L = layout(seed, WORLD); rocks += L.rocks.length; grass += L.grass.length; for (const o of [...L.rocks, ...L.grass]) if (Math.hypot(o.x - WORLD / 2, o.y - WORLD / 2) < COVER.clear + o.r) near++; }
  const cells = (WORLD / COVER.cell) ** 2;
  claim(JSON.stringify(A) === JSON.stringify(B) && JSON.stringify(A) !== JSON.stringify(C) && near === 0,
    `layout: seeded, none within ${COVER.clear} of the middle; ${(rocks / 100 / cells).toFixed(2)} rocks and ${(grass / 100 / cells).toFixed(2)} grass patches per 400 x 400 (a phone screen shows about 1-2 of those)`);
}
{
  // teaching: the first time cover is on, a rock appears ahead and a hunter behind it, facing you, whose sight stops at the rock
  const s = create(4, stackAt(COVER.from), 0, SPAWN_WEIGHTS, false, null, [], { cover: true, teach: true }), p = s.player; p.safe = 0;
  step(s, { x: 0, y: 0 }); const t = s.events.find(e => e.t === 'coverTeach'), k = s.cover.rocks.find(r => r.teach), h = s.mobs.find(m => m.teach);
  const between = k && h && rockBetween([k], h.x, h.y, p.x, p.y), facing = h && Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - h.y, p.x - h.x) - h.a), Math.cos(Math.atan2(p.y - h.y, p.x - h.x) - h.a))) < 0.05;
  const inReach = h && Math.hypot(h.x - p.x, h.y - p.y) < reachOf(FORMS[h.f], me(s));
  const again = create(4, stackAt(COVER.from), 0, SPAWN_WEIGHTS, false, null, [], { cover: true, teach: false }); step(again, { x: 0, y: 0 });
  const low = create(4, stackAt(COVER.from - 1), 0, SPAWN_WEIGHTS, false, null, [], { cover: true, teach: true }); step(low, { x: 0, y: 0 });
  claim(!!t && between && facing && inReach && !again.cover.rocks.some(r => r.teach) && !low.cover.rocks.some(r => r.teach),
    `teaching: at level ${COVER.from} a rock and a hunter facing you with you in its reach, the rock between; not when already taught, not below level ${COVER.from}`);
}
if (MUT || failed) { console.log(failed ? `cover: ${failed} check(s) FAILED` : 'cover: all checks pass'); process.exit(failed ? 1 : 0); }
console.log('cover: rule checks pass');

// ---- 3. Measured play
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
function careful(s) { // as bots.mjs: hunts what it can catch and keeps out of stronger animals' sight; knows nothing of cover
  const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity;
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = powerOf(m);
    if (pw > F.power) { const [far, half] = sightOf(M), reach = M.range * far * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < half + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; } }
    else if (pw < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
  }
  if (best) { const M = FORMS[best.f]; let tx = best.x, ty = best.y;
    if (M.speed > F.speed && bd > 40) { const back = Math.min(bd * 0.7, 70); tx -= Math.cos(best.a) * back; ty -= Math.sin(best.a) * back; }
    const d = Math.hypot(tx - p.x, ty - p.y) || 1; vx += (tx - p.x) / d; vy += (ty - p.y) / d; }
  return { x: vx, y: vy };
}
// hider: careful, and uses cover. Chased, it bends its run toward a rock that lies ahead (within about 37 degrees) and passes behind
// it, then keeps the rock between. In grass with a stronger animal near that has not seen it, it stands still.
function hider(s) {
  const p = s.player, F = me(s), C = coverOn(s), base = careful(s); if (!C) return base;
  let th = null, td = Infinity, near = false;
  for (const m of s.mobs) { if (powerOf(m) <= F.power) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if ((m.alert || m.hunt > 0) && d < td) { td = d; th = m; } else if (d < reachOf(FORMS[m.f], F) * 1.3) near = true; }
  if (!th) return near && C.grass.some(g => Math.hypot(g.x - p.x, g.y - p.y) < g.r - F.r) ? { x: 0, y: 0 } : base;
  const bl = Math.hypot(base.x, base.y); if (bl < 1e-6 || td > 420) return base; const fx = base.x / bl, fy = base.y / bl;
  if (rockBetween(C.rocks, th.x, th.y, p.x, p.y)) { const ux = p.x - th.x, uy = p.y - th.y, ul = Math.hypot(ux, uy) || 1; return { x: ux / ul, y: uy / ul }; }
  let best = null, bd = 260;
  for (const k of C.rocks) { const kx = k.x - p.x, ky = k.y - p.y, d = Math.hypot(kx, ky); if (d > bd || d < 1 || (kx * fx + ky * fy) / d < 0.8) continue; bd = d; best = k; }
  if (!best) return base;
  const ux = best.x - th.x, uy = best.y - th.y, ul = Math.hypot(ux, uy) || 1, o = best.r + F.r + 20, sx = -uy / ul, sy = ux / ul;
  const side = (p.x - best.x) * sx + (p.y - best.y) * sy >= 0 ? 1 : -1, behind = ((p.x - best.x) * ux + (p.y - best.y) * uy) / ul > 0;
  const gx = behind ? best.x + ux / ul * o : best.x + sx * side * o, gy = behind ? best.y + uy / ul * o : best.y + sy * side * o, d = Math.hypot(gx - p.x, gy - p.y) || 1;
  return { x: (gx - p.x) / d, y: (gy - p.y) / d };
}
function play(policy, cover, wild, pick, n) {
  let chases = 0, broken = 0, deaths = 0, deathsHigh = 0; const tops = [];
  for (let seed = 101; seed < 101 + n; seed++) {
    const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, wild, null, [], { cover }), on = new Set(); let top = 1;
    for (let i = 0; i < minutes * 3600; i++) {
      step(s, policy(s)); const F = me(s), high = level(s) >= COVER.from;
      for (const e of s.events) if (e.t === 'coverLost' && e.strong && on.has(e.id)) { broken++; on.delete(e.id); }
      for (const m of s.mobs) { if (powerOf(m) > F.power && m.alert && !on.has(m.id)) { on.add(m.id); if (high) chases++; } if (!m.alert) on.delete(m.id); }
      if (s.choosing) choose(s, pick);
      if (s.dead) { deaths++; if (high) deathsHigh++; on.clear(); revive(s, false); }
      top = Math.max(top, level(s)); if (s.won) break;
    }
    tops.push(top);
  }
  tops.sort((a, b) => a - b);
  return { chases, broken, deaths, deathsHigh, top: tops[tops.length >> 1] };
}
// Measured play takes about 8 minutes, so bots.mjs runs it only with --cover-play; run alone, this file always does (seeds 0: rules only).
const alone = !!process.argv[1]?.endsWith('cover-bots.mjs');
if (seeds > 0 && (alone || process.argv.includes('--cover-play'))) {
  const n = Math.max(4, Math.ceil(seeds / 2)), rows = [], sum = { off: 0, on: 0, hide: 0, offC: 0, onC: 0, hideC: 0, onB: 0, hideB: 0 };
  for (const wild of [true, false]) for (const pick of [0, 1, 2]) {
    const off = play(careful, false, wild, pick, n), on = play(careful, true, wild, pick, n), hide = play(hider, true, wild, pick, n);
    sum.off += off.deathsHigh; sum.on += on.deathsHigh; sum.hide += hide.deathsHigh; sum.offC += off.chases; sum.onC += on.chases; sum.hideC += hide.chases; sum.onB += on.broken; sum.hideB += hide.broken;
    console.log(`${wild ? 'WILD   ' : 'classic'} ${['strong', 'fast  ', 'sneaky'][pick]}: deaths at level ${COVER.from}+ without cover ${off.deathsHigh}, careful with cover ${on.deathsHigh}, hider ${hide.deathsHigh}; chases ${off.chases}/${on.chases}/${hide.chases}; broken by cover careful ${on.broken}, hider ${hide.broken}; level median ${off.top}/${on.top}/${hide.top}`);
  }
  const per = (d, c) => (100 * d / Math.max(1, c)).toFixed(1);
  console.log(`     ${n} seeds from 101, ${minutes} min, totals at level ${COVER.from}+: deaths per 100 chases without cover ${per(sum.off, sum.offC)}, careful with cover ${per(sum.on, sum.onC)}, hider ${per(sum.hide, sum.hideC)}`);
  console.log(`     cover broke ${per(sum.onB, sum.onC)}% of the careful bot's chases and ${per(sum.hideB, sum.hideC)}% of the hider's`);
  claim(sum.on <= sum.off * 1.1 + 3, `cover is no tax on a bot that ignores it: ${sum.on} deaths at level ${COVER.from}+ with cover against ${sum.off} without (limit +10%)`);
}
console.log(failed ? `cover: ${failed} check(s) FAILED` : 'cover: all checks pass');
if (failed) process.exit(1);
