// The score for Lantern Rhythm. Copied from lab/lantern-song/music.js and rebuilt so that the river drives it.
// No samples, no libraries: Web Audio only. The score keeps no clock of its own. Every frame the page tells it where
// the boat is on the beat grid (sim beat, read from s.y), and it schedules the eighth notes of the next AHEAD seconds on
// the audio clock from that position. So the music cannot drift from the river, and when the game pauses both stop.
//   const song = music(ac, plan)      plan(beat) says what sits on a whole beat: { rocks: [{ big, gate, pan }], chord, bare, harmony, accent }
//   song.start(spb)                   a new run; spb is seconds a beat
//   song.sync(beat, layers, hold)     every frame while the run plays; layers: { bare, harmony } now; hold: the river is held still
//   song.ember(beat, midi, pan, harm) an ember was taken: its melody note, at its off-beat
//   song.cut()                        pause: stop every note already scheduled ahead and forget it
//   song.end(chord)                   the run is over: a last chord, then quiet
//   song.log                          what was scheduled: { kind, beat, at } with at on the audio clock (a test reads it)
// Layers: the bare pulse and the rock drums always play; the pad and bass play unless a hit has dropped them for two bars;
// the harmony (an arpeggio on the beats, and a second voice on each ember note) plays while the ember streak is long.
const midi = n => 440 * 2 ** ((n - 69) / 12);
export const AHEAD = 0.25; // seconds of music scheduled ahead of the audio clock

