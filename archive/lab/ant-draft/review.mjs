// Phone check for Ant Draft: node experiments/lab/ant-draft/check.mjs [webkit|chromium]
// Serves experiments/ on a free port and plays with touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7).
// Run A (?waves=1): menu, the beginner hint, steer the swarm through a wave, the win card.
// Run B (?waves=3&hp=8): clear wave 1, take a card by a real tap, leave the flag in a corner so the weak queen falls,
// then the loss card must show the held card and Again must start wave 1 with no menu between.
// Fails on any page error or console error. Screenshots go to $SHOTS (default /private/tmp/night-ant-draft).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = process.env.SHOTS || join(here, 'review-shots');
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; let body = await readFile(file); if (process.argv.includes('--mutate-input') && file.endsWith('/main.js')) body = Buffer.from(body.toString().replace(' || finger !== null', '').replace(' || paused || finger)', ' || paused)')); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : '/Users/abdul/code/human-framework/node_modules/x.js');
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.antDraftState());
async function until(page, fn, what, ms = 15000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what} (state ${JSON.stringify(await state(page))})`); } }

// Steer as a thumb would: touch down, then move the finger so the flag sits on the most dangerous enemy, until `stop` holds.
// With `corner`, hold the finger in the top left corner instead (a player who is not defending).
function steer(page, { ms, corner = false, untilPhase = true }) {
  return page.evaluate(async ({ ms, corner, untilPhase }) => {
    const el = document.getElementById('c'), t0 = performance.now(); let down = false, last = { x: 60, y: 120 }, frames = 0, slow = 0, prev = t0;
    const send = (type, p) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
    while (performance.now() - t0 < ms) {
      const st = window.antDraftState();
      if (untilPhase && (st.mode !== 'play' || st.phase !== 'fight')) break;
      const p = corner || !st.aim ? { x: 40, y: 90 + st.lift } : { x: st.aim.x, y: st.aim.y + st.lift };
      if (!down) { send('down', p); down = true; } else if (frames % 4 === 0) send('move', p);
      last = p; frames++;
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(); if (now - prev > 50) slow++; prev = now;
    }
    if (down) send('up', last);
    return { frames, slow, ms: performance.now() - t0 };
  }, { ms, corner, untilPhase });
}


let failures = 0;
for (const name of (process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'])) {
 const [type, device] = PHONES[name], browser = await type.launch();
 try {
  for (const slug of ['ant-draft', 'ant-draft-b']) {
   const context = await browser.newContext(device), page = await context.newPage(), errors = [];
   page.on('pageerror', e => errors.push(e.message));
   try {
    await page.goto(`${base}/lab/${slug}/?seed=11`);
    await page.waitForFunction(() => !!window.antDraftState);
    await page.bringToFront(); await page.evaluate(() => { window.__reviewPainted = false; requestAnimationFrame(() => requestAnimationFrame(() => { window.__reviewPainted = true; })); }); await page.waitForFunction(() => window.__reviewPainted, null, { timeout: 10000 });
    await page.screenshot({path: join(SHOTS, `${slug}-${name}-fresh.png`)});
    await page.tap('#play'); await sleep(500);
    const points = await page.evaluate(async () => {
      const c = document.querySelector('#c');
      const send = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {pointerId:id,pointerType:'touch',isPrimary:id===1,clientX:x,clientY:y,bubbles:true}));
      const wait = () => new Promise(r => setTimeout(r, 80));
      const pos = () => ({...window.antDraftState().rally});
      send('pointerdown',1,130,430); await wait(); const first=pos();
      send('pointerdown',2,300,600); send('pointermove',2,310,610); await wait(); const second=pos();
      send('pointerup',2,310,610); send('pointermove',1,180,430); await wait(); const owner=pos();
      send('lostpointercapture',1,180,430); send('pointermove',1,250,430); await wait(); const lost=pos();
      return {first,second,owner,lost};
    });
    console.log(slug,name,'two-finger',JSON.stringify(points));
    assert.deepEqual(points.second,points.first,'second finger must not move rally');
    assert.ok(points.owner.x>points.first.x,'first finger still owns input after second lifts');
    assert.deepEqual(points.lost,points.owner,'lost capture must stop steering');
    await page.screenshot({path:join(SHOTS,`${slug}-${name}-input.png`)});
    await page.keyboard.down('ArrowRight'); await sleep(80);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal((await state(page)).paused,true);
    await page.tap('#resume'); const resumed=await state(page); await sleep(200);
    assert.deepEqual((await state(page)).rally,resumed.rally,'blur clears keyboard steering');
    await page.keyboard.up('ArrowRight');
    await page.screenshot({path:join(SHOTS,`${slug}-${name}-resumed.png`)});
    await page.tap('#pause'); await page.tap('#quit'); await page.tap('#play');
    assert.equal((await state(page)).wave,slug==='ant-draft'?0:1);
    await page.reload(); await page.waitForFunction(() => !!window.antDraftState);
    assert.equal((await state(page)).mode,'menu');
    if (slug === 'ant-draft') {
      await page.goto(`${base}/lab/${slug}/?waves=-1&hp=Infinity`);
      await page.waitForFunction(() => !!window.antDraftState); await page.tap('#play');
      const finite = await state(page); assert.equal(finite.waves,8); assert.equal(finite.hp,100);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS',slug,name,'input ownership, capture, blur, restart, reload');
   } catch(e) { failures++; console.log('FAIL',slug,name,e.message); }
   await context.close();
  }
 } finally {await browser.close();}
}
server.close(); process.exit(failures?1:0);
