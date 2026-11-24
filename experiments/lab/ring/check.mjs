// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node check.mjs [webkit|chromium] [--quick]
// Real mouse gestures only; positions are read from window.__ring, the page's simulation is never changed.
// Serves experiments/ (the parent of lab/), so ../../kit/ imports resolve as on the site.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/claude-504/-Users-abdul-code/e727a231-6be3-4081-a695-31f6b5ca1a96/scratchpad/ring-shots';
const QUICK = process.argv.includes('--quick');
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    assert.ok(file.startsWith(root + sep));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url);
const { webkit, chromium, devices } = require(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'playwright') : 'playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const DATE = '2026-11-24';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const ring = (page, expr) => page.evaluate(`(() => { const r = window.__ring; return ${expr}; })()`);
const snapshot = page => ring(page, '({ mode: r.mode, kind: r.kind, phase: r.phase, level: r.level, score: r.score, wicks: r.wicks, light: r.light, target: r.target, cleared: r.cleared, effects: r.effects })');
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`), timeout: 60000 });
async function until(page, fn, label, timeout = 12000, arg = null) {
  try { await page.waitForFunction(fn, arg, { timeout }); }
  catch { throw new Error(`timed out: ${label}; state=${JSON.stringify(await snapshot(page).catch(() => null))}`); }
}
async function open(browser, device) {
  const context = await browser.newContext(device), page = await context.newPage();
  const errors = [], outside = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base && url.protocol !== 'data:' && url.protocol !== 'blob:') { outside.push(url.href); return route.abort(); }
    return route.continue();
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors, outside };
}

// The finger: comes in from outside the ring, dips inside, goes once round and crosses its own lead-in.
function radiusAt(t) { return t < 0.8 ? 1.25 - 0.4 * t / 0.8 : t < 1.4 ? 0.85 + 0.15 * (t - 0.8) / 0.6 : 1; }
function lassoPath(cx, cy, r, vw, vh) {
  const a0 = Math.atan2(vh / 2 - cy, vw / 2 - cx), pts = [];
  for (let t = 0; t <= 2 * Math.PI + 0.9; t += 12 / Math.max(14, r * radiusAt(t))) {
    const rr = r * radiusAt(t);
    pts.push([cx + Math.cos(a0 + t) * rr, cy + Math.sin(a0 + t) * rr]);
  }
  return pts;
}
async function draw(page, pts, during = null) {
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (let k = 1; k < pts.length; k++) {
    await page.mouse.move(pts[k][0], pts[k][1]);
    await sleep(4);
    if (during) await during(k / pts.length);
  }
  await page.mouse.up();
}
// The best single-colour cluster on screen, as a careful player would pick it.
async function plan(page) {
  const [cs, map, vw, vh] = await page.evaluate(() => [window.__ring.creatures(), window.__ring.map(), innerWidth, innerHeight]);
  const flies = cs.filter(c => (c.kind === 'firefly' || c.kind === 'golden') && !c.scared), moths = cs.filter(c => c.kind === 'moth');
  const rmax = 78 * map.sc, top = map.oy + 10;
  let best = null;
  for (const f of flies) {
    const mates = flies.filter(o => (o.col === f.col || o.kind === 'golden') && Math.hypot(o.x - f.x, o.y - f.y) < rmax);
    let cx = mates.reduce((a, o) => a + o.x, 0) / mates.length, cy = mates.reduce((a, o) => a + o.y, 0) / mates.length;
    const other = Math.min(Infinity, ...flies.filter(o => o.kind === 'firefly' && o.col !== f.col).map(o => Math.hypot(o.x - cx, o.y - cy)));
    const limit = Math.min(rmax, other - 20 * map.sc);
    const inside = mates.filter(o => Math.hypot(o.x - cx, o.y - cy) + 16 * map.sc <= limit);
    if (!inside.length || limit < 34) continue;
    const r = Math.min(limit, Math.max(34, Math.max(...inside.map(o => Math.hypot(o.x - cx, o.y - cy))) + 16 * map.sc));
    if (moths.some(m => Math.hypot(m.x - cx, m.y - cy) < r + 50)) continue;
    cx = Math.min(vw - r * 1.25 - 4, Math.max(r * 1.25 + 4, cx)); cy = Math.min(vh - r * 1.25 - 4, Math.max(top + r * 1.25, cy));
    if (!best || inside.length > best.n) best = { cx, cy, r, n: inside.length };
  }
  return best && { ...best, pts: lassoPath(best.cx, best.cy, best.r, vw, vh) };
}
// Plays the current level until its jars are full (or the level ends); returns the number of rings drawn.
async function playLevel(page, wantN = 4, limitMs = 60000) {
  const start = await snapshot(page), t0 = Date.now();
  let rings = 0;
  while (Date.now() - t0 < limitMs) {
    const st = await snapshot(page);
    if (st.mode !== 'play' || st.level !== start.level || st.phase !== 'play') break;
    if (await ring(page, 'r.rekindle') > 0) { await sleep(60); continue; }
    const p = await plan(page);
    if (process.env.DEBUG) console.log(`       plan ${p ? `n=${p.n} r=${Math.round(p.r)}` : 'none'} dawn ${(await ring(page, 'r.dawnLeft')).toFixed(2)} rekindle ${await ring(page, 'r.rekindle')}`);
    if (!p) { await sleep(200); continue; }
    const dawn = await ring(page, 'r.dawnLeft');
    if (!(p.n * p.n >= st.target - st.light || p.n >= wantN || (dawn < 0.5 && p.n >= 3) || (dawn < 0.3 && p.n >= 2) || dawn < 0.15)) { await sleep(200); continue; }
    const c0 = await ring(page, 'r.counts');
    let most = 0;
    await draw(page, p.pts, process.env.DEBUG ? async () => { most = Math.max(most, await ring(page, 'r.threadPoints')); } : null); rings++;
    if (process.env.DEBUG) console.log(`       thread points at most ${most}, path ${p.pts.length}`);
    await sleep(120);
    if (process.env.DEBUG) { const c1 = await ring(page, 'r.counts'), s1 = await snapshot(page); console.log(`       lasso n=${p.n} r=${Math.round(p.r)}: rings +${c1.rings - c0.rings} pure +${c1.pure - c0.pure} mixed +${c1.mixed - c0.mixed} light ${s1.light}/${s1.target} level ${s1.level} dawn ${(await ring(page, 'r.dawnLeft')).toFixed(2)} t ${Date.now() - t0}`); }
  }
  return rings;
}
async function menu(page, q = '', language = 'en') {
  await page.goto(`${base}/lab/ring/?hint=0&lang=${language}&date=${DATE}${q}`);
  await until(page, () => window.__ring?.ready && window.__ring.mode === 'menu', 'menu');
}
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
async function visibleIn(page, selector) {
  const box = await page.locator(selector).boundingBox(), vp = page.viewportSize();
  return box && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1;
}

// Words: the two tables must match, and what the page shows must come from them.
const { tables } = await import('./words.js');
{
  const keys = l => Object.keys(tables[l]).sort(), vars = text => (String(text).match(/\{\w+\}/g) || []).sort().join();
  assert.deepEqual(keys('tr'), keys('en'), 'every English key has a Turkish one and the other way round');
  for (const k of keys('en')) {
    assert.equal(vars(tables.tr[k]), vars(tables.en[k]), `placeholders of ${k} match`);
    assert.ok(tables.tr[k].trim() && tables.en[k].trim(), `${k} is not empty`);
  }
}
const KEYS = Object.keys(tables.en), LEFT_IN_ENGLISH = Object.keys(tables.en).filter(k => tables.tr[k] !== tables.en[k] && tables.en[k].trim().length > 3).map(k => tables.en[k].trim());
// Every piece of visible text and every aria-label on the page, one entry each.
const seen = page => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const box = el.getBoundingClientRect(), shown = box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    if (!shown) continue;
    if (!el.children.length && el.textContent.trim()) out.push(el.textContent.trim());
    else for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) out.push(n.textContent.trim());
    for (const a of ['aria-label', 'title']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
  }
  return out;
});
async function cleanWords(page, label, turkish) {
  for (const text of await seen(page)) {
    assert.ok(!KEYS.includes(text) && !/\{\w+\}/.test(text), `${label}: "${text}" is a raw key or an unfilled placeholder`);
    if (turkish) assert.ok(!LEFT_IN_ENGLISH.includes(text), `${label}: "${text}" is still English`);
  }
}
const docLang = page => page.evaluate(() => document.documentElement.lang);

async function run(test, phone) {
  const { page, errors, outside } = test;
  await menu(page);
  assert.ok(await page.isVisible('#menu'), 'menu shows');
  assert.ok(await noOverflow(page), 'menu: no horizontal or vertical overflow');
  for (const id of ['#play', '#daily', '#endless']) assert.ok(await visibleIn(page, id), `${id} is on screen`);
  await shot(page, phone, '1-menu');

  await page.click('#play');
  let st = await snapshot(page);
  assert.equal(st.mode, 'play'); assert.equal(st.level, 0); assert.equal(st.kind, 'night');
  assert.ok(await page.isVisible('#pause'), 'pause button shows in play');
  await sleep(1800);

  // One ring around a firefly raises the score. The firefly keeps moving while the finger draws (and this machine may be
  // slow to answer), so a ring that comes back empty is tried again, up to five times. The first attempt holds still halfway
  // for the thread screenshot.
  const map = await ring(page, 'r.map()'), vp = page.viewportSize(), before = st.score;
  let closeShot = false, attempts = 0;
  while (attempts < 5 && (await ring(page, 'r.score')) === before) {
    attempts++;
    const flies = (await ring(page, 'r.creatures()')).filter(c => c.kind === 'firefly');
    const target = flies.reduce((a, f) => Math.hypot(f.x - vp.width / 2, f.y - vp.height / 2) < Math.hypot(a.x - vp.width / 2, a.y - vp.height / 2) ? f : a);
    const r = 55 * map.sc, cx = Math.min(vp.width - r * 1.3, Math.max(r * 1.3, target.x)), cy = Math.min(vp.height - r * 1.3, Math.max(map.oy + r * 1.3, target.y));
    const rings0 = (await ring(page, 'r.counts')).rings;
    let held = attempts > 1;
    await draw(page, lassoPath(cx, cy, r, vp.width, vp.height), async f => {
      if (!held && f > 0.6) { held = true; await shot(page, phone, '2-thread'); }
      if (!closeShot && f > 0.75 && await ring(page, 'r.effects') > 0) { closeShot = true; await shot(page, phone, '3-ring-closing'); }
    });
    await until(page, n => window.__ring.counts.rings > n, 'ring closed', 2000, rings0).catch(() => console.log(`     ${phone}: lasso attempt ${attempts} did not close`));
    await sleep(150);
  }
  st = await snapshot(page);
  assert.ok(st.score > before, `a ring around a firefly raises the score (${attempts} attempts)`);
  console.log(`     ${phone}: first ring scored ${st.score - before} (attempt ${attempts}); closing frame captured: ${closeShot}`);

  // Pause when the page is hidden; the sim stands still; Resume goes on.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; });
  assert.equal(await ring(page, 'r.mode'), 'paused', 'page hide pauses');
  assert.ok(await page.isVisible('#paused'), 'pause card shows');
  const frozen = JSON.stringify(await ring(page, 'r.creatures()'));
  await sleep(300);
  assert.equal(JSON.stringify(await ring(page, 'r.creatures()')), frozen, 'pause freezes the meadow');
  assert.ok(await noOverflow(page), 'pause card: no overflow');
  await shot(page, phone, '4-paused');
  await page.click('#resume');
  assert.equal(await ring(page, 'r.mode'), 'play', 'Resume plays on');
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.equal(await ring(page, 'r.mode'), 'paused', 'losing focus pauses');
  await page.keyboard.press('P');
  assert.equal(await ring(page, 'r.mode'), 'play', 'P resumes');

  // The night's level 1 with the scripted finger (reported; the asserted full level is the practice level below).
  const rings = await playLevel(page, 5, 45000);
  st = await snapshot(page);
  console.log(`     ${phone}: night level 1 ${(await ring(page, 'r.results'))[0] >= 1 ? 'full' : 'not full'} after ${rings} scripted rings, score ${st.score}`);
  await shot(page, phone, '5-level-2');
  await page.click('#pause'); await page.click('#toMenu');
  assert.equal(await ring(page, 'r.mode'), 'menu', 'Menu returns to the menu');

  // Today's meadow marks the day's scored run; a save survives reload.
  await page.click('#daily');
  assert.equal(await ring(page, 'r.kind'), 'daily');
  await page.click('#pause'); await page.click('#toMenu');
  await page.click('#sound');
  assert.equal(await page.textContent('#sound'), 'Sound: off');
  await page.reload();
  await until(page, () => window.__ring?.ready && window.__ring.mode === 'menu', 'menu after reload');
  const saved = await ring(page, 'r.save()');
  assert.equal(saved.sound, false, 'sound setting survives reload');
  assert.ok(saved.daily[DATE], 'the day\'s scored run is remembered');
  assert.equal(saved.bestRing >= 1, true, 'best ring kept');
  assert.equal(await page.textContent('#sound'), 'Sound: off', 'menu reads the saved sound setting');
  assert.match(await page.textContent('#dailyNote'), /Later runs are practice/, 'menu says later daily runs are practice');

  // A full practice level by the scripted finger reaches its end card with the jars full (two tries on a slow machine).
  let full = false, tries = 0;
  while (!full && tries < 2) {
    tries++;
    await menu(page, '&level=1');
    await page.click('#play');
    assert.equal(await ring(page, 'r.kind'), 'practice');
    await sleep(1500);
    const n = await playLevel(page, 5, 60000);
    await until(page, () => window.__ring.mode === 'end', 'practice end card', 15000);
    full = (await ring(page, 'r.cleared')) === 1;
    console.log(`     ${phone}: practice level 1 try ${tries}: ${full ? 'jars full' : 'dawn came first'} after ${n} rings, score ${await ring(page, 'r.score')}`);
  }
  assert.ok(full, 'the scripted finger fills a whole level');
  assert.ok(await page.isVisible('#end'), 'end card shows');
  for (const id of ['#endTitle', '#total', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${id} visible on the end card`);
  assert.ok(await noOverflow(page), 'end card: no overflow');
  await shot(page, phone, '6-end-practice');
  await page.click('#endMenu');

  if (!QUICK && phone === 'chromium') {
    // The whole of today's meadow (practice now), to see the real end card with eight jars.
    await page.click('#daily');
    const t0 = Date.now();
    while (Date.now() - t0 < 420000) {
      const s = await snapshot(page);
      if (s.mode === 'end' || s.mode === 'ending') break;
      if (s.phase !== 'play') { await sleep(200); continue; }
      await playLevel(page, 5, 50000);
    }
    await until(page, () => window.__ring.mode === 'end', 'night end card', 8000);
    const end = await snapshot(page);
    console.log(`     ${phone}: whole night by the scripted finger: ${end.cleared}/8 full, score ${end.score}, wicks ${end.wicks}, ${Math.round((Date.now() - t0) / 1000)} s`);
    for (const id of ['#jarRow', '#stars', '#again', '#savePic']) assert.ok(await visibleIn(page, id), `${id} visible on the night end card`);
    await shot(page, phone, '7-end-night');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#savePic')]);
    assert.ok(download || /Shared|saved/i.test(await page.textContent('#saveNote')), 'Save picture gives a file');
    if (download) { await download.saveAs(join(SHOTS, `${phone}-8-picture.png`)); console.log(`     ${phone}: picture saved as ${download.suggestedFilename()}`); }
    await page.click('#endMenu');
  }
  await sleep(200);
  assert.deepEqual(errors, [], 'no page, console or network errors');
  assert.deepEqual(outside, [], 'no requests leave the page\'s own origin');
}
async function turkish(browser, device, phone) {
  const test = await open(browser, device), { page } = test, label = `${phone} tr`;
  try {
    await menu(page, '', 'tr');
    assert.equal(await docLang(page), 'tr', 'lang=tr sets the document language');
    assert.equal(await page.title(), 'Ateş Böceği Halkası');
    assert.equal(await page.textContent('h1'), 'Ateş Böceği Halkası');
    assert.equal(await page.textContent('#play'), 'Geceyi oyna');
    assert.equal(await page.textContent('#daily'), 'Bugünün çayırı');
    assert.equal(await page.textContent('#endless'), 'Sonsuz çayır');
    assert.equal(await page.textContent('#sound'), 'Ses: açık');
    assert.equal(await page.textContent('#dailyNote'), 'Bugün herkes için aynı çayır. Puanlı tek deneme.');
    assert.equal(await page.textContent('#endlessNote'), 'İlk şafağından sonra açılır');
    assert.equal(await page.getAttribute('#c', 'aria-label'), 'Aynı renkteki ateş böceklerinin etrafına halka çiz');
    assert.equal(await page.textContent('#lang'), 'English');
    assert.ok((await page.locator('#lang').boundingBox()).height >= 44, 'language button is at least 44 px tall');
    assert.ok(await noOverflow(page), `${label}: menu has no overflow`);
    for (const id of ['#play', '#daily', '#endless', '#sound', '#lang']) assert.ok(await visibleIn(page, id), `${label}: ${id} on screen`);
    await cleanWords(page, `${label} menu`, true);
    await shot(page, `tr-${phone}`, '1-menu');

    // The switch changes the menu without a reload, and the choice outlives one (the address no longer says which).
    await page.click('#lang');
    assert.equal(await page.textContent('#play'), 'Play the night'); assert.equal(await page.textContent('#lang'), 'Türkçe');
    assert.equal(await docLang(page), 'en'); assert.equal(await page.title(), 'Firefly Ring');
    await cleanWords(page, `${label} menu after switch`, false);
    await page.goto(`${base}/lab/ring/?hint=0&date=${DATE}`);
    await until(page, () => window.__ring?.ready, 'menu after reload');
    assert.equal(await page.textContent('#play'), 'Play the night', 'English survives a reload');
    await page.click('#lang');
    assert.equal(await page.textContent('#play'), 'Geceyi oyna');
    await page.goto(`${base}/lab/ring/?hint=0&date=${DATE}`);
    await until(page, () => window.__ring?.ready, 'menu after second reload');
    assert.equal(await page.textContent('#play'), 'Geceyi oyna', 'Turkish survives a reload');
    assert.equal(await docLang(page), 'tr');

    // Play, the banner, the pause card (with its own switch), the hint's words.
    await page.click('#play'); await sleep(600);
    await shot(page, `tr-${phone}`, '2-play');
    await page.click('#pause');
    assert.equal(await page.textContent('#paused h2'), 'Duraklatıldı');
    assert.equal(await page.textContent('#resume'), 'Devam et');
    assert.equal(await page.textContent('#restart'), 'Yeniden başla');
    assert.equal(await page.textContent('#toMenu'), 'Menü');
    assert.equal(await page.textContent('#pauseLine'), 'Seviye 1/8 · 0');
    assert.equal(await page.textContent('#sound2'), 'Ses: açık');
    assert.equal(await page.textContent('#lang2'), 'English');
    assert.ok((await page.locator('#lang2').boundingBox()).height >= 44, 'pause language button is at least 44 px tall');
    assert.ok(await noOverflow(page), `${label}: pause card has no overflow`);
    for (const id of ['#resume', '#restart', '#toMenu', '#sound2', '#lang2']) assert.ok(await visibleIn(page, id), `${label}: ${id} on screen`);
    await cleanWords(page, `${label} pause`, true);
    await shot(page, `tr-${phone}`, '3-paused');
    await page.click('#lang2');
    assert.equal(await page.textContent('#paused h2'), 'Paused'); assert.equal(await page.textContent('#pauseLine'), 'Level 1 of 8 · 0');
    await page.click('#lang2');
    assert.equal(await page.textContent('#paused h2'), 'Duraklatıldı');
    assert.equal(await ring(page, 'r.mode'), 'paused', 'switching language does not resume play');
    await page.click('#toMenu');

    // An end card: practice level 1 left alone until dawn.
    await menu(page, '&level=1', 'tr');
    assert.equal(await page.textContent('#play'), '1. seviyeyi çalış');
    await page.click('#play');
    await until(page, () => window.__ring.mode === 'end', 'practice end card in Turkish', 60000);
    assert.equal(await page.textContent('#endTitle'), 'Şafak önce söktü');
    assert.equal(await page.textContent('#endTop'), 'Alıştırma · 1. seviye');
    assert.equal(await page.textContent('#endLine'), 'Alıştırma denemeleri skor olarak kaydedilmez.');
    assert.equal(await page.textContent('#again'), 'Tekrar oyna');
    assert.equal(await page.textContent('#savePic'), 'Resmi kaydet');
    assert.equal(await page.textContent('#endMenu'), 'Menü');
    assert.equal(await page.textContent('#total + span'), 'toplam'); assert.equal(await page.textContent('#bestRing + span'), 'en iyi halka'); assert.equal(await page.textContent('#total'), '0');
    assert.ok(await noOverflow(page), `${label}: end card has no overflow`);
    for (const id of ['#endTitle', '#total', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${label}: ${id} on screen`);
    await cleanWords(page, `${label} end card`, true);
    await shot(page, `tr-${phone}`, '4-end');
    assert.deepEqual(test.errors, [], `${label}: no page, console or network errors`);
    assert.deepEqual(test.outside, [], `${label}: nothing leaves the page's origin`);
    console.log(`ok   ring in Turkish on ${phone}`);
  } finally { await test.context.close(); }
}
// The hint (shown here by ?hint=hand with reduced motion, so its words are on screen) speaks the page's language.
async function turkishHint(browser, device, phone) {
  const test = await open(browser, { ...device, reducedMotion: 'reduce' }), { page } = test;
  try {
    await page.goto(`${base}/lab/ring/?hint=hand&lang=tr&date=${DATE}`);
    await until(page, () => window.__ring?.ready && window.__ring.mode === 'menu', 'menu with hint');
    await page.click('#play');
    await until(page, () => document.querySelector('.kit-hint.on'), 'the hint shows', 15000);
    assert.equal(await page.textContent('.kit-hint .label'), 'Parmağını bas ve yavaşça sürükle', 'the hint speaks Turkish');
    assert.ok(await page.isVisible('.kit-hint .label'), 'the hint words are visible');
    await shot(page, `tr-${phone}`, '5-hint');
    await page.click('#pause'); await page.click('#lang2');
    assert.equal(await page.textContent('.kit-hint .label'), 'Hold your finger down and move it slowly', 'the hint follows the switch');
    assert.deepEqual(test.errors, [], `${phone} tr hint: no errors`);
  } finally { await test.context.close(); }
}
async function turkishSmall(browser) {
  const device = { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const test = await open(browser, device), { page } = test;
  try {
    await menu(page, '', 'tr');
    assert.ok(await noOverflow(page), 'tr 360x640: menu has no overflow');
    for (const id of ['#play', '#daily', '#endless', '#sound', '#lang']) assert.ok(await visibleIn(page, id), `tr 360x640: ${id} visible`);
    await shot(page, 'tr-small', '1-menu');
    await page.click('#play'); await sleep(600);
    await shot(page, 'tr-small', '2-play');
    await page.click('#pause');
    assert.ok(await noOverflow(page), 'tr 360x640: pause card has no overflow');
    for (const id of ['#resume', '#restart', '#toMenu', '#sound2', '#lang2']) assert.ok(await visibleIn(page, id), `tr 360x640: ${id} visible`);
    await shot(page, 'tr-small', '3-paused');
    await page.click('#toMenu');
    await menu(page, '&level=1', 'tr');
    await page.click('#play');
    await until(page, () => window.__ring.mode === 'end', 'end card at 360x640', 60000);
    assert.ok(await noOverflow(page), 'tr 360x640: end card has no overflow');
    for (const id of ['#endTitle', '#total', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `tr 360x640: ${id} visible`);
    await shot(page, 'tr-small', '4-end');
    assert.deepEqual(test.errors, [], 'tr 360x640: no errors');
    console.log('ok   ring in Turkish at 360x640');
  } finally { await test.context.close(); }
}
async function small(browser) {
  for (const [name, device] of [['small', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['iphone-390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]]) {
    const test = await open(browser, device), { page } = test;
    try {
      await menu(page);
      for (const id of ['#play', '#daily', '#endless', '#sound']) assert.ok(await visibleIn(page, id), `${name}: ${id} visible`);
      assert.ok(await noOverflow(page), `${name}: no overflow`);
      await shot(page, name, '1-menu');
      await page.click('#play'); await sleep(2500);
      const map = await ring(page, 'r.map()');
      assert.ok(map.ox >= -0.5 && map.ox + map.width * map.sc <= device.viewport.width + 0.5, `${name}: field fits across`);
      assert.ok(map.oy + map.height * map.sc <= device.viewport.height + 0.5, `${name}: field fits down`);
      await shot(page, name, '2-play');
      await page.click('#pause');
      for (const id of ['#resume', '#restart', '#toMenu']) assert.ok(await visibleIn(page, id), `${name}: ${id} visible`);
      await shot(page, name, '3-paused');
      assert.deepEqual(test.errors, [], `${name}: no errors`);
      console.log(`ok   ring at ${name} ${device.viewport.width}x${device.viewport.height}`);
    } finally { await test.context.close(); }
  }
}

let failed = 0;
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(a => !a.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch();
    const test = await open(browser, device);
    try { await run(test, phone); console.log(`ok   ring on ${phone} (${device.viewport.width}x${device.viewport.height})`); await turkish(browser, device, phone); await turkishHint(browser, device, phone); if (phone === 'chromium') { await small(browser); await turkishSmall(browser); } }
    catch (e) { failed++; console.error(`FAIL ring on ${phone}: ${e.stack}`); if (test.errors.length) console.error(test.errors.join('\n')); await shot(test.page, phone, 'failure').catch(() => {}); }
    finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`screenshots in ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