export function music(ac, plan, dest = ac.destination) {
  const out = ac.createGain(); out.gain.value = 0.9; out.connect(dest);
  // a soft echo for the melody, so single notes sit in a space
  const echo = ac.createDelay(1.5), back = ac.createGain(), wet = ac.createGain(); back.gain.value = 0.28; wet.gain.value = 0.3;
  echo.connect(back).connect(echo); echo.connect(wet).connect(out);
  // the pad and bass go through one gain, the harmony through another, so a hit can drop them at once
  const base = ac.createGain(), harm = ac.createGain(); base.gain.value = 1; harm.gain.value = 0; base.connect(out); harm.connect(out);
  const padTone = ac.createBiquadFilter(); padTone.type = 'lowpass'; padTone.frequency.value = 700; padTone.connect(base);
  const len = Math.ceil(ac.sampleRate * 0.2), noise = ac.createBuffer(1, len, ac.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  let spb = 60 / 72, off = null, next = null, fresh = true, settle = 0, held = [], wasHeld = false;
  const live = []; // scheduled sources not yet finished: { at, beat, kind, nodes }
  const log = [], jumps = []; // jumps: each time the anchor was reset by more than 30 ms during play: { beat, ms }

  function record(kind, beat, at, nodes, meta = null) { const entry = { kind, beat, at }; live.push({ entry, at, nodes, meta }); log.push(entry); if (log.length > 600) log.splice(0, log.length - 600); }
  function chain(node, pan, to) {
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(to); return; }
    node.connect(to);
  }
  function tone(freq, at, dur, vol, type, pan, to, attack = 0.005, slide = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur * 0.6);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); for (const t of to) chain(g, pan, t); o.start(at); o.stop(at + dur + 0.05);
    return o;
  }
  function hiss(at, dur, vol, type, hz, pan) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = noise; f.type = type; f.frequency.value = hz; f.Q.value = 0.9;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g); chain(g, pan, out); src.start(at); src.stop(at + dur + 0.02);
    return src;
  }
  // Drums for the rocks: a big rock is a low drum, a small one a click, a gate a snare. Panned to the rock's side.
  const kick = (at, pan) => [tone(150, at, 0.32, 0.55, 'sine', pan, [out], 0.004, 48), hiss(at, 0.02, 0.12, 'lowpass', 900, pan)];
  const click = (at, pan) => [hiss(at, 0.045, 0.35, 'highpass', 4200, pan), tone(2400, at, 0.025, 0.05, 'square', pan, [out], 0.002)];
  const snare = (at, pan) => [hiss(at, 0.16, 0.32, 'bandpass', 1900, pan), tone(200, at, 0.09, 0.18, 'triangle', pan, [out], 0.003, 140)];

  // What plays on eighth note e (beat e / 2).
  function eighth(e, at) {
    const beat = e / 2;
    if (e % 2) return; // off-beats carry only the embers' notes
    const p = plan(beat); if (!p) return;
    // the bare pulse: a soft low thump on every beat, stronger on the first of the bar
    record('pulse', beat, at, [tone(p.accent ? 110 : 98, at, 0.16, p.accent ? 0.2 : 0.11, 'sine', 0, [out], 0.004, 60), tone(1600, at, 0.02, p.accent ? 0.03 : 0.015, 'sine', 0, [out], 0.002)]);
    for (const r of p.rocks) record('rock', beat, at, r.gate ? snare(at, 0) : r.big ? kick(at, r.pan) : click(at, r.pan));
    const c = p.chord;
    if (p.accent) { // the pad: the whole chord over the bar, and the bass
      const nodes = [];
      for (const [i, n] of c.entries()) { nodes.push(tone(midi(n), at, spb * 4.2, 0.03, 'triangle', 0, [padTone], 0.4)); nodes.push(tone(midi(n) * 1.004, at, spb * 4.2, 0.025, 'sawtooth', 0, [padTone], 0.5 + i * 0.05)); }
      record('pad', beat, at, nodes);
    }
    if (beat % 2 === 0) record('bass', beat, at, [tone(midi(c[0] - 12), at, spb * 1.6, 0.12, 'sine', 0, [base], 0.02)]);
    // the harmony: chord tones climbing on the beats
    record('harmony', beat, at, [tone(midi(c[(beat & 3)] + 12), at, spb * 0.9, 0.035, 'triangle', 0, [harm], 0.01)]);
  }

  const at = beat => off + beat * spb;
  return {
    log,
    start(secondsPerBeat) { spb = secondsPerBeat; echo.delayTime.value = spb * 1.5; jumps.length = 0; off = null; next = null; fresh = true; held = []; log.length = 0; base.gain.value = 1; harm.gain.value = 0; out.gain.cancelScheduledValues(ac.currentTime); out.gain.setValueAtTime(0.9, ac.currentTime); },
    // beat: the sim's beat position now. The audio time of beat 0 follows the sim: a jump of more than 30 ms re-anchors
    // at once, smaller differences (frame timing) are smoothed.
    // hold: the page is holding the river still (waiting for the audio clock); anchor only, schedule nothing.
    sync(beat, layers, hold = false) {
      if (ac.state !== 'running') return;
      const now = ac.currentTime, want = now - beat * spb;
      // After a start or a resume the first few readings of the audio clock can jump, so for three frames the anchor
      // follows each reading and nothing new is scheduled.
      if (fresh) { settle = 3; fresh = false; }
      // While the river is held its beat stands still and the audio clock moves on, so on the first frame after a hold the
      // anchor is set afresh from this reading instead of being smoothed towards it.
      if (hold) wasHeld = true; else if (wasHeld) { wasHeld = false; off = want; }
      if (!settle && !hold && off !== null && Math.abs(want - off) > 0.03) { jumps.push({ beat, ms: (want - off) * 1000 }); if (jumps.length > 50) jumps.shift(); }
      if (settle > 0 || hold || off === null || Math.abs(want - off) > 0.03) off = want; else off += (want - off) * 0.1;
      if (settle > 0 && settle--) return;
      if (hold) return;
      if (next === null) next = beat < 0.05 ? 0 : Math.ceil(beat * 2 - 1e-6); // at the start of a run beat 0 itself is played
      const wait = held; held = []; for (const h of wait) this.ember(...h);
      while (at(next / 2) < now + AHEAD) { const t = at(next / 2); if (t >= now - 0.005 || next === 0) eighth(next, Math.max(now, t)); next++; }
      base.gain.setTargetAtTime(layers.bare ? 0 : 1, now, layers.bare ? 0.03 : 0.4);
      harm.gain.setTargetAtTime(layers.harmony && !layers.bare ? 1 : 0, now, 0.15);
      for (let i = live.length - 1; i >= 0; i--) if (live[i].at < now - 2) live.splice(i, 1);
    },
    ember(beat, n, pan, withHarmony) {
      if (ac.state !== 'running' || off === null) { held.push([beat, n, pan, withHarmony]); return; }
      const t = Math.max(ac.currentTime, at(beat)), nodes = [tone(midi(n), t, spb * 0.9, 0.11, 'sine', pan, [out, echo], 0.004), tone(midi(n) * 2, t, 0.12, 0.02, 'sine', pan, [out], 0.002)];
      if (withHarmony) nodes.push(tone(midi(n - 4), t, spb * 0.9, 0.045, 'triangle', pan, [harm], 0.01)); // a third or so below, through the harmony layer
      record('ember', beat, t, nodes, [beat, n, pan, withHarmony]);
    },
    // Pause: stop what was scheduled past now and take it out of the log; embers already taken are kept to play on resume.
    cut() {
      const now = ac.currentTime;
      for (let i = live.length - 1; i >= 0; i--) {
        const n = live[i]; if (n.at <= now) continue;
        for (const x of n.nodes) try { x.stop(); } catch {}
        live.splice(i, 1);
        const j = log.indexOf(n.entry); if (j >= 0) log.splice(j, 1);
        if (n.meta) held.push(n.meta); // an ember already taken plays its note on resume
      }
      next = null; fresh = true;
    },
    end(c, won) {
      const now = ac.currentTime;
      if (won) c.forEach((n, i) => tone(midi(n + 12), now + i * 0.12, 2.4, 0.06, 'triangle', 0, [out, echo], 0.02));
      out.gain.setTargetAtTime(0, now + (won ? 2.5 : 0.4), 0.4); next = null; fresh = true;
    },
    get spb() { return spb; }, get off() { return off; }, jumps,
    get ready() { return !fresh && settle === 0 && off !== null && ac.state === 'running'; }, // anchored and settled: the river may move
  };
}
