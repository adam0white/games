// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node experiments/lab/pitch/check.mjs [webkit|chromium]
// Serves experiments/ (so ../../kit/ resolves) and taps the screen points the page reports; moves are chosen by the rules in Node.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { restore, botTurn, mulberry32, daily, legal, apply, clone } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/claude-504/-Users-abdul-code/e727a231-6be3-4081-a695-31f6b5ca1a96/scratchpad/pitch-shots';
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
const DATE = '2026-11-24', URL_ = `${base}/lab/pitch/?date=${DATE}`;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const P = (page, expr, arg) => page.evaluate(expr, arg);
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });
async function until(page, fn, label, timeout = 15000) {
  try { await page.waitForFunction(fn, null, { timeout }); }
  catch { throw new Error(`timed out: ${label}; state=${JSON.stringify(await P(page, () => window.__pitch && { screen: __pitch.screen, mode: __pitch.mode, canTap: __pitch.canTap, busy: __pitch.busy, turn: __pitch.turn, winner: __pitch.winner }).catch(() => null))}`); }
}
async function open(browser, device) {
  const context = await browser.newContext({ ...device, acceptDownloads: true }), page = await context.newPage();
  const errors = [], outside = [];
  await context.addInitScript(() => {
    window.__shared = [];
    if (navigator.share) navigator.share = async data => { window.__shared.push((data.files || []).length); };
  });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    outside.push(url); return route.abort();
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors, outside };
}
async function tapPoint(page, x, y) {
  const before = await P(page, () => __pitch.segments);
  await page.touchscreen.tap(x, y);
  const drew = () => page.waitForFunction(n => __pitch.segments > n, before, { timeout: 4000 });
  try { await drew(); }
  catch {
    // Some engines give no pointer events for an emulated touch; a mouse click is the same pointer path.
    usedMouse++; console.log(`touch fallback at ${x|0},${y|0} canTap=${await P(page, () => __pitch.canTap)} mode=${await P(page, () => __pitch.mode)} seg=${await P(page, () => __pitch.segments)}`); await page.mouse.click(x, y); await drew();
  }
}
let usedMouse = 0;
async function tapDir(page, d) {
  await until(page, () => __pitch.canTap, 'input open before a tap');
  const t = (await P(page, () => __pitch.legal)).find(m => m.d === d);
  assert.ok(t, `direction ${d} is legal on the page`);
  await tapPoint(page, t.sx, t.sy);
}
async function noOverflow(page, label) {
  assert.ok(await P(page, () => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth), `${label}: no horizontal overflow`);
}
const visibleIn = async (page, sel) => P(page, s => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }, sel);

async function playMatch(page, phone, name, mine = 1) {
  let taps = 0;
  for (let i = 0; i < 600; i++) {
    await until(page, () => __pitch.canTap || __pitch.screen === 'between' || __pitch.screen === 'end', 'my turn or a card', 20000);
    const screen = await P(page, () => __pitch.screen);
    if (screen === 'end') return taps;
    if (screen === 'between') {
      assert.ok(await visibleIn(page, '#next'), 'Next kick-off is on screen');
      if (name) await shot(page, phone, `${name}-between`);
      await page.click('#next'); continue;
    }
    const s = restore(await P(page, () => __pitch.state()));
    const chain = botTurn(s, mine, mulberry32(i + 1));
    await tapDir(page, chain[0]); taps++;
    if (taps === 3 && name) await shot(page, phone, `${name}-mid`);
  }
  throw new Error('match did not end within 600 steps');
}

