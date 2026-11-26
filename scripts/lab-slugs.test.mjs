// Every page that records through kit/lab.js sends under a slug the lab accepts. The lab (human-framework
// apps/site/src/lab/games.ts, LAB_PROTOTYPES) answers 400 "bad game" for any other slug, and that play is lost.
// Order: register the slug in human-framework, merge and deploy it, then merge the page here.
// The list is read from human-framework main on GitHub. Offline outside CI the test is skipped; in CI it must load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = 'https://raw.githubusercontent.com/adam0white/human-framework/main/apps/site/src/lab/games.ts';

export function acceptedSlugs(source) {
  const list = source.match(/LAB_PROTOTYPES[^=]*=\s*\[([\s\S]*?)\];/);
  if (!list) throw new Error('LAB_PROTOTYPES not found in games.ts');
  return new Set([...list[1].replace(/\/\/.*$/gm, '').matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]));
}

export function senders(dir) {
  const out = [];
  const walk = d => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) { if (name !== 'node_modules' && name !== 'kit') walk(path); continue; }
      if (!/\.(m?js|html)$/.test(name)) continue;
      for (const m of readFileSync(path, 'utf8').matchAll(/(?<![\w.$])lab\(\s*['"]([a-z0-9-]+)['"]/g))
        out.push({ slug: m[1], file: relative(ROOT, path) });
    }
  };
  walk(dir);
  return out;
}

test('the slug finder reads the list and the pages', () => {
  const accepted = acceptedSlugs("export const LAB_PROTOTYPES: readonly string[] = [\n  'lantern',\n  // 'old' comment\n  'cinderhill-battle',\n];");
  assert.deepEqual([...accepted], ['lantern', 'cinderhill-battle']);
  const found = senders(join(ROOT, 'experiments'));
  assert.ok(found.some(s => s.slug === 'lantern'), 'finds lantern');
  assert.ok(found.length >= 20, `finds the recording pages (${found.length})`);
});

test('every slug a page sends under is accepted by the lab', async t => {
  let source;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    source = await res.text();
  } catch (error) {
    if (process.env.CI) throw new Error(`could not read the lab's slug list: ${error.message}`);
    t.skip(`offline: ${error.message}`);
    return;
  }
  const accepted = acceptedSlugs(source);
  const missing = senders(join(ROOT, 'experiments')).filter(s => !accepted.has(s.slug));
  assert.deepEqual(missing, [], 'add these slugs to LAB_PROTOTYPES in human-framework apps/site/src/lab/games.ts and deploy it first');
});
