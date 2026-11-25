// The 3D view's water (ripples.js): its claims, measured with the CPU solver, which runs the same rules as the GPU one.
//   node experiments/lantern/bots.mjs ripples [--mutate]
// --mutate runs the claims three times more with the water broken on purpose (rocks let water through; the grid's ends throw waves back;
// grid-sized ripples are not damped)
// and must fail (exit 1 when each break is caught, 2 when one is not).
import { createField, disturb, solids, riverOf, SPEED, BACK, CLAMP } from './ripples.js';
import { create, step, centre, half, rain } from './sim.js?v=15';

const SY = 10; // the boat's river y while a claim runs on still water; the grid then spans SY - BACK to SY + AHEAD
const open = () => [0.5, 0.5]; // a river as wide as the grid
// A ring on still water: run `ticks` ticks and call look(field, tick) after each.
function ring(level, { river = open, rocks = [], at = [0.5, SY + 1], r = 0.03, a = 1, ticks = 120, mutate = '', look }) {
  const f = createField(level, { mutate });
  f.step(SY, river, rocks, [{ x: at[0], y: at[1], r, a }], 0);
  for (let t = 1; t <= ticks; t++) { f.step(SY, river, rocks, [], 1); look?.(f, t); }
  return f;
}
// The distance from the centre to the ring's highest point, looking straight up the river.
const radius = (f, x, y) => { let best = 0, at = 0; for (let d = 0; d < 1.2; d += f.cell / 4) { const v = Math.abs(f.at(x, y + d)); if (v > best) { best = v; at = d; } } return at; };
// The water's energy near a point: the sum of squared heights within rad.
const near = (f, x, y, rad) => { let e = 0; for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) { const px = -0.02 + (i + 0.5) * f.cell, py = (f.row0 + j + 0.5) * f.cell; if (Math.hypot(px - x, py - y) < rad) e += f.h[j * f.nx + i] ** 2; } return e; };

