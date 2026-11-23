import { create, step, DT, prompt, good } from './sim.js';
const canvas = document.querySelector('canvas'), g = canvas.getContext('2d');
let s = create(17), seed = 17, paused = false, slow = false, last = 0, acc = 0, now = 0;
let scale = 1, ox = 0, oy = 0, width = 0, height = 0;
let spots = [], pointer = null, drag = null, hover = null, focus = 0, particles = [], shake = 0;
let audio;
// Start card, a guide that names the next tap, and a short message when a tap is refused.
let intro = true, flash = null, touched = 0, waiting = false;
const BLUE = '#1857a8';
function say(str, seconds = 1.8){ flash = { text: str, until: now + seconds }; }
// The next step in plain words, and the spot that does it. The blue ring is drawn on that spot.
function guide(){
 if(intro||s.over||paused)return null;
 if(s.operation)return {text:'Working…'};
 const k=s.active,o=s[k],name=k==='bell'?'bell':'lamp';
 if(s.departed)return {text:s.delivered?`Aylin took the ${s.delivered} home. Well done.`:'Aylin has gone home.'};
 if(o.gone)return null;
 if(s.selected==='pin')return {text:'Now tap the empty slot in the wheel.',spot:'axle'};
 if(s.selected==='spacer')return {text:'Now tap the blue outline under the striker arm.',spot:'spacer-striker'};
 if(s.selected==='coupling')return {text:'Now tap the blue outline to fit it.',spot:k==='bell'?'coupling-socket':'lamp-coupling'};
 if(k==='cart'){
  if(!o.open)return {text:'The wheel wobbles. Tap its round cap to open it.',spot:'cap'};
  if(o.pin==='bent')return s.tool==='pliers'?{text:'Now tap the bent pin to pull it out.',spot:'axle'}:{text:'A bent pin. Tap the pliers to pick them up.',spot:'pliers'};
  if(!o.pin)return {text:'Tap the straight pin in the tray.',spot:'part-pin'};
  if(!o.fixed)return {text:'Tap the play button to test the wheel.',spot:'test'};
  const next=!s.bell.gone?'bell':!s.lamp.gone?'lamp':null;
  return next?{text:`Cart fixed. Tap the ${next} above to work on it.`,spot:'switch-'+next}:{text:'Cart fixed.'};
 }
 if(!s.cart.fixed&&!s.rafi.holding)return {text:'Fix the cart first. Tap it above.',spot:'switch-cart'};
 if(!o.open)return {text:`Tap the ${name} to open its cover.`,spot:name+'-cover'};
 if(s.broken)return s.visitor&&!s.admitted?{text:'The copper piece broke. Tap ! to tell Aylin.',spot:'admit'}:{text:'The copper piece broke. Tell Aylin when she is back.'};
 const sock=k==='bell'?'coupling-socket':'lamp-coupling';
 if(s.coupling==='tray')return {text:'One copper piece for two repairs. Tap it to use it here.',spot:'part-coupling'};
 if(s.coupling!==k)return {text:`The copper piece is in the ${k==='bell'?'lamp':'bell'}. Tap above to go there.`,spot:'switch-'+(k==='bell'?'lamp':'bell')};
 if(k==='bell'&&s.spacer==='tray')return {text:'Tap the gold bar in the tray.',spot:'part-spacer'};
 if(k==='bell'&&s.spacer==='base'&&o.tested)return s.tool==='pliers'?{text:'Tap the gold bar under the bell to pull it out.',spot:'spacer-base'}:{text:'The striker cannot reach the bell. Tap the pliers.',spot:'pliers'};
 if(k==='lamp'&&!s.fastened&&s.lamp.facing!==1)return {text:'The piece points the wrong way. Tap the turn button.',spot:'rotate'};
 if(k==='lamp'&&s.fastened&&o.tested&&!o.fixed)return s.tool==='wrench'?{text:'Tap the copper piece to loosen it.',spot:sock}:{text:'It points the wrong way. Tap the wrench.',spot:'wrench'};
 if(!s.fastened)return s.tool==='wrench'?{text:'Now tap the copper piece to tighten it.',spot:sock}:{text:'It is loose. Tap the wrench to pick it up.',spot:'wrench'};
 if(!o.tested||!o.fixed)return {text:k==='bell'?'Tap the play button to ring the bell.':'Tap the play button to turn the crank.',spot:'test'};
 return {text:s.arrival?`The ${name} works. Tap Aylin to hand it over.`:`The ${name} works. Aylin collects one when she returns.`,spot:s.arrival&&s.visitor?'aylin':undefined};
}
function wrap(str,max=46){const lines=[];let cur='';for(const w of str.split(' ')){if(cur&&(cur+' '+w).length>max){lines.push(cur);cur=w;}else cur=cur?cur+' '+w:w;}if(cur)lines.push(cur);return lines;}
const C = { ink:'#342c29',dark:'#41342a',wood:'#b87840',gold:'#dca855',light:'#f8df9b',copper:'#bd6c3c',cream:'#ffedbf',blue:'#527e80',red:'#a54936',green:'#73834e',steel:'#adb6ad' };
function resize(){const d=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=width*d;canvas.height=height*d;scale=Math.min(width/460,height/900);ox=(width-460*scale)/2;oy=(height-900*scale)/2;g.setTransform(d,0,0,d,0,0)}
addEventListener('resize',resize);resize();
function sound(kind){
 if(!audio)return;
 const t=audio.currentTime;
 function note(f,d,v,type='sine',delay=0){const o=audio.createOscillator(),a=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,t+delay);a.gain.setValueAtTime(v,t+delay);a.gain.exponentialRampToValueAtTime(.0001,t+delay+d);o.connect(a).connect(audio.destination);o.start(t+delay);o.stop(t+delay+d)}
 if(kind==='ring'){[523,1049,1571,2113].forEach((f,i)=>note(f,1.8-i*.25,.08/(i+1)));}
 else if(kind==='snap'){note(650,.045,.075,'triangle');note(170,.12,.08,'sine',.025)}
 else if(kind==='success'){[330,440,660].forEach((f,i)=>note(f,.4,.07,'triangle',i*.09))}
 else if(kind==='thud'){note(90,.22,.16,'triangle');note(47,.17,.1)}
 else if(kind==='break'){note(130,.4,.15,'sawtooth');note(950,.08,.08)}
 else if(kind==='turn')note(280,.06,.04,'triangle');
 else if(kind==='voice')note(230,.09,.025,'triangle');
 else if(kind==='closing'){[440,330,220].forEach((f,i)=>note(f,.7,.06,'triangle',i*.4))}
 else if(kind==='work')note(120,.09,.06,'triangle');
}
function unlock(){if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A()}if(audio?.state==='suspended')audio.resume()}
function emit(){for(const e of s.events){sound(e.kind);if(e.kind==='busy'){say('Still working. Wait for the bar to fill.');sound('turn')}if(e.kind==='need-pliers'){say('Pick up the pliers first.');sound('turn')}if(e.kind==='success'||e.kind==='ring')say('It works!',2.5);if(e.kind==='thud')say('Not working yet.',2.2);if(e.kind==='break')say('The loose copper piece broke.',3);if(e.kind==='cancelled')say('Rafi let go. That work stopped.',2.5);if(['snap','success','break'].includes(e.kind)){for(let i=0;i<9;i++)particles.push({x:230,y:435,vx:(Math.random()-.5)*100,vy:-Math.random()*90,life:1,color:e.kind==='break'?C.red:C.light});}if(e.kind==='thud'||e.kind==='break')shake=5}}
function command(a){step(s,[a]);emit();}
function rr(x,y,w,h,r=12,fill=C.dark,stroke){g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke()}}
function circle(x,y,r,fill,stroke,lw=2){g.beginPath();g.arc(x,y,r,0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw;g.stroke()}}
function line(x,y,a,b,color,w=4){g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.stroke()}
function text(str,x,y,size=18,color=C.cream,align='center'){g.fillStyle=color;g.font=`${size}px Georgia,serif`;g.textAlign=align;g.textBaseline='middle';g.fillText(str,x,y)}
function shadow(x,y,w,h){g.save();g.globalAlpha=.23;g.fillStyle='#26160c';g.beginPath();g.ellipse(x,y,w,h,0,0,7);g.fill();g.restore()}
let hintSpot=null;
function spot(id,x,y,r,action,extra={}){spots.push({id,x,y,r,action,...extra});if(id===hintSpot&&!drag){const q=r+5+3*Math.sin(now*5);circle(x,y,q,null,'#ffffff',7);circle(x,y,q,null,BLUE,4)}if((hover===id||spots[focus]?.id===id&&keyboard)&&s.started){circle(x,y,r,null,'#ffedb988',2)}}
let keyboard=false;
function screw(x,y,loose=false){circle(x,y,9,C.steel,C.ink,2);line(x-4,y+3,x+4,y-3,C.ink,2);if(loose){g.setLineDash([3,3]);circle(x,y,16,null,BLUE,3);g.setLineDash([])}}
function coupling(x,y,r=0,small=false){g.save();g.translate(x,y);g.rotate(r);const z=small?.65:1;g.scale(z,z);g.beginPath();g.moveTo(-24,-13);g.lineTo(13,-13);g.lineTo(27,0);g.lineTo(13,13);g.lineTo(-24,13);g.closePath();g.fillStyle=s.broken?'#8c4c35':C.copper;g.fill();g.lineWidth=3;g.strokeStyle=C.ink;g.stroke();circle(-12,0,5,C.ink);circle(12,0,5,C.ink);if(s.broken){line(-5,-14,4,-2,C.light,3);line(4,-2,-3,13,C.light,3)}g.restore()}
function socket(x,y,angle=0){g.save();g.translate(x,y);g.rotate(angle);g.beginPath();g.moveTo(-26,-15);g.lineTo(14,-15);g.lineTo(30,0);g.lineTo(14,15);g.lineTo(-26,15);g.closePath();g.fillStyle='#ffffff55';g.fill();g.strokeStyle='#ffffff';g.lineWidth=5;g.stroke();g.setLineDash([6,5]);g.strokeStyle=BLUE;g.lineWidth=3;g.stroke();g.setLineDash([]);g.restore()}
function pin(x,y,bent=false,rot=0){g.save();g.translate(x,y);g.rotate(rot);line(-26,0,bent?-5:26,bent?-6:0,C.ink,12);line(-26,0,bent?-5:26,bent?-6:0,C.steel,7);if(bent){line(-5,-6,26,8,C.ink,12);line(-5,-6,26,8,C.steel,7)}circle(-27,0,7,C.steel,C.ink,2);g.restore()}
function spacer(x,y){g.save();g.translate(x,y);rr(-24,-10,48,20,5,C.gold,C.ink);line(-15,-4,15,-4,C.light,2);circle(-13,2,3,C.ink);circle(13,2,3,C.ink);g.restore()}
function pliers(x,y){g.save();g.translate(x,y);g.rotate(-.25);line(-6,0,-23,30,C.ink,11);line(6,0,23,30,C.ink,11);line(-6,0,-23,30,C.red,7);line(6,0,23,30,C.red,7);line(-5,0,10,-28,C.steel,7);line(5,0,-10,-28,C.steel,7);circle(0,0,5,C.ink);g.restore()}
function wrench(x,y){g.save();g.translate(x,y);g.rotate(.4);line(0,23,0,-20,C.ink,17);line(0,23,0,-20,C.steel,11);g.beginPath();g.arc(0,-22,13,-.3,Math.PI+ .3);g.strokeStyle=C.steel;g.lineWidth=9;g.stroke();circle(0,25,4,C.ink);g.restore()}
function gear(x,y,r,angle,color=C.gold){g.save();g.translate(x,y);g.rotate(angle);for(let i=0;i<12;i++){g.rotate(Math.PI/6);rr(-5,-r-5,10,13,2,color,C.ink)}circle(0,0,r,color,C.ink,3);circle(0,0,r*.58,C.dark);circle(0,0,5,C.steel);g.restore()}
function face(x,y,who){if(who==='aylin'&&s.arrival&&!s.departed)x+=Math.max(0,(242-s.t)/2)*80;if(who==='aylin'&&s.departed)x+=Math.min(1,(s.t-s.departureAt)/2)*45;const b=s.bubble?.who===who;const holding=who==='rafi'&&s.rafi.holding;const visible=who!=='aylin'||(!s.departed&&(s.arrival||s.t<8));g.save();g.globalAlpha=visible?1:.22;const bob=Math.sin(now*1.5+(who==='sam'?2:0))*2;
 shadow(x,y+44,31,8);rr(x-25,y+13,50,43,18,who==='rafi'?C.blue:who==='sam'?C.green:C.red);circle(x,y-3+bob,21,who==='rafi'?'#b4754c':who==='sam'?'#d5a06b':'#c78e60',C.ink,3);g.beginPath();g.arc(x,y-10+bob,21,Math.PI,Math.PI*2);g.fillStyle=C.ink;g.fill();circle(x-7,y-4+bob,2,C.ink);circle(x+7,y-4+bob,2,C.ink);line(x-5,y+7+bob,x+5,y+7+bob,C.ink,2);
 if(holding){line(x-20,y+30,190,395,C.blue,15);circle(190,395,10,'#b4754c');}else{line(x-23,y+24,x-32,y+41,C.ink,6);line(x+23,y+24,x+32,y+41,C.ink,6)}
 if(who==='rafi'&&!holding){rr(x+23,y+22,20,27,2,C.wood,C.ink);line(x+26,y+31,x+39,y+31,C.cream,2)}
 if(who==='aylin'&&!s.arrival){g.globalAlpha=.4;line(x-15,y+41,x+15,y+41,C.light,2)}g.restore();
 spot(who,x,y+8,37,{type:who==='sam'?'cancel':who});
 if(b){const str=s.bubble.text;rr(28,181,404,48,14,C.cream);text(str,230,205,18,C.ink);g.beginPath();g.moveTo(x-8,181);g.lineTo(x,163);g.lineTo(x+8,181);g.fillStyle=C.cream;g.fill();}
}
function cartMini(x,y){rr(x-25,y-12,50,23,4,C.red,C.ink);circle(x-18,y+16,10,C.dark,C.gold);circle(x+18,y+16,10,C.dark,C.gold);line(x-25,y-10,x-40,y-24,C.ink,3)}
function bellMini(x,y){g.beginPath();g.moveTo(x-22,y+15);g.quadraticCurveTo(x-13,y+3,x-13,y-13);g.quadraticCurveTo(x,y-25,x+13,y-13);g.quadraticCurveTo(x+13,y+3,x+22,y+15);g.closePath();g.fillStyle=C.gold;g.fill();g.strokeStyle=C.ink;g.lineWidth=3;g.stroke();circle(x,y+18,4,C.dark)}
function lampMini(x,y){line(x,y+15,x+8,y-13,C.ink,7);rr(x-22,y+15,44,7,3,C.blue);g.beginPath();g.moveTo(x-16,y-10);g.lineTo(x+25,y-10);g.lineTo(x+15,y-30);g.lineTo(x-6,y-30);g.closePath();g.fillStyle=C.green;g.fill()}
function background(){
 g.fillStyle='#302822';g.fillRect(0,0,width,height);g.save();g.translate(ox,oy);g.scale(scale,scale);
 const wall=g.createLinearGradient(0,0,460,600);wall.addColorStop(0,'#e4bc77');wall.addColorStop(1,'#a46c3c');g.fillStyle=wall;g.fillRect(0,-100,460,1020);
 // Afternoon window and slant of light.
 rr(26,25,120,115,5,'#f6d795',C.dark);line(86,25,86,140,C.dark,5);line(26,78,146,78,C.dark,5);
 g.globalAlpha=.13;g.fillStyle='#ffebae';g.beginPath();g.moveTo(26,140);g.lineTo(146,140);g.lineTo(450,700);g.lineTo(90,700);g.closePath();g.fill();g.globalAlpha=1;
 for(let i=0;i<6;i++){line(165+i*42,30,165+i*42,69,C.dark,4);circle(165+i*42,68,5,C.dark)}
 rr(0,247,460,655,12,'#795033');rr(8,253,444,631,10,'#bd844c');
 for(let i=0;i<8;i++){g.globalAlpha=.13;line(18,282+i*77,444,278+i*77,C.ink,2)}g.globalAlpha=1;
 // Fading afternoon: the clock is a sun, no numeric HUD.
 const p=s.t/360;circle(53,172,19,'#583e2e');g.beginPath();g.moveTo(53,172);g.arc(53,172,16,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-p));g.closePath();g.fillStyle=C.light;g.fill();
 if(s.started){spot('pause',410,52,29,{type:'pause'});line(404,43,404,61,C.dark,5);line(416,43,416,61,C.dark,5)}
 face(190,117,'rafi');face(293,117,'sam');face(393,117,'aylin');
 if(s.started){text('Rafi',190,77,16,C.dark);text('Sam',293,77,16,C.dark);text('Aylin',393,77,16,C.dark)}
 for(const [i,k] of ['cart','bell','lamp'].entries()){const x=90+i*140;rr(x-58,242,116,64,12,s.active===k?'#efd294':'#986b45',s.active===k?C.dark:null);if(s[k].gone)g.globalAlpha=.25;({cart:cartMini,bell:bellMini,lamp:lampMini}[k])(x,267);g.globalAlpha=1;if(k!=='cart'&&!s[k].gone){g.save();g.translate(x+36,286);g.scale(.32,.32);if(s.coupling===k)coupling(0,0);else socket(0,0);g.restore()}if(s[k].fixed){circle(x+40,255,7,C.green);line(x+36,255,x+39,258,C.cream,2);line(x+39,258,x+44,251,C.cream,2)}spot('switch-'+k,x,273,49,{type:'switch',object:k})}
 // Cloth. Strong quiet contrast around the work.
 rr(22,319,416,292,25,'#d6b779',C.dark);g.setLineDash([4,6]);rr(31,328,398,274,20,null,'#b18c52');g.setLineDash([]);
}
function cart(){const open=s.cart.open, isTest=s.testObject==='cart'&&s.t-s.testAt<4;const tt=s.t-s.testAt;let dx=isTest?Math.sin(Math.min(tt,2)/2*Math.PI)*70:0;let wobble=s.cart.fixed?0:Math.sin(now*4)*.07;
 g.save();g.translate(dx,0);shadow(232,512,134,17);rr(104,353,218,83,9,C.red,C.ink);rr(111,359,204,54,6,'#b75b3e');for(let i=0;i<4;i++)line(125+i*48,364,125+i*48,410,'#873e2e',2);line(102,359,76,332,C.ink,7);circle(98,444,28,C.ink,C.gold,5);circle(98,444,9,C.steel);line(99,436,251,436,C.ink,15);
 g.save();g.translate(251,445);g.rotate(wobble);g.scale(1-Math.abs(wobble)*2,1);circle(0,0,65,C.dark,C.ink,5);circle(0,0,51,C.gold,C.ink,3);g.save();g.rotate((isTest?tt*5:now*.08)+s.cart.angle*Math.PI/2);for(let i=0;i<8;i++){g.rotate(Math.PI/4);line(0,0,0,47,C.wood,9)}g.restore();circle(0,0,22,C.steel,C.ink,3);g.restore();
 if(!open){circle(251,445,23,C.copper,C.ink,3);line(241,445,261,445,C.light,3);g.globalAlpha=.45+.3*Math.sin(now*3);circle(251,445,34,null,C.light,3);g.globalAlpha=1;spot('cap',251+dx,445,38,{type:'open'})}
 else {rr(174,410,112,57,15,C.dark,C.ink);if(s.cart.pin&&s.operation?.kind!=='pull-pin')pin(230,438,s.cart.pin==='bent');else{rr(201,429,60,17,5,'#ffffff55','#ffffff');g.setLineDash([5,4]);rr(201,429,60,17,5,null,BLUE);g.setLineDash([])}screw(327,490);circle(360,486,21,C.copper,C.ink);spot('axle',230+dx,438,40,{type:s.cart.pin==='bent'?'pull':'fit',part:'pin'}, {destination:'pin',draggable:s.cart.pin==='bent'});}
 if(!s.rafi.holding&&!s.cart.fixed){rr(141,477,28,40,4,C.blue,C.ink);line(125,496,183,496,C.ink,9);line(154,479,154,425,C.blue,12);rr(132,418,45,15,3,C.blue,C.ink)}
 g.restore();
}
function bell(){const open=s.bell.open, elapsed=s.t-s.testAt, testing=s.testObject==='bell'&&elapsed<4;const swing=testing?Math.sin(elapsed*20)*Math.exp(-elapsed)* (s.testGood?.12:.025):0;const baseLift=s.spacer==='base'?18:0;
 shadow(230,518,113,15);rr(103,488,253,27,7,C.wood,C.ink);g.save();g.translate(210,353-baseLift);g.rotate(swing+Math.sin(s.bell.angle*Math.PI/2)*.045);g.beginPath();g.moveTo(-90,129);g.quadraticCurveTo(-50,95,-51,28);g.quadraticCurveTo(-48,-16,0,-18);g.quadraticCurveTo(48,-16,51,28);g.quadraticCurveTo(50,95,90,129);g.closePath();g.fillStyle=C.gold;g.fill();g.lineWidth=5;g.strokeStyle=C.ink;g.stroke();g.beginPath();g.ellipse(0,129,89,14,0,0,7);g.fillStyle='#91602e';g.fill();g.stroke();line(-35,20,-46,94,C.light,5);
 if(open){g.beginPath();g.moveTo(-34,19);g.lineTo(34,19);g.lineTo(61,124);g.lineTo(-61,124);g.closePath();g.fillStyle=C.dark;g.fill();line(-26,31,25,31,'#776448',3)}g.restore();
 rr(305,390,17,97,4,C.blue,C.ink);const raised=s.spacer==='striker';const hit=testing?Math.sin(elapsed*8)*Math.exp(-elapsed*1.5)*(s.testGood?25:8):0;const sy=raised?413:432;line(316,sy,263-hit,sy,C.steel,9);circle(257-hit,sy,14,C.copper,C.ink);if(open){line(210,347,210,393,C.steel,7);circle(210,397,10,C.copper);if(s.spacer==='tray'){for(const [x,y] of [[158,482],[314,480]]){rr(x-24,y-10,48,20,5,'#ffffff55','#ffffff');g.setLineDash([5,4]);rr(x-24,y-10,48,20,5,null,BLUE);g.setLineDash([])}}if(s.spacer==='base'&&s.operation?.kind!=='pull-spacer')spacer(158,482);if(raised&&s.operation?.kind!=='pull-spacer')spacer(314,480);if(s.coupling==='bell'){coupling(316,448);if(s.fastened)screw(316,448);else screw(349,469,true)}else socket(316,448);}
 if(!open){circle(210,358,16,C.copper,C.ink);spot('bell-cover',210,405,78,{type:'open'})}else{
 spot('spacer-base',158,482,31,s.spacer==='base'?{type:'spacer-pull'}:{type:'fit',part:'spacer',target:'base'},{destination:'base',draggable:s.spacer==='base'});
 spot('spacer-striker',314,482,30,raised?{type:'spacer-pull'}:{type:'fit',part:'spacer',target:'striker'},{destination:'striker',draggable:raised});
 spot('coupling-socket',316,439,32,s.coupling==='bell'?{type:s.tool==='wrench'?'fasten':'pull',part:'coupling'}:{type:'fit',part:'coupling'},{destination:'coupling',draggable:s.coupling==='bell'});
 screw(89,481);rr(85,345,40,70,10,C.gold,C.ink);
 }
 if(testing&&s.testGood){g.globalAlpha=Math.max(0,1-elapsed/3);for(let i=0;i<3;i++){g.beginPath();g.arc(210,410,90+i*17+elapsed*9,-.5,.5);g.strokeStyle=C.light;g.lineWidth=3;g.stroke()}g.globalAlpha=1}
}
function lamp(){const open=s.lamp.open,elapsed=s.t-s.testAt,testing=s.testObject==='lamp'&&elapsed<4;const moving=testing&&(s.testGood||elapsed<.3);shadow(230,520,115,13);rr(112,420,238,94,17,C.blue,C.ink);rr(122,430,218,74,13,open?C.dark:'#638d88',C.ink);line(174,422,196,345,C.ink,15);line(196,345,260,330,C.ink,12);g.beginPath();g.moveTo(218,354);g.lineTo(326,354);g.lineTo(299,306);g.lineTo(244,306);g.closePath();g.fillStyle=C.green;g.fill();g.strokeStyle=C.ink;g.lineWidth=4;g.stroke();circle(271,365,15,testing&&s.testGood?C.light:'#796d4f',C.ink);
 if(testing&&s.testGood){const light=g.createRadialGradient(271,368,4,271,393,100);light.addColorStop(0,'#ffef9faa');light.addColorStop(1,'#ffdf7000');g.fillStyle=light;g.fillRect(150,354,240,170)}
 if(open){gear(170,467,28,moving?elapsed*4:0);gear(291,461,26,moving?-elapsed*4:0,C.copper);if(s.coupling==='lamp'){coupling(231,463,s.lamp.facing?Math.PI:0);if(s.fastened)screw(231,463);else{screw(259,497,true);g.globalAlpha=.4+.4*Math.sin(now*5);circle(231,463,33,null,C.red,3);g.globalAlpha=1}}else socket(231,463);spot('lamp-coupling',231,462,39,s.coupling==='lamp'?{type:s.tool==='wrench'?'fasten':'pull',part:'coupling'}:{type:'fit',part:'coupling'},{destination:'coupling',draggable:s.coupling==='lamp'});rr(78,365,43,69,11,C.blue,C.ink);screw(90,480)}else{line(154,452,305,452,C.light,2);screw(146,484);screw(317,484);spot('lamp-cover',230,463,70,{type:'open'})}
 line(350,465,380,465,C.ink,8);line(380,465,380+(testing?Math.sin(elapsed*9)*12:0),490,C.copper,10);
}
function controls(){
 // Rotation and test are at the work, not a text menu.
 circle(64,557,24,C.dark);g.beginPath();g.arc(64,557,13,.4,5.3);g.strokeStyle=C.light;g.lineWidth=3;g.stroke();line(69,544,76,545,C.light,3);line(76,545,75,552,C.light,3);spot('rotate',64,557,29,{type:'rotate'});
 circle(396,557,26,C.blue,C.ink);g.beginPath();g.moveTo(389,545);g.lineTo(407,557);g.lineTo(389,569);g.closePath();g.fillStyle=C.cream;g.fill();spot('test',396,557,32,{type:'test'});
 if(s.operation){const p=Math.min(1,(s.t-s.operation.start)/(s.operation.end-s.operation.start));rr(110,553,240,18,9,C.dark,C.ink);rr(113,556,234*p,12,6,C.light);g.save();g.translate(232,539);g.rotate(now*4);line(-8,0,8,0,C.dark,3);g.restore()}
 const step=guide();hintSpot=flash&&now<flash.until?null:step?.spot||null;
 const message=flash&&now<flash.until?flash.text:waiting&&!s.departed?'Waiting for Aylin to come back…':step?.text;
 if(message){const lines=wrap(message);rr(24,612,412,52,10,C.cream,C.ink);lines.slice(0,2).forEach((l,i)=>text(l,230,638+(i-(Math.min(2,lines.length)-1)/2)*21,17,C.ink))}
 rr(24,668,412,75,13,'#71513a',C.ink);
 for(const x of [91,230,368])rr(x-52,676,104,59,8,'#856344');
 if(s.cart.open&&s.cart.pin!=='bent'){pin(57,719,true,.15)}
 if(s.pin==='tray'){if(s.operation?.kind!=='fit-pin')pin(91,702);spot('part-pin',91,703,35,{type:'select',part:'pin'},{draggable:true})}
 if(s.spacer==='tray'){if(s.operation?.kind!=='fit-spacer')spacer(230,702);spot('part-spacer',230,703,35,{type:'select',part:'spacer'},{draggable:true})}
 if(s.coupling==='tray'){if(s.operation?.kind!=='fit-coupling')coupling(368,702);spot('part-coupling',368,703,36,{type:'select',part:'coupling'},{draggable:true})}
 if(s.selected){const x={pin:91,spacer:230,coupling:368}[s.selected];circle(x,702,40,null,'#ffffff',6);circle(x,702,40,null,BLUE,3)}
 for(const [tool,x] of [['pliers',114],['wrench',230]]){rr(x-45,771,90,77,17,s.tool===tool?'#edcf8e':'#916b47',C.ink);(tool==='pliers'?pliers:wrench)(x,805);spot(tool,x,810,43,{type:'tool',tool})}
 // Clock-pause and audio controls deliberately use symbols only.
 if(s.broken&&!s.admitted&&s.visitor){circle(362,809,35,C.red,C.ink);text('!',362,809,35);spot('admit',362,809,37,{type:'admit'})}
 else{rr(320,771,90,77,17,C.blue,C.ink);g.beginPath();g.moveTo(350,792);g.lineTo(381,809);g.lineTo(350,826);g.closePath();g.fillStyle=C.light;g.fill();spot('test-tool',365,809,43,{type:'test'})}
 if(s.rafi.holding){const p=(s.rafi.until-s.t)/30;rr(154,165,72,5,2,C.dark);rr(154,165,72*Math.max(0,p),5,2,C.light)}
 if(s.started&&s.tool)text(`holding the ${s.tool}`,230,874,16,C.cream);
}
function operationMotion(){
 const op=s.operation;if(!op||op.object!==s.active)return;
 const p=Math.min(1,(s.t-op.start)/(op.end-op.start)),ease=p*p*(3-2*p);
 const socketPos=op.object==='bell'?[316,448]:[231,463];
 let from,to,draw;
 if(op.kind==='pull-pin'){from=[230,438];to=[57,719];draw=(x,y)=>pin(x,y,true,-p*.3)}
 if(op.kind==='fit-pin'){from=[91,702];to=[230,438];draw=(x,y)=>pin(x,y,false,(1-p)*-.2)}
 if(op.kind==='pull-spacer'){from=s.spacer==='base'?[158,482]:[314,480];to=[230,702];draw=spacer}
 if(op.kind==='fit-spacer'){from=[230,702];to=op.target==='base'?[158,482]:[314,480];draw=spacer}
 if(op.kind==='fit-coupling'){from=[368,702];to=socketPos;draw=(x,y)=>coupling(x,y,(1-p)*-.3)}
 if(op.kind==='pull-coupling'){from=socketPos;to=[368,702];draw=(x,y)=>coupling(x,y,p*.2)}
 if(from){const x=from[0]+(to[0]-from[0])*ease,y=from[1]+(to[1]-from[1])*ease-26*Math.sin(p*Math.PI);shadow(x,y+24,26,7);draw(x,y)}
 if(op.kind==='fasten'||op.kind==='unfasten'){g.save();g.translate(...socketPos);g.rotate(Math.sin(p*Math.PI*6)*.5);wrench(0,-27);g.restore()}
 if(op.kind==='open'){const x=op.object==='cart'?251:210,y=op.object==='cart'?445:403;g.save();g.translate(x+70*ease,y-40*Math.sin(p*Math.PI));g.rotate(p*.4);circle(0,0,op.object==='cart'?22:31,C.copper,C.ink);screw(0,0);g.restore()}
}
function overlay(){if(intro){g.fillStyle='#251d17e6';g.fillRect(0,-100,460,1100);text('Copper Afternoon',230,270,36,C.light);['Three things on the repair bench:','a cart, a bell and a lamp.','Fix what you can before the sun dial runs out.'].forEach((l,i)=>text(l,230,345+i*30,20));['A blue ring shows where to tap next.','The line under the bench says why.'].forEach((l,i)=>text(l,230,470+i*28,18,'#e9d3a0'));text('Tap to begin',230,580,24,C.light);return}
 if(paused){g.fillStyle='#251d17';g.fillRect(0,-100,460,1100);text('Paused',230,350,36);text('Continue',230,445,24);spot('resume',230,445,75,{type:'pause'});text('Slow time',230,535,23);circle(325,535,11,slow?C.gold:null,C.cream,2);spot('slow',230,535,65,{type:'slow'});return}
 if(!s.over)return;g.fillStyle='#251d17';g.fillRect(0,-100,460,1100);const title={repaired:'A useful afternoon',late:'Repaired. Promise missed.',broken:'The coupling broke',unfinished:'Work left unfinished',unrepaired:'Repairs unfinished'}[s.over];text(title,230,310,30);if(s.delivered)text(s.delivered==='bell'?'A bell ringing at home.':'A lamp glowing at home.',230,375,23);else text(s.bell.gone?'Bell returned unrepaired.':'Closing time.',230,375,23);text('Again?',230,495,26);spot('again',230,495,75,{type:'again'});
}
function draw(){spots=[];background();g.save();if(shake){g.translate(Math.sin(now*85)*shake,Math.cos(now*73)*shake);shake*=.9}({cart,bell,lamp}[s.active])();g.restore();controls();operationMotion();
 for(const p of particles){p.x+=p.vx/60;p.y+=p.vy/60;p.vy+=3;p.life-=1/60;g.globalAlpha=Math.max(0,p.life);circle(p.x,p.y,3,p.color)}particles=particles.filter(p=>p.life>0);g.globalAlpha=1;
 if(drag&&pointer){// The carried part rides above the finger so the finger does not hide it.
  const x=drag.moved?pointer.x:drag.x,y=drag.moved?pointer.y-54:drag.y;shadow(x,y+22,25,7);if(drag.part==='pin')pin(x,y,false,-.12);if(drag.part==='spacer')spacer(x,y);if(drag.part==='coupling')coupling(x,y,-.1)}overlay();g.restore()}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-ox)/scale,y:(e.clientY-r.top-oy)/scale}}
