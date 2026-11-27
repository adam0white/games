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
  // A fungus garden grows food under ground with no trail to guard: each open cell pays a seed at every meal. Its
  // gardeners live in it, so each cell houses one ant fewer. It opens with the chamber's growth (TIERS.rooms).
  { id: 'garden', name: 'Fungus garden', cap: 'ants', per: -1 },
];
export const ROOM = { NONE: 0, STORE: 1, NURSERY: 2, REST: 3, POST: 4, GARDEN: 5 };

/** Traits: a colony's standing changes to the rows above. set: [key, value] for a colony number (eatPer: adults a seed
 *  feeds at a meal; pupa: ticks a pupa takes), or [key, index, value] for one caste's or one room's number. needs: the
 *  caste a colony must have chosen for the trait to be offered. */
export const TRAITS = {
  thrift: { id: 'thrift', name: 'Thrift', text: 'A seed feeds twenty at a meal, not ten.', set: [['eatPer', 20]] },
  swift: { id: 'swift', name: 'Swift brood', text: 'Pupae hatch a little sooner.', set: [['pupa', 370]] },
  farspit: { id: 'farspit', name: 'Far spit', text: 'Spitters reach three and a half cells.', needs: 'spitter', set: [['reach', CASTE.SPITTER, 896]] },
  acid: { id: 'acid', name: 'Strong spit', text: 'A spit bites as hard as a soldier.', needs: 'spitter', set: [['bite', CASTE.SPITTER, 5]] },
  iron: { id: 'iron', name: 'Iron shell', text: 'Wardens take half as much again to kill.', needs: 'warden', set: [['hp', CASTE.WARDEN, 144]] },
  // Nodes of the Lineage that a deed opens. Each gives the colony something new to do, not a better number.
  post: { id: 'post', name: 'Guard post', text: 'A new room. Each cell keeps one soldier in eight inside the nest, where you paint it.', at: [2, 2], set: [['room', 4, 1]] },
  raiders: { id: 'raiders', name: 'Raiders', text: 'A raid may be sent for the store. Its soldiers carry loads home and leave the queen be.', at: [2, 1], set: [['loot', 1]] },
  hold: { id: 'hold', name: 'Hold fast', text: 'A raid may be told to hold. Its soldiers stand at the trail\'s end and never go down a door.', at: [2, 1], set: [['hold', 1]] },
  sappers: { id: 'sappers', name: 'Sappers', text: 'Your workers may tunnel into the other nest on any ground. It is a long dig, and it is heard.', at: [3, 0], set: [['breach', 1]] },
  door: { id: 'door', name: 'Second door', text: 'Dig a tunnel along the top of your ground and open a second door at its end. New trails start at the nearer door, so a store beside it shortens every road on that side. The door and the tunnel are still there in the next mission on this hill.', at: [2, 0], set: [['side', 1]] },
  stride: { id: 'stride', name: 'Long stride', text: 'Wardens keep pace with the soldiers.', needs: 'warden', set: [['speed', CASTE.WARDEN, 34]] },
};

/** Growth inside a mission (the option `tiers`). A colony starts at tier 1 with stores, nurseries, quarters, workers
 *  and soldiers. Growing the queen's chamber costs `grow[tier - 1]` from the stores; for `ticks` the queen lays nothing
 *  and the brood does not age. The first growth takes a branch, whose numbers (`set`, per cent of what stands) are the
 *  colony's for the rest of the mission. War hill: tougher soldiers, the third caste, the raid nodes. Deep hill: wider
 *  stores and quarters, quicker pupae, the building nodes. The second growth opens the other branch's caste and nodes,
 *  not its numbers. A node of the Lineage says where it opens with `at: [tier, branch]` (branch 0: either). */
