export const SPECIES = ['rabbit', 'fox', 'bear', 'owl', 'frog', 'cat', 'mouse', 'hedgehog'];
export const PLACES = ['house', 'bakery', 'ship', 'greenhouse'];
// Crimes 0–2 belong to the house, 3 and 6 to the bakery, 4 and 7 to the ship,
// 5 and 8 to the greenhouse. Each site loses a second item from another room.
export const CRIME_ROOM = [0, 2, 1, 0, 4, 2, 4, 1, 3];
export const CLOCK_START = 7 * 60;
export const CLOCK_STEP = 5;
export const CHAPTER_TWO_END = 14;
// The case that retires the claimed-room outline, and the carrier lesson.
export const OUTLINE_LESSON = 7;
export const CARRIER_LESSON = 29;

function chapter(chapter, site, count, beats, variants) {
  return variants.map(([crime, features]) => ({
    chapter, site, count, beats, crime, rooms: 5, ...features,
  }));
}

export const CASES = [
  ...chapter(1, 0, 6, 6, [
    [0, { tutorial: 'basics', rooms: 3 }], [1, { rooms: 3 }],
    [2, { tutorial: 'compare' }], [0], [1], [2], [0, { beats: 7, tutorial: 'outline' }],
  ]),
  ...chapter(2, 1, 6, 8, [
    [3, { staggered: true, tutorial: 'times' }], [3, { staggered: true }],
    [6, { staggered: true, beats: 9 }], [3, { staggered: true, count: 7 }],
    [3, { twoMarks: true, count: 7, rooms: 6 }], [6, { staggered: true, beats: 10 }],
    [3, { twoMarks: true, count: 8 }],
  ]),
  ...chapter(3, 2, 6, 9, [
    [4, { masks: true, tutorial: 'masks' }], [4, { masks: true }],
    [7, { masks: true, count: 7 }], [4, { masks: true, staggered: true }],
    [4, { masks: true, staggered: true, rooms: 6 }],
    [7, { masks: true, staggered: true, count: 8 }],
    [4, { masks: true, staggered: true, count: 8, beats: 10 }],
  ]),
  ...chapter(4, 3, 7, 9, [
    [5, { blackout: true, tutorial: 'blackout' }], [5, { blackout: true, floors: true, tutorial: 'floors' }],
    [8, { blackout: true, count: 8 }], [5, { blackout: true, staggered: true }],
    [8, { blackout: true, floors: true, rooms: 6 }],
    [5, { blackout: true, masks: true }], [5, { blackout: true, masks: true, staggered: true, beats: 11 }],
  ]),
  ...chapter(5, 0, 8, 10, [
    [0, { carrier: true, tutorial: 'carrier' }], [3, { carrier: true, twoMarks: true, site: 1 }],
    [7, { carrier: true, staggered: true, site: 2 }], [5, { carrier: true, masks: true, site: 3 }],
    [1, { carrier: true, blackout: true, staggered: true }],
    [6, { carrier: true, masks: true, staggered: true, site: 1, rooms: 6 }],
    [4, { carrier: true, masks: true, blackout: true, staggered: true, site: 2, beats: 11, rooms: 6 }],
    [8, { carrier: true, masks: true, blackout: true, staggered: true, site: 3, beats: 12, rooms: 6 }],
  ]),
];

// Rooms fill rows of two (four rooms or fewer) or three, top floor first.
export const roomColumns = count => count <= 4 ? 2 : 3;
export const floorOf = (count, room) => Math.floor(room / roomColumns(count));

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

// Recast two portraits in the fixed opening. Keep the actor ids, evidence
// and random draws identical when revisiting a previously completed case.
const campaignSeed = 32342;
const openingCastSwaps = { 4: ['owl', 'rabbit'], 6: ['owl', 'bear'] };

const range = size => Array.from({ length: size }, (_, i) => i);
const pick = (list, draw) => list[Math.floor(draw() * list.length)];

