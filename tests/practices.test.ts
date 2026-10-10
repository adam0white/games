import { begin, createPerson, decide, finish, tick } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import {
  agreeCheckedCollection,
  humanProfile,
  promisedRepairOffers,
  quietPracticeOffers,
  renegotiateCollection,
} from '../src/game/practices';

function mum() {
  return createPerson({
    id: 'mum',
    name: 'Mum',
    seed: 42,
    now: 930,
    bornAt: -52 * 365 * 1440,
    sex: 'female',
    ...humanProfile('mum', 930),
  });
}
it('prayer is a timed public HF activity in its sourced window, with no repair or income reward', () => {
  const p = mum();
  const offers = quietPracticeOffers(p, true);
  expect(quietPracticeOffers(p, false)).toEqual([]);
  const decision = decide(p, offers);
  const selected = offers.find((o) => o.id === decision.chosenAffordanceId);
  if (!selected) throw Error('No quiet choice');
  expect(selected.action).toBe('pray');
  expect(selected.advertises).toEqual({});
  const c = p.agenda.commitments.find((c) => selected.fulfills?.includes(c.id));
  begin(p, selected, decision);
  tick(p, p.now + selected.duration);
  finish(p, {
    affordanceId: selected.id,
    action: selected.action,
    at: p.now,
    status: 'completed',
    summary: selected.label,
  });
  expect(c?.status).toBe('kept');
  expect(quietPracticeOffers(p, true).some((o) => o.id === 'quiet-prayer')).toBe(false);
  expect(p.skills.repair).toBeUndefined();
});
it('the same honest/false offers produce an actual conscience veto only with the held norm', () => {
  const p = mum(),
    withheld = structuredClone(p);
  withheld.conscience.norms = [];
  const offers = promisedRepairOffers(p, 'lamp', 'nora');
  const conviction = decide(p, offers),
    none = decide(withheld, offers);
  expect(conviction.chosenAffordanceId).toBe('honest-update');
  expect(none.chosenAffordanceId).toBe('overclaim-ready');
  expect(
    conviction.considered.find((c) => c.affordanceId === 'overclaim-ready')?.vetoed?.kind,
  ).toBe('willNot');
});
it('a competing bodily need can change the quiet activity chosen without changing prayer offers', () => {
  const p = mum(),
    hungry = structuredClone(p);
  hungry.body.satiety = 0.01;
  const offers = [
    ...quietPracticeOffers(p, true),
    { id: 'meal', action: 'eat', label: 'Eat', duration: 8, effort: 0, advertises: { food: 0.8 } },
  ];
  expect(decide(p, offers).chosenAffordanceId).toBe('quiet-prayer');
  expect(decide(hungry, offers).chosenAffordanceId).toBe('meal');
});
it('an explicit checked collection promise has object-specific actions and an agreed renegotiation releases the old one', () => {
  const p = mum();
  const first = agreeCheckedCollection(p, 'lamp', 'nora', 1000);
  expect(agreeCheckedCollection(p, 'lamp', 'nora', 1000).id).toBe(first.id);
  const next = renegotiateCollection(p, 'lamp', 'nora', 1500);
  expect(first.status).toBe('released');
  expect(next.actions).toEqual(['deliver:lamp']);
  expect(next.until).toBe(1500);
});
