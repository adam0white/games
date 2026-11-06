import { checkResults } from './lib.mjs';
if (!/^\d+$/.test(process.env.COUNT ?? '') || !/^\d+$/.test(process.env.TOTAL ?? '')) throw new Error('Missing registry count');
const count = Number(process.env.COUNT);
if (!Number.isInteger(count) || count < 0) throw new Error('Invalid affected count');
const total = Number(process.env.TOTAL);
if (!Number.isInteger(total) || total < 0) throw new Error('Invalid registry count');
checkResults({tools:process.env.TOOLS, changes:process.env.CHANGES, games:process.env.GAMES, build:process.env.BUILD}, count, total);