function hit(p){for(let i=spots.length-1;i>=0;i--){const q=spots[i];if(Math.hypot(q.x-p.x,q.y-p.y)<=q.r)return q}return null}
function handle(q){if(!q)return;if(s.over&&q.id!=='again')return;if(paused&&!['resume','slow'].includes(q.id))return;
 const a=q.action;if(a.type==='slow'){slow=!slow;return}if(a.type==='pause'){paused=!paused;acc=0;return}if(a.type==='again'){s=create(++seed);paused=false;acc=0;return}
 if(a.type==='select'){s.selected=s.selected===a.part?null:a.part;s.tool=null;sound('turn');return}
 if(s.selected&&q.destination){const part=s.selected;if(part==='pin'&&q.destination==='pin'||part==='coupling'&&q.destination==='coupling'||part==='spacer'&&['base','striker'].includes(q.destination)){command({type:'fit',part,target:q.destination});return}return}
 command(a);
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();unlock();keyboard=false;canvas.focus();touched=now;if(intro){intro=false;pointer=null;drag=null;return}pointer=point(e);const q=hit(pointer);canvas.setPointerCapture(e.pointerId);pointer.down=pointer;pointer.target=q;if(q?.draggable){drag={part:q.action.part|| (q.id.includes('spacer')?'spacer':q.id.includes('axle')?'pin':'coupling'),x:q.x,y:q.y,source:q,moved:false}}});
canvas.addEventListener('pointermove',e=>{const p=point(e);hover=hit(p)?.id||null;if(pointer){p.down=pointer.down;p.target=pointer.target;pointer=p;if(drag&&Math.hypot(p.x-p.down.x,p.y-p.down.y)>12)drag.moved=true}});
canvas.addEventListener('pointerup',e=>{unlock();const p=point(e);if(drag?.moved){const q=[hit({x:p.x,y:p.y-54}),hit(p)].find(q=>q?.destination);if(drag.source.action.type==='select'){if(q?.destination)command({type:'fit',part:drag.part,target:q.destination});else s.selected=drag.part}else if(p.y>640){command(drag.source.action)}else if(drag.source.id==='lamp-coupling'&&Math.abs(p.x-pointer.down.x)>45){command({type:'rotate'})}}
 else handle(pointer?.target);pointer=null;drag=null});
