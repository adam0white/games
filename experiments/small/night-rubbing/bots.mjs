import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

const source = new URL('./sim.js', import.meta.url);
// --mutate breaks the directional transfer law (the original mutation). --mutate=glaze gives glazed plates the
// ordinary law, --mutate=stone stops counting smudges, --mutate=lead lets the stick last for ever. Each must fail.
const mutation = process.argv.find(a => a.startsWith('--mutate'))?.split('=')[1] ?? (process.argv.includes('--mutate') ? 'transfer' : null);
if (mutation) {
  const code = await readFile(source, 'utf8');
  const swaps = {
    transfer: ['0.055 + 0.90 * contact', '0.055'],
    glaze: ['const glaze = s.glaze, stone = s.stone;', 'const glaze = false, stone = s.stone;'],
    stone: ['if (stone && stone[i]) { s.smudge++; continue; }', 'if (stone && stone[i]) continue;'],
    lead: ['if (!s.done && s.distance >= s.lead)', 'if (false)'],
  };
  const [from, to] = swaps[mutation] ?? assert.fail('unknown mutation ' + mutation);
  assert.equal(code.split(from).length, 2, 'the mutation changes exactly one place: ' + mutation);
  registerHooks({
    load(url, context, nextLoad) {
      if (url !== source.href) return nextLoad(url, context);
      return { format: 'module', source: code.replace(from, to), shortCircuit: true };
    },
  });
}
const { createPlate, createSheet, rub, stars } = await import(source);
const { PLATES, DAILY_KINDS, SMUDGE_LIMIT, dailySpec, kindOf } = await import(new URL('./plates.js', import.meta.url));
const { careful, plan, rate } = await import(new URL('./plan.js', import.meta.url));
const seeds = [0, 1, 47, 301, 7907, 16777213, 2147483648, 4294967295];

// Pick a long horizontal line across the fossil that crosses both relief and
// flat paper. On this line every sampled pixel receives the same traversal.
function contrast(level) {
  const s = createPlate(level, 2909);
  let sample;
  for (let y = 40; y < s.height - 40; y++) {
    const high = [], flat = [];
    for (let x = 45; x < s.width - 45; x++) {
      const i = y * s.width + x;
      if (s.relief[i] > 0.55) high.push(i);
      if (s.relief[i] < 0.05) flat.push(i);
    }
    const balance = Math.min(high.length, flat.length);
    if (!sample || balance > sample.balance) sample = { y, high, flat, balance };
  }
  assert.ok(sample.balance >= 12, 'both surfaces occur in the same stroke');
  const before = s.pigment.slice();
  rub(s, 4, sample.y, s.width - 4, sample.y);
  const gain = indices => indices.reduce((sum, i) => sum + s.pigment[i] - before[i], 0) / indices.length;
  const ridge = gain(sample.high), ground = gain(sample.flat);
  assert.ok(ground > 0 && ridge > ground * 3, `plate ${level}: relief must catch at least three times the pigment of flat paper (${ridge} / ${ground})`);
  return ridge / ground;
}

function stationary() {
  const s = createPlate(1, 71);
  const before = s.pigment.slice();
  const coverage = s.coverage;
  for (let i = 0; i < 240; i++) {
    const x = (i * 47) % s.width, y = (i * 13) % s.height;
    rub(s, x, y, x, y);
  }
  assert.equal(s.done, false);
  assert.equal(s.coverage, coverage);
  assert.equal(s.distance, 0);
  assert.deepEqual(s.pigment, before, 'lifting and tapping at new positions cannot join them');
}

function directionalContact(level) {
  const right = createPlate(level, 701);
  const left = createPlate(level, 701);
  rub(right, 20, 140, 220, 140);
  rub(left, 220, 140, 20, 140);
  let edgeGain = 0, total = 0, edges = 0;
  for (let y = 135; y <= 145; y++) {
    for (let x = 45; x <= 195; x++) {
      const i = y * right.width + x;
      const rise = right.relief[i + 1] - right.relief[i - 1];
      if (Math.abs(rise) < 0.32) continue;
      edges++;
      edgeGain += Math.sign(rise) * (right.pigment[i] - left.pigment[i]);
      total += (right.pigment[i] + left.pigment[i]) / 2;
    }
  }
  // At each pixel the tooth and capacity are identical. Only the direction
  // of motion changes which slope the leading edge of the stick meets.
  assert.ok(edges >= 12 && edgeGain > total * 0.10,
    `plate ${level}: reversing the stroke must change which edge catches more pigment (gain ${edgeGain / total})`);
  return edgeGain / total;
}

