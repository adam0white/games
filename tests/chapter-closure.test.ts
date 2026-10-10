import { expect, it } from 'vitest';
import {
  applyServiceWeekAction,
  completeServiceWeekJob,
  freshServiceWeek,
  type ServiceWeekContext,
  type ServiceWeekGame,
  serviceWeekClosure,
} from '../src/game/service-week';
import { freshWorkshop } from '../src/game/workshop';

const ctx: ServiceWeekContext = {
  graduated: true,
  independentHandoff: true,
  dadHere: true,
  samHere: true,
  ownerHere: () => true,
  samWillAgree: () => true,
};
function route(kind: 'regular' | 'favours' | 'private') {
  const s: ServiceWeekGame = {
    now: 840,
    workshop: freshWorkshop(),
    serviceWeek: freshServiceWeek(),
  };
  const act = (id: string) => {
    const r = applyServiceWeekAction(s, id, ctx);
    expect(r).not.toBeNull();
    return r;
  };
  act('service-begin');
  act(`service-${kind}`);
  return { s, act };
}
for (const kind of ['regular', 'favours'] as const)
  it(`closes ${kind} with only actual collections and ledger payments`, () => {
    const { s, act } = route(kind);
    act('service-hear-leila');
    act('service-accept-leila');
    if (kind === 'regular') act('service-paid-help');
    expect(serviceWeekClosure(s)).toBeUndefined();
    expect(
      completeServiceWeekJob(s, 'service-leila', { verified: false, independent: true, at: s.now }),
    ).toEqual([]);
    expect(serviceWeekClosure(s)).toBeUndefined();
    completeServiceWeekJob(s, 'service-leila', {
      verified: true,
      independent: kind === 'regular',
      samFee: kind === 'regular' ? 200 : 0,
      at: s.now,
    });
    s.now = 2 * 1440 + 800;
    act('service-hear-nora');
    act('service-decline-nora');
    s.now = 4 * 1440 + 840;
    act(kind === 'regular' ? 'service-close-regular' : 'service-close-small');
    const closure = serviceWeekClosure(s);
    expect(closure?.outcomes.join(' ')).toContain('heard and declined');
    expect(closure?.outcomes.join(' ')).toContain(
      `Trial repair fees received: £${kind === 'regular' ? '5.00' : '0.00'}`,
    );
    expect(closure?.outcomes.join(' ').includes('whole repair carried by Sam')).toBe(
      kind === 'regular',
    );
    expect(closure?.outcomes.join(' ')).toContain(
      `Sam’s recorded pay: £${kind === 'regular' ? '2.00' : '0.00'}`,
    );
    expect(closure?.outcomes.join(' ')).toContain(
      `Workshop cash now: £${kind === 'regular' ? '3.00' : '0.00'}`,
    );
    const before = structuredClone(s);
    serviceWeekClosure(s);
    expect(s).toEqual(before);
  });
it('distinguishes a private choice from skipped introductions without fabricated declined requests', () => {
  for (const kind of ['private', 'regular'] as const) {
    const { s, act } = route(kind);
    s.now = 4 * 1440 + 840;
    act('service-close-small');
    const text = serviceWeekClosure(s)?.outcomes.join(' ');
    expect(text).toContain(kind === 'private' ? 'was not invited' : 'was not heard');
    expect(text).not.toContain('heard and declined');
    expect(text).toContain('£0.00');
  }
});
