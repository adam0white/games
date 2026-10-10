import { expect, it } from 'vitest';
import {
  applyServiceWeekAction,
  completeServiceWeekJob,
  freshServiceWeek,
  getServiceWeekView,
  type ServiceWeekContext,
  type ServiceWeekGame,
  serviceWeekActions,
} from '../src/game/service-week';
import { freshWorkshop, recordWorkshopEntry } from '../src/game/workshop';

const context: ServiceWeekContext = {
  independentHandoff: true,
  graduated: true,
  samHere: true,
  dadHere: true,
  ownerHere: () => true,
  paperStreetWaiting: true,
  samWillAgree: () => true,
};
function fixture(route: 'regular' | 'favours' | 'private' = 'regular'): ServiceWeekGame {
  const s: ServiceWeekGame = {
    now: 840,
    workshop: freshWorkshop(),
    serviceWeek: freshServiceWeek(),
  };
  applyServiceWeekAction(s, 'service-begin', context);
  applyServiceWeekAction(s, `service-${route}`, context);
  return s;
}
function action(s: ServiceWeekGame, id: string) {
  const r = applyServiceWeekAction(s, id, context);
  expect(r).not.toBeNull();
  return r;
}
it('offers solo adult work without an apprentice handoff, but keeps school separate', () => {
  expect(
    serviceWeekActions({ now: 840 }, { ...context, independentHandoff: false }).map((a) => a.id),
  ).toEqual(['service-invite-donor', 'service-begin']);
  expect(
    serviceWeekActions({ now: 840 }, { ...context, graduated: false }).map((a) => a.id),
  ).toEqual(['service-invite-donor']);
});
it('offers one deliberate quiet-week passage only when the private bench has no outstanding work', () => {
  const s = fixture('private');
  const permitted = { ...context, safeToPassQuietWeek: true };
  const before = structuredClone(s);
  const passage = applyServiceWeekAction(s, 'service-quiet-week', permitted);
  expect(passage?.nextDayAt).toBe(4 * 1440 + 540);
  expect(s).toEqual(before);
  expect(
    serviceWeekActions(s, { ...permitted, safeToPassQuietWeek: false }).map((a) => a.id),
  ).not.toContain('service-quiet-week');
  expect(serviceWeekActions(fixture('regular'), permitted).map((a) => a.id)).not.toContain(
    'service-quiet-week',
  );
  s.serviceWeek?.jobs.push({
    id: 'service-leila',
    stage: 'accepted',
    collectionAt: 2000,
    fee: 500,
    samFee: 0,
    delayed: false,
  });
  expect(serviceWeekActions(s, permitted).map((a) => a.id)).not.toContain('service-quiet-week');
});
it('a heard request makes neither a promise nor an object; acceptance uses an absolute deadline', () => {
  const s = fixture();
  const heard = action(s, 'service-hear-leila');
  expect(heard?.job).toBeUndefined();
  expect(heard?.promise).toBeUndefined();
  expect(s.serviceWeek?.jobs[0]?.stage).toBe('offered');
  const accepted = action(s, 'service-accept-leila');
  expect(accepted?.promise).toEqual({
    ownerId: 'leila',
    objectId: 'service-leila',
    collectionAt: 1440 + 1080 + 15,
  });
  expect(s.workshop?.cash).toBe(0);
  s.now = 1440 + 1080 + 16;
  expect(getServiceWeekView(s)?.arrangements[0]).toContain('agreed time has passed');
  const later = action(s, 'service-delay-leila');
  expect(later?.promise?.collectionAt).toBe(3 * 1440 + 1080 + 15);
  expect(later?.job).toBeUndefined();
});
it('the same request can be declined or agreed later without an invented overdue promise', () => {
  const declined = fixture();
  action(declined, 'service-hear-leila');
  expect(action(declined, 'service-decline-leila')?.promise).toBeUndefined();
  expect(declined.serviceWeek?.jobs[0]?.stage).toBe('declined');
  const later = fixture();
  action(later, 'service-hear-leila');
  later.now = 2 * 1440 + 900;
  expect(serviceWeekActions(later, context).some((a) => a.id === 'service-accept-leila')).toBe(
    false,
  );
  expect(action(later, 'service-later-leila')?.promise?.collectionAt).toBe(3 * 1440 + 1080 + 15);
});
it('a paid checked return conserves cash and pays only actually agreed whole-job work, once', () => {
  const s = fixture();
  action(s, 'service-paid-help');
  action(s, 'service-hear-leila');
  action(s, 'service-accept-leila');
  expect(
    completeServiceWeekJob(s, 'service-leila', {
      verified: false,
      independent: true,
      at: 2000,
      samFee: 200,
    }),
  ).toEqual([]);
  expect(s.workshop?.cash).toBe(0);
  completeServiceWeekJob(s, 'service-leila', {
    verified: true,
    independent: true,
    at: 2500,
    samFee: 200,
  });
  expect(s.workshop?.cash).toBe(300);
  expect(s.workshop?.ledger.map((e) => e.amount)).toEqual([500, -200]);
  expect(
    completeServiceWeekJob(s, 'service-leila', {
      verified: true,
      independent: true,
      at: 2501,
      samFee: 200,
    }),
  ).toEqual([]);
  const assisted = fixture();
  action(assisted, 'service-hear-leila');
  action(assisted, 'service-accept-leila');
  completeServiceWeekJob(assisted, 'service-leila', {
    verified: true,
    independent: false,
    at: 2500,
    samFee: 200,
  });
  expect(assisted.workshop?.cash).toBe(500);
});
it('a second checking place consumes exactly earned money once and private/favours remain fund-free', () => {
  const s = fixture();
  expect(applyServiceWeekAction(s, 'service-checking-place', context)).toBeNull();
  if (!s.workshop) throw Error('missing workshop');
  recordWorkshopEntry(s.workshop, {
    id: 'existing:earned',
    at: 100,
    amount: 700,
    kind: 'repair-fee',
    jobId: 'existing',
  });
  expect(action(s, 'service-checking-place')?.checkingPlaces).toBe(2);
  expect(s.workshop.cash).toBe(100);
  expect(s.workshop.ledger.at(-1)?.amount).toBe(-600);
  expect(applyServiceWeekAction(s, 'service-checking-place', context)).toBeNull();
  const favour = fixture('favours');
  action(favour, 'service-hear-leila');
  action(favour, 'service-accept-leila');
  completeServiceWeekJob(favour, 'service-leila', {
    verified: true,
    independent: true,
    at: 2500,
    samFee: 200,
  });
  expect(favour.workshop?.ledger).toEqual([]);
});
it('personal work consumes real time and donor gear requires measured compatibility and the owner', () => {
  const s = fixture('private');
  action(s, 'service-protect-session');
  s.now = 2 * 1440 + 840;
  expect(action(s, 'service-personal-session')?.minutes).toBe(45);
  expect(applyServiceWeekAction(s, 'service-personal-session', context)).toBeNull();
  action(s, 'service-invite-donor');
  s.now = s.serviceWeek?.donorAt ?? s.now;
  expect(action(s, 'service-hear-donor')?.recoveredPart).toBeUndefined();
  expect(applyServiceWeekAction(s, 'service-recover-donor', context)).toBeNull();
  expect(action(s, 'service-measure-donor')?.minutes).toBe(20);
  expect(
    applyServiceWeekAction(s, 'service-recover-donor', { ...context, ownerHere: () => false }),
  ).toBeNull();
  const recovered = action(s, 'service-recover-donor');
  expect(recovered?.minutes).toBe(40);
  expect(recovered?.recoveredPart).toEqual({
    kind: 'gears',
    count: 1,
    source: 'Evan’s measured shop-display base',
  });
  expect(applyServiceWeekAction(s, 'service-recover-donor', context)).toBeNull();
});
it('trial direction is reversible while accepted commitments retain their original terms', () => {
  const s = fixture();
  action(s, 'service-hear-leila');
  action(s, 'service-accept-leila');
  action(s, 'service-reconsider');
  action(s, 'service-private');
  expect(s.serviceWeek?.jobs[0]).toMatchObject({ stage: 'accepted', fee: 500, collectionAt: 2520 });
  expect(serviceWeekActions(s, context).some((a) => a.id === 'service-hear-nora')).toBe(false);
});
it('paid and staying-small routes both close after five days without requiring a repaired prestige object', () => {
  for (const route of ['regular', 'favours', 'private'] as const) {
    const s = fixture(route);
    s.now = 4 * 1440 + 540;
    const id = route === 'regular' ? 'service-close-regular' : 'service-close-small';
    expect(action(s, id)?.lines.length).toBeGreaterThan(0);
    expect(getServiceWeekView(s)?.conclusion).toContain('week is complete');
    expect(serviceWeekActions(s, context).map((a) => a.id)).toEqual(['service-invite-donor']);
  }
  const unresolved = fixture();
  action(unresolved, 'service-hear-leila');
  action(unresolved, 'service-accept-leila');
  unresolved.now = 4 * 1440 + 540;
  expect(applyServiceWeekAction(unresolved, 'service-close-regular', context)).toBeNull();
});

