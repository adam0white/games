// The way back to the small games' home (/small/), and a finished run reported to it. One line in a game:
//   const rec = home(lab('night-bells'), { back: ['#menu .card', '#end .card'] });
// in place of `const rec = lab('night-bells')`. Everything else in the game stays as it is: `rec` is the same
// recorder, and its end(outcome, summary) also tells the home how the run ended.
//
// - back: cards (selectors or elements) that get a "‹ Small games" link when the page was opened from the home
//   (?from=small on the address, remembered for this tab so a reload or a level change keeps it). Opened any
//   other way, nothing is added.
// - Every run that ends is written to the home's own key `hub:results`: { <slug>: { runs, wins, last, at, wonAt } }.
//   A run counts as a win when its outcome is 'won' (the word the lab pages use). The home shows a win on tonight's
//   three only when it came after the player opened that stop.
// - slug: the folder name, taken from the address (/lab/night-bells/ → night-bells); pass { slug } to override.
// - lang: optional, the page's own language (`lang` from kit/i18n.js words()). The link then follows it and changes
//   when the page switches language. Without it the link uses ?lang=, then the player's saved choice, then the browser,
//   so an English-only page passes { lang: () => 'en' }.
// Never throws; a page without storage still plays. The game's own keys are never read or written.
const HOME = '/small/', FROM = 'small', RESULTS = 'hub:results', TAB = 'kit-home:from';
const WORDS = { en: 'Small games', tr: 'Küçük oyunlar' };
const WINS = new Set(['won', 'win']);

let pageLang = null;
function lang() {
  try { if (pageLang) return String(pageLang() || '').slice(0, 2).toLowerCase() === 'tr' ? 'tr' : 'en'; } catch {}
  try { const q = new URLSearchParams(location.search).get('lang'); if (q) return q.slice(0, 2).toLowerCase() === 'tr' ? 'tr' : 'en'; } catch {}
  try { const s = localStorage.getItem('kit:lang'); if (s) return s === 'tr' ? 'tr' : 'en'; } catch {}
  try { return (navigator.languages?.[0] || navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en'; } catch { return 'en'; }
}
// True when this page was opened from the home, now or earlier in this tab.
export function fromHome() {
  try {
    if (new URLSearchParams(location.search).get('from') === FROM) { sessionStorage.setItem(TAB, location.pathname); return true; }
    return sessionStorage.getItem(TAB) === location.pathname;
  } catch { return false; }
}
const slugHere = () => { try { return location.pathname.split('/').filter(Boolean).pop() || ''; } catch { return ''; } };

// The link itself, only on a page opened from the home. Going back keeps the home's scroll and its swipe deck where the player left them.
export function backLink(where) {
  try {
    const parent = typeof where === 'string' ? document.querySelector(where) : where;
    if (!fromHome() || !parent || parent.querySelector(':scope > .kit-home')) return null;
    const a = document.createElement('a');
    a.className = 'kit-home'; a.href = HOME + (lang() === 'tr' ? '?lang=tr' : ''); a.textContent = `‹ ${WORDS[lang()]}`;
    Object.assign(a.style, { display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 .4em', color: 'inherit', opacity: '.85', fontSize: '15px', pointerEvents: 'auto', textUnderlineOffset: '3px' });
    a.addEventListener('click', e => {
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.origin === location.origin && ref.pathname === HOME && history.length > 1) { e.preventDefault(); history.back(); }
      } catch {}
    });
    parent.append(a); return a;
  } catch { return null; }
}

// Write one finished run to the home's key. Usable without a recorder: homeResult('night-bells', 'won').
export function homeResult(slug, outcome) {
  try {
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return false;
    const all = JSON.parse(localStorage.getItem(RESULTS) || '{}') || {};
    const was = all[slug] && typeof all[slug] === 'object' ? all[slug] : {};
    const now = Date.now(), won = WINS.has(String(outcome));
    all[slug] = { runs: (Number(was.runs) || 0) + 1, wins: (Number(was.wins) || 0) + (won ? 1 : 0), last: String(outcome ?? 'end').slice(0, 40), at: now, wonAt: won ? now : Number(was.wonAt) || 0 };
    localStorage.setItem(RESULTS, JSON.stringify(all)); return true;
  } catch { return false; }
}

// Every link on the page in the language in use now.
function relabel() { try { for (const a of document.querySelectorAll('a.kit-home')) { a.textContent = `‹ ${WORDS[lang()]}`; a.href = HOME + (lang() === 'tr' ? '?lang=tr' : ''); } } catch {} }

export function home(rec, { back = [], slug = slugHere(), lang: given = null } = {}) {
  if (typeof given === 'function') {
    pageLang = given;
    try { new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch {}
  }
  if (fromHome()) for (const where of back) backLink(where);
  const base = rec && typeof rec === 'object' ? rec : { notice() {}, toggle() {}, retext() {}, start() {}, event() {}, end() {}, on: false, sent: 0 };
  const self = Object.create(base);
  self.end = (outcome, summary) => { homeResult(slug, outcome); return base.end(outcome, summary); };
  return self;
}
