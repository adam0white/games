// Fix-It Stall: the levels. Pure data for the page and the bots (tester t1, note #157: "each level has its own goal").
// Three goals: time (fix N before closing), list (fix exactly these, lose nobody, no clock), coins (earn N before closing).
// `careful` levels give one heart. A level's customers are fixed by its seed, so a retry meets the same people.
import { TUTOR, RAMP } from './sim.js';

export const ORDER = [...TUTOR, 'wheel', 'rub', 'clock', 'chain', 'glue', 'sharpen', 'sew', 'pump'];
const T = (n, sec, ramp, extra) => ({ goal: 'time', n, sec, ramp, ...extra });
const C = (n, sec, ramp, extra) => ({ goal: 'coins', n, sec, ramp, ...extra });
const L = (list, ramp, extra) => ({ goal: 'list', list: list.split(' '), ramp, ...extra });
const careful = { careful: true }, two = { two: 0.4 };
export const LEVELS = [
  T(5, 40, 0, { tutorial: true }),                              // the first three customers teach
  L('wheel dent screw wheel pin', 0),
  C(20, 45, 0, { fresh: 'rub' }),
  T(7, 50, 0, { fresh: 'clock' }),
  L('chain wheel rub chain clock screw', 0),
  C(28, 50, 1, { fresh: 'glue' }),
  T(8, 50, 1, { fresh: 'sharpen' }),
  L('sew chain dent sew glue pin wheel', 1),
  C(32, 50, 1, { fresh: 'pump' }),
  T(8, 45, 1, careful),                                         // 10: every job is out
  L('pump rub sew sharpen rub pump', 2),
  C(45, 50, 2, two),
  T(9, 50, 2, two),
  L('clock glue chain wheel sew dent screw pump', 2, { two: 0.5 }),
  C(50, 55, 2, careful),                                        // 15
  T(10, 50, 2, {}),
  L('rub sharpen pump sew rub sharpen pump sew', 3),
  C(60, 60, 2, two),
  T(11, 55, 3, careful),
  L('wheel clock glue pump sew chain rub sharpen', 3, { two: 1 }), // 20
  C(70, 60, 3, two),
  T(12, 60, 3, two),
  L('sew pump rub screw sew pump rub screw sew pump', 4),
  C(80, 65, 3, { ...two, ...careful }),
  T(13, 60, 4, {}),                                             // 25
  L('clock sew glue rub chain pump wheel sharpen', 4, { two: 1 }),
  C(95, 70, 4, two),
  T(14, 65, 4, { ...careful }),
  C(110, 75, 4, { ...two, ...careful }),
  L('screw pin dent wheel rub clock chain glue sharpen sew pump', 5, { two: 1 }), // 30: every job, twice broken
];
// The jobs a level may bring: the first three, and one more for each of the levels 2 to 9.
export const jobsAt = i => ORDER.slice(0, Math.min(ORDER.length, TUTOR.length + i));
export const goalText = l => l.goal === 'time' ? `Fix ${l.n} things in ${l.sec} seconds${l.careful ? '. Lose nobody!' : ''}` : l.goal === 'coins' ? `Earn ${l.n} coins in ${l.sec} seconds${l.careful ? '. Lose nobody!' : ''}` : `Fix all ${l.list.length}. Lose nobody!`;
export function options(i, spareHeart = false) {
  const l = LEVELS[i], oneHeart = l.careful || l.goal === 'list';
  return {
    seed: 7001 + i * 97, unlocked: jobsAt(i), tutorial: !!l.tutorial, newJob: l.fresh ?? null, list: l.goal === 'list' ? l.list : null,
    goal: l.goal === 'coins' ? { coins: l.n } : { served: l.goal === 'list' ? l.list.length : l.n },
    hearts: oneHeart ? 1 : spareHeart ? 4 : 3, two: l.two ?? false, golden: 0, startLevel: l.ramp,
    day: l.goal === 'list' ? 3600 : l.ramp * RAMP + l.sec, steady: l.goal === 'list',
  };
}
// Stars: one for clearing, one for losing nobody, one when two fixes in three were quick.
export const stars = s => s.over !== 'goal' ? 0 : 1 + (s.lost === 0 ? 1 : 0) + (s.quicks * 3 >= s.served * 2 ? 1 : 0);
