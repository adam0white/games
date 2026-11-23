// What one client is told, and how small it can be made. Each client has a view: the other ants and the food it
// currently knows about. A snapshot holds only the difference between the world inside the client's square and
// that view. A WebSocket delivers every message, in order, so the last snapshot sent is always the right base
// to delta against and no acknowledgement of snapshots is needed.
import * as C from '../public/crumbwar/shared/config.js';
import * as P from '../public/crumbwar/shared/proto.js';
import { byteOf } from '../public/crumbwar/shared/move.js';
import { antsNear, foodNear } from './sim.mjs';

const out = new P.Writer(8192);
export function newView() { return { ants: new Map(), food: new Int32Array(C.MAX_FOOD).fill(-1), list: [], mark: new Int32Array(C.MAX_FOOD), pass: 0 }; }

export function welcome(a, tick, tokenHi, tokenLo, room) {
  out.u8(P.WELCOME).u8(C.PROTO).u8(a.id).u8(a.colony).u8(a.nameA).u8(a.nameB).u32(tick).u32(tokenHi).u32(tokenLo).u8(room.length);
  for (let i = 0; i < room.length; i++) out.u8(room.charCodeAt(i));
  return out.done();
}

export function snapshot(w, me, view, ackSeq) {
  const pass = ++view.pass, tick = w.tick;
  out.u8(P.SNAP).u32(tick).u16(ackSeq).u16(Math.min(65535, tick - me.inputTick));
  out.u16(Math.round(me.x * C.OWN_Q)).u16(Math.round(me.y * C.OWN_Q)).u8(byteOf(me.heading)).u8(Math.max(0, me.hp)).u8(Math.round(me.stamina * 2));
  out.u8((me.alive ? 1 : 0) | me.carry << 1 | me.tier << 3 | (tick < me.protectUntil ? 32 : 0)).u16(Math.min(65535, me.score)).u8(me.alive ? 0 : Math.min(255, Math.max(0, me.respawnAt - tick)));
  // Ants. First pass finds who is in the square; the count bytes are patched in afterwards.
  const changed = [];
  antsNear(w, me.x, me.y, C.VIEW_LEAVE, o => {
    if (o === me) return;
    let k = view.ants.get(o.id);
    if (k && k.ref !== o) k = undefined; // the id was given to a new ant since the last snapshot
    if (!k) {
      if (Math.abs(o.x - me.x) > C.VIEW || Math.abs(o.y - me.y) > C.VIEW) return;
      k = { ref: o, qx: -1, qy: -1, h: -1, state: -1, meta: -1, pass, fresh: true };
      view.ants.set(o.id, k);
    }
    k.pass = pass; changed.push(k);
  });
  const goneAt = out.n; out.u8(0); let gone = 0;
  for (const [id, k] of view.ants) if (k.pass !== pass) { view.ants.delete(id); out.u8(id); gone++; }
  out.b[goneAt] = gone;
  const antsAt = out.n; out.u8(0); let sent = 0;
  for (const k of changed) {
    const o = k.ref, qx = Math.round(o.x * C.POS_Q), qy = Math.round(o.y * C.POS_Q), h = byteOf(o.heading);
    const state = Math.max(0, Math.min(15, o.hp)) | o.carry << 4 | o.tier << 6;
    const meta = o.colony | (o.bot ? 4 : 0) | (tick < o.protectUntil ? 8 : 0) | (o.sprint && o.move && o.stamina > 0 ? 16 : 0);
    const dx = qx - k.qx, dy = qy - k.qy;
    let mask = 0;
    if (k.fresh) mask = P.M_ABS | P.M_HEAD | P.M_STATE | P.M_META | P.M_NAMES;
    else {
      if (dx || dy) mask |= dx >= -128 && dx <= 127 && dy >= -128 && dy <= 127 ? P.M_DELTA : P.M_ABS;
      if (h !== k.h) mask |= P.M_HEAD;
      if (state !== k.state) mask |= P.M_STATE;
      if (meta !== k.meta) mask |= P.M_META;
    }
    if (!mask) continue;
    out.u8(o.id).u8(mask);
    if (mask & P.M_ABS) out.u16(qx).u16(qy);
    if (mask & P.M_DELTA) out.i8(dx).i8(dy);
    if (mask & P.M_HEAD) out.u8(h);
    if (mask & P.M_STATE) out.u8(state);
    if (mask & P.M_META) out.u8(meta);
    if (mask & P.M_NAMES) out.u8(o.nameA).u8(o.nameB);
    k.qx = qx; k.qy = qy; k.h = h; k.state = state; k.meta = meta; k.fresh = false; sent++;
  }
  out.b[antsAt] = sent;
  // Food never moves, so it is sent once when it enters the square and once more when it goes.
  const addAt = out.n; out.u16(0); let added = 0;
  foodNear(w, me.x, me.y, C.VIEW_LEAVE, id => {
    if (view.food[id] === w.fgen[id]) { view.mark[id] = pass; return; }
    if (view.food[id] >= 0) return; // a stale entry: dropped below, sent fresh next time
    if (Math.abs(w.fx[id] - me.x) > C.VIEW || Math.abs(w.fy[id] - me.y) > C.VIEW) return;
    view.food[id] = w.fgen[id]; view.mark[id] = pass; view.list.push(id);
    out.u16(id).u16(Math.round(w.fx[id] * C.POS_Q)).u16(Math.round(w.fy[id] * C.POS_Q)).u8(w.fkind[id]); added++;
  });
  out.v.setUint16(addAt, added, true);
  const delAt = out.n; out.u16(0); let removed = 0;
  for (let i = view.list.length - 1; i >= 0; i--) {
    const id = view.list[i];
    if (view.mark[id] === pass) continue;
    view.food[id] = -1; view.list[i] = view.list[view.list.length - 1]; view.list.pop();
    out.u16(id); removed++;
  }
  out.v.setUint16(delAt, removed, true);
  return out.done();
}

export function event(type, a, b, c) { return out.u8(P.EVENT).u8(type).u8(a).u8(b).u8(c).done(); }
export function pong(nonce) { return out.u8(P.PONG).u16(nonce).done(); }

// One message a second. `top` is the five best ants in the room; each client gets its own "you" bit and rank.
export function scores(w, ranked, me, people) {
  const inBreak = w.breakUntil > 0, left = Math.max(0, ((inBreak ? w.breakUntil : w.roundEnd) - w.tick) / C.TICK_HZ | 0);
  out.u8(P.SCORES);
  for (const s of w.colonyScore) out.u16(Math.min(65535, s));
  out.u16(left | (inBreak ? 0x8000 : 0)).u8(Math.min(255, people)).u8(Math.min(255, w.count));
  const n = Math.min(5, ranked.length);
  out.u8(n);
  for (let i = 0; i < n; i++) { const a = ranked[i]; out.u8(a.nameA).u8(a.nameB).u8(a.colony | (a.bot ? 4 : 0) | (a === me ? 8 : 0)).u16(Math.min(65535, a.score)); }
  out.u8(Math.min(255, ranked.indexOf(me) + 1));
  return out.done();
}
