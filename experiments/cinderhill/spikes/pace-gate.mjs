// The pace gate (R0; docs/design/colony/02-spec.md section 3.1, 04-roadmap.md R0). Three scripted players play the
// colony game on 20 seeds through host.js, watched by replay-lab's Observer (the same counts a lab record's replay
// gives), and each line of the pace budget is read from what they did.
//   median:  every 15 s a trail from the entrance to the nearest pile of the food the colony has less of in store
//            (skipped when a live trail already ends there; the sim keeps four trails and reuses the oldest), Recall
//            on at the spider's warning and off when it leaves, on at every dusk card. It leaves crew sizes alone, so each trail keeps its Steady crew (the default).
//   passive: one trail at 1 s to the nearest pile, then no order.
//   idle:    no order.
// A line is read on the worst seed: "every line passes for the scripted bots on 20 seeds" (02 section 0).
// Lines the current build cannot measure (chapters, doors, choices) are "not measured", never "pass".
//
// Staging (02 section 3.1, "Which lines block what", round 4): a line blocks only from the stage named in its
// `stage`; STAGE is where the build is. Every other line is read and reported, never silently skipped. For the
// blocking lines CI keeps a ratchet (pace-baseline.json): a line that passes must keep passing; a line that fails may
// not get worse than its recorded value by more than a tenth, or stop happening; a line that starts to pass fails the
// gate until --update records it, so progress is kept. The old quota opening and a planted slow-down (every brood
// stage ten times as long) must each fail a blocking line.
//
// Usage: node spikes/pace-gate.mjs [--seeds=20] [--minutes=12] [--update] [--json=out.json] [--quiet]
//        node spikes/pace-gate.mjs --records <lab record files...>   (people lines from lab records, no gate)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Host } from '../host.js';
import { CMD, FOOD, G, SURFACE } from '../sim/sim.js';
import { C, DAY_GOALS, GOAL_KIND, START } from '../sim/colony.js';
import { SPIDER } from '../sim/spider.js';
import { Observer, parts, replayChain } from './replay-lab.mjs';
import { PATH_MAX } from '../sim/flow.js';

const HZ = 20;
const BASELINE = new URL('./pace-baseline.json', import.meta.url);

/** Where the build is on the roadmap, and the order of the stages lines block from. */
export const STAGES = ['R0', 'R1.2', 'R1.3', 'R1.3b', 'R1.5', 'R1', 'R2a', 'R2b'];
export const STAGE = 'R1.3';
export const blocks = (line, stage = STAGE) => STAGES.indexOf(line.stage) <= STAGES.indexOf(stage);
/** At R0 the roadmap says the build fails the gate: a failing blocking line is allowed by its baseline and may not
 *  get worse. From R1 step 2 (new starting values) every blocking line must pass. */
export const strict = (stage = STAGE) => stage !== 'R0';

/** The pace budget lines the bots read. `get` returns a number (seconds, a count or a share) or null. `ok` says
 *  whether a value meets the target; `up`: a bigger value is worse. `horizon`: seconds of play the line needs.
 *  `stage`: from where it blocks a pull request. A line with no `ok` cannot be measured in this build. */
