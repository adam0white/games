/** Finite authored cast scenes. HF owns willingness and activity; this module owns receipts and objects.
 * Only the explicit start input enables these rules. No biography grants a method or a completed memory.
 */

import { admissionFacts } from './cast.ts';
import { perceive, prepareActivityFinish } from './hf.ts';
import { createModel, intervene, runUseTest } from './model.ts';
import { chooseActivity, finishActivity, playerAsk, startActivity } from './people.ts';
import { OUTCOME_PROVENANCE } from './recording.ts';
import type { GameState, Job, WorkOption } from './types.ts';

export const OUTCOME_ACTIONS = [
  'sam-correction',
  'sam-terms',
  'sam-shift',
  'nora-trial',
  'nora-revision',
  'nora-retrial',
  'rafi-return',
  'rafi-appliance',
  'rafi-deposit-loan',
  'rafi-jar-loan',
  'halil-terms',
  'halil-service',
] as const;
export type OutcomeAction = (typeof OUTCOME_ACTIONS)[number];
export type CastRole = 'sam' | 'nora' | 'rafi' | 'halil';
export const ORIGINAL_REPORT = {
  author: 'Sam',
  source: 'another player’s description; copied without replication',
  text: 'The moving lantern goes dark after the switch is changed. I checked this myself.',
  status: 'Original fictional copied report. The claim of checking was false.',
};
export const OUTCOME_TERMS: Record<
  OutcomeAction,
  { person: CastRole; minutes: number; label: string; cash: number }
> = {
  'sam-correction': {
    person: 'sam',
    minutes: 15,
    label: 'Write the attributed correction together · 15 minutes',
    cash: 0,
  },
  'sam-terms': {
    person: 'sam',
    minutes: 5,
    label: 'Propose one supervised half-hour for £6 · agree before work',
    cash: 0,
  },
  'sam-shift': {
    person: 'sam',
    minutes: 30,
    label: 'Ask Sam to label the observed evidence · 30 minutes, £6 on completion',
    cash: 6,
  },
  'nora-trial': {
    person: 'nora',
    minutes: 10,
    label: 'Ask Nora to try her narrow handle with a loaded tray · 10 minutes',
    cash: 0,
  },
  'nora-revision': {
    person: 'nora',
    minutes: 20,
    label: 'Ask Nora to fit a wide grip collar · 20 minutes, one stock gear',
    cash: 0,
  },
  'nora-retrial': {
    person: 'nora',
    minutes: 10,
    label: 'Ask Nora to try the revised handle under load · 10 minutes',
    cash: 0,
  },
  'rafi-return': {
    person: 'rafi',
    minutes: 5,
    label: 'Ask Rafi to return his £4 unused deposit with the honest account · 5 minutes',
    cash: 0,
  },
  'rafi-appliance': {
    person: 'rafi',
    minutes: 5,
    label: 'Ask Rafi to bring the separate unpaid appliance to the bench · 5 minutes',
    cash: 0,
  },
  'rafi-deposit-loan': {
    person: 'rafi',
    minutes: 5,
    label: 'Offer an £8 workshop loan to return the spent deposit · £8 still owed to workshop',
    cash: 8,
  },
  'rafi-jar-loan': {
    person: 'rafi',
    minutes: 5,
    label: 'Offer a separate £3 workshop loan for jar restitution · £3 still owed to workshop',
    cash: 3,
  },
  'halil-terms': {
    person: 'halil',
    minutes: 5,
    label: 'Propose one 30-minute contact service for £6 · Halil can refuse',
    cash: 0,
  },
  'halil-service': {
    person: 'halil',
    minutes: 30,
    label: 'Ask Halil to clean and check the inspected service fan · £6 on completion',
    cash: 6,
  },
};
export interface OutcomeReceipt {
  action: OutcomeAction;
  person: CastRole;
  at: number;
  text: string;
}
export interface CastOutcomes {
  edition: 'cast-outcomes@1';
  startedAt: number;
  originalReport: typeof ORIGINAL_REPORT;
  receipts: OutcomeReceipt[];
  decisions: { action: OutcomeAction; at: number; chosen?: string; says: string }[];
  pending?: {
    action: OutcomeAction;
    option: WorkOption;
    startedAt: number;
    endsAt: number;
    reservedCash: number;
  };
  samCash: number;
  halilCash: number;
  rafi: {
    heldDeposit: number;
    customerReceived: number;
    jarReceived: number;
    workshopDebt: number;
  };
  handle: {
    width: number;
    collar: boolean;
    credit?: string;
    trials: { at: number; width: number; held: boolean; user: 'nora'; minutes: number }[];
  };
  applianceId?: string;
  serviceId?: string;
  labelledEvidence?: { jobId: string; evidenceId: number; summary: string; witnesses: string[] }[];
}
export const outcomeDone = (s: GameState, action: OutcomeAction) =>
  s.castOutcomes?.receipts.some((r) => r.action === action) ?? false;
