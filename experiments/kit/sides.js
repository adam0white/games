// Steering by pressing the left or right half of an element: press and hold keeps turning, a short tap is one small step (Lantern's
// first-person view, note #159). The newest finger wins; lifting it goes back to a finger still down. The touch that ends a pause
// resumes and does not steer. A mouse button works the same way.
//   const s = sides(el, { on: () => view === 'first', playing, paused, resume })
//   s.side()   -1 left, 1 right, 0 none      s.drop()   let go of every finger (pause, run over)
export function sides(el, { on, playing, paused, resume }) {
  let down = []; // newest last
  const which = e => { const b = el.getBoundingClientRect(); return e.clientX < b.left + b.width / 2 ? -1 : 1; };
  el.addEventListener('pointerdown', e => {
    if (!on()) return;
    if (paused()) { resume(); return; }
    if (!playing() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    down = down.filter(d => d.id !== e.pointerId); down.push({ id: e.pointerId, side: which(e) });
  });
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, e => { down = down.filter(d => d.id !== e.pointerId); });
  return { side: () => (down.length ? down[down.length - 1].side : 0), drop() { down = []; } };
}
