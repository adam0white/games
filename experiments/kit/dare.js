// A dare by link: "I scored 412 on this river. Beat it." No account and no server: the link itself carries the seed of
// the level, the score to beat, the sender's name and one small number the game may use (which things were in the
// level, so both players meet the same ones). The friend opens the link, plays the same level, and can send their own
// score back the same way.
//
//   import { dareLink, dareRead, shareLink } from '../kit/dare.js';
//   const dare = dareRead();                         null, or { seed, score, extra, name } from ?dare= on this page
//   const url = dareLink({ seed, score, extra, name }); a link to this page that carries them
//   await shareLink(url, 'I scored 412. Beat it.')   the phone's share sheet, else the clipboard: 'shared' | 'copied' | 'shown'
//
// The link is seed.score.extra.name, with the seed in base 36: ?dare=k2j9x.412.5.Sam. Everything read from a link is
// checked: whole numbers in range and a name of at most 16 letters, numbers, spaces, _ . -; anything else gives null.
// A score in a link is only what the sender says it is. Use it for play between friends, never for a shared board.
export { shareLink } from './room.js';

const TOP_SEED = 2 ** 31, TOP_SCORE = 1e9;
export const dareName = v => String(v ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16).trim();
const whole = (v, top) => Number.isInteger(v) && v >= 0 && v < top;

export function dareLink({ seed, score, extra = 0, name = '' }, where = globalThis.location) {
  if (!whole(seed, TOP_SEED) || !whole(score, TOP_SCORE) || !whole(extra, TOP_SEED)) return '';
  const u = new URL(where.href); u.search = ''; u.hash = '';
  u.searchParams.set('dare', [seed.toString(36), score, extra, dareName(name)].join('.'));
  return u.href;
}

export function dareRead(where = globalThis.location) {
  let v; try { v = new URL(where.href).searchParams.get('dare'); } catch { return null; }
  const m = /^([0-9a-z]{1,7})\.(\d{1,10})\.(\d{1,10})\.(.{0,64})$/su.exec(v ?? '');
  if (!m) return null;
  const seed = parseInt(m[1], 36), score = Number(m[2]), extra = Number(m[3]);
  if (!whole(seed, TOP_SEED) || !whole(score, TOP_SCORE) || !whole(extra, TOP_SEED)) return null;
  return { seed, score, extra, name: dareName(m[4]) };
}
