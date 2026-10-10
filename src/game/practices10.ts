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
  begin,
  type Commitment,
  DEFAULT_NORMS,
  decide,
  finish,
  heldNorms,
  onFinished,
  type Person,
  type PersonSpec,
  perceive,
  prayerWindows,
  promise,
  releaseCommitment,
  socialEvent,
  tick,
  understandNorm,
} from '@repair/hf-engine5';

const practice: Record<string, number> = {
  mum: 0.85,
  dad: 0.55,
  nora: 0.35,
  sam: 0.2,
  player: 0.25,
};
export function currentPrayerWindows(now: number) {
  const day = Math.floor(now / 1440);
  const next = prayerWindows(day + 1);
  return prayerWindows(day).map((c) =>
    c.until > now ? c : (next.find((n) => n.chain === c.chain) ?? c),
  );
}
/** Stop modeled worship windows while the host explicitly skips unplayed life.
 * Existing played debt stays in HF; no claim is made about offscreen practice. */
export function suspendUnplayedPractice(person: Person): boolean {
  const active = person.activity;
  if (active?.action === 'pray') {
    tick(person, active.endsAt);
    finish(person, {
      affordanceId: active.affordanceId,
      action: active.action,
      at: person.now,
      status: 'completed',
      summary: active.affordance.label,
    });
  }
  const windows = person.agenda.commitments.filter(
    (c) => c.kind === 'worship' && c.status === 'pending' && c.recurEvery !== undefined,
  );
  for (const c of windows) releaseCommitment(person, c.id);
  const closed = person.agenda.commitments.filter(
    (c) =>
      c.kind === 'worship' &&
      c.recurEvery !== undefined &&
      (c.status === 'kept' || c.status === 'broken'),
  );
  for (const c of closed) {
    if (
      person.agenda.commitments.some(
        (next) => next.kind === c.kind && next.chain === c.chain && next.from > c.from,
      )
    )
      continue;
    // A released successor ends recurrence through the public agenda API while
    // retaining the actual kept/broken predecessor and its played-day history.
    const interval = c.recurEvery ?? 1440;
    const terminal = promise(person, { ...c, from: c.from + interval, until: c.until + interval });
    releaseCommitment(person, terminal.id);
  }
  return windows.length > 0 || closed.length > 0;
}
export function resumePlayedPractice(person: Person): void {
  for (const c of currentPrayerWindows(person.now)) promise(person, c);
}
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
    commitments: id === 'mum' || id === 'dad' ? currentPrayerWindows(now) : [],
  };
}

/** Read-only offers: a current prayer window, or an ordinary reflective practice.
 * Bodies and competing needs remain in HF's decision, including inability to act. */
