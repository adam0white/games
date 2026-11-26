// The trail painter's touch rules (02-spec section 6.4) as a pure reducer: no DOM, no clock. The page feeds it pointer
// events with their own time stamps and acts on the actions it returns. test/gestures.test.mjs checks it in Node.
//
// The rules:
// - One finger acts in the chosen tool. A stroke is only a preview while the finger is down; it becomes an order when
//   that finger lifts.
// - A second touch, a pointercancel or a reset (the page lost focus, the layer, tool or ant count changed) cancels the
//   stroke. After a cancel nothing acts until every finger is up: the finger left behind by a pinch never draws.
// - Two fingers always pan and zoom. A mouse acts with the left button and moves the camera with any other button.
// - Alarm is press and hold: it starts only after the finger has stayed down alone and still for HOLD_MS, so the first
//   finger of a quick pinch never calls one. It is renewed while held and ended when the finger lifts or is cancelled.
// - The camera tool (one-finger camera mode) pans with one finger; a tap in it, or a tap in the trail or alarm tool,
//   is reported as a tap (the page inspects an ant or places a tap-start or tap-end trail point).
//
// The invariant the tests check: an order is emitted only for a pointer that was the only pointer down from its own
// down to its own up, with no cancel or reset in between.

export const HOLD_MS = 300; // a still, lone finger this long in the Alarm tool calls the alarm
export const TAP_PX = 10; // a stroke shorter than this is a tap
export const STEP_PX = 6; // stroke points are kept this far apart
export const RENEW_MS = 10000; // a held alarm is renewed this often

