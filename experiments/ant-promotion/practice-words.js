// Words for the practice meadow (practice.js), English and Turkish, added to words.js's tables like meadow-words.js.
import { tables } from './words.js';

const en = {
  'practice.button': 'Practice meadow',
  'practice.title': 'Practice meadow',
  'practice.say': 'Be any animal and try its skill. Nothing here is saved: no level lost, no rival, nothing added to your book. Skills fill again in 3 seconds here.',
  'practice.level': 'Level {n}',
  'practice.start': 'Practice: {name}. {label}: {does}',
  'practice.caught': 'Caught by {a}. Try again.',
  'practice.full': 'Bar full. In practice you stay {a}.',
  'practice.hud': 'Practice · {name}',
  'practice.other': 'Try another animal',
};
const tr = {
  'practice.button': 'Alıştırma çayırı',
  'practice.title': 'Alıştırma çayırı',
  'practice.say': 'İstediğin hayvan ol ve yeteneğini dene. Burada hiçbir şey kaydedilmez: seviye kaybı yok, rakip yok, kitabına bir şey eklenmez. Yetenekler burada 3 saniyede dolar.',
  'practice.level': 'Seviye {n}',
  'practice.start': 'Alıştırma: {name}. {label}: {does}',
  'practice.caught': 'Seni {to} yakaladı. Yeniden dene.',
  'practice.full': 'Çubuk doldu. Alıştırmada {name} olarak kalırsın.',
  'practice.hud': 'Alıştırma · {name}',
  'practice.other': 'Başka bir hayvan dene',
};
Object.assign(tables.en, en);
Object.assign(tables.tr, tr);
export const complete = () => Object.keys(en).every(k => tr[k]) && Object.keys(tr).every(k => en[k]);
