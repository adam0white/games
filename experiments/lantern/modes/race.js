// Lantern Race, a mode of Lantern. Up to eight boats race the same river live; first light wins. A room is the open river or a
// four-letter code; an empty room, or no connection, races three bots. The rules are Lantern's (../sim.js, unchanged) for every
// boat; the race layer is the lab page's (./race-sim.js, archive/lab/lantern-race/sim.js with one import path changed). The room
// is the lab page's: a WebSocket to /lab-api/room/lantern-race/<code> (workers/lab-ai/src/room.mjs). This file is the lab page's
// main.js moved inside Lantern: the page draws the river and the player's boat, steers, plays the music and keeps the HUD; this
// file runs the room, the lobby and the countdown, the bots and the results, and draws the other boats through the dark.
// How a mode plugs in is in ../NOTES.md ("How a mode plugs in"); why Race is built this way is under "Race is a mode inside Lantern".
import { create, step, progress, DT } from '../sim.js?v=15';
import { hull } from '../looks.js?v=4';
import { DISTANCE, SEND_MS, clamp, cleanName, roomCode, makeCode, dailySeed, countdown, decodeRoomFrame, position, ranking, ghostTrack, interpolate, nightForSeed, botControl, bytes } from './race-sim.js';
import { read, readJson, writeJson } from '../../kit/save.js';
import { shareLink } from '../../kit/room.js';
import { t } from '../words.js';

// Save. lantern-mode-race:save is { v: 1, best: 0..100000 (the farthest crossing), name: the boat's name, played: races finished }.
// The lab page's keys (lantern-race-best, lantern-race-name, lantern-race-played) are read once, and never written.
const KEY = 'lantern-mode-race:save';
function load() {
  let raw = readJson(KEY);
  if (raw === null && ['lantern-race-best', 'lantern-race-name', 'lantern-race-played'].some(k => read(k) !== null)) {
    raw = { v: 1, best: Number(read('lantern-race-best')), name: read('lantern-race-name'), played: read('lantern-race-played') === '1' ? 1 : 0 };
    writeJson(KEY, clean(raw));
  }
  return clean(raw);
}
function clean(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return { v: 1, best: clamp(Math.floor(Number(v.best)) || 0, 0, DISTANCE), name: cleanName(v.name ?? 'Lantern'), played: Math.max(0, Math.floor(v.played) || 0) };
}

const STYLE = `
#modePanel .raceForm { text-align: left; max-width: 20em; margin: 0 auto; }
#modePanel .raceForm label { display: block; font-size: 14px; opacity: .8; margin: .8em 0 .3em; }
#modePanel .raceForm input { width: 100%; box-sizing: border-box; height: 48px; border-radius: 12px; border: 1px solid #ffd9a055; background: #0b1018; color: #ffe6c0; font: inherit; font-size: 17px; padding: 0 12px; }
#modePanel .raceRow { display: flex; gap: 8px; align-items: center; }
#modePanel .raceRow input { flex: 1; min-width: 0; text-transform: uppercase; }
#modePanel .raceRow button { margin: 0; flex: 0 0 auto; }
#modePanel .raceTag { display: inline-block; padding: 6px 11px; border-radius: 20px; background: #ffd9a014; margin: 3px; font-size: 14px; }
#modePanel .raceTag.me { color: #ffd9a0; border: 1px solid #ffd9a055; }
#modePanel .raceEyebrow { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; opacity: .7; margin: 0; }
#modePanel .raceStatus { overflow-wrap: anywhere; }
#raceStrip { position: fixed; top: calc(64px + env(safe-area-inset-top)); left: 0; right: 0; text-align: center; pointer-events: none; display: none; font: 12px sans-serif; letter-spacing: .14em; color: #e8dcc6aa; text-transform: uppercase; }
#raceStrip.retire { color: #ffb08a; }
#raceBar { position: fixed; right: 14px; top: calc(110px + env(safe-area-inset-top)); bottom: calc(100px + env(safe-area-inset-bottom)); width: 24px; pointer-events: none; display: none; }
#raceBar::before { content: ''; position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; background: #c7d8d52b; }
#raceBar .dot { position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #10141c; background: var(--color); }
#raceBar .dot.me { box-shadow: 0 0 12px #ffc96c; border-color: #ffe8b6; }
#raceCount { position: fixed; inset: 0; display: none; place-items: center; pointer-events: none; }
#raceCount > div { text-align: center; width: min(85vw, 440px); padding: 12px 18px 18px; border-radius: 22px; background: #0a0e16cc; }
#raceCountN { font: 100px/1 Georgia, serif; color: #ffe0a2; text-shadow: 0 0 70px #ffc46d; }
#raceCountWho { font: 16px/1.4 sans-serif; color: #f6ead3; overflow-wrap: anywhere; }
#raceCountWho:empty { display: none; }
#raceStrip.on { display: block; } #raceBar.on { display: block; } #raceCount.on { display: grid; }
#raceRanks { margin: .4em auto; max-width: 22em; text-align: left; }
#raceRanks .rank { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; padding: 7px 0; border-bottom: 1px solid #ffd9a014; font-size: 14px; }
#raceRanks .rank.me { color: #ffdc94; }
#raceRanks p { text-align: center; font-size: 14px; opacity: .85; }
`;
const COLORS = ['#ffd28a', '#8ae5dd', '#e2a7e9', '#a7c9ff', '#c8e59a', '#ffa999', '#d4cdff', '#e8b998'];
const color = i => COLORS[Math.abs(Number(i)) % COLORS.length];
const ROUND_MS = 150000; // the room's round: a boat still racing then is retired (workers/lab-ai/src/room.mjs, roundMs)

