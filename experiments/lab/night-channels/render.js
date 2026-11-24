// Coordinates in the drawing are measured in garden cells. The same transform maps touch.
export function geometry(canvas, state) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const size = Math.min(w / (state.cols + 0.69), h / (state.rows + 1.18));
  return {x: (w - state.cols * size) / 2, y: (h - state.rows * size) / 2 - size * 0.03, size};
}

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const palettes = {
  moon: {hedge:'#132c2b', verge:'#244039', moss:'#617651', dark:'#473730', earth:['#a67a56','#a27652','#9c7352','#956d50','#936d4f'], grain:'#d5a876', bank:'#6e503e', fern:'#759671', leaf:'#507b65', water:'#429b9d', light:'#96d9c7', glow:'#fff5c5'},
  clay: {hedge:'#352a31', verge:'#493a39', moss:'#8d7a57', dark:'#533735', earth:['#c98c67','#be8162','#bc8165','#af795e','#ac725b'], grain:'#ecc194', bank:'#805548', fern:'#a6a673', leaf:'#79866a', water:'#4d91af', light:'#b2e4e1', glow:'#fff2ce'}
};

function hash(i, salt) {
  let n = Math.imul(i + 4099, 0x9e3779b1) ^ Math.imul(salt + 17, 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

function ellipse(ctx, x, y, rx, ry, color, angle = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function polygon(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i) ctx.lineTo(...points[i]);
    else ctx.moveTo(...points[i]);
  }
  ctx.closePath();
  ctx.fill();
}

function vertex(x, y, cols) {
  const i = y * (cols + 1) + x;
  return [x + (hash(i, 1) - 0.5) * 0.12, y + (hash(i, 2) - 0.5) * 0.14];
}

function leaf(ctx, x, y, endX, endY, width, color) {
  const dx = endX - x, dy = endY - y;
  const k = width / Math.max(0.001, Math.hypot(dx, dy));
  const mx = (x + endX) * 0.5, my = (y + endY) * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx - dy * k, my + dx * k, endX, endY);
  ctx.quadraticCurveTo(mx + dy * k, my - dx * k, x, y);
  ctx.fill();
}

function fern(ctx, x, y, angle, length, color, tip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(length, length);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-0.08, -0.58, 0.14, -1);
  ctx.stroke();
  for (let j = 1; j < 9; j++) {
    const u = j / 9, sx = 0.22*u*u - 0.08*u, sy = -u;
    const span = 0.19 * Math.sin(u * Math.PI) + 0.035;
    leaf(ctx, sx, sy, sx - span, sy - 0.12, span * 0.25, color);
    leaf(ctx, sx, sy - 0.04, sx + span * 0.96, sy - 0.18, span * 0.24, j > 6 ? tip : color);
  }
  ctx.restore();
}

function stone(ctx, x, y, width, height, angle, pale = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(width, height);
  ellipse(ctx, 0.05, 0.32, 0.54, 0.27, '#312e2c55');
  polygon(ctx, [[-.52,.13],[-.45,-.18],[-.18,-.46],[.24,-.48],[.49,-.14],[.47,.2],[.16,.43],[-.29,.38]], pale ? '#82928a' : '#68746c');
  polygon(ctx, [[-.52,.13],[-.24,-.07],[.2,-.03],[.49,-.14],[.47,.2],[.16,.43],[-.29,.38]], pale ? '#59665f' : '#4b5956');
  polygon(ctx, [[-.45,-.18],[-.18,-.46],[.24,-.48],[.09,-.32],[-.23,-.23]], pale ? '#b7bd9f' : '#96a393');
  line(ctx, -.29,.38, .06,.32, .025, '#a7a78370');
  ctx.restore();
}

