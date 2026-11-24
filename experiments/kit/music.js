// A score made in code that follows play. No samples, no libraries: Web Audio only. It came from the lab's Lantern Song
// (Lantern's music since 2026-11-24) and the lab's Lantern Rhythm (the melody made of embers). See README.md, "Music".
//   const song = music(ac, { preset: 'lantern' });   build once, inside the kit's sound setup (audio.js `setup`)
//   song.start(seed)                  a new level or night: its own tune, from the seed
//   song.set({ on, progress, danger, light })   every frame. on: a run is in play (false fades to silence);
//                                     progress, danger, light: 0 to 1 (light low = nearly out)
//   song.ember()                      a pickup: the next note of the tune, on the next sixteenth, inside the chord then;
//                                     null when the song is not on (play your own sound then)
//   song.miss()  song.hit()           a pickup passed by (the streak ends); a blow (the streak ends and the layers drop for two bars)
//   song.chime(n)                     a pitch (hertz) inside the chord now playing, for a sound the game plays itself
//   song.volume(v)  song.stop()       0 to 1; stop the clock and fade out
//   song.melody                       { played, missed, streak, best, share }   song.log: what was scheduled (tests read it)
// How it works: a clock of eighth notes scheduled a little ahead on the audio clock, so it stays in time when frames drop
// and stands still when the context is suspended for a pause. Layers: a slow pad on the chord, a bass, a plucked walk that
// gets busier towards the end, a low pulse with danger, one high held note when the light is nearly out, and the tune the
// pickups play. A streak of 4 adds a second voice under each pickup note; a streak of 8 adds a climbing arpeggio. A blow
// drops pad, bass, walk and harmony for two bars (16 eighths); the pickups' tune, the pulse and the high note stay.
// Minor chords until progress passes `turn`, then major: the ending is heard before it is seen.
const midi = n => 440 * 2 ** ((n - 69) / 12);
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Chords as MIDI numbers, four voices each, one chord every 16 eighths. Lantern's: D minor at night, D major at dawn.
export const NIGHT = [[50, 53, 57, 60], [46, 50, 53, 58], [53, 57, 60, 64], [48, 52, 55, 62]];   // Dm7, Bb, F maj7, C add9
export const DAWN = [[50, 54, 57, 62], [55, 59, 62, 66], [57, 61, 64, 69], [50, 54, 57, 66]];    // D, G maj7, A, D

