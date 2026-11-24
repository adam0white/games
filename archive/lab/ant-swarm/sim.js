// Pure, fixed-step pheromone simulation. Coordinates are meadow units, y increases downwards.
export const DT = 1 / 30, WORLD_W = 100, WORLD_H = 150, COLS = 50, ROWS = 75;
export const LEVELS = [
  { title:'A scent of supper', cue:'Draw from the nest to the berry', goal:800, duration:40, feature:'trail' },
  { title:'Across the meadow', cue:'Long trails need a fresh touch', goal:700, duration:21, feature:'distance' },
  { title:'The puddle', cue:'Draw around the water', goal:550, duration:29, feature:'puddle' },
  { title:'Together', cue:'Gather the swarm on the beetle', goal:700, duration:31, feature:'beetle' },
  { title:'Silk road', cue:'A thick column breaks the web', goal:800, duration:32, feature:'web' },
  { title:'Rain bands', cue:'Refresh the scent after rain', goal:900, duration:35, feature:'rain' },
  { title:'Under a wing', cue:'Shadow coming? Lift your finger', goal:1100, duration:40, feature:'bird' },
  { title:'Two harvests', cue:'The next berry needs a new trail', goal:850, duration:44, feature:'colony' },
];
const MAX = 1500, N = COLS * ROWS, TAU = Math.PI * 2;
// Fixed low device caps and a colony already at 1500 cannot use all earned offspring.
// Compensate lost growth; 600 initial ants remain the quota reference.
const capacity=n=>n/600*(n<600?.7+.3*n/600:1-.15*(n-600)/900);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rand(s) { s.r=(s.r+0x6d2b79f5)|0; let t=s.r; t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
const at=(x,y)=>clamp(Math.floor(y/2),0,ROWS-1)*COLS+clamp(Math.floor(x/2),0,COLS-1);
function nextHarvest(s){const layout={r:(s.seed^Math.imul(s.wave,0x45d9f3b))|0};return {x:18+rand(layout)*64,y:32+rand(layout)*28,amount:10000,max:10000};}
function spawn(s,i) { const a=rand(s)*TAU, r=rand(s)*5; s.x[i]=s.home.x+Math.cos(a)*r;s.y[i]=s.home.y+Math.sin(a)*r;s.angle[i]=a;s.carry[i]=0;s.age[i]=0;s.trips[i]=0;s.stuck[i]=0;s.fear[i]=0; }
export function create({seed=1,level=0,ants=600,endless=false,mutation=null}={}) {
  const L=clamp(level|0,0,7), cfg=LEVELS[L];
  const s={seed,r:seed|0,level:L,endless,mutation,time:0,tick:0,events:[],status:'play',delivered:0,initialAnts:clamp(ants|0,300,MAX),goal:Math.round(cfg.goal*capacity(clamp(ants|0,300,MAX))),baseGoal:cfg.goal,wave:0,waveGoal:cfg.goal,duration:endless?60:cfg.duration,remaining:endless?60:cfg.duration,
    home:{x:50,y:125},food:[],puddles:[],beetles:[],webs:[],rain:{active:false,y:-20,width:10},bird:{active:false,warning:false,x:50,y:70,r:25},
    count:clamp(ants|0,300,MAX),antLimit:MAX,population:clamp(ants|0,300,MAX),growth:0,painting:false,paintAge:99,
    x:new Float32Array(MAX),y:new Float32Array(MAX),angle:new Float32Array(MAX),carry:new Uint8Array(MAX),age:new Float32Array(MAX),trips:new Uint16Array(MAX),stuck:new Float32Array(MAX),fear:new Float32Array(MAX),
    toFood:new Float32Array(N),toHome:new Float32Array(N),ink:new Float32Array(N),inkX:new Float32Array(N),inkY:new Float32Array(N),scratch:new Float32Array(N),density:new Uint16Array(N),
    metrics:{findTimes:[],firstFindTimes:[],repeatFindTimes:[],deliveries:0,paintCalls:0,webBreaks:0,beetlesBeaten:0,birdScatters:0}};
  const fy=L===0?84:L===1?72:49;
  s.food=[{x:L===0?50:72,y:fy,amount:endless?10000:s.goal*3+150,max:endless?10000:s.goal*3+150}];
  if(L===7){const total=s.food[0].amount;s.food[0].amount=s.food[0].max=Math.round(s.goal*.48);s.food.push({x:25,y:60,amount:total-s.food[0].amount,max:total-s.food[0].amount});}
  if(L>=2)s.puddles.push({x:55,y:86,rx:20,ry:10});
  if(L>=3)s.beetles.push({x:72,y:61,r:7,need:14+L,pressure:0,defeated:false});
  if(L>=4)s.webs.push({x:79,y:77,r:8,need:18+L,pressure:0,broken:false});
  for(let i=0;i<s.count;i++)spawn(s,i);
  return s;
}
export function setAntLimit(s,n) { n=clamp(Math.round(n),300,MAX); const old=s.count;s.antLimit=n;s.count=Math.min(n,s.population);if(!s.endless)s.goal=Math.min(s.goal,Math.round(s.baseGoal*capacity(Math.min(s.initialAnts,n))));for(let i=old;i<s.count;i++)spawn(s,i); }
export function paint(s,x,y,fromX=x,fromY=y) {
  if(s.status!=='play')return;
  x=clamp(x,1,99);y=clamp(y,1,149);fromX=clamp(fromX,1,99);fromY=clamp(fromY,1,149);
  const d=Math.hypot(x-fromX,y-fromY),steps=Math.max(1,Math.ceil(d));
  let vx=d>.1?(x-fromX)/d:0,vy=d>.1?(y-fromY)/d:0;
  for(let k=0;k<=steps;k++) {const px=fromX+(x-fromX)*k/steps,py=fromY+(y-fromY)*k/steps,cx=Math.floor(px/2),cy=Math.floor(py/2);
    for(let yy=Math.max(0,cy-3);yy<=Math.min(ROWS-1,cy+3);yy++)for(let xx=Math.max(0,cx-3);xx<=Math.min(COLS-1,cx+3);xx++){
      const dd=Math.hypot((xx+.5)*2-px,(yy+.5)*2-py);if(dd>6)continue;const j=yy*COLS+xx,v=(1-dd/6)*5;
      if(v>s.ink[j]){s.ink[j]=v;s.inkX[j]=vx;s.inkY[j]=vy;}
    }
  }
  s.painting=true;s.paintAge=0;s.metrics.paintCalls++;
}
export function lift(s){s.painting=false;}
function diffuse(s,a,decay,mix) {
  const b=s.scratch;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const j=y*COLS+x,v=a[j];const neighbours=a[j-(y>0?COLS:0)]+a[j+(y<ROWS-1?COLS:0)]+a[j-(x>0?1:0)]+a[j+(x<COLS-1?1:0)];b[j]=Math.max(0,((1-mix)*v+mix*.25*neighbours)*decay);}
  a.set(b);
}
function heading(a,target,gain){let d=target-a;while(d>Math.PI)d-=TAU;while(d< -Math.PI)d+=TAU;return a+clamp(d,-gain,gain);}
function scent(s,field,x,y,a) {return field[at(x+Math.cos(a)*5,y+Math.sin(a)*5)];}
function hazardTicks(s){
  const t=s.time;
  s.rain.active=s.level>=5&&t%9>3&&t%9<6.5;s.rain.y=((t%9)-3)*48;
  if(s.rain.active)for(let j=0;j<N;j++){const y=(Math.floor(j/COLS)+.5)*2;if(Math.abs(y-s.rain.y)<s.rain.width){s.ink[j]*=.58;s.toFood[j]*=.72;s.toHome[j]*=.72;}}
  const b=s.bird,bp=t%11;b.warning=s.level>=6&&bp>5&&bp<6.5;b.active=s.level>=6&&bp>=6.5&&bp<8.6;b.x=15+(bp-6.5)*35;b.y=91;
  for(const beetle of s.beetles)if(!beetle.defeated){let crowd=0;for(let i=0;i<s.count;i++)if(Math.hypot(s.x[i]-beetle.x,s.y[i]-beetle.y)<11)crowd++;beetle.pressure=crowd;if(crowd>=beetle.need){beetle.defeated=true;s.metrics.beetlesBeaten++;s.events.push({type:'beetle',x:beetle.x,y:beetle.y});}}
  for(const web of s.webs)if(!web.broken){let crowd=0;for(let i=0;i<s.count;i++)if(Math.hypot(s.x[i]-web.x,s.y[i]-web.y)<web.r+2)crowd++;web.pressure=crowd;if(crowd>=web.need){web.broken=true;s.metrics.webBreaks++;s.events.push({type:'web',x:web.x,y:web.y});}}
}
export function step(s){
  if(s.status!=='play')return;
  s.tick++;s.time=s.tick*DT;s.remaining=Math.max(0,s.duration-s.time);s.paintAge+=DT;
  diffuse(s,s.toFood,.989,.17);diffuse(s,s.toHome,.992,.17);diffuse(s,s.ink,.976,.08);
  hazardTicks(s);s.density.fill(0);
  for(let i=0;i<s.count;i++)s.density[at(s.x[i],s.y[i])]++;
  for(let i=0;i<s.count;i++){
    let x=s.x[i],y=s.y[i],a=s.angle[i],carrying=s.carry[i],cell=at(x,y),speed=s.level===0?8.5:12;
    s.age[i]+=DT;s.fear[i]=Math.max(0,s.fear[i]-DT);
    const field=carrying?s.toHome:s.toFood;
    // Three antennae compare a continuously evaporating, diffusing field. Returning ants lay food scent;
    // searching ants lay nest scent, strongest near the nest. These fields reinforce successful paths.
    const reward=carrying?5:3;
    const deposit=carrying?s.toFood:s.toHome;
    deposit[cell]=Math.min(16,deposit[cell]+reward*DT*(carrying?1:Math.exp(-s.age[i]/9)));
    const left=scent(s,field,x,y,a-.65),front=scent(s,field,x,y,a),right=scent(s,field,x,y,a+.65);
    if(left>front+.003&&left>right)a-=.19;else if(right>front+.003)a+=.19;
    a+=(rand(s)-.5)*.47;
    if(carrying){a=heading(a,Math.atan2(s.home.y-y,s.home.x-x),.13);}
    else {
      const ink=s.ink[cell];
      if(ink>.09){
        const il=scent(s,s.ink,x,y,a-.8),ir=scent(s,s.ink,x,y,a+.8),ic=scent(s,s.ink,x,y,a);
        if(il>ic+.02&&il>ir)a-=.22;else if(ir>ic+.02)a+=.22;
        const vx=s.inkX[cell],vy=s.inkY[cell];if(Math.abs(vx)+Math.abs(vy)>.1)a=heading(a,Math.atan2(vy,vx),.23);
      }else{
        // A faint local attraction lets ants join a hand-drawn trail without teleporting onto it.
        const il=scent(s,s.ink,x,y,a-1),ir=scent(s,s.ink,x,y,a+1),ic=scent(s,s.ink,x,y,a);
        if(il>ic+.04&&il>ir)a-=.3;else if(ir>ic+.04)a+=.3;
      }
      for(const f of s.food)if(f.amount>0&&Math.hypot(f.x-x,f.y-y)<15)a=heading(a,Math.atan2(f.y-y,f.x-x),.35);
    }
    for(const w of s.webs)if(!w.broken&&Math.hypot(w.x-x,w.y-y)<w.r){speed*=.12;s.stuck[i]+=DT;}else s.stuck[i]=0;
    const bird=s.bird;
    if(bird.active&&Math.hypot(bird.x-x,bird.y-y)<bird.r){
      if(s.painting){a=heading(a,Math.atan2(y-bird.y,x-bird.x),.65);speed=20;s.fear[i]=2.8;if(s.carry[i]){s.carry[i]=0;s.metrics.birdScatters++;}}
      else speed*=.12;
    }
    if(s.fear[i]>0)speed*=.3;
    let nx=x+Math.cos(a)*speed*DT,ny=y+Math.sin(a)*speed*DT;
    for(const p of s.puddles){const q=(nx-p.x)**2/p.rx**2+(ny-p.y)**2/p.ry**2;if(q<1){a+=.75;nx=x+Math.cos(a)*speed*DT;ny=y+Math.sin(a)*speed*DT;if((nx-p.x)**2/p.rx**2+(ny-p.y)**2/p.ry**2<1){nx=x;ny=y;}}}
    if(nx<2||nx>98){a=Math.PI-a;nx=clamp(nx,2,98);}if(ny<3||ny>147){a=-a;ny=clamp(ny,3,147);}
    s.x[i]=nx;s.y[i]=ny;s.angle[i]=((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
    if(!s.carry[i])for(const f of s.food)if(f.amount>0&&Math.hypot(f.x-nx,f.y-ny)<5){
      if(s.beetles.some(b=>!b.defeated&&Math.hypot(f.x-b.x,f.y-b.y)<20))break;
      f.amount--;s.carry[i]=1;s.angle[i]+=Math.PI;s.metrics.findTimes.push(s.age[i]);(s.trips[i]?s.metrics.repeatFindTimes:s.metrics.firstFindTimes).push(s.age[i]);s.trips[i]++;s.age[i]=0;
      if(s.tick%3===0)s.events.push({type:'food',x:nx,y:ny});break;
    }
    else{} // the explicit branch below also covers a pickup on this tick
    if(s.carry[i]&&Math.hypot(nx-s.home.x,ny-s.home.y)<6&&s.mutation!=='noDelivery'){
      s.carry[i]=0;s.angle[i]+=Math.PI;s.age[i]=0;s.delivered++;s.metrics.deliveries++;s.growth++;
      if(s.delivered%4===0)s.events.push({type:'delivery',x:s.home.x,y:s.home.y,n:s.delivered});
    }
  }
  // Delivered food grows the physical population. Adaptive device limits remain a hard ceiling.
  if(s.growth>=6&&s.population<MAX){s.growth=0;s.population=Math.min(MAX,s.population+4);const n=Math.min(s.antLimit,s.population);for(let i=s.count;i<n;i++)spawn(s,i);s.count=n;}
  if(!s.endless&&s.delivered>=s.goal){s.status='won';s.events.push({type:'won',x:s.home.x,y:s.home.y});}
  else if(s.endless&&s.delivered>=s.goal){s.wave++;s.waveGoal=Math.round(s.waveGoal*1.65);s.goal=s.delivered+s.waveGoal;s.duration=s.time+32;s.food=[nextHarvest(s)];s.toFood.fill(0);s.ink.fill(0);s.events.push({type:'wave',x:s.food[0].x,y:s.food[0].y,wave:s.wave});}
  else if(s.time>=s.duration){s.status='lost';s.events.push({type:s.status,x:s.home.x,y:s.home.y});}
}
// A visible route, also used by the reference painter. No hidden state is consulted.
export function painterPath(s){
  const f=s.food.find(f=>f.amount>0)??s.food[0],left=f.x<45;
  const points=[{...s.home}];
  if(s.puddles.length){const x=left?26:84;points.push({x,y:103},{x,y:82});}
  const web=s.webs.find(w=>!w.broken);if(web&&!left)points.push({x:web.x,y:web.y});
  const beetle=s.beetles.find(b=>!b.defeated&&Math.hypot(b.x-f.x,b.y-f.y)<20);if(beetle)points.push({x:beetle.x,y:beetle.y});
  points.push({x:f.x,y:f.y});return points;
}
