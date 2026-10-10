/**
 * An authored five-working-day trial, not a market or a model of ambition.
 * This module owns explicitly chosen collection promises and personal sessions;
 * the host owns physical work, HF people, actual time and acquired methods.
 * Cash is recorded only in the existing workshop ledger. A offered role never
 * grants competence, consent, a repaired object or an automatic deadline.
 */
import type { StoryLine } from './story';
import type { ActionView } from './types';
import {
  freshWorkshop,
  recordWorkshopEntry,
  type WorkshopJobSpec,
  type WorkshopState,
} from './workshop';

export interface ServiceWeekJob {
  id: string;
  stage: 'offered' | 'accepted' | 'declined' | 'returned' | 'returned-unchecked';
  collectionAt?: number;
  /** Explicitly agreed handover end; absent historical promises keep their original deadline. */
  collectionUntil?: number;
  requestedCollectionAt?: number;
  fee: number;
  samFee: number;
  delayed: boolean;
  independent?: boolean;
}
export interface ServiceWeekState {
  startedAt?: number;
  route: 'undecided' | 'regular' | 'favours' | 'private';
  jobs: ServiceWeekJob[];
  checkingPlace: 'shared' | 'second';
  personalSession: 'unplanned' | 'protected' | 'changed' | 'spent';
  personalAt?: number;
  personalMinutes?: number;
  part: 'unknown' | 'offered' | 'measured' | 'recovered' | 'declined';
  reflection: boolean;
  paidHelp: boolean;
  introductionsArranged: boolean;
  donorInvited: boolean;
  donorAt?: number;
  donorPurposeId?: string;
  donorPlayerPurposeId?: string;
  conclusion: 'open' | 'regular' | 'small';
}
export interface ServiceWeekGame {
  now: number;
  serviceWeek?: ServiceWeekState;
  workshop?: WorkshopState;
}
export interface ServiceWeekContext {
  independentHandoff: boolean;
  graduated: boolean;
  samHere: boolean;
  dadHere: boolean;
  ownerHere: (id: string) => boolean;
  samWillAgree?: () => boolean;
  uncheckedCollections?: string[];
  settleUnfinished?: (ownerId: string) => 'settle' | 'recheck' | null;
  paperStreetPresent?: boolean;
  paperStreetWaiting?: boolean;
  paperStreetRepaired?: boolean;
  paperStreetInstalled?: boolean;
  checkedHouseholdAndPersonal?: number;
  safeToPassQuietWeek?: boolean;
}
export interface ServiceWeekResult {
  lines: StoryLine[];
  minutes: number;
  job?: WorkshopJobSpec;
  personIds?: string[];
  visits?: { personId: string; at: number; activity: string }[];
  promise?: { ownerId: string; objectId: string; collectionAt: number };
  personalOpportunity?: { at: number; duration: number };
  recoveredPart?: { kind: 'gears'; count: 1; source: string };
  discoverPersonalProject?: true;
  checkingPlaces?: 2;
  obligation?: { personId: 'sam'; from: number; until: number; activity: string };
  nextDayAt?: number;
  recoverObjectId?: string;
  releaseCollectionId?: string;
}
const DAY = 1440;
const CHECKING_PRICE = 600;
export const SERVICE_HANDOVER_MINUTES = 15;
export function serviceCollectionDeadline(job: ServiceWeekJob): number {
  return job.collectionUntil ?? job.collectionAt ?? Infinity;
}
function handoverWords(s: ServiceWeekGame, start: number, end: number): string {
  return `${collectionWords(s, start)}–${Math.floor((end % DAY) / 60)}:${String(end % 60).padStart(2, '0')}`;
}
const line = (speaker: string, text: string, tone: StoryLine['tone'] = 'warm'): StoryLine => ({
  speaker,
  text,
  tone,
});
const result = (lines: StoryLine[], minutes = 5): ServiceWeekResult => ({ lines, minutes });
export function freshServiceWeek(): ServiceWeekState {
  return {
    route: 'undecided',
    jobs: [],
    checkingPlace: 'shared',
    personalSession: 'unplanned',
    part: 'unknown',
    reflection: false,
    paidHelp: false,
    introductionsArranged: false,
    donorInvited: false,
    conclusion: 'open',
  };
}
export const serviceWeekSpecs: readonly WorkshopJobSpec[] = [
  {
    id: 'service-leila',
    ownerId: 'leila',
    owner: 'Leila',
    title: 'Leila’s gate lamp',
    story:
      'A low battery lamp used to find the gate catch. Leila needs it before she brings the borrowed trolley back to the shared store.',
    fault: 'battery',
    appearance: 'reading',
    materialsBatteryProvided: true,
  },
  {
    id: 'service-nora',
    ownerId: 'nora',
    owner: 'Nora',
    title: 'Nora’s cutting-table lamp',
    story:
      'Nora has moved her sewing work to the wider table for one afternoon. This light flickers when she shifts the fabric beneath it.',
    fault: 'contact',
    appearance: 'kitchen',
    materialsBatteryProvided: true,
  },
];
function day(s: ServiceWeekGame): number {
  const start = s.serviceWeek?.startedAt;
  return start === undefined
    ? 0
    : Math.min(5, Math.max(1, Math.floor(s.now / DAY) - Math.floor(start / DAY) + 1));
}
function at(s: ServiceWeekGame, workingDay: number, hour: number): number {
  return (
    Math.floor((s.serviceWeek?.startedAt ?? s.now) / DAY) * DAY + (workingDay - 1) * DAY + hour * 60
  );
}
function collectionWords(s: ServiceWeekGame, time: number): string {
  const delta = Math.floor(time / DAY) - Math.floor(s.now / DAY);
  const when =
    delta === 0
      ? 'today'
      : delta === 1
        ? 'tomorrow'
        : `on working day ${Math.floor(time / DAY) - Math.floor((s.serviceWeek?.startedAt ?? s.now) / DAY) + 1}`;
  return `${when} at ${Math.floor((time % DAY) / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
}
function requestedCollection(s: ServiceWeekGame, owner: string): number {
  return owner === 'Leila' ? at(s, 2, 18) : at(s, 3, 14);
}
function isUnlocked(ctx: ServiceWeekContext) {
  return ctx.graduated;
}
/** Personal donor work uses the same finite part record before or after a
 * working week. Finding a contact card does not create customers or a business. */
function personalDonorActions(s: ServiceWeekGame, ctx: ServiceWeekContext): ActionView[] {
  const modelPresent =
    ctx.paperStreetPresent ?? Boolean(ctx.paperStreetWaiting || ctx.paperStreetRepaired);
  if (!modelPresent) return [];
  const w = s.serviceWeek ?? freshServiceWeek();
  const actions: ActionView[] = [];
  const add = (id: string, label: string, detail: string) =>
    actions.push({ id, label, detail, intent: 'stay' });
  if (!w.donorInvited && ['unknown', 'measured'].includes(w.part))
    add(
      'service-invite-donor',
      w.part === 'measured'
        ? 'Contact Evan again about the measured gear'
        : 'Contact Evan at the salvage counter about a display base',
      'The card in your model box lists display stands and clockwork bases. Ask about a possible part; no gear is promised.',
    );
  const donorPresent = w.donorInvited && s.now >= (w.donorAt ?? Infinity) && ctx.ownerHere('evan');
  if (w.part === 'unknown' && donorPresent && ctx.paperStreetWaiting)
    add(
      'service-hear-donor',
      'Ask Evan about his spare display base',
      'He brought an old demonstration stand with an accessible gear; compatibility is untested.',
    );
  if (w.part === 'offered' && donorPresent) {
    add(
      'service-measure-donor',
      'Compare the accessible gear with your model',
      'Twenty minutes: compare diameter, teeth and shaft opening. Leave the enclosed spring alone.',
    );
    add(
      'service-decline-donor',
      'Leave Evan’s base with him',
      'Nothing has been taken apart or promised.',
    );
  }
  if (w.part === 'measured' && donorPresent) {
    add(
      'service-recover-donor',
      'Help Evan sort the stand, then recover the matching gear',
      'Forty minutes together, if he agrees. He keeps the housing and the labelled parts he needs.',
    );
    add(
      'service-decline-donor',
      'Leave the matching gear with Evan',
      'You can keep the measurements for another time.',
    );
  }
  return actions;
}

/** A played holiday cannot carry an uncompleted visit across an unplayed year.
 * Measurements persist; renewed contact is required before any later transfer. */
export function cancelPersonalDonorForSchool(s: ServiceWeekGame): StoryLine[] {
  const w = s.serviceWeek;
  if (!w?.donorInvited || !['unknown', 'offered', 'measured'].includes(w.part)) return [];
  w.donorInvited = false;
  delete w.donorAt;
  if (w.part === 'offered') w.part = 'unknown';
  return [
    line(
      'You',
      'You cancel the unfinished donor visit before school resumes and leave Evan’s base with him. Your model and any measurements stay labelled; another summer will need a new invitation. No gear has changed hands.',
      'notice',
    ),
  ];
}

export function serviceWeekActions(s: ServiceWeekGame, ctx: ServiceWeekContext): ActionView[] {
  const personal = personalDonorActions(s, ctx);
  if (!isUnlocked(ctx)) return personal;
  const w = s.serviceWeek ?? freshServiceWeek();
  if (w.conclusion !== 'open') return personal;
  const actions: ActionView[] = [...personal];
  const add = (id: string, label: string, detail?: string) =>
    actions.push({ id, label, detail, intent: 'stay' });
  if (w.startedAt === undefined) {
    add(
      'service-begin',
      'Plan your first working week',
      'Set aside time to plan five ordinary days at the bench. Nothing accepted yet.',
    );
    return actions;
  }
  if (w.route === 'undecided') {
    add(
      'service-regular',
      'Try two regular collection afternoons',
      'A trial for this week; each job still needs a separate agreement.',
    );
    add(
      'service-favours',
      'Keep this week to occasional favours',
      'Choose each request; no advertised collection hours.',
    );
    add(
      'service-private',
      'Keep the shared bench private',
      'Personal work and family time are enough.',
    );
    return actions;
  }
  if (
    (w.route === 'regular' || w.jobs.some((job) => job.stage === 'accepted' && job.fee > 0)) &&
    !w.paidHelp &&
    ctx.samHere
  )
    add(
      'service-paid-help',
      'Offer Sam £2 per independent service-week repair',
      'A separate agreement for these two £5 jobs; he can decline. No pay or job is created by asking.',
    );
  add(
    'service-reconsider',
    'Reconsider the trial arrangement',
    'Existing accepted jobs keep their agreements; change what you offer next.',
  );
  if (
    w.route !== 'private' &&
    ctx.ownerHere('leila') &&
    !w.jobs.some((j) => j.id === 'service-leila') &&
    day(s) <= 2
  )
    add(
      'service-hear-leila',
      'Hear Leila’s gate-lamp request',
      s.now >= at(s, 2, 18)
        ? 'Her hoped-for trolley collection time has passed; a later arrangement is still possible.'
        : `Her trolley return is ${collectionWords(s, at(s, 2, 18))}; you have not promised it.`,
    );
  if (
    w.route !== 'private' &&
    ctx.ownerHere('nora') &&
    !w.jobs.some((j) => j.id === 'service-nora') &&
    s.now >= at(s, 3, 12) + 40 &&
    day(s) <= 3
  )
    add(
      'service-hear-nora',
      'Hear Nora’s cutting-table request',
      s.now >= at(s, 3, 14)
        ? 'Her hoped-for sewing time has passed; discuss another evening or decline.'
        : `Collection is ${collectionWords(s, at(s, 3, 14))}. Sam’s counter shift begins at 13:00.`,
    );
  for (const job of w.jobs) {
    const spec = serviceWeekSpecs.find((x) => x.id === job.id);
    if (!spec || !ctx.ownerHere(spec.ownerId)) continue;
    const key = job.id.slice(8);
    if (job.stage === 'offered') {
      if (s.now < (job.requestedCollectionAt ?? requestedCollection(s, spec.owner)))
        add(
          `service-accept-${key}`,
          `Agree ${spec.owner}’s collection time`,
          w.route === 'regular'
            ? '£5 work, owner supplies the battery. Sam’s paid work requires a separate agreement.'
            : 'An occasional favour; no fee and no unpaid work promised on Sam’s behalf.',
        );
      add(
        `service-later-${key}`,
        `Offer ${spec.owner} a later collection`,
        'Agree a later evening instead; the owner can make another arrangement meanwhile.',
      );
      add(
        `service-decline-${key}`,
        `Decline ${spec.owner}’s request`,
        'No repair or collection promise is made.',
      );
    }
    if (job.stage === 'accepted' && ctx.uncheckedCollections?.includes(job.id))
      add(
        `service-revisit-unfinished-${key}`,
        `Revisit ${spec.owner}’s unfinished collection`,
        ctx.ownerHere(spec.ownerId)
          ? 'Agree an honest no-fee settlement or bring the object back for checking. The old promise remains recorded.'
          : 'Arrange a visit to discuss the unchecked object; no fee or checked result is assumed.',
      );
    if (job.stage === 'accepted' && !job.delayed) {
      add(
        `service-delay-${key}`,
        `Renegotiate ${spec.owner}’s collection`,
        'Agree a later evening and keep the object safely labelled.',
      );
    }
  }
  const modelPresent =
    ctx.paperStreetPresent ?? Boolean(ctx.paperStreetWaiting || ctx.paperStreetRepaired);
  if (!modelPresent)
    add(
      'service-find-model',
      'Bring down the saved paper-street box',
      'Your paper roofs and shopfronts, stored in the small room. Look at what is still there.',
    );
  if (modelPresent && w.personalSession === 'unplanned' && s.now < at(s, 3, 14))
    add(
      'service-protect-session',
      'Keep day three’s afternoon for your own model',
      '14:00–14:45. Sam has parts-counter work; accepted repairs still need checking.',
    );
  if (w.personalSession === 'protected' || w.personalSession === 'changed') {
    if (s.now >= (w.personalAt ?? at(s, 3, 14)) && s.now < (w.personalAt ?? at(s, 3, 14)) + 45)
      add(
        'service-personal-session',
        s.now === (w.personalAt ?? at(s, 3, 14))
          ? 'Spend the saved forty-five minutes at your own bench'
          : 'Use the remaining model-session time',
        `There are ${(w.personalAt ?? at(s, 3, 14)) + 45 - s.now} minutes left in this saved slot; you can move the whole session instead.`,
      );
    add(
      'service-change-session',
      'Move the personal session to another afternoon',
      'Move it to day four at 15:00, or tomorrow at 15:00 if that slot has passed.',
    );
  }
  if (w.checkingPlace === 'shared' && ctx.dadHere && (s.workshop?.cash ?? 0) >= CHECKING_PRICE)
    add(
      'service-checking-place',
      'Buy a second safe checking tray for £6',
      'Separate stable surface and labels. Paid from the existing repair notebook; no profit bonus.',
    );
  if (day(s) >= 4 && w.part !== 'unknown' && !w.reflection)
    add(
      'service-reflect',
      'Read the old display label',
      'A better high street, printed before the shops changed their work.',
    );
  if (day(s) < 5)
    add(
      'service-next-day',
      'Finish this working day',
      'Continue tomorrow at 09:00. Accepted collection times still pass.',
    );
  if (
    day(s) < 5 &&
    w.route === 'private' &&
    ctx.safeToPassQuietWeek &&
    w.jobs.every((job) => job.stage !== 'accepted' && job.stage !== 'offered')
  )
    add(
      'service-quiet-week',
      'Keep the remaining week for your own bench',
      `Pass ${5 - day(s)} quiet ${5 - day(s) === 1 ? 'day' : 'days'} and return on the fifth morning. Nothing is repaired, paid or taught by this passage.`,
    );
  if (day(s) >= 5 && w.jobs.every((j) => j.stage !== 'accepted' && j.stage !== 'offered')) {
    add(
      'service-close-small',
      'Keep the work small after this week',
      'A private bench or occasional favours; this is a complete choice.',
    );
    if (w.route === 'regular')
      add(
        'service-close-regular',
        'Finish the trial with its agreements recorded',
        'This five-day trial closes here. Keep the notes and return to personal or household work.',
      );
  }
  return actions;
}
export function applyServiceWeekAction(
  s: ServiceWeekGame,
  id: string,
  ctx: ServiceWeekContext,
): ServiceWeekResult | null {
  if (!serviceWeekActions(s, ctx).some((a) => a.id === id)) return null;
  s.serviceWeek ??= freshServiceWeek();
  const w = s.serviceWeek;
  if (id === 'service-begin') {
    w.startedAt = s.now;
    return {
      ...result([
        line(
          'You',
          ctx.independentHandoff
            ? 'Sam has carried a job without you taking it back. You can share supported work, or keep the bench to yourself. What do you want this first working week to look like?'
            : 'School is finished. You can take responsibility for customer work yourself; Sam’s learning can continue alongside it. What do you want this first working week to look like?',
        ),
        line(
          'You',
          'You turn to a clean page: five working days, with enough blank space to change your mind.',
          'notice',
        ),
      ]),
      obligation: {
        personId: 'sam',
        from: at(s, 3, 13),
        until: at(s, 3, 17),
        activity: 'Parts-counter shift',
      },
    };
  }
  if (id === 'service-paid-help') {
    if (!ctx.samWillAgree?.())
      return result([
        line('Sam', 'I cannot agree to that work now. Keep the job with you; ask me another time.'),
      ]);
    w.paidHelp = true;
    return {
      ...result([
        line(
          'You',
          'For these service-week jobs: £2 for each whole independent repair, paid when the checked lamp is collected.',
        ),
        line(
          'Sam',
          'I agree to that rate for these jobs. Ask me before starting one; I still have my counter hours.',
        ),
      ]),
      personIds: ['sam'],
    };
  }
  if (id === 'service-reconsider') {
    w.route = 'undecided';
    return result([
      line(
        'You',
        'You leave accepted agreements on the page and reconsider what you want to offer after them.',
        'notice',
      ),
    ]);
  }
  if (['service-regular', 'service-favours', 'service-private'].includes(id)) {
    w.route =
      id === 'service-regular' ? 'regular' : id === 'service-favours' ? 'favours' : 'private';
    const visits: NonNullable<ServiceWeekResult['visits']> = [];
    if (w.route !== 'private' && !w.introductionsArranged) {
      w.introductionsArranged = true;
      visits.push(
        {
          personId: 'leila',
          at: Math.max(s.now + 30, at(s, 1, 15)),
          activity: 'Discussing a gate lamp',
        },
        {
          personId: 'nora',
          at: Math.max(s.now + 40, at(s, 3, 12) + 40),
          activity: 'Discussing her cutting-table light',
        },
      );
    }
    return {
      ...result([
        line(
          'You',
          w.route === 'regular'
            ? 'I would like to try two collection afternoons this week, with a price agreed before each job.'
            : w.route === 'favours'
              ? 'I would like to help occasionally, when it fits. Please ask each time.'
              : 'I want to keep this as our shared bench for now.',
        ),
        line(
          'You',
          'The rest of the garage is still in use. You choose a plan for one week; it does not have to decide your life.',
        ),
        ...visits.map((v) =>
          line(
            'You',
            `You invite ${v.personId === 'leila' ? 'Leila' : 'Nora'} to discuss a request ${collectionWords(s, v.at)}. Hearing it will not accept it.`,
            'notice',
          ),
        ),
      ]),
      visits,
    };
  }
  if (id.startsWith('service-revisit-unfinished-')) {
    const spec = serviceWeekSpecs.find((x) => id === `service-revisit-unfinished-${x.ownerId}`);
    const job = w.jobs.find((j) => j.id === spec?.id);
    if (!spec || !job || job.stage !== 'accepted' || !ctx.uncheckedCollections?.includes(job.id))
      return null;
    if (!ctx.ownerHere(spec.ownerId))
      return {
        ...result(
          [
            line(
              'You',
              `You arrange to speak with ${spec.owner} about the unchecked collection. Its notes and unpaid agreement remain in the book.`,
              'notice',
            ),
          ],
          2,
        ),
        visits: [
          {
            personId: spec.ownerId,
            at: s.now + 30,
            activity: 'Returning to discuss the unfinished check',
          },
        ],
      };
    const choice = ctx.settleUnfinished?.(spec.ownerId);
    if (!choice)
      return result(
        [
          line(
            spec.owner,
            'Another time for that conversation, please. Keep the unfinished check written down.',
          ),
        ],
        2,
      );
    if (choice === 'settle') {
      job.stage = 'returned-unchecked';
      job.independent = false;
      return {
        ...result(
          [
            line(
              spec.owner,
              'I will keep it as honestly unchecked, without a repair fee. Let us end the unfinished checking agreement here; your original label stays with it.',
            ),
            line(
              'You',
              'Unfinished collection settled by agreement. No checked result, fee or independent repair is recorded.',
              'notice',
            ),
          ],
          5,
        ),
        releaseCollectionId: job.id,
      };
    }
    return {
      ...result(
        [
          line(
            spec.owner,
            'I would rather have the longer check. Here it is again, with its old label; please finish that work.',
          ),
          line(
            'You',
            'Back on the bench at its actual unfinished step. The original promise and any missed date remain recorded.',
            'notice',
          ),
        ],
        5,
      ),
      recoverObjectId: job.id,
    };
  }
  if (id === 'service-find-model')
    return {
      ...result(
        [
          line(
            'You',
            'You bring down the flat box from the small room. Your old paper roofs are folded around the clearance display base Dad kept for you. The exposed drive position has no gear; the enclosed spring remains closed. A salvage-counter card tucked inside reads “Evan — display stands and clockwork bases”, with a number for asking about spare parts.',
            'notice',
          ),
        ],
        15,
      ),
      discoverPersonalProject: true,
    };
  if (id === 'service-invite-donor') {
    w.donorInvited = true;
    const visitAt =
      w.startedAt === undefined
        ? (Math.floor(s.now / DAY) + 1) * DAY + 15 * 60
        : Math.max(s.now + 60, at(s, 3, 16));
    w.donorAt = visitAt;
    return {
      ...result([
        line(
          'You',
          `You ask Evan to bring his spare display base ${collectionWords(s, visitAt)}, to compare its accessible gear with your model. No part has changed hands.`,
          'notice',
        ),
      ]),
      visits: [{ personId: 'evan', at: visitAt, activity: 'Bringing the invited display base' }],
    };
  }
  if (id === 'service-hear-leila' || id === 'service-hear-nora') {
    const spec = serviceWeekSpecs[id.endsWith('leila') ? 0 : 1];
    if (!spec) return null;
    w.jobs.push({
      id: spec.id,
      stage: 'offered',
      requestedCollectionAt: requestedCollection(s, spec.owner),
      fee: 0,
      samFee: 0,
      delayed: false,
    });
    return result([
      line(
        spec.owner,
        s.now >= requestedCollection(s, spec.owner)
          ? `I had hoped to use it ${collectionWords(s, requestedCollection(s, spec.owner))}, but that time has passed. Another evening can work; please say if you would rather leave it.`
          : spec.owner === 'Leila'
            ? `I return the borrowed trolley ${collectionWords(s, at(s, 2, 18))}. Could the lamp be ready before then? If not, I can borrow one for the gate.`
            : `I planned to cut the curtains ${collectionWords(s, at(s, 3, 14))}. Sam’s counter shift starts at one. I can use a borrowed light if you need longer; please say before we agree.`,
      ),
      line('You', 'Hearing the request has not accepted it.', 'notice'),
    ]);
  }
  const match = /^service-(accept|later|decline|delay)-(leila|nora)$/.exec(id);
  if (match) {
    const job = w.jobs.find((j) => j.id === `service-${match[2]}`);
    const spec = serviceWeekSpecs.find((x) => x.id === job?.id);
    if (!job || !spec) return null;
    if (match[1] === 'decline') {
      job.stage = 'declined';
      return result([
        line('You', 'I cannot promise this one. Please keep it with you.'),
        line(spec.owner, 'Thank you for telling me before I arranged the afternoon around it.'),
      ]);
    }
    const later = match[1] === 'later' || match[1] === 'delay';
    const collectionAt = later
      ? Math.max(at(s, 4, 18), Math.floor(s.now / DAY) * DAY + DAY + 18 * 60)
      : (job.requestedCollectionAt ?? requestedCollection(s, spec.owner));
    if (job.stage === 'offered') job.fee = w.route === 'regular' ? 500 : 0;
    job.stage = 'accepted';
    job.collectionAt = collectionAt;
    job.collectionUntil = collectionAt + SERVICE_HANDOVER_MINUTES;
    const handover = handoverWords(s, collectionAt, job.collectionUntil);
    job.delayed = later;
    // Optional paid work is offered to Sam separately by the runtime, never inferred here.
    return {
      ...result([
        line(
          'You',
          later
            ? `Could we arrange collection ${handover}? The checked handover will be finished within that window.`
            : `I can agree collection ${handover}. The checked handover will be finished within that window; I will tell you if it needs longer.`,
        ),
        line(
          spec.owner,
          later
            ? 'Yes. I can make another arrangement in the meantime.'
            : 'All right. I brought the compatible battery; keep it with the lamp.',
        ),
        line(
          'You',
          job.fee
            ? '£5 work agreed. No fee is received until actual checked collection.'
            : 'An occasional favour agreed, with no fee.',
          'notice',
        ),
      ]),
      job: match[1] === 'delay' ? undefined : spec,
      personIds: [spec.ownerId],
      promise: { ownerId: spec.ownerId, objectId: spec.id, collectionAt: job.collectionUntil },
      visits: [
        { personId: spec.ownerId, at: collectionAt, activity: 'Coming for the agreed collection' },
      ],
    };
  }
  if (id === 'service-protect-session') {
    w.personalSession = 'protected';
    w.personalAt = at(s, 3, 14);
    return {
      ...result([
        line(
          'You',
          'You leave 14:00 to 14:45 on day three clear for the paper-street model. An accepted collection at that time would still need a separate decision.',
          'notice',
        ),
      ]),
      personalOpportunity: { at: w.personalAt, duration: 45 },
    };
  }
  if (id === 'service-change-session') {
    w.personalSession = 'changed';
    w.personalAt = Math.max(at(s, 4, 15), Math.floor(s.now / DAY) * DAY + DAY + 15 * 60);
    return {
      ...result([
        line(
          'You',
          `You move the forty-five-minute model session to ${collectionWords(s, w.personalAt)} and keep the measurements beside the new slot.`,
          'notice',
        ),
      ]),
      personalOpportunity: { at: w.personalAt, duration: 45 },
    };
  }
  if (id === 'service-personal-session') {
    w.personalSession = 'spent';
    w.personalMinutes = (w.personalAt ?? at(s, 3, 14)) + 45 - s.now;
    return result(
      [
        line(
          'You',
          ctx.paperStreetRepaired
            ? 'You refold two paper windows and set the roofs back above the moving street. The repaired mechanism gives the old drawings their slow movement again.'
            : 'You sort the paper roofs and measure the exposed gear position. Two windows need fresh folds. The enclosed spring stays untouched; fitting and checking still belong to a separate repair.',
          'notice',
        ),
      ],
      w.personalMinutes,
    );
  }
  if (id === 'service-checking-place') {
    s.workshop ??= freshWorkshop();
    const workshop = s.workshop;
    if (workshop.cash < CHECKING_PRICE) return null;
    recordWorkshopEntry(workshop, {
      id: 'service:checking-place',
      at: s.now,
      amount: -CHECKING_PRICE,
      kind: 'checking-place',
      jobId: 'service-week',
    });
    w.checkingPlace = 'second';
    return {
      ...result(
        [
          line(
            'Dad',
            'A second tray gives each checked thing its own stable place. Leave a label with the test still running; the tray does not check it for us.',
          ),
          line(
            'You',
            '£6 paid from the repair notebook. The new checking surface is kept clear.',
            'notice',
          ),
        ],
        15,
      ),
      checkingPlaces: 2,
    };
  }
  if (id === 'service-hear-donor') {
    w.part = 'offered';
    return result([
      line(
        'Evan',
        'This stand turned sample packages in the new-goods shop. The outside is broken. I still want the spring housing and its marked screws; the loose gear might suit your model.',
      ),
      line('You', 'A possible donor, not yet a matching part.', 'notice'),
    ]);
  }
  if (id === 'service-measure-donor') {
    w.part = 'measured';
    return result(
      [
        line(
          'You',
          'The accessible gear matches your model’s measured diameter, tooth count and shaft opening. You write those measurements beside both objects. The enclosed spring housing stays closed.',
          'notice',
        ),
      ],
      20,
    );
  }
  if (id === 'service-recover-donor') {
    w.part = 'recovered';
    return {
      ...result(
        [
          line(
            'Evan',
            'Keep the matching gear for sorting this with me. These screws belong with the housing; I would rather they did not become another tin of unlabelled metal.',
          ),
          line(
            'You',
            'You recover one compatible gear. The model still needs fitting and a real check.',
            'notice',
          ),
        ],
        40,
      ),
      personIds: ['evan'],
      recoveredPart: { kind: 'gears', count: 1, source: 'Evan’s measured shop-display base' },
    };
  }
  if (id === 'service-decline-donor') {
    w.part = 'declined';
    return result([
      line(
        'You',
        'You leave the base with Evan. The model and its measurements can wait.',
        'notice',
      ),
    ]);
  }
  if (id === 'service-reflect') {
    w.reflection = true;
    return result(
      [
        line(
          'You',
          'The display label promises a better high street, with new goods delivered every morning. Evan has written parts to keep on its reverse. Neither side of the paper has been thrown away.',
          'notice',
        ),
      ],
      10,
    );
  }
  if (id === 'service-quiet-week')
    return {
      ...result(
        [
          line(
            'You',
            'The remaining days stay quiet: ordinary family time, your own work when you want it, and no new customer promises. On the fifth morning you can decide what follows. Your unfinished objects and actual earnings stay as you left them.',
            'notice',
          ),
        ],
        0,
      ),
      nextDayAt: Math.floor((w.startedAt ?? s.now) / DAY) * DAY + 4 * DAY + 9 * 60,
    };
  if (id === 'service-next-day')
    return {
      ...result(
        [
          line(
            'You',
            'You label the work that remains and leave the shared vice clear. Another ordinary morning follows; collection promises keep their dates.',
            'notice',
          ),
        ],
        0,
      ),
      nextDayAt: Math.floor(s.now / DAY) * DAY + DAY + 9 * 60,
    };
  if (id === 'service-close-small' || id === 'service-close-regular') {
    w.conclusion = id === 'service-close-small' ? 'small' : 'regular';
    return result(
      [
        line(
          'You',
          w.conclusion === 'small'
            ? 'The week has an end. You keep the bench for personal work and occasional requests you choose to accept. There is nothing to grow simply because there is room.'
            : 'The week has an end. This trial chapter ends here. You keep what you learned about collection afternoons in the notebook; the shared bench and your personal projects remain available.',
          'notice',
        ),
        line(
          'You',
          `${w.jobs
            .filter((j) => j.stage === 'returned')
            .map(
              (j) =>
                `${serviceWeekSpecs.find((spec) => spec.id === j.id)?.title ?? 'The lamp'} is back with its owner, checked.`,
            )
            .join(
              ' ',
            )} ${w.jobs.some((j) => j.stage === 'returned-unchecked') ? 'The lamps collected without a full check were settled honestly, without a repair fee.' : ''} ${w.jobs.some((j) => j.independent) ? 'Sam carried his agreed work through to collection while you had room for something else.' : ''} ${w.personalSession === 'spent' ? 'You kept the saved model session for your own work.' : w.personalSession === 'changed' ? 'The model session has a new place in the notebook.' : 'The personal work remains available when you choose it.'} ${w.checkingPlace === 'second' ? 'The second checking tray is ready beside the first.' : ''} ${(ctx.checkedHouseholdAndPersonal ?? 0) > 0 ? 'The earlier household and personal repairs still have their place in the notebook. ' : ''}${w.part === 'recovered' ? (ctx.paperStreetRepaired ? 'Evan’s measured donor gear is installed in the model, whose movement has been checked; its source stays in the notebook.' : ctx.paperStreetInstalled ? 'Evan’s measured donor gear is installed in the model; its movement still needs checking.' : 'Evan’s measured donor gear is kept with its source label.') : ''}`,
          'notice',
        ),
        line(
          'You',
          'The notebook keeps what you agreed, and what you decided to leave room for.',
          'notice',
        ),
      ],
      10,
    );
  }
  return null;
}
/** Host calls this only after an actual verified return; overdue promises remain visible until then. */
export function completeServiceWeekJob(
  s: ServiceWeekGame,
  id: string,
  outcome: { verified: boolean; independent: boolean; at: number; samFee?: number },
): StoryLine[] {
  const w = s.serviceWeek,
    job = w?.jobs.find((j) => j.id === id);
  if (!w || !job || job.stage !== 'accepted' || !outcome.verified) return [];
  s.workshop ??= freshWorkshop();
  const workshop = s.workshop;
  job.stage = 'returned';
  job.independent = outcome.independent;
  if (job.fee)
    recordWorkshopEntry(workshop, {
      id: `${id}:fee`,
      at: outcome.at,
      amount: job.fee,
      kind: 'repair-fee',
      jobId: id,
    });
  // Wage requires the host's actual agreed paid-help arrangement and whole-job provenance.
  const wage =
    outcome.independent && job.fee && w.paidHelp ? (outcome.samFee === 200 ? 200 : 0) : 0;
  if (wage) {
    job.samFee = wage;
    recordWorkshopEntry(workshop, {
      id: `${id}:sam`,
      at: outcome.at,
      amount: -wage,
      kind: 'sam-pay',
      jobId: id,
    });
  }
  return [
    line(
      serviceWeekSpecs.find((x) => x.id === id)?.owner ?? 'Owner',
      outcome.at > serviceCollectionDeadline(job)
        ? 'I can take the checked light now. Thank you for showing me what was checked.'
        : 'Thank you. I can use it now, and I know what was checked.',
    ),
    line(
      'You',
      job.fee
        ? `£5 received${wage ? ' and £2 agreed pay recorded for Sam’s independent work' : ''}.`
        : 'Returned as the agreed favour.',
      'notice',
    ),
  ];
}
export function getServiceWeekView(s: ServiceWeekGame) {
  const w = s.serviceWeek;
  if (!w || w.startedAt === undefined) return null;
  const origin = Math.floor(w.startedAt / DAY);
  const arrangements = w.jobs
    .filter((j) => j.stage === 'accepted')
    .map((j) => {
      const owner = serviceWeekSpecs.find((x) => x.id === j.id)?.owner ?? 'Owner';
      const relativeDay = Math.floor((j.collectionAt ?? s.now) / DAY) - origin + 1;
      const hour = Math.floor(((j.collectionAt ?? 0) % DAY) / 60);
      const end = j.collectionUntil;
      const window =
        end === undefined
          ? ''
          : `–${Math.floor((end % DAY) / 60)}:${String(end % 60).padStart(2, '0')}`;
      return `${owner}: collection day ${relativeDay}, ${hour}:00${window}${s.now > serviceCollectionDeadline(j) ? ' — the agreed time has passed' : ''}.`;
    });
  if (w.personalSession === 'protected' || w.personalSession === 'changed')
    arrangements.push(
      `Model session: ${collectionWords(s, w.personalAt ?? at(s, 3, 14))}, forty-five minutes kept clear.`,
    );
  if (w.checkingPlace === 'second')
    arrangements.push('Two stable labelled checking places, bought for £6.');
  return {
    label: `First service week · day ${day(s)} of five`,
    detail:
      w.route === 'regular'
        ? 'A trial of two collection afternoons; each repair needs its own agreement.'
        : w.route === 'favours'
          ? 'Occasional favours, chosen one at a time.'
          : w.route === 'private'
            ? 'A shared private bench for personal and family work.'
            : 'The next arrangement is still yours to choose.',
    arrangements,
    conclusion:
      w.conclusion === 'open'
        ? undefined
        : w.conclusion === 'small'
          ? 'This week is complete. The work stays small by choice.'
          : 'This trial week is complete. The shared bench and personal projects remain available.',
    day: day(s),
    route: w.route,
    checkingPlace: w.checkingPlace,
    personalSession: w.personalSession,
    part: w.part,
  };
}

/** A persistent account of completed work, never a grant of repairs or income. */
export function serviceWeekClosure(
  s: ServiceWeekGame,
  model?: { repaired: boolean; installed: boolean },
) {
  const w = s.serviceWeek;
  if (!w || w.conclusion === 'open' || w.startedAt === undefined) return undefined;
  const outcomes: string[] = [];
  const route =
    w.route === 'private'
      ? 'a private bench'
      : w.route === 'favours'
        ? 'occasional favours'
        : 'two regular collection afternoons';
  outcomes.push(
    `You tried ${route}. ${w.conclusion === 'small' ? 'You chose to keep the work small.' : 'You closed the regular-work trial.'}`,
  );
  for (const spec of serviceWeekSpecs) {
    const job = w.jobs.find((j) => j.id === spec.id);
    outcomes.push(
      !job
        ? w.introductionsArranged
          ? `${spec.owner}’s request was not heard during this trial; no job was accepted.`
          : `${spec.owner} was not invited to bring a service-week request.`
        : job.stage === 'declined'
          ? `${spec.owner}’s request was heard and declined before a promise was made.`
          : job.stage === 'returned-unchecked'
            ? `${spec.title} was settled honestly without a full check or repair fee.`
            : job.stage === 'returned'
              ? `${spec.title} was checked and collected${job.independent ? ', with the whole repair carried by Sam' : ''}.`
              : `${spec.title} still has an unresolved agreement.`,
    );
  }
  const ledger = s.workshop?.ledger ?? [];
  const fees = ledger
    .filter((e) => w.jobs.some((j) => j.id === e.jobId) && e.kind === 'repair-fee')
    .reduce((sum, e) => sum + e.amount, 0);
  const wages = ledger
    .filter((e) => w.jobs.some((j) => j.id === e.jobId) && e.kind === 'sam-pay')
    .reduce((sum, e) => sum - e.amount, 0);
  outcomes.push(
    `Trial repair fees received: £${(fees / 100).toFixed(2)}. Sam’s recorded pay: £${(wages / 100).toFixed(2)}. Workshop cash now: £${((s.workshop?.cash ?? 0) / 100).toFixed(2)}.`,
  );
  outcomes.push(
    w.personalSession === 'spent'
      ? 'You used the saved personal-work session.'
      : 'Personal work remains available; no session is claimed as completed.',
  );
  if (w.part === 'recovered')
    outcomes.push(
      model?.repaired
        ? 'The measured donor gear is installed and the model’s movement is checked.'
        : model?.installed
          ? 'The measured donor gear is installed; the model still needs checking.'
          : 'The measured donor gear remains labelled and available.',
    );
  return {
    sourcekey: `service-week:${w.startedAt}`,
    title: 'The first working week is complete',
    detail:
      'This chapter ends here. The shared bench, people, notes and personal work remain available.',
    outcomes,
  };
}
