// Help for a first-time player: after a few seconds of play with no input, a see-through copy of the control near the bottom
// of the screen, with a finger showing how to use it. It goes on the first real input and does not come back.
//   const help = hint(canvas, { kind: 'stick', key: 'ant-promotion:hint', when: () => mode === 'play', played: readJson(KEY) !== null });
//   kind    'stick' (a floating joystick: the finger presses and circles the knob) or 'drag' (relative steering: the finger
//           slides side to side). A new kind is a new entry in KINDS below; callers do not change.
//   key     a new save.js key, '1' once the player has used the control. Then the hint never shows again on this device.
//   when    true while the run is in play and no card covers it. Idle time counts only then and adds up across runs, so a
//           run that ends before the delay still leads to the hint in the next one. The hint hides while it is false.
//   played  true when the game's own save, read at load, shows the player has played before. Then it never shows.
//   delay   ms of idle play before it shows (3000)
//   look    'hand' (a pointing hand) or 'ring' (the knob alone, with a press ring); the default is 'hand'
//   label   words shown with a still copy when the player asks for reduced motion; each kind has its own
//   reach   the stick's reach in px, so the copy is the size of the stick the game draws (55)
//   bottom  px from the bottom of the screen (above the safe area) to the middle of the copy (120); keep it clear of the player
//   help.shown   true while it is on screen
//   help.done()  put it away for good and remember the player (the game saw input some other way)
// Input that ends it: a pointer going down on `el`, or a key that is not a pause key, while `when()` is true (for `drag`, a
// mouse moving over `el` too). The tap on Play
// and taps on cards do not count. It never takes input itself (pointer-events: none) and never cancels an event.
// On any page, ?hint=hand or ?hint=ring shows it whatever the save says, with that look, and ?hint=0 turns it off.
import { read, write } from './save.js';
import { isPauseKey } from './pause.js';

const CSS = `
.kit-hint, .kit-hint * { pointer-events: none !important; touch-action: none; -webkit-user-select: none; user-select: none; }
.kit-hint { position: fixed; left: 50%; bottom: calc(var(--kit-hint-bottom, 120px) + env(safe-area-inset-bottom)); width: 0; height: 0; display: none; }
.kit-hint.on { display: block; animation: kit-hint-in .6s ease-out; }
@keyframes kit-hint-in { from { opacity: 0; } }
.kit-hint .ring { position: absolute; border-radius: 50%; border: 3px solid #ffffff66; box-sizing: border-box; background: #ffffff0f; }
.kit-hint .knob { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; background: #ffffff70; box-shadow: 0 1px 6px #0006; }
.kit-hint .knob::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 2px solid #fff; opacity: var(--press, 0); transform: scale(calc(1.25 - .25 * var(--press, 0))); }
.kit-hint .hand { position: absolute; left: -17px; top: -3px; width: 40px; height: 52px; transform-origin: 17px 3px; filter: drop-shadow(0 1px 2px #000c); opacity: .92; }
.kit-hint .track { position: absolute; top: -22px; height: 44px; border-radius: 22px; border: 3px solid #ffffff55; box-sizing: border-box; background: #ffffff0f; }
.kit-hint .track::before, .kit-hint .track::after { position: absolute; top: 50%; transform: translateY(-52%); font: bold 26px/1 system-ui, sans-serif; color: #ffffffaa; }
.kit-hint .track::before { content: '\\2039'; left: 12px; } .kit-hint .track::after { content: '\\203A'; right: 12px; }
.kit-hint .label { position: absolute; left: -9em; width: 18em; text-align: center; font: bold 17px/1.25 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 4px #000; display: none; }
.kit-hint.still .label { display: block; }
@media (prefers-reduced-motion: reduce) { .kit-hint.on { animation: none; } }
`;
// A pointing hand, fingertip at (16.5, 3). Plain shapes, filled; the drop shadow draws its outline.
const HAND = '<svg viewBox="0 0 40 52" aria-hidden="true"><g fill="#fff"><rect x="12" y="1" width="9" height="32" rx="4.5"/><rect x="20" y="17" width="8.5" height="17" rx="4.25"/><rect x="27.5" y="20" width="8" height="15" rx="4"/><rect x="8" y="25" width="28" height="26" rx="9"/><rect x="2" y="27" width="8" height="17" rx="4" transform="rotate(-32 6 40)"/></g></svg>';

