// The crew lines of the HUD, from host.stats(): painter.js draws them a few times a second. Kept apart from the page so
// Node tests can read them. `t` is WORDS.t, `num` formats a count; `spider` and `kills` are the sim's spider globals.
import { SPIDER } from './sim/spider.js';

export function crewLines(stats, { t, num = v => String(v), spider = 0, kills = 0 }) {
  const c = stats.colony, lines = [];
  const newest = stats.trails.find(tr => tr.newest);
  stats.trails.slice().sort((a, b) => b.seq - a.seq).forEach((tr, k) => {
    if (k > 1) return;
    const why = tr.why ? t('why_' + tr.why) : '';
    lines.push(`${t('trailCrew', { n: stats.trails.length - k, crew: tr.on })}${why ? ` <small>· ${why}</small>` : ''}`);
  });
  const food = stats.piles.reduce((a, p) => a + p.crew, 0);
  if (food) lines.push(t('foodCrew', { crew: food }));
  if (stats.dig.marked) lines.push(`${t('digCrew', stats.dig)}${stats.dig.crew >= stats.dig.cap ? ` <small>· ${t('digFull')}</small>` : ''}`);
  if (stats.alarm) lines.push(t('alarmCrew', stats.alarm));
  if (spider === SPIDER.WARN || spider === SPIDER.HUNT) lines.unshift(`<b class="spider">${t('spiderHud', { what: t(spider === SPIDER.WARN ? 'spiderComing' : 'spiderHunting'), kills })}</b>`);
  if (c && stats.resting) lines.push(t('freeCount', { n: num(stats.resting) }));
  if (stats.jammed) lines.unshift(`<b class="spider">${t('jamHud', { n: num(stats.queued) })}</b>`); // sim 10: only when a jam really happens
  if (lines.length && newest && !c) lines.push(`<small>${t('noWanted')}</small>`);
  return lines;
}
