import { NIGHTS, REBORN_PACE, STATS } from './sim.js?v=16';

// The original link uses bits 0–6 for abilities. Zero in the remaining bits
// means a Classic endless river. Bits 7–12 name a story night when nonzero,
// bit 13 selects Gentle, bits 14–16 store rebirth pace, and 17–26 store stats.
const ABILITY_BITS = 7;
const NIGHT_BITS = 6;
const GENTLE_BIT = ABILITY_BITS + NIGHT_BITS;
const REBIRTH_BIT = GENTLE_BIT + 1;
const STATS_BIT = REBIRTH_BIT + 3;
const LINK_ABILITIES = ['boost', 'slow', 'size', 'magnet', 'flare', 'heart', 'shield'];
const LINK_STATS = ['hearts', 'barrier', 'calm', 'wick', 'pull'];

export function riverBits(s) {
  let extra = LINK_ABILITIES.reduce((bits, id, i) => bits | ((s.on.includes(id) || s.gifts.includes(id)) ? 1 << i : 0), 0);
  if (!s.endless) {
    extra |= s.stage << ABILITY_BITS;
    extra |= Math.round((s.hard - 1) / REBORN_PACE) << REBIRTH_BIT;
    LINK_STATS.forEach((id, i) => { extra |= s.st[id] << (STATS_BIT + i * 2); });
  }
  if (s.gentle) extra |= 1 << GENTLE_BIT;
  return extra;
}

export function readRiver(dare) {
  if (!dare) return null;
  const { extra } = dare;
  const night = (extra >>> ABILITY_BITS) & ((1 << NIGHT_BITS) - 1);
  const gentle = Boolean(extra & (1 << GENTLE_BIT));
  const reborn = (extra >>> REBIRTH_BIT) & 7;
  if (night > NIGHTS || reborn > 5 || extra >>> (STATS_BIT + LINK_STATS.length * 2)) return null;
  if ((!night && extra >>> REBIRTH_BIT) || (night && dare.score > 100)) return null;
  const stats = Object.fromEntries(LINK_STATS.map((id, i) => [id, (extra >>> (STATS_BIT + i * 2)) & 3]));
  if (LINK_STATS.some(id => stats[id] > STATS[id])) return null;
  const abilities = LINK_ABILITIES.filter((id, i) => extra & (1 << i));
  return { ...dare, night, gentle, reborn, stats, abilities };
}
