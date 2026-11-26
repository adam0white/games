// The lab record (labrec.js) and its replay (spikes/replay-lab.mjs): a bot plays a colony game through a Host as the
// page does (orders, a dusk, a day restarted, go on, holds), the record is built with the kit's limits, and the replay
// must reach every hash the record holds. A changed order must be caught.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Host, CMD, SURFACE, NEST } from '../host.js';
import { LabRecord, LIMITS, FORMAT } from '../labrec.js';
import { parts, replayChain } from '../spikes/replay-lab.mjs';

/** A stand-in for kit/lab.js: the run records it would send, in its data shape. */
function fakeLab() {
  const runs = []; let run = null, t = 0;
  const clean = v => { const s = JSON.stringify(v ?? null); return s.length <= LIMITS.event ? JSON.parse(s) : { tooLarge: true }; };
  return {
    runs,
    start(info) { if (run && run.outcome === null) { run.outcome = 'left'; } run = { format: 'kit-lab/1', start: clean(info), events: [], outcome: null, summary: null }; runs.push(run); },
    event(type, data) { if (run && run.outcome === null && run.events.length < LIMITS.events + 1) run.events.push({ t: t++, type, data: clean(data) }); },
    end(outcome, summary) { if (run && run.outcome === null) { run.outcome = outcome; run.summary = clean(summary); } },
  };
}

/** A careful-ish player for `ticks` of play: trails to the nearest piles, a dig, an alarm, a recall, holds; at the
 *  first dusk the day is restarted once, then the player goes on. */
function play({ ticks = 12000, dayTicks = 3000, roll } = {}) {
  const host = new Host(20, 2026, { colony: true, dayTicks }), rec = fakeLab(), lab = new LabRecord(rec, roll);
  lab.start(host, { mode: 'colony', look: 'default', viewport: [390, 844, 3] });
  const order = o => lab.order(o, host.order(o));
  const ex = host.sim.L.sw >> 1, ey = host.sim.L.sh >> 1;
  let restarted = false, now = 0, k = 0;
  while (host.ticks < ticks) {
    const t = host.tick;
    if (t % 1500 === 10) { const piles = host.stats().piles.filter(p => p.amount > 0).sort((a, b) => Math.abs(a.x - ex) + Math.abs(a.y - ey) - Math.abs(b.x - ex) - Math.abs(b.y - ey)); const p = piles[(k++) % Math.min(2, piles.length)]; if (p) order({ type: CMD.TRAIL, layer: SURFACE, points: [ex + 1, ey + 1, p.x, p.y] }); }
    if (t === 2000) order({ type: CMD.DIG, cells: [20, 30, 21, 30, 22, 30, 20, 31, 21, 31, 22, 31] });
    if (t === 4000) order({ type: CMD.ALARM, layer: SURFACE, x: ex + 4, y: ey + 4, hold: 100 });
    if (t === 6000) order({ type: CMD.RECALL, on: true });
    if (t === 6400) order({ type: CMD.RECALL, on: false });
    if (t === 7000) lab.hold(true, now); if (t === 7001) lab.hold(false, now + 2500);
    host.step(); now += 50; lab.frame(16 + (t % 7)); lab.camera(SURFACE, { x: 64 + (t >> 9), y: 64, z: 4 }, now); lab.tick();
    if (host.dusk) {
      if (!restarted) { restarted = true; const day = host.dusk.day, before = host.tick; host.restartDay(day); lab.restart(day, before); }
      else { host.goOn(); lab.goOn(); }
    }
  }
  lab.end('left');
  return { host, runs: rec.runs };
}

const kitLimits = () => {
  const src = readFileSync(new URL('../../kit/lab.js', import.meta.url), 'utf8');
  const m = src.match(/MAX_EVENTS = (\d+), MAX_BYTES = (\d+) \* 1024/);
  return { events: Number(m[1]), bytes: Number(m[2]) * 1024 };
};

const game = play();

test('the limits labrec.js keeps under are the kit\'s', () => {
  const k = kitLimits();
  assert.equal(LIMITS.events, k.events); assert.equal(LIMITS.bytes, k.bytes);
});

test('a 10-minute game makes a record under the kit\'s limits, with the replay stream and 20 samples', () => {
  assert.equal(game.runs.length, 1, 'one part');
  const r = game.runs[0], json = JSON.stringify(r);
  assert.ok(json.length < LIMITS.bytes, `${json.length} bytes`);
  assert.ok(r.events.length <= LIMITS.events, `${r.events.length} events`);
  for (const e of r.events) assert.notEqual(e.data?.tooLarge, true, e.type);
  assert.equal(r.start.format, FORMAT);
  const samples = r.events.filter(e => e.type === 'sample');
  assert.ok(samples.length >= 19, `${samples.length} samples`);
  assert.ok(samples.every(s => Number.isInteger(s.data.hash) && s.data.f?.length === 2));
  const log = r.events.filter(e => e.type === 'log').flatMap(e => e.data.e);
  assert.ok(log.some(e => e[0] === 'r') && log.some(e => e[0] === 'g'), 'a restart and a go-on');
  assert.ok(r.events.some(e => e.type === 'hold' && e.data.ms === 2550));
  assert.ok(r.events.some(e => e.type === 'cam'));
  assert.ok(Number.isInteger(r.summary.hash) && r.summary.orders.trail > 0);
  console.log(`record: ${json.length} bytes, ${r.events.length} events`);
});

test('the replay reaches every hash in the record and reports the game', () => {
  const [chain] = parts(game.runs);
  const out = replayChain(chain);
  assert.equal(out.divergence, null);
  assert.ok(out.ok && out.checks >= 20, `${out.checks} checks`);
  const st = out.stats;
  assert.ok(st.trails.length >= 5 && st.trails.some(t => t.trips > 0), 'trails with trips');
  assert.ok(st.trails.some(t => t.how === 'restart'), 'the restart ends the trails of the undone day');
  assert.equal(st.digs.length, 2, 'the dig, given again after the restart');
  assert.ok(st.recalls[0].before > 0 && st.recalls[0].after < st.recalls[0].before, 'recall clears the surface');
  assert.ok(st.minutes.length >= 10);
  assert.match(out.report, /Replay matches/);
  assert.match(out.report, /restart day 1/);
});

test('a record with one order changed diverges, and the replay names where', () => {
  const runs = JSON.parse(JSON.stringify(game.runs));
  const log = runs[0].events.find(e => e.type === 'log' && e.data.e.some(x => x[0] === 'o' && x[2].type === CMD.TRAIL));
  const o = log.data.e.find(x => x[0] === 'o' && x[2].type === CMD.TRAIL)[2];
  o.points[2] += 3;
  const out = replayChain(parts(runs)[0], { stopAtDivergence: true });
  assert.equal(out.ok, false);
  assert.equal(out.divergence.what, 'sample');
  assert.match(out.report, /Replay diverged/);
});

test('a long game rolls over into parts that replay as one', () => {
  const small = play({ ticks: 4000, roll: { rollEvents: 6, rollBytes: 4000, batch: 400 } });
  assert.ok(small.runs.length >= 3, `${small.runs.length} parts`);
  assert.ok(small.runs.slice(0, -1).every(r => r.outcome === 'continued'));
  const shuffled = small.runs.slice().reverse();
  const out = replayChain(parts(shuffled)[0]);
  assert.equal(out.divergence, null); assert.ok(out.ok);
  const missing = small.runs.filter((_, k) => k !== 1);
  assert.match(replayChain(parts(missing)[0]).notes.join(), /part 2 is missing/);
});
