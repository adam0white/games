/**
 * Deterministic school-break repairs and a small shared workshop. The host owns
 * fictional objects, physical tests, parts, agreements and the elapsed clock.
 * Released HF owns people's condition, reception, acquired conditional methods
 * and apprentice decisions. Manual input remains a host control channel; the
 * game does not simulate school weeks or claim calibrated human development.
 */
import {
  type Affordance,
  abandonGoal,
  adoptGoal,
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
} from '@repair/hf-engine5';
import { aftercareActions, applyAftercareAction } from './aftercare16';
import {
  advanceApprentice,
  apprenticeActions,
  arrangeLearning,
  completeApprenticeJob,
  explainLesson,
  pendingCorrectiveDemonstration,
  prepareCorrectiveDemonstration,
  recordLesson,
  startApprenticeJob,
} from './apprentice16';
import { catalogueItem, catalogueRequest, PERSONAL_PROJECT } from './catalogue16';
import { acceptCatchReturn, catchReturnActions } from './catch-return16';
import { gameTimeLabel } from './clock16';
import { restoreGame as restoreEngine3 } from './engine3';
import { restoreGame as restoreEngine4 } from './engine4';
import { restoreGame as restoreEngine5 } from './engine5';
import { restoreGame as restoreEngine6 } from './engine6';
import { restoreGame as restoreEngine7 } from './engine7';
import { restoreGame as restoreEngine8 } from './engine8';
import { restoreGame as restoreEngine9 } from './engine9';
import { restoreGame as restoreEngine10 } from './engine10';
import { restoreGame as restoreEngine11 } from './engine11';
import { restoreGame as restoreEngine12 } from './engine12';
import { restoreGame as restoreEngine13 } from './engine13';
import { restoreGame as restoreEngine14 } from './engine14';
import { restoreGame as restoreEngine15 } from './engine15';
import {
  askMumToHelp,
  beginSharedConversation,
  beginSharedWork,
  type ConversationRefusal,
  chooseSamVisit,
  chooseUncheckedReturn,
  liveOrdinaryTime,
  shareTea,
  type TeaReport,
} from './humans16';
import {
  applyNeighbourhoodAction,
  type NeighbourhoodContext,
  neighbourhoodActions,
  neighbourhoodCase,
} from './neighbourhood16';
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
} from './practices16';
import {
  adaptCaseTray,
  applyRepair,
  catchActions,
  checkCaseCarry,
  checkCaseTray,
  checkingSpaceAvailable,
  compatibleGearAvailable,
  cueFor,
  fitCaseCatch,
  freshCaseFittings,
  inspectRepair,
  isMechanical,
  measureCaseFittings,
  pathTorchActions,
  performActiveBellCheck,
  performPathTorchUseCheck,
  readLongCheck,
  repairDuration,
  restoreCaseUnchanged,
  testCatch,
  testPathTorchCap,
  testRepair,
  verificationMinutes,
} from './repairs16';
import { nextHolidayStart, nextWakingMorning, playerAge } from './school-calendar16';
import {
  applyServiceWeekAction,
  cancelPersonalDonorForSchool,
  completeServiceWeekJob,
  type ServiceWeekContext,
  serviceWeekActions,
} from './service-week16';
import {
  itemStory,
  optionalStoryChoices,
  requestStoryBeat,
  schoolStoryBeat,
  storyBeat,
} from './story16';
import type { ActionView, Fault, GameInput, GameState, GameView, RepairObject } from './types18';
import {
  applyWorkshopAction,
  CABINET_MINUTES,
  completeWorkshopJob,
  freshWorkshop,
  type WorkshopContext,
  workshopActions,
} from './workshop16';

const ENGINE = 'home-garage-16';
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
/** A newly accepted object takes the player's place; other unfinished work stays reachable. */
function focusWorkbench(s: GameState, item: RepairObject) {
  for (const previous of s.objects)
    if (previous.id !== item.id && previous.location === 'bench' && previous.assignedTo !== 'sam')
      previous.location = 'shelf';
  if (item.assignedTo !== 'sam') item.location = 'bench';
  s.focusId = item.id;
}
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
    const notices: { action: string; from: number; until: number }[] = [];
    const activity = liveOrdinaryTime(
      person,
      s.now,
      (at) => at >= (presence?.awayUntil ?? 0) && !scheduledAway(s, id, at),
      (offer) => {
        if ((id === 'sam' && offer.action === 'walk') || (id === 'mum' && offer.action === 'pray'))
          notices.push({
            action: offer.action,
            from: person.now,
            until: person.activity?.endsAt ?? person.now,
          });
      },
    );
    const latest = notices.at(-1);
    if (
      latest &&
      (id !== 'sam' ||
        s.unlocked.includes('met:sam') ||
        s.unlocked.includes('story:observer-invite'))
    ) {
      const occurred = clockTime(latest.from);
      const ongoing = person.activity?.action === latest.action && person.activity.endsAt > s.now;
      const description = latest.action === 'pray' ? 'quiet prayer' : 'taking the dog out';
      sayRoutineOnce(
        s,
        'You',
        ongoing
          ? `${id === 'mum' ? 'Mum' : 'Sam'} is ${latest.action === 'pray' ? 'praying quietly' : 'taking the dog out'}. ${id === 'mum' ? 'She' : 'He'} stepped away at ${occurred}.`
          : `${id === 'mum' ? 'Mum' : 'Sam'} ${latest.action === 'pray' ? 'prayed quietly' : 'took the dog out'} earlier.${notices.length > 1 ? ` Other ordinary ${description} moments passed during this stretch.` : ''}`,
      );
    }
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
  const cabinetSlot = s.workshop?.cabinetAppointment;
  if (
    cabinetSlot?.status === 'planned' &&
    s.people.dad?.agenda.commitments.find((c) => c.id === cabinetSlot.dadId)?.status === 'broken'
  )
    cabinetSlot.status = 'missed';
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
/** A received household request supplies an ordinary HF purpose (importance .5).
 * Legacy candidate12 already records the heard request/acceptance: recall that
 * fact only on a current case action. No goals or past progress are fabricated
 * during restore or view queries; only genuinely completed case work advances. */