export function createCase({ seed = campaignSeed, level = 1, culpritOverride, flipRooms = [], hard = false } = {}) {
  const base = CASES[level - 1];
  if (!base) throw new RangeError('Unknown case');
  const spec = hard ? {
    ...base, count: 8, rooms: 6, beats: 12, masks: true, blackout: true, staggered: true, carrier: true,
    twoMarks: false, floors: false,
  } : base;
  const tutorial = level < 3 && !hard;
  const draw = random((seed >>> 0) ^ Math.imul(level, 0x85ebca6b));
  // Streams for the later mechanics. Their draws never shift the main stream.
  const salted = salt => random((seed >>> 0) ^ Math.imul(level, 0x165667b1) ^ salt);
  const markDraw = salted(0x2f6b3c1d);
  const trailDraw = salted(0x5bd1e995);
  const { crime } = spec;
  const rooms = range(spec.rooms);
  const ids = range(spec.count);
  const crimeRoom = CRIME_ROOM[crime];
  let otherRooms = shuffle(rooms.filter(room => room !== crimeRoom), draw);
  if (spec.floors) {
    // Each suspect's two possible rooms sit on different floors, so a sound
    // that only places a suspect on a floor still exposes the lie.
    const [top, bottom] = [0, 1].map(floor => otherRooms.filter(room => floorOf(spec.rooms, room) === floor));
    otherRooms = [top[0], bottom[0], top[1], bottom[1]];
  }
  const species = shuffle(SPECIES, draw);
  const swap = seed === campaignSeed && openingCastSwaps[level];
  if (swap) {
    const [a, b] = swap.map(face => species.indexOf(face));
    [species[a], species[b]] = [species[b], species[a]];
  }
  const signatures = shuffle(range(SPECIES.length), draw);
  const incident = tutorial ? 2 : 1;
  const shutterBeat = tutorial ? null : incident;
  const exchangeBeat = spec.masks ? 5 : null;
  const carryBeat = spec.carrier ? 3 : null;
  const blackoutBeat = spec.blackout ? 6 : null;
  const firstClaim = tutorial ? incident : spec.blackout ? blackoutBeat : spec.masks ? 6 : 3;
  const choices = range(spec.beats - firstClaim - 1).map(i => firstClaim + i);
  const beats = spec.staggered ? shuffle(ids.map(id => choices[id % choices.length]), draw) : [];
  const commonBeat = pick(choices, draw);
  const groups = shuffle(ids, draw);
  // A two-mark case asks every suspect about two clock marks, the same two for all.
  const secondBeat = spec.twoMarks ? pick(choices.filter(beat => beat !== commonBeat), markDraw) : null;
  const [beatA, beatB] = spec.twoMarks ? [commonBeat, secondBeat].sort((a, b) => a - b) : [commonBeat, null];
  // The mark each suspect would lie about. It is fixed per suspect, so the same
  // dossiers still admit every culprit when the proof flips that mark's room.
  const lieMark = ids.map(() => spec.twoMarks ? Number(markDraw() >= .5) : 0);

  // Draw each observed room independently of the culprit. Each suspect has
  // two possible alibi rooms. Flipping one fair room bit changes a truthful
  // statement into a lie without changing the distribution of the dossiers.
  const statements = ids.map(id => {
    const group = groups.indexOf(id) % 2 * 2;
    const pair = tutorial ? otherRooms : otherRooms.slice(group, group + 2);
    const flip = Number(flipRooms.includes(id));
    const bit = (tutorial ? groups.indexOf(id) % 2 : Number(draw() >= .5)) ^ (lieMark[id] === 0 ? flip : 0);
    const marks = [{ beat: spec.staggered ? beats[id] : spec.blackout || tutorial ? firstClaim : beatA, bit }];
    if (spec.twoMarks) marks.push({ beat: beatB, bit: Number(markDraw() >= .5) ^ (lieMark[id] === 1 ? flip : 0) });
    return { pair, marks };
  });
  // A separate stream prevents changes in the replay generator or evidence
  // choices from advancing the draw that selects the culprit. Mask and carrier
  // cases pick the liar after the tape exists.
  const culpritDraw = random((seed >>> 0) ^ Math.imul(level, 0x27d4eb2d) ^ 0x94d049bb);
  const maskRule = spec.masks && spec.tutorial !== 'masks' && !hard;
  const late = maskRule || spec.carrier;
  let culprit = culpritOverride ?? (late ? null : pick(ids, culpritDraw));
  const order = shuffle(ids, draw);
  const exchanged = spec.masks ? order.slice(0, 2) : [];
  const masks = Array(spec.count).fill(null);
  if (spec.masks) {
    const shapes = shuffle(range(8), draw);
    const wearers = hard ? order : order.slice(0, spec.staggered ? 4 : 2);
    for (const [index, id] of wearers.entries()) masks[id] = shapes[index];
  }
  const maskKinds = exchanged.map(id => masks[id]);
  const frames = [];
  let carrier = null;
  let trail = null;

  for (let beat = 0; beat < spec.beats; beat++) {
    const positions = Array(spec.count).fill(null);
    const slots = Array(spec.count).fill(null);
    for (const id of ids) {
      const { pair, marks } = statements[id];
      for (const { beat: statementBeat, bit } of marks) {
        if (statementBeat === beat) positions[id] = tutorial && id === culprit ? crimeRoom : pair[bit];
      }
    }
    if (spec.masks && (beat === 3 || beat === exchangeBeat)) {
      for (const id of ids) ({ room: positions[id], slot: slots[id] } = frames[beat - 1][id]);
    }
    if (spec.masks && beat === 4) {
      const meeting = pick(otherRooms, draw);
      for (const id of exchanged) positions[id] = meeting;
    }
    const occupancy = rooms.map(room => positions.filter(position => position === room).length);
    for (const id of ids) {
      if (positions[id] !== null) continue;
      const open = rooms.filter(room => occupancy[room] < 3);
      const previous = frames.at(-1)?.[id].room;
      const away = open.filter(room => room !== previous);
      const room = pick(away.length && (beat === 2 || draw() < .7) ? away : open, draw);
      positions[id] = room;
      occupancy[room]++;
    }
    if (spec.carrier && beat === carryBeat - 1) {
      // The carrier is handed the item at the next mark by someone who stands
      // with them now. Choose the busiest room from the tape alone and fill it
      // to four, so the trail leaves three suspects and still names nobody.
      const counts = rooms.map(room => positions.filter(position => position === room).length);
      const most = Math.max(...counts);
      const room = pick(rooms.filter(candidate => counts[candidate] === most), trailDraw);
      for (let n = most; n < 4; n++) positions[pick(ids.filter(id => positions[id] !== room), trailDraw)] = room;
      carrier = pick(ids.filter(id => positions[id] === room), trailDraw);
      trail = { beat, room };
    }
    frames.push(positions.map((room, id) => {
      if (slots[id] === null) {
        const used = slots.filter((_, other) => positions[other] === room);
        slots[id] = range(4).find(slot => !used.includes(slot));
      }
      const partner = exchanged.includes(id) ? exchanged[1 - exchanged.indexOf(id)] : id;
      const mask = spec.masks && beat >= 3 ? masks[beat >= exchangeBeat ? partner : id] : null;
      return { room, mask, slot: slots[id] };
    }));
  }

  const lie = id => {
    const { pair, marks } = statements[id];
    return { ...marks[lieMark[id]], room: pair[marks[lieMark[id]].bit ^ 1] };
  };
  // A suspect whose false room holds another mask at the lie mark needs the
  // mask tracked to be caught.
  const covered = id => {
    const { beat, room } = lie(id);
    return beat !== blackoutBeat && frames[beat].some((actor, other) => other !== id && actor.room === room && actor.mask !== null);
  };
  if (culprit === null) {
    // Carrier cases: the giver stood with the carrier just before the hand-off.
    let pool = spec.carrier ? ids.filter(id => id !== carrier && frames[trail.beat][id].room === trail.room) : ids;
    if (maskRule) {
      // Half the cases hide the liar under a mask and half do not, so neither
      // group of suspects can be skipped. A masked liar prefers a false room
      // that holds another mask.
      const masked = culpritDraw() < .5;
      const side = pool.filter(id => (masks[id] !== null) === masked);
      if (side.length) pool = side;
      if (masked && pool.some(covered)) pool = pool.filter(covered);
    }
    culprit = pick(pool, culpritDraw);
  }
  const cast = statements.map(({ pair, marks }, id) => {
    const [claim, claim2] = marks.map(({ beat, bit }, index) => ({
      beat, room: pair[bit ^ Number(!tutorial && id === culprit && index === lieMark[id])],
    }));
    return { id, species: species[id], sound: signatures[id], claim, ...(claim2 ? { claim2 } : {}) };
  });

  // The closed shutter is the one private mark. Establish the reveal there
  // after scheduling the public tape, so every suspect has identical cover.
  if (shutterBeat !== null) {
    const hidden = frames[shutterBeat];
    const occupied = hidden.filter((actor, id) => id !== culprit && actor.room === crimeRoom).map(actor => actor.slot);
    hidden[culprit] = { room: crimeRoom, mask: null, slot: range(4).find(slot => !occupied.includes(slot)) };
  }

  return { spec, level, seed, cast, culprit, crime, crimeRoom, incident, shutterBeat, blackoutBeat,
    carryBeat, carrier, trail, exchangeBeat, maskKinds, frames, beatCount: spec.beats };
}

