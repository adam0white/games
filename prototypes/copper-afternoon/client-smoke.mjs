// Node DOM/Canvas shim: verifies client logic and pointer paths, not browser rendering.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as sim from './sim.js';
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
for(const [w,h]of [[375,812],[1280,900]]){
 const callbacks={}, texts=[];let audioStarted=0;
 const gradient={addColorStop(){}};
 const ctx=new Proxy({fillText(str){texts.push(str)},createLinearGradient(){return gradient},createRadialGradient(){return gradient}}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={getContext:()=>ctx,addEventListener:(k,f)=>callbacks[k]=f,focus(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0})};
 globalThis.innerWidth=w;globalThis.innerHeight=h;globalThis.devicePixelRatio=1;
 globalThis.document={querySelector:()=>canvas,addEventListener:(k,f)=>callbacks[k]=f,hidden:false};
 globalThis.addEventListener=(k,f)=>callbacks[k]=f;globalThis.requestAnimationFrame=()=>{};
 class Audio{constructor(){audioStarted++;this.state='running';this.currentTime=0;this.destination={}}createOscillator(){return{frequency:{setValueAtTime(){}},connect:()=>({connect(){}}),start(){},stop(){}}}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}
 globalThis.window={AudioContext:Audio};
 const test=new Function('create','step','DT','prompt','good',source+'\nreturn {get state(){return s},draw,get spots(){return spots},get paused(){return paused}};')(...['create','step','DT','prompt','good'].map(k=>sim[k]));
 function draw(){texts.length=0;test.draw();if(!test.state.over&&!test.paused)assert(texts.join(' ').split(/\s+/).filter(Boolean).length<=12,JSON.stringify(texts));}
 function pointer(type,x,y){const z=Math.min(w/460,h/900);callbacks[type]({clientX:(w-460*z)/2+x*z,clientY:(h-900*z)/2+y*z,pointerId:1,preventDefault(){}})}
 function click(x,y){draw();pointer('pointerdown',x,y);pointer('pointerup',x,y);draw();}
 function finish(){while(test.state.operation)sim.step(test.state);draw()}
 draw();assert.deepEqual(texts,[]);assert.equal(audioStarted,0);
 click(251,445);assert(test.state.started);finish();assert(test.state.cart.open);assert.equal(audioStarted,1);
 click(114,810);assert.equal(test.state.tool,'pliers');click(230,438);finish();assert.equal(test.state.cart.pin,null);
 click(91,703);assert.equal(test.state.selected,'pin');click(230,438);finish();assert.equal(test.state.cart.pin,'straight');
 click(396,557);finish();assert(test.state.cart.fixed);
 click(230,273);click(210,405);finish();assert(test.state.bell.open);
 // Coupling by actual drag; spacer by tap. The wrong base spacer test stays a thud.
 draw();pointer('pointerdown',368,703);pointer('pointermove',316,439);pointer('pointerup',316,439);finish();assert.equal(test.state.coupling,'bell');
 click(230,810);click(316,439);finish();assert(test.state.fastened);
 click(396,557);finish();assert(!test.state.bell.fixed);
 click(114,810);click(158,482);finish();assert.equal(test.state.spacer,'tray');click(230,703);click(314,482);finish();assert.equal(test.state.spacer,'striker');
 click(396,557);finish();assert(test.state.bell.fixed);
 click(410,52);assert(test.paused);click(230,445);assert(!test.paused);
 // Pointer cancel must not keep a carried part alive.
 callbacks.pointercancel();draw();
 console.log(`PASS client shim ${w}x${h}: silent no-text opening, audio unlock, pointer taps, drag, spacer puzzle, test, pause, word budget.`);
}
