import {
  type Affordance,
  begin,
  decide,
  finish,
  perceive,
  socialEvent,
} from '@adam0white/human-framework';
import { runUseTest } from './model';
import { choiceSpeech, finishActivity, realizedActivityNeeds } from './people';
import type { GameState, Job, PersonChoice, WorkOption } from './types';

export type CommunityFormat = 'garden' | 'reading' | 'theatre';
export interface CommunityDecision {
  personId: string;
  activityId?: string;
  activityLabel: string;
  speech: string;
  format?: CommunityFormat;
  startedAt?: number;
  endsAt?: number;
  completed: boolean;
}
export interface CommunityState {
  phase: 'announced' | 'setting-up' | 'completed';
  announcedAt: number;
  opensAt: number;
  deadline: number;
  finishesAt: number;
  invitedPersonIds: string[];
  preparedFormats: CommunityFormat[];
  reservedJobIds: string[];
  ownerConsentJobIds: string[];
  preparations: {
    format: CommunityFormat;
    jobId: string;
    startedAt: number;
    completedAt?: number;
  }[];
  decisions: CommunityDecision[];
  resolvedAt?: number;
  outcome: string;
}
export interface FormatView {
  format: CommunityFormat;
  label: string;
  description: string;
  ready: boolean;
  prepared: boolean;
  jobId?: string;
  jobTitle?: string;
  reason: string;
}
export const COMMUNITY_PREPARATION_MINUTES = 90;
const COMMUNITY_ACTIVITY_MINUTES = 30;
const definitions: Record<CommunityFormat, { label: string; description: string }> = {
  garden: {
    label: 'Garden gathering',
    description:
      'Carry the household’s checked lantern to light the garden table. Neighbours are invited; company is not guaranteed.',
  },
  reading: {
    label: 'Indoor reading',
    description:
      'Set up a checked fan to keep the reading room comfortable. Neighbours may join the reading.',
  },
  theatre: {
    label: 'Paper theatre',
    description:
      'Lend your working paper theatre for a short performance, then bring it home. Neighbours may join the audience.',
  },
};
export function createCommunityEvent(): CommunityState {
  return {
    phase: 'announced',
    announcedAt: 3420,
    opensAt: 5040,
    deadline: 5220,
    finishesAt: 5250,
    invitedPersonIds: ['mum', 'nora', 'sam', 'rafi', 'halil'],
    preparedFormats: [],
    reservedJobIds: [],
    ownerConsentJobIds: [],
    preparations: [],
    decisions: [],
    outcome: '',
  };
}
function eligible(job: Job, format: CommunityFormat, event: CommunityState): boolean {
  if (
    job.isDonor ||
    job.returnedUnfinished ||
    ['offer', 'declined', 'salvaged'].includes(job.status)
  )
    return false;
  if (format === 'garden')
    return (
      job.kind === 'lantern' && job.ownerId === 'mum' && ['ready', 'delivered'].includes(job.status)
    );
  if (format === 'reading')
    return (
      job.kind === 'fan' &&
      (job.ownerId === 'mum' || event.ownerConsentJobIds.includes(job.id)) &&
      ['ready', 'delivered'].includes(job.status)
    );
  return job.kind === 'music-box' && job.isPersonal === true && job.ownerId === 'player';
}
function checked(job: Job, format: CommunityFormat): boolean {
  const condition = format === 'garden' ? 'movement' : 'load';
  return job.verified.includes(condition) && runUseTest(job.model, condition).passes;
}
export function eventOptions(state: GameState, event: CommunityState): FormatView[] {
  return (Object.keys(definitions) as CommunityFormat[]).map((format) => {
    const jobs = state.jobs.filter((job) => eligible(job, format, event));
    // A requested gathering favour is the intended installation; unrelated paid repairs remain separate promises.
    if (format === 'reading')
      jobs.sort(
        (a, b) =>
          Number(b.importance === 'Neighbourhood gathering' && b.reward === 0) -
          Number(a.importance === 'Neighbourhood gathering' && a.reward === 0),
      );
    const job =
      jobs.find(
        (j) => checked(j, format) && !j.assignedTo && !state.npcWork.some((w) => w.jobId === j.id),
      ) ?? jobs[0];
    const prepared = event.preparedFormats.includes(format);
    const busy = job && (job.assignedTo || state.npcWork.some((w) => w.jobId === job.id));
    const ready = !!job && checked(job, format) && !busy;
    return {
      format,
      ...definitions[format],
      ready,
      prepared,
      jobId: job?.id,
      jobTitle: job?.title,
      reason: prepared
        ? 'This activity is prepared for the gathering.'
        : !job
          ? format === 'reading'
            ? 'This activity needs a returned, checked fan and its owner’s consent.'
            : format === 'garden'
              ? 'This activity needs the household’s checked lantern to remain available.'
              : 'This activity needs your paper theatre to remain available.'
          : busy
            ? 'This object is already in use.'
            : !ready
              ? `This activity needs a saved, successful ${format === 'garden' ? 'movement' : 'load'} check.`
              : 'The equipment is checked. Preparation takes 90 minutes.',
    };
  });
}
export function beginPreparation(
  state: GameState,
  event: CommunityState,
  format: CommunityFormat,
  now: number,
): { ok: boolean; message: string; cost: number; jobId?: string } {
  const reject = (message: string) => ({ ok: false, message, cost: 0 });
  if (event.resolvedAt !== undefined || event.phase === 'completed')
    return reject('The gathering has already started.');
  if (now < event.opensAt) return reject('The site opens on Day 4 at 12:00.');
  if (now + COMMUNITY_PREPARATION_MINUTES > event.deadline)
    return reject('There is not enough time before 15:00.');
  if (event.preparations.some((p) => p.completedAt === undefined))
    return reject('Finish the current preparation first.');
  if (event.preparations.some((p) => p.format === format))
    return reject('This gathering activity is already prepared.');
  const view = eventOptions(state, event).find((v) => v.format === format);
  if (!view?.ready || !view.jobId)
    return reject(view?.reason ?? 'This gathering activity is not available.');
  if (event.reservedJobIds.includes(view.jobId)) return reject('This object is already reserved.');
  event.reservedJobIds.push(view.jobId);
  event.preparations.push({ format, jobId: view.jobId, startedAt: now });
  event.phase = 'setting-up';
  return {
    ok: true,
    message: `You spend 90 minutes preparing the ${view.label.toLowerCase()}.`,
    cost: COMMUNITY_PREPARATION_MINUTES,
    jobId: view.jobId,
  };
}
export function completePreparation(
  event: CommunityState,
  format: CommunityFormat,
  jobId: string,
  now: number,
): void {
  const preparation = event.preparations.find((p) => p.format === format && p.jobId === jobId);
  if (
    !preparation ||
    preparation.completedAt !== undefined ||
    now < preparation.startedAt + COMMUNITY_PREPARATION_MINUTES ||
    now > event.deadline
  )
    return;
  preparation.completedAt = now;
  event.preparedFormats.push(format);
}
function gatheringOffers(state: GameState, event: CommunityState, personId: string): Affordance[] {
  const person = state.people[personId];
  if (!person) return [];
  const formats = event.preparedFormats.filter((format) => {
    const preparation = event.preparations.find((p) => p.format === format);
    const job = state.jobs.find((j) => j.id === preparation?.jobId);
    return (
      job &&
      eligible(job, format, event) &&
      checked(job, format) &&
      !job.assignedTo &&
      !state.npcWork.some((w) => w.jobId === job.id)
    );
  });
  const offers: Affordance[] = formats.map((format) => ({
    id: `community:${format}`,
    action: `community:${format}`,
    label: definitions[format].label,
    targetId: 'community-gathering',
    placeId: format === 'garden' ? 'garden' : 'reading-room',
    duration: COMMUNITY_ACTIVITY_MINUTES,
    effort: 0.02,
    advertises:
      format === 'garden'
        ? { belonging: 0.38, leisure: 0.18, rest: 0.08 }
        : format === 'reading'
          ? { leisure: 0.3, autonomy: 0.2, competence: 0.14, belonging: 0.3 }
          : { meaning: 0.12, leisure: 0.26, belonging: 0.35 },
    tags: format === 'garden' ? ['social', 'leisure', 'outdoors'] : ['social', 'leisure'],
    fulfills:
      format === 'garden' && personId === 'mum'
        ? person.agenda.commitments
            .filter(
              (c) =>
                c.status === 'pending' &&
                (c.kind === 'promise' || c.kind === 'appointment') &&
                c.targetId === 'nora' &&
                c.actions.includes('personal') &&
                event.invitedPersonIds.includes('nora') &&
                c.from <= person.now &&
                c.until >= person.now,
            )
            .map((c) => c.id)
        : [],
  }));
  const personal = person.agenda.commitments.filter(
    (c) =>
      c.status === 'pending' &&
      c.from <= person.now &&
      c.until >= person.now &&
      c.actions.includes('personal'),
  );
  offers.push(
    {
      id: 'personal',
      action: 'personal',
      // HF commitment windows bound when completion counts; they do not prescribe duration.
      label: personal[0]?.label
        ? `Spend 30 minutes on: ${personal[0].label}`
        : 'Spend 30 minutes on my own plans',
      duration: COMMUNITY_ACTIVITY_MINUTES,
      effort: 0.02,
      advertises: { leisure: 0.18, autonomy: 0.12 },
      tags: ['leisure'],
      fulfills: personal.map((c) => c.id),
    },
    {
      id: 'eat',
      action: 'eat',
      label: 'Have food and water',
      duration: COMMUNITY_ACTIVITY_MINUTES,
      effort: 0,
      advertises: { food: 0.7, water: 0.4 },
      tags: ['meal'],
    },
    {
      id: 'rest',
      action: 'rest',
      label: 'Take a break',
      duration: COMMUNITY_ACTIVITY_MINUTES,
      effort: 0,
      advertises: { rest: 0.7 },
      tags: ['rest'],
    },
    {
      id: 'postpone',
      action: 'postpone',
      label: 'Leave the gathering for another day',
      duration: COMMUNITY_ACTIVITY_MINUTES,
      effort: 0,
      advertises: { autonomy: 0.05 },
      tags: ['leisure'],
    },
  );
  return offers;
}
/** Caller ticks all people to `now` first. Start only; caller advances 30 minutes before finalizing. */
export function resolveCommunityEvent(state: GameState, event: CommunityState, now: number): void {
  if (now < event.deadline || event.resolvedAt !== undefined) return;
  event.resolvedAt = now;
  event.finishesAt = now + COMMUNITY_ACTIVITY_MINUTES;
  for (const personId of event.invitedPersonIds) {
    const person = state.people[personId];
    if (!person) continue;
    const reservedLessonStart =
      personId === 'sam' &&
      state.pendingRequest?.kind === 'lesson' &&
      state.pendingRequest.status === 'ready' &&
      (state.pendingRequest.readyUntil ?? 0) > now;
    const agreedLesson = personId === 'sam' && state.watching && (state.watchUntil ?? 0) > now;
    if (reservedLessonStart || agreedLesson) {
      event.decisions.push({
        personId,
        activityLabel: reservedLessonStart
          ? 'Time set aside to start the agreed lesson'
          : 'The agreed repair lesson',
        speech: reservedLessonStart
          ? 'I have set aside time to start a lesson. Start it before my availability ends.'
          : 'I have already agreed to watch the repair lesson.',
        completed: false,
      });
      continue;
    }
    if (
      person.now !== now ||
      person.activity ||
      state.npcWork.some((w) => w.personId === personId)
    ) {
      event.decisions.push({
        personId,
        activityLabel: person.activity?.affordance.label ?? 'Already committed to work',
        speech: 'I am already occupied.',
        completed: false,
      });
      continue;
    }
    const offers = gatheringOffers(state, event, personId);
    const record = decide(person, offers, { now });
    const offer = offers.find((a) => a.id === record.chosenAffordanceId);
    const considered = record.considered.find((c) => c.affordanceId === record.chosenAffordanceId);
    const choice: PersonChoice = {
      chosenId: offer?.id,
      narration: record.narration,
      reason: record.intention,
      terms: Object.fromEntries((considered?.terms ?? []).map((t) => [t.source, t.value])),
    };
    const activity = offer ? begin(person, offer, record) : null;
    event.decisions.push({
      personId,
      activityId: activity?.affordanceId,
      activityLabel: activity?.affordance.label ?? 'No activity selected',
      speech: choiceSpeech(person, choice),
      format: activity?.affordanceId.startsWith('community:')
        ? (activity.affordanceId.slice(10) as CommunityFormat)
        : undefined,
      startedAt: activity?.startedAt,
      endsAt: activity?.endsAt,
      completed: false,
    });
  }
  // Belonging advertisements describe possible company among invited neighbours, not guaranteed attendance.
  // Only actual selected participants enter the running activity's observed company.
  for (const decision of event.decisions) {
    if (!decision.format || !decision.activityId) continue;
    const activity = state.people[decision.personId]?.activity;
    if (activity?.affordanceId === decision.activityId) {
      activity.affordance.with = event.decisions
        .filter(
          (other) =>
            other.personId !== decision.personId &&
            other.format === decision.format &&
            other.activityId,
        )
        .map((other) => other.personId);
    }
  }
}
/** Finalize elapsed activities. Close reservations even if a missing tick prevents completion credit. */
function otherPlans(state: GameState, decisions: CommunityDecision[]): string {
  const activities: Record<string, string> = {
    'Take a break': 'chose to take a break',
    'Have food and water': 'chose to eat and drink',
    'Visit a neighbour': 'chose to visit a neighbour',
    'Spend 30 minutes on my own plans': 'chose to spend time on other plans',
    'Leave the gathering for another day': 'chose to leave the gathering for another day',
  };
  const groups = new Map<string, string[]>();
  for (const decision of decisions) {
    const name = state.people[decision.personId]?.name ?? decision.personId;
    const label = decision.activityLabel.replace(/^spend \d+ minutes on: /i, '');
    const activity = decision.format
      ? `did not finish ${decision.format === 'garden' ? 'the garden gathering' : decision.format === 'reading' ? 'the indoor reading' : 'watching the paper theatre'}`
      : (activities[label] ?? `chose “${label}” instead`);
    groups.set(activity, [...(groups.get(activity) ?? []), name]);
  }
  return [...groups]
    .map(([activity, names]) => {
      const who =
        names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
      return `${who} ${activity}.`;
    })
    .join(' ');
}

