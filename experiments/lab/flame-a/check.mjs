import assert from 'node:assert/strict';
import { addCarrier, createRun, decodeLink, encodeLink, newChain, step, validName } from './sim.js';

const first = addCarrier(newChain(17), 'Sam', 1840, 47, 23);
const link = encodeLink(first);
const legacy = '#f=1~1~47~1840~23~1840:Sam';
assert.equal(link, '#f=2~d66770cc~1~47~1840~23~1840:Sam');
assert.deepEqual(decodeLink(legacy), first);
const anonymous = addCarrier(first, '', 2011, 18, 131);
for (const receipt of [encodeLink(anonymous), '#f=1~2~18~3851~131~1840:Sam~2011:']) {
  assert.deepEqual(decodeLink(receipt.slice(0, -1)), anonymous);
}
assert.deepEqual(decodeLink(legacy.replace('~1~47', '~999999~47')), first);
assert.equal(decodeLink(legacy.replace('~1~47', '~4294967296~47')), null);
assert.equal(decodeLink(legacy.replace('~1~47~1840', '~999999~47~1841')), null);
for (const changed of [
  link.replace('~1~47', '~8~47'), link.replace('~47~', '~100~'), link.replace('1840', '1841'),
  link.replace('~23~', '~24~'), link.replace('Sam', 'Pam'), link.replace('1840:', '1839:'),
  link.replace('d66770cc', 'd66770cd'), link.replace('d66770cc~', '')
]) assert.equal(decodeLink(changed), null, changed);

assert.deepEqual(decodeLink(link), first);
let chain = first;
for (let i = 0; i < 10; i++) chain = addCarrier(chain, i === 9 ? 'Çığ Şule.2' : '', 100, 13, i);
assert.deepEqual(decodeLink(encodeLink(chain)), chain);
assert.equal(chain.carriers.length, 8);
assert.equal(chain.count, 11);
assert.equal(chain.total, 2840);
assert.equal(chain.carriers.at(-1).name, 'Çığ Şule.2');
const eightRows = Array(8).fill('100:A').join('~');
const padded = decodeLink('#f=1~4294967295~18~832~1~' + eightRows);
assert.equal(padded.count, 10); // Only 32 m remain for the omitted carriers.
assert.equal(padded.total, 832);
assert.equal(decodeLink('#f=1~9~18~2841~1~' + eightRows), null); // One omitted leg cannot exceed 2,040 m.
assert.equal(decodeLink('#f=1~9~18~801~1~' + eightRows), null); // One extra metre cannot be a leg.
const cap = { count: 0xffffffff, total: 0xffffffff * 2040, seed: 0, flame: 1,
  carriers: Array.from({ length: 8 }, () => ({ name: '', distance: 2040 })) };
const continued = addCarrier(decodeLink(encodeLink(cap)), 'Sam', 1234, 5, 1);
assert.deepEqual(decodeLink(encodeLink(continued)), continued);
for (const name of ['A_B-C.9', '', 'Ömer', 'a'.repeat(16)]) assert.ok(validName(name));
for (const name of ['x '.repeat(9), 'a/b', 'A\n', 'x<script>', 'x​y']) assert.ok(!validName(name));

for (const source of [legacy, link]) {
  for (const bad of [
    null, '', 'https://site/#f=1', '#f=3~1~47~1840~23~1840:Sam', source + ':tail',
    source + '~0:extra', source + '\n', source + '%', source + 'a'.repeat(2049),
    source.replace('Sam', '%3Csvg%3E'), source.replace('Sam', 'A%00B'), source.replace('Sam', '%E0%A4'),
    source.replace('Sam', 'ABCDEFGHIJKLMNOPQ'), source.replace('Sam', '%53am'),
    source.replace('~1~47', '~0~47'), source.replace('~47~', '~101~'), source.replace('~47~', '~0~'),
    source.replace('~47~', '~4.7~'), source.replace('~23~', '~4294967296~'), source.replace('~23~', '~NaN~'),
    source.replace('~1840~', '~1839~'), source.replace('~1840~', '~1841~'), source.replace('~23~', '~023~'),
    source.replace('1840:', '-1:'), source.replaceAll('1840', '2041'), source.replaceAll('1840', '15')
  ]) assert.equal(decodeLink(bad), null, String(bad));
}

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

const trials = 200;
let finished = 0;
let weakFinished = 0;
let idleMin = Infinity;
let idleMax = 0;
for (let seed = 0; seed < trials; seed++) {
  const chain = newChain(seed);
  const played = play(chain, followEmbers);
  if (played.outcome === 'handoff') finished++;
  if (play({ ...chain, flame: 18 }, followEmbers).outcome === 'handoff') weakFinished++;
  for (const flame of [1, 18, chain.flame, 100]) {
    const idle = play({ ...chain, flame }, () => 0);
    assert.equal(idle.outcome, 'drop', `idle seed ${seed}, light ${flame}`);
    assert.ok(idle.elapsed >= 20 && idle.elapsed <= 40, `idle seed ${seed}, light ${flame}: ${idle.elapsed}s`);
    idleMin = Math.min(idleMin, idle.elapsed);
    idleMax = Math.max(idleMax, idle.elapsed);
  }
  const [firstEmber, ...later] = played.items;
  assert.equal(firstEmber.kind, 'ember');
  assert.ok(firstEmber.at < 3 && firstEmber.x === 0);
  assert.ok(later.filter(i => i.kind === 'ember').every(i => Math.abs(i.x) > 0.17));
  assert.ok(later.filter(i => i.kind === 'rock').every(i => i.at >= 8 && (i.at >= 21 || Math.abs(i.x) > 0.125)));
}
assert.ok(finished >= 0.8 * trials, `${finished}/${trials} fresh flames finished`);
assert.ok(weakFinished >= 0.5 * trials, `${weakFinished}/${trials} 18% flames finished`);
const stranded = play(newChain(45), () => 1);
assert.equal(stranded.outcome, 'drop');
assert.equal(stranded.flame, 0);
assert.ok(stranded.progress < 1);
const finish = play(newChain(4), followEmbers, 1 / 30);
assert.equal(finish.progress, 1);
const next = addCarrier(first, 'Ali', finish.distance, finish.flame, 22);
assert.equal(createRun(decodeLink(encodeLink(next))).flame, Math.round(finish.flame));
console.log(`Link validation and legacy compatibility passed. Ember steering finished ${finished}/${trials} fresh and ${weakFinished}/${trials} at 18%. All 800 idle legs dropped in ${idleMin.toFixed(1)}–${idleMax.toFixed(1)}s. Bank steering dropped the flame.`);
