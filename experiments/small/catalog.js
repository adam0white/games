// The small games the home at /small/ shows, in deck order. This is the one place that knows where each game lives:
// when a game moves (for example from /lab/night-bells/ to /night-bells/), change its href here and nothing else.
// slug: the game's folder name. It is also its recording name in kit/lab.js and the key in the home's own saves
// (hub:opened, hub:results, hub:c:night), so it never changes, even when the address does.
// name, line: { en, tr }; a name with no tr is the game's own English title. time: [words key, minutes].
// kind: quick, think or calm, the three stops of "Three tonight". tr: true when the game itself plays in Turkish.
const g = (slug, href, name, line, time, kind, extra = {}) => ({ slug, href, name, line, time, kind, ...extra });
export const SMALL = [
  g('night-bells', '/lab/night-bells/', { en: 'Night Bells', tr: 'Gece Çanları' }, { en: 'Tap each bell at the top of its swing to light the village.', tr: 'Her çanı salınımının en tepesinde vur, köyün ışıkları yansın.' }, ['minLevel', 1], 'quick', { tr: true }),
  g('wild-pour', '/lab/wild-pour/', { en: 'Pour' }, { en: 'Tip a jug of real drops and fill the glass to the line.', tr: 'Gerçek damlalarla dolu sürahiyi eğ, bardağı çizgiye kadar doldur.' }, ['minLevel', 1], 'quick'),
  g('night-podwire', '/lab/night-podwire/', { en: 'Podwire' }, { en: 'Pull the string and let go. The wave splits the seed pods.', tr: 'Teli çek ve bırak. Dalga tohum keselerini patlatır.' }, ['minLevel', 1], 'quick', { tr: true }),
  g('wild2-face-shift', '/lab/wild2-face-shift/', { en: 'Face Shift' }, { en: 'Stretch a rubber face until it matches the portrait.', tr: 'Lastik yüzü portreye benzeyene kadar esnet.' }, ['minRound', 2], 'quick'),
  g('night-channels', '/lab/night-channels/', { en: 'Channels', tr: 'Kanallar' }, { en: 'Dig with your thumb so the spring reaches the seedbeds.', tr: 'Kaynak suyu tohum yataklarına ulaşsın diye parmağınla kanal kaz.' }, ['minLevel', 2], 'think', { tr: true }),
  g('night-sand', '/lab/night-sand/', { en: 'Night Sand', tr: 'Gece Kumu' }, { en: 'Dig, pour and sift thousands of grains of sand.', tr: 'Binlerce kum tanesini kaz, dök, ele.' }, ['minLevel', 1], 'think', { tr: true }),
  g('night-splitlight', '/lab/night-splitlight/', { en: 'Splitlight' }, { en: 'Turn the glass so each colour finds its receiver.', tr: 'Camı çevir, her renk kendi alıcısını bulsun.' }, ['minLevel', 1], 'think'),
  g('ring', '/lab/ring/', { en: 'Firefly Ring', tr: 'Ateş Böceği Halkası' }, { en: 'Draw a ring around fireflies of one colour.', tr: 'Aynı renkteki ateş böceklerinin çevresine halka çiz.' }, ['minLevel', 1], 'think', { tr: true }),
  g('pitch', '/lab/pitch/', { en: 'Paper Pitch', tr: 'Kâğıt Futbolu' }, { en: 'The old pencil game: draw the ball into the goal.', tr: 'Eski kalem oyunu: topu kaleye çiz.' }, ['minMatch', 3], 'think', { tr: true, friend: 'byLink' }),
  g('night-saltplate', '/lab/night-saltplate/', { en: 'Saltplate', tr: 'Tuz Levha' }, { en: 'Tune a ringing plate until the salt draws the engraving.', tr: 'Çınlayan levhayı akort et, tuz oymadaki deseni çizsin.' }, ['minLevel', 1], 'calm', { tr: true }),
  g('night-rubbing', '/lab/night-rubbing/', { en: 'Carbon Cabinet' }, { en: 'Rub graphite over a fossil and bring out its ridges.', tr: 'Fosilin üstüne grafit sür, kabartmalarını ortaya çıkar.' }, ['minLevel', 1], 'calm'),
  g('thankful', '/lab/thankful/', { en: 'Thankful Garden', tr: 'Teşekkür Bahçesi' }, { en: 'Three thanks a day. Each one grows a flower in your garden.', tr: 'Günde üç teşekkür. Her biri bahçende bir çiçek açtırır.' }, ['minDay', 1], 'calm', { tr: true }),
];