export function finalizeCommunityEvent(state: GameState, event: CommunityState, now: number): void {
  if (event.resolvedAt === undefined || now < event.finishesAt || event.phase === 'completed')
    return;
  // Freeze actual completed company before finishing anyone; finishing clears their activity.
  const elapsed = event.decisions.filter((decision) => {
    const person = state.people[decision.personId];
    const activity = person?.activity;
    return (
      person &&
      person.now === now &&
      person.now >= (decision.endsAt ?? Infinity) &&
      activity?.affordanceId === decision.activityId &&
      activity?.startedAt === decision.startedAt
    );
  });
  for (const decision of event.decisions) {
    const person = state.people[decision.personId];
    const activity = person?.activity;
    if (
      !person ||
      !decision.activityId ||
      activity?.affordanceId !== decision.activityId ||
      activity.startedAt !== decision.startedAt
    )
      continue;
    if (!elapsed.includes(decision)) {
      // Failure at the last observed person time cancels the activity without claiming elapsed work.
      finish(person, {
        affordanceId: activity.affordanceId,
        action: activity.action,
        targetId: activity.targetId,
        at: person.now,
        status: 'failed',
        needs: {},
        fulfills: [],
        summary: 'The gathering closed without an observed completed activity.',
      });
      continue;
    }
    if (decision.format) {
      const companions = elapsed.filter(
        (other) => other !== decision && other.format === decision.format,
      );
      const companionIds = companions.map((other) => other.personId);
      // Actual co-presence determines both realized belonging and whether an appointment was kept.
      activity.affordance.with = companionIds;
      const needs = {
        ...realizedActivityNeeds(activity.affordance.advertises),
        belonging:
          (activity.affordance.advertises.belonging ?? 0) * Math.min(1, companionIds.length / 3),
      };
      const fulfills = (activity.affordance.fulfills ?? []).filter((id) => {
        const commitment = person.agenda.commitments.find((c) => c.id === id);
        return commitment?.targetId && companionIds.includes(commitment.targetId);
      });
      finish(person, {
        affordanceId: activity.affordanceId,
        action: activity.action,
        targetId: activity.targetId,
        at: now,
        status: 'completed',
        needs,
        fulfills,
        summary: `${person.name} completed ${decision.activityLabel}${companions.length ? ` with ${companionIds.join(', ')}` : ' alone'}.`,
      });
      perceive(person, [
        {
          at: now,
          channel: 'outcome',
          kind: 'community-gathering',
          targetId: event.preparations.find((p) => p.format === decision.format)?.jobId,
          summary: `The prepared equipment enabled ${decision.activityLabel.toLowerCase()}${companions.length ? ' with other neighbours' : '; no other neighbour joined'}.`,
          salience: 0.9,
          valence: 0.5,
        },
      ]);
      // Help records preparing and lending equipment, not the player's attendance.
      socialEvent(person, {
        at: now,
        otherId: 'player',
        byMe: false,
        kind: 'help',
        magnitude: 0.35,
      });
    } else {
      const option: WorkOption = {
        id: activity.affordanceId,
        action: activity.action,
        label: activity.affordance.label,
        duration: activity.affordance.duration,
        effort: activity.effort,
      };
      finishActivity(person, option, true, now);
    }
    decision.completed = true;
  }
  const participants = event.decisions.filter((d) => d.completed && d.format);
  event.outcome = participants.length
    ? participants
        .map((d) => {
          const name = state.people[d.personId]?.name ?? d.personId;
          const activity =
            d.format === 'garden'
              ? 'joined the garden gathering'
              : d.format === 'reading'
                ? 'joined the indoor reading'
                : 'watched the paper theatre';
          return `${name} ${activity}.`;
        })
        .join(' ')
    : state.schema === 'small-works@5' && event.decisions.length
      ? `Nobody finished an activity you prepared. ${otherPlans(state, event.decisions)}`
      : 'No prepared activity was completed. People kept other plans, were occupied, or stopped before completion.';
  event.reservedJobIds = [];
  event.phase = 'completed';
}
