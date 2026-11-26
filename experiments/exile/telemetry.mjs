#!/usr/bin/env node
// Reads Exile play records from the lab inbox and prints what happened in each run.
//
//   node experiments/exile/telemetry.mjs .exile-records --fetch=7
//
// --fetch=DAYS downloads only Exile's records for the last DAYS days from the lab's private bucket (hf-lab) into the
// folder, with Wrangler and your own Cloudflare login, and keeps them, so a later run downloads only what is new.
// Without --fetch the folder is read as it is; a human-framework `.lab-inbox` (from `npm run lab:inbox`) works too.
// Options: --agents includes bot and agent runs (left out otherwise); --csv=FILE writes one row per run;
// --html=FILE writes a page with the same tables and a map of where players walked and fell.
// What the build sends is listed in NOTES.md under "Play records".
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { joinRuns } from '../../scripts/lab-join.mjs';

const args = process.argv.slice(2), dir = args.find(a => !a.startsWith('--'));
const opt = n => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (!dir) { console.error('usage: node telemetry.mjs <path to .lab-inbox> [--fetch=DAYS] [--agents] [--csv=FILE] [--html=FILE]'); process.exit(1); }
const agents = args.includes('--agents');

const days = Number(opt('fetch'));
if (days > 0) {
  mkdirSync(join(dir, 'linked'), { recursive: true }); mkdirSync(join(dir, 'raw'), { recursive: true });
  const get = (key, file) => execFileSync('wrangler', ['r2', 'object', 'get', `hf-lab/${key}`, '--remote', '--file', file], { stdio: 'ignore', timeout: 30000 });
  const groups = new Map(); let fresh = 0, failed = 0;
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), index = join(dir, 'raw', `index-${day}.json`);
    try { get(`private/linked-index/${day}.json`, index); } catch { continue; }   // no records that day
    for (const e of JSON.parse(readFileSync(index, 'utf8')).records ?? []) {
      if (e.game !== 'exile' || !/^[a-f0-9]{32}$/.test(e.id) || !/^[a-f0-9]{32}$/.test(e.player)) continue;
      const file = join(dir, 'raw', `${e.id}.json`);
      if (!existsSync(file)) { try { get(`linked/${e.player}/${e.id}.json.gz`, `${file}.gz`); writeFileSync(file, gunzipSync(readFileSync(`${file}.gz`))); fresh++; } catch { failed++; continue; } }
    }
  }
  for (const f of readdirSync(join(dir, 'raw')).filter(f => /^[a-f0-9]{32}\.json$/.test(f))) {
    const r = JSON.parse(readFileSync(join(dir, 'raw', f), 'utf8')), key = `${r.player}-exile-${r.session}-${r.runId}-${r.runSource ?? 'unattributed'}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [key, records] of groups) writeFileSync(join(dir, 'linked', `${key}.json`), JSON.stringify(records));
  console.error(`Fetched ${fresh} new records${failed ? `, ${failed} failed` : ''}.`);
}

// A run can arrive as several records: an older copy sent when the page was put away, or, since 2026-11-26, numbered
// parts. scripts/lab-join.mjs joins them into one record per run.
const runs = new Map(), between = [], parts = [];
let files = []; try { files = readdirSync(join(dir, 'linked')).filter(f => f.includes('-exile-') && f.endsWith('.json')); } catch {}
for (const f of files) {
  let records = []; try { records = JSON.parse(readFileSync(join(dir, 'linked', f), 'utf8')); } catch { continue; }
  for (const r of records) {
    if (r.game !== 'exile' || r.kind !== 'run' || r.data?.format !== 'kit-lab/1') continue;
    if (r.runSource === 'agent' && !agents) continue;
    if (r.data.outcome === 'between-runs') { between.push(r); continue; }
    parts.push(r);
  }
}
for (const r of joinRuns(parts)) runs.set(r.runId, r);

const PHASES = ['Camp', 'Raid', 'Free', 'Judge', 'Won', 'Lost'];
const rows = [...runs.values()].sort((a, b) => a.at - b.at).map(r => {
  const d = r.data, ev = d.events ?? [], of = t => ev.filter(e => e.type === t).map(e => e.data ?? {});
  const snaps = of('snap'), last = d.summary ?? snaps.at(-1) ?? {}, bot = d.start?.bot === true || r.runSource === 'agent';
  const path = snaps.flatMap(s => s.path ?? []).concat(d.summary?.path ?? []);
  return {
    when: new Date(d.started).toISOString().slice(0, 16).replace('T', ' '), player: r.player.slice(0, 6), who: bot ? 'agent' : 'person',
    build: d.start?.build ?? '', touch: d.start?.touch ? 'touch' : 'keys', outcome: d.outcome ?? 'left', minutes: +((d.ended - d.started) / 60000).toFixed(1),
    gameT: last.t ?? 0, phase: last.phase ?? 'Camp', level: last.level ?? 1, falls: last.falls ?? 0, buildings: last.buildings ?? 0,
    followers: last.followers ?? 0, soldiers: last.soldiers ?? 0, founded: !!last.founded, raid: of('raid').length > 0, raidWon: of('raidWon').length > 0,
    witness: !!last.witness, brotherDown: of('brotherDown').length > 0, crowned: of('crowned').length > 0, season: last.season ?? 0, difficulty: d.start?.difficulty ?? '',
    petitions: of('petition').map(p => p.answer).join(', '), crises: of('crisis').map(c => c.kind).join(' '), swings: last.swings ?? 0, hits: last.hits ?? 0, rolls: last.rolls ?? 0,
    parries: last.parries ?? 0, blocks: last.blocks ?? 0, locks: last.locks ?? 0, potions: last.potions ?? 0, mounts: last.mounts ?? 0, ride: last.ride ?? 0,
    kills: (last.kills ?? []).reduce((a, b) => a + b, 0), dmgOut: last.dmgOut ?? 0, dmgIn: last.dmgIn ?? 0, coins: last.coins ?? 0,
    stats: (last.stats ?? []).join('/'), cam: (last.camTime ?? []).map(Math.round).join('/'),
    fps: snaps.length ? Math.round(snaps.reduce((a, s) => a + (s.fps ?? 0), 0) / snaps.length) : last.fps ?? 0,
    fpsMin: Math.min(...snaps.map(s => s.fpsMin ?? 999), last.fpsMin ?? 999),
    strangers: of('stranger').map(s => s.choice).join(' '), builds: of('build').map(b => b.what).join(', '),
    panels: of('panel').length, errors: of('error').length + of('pageError').length, truncated: !!d.truncated,
    _falls: of('fall'), _path: path, _strangers: of('stranger'), _errors: of('error').concat(of('pageError')), _stat: of('stat'), _ev: ev,
  };
});

const of2 = (r, t) => r._ev.filter(e => e.type === t).map(e => e.data ?? {});
const count = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
const table = (head, lines) => { const w = head.map((h, i) => Math.max(h.length, ...lines.map(l => String(l[i]).length))); return [head, ...lines].map(l => l.map((c, i) => String(c).padEnd(w[i])).join('  ')).join('\n'); };
const pct = (n, of) => of ? `${n} (${Math.round(100 * n / of)}%)` : '0';
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

const n = rows.length, out = [];
const loads = between.flatMap(b => b.data.events ?? []), loaded = loads.filter(e => e.type === 'loaded').length, loadFailed = loads.filter(e => e.type === 'loadFailed').length;
out.push(`Exile play records: ${n} runs from ${new Set(rows.map(r => r.player)).size} players${agents ? ' (agent runs included)' : ''}, ${between.length} events outside a run.`);
if (!n) out.push('No runs yet. Use --fetch=7 to download records; agent runs need --agents.');
else {
  out.push(`\nPage loads that finished: ${loaded}; that failed: ${loadFailed}; runs started: ${n}`);
  out.push('\nHow far runs got');
  const steps = [['started', () => true], ['placed a building', r => r.buildings > 0], ['founded the kingdom', r => r.founded], ['raid began', r => r.raid], ['raid won', r => r.raidWon],
    ['freed the witness', r => r.witness], ['brother beaten', r => r.brotherDown], ['took the crown', r => r.crowned || r.outcome.startsWith('won')], ['reign: season 4', r => r.season >= 4 || r.outcome.startsWith('reign-held')], ['held the kingdom', r => r.outcome.startsWith('reign-held')]];
  out.push(table(['step', 'runs'], steps.map(([name, f]) => [name, pct(rows.filter(f).length, n)])));
  out.push('\nOutcomes'); out.push(table(['outcome', 'runs'], count(rows, r => r.outcome)));
  const left = rows.filter(r => r.outcome === 'left');
  if (left.length) { out.push('\nWhere unfinished runs stopped (last snapshot; a snapshot is sent every 20 s)'); out.push(table(['phase', 'runs', 'median game seconds'], PHASES.filter(p => left.some(r => r.phase === p)).map(p => [p, left.filter(r => r.phase === p).length, median(left.filter(r => r.phase === p).map(r => r.gameT))]))); }
  const falls = rows.flatMap(r => r._falls);
  if (falls.length) { out.push(`\nFalls: ${falls.length}`); out.push(table(['phase', 'nearest enemy', 'falls'], count(falls, f => `${f.phase}|${f.near}`).map(([k, c]) => [...k.split('|'), c]))); }
  const str = rows.flatMap(r => r._strangers);
  if (str.length) { out.push('\nStranger choices'); out.push(table(['choice', 'times'], count(str, s => s.choice))); }
  const pet = rows.flatMap(r => of2(r, 'petition'));
  if (pet.length) { out.push('\nPetitions answered'); out.push(table(['who', 'answer', 'times'], count(pet, p => `${p.who}|${p.answer}`).map(([k, c]) => [...k.split('|'), c]))); }
  const cr = rows.flatMap(r => of2(r, 'crisis'));
  if (cr.length) { out.push('\nCrises'); out.push(table(['kind', 'times'], count(cr, c => c.kind))); }
  const st = rows.flatMap(r => r._stat);
  if (st.length) { out.push('\nStat points spent'); out.push(table(['stat', 'points'], count(st, s => s.stat))); }
  const builds = rows.flatMap(r => r.builds.split(', ').filter(Boolean));
  if (builds.length) { out.push('\nBuildings placed'); out.push(table(['building', 'times'], count(builds, b => b))); }
  const cam = [0, 1, 2].map(i => rows.reduce((a, r) => a + (+r.cam.split('/')[i] || 0), 0)), camAll = cam.reduce((a, b) => a + b, 0);
  if (camAll) out.push(`\nCamera time: follow ${Math.round(100 * cam[0] / camAll)}%, mouse ${Math.round(100 * cam[1] / camAll)}%, fixed ${Math.round(100 * cam[2] / camAll)}%`);
  out.push(`Combat per run (median): ${median(rows.map(r => r.swings))} swings, ${median(rows.map(r => r.hits))} that hit, ${median(rows.map(r => r.rolls))} rolls, ${median(rows.map(r => r.parries))} parries, ${median(rows.map(r => r.blocks))} blocks, ${median(rows.map(r => r.locks))} lock-ons, ${median(rows.map(r => r.mounts))} mounts`);
  out.push(`Frame rate: median ${median(rows.map(r => r.fps))}, lowest ${Math.min(...rows.map(r => r.fpsMin))}`);
  const errs = rows.flatMap(r => r._errors);
  if (errs.length) { out.push('\nErrors'); out.push(table(['message', 'times'], count(errs, e => String(e.msg).slice(0, 90)))); }
  if (between.length) { out.push('\nOutside a run (title screen, shop)'); out.push(table(['event', 'times'], count(between.flatMap(b => b.data.events ?? []), e => e.type + (e.data?.page ? ` ${e.data.page}` : e.data?.what ? ` ${e.data.what}` : '')))); }
  out.push('\nRuns');
  const cols = ['when', 'player', 'who', 'build', 'difficulty', 'touch', 'outcome', 'season', 'minutes', 'phase', 'level', 'falls', 'buildings', 'followers', 'kills', 'fps', 'strangers'];
  out.push(table(cols, rows.map(r => cols.map(c => r[c]))));
}
console.log(out.join('\n'));

const pub = Object.keys(rows[0] ?? {}).filter(k => !k.startsWith('_'));
const csv = opt('csv'); if (csv) { writeFileSync(csv, [pub.join(','), ...rows.map(r => pub.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n') + '\n'); console.log(`\nWrote ${csv}`); }
const html = opt('html');
if (html) {
  // The map: x across, z up the page from the camp (z 0) to the keep (z about 150).
  const X = x => 200 + x * 2.2, Z = z => 520 - z * 2.6, esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = rows.map(r => { const p = []; for (let i = 0; i + 1 < r._path.length; i += 2) p.push(`${X(r._path[i]).toFixed(0)},${Z(r._path[i + 1]).toFixed(0)}`); return p.length > 1 ? `<polyline points="${p.join(' ')}" fill="none" stroke="${r.who === 'agent' ? '#6aa0d8' : '#d9b24a'}" stroke-opacity=".55" stroke-width="1.5"/>` : ''; }).join('');
  const dots = rows.flatMap(r => r._falls).map(f => `<circle cx="${X(f.x)}" cy="${Z(f.z)}" r="5" fill="#d8504a"><title>fall at ${f.t} s, ${esc(f.phase)}, near ${esc(f.near)}</title></circle>`).join('');
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><title>Exile play records</title><style>body{font:14px/1.45 system-ui,sans-serif;background:#0e1418;color:#e8e4d8;margin:24px}pre{overflow:auto}svg{background:#172026;border-radius:8px}</style>
<h1>Exile play records</h1><p>Lines are where each run walked (a point every 5 s; gold a person, blue an agent). Red dots are falls. The camp is at the bottom, the keep at the top.</p>
<svg width="400" height="600" viewBox="0 0 400 600"><text x="200" y="${Z(0) + 28}" fill="#8a9" text-anchor="middle" font-size="12">camp</text><text x="200" y="${Z(150) - 14}" fill="#8a9" text-anchor="middle" font-size="12">keep</text>${lines}${dots}</svg>
<pre>${esc(out.join('\n'))}</pre>`);
  console.log(`Wrote ${html}`);
}
