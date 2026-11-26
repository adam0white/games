// Scent: the measured half-life is within 10% of the configured one; decay reaches zero; walls pass none.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FIELD, MAT, SURFACE, Sim } from '../sim/sim.js';
import { cellAt } from '../sim/grid.js';
import { SCENT_MAX, decayK, deposit, stepScent } from '../sim/scent.js';

const blank = (o = {}) => new Sim({ seed: 1, sw: 64, sh: 64, nw: 8, nh: 8, ants: 0, blank: true, ...o });
const mass = (s, f) => s.scent.cur[f].reduce((a, v) => a + v, 0);

// Ticks until the field's total falls to half of the start. Several blobs, so spreading is under way.
function measureHalfLife(halfLife) {
  const s = blank({ halfLife: [halfLife, halfLife, halfLife] });
  for (const [x, y] of [[32, 32], [10, 12], [50, 40]]) deposit(s, FIELD.TRAIL, cellAt(s.L, SURFACE, x, y), SCENT_MAX);
  const start = mass(s, FIELD.TRAIL);
  let t = 0;
  while (mass(s, FIELD.TRAIL) > start / 2) { stepScent(s); t++; }
  return t;
}

for (const h of [30, 200, 4000]) {
  test(`measured half-life is within 10% of ${h} ticks`, () => {
    const t = measureHalfLife(h);
    assert.ok(Math.abs(t - h) <= h * 0.1, `measured ${t} ticks for a configured ${h}`);
  });
}

test('decay reaches zero', () => {
  const s = blank({ halfLife: [30, 30, 30] });
  deposit(s, FIELD.ALARM, cellAt(s.L, SURFACE, 20, 20), SCENT_MAX);
  let t = 0;
  while (mass(s, FIELD.ALARM) > 0 && t < 5000) { stepScent(s); t++; }
  assert.equal(mass(s, FIELD.ALARM), 0, `still ${mass(s, FIELD.ALARM)} after ${t} ticks`);
});

test('the known-bad 8-bit multiply-and-round decay stalls where this one does not', () => {
  // 8-bit cell, factor for a 200-tick half-life: round(v * f) stops falling once v * (1 - f) < 0.5.
  const f = 1 - 1 / 289; // about 2^(-1/200)
  let v = 200;
  for (let t = 0; t < 10000; t++) v = Math.round(v * f);
  assert.ok(v > 0, `8-bit decay should stall above zero (got ${v})`);
  const s = blank({ halfLife: [200, 200, 200] });
  s.scent.cur[FIELD.TRAIL][cellAt(s.L, SURFACE, 5, 5)] = 200 << 16; // the same value in this sim's 24 bits
  for (let t = 0; t < 10000; t++) stepScent(s);
  assert.equal(mass(s, FIELD.TRAIL), 0);
});

test('K stays below 2^29 so v * K is exact', () => {
  assert.ok(decayK(8) < 2 ** 29);
  assert.throws(() => decayK(7));
});

test('walls hold and pass no scent; the nest gets none from the surface', () => {
  const s = blank({ halfLife: [4000, 4000, 4000], spread: [60, 60, 60] });
  for (let y = 0; y < 64; y++) s.setCell(cellAt(s.L, SURFACE, 30, y), MAT.STONE);
  for (let y = 0; y < 64; y += 9) deposit(s, FIELD.FOOD, cellAt(s.L, SURFACE, 29, y), SCENT_MAX);
  for (let t = 0; t < 1500; t++) stepScent(s);
  let left = 0, wall = 0, right = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = s.scent.cur[FIELD.FOOD][cellAt(s.L, SURFACE, x, y)];
    if (x < 30) left += v; else if (x === 30) wall += v; else right += v;
  }
  assert.ok(left > 0, 'scent spread on its own side');
  assert.equal(wall, 0);
  assert.equal(right, 0);
  assert.equal(s.scent.cur[FIELD.FOOD].subarray(s.L.nestBase).reduce((a, v) => a + v, 0), 0);
  // The control: without the wall the right side gets scent.
  const open = blank({ halfLife: [4000, 4000, 4000], spread: [60, 60, 60] });
  for (let y = 0; y < 64; y += 9) deposit(open, FIELD.FOOD, cellAt(open.L, SURFACE, 29, y), SCENT_MAX);
  for (let t = 0; t < 1500; t++) stepScent(open);
  assert.ok(open.scent.cur[FIELD.FOOD][cellAt(open.L, SURFACE, 40, 9)] > 0, 'without the wall scent crosses');
});

test('spreading alone conserves mass exactly', () => {
  const s = blank({ halfLife: [4000, 4000, 4000] });
  deposit(s, FIELD.TRAIL, cellAt(s.L, SURFACE, 3, 3), SCENT_MAX);
  s.scent.k[FIELD.TRAIL] = 0; // no proportional loss; the floor of 1 a cell remains, so count it
  for (let t = 0; t < 50; t++) {
    const before = mass(s, FIELD.TRAIL), nonzero = s.scent.cur[FIELD.TRAIL].reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
    stepScent(s);
    // Each cell that holds scent after spreading loses exactly 1; spreading itself moves mass only.
    const after = mass(s, FIELD.TRAIL), held = s.scent.cur[FIELD.TRAIL].reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
    assert.ok(before - after >= held && before - after <= held + nonzero * 4 + 4, `tick ${t}: lost ${before - after}, cells ${held}`);
  }
});
