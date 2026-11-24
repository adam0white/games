import { windAt } from './sim.js';
import { landscape } from './landscape.js';

const palettes = {
  indigo: { sky: ['#24294f', '#765276', '#ec9d80'], hill: '#544b65', roof: '#302f46', ground: '#272d3b', cloud: '#f4c6a4', grass: '#a5a493' },
  copper: { sky: ['#473448', '#aa5f62', '#f2b280'], hill: '#885b64', roof: '#493c48', ground: '#38333b', cloud: '#ffe0ae', grass: '#c4ad8f' },
};
const cream = '#ffe8bd', red = '#e75d42', ink = '#292b3b';
const tau = Math.PI * 2;
function random(n, seed) { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); }
function poly(c, color, points) { c.fillStyle = color; c.beginPath(); c.moveTo(...points[0]); for (const p of points.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); }
function stroke(c, color, width, points) { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(...points[0]); for (const p of points.slice(1)) c.lineTo(...p); c.stroke(); }
function circle(c, x, y, r, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, tau); c.fill(); }
function wrap(x, n) { return ((x % n) + n) % n; }

// Integrate sampled wind over a bounded window. This keeps tracers continuous
// across gust reversals and also works when rendering an arbitrary simulation time.
function displacement(s, x, y, duration) {
  const steps = 8, dt = duration / steps;
  let dx = 0, dy = 0;
  for (let i = 0; i < steps; i++) {
    const sample = { ...s, t: s.t - duration + (i + 0.5) * dt };
    const w = windAt(sample, x + dx, y + dy);
    dx += w.x * dt * 0.14;
    dy += w.y * dt * 0.14;
  }
  return { x: dx, y: dy };
}
function sky(c, s, p, time) {
  const gradient = c.createLinearGradient(0, 0, 0, 440);
  p.sky.forEach((color, i) => gradient.addColorStop(i / 2, color));
  c.fillStyle = gradient; c.fillRect(0, 0, 360, 520);
  // A crescent path does not depend on the color behind it.
  c.fillStyle = '#f6d6a8'; c.beginPath(); c.arc(293, 75, 29, 0.8, 5.35); c.quadraticCurveTo(285, 82, 311, 96); c.closePath(); c.fill();
  for (let i = 0; i < 60; i++) circle(c, random(i, s.seed) * 360, random(i + 80, s.seed) * 190, 0.4 + random(i + 160, s.seed) * 0.8, '#f8dfbd');
  c.globalAlpha = 0.23;
  for (let i = 0; i < 10; i++) {
    const y = 70 + i * 26, base = random(i + 9, s.seed) * 460;
    const drift = displacement(s, base, y, 3);
    const x = wrap(base + time * 2 + drift.x, 460) - 70;
    c.fillStyle = p.cloud; c.beginPath(); c.moveTo(x, y + drift.y); c.bezierCurveTo(x + 24, y - 7 + drift.y, x + 62, y - 5 + drift.y, x + 98, y - 2 + drift.y); c.bezierCurveTo(x + 65, y + 1 + drift.y, x + 30, y + 4 + drift.y, x, y + 3 + drift.y); c.fill();
  }
  c.globalAlpha = 1;
}
function meadow(c, s, p, time) {
  c.strokeStyle = p.grass;
  for (let i = 0; i < 64; i++) {
    const x = random(i + 300, s.seed) * 360;
    const y = 410 + random(i + 400, s.seed) * 125;
    const depth = (y - 395) / 135;
    const h = (5 + random(i + 500, s.seed) * 26) * depth;
    const w = windAt(s, x, y);
    const bend = (w.x * .38 + Math.sin(time * 1.5 + x * .06) * 2 + 4) * depth;
    c.globalAlpha = .24 + depth * .46;
    c.lineWidth = .45 + depth * .7;
    for (let blade = -1; blade <= 1; blade++) {
      const endX = x + bend + blade * h * .38;
      const endY = y - h * (blade === 0 ? 1 : .65);
      c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + blade * 1.6, endY + h * .22, endX, endY);
      c.stroke();
      if (blade === 0 && i % 4 === 0) {
        for (let n = 0; n < 3; n++) {
          const u = n * 2;
          stroke(c, p.grass, 1, [[endX-u*.13, endY+u+1],[endX-2-u*.2,endY+u-2]]);
          stroke(c, p.grass, 1, [[endX-u*.13, endY+u],[endX+2,endY+u-3]]);
        }
      }
    }
  }
  c.globalAlpha = 1;
}
function windLeaves(c, s, time) {
  for (let i = 0; i < 19; i++) {
    const cycle = 3.8 + random(i+801,s.seed)*2;
    const age = wrap(time + random(i+800,s.seed)*cycle, cycle);
    const x0 = random(i+900,s.seed)*360, y0 = 115+random(i+1000,s.seed)*278;
    const drift = displacement(s, x0, y0, age);
    const w = windAt(s, x0, y0);
    const x = x0 + drift.x*4 + 2*Math.sin(time+i);
    const y = y0 + drift.y*4 + age*(1.3 - w.thermal*2);
    c.save(); c.translate(x, y);
    c.rotate(Math.atan2(w.y, w.x) + Math.sin(time*1.7 + i)*.5);
    c.globalAlpha = (.25 + .25*w.thermal)*Math.sin(Math.PI*age/cycle);
    poly(c, i%3 ? cream : '#c17056', [[-3.5,0],[-1,-1.25],[2,-1],[4,0],[0,1.1]]);
    c.restore();
  }
}
function rain(c, s, time) {
  if (s.storm < .01) return;
  const wind = windAt(s, s.kite.x, s.kite.y);
  const slant = 4 + wind.x*.27;
  c.fillStyle = '#292d52';
  c.globalAlpha = s.storm*.30;
  c.fillRect(0,0,360,520);
  c.strokeStyle = '#d5d6e1';
  c.lineWidth = 1;
  c.globalAlpha = s.storm*.42;
  c.beginPath();
  for (let i=0;i<70;i++) {
    const row = random(i+108,s.seed);
    const y = wrap(row*560+time*(133+34*row),560)-20;
    const x = wrap(random(i+89,s.seed)*390+y*.19+time*6,390)-15;
    c.moveTo(x,y); c.lineTo(x+slant,y+9+row*6);
  }
  c.stroke();
  c.globalAlpha = 1;
}
function lantern(c,x,y,scale=1) {
  c.save(); c.translate(x,y); c.scale(scale,scale); c.globalAlpha=.2; circle(c,0,0,23,cream); c.globalAlpha=1;
  stroke(c,cream,1,[[0,-22],[0,-12]]); poly(c,cream,[[-9,-12],[9,-12],[7,10],[-7,10]]); stroke(c,red,2,[[-9,-8],[9,-8]]); stroke(c,red,2,[[-7,7],[7,7]]); c.restore();
}
function goal(c, s, time) {
  const g=s.goal; if(!g) return;
  c.save(); c.translate(g.x,g.y);
  if (g.kind==='ring') {
    c.strokeStyle=cream; c.globalAlpha=.45; c.lineWidth=1; c.setLineDash([2,5]); c.beginPath(); c.arc(0,0,g.r,0,tau); c.stroke(); c.setLineDash([]); c.globalAlpha=1;
    for (let i=0; i<7; i++) {
      const a = i*tau/7 + time*.22;
      c.save(); c.translate(Math.cos(a)*g.r, Math.sin(a)*g.r);
      c.rotate(a+Math.PI/2);
      const flap = 2 + Math.sin(time*4 + i*2.1)*1.55;
      c.fillStyle = cream; c.beginPath(); c.moveTo(3,0);
      c.quadraticCurveTo(-.5,-1,-4,-flap-2);
      c.quadraticCurveTo(-2,-.5,-1,.4);
      c.lineTo(-4,2.2); c.lineTo(-.3,1.5);
      c.quadraticCurveTo(-1,flap,-5,flap+3);
      c.quadraticCurveTo(0,flap+1,1,.9); c.lineTo(4,.2); c.fill();
      c.restore();
    }
  } else if (g.kind==='lantern') {
    if(g.carrying){ c.globalAlpha=.25; circle(c,0,0,26,cream); c.globalAlpha=1; stroke(c,cream,2,[[-8,-8],[0,-17],[8,-8]]); circle(c,0,-20,3,red); }
    else lantern(c,0,0);
  } else {
    c.globalAlpha=.45; circle(c,0,0,g.r,ink); c.globalAlpha=1;
    for(let i=0;i<4;i++) stroke(c,cream,1.5,[[-g.r*.7,-10+i*7],[g.r*.6,-15+i*7],[g.r*.9,-12+i*7]]);
    c.strokeStyle=cream; c.lineWidth=3; c.beginPath(); c.arc(0,0,g.r+5,-Math.PI/2,-Math.PI/2+tau*g.progress); c.stroke();
  }
  c.restore();
}
function kite(c,s,time) {
  const k=s.kite,h=s.hand; if(!k||!h)return;
  const slack=Math.max(0,Math.min(30,30-s.tension*.025));
  c.strokeStyle=cream; c.lineWidth=1.2; c.beginPath(); c.moveTo(h.x,h.y); c.quadraticCurveTo((h.x+k.x)/2+slack,(h.y+k.y)/2+slack,k.x,k.y); c.stroke();
  c.save(); c.translate(k.x,k.y); c.rotate(k.angle||0);
  const tail=[]; for(let i=0;i<9;i++)tail.push([Math.sin(time*2-i*.55)*5+i*1.5,19+i*8]); stroke(c,cream,1.3,tail);
  for(let i=1;i<9;i+=2){const [x,y]=tail[i]; poly(c,red,[[x,y],[x-6,y-3],[x-5,y+3]]); poly(c,cream,[[x,y],[x+6,y-3],[x+5,y+3]]);}
  poly(c,ink,[[0,-27],[22,0],[0,29],[-22,0]]); poly(c,red,[[0,-24],[19,0],[0,26],[-19,0]]); poly(c,cream,[[0,-22],[0,23],[-16,0]]);
  stroke(c,ink,1,[[0,-22],[0,23]]); stroke(c,ink,1,[[-17,0],[17,0]]); poly(c,cream,[[5,-12],[13,-2],[5,-2]]); poly(c,red,[[-5,5],[-12,1],[-5,-7]]);
  if(s.goal?.carrying) lantern(c,0,43,.55);
  c.restore();
  c.save(); c.translate(h.x,h.y); c.rotate(.25);
  poly(c,'#c77e66',[[-21,36],[-5,7],[-3,2],[4,2],[8,9],[4,16],[-7,36]]);
  poly(c,cream,[[-10,-7],[10,-7],[8,5],[-9,5]]);
  for(let i=-5;i<5;i+=2) stroke(c,'#bba496',.7,[[-7,i],[7,i-1]]);
  stroke(c,red,3,[[-10,-8],[10,-8]]); stroke(c,red,3,[[-9,6],[9,6]]);
  stroke(c,'#efb996',4,[[1,8],[6,3],[6,-1]]);
  poly(c,'#595a6d',[[-29,39],[-14,19],[-3,25],[-10,40]]);
  stroke(c,cream,.9,[[-15,21],[-5,26]]);
  c.restore();
}
function intro(c,time) {
  const f=(time%2)/2, x=180+65*f,y=470-71*f; c.globalAlpha=.75; c.setLineDash([3,5]); stroke(c,cream,2,[[180,470],[245,399]]); c.setLineDash([]); poly(c,cream,[[245,399],[232,403],[241,411]]); circle(c,x,y,6,cream); c.globalAlpha=1;
}
function arrival(c, event, time) {
  const age = time - event.at;
  if (age < 0 || age > .75) return;
  const f = age / .75;
  c.save();
  c.globalAlpha = (1-f)*.8;
  c.strokeStyle = cream; c.lineWidth = 1.4;
  c.beginPath(); c.arc(event.x,event.y,event.r+f*17,0,tau); c.stroke();
  if (event.kind === 'ring') {
    for (let i=0;i<7;i++) {
      const a=i*tau/7+event.at*.22;
      const x=event.x+Math.cos(a)*(event.r+f*30)+f*12;
      const y=event.y+Math.sin(a)*(event.r+f*19)-f*24;
      const flap=Math.sin(time*12+i)*3;
      stroke(c,cream,1.8,[[x-4,y+flap],[x,y],[x+4,y+flap-1]]);
    }
  }
  c.restore();
}
export function draw(c,s,options={}) {
  const p=palettes[options.look]||palettes.indigo, time=options.time ?? s.t ?? 0;
  c.save();
  c.lineCap='round'; c.lineJoin='round';
  sky(c,s,p,time);
  landscape(c,options.look,s.level !== 1 && s.level !== 2);
  meadow(c,s,p,time);
  windLeaves(c,s,time);
  rain(c,s,time);
  if (s.status !== 'won') goal(c,s,time);
  if (options.celebration) arrival(c,options.celebration,time);
  kite(c,s,time);
  if (options.intro) intro(c,time);
  c.restore();
}
