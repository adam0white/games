import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

const source = new URL('./sim.js', import.meta.url);
if (process.argv.includes('--mutate')) {
  const code = await readFile(source, 'utf8');
  const transfer = '0.055 + 0.90 * contact';
  assert.equal(code.split(transfer).length, 2, 'the mutation changes exactly one transfer law');
  registerHooks({
    load(url, context, nextLoad) {
      if (url !== source.href) return nextLoad(url, context);
      return { format: 'module', source: code.replace(transfer, '0.055'), shortCircuit: true };
    },
  });
}
const { createPlate, rub } = await import(source);
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
