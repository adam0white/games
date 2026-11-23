// One tick of one ant's movement. The server runs it for every ant; the page runs it for its own ant ahead of
// the server and replays it after each snapshot. It reads and writes only x, y, heading and stamina, and reads
// tier and carry, so the page can run it from what a snapshot tells it about its own ant. Ants do not push each
// other: that keeps this function free of other ants, which is what lets the page predict it exactly.
import { DT, WORLD, SPEED, SPRINT, CARRY_SLOW, TIER_SLOW, TURN, STAMINA, STAMINA_DRAIN, STAMINA_REGEN } from './config.js';
const TAU = Math.PI * 2;
export const angleOf = byte => byte * TAU / 256;
export const byteOf = angle => Math.round(((angle % TAU) + TAU) % TAU * 256 / TAU) & 255;
export function stepMove(a, angleByte, move, sprint) {
  if (!move) { a.stamina = Math.min(STAMINA, a.stamina + STAMINA_REGEN * DT); return; }
  let d = angleOf(angleByte) - a.heading;
  d -= Math.round(d / TAU) * TAU;
  const turn = TURN * DT;
  a.heading += d > turn ? turn : d < -turn ? -turn : d;
  a.heading -= Math.floor(a.heading / TAU) * TAU;
  let v = SPEED * TIER_SLOW[a.tier] * CARRY_SLOW[a.carry];
  if (sprint && a.stamina > 0) { v *= SPRINT; a.stamina = Math.max(0, a.stamina - STAMINA_DRAIN * DT); }
  else a.stamina = Math.min(STAMINA, a.stamina + STAMINA_REGEN * DT);
  a.x = Math.min(WORLD - 10, Math.max(10, a.x + Math.cos(a.heading) * v * DT));
  a.y = Math.min(WORLD - 10, Math.max(10, a.y + Math.sin(a.heading) * v * DT));
}
