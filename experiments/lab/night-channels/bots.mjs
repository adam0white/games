import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

let rules = new URL('./sim.js',import.meta.url);
if (process.argv.includes('--mutate')) {
  const original = await readFile(rules,'utf8');
  const broken = original.replace('cells[b].water+=q;', 'cells[b].water+=q*0.5;');
  assert.notEqual(original,broken,'target face transfer exists');
  rules = 'data:text/javascript;base64,' + Buffer.from(broken).toString('base64');
}
const {create,dig,tick} = await import(rules);

function near(actual,expected,tolerance,message) {
  assert.ok(Math.abs(actual-expected)<=tolerance, message + ': ' + actual + ' vs ' + expected);
}

const mass = s => s.cells.reduce((v,c)=>v+c.water+c.moisture,0);
let maxMassError=0;
function account(s) {
  for (const c of s.cells) {
    assert.ok(Number.isFinite(c.water) && c.water>=-1e-10);
    assert.ok(c.moisture>=0 && c.moisture<=1 && c.growth>=0 && c.growth<=1);
  }
  const residual=Math.abs(mass(s)+s.drained-s.supplied-s.initialWater);
  near(residual,0,1e-8,'surface, soil, percolation and spring mass');
  maxMassError=Math.max(maxMassError,residual);
}
function advance(s,steps) {
  for (let i=0; i<steps && !s.won; i++) { tick(s); account(s); }
}

function neighbours(s,n) {
  return [n-1,n+1,n-s.cols,n+s.cols].filter(m=>m>=0 && m<s.cells.length &&
    Math.abs(n%s.cols-m%s.cols)+Math.abs(Math.floor(n/s.cols)-Math.floor(m/s.cols))===1);
}

// From the visible spring, choose the bed requiring the fewest new cuts.
// Penalize a climb by two cuts. Prefer firm soil on ties. Reuse open channels.
function build(s) {
  const served=new Set();
  while (served.size<s.beds.length) {
    const n=s.cells.length, cost=Array(n).fill(Infinity), prev=Array(n).fill(-1);
    const open=new Set([s.source]);
    cost[s.source]=0;
    while (open.size) {
      let best;
      for (const i of open) if (best===undefined || cost[i]<cost[best]) best=i;
      open.delete(best);
      for (const m of neighbours(s,best)) {
        const c=s.cells[m];
        if (c.kind==='rock') continue;
        const cuts=c.dug || c.kind==='spring' || c.kind==='bed' ? 0 : 1;
        const d=cost[best]+cuts+(m===best-s.cols ? 2 : 0)+(c.kind==='sand' ? .007 : 0)+.0001;
        if (d>=cost[m]) continue;
        cost[m]=d;
        prev[m]=best;
        open.add(m);
      }
    }
    const target=s.beds.filter(i=>!served.has(i)).sort((a,b)=>cost[a]-cost[b])[0];
    if (target===undefined || !Number.isFinite(cost[target])) break;
    const path=[];
    for (let i=target; i!==s.source; i=prev[i]) path.unshift(i);
    served.add(target);
    for (const i of path) {
      if (dig(s,i)) advance(s,3);
    }
  }
}

const first=create(1);
advance(first,1);
const rock=first.cells.findIndex(c=>c.kind==='rock');
assert.equal(dig(first,rock),false);
assert.equal(dig(first,-1),false);
assert.equal(dig(first,3.5),false);
assert.equal(dig(first,first.source),false);
assert.equal(dig(first,first.beds[0]),false);
assert.equal(first.remaining,first.budget);
for (const i of [24,31,38]) {
  const h=first.cells[i].height;
  assert.ok(dig(first,i));
  assert.ok(first.cells[i].height<h);
  assert.equal(dig(first,i),false);
}
assert.equal(first.remaining,first.budget-3);
advance(first,8);
assert.ok(first.cells[24].water>0,'freed water enters freshly lowered soil');
assert.equal(first.cells[first.beds[0]].growth,0,'growth needs sustained wet soil');
advance(first,30*40);
assert.ok(first.won);
assert.equal(dig(first,0),false);
const frozen=structuredClone(first);
tick(first);
assert.deepEqual(first,frozen);

