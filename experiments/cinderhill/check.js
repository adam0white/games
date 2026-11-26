// The page side of the determinism check. Also what the S2 spike drives in each browser (window.cinderhill).
import { SUBSYSTEMS } from './sim/hash.js';
import { replay, script, firstDivergence } from './sim/replay.js';
import { EXPECTED, EXPECTED_LONG, LONG, QUICK, quick } from './quick.js';
import { SIM_VERSION, Sim, encodeCommand } from './sim/sim.js';

/** Run a replay with an exact command log (S2). `mutate` loads the planted fault first. */
async function run({ cfg, commands, ticks, every = 20, mutate = false }) {
  let undo = null;
  if (mutate) undo = (await import('./spikes/mutant.js')).plant();
  try {
    const t0 = performance.now();
    const { records } = replay({ cfg, commands, ticks, every });
    return { records, ms: performance.now() - t0, engine: navigator.userAgent };
  } finally { undo?.(); }
}

const state = { result: null, long: null };
window.cinderhill = { run, quick, script, firstDivergence, expected: EXPECTED, state: () => state };

const $ = id => document.getElementById(id);
$('run')?.addEventListener('click', () => {
  $('run').disabled = true;
  $('status').textContent = 'Running 600 ticks...';
  setTimeout(() => {
    const t0 = performance.now(), h = quick(), ms = performance.now() - t0;
    $('hashes').innerHTML = SUBSYSTEMS.concat('total').map(k => `<tr><td>${k}</td><td>${h[k].toString(16).padStart(8, '0')}</td></tr>`).join('');
    const same = h.total === EXPECTED.total && h.tick === EXPECTED.tick;
    $('verdict').textContent = same ? 'Same as Node.' : `Different from Node (expected ${EXPECTED.total.toString(16)}).`;
    $('verdict').className = same ? 'ok' : 'bad';
    $('status').textContent = `${QUICK.ticks} ticks in ${Math.round(ms)} ms.`;
    $('run').disabled = false;
    state.result = { ...h, same, ms };
    showReport();
  }, 30);
});

// The long check: spike S2's 10-minute run, in slices so the page stays responsive, then one line to report.
// Firefox has never been through S2 (Playwright's Firefox is not installed where the spikes run), so a phone
// player on Firefox can run this and send the line.
function engineName() {
  const ua = navigator.userAgent;
  const m = ua.match(/Firefox\/([\d.]+)/) || ua.match(/Edg\/([\d.]+)/) || ua.match(/(?:Chrome|CriOS)\/([\d.]+)/) || ua.match(/Version\/([\d.]+).*Safari/);
  const name = /Firefox/.test(ua) ? 'Firefox (Gecko)' : /Edg\//.test(ua) ? 'Edge (Blink)' : /Chrome|CriOS/.test(ua) ? (/CriOS/.test(ua) ? 'Chrome on iOS (WebKit)' : 'Chrome (Blink)') : /Safari/.test(ua) ? 'Safari (WebKit)' : 'unknown';
  return `${name} ${m ? m[1] : ''}`.trim();
}
function reportLine() {
  const q = state.result, l = state.long;
  const part = (r, name) => (r ? `${name} ${r.same ? 'SAME' : 'DIFFERENT'} (${r.total.toString(16)}, ${(r.ms / 1000).toFixed(1)} s)` : `${name} not run`);
  return `Cinderhill check, sim ${SIM_VERSION}: ${part(q, 'short')}; ${part(l, 'long')}; ${engineName()}; ${navigator.userAgent}`;
}
function showReport() {
  $('report').textContent = reportLine();
  $('reportBox').hidden = false;
}
$('long')?.addEventListener('click', () => {
  $('long').disabled = true;
  const { cfg, ticks } = LONG, sim = new Sim(cfg);
  for (const c of script(cfg, ticks)) sim.queueCommand(encodeCommand(c));
  const t0 = performance.now();
  const slice = () => {
    const end = Math.min(ticks, sim.tick + 200);
    while (sim.tick < end) sim.step();
    $('longStatus').textContent = `${Math.round((100 * sim.tick) / ticks)}% (${sim.tick} of ${ticks} ticks)`;
    if (sim.tick < ticks) { setTimeout(slice, 0); return; }
    const h = sim.hashes(), ms = performance.now() - t0, same = h.total === EXPECTED_LONG.total && h.tick === EXPECTED_LONG.tick;
    state.long = { ...h, same, ms };
    $('longStatus').textContent = same ? `Same as Node after ${ticks} ticks (${(ms / 1000).toFixed(1)} s).` : `Different from Node: ${h.total.toString(16)}, Node has ${EXPECTED_LONG.total.toString(16)}.`;
    $('longStatus').className = same ? 'ok' : 'bad';
    $('long').disabled = false;
    showReport();
  };
  setTimeout(slice, 30);
});
$('copy')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(reportLine()); $('copy').textContent = 'Copied'; } catch { $('copy').textContent = 'Select the line and copy it'; }
});
$('engine') && ($('engine').textContent = engineName());
