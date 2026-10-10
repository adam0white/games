import { createHash } from 'node:crypto';
import { beforeAll, expect, it } from 'vitest';
import * as current from '../src/game/engine';
import * as eighteen from '../src/game/engine18';
import type { GameInput, GameState } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';

let source: string;
beforeAll(() => {
  let s = eighteen.createGame(owner.seed);
  for (const entry of owner.inputs) {
    expect(s.now).toBe(entry.at);
    s = eighteen.transition(s, entry.input as GameInput);
  }
  source = eighteen.serializeGame(s);
  expect(createHash('sha256').update(source).digest('hex')).toBe(owner.sha256);
  expect(s.inputs).toHaveLength(owner.inputCount);
  expect(s.journal).toHaveLength(owner.journalCount);
});
const act = (s: GameState, id: string) => current.transition(s, { type: 'action', id });
function plan(s: GameState, id: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const before = JSON.stringify(s.serviceWeek);
    const next = act(s, id);
    if (JSON.stringify(next.serviceWeek) !== before) return next;
    s = next;
    const wait = current.getView(s).actions.some((a) => a.id === 'wait-conversation-activity')
      ? 'wait-conversation-activity'
      : 'rest';
    s = act(s, wait);
  }
  throw Error(`No actual agreement for ${id}`);
}
function withSam() {
  let s = current.restoreGame(source);
  for (let tries = 0; tries < 20; tries++) {
    const actions = current.getView(s).actions;
    if (actions.some((a) => a.id === 'arrange-learning')) s = act(s, 'arrange-learning');
    if (s.apprentice?.arranged && s.now < s.apprentice.visitUntil) {
      if (current.getView(s).actions.some((a) => a.id === 'recovery-learning-intake')) return s;
      s = act(s, 'rest');
      continue;
    }
    const wait = current.getView(s).actions.find((a) => /Sam’s usual free time/.test(a.label));
    s = act(s, wait?.id ?? 'next-day');
  }
  throw Error('Could not arrange a real recovery session');
}

it('preserves the actual exhausted native18 prefix before a current continuation', {
  timeout: 20000,
}, () => {
  const s = current.restoreGame(source);
  expect(s.engine3Save).toBe(source);
  expect(s.inputs).toHaveLength(391);
  expect(s.journal).toHaveLength(517);
  const next = act(s, 'rest');
  expect(next.engine3Save).toBe(source);
  expect(current.restoreGame(current.serializeGame(next))).toEqual(next);
});

it('offers adult customer work without a supervised or independent completion', () => {
  const s = current.restoreGame(source);
  expect(s.campaign?.graduated).toBe(true);
  expect(s.apprentice?.supervisedCompleted).toBe(false);
  expect(s.apprentice?.completedJobIds).toEqual([]);
  expect(current.getView(s).actions.some((a) => a.id === 'service-begin')).toBe(true);
  const next = plan(s, 'service-begin');
  expect(next.serviceWeek?.startedAt).toBeGreaterThanOrEqual(s.now);
  expect(next.conversation.map((line) => line.text).join(' ')).not.toContain(
    'Sam has carried a job',
  );
  expect(next.workshop?.cash).toBe(800);
  expect(next.apprentice?.completedJobIds).toEqual([]);
  expect(current.getView(next).actions.some((a) => a.id === 'service-regular')).toBe(true);
});

it('offers a real finite watched intake and preserves its unlearned inspection until explanation', () => {
  let s = withSam();
  const cash = s.workshop?.cash;
  const cells = s.parts.batteries;
  expect(current.getView(s).apprenticeship?.responsibility).toContain('examining');
  expect(current.getView(s).actions.some((a) => a.id === 'recovery-learning-intake')).toBe(true);
  expect(
    current.getView(s).dayPlan?.entries.find((entry) => entry.id === 'sam-work')?.actionIds,
  ).toContain('recovery-learning-intake');
  s = act(s, 'recovery-learning-intake');
  expect(s.objects.filter((o) => o.id === 'recovery-learning-light')).toHaveLength(1);
  expect(s.parts.batteries).toBe(cells + 1);
  expect(s.workshop?.cash).toBe(cash);
  expect(s.apprentice?.jobId).toBeUndefined();
  expect(() => act(s, 'recovery-learning-intake')).toThrow('not available');
  const rules = () => s.people.sam?.methods?.rules ?? [];
  expect(rules().some((r) => r.action === 'inspect')).toBe(false);
  s = act(s, 'inspect');
  expect(s.apprentice?.lastLesson).toMatchObject({
    step: 'inspect',
    cue: 'intake',
    explained: false,
  });
  expect(current.getView(s).actions.find((a) => a.id === 'explain-step')?.kind).toBe('primary');
  s = act(s, 'test-battery');
  expect(s.apprentice?.lastLesson?.step).toBe('inspect');
  s = act(s, 'explain-step');
  expect(
    rules().some((r) => r.action === 'inspect' && r.conditions.some((c) => c.value === 'intake')),
  ).toBe(true);
  expect(s.apprentice?.independentCompleted).toBe(0);
  expect(s.apprentice?.supervisedCompleted).toBe(false);
  expect(s.workshop?.cash).toBe(cash);
  expect(current.restoreGame(current.serializeGame(s))).toEqual(s);
});

