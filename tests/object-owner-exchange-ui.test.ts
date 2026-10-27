import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ObjectOwnerExchange } from '../src/components/ObjectOwnerExchange';
import { createGame, dispatch, saveGame } from '../src/game/engine';
import type { Command, GameState } from '../src/game/types';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
it('shows the held owner’s original request, received readings and costed proposal without granting permission by rendering', () => {
  let s = act(createGame(42), { type: 'next-day' });
  const j = s.jobs.find(
    (j) => j.ownerId === 'nora' && j.kind === 'music-box' && j.status === 'offer',
  );
  if (!j) throw Error('No keepsake');
  s = act(s, { type: 'accept', jobId: j.id });
  s = act(s, { type: 'inspect', jobId: j.id, componentId: 'gear' });
  s = act(s, { type: 'verify', jobId: j.id, condition: 'load' });
  const before = saveGame(s);
  const markup = renderToStaticMarkup(
    createElement(ObjectOwnerExchange, {
      state: s,
      jobId: j.id,
      componentId: 'gear',
      act: () => {},
    }),
  );
  expect(markup).toContain('Ask Nora about this gear');
  expect(markup).toContain('I do not want new parts');
  expect(markup).toContain('The outside looks intact');
  expect(markup).toContain('five minutes, including a refusal');
  expect(markup).toContain('keep the original parts');
  expect(markup).not.toContain('I agree only');
  expect(saveGame(s)).toBe(before);
});
