// Full-night phone acceptance. The local server serves experiments/, plus this contract-only room mock.
// No Lantern state is changed: the driver imports the same policy used in the Node checks and sends touch PointerEvents.
// Usage: PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/lantern-race/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = '/private/tmp/night-lantern-race';
await mkdir(SHOTS, { recursive: true });
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json' };
const rooms = new Map(), sockets = new Set(), protocol = { errors:[], maxBytes:0, maxRate:0, positions:0, done:0, rounds:0 };
const server = createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, {'content-type':'text/javascript'}); res.end(''); return; }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  let path;
  try { path = normalize(join(root, decodeURIComponent(url.pathname))); if (url.pathname.endsWith('/')) path = join(path, 'index.html'); if (!path.startsWith(root + '/')) throw Error('path'); const body = await readFile(path); res.writeHead(200, {'content-type':mime[extname(path)] || 'application/octet-stream', 'cache-control':'no-store'}); res.end(body); }
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
const broadcast = (room,m,except) => { for (const c of room.clients.values()) if(c!==except && c.named) send(c,m); };
function packet(c,raw) {
  const len = Buffer.byteLength(raw); protocol.maxBytes=Math.max(protocol.maxBytes,len);
  if (len>200) { protocol.errors.push(`client frame ${len} bytes`); close(c,1009); return; }
  const now=Date.now(); c.times=c.times.filter(t=>now-t<1000); c.times.push(now); protocol.maxRate=Math.max(protocol.maxRate,c.times.length);
  if(c.times.length>12) { protocol.errors.push(`client exceeded 12 messages/s (${c.times.length})`); close(c,1008); return; }
  let m; try {m=JSON.parse(raw);}catch{protocol.errors.push('invalid JSON');return close(c,1008);}
  if (m.t==='hi') {
    assert.equal(typeof m.n,'string'); assert.ok(m.n.length<=16); c.n=m.n; c.named=true;
    broadcast(c.room,{t:'join',id:c.id,n:c.n},c);
  } else if(m.t==='ready') {
    c.ready=true;
    if (!c.room.round || now-c.room.round.start>150000 || [...c.room.clients.values()].filter(p=>p.inRound).every(p=>p.finishedRound)) {
      const r={seed:3,start:Date.now()+4000}; c.room.round=r; for(const p of c.room.clients.values()){p.ready=false;p.inRound=true;p.finishedRound=false;}
      protocol.rounds++; broadcast(c.room,{t:'round',...r});
    }
  } else if(m.t==='p') {
    if(!(Number.isFinite(m.x)&&m.x>=-1&&m.x<=1&&Number.isFinite(m.d)&&m.d>=0&&m.d<=100000&&(m.a===0||m.a===1))) {protocol.errors.push('invalid p');return close(c,1008);}
    protocol.positions++; c.pCount++; broadcast(c.room,{...m,id:c.id},c);
  } else if(m.t==='done') {
    if(!(Number.isInteger(m.s)&&m.s>=0&&m.s<=1000000)){protocol.errors.push('invalid done');return close(c,1008);}
    protocol.done++; c.done++; if(c.inRound)c.finishedRound=true; broadcast(c.room,{t:'done',id:c.id,s:m.s});
  } else {protocol.errors.push('unknown client packet');close(c,1008);}
}
server.on('upgrade',(req,socket,head)=>{
  if(req.url.endsWith('/LOST')){socket.end('HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n');return;}
  const match=req.url.match(/^\/lab-api\/room\/lantern-race\/(open|[A-Z]{4})$/); if(!match){socket.end('HTTP/1.1 404 Not Found\r\n\r\n');return;}
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sockets.add(socket); socket.on('error',()=>{});
  if(match[1]==='FAIL'){const c={socket};close(c,1011);socket.on('close',()=>sockets.delete(socket));return;}
  let room=rooms.get(match[1]); if(!room){room={clients:new Map(),round:null};rooms.set(match[1],room);}
  const id=[1,2,3,4,5,6,7,8].find(n=>!room.clients.has(n)); const c={socket,room,id,n:'Boat',named:true,ready:false,times:[],pCount:0,done:0,inRound:false,finishedRound:false};
  if(!id){close(c,4001);return;} room.clients.set(id,c);send(c,{t:'you',id,peers:[...room.clients.values()].filter(p=>p!==c).map(({id,n})=>({id,n})),round:room.round});broadcast(room,{t:'join',id,n:c.n},c);
  let buf=Buffer.from(head);
  const consume=()=>{while(buf.length>=2){const op=buf[0]&15, masked=!!(buf[1]&128);let len=buf[1]&127,off=2;if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4;}else if(len===127){close(c,1009);return;}if(!masked){close(c,1002);return;}if(buf.length<off+4+len)return;const key=buf.subarray(off,off+4);off+=4;const data=Buffer.from(buf.subarray(off,off+len));buf=buf.subarray(off+len);for(let i=0;i<data.length;i++)data[i]^=key[i%4];if(op===8){close(c);return;}if(op===9){frame(socket,data,10);continue;}if(op!==1){close(c,1003);return;}try{packet(c,data.toString());}catch(e){protocol.errors.push(e.message);close(c,1008);}}};
  socket.on('data',b=>{buf=Buffer.concat([buf,b]);consume();});
  socket.on('close',()=>{sockets.delete(socket);room.clients.delete(id);broadcast(room,{t:'leave',id});if(!room.clients.size)rooms.delete(match[1]);});consume();
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const state=page=>page.evaluate(()=>window.raceState());
async function until(page,fn,label,timeout=12000,arg){try{await page.waitForFunction(fn,arg,{timeout});}catch{throw Error(`timed out: ${label}`);}}
async function open(browser,device){
  const context=await browser.newContext({...device}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(`page: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
  page.on('requestfailed',r=>errors.push(`request: ${r.url()} ${r.failure()?.errorText}`));page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);});
  return{context,page,errors};
}
async function menu(p,phone,label,url=''){
  await p.page.goto(`${base}/lab/lantern-race/${url}`);await until(p.page,()=>window.raceState?.().phase==='menu','menu');
  await p.page.locator('#name').fill(label);await p.page.locator('#name').evaluate(el=>el.blur());
  assert.ok(await p.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  const targets=await p.page.locator('#quick').boundingBox();assert.ok(targets.width>=48&&targets.height>=48,'Quick race target at least 48px');
  await sleep(300);await p.page.screenshot({path:join(SHOTS,`${phone}-${label}-menu.png`)});
  await p.page.locator('#quick').click();await until(p.page,()=>window.raceState().phase==='lobby','lobby');
}
async function pilot(page){
  await page.evaluate(async()=>{
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
async function finish(p,phone,label,full=true){
  const started=Date.now();let mid=false,lastReport=0;
  for(;;){const s=await state(p.page);if(s.phase==='end')break;
    assert.ok(s.phase!=='paused',`${label} did not pause while racing`);
    if(!mid&&s.phase==='race'&&s.d>10000){await p.page.screenshot({path:join(SHOTS,`${phone}-${label}-mid.png`)});mid=true;}
    if(Date.now()-lastReport>15000){console.log(`     ${phone} ${label}: ${s.phase}, ${(s.t||0).toFixed(1)}s, distance ${Math.round(s.d||0)}`);lastReport=Date.now();}
    if(Date.now()-started>150000)throw Error(`${label}: race exceeded 150s`);await sleep(500);
  }
  const s=await state(p.page);await sleep(300);await p.page.screenshot({path:join(SHOTS,`${phone}-${label}-end.png`)});
  assert.ok(await p.page.locator('#end').isVisible(),'end card visible');assert.ok(await p.page.locator('#rematch').isVisible(),'one-tap Rematch visible');
  assert.ok(await p.page.evaluate(()=>window.__pilotEvents)>30,'played by real touch pointer events');
  if(full){assert.equal(s.over,'dawn',`${label} completed the full Lantern night`);assert.ok(s.d>=99900,`${label} reached dawn distance`);assert.ok(mid,'mid-race screenshot captured');}
  assert.ok(s.results.length>=2,'results rank multiple boats');assert.ok(s.best>0,'best saved');return s;
}
async function layoutSmoke(browser,device,label){
  const p=await open(browser,device);try{await menu(p,label,'layout','?room=FAIL');await until(p.page,()=>window.raceState().offline,'layout offline');const ready=await p.page.locator('#ready').boundingBox();assert.ok(ready.width>=48&&ready.height>=48,'Ready target at least48px');await p.page.screenshot({path:join(SHOTS,`${label}-lobby.png`)});await p.page.locator('#ready').click();await until(p.page,()=>window.raceState().phase==='race','layout race');
    const initial=await state(p.page),before=initial.target,mouseX=(device.viewport.width-initial.unit)/2+(before+(before>.5?-.08:.08))*initial.unit;await p.page.mouse.move(device.viewport.width*.5,device.viewport.height*.75);await p.page.mouse.down();await p.page.mouse.move(mouseX,device.viewport.height*.75);await p.page.mouse.up();assert.ok(Math.abs((await state(p.page)).target-before)>.03,'mouse steers');await p.page.screenshot({path:join(SHOTS,`${label}-race.png`)});await p.page.locator('#pause').click();const card=await p.page.locator('#paused .card').boundingBox();assert.ok(card.y>=0&&card.y+card.height<=device.viewport.height,'pause card fits');await sleep(300);await p.page.screenshot({path:join(SHOTS,`${label}-pause.png`)});assert.ok(await p.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'layout no horizontal overflow');assert.deepEqual(p.errors,[],`${label} errors`);
  }finally{await p.context.close();}
}
async function friendsSmoke(browser,device,phone){
  const p=await open(browser,device);try{await p.page.goto(`${base}/lab/lantern-race/`);await until(p.page,()=>window.raceState?.().phase==='menu','friends menu');await p.page.locator('#friends').click();await p.page.locator('#code').fill('1');await p.page.locator('#join').click();assert.match(await p.page.locator('#codeError').textContent(),/four letters/i,'invalid room explains format');await p.page.locator('#code').fill('abcd');await p.page.locator('#join').click();await until(p.page,()=>window.raceState().phase==='lobby','friend lobby');assert.equal((await state(p.page)).room,'ABCD','lowercase room normalized');assert.equal(await p.page.locator('#roomTitle').textContent(),'ABCD');await p.page.locator('#share').click();await sleep(300);assert.match(await p.page.locator('#shareStatus').textContent(),/copied|room=ABCD/i,'share copies or gives room link');await p.page.screenshot({path:join(SHOTS,`${phone}-friends.png`)});await p.page.locator('#lobby .toMenu').click();await p.page.locator('#friends').click();await p.page.locator('#create').click();await until(p.page,()=>window.raceState().phase==='lobby','created room lobby');assert.match((await state(p.page)).room,/^[A-Z]{4}$/,'created four-letter room');assert.deepEqual(p.errors,[],`${phone} friend flow errors`);
  }finally{await p.context.close();}
}
async function solitudeSmoke(browser,device,phone){
  const a=await open(browser,device),b=await open(browser,device);try{await menu(a,`${phone}-last`,'First');await menu(b,`${phone}-last`,'Last');await until(a.page,()=>window.raceState().peers.length===2,'last-human pair');await a.page.locator('#ready').click();await until(a.page,()=>window.raceState().phase==='race','last-human race');const late=await open(browser,device);try{await menu(late,`${phone}-spectator`,'Watcher');await sleep(300);assert.equal((await state(late.page)).phase,'lobby','late spectator waits');assert.equal((await state(a.page)).results.length,2,'spectator never adds phantom race result');assert.deepEqual(late.errors,[],'spectator errors');}finally{await late.context.close();}await b.context.close();await until(a.page,()=>window.raceState().ghosts.length===3,'last human gets three bots');assert.ok((await state(a.page)).ghosts.every(g=>/bots/.test(g.n)),'replacement ghosts tagged bots');assert.deepEqual(a.errors,[],`${phone} last-human errors`);assert.deepEqual(b.errors,[],`${phone} departing page errors`);await a.page.screenshot({path:join(SHOTS,`${phone}-last-human.png`)});
  }finally{await a.context.close();await b.context.close();}
}
async function run(engine,device,phone){
  const browser=await engine.launch(),all=[];
  try{
    const a=await open(browser,device),b=await open(browser,device),offline=await open(browser,device);all.push(a,b,offline);
    await menu(a,phone,'Reed');await menu(b,phone,'Glow');
    await until(a.page,()=>window.raceState().peers.length>=2,'two peers in first page');await until(b.page,()=>window.raceState().peers.length>=2,'two peers in second page');
    await pilot(a.page);await pilot(b.page);
    await a.page.locator('#ready').click();
    await until(a.page,()=>window.raceState().phase==='countdown','round countdown');await until(b.page,()=>window.raceState().phase==='countdown','round countdown');
    const initialA=await state(a.page),initialB=await state(b.page);assert.equal(initialA.seed,initialB.seed,'same server seed');assert.equal(initialA.seed,3,'server seed accepted');assert.equal(initialA.night,initialB.night,'same night');
    // A completed WebSocket handshake followed by an error close exercises the offline recovery path without hiding browser errors.
    await offline.page.goto(`${base}/lab/lantern-race/?room=FAIL`);await until(offline.page,()=>window.raceState?.().phase==='menu','offline menu');await offline.page.locator('#name').fill('Solo');
    // A room link may enter its lobby itself; otherwise Quick race must preserve the supplied code.
    await offline.page.locator('#quick').click();await until(offline.page,()=>window.raceState().offline,'offline fallback');
    if((await state(offline.page)).phase==='lobby')await offline.page.locator('#ready').click();await pilot(offline.page);
    await until(offline.page,()=>['countdown','race'].includes(window.raceState().phase),'offline countdown');
    await until(offline.page,()=>window.raceState().phase==='race','offline race starts');await offline.page.locator('#pause').click();const frozen=await state(offline.page);assert.equal(frozen.phase,'paused','offline pause card');await sleep(400);assert.equal((await state(offline.page)).t,frozen.t,'offline sim freezes');await offline.page.keyboard.press('p');assert.equal((await state(offline.page)).phase,'race','P resumes offline');
    const solo=await state(offline.page);assert.ok(solo.offline,'socket error selects offline mode');assert.ok(solo.ghosts.length===3,'three local bot ghosts');
    await offline.page.screenshot({path:join(SHOTS,`${phone}-offline-menu.png`)});
    const [endA,endB,endSolo]=await Promise.all([finish(a,phone,'Reed'),finish(b,phone,'Glow'),finish(offline,phone,'offline',false)]);
    await sleep(700);const doneA=await state(a.page),doneB=await state(b.page);
    for(const [label,s]of[['Reed',doneA],['Glow',doneB]]){assert.ok(s.received.p>0,`${label} received remote progress`);assert.ok(s.received.done>0,`${label} received remote finish`);assert.ok(s.sent.p>=100,`${label} sent frequent progress`);assert.equal(s.results.length,2,`${label} ranks two humans`);}
    await until(offline.page,()=>window.raceState().ghosts.every(g=>!g.a),'all bots reach terminal results',150000);assert.doesNotMatch(await offline.page.locator('#endLine').textContent(),/still racing/,'final offline results settle');
    assert.equal(endA.seed,endB.seed);assert.ok(endSolo.offline);assert.ok(await offline.page.getByText('offline',{exact:false}).first().isVisible(),'offline note visible');
    // Also exercise an absent endpoint (HTTP 404 during upgrade). Engines may print their own WebSocket diagnostic.
    const absent=await open(browser,device);await absent.page.goto(`${base}/lab/lantern-race/?room=LOST`);await until(absent.page,()=>window.raceState?.().phase==='menu','absent-server menu');await absent.page.locator('#quick').click();await until(absent.page,()=>window.raceState().offline,'absent-server fallback');
    assert.ok((await state(absent.page)).offline,'HTTP 404 upgrade recovers to offline');assert.ok(absent.errors.every(e=>e.startsWith('console:')&&/WebSocket|websocket|404|connection/i.test(e)),`only expected browser WebSocket diagnostics: ${absent.errors.join('; ')}`);
    console.log(`     ${phone} absent server: offline recovered; ${absent.errors.length} browser-generated socket diagnostic(s)`);await absent.context.close();
    await a.page.locator('#rematch').click();await until(a.page,()=>window.raceState().phase==='countdown','one-tap rematch countdown');await until(b.page,()=>window.raceState().phase==='countdown','other rematch countdown');
    await until(a.page,()=>window.raceState().phase==='race','rematch starts');const late=await open(browser,device);await menu(late,phone,'Late');await sleep(500);assert.equal((await state(late.page)).phase,'lobby','late join waits in lobby');assert.equal((await state(late.page)).t,0,'late join never starts a partial river');assert.equal((await state(a.page)).results.length,2,'spectator does not add a phantom racer');assert.deepEqual(late.errors,[],'late join errors');await late.context.close();
    // Trusted browser inputs supplement the frame-by-frame synthetic touch control used for the full night.
    await offline.page.evaluate(()=>window.__stopPilot());await offline.page.locator('#rematch').click();await until(offline.page,()=>window.raceState().phase==='race','offline trusted-input round');const box=await offline.page.locator('#c').boundingBox(),cx=box.width/2,cy=box.height*.75,beforeInput=(await state(offline.page)).target;
    if(phone==='chromium'){const cdp=await offline.context.newCDPSession(offline.page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+60,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    else{await offline.page.touchscreen.tap(cx,cy);await offline.page.mouse.move(cx,cy);await offline.page.mouse.down();await offline.page.mouse.move(cx+60,cy);await offline.page.mouse.up();}
    assert.ok(Math.abs((await state(offline.page)).target-beforeInput)>.03,'trusted browser input steers');
    const best=endA.best;await a.page.reload();await until(a.page,()=>!!window.raceState,'reload');assert.ok((await state(a.page)).best>=best,'best survives reload');assert.equal(await a.page.locator('#name').inputValue(),'Reed','boat name survives reload');
    for(const p of all)assert.deepEqual(p.errors,[],`${phone}: zero page, console and network errors`);
    if(phone==='chromium'){await layoutSmoke(browser,{...device,viewport:{width:360,height:640}},'small-360');await layoutSmoke(browser,{viewport:{width:1280,height:800}},'desktop');}
    for(const p of all)await p.context.close();await sleep(200);await friendsSmoke(browser,device,phone);await solitudeSmoke(browser,device,phone);
    console.log(`ok   Lantern: Race on ${phone}: two dawn finishes, ${doneA.received.p}/${doneB.received.p} remote positions, offline bots; zero page/console errors`);
  }catch(e){for(let i=0;i<all.length;i++){try{console.log(`state ${phone}/${i}: ${JSON.stringify(await state(all[i].page))}`);console.log(`errors ${phone}/${i}: ${JSON.stringify(all[i].errors)}`);await all[i].page.screenshot({path:join(SHOTS,`${phone}-FAIL-${i}.png`)});}catch{}}throw e;}
  finally{await browser.close();}
}
let failed=0;
try{for(const[phone,engine,device]of[['webkit',webkit,devices['iPhone 13']],['chromium',chromium,devices['Pixel 7']]]){if(process.argv[2]&&process.argv[2]!=='--smoke'&&process.argv[2]!==phone)continue;try{if(process.argv[2]==='--smoke'){const browser=await engine.launch();try{await friendsSmoke(browser,device,phone);await solitudeSmoke(browser,device,phone);if(phone==='chromium'){await layoutSmoke(browser,{...device,viewport:{width:360,height:640}},'small-360');await layoutSmoke(browser,{viewport:{width:1280,height:800}},'desktop');}console.log(`ok   ${phone} friends, last-human and layout smoke`);}finally{await browser.close();}}else await run(engine,device,phone);}catch(e){failed++;console.error(`FAIL ${phone}: ${e.stack}`);}}
  assert.deepEqual(protocol.errors,[],'mock protocol errors');assert.ok(protocol.maxBytes<=200,'client frames at most 200 bytes');assert.ok(protocol.maxRate<=12,'client rate within 12/s');
  console.log(`mock: ${protocol.rounds} rounds, ${protocol.positions} positions, ${protocol.done} done; max ${protocol.maxBytes} bytes, ${protocol.maxRate} messages/s`);
}catch(e){failed++;console.error(e.stack);}
finally{for(const socket of sockets)socket.destroy();await new Promise(done=>server.close(done));}
console.log(`screenshots in ${SHOTS}`);process.exitCode=failed?1:0;