export function quietPracticeOffers(person: Person, atHome: boolean): Affordance[] {
  const ordinary = person.agenda.commitments
    .filter(
      (c) =>
        c.status === 'pending' &&
        person.now >= c.from &&
        person.now < c.until &&
        (c.actions.includes('walk') || c.actions.includes('parts-counter')),
    )
    .map(
      (c) =>
        ({
          id: c.actions.includes('walk') ? 'walk-dog' : 'parts-counter-duty',
          action: c.actions.includes('walk') ? 'walk' : 'parts-counter',
          label: c.actions.includes('walk')
            ? 'Walking the dog'
            : 'At the arranged parts-counter shift',
          duration: c.actions.includes('parts-counter') ? c.until - person.now : 30,
          effort: 0.05,
          focus: 0.05,
          advertises: { autonomy: 0.04 },
          fulfills: [c.id],
          tags: ['outdoors'],
        }) satisfies Affordance,
    );
  if (!atHome) return ordinary;
  const window = person.agenda.commitments.find(
    (c) =>
      c.kind === 'worship' &&
      c.status === 'pending' &&
      c.actions.includes('pray') &&
      person.now >= c.from &&
      person.now < c.until,
  );
  const offers: Affordance[] = [...ordinary];
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

export function attestCheckedCollection(
  person: Person,
  objectId: string,
  ownerId: string,
  at: number,
  owner?: Person,
): void {
  const result = onFinished(
    person,
    {
      affordanceId: `deliver:${objectId}`,
      action: `deliver:${objectId}`,
      targetId: ownerId,
      at,
      status: 'completed',
      summary: 'The checked object was actually collected by its owner.',
    },
    at,
  );
  for (const c of result.kept) {
    socialEvent(person, {
      at,
      kind: 'promise-kept',
      otherId: ownerId,
      byMe: true,
      magnitude: c.importance,
    });
    if (owner)
      perceive(owner, [
        {
          at,
          kind: 'promise-kept',
          actorId: person.id,
          targetId: ownerId,
          channel: 'saw',
          summary: 'The checked object was collected as agreed.',
          salience: c.importance,
          valence: c.importance,
        },
      ]);
  }
}

/** A versioned save migration adds only missing present-day understandings.
 * Existing convictions, bodily history and already recorded duties remain intact. */
export function initializeMissingProfile(person: Person, id: string): void {
  const profile = humanProfile(id, person.now);
  for (const n of profile.norms ?? [])
    if (!person.conscience.norms.some((held) => held.normId === n.normId))
      understandNorm(person, n.normId, n.standing, n.conviction);
  if (
    (id === 'mum' || id === 'dad') &&
    !person.agenda.commitments.some((c) => c.kind === 'worship')
  )
    for (const c of currentPrayerWindows(person.now)) promise(person, c);
  if (id === 'sam' && !person.agenda.commitments.some((c) => c.actions.includes('walk'))) {
    const day = Math.floor(person.now / 1440) + (person.now % 1440 >= 19 * 60 ? 1 : 0);
    promise(person, {
      kind: 'duty',
      toId: 'self',
      actions: ['walk'],
      from: Math.max(person.now, day * 1440 + 16 * 60),
      until: day * 1440 + 19 * 60,
      importance: 0.9,
      recurEvery: 1440,
    });
  }
}

export function chooseUnfinishedSettlement(
  owner: Person,
  playerId = 'player',
): 'settle' | 'recheck' | null {
  const offers: Affordance[] = [
    {
      id: 'settle-unchecked',
      action: 'agree',
      label: 'Keep the honestly unchecked light with no repair fee',
      duration: 0,
      effort: 0,
      with: [playerId],
      advertises: { autonomy: 0.12, safety: 0.04 },
      norms: [{ normId: 'lying', relation: 'fulfills' }],
    },
    {
      id: 'bring-back-for-check',
      action: 'agree',
      label: 'Bring it back for the promised longer check',
      duration: 0,
      effort: 0,
      with: [playerId],
      advertises: { safety: 0.08, competence: 0.02 },
      norms: [{ normId: 'lying', relation: 'fulfills' }],
    },
  ];
  const decision = decide(owner, offers);
  const chosen = offers.find((o) => o.id === decision.chosenAffordanceId);
  if (!chosen) return null;
  const prior = owner.activity;
  if (prior)
    finish(owner, {
      affordanceId: prior.affordanceId,
      action: prior.action,
      at: owner.now,
      status: 'interrupted',
      summary: 'Paused to discuss the unfinished collection agreement.',
    });
  if (!begin(owner, chosen, decision)) return null;
  finish(owner, {
    affordanceId: chosen.id,
    action: chosen.action,
    at: owner.now,
    status: 'completed',
    summary: chosen.label,
    needs: chosen.advertises,
  });
  return chosen.id === 'settle-unchecked' ? 'settle' : 'recheck';
}
export function releaseCheckedCollection(person: Person, objectId: string): void {
  for (const c of person.agenda.commitments)
    if (c.label === `Checked collection: ${objectId}` && c.status === 'pending')
      releaseCommitment(person, c.id);
}
