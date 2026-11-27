// The war sim's data: castes, rooms and missions. The sim reads these and holds no numbers of its own for them, so a new
// caste, room or mission is a row here.

/** Castes. food: meat to raise one. reach: how far a bite lands, in 1/256 of a cell (over 256 is a spit: it needs a clear
 *  line and is not crowded out). fights: guards the hill and marches on raids. */
export const CASTES = [
  { id: 'worker', name: 'Worker', hp: 12, bite: 2, speed: 45, food: 1, reach: 200, fights: false },
  { id: 'soldier', name: 'Soldier', hp: 40, bite: 6, speed: 34, food: 3, reach: 200, fights: true },
  { id: 'spitter', name: 'Spitter', hp: 14, bite: 3, speed: 38, food: 2, reach: 640, fights: true },
  { id: 'warden', name: 'Warden', hp: 96, bite: 3, speed: 26, food: 4, reach: 200, fights: true },
];
export const CASTE = { WORKER: 0, MAJOR: 1, SPITTER: 2, WARDEN: 3 };

/** Rooms. Each open cell of a room adds to one cap. */
export const ROOMS = [
  null,
  { id: 'store', name: 'Store', cap: 'food', per: 8 },
  { id: 'nursery', name: 'Nursery', cap: 'brood', per: 1 },
  { id: 'rest', name: 'Quarters', cap: 'ants', per: 4 },
  // A guard post adds to no cap. Each open cell keeps one in eight of the colony's idle fighters standing on it, inside
  // the nest, and not out by the door: eight cells bring the whole guard in.
  { id: 'post', name: 'Guard post', cap: null, per: 0 },
];
export const ROOM = { NONE: 0, STORE: 1, NURSERY: 2, REST: 3, POST: 4 };

/** Traits: a colony's standing changes to the rows above. set: [key, value] for a colony number (eatPer: adults a seed
 *  feeds at a meal; pupa: ticks a pupa takes), or [key, index, value] for one caste's or one room's number. needs: the
 *  caste a colony must have chosen for the trait to be offered. */
export const TRAITS = {
  thrift: { id: 'thrift', name: 'Thrift', text: 'A seed feeds twenty at a meal, not ten.', set: [['eatPer', 20]] },
  swift: { id: 'swift', name: 'Swift brood', text: 'Pupae hatch a little sooner.', set: [['pupa', 370]] },
  farspit: { id: 'farspit', name: 'Far spit', text: 'Spitters reach three and a half cells.', needs: 'spitter', set: [['reach', CASTE.SPITTER, 896]] },
  acid: { id: 'acid', name: 'Strong spit', text: 'A spit bites as hard as a soldier.', needs: 'spitter', set: [['bite', CASTE.SPITTER, 5]] },
  iron: { id: 'iron', name: 'Iron shell', text: 'Wardens take half as much again to kill.', needs: 'warden', set: [['hp', CASTE.WARDEN, 144]] },
  stride: { id: 'stride', name: 'Long stride', text: 'Wardens keep pace with the soldiers.', needs: 'warden', set: [['speed', CASTE.WARDEN, 34]] },
};

/** Maps, in cells of a 160 by 112 field, mirrored left to right. wall: what runs down the middle ('water', 'stone' or
 *  none), open at the rows in `gaps` (each `gapHalf` rows either side). piles: [x, y, food kind (0 seeds, 1 meat),
 *  amount] on the left half, twinned on the right. mid: piles on the middle line, [x offset, y, kind, amount].
 *  clumps: how many small clumps of stones are scattered on each half. */
