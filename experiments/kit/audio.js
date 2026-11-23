// Sound made in code, for phones. A phone keeps audio silent until it is started inside a touch, and
// iOS Safari may refuse on touch-down, so the kit tries again whenever a finger lifts.
//   const snd = sound({ on: () => save.sound, setup: ctx => { build looping nodes once }, floor: 0.0001 });
//   floor is the gain a note fades to: 0.0001 rings out softly, 0.001 ends sooner at a louder level
//   snd.unlock()   call inside a tap handler (a Play button)
//   snd.tone(440, 0.3, 0.1, 'triangle', slide)   snd.noise(0.12, 0.2, 1800)
//   snd.hold()     silence while paused; snd.release() to go on
// An iPhone with its silent switch on mutes Web Audio in the default session (tester t1, note #80: "there is no sound").
// When the game's sound is on, the kit asks for the 'playback' audio session (Safari 16.4+), which plays through the
// silent switch, as a video does. It also pauses music from other apps. The game's own Sound button stays the way to mute.
export function sound({ on = () => true, setup = null, floor = 0.0001 } = {}) {
  let ctx = null, held = false;
  function get() {
    if (!on()) return null;
    try {
      if (!ctx) {
        try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
        ctx = new (window.AudioContext || window.webkitAudioContext)(); setup?.(ctx);
      }
      if (ctx.state === 'suspended' && !held) ctx.resume();
    } catch { return null; }
    return ctx;
  }
  for (const type of ['pointerup', 'touchend', 'click']) addEventListener(type, () => { try { if (ctx && ctx.state === 'suspended' && !held && on()) ctx.resume(); } catch {} });
  return {
    get ctx() { return ctx; },
    unlock: get,
    hold() { held = true; try { ctx?.suspend(); } catch {} },
    release() { held = false; try { if (on()) ctx?.resume(); } catch {} },
    // A note that fades out. `slide` moves the pitch by that many hertz over the note.
    tone(freq, dur = 0.08, vol = 0.12, type = 'sine', slide = 0) {
      const ac = get(); if (!ac) return;
      try {
        const o = ac.createOscillator(), v = ac.createGain(), t = ac.currentTime;
        o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
        v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(floor, t + dur);
        o.connect(v).connect(ac.destination); o.start(t); o.stop(t + dur);
      } catch {}
    },
    // A short burst of filtered noise: a crunch, a splash.
    noise(dur = 0.12, vol = 0.2, hz = 1800) {
      const ac = get(); if (!ac) return;
      try {
        const n = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = 0.8; v.gain.value = vol;
        src.connect(f).connect(v).connect(ac.destination); src.start();
      } catch {}
    },
  };
}