const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
// Each kind draws its control into `box` and returns where the label goes (px from the middle; above, clear of the hand), and place(t, still): where the finger is (px from the centre) and how hard it presses (0 to 1).
const KINDS = {
  stick: {
    label: 'Touch and drag to move',
    build(box, { reach }) {
      const ring = document.createElement('div'); ring.className = 'ring';
      Object.assign(ring.style, { left: `${-reach}px`, top: `${-reach}px`, width: `${2 * reach}px`, height: `${2 * reach}px` });
      box.prepend(ring);
      return { cycle: 3400, labelAt: -reach - 34, place(t, still) {
        if (still) return { x: reach * 0.55, y: -reach * 0.55, press: 1 };
        const out = reach * 0.8; let r = 0, a = -Math.PI / 2, press = 1;
        if (t < 350) press = ease(t / 350); // finger goes down in the middle
        else if (t < 800) r = out * ease((t - 350) / 450); // pushes up
        else if (t < 2500) { r = out; a += 2 * Math.PI * ease((t - 800) / 1700); } // goes once round
        else if (t < 2850) r = out * (1 - ease((t - 2500) / 350)); // back to the middle
        else press = 1 - ease((t - 2850) / 300); // and lifts
        return { x: r * Math.cos(a), y: r * Math.sin(a), press };
      } };
    },
  },
  drag: {
    hover: true, // drag.js steers by a mouse that moves with no button down, so that is input too
    label: 'Slide your finger sideways to steer',
    build(box, { reach }) {
      const span = Math.round(reach * 1.4), track = document.createElement('div'); track.className = 'track';
      Object.assign(track.style, { left: `${-span - 22}px`, width: `${2 * span + 44}px` });
      box.prepend(track);
      return { cycle: 2600, labelAt: -58, place(t, still) {
        if (still) return { x: span * 0.6, y: 0, press: 1 };
        const press = t < 250 ? ease(t / 250) : t > 2350 ? 1 - ease((t - 2350) / 250) : 1;
        return { x: span * Math.sin(2 * Math.PI * ease(Math.min(1, t / 2350))), y: 0, press };
      } };
    },
  },
};

export function hint(el, { kind = 'stick', key, when, played = false, delay = 3000, look = 'hand', label, reach = 55, bottom = 120 }) {
  const asked = new URLSearchParams(location.search).get('hint'), forced = asked === 'hand' || asked === 'ring';
  if (forced) look = asked;
  let over = asked === '0' || (!forced && (played || read(key) === '1'));
  const handle = { get shown() { return !over && box?.classList.contains('on'); }, done: () => finish() };
  if (over || !KINDS[kind]) { over = true; return handle; }
  if (!document.getElementById('kit-hint-css')) { const st = document.createElement('style'); st.id = 'kit-hint-css'; st.textContent = CSS; document.head.append(st); }
  const box = document.createElement('div'); box.className = 'kit-hint'; box.style.setProperty('--kit-hint-bottom', `${bottom}px`); box.dataset.kind = kind; box.dataset.look = look;
  const knob = document.createElement('div'); knob.className = 'knob';
  const hand = document.createElement('div'); hand.className = 'hand'; hand.innerHTML = HAND;
  const words = document.createElement('div'); words.className = 'label'; words.textContent = label ?? KINDS[kind].label;
  box.append(knob, words); if (look === 'hand') box.append(hand);
  const k = KINDS[kind].build(box, { reach }); words.style.top = `${k.labelAt}px`;
  el.after(box); // after the game's canvas, so every card later in the page covers it
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let idle = 0, last = performance.now(), from = 0, frame = requestAnimationFrame(tick);
  function tick(now) {
    const dt = Math.min(now - last, 250); last = now; // a slow phone still counts real time; a page put away and back does not jump
    const on = when() && (idle += dt) >= delay;
    if (on !== box.classList.contains('on')) { box.classList.toggle('on', on); from = now; }
    if (on) {
      const still = calm.matches, p = k.place(still ? 0 : (now - from) % k.cycle, still);
      box.classList.toggle('still', still);
      knob.style.transform = hand.style.transform = `translate(${p.x}px, ${p.y}px)`;
      knob.style.setProperty('--press', p.press); hand.style.transform += ` scale(${1.08 - 0.08 * p.press})`;
    }
    frame = requestAnimationFrame(tick);
  }
  function finish() {
    if (over) return; over = true;
    write(key, '1'); cancelAnimationFrame(frame); box.remove();
    el.removeEventListener('pointerdown', touched, true); el.removeEventListener('pointermove', hovered, true); removeEventListener('keydown', pressed, true);
  }
  const touched = () => { if (when()) finish(); };
  const pressed = e => { if (when() && !isPauseKey(e) && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) finish(); };
  const hovered = e => { if (e.pointerType === 'mouse') touched(); };
  el.addEventListener('pointerdown', touched, true); if (KINDS[kind].hover) el.addEventListener('pointermove', hovered, true); addEventListener('keydown', pressed, true);
  return handle;
}
