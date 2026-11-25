// Paper Boat's words in the player's language (kit/i18n.js). Only the Music switch (2026-11-24) is here: the rest of the
// game is still written in English in main.js and index.html, so the page stays lang="en" and the switch carries its own lang.
import { words } from '../kit/i18n.js';

export const tables = {
  en: {
    musicOn: 'Music: on',
    musicOff: 'Music: off',
  },
  tr: {
    musicOn: 'Müzik: açık',
    musicOff: 'Müzik: kapalı',
  },
};

export const { t, lang } = words(tables);
document.documentElement.lang = 'en';