it('Sam can refuse the service rate and a named future obligation is emitted for runtime scheduling', () => {
  const s: ServiceWeekGame = { now: 840 };
  const started = applyServiceWeekAction(s, 'service-begin', context);
  expect(started?.obligation).toEqual({
    personId: 'sam',
    from: 2 * 1440 + 780,
    until: 2 * 1440 + 1020,
    activity: 'Parts-counter shift',
  });
  action(s, 'service-regular');
  expect(
    applyServiceWeekAction(s, 'service-paid-help', { ...context, samWillAgree: () => false })
      ?.lines[0]?.speaker,
  ).toBe('Sam');
  expect(s.serviceWeek?.paidHelp).toBe(false);
  expect(s.workshop?.ledger).toBeUndefined();
});
it('establishes the fee at agreement after a route change, preserving it on later renegotiation', () => {
  for (const [heardRoute, agreedRoute, fee] of [
    ['regular', 'favours', 0],
    ['favours', 'regular', 500],
  ] as const) {
    const s = fixture(heardRoute);
    action(s, 'service-hear-leila');
    expect(s.serviceWeek?.jobs[0]?.fee).toBe(0);
    action(s, 'service-reconsider');
    action(s, `service-${agreedRoute}`);
    action(s, 'service-accept-leila');
    expect(s.serviceWeek?.jobs[0]?.fee).toBe(fee);
    action(s, 'service-reconsider');
    action(s, `service-${heardRoute}`);
    action(s, 'service-delay-leila');
    expect(s.serviceWeek?.jobs[0]?.fee).toBe(fee);
  }
});
it('late starts schedule future visits and requests describe their actual calendar date', () => {
  const s: ServiceWeekGame = { now: 20 * 60 };
  const started = applyServiceWeekAction(s, 'service-begin', context);
  expect(started?.visits).toBeUndefined();
  expect(action(s, 'service-regular')?.visits?.every((v) => v.at > s.now)).toBe(true);
  s.now = 1440 + 600;
  expect(
    serviceWeekActions(s, context).find((a) => a.id === 'service-hear-leila')?.detail,
  ).toContain('today at 18:00');
  expect(action(s, 'service-hear-leila')?.lines[0]?.text).toContain('today at 18:00');
  s.now = 2 * 1440 + 12 * 60 + 39;
  expect(serviceWeekActions(s, context).some((a) => a.id === 'service-hear-nora')).toBe(false);
  s.now++;
  expect(action(s, 'service-hear-nora')?.lines[0]?.text).toContain('today at 14:00');
});
it('a moved personal session remains concretely playable and reflection requires an established donor encounter', () => {
  const s = fixture('private');
  action(s, 'service-protect-session');
  const moved = action(s, 'service-change-session');
  expect(moved?.personalOpportunity).toEqual({ at: 3 * 1440 + 900, duration: 45 });
  expect(getServiceWeekView(s)?.arrangements.join(' ')).toContain('working day 4 at 15:00');
  s.now = 2 * 1440 + 840;
  expect(applyServiceWeekAction(s, 'service-personal-session', context)).toBeNull();
  s.now = 3 * 1440 + 900;
  expect(applyServiceWeekAction(s, 'service-reflect', context)).toBeNull();
  expect(action(s, 'service-personal-session')?.minutes).toBe(45);
  action(s, 'service-invite-donor');
  s.now = s.serviceWeek?.donorAt ?? s.now;
  action(s, 'service-hear-donor');
  expect(action(s, 'service-reflect')?.lines[0]?.text).toContain('display label');
  s.now = 4 * 1440 + 540;
  expect(
    action(s, 'service-close-small')?.lines.some((l) =>
      l.text.includes('kept the saved model session'),
    ),
  ).toBe(true);
});
it('private route schedules no customers and a physical saved model precedes model activities', () => {
  const s: ServiceWeekGame = { now: 840 };
  expect(applyServiceWeekAction(s, 'service-begin', context)?.visits).toBeUndefined();
  expect(action(s, 'service-private')?.visits).toEqual([]);
  const absent = {
    ...context,
    paperStreetPresent: false,
    paperStreetWaiting: false,
    paperStreetRepaired: false,
  };
  expect(serviceWeekActions(s, absent).some((a) => a.id === 'service-protect-session')).toBe(false);
  expect(serviceWeekActions(s, absent).some((a) => a.id === 'service-invite-donor')).toBe(false);
  expect(applyServiceWeekAction(s, 'service-find-model', absent)?.discoverPersonalProject).toBe(
    true,
  );
  expect(
    applyServiceWeekAction(s, 'service-find-model', { ...context, paperStreetPresent: true }),
  ).toBeNull();
  const invite = action(s, 'service-invite-donor');
  expect(invite?.visits?.[0]?.personId).toBe('evan');
  expect(applyServiceWeekAction(s, 'service-hear-donor', context)).toBeNull();
  s.now = invite?.visits?.[0]?.at ?? s.now;
  expect(action(s, 'service-hear-donor')?.lines[0]?.speaker).toBe('Evan');
});
it('changing routes does not repeat invitations or erase accepted jobs', () => {
  const s: ServiceWeekGame = { now: 840 };
  action(s, 'service-begin');
  expect(action(s, 'service-favours')?.visits).toHaveLength(2);
  action(s, 'service-hear-leila');
  action(s, 'service-accept-leila');
  action(s, 'service-reconsider');
  expect(action(s, 'service-private')?.visits).toEqual([]);
  action(s, 'service-reconsider');
  expect(action(s, 'service-regular')?.visits).toEqual([]);
  expect(s.serviceWeek?.jobs[0]?.stage).toBe('accepted');
});