// Physical reference: isolated adjacent cells with a high head on the downhill cell.
// Water climbs the underlying slope until the two free surfaces meet.
function pair(aWater,bWater,kind='soil') {
  const s=create(1);
  s.cells.forEach(c=>Object.assign(c,{kind:'rock',water:0,moisture:0,growth:0}));
  const a=24,b=31;
  Object.assign(s.cells[a],{kind,height:.1,water:aWater});
  Object.assign(s.cells[b],{kind:'soil',height:0,water:bWater});
  s.cells[s.source].kind='spring';
  s.cells[s.source].water=.66;
  s.initialWater=mass(s);
  return s;
}
const reverse=pair(0,.5);
tick(reverse);
near(reverse.cells[24].water+reverse.cells[24].moisture+.00055,.4*.23,1e-12,'first uphill transfer');
account(reverse);
const still=pair(.4,.5);
tick(still);
near(still.cells[24].flowY,0,1e-13,'constant free surface');
const sand=pair(.4,.5,'sand');
tick(sand);
assert.ok(sand.cells[24].moisture>still.cells[24].moisture*5,'sand infiltrates faster');
const dry=create(1);
dry.cells[dry.beds[0]].growth=.5;
advance(dry,90);
assert.equal(dry.cells[dry.beds[0]].growth,0,'unfinished growth wilts in a dry bed');
const empty=create(1);
empty.cells.forEach((c,i)=>dig(empty,i));
assert.equal(empty.remaining,0);
assert.equal(empty.cells.filter(c=>c.dug).length,empty.budget+2);

function solve(level,day=null) {
  const s=create(level,day);
  build(s);
  advance(s,30*90);
  return s;
}
const results=[];
for (let level=1; level<=10; level++) {
  const idle=create(level);
  advance(idle,30*90);
  assert.ok(idle.beds.every(i=>idle.cells[i].growth===0),'without a cut every bed stays dry');
  const s=solve(level);
  console.log('garden',level,'beds',s.beds.length,'cuts',s.budget-s.remaining+'/'+s.budget,'seconds',s.ticks/30,'won',s.won);
  assert.ok(s.won,'campaign garden '+level);
  assert.deepEqual(s,solve(level),'repeated seed and cuts');
  results.push(s.ticks);
}
assert.ok(results[0]<60*30,'first garden under one minute');
const layouts=new Set(), dailyTicks=[], dailyCuts=[];
for (let d=0; d<365; d++) {
  const day=new Date(Date.UTC(2026,10,24+d)).toISOString().slice(0,10);
  const s=solve(1,day);
  assert.ok(s.won,'daily '+day);
  dailyTicks.push(s.ticks);
  dailyCuts.push(s.budget-s.remaining);
  layouts.add(s.cells.map(c=>c.kind[0]).join('')+'/'+s.beds.join(','));
  if (d<2) assert.deepEqual(s,solve(1,day));
}
assert.equal(layouts.size,365,'daily terrain and bed placements vary');
console.log('daily',layouts.size,'cuts',Math.min(...dailyCuts),Math.max(...dailyCuts),
  'ticks',Math.min(...dailyTicks),Math.max(...dailyTicks));

// A long shared channel crossing row four loses enough head to starve two beds.
// Moving the cross-channel to row two gives all three downhill water at a cost of two more cuts.
const starved=solve(1,'2029-05-27');
assert.equal(starved.beds.filter(i=>starved.cells[i].growth===1).length,1);
assert.equal(starved.budget-starved.remaining,13);
function cutTerrace(s,row) {
  const trunk=s.source%s.cols;
  const path=new Set();
  for (let y=0; y<=row; y++) path.add(y*s.cols+trunk);
  for (const target of s.beds) {
    const x=target%s.cols;
    for (let col=Math.min(x,trunk); col<=Math.max(x,trunk); col++) path.add(row*s.cols+col);
    for (let i=row*s.cols+x; i<=target; i+=s.cols) path.add(i);
  }
  for (const i of path) {
    assert.notEqual(s.cells[i].kind,'rock','protected route is open');
    dig(s,i);
  }
}
const terrace=create(1,'2029-05-27');
cutTerrace(terrace,2);
advance(terrace,30*90);
assert.ok(terrace.won,'high cross-channel feeds all three beds');
console.log('terrace comparison',starved.budget-starved.remaining,terrace.budget-terrace.remaining,terrace.ticks);
console.log('maximum mass residual',maxMassError);

// Long generator audit. The eighth layout draw selects which terrace was reserved.
// Replay that choice independently of the generator's protected-cell set.
if (process.argv.includes('--extended')) {
  let latest=0, slowest, mostCuts=0, minSpare=Infinity;
  for (let d=0; d<5000; d++) {
    const day=new Date(Date.UTC(2026,10,24+d)).toISOString().slice(0,10);
    const s=create(1,day);
    let r=s.seed;
    for (let draw=0; draw<8; draw++) r=(Math.imul(1664525,r)+1013904223)>>>0;
    cutTerrace(s,2+(r>>>31));
    for (let i=0; i<2700 && !s.won; i++) tick(s);
    assert.ok(s.won,'protected route on '+day);
    if (s.ticks>latest) { latest=s.ticks; slowest=day; }
    mostCuts=Math.max(mostCuts,s.budget-s.remaining);
    minSpare=Math.min(minSpare,s.remaining);
  }
  console.log('5000 protected terraces; slowest',slowest,latest,'ticks; maximum cuts',mostCuts,'minimum spare',minSpare);
}
