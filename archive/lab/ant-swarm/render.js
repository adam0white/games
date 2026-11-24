import { COLS, ROWS } from './sim.js';

const TAU = Math.PI * 2;
const palettes = {
  moss: { ground: [0.20, 0.34, 0.27], light: '#7f9d68', dark: '#203d32', soil: '#856c4c' },
  dusk: { ground: [0.25, 0.25, 0.35], light: '#9794ae', dark: '#332e48', soil: '#806478' },
  clay: { ground: [0.40, 0.32, 0.23], light: '#b6a478', dark: '#514330', soil: '#a47a56' },
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function shader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const groundVS = `#version 300 es
in vec2 pos; void main(){gl_Position=vec4(pos,0.,1.);}`;
const groundFS = `#version 300 es
precision highp float;
uniform sampler2D trails; uniform vec4 view; uniform vec2 pixels; uniform vec3 base;
out vec4 color;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){
 vec2 screen=vec2(gl_FragCoord.x,pixels.y-gl_FragCoord.y)/pixels;
 vec2 w=view.xy+screen*view.zw;
 if(w.x<0.||w.y<0.||w.x>100.||w.y>150.){color=vec4(.086,.173,.161,1.);return;}
 float n=noise(w*.16), fine=noise(w*1.7), blades=pow(noise(w*vec2(2.1,1.2)),5.);
 vec3 c=base*(.83+.30*n+.10*fine)+vec3(.025,.045,.014)*blades;
 vec2 uv=w/vec2(100.,150.);
 vec3 scent=texture(trails,uv).rgb;
 // The low-resolution field is bilinearly filtered on the GPU.
 c+=vec3(.18,.45,.37)*scent.r+vec3(.25,.40,.17)*scent.g+vec3(.67,.32,.055)*scent.b;
 float edge=smoothstep(0.,2.,min(min(w.x,100.-w.x),min(w.y,150.-w.y)));
 c=mix(c*.65,c,edge); color=vec4(c,1.);
}`;
const antVS = `#version 300 es
in vec4 ant; uniform vec4 view; uniform float size;
out float angle; out float carry;
void main(){vec2 p=(ant.xy-view.xy)/view.zw;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);gl_PointSize=size;angle=ant.z;carry=ant.w;}`;
const antFS = `#version 300 es
precision highp float; in float angle; in float carry; out vec4 color;
float ellipse(vec2 p,vec2 r){return 1.-smoothstep(.8,1.1,length(p/r));}
void main(){vec2 p=gl_PointCoord*2.-1.; float c=cos(angle),s=sin(angle);p=mat2(c,-s,s,c)*p;
 float shadow=ellipse(p-vec2(.05,.16),vec2(.78,.47))*.27;
 float body=max(ellipse(p+vec2(.20,0.),vec2(.29,.25)),max(ellipse(p-vec2(.10,0.),vec2(.20,.18)),ellipse(p-vec2(.36,0.),vec2(.17,.16))));
 float legs=0.; for(int i=0;i<3;i++){float x=-.12+float(i)*.17;float d=abs(p.y)-(.18+abs(p.x-x)*.45);legs=max(legs,(1.-smoothstep(.018,.065,abs(d)))*(1.-smoothstep(.14,.22,abs(p.x-x))));}
 float food=carry*ellipse(p-vec2(.58,0.),vec2(.18,.15));
 vec3 col=mix(vec3(.065,.075,.055),vec3(.94,.77,.38),food);float a=max(shadow,max(body,legs*.75));a=max(a,food);if(a<.01)discard;color=vec4(col,a);
}`;

export class Meadow {
  constructor(canvas, { fallback = false, look = 'moss' } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.look = palettes[look] ? look : 'moss';
    this.kind = 'canvas2d';
    this.field = document.createElement('canvas'); this.field.width = COLS; this.field.height = ROWS;
    this.fieldCtx = this.field.getContext('2d'); this.fieldData = this.fieldCtx.createImageData(COLS, ROWS);
    this.bytes = new Uint8Array(COLS * ROWS * 4);
    this.ants = new Float32Array(1500 * 4);
    this.ground = document.createElement('canvas'); this.ground.width = 500; this.ground.height = 750;
    this.makeGround();
    if (!fallback) {
      try { this.initGL(); this.kind = 'webgl2'; } catch (_) { this.gl = null; }
    }
  }
  setLook(look) { if (palettes[look] && this.look !== look) { this.look = look; this.makeGround(); } }
  makeGround() {
    const c = this.ground.getContext('2d'), p = palettes[this.look];
    c.fillStyle = `rgb(${p.ground.map(v => Math.round(v * 255)).join(',')})`; c.fillRect(0, 0, 500, 750);
    for (let i = 0; i < 2300; i++) {
      const x = hash(i * 3) * 500, y = hash(i * 3 + 1) * 750, r = 2 + hash(i * 3 + 2) * 10;
      c.globalAlpha = .025 + hash(i + 91) * .045; c.fillStyle = i % 3 ? p.light : p.dark;
      c.beginPath(); c.ellipse(x, y, r, r * .55, hash(i) * 3, 0, TAU); c.fill();
    }
    c.globalAlpha = .22; c.strokeStyle = p.light; c.lineWidth = 1;
    for (let i = 0; i < 950; i++) { const x = hash(i * 7) * 500, y = hash(i * 7 + 1) * 750; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1 + hash(i) * 4, y - 2 - hash(i + 2) * 5); c.stroke(); }
    c.globalAlpha = 1;
  }
  initGL() {
    const surface = document.createElement('canvas');
    const gl = surface.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.surface = surface; this.gl = gl;
    this.groundProgram = program(gl, groundVS, groundFS); this.antProgram = program(gl, antVS, antFS);
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    this.antBuffer = gl.createBuffer();
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    surface.addEventListener('webglcontextlost', e => { e.preventDefault(); this.kind = 'canvas2d'; });
  }
  pack(s) {
    for (let i = 0; i < COLS * ROWS; i++) {
      const j = i * 4;
      this.bytes[j] = Math.round(clamp((s.toHome?.[i] || 0) / 5, 0, 1) * 255);
      this.bytes[j+1] = Math.round(clamp((s.toFood?.[i] || 0) / 5, 0, 1) * 255);
      this.bytes[j+2] = Math.round(clamp((s.ink?.[i] || 0) / 4, 0, 1) * 255);
      this.bytes[j+3] = 255;
    }
  }
  glGround(view, width, height) {
    const gl = this.gl, p = this.groundProgram;
    if (this.surface.width !== this.canvas.width || this.surface.height !== this.canvas.height) { this.surface.width = this.canvas.width; this.surface.height = this.canvas.height; }
    gl.viewport(0, 0, this.surface.width, this.surface.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const a = gl.getAttribLocation(p, 'pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4f(gl.getUniformLocation(p,'view'), -view.x/view.scale,-view.y/view.scale,width/view.scale,height/view.scale);
    gl.uniform2f(gl.getUniformLocation(p,'pixels'), this.surface.width,this.surface.height);
    gl.uniform3fv(gl.getUniformLocation(p,'base'), palettes[this.look].ground);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,COLS,ROWS,gl.RGBA,gl.UNSIGNED_BYTE,this.bytes);
    gl.uniform1i(gl.getUniformLocation(p,'trails'),0); gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  glAnts(s, view, width, height, time) {
    const gl = this.gl, p = this.antProgram, count = Math.min(s.count || 0, 1500);
    for (let i=0;i<count;i++) { const j=i*4; this.ants[j]=s.x[i]; this.ants[j+1]=s.y[i]; this.ants[j+2]=s.angle[i] + Math.sin(time*12+i)*.035; this.ants[j+3]=s.carry[i]; }
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(p); gl.bindBuffer(gl.ARRAY_BUFFER,this.antBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,this.ants.subarray(0,count*4),gl.DYNAMIC_DRAW);
    const a=gl.getAttribLocation(p,'ant'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,4,gl.FLOAT,false,0,0);
    gl.uniform4f(gl.getUniformLocation(p,'view'),-view.x/view.scale,-view.y/view.scale,width/view.scale,height/view.scale);
    gl.uniform1f(gl.getUniformLocation(p,'size'),Math.max(3,view.scale*3.2*this.surface.width/width)); gl.drawArrays(gl.POINTS,0,count);
  }
  draw(s, view, { time = 0, particles = [], pointer = null, celebrate = 0, shake = 0 } = {}) {
    const c=this.ctx, width=this.canvas.clientWidth || this.canvas.width, height=this.canvas.clientHeight || this.canvas.height;
    if (!view || !view.scale) return;
    this.pack(s);
    c.save(); c.fillStyle='#162c29'; c.fillRect(0,0,width,height);
    if (shake) c.translate(Math.sin(time*47)*shake,Math.cos(time*39)*shake);
    if (this.kind==='webgl2') {
      this.glGround(view,width,height); c.drawImage(this.surface,0,0,width,height);
    } else {
      c.save(); c.translate(view.x,view.y); c.scale(view.scale,view.scale);
      c.drawImage(this.ground,0,0,100,150);
      const data=this.fieldData.data;
      for(let i=0;i<COLS*ROWS;i++){const j=i*4,h=this.bytes[j],f=this.bytes[j+1],ink=this.bytes[j+2];data[j]=Math.min(255,40+h*.2+f*.3+ink*.8);data[j+1]=Math.min(255,110+h*.7+f*.65+ink*.45);data[j+2]=Math.min(255,65+h*.6+f*.15);data[j+3]=Math.max(h,f,ink)*.65;}
      this.fieldCtx.putImageData(this.fieldData,0,0); c.imageSmoothingEnabled=true; c.drawImage(this.field,0,0,100,150); c.restore();
    }
    c.save(); c.translate(view.x,view.y); c.scale(view.scale,view.scale);
    this.drawLandmarks(c,s,time);
    c.restore();
    if (this.kind==='webgl2') { this.glAnts(s,view,width,height,time); c.drawImage(this.surface,0,0,width,height); }
    else { c.save(); c.translate(view.x,view.y); c.scale(view.scale,view.scale); this.drawAnts(c,s,time); c.restore(); }
    c.save(); c.translate(view.x,view.y); c.scale(view.scale,view.scale);
    for(const p of particles){c.globalAlpha=clamp(p.life/(p.max||1),0,1);c.fillStyle=p.color||'#f2d17b';c.beginPath();c.arc(p.x,p.y,p.size||.7,0,TAU);c.fill();} c.globalAlpha=1;
    if(pointer && pointer.down){c.strokeStyle='rgba(255,214,120,.8)';c.lineWidth=.35;c.beginPath();c.arc(pointer.x,pointer.y,3.2+Math.sin(time*6)*.35,0,TAU);c.stroke();}
    if(celebrate>0){c.strokeStyle=`rgba(255,226,150,${clamp(celebrate,0,1)*.5})`;c.lineWidth=.5;c.beginPath();c.arc(s.home.x,s.home.y,7+(1-clamp(celebrate,0,1))*14,0,TAU);c.stroke();}
    c.restore(); c.restore();
  }
  drawLandmarks(c,s,time) {
    const p=palettes[this.look];
    for(const q of s.puddles || []) { c.fillStyle='rgba(17,44,48,.30)';c.beginPath();c.ellipse(q.x+.7,q.y+1,q.rx,q.ry,0,0,TAU);c.fill();c.fillStyle='#416d6a';c.beginPath();c.ellipse(q.x,q.y,q.rx,q.ry,0,0,TAU);c.fill();c.strokeStyle='rgba(188,224,204,.42)';c.lineWidth=.4;c.beginPath();c.ellipse(q.x-q.rx*.15,q.y-q.ry*.25,q.rx*.55,q.ry*.42,0,3.5,5.6);c.stroke(); }
    const h=s.home; if(h){c.fillStyle='rgba(17,30,24,.3)';c.beginPath();c.ellipse(h.x+1,h.y+1,8,5.6,0,0,TAU);c.fill();c.fillStyle=p.soil;c.beginPath();c.ellipse(h.x,h.y,8,5.5,0,0,TAU);c.fill();c.fillStyle='#24271c';c.beginPath();c.ellipse(h.x,h.y,4,2.8,0,0,TAU);c.fill();c.strokeStyle='rgba(244,216,162,.32)';c.lineWidth=.4;c.beginPath();c.ellipse(h.x,h.y,6.4,4.2,0,3.4,6.1);c.stroke();}
    for(const f of s.food || []) {if(f.amount<=0)continue;const r=3+4*Math.sqrt(clamp(f.amount/(f.max||1),0,1));c.fillStyle='rgba(20,25,19,.28)';c.beginPath();c.ellipse(f.x+.6,f.y+1,r,r*.72,0,0,TAU);c.fill();c.fillStyle='#bd6550';c.beginPath();c.arc(f.x,f.y,r,0,TAU);c.fill();c.fillStyle='#ec9b75';c.beginPath();c.ellipse(f.x-r*.25,f.y-r*.3,r*.35,r*.2,-.5,0,TAU);c.fill();c.fillStyle='#a9bf73';c.beginPath();c.ellipse(f.x+r*.25,f.y-r*.85,r*.5,r*.22,-.5,0,TAU);c.fill();}
    for(const w of s.webs || []) {if(w.broken)continue;c.strokeStyle='rgba(230,238,210,.75)';c.lineWidth=.25;for(let i=0;i<8;i++){let a=i*TAU/8;c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x+Math.cos(a)*w.r,w.y+Math.sin(a)*w.r);c.stroke();}for(let r=w.r/3;r<=w.r;r+=w.r/3){c.beginPath();for(let i=0;i<=8;i++){let a=i*TAU/8,x=w.x+Math.cos(a)*r,y=w.y+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
    for(const b of s.beetles || []) {if(b.defeated)continue;
      c.strokeStyle='#252d23';c.lineWidth=.7;c.beginPath();for(let k=-1;k<=1;k++){c.moveTo(b.x-b.r*.6,b.y+k*b.r*.34);c.lineTo(b.x-b.r*1.2,b.y+k*b.r*.5+.6*Math.sin(time*8));c.moveTo(b.x+b.r*.6,b.y+k*b.r*.34);c.lineTo(b.x+b.r*1.2,b.y+k*b.r*.5-.6*Math.sin(time*8));}c.stroke();
      c.strokeStyle='#edc675';c.lineWidth=.6;c.beginPath();c.arc(b.x,b.y,b.r*1.3,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,(b.pressure||0)/b.need));c.stroke();c.fillStyle='rgba(16,28,20,.4)';c.beginPath();c.ellipse(b.x+.8,b.y+1,b.r,b.r*.7,0,0,TAU);c.fill();c.fillStyle='#72563d';c.beginPath();c.ellipse(b.x,b.y,b.r,b.r*.7,0,0,TAU);c.fill();c.strokeStyle='#382f24';c.lineWidth=.5;c.beginPath();c.moveTo(b.x,b.y-b.r*.7);c.lineTo(b.x,b.y+b.r*.7);c.stroke();c.fillStyle='rgba(245,215,157,.35)';c.beginPath();c.ellipse(b.x-b.r*.35,b.y-b.r*.2,b.r*.15,b.r*.32,.3,0,TAU);c.fill();}
    if(s.rain?.active){const r=s.rain;c.fillStyle='rgba(175,215,219,.18)';c.fillRect(0,r.y-r.width,100,r.width*2);c.strokeStyle='rgba(224,244,229,.5)';c.lineWidth=.25;for(let i=0;i<32;i++){const x=hash(i+Math.floor(time*9)*41)*100,y=r.y+(hash(i+31)*2-1)*r.width;c.beginPath();c.moveTo(x,y);c.lineTo(x-1.1,y+2.5);c.stroke();}}
    if(s.bird?.active || s.bird?.warning){
      const b=s.bird;c.save();c.translate(b.x,b.y);c.fillStyle=b.active?'rgba(12,21,24,.40)':'rgba(255,223,139,.13)';
      const r=b.r,flap=Math.sin(time*3)*.12;c.beginPath();c.moveTo(0,-r*.3);
      c.quadraticCurveTo(-r*.45,-r*(.72+flap),-r,-r*.12);c.quadraticCurveTo(-r*.55,r*.28,-r*.14,r*.18);
      c.lineTo(-r*.24,r*.58);c.lineTo(0,r*.4);c.lineTo(r*.24,r*.58);c.lineTo(r*.14,r*.18);
      c.quadraticCurveTo(r*.55,r*.28,r,-r*.12);c.quadraticCurveTo(r*.45,-r*(.72+flap),0,-r*.3);c.fill();
      c.beginPath();c.ellipse(0,-r*.04,r*.14,r*.36,0,0,TAU);c.fill();
      if(b.warning){c.strokeStyle='rgba(255,227,161,.65)';c.lineWidth=.4;c.setLineDash([1.2,1.2]);c.beginPath();c.ellipse(0,0,r,r*.65,0,0,TAU);c.stroke();c.setLineDash([]);}c.restore();
    }
  }
  drawAnts(c,s,time) {
    const count=Math.min(s.count||0,1500);
    c.fillStyle='rgba(14,24,18,.3)';c.beginPath();for(let i=0;i<count;i++){c.moveTo(s.x[i]+.9,s.y[i]+.4);c.arc(s.x[i]+.25,s.y[i]+.4,.65,0,TAU);}c.fill();
    c.fillStyle='#152019';c.beginPath();for(let i=0;i<count;i++){const x=s.x[i],y=s.y[i],a=s.angle[i];c.moveTo(x+.8,y);c.ellipse(x,y,.85,.4,a,0,TAU);}c.fill();
    c.strokeStyle='rgba(20,31,22,.8)';c.lineWidth=.18;c.beginPath();for(let i=0;i<count;i+=3){const x=s.x[i],y=s.y[i],a=s.angle[i],dx=Math.cos(a),dy=Math.sin(a),wiggle=Math.sin(time*12+i)*.15;for(let k=-1;k<=1;k++){const xx=x+dx*k*.35,yy=y+dy*k*.35;c.moveTo(xx-dy*.65+dx*wiggle,yy+dx*.65+dy*wiggle);c.lineTo(xx+dy*.65-dx*wiggle,yy-dx*.65-dy*wiggle);}}c.stroke();
    c.fillStyle='#efd28a';c.beginPath();for(let i=0;i<count;i++)if(s.carry[i]){const x=s.x[i]+Math.cos(s.angle[i])*.9,y=s.y[i]+Math.sin(s.angle[i])*.9;c.moveTo(x+.38,y);c.arc(x,y,.38,0,TAU);}c.fill();
  }
}