// Every clock mark a suspect's alibi names: one, or two in a two-mark case.
export const claims = person => person.claim2 ? [person.claim, person.claim2] : [person.claim];

export function dossiers(caseData) {
  return caseData.cast.map(({ id, species, sound, claim, claim2 }) => ({
    id, species, sound, claim: { ...claim }, ...(claim2 ? { claim2: { ...claim2 } } : {}),
  }));
}

export function observe(c, beat) {
  const blackout = beat === c.blackoutBeat;
  const shutter = beat === c.shutterBeat;
  const frame = c.frames[beat];
  const actors = blackout || shutter ? [] : frame.map(({ room, slot, mask }, id) => ({
    room, slot, portrait: mask === null ? id : null, mask,
    carry: beat === c.carryBeat && id === c.carrier,
  }));
  const spatial = (a, b) => a.room - b.room || a.slot - b.slot;
  // A floor case hears each sound on a floor, not in a room.
  const floors = blackout && c.spec.floors;
  const sounds = blackout && !floors ? frame.map(({ room, slot }, id) => ({
    room, slot, sound: c.cast[id].sound,
  })).sort(spatial) : [];
  const heard = floors ? frame.map(({ room }, id) => ({
    floor: floorOf(c.spec.rooms, room), sound: c.cast[id].sound,
  })).sort((a, b) => a.floor - b.floor || a.sound - b.sound) : [];
  return { beat, actors: actors.sort(spatial), sounds, heard, blackout, shutter,
    exchange: beat === c.exchangeBeat ? [...c.maskKinds] : null,
    incident: beat >= c.incident, evidence: beat > c.incident || (beat === c.incident && !shutter)
      ? [{ room: c.crimeRoom, kind: EVIDENCE[c.crime] }]
      : [],
  };
}

