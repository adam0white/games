// Lantern's score is the kit's (../kit/music.js) with its 'lantern' preset: the same sound as the first version here
// (from the lab's Lantern Song), plus the melody the embers play (from the lab's Lantern Rhythm). See NOTES.md, 2026-11-24.
import { music as score } from '../kit/music.js';
export const music = (ac, dest) => score(ac, { preset: 'lantern', ...(dest ? { dest } : {}) });
