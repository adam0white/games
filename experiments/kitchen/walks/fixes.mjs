import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, normalize } from 'node:path'; import { createRequire } from 'node:module';
const root = process.argv[2], out = process.argv[3], tag = process.argv[4] ?? 'a';
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', glb: 'model/gltf-binary', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', svg: 'image/svg+xml' };
const server = createServer(async (req, res) => { let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (p.endsWith('/')) p += 'index.html'; try { const b = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[p.split('.').pop()] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise(d => server.listen(0, '127.0.0.1', d)); const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(process.env.PLAYWRIGHT + '/x.js'); const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const VW = +(process.env.VW || 390), VH = +(process.env.VH || 844);
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, locale: process.env.LOC ?? 'en-US' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
await page.route('**/lab/**', r => r.fulfill({ status: 204, body: '' }));
await page.goto(`${base}/kitchen/`);
const TIER = 4, SAVE = { v: 1, coins: 140, tier: TIER, day: 4, served: 9, best: 60, tutorial: true, sound: false, dayAtTier: 1, built: { tray: TIER + 1, knife: 1, stove: 1, micro: 1, blender: 1, tables: 2 } };
await page.evaluate(SAVE => { localStorage.setItem('kitchen-save', JSON.stringify(SAVE)); localStorage.setItem('kitchen:hint', '1'); localStorage.setItem('kitchen-story', JSON.stringify({ seen: 99 })); localStorage.setItem('kitchen-rush', JSON.stringify({ plays: 2 })); }, SAVE);
if (process.env.PEOPLE) await page.evaluate(v => localStorage.setItem('kitchen-people', v), process.env.PEOPLE);
await page.addInitScript(() => { window.__ft = []; let l = 0; const f = t => { if (l) window.__ft.push(t - l); l = t; if (window.__ft.length > 20000) window.__ft.shift(); requestAnimationFrame(f); }; requestAnimationFrame(f); });
await page.reload(); await page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
const st = () => page.evaluate(() => window.kitchenState()); const shot = n => page.screenshot({ path: `${out}/${tag}-${n}.png` });

const res = {}; const y = Math.round(VH * 0.71);
const off = process.env.PEOPLE === 'off';
const begin = async (seed, night = 'rush') => { await page.evaluate(([a, b]) => window.kitchenRush(a, b, null), [seed, night]); await page.waitForFunction(() => window.kitchenState().rush); await page.waitForFunction(o => o ? window.kitchenState().rush?.line.length >= 3 : window.kitchenState().rush?.people >= 3, off, { timeout: 30000 }).catch(() => console.log('never three people')); await page.waitForTimeout(1600); };
const geom = async () => { const s = await st(); return { people: s.rush.people, line: s.rush.line.length, lift: s.rush.lift, tray: s.rush.trayPx, halos: s.rush.halos, clear: s.rush.halos.every(h => h.y > s.rush.trayPx), inside: s.rush.halos.every(h => h.x > 0 && h.x < VW && h.y < VH) }; };
let sx = null;
const calib = async () => { await page.mouse.move(60, y); await page.waitForTimeout(400); const a = (await st()).tray; await page.mouse.move(VW - 60, y); await page.waitForTimeout(400); const b = (await st()).tray; sx = t => 60 + (t - a) / (b - a) * (VW - 120); };
const play = async (ms, each) => { const t0 = Date.now(); let n = 0, bad = 0, max = 0; while (Date.now() - t0 < ms) { const s = await st(); if (s.screen !== 'play') break; if (s.phase === 'sky') { const it = s.rush.items.filter(i => i.owner != null).sort((p, q) => p.y - q.y)[0]; if (it) await page.mouse.move(Math.max(5, Math.min(VW - 5, sx(it.x))), y); if (s.rush.halos.some(h => h.y <= s.rush.trayPx)) bad++; max = Math.max(max, s.models); } else if (s.phase === 'fry' && s.cook?.band) { await page.keyboard.down('Space'); const mid = (s.cook.band[0] + s.cook.band[1]) / 2; for (let i = 0; i < 400; i++) { const k = await st(); if (k.phase !== 'fry' || !k.cook || k.cook.d >= mid) break; await page.waitForTimeout(15); } await page.keyboard.up('Space'); await page.waitForTimeout(250); } else { if (s.phase === 'chop') await page.evaluate(() => window.kitchenAim?.()); await page.keyboard.press('Space'); } await each?.(s, n++); await page.waitForTimeout(45); } return { bad, maxModels: max }; };
const actOn = async (id, won, pick = 0) => { for (let i = 0; i < 200; i++) { const s = await st(); if (s.phase === 'sky' && s.rush.line.length > pick) { const ok = await page.evaluate(([n, id, won]) => window.kitchenRushAct(n, id, won), [s.rush.line[pick].n, id, won]); if (ok) return true; } await page.waitForTimeout(100); } return false; };
// The owner's quality-of-life asks of 2026-11-28: urgent tickets blink, the cooking meter sits at the top, a fry lifted
// early can be pressed again, a Rush plate does not visit the register, the Pace setting is recorded.
res.pace = await page.evaluate(() => document.querySelector('#pace2')?.textContent);
await begin(11); await calib(); await page.waitForTimeout(1500); await shot('1-rings');
// leave the tray parked until a ticket is urgent
res.spares = 0; for (let i = 0; i < 240; i++) { res.spares = Math.max(res.spares, (await st()).rush?.spares ?? 0); if (await page.$('.chip.hot')) break; await page.waitForTimeout(250); }
{ const seen = new Set(); for (let i = 0; i < 12; i++) { seen.add(await page.$eval('.chip.hot', e => getComputedStyle(e).backgroundColor).catch(() => 'none')); await page.waitForTimeout(90); } res.blinkColours = [...seen]; }
res.hot = !!(await page.$('.chip.hot')); await shot('2-urgent'); await page.waitForTimeout(230); await shot('2-urgent-b');
// a fresh shift, played to the first fry
await begin(12); await calib();
const toFry = async () => { const t0 = Date.now(); while (Date.now() - t0 < 120000) { const s = await st(); if (s.screen !== 'play') return false; if (s.phase === 'fry' && s.cook?.band) return true; if (s.phase === 'sky') { const it = s.rush.items.filter(i => i.owner != null).sort((p, q) => p.y - q.y)[0]; if (it) await page.mouse.move(Math.max(5, Math.min(VW - 5, sx(it.x))), y); } else { if (s.phase === 'chop') await page.evaluate(() => window.kitchenAim?.()); await page.keyboard.press('Space'); } await page.waitForTimeout(45); } return false; };
res.fry1 = await toFry();
if (res.fry1) {
  await page.waitForTimeout(400); await shot('3-fry-meter');
  await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space');
  await page.waitForTimeout(150); const a = await st(); await page.keyboard.down('Space');   // pressed again inside the grace
  res.graceKept = { phase: a.phase, over: a.cook?.over, d: a.cook?.d };
  const mid = (a.cook.band[0] + a.cook.band[1]) / 2; for (let i = 0; i < 400; i++) { const q = await st(); if (q.phase !== 'fry' || !q.cook || q.cook.d >= mid) break; await page.waitForTimeout(15); }
  await page.keyboard.up('Space'); await page.waitForTimeout(120); res.afterGood = (await st()).cook?.over; await page.waitForFunction(() => window.kitchenState().phase === 'plate', null, { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(150); await shot('4-plate');
  const tp = Date.now(); await page.waitForFunction(() => window.kitchenState().phase === 'sky', null, { timeout: 5000 }).catch(() => {}); res.plateToSkyMs = Date.now() - tp + 150; await shot('5-sky-again');
  // the next fry: lift early and leave it; it must end by itself, undercooked
  res.fry2 = await toFry();
  if (res.fry2) { await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space'); await page.waitForTimeout(150); const b = (await st()).cook?.over; await page.waitForTimeout(450); res.graceEnds = { overDuring: b, overAfter: (await st()).cook?.over ?? 'gone' }; }
}
console.log(JSON.stringify(res)); console.log('errors', errs);
await browser.close(); server.close();
