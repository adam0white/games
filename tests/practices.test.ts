import {
  begin,
  createPerson,
  decide,
  finish,
  owedMakeUps,
  promise,
  skip,
  tick,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { liveOrdinaryTime } from '../src/game/humans';
import {
  agreeCheckedCollection,
  attestCheckedCollection,
  currentPrayerWindows,
  humanProfile,
  promisedRepairOffers,
  quietPracticeOffers,
  renegotiateCollection,
  resumePlayedPractice,
  suspendUnplayedPractice,
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

it('the opening afternoon retains all five recurrence chains including tomorrow’s Fajr', () => {
  const windows = currentPrayerWindows(840);
  expect(windows.map((c) => c.label)).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  expect(windows.find((c) => c.label === 'Fajr')?.from).toBe(1440 + 300);
});
it('a compressed school year creates no synthetic worship debt while played windows remain live', () => {
  const p = mum();
  const baseline = owedMakeUps(p).length;
  expect(suspendUnplayedPractice(p)).toBe(true);
  skip(p, p.now + 365 * 1440);
  expect(owedMakeUps(p)).toHaveLength(baseline);
  resumePlayedPractice(p);
  expect(quietPracticeOffers(p, true).some((o) => o.action === 'pray')).toBe(true);
  tick(p, p.now + 91);
  expect(
    owedMakeUps(p).length,
    JSON.stringify({ now: p.now, alive: p.body.alive, agenda: p.agenda }),
  ).toBeGreaterThan(baseline);
});
it('quiet prayer and reflection keep the same decisions and outcomes across time chunks', () => {
  const a = mum(),
    b = structuredClone(a);
  liveOrdinaryTime(a, 990);
  for (let until = 934; until < 990; until += 4) liveOrdinaryTime(b, until);
  liveOrdinaryTime(b, 990);
  expect(a.rng).toEqual(b.rng);
  expect(a.agenda).toEqual(b.agenda);
  expect(a.trace.at(-1)?.chosenAffordanceId).toBe(b.trace.at(-1)?.chosenAffordanceId);
  expect(a.affect.regulation).toBeCloseTo(b.affect.regulation, 10);
});
it('actual promised collection records a real HF social consequence once, and a changed deadline avoids a late breach', () => {
  const kept = mum(),
    late = structuredClone(kept);
  agreeCheckedCollection(kept, 'lamp', 'nora', 1000);
  agreeCheckedCollection(late, 'lamp', 'nora', 960);
  const before = structuredClone(kept.social.relationships);
  attestCheckedCollection(kept, 'lamp', 'nora', 970);
  expect(kept.social.relationships).not.toEqual(before);
  const once = structuredClone(kept.social.relationships);
  attestCheckedCollection(kept, 'lamp', 'nora', 970);
  expect(kept.social.relationships).toEqual(once);
  tick(late, 1020);
  expect(
    late.agenda.commitments.find((c) => c.label === 'Checked collection: lamp')?.status,
    JSON.stringify(late.agenda),
  ).toBe('broken');
  expect(kept.agenda.commitments.find((c) => c.label === 'Checked collection: lamp')?.status).toBe(
    'kept',
  );
});

it('counter commitment remains pending during its agreed four-hour shift', () => {
  const p = createPerson({
    id: 'sam',
    name: 'Sam',
    seed: 42,
    now: 780,
    bornAt: -19 * 365 * 1440,
    sex: 'male',
  });
  promise(p, {
    kind: 'job',
    label: 'Parts-counter shift',
    from: 780,
    until: 1020,
    actions: ['parts-counter'],
    importance: 0.9,
  });
  const offer = quietPracticeOffers(p, false)[0];
  if (!offer) throw Error('Missing duty');
  expect(offer.duration).toBe(240);
  begin(p, offer, decide(p, [offer]));
  liveOrdinaryTime(p, 810, false);
  expect(p.agenda.commitments.at(-1)?.status).toBe('pending');
  expect(p.activity?.action).toBe('parts-counter');
  liveOrdinaryTime(p, 1020, false);
  expect(p.agenda.commitments.at(-1)?.status).toBe('kept');
});

it('school compression after a completed prayer stops recurrence without rewriting its kept history', () => {
  const p = mum();
  const offer = quietPracticeOffers(p, true).find((o) => o.action === 'pray');
  if (!offer) throw Error('Missing prayer');
  begin(p, offer, decide(p, [offer]));
  tick(p, p.now + 8);
  finish(p, {
    affordanceId: offer.id,
    action: offer.action,
    at: p.now,
    status: 'completed',
    summary: offer.label,
  });
  const kept = p.agenda.commitments.find((c) => c.status === 'kept');
  if (!kept) throw Error('Missing kept prayer');
  const original = structuredClone(kept);
  const baseline = owedMakeUps(p).length;
  suspendUnplayedPractice(p);
  skip(p, p.now + 365 * 1440);
  expect(owedMakeUps(p)).toHaveLength(baseline);
  expect(p.agenda.commitments.find((c) => c.id === kept.id)).toEqual(original);
  resumePlayedPractice(p);
  expect(
    p.agenda.commitments.filter((c) => c.kind === 'worship' && c.status === 'pending'),
  ).toHaveLength(5);
});
