/** The host supplies a repair bench and its physical offers. Released HF owns
 * conditional method acquisition and every apprentice step choice. A negotiated
 * job outcome is bookkeeping; it never selects a repair action for the person. */
import {
  type Affordance,
  begin,
  clearMethodContext,
  decide,
  demonstrateMethod,
  finish,
  observeSkill,
  perceive,
  receiveMethodCues,
  reviewed,
  tick,
} from '@adam0white/human-framework';
import { liveOrdinaryTime } from './humans';
import type { MechanicalStep } from './mechanical-display';
import {
  ACCESS_MINUTES,
  assertAccessStep,
  hostPreparation,
  openAccess,
  physicalStepDuration,
  reassemble,
} from './repair-access';
import {
  applyRepair,
  checkingSpaceAvailable,
  completeDisplayStep,
  cueFor,
  inspectRepair,
  mechanicalItem,
  mechanicalMinutes,
  mechanicalSteps,
  type RepairCue,
  readLongCheck,
  repairDuration,
  testRepair,
  verificationMinutes,
} from './repairs';
import type { ActionView, GameState, RepairObject } from './types';

const semanticWork: Record<string, string> = {
  inspect: 'examining the object',
  'test-battery': 'testing the battery',
  'clean-contact': 'cleaning the contact',
  'replace-battery': 'replacing the battery',
  'fit-holder': 'fitting the holder',
  'twist-cap': 'restoring the cap contact',
  verify: 'starting the longer check',
  'check-result': 'reading the functional check',
  return: 'returning the checked repair',
  'return-unchecked': 'discussing the unfinished check',
};

type Speak = (speaker: string, text: string) => void;
/** Public teaching guidance derived from actually acquired rules, not latent faults.
 * A missing rule identifies a useful demonstration; it does not predict a choice. */
export function hasIntakeMethod(s: GameState): boolean {
  return Boolean(
    s.people.sam?.methods?.rules.some(
      (rule) =>
        rule.action === 'inspect' &&
        rule.conditions.some(
          (condition) => condition.cue === 'stage' && condition.value === 'intake',
        ) &&
        rule.evidence.some((evidence) => evidence.outcome === 'success'),
    ),
  );
}
export function freshApprentice(): NonNullable<GameState['apprentice']> {
  return {
    visitUntil: 0,
    arranged: false,
    supervisedCompleted: false,
    independentCompleted: 0,
    role: 'observer',
    completedJobIds: [],
  };
}
/** A promised watched correction remains player work. The flag records the
 * pending physical episode, never repair or knowledge by itself. */