export const BRANCH = { NONE: 0, WAR: 1, DEEP: 2 };
export const TIERS = {
  grow: [{ sugar: 18, protein: 0, ticks: 300 }, { sugar: 36, protein: 0, ticks: 400 }],
  branch: [null,
    { id: 'war', name: 'War hill', text: 'Soldiers a quarter tougher', set: [['hp', 1, 125]] },
    { id: 'deep', name: 'Deep hill', text: 'Workers half again as tough, stores and quarters hold half as much again, pupae hatch sooner, and it may dig fungus gardens', set: [['pupa', 87], ['per', 1, 150], ['per', 3, 150], ['hp', 0, 150]] }],
  // The second growth takes a craft for the rest of the mission. A row with `branch` is for that branch alone: a War
  // hill may take Legion, a Deep hill Granary, and either may take Swift or Thrift.
  craft: [null,
    { id: 'legion', name: 'Legion', branch: 1, text: 'soldiers and your third caste bite a third harder', set: [['bite', 1, 134], ['bite', 2, 134], ['bite', 3, 134]] },
    { id: 'swift', name: 'Swift', text: 'every ant walks a fifth faster, so trails pay more and soldiers arrive sooner', set: [['speed', 0, 120], ['speed', 1, 120], ['speed', 2, 120], ['speed', 3, 120]] },
    { id: 'thrift', name: 'Thrift', text: 'a seed feeds half as many ants again at every meal', set: [['eatPer', 150]] },
    { id: 'granary', name: 'Granary', branch: 2, text: 'every garden cell pays two seeds a minute, not one', set: [['garden', 200]] }],
  pick: [2, 1],
  // Rooms a growth opens, as [tier, branch]: the fungus garden for a Deep hill at its first growth, for any hill at its second.
  rooms: { 5: [2, 2] },
  // A full-grown hill (tier 3) tends its wounded: an ant inside its own nest mends a sixteenth of its health every HEAL_EVERY ticks.
  heal: 3,
};

/** Maps, in cells of a 160 by 112 field, mirrored left to right. wall: what runs down the middle ('water', 'stone' or
 *  none), open at the rows in `gaps` (each `gapHalf` rows either side). piles: [x, y, food kind (0 seeds, 1 meat),
 *  amount] on the left half, twinned on the right. mid: piles on the middle line, [x offset, y, kind, amount].
 *  clumps: how many small clumps of stones are scattered on each half. */
// Caches buried in the clay, as [x from the shaft, row, food (0 seed, 1 meat), loads]. Each hill has the same ones, mirrored.
// A mission takes `caches` of them (default 4), starting from a row the seed picks. Digging one open carries it to the stores.
export const CACHES = [[12, 5, 0, 16], [-13, 9, 1, 12], [9, 22, 0, 20], [-8, 24, 1, 14], [14, 17, 1, 12], [-14, 20, 0, 18], [3, 28, 0, 24], [-3, 31, 1, 18]];

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
  // A wall of stone with no way through, and the two hills close under it. The only way to the other queen is to dig.
  wall: { wall: 'stone', gaps: [], gapHalf: 0, clumps: 12, door: 58,
    piles: [[40, 50, 0, 60], [44, 66, 1, 50], [30, 30, 0, 80], [28, 84, 1, 70], [14, 62, 0, 70], [18, 22, 1, 60], [68, 28, 0, 60], [70, 86, 1, 50]],
    mid: [] },
  // A meadow cut by a creek with three fords. Little lies on the ground at dawn: the food falls through the day
  // (a mission's `falls`), in pairs on each colony's own ground at `falls` and alone on the fords at `fallsMid`.
  meadow: { wall: 'water', gaps: [20, 56, 92], gapHalf: 2, clumps: 14,
    piles: [[26, 44, 0, 40], [28, 70, 1, 50], [46, 56, 0, 50], [20, 24, 1, 50], [22, 90, 0, 40]],
    mid: [],
    falls: [[52, 30], [50, 84], [30, 16], [30, 98], [62, 56], [14, 56], [62, 24], [62, 90]],
    fallsMid: [[0, 20], [-1, 56], [0, 92]] },
};

/** The campaign, in order. A fork is a choice kept for the whole campaign; it opens when the mission before it has been
 *  played to its end, won or lost. A lost mission costs the next one `LOSS_ANTS` of its starting workers. */
export const CAMPAIGN = [
  { mission: 'crossing' },
  { fork: 'caste', options: ['spitter', 'warden'] },
  // A side mission: open as soon as The Crossing has been played, and never in the way of the road below.
  { mission: 'summer', side: true },
  { mission: 'frost' },
  { fork: 'way', options: ['thrift', 'swift'] },
  { mission: 'hunt' },
  { mission: 'stones' },
  // This fork's options depend on the caste taken at the first fork.
  { fork: 'craft', by: { spitter: ['farspit', 'acid'], warden: ['iron', 'stride'] } },
  { mission: 'larder' },
  { mission: 'narrows' },
  { mission: 'wall' },
];
export const LOSS_ANTS = 8;

/** A fork in the road: the two missions of `pair` open together. The one finished first is the road taken; the other
 *  has changed by the time the colony comes to it: `late` is laid over its options, and `text` says how. */
