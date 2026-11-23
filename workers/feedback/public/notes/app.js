// The private notes page. The key arrives once in the URL fragment, which browsers never send to a
// server; it is kept in localStorage and sent only as a request header.
(() => {
  const KEY = 'notes.k';
  // Games offered for a new note. Older notes about a dropped game still show under their own name.
  const GAMES = [['lantern', 'Lantern'], ['ant-promotion', 'Ant Promotion'], ['grapevine', 'Grapevine'], ['fixit', 'Fix-It Stall'], ['ducklings', 'Follow Me']];
  const NAMES = { 'long-road': 'The Long Road', 'copper-afternoon': 'Copper Afternoon' };
  const MAX_SECONDS = 180;
  const STRINGS = {
    tr: {
      title: 'Oyun notları', lead: 'Aklına geleni yaz ya da sesli söyle. Cevaplar burada görünür.',
      game: 'Hangi oyun?', general: 'Genel / başka bir şey', placeholder: 'Notunu buraya yaz…',
      send: 'Gönder', mic: '🎤 Sesli not', stop: 'Bitir ve gönder', cancel: 'Vazgeç',
      earlier: 'Önceki mesajlar', empty: 'Henüz not yok. İlk notunu gönder!', sending: 'Gönderiliyor…', working: 'Ses yazıya çevriliyor…',
      voice: 'Sesli not', failedVoice: 'Sesli not alındı, ama yazıya çevrilemedi. Kaydın bizde, tekrar deneyeceğiz.',
      failedText: 'Not alındı.', retry: 'Tekrar dene', notSent: 'Gönderilemedi. İnternetini kontrol et.',
      noKey: 'Bu sayfa özel bir bağlantıyla açılır. Sana gönderilen bağlantıyı kullan.',
      badKey: 'Bağlantı geçerli değil. Yeni bir bağlantı iste.', limit: 'Bugünlük not sınırına ulaşıldı. Yarın tekrar dene.',
      noMic: 'Mikrofon açılamadı. Tarayıcıya mikrofon izni ver ya da yazarak gönder.', original: 'İngilizce aslı', heard: 'Anladığımız',
      question: 'Sana bir sorumuz var', open: 'Oyunu aç ▶', answer: 'Yazarak ya da sesle cevapla', answering: 'Cevaplanan soru', answered: 'Cevaplandı ✓', to: 'Soruya cevap',
    },
    en: {
      title: 'Game notes', lead: 'Type or say whatever comes to mind. Replies show up here.',
      game: 'Which game?', general: 'General / something else', placeholder: 'Write your note here…',
      send: 'Send', mic: '🎤 Voice note', stop: 'Stop and send', cancel: 'Cancel',
      earlier: 'Earlier messages', empty: 'No notes yet. Send the first one!', sending: 'Sending…', working: 'Turning speech into text…',
      voice: 'Voice note', failedVoice: 'Voice note received, but we could not turn it into text. We kept the recording and will retry.',
      failedText: 'Note received.', retry: 'Try again', notSent: 'Could not send. Check your connection.',
      noKey: 'This page opens with a private link. Use the link that was sent to you.',
      badKey: 'This link is not valid. Ask for a new one.', limit: 'Daily note limit reached. Try again tomorrow.',
      noMic: 'Could not open the microphone. Allow microphone access, or type instead.', original: 'Original', heard: 'What we heard',
      question: 'A question for you', open: 'Open the game ▶', answer: 'Answer by typing or voice', answering: 'Answering', answered: 'Answered ✓', to: 'Answer to',
    },
  };
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

  const fragment = /^#k=([A-Za-z0-9_-]{20,200})$/.exec(location.hash);
  if (fragment) {
    store.set(KEY, fragment[1]);
    history.replaceState(null, '', location.pathname + location.search);
  }
  const key = fragment ? fragment[1] : store.get(KEY);
  let lang = store.get('notes.lang') || ((navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'tr');
  let t = STRINGS[lang];
  let lastId = 0;
  let loaded = false;
  let recorder = null;
  let ticker = null;
  const builds = new Map();
  if (params.get('game') && params.get('build')) builds.set(params.get('game'), params.get('build'));
  const drafts = new Map();
  // Notes still being transcribed; each poll asks for them again until they settle.
  const waiting = new Set();
  const known = new Map();
  let replyTo = null;
  const excerpt = text => (text.length > 70 ? `${text.slice(0, 68)}…` : text);

  function applyLanguage() {
    t = STRINGS[lang] || STRINGS.tr;
    document.documentElement.lang = lang;
    document.title = t.title;
    $('title').textContent = t.title;
    $('lead').textContent = t.lead;
    $('game-label').textContent = t.game;
    $('text').placeholder = t.placeholder;
    $('send').textContent = t.send;
    $('mic').textContent = t.mic;
    $('stop').textContent = t.stop;
    $('cancel').textContent = t.cancel;
    const select = $('game');
    const chosen = select.value || params.get('game') || '';
    select.replaceChildren();
    const list = [...GAMES];
    if (/^[a-z0-9-]{1,40}$/.test(chosen) && !list.some(([slug]) => slug === chosen)) list.push([chosen, chosen]);
    for (const [slug, name] of [...list, ['', t.general]]) select.append(new Option(name, slug, false, slug === chosen));
    const empty = document.querySelector('.empty');
    if (empty) empty.textContent = t.empty;
  }

  function notice(text) {
    $('notice').textContent = text || '';
    $('notice').hidden = !text;
  }

  const gameName = slug => (GAMES.find(([s]) => s === slug) || [null, NAMES[slug] || slug])[1];
  const clock = ms => new Date(ms).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function bubble(message) {
    const node = document.createElement('div');
    node.className = `msg ${message.dir}${message.status === 'failed' ? ' failed' : ''}`;
    node.dataset.id = message.id;
    if (message.dir === 'in') {
      const failed = message.status === 'failed';
      if (message.kind === 'voice') {
        const label = document.createElement('small');
        label.textContent = `🎤 ${t.voice}${message.body ? ` · ${t.heard}:` : ''}`;
        node.append(label);
      }
      const asked = message.reply_to ? known.get(message.reply_to) : null;
      if (asked) {
        const label = document.createElement('small');
        label.className = 'quote';
        label.textContent = `↩ ${t.to}: ${excerpt(asked.body)}`;
        node.append(label);
      }
      node.append(message.body || (failed ? (message.kind === 'voice' ? t.failedVoice : t.failedText) : t.working));
    } else {
      if (message.ask) {
        node.classList.add('ask');
        const label = document.createElement('small');
        label.textContent = `❓ ${t.question}`;
        node.append(label);
      }
      node.append(message.body);
      if (message.image) {
        const image = document.createElement('img');
        image.alt = '';
        node.append(image);
        fetch(`/notes/api/image?id=${message.id}`, { cache: 'no-store', headers: { Authorization: `Bearer ${key}` } })
          .then(response => (response.ok ? response.blob() : null))
          .then(blob => { if (blob) image.src = URL.createObjectURL(blob); else image.remove(); }).catch(() => image.remove());
      }
      if (message.link && /^(?:\/proto)?(?:\/lab)?\/[a-z0-9-]+\//.test(message.link)) {
        const link = document.createElement('a');
        link.className = 'open';
        link.href = message.link;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = t.open;
        node.append(link);
      }
      if (message.ask && message.answered) {
        const done = document.createElement('small');
        done.textContent = t.answered;
        node.append(done);
      } else if (message.ask && !message.closed) {
        const row = document.createElement('div');
        row.className = 'choices';
        for (const choice of message.choices || []) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = choice;
          button.addEventListener('click', () => queue({ text: choice, replyTo: message.id, game: message.game || '' }));
          row.append(button);
        }
        const other = document.createElement('button');
        other.type = 'button';
        other.textContent = t.answer;
        other.addEventListener('click', () => answer(message.id));
        row.append(other);
        node.append(row);
      }
      if (message.original) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = t.original;
        details.append(summary, message.original);
        node.append(details);
      }
    }
    const meta = document.createElement('small');
    meta.textContent = [message.game ? gameName(message.game) : null, clock(message.at)].filter(Boolean).join(' · ');
    node.append(meta);
    return node;
  }

  function answer(id) {
    replyTo = id && known.has(id) ? id : null;
    const asked = replyTo ? known.get(replyTo) : null;
    $('answering').hidden = !asked;
    if (!asked) return;
    $('answering-text').textContent = `↩ ${t.answering}: ${excerpt(asked.body)}`;
    if (asked.game && [...$('game').options].some(option => option.value === asked.game)) $('game').value = asked.game;
    $('text').focus();
  }

  function markAnswered(id) {
    const asked = known.get(id);
    if (!asked || asked.answered) return;
    asked.answered = true;
    $('thread').querySelector(`[data-id="${id}"]`)?.replaceWith(bubble(asked));
  }

  const open = message => message.dir === 'out' && message.ask && !message.answered && !message.closed;

  // On the first load, everything already dealt with goes into a closed section, so open
  // questions and whatever arrived since the last note sit first without scrolling.
  function fold(messages) {
    for (const message of messages) if (message.reply_to) { const asked = messages.find(m => m.id === message.reply_to); if (asked) asked.answered = true; }
    const lastNote = Math.max(0, ...messages.filter(m => m.dir === 'in').map(m => m.id));
    const keep = m => open(m) || (m.dir === 'out' && m.id > lastNote) || (m.dir === 'in' && m.status !== 'ready');
    const old = messages.some(keep) ? messages.filter(m => !keep(m)) : messages.slice(0, -3);
    if (!old.length) return;
    const details = document.createElement('details');
    details.id = 'history';
    const summary = document.createElement('summary');
    summary.textContent = `${t.earlier} (${old.length})`;
    const list = document.createElement('div');
    for (const message of old) { known.set(message.id, message); list.append(bubble(message)); }
    details.append(summary, list);
    $('thread').append(details);
  }

  function show(messages) {
    const thread = $('thread');
    const nearEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
    const first = !loaded;
    if (first) { loaded = true; fold(messages); }
    for (const message of messages) {
      known.set(message.id, message);
      if (message.reply_to) markAnswered(message.reply_to);
      const old = thread.querySelector(`[data-id="${message.id}"]`);
      if (old) { if (!first) old.replaceWith(bubble(message)); } else thread.append(bubble(message));
      lastId = Math.max(lastId, message.id);
      if (message.status === 'pending') waiting.add(message.id); else waiting.delete(message.id);
    }
    const empty = thread.querySelector('.empty');
    if (thread.querySelector('.msg')) empty?.remove();
    else if (!empty) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = t.empty; thread.append(p); }
    const question = first ? thread.querySelector(':scope > .ask .choices')?.closest('.msg') : null;
    if (question) thread.scrollTop += question.getBoundingClientRect().top - thread.getBoundingClientRect().top - 44;
    else if (messages.length && (nearEnd || messages.some(m => m.dir === 'in'))) thread.scrollTop = thread.scrollHeight;
  }

  async function api(path, options = {}) {
    const response = await fetch(`/notes/api/${path}`, { ...options, cache: 'no-store', headers: { ...options.headers, Authorization: `Bearer ${key}` } });
    if (response.status === 401) { notice(t.badKey); $('composer').hidden = true; throw new Error('unauthorized'); }
    if (response.status === 429) { notice(t.limit); throw new Error('limit'); }
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  }

  async function refresh() {
    try {
      const data = await api(`thread?after=${waiting.size ? Math.min(...waiting) - 1 : lastId}`);
      if (data.lang && data.lang !== lang && STRINGS[data.lang]) { lang = data.lang; store.set('notes.lang', lang); applyLanguage(); }
      $('composer').hidden = false;
      show(data.messages);
    } catch { /* shown by api(), or a network blip: the next poll retries */ }
  }

  async function buildFor(game) {
    if (!game) return null;
    if (builds.has(game)) return builds.get(game);
    try {
      // The new /<slug>/ first; /proto/<slug>/ while games-static still serves the old shape.
      let response = await fetch(`/${game}/`, { cache: 'no-store' });
      if (!response.ok) response = await fetch(`/proto/${game}/`, { cache: 'no-store' });
      if (!response.ok) return null;
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()));
      const id = [...hash.slice(0, 5)].map(b => b.toString(16).padStart(2, '0')).join('');
      builds.set(game, id);
      return id;
    } catch { return null; }
  }

  function pendingBubble(id, text) {
    const node = document.createElement('div');
    node.className = 'msg in';
    node.dataset.draft = id;
    node.append(text);
    const meta = document.createElement('small');
    meta.textContent = t.sending;
    node.append(meta);
    $('thread').querySelector('.empty')?.remove();
    $('thread').append(node);
    $('thread').scrollTop = $('thread').scrollHeight;
    return node;
  }

  async function deliver(id) {
    const draft = drafts.get(id);
    const node = draft.node;
    node.classList.remove('failed');
    node.querySelector('button')?.remove();
    node.querySelector('small:last-of-type').textContent = draft.blob ? t.working : t.sending;
    try {
      const build = await buildFor(draft.game);
      let data;
      if (draft.blob) {
        const query = new URLSearchParams({ client_id: id });
        if (draft.game) query.set('game', draft.game);
        if (build) query.set('build', build);
        if (draft.replyTo) query.set('reply_to', draft.replyTo);
        data = await api(`notes?${query}`, { method: 'POST', headers: { 'Content-Type': draft.blob.type.split(';')[0] }, body: draft.blob });
      } else {
        data = await api('notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: draft.text, game: draft.game, build, client_id: id, reply_to: draft.replyTo || undefined }) });
      }
      drafts.delete(id);
      node.remove();
      notice('');
      show([data.message]);
    } catch (error) {
      node.classList.add('failed');
      node.querySelector('small:last-of-type').textContent = t.notSent;
      if (error.message === 'unauthorized' || error.message === 'limit') return;
      const again = document.createElement('button');
      again.type = 'button';
      again.textContent = t.retry;
      again.addEventListener('click', () => deliver(id));
      node.append(again);
    }
  }

  function queue(draft) {
    const id = crypto.randomUUID();
    if (draft.replyTo === undefined && replyTo) { draft.replyTo = replyTo; answer(null); }
    drafts.set(id, { ...draft, game: draft.game ?? $('game').value, node: pendingBubble(id, draft.text || `🎤 ${t.voice}`) });
    deliver(id);
  }

  function endRecording() {
    clearInterval(ticker);
    $('recording').hidden = true;
    $('actions').hidden = false;
    $('text').disabled = false;
  }

  async function startRecording() {
    notice('');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { notice(t.noMic); return; }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m));
    const chunks = [];
    let keep = true;
    try { recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined); } catch { stream.getTracks().forEach(track => track.stop()); notice(t.noMic); return; }
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach(track => track.stop());
      endRecording();
      const blob = new Blob(chunks, { type: (recorder.mimeType || type || 'audio/mp4').split(';')[0] });
      recorder = null;
      if (keep && blob.size > 200) queue({ blob });
    });
    recorder.cancel = () => { keep = false; recorder.stop(); };
    const started = Date.now();
    $('timer').textContent = '0:00';
    ticker = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      if (seconds >= MAX_SECONDS && recorder?.state === 'recording') recorder.stop();
    }, 250);
    $('actions').hidden = true;
    $('recording').hidden = false;
    $('text').disabled = true;
    recorder.start(1000);
  }

  applyLanguage();
  if (!key) { notice(t.noKey); return; }
  $('send').addEventListener('click', () => {
    const text = $('text').value.trim();
    if (!text) return;
    $('text').value = '';
    queue({ text });
  });
  $('mic').addEventListener('click', startRecording);
  $('answering-clear').addEventListener('click', () => answer(null));
  $('stop').addEventListener('click', () => recorder?.stop());
  $('cancel').addEventListener('click', () => recorder?.cancel());
  if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') $('mic').hidden = true;
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