export const LINES = [
  { id: 'first-delivery', stage: 'R0', horizon: 60, text: 'First delivery from the first trail, s', target: '<= 10', bot: 'median', get: r => r.firstDelivery, ok: v => v <= 10, up: true },
  { id: 'first-delivery-passive', stage: 'R0', horizon: 60, text: 'First delivery from the passive bot\'s trail, s', target: '<= 10', bot: 'passive', get: r => r.firstDelivery, ok: v => v <= 10, up: true },
  { id: 'minute-1-deliveries', stage: 'R0', horizon: 60, text: 'Deliveries in minute 1', target: '>= 25', bot: 'median', get: r => r.minute1, ok: v => v >= 25, up: false },
  { id: 'first-birth', stage: 'R0', horizon: 60, text: 'First birth, s', target: '<= 15', bot: 'median', get: r => r.firstBirth, ok: v => v <= 15, up: true },
  { id: 'first-funded-birth', stage: 'R1', horizon: 120, text: 'First birth beyond what the starting brood and protein fund, after a protein load home by trail (stands in for the first player-funded birth), s', target: '<= 90', bot: 'median', get: r => r.fundedBirth, ok: v => v <= 90, up: true },
  { id: 'quiet-2-min', stage: 'R1', horizon: 120, text: 'Longest stretch of the first 2 min with no delivery, birth, new source or threat change, s', target: '<= 15', bot: 'median', get: r => r.quiet, ok: v => v <= 15, up: true },
  { id: 'first-choice', stage: 'R1.5', text: 'First real choice, s', target: '<= 30', bot: 'median', get: () => null },
  { id: 'choice-consequence', stage: 'R1.5', text: 'Its consequence visible, s', target: '<= 60', bot: 'median', get: () => null },
  { id: 'consequential-choices', stage: 'R1.5', text: 'Orders that change dusk by 5% in a paired replay, per chapter', target: '>= 4', bot: 'median', get: () => null },
  // The threat lines read the spider, which comes only with days (sim 8's colony game has none); the bird of R1 step 5
  // replaces it. Not built until then.
  { id: 'threat-telegraphed', stage: 'R1.5', text: 'First threat telegraphed, s', target: '<= 60', bot: 'median', get: () => null },
  { id: 'threat-resolved', stage: 'R1.5', text: 'First threat resolved, s', target: '<= 180', bot: 'median', get: () => null },
  { id: 'gap-0-10', stage: 'R1', horizon: 600, text: 'Longest gap between decision events, minutes 0 to 10, s', target: '<= 30', bot: 'median', get: r => r.gapEarly, ok: v => v <= 30, up: true },
  { id: 'gap-after-10', stage: 'R1', horizon: 720, text: 'Same gap after minute 10, s', target: '<= 45', bot: 'median', get: r => r.gapLate, ok: v => v <= 45, up: true },
  { id: 'idle-share', stage: 'R1.3', horizon: 720, text: 'Wasted labour: largest share of adults idle 10 s while a job has a gap', target: '<= 0.15', bot: 'median', get: r => r.idleMax, ok: v => v <= 0.15, up: true },
  { id: 'queued-at-doors', stage: 'R1.3b', text: 'Queued at doors outside a jam', target: '<= 0.10', bot: 'median', get: () => null },
  { id: 'chapter-1-length', stage: 'R1', text: 'Chapter 1 length, min', target: '4 to 6', bot: 'median', get: () => null },
  { id: 'passive-finishes', stage: 'R1', text: 'Passive bot finishes chapter 1', target: 'yes', bot: 'passive', get: () => null },
  { id: 'chapters-2-6-length', stage: 'R2a', text: 'Chapters 2 to 6 length, min', target: '6 to 12', bot: 'median', get: () => null },
  // Read from people and pages, not bots: --records reports first order; the others need tools not built yet.
  { id: 'input-ready', stage: 'R1', text: 'Input ready after the page opens, s (mid-range phone)', target: '<= 3', bot: 'page', get: () => null },
  { id: 'first-order-people', stage: 'R1', text: 'First order within 10 s, share of sessions (lab records, --records)', target: '>= 0.8', bot: 'people', get: () => null },
  { id: 'chapter-1-length-people', stage: 'R1', text: 'Chapter 1 length, human median, min', target: '<= 8', bot: 'people', get: () => null },
  { id: 'idle-loses', stage: 'R2a', text: 'Idle bot loses chapter 2 or 3', target: 'yes', bot: 'idle', get: () => null },
];

function nearest(sim, kind) {
  const L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1;
  let best = null;
  for (let p = 0; p < sim.pileCell.length; p++) {
    const c = sim.pileCell[p];
    if (c < 0 || sim.pileAmount[p] <= 0 || (kind >= 0 && sim.pileKind[p] !== kind)) continue;
    const x = c % L.sw, y = Math.floor(c / L.sw), d = Math.max(Math.abs(x - ex), Math.abs(y - ey));
    if (!best || d < best.d) best = { p, c, x, y, d };
  }
  return best;
}

