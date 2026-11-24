// Pure rules. Node ids are indices; all times are seconds.
export const LEVELS = [
  {title:'First light',lesson:'Draw a path through the lamps.',xy:[[24,115],[48,91],[73,64]],edges:[[0,1],[1,2]],homes:[2]},
  {title:'Two doorways',lesson:'One lit junction serves two homes.',xy:[[50,122],[50,92],[22,65],[78,65]],edges:[[0,1],[1,2],[1,3]],homes:[2,3]},
  {title:'A little wind',lesson:'Return to a lamp after the breeze.',xy:[[25,120],[45,96],[69,72],[48,43]],edges:[[0,1],[1,2],[2,3]],homes:[3],wind:[2.2,1]},
  {title:'The home light',lesson:'A home stays bright after arrival.',xy:[[24,121],[43,96],[24,70],[68,73],[77,43]],edges:[[0,1],[1,2],[1,3],[3,4]],homes:[2,4],wind:[5,2]},
  {title:'The fork',lesson:'Light both arms of the path.',xy:[[50,124],[50,99],[27,78],[16,49],[73,78],[84,49]],edges:[[0,1],[1,2],[2,3],[1,4],[4,5]],homes:[3,5],wind:[3,1]},
  {title:'Around the green',lesson:'A loop gives the keeper a short return.',xy:[[24,122],[24,94],[50,76],[77,94],[77,122],[50,43]],edges:[[0,1],[1,2],[2,3],[3,4],[4,0],[2,5]],homes:[4,5],wind:[3.1,1]},
  {title:'Three windows',lesson:'Finish a short branch before the long climb.',xy:[[50,125],[50,101],[23,80],[17,51],[75,80],[84,51],[51,52],[50,30]],edges:[[0,1],[1,2],[2,3],[1,4],[4,5],[1,6],[6,7]],homes:[3,5,7],wind:[4,1]},
  {title:'The crossing',lesson:'A shared path needs only one flame.',xy:[[22,123],[45,101],[22,76],[46,53],[77,77],[79,43],[14,44]],edges:[[0,1],[1,2],[2,3],[3,4],[4,1],[4,5],[2,6]],homes:[3,5,6],wind:[4,2]},
  {title:'The upper lane',lesson:'Watch the breeze before leaving the junction.',xy:[[49,124],[49,99],[21,79],[18,49],[49,53],[77,80],[83,49],[49,30]],edges:[[0,1],[1,2],[2,3],[2,4],[4,5],[5,1],[5,6],[4,7]],homes:[3,6,7],wind:[4.5,4]},
  {title:'All the hillside',lesson:'Join the branches and bring everyone home.',xy:[[49,125],[49,102],[23,83],[17,55],[48,61],[77,83],[84,55],[26,31],[70,31]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,1],[5,6],[3,7],[4,8]],homes:[6,7,8],wind:[4,2]}
];
export function dailySeed(dateString) {
  let h=2166136261;
  for (const c of String(dateString)) h=Math.imul(h^c.charCodeAt(0),16777619);
  return h>>>0;
}
function random(seed) { let a=seed>>>0; return ()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;}; }
export function shortestPath(s,from,to,litOnly=false) {
  const q=[[from]],seen=new Set([from]);
  for(let i=0;i<q.length;i++){const p=q[i],n=p.at(-1);if(n===to)return p;
    for(const [a,b] of s.edges){const next=a===n?b:b===n?a:null;if(next!==null&&!seen.has(next)&&(!litOnly||s.nodes[next].lit||s.nodes[next].homeLight)){seen.add(next);q.push([...p,next]);}}}
  return [];
}
function event(s,type,node){s.events.push({type,node,t:s.t});if(s.events.length>128)s.events.shift();}
export function create(level=1,seed=1,{mutate=false}={}) {
  level=Math.max(1,Math.min(10,Math.trunc(level)||1));
  const spec=LEVELS[level-1],rng=random(seed),daily=level===10&&seed!==10;
  const nodes=spec.xy.map(([x,y],i)=>({x:daily?Math.max(12,Math.min(88,x+(rng()-.5)*9)):x,y:daily?Math.max(30,Math.min(125,y+(rng()-.5)*7)):y,lit:i===0,homeLight:i===0}));
  const s={level,seed,t:0,budget:level===1?18:55,status:'play',nodes,edges:spec.edges.map(e=>[...e]),keeper:{x:nodes[0].x,y:nodes[0].y,node:0,target:null,queue:[]},people:[],gust:spec.wind?{at:spec.wind[0]+(daily?rng()*1.5:0),node:spec.wind[1]}:null,rescued:0,total:spec.homes.length,score:0,events:[],_carry:0,_mutate:mutate,_gustDone:false};
  // Daily puzzles change destinations as well as geometry and gust timing.
  const homes=daily?(rng()<.5?[6,7,8]:[3,6,8]):spec.homes;
  for(const home of homes)s.people.push({x:nodes[0].x,y:nodes[0].y,home,at:0,done:false,path:shortestPath(s,0,home),_next:1,_moving:false});
  return s;
}
export function route(s,ids) {
  if(s.status!=='play'||!Array.isArray(ids)||!ids.length)return false;
  const anchor=s.keeper.target??s.keeper.node;
  if(ids[0]!==anchor||ids.some(id=>!Number.isInteger(id)||!s.nodes[id]))return false;
  for(let i=1;i<ids.length;i++)if(!s.edges.some(([a,b])=>(a===ids[i-1]&&b===ids[i])||(b===ids[i-1]&&a===ids[i])))return false;
  s.keeper.queue=ids.slice(1);event(s,'route',anchor);return true;
}
function move(entity,to,distance){const dx=to.x-entity.x,dy=to.y-entity.y,d=Math.hypot(dx,dy);if(d<=distance+1e-9){entity.x=to.x;entity.y=to.y;return true;}entity.x+=dx/d*distance;entity.y+=dy/d*distance;return false;}
function tick(s,dt) {
  s.t=+(s.t+dt).toFixed(6);
  if(s.gust&&!s._gustDone&&s.t>=s.gust.at){s._gustDone=true;const n=s.nodes[s.gust.node];if(!n.homeLight){n.lit=false;event(s,'wind',s.gust.node);}else event(s,'sheltered',s.gust.node);}
  const k=s.keeper;
  if(k.target===null&&k.queue.length)k.target=k.queue.shift();
  if(k.target!==null&&move(k,s.nodes[k.target],38*dt)){
    k.node=k.target;k.target=null;
    if(!s._mutate&&!s.nodes[k.node].lit){s.nodes[k.node].lit=true;event(s,'light',k.node);}
  }
  for(const p of s.people){if(p.done)continue;
    if(!p._moving){const litPath=shortestPath(s,p.at,p.home,true);if(litPath.length){p.path=litPath;p._next=1;}}
    const next=p.path[p._next];if(next===undefined)continue;
    // A neighbour waits whenever either end of the occupied path is dark.
    if(!(s.nodes[p.at].lit||s.nodes[p.at].homeLight)||!(s.nodes[next].lit||s.nodes[next].homeLight))continue;
    p._moving=true;
    if(move(p,s.nodes[next],17*dt)){p.at=next;p._next++;p._moving=false;if(next===p.home){p.done=true;s.rescued++;s.nodes[next].homeLight=true;s.nodes[next].lit=true;event(s,'home',next);}}
  }
  if(s.rescued===s.total){s.status='won';s.score=Math.max(0,Math.round((s.budget-s.t)*100+s.total*500));event(s,'won',null);}
  else if(s.t>=s.budget){s.status='lost';event(s,'lost',null);}
}
export function step(s,dt) {
  if(s.status!=='play'||!Number.isFinite(dt)||dt<=0)return s;
  s._carry+=dt;
  while(s._carry+1e-10>=.025&&s.status==='play'){s._carry-=.025;tick(s,.025);}
  return s;
}
