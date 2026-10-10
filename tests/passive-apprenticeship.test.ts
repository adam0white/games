import { promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import type { GameState } from '../src/game/types';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function fixture() {
  const s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  return s;
}
it('a newly due duty interrupts watching without granting the unwatched method', () => {
  const base = act(act(fixture(), 'arrange-learning'), 'mechanical-intake-stand');
  const absent = structuredClone(base);
  const sam = absent.people.sam;
  if (!sam) throw Error('Missing Sam');
  const duty = promise(sam, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: absent.now + 1,
    until: absent.now + 3,
    importance: 1,
    label: 'Prior short appointment',
  });
  const no = act(absent, 'inspect');
  const yes = act(base, 'inspect');
  expect(no.objects.find((o) => o.id === 'mechanical-stand')?.inspected).toBe(true);
  expect(no.people.sam?.methods?.rules ?? []).toHaveLength(0);
  expect(no.apprentice?.lastLesson).toBeUndefined();
  expect(no.people.sam?.agenda.commitments.find((c) => c.id === duty.id)?.status).toBe('kept');
  expect(yes.apprentice?.lastLesson?.learnedAutomatically).toBe(true);
  expect(act(yes, 'explain-step').people.sam?.methods?.rules).toEqual(
    yes.people.sam?.methods?.rules,
  );
});
it('a real watching session survives owner intake and learns the actual step without explain', () => {
  let s = act(fixture(), 'arrange-learning');
  const until = s.apprentice?.visitUntil;
  s = act(s, 'mechanical-intake-stand');
  expect(getView(s).workCompanion?.state).toBe('watching');
  expect(s.apprentice?.visitUntil).toBe(until);
  s = act(s, 'inspect');
  expect(s.apprentice?.lastLesson).toMatchObject({
    step: 'inspect',
    success: true,
    learnedAutomatically: true,
    explained: false,
  });
  expect(
    s.people.sam?.methods?.rules.some((r) =>
      r.conditions.some((c) => c.value === 'mechanical-intake'),
    ),
  ).toBe(true);
  const rules = structuredClone(s.people.sam?.methods?.rules);
  s = act(s, 'explain-step');
  expect(s.people.sam?.methods?.rules).toEqual(rules);
});
it('an unwatched light inspection grants no method while actual watched light inspection does', () => {
  for (const watching of [false, true]) {
    let s = fixture();
    s = act(s, 'arrange-learning');
    s = act(s, 'learning-light');
    if (!watching) {
      const p = s.people.sam;
      if (!p) throw Error('Missing Sam');
      p.activity = null;
    }
    s = act(s, 'inspect');
    expect(
      s.people.sam?.methods?.rules.some(
        (r) => r.action === 'inspect' && r.conditions.some((c) => c.value === 'intake'),
      ) ?? false,
    ).toBe(watching);
  }
});
it('a present companion whose watch stopped can genuinely be invited to join again', () => {
  let s = act(fixture(), 'arrange-learning');
  s = act(s, 'mechanical-intake-stand');
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  sam.activity = null;
  expect(getView(s).workCompanion?.state).toBe('present');
  expect(getView(s).actions.some((a) => a.id === 'arrange-learning')).toBe(true);
  s = act(s, 'arrange-learning');
  expect(getView(s).workCompanion?.state).not.toBe('present');
});
