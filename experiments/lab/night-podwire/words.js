// Every player-facing string, in English and Turkish (kit/i18n.js picks the language).
import { words } from '../../kit/i18n.js';

// Common names per plate, in plate order. Latin names stay as they are in both languages.
const names = {
  en: ['Poppy', 'Honesty', 'Flax', 'Milkweed', 'Love-in-a-mist', 'Columbine', 'Bladder campion', 'Sweet pea', 'Spanish broom',
    'Squirting cucumber', 'Hop', 'Rattlebox', "Job's tears", 'Lupin', 'Cotton', 'Quaking grass', 'Wallflower', 'Peony'],
  tr: ['Gelincik', 'Ay otu', 'Keten', 'İpek otu', 'Çörek otu', 'Hasekiküpesi', 'Gıvışkan otu', 'Kokulu bezelye', 'Katırtırnağı',
    'Eşek hıyarı', 'Şerbetçiotu', 'Çıngıraklı bakla', 'Gözyaşı otu', 'Acı bakla', 'Pamuk', 'Titrek ot', 'Şebboy', 'Şakayık'],
};

export const tables = {
  en: {
    brand: 'Podwire',
    pause: 'Pause',
    plate: 'Plate {n} of {total}',
    dailyPlate: "Today's plate · {date}",
    podsOne: '{n} / {total} pod open',
    podsOther: '{n} / {total} pods open',
    collected: 'All eighteen plates collected',
    next: 'Next plate →',
    again: 'Play again ↻',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart plate',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    otherLang: 'Türkçe',
    visitOnly: 'Progress saved for this visit only.',
    board: 'Pull a marked section of wire down, then release to open the hanging seed pods. Tap a brass peg to clamp the wire there.',
    hintNext: 'Next plate',
    today: 'Today',
    todayDone: 'Today ✓',
    plates: 'Plates',
    resultOne: '1 pluck · par {par}',
    resultOther: '{n} plucks · par {par}',
    share: 'Share',
    shared: 'Shared',
    copied: 'Copied',
    shareLineOne: 'Podwire {date} · {plate}: 1 pluck, par {par} {marks}',
    shareLine: 'Podwire {date} · {plate}: {n} plucks, par {par} {marks}',
    practice: 'Practice: your first result today stands.',
  },
  tr: {
    brand: 'Podwire',
    pause: 'Duraklat',
    plate: 'Levha {n} / {total}',
    dailyPlate: 'Günün levhası · {date}',
    podsOne: '{n} / {total} kese açık',
    podsOther: '{n} / {total} kese açık',
    collected: 'On sekiz levhanın hepsi toplandı',
    next: 'Sonraki levha →',
    again: 'Yeniden oyna ↻',
    paused: 'Duraklatıldı',
    resume: 'Devam et',
    restart: 'Levhayı yeniden başlat',
    soundOn: 'Ses açık',
    soundOff: 'Ses kapalı',
    otherLang: 'English',
    visitOnly: 'İlerleme yalnızca bu ziyaret için kaydedildi.',
    board: 'Telin işaretli bir bölümünü aşağı çek ve bırak; dalga asılı tohum keselerini açar. Pirinç düğmeye dokunmak teli orada sıkıştırır.',
    hintNext: 'Sonraki levha',
    today: 'Bugün',
    todayDone: 'Bugün ✓',
    plates: 'Levhalar',
    resultOne: '1 çekiş · par {par}',
    resultOther: '{n} çekiş · par {par}',
    share: 'Paylaş',
    shared: 'Paylaşıldı',
    copied: 'Kopyalandı',
    shareLineOne: 'Podwire {date} · {plate}: 1 çekiş, par {par} {marks}',
    shareLine: 'Podwire {date} · {plate}: {n} çekiş, par {par} {marks}',
    practice: 'Alıştırma: bugünkü ilk sonucun geçerli.',
  },
};

const w = words(tables);
export const { t, lang, setLang, apply } = w;
export const plantName = level => (names[lang()] || names.en)[level - 1] ?? names.en[level - 1];
export function roman(n) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}
const dates = {};
export function dateLabel(iso) {
  const code = lang(), d = new Date(iso + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime())) return iso;
  return (dates[code] ??= new Intl.DateTimeFormat(code, { day: 'numeric', month: 'short', timeZone: 'UTC' })).format(d);
}
