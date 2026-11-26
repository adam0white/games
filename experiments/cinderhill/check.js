// The page side of the determinism check. Also what the S2 spike drives in each browser (window.cinderhill).
import { SUBSYSTEMS } from './sim/hash.js';
import { replay, script, firstDivergence } from './sim/replay.js';
import { EXPECTED, QUICK, quick } from './quick.js';

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

const state = { result: null };
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
  }, 30);
});
