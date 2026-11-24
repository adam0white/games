// All pictures are drawn here. Coordinates inside an icon are -16..16.
export const INK='#293e3a', CREAM='#fff7e8', COLORS=['#d48365','#8b9d81','#9b8eb6','#d5af62','#679eab','#b17c8b'];
export function round(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke()}}
export function oval(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill()}
function line(c,pts,color=INK,width=2.5){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke()}
export function star(c,x,y,r,color='#e6b85b'){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.46:r;const px=x+Math.cos(a)*s,py=y+Math.sin(a)*s;i?c.lineTo(px,py):c.moveTo(px,py)}c.closePath();c.fillStyle=color;c.fill()}
export function heart(c,x,y,r,color='#d88079'){c.save();c.translate(x,y);c.scale(r/16,r/16);c.beginPath();c.moveTo(0,13);c.bezierCurveTo(-29,-5,-10,-23,0,-9);c.bezierCurveTo(10,-23,29,-5,0,13);c.fillStyle=color;c.fill();c.restore()}
export function icon(c,kind,x,y,size=28,color=INK){c.save();c.translate(x,y);c.scale(size/32,size/32);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2.5;c.lineCap='round';c.lineJoin='round';
 if(kind==='baby'||kind===0){oval(c,0,2,12,13,'#edc599');oval(c,-12,3,3,4,'#edc599');oval(c,12,3,3,4,'#edc599');line(c,[[-3,-10],[0,-14],[3,-11]],color,2);oval(c,-4,0,1.4,1.7,color);oval(c,4,0,1.4,1.7,color);oval(c,0,8,4,3,'#b97b7b');}
 else if(kind==='garden'||kind===1){line(c,[[0,13],[0,-5]],color,3);oval(c,-6,0,8,4,'#749b72');oval(c,6,-6,8,4,'#749b72');round(c,-9,8,18,8,2,'#c48862');}
 else if(kind==='cooking'||kind===2){round(c,-12,-1,24,14,5,'#6d9893');line(c,[[-15,1],[-12,1]],color);line(c,[[12,1],[15,1]],color);line(c,[[-13,-3],[13,-3]],color);oval(c,0,-6,3,2,color);line(c,[[-5,-11],[-6,-15]],'#b19373',2);line(c,[[5,-11],[4,-15]],'#b19373',2);}
 else if(kind==='heavy'||kind==='lifting'||kind===3){round(c,-14,-7,6,14,2,color);round(c,8,-7,6,14,2,color);round(c,-10,-3,20,6,2,color);}
 else if(kind==='dog'||kind===4){oval(c,0,1,10,12,'#d5aa77');oval(c,-11,-2,4,10,'#9e7454');oval(c,11,-2,4,10,'#9e7454');oval(c,-4,-1,1.5,1.8,color);oval(c,4,-1,1.5,1.8,color);oval(c,0,5,3,2.5,color);line(c,[[0,7],[0,10],[4,10]],color,1.5);}
 else if(kind==='patience'||kind===5){heart(c,0,0,12,'#c87c86');line(c,[[-14,-9],[-11,-6]],'#a88567',2);line(c,[[14,-9],[11,-6]],'#a88567',2);}
 else if(kind==='seen'){c.beginPath();c.moveTo(-14,0);c.quadraticCurveTo(0,-18,14,0);c.quadraticCurveTo(0,18,-14,0);c.fillStyle='#e7f0e3';c.fill();c.stroke();oval(c,0,0,5,6,'#497b68');oval(c,1,-1,2,2,CREAM);}
 else if(kind==='heard'){c.beginPath();c.moveTo(-4,12);c.bezierCurveTo(8,15,2,3,10,-2);c.bezierCurveTo(18,-15,-12,-20,-11,-3);c.stroke();line(c,[[-5,-3],[-2,-8],[5,-6],[4,0],[-1,2]],color,2);}
 else if(kind==='said'){round(c,-14,-11,28,20,7,'#fff7e8',color);line(c,[[-7,9],[-10,14],[1,9]],color,2);for(let i=-6;i<=6;i+=6)oval(c,i,-1,1.5,1.5,color);}
 else if(kind==='clock'){oval(c,0,0,13,13,'#fff7e8');c.beginPath();c.arc(0,0,13,0,Math.PI*2);c.stroke();line(c,[[0,-8],[0,0],[6,3]],color,2);}
 else if(kind==='tick'){line(c,[[-7,0],[-2,6],[9,-7]],'#477e62',3.5)}
 else if(kind==='cross'){line(c,[[-6,-6],[6,6]],'#bb6960',3);line(c,[[6,-6],[-6,6]],'#bb6960',3)}
 c.restore();}