export const MAPS = {
  // Two hills either side of a creek with two fords. The big food lies on the fords.
  crossing: { wall: 'water', gaps: [28, 84], gapHalf: 2, clumps: 16,
    piles: [[27, 49, 0, 60], [45, 66, 1, 50], [50, 34, 0, 80], [30, 84, 1, 70], [58, 70, 0, 70], [20, 22, 1, 60]],
    mid: [[-1, 28, 1, 160], [0, 84, 0, 160]] },
  // A ridge of stone with one narrow pass. All the rich food lies in the pass and just beyond it.
  pass: { wall: 'stone', gaps: [56], gapHalf: 2, clumps: 10,
    piles: [[24, 30, 0, 50], [26, 84, 1, 40], [48, 20, 0, 40], [52, 92, 0, 40], [66, 50, 1, 60], [68, 62, 0, 90]],
    mid: [[0, 56, 0, 200], [-1, 54, 1, 120]] },
  // Open ground, no wall at all: nothing to hold, every flank is open. Food is spread wide, in many small piles.
  flat: { wall: null, gaps: [], gapHalf: 0, clumps: 24,
    piles: [[22, 20, 0, 40], [20, 92, 0, 40], [44, 40, 1, 40], [46, 74, 0, 40], [60, 14, 1, 40], [62, 98, 0, 50], [70, 56, 1, 40], [56, 56, 0, 40]],
    mid: [[0, 20, 0, 80], [-1, 56, 1, 80], [0, 92, 0, 80]] },
};

/** The campaign, in order. A fork is a choice kept for the whole campaign; it opens when the mission before it has been
 *  played to its end, won or lost. A lost mission costs the next one `LOSS_ANTS` of its starting workers. */
export const CAMPAIGN = [
  { mission: 'crossing' },
  { fork: 'caste', options: ['spitter', 'warden'] },
  { mission: 'frost' },
  { fork: 'way', options: ['thrift', 'swift'] },
  { mission: 'stones' },
  // This fork's options depend on the caste taken at the first fork.
  { fork: 'craft', by: { spitter: ['farspit', 'acid'], warden: ['iron', 'stride'] } },
  { mission: 'larder' },
  { mission: 'narrows' },
];
export const LOSS_ANTS = 8;

/** Missions. kit: what each colony starts with (a sim option of the same name overrides it). goals: how it ends.
 *  picks: the castes a colony may choose one of, once. rooms: what may be dug. */
export const MISSIONS = {
  crossing: {
    id: 'crossing', name: 'The Crossing', map: 'crossing',
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600 },
    goals: { queen: true, dusk: 'adults' },
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // Half way through, the frost takes the food outside. Meals come four times as often and hunger kills fast: the hill
  // lives on what it stored, or on what it steals.
  frost: {
    id: 'frost', name: 'First Frost', map: 'crossing',
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 10800, frostTick: 4800, frostEat: 300, starveAfter: 300, starveDiv: 10, queenHp: 3200, glut: 3 },
    goals: { queen: true, dusk: 'adults' },
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // Four standing stones. A stone pays a point a second to the colony that has more ants beside it (three at least).
  // First to the goal wins; at dusk, more points. Two stones stand on the fords, one on each colony's far flank.
  stones: {
    id: 'stones', name: 'The Stones', map: 'crossing',
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 10800, queenHp: 2400 },
    goals: { queen: true, points: 400, dusk: 'points' },
    sites: [[79, 28], [80, 84], [54, 100], [105, 100]],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // A lean season: little outside, full stores inside. A load counts when a thief carries it all the way home. The
  // queens are too tough to be worth the bites, so the stores are the fight.
  larder: {
    id: 'larder', name: 'The Larder', map: 'crossing',
    kit: { ants: 30, sugar: 40, protein: 20, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600, queenHp: 6000, lean: 3 },
    goals: { queen: true, haul: 10, dusk: 'haul' },
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST, ROOM.POST],
  },
  // A siege. The rival (team 1) starts larger, behind a ridge with one pass, and wins by lasting until dusk. Its queen
  // is frail: reach her and it is over.
  narrows: {
    id: 'narrows', name: 'The Narrows', map: 'pass',
    kit: { ants: 36, foeAnts: 40, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600, queenHp: 1200 },
    goals: { queen: true, dusk: 'holder' },
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST, ROOM.POST],
  },
};
