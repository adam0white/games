// First-person controls only. The river, collisions, pickups and dawn are Lantern's unchanged rules.
export * from '../../lantern/sim.js';

export const TAP_STEP = 0.025;
export const HOLD_DELAY = 12; // 0.20 s at the river's fixed 60 Hz
export const HOLD_REPEAT = 2; // a held thumb then repeats at 30 steps/s
const clamp = x => Math.max(0, Math.min(1, x));
const direction = side => side < 0 ? -1 : side > 0 ? 1 : 0;

export function createControl(x = 0.5) {
  return { target: clamp(x), side: 0, held: 0, taps: 0 };
}

// Call on pointer/key down. A tap moves the persistent target, never the boat directly.
// Lantern's own step() retains its usual maximum steering speed and all collisions.
export function tap(control, side) {
  control.side = direction(side);
  control.held = 0;
  if (control.side) { control.target = clamp(control.target + control.side * TAP_STEP); control.taps++; }
  return control.target;
}

export function release(control) { control.side = 0; control.held = 0; return control.target; }

// Call once per simulation tick, before step(state, returnedTarget). Passing a new side
// starts a press; passing zero releases. Omit side to continue the current press.
export function advanceControl(control, side = control.side, ticks = 1) {
  const next = direction(side);
  if (next !== control.side) { if (next) tap(control, next); else release(control); }
  for (let n = 0; n < Math.max(0, Math.floor(ticks)); n++) {
    if (!control.side) continue;
    control.held++;
    if (control.held >= HOLD_DELAY && (control.held - HOLD_DELAY) % HOLD_REPEAT === 0) {
      control.target = clamp(control.target + control.side * TAP_STEP); control.taps++;
    }
  }
  return control.target;
}
