// Flow against tilt: how many drops a second leave the jug when the thumb holds one tilt, at three jug fills.
//   node flow.mjs [--sim=path/to/sim.js] [--seeds=12] [--level=1] [--steady] [--json]
// --steady: drops a second over the second that starts half a second after the jug reaches the tilt (the held rate).
// For each fill, the jug first pours down to that fill and stands for 1.5 s; then the thumb asks for the tilt, and the
// drops that leave while the jug turns there and in the second after it arrives are counted (what a thumb sees when it holds that tilt). Mean and spread are over seeds.
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const simPath = arg('sim', './sim.js');
const sim = await import(simPath.startsWith('/') ? simPath : new URL(simPath, import.meta.url).href);
const seeds = +arg('seeds', 12), level = +arg('level', 1), steady = process.argv.includes('--steady');

const startFill = [];
export function flowAt(tilt, fill, seed) {
  const s = sim.create(level, seed);
  s.L = { ...s.L, spill: 1e9, time: 1e9, target: 1e6, band: 1 };
  const drops = s.inJug, ctrl = () => s.ctrl ?? s.angle;
  let guard = 0;
  // Pour gently down to the fill (lifting as soon as it is reached), then stand.
  for (let t = 0; s.inJug > fill * drops && guard++ < 1200; t += 0.004) sim.step(s, Math.min(sim.MAX_TILT, 0.9 + t));
  for (let i = 0; i < 90; i++) sim.step(s, 0);
  startFill.push(s.inJug / drops);
  guard = 0;
  let out = 0;
  while (ctrl() < tilt - 0.005 && guard++ < 600) { sim.step(s, tilt); if (!steady) for (const e of s.events) if (e === 'out') out++; }
  if (steady) for (let i = 0; i < 30; i++) sim.step(s, tilt);
  for (let i = 0; i < 60; i++) { sim.step(s, tilt); for (const e of s.events) if (e === 'out') out++; }
  return out;
}

const tilts = []; for (let t = 0.6; t <= 2.401; t += 0.1) tilts.push(+t.toFixed(2));
const fills = [1, 0.75, 0.5];
const startFillBy = {};
const table = fills.map(fill => ({ fill, points: tilts.map(tilt => {
  startFill.length = 0;
  const v = []; for (let seed = 1; seed <= seeds; seed++) v.push(flowAt(tilt, fill, seed));
  const mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  startFillBy[fill] = startFill.reduce((a, b) => a + b, 0) / startFill.length;
  return { tilt, mean, sd };
}) }));
if (process.argv.includes('--json')) console.log(JSON.stringify(table));
else for (const { fill, points } of table) {
  const ups = points.slice(1).filter((p, i) => p.mean >= points[i].mean - 0.5).length;
  const flowing = points.filter(p => p.mean > 1), cv = flowing.reduce((a, p) => a + p.sd / p.mean, 0) / Math.max(1, flowing.length);
  console.log(`fill ${fill * 100}% (measured start fill ${(fills.length && startFillBy[fill]).toFixed(2)}): ${points.map(p => `${p.tilt}:${p.mean.toFixed(1)}±${p.sd.toFixed(1)}`).join(' ')}`);
  console.log(`   monotone steps ${ups}/${points.length - 1}; mean spread/mean where flowing ${cv.toFixed(2)}; onset ${points.find(p => p.mean > 1)?.tilt ?? '-'} rad`);
}
