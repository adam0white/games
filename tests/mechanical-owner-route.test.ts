import { createHash } from 'node:crypto';
import { promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as old from '../src/game/engine18';
import type { GameInput, GameState } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
it('the actual 391-input owner can receive and teach the finite personal stand through public inputs', {
  timeout: 20000,
}, () => {
  let prior = old.createGame(owner.seed);
  for (const e of owner.inputs) prior = old.transition(prior, e.input as GameInput);
  const raw = old.serializeGame(prior);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(owner.sha256);
  let s = restoreGame(raw);
  for (let i = 0; i < 30 && !s.objects.some((o) => o.id === 'mechanical-stand'); i++) {
    const a = getView(s).actions;
    if (a.some((x) => x.id === 'mechanical-intake-stand')) s = act(s, 'mechanical-intake-stand');
    if (s.objects.some((o) => o.id === 'mechanical-stand')) break;
    const wait = getView(s).actions.find((x) => /Sam’s usual free time/.test(x.label));
    s = act(
      s,
      wait?.id ??
        (a.some((x) => x.id === 'wait-conversation-activity')
          ? 'wait-conversation-activity'
          : 'next-day'),
    );
  }
  expect(s.objects.some((o) => o.id === 'mechanical-stand')).toBe(true);
  s = act(s, 'arrange-learning');
  for (let i = 0; i < 20 && (!s.apprentice?.arranged || s.apprentice.visitUntil <= s.now); i++) {
    const a = getView(s).actions;
    if (a.some((x) => x.id === 'arrange-learning')) s = act(s, 'arrange-learning');
    if (s.apprentice?.arranged && s.apprentice.visitUntil > s.now) break;
    const wait = getView(s).actions.find((x) => /Sam’s usual free time/.test(x.label));
    s = act(s, wait?.id ?? 'next-day');
  }
  for (const id of [
    'inspect',
    'test-mechanical-empty',
    'test-mechanical-loaded',
    'open-access',
    'clear-obstruction',
    'reassemble',
    'check-result',
    'return',
  ]) {
    if (id === 'return') {
      expect(s.now % 1440).toBe(13 * 60 + 36);
      expect(s.people.sam?.activity?.affordanceId).toBe('learning-afternoon');
      const handedBack = act(s, 'return');
      expect(handedBack.now).toBeGreaterThan(s.now);
      expect(handedBack.objects.find((o) => o.id === 'mechanical-stand')).toMatchObject({
        location: 'returned',
      });
      expect(
        handedBack.objects.find((o) => o.id === 'mechanical-stand')?.awaitingCollection,
      ).not.toBe(true);
      expect(handedBack.apprentice?.lastLesson).toMatchObject({
        objectId: 'mechanical-stand',
        step: 'return',
        learnedAutomatically: true,
      });
      const interrupted = structuredClone(s);
      const sam = interrupted.people.sam;
      if (!sam) throw Error('Missing Sam');
      promise(sam, {
        kind: 'appointment',
        toId: 'mum',
        actions: ['check-in'],
        from: s.now - 20,
        until: s.now + 5,
        importance: 1,
        label: 'Previously agreed check-in',
      });
      const stopped = act(interrupted, 'return');
      expect(stopped.objects.find((o) => o.id === 'mechanical-stand')?.location).toBe('bench');
      expect(stopped.apprentice?.lastLesson?.step).not.toBe('return');
      // The alternative public route deliberately leaves collection unattended.
      s = act(s, 'leave-ready-mechanical-stand');
      expect(s.objects.find((o) => o.id === 'mechanical-stand')).toMatchObject({
        location: 'shelf',
        awaitingCollection: true,
        readyCollection: { ownerId: 'sam' },
      });
      expect(getView(s).actions.some((a) => a.id === 'mechanical-collect-mechanical-stand')).toBe(
        false,
      );
      break;
    }
    let done = false;
    for (let i = 0; i < 12 && !done; i++) {
      const before = s.objects.find((o) => o.id === 'mechanical-stand');
      s = act(s, id);
      const after = s.objects.find((o) => o.id === 'mechanical-stand');
      done = JSON.stringify(before) !== JSON.stringify(after);
      if (!done)
        s = act(
          s,
          getView(s).actions.some((a) => a.id === 'wait-conversation-activity')
            ? 'wait-conversation-activity'
            : 'rest',
        );
    }
    expect(done, id).toBe(true);
    if (id === 'return' && s.objects.find((o) => o.id === 'mechanical-stand')?.awaitingCollection)
      break;
    expect(
      getView(s).actions.some((a) => a.id === 'explain-step'),
      id +
        JSON.stringify({
          a: s.apprentice,
          activity: s.people.sam?.activity,
          now: s.now,
          lines: s.conversation,
        }),
    ).toBe(true);
    expect(s.apprentice?.lastLesson).toMatchObject({
      objectId: 'mechanical-stand',
      step: id,
      learnedAutomatically: true,
    });
  }
  for (
    let i = 0;
    i < 60 && s.objects.find((o) => o.id === 'mechanical-stand')?.awaitingCollection;
    i++
  ) {
    if (s.objects.find((o) => o.id === 'mechanical-stand')?.awaitingCollection)
      s = act(
        s,
        getView(s).actions.some((a) => a.id === 'wait-conversation-activity')
          ? 'wait-conversation-activity'
          : 'wait-person',
      );
  }
  expect(s.objects.find((o) => o.id === 'mechanical-stand')).toMatchObject({
    location: 'returned',
    verified: true,
    awaitingCollection: false,
  });
  expect(
    s.inputs.slice(391).filter((e) => e.input.type === 'action' && e.input.id === 'explain-step'),
  ).toHaveLength(0);
  expect(
    s.people.sam?.methods?.rules.filter((r) =>
      r.conditions.some((c) => String(c.value).startsWith('mechanical-')),
    ),
  ).toHaveLength(7);
  // The owner collected later: that unwitnessed handover is not a demonstrated method.
  expect(s.apprentice?.lastLesson?.step).toBe('check-result');
  expect(
    s.people.sam?.methods?.rules.some(
      (r) =>
        r.action === 'return' &&
        r.conditions.some((c) => String(c.value).startsWith('mechanical-')),
    ),
  ).toBe(false);
  expect(s.engine3Save).toBe(raw);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
