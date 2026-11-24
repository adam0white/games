// Phone check for Pour: PLAYWRIGHT=<dir with playwright> node experiments/lab/wild-pour/check.mjs [webkit|chromium]
// Serves experiments/ on a free port, plays level 1 by real touch pointer events on WebKit (iPhone 13) and
// Chromium (Pixel 7), and fails on any page or console error. Screenshots go to $SHOTS (default /private/tmp/night-wild).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-wild';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.pourState());
async function until(page, fn, what, ms = 15000) { try { await page.waitForFunction(fn, null, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }

// One pour by a thumb: press under the jug, slide right until the juice runs, ease off as the glass nears the line, lift.
async function pour(page, shot) {
  return page.evaluate(async shotAt => {
    const el = document.getElementById('c'), st = () => window.pourState();
    const send = (type, x, y) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const s0 = st(), x0 = s0.W * 0.3, y = s0.H * 0.55, span = Math.max(120, Math.min(s0.W, 520) * 0.55);
    send('down', x0, y);
    let dx = 0, shotTaken = false, frames = 0;
    while (frames++ < 60 * 25) {
      const s = st(); if (s.over) break;
      if (s.inGlass + s.flying >= s.target - 3) break;
      const need = 1.28 + (1 - s.inJug / 80) * 0.85 + 0.1; // the tilt where juice runs, as the bots use it
      dx = Math.min(dx + 3, need / 2.4 * span);
      send('move', x0 + dx, y);
      if (!shotTaken && s.inGlass > 2) { shotTaken = true; window.__shot = true; }
      await frame();
    }
    send('up', x0 + dx, y);
  });
}

async function run(name) {
  const [type, device] = PHONES[name];
  const browser = await type.launch();
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`${base}/lab/wild-pour/?seed=3`);
  await until(page, () => window.pourState && window.pourState().screen === 'menu', 'menu');
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, `${name}-1-menu.png`) });
  let st = await state(page);
  assert.ok(st.minTouchPx >= 48, `menu touch targets ${st.minTouchPx.toFixed(0)} px`);

  await page.tap('#play');
  st = await state(page);
  assert.ok(st.playing && st.level === 1, 'Play starts level 1');
  // Doing nothing pours nothing, and after 3 s the kit's finger hint shows how to tip.
  await sleep(3600);
  st = await state(page);
  assert.equal(st.inJug, 80, 'the jug stays full with no touch');
  await page.screenshot({ path: join(SHOTS, `${name}-2-hint.png`) });

  let won = false;
  for (let attempt = 0; attempt < 3 && !won; attempt++) {
    const p = pour(page);
    await until(page, () => window.__shot || window.pourState().over, 'juice in the glass', 20000);
    await page.screenshot({ path: join(SHOTS, `${name}-2-pouring.png`) });
    await p;
    await until(page, () => window.pourState().screen === 'end', 'end card', 20000);
    st = await state(page);
    console.log(`${name}: attempt ${attempt + 1}: ${st.won ? 'won' : 'lost'} (${st.why}), ${st.inGlass} in the glass for ${st.target}, ${st.spilled} spilled, ${st.stars} stars`);
    await sleep(300);
    await page.screenshot({ path: join(SHOTS, `${name}-3-end-${attempt + 1}.png`) });
    won = st.won;
    if (!won) { await page.evaluate(() => { window.__shot = false; }); await page.tap('#retry'); }
  }
  assert.ok(won, 'a thumb wins level 1 within three tries');
  st = await state(page);
  assert.ok(st.saved[0] >= 1, 'stars saved');

  // Next, then pause and go on, then back to the menu where level 2 is open.
  await page.tap('#next');
  st = await state(page);
  assert.ok(st.playing && st.level === 2, 'Next starts level 2');
  await page.tap('#pause');
  st = await state(page); assert.ok(st.paused, 'pause button pauses');
  const t = st.t; await sleep(400); assert.equal((await state(page)).t, t, 'paused: time stands still');
  await page.tap('#resume'); await sleep(300);
  assert.ok((await state(page)).t > t, 'go on: time runs');
  await page.tap('#pause'); await page.tap('#quit');
  st = await state(page); assert.equal(st.screen, 'menu', 'menu after quit');
  assert.equal(await page.locator('#levels button:not([disabled])').count(), 2, 'level 2 is open on the menu');
  await page.reload();
  await until(page, () => window.pourState && window.pourState().screen === 'menu', 'menu after reload');
  st = await state(page); assert.ok(st.saved[0] >= 1, 'stars survive a reload');

  assert.deepEqual(errors, [], 'no page or console errors');
  await browser.close();
  console.log(`${name}: ok`);
}

const which = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
let failed = 0;
for (const name of which) { try { await run(name); } catch (e) { failed++; console.log(`${name}: FAIL ${e.message}`); } }
server.close();
process.exit(failed ? 1 : 0);