it('late hearing honestly acknowledges elapsed requested times while later and decline remain possible', () => {
  for (const [owner, now] of [
    ['leila', 1440 + 19 * 60],
    ['nora', 2 * 1440 + 17 * 60],
  ] as const) {
    const s = fixture();
    s.now = now;
    const heard = action(s, `service-hear-${owner}`);
    expect(heard?.lines[0]?.text).toContain('that time has passed');
    expect(applyServiceWeekAction(s, `service-accept-${owner}`, context)).toBeNull();
    expect(serviceWeekActions(s, context).some((a) => a.id === `service-later-${owner}`)).toBe(
      true,
    );
    expect(serviceWeekActions(s, context).some((a) => a.id === `service-decline-${owner}`)).toBe(
      true,
    );
  }
});
it('late personal work uses only remaining time and an elapsed slot can be concretely replanned', () => {
  const s = fixture('private');
  action(s, 'service-protect-session');
  s.now = 2 * 1440 + 14 * 60 + 30;
  expect(action(s, 'service-personal-session')?.minutes).toBe(15);
  const expired = fixture('private');
  action(expired, 'service-protect-session');
  expired.now = 2 * 1440 + 14 * 60 + 45;
  expect(applyServiceWeekAction(expired, 'service-personal-session', context)).toBeNull();
  expect(action(expired, 'service-change-session')?.personalOpportunity).toEqual({
    at: 3 * 1440 + 15 * 60,
    duration: 45,
  });
});

