// The home for the small games: tonight's three on top, the swipe deck of every small game below.
// What it saves is in marks.js; what it shows is in catalog.js, art.js and words.js.
import { words } from '../kit/i18n.js';
import { noZoom } from '../kit/zoom.js';
import { shareLink } from '../kit/room.js';
import { lab } from '../kit/lab.js';
import { SMALL } from './catalog.js';
import { WORDS } from './words.js';
import { artOf, svgOf } from './art.js';
import { today, pickFor, threeFor, KINDS, mark, markOpened, openStop, status, SIGN, signs, streak, introSeen, seeIntro, night } from './marks.js';

const W = words(WORDS), t = W.t;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const L = o => (o && typeof o === 'object' ? o[W.lang()] ?? o.en : o);
const nameOf = game => L(game.name), lineOf = game => L(game.line);
const timeOf = game => t(game.time[0], { n: game.time[1] });
const englishOnly = game => W.lang() !== 'en' && !game.tr;
const hrefOf = game => `${game.href}?from=small`;
const dayLabel = day => new Date(day + 'T12:00:00Z').toLocaleDateString(W.lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
const LABEL = { quick: 'warm', think: 'think', calm: 'calm' };
const homeUrl = () => { const u = new URL(location.href); u.search = ''; u.hash = ''; if (W.lang() !== 'en') u.searchParams.set('lang', W.lang()); return u.href; };
function toast(key) { const el = $('toast'); el.textContent = t(key); el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1600); }

const rec = lab('small', { lang: W.lang });
const set = threeFor(today);
const pick = pickFor(today);
// The deck starts on today's pick and runs on round the catalogue.
const order = SMALL.map((_, i) => SMALL[(SMALL.indexOf(pick) + i) % SMALL.length]);

// ---------- tonight ----------
let picture = null; // the share picture for tonight, made when the result card first shows
function drawTonight() {
  $('date').textContent = dayLabel(today);
  const st = set.map(game => status(game.slug));
  const now = st.findIndex(s => !s), done = now === -1, s = streak(set);
  if (s.completed) { rec.start({ day: today }); rec.end('night-done', { signs: signs(set), run: s.run }); }
  $('run').textContent = !done && s.run > 0 ? t('run', { n: s.run }) : '';
  const fresh = !introSeen() && !Object.keys(night().stops).length && !s.best;
  $('intro').hidden = !fresh;
  $('stops').innerHTML = set.map((game, i) => {
    const cls = st[i] || (i === now ? 'now' : '');
    const state = st[i] ? ` · <em>${esc(t(st[i]))}</em>` : '';
    return `<li class="${cls}"><span class="lamp" aria-hidden="true">${st[i] ? SIGN[st[i]] : i + 1}</span>
      <a class="stop ${game.slug}" href="${hrefOf(game)}" data-slug="${game.slug}" data-where="tonight">
      <div class="pic">${artOf(game.slug)}</div>
      <div class="txt"><span class="kind">${esc(t('stop', { n: i + 1 }))} · ${esc(t(LABEL[game.kind]))}</span><b>${esc(nameOf(game))}</b>
      ${i === now ? `<span class="line">${esc(lineOf(game))}</span>` : ''}
      <small>${esc(timeOf(game))}${englishOnly(game) ? ' · ' + esc(t('english')) : ''}${state}</small>
      ${i === now ? `<span class="go">${esc(t('play'))} ›</span>` : ''}</div></a></li>`;
  }).join('');
  if (!done) { $('result').innerHTML = ''; return; }
  const won = st.filter(x => x === 'won').length, moved = st.filter(x => x !== 'opened').length;
  const how = won ? t('doneWon', { n: won }) : moved ? t('doneMoved', { n: moved }) : t('doneOpened');
  $('result').innerHTML = `<div class="result"><h2>${esc(t('done'))}</h2>
    <div class="signs">${set.map((game, i) => `<span title="${esc(nameOf(game))} · ${esc(t(st[i]))}">${artOf(game.slug)}<b>${SIGN[st[i]]}</b></span>`).join('')}</div>
    <p class="big">${esc(how)}</p>
    <p>${esc(s.run > 1 ? t('streak', { n: s.run }) : t('streak1'))}${s.best > 1 ? ` · ${esc(t('best', { n: s.best }))}` : ''}</p>
    <p class="dim">${esc(t('streakNext', { n: s.run + 1 }))}</p>
    <button type="button" id="share">${esc(t('share'))}</button></div>`;
  const text = `${t('shareText', { day: dayLabel(today), marks: signs(set) })}${s.run > 1 ? ' · ' + t('streak', { n: s.run }) : ''}`;
  const key = `${W.lang()} ${signs(set)} ${s.run} ${s.best}`;
  if (picture?.key !== key) { picture = { key, file: null }; makePicture(st, s, how).then(file => { if (picture.key === key) picture.file = file; }); }
  $('share').onclick = () => shareTonight(text);
}

