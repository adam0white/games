// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node check.mjs [webkit|chromium]
// Serves experiments/ (so ../../kit/ resolves), plays with real taps, and mirrors each hand in Node
// with the same rules and bot to check the page's final score.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { deal, play, score, view, rank, isJack, capturesWith, dailySeed } from './sim.js';
import { choose } from './brain.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/claude-504/-Users-abdul-code/e727a231-6be3-4081-a695-31f6b5ca1a96/scratchpad/pisti-shots';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
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
const P = page => page.evaluate(() => {
  const p = window.__pisti;
  return { totals: p.totals, handNo: p.handNo, dealer: p.dealer, matchOver: p.matchOver, screen: p.screen, mode: p.mode, hand: p.hand, pileTop: p.pileTop, pileSize: p.pileSize, scores: p.scores, turn: p.turn, viewer: p.viewer, canPlay: p.canPlay, practice: p.practice, level: p.level, done: p.done, scored: p.scored, ply: p.ply, paused: p.paused, save: p.save, seed: p.seed };
});
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });
async function until(page, fn, label, timeout = 15000, arg = null) {
  try { await page.waitForFunction(fn, arg, { timeout }); }
  catch { throw new Error(`timed out: ${label}; state=${JSON.stringify(await P(page).catch(() => null))}`); }
}

// The scripted player: a pişti if there is one, else any capture by match, else a jack capture, else the first card.
function pick(hand, pileTop, pileSize) {
  if (pileSize === 1) { const p = hand.find(c => !isJack(c) && rank(c) === rank(pileTop)); if (p !== undefined) return p; }
  if (pileSize) {
    const m = hand.find(c => !isJack(c) && rank(c) === rank(pileTop)); if (m !== undefined) return m;
    const j = hand.find(isJack); if (j !== undefined && pileSize >= 3) return j;
  }
  return hand[0];
}
const pickState = s => pick(s.hands[s.turn], s.pile[s.pile.length - 1], s.pile.length);
function mirror(seed, level, dealer = 1) {
  let s = deal(seed, dealer);
  while (!s.done) s = play(s, s.turn === 0 ? pickState(s) : choose(view(s, 1), level));
  return s;
}
// A seed where the scripted player makes a pişti against the easy bot, so the moment can be photographed.
function pistiSeed() {
  for (let seed = 1; ; seed++) {
    const s = mirror(seed, 'easy');
    if (s.log.some(e => e.seat === 0 && e.kind === 'pisti' && e.ply < 40)) return seed;
  }
}

async function open(browser, device) {
  const context = await browser.newContext({ ...device, acceptDownloads: true }), page = await context.newPage();
  const errors = [], external = [];
  await context.route('**/*', route => { const u = route.request().url(); if (!u.startsWith(base)) { external.push(u); return route.abort(); } return route.continue(); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors, external };
}
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1);

// Plays the hand on screen by tapping cards until the score card is complete. Returns the plays made.
async function playHand(page, phone, { shots = false, pistiShot = false, last = false } = {}) {
  let midDone = false, pistiDone = false;
  for (let n = 0; n < 60; n++) {
    await until(page, () => window.__pisti.canPlay || window.__pisti.scored || window.__pisti.screen === 'cover', 'a human turn or the end', 20000);
    let st = await P(page);
    if (st.scored) break;
    if (st.screen === 'cover') { await page.locator('#reveal').tap(); st = await P(page); }
    const card = last ? st.hand[st.hand.length - 1] : pick(st.hand, st.pileTop, st.pileSize);
    if (shots && !midDone && st.ply >= 12) { midDone = true; await shot(page, phone, '2-mid-hand'); }
    const isPisti = st.pileSize === 1 && !isJack(card) && rank(card) === rank(st.pileTop) && st.ply > 0;
    await page.locator(`#hand [data-card="${card}"]`).tap();
    if (pistiShot && isPisti && !pistiDone) {
      pistiDone = true;
      await until(page, () => document.getElementById('shout').classList.contains('on'), 'pişti flame shown', 4000);
      await sleep(300);
      await shot(page, phone, '3-pisti');
    }
    await until(page, ply => window.__pisti.ply > ply || window.__pisti.done, 'the tapped card is played', 6000, st.ply);
  }
  await until(page, () => window.__pisti.scored, 'score card counted', 20000);
  if (pistiShot) assert.ok(pistiDone, 'the scripted seed reached a pişti on screen');
}

