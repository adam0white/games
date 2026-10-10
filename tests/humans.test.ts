import {
  begin,
  createPerson,
  decide,
  finish,
  relationshipWith,
  tick,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { askMumToHelp, shareTea } from '../src/game/humans';

it('shared tea causally changes ties, social need and Mum’s subsequent choice at matched elapsed time', () => {
  const mum = createPerson({
    id: 'mum',
    name: 'Mum',
    seed: 42,
    bornAt: -52 * 365 * 1440,
    sex: 'female',
    relationships: [{ otherId: 'player', roles: ['child'] }],
  });
  const player = createPerson({
    id: 'player',
    name: 'You',
    seed: 42,
    bornAt: -25 * 365 * 1440,
    sex: 'male',
  });
  const control = structuredClone(mum);
  shareTea(player, mum, 30);
  const neutral = {
    id: 'quiet-rest',
    action: 'rest',
    label: 'Sit quietly alone',
    duration: 30,
    effort: 0,
    focus: 0.05,
    advertises: { leisure: 0.1 },
  };
  begin(control, neutral, decide(control, [neutral]));
  tick(control, 30);
  finish(control, {
    affordanceId: neutral.id,
    action: neutral.action,
    at: 30,
    status: 'completed',
    summary: neutral.label,
    needs: { leisure: 0.1 },
  });
  expect(relationshipWith(mum, 'player').affection).toBeGreaterThan(
    relationshipWith(control, 'player').affection,
  );
  expect(askMumToHelp(control)).toBe(true);
  expect(askMumToHelp(mum)).toBe(false);
  expect(mum.now).toBe(control.now);
  const social = (p: typeof mum) =>
    p.trace
      .at(-1)
      ?.considered.find((x) => x.affordanceId === 'hold-light')
      ?.terms.find((x) => x.source === 'social:player')?.value;
  expect(social(mum)).toBeLessThan(social(control) ?? 0);
  expect(mum.trace.at(-1)?.chosenAffordanceId).toBe('read-chapter');
});
