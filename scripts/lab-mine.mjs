#!/usr/bin/env node
// Mines the game lab's play records: pulls them from the lab's private bucket (hf-lab) with Wrangler, joins each run's
// parts, and writes a report for every game and a timeline for every run. A local tool: it uses your own Cloudflare
// login through Wrangler in a human-framework checkout and holds no secret.
//
//   node scripts/lab-mine.mjs 2026-11-26                       one receipt day (UTC), owner rows only
//   node scripts/lab-mine.mjs 2026-11-20 2026-11-26            a range of days
//   options: --game=<slug>   only this game (repeatable)
//            --agent         agent runs only (?labRunSource=agent); --all both. Default: rows without runSource (the owner and testers)
//            --out=<dir>     where to write (default ~/lab-mine/<from>[_<to>], outside this repository)
//            --hf=<dir>      the human-framework checkout Wrangler runs in (default $HF_DIR or ~/code/lab/hf-new)
//            --offline       read only what an earlier run downloaded into <out>/cache
//   env:     LAB_WRANGLER    the Wrangler command (default: fnm exec --using=26.12.0 -- pnpm exec wrangler)
//
// The private index is per receipt day (private/linked-index/<day>.json), so a run that started before midnight UTC
// can sit in the next day. Downloads are cached in <out>/cache by record id; a second run downloads only what is new.
// What it writes: <out>/summary.md (every game in a few lines), <out>/<game>.md (the full report), <out>/runs/<game>/*.txt
// (one timeline per run) and <out>/data.json (the numbers behind the reports). Records are private play data: the
// output stays on this machine; do not commit it or paste player ids anywhere public.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { joinRuns } from './lab-join.mjs';

const HEX = /^[a-f0-9]{32}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
const QUIT = /^(left|quit|quitted|abandon(ed)?|exit|menu|gave-?up|restart(ed)?)$/i;
const IDLE_MS = 10000;

