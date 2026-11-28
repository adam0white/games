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

const wf = (f, a, ms = 20000) => page.waitForFunction(f, a, { timeout: ms }).then(() => true).catch(() => false);
// A. ordinary day: fridge then kick out, the day must carry on
for (const id of ['fridge', 'kick_out', 'pan']) {
  await page.reload(); await page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
  await page.tap('#play'); await wf(() => window.kitchenState().phase === 'pick'); await page.waitForTimeout(1500); await page.evaluate(() => window.kitchenCall(0)); const o = await wf(() => window.kitchenState().phase === 'order');
  const ph = await page.evaluate(id => window.kitchenWheel(id), id); const seen = new Set([ph]);
  let moved = false; for (let i = 0; i < 150; i++) { const s = await st(); seen.add(s.phase); if (i > 5 && ['order', 'catch', 'enter', 'pick'].includes(s.phase) && seen.size > 2) { moved = true; break; } await page.waitForTimeout(100); }
  res['day_' + id] = { order: o, phases: [...seen], moved, parts: (await st()).mem.parts }; await shot('day-' + id);
}
// B. Rush edges
await page.reload(); await page.waitForFunction(() => window.kitchenState?.()?.screen === 'menu', null, { timeout: 60000 });
await begin(7);
res.pan = await actOn('pan', true, 1); await page.waitForTimeout(350); await page.tap('#pause'); await page.waitForTimeout(300);
const p1 = (await st()).mem.parts; await page.waitForTimeout(2000); const p2 = (await st()).mem.parts; res.pausedParts = [p1, p2]; await shot('edge-paused-pan');
await page.tap('#people2'); await page.waitForTimeout(400); res.offModels = (await st()).models; res.offLabel = await page.$eval('#people2', b => b.innerText);
await page.tap('#people2'); await page.waitForTimeout(300); res.onLabel = await page.$eval('#people2', b => b.innerText);
await page.tap('#resume').catch(async () => { await page.tap('.card button.main:visible'); }); await page.waitForTimeout(3500);
let s = await st(); res.backOn = { people: s.rush.people, line: s.rush.line.length, models: s.models, phase: s.phase, parts: s.mem.parts }; await shot('edge-back-on');
// second action on a guest mid-show
res.a1 = await actOn('slap', true, 0); await page.waitForTimeout(200); res.a2 = await actOn('pan', true, 0); await page.waitForTimeout(600); await shot('edge-second-a'); await page.waitForTimeout(1800); await shot('edge-second-b'); await page.waitForTimeout(2500);
s = await st(); res.afterSecond = { people: s.rush.people, line: s.rush.line.length, peopleAll: s.rush.peopleAll };
// quit mid-stunt
await page.tap('#pause'); await page.waitForTimeout(300); await page.tap('#quit'); await page.waitForTimeout(900); await begin(11); res.a3 = await actOn('fridge', true, 0); await page.waitForTimeout(500); await page.tap('#pause'); await page.waitForTimeout(300); await page.tap('#quit'); await page.waitForTimeout(1200);
s = await st(); res.quitMid = { screen: s.screen, models: s.models, parts: s.mem.parts };
await page.waitForTimeout(1500); res.quitLater = (await st()).mem.parts;
console.log(JSON.stringify(res, null, 1)); console.log('errors', errs);
await browser.close(); server.close();
