// Run by hand after a deploy: PLAYWRIGHT=<node_modules> node live.mjs. Not part of CI.
// Two real browsers on the live site play a Pişti hand at a friends' table through the deployed Worker.
import { createRequire } from 'node:module';
const require = createRequire((process.env.PLAYWRIGHT ?? process.cwd() + '/node_modules') + '/x.js');
const { webkit, chromium, devices } = require('playwright');
const site = 'https://play.adamwhite.work/lab/pisti/';
const until = (page, fn, what, ms = 30000, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).catch(() => { throw new Error('timed out: ' + what); });
const wk = await webkit.launch(), cr = await chromium.launch();
const a = await (await wk.newContext({ ...devices['iPhone 13'] })).newPage();
const b = await (await cr.newContext({ ...devices['Pixel 7'] })).newPage();
const errors = []; for (const p of [a, b]) p.on('pageerror', e => errors.push(String(e)));
const snap = p => p.evaluate(() => JSON.stringify({ turn: __pisti.turn, top: __pisti.pileTop, size: __pisti.pileSize, scores: __pisti.scores, done: __pisti.done, moves: __pisti.room.moves }));
try {
  await a.goto(site + '?lang=en&labRunSource=agent'); await until(a, () => window.__pisti?.ready, 'A ready');
  await a.locator('#friend').tap(); await a.locator('#friendName').fill('Ada'); await a.locator('#newTable').tap();
  await until(a, () => window.__pisti.room?.status === 'live', 'A at a live table');
  const code = await a.evaluate(() => window.__pisti.room.code);
  console.log('table', code);
  await b.goto(`${site}?room=${code}&lang=en&labRunSource=agent`);
  for (const p of [a, b]) await until(p, () => window.__pisti?.room?.status === 'live' && window.__pisti.screen === 'play', 'seated and playing');
  const pages = (await a.evaluate(() => window.__pisti.room.seat)) === 0 ? [a, b] : [b, a];
  let n = 0;
  const step = async () => {
    const turn = await a.evaluate(() => window.__pisti.turn);
    const p = pages[turn];
    await until(p, () => window.__pisti.canPlay && !window.__pisti.busy, 'mover may play');
    const card = await p.evaluate(() => window.__pisti.hand[0]);
    await p.locator(`#hand [data-card="${card}"]`).tap({ timeout: 30000 }); n++;
    for (const q of [a, b]) await until(q, k => window.__pisti.room.moves >= k && !window.__pisti.busy, 'both have card ' + n, 30000, n);
    const [sa, sb] = [await snap(a), await snap(b)];
    if (sa !== sb) throw new Error(`states differ after card ${n}: ${sa} / ${sb}`);
  };
  for (let i = 0; i < 10; i++) await step();
  console.log('10 cards, states equal');
  await b.reload(); await until(b, k => window.__pisti?.room?.status === 'live' && window.__pisti.room.moves >= k && window.__pisti.screen === 'play', 'B back with the whole hand', 30000, n);
  if ((await snap(a)) !== (await snap(b))) throw new Error('states differ after reload');
  while (!(await a.evaluate(() => window.__pisti.done))) await step();
  console.log(`reload kept the seat; hand finished after ${n} cards, scores ${await a.evaluate(() => window.__pisti.scores.join('-'))} on both`);
  // Deal again: one vote does nothing, two start a new hand.
  const g0 = await a.evaluate(() => window.__pisti.room.game);
  await until(a, () => window.__pisti.screen === 'score', 'A on the score card', 60000); await until(b, () => window.__pisti.screen === 'score', 'B on the score card', 60000);
  await a.locator('#again').tap(); await a.waitForTimeout(4000);
  for (const q of [a, b]) if ((await q.evaluate(() => window.__pisti.room.game)) !== g0) throw new Error('one vote started a new hand');
  await b.locator('#again').tap();
  for (const q of [a, b]) await until(q, g => window.__pisti.room.game === g + 1 && window.__pisti.room.moves === 0 && window.__pisti.screen === 'play', 'new hand on both', 30000, g0);
  n = 0; for (let i = 0; i < 4; i++) await step();
  console.log('deal again: one vote waits, two start a new hand; 4 cards, states equal');
  const c = await (await cr.newContext({ ...devices['Pixel 7'] })).newPage();
  await c.goto(`${site}?room=${code}&lang=en&labRunSource=agent`);
  await until(c, () => /full/i.test(document.body.innerText), 'third page told the table is full');
  console.log('third page: full');
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('LIVE PISTI FRIEND HAND OK');
} finally { await wk.close(); await cr.close(); }