// page: what index.html lends a mode. See ../NOTES.md for each name.
export function mode(page) {
  const save = load();
  const $ = id => document.getElementById(id);
  if (!$('raceStyle')) { const css = document.createElement('style'); css.id = 'raceStyle'; css.textContent = STYLE; document.head.append(css); }
  const strip = document.createElement('div'), bar = document.createElement('div'), count = document.createElement('div'), ranks = document.createElement('div');
  strip.id = 'raceStrip'; bar.id = 'raceBar'; count.id = 'raceCount'; ranks.id = 'raceRanks';
  count.innerHTML = '<div><div id="raceCountN"></div><div id="raceCountWho"></div></div>';
  $('hud').before(strip, bar, count); // under the HUD, the pause button and every card
  // The room a shared link names: /lantern/?mode=race&room=ABCD, or the lab page's old link after the worker's redirect.
  const query = new URLSearchParams(location.search), linked = roomCode(query.get('room') ?? new URLSearchParams((query.get('mode') ?? '').split('?')[1] ?? '').get('room'));
  const linkedRoom = linked === 'open' ? null : linked;

  // ------------------------------------------------------------ the lab page's state, as it was
  let phase = 'menu', pausedPhase = null, pauseAt = 0, s = null, nameNow = save.name, codeNow = '', codeError = '', shareStatus = '';
  let room = 'open', socket = null, connection = 0, timeout = null, online = false, offline = false, id = 1, connNote = '';
  let peers = new Map(), tracks = new Map(), racers = new Map(), bots = [];
  let pendingRoster = null, watching = new Map(), watchStart = 0, watchUntil = 0, readyUntil = 0, watchingOwnRound = false;
  let seed = 3, night = 1, startAt = 0, roundKey = '', endAt = 0, sendAt = 0, readyRetryAt = 0, botAcc = 0;
  let ready = false, finished = true, offlineRound = 0, countLast = -1, barLast = '', ranksLast = '', lobbyPaint = 0, retireArmed = 0, retireTimer = null;
  const received = { p: 0, done: 0 }, sent = { p: 0, done: 0 };
  const box = () => $('modePanel');
  const shown = () => page.screen?.() === 'mode';
  function send(m) {
    if (!online || socket?.readyState !== WebSocket.OPEN || bytes(m) > 200) return false;
    try { socket.send(JSON.stringify(m)); if (m.t in sent) sent[m.t]++; return true; } catch { fallback('off'); return false; }
  }
  function go(name) { // the lab page's screens: menu, friendsCard and lobby are Race's card; countdown, race and end are a run
    phase = name;
    if (['menu', 'friendsCard', 'lobby'].includes(name)) { if (page.screen?.() === 'mode') card(box()); else page.card(); }
    overlays();
  }

  // ------------------------------------------------------------ the card: menu, friends and lobby, in #modePanel
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  function card(b) {
    b.textContent = '';
    const pageBack = document.querySelector('#mode .back'); if (pageBack) pageBack.hidden = phase !== 'menu'; // in Race's own sub-cards, their own button goes back one step; the page's Back would leave the mode with a room open
    const flat = () => read('lantern-view', '2d') !== '2d' ? [el('p', { className: 'hint', textContent: t('raceFlat') })] : [];
    if (phase === 'friendsCard') {
      const code = el('input', { id: 'raceCode', maxLength: 4, placeholder: 'ABCD', autocomplete: 'off', value: codeNow });
      code.setAttribute('autocapitalize', 'characters');
      code.oninput = () => { code.value = codeNow = code.value.replace(/[^a-z]/gi, '').toUpperCase(); codeError = ''; $('raceCodeError').textContent = ''; };
      const join = el('button', { id: 'raceJoin', textContent: t('raceJoin') });
      join.onclick = () => { const c = roomCode(code.value); if (!c || c === 'open') { codeError = t('raceFour'); $('raceCodeError').textContent = codeError; page.tone(180, 0.1, 0.045, 'triangle'); } else enter(c); };
      const make = el('button', { id: 'raceMake', className: 'main', textContent: t('raceMake') });
      make.onclick = () => { const buf = new Uint32Array(1); crypto.getRandomValues(buf); enter(makeCode(buf[0])); };
      const back = el('button', { id: 'raceBack', textContent: t('back') }); back.onclick = () => { tone(); go('menu'); };
      b.append(el('p', { className: 'raceEyebrow', textContent: t('raceSame') }), el('h2', { textContent: t('raceFriends') }), el('p', {}, make),
        el('div', { className: 'raceForm' }, el('label', { htmlFor: 'raceCode', textContent: t('raceCodeLabel') }), el('div', { className: 'raceRow' }, code, join)),
        el('p', { id: 'raceCodeError', className: 'hint', textContent: codeError, role: 'status' }), el('p', {}, back));
      return;
    }
    if (phase === 'lobby') {
      const list = el('div', { id: 'racePeers' }), line = el('p', { id: 'raceLobbyLine', className: 'hint' });
      const readyB = el('button', { id: 'raceReady', className: 'main' }); readyB.onclick = requestReady;
      const share = el('button', { id: 'raceShare', textContent: t('raceShare') }); share.onclick = shareRoom;
      const status = el('p', { id: 'raceShareStatus', className: 'hint raceStatus', textContent: shareStatus, role: 'status' });
      const conn = el('p', { id: 'raceConn', className: 'hint', textContent: connNote, ariaLive: 'polite' });
      const leaveB = el('button', { id: 'raceLeave', textContent: t('raceLeaveRoom') }); leaveB.onclick = () => { leave(); go('menu'); };
      b.append(el('p', { className: 'raceEyebrow', textContent: t('raceWaiting') }), el('h2', { id: 'raceRoomTitle', textContent: room === 'open' ? t('raceQuick') : room }), list, line, el('p', {}, readyB), el('p', {}, share, leaveB), status, conn);
      lobby();
      return;
    }
    const name = el('input', { id: 'raceName', maxLength: 16, autocomplete: 'off', placeholder: 'Lantern', value: nameNow });
    name.oninput = () => { nameNow = name.value; };
    const quick = el('button', { id: 'raceQuick', className: 'main', textContent: linkedRoom ? t('raceJoinRoom', { code: linkedRoom }) : t('raceQuick') });
    quick.onclick = () => enter(linkedRoom || 'open');
    const friends = el('button', { id: 'raceFriends', textContent: t('raceFriends') }); friends.onclick = () => { tone(); go('friendsCard'); };
    b.append(el('h2', { textContent: t('modeRace') }), el('p', { textContent: t('raceTagline') }),
      el('div', { className: 'raceForm' }, el('label', { htmlFor: 'raceName', textContent: t('raceNameLabel') }), name),
      el('p', {}, quick), el('p', {}, friends), el('p', { id: 'raceBest', className: 'hint', textContent: save.best ? t('raceBest', { pct: Math.round(save.best / 1000) }) : '' }),
      el('p', { className: 'hint', textContent: t('raceRule') }), ...flat());
  }
  const tone = (f = 550, duration = 0.1, volume = 0.045) => page.tone(f, duration, volume, 'triangle');
  function lobbyClock(now = performance.now()) {
    let text = t('raceStartsWhen');
    if (offline) text = t('raceOffline');
    else if (now < watchStart) text = t('raceWatchIn', { n: Math.ceil((watchStart - now) / 1000) });
    else if (watchUntil > now) text = ready ? t('raceWatchReady') : t('raceWatch');
    else if (ready) { const remaining = Math.ceil((readyUntil - now) / 1000); text = remaining > 0 ? t('raceGather', { n: remaining }) : t('raceWaitRoom'); }
    const line = $('raceLobbyLine'); if (line && line.textContent !== text) line.textContent = text;
  }
  function lobby() {
    const list = $('racePeers'); if (!list || phase !== 'lobby') return;
    $('raceRoomTitle').textContent = room === 'open' ? t('raceQuick') : room;
    list.replaceChildren();
    for (const p of peers.values()) {
      const tag = document.createElement('span'), observed = watching.get(p.id);
      tag.className = 'raceTag' + (p.id === id ? ' me' : '');
      tag.textContent = p.n + (p.id === id ? (ready ? t('raceYouReady') : t('raceYou')) : observed ? (observed.done ? t('raceFinished') : t('racePeerPct', { pct: Math.round(observed.d / 1000) })) : '');
      list.append(tag);
    }
    lobbyClock();
    const r = $('raceReady'); r.disabled = ready; r.textContent = ready ? t('raceReadyDone') : t('raceReady');
    $('raceConn').textContent = connNote;
  }
  function note(text) { connNote = text; const c = $('raceConn'); if (c) c.textContent = text; }

  // ------------------------------------------------------------ the room (the lab page's code)
  function disconnect() { connection++; clearTimeout(timeout); online = false; const old = socket; socket = null; if (old) { old.onclose = old.onerror = old.onmessage = old.onopen = null; old.close(); } }
  function enter(code) {
    tone(); disconnect(); room = code; id = 1; nameNow = cleanName(nameNow); peers = new Map([[1, { id: 1, n: nameNow }]]); tracks.clear(); racers.clear(); ready = false; offline = false; roundKey = ''; finished = true; bots = [];
    pendingRoster = null; watching.clear(); watchStart = watchUntil = readyUntil = 0; watchingOwnRound = false;
    save.name = nameNow; writeJson(KEY, save);
    connNote = t('raceConnecting'); shareStatus = ''; go('lobby');
    const epoch = connection;
    const fail = why => { if (epoch === connection) fallback(why); };
    try {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/lab-api/room/lantern-race/${room}`);
      socket.onopen = () => { if (epoch !== connection) return; online = true; send({ t: 'hi', n: nameNow }); };
      socket.onmessage = event => { if (epoch !== connection) return; const m = decodeRoomFrame(event.data); if (m) receive(m); };
      socket.onerror = () => fail('off');
      socket.onclose = event => fail(event.code === 4001 ? 'full' : 'off');
      timeout = setTimeout(() => fail('off'), 2500);
    } catch { fail('off'); }
  }
  function fallback(why) {
    if (offline || phase === 'menu' || phase === 'friendsCard') return;
    disconnect(); offline = true; note(why === 'full' ? t('raceFull') : t('raceOff'));
    peers = new Map([[id, { id, n: nameNow }]]);
    watching.clear(); watchStart = watchUntil = 0; pendingRoster = null; watchingOwnRound = false;
    for (const key of racers.keys()) if (key !== id) opponentLeft(key);
    lobby();
    if (ready && phase === 'lobby') localRound();
  }
  function opponentLeft(key) {
    const p = racers.get(key);
    tracks.delete(key);
    if (!p || p.bot || p.left || p.s !== undefined) return;
    const bot = bots.find(b => b.id === key);
    if (bot && p.a && !finished) { bot.active = true; racers.set(key, botEntry(bot)); }
    else { p.a = 0; p.left = true; }
  }
  function observe(m, now) {
    if (!peers.has(m.id) || m.id === id) return;
    if (now >= watchUntil) { watching.clear(); watchStart = 0; watchUntil = now + ROUND_MS; }
    let prior = watching.get(m.id);
    if (m.t === 'p' && prior?.done && m.a) { watching.clear(); prior = undefined; watchUntil = now + ROUND_MS; }
    if (m.t === 'p' && prior?.d > m.d) return;
    const next = m.t === 'done' ? { d: prior?.d ?? 0, done: true } : { d: m.d, done: !m.a };
    watching.set(m.id, next);
    if (next.done !== prior?.done || Math.round(next.d / 1000) !== Math.round(prior?.d / 1000)) lobby();
  }
  const waitingForRacers = () => [...racers.values()].some(p => !p.bot && !p.left && p.s === undefined);
  function settleWatch() { if (!watchingOwnRound || waitingForRacers()) return; watchingOwnRound = false; watching.clear(); watchStart = watchUntil = 0; lobby(); }
  function receive(m) {
    const now = performance.now();
    if (m.t === 'you') {
      clearTimeout(timeout); id = m.id; peers = new Map(m.peers.map(p => [p.id, p])); peers.set(id, { id, n: nameNow });
      offline = false; note(t('raceLive', { room: room === 'open' ? t('raceOpenRiver') : room }));
      if (m.round) { const offset = m.round.start - Date.now(); watchStart = now + clamp(offset, 0, 6000); watchUntil = now + clamp(offset + ROUND_MS, 0, ROUND_MS + 6000); readyUntil = 0; }
      lobby();
      if (ready) transmitReady(now);
    } else if (m.t === 'join') {
      peers.set(m.id, { id: m.id, n: m.n }); lobby();
      const p = racers.get(m.id); if (p && !p.bot && !p.left && p.s === undefined) p.n = m.n;
    } else if (m.t === 'leave') {
      peers.delete(m.id); watching.delete(m.id);
      const pending = pendingRoster?.get(m.id); if (pending) pending.left = true;
      opponentLeft(m.id); settleWatch(); lobby();
    } else if (m.t === 'roster') {
      pendingRoster = new Map(m.ids.map(key => [key, { id: key, n: peers.get(key)?.n ?? 'Boat' }]));
    } else if (m.t === 'round') {
      const roster = pendingRoster; pendingRoster = null;
      if (roster?.has(id)) beginRound(m, roster);
    } else if (m.t === 'p' || m.t === 'done') {
      const p = racers.get(m.id);
      if (phase === 'lobby' && (!roundKey || finished) && !p?.bot && !p?.left) observe(m, now);
      if (!roundKey || !p || p.bot || p.left) return;
      if (m.t === 'p') {
        if (m.id === id || p.s !== undefined || (phase === 'countdown' && m.a) || (p.a === 0 && m.a)) return;
        received.p++; tracks.set(m.id, ghostTrack(m, now, tracks.get(m.id)));
        if (m.d >= p.d) { p.d = m.d; p.a = m.a; }
      } else { received.done++; if (p.s !== undefined) return; p.s = m.s; p.a = 0; tracks.delete(m.id); settleWatch(); }
    }
  }
  function localRound() { const daily = dailySeed(new Date().toISOString().slice(0, 10)); beginRound({ seed: (daily + offlineRound++) >>> 0, start: Date.now() + 3200 }, peers); }
  function transmitReady(now) { if (send({ t: 'ready' }) && !readyUntil && now >= watchUntil) readyUntil = now + 8000; readyRetryAt = now + 2000; }
  function requestReady() {
    if (ready || !['lobby', 'end'].includes(phase)) return;
    tone(660, 0.15); ready = true;
    if (phase === 'end' && waitingForRacers()) { watchingOwnRound = true; watchUntil = endAt; }
    if (phase === 'end') go('lobby'); else lobby();
    if (offline) localRound(); else if (online) transmitReady(performance.now());
  }
  function beginRound(round, roster) {
    const key = `${round.seed}:${round.start}`; if (roundKey === key) return;
    roundKey = key; seed = round.seed; night = nightForSeed(seed); startAt = performance.now() + countdown(round.start, Date.now()); endAt = startAt + ROUND_MS;
    s = create(seed, night, false, []); sendAt = startAt; finished = false; ready = false; tracks.clear(); countLast = -1; barLast = ranksLast = ''; botAcc = 0;
    watching.clear(); watchStart = watchUntil = readyUntil = 0; watchingOwnRound = false;
    racers = new Map([...roster].map(([k, p]) => [k, { id: k, n: p.n, d: 0, a: 1 }]));
    const botIds = offline ? [9, 10, 11] : [...racers.keys()].filter(k => k !== id);
    bots = botIds.map((k, i) => ({ id: k, n: `${offline ? ['Reed', 'Glimmer', 'Drift'][i] : racers.get(k).n} · ${t('raceBot')}`, s: create(seed, night, false, []), policy: { skill: i % 3, id: i, next: 0 }, elapsed: null, active: offline }));
    for (const b of bots) if (b.active) racers.set(b.id, botEntry(b));
    for (const p of roster.values()) if (p.left) opponentLeft(p.id);
    $('raceCountWho').textContent = offline ? '' : t('raceCountWho', { names: [...roster.values()].map(p => p.n).join(' · ') });
    disarm(); phase = 'countdown';
    page.play(); // the page's run: begin() takes this river from start() and shows the play screen
  }
  const botEntry = b => ({ id: b.id, n: b.n, bot: true, d: Math.round(progress(b.s) * DISTANCE), s: b.elapsed ?? undefined, a: b.s.over ? 0 : 1 });
  function publish(final = false) {
    send(position(s.x, Math.round(progress(s) * DISTANCE), !finished)); const now = performance.now(); sendAt = final || sendAt < now - SEND_MS ? now + SEND_MS : sendAt + SEND_MS;
    if (final) send({ t: 'done', s: Math.round(s.t * 1000) });
  }
  // The end of the player's race (the lab page's finish): the result is sent and the best kept. The page's end card follows.
  function settle(reason) {
    if (finished) return; finished = true; disarm();
    if (!s.over) s.over = reason;
    const p = racers.get(id); p.d = Math.round(progress(s) * DISTANCE); p.s = Math.round(s.t * 1000); p.a = 0;
    publish(true); save.best = Math.max(save.best, p.d); save.played++; writeJson(KEY, save);
  }
  function leave() { // the lab page's menu(): a boat still racing retires, and the room is left
    if (['countdown', 'race', 'paused'].includes(phase) && s && !finished) settle('left');
    disconnect(); offline = false; ready = false; finished = true; bots = []; roundKey = ''; connNote = ''; phase = 'menu'; overlays();
  }
  function stepBots() {
    for (const b of bots) if (!b.s.over && (!finished || b.active)) {
      step(b.s, botControl(b.s, b.policy));
      if (b.s.over) b.elapsed = Math.round(b.s.t * 1000);
      if (b.active) racers.set(b.id, botEntry(b));
    }
  }
  // The pause button in a live race: a live race cannot stop its clock, so the button retires the boat, and one stray tap must
  // not end a race: the first tap asks. P, Escape and leaving the page retire at once, as on the lab page. Offline, the page pauses.
  function disarm() { clearTimeout(retireTimer); retireArmed = 0; strip.classList.remove('retire'); stripText(); }
  function stripText() { strip.textContent = retireArmed ? t('raceRetireAsk') : `${room === 'open' ? t('raceOpenLine') : t('raceRoomLine', { room })} · ${label()}`; }
  const label = () => t(racers.size === 1 ? 'raceLabel1' : 'raceLabel', { n: night, k: racers.size });
  function pause(why) {
    if (!['race', 'countdown'].includes(phase) || finished || offline) return false;
    if (why === 'button' && performance.now() >= retireArmed) {
      retireArmed = performance.now() + 2500; strip.classList.add('retire'); stripText(); tone(330, 0.08);
      clearTimeout(retireTimer); retireTimer = setTimeout(disarm, 2500); return true;
    }
    settle('left'); return true; // the page's next tick ends the run with s.over 'left'
  }
  async function shareRoom() {
    tone(); const link = new URL(`/lantern/?mode=race&room=${room}`, location.origin).href;
    const how = await shareLink(link, t('raceShareWords'));
    shareStatus = how === 'shared' ? t('raceShared') : how === 'copied' ? t('raceCopied') : link;
    const st = $('raceShareStatus'); if (st) st.textContent = shareStatus;
  }

  // ------------------------------------------------------------ results on the page's end card
  function renderResults() {
    const list = ranking([...racers.values()]), pending = list.filter(p => p.a && p.id !== id).length;
    const key = list.map(p => `${p.id}:${p.d}:${p.s}:${p.a}`).join(',') + pending + save.best; if (key === ranksLast && ranks.isConnected) return; ranksLast = key;
    ranks.replaceChildren();
    for (const [i, p] of list.entries()) {
      const row = document.createElement('div'); row.className = 'rank' + (p.id === id ? ' me' : '');
      const cells = [String(i + 1).padStart(2, '0'), p.n + (p.id === id ? t('raceYou') : ''), p.d >= DISTANCE ? `${((p.s ?? 0) / 1000).toFixed(1)}s` : `${Math.round(p.d / 1000)}%${p.a ? ' ↗' : ''}`];
      for (const c of cells) row.append(Object.assign(document.createElement('span'), { textContent: c }));
      ranks.append(row);
    }
    const line = document.createElement('p'); line.id = 'raceEndLine';
    line.textContent = pending ? t(pending === 1 ? 'racePending1' : 'racePending', { n: pending }) : '';
    const best = document.createElement('p'); best.id = 'raceEndBest'; best.textContent = t('raceBest', { pct: Math.round(save.best / 1000) });
    ranks.prepend(line); ranks.append(best);
    if (!ranks.isConnected) $('line').after(ranks);
  }
  function updateBar() {
    const data = [...racers.values()], key = data.map(p => `${p.id}:${Math.round(p.d / 500)}:${p.a}`).join(','); if (barLast === key) return; barLast = key;
    bar.replaceChildren();
    for (const p of data) { const dot = document.createElement('span'); dot.className = 'dot' + (p.id === id ? ' me' : ''); dot.style.setProperty('--color', p.id === id ? '#ffd28a' : color(p.id)); dot.style.bottom = `calc(${p.d / 1000}% - ${p.d / DISTANCE * 14}px)`; dot.style.left = `${4 + (p.id % 3) * 4}px`; dot.title = p.n; bar.append(dot); }
  }
  function overlays() {
    const play = page.screen?.() === 'play', racing = play && ['countdown', 'race'].includes(phase);
    strip.classList.toggle('on', racing); bar.classList.toggle('on', racing); count.classList.toggle('on', racing && phase === 'countdown');
    if (!(page.screen?.() === 'card' && !page.paused() && phase === 'end')) ranks.remove();
  }

  // ------------------------------------------------------------ the other boats, drawn through the dark as embers are
  function ghosts(now) {
    return [
      ...bots.filter(b => b.active).map(b => ({ ...botEntry(b), x: b.s.x * 2 - 1, y: b.s.y })),
      ...[...tracks].map(([key, track]) => ({ ...racers.get(key), ...interpolate(track, now) })),
    ];
  }
  function top(now) {
    if (!s || !roundKey) return;
    const { W, H, unit, left, dpr } = page.size(), g = page.g(), sx = x => left + x * unit, sy = y => H * 0.74 - (y - s.y) * unit, tt = now / 1000;
    const visible = ghosts(now).filter(p => p.a && Math.abs(p.d / DISTANCE * 78 - s.y) < H / unit);
    const play = page.screen?.() === 'play', placed = []; // names are drawn only in play, and pushed down past one another so boats side by side stay readable
    visible.forEach((p, i) => {
      // The report's distance is progress to dawn, including slow-water credit. No powers in a race.
      let y = sy(p.y ?? p.d / DISTANCE * 78); if (Math.abs(y - H * 0.74) < 34 * dpr) y -= (84 + i * 34) * dpr; // a name hangs below its boat: clear the player's own
      const x = sx((p.x + 1) / 2), col = color(p.id), r = unit * 0.1;
      g.save(); g.translate(x, y); g.globalAlpha = play ? 0.55 : 0.3;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `${col}38`); gr.addColorStop(1, `${col}00`); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r);
      hull(g, 'oak', unit * 0.85, '#99bab5', tt);
      g.shadowColor = col; g.shadowBlur = 12 * dpr; g.fillStyle = '#fff4d0'; g.beginPath(); g.ellipse(0, -3 * dpr, (3.5 + Math.sin(now / 87) * 0.5) * dpr, 7 * dpr, Math.sin(now / 200) * 0.12, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      if (!play) { g.restore(); return; }
      g.globalAlpha = 0.95; g.font = `${14 * dpr}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const w = g.measureText(p.n).width + 16 * dpr, lx = clamp(x, w / 2 + 6 * dpr, W - w / 2 - 38 * dpr) - x;
      let ly = 28 * dpr; while (placed.some(q => Math.abs(q.x - (x + lx)) < (q.w + w) / 2 && Math.abs(q.y - (y + ly)) < 26 * dpr)) ly += 26 * dpr;
      placed.push({ x: x + lx, y: y + ly, w });
      g.fillStyle = '#0b1018df'; g.fillRect(lx - w / 2, ly, w, 24 * dpr); g.fillStyle = col; g.fillText(p.n, lx, ly + 17 * dpr);
      g.restore();
    });
  }

  // ------------------------------------------------------------ between frames: the lobby's clock, the countdown, the bots after the finish
  function frame(dt, now) {
    if (phase === 'lobby') {
      if (watchUntil && now >= watchUntil) { watchStart = watchUntil = 0; watching.clear(); lobby(); }
      if (ready && online && now >= readyRetryAt) transmitReady(now);
      if (now - lobbyPaint >= 100) { lobbyClock(now); lobbyPaint = now; }
    }
    if (phase === 'countdown') {
      const remaining = Math.ceil((startAt - now) / 1000);
      if (remaining !== countLast) { $('raceCountN').textContent = String(Math.max(1, remaining)); countLast = remaining; tone(remaining > 0 ? 440 : 880, 0.14); }
    }
    if (phase === 'end') { // the other boats race on so the results can settle; at the room's deadline a boat still out is retired
      botAcc += Math.min(0.2, dt); while (botAcc >= DT) { stepBots(); botAcc -= DT; }
      if (now >= endAt) for (const p of racers.values()) if (p.a) { p.a = 0; p.left = true; }
      if (page.screen?.() === 'card' && !page.paused()) renderResults();
    }
    if (s && roundKey && ['countdown', 'race'].includes(phase)) { updateBar(); if (!retireArmed) stripText(); }
  }

  // One tick of the page's run. The countdown holds the river still; then Lantern's rules move the player's boat and the bots.
  function stepRun(target) {
    const now = performance.now();
    if (finished) { s.over ||= 'left'; return []; } // retired (the pause button, a key, leaving the page): the page's finish follows
    if (phase === 'countdown') { if (now < startAt) return []; phase = 'race'; overlays(); }
    if (now >= endAt) { settle('left'); return []; }
    step(s, target);
    racers.get(id).d = Math.round(progress(s) * DISTANCE);
    stepBots();
    if (!s.over && now >= sendAt) publish();
    if (s.over) settle(s.over);
    return s.events;
  }
  // The end card's words (the page has banked the embers and recorded the run). Results fill in under them as boats finish.
  function end() {
    settle(s.over); phase = 'end'; botAcc = 0; ranksLast = '';
    const why = s.over;
    return { title: t(why === 'dawn' ? 'raceDawn' : why === 'left' ? 'raceLeft' : why === 'dark' ? 'raceDark' : why === 'bank' ? 'raceBank' : 'raceWreck'), line: label(), go: t('raceRematch') };
  }

  return {
    id: 'race', own: true, // the river is the race's seed: the menu gets a fresh river of its own
    card: b => card(b),
    start: () => s, // beginRound made the river: the shared seed's night, no stats, no gifts, no abilities, for every boat alike
    step: stepRun,
    react() {}, // the page plays Lantern's own sounds for the run's events
    reach: () => s ? progress(s) : 0,
    night: () => night,
    hello: () => label(),
    pauseLine: () => t('racePause'),
    end, frame, top, pause,
    go() { requestReady(); return true; }, // the end card's button is Rematch: Ready again, in the lobby
    screen(name, b) {
      const now = performance.now();
      if (name === 'card' && page.paused() && ['countdown', 'race'].includes(phase)) { pausedPhase = phase; pauseAt = now; phase = 'paused'; } // offline only: a live race never pauses
      if (name === 'play' && phase === 'paused') { if (pausedPhase === 'countdown') { startAt = now + 3000; endAt = startAt + ROUND_MS; } else endAt += now - pauseAt; phase = pausedPhase; countLast = -1; }
      if (name === 'mode') { if (['countdown', 'race', 'paused', 'end'].includes(phase)) leave(); card(b); } // the card's Menu leaves the room, as on the lab page
      if (name === 'menu') { leave(); s = null; }
      else if (!['mode', 'play', 'card'].includes(name) && phase !== 'menu') leave(); // any other screen: no room stays open behind it
      if (name !== 'mode') { const pageBack = document.querySelector('#mode .back'); if (pageBack) pageBack.hidden = false; } // the other modes keep the page's Back
      overlays();
      if (name === 'card' && !page.paused() && phase === 'end') { ranksLast = ''; renderResults(); }
    },
    state: () => ({ phase, room, me: id, online, offline, seed, night, ready, best: save.best, name: save.name, played: save.played, peers: [...peers.values()], linked: linkedRoom,
      results: ranking([...racers.values()]), ghosts: s ? ghosts(performance.now()) : [], received: { ...received }, sent: { ...sent }, d: s ? Math.round(progress(s) * DISTANCE) : 0, over: s?.over ?? null }),
    game: () => s,
  };
}
