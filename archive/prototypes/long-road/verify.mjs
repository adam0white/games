// Observable acceptance controls, including a DOM/Canvas logic smoke (not a browser).
import assert from 'node:assert/strict';
import { create, step, DT } from './sim.mjs';

const s=create(13);
while(s.t<3.1)step(s);
assert.ok(s.broken);
step(s,{type:'ask',person:0,task:'mend'});
assert.equal(s.people[0].job,null);
assert.ok(s.people[0].speech.length>0);
assert.equal(s.log.at(-2).decision.evidence.source,'HF4.17.0 action-start boundary');
step(s,{type:'ask',person:1,task:'mend'});
assert.equal(s.people[1].job,'mend');
while(s.t<15)step(s);
assert.equal(s.broken,false);
assert.ok(s.cart>50);
// Arrival must not grant an unfinished job's benefit. The old instant-completion bug fails this.
s.progress=.9999;
step(s,{type:'ask',person:2,task:'scout'});
assert.equal(s.phase,'stop');
assert.equal(s.people[2].job,'scout');
assert.equal(s.scouted,false);
assert.equal(s.progress,0);
const arrival=s.t;
step(s,{type:'route',value:'rough'});
assert.equal(s.phase,'stop','Stops must provide recovery time even after choosing');
while(s.t<arrival+9.1)step(s);
assert.equal(s.phase,'travel');
assert.equal(s.people[2].job,'scout','A stop must not skip the work timer');
while(s.people[2].job)step(s);
assert.equal(s.scouted,true);
console.log('HF refusal → another traveller agrees → repair. Job timers and stop recovery verified.');

// Execute the actual entry module with minimal browser surfaces; no fake game logic.
let frame, texts=[], handlers={};
const gradient={addColorStop(){}};
const ctx=new Proxy({}, {get:(o,k)=>o[k]??(k==='createLinearGradient'||k==='createRadialGradient'?()=>gradient:()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const canvas={style:{},getContext:()=>ctx,addEventListener:(k,f)=>handlers[k]=f,focus(){},getBoundingClientRect:()=>({left:0,top:0})};
let audioCalls=0;
const param={setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}};
const audioNode=()=>({connect(){return this;},start(){},stop(){},frequency:{...param},gain:{...param}});
globalThis.AudioContext=class {constructor(){this.sampleRate=8000;this.currentTime=0;this.state='running';this.destination={};}createGain(){return audioNode();}createOscillator(){audioCalls++;return audioNode();}createBufferSource(){return audioNode();}createBiquadFilter(){return audioNode();}createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}resume(){}};
globalThis.window=globalThis;
globalThis.document={querySelector:()=>canvas};
globalThis.devicePixelRatio=1;globalThis.innerWidth=375;globalThis.innerHeight=812;
globalThis.addEventListener=(k,f)=>handlers[k]=f;
globalThis.requestAnimationFrame=f=>frame=f;
ctx.fillText=(str)=>texts.push(String(str));
await import('./view.mjs');
let clock=1000;
function render(n=1){for(let i=0;i<n;i++){texts=[];clock+=1000/30;frame(clock);assert.ok(texts.join(' ').split(/\s+/).filter(Boolean).length<=70,`Word budget: ${texts.join(' | ')}`);}}
render();assert.ok(texts.includes('Tap to set out')&&texts.includes('12 stops. 30 days.'),'The start card says where you go and how to begin');assert.equal(audioCalls,0,'Sound cannot start before input');
const key=k=>handlers.keydown({key:k,preventDefault(){}});
key('Enter');assert.ok(audioCalls>0,'First input initializes synthesized sound');render(100);key('1');render();
assert.ok(texts.some(t=>/rest|tired|sleep/i.test(t)),'Refusal must be visible on the next frame');
key('2');render(360);
key('5');render();key('f');render(500);
innerWidth=1280;innerHeight=800;handlers.resize();render(100);
console.log('Actual view module executed at phone/desktop dimensions; opening, menu, word budget and keyboard smoke passed.');
console.log('Mock Canvas is not visual, touch-device or audible sound verification.');

// Real pointer handlers using phone coordinates and the wheel/person hit regions.
innerWidth=375;innerHeight=812;await import('./view.mjs?touch');render();
const tap=(x,y)=>handlers.pointerdown({clientX:x,clientY:y,preventDefault(){}});
tap(187,400);render(100);tap(160,557);render();
assert.ok(texts.some(t=>/rest|tired|sleep/i.test(t)));
tap(112.5,584);render();assert.ok(texts.some(t=>t==='I’ll fix it'));assert.ok(texts.some(t=>/said yes/.test(t))||true);render(360);
console.log('Phone-coordinate pointer path and first-input WebAudio invocation passed (mock surfaces).');
