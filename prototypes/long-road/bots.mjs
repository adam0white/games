// Headless acceptance: choices must end the trip, not leave it running forever.
import assert from 'node:assert/strict';
import { create, step, DT } from './sim.mjs';

export function run(seed, policy) {
  const s = create(seed);
  let ticks = 0;
  while (!s.over && ticks++ < 30 * 650) step(s, policy(s, ticks));
  assert.ok(s.over, `seed ${seed}: no ending by 650 seconds`);
  return s;
}
const policies = {
  abandoned: () => undefined,
  ruthless(s, n) {
    if (n === 1) return {type:'pace',value:2};
    if (n === 2) return {type:'rations',value:0};
    if (s.phase === 'stop') return {type:'route',value:'rough'};
    if (n % 90 === 0 && s.broken) return {type:'ask',person:1,task:'mend'};
  },
  hurried(s,n) {
    if(n===1)return {type:'pace',value:2};
    if(n===2)return {type:'rations',value:2};
    if(s.phase==='stop')return {type:'route',value:'rough'};
    if(n%90===0&&s.broken)return {type:'ask',person:1,task:'mend'};
  },
  careful(s, n) {
    if (n === 1) return {type:'rations',value:1};
    if (s.phase === 'stop' && s.t > s.stopUntil - 2) return {type:'route',value:s.day > s.stop * 2.1 ? 'rough':'gentle'};
    if (n % 90 !== 0) return;
    const available = s.people.map((p,i)=>({p,i})).filter(({p})=>!p.left && !p.job && p.speechUntil < s.t);
    const task = s.broken || s.cart < 45 ? 'mend' : !s.forageDone && s.food < 90 ? 'forage' : !s.scouted ? 'scout' : !s.watch ? 'watch' : !s.carrying && s.people.some(p=>p.health<.75) ? 'carry' : null;
    if (!task) return;
    const skill = {mend:'mender',forage:'forager',scout:'scout',watch:'watcher',carry:'carrier'}[task];
    available.sort((a,b)=>(a.p.skill===skill?-1:0)-(b.p.skill===skill?-1:0) || a.p.fatigue-b.p.fatigue);
    if (available.length) return {type:'ask',person:available[0].i,task};
  },
};
const total = Number(process.argv[2] || 4);
const endings = new Set();
for (const [name,policy] of Object.entries(policies)) {
  const counts = {}, durations=[];
  for (let seed=1;seed<=total;seed++) {
    const s=run(seed,policy); endings.add(s.over);counts[s.over]=(counts[s.over]||0)+1;durations.push(Math.round(s.t));
    assert.ok(s.t>=360 && s.t<=600,`Session outside six–ten minutes: ${s.t}`);
    assert.ok(s.people.every(p=>p.health>=0 && p.health<=1));
  }
  console.log(name,JSON.stringify(counts),`seconds ${durations.join(',')}`);
}
assert.ok(endings.size>1,'Policies must produce different endings');
const a=run(73,policies.careful), b=run(73,policies.careful);
assert.equal(JSON.stringify(a.log),JSON.stringify(b.log),'Seed and inputs must replay identically');
assert.equal(a.over,b.over);
console.log(`Seeded replay agrees. Fixed step ${DT}.`);
