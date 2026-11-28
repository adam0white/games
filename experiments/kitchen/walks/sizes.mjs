import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, normalize } from 'node:path'; import { createRequire } from 'node:module';
const root = process.argv[2], out = process.argv[3], tag = process.argv[4] ?? 'a';
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', glb: 'model/gltf-binary', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', svg: 'image/svg+xml' };
const server = createServer(async (req, res) => { let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (p.endsWith('/')) p += 'index.html'; try { const b = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[p.split('.').pop()] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise(d => server.listen(0, '127.0.0.1', d)); const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(process.env.PLAYWRIGHT + '/x.js'); const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const VW = +(process.env.VW || 390), VH = +(process.env.VH || 844);
const SAVE = { v: 1, coins: 140, tier: 4, day: 4, served: 9, best: 60, tutorial: true, sound: false, dayAtTier: 1, built: { tray: 5, knife: 1, stove: 1, micro: 1, blender: 1, tables: 2 } };
const out7 = {}; const allErrs = [];
const open = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage(); page.on('pageerror', e => allErrs.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) allErrs.push(m.text()); });
  await page.route('**/lab/**', r => r.fulfill({ status: 204, body: '' }));
  await page.goto(`${base}/kitchen/`);
  await page.evaluate(SAVE => { localStorage.setItem('kitchen-save', JSON.stringify(SAVE)); localStorage.setItem('kitchen:hint', '1'); localStorage.setItem('kitchen-story', JSON.stringify({ seen: 99 })); localStorage.setItem('kitchen-rush', JSON.stringify({ plays: 6 })); }, SAVE);
  await page.reload(); await page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
  return { ctx, page };
};
const st = page => page.evaluate(() => window.kitchenState());
const begin = async (page, mission = null, night = 'rush') => { await page.evaluate(([n, m]) => window.kitchenRush(7, n, m), [night, mission]); await page.waitForFunction(() => window.kitchenState().rush?.people >= 3, null, { timeout: 30000 }).catch(() => console.log('never three people')); await page.waitForTimeout(3000); };
const geom = async (page, w, h) => { const s = await st(page); return { people: s.rush.people, all: s.rush.peopleAll, line: s.rush.line.length, lift: s.rush.lift, tray: s.rush.trayPx, halos: s.rush.halos.map(q => [Math.round(q.x), Math.round(q.y)]), inside: s.rush.halos.every(q => q.x > 0 && q.x < w && q.y < h) }; };
for (const spec of (process.env.SIZES || '').split(',').filter(Boolean)) {
  const [wh, via] = spec.split(':'); const [w, h] = wh.split('x').map(Number);
  const { ctx, page } = await open(via ? h : w, via ? w : h);
  if (via) { await page.waitForTimeout(400); await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(600); }
  await begin(page); await page.screenshot({ path: `${out}/${tag}-${wh}${via ? '-via' : ''}.png` }); out7[spec] = await geom(page, w, h); await ctx.close();
}
if (process.env.PART === 'turn') {
  const w = 390, h = 844; const { ctx, page } = await open(w, h); await begin(page);
  const y = Math.round(h * 0.71); await page.mouse.move(60, y); await page.waitForTimeout(400); const a = (await st(page)).tray; await page.mouse.move(w - 60, y); await page.waitForTimeout(400); const b = (await st(page)).tray; const sx = t => 60 + (t - a) / (b - a) * (w - 120);
  for (let i = 0; i < 1500; i++) { const s = await st(page); if (s.phase !== 'sky') break; const it = s.rush.items.filter(i => i.owner != null).sort((p, q) => p.y - q.y)[0]; if (it) await page.mouse.move(Math.max(5, Math.min(w - 5, sx(it.x))), y); await page.waitForTimeout(45); }
  const before = await st(page); out7.turn = { phase: before.phase, before: { all: before.rush.peopleAll, line: before.rush.line.length } };
  await page.setViewportSize({ width: h, height: w }); await page.waitForTimeout(3500); let s = await st(page); out7.turn.turned = { all: s.rush.peopleAll, people: s.rush.people, line: s.rush.line.length, models: s.models, phase: s.phase }; await page.screenshot({ path: `${out}/${tag}-turn-mid.png` });
  await page.evaluate(() => { localStorage.setItem('kitchen-people', 'off'); dispatchEvent(new StorageEvent('storage', { key: 'kitchen-people' })); }); await page.waitForTimeout(500);
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(3500); s = await st(page); out7.turn.back = { all: s.rush.peopleAll, people: s.rush.people, line: s.rush.line.length, models: s.models, phase: s.phase };
  await ctx.close();
}
if (process.env.PART === 'slap') {
  const w = 390, h = 844; const { ctx, page } = await open(w, h); await begin(page, 'use_slap', 'lunch');
  let ok = false, tries = 0; for (; tries < 400 && !ok; tries++) { const s = await st(page); if (s.phase === 'sky' && s.rush.line.length) for (const e of s.rush.line) { ok = await page.evaluate(([n]) => window.kitchenRushAct(n, 'slap', true), [e.n]); if (ok) break; } await page.waitForTimeout(100); }
  out7.slap = { ok, tries }; await ctx.close();
}
console.log(JSON.stringify(out7)); console.log('errors', allErrs); await browser.close(); server.close();