// A nest's visitor (the sim's `pest` option), by strength: a weevil that comes in at each colony's door at these ticks,
// walks to the nearest store cell that holds food and eats there, and goes no deeper than `reach` steps from the door.
// A page picks one for a mission with `visitor`. Stores dug deeper than its reach are the answer, at the cost of a longer
// walk for every load; soldiers beside it are the other.
export const VISITOR = {
  comes: { at: [1500, 3000, 4500, 6000, 7500], warn: 200, hp: 420, every: 10, fill: 30, reach: 16, step: 8, bite: 8, biteEvery: 20, press: 4, meat: 20 },
  hungry: { at: [1500, 3000, 4500, 6000, 7500], warn: 200, hp: 600, every: 10, fill: 80, reach: 16, step: 8, bite: 8, biteEvery: 20, press: 4, meat: 20 },
};

export const ROAD = {
  pair: ['hunt', 'stones'],
  late: { hunt: { beastHp: 4200, foeHarm: 400 }, stones: { foePoints: 40 } },
  price: { hunt: 'tougher beetle, rival +400 harm', stones: 'rival +40 points' },
  text: { hunt: 'The beetle has fed for a season, and the rival has hunted it. It takes half as much again to bring down, and the rival starts ahead on harm.', stones: 'The rival has held the stones for a season. It starts forty points ahead.' },
};

/** The Lineage: the colony's tree, bough by bough. A `fork` names a fork of CAMPAIGN (take one side; the rival has the
 *  other). A `node` names a trait that a deed opens (see each mission's `deeds`); the rival is given the same nodes, so
 *  a node is a new thing to do and not a lead. */
export const LINEAGE = [
  { id: 'fight', name: 'Fight', nodes: [{ fork: 'caste' }, { fork: 'craft' }] },
  { id: 'brood', name: 'Brood', nodes: [{ fork: 'way' }] },
  { id: 'build', name: 'Build', nodes: [{ node: 'post' }, { node: 'door' }] },
  { id: 'raid', name: 'Raid', nodes: [{ node: 'raiders' }, { node: 'hold' }] },
  { id: 'dig', name: 'Dig', nodes: [{ node: 'sappers' }] },
];

/** Missions. kit: what each colony starts with (a sim option of the same name overrides it). goals: how it ends.
 *  picks: the castes a colony may choose one of, once. rooms: what may be dug. deeds: two things worth doing beyond
 *  the goal, judged by the sim (see Sim.deeds); a deed done opens a node of the Lineage for the rest of the campaign. */