// Voices: how each layer sounds. `n` is a MIDI number; `play(freq, at, dur, vol, type, to, attack)` makes one note.
// `to` names the layer's outputs: pad, base (bass), walk, out (dry), echo, harm, lead.
const lanternVoice = {
  pad(play, n, i, at, len) { play(midi(n), at, len, 0.035, 'triangle', ['pad'], 1.2); play(midi(n) * 1.004, at, len, 0.03, 'sawtooth', ['pad'], 1.6 + i * 0.1); },
  bass(play, n, at, len) { play(midi(n), at, len, 0.09, 'sine', ['base'], 0.03); },
  walk(play, n, at, len, strong) { play(midi(n), at, len, strong ? 0.06 : 0.04, 'sine', ['walk']); },
  pulse(play, n, at, vol) { play(midi(n), at, 0.22, vol, 'sine', ['out']); },
  high(play, n, at, len) { play(midi(n), at, len, 0.02, 'sine', ['out', 'echo'], 0.8); },
  lead(play, n, at, step) { play(midi(n), at, 0.5, 0.1, 'triangle', ['lead', 'echo'], 0.006); play(midi(n) * 2, at, 0.14, 0.012, 'sine', ['lead'], 0.003); },
  harm(play, n, at, step) { play(midi(n), at, step * 2, 0.04, 'triangle', ['harm'], 0.012); },
  arp(play, n, at, step) { play(midi(n), at, step * 1.8, 0.028, 'triangle', ['harm'], 0.01); },
  padCut: (p, turned) => 400 + 1800 * p * p + (turned ? 1500 : 0),
  echo: { steps: 3, back: 0.32, wet: 0.35 },
};
// A river: a thinner pad and plucked notes in a wider echo.
const riverVoice = {
  ...lanternVoice,
  pad(play, n, i, at, len) { play(midi(n), at, len, 0.04, 'triangle', ['pad'], 1.5 + i * 0.1); },
  walk(play, n, at, len, strong) { play(midi(n), at, Math.min(len, 0.7), strong ? 0.07 : 0.045, 'triangle', ['walk'], 0.004); },
  lead(play, n, at) { play(midi(n), at, 0.45, 0.1, 'triangle', ['lead', 'echo'], 0.003); play(midi(n) * 3, at, 0.08, 0.01, 'sine', ['lead'], 0.002); },
  padCut: (p, turned) => 600 + 1400 * p + (turned ? 1200 : 0),
  echo: { steps: 3, back: 0.4, wet: 0.45 },
};
// A soft bell (a pasture): sine notes with a quiet bell partial that dies first.
const bellVoice = {
  ...lanternVoice,
  pad(play, n, i, at, len) { play(midi(n), at, len, 0.035, 'sine', ['pad'], 2 + i * 0.1); },
  walk(play, n, at, len, strong) { play(midi(n), at, len * 1.4, strong ? 0.05 : 0.035, 'sine', ['walk'], 0.004); play(midi(n) * 2.76, at, len * 0.4, 0.008, 'sine', ['walk'], 0.002); },
  lead(play, n, at) { play(midi(n), at, 1.3, 0.09, 'sine', ['lead', 'echo'], 0.003); play(midi(n) * 2.76, at, 0.4, 0.02, 'sine', ['lead'], 0.002); },
  padCut: (p, turned) => 900 + 900 * p + (turned ? 900 : 0),
  echo: { steps: 4, back: 0.3, wet: 0.3 },
};
// A flute-like voice (a garden): slow attack and a small vibrato.
const fluteVoice = {
  ...bellVoice,
  walk(play, n, at, len, strong) { play(midi(n), at, len, strong ? 0.05 : 0.035, 'sine', ['walk'], 0.06, 5); },
  lead(play, n, at) { play(midi(n), at, 0.6, 0.09, 'sine', ['lead', 'echo'], 0.05, 5.5); play(midi(n) * 2, at, 0.3, 0.008, 'sine', ['lead'], 0.05); },
  padCut: (p, turned) => 700 + 1100 * p + (turned ? 1000 : 0),
  echo: { steps: 3, back: 0.25, wet: 0.3 },
};
export const VOICES = { lantern: lanternVoice, river: riverVoice, bell: bellVoice, flute: fluteVoice };
// A preset is a voice with its tempo, key (semitones from D) and chords. A game may override any field.
export const PRESETS = {
  lantern: { voice: 'lantern', bpm: 72, key: 0, minor: NIGHT, major: DAWN, turn: 0.86 },
  river: { voice: 'river', bpm: 76, key: 2, minor: NIGHT, major: DAWN, turn: 0.86 },
  bell: { voice: 'bell', bpm: 66, key: -2, minor: NIGHT, major: DAWN, turn: 0.8 },
  flute: { voice: 'flute', bpm: 80, key: 5, minor: NIGHT, major: DAWN, turn: 0.8 },
};

// The tune the pickups play: 16 places on a ladder of chord tones (0 to 6; 0 to 3 are the chord's four notes two
// octaves up, 4 to 6 the next octave). Two phrases of eight; the first ends open, the second ends on the root.
// Because a place is a chord tone and not a fixed pitch, every note fits whichever chord is sounding when it plays.
export function tune(seed) {
  const r = rng((seed ^ 0x2545F491) >>> 0), a = [];
  let d = r() < 0.5 ? 2 : 4;
  for (let i = 0; i < 8; i++) {
    a.push(d);
    const up = i < 4 ? 0.65 : 0.35, size = r() < 0.25 ? 2 : r() < 0.08 ? 0 : 1;
    d = Math.max(0, Math.min(6, d + (r() < up ? size : -size)));
  }
  a[7] = r() < 0.5 ? 1 : 5; // open: the third, not the root
  const b = a.slice(0, 4); let e = b[3];
  for (let i = 4; i < 7; i++) { e = Math.max(0, Math.min(6, e + (r() < 0.3 ? 1 : -1))); b.push(e); }
  b.push(e >= 2 ? 4 : 0); // home: the root
  return [...a, ...b];
}
export const ladder = (chord, d, key = 0) => chord[((d % 4) + 4) % 4] + 12 * (2 + Math.floor(d / 4)) + key;