async function run(test, phone, seed) {
  const { page } = test;
  await page.goto(`${base}/lab/pisti/?date=${DATE}&speed=4&seed=${seed}`);
  await until(page, () => window.__pisti?.ready, 'page ready');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await until(page, () => window.__pisti?.screen === 'menu', 'menu');
  assert.ok(await page.isVisible('#play'), 'menu shows Play');
  assert.ok(await page.isVisible('#today') && await page.isVisible('#two'), 'menu shows Today’s deal and Two players');
  assert.ok(await noOverflow(page), 'menu has no overflow');
  await shot(page, phone, '1-menu');

  // One full hand, by taps, against the easy bot (a new player's level).
  await page.locator('#play').tap();
  let st = await P(page);
  assert.equal(st.mode, 'play'); assert.equal(st.level, 'easy');
  assert.ok(await noOverflow(page), 'play screen has no overflow');
  const box = await page.locator('#hand').boundingBox(), vp = page.viewportSize();
  assert.ok(box.y >= 0 && box.y + box.height <= vp.height, 'hand is on screen');
  await until(page, () => window.__pisti.canPlay, 'first turn');
  const glow = await page.locator('#hand .card.can').count();
  const first = await P(page);
  const expectGlow = first.hand.filter(c => first.pileSize && (rank(c) === rank(first.pileTop) || isJack(c))).length;
  assert.equal(glow, expectGlow, 'cards that capture now glow for a new player');
  await playHand(page, phone, { shots: true, pistiShot: true });
  st = await P(page);
  const ref = score(mirror(seed, 'easy')).map(x => x.total);
  assert.deepEqual(st.scores, ref, 'page score equals the Node mirror of the same plays');
  assert.equal(await page.locator('#scoreT tr.on').count(), 7, 'score card counts up all six items and the total');
  console.log(`hand ${phone}: seed ${seed}, you ${ref[0]}, bot ${ref[1]}`);
  assert.ok(ref[0] > ref[1], 'the scripted seed is a win for the player');
  assert.equal(st.save.level, 1, 'a won hand raises the bot one level');
  await shot(page, phone, '4-score-card');
  assert.ok(await noOverflow(page), 'score card fits');

  // Pause on page hide during the bot's thinking: exactly one bot card lands after resume.
  await page.locator('#again').tap();
  await until(page, () => window.__pisti.canPlay, 'second hand first turn');
  st = await P(page);
  await page.locator(`#hand [data-card="${st.hand[0]}"]`).tap();
  // Hide the page in the same frame that my card lands, so the bot is still waiting to answer.
  await page.evaluate(ply => new Promise(done => { const look = () => { if (window.__pisti.ply === ply + 1) { dispatchEvent(new Event('pagehide')); done(); } else requestAnimationFrame(look); }; look(); }), st.ply);
  assert.equal((await P(page)).screen, 'paused', 'page hide pauses');
  await sleep(1200);
  assert.equal((await P(page)).ply, st.ply + 1, 'no bot card while paused');
  await shot(page, phone, '5-paused');
  await page.locator('#resume').tap();
  await until(page, ply => window.__pisti.ply === ply + 2 && window.__pisti.canPlay, 'bot answers once after resume', 6000, st.ply);
  await sleep(500);
  assert.equal((await P(page)).ply, st.ply + 2, 'exactly one bot card after resume');
  await page.locator('#pause').tap(); await page.locator('#quit').tap();

  // Match to 51: the totals carry into the next hand and the dealer swaps, so the bot leads hand 2.
  await page.locator('#length button[data-len="51"]').tap();
  await page.locator('#play').tap();
  await playHand(page, phone);
  st = await P(page);
  assert.deepEqual(st.totals, st.scores, 'match totals after hand 1 equal the hand scores');
  assert.equal(st.matchOver, false, 'nobody reaches 51 in one hand here');
  assert.match(await page.textContent('#matchLine'), /Match to 51/);
  assert.equal(await page.textContent('#again'), 'Next hand');
  const carried = st.totals;
  await page.locator('#again').tap();
  await until(page, () => window.__pisti.handNo === 1 && window.__pisti.ply >= 1, 'hand 2 starts with the bot card', 8000);
  st = await P(page);
  assert.equal(st.dealer, 0, 'dealer swaps for hand 2');
  assert.deepEqual(st.totals, carried, 'totals carry into hand 2');
  console.log(`match ${phone}: after hand 1 ${carried.join('-')}, hand 2 led by the bot`);
  await page.locator('#pause').tap(); await page.locator('#quit').tap();
  await page.locator('#length button[data-len="one"]').tap();

  // Today's deal: scored once, then practice, and it survives a reload.
  await page.locator('#today').tap();
  st = await P(page);
  assert.equal(st.mode, 'daily'); assert.equal(st.practice, false); assert.equal(st.level, 'medium');
  await playHand(page, phone);
  assert.ok(await page.isVisible('#daily'), 'daily result shows');
  assert.match(await page.textContent('#dailyNote'), /scored/);
  const dref = score(mirror(dailySeed(DATE), 'medium')).map(x => x.total);
  assert.deepEqual((await P(page)).scores, dref, 'daily score equals the Node mirror of the date seed and the Medium bot');
  const pic = await page.evaluate(() => window.__pisti.picture());
  assert.equal(pic.width, 1080); assert.ok(pic.bytes > 10000, 'picture has PNG data');
  const dl = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await page.locator('#savePic').tap();
  const download = await dl;
  if (download) await download.saveAs(join(SHOTS, `${phone}-saved-${download.suggestedFilename()}`));
  const margin = (await P(page)).save.daily[DATE].margin;
  console.log(`daily ${phone}: you ${dref[0]}, bot ${dref[1]}, margin ${margin}, save picture ${download ? `downloaded ${download.suggestedFilename()}` : 'no download event (share path taken)'}`);
  await shot(page, phone, '6-daily-result');
  await page.locator('#scoreMenu').tap();
  await page.reload();
  await until(page, () => window.__pisti?.screen === 'menu', 'menu after reload');
  st = await P(page);
  assert.ok(st.save.daily[DATE]?.done, 'daily result survives reload');
  assert.ok(st.save.hands >= 2, 'hand count survives reload');
  assert.match(await page.textContent('#todayNote'), /practice/, 'menu marks today as practice');
  await page.locator('#today').tap();
  assert.equal((await P(page)).practice, true, 'second visit is practice');
  assert.ok(await page.isVisible('#practice'), 'practice label shown');
  await playHand(page, phone, { last: true });
  st = await P(page);
  assert.equal(st.save.daily[DATE].margin, margin, 'a practice hand does not change the scored margin');
  assert.notEqual(st.scores[0] - st.scores[1], margin, 'the practice hand had a different result');
  await page.locator('#scoreMenu').tap();

  // Two players on one phone: the cover card between turns.
  await page.locator('#two').tap();
  await until(page, () => window.__pisti.canPlay, 'player 1 turn');
  st = await P(page);
  await page.locator(`#hand [data-card="${st.hand[0]}"]`).tap();
  await until(page, () => window.__pisti.screen === 'cover', 'cover card', 5000);
  assert.match(await page.textContent('#coverWho'), /Player 2/);
  assert.equal(await page.locator('#hand [data-card]').count(), 0, 'no card face shows under the cover');
  await shot(page, phone, '7-cover');
  await page.locator('#reveal').tap();
  st = await P(page);
  assert.equal(st.viewer, 1); assert.equal(st.canPlay, true);
  await page.locator('#pause').tap(); await page.locator('#quit').tap();
  await sleep(200);
  assert.deepEqual(test.external, [], 'no outside requests');
  assert.deepEqual(test.errors, [], 'no page, console or network errors');
}

