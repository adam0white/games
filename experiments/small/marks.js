// What the home knows: today's pick, tonight's three, each game's progress (read from the game's own save, never
// written), the results a game reports through kit/home.js, and the streak. The home's own keys all start with `hub:`;
// the names are the ones the three draft homes (/lab/hub-a/, hub-b/, hub-c/) used, so marks and a streak made there
// carry over:
//   hub:opened     { <slug>: 'YYYY-MM-DD' }                 the last day the player opened a game from the home
//   hub:c:night    { day, stops: { <slug>: { before, at } } } tonight's stops opened, the game's progress then, and when
//   hub:c:streak   { last, run, best }                      nights with all three opened
//   hub:results    written by kit/home.js when a wired game ends a run
//   hub:small:intro '1' once the first-visit explanation is dismissed
import { read, readJson, readNumber, write, writeJson } from '../kit/save.js';
import { SMALL } from './catalog.js';

// ---------- days ----------
// Seeded by the UTC date so everyone has the same pick and the same three; ?day=YYYY-MM-DD for checks.
let asked = null;
try { asked = new URLSearchParams(location.search).get('day'); } catch { /* not a page */ }
export const today = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : new Date().toISOString().slice(0, 10);
export const dayBefore = day => new Date(Date.parse(day + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function seeded(text) { // FNV-1a hash into mulberry32
  let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h |= 0; h = (h + 0x6D2B79F5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
export const pickFor = day => SMALL[Math.floor(seeded('pocket ' + day)() * SMALL.length)];
export const KINDS = ['quick', 'think', 'calm'];
// One quick game, one to think about, one calm one. The deck's pick of the day is left out, so the two do not start
// on the same game. Same seeds as the drafts, so a night begun there is the same night here.
export function threeFor(day) {
  const rand = seeded('tonight ' + day), pick = pickFor(day);
  return KINDS.map(kind => { const pool = SMALL.filter(game => game.kind === kind && game !== pick); return pool[Math.floor(rand() * pool.length)]; });
}

// ---------- progress, read-only ----------
// { score, of, finished, today }: score only grows with play, so the home compares it before and after a visit.
// A key that exists says little (some games write defaults on load), so it is never read as "played".
const J = k => readJson(k, null);
const count = a => (Array.isArray(a) ? a.filter(n => Number(n) > 0).length : 0);
const num = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.trunc(v))) : 0);
const P = {
  thankful() { const d = J('thankful:v1')?.days || {}; const n = Object.keys(d).filter(k => Array.isArray(d[k]) && d[k].length).length; const now = d[localDay()]?.length || 0; return { score: n * 3 + Math.min(3, now), today: now >= 3 }; },
  pitch() { const s = J('pitch:v1') || {}; return { score: num(s.played, 1e6) + Object.keys(s.daily || {}).length }; },
  'night-channels'() { const s = J('night-channels:save') || {}; const n = s.completed === true ? 10 : num(s.unlocked, 10) - 1; return { score: Math.max(0, n), of: 10, finished: s.completed === true }; },
  ring() { const s = J('ring:v1') || {}; return { score: num(s.nights, 1e6), finished: num(s.dawns, 1e6) > 0 }; },
  'night-sand'() { const n = num(J('night-sand:save')?.completed, 10); return { score: n, of: 10, finished: n >= 10 }; },
  'night-bells'() { const n = count(J('night-bells:save')?.stars); return { score: n, of: 8, finished: n >= 8 }; },
  'night-podwire'() { const s = J('night-podwire:progress') || {}; const n = s.complete === true ? 6 : Math.max(0, num(s.next, 6) - 1); return { score: n, of: 6, finished: n >= 6 }; },
  'night-saltplate'() { const n = num(J('night-saltplate:save')?.cleared, 6); return { score: n, of: 6, finished: n >= 6 }; },
  // the highest plate reached, a plain number; since 2026-11-24 the last plate's clear writes night-splitlight:done
  'night-splitlight'() { const done = read('night-splitlight:done') === '1'; return { score: done ? 18 : Math.max(0, num(readNumber('night-splitlight:plate', 1), 18) - 1), of: 18, finished: done }; },
  'wild-pour'() { const n = count(J('wild-pour:save')?.stars); return { score: n, of: 8, finished: n >= 8 }; },
  'wild2-face-shift'() { const s = J('wild2-face-shift:save') || {}; return { score: num(s.runs, 1e6), finished: count(s.stars) >= 4 }; },
  // the next print opens when one is filed: the sixth print's filing is not visible here
  'night-rubbing'() { return { score: Math.max(0, num(J('night-rubbing:save')?.unlocked, 6) - 1), of: 6 }; },
};
export function progress(slug) { try { return { score: 0, of: null, ...P[slug]?.() }; } catch { return { score: 0, of: null }; } }
export const results = () => { const r = readJson('hub:results', {}); return r && typeof r === 'object' ? r : {}; };
export const openedOn = slug => (readJson('hub:opened', {}) || {})[slug] || null;

// A card's mark: { cls: new | opened | played | finished, key, n?, of? } (key is a word in words.js)
export function mark(slug) {
  const p = progress(slug), r = results()[slug];
  if (p.today) return { cls: 'finished', key: 'todayDone' };
  if (p.finished) return { cls: 'finished', key: 'finished' };
  if (p.score > 0 && p.of) return { cls: 'played', key: 'of', n: p.score, of: p.of };
  if (p.score > 0 || r?.runs > 0) return { cls: 'played', key: 'played' };
  if (openedOn(slug)) return { cls: 'opened', key: 'opened' };
  return { cls: 'new', key: 'new' };
}

// ---------- tonight ----------
const NIGHT = 'hub:c:night', STREAK = 'hub:c:streak';
export const night = () => { const n = readJson(NIGHT, null); return n && n.day === today && n.stops && typeof n.stops === 'object' ? n : { day: today, stops: {} }; };
export function markOpened(slug) { const o = readJson('hub:opened', {}) || {}; o[slug] = today; writeJson('hub:opened', o); }
// The player opens a stop: remember the game's progress now, once per night.
export function openStop(slug) {
  const n = night();
  if (!n.stops[slug]) n.stops[slug] = { before: progress(slug).score, at: Date.now() };
  writeJson(NIGHT, n); markOpened(slug);
}
// won: the game reported a win (kit/home.js) after the stop was opened; moved: its progress grew; opened: neither.
export function status(slug) {
  const s = night().stops[slug]; if (!s) return null;
  const r = results()[slug];
  if (r && Number(r.wonAt) >= (Number(s.at) || 0) && Number(r.wonAt) > 0 && s.at) return 'won';
  if (progress(slug).score > (Number(s.before) || 0)) return 'moved';
  return 'opened';
}
export const SIGN = { won: '★', moved: '✦', opened: '○' };
export const signs = set => set.map(game => SIGN[status(game.slug)] ?? '·').join('');
// Counts a night once, when all three are opened. Returns the streak as the player should see it today, and
// whether this call is the one that completed the night.
export function streak(set) {
  const s = readJson(STREAK, null) || { last: null, run: 0, best: 0 };
  let completed = false;
  if (set.every(game => status(game.slug)) && s.last !== today) {
    s.run = s.last === dayBefore(today) ? (Number(s.run) || 0) + 1 : 1; s.best = Math.max(Number(s.best) || 0, s.run); s.last = today;
    writeJson(STREAK, s); completed = true;
  }
  const alive = s.last === today || s.last === dayBefore(today);
  return { run: alive ? Number(s.run) || 0 : 0, best: Number(s.best) || 0, last: s.last, completed };
}
export const introSeen = () => read('hub:small:intro') === '1';
export const seeIntro = () => write('hub:small:intro', '1');
