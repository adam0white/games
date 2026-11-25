// Phone acceptance checks. PLAYWRIGHT points to node_modules containing playwright.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { answerLab, allowLocalSend, withAgent, assertNotice, assertRun, assertNoLeak, assertOffSendsNothing, waitForRuns, runRecords, eventRecords } from '../../kit/check/lab-record.mjs';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
const shots=process.env.SHOTS || join(tmpdir(),'thankful-shots'); await mkdir(shots,{recursive:true});
const server=createServer(async(req,res)=>{try {
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 if(url.pathname==='/notes/button.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('');return;} // served by the site, not this folder
 let file=resolve(root,'.'+decodeURIComponent(url.pathname)); if(url.pathname.endsWith('/'))file=join(file,'index.html');
 if(!file.startsWith(root+sep))throw Error('outside root');
 const body=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[extname(file)] || 'application/octet-stream','cache-control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('not found');}});
if(!process.env.PLAYWRIGHT)throw Error('Set PLAYWRIGHT to a node_modules directory that has playwright');
const require=createRequire(join(resolve(process.env.PLAYWRIGHT),'x.js'));
const {webkit,chromium,devices}=require('playwright');
const state=page=>page.evaluate(()=>window.__thankful.state);
const total=s=>Object.values(s.days).reduce((n,a)=>n+a.length,0);
async function nonblank(page){assert.ok(await page.locator('canvas').first().evaluate(c=>{const ctx=c.getContext('2d'), p=ctx.getImageData(0,0,c.width,c.height).data;let first=null;for(let i=0;i<p.length;i+=Math.max(4,Math.floor(p.length/4096/4)*4)){const v=`${p[i]},${p[i+1]},${p[i+2]},${p[i+3]}`;if(first===null)first=v;else if(v!==first)return true;}return false;}),'canvas contains rendered detail');}
async function run(name,engine,device,base){
 const browser=await engine.launch();
 try{const context=await browser.newContext({...device});const page=await context.newPage();const errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}return route.continue();});
 for(const look of ['sky','lamps','garden']){
  await page.goto(`${base}/lab/thankful/?day=2026-11-23&look=${look}`);await page.waitForFunction(()=>!!window.__thankful);
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>!!window.__thankful);
  assert.equal(await page.evaluate(()=>window.__thankful.look),look,'look query selects renderer');
  assert.equal(total(await state(page)),0);await nonblank(page);await page.screenshot({path:join(shots,`${name}-${look}-empty.png`)});
  await page.locator('[data-kind="bread"]').tap();await page.locator('[data-kind="water"]').tap();await page.locator('[data-kind="home"]').tap();
  assert.equal(total(await state(page)),3,'three taps add three lights');
  const picture=await page.evaluate(()=>window.__thankful.picture());
  assert.equal(picture.width,1080,`${look} picture width`);assert.equal(picture.height,1350,`${look} picture height`);assert.ok(picture.bytes>20000,`${look} picture contains PNG data`);
  await page.waitForFunction(()=>window.__thankful.lights.some(p=>p.day==='2026-11-23'));
  const point=await page.evaluate(()=>window.__thankful.lights.find(p=>p.day==='2026-11-23'));
  assert.ok(point,'a recorded light has a hit target');
  await page.locator('canvas').first().tap({position:{x:point.x,y:point.y}});
  assert.match(await page.locator('#label').innerText(),/Mon 23 Nov/,'light label shows its recorded date');
  assert.match(await page.locator('#label').innerText(),/bread|water|home|🍞|💧|🏠/i,'light label shows its recorded picture');
  assert.equal(await page.locator('[data-kind="family"]').isDisabled(),true,'fourth tap control disabled');
  // The disabled fourth control is also tested through the public action boundary.
  await page.evaluate(()=>window.__thankful.give('family'));assert.equal(total(await state(page)),3,'fourth light rejected');
  await page.reload();await page.waitForFunction(()=>!!window.__thankful);assert.equal(total(await state(page)),3,'reload preserves lights');
  const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));
  await page.goto(`${base}/lab/thankful/?day=2026-11-23&look=${look}&demo=40`);await page.waitForFunction(()=>!!window.__thankful);
  assert.equal(await page.evaluate(()=>window.__thankful.look),look,'demo look query selects renderer');
  assert.equal(total(await state(page)),120,'40 completed demo days');await nonblank(page);
  assert.ok(await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(window.__thankful.lights.length)))))>=45,'a grown sky shows at least 15 days at once');
  await page.screenshot({path:join(shots,`${name}-${look}-demo40.png`)});
  for(const k of ['bread','rain','tree'])await page.evaluate(k=>window.__thankful.give(k),k);await page.waitForTimeout(2600);await page.screenshot({path:join(shots,`${name}-${look}-demo40-done.png`)});
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),saved,'demo never writes storage');
 }
 assert.deepEqual(external,[],'no external network requests');assert.deepEqual(errors,[],'no browser exceptions');console.log(`ok thankful ${name}`);
 }finally{await browser.close();}}
