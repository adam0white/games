import assert from 'node:assert/strict';
import {create,step,route,dailySeed,LEVELS} from './sim.js';

const mutate=process.argv.includes('--mutate');
const make=(level,seed=level)=>create(level,seed,{mutate});
// Independent breadth-first planner; it uses only the public graph and route API.
function path(s,start,end){const todo=[[start]],seen=new Set([start]);while(todo.length){const p=todo.shift(),at=p.at(-1);if(at===end)return p;for(const e of s.edges){const next=e[0]===at?e[1]:e[1]===at?e[0]:null;if(next!==null&&!seen.has(next)){seen.add(next);todo.push([...p,next]);}}}throw Error('Disconnected graph');}
function distance(s,p){return p.slice(1).reduce((v,n,i)=>v+Math.hypot(s.nodes[n].x-s.nodes[p[i]].x,s.nodes[n].y-s.nodes[p[i]].y),0);}
function rng(seed){let a=seed>>>0;return ()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};}
function play(level,seed=level,clumsy=false,policySeed=seed){const s=make(level,seed),r=rng(policySeed+113),trace=[];let nextDecision=0;
  while(s.status==='play'){
    if(s.keeper.target===null&&!s.keeper.queue.length&&s.t>=nextDecision){
      const anchor=s.keeper.node;
      const needed=[...new Set(s.people.filter(p=>!p.done).flatMap(p=>p.path))].filter(n=>!s.nodes[n].lit&&!s.nodes[n].homeLight);
      if(needed.length){let p=needed.map(n=>path(s,anchor,n)).sort((a,b)=>distance(s,a)-distance(s,b))[0];
        if(clumsy&&r()<.45){const adjacent=s.edges.filter(e=>e.includes(anchor)).map(e=>e[0]===anchor?e[1]:e[0]);p=[anchor,adjacent[Math.floor(r()*adjacent.length)]];}
        assert.equal(route(s,p),true);trace.push(p);nextDecision=s.t+(clumsy?.3+r()*1.2:0);
      }
    }
    step(s,.05);
  }
  return {s,trace};
}

assert.equal(LEVELS.length,10);
assert.equal(new Set(LEVELS.map(x=>x.lesson)).size,10);
const first=make(1);assert.deepEqual(first.edges,[[0,1],[1,2]]);assert.deepEqual(first.people[0].path,[0,1,2]);
const before=JSON.stringify(first);assert.equal(route(first,[0,2]),false);assert.equal(JSON.stringify(first),before,'invalid route must be atomic');
assert.equal(route(first,[0,1,2]),true);step(first,.25);assert.equal(first.keeper.target,1);
const moving={x:first.keeper.x,y:first.keeper.y,target:first.keeper.target};
assert.equal(route(first,[1,0]),true);assert.equal(first.keeper.target,moving.target);assert.equal(first.keeper.x,moving.x);assert.equal(first.keeper.y,moving.y);assert.deepEqual(first.keeper.queue,[0]);
assert.equal(route(first,[0,1]),false,'mid-edge route must start at target');

// A fully lit detour must serve neighbours even when their initial shortest path is dark.
const detour=make(10,10);assert.equal(route(detour,[0,1,5,6,5,4,8,4,3,7]),true);step(detour,54);
assert.equal(detour.status,'won','lit detour must bring every neighbour home');assert.equal(detour.rescued,3);
// Wind stops a neighbour on an edge without changing its segment or position.
const interrupted=make(3);route(interrupted,[0,1,2,3]);step(interrupted,2.175);
const walker=interrupted.people[0];assert.notEqual(walker.x,interrupted.nodes[walker.at].x);
const occupied={x:walker.x,y:walker.y,at:walker.at,next:walker.path[walker._next]};step(interrupted,.1);
assert.equal(walker.x,occupied.x);assert.equal(walker.y,occupied.y);assert.equal(walker.at,occupied.at);assert.equal(walker.path[walker._next],occupied.next);
assert.equal(route(interrupted,path(interrupted,interrupted.keeper.target??interrupted.keeper.node,1)),true);
while(interrupted.status==='play'&&interrupted.t<20){const x=walker.x,y=walker.y;step(interrupted,.05);assert.ok(Math.hypot(walker.x-x,walker.y-y)<=17*.05+1e-8,'relighting must resume movement without teleportation');}
assert.equal(interrupted.status,'won');

const careful=[];
for(let level=1;level<=10;level++){
  const a=play(level),b=play(level);
  assert.equal(a.s.status,'won',`evening ${level} must be solvable`);
  assert.deepEqual(a,b,`evening ${level} must be deterministic`);
  assert.ok(a.s.t<=(level===1?12:45),`evening ${level} exceeds play-time acceptance`);
  assert.equal(a.s.rescued,a.s.total);assert.ok(a.s.people.every(p=>p.done&&a.s.nodes[p.home].homeLight));
  const idle=make(level);step(idle,idle.budget+1);assert.equal(idle.status,'lost');assert.equal(idle.rescued,0);
  careful.push({level,seconds:a.s.t,routes:a.trace.length,wind:a.s.events.filter(e=>e.type==='wind').length});
}
// An actual lit lamp is extinguished during play, then the same lamp is relit.
const windy=make(3);route(windy,[0,1,2,3]);step(windy,2.25);
assert.equal(windy.status,'play');assert.equal(windy.nodes[1].lit,false);
const wind=windy.events.find(e=>e.type==='wind'&&e.node===1);assert.ok(wind);
assert.ok(windy.events.some(e=>e.type==='light'&&e.node===1&&e.t<wind.t));
const anchor=windy.keeper.target??windy.keeper.node;route(windy,path(windy,anchor,1));
while(windy.status==='play'&&(windy.keeper.target!==null||windy.keeper.queue.length))step(windy,.05);
assert.equal(windy.nodes[1].lit,true,'return must relight extinguished lamp');
assert.ok(windy.events.some(e=>e.type==='light'&&e.node===1&&e.t>wind.t));
// A permanent home light withstands an otherwise identical breeze.
const sheltered=make(3);sheltered.nodes[1].homeLight=true;sheltered.nodes[1].lit=true;step(sheltered,2.25);assert.equal(sheltered.nodes[1].lit,true);assert.ok(sheltered.events.some(e=>e.type==='sheltered'));
const dates=['2026-11-24','2026-11-25','2026-11-26','2026-11-27'];
const daily=dates.map(d=>{const seed=dailySeed(d),a=play(10,seed),b=play(10,seed);assert.deepEqual(a,b);assert.equal(a.s.status,'won');return {date:d,seed,seconds:a.s.t,homes:a.s.people.map(p=>p.home),nodes:a.s.nodes.map(n=>[n.x,n.y])};});
assert.equal(new Set(daily.map(x=>x.seed)).size,dates.length);
assert.ok(new Set(daily.map(x=>JSON.stringify([x.homes,x.nodes]))).size>1,'daily puzzle must change');
const clumsy=[];for(let level=1;level<=10;level++){const runs=Array.from({length:20},(_,i)=>play(level,level,true,1000+level*20+i));clumsy.push({level,wins:runs.filter(r=>r.s.status==='won').length,runs:runs.length,meanSeconds:+(runs.reduce((v,r)=>v+r.s.t,0)/runs.length).toFixed(3)});}
console.log(JSON.stringify({careful,daily:daily.map(({nodes,...rest})=>rest),clumsy,checks:['contiguous routes','mid-edge replacement','determinism','idle loss','all evenings solved','mid-play wind and relight','permanent home light','daily variation','lit detour','mid-edge wind preserves position']},null,2));