it('offers an actual unchecked collection revisit while its owner is away, without settling it', () => {
  const s = fixture();
  action(s, 'service-hear-leila');
  action(s, 'service-accept-leila');
  const absent = { ...context, ownerHere: () => false, uncheckedCollections: ['service-leila'] };
  expect(serviceWeekActions(s, absent).map((a) => a.id)).toContain(
    'service-revisit-unfinished-leila',
  );
  expect(
    serviceWeekActions(s, { ...absent, uncheckedCollections: [] }).map((a) => a.id),
  ).not.toContain('service-revisit-unfinished-leila');
  const before = structuredClone(s);
  const result = applyServiceWeekAction(s, 'service-revisit-unfinished-leila', absent);
  expect(result?.visits).toEqual([
    { personId: 'leila', at: s.now + 30, activity: 'Returning to discuss the unfinished check' },
  ]);
  expect(result?.recoverObjectId).toBeUndefined();
  expect(result?.releaseCollectionId).toBeUndefined();
  expect(result?.promise).toBeUndefined();
  expect(s).toEqual(before);
  const job = s.serviceWeek?.jobs[0];
  if (!job) throw Error('Missing accepted job');
  job.stage = 'offered';
  expect(serviceWeekActions(s, absent).map((a) => a.id)).not.toContain(
    'service-revisit-unfinished-leila',
  );
  expect(serviceWeekActions(s, absent).map((a) => a.id)).not.toContain('service-accept-leila');
});
