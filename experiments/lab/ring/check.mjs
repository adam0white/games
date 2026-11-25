// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node check.mjs [webkit|chromium] [--quick]
// Real mouse gestures only; positions are read from window.__ring, the page's simulation is never changed.
// Serves experiments/ (the parent of lab/), so ../../kit/ imports resolve as on the site.
import { answerLab, allowLocalSend, assertNotice, assertRun, assertOffSendsNothing } from '../../kit/check/lab-record.mjs';
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
  const lab = await answerLab(context, base); // registered after the catch-all, so it takes lab requests first
  return { context, page, errors, outside, lab };
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
    // A whole night, to see the real end card with eight jars and the next night opening. (Until 2026-11-24 this played
    // today's meadow again as practice; the end card is the same, and a night is what opens night 2.)
    await menu(page);
    assert.equal(await ring(page, 'r.nights()'), null, 'night 2 is not open before a night is played');
    await page.click('#play');
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
    assert.ok(end.cleared >= 4, `the scripted finger fills at least 4 levels of night 1 (${end.cleared})`);
    assert.match(await page.textContent('#endLine'), /Night 2 is open\./, 'the end card says night 2 is open');
    assert.equal((await ring(page, 'r.nights()')).open, 2, 'ring:nights opens night 2');
    const fx = await ring(page, 'r.fx');
    for (const name of ['ring', 'jar', 'levelFull', 'level', 'over', 'nightOpened']) assert.ok(fx.includes(name), `feedback over a night: ${name}`);
    console.log(`     ${phone}: feedback names over the night: ${[...new Set(fx)].join(' ')}`);
    await page.click('#endMenu');
    assert.equal(await page.textContent('#play'), 'Play night 2', 'the menu offers night 2 at once');
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

