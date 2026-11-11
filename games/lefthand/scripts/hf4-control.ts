import { writeFileSync } from "node:fs";
import { createGame, step, exportRun, replayRun, hash, type Command } from "../src/host.ts";
import { verifyArchive } from "../src/actors.ts";
import { shortestPath } from "./policies.ts";

const state=createGame(13);
const timings:number[]=[];
const commands:Record<string,number[]>={};
function tick(command?:Command) {
  const start=performance.now(); step(state,command); const elapsed=performance.now()-start;timings.push(elapsed);(commands[command?.type ?? "idle"]??=[]).push(elapsed);
  if(state.recoveryPending) tick({type:"recover",choice:"keepquiet"});
}
function walk(target:{x:number;y:number}) {
  for(let budget=0;budget<100 && Math.abs(state.player.x-target.x)+Math.abs(state.player.y-target.y)>1;budget++) {
    const next=shortestPath(state,target)[0]; if(!next) throw Error("No route"); tick(next);
    for(let pause=0;pause<9;pause++) tick();
  }
}
for(let night=1;night<=3;night++) {
  tick({type:"plan",route:"well"}); tick({type:"lantern"});
  walk({x:4,y:7}); tick({type:"act"});
  while(!state.deliveredTonight) tick();
  walk({x:7,y:15}); tick({type:"act"}); tick({type:"next"});
}
if(state.phase !== "ended" || state.delivered !== 3) throw Error("Incomplete control");
const startExport=performance.now(); const run=exportRun(state); const json=JSON.stringify(run); const exportMs=performance.now()-startExport;
const startReplay=performance.now(); const verified=replayRun(JSON.parse(json)); const replayMs=performance.now()-startReplay;
if(hash(verified)!==hash(state)) throw Error("Game replay mismatch");
const hf=verifyArchive(run.state.actorsRun);
const sorted=timings.toSorted((a,b)=>a-b);
const report={engine:state.engine,ticks:state.tick,delivered:state.delivered,ending:state.ending,commands:Object.fromEntries(Object.entries(commands).map(([key,values])=>[key,{count:values.length,max:Math.max(...values),p95:values.toSorted((a,b)=>a-b)[Math.floor(values.length*.95)]}])),tickMs:{p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)},exportBytes:Buffer.byteLength(json),exportMs,replayMs,fullHash:run.finalHash,hfHash:hf.fullHash,replayVerified:hf.verified};
console.log(JSON.stringify(report,null,2));
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+"\n");

if (process.argv[3]) writeFileSync(process.argv[3], json + "\n");
