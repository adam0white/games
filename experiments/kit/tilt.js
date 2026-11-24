// Steering by tilting the phone (Lantern's first person, note #203). The lean is measured from gravity, so a phone held flat, upright or
// turned like a steering wheel all work, in portrait and landscape.
//   const tilt = tiltSteer();
//   tilt.ask()     start listening. Call it inside a click: iPhones show a permission prompt, and only from a click. Safe to call again.
//   tilt.live()    true while the phone is sending readings. False on a computer, or when permission was refused: offer another control then.
//   tilt.asking()  true while the permission prompt is open: hold the game still
//   tilt.zero()    how the phone is held now counts as straight (the start of a run, the end of a pause), up to MOST degrees
//   tilt.awake(x)  call every frame: true keeps the screen on
//   tilt.lean()    degrees from straight: negative left, positive right; 0 when not live
const MOST = 15, FRESH = 1500;
export function tiltSteer() {
  let lock = null, held = null, on = false, waiting = 0, raw = 0, at = -Infinity, base = 0, pending = false;
  const read = e => {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return; // a computer may send one event with no numbers
    const r = Math.PI / 180, b = e.beta * r, c = e.gamma * r, ux = -Math.cos(b) * Math.sin(c), uy = Math.sin(b); // "up" in the phone's own axes
    const turn = (window.orientation ?? screen.orientation?.angle ?? 0) * r;
    raw = Math.asin(Math.max(-1, Math.min(1, uy * Math.sin(turn) - ux * Math.cos(turn)))) / r;
    if (pending) { pending = false; set(); }
    at = performance.now();
  };
  const set = () => { base = Math.max(-MOST, Math.min(MOST, raw)); };
  const live = () => on && performance.now() - at < FRESH;
  const start = () => { if (!on) { on = true; addEventListener('deviceorientation', read); } };
  return {
    ask() {
      const D = window.DeviceOrientationEvent; if (!D || on) return;
      if (typeof D.requestPermission !== 'function') { start(); return; }
      if (performance.now() - waiting < 20000 && waiting) return;
      waiting = performance.now(); const done = () => { waiting = 0; };
      try { D.requestPermission().then(a => { done(); if (a === 'granted') start(); }, done); } catch { done(); }
    },
    awake(want) { // a phone steered by tilt sees no touches, so it would dim and lock
      if (!want) { held = null; lock?.release?.().catch(() => {}); lock = null; return; }
      if (lock || held) return; const mine = held = {};
      navigator.wakeLock?.request('screen').then(l => { if (held !== mine) { l.release().catch(() => {}); return; } lock = l; l.addEventListener('release', () => { if (lock === l) { lock = null; held = null; } }); }, () => {});
    },
    asking: () => waiting > 0 && performance.now() - waiting < 20000,
    live,
    zero() { if (live()) set(); else pending = true; }, // no reading yet: the first one counts as straight
    lean: () => (live() ? raw - base : 0),
  };
}