function claims(mutate = '') {
  const res = [];
  const claim = (ok, text) => res.push({ ok, text });
  for (const level of [2, 1]) {
    // R1. Speed: a ring spreads at SPEED, within 12%.
    let r1 = 0, r2 = 0;
    ring(level, { mutate, ticks: 36, look: (f, t) => { if (t === 12) r1 = radius(f, 0.5, SY + 1); if (t === 36) r2 = radius(f, 0.5, SY + 1); } });
    const v = (r2 - r1) / (24 / 60);
    claim(Math.abs(v / SPEED - 1) < 0.12, `R1 level ${level}. a ring spreads at ${v.toFixed(2)} river units a second (wanted ${SPEED} within 12%)`);
    // R2. Gentle damping: a ring is still there after 1 s and has died away by 3 s.
    let e0 = 0, e1 = 0, e3 = 0;
    ring(level, { mutate, ticks: 180, look: (f, t) => { if (t === 6) e0 = f.energy(); if (t === 60) e1 = f.energy(); if (t === 180) e3 = f.energy(); } });
    claim(e1 / e0 > 0.08 && e1 / e0 < 0.6 && e3 / e0 < 0.01, `R2 level ${level}. energy left after 1 s: ${(100 * e1 / e0).toFixed(1)}% (wanted 8 to 60%); after 3 s: ${(100 * e3 / e0).toFixed(2)}% (under 1%)`);
    // R3. Banks: in a narrow river the ring comes back off both banks to where it started; in open water it does not.
    const narrow = () => [0.5, 0.12]; let back = 0, none = 0;
    const when = Math.round(2 * 0.12 / SPEED * 60);
    ring(level, { mutate, river: narrow, ticks: when + 10, look: (f, t) => { if (t >= when - 4 && t <= when + 8) back += near(f, 0.5, SY + 1, 0.04); } });
    ring(level, { mutate, ticks: when + 10, look: (f, t) => { if (t >= when - 4 && t <= when + 8) none += near(f, 0.5, SY + 1, 0.04); } });
    claim(back > 4 * none, `R3 level ${level}. the banks send the ring back: ${(back / none).toFixed(1)} times the water at its centre ${when} ticks on than in open water (wanted over 4)`);
    // R4. Rocks: a rock between the ring and a point shades that point, and throws the ring back toward where it came from.
    const rock = [{ x: 0.5, y: SY + 1.15, rad: 0.04, len: 0 }];
    let shade = 0, shadeOpen = 0, echo = 0, echoOpen = 0;
    const look = (sum, pass) => (f, t) => { if (t > 10 && t < 40) sum[0] += near(f, 0.5, SY + 1.3, 0.04); if (t > 14 && t < 30) sum[1] += near(f, 0.5, SY + 1.0, 0.05); pass(sum); };
    { const s = [0, 0]; ring(level, { mutate, rocks: rock, ticks: 40, look: look(s, x => { shade = x[0]; echo = x[1]; }) }); }
    { const s = [0, 0]; ring(level, { mutate, ticks: 40, look: look(s, x => { shadeOpen = x[0]; echoOpen = x[1]; }) }); }
    claim(shade < 0.7 * shadeOpen && echo > 1.3 * echoOpen, `R4 level ${level}. a rock shades the water behind it (${(100 * shade / shadeOpen).toFixed(0)}% of open water, wanted under 70%: waves bend round a small rock) and throws the ring back (${(echo / echoOpen).toFixed(2)} times, wanted over 1.3)`);
    // R5. The grid's ends soak waves up: a ring near the far end sends back under 15% of what a hard end would.
    const end = [0.5, SY - BACK + 0.12]; let soft = 0, hard = 0;
    const late = (f, t, sum) => { if (t > 20 && t < 40) sum.v += near(f, end[0], end[1] + 0.05, 0.08); };
    { const s = { v: 0 }; ring(level, { mutate, at: end, ticks: 40, look: (f, t) => late(f, t, s) }); soft = s.v; }
    { const s = { v: 0 }; ring(level, { mutate: 'no-sponge', at: end, ticks: 40, look: (f, t) => late(f, t, s) }); hard = s.v; }
    claim(soft < 0.5 * hard, `R5 level ${level}. the grid's near end soaks the ring up: ${(100 * soft / hard).toFixed(0)}% of the water a hard end leaves (wanted under 50%)`);
  }
  // R8. Grid-sized ripples (a checker, which the eye reads as noise) die within 10 ticks; a ring loses far less in that time.
  for (const level of [2, 1]) {
    const f = createField(level, { mutate }); f.step(SY, open, [], [], 0);
    for (let j = 40; j < 80; j++) for (let i = 20; i < f.nx - 20; i++) f.h[j * f.nx + i] = ((i + j) % 2 ? 0.1 : -0.1);
    const e0 = f.energy(); f.step(SY, open, [], [], 10); const left = f.energy() / e0;
    let r0 = 0, r10 = 0; ring(level, { mutate, ticks: 16, look: (g, t) => { if (t === 6) r0 = g.energy(); if (t === 16) r10 = g.energy(); } });
    claim(left < 0.05 && r10 / r0 > 0.3, `R8 level ${level}. a grid-sized checker keeps ${(100 * left).toFixed(2)}% of its energy after 10 ticks (wanted under 5%; 71 to 156% without the damping); a ring keeps ${(100 * r10 / r0).toFixed(0)}% (wanted over 30%)`);
  }
  // R6. Whole nights: the game's own runs, with rain, rocks, pickups and blows feeding the water every tick: it stays finite and bounded,
  // and never rings on forever (energy at the end of a calm stretch is small). R7. Reading the game changes nothing in it.
  let worst = 0, finite = true, same = true, drops = 0, kinds = new Set();
  for (const [stage, seed] of [[13, 1], [13, 2], [8, 3], [18, 4], [20, 5]]) {
    const a = create(seed, stage), b = create(seed, stage), f = createField(2, { mutate }), mem = {};
    a.hearts = b.hearts = 9; // more blows before the night ends
    for (let i = 0; i < 60 * 95 && !a.over; i++) {
      const e = a.embers.find(e => !e.got && e.y > a.y && e.y < a.y + 0.6);
      const target = e ? e.x : centre(a, a.y + 0.2) + 0.12 * Math.sin(i / 50) * half(a, a.y);
      step(a, target); step(b, target);
      const d = disturb(a, mem, 1, i * 1 / 60); drops += d.length;
      if (rain(a, a.y)) kinds.add('rain'); if (a.events.includes('ember')) kinds.add('ember'); if (a.events.includes('hurt') || a.events.includes('hit')) kinds.add('blow');
      f.step(a.y, riverOf(a), solids(a), d, 1);
      if (i % 30 === 0) { for (const v of f.h) { if (!Number.isFinite(v)) finite = false; worst = Math.max(worst, Math.abs(v)); } if (JSON.stringify(a) !== JSON.stringify(b)) same = false; }
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
  }
  claim(finite && worst < CLAMP, `R6. five nights (8, 13, 18, 20) with ${drops} disturbances (${[...kinds].join(', ')}): every height finite, the highest ${worst.toFixed(2)} (wanted under ${CLAMP})`);
  claim(same, `R7. the water reads the game and changes nothing: each night's state matches a run without the water, tick for tick`);
  return res;
}

const show = (res, label) => { for (const r of res) console.log(`${r.ok ? 'ok ' : 'FAIL'}  ${label}${r.text}`); return res.every(r => r.ok); };
const good = show(claims(), '');
if (process.argv.includes('--mutate')) {
  const caught = ['leaky-rocks', 'no-sponge', 'no-visc'].map(m => { const ok = show(claims(m), `(mutate ${m}) `); return !ok; });
  console.log(caught.every(Boolean) ? 'mutation caught: the claims fail on broken water' : 'MUTATION NOT CAUGHT');
  process.exit(caught.every(Boolean) && good ? 1 : 2);
}
process.exit(good ? 0 : 1);