/** A live trail ends within 2 cells of cell c. */
function trailTo(sim, c) {
  const F = sim.flow, w = sim.L.sw;
  for (let k = 0; k < 4; k++) {
    const s = 4 + k; if (!F.live[s]) continue;
    const len = Math.min(F.pathLen[k], PATH_MAX); if (len < 1) continue;
    const e = F.path[k * PATH_MAX + len - 1];
    if (Math.abs(e % w - c % w) <= 2 && Math.abs(Math.floor(e / w) - Math.floor(c / w)) <= 2) return true;
  }
  return false;
}

/** Fixtures (fault injection, no sim change): set on the exported start values for one game, then put back.
 *  - quota: the old quota opening of 02 section 3.1: 20 workers, 40 sugar, 4 larvae and no pupae, a 40-load first
 *    day of 10 minutes. It must fail a line the current build passes.
 *  - brood10: every brood stage ten times as long (the roadmap's planted slow-down). It must fail the gate. */
export function withFixture(fixture, fn) {
  if (!fixture) return fn({});
  const keep = { start: { ...START }, goal: DAY_GOALS[0].slice(), c: { ...C } };
  try {
    if (fixture === 'quota') { Object.assign(START, { ants: 20, surface: 20, sugar: 40, protein: 0, eggs: 0, larvae: 4, pupae: 0 }); DAY_GOALS[0] = [GOAL_KIND.TRAIL_LOADS, 40]; return fn({ dayTicks: 12000 }); }
    if (fixture === 'brood10') { for (const k of ['EGG_TICKS', 'LARVA_TICKS', 'LARVA_STARVE', 'PUPA_TICKS']) C[k] *= 10; return fn({}); }
    throw new Error(`no fixture ${fixture}`);
  } finally { Object.assign(START, keep.start); DAY_GOALS[0] = keep.goal; Object.assign(C, keep.c); }
}

/** One bot game: the lines' raw values. */
export function play(bot, seed, { minutes = 12, fixture = null } = {}) {
  return withFixture(fixture, opts => {
  const host = new Host(0, seed, { colony: true, ...opts }), sim = host.sim, L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1;
  const obs = new Observer(host), ticks = Math.round(minutes * 60 * HZ);
  const order = o => obs.order(o, host.order(o));
  const trail = pile => order({ type: CMD.TRAIL, layer: SURFACE, points: [ex + 1, ey + 1, pile.x, pile.y] });
  let recall = false, spider = 0;
  while (obs.steps < ticks) {
    const t = obs.steps;
    if (bot === 'median') {
      if (t % (15 * HZ) === HZ) {
        const kind = sim.g[G.SUGAR] <= sim.g[G.PROTEIN] ? FOOD.SUGAR : FOOD.PROTEIN;
        const pile = nearest(sim, kind) ?? nearest(sim, -1);
        if (pile && !trailTo(sim, pile.c)) trail(pile);
      }
      const sp = sim.g[G.SP];
      if (sp !== spider) { if (sp === SPIDER.WARN && !recall) { order({ type: CMD.RECALL, on: true }); recall = true; } else if (sp === SPIDER.NONE && recall) { order({ type: CMD.RECALL, on: false }); recall = false; } spider = sp; }
    } else if (bot === 'passive' && t === HZ) { const pile = nearest(sim, -1); if (pile) trail(pile); }
    obs.before(); host.step(); obs.after();
    if (host.dusk) host.goOn();
  }
  obs.finish();
  return measure(obs.stats(), ticks);
  });
}

/** The lines' raw values from Observer stats (a bot game or a replayed lab record). */
/** The quiet-stretch line (round 4): the longest stretch of the first 2 min with no delivery, birth, new source
 *  or threat change. No structures are built yet. */
function quiet(st) {
  const end = 2 * 60 * HZ, ts = [0, end, ...st.deliveries, ...st.births, ...st.decisions.filter(d => /source seen|new source|threat/.test(d.what)).map(d => d.step)].filter(t => t <= end).sort((a, b) => a - b);
  let g = 0; for (let k = 1; k < ts.length; k++) g = Math.max(g, ts[k] - ts[k - 1]);
  return g / HZ;
}

