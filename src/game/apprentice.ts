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
  tick,
} from '@adam0white/human-framework';
import { liveOrdinaryTime } from './humans';
import {
  applyRepair,
  checkingSpaceAvailable,
  cueFor,
  inspectRepair,
  type RepairCue,
  readLongCheck,
  repairDuration,
  testRepair,
  verificationMinutes,
} from './repairs';
import type { ActionView, GameState, RepairObject } from './types';

type Speak = (speaker: string, text: string) => void;
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
export function apprenticeActions(
  s: GameState,
  item: RepairObject | undefined,
  samHere: boolean,
  ownerHere: (id: string) => boolean = () => true,
): ActionView[] {
  const a = s.apprentice;
  const offers: ActionView[] = [];
  if (!s.campaign?.graduated || !s.unlocked.includes('story:observer-invite')) return offers;
  if ((!a?.arranged || s.now >= a.visitUntil) && samHere)
    offers.push({
      id: 'arrange-learning',
      label: 'Arrange a stretch at the bench with Sam',
      detail:
        'He can choose whether the time fits his own plans; an agreed stretch has an actual end.',
    });
  if (!a?.arranged || s.now >= a.visitUntil) return offers;
  if (samHere && a.lastLesson && !a.lastLesson.explained)
    offers.push({
      id: 'explain-step',
      label: `Explain your demonstration on ${s.objects.find((o) => o.id === a.lastLesson?.objectId)?.title ?? 'the earlier object'}`,
      detail: `Your ${a.lastLesson.step.replaceAll('-', ' ')} step on that object. Explain the observation and result you actually demonstrated.`,
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
  if (!a.jobId && item && !item.repaired && item.location !== 'returned') {
    offers.push({
      id: a.supervisedCompleted ? 'delegate-repair' : 'supervised-repair',
      label: a.supervisedCompleted
        ? 'Offer Sam this whole repair'
        : 'Let Sam try while you stay nearby',
      detail: 'Sam chooses the steps from what he has learned. He can ask for help.',
    });
  }
  if (a.jobId)
    offers.push({
      id: 'watch-sam',
      label: a.needsHelp ? 'Discuss where Sam stopped' : 'Give Sam some room to work',
      detail:
        a.needsHelp ?? a.pauseReason ?? 'Twenty minutes; you can also work on another object.',
    });
  if (a.needsHelp && a.jobId && samHere)
    offers.push({
      id: 'reconsider-sam',
      label: 'Ask Sam to reconsider the kept observation with you nearby',
      detail: 'You stay beside him while he tries the next step.',
      kind: 'primary',
    });
  if (a.needsHelp && a.jobId)
    offers.push({
      id: 'take-over-repair',
      label: 'Take responsibility for the stopped repair',
      detail: 'You’ll finish this one; Sam’s observations stay with it.',
    });
  return offers;
}
export function arrangeLearning(s: GameState, say: Speak): void {
  const sam = s.people.sam;
  if (!sam) return;
  liveOrdinaryTime(sam, s.now);
  const prior = sam.activity;
  if (prior)
    finish(sam, {
      affordanceId: prior.affordanceId,
      action: prior.action,
      at: sam.now,
      status: 'interrupted',
      summary: 'Paused to discuss a stretch at the bench.',
    });
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
  const decision = decide(sam, offers);
  const chosen = offers.find((x) => x.id === decision.chosenAffordanceId);
  s.apprentice ??= freshApprentice();
  if (chosen?.id === 'learning-afternoon') {
    // Agreement is completed as conversation; actual repair activities occupy the visit.
    begin(sam, { ...chosen, duration: 0 }, decision);
    finish(sam, {
      affordanceId: chosen.id,
      action: chosen.action,
      at: sam.now,
      status: 'completed',
      summary: 'Agreed a bounded stretch at the bench.',
      needs: { belonging: 0.02 },
    });
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
          : `I can set aside a stretch, up to ${String(Math.floor((s.apprentice.visitUntil % 1440) / 60)).padStart(2, '0')}:${String(s.apprentice.visitUntil % 60).padStart(2, '0')}. Show me why you choose a step, not just which bit you touch. If my own plans need me sooner, we will keep the notes and stop.`,
    );
  } else {
    if (chosen) begin(sam, chosen, decision);
    say(
      'Sam',
      'Today doesn’t work for me. Try another afternoon after my shift; keep your work where it is.',
    );
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
): void {
  const a = s.apprentice,
    sam = s.people.sam;
  if (
    !attended ||
    !a?.arranged ||
    s.now > a.visitUntil ||
    !sam ||
    (a.jobId && (!a.needsHelp || a.jobId === item.id)) ||
    ![
      'inspect',
      'test-battery',
      'clean-contact',
      'replace-battery',
      'verify',
      'check-result',
      'wait-check',
      'return',
    ].includes(step)
  )
    return;
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
      summary: `I saw ${step}: ${item.observations.at(-1) ?? 'the checked light going back to its owner'}.`,
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
}
export function explainLesson(s: GameState, say: Speak, attending: boolean): void {
  const lesson = s.apprentice?.lastLesson,
    sam = s.people.sam;
  if (!attending || !lesson || !sam || lesson.explained) return;
  const contextId = `demonstration:${lesson.objectId}`;
  receiveMethodCues(sam, { contextId, cues: [{ cue: 'stage', value: lesson.cue }] });
  const acquired = demonstrateMethod(sam, {
    id: 'careful-light-repair',
    demonstrationId: lesson.eventId,
    contextId,
    conditions: [{ cue: 'stage', value: lesson.cue }],
    action: lesson.step,
    sourceId: 'player',
    outcome: lesson.success ? 'success' : 'failure',
  });
  lesson.explained = acquired;
  if (acquired && s.apprentice?.jobId) {
    const assisted = s.objects.find((x) => x.id === s.apprentice?.jobId);
    if (assisted) {
      assisted.playerAssisted = true;
      assisted.independent = false;
    }
  }
  const reasons: Partial<Record<RepairCue, string>> = {
    intake: 'Look before replacing anything.',
    'needs-test':
      'Grime and an old cell can both be plausible. A known-good battery separates them.',
    'battery-steady':
      'The same lamp becomes steady with the test cell. Replace the original battery.',
    'still-flickers': 'A good cell still flickers when moved. Restore the contact instead.',
    'light-steady': 'A steady glow after work is a result, not yet a long check.',
    'check-ready':
      'The timed run had finished. You then moved and switched it; it stayed steady, completing the check.',
    checked: 'A checked light can go home with an honest account of the work.',
  };
  say(
    'You',
    reasons[lesson.cue] ??
      'Explain the observation and the result, without pretending it covers every kind of fault.',
  );
  say(
    'Sam',
    acquired
      ? lesson.step === 'inspect'
        ? 'Start with what I can actually see. I’ll keep that distinction.'
        : lesson.step === 'check-result'
          ? 'The time alone wasn’t the check. You moved it afterward and it stayed steady.'
          : lesson.step === 'return'
            ? 'I can tell the owner what we established, rather than promising more.'
            : `When I see that observation, ${lesson.step.replaceAll('-', ' ')} is the step you demonstrated. I’ll try that connection on another light.`
      : 'I didn’t take that in properly. Could we look at the observation again?',
  );
}
export function apprenticeOffers(
  s: Pick<GameState, 'parts' | 'objects' | 'checkingPlaces'>,
  item: RepairObject,
  now: number,
): Affordance[] {
  const ids = !item.inspected
    ? ['inspect']
    : item.verified
      ? ['return']
      : item.checkStarted !== undefined
        ? now - item.checkStarted >= 20
          ? ['check-result', 'return-unchecked']
          : ['wait-check', 'return-unchecked']
        : item.repaired
          ? [checkingSpaceAvailable(s, item.id) ? 'verify' : 'wait-check-place', 'return-unchecked']
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
    label: id === 'request-help' ? 'Ask for help before guessing' : id,
    duration: repairDuration(id),
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
  if (a.supervised) a.supervisedCompleted = true;
  else if (item.independent && !a.completedJobIds.includes(item.id)) {
    a.completedJobIds.push(item.id);
    a.independentCompleted = a.completedJobIds.length;
    a.role = 'repairer';
    say(
      'Sam',
      'The owner has it back, checked. You didn’t need to choose the steps for me. Do you want to leave another light with me?',
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
        a.pausedStep = { step: a.pending.step, remaining: Math.max(1, a.pending.endsAt - sam.now) };
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
        if (a.pauseReason !== reason) say('Sam', reason);
        a.pauseReason = reason;
        break;
      }
      const current = sam.activity;
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
      const decision = decide(sam, offers);
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
        a.needsHelp =
          'Sam is unsure what the observation supports. He has stopped instead of guessing.';
        say('Sam', 'I don’t know a method for this observation. Will you look with me?');
        break;
      }
      if (!begin(sam, chosen, decision)) {
        a.needsHelp = 'Sam cannot do that step right now.';
        break;
      }
      a.pending = { step: chosen.id, endsAt: sam.now + chosen.duration };
      a.pausedStep = undefined;
    }
    const pending = a.pending;
    let end = Math.min(until, pending.endsAt);
    for (let at = sam.now + 1; at <= end; at++)
      if (!workerHere(at)) {
        end = at;
        break;
      }
    tick(sam, end);
    if (end < pending.endsAt) {
      if (!workerHere(end)) continue;
      break;
    }
    if (!workerHere(end)) continue;
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
    switch (pending.step) {
      case 'inspect':
        text = inspectRepair(item);
        break;
      case 'test-battery':
        text = testRepair(item);
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
        item.location = 'returned';
        item.awaitingCollection = !ownerHere(item.owner.toLowerCase(), sam.now);
        if (!item.awaitingCollection) item.collectedAt = sam.now;
        text = item.awaitingCollection
          ? 'The checked light is labelled for collection.'
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
