// Lockstep for two phones: both run the same seeded game, tick by tick, and step a tick only when they hold both
// players' inputs for it. Pure: no window, no timers, no sockets. Time comes in as `now` (ms) from the caller.
//
// Each phone samples its own input once per tick and stamps it `delay` ticks ahead, so the friend's phone has that long
// to receive it before it is needed. A tick whose inputs have not arrived is not stepped: the game stalls and the page
// says it is waiting. Inputs are short arrays of integers that mean something to the game (Thumb Duel: experiments/duel/net.js).
// Every frame repeats all of this phone's inputs the friend has not confirmed (`ack`), so a frame lost in a reconnect
// is sent again; an input that arrives twice, late or out of order is harmless, because each one is filed by its tick.
//
//   const ls = lockstep({ id: matchNumber, delay: 6 });
//   each tick:  if (ls.canSample()) ls.push(encode(myInput));
//               const pair = ls.ready(); if (!pair) stall; else { step(game, pair.mine, pair.theirs); ls.advance(); }
//               if (ls.tick % 30 === 0) ls.check(ls.tick, hashOf(game));   // both phones compare; ls.mismatch says where
//   every ~50 ms: const f = ls.frame(now); if (f) send(f);
//   on a frame from the friend: ls.receive(ints, now)
//   after a reconnect: ls.resend()  (the next frame starts from the friend's last confirmation)
//
// Adaptive delay (optional, `adapt: { up, downAfter, min, max }`): each phone may change its OWN delay during a match,
// because the friend's phone only needs one input per tick, whatever tick it was stamped at. A stall raises the delay
// by `up` ticks at once (the next input is stamped further ahead; the ticks in between get `fill(last input)`, so the
// thumb's hold carries over but no tap is repeated); `downAfter` ticks without a stall lower it by one (that tick takes
// no new sample, so the caller's taps wait for the next one). Never below `min` or above `max`. Both phones stay
// identical: what changes is only when each thumb's input lands, never which tick an input is applied at.
// A phone stalls because it runs ahead of its friend's inputs, and its own delay cannot help with that: so with each
// raise it also falls back by the same ticks (`takeOwed()`: the caller waits that long before the next step). Falling back
// gives this phone that much slack on the friend's inputs and takes the same from the friend's on its own, which the
// raise gives straight back; the friend's phone is not asked to do anything.
//
// One tick's integers must fit in a frame (frame's maxChars, less about 35 for the header): a tick that cannot is never
// sent, and both phones wait for it for ever. The game bounds its inputs (Thumb Duel: net.js PER_TICK).
// Frame (integers): [id, ack, checkTick, checkHash, first, count, ...ticks], each tick [n, ...n ints], or [-1] for
// "the same as the tick before it in this frame". ack: the last tick of the friend's inputs this phone holds without a gap.

const same = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
const digits = v => String(v).length + 1; // the JSON text of one integer and its comma