function subdivisions(level) {
  const single = createPlate(level, 701), split = createPlate(level, 701);
  rub(single, 60, 140, 180, 140);
  for (let x = 60; x < 180; x += 5) rub(split, x, 140, x + 5, 140);
  let sum = 0, difference = 0;
  for (let i = 0; i < single.pigment.length; i++) {
    sum += single.pigment[i];
    difference += Math.abs(single.pigment[i] - split.pigment[i]);
  }
  assert.ok(difference < sum * 0.05, 'subdividing a gesture preserves the print within 5%');
  return difference / sum;
}

function isolatedPatch() {
  const s = createPlate(1, 71);
  const before = s.pigment.slice();
  for (let i = 0; i < 150; i++) {
    rub(s, 95, 140, 145, 140);
    rub(s, 145, 140, 95, 140);
  }
  const remote = 90 * s.width;
  assert.deepEqual(s.pigment.subarray(0, remote), before.subarray(0, remote), 'a local rub leaves the top of the sheet untouched');
  assert.ok(!s.done && s.coverage < s.goal, 'repeatedly rubbing one patch cannot finish the plate');
  return s.coverage;
}

// Sweep across the sheet by hand. The bot knows its edges and cannot consult
// the hidden drawing. Slightly uneven spacing and slope vary with the seed.
function sweep(level, seed) {
  const s = createPlate(level, seed);
  const width = s.width;
  const phase = (seed % 113) / 18;
  let strokes = 0;
  for (let pass = 0; pass < 3 && !s.done; pass++) {
    for (let row = 0; row < 16 && !s.done; row++) {
      const y = 22 + row * 15.5 + 4 * Math.sin(row + phase) + pass;
      const slope = 9 * Math.sin(phase + row * 1.7);
      const from = strokes % 2 === 0 ? 12 : width - 12;
      const to = width - from;
      let px = from, py = y;
      for (let part = 1; part <= 8 && !s.done; part++) {
        const t = part / 8;
        const x = from + t * (to - from);
        const nextY = y + slope * t + 2 * Math.sin(Math.PI * t);
        const previous = s.coverage;
        rub(s, px, py, x, nextY);
        assert.ok(s.coverage >= previous && s.coverage <= 1, 'coverage increases within the physical area');
        px = x;
        py = nextY;
      }
      strokes++; // Lift before starting the next sweep.
    }
  }
  assert.ok(s.done && s.coverage >= s.goal, `sweeping plate ${level}, seed ${seed} should finish it, coverage ${s.coverage}/${s.goal}`);
  assert.ok(s.distance > 0 && s.distance < 9000, 'campaign plates clear within 9,000 sheet units');
  assert.ok(s.pigment.every(p => Number.isFinite(p) && p >= 0 && p <= 1), 'deposition remains bounded');
  return { s, strokes };
}

const ratios = [];
for (let level = 1; level <= 6; level++) ratios.push(contrast(level));
console.log('Raised / flat pigment gain by plate:', ratios.map(r => r.toFixed(2)).join(', '));
const directions = [], splitDifferences = [];
for (let level = 1; level <= 6; level++) {
  directions.push(directionalContact(level));
  splitDifferences.push(subdivisions(level));
}
const percent = numbers => numbers.map(x => (100 * x).toFixed(2) + '%').join(', ');
console.log('Directional edge gain by plate:', percent(directions));
console.log('Event subdivision pigment difference by plate:', percent(splitDifferences));
// A scallop with most of the fan inked but its hinge still bare was filed
// in the first build. A total dark-pixel count alone misses this case.
const partialShell = createPlate(1, 29);
for (let y = 40; y <= 150; y += 10) rub(partialShell, 20, y, 220, y);
assert.ok(partialShell.dark / partialShell.target > 0.70, 'the upper fan alone passes the old rule');
assert.equal(partialShell.done, false, 'the hinge must also catch pigment');
console.log('Upper fan only: ' + (100 * partialShell.dark / partialShell.target).toFixed(2)
  + '% of ridge pixels marked, ' + (100 * partialShell.coverage).toFixed(2) + '% coverage score.');

