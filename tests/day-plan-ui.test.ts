import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { DayPlan } from '../src/ui/DayPlan';

it('keeps a current collection visible ahead of an ended bench arrangement without losing its renewal', () => {
  const markup = renderToStaticMarkup(
    createElement(DayPlan, {
      entries: [
        {
          id: 'sam-work',
          label: 'Earlier bench stretch',
          detail: 'The agreed stretch ended.',
          status: 'late',
          actionIds: ['renew'],
        },
        {
          id: 'collection',
          label: 'Tomorrow’s collection',
          detail: 'Agreed for tomorrow.',
          status: 'agreed',
          actionIds: ['wait'],
        },
      ],
      actions: [
        { id: 'renew', label: 'Ask about another stretch' },
        { id: 'wait', label: 'Wait for the collection' },
      ],
      renderAction: (action) =>
        createElement('button', { type: 'button', key: action.id }, action.label),
    }),
  );
  expect(markup.indexOf('Tomorrow’s collection')).toBeLessThan(markup.indexOf('<details'));
  expect(markup.indexOf('Ask about another stretch')).toBeGreaterThan(
    markup.indexOf('Previous arrangements'),
  );
  expect(markup.match(/Wait for the collection/g)).toHaveLength(1);
});