export const MISSIONS = {
  crossing: {
    id: 'crossing', name: 'The Crossing', map: 'crossing',
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600 },
    goals: { queen: true, dusk: 'adults' },
    deeds: [{ id: 'a', text: 'Carry a stolen load home.', min: { HAUL: 1 }, opens: 'raiders' }, { id: 'b', text: 'Win by killing the rival queen.', won: true, why: 'QUEEN', opens: 'hold' }, { id: 'c', text: 'Win with ninety ants or more.', won: true, min: { ADULTS: 90 }, opens: 'door' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // Half way through, the frost takes the food outside. Meals come four times as often and hunger kills fast: the hill
  // lives on what it stored, or on what it steals.
  frost: {
    from: 'crossing', id: 'frost', name: 'First Frost', map: 'crossing', visitor: true,
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 10800, frostTick: 4800, frostEat: 300, starveAfter: 300, starveDiv: 10, queenHp: 3200, glut: 3 },
    goals: { queen: true, dusk: 'adults' },
    deeds: [{ id: 'a', text: 'See the thaw with a hundred ants or more.', won: true, min: { ADULTS: 100 }, opens: 'post' }, { id: 'b', text: 'Carry three stolen loads home.', min: { HAUL: 3 }, opens: 'raiders' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // Open ground with no wall, and a great beetle on a dead vole in the middle of it. It bites whatever comes within
  // two cells, two ants at a time, and never leaves the body. The colony that does it more harm by the time it falls
  // wins; at dusk, more harm. Its body is meat for whoever carries it.
  hunt: {
    id: 'hunt', name: 'The Hunt', map: 'flat',
    kit: { ants: 30, majors: 3, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600, queenHp: 6000 },
    goals: { queen: true, beast: true, carry: 40, lead: 6, dusk: 'harm' },
    beast: { at: [80, 38], hp: 2800, bite: 8, hits: 2, every: 20, range: 2, press: 12, girth: 384, meat: 110 },
    deeds: [{ id: 'a', text: 'Carry forty loads of the beetle home.', won: true, why: 'BEAST', opens: 'hold' }, { id: 'b', text: 'Win with fewer than seventy dead.', won: true, max: { DIED: 69 }, opens: 'post' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // Four standing stones. A stone pays a point a second to the colony that has more ants beside it (three at least).
  // First to the goal wins; at dusk, more points. Two stones stand on the fords, one on each colony's far flank.
  stones: {
    from: 'frost', id: 'stones', name: 'The Stones', map: 'crossing',
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 10800, queenHp: 2400 },
    goals: { queen: true, points: 400, dusk: 'points' },
    sites: [[79, 28], [80, 84], [54, 100], [105, 100]],
    deeds: [{ id: 'a', text: 'Win on points with fewer than fifty dead.', won: true, why: 'POINTS', max: { DIED: 49 }, opens: 'hold' }, { id: 'b', text: 'Win with a hundred and thirty ants or more.', won: true, min: { ADULTS: 130 }, opens: 'post' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // A lean season: little outside, full stores inside. A load counts when a thief carries it all the way home. The
  // queens are too tough to be worth the bites, so the stores are the fight.
  larder: {
    from: 'stones', id: 'larder', name: 'The Larder', map: 'crossing',
    kit: { ants: 30, sugar: 40, protein: 20, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600, queenHp: 6000, lean: 3 },
    goals: { queen: true, haul: 10, dusk: 'haul' },
    deeds: [{ id: 'a', text: 'Win by ten loads, not by dusk.', won: true, why: 'HAUL', opens: 'post' }, { id: 'b', text: 'Win inside six minutes.', won: true, by: 7200, opens: 'raiders' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST],
  },
  // A siege. The rival (team 1) starts larger, behind a ridge with one pass, and wins by lasting until dusk. Its queen
  // is frail: reach her and it is over.
  narrows: {
    id: 'narrows', name: 'The Narrows', map: 'pass', breach: true,
    kit: { ants: 36, foeAnts: 40, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600, queenHp: 1200, digTicks: 60, digSugar: 0 },
    goals: { queen: true, dusk: 'holder' },
    deeds: [{ id: 'a', text: 'Kill the queen inside five minutes.', won: true, by: 6000, opens: 'hold' }, { id: 'b', text: 'Kill the queen with fewer than sixty dead.', won: true, max: { DIED: 59 }, opens: 'post' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST, ROOM.POST],
  },
  // No way over: the wall is whole. Either hill may dig through the clay under it and into the other's nest. A dig on
  // your side is heard. Soldiers sent through go for the queen; a guard post where the tunnel comes in stops them.
  wall: {
    id: 'wall', name: 'The Wall', map: 'wall', breach: true, rivalMood: 1,
    kit: { ants: 30, sugar: 14, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 9600 },
    goals: { queen: true, dusk: 'adults' },
    deeds: [{ id: 'a', text: 'Kill the queen inside seven minutes.', won: true, why: 'QUEEN', by: 8400, opens: 'sappers' }, { id: 'b', text: 'Win with fewer than 120 dead.', won: true, max: { DIED: 119 }, opens: 'post' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST, ROOM.POST],
  },
  // The long game. Twenty minutes, not eight, and the food does not run out: it falls through the day, on each
  // colony's own ground and on the fords between them. A hill that stops digging at minute three is outgrown by
  // minute ten, so what is built, and where, is the mission. The queens are tough: a raid thins a hill before it ends one.
  summer: {
    id: 'summer', name: 'High Summer', map: 'meadow', visitor: true, long: true,
    kit: { ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12, duskTick: 24000, queenHp: 6400, truce: 9600, reserve: true, falls: { from: 2000, every: 1200, warn: 300, amount: 70, mid: 160 } },
    visits: [1500, 4500, 7500, 10500, 13500, 16500, 19500, 22500],
    goals: { queen: true, dusk: 'adults' },
    deeds: [{ id: 'a', text: 'Win with two hundred ants or more.', won: true, min: { ADULTS: 200 }, opens: 'door' }, { id: 'b', text: 'Win by killing the rival queen.', won: true, why: 'QUEEN', opens: 'sappers' }, { id: 'c', text: 'Carry twenty stolen loads home.', min: { HAUL: 20 }, opens: 'raiders' }],
    picks: [CASTE.SPITTER, CASTE.WARDEN],
    rooms: [ROOM.STORE, ROOM.NURSERY, ROOM.REST, ROOM.POST, ROOM.GARDEN],
  },
};