// Play recording: the notice is on the page before the first thanks, a day's three thanks send one run record
// under the page's name, typed words are never sent, and with the switch off nothing is sent.
async function recording(name,engine,device,base){
 const browser=await engine.launch();
 try{const context=await browser.newContext({...device});const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const lab=await answerLab(context,base);await allowLocalSend(context);
 const url=day=>withAgent(`${base}/lab/thankful/?day=${day}&look=lamps`);
 await page.goto(url('2026-11-24'));await page.waitForFunction(()=>!!window.__thankful);await page.evaluate(()=>localStorage.removeItem('thankful:v1'));await page.reload();await page.waitForFunction(()=>!!window.__thankful);
 await assertNotice(page);assert.equal(lab.sent.length,0,'nothing is sent before a thanks is given');
 await page.locator('[data-kind="bread"]').tap();await page.locator('[data-kind="water"]').tap();
 assert.equal(lab.sent.length,0,'a run that is not finished sends nothing yet');
 await page.locator('[data-kind="spark"]').tap();await page.fill('#word','SECRETWORD');await page.locator('#wordForm button[type=submit]').tap();
 await waitForRuns(lab,'thankful',1);
 const run=assertRun(lab,'thankful',{outcomes:['won'],summaryKeys:['thanks','kinds']});
 assert.equal(run.data.summary.thanks,3);assert.deepEqual(run.data.summary.kinds,['bread','water','spark']);
 const events=run.data.events.map(e=>e.type);assert.deepEqual(events,['thanks','thanks','thanks','daily-finished']);
 assertNoLeak(lab,['SECRETWORD']);assert.equal(await page.evaluate(()=>window.__thankful.state.days['2026-11-24'][2].t),'SECRETWORD','the words stay on the device');
 await page.locator('#settings').tap();await assertOffSendsNothing(page,lab,'thankful',{play:async()=>{await page.locator('#settingsCard .close').tap();await page.goto(url('2026-11-25'));await page.waitForFunction(()=>!!window.__thankful);for(const k of ['bread','water','home'])await page.locator(`[data-kind="${k}"]`).tap();}});
 assert.equal(runRecords(lab,'thankful').length,1,'one run record in all');assert.equal(eventRecords(lab,'thankful').length,1);
 assert.deepEqual(errors,[],'no browser exceptions');console.log(`ok thankful recording ${name}`);
 }finally{await browser.close();}}