it('taking over the recovery repair again neither farms a second intake nor blocks solo adult work', () => {
  let s = act(withSam(), 'recovery-learning-intake');
  const cash = s.workshop?.cash;
  const cells = s.parts.batteries;
  s = act(s, 'supervised-repair');
  expect(s.apprentice?.needsHelp).toBeTruthy();
  expect(s.people.sam?.methods?.rules.some((rule) => rule.action === 'inspect')).toBe(false);
  s = act(s, 'take-over-repair');
  for (const id of [
    'inspect',
    'clean-contact',
    'reassemble',
    'verify',
    'wait-check',
    'check-result',
    'return',
  ])
    s = act(s, id);
  expect(s.objects.find((o) => o.id === 'recovery-learning-light')).toMatchObject({
    location: 'returned',
    completedBy: 'player',
    independent: false,
  });
  expect(s.apprentice?.supervisedCompleted).toBe(false);
  expect(s.parts.batteries).toBe(cells);
  expect(s.workshop?.cash).toBe(cash);
  expect(current.getView(s).actions.some((a) => a.id === 'recovery-learning-intake')).toBe(false);
  expect(() => act(s, 'recovery-learning-intake')).toThrow('not available');
  for (
    let tries = 0;
    !current.getView(s).actions.some((a) => a.id === 'service-begin') && tries < 8;
    tries++
  )
    s = act(s, 'rest');
  s = act(s, 'service-begin');
  s = act(s, 'service-regular');
  expect(s.serviceWeek?.route).toBe('regular');
  expect(s.apprentice?.completedJobIds).toEqual([]);
  expect(s.workshop?.cash).toBe(cash);
});

it('the newly explained intake can support honest supervised completion without independent credit', () => {
  let s = act(withSam(), 'recovery-learning-intake');
  s = act(s, 'inspect');
  s = act(s, 'explain-step');
  s = act(s, 'supervised-repair');
  for (let count = 0; s.apprentice?.jobId && count < 12; count++) {
    const actions = current.getView(s).actions;
    if (actions.some((a) => a.id === 'arrange-learning')) s = act(s, 'arrange-learning');
    else s = act(s, 'watch-sam');
  }
  expect(s.objects.find((o) => o.id === 'recovery-learning-light')).toMatchObject({
    location: 'returned',
    verified: true,
    completedBy: 'sam',
    independent: false,
  });
  expect(s.apprentice?.supervisedCompleted).toBe(true);
  expect(s.apprentice?.completedJobIds).toEqual([]);
  expect(s.workshop?.cash).toBe(800);
});

it('the actual owner prefix reaches a paid loaded delivery using only disclosed visits and public inputs', {
  timeout: 20000,
}, () => {
  let s = current.restoreGame(source);
  for (const id of [
    'service-begin',
    'service-private',
    'service-next-day',
    'service-next-day',
    'service-next-day',
    'service-next-day',
    'service-close-small',
    'operations-begin',
    'operations-route-regular',
    'operations-hear-operations-trolley-first',
  ])
    s = ['service-begin', 'service-private', 'service-close-small'].includes(id)
      ? plan(s, id)
      : act(s, id);
  const take = (id: string) => {
    for (let tries = 0; !current.getView(s).actions.some((a) => a.id === id) && tries < 16; tries++)
      s = act(s, 'rest');
    s = act(s, id);
  };
  take('operations-request-operations-trolley-first');
  take('operations-accept-operations-trolley-first');
  for (const id of [
    'inspect',
    'test-trolley-unloaded',
    'test-trolley-loaded',
    'align-trolley-wheel',
    'check-trolley-route',
    'operations-plan-display',
    'operations-arrange-crates',
  ])
    take(id);
  take('operations-agree-crate-loan');
  take('operations-fetch-crates');
  take('operations-pack-crate');
  for (let tries = 0; !s.operations?.delivery && tries < 12; tries++) {
    take('operations-round-leila');
    if (!s.operations?.delivery) s = act(s, 'rest');
  }
  expect(s.operations?.delivery?.status).toBe('working');
  expect(s.operations?.crates.location).toBe('with-leila');
  expect(
    s.people.player?.agenda.commitments.find(
      (c) => c.label === 'Checked collection: operations-trolley-first',
    )?.status,
  ).toBe('released');
  s = act(s, 'rest');
  expect(s.operations?.delivery?.status).toBe('complete');
  expect(s.operations?.crates).toMatchObject({ count: 2, location: 'store' });
  expect(s.objects.find((o) => o.id === 'operations-trolley-first')).toMatchObject({
    location: 'returned',
    verified: true,
  });
  expect(s.workshop?.cash).toBe(1100);
  expect(s.engine3Save).toBe(source);
  expect(current.restoreGame(current.serializeGame(s))).toEqual(s);
});