export function startOutcomes(s: GameState): void {
  s.provenance = { ...OUTCOME_PROVENANCE };
  s.castOutcomes = {
    edition: 'cast-outcomes@1',
    startedAt: s.now,
    originalReport: structuredClone(ORIGINAL_REPORT),
    receipts: [],
    decisions: [],
    samCash: 0,
    halilCash: 0,
    rafi: { heldDeposit: 4, customerReceived: 0, jarReceived: 0, workshopDebt: 0 },
    handle: { width: 18, collar: false, trials: [] },
  };
}
const message = (s: GameState, speaker: string, text: string) => {
  s.log.push({ id: s.nextId++, at: s.now, speaker, text, tone: 'ordinary' });
  if (s.log.length > 160) s.log.splice(0, s.log.length - 160);
};
export function outcomeBlock(s: GameState, action: OutcomeAction): string | undefined {
  const o = s.castOutcomes;
  const t = OUTCOME_TERMS[action];
  const p = s.people[t.person];
  if (!o) return 'Start the optional cast-outcome chapter from the title first.';
  if (!s.discoveries?.includes(t.person))
    return 'First share the work and hear the person’s own account.';
  if (outcomeDone(s, action)) return 'That finite outcome is already recorded.';
  if (o.pending) return 'Finish or stop the attended work first.';
  if (!p) return 'That person is not here.';
  if (s.npcWork.some((w) => w.personId === t.person && w.jobId))
    return 'They are responsible for another repair. Recall it first.';
  const carried = admissionFacts(s.castChapter, t.person);
  if (
    carried &&
    (!carried.availableForExtraWork || (carried.life.place !== 'local-workplace' && s.now < 600))
  )
    return 'Their carried plans leave no time for extra workshop work.';
  if (s.watching || s.pendingRequest) return 'Finish the agreed lesson or request first.';
  if ((s.now % 1440) + t.minutes > 1020) return 'There is not enough workshop time left today.';
  if (s.cash < t.cash) return 'The workshop cannot reserve that payment or loan.';
  if (action === 'sam-terms' && !outcomeDone(s, 'sam-correction'))
    return 'Correct the copied report before agreeing paid work.';
  if (action === 'sam-shift' && !outcomeDone(s, 'sam-terms'))
    return 'Sam has not agreed the hours and price.';
  if (action === 'nora-revision' && !outcomeDone(s, 'nora-trial'))
    return 'Try the original grip before revising it.';
  if (action === 'nora-revision' && (s.stock.gear ?? 0) < 1)
    return 'The wide collar needs one actual stock gear. It will be consumed even if work stops.';
  if (action === 'nora-retrial' && !outcomeDone(s, 'nora-revision'))
    return 'There is no revised handle to try yet.';
  if (action === 'rafi-deposit-loan' && !outcomeDone(s, 'rafi-return'))
    return 'Return the unused £4 first. The spent £8 remains owed.';
  if (
    action === 'halil-terms' &&
    !s.jobs.some(
      (j) =>
        j.id === o.applianceId &&
        j.status === 'active' &&
        !j.assignedTo &&
        j.model.components.some((c) => c.id === 'contact' && c.condition === 'dirty'),
    )
  )
    return 'Bring Rafi’s separate appliance for diagnosis first. Halil’s priced service needs that actual unassigned dirty-contact project, not a new free object.';
  if (action === 'halil-service') {
    if (!outcomeDone(s, 'halil-terms')) return 'Halil has not agreed the service terms.';
    const job = s.jobs.find((j) => j.id === o.serviceId);
    if (
      job?.status !== 'active' ||
      job.assignedTo ||
      !job.evidence.some((e) => e.kind === 'inspection' && e.componentId === 'contact')
    )
      return 'Inspect the service fan’s contact on the ordinary bench first.';
    if (s.npcWork.some((w) => w.jobId)) return 'The service needs the workshop bench free.';
  }
  return undefined;
}
function alternatives(minutes: number): WorkOption[] {
  return [
    {
      id: 'rest',
      action: 'rest',
      label: 'take a break',
      duration: Math.min(15, minutes),
      effort: 0,
    },
    { id: 'drink', action: 'drink', label: 'get water', duration: Math.min(5, minutes), effort: 0 },
    { id: 'eat', action: 'eat', label: 'have food', duration: Math.min(25, minutes), effort: 0 },
    {
      id: 'personal',
      action: 'personal',
      label: 'keep my own plans',
      duration: Math.min(30, minutes),
      effort: 0.05,
    },
  ];
}
export function requestOutcome(s: GameState, action: OutcomeAction): string {
  const o = s.castOutcomes;
  if (!o) throw new Error('Missing outcome chapter');
  const t = OUTCOME_TERMS[action];
  const p = s.people[t.person];
  if (!p) throw new Error('Missing actor');
  const option: WorkOption = {
    id: action,
    action:
      action === 'halil-service'
        ? 'clean:contact'
        : action.startsWith('nora-')
          ? 'handle-use'
          : action,
    label: t.label,
    duration: t.minutes,
    effort: action === 'halil-service' ? 0.25 : 0.08,
  };
  const existing = s.npcWork.find((w) => w.personId === p.id);
  const options = [option, ...alternatives(t.minutes)];
  if (existing && !options.some((a) => a.id === existing.option.id)) options.push(existing.option);
  const choice = chooseActivity(p, 'cast-outcomes', {}, options, s.now, playerAsk(action));
  o.decisions.push({
    action,
    at: s.now,
    ...(choice.chosenId ? { chosen: choice.chosenId } : {}),
    says: choice.answer?.says ?? choice.narration,
  });
  if (o.decisions.length > 100) o.decisions.shift();
  message(s, p.name, choice.answer?.says ?? choice.narration);
  const selected = options.find((a) => a.id === choice.chosenId);
  if (choice.chosenId === action) {
    if (existing) {
      finishActivity(p, existing.option, false, s.now, [], true);
      s.npcWork = s.npcWork.filter((w) => w !== existing);
    } else if (p.activity) return 'Their existing activity cannot be interrupted by this scene.';
  }
  if (choice.chosenId !== action || !startActivity(p, option, s.now)) {
    if (selected && selected.id !== action && !p.activity && startActivity(p, selected, s.now))
      s.npcWork.push({
        personId: p.id,
        option: selected,
        startedAt: s.now,
        endsAt: s.now + selected.duration,
      });
    return `${p.name} did not agree. No work, payment or outcome was granted.`;
  }
  s.cash -= t.cash;
  if (action === 'nora-revision') s.stock.gear = (s.stock.gear ?? 0) - 1;
  o.pending = { action, option, startedAt: s.now, endsAt: s.now + t.minutes, reservedCash: t.cash };
  message(
    s,
    'Workshop',
    `${t.label}. Stay together while time passes. Stopping returns reserved cash; used material stays used.`,
  );
  return 'The attended activity has begun. The outcome and payment remain pending.';
}
export function stopOutcome(s: GameState, reason = 'You stopped attending.'): void {
  const o = s.castOutcomes;
  const pending = o?.pending;
  if (!o || !pending) return;
  const p = s.people[OUTCOME_TERMS[pending.action].person];
  if (p) finishActivity(p, pending.option, false, s.now);
  s.cash += pending.reservedCash;
  delete o.pending;
  message(
    s,
    'Workshop',
    `${reason} No completion or payment. Reserved cash returned; any consumed collar material is lost.`,
  );
}
/** Include HF review/body boundaries. Other actions interrupt player attendance, never silently complete it. */
export function outcomeBoundary(s: GameState): number {
  const pending = s.castOutcomes?.pending;
  if (!pending) return Infinity;
  return pending.endsAt;
}
function sceneJob(s: GameState, kind: 'fan', ownerId: 'rafi', title: string): Job {
  const id = `object-${s.nextId++}`;
  const job: Job = {
    id,
    title,
    ownerId,
    kind,
    description:
      'Brought for this finite workshop account. Diagnose the reported intermittent power; no fee or repair qualification is implied.',
    importance: 'Cast outcome project',
    model: createModel(kind, s.seed, [{ componentId: 'contact', condition: 'dirty' }]),
    status: 'active',
    due: Math.floor(s.now / 1440) * 1440 + 1020,
    reward: 0,
    evidence: [],
    contributions: [],
    pendingLessons: [],
    inspected: [],
    verified: [],
    acceptedAt: s.now,
    requiredConditions: ['load'],
  };
  // Customer-owned object supply is explicit; it adds no spare parts or workshop cash.
  s.jobs.push(job);
  return job;
}
export function resolveOutcome(s: GameState): void {
  const o = s.castOutcomes;
  const w = o?.pending;
  if (!o || !w) return;
  const t = OUTCOME_TERMS[w.action];
  const p = s.people[t.person];
  if (!p?.activity || p.activity.affordance.id !== w.option.id || p.body.asleep) {
    stopOutcome(s, 'The person could not continue.');
    return;
  }
  if (s.now < w.endsAt) return;
  if (!prepareActivityFinish(p, s.now)) {
    stopOutcome(s, 'The person stopped before completing this work.');
    return;
  }

  const action = w.action;
  if (action === 'halil-service') {
    const job = s.jobs.find((j) => j.id === o.serviceId);
    const model = job ? structuredClone(job.model) : undefined;
    if (
      job?.status !== 'active' ||
      !model ||
      !intervene(model, 'contact', 'clean').ok ||
      !runUseTest({ ...model, power: true }, 'load').passes
    ) {
      stopOutcome(s, 'The physical service could not pass its loaded check.');
      return;
    }
  }
  const result = finishActivity(p, w.option, true, s.now);
  if (!result) {
    stopOutcome(s, 'HF did not confirm activity completion.');
    return;
  }
  let text = '';
  switch (action) {
    case 'sam-correction':
      text =
        'Sam appends a correction to his original report: “I copied another player’s description. I did not reproduce it. My claim to have checked it was false. Our attended workshop observations are separate evidence; they do not replicate that old report or establish its fix.” Original report retained, attributed to Sam and its copied source.';
      break;
    case 'sam-terms':
      text =
        'Sam agrees one supervised evidence-labelling shift of 30 minutes for £6. Payment is due only after the attended shift; either person can stop. No shift has been worked and no wages paid.';
      break;
    case 'sam-shift':
      o.labelledEvidence = s.jobs.flatMap((j) =>
        j.evidence.map((e) => ({
          jobId: j.id,
          evidenceId: e.id,
          summary: e.summary,
          witnesses: e.witnessedBy ?? [e.actorId ?? 'player'],
        })),
      );
      o.samCash += w.reservedCash;
      text =
        'Sam completes the agreed 30-minute supervised shift. Together you label the existing observed workshop evidence by object and witness, leaving unchecked claims unchecked. Workshop pays £6 from its reserved cash; Sam receives £6. No independent repair credit.';
      break;
    case 'nora-trial':
    case 'nora-retrial': {
      const held = o.handle.width >= 32 && o.handle.collar;
      o.handle.trials.push({
        at: s.now,
        width: o.handle.width,
        held,
        user: 'nora',
        minutes: t.minutes,
      });
      text = `Nora actually carries the loaded workshop tray with her prototype for 10 minutes. ${held ? 'The wide collar holds; the tray stays level.' : 'The narrow handle twists; she sets the tray down and asks for a wider grip.'} This is one fictional user’s workshop result, not accessibility certification or human acceptance.`;
      break;
    }
    case 'nora-revision':
      o.handle.width = 34;
      o.handle.collar = true;
      o.handle.credit =
        'Original repair shape: Nora’s older brother. Wide collar revision: Nora, following her own attended loaded-tray trial.';
      text = `Nora fits the consumed stock gear as a wide prototype collar over 20 minutes. ${o.handle.credit} The physical revision still needs its own use trial. No family contact or forgiveness is recorded.`;
      break;
    case 'rafi-return':
      o.rafi.heldDeposit -= 4;
      o.rafi.customerReceived += 4;
      text =
        'Rafi hands the unused £4 to the customer’s return envelope with the account: £12 deposit, £8 spent on travel, £4 returned. The customer receives £4 at the workshop return counter. £8 remains owed; the separate appliance and £3 jar obligation remain unresolved.';
      break;
    case 'rafi-appliance':
      o.applianceId = sceneJob(s, 'fan', 'rafi', 'Rafi’s separate customer appliance').id;
      text =
        'Rafi brings the separate customer fan for a no-fee repair. He labels himself a dish worker and repair learner. The customer’s repair promise, deposit and jar obligation are separate. Use the ordinary bench to diagnose, repair and return it; bringing it here repairs nothing.';
      break;
    case 'rafi-deposit-loan':
      o.rafi.customerReceived += w.reservedCash;
      o.rafi.workshopDebt += w.reservedCash;
      text =
        'Rafi accepts the £8 workshop loan and returns those exact £8 to the customer at the counter. The £12 deposit is now returned. Rafi owes the workshop £8. This does not settle the separate appliance or jar.';
      break;
    case 'rafi-jar-loan':
      o.rafi.jarReceived += w.reservedCash;
      o.rafi.workshopDebt += w.reservedCash;
      text =
        'Rafi accepts the separate £3 workshop loan and returns those exact £3 to the affected kitchen jar account at the workshop counter. Jar restitution is £3; workshop debt rises by £3. No dish wages or qualification were invented.';
      break;
    case 'halil-terms':
      o.serviceId = o.applianceId;
      text =
        'Halil agrees one 30-minute contact cleaning and loaded-use check for £6, paid by the workshop after completion. The service concerns Rafi’s already admitted separate fan; no extra object, part or cash appears. He refuses a whole-day or medical commitment. Inspect its contact before asking him to start. Nuran remains deceased; rent and health obligations remain.';
      break;
    case 'halil-service': {
      const job = s.jobs.find((j) => j.id === o.serviceId);
      if (job?.status !== 'active' || !intervene(job.model, 'contact', 'clean').ok) {
        stopOutcome(s, 'The physical service could not be completed.');
        return;
      }
      job.model.power = true;
      const use = runUseTest(job.model, 'load');
      job.evidence.push({
        id: s.nextId++,
        at: s.now,
        kind: 'work',
        actorId: 'halil',
        componentId: 'contact',
        summary: 'Halil cleaned the actually inspected contact during the paid service.',
        cues: { component: 'contact', condition: 'clean' },
      });
      job.evidence.push({
        id: s.nextId++,
        at: s.now,
        kind: 'use',
        actorId: 'halil',
        condition: 'load',
        ...use,
      });
      job.contributions.push({ actorId: 'halil', action: 'clean:contact', at: s.now });
      if (!use.passes) {
        stopOutcome(s, 'The loaded use check failed. No service payment.');
        return;
      }
      job.verified.push('load');
      job.status = 'ready';
      job.completedBy = 'halil';
      o.halilCash += w.reservedCash;
      text =
        'Halil completes the bounded contact service and actual loaded check. The fan keeps turning under load. Workshop pays the reserved £6; Halil receives £6 for his reopened priced service. This is no rent settlement, medical cure, smoking recovery or end to grief.';
      break;
    }
  }
  o.receipts.push({ action, person: t.person, at: s.now, text });
  delete o.pending;
  perceive(p, [
    {
      channel: 'saw',
      kind: 'attended-workshop-outcome',
      targetId: `workshop:${action}`,
      summary: text,
      valence: 0.2,
      salience: 0.65,
      at: s.now,
    },
  ]);
  message(s, p.name, text);
}
