// Screenshot-guided review. Commands come from stdin; no simulation state is read or changed.
// PLAYWRIGHT=... node review-play.mjs [webkit|chromium]
// {"click":"#play","shot":"start"}, {"move":[40,-20],"ms":1500,"shot":"move"}, {"close":true}
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..'), shots = join(here, 'review-shots');
await mkdir(shots, { recursive: true });
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/notes/button.js' || path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  let file = resolve(root, '.' + decodeURIComponent(path)); if (path.endsWith('/')) file = join(file, 'index.html');
  try {
    if (!file.startsWith(root + sep)) throw Error('outside experiments');
    res.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
if (!process.env.PLAYWRIGHT) throw Error('Set PLAYWRIGHT to the installed module directory');
const require = createRequire(join(process.env.PLAYWRIGHT, 'x.js'));
const { webkit, chromium, devices } = require('playwright'), name = process.argv[2] || 'chromium';
const browser = await ({ webkit, chromium }[name]).launch(), context = await browser.newContext(devices[name === 'webkit' ? 'iPhone 13' : 'Pixel 7']);
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/lab/ant-creatures/?seed=11`);
await page.bringToFront();
const shot = async label => { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: join(shots, `${name}-independent-${label}.png`) }); };
await shot('menu'); console.log('Ready');
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const cmd = JSON.parse(line);
    if (cmd.close) break;
    if (cmd.reload) await page.reload();
    if (cmd.click) await page.click(cmd.click);
    if (cmd.move) {
      if (await page.locator('#paused.on').count()) await page.click('#resume');
      const { width, height } = page.viewportSize(), x = width / 2, y = height * 0.72;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + cmd.move[0], y + cmd.move[1]);
      await page.waitForTimeout(cmd.ms || 1500); await page.mouse.up();
    }
    if (cmd.wait) await page.waitForTimeout(cmd.wait);
    await shot(cmd.shot || 'latest');
    if ((cmd.move || cmd.pause) && await page.locator('#pause').isVisible()) await page.click('#pause');
    console.log(JSON.stringify({ buttons: await page.locator('button:visible').allTextContents(), errors }));
  }
} finally { await browser.close(); server.closeAllConnections(); server.close(); process.stdin.pause(); }
