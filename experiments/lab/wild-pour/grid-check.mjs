// Independent exact-state comparison against the original simulation's immutable Git blob.
// Run: fnm exec --using=26.12.0 node experiments/lab/wild-pour/grid-check.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as current from './sim.js';
const REFERENCE_BLOB = '5d5ab9cf68b7d4e0bf2364bf59a940c01a7944a8';
const original = execFileSync('git', ['show', REFERENCE_BLOB], {
  cwd: fileURLToPath(new URL('./', import.meta.url)), encoding: 'utf8',
});
const oldLevel6 = '[76, 10, 42, 4, 8, 0.9, 17, 11]';
const frozenLevel6 = '[76, 10, 42, 6, 8, 0.9, 18, 11]';
if (original.split(oldLevel6).length !== 2) throw Error('original level 6 row was not found exactly once');
// The only reference-code delta is the frozen difficulty adjustment; the original grid stays untouched.
const source = original.replace(oldLevel6, frozenLevel6);
const reference = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
console.log(`Reference simulation blob: ${REFERENCE_BLOB}; level 6 band 4->6, spill 17->18 only.`);
let steps = 0, episodes = 0;
const eq = (a, b, path = '') => {
  if (a === null || typeof a !== 'object') { if (!Object.is(a, b)) throw Error(`state mismatch ${path}: ${a} !== ${b}`); return; }
  if (Object.keys(a).length !== Object.keys(b).length) throw Error(`key mismatch ${path}`);
  for (const k of Object.keys(a)) eq(a[k], b[k], path ? `${path}.${k}` : k);
};
const policies = [() => 0, () => 2.4, (s, i) => i % 180 < 90 ? 1.8 : 0, (s, i) => Math.max(0, Math.sin(i / 47) * 2.4)];
for (let n = 1; n <= 8; n++) for (const seed of [7, 113]) for (const mutate of [false, true]) for (let policy = 0; policy < policies.length; policy++) {
  const a = current.create(n, seed, { mutate }), b = reference.create(n, seed, { mutate });
  for (let i = 0; i < 650 && !a.over; i++) {
    const tilt = policies[policy](a, i); current.step(a, tilt); reference.step(b, tilt);
    eq(a, b); steps++;
  }
  episodes++;
}
// Force the fallback and oversized-state path; these must preserve even unusual states.
for (const oversized of [false, true]) {
  const a = current.create(1, 3), b = reference.create(1, 3);
  if (oversized) { for (let i = 0; i < 60; i++) { a.p.push({ ...a.p[i] }); b.p.push({ ...b.p[i] }); } }
  else { a.p[0].x = b.p[0].x = -100; a.p[0].px = b.p[0].px = -100; }
  for (let i = 0; i < 120; i++) { current.step(a, 1.9); reference.step(b, 1.9); eq(a, b); steps++; }
  episodes++;
}
// Nonfinite external state must use the same unbounded fallback, including NaN behavior.
{
  const a = current.create(1, 7), b = reference.create(1, 7);
  a.p[0].x = b.p[0].x = NaN;
  for (let i = 0; i < 10; i++) { current.step(a, 1.9); reference.step(b, 1.9); eq(a, b); steps++; }
  episodes++;
}
console.log(`Exact reference comparison passed: ${episodes} episodes, ${steps} steps; every state field, particle coordinate, previous coordinate, count, RNG and event.`);
const bench = engine => {
  const start = performance.now(), cpu = process.cpuUsage();
  for (let run = 0; run < 12; run++) {
    const s = engine.create(4, run + 1);
    for (let i = 0; i < 900; i++) engine.step(s, i % 180 < 90 ? 1.8 : 0);
  }
  const used = process.cpuUsage(cpu);
  return { wallMs: +(performance.now() - start).toFixed(3), cpuMs: +((used.user + used.system) / 1000).toFixed(3) };
};
const first = bench(reference), second = bench(current), third = bench(reference), fourth = bench(current);
console.log(JSON.stringify({ reference: [first, third], dense: [second, fourth], cpuSpeedup: ((first.cpuMs + third.cpuMs) / (second.cpuMs + fourth.cpuMs)).toFixed(3) }));
