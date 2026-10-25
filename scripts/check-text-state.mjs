// Run with TEXT_STATE_ROOT pointing to the untouched checkout for the before capture.
// Prose paths are explicit. Only witnessed copies of game evidence prose are blanked in HF.
// Cues, IDs, inputs, all other HF fields and numbers remain exact.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const root = resolve(process.env.TEXT_STATE_ROOT || '.');
const output = resolve(process.argv[2] || '/tmp/repair-text-state');
mkdirSync(output, { recursive: true });
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
const engine = await server.ssrLoadModule('/src/game/engine.ts');
const { saveGame } = await server.ssrLoadModule('/src/game/persistence.ts');
const { replayRecordedRun } = await server.ssrLoadModule('/src/game/replay.ts');
const prosePaths = [
  /^log\.\d+\.text$/,
  /^jobs\.\d+\.(title|description|importance|quote)$/,
  /^jobs\.\d+\.model\.components\.\d+\.label$/,
  /^jobs\.\d+\.evidence\.\d+\.summary$/,
  /^jobs\.\d+\.pendingLessons\.\d+\.baseline\.summary$/,
  /^jobs\.\d+\.blocked\.reason$/,
  /^npcWork\.\d+\.option\.label$/,
  /^community\.outcome$/,
  /^community\.decisions\.\d+\.(activityLabel|speech)$/,
];
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function normalize(value, path = '') {
  // The new text edition refuses old mixed-prose saves. This is provenance, not a rule.
  if (path === 'provenance.game' && ['4.0.0', '4.0.0+plain-english', '4.0.0+plain-english-2'].includes(value)) return '4.0.0';
  if (typeof value === 'string' && prosePaths.some(re => re.test(path))) return '';
  if (Array.isArray(value)) return value.map((v, i) => normalize(v, path ? `${path}.${i}` : `${i}`));
  if (value && typeof value === 'object') {
    // perceiveEvidence copies player-visible observations into witnessed episodes.
    // Preserve episode identity, action, targets, salience, tags and all other memories.
    const copiedEvidence = /^people\.[^.]+\.memory\.episodes\.\d+$/.test(path)
      && value.kind === 'witnessed' && /^repair-observation:(inspection|measurement|work|use)$/.test(value.action ?? '');
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, copiedEvidence && k === 'summary' ? '' : normalize(v, path ? `${path}.${k}` : k)]));
  }
  return value;
}
const lines = new Set();
const outcomes = [];
try {
  for (const seed of [7, 42, 1001]) for (const policy of ['repair', 'explore', 'mentor']) {
    let state = engine.createGame(seed);
    const steps = [];
    const collect = () => {
      for (const l of state.log) lines.add(l.text);
      for (const j of state.jobs) {
        lines.add(j.description); lines.add(j.importance);
        for (const e of j.evidence) lines.add(e.summary);
      }
    };
    const act = command => {
      const result = engine.dispatch(state, command);
      state = result.state; collect();
      steps.push({command, ok:result.ok, state:sha(normalize(state)), people:sha(normalize(state.people, 'people'))});
    };
    collect();
    for (let day = 0; day < 7; day++) {
      if (policy === 'mentor') {
        act({type:'request-lesson'});
        const pendingWork = state.npcWork.find(w => w.personId === 'sam');
        if (state.pendingRequest?.status === 'requested' && pendingWork) act({type:'wait',minutes:pendingWork.endsAt-state.now});
        act({type:'start-lesson'});
      }
      const jobs = state.jobs.filter(j => ['offer','active','ready'].includes(j.status) && !j.isDonor);
      for (const job of jobs.slice(0, 3)) {
        if (job.status === 'offer') act({type:'accept',jobId:job.id});
        act({type:'power',jobId:job.id,on:true});
        for (const c of job.model.components.slice(0, policy === 'explore' ? 4 : 2)) {
          act({type:'inspect',jobId:job.id,componentId:c.id});
          act({type:'measure',jobId:job.id,request:{mode:job.kind==='music-box'?'motion':'voltage',a:c.terminals[0],b:c.terminals[1],condition:'movement'}});
          act({type:'work',jobId:job.id,componentId:c.id,intervention:policy==='repair'?'replace':'clean'});
        }
        if (job.kind === 'music-box') act({type:'calibrate',jobId:job.id,componentId:'governor',setting:2});
        for (const condition of ['bench','movement','load']) act({type:'verify',jobId:job.id,condition});
        if (policy === 'mentor') { act({type:'watch',enabled:false}); act({type:'assign',jobId:job.id,personId:'sam'}); act({type:'wait',minutes:30}); }
        else act({type:'deliver',jobId:job.id,unfinished:policy==='explore'});
      }
      if (day===3) { act({type:'wait-for-site'}); act({type:'prepare-event',format:'garden'}); act({type:'wait',minutes:90}); }
      act({type:'next-day'});
    }
    const saved = saveGame(state);
    writeFileSync(`${output}/${seed}-${policy}.save.json`, saved);
    const replay = replayRecordedRun({seed,inputs:state.inputs,provenance:state.provenance,openingPeople:state.openingPeople,castChapter:state.castChapter},saved);
    if (!replay.ok) throw Error(`Current export did not replay: ${seed}/${policy}: ${replay.message}`);
    const summary = {seed,policy,day:state.day,ended:state.ended,steps:steps.length,accepted:steps.filter(x=>x.ok).length,state:sha(normalize(state)),people:sha(normalize(state.people, 'people')),replay:true,trace:sha(steps)};
    outcomes.push(summary);
    writeFileSync(`${output}/${seed}-${policy}.json`,JSON.stringify({summary,steps,final:normalize(state)},null,2));
    console.log(JSON.stringify(summary));
  }
  writeFileSync(`${output}/summary.json`,JSON.stringify(outcomes,null,2));
  writeFileSync(`${output}/lines.txt`,[...lines].filter(Boolean).join('\n'));
  if (process.argv[3]) assert.deepEqual(outcomes, JSON.parse(readFileSync(process.argv[3], 'utf8')), 'Text-only changes must preserve every state and HF person hash after named prose normalization');
} finally { await server.close(); }
