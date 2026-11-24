// Deterministic rule checks. Run with Node; no dependencies.
import assert from 'node:assert/strict';
import { KINDS, load, localDay, validDay, count, canAdd, addStar, counts, celebration, place, member, ROWS, demo } from './sim.js';
const today = '2026-11-23';
assert.equal(validDay('2026-02-30'), false);
assert.equal(validDay('2024-02-29'), true);
for (const raw of [null, {}, [], {v:2}, {v:1, days:[]}, {v:1, days:{bad:[{k:'bread'}]}}]) assert.deepEqual(load(raw).days, {});
const repaired = load({v:1,look:'bad',sound:'yes',days:{[today]:[{k:'bad'},null,...Array(5).fill({k:'bread'})]}});
assert.equal(repaired.look,'sky'); assert.equal(repaired.sound,true); assert.equal(count(repaired,today),3);
const s=load(null);
for(let i=0;i<3;i++) assert.equal(addStar(s,today,KINDS[i]),true);
const before=JSON.stringify(s);
assert.equal(canAdd(s,today),false); assert.equal(addStar(s,today,'light'),false); assert.equal(JSON.stringify(s),before);
assert.deepEqual(load(JSON.parse(JSON.stringify(s))),s,'save round trip');
assert.equal(addStar(s,'bad','bread'),false); assert.equal(addStar(s,'2026-11-24','unknown'),false);
const custom=load(null); addStar(custom,today,'spark',' 🌟'.repeat(40)); assert.equal(Array.from(custom.days[today][0].t).length,24);
const history=load(null), centres=[];
for(let day=0;day<400;day++) {
  const d=new Date('2025-01-01T12:00:00'); d.setDate(d.getDate()+day); const date=localDay(d);
  const ms=[0,1,2].map(i=>member(date,i));
  assert.deepEqual(ms,[0,1,2].map(i=>member(date,i)),'deterministic lights'); assert.deepEqual(place(day),place(day),'deterministic places');
  for(const m of ms) assert.ok(Math.hypot(m.dx,m.dy)<=1.0001,'a light stays inside its day');
  for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) assert.ok(Math.hypot(ms[i].dx-ms[j].dx,ms[i].dy-ms[j].dy)>.55,'lights of one day stay apart');
  const q=place(day); assert.ok(q.y>0&&q.y<1&&q.row<ROWS,'inside the band'); centres.push(q);
  for(let i=0;i<3;i++) addStar(history,date,KINDS[(day+i)%KINDS.length]);
  assert.equal(celebration(history),(day+1)%7===0,'every seventh completed day');
}
// On the smallest phone the band is about 244 px tall and a column is 66 px wide; a day's lights reach 14 px from its place.
for(let i=0;i<centres.length;i++)for(let j=i+1;j<Math.min(centres.length,i+3*ROWS);j++){const a=centres[i],c=centres[j];assert.ok(Math.hypot((a.x-c.x)*66,(a.y-c.y)*244)>30,`days ${i} and ${j} do not stack`);}
assert.equal(new Set(centres.map(q=>q.col+':'+q.row)).size,400,'every day has its own place');
assert.deepEqual(counts(history),{days:400,lights:1200,complete:400});
// Demo is pure data generation. Any storage access here is an error.
globalThis.localStorage={getItem(){throw Error('demo read storage');},setItem(){throw Error('demo wrote storage');}};
assert.deepEqual(counts(demo(today,40)),{days:40,lights:120,complete:40});
assert.equal(JSON.stringify(s),before,'demo leaves the real save untouched');
console.log('ok thankful: deterministic layout, 400 days, daily cap, save repair, demo isolation, weekly celebration');
