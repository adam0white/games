import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import type { GameState, RepairObject } from '../src/game/types';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function fixture(action: string) {
  const s = createGame(17);
  s.chapter = 'garage';
  const trolley = action !== 'replace-battery';
  const o: RepairObject = {
    id: 'physical-control',
    title: trolley ? 'Borrowed trolley' : 'Reading lamp',
    owner: 'Dad',
    story: 'Received object',
    form: trolley ? 'trolley' : 'lamp',
    fault: trolley ? 'trolley-alignment' : 'battery',
    location: 'bench',
    observations: [],
    inspected: true,
    tested: !trolley,
    attempted: 0,
    repaired: action === 'check-trolley-route',
    verified: false,
    discovered: true,
    ...(trolley
      ? {
          trolley: {
            permission: true,
            unloaded: true,
            loaded: ['align-trolley-wheel', 'check-trolley-route'].includes(action),
          },
          evidence: action === 'align-trolley-wheel' ? ['trolley-wanders' as const] : [],
        }
      : {}),
  };
  s.objects.push(o);
  s.focusId = o.id;
  s.parts.batteries = 1;
  expect(getView(s).actions.some((a) => a.id === action)).toBe(true);
  return s;
}
function stronger(s: GameState) {
  const p = s.people.player;
  if (!p) throw Error('Missing player');
  const c = promise(p, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 60,
    importance: 1,
    label: 'Promised check-in',
  });
  const a: Affordance = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'Promised check-in',
    duration: 60,
    effort: 0,
    advertises: { belonging: 0.3 },
    fulfills: [c.id],
  };
  begin(p, a, decide(p, [a]));
}
it.each([
  ['test-trolley-loaded', 8],
  ['align-trolley-wheel', 12],
  ['replace-battery', 12],
  ['check-trolley-route', 12],
] as const)(
  '%s requires the full attended interval, preserving evidence and parts on refusal or interruption',
  (id, minutes) => {
    const s = fixture(id),
      yes = act(s, id);
    expect(yes.now).toBe(s.now + minutes);
    expect(yes.objects).not.toEqual(s.objects);
    if (id === 'replace-battery') expect(yes.parts.batteries).toBe(0);
    const refused = structuredClone(s);
    stronger(refused);
    const no = act(refused, id);
    expect(no.now).toBe(refused.now);
    expect(no.objects).toEqual(refused.objects);
    expect(no.parts).toEqual(refused.parts);
    expect(no.people.player?.activity).toEqual(refused.people.player?.activity);
    const interrupted = structuredClone(s),
      p = interrupted.people.player;
    if (!p) throw Error('Missing player');
    promise(p, {
      kind: 'appointment',
      toId: 'mum',
      actions: ['check-in'],
      from: s.now + 2,
      until: s.now + 5,
      importance: 1,
      label: 'Received check-in',
    });
    const partial = act(interrupted, id);
    expect(partial.now).toBeGreaterThan(s.now);
    expect(partial.now).toBeLessThan(s.now + minutes);
    expect(partial.objects).toEqual(s.objects);
    expect(partial.parts).toEqual(s.parts);
  },
);

it('a checked handover needs both people’s attended time before custody changes', () => {
  const s = fixture('replace-battery');
  const item = s.objects[0];
  if (!item) throw Error('Missing item');
  item.repaired = true;
  item.verified = true;
  const yes = act(s, 'return');
  expect(yes.now).toBe(s.now + 4);
  expect(yes.objects[0]?.location).toBe('returned');
  for (const who of ['player', 'dad']) {
    const held = structuredClone(s);
    if (who === 'player') stronger(held);
    else {
      const dad = held.people.dad;
      if (!dad) throw Error('Missing Dad');
      const c = promise(dad, {
        kind: 'promise',
        toId: 'mum',
        actions: ['check-in'],
        from: held.now,
        until: held.now + 60,
        importance: 1,
        label: 'Promised check-in',
      });
      const offer: Affordance = {
        id: 'promised-check-in',
        action: 'check-in',
        label: 'Promised check-in',
        duration: 60,
        effort: 0,
        advertises: { belonging: 0.3 },
        fulfills: [c.id],
      };
      begin(dad, offer, decide(dad, [offer]));
    }
    const no = act(held, 'return');
    expect(no.now).toBe(held.now);
    expect(no.objects).toEqual(held.objects);
    expect(no.repairs).toBe(held.repairs);
    expect(no.workshop).toEqual(held.workshop);
    expect(no.people[who]?.activity).toEqual(held.people[who]?.activity);
  }
});

it('time for rest without Mum preserves a stronger ongoing activity instead of falsely completing it', () => {
  const s = fixture('replace-battery');
  if (!s.world) throw Error('Missing world');
  s.world.presence.mum = { awayUntil: s.now + 90, activity: 'An arranged visit' };
  const yes = act(s, 'rest');
  expect(yes.now).toBe(s.now + 30);
  expect(yes.people.player?.activity).toBeNull();
  const held = structuredClone(s);
  stronger(held);
  const no = act(held, 'rest');
  expect(no.now).toBe(held.now + 30);
  expect(no.people.player?.activity?.affordanceId).toBe('promised-check-in');
  expect(no.people.player?.activity?.endsAt).toBe(held.now + 60);
  expect(
    no.people.player?.agenda.commitments.find((c) => c.label === 'Promised check-in')?.status,
  ).toBe('pending');
  expect(no.humanNote).toContain('continued');
});
