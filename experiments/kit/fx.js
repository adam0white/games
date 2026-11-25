// Feedback for every action through one call, so a check can see that each action answered.
//   import { feedback } from '../../kit/fx.js';
//   const { fx, bump, log } = feedback({ canSound: () => save.sound });
//   fx('ring', () => snd.tone(660, 0.2, 0.05), () => bump('#pause'));
// fx(name, sound, motion): names the action in the log, plays the sound when canSound() is true, then runs the motion.
// bump(selectorOrElement): restarts a short scale pulse on an element (class kit-bump; reduced motion gets none).
// log() returns a copy of the last 200 names, oldest first. Never throws.
// Written for lab/ring when lab/pitch had grown the same helper.
let sheet = false;
function style() {
  if (sheet) return; sheet = true;
  try {
    const el = document.createElement('style');
    el.textContent = '@keyframes kit-bump{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}.kit-bump{animation:kit-bump .22s ease-out}@media (prefers-reduced-motion: reduce){.kit-bump{animation:none}}';
    document.head.append(el);
  } catch {}
}
export function feedback({ canSound = () => true, size = 200 } = {}) {
  const names = [];
  function fx(name, sound, motion) {
    names.push(String(name)); if (names.length > size) names.shift();
    try { if (sound && canSound()) sound(); } catch {}
    try { if (motion) motion(); } catch {}
  }
  function bump(where) {
    try {
      style();
      const el = typeof where === 'string' ? document.querySelector(where) : where;
      if (!el) return;
      el.classList.remove('kit-bump'); void el.offsetWidth; el.classList.add('kit-bump');
    } catch {}
  }
  return { fx, bump, log: () => names.slice() };
}