export function measure(st, ticks = st.steps) {
  const first = st.trails.find(t => t.state === 'applied');
  // Decision events are the kinds 02 section 3.1 lists (a threat arriving or leaving offers no new choice).
  const decisions = st.decisions.filter(d => !/arrived|resolved/.test(d.what)).map(d => d.step).sort((a, b) => a - b);
  const gap = (from, to) => { const ts = [from, ...decisions.filter(s => s > from && s < to), to]; let g = 0; for (let k = 1; k < ts.length; k++) g = Math.max(g, ts[k] - ts[k - 1]); return g / HZ; };
  const ten = 10 * 60 * HZ;
  const at = what => { const d = st.decisions.find(x => x.what === what); return d ? d.step / HZ : null; };
  return {
    trailDrawn: !!first, firstDelivery: first && first.first >= 0 ? first.first / HZ : null,
    minute1: st.minutes[0] ? st.minutes[0].sugar + st.minutes[0].protein : null,
    firstBirth: st.births.length ? st.births[0] / HZ : null,
    // The first birth after the starting pupae that comes after a protein load home by a drawn trail.
    fundedBirth: (() => { if (st.firstTrailProtein < 0) return null; const b = st.births.slice(START.pupae + START.protein).find(t => t > st.firstTrailProtein); return b === undefined ? null : b / HZ; })(),
    threat: at('threat telegraphed'), resolved: at('threat resolved'),
    gapEarly: gap(0, Math.min(ticks, ten)), gapLate: ticks > ten + 60 * HZ ? gap(ten, ticks) : null,
    idleMax: Math.round(st.idleMax * 1000) / 1000,
    firstOrder: st.firstOrder >= 0 ? st.firstOrder / HZ : null,
    quiet: ticks >= 2 * 60 * HZ ? quiet(st) : null,
  };
}

/** Games run in worker threads, one per core (a 12-minute game is about 20 s of one core). */
export async function runAll(jobs, threads = Math.max(1, Math.min(availableParallelism() - 1, jobs.length))) {
  const out = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: threads }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { worker: true } });
    const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } const k = next++; w.postMessage({ k, job: jobs[k] }); };
    w.on('message', ({ k, r }) => { out[k] = r; feed(); }); w.on('error', reject); feed();
  })));
  return out;
}
if (!isMainThread && workerData?.worker) parentPort.on('message', ({ k, job }) => parentPort.postMessage({ k, r: play(job.bot, job.seed, job) }));

/** How long each bot plays: the passive bot only needs its first delivery; the idle bot has no line the current build
 *  can measure (chapters), so it does not play. */
const BOT_MINUTES = { median: m => m, passive: m => Math.min(m, 1), idle: () => 0 };

/** Every line on `seeds` seeds: { id: { value (worst seed, or null), status, seeds: [...] } }. Only lines whose
 *  horizon (seconds) fits in the run are read; a measured line with no value on some seed (it never happened) fails. */
export async function gate({ seeds = 20, minutes = 12, fixture = null } = {}) {
  const jobs = [];
  for (const bot of Object.keys(BOT_MINUTES)) { const m = BOT_MINUTES[bot](minutes); if (m > 0) for (let s = 1; s <= seeds; s++) jobs.push({ bot, seed: s, minutes: m, fixture }); }
  const results = await runAll(jobs), runs = { median: [], passive: [], idle: [], people: [], page: [] };
  jobs.forEach((j, k) => runs[j.bot].push(results[k]));
  const out = {};
  for (const line of LINES) {
    const vals = runs[line.bot].map(r => line.get(r));
    if (!line.ok || !runs[line.bot].length) { out[line.id] = { value: null, status: 'not built', seeds: vals }; continue; }
    if (line.horizon > minutes * 60) { out[line.id] = { value: null, status: 'not read', seeds: vals }; continue; } // the run is too short
    const missing = vals.some(v => v === null);
    const worst = missing ? null : vals.reduce((a, b) => (line.up ? Math.max(a, b) : Math.min(a, b)));
    out[line.id] = { value: worst, status: !missing && line.ok(worst) ? 'pass' : 'fail', seeds: vals };
  }
  return out;
}