/** An untouched intake can be examined; later corrections need observed evidence. */
export function correctiveRepairStep(
  item: RepairObject,
  now: number,
): 'inspect' | 'clean-contact' | 'replace-battery' | undefined {
  if (!item.inspected && !item.mechanicalDisplay) return 'inspect';
  const cue = cueFor(item, now);
  return cue === 'still-flickers'
    ? 'clean-contact'
    : cue === 'battery-steady'
      ? 'replace-battery'
      : undefined;
}
export function pendingCorrectiveDemonstration(s: GameState): RepairObject | undefined {
  return s.objects.find(
    (item) =>
      item.location !== 'returned' && s.unlocked.includes(`corrective-demonstration:${item.id}`),
  );
}
export function apprenticeActions(
  s: GameState,
  item: RepairObject | undefined,
  samHere: boolean,
  ownerHere: (id: string) => boolean = () => true,
): ActionView[] {
  const a = s.apprentice;
  const offers: ActionView[] = [];
  if (!s.campaign?.graduated || !s.unlocked.includes('story:observer-invite')) return offers;
  const watching =
    !!s.people.sam?.activity &&
    [
      'learning-afternoon',
      'watch-repair',
      'watch-corrective-repair',
      'watch-corrective-renewal',
    ].includes(s.people.sam.activity.affordanceId);
  if ((!a?.arranged || s.now >= a.visitUntil || (!a.jobId && !watching)) && samHere)
    offers.push({
      id: 'arrange-learning',
      label:
        a?.supervisedCompleted && !a.completedJobIds.length
          ? 'Ask Sam about taking a whole repair next'
          : 'Ask Sam to join this work',
      detail:
        'He can choose whether the time fits his own plans; an agreed stretch has an actual end.',
    });
  if (!a?.arranged || s.now >= a.visitUntil) return offers;
  const lesson = a.lastLesson;
  const lessonObject = s.objects.find((object) => object.id === lesson?.objectId);
  const justReceived =
    lesson?.eventId === `${s.seed}:${s.inputs.length}:${lesson?.objectId}:${lesson?.step}`;
  if (
    samHere &&
    lesson &&
    !lesson.explained &&
    lessonObject &&
    (item?.id === lessonObject.id ||
      (!item && (lessonObject.location !== 'returned' || justReceived)))
  )
    offers.push({
      id: 'explain-step',
      label: `To Sam: Talk through ${lessonObject.title} (optional)`,
      detail: `Discuss the result of ${semanticWork[lesson.step] ?? 'the step'} he actually watched on this object. Talking is optional.`,
      kind: 'quiet',
    });
  if (
    samHere &&
    !a.jobId &&
    !item &&
    ownerHere('dad') &&
    !s.objects.some((object) => object.id === 'recovery-learning-light') &&
    s.objects.some(
      (object) => object.id === 'supervised-retry-light' && object.location === 'returned',
    ) &&
    !a.supervisedCompleted
  )
    offers.push({
      id: 'recovery-learning-intake',
      label: watching
        ? 'Bring Dad’s retained work light to the bench with Sam'
        : 'Bring Dad’s retained work light to the bench',
      detail: watching
        ? 'Dad’s work light, with its own spare cell. Examine it with Sam watching; he can follow what you do and what happens.'
        : 'Dad’s work light, with its own spare cell. You can examine it yourself; Sam is not currently watching.',
      kind: 'primary',
    });
  if (!a.jobId && !item) {
    if (!s.objects.some((x) => x.id === 'lesson-battery'))
      offers.push({
        id: 'learning-light',
        label: 'Ask Sam to bring the little spare lamp he mentioned',
        detail: 'A real repair to discuss together; he brings a replacement cell with it.',
      });
    else if (!s.objects.some((x) => x.id === 'lesson-contact') && ownerHere('dad'))
      offers.push({
        id: 'learning-light',
        label: 'Look at Dad’s second small lamp with Sam',
        detail: 'The earlier test is useful only if its observation matches this light.',
      });
    else if (!a.supervisedCompleted && !s.objects.some((x) => x.id === 'supervised-light'))
      offers.push({
        id: 'supervised-intake',
        label: 'Try an unfamiliar lamp with Sam beside you',
        detail: 'Sam takes the steps. You remain responsible while he practices.',
      });
    else if (
      !a.supervisedCompleted &&
      s.objects.some(
        (x) => x.id === 'supervised-light' && x.location === 'returned' && x.playerAssisted,
      ) &&
      !s.objects.some((x) => x.id === 'supervised-retry-light') &&
      ownerHere('dad')
    ) {
      offers.push({
        id: 'supervised-retry-intake',
        label: s.unlocked.includes('supervised-retry-postponed')
          ? 'Revisit Dad’s labelled inspection light with Sam'
          : 'Try Dad’s labelled inspection light with Sam nearby',
        detail:
          'One additional real request. The earlier rescued lights keep their history; Sam still chooses every step.',
        kind: 'primary',
      });
      if (!s.unlocked.includes('supervised-retry-postponed'))
        offers.push({
          id: 'postpone-supervised-retry',
          label: 'Leave Dad’s additional light for another day',
          detail: 'Keep the request available; no repair or teaching is credited.',
        });
    } else if (
      a.supervisedCompleted &&
      ownerHere('nora') &&
      !a.completedJobIds.length &&
      !s.objects.some((x) => x.id === 'independent-light')
    )
      offers.push({
        id: 'independent-intake',
        label: 'Offer Sam responsibility for Nora’s porch light',
        detail: 'Intake, diagnosis, work and the longer check. You keep price and date promises.',
      });
    else if (a.completedJobIds.length && !s.objects.some((x) => x.id === 'exception-torch'))
      offers.push({
        id: 'exception-intake',
        label: 'Ask Sam about a different sort of torch',
        detail: 'An honest unfamiliar case; knowing lamp methods need not cover this one.',
      });
  }
  if (
    !a.jobId &&
    item &&
    !item.repaired &&
    (item.inspected || item.mechanicalDisplay || hasIntakeMethod(s)) &&
    item.location !== 'returned' &&
    !s.unlocked.includes(`corrective-demonstration:${item.id}`)
  ) {
    offers.push({
      id: a.supervisedCompleted || item.mechanicalDisplay ? 'delegate-repair' : 'supervised-repair',
      label: item.mechanicalDisplay
        ? 'Ask Sam to take this display as a separate unpaid learning favour'
        : a.supervisedCompleted || item.mechanicalDisplay
          ? 'Offer Sam this whole repair'
          : 'Let Sam try while you stay nearby',
      detail: item.mechanicalDisplay
        ? 'A separate voluntary learning favour, with no customer fee or wage. Existing paid jobs and reserved wages stay in place. Sam can decline and chooses each step from what he has learned.'
        : 'Sam chooses the steps from what he has learned. He can ask for help.',
    });
  }
  if (a.jobId)
    offers.push({
      id: 'watch-sam',
      label: a.needsHelp ? 'Discuss where Sam stopped' : 'Give Sam some room to work',
      detail:
        a.needsHelp ?? a.pauseReason ?? 'Twenty minutes; you can also work on another object.',
    });
  if (
    a.needsHelp &&
    a.jobId &&
    samHere &&
    s.objects.some((o) => o.id === a.jobId && o.mechanicalDisplay && o.verified)
  )
    offers.push({
      id: 'retry-mechanical-collection',
      label: 'Ask Sam to offer the checked display to its owner again',
      detail: 'The completed physical work stays recorded. The owner must attend the handover.',
    });
  if (
    a.needsHelp &&
    a.jobId &&
    samHere &&
    s.objects.some((o) => o.id === a.jobId && o.mechanicalDisplay && !o.verified)
  )
    offers.push({
      id: 'retry-mechanical-work',
      label: 'Ask Sam to reconsider the kept mechanical step',
      detail:
        'His own plans and observed evidence still govern the choice; no work or teaching is granted.',
    });
  if (a.needsHelp && a.jobId && samHere)
    offers.push({
      id: 'reconsider-sam',
      label: 'Ask Sam to reconsider the kept observation with you nearby',
      detail:
        'Try the retained observation again after showing him a missing method. Without new learning, he may stop at the same step.',
      kind: 'primary',
    });
  if (a.needsHelp && a.jobId && samHere && s.now < a.visitUntil) {
    const stopped = s.objects.find((x) => x.id === a.jobId);
    const step = stopped ? correctiveRepairStep(stopped, s.now) : undefined;
    if (stopped && step && (step !== 'replace-battery' || s.parts.batteries > 0))
      offers.push({
        id: 'show-corrective-step',
        label:
          step === 'inspect'
            ? 'Show Sam how you begin looking'
            : step === 'replace-battery'
              ? 'Show Sam how to replace the tired battery'
              : 'Show Sam the contact repair on this stopped light',
        detail:
          'Ask him to watch while you take responsibility for the next physical step. If he joins you, he can learn from what actually happens.',
        kind: 'primary',
      });
  }
  if (a.needsHelp && a.jobId)
    offers.push({
      id: 'take-over-repair',
      label: 'Take responsibility for the stopped repair',
      detail: 'You’ll finish this one; Sam’s observations stay with it.',
    });
  return offers;
}
/** Prepare a real watched correction; the ordinary player repair and its result
 * must still occur before HF can acquire any successful method. */
