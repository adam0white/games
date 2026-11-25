// Test helper for check.mjs (not loaded by the page). Drives the booth with real pointer drags: press on the part, drag by the needed travel, let go.
const SPOT={head:[-62,18],brow:[0,-50],eyes:[-32,-19],nose:[0,10],mouth:[0,45],ears:[-88,-95]};
const KEYPART={w:'head',o:'head',b:'brow',m:'mouth',l:'eyes',n:'nose',e:'ears'};
const SIGN={brow:-1,mouth:-1,eyes:-1,nose:1,ears:-1};
export async function solveOne(p,{noise=0}={}){
 const st=await p.evaluate(()=>window.faceShiftState());const s=st.state;if(st.mode!=='play'||s.phase!=='play')return false;
 const mirror=s.targets[s.index].mod==='mirror'?-1:1;
 for(let fi=0;fi<s.faces.length;fi++){
  const cur=s.faces[fi];const goal=fi===0?s.target:s.targets[s.index].p2;
  if(s.targets[s.index].mod==='laugh'){const sp=st.faces[0];await p.mouse.move(sp.x-60,sp.y+20);await p.mouse.down();for(let i=0;i<10;i++){await p.mouse.move(sp.x+40,sp.y+20,{steps:3});await p.mouse.move(sp.x-60,sp.y+20,{steps:3});}await p.mouse.up();return true;}
  const parts=new Set();for(const k of Object.keys(goal))if(Math.abs(goal[k]-cur[k])>0.02)parts.add(KEYPART[k]);
  for(const part of parts){const now=(await p.evaluate(()=>window.faceShiftState())).state;if(now.phase!=='play')return true;const f=now.faces[fi];const sp=st.faces[fi];const wide=1+f.w*.3,tall=1-f.w*.2;const [lx,ly]=SPOT[part];const x=sp.x+lx*(sp.r/100)*wide,y=sp.y+ly*(sp.r/100)*tall;
   let dx=0,dy=0;if(part==='head'){dx=(goal.w-f.w)*85;dy=(goal.o-f.o)*85;}else{const k=Object.keys(KEYPART).find(k=>KEYPART[k]===part);dy=(goal[k]-f[k])*85*SIGN[part];}
   dx*=mirror;dy*=mirror;dx+=noise*(Math.random()-.5)*20;dy+=noise*(Math.random()-.5)*20;
   await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:6});await p.waitForTimeout(60);await p.mouse.up();await p.waitForTimeout(80);}
 }
 return true;
}
export async function waitPlay(p,timeout=8000){await p.waitForFunction(()=>{const v=window.faceShiftState();return v.mode!=='play'||v.state?.phase==='play';},null,{timeout});}
