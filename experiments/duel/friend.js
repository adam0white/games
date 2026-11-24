// Thumb Duel by link: how two phones meet in a relay room and agree on each match. No window or DOM of its own: the page
// (main.js) gives it the clock and draws what it reports; the browser check drives it through a mock of the server.
//
// The phone that made the code is the host: side 0 of the sim, and the one that picks each match's seed and input delay.
// The phone that opened the link is side 1. Sides come from this, never from the server's ids.
//
//   hello [2, VERSION, role, nonce]      both, every 300 ms until a match starts; a new nonce means the friend reloaded
//   ping  [6, n] / pong [7, n]           the host measures the round trip (4 pings, at most 1.5 s)
//   go    [3, id, seed, delay, only, first, introMs]   the host starts match `id`; repeated until the friend's inputs for it arrive
//   input [1, ...lockstep frame]         kit/lockstep.js
//   again [4, id]                        this player wants a rematch of match `id`; when both do, the host sends go id+1
//   bye   [5]                            this player left
import { relay as kitRelay } from '../kit/room.js';
import { lockstep } from '../kit/lockstep.js';
import { KINDS } from './sim.js';
import { VERSION, MSG, delayFor } from './net.js';

export const LINK = { helloMs: 300, pingMs: 120, pings: 4, pingWaitMs: 1500, goMs: 400, againMs: 400, sendMs: 50, goneMs: 20000 };
const randomInt = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 1 || 1; } catch { return 1 + Math.floor(Math.random() * 2147483646); } };

