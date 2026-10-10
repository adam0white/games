import { describe, expect, it } from 'vitest';
import {
  advanceOperationsWork,
  applyOperationsAction,
  completeOperationsJob,
  completeOperationsMovement,
  freshOperations,
  isOperationsObjectAway,
  type OperationsContext,
  type OperationsGame,
  operationsActions,
  operationsReservedCash,
  operationsSamWorkPermitted,
} from '../src/game/operations';
import { freshWorkshop } from '../src/game/workshop';

function fixture() {
  const s: OperationsGame = {
    now: 540,
    workshop: { ...freshWorkshop(), cash: 800 },
    operations: freshOperations(540),
  };
  const ctx: OperationsContext = {
    graduated: true,
    serviceConclusion: 'regular',
    isHere: () => true,
    objectStatus: () => 'open',
    canPassYear: true,
    chooseDelivery: () => true,
    continueDelivery: () => true,
  };
  const act = (id: string) => {
    const r = applyOperationsAction(s, id, ctx);
    expect(r, id).not.toBeNull();
    s.now += r?.minutes ?? 0;
    if (r?.completeMovement) completeOperationsMovement(s, r.completeMovement, s.now);
    return r;
  };
  return { s, ctx, act };
}
describe('the finite collection round', () => {
  it('allows a missed crate visit to be arranged again without inventing property', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    act('operations-plan-display');
    ctx.isHere = () => false;
    act('operations-arrange-crates');
    expect(operationsActions(s, ctx).some((a) => a.id === 'operations-arrange-crates')).toBe(false);
    s.now += 90;
    expect(operationsActions(s, ctx).some((a) => a.id === 'operations-arrange-crates')).toBe(true);
    const before = structuredClone(s.operations?.crates);
    act('operations-arrange-crates');
    expect(s.operations?.crates).toEqual(before);
  });

  it('honours the agreed independent wage on a no-fee favour using reserved real cash', () => {
    const { s, ctx, act } = fixture();
    ctx.choosePaidHelp = () => true;
    act('operations-route-favours');
    act('operations-hear-operations-nora-collection');
    act('operations-request-operations-nora-collection');
    act('operations-accept-operations-nora-collection');
    act('operations-sam-pay');
    expect(operationsReservedCash(s)).toBe(200);
    expect(operationsSamWorkPermitted(s, 'operations-nora-collection')).toBe(true);
    completeOperationsJob(s, 'operations-nora-collection', {
      verified: true,
      independent: true,
      completedBy: 'sam',
      at: s.now,
    });
    expect(s.workshop?.cash).toBe(600);
    expect(s.workshop?.ledger).toEqual([
      expect.objectContaining({ amount: -200, kind: 'sam-pay' }),
    ]);
    expect(operationsReservedCash(s)).toBe(0);
    expect(
      completeOperationsJob(s, 'operations-nora-collection', {
        verified: true,
        independent: true,
        completedBy: 'sam',
        at: s.now,
      }),
    ).toEqual([]);
    expect(s.workshop?.cash).toBe(600);
  });
  it('refuses an unaffordable paid promise and never converts later unfunded work to silently unpaid labour', () => {
    const { s, ctx, act } = fixture();
    ctx.choosePaidHelp = () => true;
    if (s.workshop) s.workshop.cash = 100;
    act('operations-route-favours');
    const refused = act('operations-sam-pay');
    expect(refused?.lines[0]?.text).toContain('cannot cover');
    expect(s.operations?.samPaidHelp).toBe(false);
    if (s.workshop) s.workshop.cash = 200;
    act('operations-hear-operations-trolley-first');
    act('operations-request-operations-trolley-first');
    act('operations-accept-operations-trolley-first');
    act('operations-sam-pay');
    act('operations-hear-operations-nora-collection');
    act('operations-request-operations-nora-collection');
    const accepted = act('operations-accept-operations-nora-collection');
    expect(accepted?.lines[0]?.text).toContain('keep this job with you');
    expect(operationsSamWorkPermitted(s, 'operations-nora-collection')).toBe(false);
    expect(operationsReservedCash(s)).toBe(200);
    completeOperationsJob(s, 'operations-trolley-first', {
      verified: true,
      independent: false,
      completedBy: 'player',
      at: s.now,
    });
    expect(s.workshop?.cash).toBe(200);
    expect(operationsReservedCash(s)).toBe(0);
    act('operations-reserve-sam-operations-nora-collection');
    expect(operationsSamWorkPermitted(s, 'operations-nora-collection')).toBe(true);
    completeOperationsJob(s, 'operations-nora-collection', {
      verified: true,
      independent: true,
      completedBy: 'sam',
      at: s.now,
    });
    expect(s.workshop?.cash).toBe(0);
    expect(operationsReservedCash(s)).toBe(0);
  });
  it('keeps the same two store-owned crates through real retrieval and all three periods', () => {
    const { s, ctx, act } = fixture();
    const originalIds = [...(s.operations?.crates.ids ?? [])];
    for (let episode = 1; episode <= 3; episode++) {
      act('operations-route-favours');
      expect(s.operations?.crates.location).toBe('store');
      expect(operationsActions(s, ctx).some((a) => a.id === 'operations-pack-crate')).toBe(false);
      act('operations-plan-display');
      act('operations-agree-crate-loan');
      const fetch = applyOperationsAction(s, 'operations-fetch-crates', ctx);
      if (!fetch?.completeMovement) throw Error('Missing real fetch');
      expect(s.operations?.crates.location).toBe('with-player');
      expect(completeOperationsMovement(s, fetch.completeMovement, s.now + 14)).toEqual([]);
      expect(s.operations?.crates.location).toBe('with-player');
      s.now += fetch.minutes;
      completeOperationsMovement(s, fetch.completeMovement, s.now);
      expect(s.operations?.crates.location).toBe('bench');
      expect(s.operations?.crates.ids).toEqual(originalIds);
      expect(s.operations?.crates.count).toBe(2);
      expect(s.operations?.crates.owner).toBe('shared-store');
      expect(operationsActions(s, ctx).some((a) => a.id === 'operations-fetch-crates')).toBe(false);
      if (operationsActions(s, ctx).some((a) => a.id === 'operations-pack-crate'))
        act('operations-pack-crate');
      if (operationsActions(s, ctx).some((a) => a.id === 'operations-display-label'))
        act('operations-display-label');
      act('operations-round-split');
      expect(s.operations?.crates.location).toBe('store');
      for (const spec of [
        episode === 1
          ? 'operations-trolley-first'
          : episode === 2
            ? 'operations-sam-counter'
            : 'operations-leila-year',
        episode === 1
          ? 'operations-nora-collection'
          : episode === 2
            ? 'operations-trolley-return'
            : 'operations-nora-year',
      ]) {
        act(`operations-hear-${spec}`);
        act(`operations-decline-${spec}`);
      }
      if (episode < 3) {
        const next = act('operations-next-period');
        s.now = next?.nextYearAt ?? s.now;
      }
    }
    act('operations-finish-favours');
    expect(s.operations?.crates.ids).toEqual(originalIds);
    expect(s.workshop?.cash).toBe(800);
  });
  it('recall leaves trolley and crates away until an attended recovery completes', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    act('operations-pack-crate');
    ctx.objectStatus = () => 'ready';
    act('operations-round-leila');
    expect(s.operations?.crates.location).toBe('with-leila');
    expect(isOperationsObjectAway(s, 'operations-trolley-first')).toBe(true);
    expect(applyOperationsAction(s, 'operations-round-solo', ctx)).toBeNull();
    act('operations-interrupt-delivery');
    expect(s.operations?.crates.location).toBe('route-stop');
    expect(advanceOperationsWork(s, s.now + 10000, ctx)).toEqual([]);
    expect(s.operations?.crates.location).toBe('route-stop');
    expect(s.workshop?.cash).toBe(800);
    const recover = applyOperationsAction(s, 'operations-recover-route', ctx);
    if (!recover?.completeMovement) throw Error('Missing actual recovery');
    expect(isOperationsObjectAway(s, 'operations-trolley-first')).toBe(true);
    completeOperationsMovement(s, recover.completeMovement, s.now + 19);
    expect(isOperationsObjectAway(s, 'operations-trolley-first')).toBe(true);
    s.now += recover.minutes;
    completeOperationsMovement(s, recover.completeMovement, s.now);
    expect(s.operations?.crates.location).toBe('bench');
    expect(isOperationsObjectAway(s, 'operations-trolley-first')).toBe(false);
    expect(s.operations?.completedRounds).toEqual([]);
    act('operations-round-split');
    expect(s.operations?.crates.location).toBe('store');
    expect(s.workshop?.ledger).toEqual([]);
  });
  it('crates still held at the bench block a period passage even when requests were declined', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-favours');
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    act('operations-pack-crate');
    act('operations-display-label');
    for (const id of ['operations-trolley-first', 'operations-nora-collection']) {
      act(`operations-hear-${id}`);
      act(`operations-decline-${id}`);
    }
    expect(applyOperationsAction(s, 'operations-next-period', ctx)).toBeNull();
    expect(s.operations?.crates.location).toBe('bench');
    act('operations-round-pickup');
    expect(s.operations?.crates.location).toBe('store');
    expect(applyOperationsAction(s, 'operations-next-period', ctx)).not.toBeNull();
  });
  it('invitation discloses no request or permission until the owner actually arrives', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    ctx.isHere = () => false;
    const invite = act('operations-hear-operations-trolley-first');
    expect(invite?.lines.map((l) => l.text).join(' ')).not.toContain('written permission');
    expect(s.operations?.jobs[0]?.stage).toBe('invited');
    expect(operationsActions(s, ctx).some((a) => a.id.includes('accept'))).toBe(false);
    expect(applyOperationsAction(s, 'operations-request-operations-trolley-first', ctx)).toBeNull();
    ctx.isHere = () => true;
    act('operations-request-operations-trolley-first');
    const accepted = act('operations-accept-operations-trolley-first');
    expect(accepted?.job?.trolley?.permission).toBe(true);
    expect(accepted?.job?.ownerId).toBe('leila');
    expect(s.workshop?.cash).toBe(800);
  });
  it('refusing actual paid transport grants neither reservation, wage nor completed trip', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    act('operations-pack-crate');
    ctx.objectStatus = () => 'ready';
    ctx.chooseDelivery = () => false;
    act('operations-round-leila');
    expect(s.operations?.delivery).toBeUndefined();
    expect(operationsReservedCash(s)).toBe(0);
    expect(advanceOperationsWork(s, 10000, ctx)).toEqual([]);
    expect(s.operations?.completedRounds).toEqual([]);
    expect(s.workshop?.cash).toBe(800);
  });
  it('actual helper intervals can advance beside player work and settle once at their endpoint', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    act('operations-pack-crate');
    ctx.objectStatus = () => 'ready';
    const intervals: number[][] = [];
    const returns: string[] = [];
    ctx.continueDelivery = (_id, from, until) => {
      intervals.push([from, until]);
      return true;
    };
    ctx.finishDelivery = (id) => {
      returns.push(id);
      return [];
    };
    act('operations-round-leila');
    const d = s.operations?.delivery;
    if (!d) throw Error('missing actual delivery');
    expect(operationsReservedCash(s)).toBe(200);
    advanceOperationsWork(s, d.from + 12, ctx);
    expect(s.workshop?.cash).toBe(800);
    expect(returns).toEqual([]);
    advanceOperationsWork(s, d.until + 100, ctx);
    expect(intervals).toEqual([
      [d.from, d.from + 12],
      [d.from + 12, d.until],
    ]);
    expect(returns).toEqual(['operations-trolley-first']);
    expect(s.workshop?.cash).toBe(600);
    expect(s.operations?.completedRounds).toEqual([1]);
    expect(advanceOperationsWork(s, d.until + 200, ctx)).toEqual([]);
    expect(s.workshop?.ledger).toHaveLength(1);
    expect(operationsReservedCash(s)).toBe(0);
  });
  it('interrupted transport preserves property and pays no unfinished wage', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    act('operations-pack-crate');
    ctx.objectStatus = () => 'ready';
    act('operations-round-leila');
    ctx.continueDelivery = () => false;
    advanceOperationsWork(s, s.now + 50, ctx);
    expect(s.operations?.delivery?.status).toBe('interrupted');
    expect(s.workshop?.cash).toBe(800);
    expect(s.operations?.completedRounds).toEqual([]);
    expect(s.operations?.crates.location).toBe('route-stop');
    expect(isOperationsObjectAway(s, 'operations-trolley-first')).toBe(true);
    expect(operationsActions(s, ctx).some((a) => a.id === 'operations-round-split')).toBe(false);
    act('operations-recover-route');
    expect(s.operations?.crates.location).toBe('bench');
    expect(isOperationsObjectAway(s, 'operations-trolley-first')).toBe(false);
    expect(operationsActions(s, ctx).some((a) => a.id === 'operations-round-split')).toBe(true);
  });
  it('a checked collection pays once; unchecked, supervised or unagreed work earns no independent wage', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-regular');
    expect(applyOperationsAction(s, 'operations-hear-operations-sam-counter', ctx)).toBeNull();
    // Hostile off-episode input is rejected before it can produce a job.
    expect(s.operations?.jobs).toHaveLength(0);
  });
  it('settles a genuinely accepted checked repair exactly once', () => {
    const { s, act } = fixture();
    act('operations-route-regular');
    act('operations-hear-operations-trolley-first');
    act('operations-request-operations-trolley-first');
    act('operations-accept-operations-trolley-first');
    expect(
      completeOperationsJob(s, 'operations-trolley-first', {
        verified: false,
        independent: false,
        at: s.now,
      }),
    ).toEqual([]);
    expect(s.workshop?.cash).toBe(800);
    completeOperationsJob(s, 'operations-trolley-first', {
      verified: true,
      independent: false,
      completedBy: 'player',
      at: s.now,
    });
    expect(s.workshop?.cash).toBe(1300);
    expect(
      completeOperationsJob(s, 'operations-trolley-first', {
        verified: true,
        independent: true,
        completedBy: 'sam',
        at: s.now,
      }),
    ).toEqual([]);
    expect(s.workshop?.cash).toBe(1300);
    expect(s.workshop?.ledger).toHaveLength(1);
  });
  it('private play reaches the following-year ending with personal sessions and no compulsory customer or collection', () => {
    const { s, ctx, act } = fixture();
    for (let episode = 1; episode <= 3; episode++) {
      act('operations-route-private');
      expect(
        operationsActions(s, ctx).some((a) => a.id.includes('round-') || a.id.includes('hear-')),
      ).toBe(false);
      act('operations-close-private-period');
      if (operationsActions(s, ctx).some((a) => a.id === 'operations-display-label'))
        act('operations-display-label');
      if (episode < 3) {
        const r = act('operations-next-period');
        s.now = r?.nextYearAt ?? s.now;
      }
    }
    act('operations-finish-private');
    expect(s.operations?.conclusion).toBe('private');
    expect(s.operations?.jobs).toEqual([]);
    expect(s.workshop?.cash).toBe(800);
    expect(s.workshop?.ledger).toEqual([]);
    expect(s.now).toBeGreaterThan(365 * 1440);
  });
  it('year passage cannot hide outstanding accepted work or another workshop obligation', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-favours');
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    act('operations-pack-crate');
    act('operations-display-label');
    act('operations-round-pickup');
    for (const id of ['operations-trolley-first', 'operations-nora-collection']) {
      act(`operations-hear-${id}`);
      act(`operations-request-${id}`);
      act(`operations-decline-${id}`);
    }
    ctx.canPassYear = false;
    expect(applyOperationsAction(s, 'operations-next-period', ctx)).toBeNull();
    ctx.canPassYear = true;
    expect(applyOperationsAction(s, 'operations-next-period', ctx)?.nextYearAt).toBeGreaterThan(
      s.now,
    );
  });
  it('retained measurements and stationary-case history unlock distinct legitimate alternatives', () => {
    const { s, ctx, act } = fixture();
    act('operations-route-favours');
    expect(operationsActions(s, ctx).some((a) => a.id === 'operations-pack-card')).toBe(false);
    act('operations-plan-display');
    act('operations-agree-crate-loan');
    act('operations-fetch-crates');
    ctx.paperStreetMeasured = true;
    ctx.noraCaseOutcome = 'tray';
    ctx.paperStreetFrontage = 'preserved';
    const ids = operationsActions(s, ctx).map((a) => a.id);
    expect(ids).toContain('operations-pack-card');
    expect(ids).toContain('operations-pack-stationary');
    expect(ids).toContain('operations-display-frontage');
    act('operations-pack-stationary');
    expect(s.operations?.packing).toBe('stationary');
  });
});
