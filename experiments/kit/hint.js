// Help for a first-time player: after a few seconds of play with no input, a see-through copy of the control near the bottom
// of the screen, with a finger showing how to use it. It goes on the first real input and does not come back.
//   const help = hint(canvas, { kind: 'stick', key: 'ant-promotion:hint', when: () => mode === 'play', played: readJson(KEY) !== null });
//   kind    'stick' (a floating joystick: the finger presses and circles the knob), 'drag' (relative steering: the finger
//           slides side to side), 'tap' (the finger taps a spot twice), 'hold-and-move' (the finger presses, holds, and moves
//           slowly along a curve), 'path' (the finger drags through a row of dots), or 'fingertip' (a single contact without a rail).
//           A new kind is a new entry in KINDS below;
//           callers do not change.
//   key     a new save.js key, '1' once the player has used the control. Then the hint never shows again on this device.
//   when    true while the run is in play and no card covers it. Idle time counts only then and adds up across runs, so a
//           run that ends before the delay still leads to the hint in the next one. The hint hides while it is false.
//   played  true when the game's own save, read at load, shows the player has played before. Then it never shows.
//   delay   ms of idle play before it shows (3000)
//   look    'hand' (a pointing hand) or 'ring' (the knob alone, with a press ring); the default is 'hand'
//   label   words shown with a still copy when the player asks for reduced motion; each kind has its own
//   reach   the stick's reach in px, so the copy is the size of the stick the game draws (55)
//   bottom  px from the bottom of the screen (above the safe area) to the middle of the copy (120); keep it clear of the player.
//           A function is asked again each time the copy appears, for a game whose clear spot moves.
//   help.shown   true while it is on screen
//   help.done()  put it away for good and remember the player (the game saw input some other way)
//   manual  leave dismissal to help.done(), after the game detects deliberate steering
//   follow  optional drawing callback with the delayed lateral offset in CSS px and the fingertip opacity
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
.kit-hint[data-kind="fingertip"] .knob { width: 22px; height: 22px; left: -11px; top: -11px; background: #fff5dc48; }
.kit-hint[data-kind="fingertip"] .knob::after { inset: -4px; border-width: 1px; }
.kit-hint .hand { position: absolute; left: -17px; top: -3px; width: 40px; height: 52px; transform-origin: 17px 3px; filter: drop-shadow(0 1px 2px #000c); opacity: .92; }
.kit-hint .track { position: absolute; top: -22px; height: 44px; border-radius: 22px; border: 3px solid #ffffff55; box-sizing: border-box; background: #ffffff0f; }
.kit-hint .track::before, .kit-hint .track::after { position: absolute; top: 50%; transform: translateY(-52%); font: bold 26px/1 system-ui, sans-serif; color: #ffffffaa; }
.kit-hint .track::before { content: '\\2039'; left: 12px; } .kit-hint .track::after { content: '\\203A'; right: 12px; }
.kit-hint .label { position: absolute; left: -9em; width: 18em; text-align: center; font: bold 17px/1.25 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 4px #000; display: none; }
.kit-hint.still .label { display: block; }
.kit-hint .ripple { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; border: 3px solid #fff; box-sizing: border-box; opacity: 0; }
.kit-hint svg.line { position: absolute; overflow: visible; }
@media (prefers-reduced-motion: reduce) { .kit-hint.on { animation: none; } }
`;
// A pointing hand, fingertip at (16.5, 3). Plain shapes, filled; the drop shadow draws its outline.
const HAND = '<svg viewBox="0 0 40 52" aria-hidden="true"><g fill="#fff"><rect x="12" y="1" width="9" height="32" rx="4.5"/><rect x="20" y="17" width="8.5" height="17" rx="4.25"/><rect x="27.5" y="20" width="8" height="15" rx="4"/><rect x="8" y="25" width="28" height="26" rx="9"/><rect x="2" y="27" width="8" height="17" rx="4" transform="rotate(-32 6 40)"/></g></svg>';

const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
// Each kind draws its control into `box` and returns where the label goes (px from the middle; above, clear of the hand), and place(t, still): where the finger is (px from the centre), how hard it presses (0 to 1) and, optionally, how far it is lifted
// off the screen (lift, px). place may also move the kind's own parts.
const KINDS = {
  fingertip: {
    label: 'Slide your finger sideways to steer',
    build(box, { reach }) {
      const position = t => reach * Math.sin(2 * Math.PI * t / 2300);
      return { cycle: 2300, labelAt: -42, place(t, still) {
        return still ? { x: reach / 2, y: 0, press: 0.5, follow: reach / 3 }
          : { x: position(t), y: 0, press: 0.55, follow: position(t - 120) };
      } };
    },
  },
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
  tap: {
    label: 'Tap where you want to go',
    build(box) {
      const ring = document.createElement('div'); ring.className = 'ring';
      Object.assign(ring.style, { left: '-30px', top: '-30px', width: '60px', height: '60px' });
      const ripple = document.createElement('div'); ripple.className = 'ripple';
      box.prepend(ring, ripple);
      // Two taps a cycle: down at 450 and 1250 ms, each held 120 ms, with a ring spreading from it.
      const TAPS = [450, 1250], bump = d => d < -150 ? 0 : d < 0 ? ease((d + 150) / 150) : d < 120 ? 1 : d < 270 ? 1 - ease((d - 120) / 150) : 0;
      return { cycle: 2600, labelAt: -66, place(t, still) {
        const since = still ? 300 : Math.min(...TAPS.map(T => t - T).filter(d => d >= 0), Infinity);
        ripple.style.opacity = since < 600 ? 0.9 * (1 - since / 600) : 0; ripple.style.transform = `scale(${1 + 1.3 * Math.min(1, since / 600)})`;
        const press = still ? 1 : Math.max(...TAPS.map(T => bump(t - T)));
        return { x: 0, y: 0, press, lift: 26 * (1 - press) };
      } };
    },
  },
  'hold-and-move': {
    label: 'Hold your finger down and move it slowly',
    build(box, { reach }) {
      // A gentle arc, bowed upward, from left to right.
      const span = Math.round(reach * 1.3), A = [-span, 14], C = [0, -46], B = [span, 14];
      const at = u => [0, 1].map(i => (1 - u) ** 2 * A[i] + 2 * (1 - u) * u * C[i] + u * u * B[i]);
      box.prepend(line(span, `<path d="M${A} Q${C} ${B}" fill="none" stroke="#ffffff66" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>`));
      return { cycle: 3800, labelAt: -72, place(t, still) {
        if (still) { const [x, y] = at(0.6); return { x, y, press: 1 }; }
        let u = 0, press = 1;
        if (t < 550) press = ease((t - 300) / 250); // comes down at the start
        else if (t < 950) u = 0; // holds
        else if (t < 3000) u = ease((t - 950) / 2050); // moves slowly along the arc
        else { u = 1; press = 1 - ease((t - 3000) / 250); } // and lifts
        const [x, y] = at(u);
        return { x, y, press, lift: 26 * (1 - press) };
      } };
    },
  },
  path: {
    label: 'Drag through the dots, one after another',
    build(box, { reach }) {
      // A short zigzag of four dots joined by a line; a brighter line follows the finger.
      const gap = Math.round(reach * 0.95), P = [-1.5, -0.5, 0.5, 1.5].map((k, i) => [k * gap, i % 2 ? -16 : 16]);
      const seg = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1])), total = seg.reduce((a, b) => a + b, 0);
      const svg = line(1.5 * gap, `<polyline points="${P.join(' ')}" fill="none" stroke="#ffffff55" stroke-width="4" stroke-linejoin="round"/>`
        + `<polyline class="done" points="${P.join(' ')}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="4" stroke-linejoin="round" stroke-dasharray="${total} ${total}"/>`
        + P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ffffff33" stroke="#ffffffaa" stroke-width="2"/>`).join(''));
      box.prepend(svg);
      const trace = svg.querySelector('.done'), dots = [...svg.querySelectorAll('circle')];
      const show = (n, f) => { // the finger has passed dot n and is f of the way to the next one
        const done = seg.slice(0, n).reduce((a, b) => a + b, 0) + (seg[n] ?? 0) * f;
        trace.setAttribute('stroke-dashoffset', total - done);
        dots.forEach((d, i) => d.setAttribute('fill', i <= n ? '#ffffffbb' : '#ffffff33'));
        const [a, b] = [P[n], P[n + 1] ?? P[n]];
        return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
      };
      return { cycle: 4200, labelAt: -56, place(t, still) {
        if (still) return { ...show(2, 0), press: 1 };
        if (t < 550) { const press = ease((t - 300) / 250); return { ...show(0, 0), press, lift: 26 * (1 - press) }; } // comes down on the first dot
        if (t < 3050) { const k = (t - 550) / 2500 * seg.length, n = Math.min(seg.length - 1, Math.floor(k)); return { ...show(n, ease(k - n)), press: 1 }; } // through each dot in turn
        const press = 1 - ease((t - 3050) / 250); return { ...show(seg.length, 0), press, lift: 26 * (1 - press) }; // lifts on the last
      } };
    },
  },
};
// An SVG layer centred on the copy, `half` px each side (and 20 px more) and 100 px tall, drawn from `body` (SVG attributes, so no inline style).
function line(half, body) {
  const w = Math.ceil(2 * half + 40), h = 100, holder = document.createElement('div');
  holder.innerHTML = `<svg class="line" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;
  const svg = holder.firstElementChild; Object.assign(svg.style, { left: `${-w / 2}px`, top: `${-h / 2}px` }); return svg;
}

// A constructed sheet where the browser has them: a page whose policy is style-src 'self' (workers/crumbwar) refuses a <style>.
let styled = false;
function style() {
  try { const sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; return; } catch {}
  const st = document.createElement('style'); st.id = 'kit-hint-css'; st.textContent = CSS; document.head.append(st);
}

export function hint(el, { kind = 'stick', key, when, played = false, delay = 3000, look = 'hand', label, reach = 55, bottom = 120, manual = false, follow }) {
  const asked = new URLSearchParams(location.search).get('hint'), forced = asked === 'hand' || asked === 'ring';
  if (forced) look = asked;
  if (kind === 'fingertip') look = 'ring';
  let over = asked === '0' || (!forced && (played || read(key) === '1'));
  const handle = { get shown() { return !over && box?.classList.contains('on'); }, done: () => finish() };
  if (over || !KINDS[kind]) { over = true; return handle; }
  if (!styled) { styled = true; style(); }
  const box = document.createElement('div'); box.className = 'kit-hint'; box.dataset.kind = kind; box.dataset.look = look;
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
    if (on !== box.classList.contains('on')) {
      if (on) box.style.setProperty('--kit-hint-bottom', `${typeof bottom === 'function' ? bottom() : bottom}px`);
      box.classList.toggle('on', on); from = now;
    }
    if (on) {
      const still = calm.matches, p = k.place(still ? 0 : (now - from) % k.cycle, still);
      box.classList.toggle('still', still);
      const lift = p.lift ?? 0; // px the finger is off the screen: the hand stands back from the knob
      knob.style.transform = `translate(${p.x}px, ${p.y}px)`; hand.style.transform = `translate(${p.x + 0.4 * lift}px, ${p.y + lift}px) scale(${1.08 - 0.08 * p.press})`;
      knob.style.setProperty('--press', p.press);
      follow?.(p.follow, p.press);
    } else follow?.(0, 0);
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
  if (!manual) {
    el.addEventListener('pointerdown', touched, true);
    if (KINDS[kind].hover) el.addEventListener('pointermove', hovered, true);
    addEventListener('keydown', pressed, true);
  }
  return handle;
}
