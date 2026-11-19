import { expect, it } from 'vitest';
import { answer, dailyPlan, turnPrompt } from '../src/instrument/wai-core.ts';
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

// Shapes below are from the 2026-11-15 production run.
it('accepts a stop written as its own operation with an object report', () => {
  const got = answer(
    '{"op":{"op":"stop","name":"","reason":"FINISHED","reaction":"Chose Agreement 1."},"report":{"persona":"Maya Chen","stop_reason":"FINISHED"}}',
  );
  expect(got.op).toMatchObject({ op: 'log', kind: 'stop', reason: 'FINISHED', reaction: 'Chose Agreement 1.' });
  expect(JSON.parse(got.report ?? '')).toEqual({ persona: 'Maya Chen', stop_reason: 'FINISHED' });
});

it('keeps the operation when an appended report is cut off', () => {
  const got = answer('{"op":{"op":"tap","text":"disable {audio} \\"now\\""},"report":{"elapsed_minutes":0.18,"visible":"saved.\\nA Dark');
  expect(got.op).toEqual({ op: 'tap', text: 'disable {audio} "now"' });
  expect(got.report).toBeUndefined();
});

it('drops a report sent with an ordinary operation', () => {
  expect(answer('{"op":{"op":"tap","name":"Back"},"report":{"diary":[]}}').report).toBeUndefined();
});

it('still rejects a reply whose operation itself is cut off or absent', () => {
  expect(() => answer('{"op":{"op":"tap","name":"Back to the')).toThrow();
  expect(() => answer('I will tap Back.')).toThrow();
  expect(() => answer('{"op":{"op":"dance"}}')).toThrow();
});