export function prepareCorrectiveDemonstration(s: GameState, say: Speak): void {
  const a = s.apprentice;
  const item = s.objects.find((x) => x.id === a?.jobId);
  const sam = s.people.sam;
  const correction = item ? correctiveRepairStep(item, s.now) : undefined;
  if (
    !a?.needsHelp ||
    !item ||
    !sam ||
    !a.arranged ||
    s.now >= a.visitUntil ||
    !correction ||
    (correction === 'replace-battery' && s.parts.batteries <= 0)
  )
    throw Error('No supported attended correction is available');
  if (a.visitUntil < s.now + 20) {
    say(
      'Sam',
      'Our afternoon is nearly over. Let’s leave the labelled light here and look at the next step together when we have time.',
    );
    return;
  }
  const newWatchId =
    sam.activity?.affordanceId === 'watch-corrective-repair'
      ? 'watch-corrective-renewal'
      : 'watch-corrective-repair';
  const offers: Affordance[] = [
    {
      id: newWatchId,
      action: 'learn',
      label:
        correction === 'inspect'
          ? 'Watch the first inspection of the stopped object'
          : correction === 'replace-battery'
            ? 'Watch the observed battery change'
            : 'Watch the real contact correction',
      duration: 30,
      effort: 0.02,
      focus: 0.2,
      with: ['player'],
      advertises: { competence: 0.15, belonging: 0.12 },
    },
    {
      id: 'own-correction-time',
      action: 'rest',
      label: 'Keep my own time',
      duration: 30,
      effort: 0,
      advertises: { leisure: 0.02, autonomy: 0.03 },
    },
  ];
  if (sam.activity) offers.push(sam.activity.affordance);
  const decision = decide(sam, offers);
  const chosen = offers.find((x) => x.id === decision.chosenAffordanceId);
  const current = sam.activity;
  const alreadyWatching =
    current &&
    [
      'learning-afternoon',
      'watch-repair',
      'watch-corrective-repair',
      'watch-corrective-renewal',
    ].includes(current.affordanceId) &&
    current.action === 'learn' &&
    current.startedAt <= s.now &&
    current.endsAt >= s.now + 20 &&
    a.visitUntil >= s.now + 20 &&
    !sam.body.asleep &&
    !sam.body.downed &&
    sam.body.alive &&
    chosen?.id === current.affordanceId;
  if (chosen?.id !== newWatchId && !alreadyWatching) {
    if (current && current.endsAt > s.now && chosen?.id === current.affordanceId) {
      s.conversationPause = {
        participantId: 'sam',
        actionId: 'show-corrective-step',
        activityId: current.affordanceId,
        until: current.endsAt,
        label: current.affordance.label,
      };
      const clock = `${String(Math.floor((current.endsAt % 1440) / 60)).padStart(2, '0')}:${String(current.endsAt % 60).padStart(2, '0')}`;
      say(
        'Sam',
        `I am still ${current.affordance.label.toLowerCase()}, until ${clock}. Leave time for that to finish, then ask again; I have not watched the correction yet.`,
      );
    } else {
      s.conversationPause = undefined;
      say(
        'Sam',
        chosen?.id === 'own-correction-time'
          ? 'I would rather keep my own time now. Leave the stopped light labelled; I have not watched its correction.'
          : 'I cannot watch that correction now. Keep the light labelled; we can ask again when it fits my plans.',
      );
    }
    return;
  }
  if (!alreadyWatching) {
    if (sam.activity)
      finish(sam, {
        affordanceId: sam.activity.affordanceId,
        action: sam.activity.action,
        at: sam.now,
        status: 'interrupted',
        summary: 'Chose to watch a real correction to the stopped repair.',
      });
    if (!chosen || !begin(sam, chosen, decision)) {
      say('Sam', 'I am not ready to watch that correction. Keep it labelled for now.');
      return;
    }
  }
  s.conversationPause = undefined;
  const flag = `corrective-demonstration:${item.id}`;
  if (!s.unlocked.includes(flag)) s.unlocked.push(flag);
  item.playerAssisted = true;
  item.independent = false;
  item.assignedTo = undefined;
  item.location = 'bench';
  s.focusId = item.id;
  a.jobId = undefined;
  a.pending = undefined;
  a.needsHelp = undefined;
  a.pauseReason = undefined;
  say(
    'You',
    correction === 'inspect'
      ? 'Let’s begin by looking closely. Watch what I check before deciding what needs doing.'
      : correction === 'replace-battery'
        ? 'The known-good cell made the light steady. Watch while I fit the matching replacement; we can see whether it stays that way.'
        : 'The good cell still flickers when moved. Watch the contact while I work on it—we can see whether that changes anything.',
  );
}
export function arrangeLearning(s: GameState, say: Speak): void {
  const sam = s.people.sam;
  if (!sam) return;
  liveOrdinaryTime(sam, s.now);
  const prior = sam.activity;
  for (const flag of s.unlocked) {
    const shift = /^service-counter:(\d+):(\d+)$/.exec(flag);
    if (
      shift &&
      Number(shift[2]) > s.now &&
      !s.unlocked.includes(`heard-counter:${shift[1]}:${shift[2]}`)
    ) {
      s.unlocked.push(`heard-counter:${shift[1]}:${shift[2]}`);
      say(
        'Sam',
        'My agreed parts-counter shift is from one until five on the third working day. I will keep the repair notes if I need to stop for it.',
      );
    }
  }
  const continuingJob = Boolean(s.apprentice?.jobId);
  const establishedRepairer = Boolean(s.apprentice?.completedJobIds.length);
  const offers: Affordance[] = [
    {
      id: 'learning-afternoon',
      action: continuingJob || establishedRepairer ? 'work' : 'learn',
      label: continuingJob
        ? 'Resume responsibility for the agreed whole repair'
        : establishedRepairer
          ? 'Share another stretch at the bench'
          : 'Spend a stretch learning alongside my friend',
      duration: 150,
      effort: 0.02,
      focus: 0.15,
      with: ['player'],
      advertises: { competence: 0.15, belonging: 0.12, autonomy: 0.03 },
    },
    {
      id: 'walk-dog',
      action: 'walk',
      label: 'Keep my dog-walking obligation',
      duration: 50,
      effort: 0.06,
      advertises: { leisure: 0.2, autonomy: 0.1 },
    },
    {
      id: 'own-afternoon',
      action: 'rest',
      label: 'Keep my own time',
      duration: 30,
      effort: 0,
      advertises: { leisure: 0.12 },
    },
  ];
  if (prior) offers.push(prior.affordance);
  const decision = decide(sam, offers);
  const chosen = offers.find((x) => x.id === decision.chosenAffordanceId);
  s.apprentice ??= freshApprentice();
  if (chosen?.id === 'learning-afternoon') {
    if (prior)
      finish(sam, {
        affordanceId: prior.affordanceId,
        action: prior.action,
        at: sam.now,
        status: 'interrupted',
        summary: 'Chose the agreed stretch at the bench.',
      });
    if (continuingJob) {
      // Existing physical repair activities own this visit's time.
      if (!begin(sam, { ...chosen, duration: 0 }, decision)) {
        say('Sam', 'I cannot begin that stretch now. Keep the work labelled for another time.');
        return;
      }
      finish(sam, {
        affordanceId: chosen.id,
        action: chosen.action,
        at: sam.now,
        status: 'completed',
        summary: 'Agreed a bounded stretch at the bench.',
        needs: { belonging: 0.02 },
      });
    } else {
      // Watching occupies real time; only actual observed actions acquire methods.
      const started = begin(
        sam,
        {
          ...chosen,
          action: 'learn',
          label: 'Watching actual repair steps beside my friend',
          advertises: { belonging: 0.02 },
          duration: 150,
        },
        decision,
      );
      if (!started) {
        say('Sam', 'I cannot begin watching now. Keep the work labelled for another time.');
        return;
      }
    }
    s.samPlans ??= { invitation: 'pending', heardAt: s.now };
    s.samPlans.invitation = 'accepted';
    s.conversationPause = undefined;
    s.samPlans.availableAfter = undefined;
    s.samPlans.availabilityReason = undefined;
    s.samPlans.heardAt = s.now;
    s.apprentice.arranged = true;
    s.apprentice.visitUntil = s.now + 150;
    s.apprentice.role =
      (continuingJob && !s.apprentice.supervised) || establishedRepairer ? 'repairer' : 'trainee';
    say(
      'Sam',
      continuingJob
        ? 'I can give this repair another stretch. I will continue from the labelled observations and the step where I stopped; my own plans still matter.'
        : establishedRepairer
          ? 'I can share another stretch at the bench. I know the light work we have tried; unfamiliar observations still deserve a question. My own plans still matter.'
          : `I can set aside a stretch, up to ${String(Math.floor((s.apprentice.visitUntil % 1440) / 60)).padStart(2, '0')}:${String(s.apprentice.visitUntil % 60).padStart(2, '0')}. I’ll watch the steps and their actual results. You can explain a distinction if it would help. If my own plans need me sooner, we will keep the notes and stop.`,
    );
  } else {
    if (chosen && chosen.id !== prior?.affordanceId) {
      if (prior)
        finish(sam, {
          affordanceId: prior.affordanceId,
          action: prior.action,
          at: sam.now,
          status: 'interrupted',
          summary: 'Chose my own plans instead of the bench.',
        });
      begin(sam, chosen, decision);
    }
    s.samPlans ??= { invitation: 'pending', heardAt: s.now };
    s.samPlans.heardAt = s.now;
    const current = sam.activity;
    if (current && current.endsAt > s.now) {
      const until = current.endsAt;
      const time = `${String(Math.floor((until % 1440) / 60)).padStart(2, '0')}:${String(until % 60).padStart(2, '0')}`;
      const reason =
        current.action === 'eat'
          ? 'finish my meal'
          : current.action === 'walk'
            ? 'take the dog out'
            : current.action === 'rest'
              ? 'have a quiet break'
              : current.action === 'read'
                ? 'finish this bit of reading'
                : 'finish what I’m doing';
      say(
        'Sam',
        `Let me ${reason} first — until about ${time}. You can ask again then; I haven’t agreed to watch yet.`,
      );
      s.samPlans.availableAfter = until;
      s.samPlans.availabilityReason = `Sam asked to ${reason} first, until about ${time}; watching still needs his agreement.`;
      s.conversationPause = {
        participantId: 'sam',
        actionId: 'arrange-learning',
        activityId: current.affordanceId,
        until,
        label: current.affordance.label,
      };
    } else {
      say('Sam', 'Not just now. I’d like some time to myself. Keep your work where it is.');
      s.samPlans.availableAfter = undefined;
      s.samPlans.availabilityReason = undefined;
    }
  }
}
/** Advance an agreed observer through real time before accepting its evidence.
 * HF compares continuing attention with due duties; a stopped watch cannot
 * certify the whole demonstration merely because its original end was later. */
