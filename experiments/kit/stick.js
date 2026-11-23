// A floating joystick (Ant Promotion and its lab variants). The finger lands anywhere on the element and that
// spot is the stick's centre; how far the finger is from it sets the speed. The numbers belong to the game.
//   const pad = stick(canvas, { when: () => mode === 'play', reach: 55, leash: 70, dead: 0.15 });
//   reach  px of travel that is full speed (1) on an axis
//   leash  px the centre may lag behind the finger; past it the centre is dragged along
//   dead   a vector shorter than this (in units of reach) counts as zero
//   pad.vector()  { x, y }: travel / reach on each axis, zero in the dead zone, zero with no finger down
//   pad.touch     { ox, oy, x, y } (centre and finger, in client px) while a finger is down, for drawing; otherwise null
//   pad.drop()    forget the finger (a card opened, the player died)
// The finger is captured on touch-down, so it keeps steering when it slides off the element.
export function stick(el, { when = () => true, reach, leash, dead }) {
  let joy = null;
  el.addEventListener('pointerdown', e => { if (!when()) return; joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch {} });
  el.addEventListener('pointermove', e => { if (joy && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy); if (d > leash) { joy.ox = joy.x - dx / d * leash; joy.oy = joy.y - dy / d * leash; } } });
  for (const type of ['pointerup', 'pointercancel']) el.addEventListener(type, e => { if (joy && e.pointerId === joy.id) joy = null; });
  return {
    get touch() { return joy; },
    drop() { joy = null; },
    vector() {
      let x = 0, y = 0;
      if (joy) { x = (joy.x - joy.ox) / reach; y = (joy.y - joy.oy) / reach; if (Math.hypot(x, y) < dead) x = y = 0; }
      return { x, y };
    },
  };
}
