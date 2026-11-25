// Harvest Morning's words in English and Turkish (kit/i18n.js). Only the Music switch so far (2026-11-24); the rest of
// the game is still written in English in main.js and index.html.
import { words } from '../kit/i18n.js';

export const { t, lang, apply, setLang } = words({
  en: { musicOn: 'Music: on', musicOff: 'Music: off' },
  tr: { musicOn: 'Müzik: açık', musicOff: 'Müzik: kapalı' },
});