// Default pace: the bot answers in about 600 ms.
async function pace(browser) {
  const test = await open(browser, devices['Pixel 7']), { page } = test;
  try {
    await page.goto(`${base}/lab/pisti/?seed=7`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    await page.locator('#play').tap();
    await until(page, () => window.__pisti.canPlay, 'turn');
    const st = await P(page);
    const t0 = Date.now();
    await page.locator(`#hand [data-card="${st.hand[0]}"]`).tap();
    await until(page, ply => window.__pisti.ply >= ply + 2, 'bot reply', 5000, st.ply);
    const ms = Date.now() - t0;
    console.log(`pace: tap to bot card landing ${ms} ms`);
    assert.ok(ms > 650 && ms < 2500, 'bot plays at human pace');
  } finally { await test.context.close(); }
}

// Paths the main run skips: drag up to play, quitting the scored daily, and a match played to its end.
async function extras(browser) {
  const test = await open(browser, devices['Pixel 7']), { page } = test;
  const DAY = '2026-11-25';
  try {
    await page.goto(`${base}/lab/pisti/?seed=11&speed=4&date=${DAY}`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    await page.locator('#today').tap();
    await until(page, () => window.__pisti.canPlay, 'daily first turn');
    let st = await P(page);
    const b = await page.locator(`#hand [data-card="${st.hand[0]}"]`).boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - i * 15);
    await page.mouse.up();
    await until(page, ply => window.__pisti.ply > ply, 'a drag up plays the card', 4000, st.ply);
    console.log('drag: a drag up plays the card');
    await page.locator('#pause').tap(); await page.locator('#quit').tap();
    assert.ok((await P(page)).save.daily[DAY]?.started, 'the first card marks the daily attempt as started');
    assert.match(await page.textContent('#todayNote'), /practice/, 'after quitting, today is practice');
    await page.locator('#today').tap();
    assert.equal((await P(page)).practice, true, 'quitting gives no second scored try');
    await playHand(page, 'extras');
    st = await P(page);
    assert.equal(st.save.daily[DAY].margin, undefined, 'no scored margin for an abandoned day');
    assert.equal(await page.isVisible('#savePic'), false, 'Save picture hidden when there is no scored result');
    assert.match(await page.textContent('#dailyNote'), /left unfinished/);
    console.log('daily quit: no second scored try, Save picture hidden');
    await page.locator('#scoreMenu').tap();

    await page.locator('#length button[data-len="51"]').tap();
    await page.locator('#play').tap();
    let hands = 0;
    for (;;) {
      await playHand(page, 'extras'); hands++;
      st = await P(page);
      if (st.matchOver) break;
      assert.ok(hands < 12, 'the match ends');
      await page.locator('#again').tap();
    }
    assert.ok(Math.max(...st.totals) >= 51 && st.totals[0] !== st.totals[1], `match ends at 51 or more, not level ${st.totals}`);
    assert.equal(await page.textContent('#again'), 'Play again');
    assert.match(await page.textContent('#matchLine'), /^Match \d+–\d+$/);
    const final = st.totals;
    await page.locator('#again').tap();
    await until(page, () => window.__pisti.handNo === 0 && window.__pisti.ply <= 1, 'a new match starts', 8000);
    st = await P(page);
    assert.deepEqual(st.totals, [0, 0], 'a new match starts at 0-0');
    console.log(`match end: ${hands} hands, final ${final.join('-')}, Play again starts 0-0`);
    assert.deepEqual(test.errors, [], 'extras: no errors');
    assert.deepEqual(test.external, [], 'extras: no outside requests');
  } finally { await test.context.close(); }
}

// The smallest phone the brief names: 360x640.
async function small(browser, seed) {
  const device = { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const test = await open(browser, device), { page } = test;
  try {
    await page.goto(`${base}/lab/pisti/?seed=${seed}&speed=4&date=${DATE}`);
    await until(page, () => window.__pisti?.screen === 'menu', 'menu');
    const play = await page.locator('#play').boundingBox(), two = await page.locator('#two').boundingBox();
    assert.ok(play.y >= 0 && two.y + two.height <= 640, '360x640: menu buttons visible');
    assert.ok(await noOverflow(page), '360x640: menu no overflow');
    await shot(page, 'small', '1-menu');
    await page.locator('#play').tap();
    await until(page, () => window.__pisti.canPlay, 'turn');
    for (const sel of ['#hand', '#pile', '#oppHand', '#pause']) {
      const b = await page.locator(sel).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 360 && b.y + b.height <= 640, `360x640: ${sel} in view ${JSON.stringify(b)}`);
    }
    const cards = await page.locator('#hand .card').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => [r.left, r.right]));
    assert.ok(cards.every(([l, r]) => l >= 0 && r <= 360), '360x640: all four cards fit across');
    assert.ok(await noOverflow(page), '360x640: no scroll in play');
    await shot(page, 'small', '2-play');
    await playHand(page, 'small');
    await shot(page, 'small', '3-score');
    assert.ok(await noOverflow(page), '360x640: score card fits');
    await page.locator('#scoreMenu').tap();
    await page.locator('#today').tap();
    await playHand(page, 'small');
    const back = await page.locator('#scoreMenu').boundingBox(), save = await page.locator('#savePic').boundingBox();
    assert.ok(back.y >= 0 && back.y + back.height <= 640, `360x640: Menu button in view on the daily result ${JSON.stringify(back)}`);
    assert.ok(save && save.y + save.height <= 640, '360x640: Save picture in view');
    assert.ok(await noOverflow(page), '360x640: daily result fits');
    await shot(page, 'small', '4-daily');
    assert.deepEqual(test.errors, [], '360x640: no errors');
    console.log('ok   pisti on 360x640');
  } finally { await test.context.close(); }
}

let failed = 0;
const seed = pistiSeed();
console.log(`pişti seed ${seed}`);
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(arg => !arg.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch();
    const test = await open(browser, device);
    try {
      await run(test, phone, seed);
      console.log(`ok   pisti on ${phone}`);
      if (phone === 'chromium') { await pace(browser); await small(browser, seed + 1); await extras(browser); console.log('ok   pisti extras on chromium'); }
    } catch (e) { failed++; console.error(`FAIL pisti on ${phone}: ${e.stack}`); if (test.errors.length) console.error(test.errors.join('\n')); await shot(test.page, phone, 'failure').catch(() => {}); }
    finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`screenshots in ${SHOTS}`);
console.log(failed ? `FAILED on ${failed} phone(s)` : 'ALL PASS');
process.exitCode = failed ? 1 : 0;
