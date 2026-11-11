// Compare check-text-state.mjs captures. Its named game-prose allowlist runs first.
// This second allowlist covers only HF narration and explicit edition metadata.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function normalizeHF(value, path = '', missedIds = new Set(
  Object.entries(value?.people ?? {}).flatMap(([id, person]) => person.memory.episodes
    .filter(e => e.kind === 'missed' && e.tags?.includes('missed'))
    .map(e => `${id}:${e.id}`)),
)) {
  if (path === 'provenance.framework' && ['2.18.0', '2.21.0'].includes(value)) return 'HF';
  if (/^people\.[^.]+\.engine$/.test(path) && ['2.17.0', '2.21.0'].includes(value)) return 'HF';
  if (/^people\.[^.]+\.(trace\.\d+\.(narration|intention|suggestion\.says)|conscience\.intentions\.\d+\.intention)$/.test(path)) return '';
  if (Array.isArray(value)) return value.map((v, i) => normalizeHF(v, `${path}.${i}`, missedIds));
  if (value && typeof value === 'object') {
    // HF recordMissed writes this description. Identity, action, tags, valence,
    // salience, ordering and every other memory/history value stay exact.
    const owner = /^people\.([^.]+)\./.exec(path)?.[1];
    const missed = /^people\.[^.]+\.(memory\.episodes\.\d+|chronicle\.\d+\.episodes\.\d+)$/.test(path)
      && missedIds.has(`${owner}:${value.id}`);
    return Object.fromEntries(Object.entries(value)
      .filter(([k, v]) => !(k === 'lexicon' && /^people\.[^.]+$/.test(path)
        && JSON.stringify(v) === '{"plainEnglish":true}'))
      .map(([k, v]) => [k, missed && k === 'summary' ? '' : normalizeHF(v, path ? `${path}.${k}` : k, missedIds)]));
  }
  return value;
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) throw Error('Pass the before and after check-text-state capture directories.');
  for (const seed of [7, 42, 1001]) for (const policy of ['repair', 'explore', 'mentor']) {
    const name = `${seed}-${policy}`;
    const read = dir => JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8'));
    const a = read(before), b = read(after);
    assert.deepEqual(a.steps.map(({command,ok}) => ({command,ok})), b.steps.map(({command,ok}) => ({command,ok})), `${name} inputs/acceptance changed`);
    assert.equal(b.summary.replay, true, `${name} current export replay failed`);
    const left = normalizeHF(a.final), right = normalizeHF(b.final);
    assert.deepEqual(right, left, `${name} substantive state changed`);
    console.log(JSON.stringify({seed, policy, steps:b.steps.length, before:hash(left), after:hash(right), replay:b.summary.replay}));
  }
}
