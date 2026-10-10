/**
 * Bounded consumer profiles and quiet daily opportunities. Norm definitions and
 * prayer windows come from released HF's sourced catalog (research/norm-sources.md,
 * research/prayer-times-sources.md and research/decisions.md); conviction and the
 * fictional timetable are authored character assumptions, not rulings. HF chooses
 * and records the activity. Nothing here computes acceptance, spiritual worth or
 * a productivity reward. School skips remain unplayed life, not missed worship.
 */
import {
  type Affordance,
  type Commitment,
  DEFAULT_NORMS,
  heldNorms,
  type Person,
  type PersonSpec,
  prayerWindows,
  promise,
  releaseCommitment,
} from '@adam0white/human-framework';

const practice: Record<string, number> = {
  mum: 0.85,
  dad: 0.55,
  nora: 0.35,
  sam: 0.2,
  player: 0.25,
};
export function humanProfile(id: string, now: number): Pick<PersonSpec, 'norms' | 'commitments'> {
  const conviction = practice[id] ?? 0.2;
  const catalog = DEFAULT_NORMS.filter((n) =>
    ['salah', 'lying', 'keep-promise', 'harm-others', 'kindness-to-parents', 'charity'].includes(
      n.id,
    ),
  );
  return {
    norms: heldNorms(
      {
        practice: conviction,
        extraNorms: [
          {
            normId: 'keep-promise',
            standing: 'obligatory',
            conviction: id === 'dad' ? 0.9 : id === 'sam' ? 0.62 : 0.8,
          },
          { normId: 'lying', standing: 'forbidden', conviction: id === 'nora' ? 0.95 : 0.85 },
        ],
      },
      catalog,
    ),
    commitments:
      id === 'mum' || id === 'dad'
        ? prayerWindows(Math.floor(now / 1440)).filter((c) => c.until > now)
        : [],
  };
}

/** Read-only offers: a current prayer window, or an ordinary reflective practice.
 * Bodies and competing needs remain in HF's decision, including inability to act. */
export function quietPracticeOffers(person: Person, atHome: boolean): Affordance[] {
  if (!atHome) return [];
  const window = person.agenda.commitments.find(
    (c) =>
      c.kind === 'worship' &&
      c.status === 'pending' &&
      c.actions.includes('pray') &&
      person.now >= c.from &&
      person.now < c.until,
  );
  const offers: Affordance[] = [];
  if (window)
    offers.push({
      id: 'quiet-prayer',
      action: 'pray',
      label: 'Taking a little quiet time for prayer',
      duration: 8,
      effort: 0.02,
      focus: 0.1,
      tags: ['worship'],
      norms: [{ normId: 'salah', relation: 'fulfills' }],
      fulfills: [window.id],
      advertises: {},
    });
  if (person.id === 'nora' || person.id === 'sam' || person.id === 'dad')
    offers.push({
      id: 'quiet-reflection',
      action: 'reflect',
      label:
        person.id === 'sam'
          ? 'Looking back over the afternoon’s notes'
          : person.id === 'dad'
            ? 'Thinking over a drawing before doing more'
            : 'Sitting quietly after the household work',
      duration: 30,
      effort: 0,
      focus: 0.05,
      tags: ['reflection', 'leisure'],
      advertises: { leisure: 0.06, autonomy: 0.04 },
    });
  return offers;
}

/** An explicit agreement, not a promise inferred from taking possession. A unique
 * object action lets the host attest actual checked handback through HF finish. */
export function agreeCheckedCollection(
  person: Person,
  objectId: string,
  ownerId: string,
  collectionAt: number,
): Commitment {
  const existing = person.agenda.commitments.find(
    (c) => c.label === `Checked collection: ${objectId}` && c.status === 'pending',
  );
  if (existing) return existing;
  return promise(person, {
    kind: 'promise',
    toId: ownerId,
    targetId: ownerId,
    actions: [`deliver:${objectId}`],
    from: person.now,
    until: collectionAt,
    importance: 0.8,
    normId: 'keep-promise',
    label: `Checked collection: ${objectId}`,
  });
}
export function renegotiateCollection(
  person: Person,
  objectId: string,
  ownerId: string,
  collectionAt: number,
): Commitment {
  for (const c of person.agenda.commitments)
    if (c.label === `Checked collection: ${objectId}` && c.status === 'pending')
      releaseCommitment(person, c.id);
  return agreeCheckedCollection(person, objectId, ownerId, collectionAt);
}
export function promisedRepairOffers(
  person: Person,
  itemId: string,
  ownerId: string,
): Affordance[] {
  const commitment = person.agenda.commitments.find(
    (c) => c.label === `Checked collection: ${itemId}` && c.status === 'pending',
  );
  return [
    {
      id: 'honest-update',
      action: 'explain-delay',
      label: 'Tell the owner what remains and ask for a later collection',
      duration: 4,
      effort: 0,
      focus: 0.05,
      targetId: ownerId,
      with: [ownerId],
      advertises: { belonging: 0.02 },
      norms: [{ normId: 'lying', relation: 'fulfills' }],
    },
    {
      id: 'overclaim-ready',
      action: 'claim-ready',
      label: 'Claim the unfinished repair is checked',
      duration: 4,
      effort: 0,
      focus: 0.05,
      targetId: ownerId,
      with: [ownerId],
      advertises: { autonomy: 0.12 },
      norms: [{ normId: 'lying', relation: 'violates' }],
      ...(commitment ? { fulfills: [] } : {}),
    },
  ];
}
