import { ORIGINAL_REPORT, OUTCOME_ACTIONS, OUTCOME_TERMS, outcomeDone } from './outcomes';
import type { GameState } from './types';
/** Reject malformed edition/account state rather than silently starting or upgrading it. */
export function validateOutcomeSave(s: GameState): void {
  function fail(): never {
    throw new Error('The optional cast-outcome account is invalid.');
  }
  const o = s.castOutcomes;
  if (!o) fail();
  const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const time = (n: unknown) => integer(n) && Number(n) <= s.now;
  if (
    o.edition !== 'cast-outcomes@1' ||
    o.startedAt !== 540 ||
    JSON.stringify(o.originalReport) !== JSON.stringify(ORIGINAL_REPORT) ||
    !Array.isArray(o.receipts) ||
    o.receipts.length > OUTCOME_ACTIONS.length ||
    !Array.isArray(o.decisions) ||
    o.decisions.length > 100 ||
    !o.rafi ||
    !o.handle ||
    !Array.isArray(o.handle.trials)
  )
    fail();
  const actions = new Set<string>();
  for (const r of o.receipts) {
    if (
      !r ||
      !OUTCOME_ACTIONS.includes(r.action) ||
      actions.has(r.action) ||
      OUTCOME_TERMS[r.action].person !== r.person ||
      !time(r.at) ||
      typeof r.text !== 'string' ||
      r.text.length > 3000
    )
      fail();
    actions.add(r.action);
  }
  for (const d of o.decisions)
    if (
      !d ||
      !OUTCOME_ACTIONS.includes(d.action) ||
      !time(d.at) ||
      typeof d.says !== 'string' ||
      d.says.length > 3000 ||
      (d.chosen !== undefined && typeof d.chosen !== 'string')
    )
      fail();
  const done = (a: (typeof OUTCOME_ACTIONS)[number]) => outcomeDone(s, a);
  if (
    o.samCash !== (done('sam-shift') ? 6 : 0) ||
    o.halilCash !== (done('halil-service') ? 6 : 0) ||
    o.rafi.heldDeposit !== (done('rafi-return') ? 0 : 4) ||
    o.rafi.customerReceived !==
      (done('rafi-return') ? 4 : 0) + (done('rafi-deposit-loan') ? 8 : 0) ||
    o.rafi.jarReceived !== (done('rafi-jar-loan') ? 3 : 0) ||
    o.rafi.workshopDebt !== (done('rafi-deposit-loan') ? 8 : 0) + (done('rafi-jar-loan') ? 3 : 0) ||
    o.handle.width !== (done('nora-revision') ? 34 : 18) ||
    o.handle.collar !== done('nora-revision') ||
    o.handle.trials.length !== (done('nora-trial') ? 1 : 0) + (done('nora-retrial') ? 1 : 0)
  )
    fail();
  for (const trial of o.handle.trials)
    if (
      !trial ||
      !time(trial.at) ||
      trial.user !== 'nora' ||
      trial.minutes !== 10 ||
      ![18, 34].includes(trial.width) ||
      trial.held !== (trial.width === 34)
    )
      fail();
  if (
    done('nora-revision') !== (typeof o.handle.credit === 'string') ||
    done('rafi-appliance') !== (typeof o.applianceId === 'string') ||
    done('halil-terms') !== (typeof o.serviceId === 'string')
  )
    fail();
  for (const id of [o.applianceId, o.serviceId])
    if (id !== undefined && !s.jobs.some((j) => j.id === id)) fail();
  for (const [later, earlier] of [
    ['sam-terms', 'sam-correction'],
    ['sam-shift', 'sam-terms'],
    ['nora-revision', 'nora-trial'],
    ['nora-retrial', 'nora-revision'],
    ['rafi-deposit-loan', 'rafi-return'],
    ['halil-service', 'halil-terms'],
  ] as const)
    if (done(later) && !done(earlier)) fail();
  if (o.pending) {
    const w = o.pending;
    const t = OUTCOME_TERMS[w.action];
    if (
      !t ||
      done(w.action) ||
      !time(w.startedAt) ||
      w.endsAt !== w.startedAt + t.minutes ||
      w.endsAt < s.now ||
      w.reservedCash !== t.cash ||
      !w.option ||
      w.option.id !== w.action ||
      w.option.duration !== t.minutes ||
      w.option.label !== t.label ||
      s.people[t.person]?.activity?.affordance.id !== w.action
    )
      fail();
  }
  // The engine drops the bounded replay log when it fills. Edition and account
  // validation above still applies; a retained log must record the opening opt-in.
  if (s.inputs !== undefined && s.inputs[0]?.type !== 'start-cast-outcomes') fail();
}
