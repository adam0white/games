import { expect, it } from 'vitest';
import { createGame } from '../src/game/engine';
import {
  applyWorkshopAction,
  completeWorkshopJob,
  freshWorkshop,
  getWorkshopView,
  type WorkshopContext,
  type WorkshopGame,
  workshopActions,
} from '../src/game/workshop';

const adult: WorkshopContext = {
  graduated: true,
  independentRepair: true,
  paidHelpEligible: true,
  dadHere: true,
  noraHere: true,
  samHere: true,
  leilaHere: true,
  dadWillWork: () => true,
  samWillAgree: () => true,
};
function ready(): WorkshopGame {
  const s = createGame(77) as WorkshopGame;
  s.chapter = 'garage';
  s.focusId = null;
  s.workshop = freshWorkshop();
  s.objects.push({
    id: 'nora-control',
    owner: 'Nora',
    title: 'A returned lamp',
    story: 'A careful repair.',
    form: 'lamp',
    fault: 'battery',
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
function act(s: WorkshopGame, id: string, ctx = adult) {
  const out = applyWorkshopAction(s, id, ctx);
  expect(out).not.toBeNull();
  if (out) s.now += out.minutes;
  return out;
}
function openIntake(s: WorkshopGame, priced = true) {
  act(s, 'workshop-referral-ask');
  act(s, priced ? 'workshop-priced' : 'workshop-favours');
  act(s, 'workshop-intake-space');
  s.now += 30;
}
it('teen holidays reveal a family project without commercial intake, prices, or wages', () => {
  const s = ready();
  const ctx = { ...adult, graduated: false, paidHelpEligible: false };
  expect(workshopActions(s, ctx).map((a) => a.id)).toEqual(['workshop-cabinet-look']);
  act(s, 'workshop-cabinet-look', ctx);
  expect(s.workshop?.cabinet).toBe('looked');
  expect(s.workshop?.jobs).toHaveLength(0);
  expect(s.workshop?.ledger).toHaveLength(0);
  expect(applyWorkshopAction(s, 'workshop-priced', ctx)).toBeNull();
});
it('joint cabinet work respects current refusal, retains each stage, and reveals a saved ordinary drawing', () => {
  const s = ready();
  act(s, 'workshop-cabinet-look');
  const declined = act(s, 'workshop-cabinet-measure', { ...adult, dadWillWork: () => false });
  expect(declined?.lines.some((l) => l.text.includes('Not right now'))).toBe(true);
  expect(s.workshop?.cabinet).toBe('looked');
  act(s, 'workshop-cabinet-measure');
  act(s, 'workshop-cabinet-close');
  act(s, 'workshop-cabinet-open');
  expect(s.workshop?.cabinet).toBe('measured');
  act(s, 'workshop-cabinet-hang');
  act(s, 'workshop-cabinet-align');
  act(s, 'workshop-drawings');
  expect(s.workshop?.cabinet).toBe('finished');
  expect(s.workshop?.drawingFound).toBe(true);
  expect(JSON.parse(JSON.stringify(s.workshop))).toEqual(s.workshop);
  expect(applyWorkshopAction(s, 'workshop-drawings', adult)).toBeNull();
});
it('absent Dad does not speak through looking at his project', () => {
  const s = ready();
  const out = act(s, 'workshop-cabinet-look', { ...adult, dadHere: false });
  expect(out?.lines.some((l) => l.speaker === 'Dad')).toBe(false);
});
it('referrals need permission, space and a disclosed quote before accepting, with a viable no-fee route', () => {
  const s = ready();
  expect(applyWorkshopAction(s, 'workshop-leila-arrival', adult)).toBeNull();
  openIntake(s, false);
  const introduction = act(s, 'workshop-leila-arrival');
  expect(introduction?.personIds).toEqual(['leila']);
  expect(applyWorkshopAction(s, 'workshop-accept-leila', adult)).toBeNull();
  act(s, 'workshop-quote-leila');
  const batteries = s.parts.batteries;
  const acceptance = act(s, 'workshop-accept-leila');
  expect(acceptance?.job?.ownerId).toBe('leila');
  expect(s.parts.batteries).toBe(batteries + 1);
  expect(s.workshop?.jobs[0]?.fee).toBe(0);
  expect(s.workshop?.cash).toBe(0);
  expect(s.workshop?.ledger).toHaveLength(0);
  expect(applyWorkshopAction(s, 'workshop-accept-leila', adult)).toBeNull();
});
it('cash, supplied battery and agreed independent wages are conserved once, at actual checked return', () => {
  const s = ready();
  openIntake(s);
  act(s, 'workshop-sam-agreement');
  act(s, 'workshop-leila-arrival');
  act(s, 'workshop-quote-leila');
  act(s, 'workshop-accept-leila');
  expect(s.workshop?.cash).toBe(0);
  expect(s.workshop?.ledger.map((e) => e.amount)).toEqual([200, -200]);
  expect(
    completeWorkshopJob(s, 'workshop-leila', { verified: false, independent: true, at: s.now }),
  ).toEqual([]);
  expect(s.workshop?.jobs[0]?.stage).toBe('accepted');
  completeWorkshopJob(s, 'workshop-leila', { verified: true, independent: true, at: s.now });
  expect(s.workshop?.cash).toBe(500);
  expect(s.workshop?.ledger.map((e) => e.amount)).toEqual([200, -200, 800, -300]);
  expect(
    completeWorkshopJob(s, 'workshop-leila', { verified: true, independent: true, at: s.now }),
  ).toEqual([]);
  expect(s.workshop?.cash).toBe(500);
  expect(getWorkshopView(s)?.notebook).toEqual({
    cash: '£5',
    received: '£8',
    paid: '£3',
    materials: '£2',
  });
});
it('a paid agreement neither starts a repair nor pays Sam for a player-completed job', () => {
  const s = ready();
  openIntake(s);
  const refusal = act(s, 'workshop-sam-agreement', { ...adult, samWillAgree: () => false });
  expect(refusal?.lines[0]?.text).toContain('Not this afternoon');
  expect(s.workshop?.paidHelp).toBe(false);
  act(s, 'workshop-sam-agreement');
  expect(s.workshop?.jobs).toHaveLength(0);
  expect(s.focusId).toBeNull();
  act(s, 'workshop-leila-arrival');
  act(s, 'workshop-quote-leila');
  act(s, 'workshop-accept-leila');
  completeWorkshopJob(s, 'workshop-leila', { verified: true, independent: false, at: s.now });
  expect(s.workshop?.cash).toBe(800);
  expect(s.workshop?.ledger.some((e) => e.kind === 'sam-pay')).toBe(false);
});
it('views cannot advance state, and simultaneous collection plans remain distinct', () => {
  const s = ready();
  openIntake(s);
  act(s, 'workshop-leila-arrival');
  act(s, 'workshop-quote-leila');
  act(s, 'workshop-nora-arrival');
  act(s, 'workshop-quote-nora');
  const before = JSON.stringify(s);
  const view = getWorkshopView(s);
  expect(JSON.stringify(s)).toBe(before);
  expect(view?.jobs.map((j) => j.note)).toEqual([
    'Collection today, if the repair is checked.',
    'Collection tomorrow at 10:00; leave room for other work.',
  ]);
});

it('introductions and collection conversations occur only at an arranged time with the owner present', () => {
  const s = ready();
  act(s, 'workshop-referral-ask');
  act(s, 'workshop-priced');
  const visit = act(s, 'workshop-intake-space');
  expect(visit?.visits?.[0]?.personId).toBe('leila');
  expect(applyWorkshopAction(s, 'workshop-leila-arrival', adult)).toBeNull();
  s.now = (s.workshop?.referralAt ?? s.now) + 1;
  expect(
    applyWorkshopAction(s, 'workshop-leila-arrival', { ...adult, leilaHere: false }),
  ).toBeNull();
  act(s, 'workshop-leila-arrival');
  expect(applyWorkshopAction(s, 'workshop-quote-leila', { ...adult, leilaHere: false })).toBeNull();
  act(s, 'workshop-quote-leila');
  const intake = act(s, 'workshop-accept-leila');
  expect(intake?.visits?.[0]?.at).toBe(s.workshop?.jobs[0]?.collectionAt);
  s.now = s.workshop?.jobs[0]?.collectionAt ?? s.now;
  expect(getWorkshopView(s)?.jobs[0]?.note).toContain('Collection time has arrived');
  expect(applyWorkshopAction(s, 'workshop-delay-leila', { ...adult, leilaHere: false })).toBeNull();
  act(s, 'workshop-delay-leila');
  expect(s.workshop?.jobs[0]?.collectionAt).toBeGreaterThan(s.now);
  expect(s.workshop?.cash).toBe(0);
  expect(s.workshop?.jobs[0]?.stage).toBe('accepted');
});

it('a late introduction cannot promise collection earlier that day', () => {
  const s = ready();
  openIntake(s);
  s.now = Math.floor(s.now / 1440) * 1440 + 20 * 60;
  const out = act(s, 'workshop-leila-arrival');
  expect(s.workshop?.jobs[0]?.collectionAt).toBeGreaterThan(s.now);
  expect(out?.lines.map((line) => line.text).join(' ')).toContain('tomorrow evening');
});
it('the next finite batch preserves permission, actor presence and an honest unfixable return', () => {
  const s = ready();
  openIntake(s);
  act(s, 'workshop-leila-arrival');
  act(s, 'workshop-nora-arrival');
  for (const job of s.workshop?.jobs ?? []) job.stage = 'complete';
  const ctx = { ...adult, ownerHere: (id: string) => id === 'evan' };
  act(s, 'workshop-next-batch', ctx);
  const introduction = act(s, 'workshop-next-referral-yes', ctx);
  expect(introduction?.personIds).toEqual(['evan']);
  expect(applyWorkshopAction(s, 'workshop-evan-arrival', ctx)).toBeNull();
  s.now = s.workshop?.nextReferralAt ?? s.now;
  expect(
    applyWorkshopAction(s, 'workshop-evan-arrival', { ...ctx, ownerHere: () => false }),
  ).toBeNull();
  act(s, 'workshop-evan-arrival', ctx);
  act(s, 'workshop-nora-stairs-arrival', ctx);
  expect(s.workshop?.jobs.map((j) => j.id)).toContain('workshop-leila-landing');
  const evan = s.workshop?.jobs.find((j) => j.id === 'workshop-evan');
  if (evan) evan.stage = 'complete';
  act(s, 'workshop-evan-timer-arrival', ctx);
  act(s, 'workshop-quote-evan-timer', ctx);
  expect(
    workshopActions(s, ctx).find((a) => a.id === 'workshop-accept-evan-timer')?.detail,
  ).toContain('inspection only');
  const intake = act(s, 'workshop-accept-evan-timer', ctx);
  const control = s.objects.find((o) => o.id === 'nora-control');
  if (control && intake?.job)
    s.objects.push({
      ...control,
      id: intake.job.id,
      fault: intake.job.fault,
      location: 'bench',
      inspected: false,
      repaired: false,
      verified: false,
    });
  const timer = s.objects.find((o) => o.id === 'workshop-evan-timer');
  expect(timer?.fault).toBe('gear');
  expect(applyWorkshopAction(s, 'workshop-return-unfixed-evan-timer', ctx)).toBeNull();
  if (timer) timer.inspected = true;
  const cash = s.workshop?.cash;
  act(s, 'workshop-return-unfixed-evan-timer', ctx);
  expect(timer?.location).toBe('returned');
  expect(s.workshop?.cash).toBe(cash);
});
it('finding the drawing does not consent to displaying it', () => {
  const s = ready();
  if (s.workshop) {
    s.workshop.cabinet = 'finished';
    s.workshop.projectOpen = true;
  }
  act(s, 'workshop-drawings');
  expect(getWorkshopView(s)?.cabinet?.drawingDisplayed).toBe(false);
  act(s, 'workshop-keep-drawing');
  expect(getWorkshopView(s)?.cabinet?.drawingDisplayed).toBe(false);
  expect(s.workshop?.drawingChoice).toBe('kept');
});