canvas.addEventListener('pointercancel',()=>{pointer=null;drag=null});
addEventListener('keydown',e=>{if(['Tab',' ','Enter','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();unlock();keyboard=true;touched=now;if(intro){intro=false;return}
 if(e.key==='Escape'){paused=!paused;acc=0;return}if(e.key==='Tab'||e.key.startsWith('Arrow')){focus=(focus+(e.shiftKey||['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+spots.length)%spots.length;return}if(e.key==='Enter'||e.key===' '){handle(spots[focus]);return}if(paused||s.over)return;
 const map={'1':{type:'switch',object:'cart'},'2':{type:'switch',object:'bell'},'3':{type:'switch',object:'lamp'},o:{type:'open'},p:{type:'tool',tool:'pliers'},w:{type:'tool',tool:'wrench'},r:{type:'rotate'},t:{type:'test'}};if(map[e.key.toLowerCase()])command(map[e.key.toLowerCase()]);
});
addEventListener('blur',()=>{if(s.started&&!s.over)paused=true;acc=0});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&s.started&&!s.over)paused=true;acc=0});
function frame(ms){now=ms/1000;const elapsed=last?Math.min(.1,(ms-last)/1000):0;last=ms;// With nothing left to do before Aylin returns, the clock runs fast until the player touches the bench again.
 waiting=!paused&&s.started&&!s.over&&!s.operation&&(s.departed||!s.arrival&&s.cart.fixed&&(s.bell.fixed||s.lamp.fixed||s.broken))&&now-touched>4;
 if(!paused&&s.started&&!s.over){acc+=elapsed*(waiting?8:slow?.75:1);while(acc>=DT){step(s);emit();acc-=DT}}draw();requestAnimationFrame(frame)}
// Read by the follow-the-ring browser check.
if(typeof window!=='undefined')window.copperState=()=>({hint:spots.find(q=>q.id===hintSpot)||null,intro,active:s.active,cart:s.cart.fixed,bell:s.bell.fixed,lamp:s.lamp.fixed,broken:s.broken,over:s.over,t:s.t,scale,ox,oy});
requestAnimationFrame(frame);
