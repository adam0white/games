// A table for friends: share a four-letter code or a link, no account. For turn-based games.
// The server (workers/lab-ai, /lab-api/table/<game>/<code>) keeps the one true list of moves; this file keeps a page in step with it.
// A move is a short array of integers that means something to the game's own sim.js. Apply a move only when `onMove` hands it over,
// your own moves included: that is what keeps both phones identical, and what lets a dropped player get the whole game back.
//
//   const t = table({ game: 'pitch', version: 1, name: () => nameField.value,
//     onState(s) {},   // { seat, game, seed, seats: [{ n, on } | null], log: [[seat, ...ints]], again: [seat] }: start or replace the game
//     onMove(seat, ints, index) {}, onSeats(seats) {}, onGame({ game, seed }) {}, onAgain(seat) {},
//     onStatus(status) {} });   // 'connecting' | 'live' | 'waiting' (retrying) | 'full' | 'version' | 'closed' | 'off'
//   t.open(code) · t.move([..]) · t.again() · t.leave() · t.code · newCode() · linkFor(code) · codeFromLink() · share(code, words)

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function newCode(random = Math.random) { let s = ''; for (let i = 0; i < 4; i++) s += LETTERS[Math.floor(random() * LETTERS.length)]; return s; }
export const cleanCode = v => { const s = String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); return s.length === 4 ? s : ''; };
export function linkFor(code, where = globalThis.location) { const u = new URL(where.href); u.search = ''; u.hash = ''; u.searchParams.set('room', code); return u.href; }
export function codeFromLink(where = globalThis.location) { try { return cleanCode(new URL(where.href).searchParams.get('room')); } catch { return ''; } }

// Hand the link to the phone's share sheet; where there is none, copy it. Resolves to 'shared', 'copied' or 'shown'.
export async function share(code, words = 'Play with me') { return shareLink(linkFor(code), words); }
export async function shareLink(url, words = 'Play with me') { // any link; the same three answers
  try { if (navigator.share) { await navigator.share({ text: words, url }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'shown'; }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'shown'; }
}

function seatKey(game, code, store) {
  const at = `kit-room:${game}:${code}`;
  try { const had = store?.getItem(at); if (had && /^[A-Za-z0-9]{16,40}$/.test(had)) return had; } catch {}
  const bytes = new Uint8Array(18); (globalThis.crypto ?? { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } }).getRandomValues(bytes);
  const key = Array.from(bytes, b => (b % 36).toString(36)).join('');
  try { store?.setItem(at, key); } catch {}
  return key;
}