async function run(test, phone) {
  const { page, errors, outside } = test;
  await page.goto(URL_);
  await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu');
  for (const id of ['#play', '#daily', '#two']) assert.ok(await visibleIn(page, id), `${id} visible on the menu`);
  await noOverflow(page, 'menu');
  await sleep(1500);
  await shot(page, phone, '1-menu');

  // First match: small pitch, Easy bot.
  await page.click('#play');
  await until(page, () => __pitch.mode === 'bot' && __pitch.canTap, 'first match starts on my turn');
  assert.deepEqual(await P(page, () => __pitch.size), { w: 6, h: 8 }, 'first match is on a 6 x 8 pitch');
  assert.equal(await P(page, () => __pitch.level), 0, 'first match is against Easy');
  const legalCount = (await P(page, () => __pitch.legal)).length;
  assert.equal(legalCount, 8, 'eight legal points at kick-off');
  await noOverflow(page, 'play');
  const targets = await P(page, () => __pitch.legal);
  for (const t of targets) assert.ok(t.sx > 10 && t.sx < page.viewportSize().width - 10, 'legal points on screen');

  // Pause on page hide while the bot is to move: nothing is drawn while paused.
  const s0 = restore(await P(page, () => __pitch.state()));
  const nonBounce = legal(s0).find(d => { const t = clone(s0); apply(t, d); return t.turn === 1 && t.winner < 0; });
  await tapDir(page, nonBounce);
  await P(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await P(page, () => __pitch.paused), true, 'page hide pauses');
  assert.ok(await page.isVisible('#paused'), 'pause card shows');
  await shot(page, phone, '2-paused');
  const frozen = await P(page, () => __pitch.segments);
  await sleep(900);
  assert.equal(await P(page, () => __pitch.segments), frozen, 'the bot does not draw while paused');
  await P(page, () => { delete document.hidden; });
  await page.click('#resume');
  await until(page, () => __pitch.canTap || __pitch.screen !== 'play', 'the bot plays after resume');

  const taps = await playMatch(page, phone, '2');
  assert.ok(await page.isVisible('#end'), 'end card');
  await until(page, () => document.querySelector('#pic').naturalWidth > 0, 'picture on the end card');
  for (const id of ['#endTitle', '#pic', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${id} fits on the end card`);
  const result = await P(page, () => ({ score: __pitch.score, save: __pitch.save(), title: document.querySelector('#endTitle').textContent }));
  console.log(`match ${phone}: ${taps} taps, score ${result.score.join('-')}, "${result.title}", next level ${result.save.level}`);
  assert.equal(Math.max(...result.score), 2, 'best of three ends at two goals');
  assert.equal(result.save.played, 1, 'the match is saved');
  await shot(page, phone, '3-end');

  // Save picture: a share with one file where the browser can share files, a PNG download otherwise.
  const download = page.waitForEvent('download', { timeout: 5000 }).then(d => d.suggestedFilename()).catch(() => null);
  await page.click('#savePic');
  const shared = await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 3000 }).then(() => P(page, () => window.__shared[0])).catch(() => 0);
  const file = shared ? null : await download;
  assert.ok(shared === 1 || file === 'paper-pitch.png', `Save picture shares or downloads a PNG (shared ${shared}, file ${file})`);
  console.log(`save picture ${phone}: ${shared ? 'navigator.share with 1 file' : `download ${file}`}`);

  // Rematch is one tap, on the full pitch.
  await page.click('#again');
  await until(page, () => __pitch.mode === 'bot' && __pitch.screen === 'play', 'rematch');
  assert.deepEqual(await P(page, () => __pitch.size), { w: 8, h: 10 }, 'rematch uses the full 8 x 10 pitch');

  // The save survives a reload.
  await page.reload();
  await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu after reload');
  const saved = await P(page, () => __pitch.save());
  assert.equal(saved.played, 1, 'played count survives reload');
  assert.equal(saved.level, result.save.level, 'level survives reload');
  assert.match(await page.textContent('#playSub'), /vs (Easy|Medium|Hard) bot/, 'menu shows the next bot');

  // Today's pitch: one missed attempt, then the solver's chain.
  await page.click('#daily');
  await until(page, () => __pitch.mode === 'daily' && __pitch.canTap, 'daily starts');
  const d = await P(page, () => __pitch.daily);
  assert.equal(d.date, DATE); assert.equal(d.used, 0);
  const puzzle = daily(DATE), pageState = await P(page, () => __pitch.state());
  assert.deepEqual(pageState.log, puzzle.state.log.map(e => e.slice()), 'page and Node generate the same puzzle');
  assert.equal(await page.locator('#tag .dots i').count(), 3, 'three attempt dots');
  await shot(page, phone, '4-daily');
  for (let i = 0; i < 40; i++) {
    const st = await P(page, () => ({ used: __pitch.daily.used, at: __pitch.segments, start: __pitch.daily.attemptStart, canTap: __pitch.canTap }));
    if (st.used === 1 && st.at === st.start && st.canTap) break;
    if (!st.canTap) { await sleep(100); continue; }
    const s = restore(await P(page, () => __pitch.state()));
    const ends = m => { const t = clone(s); apply(t, m); return t.turn === 1 || (t.winner >= 0 && t.how !== 'goal'); };
    const safe = m => { const t = clone(s); apply(t, m); return t.winner < 0; };
    await tapDir(page, legal(s).find(ends) ?? legal(s).find(safe));
  }
  await until(page, () => __pitch.daily.used === 1 && __pitch.canTap && __pitch.segments === __pitch.daily.attemptStart, 'the pitch resets for attempt two');
  assert.equal(await page.locator('#tag .dots i.used').count(), 1, 'one dot used');
  for (const step of puzzle.solution) await tapDir(page, step);
  await until(page, () => __pitch.screen === 'end', 'daily result card');
  const dr = await P(page, () => __pitch.daily);
  assert.equal(dr.solved, true, 'the solver chain scores on the page'); assert.equal(dr.used, 2);
  await until(page, () => document.querySelector('#pic').naturalWidth > 0, 'daily picture');
  assert.ok(await visibleIn(page, '#endMenu'), 'daily card fits');
  assert.equal(await page.isVisible('#again'), false, 'no Rematch on the daily card');
  await shot(page, phone, '5-daily-end');
  await page.reload();
  await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'menu after daily');
  assert.equal(await page.locator('#dailyDots i.won').count(), 1, 'menu shows today solved');
  await page.click('#daily');
  await until(page, () => __pitch.screen === 'end', 'a finished daily reopens to its result');
  await page.click('#endMenu');

  // Two players on one phone: the turn passes and the pill takes the ink colour.
  await page.click('#two');
  await until(page, () => __pitch.mode === 'two' && __pitch.canTap, 'two players');
  const s2 = restore(await P(page, () => __pitch.state()));
  await tapDir(page, legal(s2).find(m => { const t = clone(s2); apply(t, m); return t.turn === 1; }));
  await until(page, () => __pitch.canTap && __pitch.turn === 1, 'red to move');
  assert.match(await page.textContent('#turnText'), /Red/);
  await shot(page, phone, '6-two-players');
  // A drag from the ball toward a legal point draws that line.
  const pick = (await P(page, () => __pitch.legal))[0], before = await P(page, () => __pitch.segments);
  const centre = await P(page, () => { const l = __pitch.legal, n = l.length; return { x: l.reduce((a, m) => a + m.sx, 0) / n, y: l.reduce((a, m) => a + m.sy, 0) / n }; });
  await page.mouse.move(centre.x, centre.y); await page.mouse.down();
  await page.mouse.move(centre.x + (pick.sx - centre.x) * 0.7, centre.y + (pick.sy - centre.y) * 0.7, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(n => __pitch.segments === n + 1, before, { timeout: 4000 });
  const last = (await P(page, () => __pitch.state())).log.at(-1), back = restore(await P(page, () => __pitch.state()));
  const lastTo = { x: last[1] % (back.w + 1), y: Math.floor(last[1] / (back.w + 1)) - 1 };
  assert.deepEqual(lastTo, { x: pick.x, y: pick.y }, 'a drag from the ball draws the line it points at');
  // Two players to the end card: both sides tap, chosen by Medium.
  for (let i = 0; i < 600; i++) {
    await until(page, () => __pitch.canTap || __pitch.screen === 'between' || __pitch.screen === 'end', 'two-player turn or card', 20000);
    const sc = await P(page, () => __pitch.screen);
    if (sc === 'end') break;
    if (sc === 'between') { await page.click('#next'); continue; }
    const st = restore(await P(page, () => __pitch.state()));
    await tapDir(page, botTurn(st, 1, mulberry32(900 + i))[0]);
  }
  assert.match(await page.textContent('#endTitle'), /^(Blue|Red) wins!$/, 'two-player match reaches its end card');
  console.log(`two players ${phone}: ${await page.textContent('#endTitle')} ${(await P(page, () => __pitch.score)).join('-')}`);
  await page.click('#endMenu');

  await noOverflow(page, 'end');
  assert.deepEqual(outside, [], 'no request leaves the local server');
  assert.deepEqual(errors, [], 'no page, console or network errors');
}

async function small(browser, width, height) {
  const test = await open(browser, { viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), { page } = test;
  const tag = `${width}x${height}`;
  try {
    await page.goto(URL_);
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'small menu');
    for (const id of ['#play', '#daily', '#two', '#soundMenu']) assert.ok(await visibleIn(page, id), `small: ${id} visible`);
    await noOverflow(page, 'small menu');
    await shot(page, tag, '1-menu');
    await page.evaluate(d => localStorage.setItem('pitch:v1', JSON.stringify({ played: 3, level: 2, lossStreak: 1, wins: 2, sound: true, daily: { [d]: { used: 2, solved: false } } })), DATE);
    await page.reload();
    await until(page, () => window.__pitch?.ready && __pitch.screen === 'menu', 'small menu again');
    await page.click('#play');
    await until(page, () => __pitch.canTap, 'small play');
    assert.deepEqual(await P(page, () => __pitch.size), { w: 8, h: 10 });
    assert.equal(await P(page, () => __pitch.level), 2, 'a saved Hard level plays Hard');
    const t = await P(page, () => __pitch.legal);
    for (const m of t) assert.ok(m.sx >= 22 && m.sx <= width - 22 && m.sy > 60 && m.sy < height - 40, 'small: targets on screen');
    await noOverflow(page, 'small play');
    await shot(page, tag, '2-play');
    const st = restore(await P(page, () => __pitch.state()));
    const t0 = Date.now();
    await tapDir(page, legal(st).find(m => { const q = clone(st); apply(q, m); return q.turn === 1; }));
    await until(page, () => __pitch.canTap || __pitch.screen !== 'play', 'Hard replies', 20000);
    console.log(`${tag}: Hard replied in ${Date.now() - t0} ms including drawing`);
    await shot(page, tag, '3-after-hard');
    // Lose to Hard on purpose (Easy moves): the second loss in a row drops the level.
    await playMatch(page, tag, null, 0);
    const lost = await P(page, () => ({ title: document.querySelector('#endTitle').textContent, save: __pitch.save(), score: __pitch.score }));
    console.log(`${tag}: played Easy moves against Hard: ${lost.score.join('-')}, "${lost.title}", level now ${lost.save.level}`);
    if (lost.score[1] > lost.score[0]) {
      assert.equal(lost.title, 'The bot wins');
      assert.equal(lost.save.level, 1, 'two losses in a row drop Hard to Medium');
    }
    for (const id of ['#pic', '#again', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${tag}: ${id} fits on the end card`);
    await shot(page, tag, '4-end');
    await page.click('#endMenu');
    // The last daily try: one miss shows the answer in pencil.
    await page.click('#daily');
    await until(page, () => __pitch.mode === 'daily' && __pitch.canTap, 'last daily try');
    for (let i = 0; i < 40 && (await P(page, () => __pitch.screen)) === 'play'; i++) {
      if (!(await P(page, () => __pitch.canTap))) { await sleep(100); continue; }
      const s = restore(await P(page, () => __pitch.state()));
      const ends = m => { const q = clone(s); apply(q, m); return q.turn === 1 || (q.winner >= 0 && q.how !== 'goal'); };
      const safe = m => { const q = clone(s); apply(q, m); return q.winner < 0; };
      await tapDir(page, legal(s).find(ends) ?? legal(s).find(safe));
    }
    await until(page, () => __pitch.screen === 'end', 'three misses end on the answer card');
    assert.match(await page.textContent('#endTitle'), /Here was the way/);
    assert.equal(await page.isVisible('#again'), false, 'no Rematch on the daily card');
    for (const id of ['#pic', '#savePic', '#endMenu']) assert.ok(await visibleIn(page, id), `${tag}: ${id} fits on the daily card`);
    await shot(page, tag, '5-daily-answer');
    assert.deepEqual(test.errors, [], 'small: no errors');
    assert.deepEqual(test.outside, [], 'small: nothing leaves the local server');
  } finally { await test.context.close(); }
}

let failed = 0;
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(a => !a.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch(), test = await open(browser, device);
    try {
      await run(test, phone); console.log(`ok   pitch on ${phone} (${device.viewport.width}x${device.viewport.height})`);
      if (phone === 'chromium') for (const [w, h] of [[360, 640], [390, 844]]) { await small(browser, w, h); console.log(`ok   pitch on chromium ${w}x${h}`); }
    } catch (e) {
      failed++; console.error(`FAIL pitch on ${phone}: ${e.stack}`);
      if (test.errors.length) console.error(test.errors.join('\n'));
      await shot(test.page, phone, 'failure').catch(() => {});
    } finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
if (usedMouse) console.log('note: some taps fell back to mouse clicks');
console.log(`screenshots in ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
