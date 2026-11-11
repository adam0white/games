import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ObjectOwnerExchange } from '../src/components/ObjectOwnerExchange';
import { createGame, dispatch, saveGame } from '../src/game/engine';
import { chooseActivity, startActivity } from '../src/game/people';
import type { Command, GameState, WorkOption } from '../src/game/types';

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
  expect(markup).toContain('Asking costs five minutes');
  expect(markup).toContain('can refuse the');
  expect(markup).not.toContain('I agree only');
  expect(saveGame(s)).toBe(before);

  const owner = s.people.nora;
  if (!owner) throw Error('Missing Nora');
  owner.activity = null;
  s.npcWork = s.npcWork.filter((work) => work.personId !== owner.id);
  const option: WorkOption = {
    id: 'eat',
    action: 'eat',
    label: 'Have food and water',
    duration: 10,
    effort: 0,
  };
  expect(chooseActivity(owner, j.id, {}, [option], s.now).chosenId).toBe('eat');
  expect(startActivity(owner, option, s.now)).toBe(true);
  s.npcWork.push({ personId: owner.id, option, startedAt: s.now, endsAt: s.now + 10 });
  const busy = renderToStaticMarkup(
    createElement(ObjectOwnerExchange, {
      state: s,
      jobId: j.id,
      componentId: 'gear',
      act: () => {},
    }),
  );
  expect(busy).toContain('Have food and water');
  expect(busy).toContain('Wait for this activity to end');
  expect(busy).toContain('another commitment may follow');
  expect(busy).not.toContain('I agree only');

  s.npcWork = s.npcWork.filter((work) => work.personId !== owner.id);
  s.chapterPaused = true;
  const unknown = renderToStaticMarkup(
    createElement(ObjectOwnerExchange, {
      state: s,
      jobId: j.id,
      componentId: 'gear',
      act: () => {},
    }),
  );
  expect(unknown).toContain('next available time is not known');
  expect(unknown).not.toContain('Wait for this activity to end');
});
