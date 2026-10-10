import { describe, expect, it } from 'vitest';
import { freshServiceWeek } from '../src/game/service-week';
import {
  applyWorkshopAction,
  freshWorkshop,
  type WorkshopContext,
  type WorkshopGame,
  type WorkshopState,
  workshopActions,
} from '../src/game/workshop';

const ctx: WorkshopContext = {
  graduated: true,
  independentRepair: true,
  paidHelpEligible: true,
  dadHere: true,
  noraHere: true,
  samHere: true,
  leilaHere: true,
  ownerHere: () => true,
};
function ready(): WorkshopGame & { workshop: WorkshopState } {
  const workshop = freshWorkshop();
  workshop.intakeSpace = true;
  workshop.mode = 'priced';
  workshop.jobs = ['workshop-leila', 'workshop-nora'].map((id) => ({
    id,
    stage: 'complete' as const,
    fee: 800,
    materialCost: 0,
    due: 'tomorrow' as const,
    collectionAt: 1440 + 1080,
    samFee: 0,
    collectedAt: 1440 + 1080,
  }));
  return {
    now: 3 * 1440 + 900,
    chapter: 'garage',
    focusId: null,
    objects: [],
    unlocked: [],
    parts: { batteries: 1, holders: 1 },
    workshop,
  };
}
const words = (result: ReturnType<typeof applyWorkshopAction>) =>
  result?.lines.map((l) => l.text).join(' ') ?? '';
describe('received Evan acquaintance', () => {
  it('varies the invitation only after a real donor conversation, not an invitation alone', () => {
    const fresh = ready();
    fresh.serviceWeek = freshServiceWeek();
    fresh.serviceWeek.donorInvited = true;
    const known = structuredClone(fresh);
    known.serviceWeek = { ...freshServiceWeek(), part: 'offered' };
    const original = words(applyWorkshopAction(fresh, 'workshop-next-batch', ctx));
    const repeat = words(applyWorkshopAction(known, 'workshop-next-batch', ctx));
    expect(original).toContain('May I introduce him');
    expect(repeat).toContain('You have met Evan');
    expect(known.workshop?.jobs).toEqual(fresh.workshop?.jobs);
    expect(
      workshopActions(known, ctx).find((a) => a.id === 'workshop-next-referral-yes')?.label,
    ).toContain('visit');
  });
  it('a received shared-label marker preserves earlier acquaintance at later customer arrival', () => {
    const fresh = ready();
    fresh.workshop.nextBatch = 'permitted';
    fresh.workshop.nextReferralAt = fresh.now;
    const known = structuredClone(fresh);
    known.unlocked.push('aftercare-label-done');
    expect(words(applyWorkshopAction(fresh, 'workshop-evan-arrival', ctx))).toContain(
      'Leila introduced us',
    );
    expect(words(applyWorkshopAction(known, 'workshop-evan-arrival', ctx))).toContain(
      'Good to see you again',
    );
    expect(known.workshop?.jobs).toEqual(fresh.workshop?.jobs);
    expect(known.workshop?.jobs.at(-1)?.stage).toBe('offered');
    expect(applyWorkshopAction(known, 'workshop-evan-arrival', ctx)).toBeNull();
  });
  it('Nora does not assert Leila is collecting today when collected or scheduled another day', () => {
    const collected = ready();
    collected.workshop.jobs = collected.workshop.jobs.filter((j) => j.id !== 'workshop-nora');
    const differentDay = structuredClone(collected);
    const job = differentDay.workshop.jobs[0];
    if (!job) throw Error('Missing matched collection job');
    job.stage = 'accepted';
    job.collectionAt = differentDay.now + 1440;
    delete job.collectedAt;
    const a = words(applyWorkshopAction(collected, 'workshop-nora-arrival', ctx));
    const b = words(applyWorkshopAction(differentDay, 'workshop-nora-arrival', ctx));
    expect(a).toEqual(b);
    expect(a).not.toContain('Leila');
    expect(a).toContain('overnight');
  });
});
