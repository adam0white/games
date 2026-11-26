// Play recording for the game lab. A small hand-written client for the lab's linked endpoint
// (POST https://human.adamwhite.work/lab/api/linked, gzip JSON envelope v2), the same wire format that
// @adam0white/lab-client 0.5.19 sends. Why not the lab client itself: see README.md.
//
//   const rec = lab('lantern');
//   rec.notice(menuCard);          the recording notice; nothing is recorded or sent before it is on the page
//   rec.toggle(pauseCard);         the "Record this play" switch the notice points to
//   lab('lantern', { lang })       optional: the page's own language, e.g. `lang` from kit/i18n.js words(); the notice,
//                                  the Privacy link and the switch then follow it (English and Turkish, from WORDS below)
//                                  and change when the page switches language. Without it they are in English.
//   rec.start({ night: 3 });       a run begins
//   rec.event('buy', { pack });    a choice, a purchase; outside a run it is sent at once as its own record
//   rec.end('dawn', { embers });   the run ends with an outcome and a small summary; this sends it
//
// Besides the game's own events, a page that shows the notice records how it is played, for every game with no work
// in the game: an input trace (pointer down, move and up as fractions of the viewport, moves at most 20 a second while
// pressed and 5 while hovering; keys by their key code, and only "a key was pressed" inside a text field; taps on
// buttons by their label), page hide, show, focus and resize, frame times every 10 s during a run, page errors and
// unhandled rejections (message and a short stack, addresses cut to their path), and a coarse device class and the
// viewport size. All of it goes in the run's `trace`. Input made outside a run (a menu, the end card) is kept, bounded,
// and goes with the next run, never alone. A long run is sent in numbered parts (`part`, the same runId, the last one
// has `final: true` and `parts`), so nothing is cut off; a part is sent when its buffer passes PART_BYTES of JSON
// (never on a timer), when the page is hidden, and when the run ends. A short run is still one run record.
//
// Every call returns at once and never throws. A record the lab refuses (any answer but 200), or that cannot be sent,
// goes into a small queue in localStorage (QUEUE_MAX records, QUEUE_BYTES of JSON, QUEUE_DAYS old at most) and a small
// line on the page says "Lab not recording: <reason>". The queue is sent again when a lab page opens and after the next
// record the lab accepts, so play is kept if the lab is fixed later. Switching recording off empties the queue.
// Storage keys are the lab client's own on this origin, so the off switch is the same switch other lab
// games on play.adamwhite.work use, and the player id is the one they use.
export const ENDPOINT = 'https://human.adamwhite.work/lab/api/linked';
// The notice names the switch itself rather than where it is: pages put the switch on a pause card, a settings card
// or beside the notice, so "in the pause menu" was not true on every page. Every page that shows the notice also
// calls rec.toggle(). The Turkish has not been read by a native speaker.
export const WORDS = {
  en: { notice: 'The game lab records play, links it to other lab play on this device, and keeps it for 180 days. To stop it, untick “Record this play for the game lab”.', privacy: 'Privacy', toggle: 'Record this play for the game lab' },
  tr: { notice: 'Oyun laboratuvarı oyunu kaydeder, bu cihazdaki diğer laboratuvar oyunlarıyla ilişkilendirir ve 180 gün saklar. Durdurmak için “Bu oyunu oyun laboratuvarı için kaydet” işaretini kaldır.', privacy: 'Gizlilik', toggle: 'Bu oyunu oyun laboratuvarı için kaydet' },
};
export const NOTICE = WORDS.en.notice;
export const PRIVACY = 'https://human.adamwhite.work/lab/privacy/';
const PLAYER = 'hf-lab-player', OFF = 'hf-lab-recording-off', QUEUE = 'hf-lab-kit-queue';
// A run's game events stay together in its last record while they are within MAX_EVENTS and MAX_BYTES (a game such as
// Cinderhill keeps its own records under these and reads them back whole). A run that goes past them carries its game
// events in its parts from then on, so none is lost. The trace goes in a part once what is waiting passes PART_BYTES of
// JSON; a run sends at most MAX_PARTS parts (about 7 MB), then keeps only its game events. PRE_ITEMS bounds input kept
// from outside a run. FINAL_BYTES keeps the last part well under the lab's 512 KB inflated limit.
export const MAX_EVENTS = 300, MAX_BYTES = 96 * 1024;
export const PART_BYTES = 64 * 1024, MAX_PARTS = 120, PRE_ITEMS = 600, MAX_GAME_EVENTS = 20000, FINAL_BYTES = 384 * 1024;
export const QUEUE_MAX = 60, QUEUE_BYTES = 1024 * 1024, QUEUE_DAYS = 30, QUEUE_TRIES = 20;

