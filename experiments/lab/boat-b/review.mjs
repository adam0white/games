// Independent first-play and interrupted-touch regression checks.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
assert.ok(process.env.PLAYWRIGHT,'Set PLAYWRIGHT to the installed test node_modules directory');
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),shots=join(here,'review-shots');
await mkdir(shots,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;if(path==='/notes/button.js'){res.end('');return;}const file=resolve(root,'.'+path+(path.endsWith('/')?'index.html':''));if(!file.startsWith(root+'/'))throw Error('outside root');res.setHeader('Content-Type',extname(file)==='.html'?'text/html':'text/javascript');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const require=createRequire(join(resolve(process.env.PLAYWRIGHT),'x.js')),{webkit,chromium,devices}=require('playwright');
const state=p=>p.evaluate(()=>boatState());
async function pointer(page,type,id,x,y){await page.evaluate(({type,id,x,y})=>document.querySelector('#c').dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===11,clientX:x,clientY:y,bubbles:true,cancelable:true})),{type,id,x,y});}
let failures=0;
for(const [name,engine,device] of [['webkit',webkit,'iPhone 13'],['chromium',chromium,'Pixel 7']]){
 if(process.argv[2]&&process.argv[2]!==name)continue;
 const browser=await engine.launch(),context=await browser.newContext(devices[device]),page=await context.newPage(),errors=[];
 console.log(`${name}: browser ready`);
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
 await page.goto(`http://127.0.0.1:${server.address().port}/lab/boat-b/`);console.log(`${name}: page loaded`);await Promise.race([page.bringToFront(),new Promise((_,reject)=>setTimeout(()=>reject(Error('foreground timed out')),10000))]);console.log(`${name}: page foregrounded`);await page.evaluate(()=>{window.__boatReviewFrames=0;requestAnimationFrame(()=>{window.__boatReviewFrames++;requestAnimationFrame(()=>window.__boatReviewFrames++);});});await page.waitForFunction(()=>window.__boatReviewFrames===2,undefined,{timeout:10000,polling:100});await page.waitForFunction(()=>window.boatState);
 await page.screenshot({path:join(shots,`${name}-first-screen.png`)});await page.locator('#play').tap();
 await page.waitForTimeout(2100);await page.screenshot({path:join(shots,`${name}-hint.png`)});
 // A first-time run: use the visible gutter, without importing the reference route.
 let st=await state(page),x=st.layout.left+50*st.layout.scale,y=st.layout.boatY;
 await pointer(page,'pointerdown',11,x,y);await pointer(page,'pointermove',11,x+35,y);
 const first=(await state(page)).actions.ripple;
 await pointer(page,'pointerdown',22,x-40,y);await pointer(page,'pointermove',22,x-80,y);await pointer(page,'pointerup',22,x-80,y);
 assert.equal((await state(page)).actions.ripple,first,'second finger creates no ripple');
 await pointer(page,'lostpointercapture',22,x-80,y);
 await pointer(page,'pointermove',11,x+70,y);
 assert.equal((await state(page)).actions.ripple,first+1,'unrelated pointer capture loss preserves first finger');
 await page.locator('#pause').tap();await page.screenshot({path:join(shots,`${name}-pause.png`)});
 st=await state(page);assert.deepEqual(st.input,{pointer:null,trail:0},'pause clears the gesture and its drawn trail');await page.waitForTimeout(300);assert.equal((await state(page)).sim.t,st.sim.t,'pause freezes clock');
 await page.locator('#resume').tap();
 await pointer(page,'pointermove',11,x+100,y);await pointer(page,'pointerup',11,x+100,y);
 assert.equal((await state(page)).actions.ripple,first+1,'paused pointer cannot resume stale drag');
 if(name==='chromium'){
  await page.evaluate(()=>{window.touchTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.querySelector('#c').addEventListener(type,e=>touchTrace.push({type,id:e.pointerId,x:e.clientX,input:boatState().input}));});
  const cdp=await context.newCDPSession(page);const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await send('touchStart',[{id:31,x,y}]);await send('touchStart',[{id:31,x,y},{id:32,x:x-60,y:y+50}]);
  await send('touchMove',[{id:31,x:x+20,y},{id:32,x:x-60,y:y+50}]);
  await send('touchEnd',[{id:32,x:x-60,y:y+50}]);const before=(await state(page)).actions.ripple;
  await send('touchMove',[{id:31,x:x+50,y}]);await send('touchEnd',[]);
  assert.ok((await state(page)).actions.ripple>before,'native first finger continues after second finger lifts: '+JSON.stringify(await page.evaluate(()=>touchTrace)));await cdp.detach();
 }
 // Move with short real swipes using only visible positions. Then let the first street finish.
 for(const direction of [-1,-1,1]){st=await state(page);x=st.layout.left+st.sim.boat.x*st.layout.scale;y=st.layout.boatY;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+direction*45,y,{steps:3});await page.mouse.up();await page.waitForTimeout(500);}
 await page.screenshot({path:join(shots,`${name}-first-play.png`)});
 await page.waitForFunction(()=>boatState().screen==='end',null,{timeout:30000});st=await state(page);
 await page.screenshot({path:join(shots,`${name}-first-end.png`)});console.log(`${name} first play: ${st.sim.status}, ${st.sim.score} points, ${st.sim.rescued} passengers, ${st.sim.hits} hits, ${st.sim.t.toFixed(2)}s`);
 await page.locator('#again').tap();st=await state(page);assert.equal(st.sim.hits,0);assert.equal(st.sim.rescued,0);assert.equal(st.actions.ripple,0);assert.equal(st.actions.pebble,0);assert.ok(st.sim.t<1);assert.ok(st.sim.boat.soak<2);
 await page.screenshot({path:join(shots,`${name}-retry.png`)});
 await page.locator('#pause').tap();await page.locator('#restart').tap();await page.waitForFunction(()=>boatState().sim.rescued===1&&Number(getComputedStyle(document.querySelector('#toast')).opacity)>0);await page.locator('#pause').tap();const fresh=await page.evaluate(()=>{document.querySelector('#restart').click();return {state:boatState(),toast:document.querySelector('#toast').textContent};});assert.equal(fresh.state.sim.t,0);assert.equal(fresh.toast,'','restart clears the previous rescue toast synchronously');
 await page.reload();await page.waitForFunction(()=>window.boatState?.().screen==='menu');await page.screenshot({path:join(shots,`${name}-reload.png`)});assert.deepEqual(errors,[]);
 console.log(`PASS ${name}: second finger, capture loss, pause/resume, retry, reload; 0 errors`);
 }catch(e){failures++;console.error(`FAIL ${name}: ${e.stack}`);console.error(await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState,frames:window.__boatReviewFrames,now:performance.now()})).catch(()=>null));await page.screenshot({path:join(shots,`${name}-review-fail.png`)}).catch(()=>{});}finally{await context.close();await browser.close();}
}
await new Promise(r=>server.close(r));process.exitCode=failures?1:0;
