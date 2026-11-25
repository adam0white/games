// Music claims a game's bots.mjs shares (kit/music.js in a game, 2026-11-24). Node only: a stand-in audio context whose
// clock runs with the sim, pumped every 0.1 s as the page's timer does. Lantern's own bots.mjs has the same claims inline.
//   const b = bench({ preset: 'bell', ... });   b.song is the score; call b.advance(dt) after each sim step
//   b.mood({ on, progress, danger, light })      the page's song.set each frame
//   b.heard({ notes, misses, blows })            the page's ember / miss / hit for what the game did this step;
//                                                every note it gets back is checked (claims below) and counted
//   b.report(label)                              a line of numbers; b.fail holds the failures
// Claims on every note: on the sixteenth grid of the score's clock; no sooner than 30 ms and no later than one sixteenth
// (plus notes already waiting) after the step that earned it; a chord tone of the pad sounding at its step; the next note of
// the run's tune in order. A blow thins the music for two bars, and no harmony note is scheduled inside a thinned stretch.
import { music, PRESETS, tune, ladder } from '../music.js';

const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
const node = x => ({ connect(d) { return d; }, ...x });
export const fakeAc = () => ({ destination: node(), createGain: () => node({ gain: param() }), createDelay: () => node({ delayTime: param() }), createBiquadFilter: () => node({ frequency: param(), Q: param() }), createOscillator: () => node({ frequency: param(), start() {}, stop() {} }) });

export function bench(opts, seed = 1) {
  let clock = 0, pumped = 0, k = 0;
  const P = { ...PRESETS[opts.preset ?? 'lantern'], ...opts };
  const song = music(fakeAc(), { ...opts, timer: false, now: () => clock, running: () => true, log: 1e6 });
  const melody = tune(seed), fail = [], n = { notes: 0, waits: 0, misses: 0, blows: 0, worst: 0 };
  song.start(seed);
  const where = () => `seed ${seed} at ${clock.toFixed(2)} s`;
  return {
    song, fail, n, P, get clock() { return clock; },
    advance(dt) { clock += dt; if (clock - pumped >= 0.1) { song.pump(); pumped = clock; } },
    mood(m) { song.set(m); },
    heard({ notes = 0, misses = 0, blows = 0 }) {
      for (let i = 0; i < blows; i++) { song.hit(); n.blows++; if (song.state.on && !song.bare) fail.push(`${where()}: a blow did not thin the music`); }
      for (let i = 0; i < misses; i++) { song.miss(); n.misses++; }
      const got = [];
      for (let i = 0; i < notes; i++) {
        const e = song.ember(); if (!e) { n.waits++; continue; } n.notes++; got.push(e);
        const late = e.at - clock, grid = (e.at - song.next) / song.HALF; n.worst = Math.max(n.worst, late);
        if (late < 0.03 - 1e-9 || late > 0.03 + 5 * song.HALF) fail.push(`${where()}: a note ${(late * 1000).toFixed(0)} ms after its moment`);
        if (Math.abs(grid - Math.round(grid)) > 1e-6) fail.push(`${where()}: a note off the sixteenth grid`);
        const pad = song.log.findLast(l => l.kind === 'pad' && l.step === (e.step & ~15)), major = pad ? pad.major : song.state.progress > P.turn;
        const c = (major ? P.major : P.minor)[(e.step >> 4) & 3].map(m => m + (P.key ?? 0));
        if (!c.some(m => (e.midi - m) % 12 === 0)) fail.push(`${where()}: ${e.midi} is not in the chord at step ${e.step}`);
        if (e.midi !== ladder(c, melody[k++ % melody.length])) fail.push(`${where()}: note ${k} is not the tune's`);
      }
      return got;
    },
    // After the run: the thinned stretches are two bars, and no harmony note sounds inside one.
    close() {
      for (const l of song.log) if (l.kind === 'back') { const bare = l.at - song.log.findLast(b => b.kind === 'bare' && b.at <= l.at).at; if (bare < 16 * song.STEP - 1e-6 || bare > 18 * song.STEP + 1e-6) fail.push(`seed ${seed}: thinned for ${(bare / song.STEP).toFixed(1)} eighths, not two bars`); }
      song.log.forEach((h, i) => { if (h.kind !== 'harm' && h.kind !== 'arp') return; const j = song.log.findLastIndex((l, q) => q < i && l.kind === 'bare'); if (j >= 0 && h.at < song.log[j + 1].at - 1e-9) fail.push(`seed ${seed}: harmony inside a thinned stretch`); });
      return song.log;
    },
  };
}
