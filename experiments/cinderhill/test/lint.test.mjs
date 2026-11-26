// The sim must not use what differs between engines or machines: floating-point Math functions, the
// exponent operator, random numbers, clocks, locale calls, or sort without a comparator.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIM = fileURLToPath(new URL('../sim/', import.meta.url));
const RULES = [
  [/\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log2|log10|log1p|pow|hypot|cbrt|random)\b/, 'floating-point Math'],
  [/\*\*/, 'the ** operator (Math.pow)'],
  [/\bDate\b/, 'Date'],
  [/\bperformance\b/, 'performance clock'],
  [/\bIntl\b|\btoLocale\w*|\blocaleCompare\b/, 'locale call'],
  [/\.sort\(\s*\)/, 'sort without a comparator'],
  [/\bcrypto\b/, 'crypto randomness'],
];
// Comments may name what is banned; strip them before checking (line and block comments, outside strings
// is good enough for this code).
const code = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
export const lint = src => RULES.filter(([re]) => re.test(code(src))).map(([, why]) => why);

test('the lint catches each banned use', () => {
  const bad = ['Math.sin(a)', 'Math.atan2(y, x)', 'Math.random()', 'Math.exp(1)', 'Math.log(2)', 'Math.pow(2, 3)', 'Math.hypot(1, 2)', 'Math.tan(1)', 'Math.cos(1)',
    '2 ** 3', 'new Date()', 'Date.now()', 'performance.now()', 'n.toLocaleString()', "a.localeCompare(b)", 'new Intl.Collator()', 'xs.sort()', 'xs.sort( )'];
  for (const src of bad) assert.notDeepEqual(lint(src), [], src);
  for (const src of ['Math.floor(a)', 'Math.imul(a, b)', 'Math.abs(a)', 'xs.sort((a, b) => a - b)', '// Math.sin is banned']) assert.deepEqual(lint(src), [], src);
});

test('no sim file uses a banned call', () => {
  const files = readdirSync(SIM, { recursive: true }).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
  assert.ok(files.length >= 8, `found the sim files (${files.length})`);
  for (const f of files) assert.deepEqual(lint(readFileSync(join(SIM, f), 'utf8')), [], f);
});
