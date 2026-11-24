// A score made in code that follows the river. No samples, no libraries: Web Audio only.
//   const song = music(ac);            build once, inside the kit's sound setup
//   song.start(seed);                  a new night: its own melody, from the seed
//   song.set({ on, progress, danger, light });   every frame; all values 0 to 1 (on: a run is in play)
//   song.chime(n)                      the pitch (hertz) for the n-th ember in a row, inside the chord now playing
//   song.volume(v)                     0 to 1
// How it works: a clock of eighth notes at 72 beats a minute, scheduled a little ahead on the audio clock
// (so it stays in time when frames drop, and stops when the context is suspended for a pause).
// Four layers: a slow pad on the bar's chord, a plucked melody that gets busier towards dawn,
// a low pulse that comes in with danger, and one high held note when the flame is nearly out.
// Night is D minor (Dm, Bb, F, C). Past 86% of the way the chords turn to D major (D, G, A, D): dawn is heard before it is seen.
const midi = n => 440 * 2 ** ((n - 69) / 12);
const NIGHT = [[50, 53, 57, 60], [46, 50, 53, 58], [53, 57, 60, 64], [48, 52, 55, 62]];   // Dm7, Bb, F maj7, C add9
const DAWN = [[50, 54, 57, 62], [55, 59, 62, 66], [57, 61, 64, 69], [50, 54, 57, 66]];    // D, G maj7, A, D
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function music(ac, dest = ac.destination) {
  const STEP = 60 / 72 / 2, AHEAD = 0.35;
  const out = ac.createGain(); out.gain.value = 0; out.connect(dest);
  // a soft echo, so single notes sit in a space
  const echo = ac.createDelay(1.5), back = ac.createGain(), wet = ac.createGain(); echo.delayTime.value = STEP * 3; back.gain.value = 0.32; wet.gain.value = 0.35;
  echo.connect(back).connect(echo); echo.connect(wet).connect(out);
  const padTone = ac.createBiquadFilter(); padTone.type = 'lowpass'; padTone.frequency.value = 500; padTone.connect(out);
  let rand = rng(1), step = 0, next = 0, walk = 2, timer = 0, level = 1;
  const st = { on: false, progress: 0, danger: 0, light: 1 };
  const chord = () => (st.progress > 0.86 ? DAWN : NIGHT)[(step >> 4) & 3];

  function note(freq, at, dur, vol, type, to, attack = 0.01) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); for (const d of to) g.connect(d); o.start(at); o.stop(at + dur + 0.05);
  }
  function tick(at) {
    const c = chord(), beat = step & 15, p = st.progress;
    if (beat === 0) for (const [i, n] of c.entries()) { // the pad: the whole chord, two voices a few cents apart, in over a second
      note(midi(n), at, STEP * 17, 0.035, 'triangle', [padTone], 1.2); note(midi(n) * 1.004, at, STEP * 17, 0.03, 'sawtooth', [padTone], 1.6 + i * 0.1);
    }
    if (beat === 0 || (beat === 8 && p > 0.4)) note(midi(c[0] - 12), at, STEP * 7, 0.09, 'sine', [out], 0.03); // the bass
    // the melody: a walk over two octaves of the chord; rests thin out as dawn comes nearer
    const busy = 0.28 + 0.5 * p, strong = beat % 4 === 0;
    if (rand() < (strong ? busy + 0.3 : busy)) {
      walk = Math.max(0, Math.min(7, walk + (rand() < 0.5 ? -1 : 1) * (rand() < 0.25 ? 2 : 1)));
      note(midi(c[walk % 4] + 12 * (1 + (walk >> 2))), at, STEP * (strong ? 3 : 1.6), strong ? 0.06 : 0.04, 'sine', [out, echo]);
    }
    // danger: a low heartbeat, two close pulses a beat, louder as it grows
    if (st.danger > 0.15 && (beat % 4 === 0 || beat % 4 === 1)) note(midi(c[0] - 24), at, 0.22, 0.16 * st.danger * (beat % 4 ? 0.6 : 1), 'sine', [out]);
    // a fading flame: one thin high note held over the bar
    if (st.light < 0.28 && beat === 4) note(midi(c[2] + 24), at, STEP * 10, 0.02, 'sine', [out, echo], 0.8);
    padTone.frequency.setTargetAtTime(400 + 1800 * p * p + (p > 0.86 ? 1500 : 0), at, 0.8);
  }
  function pump() {
    if (ac.state !== 'running') return;
    if (next < ac.currentTime) next = ac.currentTime + 0.05; // after a pause or a slow tab: go on from now, do not catch up
    while (next < ac.currentTime + AHEAD) { if (st.on) tick(next); step++; next += STEP; }
  }
  return {
    start(seed = 1) { rand = rng(seed); step = 0; walk = 2; next = 0; clearInterval(timer); timer = setInterval(pump, 100); },
    stop() { clearInterval(timer); timer = 0; out.gain.setTargetAtTime(0, ac.currentTime, 0.2); },
    set(v) { Object.assign(st, v); out.gain.setTargetAtTime(st.on ? level : 0, ac.currentTime, st.on ? 0.6 : 0.25); },
    chime(n) { const c = chord(); return midi(c[n % 4] + 12 * (2 + Math.min(1, n >> 2))); },
    volume(v) { level = Math.max(0, Math.min(1, v)); },
    get step() { return step; }, get state() { return { ...st }; },
  };
}
