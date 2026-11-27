// The page's reading of a colony game (sim 8 start): the nest view's brood sizes and store room, the ant card for a
// nurse, and the staffing counts. Page code with no canvas: the helpers nestview.js and host.js export.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Host } from '../host.js';
import { JOB, MAT, NEST, STAGE } from '../sim/sim.js';
import { C, addBrood } from '../sim/colony.js';
import { cellAt } from '../sim/grid.js';
import { findRooms, growth, larvaScale, storeRoom } from '../nestview.js';
import { WORDS } from '../words.js';

test('every brood item at the start has a finite size from 0 to 1; an unfed larva stays small', () => {
  const s = new Host(0, 1, { colony: true }).sim, B = s.brood;
  assert.ok(B.n > 0);
  for (let k = 0; k < B.n; k++) {
    const g = growth(B, k);
    assert.ok(Number.isFinite(g) && g >= 0 && g <= 1, `brood ${k} stage ${B.stage[k]}: ${g}`);
    if (B.stage[k] === STAGE.LARVA && B.fed[k] === 0) assert.ok(g <= 0.25, `unfed larva ${k}: ${g}`);
  }
});

test('a larva fed to be a major grows by age like any larva, and is drawn bigger', () => {
  const s = new Host(0, 1, { colony: true }).sim, B = s.brood;
  const k = B.n; addBrood(s, STAGE.LARVA);
  B.fed[k] = C.MAJOR_FEEDS; B.age[k] = 0;
  assert.ok(growth(B, k) < 0.1, 'just fed: not full size');
  B.age[k] = C.LARVA_TICKS;
  assert.equal(growth(B, k), 1);
  assert.ok(larvaScale(B, k) > 1);
  B.fed[k] = 1;
  assert.equal(larvaScale(B, k), 1);
});

test('the stores are drawn at the porch in a colony game, even when digging joins the porch to the nursery', () => {
  const s = new Host(0, 1, { colony: true }).sim, h = s.home, n = s.nursery;
  const at = r => [r.x0, r.y0, r.x1, r.y1];
  assert.deepEqual(at(storeRoom(s, findRooms(s))), [h.x, h.y, h.x + h.w - 1, h.y + h.h - 1]);
  for (let y = h.y; y < n.y + n.h; y++) for (let x = h.x; x < h.x + h.w; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  const rooms = findRooms(s);
  assert.ok(rooms.some(r => r.store && r.queen), 'one room holds the porch and the nursery');
  assert.deepEqual(at(storeRoom(s, rooms)), [h.x, h.y, h.x + h.w - 1, h.y + h.h - 1]);
});

test('the ant card names a nurse and says she is nursing; the staffing count has no diggers at the start', () => {
  const host = new Host(0, 1, { colony: true }), s = host.sim;
  const i = Array.from({ length: s.n }, (_, k) => k).find(k => s.job[k] === JOB.NURSE);
  const card = host.inspect(i);
  assert.equal(card.job, 'nurse'); assert.equal(card.why, 'nursing');
  for (const lang of WORDS.langs) { WORDS.setLang(lang); for (const key of ['nurse', 'why_nursing']) assert.notEqual(WORDS.t(key), key, `${lang} ${key}`); }
  WORDS.setLang('en');
  assert.equal(host.stats().dig.diggers, 0);
});
