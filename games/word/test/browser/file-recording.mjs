import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));
execFileSync(process.execPath, ['scripts/build.ts', '--story-only'], { cwd: root });
const v = await createServer({
  root,
  optimizeDeps: { force: true },
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});
await v.listen();
const port = v.httpServer.address().port;
const { createGame, exportRun } = await v.ssrLoadModule('/src/game.ts');
const run = exportRun(createGame(42));
const b = await chromium.launch();
try {
  const c = await b.newContext();
  const p = await c.newPage();
  const posts = [];
  const origin = 'https://play.adamwhite.work';
  await p.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin === origin && u.pathname === '/seed')
      return r.fulfill({ contentType: 'text/html', body: '<html></html>' });
    if (u.origin === origin) {
      const response = await r.fetch({ url: `http://127.0.0.1:${port}${u.pathname}${u.search}` });
      return r.fulfill({ response });
    }
    if (u.pathname.endsWith('/linked')) {
      if (r.request().method() === 'OPTIONS')
        return r.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type',
          },
        });
      const body = r.request().postDataBuffer();
      const item = JSON.parse(gunzipSync(body).toString());
      posts.push(item);
      return r.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': origin },
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: item.id }),
      });
    }
    return r.abort();
  });
  await p.goto(origin + '/seed');
  await p.evaluate(() => {
    localStorage.setItem('hf-lab-player', '1'.repeat(32));
    sessionStorage.setItem('hf-lab-session:word', `${'2'.repeat(32)}:${Date.now()}`);
    sessionStorage.setItem('hf-lab-run:word', '3'.repeat(32));
  });
  await p.goto(origin + '/word/file/?labRunSource=agent');
  await p.getByRole('heading', { name: 'Open a His Word file' }).waitFor();
  const input = p.getByLabel('Choose a playtest file');
  await input.setInputFiles({
    name: 'meeting.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(run)),
  });
  await p.locator('[data-choice]').first().waitFor();
  const before = posts.length;
  await p.getByRole('button', { name: 'Menu', exact: true }).click();
  const toggle = p.getByRole('checkbox', { name: 'Record my play for the lab' });
  await toggle.check();
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await p.waitForTimeout(3000);
  const parts = posts.filter((x) => x.kind === 'run');
  let replay = false;
  for (const upload of new Set(parts.map((x) => x.data.upload))) {
    const a = parts
      .filter((x) => x.data.upload === upload)
      .map((x) => x.data)
      .sort((a, b) => a.index - b.index);
    if (a.length === a[0].total) {
      const saved = JSON.parse(a.map((x) => x.text).join(''));
      if (JSON.stringify(saved) === JSON.stringify(run)) replay = true;
    }
  }
  assert.equal(before, 0);
  assert.equal(await toggle.isChecked(), true);
  assert.equal(replay, true);
  console.log(
    JSON.stringify({
      before,
      checked: true,
      posts: posts.map((x) => ({ id: x.id, kind: x.kind, game: x.game })),
      exactImportedRunRecorded: replay,
    }),
  );
} finally {
  await b.close();
  await v.close();
}