export function table({ game, version = 1, name = () => '', onState = () => {}, onMove = () => {}, onSeats = () => {}, onGame = () => {}, onAgain = () => {}, onStatus = () => {},
  Socket = globalThis.WebSocket, where = globalThis.location, store = (() => { try { return globalThis.localStorage; } catch { return null; } })(), timers = globalThis }) {
  let socket = null, epoch = 0, code = '', key = '', tries = 0, timer = null, wanted = false;
  // `count` is how many moves of the current game this page has been handed. `pending` is a move sent and not yet seen back.
  let count = 0, pending = null, seat = null, status = 'off';
  const say = s => { if (s !== status) { status = s; onStatus(s); } };
  const post = q => { try { if (socket && socket.readyState === 1) { socket.send(JSON.stringify(q)); return true; } } catch {} return false; };
  function close() { epoch++; timers.clearTimeout(timer); const old = socket; socket = null; if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(); } catch {} } }
  function retry() {
    if (!wanted) return;
    close(); say('waiting');
    // Half a second, then doubling to eight: a phone that wakes is back at the table quickly, and a dead network is not hammered.
    const wait = Math.min(8000, 500 * 2 ** Math.min(tries, 4)); tries++;
    timer = timers.setTimeout(connect, wait);
  }
  function connect() {
    if (!wanted) return;
    close(); const mine = epoch;
    if (!Socket) { say('off'); return; }
    if (tries === 0) say('connecting');
    try { socket = new Socket(`${where.protocol === 'https:' ? 'wss' : 'ws'}://${where.host}/lab-api/table/${game}/${code}`); } catch { retry(); return; }
    socket.onopen = () => { if (mine === epoch) post({ t: 'hi', n: String(name() ?? '').slice(0, 24), k: key, v: version }); };
    socket.onmessage = event => { if (mine !== epoch) return; let q; try { q = JSON.parse(event.data); } catch { return; } if (q && typeof q === 'object') receive(q); };
    socket.onerror = () => { if (mine === epoch) retry(); };
    socket.onclose = event => {
      if (mine !== epoch) return;
      // 4001 full, 4002 a different version of the game, 4003 this seat opened somewhere else, 4004 the table was cleared away.
      if (event?.code === 4001) { wanted = false; close(); say('full'); } else if (event?.code === 4002) { wanted = false; close(); say('version'); }
      else if (event?.code === 4003 || event?.code === 4004) { wanted = false; close(); say('closed'); } else retry();
    };
  }
  function receive(q) {
    if (q.t === 'you' && Array.isArray(q.log) && Array.isArray(q.seats)) {
      tries = 0; seat = q.seat; count = q.log.length; say('live');
      // A move this page sent and the table never got goes out again; one the table already has is forgotten.
      if (pending && pending.i < count) pending = null;
      onState({ seat: q.seat, game: q.game, seed: q.seed, seats: q.seats, log: q.log, again: q.again ?? [] });
      if (pending && pending.i === count) post({ t: 'm', i: pending.i, m: pending.m });
    } else if (q.t === 'seats' && Array.isArray(q.seats)) onSeats(q.seats);
    else if (q.t === 'm' && Number.isInteger(q.i) && Array.isArray(q.m)) {
      if (q.i < count) return;
      // A gap means this page missed something; ask for everything again by reconnecting.
      if (q.i > count) { tries = 0; connect(); return; }
      count++; if (pending && pending.i === q.i) pending = null;
      onMove(q.s, q.m, q.i);
    } else if (q.t === 'game') { count = 0; pending = null; onGame({ game: q.game, seed: q.seed }); }
    else if (q.t === 'again') onAgain(q.s);
  }
  // A phone that comes back to the page reconnects at once instead of waiting out the timer.
  const wake = () => { if (wanted && globalThis.document?.visibilityState !== 'hidden' && (!socket || socket.readyState > 1)) { tries = 0; connect(); } };
  try { globalThis.document?.addEventListener('visibilitychange', wake); globalThis.addEventListener?.('online', wake); } catch {}
  return {
    open(c) { code = cleanCode(c); if (!code) return false; key = seatKey(game, code, store); wanted = true; tries = 0; count = 0; pending = null; seat = null; connect(); return true; },
    // One move at a time: a second move before the first has come back is refused (false), so nothing can be sent out of order.
    move(ints) { if (!wanted || pending || !Array.isArray(ints)) return false; pending = { i: count, m: ints.slice() }; post({ t: 'm', i: pending.i, m: pending.m }); return true; },
    again() { return post({ t: 'again' }); },
    leave() { wanted = false; pending = null; close(); say('off'); },
    get code() { return code; }, get seat() { return seat; }, get status() { return status; }, get waiting() { return !!pending; },
  };
}

