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
// The ladder (2026-11-28): one Rush button, shift after shift. A save shaped like a player's from before the ladder
// (two plays, stars on both nights, no rung) starts at shift 1 and keeps what it had.
const menu = () => page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
const OLD = { plays: 2, best: { 1: 427 }, stars: { 1: 3 }, nights: { lunch: { best: { 1: 400 }, stars: { 1: 3 } } }, night: 'lunch', tried: { rush: 1, lunch: 1 }, done: {}, turn: 0 };
await page.evaluate(([SAVE, OLD, first]) => { localStorage.setItem('kitchen-save', JSON.stringify({ ...SAVE, tier: 1, built: { ...SAVE.built, tray: 2 } })); localStorage.setItem('kitchen-rush', JSON.stringify(first ? { plays: 0 } : OLD)); }, [SAVE, OLD, !!process.env.FIRST]);
await page.reload(); await menu(); await page.waitForTimeout(800); await shot('1-menu');
res.button = await page.$eval('#rush', e => e.innerText.replace(/\n+/g, ' | ')); res.pips = await page.$$eval('#nights .pip', b => b.map(x => x.innerText.replace(/\n+/g, ' ')));
const start = async how => { await how(); await page.waitForFunction(() => window.kitchenState().rush?.line.length >= 2, null, { timeout: 40000 }); await page.waitForTimeout(700); const s = await st(); return { rung: s.rush.rung, need: s.rush.need, mission: s.rush.mission, night: s.rush.night, banner: await page.$eval('#banner', e => e.innerText.replace(/\n+/g, ' | ')).catch(() => null), coach: await page.$eval('#coach', e => e.innerText).catch(() => null), chip: await page.$eval('#rushMission', e => (e.style.display === 'none' ? null : e.innerText)) }; };
const endCard = async () => { await page.waitForFunction(() => window.kitchenState().screen === 'dayEnd', null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1200); return { screen: (await st()).screen, text: await page.$eval('#dayEnd', e => e.innerText.replace(/\n+/g, ' | ').slice(0, 500)), next: await page.$eval('#nextDay', e => e.innerText) }; };
res.s1 = await start(() => page.tap('#rush')); await shot('2-shift1-start'); await calib();
await play(200000); res.e1 = await endCard(); await shot('3-shift1-end');
if (!process.env.FIRST) {
  res.s2 = await start(() => page.tap('#nextDay')); await shot('4-shift2-start'); await calib();
  res.pan = await actOn('pan'); await page.waitForTimeout(600); res.chip2 = await page.$eval('#rushMission', e => e.innerText); await shot('5-shift2-pan');
  await play(200000); res.e2 = await endCard(); await shot('6-shift2-end');
  await page.reload(); await menu(); await page.waitForTimeout(800); await shot('7-menu-after');
  res.button2 = await page.$eval('#rush', e => e.innerText.replace(/\n+/g, ' | ')); res.pips2 = await page.$$eval('#nights .pip', b => b.map(x => x.innerText.replace(/\n+/g, ' ')));
  await page.tap('#nights .pip[data-lock]'); await page.waitForTimeout(300); res.lockLine = await page.$eval('#menuLine', e => e.innerText); await shot('8-lock-tapped');
  res.replay = await start(() => page.tap('#nights .pip[data-rung="0"]'));
  res.saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kitchen-rush')));
}
console.log(JSON.stringify(res, null, 1)); console.log('errors', errs);
await browser.close(); server.close();