/** Compare the blocking lines with the baseline. Returns a list of problems (empty: the gate holds). */
/** The recorded baseline against the base commit's: on a blocking line a pass may not become a fail and a value may
 *  not get worse by more than a twentieth, unless the recorded line carries a new `accepted` reason and still passes.
 *  Improvements are fine. */
export function slack(now, old, stage = STAGE) {
  const out = [];
  for (const l of LINES) {
    if (!blocks(l, stage) || !old[l.id] || old[l.id].value == null) continue;
    const a = now[l.id], b = old[l.id];
    if (!a || a.value == null) { out.push(`${l.id} was ${b.value}, no value now`); continue; }
    // A step that changes the game on purpose may record a passing line worse, with its reason in the baseline
    // (`accepted`), where review sees it. The next pull request compares against the new value as usual.
    // The reason is a string, new on this branch, and the recorded value still meets the target.
    if (typeof a.accepted === 'string' && a.accepted && a.accepted !== b.accepted && l.ok?.(a.value)) continue;
    if (b.status === 'pass' && a.status !== 'pass') out.push(`${l.id} passed at the base (${b.value}) and is recorded as ${a.status} (${a.value})`);
    else if (l.up ? a.value > b.value * 1.05 + 0.25 : a.value < b.value * 0.95 - 0.25) out.push(`${l.id} recorded worse than at the base: ${a.value} against ${b.value}`);
  }
  return out;
}

export function ratchet(now, base, lines = LINES.filter(l => blocks(l)), hard = strict()) {
  const bad = [];
  for (const line of lines) {
    const n = now[line.id], b = base[line.id];
    if (hard && n.status !== 'pass') { bad.push(`${line.id}: ${n.status} (${n.value} against ${line.target}); it blocks from ${line.stage}`); continue; }
    if (!b) { bad.push(`${line.id}: not in the baseline (run with --update)`); continue; }
    if (n.status === 'not read' || n.status === 'not built') { bad.push(`${line.id}: blocks from ${line.stage} but was ${n.status} in this run`); continue; }
    if (b.status === 'pass' && n.status !== 'pass') bad.push(`${line.id}: passed before, ${n.status} now (${n.value} against ${line.target})`);
    else if (b.status !== 'pass' && n.status === 'pass') bad.push(`${line.id}: passes now (${n.value}): record it with --update`);
    else if (b.status === 'fail' && n.status === 'fail') {
      if (n.value === null && b.value !== null) bad.push(`${line.id}: now never happens on some seed (was ${b.value})`);
      else if (n.value !== null && b.value !== null && (line.up ? n.value > b.value * 1.05 + 0.25 : n.value < b.value * 0.95 - 0.25)) bad.push(`${line.id}: worse, ${n.value} (baseline ${b.value}, target ${line.target}; allowed: a twentieth)`);
    }
  }
  return bad;
}

