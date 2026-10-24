import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  isContinuingCommitment,
  type Person,
  projectCalendarPersona,
  restore,
  snapshot,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import {
  canonicalCast,
  canonicalPersona,
  castForGame,
  type LifePreparation,
  lifeAdmission,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';

export const CAST = castForGame('repair');
export const CAST_IDS: Record<string, string> = {
  sam: 'hf.cast.sam.smallworks',
  nora: 'hf.cast.nora.smallworks',
  rafi: 'hf.cast.rafi.pass',
  halil: 'hf.cast.halil.voice',
};
export const castRole = (castId: string) =>
  Object.keys(CAST_IDS).find((id) => CAST_IDS[id] === castId);
export const CAST_MAPPING = 'workshop-calendar/1';
export interface CastChapter {
  version: 'workshop-cast/1';
  inputs: LifePreparation[];
  claims: PersonaEnvelope[];
}
export function admissionFacts(chapter: CastChapter | undefined, id: string) {
  const input = chapter?.inputs.find((p) => p.parent.castId === CAST_IDS[id]);
  return input ? lifeAdmission(input, 'repair') : undefined;
}
const actions = new Set(['personal', 'rest', 'eat', 'drink', 'sleep']);
const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);

/** Explicit Voice Halil + same-host dialects. No clinical, family, duty or qualification bypass. */
export function admitWorkshop(input: LifePreparation, opening: Person): Person {
  const envelope = input.parent;
  const role = castRole(envelope.castId);
  if (
    role !== opening.id ||
    envelope.castRevision !== canonicalCast(envelope.castId).revision ||
    envelope.terminal
  )
    throw new Error('Unsupported cast edition, identity or closed chapter.');
  if (!same(preparePersonaLife(envelope, input.clockMs).life, input.life))
    throw new Error('Pinned life result differs from its source clock.');
  const site =
    envelope.source.game === 'voice' &&
    role === 'halil' &&
    envelope.transfer.castPassport === 'site-cast/1' &&
    envelope.transfer.sourceRole === 'halil';
  const local =
    envelope.source.game === 'repair' &&
    envelope.transfer.castPassport === 'workshop-cast/1' &&
    envelope.transfer.sourceRole === role;
  if (!site && !local)
    throw new Error(
      'This source needs an explicitly registered workshop adapter. Export it or play fresh locally.',
    );
  const portable = validateCalendarPersona(envelope.transfer.person);
  if (
    portable.person.mappingVersion !== (site ? 'site-cast-calendar/1' : CAST_MAPPING) ||
    portable.person.source.id !== role ||
    portable.person.source.engine !== '2.17.0'
  )
    throw new Error('Unsupported source mapping, role or engine.');
  const checkpoint = envelope.transfer.checkpoint as Record<string, unknown> | undefined;
  if (
    !checkpoint ||
    checkpoint.schema !== portable.person.source.schema ||
    checkpoint.sourceMinute !== portable.person.source.now ||
    !same(checkpoint.rng, portable.person.rng) ||
    typeof checkpoint.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(checkpoint.sha256)
  )
    throw new Error('Missing full-source checkpoint receipt.');
  for (const norm of portable.calendar.norms) {
    if (!DEFAULT_NORMS.some((known) => same(known, norm)))
      throw new Error('Unsupported source norm meaning.');
  }
  if (
    portable.calendar.commitments.some((c) =>
      [...c.actions, ...(c.violatedBy ?? [])].some((a) => !actions.has(a)),
    ) ||
    portable.calendar.owed.some((c) =>
      [...c.actions, ...(c.violatedBy ?? [])].some((a) => !actions.has(a)),
    )
  )
    throw new Error('A carried duty has no supported action in this workshop; keep it at source.');
  const target = restore(snapshot(opening));
  const shifted = structuredClone(portable);
  const offset = target.now - portable.person.source.now;
  shifted.calendar.offset = offset;
  for (const c of shifted.calendar.commitments) {
    c.from += offset;
    c.until += offset;
    if (c.recurUntil !== undefined) c.recurUntil += offset;
    if (c.exempt) c.exempt.at += offset;
  }
  for (const d of shifted.calendar.owed) {
    d.at += offset;
    if (d.lapseSince !== undefined) d.lapseSince += offset;
  }
  if (shifted.calendar.lapse) shifted.calendar.lapse.since += offset;
  const age = portable.person.source.now - portable.person.life.bornAt;
  if (age < canonicalCast(envelope.castId).age * 525600)
    throw new Error('Canonical age provenance differs.');
  target.life.bornAt = portable.person.life.bornAt + offset;
  target.body.fitness = portable.person.health.fitness;
  // Source skill names are archived, not converted into repair methods or qualifications.
  const omitted = Object.keys(shifted.person.skills);
  shifted.person.skills = {};
  if (omitted.length)
    shifted.person.limitations.push(
      `Source skills remain in source archive: ${omitted.join(', ')}`,
    );
  target.agenda.commitments = [];
  delete target.agenda.owed;
  delete target.agenda.lapse;
  return admitCalendarPersona(shifted, target, {
    mappingVersion: site ? 'site-cast-calendar/1' : CAST_MAPPING,
    sourceId: role!,
    targetId: role!,
    targetNorms: DEFAULT_NORMS,
  }).person;
}

