// A beat is a still camera view. The page interpolates the walk between beats.
export const SPECIES = ['rabbit', 'fox', 'bear', 'owl', 'frog', 'cat', 'mouse', 'hedgehog'];
export const PLACES = ['kitchen', 'parlor', 'garden', 'studio', 'porch', 'attic'];
export const CRIMES = ['pie', 'fountain', 'hat'];
export const CRIME_ROOM = [0, 2, 1];
export const CLOCK_START = 7 * 60;
export const CLOCK_STEP = 5;

function night(chapter, count, rooms, beats, crime, features = {}) {
  return {
    chapter, count, rooms, beats, crime, masks: false, overlap: false, blackout: false,
    accomplice: false, staggered: false, tutorial: null, ...features,
  };
}

// Each introductory case changes one part of the investigation. The following
// cases repeat the idea with different premises before the mechanics combine.
export const CASES = [
  night(1, 6, 3, 5, 0, { tutorial: 'basics' }),
  night(1, 6, 3, 5, 1),
  night(1, 6, 4, 5, 2, { tutorial: 'rooms' }),
  night(1, 6, 4, 6, 0),
  night(1, 7, 4, 6, 1, { tutorial: 'cast' }),
  night(1, 7, 4, 7, 2, { staggered: true, tutorial: 'times' }),
  night(1, 7, 5, 7, 0, { staggered: true }),
  night(2, 7, 5, 8, 2, { masks: true, tutorial: 'masks' }),
  night(2, 7, 5, 9, 1, { masks: true, staggered: true }),
  night(2, 7, 5, 9, 0, { overlap: true, tutorial: 'overlap' }),
  night(2, 8, 5, 9, 2, { overlap: true, staggered: true }),
  night(2, 8, 5, 9, 1, { blackout: true, tutorial: 'blackout' }),
  night(2, 8, 5, 10, 0, { blackout: true, staggered: true }),
  night(2, 8, 6, 10, 2, { masks: true, blackout: true, staggered: true }),
  night(3, 8, 6, 10, 0, { accomplice: true, tutorial: 'accomplice' }),
  night(3, 8, 6, 10, 1, { accomplice: true, overlap: true, staggered: true }),
  night(3, 8, 6, 10, 2, { masks: true, accomplice: true, staggered: true }),
  night(3, 8, 6, 11, 0, { overlap: true, blackout: true, staggered: true }),
  night(3, 8, 6, 11, 1, { masks: true, overlap: true, accomplice: true, staggered: true }),
  night(3, 8, 6, 11, 2, { blackout: true, overlap: true, accomplice: true, staggered: true }),
  night(3, 8, 6, 12, 0, { masks: true, overlap: true, blackout: true, accomplice: true, staggered: true }),
];

export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 0x100000000;
  };
}

