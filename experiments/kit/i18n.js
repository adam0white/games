// Words in the player's language. A game keeps one table per language and asks for a string by key.
//   import { words } from '/kit/i18n.js';
//   const { t, lang, apply, setLang, langs } = words({
//     en: { play: 'Play', left: '{n} left' },
//     tr: { play: 'Oyna', left: '{n} kaldı' },
//   });
//   button.textContent = t('play');  hud.textContent = t('left', { n: 3 });
//   apply();                          // fills every element that has data-i18n="key" (text), data-i18n-aria="key"
//                                     // (aria-label) or data-i18n-title="key" (title); call again after setLang
// Which language: ?lang=tr on the address (remembered), else the one the player chose with setLang, else the first of the
// browser's languages that the game has a table for, else English. `en` is the fallback for a key a table lacks, and the
// key itself is returned when English lacks it too, so a missing string is visible and never throws.
//   lang()         the language in use, e.g. 'tr'
//   setLang('tr')  switch and remember; returns the language now in use. The game redraws its own text afterwards.
//   langs          the languages the game has tables for, English first
//   t.plural(n, one, other)  picks a key by count for languages that need it (English: 1 is `one`)
// The choice is one key for every game, 'kit:lang', so a player who picks Turkish in one game has it in all of them.
import { read, write } from './save.js';

const KEY = 'kit:lang';
const short = code => String(code || '').toLowerCase().split('-')[0];

export function words(tables) {
  const langs = ['en', ...Object.keys(tables).filter(l => l !== 'en')];
  const has = l => Object.prototype.hasOwnProperty.call(tables, l);
  let current = 'en';
  const pick = () => {
    let asked = null;
    try { asked = short(new URLSearchParams(location.search).get('lang')); } catch { /* no address outside a page */ }
    if (asked && has(asked)) { write(KEY, asked); return asked; }
    const saved = short(read(KEY));
    if (saved && has(saved)) return saved;
    const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
    return prefs.map(short).find(has) ?? 'en';
  };
  current = pick();
  const setDoc = () => { if (typeof document !== 'undefined') document.documentElement.lang = current; };
  setDoc();

  function t(key, vars) {
    const s = tables[current]?.[key] ?? tables.en?.[key] ?? key;
    return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
  }
  t.plural = (n, one, other) => t(current === 'en' && n === 1 ? one : other, { n });

  function apply(root = document) {
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
    for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  }
  function setLang(l) {
    l = short(l);
    if (has(l)) { current = l; write(KEY, l); setDoc(); }
    return current;
  }
  return { t, lang: () => current, setLang, apply, langs };
}
