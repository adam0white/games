// The page's words (public/crumbwar/words.js): every language has the same keys, nothing is left empty, and every key
// the page asks for exists. A missing key would show on screen as its raw name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tables } from '../public/crumbwar/words.js';
import * as C from '../public/crumbwar/shared/config.js';
import { RANKS } from '../public/crumbwar/shared/modes.js';

const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

test('the English and Turkish tables have the same keys, the same blanks, and no empty Turkish words', () => {
  const { en, tr } = tables;
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(tr)) {
    if (Array.isArray(en[key])) {
      assert.ok(Array.isArray(value) && value.length === en[key].length, `${key}: a list of ${en[key].length}`);
      for (const [i, w] of value.entries()) assert.ok(typeof w === 'string' && w.trim(), `${key}[${i}] is empty`);
    } else {
      assert.ok(typeof value === 'string' && value.trim(), `${key} is empty`);
      assert.equal(holes(value), holes(en[key]), `${key} fills the same {blanks}`);
      assert.equal(value.split('*').length % 2, 1, `${key}: every *bold* is closed`);
    }
  }
});

test('the translated lists match the shared lists they stand for', () => {
  for (const l of ['en', 'tr']) {
    assert.equal(tables[l].namesA.length, C.NAMES_A.length);
    assert.equal(tables[l].namesB.length, C.NAMES_B.length);
    assert.equal(tables[l].colonies.length, C.COLONY_NAMES.length);
    assert.equal(tables[l].ranks.length, RANKS.length);
  }
  assert.deepEqual(tables.en.namesA, C.NAMES_A);
  assert.deepEqual(tables.en.namesB, C.NAMES_B);
  assert.deepEqual(tables.en.colonies, C.COLONY_NAMES);
  assert.deepEqual(tables.en.ranks, RANKS);
});

test('every key the page and its three cards ask for is in the English table, and every key is used', () => {
  const page = (f) => readFileSync(new URL('../public/crumbwar/' + f, import.meta.url), 'utf8');
  const client = page('client.js'), html = ['index.html', 'feast/index.html', 'rush/index.html'].map(page).join('\n');
  const used = new Set();
  const add = (re, src) => { for (const m of src.matchAll(re)) for (const k of m.slice(1)) if (k) used.add(k); };
  add(/\b(?:t|setStatus)\('(\w+)'[,)]/g, client);                       // t('key') and setStatus('key')
  add(/\bplural\([^,]+, '(\w+)', '(\w+)'\)/g, client);                    // plural(n, 'one', 'other')
  add(/\?\s*'(\w+)'\s*:\s*'(\w+)'/g, client);                             // t(cond ? 'a' : 'b'), nested too
  add(/: '(\w+)'(?=\)|, \{)/g, client);                                         // the last branch of a nested ternary
  add(/award\('(\w+)'/g, client);
  add(/dataset\.i18n = '(\w+)'|'data-i18n', '(\w+)'/g, client);          // the lab notice, switch and hint label
  add(/data-i18n(?:-aria|-rich)?="(\w+)"/g, html);
  for (const m of ['Classic', 'Feast', 'Rush']) used.add('mode' + m).add('clock' + m); // t('mode' + MODE_KEY)
  for (const k of used) if (/^[a-z]+[A-Z]?\w*$/.test(k) && !['classic', 'feast', 'rush', 'good', 'event', 'round', 'idle', 'left', 'points', 'ring', 'burst', 'mouse', 'tier', 'death', 'stick'].includes(k)) assert.ok(Object.hasOwn(tables.en, k), `the page asks for "${k}"`);
  for (const k of ['youAte', 'eatenBy', 'promotedQueen', 'nextRound', 'netOne', 'crowdSomeOther', 'arrowFood', 'away', 'disconnected']) assert.ok(used.has(k), `the scan finds ${k}`);
  // The other way: a key nothing asks for is dead, or a typo on one side.
  for (const k of Object.keys(tables.en)) assert.ok(used.has(k), `"${k}" is in the table but the page never asks for it`);
});