export const EVIDENCE = ['crumbs', 'splash', 'feather', 'crumbs', 'feather', 'petals', 'honey', 'prints', 'leaves'];

export const freshRun = () => ({ stars: 3, rejected: [], outcome: null });

export function accuse(c, run, suspect) {
  if (run.outcome || !Number.isInteger(suspect) || !c.cast[suspect] || run.rejected.includes(suspect)) return run;
  if (suspect === c.culprit) return { ...run, outcome: 'solved' };
  const stars = run.stars - 1;
  return { stars, rejected: [...run.rejected, suspect], outcome: stars ? null : 'wrong' };
}

export const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);
const dayNumber = day => Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
export const offsetDay = (day, delta) => dayKey(new Date((dayNumber(day) + delta) * 86400000));
const mod = (n, divisor) => ((n % divisor) + divisor) % divisor;

export function dailyCase(day, hard = false) {
  const date = dayNumber(day);
  const seed = Math.imul(date, 0x9e3779b1) >>> 0;
  const level = hard ? 29 + mod(date, 8) : 16 + mod(date, 6);
  return createCase({ seed, level, hard });
}

export function dailyWin(last, day, streak) {
  if (last && day <= last) return { last, streak };
  const next = last && dayNumber(day) - dayNumber(last) === 1 ? streak + 1 : 1;
  return { last: day, streak: next };
}

// Training aids the renderer may draw, given who is playing. bots.mjs reads the
// same table, so a strategy that relies on an aid stops where the aid stops.
// `progress` is the player's next unsolved campaign case.
export function aids(c, { daily = false, hard = false, progress = 1 } = {}) {
  const fresh = daily && !hard;
  const lesson = daily ? null : c.spec.tutorial;
  return {
    // The claimed-room outline teaches the comparison in chapter I. The outline
    // lesson shows it for the first comparison only, shrinking onto the sign.
    outline: daily ? fresh && progress <= OUTLINE_LESSON && 'full'
      : lesson === 'outline' ? 'lesson' : c.spec.chapter === 1 && 'full',
    circle: daily ? fresh && progress <= OUTLINE_LESSON : c.spec.chapter === 1,
    maskTags: daily ? fresh && progress < 15 : lesson === 'masks',
    soundBracket: lesson === 'blackout' || lesson === 'floors',
    trail: daily ? hard && progress <= CARRIER_LESSON : lesson === 'carrier',
  };
}
