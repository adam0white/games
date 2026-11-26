// Joins kit/lab.js run records into whole runs. Used by scripts/lab-mine.mjs and experiments/exile/telemetry.mjs.
//
// Two shapes arrive under format 'kit-lab/1':
//   parts (since 2026-11-26): every record of a run has data.part (0, 1, ...); the last has final: true and parts: n.
//     Each part holds only the game events and trace since the one before, so a run is all its parts in order.
//   one record per run (before): the run record when it ended, and sometimes an earlier copy sent when the page was
//     hidden (outcome null). The latest copy with an outcome wins, else the latest copy.
// joinRuns(records) takes any linked records (other kinds and other formats are ignored) and returns one record per
// run, shaped like the stored one (the final or latest record's envelope), with data.events and data.trace joined
// and data.joined = { parts, missing, complete, duplicates }.
export function joinRuns(records) {
  const groups = new Map();
  for (const r of records) {
    if (!r || r.kind !== 'run' || r.data?.format !== 'kit-lab/1' || r.data.outcome === 'between-runs') continue;
    const key = `${r.game}:${r.runId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const out = [];
  for (const list of groups.values()) {
    const parted = list.filter(r => Number.isInteger(r.data.part));
    if (!parted.length) {
      const sorted = [...list].sort((a, b) => a.at - b.at);
      const best = sorted.filter(r => r.data.outcome !== null).at(-1) ?? sorted.at(-1);
      out.push({ ...best, data: { ...best.data, trace: best.data.trace ?? [], joined: { parts: 1, missing: [], complete: best.data.outcome !== null, duplicates: sorted.length - 1, legacy: true } } });
      continue;
    }
    const byPart = new Map();
    let duplicates = 0;
    for (const r of parted) { if (byPart.has(r.data.part)) duplicates++; else byPart.set(r.data.part, r); }
    const parts = [...byPart.values()].sort((a, b) => a.data.part - b.data.part);
    const final = parts.find(r => r.data.final === true);
    const expected = final ? final.data.parts : Math.max(...parts.map(r => r.data.part)) + 1;
    const missing = [];
    for (let i = 0; i < expected; i++) if (!byPart.has(i)) missing.push(i);
    const last = final ?? parts.at(-1);
    out.push({
      ...last,
      data: {
        ...last.data,
        started: parts[0].data.started,
        start: parts[0].data.start ?? last.data.start,
        env: parts[0].data.env ?? last.data.env,
        events: parts.flatMap(r => r.data.events ?? []),
        trace: parts.flatMap(r => r.data.trace ?? []),
        truncated: parts.some(r => r.data.truncated) || undefined,
        joined: { parts: parts.length, missing, complete: !!final && missing.length === 0, duplicates },
      },
    });
  }
  return out.sort((a, b) => a.data.started - b.data.started);
}
