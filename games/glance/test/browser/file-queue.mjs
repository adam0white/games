import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer as createPortServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../../..', import.meta.url)),
  hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 32),
  player = 'b'.repeat(32),
  link = { player, session: 'c'.repeat(32), runId: 'd'.repeat(32) },
  at = Date.now(),
  data = { vp: 'desktop', started: at, e: [['start', 0]] };
const browser = await chromium.launch();
let failures = 0;
try {
  for (const [slug, game] of [
    ['smallworks', 'repair'],
    ['glance', 'glance'],
    ['rope', 'rope'],
    ['valley', 'valley'],
    ['stairwell', 'stairwell'],
    ['commonstead', 'commonstead'],
    ['word', 'word'],
    ['goodhands', 'goodhands'],
    ['neighbours', 'neighbours'],
  ]) {
    if (process.env.ONLY && slug !== process.env.ONLY) continue;
    const dir = `${root}/games/${slug}${slug === 'neighbours' ? '/neighbours' : ''}`;
    const socket = createPortServer();
    await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
    const server = spawn(
      process.execPath,
      [
        `${dir}/node_modules/vite/bin/vite.js`,
        '--host',
        '127.0.0.1',
        '--port',
        `${port}`,
        '--strictPort',
        '--force',
      ],
      { cwd: dir, stdio: 'ignore' },
    );
    let context;
    try {
      for (let j = 0; j < 100; j++) {
        try {
          if (server.exitCode !== null) throw Error('server exited before startup');
          await fetch(`http://127.0.0.1:${port}/`);
          if (server.exitCode !== null) throw Error('server exited during startup');
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
          if (j === 99) throw Error('server did not start');
        }
      }
      const rows = [game, 'foreign-game'].map((g) => {
        const upload = hash(JSON.stringify({ ...link, game: g, kind: 'events', text: JSON.stringify(data) })),
          id = hash(JSON.stringify({ upload, piece: data })),
          bytes = gzipSync(
            JSON.stringify({ v: 2, id, ...link, game: g, kind: 'events', at, build: {}, data }),
          );
        return {
          id,
          game: g,
          kind: 'events',
          player,
          at,
          next: 0,
          attempts: 0,
          base64: bytes.toString('base64'),
        };
      });
      context = await browser.newContext();
      const p = await context.newPage();
      let posts = 0,
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.route('**/*', async (r) => {
        const u = new URL(r.request().url());
        if (r.request().method() === 'POST') {
          posts++;
          return r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        }
        if (u.hostname === 'play.adamwhite.work' && u.pathname === '/seed')
          return r.fulfill({ contentType: 'text/html', body: '<html></html>' });
        if (u.hostname === 'play.adamwhite.work') {
          try {
            return r.fulfill({
              response: await r.fetch({ url: `http://127.0.0.1:${port}${u.pathname}${u.search}` }),
            });
          } catch {
            return r.abort();
          }
        }
        return r.abort();
      });
      await p.goto('https://play.adamwhite.work/seed');
      await p.evaluate(
        async ({ rows, player, game, link }) => {
          localStorage.setItem('hf-lab-player', player);
          localStorage.setItem('hf-lab:once:telemetry-notice-v1', 'seeded-notice');
          localStorage.setItem('review-native-sentinel', 'unchanged-native');
          localStorage.setItem('games-rope.save.cast.v1', 'protected-native-value');
          sessionStorage.setItem(`hf-lab-session:${game}`, `${link.session}:${Date.now()}`);
          sessionStorage.setItem(`hf-lab-run:${game}`, link.runId);
          await new Promise((ok, bad) => {
            const o = indexedDB.open('hf-lab-pending', 1);
            o.onupgradeneeded = () => o.result.createObjectStore('pieces', { keyPath: 'id' });
            o.onerror = () => bad(o.error);
            o.onsuccess = () => {
              const db = o.result,
                t = db.transaction('pieces', 'readwrite');
              for (const { base64, ...row } of rows)
                t.objectStore('pieces').put({
                  ...row,
                  body: new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
                    type: 'application/gzip',
                  }),
                });
              t.oncomplete = () => {
                db.close();
                ok();
              };
              t.onerror = () => bad(t.error);
            };
          });
        },
        { rows, player, game, link },
      );
      const snapshot = () =>
        p.evaluate(async () => {
          const rows = await new Promise((ok, bad) => {
            const o = indexedDB.open('hf-lab-pending', 1);
            o.onerror = () => bad(o.error);
            o.onsuccess = () => {
              const db = o.result,
                q = db.transaction('pieces').objectStore('pieces').getAll();
              q.onsuccess = () => {
                ok(q.result);
                db.close();
              };
              q.onerror = () => bad(q.error);
            };
          });
          for (const row of rows) {
            const b = new Uint8Array(await row.body.arrayBuffer());
            row.body = { type: row.body.type, size: row.body.size, base64: btoa(String.fromCharCode(...b)) };
          }
          rows.sort((a, b) => a.id.localeCompare(b.id));
          return {
            rows,
            local: Object.fromEntries(Object.entries(localStorage).sort()),
            session: Object.fromEntries(Object.entries(sessionStorage).sort()),
          };
        });
      const before = await snapshot();
      await p.goto(`https://play.adamwhite.work/${slug}/file/`, { waitUntil: 'domcontentloaded' });
      await (slug === 'goodhands'
        ? p.getByRole('button', { name: 'Choose a run file' })
        : p.locator('input[type=file]').first()
      ).waitFor({ state: 'attached', timeout: 15000 });
      await p.waitForTimeout(3000);
      const after = await snapshot();
      const result = {
        slug,
        rowsEqual: JSON.stringify(before.rows) === JSON.stringify(after.rows),
        localEqual: JSON.stringify(before.local) === JSON.stringify(after.local),
        sessionEqual: JSON.stringify(before.session) === JSON.stringify(after.session),
        posts,
        errors,
        bodyHashes: rows.map((r) =>
          createHash('sha256').update(Buffer.from(r.base64, 'base64')).digest('hex'),
        ),
      };
      if (!result.rowsEqual || !result.localEqual || !result.sessionEqual || posts || errors.length) {
        failures++;
        result.before = before;
        result.after = after;
      }
      console.log(JSON.stringify(result));
    } catch (e) {
      failures++;
      console.log(JSON.stringify({ slug, error: String(e) }));
    } finally {
      await context?.close();
      server.kill('SIGTERM');
    }
  }
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
