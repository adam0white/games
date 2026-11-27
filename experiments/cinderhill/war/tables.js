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
];
export const ROOM = { NONE: 0, STORE: 1, NURSERY: 2, REST: 3 };

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
};
