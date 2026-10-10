import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { companionHeading, WorkCompanion } from '../src/ui/WorkCompanion';

it('distinguishes actual observation, independent work, presence and absence without invitation inference', () => {
  const headings = ['watching', 'working', 'present', 'away'].map((state) =>
    companionHeading({
      name: 'Sam',
      state: state as 'watching' | 'working' | 'present' | 'away',
      detail: 'Received current activity.',
    }),
  );
  expect(new Set(headings).size).toBe(4);
  expect(headings[2]).toContain('occupied elsewhere');
  expect(headings[3]).toContain('away');
  expect(renderToStaticMarkup(createElement(WorkCompanion, {}))).toBe('');
});
it('places actual activity and departure in one announced status without lesson buttons', () => {
  const html = renderToStaticMarkup(
    createElement(WorkCompanion, {
      companion: {
        name: 'Sam',
        state: 'away',
        detail: 'At the shop counter until one.',
        departure: 'Sam left after the empty-tray comparison.',
      },
    }),
  );
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('Sam left after the empty-tray comparison.');
  expect(html).not.toContain('<button');
  expect(html).not.toContain('watching your work');
});