export function advanceWatching(s: GameState, until: number, here: (at: number) => boolean): void {
  const sam = s.people.sam;
  const watch = sam?.activity;
  if (
    !sam ||
    !watch ||
    ![
      'learning-afternoon',
      'watch-repair',
      'watch-corrective-repair',
      'watch-corrective-renewal',
    ].includes(watch.affordanceId) ||
    (s.apprentice?.jobId && !s.apprentice.needsHelp)
  )
    return;
  while (sam.now < Math.min(until, watch.endsAt)) {
    tick(sam, sam.now + 1);
    if (
      !here(sam.now) ||
      !sam.body.alive ||
      sam.body.downed ||
      sam.body.asleep ||
      sam.activity !== watch ||
      watch.interrupt
    ) {
      if (sam.activity === watch)
        finish(sam, {
          affordanceId: watch.affordanceId,
          action: watch.action,
          at: sam.now,
          status: 'interrupted',
          summary: 'Stopped watching before the demonstration finished.',
        });
      return;
    }
    if (sam.now < watch.endsAt) {
      const duties = collectionDuties(sam);
      const choice = decide(sam, [watch.affordance, ...duties]);
      if (choice.chosenAffordanceId !== watch.affordanceId) {
        finish(sam, {
          affordanceId: watch.affordanceId,
          action: watch.action,
          at: sam.now,
          status: 'interrupted',
          summary: 'Stopped watching for my own plans.',
        });
        const duty = duties.find((offer) => offer.id === choice.chosenAffordanceId);
        if (duty) begin(sam, duty, choice);
        return;
      }
      reviewed(sam);
    }
  }
}

