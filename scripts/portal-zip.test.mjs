import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build, imports } from './portal-zip.mjs';

test('imports: static, dynamic and script src', () => {
  assert.deepEqual(imports(`import { a } from './a.js?v=2'; const b = () => import("../kit/b.js"); import './c.js';\n<script src="/notes/button.js" defer></script>`),
    ['./a.js?v=2', '../kit/b.js', './c.js', '/notes/button.js']);
});

test('a portal copy of lantern loads from its own folder and asks this site for nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'portal-'));
  try {
    const made = build({ slug: 'lantern', portal: 'itch', out: join(dir, 'lantern') });
    assert.ok(made.files > 20); assert.ok(made.size < 5 * 1024 * 1024, 'small enough for any portal');
    const page = readFileSync(join(made.out, 'index.html'), 'utf8');
    assert.match(page, /<script>window\.PORTAL = "itch";<\/script>\n<script type="module">/, 'PORTAL is set before the page script');
    assert.doesNotMatch(page, /\/notes\/button\.js/, 'no tester notes script');
    assert.doesNotMatch(page, /from '\.\.\/kit\//, 'kit imports point inside the copy');
    assert.match(page, /from '\.\/kit\/save\.js'/);
    assert.match(readFileSync(join(made.out, 'modes', 'race.js'), 'utf8'), /from '\.\.\/kit\//);
    assert.ok(existsSync(join(made.out, 'kit', 'settings.js')) && existsSync(join(made.out, 'kit', 'dare.js')));
    assert.ok(!existsSync(join(made.out, 'NOTES.md')) && !existsSync(join(made.out, 'bots.mjs')), 'notes and bots stay home');
    assert.ok(!readdirSync(join(made.out, 'kit')).some(f => !f.endsWith('.js')), 'only kit modules');
    // The two places the page talks to this site are both behind PORTAL.
    assert.match(page, /async function boardCall\(body, url = BOARD_URL\) \{\n  if \(PORTAL\) return null;/);
    assert.match(readFileSync(join(made.out, 'kit', 'lab.js'), 'utf8'), /globalThis\.PORTAL\) return none;/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a bad name or portal is refused', () => {
  assert.throws(() => build({ slug: '../x' }), /not an experiment name/);
  assert.throws(() => build({ slug: 'lantern', portal: 'poki' }), /portal must be/);
});
