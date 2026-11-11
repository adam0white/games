// Compare RAW saved captures from check-text-state.mjs. No prose/history normalization.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [before, after] = process.argv.slice(2);
if (!before || !after) throw Error('Pass baseline and current capture directories.');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
for (const seed of [7, 42, 1001]) for (const policy of ['repair', 'explore', 'mentor']) {
  const name = `${seed}-${policy}`;
  const read = dir => JSON.parse(readFileSync(`${dir}/${name}.save.json`, 'utf8'));
  const a = read(before), b = read(after);
  assert.equal(a.provenance.framework, '2.21.0');
  assert.equal(a.provenance.game, '4.0.0+plain-english-2');
  assert.equal(b.provenance.framework, '3.0.0');
  assert.equal(b.provenance.game, '4.1.0+hf3');
  a.provenance.framework = b.provenance.framework;
  a.provenance.game = b.provenance.game;
  for (const id of ['sam', 'mum', 'nora', 'rafi', 'halil']) {
    assert.equal(a.people[id].engine, '2.21.0');
    assert.equal(b.people[id].engine, '2.23.0');
    a.people[id].engine = b.people[id].engine;
  }
  assert.deepEqual(b, a, `${name}: raw state changed beyond the seven named metadata paths`);
  console.log(JSON.stringify({name, rawEqualExceptMetadata: true, hash: hash(b), workshopRng: b.rng, personRng: Object.fromEntries(Object.entries(b.people).map(([id,p])=>[id,p.rng])), inputs: b.inputs.length}));
}