// The share picture: tonight's three drawn with their signs, the streak and the address, 1080 × 1350 (a phone's
// portrait post). Made ahead so the share sheet opens straight from the tap.
function pictureSvg(st, s, how) {
  const rows = set.map((game, i) => {
    const y = 330 + i * 270;
    return `<clipPath id="c${i}"><rect x="90" y="${y}" width="320" height="240" rx="28"/></clipPath>
      <g clip-path="url(#c${i})"><svg x="90" y="${y}" width="320" height="240" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice">${svgOf(game.slug)}</svg></g>
      <rect x="90" y="${y}" width="320" height="240" rx="28" fill="none" stroke="#ffd9a044" stroke-width="2"/>
      <text x="450" y="${y + 92}" font-family="-apple-system, system-ui, sans-serif" font-size="26" letter-spacing="3" fill="#efe8da99">${esc(t(LABEL[game.kind]).toLocaleUpperCase(W.lang()))}</text>
      <text x="450" y="${y + 148}" font-size="${Math.min(50, Math.floor(860 / nameOf(game).length))}" fill="#ffd9a0">${esc(nameOf(game))}</text>
      <text x="450" y="${y + 196}" font-family="-apple-system, system-ui, sans-serif" font-size="28" fill="#a8e0a0">${esc(t(st[i]))}</text>
      <text x="990" y="${y + 150}" font-size="96" text-anchor="end" fill="#ffd9a0">${SIGN[st[i]]}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="Georgia, 'Times New Roman', serif">
    <defs><radialGradient id="glow" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".18"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient></defs>
    <rect width="1080" height="1350" fill="#0b0d14"/><rect width="1080" height="700" fill="url(#glow)"/>
    <text x="90" y="170" font-size="96" fill="#ffd9a0">${esc(t('pictureTitle'))}</text>
    <text x="92" y="240" font-family="-apple-system, system-ui, sans-serif" font-size="30" letter-spacing="4" fill="#efe8da99">${esc(dayLabel(today).toLocaleUpperCase(W.lang()))}</text>
    ${rows}
    <path d="M90 1172h900" stroke="#ffd9a033" stroke-width="2"/>
    <text x="90" y="1236" font-size="40" fill="#efe8da">${esc(how)}</text>
    <text x="90" y="1290" font-size="34" fill="#a8e0a0">${esc(s.run > 1 ? t('streak', { n: s.run }) : t('streak1'))}</text>
    <text x="990" y="1290" font-family="-apple-system, system-ui, sans-serif" font-size="28" text-anchor="end" fill="#efe8da99">${esc(t('pictureUrl'))}</text>
  </svg>`;
}
async function makePicture(st, s, how) {
  try {
    const img = new Image(), svg = pictureSvg(st, s, how);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
    return blob ? new File([blob], `three-tonight-${today}.png`, { type: 'image/png' }) : null;
  } catch { return null; }
}
async function shareTonight(text) {
  rec.event('share', { what: 'tonight', picture: !!picture?.file });
  const file = picture?.file;
  try {
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text}\n${homeUrl()}` }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  if (await shareLink(homeUrl(), text) === 'copied') toast('copied');
}

// ---------- the deck ----------
const deck = $('deck');
let at = 0;
const cards = () => [...deck.children];
function drawDeck() {
  deck.innerHTML = order.map((game, i) => {
    const m = mark(game.slug);
    return `<article class="card ${game.slug}" data-i="${i}" aria-label="${esc(t('nOf', { n: i + 1, of: order.length }))}">
      <div class="pic">${artOf(game.slug)}<div class="badge">${game === pick ? `<span class="pickTag">${esc(t('pick'))}</span>` : ''}<span class="mark ${m.cls}">${esc(t(m.key, m))}</span></div></div>
      <div class="body"><b>${esc(nameOf(game))}</b><span class="line">${esc(lineOf(game))}</span><small>${esc(timeOf(game))}${englishOnly(game) ? ' · ' + esc(t('english')) : ''}</small>
      <a class="play" href="${hrefOf(game)}" data-slug="${game.slug}" data-where="deck">${esc(t('play'))} ›</a></div></article>`;
  }).join('');
  $('dots').innerHTML = order.map(game => `<i class="${game === pick ? 'pk' : ''}"></i>`).join('');
  show(at, false);
}
// A card the page is scrolling to (arrows, Surprise me, a side card's tap). While it is set, the deck's position does
// not change `at`: the cards the glide passes are not the current one. When the deck comes to rest it must be on that
// card; if it is not (WebKit can drop a smooth scroll asked for while another is still running), it jumps there.
let target = null, rest = 0;
const leftOf = card => card.offsetLeft - (deck.clientWidth - card.offsetWidth) / 2;
function settle() {
  clearTimeout(rest);
  rest = setTimeout(() => {
    const card = target === null ? null : cards()[target];
    target = null;
    if (card && Math.abs(deck.scrollLeft - leftOf(card)) > 2) deck.scrollTo({ left: leftOf(card), behavior: 'auto' });
  }, 160);
}
function show(i, smooth = true) {
  at = Math.max(0, Math.min(order.length - 1, i));
  const card = cards()[at];
  if (card) deck.scrollTo({ left: leftOf(card), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  target = card && smooth ? at : null; if (target !== null) settle();
  sync();
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function sync() {
  cards().forEach((c, i) => { c.classList.toggle('away', i !== at); c.setAttribute('aria-hidden', String(i !== at)); c.querySelector('.play').tabIndex = i === at ? 0 : -1; });
  [...$('dots').children].forEach((d, i) => d.classList.toggle('on', i === at));
  $('prev').disabled = at === 0; $('next').disabled = at === order.length - 1;
  try { sessionStorage.setItem('hub:small:at', String(at)); } catch {}
}
// Follow the thumb: the card nearest the middle is the current one, checked once a frame while the deck moves.
let frame = 0;
deck.addEventListener('scroll', () => {
  if (target !== null) { settle(); return; }
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0; if (target !== null) return;
    const mid = deck.scrollLeft + deck.clientWidth / 2;
    let best = at, gap = Infinity;
    cards().forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = i; } });
    if (best !== at) { at = best; sync(); }
  });
}, { passive: true });
$('prev').onclick = () => show(at - 1);
$('next').onclick = () => show(at + 1);
deck.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); } });
// Surprise me: a game not played yet if there is one, never the card on screen.
$('surprise').onclick = () => {
  const others = order.map((game, i) => ({ game, i })).filter(({ i }) => i !== at);
  const fresh = others.filter(({ game }) => ['new', 'opened'].includes(mark(game.slug).cls));
  const { game, i } = (fresh.length ? fresh : others)[Math.floor(Math.random() * (fresh.length || others.length))];
  show(i); rec.event('surprise', { slug: game.slug });
  const card = cards()[i]; card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
};
$('shareAll').onclick = async () => { rec.event('share', { what: 'all' }); if (await shareLink(homeUrl(), t('shareAllText')) === 'copied') toast('copied'); };

// ---------- taps ----------
// A tap opens a game only when it is a tap: not the end of a drag (the finger or the deck moved between touch and
// release), and on the deck only the card in the middle. A side card's tap brings it to the middle. A tap that stops
// the deck mid-glide fires no click in phone browsers.
let down = null;
addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, left: deck.scrollLeft }; }, { passive: true, capture: true });
deck.addEventListener('touchstart', () => { target = null; }, { passive: true }); // a finger on the deck takes over from the page's glide
// A side card is brought in on the finger's release, not on click: WebKit sent no click for a tap on the sliver of
// the next card in the phone check. The click that may follow is then swallowed, so it cannot open the game.
let broughtIn = 0;
deck.addEventListener('pointerup', e => {
  const card = e.target.closest('.card'), i = Number(card?.dataset.i);
  if (!card || i === at || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 || Math.abs(deck.scrollLeft - down.left) > 4) return;
  broughtIn = performance.now(); show(i);
});
document.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card && (Number(card.dataset.i) !== at || performance.now() - broughtIn < 500)) { e.preventDefault(); return; }
  const a = e.target.closest('a[data-slug]'); if (!a) return;
  const pointer = e.detail > 0 && down;
  if (pointer && (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 || (card && Math.abs(deck.scrollLeft - down.left) > 4))) { e.preventDefault(); return; }
  const slug = a.dataset.slug, where = a.dataset.where;
  if (where === 'tonight') { openStop(slug); seeIntro(); } else markOpened(slug);
  // Recorded when the player comes back: a send started now would be cut off by the page leaving.
  try { sessionStorage.setItem('hub:small:open', JSON.stringify({ slug, where, i: where === 'deck' ? at : set.findIndex(game => game.slug === slug) })); } catch {}
}, true);

// ---------- the page ----------
$('introOk').onclick = () => {
  seeIntro(); $('intro').hidden = true;
  const li = $('stops').querySelector('li.now'); if (!li) return;
  li.classList.remove('pulse'); void li.offsetWidth; li.classList.add('pulse');
  li.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
};
$('lang').onclick = () => {
  W.setLang(W.lang() === 'en' ? 'tr' : 'en');
  const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.set('lang', W.lang()); history.replaceState(null, '', u); }
  draw();
};
function draw() {
  W.apply(); document.title = t('docTitle');
  $('lang').textContent = t('langOther'); $('lang').setAttribute('aria-label', t('langName'));
  drawTonight(); drawDeck();
  try { const o = JSON.parse(sessionStorage.getItem('hub:small:open')); sessionStorage.removeItem('hub:small:open'); if (o?.slug) rec.event('open', o); } catch {}
}
// Coming back from a game with the back button can restore this page from the back-forward cache, and a game left
// open in another tab can change its save: read everything again whenever the page is shown.
addEventListener('pageshow', e => { if (e.persisted) draw(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') draw(); });
addEventListener('resize', () => show(at, false));
try { const s = Number(sessionStorage.getItem('hub:small:at')); if (Number.isInteger(s) && s >= 0 && s < order.length) at = s; } catch {}
// The notice goes on the page first: lab.js records nothing before it is shown.
rec.notice($('foot')); rec.toggle($('foot'));
noZoom(); draw();

// For the page checks: the state on screen, and tonight's share picture as a data address.
window.smallPicture = () => new Promise(ok => { const f = picture?.file; if (!f) return ok(null); const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(f); });
window.smallState = () => ({
  lang: W.lang(), today, pick: pick.slug, three: set.map(game => game.slug), kinds: KINDS, signs: signs(set), at,
  intro: !$('intro').hidden, result: !!$('result').firstElementChild, picture: !!picture?.file,
  run: $('run').textContent, links: [...document.querySelectorAll('a[data-slug]')].map(a => ({ slug: a.dataset.slug, where: a.dataset.where, href: a.getAttribute('href') })),
});