// A relay room for a real-time game between two phones (Thumb Duel): `/lab-api/room/<game>/<CODE>` passes short frames
// of integers from one phone to the other and stores nothing. The pages keep the game in lockstep themselves
// (kit/lockstep.js). Unlike a table, nothing comes back after a reload: a page that is reloaded has left.
//
//   const r = relay({ game: 'duel',
//     onFrame(ints) {},            // a frame from the friend
//     onPeer(here) {},             // the friend's phone joined (true) or left (false) the room
//     onStatus(status) {} });      // 'connecting' | 'live' | 'waiting' (lost, retrying) | 'full' | 'closed' | 'failed' | 'off'
//   r.open(code) · r.send([..ints]) → true when sent · r.leave() · r.code · r.peer · r.status
// 'failed': the room could not be reached (3 more tries after the first before ever getting in, 6 in a row after): offer the bot.
// 'closed': this seat was opened in another tab. 'full': two phones are in the room already.
// The seat key lives in sessionStorage (`kit-relay:<game>:<code>`), so two tabs are two seats, and a phone whose old
// socket the server still holds takes its own seat back instead of finding the room full.
export function relay({ game, onFrame = () => {}, onPeer = () => {}, onStatus = () => {}, Socket = globalThis.WebSocket, where = globalThis.location,
  store = (() => { try { return globalThis.sessionStorage; } catch { return null; } })(), timers = globalThis, firstTries = 3, laterTries = 6 }) {
  let socket = null, epoch = 0, code = '', key = '', tries = 0, timer = null, wanted = false, wasLive = false, peer = false, status = 'off';
  const say = s => { if (s !== status) { status = s; onStatus(s); } };
  const setPeer = here => { if (here !== peer) { peer = here; onPeer(here); } };
  function close() { epoch++; timers.clearTimeout(timer); const old = socket; socket = null; if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(); } catch {} } }
  function retry() {
    if (!wanted) return;
    close(); setPeer(false);
    if (tries >= (wasLive ? laterTries : firstTries)) { wanted = false; say('failed'); return; }
    say('waiting');
    const wait = Math.min(8000, 500 * 2 ** Math.min(tries, 4)); tries++;
    timer = timers.setTimeout(connect, wait);
  }
  function connect() {
    if (!wanted) return;
    close(); const mine = epoch;
    if (!Socket) { wanted = false; say('failed'); return; }
    if (!wasLive && tries === 0) say('connecting');
    try { socket = new Socket(`${where.protocol === 'https:' ? 'wss' : 'ws'}://${where.host}/lab-api/room/${game}/${code}?k=${key}`); } catch { retry(); return; }
    socket.onmessage = event => {
      if (mine !== epoch) return;
      let q; try { q = JSON.parse(event.data); } catch { return; }
      if (!q || typeof q !== 'object') return;
      if (q.t === 'you') { tries = 0; wasLive = true; say('live'); setPeer(Array.isArray(q.peers) && q.peers.length > 0); }
      else if (q.t === 'join') setPeer(true);
      else if (q.t === 'leave') setPeer(false);
      else if (q.t === 'r' && Array.isArray(q.d)) onFrame(q.d);
    };
    socket.onerror = () => { if (mine === epoch) retry(); };
    socket.onclose = event => {
      if (mine !== epoch) return;
      if (event?.code === 4001) { wanted = false; close(); setPeer(false); say('full'); }
      else if (event?.code === 4003) { wanted = false; close(); setPeer(false); say('closed'); }
      else retry();
    };
  }
  const wake = () => { if (wanted && globalThis.document?.visibilityState !== 'hidden' && (!socket || socket.readyState > 1)) { tries = 0; connect(); } };
  try { globalThis.document?.addEventListener('visibilitychange', wake); globalThis.addEventListener?.('online', wake); } catch {}
  return {
    open(c) {
      code = cleanCode(c); if (!code) return false;
      const at = `kit-relay:${game}:${code}`;
      try { key = store?.getItem(at) || ''; } catch { key = ''; }
      if (!/^[a-z0-9]{16,40}$/.test(key)) { key = seatKey(game, code, null); try { store?.setItem(at, key); } catch {} }
      wanted = true; wasLive = false; tries = 0; setPeer(false); connect(); return true;
    },
    send(ints) { try { if (socket && socket.readyState === 1 && Array.isArray(ints)) { socket.send(JSON.stringify({ t: 'r', d: ints })); return true; } } catch {} return false; },
    leave() { wanted = false; close(); setPeer(false); say('off'); },
    get code() { return code; }, get peer() { return peer; }, get status() { return status; },
  };
}
