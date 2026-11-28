import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, normalize } from 'node:path'; import { createRequire } from 'node:module';
const root = process.argv[2], out = process.argv[3], tag = process.argv[4] ?? 'a';
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', glb: 'model/gltf-binary', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', svg: 'image/svg+xml' };
const server = createServer(async (req, res) => { let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (p.endsWith('/')) p += 'index.html'; try { const b = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[p.split('.').pop()] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise(d => server.listen(0, '127.0.0.1', d)); const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(process.env.PLAYWRIGHT + '/x.js'); const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const SAVE = { v: 1, coins: 140, tier: 4, day: 4, served: 9, best: 60, tutorial: true, sound: false, dayAtTier: 1, built: { tray: 5, knife: 1, stove: 1, micro: 1, blender: 1, tables: 2 } };
const res = {}; const errs = [];
const cases = [['none', 0, null], ['one', 6, ['wood']], ['two', 6, ['wood', 'enamel']], ['three', 6, ['wood', 'enamel', 'golden']]];
for (const loc of ['tr-TR', 'en-US']) for (const [name, plays, own] of cases) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, locale: loc });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/lab/**', r => r.fulfill({ status: 204, body: '' }));
  await page.goto(`${base}/kitchen/`);
  await page.evaluate(([SAVE, plays, own]) => { localStorage.setItem('kitchen-save', JSON.stringify(SAVE)); localStorage.setItem('kitchen:hint', '1'); localStorage.setItem('kitchen-story', JSON.stringify({ seen: 99 })); if (plays) localStorage.setItem('kitchen-rush', JSON.stringify({ plays })); if (own) localStorage.setItem('kitchen-tray', JSON.stringify({ own, use: 'wood' })); }, [SAVE, plays, own]);
  await page.reload(); await page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
  await page.tap('#toShop'); await page.waitForTimeout(900);
  const k = `${loc.slice(0, 2)}-${name}`; const n = await page.$$eval('.toolsBox', b => b.length); res[k] = { boxes: n };
  if (n > 1) {
    await page.$$eval('.toolsBox', b => b[1].scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    res[k].cut = await page.$$eval('.toolsBox', b => [...b[1].querySelectorAll('*')].filter(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1).map(e => e.innerText));
    res[k].text = await page.$$eval('button[data-tray]', b => b.map(x => x.innerText.replace(/\n+/g, ' / ') + (x.disabled ? ' [off]' : '')));
    await page.screenshot({ path: `${out}/shop-${k}.png` });
    const sc0 = await page.$eval('#builds', e => e.scrollTop);
    await page.tap('button[data-tray="golden"]', { force: true }).catch(() => {}); await page.waitForTimeout(300); res[k].tapGolden = (await page.evaluate(() => window.kitchenState().trays)).use;
    await page.tap('button[data-tray="enamel"]', { force: true }).catch(() => {}); await page.waitForTimeout(300); res[k].tapEnamel = (await page.evaluate(() => window.kitchenState().trays)).use;
    res[k].scroll = [sc0, await page.$eval('#builds', e => e.scrollTop)];
  }
  await ctx.close();
}
// the slap mission to the end card
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/lab/**', r => r.fulfill({ status: 204, body: '' }));
  await page.goto(`${base}/kitchen/`);
  await page.evaluate(SAVE => { localStorage.setItem('kitchen-save', JSON.stringify(SAVE)); localStorage.setItem('kitchen:hint', '1'); localStorage.setItem('kitchen-story', JSON.stringify({ seen: 99 })); localStorage.setItem('kitchen-rush', JSON.stringify({ plays: 6 })); }, SAVE);
  await page.reload(); await page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
  const st = () => page.evaluate(() => window.kitchenState()); const w = 390, y = 600;
  await page.evaluate(() => window.kitchenRush(21, 'lunch', 'use_slap')); await page.waitForFunction(() => window.kitchenState().rush?.line.length >= 2, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  await page.mouse.move(60, y); await page.waitForTimeout(400); const a = (await st()).tray; await page.mouse.move(w - 60, y); await page.waitForTimeout(400); const b = (await st()).tray; const sx = t => 60 + (t - a) / (b - a) * (w - 120);
  let slapped = false, slapTries = 0; const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    const s = await st(); if (s.screen !== 'play') break;
    if (s.phase === 'sky') {
      if (!slapped) for (const e of s.rush.line) { slapTries++; if (await page.evaluate(n => window.kitchenRushAct(n, 'slap', true), e.n)) { slapped = true; break; } }
      const it = s.rush.items.filter(i => i.owner != null).sort((p, q) => p.y - q.y)[0]; if (it) await page.mouse.move(Math.max(5, Math.min(w - 5, sx(it.x))), y);
    } else if (s.phase === 'fry' && s.cook?.band) { await page.keyboard.down('Space'); const mid = (s.cook.band[0] + s.cook.band[1]) / 2; for (let i = 0; i < 400; i++) { const q = await st(); if (q.phase !== 'fry' || !q.cook || q.cook.d >= mid) break; await page.waitForTimeout(15); } await page.keyboard.up('Space'); await page.waitForTimeout(250); }
    else { if (s.phase === 'chop') await page.evaluate(() => window.kitchenAim?.()); await page.keyboard.press('Space'); }
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1200);
  res.slap = { slapped, slapTries, screen: (await st()).screen, lines: await page.$$eval('#dayMissions li', ls => ls.map(l => l.innerText)) };
  await ctx.close();
}
console.log(JSON.stringify(res)); console.log('errors', errs); await browser.close(); server.close();