export function table(res) {
  const L = ['| Line | Target | Worst seed | Status | Blocks from |', '| --- | --- | --- | --- | --- |'];
  for (const line of LINES) { const r = res[line.id]; L.push(`| ${line.text} (${line.bot} bot) | ${line.target} | ${r.value ?? '-'} | ${r.status} | ${line.stage}${blocks(line) ? ' (blocks now)' : ''} |`); }
  return L.join('\n');
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k, d) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
  if (args.includes('--records')) {
    // People lines from lab records: first order and first delivery from the first trail, per session.
    const files = args.filter(a => !a.startsWith('--'));
    const rows = parts(files.map(f => JSON.parse(readFileSync(f, 'utf8')))).map(chain => { const r = replayChain(chain); return { chain: chain[0].start.chain, ok: r.ok, ...measure(r.stats) }; });
    const fo = rows.map(r => r.firstOrder), within = fo.filter(v => v !== null && v <= 10).length;
    const off = rows.filter(r => !r.ok).length; if (off) console.log(`${off} of ${rows.length} sessions did not replay to their hashes (another sim version?): their delivery times are not the session's`);
    console.log(`${rows.length} sessions; first order within 10 s: ${within} of ${rows.length} (target 80%; sim seconds, so a session played at 2x or 4x reads later than it was)`);
    // Sessions that replayed to their hashes and drew a trail; a trail that never delivered counts as never.
    const fd = rows.filter(r => r.ok && r.trailDrawn).map(r => r.firstDelivery ?? Infinity).sort((a, b) => a - b);
    console.log(`first delivery from the first trail: median ${fd.length ? (fd[(fd.length - 1) >> 1] === Infinity ? 'never' : fd[(fd.length - 1) >> 1]) : '-'} s over ${fd.length} replayed sessions with a trail, ${fd.filter(v => v === Infinity).length} never delivered (target <= 10 s)`);
    if (opt('json')) writeFileSync(opt('json'), JSON.stringify(rows, null, 1));
  } else {
    const seeds = Number(opt('seeds', 20)), minutes = Number(opt('minutes', 12)), t0 = Date.now();
    const res = await gate({ seeds, minutes });
    // The fixtures play 3 minutes on 5 seeds, and only lines that fit in 3 minutes are read.
    const short = { seeds: Math.min(seeds, 5), minutes: Math.min(minutes, 3) };
    const quota = await gate({ ...short, fixture: 'quota' }), brood = await gate({ ...short, fixture: 'brood10' });
    if (!args.includes('--quiet')) console.log(table(res));
    const block = LINES.filter(l => blocks(l));
    const quotaFails = block.filter(l => res[l.id].status === 'pass' && quota[l.id].status === 'fail').map(l => l.id);
    console.log(`\nStage ${STAGE}: blocking lines ${block.map(l => l.id).join(', ')}.`);
    console.log(`Quota opening fails: ${quotaFails.join(', ') || 'no blocking line the current build passes'}.`);
    if (opt('json')) writeFileSync(opt('json'), JSON.stringify({ seeds, minutes, res, quota, brood }, null, 1));
    if (args.includes('--update')) {
      const old = (() => { try { return JSON.parse(readFileSync(BASELINE, 'utf8')); } catch { return {}; } })();
      // Lines this run did not read keep their recorded values (a 12-minute run records them all).
      writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.status === 'not read' && old[k] ? old[k] : { status: v.status, value: v.value, ...(old[k]?.accepted ? { accepted: old[k].accepted } : {}) }])), null, 1) + '\n');
      console.log('baseline written');
    } else {
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')), problems = ratchet(res, base);
      // CI passes the base commit: a pull request may record progress with --update but not a regression.
      const ref = opt('base-ref');
      if (ref) {
        let old = null;
        try { old = JSON.parse(execFileSync('git', ['show', `${ref}:experiments/cinderhill/spikes/pace-baseline.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { console.log(`no baseline at ${ref}: nothing to compare`); }
        if (old) problems.push(...slack(base, old).map(p => `baseline: ${p}`));
      }
      if (!quotaFails.length) problems.push('the quota opening fails no blocking line the current build passes: the table is too loose');
      // Only lines the short fixture run can read: a line past its horizon is "not read" there, and that is no catch.
      const broodBad = ratchet(brood, base, block.filter(l => brood[l.id].status !== 'not read')).filter(p => !/passes now|in this run/.test(p));
      console.log(`Brood x10 plant: ${broodBad.length ? `caught (${broodBad.join('; ')})` : 'NOT caught'}.`);
      if (!broodBad.length) problems.push('the brood x10 plant passes the gate');
      const over = block.filter(l => res[l.id].status !== 'pass');
      console.log(`Pace budget at ${STAGE}: ${over.length ? `FAILS ${over.map(l => `${l.id} ${res[l.id].value}`).join(', ')}${strict() ? '' : ' (allowed by the baseline at R0, may not get worse; from R1 step 2 every blocking line must pass)'}` : 'every blocking line passes'}.`);
      for (const p of problems) console.log(`GATE: ${p}`);
      console.log(`${problems.length ? 'pace gate FAILS' : 'pace gate holds'} (${seeds} seeds, ${minutes} min, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      process.exitCode = problems.length ? 1 : 0;
    }
  }
}
