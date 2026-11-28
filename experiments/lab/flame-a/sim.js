// A completed leg carries only its receipt forward. The URL fragment stays in the browser.
const UINT32_MAX = 0xffffffff;
// Even a 1% flame must reach the bank before its first possible drop.
const MIN_LEG = 16;
const MAX_LEG = 2040; // 60 seconds at up to 34 metres per second.
const LEG_SECONDS = 60;
const carrierDifficulties = ['gentle', 'steady', 'fierce'];

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
    if (!carrier || !validName(carrier.name) || !integer(carrier.distance, MIN_LEG, MAX_LEG)) return false;
    if (carrier.difficulty !== undefined && !carrierDifficulties.includes(carrier.difficulty)) return false;
    visible += carrier.distance;
  }
  const hidden = count - carriers.length;
  return integer(total - visible, hidden * MIN_LEG, hidden * MAX_LEG);
}

function checksum(payload) {
  let hash = 0x811c9dc5;
  for (const character of 'river.coals.v2/' + payload) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function encodeLink(chain) {
  if (!validChain(chain)) throw new RangeError('Invalid flame receipt');
  const { count, flame, total, seed, carriers } = chain;
  const rows = carriers.map(({ name, distance, difficulty }) =>
    distance + (difficulty ? '-' + difficulty : '') + ':' + encodeURIComponent(name));
  const payload = [count, flame, total, seed, ...rows].join('~');
  return '#f=2~' + checksum(payload) + '~' + payload;
}

export function decodeLink(hash) {
  if (typeof hash !== 'string' || hash.length > 2048 || !hash.startsWith('#f=')) return null;
  const fields = hash.slice(3).split('~');
  const version = fields.shift();
  if (version !== '1' && version !== '2') return null;
  const signature = version === '2' ? fields.shift() : null;
  if (fields.length < 5 || fields.length > 12) return null;
  // Chat clients sometimes trim the final colon from an anonymous carrier.
  if (/^[0-9]+(?:-[a-z]+)?$/.test(fields.at(-1))) fields[fields.length - 1] += ':';
  if (version === '2' && checksum(fields.join('~')) !== signature) return null;
  const [count, flame, total, seed, ...rows] = fields;
  if ([count, flame, total, seed].some(value => String(Number(value)) !== value || !/^[0-9]+$/.test(value))) return null;
  if (!integer(Number(count), rows.length, UINT32_MAX)) return null;
  try {
    const carriers = rows.map(row => {
      const match = /^([0-9]+)(?:-([a-z]+))?:(.*)$/u.exec(row);
      if (!match || match[0] !== row) throw new Error('Invalid carrier row');
      const [, meters, difficulty, encodedName] = match;
      const name = decodeURIComponent(encodedName);
      const distance = Number(meters);
      if (String(distance) !== meters || encodeURIComponent(name) !== encodedName)
        throw new Error('Noncanonical carrier');
      if (difficulty === undefined) return { name, distance };
      if (version !== '2' || !carrierDifficulties.includes(difficulty))
        throw new Error('Invalid difficulty mark');
      return { name, distance, difficulty };
    });
    const chain = { count: Number(count), flame: Number(flame), total: Number(total), seed: Number(seed), carriers };
    if (version === '1') {
      const hiddenMeters = chain.total - carriers.reduce((sum, c) => sum + c.distance, 0);
      const possibleHidden = rows.length === 8 ? Math.floor(hiddenMeters / MIN_LEG) : 0;
      chain.count = Math.min(chain.count, rows.length + possibleHidden);
    }
    return validChain(chain) ? chain : null;
  } catch {
    return null;
  }
}

export function addCarrier(chain, name, distance, flame, seed, difficulty) {
  const meters = Math.round(distance);
  const carrier = { name, distance: meters };
  if (difficulty !== undefined) carrier.difficulty = difficulty;
  const carriers = [...chain.carriers, carrier].slice(-8);
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

const riverRules = {
  gentle: { emberOffset: 0.19, emberSpread: 0.62, rockSpacing: 7.2, shelter: 35,
    earlyDrain: 0.5, lateDrain: 5.3, warmth: 30, minSpeed: 28 },
  steady: { emberOffset: 0.23, emberSpread: 1.06, rockSpacing: 3.2, shelter: 21,
    earlyDrain: 1.1, lateDrain: 4.65, warmth: 22, minSpeed: 28 },
  fierce: { emberOffset: 0.48, emberSpread: 0.78, rockSpacing: 3.2, shelter: 12,
    earlyDrain: 1.1, lateDrain: 7.2, warmth: 38, minSpeed: 32 }
};

export function createRun(chain, difficulty = 'steady') {
  const rules = riverRules[difficulty];
  const random = randomFrom(chain.seed);
  const pairRandom = randomFrom(chain.seed ^ 0x764fb097);
  const items = [{ at: 2.2, x: 0, kind: 'ember', used: false }];
  for (let at = 6; at < 58; at += 4.8 + random() * 1.5) {
    const side = random() - 0.5;
    items.push({ at, x: (side < 0 ? -1 : 1) * (rules.emberOffset + Math.abs(side) * rules.emberSpread), kind: 'ember', used: false });
  }
  for (let at = 12 + random() * 2; at < 58; at += rules.rockSpacing + random() * 2.5) {
    let x = (random() - 0.5) * 1.62;
    // Adjacent rocks make a gate around an ember instead of hiding it.
    const ember = items.find(item => item.kind === 'ember' && Math.abs(item.at - at) < 0.85);
    if (ember && Math.abs(ember.x - x) < 0.3) x = ember.x + (ember.x < 0 ? 0.32 : -0.32);
    if (at < rules.shelter && Math.abs(x) < 0.18) x = x < 0 ? -0.22 : 0.22;
    items.push({ at, x, kind: 'rock', used: false });
    if (difficulty === 'fierce') {
      // The second rock guards the other side of the channel.
      const otherBank = x < 0 ? 1 : -1;
      items.push({ at: at + 0.65, x: otherBank * (0.42 + pairRandom() * 0.45), kind: 'rock', used: false });
    }
  }
  items.sort((a, b) => a.at - b.at);
  return {
    elapsed: 0, progress: 0, distance: 0, x: 0, flame: chain.flame, difficulty,
    speed: rules.minSpeed + random() * (34 - rules.minSpeed),
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
  const rules = riverRules[run.difficulty];
  if (run.elapsed > 3) run.flame -= delta * (run.elapsed < rules.shelter ? rules.earlyDrain : rules.lateDrain);

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
      // The first ember lights the lantern. The sheltered reach holds small coals.
      const warmth = item.at <= 3 ? 22 : item.at < rules.shelter ? 10 : rules.warmth;
      run.flame = Math.min(100, run.flame + warmth);
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