// The improvements of 2026-11-24: nights 2 and 3 behind their own key, the way back to the small games' home, feedback
// for every action, and the menu at 320x568 in the fullest case.
const OLD = '{"v":1,"sound":true,"nights":2,"dawns":1,"best":412,"bestRing":16,"endless":true,"endlessBest":90,"daily":{}}';
async function seeded(page, items, q = '', language = 'en') {
  await page.goto(`${base}/kit/save.js`); await page.evaluate(items => { localStorage.clear(); for (const k in items) localStorage.setItem(k, items[k]); }, items);
  await menu(page, q, language);
}
async function improved(browser, device, phone) {
  const test = await open(browser, device), { page } = test;
  try {
    // A fresh device: night 1 only, one quiet line says how night 2 opens.
    await seeded(page, {});
    assert.equal(await page.isVisible('#nights'), false, 'fresh: no night chooser');
    assert.equal(await page.textContent('#nightNote'), 'Night 2 opens when 4 levels of a night end with full jars.');
    // A player from before: ring:v1 loads unchanged, and having seen dawn, night 2 is open. ring:nights is written only when it changes.
    await seeded(page, { 'ring:v1': OLD, 'ring:hint': '1' });
    assert.deepEqual(await ring(page, 'r.save()'), JSON.parse(OLD), 'old save loads and is not rewritten');
    assert.equal(await ring(page, 'r.nights()'), null, 'no new key until the player changes something');
    assert.ok(await page.isVisible('#nights'), 'old save with a dawn: the night chooser shows');
    assert.equal(await page.textContent('#nightName'), 'Night 1 of 2'); assert.equal(await page.textContent('#play'), 'Play the night');
    assert.equal(await page.isDisabled('#nightPrev'), true); assert.equal(await page.isDisabled('#nightNext'), false);
    await page.click('#nightNext');
    assert.equal(await page.textContent('#nightName'), 'Night 2 of 2'); assert.equal(await page.textContent('#play'), 'Play night 2');
    assert.deepEqual(await ring(page, 'r.nights()'), { v: 1, open: 2, pick: 1, best: [0, 0, 0] }, 'the pick is kept in ring:nights');
    assert.ok((await ring(page, 'r.fx')).includes('night'), 'picking a night answers');
    await page.reload(); await until(page, () => window.__ring?.ready, 'menu after reload');
    assert.equal(await page.textContent('#play'), 'Play night 2', 'the pick survives a reload');
    await page.click('#play');
    assert.deepEqual(await ring(page, '[r.kind, r.night, r.idea, r.rules]'), ['night', 1, 'crowd', { fair: true, relight: true }], 'night 2 starts on its first idea with page rules');
    await sleep(900); await shot(page, phone, 'n2-banner');
    // Feedback: the pen going down answers; so does the button that started the run.
    const box = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.75 }; });
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 30, box.y, { steps: 4 }); await page.mouse.up();
    const fx = await ring(page, 'r.fx');
    for (const name of ['button', 'level', 'penDown']) assert.ok(fx.includes(name), `feedback: ${name} in ${fx.join(',')}`);
    assert.ok(await noOverflow(page), 'night 2: no overflow');
    // The daily and endless runs stay on night 1's levels.
    await page.click('#pause'); await page.click('#toMenu'); await page.click('#daily');
    assert.deepEqual(await ring(page, '[r.kind, r.night, r.rules.fair]'), ['daily', 0, true], 'the daily is night 1 with page rules');
    await page.click('#pause'); await page.click('#toMenu');
    // Practice a later night by address, open or not.
    await menu(page, '&night=3');
    assert.equal(await page.textContent('#play'), 'Practise night 3'); assert.equal(await page.isVisible('#nights'), false);
    await page.click('#play'); assert.deepEqual(await ring(page, '[r.kind, r.night, r.idea]'), ['practice', 2, 'pull']);
    await page.click('#pause'); await page.click('#toMenu');
    // Thorns are drawn where the sim has them; a level with thorns has them on screen.
    await menu(page, '&night=2&level=7'); await page.click('#play'); await sleep(400);
    const th = await ring(page, 'r.thorns()'), vp = page.viewportSize();
    assert.equal(th.length, 6, 'three thorns on the thorns level');
    for (let k = 0; k < th.length; k += 2) assert.ok(th[k] > 0 && th[k] < vp.width && th[k + 1] > 0 && th[k + 1] < vp.height, 'a thorn is on screen');
    await shot(page, phone, 'n2-thorns');
    await page.click('#pause'); await page.click('#toMenu');
    // From the small games' home: the way back on the menu and the end card, and a finished run reported to hub:results.
    await menu(page, '&level=1&from=small');
    assert.equal(await page.locator('#menu .kit-home').count(), 1, 'from=small: the way back is on the menu');
    const runs0 = await page.evaluate(() => JSON.parse(localStorage.getItem('hub:results') || '{}').ring?.runs || 0);
    await page.click('#play');
    await until(page, () => window.__ring.mode === 'end', 'practice level left alone ends', 60000);
    assert.equal(await page.locator('#end .kit-home').count(), 1, 'from=small: the way back is on the end card');
    const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('hub:results') || '{}'));
    assert.equal(hub.ring?.runs, runs0 + 1, 'the run is reported to the home (quits count as runs too, as kit/home.js says)'); assert.equal(hub.ring?.last, 'lost', 'a practice level with no full jar is not a win');
    assert.match(await ring(page, 'r.shareText'), /^Firefly Ring · Practice · level 1: 0, biggest ring 0$/, 'the share line');
    await until(page, () => window.__ring.picture, 'the picture is made after the card shows', 4000);
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#savePic')]);
    assert.ok(download || /Shared|saved/i.test(await page.textContent('#saveNote')), 'Save picture gives a file through kit/share.js');
    assert.deepEqual(test.errors, [], `${phone} improvements: no errors`); assert.deepEqual(test.outside, []);
    console.log(`ok   ring nights, home and feedback on ${phone}`);
  } finally { await test.context.close(); }
}
// Every new level in the browser: it draws without page errors and without a frame over 8 ms (rAF callback time), with a
// finger moving about so the thread, the noticing moths and the shy fireflies all run. Then a thread dragged across a thorn.
async function ideas(browser, device, phone) {
  const test = await open(browser, device), { page } = test;
  await page.addInitScript(() => { const raf = requestAnimationFrame.bind(window); window.__worst = 0; window.requestAnimationFrame = cb => raf(t => { const a = performance.now(); cb(t); window.__worst = Math.max(window.__worst, performance.now() - a); }); });
  try {
    const worst = {};
    for (let night = 2; night <= 3; night++) for (let level = 1; level <= 8; level++) {
      await menu(page, `&night=${night}&level=${level}`); await page.click('#play');
      await until(page, () => window.__ring.phase === 'play', 'level in play', 8000);
      await page.evaluate(() => { window.__worst = 0; });
      const vp = page.viewportSize(), cx = vp.width / 2, cy = vp.height * 0.6;
      await page.mouse.move(cx - 80, cy); await page.mouse.down();
      for (let k = 0; k < 40; k++) { await page.mouse.move(cx + 80 * Math.cos(k / 6), cy + 60 * Math.sin(k / 5)); await sleep(40); }
      await page.mouse.up(); await sleep(1200);
      const idea = await ring(page, 'r.idea');
      worst[idea] = +(await page.evaluate(() => window.__worst)).toFixed(1);
      if (level === 2 || level === 3 || level === 8 || (night === 3 && level === 2)) await shot(page, phone, `idea-${night}-${level}-${idea}`);
    }
    console.log(`     ${phone}: worst frame per idea (ms) ${JSON.stringify(worst)}`);
    for (const [idea, ms] of Object.entries(worst)) assert.ok(ms < 8, `${idea}: a frame took ${ms} ms`);
    // A thread pulled across a thorn is cut with no wick lost, and the cut answers.
    await menu(page, '&night=2&level=7'); await page.click('#play');
    await until(page, () => window.__ring.phase === 'play', 'thorn level in play', 8000);
    // A drag can meet a moth on the way (one Chromium run had no cut at the first thorn), so try each thorn in turn
    // and judge the first drag that reached a thorn with no moth snap in it.
    const thorns = await ring(page, 'r.thorns()'), tries = [];
    const state = () => page.evaluate(() => { const r = window.__ring; return { wicks: r.wicks, snaps: r.counts.snaps || 0, cuts: r.counts.thorns || 0, fxCuts: r.fx.filter(n => n === 'thorn').length }; });
    for (let m = 0; m < thorns.length && !tries.some(x => x.cut && !x.snapped); m += 2) {
      await until(page, () => window.__ring.rekindle === 0, 'lamp ready', 3000);
      const [tx, ty] = [thorns[m], thorns[m + 1]], before = await state();
      await page.mouse.move(tx - 70, ty + 4); await page.mouse.down();
      for (let k = 0; k <= 28; k++) { await page.mouse.move(tx - 70 + k * 5, ty + 4); await sleep(20); }
      await page.mouse.up(); await sleep(300);
      const after = await state();
      // Each step after a cut starts a new thread that touches the thorn again, so one drag can count several cuts.
      tries.push({ thorn: m / 2, cut: after.cuts > before.cuts && after.fxCuts > before.fxCuts, snapped: after.snaps > before.snaps, wickLost: before.wicks - after.wicks });
    }
    const clean = tries.find(x => x.cut && !x.snapped);
    assert.ok(clean, `a thread across a thorn is cut, and the cut answers: ${JSON.stringify(tries)}`);
    assert.equal(clean.wickLost, 0, `no wick lost to a thorn: ${JSON.stringify(clean)}`);
    if (tries.length > 1) console.log(`     ${phone}: thorn drags ${JSON.stringify(tries)}`);
    assert.deepEqual(test.errors, [], `${phone} ideas: no page or console errors`);
    console.log(`ok   ring's sixteen new levels draw on ${phone}`);
  } finally { await test.context.close(); }
}
// 320x568, the fullest menu: from the home, three nights open, a best score, and the lab notice; in both languages.
async function tiny(browser) {
  const device = { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const test = await open(browser, device), { page } = test;
  try {
    for (const language of ['en', 'tr']) {
      await seeded(page, { 'ring:v1': OLD, 'ring:nights': '{"v":1,"open":3,"pick":2,"best":[0,0,300]}', 'ring:hint': '1' }, '&from=small', language);
      assert.ok(await page.isVisible('#nights'), `320 ${language}: chooser shows`);
      assert.ok(await noOverflow(page), `320 ${language}: the menu does not scroll`);
      const inner = await page.evaluate(() => { const d = document.querySelector('#menu > div'); return d.scrollHeight - d.clientHeight; });
      assert.ok(inner <= 1, `320 ${language}: the menu card does not scroll inside (${inner} px over)`);
      for (const id of ['#play', '#nightPrev', '#nightNext', '#daily', '#endless', '#sound', '#lang', '#menu .kit-home']) assert.ok(await visibleIn(page, id), `320 ${language}: ${id} visible`);
      await cleanWords(page, `320 ${language} menu`, language === 'tr');
      await shot(page, `tiny-${language}`, '1-menu');
      await page.click('#play'); await sleep(800);
      assert.ok(await noOverflow(page), `320 ${language}: play does not scroll`);
      await shot(page, `tiny-${language}`, '2-play');
    }
    // The card's own scroll at the heights where the compact rule (max-height 760px) matters most.
    for (const [w, h] of [[360, 640], [390, 700], [390, 760]]) {
      await page.setViewportSize({ width: w, height: h });
      await seeded(page, { 'ring:v1': OLD, 'ring:nights': '{"v":1,"open":3,"pick":2,"best":[0,0,300]}', 'ring:hint': '1' }, '&from=small', 'tr');
      const over = await page.evaluate(() => { const d = document.querySelector('#menu > div'); return d.scrollHeight - d.clientHeight; });
      assert.ok(over <= 1 && await noOverflow(page), `${w}x${h} tr: the fullest menu does not scroll (${over} px over)`);
      // A new player on these screens still reads the second intro line (mixed colours, moths), and nothing scrolls.
      await seeded(page, { 'ring:hint': '1' }, '&from=small', 'tr');
      const fresh = await page.evaluate(() => { const d = document.querySelector('#menu > div'); return d.scrollHeight - d.clientHeight; });
      assert.ok(await page.isVisible('#menu > div > p:nth-of-type(2)'), `${w}x${h} tr: a new player sees the second intro line`);
      assert.ok(fresh <= 1 && await noOverflow(page), `${w}x${h} tr: the new player's menu does not scroll (${fresh} px over)`);
    }
    assert.deepEqual(test.errors, [], '320: no errors');
    console.log('ok   ring at 320x568 with every menu line, and 360x640, 390x700, 390x760 in Turkish');
  } finally { await test.context.close(); }
}

// Play recording: the notice is on the menu before Play; a played practice level sends one record under 'ring';
// with the switch off in the pause card the next level sends nothing.
async function recording(browser, device, phone) {
  const test = await open(browser, device), { page, lab } = test;
  try {
    await allowLocalSend(test.context);
    await menu(page, '&level=1&labRunSource=agent');
    await assertNotice(page, '#play');
    assert.equal(lab.sent.length, 0, 'nothing is sent before Play');
    await page.click('#play');
    await sleep(1500);
    await playLevel(page, 5, 60000);
    await until(page, () => window.__ring.mode === 'end', 'practice end card', 15000);
    await sleep(600);
    const run = assertRun(lab, 'ring', { outcomes: ['won', 'lost'], summaryKeys: ['kind', 'score', 'cleared'] });
    assert.equal(run.data.summary.kind, 'practice'); assert.ok(run.data.events.some(e => e.type === 'dawn'));
    await page.click('#again');
    await until(page, () => window.__ring.mode === 'play', 'second run');
    await page.click('#pause');
    await assertOffSendsNothing(page, lab, 'ring', { play: async () => { await page.click('#resume'); await sleep(1500); await playLevel(page, 5, 60000); await until(page, () => window.__ring.mode === 'end', 'second end card', 15000); } });
    assert.deepEqual(test.outside, []); assert.deepEqual(test.errors, []);
    console.log(`ok   ring recording on ${phone}`);
  } finally { await test.context.close(); }
}

let failed = 0;
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(a => !a.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch();
    const test = await open(browser, device);
    try { await run(test, phone); console.log(`ok   ring on ${phone} (${device.viewport.width}x${device.viewport.height})`); await turkish(browser, device, phone); await recording(browser, device, phone); await turkishHint(browser, device, phone); await improved(browser, device, phone); await ideas(browser, device, phone); await tiny(browser); if (phone === 'chromium') { await small(browser); await turkishSmall(browser); } }
    catch (e) { failed++; console.error(`FAIL ring on ${phone}: ${e.stack}`); if (test.errors.length) console.error(test.errors.join('\n')); await shot(test.page, phone, 'failure').catch(() => {}); }
    finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`screenshots in ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