// role: 'host' or 'guest'. onGo(go, ls) starts a match; onAgain() the friend asked for a rematch; onLeft(why) the friend
// is gone ('bye' or 'gone'); onState(state) whenever the state below changes.
// state: 'off' | 'connecting' | 'alone' (in the room, no friend yet) | 'meeting' | 'match' | 'lost' (reconnecting) |
//        'failed' | 'full' | 'closed' | 'version' | 'left'
export function friendLink({ role, onGo = () => {}, onAgain = () => {}, onLeft = () => {}, onState = () => {}, relay = kitRelay, Socket,
  now = () => performance.now(), newSeed = randomInt, only = null, intro = 0, firstKind = 'tug' }) {
  const host = role === 'host', nonce = randomInt();
  let state = 'off', status = 'off', peer = false, version = false, left = false, mixed = false;
  let peerNonce = null, helloAt = -1e9, pingAt = -1e9, pingFirst = null, pingN = 0;
  const pingSent = new Map(), rtts = [];
  let go = null, goAt = -1e9, goConfirmed = false, ls = null, sentAt = -1e9;
  let mineAgain = 0, theirAgain = 0, againAt = -1e9, peerGoneAt = null, wasLost = false;
  const send = ints => r.send(ints);

  function update() {
    const next = left ? 'left' : version ? 'version' : mixed ? 'failed' : ['failed', 'full', 'closed', 'off'].includes(status) ? status
      : status === 'connecting' ? 'connecting' : status === 'waiting' ? 'lost' : go ? 'match' : peer ? 'meeting' : 'alone';
    if (next !== state) { state = next; onState(state); }
  }
  function gone(why) { if (left) return; left = true; update(); onLeft(why); }
  function start(g) {
    go = g; goConfirmed = !host; sentAt = -1e9;
    ls = lockstep({ id: g.id, delay: g.delay });
    update(); onGo(g, ls);
  }
  function hostGo(t) {
    const rtt = rtts.length ? [...rtts].sort((a, b) => a - b)[rtts.length >> 1] : NaN;
    const id = (go?.id ?? 0) + 1;
    start({ id, seed: newSeed() >>> 0, delay: go?.delay ?? delayFor(rtt), only: KINDS.includes(only) ? only : null, first: id === 1 ? firstKind : null, intro, rtt });
    goAt = -1e9; pump(t);
  }
  const goFrame = g => [MSG.go, g.id, g.seed, g.delay, KINDS.indexOf(g.only), KINDS.indexOf(g.first), Math.round((g.intro || 0) * 1000)];

  function onFrame(q) {
    if (left || !Array.isArray(q) || !q.length) return;
    const t = now(), [type] = q;
    if (type === MSG.hello) {
      if (q[1] !== VERSION) { version = true; update(); return; }
      if ((q[2] === 0) === host) { mixed = true; update(); return; } // two hosts or two guests: not a pair
      if (peerNonce !== null && q[3] !== peerNonce && go) { gone('gone'); return; } // the friend's page was reloaded mid-match
      peerNonce = q[3];
    } else if (type === MSG.ping && !host) send([MSG.pong, q[1] | 0]);
    else if (type === MSG.pong && host && pingSent.has(q[1])) { rtts.push(t - pingSent.get(q[1])); pingSent.delete(q[1]); }
    else if (type === MSG.go && !host) {
      const [, id, seed, delay, onlyAt, firstAt, introMs] = q;
      if (!Number.isInteger(id) || id <= (go?.id ?? 0) || !Number.isInteger(delay) || delay < 1 || delay > 30) return;
      start({ id, seed: seed >>> 0, delay, only: KINDS[onlyAt] ?? null, first: KINDS[firstAt] ?? null, intro: introMs > 0 ? introMs / 1000 : 0 });
    } else if (type === MSG.input && ls) {
      if (host && !goConfirmed && q[1] === go.id) goConfirmed = true;
      ls.receive(q.slice(1), t);
    } else if (type === MSG.again && Number.isInteger(q[1])) {
      if (q[1] > theirAgain) { theirAgain = q[1]; if (go && q[1] === go.id) onAgain(); }
    } else if (type === MSG.bye) gone('bye');
  }
  function onPeer(here) { peer = here; peerGoneAt = here ? null : now(); update(); }
  function onStatus(s) {
    status = s;
    if (s === 'waiting') wasLost = true;
    if (s === 'live' && wasLost) { wasLost = false; ls?.resend(); goAt = -1e9; }
    update();
  }
  const r = relay({ game: 'duel', onFrame, onPeer, onStatus, ...(Socket ? { Socket } : {}) });

  function pump(t = now()) {
    if (left || status !== 'live') return;
    if (!go && peer && t - helloAt >= LINK.helloMs) { helloAt = t; send([MSG.hello, VERSION, host ? 0 : 1, nonce]); }
    if (host && !go && peer && peerNonce !== null) {
      if (pingFirst === null) pingFirst = t;
      if (rtts.length >= LINK.pings || t - pingFirst >= LINK.pingWaitMs) { hostGo(t); return; }
      if (t - pingAt >= LINK.pingMs) { pingAt = t; pingSent.set(++pingN, t); send([MSG.ping, pingN]); }
    }
    if (host && go && !goConfirmed && t - goAt >= LINK.goMs) { goAt = t; send(goFrame(go)); }
    if (ls && t - sentAt >= LINK.sendMs) { const f = ls.frame(t); if (f) { send([MSG.input, ...f]); sentAt = t; } }
    if (go && mineAgain === go.id && t - againAt >= LINK.againMs) { againAt = t; send([MSG.again, go.id]); }
    if (host && go && mineAgain === go.id && theirAgain === go.id) hostGo(t);
    if (go && !peer && peerGoneAt !== null && t - peerGoneAt >= LINK.goneMs) gone('gone');
  }

  return {
    open(code) { return r.open(code); },
    pump,
    again() { if (go && !left) { mineAgain = go.id; againAt = -1e9; pump(); } },
    leave() { if (status === 'live') { send([MSG.bye]); send([MSG.bye]); } left = true; r.leave(); },
    get state() { return state; }, get code() { return r.code; }, get role() { return role; }, get me() { return host ? 0 : 1; },
    get go() { return go; }, get ls() { return ls; }, get peer() { return peer; }, get peerReady() { return !!go && theirAgain === go.id; },
    get rtt() { return rtts.length ? [...rtts].sort((a, b) => a - b)[rtts.length >> 1] : null; },
  };
}
