// Room choice, kept apart from the Durable Object so the tests can drive it with a clock of their own.
import { LEGACY_PROTO } from '../public/crumbwar/shared/version.js';
const STALE = 45_000, PENDING = 5_000;

// `proto` is the asking Worker's protocol. A room that reports another one (old code still running after a deploy)
// is not offered to anyone new; its players finish there, and it leaves the list when it reports that it is empty.
// A room that never said is from before rooms reported it, so it ran LEGACY_PROTO. Without `proto`, no filter.
export function assign(rooms, prefix, cap, exclude, now, proto) {
  for (const [name, r] of rooms) if (now - r.at > STALE) rooms.delete(name);
  let best = null, bestLoad = -1;
  for (const [name, r] of rooms) {
    r.pending = r.pending.filter(t => now - t < PENDING);
    const load = r.people + r.pending.length;
    // The fullest room with space wins: full rooms feel alive and need the fewest bots.
    if (load < cap && load > bestLoad && !exclude.includes(name) && (proto === undefined || (r.proto ?? LEGACY_PROTO) === proto)) { best = name; bestLoad = load; }
  }
  if (!best) {
    let n = 0;
    while (rooms.has(`${prefix}-${n}`) || exclude.includes(`${prefix}-${n}`)) n++;
    best = `${prefix}-${n}`;
    rooms.set(best, { people: 0, at: now, pending: [], proto });
  }
  rooms.get(best).pending.push(now);
  return best;
}
