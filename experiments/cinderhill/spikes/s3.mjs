// Spike S3: frame times of the trail painter (/cinderhill/) in emulated phones. Playwright WebKit with the iPhone 13
// profile and Chromium with the Pixel 7 profile, at 2,000 and 5,000 ants. For each: open the page, draw a trail from
// the entrance to the nearest food pile, let the ants take it for a few seconds, then sample every frame for a while.
// Reports frame time (mean, p95), the page's own work per frame, the sim tick, the GPU the browser reports, and the
// time from a finger lift to the order applying in the sim.
// This runs on a Mac. An emulated phone is a desktop browser with a phone-sized window, touch and a user agent: the CPU
// and GPU are the Mac's (or, for headless Chromium, a software renderer). It is not a phone. On a real phone open
// /cinderhill/?fps=1 for the same numbers on screen.
// Usage: PLAYWRIGHT=<dir with playwright> node s3.mjs [--seconds=10] [--warm=4] [--ants=2000,5000] [--only=webkit|chromium|chromium-gpu] [--look=ink|ember|field]
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), opt = (k, d) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const SECONDS = Number(opt('seconds', 10)), WARM = Number(opt('warm', 4));
const COUNTS = opt('ants', '2000,5000').split(',').map(Number), ONLY = opt('only', ''), LOOK = opt('look', 'ink');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // experiments/: the page imports ../kit/
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : import.meta.url);
const { webkit, chromium, devices } = require('playwright');
// chromium-gpu asks headless Chromium for ANGLE on Metal instead of its software renderer; it may fall back.
const RUNS = [
  ['webkit', webkit, devices['iPhone 13'], {}],
  ['chromium', chromium, devices['Pixel 7'], {}],
  ['chromium-gpu', chromium, devices['Pixel 7'], { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }],
].filter(([name]) => !ONLY || ONLY.split(',').includes(name));

const software = gpu => !gpu || /swiftshader|llvmpipe|software|basic render/i.test(gpu);
const results = [];
for (const [name, engine, device, launch] of RUNS) {
  const browser = await engine.launch(launch);
  for (const ants of COUNTS) {
    const context = await browser.newContext({ ...device }), page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${base}/cinderhill/?ants=${ants}&look=${LOOK}&labRunSource=agent`);
    await page.evaluate(() => localStorage.setItem('cinderhill:hint', '1')); // no first-time help over the sample
    await page.reload();
    await page.waitForFunction(() => window.painter);
    await page.click('#play');
    await page.waitForFunction(() => window.painter.state().screen === 'play');
    // A trail from the entrance to the nearest pile, as one finger. The camera is the page's opening view.
    const { from, to } = await page.evaluate(() => {
      const s = window.painter.stats(), ex = 129, ey = 128;
      const pile = s.piles.slice().sort((a, b) => Math.hypot(a.x - ex, a.y - ey) - Math.hypot(b.x - ex, b.y - ey))[0];
      return { from: window.painter.toScreen(ex + 0.5, ey + 0.5), to: window.painter.toScreen(pile.x + 0.5, pile.y + 0.5) };
    });
    // Commit to applied: the lift is stamped in the page, and a frame callback watches for the order's state.
    const latency = await page.evaluate(([from, to]) => new Promise(done => {
      const el = document.querySelector('#c'), ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      ev('pointerdown', from.x, from.y);
      for (let k = 1; k <= 12; k++) ev('pointermove', from.x + (to.x - from.x) * k / 12, from.y + (to.y - from.y) * k / 12);
      const n = window.painter.log().length, t0 = performance.now();
      ev('pointerup', to.x, to.y);
      const look = () => { const log = window.painter.log(); if (log.length > n && log[n].state === 'applied') done({ ms: performance.now() - t0, type: log[n].type }); else requestAnimationFrame(look); };
      look();
    }), [from, to]);
    await page.waitForTimeout(WARM * 1000);
    await page.evaluate(() => window.painter.frames.start());
    await page.waitForTimeout(SECONDS * 1000);
    const f = await page.evaluate(() => window.painter.frames.stop());
    const s = await page.evaluate(() => { const s = window.painter.stats(); return { surface: s.surface, picked: s.picked, crew: s.trails[0]?.crew ?? 0 }; });
    const r = {
      engine: name, version: browser.version(), ants, frames: f.frame.n, frameMean: +f.frame.mean.toFixed(2), frameP95: +f.frame.p95.toFixed(2), frameMax: +f.frame.max.toFixed(1),
      fps: +(1000 / f.frame.mean).toFixed(1), workMean: +f.work.mean.toFixed(2), workP95: +f.work.p95.toFixed(2),
      tickMean: f.tick ? +f.tick.mean.toFixed(2) : null, tickP95: f.tick ? +f.tick.p95.toFixed(2) : null,
      drawn: f.drawn, dpr: f.dpr, view: f.view.join('x'), gpu: f.gpu, softwareGpu: software(f.gpu),
      orderToAppliedMs: Math.round(latency.ms), order: latency.type, trailCrew: s.crew, picked: s.picked, errors: errors.length,
    };
    results.push(r); console.log(JSON.stringify(r));
    await context.close();
  }
  await browser.close();
}
server.close();
console.log('\n| Browser | Ants | Frames | Frame mean ms | Frame p95 ms | fps | Work mean / p95 ms | Sim tick mean / p95 ms | Ants drawn | GPU | Lift to applied ms |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of results) console.log(`| ${r.engine} ${r.version} | ${r.ants.toLocaleString('en')} | ${r.frames} | ${r.frameMean} | ${r.frameP95} | ${r.fps} | ${r.workMean} / ${r.workP95} | ${r.tickMean} / ${r.tickP95} | ${r.drawn} | ${r.softwareGpu ? 'software: ' : ''}${r.gpu} | ${r.orderToAppliedMs} |`);