stationary();
const patch = isolatedPatch();
console.log(`240 taps: zero pigment change. 300 strokes across the same patch: ${(100 * patch).toFixed(2)}% coverage.`);

for (let level = 1; level <= 6; level++) {
  let longest = 0, mostStrokes = 0;
  for (const seed of seeds) {
    const { s, strokes } = sweep(level, seed);
    longest = Math.max(longest, s.distance);
    mostStrokes = Math.max(mostStrokes, strokes);
  }
  console.log(`Plate ${level}: ${seeds.length}/${seeds.length}, at most ${mostStrokes} strokes, ${longest.toFixed(1)} sheet units.`);
}

const replay = sweep(3, 47);
assert.deepEqual(replay, sweep(3, 47), 'identical input reconstructs the sheet exactly');
const different = createPlate(3, 48);
rub(different, 45, 140, 195, 140);
const same = createPlate(3, 47);
rub(same, 45, 140, 195, 140);
assert.notDeepEqual(different.pigment, same.pigment, 'the paper seed affects the deposition');
console.log('Exact replay and distinct paper seeds verified.');

// Parity: plates 1 to 6 take exactly the path they took before plates 7 to 12 (2026-11-25). Hashes of the pigment
// after 400 random strokes, and coverage and marked cells after 40, recorded from main's sim.js before the change.
const PARITY = [[1, 3, 1704876085, 0.9752554030849381, 10892], [1, 9001, 2816033448, 0.9060491738098998, 10768],
  [2, 3, 552438327, 0.8425169539098847, 12363], [2, 9001, 1419748024, 0.9913871609150648, 12786],
  [3, 3, 2844930979, 0.8321654298200145, 8223], [3, 9001, 1557563091, 0.9751342285658262, 8455],
  [4, 3, 3565266666, 0.9596964041194407, 7990], [4, 9001, 3818295231, 0.8247220512820513, 7793],
  [5, 3, 1483876827, 0.9935359893486535, 5294], [5, 9001, 4178855200, 0.9773220601917139, 5255],
  [6, 3, 434737379, 0.7942499959408729, 5366], [6, 9001, 1851416629, 0.7788760259659773, 5336]];
for (const [level, seed, hash, coverage40, dark40] of PARITY) {
  const s = createPlate(level, seed);
  let x = 120, y = 140, r = seed;
  for (let i = 0; i < 400; i++) {
    if (i === 40) assert.deepEqual([s.coverage, s.dark], [coverage40, dark40], `plate ${level} seed ${seed}: the same print after 40 strokes as before`);
    r = (Math.imul(r, 1103515245) + 12345) >>> 0;
    const nx = 10 + (r % 220), ny = 10 + ((r >>> 12) % 260);
    rub(s, x, y, nx, ny); x = nx; y = ny;
  }
  let h = 2166136261;
  for (const b of new Uint8Array(s.pigment.buffer)) h = Math.imul(h ^ b, 16777619) >>> 0;
  assert.equal(h, hash, `plate ${level} seed ${seed}: the same pigment, bit for bit, as before plates 7 to 12`);
  assert.ok(!s.spoiled && !Number.isFinite(s.lead) && !s.glaze && !s.stone, `plate ${level}: no stick limit, glaze or grit`);
}
console.log(`Parity: plates 1 to 6 give the same pigment bit for bit as before (${PARITY.length} runs of 400 strokes).`);

