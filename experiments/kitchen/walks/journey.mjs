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
await page.evaluate(() => { localStorage.setItem('kitchen-rush', JSON.stringify({ plays: 3, turn: 3, done: {} })); }); await page.reload(); await menu(); await page.waitForTimeout(800);
await shot('1-menu');
await page.tap('#rush'); await page.waitForTimeout(1500); await shot('2-after-tap');
// whatever card is up, try its main button once
const s0 = await st(); res.afterTap = { screen: s0.screen, phase: s0.phase, rush: !!s0.rush };
if (!s0.rush) { const b = await page.$('.screen.on button.main, .screen.show button.main, #storyBtns button'); if (b) { await b.tap().catch(() => {}); await page.waitForTimeout(1500); } }
await page.waitForFunction(() => window.kitchenState().rush?.line.length >= 3, null, { timeout: 40000 }).catch(() => console.log('never three in line'));
await page.waitForTimeout(2500); await shot('3-catch'); res.mission = await page.$eval('#rushMission', e => e.innerText).catch(() => null);
await calib();
// open the sheet on the first ticket
const chip = await page.$('.chip'); if (chip) { await chip.tap(); await page.waitForTimeout(700); await shot('4-ticket-sheet'); res.sheet = await page.$eval('#acts', e => e.innerText.replace(/\n+/g, ' | ').slice(0, 400)).catch(() => null); await page.tap('#actsClose').catch(() => {}); await page.waitForTimeout(300); }
// play to the first cooking step, shoot it
let cooked = false, served = false;
await play(200000, async (s, n) => { if (!cooked && s.phase !== 'sky' && s.phase !== 'caught') { cooked = true; await shot('5-cook-' + s.phase); } if (cooked && !served && s.phase === 'sky' && n > 40) { served = true; await page.waitForTimeout(600); await shot('6-after-serve'); } });
await page.waitForTimeout(1500); await shot('7-end-card'); res.end = { screen: (await st()).screen, text: await page.$eval('#dayEnd', e => e.innerText.replace(/\n+/g, ' | ').slice(0, 500)).catch(() => null) };
await page.tap('#toShop2').catch(() => {}); await page.waitForTimeout(900); await shot('8-shop-top');
res.jump = await page.$$eval('.jump button', b => b.map(x => x.innerText)); await page.tap('.jump button:last-child'); await page.waitForTimeout(1200); await shot('9-shop-trays'); res.jumped = await page.evaluate(() => { const b = document.querySelector('#builds').getBoundingClientRect(), t = [...document.querySelectorAll('.toolsBox')].at(-1).getBoundingClientRect(); return { listTop: Math.round(b.top), listBottom: Math.round(b.bottom), boxTop: Math.round(t.top), boxBottom: Math.round(t.bottom) }; });
res.shop = await page.evaluate(() => { const b = document.querySelector('#builds'); const r = b.getBoundingClientRect(); return { listTop: Math.round(r.top), listHeight: Math.round(r.height), scrollHeight: b.scrollHeight, vh: innerHeight }; });
console.log(JSON.stringify(res)); console.log('errors', errs);
await browser.close(); server.close();