// ---- fetching ---------------------------------------------------------------------------------------------------
function days(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
function wrangler(hf, key) {
  const cmd = (process.env.LAB_WRANGLER ?? 'fnm exec --using=26.12.0 -- pnpm exec wrangler').split(' ').filter(Boolean);
  return new Promise((done, fail) => execFile(cmd[0], [...cmd.slice(1), 'r2', 'object', 'get', `hf-lab/${key}`, '--remote', '--pipe'],
    { cwd: hf, encoding: 'buffer', maxBuffer: 64 << 20, timeout: 120000 }, (err, out) => (err ? fail(err) : done(out))));
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}
export async function fetchRecords({ from, to, hf, out, offline, keep }) {
  const cache = join(out, 'cache'); mkdirSync(cache, { recursive: true });
  const rows = [];
  for (const day of days(from, to)) {
    const file = join(cache, `index-${day}.json`);
    if (!offline) {
      try { writeFileSync(file, await wrangler(hf, `private/linked-index/${day}.json`)); }
      catch { if (!existsSync(file)) { console.error(`${day}: no index (no records that day, or Wrangler failed)`); continue; } }
    }
    if (!existsSync(file)) continue;
    try { for (const r of JSON.parse(readFileSync(file, 'utf8')).records ?? []) rows.push({ ...r, day }); }
    catch { console.error(`${day}: the index is not JSON`); }
  }
  const wanted = rows.filter(r => HEX.test(r.id) && HEX.test(r.player) && keep(r));
  let fetched = 0, failed = 0;
  const records = await pool(wanted, 6, async row => {
    const file = join(cache, `${row.id}.json`);
    if (!existsSync(file)) {
      if (offline) return null;
      try { writeFileSync(file, gunzipSync(await wrangler(hf, row.key ?? `linked/${row.player}/${row.id}.json.gz`))); fetched++; }
      catch { failed++; return null; }
      if ((fetched + failed) % 25 === 0) console.error(`  ${fetched + failed} of ${wanted.length} downloaded`);
    }
    try { return { ...JSON.parse(readFileSync(file, 'utf8')), receiptDay: row.day }; } catch { return null; }
  });
  console.error(`${rows.length} index rows, ${wanted.length} selected, ${fetched} downloaded now${failed ? `, ${failed} failed` : ''}`);
  return records.filter(Boolean);
}

// ---- numbers ----------------------------------------------------------------------------------------------------
const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const count = (xs, f = x => x) => { const m = new Map(); for (const x of xs) { const k = f(x); if (k === undefined || k === null) continue; m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
const secs = ms => ms === null || ms === undefined ? '-' : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${(ms / 60000).toFixed(1)} min`;
const short = (v, n = 60) => { if (v === undefined) return ''; let s; try { s = JSON.stringify(v); } catch { s = String(v); } return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
const table = (head, rows) => rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(c => String(c ?? '').replace(/\|/g, '/')).join(' | ')} |`)].join('\n') : '_none_';

// Everything that happened in a run on one clock (ms from its start): game events and trace entries.
function moments(run) {
  const d = run.data, out = [];
  for (const e of d.events ?? []) out.push({ t: e.t ?? 0, what: 'event', e });
  for (const x of d.trace ?? []) out.push({ t: x[0], what: 'trace', x });
  return out.sort((a, b) => a.t - b.t);
}
// Gaps of at least IDLE_MS with nothing from the player or the game, not counting time the page was hidden.
function idleGaps(run) {
  const m = moments(run).filter(m => !(m.what === 'trace' && m.x[1] === 'fps'));
  const end = run.data.ended - run.data.started, gaps = [];
  let last = 0, hidden = false;
  for (const x of [...m, { t: end, what: 'end' }]) {
    if (x.t < 0) continue;
    if (!hidden && x.t - last >= IDLE_MS) gaps.push({ from: last, ms: x.t - last });
    if (x.what === 'trace' && x.x[1] === 'hide') hidden = true;
    if (x.what === 'trace' && x.x[1] === 'show') hidden = false;
    last = x.t;
  }
  return gaps;
}
const lastEvent = run => (run.data.events ?? []).at(-1);
const lastTap = run => (run.data.trace ?? []).filter(x => x[1] === 'b' && x[0] >= 0).at(-1);
const where = run => { const e = lastEvent(run), b = lastTap(run); return [e ? `${e.type}${e.data !== undefined ? ' ' + short(e.data, 40) : ''} at ${secs(e.t)}` : 'no game event', b ? `tap "${b[2]}" at ${secs(b[0])}` : ''].filter(Boolean).join('; '); };

// Player settings (owner 2026-11-27: give players options as settings with a default, then count who changes them and to
// what). Games send `setting {name, from, to}` events and may put the active values in a run's start. Per setting: how
// many players changed it, how many changes, each changer's last pick, and runs played under each value.
export function settings(runs, between) {
  const evs = [...runs, ...between].flatMap(r => (r.data.events ?? []).filter(e => e.type === 'setting' && (e.data?.id ?? e.data?.name)).map(e => ({ player: r.player, at: (r.data.started ?? r.at) + (e.t ?? 0),
    // kit/settings.js sends {id, value, from, def}; earlier pages sent {name, from, to}.
    name: e.data.id ?? e.data.name, to: e.data.value ?? e.data.to })));
  const names = [...new Set(evs.map(e => e.name))].sort();
  return names.map(name => {
    const mine = evs.filter(e => e.name === name).sort((a, b) => a.at - b.at), last = new Map();
    for (const e of mine) last.set(e.player, e.to);
    return { name, changers: last.size, changes: mine.length, finalPick: count([...last.values()], v => String(v)),
      runsWith: count(runs.filter(r => r.data.start && name in r.data.start), r => String(r.data.start[name])) };
  });
}

export function analyse(records) {
  const games = new Map();
  const of = g => { if (!games.has(g)) games.set(g, { records: [], runs: [], between: [], other: [] }); return games.get(g); };
  for (const r of records) {
    const g = of(r.game); g.records.push(r);
    if (r.kind === 'run' && r.data?.format === 'kit-lab/1' && r.data.outcome === 'between-runs') g.between.push(r);
    else if (!(r.kind === 'run' && r.data?.format === 'kit-lab/1') && r.kind !== 'events') g.other.push(r);
  }
  for (const run of joinRuns(records)) of(run.game).runs.push(run);
  const report = {};
  for (const [game, g] of [...games].sort()) {
    const runs = g.runs.sort((a, b) => a.data.started - b.data.started);
    const sessions = new Map();
    for (const r of g.records) { if (!sessions.has(r.session)) sessions.set(r.session, { player: r.player, runs: [] }); }
    for (const run of runs) sessions.get(run.session)?.runs.push(run);
    // A retry: a run that starts in the same session within two minutes of the previous run's end.
    const retries = [];
    for (const s of sessions.values()) for (let i = 1; i < s.runs.length; i++) {
      const gap = s.runs[i].data.started - s.runs[i - 1].data.ended;
      if (gap >= 0 && gap <= 120000) retries.push({ after: s.runs[i - 1].data.outcome ?? 'unfinished', gap });
    }
    const durations = runs.map(r => r.data.ended - r.data.started).filter(ms => ms >= 0);
    const quits = runs.filter(r => r.data.outcome === null || QUIT.test(String(r.data.outcome)));
    const sessionEnds = [...sessions.values()].filter(s => s.runs.length).map(s => s.runs.at(-1));
    const trace = runs.flatMap(r => (r.data.trace ?? []).map(x => ({ x, run: r })));
    const traced = runs.filter(r => (r.data.trace ?? []).length || r.data.env);
    const downs = trace.filter(({ x }) => x[1] === 'd');
    const grid = Array.from({ length: 10 }, () => new Array(10).fill(0));
    for (const { x } of downs) grid[Math.min(9, Math.floor(x[3] / 100))][Math.min(9, Math.floor(x[2] / 100))]++;
    const fps = trace.filter(({ x }) => x[1] === 'fps').map(({ x }) => ({ p50: x[2], p95: x[3], worst: x[4], n: x[5] }));
    const gaps = runs.flatMap(r => idleGaps(r).map(gp => ({ ...gp, run: r })));
    report[game] = {
      records: g.records.length, kinds: count(g.records, r => `${r.kind}${r.data?.format ? ' ' + r.data.format : ''}`),
      players: new Set(g.records.map(r => r.player)).size, sessions: sessions.size, byPlayer: count(runs, r => r.player.slice(0, 6)),
      runs: runs.length, complete: runs.filter(r => r.data.joined.complete).length, parted: runs.filter(r => !r.data.joined.legacy).length,
      missingParts: runs.filter(r => r.data.joined.missing.length).map(r => ({ runId: r.runId, missing: r.data.joined.missing })),
      outcomes: count(runs, r => r.data.outcome ?? 'unfinished (page closed or hidden, no final record)'),
      duration: { total: durations.reduce((a, b) => a + b, 0), p50: q(durations, 0.5), p90: q(durations, 0.9), min: q(durations, 0), max: q(durations, 1) },
      runsPerSession: q([...sessions.values()].map(s => s.runs.length), 0.5),
      retries: { count: retries.length, after: count(retries, r => r.after), gapP50: q(retries.map(r => r.gap), 0.5) },
      quits: quits.map(r => ({ runId: r.runId, outcome: r.data.outcome, at: r.data.ended - r.data.started, where: where(r) })),
      sessionEnds: count(sessionEnds, r => `${r.data.outcome ?? 'unfinished'} — ${lastEvent(r)?.type ?? 'no game event'}`),
      idle: { gaps: gaps.length, over30: gaps.filter(x => x.ms >= 30000).length, longest: q(gaps.map(x => x.ms), 1), total: gaps.reduce((a, x) => a + x.ms, 0),
        top: gaps.sort((a, b) => b.ms - a.ms).slice(0, 5).map(x => ({ runId: x.run.runId, from: x.from, ms: x.ms, before: (x.run.data.events ?? []).filter(e => e.t <= x.from).at(-1)?.type ?? '' })) },
      events: count(runs.flatMap(r => r.data.events ?? []), e => e.type),
      between: count(g.between.flatMap(r => r.data.events ?? []), e => e.type),
      traced: traced.length,
      devices: count(runs, r => r.data.env?.device ?? null),
      viewports: count(runs.filter(r => r.data.env), r => `${r.data.env.w}x${r.data.env.h}`),
      heat: { taps: downs.length, grid, on: count(downs, ({ x }) => ({ c: 'canvas', b: 'button', f: 'text field', '': 'other' })[x[5] ?? ''] ?? 'other'),
        pointer: count(downs, ({ x }) => ({ m: 'mouse', t: 'touch', p: 'pen' })[x[4]] ?? 'unknown') },
      buttons: count(trace.filter(({ x }) => x[1] === 'b'), ({ x }) => `${x[2] || '(no words)'}${x[3] ? ` #${x[3]}` : ''}`),
      keys: count(trace.filter(({ x }) => x[1] === 'k'), ({ x }) => x[2]), fieldKeys: trace.filter(({ x }) => x[1] === 'kf').length,
      lifecycle: count(trace.filter(({ x }) => ['hide', 'show', 'blur', 'focus', 'resize'].includes(x[1])), ({ x }) => x[1]),
      fps: fps.length ? { windows: fps.length, p50fps: Math.round(1000 / q(fps.map(f => f.p50), 0.5)), p95fps: Math.round(1000 / q(fps.map(f => f.p95), 0.5)),
        worstFrame: q(fps.map(f => f.worst), 1), slowWindows: fps.filter(f => f.p95 > 33.4).length } : null,
      errors: count(trace.filter(({ x }) => x[1] === 'err'), ({ x }) => `${x[2]}: ${x[3]}`),
      settings: settings(runs, g.between),
      other: count(g.other, r => `${r.kind} ${r.data?.format ?? ''}`.trim()),
    };
  }
  return { games: report, gamesRuns: Object.fromEntries([...games].map(([k, g]) => [k, g.runs])) };
}

// ---- writing ----------------------------------------------------------------------------------------------------
function heatText(grid) {
  const max = Math.max(1, ...grid.flat()), shade = ' .:-=+*#%@';
  return ['```', '      left → right (tenths of the screen width); rows top → bottom', ...grid.map((row, i) => `${String(i).padStart(2)}  |${row.map(n => (n ? shade[Math.max(1, Math.round((n / max) * 9))] : ' ').repeat(2)).join('')}|  ${row.reduce((a, b) => a + b, 0)}`), '```'].join('\n');
}
function gameReport(game, r) {
  const L = [`# ${game}`, ''];
  L.push(`${r.records} records (${r.kinds.map(([k, n]) => `${n} ${k}`).join(', ')}); ${r.players} player id(s); ${r.sessions} session(s); ${r.runs} run(s), ${r.complete} complete; ${r.parted} sent in parts.`);
  if (r.players > 1) L.push('', `Runs by player id (first 6 characters): ${r.byPlayer.map(([k, n]) => `${k} ×${n}`).join(', ')}.`);
  if (!r.traced) L.push('', '_No input trace, frame times or errors: these records predate the kit trace (it ships with the change that adds this miner, 2026-11-26). Heat, buttons, keys, fps and errors stay empty until play recorded after that._');
  if (r.missingParts.length) L.push('', `**Runs missing parts:** ${r.missingParts.map(m => `${m.runId.slice(0, 8)} (${m.missing.join(', ')})`).join('; ')}`);
  L.push('', '## Runs', '', table(['outcome', 'runs'], r.outcomes));
  L.push('', `Time played ${secs(r.duration.total)}; a run lasts ${secs(r.duration.p50)} at the median, ${secs(r.duration.p90)} at p90 (shortest ${secs(r.duration.min)}, longest ${secs(r.duration.max)}). Runs per session (median): ${r.runsPerSession ?? '-'}.`);
  L.push('', `**Retries** (a new run within 2 min of the last one ending, same session): ${r.retries.count}${r.retries.count ? `, median ${secs(r.retries.gapP50)} later; after ${r.retries.after.map(([k, n]) => `${k} ×${n}`).join(', ')}` : ''}.`);
  L.push('', `## Quits and where (${r.quits.length})`, '', table(['run', 'outcome', 'after', 'last thing'], r.quits.map(x => [x.runId.slice(0, 8), x.outcome ?? 'unfinished', secs(x.at), x.where])));
  L.push('', '**How sessions ended** (the last run of each session: outcome — last game event):', '', table(['ending', 'sessions'], r.sessionEnds));
  L.push('', '## Idle gaps', '', `${r.idle.gaps} gaps of 10 s or more with no game event or input (time hidden not counted), ${r.idle.over30} of 30 s or more, ${secs(r.idle.total)} in all; longest ${secs(r.idle.longest)}.`);
  if (r.idle.top.length) L.push('', table(['run', 'from', 'idle', 'last game event before'], r.idle.top.map(x => [x.runId.slice(0, 8), secs(x.from), secs(x.ms), x.before])));
  L.push('', '## Game events', '', table(['event', 'times'], r.events.slice(0, 30)));
  if (r.between.length) L.push('', '**Outside a run:**', '', table(['event', 'times'], r.between));
  if (r.settings?.length) {
    L.push('', '## Settings', '', `Of ${r.players} player id(s): who changed each setting, and to what.`, '');
    L.push(table(['setting', 'players who changed it', 'changes', 'their last pick', 'runs played with'], r.settings.map(x => [x.name, x.changers, x.changes,
      x.finalPick.map(([k, n]) => `${k} ×${n}`).join(', ') || '-', x.runsWith.map(([k, n]) => `${k} ×${n}`).join(', ') || '-'])));
  }
  L.push('', '## Input', '', `Device: ${r.devices.map(([k, n]) => `${k} ×${n}`).join(', ') || '-'}; viewports: ${r.viewports.slice(0, 6).map(([k, n]) => `${k} ×${n}`).join(', ') || '-'}.`);
  L.push('', `**Where presses land** (${r.heat.taps} presses; ${r.heat.on.map(([k, n]) => `${k} ${n}`).join(', ') || '-'}; ${r.heat.pointer.map(([k, n]) => `${k} ${n}`).join(', ') || '-'}):`, '', r.heat.taps ? heatText(r.heat.grid) : '_none_');
  L.push('', '**Buttons:**', '', table(['button', 'taps'], r.buttons.slice(0, 30)));
  L.push('', `**Keys:** ${r.keys.slice(0, 20).map(([k, n]) => `${k} ×${n}`).join(', ') || '-'}${r.fieldKeys ? `; ${r.fieldKeys} key presses in text fields (not recorded as keys)` : ''}. **Page:** ${r.lifecycle.map(([k, n]) => `${k} ×${n}`).join(', ') || '-'}.`);
  L.push('', '## Frames', '', r.fps ? `${r.fps.windows} ten-second windows: median frame rate ${r.fps.p50fps} fps, p95 frame rate ${r.fps.p95fps} fps (median of windows), worst frame ${r.fps.worstFrame} ms, ${r.fps.slowWindows} windows whose p95 frame was slower than 30 fps.` : '_none_');
  L.push('', '## Errors', '', table(['error', 'times'], r.errors));
  if (r.other.length) L.push('', '## Other records', '', table(['kind', 'records'], r.other));
  return L.join('\n') + '\n';
}
function timeline(run) {
  const d = run.data, L = [];
  L.push(`${run.game} run ${run.runId}`, `player ${run.player.slice(0, 8)}  session ${run.session.slice(0, 8)}${run.runSource ? '  ' + run.runSource : ''}  build ${short(run.build)}`);
  L.push(`started ${new Date(d.started).toISOString()}  lasted ${secs(d.ended - d.started)}  outcome ${d.outcome ?? 'unfinished'}  parts ${d.joined.parts}${d.joined.missing.length ? ` missing ${d.joined.missing}` : ''}${d.truncated ? '  truncated ' + short(d.dropped) : ''}`);
  if (d.env) L.push(`device ${short(d.env, 200)}`);
  L.push(`start ${short(d.start, 400)}`, `summary ${short(d.summary, 400)}`, '');
  const gaps = new Map(idleGaps(run).map(g => [g.from, g.ms]));
  let drag = null;
  const flushDrag = () => { if (drag) { L.push(`${stamp(drag.t)}  ${drag.n} moves${drag.hover ? ' (hover)' : ''} to (${drag.x}, ${drag.y})`); drag = null; } };
  const stamp = t => `${t < 0 ? '-' : '+'}${(Math.abs(t) / 1000).toFixed(1).padStart(7)}s`;
  for (const m of moments(run)) {
    if (m.what === 'trace' && m.x[1] === 'm') { const hover = m.x[4] === 'h'; if (drag && drag.hover === hover) { drag.n++; drag.x = m.x[2]; drag.y = m.x[3]; } else { flushDrag(); drag = { t: m.t, n: 1, x: m.x[2], y: m.x[3], hover }; } continue; }
    flushDrag();
    if (m.what === 'event') L.push(`${stamp(m.t)}  * ${m.e.type}${m.e.data !== undefined ? ' ' + short(m.e.data, 160) : ''}`);
    else {
      const [, type, ...a] = m.x;
      const text = { d: () => `press (${a[0]}, ${a[1]}) ${({ m: 'mouse', t: 'touch', p: 'pen' })[a[2]] ?? ''} on ${({ c: 'canvas', b: 'button', f: 'field' })[a[3]] ?? 'page'}`, u: () => `release (${a[0]}, ${a[1]})`, x: () => `cancel (${a[0]}, ${a[1]})`,
        k: () => `key ${a[0]}${a[1] ? ' +' + a[1] : ''}`, K: () => `key up ${a[0]}`, kf: () => 'key in a text field', b: () => `tap "${a[0]}"${a[1] ? ' #' + a[1] : ''}`,
        fps: () => `frames p50 ${a[0]} ms, p95 ${a[1]} ms, worst ${a[2]} ms (${a[3]})`, err: () => `ERROR ${a[0]}: ${a[1]} ${a[2] ? '[' + a[2] + ']' : ''}`, resize: () => `resize ${a[0]}x${a[1]}` }[type];
      L.push(`${stamp(m.t)}  ${text ? text() : type}`);
    }
    if (gaps.has(m.t)) L.push(`          -- idle ${secs(gaps.get(m.t))} --`);
  }
  flushDrag();
  L.push(`${stamp(d.ended - d.started)}  end: ${d.outcome ?? 'unfinished (no final record)'}`);
  return L.join('\n') + '\n';
}
export function write(out, { games, gamesRuns }, label) {
  mkdirSync(out, { recursive: true });
  const S = [`# Lab play, ${label}`, '', table(['game', 'players', 'sessions', 'runs', 'complete', 'time played', 'median run', 'outcomes', 'retries', 'quits', 'idle ≥10 s', 'traced runs', 'presses', 'errors', 'fps p50/p95'],
    Object.entries(games).map(([g, r]) => [g, r.players, r.sessions, r.runs, r.complete, secs(r.duration.total), secs(r.duration.p50), r.outcomes.slice(0, 3).map(([k, n]) => `${k.split(' ')[0]} ${n}`).join(', '), r.retries.count, r.quits.length, r.idle.gaps, r.traced, r.heat.taps, r.errors.reduce((a, [, n]) => a + n, 0), r.fps ? `${r.fps.p50fps}/${r.fps.p95fps}` : '-']))];
  writeFileSync(join(out, 'summary.md'), S.join('\n') + '\n');
  for (const [g, r] of Object.entries(games)) {
    writeFileSync(join(out, `${g}.md`), gameReport(g, r));
    mkdirSync(join(out, 'runs', g), { recursive: true });
    for (const run of gamesRuns[g]) writeFileSync(join(out, 'runs', g, `${new Date(run.data.started).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}-${run.runId.slice(0, 8)}.txt`), timeline(run));
  }
  writeFileSync(join(out, 'data.json'), JSON.stringify(games, null, 1));
  return S.join('\n');
}

// ---- command line -----------------------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2), opt = n => args.filter(a => a.startsWith(`--${n}=`)).map(a => a.slice(n.length + 3));
  const dates = args.filter(a => DAY.test(a));
  if (!dates.length) { console.error('usage: node scripts/lab-mine.mjs <from day> [<to day>] [--game=slug] [--agent|--all] [--out=dir] [--hf=dir] [--offline]'); process.exit(1); }
  const [from, to = dates[0]] = dates, label = from === to ? from : `${from} to ${to}`;
  const out = opt('out')[0] ?? join(homedir(), 'lab-mine', from === to ? from : `${from}_${to}`);
  const hf = opt('hf')[0] ?? process.env.HF_DIR ?? join(homedir(), 'code/lab/hf-new');
  const games = new Set(opt('game')), who = args.includes('--all') ? 'all' : args.includes('--agent') ? 'agent' : 'owner';
  const keep = r => (!games.size || games.has(r.game)) && (who === 'all' || (who === 'agent') === (r.runSource === 'agent'));
  const records = await fetchRecords({ from, to, hf, out, offline: args.includes('--offline'), keep });
  const summary = write(out, analyse(records), `${label} (${who === 'owner' ? 'rows without runSource' : who})`);
  console.log(summary);
  console.log(`\nWrote ${out}/summary.md, one <game>.md per game, runs/<game>/*.txt and data.json.`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