// Strategies. naive is the old bot above (sweep), unchanged: the whole sheet, back and forth, three passes.
// rows: back and forth, only over the fossil (what a player learns from the stick). hatch: rows and columns, both
// ways, over the fossil. pocket: rows over the fossil, broken wherever the stick would touch grit. careful: all of it.
function naive(make, seed) {
  const s = make();
  const width = s.width, phase = (seed % 113) / 18;
  let strokes = 0;
  for (let pass = 0; pass < 3 && !s.done && !s.spoiled; pass++) {
    for (let row = 0; row < 16 && !s.done && !s.spoiled; row++) {
      const y = 22 + row * 15.5 + 4 * Math.sin(row + phase) + pass;
      const slope = 9 * Math.sin(phase + row * 1.7);
      const from = strokes % 2 === 0 ? 12 : width - 12, to = width - from;
      let px = from, py = y;
      for (let part = 1; part <= 8 && !s.done && !s.spoiled; part++) {
        const t = part / 8, x = from + t * (to - from), nextY = y + slope * t + 2 * Math.sin(Math.PI * t);
        rub(s, px, py, x, nextY); px = x; py = nextY;
      }
      strokes++;
    }
  }
  return s;
}
const STRATEGIES = {
  naive: (make, seed) => naive(make, seed),
  rows: make => { const s = make(); careful(s, { glaze: false, avoid: false }); return s; },
  hatch: make => { const s = make(); careful(s, { glaze: true, avoid: false }); return s; },
  pocket: make => { const s = make(); careful(s, { glaze: false, avoid: true }); return s; },
  careful: make => { const s = make(); careful(s); return s; },
};
const outcome = s => s.done ? stars(s) : 0; // 0: not filed (spoiled, or out of strokes)
const plateSeed = level => 19023 + level * 583; // the page's paper for a plate (main.js)

// Par and stick length in plates.js are what plan.js rate() gives on each plate's own paper.
for (const [i, plate] of PLATES.entries()) {
  const level = i + 1, s0 = createPlate(level, 1);
  const rated = rate({ ...plate, radius: s0.radius, goal: s0.goal }, plateSeed(level), createSheet);
  assert.ok(rated, `plate ${level}: the careful rubber files it`);
  assert.equal(plate.par, rated.par, `plate ${level}: par in plates.js is the careful rubber's distance plus a quarter`);
  if (level > 6) assert.equal(plate.lead, rated.lead, `plate ${level}: the stick is twice the careful rubber's distance`);
  else assert.equal(plate.lead, undefined, `plate ${level}: plates 1 to 6 have no stick limit`);
}

const SEEDS = [plateSeed(0), 0, 47, 301, 7907, 16777213, 2147483648, 4294967295];
const table = [];
for (const [i, plate] of PLATES.entries()) {
  const level = i + 1, k = kindOf(plate), row = { level, id: plate.id, kind: k };
  for (const [name, play] of Object.entries(STRATEGIES)) {
    const results = SEEDS.map((seed, n) => play(() => createPlate(level, n === 0 ? plateSeed(level) : seed), seed));
    row[name] = { filed: results.filter(s => s.done).length, stars: results.map(outcome), distance: Math.round(results[0].distance),
      spoiled: results.filter(s => s.spoiled).map(s => s.spoiled)[0] ?? null, smudge: results[0].smudge };
  }
  const own = STRATEGIES.careful(() => createPlate(level, plateSeed(level)));
  row.margin = { stick: Number.isFinite(own.lead) ? own.filedAt / own.lead : null, par: own.filedAt / own.par, smudge: own.smudge };
  table.push(row);
}
const count = (rows, name, test) => rows.filter(r => test(r[name])).length;
console.log('\nPer plate, eight papers each (filed count; stars on the plate\'s own paper, 0 = not filed):');
console.log('plate'.padEnd(18) + 'kind'.padEnd(13) + Object.keys(STRATEGIES).map(n => n.padEnd(12)).join('') + 'careful/stick');
for (const r of table) {
  console.log(`${String(r.level).padStart(2)} ${r.id}`.padEnd(18) + r.kind.padEnd(13)
    + Object.keys(STRATEGIES).map(n => `${r[n].filed}/8 ${'★'.repeat(r[n].stars[0])}${r[n].spoiled && !r[n].stars[0] ? '(' + r[n].spoiled + ')' : ''}`.padEnd(12)).join('')
    + (r.margin.stick === null ? '-' : (100 * r.margin.stick).toFixed(0) + '%'));
}

