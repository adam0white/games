import { NIGHTS, REBORN_PACE, STATS, LEVELS, SECTORS, FLOORS } from './sim.js?v=17';

// The original link uses bits 0–6 for abilities. Zero in the remaining bits
// means a Classic endless river. Bits 7–12 name a story night when nonzero,
// bit 13 selects Gentle, bits 14–16 store rebirth pace, and 17–26 store stats.
// Bit 27 marks a tower level (2026-11-27): then bits 7–13 hold the level less one and 14–16 the floor it started from;
// a tower run has no night, no gentle banks and no rebirth pace, so those bits are free for it. Stats stay in 17–26.
const ABILITY_BITS = 7;
const NIGHT_BITS = 6;
const GENTLE_BIT = ABILITY_BITS + NIGHT_BITS;
const REBIRTH_BIT = GENTLE_BIT + 1;
const STATS_BIT = REBIRTH_BIT + 3;
const LINK_ABILITIES = ['boost', 'slow', 'size', 'magnet', 'flare', 'heart', 'shield'];
const LINK_STATS = ['hearts', 'barrier', 'calm', 'wick', 'pull'];
const TOWER_BIT = STATS_BIT + LINK_STATS.length * 2;
const LEVEL_BITS = 7, FLOOR_BIT = ABILITY_BITS + LEVEL_BITS;
// What a link may claim. A link is only the sender's word, so a score the mode cannot produce is refused: 0 (nothing to beat),
// over 100 on a night or a tower level (a percent of the way to dawn), and over ENDLESS_TOP on the endless river, which scores
// about 10 a second plus boosts: 100000 is close to three hours on one river, far past a run a player could finish.
export const ENDLESS_TOP = 100000;

export function riverBits(s, from = 0) { // from: the tower floor the run started on
  let extra = LINK_ABILITIES.reduce((bits, id, i) => bits | ((s.on.includes(id) || s.gifts.includes(id)) ? 1 << i : 0), 0);
  if (s.tower) {
    extra |= (s.climb - 1) << ABILITY_BITS; extra |= Math.max(0, Math.min(7, from)) << FLOOR_BIT;
    LINK_STATS.forEach((id, i) => { extra |= s.st[id] << (STATS_BIT + i * 2); });
    return (extra | (1 << TOWER_BIT)) >>> 0;
  }
  if (!s.endless) {
    extra |= s.stage << ABILITY_BITS;
    extra |= Math.round((s.hard - 1) / REBORN_PACE) << REBIRTH_BIT;
    LINK_STATS.forEach((id, i) => { extra |= s.st[id] << (STATS_BIT + i * 2); });
  }
  if (s.gentle) extra |= 1 << GENTLE_BIT;
  return extra;
}

export function readRiver(dare) {
  if (!dare || !Number.isInteger(dare.score) || dare.score <= 0) return null;
  const { extra } = dare;
  const stats = Object.fromEntries(LINK_STATS.map((id, i) => [id, (extra >>> (STATS_BIT + i * 2)) & 3]));
  if (LINK_STATS.some(id => stats[id] > STATS[id])) return null;
  const abilities = LINK_ABILITIES.filter((id, i) => extra & (1 << i));
  if (extra & (1 << TOWER_BIT)) {
    const climb = ((extra >>> ABILITY_BITS) & ((1 << LEVEL_BITS) - 1)) + 1, floor = (extra >>> FLOOR_BIT) & 7;
    if (extra >>> (TOWER_BIT + 1) || climb > LEVELS * SECTORS || floor >= FLOORS || dare.score < Math.floor(floor * 100 / FLOORS) || dare.score > 100) return null;
    return { ...dare, tower: true, climb, floor, night: 0, gentle: false, reborn: 0, stats, abilities };
  }
  const night = (extra >>> ABILITY_BITS) & ((1 << NIGHT_BITS) - 1);
  const gentle = Boolean(extra & (1 << GENTLE_BIT));
  const reborn = (extra >>> REBIRTH_BIT) & 7;
  if (night > NIGHTS || reborn > 5 || extra >>> (STATS_BIT + LINK_STATS.length * 2)) return null;
  if ((!night && extra >>> REBIRTH_BIT) || (night && dare.score > 100) || (!night && dare.score > ENDLESS_TOP)) return null;
  return { ...dare, night, gentle, reborn, stats, abilities };
}
