// Independent browser regressions. Only normal UI actions change game state.
// Set PLAYWRIGHT to the installed node_modules directory.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
const shots=resolve(here,'.review-artifacts');
await mkdir(shots,{recursive:true});
const captureFix="canvas.addEventListener('lostpointercapture',e=>{if(pad.touch?.id===e.pointerId)pad.drop();});";
const effectsFix='flash=0;shake=0;particles=[];';
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://local');
    if(url.pathname==='/notes/button.js'){
      res.writeHead(200,{'content-type':'text/javascript'});return res.end('');
    }
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!path.startsWith(root+sep))throw Error('outside');
    if(url.pathname.endsWith('/'))path=join(path,'index.html');
    let data=await readFile(path);
    // Reintroduce one known fault only in the served test copy, never on disk.
    if(path===join(here,'main.js')){
      let source=data.toString();
      for(const [flag,fix] of [['--mutate-capture',captureFix],['--mutate-effects',effectsFix]]){
        if(process.argv.includes(flag)){assert.ok(source.includes(fix),'Mutation must match its source');source=source.replace(fix,'');}
      }
      data=source;
    }
    res.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript'}[extname(path)]||'application/octet-stream'});
    res.end(data);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/small/wild2-face-shift/`;
const require=createRequire(join(resolve(process.env.PLAYWRIGHT||'node_modules'),'x.js'));
const {webkit,chromium,devices}=require('playwright');
const state=p=>p.evaluate(()=>window.faceShiftState());
const touch=(p,type,id,x,y)=>p.locator('#c').dispatchEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true});
async function shot(p,name){
  await p.bringToFront();
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await p.screenshot({path:join(shots,name+'.png')});
}
async function restart(p){await p.locator('#pause').tap();await p.locator('#restart').tap();}
async function lifecycle(p,label){
  // Capture belongs to the actual trusted mouse pointer, whose id is observed.
  await restart(p);
  await p.evaluate(()=>document.querySelector('#c').addEventListener('pointerdown',e=>{window.reviewPointerId=e.pointerId;},{once:true}));
  await p.mouse.move(190,550);await p.mouse.down();await p.mouse.move(232.5,507.5);
  await p.waitForFunction(()=>window.faceShiftState().state.held>0);
  const id=await p.evaluate(()=>window.reviewPointerId);
  assert.equal(await p.evaluate(id=>document.querySelector('#c').hasPointerCapture(id),id),true,'Test must own real pointer capture');
  await touch(p,'lostpointercapture',id+1000,0,0);
  assert.equal((await state(p)).dragging,true,'Losing another pointer must preserve the owner');
  await p.evaluate(id=>document.querySelector('#c').releasePointerCapture(id),id);
  await p.mouse.move(232.5,507.5);await p.waitForTimeout(100);
  assert.equal((await state(p)).dragging,false,'Losing owner capture must release the drag');
  await p.mouse.up();await shot(p,label+'-capture-loss');
  await restart(p);
  // Observe the first actual photo, then press the two normal UI buttons in the
  // same task so delayed command delivery cannot let the flash expire first.
  await p.evaluate(()=>{
    window.reviewEffectResult=null;
    function inspect(){
      const before=window.faceShiftState();
      if(before.state.phase==='photo'){
        document.querySelector('#pause').click();document.querySelector('#restart').click();
        window.reviewEffectResult={before:before.effects,after:window.faceShiftState().effects};
      } else requestAnimationFrame(inspect);
    }
    requestAnimationFrame(inspect);
  });
  await p.mouse.move(190,550);await p.mouse.down();await p.mouse.move(232.5,507.5);
  await p.waitForFunction(()=>window.reviewEffectResult);
  const effects=await p.evaluate(()=>window.reviewEffectResult);
  assert.ok(effects.before.flash>0&&effects.before.shake>0&&effects.before.particles>0,'Retry test must interrupt live photo effects');
  assert.deepEqual(effects.after,{flash:0,shake:0,particles:0},'Retry must discard prior photo effects');
  await p.mouse.up();await shot(p,label+'-flash-retry');
  console.log(`PASS ${label} capture owner ${id}; photo effects ${JSON.stringify(effects.before)} -> ${JSON.stringify(effects.after)}`);
}
async function run(kind,device){
  const browser=await kind.launch();
  try {
    const context=await browser.newContext({...device}), p=await context.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(String(e)));
    p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.goto(base+'?seed=0');await p.waitForFunction(()=>window.faceShiftState);
    await shot(p,kind.name()+'-menu');
    assert.equal(await p.evaluate(()=>document.querySelector('#hero').getContext('2d').getImageData(300,150,1,1).data[3]),255,'Menu portrait canvas must be painted');
    await p.locator('#classic').tap();
    if(!process.argv.includes('--lifecycle')){
      await p.waitForTimeout(1800);await shot(p,kind.name()+'-first-play');
      assert.equal(await p.evaluate(()=>{const c=document.querySelector('#c');return c.getContext('2d').getImageData(c.width-2,c.height-2,1,1).data[3];}),255,'Game canvas must paint the full backing surface');
      if(process.argv.includes('--diagnose'))console.log('CANVAS',kind.name(),await p.evaluate(()=>{const c=document.querySelector('#c'),g=c.getContext('2d');return {width:c.width,height:c.height,rect:c.getBoundingClientRect().toJSON(),dpr:devicePixelRatio,transform:[g.getTransform().a,g.getTransform().d],pixels:[...g.getImageData(c.width-2,c.height-2,1,1).data]};}));
      // First encounter: the wide, closed-mouth face suggests a right/up drag.
      await touch(p,'pointerdown',11,190,550);await touch(p,'pointermove',11,232.5,507.5);await p.waitForTimeout(250);
      const before=await state(p);await shot(p,kind.name()+'-matching');
      await touch(p,'pointerdown',12,300,600);await touch(p,'pointermove',12,250,630);await p.waitForTimeout(50);
      const second=await state(p);await shot(p,kind.name()+'-second-finger');
      assert.equal(before.state.seed,0,'An explicit seed zero must remain zero');
      assert.deepEqual([second.state.x,second.state.y],[.5,-.5],'Second finger must not replace the first');
      await touch(p,'pointerup',12,250,630);await touch(p,'pointermove',11,236.75,507.5);
      await p.waitForFunction(()=>{const s=window.faceShiftState().state;return s.x===.55&&s.y===-.5;},null,{timeout:1500});
      assert.deepEqual([(await state(p)).state.x,(await state(p)).state.y],[.55,-.5],'First finger remains active after second finger lifts');
      await restart(p);await touch(p,'pointerdown',13,190,550);await touch(p,'pointermove',13,232.5,507.5);await p.waitForTimeout(200);
      assert.ok((await state(p)).state.held>0,'Pause test must interrupt a live hold');
      await p.locator('#pause').tap();const paused=await state(p);await p.waitForTimeout(300);
      assert.equal((await state(p)).state.elapsed,paused.state.elapsed);await shot(p,kind.name()+'-pause');
      assert.equal(paused.state.held,0,'Pausing interrupts the continuous hold immediately');
      await p.locator('#resume').tap();await p.waitForTimeout(100);
      assert.equal((await state(p)).state.held,0);await shot(p,kind.name()+'-resume');
      await restart(p);const restarted=await state(p);
      assert.equal(restarted.state.index,0);assert.equal(restarted.state.shots.length,0);assert.equal(restarted.score,0);assert.equal(restarted.cleared,0);
      assert.ok(restarted.state.elapsed<paused.state.elapsed,'Restart clears elapsed time');assert.equal(restarted.state.held,0);
      await shot(p,kind.name()+'-retry');await p.reload();await p.waitForFunction(()=>window.faceShiftState);
      assert.equal((await state(p)).mode,'menu');await shot(p,kind.name()+'-reload');await p.locator('#classic').tap();
    }
    await lifecycle(p,kind.name());assert.deepEqual(errors,[]);
    console.log(`PASS ${kind.name()}: lifecycle${process.argv.includes('--lifecycle')?'':' plus seed zero, two fingers, pause, restart, reload and painted canvases'}`);
    await context.close();
  } finally {await browser.close();}
}
try {
  if(!process.argv.includes('--chromium'))await run(webkit,devices['iPhone 13']);
  if(!process.argv.includes('--webkit'))await run(chromium,devices['Pixel 7']);
} finally {await new Promise(r=>server.close(r));}
