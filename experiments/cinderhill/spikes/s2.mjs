// Spike S2: the same seed and 10 minutes (12,000 ticks) of scripted orders in Node and in each browser
// Playwright can launch here, compared every 20 ticks per subsystem. Then the planted fault (mutant.js,
// floating-point Math.sin in the ant step) in each engine, to show the check fails when engines differ.
// Usage: PLAYWRIGHT=<dir with playwright> node s2.mjs [--ticks=12000] [--ants=2000]
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { script, replay, firstDivergence } from '../sim/replay.js';
import { plant } from './mutant.js';

const args = process.argv.slice(2), opt = (k, d) => Number(args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const TICKS = opt('ticks', 12000), ANTS = opt('ants', 2000), EVERY = 20;
const cfg = { seed: 2026, ants: ANTS };
const commands = script(cfg, TICKS), json = JSON.stringify(commands);
const digest = createHash('sha256').update(json).digest('hex');
console.log(`${commands.length} orders over ${TICKS} ticks, ${ANTS} ants; command log sha256 ${digest.slice(0, 16)}`);

const results = [];
// The fault's own input: Math.sin on the arguments the first 20 ticks use, as raw bits. Shows whether an
// engine's sin really differs from Node's, so a mutant divergence is the engine and not something else.
const sinBits = () => { const f = new Float64Array(1), u = new Uint32Array(f.buffer), out = []; for (let t = 0; t < 20; t++) for (let i = 0; i < 1000; i++) { f[0] = Math.sin(i * 0.7310585786300049 + t * 1.3700000000000001 + 0.5); out.push(u[0], u[1]); } return out; };
const nodeSin = sinBits();
const sinDiff = other => { let d = 0; for (let k = 0; k < nodeSin.length; k += 2) if (nodeSin[k] !== other[k] || nodeSin[k + 1] !== other[k + 1]) d++; return `${d} of ${nodeSin.length / 2}`; };
const node = (mutate) => { const undo = mutate ? plant() : null; try { const t = performance.now(); const r = replay({ cfg, commands: JSON.parse(json), ticks: TICKS, every: EVERY }).records; return { records: r, ms: performance.now() - t }; } finally { undo?.(); } };
const nodeClean = node(false), nodeMutant = node(true);
console.log(`node ${process.version}: clean ${Math.round(nodeClean.ms)} ms, final total ${nodeClean.records.at(-1).total}; mutant final total ${nodeMutant.records.at(-1).total}`);
console.log(`node mutant vs node clean (the fault changes play): ${JSON.stringify(firstDivergence(nodeClean.records, nodeMutant.records))}`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace(/^\/cinderhill\//, '/');
  const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/cinderhill/`;

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : import.meta.url);
const pw = require('playwright');
for (const name of ['chromium', 'webkit', 'firefox']) {
  let browser;
  try { browser = await pw[name].launch(); }
  catch (e) { results.push({ engine: name, status: 'not run', why: e.message.split('\n')[0] }); continue; }
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForFunction(() => window.cinderhill);
  const seen = await page.evaluate(async j => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(j)))].map(b => b.toString(16).padStart(2, '0')).join(''), json);
  const go = mutate => page.evaluate(([j, cfg, ticks, every, mutate]) => window.cinderhill.run({ cfg, commands: JSON.parse(j), ticks, every, mutate }), [json, cfg, TICKS, EVERY, mutate]);
  const clean = await go(false), mutant = await go(true);
  const sin = sinDiff(await page.evaluate(`(${sinBits.toString()})()`));
  results.push({
    engine: name, version: browser.version(), sameLog: seen === digest, ms: Math.round(clean.ms),
    clean: firstDivergence(nodeClean.records, clean.records), mutant: firstDivergence(nodeMutant.records, mutant.records), sinDiffersFromNode: sin, records: clean.records.length,
  });
  await browser.close();
}
server.close();
for (const r of results) console.log(JSON.stringify(r));