/** Projection retains supported personal calendars; active work, illness and projects refuse through HF. */
export async function workshopTransfer(person: Person) {
  const retained = person.agenda.commitments.filter((c) =>
    isContinuingCommitment(person.agenda, c),
  );
  const owed = person.agenda.owed ?? [];
  const identity = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id]));
  const projection = projectCalendarPersona(person, {
    version: CAST_MAPPING,
    skills: identity(Object.keys(person.skills)),
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset: 0,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: identity([
          ...retained.flatMap((c) => [c.id, ...(c.makeUpOf ? [c.makeUpOf] : [])]),
          ...owed.flatMap((d) => [d.ofId, ...(d.scheduledAs ? [d.scheduledAs] : [])]),
        ]),
        chains: identity(retained.flatMap((c) => (c.chain ? [c.chain] : []))),
        actions: identity([
          ...retained.flatMap((c) => [...c.actions, ...(c.violatedBy ?? [])]),
          ...owed.flatMap((d) => [...d.actions, ...(d.violatedBy ?? [])]),
        ]),
        entities: identity(
          retained.flatMap((c) => [c.toId, c.targetId].filter((x): x is string => !!x)),
        ),
        norms: identity(DEFAULT_NORMS.map((n) => n.id)),
      },
    },
  });
  const raw = snapshot(person);
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(raw))),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  return {
    transfer: {
      castPassport: 'workshop-cast/1',
      sourceRole: person.id,
      person: projection,
      checkpoint: {
        schema: person.schema,
        sourceMinute: person.now,
        rng: person.rng,
        sha256: digest,
      },
    },
    raw,
    limitations: [
      ...projection.person.limitations,
      'Host objects, money, repair methods, customer promises and source-world medical/family context remain in the full source archive. No settlement, healing or new qualification is implied.',
    ],
  };
}

/** Structural provenance check, followed by HF semantic admission before startup/replay. */
export function validateCastChapter(chapter: CastChapter) {
  if (
    chapter.version !== 'workshop-cast/1' ||
    !Array.isArray(chapter.inputs) ||
    chapter.inputs.length > 4 ||
    !Array.isArray(chapter.claims) ||
    chapter.claims.length !== chapter.inputs.length ||
    new Set(chapter.inputs.map((i) => i.parent.castId)).size !== chapter.inputs.length
  )
    throw new Error('Invalid whole-cast chapter.');
  for (const input of chapter.inputs) {
    const claim = chapter.claims.find((c) => c.castId === input.parent.castId);
    if (
      !castRole(input.parent.castId) ||
      !claim ||
      claim.branchId !== input.parent.branchId ||
      claim.parentRevision !== input.parent.revision ||
      claim.source.game !== 'repair' ||
      claim.source.engine !== '2.17.0' ||
      claim.source.rules !== 'canonical-workshop-2' ||
      claim.terminal ||
      !same(claim.transfer, { ...input.parent.transfer, life: input.life })
    )
      throw new Error('Invalid pinned source claim.');
  }
}
