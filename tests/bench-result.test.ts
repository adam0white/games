import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/current-engine';
import { ObjectPresentation } from '../src/ui/ObjectPresentation';

it('keeps the one supplied live result in the labelled diagram and lazy-loading fallback', () => {
  const object = getView(transition(createGame(77), { type: 'action', id: 'talk-family' })).focus;
  if (!object) throw Error('Actual household object unavailable');
  const result = createElement(
    'div',
    { 'aria-live': 'polite', className: 'attention-channel' },
    'The actual received result',
  );
  for (const inHand of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(ObjectPresentation, { object, inHand, onViewChange: () => {}, result }),
    );
    expect(html.split('The actual received result')).toHaveLength(2);
    expect(html.match(/class="attention-channel"/g)).toHaveLength(1);
    expect(html).toContain('aria-live="polite"');
  }
});
