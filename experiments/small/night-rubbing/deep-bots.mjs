// Claims for the deeper sheet (deep-sim.js), in sheet time (seconds of rubbing at the bot's pace).
//   node deep-bots.mjs            all claims, exit 0
//   node deep-bots.mjs --mutate   pressure ignores speed: the scribble claim must fail (exit 1)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

const source = new URL('./deep-sim.js', import.meta.url);
if (process.argv.includes('--mutate')) {
  const code = await readFile(source, 'utf8');
  const from = 'export const pressureAt = speed => clamp((520 - speed) / 350, 0.04, 1.15);';
  assert.equal(code.split(from).length, 2, 'the mutation changes exactly one place');
  registerHooks({ load(url, context, next) {
    if (url !== source.href) return next(url, context);
    return { format: 'module', source: code.replace(from, 'export const pressureAt = speed => 1;'), shortCircuit: true };
  } });
}
const { createDeep, press, loadDeep, deepSpec, pressureAt, contrast } = await import(source);
const { createPlate, rub, pigmentByte, PROOFS } = await import(new URL('./sim.js', import.meta.url));
const { PLATES, dailySpec, dayHash } = await import(new URL('./plates.js', import.meta.url));
const { findsFor, FINDS } = await import(new URL('./finds.js', import.meta.url));
const { plan, careful: classicCareful } = await import(new URL('./plan.js', import.meta.url));

const specOf = level => deepSpec({ ...PLATES[level - 1], ...(PROOFS[level - 1] ?? {}) });
const make = (level, seed = 19023 + level * 583) => createDeep(specOf(level), seed, level, findsFor(level));
function go(s, x0, y0, x1, y1, pace, cap = Infinity) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
  let px = x0, py = y0;
  for (let k = 1; k <= n && s.time < cap; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    press(s, px, py, x, y, pace); px = x; py = y;
  }
}
// The whole sheet in rows, back and forth, a fresh offset each pass, until filed (or the clock runs out).
function sweep(s, pace, cap, untilAllFound = false) {
  for (let pass = 0; pass < 400 && s.time < cap; pass++) {
    for (let y = 8 + (pass % 3) * 4; y < 274 && s.time < cap; y += 10) go(s, pass % 2 ? 232 : 8, y, pass % 2 ? 8 : 232, y + 4, pace, cap);
    if (untilAllFound ? s.found.every(Boolean) : s.done) break;
  }
  return s;
}
// Rows cut to the specimen (plan.js), repeated with new offsets until filed: a person who sees the emboss.
function careful(s, pace, cap = 300) {
  for (let pass = 0; pass < 60 && !s.done && s.time < cap; pass++)
    for (const [a, b, c, d] of plan(s, { offset: (pass * 0.37) % 1, avoid: !!s.stone })) { go(s, a, b, c, d, pace, cap); if (s.done) break; }
  return s;
}
let failed = 0;
const claim = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (error) { failed++; console.log('FAIL', name, '\n     ', error.message); } };
const table = [];

