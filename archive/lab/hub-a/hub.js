// Shared by the three draft homes for the small games (lab/hub-a, hub-b, hub-c): the catalogue, the words, the drawn
// previews, a read-only look at each game's own save, and the A · B · C strip. Nothing here writes a game's key;
// the hubs' own keys all start with `hub:`.
import { read, readJson, readNumber, writeJson } from '../../kit/save.js';
import { words } from '../../kit/i18n.js';

// ---------- words ----------
const en = {
  strip: 'Draft home', langOther: 'TR', langName: 'Türkçe',
  new: 'New', opened: 'Opened', played: 'Played', finished: 'Finished', todayDone: 'Done today', english: '',
  of: '{n} / {of}', min: '{n} min', minLevel: '{n} min a level', minRound: '{n} min a round', minMatch: '{n} min a match', minDay: '{n} min a day', dropIn: 'Drop in any time',
  // A
  aTitle: 'Small games', aLead: 'Short games for a phone. Each one plays in a few minutes and remembers where you were.',
  aSolo: 'On your own', aSoloSub: 'One thumb, a few minutes.',
  aFriend: 'With a friend', aFriendSub: 'Of the small games only Paper Pitch has friend play. From the main shelf, Thumb Duel is made for two and Crumbwar is for anyone online.',
  byLink: 'By link, or two on one phone', onePhone: 'Two on one phone', online: 'Online with strangers and bots', alsoBot: 'or against the bot',
  // B
  bTitle: 'A pocket of small games', bLead: 'Swipe through. Each card is a whole game.', pick: 'Today’s pick', surprise: 'Surprise me', play: 'Play',
  share: 'Share this pocket', shared: 'Link copied', shareText: 'A pocket of small games',
  prev: 'Previous game', next: 'Next game', nOf: 'Game {n} of {of}', fresh: 'Not played yet',
  // C
  cTitle: 'Three tonight', cLead: 'Three small games, one after another. A new three every night, the same for everyone.',
  warm: 'Warm up', think: 'Think', calm: 'Wind down', nowPlay: 'Play', again: 'Play again', next3: 'Next', stop: 'Stop {n}',
  cDone: 'Tonight is done', cMoved: 'You moved forward in {n} of 3.', cOpened: 'You opened all three.', streak: '{n} nights in a row', streak1: 'First night', best: 'Best: {n}',
  cShare: 'Share tonight', cShareText: 'Three tonight · {day} · {marks}', cBack: 'Come back tomorrow for a new three.',
  cAll: 'All the small games', cLegend: '✦ moved forward · ○ opened',
};
const tr = {
  strip: 'Taslak ana sayfa', langOther: 'EN', langName: 'English',
  new: 'Yeni', opened: 'Açıldı', played: 'Oynandı', finished: 'Bitti', todayDone: 'Bugün tamam', english: 'İngilizce',
  of: '{n} / {of}', min: '{n} dk', minLevel: 'Bölümü {n} dk', minRound: 'Turu {n} dk', minMatch: 'Maçı {n} dk', minDay: 'Günde {n} dk', dropIn: 'İstediğin an katıl',
  aTitle: 'Küçük oyunlar', aLead: 'Telefon için kısa oyunlar. Her biri birkaç dakikada oynanır ve kaldığın yeri hatırlar.',
  aSolo: 'Tek başına', aSoloSub: 'Tek parmak, birkaç dakika.',
  aFriend: 'Bir arkadaşla', aFriendSub: 'Küçük oyunlardan yalnızca Kâğıt Futbolu arkadaşla oynanıyor. Ana raftan Thumb Duel iki kişilik, Crumbwar ise çevrim içi herkes için.',
  byLink: 'Bağlantıyla ya da tek telefonda iki kişi', onePhone: 'Tek telefonda iki kişi', online: 'Çevrim içi, yabancılar ve botlarla', alsoBot: 'ya da bota karşı',
  bTitle: 'Cep dolusu küçük oyun', bLead: 'Kaydırarak gez. Her kart başlı başına bir oyun.', pick: 'Günün seçimi', surprise: 'Şaşırt beni', play: 'Oyna',
  share: 'Bu cebi paylaş', shared: 'Bağlantı kopyalandı', shareText: 'Cep dolusu küçük oyun',
  prev: 'Önceki oyun', next: 'Sonraki oyun', nOf: 'Oyun {n} / {of}', fresh: 'Henüz oynanmadı',
  cTitle: 'Bu gece üç', cLead: 'Art arda üç küçük oyun. Her gece yeni bir üçlü, herkes için aynı.',
  warm: 'Isınma', think: 'Düşün', calm: 'Dinlen', nowPlay: 'Oyna', again: 'Yeniden oyna', next3: 'Sıradaki', stop: '{n}. durak',
  cDone: 'Bu gece tamam', cMoved: 'Üç oyunun {n} tanesinde ilerledin.', cOpened: 'Üçünü de açtın.', streak: 'Art arda {n} gece', streak1: 'İlk gece', best: 'En iyi: {n}',
  cShare: 'Bu geceyi paylaş', cShareText: 'Bu gece üç · {day} · {marks}', cBack: 'Yeni üçlü için yarın gel.',
  cAll: 'Bütün küçük oyunlar', cLegend: '✦ ilerledin · ○ açtın',
};
export const W = words({ en, tr });
export const t = W.t;
const L = o => (o && typeof o === 'object' ? o[W.lang()] ?? o.en : o);

