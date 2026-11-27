// A completed leg carries only its receipt forward. The URL fragment stays in the browser.
const UINT32_MAX = 0xffffffff;
const MAX_LEG = 100000;
const LEG_SECONDS = 60;

export function validName(name) {
  return typeof name === 'string' && Array.from(name).length <= 16 &&
    !/[^\p{L}0-9 _.\-]/u.test(name) && name === name.trim();
}

export function newChain(seed) {
  return { count: 0, flame: 76, total: 0, seed: seed >>> 0, carriers: [] };
}

function integer(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function validChain({ count, flame, total, seed, carriers }) {
  if (!integer(count, 1, UINT32_MAX) || !integer(flame, 1, 100) ||
      !integer(total, 0, count * MAX_LEG) || !integer(seed, 0, UINT32_MAX) ||
      !Array.isArray(carriers) || carriers.length !== Math.min(8, count)) return false;
  let visible = 0;
  for (const carrier of carriers) {
    if (!carrier || !validName(carrier.name) || !integer(carrier.distance, 0, MAX_LEG)) return false;
    visible += carrier.distance;
  }
  return visible <= total && total - visible <= (count - carriers.length) * MAX_LEG;
}

export function encodeLink(chain) {
  if (!validChain(chain)) throw new RangeError('Invalid flame receipt');
  const { count, flame, total, seed, carriers } = chain;
  const rows = carriers.map(({ name, distance }) => distance + ':' + encodeURIComponent(name));
  return '#f=' + [1, count, flame, total, seed, ...rows].join('~');
}

export function decodeLink(hash) {
  if (typeof hash !== 'string' || hash.length > 2048 || !hash.startsWith('#f=1~')) return null;
  const [version, count, flame, total, seed, ...rows] = hash.slice(3).split('~');
  if (version !== '1' || rows.length < 1 || rows.length > 8) return null;
  try {
    const carriers = rows.map(row => {
      const [distance, name] = row.split(':');
      return { name: decodeURIComponent(name), distance: Number(distance) };
    });
    const chain = { count: Number(count), flame: Number(flame), total: Number(total), seed: Number(seed), carriers };
    // Require the one canonical spelling, including separators, escapes and integer notation.
    return validChain(chain) && encodeLink(chain) === hash ? chain : null;
  } catch {
    return null;
  }
}

export function addCarrier(chain, name, distance, flame, seed) {
  const meters = Math.round(distance);
  const carriers = [...chain.carriers, { name, distance: meters }].slice(-8);
  // A forged but in-range receipt at the format limit must still be playable.
  const count = Math.min(UINT32_MAX, chain.count + 1);
  const maximumTotal = (count - carriers.length) * MAX_LEG +
    carriers.reduce((sum, carrier) => sum + carrier.distance, 0);
  const next = {
    count, total: Math.min(maximumTotal, chain.total + meters), flame: Math.max(1, Math.round(flame)),
    seed, carriers
  };
  if (!validChain(next)) throw new RangeError('Cannot add this carrier');
  return next;
}

function randomFrom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(chain) {
  const random = randomFrom(chain.seed);
  const items = [{ at: 2.2, x: 0, kind: 'ember', used: false }];
  for (let at = 6; at < 58; at += 4.8 + random() * 1.5) {
    items.push({ at, x: (random() - 0.5) * 1.52, kind: 'ember', used: false });
  }
  for (let at = 12 + random() * 2; at < 58; at += 3.2 + random() * 2.5) {
    let x = (random() - 0.5) * 1.62;
    // Adjacent rocks make a gate around an ember instead of hiding it.
    const ember = items.find(item => item.kind === 'ember' && Math.abs(item.at - at) < 0.85);
    if (ember && Math.abs(ember.x - x) < 0.3) x = ember.x + (ember.x < 0 ? 0.32 : -0.32);
    if (at < 21 && Math.abs(x) < 0.18) x = x < 0 ? -0.22 : 0.22;
    items.push({ at, x, kind: 'rock', used: false });
  }
  items.sort((a, b) => a.at - b.at);
  return {
    elapsed: 0, progress: 0, distance: 0, x: 0, flame: chain.flame, speed: 28 + random() * 6,
    items, nextItem: 0, lastHit: -100, lastEmber: -100, outcome: null
  };
}

export function step(run, dt, targetX) {
  const events = [];
  if (run.outcome || !Number.isFinite(dt) || dt <= 0 || !Number.isFinite(targetX)) return events;
  const delta = Math.min(0.1, dt, LEG_SECONDS - run.elapsed);
  const target = Math.max(-1, Math.min(1, targetX));
  run.x += Math.sign(target - run.x) * Math.min(Math.abs(target - run.x), delta * 1.65);
  run.elapsed += delta;
  run.progress = run.elapsed / LEG_SECONDS;
  run.distance = run.elapsed * run.speed;
  if (run.elapsed > 3) run.flame -= delta * (run.elapsed < 21 ? 0.85 : 1.8);

  function hit(kind) {
    if (run.elapsed - run.lastHit < 1.3) return;
    run.lastHit = run.elapsed;
    run.flame -= kind === 'bank' ? 8 : 12;
    events.push({ type: 'hit', kind });
  }

  while (run.nextItem < run.items.length && run.items[run.nextItem].at <= run.elapsed) {
    const item = run.items[run.nextItem++];
    if (Math.abs(item.x - run.x) > (item.kind === 'rock' ? 0.125 : 0.17)) continue;
    item.used = true;
    if (item.kind === 'rock') hit('rock');
    else {
      run.flame = Math.min(100, run.flame + 22);
      run.lastEmber = run.elapsed;
      events.push({ type: 'ember', kind: 'ember' });
    }
  }
  if (Math.abs(run.x) >= 0.94) hit('bank');
  run.flame = Math.max(0, run.flame);
  if (run.flame === 0) run.outcome = 'drop';
  else if (run.elapsed >= LEG_SECONDS) run.outcome = 'handoff';
  return events;
}
