/**
 * Deterministic school-break repairs and a small shared workshop. The host owns
 * fictional objects, physical tests, parts, agreements and the elapsed clock.
 * Released HF owns people's condition, reception, acquired conditional methods
 * and apprentice decisions. Manual input remains a host control channel; the
 * game does not simulate school weeks or claim calibrated human development.
 */
import {
  type Affordance,
  begin,
  createPerson,
  decide,
  FRAMEWORK_VERSION,
  finish,
  perceive,
  promise,
  releaseCommitment,
  restore,
  skip,
  snapshot,
  tick,
} from '@adam0white/human-framework';
import { aftercareActions, applyAftercareAction } from './aftercare';
import {
  advanceApprentice,
  apprenticeActions,
  arrangeLearning,
  completeApprenticeJob,
  explainLesson,
  recordLesson,
  startApprenticeJob,
} from './apprentice';
import { catalogueItem, catalogueRequest, PERSONAL_PROJECT } from './catalogue';
import { acceptCatchReturn, catchReturnActions } from './catch-return';
import { gameTimeLabel } from './clock';
import { restoreGame as restoreEngine3 } from './engine3';
import { restoreGame as restoreEngine4 } from './engine4';
import { restoreGame as restoreEngine5 } from './engine5';
import { restoreGame as restoreEngine6 } from './engine6';
import {
  askMumToHelp,
  beginSharedConversation,
  beginSharedWork,
  chooseSamVisit,
  chooseUncheckedReturn,
  liveOrdinaryTime,
  shareTea,
} from './humans';
import {
  agreeCheckedCollection,
  attestCheckedCollection,
  chooseUnfinishedSettlement,
  humanProfile,
  initializeMissingProfile,
  releaseCheckedCollection,
  renegotiateCollection,
  resumePlayedPractice,
  suspendUnplayedPractice,
} from './practices';
import {
  applyRepair,
  catchActions,
  checkingSpaceAvailable,
  compatibleGearAvailable,
  cueFor,
  inspectRepair,
  isMechanical,
  readLongCheck,
  repairDuration,
  testCatch,
  testRepair,
  verificationMinutes,
} from './repairs';
import {
  applyServiceWeekAction,
  completeServiceWeekJob,
  type ServiceWeekContext,
  serviceWeekActions,
} from './service-week';
import {
  itemStory,
  optionalStoryChoices,
  requestStoryBeat,
  schoolStoryBeat,
  storyBeat,
} from './story';
import type { ActionView, Fault, GameInput, GameState, GameView, RepairObject } from './types';
import {
  applyWorkshopAction,
  CABINET_MINUTES,
  completeWorkshopJob,
  type WorkshopContext,
  workshopActions,
} from './workshop';

const ENGINE = 'home-garage-7';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const object = (
  id: string,
  title: string,
  owner: string,
  story: string,
  fault: Fault,
  form: RepairObject['form'] = 'lamp',
): RepairObject => ({
  id,
  title,
  owner,
  story,
  fault,
  form,
  location: 'bench',
  observations: [],
  inspected: false,
  tested: false,
  attempted: 0,
  repaired: false,
  verified: false,
  discovered: true,
});
const focused = (s: GameState) =>
  s.objects.find((o) => o.id === s.focusId && o.discovered && o.location !== 'returned');