function makeLandscape(layer, s, g, ratio, p) {
  const ctx = layer.getContext('2d',{willReadFrequently:true});
  ctx.setTransform(g.size * ratio, 0, 0, g.size * ratio, g.x * ratio, g.y * ratio);
  const left = -g.x/g.size, top = -g.y/g.size;
  const width = layer.width/(ratio*g.size), height = layer.height/(ratio*g.size);
  const grad = ctx.createLinearGradient(0, top, 0, top + height);
  grad.addColorStop(0, p.hedge); grad.addColorStop(0.52, p.verge); grad.addColorStop(1, p.hedge);
  ctx.fillStyle = grad;
  ctx.fillRect(left, top, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Contours continue around the footprint of the garden.
  ctx.strokeStyle = '#bdc9a21c';
  ctx.lineWidth = 0.014;
  for (let n = Math.floor(top * 3) - 3; n < (top + height) * 3 + 2; n++) {
    ctx.beginPath();
    for (let k = 0; k <= 50; k++) {
      const x = left + width*k/50;
      const y = n/3 + 0.20*Math.sin(1.7*x + .32*n) + .27*Math.sin(.83*x - .2*n);
      if (k) ctx.lineTo(x,y); else ctx.moveTo(x,y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 330; i++) {
    const x = left + width*hash(i, 19), y = top + height*hash(i, 20);
    if (x > 0 && x < s.cols && y > 0 && y < s.rows) continue;
    ellipse(ctx,x,y,.018+hash(i,22)*.024,.011,i%11===0 ? '#c7bb7c' : '#7d9b70',-0.4);
  }

  const corners = (x, y) => [vertex(x,y,s.cols), vertex(x+1,y,s.cols), vertex(x+1,y+1,s.cols), vertex(x,y+1,s.cols)];
  for (let i = 0; i < s.cols; i++) {
    const a=vertex(i,s.rows,s.cols), b=vertex(i+1,s.rows,s.cols);
    polygon(ctx,[a,b,[b[0],b[1]+.17],[a[0],a[1]+.17]],p.bank);
    line(ctx,a[0]+.03,a[1]+.15,b[0]-.02,b[1]+.15,.03,p.dark);
  }
  for (let i = 0; i < s.cells.length; i++) {
    const x = i%s.cols, y = Math.floor(i/s.cols), c = s.cells[i], pts = corners(x,y);
    polygon(ctx, pts, c.kind === 'sand' ? '#c9ad7c' : p.earth[Math.min(4, Math.floor(y/s.rows*4 + hash(i,44)))]);
    const relief = ctx.createLinearGradient(x,y,x+.38,y+1);
    relief.addColorStop(0,'#f6cc8c26');
    relief.addColorStop(.32,'#bf9b7405');
    relief.addColorStop(1,'#573c392e');
    polygon(ctx,pts,relief);
    const [a,b,d,e] = pts;
    line(ctx, a[0], a[1], b[0], b[1], .027, '#674f405e');
    line(ctx, a[0]+.015, a[1]+.039, b[0]-.025,b[1]+.039,.012,'#ffe2a844');
    line(ctx, e[0],e[1]-.02,a[0],a[1]+.045,.013,'#624a3c4f');
    // Scratches, seed husks and pebbles are fixed to the ground.
    for (let j = 0; j < (c.kind === 'sand' ? 31 : 12); j++) {
      const k = i*41 + j, px = x+.08+.83*hash(k,15), py = y+.10+.78*hash(k,16);
      if (c.kind === 'sand') {
        ellipse(ctx,px,py,.012 + hash(k,17)*.012,.012,j%4 ? '#9a7d5366' : '#f5d39e');
      } else {
        const w = .015 + hash(k,17)*.052;
        line(ctx,px,py,px+w,py-.015,.014,j%3 ? '#563f363c' : p.grain);
      }
    }
    if (c.kind === 'soil' || c.kind === 'sand') {
      // Curved rake strokes run across the slope and fade where the ground breaks.
      for (let j=0; j<3; j++) {
        const k=i*3+j, px=x+.08+.49*hash(k,36), py=y+.15+j*.27+.09*hash(k,37);
        const length=.14+.22*hash(k,38);
        for (const [offset,color] of [[.019,'#f2c48933'],[0,'#65483138']]) {
          ctx.strokeStyle=color; ctx.lineWidth=.012;
          ctx.beginPath();ctx.moveTo(px,py+offset);
          ctx.quadraticCurveTo(px+length*.55,py-.056+offset,px+length,py-.038+offset);
          ctx.stroke();
        }
      }
      if (c.kind === 'soil' && (hash(i,56) < .23 || x===0 || x===s.cols-1)) {
        const sx=x+.09+hash(i,46)*.14, sy=y+.78+hash(i,47)*.11;
        for (let j=0;j<4;j++) {
          const dx=(j-1.4)*.043, dy=.048+hash(i,j+50)*.076;
          leaf(ctx,sx,sy,sx+dx,sy-dy,.014,j%2 ? '#6c714c' : '#86905a');
        }
      }
    }
    if (c.kind === 'rock') {
      stone(ctx,x+.49,y+.52,.88,.65,hash(i,11)*.8-.4,true);
      stone(ctx,x+.79,y+.77,.27,.20,.4);
      stone(ctx,x+.17,y+.63,.13,.11,-.4,true);
      fern(ctx,x+.19,y+.74,-.42,.34,p.leaf,p.fern);
    }
    if (c.kind === 'spring') {
      stone(ctx,x+.17,y+.37,.50,.42,-.30,true);
      stone(ctx,x+.45,y+.19,.65,.42,-.04,true);
      stone(ctx,x+.80,y+.38,.44,.48,.38,true);
      fern(ctx,x+.18,y+.17,-.88,.54,p.fern,p.moss);
    }
    if (x === s.cols-1) line(ctx,b[0],b[1],d[0],d[1],.032,p.bank);
  }

  // Ferns grow from the outer verge and leave the entire dig surface available.
  for (let i = 0; i < 20; i++) {
    const side = i%2 === 0 ? -1 : 1;
    const y = (.12 + .8*hash(i,28))*s.rows;
    const x = side < 0 ? -.12 : s.cols+.13;
    fern(ctx,x,y,side*(.08+.48*hash(i,29)),.37+.44*hash(i,30),i%4 ? p.leaf : p.fern,p.fern);
  }
  for (const [x,y,angle,l] of [[.48,.13,-1.12,.85],[s.cols-.30,.08,.73,.85],[.18,s.rows+.08,-.62,1.05],[s.cols-.12,s.rows+.11,.67,.99]]) {
    fern(ctx,x,y,angle,l,p.fern,p.moss);
    fern(ctx,x,y,angle-.67,l*.66,p.leaf,p.fern);
    fern(ctx,x,y,angle+1.1,l*.45,p.leaf,p.moss);
  }
}

const channel = c => c.dug || c.kind === 'spring' || c.kind === 'bed';
const radius = c => c.water > 0.0001 ? clamp(.065 + Math.sqrt(c.water)*.24, .065, .41) : 0;

// The channel meanders within its cell. Neighbouring ribbons share end points.
function centre(i, cols) {
  return [i%cols+.5+.13*(hash(i,72)-.5),Math.floor(i/cols)+.5+.10*(hash(i,73)-.5)];
}

function pool(ctx, x, y, r, i, source, color) {
  const points=[];
  for (let j=0;j<16;j++) {
    const a=j*TAU/16;
    const v = r*(.89+.17*hash(i,j+100));
    points.push([x+Math.cos(a)*v*(source?1.07:1),y+Math.sin(a)*v*(source?.86:1)]);
  }
  polygon(ctx,points,color);
}

function ribbon(ctx, a, b, ra, rb, i, color) {
  const dx=b[0]-a[0], dy=b[1]-a[1], d=Math.hypot(dx,dy);
  const nx=-dy/d, ny=dx/d;
  const l=[], r=[];
  // Curvature and bank width stay fixed as the water depth changes.
  const bend=(hash(i,85)-.5)*.15;
  for(let k=0;k<=6;k++) {
    const t=k/6, weight=Math.sin(t*Math.PI), curve=weight*bend;
    const radius=ra*(1-t)+rb*t;
    const x=a[0]+t*dx+nx*curve, y=a[1]+t*dy+ny*curve;
    const left=radius*(1+weight*(hash(i,k+86)-.5)*.31);
    const right=radius*(1+weight*(hash(i,k+93)-.5)*.31);
    l.push([x+nx*left,y+ny*left]);r.unshift([x-nx*right,y-ny*right]);
  }
  polygon(ctx,l.concat(r),color);
}

function surface(ctx,s,widthOf,color,offset=0) {
  const {cols,cells}=s;
  for (let i=0;i<cells.length;i++) {
    const width=widthOf(cells[i]);
    if (!width) continue;
    const a=centre(i,cols);a[1]+=offset;
    pool(ctx,...a,width,i,cells[i].kind==='spring',color);
    const drawTo=next=>{
      const other=widthOf(cells[next]);
      if (!other) return;
      const b=centre(next,cols);b[1]+=offset;
      ribbon(ctx,a,b,width,other,i+next,color);
    };
    if (i%cols<cols-1) drawTo(i+1);
    if (i+cols<cells.length) drawTo(i+cols);
  }
}

function channels(ctx,s,p) {
  for (const [width,color,dy] of [[.36,'#e5b18585',.035],[.35,p.bank,0],[.265,p.dark,-.012]]) {
    surface(ctx,s,c=>{
      if (!channel(c)) return 0;
      if (c.kind==='spring') return width*1.53;
      if (c.kind==='bed') return width*.85;
      return width;
    },color,dy);
  }
}

function water(ctx,s,time,p) {
  const {cols,cells}=s;
  for (let i=0;i<cells.length;i++) {
    const c=cells[i], [x,y]=centre(i,cols);
    if (c.moisture>.003 && c.kind!=='rock') {
      const wet=clamp(c.moisture);
      const stain=ctx.createRadialGradient(x,y,.16,x,y,.70);
      stain.addColorStop(0,'rgba(45,42,39,'+(.84*Math.sqrt(wet))+')');
      stain.addColorStop(.56,'rgba(50,41,40,'+(.68*Math.sqrt(wet))+')');
      stain.addColorStop(1,'rgba(56,46,39,0)');
      ctx.fillStyle=stain;ctx.fillRect(x-.70,y-.70,1.4,1.4);
    }
  }
  for (const [size,color] of [[1.09,'#28595e'],[1,p.water]]) {
    surface(ctx,s,c=>radius(c)*size*(c.kind==='spring'?1.58:1),color);
  }
  for (let i=0; i<cells.length; i++) {
    const c=cells[i], r=radius(c);
    if (r < .080) continue;
    const [cx,cy]=centre(i,cols);
    // Small uneven reflections cross cell faces, so a filled run reads as one stream.
    for (const [next,horizontal] of [[i+1,true],[i+cols,false]]) {
      if ((horizontal && i%cols===cols-1) || next>=cells.length) continue;
      const other=radius(cells[next]);
      if (other<.075) continue;
      const drift=horizontal ? c.flowX : c.flowY;
      const sign=drift<0 ? -1 : 1;
      const phase=(time*(.23+Math.min(1.5,8*Math.abs(drift)))+hash(i,next))%1;
      ctx.save();ctx.translate(cx,cy);if(!horizontal)ctx.rotate(Math.PI/2);
      for (let j=0;j<3;j++) {
        const u=(phase+j/3)%1, mid=sign>0 ? u : 1-u;
        const band=(j%2 ? -.70 : .70)*((1-mid)*r+mid*other);
        const len=.07+.17*Math.sin(u*Math.PI);
        ctx.globalAlpha=.23+.31*Math.sin(u*Math.PI);
        ctx.strokeStyle=j===1 ? '#204f66' : p.light; ctx.lineWidth=.018+.013*j;
        ctx.beginPath();ctx.moveTo(mid-len/2,band);
        ctx.quadraticCurveTo(mid,band-.024,mid+len/2,band+.006); ctx.stroke();
      }
      ctx.restore();
    }
    const speed=Math.hypot(c.flowX,c.flowY), angle=Math.atan2(c.flowY,c.flowX);
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle);
    for (let j=0;j<4;j++) {
      const phase=(time*(.18+Math.min(2.5,speed*24))+hash(i,j+40))%1;
      const x=(phase-.5)*r*1.45, y=(hash(i,j+93)-.5)*r*1.36;
      const w=r*(.12+.53*Math.sin(phase*Math.PI));
      ctx.globalAlpha=.34+.52*Math.sin(phase*Math.PI);
      line(ctx,x-w*.5,y,x+w*.5,y-.009,.019,j%2?p.light:p.glow);
    }
    ctx.restore();
    if (c.kind==='spring') {
      for (let j=0;j<2;j++) {
        const phase=(time*.70+j*.5)%1;
        ctx.globalAlpha=1-phase;
        ctx.strokeStyle=p.light; ctx.lineWidth=.024;
        ctx.beginPath();ctx.ellipse(cx,cy-.045,.06+phase*r*1.3,.028+phase*r,0,.20,TAU-.3);ctx.stroke();
      }
      ctx.globalAlpha=1;
      for (let j=0;j<4;j++) {
        const u=(time*.7+j*.27)%1, bx=cx+(hash(i,j+89)-.5)*.31;
        ctx.globalAlpha=Math.sin(u*Math.PI)*.86;ctx.lineWidth=.018;ctx.strokeStyle='#d2fff0';
        ctx.beginPath();ctx.arc(bx,cy+.04-u*.17,.014+.020*u,0,TAU);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
  }
}

function flower(ctx, x, y, size, color, open, phase) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(phase); ctx.scale(size,size);
  for (let j = 0; j < 7; j++) {
    const angle = j*TAU/7;
    const dist = .3 + open*.31;
    ellipse(ctx,Math.cos(angle)*dist,Math.sin(angle)*dist,.30+open*.26,.21+.095*open,
      j%3 === 0 ? '#fff1ba' : color,angle);
  }
  ellipse(ctx,0,0,.32,.32,'#a56235');
  for (let j=0;j<6;j++) {
    const a=j*TAU/6;
    ellipse(ctx,.19*Math.cos(a),.19*Math.sin(a),.066,.066,'#f8d574');
  }
  ctx.restore();
}

function seedbed(ctx, c, x, y, time, i, p) {
  const g = clamp(c.growth), sway = .023*Math.sin(time*1.8 + i*1.3)*g;
  const scale = .58+.46*Math.min(1,g*1.45);
  // The intact bulb has two folded leaves and a brass marker at all four corners.
  ctx.strokeStyle = '#f5d695'; ctx.lineWidth = .028;
  for (let j=0; j<4; j++) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(j*Math.PI/2);
    ctx.beginPath();ctx.moveTo(.29,.35);ctx.lineTo(.35,.35);ctx.lineTo(.35,.27);ctx.stroke();ctx.restore();
  }
  ellipse(ctx,x,y+.12,.22,.10,'#322e2a77');
  const baseY = y+.14;
  if (g<.42) {
    ctx.save();ctx.translate(x,baseY);
    ctx.fillStyle='#e6bc78';ctx.beginPath();
    ctx.moveTo(-.07,.04);ctx.quadraticCurveTo(-.22,-.04,-.18,-.22);
    ctx.quadraticCurveTo(-.08,-.20,-.01,-.08);ctx.quadraticCurveTo(.01,.01,-.07,.04);ctx.fill();
    leaf(ctx,-.025,-.015,.17,-.27,.109,'#aebd76');
    leaf(ctx,-.01,.005,.018,-.22,.054,'#d0cb85');
    ctx.restore();
  }
  for (let j=0;j<6;j++) {
    const side = j%2 ? -1 : 1;
    const dx = side*(.2+.033*j)*scale+sway;
    const dy = (.20+.059*j)*scale;
    leaf(ctx,x,baseY,x+dx,baseY-dy,.10*scale,j%3 ? '#77995d' : '#b1bc78');
    line(ctx,x,baseY,x+dx*.78,baseY-dy*.78,.012,j%2 ? '#abc180' : '#54704c');
  }
  ellipse(ctx,x-.045,y+.13,.068*(1-g),.054*(1-g),'#c69150',-.25);
  const bloom = clamp((g-.43)/.57);
  if (!bloom) return;
  const stems = [[-.20,-.37,.126],[.22,-.34,.144],[.025,-.58,.196]];
  for (let j=0;j<stems.length;j++) {
    const [sx,sy,r]=stems[j], fx=x+sx*scale+sway, fy=baseY+sy*scale;
    ctx.strokeStyle='#547449';ctx.lineWidth=.031;
    ctx.beginPath();ctx.moveTo(x,baseY);ctx.quadraticCurveTo(x+sx*.7,baseY-.3*scale,fx,fy);ctx.stroke();
    flower(ctx, fx,fy,r*(.22+.78*bloom), j===1 ? '#eb9c78' : '#f4c77d',bloom,i+j*.41);
  }
  if (g>.95) {
    for(let j=0;j<3;j++) {
      const u=(time*.28+hash(i,j+81))%1;
      ctx.globalAlpha=.72*Math.sin(Math.PI*u);
      ellipse(ctx,x+(hash(i,j+53)-.5)*.88+.035*Math.sin(u*TAU),y-.19-.78*u,.018,.018,p.glow);
    }
    ctx.globalAlpha=1;
  }
}

function dragHint(ctx, s, time) {
  const x=s.source%s.cols+.5, bedY=Math.floor(s.beds[0]/s.cols)+.50;
  let start=.5;
  for (let row=1;row<bedY-.5;row++) {
    if (!s.cells[row*s.cols+Math.floor(x)].dug) break;
    start=row+.5;
  }
  const end=bedY-.35;
  if (start >= bedY-1) return;
  ctx.save();
  ctx.setLineDash([.050,.118]);ctx.lineDashOffset=-time*.075;
  line(ctx,x,start+.13,x,end,.031,'#ffe9aeae');ctx.setLineDash([]);
  line(ctx,x-.09,end-.09,x,end,.036,'#ffe6b1');
  line(ctx,x,end,x+.09,end-.09,.036,'#ffe6b1');
  const u=clamp((time%3.4-.25)/2.35);
  const ease=u*u*(3-2*u);
  const cy=start+ease*(end-start);
  ctx.globalAlpha=.9;
  ctx.strokeStyle='#ffedbc';ctx.lineWidth=.031;
  ctx.beginPath();ctx.arc(x,cy,.13,0,TAU);ctx.stroke();
  ellipse(ctx,x,cy,.045,.045,'#fff7d6');
  ctx.restore();
}

const landscapes = new WeakMap();

export function render(canvas, terrain, s, {time=0, hint=false, look='moon', reduced=false}={}) {
  if (reduced) time=1.5;
  const g=geometry(canvas,s);
  if (!(g.size>0)) return;
  const ratio=Math.min(window.devicePixelRatio || 1,2);
  const w=Math.round(canvas.clientWidth*ratio), h=Math.round(canvas.clientHeight*ratio);
  if (canvas.width!==w || canvas.height!==h) {canvas.width=w;canvas.height=h;}
  const p=palettes[look] || palettes.moon;
  const previous = landscapes.get(terrain);
  if (!previous || previous.state !== s || previous.width !== w || previous.height !== h ||
      previous.ratio !== ratio || previous.palette !== p) {
    terrain.width = w;
    terrain.height = h;
    makeLandscape(terrain,s,g,ratio,p);
    landscapes.set(terrain,{state:s,width:w,height:h,ratio,palette:p});
  }
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.resetTransform();
  ctx.clearRect(0,0,w,h);
  ctx.setTransform(g.size*ratio,0,0,g.size*ratio,g.x*ratio,g.y*ratio);
  ctx.lineCap='round';ctx.lineJoin='round';
  channels(ctx,s,p);
  water(ctx,s,time,p);
  for (const i of s.beds) seedbed(ctx,s.cells[i],i%s.cols+.5,Math.floor(i/s.cols)+.5,time,i,p);
  if (hint && s.beds.length) dragHint(ctx,s,time);
}
