import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('production entries leave analytics injection to the configured zone', () => {
  const registry = JSON.parse(readFileSync('games.json', 'utf8'));
  for (const game of registry.games) {
    for (const entry of ['index.html', 'file/index.html']) {
      const path = `games/${game.slug}/${entry}`;
      if (!existsSync(path)) continue;
      assert.doesNotMatch(readFileSync(path, 'utf8'), /<script\b[^>]*\bsrc\s*=\s*["']?https:\/\/static\.cloudflareinsights\.com\//i, `${path}: a manual beacon duplicates zone injection`);
    }
    const headers = readFileSync(`games/${game.slug}/public/_headers`, 'utf8');
    assert.match(headers, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/);
    assert.match(headers, /connect-src[^;]*'self'/);
    assert.match(headers, /connect-src[^;]*https:\/\/cloudflareinsights\.com/);
  }
});