const get = (area, k) => { try { return globalThis[area].getItem(k); } catch { return null; } };
const set = (area, k, v) => { try { v === null ? globalThis[area].removeItem(k) : globalThis[area].setItem(k, v); } catch {} };
const hex = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); };
const isHex = v => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const local = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith('.localhost');
const signal = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';

// options: { version, endpoint, fetch } — fetch and endpoint are for tests; version goes in build.a.
export function lab(game, options = {}) {
  const none = { notice() {}, toggle() {}, retext() {}, start() {}, event() {}, end() {}, get on() { return false; }, sent: 0 };
  try { if (!/^[a-z0-9-]{1,40}$/.test(game) || !globalThis.crypto?.getRandomValues) return none; } catch { return none; }
  const send = options.fetch ?? ((...a) => fetch(...a));
  const endpoint = options.endpoint ?? ENDPOINT;
  const build = /^[0-9A-Za-z.+-]{1,20}$/.test(options.version ?? '') ? { a: options.version } : {};
  let agent = false; try { agent = new URLSearchParams(location.search).get('labRunSource') === 'agent'; } catch {}
  const eventsOff = `hf-lab-events-off:${game}`, overrideKey = `hf-lab-privacy-override:${game}`;
  let noticed = false, run = null, between = 0;
  const self = { sent: 0 };
  // Words: the page's language when it passed one (only 'en' and 'tr' have tables), English otherwise.
  const say = key => { let l = 'en'; try { if (typeof options.lang === 'function') l = String(options.lang() || '').slice(0, 2).toLowerCase(); } catch {} return (WORDS[l] ?? WORDS.en)[key]; };
  const made = { notices: [], toggles: [] };

  // Recording is on when the notice is on the page, nobody switched it off, the browser sends no
  // Do Not Track or Global Privacy Control signal (unless the player switched recording on here),
  // and the page is not a local development copy (a check can allow that with hf-lab-send-localhost).
  const override = () => get('localStorage', overrideKey) === '1';
  const on = () => { try {
    return noticed && get('localStorage', OFF) !== '1' && get('localStorage', eventsOff) !== '1' && (!signal() || override()) &&
      (!local() || options.fetch !== undefined || get('localStorage', 'hf-lab-send-localhost') === '1');
  } catch { return false; } };
  const player = () => { const old = get('localStorage', PLAYER); if (isHex(old)) return old; const id = hex(); set('localStorage', PLAYER, id); return isHex(get('localStorage', PLAYER)) ? id : null; };
  const session = () => {
    const key = `hf-lab-session:${game}`, [sid, at] = (get('sessionStorage', key) ?? '').split(':');
    if (isHex(sid) && Number.isFinite(Number(at))) return { sid, started: Number(at) };
    const fresh = { sid: hex(), started: Date.now() }; set('sessionStorage', key, `${fresh.sid}:${fresh.started}`); return fresh;
  };
  const viewport = () => { const w = innerWidth; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'desktop'; };

  // Answers: 'ok' (stored), 'skip' (never retried: too large, or the lab dropped it for a privacy signal), or a reason code.
  async function post(record) {
    if (typeof CompressionStream !== 'function') return 'skip';
    // Bytes go straight into the compressor. A Blob's stream is read through a blob address, and WebKit raises
    // a page error ("Cannot load blob ... due to access control checks") when the page leaves mid-read.
    const gz = new CompressionStream('gzip'), w = gz.writable.getWriter();
    w.write(new TextEncoder().encode(JSON.stringify(record))).catch(() => {}); w.close().catch(() => {});
    const body = await new Response(gz.readable).arrayBuffer();
    if (body.byteLength > 250 * 1024) return 'skip';
    let res;
    try { res = await send(endpoint, { method: 'POST', body, headers: { 'Content-Type': 'application/gzip' }, credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', keepalive: body.byteLength < 60000 }); }
    catch { return 'network'; }
    if (res && res.status === 200) { self.sent++; return 'ok'; }
    if (res && res.status === 204) { warn('privacy-signal'); return 'skip'; }
    let code = '';
    try { const j = await res.json(); if (typeof j?.error === 'string') code = j.error; } catch {}
    return (code || `http ${res?.status ?? 'none'}`).replace(/[^\w .:-]/g, '').slice(0, 40);
  }

  // The queue: records the lab did not store, oldest first, shared by every kit page on this origin.
  // Expired or worn-out items are dropped on every read, so none is sent before it is removed.
  const fresh = x => x && x.r && Number.isFinite(x.r.at) && Date.now() - x.r.at < QUEUE_DAYS * 86400000 && (x.n ?? 0) < QUEUE_TRIES;
  const readQueue = () => { try { const q = JSON.parse(get('localStorage', QUEUE) ?? '[]'); return Array.isArray(q) ? q.filter(fresh) : []; } catch { return []; } };
  // A queued record may come from another game. It is sent only while recording is on for that game now:
  // not switched off, its events not switched off, and under a privacy signal only with that game's own tick.
  const allowedFor = g => typeof g === 'string' && /^[a-z0-9-]{1,40}$/.test(g) && get('localStorage', OFF) !== '1' &&
    get('localStorage', `hf-lab-events-off:${g}`) !== '1' && (!signal() || get('localStorage', `hf-lab-privacy-override:${g}`) === '1');
  const writeQueue = q => {
    const kept = q.filter(x => fresh(x) && allowedFor(x.r.game));
    while (kept.length > QUEUE_MAX || (kept.length && JSON.stringify(kept).length > QUEUE_BYTES)) kept.shift();
    set('localStorage', QUEUE, kept.length ? JSON.stringify(kept) : null);
  };
  const enqueue = r => { if (JSON.stringify(r).length > QUEUE_BYTES / 4) return; const q = readQueue(); if (!q.some(x => x.r?.id === r.id)) q.push({ r, n: 0 }); writeQueue(q); };
  let draining = false;
  const inFlight = new Set(); // ids this page is sending now; the queue holds them too, and drain leaves them alone
  async function drain() {
    if (draining || !on()) return; draining = true;
    try {
      for (const item of readQueue()) {
        if (!on()) break;
        if (inFlight.has(item.r?.id) || held.some(h => h.id === item.r?.id)) continue; // held: posted when the page is back
        if (!fresh(item) || !allowedFor(item.r.game)) { dequeue(item.r.id); continue; }
        // The privacy flag says what holds now, not what held when the record was made.
        const out = { ...item.r }; delete out.privacyOverride; if (signal()) out.privacyOverride = true;
        const answer = await post(out);
        const q = readQueue(), i = q.findIndex(x => x.r?.id === item.r.id);
        if (i < 0) continue;
        if (answer === 'ok' || answer === 'skip') q.splice(i, 1); else q[i].n = (q[i].n ?? 0) + 1;
        writeQueue(q);
        if (answer !== 'ok' && answer !== 'skip') { warn(answer); break; }
      }
    } finally { draining = false; }
  }
  const dequeue = id => { const q = readQueue(), i = q.findIndex(x => x.r?.id === id); if (i >= 0) { q.splice(i, 1); writeQueue(q); } };
  // Queued before sending, so a page closed before the answer arrives still has it. The parts of one run are sent one
  // at a time, in order; other records go at once, as before parts, so a record is not left waiting behind another when
  // the player leaves the page. A record made while holding (the page is being put away) is only queued; the page's show
  // posts it, in order, once the page is back. If the page never comes back, the next kit page's drain sends it.
  const chains = new Map(); let holding = false, held = [];
  function deliver(r, again = false) {
    if (!again && on()) enqueue(r);
    // A later part of a run whose earlier part is held waits with it, so parts still arrive in order.
    if (holding || (!again && held.some(h => h.kind === r.kind && h.runId === r.runId))) { held.push(r); return Promise.resolve(); }
    if (again && !readQueue().some(x => x.r?.id === r.id)) return Promise.resolve(); // a drain sent it meanwhile, or it was dropped
    inFlight.add(r.id);
    const key = `${r.kind}:${r.runId}`;
    const next = (chains.get(key) ?? Promise.resolve()).then(async () => {
      let answer;
      // A send that hangs gives way after 30 s, so the parts behind it still go (the record stays in the queue).
      let timer;
      const late = new Promise(done => { timer = setTimeout(() => done('timeout'), 30000); timer?.unref?.(); });
      try { answer = await Promise.race([post(r), late]); } catch { answer = 'network'; } finally { clearTimeout(timer); inFlight.delete(r.id); }
      if (answer === 'ok' || answer === 'skip') dequeue(r.id);
      if (answer === 'ok') { clearWarn(); drain().catch(() => {}); return; }
      if (answer !== 'skip') warn(answer);
    }).catch(() => {});
    chains.set(key, next);
    next.then(() => { if (chains.get(key) === next) chains.delete(key); });
    return next;
  }
  // A browser privacy signal stops recording on this page until the player ticks its switch; say so rather than
  // record nothing silently. Not shown when the player switched recording off.
  const signalOnly = () => { try {
    if (noticed && signal() && !override() && get('localStorage', OFF) !== '1' && get('localStorage', eventsOff) !== '1') warn('privacy-signal (tick the switch to record)');
  } catch {} };

  // One small line at the bottom of the page while the lab is not storing this page's play.
  let line = null;
  function warn(code) { try {
    if (!line) {
      line = document.createElement('div'); line.className = 'lab-warning'; line.setAttribute('role', 'status');
      Object.assign(line.style, { position: 'fixed', left: '6px', bottom: '6px', zIndex: '2147483647', font: '11px/1.3 system-ui, sans-serif', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,.55)', color: '#fff', opacity: '.75', pointerEvents: 'none', maxWidth: '70vw' });
      document.body.append(line);
    }
    line.textContent = `Lab not recording: ${code}`;
  } catch {} }
  function clearWarn() { try { line?.remove(); line = null; } catch {} }
  function record(kind, runId, data) {
    const id = player(); if (!id) return;
    const { sid } = session();
    const r = { v: 2, id: hex(), player: id, session: sid, runId, game, kind, at: Date.now(), build, data };
    if (agent) r.runSource = 'agent';
    if (signal() && override()) r.privacyOverride = true;
    deliver(r);
  }
  const size = v => { try { return JSON.stringify(v).length + 1; } catch { return 64; } };
  // One part of the open run: the trace since the last part, and the game events once the run has gone past MAX_EVENTS or
  // MAX_BYTES. Only the last part names the run's start, so a reader that takes each record with a start as a whole run
  // still finds one per run. Times in the trace are ms from the run's start (negative for input made before it).
  function part(final) {
    if (!run || !on()) return;
    if (!final && run.part >= MAX_PARTS - 1) { run.capped = true; run.dropped.trace += run.trace.length; run.trace = []; run.traceBytes = 0; return; }
    const ended = Date.now(), at = run.started;
    let trace = run.trace.map(x => [x[0] - at, ...x.slice(1)]);
    let data = { format: 'kit-lab/1', part: run.part, started: at, ended, outcome: final ? run.outcome : null, summary: final ? run.summary : null,
      start: final ? run.info : null, events: final || run.spill ? run.events : [], trace, env: env() };
    if (final) { data.final = true; data.parts = run.part + 1; }
    if (run.capped || run.dropped.events || run.dropped.trace) data.truncated = true;
    if (run.dropped.events || run.dropped.trace) data.dropped = { ...run.dropped };
    try {
      if (size(data) > FINAL_BYTES) { data = { ...data, trace: [], truncated: true }; }
      if (size(data) > FINAL_BYTES) { data = { ...data, events: [], truncated: true }; }
    } catch { return; }
    record('run', run.id, data);
    run.part++; run.trace = []; run.traceBytes = 0;
    if (final || run.spill) { run.events = []; run.eventBytes = 0; }
    if (final) {
      const t = Math.max(0, ended - at), e = [['start', 0], ['ms', 0, 'run started']];
      if (run.outcome !== 'left') e.push(['ms', t, 'ending reached']);
      e.push(['end', t]);
      record('events', run.id, { vp: viewport(), started: at, e });
    }
  }
  const open = () => run && run.outcome === null;
  // Adds to the open run, or to the bounded buffer of input made outside a run. A full part is sent at once.
  function add(item, isEvent) {
    if (open()) {
      if (isEvent) {
        if (run.eventCount >= MAX_GAME_EVENTS) { run.dropped.events++; return; }
        run.eventCount++; run.events.push(item); run.eventBytes += size(item);
        if (run.eventCount > MAX_EVENTS || run.eventBytes > MAX_BYTES) run.spill = true;
      } else if (run.capped) { run.dropped.trace++; return; } else { run.trace.push(item); run.traceBytes += size(item); }
      const waiting = run.traceBytes + (run.spill ? run.eventBytes : 0);
      if (waiting > PART_BYTES && !run.capped) part(false);
      else if (run.capped && run.spill && run.eventBytes > PART_BYTES * 4) { run.dropped.events += run.events.length; run.events = []; run.eventBytes = 0; }
      return;
    }
    if (isEvent) return;
    pre.push(item); if (pre.length > PRE_ITEMS) { pre.shift(); preDropped++; }
  }
  let pre = [], preDropped = 0;
  const forget = () => { pre = []; preDropped = 0; if (run) { run.events = []; run.trace = []; run.eventBytes = 0; run.traceBytes = 0; } };

  // The trace. Listeners go on when the notice is on the page; nothing is kept while recording is off.
  const X = v => Math.round(Math.min(1, Math.max(0, v / Math.max(1, innerWidth))) * 1000);
  const Y = v => Math.round(Math.min(1, Math.max(0, v / Math.max(1, innerHeight))) * 1000);
  const NOT_TEXT = /^(button|checkbox|radio|range|submit|reset|color|file|image|hidden)$/;
  const isField = el => { try {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const tag = String(el.tagName).toUpperCase();
    return tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !NOT_TEXT.test(String(el.type || 'text').toLowerCase()));
  } catch { return true; } };
  const BUTTON = 'button,[role=button],a[href],summary,label,input[type=button],input[type=submit],input[type=checkbox],input[type=radio],[role=tab],[role=menuitem],[role=switch],[role=checkbox]';
  const near = (el, sel) => { try { return el && el.closest ? el.closest(sel) : null; } catch { return null; } };
  const kindOf = el => near(el, BUTTON) ? 'b' : isField(el) ? 'f' : String(el?.tagName ?? '').toUpperCase() === 'CANVAS' ? 'c' : '';
  // A button's words: its aria-label, else its text, never a field's value; any text a player typed in a field on this
  // page is cut out of it.
  const label = el => { try {
    let s = (el.getAttribute?.('aria-label') || el.textContent || el.getAttribute?.('title') || '').replace(/\s+/g, ' ').trim();
    for (const f of document.querySelectorAll?.('input,textarea,[contenteditable]') ?? []) {
      if (!isField(f)) continue;
      const v = String(f.isContentEditable ? f.textContent : f.value ?? '').trim();
      if (v.length >= 2) s = s.split(v).join('…');
    }
    return s.slice(0, 40);
  } catch { return ''; } };
  // Error text without addresses: origin, query and fragment are cut, the path stays.
  const scrub = (v, n) => String(v ?? '').replace(/(?:blob:)?(?:https?|wss?|file):\/\/[^/\s)'"]*/g, '').replace(/[?#][^\s:)'"]*/g, '').slice(0, n);
  const env = () => { try {
    const w = innerWidth, h = innerHeight, coarse = !!globalThis.matchMedia?.('(pointer: coarse)').matches, short = Math.min(w, h);
    return { device: coarse ? (short < 600 ? 'phone' : 'tablet') : 'desktop', vp: viewport(), w, h, dpr: Math.round((globalThis.devicePixelRatio || 1) * 4) / 4, touch: (navigator.maxTouchPoints ?? 0) > 0, coarse };
  } catch { return null; } };
  let tracing = false, looping = false, frames = () => {}, errors = 0;
  const lastMove = new Map();
  function trace() { try {
    if (tracing) return; tracing = true;
    const opt = { capture: true, passive: true };
    // Every listener is wrapped: nothing here may throw into the page.
    const addEventListener = (type, f, o) => globalThis.addEventListener(type, e => { try { f(e); } catch {} }, o);
    const live = () => { try { return on(); } catch { return false; } };
    const put = (...item) => { if (live()) add([Date.now(), ...item]); };
    const pid = e => e.isPrimary === false ? [e.pointerId] : [];
    const pt = e => ({ mouse: 'm', touch: 't', pen: 'p' })[e.pointerType] ?? '';
    addEventListener('pointerdown', e => { lastMove.set(e.pointerId, Date.now()); put('d', X(e.clientX), Y(e.clientY), pt(e), kindOf(e.target), ...pid(e)); }, opt);
    addEventListener('pointermove', e => {
      const now = Date.now(), held = lastMove.has(e.pointerId), was = held ? lastMove.get(e.pointerId) : hover;
      if (now - was < (held ? 50 : 200)) return;
      if (held) lastMove.set(e.pointerId, now); else hover = now;
      put('m', X(e.clientX), Y(e.clientY), ...(held ? [] : ['h']), ...pid(e));
    }, opt);
    const up = type => e => { lastMove.delete(e.pointerId); put(type, X(e.clientX), Y(e.clientY), ...pid(e)); };
    addEventListener('pointerup', up('u'), opt); addEventListener('pointercancel', up('x'), opt);
    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (isField(e.target) || isField(document.activeElement)) return put('kf');
      const mods = (e.ctrlKey ? 'c' : '') + (e.altKey ? 'a' : '') + (e.metaKey ? 'm' : '') + (e.shiftKey ? 's' : '');
      put('k', String(e.code || 'key').slice(0, 24), ...(mods ? [mods] : []));
    }, opt);
    addEventListener('keyup', e => { if (!isField(e.target) && !isField(document.activeElement)) put('K', String(e.code || 'key').slice(0, 24)); }, opt);
    addEventListener('click', e => { const b = near(e.target, BUTTON); if (b) put('b', label(b), ...(b.id ? [String(b.id).slice(0, 40)] : [])); }, opt);
    let sized = 0;
    addEventListener('resize', () => { const now = Date.now(); if (now - sized < 500) return; sized = now; put('resize', innerWidth, innerHeight); }, opt);
    addEventListener('blur', e => { if (e.target === globalThis || e.target === undefined) put('blur'); }, opt);
    addEventListener('focus', e => { if (e.target === globalThis || e.target === undefined) put('focus'); }, opt);
    const oops = (where, message, stack) => { if (errors++ >= 30) return; put('err', where, scrub(message, 160), scrub(String(stack ?? '').split('\n').slice(0, 4).map(l => l.trim()).join(' | '), 400)); };
    addEventListener('error', e => { if (e && e.message !== undefined) oops('error', e.message, e.error?.stack ?? `${scrub(e.filename, 80)}:${e.lineno}`); }, opt);
    addEventListener('unhandledrejection', e => { const r = e?.reason; oops('rejection', r?.message ?? r, r?.stack); }, opt);
    document.addEventListener?.('visibilitychange', () => { try {
      const hidden = document.visibilityState === 'hidden';
      put(hidden ? 'hide' : 'show');
      // A run still open when the page is put away keeps what it has so far as a part in the queue. It is posted when the
      // page is shown again, or by the next kit page: a post made as the page goes away is cancelled when it unloads.
      if (hidden && open() && (run.trace.length || (run.spill && run.events.length))) { holding = true; try { part(false); } finally { holding = false; } }
      if (!hidden) { const back = held; held = []; back.forEach(r => deliver(r, true)); }
    } catch {} });
    // Frame times while a run is open and the page is visible: every 10 s, the median, the 95th percentile and the worst.
    // The frame loop runs only while a run is open (frames() starts it from start()), so a menu gets no extra frames.
    frames = () => { try {
      if (looping || typeof requestAnimationFrame !== 'function') return; looping = true;
      let times = [], last = 0, from = 0;
      const tick = now => { try {
        if (!open()) { looping = false; return; }
        if (document.visibilityState !== 'hidden' && live()) {
          if (last && now - last < 5000) times.push(now - last);
          last = now; if (!from) from = now;
          if (now - from >= 10000) {
            if (times.length >= 10) { const f = times.sort((a, b) => a - b), q = p => Math.round(f[Math.min(f.length - 1, Math.floor(p * f.length))] * 10) / 10; put('fps', q(0.5), q(0.95), Math.round(f.at(-1) * 10) / 10, f.length); }
            times = []; from = now;
          }
        } else { last = 0; from = 0; times = []; }
        requestAnimationFrame(tick);
      } catch { looping = false; } };
      requestAnimationFrame(tick);
    } catch {} };
    if (open()) frames();
  } catch {} }
  let hover = 0;
  const clean = v => { try { const s = JSON.stringify(v ?? null); return s.length <= 4096 ? JSON.parse(s) : { tooLarge: true }; } catch { return null; } };

  self.notice = parent => { try {
    const p = document.createElement('p'); p.className = 'lab-notice'; Object.assign(p.style, { fontSize: '12px', lineHeight: '1.3', margin: '.5em 0 0', opacity: '.8', pointerEvents: 'auto' });
    const a = document.createElement('a'); a.href = PRIVACY; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Privacy'; a.style.color = 'inherit';
    a.textContent = say('privacy'); p.append(say('notice') + ' ', a); parent.append(p); noticed = p.isConnected; made.notices.push(p); watch(); if (noticed) trace(); signalOnly(); drain().catch(() => {}); return p;
  } catch { return null; } };
  self.toggle = parent => { try {
    const label = document.createElement('label'), input = document.createElement('input');
    label.className = 'lab-toggle'; input.type = 'checkbox';
    // A card may switch off taps on everything but its buttons; the switch must still take a finger.
    Object.assign(label.style, { pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: '.5em', minHeight: '44px', cursor: 'pointer' });
    Object.assign(input.style, { width: '22px', height: '22px', margin: '0' });
    const sync = () => { input.checked = get('localStorage', OFF) !== '1' && get('localStorage', eventsOff) !== '1' && (!signal() || override()); };
    input.addEventListener('change', () => {
      if (input.checked) { set('localStorage', OFF, null); set('localStorage', eventsOff, null); if (signal()) set('localStorage', overrideKey, '1'); clearWarn(); drain().catch(() => {}); }
      else { set('localStorage', OFF, '1'); set('localStorage', PLAYER, null); set('localStorage', overrideKey, null); set('localStorage', QUEUE, null); forget(); clearWarn(); }
      sync();
    });
    addEventListener('storage', sync); sync(); // another tab or game may change the switch
    label.append(input, ' ' + say('toggle')); parent.append(label); made.toggles.push(label); watch(); return label;
  } catch { return null; } };
  // Puts the kit's words in the page's language again (after the page switched language). Called by itself when the
  // page's <html lang> changes, which kit/i18n.js does on setLang. A page that rewrote the notice with its own words
  // (Vine, Borrowed) keeps them: only text still equal to one of the kit's own is replaced.
  const kit = key => Object.values(WORDS).map(w => w[key]);
  self.retext = () => { try {
    for (const p of made.notices) {
      if (p.firstChild?.nodeType === 3 && kit('notice').includes(p.firstChild.data.trim())) p.firstChild.data = say('notice') + ' ';
      const a = p.querySelector('a'); if (a && kit('privacy').includes(a.textContent)) a.textContent = say('privacy');
    }
    for (const l of made.toggles) { const n = l.lastChild; if (n?.nodeType === 3 && kit('toggle').includes(n.data.trim())) n.data = ' ' + say('toggle'); }
  } catch {} };
  let watching = false;
  function watch() { try {
    if (watching || typeof options.lang !== 'function' || typeof MutationObserver !== 'function') return; watching = true;
    new MutationObserver(() => self.retext()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch {} }
  self.start = (info) => { try {
    if (open()) { run.outcome = 'left'; part(true); }
    run = { id: hex(), started: Date.now(), info: clean(info), events: [], trace: pre, eventBytes: 0, traceBytes: size(pre), spill: false, part: 0, eventCount: 0, outcome: null, summary: null, capped: false, dropped: { events: 0, trace: preDropped } };
    pre = []; preDropped = 0;
    if (run.traceBytes > PART_BYTES) part(false);
    frames();
  } catch {} };
  self.event = (type, data) => { try {
    if (!noticed) return;
    if (open()) { if (on()) add({ t: Date.now() - run.started, type: String(type).slice(0, 40), ...(data === undefined ? {} : { data: clean(data) }) }, true); return; }
    // Between runs (a shop, a skin): sent at once as its own small record, so a reload cannot lose it.
    const e = { t: 0, type: String(type).slice(0, 40), ...(data === undefined ? {} : { data: clean(data) }) };
    if (on() && between++ < 100) record('run', hex(), { format: 'kit-lab/1', started: Date.now(), ended: Date.now(), outcome: 'between-runs', summary: null, start: null, events: [e] });
  } catch {} };
  self.end = (outcome, summary) => { try {
    if (!open()) return;
    run.outcome = String(outcome ?? 'end').slice(0, 40); run.summary = clean(summary); part(true);
  } catch {} };
  Object.defineProperty(self, 'on', { get: on });
  return self;
}