export function person(c,helper,x,y,scale=1,t=0,opts={}){c.save();c.translate(x,y);c.scale(scale,scale);const id=typeof helper.id==='number'?helper.id:hash(String(helper.id));const skin=['#dca97d','#bc825f','#efc4a0','#a56f54'][Math.abs(id)%4],shirt=COLORS[Math.abs(id)%6],puff=helper.temperament==='boastful',shy=helper.temperament==='shy';const bounce=opts.still?0:Math.sin(t*2+id)*1.3;c.translate(0,bounce);if(opts.jump){c.translate(0,-Math.abs(Math.sin(t*9))*7);const stretch=1+.06*Math.sin(t*9);c.scale(1/stretch,stretch);}oval(c,0,39,27,5,'#293e3a18');const step=opts.walk?Math.sin(t*18)*8:0;line(c,[[-10,20],[-11+step,37],[-18+step,37]],INK,6);line(c,[[10,20],[11-step,37],[18-step,37]],INK,6);round(c,puff?-25:-20,-16,puff?50:40,43,14,shirt);if(puff){line(c,[[-20,-7],[-30,7],[-18,11]],skin,8);line(c,[[20,-7],[30,7],[18,11]],skin,8)}else{line(c,[[-18,-5],[-24,19]],skin,7);line(c,[[18,-5],[24,19]],skin,7)}
 oval(c,0,shy?-24:-29,22,24,skin); // hair, silhouettes persist for returning helpers
 c.beginPath();c.ellipse(0,shy?-39:-44,23,13,0,Math.PI,Math.PI*2);c.lineTo(22,-31);c.quadraticCurveTo(12,-43,-9,-41);c.lineTo(-21,-26);c.closePath();c.fillStyle=['#50453c','#8b6049','#3e4547','#d0a568'][Math.abs(id)%4];c.fill();
 const fy=shy?-25:-30;oval(c,-7,fy,1.7,2.2,INK);oval(c,7,fy,1.7,2.2,INK);oval(c,-13,fy+7,4,2,'#cc84646a');oval(c,13,fy+7,4,2,'#cc84646a');if(opts.sad){line(c,[[-5,fy+14],[0,fy+11],[5,fy+14]],INK,1.5)}else{c.beginPath();c.arc(0,fy+7,6,.2,Math.PI-.2);c.strokeStyle=INK;c.lineWidth=1.7;c.stroke()}
 if(shy){oval(c,-12,-11,7,10,skin);oval(c,12,-11,7,10,skin);line(c,[[-15,-14],[-15,-6]],'#9e7056',1);line(c,[[9,-14],[9,-6]],'#9e7056',1)}
 if(puff){line(c,[[-11,fy-7],[-3,fy-9]],INK,2);line(c,[[3,fy-9],[11,fy-7]],INK,2);star(c,13,9,6,'#f5d78a')}
 if(helper.reputation)star(c,25,-51,10);c.restore()}
export function hash(text){let n=0;for(const ch of text)n=(n*31+ch.charCodeAt(0))|0;return n>>>0}
export function house(c,x,y,w,h,color,skill,t=0){oval(c,x+w/2,y+h+5,w*.55,6,'#293e3a13');round(c,x,y+13,w,h-13,9,color);c.beginPath();c.moveTo(x-3,y+17);c.lineTo(x+w/2,y-5);c.lineTo(x+w+3,y+17);c.closePath();c.fillStyle='#6c7968';c.fill();round(c,x+w*.19,y+h*.36,w*.62,h*.64, w*.3,'#fff7e8');icon(c,skill,x+w*.5,y+h*.59,Math.min(32,w*.52));oval(c,x+w*.69,y+h*.8,2,2,'#a8936a');}
