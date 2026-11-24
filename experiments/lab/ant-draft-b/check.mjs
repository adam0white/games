// Phone check for Ant Draft (lab): PLAYWRIGHT=<dir with playwright> node experiments/lab/ant-draft-b/check.mjs [webkit|chromium]
// Serves experiments/ on a free port and plays on WebKit (iPhone 13) and Chromium (Pixel 7) with touch pointer events
// sent to the canvas, the way a thumb would: hold, move the rally point onto the bug nearest the mound, take a card after
// each wave. Fails on any page or console error. Screenshots go to $SHOTS (default /private/tmp/night-ant-draft-b).
// The full run uses ?speed=6 (the rules step six times per frame) so 8 waves fit in the check; everything else is the real page.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-ant-draft-b';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/lab/ant-draft-b/`;

const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.antDraftState());
async function until(page, fn, what, ms = 15000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }

// A thumb in the page: every frame, hold the finger where the rally point lands on the bug that reaches the mound first.
const THUMB = () => {
  const el = document.getElementById('c'); let down = false; window.__moves = 0;
  const send = (type, x, y) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
  const f = () => {
    if (window.__stopThumb) return;
    requestAnimationFrame(f);
    const s = window.antDraftState();
    if (s.mode !== 'play' || s.paused || s.phase !== 'fight') { if (down) { send('up', 0, 0); down = false; } return; }
    let best = null, bt = Infinity;
    for (const e of s.foes) { const sp = { termite: 30, beetle: 19, wasp: 46, spider: 15 }[e.kind], t = (552 - e.y) / sp + (e.kind === 'wasp' ? 30 : 0); if (t < bt) { bt = t; best = e; } }
    const ax = best ? Math.max(20, Math.min(340, best.x < 0 || best.x > 360 ? best.lane : best.x)) : 180, ay = best ? Math.min(532, Math.max(best.y, 30) + 26) : 472;
    const m = s.map, x = m.ox + ax * m.sc, y = m.oy + ay * m.sc + m.lift;
    if (!down) { send('down', x, y); down = true; } else send('move', x, y);
    window.__moves++;
  };
  requestAnimationFrame(f);
};

async function run(name) {
  const [type, device] = PHONES[name];
  const browser = await type.launch();
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  try {
    // 1. menu, then a first-time player who does not touch: the shared finger hint shows
    await page.goto(base + '?seed=7');
    await until(page, () => window.antDraftState && window.antDraftState().mode === 'menu', 'menu');
    await sleep(300);
    await page.screenshot({ path: join(SHOTS, `${name}-1-menu.png`) });
    const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && (b.offsetWidth < 48 || b.offsetHeight < 48)).map(b => b.id || b.textContent));
    assert.deepEqual(small, [], 'every menu button is at least 48 px');
    await page.click('#play');
    let st = await state(page);
    assert.equal(st.mode, 'play', 'Play starts a run'); assert.equal(st.wave, 1);
    await until(page, () => window.antDraftState().hint, 'the finger hint after 3 s without input', 6000);
    await page.screenshot({ path: join(SHOTS, `${name}-2-hint.png`) });
    // 2. the thumb takes over: the hint goes, the rally point follows the finger
    await page.evaluate(THUMB);
    await sleep(1500);
    st = await state(page);
    assert.ok(!st.hint, 'the hint goes on the first touch');
    assert.ok(Math.abs(st.rally.x - 180) > 1 || Math.abs(st.rally.y - 430) > 1, 'the rally point moved with the finger');
    await page.screenshot({ path: join(SHOTS, `${name}-3-play.png`) });
    // 3. pause freezes the rules; Go on resumes
    await page.click('#pause');
    st = await state(page); assert.equal(st.mode, 'paused');
    await sleep(300); assert.equal((await state(page)).t, st.t, 'time stands still while paused');
    await page.screenshot({ path: join(SHOTS, `${name}-4-paused.png`) });
    await page.click('#resume');
    await until(page, t => window.antDraftState().t > t, 'time moves after resume', 3000, st.t);
    await page.evaluate(() => { window.__stopThumb = true; });

    // 4. a whole run at speed 6: draft a card after every wave, until the end card
    await page.goto(base + '?seed=11&speed=6');
    await until(page, () => window.antDraftState().mode === 'menu', 'menu again');
    await page.click('#play');
    await page.evaluate(THUMB);
    let drafts = 0, shotDraft = false;
    const t0 = Date.now();
    for (;;) {
      st = await state(page);
      if (st.mode === 'end') break;
      if (st.mode === 'draft') {
        await until(page, () => document.querySelectorAll('.pick.in').length === 3 || window.antDraftState().offer.length < 3, 'cards dealt', 3000);
        await sleep(400);
        if (!shotDraft) { shotDraft = true; await page.screenshot({ path: join(SHOTS, `${name}-5-draft.png`) }); }
        const n = await page.locator('.pick').count();
        const before = st.held.length;
        await page.locator('.pick').nth(drafts % n).tap();
        await until(page, k => window.antDraftState().held.length > k, 'card taken', 3000, before);
        drafts++;
        if (drafts === 4) { await sleep(1200); await page.screenshot({ path: join(SHOTS, `${name}-6-later-wave.png`) }); }
      }
      if (Date.now() - t0 > 150000) throw new Error('run did not end in 150 s');
      await sleep(100);
    }
    await sleep(600);
    st = await state(page);
    await page.screenshot({ path: join(SHOTS, `${name}-7-end.png`) });
    const endText = await page.textContent('#end');
    assert.match(endText, /Colony crowned!|Nest fell/, 'end card');
    const handIcons = await page.locator('#endHand canvas').count();
    assert.equal(handIcons, st.held.length, 'the end card shows every card held');
    console.log(`${name}: run ended at wave ${st.wave} (${st.phase}), ${drafts} drafts, held ${st.held.join(' ')}, score ${st.score}`);
    // 5. retry is one tap
    await page.click('#again');
    st = await state(page);
    assert.ok(st.mode === 'play' && st.wave === 1 && st.held.length === 0, 'Retry starts a fresh run at once');
    const best = await page.evaluate(() => JSON.parse(localStorage.getItem('ant-draft-b:save')).best);
    assert.ok(best > 0, 'best score saved');
    assert.deepEqual(errors, [], 'no page or console errors');
    console.log(`${name}: ok`);
  } finally { await browser.close(); }
  return errors;
}

const which = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
let failed = false;
for (const name of which) { try { await run(name); } catch (e) { failed = true; console.log(`${name}: FAIL ${e.message}`); } }
server.close();
process.exit(failed ? 1 : 0);
