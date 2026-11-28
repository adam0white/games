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

const menu = () => page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
const seedRush = async (done, tray) => { await page.evaluate(([d, t]) => { localStorage.setItem('kitchen-rush', JSON.stringify({ plays: 6, turn: 6, done: d })); if (t) localStorage.setItem('kitchen-tray', JSON.stringify(t)); else localStorage.removeItem('kitchen-tray'); }, [done, tray]); await page.reload(); await menu(); };
const ALL = ['use_pan', 'use_slap', 'use_fridge', 'use_trash', 'use_hire', 'use_kick_out', 'use_cook_self', 'use_lock_out', 'use_microwave', 'trio', 'seat', 'use_fight', 'use_rob'];
const shift = async (mission, act) => { await page.evaluate(m => window.kitchenRush(21, 'lunch', m), mission); await page.waitForFunction(() => window.kitchenState().rush?.line.length >= 2, null, { timeout: 30000 }); await page.waitForTimeout(1500); if (!sx) await calib(); res['act_' + mission] = await actOn(act, true, 0); await play(200000); await page.waitForTimeout(1200); const s = await st(); return { screen: s.screen, trays: s.trays, lines: await page.$$eval('#dayMissions li', ls => ls.map(l => [l.innerText, l.scrollWidth > l.clientWidth + 1])) }; };
if (process.env.PART !== 'looks') {
// five stamps, then a sixth: enamel
await seedRush(Object.fromEntries(ALL.slice(2, 7).map(k => [k, 1])), null);
res.before = (await st()).trays;
res.sixth = await shift('use_pan', 'pan'); await shot('end-enamel');
// twelve stamps, then the last: golden
await seedRush(Object.fromEntries(ALL.filter(k => k !== 'use_pan').map(k => [k, 1])), { own: ['wood', 'enamel'], use: 'wood' });
res.last = await shift('use_pan', 'pan'); await shot('end-golden');
await page.reload(); await menu(); res.kept = (await st()).trays;
// a failed mission earns nothing
await seedRush(Object.fromEntries(ALL.slice(2, 7).map(k => [k, 1])), null);
await page.evaluate(() => window.kitchenRush(21, 'lunch', 'use_pan')); await page.waitForFunction(() => window.kitchenState().rush?.line.length >= 2); await play(200000); await page.waitForTimeout(1200); res.failed = (await st()).trays;
await seedRush(Object.fromEntries(ALL.slice(0, 6).map(k => [k, 1])), null); res.boot = (await st()).trays;
// junk in storage
await page.evaluate(() => localStorage.setItem('kitchen-tray', JSON.stringify({ own: ['golden', 'x', 3], use: 'enamel' }))); await page.reload(); await menu(); res.junk = (await st()).trays;
} else {
for (const look of (process.env.LOOKS || 'diner').split(',')) for (const tray of ['wood', 'enamel', 'golden']) {
  await page.evaluate(([l, t]) => { localStorage.setItem('kitchen-look', l); localStorage.setItem('kitchen-tray', JSON.stringify({ own: ['wood', 'enamel', 'golden'], use: t })); localStorage.setItem('kitchen-rush', JSON.stringify({ plays: 6 })); }, [look, tray]); await page.reload(); await menu();
  await begin(7); if (!sx) await calib(); await play(9000); await shot(`look-${look}-${tray}`); await page.tap('#pause'); await page.waitForTimeout(300); await page.tap('#quit'); await page.waitForTimeout(600);
}
}
console.log(JSON.stringify(res)); console.log('errors', errs);
await browser.close(); server.close();
