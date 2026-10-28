import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MethodResponse } from '../src/components/MethodResponse';
import { createGame, dispatch, saveGame } from '../src/game/engine';

it('shows retained work and tests with a separate costed public response control', () => {
  let s = createGame(42);
  const id = s.selectedJobId;
  for (const c of [
    { type: 'work', jobId: id, componentId: 'switch', intervention: 'replace' },
    { type: 'verify', jobId: id, condition: 'movement' },
  ] as const) {
    const r = dispatch(s, c);
    expect(r.ok).toBe(true);
    s = r.state;
  }
  const before = saveGame(s);
  const html = renderToStaticMarkup(
    createElement(MethodResponse, { state: s, jobId: id, componentId: 'switch', act: () => {} }),
  );
  expect(html).toContain('Discuss this repair method');
  expect(html).toContain('replaced the switch');
  expect(html).toContain('five minutes, including a refusal');
  expect(saveGame(s)).toBe(before);
});