export function lockstep({ id = 0, delay = 6, resendMs = 400, keepChecks = 32, adapt = null, fill = ints => ints } = {}) {
  const start = delay; // ticks before this have no inputs on either phone
  let tick = 0, nextLocal = delay, stallTick = -1, calm = 0, stalls = 0, owed = 0, last = [];
  const mine = new Map(), theirs = new Map();
  let have = delay - 1, peerAck = delay - 1, sentTo = delay - 1, ackSent = -2, checkSent = -2;
  let lastHeard = 0, waitingSince = null, mismatch = null, received = 0, frames = 0;
  const myChecks = new Map(), peerChecks = new Map();
  const EMPTY = Object.freeze([]);
  const compare = t => { if (mismatch === null && myChecks.has(t) && peerChecks.has(t) && myChecks.get(t) !== peerChecks.get(t)) mismatch = t; };
  const trim = map => { if (map.size > keepChecks) map.delete(map.keys().next().value); };

  return {
    get id() { return id; }, get delay() { return delay; }, get tick() { return tick; },
    get mismatch() { return mismatch; }, get have() { return have; }, get peerAck() { return peerAck; }, get stalls() { return stalls; },
    get stats() { return { tick, nextLocal, have, peerAck, mine: mine.size, theirs: theirs.size, received, frames }; },
    canSample: () => nextLocal <= tick + delay,
    push(ints) {
      while (nextLocal < tick + delay) mine.set(nextLocal++, fill(last)); // the delay went up: bridge the gap
      last = Array.isArray(ints) ? ints.slice() : [];
      const t = nextLocal++; mine.set(t, last); return t;
    },
    // Both inputs for the current tick, or null while the friend's has not arrived.
    ready() {
      if (tick < start) return { mine: EMPTY, theirs: EMPTY };
      if (mine.has(tick) && theirs.has(tick)) return { mine: mine.get(tick), theirs: theirs.get(tick) };
      if (stallTick !== tick) {
        stallTick = tick; stalls++; calm = 0;
        if (adapt) { const up = Math.min(adapt.max, delay + adapt.up) - delay; delay += up; owed += up; }
      }
      return null;
    },
    advance() {
      theirs.delete(tick);
      if (tick <= peerAck) mine.delete(tick);
      tick++;
      if (adapt && ++calm >= adapt.downAfter && delay > adapt.min) { delay--; calm = 0; }
    },
    // Ticks of time this phone should wait on top of a stall (adapt): the caller takes them once and steps that much later.
    takeOwed() { const n = owed; owed = 0; return n; },
    check(t, hash) { myChecks.set(t, hash >>> 0); trim(myChecks); compare(t); },
    resend() { sentTo = peerAck; ackSent = -2; checkSent = -2; },
    // The next frame to send, or null when there is nothing new. maxChars bounds the JSON text of the integers.
    frame(now, maxChars = 170) {
      if (now - lastHeard > resendMs && sentTo > peerAck) { sentTo = peerAck; lastHeard = now; } // nothing confirmed lately: start again from the gap
      const last = [...myChecks.keys()].at(-1) ?? -1, to = nextLocal - 1, fresh = sentTo + 1;
      if (fresh > to && ackSent === have && checkSent === last) return null;
      const head = [id, have, last, last >= 0 ? myChecks.get(last) : 0];
      const cost = (lo, hi) => { let n = 0, prev = null; for (let t = lo; t <= hi; t++) { const ints = mine.get(t) ?? EMPTY; n += prev && same(prev, ints) ? digits(-1) : digits(ints.length) + ints.reduce((m, v) => m + digits(v), 0); prev = ints; } return n; };
      const room = maxChars - head.reduce((n, v) => n + digits(v), 0) - digits(to) - digits(99);
      // The new ticks first; then, while they fit, the unconfirmed ticks before them again, so one lost frame costs nothing.
      let lo = Math.max(peerAck + 1, Math.min(fresh, to + 1)), hi = to;
      while (hi >= lo && cost(lo, hi) > room) hi--;
      while (lo - 1 > peerAck && hi >= lo && cost(lo - 1, hi) <= room) lo--;
      const out = [...head, lo, 0];
      let prev = null, count = 0;
      for (let t = lo; t <= hi; t++) { const ints = mine.get(t) ?? EMPTY; if (prev && same(prev, ints)) out.push(-1); else out.push(ints.length, ...ints); prev = ints; count++; }
      out[5] = count;
      sentTo = Math.max(sentTo, hi); ackSent = have; checkSent = last; frames++;
      return out;
    },
    // A frame from the friend. False when it belongs to another match or does not parse.
    receive(q, now = 0) {
      if (!Array.isArray(q) || q.length < 6 || q[0] !== id) return false;
      const [, ack, ct, ch, first, count] = q;
      let at = 6, prev = null;
      for (let n = 0; n < count; n++) {
        if (at >= q.length) return false;
        let ints;
        if (q[at] === -1) { if (!prev) return false; ints = prev; at += 1; }
        else { const len = q[at]; if (!Number.isInteger(len) || len < 0 || at + 1 + len > q.length) return false; ints = q.slice(at + 1, at + 1 + len); at += 1 + len; }
        const t = first + n;
        if (t >= tick && t >= start && !theirs.has(t)) theirs.set(t, ints);
        prev = ints;
      }
      while (theirs.has(have + 1)) have++;
      if (Number.isInteger(ack) && ack > peerAck) {
        peerAck = ack; lastHeard = now;
        for (const t of mine.keys()) if (t <= peerAck && t < tick) mine.delete(t);
      }
      if (Number.isInteger(ct) && ct >= 0) { peerChecks.set(ct, ch >>> 0); trim(peerChecks); compare(ct); }
      received++;
      return true;
    },
    // How long the game has been held up waiting for the friend (ms), for a "waiting for your friend" line.
    waited(now, stalled) { if (!stalled) { waitingSince = null; return 0; } if (waitingSince === null) waitingSince = now; return now - waitingSince; },
  };
}
