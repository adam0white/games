// Relative steering (Lantern and lantern-3d). A finger steers by how far it has moved since it touched down,
// never by where it is, so a tap anywhere does nothing and the thumb can rest wherever is comfortable.
// The touch that ends a pause also resumes, and it does not steer until it has moved `settle` px; then it
// re-anchors where it is. A mouse is left to the game (`mouse`), which usually steers by position.
//   const steer = drag(canvas, {
//     playing: () => playing, paused: () => paused, resume,   the game's own state and resume
//     from: () => s.x,                                         where steering starts from: read at touch-down and at rebase
//     travel: dx => dx * dpr / unit * gain,                    finger px to game units; the gain is the game's
//     aim: x => { target = x },                                where the finger now asks to go
//     mouse: e => aim(mouseX(e)),                              a mouse press or move
//     settle: 12,                                              px a resuming finger must move before it steers
//   });
//   steer.drop()    let go of the finger (pause, run over)
//   steer.reset()   let go, and forget a resuming touch too (a new run)
//   steer.rebase()  a finger still down steers on from where the game is now (after a hit moved the player)
export function drag(el, { playing, paused, resume, from, travel, aim, mouse, settle }) {
  let hold = null, startTap = null;
  const anchor = e => { hold = { id: e.pointerId, x0: e.clientX, x: e.clientX, from: from() }; };
  el.addEventListener('pointerdown', e => {
    if (paused()) { resume(); startTap = { id: e.pointerId, x: e.clientX, y: e.clientY }; anchor(e); return; }
    if (!playing()) return;
    startTap = null;
    if (e.pointerType === 'mouse') mouse(e); else anchor(e);
  });
  el.addEventListener('pointermove', e => {
    if (!playing() || paused()) return;
    if (e.pointerType === 'pen' && !(e.pressure > 0)) return;
    if (startTap && e.pointerId === startTap.id) { if (Math.hypot(e.clientX - startTap.x, e.clientY - startTap.y) < settle) return; startTap = null; if (hold) anchor(e); }
    if (e.pointerType === 'mouse') { mouse(e); return; }
    if (!hold || e.pointerId !== hold.id) return;
    hold.x = e.clientX; aim(hold.from + travel(e.clientX - hold.x0));
  });
  for (const type of ['pointerup', 'pointercancel']) el.addEventListener(type, e => { if (e.pointerType !== 'mouse') startTap = null; if (hold && e.pointerId === hold.id) hold = null; });
  return {
    drop() { hold = null; },
    reset() { hold = null; startTap = null; },
    rebase() { if (hold) { hold.x0 = hold.x; hold.from = from(); } },
  };
}
