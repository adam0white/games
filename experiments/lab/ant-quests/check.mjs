// Serve experiments itself. All movement goes through kit/stick.js PointerEvents.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'), shots='/private/tmp/night-ant-quests';
await mkdir(shots,{recursive:true});
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://x').pathname;
 if(path==='/notes/button.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('');return;}
 try{let f=resolve(root,'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw 0;if(path.endsWith('/'))f=join(f,'index.html');const body=await readFile(f);res.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'}[extname(f)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const require=createRequire(join(resolve(process.env.PLAYWRIGHT||'/Users/abdul/code/human-framework/node_modules'),'x.js'));
const {webkit,chromium,devices}=require('playwright');
const odd={name:'<b>Beetle</b>',ask:'<img src=x onerror=alert(1)> Bring seeds & smile.',thanks:'<script>no()</script> A fine friend.',scold:'<i>Try again</i>',secret:'<svg onload=alert(1)> A secret & a stone. '+ 'x'.repeat(100)};
const results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const [phone,browserType,device] of [['webkit',webkit,devices['iPhone 13']],['chromium',chromium,devices['Pixel 7']]]){
  const browser=await browserType.launch({headless:true});
  try{
   for(const scenario of (process.argv.includes('--contracts')?[]:['timeout','odd'])){
    const context=await browser.newContext({...device});const page=await context.newPage(),errors=[],calls=[],aborts=[];
    page.on('pageerror',e=>errors.push('page: '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
    await context.route('**/lab-api/quest',async route=>{calls.push(JSON.parse(route.request().postData()));if(scenario==='timeout'){// A real AbortController cancellation after4s, no HTTP diagnostics hidden.
       await sleep(4500);try{await route.fulfill({status:200,json:odd});}catch{}return;
      }await route.fulfill({status:200,json:odd});});
    page.on('requestfailed',r=>{if(r.url().endsWith('/lab-api/quest'))aborts.push(r.failure()?.errorText);else errors.push('request: '+r.url());});
    await page.goto(`${base}/lab/ant-quests/?seed=7`);await page.waitForFunction(()=>window.meadowState);
    await page.screenshot({path:join(shots,`${phone}-${scenario}-menu.png`)});
    assert.equal((await page.evaluate(()=>window.meadowState())).audio,false,'audio waits for gesture');
    assert.equal(await page.locator('#menu h1').innerText(),'Meadow\nFolk');
    assert.equal(await page.locator('#menu button').count(),1,'one big Play button');
    const zoom=await page.locator('meta[name=viewport]').getAttribute('content');assert.match(zoom,/viewport-fit=cover/);
    await page.click('#play');await page.waitForTimeout(350);
    const initial=await page.evaluate(()=>window.meadowState());assert.equal(initial.mode,'play');assert.equal(initial.audio,true,'Play unlocks audio');
    // Real thumb events, one per frame. The only oracle is the same visible path drawn for people.
    await page.evaluate(()=>{
      window.phoneDrive={stop:false,seen:[],first:null,mid:false};let down=false;
      const el=document.getElementById('c'),send=(type,x,y)=>el.dispatchEvent(new PointerEvent('pointer'+type,{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true,pressure:type==='up'?0:.5}));
      function frame(){const st=window.meadowState(),d=window.phoneDrive;
        if(d.stop||st.mode!=='play'){if(down)send('up',st.layout.W/2,st.layout.H-155);down=false;if(!d.stop)requestAnimationFrame(frame);return;}
        if(st.s.quest&&!d.seen.includes(st.s.quest.kind))d.seen.push(st.s.quest.kind);
        if(st.s.quest&&!d.first)d.first={bubble:st.bubble,source:st.source,id:st.s.quest.id};
        const p=st.s.player,goal=st.guide,dx=goal.x-p.x,dy=goal.y-p.y,dist=Math.hypot(dx,dy),cx=st.layout.W/2,cy=st.layout.H-165;
        if(!down){send('down',cx,cy);down=true;}
        const strength=Math.min(1,dist/8);send('move',cx+(dist?dx/dist:0)*55*strength,cy+(dist?dy/dist:0)*55*strength);
        requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
    });
    await page.waitForFunction(()=>window.meadowState().s.quest,null,{timeout:8000});
    await page.waitForTimeout(350);
    const first=await page.evaluate(()=>window.phoneDrive.first);
    assert.equal(first.source,scenario==='odd'?'model':'fallback','prefetch only substitutes before first bubble');
    if(scenario==='odd'){
      assert.equal(await page.locator('#line').textContent(),odd.ask);assert.equal(await page.locator('#bubble img, #bubble script, #bubble b').count(),0,'model markup stays plain text');
    }
    await page.screenshot({path:join(shots,`${phone}-${scenario}-mid.png`)});
    await page.click('#pause');const frozen=await page.evaluate(()=>window.meadowState().s.t);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.meadowState().s.t),frozen,'pause freezes sim');await page.click('#resume');
    await page.waitForFunction(()=>window.meadowState().mode==='end',null,{timeout:300000});
    const done=await page.evaluate(()=>window.meadowState());assert.equal(done.s.status,'won','full run wins through pointer input');assert.equal(done.completed,12);assert.deepEqual(Object.values(done.s.friends),[3,3,3,3]);
    const kinds=await page.evaluate(()=>window.phoneDrive.seen);assert.deepEqual([...kinds].sort(),['escort','fetch','hide','hunt','race']);
    assert.ok(calls.length<=8);assert.equal(calls.length,done.calls);assert.equal(new Set(done.shown).size,12);
    for(const body of calls){assert.ok(body.count>=1&&body.count<=9);assert.ok(body.variant>=0&&body.variant<=3);assert.ok(['grumpy','kind','sly','proud','sleepy'].includes(body.mood));}
    if(scenario==='timeout')assert.ok(aborts.length>0,'4s timeout really aborts');
    await page.waitForTimeout(300);await page.screenshot({path:join(shots,`${phone}-${scenario}-end.png`)});
    assert.equal(done.save.best,12);assert.ok(Object.values(done.save.secrets).every(v=>v.length<=70),'secrets clamp to70');const saved=await page.evaluate(()=>localStorage.getItem('ant-quests-save'));assert.ok(saved);
    await page.click('#endBook');assert.ok(await page.locator('#entries .entry').count()>=4);assert.equal(await page.locator('#entries svg,#entries script').count(),0);if(scenario==='odd')assert.ok((await page.locator('#entries').innerText()).includes('<svg'));await page.screenshot({path:join(shots,`${phone}-${scenario}-book.png`)});
    await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('ant-quests-save')),saved,'save survives reload');
    await page.click('#play');await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>window.meadowState().s.quest,null,{timeout:10000});await page.keyboard.up('ArrowLeft');assert.match(await page.locator('#toast').textContent(),/Back again/,'returning greeting is remembered');await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.equal((await page.evaluate(()=>window.meadowState())).mode,'paused','blur pauses');await page.keyboard.press('P');assert.equal((await page.evaluate(()=>window.meadowState())).mode,'play');
    await page.evaluate(()=>window.phoneDrive&&(window.phoneDrive.stop=true));
    const sizes=await page.locator('button:visible').evaluateAll(bs=>bs.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})));assert.ok(sizes.every(b=>b.w>=48&&b.h>=48));
    assert.deepEqual(errors,[]);results.push({phone,scenario,hearts:12,seconds:+done.s.t.toFixed(2),quests:done.completed,calls:done.calls,pageErrors:0,consoleErrors:0,taskKinds:kinds.sort(),timeoutAborts:aborts.length});console.log('PASS',JSON.stringify(results.at(-1)));
    await context.close();
   }
   // Status doubles exercise HTTP fallback without browser-generated resource errors.
   // Real network cancellation is covered above, not replaced with a mocked fetch.
   for(const response of [404,429,503,'malformed','late','wide','cross']){
    const context=await browser.newContext({...device}), page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(({response,odd})=>{
      if(response==='cross')localStorage.setItem('ant-quests-save',JSON.stringify({v:1,memory:{beetle:{visits:2,failed:true,hearts:2}}}));
      const original=window.fetch;
      window.fetch=(url,opts)=>{
        if(String(url)!=='/lab-api/quest')return original(url,opts);
        if(typeof response==='number')return Promise.resolve(new Response('',{status:response}));
        if(response==='cross')return Promise.resolve(new Response('',{status:503}));
        if(response==='wide')return Promise.resolve(new Response(JSON.stringify({...odd,name:'W'.repeat(70),ask:'W'.repeat(70)}),{status:200}));
        if(response==='malformed')return Promise.resolve(new Response(JSON.stringify({name:'only one field'}),{status:200}));
        return new Promise(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify(odd),{status:200})),1800));
      };
    },{response,odd});
    await page.goto(`${base}/lab/ant-quests/?seed=7`);await page.click('#play');await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>window.meadowState().s.quest,null,{timeout:10000});await page.keyboard.up('ArrowLeft');
    await page.waitForFunction(()=>window.meadowState().s.quest);const before=await page.locator('#line').textContent();
    if(response==='wide'){assert.equal(before,'W'.repeat(70));const layout=await page.evaluate(()=>{const st=window.meadowState();return {bottom:st.layout.oy+500*st.layout.scale,bubble:document.getElementById('bubble').getBoundingClientRect().top,scroll:document.documentElement.scrollWidth,w:innerWidth};});assert.ok(layout.bottom<=layout.bubble,'long text leaves meadow clear');assert.equal(layout.scroll,layout.w);await page.screenshot({path:join(shots,`${phone}-wide.png`)});}
    else assert.match(before,/seeds/);
    if(response==='cross')assert.match(await page.locator('#toast').textContent(),/Don.t let me down/,'failed friend stays cross after reload');
    await page.waitForTimeout(response==='late'?2100:100);assert.equal(await page.locator('#line').textContent(),before,'late/failed answers never rewrite visible dialogue');
    assert.equal((await page.evaluate(()=>window.meadowState())).source,response==='wide'?'model':'fallback');assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${phone} fallback ${response}`);
   }
   // Small portrait, and desktop input. No page-state mutation.
   const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,isMobile:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/lab-api/quest',r=>r.fulfill({status:200,json:odd}));await page.goto(`${base}/lab/ant-quests/`);await page.click('#play');await page.screenshot({path:join(shots,`${phone}-360.png`)});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));const bounds=await page.evaluate(()=>{const st=window.meadowState();return {bottom:st.layout.oy+500*st.layout.scale,bubble:document.getElementById('bubble').getBoundingClientRect().top};});assert.ok(bounds.bottom<=bounds.bubble,'map fits above bubble');
   const x=await page.evaluate(()=>window.meadowState().s.player.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');assert.ok(await page.evaluate(x=>window.meadowState().s.player.x>x,x),'keyboard moves');
   const y=await page.evaluate(()=>window.meadowState().s.player.y);await page.mouse.move(180,450);await page.mouse.down();await page.mouse.move(180,395);await page.waitForTimeout(250);await page.mouse.up();assert.ok(await page.evaluate(y=>window.meadowState().s.player.y<y,y),'mouse stick moves');assert.deepEqual(errors,[]);await context.close();
  }finally{await browser.close();}
 }
 if(results.length)await writeFile(join(shots,'phone-results.json'),JSON.stringify(results,null,2));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