function shuffle(items, draw) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(draw() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const range = size => Array.from({ length: size }, (_, i) => i);
const pick = (list, draw) => list[Math.floor(draw() * list.length)];

export function createCase({ seed = 32342, level = 1, culpritOverride, crimeOverride } = {}) {
  const spec = CASES[level - 1];
  if (!spec) throw new RangeError('Unknown case');
  const draw = random((seed >>> 0) ^ Math.imul(level, 0x85ebca6b));
  const crime = crimeOverride ?? spec.crime;
  const rooms = range(spec.rooms);
  const ids = range(spec.count);
  const crimeRoom = CRIME_ROOM[crime];
  const otherRooms = rooms.filter(room => room !== crimeRoom);
  const species = shuffle(SPECIES, draw);
  const signatures = shuffle(range(SPECIES.length), draw);
  const firstClaim = spec.masks || spec.overlap || spec.blackout ? 5 : 2;
  const lastClaim = spec.beats - 2 - Number(spec.accomplice);
  const possibleBeats = range(lastClaim - firstClaim + 1).map(i => i + firstClaim);
  const times = spec.staggered ? shuffle(possibleBeats, draw) : [pick(possibleBeats, draw)];
  const cycle = ids.map((_, i) => times[i % times.length]);
  const claimBeats = spec.staggered ? shuffle(cycle, draw) : cycle;
  // Schedule statements before choosing the liar. Claims never mention the
  // crime room. A lie can replace one position without changing any claim.
  const cast = ids.map(id => ({
    id, species: species[id], sound: signatures[id],
    claim: { beat: claimBeats[id], room: null },
  }));
  for (const beat of possibleBeats) {
    const bags = shuffle(otherRooms.flatMap(room => [room, room, room]), draw);
    for (const person of cast.filter(person => person.claim.beat === beat)) {
      person.claim.room = bags.pop();
    }
  }
  const opening = shuffle(ids, draw).map(i => i % rooms.length);
  const chosen = pick(ids, draw);
  const culprit = culpritOverride ?? chosen;
  const incident = cast[culprit].claim.beat;
  const others = shuffle(ids.filter(id => id !== culprit), draw);
  const bystander = spec.staggered ? others.find(id => cast[id].claim.beat !== incident) : null;
  const partner = others[0];
  const carrier = spec.accomplice ? others[1] : null;
  const blackoutBeat = spec.blackout ? incident : null;
  const exchangeBeat = spec.masks ? 4 : null;
  const carryBeat = spec.accomplice ? incident + 1 : null;
  const masked = [culprit, partner];
  const overlapping = spec.masks ? others.slice(1, 3) : [culprit, partner];
  const maskKinds = shuffle(range(4), draw).slice(0, 2);
  const frames = [];

  for (let beat = 0; beat < spec.beats; beat++) {
    const positions = Array(spec.count).fill(null);
    if (beat === 0) positions.splice(0, spec.count, ...opening);
    for (const { id, claim } of cast) {
      if (claim.beat === beat) positions[id] = id === culprit ? crimeRoom : claim.room;
    }
    if (beat === incident && bystander != null) positions[bystander] = crimeRoom;
    // The two costumes are put on without moving. Their owners later meet
    // and exchange them without changing positions at the exchange beat.
    if (spec.masks && beat === 2) {
      for (const id of masked) positions[id] = frames[1][id].room;
    }
    if (spec.masks && (beat === 3 || beat === exchangeBeat)) {
      const room = beat === exchangeBeat ? frames[beat - 1][culprit].room : pick(rooms, draw);
      for (const id of masked) positions[id] = room;
    }
    if (spec.overlap && (beat === 3 || beat === 4)) {
      const previous = beat === 4 ? frames[3][overlapping[0]].room : null;
      const occupied = spec.masks ? positions[culprit] : null;
      const room = pick(rooms.filter(place => place !== previous && place !== occupied), draw);
      for (const id of overlapping) positions[id] = room;
    }
    if (beat === carryBeat && positions[carrier] === null) positions[carrier] = crimeRoom;
    for (const id of ids) {
      if (positions[id] !== null) continue;
      const uncrowded = rooms.filter(room => positions.filter(pos => pos === room).length < 3);
      positions[id] = pick(uncrowded, draw);
    }

    const slots = Array(spec.count).fill(null);
    if (spec.masks && (beat === 2 || beat === exchangeBeat)) {
      for (const id of masked) slots[id] = frames[beat - 1][id].slot;
    }
    frames.push(positions.map((room, id) => {
      if (slots[id] === null) {
        const used = slots.filter((_, other) => positions[other] === room);
        slots[id] = range(3).find(slot => !used.includes(slot));
      }
      const member = masked.indexOf(id);
      const mask = spec.masks && beat >= 2 && member >= 0
        ? maskKinds[beat < exchangeBeat ? member : 1 - member]
        : null;
      return { room, mask, slot: slots[id] };
    }));
  }

  const traces = [{ room: crimeRoom, kind: crime === 0 ? 'crumbs' : crime === 1 ? 'splash' : 'feather', beat: incident }];
  if (spec.overlap) traces.push({ room: frames[4][overlapping[0]].room, kind: 'prints', beat: 4 });
  if (spec.accomplice) traces.push({ room: frames[carryBeat][carrier].room, kind: 'umbrella', beat: carryBeat + 1 });
  return { spec, level, seed, cast, culprit, crime, crimeRoom, incident, blackoutBeat,
    carryBeat, carrier, exchangeBeat, maskKinds, frames, traces, beatCount: spec.beats };
}

export function dossiers(caseData) {
  return caseData.cast.map(({ id, species, sound, claim }) => ({ id, species, sound, claim: { ...claim } }));
}

export function observe(c, beat) {
  const blackout = beat === c.blackoutBeat;
  const frame = c.frames[beat];
  const actors = blackout ? [] : frame.map(({ room, slot, mask }, id) => ({
    room, slot, portrait: mask === null ? id : null, mask,
    carry: beat === c.carryBeat && id === c.carrier,
  }));
  const sounds = blackout ? frame.map(({ room, slot }, id) => ({
    room, slot, sound: c.cast[id].sound,
  })).sort((a, b) => a.room - b.room || a.slot - b.slot) : [];
  // Once masked, enumeration is spatial. Array position is public and cannot
  // reveal the underlying identity.
  actors.sort((a, b) => a.room - b.room || a.slot - b.slot);
  return { beat, actors, sounds, blackout, exchange: beat === c.exchangeBeat ? [...c.maskKinds] : null,
    incident: beat >= c.incident, evidence: c.traces.filter(trace => trace.beat <= beat) };
}

export const freshRun = () => ({ stars: 3, rejected: [], outcome: null });

export function accuse(c, run, suspect) {
  if (run.outcome || !Number.isInteger(suspect) || !c.cast[suspect] || run.rejected.includes(suspect)) return run;
  if (suspect === c.culprit) return { ...run, outcome: 'solved' };
  const stars = run.stars - 1;
  return { stars, rejected: [...run.rejected, suspect], outcome: stars ? null : 'wrong' };
}

export const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);
const dayNumber = day => Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);

export function dailyCase(day) {
  const date = dayNumber(day);
  const seed = Math.imul(date, 0x9e3779b1) >>> 0;
  const level = 16 + ((date % 6 + 6) % 6);
  return createCase({ seed, level, crimeOverride: (date % 3 + 3) % 3 });
}

export function dailyWin(last, day, streak) {
  if (last && day <= last) return { last, streak };
  const next = last && dayNumber(day) - dayNumber(last) === 1 ? streak + 1 : 1;
  return { last: day, streak: next };
}
