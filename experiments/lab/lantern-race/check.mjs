// Full-night phone acceptance. The local server serves experiments/, plus this contract-only room mock.
// No Lantern state is changed: the driver imports the same policy used in the Node checks and sends touch PointerEvents.
// Usage: node experiments/lab/lantern-race/check.mjs [webkit|chromium] [--smoke]
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = '/private/tmp/night-r3-race';
const started = performance.now();
let stage = 'setup';
function progress(label) { stage = label; console.log(label); }
const watchdog = setTimeout(() => {
  writeSync(2, `FAIL Lantern Race exceeded 285s during ${stage}\n`);
  process.exit(1);
}, 285000);
async function within(label, promise, ms = 12000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(`${label} timed out after ${ms / 1000}s`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}
progress('Lantern Race: preparing local test server');
await within('create screenshot directory', mkdir(SHOTS, { recursive: true }));
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules')), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json' };
async function startMock() {
  const rooms = new Map(), sockets = new Set(), protocol = { errors:[], maxBytes:0, maxRate:0, positions:0, done:0, rounds:0, quorum:0, deadlines:[] };
  const server = createServer(async (req,res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/notes/button.js') { res.writeHead(200, {'content-type':'text/javascript'}); res.end(''); return; }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    let path;
    try { path = normalize(join(root, decodeURIComponent(url.pathname))); if (url.pathname.endsWith('/')) path = join(path, 'index.html'); if (!path.startsWith(root + '/')) throw Error('path'); const body = await within('read static test asset', readFile(path)); res.writeHead(200, {'content-type':mime[extname(path)] || 'application/octet-stream', 'cache-control':'no-store'}); res.end(body); }
    catch { res.writeHead(404); res.end('not found'); }
  });
  // A minimal RFC6455 text transport, keeping the test free of npm dependencies. Browser clients mask their frames.
  function frame(socket, payload, opcode=1) {
    if (socket.destroyed) return;
    const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
    const head = bytes.length < 126 ? Buffer.from([0x80|opcode,bytes.length]) : Buffer.from([0x80|opcode,126,bytes.length>>>8,bytes.length&255]);
    socket.write(Buffer.concat([head,bytes]));
  }
  const send = (c,m) => frame(c.socket,m);
  const close = (c,code=1000) => { const b=Buffer.alloc(2); b.writeUInt16BE(code); frame(c.socket,b,8); c.socket.end(); };
  const broadcast = (room,m,except) => { for (const c of room.clients.values()) if(c!==except) send(c,m); };
  function clearRound(room, now) {
    if (room.round && (now - room.round.start > 150000 || [...room.clients.values()].every(c => !c.inRound || c.finishedRound))) {
      room.round = null;
      for (const c of room.clients.values()) c.inRound = false;
    }
  }
  function startRound(room, now) {
    if (room.round || !room.readyAt) return;
    const racers = [...room.clients.values()].filter(c => c.ready);
    const quorum = racers.length === room.clients.size;
    if (racers.length && (quorum || now >= room.readyAt + 8000)) {
      room.round = { seed: 3, start: now + 4000 };
      protocol.rounds++;
      if (quorum) protocol.quorum++;
      else protocol.deadlines.push(now - room.readyAt);
      clearTimeout(room.alarm); room.readyAt = 0;
      for (const c of room.clients.values()) {
        c.inRound = c.ready; c.ready = false; c.finishedRound = false;
      }
      for (const c of racers) {
        send(c, { t: 'roster', ids: racers.map(racer => racer.id) });
        send(c, { t: 'round', ...room.round });
      }
    }
  }
  function packet(c,raw) {
    const len = Buffer.byteLength(raw); protocol.maxBytes=Math.max(protocol.maxBytes,len);
    if (len>200) { protocol.errors.push(`client frame ${len} bytes`); close(c,1009); return; }
    const now=Date.now(); c.times=c.times.filter(t=>now-t<1000); c.times.push(now); protocol.maxRate=Math.max(protocol.maxRate,c.times.length);
    if(c.times.length>12) { protocol.errors.push(`client exceeded 12 messages/s (${c.times.length})`); close(c,1008); return; }
    let m; try {m=JSON.parse(raw);}catch{protocol.errors.push('invalid JSON');return close(c,1008);}
    if (m.t==='hi') {
      assert.equal(typeof m.n,'string'); assert.ok(Array.from(m.n).length<=16); c.n=m.n;
      broadcast(c.room,{t:'join',id:c.id,n:c.n},c);
    } else if(m.t==='ready') {
      const room = c.room;
      clearRound(room, now); startRound(room, now);
      if (room.round || c.ready) return;
      c.ready = true;
      if (!room.readyAt) {
        room.readyAt = now;
        room.alarm = setTimeout(() => startRound(room, Date.now()), 8000);
      }
      startRound(room, now);
    } else if(m.t==='p') {
      if(!(Number.isFinite(m.x)&&m.x>=-1&&m.x<=1&&Number.isFinite(m.d)&&m.d>=0&&m.d<=100000&&(m.a===0||m.a===1))) {protocol.errors.push('invalid p');return close(c,1008);}
      if (c.room.round && !c.inRound) { protocol.errors.push('spectator sent progress'); return; }
      protocol.positions++; c.pCount++; broadcast(c.room,{...m,id:c.id},c);
    } else if(m.t==='done') {
      if(!(Number.isInteger(m.s)&&m.s>=0&&m.s<=1000000)){protocol.errors.push('invalid done');return close(c,1008);}
      if (c.room.round && !c.inRound) { protocol.errors.push('spectator sent done'); return; }
      protocol.done++; c.done++; if(c.inRound)c.finishedRound=true; clearRound(c.room, now); broadcast(c.room,{t:'done',id:c.id,s:m.s});
    } else {protocol.errors.push('unknown client packet');close(c,1008);}
  }
  server.on('upgrade',(req,socket,head)=>{
    if(req.url.endsWith('/LOST')){socket.end('HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n');return;}
    const match=req.url.match(/^\/lab-api\/room\/lantern-race\/(open|[A-Z]{4})$/); if(!match){socket.end('HTTP/1.1 404 Not Found\r\n\r\n');return;}
    const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sockets.add(socket); socket.on('error',()=>{}); socket.once('close', () => sockets.delete(socket));
    if(match[1]==='FAIL'){close({socket},1011);return;}
    let room=rooms.get(match[1]); if(!room){room={clients:new Map(),round:null,readyAt:0,alarm:null};rooms.set(match[1],room);}
    const now = Date.now(); clearRound(room, now); startRound(room, now);
    const id=[1,2,3,4,5,6,7,8].find(n=>!room.clients.has(n)); const c={socket,room,id,n:'Boat',ready:false,times:[],pCount:0,done:0,inRound:false,finishedRound:false};
    if(!id){close(c,4001);return;} room.clients.set(id,c);send(c,{t:'you',id,peers:[...room.clients.values()].filter(p=>p!==c).map(({id,n})=>({id,n})),round:room.round});broadcast(room,{t:'join',id,n:c.n},c);
    let buf=Buffer.from(head);
    const consume=()=>{while(buf.length>=2){const op=buf[0]&15, masked=!!(buf[1]&128);let len=buf[1]&127,off=2;if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4;}else if(len===127){close(c,1009);return;}if(!masked){close(c,1002);return;}if(buf.length<off+4+len)return;const key=buf.subarray(off,off+4);off+=4;const data=Buffer.from(buf.subarray(off,off+len));buf=buf.subarray(off+len);for(let i=0;i<data.length;i++)data[i]^=key[i%4];if(op===8){close(c);return;}if(op===9){frame(socket,data,10);continue;}if(op!==1){close(c,1003);return;}try{packet(c,data.toString());}catch(e){protocol.errors.push(e.message);close(c,1008);}}};
    socket.on('data',b=>{buf=Buffer.concat([buf,b]);consume();});
    socket.on('close',()=>{
      room.clients.delete(id); const now = Date.now(); clearRound(room, now);
      broadcast(room,{t:'leave',id});
      if (![...room.clients.values()].some(p => p.ready)) { clearTimeout(room.alarm); room.readyAt = 0; }
      startRound(room, now);
      if(!room.clients.size)rooms.delete(match[1]);
    });consume();
  });
  await within('local server listen', new Promise((done, fail) => {
    server.once('error', fail); server.listen(0, '127.0.0.1', done);
  }));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    rooms,
    protocol,
    async close() {
      for (const room of rooms.values()) clearTimeout(room.alarm);
      for (const socket of sockets) socket.destroy();
      await within('close local server', new Promise((done, fail) => server.close(error => error ? fail(error) : done())), 5000);
    },
  };
}
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const evalPage = (page, label, fn) => within(label, page.evaluate(fn));
const state = page => evalPage(page, 'read race state', () => window.raceState());
const shot = (page, file) => within(`screenshot ${file}`, page.screenshot({ path: join(SHOTS, `${file}.png`), timeout: 15000, scale: 'css' }), 16000);
const boxOf = (page, selector) => within('measure ' + selector, page.locator(selector).boundingBox());
const closeContext = context => within('close browser context', context.close(), 6000);
const closeBrowser = browser => within('close browser', browser.close(), 8000);
async function until(page,fn,label,timeout=12000,arg){
  try { await within(label, page.waitForFunction(fn, arg, { timeout }), timeout + 500); }
  catch (cause) { throw Error(`timed out waiting for ${label}`, { cause }); }
}
async function open(browser, device, mock) {
  const context = await within('create browser context', browser.newContext({ ...device }));
  context.setDefaultTimeout(12000); context.setDefaultNavigationTimeout(12000);
  const page = await within('create browser page', context.newPage()), errors = [];
  page.on('pageerror',e=>errors.push(`page: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
  page.on('requestfailed',r=>errors.push(`request: ${r.url()} ${r.failure()?.errorText}`));page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);});
  return { context, page, errors, base: mock.base };
}
async function prepareMenu(p,phone,label,url=''){
  await p.page.goto(`${p.base}/lab/lantern-race/${url}`);await until(p.page,()=>window.raceState?.().phase==='menu','menu');
  await p.page.locator('#name').fill(label);
  await evalPage(p.page, 'blur boat name', () => document.querySelector('#name').blur());
  assert.ok(await evalPage(p.page, 'check horizontal overflow', () => document.documentElement.scrollWidth <= innerWidth),'no horizontal overflow');
  const targets=await boxOf(p.page, '#quick');assert.ok(targets.width>=48&&targets.height>=48,'Quick race target at least 48px');
  await sleep(300); await shot(p.page, `${phone}-${label}-menu`);
}
async function enterLobby(p) {
  await p.page.locator('#quick').click();await until(p.page,()=>window.raceState().phase==='lobby','lobby');
}
async function menu(p, phone, label, url) {
  await prepareMenu(p, phone, label, url);
  await enterLobby(p);
}
async function pilot(page){
  await evalPage(page, 'start synthetic touch pilot', async () => {
    const {botControl}=await import('./sim.js');const policy={skill:2,id:0,next:0};let running=true,anchor=null;window.__stopPilot=()=>{running=false;};window.__pilotEvents=0;
    const el=document.querySelector('#c');
    const send=(type,x,y)=>{el.dispatchEvent(new PointerEvent(`pointer${type}`,{pointerId:17,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,pressure:type==='up'?0:.5,bubbles:true,cancelable:true}));window.__pilotEvents++;};
    const step=()=>{
      if(!running)return;
      const s=window.raceState();if(s.t<(policy.seen??0)){policy.next=0;policy.target=undefined;}policy.seen=s.t;
      if(s.phase==='race'&&s.river&&!s.over){const x=innerWidth*.5,y=innerHeight*.78,target=botControl(s.river,policy);if(!anchor){anchor={from:s.river.x,x,y};send('down',x,y);}send('move',anchor.x+(target-anchor.from)*s.unit/1.3,anchor.y);}else if(anchor){send('up',anchor.x,anchor.y);anchor=null;}
      requestAnimationFrame(step);
    };requestAnimationFrame(step);
  });
}
async function finish(p, phone, label, full = true) {
  return within(`${phone} ${label} race finish`, collectFinish(p, phone, label, full), 150000);
}
async function collectFinish(p,phone,label,full){
  let mid=false,lastReport=0;
  for(;;){const s=await state(p.page);if(s.phase==='end')break;
    assert.ok(s.phase!=='paused',`${label} did not pause while racing`);
    if(!mid&&s.phase==='race'&&s.d>10000){await shot(p.page, `${phone}-${label}-mid`);mid=true;}
    if(Date.now()-lastReport>15000){console.log(`     ${phone} ${label}: ${s.phase}, ${(s.t||0).toFixed(1)}s, distance ${Math.round(s.d||0)}`);lastReport=Date.now();}
    await sleep(500);
  }
  const s=await state(p.page); await sleep(300); await shot(p.page, `${phone}-${label}-end`);
  assert.ok(await within('inspect results visibility', p.page.locator('#end').isVisible()),'end card visible');assert.ok(await within('inspect rematch visibility', p.page.locator('#rematch').isVisible()),'one-tap Rematch visible');
  assert.ok(await evalPage(p.page, 'read touch pilot event count', () => window.__pilotEvents)>30,'played by real touch pointer events');
  if(full){assert.equal(s.over,'dawn',`${label} completed the full Lantern night`);assert.ok(s.d>=99900,`${label} reached dawn distance`);assert.ok(mid,'mid-race screenshot captured');}
  assert.ok(s.results.length>=2,'results rank multiple boats');assert.ok(s.best>0,'best saved');return s;
}
async function layoutSmoke(browser, device, label, mock) {
  const p = await open(browser, device, mock);
  try {
    await menu(p, label, 'layout', '?room=FAIL');
    await until(p.page, () => window.raceState().offline, 'layout offline');
    const ready = await boxOf(p.page, '#ready');
    assert.ok(ready.width >= 48 && ready.height >= 48, 'Ready target at least 48px');
    await shot(p.page, label + '-lobby');
    await p.page.locator('#ready').click();
    await phaseIs(p.page, 'race', 'layout race');

    const { target: before, unit } = await state(p.page);
    const { width, height } = device.viewport;
    const mouseX = (width - unit) / 2 + (before + (before > .5 ? -.08 : .08)) * unit;
    await within('layout mouse drag', mouseDrag(p.page, width * .5, height * .75, mouseX));
    assert.ok(Math.abs((await state(p.page)).target - before) > .03, 'mouse steers');
    await shot(p.page, label + '-race');
    await p.page.locator('#pause').click();
    const card = await boxOf(p.page, '#paused .card');
    assert.ok(card.y >= 0 && card.y + card.height <= height, 'pause card fits');
    await sleep(300);
    await shot(p.page, label + '-pause');
    assert.ok(await evalPage(p.page, 'check horizontal overflow', () => document.documentElement.scrollWidth <= innerWidth), 'layout no horizontal overflow');
    assert.deepEqual(p.errors, [], label + ' errors');
  } finally { await closeContext(p.context); }
}
async function friendsSmoke(browser, device, phone, mock) {
  const p=await open(browser, device, mock);try{await p.page.goto(`${p.base}/lab/lantern-race/`);await until(p.page,()=>window.raceState?.().phase==='menu','friends menu');await p.page.locator('#friends').click();await p.page.locator('#code').fill('1');await p.page.locator('#join').click();assert.match(await p.page.locator('#codeError').textContent(),/four letters/i,'invalid room explains format');await p.page.locator('#code').fill('abcd');await p.page.locator('#join').click();await until(p.page,()=>window.raceState().phase==='lobby','friend lobby');assert.equal((await state(p.page)).room,'ABCD','lowercase room normalized');assert.equal(await p.page.locator('#roomTitle').textContent(),'ABCD');await p.page.locator('#share').click();await sleep(300);assert.match(await p.page.locator('#shareStatus').textContent(),/copied|room=ABCD/i,'share copies or gives room link');await shot(p.page, `${phone}-friends`);await p.page.locator('#lobby .toMenu').click();await p.page.locator('#friends').click();await p.page.locator('#create').click();await until(p.page,()=>window.raceState().phase==='lobby','created room lobby');assert.match((await state(p.page)).room,/^[A-Z]{4}$/,'created four-letter room');assert.deepEqual(p.errors,[],`${phone} friend flow errors`);
  }finally{await closeContext(p.context);}
}
async function mouseDrag(page, from, y, to) {
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(to, y);
  await page.mouse.up();
}
async function trustedSteer(p, phone) {
  const box = await boxOf(p.page, '#c'), x = box.width / 2, y = box.height * .75;
  if (phone === 'chromium') {
    const cdp = await within('open CDP touch session', p.context.newCDPSession(p.page));
    await within('trusted Chromium touch drag', (async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    })());
  } else {
    await within('trusted WebKit touch', p.page.touchscreen.tap(x, y));
    await within('trusted WebKit mouse drag', mouseDrag(p.page, x, y, x + 60));
  }
}
const phaseIs = (page, phase, label, timeout) => until(page, phase => window.raceState?.().phase === phase, label, timeout, phase);
const peerCount = (page, count) => until(page, count => window.raceState().peers.length === count, count + ' room sockets', 12000, count);
async function observeCountdown(page, label) {
  await phaseIs(page, 'countdown', label);
  await until(page, () => /^[1-6]$/.test(document.querySelector('#countNumber').textContent), 'visible numerical countdown');
  assert.ok(await within('inspect race countdown visibility', page.locator('#count').isVisible()), 'race countdown shows on screen');
}
async function readyPair(a, b, selector, phone, protocol) {
  const prior = protocol.quorum;
  await a.page.locator(selector).click();
  await until(a.page, () => /Ready sent.*up to [1-8]s/.test(document.querySelector('#lobbyLine').textContent), 'local Ready and waiting countdown');
  assert.match(await a.page.locator('#peers .me').textContent(), /Ready sent/);
  assert.equal((await state(b.page)).phase, selector === '#rematch' ? 'end' : 'lobby', 'one Ready leaves the other socket waiting');
  assert.equal(protocol.quorum, prior, 'one Ready does not start the room');
  if (selector === '#ready') await shot(a.page, phone + '-ready');
  await b.page.locator(selector).click();
  await Promise.all([observeCountdown(a.page, 'first racer countdown'), observeCountdown(b.page, 'second racer countdown')]);
  assert.equal(protocol.quorum, prior + 1, 'everyone ready starts the room immediately');
}
async function readinessSmoke(browser, device, phone, mock) {
  const { rooms, protocol } = mock;
  const pages = [];
  try {
    const a = await open(browser, device, mock); pages.push(a); await menu(a, phone, 'Spruce');
    const b = await open(browser, device, mock); pages.push(b); await menu(b, phone, 'Flare');
    const idle = await open(browser, device, mock); pages.push(idle); await menu(idle, phone, 'Shoal');
    const late = await open(browser, device, mock); pages.push(late);
    await prepareMenu(late, phone, 'Wake');
    await peerCount(a.page, 3); await peerCount(b.page, 3);
    await pilot(a.page); await pilot(b.page);
    const prior = protocol.deadlines.length;
    await a.page.locator('#ready').click(); await b.page.locator('#ready').click();
    await observeCountdown(a.page, '8s readiness deadline');
    assert.equal(protocol.deadlines.length, prior + 1);
    assert.ok(protocol.deadlines.at(-1) >= 8000, 'deadline does not fire early');
    assert.equal((await state(idle.page)).phase, 'lobby', 'unready socket stays in lobby');
    assert.match(await a.page.locator('#countRoster').textContent(), /Spruce.*Flare/);
    assert.doesNotMatch(await a.page.locator('#countRoster').textContent(), /Shoal/);
    // Join during the race countdown. The welcome reports its start but the late socket is ineligible.
    await enterLobby(late);
    await until(late.page, () => /Watching · starts in [1-6]s/.test(document.querySelector('#lobbyLine').textContent), 'spectator countdown');
    await shot(late.page, phone + '-watch-countdown');
    await late.page.locator('#ready').click();
    await phaseIs(a.page, 'race', 'deadline race');
    await until(idle.page, () => /% to dawn/.test(document.querySelector('#peers').textContent), 'idle spectator receives progress');
    await until(late.page, () => /% to dawn/.test(document.querySelector('#peers').textContent), 'late spectator receives progress');
    assert.equal((await state(late.page)).t, 0, 'spectating does not start a partial river');
    assert.equal((await state(late.page)).sent.p, 0, 'spectators do not publish');
    assert.equal((await state(a.page)).results.length, 2, 'only ready racers have places');
    await shot(late.page, phone + '-watch');

    const first = await state(a.page), departing = await state(b.page);
    const room = rooms.get('open');
    // Abruptly remove a racer so the browser has no opportunity to send a retirement result first.
    room.clients.get(departing.id).socket.destroy();
    await until(a.page, () => window.raceState().ghosts.some(g => g.bot), 'departed racer gets a replacement ghost');
    const replaced = await state(a.page);
    assert.deepEqual(replaced.ghosts.map(g => g.id), [departing.id], 'one departure produces one replacement');
    assert.equal(replaced.results.length, 2, 'replacement uses the same place in the race');
    assert.ok(replaced.ghosts[0].d > 0, 'replacement kept the same elapsed river');
    assert.equal(replaced.seed, first.seed);
    await shot(a.page, phone + '-replacement');

    const newcomer = await open(browser, device, mock);
    try {
      await menu(newcomer, phone, 'Mist');
      await until(newcomer.page, id => window.raceState().id === id, 'departed socket ID reused', 12000, departing.id);
      assert.match((await state(a.page)).results.find(p => p.id === departing.id).n, /Flare · bot/, 'replacement keeps the original racer identity');
      // A retired last racer clears the room. The queued spectator can now be admitted on a retry.
      await within('retire last racer', a.page.keyboard.press('p'));
      await phaseIs(a.page, 'end', 'last racer results');
      await until(a.page, () => window.raceState().received.done > 0, 'server acknowledges retirement');
      assert.equal(await within('count result rows', a.page.locator('#rankList .rank').count()), 2, 'result card excludes idle and late sockets');
      assert.equal(room.round, null, 'last connected racer finishing clears the room');
      await a.page.locator('#rematch').click();
      await idle.page.locator('#ready').click();
      await newcomer.page.locator('#ready').click();
      await observeCountdown(late.page, 'queued spectator joins the next round');
      assert.equal((await state(late.page)).results.length, 4, 'next roster includes all four ready sockets');
      assert.deepEqual(newcomer.errors, [], 'reused socket errors');
    } finally { await closeContext(newcomer.context); }
    for (const p of [a, idle, late]) assert.deepEqual(p.errors, [], phone + ' readiness flow errors');
    await until(b.page, () => window.raceState().offline, 'departing racer sees the socket loss');
    const abruptDiagnostic = `console: WebSocket connection to '${mock.base.replace('http:', 'ws:')}/lab-api/room/lantern-race/open' failed: The network connection was lost.`;
    assert.deepEqual(b.errors, phone === 'webkit' ? [abruptDiagnostic] : [], 'only the departing socket may log the induced network loss');
    console.log('     ' + phone + ': deadline ' + protocol.deadlines.at(-1) + 'ms, 2 racers, 1 replacement, 4 next-round racers, ' + b.errors.length + ' abrupt-close diagnostic(s)');
  } finally {
    await Promise.all(pages.map(p => closeContext(p.context)));
  }
}
async function run(browser, device, phone, all, mock) {
  progress(phone + ': opening race lobbies');
  const a = await open(browser, device, mock); all.push(a); await menu(a, phone, 'Reed');
  const b = await open(browser, device, mock); all.push(b); await menu(b, phone, 'Glow');
  const offline = await open(browser, device, mock); all.push(offline); await menu(offline, phone, 'Solo', '?room=FAIL');
  await peerCount(a.page, 2); await peerCount(b.page, 2);
  await pilot(a.page); await pilot(b.page);
  await readyPair(a, b, '#ready', phone, mock.protocol);
  const [initialA, initialB] = await Promise.all([state(a.page), state(b.page)]);
  assert.equal(initialA.seed, initialB.seed, 'same server seed');
  assert.equal(initialA.seed, 3, 'server seed accepted');
  assert.equal(initialA.night, initialB.night, 'same night');
  assert.match(await a.page.locator('#countRoster').textContent(), /Reed.*Glow/);
  await shot(a.page, phone + '-countdown');
  // Successful upgrade followed by an error close tests offline recovery without ignoring browser errors.
  await pilot(offline.page);
  await until(offline.page, () => window.raceState().offline, 'offline fallback');
  await offline.page.locator('#ready').click();
  await phaseIs(offline.page, 'race', 'offline race starts');
  await offline.page.locator('#pause').click();
  const frozen = await state(offline.page);
  assert.equal(frozen.phase, 'paused', 'offline pause card');
  await sleep(400);
  assert.equal((await state(offline.page)).t, frozen.t, 'offline sim freezes');
  await within('resume offline with P', offline.page.keyboard.press('p'));
  assert.equal((await state(offline.page)).phase, 'race', 'P resumes offline');
  assert.equal((await state(offline.page)).ghosts.length, 3, 'three local bot ghosts');
  progress(phone + ': playing the full river on two connected pages and one offline page');
  const [endA, endB, endSolo] = await Promise.all([
    finish(a, phone, 'Reed'), finish(b, phone, 'Glow'), finish(offline, phone, 'offline', false),
  ]);
  await Promise.all([a, b].map(p => until(p.page, () => {
    const s = window.raceState();
    return s.results.some(result => result.id !== s.id && Number.isInteger(result.s));
  }, 'other racer has a terminal time')));
  const [doneA, doneB] = await Promise.all([state(a.page), state(b.page)]);
  for (const [label, s] of [['Reed', doneA], ['Glow', doneB]]) {
    assert.ok(s.received.p > 0, label + ' received remote progress');
    assert.ok(s.received.done > 0, label + ' received remote finish');
    assert.ok(s.sent.p >= 100, label + ' sent frequent progress');
    assert.equal(s.results.length, 2, label + ' ranks two humans');
  }
  await until(offline.page, () => window.raceState().ghosts.every(g => !g.a), 'all bots reach terminal results', 150000);
  assert.doesNotMatch(await offline.page.locator('#endLine').textContent(), /still racing/, 'final offline results settle');
  assert.equal(endA.seed, endB.seed); assert.ok(endSolo.offline);
  assert.ok(await within('inspect offline note', offline.page.getByText('offline', { exact: false }).first().isVisible()));
  progress(phone + ': checking missing endpoint, rematch and trusted input');
  const absent = await open(browser, device, mock);
  try {
    await absent.page.goto(mock.base + '/lab/lantern-race/?room=LOST');
    await phaseIs(absent.page, 'menu', 'absent-server menu');
    await absent.page.locator('#quick').click();
    await until(absent.page, () => window.raceState().offline, 'absent-server fallback');
    assert.ok(absent.errors.every(e => e.startsWith('console:') && /WebSocket|websocket|404|connection/i.test(e)), 'only expected socket diagnostics: ' + absent.errors.join('; '));
    console.log('     ' + phone + ': HTTP 404 upgrade recovered offline, ' + absent.errors.length + ' browser diagnostic(s)');
  } finally { await closeContext(absent.context); }
  await readyPair(a, b, '#rematch', phone, mock.protocol);
  await phaseIs(a.page, 'race', 'online rematch starts');

  await evalPage(offline.page, 'stop synthetic touch pilot', () => window.__stopPilot());
  await offline.page.locator('#rematch').click();
  await phaseIs(offline.page, 'race', 'offline trusted-input round');
  const before = (await state(offline.page)).target;
  await trustedSteer(offline, phone);
  assert.ok(Math.abs((await state(offline.page)).target - before) > .03, 'trusted browser input steers');

  await a.page.reload(); await phaseIs(a.page, 'menu', 'reload');
  assert.ok((await state(a.page)).best >= endA.best, 'best survives reload');
  assert.equal(await a.page.locator('#name').inputValue(), 'Reed', 'boat name survives reload');
  for (const p of all) assert.deepEqual(p.errors, [], phone + ': zero page, console and network errors');
  await Promise.all(all.map(p => closeContext(p.context)));
  console.log('ok   ' + phone + ': two dawn finishes (' + endA.t.toFixed(2) + '/' + endB.t.toFixed(2) + 's), '
    + doneA.received.p + '/' + doneB.received.p + ' remote positions, zero unexpected browser errors');
}
async function checkPhone(phone, engine, device, smoke, mock) {
  const all = [];
  progress(phone + ': launching browser');
  const browser = await within(phone + ' launch', engine.launch({ timeout: 20000 }), 21000);
  try {
    if (!smoke) await run(browser, device, phone, all, mock);
    progress(phone + ': checking friend rooms and readiness deadline');
    await friendsSmoke(browser, device, phone, mock);
    await readinessSmoke(browser, device, phone, mock);
    if (phone === 'chromium') {
      progress(phone + ': checking small and desktop layouts');
      await layoutSmoke(browser, { ...device, viewport: { width: 360, height: 640 } }, 'small-360', mock);
      await layoutSmoke(browser, { viewport: { width: 1280, height: 800 } }, 'desktop', mock);
    }
    console.log('ok   ' + phone + ': friends, deadline, spectators and replacement checks');
  } catch (error) {
    console.error('FAIL ' + phone + ': ' + error.stack);
    await Promise.all(all.filter(p => !p.page.isClosed()).map(async (p, i) => {
      if (p.errors.length) console.error(phone + '/' + i + ': ' + p.errors.join('; '));
      try { await within('failure screenshot', shot(p.page, phone + '-FAIL-' + i), 3000); } catch {}
    }));
    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
async function verify(phone, engine, device, smoke) {
  const mock = await startMock();
  try {
    await checkPhone(phone, engine, device, smoke, mock);
    const { protocol } = mock;
    assert.deepEqual(protocol.errors, [], 'mock protocol errors');
    assert.ok(protocol.maxBytes <= 200, 'client frames at most 200 bytes');
    assert.ok(protocol.maxRate <= 12, 'client rate within 12/s');
    console.log(phone + ' mock: ' + protocol.rounds + ' rounds, ' + protocol.quorum + ' by quorum, deadline delays '
      + protocol.deadlines.join('/') + 'ms, ' + protocol.positions + ' positions, ' + protocol.done
      + ' done; max ' + protocol.maxBytes + ' bytes, ' + protocol.maxRate + ' messages/s');
  } finally { await mock.close(); }
}
let failed = false;
try {
  const args = process.argv.slice(2), engines = args.filter(arg => arg !== '--smoke');
  const [requested] = engines, smoke = args.includes('--smoke');
  assert.ok(engines.length <= 1 && (!requested || ['webkit', 'chromium'].includes(requested)), 'expected webkit or chromium, with optional --smoke');
  const profiles = [['webkit', webkit, devices['iPhone 13']], ['chromium', chromium, devices['Pixel 7']]];
  const tasks = profiles.filter(([phone]) => !requested || requested === phone);
  // Each engine has its own origin and rooms. Running them together overlaps the two full nights.
  await Promise.all(tasks.map(async ([phone, engine, device]) => {
    try { await verify(phone, engine, device, smoke); }
    catch (error) { failed = true; console.error('FAIL ' + phone + ': ' + error.message); }
  }));
} catch (error) {
  failed = true;
  console.error('FAIL Lantern Race: ' + error.message);
} finally { clearTimeout(watchdog); }
console.log('screenshots in ' + SHOTS + ' · ' + ((performance.now() - started) / 1000).toFixed(2) + 's');
process.exit(failed ? 1 : 0);