// Claims. The careful rubber files every plate on every paper, with three stars on the plate's own paper.
for (const r of table) {
  assert.equal(r.careful.filed, 8, `plate ${r.level}: the careful rubber files it on all eight papers`);
  assert.equal(r.careful.stars[0], 3, `plate ${r.level}: three stars for the careful rubber on its own paper`);
  assert.ok(r.careful.stars.every(n => n >= 2), `plate ${r.level}: at least two stars on every paper`);
  assert.equal(r.careful.smudge, 0, `plate ${r.level}: the careful rubber never touches grit`);
}
// The old way of playing (naive) still files plates 1 to 6 (the old rule is unchanged) but only for one star;
// on plates 7 to 12 it never files.
for (const r of table.filter(r => r.level <= 6)) {
  assert.equal(r.naive.filed, 8, `plate ${r.level}: the old sweep still files it`);
  assert.ok(r.naive.stars.every(n => n === 1), `plate ${r.level}: the old sweep scores one star`);
}
for (const r of table.filter(r => r.level > 6)) assert.equal(r.naive.filed, 0, `plate ${r.level} (${r.kind}): the old sweep cannot file it`);
// Three kinds that each need their own idea: rows over the fossil fail on glaze and on stone; cross-hatching
// fails on stone; keeping off the grit fails on glaze. Each kind is filed by the strategy made for it.
const kindRows = k => table.filter(r => r.kind === k || (k !== 'lead' && r.kind === 'glaze-stone'));
for (const r of kindRows('lead')) assert.equal(r.rows.filed, 8, `plate ${r.level}: rows over the fossil file a lead plate`);
for (const r of kindRows('glaze')) {
  assert.equal(r.rows.filed, 0, `plate ${r.level}: rows alone cannot file a glazed plate`);
  assert.equal(r.pocket.filed, 0, `plate ${r.level}: keeping off the grit alone cannot file a glazed plate`);
  if (r.kind === 'glaze') assert.equal(r.hatch.filed, 8, `plate ${r.level}: cross-hatching files a glazed plate`);
}
for (const r of kindRows('stone')) {
  assert.equal(r.rows.filed, 0, `plate ${r.level}: rows that cross the grit spoil a stone plate`);
  if (r.kind === 'stone') {
    assert.equal(r.hatch.filed, 0, `plate ${r.level}: cross-hatching that crosses the grit spoils a stone plate`);
    assert.equal(r.pocket.filed, 8, `plate ${r.level}: keeping off the grit files a stone plate`);
  }
}
const byKind = {};
for (const r of table) for (const name of Object.keys(STRATEGIES)) {
  const key = r.kind + ' ' + name;
  byKind[key] ??= { filed: 0, runs: 0, stars: 0 };
  byKind[key].filed += r[name].filed; byKind[key].runs += 8; byKind[key].stars += r[name].stars.reduce((a, b) => a + b, 0);
}
console.log('\nBy kind (filed / runs, mean stars per run):');
for (const k of ['free', 'lead', 'glaze', 'stone', 'glaze-stone']) {
  console.log(k.padEnd(12) + Object.keys(STRATEGIES).map(n => { const b = byKind[k + ' ' + n]; return `${n} ${b.filed}/${b.runs} ${(b.stars / b.runs).toFixed(2)}★`.padEnd(22); }).join(''));
}
console.log('\nCareful rubber, share of the stick used on its own paper: '
  + table.filter(r => r.margin.stick !== null).map(r => `${r.level} ${(100 * r.margin.stick).toFixed(0)}%`).join(', ')
  + '. Share of par: ' + table.map(r => `${r.level} ${(100 * r.margin.par).toFixed(0)}%`).join(', ') + '.');

