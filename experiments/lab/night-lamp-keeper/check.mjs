// Phone acceptance through route gestures. No simulation state is changed by this check.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const shots = process.env.SHOTS || '/private/tmp/night-r3-review/lamp';
await mkdir(shots, { recursive: true });
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname === '/notes/button.js') file = resolve(root, '../workers/feedback/public/notes/button.js');
  else if (!file.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript' }[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(join(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules', 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const state = page => page.evaluate(() => window.lampState());
const shot = (page, name) => page.screenshot({ path: join(shots, name + '.png'), timeout: 90000 });
const sleep = ms => new Promise(done => setTimeout(done, ms));
const saveKey = 'night-lamp-keeper:save';
const village = base + '/lab/night-lamp-keeper/';
const routes = [
  [0,1,2],
  [0,1,2,1,3],
  [0,1,2,3],
  [0,1,2],
  [0,1,2,3,2,1,4,5],
  [0,1,2,5,2,1,0,4],
  [0,1,2,3,2,1,4,5,4,1,6,7],
  [0,1,2,6,2,3,4,5,4,3,2],
  [0,1,2,3,2,4,7,4,5,6],
  [0,1,5,6,5,4,8,4,3,7],
];
function xy(point,{scale,ox,oy}) {
  return { x: ox + point.x * scale, y: oy + point.y * scale };
}
async function drag(page,touch,points,afterPress) {
  let from=points[0];
  const send=(type,point)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{...point,id:1}]:[]});
  if(touch) await send('touchStart',from);
  else { await page.mouse.move(from.x,from.y); await page.mouse.down(); }
  try {
    if(afterPress)await afterPress();
    for(const to of points.slice(1)) {
      if(touch) {
        for(let step=1;step<=3;step++) {
          const f=step/3;
          await send('touchMove',{x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f});
        }
      } else await page.mouse.move(to.x,to.y,{steps:6});
      from=to;
    }
  } finally {
    if(touch) await send('touchEnd');
    else await page.mouse.up();
  }
}
async function dragRoute(page,touch,nodes) {
  const v=await state(page);
  await drag(page,touch,nodes.map(n=>xy(v.state.nodes[n],v.transform)));
}
function path(s, from, to) {
  const seen = new Set([from]), q = [[from]];
  for (let i = 0; i < q.length; i++) {
    const p = q[i], a = p.at(-1); if (a === to) return p;
    for (const [u,v] of s.edges) { const b = u === a ? v : v === a ? u : -1; if (b >= 0 && !seen.has(b)) { seen.add(b); q.push([...p,b]); } }
  }
  throw new Error('disconnected village');
}
async function draw(page, nodes, cancel = false, trusted = false) {
  if (trusted) {
    const v=await state(page), f=v.transform;
    const xy=id=>({x:f.ox+v.state.nodes[id].x*f.scale,y:f.oy+v.state.nodes[id].y*f.scale});
    let p=xy(nodes[0]);await page.mouse.move(p.x,p.y);await page.mouse.down();
    for(const id of nodes.slice(1)){p=xy(id);await page.mouse.move(p.x,p.y,{steps:10});await sleep(35);}
    await page.mouse.up();return;
  }
  await page.evaluate(({nodes,cancel}) => {
    const {state:s,transform:f} = window.lampState(), el = document.querySelector('#c');
    function send(type,id) { const p = s.nodes[id]; el.dispatchEvent(new PointerEvent(type, {pointerId:7,pointerType:'touch',isPrimary:true,clientX:f.ox+p.x*f.scale,clientY:f.oy+p.y*f.scale,buttons:type==='pointerup'?0:1,pressure:.5,bubbles:true,cancelable:true})); }
    send('pointerdown',nodes[0]);
    for (const id of nodes.slice(1)) send('pointermove',id);
    send(cancel?'pointercancel':'pointerup',nodes.at(-1));
  }, {nodes,cancel});
}
// Uses only the visible graph, lit lamps and neighbours' remaining paths.
async function finish(page, name, limit = 60000) {
  const end = Date.now()+limit; let commands=0, capture=false;
  while (Date.now()<end) {
    const view = await state(page), s=view.state;
    if (s.status !== 'play') { assert.equal(s.status,'won',`${name}: all neighbours home`); return {time:s.t, rescued:s.rescued,total:s.total,score:s.score,commands}; }
    if (!capture && s.rescued>0) { await shot(page, name+'-home-light'); capture=true; }
    if (s.keeper.target == null && !s.keeper.queue.length) {
      const from=s.keeper.node;
      const needed = [...new Set(s.people.filter(p=>!p.done).flatMap(p=>p.path))].filter(id=>!s.nodes[id].lit && !s.nodes[id].homeLight);
      const targets=needed.length?needed:s.nodes.map((_,i)=>i).filter(i=>!s.nodes[i].lit && !s.nodes[i].homeLight);
      if (targets.length) {
        targets.sort((a,b)=>path(s,from,a).length-path(s,from,b).length);
        const target=targets[0]===from && targets.length>1?targets[1]:targets[0];
        let route=path(s,from,target);
        if(route.length===1) { const adjacent=s.edges.find(e=>e.includes(from)); route=[from,adjacent.find(id=>id!==from),from]; }
        await draw(page,route,false,commands%2===0); commands++;
      }
    }
    await sleep(100);
  }
  throw new Error(`${name}: no result before ${limit}ms`);
}
async function guide(page) {
  return page.evaluate(()=>{
    const {state:{nodes},transform:{scale,ox,oy}}=window.lampState();
    const canvas=document.querySelector('#c'),ctx=canvas.getContext('2d'),ratio=Math.min(devicePixelRatio,2);
    const x=Math.round((ox+(nodes[1].x+nodes[2].x)*scale/2)*ratio);
    const y=Math.round((oy+(nodes[1].y+nodes[2].y)*scale/2)*ratio);
    const pixels=ctx.getImageData(x-7,y-7,15,15).data;
    let bright=0;
    for(let i=0;i<pixels.length;i+=4) if(pixels[i]>=244&&pixels[i+1]>=234&&pixels[i+2]>=195)bright++;
    const offBoard=document.querySelector('.kit-hint.on .line');
    return {bright,offBoardVisible:!!offBoard&&getComputedStyle(offBoard).visibility==='visible'};
  });
}
async function observeWin(page,level) {
  return page.evaluate(({level,saveKey})=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Evening ${level} did not finish`)),60000);
    function sample(){
      const v=window.lampState();
      if(v.state.status==='won'){
        clearTimeout(timer);
        const saved=JSON.parse(localStorage.getItem(saveKey));
        resolve({level,screen:v.screen,unlocked:saved?.unlocked,daily:saved?.daily,time:v.state.t,rescued:v.state.rescued,total:v.state.total,score:v.state.score});
      }else if(v.state.status==='lost'){
        clearTimeout(timer);
        reject(new Error(`Evening ${level} reached nightfall`));
      }
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }),{level,saveKey});
}
async function settled(page) {
  await page.waitForFunction(()=>{
    const s=window.lampState().state;
    return s.status!=='play'||s.keeper.target===null&&!s.keeper.queue.length;
  });
  return (await state(page)).state;
}
async function run(name, engine, profile) {
  const browser=await engine.launch();
  try {
    const context=await browser.newContext({...profile});
    const page=await context.newPage(),errors=[],outside=[];
    const touch=name==='chromium'?await context.newCDPSession(page):null;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    page.on('request',r=>{if(!r.url().startsWith(base)&&r.url()!=='about:blank')outside.push(r.url());});
    // Start the host's WebKit display link on a blank page before navigation.
    // A static probe reproduced its first-viewport rAF stall; restore exact size.
    if(name==='webkit'){
      await page.goto('about:blank');
      await page.setViewportSize({...profile.viewport,width:profile.viewport.width+1});
      await sleep(150);await page.setViewportSize(profile.viewport);
      await page.waitForFunction(()=>true); // the default poll waits for a frame
    }
    await page.goto(village);
    await page.bringToFront();
    await page.waitForFunction(()=>window.lampState?.().screen==='menu');
    const painted=()=>document.querySelector('#c').getContext('2d').getImageData(0,0,1,1).data[3]===255;
    if(name==='webkit'){
      // Navigation can restart the stalled display link. Resize only if no frame painted.
      const started=await page.waitForFunction(painted,null,{polling:100,timeout:2000}).catch(()=>null);
      if(!started){
        await page.setViewportSize({...profile.viewport,width:profile.viewport.width+1});
        await sleep(150);await page.setViewportSize(profile.viewport);
      }
    }
    await page.waitForFunction(painted,null,{polling:100});
    await page.locator('#play').click({trial:true});
    await shot(page,name+'-01-menu-amber');
    assert.equal(await page.locator('#levels button:not([disabled])').count(),1,'only first evening unlocked');
    assert.ok(await page.locator('#daily').isDisabled(),'daily waits for ten evenings');
    const targets=await page.locator('button:visible').evaluateAll(bs=>bs.map(b=>({id:b.id,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})));
    assert.ok(targets.every(b=>b.w>=44 && b.h>=44),JSON.stringify(targets));
    const landscape={width:profile.viewport.height,height:profile.viewport.width};
    await page.setViewportSize(landscape);
    await page.waitForFunction(()=>innerWidth>innerHeight&&window.lampState().transform.scale<3);
    const layout=await page.locator('#menu button').evaluateAll(buttons=>buttons.map(b=>{
      const r=b.getBoundingClientRect();
      return {id:b.id,bottom:r.bottom,width:r.width,height:r.height,inside:r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};
    }));
    assert.ok(layout.every(b=>b.inside&&b.width>=44&&b.height>=44),'landscape controls fit and receive input');
    await shot(page,name+'-landscape-menu');
    await page.tap('#play');
    await sleep(5200);
    let v=await state(page); assert.equal(v.state.rescued,0,'idle does not escort anyone');
    const hint=await guide(page);
    assert.ok(hint.bright>0,'first-run guide reaches the second path segment');
    assert.equal(hint.offBoardVisible,false,'first-run guide stays on the village graph');
    await shot(page,name+'-landscape-first-evening');
    await page.setViewportSize(profile.viewport);
    await page.waitForFunction(()=>innerHeight>innerWidth&&window.lampState().transform.scale>3);
    await shot(page,name+'-02-first-evening-hint');
    await dragRoute(page,touch,routes[0]);
    const result=await observeWin(page,1);
    assert.equal(result.screen,'play','sample the win before its result card');
    assert.equal(result.unlocked,2,'commit the unlock before the result animation completes');
    await shot(page,name+'-03-first-evening-win');
    await page.waitForFunction(()=>window.lampState().screen==='end');
    await shot(page,name+'-04-ending');
    assert.equal(result.rescued,result.total);
    await page.tap('#next');
    assert.equal((await state(page)).state.level,2);
    v=await state(page);
    const startNode=v.state.keeper.node, edge=v.state.edges.find(e=>e.includes(startNode)), adjacent=edge.find(id=>id!==startNode);
    await draw(page,[startNode,adjacent],true); await sleep(150);
    assert.equal((await state(page)).state.keeper.target,null,'cancelled draft does not dispatch keeper');
    await dragRoute(page,touch,[0,1,2]);
    await page.waitForFunction(()=>window.lampState().state.keeper.target===1);
    const moving=await state(page), keeper=moving.state.keeper;
    assert.ok(Math.hypot(keeper.x-moving.state.nodes[1].x,keeper.y-moving.state.nodes[1].y)>10,'reroute starts on the moving keeper, outside its target lamp');
    await drag(page,touch,[keeper,moving.state.nodes[1],moving.state.nodes[3]].map(n=>xy(n,moving.transform)),async()=>{
      await page.waitForFunction(()=>{
        const k=window.lampState().state.keeper;
        return k.node===1&&k.target===null&&k.queue[0]===2;
      },null,{timeout:5000});
      await sleep(300);
      const k=(await state(page)).state.keeper;
      assert.equal(k.target,null,'holding a draft keeps the keeper at the edge endpoint');
      assert.deepEqual(k.queue,[2],'holding a draft preserves the previous route until release');
    });
    const rerouted=(await state(page)).state;
    assert.ok(rerouted.keeper.queue.includes(3)||rerouted.keeper.target===3||rerouted.keeper.node===3,`drag from walking keeper replaces the home branch: ${JSON.stringify(rerouted.keeper)}`);
    assert.ok([rerouted.keeper.target,...rerouted.keeper.queue].every(n=>n!==0&&n!==2),'moving grab neither doubles back nor keeps the replaced branch');
    assert.equal(rerouted.events.filter(e=>e.type==='route').length,2,'both gestures reached the simulation');
    await page.tap('#pause');
    const frozen=(await state(page)).state.keeper;
    const t=(await state(page)).state.t; await sleep(400);
    assert.equal((await state(page)).state.t,t,'pause freezes time');
    assert.deepEqual((await state(page)).state.keeper,frozen,'pause freezes walking and queued route');
    await shot(page,name+'-05-pause');
    await page.tap('#resume'); await sleep(250);
    assert.ok((await state(page)).state.t>t,'resume advances time');
    await page.keyboard.down('p');
    assert.equal((await state(page)).screen,'paused','the pause key opens the pause card');
    await page.keyboard.down('p');
    assert.equal((await state(page)).screen,'paused','holding the pause key keeps the pause card open');
    await page.keyboard.up('p');
    await page.keyboard.press('p');
    assert.equal((await state(page)).screen,'play','a fresh pause key press resumes play');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal((await state(page)).screen,'paused','leaving pauses');
    await page.tap('#resume');
    await page.goto('about:blank');
    await page.goBack({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>['paused','menu'].includes(window.lampState?.().screen));
    const returnScreen=(await state(page)).screen;
    if(returnScreen==='paused')await page.tap('#resume');
    else await page.tap('#play');
    assert.equal((await state(page)).state.level,2,'return resumes or restarts the unlocked evening');
    await page.reload();
    await page.waitForFunction(()=>window.lampState?.().screen==='menu');
    assert.equal(await page.locator('#levels button:not([disabled])').count(),2,'mid-evening reload keeps the completed unlock');
    assert.equal((await state(page)).state,null,'mid-evening reload starts at the menu');

    const campaign=[result];
    await page.tap('#play');
    for(let level=2;level<=routes.length;level++){
      assert.equal((await state(page)).state.level,level);
      if(level===4){
        // Start the short branch after a planning delay, then use a native drag to recover.
        await page.waitForFunction(()=>window.lampState().state.t>=1.2);
        await draw(page,routes[level-1]);
      }else await dragRoute(page,touch,routes[level-1]);
      await shot(page,`${name}-evening-${level}`);
      if(level===3){
        const s=await settled(page);
        if(!s.nodes[1].lit)await dragRoute(page,touch,[3,2,1]);
      }
      if(level===4){
        await page.waitForFunction(()=>window.lampState().state.t>=5);
        const s=await settled(page);
        assert.ok(s.events.some(e=>e.type==='light'&&e.node===2&&e.t<5)&&!s.nodes[2].lit,`wind removed the first home lamp while its neighbour was still walking: ${JSON.stringify(s.events)}`);
        assert.equal(await page.locator('#hudWind').textContent(),'Light the marked lamp','the dark lamp remains marked after wind');
        await shot(page,name+'-wind-recovery');
        await dragRoute(page,touch,[2,1,2,1,3,4]);
        await page.waitForFunction(()=>window.lampState().state.nodes[2].lit);
        assert.equal(await page.locator('#hudWind').textContent(),'','relighting clears the recovery cue');
      }
      const won=await observeWin(page,level);
      assert.equal(won.rescued,won.total,`evening ${level} brings every neighbour home`);
      assert.equal(won.unlocked,level+1,`evening ${level} unlock persists`);
      campaign.push(won);
      await page.waitForFunction(()=>window.lampState().screen==='end');
      if(level<routes.length)await page.tap('#next');
    }
    await page.tap('#toMenu');
    assert.equal(await page.locator('#daily').isDisabled(),false,'daily unlocks from a completed campaign');
    // Give yesterday a higher score to isolate same-day replacement from the campaign unlock.
    await page.evaluate(saveKey=>{
      const saved=JSON.parse(localStorage.getItem(saveKey));
      localStorage.setItem(saveKey,JSON.stringify({...saved,sound:false,daily:{day:'2000-01-01',score:99999}}));
    },saveKey);
    await page.goto(village+'?look=rose');
    await page.waitForFunction(()=>window.lampState?.().screen==='menu');
    await shot(page,name+'-06-menu-rose');
    assert.equal(await page.locator('#levels button:not([disabled])').count(),10);
    assert.equal(await page.locator('#daily').isDisabled(),false);
    await page.tap('#daily');
    const dailySeed=(await state(page)).state.seed;
    const dailyResult=await finish(page,name+'-07-daily');
    await page.waitForFunction(()=>window.lampState().screen==='end');
    await shot(page,name+'-08-daily-end');
    const best=(await state(page)).saved.daily;
    assert.notEqual(best.day,'2000-01-01','new day replaces old high score');
    assert.equal(best.score,dailyResult.score,'won daily score stored');
    await page.tap('#toMenu'); await page.reload();
    await page.waitForFunction(()=>window.lampState?.().screen==='menu');
    assert.deepEqual((await state(page)).saved.daily,best,'daily best persists');
    await page.tap('#daily');assert.equal((await state(page)).state.seed,dailySeed,'same local day uses same seed');
    await page.tap('#pause');await page.tap('#quit');
    // Parseable but invalid values must not unlock or poison the game.
    await page.evaluate(()=>localStorage.setItem('night-lamp-keeper:save','{"unlocked":"bad","daily":{"day":null,"score":"bad"}}'));
    await page.reload();await page.waitForFunction(()=>window.lampState?.().screen==='menu');
    assert.equal((await state(page)).saved.unlocked,1);
    assert.equal((await state(page)).saved.daily,null);
    await page.evaluate(()=>localStorage.setItem('night-lamp-keeper:save','{broken'));
    await page.reload();await page.waitForFunction(()=>window.lampState?.().screen==='menu');
    assert.equal((await state(page)).saved.unlocked,1,'corrupt JSON recovers');
    await page.tap('#play');
    await page.waitForFunction(()=>window.lampState().screen==='end',null,{timeout:65000});
    assert.equal((await state(page)).state.status,'lost','idle reaches nightfall');
    assert.equal((await state(page)).saved.unlocked,1,'loss does not unlock');
    await shot(page,name+'-09-nightfall');
    await page.tap('#retry');
    const retried=(await state(page)).state;
    assert.equal(retried.status,'play','retry returns to play');
    assert.equal(retried.rescued,0,'retry clears arrivals');
    assert.equal(retried.keeper.node,0,'retry returns keeper to start');
    assert.deepEqual(retried.keeper.queue,[],'retry clears queued route');
    assert.ok(retried.people.every(p=>p.at===0&&!p.done),'retry resets every neighbour');
    assert.ok(retried.events.every(e=>e.type!=='lost'),'retry discards prior loss event');
    await page.tap('#pause');await page.tap('#quit');
    assert.match(await page.locator('meta[name=viewport]').getAttribute('content'),/maximum-scale=1/,'kit zoom guard');
    assert.deepEqual(errors,[],'zero browser errors'); assert.deepEqual(outside,[],'zero outside requests');
    console.log(JSON.stringify({browser:name,daily:dailyResult,best}));
    console.log(JSON.stringify({browser:name,campaign:campaign.map(({level,time,rescued,total,score})=>({level,time,rescued,total,score})),returnScreen,landscapeViewport:landscape,landscapeSoundBottom:layout.find(b=>b.id==='sound1').bottom,hintPixels:hint.bright,touchTargets:targets.length,errors:errors.length,outsideRequests:outside.length}));
    await context.close();
    const denied=await browser.newContext({...profile});
    await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('storage denied');};Storage.prototype.setItem=()=>{throw new Error('storage denied');};});
    const blocked=await denied.newPage(),blockedErrors=[];
    blocked.on('pageerror',e=>blockedErrors.push(e.message));
    await blocked.goto(`${base}/lab/night-lamp-keeper/`);
    if(name==='webkit'){await blocked.setViewportSize({...profile.viewport,width:profile.viewport.width+1});await blocked.setViewportSize(profile.viewport);}
    await blocked.waitForFunction(()=>window.lampState?.().screen==='menu');await blocked.tap('#play');
    assert.equal((await state(blocked)).state.level,1,'blocked storage still plays');
    await blocked.tap('#pause');await blocked.tap('#sound2');await blocked.tap('#quit');
    assert.match(await blocked.locator('#dailyBest').textContent(),/could not be saved/,'storage failure is visible');
    assert.deepEqual(blockedErrors,[],'blocked storage is handled');
    await denied.close();
  } finally {await browser.close();}
}
let failed=0;
try { for (const [name,engine,profile] of [['webkit',webkit,devices['iPhone 13']],['chromium',chromium,devices['Pixel 7']]]) {if(process.argv[2] && process.argv[2]!==name)continue;try{await run(name,engine,profile);}catch(e){failed++;console.error(name,e.stack);}} }
finally {await new Promise(done=>server.close(done));}
process.exitCode=failed?1:0;