claim('a scribble (800 units a second over the whole sheet) files no plate within 30 s', () => {
  for (let level = 1; level <= 12; level++) {
    const s = sweep(make(level), 800, 30);
    assert.ok(!s.done, `plate ${level} filed at ${s.filedAt?.toFixed(1)} s`);
  }
});
claim('a steady careful rubber (220 a second) files every plate in 8 to 90 s, without tearing', () => {
  for (let level = 1; level <= 12; level++) {
    const s = careful(make(level), 220);
    assert.ok(s.done, `plate ${level} not filed`);
    assert.ok(s.filedAt >= 8 && s.filedAt <= 90, `plate ${level} filed at ${s.filedAt.toFixed(1)} s`);
    assert.equal(s.tears, 0, `plate ${level} tore`);
    table.push({ level, careful: +s.filedAt.toFixed(1), contrast: +contrast(s).toFixed(2) });
  }
});
claim('sweeping the whole sheet at 220 finds every hidden find on every plate', () => {
  for (let level = 1; level <= 12; level++) {
    const s = sweep(make(level), 220, 400, true);
    assert.ok(s.found.every(Boolean), `plate ${level}: found ${s.found}`);
    table[level - 1].allFinds = +s.time.toFixed(1);
  }
});
claim('finds sit inside the sheet, apart from each other, never on the specimen', () => {
  for (let level = 1; level <= 12; level++) {
    const s = make(level);
    for (const f of s.finds) assert.ok(f.x >= 20 && f.x <= 220 && f.y >= 20 && f.y <= 260, `plate ${level} ${f.id} at ${f.x}, ${f.y}`);
    for (let k = 0; k < s.findTargets.length; k++) assert.ok(s.findTargets[k] > 40, `plate ${level} find ${k} has ${s.findTargets[k]} raised cells`);
    for (let i = 0; i < s.findOf.length; i++) assert.ok(!(s.findOf[i] && s.isMain[i]), 'a cell is both');
  }
  const seen = new Map();
  for (let level = 1; level <= 12; level++) for (const f of findsFor(level)) seen.set(f.id, (seen.get(f.id) ?? 0) + 1);
  assert.equal(seen.size, FINDS.length, 'every find lies in some plate');
});
claim('the daily plate: 30 days filed by the careful rubber and every find found by a sweep', () => {
  for (let d = 0; d < 30; d++) {
    const day = new Date(Date.UTC(2026, 10, 26 + d)).toISOString().slice(0, 10), spec = dailySpec(day);
    const fresh = () => createDeep(deepSpec(spec), spec.seed, 0, findsFor(dayHash(day) % PLATES.length + 1));
    assert.ok(careful(fresh(), 220).done, day + ' not filed');
    assert.ok(sweep(fresh(), 220, 400, true).found.every(Boolean), day + ' finds');
  }
});
claim('pace matters: pigment a second peaks at a steady middle pace', () => {
  const rate = pace => { const s = make(3); sweep(s, pace, 6); return s.coverage / s.time; };
  const slow = rate(90), steady = rate(250), fast = rate(520);
  assert.ok(steady > slow * 1.1 && steady > fast * 4, `90: ${slow}, 250: ${steady}, 520: ${fast}`);
  assert.ok(pressureAt(100) > 1 && pressureAt(600) < 0.1);
});
claim('lingering wears the paper through; a few steady passes do not', () => {
  const ridgeY = level => { const s = make(level); let best = 0, at = 140; for (let y = 60; y < 220; y++) { let n = 0; for (let x = 40; x < 200; x++) n += s.isMain[y * 240 + x]; if (n > best) { best = n; at = y; } } return at; };
  const y = ridgeY(1);
  const scrub = (passes, pace) => { const s = make(1); for (let k = 0; k < passes; k++) go(s, k % 2 ? 200 : 40, y, k % 2 ? 40 : 200, y, pace); return s.tears; };
  assert.equal(scrub(6, 220), 0, 'six steady passes tear');
  assert.ok(scrub(30, 100) > 0, 'thirty slow passes on one line never tear');
  assert.ok(scrub(30, 400) < scrub(30, 100), 'quick passes wear less');
});
claim('heavy pressure muddies: slow strokes leave less contrast than quick ones', () => {
  const c = pace => { const s = make(2); sweep(s, pace, 60); return contrast(s); };
  assert.ok(c(90) < c(330) - 0.02, `90: ${c(90)}, 330: ${c(330)}`);
});
claim('a print filed on the classic page loads here filed, with the same coverage (plates without grit)', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
    const old = createPlate(level, 19023 + level * 583);
    classicCareful(old);
    assert.ok(old.done);
    const bytes = String.fromCharCode(...Array.from(old.pigment, pigmentByte));
    const s = make(level);
    loadDeep(s, bytes);
    assert.ok(s.done, `plate ${level} not filed after loading`);
    assert.ok(s.coverage >= old.coverage - 1e-9, `plate ${level}: ${s.coverage} < ${old.coverage}`);
  }
});
claim('the same strokes on the same paper give the same sheet', () => {
  const a = careful(make(5), 230), b = careful(make(5), 230);
  assert.deepEqual([a.coverage, a.time, a.tears, a.found], [b.coverage, b.time, b.tears, b.found]);
  assert.deepEqual(Array.from(a.pigment), Array.from(b.pigment));
});
console.table(table);
if (failed) { console.log(failed + ' failed'); process.exit(1); }
