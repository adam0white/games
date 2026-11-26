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
const MAX_EVENTS = 300, MAX_BYTES = 96 * 1024;
export const QUEUE_MAX = 60, QUEUE_BYTES = 400 * 1024, QUEUE_DAYS = 30, QUEUE_TRIES = 20;

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
  const readQueue = () => { try { const q = JSON.parse(get('localStorage', QUEUE) ?? '[]'); return Array.isArray(q) ? q : []; } catch { return []; } };
  const writeQueue = q => {
    const fresh = q.filter(x => x && x.r && Date.now() - x.r.at < QUEUE_DAYS * 86400000 && (x.n ?? 0) < QUEUE_TRIES);
    while (fresh.length > QUEUE_MAX || (fresh.length && JSON.stringify(fresh).length > QUEUE_BYTES)) fresh.shift();
    set('localStorage', QUEUE, fresh.length ? JSON.stringify(fresh) : null);
  };
  const enqueue = r => { if (JSON.stringify(r).length > QUEUE_BYTES / 4) return; const q = readQueue(); if (!q.some(x => x.r?.id === r.id)) q.push({ r, n: 0 }); writeQueue(q); };
  let draining = false;
  async function drain() {
    if (draining || !on()) return; draining = true;
    try {
      for (const item of readQueue()) {
        if (!on()) break;
        const answer = await post(item.r);
        const q = readQueue(), i = q.findIndex(x => x.r?.id === item.r.id);
        if (i < 0) continue;
        if (answer === 'ok' || answer === 'skip') q.splice(i, 1); else q[i].n = (q[i].n ?? 0) + 1;
        writeQueue(q);
        if (answer !== 'ok' && answer !== 'skip') { warn(answer); break; }
      }
    } finally { draining = false; }
  }
  async function deliver(r) {
    const answer = await post(r);
    if (answer === 'ok') { clearWarn(); drain().catch(() => {}); return; }
    if (answer === 'skip') return;
    if (on()) enqueue(r);
    warn(answer);
  }

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
    deliver(r).catch(() => {});
  }
  function flush(final) {
    if (!run || !on()) return;
    const ended = Date.now(), events = run.events.slice(0, MAX_EVENTS);
    let data = { format: 'kit-lab/1', started: run.started, ended, outcome: run.outcome, summary: run.summary, start: run.info, events, ...(run.events.length > MAX_EVENTS ? { truncated: true } : {}) };
    try { if (JSON.stringify(data).length > MAX_BYTES) data = { ...data, events: [], truncated: true }; if (JSON.stringify(data).length > MAX_BYTES) data = { ...data, summary: null, start: null }; } catch { return; }
    record('run', run.id, data);
    if (final) {
      const t = Math.max(0, ended - run.started), e = [['start', 0], ['ms', 0, 'run started']];
      if (run.outcome !== 'left') e.push(['ms', t, 'ending reached']);
      e.push(['end', t]);
      record('events', run.id, { vp: viewport(), started: run.started, e });
    }
    run.sentAt = run.events.length;
  }
  const clean = v => { try { const s = JSON.stringify(v ?? null); return s.length <= 4096 ? JSON.parse(s) : { tooLarge: true }; } catch { return null; } };

  self.notice = parent => { try {
    const p = document.createElement('p'); p.className = 'lab-notice'; Object.assign(p.style, { fontSize: '12px', lineHeight: '1.3', margin: '.5em 0 0', opacity: '.8', pointerEvents: 'auto' });
    const a = document.createElement('a'); a.href = PRIVACY; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Privacy'; a.style.color = 'inherit';
    a.textContent = say('privacy'); p.append(say('notice') + ' ', a); parent.append(p); noticed = p.isConnected; made.notices.push(p); watch(); drain().catch(() => {}); return p;
  } catch { return null; } };
  self.toggle = parent => { try {
    const label = document.createElement('label'), input = document.createElement('input');
    label.className = 'lab-toggle'; input.type = 'checkbox';
    // A card may switch off taps on everything but its buttons; the switch must still take a finger.
    Object.assign(label.style, { pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: '.5em', minHeight: '44px', cursor: 'pointer' });
    Object.assign(input.style, { width: '22px', height: '22px', margin: '0' });
    const sync = () => { input.checked = get('localStorage', OFF) !== '1' && get('localStorage', eventsOff) !== '1' && (!signal() || override()); };
    input.addEventListener('change', () => {
      if (input.checked) { set('localStorage', OFF, null); set('localStorage', eventsOff, null); if (signal()) set('localStorage', overrideKey, '1'); }
      else { set('localStorage', OFF, '1'); set('localStorage', PLAYER, null); set('localStorage', overrideKey, null); set('localStorage', QUEUE, null); clearWarn(); }
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
    if (run && run.outcome === null) { run.outcome = 'left'; flush(true); }
    run = { id: hex(), started: Date.now(), info: clean(info), events: [], outcome: null, summary: null, sentAt: -1 };
  } catch {} };
  self.event = (type, data) => { try {
    if (!noticed) return;
    const open = run && run.outcome === null;
    const e = { t: open ? Date.now() - run.started : 0, type: String(type).slice(0, 40), ...(data === undefined ? {} : { data: clean(data) }) };
    if (open) { if (run.events.length < MAX_EVENTS + 1) run.events.push(e); return; }
    // Between runs (a shop, a skin): sent at once as its own small record, so a reload cannot lose it.
    if (on() && between++ < 100) record('run', hex(), { format: 'kit-lab/1', started: Date.now(), ended: Date.now(), outcome: 'between-runs', summary: null, start: null, events: [e] });
  } catch {} };
  self.end = (outcome, summary) => { try {
    if (!run || run.outcome !== null) return;
    run.outcome = String(outcome ?? 'end').slice(0, 40); run.summary = clean(summary); flush(true);
  } catch {} };
  // A run still open when the page is put away sends what it has so far; it is sent again when it ends.
  try { addEventListener('visibilitychange', () => { try { if (document.visibilityState === 'hidden' && run && run.outcome === null && run.events.length !== run.sentAt) flush(false); } catch {} }); } catch {}
  Object.defineProperty(self, 'on', { get: on });
  return self;
}
