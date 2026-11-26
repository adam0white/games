// A new player who lifts when what they watch reaches the line (2026-11-26). It knows nothing of the physics.
//   watch 'glass':    the liquid in the glass (what the page showed before the forecast line)
//   watch 'forecast': the faint line that shows where the glass is heading (sim.js forecast)
// It reacts 250 to 400 ms late, slides at 0.6 to 1.2 rad a second up to a pour it likes, lifts when the watched level
// reaches a point around the line, and tops up with a small pour when the glass settles under the band.
//   node naive.mjs [--count=300]    clear rate per level, watching the glass and watching the forecast; exit 1 unless
//     watching the forecast clears every level at least 80% of the time and at least 15 points more often than
//     watching the glass on levels 3 to 8 (heavy thumbs: pours up to full tilt)
//   node naive.mjs --mutate          the forecast is only what is in the glass: the claim must fail (exit 1)
import { rng, create, step, band, forecast as realForecast, POUR_FROM, LEVELS } from './sim.js';
const forecast = process.argv.includes('--mutate') ? s => s.glass.n : realForecast;

export function naive(seed, watch) {
  const r = rng(seed * 31 + 7);
  const gauss = () => (r() + r() + r() + r() - 2) * 0.866;
  const lag = 15 + Math.floor(r() * 10), slide = (0.6 + r() * 0.6) / 60, aim = POUR_FROM + 0.45 + r() * 1.45, bias = gauss() * 0.3;
  const seen = [];
  let tilt = 0, mode = 'pour', calmFor = 0;
  return s => {
    const [lo] = band(s);
    seen.push(watch === 'forecast' ? forecast(s) : s.glass.n);
    const v = seen[Math.max(0, seen.length - 1 - lag)], g = s.glass === s.glasses.at(-1) || s.glasses.length === 1;
    const stopAt = s.L.target + bias * s.L.band;
    if (mode === 'pour') {
      tilt = Math.min(aim, tilt + slide);
      if (v >= stopAt) { mode = 'wait'; calmFor = 0; }
    } else if (mode === 'wait') {
      tilt = 0;
      calmFor = s.flying === 0 && s.flow === 0 ? calmFor + 1 : 0;
      // two glasses: when the belt brings the next glass, pour again
      if (s.glass.n < lo - 0.5 && calmFor > 20 && (s.glass.n < 1 || g)) mode = s.glass.n < 1 ? 'pour' : 'top';
    } else if (mode === 'top') {
      tilt = Math.min(POUR_FROM + 0.35, tilt + slide);
      if (v >= s.L.target - 0.3 * s.L.band) { mode = 'wait'; calmFor = 0; }
    }
    return tilt;
  };
}
export function play(level, seed, watch) {
  const s = create(level, seed), hand = naive(seed, watch);
  for (let f = 0; f < 60 * 60 && !s.over; f++) step(s, hand(s));
  return s;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = +(process.argv.find(a => a.startsWith('--count='))?.slice(8) ?? 300);
  let failed = 0;
  for (let level = 1; level <= LEVELS; level++) {
    const row = [], rate = {};
    for (const watch of ['glass', 'forecast']) {
      let ok = 0; const why = {};
      for (let seed = 1; seed <= count; seed++) { const s = play(level, seed, watch); if (s.won) ok++; why[s.why] = (why[s.why] ?? 0) + 1; }
      rate[watch] = 100 * ok / count;
      row.push(`${watch} ${rate[watch].toFixed(1)}% ${JSON.stringify(why)}`);
    }
    const bad = rate.forecast < 80 || (level >= 3 && rate.forecast < rate.glass + 15);
    if (bad) failed++;
    console.log(`${bad ? 'FAIL' : 'ok  '} level ${level}: ${row.join('   ')}`);
  }
  if (failed) { console.log(failed + ' failed'); process.exit(1); }
}
