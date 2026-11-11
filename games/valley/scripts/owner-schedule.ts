import type { Input } from '../src/sim/game.ts';

// The owner's day-12 actions, without the private full-state replay file.
export const ownerInputs: Input[] = [
  {
    verb: 'call',
    job: 'reap-agha',
    houses: ['kavak', 'ak', 'coban', 'dere', 'kara', 'demirci', 'kuyucu', 'tepe'],
    at: 2580,
  },
  { verb: 'visit', house: 'coban', why: 'birth', at: 3510 },
  { verb: 'give', house: 'coban', kile: 6, at: 3930 },
  { verb: 'give', house: 'tepe', kile: 6, at: 5130 },
  { verb: 'give', house: 'kuyucu', kile: 6, at: 5370 },
  { verb: 'give', house: 'demirci', kile: 6, at: 5520 },
  { verb: 'give', house: 'ak', kile: 6, at: 5670 },
  { verb: 'visit', house: 'dere', at: 7590 },
  { verb: 'visit', house: 'tepe', at: 7980 },
  { verb: 'visit', house: 'kara', at: 8280 },
  { verb: 'visit', house: 'coban', at: 8730 },
  { verb: 'visit', house: 'demirci', at: 9630 },
  { verb: 'visit', house: 'ak', at: 10080 },
  { verb: 'visit', house: 'kuyucu', at: 10530 },
  { verb: 'visit', house: 'kavak', at: 11190 },
];
