// Room choice, kept apart from the Durable Object so the tests can drive it with a clock of their own.
const STALE = 45_000, PENDING = 5_000;

export function assign(rooms, prefix, cap, exclude, now) {
  for (const [name, r] of rooms) if (now - r.at > STALE) rooms.delete(name);
  let best = null, bestLoad = -1;
  for (const [name, r] of rooms) {
    r.pending = r.pending.filter(t => now - t < PENDING);
    const load = r.people + r.pending.length;
    // The fullest room with space wins: full rooms feel alive and need the fewest bots.
    if (load < cap && load > bestLoad && !exclude.includes(name)) { best = name; bestLoad = load; }
  }
  if (!best) {
    let n = 0;
    while (rooms.has(`${prefix}-${n}`) || exclude.includes(`${prefix}-${n}`)) n++;
    best = `${prefix}-${n}`;
    rooms.set(best, { people: 0, at: now, pending: [] });
  }
  rooms.get(best).pending.push(now);
  return best;
}
