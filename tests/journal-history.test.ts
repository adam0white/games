import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { ConversationLine } from '../src/game/types';
import { JournalHistory } from '../src/ui/JournalHistory';

it('keeps repeated historical lines and their order without inventing time or object context', () => {
  const lines: ConversationLine[] = [
    { id: 12, speaker: 'Sam', text: 'It is still running.' },
    { id: 18, speaker: 'Sam', text: 'It is still running.' },
    { id: 19, speaker: 'You', text: 'Give it time.', tone: 'notice' },
    { id: 25, speaker: 'Sam', text: 'It is still running.' },
  ];
  const original = JSON.stringify(lines);
  const html = renderToStaticMarkup(createElement(JournalHistory, { lines }));
  expect(html.match(/It is still running\./g)).toHaveLength(3);
  expect(html.match(/journal-history-group"/g)).toHaveLength(3);
  expect(html.indexOf('Give it time.')).toBeGreaterThan(html.indexOf('It is still running.'));
  expect(html).toContain('start="4"');
  expect(html).toContain('Earlier recorded story');
  expect(html).not.toContain('<time');
  expect(JSON.stringify(lines)).toBe(original);
});

it('groups only adjacent matching recorded times, leaving legacy lines untimed and every repeat visible', () => {
  const lines = [
    { id: 0, speaker: 'You', text: 'Older entry.' },
    { id: 1, speaker: 'Sam', text: 'Still checking.', at: 840, timeLabel: 'Day 1 · 14:00' },
    { id: 2, speaker: 'You', text: 'Take your time.', at: 840, timeLabel: 'Day 1 · 14:00' },
    { id: 3, speaker: 'Sam', text: 'Still checking.', at: 860, timeLabel: 'Day 1 · 14:20' },
  ];
  const html = renderToStaticMarkup(createElement(JournalHistory, { lines }));
  expect(html.match(/Earlier recorded story/g)).toHaveLength(1);
  expect(html.match(/Day 1 · 14:00/g)).toHaveLength(1);
  expect(html.match(/Day 1 · 14:20/g)).toHaveLength(1);
  expect(html.match(/Still checking\./g)).toHaveLength(2);
  expect(html.indexOf('Older entry.')).toBeLessThan(html.indexOf('Day 1 · 14:00'));
  expect(html).toContain('start="4"');
});

it('does not invent entries for an empty history', () => {
  expect(renderToStaticMarkup(createElement(JournalHistory, { lines: [] }))).toBe('');
});