export function music(ac, opts = {}) {
  if (opts && typeof opts.connect === 'function') opts = { dest: opts }; // music(ac, node), as Lantern's first version took
  const P = { ...PRESETS[opts.preset ?? 'lantern'] ?? PRESETS.lantern, ...opts };
  const V = typeof P.voice === 'string' ? VOICES[P.voice] ?? lanternVoice : { ...lanternVoice, ...P.voice };
  const STEP = 60 / P.bpm / 2, HALF = STEP / 2, AHEAD = 0.35, LEAD = 0.03, STRIP = P.strip ?? 16, KEY = P.key ?? 0, LOG = P.log ?? 400; // log: entries kept for tests
  const now = P.now ?? (() => ac.currentTime), running = P.running ?? (() => ac.state === 'running'); // a test may drive both
  const out = ac.createGain(); out.gain.value = 0; out.connect(P.dest ?? ac.destination);
  // a soft echo, so single notes sit in a space
  const echo = ac.createDelay(1.5), back = ac.createGain(), wet = ac.createGain(); echo.delayTime.value = STEP * V.echo.steps; back.gain.value = V.echo.back; wet.gain.value = V.echo.wet;
  echo.connect(back).connect(echo); echo.connect(wet).connect(out);
  // The layers a blow drops (pad and bass, walk, harmony) each have a gain; the pickups' tune has its own.
  const gain = to => { const g = ac.createGain(); g.gain.value = 1; g.connect(to); return g; };
  const base = gain(out), walkG = gain(out), harm = gain(out), lead = gain(out); walkG.connect(echo);
  const padTone = ac.createBiquadFilter(); padTone.type = 'lowpass'; padTone.frequency.value = 500; padTone.connect(base);
  const bus = { pad: padTone, base, walk: walkG, out, echo, harm, lead };
  let rand = rng(1), notes = tune(1), step = 0, next = 0, walk = 2, timer = 0, level = 1;
  let k = 0, streak = 0, best = 0, played = 0, missed = 0, lastSlot = -1, bareTo = -1;
  const st = { on: false, progress: 0, danger: 0, light: 1 };
  const log = [];
  const chords = s => (st.progress > P.turn ? P.major : P.minor)[(s >> 4) & 3].map(n => n + KEY);
  const chord = () => chords(step);

  function play(freq, at, dur, vol, type, to, attack = 0.01, vib = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    if (vib) { const l = ac.createOscillator(), d = ac.createGain(); l.frequency.value = vib; d.gain.value = freq * 0.006; l.connect(d).connect(o.frequency); l.start(at); l.stop(at + dur + 0.05); }
    o.connect(g); for (const d of to) g.connect(bus[d]); o.start(at); o.stop(at + dur + 0.05);
  }
  function note(kind, at, s, n) { log.push({ kind, at, step: s, n }); if (log.length > LOG) log.splice(0, log.length - LOG); }
  function tick(at) {
    const c = chord(), beat = step & 15, p = st.progress;
    if (beat === 0) { for (const [i, n] of c.entries()) V.pad(play, n, i, at, STEP * 17); note('pad', at, step, c[0]); } // the whole chord, in over a second
    if (beat === 0 || (beat === 8 && p > 0.4)) { V.bass(play, c[0] - 12, at, STEP * 7); note('bass', at, step, c[0] - 12); }
    // the walk: two octaves of the chord; rests thin out towards the end
    const busy = 0.28 + 0.5 * p, strong = beat % 4 === 0;
    if (rand() < (strong ? busy + 0.3 : busy)) {
      walk = Math.max(0, Math.min(7, walk + (rand() < 0.5 ? -1 : 1) * (rand() < 0.25 ? 2 : 1)));
      const n = c[walk % 4] + 12 * (1 + (walk >> 2)); V.walk(play, n, at, STEP * (strong ? 3 : 1.6), strong); note('walk', at, step, n);
    }
    // danger: a low heartbeat, two close pulses a beat, louder as it grows
    if (st.danger > 0.15 && (beat % 4 === 0 || beat % 4 === 1)) { V.pulse(play, c[0] - 24, at, 0.16 * st.danger * (beat % 4 ? 0.6 : 1)); note('pulse', at, step, c[0] - 24); }
    // a fading light: one thin high note held over the bar
    if (st.light < 0.28 && beat === 4) { V.high(play, c[2] + 24, at, STEP * 10); note('high', at, step, c[2] + 24); }
    // a long streak: chord tones climbing on the beats
    if (streak >= 8 && step % 2 === 0 && at >= bareTo) { const n = c[(step >> 1) & 3] + 12; V.arp(play, n, at, STEP); note('arp', at, step, n); }
    padTone.frequency.setTargetAtTime(V.padCut(p, p > P.turn), at, 0.8);
  }
  function pump() {
    if (!running()) return;
    const t = now();
    if (next < t) next = t + 0.05; // after a slow tab: go on from now, do not catch up
    while (next < t + AHEAD) { if (st.on) tick(next); step++; next += STEP; }
  }
  // The walk steps aside while the player is playing the tune.
  const duck = () => walkG.gain.setTargetAtTime(streak >= 2 ? 0.45 : 1, Math.max(now(), bareTo), 0.15);
  return {
    start(seed = 1) {
      rand = rng(seed); notes = tune(seed); step = 0; walk = 2; next = 0; k = streak = best = played = missed = 0; lastSlot = bareTo = -1; log.length = 0;
      const t = now(); for (const g of [base, walkG, harm]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(1, t); }
      clearInterval(timer); timer = P.timer === false ? 0 : setInterval(pump, 100);
    },
    stop() { clearInterval(timer); timer = 0; out.gain.setTargetAtTime(0, now(), 0.2); },
    set(v) { Object.assign(st, v); out.gain.setTargetAtTime(st.on ? level : 0, now(), st.on ? 0.6 : 0.25); },
    chime(n) { const c = chord(); return midi(c[n % 4] + 12 * (2 + Math.min(1, n >> 2))); },
    // A pickup: the next note of the tune on the next free sixteenth at least LEAD from now (208 ms at most at 72 a minute),
    // pitched from the chord of the eighth it falls in. At most four notes wait; a fifth pickup in that time plays no note.
    // It counts towards the streak and `melody` even when the song is off; it schedules a note only when on.
    ember() {
      streak++; best = Math.max(best, streak); played++;
      if (!st.on || !running()) return null;
      duck(); if (!next) pump();
      const t = now() + LEAD;
      let slot = next - Math.floor((next - t) / HALF) * HALF; if (slot < t - 1e-9) slot += HALF;
      if (P.mutate === 'grid') slot = t; // test only (lantern/bots.mjs --mutate): no quantising
      if (slot <= lastSlot + 1e-6) slot = lastSlot + HALF;
      if (slot > t + 4 * HALF) return null;
      lastSlot = slot;
      const s = Math.floor(step - (next - slot) / STEP + 1e-6), c = P.mutate === 'chord' ? chord() : chords(s), d = notes[k++ % notes.length], n = ladder(c, d); // mutate 'chord', test only: the chord the clock has scheduled up to
      V.lead(play, n, slot, STEP); note('ember', slot, s, n);
      if (streak >= 4 && slot >= bareTo) { const h = ladder(c, d - 2); V.harm(play, h, slot, STEP); note('harm', slot, s, h); }
      return { at: slot, midi: n, freq: midi(n), step: s, index: k - 1 };
    },
    miss() { streak = 0; missed++; duck(); },
    // A blow: the streak ends; pad, bass, walk and harmony drop now and come back on the beat two bars later.
    hit() {
      streak = 0; if (!st.on) return;
      const t = now(), back = t + STRIP * STEP; bareTo = next ? next + Math.ceil((back - next) / (2 * STEP)) * 2 * STEP : back;
      for (const g of [base, walkG, harm]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.03); g.gain.setTargetAtTime(1, bareTo, 0.4); }
      note('bare', t, step, 0); note('back', bareTo, step, 0);
    },
    pump,
    volume(v) { level = Math.max(0, Math.min(1, v)); },
    get melody() { return { played, missed, streak, best, index: k, share: played + missed ? played / (played + missed) : 1 }; },
    get bare() { return now() < bareTo; },
    get step() { return step; }, get state() { return { ...st }; }, get next() { return next; },
    log, out, STEP, HALF, tune: () => notes.slice(),
  };
}
