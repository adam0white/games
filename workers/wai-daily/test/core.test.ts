import { expect, it } from 'vitest';
import { dailyPlan, turnPrompt } from '../src/instrument/wai-core.ts';
import { CEILINGS } from '../src/run.ts';

const session = dailyPlan(new Date('2026-11-14T22:00:00Z'), CEILINGS)[0];
if (!session) throw new Error('no session');

it('tells the model to tap visible words when a page has no named controls', () => {
  const bare = JSON.parse(turnPrompt(0, session, false, { visible: 'light fire', controls: '- text: light fire' }));
  expect(bare.actionableNames).toEqual([]);
  expect(bare.instruction).toContain('"text":"EXACT VISIBLE WORDS"');
  const named = JSON.parse(turnPrompt(0, session, false, { visible: 'Begin', controls: '- button "Begin"' }));
  expect(named.actionableNames).toEqual([{ role: 'button', name: 'Begin' }]);
  expect(named.instruction).not.toContain('EXACT VISIBLE WORDS');
});