export function makeGestures() {
  const s = { pointers: new Map(), dead: false, stroke: null, pinch: null, pan: null, panMoved: 0, cancels: 0 };

  const endStroke = why => {
    const st = s.stroke; if (!st) return [];
    s.stroke = null; s.cancels++;
    const out = [{ type: 'clear', why }];
    if (st.alarm) out.push({ type: 'alarm', phase: 'end', x: st.alarm.x, y: st.alarm.y });
    return out;
  };

  return {
    state: s,
    /** p: { id, x, y, t, kind: 'touch' | 'mouse' | 'pen', button, primary }. A primary pointer going down means no
     *  other pointer is down any more, so pointers whose lift was never seen (after a reset) are forgotten here. */
    down(p, tool) {
      if (s.pointers.has(p.id)) return [];
      const out0 = [];
      if (p.primary && s.pointers.size) { out0.push(...endStroke('stale')); s.pointers.clear(); s.dead = false; s.pinch = null; s.pan = null; }
      s.pointers.set(p.id, { x: p.x, y: p.y });
      if (out0.length) return [...out0, ...this.after(p, tool)];
      return this.after(p, tool);
    },
    after(p, tool) {
      if (s.pointers.size >= 2) {
        const out = endStroke('second touch');
        s.dead = true; s.pan = null;
        if (!s.pinch) {
          const [a, b] = [...s.pointers.keys()], A = s.pointers.get(a), B = s.pointers.get(b);
          s.pinch = { a, b, mx: (A.x + B.x) / 2, my: (A.y + B.y) / 2, d: Math.max(1, Math.hypot(A.x - B.x, A.y - B.y)) };
        }
        return out;
      }
      if (s.dead) return [];
      if ((p.kind === 'mouse' && p.button !== 0) || tool === 'camera') { s.pan = p.id; s.panMoved = 0; s.panTool = tool; return []; }
      s.stroke = { id: p.id, tool, points: [[p.x, p.y]], x0: p.x, y0: p.y, t0: p.t, len: 0, alarm: null };
      return tool === 'alarm' ? [] : [{ type: 'preview', tool, points: s.stroke.points }];
    },
    move(p) {
      const q = s.pointers.get(p.id); if (!q) return [];
      const dx = p.x - q.x, dy = p.y - q.y; q.x = p.x; q.y = p.y;
      if (s.pinch && (p.id === s.pinch.a || p.id === s.pinch.b)) {
        const A = s.pointers.get(s.pinch.a), B = s.pointers.get(s.pinch.b);
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, d = Math.max(1, Math.hypot(A.x - B.x, A.y - B.y));
        const out = [{ type: 'pan', dx: mx - s.pinch.mx, dy: my - s.pinch.my }, { type: 'zoom', f: d / s.pinch.d, x: mx, y: my }];
        s.pinch.mx = mx; s.pinch.my = my; s.pinch.d = d;
        return out;
      }
      if (s.pan === p.id) { s.panMoved += Math.hypot(dx, dy); return [{ type: 'pan', dx, dy }]; }
      const st = s.stroke;
      if (!st || st.id !== p.id) return [];
      st.len += Math.hypot(dx, dy);
      if (st.tool === 'alarm') {
        // Before the call starts, a finger that wanders restarts the hold where it is now; after, the call stays put.
        if (!st.alarm && Math.hypot(p.x - st.x0, p.y - st.y0) > 2 * TAP_PX) { st.x0 = p.x; st.y0 = p.y; st.t0 = p.t; }
        return [];
      }
      const last = st.points[st.points.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) < STEP_PX) return [];
      st.points.push([p.x, p.y]);
      return [{ type: 'preview', tool: st.tool, points: st.points }];
    },
    up(p) {
      if (!s.pointers.has(p.id)) return [];
      const q = s.pointers.get(p.id); q.x = p.x ?? q.x; q.y = p.y ?? q.y;
      s.pointers.delete(p.id);
      const out = [];
      if (s.pinch && (p.id === s.pinch.a || p.id === s.pinch.b)) s.pinch = null;
      if (s.pan === p.id) {
        s.pan = null;
        if (!s.dead && s.panTool === 'camera' && s.panMoved < TAP_PX) out.push({ type: 'tap', x: q.x, y: q.y });
      }
      const st = s.stroke;
      if (st && st.id === p.id) {
        s.stroke = null;
        out.push({ type: 'clear', why: 'lift' });
        if (st.tool === 'alarm') out.push(st.alarm ? { type: 'alarm', phase: 'end', x: st.alarm.x, y: st.alarm.y } : { type: 'tap', x: st.x0, y: st.y0 });
        else if (st.tool === 'trail' && st.len < TAP_PX) out.push({ type: 'tap', x: st.x0, y: st.y0 });
        else out.push({ type: 'order', tool: st.tool, points: st.points });
      }
      if (s.pointers.size === 0) { s.dead = false; s.pinch = null; s.pan = null; }
      return out;
    },
    /** pointercancel or lostpointercapture for one pointer. */
    cancel(id, why = 'pointercancel') {
      if (!s.pointers.has(id)) return [];
      s.pointers.delete(id);
      const out = s.stroke ? endStroke(why) : [];
      if (s.pointers.size === 0) { s.dead = false; s.pinch = null; s.pan = null; }
      else { s.dead = true; if (s.pinch && (id === s.pinch.a || id === s.pinch.b)) s.pinch = null; if (s.pan === id) s.pan = null; }
      return out;
    },
    /** Focus lost, or the layer, tool or ant count changed: cancel the stroke, and act on nothing more until every
     *  finger is up (or a new first finger shows that they are, when the browser never sent their lift). */
    reset(why = 'reset') {
      const out = endStroke(why);
      s.pinch = null; s.pan = null;
      if (s.pointers.size) s.dead = true;
      return out;
    },
    /** Call every frame: starts and renews a held alarm. */
    tick(t) {
      const st = s.stroke;
      if (!st || st.tool !== 'alarm' || s.dead || s.pointers.size !== 1) return [];
      if (!st.alarm && t - st.t0 >= HOLD_MS) { st.alarm = { x: st.x0, y: st.y0, at: t }; return [{ type: 'alarm', phase: 'start', x: st.x0, y: st.y0 }]; }
      if (st.alarm && t - st.alarm.at >= RENEW_MS) { st.alarm.at = t; return [{ type: 'alarm', phase: 'renew', x: st.alarm.x, y: st.alarm.y }]; }
      return [];
    },
  };
}
