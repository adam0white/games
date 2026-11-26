// The page's expected hash (quick.js) must be what Node computes, or the page and the phone check would
// report a false mismatch.
import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED, quick } from '../quick.js';

test('the page expects the hash Node computes for the quick run', () => {
  const h = quick();
  assert.equal(h.tick, EXPECTED.tick);
  assert.equal(h.total, EXPECTED.total, `set EXPECTED.total to ${h.total} in quick.js`);
});
