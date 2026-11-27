import assert from 'node:assert/strict';
import { addCarrier, createRun, decodeLink, encodeLink, newChain, step, validName } from './sim.js';

const first = addCarrier(newChain(17), 'Sam', 1840, 47, 23);
const link = encodeLink(first);
assert.equal(link, '#f=1~1~47~1840~23~1840:Sam');
assert.deepEqual(decodeLink(link), first);
let chain = first;
for (let i = 0; i < 10; i++) chain = addCarrier(chain, i === 9 ? 'Çığ Şule.2' : '', 100, 13, i);
assert.deepEqual(decodeLink(encodeLink(chain)), chain);
assert.equal(chain.carriers.length, 8);
assert.equal(chain.count, 11);
assert.equal(chain.total, 2840);
assert.equal(chain.carriers.at(-1).name, 'Çığ Şule.2');
const cap = { count: 0xffffffff, total: 0xffffffff * 100000, seed: 0, flame: 1,
  carriers: Array.from({ length: 8 }, () => ({ name: '', distance: 100000 })) };
const continued = addCarrier(decodeLink(encodeLink(cap)), 'Sam', 1234, 5, 1);
assert.deepEqual(decodeLink(encodeLink(continued)), continued);
for (const name of ['A_B-C.9', '', 'Ömer', 'a'.repeat(16)]) assert.ok(validName(name));
for (const name of ['x '.repeat(9), 'a/b', 'A\n', 'x<script>', 'x​y']) assert.ok(!validName(name));

for (const bad of [
  null, '', 'https://site/#f=1', '#f=2~1~47~1840~23~1840:Sam', link + ':tail',
  link + '~0:extra', link + '\n', link + '%', link + 'a'.repeat(2049),
  link.replace('Sam', '%3Csvg%3E'), link.replace('Sam', 'A%00B'), link.replace('Sam', '%E0%A4'),
  link.replace('Sam', 'ABCDEFGHIJKLMNOPQ'), link.replace('Sam', '%53am'),
  link.replace('~1~47', '~0~47'), link.replace('~47~', '~101~'), link.replace('~47~', '~0~'),
  link.replace('~47~', '~4.7~'), link.replace('~23~', '~4294967296~'), link.replace('~23~', '~NaN~'),
  link.replace('~1840~', '~1839~'), link.replace('~1840~', '~1841~'), link.replace('~23~', '~023~'),
  link.replace('1840:', '-1:'), link.replace('1840:', '100001:'), link.replace('~1~47', '~9~47')
]) assert.equal(decodeLink(bad), null, String(bad));

function play(chain, steer, dt = 1 / 60) {
  const run = createRun(chain);
  while (!run.outcome && run.elapsed < 61) step(run, dt, steer(run));
  assert.ok(run.outcome);
  return run;
}

function followEmbers(run) {
  const ahead = run.items.slice(run.nextItem).filter(item => item.at - run.elapsed <= 3.5);
  return ahead.find(item => item.kind === 'ember')?.x ?? run.x;
}

let finished = 0;
let idleMin = Infinity;
let weakIdleMin = Infinity;
for (let seed = 0; seed < 200; seed++) {
  const chain = newChain(seed);
  const played = play(chain, followEmbers);
  if (played.outcome === 'handoff') finished++;
  idleMin = Math.min(idleMin, play(chain, () => 0).elapsed);
  weakIdleMin = Math.min(weakIdleMin, play({ ...chain, flame: 1 }, () => 0).elapsed);
  assert.equal(played.items[0].kind, 'ember');
  assert.ok(played.items.filter(item => item.kind === 'rock').every(item => item.at >= 8));
}
assert.ok(finished >= 160, `${finished}/200 finished`);
assert.ok(idleMin >= 20 && weakIdleMin >= 20);
const stranded = play(newChain(45), () => 1);
assert.equal(stranded.outcome, 'drop');
assert.equal(stranded.flame, 0);
assert.ok(stranded.progress < 1);
const finish = play(newChain(4), followEmbers, 1 / 30);
assert.equal(finish.progress, 1);
const next = addCarrier(first, 'Ali', finish.distance, finish.flame, 22);
assert.equal(createRun(decodeLink(encodeLink(next))).flame, Math.round(finish.flame));
console.log(`Link round trip and hostile inputs passed. Ember steering finished ${finished}/200. Shortest idle leg: ${idleMin.toFixed(1)}s (weakest linked flame: ${weakIdleMin.toFixed(1)}s). Bank steering dropped the flame.`);
