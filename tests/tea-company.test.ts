import { begin, createPerson, decide, relationshipWith } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { shareTea, type TeaReport } from '../src/game/humans';

function pair() {
  const person = (id: string) =>
    createPerson({
      id,
      name: id,
      seed: 42,
      now: 840,
      bornAt: -30 * 365 * 1440,
      sex: 'female',
      relationships: [{ otherId: id === 'mum' ? 'player' : 'mum', roles: ['family'] }],
    });
  return { player: person('player'), mum: person('mum') };
}
function ownPlan(person: ReturnType<typeof createPerson>) {
  const offer = {
    id: 'own-plan',
    action: 'rest',
    label: 'Keep resting',
    duration: 120,
    effort: 0,
    advertises: { leisure: 0.9, autonomy: 0.9 },
  };
  begin(person, offer, decide(person, [offer]));
}
for (const participant of ['mum', 'player'] as const) {
  it(`reports real ${participant} continuation without completing or crediting shared company`, () => {
    const { player, mum } = pair();
    ownPlan(participant === 'mum' ? mum : player);
    const before = relationshipWith(mum, player.id).affection;
    const reports: TeaReport[] = [];
    expect(shareTea(player, mum, 870, (r) => reports.push(r))).toBe(false);
    expect(reports).toEqual([
      { kind: 'refused', participant, activity: 'Keep resting', elapsed: 0 },
    ]);
    expect(player.now).toBe(870);
    expect(mum.now).toBe(870);
    expect(relationshipWith(mum, player.id).affection).toBe(before);
    expect([player, mum].every((p) => p.activity?.affordanceId !== 'tea-together')).toBe(true);
  });
}
it('records honest successful company with two real HF choices and completed duration', () => {
  const { player, mum } = pair();
  const reports: TeaReport[] = [];
  expect(shareTea(player, mum, 870, (r) => reports.push(r))).toBe(true);
  expect(reports).toEqual([{ kind: 'joined', elapsed: 30 }]);
  for (const person of [player, mum]) {
    expect(person.trace.some((t) => t.chosenAffordanceId === 'tea-together')).toBe(true);
    expect(person.now).toBe(870);
    expect(person.activity).toBeNull();
  }
});
it('a physiological interruption cannot create a fictitious full completion', () => {
  const { player, mum } = pair();
  mum.body.health = 0.002;
  mum.body.hydration = 0;
  mum.body.satiety = 0;
  const reports: TeaReport[] = [];
  expect(shareTea(player, mum, 870, (r) => reports.push(r))).toBe(false);
  expect(reports[0]?.kind).toBe('shortened');
  expect(reports[0]?.elapsed).toBeGreaterThan(0);
  expect(reports[0]?.elapsed).toBeLessThan(30);
  expect(player.now).toBe(870);
  expect(mum.now).toBe(870);
});
