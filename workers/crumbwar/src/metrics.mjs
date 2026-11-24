// Hourly totals, kept apart from the Durable Objects so the tests can drive them. Numbers only: no address, no
// name, no room member. See DECISIONS.md, "Metrics read path".

// Counters a room keeps in its stats and sends as differences once a minute. Kick reasons:
//   kickIdle (4003, no input for 90 s), kickNoPing (4004, no ping for 8 s), kickBehind (4004, pings arrive but
//   name a tick 8 s old), kickText (1008, a text message), kickSize (1008, over 8 bytes), kickRate (1008, over 30
//   a second), kickType (1008, an unknown message), sendFailed (a send threw; the socket was dropped).
// Other ends of a socket: closedByClient, socketErrors. Joins a room refused: refusedFull, refusedIp,
// refusedGone (a resume the room no longer knew; the Worker then asks the directory), refusedProtocol.
export const ROOM_COUNTS = ['joins', 'kickIdle', 'kickNoPing', 'kickBehind', 'kickText', 'kickSize', 'kickRate', 'kickType', 'sendFailed',
  'closedByClient', 'socketErrors', 'refusedFull', 'refusedIp', 'refusedGone', 'refusedProtocol'];
// Counted by the Worker before any room is asked: wrong origin, over the join rate limit, no room after three
// tries, and a page of another version that was told to reload.
export const WORKER_COUNTS = ['refusedForbidden', 'refusedLimited', 'refusedBusy', 'refusedStalePage'];
// Keys that start with `peak` keep the largest value in the hour; every other key is a sum.
export const isPeak = key => key.startsWith('peak');
export const HOUR = 3600_000, KEEP_HOURS = 14 * 24;
export const hourOf = ms => Math.floor(ms / HOUR) * HOUR;

// What changed since the last report, with zeros left out. `last` is updated in place.
export function delta(now, last, keys = ROOM_COUNTS) {
  const d = {};
  for (const k of keys) { const v = (now[k] || 0) - (last[k] || 0); if (v > 0) d[k] = v; last[k] = now[k] || 0; }
  return d;
}

// Adds one report into an hour's totals (a plain object).
export function fold(totals, d) {
  for (const [k, v] of Object.entries(d || {})) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || !/^[a-zA-Z]{1,24}$/.test(k)) continue;
    totals[k] = isPeak(k) ? Math.max(totals[k] || 0, v) : (totals[k] || 0) + v;
  }
  return totals;
}

// Rows of (hour, key, v) from several regions, to one list per region, newest hour first, and the window's totals.
export function summarize(byRegion) {
  const out = { regions: {}, totals: {} };
  for (const [region, rows] of Object.entries(byRegion)) {
    const hours = new Map();
    for (const { hour, key, v } of rows) {
      fold(hours.get(hour) ?? hours.set(hour, {}).get(hour), { [key]: v });
      if (region !== 'lt') fold(out.totals, { [key]: v });
    }
    if (hours.size) out.regions[region] = [...hours].sort((a, b) => b[0] - a[0]).map(([hour, t]) => ({ hour: new Date(hour).toISOString(), ...t }));
  }
  return out;
}