export function receivedCasePurposes(s: GameState) {
  const n = s.neighbourhood;
  if (!n || !['offered', 'accepted'].includes(n.caseStage)) return;
  const nora = s.people.nora,
    player = s.people.player;
  if (nora && !n.noraPurposeId)
    n.noraPurposeId = adoptGoal(
      nora,
      {
        label: 'Keep my samples together when I carry the case',
        serves: ['autonomy', 'belonging'],
        advancedBy: [{ action: 'return-case-carrying', amount: 1 }],
        importance: 0.5,
      },
      s.now,
    ).id;
  if (nora && n.caseStage === 'accepted' && !n.conservationPurposeId)
    n.conservationPurposeId = adoptGoal(
      nora,
      {
        label: 'Keep the saved fittings useful',
        serves: ['autonomy'],
        advancedBy: [
          { action: 'return-case-carrying', amount: 1 },
          { action: 'return-case-tray', amount: 1 },
          { action: 'return-case-unchanged', amount: 1 },
        ],
        importance: 0.5,
      },
      s.now,
    ).id;
  if (player && n.caseStage === 'accepted' && !n.playerPurposeId)
    n.playerPurposeId = adoptGoal(
      player,
      {
        label: 'Resolve Nora’s sample case honestly',
        serves: ['competence', 'belonging'],
        advancedBy: [
          { action: 'return-case-carrying', amount: 1 },
          { action: 'return-case-tray', amount: 1 },
          { action: 'return-case-unchanged', amount: 1 },
        ],
        importance: 0.5,
      },
      s.now,
    ).id;
}
export function caseConversationPurpose(s: GameState, id: string) {
  const n = s.neighbourhood;
  if (
    !n ||
    ![
      'neighbourhood-compare-source',
      'neighbourhood-source',
      'neighbourhood-tray-consent',
      'neighbourhood-accept-case',
      'neighbourhood-return-repaired',
      'neighbourhood-return-tray',
      'neighbourhood-return-unchanged',
    ].includes(id)
  )
    return undefined;
  return {
    physical: id === 'neighbourhood-compare-source',
    action:
      id === 'neighbourhood-return-repaired'
        ? 'return-case-carrying'
        : id === 'neighbourhood-return-tray'
          ? 'return-case-tray'
          : id === 'neighbourhood-return-unchanged'
            ? 'return-case-unchanged'
            : id === 'neighbourhood-accept-case'
              ? 'receive-case-for-repair'
              : id === 'neighbourhood-source'
                ? 'grant-case-fitting'
                : id === 'neighbourhood-tray-consent'
                  ? 'agree-case-tray'
                  : 'compare-case-fitting',
    partnerGoals: id.startsWith('neighbourhood-return-')
      ? [
          n.conservationPurposeId,
          ...(id === 'neighbourhood-return-repaired' ? [n.noraPurposeId] : []),
        ].filter((id): id is string => !!id)
      : [
            'neighbourhood-tray-consent',
            'neighbourhood-return-tray',
            'neighbourhood-return-unchanged',
          ].includes(id)
        ? []
        : n.noraPurposeId
          ? [n.noraPurposeId]
          : [],
    playerGoals: n.playerPurposeId ? [n.playerPurposeId] : [],
    ...(id === 'neighbourhood-source' || id === 'neighbourhood-tray-consent'
      ? {
          alternative: {
            id: id === 'neighbourhood-source' ? 'retain-case-fitting' : 'retain-carrying-use',
            action: 'keep',
            ...(id === 'neighbourhood-source' && n.conservationPurposeId
              ? { advances: [n.conservationPurposeId] }
              : id === 'neighbourhood-tray-consent' && n.noraPurposeId
                ? { advances: [n.noraPurposeId] }
                : {}),
            label:
              id === 'neighbourhood-source'
                ? 'Keep my retained catch as a spare'
                : 'Keep the original carrying use',
            duration: 0,
            effort: 0,
            advertises: { autonomy: 0.03 },
          },
        }
      : {}),
  };
}
function receivedPresenceActivity(activity: string) {
  return /collect/i.test(activity) ? 'Coming back for the arranged collection' : activity;
}
function conversationWait(s: GameState) {
  const cue = s.conversationPause;
  const person = cue ? s.people[cue.participantId] : undefined;
  const activity = person?.activity;
  return cue &&
    person?.body.alive &&
    !person.body.asleep &&
    !person.body.downed &&
    isHere(s, cue.participantId) &&
    activity?.affordanceId === cue.activityId &&
    activity.endsAt === cue.until &&
    Number.isFinite(cue.until) &&
    cue.until > s.now &&
    isHere(s, cue.participantId, cue.until)
    ? cue
    : undefined;
}
function dadSpaceWait(s: GameState) {
  const remembered = s.workshop?.spaceRefusalActivity;
  const current = s.people.dad?.activity;
  return !s.workshop?.intakeSpace &&
    remembered &&
    (remembered.ownerId ?? 'dad') === 'dad' &&
    current &&
    isHere(s, 'dad') &&
    current.affordanceId === remembered.id &&
    current.endsAt === remembered.endsAt &&
    Number.isFinite(current.endsAt) &&
    current.endsAt > s.now &&
    !scheduledAway(s, 'dad', current.endsAt)
    ? current
    : undefined;
}
function playerSpaceWait(s: GameState) {
  const remembered = s.workshop?.spaceRefusalActivity;
  const player = s.people.player,
    current = player?.activity;
  return !s.workshop?.intakeSpace &&
    remembered?.ownerId === 'player' &&
    current &&
    player?.body.alive &&
    !player.body.asleep &&
    !player.body.downed &&
    current.affordanceId === remembered.id &&
    current.endsAt === remembered.endsAt &&
    Number.isFinite(current.endsAt) &&
    current.endsAt > s.now
    ? current
    : undefined;
}
function workshopContext(s: GameState, choices = false): WorkshopContext {
  let dadReason =
    'I want to keep my own plans for now. Leave the notebook there; we can ask again another time.';
  let declinedBy: string | undefined;
  return {
    dadDeclinedBy: () => declinedBy,
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
          dadAgreesTime: () => {
            const player = s.people.player,
              dad = s.people.dad;
            return Boolean(
              player &&
                dad &&
                !scheduledAway(s, 'dad', s.now + 2) &&
                beginSharedWork(player, dad, {
                  id: 'cabinet-time-agreement',
                  action: 'talk',
                  label: 'Agreeing a time for the next cabinet step',
                  duration: 2,
                  effort: 0.01,
                  with: ['player'],
                  advertises: { belonging: 0.08, autonomy: 0.03 },
                }),
            );
          },
          dadWillWork: (task) => {
            const dad = s.people.dad;
            if (!dad) return false;
            const player = s.people.player;
            const duration =
              task === 'space' && s.workshop?.childhoodProject?.label === 'ready'
                ? 5
                : CABINET_MINUTES[task];
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
            const agreed = beginSharedWork(
              player,
              dad,
              {
                id: `cabinet-${task}`,
                action: `cabinet-${task}`,
                targetId: 'family-cabinet',
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
              },
              (id) => {
                declinedBy = id;
              },
            );
            if (!agreed)
              dadReason =
                declinedBy === 'player'
                  ? `Dad was ready for the shared work, but you are still ${player.activity?.affordance.label.toLowerCase() ?? 'pausing before beginning'}. The shared work has not started.`
                  : dad.body.sleepPressure > 0.8 || dad.body.exertion > 0.8
                    ? task === 'space'
                      ? 'I am too tired to clear and label incoming work carefully now. The arrangement can wait.'
                      : 'I am too tired to give those hinges careful attention now. Keep the marks; the work can wait.'
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
function cancelCabinetTime(s: GameState) {
  const a = s.workshop?.cabinetAppointment;
  if (!a || !['planned', 'missed'].includes(a.status)) return;
  if (s.people.dad) releaseCommitment(s.people.dad, a.dadId);
  if (s.people.player) releaseCommitment(s.people.player, a.playerId);
  a.status = 'cancelled';
}
function neighbourhoodContext(s: GameState): NeighbourhoodContext {
  const item = s.objects.find((o) => o.id === neighbourhoodCase.id);
  return {
    weekConcluded: ['small', 'regular'].includes(s.serviceWeek?.conclusion ?? ''),
    noraHere: isHere(s, 'nora'),
    model: s.objects.find((o) => o.id === PERSONAL_PROJECT.id),
    caseObject: item,
    fittings: item?.caseFittings,
    drawingsShared: s.workshop?.drawingChoice === 'displayed',
    agree: () => false,
    compatibleSourceKnown: !!s.neighbourhood?.sourceCompared,
    frontageAvailable: Array.from({ length: 31 }, (_, i) => s.now + i).every((at) =>
      isHere(s, 'nora', at),
    ),
  };
}
function clockTime(at: number) {
  return `${String(Math.floor((at % 1440) / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}
function checkWaitMinutes(item: RepairObject | undefined, now: number): number {
  return item?.checkStarted === undefined
    ? 10
    : Math.min(
        item.id === 'family' ? 10 : verificationMinutes(item),
        Math.max(1, verificationMinutes(item) - (now - item.checkStarted)),
      );
}
function knownAppointments(s: GameState) {
  const appointments = Object.entries(s.world?.presence ?? {})
    .filter(([, p]) => p.awayUntil > s.now)
    .map(([id, p]) => ({
      personId: id,
      name: s.people[id]?.name ?? id,
      at: p.awayUntil,
      detail: `${receivedPresenceActivity(p.activity)} · ${Math.floor(p.awayUntil / 1440) === Math.floor(s.now / 1440) ? 'today' : Math.floor(p.awayUntil / 1440) === Math.floor(s.now / 1440) + 1 ? 'tomorrow' : `in ${Math.floor(p.awayUntil / 1440) - Math.floor(s.now / 1440)} days`} at ${String(Math.floor((p.awayUntil % 1440) / 60)).padStart(2, '0')}:${String(p.awayUntil % 60).padStart(2, '0')}`,
    }));
  for (const flag of s.unlocked) {
    const shift = /^service-counter:(\d+):(\d+)$/.exec(flag);
    if (
      shift &&
      s.unlocked.includes(`heard-counter:${shift[1]}:${shift[2]}`) &&
      Number(shift[2]) > s.now &&
      Number(shift[1]) <= s.now
    )
      appointments.push({
        personId: 'sam',
        name: 'Sam',
        at: Number(shift[2]),
        detail:
          'Sam told you his agreed parts-counter shift ends at 17:00; bench time still needs his agreement.',
      });
  }
  if (s.samPlans?.availableAfter && s.samPlans.availableAfter > s.now)
    appointments.push({
      personId: 'sam',
      name: 'Sam',
      at: s.samPlans.availableAfter,
      detail:
        s.samPlans.availabilityReason ?? 'Sam asked you to try again after his current plans.',
    });
  if (
    (s.samPlans?.routineShiftKnown ||
      s.unlocked.includes('sam-afternoon-note') ||
      s.unlocked.some((flag) => {
        const request = /^known-request:(\d+)$/.exec(flag);
        return request && catalogueRequest(Number(request[1]))?.ownerId === 'sam';
      })) &&
    s.now % 1440 >= 9 * 60 &&
    s.now % 1440 < 13 * 60
  )
    appointments.push({
      personId: 'sam',
      name: 'Sam',
      at: Math.floor(s.now / 1440) * 1440 + 13 * 60,
      detail:
        'Sam said his usual morning shift ends at 13:00. This is a chance to ask, not an agreed bench session.',
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
  const cabinet = s.workshop?.cabinetAppointment;
  if (cabinet?.status === 'planned' && cabinet.at > s.now)
    appointments.push({
      personId: 'dad',
      name: 'Dad',
      at: cabinet.at,
      detail: `Agreed cabinet ${cabinet.task} · ${Math.floor(cabinet.at / 1440) === Math.floor(s.now / 1440) ? 'today' : 'tomorrow'} at 15:45; ask together when the time comes.`,
    });
  // A received note remains knowledge after its particular repair is over.
  for (const flag of s.unlocked) {
    const match = /^known-request:(\d+)$/.exec(flag);
    const next = match ? catalogueRequest(Number(match[1])) : undefined;
    if (
      !next ||
      !scheduledAway(s, next.ownerId) ||
      (s.world?.presence[next.ownerId]?.awayUntil ?? 0) > s.now
    )
      continue;
    const endHour = next.ownerId === 'sam' ? 13 : next.ownerId === 'nora' ? 10 : 0;
    const at = Math.floor(s.now / 1440) * 1440 + endHour * 60;
    if (
      at > s.now &&
      !appointments.some(
        (appointment) => appointment.personId === next.ownerId && appointment.at === at,
      )
    )
      appointments.push({
        personId: next.ownerId,
        name: next.owner,
        at,
        detail: `Known routine: ${next.owner} is usually reachable after ${endHour}:00; this is not an arranged visit.`,
      });
  }
  return appointments.sort((a, b) => a.at - b.at);
}
function available(s: GameState): ActionView[] {
  const a: ActionView[] = [];
  if (
    s.samPlans?.invitation === 'pending' &&
    !s.apprentice?.jobId &&
    !(s.apprentice?.arranged && s.now < s.apprentice.visitUntil) &&
    (s.samPlans.availableAfter ?? 0) <= s.now &&
    isHere(s, 'sam')
  )
    a.push({
      id: 'resume-observer-invite',
      label: 'Ask Sam again about watching a repair',
      detail: 'The earlier invitation was left open. He can choose whether now fits his plans.',
      kind: 'primary',
    });
  const appointments = knownAppointments(s);
  for (const [index, appointment] of appointments.entries())
    a.push({
      id: index === 0 ? 'wait-appointment' : `wait-known-${appointment.personId}-${appointment.at}`,
      label:
        appointment.detail.startsWith('Known routine:') ||
        appointment.detail.startsWith('Sam said his usual')
          ? `Wait until ${appointment.name}’s usual free time`
          : appointment.personId === 'dad' && appointment.at === s.workshop?.cabinetAppointment?.at
            ? 'Wait until the agreed cabinet time with Dad'
            : appointment.personId === 'sam' && appointment.detail.includes('shift ends')
              ? 'Let Sam finish the shift he told you about'
              : appointment.personId === 'sam' && s.samPlans?.availableAfter === appointment.at
                ? 'Leave time for the plans Sam mentioned'
                : appointment.personId === 'player'
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
    !s.objects.some(
      (item) =>
        item.awaitingCollection || (item.id.startsWith('friend-') && item.location !== 'returned'),
    ) &&
    !s.objects.some(
      (item) => item.checkStarted !== undefined && !item.verified && item.location !== 'returned',
    )
  )
    add(
      'back-to-school',
      'Close this summer and return to school',
      'Leave the rest of this holiday and the ordinary school months unplayed. Next summer begins on a fresh morning; your labelled work and notes remain.',
    );
  if (
    s.chapter === 'garage' &&
    s.campaign &&
    !s.campaign.graduated &&
    !a.some((action) => action.id === 'back-to-school') &&
    !s.objects.some(
      (item) =>
        item.awaitingCollection ||
        (item.owner !== 'You' && item.location !== 'returned' && item.id.startsWith('friend-')) ||
        (item.checkStarted !== undefined && !item.verified && item.location !== 'returned'),
    )
  )
    add(
      'leave-school-holiday',
      'Put optional work aside and return to school',
      'End this played holiday without doing every repair. Your unfinished personal work, parts and notes stay; no repairs or lessons happen offscreen.',
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
  if (s.chapter === 'garage' && !s.objects.some((item) => item.id === 'paper-street'))
    add(
      'find-paper-street',
      'Bring your saved paper-street box to the back bench',
      'Your own childhood shopfronts and windup base, kept in the small room.',
    );
  if (
    s.objects.some(
      (item) =>
        item.id === 'personal' &&
        item.owner === 'You' &&
        item.location === 'returned' &&
        item.returnedEarly &&
        !item.verified,
    )
  )
    add(
      'bring-back-bedside',
      'Bring your bedside lamp back for the longer check',
      'Three minutes to bring the same lamp downstairs. Its repair and notes stay with it; the longer check remains unfinished.',
      'primary',
    );
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
  const needsNeighbourRate = !!(
    o &&
    o.id === 'workshop-neighbourhood-nora-light' &&
    s.workshop?.jobs.some((job) => job.id === o.id && job.fee > 0) &&
    !s.workshop?.paidHelp
  );
  const conversationWaiting = conversationWait(s);
  if (conversationWaiting)
    add(
      'wait-conversation-activity',
      conversationWaiting.participantId === 'player'
        ? `Finish your current activity: ${conversationWaiting.label}`
        : `Let ${s.people[conversationWaiting.participantId]?.name ?? 'your visitor'} finish: ${conversationWaiting.label}`,
      'Leave time for the activity you just heard about. You can ask again afterward; it is not an agreement to talk.',
      'primary',
    );
  const playerWaiting = playerSpaceWait(s);
  if (playerWaiting)
    add(
      'wait-player-activity',
      `Finish your current activity: ${playerWaiting.affordance.label}`,
      'Wait until what you are doing ends. Dad may still keep his own plans.',
      'primary',
    );
  const dadWaiting = dadSpaceWait(s);
  if (dadWaiting)
    add(
      'wait-dad-activity',
      `Let Dad finish: ${dadWaiting.affordance.label}`,
      'Wait to the end of what he is doing. He may still keep his own plans.',
      'primary',
    );
  a.push(
    ...apprenticeActions(s, o, isHere(s, 'sam'), (id) => isHere(s, id)).filter(
      (action) => (!needsServiceRate && !needsNeighbourRate) || action.id !== 'delegate-repair',
    ),
    ...workshopActions(s, workshopContext(s)).map((action) =>
      needsNeighbourRate && action.id === 'workshop-sam-agreement'
        ? { ...action, kind: 'primary' as const }
        : action,
    ),
    ...serviceWeekActions(s, serviceContext(s)).map((action) =>
      needsServiceRate && action.id === 'service-paid-help'
        ? { ...action, kind: 'primary' as const }
        : action,
    ),
    ...catchReturnActions(s, isHere(s, 'nora')),
    ...neighbourhoodActions(s, neighbourhoodContext(s))
      .map((action) =>
        action.id === 'neighbourhood-accept-light'
          ? {
              ...action,
              label:
                s.serviceWeek?.route === 'regular'
                  ? 'Agree £5 for the checked light, collected tomorrow at 14:00'
                  : 'Accept the light as a favour, collected tomorrow at 14:00',
              detail:
                'Nora supplies its battery. Sam’s own help or paid work still needs a separate agreement.',
            }
          : action,
      )
      .filter(
        (action) =>
          !['neighbourhood-accept-case', 'neighbourhood-accept-light'].includes(action.id) ||
          s.objects.filter(
            (item) => ['bench', 'shelf'].includes(item.location) && item.assignedTo !== 'sam',
          ).length < 2,
      ),
  );
  if (o?.caseFittings && o.location !== 'returned') {
    const f = o.caseFittings;
    if (!f.measured) add('measure-case', 'Compare the case and replacement mounting holes');
    if (f.measured && !f.revisedUse && !o.repaired) {
      add('try-case-replacement', 'Try the labelled replacement against the holes');
      if (f.compatible?.permission && f.compatible.status === 'retained')
        add('fit-case-catch', 'Fit Nora’s measured compatible catch');
    }
    if (o.repaired && !o.verified && !f.revisedUse)
      add('check-case-carry', 'Check repeated closure and carrying with the samples');
    if (f.revisedUse === 'stationary-tray' && !f.trayChecked)
      add('check-case-tray', 'Check the samples on a level counter');
    add('shelve', 'Label the case and put it safely aside');
  }
  if (o && !o.caseFittings && o.assignedTo !== 'sam') {
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
      for (const [id, label] of pathTorchActions(o)) add(id, label);
      if (o.id !== 'friend-1' && o.form === 'torch' && o.fault === 'cap')
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
        if (o.id !== 'friend-1') add('clean-contact', 'Clean and reseat the contact');
        if (s.parts.batteries > 0) add('replace-battery', 'Put in the spare battery');
      }
      if (o.inspected && o.observations.some((x) => x.includes('holder')) && s.parts.holders > 0)
        add('fit-holder', 'Fit the recovered holder');
    }
    if (o.repaired && !o.verified) {
      if (o.checkStarted === undefined && checkingSpaceAvailable(s, o.id))
        add(
          'verify',
          o.id === 'friend-1'
            ? 'Prepare the torch’s grip and movement check'
            : isMechanical(o)
              ? o.form === 'timer'
                ? 'Wind it gently and start one full timer cycle'
                : 'Start a repeated-operation check'
              : 'Start a longer light check',
          o.id === 'friend-1'
            ? 'Prepare a six-minute attended check: change grip, move it and switch it. Waiting alone cannot perform it.'
            : isMechanical(o)
              ? o.form === 'bell'
                ? 'Set up an attended ringing and movement test. The bell cannot test itself while you are away.'
                : `Give it ${verificationMinutes(o)} minutes of gentle operation, then inspect the result.`
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
      else if (
        o.id === 'friend-1' ||
        o.form === 'bell' ||
        s.now - o.checkStarted >= verificationMinutes(o)
      )
        add(
          'check-result',
          o.id === 'friend-1'
            ? 'Check your grip, movement and switching for six minutes'
            : isMechanical(o)
              ? o.form === 'bell'
                ? 'Ring and move the bell repeatedly for five minutes'
                : 'Repeat the motion and read the check'
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
            : `${checkWaitMinutes(o, s.now)} quiet ${checkWaitMinutes(o, s.now) === 1 ? 'minute' : 'minutes'}, watching for a change.`,
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
  if (
    (s.unlocked.includes('garage-hint') || s.chapter === 'later') &&
    !s.unlocked.includes('garage')
  )
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
  if (
    s.repairs >= 1 &&
    s.unlocked.includes('garage') &&
    !s.unlocked.includes('friends') &&
    isHere(s, 'mum')
  )
    add('talk-friends', 'Tell Mum about the garage bench');
  if (
    s.chapter === 'garage' &&
    s.campaign?.graduated &&
    (s.unlocked.includes('met-sam') || s.unlocked.includes('met:sam')) &&
    !s.samPlans &&
    !s.unlocked.includes('sam-afternoon-note')
  )
    add(
      'read-sam-afternoon-note',
      'Read Sam’s note about an afternoon together',
      'Your friend has left a note about the counter and learning at the bench. No visit or work agreement has been made.',
      'primary',
    );
  const householdNote = catalogueRequest(s.requests);
  if (
    s.chapter === 'garage' &&
    s.unlocked.includes('friends') &&
    householdNote &&
    (s.campaign?.graduated || (s.campaign?.holiday ?? 4) >= Math.floor(s.requests / 2)) &&
    !s.unlocked.includes(`known-request:${s.requests}`)
  )
    add(
      'read-household-note',
      'Read the note left for the bench',
      'A household request and a usual time to call; reading it does not accept the job.',
      'primary',
    );
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
      `Accept ${householdNote?.title ?? 'the household repair'} for a look`,
      'Take responsibility for this item now. Reading the household note alone leaves the request open; other work can wait safely on the shelf.',
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
    !(s.apprentice?.arranged && s.now < s.apprentice.visitUntil && isHere(s, 'sam')) &&
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
      cabinetStage: s.workshop?.cabinet,
    }),
  ])
    if (choice.lines.every((line) => isHere(s, line.speaker.toLowerCase())))
      add(
        choice.id,
        (() => {
          const speaker = choice.lines.find((line) => line.speaker !== 'You')?.speaker;
          return speaker && !choice.label.includes(speaker)
            ? `${speaker}: ${choice.label}`
            : choice.label;
        })(),
        undefined,
        (choice.id === 'observer-invite' || choice.id === 'after-school-work') &&
          s.campaign?.graduated
          ? 'primary'
          : 'quiet',
      );
  const correction = pendingCorrectiveDemonstration(s);
  const actions = a.some((action) => action.id === 'show-corrective-step')
    ? a.filter((action) => action.id !== 'reconsider-sam')
    : a;
  return correction
    ? actions.map((action) =>
        (action.id === 'clean-contact' && o?.id === correction.id && !correction.repaired) ||
        (action.id === 'explain-step' && s.apprentice?.lastLesson?.objectId === correction.id)
          ? { ...action, kind: 'primary' as const }
          : action,
      )
    : actions;
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
    focusWorkbench(s, ready);
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
  if (id === 'read-sam-afternoon-note') {
    s.unlocked.push('sam-afternoon-note');
    say(
      s,
      'You',
      'Sam’s note reads: “Now you have finished school too, perhaps we can find an afternoon at the bench. I take more hours at the parts counter, but I would like to understand the things I hand over. My usual morning ends at one. Ask me then; we still need to agree a time, and I have the dog and my other work.” Reading the note does not arrange a visit.',
      'notice',
    );
    return s;
  }
  if (id === 'read-household-note') {
    const next = catalogueRequest(s.requests);
    if (next) {
      s.unlocked.push(`known-request:${s.requests}`);
      say(
        s,
        'You',
        `The note is from ${next.owner}: “I have ${next.title.startsWith(`${next.owner}’s `) ? `my ${next.title.slice(next.owner.length + 3)}` : next.title} for a look, if you have room. ${next.ownerId === 'sam' ? 'I am usually back from the counter after one.' : next.ownerId === 'nora' ? 'Try me after ten; I keep the early morning quiet.' : 'Ask me when we are both at home.'}” Nothing has been accepted yet.`,
        'notice',
      );
    }
    return s;
  }
  if (id === 'talk-friends') {
    // Receive the conversation before elapsed time can take Mum into another activity.
    for (const line of storyBeat('talk-friends')) say(s, line.speaker, line.text, line.tone);
    s.unlocked.push('friends');
    const until = s.now + 4;
    advanceBenchBeforePlayer(s, until);
    s.now = until;
    advancePeople(s);
    return s;
  }
  if (['back-to-school', 'leave-school-holiday'].includes(id) && s.campaign) {
    const donorAt = s.serviceWeek?.donorAt;
    const cancelledDonor = cancelPersonalDonorForSchool(s);
    if (cancelledDonor.length) {
      for (const [personId, goalId] of [
        ['evan', s.serviceWeek?.donorPurposeId],
        ['player', s.serviceWeek?.donorPlayerPurposeId],
      ] as const) {
        const person = s.people[personId];
        if (
          person &&
          goalId &&
          person.agenda?.goals.some((goal) => goal.id === goalId && goal.status === 'active')
        )
          abandonGoal(person, goalId);
      }
      if (s.serviceWeek) {
        delete s.serviceWeek.donorPurposeId;
        delete s.serviceWeek.donorPlayerPurposeId;
      }
      const presence = s.world?.presence.evan;
      if (
        presence &&
        presence.awayUntil === donorAt &&
        presence.activity === 'Bringing the invited display base'
      ) {
        presence.awayUntil = 0;
        presence.activity = 'The personal donor visit was cancelled before school';
      }
      for (const line of cancelledDonor) say(s, line.speaker, line.text, line.tone);
    }

    if (['planned', 'missed'].includes(s.workshop?.cabinetAppointment?.status ?? '')) {
      cancelCabinetTime(s);
      say(
        s,
        'You',
        'You cancel the saved cabinet time before school resumes. The unfinished doors stay safely in place.',
      );
    }
    const to = nextHolidayStart(s.now);
    for (const person of Object.values(s.people)) {
      const practiced = suspendUnplayedPractice(person);
      skip(person, to - 6 * 60);
      if (practiced) resumePlayedPractice(person);
      liveOrdinaryTime(person, to);
    }
    for (const item of s.objects) if (item.location === 'bench') item.location = 'shelf';
    s.focusId = null;
    s.now = to;
    s.campaign.holidayStartedAt = to;
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
    for (const line of schoolStoryBeat(s.campaign.holiday, s.workshop?.cabinet))
      if (isHere(s, line.speaker.toLowerCase())) say(s, line.speaker, line.text, line.tone);
    const next = catalogueRequest(s.requests);
    if (
      next &&
      s.unlocked.includes('friends') &&
      s.campaign.holiday >= Math.floor(s.requests / 2) &&
      ['sam', 'nora'].includes(next.ownerId) &&
      isHere(s, 'mum')
    ) {
      say(
        s,
        'Mum',
        next.ownerId === 'sam'
          ? 'Sam may have the next thing for the bench. His usual counter morning ends at one; you can ask him after that, if he is free.'
          : 'Nora may have the next thing for the bench. She keeps her quiet morning at home until ten; you can ask her after that, if she is free.',
      );
      s.unlocked.push(`known-request:${s.requests}`);
    }
    return s;
  }
  if (input.type === 'action' && input.id === 'bring-back-bedside') {
    const item = s.objects.find((x) => x.id === 'personal');
    const player = s.people.player;
    if (!item || !player) throw Error('Missing the bedside lamp or player');
    const offer: Affordance = {
      id: input.id,
      action: 'retrieve',
      label: 'Bring my bedside lamp downstairs for its unfinished check',
      duration: 3,
      effort: 0.05,
      focus: 0.1,
      advertises: {},
    };
    begin(player, offer, decide(player, [offer]));
    s.now += 3;
    advanceBenchBeforePlayer(s, s.now);
    tick(player, s.now);
    finish(player, {
      affordanceId: offer.id,
      action: offer.action,
      at: s.now,
      status: 'completed',
      summary: offer.label,
    });
    item.location = 'bench';
    item.checkStarted = undefined;
    item.collectedAt = undefined;
    focusWorkbench(s, item);
    advancePeople(s);
    say(
      s,
      'You',
      'You bring your own lamp down from beside the bed. Its repair and notes stay with it; now you can give it the longer check.',
    );
    return s;
  }
  const o = focused(s);
  const teaRunningCheck =
    o?.checkStarted !== undefined && !o.verified && s.now - o.checkStarted < verificationMinutes(o);
  const teaCheckText = !teaRunningCheck
    ? ''
    : o?.form === 'timer'
      ? ' The timer had time for its cycle while we sat.'
      : o && isMechanical(o)
        ? ' The mechanism had time for its check while we sat.'
        : ' The light had time for its check while we sat.';

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
  if (
    id.startsWith('neighbourhood-') ||
    [
      'measure-case',
      'try-case-replacement',
      'fit-case-catch',
      'check-case-carry',
      'check-case-tray',
    ].includes(id)
  )
    receivedCasePurposes(s);
  if (
    [
      'measure-case',
      'try-case-replacement',
      'fit-case-catch',
      'check-case-carry',
      'check-case-tray',
    ].includes(id)
  ) {
    const item = focused(s),
      player = s.people.player;
    if (!item?.caseFittings || !player) throw Error('No case on the bench');
    const minutes = id === 'fit-case-catch' ? 12 : id === 'check-case-carry' ? 10 : 5;
    const work: Affordance = {
      id,
      action: 'work',
      advances:
        s.neighbourhood?.playerPurposeId &&
        (id === 'measure-case' ||
          id === 'fit-case-catch' ||
          (id === 'check-case-carry' && !item.caseFittings.repeatedClosures) ||
          (id === 'check-case-tray' && !item.caseFittings.trayChecked))
          ? [s.neighbourhood.playerPurposeId]
          : [],
      tags: ['case-work', id],
      label: available(original).find((a) => a.id === id)?.label ?? id,
      duration: minutes,
      effort: 0.05,
      focus: 0.15,
      advertises: { competence: 0.08 },
    };
    const decision = decide(player, [work]);
    if (decision.chosenAffordanceId !== id || !begin(player, work, decision)) {
      say(
        s,
        'You',
        `You are still ${player.activity?.affordance.label.toLowerCase() ?? 'pausing before the work'}. The case has not changed.`,
      );
      return s;
    }
    s.conversationPause = undefined;
    const until = s.now + minutes;
    advanceBenchBeforePlayer(s, until);
    tick(player, until);
    s.now = until;
    const completed =
      player.body.alive &&
      !player.body.downed &&
      !player.body.asleep &&
      player.activity?.affordanceId === id;
    if (player.activity?.affordanceId === id)
      finish(player, {
        affordanceId: id,
        action: work.action,
        at: until,
        status: completed ? 'completed' : 'interrupted',
        ...(completed && work.advances ? { advances: work.advances } : {}),
        summary: work.label,
      });
    advancePeople(s);
    if (!completed) {
      say(s, 'You', 'You stop before the case work is complete. Its fittings stay as they were.');
      return s;
    }
    const text =
      id === 'measure-case'
        ? measureCaseFittings(item, item.caseFittings)
        : id === 'try-case-replacement'
          ? fitCaseCatch(item, item.caseFittings, 'replacement').text
          : id === 'fit-case-catch'
            ? fitCaseCatch(item, item.caseFittings, 'compatible').text
            : id === 'check-case-carry'
              ? checkCaseCarry(item, item.caseFittings)
              : checkCaseTray(item, item.caseFittings);
    item.playerAssisted = true;
    if (item.observations.at(-1) !== text) item.observations.push(text);
    say(s, 'You', text, 'notice');
    return s;
  }
  const neighbourhoodCtx = neighbourhoodContext(s);
  if (neighbourhoodActions(s, neighbourhoodCtx).some((a) => a.id === id)) {
    const minutes =
      id === 'neighbourhood-frontage'
        ? 30
        : ['neighbourhood-source', 'neighbourhood-compare-source'].includes(id)
          ? 5
          : 3;
    const player = s.people.player,
      nora = s.people.nora;
    let refusal: ConversationRefusal | undefined;
    if (
      !player ||
      !nora ||
      !Array.from({ length: minutes + 1 }, (_, i) => s.now + i).every((at) =>
        isHere(s, 'nora', at),
      ) ||
      !beginSharedConversation(
        player,
        nora,
        id,
        available(original).find((a) => a.id === id)?.label ?? id,
        minutes,
        (report) => {
          refusal = report;
        },
        caseConversationPurpose(s, id),
      )
    ) {
      s.conversationPause = undefined;
      const who = refusal?.participant === 'player' ? player : nora;
      const activity = refusal?.activity;
      if (refusal && who && activity && Number.isFinite(activity.endsAt) && activity.endsAt > s.now)
        s.conversationPause = {
          participantId: who.id,
          actionId: id,
          activityId: activity.id,
          until: activity.endsAt,
          label: activity.label,
        };
      const reason =
        refusal?.participant === 'player'
          ? activity
            ? `You are still ${activity.label.toLowerCase()}.`
            : 'You leave the conversation for another time.'
          : refusal
            ? activity
              ? `Nora is still ${activity.label.toLowerCase()}.`
              : refusal.alternativeId === 'retain-case-fitting'
                ? 'Nora keeps the loose catch as a spare for now.'
                : refusal.alternativeId === 'retain-carrying-use'
                  ? 'Nora still wants a case she can carry.'
                  : 'Nora keeps her own plans for now.'
            : 'There is not enough shared time for this now.';
      say(
        s,
        'You',
        `${reason} The case and the invitation stay as they are.${s.conversationPause ? ' You can leave time for that to finish, then ask again.' : ''}`,
      );
      return s;
    }
    const until = s.now + minutes;
    advanceBenchBeforePlayer(s, until);
    tick(player, until);
    tick(nora, until);
    const completed = [player, nora].every(
      (person) =>
        person.body.alive &&
        !person.body.downed &&
        !person.body.asleep &&
        person.activity?.affordanceId === id &&
        person.activity.endsAt <= until,
    );
    for (const person of [player, nora]) {
      const activity = person.activity;
      if (activity?.affordanceId === id)
        finish(person, {
          affordanceId: id,
          action:
            completed && id.startsWith('neighbourhood-return-')
              ? (caseConversationPurpose(s, id)?.action ?? activity.action)
              : activity.action,
          at: until,
          status: completed ? 'completed' : 'interrupted',
          ...(completed && activity.affordance.advances
            ? { advances: activity.affordance.advances }
            : {}),
          summary: completed
            ? activity.affordance.label
            : 'The shared conversation stopped before its conclusion.',
        });
    }
    s.now = until;
    advancePeople(s);
    if (!completed) {
      say(
        s,
        'You',
        'The time together stopped before you finished. The recollection and the work have not been changed.',
      );
      return s;
    }
    const ownerPermission =
      id === 'neighbourhood-source'
        ? 'source'
        : id === 'neighbourhood-tray-consent'
          ? 'tray'
          : id === 'neighbourhood-frontage'
            ? 'frontage'
            : undefined;
    const result = applyNeighbourhoodAction(s, id, {
      ...neighbourhoodCtx,
      agree: (purpose) => purpose === ownerPermission,
    });
    receivedCasePurposes(s);
    if (!result) throw Error('Missing neighbourhood action');
    if (result.receiveCase) {
      const spec = neighbourhoodCase;
      const item = object(spec.id, spec.title, spec.owner, spec.story, spec.fault, spec.form);
      item.appearance = spec.appearance;
      item.inspectText = spec.inspectText;
      item.caseFittings = freshCaseFittings();
      item.requestedUse = 'carry-samples';
      s.objects.push(item);
      focusWorkbench(s, item);
    }
    const item = s.objects.find((o) => o.id === neighbourhoodCase.id);
    if (result.sourceFitting && item?.caseFittings)
      item.caseFittings.compatible = { ...result.sourceFitting, status: 'retained' };
    if (result.adaptTray && s.neighbourhood?.noraPurposeId)
      abandonGoal(nora, s.neighbourhood.noraPurposeId);
    if (result.adaptTray && item?.caseFittings) {
      item.observations.push(adaptCaseTray(item, item.caseFittings, true));
      item.requestedUse = 'stationary-tray';
    }
    if (result.returnCase && item?.caseFittings) {
      if (result.returnCase === 'unchanged') restoreCaseUnchanged(item, item.caseFittings);
      item.location = 'returned';
      item.collectedAt = s.now;
      if (s.focusId === item.id) s.focusId = null;
      if (result.returnCase === 'original-checked') s.repairs++;
    }
    if (result.job) {
      const spec = result.job;
      const lamp = object(
        spec.id,
        spec.title,
        spec.owner,
        spec.story,
        spec.fault,
        spec.form ?? 'lamp',
      );
      lamp.appearance = spec.appearance;
      lamp.inspectText = spec.inspectText;
      s.objects.push(lamp);
      focusWorkbench(s, lamp);
      if (spec.materialsBatteryProvided) s.parts.batteries++;
      s.workshop ??= freshWorkshop();
      const fee = s.serviceWeek?.route === 'regular' ? 500 : 0;
      const collectionAt = Math.floor(s.now / 1440) * 1440 + 1440 + 14 * 60;
      s.workshop.jobs.push({
        id: spec.id,
        stage: 'accepted',
        fee,
        materialCost: 0,
        acceptedAt: s.now,
        due: 'tomorrow',
        collectionAt,
        samFee: fee && s.workshop.paidHelp ? 300 : 0,
      });
      if (s.people.player) agreeCheckedCollection(s.people.player, spec.id, 'nora', collectionAt);
      if (s.world)
        s.world.presence.nora = {
          awayUntil: collectionAt,
          activity: 'Collecting the separately agreed sample-shelf light',
        };
      result.lines = [
        {
          speaker: 'Nora',
          tone: 'warm',
          text: fee
            ? 'Agreed: £5 for the checked light. I have supplied the battery, and I will come tomorrow at two. Tell me if you need longer.'
            : 'A small favour, then. I have supplied the battery, and I will come tomorrow at two. Tell me if it needs more work.',
        },
      ];
    }
    for (const line of result.lines) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  if (id === 'service-recover-donor') {
    const player = s.people.player,
      evan = s.people.evan;
    const minutes = 40;
    const donor = s.serviceWeek;
    // These purposes come from Evan's received offer and the player's selected exchange.
    // They provide ordinary HF goal evidence; competing commitments still decide consent.
    // Older published saves retain the actually heard measured exchange, but no goal pointer.
    // Resume that received purpose only on this selected action, never during restore or view.
    if (
      donor?.part === 'measured' &&
      donor.donorInvited &&
      evan &&
      isHere(s, 'evan') &&
      !donor.donorPurposeId
    )
      donor.donorPurposeId = adoptGoal(
        evan,
        {
          label: 'Keep my stand housing and marked screws together',
          serves: ['autonomy'],
          advancedBy: [{ action: 'sort-donor-parts', amount: 1 }],
          importance: 0.5,
        },
        s.now,
      ).id;
    if (donor?.part === 'measured' && player && !donor.donorPlayerPurposeId)
      donor.donorPlayerPurposeId = adoptGoal(
        player,
        {
          label: 'Sort the retained stand parts for the matching model gear',
          serves: ['competence'],
          advancedBy: [{ action: 'sort-donor-parts', amount: 1 }],
          importance: 0.5,
        },
        s.now,
      ).id;
    let refusal: ConversationRefusal | undefined;
    if (
      !player ||
      !evan ||
      !Array.from({ length: minutes + 1 }, (_, i) => s.now + i).every((at) =>
        isHere(s, 'evan', at),
      ) ||
      !beginSharedConversation(
        player,
        evan,
        id,
        'Sorting Evan’s retained stand parts together',
        minutes,
        (report) => {
          refusal = report;
        },
        {
          physical: true,
          action: 'sort-donor-parts',
          partnerGoals: donor?.donorPurposeId ? [donor.donorPurposeId] : [],
          playerGoals: donor?.donorPlayerPurposeId ? [donor.donorPlayerPurposeId] : [],
        },
      )
    ) {
      const who = refusal?.participant === 'player' ? player : evan;
      const activity = refusal?.activity;
      if (who && activity && activity.endsAt > s.now)
        s.conversationPause = {
          participantId: who.id,
          actionId: id,
          activityId: activity.id,
          until: activity.endsAt,
          label: activity.label,
        };
      say(
        s,
        'You',
        `${refusal?.participant === 'player' ? 'You' : 'Evan'} ${activity ? `${refusal?.participant === 'player' ? 'are' : 'is'} still ${activity.label.toLowerCase()}` : refusal?.participant === 'player' ? 'leave the shared work for another time' : 'leaves the shared work for another time'}. The measured gear remains with Evan; no part has changed hands.`,
        'notice',
      );
      return s;
    }
    s.conversationPause = undefined;
    const until = s.now + minutes;
    advanceBenchBeforePlayer(s, until);
    tick(player, until);
    tick(evan, until);
    const completed = [player, evan].every(
      (person) =>
        person.body.alive &&
        !person.body.downed &&
        !person.body.asleep &&
        person.activity?.affordanceId === id &&
        person.activity.endsAt <= until,
    );
    for (const person of [player, evan]) {
      const activity = person.activity;
      if (activity?.affordanceId === id)
        finish(person, {
          affordanceId: id,
          action: completed ? 'sort-donor-parts' : activity.action,
          at: until,
          status: completed ? 'completed' : 'interrupted',
          summary: completed
            ? activity.affordance.label
            : 'The donor sorting stopped before it was complete.',
        });
    }
    s.now = until;
    if (!completed) {
      advancePeople(s);
      say(
        s,
        'You',
        'The shared sorting stopped before completion. Evan keeps the measured gear and the remaining stand parts.',
        'notice',
      );
      return s;
    }
    const recovered = applyServiceWeekAction(s, id, serviceContext(s, true));
    if (!recovered?.recoveredPart)
      throw Error('Completed donor work has no agreed measured transfer');
    s.parts.gears = (s.parts.gears ?? 0) + recovered.recoveredPart.count;
    s.parts.gearTargets ??= [];
    s.parts.gearTargets.push('paper-street');
    const model = s.objects.find((item) => item.id === 'paper-street');
    model?.observations.push(
      'One compatible gear from Evan’s measured shop-display base is kept for this model. Its fitting and a real movement check remain.',
    );
    advancePeople(s);
    for (const line of recovered.lines) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  const serviceResult = applyServiceWeekAction(s, id, serviceContext(s, true));
  if (serviceResult) {
    if (id === 'service-decline-donor') {
      for (const [personId, goalId] of [
        ['evan', s.serviceWeek?.donorPurposeId],
        ['player', s.serviceWeek?.donorPlayerPurposeId],
      ] as const) {
        const person = s.people[personId];
        if (
          person &&
          goalId &&
          person.agenda?.goals.some((goal) => goal.id === goalId && goal.status === 'active')
        )
          abandonGoal(person, goalId);
      }
    }
    if (
      id === 'service-hear-donor' ||
      (id === 'service-invite-donor' && s.serviceWeek?.part === 'measured')
    ) {
      const donor = s.serviceWeek,
        evan = s.people.evan;
      if (donor && ['offered', 'measured'].includes(donor.part) && evan && !donor.donorPurposeId)
        donor.donorPurposeId = adoptGoal(
          evan,
          {
            label: 'Keep my stand housing and marked screws together',
            serves: ['autonomy'],
            advancedBy: [{ action: 'sort-donor-parts', amount: 1 }],
            importance: 0.5,
          },
          s.now,
        ).id;
    }
    if (id === 'service-measure-donor') {
      const model = s.objects.find((item) => item.id === 'paper-street');
      for (const line of serviceResult.lines)
        if (line.speaker === 'You') model?.observations.push(line.text);
    }
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
      // The service-week agreement explicitly discloses this duty; no private agenda query is knowledge.
      if (isHere(s, 'sam')) {
        s.unlocked.push(`heard-counter:${obligation.from}:${obligation.until}`);
        say(
          s,
          'Sam',
          'On that third working day I am at the parts counter from one until five. Ask about bench time when I am back; keep any unfinished work labelled.',
        );
      }
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
      focusWorkbench(s, item);
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
        focusWorkbench(s, item);
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
  if (id === 'wait-conversation-activity') {
    const cue = conversationWait(s);
    if (!cue) throw Error('That heard activity is no longer current');
    advanceBenchBeforePlayer(s, cue.until);
    if (s.people.player) liveOrdinaryTime(s.people.player, cue.until);
    s.now = cue.until;
    advancePeople(s);
    s.conversationPause = undefined;
    say(
      s,
      'You',
      'You leave time for that activity to finish. The conversation still needs a fresh agreement.',
    );
    return s;
  }
  if (id === 'wait-dad-activity' || id === 'wait-player-activity') {
    const current = id === 'wait-player-activity' ? playerSpaceWait(s) : dadSpaceWait(s);
    if (!current)
      throw Error(
        id === 'wait-player-activity'
          ? 'You are no longer doing that activity'
          : 'Dad is no longer doing that activity',
      );
    const until = current.endsAt;
    advanceBenchBeforePlayer(s, until);
    if (s.people.player) liveOrdinaryTime(s.people.player, until);
    s.now = until;
    advancePeople(s);
    say(
      s,
      'You',
      id === 'wait-player-activity'
        ? 'You finish what you were doing. The place on the bench still needs a shared agreement.'
        : 'You leave Dad time to finish what he was doing. The place on the bench is still a conversation to have.',
    );
    return s;
  }
  const workContext = workshopContext(s, true);
  const workshopResult = applyWorkshopAction(s, id, workContext);
  if (workshopResult) {
    if (id === 'workshop-intake-space' && s.workshop) {
      const ownerId = workContext.dadDeclinedBy?.() ?? 'dad';
      const current = s.people[ownerId]?.activity;
      s.workshop.spaceRefusalActivity =
        !s.workshop.intakeSpace && current
          ? { id: current.affordanceId, endsAt: current.endsAt, ownerId }
          : undefined;
    }
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
      focusWorkbench(s, item);
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
          targetId: shared.targetId,
          at: s.now,
          status: 'completed',
          summary: shared.affordance.label,
          needs: shared.affordance.advertises,
        });
    }
    advancePeople(s);
    if (workshopResult.cancelCabinetTime) cancelCabinetTime(s);
    if (workshopResult.cabinetTime && s.workshop && s.people.dad && s.people.player) {
      cancelCabinetTime(s);
      const { task, at, until } = workshopResult.cabinetTime;
      const definition = {
        kind: 'appointment' as const,
        actions: [`cabinet-${task}`],
        targetId: 'family-cabinet',
        from: at,
        until,
        importance: 0.6,
        label: `Cabinet ${task} together`,
      };
      const dad = promise(s.people.dad, { ...definition, toId: 'player' });
      const player = promise(s.people.player, { ...definition, toId: 'dad' });
      s.workshop.cabinetAppointment = {
        task,
        at,
        until,
        dadId: dad.id,
        playerId: player.id,
        status: 'planned',
      };
    } else if (shared?.action.startsWith('cabinet-')) {
      const appointment = s.workshop?.cabinetAppointment;
      if (appointment?.status === 'planned' && shared.action === `cabinet-${appointment.task}`) {
        if (
          s.people.dad?.agenda.commitments.find((c) => c.id === appointment.dadId)?.status ===
            'kept' &&
          s.people.player?.agenda.commitments.find((c) => c.id === appointment.playerId)?.status ===
            'kept'
        )
          appointment.status = 'kept';
        else {
          cancelCabinetTime(s);
          say(
            s,
            'You',
            'You completed this step at another time and remove its saved slot from the notebook.',
          );
        }
      }
    }
    if (id === 'workshop-sam-agreement' && s.workshop?.paidHelp) {
      const job = s.workshop.jobs.find(
        (job) => job.id === 'workshop-neighbourhood-nora-light' && job.stage === 'accepted',
      );
      if (job && job.fee > 0) job.samFee = 300;
    }
    for (const line of workshopResult.lines) say(s, line.speaker, line.text, line.tone);
    return s;
  }
  if (
    [
      'arrange-learning',
      'show-corrective-step',
      'explain-step',
      'supervised-repair',
      'delegate-repair',
      'watch-sam',
      'take-over-repair',
      'learning-light',
      'supervised-intake',
      'supervised-retry-intake',
      'postpone-supervised-retry',
      'reconsider-sam',
      'independent-intake',
      'exception-intake',
    ].includes(id)
  ) {
    if (
      [
        'learning-light',
        'supervised-intake',
        'supervised-retry-intake',
        'independent-intake',
        'exception-intake',
      ].includes(id)
    ) {
      const firstLesson = !s.objects.some((x) => x.id === 'lesson-battery');
      const itemId =
        id === 'learning-light'
          ? firstLesson
            ? 'lesson-battery'
            : 'lesson-contact'
          : id === 'supervised-retry-intake'
            ? 'supervised-retry-light'
            : id === 'supervised-intake'
              ? 'supervised-light'
              : id === 'independent-intake'
                ? 'independent-light'
                : 'exception-torch';
      const owner =
        id === 'independent-intake'
          ? 'Nora'
          : (id === 'learning-light' && !firstLesson) || id === 'supervised-retry-intake'
            ? 'Dad'
            : 'Sam';
      const title =
        id === 'learning-light'
          ? firstLesson
            ? 'Sam’s spare table lamp'
            : 'Dad’s small sorting lamp'
          : id === 'supervised-retry-intake'
            ? 'Dad’s labelled inspection light'
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
          : id === 'supervised-intake' || id === 'supervised-retry-intake'
            ? 'contact'
            : id === 'independent-intake'
              ? 'battery'
              : 'cap';
      const item = object(
        itemId,
        title,
        owner,
        id === 'supervised-retry-intake'
          ? 'Dad kept this distinct labelled light for looking into drawer runners. It still flickers when moved; he can lend it for one more supervised repair, with its own spare cell.'
          : firstLesson && id === 'learning-light'
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
      focusWorkbench(s, item);
      speak(
        owner,
        id === 'learning-light' && firstLesson
          ? 'This is my spare table lamp, different from the torch you fixed. I brought it for the afternoon we agreed: you can show me how you separate a tired battery from a bad contact. Here is a spare cell if the test calls for it.'
          : 'Here it is, and a spare cell if it actually needs one. Tell me what you find rather than changing it blindly.',
      );
      if (id !== 'learning-light')
        startApprenticeJob(
          s,
          item,
          id === 'supervised-intake' || id === 'supervised-retry-intake',
          speak,
        );
    }
    if (id === 'postpone-supervised-retry') {
      s.unlocked.push('supervised-retry-postponed');
      speak(
        'You',
        'You leave Dad’s labelled light for another day. The request stays separate from the lights already rescued; the rest of the bench remains yours to use.',
      );
    }
    if (id === 'reconsider-sam' && s.apprentice?.jobId) {
      const kept = s.objects.find((x) => x.id === s.apprentice?.jobId);
      if (kept) {
        kept.playerAssisted = true;
        kept.independent = false;
      }
      s.apprentice.supervised = true;
      s.apprentice.needsHelp = undefined;
      speak(
        'You',
        'Keep the same observation and try deciding again with me nearby. I am taking responsibility for this assisted practice; it will not count as an independent whole job.',
      );
    }
    if (id === 'show-corrective-step') prepareCorrectiveDemonstration(s, speak);
    if (id === 'arrange-learning') arrangeLearning(s, speak);
    if (id === 'explain-step') explainLesson(s, speak, isHere(s, 'sam'));
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
        focusWorkbench(s, item);
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
  const samSawStart = isHere(s, 'sam');
  const beforeCue = o ? cueFor(o, s.now) : undefined;
  const storyChoice = [
    ...optionalStoryChoices({
      focusId: s.focusId,
      focusOwner: o?.owner,
      chapter: s.chapter,
      unlocked: s.unlocked,
      holiday: s.campaign?.holiday,
      graduated: s.campaign?.graduated,
      cabinetStage: s.workshop?.cabinet,
    }),
  ].find((x) => x.id === id);
  if (storyChoice || id === 'resume-observer-invite') {
    if (storyChoice) s.unlocked.push(`story:${id}`);
    for (const line of storyChoice?.lines ?? [])
      if (!(id === 'observer-invite' && line.text.includes('dog')))
        say(s, line.speaker, line.text, line.tone);
    s.conversation = s.conversation.slice(-8);
    s.now += 6;
    const player = s.people.player;
    if (!player) throw Error('Missing player');
    advanceBenchBeforePlayer(s, s.now);
    tick(player, s.now);
    if (
      ['observer-invite', 'resume-observer-invite'].includes(id) &&
      s.world?.presence.sam &&
      s.people.sam
    ) {
      liveOrdinaryTime(s.people.sam, s.now, true);
      const stays = chooseSamVisit(s.people.sam);
      s.samPlans ??= { invitation: 'pending', heardAt: s.now };
      s.samPlans.invitation = stays === true ? 'accepted' : 'pending';
      s.samPlans.heardAt = s.now;
      s.samPlans.availableAfter =
        stays === false ? s.now + 50 : stays === null ? s.people.sam.activity?.endsAt : undefined;
      s.samPlans.availabilityReason =
        stays === false
          ? 'Sam said the dog walk would take about fifty minutes; ask again when he returns.'
          : stays === null
            ? 'Sam asked to finish what he was doing before talking about watching.'
            : undefined;
      if (stays === false) {
        s.world.presence.sam.awayUntil = s.now + 50;
        s.world.presence.sam.activity = 'Walking the dog — back later this afternoon';
      }
      say(
        s,
        'Sam',
        stays === null
          ? `Let me finish what I’m doing first${s.samPlans.availableAfter ? `, until about ${clockTime(s.samPlans.availableAfter)}` : ''}. We can talk about watching after that; I may still have other plans.`
          : stays
            ? 'I can stay a little while. Show me what you look for before taking it apart.'
            : 'Today I promised the dog a walk. I’ll be back in about fifty minutes; ask me about watching when I return.',
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
                ? o.owner === 'Sam'
                  ? `Thanks. ${o.title.replace(/^Sam[’']s /, 'My ')} can go back where I keep it, with the checked work on its label.`
                  : `Thanks. ${o.title} can go back where it belongs, with the checked work written on its label.`
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
  const appointmentWait = id === 'wait-appointment' || id.startsWith('wait-known-');
  const waitingFor = knownAppointments(s).find(
    (event, index) =>
      (index === 0 ? 'wait-appointment' : `wait-known-${event.personId}-${event.at}`) === id,
  );
  const duration =
    id === 'check-result' && o && (o.form === 'bell' || o.id === 'friend-1')
      ? o.id === 'friend-1'
        ? 6
        : 5
      : id === 'path-torch-test-cap'
        ? 4
        : appointmentWait
          ? Math.max(1, (waitingFor?.at ?? s.now + 30) - s.now)
          : id === 'next-day'
            ? nextWakingMorning(s.now) - s.now
            : ['rest', 'wait-person'].includes(id)
              ? 30
              : id === 'wait-check'
                ? checkWaitMinutes(o, s.now)
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
  let teaReport: TeaReport | undefined;
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
  if (id === 'next-day' || appointmentWait) {
    const until = s.now + duration;
    s.now = until;
    advancePeople(s);
    s.now -= duration;
    liveOrdinaryTime(p, until);
  } else if (id === 'rest' && isHere(s, 'mum'))
    sharedTea = shareTea(p, familyMember, s.now + duration, (report) => {
      teaReport = report;
    });
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
    case 'path-torch-test-cap':
      if (o) {
        const text = testPathTorchCap(o);
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
        const text =
          isMechanical(o) || o.id === 'friend-1'
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
          o.id === 'friend-1'
            ? 'The torch is ready for six minutes of changing grip, movement and switching with you present. Leaving it shining will not perform that test.'
            : isMechanical(o)
              ? o.form === 'bell'
                ? 'The bell is ready for a five-minute ringing and movement check with you present. Leaving it on the bench does not perform that test.'
                : 'The mechanism is running gently. One successful motion does not yet establish repeatable operation.'
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
        const result =
          o.id === 'friend-1'
            ? performPathTorchUseCheck(o, s.now - duration, s.now)
            : o.form === 'bell'
              ? performActiveBellCheck(o, s.now - duration, s.now)
              : readLongCheck(o, s.now);
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
      let outcome: { kind: string; activity?: string } = { kind: 'unavailable' };
      const helps = askMumToHelp(mum, (report) => {
        outcome = report;
      });
      const keptActivity = outcome.kind === 'kept-activity';
      const attendedTorch = o?.id === 'friend-1' && o.form === 'torch';
      const attendedBell = o?.form === 'bell';
      const mechanicalCheck = Boolean(o && isMechanical(o));
      const continuingCheck = attendedTorch
        ? 'You still need to change grip, move it and switch it repeatedly; leaving it shining does not perform that check.'
        : attendedBell
          ? 'You still need to ring it repeatedly and move it between tries; leaving it on the bench does not perform that check.'
          : mechanicalCheck
            ? 'Keep it running gently; you still need to repeat its movement before calling it checked.'
            : 'Leave it on; you can still watch it.';
      s.unlocked.push(`help:${o?.id}`);
      s.humanNote = helps
        ? attendedTorch
          ? 'Mum stays nearby while you change grip, move the torch and switch it repeatedly.'
          : attendedBell
            ? 'Mum stays nearby while you ring the bell repeatedly and move it between tries.'
            : mechanicalCheck
              ? 'Mum chooses a little more time together, holding the mechanism while you repeat its movement.'
              : 'Mum chooses a little more time together, holding the light while you check.'
        : keptActivity
          ? `Mum continues ${outcome.activity?.toLowerCase() ?? 'her current activity'}. The check can continue without her.`
          : outcome.kind === 'own-choice'
            ? 'Mum chooses her own chapter. The check can continue without her.'
            : 'Mum is not ready to help. The check can continue without her.';
      narrate(
        s,
        'Mum',
        helps
          ? attendedTorch
            ? 'All right. Change your grip and move and switch the torch; I’ll stay nearby.'
            : attendedBell
              ? 'All right. Ring it repeatedly and move it between tries; I’ll stay nearby.'
              : mechanicalCheck
                ? 'All right. You repeat its movement; I’ll keep it steady.'
                : 'All right. You move the switch; I’ll keep it steady.'
          : keptActivity
            ? `Let me finish what I am doing${outcome.activity ? ` — ${outcome.activity.toLowerCase()}` : ''}. ${continuingCheck}`
            : outcome.kind === 'own-choice'
              ? `Let me finish my chapter. ${continuingCheck}`
              : 'I cannot help just now. You can still watch it.',
      );
      break;
    }
    case 'early-return':
    case 'return':
      if (o && id === 'early-return') {
        o.returnedEarly = true;
        o.callbackSeen = false;
        say(
          s,
          'You',
          isMechanical(o)
            ? 'It moves now, but I have not completed the repeated-operation check. Tell me if it sticks.'
            : 'It lights now, but I have not given it the longer check. Tell me if it falters.',
          'notice',
        );
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
              ? 'Your old bedside lamp is still upstairs, if you’d like to look.'
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
      focusWorkbench(s, item);
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
      focusWorkbench(s, item);
      for (const line of spec.requestLines)
        if (isHere(s, line.speaker.toLowerCase())) say(s, line.speaker, line.text, line.tone);
      break;
    }
    case 'rest': {
      const shortened = teaReport?.kind === 'shortened' ? teaReport : undefined;
      s.humanNote = sharedTea
        ? 'You spent some time together over tea.'
        : shortened
          ? `You sat together for ${shortened?.elapsed} minutes before the afternoon drew you apart.`
          : 'You took a quiet break.';
      const familyMemory =
        s.workshop?.drawingChoice === 'displayed'
          ? ' Your old drawing is still out where we can see it.'
          : s.objects.some(
                (item) =>
                  item.owner === 'Mum' &&
                  item.form === 'lamp' &&
                  item.verified &&
                  item.location === 'returned' &&
                  !item.awaitingCollection,
              )
            ? ' I used the lamp you brought back.'
            : '';
      say(
        s,
        sharedTea ? 'Mum' : 'You',
        sharedTea
          ? `It’s nice having you here.${familyMemory}${teaCheckText}`
          : shortened
            ? `You sit together for ${shortened?.elapsed} minutes, then leave the cups while the afternoon takes its own course.`
            : teaReport?.participant === 'player'
              ? 'You leave the invitation for another time and take a quiet break.'
              : s.chapter === 'garage'
                ? 'You sit on the garage step for a quiet break. The invitation can wait for another time.'
                : 'You take a quiet break. The invitation can wait for another time.',
        sharedTea ? 'warm' : 'notice',
      );
      break;
    }
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
  if (o && beforeCue)
    recordLesson(s, o, id, beforeCue, !failed, duration, samSawStart && isHere(s, 'sam'));
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
function dayPlan(s: GameState, actions: ActionView[]): GameView['dayPlan'] {
  if (s.chapter !== 'garage') return undefined;
  const has = (id: string) => actions.some((a) => a.id === id);
  const entries: NonNullable<GameView['dayPlan']>['entries'] = knownAppointments(s).map(
    (event, index) => ({
      id: `known-${event.personId}-${event.at}`,
      label: `${event.name} · ${clockTime(event.at)}`,
      detail: event.detail,
      status:
        event.personId === 'sam' && s.samPlans?.availableAfter === event.at
          ? 'invitation'
          : /routine|usually|usual|chance to ask/.test(event.detail)
            ? 'routine'
            : 'agreed',
      actionIds: [
        index === 0 ? 'wait-appointment' : `wait-known-${event.personId}-${event.at}`,
      ].filter(has),
    }),
  );
  if (
    s.samPlans?.invitation === 'pending' &&
    !s.apprentice?.jobId &&
    !(s.apprentice?.arranged && s.now < s.apprentice.visitUntil) &&
    !entries.some((entry) => entry.status === 'invitation' && entry.id.startsWith('known-sam-'))
  )
    entries.push({
      id: 'sam-invitation',
      label: 'The invitation to Sam is still open',
      detail:
        (s.samPlans.availableAfter ?? 0) > s.now
          ? 'He asked to finish his current plans first. No lesson has been agreed.'
          : isHere(s, 'sam')
            ? 'He is reachable now; ask whether watching fits his plans.'
            : 'He asked to keep his own plans first. The invitation has not become an agreed lesson.',
      status: 'invitation',
      actionIds: has('resume-observer-invite') ? ['resume-observer-invite'] : [],
    });
  const conversationCue = conversationWait(s);
  if (conversationCue)
    entries.unshift({
      id: 'conversation-pause',
      label: `${conversationCue.participantId === 'player' ? 'Your activity' : s.people[conversationCue.participantId]?.name} · ${clockTime(conversationCue.until)}`,
      detail: `The conversation paused while ${conversationCue.participantId === 'player' ? 'you finish' : 'they finish'} ${conversationCue.label.toLowerCase()}. Ask again afterward; no conversation has been agreed.`,
      status: 'invitation',
      actionIds: ['wait-conversation-activity'],
    });
  const a = s.apprentice;
  const correction = pendingCorrectiveDemonstration(s);
  if (a?.arranged && (s.now < a.visitUntil || a.jobId || has('arrange-learning'))) {
    const item = s.objects.find((o) => o.id === a.jobId);
    const active = s.now < a.visitUntil;
    const checkRemaining =
      item?.checkStarted !== undefined && !item.verified
        ? Math.max(0, item.checkStarted + verificationMinutes(item) - s.now)
        : undefined;
    entries.push({
      id: 'sam-work',
      label: correction
        ? `Your demonstration for Sam: ${correction.title}`
        : item
          ? `Sam’s labelled work: ${item.title}`
          : 'The bench stretch with Sam',
      detail: [
        (correction
          ? correction.repaired
            ? 'The physical repair is done. Explain the observation and result Sam actually watched; offering to show him was only the start.'
            : 'You offered to show the missing contact step. Perform the repair yourself with Sam watching, then explain its result.'
          : undefined) ??
          a.needsHelp ??
          a.pauseReason ??
          (item
            ? 'You can leave this with him and work on something else.'
            : 'Choose whether to use the shared bench time.'),
        checkRemaining !== undefined
          ? checkRemaining > 0
            ? `The physical check has ${checkRemaining} minutes left; its result still needs reading.`
            : 'The physical run has elapsed; its result still needs reading.'
          : '',
        active
          ? `The agreed stretch ends at ${clockTime(a.visitUntil)}; his other commitments still matter.`
          : 'That agreed stretch has ended; the labelled work is kept.',
      ]
        .filter(Boolean)
        .join(' '),
      status: active ? 'underway' : has('arrange-learning') ? 'invitation' : 'late',
      actionIds: [
        ...(correction?.id === s.focusId && !correction.repaired ? ['clean-contact'] : []),
        ...(correction && a.lastLesson?.objectId === correction.id ? ['explain-step'] : []),
        'show-corrective-step',
        'arrange-learning',
        ...(has('show-corrective-step') ? [] : ['reconsider-sam']),
        'take-over-repair',
      ].filter(has),
    });
  }
  for (const item of s.objects.filter((o) => o.awaitingCollection))
    entries.push({
      id: `collection-${item.id}`,
      label: `${item.title} is ready for ${item.owner}`,
      detail:
        'Kept safely labelled. A known visit may concern other work; collection still requires the owner to be here.',
      status: 'agreed',
      actionIds: [],
    });
  const priority = (entry: (typeof entries)[number]) =>
    entry.actionIds?.includes('wait-conversation-activity')
      ? -5
      : entry.actionIds?.some((id) =>
            ['reconsider-sam', 'show-corrective-step', 'take-over-repair'].includes(id),
          )
        ? -4
        : entry.actionIds?.includes('resume-observer-invite')
          ? -3
          : entry.actionIds?.includes('arrange-learning')
            ? -2
            : entry.actionIds?.includes('wait-appointment')
              ? -1
              : 0;
  entries.sort((a, b) => priority(a) - priority(b));
  return entries.length
    ? { summary: 'What you have heard and agreed; people may keep their own plans.', entries }
    : undefined;
}
export function getView(s: GameState): GameView {
  const o = focused(s);
  const actions = available(s);
  const samJob = s.objects.find((item) => item.id === s.apprentice?.jobId);
  const receivedPause = conversationWait(s);
  const receivedSamPause = receivedPause?.participantId === 'sam' ? receivedPause : undefined;
  const firstFee = s.workshop?.ledger.find((entry) => entry.kind === 'repair-fee');
  const lastInput = s.inputs.at(-1);
  const graduatedNow =
    s.campaign?.graduated &&
    lastInput?.input.type === 'action' &&
    ['back-to-school', 'leave-school-holiday'].includes(lastInput.input.id);
  const firstPaymentNow = firstFee && lastInput && firstFee.at >= lastInput.at;
  const firstIndependentJob = s.objects.find(
    (item) => item.id === s.apprentice?.completedJobIds[0],
  );
  const independentHandoffNow =
    firstIndependentJob?.completedBy === 'sam' &&
    firstIndependentJob.independent &&
    firstIndependentJob.location === 'returned' &&
    !firstIndependentJob.awaitingCollection &&
    firstIndependentJob.collectedAt !== undefined &&
    lastInput &&
    firstIndependentJob.collectedAt > lastInput.at &&
    firstIndependentJob.collectedAt <= s.now;
  return {
    milestone: independentHandoffNow
      ? {
          sourcekey: `independent-handoff:${firstIndependentJob.id}`,
          title: 'Sam finished the whole repair',
          detail: `${firstIndependentJob.owner} has collected ${firstIndependentJob.title.toLowerCase()}, checked by Sam. You can take your own work to the other end of the bench; another job is still a choice to discuss together.`,
        }
      : graduatedNow
        ? {
            sourcekey: `graduation:${s.campaign?.holidayStartedAt ?? s.now}`,
            title: 'School is finished',
            detail:
              'Your exercise books are home for the last time. The family bench, unfinished things and people who taught you are still here. Dad can talk with you about a place for regular work; nothing has been agreed for you.',
          }
        : firstPaymentNow
          ? {
              sourcekey: `first-payment:${firstFee.id}`,
              title: `Your first repair fee · £${(firstFee.amount / 100).toFixed(2)}`,
              detail:
                'The checked repair has been collected and its agreed fee paid. The cashbook records the real payment and any materials separately. This money is yours to keep or put back into the bench.',
            }
          : undefined,
    dayPlan: dayPlan(s, actions),
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
            if (!visit) return undefined;
            const dayOffset = Math.floor(visit.at / 1440) - Math.floor(s.now / 1440);
            const when = `${dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : `in ${dayOffset} days`} at ${clockTime(visit.at)}`;
            return /routine|usually|usual|chance to ask/.test(visit.detail)
              ? `${item.title} is ready for ${item.owner}. Their usual availability is ${when}; this is not an arranged collection.`
              : `${item.title} is ready for ${item.owner}. Their next known return is ${when}; it may concern other work.`;
          })() ?? 'Kept safely labelled for collection. A little more time may help.',
      })),
    apprenticeship: s.apprentice
      ? {
          name: 'Sam',
          activity:
            s.apprentice.needsHelp ??
            s.apprentice.pauseReason ??
            (samJob?.verified && samJob.awaitingCollection
              ? `Checked and labelled for collection: ${samJob.title}`
              : s.apprentice.jobId
                ? `Working on ${samJob?.title ?? 'the agreed light'}`
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
            ? `School finished · age ${playerAge(s)}`
            : `Summer at home · ${playerAge(s)}`,
          detail:
            s.chapter !== 'garage'
              ? s.chapter === 'family'
                ? 'The school holiday begins at home. Mum is nearby with her reading lamp.'
                : s.chapter === 'later'
                  ? 'Your own lamp can wait safely. You can look at the garage bench whenever you are ready.'
                  : 'Start with the family lamp. Its observations and unfinished work will stay if you put it aside.'
              : s.campaign.graduated
                ? s.objects.some(
                    (item) =>
                      item.owner === 'Nora' && item.verified && item.location === 'returned',
                  ) && s.workshop?.referral !== 'permitted'
                  ? 'Nora knows your checked work; you can ask her about a referral when she is available. You can also keep the bench for your own projects or arrange learning with Sam.'
                  : 'Keep your own projects at the bench, or ask Sam about an afternoon together when he is available. Regular customer work still needs a separate agreement.'
                : s.objects.some((item) => item.awaitingCollection)
                  ? 'Arrange the waiting collection before closing the holiday. Optional projects can stay unfinished.'
                  : s.objects.some(
                        (item) => item.id.startsWith('friend-') && item.location !== 'returned',
                      )
                    ? 'Finish or honestly return the neighbour’s accepted object before closing this holiday.'
                    : s.objects.some(
                          (item) =>
                            item.checkStarted !== undefined &&
                            !item.verified &&
                            item.location !== 'returned',
                        )
                      ? 'Read or safely end the current check before closing the holiday. No repair quota is required.'
                      : 'You may close this holiday when you are ready. Optional repairs and personal projects can wait; school months are left unplayed.',
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
              ? `Expected: ${receivedPresenceActivity(presence.activity)}`
              : scheduledAway(s, id)
                ? id === 'sam'
                  ? s.unlocked.some((flag) => {
                      const duty = /^heard-counter:(\d+):(\d+)$/.exec(flag);
                      return duty && s.now >= Number(duty[1]) && s.now < Number(duty[2]);
                    })
                    ? 'At the parts counter for the shift he told you about; back after five'
                    : s.samPlans?.routineShiftKnown ||
                        s.unlocked.some((flag) => {
                          const request = /^known-request:(\d+)$/.exec(flag);
                          return request && catalogueRequest(Number(request[1]))?.ownerId === 'sam';
                        })
                      ? 'Keeping his usual counter morning; usually reachable after one'
                      : 'Not available just now'
                  : id === 'nora'
                    ? 'Keeping her quiet morning at home; reachable after ten'
                    : 'Out for hardware; back around six'
                : s.people[id]?.activity?.action === 'pray'
                  ? 'Taking quiet time; back in a few minutes'
                  : s.people[id]?.activity?.action === 'walk'
                    ? 'Walking the dog; back afterward'
                    : 'Not available just now'
          : ['mum', 'dad'].includes(id)
            ? s.people[id]?.activity
              ? s.people[id].activity.affordance.label
              : /cabinet|hinges/.test(presence.activity)
                ? 'Finished the cabinet step with you'
                : 'At home; between activities'
            : id === 'sam' && receivedSamPause
              ? `Finishing ${receivedSamPause.label.toLowerCase()} until ${clockTime(receivedSamPause.until)}${s.apprentice?.arranged && s.now < s.apprentice.visitUntil ? ' within the agreed afternoon' : ''}`
              : s.people[id]?.activity?.affordanceId === 'watch-repair'
                ? 'Watching beside the bench'
                : s.apprentice?.arranged && s.now < s.apprentice.visitUntil && id === 'sam'
                  ? 'At the bench for the agreed afternoon'
                  : 'At home',
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
          casePresentation: o.caseFittings
            ? {
                mode: o.caseFittings.revisedUse ?? 'carrying-case',
                catch: o.caseFittings.revisedUse
                  ? 'none'
                  : o.caseFittings.compatible?.status === 'fitted'
                    ? 'compatible'
                    : 'original',
                comparisonKnown: o.caseFittings.measured,
              }
            : undefined,
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
    actions,
    conversation: s.conversation,
    currentDialogue: (s.journal ?? s.conversation).filter(
      (line) => line.id >= (s.eventStartId ?? 0),
    ),
    journal: [
      ...(s.journal ?? []),
      ...s.conversation.filter((line) => !s.journal?.some((entry) => entry.id === line.id)),
    ].sort((a, b) => a.id - b.id),
    shelf: s.objects
      .filter(
        (x) =>
          x.discovered &&
          (x.location === 'shelf' ||
            (x.location === 'bench' && x.id !== s.focusId && x.assignedTo !== 'sam')),
      )
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
        ? o.id === 'friend-1' && o.form === 'torch'
          ? 'The torch still needs six minutes of changing grip, movement and switching with you present. Waiting or tea does not perform that check.'
          : o.form === 'bell'
            ? 'The bell still needs five minutes of repeated ringing and movement with you present. Waiting alone does not perform that check.'
            : s.now - o.checkStarted >= verificationMinutes(o)
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
    [
      'home-garage-2',
      'home-garage-3',
      'home-garage-4',
      'home-garage-5',
      'home-garage-6',
      'home-garage-7',
      'home-garage-8',
      'home-garage-9',
      'home-garage-10',
      'home-garage-11',
      'home-garage-12',
      'home-garage-13',
      'home-garage-14',
      'home-garage-15',
    ].includes(data?.engine)
  ) {
    if (data.engine === 'home-garage-15') {
      const validated = restoreEngine15(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-14') {
      const validated = restoreEngine14(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-13') {
      const validated = restoreEngine13(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-12') {
      const validated = restoreEngine12(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-11') {
      const validated = restoreEngine11(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-10') {
      const validated = restoreEngine10(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-9') {
      const validated = restoreEngine9(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-8') {
      const validated = restoreEngine8(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
    if (data.engine === 'home-garage-7') {
      const validated = restoreEngine7(text);
      return { ...validated, engine3Save: text, engine3InputCount: validated.inputs.length };
    }
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
