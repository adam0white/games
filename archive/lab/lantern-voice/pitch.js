// Pitch detection for Lantern Voice. Pure functions, no DOM: the page passes in a time-domain buffer from an
// AnalyserNode and the AudioContext's sample rate; the tests pass in synthetic waves.
// The method is YIN (de Cheveigne and Kawahara, 2002): the cumulative mean normalised difference function, an
// absolute threshold, and parabolic interpolation round the chosen lag.
//   detect(buf, rate) -> { hz, clarity, rms }   hz is null for silence, noise or no clear pitch
//   pitch(buf, rate)  -> hz or null

export const PITCH = {
  minHz: 70,      // below a low male hum
  maxHz: 3000,    // above a whistle
  gate: 0.008,    // RMS below this is silence: the noise gate
  pick: 0.15,     // YIN's absolute threshold: the first lag whose normalised difference falls under this is taken
  clear: 0.7,     // clarity (1 minus the normalised difference at the chosen lag) below this is no pitch
};

// Halve the sample rate by averaging pairs when it is high. YIN's cost is the window times the longest lag, so
// this cuts the work by four; the pair average is also a gentle low-pass, so it does little harm to the pitch.
function decimate(buf, rate) {
  if (rate < 32000) return [buf, rate];
  const n = buf.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.5 * (buf[2 * i] + buf[2 * i + 1]);
  return [out, rate / 2];
}

export function detect(input, rate, opts = {}) {
  const o = { ...PITCH, ...opts };
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  const rms = Math.sqrt(sum / input.length);
  if (!(rms >= o.gate)) return { hz: null, clarity: 0, rms };
  const [buf, sr] = decimate(input, rate);
  // Remove any DC offset so a microphone's bias does not look like a long period.
  let mean = 0; for (let i = 0; i < buf.length; i++) mean += buf[i]; mean /= buf.length;
  const tauMin = Math.max(2, Math.floor(sr / o.maxHz)), tauMax = Math.min(Math.floor(sr / o.minHz), buf.length >> 1);
  const W = buf.length - tauMax;
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let acc = 0;
    for (let i = 0; i < W; i++) { const v = buf[i] - buf[i + tau]; acc += v * v; }
    d[tau] = acc;
  }
  // Cumulative mean normalised difference: d'(tau) = d(tau) / mean of d(1..tau).
  const n = new Float32Array(tauMax + 2); n[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) { run += d[tau]; n[tau] = run > 0 ? d[tau] * tau / run : 1; }
  // The first dip under the threshold, followed down to its own minimum; else the lowest point overall.
  let best = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (n[tau] < o.pick) { while (tau + 1 <= tauMax && n[tau + 1] < n[tau]) tau++; best = tau; break; }
  }
  if (best < 0) { let lo = Infinity; for (let tau = tauMin; tau <= tauMax; tau++) if (n[tau] < lo) { lo = n[tau]; best = tau; } }
  const clarity = 1 - n[best];
  if (clarity < o.clear || best >= tauMax) return { hz: null, clarity, rms };
  // A parabola through the chosen lag and its neighbours places the true period between samples.
  const a = n[best - 1], b = n[best], c = n[best + 1], den = a - 2 * b + c;
  const shift = den > 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0;
  return { hz: sr / (best + shift), clarity, rms };
}

export const pitch = (buf, rate, opts) => detect(buf, rate, opts).hz;
// Hertz to a semitone number (MIDI: A4 = 440 Hz = 69), and back. Steering works on this log scale.
export const semis = hz => 69 + 12 * Math.log2(hz / 440);
export const hertz = m => 440 * 2 ** ((m - 69) / 12);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = m => { const r = Math.round(m); return NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1); };