function say(
  s: GameState,
  speaker: string,
  text: string,
  tone: 'warm' | 'notice' | 'mistake' = 'notice',
) {
  s.nextLineId ??= (s.conversation.at(-1)?.id ?? -1) + 1;
  const entry = { id: s.nextLineId++, speaker, text, tone, at: s.now, timeLabel: gameTimeLabel(s) };
  s.conversation.push(entry);
  s.journal ??= [];
  s.journal.push(entry);
  s.conversation = s.conversation.slice(-8);
  const speaking = s.people[speaker.toLowerCase()];
  if (speaking && speaking.id !== 'player')
    perceive(speaking, [
      {
        at: speaking.now,
        channel: 'saw',
        actorId: 'player',
        kind: 'conversation',
        summary: text,
        salience: 0.6,
        valence: tone === 'warm' ? 0.2 : 0,
      },
    ]);
  const p = s.people.player;
  if (p)
    perceive(p, [
      {
        at: p.now,
        channel: speaker === 'You' ? 'saw' : 'told',
        actorId: speaking?.id,
        kind: 'repair-observation',
        summary: text,
        salience: 0.9,
        valence: tone === 'warm' ? 0.3 : tone === 'mistake' ? -0.1 : 0,
      },
    ]);
}
export function createGame(seed = 1701): GameState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid seed');
  const state: GameState = {
    campaign: { holiday: 0, lastSchoolRepairs: 0, graduated: false, startedAt: 840 },
    schema: 1,
    scenario: 1,
    framework: FRAMEWORK_VERSION,
    seed,
    now: 840,
    chapter: 'family',
    focusId: null,
    objects: [],
    people: {
      player: createPerson({
        id: 'player',
        ...humanProfile('player', 840),
        name: 'You',
        seed,
        now: 840,
        bornAt: 840 - 14 * 365 * 1440,
        sex: 'male',
        skills: { repair: 0.12 },
        relationships: [{ otherId: 'mum', roles: ['parent'] }],

        retention: { trace: 12, chronicleDays: 31 },
      }),
      mum: createPerson({
        id: 'mum',
        ...humanProfile('mum', 840),
        name: 'Mum',
        seed: seed ^ 913,
        now: 840,
        bornAt: -52 * 365 * 1440,
        sex: 'female',
        relationships: [{ otherId: 'player', roles: ['child'] }],
        retention: { trace: 8, chronicleDays: 31 },
      }),
    },
    world: {
      presence: Object.fromEntries(
        ['mum', 'dad', 'nora', 'sam'].map((id) => [id, { awayUntil: 0, activity: 'Nearby' }]),
      ),
      day: 1,
    },
    parts: { batteries: 1, holders: 0 },
    unlocked: [],
    conversation: [
      {
        id: 0,
        at: 840,
        timeLabel: gameTimeLabel({
          now: 840,
          campaign: { startedAt: 840, holiday: 0, graduated: false },
        }),
        speaker: 'Mum',
        text: 'Could you come over here a moment? The little lamp beside my chair keeps flickering.',
        tone: 'warm',
      },
    ],
    journal: [
      {
        id: 0,
        at: 840,
        timeLabel: gameTimeLabel({
          now: 840,
          campaign: { startedAt: 840, holiday: 0, graduated: false },
        }),
        speaker: 'Mum',
        text: 'Could you come over here a moment? The little lamp beside my chair keeps flickering.',
        tone: 'warm',
      },
    ],
    inputs: [],
    discoveries: 0,
    repairs: 0,
    requests: 0,
    worldRng: (seed ^ 0x9e3779b9) >>> 0,
    feedbackRevisionFrom: 0,
  };
  addPeople(state);
  return state;
}
function addPeople(s: GameState) {
  for (const [id, name, sex, age, salt] of [
    ['dad', 'Dad', 'male', 55, 321],
    ['nora', 'Nora', 'female', 36, 771],
    ['sam', 'Sam', 'male', 15, 119],
  ] as const) {
    s.people[id] ??= createPerson({
      id,
      name,
      sex,
      bornAt: -age * 365 * 1440,
      now: s.now,
      seed: s.seed ^ salt,
      needs: { belonging: 0.35 + ((s.seed ^ salt) % 20) / 100, leisure: 0.4 },
      traits: { openness: id === 'sam' ? 0.8 : 0.5, conscientiousness: id === 'dad' ? 0.75 : 0.6 },
      values: { benevolence: id === 'nora' ? 0.8 : 0.65, achievement: id === 'sam' ? 0.7 : 0.5 },
      relationships: [{ otherId: 'player', roles: [id === 'dad' ? 'child' : 'friend'] }],
      norms: humanProfile(id, s.now).norms,
      commitments:
        id === 'sam'
          ? [
              {
                kind: 'duty',
                toId: 'self',
                actions: ['walk'],
                from: Math.floor(s.now / 1440) * 1440 + 16 * 60,
                until: Math.floor(s.now / 1440) * 1440 + 19 * 60,
                importance: 0.9,
                recurEvery: 1440,
              },
            ]
          : humanProfile(id, s.now).commitments,
      retention: { trace: 12, chronicleDays: 31 },
    });
  }
  s.world ??= {
    presence: Object.fromEntries(
      ['mum', 'dad', 'nora', 'sam'].map((id) => [id, { awayUntil: 0, activity: 'Nearby' }]),
    ),
    day: Math.floor(s.now / 1440) + 1,
  };
}
function scheduledAway(s: GameState, id: string, at = s.now): boolean {
  const hour = (at % 1440) / 60;
  const serviceShift =
    id === 'sam' &&
    s.unlocked.some((flag) => {
      const m = /^service-counter:(\d+):(\d+)$/.exec(flag);
      return m && at >= Number(m[1]) && at < Number(m[2]);
    });
  return (
    Boolean(serviceShift) ||
    (id === 'sam' && hour >= 9 && hour < 13) ||
    (id === 'nora' && hour >= 8 && hour < 10) ||
    (id === 'dad' && hour >= 17 && hour < 18)
  );
}
function isHere(s: GameState, id: string, at = s.now) {
  if (['you', 'player'].includes(id)) return true;
  const person = s.people[id];
  const hour = (at % 1440) / 60;
  return Boolean(
    person?.body.alive &&
      !person.body.asleep &&
      !person.body.downed &&
      person.activity?.action !== 'pray' &&
      person.activity?.action !== 'walk' &&
      hour >= 7 &&
      hour < 22 &&
      at >= (s.world?.presence[id]?.awayUntil ?? 0) &&
      !scheduledAway(s, id, at),
  );
}
/** Resolve apprentice events before the player's elapsed-time tick can expire a promise. */
function advanceBenchBeforePlayer(s: GameState, until: number) {
  advanceApprentice(
    s,
    until,
    (speaker, text) => say(s, speaker, text, 'notice'),
    (id, at) => isHere(s, id, at),
    (at) => isHere(s, 'sam', at),
  );
  settleReturned(s);
}
function sayRoutineOnce(s: GameState, speaker: string, text: string) {
  if (
    s.conversation.some(
      (line) => line.id >= (s.eventStartId ?? 0) && line.speaker === speaker && line.text === text,
    )
  )
    return;
  say(s, speaker, text, 'notice');
}
function advancePeople(s: GameState) {
  addPeople(s);
  advanceApprentice(
    s,
    s.now,
    (speaker, text) => say(s, speaker, text, 'notice'),
    (id, at) => isHere(s, id, at),
    (at) => isHere(s, 'sam', at),
  );
  for (const [id, person] of Object.entries(s.people)) {
    if (id === 'player') continue;
    const presence = s.world?.presence[id];
    const activity = liveOrdinaryTime(
      person,
      s.now,
      (at) => at >= (presence?.awayUntil ?? 0) && !scheduledAway(s, id, at),
      (offer) => {
        if (id === 'sam' && offer.action === 'walk')
          sayRoutineOnce(
            s,
            'Sam',
            'I’m taking the dog out now. Keep the work labelled; I’ll come back afterward.',
          );
        if (id === 'mum' && offer.action === 'pray')
          sayRoutineOnce(
            s,
            'Mum',
            'I’m going to pray quietly for a few minutes. I’ll leave my book here.',
          );
      },
    );
    if (presence && isHere(s, id)) presence.activity = activity;
    else if (presence && s.now >= presence.awayUntil && scheduledAway(s, id))
      presence.activity =
        id === 'sam'
          ? (s.now % 1440) / 60 >= 13
            ? 'At the arranged counter shift — back after five'
            : 'At his morning shift — back after one'
          : id === 'nora'
            ? 'Busy at home — free after ten'
            : 'At the hardware shop — back at six';
  }
  collectWaiting(s);
  for (const item of s.objects.filter(
    (x) => x.completedBy === 'sam' && x.location === 'returned' && !x.awaitingCollection,
  ))
    for (const line of completeWorkshopJob(s, item.id, {
      verified: item.verified,
      independent: Boolean(item.independent),
      at: s.now,
    }))
      say(s, line.speaker, line.text, line.tone);
  settleReturned(s);
  if (
    s.conversation.some(
      (line) =>
        line.id >= (s.eventStartId ?? 0) && line.text.startsWith('The owner has it back, checked.'),
    )
  ) {
    const final = s.conversation.findLast(
      (line) =>
        line.id >= (s.eventStartId ?? 0) && line.text.startsWith('The owner has it back, checked.'),
    );
    if (final) s.eventStartId = final.id;
  }
  if (s.world) s.world.day = Math.floor(s.now / 1440) + 1;
}
function collectWaiting(s: GameState) {
  for (const item of s.objects.filter(
    (x) =>
      x.awaitingCollection &&
      isHere(s, x.owner.toLowerCase()) &&
      (x.assignedTo !== 'sam' || isHere(s, 'sam')),
  )) {
    item.awaitingCollection = false;
    item.collectedAt = s.now;
    completeApprenticeJob(s, item, (speaker, text) => say(s, speaker, text, 'warm'));
    for (const line of completeWorkshopJob(s, item.id, {
      verified: item.verified,
      independent: Boolean(item.independent && item.completedBy === 'sam'),
      at: s.now,
    }))
      say(s, line.speaker, line.text, line.tone);
    if (item.returnedEarly) {
      const owner = s.people[item.owner.toLowerCase()];
      if (owner && chooseUncheckedReturn(owner)) item.callbackAt = s.now + 25;
    }
    say(
      s,
      item.owner,
      'I’m back. Thanks for keeping it safely labelled — I can take it home now.',
      'warm',
    );
  }
}
function serviceContext(s: GameState, choices = false): ServiceWeekContext {
  return {
    independentHandoff: Boolean(s.apprentice?.completedJobIds.length),
    uncheckedCollections: s.objects
      .filter(
        (o) =>
          o.location === 'returned' &&
          !o.verified &&
          !o.awaitingCollection &&
          o.callbackAt === undefined,
      )
      .map((o) => o.id),
    graduated: s.campaign?.graduated ?? true,
    samHere: isHere(s, 'sam'),
    dadHere: isHere(s, 'dad'),
    ownerHere: (id) => isHere(s, id),
    paperStreetPresent: s.objects.some((x) => x.id === 'paper-street'),
    paperStreetWaiting: Boolean(s.objects.find((x) => x.id === 'paper-street' && !x.repaired)),
    paperStreetRepaired: Boolean(s.objects.find((x) => x.id === 'paper-street' && x.verified)),
    paperStreetInstalled: Boolean(s.objects.find((x) => x.id === 'paper-street' && x.repaired)),
    checkedHouseholdAndPersonal: s.objects.filter(
      (x) => x.verified && !x.id.startsWith('service-') && !x.id.startsWith('workshop-'),
    ).length,
    ...(choices
      ? {
          settleUnfinished: (ownerId) =>
            s.people[ownerId] ? chooseUnfinishedSettlement(s.people[ownerId]) : null,
          samWillAgree: () => {
            const sam = s.people.sam;
            if (!sam) return false;
            const offers: Affordance[] = [
              {
                id: 'service-paid-agreement',
                action: 'agree',
                label:
                  'Try the known light work for the separately agreed £2 per whole service repair',
                duration: 0,
                effort: 0,
                with: ['player'],
                advertises: { autonomy: 0.08, competence: 0.05 },
                norms: [{ normId: 'lying', relation: 'fulfills' }],
              },
              {
                id: 'keep-service-free-time',
                action: 'decline',
                label: 'Keep my other plans this week',
                duration: 0,
                effort: 0,
                advertises: { leisure: 0.08, autonomy: 0.04 },
              },
            ];
            const decision = decide(sam, offers);
            return decision.chosenAffordanceId === 'service-paid-agreement';
          },
        }
      : {}),
  };
}
function settleReturned(s: GameState) {
  for (const item of s.objects.filter((x) => x.location === 'returned' && !x.awaitingCollection)) {
    if (item.verified && s.people.player)
      attestCheckedCollection(
        s.people.player,
        item.id,
        item.owner.toLowerCase(),
        item.collectedAt ?? s.now,
        s.people[item.owner.toLowerCase()],
      );
    for (const line of completeServiceWeekJob(s, item.id, {
      verified: item.verified,
      independent: Boolean(item.independent && item.completedBy === 'sam'),
      at: item.collectedAt ?? s.now,
      samFee: s.serviceWeek?.paidHelp ? 200 : 0,
    }))
      say(s, line.speaker, line.text, line.tone);
  }
}
function workshopContext(s: GameState, choices = false): WorkshopContext {
  let dadReason =
    'I want to keep my own plans for now. Leave the notebook there; we can ask again another time.';
  return {
    dadWorkReason: () => dadReason,
    graduated: s.campaign?.graduated ?? true,
    independentRepair: Boolean(s.apprentice?.completedJobIds.length),
    paidHelpEligible: Boolean(s.campaign?.graduated && s.apprentice?.completedJobIds.length),
    dadHere: isHere(s, 'dad'),
    noraHere: isHere(s, 'nora'),
    samHere: isHere(s, 'sam'),
    leilaHere: isHere(s, 'leila'),
    ownerHere: (id) => isHere(s, id),
    ...(choices
      ? {
          dadWillWork: (task) => {
            const dad = s.people.dad;
            if (!dad) return false;
            const player = s.people.player;
            const duration = CABINET_MINUTES[task];
            if (
              !player ||
              Array.from({ length: duration }, (_, i) => s.now + i + 1).some(
                (at) => scheduledAway(s, 'dad', at) || at % 1440 >= 22 * 60 || at % 1440 < 7 * 60,
              )
            ) {
              dadReason =
                'I need to leave for my own plans before we could finish that step. Let us keep the marks and try another time.';
              return false;
            }
            const agreed = beginSharedWork(player, dad, {
              id: `cabinet-${task}`,
              action: 'work',
              label:
                task === 'measure'
                  ? 'Measuring the cabinet doors together'
                  : task === 'hang'
                    ? 'Hanging the cabinet doors together'
                    : task === 'align'
                      ? 'Adjusting the cabinet hinges together'
                      : 'Making a labelled place for incoming work together',
              duration,
              effort: 0.1,
              focus: 0.2,
              with: ['player'],
              advertises: { competence: 0.06, belonging: 0.05 },
            });
            if (!agreed)
              dadReason =
                dad.body.sleepPressure > 0.8 || dad.body.exertion > 0.8
                  ? 'I am too tired to give those hinges careful attention now. Keep the marks; the work can wait.'
                  : dad.activity
                    ? `I am in the middle of my own activity: ${dad.activity.affordance.label.toLowerCase()}. Keep the notebook there; ask again another time.`
                    : 'I want to keep my own plans for now. Leave the notebook there; we can ask again another time.';
            return agreed;
          },
          samWillAgree: () => {
            const sam = s.people.sam;
            if (!sam) return false;
            const offers: Affordance[] = [
              {
                id: 'agreed-repairs',
                action: 'work',
                label: 'Agree three pounds for each checked light repair',
                duration: 0,
                effort: 0,
                with: ['player'],
                advertises: { competence: 0.12, autonomy: 0.08, belonging: 0.05 },
              },
              {
                id: 'keep-own-work',
                action: 'rest',
                label: 'Keep my own afternoons',
                duration: 0,
                effort: 0,
                advertises: { leisure: 0.1 },
              },
            ];
            return decide(sam, offers).chosenAffordanceId === 'agreed-repairs';
          },
        }
      : {}),
  };
}
function knownAppointments(s: GameState) {
  const appointments = Object.entries(s.world?.presence ?? {})
    .filter(([, p]) => p.awayUntil > s.now)
    .map(([id, p]) => ({
      personId: id,
      name: s.people[id]?.name ?? id,
      at: p.awayUntil,
      detail: `${p.activity} · ${Math.floor(p.awayUntil / 1440) === Math.floor(s.now / 1440) ? 'today' : Math.floor(p.awayUntil / 1440) === Math.floor(s.now / 1440) + 1 ? 'tomorrow' : `in ${Math.floor(p.awayUntil / 1440) - Math.floor(s.now / 1440)} days`} at ${String(Math.floor((p.awayUntil % 1440) / 60)).padStart(2, '0')}:${String(p.awayUntil % 60).padStart(2, '0')}`,
    }));
  for (const c of s.people.sam?.agenda.commitments ?? [])
    if (
      c.status === 'pending' &&
      c.actions.includes('parts-counter') &&
      c.until > s.now &&
      c.from <= s.now
    )
      appointments.push({
        personId: 'sam',
        name: 'Sam',
        at: c.until,
        detail: `Agreed parts-counter shift ends today at ${String(Math.floor((c.until % 1440) / 60)).padStart(2, '0')}:${String(c.until % 60).padStart(2, '0')}`,
      });
  const personalAt = s.serviceWeek?.personalAt;
  if (
    personalAt &&
    personalAt > s.now &&
    ['protected', 'changed'].includes(s.serviceWeek?.personalSession ?? '')
  )
    appointments.push({
      personId: 'player',
      name: 'Your saved bench session',
      at: personalAt,
      detail: `Saved forty-five minutes · ${Math.floor(personalAt / 1440) === Math.floor(s.now / 1440) ? 'today' : `in ${Math.floor(personalAt / 1440) - Math.floor(s.now / 1440)} ${Math.floor(personalAt / 1440) - Math.floor(s.now / 1440) === 1 ? 'day' : 'days'}`} at ${String(Math.floor((personalAt % 1440) / 60)).padStart(2, '0')}:${String(personalAt % 60).padStart(2, '0')}`,
    });
  return appointments.sort((a, b) => a.at - b.at);
}
function available(s: GameState): ActionView[] {
  const a: ActionView[] = [];
  const appointment = knownAppointments(s)[0];
  if (appointment)
    a.push({
      id: 'wait-appointment',
      label:
        appointment.personId === 'player'
          ? 'Wait until your saved bench session'
          : `Leave time for ${appointment.name}’s arranged return`,
      detail: appointment.detail,
      intent: 'pause',
    });
  const add = (id: string, label: string, detail?: string, kind?: ActionView['kind']) =>
    a.push({
      id,
      label,
      detail,
      kind,
      intent: ['early-return', 'return', 'talk-garage'].includes(id)
        ? 'leave'
        : ['rest', 'shelve'].includes(id)
          ? 'pause'
          : 'stay',
    });
  if (
    s.chapter === 'garage' &&
    s.campaign &&
    !s.campaign.graduated &&
    s.repairs - s.campaign.lastSchoolRepairs >= 2 &&
    !s.objects.some((item) => item.awaitingCollection) &&
    !s.objects.some(
      (item) => item.checkStarted !== undefined && !item.verified && item.location !== 'returned',
    )
  )
    add(
      'back-to-school',
      'Close this summer and return to school',
      'Let the remaining holiday and school months pass. Keep the labelled work for next summer.',
    );
  if (s.chapter === 'garage')
    add(
      'next-day',
      'Leave the bench safe for tomorrow',
      'Put tools away and rest; notes, parts and checks remain.',
    );
  if (s.chapter === 'family') {
    if (isHere(s, 'mum')) add('talk-family', 'Sit with Mum');
    else
      add('wait-person', 'Wait until the house is awake', 'A quiet half-hour; there is no hurry.');
    return a;
  }
  const o = focused(s);
  if (
    s.objects.some((x) => x.awaitingCollection) ||
    !isHere(s, 'sam') ||
    !isHere(s, 'nora') ||
    !isHere(s, 'dad')
  )
    add(
      'wait-person',
      'Wait a little while',
      'Thirty minutes; finished work stays safely labelled.',
    );
  a.push(...aftercareActions(s, { dadHere: isHere(s, 'dad'), evanHere: isHere(s, 'evan') }));
  const needsServiceRate = !!(
    o &&
    !s.serviceWeek?.paidHelp &&
    s.serviceWeek?.jobs.some((job) => job.id === o.id && job.stage === 'accepted' && job.fee > 0)
  );
  a.push(
    ...apprenticeActions(s, o, isHere(s, 'sam'), (id) => isHere(s, id)).filter(
      (action) => !needsServiceRate || action.id !== 'delegate-repair',
    ),
    ...workshopActions(s, workshopContext(s)),
    ...serviceWeekActions(s, serviceContext(s)).map((action) =>
      needsServiceRate && action.id === 'service-paid-help'
        ? { ...action, kind: 'primary' as const }
        : action,
    ),
    ...catchReturnActions(s, isHere(s, 'nora')),
  );
  if (o && o.assignedTo !== 'sam') {
    if (!o.inspected) add('inspect', 'Look closely');
    if (o.inspected && !o.repaired && isMechanical(o)) {
      const methods: Partial<Record<Fault, [string, string]>> = {
        jam: ['clear-obstruction', 'Lift the crumb out and free the winding lever'],
        striker: ['align-striker', 'Align the bell striker clear of the shell'],
        hinge: ['lubricate-hinge', 'Clear the external dirt and lubricate the hinge'],
        spring: ['replace-spring', 'Fit a matching leaf spring'],
        gear: ['fit-gear', 'Fit the recovered matching gear'],
      };
      if (o.form === 'box') for (const [id, label] of catchActions(o)) add(id, label);
      const method = catchActions(o).length ? undefined : methods[o.fault];
      if (
        method &&
        (o.fault !== 'spring' || s.parts.springs) &&
        (o.fault !== 'gear' || compatibleGearAvailable(o, s.parts))
      )
        add(method[0], method[1]);
      if (o.fault === 'spring' && !s.parts.springs)
        add(
          'search-spring',
          'Look for a matching leaf spring in the scrap tray',
          'A stamped clip can supply one compatible spring.',
        );
      if (
        o.fault === 'gear' &&
        !s.parts.gears &&
        s.unlocked.includes('legacy-gear-source') &&
        !s.unlocked.includes('gear-recovered')
      )
        add(
          'search-gear',
          'Revisit the saved mechanisms for a matching gear',
          'There is time to look while Sam handles a familiar light.',
        );
    }
    if (o.inspected && !o.repaired && !isMechanical(o)) {
      if (o.form === 'torch' && o.fault === 'cap')
        add(
          'twist-cap',
          'Clean the cap thread and seat it squarely',
          'The cap carries the return contact; the flat lamp contact is a different part.',
        );
      if (!o.tested)
        add(
          'test-battery',
          'Try the known-good battery',
          'A test: the battery goes back in the tray.',
        );
      if (o.fault !== 'holder' || !o.observations.some((x) => x.includes('holder'))) {
        add('clean-contact', 'Clean and reseat the contact');
        if (s.parts.batteries > 0) add('replace-battery', 'Put in the spare battery');
      }
      if (o.inspected && o.observations.some((x) => x.includes('holder')) && s.parts.holders > 0)
        add('fit-holder', 'Fit the recovered holder');
    }
    if (o.repaired && !o.verified) {
      if (o.checkStarted === undefined && checkingSpaceAvailable(s, o.id))
        add(
          'verify',
          isMechanical(o)
            ? o.form === 'timer'
              ? 'Wind it gently and start one full timer cycle'
              : 'Start a repeated-operation check'
            : 'Start a longer light check',
          isMechanical(o)
            ? `Give it ${verificationMinutes(o)} minutes of gentle operation, then inspect the result.`
            : 'Leave it shining for twenty minutes; other things can happen meanwhile.',
        );
      else if (
        o.checkStarted === undefined &&
        s.objects.some(
          (other) =>
            other.id !== o.id &&
            other.location !== 'returned' &&
            !other.verified &&
            !other.assignedTo &&
            other.checkStarted !== undefined &&
            s.now - other.checkStarted >= verificationMinutes(other),
        )
      ) {
        const ready = s.objects.find(
          (other) =>
            other.id !== o.id &&
            other.location !== 'returned' &&
            !other.verified &&
            !other.assignedTo &&
            other.checkStarted !== undefined &&
            s.now - other.checkStarted >= verificationMinutes(other),
        );
        add(
          'read-other-check',
          `Go back and read ${ready?.title ?? 'the earlier object'}’s check`,
          'Its timed run is ready to inspect. Waiting alone will not release the checking place.',
        );
      } else if (o.checkStarted === undefined)
        add(
          'wait-check-place',
          'Give the occupied checking place a little time',
          'Keep this object labelled while the other check runs.',
        );
      else if (s.now - o.checkStarted >= verificationMinutes(o))
        add(
          'check-result',
          isMechanical(o)
            ? 'Repeat the motion and read the check'
            : 'Move it, switch it, and read the check',
        );
      else
        add(
          'wait-check',
          isMechanical(o)
            ? 'Give the mechanism time to finish its check'
            : 'Stay with the light a while',
          isMechanical(o)
            ? 'Let the cycle finish; forcing it would change the test.'
            : 'Ten quiet minutes, watching for a change.',
        );
      add(
        'early-return',
        o.owner === 'You'
          ? isMechanical(o)
            ? 'Put it away before finishing the check'
            : 'Put it beside the bed before the longer check'
          : 'Give it back before the longer check',
        isMechanical(o)
          ? 'Say that it moves now but its repeated operation has not been checked.'
          : 'Say plainly that it lights now but has not been checked for long.',
      );
    }
    if (o.verified)
      add(
        'return',
        o.owner === 'You'
          ? isMechanical(o)
            ? 'Put the working model back on its shelf'
            : 'Set it beside your bed'
          : 'Give it back',
      );
    if (o.location === 'bench' && !o.verified) add('shelve', 'Put it aside carefully');
    if (o.location === 'shelf') add('resume', 'Bring it back to the bench');
  }
  if (s.unlocked.includes('garage-hint') && !s.unlocked.includes('garage'))
    add('talk-garage', 'Go and look at the garage bench');
  if (
    s.chapter === 'garage' &&
    isHere(s, 'dad') &&
    o?.checkStarted !== undefined &&
    !isMechanical(o) &&
    s.now - o.checkStarted >= verificationMinutes(o) &&
    !o.verified &&
    !s.unlocked.includes(`dad-help:${o.id}`)
  )
    add(
      'ask-dad',
      'Read the longer check together with Dad',
      'If he joins you, you can do the movement and switching check together now.',
    );
  if (s.unlocked.includes('garage') && !s.unlocked.includes('donor'))
    add('search-donor', 'Look through Dad’s old lamp box');
  if (s.repairs >= 1 && s.unlocked.includes('garage') && !s.unlocked.includes('friends'))
    add('talk-friends', 'Tell Mum about the garage bench');
  if (
    s.unlocked.includes('friends') &&
    catalogueRequest(s.requests) &&
    (s.campaign?.graduated || (s.campaign?.holiday ?? 4) >= Math.floor(s.requests / 2)) &&
    isHere(s, catalogueRequest(s.requests)?.ownerId ?? '') &&
    !o &&
    s.objects.filter((x) => x.id.startsWith('friend-') && x.location !== 'returned').length < 2
  )
    add(
      'accept-request',
      'See who needs a hand',
      'Room for one on the bench and one waiting safely on the shelf.',
    );
  add(
    'rest',
    isHere(s, 'mum')
      ? s.chapter === 'garage'
        ? 'Invite Mum for tea on the garage step'
        : 'Ask Mum about tea'
      : 'Take a quiet break',
    'Leave the work safely on the bench for a while.',
  );
  if (
    isHere(s, 'mum') &&
    o?.checkStarted !== undefined &&
    !o.verified &&
    !s.unlocked.includes(`help:${o.id}`)
  )
    add('ask-mum', 'Ask Mum to hold it while you check');
  for (const choice of [
    ...optionalStoryChoices({
      focusId: s.focusId,
      focusOwner: o?.owner,
      chapter: s.chapter,
      unlocked: s.unlocked,
      holiday: s.campaign?.holiday,
      graduated: s.campaign?.graduated,
    }),
  ])
    if (choice.lines.every((line) => isHere(s, line.speaker.toLowerCase())))
      add(
        choice.id,
        choice.label,
        undefined,
        choice.id === 'observer-invite' && s.campaign?.graduated ? 'primary' : 'quiet',
      );
  return a;
}
export function transition(original: GameState, input: GameInput): GameState {
  if (
    !input ||
    typeof input.id !== 'string' ||
    input.id.length > 80 ||
    !['action', 'select'].includes(input.type)
  )
    throw Error('Invalid input');
  if (input.type === 'action' && !available(original).some((a) => a.id === input.id))
    throw Error('That action is not available');
  if (
    input.type === 'select' &&
    !original.objects.some((o) => o.id === input.id && o.discovered && o.location !== 'returned')
  )
    throw Error('Unknown object');
  const s = clone(original);
  s.inputs.push({ at: s.now, input: clone(input) });
  s.humanNote = null;
  s.eventStartId = s.nextLineId ?? (s.conversation.at(-1)?.id ?? -1) + 1;
  const joined = s.people.player?.activity;
  if (joined?.affordanceId.startsWith('aftercare-') && joined.affordanceId.endsWith('-start')) {
    const prefix = joined.affordanceId.replace(/start$/, '');
    if (input.type !== 'action' || !input.id.startsWith(prefix) || input.id.endsWith('-start')) {
      const partnerId = prefix.includes('door') ? 'dad' : 'evan';
      for (const person of [s.people.player, s.people[partnerId]]) {
        const activity = person?.activity;
        if (person && activity?.affordanceId === joined.affordanceId)
          finish(person, {
            affordanceId: activity.affordanceId,
            action: activity.action,
            at: person.now,
            status: 'interrupted',
            summary: 'Set the unfinished conversation aside for other plans.',
          });
      }
    }
  }

  if (input.type === 'action' && input.id === 'read-other-check') {
    const previous = focused(s);
    const ready = s.objects.find(
      (other) =>
        other.id !== previous?.id &&
        other.location !== 'returned' &&
        !other.verified &&
        !other.assignedTo &&
        other.checkStarted !== undefined &&
        s.now - other.checkStarted >= verificationMinutes(other),
    );
    if (!ready) throw Error('No earlier check is ready');
    if (previous) previous.location = 'shelf';
    ready.location = 'bench';
    s.focusId = ready.id;
    say(
      s,
      'You',
      `You set the other object safely aside and return to ${ready.title.toLowerCase()}. The timed run is over; its result still needs to be read.`,
      'notice',
    );
    return s;
  }
  if (input.type === 'select') {
    const previous = focused(s);
    if (previous && previous.id !== input.id && previous.assignedTo !== 'sam')
      previous.location = 'shelf';
    s.focusId = input.id;
    const o = focused(s);
    if (o && o.assignedTo !== 'sam') o.location = 'bench';
    return s;
  }
  const id = input.id;
  if (id === 'back-to-school' && s.campaign) {
    const to = s.now + 365 * 1440;
    for (const person of Object.values(s.people)) {
      const practiced = suspendUnplayedPractice(person);
      skip(person, to - 6 * 60);
      if (practiced) resumePlayedPractice(person);
      liveOrdinaryTime(person, to);
    }
    for (const item of s.objects) if (item.location === 'bench') item.location = 'shelf';
    s.focusId = null;
    s.now = to;
    s.campaign.holiday++;
    s.campaign.lastSchoolRepairs = s.repairs;
    s.campaign.graduated = s.campaign.holiday >= 4;
    if (s.world) {
      s.world.day = Math.floor(s.now / 1440) + 1;
      for (const presence of Object.values(s.world.presence)) {
        presence.awayUntil = 0;
        presence.activity = 'Back for the summer';
      }
    }
    for (const line of schoolStoryBeat(s.campaign.holiday))
      if (isHere(s, line.speaker.toLowerCase())) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  const o = focused(s);
  const speak = (speaker: string, text: string) => say(s, speaker, text, 'notice');
  const aftercare = applyAftercareAction(s, id, {
    dadHere: isHere(s, 'dad'),
    evanHere: isHere(s, 'evan'),
    wantsConversation: (personId) => {
      const person = s.people[personId],
        player = s.people.player;
      const starting = id.endsWith('-start');
      const duration = starting ? 5 : 3;
      const startId = id.startsWith('aftercare-door-')
        ? 'aftercare-door-start'
        : 'aftercare-label-start';
      if (
        !starting &&
        player?.activity?.affordanceId === startId &&
        person?.activity?.affordanceId === startId &&
        player.activity.endsAt >= s.now + 3 &&
        person.activity.endsAt >= s.now + 3 &&
        isHere(s, personId)
      )
        return true;
      if (
        !person ||
        !player ||
        Array.from({ length: duration }, (_, i) => s.now + i + 1).some(
          (at) => !isHere(s, personId, at),
        )
      )
        return false;
      return beginSharedConversation(
        player,
        person,
        starting ? id : `${startId}:resumed`,
        personId === 'dad'
          ? 'Talking together about the finished cabinet doors'
          : 'Looking together at the display label and its parts list',
        duration,
      );
    },
  });
  if (aftercare) {
    const activity = s.people.player?.activity;
    if (aftercare.minutes > 0 && activity) {
      s.now += aftercare.minutes;
      advanceBenchBeforePlayer(s, s.now);
      const player = s.people.player;
      if (player) {
        tick(player, s.now);
        if (s.now >= activity.endsAt)
          finish(player, {
            affordanceId: activity.affordanceId,
            action: activity.action,
            at: s.now,
            status: 'completed',
            summary: activity.affordance.label,
            needs: activity.affordance.advertises,
          });
      }
      advancePeople(s);
    }
    for (const line of aftercare.lines) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  const serviceResult = applyServiceWeekAction(s, id, serviceContext(s, true));
  if (serviceResult) {
    for (const personId of new Set([
      ...(serviceResult.personIds ?? []),
      ...(serviceResult.visits ?? []).map((v) => v.personId),
    ])) {
      if (!s.people[personId])
        s.people[personId] = createPerson({
          id: personId,
          name: personId[0]?.toUpperCase() + personId.slice(1),
          seed: s.seed ^ (personId === 'evan' ? 849 : 761),
          now: s.now,
          bornAt: s.now - 34 * 365 * 1440,
          sex: personId === 'evan' ? 'male' : 'female',
          ...humanProfile(personId, s.now),
          relationships: [{ otherId: 'player', roles: ['friend'] }],
        });
      if (s.world) s.world.presence[personId] ??= { awayUntil: 0, activity: 'A known contact' };
    }
    for (const visit of serviceResult.visits ?? [])
      if (s.world)
        s.world.presence[visit.personId] = { awayUntil: visit.at, activity: visit.activity };
    if (serviceResult.personalOpportunity && s.people.player) {
      const player = s.people.player;
      for (const c of player.agenda.commitments)
        if (c.label === 'My model session' && c.status === 'pending')
          releaseCommitment(player, c.id);
      const slot = serviceResult.personalOpportunity;
      promise(player, {
        kind: 'appointment',
        toId: 'self',
        actions: ['service-personal-session'],
        from: slot.at,
        until: slot.at + slot.duration,
        importance: 0.6,
        label: 'My model session',
      });
    }
    if (serviceResult.obligation && s.world) {
      const obligation = serviceResult.obligation;
      const person = s.people[obligation.personId];
      if (person)
        promise(person, {
          kind: 'job',
          toId: 'self',
          actions: ['parts-counter'],
          from: obligation.from,
          until: obligation.until,
          importance: 0.9,
          label: obligation.activity,
        });
      s.unlocked.push(`service-counter:${obligation.from}:${obligation.until}`);
    }
    if (serviceResult.job) {
      const spec = serviceResult.job;
      const item = object(
        spec.id,
        spec.title,
        spec.owner,
        spec.story,
        spec.fault,
        spec.form ?? 'lamp',
      );
      item.appearance = spec.appearance;
      item.inspectText = spec.inspectText;
      s.objects.push(item);
      s.focusId = item.id;
      if (spec.materialsBatteryProvided) s.parts.batteries++;
    }
    if (serviceResult.promise && s.people.player) {
      const p = serviceResult.promise;
      if (id.includes('delay') || id.includes('later'))
        renegotiateCollection(s.people.player, p.objectId, p.ownerId, p.collectionAt);
      else agreeCheckedCollection(s.people.player, p.objectId, p.ownerId, p.collectionAt);
    }
    if (serviceResult.releaseCollectionId && s.people.player)
      releaseCheckedCollection(s.people.player, serviceResult.releaseCollectionId);
    if (serviceResult.recoverObjectId) {
      const item = s.objects.find((o) => o.id === serviceResult.recoverObjectId);
      if (item) {
        item.location = 'bench';
        item.returnedEarly = false;
        item.checkStarted = undefined;
        item.awaitingCollection = false;
        item.collectedAt = undefined;
        item.callbackAt = undefined;
        s.focusId = item.id;
      }
    }
    if (
      serviceResult.discoverPersonalProject &&
      !s.objects.some((o) => o.id === PERSONAL_PROJECT.id)
    ) {
      const spec = PERSONAL_PROJECT;
      const item = object(spec.id, spec.title, spec.owner, spec.story, spec.fault, spec.form);
      item.inspectText = spec.inspectText;
      item.repairText = spec.repairText;
      item.appearance = 'model';
      item.location = 'shelf';
      s.objects.push(item);
    }
    if (serviceResult.recoveredPart) {
      s.parts.gears = (s.parts.gears ?? 0) + serviceResult.recoveredPart.count;
      s.parts.gearTargets ??= [];
      s.parts.gearTargets.push(
        ...Array.from({ length: serviceResult.recoveredPart.count }, () => 'paper-street'),
      );
    }
    if (serviceResult.checkingPlaces) s.checkingPlaces = serviceResult.checkingPlaces;
    const until = serviceResult.nextDayAt ?? s.now + serviceResult.minutes;
    const player = s.people.player;
    const offer: Affordance = {
      id,
      action:
        id === 'service-personal-session'
          ? id
          : ['service-recover-donor', 'service-measure-donor', 'service-find-model'].includes(id)
            ? 'work'
            : id.includes('reflect')
              ? 'reflect'
              : 'talk',
      label: available(original).find((a) => a.id === id)?.label ?? id,
      duration: until - s.now,
      effort: 0.02,
      focus: 0.1,
      advertises: {},
      tags: id.includes('reflect') ? ['reflection'] : [],
    };
    if (player && !serviceResult.nextDayAt) begin(player, offer, decide(player, [offer]));
    s.now = until;
    advancePeople(s);
    if (player) {
      if (serviceResult.nextDayAt) liveOrdinaryTime(player, until);
      else {
        tick(player, until);
        finish(player, {
          affordanceId: id,
          action: offer.action,
          at: until,
          status: 'completed',
          summary: offer.label,
        });
      }
    }
    for (const line of serviceResult.lines) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  const workshopResult = applyWorkshopAction(s, id, workshopContext(s, true));
  if (workshopResult) {
    for (const personId of workshopResult.personIds ?? []) {
      if (!s.people[personId])
        s.people[personId] = createPerson({
          id: personId,
          name: personId[0]?.toUpperCase() + personId.slice(1),
          seed: s.seed ^ 761,
          now: s.now,
          bornAt: s.now - 34 * 365 * 1440,
          sex: personId === 'evan' ? 'male' : 'female',
          ...humanProfile(personId, s.now),
          relationships: [{ otherId: 'player', roles: ['friend'] }],
        });
      if (s.world) s.world.presence[personId] ??= { awayUntil: 0, activity: 'Arranged a visit' };
    }
    for (const visit of workshopResult.visits ?? [])
      if (s.world)
        s.world.presence[visit.personId] = { awayUntil: visit.at, activity: visit.activity };
    if (workshopResult.job) {
      const job = workshopResult.job;
      const item = object(job.id, job.title, job.owner, job.story, job.fault, job.form ?? 'lamp');
      item.appearance = job.appearance;
      item.inspectText = job.inspectText;
      s.objects.push(item);
      s.focusId = item.id;
    }
    const shared = s.people.player?.activity?.affordanceId.startsWith('cabinet-')
      ? s.people.player.activity
      : undefined;
    s.now += workshopResult.minutes;
    advanceBenchBeforePlayer(s, s.now);
    if (s.people.player) {
      tick(s.people.player, s.now);
      if (shared)
        finish(s.people.player, {
          affordanceId: shared.affordanceId,
          action: shared.action,
          at: s.now,
          status: 'completed',
          summary: shared.affordance.label,
          needs: shared.affordance.advertises,
        });
    }
    advancePeople(s);
    for (const line of workshopResult.lines) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  if (
    [
      'arrange-learning',
      'explain-step',
      'supervised-repair',
      'delegate-repair',
      'watch-sam',
      'take-over-repair',
      'learning-light',
      'supervised-intake',
      'independent-intake',
      'exception-intake',
    ].includes(id)
  ) {
    if (
      ['learning-light', 'supervised-intake', 'independent-intake', 'exception-intake'].includes(id)
    ) {
      const firstLesson = !s.objects.some((x) => x.id === 'lesson-battery');
      const itemId =
        id === 'learning-light'
          ? firstLesson
            ? 'lesson-battery'
            : 'lesson-contact'
          : id === 'supervised-intake'
            ? 'supervised-light'
            : id === 'independent-intake'
              ? 'independent-light'
              : 'exception-torch';
      const owner =
        id === 'independent-intake'
          ? 'Nora'
          : id === 'learning-light' && !firstLesson
            ? 'Dad'
            : 'Sam';
      const title =
        id === 'learning-light'
          ? firstLesson
            ? 'Sam’s spare table lamp'
            : 'Dad’s small sorting lamp'
          : id === 'supervised-intake'
            ? 'Sam’s unfamiliar folding light'
            : id === 'independent-intake'
              ? 'Nora’s shaded porch light'
              : 'Sam’s short hiking torch';
      const fault: Fault =
        id === 'learning-light'
          ? firstLesson
            ? 'battery'
            : 'contact'
          : id === 'supervised-intake'
            ? 'contact'
            : id === 'independent-intake'
              ? 'battery'
              : 'cap';
      const item = object(
        itemId,
        title,
        owner,
        firstLesson && id === 'learning-light'
          ? 'Sam keeps this small table lamp beside a chair. Its original cell has grown tired; he has brought it to the agreed teaching afternoon.'
          : id === 'learning-light'
            ? 'Dad uses this small lamp above his sorting tray. Moving it has become unreliable, so he has kept it aside for you and Sam to examine.'
            : id === 'supervised-intake'
              ? 'Sam wants this folding lamp usable at the small desk where he sorts his shift notes.'
              : id === 'independent-intake'
                ? 'Nora uses this shaded porch lamp while finding her keys after dusk. She has asked for a checked repair.'
                : 'Sam uses this short torch on the path with the dog. Its screw cap is a different contact arrangement from a table lamp.',
        fault,
        id === 'exception-intake' ? 'torch' : 'lamp',
      );
      s.objects.push(item);
      s.parts.batteries++;
      s.focusId = item.id;
      speak(
        owner,
        'Here it is, and a spare cell if it actually needs one. Tell me what you find rather than changing it blindly.',
      );
      if (id !== 'learning-light') startApprenticeJob(s, item, id === 'supervised-intake', speak);
    }
    if (id === 'arrange-learning') arrangeLearning(s, speak);
    if (id === 'explain-step') explainLesson(s, speak);
    if ((id === 'supervised-repair' || id === 'delegate-repair') && o)
      startApprenticeJob(s, o, id === 'supervised-repair', speak);
    if (id === 'take-over-repair' && s.apprentice?.jobId) {
      const sam = s.people.sam;
      if (sam?.activity)
        finish(sam, {
          affordanceId: sam.activity.affordanceId,
          action: sam.activity.action,
          at: sam.now,
          status: 'interrupted',
          summary: 'Passed the unfinished repair back to the player.',
        });
      const item = s.objects.find((x) => x.id === s.apprentice?.jobId);
      if (item) {
        item.independent = false;
        item.playerAssisted = true;
        item.assignedTo = undefined;
        item.location = 'bench';
        s.focusId = item.id;
      }
      s.apprentice.jobId = undefined;
      s.apprentice.pending = undefined;
      s.apprentice.needsHelp = undefined;
      speak(
        'You',
        'The observations stay with this light. You take responsibility for the next step.',
      );
    }
    if (id === 'watch-sam' && s.apprentice?.needsHelp) {
      const stopped = s.objects.find((x) => x.id === s.apprentice?.jobId);
      speak('You', 'Show me the last observation, and tell me where you became unsure.');
      speak(
        'Sam',
        `${stopped?.observations.at(-1) ?? 'I have not made a reliable observation yet.'} ${s.apprentice.needsHelp}`,
      );
      speak(
        'You',
        'Keep it labelled at that step. I can take responsibility, or we can revisit it after learning the missing method.',
      );
    }
    const until = s.now + (id === 'watch-sam' && !s.apprentice?.needsHelp ? 20 : 4);
    advanceBenchBeforePlayer(s, until);
    if (s.people.player) tick(s.people.player, until);
    s.now = until;
    advancePeople(s);
    return s;
  }
  const beforeCue = o ? cueFor(o, s.now) : undefined;
  const storyChoice = [
    ...optionalStoryChoices({
      focusId: s.focusId,
      focusOwner: o?.owner,
      chapter: s.chapter,
      unlocked: s.unlocked,
      holiday: s.campaign?.holiday,
      graduated: s.campaign?.graduated,
    }),
  ].find((x) => x.id === id);
  if (storyChoice) {
    s.unlocked.push(`story:${id}`);
    for (const line of storyChoice.lines)
      if (!(id === 'observer-invite' && line.text.includes('dog')))
        say(s, line.speaker, line.text, line.tone);
    s.conversation = s.conversation.slice(-8);
    s.now += 6;
    const player = s.people.player;
    if (!player) throw Error('Missing player');
    advanceBenchBeforePlayer(s, s.now);
    tick(player, s.now);
    if (id === 'observer-invite' && s.world?.presence.sam && s.people.sam) {
      liveOrdinaryTime(s.people.sam, s.now, true);
      const stays = chooseSamVisit(s.people.sam);
      if (stays === false) {
        s.world.presence.sam.awayUntil = s.now + 50;
        s.world.presence.sam.activity = 'Walking the dog — back later this afternoon';
      }
      say(
        s,
        'Sam',
        stays === null
          ? 'Let me finish what I’m doing first. We can talk about watching another time.'
          : stays
            ? 'I can stay a little while. Show me what you look for before taking it apart.'
            : 'Today I promised the dog a walk. I’ll be back in about fifty minutes; another afternoon for watching?',
        'warm',
      );
    }
    advancePeople(s);
    return s;
  }
  const contactName = id === 'accept-request' ? (s.requests % 2 === 0 ? 'nora' : 'sam') : undefined;
  const beat =
    id === 'return' || id === 'early-return'
      ? `${id === 'early-return' ? 'return-early' : 'return'}-${o?.id === 'family' || o?.id === 'personal' ? o.id : o?.owner.toLowerCase()}`
      : contactName
        ? `request-${contactName}`
        : id === 'rest' && s.chapter === 'garage'
          ? 'rest-garage'
          : id;
  const repeatedContact = contactName && s.unlocked.includes(`met:${contactName}`);
  const catalogue =
    id === 'accept-request' ? catalogueRequest(s.requests) : catalogueItem(o?.id ?? '');
  const lines =
    o &&
    (id === 'return' || id === 'early-return') &&
    !catalogue &&
    !['family', 'personal'].includes(o.id) &&
    !o.id.startsWith('friend-') &&
    !o.id.startsWith('request-')
      ? [
          {
            speaker: o.owner,
            text:
              id === 'return'
                ? `Thanks. ${o.title} can go back where it belongs, with the checked work written on its label.`
                : `Keep ${o.title} labelled honestly: it works now, but the longer check is still unfinished.`,
            tone: 'warm' as const,
          },
        ]
      : id === 'return' && o?.id === 'friend-4' && s.unlocked.includes('sewing-box-returned-again')
        ? [
            {
              speaker: 'Nora',
              text: 'The keeper meets the catch squarely again. Thank you for checking the lid with the cloth clear. The blue cloth and the first hinge repair are still here.',
              tone: 'warm' as const,
            },
          ]
        : catalogue && (id === 'accept-request' || id === 'return')
          ? id === 'accept-request'
            ? catalogue.requestLines
            : catalogue.returnLines
          : contactName
            ? requestStoryBeat(contactName === 'nora' ? 'Nora' : 'Sam', s.requests)
            : (id === 'return' || id === 'early-return') && o?.id.startsWith('friend-')
              ? requestStoryBeat(o.owner, Number(o.id.slice(7)), true, id === 'early-return')
              : storyBeat(repeatedContact ? `callback-${contactName}` : beat);
  const narrate: typeof say = (...args) => {
    if (!lines.length) say(...args);
  };
  const p = s.people.player;
  if (!p) throw Error('Missing player');
  const duration =
    id === 'wait-appointment'
      ? Math.max(1, (knownAppointments(s)[0]?.at ?? s.now + 30) - s.now)
      : id === 'next-day'
        ? 1440 - (s.now % 1440) + 9 * 60
        : ['rest', 'wait-person'].includes(id)
          ? 30
          : id === 'wait-check'
            ? o?.checkStarted !== undefined
              ? Math.min(
                  o.id === 'family' ? 10 : verificationMinutes(o),
                  Math.max(1, verificationMinutes(o) - (s.now - o.checkStarted)),
                )
              : 10
            : ['ask-mum', 'ask-dad'].includes(id)
              ? 8
              : ['clean-contact', 'replace-battery', 'fit-holder'].includes(id)
                ? 12
                : repairDuration(id);
  const aff: Affordance = {
    id,
    action: id === 'next-day' ? 'sleep' : id === 'rest' ? 'rest' : 'repair',
    ...(id === 'next-day' ? { mode: 'sleep' as const } : {}),
    label: available(s).find((a) => a.id === id)?.label ?? id,
    duration,
    effort: ['rest', 'next-day', 'wait-person'].includes(id) ? 0 : 0.15,
    focus: id === 'rest' ? 0 : 0.4,
    advertises: id === 'rest' ? { leisure: 0.1 } : { competence: 0.03 },
    ...([
      'inspect',
      'test-battery',
      'clean-contact',
      'replace-battery',
      'fit-holder',
      'verify',
    ].includes(id)
      ? { skill: { id: 'repair', difficulty: 0.25 } }
      : {}),
  };
  const familyMember = s.people.mum;
  if (!familyMember) throw Error('Missing family member');
  let sharedTea = false;
  // Taking a part for this visible action reserves it before concurrent bench work.
  const requiredPart = (
    {
      'replace-battery': 'batteries',
      'fit-holder': 'holders',
      'replace-spring': 'springs',
      'fit-gear': 'gears',
    } as const
  )[id as 'replace-battery' | 'fit-holder' | 'replace-spring' | 'fit-gear'];
  const reservedPart = requiredPart && (s.parts[requiredPart] ?? 0) > 0 ? requiredPart : undefined;
  if (reservedPart) s.parts[reservedPart] = (s.parts[reservedPart] ?? 0) - 1;
  advanceBenchBeforePlayer(s, s.now + duration);
  if (id === 'next-day' || id === 'wait-appointment') {
    const until = s.now + duration;
    s.now = until;
    advancePeople(s);
    s.now -= duration;
    liveOrdinaryTime(p, until);
  } else if (id === 'rest' && isHere(s, 'mum'))
    sharedTea = shareTea(p, familyMember, s.now + duration);
  else if (id === 'rest') {
    const rest = { ...aff, action: 'rest', effort: 0, focus: 0, advertises: { leisure: 0.1 } };
    const decision = decide(p, [rest]);
    if (decision.chosenAffordanceId === rest.id) begin(p, rest, decision);
    tick(p, s.now + duration);
    finish(p, {
      affordanceId: rest.id,
      action: rest.action,
      at: s.now + duration,
      status: 'completed',
      summary: rest.label,
      needs: rest.advertises,
    });
  } else {
    begin(p, aff, decide(p, [aff]));
    tick(p, s.now + duration);
  }
  s.now += duration;
  let failed = false;
  switch (id) {
    case 'next-day':
      say(s, 'You', 'The tools are put away. Tomorrow has room for the work that remains.');
      break;
    case 'talk-family':
      s.chapter = 'bench';
      s.objects.push(
        object(
          'family',
          'Mum’s reading lamp',
          'Mum',
          'It has lit Mum’s evening reading for years.',
          'contact',
        ),
      );
      s.focusId = 'family';
      narrate(
        s,
        'Mum',
        'It brightens if I hold it still. There’s a spare battery in the drawer if you want to compare.',
        'warm',
      );
      break;
    case 'inspect':
      if (o) {
        o.inspected = true;
        const text = inspectRepair(o);
        o.observations.push(text);
        narrate(s, 'You', text);
        if (o.id === 'personal' && !s.unlocked.includes('garage-hint')) {
          s.unlocked.push('garage-hint');
          narrate(
            s,
            'Mum',
            'Dad kept a box of old lamps in the garage. You could look for a matching part when you feel like it.',
          );
        }
      }
      break;
    case 'sewing-box-again':
      for (const text of acceptCatchReturn(s, isHere(s, 'nora'))) narrate(s, 'Nora', text, 'warm');
      break;
    case 'test-catch':
      if (o) {
        const text = testCatch(o);
        o.observations.push(text);
        narrate(s, 'You', text);
      }
      break;
    case 'test-battery':
      if (o) {
        o.tested = true;
        const text = testRepair(o);
        o.observations.push(text);
        narrate(s, 'You', text);
      }
      break;
    case 'clear-obstruction':
    case 'align-striker':
    case 'lubricate-hinge':
    case 'adjust-catch':
    case 'replace-spring':
    case 'fit-gear':
    case 'twist-cap':
    case 'clean-contact':
    case 'replace-battery':
    case 'fit-holder':
      if (o) {
        const result = applyRepair(
          o,
          id,
          reservedPart ? { ...s.parts, [reservedPart]: 1 } : s.parts,
        );
        const matches = result.succeeded;
        failed = !matches;
        const text = isMechanical(o)
          ? result.text
          : matches
            ? 'The light comes on steadily. It deserves a longer check before calling it finished.'
            : o.fault === 'contact'
              ? 'It still flickers when moved. Changing the battery did not restore the contact.'
              : s.inputs.length <= (s.feedbackRevisionFrom ?? 0)
                ? 'That did not help. Testing the battery will separate a weak cell from a contact problem.'
                : o.fault === 'cap'
                  ? id === 'replace-battery'
                    ? 'The spare battery does not straighten this torch’s threaded cap. The cap needs seating squarely so its thread can carry the return contact.'
                    : 'Cleaning the flat contact did not straighten this torch’s threaded cap. The cap needs seating squarely so its thread can carry the return contact.'
                  : o.tested
                    ? 'Cleaning the contact did not restore the old battery. The known-good battery already made it shine steadily; the original cell needs replacing.'
                    : 'That did not help. Testing the battery will separate a weak cell from a contact problem.';
        o.observations.push(text);
        narrate(s, 'You', text, matches ? 'notice' : 'mistake');
      }
      break;
    case 'wait-check-place':
      say(s, 'You', 'The stable checking place is occupied. This object stays labelled beside it.');
      break;
    case 'verify':
      if (o) {
        o.checkStarted = s.now;
        narrate(
          s,
          'You',
          o && isMechanical(o)
            ? 'The mechanism is running gently. One successful motion does not yet establish repeatable operation.'
            : 'The light is left on. A brief glow is not yet an evening of reliable light.',
        );
      }
      break;
    case 'wait-check':
      narrate(
        s,
        'You',
        o && isMechanical(o)
          ? 'You watch the mechanism complete its run, without forcing it.'
          : 'You watch the light for a while. It keeps shining.',
      );
      break;
    case 'check-result':
      if (o) {
        const result = readLongCheck(o, s.now);
        o.observations.push(result);
        narrate(s, 'You', result);
      }
      break;
    case 'ask-dad': {
      const dad = s.people.dad;
      if (dad) {
        tick(dad, s.now - duration);
        const helps = askMumToHelp(dad);
        s.unlocked.push(`dad-help:${o?.id}`);
        if (helps && o) {
          o.verified = true;
          o.observations.push(
            'Together you move it and switch it after the longer run; the light stays steady.',
          );
        }
        say(
          s,
          'Dad',
          helps
            ? 'I’ll hold it while you move the switch. It stayed steady for the longer run, and it stays steady now.'
            : 'Let me finish sorting this tray. There’s room beside me; you can carry on.',
          'warm',
        );
      }
      break;
    }
    case 'ask-mum': {
      const mum = familyMember;
      tick(mum, s.now - duration);
      const helps = askMumToHelp(mum);
      s.unlocked.push(`help:${o?.id}`);
      s.humanNote = helps
        ? 'Mum chooses a little more time together, holding the light while you check.'
        : 'Mum chooses her own chapter. The check can continue without her.';
      narrate(
        s,
        'Mum',
        helps
          ? 'All right. You move the switch; I’ll keep it steady.'
          : 'Let me finish my chapter. Leave it on — you can still watch it.',
      );
      break;
    }
    case 'early-return':
    case 'return':
      if (o && id === 'early-return') {
        o.returnedEarly = true;
        o.callbackSeen = false;
        const owner = isHere(s, o.owner.toLowerCase())
          ? s.people[o.owner.toLowerCase()]
          : undefined;
        const wantsCheck = owner ? chooseUncheckedReturn(owner) : false;
        o.callbackAt = wantsCheck ? s.now + 25 : undefined;
        if (owner)
          say(
            s,
            o.owner,
            wantsCheck
              ? 'Thank you for saying so. I’d like the longer check before I rely on it.'
              : 'Thanks for explaining. I can try it with another light nearby; I’ll let you know if it changes.',
            'warm',
          );
        delete o.checkStarted;
      }
      if (o) {
        o.location = 'returned';
        if (!isHere(s, o.owner.toLowerCase())) {
          o.awaitingCollection = true;
          say(
            s,
            'You',
            `${o.owner} is out. The finished item stays safely labelled here for collection.`,
          );
        }
        if (o.verified) {
          s.repairs++;
          o.returnedEarly = false;
        }
        if (o.returnedEarly)
          narrate(
            s,
            'You',
            o && isMechanical(o)
              ? 'It moves now, but I have not completed the repeated-operation check. Tell me if it sticks.'
              : 'It lights now, but I have not given it the longer check. Tell me if it falters.',
            'notice',
          );
        s.focusId = null;
        o.completedBy = 'player';
        if (o.id === 'family' && !s.objects.some((x) => x.id === 'personal')) {
          s.objects.push(
            object(
              'personal',
              'Your bedside lamp',
              'You',
              'You kept meaning to fix the little lamp from your old room.',
              'holder',
            ),
          );
          s.focusId = 'personal';
          s.chapter = 'later';
          narrate(
            s,
            'Mum',
            o.returnedEarly
              ? 'Thank you for saying it has not had the longer check. I’ll keep the other light nearby. Your old bedside lamp is still here too, if you’d like to look.'
              : 'That’s much better. I can finish my chapter tonight. Thank you. Your old bedside lamp is still here too, if you’d like to look.',
            'warm',
          );
        } else if (o.id === 'personal' && !o.returnedEarly)
          narrate(
            s,
            'You',
            'Back beside the bed, with a part that would have been thrown away.',
            'warm',
          );
        else if (!o.returnedEarly && !o.awaitingCollection)
          narrate(s, o.owner, 'I’m glad you checked it before giving it back. Thank you.', 'warm');
      }
      break;
    case 'shelve':
      if (o) {
        o.location = 'shelf';
        s.focusId = null;
        narrate(s, 'You', 'Put aside with its notes. Nothing is lost; you can come back to it.');
      }
      break;
    case 'resume':
      if (o) o.location = 'bench';
      break;
    case 'talk-garage':
      s.unlocked.push('garage');
      s.chapter = 'garage';
      narrate(
        s,
        'Mum',
        'There’s room on Dad’s bench. The old lamp box is under it; he said we could use anything in there.',
        'warm',
      );
      break;
    case 'search-spring':
      s.parts.springs = (s.parts.springs ?? 0) + 1;
      say(
        s,
        'You',
        'A damaged stamped clip has an intact leaf spring of the same size. You recover that part; it can be used once.',
      );
      break;
    case 'search-gear':
      s.unlocked.push('gear-recovered');
      s.parts.gears = (s.parts.gears ?? 0) + 1;
      s.parts.gearTargets ??= [];
      s.parts.gearTargets.push('paper-street');
      say(
        s,
        'You',
        'The labelled scrap mechanisms contain one matching gear. You recover it without discarding the saved model.',
      );
      break;
    case 'search-donor':
      s.unlocked.push('donor');
      s.discoveries++;
      s.parts.holders++;
      narrate(
        s,
        'You',
        'One discarded lamp has a sound holder of the same size. The rest goes in the recycling box.',
      );
      break;
    case 'talk-friends':
      s.unlocked.push('friends');
      narrate(
        s,
        'Mum',
        'I told our friends Nora and Sam about your careful checks. They sometimes have a little lamp or torch that needs attention. We can keep one on the bench and one waiting safely on the shelf. No rush.',
        'warm',
      );
      break;
    case 'accept-request': {
      const spec = catalogueRequest(s.requests++);
      if (!spec) throw Error('No new household request');
      s.worldRng = (Math.imul(s.worldRng, 1664525) + 1013904223) >>> 0;
      const item = object(spec.id, spec.title, spec.owner, spec.story, spec.fault, spec.form);
      item.inspectText = spec.inspectText;
      item.repairText = spec.repairText;
      item.appearance =
        spec.form === 'lamp' ? (spec.owner === 'Dad' ? 'reading' : 'kitchen') : spec.form;
      s.objects.push(item);
      s.focusId = item.id;
      if (!isMechanical(item)) s.parts.batteries++;
      if (spec.owner === 'Sam' && !s.unlocked.includes('met-sam')) s.unlocked.push('met-sam');
      break;
    }
    case 'find-paper-street': {
      const spec = PERSONAL_PROJECT;
      const item = object(spec.id, spec.title, spec.owner, spec.story, spec.fault, spec.form);
      item.inspectText = spec.inspectText;
      item.repairText = spec.repairText;
      item.appearance = 'model';
      s.objects.push(item);
      s.focusId = item.id;
      for (const line of spec.requestLines)
        if (isHere(s, line.speaker.toLowerCase())) say(s, line.speaker, line.text, line.tone);
      break;
    }
    case 'rest':
      s.humanNote = sharedTea
        ? 'You spent an unhurried half-hour together.'
        : 'You took a quiet break while Mum continued her own afternoon.';
      say(
        s,
        sharedTea ? 'Mum' : 'You',
        sharedTea
          ? s.inputs
              .slice(0, -1)
              .some((entry) => entry.input.id === 'rest' && s.now - entry.at < 120)
            ? 'Nice to sit a little longer. No need to keep talking.'
            : 'It’s nice having you here. Leave the light on; it can have its check while we sit.'
          : s.chapter === 'garage'
            ? 'You sit on the garage step for a while. The work can wait safely.'
            : 'The work can wait safely while you sit for a while.',
        sharedTea ? 'warm' : 'notice',
      );
      break;
  }
  if (id !== 'rest' && id !== 'next-day')
    finish(p, {
      affordanceId: id,
      action: aff.action,
      at: s.now,
      status: failed ? 'failed' : 'completed',
      summary: failed ? 'An attempted repair revealed the remaining problem.' : aff.label,
      needs: id === 'rest' ? { leisure: 0.1 } : { competence: failed ? 0 : 0.03 },
    });
  if (
    o &&
    [
      'inspect',
      'test-battery',
      'clean-contact',
      'replace-battery',
      'fit-holder',
      'twist-cap',
      'verify',
      'check-result',
      'clear-obstruction',
      'align-striker',
      'lubricate-hinge',
      'adjust-catch',
      'test-catch',
      'replace-spring',
      'fit-gear',
    ].includes(id)
  )
    o.playerAssisted = true;
  if (o && beforeCue) recordLesson(s, o, id, beforeCue, !failed, duration);
  advancePeople(s);
  if (o?.location === 'returned' && !o.awaitingCollection)
    for (const line of completeWorkshopJob(s, o.id, {
      verified: o.verified,
      independent: false,
      at: s.now,
    }))
      say(s, line.speaker, line.text, line.tone);
  if (contactName && !repeatedContact) s.unlocked.push(`met:${contactName}`);
  for (const line of lines)
    if (id !== 'early-return' && id !== 'rest' && isHere(s, line.speaker.toLowerCase()))
      say(s, line.speaker, line.text, line.tone);
  const mum = s.people.mum;
  if (!mum) throw Error('Missing family member');
  tick(mum, s.now);
  for (const returned of s.objects) {
    if (
      returned.returnedEarly &&
      !returned.callbackSeen &&
      s.now >= (returned.callbackAt ?? Infinity) &&
      isHere(s, returned.owner.toLowerCase())
    ) {
      returned.callbackSeen = true;
      returned.location = 'shelf';
      returned.verified = false;
      say(
        s,
        returned.owner,
        'It worked for a little while, but I kept wondering whether it would flicker again. Could we do that longer check after all? You said it had not been checked.',
        'notice',
      );
      returned.observations.push(
        'Returned for the promised longer check; the repair itself remains intact.',
      );
    }
  }
  return s;
}
export function getView(s: GameState): GameView {
  const o = focused(s);
  return {
    knownAppointments: knownAppointments(s),
    collectionPlans: s.objects
      .filter((item) => item.awaitingCollection)
      .map((item) => ({
        objectId: item.id,
        title: item.title,
        owner: item.owner,
        detail:
          (() => {
            const visit = knownAppointments(s).find((a) => a.personId === item.owner.toLowerCase());
            return visit
              ? `${item.title} is ready for ${item.owner}. Their next arranged visit is ${visit.detail.split(' · ').at(-1)}; that visit may concern other work.`
              : undefined;
          })() ?? 'Kept safely labelled for collection. A little more time may help.',
      })),
    apprenticeship: s.apprentice
      ? {
          name: 'Sam',
          activity:
            s.apprentice.needsHelp ??
            s.apprentice.pauseReason ??
            (s.apprentice.jobId
              ? `Working on ${s.objects.find((x) => x.id === s.apprentice?.jobId)?.title ?? 'the agreed light'}`
              : s.now < s.apprentice.visitUntil && isHere(s, 'sam')
                ? 'Alongside you at the bench'
                : 'Away until another arranged afternoon'),
          responsibility:
            s.apprentice.role === 'repairer'
              ? 'Handles supported light repairs; other promises stay with you.'
              : 'Learning observations and methods, without a guaranteed result.',
        }
      : undefined,
    lifeChapter: s.campaign
      ? {
          label: s.campaign.graduated
            ? `School finished · age ${Math.floor((s.now - (s.people.player?.life.bornAt ?? s.now)) / (365 * 1440))}`
            : `Summer at home · ${14 + s.campaign.holiday}`,
          detail: s.campaign.graduated
            ? 'A small place in the garage can become your own work.'
            : 'There is time before the next school year.',
        }
      : undefined,
    timeLabel: gameTimeLabel(s),
    whereabouts: Object.entries(s.world?.presence ?? {})
      .filter(([id]) => ['mum', 'dad'].includes(id) || s.unlocked.includes(`met:${id}`))
      .map(([id, presence]) => ({
        id,
        name: s.people[id]?.name ?? id,
        activity: !isHere(s, id)
          ? s.now % 1440 < 7 * 60 || s.now % 1440 >= 22 * 60
            ? 'It is late; leave conversation until morning'
            : s.now < presence.awayUntil
              ? `Expected: ${presence.activity}`
              : scheduledAway(s, id)
                ? id === 'sam'
                  ? 'At the parts counter; back after the agreed shift'
                  : id === 'nora'
                    ? 'Keeping her quiet morning at home; reachable after ten'
                    : 'Out for hardware; back around six'
                : s.people[id]?.activity?.action === 'pray'
                  ? 'Taking quiet time; back in a few minutes'
                  : s.people[id]?.activity?.action === 'walk'
                    ? 'Walking the dog; back afterward'
                    : 'Not available just now'
          : ['mum', 'dad'].includes(id)
            ? presence.activity
            : s.people[id]?.activity?.affordanceId === 'watch-repair'
              ? 'Watching beside the bench'
              : s.apprentice?.arranged && s.now < s.apprentice.visitUntil && id === 'sam'
                ? 'At the bench for the agreed afternoon'
                : 'At home; you can arrange a visit',
      })),
    title:
      s.chapter === 'family'
        ? 'A little light'
        : s.chapter === 'garage'
          ? 'The garage bench'
          : 'At home',
    subtitle:
      s.chapter === 'garage' ? 'Familiar things, a place to work.' : 'An afternoon at home.',
    scene: s.chapter === 'garage' ? 'garage' : 'home',
    focus: o
      ? {
          inspected: o.inspected,
          progress: o.verified
            ? 'checked'
            : o.repaired
              ? 'repaired'
              : o.inspected
                ? 'inspected'
                : 'closed',
          id: o.id,
          title: o.title,
          owner: o.owner,
          story:
            !['family', 'personal'].includes(o.id) && !o.id.startsWith('request-')
              ? o.story
              : (itemStory(o.id, o.owner) ?? o.story),
          form: o.form,
          condition: o.verified
            ? 'Checked and ready'
            : o.repaired
              ? isMechanical(o)
                ? 'It moves correctly — still needs checking'
                : 'It lights up — still needs checking'
              : isMechanical(o)
                ? o.inspected
                  ? (o.observations.at(-1) ?? 'The mechanism needs attention')
                  : 'A mechanism that isn’t working properly'
                : o.inspected && o.fault === 'holder'
                  ? 'A broken holder'
                  : o.inspected && o.fault === 'cap'
                    ? 'A loose cap contact'
                    : o.tested && o.fault === 'contact'
                      ? 'The contact needs attention'
                      : o.tested && o.fault === 'battery'
                        ? 'A tired battery'
                        : 'An unreliable light',
          visual: o.repaired
            ? 'steady'
            : o.fault === 'holder'
              ? 'broken'
              : o.fault === 'battery'
                ? 'off'
                : 'flickering',
          observations: [...o.observations],
          appearance:
            o.appearance ??
            (o.form === 'torch'
              ? 'torch'
              : o.id === 'family'
                ? 'reading'
                : o.id === 'personal'
                  ? 'bedside'
                  : 'kitchen'),
        }
      : null,
    actions: available(s),
    conversation: s.conversation,
    currentDialogue: (s.journal ?? s.conversation).filter(
      (line) => line.id >= (s.eventStartId ?? 0),
    ),
    journal: [
      ...(s.journal ?? []),
      ...s.conversation.filter((line) => !s.journal?.some((entry) => entry.id === line.id)),
    ].sort((a, b) => a.id - b.id),
    shelf: s.objects
      .filter((x) => x.discovered && x.location === 'shelf')
      .map((x) => ({
        id: x.id,
        title: x.title,
        note: x.observations.at(-1) ?? 'Waiting for another look.',
      })),
    parts:
      s.unlocked.includes('donor') && s.parts.holders > 0
        ? [{ id: 'holders', label: 'Matching recovered holder', count: s.parts.holders }]
        : [],
    note:
      o?.checkStarted !== undefined && !o.verified
        ? s.now - o.checkStarted >= verificationMinutes(o)
          ? 'The longer run is ready to read.'
          : 'The longer check is still running. Tea, waiting, or another repair can fill the time.'
        : s.objects.some((x) => x.awaitingCollection)
          ? 'Finished work is safely labelled here, waiting for its owner to collect it.'
          : null,
    humanNote:
      o?.checkStarted !== undefined && !o.verified
        ? (s.humanNote ?? null)
        : (s.humanNote
            ?.replace(' The check can continue without her.', '')
            .replace(
              'Mum chooses a little more time together, holding the light while you check.',
              'Mum spends a little more time nearby.',
            ) ?? null),
  };
}
function packet(s: GameState) {
  return {
    engine: ENGINE,
    state: {
      ...s,
      people: Object.fromEntries(Object.entries(s.people).map(([k, p]) => [k, snapshot(p)])),
    },
  };
}
export function serializeGame(s: GameState): string {
  return JSON.stringify(packet(s));
}
export const exportPlaytest = serializeGame;
export function restoreGame(text: string): GameState {
  if (typeof text !== 'string' || text.length > 8_000_000) throw Error('Save is too large');
  const data = JSON.parse(text);
  if (
    ['home-garage-2', 'home-garage-3', 'home-garage-4', 'home-garage-5', 'home-garage-6'].includes(
      data?.engine,
    )
  ) {
    if (data.engine === 'home-garage-6') {
      const validated = restoreEngine6(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    const validated =
      data.engine === 'home-garage-5'
        ? restoreEngine5(text)
        : data.engine === 'home-garage-4'
          ? restoreEngine4(text)
          : restoreEngine3(text);
    const migrated = {
      ...validated,
      framework: FRAMEWORK_VERSION,
      campaign:
        data.engine === 'home-garage-5'
          ? validated.campaign
          : {
              holiday: 4,
              lastSchoolRepairs: validated.repairs,
              graduated: true,
              startedAt: validated.now - 4 * 365 * 1440,
            },
      people: Object.fromEntries(
        Object.entries(validated.people).map(([id, person]) => [id, restore(snapshot(person))]),
      ),
      engine3Save: text,
      engine3InputCount: validated.inputs.length,
    };
    // Older adult imports did not play the school years. Some phase-five
    // migrations placed their summer origin four years in the future.
    if (
      migrated.campaign?.graduated &&
      migrated.campaign.startedAt + migrated.campaign.holiday * 365 * 1440 > migrated.now
    )
      migrated.campaign.startedAt = migrated.now - migrated.campaign.holiday * 365 * 1440;
    addPeople(migrated);
    for (const [id, person] of Object.entries(migrated.people))
      initializeMissingProfile(person, id);
    migrated.unlocked.push('profiles:6');
    return migrated;
  }
  if (
    !data ||
    data.engine !== ENGINE ||
    data.state?.schema !== 1 ||
    data.state?.scenario !== 1 ||
    data.state?.framework !== FRAMEWORK_VERSION ||
    !Array.isArray(data.state.inputs) ||
    data.state.inputs.length > 20000
  )
    throw Error('Unsupported save');
  if (
    data.state.legacySave &&
    (typeof data.state.legacySave !== 'string' ||
      JSON.parse(data.state.legacySave)?.engine !== 'home-garage-2')
  )
    throw Error('Invalid legacy save');
  let s = data.state.engine3Save
    ? restoreGame(data.state.engine3Save)
    : createGame(data.state.seed);
  const feedbackCutoff = data.state.feedbackRevisionFrom;
  if (
    feedbackCutoff !== undefined &&
    (!Number.isInteger(feedbackCutoff) ||
      feedbackCutoff < 0 ||
      feedbackCutoff > data.state.inputs.length)
  )
    throw Error('Invalid feedback revision');
  s.feedbackRevisionFrom = feedbackCutoff ?? data.state.inputs.length;
  if (data.state.legacyInputCount !== s.legacyInputCount) throw Error('Invalid migration history');
  for (const entry of data.state.inputs.slice(s.engine3InputCount ?? 0)) {
    if (!entry || entry.at !== s.now) throw Error('Invalid input history');
    s = transition(s, entry.input);
  }
  for (const p of Object.values(data.state.people ?? {})) restore(p);
  const replayed = packet(s);
  if (feedbackCutoff === undefined) delete replayed.state.feedbackRevisionFrom;
  if (JSON.stringify(replayed) !== JSON.stringify(data))
    throw Error('Save does not match its history');
  return s;
}
export const replayPlaytest = restoreGame;