// A shaky careful rubber, closer to a thumb: the same plan, but every stroke starts and ends up to 6 cells off and
// bows sideways by up to 6 cells. It still files every new plate on every paper, so the stick and the grit leave
// room for an imprecise hand. Its least margin is printed.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shaky(s, wobble, random) {
  const off = () => (random() * 2 - 1) * wobble;
  for (const offset of [0, 0.5, 0.25]) {
    if (s.done || s.spoiled) break;
    for (const [x0, y0, x1, y1] of plan(s, { offset })) {
      if (s.done || s.spoiled) break;
      const ax = x0 + off(), ay = y0 + off(), bx = x1 + off(), by = y1 + off(), bow = off();
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy) || 1, n = Math.max(1, Math.ceil(length / 10));
      let px = ax, py = ay;
      for (let k = 1; k <= n && !s.done && !s.spoiled; k++) {
        const t = k / n, side = bow * Math.sin(Math.PI * t), x = ax + dx * t - dy / length * side, y = ay + dy * t + dx / length * side;
        rub(s, px, py, x, y); px = x; py = y;
      }
    }
  }
  return s;
}
let shakyMost = { stick: 0, smudge: 0 }, shakyStars = [];
for (const [i] of PLATES.entries()) {
  const level = i + 1;
  if (level < 7) continue;
  for (const [n, seed] of SEEDS.entries()) {
    const s = shaky(createPlate(level, n === 0 ? plateSeed(level) : seed), 6, rng(seed + level * 101));
    assert.ok(s.done, `plate ${level}: a careful rubber whose strokes are 6 cells off still files it (paper ${seed}, ${s.spoiled ?? 'not filed'})`);
    shakyMost = { stick: Math.max(shakyMost.stick, s.filedAt / s.lead), smudge: Math.max(shakyMost.smudge, s.smudge) };
    shakyStars.push(stars(s));
  }
}
console.log(`Shaky careful rubber (strokes up to 6 cells off), plates 7 to 12 on eight papers: ${shakyStars.length}/${shakyStars.length} filed, `
  + `mean ${(shakyStars.reduce((a, b) => a + b, 0) / shakyStars.length).toFixed(2)} stars, at most ${(100 * shakyMost.stick).toFixed(0)}% of the stick, at most ${shakyMost.smudge} smudges of ${SMUDGE_LIMIT}.`);

// The daily plate: every specimen in every way is filed by the careful rubber; sixty days from 2026-11-25 are
// each filed by it with three stars and never by the old sweep; the same date gives the same plate.
for (const [p] of PLATES.entries()) for (const [k] of DAILY_KINDS.entries()) for (const mirror of [false, true]) {
  const spec = dailySpec('pool', { plate: p, kind: k, mirror });
  assert.ok(rate(spec, spec.seed, createSheet), `daily pool: ${PLATES[p].id} ${DAILY_KINDS[k].kind}${mirror ? ' mirrored' : ''} is filed by the careful rubber`);
}
const kinds = {};
let dailyNaive = 0, dailyThree = 0;
for (let d = 0; d < 60; d++) {
  const day = new Date(Date.UTC(2026, 10, 25 + d)).toISOString().slice(0, 10);
  const spec = dailySpec(day), rated = rate(spec, spec.seed, createSheet);
  assert.deepEqual(dailySpec(day).seed, spec.seed, 'the same day gives the same plate');
  const make = () => createSheet({ ...spec, ...rated }, spec.seed);
  const c = STRATEGIES.careful(make), n = naive(make, 47);
  assert.ok(c.done && stars(c) === 3, `daily ${day}: three stars for the careful rubber`);
  if (n.done) dailyNaive++;
  if (stars(c) === 3) dailyThree++;
  kinds[spec.kind] = (kinds[spec.kind] || 0) + 1;
}
assert.equal(dailyNaive, 0, 'the old sweep files no daily plate');
console.log(`Daily: all ${PLATES.length * DAILY_KINDS.length * 2} specimen, way and mirror combinations filed by the careful rubber; 60 days: careful 3 stars ${dailyThree}/60, old sweep filed 0/60; ways ${JSON.stringify(kinds)}.`);
