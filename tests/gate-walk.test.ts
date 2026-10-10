import { createHash } from 'node:crypto';
import { promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as eighteen from '../src/game/engine18';
import type { GameInput, GameState } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function fixture(torch = false) {
  const s = createGame(77);
  s.unlocked.push('met-sam');
  if (torch)
    s.objects.push({
      id: 'friend-1',
      title: 'Sam’s pocket torch',
      owner: 'Sam',
      story: 'Red parcel-string loop',
      form: 'torch',
      fault: 'cap',
      location: 'returned',
      observations: [],
      inspected: true,
      tested: true,
      attempted: 1,
      repaired: true,
      verified: true,
      discovered: true,
    });
  return s;
}
it('a real single shared invitation permits useful torch handling, a received preference, and safe return without a lesson or dog-walk fulfilment', () => {
  let s = fixture(true);
  const focus = s.focusId,
    before = s.now;
  const teaching = JSON.stringify(s.apprentice);
  const dogDuty = s.people.sam?.agenda.commitments.find((c) => c.actions.includes('walk'));
  expect(getView(s).actions.some((a) => a.id === 'gate-walk-join')).toBe(true);
  s = act(s, 'gate-walk-join');
  expect(s.gateWalk?.stage).toBe('gate');
  expect(s.now).toBe(before + 3);
  expect(getView(s).gateWalk?.samWithPlayer).toBe(true);
  expect(getView(s).gateWalk?.torchObject?.id).toBe('friend-1');
  expect(getView(s).actions.every((a) => a.id.startsWith('gate-walk-'))).toBe(true);
  expect(() => transition(s, { type: 'select', id: 'family' })).toThrow();
  const activity = s.people.sam?.activity?.endsAt;
  s = act(s, 'gate-walk-hang');
  expect(s.gateWalk?.handling).toBe('hanging');
  expect(s.people.sam?.activity?.endsAt).toBe(activity);
  s = act(s, 'gate-walk-quiet');
  expect(s.gateWalk?.preference).toBe('quiet');
  s = act(s, 'gate-walk-return');
  expect(s.now).toBe(before + 10);
  expect(s.focusId).toBe(focus);
  expect(s.objects.find((o) => o.id === 'friend-1')?.location).toBe('returned');
  expect(JSON.stringify(s.apprentice)).toBe(teaching);
  expect(s.people.sam?.agenda.commitments.find((c) => c.id === dogDuty?.id)?.status).toBe(
    dogDuty?.status,
  );
  expect(getView(s).actions.some((a) => a.id === 'gate-walk-join')).toBe(false);
});
it('skipped or still-held torch uses daylight and grants no replacement, movement or repair', () => {
  let s = fixture(true);
  const torch = s.objects.find((o) => o.id === 'friend-1');
  if (!torch) throw Error('fixture');
  torch.location = 'shelf';
  torch.verified = false;
  const before = structuredClone(torch);
  s = act(s, 'gate-walk-join');
  expect(s.gateWalk?.light).toBe('daylight');
  expect(getView(s).gateWalk?.torchObject).toBeUndefined();
  expect(getView(s).actions.some((a) => a.id === 'gate-walk-hang')).toBe(false);
  s = act(s, 'gate-walk-hold-gate');
  s = act(s, 'gate-walk-return');
  expect(s.objects.find((o) => o.id === 'friend-1')).toEqual(before);
});
it('a newly due Sam appointment interrupts before the practical result, with no received preference or trapped exit', () => {
  let s = act(fixture(true), 'gate-walk-join');
  const sam = s.people.sam;
  if (!sam) throw Error('Sam');
  const duty = promise(sam, {
    kind: 'appointment',
    toId: 'self',
    actions: ['attend'],
    from: s.now + 1,
    until: s.now + 20,
    importance: 1,
    label: 'Keep the promised visit',
  });
  s = act(s, 'gate-walk-hang');
  expect(s.gateWalk?.handling).toBeUndefined();
  expect(s.gateWalk?.preference).toBeUndefined();
  expect(getView(s).gateWalk?.samWithPlayer).toBe(false);
  expect(getView(s).actions.map((a) => a.id)).toEqual(['gate-walk-return']);
  expect(s.people.sam?.activity?.affordance.fulfills).toContain(duty.id);
  s = act(s, 'gate-walk-return');
  expect(s.objects.find((o) => o.id === 'friend-1')?.location).toBe('returned');
  expect(s.gateWalk?.stage).toBe('home');
});
it('an already due actual obligation can refuse the invitation without moving property or replacing the obligation', () => {
  let s = fixture(true);
  const sam = s.people.sam;
  if (!sam) throw Error('Sam');
  const duty = promise(sam, {
    kind: 'appointment',
    toId: 'self',
    actions: ['attend'],
    from: s.now,
    until: s.now + 30,
    importance: 1,
    label: 'Promised visit',
  });
  const now = s.now;
  s = act(s, 'gate-walk-join');
  expect(s.gateWalk).toBeUndefined();
  expect(s.now).toBe(now);
  expect(s.people.sam?.agenda.commitments.find((c) => c.id === duty.id)?.status).toBe('pending');
  expect(s.objects.find((o) => o.id === 'friend-1')?.location).toBe('returned');
});

it('an actual native owner history reaches the outing through visible actions and replays its new scene exactly', {
  timeout: 30000,
}, () => {
  let old = eighteen.createGame(owner.seed);
  for (const entry of owner.inputs) old = eighteen.transition(old, entry.input as GameInput);
  const raw = eighteen.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(owner.sha256);
  let s = restoreGame(raw);
  for (let n = 0; n < 40 && !getView(s).actions.some((a) => a.id === 'gate-walk-join'); n++) {
    const actions = getView(s).actions;
    const next = ['wait-person', 'wait-conversation-activity', 'rest', 'next-day'].find((id) =>
      actions.some((a) => a.id === id),
    );
    if (!next) throw Error('No ordinary progress');
    s = act(s, next);
  }
  expect(getView(s).actions.some((a) => a.id === 'gate-walk-join')).toBe(true);
  const origins = s.objects.map((o) => [o.id, o.location]);
  s = act(s, 'gate-walk-join');
  expect(s.gateWalk?.stage).toBe('gate');
  const option = getView(s).actions.find(
    (a) => a.id === 'gate-walk-hang' || a.id === 'gate-walk-hold-gate',
  );
  if (!option) throw Error('Shared scene has no physical choice');
  s = act(s, option.id);
  expect(s.gateWalk?.handling).toBeDefined();
  s = act(s, 'gate-walk-watch');
  s = act(s, 'gate-walk-return');
  expect(s.objects.map((o) => [o.id, o.location])).toEqual(origins);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