export function recordLesson(
  s: GameState,
  item: RepairObject,
  step: string,
  before: RepairCue,
  success: boolean,
  minutes: number,
  attended: boolean,
  sharedOwnerHandover = false,
): void {
  const a = s.apprentice,
    sam = s.people.sam;
  if (step === 'return' && item.location === 'returned')
    s.unlocked = s.unlocked.filter((flag) => flag !== `corrective-demonstration:${item.id}`);
  if (
    !attended ||
    !sam ||
    (!sharedOwnerHandover && !sam?.activity) ||
    !sam.body.alive ||
    sam.body.asleep ||
    sam.body.downed ||
    (!sharedOwnerHandover && Boolean(sam.activity?.interrupt)) ||
    (!sharedOwnerHandover && (sam?.activity?.startedAt ?? Infinity) > s.now - minutes) ||
    (!sharedOwnerHandover && (sam?.activity?.endsAt ?? -Infinity) < s.now) ||
    (!sharedOwnerHandover &&
      ![
        'learning-afternoon',
        'watch-repair',
        'watch-corrective-repair',
        'watch-corrective-renewal',
      ].includes(sam?.activity?.affordanceId ?? '')) ||
    !a?.arranged ||
    (!sharedOwnerHandover && s.now > a.visitUntil) ||
    !sam ||
    (a.jobId && (!a.needsHelp || a.jobId === item.id)) ||
    // Light access is automatic preparation, not a selectable apprentice method.
    // Mechanical objects expose these steps as actual conditional choices.
    (['open-access', 'reassemble'].includes(step) && !item.mechanicalDisplay) ||
    ![
      'inspect',
      'test-mechanical-empty',
      'test-mechanical-loaded',
      'open-access',
      'reassemble',
      'clear-obstruction',
      'test-battery',
      'clean-contact',
      'replace-battery',
      'verify',
      'check-result',
      'wait-check',
      'return',
    ].includes(step)
  ) {
    // A physical correction outside the witnessed interval closes the invitation,
    // not a lesson. The already-repaired object cannot supply that missed proof.
    if (
      success &&
      ((step === 'inspect' && item.inspected) ||
        (['clean-contact', 'replace-battery'].includes(step) && item.repaired))
    )
      s.unlocked = s.unlocked.filter((flag) => flag !== `corrective-demonstration:${item.id}`);
    return;
  }
  receiveMethodCues(sam, {
    contextId: `demonstration:${item.id}`,
    cues: [{ cue: 'stage', value: before }],
  });
  perceive(sam, [
    {
      at: sam.now,
      channel: 'saw',
      actorId: 'player',
      kind: 'repair-demonstration',
      summary: `I saw ${semanticWork[step] ?? 'the performed work'}: ${item.observations.at(-1) ?? 'the checked light going back to its owner'}.`,
      salience: 0.9,
    },
  ]);
  observeSkill(sam, 'repair', minutes, s.people.player?.skills.repair?.level ?? 0.12, 'motor');
  a.lastLesson = {
    objectId: item.id,
    step,
    cue: before,
    success,
    eventId: `${s.seed}:${s.inputs.length}:${item.id}:${step}`,
    explained: false,
  };
  explainLesson(s, () => {}, true, true);
}
export function explainLesson(
  s: GameState,
  say: Speak,
  attending: boolean,
  automatic = false,
): void {
  const lesson = s.apprentice?.lastLesson,
    sam = s.people.sam;
  if (!attending || !lesson || !sam || lesson.explained) return;
  const contextId = `demonstration:${lesson.objectId}`;
  receiveMethodCues(sam, { contextId, cues: [{ cue: 'stage', value: lesson.cue }] });
  const acquired =
    lesson.learnedAutomatically ||
    demonstrateMethod(sam, {
      id: lesson.cue.startsWith('mechanical-')
        ? 'careful-mechanical-display'
        : 'careful-light-repair',
      demonstrationId: lesson.eventId,
      contextId,
      conditions: [{ cue: 'stage', value: lesson.cue }],
      action: lesson.step,
      sourceId: 'player',
      outcome: lesson.success ? 'success' : 'failure',
    });
  if (automatic) lesson.learnedAutomatically = acquired;
  else lesson.explained = acquired;
  if (
    acquired &&
    lesson.success &&
    ['inspect', 'clean-contact', 'replace-battery'].includes(lesson.step)
  )
    s.unlocked = s.unlocked.filter(
      (flag) => flag !== `corrective-demonstration:${lesson.objectId}`,
    );
  if (acquired && s.apprentice?.jobId) {
    const assisted = s.objects.find((x) => x.id === s.apprentice?.jobId);
    if (assisted) {
      assisted.playerAssisted = true;
      assisted.independent = false;
    }
  }
  if (automatic) return;
  const reasons: Partial<Record<RepairCue, string>> = {
    'mechanical-intake': 'Look at the assembly before choosing work.',
    'mechanical-empty': 'Compare the empty tray without assuming that establishes loaded motion.',
    'mechanical-loaded': 'Fit the same four cards and compare the loaded motion.',
    'mechanical-access':
      'Both comparisons are recorded. Lift and retain the tray to examine the accessible rim.',
    'mechanical-obstruction':
      'The comparisons and exposed rim show card scrap. Remove that observed obstruction, not a guessed part.',
    'mechanical-refit': 'Retain the same tray and refit it before a loaded circuit check.',
    'mechanical-circuit': 'Attend a complete loaded circuit; idle time cannot establish movement.',
    'mechanical-checked': 'Return only what the complete circuit actually established.',

    intake: 'Look before replacing anything.',
    'needs-test':
      'Grime and an old cell can both be plausible. A known-good battery separates them.',
    'battery-steady':
      'The same lamp becomes steady with the test cell. Replace the original battery.',
    'still-flickers': 'A good cell still flickers when moved. Restore the contact instead.',
    'light-steady':
      'At that step, the repaired light gave a steady glow. You started its longer run; the movement and switching check still lay ahead of that demonstration.',
    'check-ready':
      'The timed run had finished. You then moved and switched it; it stayed steady, completing the check.',
    checked: 'A checked light can go home with an honest account of the work.',
  };
  const demonstratedStep: Record<string, string> = {
    'test-mechanical-empty': 'comparing the empty tray',
    'test-mechanical-loaded': 'comparing the same tray with its cards',
    'open-access': 'lifting and retaining the tray',
    reassemble: 'refitting the retained tray',
    'clear-obstruction': 'removing the observed card scrap',
    inspect: 'looking closely before choosing work',
    'test-battery': 'trying a known-good battery',
    'replace-battery': 'replacing the old battery',
    'clean-contact': 'cleaning and reseating the contact',
    verify: 'starting the longer light run',
    'wait-check': 'letting the light run long enough',
    'check-result': 'moving and switching the light after its run',
    return: 'returning the checked object with an honest account',
  };
  const stepDescription = demonstratedStep[lesson.step] ?? 'the demonstrated work';
  say(
    'You',
    !lesson.success
      ? `Here, ${stepDescription} did not establish a successful result on this object. Keep its actual observation; that attempt is not a successful method for it.`
      : (reasons[lesson.cue] ??
          'Explain the observation and the result, without pretending it covers every kind of fault.'),
  );
  say(
    'Sam',
    acquired
      ? !lesson.success
        ? `I saw that ${stepDescription} did not restore it here. I will keep that failure separate from a demonstrated repair.`
        : lesson.step === 'inspect'
          ? 'Start with what I can actually see. I’ll keep that distinction.'
          : lesson.step === 'check-result'
            ? 'The time alone wasn’t the check. You moved it afterward and it stayed steady.'
            : lesson.step === 'return'
              ? 'I can tell the owner what we established, rather than promising more.'
              : `When I see that observation, I can try ${stepDescription}, as you demonstrated. I’ll keep that connection for another matching observation.`
      : 'I didn’t take that in properly. Could we look at the observation again?',
  );
}
export function apprenticeOffers(
  s: Pick<GameState, 'parts' | 'objects' | 'checkingPlaces'>,
  item: RepairObject,
  now: number,
): Affordance[] {
  const ids = item.mechanicalDisplay
    ? !item.inspected
      ? ['inspect']
      : item.verified
        ? ['return']
        : mechanicalSteps(mechanicalItem(item))
    : !item.inspected
      ? ['inspect']
      : item.verified
        ? ['return']
        : item.checkStarted !== undefined
          ? now - item.checkStarted >= 20
            ? ['check-result', 'return-unchecked']
            : ['wait-check', 'return-unchecked']
          : item.repaired
            ? [
                checkingSpaceAvailable(s, item.id) ? 'verify' : 'wait-check-place',
                'return-unchecked',
              ]
            : [
                'test-battery',
                'clean-contact',
                ...(s.parts.batteries > 0 ? ['replace-battery'] : []),
                ...(s.parts.holders > 0 ? ['fit-holder'] : []),
                ...(item.form === 'torch' ? ['twist-cap'] : []),
              ];
  return [...ids, 'request-help'].map((id) => ({
    id,
    action: id,
    label:
      id === 'request-help'
        ? 'Ask for help before guessing'
        : (semanticWork[id] ?? 'The chosen repair step'),
    duration:
      item.mechanicalDisplay && id in mechanicalMinutes
        ? mechanicalMinutes[id as MechanicalStep]
        : physicalStepDuration(item, id, repairDuration(id)),
    effort: id === 'request-help' || id === 'wait-check' ? 0 : 0.12,
    focus: 0.25,
    skill: id === 'request-help' ? undefined : { id: 'repair', difficulty: 0.25 },
    methodContext: item.id,
    ...(id === 'return' ? { norms: [{ normId: 'lying', relation: 'fulfills' as const }] } : {}),
    advertises: { competence: id === 'request-help' ? 0.035 : 0.002 },
  }));
}
export function startApprenticeJob(
  s: GameState,
  item: RepairObject,
  supervised: boolean,
  say: Speak,
): void {
  const a = s.apprentice,
    sam = s.people.sam;
  if (!a || !sam) return;
  const prior = sam.activity;
  if (prior)
    finish(sam, {
      affordanceId: prior.affordanceId,
      action: prior.action,
      at: sam.now,
      status: 'interrupted',
      summary: 'Set my own activity aside for the agreed repair.',
    });
  clearMethodContext(sam);
  a.jobId = item.id;
  a.needsHelp = undefined;
  a.pending = undefined;
  a.supervised = supervised;
  item.assignedTo = 'sam';
  item.playerAssisted ||=
    supervised ||
    item.inspected ||
    item.tested ||
    item.attempted > 0 ||
    item.checkStarted !== undefined;
  item.independent = !item.playerAssisted;
  item.location = 'bench';
  s.focusId = null;
  say(
    'Sam',
    supervised
      ? 'I’ll try it with you nearby. I’ll say if I don’t know what an observation means.'
      : 'I’ll take this from the owner’s description through the check. You can use the other end of the bench.',
  );
}
export function completeApprenticeJob(s: GameState, item: RepairObject, say: Speak): void {
  const a = s.apprentice;
  if (!a || a.jobId !== item.id || !item.verified || item.awaitingCollection) return;
  item.completedBy = 'sam';
  if (a.supervised) {
    if (!a.supervisedCompleted)
      say(
        'Sam',
        'That was the whole job, with you nearby. Next time, ask whether I can take a familiar light from intake through collection while you work on something else.',
      );
    a.supervisedCompleted = true;
  } else if (item.independent && !a.completedJobIds.includes(item.id)) {
    a.completedJobIds.push(item.id);
    a.independentCompleted = a.completedJobIds.length;
    a.role = 'repairer';
    say(
      'Sam',
      'The owner has it back, checked. You didn’t need to choose the steps for me. You can offer me another object when my plans allow.',
    );
  }
  a.jobId = undefined;
  a.pending = undefined;
  a.needsHelp = undefined;
  const sam = s.people.sam;
  if (sam) clearMethodContext(sam);
}
export function advanceApprentice(
  s: GameState,
  until: number,
  say: Speak,
  ownerHere: (id: string, at: number) => boolean,
  workerHere: (at: number) => boolean = () => true,
): void {
  const a = s.apprentice,
    sam = s.people.sam;
  if (!a?.jobId || !sam) return;
  const item = s.objects.find((x) => x.id === a.jobId);
  if (!item) return;
  const sessionWasActive = sam.now < a.visitUntil;
  while (sam.now < until && !a.needsHelp && a.jobId) {
    if (item.location === 'returned') {
      if (item.awaitingCollection) {
        for (let at = sam.now; at <= until; at++)
          if (workerHere(at) && ownerHere(item.owner.toLowerCase(), at)) {
            item.awaitingCollection = false;
            item.collectedAt = at;
            break;
          }
      }
      liveOrdinaryTime(sam, until);
      if (!item.awaitingCollection) completeApprenticeJob(s, item, say);
      break;
    }
    if (
      !a.pending &&
      item.checkStarted !== undefined &&
      !item.verified &&
      sam.now < item.checkStarted + verificationMinutes(item)
    ) {
      // The selected physical test keeps running; no learned action is needed
      // merely for its timer. Result-reading remains a later person decision.
      liveOrdinaryTime(
        sam,
        Math.min(until, item.checkStarted + verificationMinutes(item)),
        workerHere,
      );
      continue;
    }
    if (!workerHere(sam.now)) {
      if (a.pending) {
        const prior = sam.activity;
        a.pausedStep = {
          step: a.pending.step,
          remaining: Math.max(1, a.pending.endsAt - sam.now),
          ...(a.pending.preparation ? { preparation: a.pending.preparation } : {}),
        };
        if (prior)
          finish(sam, {
            affordanceId: prior.affordanceId,
            action: prior.action,
            at: sam.now,
            status: 'interrupted',
            summary: 'Stopped bench work for my own obligation.',
          });
        a.pending = undefined;
      }
      if (!a.pauseReason)
        say(
          'Sam',
          'I need to stop for my own plans. Keep it at this step; we can arrange another stretch at the bench.',
        );
      a.pauseReason =
        'Sam’s own plans pause this repair. Its observations and unfinished step are kept.';
      liveOrdinaryTime(sam, until, (at) => workerHere(at));
      break;
    }
    if (!a.pending) {
      if (sam.now >= a.visitUntil || !sam.body.alive || sam.body.downed) {
        const reason =
          'The agreed bench session has ended. Arrange another stretch; the work is kept.';
        if (sessionWasActive && a.pauseReason !== reason) say('Sam', reason);
        a.pauseReason = reason;
        break;
      }
      const current = sam.activity;
      if (
        current &&
        item.mechanicalDisplay &&
        !['learning-afternoon', 'watch-repair'].includes(current.affordanceId)
      ) {
        const candidates = apprenticeOffers(s, item, sam.now),
          choice = decide(sam, [...candidates, ...collectionDuties(sam)]);
        if (choice.chosenAffordanceId === current.affordanceId) {
          a.needsHelp =
            'Sam is finishing his own activity before this mechanical step. The work is kept.';
          break;
        }
      }
      if (current)
        finish(sam, {
          affordanceId: current.affordanceId,
          action: current.action,
          at: sam.now,
          status: 'interrupted',
          summary: 'Returned to the agreed repair.',
        });
      const cue = cueFor(item, sam.now);
      receiveMethodCues(sam, { contextId: item.id, cues: [{ cue: 'stage', value: cue }] });
      a.pauseReason = undefined;
      const offers = apprenticeOffers(s, item, sam.now).map((offer) =>
        a.pausedStep?.step === offer.id ? { ...offer, duration: a.pausedStep.remaining } : offer,
      );
      const duties = item.mechanicalDisplay ? collectionDuties(sam) : [];
      const decision = decide(sam, [...offers, ...duties]);
      const chosen = offers.find((x) => x.id === decision.chosenAffordanceId);
      item.stepDecisions ??= [];
      item.stepDecisions.push({
        at: sam.now,
        action: decision.chosenAffordanceId,
        methods:
          decision.considered
            .find((x) => x.affordanceId === decision.chosenAffordanceId)
            ?.terms.filter((t) => t.source.startsWith('method:'))
            .map((t) => t.source) ?? [],
      });
      if (!chosen || chosen.id === 'request-help') {
        const duty = duties.find((x) => x.id === decision.chosenAffordanceId);
        if (duty) {
          begin(sam, duty, decision);
          a.needsHelp =
            'Sam is keeping an agreed appointment. The incomplete mechanical step has not been recorded; ask him to resume later.';
          break;
        }
        a.needsHelp =
          'Sam is unsure what the observation supports. He has stopped instead of guessing.';
        say('Sam', 'I don’t know a method for this observation. Will you look with me?');
        break;
      }
      const preparation = a.pausedStep?.preparation ?? hostPreparation(item, chosen.id);
      // The learned choice remains semantic. Its compulsory physical prerequisite
      // is a separate unskilled handling activity, not an acquired access method.
      const actualOffer = preparation
        ? {
            ...chosen,
            action: 'handle',
            label: `${preparation === 'reassemble' ? 'Refit the retained cover' : 'Open the retained access'} before ${semanticWork[chosen.id] ?? 'the chosen repair step'}`,
            duration: a.pausedStep?.preparation ? a.pausedStep.remaining : ACCESS_MINUTES,
            skill: undefined,
            methodContext: undefined,
          }
        : chosen;
      if (item.mechanicalDisplay && chosen.id === 'return') {
        const owner = s.people[item.owner.toLowerCase()];
        const handover: Affordance = {
          id: `mechanical-collection:${item.id}`,
          action: 'talk',
          label: 'Receive my checked display from Sam',
          advances: s.operationsPurposeIds?.[`mechanical-return:${item.id}`]
            ? [s.operationsPurposeIds[`mechanical-return:${item.id}`]].filter((id): id is string =>
                Boolean(id),
              )
            : undefined,
          duration: actualOffer.duration,
          effort: 0,
          with: ['sam'],
          advertises: { autonomy: 0.06, belonging: 0.05 },
        };
        if (owner && owner.now < sam.now) liveOrdinaryTime(owner, sam.now);
        const duties = owner ? collectionDuties(owner) : [];
        const choice = owner ? decide(owner, [handover, ...duties]) : undefined;
        if (
          !owner ||
          !ownerHere(owner.id, sam.now) ||
          choice?.chosenAffordanceId !== handover.id ||
          !begin(owner, handover, choice)
        ) {
          a.needsHelp =
            'The checked display is ready, but its owner has not agreed to this handover. Ask Sam to offer collection again when the owner is available.';
          say(
            'Sam',
            'The check is complete. Its owner cannot take it with me now; I will keep it safely labelled.',
          );
          break;
        }
      }
      const lastDecision = item.stepDecisions.at(-1);
      if (preparation && lastDecision) lastDecision.hostPreparation = preparation;
      if (!begin(sam, actualOffer, decision)) {
        a.needsHelp = 'Sam cannot do that step right now.';
        break;
      }
      a.pending = {
        step: chosen.id,
        endsAt: sam.now + actualOffer.duration,
        ...(preparation ? { preparation } : {}),
      };
      a.pausedStep = undefined;
    }
    const pending = a.pending;
    let end = Math.min(until, pending.endsAt);
    for (let at = sam.now + 1; at <= end; at++)
      if (!workerHere(at)) {
        end = at;
        break;
      }
    if (item.mechanicalDisplay && pending.step === 'return') {
      const owner = s.people[item.owner.toLowerCase()];
      const collectionId = `mechanical-collection:${item.id}`;
      let attended = !!owner && owner.activity?.affordanceId === collectionId;
      if (owner)
        for (let at = sam.now + 1; attended && at <= end; at++) {
          tick(owner, at);
          tick(sam, at);
          const samActivity = sam.activity;
          if (samActivity && at < pending.endsAt) {
            const duties = collectionDuties(sam),
              choice = decide(sam, [samActivity.affordance, ...duties]);
            if (choice.chosenAffordanceId !== samActivity.affordanceId) {
              const duty = duties.find((x) => x.id === choice.chosenAffordanceId);
              finish(sam, {
                affordanceId: samActivity.affordanceId,
                action: samActivity.action,
                at,
                status: 'interrupted',
                summary: 'Stopped the handover for my own plans.',
              });
              if (duty) begin(sam, duty, choice);
              attended = false;
              end = at;
              break;
            }
            reviewed(sam);
          }
          if (
            !sam.activity ||
            sam.activity.affordanceId !== pending.step ||
            sam.activity.interrupt ||
            !sam.body.alive ||
            sam.body.asleep ||
            !workerHere(at) ||
            !ownerHere(owner.id, at) ||
            !owner.body.alive ||
            owner.body.asleep ||
            owner.activity?.affordanceId !== collectionId ||
            owner.activity.interrupt
          ) {
            attended = false;
            end = at;
            break;
          }
          if (at < pending.endsAt) {
            const duties = collectionDuties(owner),
              choice = decide(owner, [owner.activity.affordance, ...duties]);
            if (choice.chosenAffordanceId !== collectionId) {
              const duty = duties.find((x) => x.id === choice.chosenAffordanceId);
              finish(owner, {
                affordanceId: collectionId,
                action: 'talk',
                at,
                status: 'interrupted',
                summary: 'The handover stopped for my own plans.',
              });
              if (duty) begin(owner, duty, choice);
              attended = false;
              end = at;
              break;
            }
            reviewed(owner);
          }
        }
      if (!attended) {
        if (owner?.activity?.affordanceId === collectionId)
          finish(owner, {
            affordanceId: collectionId,
            action: 'talk',
            at: end,
            status: 'interrupted',
            summary: 'The shared handover stopped before I received the display.',
          });
        tick(sam, end);
        if (sam.activity?.affordanceId === pending.step)
          finish(sam, {
            affordanceId: pending.step,
            action: pending.step,
            at: end,
            status: 'interrupted',
            summary: 'The owner could not complete the handover.',
          });
        a.pending = undefined;
        a.needsHelp =
          'The owner could not complete the handover. The checked display is still safely held; offer collection again later.';
        break;
      }
    }
    if (item.mechanicalDisplay) {
      let interrupted = false;
      for (let at = sam.now + 1; at <= end; at++) {
        tick(sam, at);
        const activity = sam.activity;
        if (!activity || activity.interrupt || !sam.body.alive || sam.body.asleep) {
          interrupted = true;
          break;
        }
        if (at < pending.endsAt) {
          const duties = collectionDuties(sam),
            choice = decide(sam, [activity.affordance, ...duties]);
          if (choice.chosenAffordanceId !== activity.affordanceId) {
            const duty = duties.find((x) => x.id === choice.chosenAffordanceId);
            finish(sam, {
              affordanceId: activity.affordanceId,
              action: activity.action,
              at,
              status: 'interrupted',
              summary: 'Stopped mechanical work for my own plans.',
            });
            if (duty) begin(sam, duty, choice);
            interrupted = true;
            break;
          }
          reviewed(sam);
        }
      }
      if (interrupted) {
        const owner = s.people[item.owner.toLowerCase()];
        if (
          pending.step === 'return' &&
          owner?.activity?.affordanceId === `mechanical-collection:${item.id}`
        )
          finish(owner, {
            affordanceId: owner.activity.affordanceId,
            action: 'talk',
            at: sam.now,
            status: 'interrupted',
            summary: 'Sam could not complete our handover; I have not received the display.',
          });
        a.pending = undefined;
        a.needsHelp =
          'Sam stopped for his own plans before completing this mechanical step. Its evidence and parts remain unchanged.';
        break;
      }
    } else tick(sam, end);
    if (end < pending.endsAt) {
      if (!workerHere(end)) continue;
      break;
    }
    if (!workerHere(end)) continue;
    if (pending.preparation) {
      const text =
        pending.preparation === 'reassemble'
          ? reassemble(item, 'sam', sam.now, pending.step)
          : openAccess(item, 'sam', sam.now, pending.step);
      item.observations.push(text.replaceAll('You ', 'I '));
      say('Sam', text.replaceAll('You ', 'I '));
      finish(sam, {
        affordanceId: pending.step,
        action: 'handle',
        at: sam.now,
        status: 'completed',
        summary: `Physical access prepared before ${semanticWork[pending.step] ?? 'the chosen repair step'}`,
      });
      a.pending = undefined;
      continue;
    }
    assertAccessStep(item, pending.step);
    const part =
      pending.step === 'replace-battery'
        ? 'batteries'
        : pending.step === 'fit-holder'
          ? 'holders'
          : undefined;
    if (part && (s.parts[part] ?? 0) < 1) {
      // The shared stock can change while an acquired step is in flight.
      // Preserve the evidence and stop honestly rather than inventing a part.
      const text =
        'The matching spare is being used on the other job. Keep this light at the tested step; I need a part before continuing.';
      finish(sam, {
        affordanceId: pending.step,
        action: pending.step,
        at: sam.now,
        status: 'interrupted',
        summary: text,
      });
      a.pending = undefined;
      a.needsHelp =
        'Sam needs the matching part; the observed problem and unfinished work are kept.';
      item.observations.push(text);
      say('Sam', text);
      break;
    }
    let text = '',
      success = true;
    if (item.mechanicalDisplay && pending.step in mechanicalMinutes) {
      const result = completeDisplayStep(item, pending.step as MechanicalStep, 'sam', sam.now);
      text = result.text.replaceAll('You ', 'I ');
      success = result.succeeded;
    } else
      switch (pending.step) {
        case 'inspect':
          text = inspectRepair(item, 'sam', sam.now);
          break;
        case 'test-battery':
          text = testRepair(item, 'sam', sam.now);
          break;
        case 'clean-contact':
        case 'replace-battery':
        case 'fit-holder':
        case 'twist-cap': {
          const result = applyRepair(item, pending.step, s.parts);
          text = result.text;
          success = result.succeeded;
          break;
        }
        case 'verify':
          item.checkStarted = sam.now;
          text = 'I’m leaving it lit for the longer check.';
          break;
        case 'wait-check-place':
          text =
            'The other checking place is occupied. I’ll keep this light labelled until it is clear.';
          break;
        case 'wait-check':
          text = 'It is still running. I can give it a little more time.';
          break;
        case 'check-result':
          text = readLongCheck(item, sam.now);
          break;
        case 'return-unchecked':
          item.independent = false;
          a.needsHelp =
            'Sam proposed returning before the longer check. The promise remains yours to discuss.';
          text = 'It lights now, but I have not established the longer check.';
          break;
        case 'return':
          if (item.mechanicalDisplay) {
            const owner = s.people[item.owner.toLowerCase()];
            if (owner)
              finish(owner, {
                affordanceId: `mechanical-collection:${item.id}`,
                action: 'talk',
                at: sam.now,
                status: 'completed',
                summary: 'Received my checked display from Sam.',
              });
          }
          item.location = 'returned';
          item.awaitingCollection = !ownerHere(item.owner.toLowerCase(), sam.now);
          if (!item.awaitingCollection) item.collectedAt = sam.now;
          text = item.awaitingCollection
            ? item.mechanicalDisplay
              ? 'The checked display is labelled for collection.'
              : 'The checked light is labelled for collection.'
            : item.mechanicalDisplay
              ? 'Here it is. I compared it empty and loaded, cleared the observed rim, refitted the same tray and attended a complete loaded circuit.'
              : 'Here it is. I tested the repair for longer and moved it and switched it afterward.';
          s.repairs++;
          break;
      }
    if (text) {
      item.observations.push(text);
      say('Sam', text);
    }
    finish(sam, {
      affordanceId: pending.step,
      action: pending.step,
      at: sam.now,
      status: success ? 'completed' : 'failed',
      summary: text,
      needs: { competence: success ? 0.015 : 0 },
    });
    a.pending = undefined;
    if (!success) {
      item.independent = false;
      a.needsHelp =
        'The attempted repair did not restore the light. Sam is asking you to revisit the evidence.';
      say('Sam', 'That didn’t restore it. I need help rather than repeating it.');
    }
    if (item.location === 'returned' && !item.awaitingCollection)
      completeApprenticeJob(s, item, say);
  }
  if (sam.now < until) liveOrdinaryTime(sam, until);
}

function collectionDuties(person: import('@adam0white/human-framework').Person): Affordance[] {
  return person.agenda.commitments
    .filter(
      (c) =>
        c.status === 'pending' &&
        c.kind === 'appointment' &&
        c.from <= person.now &&
        c.until > person.now,
    )
    .map((c) => ({
      id: `attend-${c.id}`,
      action: c.actions[0] ?? 'attend',
      label: c.label ?? 'Attend the agreed appointment',
      duration: c.until - person.now,
      effort: 0,
      advertises: {},
      fulfills: [c.id],
    }));
}
