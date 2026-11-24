export const KINDS = ['bread','water','home','family','friend','health','heart','rain','rest','moon','work','hands','tree','light','sun','spark'];
export const LOOKS = ['sky','lamps','garden'];
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDay(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T12:00:00`); return Number.isFinite(+d) && localDay(d) === s; }
export function load(raw) { const s = {v:1,days:{},look:'garden',sound:true}; if (!raw || raw.v !== 1) return s; if (LOOKS.includes(raw.look)) s.look=raw.look; if (typeof raw.sound === 'boolean') s.sound=raw.sound; if (raw.days && typeof raw.days==='object' && !Array.isArray(raw.days)) for (const [day,items] of Object.entries(raw.days)) { if (!validDay(day)||!Array.isArray(items)) continue; const clean=items.filter(x=>x && KINDS.includes(x.k)).slice(0,3).map(x=>({k:x.k,...(x.k==='spark' && typeof x.t==='string' && x.t.trim()?{t:Array.from(x.t.trim()).slice(0,24).join('')}:{})})); if(clean.length)s.days[day]=clean; } return s; }
export const count = (s,day) => s.days[day]?.length || 0;
export const canAdd = (s,day) => validDay(day) && count(s,day)<3;
export function addStar(s,day,k,t='') { t=typeof t==='string'?t:''; if(!canAdd(s,day)||!KINDS.includes(k))return false; (s.days[day] ||= []).push({k,...(k==='spark'&&t.trim()?{t:Array.from(t.trim()).slice(0,24).join('')}:{})}); return true; }
export function counts(s) { const days=Object.values(s.days); return {days:days.length,lights:days.reduce((n,a)=>n+a.length,0),complete:days.filter(a=>a.length===3).length}; }
export const celebration = s => counts(s).complete>0 && counts(s).complete%7===0;
function hash(s) { let h=2166136261; for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619); return (h>>>0)/4294967296; }
export function position(day,index) { return {x:0.5+(index-1)*0.22+(hash(day+'x'+index)-0.5)*0.08,y:0.28+hash(day+'y'+index)*0.28,size:5+hash(day+'s'+index)*3,hue:35+hash(day+'h'+index)*35}; }
export function demo(today,n) { const s=load(null); for(let i=Math.min(2000,Math.max(0,Math.floor(n)));i>0;i--) { const d=new Date(`${today}T12:00:00`); d.setDate(d.getDate()-i); const day=localDay(d); for(let j=0;j<3;j++)addStar(s,day,KINDS[(Math.floor(hash(day)*997)+j*5+Math.floor(hash(j+'kind'+day)*4))%KINDS.length]); } return s; }

// The field: every day that has a light gets a place, counted from the first day (index 0).
// Places never move once given, so the sky looks the same on every visit. A missed day takes no place.
// Odd columns sit half a row lower, so the days do not line up in rows.
// Units: x in columns (the page multiplies by a column width), y from 0 to 1 down the band of sky.
export const ROWS = 5;
const ORDER = [[2,0,4,1,3],[1,3,0,4,2],[3,1,4,0,2],[0,2,4,1,3],[4,1,3,0,2],[2,4,1,3,0]];
export function place(i) { const col=Math.floor(i/ROWS), row=ORDER[col%ORDER.length][i%ROWS]; return {col,row,x:col+0.5+(hash('px'+i)-0.5)*0.45,y:0.05+(row+0.5+(col%2?0.5:0))/(ROWS+0.5)*0.9+(hash('py'+i)-0.5)*0.03}; }
// The three lights of a day sit round the day's place. Offsets are in units of the cluster radius.
export function member(day,index) { const a=hash(day+'a')*Math.PI*2+index*Math.PI*2/3+(hash(day+'j'+index)-0.5)*0.7, r=0.62+hash(day+'r'+index)*0.38; return {dx:Math.cos(a)*r,dy:Math.sin(a)*r*0.8,size:0.75+hash(day+'s'+index)*0.5,hue:hash(day+'h'+index),phase:hash(day+'p'+index)*6.283}; }
