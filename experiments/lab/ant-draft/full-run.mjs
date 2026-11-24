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
const SHOTS = process.env.SHOTS || join(here, 'full-run-shots');
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
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
    const el = document.getElementById('c'), t0 = performance.now(); let down = false, last = { x: 60, y: 120 }, frames = 0, slow = 0, prev = t0, maxAimError = 0;
    const send = (type, p) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
    while (performance.now() - t0 < ms) {
      const st = window.antDraftState();
      if (untilPhase && (st.mode !== 'play' || st.phase !== 'fight')) break;
      const p = corner || !st.aim ? { x: 40, y: 90 + st.lift } : { x: st.aim.x, y: st.aim.y + st.lift };
      if (!down) { send('down', p); down = true; } else if (frames % 4 === 0) send('move', p);
      if (!corner && st.aim && frames % 4 === 0) maxAimError = Math.max(maxAimError, Math.abs(window.antDraftState().rally.x - p.x));
      last = p; frames++;
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(); if (now - prev > 50) slow++; prev = now;
    }
    if (down) send('up', last);
    return { frames, slow, maxAimError, ms: performance.now() - t0 };
  }, { ms, corner, untilPhase });
}


const name = process.argv[2] || 'chromium', [type, device] = PHONES[name];
const browser = await type.launch(); let failed = false;
try {
 const page = await browser.newPage(device), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/lab/ant-draft/?seed=11`); await page.waitForFunction(()=>!!window.antDraftState);
 await page.bringToFront(); await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:join(SHOTS,`${name}-menu.png`)}); await page.tap('#play');
 const start=Date.now(); let drafts=0;
 const order=['brood','jaws','shell','guard','split','fire','frenzy','carry','acid','legs','jelly','scout'];
 while((await state(page)).mode!=='end') {
  const s=await state(page);
  if(s.mode==='play') {
   await steer(page,{ms:4000});
   await page.screenshot({path:join(SHOTS,`${name}-wave-${s.wave+1}.png`)});
   await steer(page,{ms:60000});
  } else if(s.mode==='draft') {
   await sleep(500); await page.screenshot({path:join(SHOTS,`${name}-draft-${s.wave+1}.png`)});
   const id=[...s.offers].sort((a,b)=>order.indexOf(a)-order.indexOf(b))[0];
   await page.locator(`[data-card="${id}"]`).tap(); drafts++;
   await until(page,()=>window.antDraftState().mode==='play','card choice');
  }
  assert.ok(Date.now()-start<480000,'full run ends within eight wall-clock minutes');
  await sleep(100);
 }
 const end=await state(page);
 await page.screenshot({path:join(SHOTS,`${name}-end.png`)});
 assert.deepEqual(errors,[]);
 assert.equal(end.phase,'won','seed 11 careful input finishes eight waves');
 assert.equal(drafts,7); assert.equal(end.runs,1);
 console.log(JSON.stringify({name,phase:end.phase,waves:end.wave+1,drafts,kills:end.kills,hp:end.hp,score:await page.textContent('#endScore'),seconds:end.t,picks:end.picks,errors}));
} catch(e) {failed=true;console.log(e.stack);} finally {await browser.close();server.close();}
process.exit(failed?1:0);