// ---------- days ----------
// Today's pick and tonight's three are seeded by the UTC date, so everyone sees the same one; ?day=YYYY-MM-DD for checks.
const asked = new URLSearchParams(location.search).get('day');
export const today = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : new Date().toISOString().slice(0, 10);
export const dayBefore = day => new Date(Date.parse(day + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function seeded(text) { // mulberry32 seeded by a string hash
  let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h |= 0; h = (h + 0x6D2B79F5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
export const dayLabel = day => new Date(day + 'T12:00:00Z').toLocaleDateString(W.lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ---------- progress, read-only ----------
// Each reader looks at the game's own save and gives { score, of, finished, today }. score only grows with play, so a
// hub can compare it before and after a visit. A key that exists says little: some games write defaults on load.
const J = k => readJson(k, null);
const count = a => (Array.isArray(a) ? a.filter(n => Number(n) > 0).length : 0);
const num = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.trunc(v))) : 0);
const P = {
  thankful() { const d = J('thankful:v1')?.days || {}; const n = Object.keys(d).filter(k => Array.isArray(d[k]) && d[k].length).length; const now = d[localDay()]?.length || 0; return { score: n * 3 + Math.min(3, now), of: null, today: now >= 3 }; },
  pitch() { const s = J('pitch:v1') || {}; return { score: num(s.played, 1e6) + Object.keys(s.daily || {}).length, of: null }; },
  'night-channels'() { const s = J('night-channels:save') || {}; const n = s.completed === true ? 10 : num(s.unlocked, 10) - 1; return { score: Math.max(0, n), of: 10, finished: s.completed === true }; },
  ring() { const s = J('ring:v1') || {}; return { score: num(s.nights, 1e6), of: null, finished: num(s.dawns, 1e6) > 0 }; },
  'night-sand'() { const n = num(J('night-sand:save')?.completed, 10); return { score: n, of: 10, finished: n >= 10 }; },
  'night-bells'() { const n = count(J('night-bells:save')?.stars); return { score: n, of: 8, finished: n >= 8 }; },
  'night-podwire'() { const s = J('night-podwire:progress') || {}; const n = s.complete === true ? 6 : Math.max(0, num(s.next, 6) - 1); return { score: n, of: 6, finished: n >= 6 }; },
  'night-saltplate'() { const n = num(J('night-saltplate:save')?.cleared, 6); return { score: n, of: 6, finished: n >= 6 }; },
  // Splitlight keeps the highest plate reached (a plain number), so the last plate's clear is not visible here.
  'night-splitlight'() { const n = Math.max(0, num(readNumber('night-splitlight:plate', 1), 6) - 1); return { score: n, of: 6 }; },
  'wild-pour'() { const n = count(J('wild-pour:save')?.stars); return { score: n, of: 8, finished: n >= 8 }; },
  'wild2-face-shift'() { const s = J('wild2-face-shift:save') || {}; return { score: num(s.runs, 1e6), of: null, finished: count(s.stars) >= 4 }; },
  // Carbon Cabinet opens the next print when one is filed; the sixth print's filing is not visible here.
  'night-rubbing'() { const n = Math.max(0, num(J('night-rubbing:save')?.unlocked, 6) - 1); return { score: n, of: 6 }; },
  duel() { return { score: num(J('duel-save')?.matches, 1e6), of: null }; },
  crumbwar() { return { score: 0, of: null }; },
};
const OPENED = 'hub:opened';
export const openedOn = slug => (readJson(OPENED, {}) || {})[slug] || null;
export function markOpened(slug) { const o = readJson(OPENED, {}) || {}; o[slug] = today; writeJson(OPENED, o); }
export function progress(game) { try { return { score: 0, of: null, ...P[game.slug]?.() }; } catch { return { score: 0, of: null }; } }
// The words for a tile's mark, and a class: new, opened, played, finished.
export function mark(game) {
  const p = progress(game);
  if (p.today) return { cls: 'finished', text: t('todayDone') };
  if (p.finished) return { cls: 'finished', text: t('finished') };
  if (p.score > 0 && p.of) return { cls: 'played', text: t('of', { n: p.score, of: p.of }) };
  if (p.score > 0) return { cls: 'played', text: t('played') };
  if (openedOn(game.slug)) return { cls: 'opened', text: t('opened') };
  return { cls: 'new', text: t('new') };
}

// ---------- the catalogue ----------
// href: the game's current address. Slugs equal the folder names, so play records keep their names if the games move.
// kind: quick, think or calm (Three tonight). tr: true when the game itself plays in Turkish.
const g = (slug, href, name, line, time, kind, extra = {}) => ({ slug, href, name, line, time, kind, ...extra });
export const SMALL = [
  g('night-bells', '/lab/night-bells/', { en: 'Night Bells' }, { en: 'Tap each bell at the top of its swing to light the village.', tr: 'Her çanı salınımının en tepesinde vur, köyün ışıkları yansın.' }, ['minLevel', 1], 'quick'),
  g('wild-pour', '/lab/wild-pour/', { en: 'Pour' }, { en: 'Tip a jug of real drops and fill the glass to the line.', tr: 'Gerçek damlalarla dolu sürahiyi eğ, bardağı çizgiye kadar doldur.' }, ['minLevel', 1], 'quick'),
  g('night-podwire', '/lab/night-podwire/', { en: 'Podwire' }, { en: 'Pull the string and let go. The wave splits the seed pods.', tr: 'Teli çek ve bırak. Dalga tohum keselerini patlatır.' }, ['minLevel', 1], 'quick'),
  g('wild2-face-shift', '/lab/wild2-face-shift/', { en: 'Face Shift' }, { en: 'Stretch a rubber face until it matches the portrait.', tr: 'Lastik yüzü portreye benzeyene kadar esnet.' }, ['minRound', 2], 'quick'),
  g('night-channels', '/lab/night-channels/', { en: 'Channels' }, { en: 'Dig with your thumb so the spring reaches the seedbeds.', tr: 'Kaynak suyu tohum yataklarına ulaşsın diye parmağınla kanal kaz.' }, ['minLevel', 2], 'think'),
  g('night-sand', '/lab/night-sand/', { en: 'Night Sand', tr: 'Gece Kumu' }, { en: 'Dig, pour and sift thousands of grains of sand.', tr: 'Binlerce kum tanesini kaz, dök, ele.' }, ['minLevel', 1], 'think', { tr: true }),
  g('night-splitlight', '/lab/night-splitlight/', { en: 'Splitlight' }, { en: 'Turn the glass so each colour finds its receiver.', tr: 'Camı çevir, her renk kendi alıcısını bulsun.' }, ['minLevel', 1], 'think'),
  g('ring', '/lab/ring/', { en: 'Firefly Ring', tr: 'Ateş Böceği Halkası' }, { en: 'Draw a ring around fireflies of one colour.', tr: 'Aynı renkteki ateş böceklerinin çevresine halka çiz.' }, ['minLevel', 1], 'think', { tr: true }),
  g('pitch', '/lab/pitch/', { en: 'Paper Pitch', tr: 'Kâğıt Futbolu' }, { en: 'The old pencil game: draw the ball into the goal.', tr: 'Eski kalem oyunu: topu kaleye çiz.' }, ['minMatch', 3], 'think', { tr: true, friend: 'byLink' }),
  g('night-saltplate', '/lab/night-saltplate/', { en: 'Saltplate' }, { en: 'Tune a ringing plate until the salt draws the engraving.', tr: 'Çınlayan levhayı akort et, tuz oymadaki deseni çizsin.' }, ['minLevel', 1], 'calm'),
  g('night-rubbing', '/lab/night-rubbing/', { en: 'Carbon Cabinet' }, { en: 'Rub graphite over a fossil and bring out its ridges.', tr: 'Fosilin üstüne grafit sür, kabartmalarını ortaya çıkar.' }, ['minLevel', 1], 'calm'),
  g('thankful', '/lab/thankful/', { en: 'Thankful Garden' }, { en: 'Three thanks a day. Each one becomes a light in your sky.', tr: 'Günde üç teşekkür. Her biri gökyüzünde bir ışık olur.' }, ['minDay', 1], 'calm'),
];
// Live games from the main shelf that are made for more than one person (checked against each game's NOTES.md and code,
// 2026-11-24): Thumb Duel is two on one phone; Crumbwar is online rooms with bots. Good Match and the rest are one player.
export const FOR_TWO = [
  g('duel', '/duel/', { en: 'Thumb Duel' }, { en: 'Two thumbs, one phone: first to three quick duels.', tr: 'Tek telefonda iki başparmak: üç kısa düelloyu ilk kazanan alır.' }, ['minMatch', 3], 'quick', { friend: 'onePhone' }),
  g('crumbwar', '/crumbwar/', { en: 'Crumbwar' }, { en: 'Ant colonies online. Anyone can join; bots fill the room.', tr: 'Çevrim içi karınca kolonileri. Herkes katılabilir, odayı botlar doldurur.' }, ['dropIn', 0], 'quick', { friend: 'online' }),
];
// Today's pick (variant B): the same game for everyone on a UTC day.
export const todaysPick = () => SMALL[Math.floor(seeded('pocket ' + today)() * SMALL.length)];
export const nameOf = game => L(game.name);
export const lineOf = game => L(game.line);
export const timeOf = game => t(game.time[0], { n: game.time[1] });
export const englishOnly = game => W.lang() !== 'en' && !game.tr;
// The address a hub opens, in the same tab. The games ignore `from`; it is there for a later back button.
export const hrefOf = (game, from) => `${game.href}?from=${from}`;

// ---------- drawn previews ----------
// Each is a small picture in the game's own colours, not a screenshot, so it never goes stale against a game's art
// and costs nothing to load. Classes s1..s4 animate (see hub.css) and stop under reduced motion.
const ART = {
  'night-bells': `<rect width="160" height="120" fill="#17233b"/><circle cx="132" cy="22" r="7" fill="#f4e3b0"/><circle cx="135" cy="20" r="6" fill="#17233b"/><path d="M10 34h140" stroke="#3a4a6a" stroke-width="3"/>
    <g class="s1" style="transform-origin:52px 34px"><path d="M52 34v32" stroke="#d9a441" stroke-width="2"/><path d="M42 82q0-18 10-18t10 18z" fill="#f2b84b"/><circle cx="52" cy="84" r="3" fill="#f2b84b"/></g>
    <g class="s2" style="transform-origin:104px 34px"><path d="M104 34v40" stroke="#c9cfdc" stroke-width="2"/><path d="M94 90q0-18 10-18t10 18z" fill="#e9ecf2"/><circle cx="104" cy="92" r="3" fill="#e9ecf2"/></g>
    <path d="M0 108h160v12H0z" fill="#101a2c"/><g fill="#f2b84b" class="s3"><rect x="20" y="100" width="4" height="4"/><rect x="70" y="102" width="4" height="4"/><rect x="128" y="99" width="4" height="4"/></g>`,
  'wild-pour': `<rect width="160" height="120" fill="#f7dcb3"/><path d="M0 116h160v4H0z" fill="#d9a974"/>
    <g class="s18" style="transform-origin:66px 52px"><path d="M30 26h42l-4 46H34z" fill="#fff6e8" stroke="#2f2a26" stroke-width="3" stroke-linejoin="round"/><path d="M36 46h34l-2 24H36z" fill="#f08a2a"/><path d="M72 30q10 2 8 14" fill="none" stroke="#2f2a26" stroke-width="3"/></g>
    <g fill="#f08a2a" class="s3"><circle cx="86" cy="70" r="2.6"/><circle cx="90" cy="80" r="2.6"/><circle cx="93" cy="89" r="2.4"/></g>
    <path d="M84 92h36l-4 24H88z" fill="#fff6e8" stroke="#2f2a26" stroke-width="3" stroke-linejoin="round"/><path d="M87 106h31l-2 9H89z" fill="#f08a2a"/><path d="M82 100h40" stroke="#2f2a26" stroke-width="1.5" stroke-dasharray="3 2"/>`,
  'night-podwire': `<rect width="160" height="120" fill="#f3ecdc"/><circle cx="80" cy="56" r="34" fill="#efdcb2"/><path d="M28 34q40-30 104-6" fill="none" stroke="#4f6b3a" stroke-width="3"/>
    <g fill="#6b8a4a"><ellipse cx="50" cy="26" rx="9" ry="4" transform="rotate(-30 50 26)"/><ellipse cx="74" cy="20" rx="9" ry="4" transform="rotate(20 74 20)"/><ellipse cx="104" cy="22" rx="9" ry="4" transform="rotate(-15 104 22)"/></g>
    <path d="M80 28v14" stroke="#4f6b3a" stroke-width="2"/><g class="s4" style="transform-origin:80px 54px"><ellipse cx="80" cy="56" rx="10" ry="13" fill="#e0733a"/><path d="M80 44v24M74 47q6 9 0 18M86 47q-6 9 0 18" stroke="#a9471e" stroke-width="1.3" fill="none"/></g>
    <path class="s5" style="transform-origin:80px 92px" d="M24 92 L80 104 L136 92" fill="none" stroke="#b46a3c" stroke-width="2"/><circle cx="24" cy="92" r="3" fill="#5b4a3a"/><circle cx="136" cy="92" r="3" fill="#5b4a3a"/>`,
  'wild2-face-shift': `<rect width="160" height="120" fill="#1d3b45"/><rect x="18" y="16" width="124" height="90" rx="10" fill="#f1ead8"/>
    <rect x="28" y="28" width="38" height="46" rx="3" fill="#fff" transform="rotate(-6 47 51)"/><ellipse cx="47" cy="52" rx="12" ry="15" fill="#9bcf6a" transform="rotate(-6 47 52)"/><circle cx="43" cy="49" r="2.4" fill="#203"/><circle cx="51" cy="48" r="2.4" fill="#203"/><ellipse cx="48" cy="59" rx="4" ry="2" fill="#203"/>
    <g class="s6" style="transform-origin:100px 56px"><ellipse cx="100" cy="56" rx="22" ry="20" fill="#ef6b5b"/><circle cx="92" cy="50" r="5" fill="#fff"/><circle cx="108" cy="50" r="5" fill="#fff"/><circle cx="92" cy="51" r="2.4" fill="#203"/><circle cx="108" cy="51" r="2.4" fill="#203"/><ellipse cx="100" cy="66" rx="7" ry="5" fill="#5a1b1b"/></g>
    <rect x="50" y="88" width="60" height="10" rx="5" fill="#d7f07a"/>`,
  'night-channels': `<rect width="160" height="120" fill="#1f2a1e"/><g fill="#b8774c" stroke="#9b5f3a" stroke-width="1"><rect x="22" y="8" width="116" height="104" rx="4"/></g>
    <path d="M22 30h116M22 52h116M22 74h116M22 96h116M44 8v104M66 8v104M88 8v104M110 8v104" stroke="#a5683f" stroke-width=".8"/>
    <rect x="70" y="10" width="14" height="22" rx="7" fill="#3fb7c7"/><path class="s7" d="M77 30 V66 H100 V92" fill="none" stroke="#3fb7c7" stroke-width="7" stroke-linecap="round" stroke-dasharray="90" />
    <circle cx="100" cy="96" r="8" fill="#5a7a3a"/><path d="M96 96q4-8 8 0M100 90v8" stroke="#c8e08a" stroke-width="2" fill="none"/><g fill="#7d8a8c"><ellipse cx="44" cy="42" rx="7" ry="5"/><ellipse cx="122" cy="66" rx="7" ry="5"/></g><rect x="28" y="82" width="12" height="12" fill="#e4c48a" opacity=".7"/>`,
  'night-sand': `<rect width="160" height="120" fill="#16203a"/><circle cx="126" cy="26" r="10" fill="#f0e3a8"/><g fill="#fff8" ><circle cx="30" cy="20" r="1"/><circle cx="62" cy="34" r="1"/><circle cx="96" cy="14" r="1"/></g>
    <path d="M0 120V96q40-50 80-46t80 40v30z" fill="#d79a3a"/><path d="M0 120V104q40-34 80-30t80 30v16z" fill="#c4842c"/><g class="s8" fill="#e9b45a"><circle cx="112" cy="40" r="1.6"/><circle cx="114" cy="48" r="1.6"/><circle cx="111" cy="56" r="1.6"/></g>
    <path d="M70 52q10-14 20 0" fill="none" stroke="#3a2f22" stroke-width="2.4"/><circle cx="80" cy="44" r="2" fill="#f6d46a"/>`,
  'night-splitlight': `<rect width="160" height="120" fill="#10181f"/><circle cx="80" cy="60" r="46" fill="none" stroke="#2c3a44" stroke-width="1.5"/>
    <path d="M0 58 L70 60" stroke="#fff" stroke-width="2.4"/><path d="M80 34 L100 76 H60 Z" fill="#9fd3e633" stroke="#cfe7ef" stroke-width="1.6"/>
    <g class="s9" stroke-width="2" style="transform-origin:86px 62px"><path d="M86 62 L150 80" stroke="#ff5b5b"/><path d="M86 62 L150 86" stroke="#ffb347"/><path d="M86 62 L150 92" stroke="#ffe75c"/><path d="M86 62 L150 98" stroke="#5be37a"/><path d="M86 62 L150 104" stroke="#5bb6ff"/><path d="M86 62 L150 110" stroke="#a77bff"/></g>`,
  ring: `<rect width="160" height="120" fill="#0b120f"/><path class="s10" d="M44 64q-6-34 34-36t40 30q0 30-36 30t-38-24" fill="none" stroke="#ffd27a" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="210" opacity=".95"/>
    <g class="s3"><circle cx="64" cy="52" r="4" fill="#ffa443"/><circle cx="84" cy="44" r="4" fill="#ffa443"/><circle cx="92" cy="66" r="4" fill="#ffa443"/><circle cx="72" cy="72" r="4" fill="#ffa443"/></g>
    <g class="s11"><circle cx="128" cy="24" r="3.4" fill="#5fe3b0"/><circle cx="24" cy="98" r="3.4" fill="#ff7fc0"/><circle cx="140" cy="96" r="3.4" fill="#5fe3b0"/><circle cx="20" cy="28" r="3" fill="#ff7fc0"/></g>`,
  pitch: `<rect width="160" height="120" fill="#f7f2e6"/><path d="M0 12h160M0 24h160M0 36h160M0 48h160M0 60h160M0 72h160M0 84h160M0 96h160M0 108h160M16 0v120M32 0v120M48 0v120M64 0v120M80 0v120M96 0v120M112 0v120M128 0v120M144 0v120" stroke="#d6dfe8" stroke-width=".8"/>
    <path d="M32 12h32v-8h32v8h32v96H96v8H64v-8H32z" fill="none" stroke="#5a5a5a" stroke-width="1.6"/><path class="s12" d="M80 60l16-12 0-12-16 12-16-12 16-12" fill="none" stroke="#1e4fd6" stroke-width="2" stroke-dasharray="100"/><path d="M80 60l-16 12 16 12 16 0" fill="none" stroke="#d63a2e" stroke-width="2"/><circle cx="80" cy="24" r="3.4" fill="#222"/>`,
  'night-saltplate': `<rect width="160" height="120" fill="#efe6d2"/><rect x="34" y="8" width="92" height="92" fill="#1d2c47" stroke="#8a6a3a" stroke-width="3"/>
    <g class="s13" fill="#f3dfa0"><circle cx="50" cy="24" r="1.2"/><circle cx="58" cy="32" r="1.2"/><circle cx="66" cy="40" r="1.2"/><circle cx="74" cy="48" r="1.2"/><circle cx="80" cy="54" r="1.2"/><circle cx="88" cy="62" r="1.2"/><circle cx="96" cy="70" r="1.2"/><circle cx="104" cy="78" r="1.2"/><circle cx="112" cy="86" r="1.2"/><circle cx="110" cy="24" r="1.2"/><circle cx="102" cy="32" r="1.2"/><circle cx="94" cy="40" r="1.2"/><circle cx="86" cy="48" r="1.2"/><circle cx="72" cy="60" r="1.2"/><circle cx="64" cy="68" r="1.2"/><circle cx="56" cy="76" r="1.2"/><circle cx="48" cy="84" r="1.2"/><circle cx="80" cy="20" r="1.2"/><circle cx="80" cy="88" r="1.2"/><circle cx="46" cy="54" r="1.2"/><circle cx="114" cy="54" r="1.2"/></g>
    <path d="M24 110h112" stroke="#6b5a40" stroke-width="2"/><rect class="s14" x="58" y="104" width="8" height="12" rx="2" fill="#b07a3a"/>`,
  'night-rubbing': `<rect width="160" height="120" fill="#1c3529"/><rect x="34" y="8" width="92" height="104" rx="2" fill="#efe8d6"/>
    <g fill="none" stroke="#b9b2a2" stroke-width="1.4"><path d="M80 90 L48 46 M80 90 L58 40 M80 90 L69 37 M80 90 L80 36 M80 90 L91 37 M80 90 L102 40 M80 90 L112 46"/><path d="M48 46 Q80 22 112 46"/></g>
    <g class="s15"><path d="M48 46 Q80 22 112 46 L80 90Z" fill="#5a5a5a" opacity=".35"/></g><path d="M100 70 l26-20" stroke="#e9a13a" stroke-width="5" stroke-linecap="round"/><path d="M98 72l-3 3" stroke="#333" stroke-width="3"/>`,
  thankful: `<rect width="160" height="120" fill="#0f1f1a"/><path d="M0 0h160v70H0z" fill="#12233a"/><circle cx="80" cy="26" r="8" fill="#f2efe0"/><circle cx="84" cy="23" r="7" fill="#12233a"/>
    <g class="s3" fill="#ffe3a0"><circle cx="40" cy="58" r="3.4"/><circle cx="58" cy="44" r="3.4"/><circle cx="74" cy="60" r="3.4"/><circle cx="108" cy="52" r="2.6" opacity=".7"/><circle cx="124" cy="40" r="2.6" opacity=".7"/><circle cx="132" cy="58" r="2.6" opacity=".7"/></g>
    <path d="M40 58L58 44L74 60Z" fill="none" stroke="#ffe3a088" stroke-width="1"/><path d="M108 52L124 40L132 58Z" fill="none" stroke="#ffe3a055" stroke-width="1"/>
    <path d="M0 120V96q80-18 160 0v24z" fill="#163126"/><g stroke="#7fb37f" stroke-width="1.6"><path d="M40 108v-10M60 110v-12M100 108v-10M120 110v-12"/></g>`,
  duel: `<rect width="160" height="60" fill="#d8463a"/><rect y="60" width="160" height="60" fill="#2a63d8"/><path d="M0 60h160" stroke="#fff" stroke-width="2"/>
    <g class="s16"><circle cx="80" cy="60" r="7" fill="#fff"/></g><ellipse cx="50" cy="28" rx="12" ry="9" fill="#ffd2b8" transform="rotate(180 50 28)"/><ellipse cx="110" cy="94" rx="12" ry="9" fill="#ffd2b8"/>`,
  crumbwar: `<rect width="160" height="120" fill="#3a2c1e"/><g fill="#f3d58a"><circle cx="40" cy="30" r="2.4"/><circle cx="120" cy="40" r="2.4"/><circle cx="70" cy="92" r="2.4"/><circle cx="132" cy="96" r="2.4"/></g>
    <g class="s17"><g fill="#e2513a"><circle cx="58" cy="52" r="4"/><circle cx="65" cy="52" r="3"/><circle cx="51" cy="52" r="3"/></g><g fill="#4aa3e0"><circle cx="100" cy="70" r="4"/><circle cx="107" cy="70" r="3"/><circle cx="93" cy="70" r="3"/></g><g fill="#7ccf5a"><circle cx="90" cy="30" r="4"/><circle cx="97" cy="30" r="3"/><circle cx="83" cy="30" r="3"/></g></g>`,
};
export const artOf = game => `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="hub-art">${ART[game.slug] || ''}</svg>`;

// ---------- the A · B · C strip ----------
// Keeps ?lang and ?day when switching, and switches language in place.
export function strip(which, redraw) {
  const keep = new URLSearchParams(location.search); keep.delete('from');
  const q = keep.toString() ? `?${keep}` : '';
  const nav = document.createElement('nav'); nav.className = 'hub-strip';
  nav.innerHTML = `<span class="hub-strip-label"></span>${['a', 'b', 'c'].map(v => `<a href="../hub-${v}/${q}" class="${v === which ? 'on' : ''}" ${v === which ? 'aria-current="page"' : ''}>${v.toUpperCase()}</a>`).join('<i>·</i>')}<button type="button" class="hub-lang"></button>`;
  document.body.prepend(nav);
  const label = () => { nav.querySelector('.hub-strip-label').textContent = t('strip'); const b = nav.querySelector('.hub-lang'); b.textContent = t('langOther'); b.setAttribute('aria-label', t('langName')); };
  nav.querySelector('.hub-lang').onclick = () => {
    W.setLang(W.lang() === 'en' ? 'tr' : 'en');
    const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.set('lang', W.lang()); history.replaceState(null, '', u); }
    label(); redraw();
  };
  label();
}
// Coming back from a game with the browser's back button can restore this page from the back-forward cache, so the
// marks are read again whenever the page is shown.
export function onShow(redraw) { addEventListener('pageshow', e => { if (e.persisted) redraw(); }); }
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export { read };
