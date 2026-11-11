import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));
execFileSync(process.execPath, ['scripts/build.ts', '--story-only'], { cwd: root });
const server = await createServer({
  root,
  optimizeDeps: { force: true },
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});
await server.listen();
const port = server.httpServer.address().port;
const { createGame, exportRun } = await server.ssrLoadModule('/src/game.ts');
const run = exportRun(createGame(42));
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const player = 'b'.repeat(32),
  link = { player, session: 'c'.repeat(32), runId: 'd'.repeat(32) };
const at = Date.now(),
  data = { vp: 'desktop', started: at, e: [['start', 0]] };
const upload = hash(JSON.stringify({ ...link, game: 'word', kind: 'events', text: JSON.stringify(data) }));
const id = hash(JSON.stringify({ upload, piece: data }));
const bytes = gzipSync(
  JSON.stringify({ v: 2, id, ...link, game: 'word', kind: 'events', at, build: {}, data }),
);
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const posts = [];
  const origin = 'https://play.adamwhite.work';
  await page.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    if (req.method() === 'POST') {
      const payload = JSON.parse(gunzipSync(req.postDataBuffer()).toString());
      posts.push({ path: url.pathname, payload });
      return route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': origin },
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: payload.id ?? 'synthetic-note-receipt' }),
      });
    }
    if (url.origin === origin && url.pathname === '/seed')
      return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    if (url.origin === origin)
      return route.fulfill({
        response: await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` }),
      });
    return route.abort();
  });
  await page.goto(`${origin}/seed`);
  await page.evaluate(
    async ({ player, link, id, at, base64 }) => {
      localStorage.setItem('hf-lab-player', player);
      sessionStorage.setItem('hf-lab-session:word', `${link.session}:${Date.now()}`);
      sessionStorage.setItem('hf-lab-run:word', link.runId);
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('hf-lab-pending', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('pieces', { keyPath: 'id' });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction('pieces', 'readwrite');
          tx.objectStore('pieces').put({
            id,
            game: 'word',
            kind: 'events',
            player,
            at,
            next: 0,
            attempts: 0,
            body: new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
              type: 'application/gzip',
            }),
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { player, link, id, at, base64: bytes.toString('base64') },
  );
  const row = () =>
    page.evaluate(async (id) => {
      const value = await new Promise((resolve, reject) => {
        const request = indexedDB.open('hf-lab-pending', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            q = db.transaction('pieces').objectStore('pieces').get(id);
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
      });
      if (!value) return null;
      return { ...value, body: Array.from(new Uint8Array(await value.body.arrayBuffer())) };
    }, id);
  const before = await row();
  const recordingPrefs = () =>
    page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith('hf-lab-') || key.startsWith('hf-lab:'))
          .sort(),
      ),
    );
  const beforePrefs = await recordingPrefs();
  await page.goto(`${origin}/word/file/`);
  await page.getByLabel('Choose a playtest file').setInputFiles({
    name: 'meeting.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(run)),
  });
  await page.locator('[data-choice]').first().waitFor();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  await page.getByRole('button', { name: "I'm confused", exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(1500);
  assert.equal(posts.length, 0, 'opening a draft must not send or retry');
  assert.deepEqual(await row(), before);
  await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
  await page.waitForTimeout(1500);
  assert.deepEqual(await row(), before, 'unshared feedback must preserve pending recording');
  assert.deepEqual(
    await recordingPrefs(),
    beforePrefs,
    'unshared feedback must preserve recording preferences',
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path.endsWith('/run'), true);
  assert.deepEqual(posts[0].payload.run, { feedbackOnly: true });
  console.log(
    JSON.stringify({ unsharedNoteOnly: true, queuedRowUnchanged: true, posts: posts.map((x) => x.path) }),
  );
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