// Daily flowers, Turkish, sound for each action, the smallest phone and the frame budget (2026-11-25).
async function extras(name,engine,device,base){
 const browser=await engine.launch();
 try{const errors=[];
 const fresh=async(opts={})=>{const context=await browser.newContext({...device,...opts});await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(()=>{window.__notes=0;const A=window.AudioContext||window.webkitAudioContext;if(A){for(const m of ['createOscillator','createBufferSource']){const f=A.prototype[m];A.prototype[m]=function(...a){window.__notes++;return f.apply(this,a);};}}
   const raf=window.requestAnimationFrame.bind(window);window.__work=[];window.requestAnimationFrame=cb=>raf(t=>{const a=performance.now();cb(t);window.__work.push(performance.now()-a);});
   try{Object.defineProperty(navigator,'canShare',{value:undefined});}catch{}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return {context,page};};
 // The flowers on the buttons follow the date, the same for everyone; days before the change grow the old ones.
 let {context,page}=await fresh();
 for(const [day,bread,light] of [['2026-11-24','wheat','sunflower'],['2026-11-25','barley','dandelion'],['2026-11-26','oats','sunflower'],['2026-11-27','wheat','marigold']]){
  await page.goto(`${base}/lab/thankful/?day=${day}&lang=en`);await page.waitForFunction(()=>!!window.__thankful);
  assert.equal(await page.locator('[data-kind="bread"]').getAttribute('aria-label'),`bread: ${bread}`,`${day}: bread grows ${bread}`);assert.equal(await page.locator('[data-kind="light"]').getAttribute('aria-label'),`light: ${light}`);}
 // Every action makes a sound (counted as notes started on the one audio context) and moves something.
 await page.goto(`${base}/lab/thankful/?day=2026-11-26&lang=en`);await page.evaluate(()=>localStorage.removeItem('thankful:v1'));await page.reload();await page.waitForFunction(()=>!!window.__thankful);
 const notes=()=>page.evaluate(()=>window.__notes);const sounds={};
 const act=async(label,fn)=>{const a=await notes();await fn();await page.waitForTimeout(250);sounds[label]=(await notes())-a;};
 await act('thanks',()=>page.locator('[data-kind="bread"]').tap());
 assert.ok(await page.evaluate(()=>window.__thankful.zoom)>1.3,'a one-day garden is drawn larger');
 await act('look',()=>page.locator('#look').tap());await act('look back',async()=>{await page.locator('#look').tap();await page.locator('#look').tap();});
 await act('settings',()=>page.locator('#settings').tap());await act('language',()=>page.locator('#lang').tap());
 assert.equal(await page.locator('[data-kind="bread"] span').innerText(),'ekmek','the buttons speak Turkish');assert.equal(await page.locator('#line').innerText(),'Bugün için üç teşekkür.');
 await act('language back',()=>page.locator('#lang').tap());await act('back',()=>page.locator('#settingsCard .close').tap());
 await act('something else',()=>page.locator('[data-kind="spark"]').tap());await act('give words',async()=>{await page.fill('#word','tea');await page.locator('#wordForm button[type=submit]').tap();});
 await page.waitForTimeout(1300);const p=await page.evaluate(()=>window.__thankful.lights.find(l=>l.day==='2026-11-26'));
 await act('flower',()=>page.locator('canvas').first().tap({position:{x:p.x,y:p.y}}));assert.match(await page.locator('#label').innerText(),/oats|passionflower/,'the label names the flower');
 await act('third',()=>page.locator('[data-kind="home"]').tap());await page.waitForTimeout(1200);
 assert.match(await page.locator('#info').innerText(),/^Day 1 · 3 thanks/,'the finished day says which day it is');
 await act('picture',async()=>{await Promise.all([page.waitForEvent('download'),page.locator('#picture').tap()]);});
 await act('reset',async()=>{await page.locator('#settings').tap();await page.locator('#reset').tap();});await act('clear',()=>page.locator('#clear').tap());
 for(const [k,v] of Object.entries(sounds))assert.ok(v>0,`${k} makes a sound`);
 // Nothing hides behind the words in a grown garden, and the page stays inside the frame budget.
 await page.goto(`${base}/lab/thankful/?day=2026-11-26&lang=en&demo=60`);await page.waitForFunction(()=>!!window.__thankful);await page.waitForTimeout(800);
 await page.evaluate(()=>{window.__work.length=0;for(const k of ['bread','rain','tree'])window.__thankful.give(k);});await page.waitForTimeout(3000);
 const work=await page.evaluate(()=>{const a=window.__work;return {mean:a.reduce((x,y)=>x+y,0)/a.length,max:Math.max(...a),n:a.length};});
 assert.ok(work.mean<8,`mean page work per frame ${work.mean.toFixed(2)} ms`);
 const under=await page.evaluate(()=>{const L=document.getElementById('line').getBoundingClientRect(),P=document.getElementById('picture').getBoundingClientRect();return window.__thankful.lights.filter(l=>l.y>L.top-20&&l.y<P.bottom).length;});
 assert.equal(under,0,'no flower behind the words');
 await context.close();
 // The smallest phone, in both languages: every control inside the screen, the title clear of the look button, no scroll.
 for(const lang of ['en','tr']){({context,page}=await fresh({viewport:{width:320,height:568}}));
  await page.goto(`${base}/lab/thankful/?day=2026-11-26&lang=${lang}`);await page.waitForFunction(()=>!!window.__thankful);await page.waitForTimeout(500);
  const fit=await page.evaluate(()=>({out:[...document.querySelectorAll('header button,#tray button,#line')].filter(e=>{const q=e.getBoundingClientRect();return q.left<0||q.top<0||q.right>innerWidth||q.bottom>innerHeight;}).length,gap:document.getElementById('looks').getBoundingClientRect().left-document.getElementById('name').getBoundingClientRect().right,scroll:document.scrollingElement.scrollHeight-innerHeight+document.scrollingElement.scrollWidth-innerWidth}));
  assert.deepEqual([fit.out,fit.scroll],[0,0],`${lang} 320x568: everything inside, no scroll`);assert.ok(fit.gap>=8,`${lang} 320x568: title clear of the look button (${fit.gap} px)`);
  await page.screenshot({path:join(shots,`${name}-320-${lang}.png`)});await context.close();}
 assert.deepEqual(errors,[],'no browser exceptions');console.log(`ok thankful extras ${name}: sounds ${Object.keys(sounds).length}/${Object.keys(sounds).length} actions, mean work ${work.mean.toFixed(2)} ms, max ${work.max.toFixed(1)} ms over ${work.n} frames`);
 }finally{await browser.close();}}
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;
try{const failures=[];for(const [name,engine,device] of [['iphone13',webkit,devices['iPhone 13']],['pixel7',chromium,devices['Pixel 7']]]){try{await run(name,engine,device,base);await recording(name,engine,device,base);await extras(name,engine,device,base);}catch(error){console.error(`${name}: ${error.stack || error}`);failures.push(error);}}if(failures.length)throw new AggregateError(failures,'Phone checks failed');console.log(`Screenshots: ${shots}`);}finally{await new Promise(done=>server.close(done));}
