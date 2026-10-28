import { validatePortablePerson } from '@adam0white/human-framework';
import {
  canonicalCast,
  canonicalPersona,
  castForGame,
  type LifePreparation,
  lifeAdmission,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { admitOpeningPerson, exportPersonRun, type Person, projectPerson } from './hf.ts';

export const CAST = castForGame('repair');
export const CAST_IDS: Record<string, string> = {
  sam: 'hf.cast.sam.smallworks',
  nora: 'hf.cast.nora.smallworks',
  rafi: 'hf.cast.rafi.pass',
  halil: 'hf.cast.halil.voice',
};
export const castRole = (castId: string) =>
  Object.keys(CAST_IDS).find((id) => CAST_IDS[id] === castId);
const CAST_MAPPING = 'workshop-calendar/1';
export interface CastChapter {
  version: 'workshop-cast/1';
  inputs: LifePreparation[];
  claims: PersonaEnvelope[];
}
export function admissionFacts(chapter: CastChapter | undefined, id: string) {
  const input = chapter?.inputs.find((p) => p.parent.castId === CAST_IDS[id]);
  return input ? lifeAdmission(input, 'repair') : undefined;
}

const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
/** Existing shelf transport carries the host passport; HF owns retained projection and admission. */
export function admitWorkshop(input: LifePreparation, opening: Person): Person {
  const e = input.parent,
    role = castRole(e.castId),
    workshop = e.source.game === 'repair' && e.transfer.castPassport === 'workshop-hf4/1',
    commonstead =
      e.source.game === 'commonstead' &&
      e.source.rules === 'commonstead-4' &&
      e.transfer.castPassport === 'commonstead-retained/4';
  if (
    role !== opening.id ||
    e.castRevision !== canonicalCast(e.castId).revision ||
    e.terminal ||
    (!workshop && !commonstead) ||
    !['4.6.0', '4.7.0', '4.8.0'].includes(e.source.engine) ||
    e.transfer.sourceRole !== (commonstead ? e.castId : role) ||
    !same(preparePersonaLife(e, input.clockMs).life, input.life)
  )
    throw new Error(
      'This saved person belongs to an unsupported chapter. Keep or export it there; start fresh here.',
    );
  const person = validatePortablePerson(commonstead ? e.transfer.portable : e.transfer.person);
  if (
    person.version !== 2 ||
    person.castId !== e.castId ||
    person.castRevision !== e.castRevision ||
    person.source.game !== e.source.game ||
    person.source.engine !== e.source.engine ||
    person.source.personId !== (commonstead ? e.castId : role)
  )
    throw new Error('The saved person identity or source does not match.');
  const references: {
    kind: 'action' | 'entity' | 'source' | 'norm' | 'proposition';
    source: string;
    target: string;
  }[] = [];
  const seen = new Set<string>();
  const add = (kind: (typeof references)[number]['kind'], id: string | undefined) => {
    if (!id || id === 'self' || seen.has(`${kind}:${id}`)) return;
    seen.add(`${kind}:${id}`);
    references.push({
      kind,
      source: id,
      target:
        (kind === 'entity' || kind === 'source') && id === person.source.personId ? opening.id : id,
    });
  };
  for (const episode of [...person.retained.memory.episodes, ...person.retained.memory.gists]) {
    add('action', episode.action);
    add('source', episode.voiceId);
    for (const id of [episode.actorId, episode.targetId, episode.placeId]) add('entity', id);
  }
  for (const expectation of person.retained.memory.expectations) {
    const split = expectation.key.lastIndexOf('@');
    if (split < 0) add('action', expectation.key);
    else {
      add('action', expectation.key.slice(0, split));
      add('entity', expectation.key.slice(split + 1));
    }
  }
  for (const belief of person.retained.memory.beliefs) {
    add('proposition', belief.prop);
    for (const source of belief.sources) add('source', source.id);
    if (belief.provenance) {
      add('source', belief.provenance.origin);
      add('source', belief.provenance.firstFrom);
    }
  }
  for (const source of Object.keys(person.retained.memory.sourceTrust)) add('source', source);
  for (const c of person.retained.memory.contradictions) {
    add('source', c.sourceId);
    add('proposition', c.prop);
  }
  for (const c of person.retained.agenda.commitments) {
    for (const action of [...c.actions, ...(c.violatedBy ?? [])]) add('action', action);
    add('entity', c.toId);
    add('entity', c.targetId);
    add('norm', c.normId);
  }
  for (const c of person.retained.agenda.owed) {
    for (const action of [...c.actions, ...(c.violatedBy ?? [])]) add('action', action);
    add('norm', c.normId);
  }
  for (const norm of person.retained.heldNorms) add('norm', norm.normId);
  for (const norm of person.retained.calendar.norms) add('norm', norm.id);
  return admitOpeningPerson(opening, {
    person,
    mapping: { offsetMs: 540 * 60000 - person.retained.at, references },
  });
}
export async function workshopTransfer(person: Person) {
  const castId = CAST_IDS[person.id];
  if (!castId) throw new Error('This person has no shared role.');
  const portable = projectPerson(person, castId, canonicalCast(castId).revision);
  return {
    transfer: { castPassport: 'workshop-hf4/1', sourceRole: person.id, person: portable },
    raw: exportPersonRun(person),
    limitations: [
      'The supported person history, body and duties continue. Source objects, money, active work and runtime remain in the source archive.',
    ],
  };
}
export function validateCastChapter(chapter: CastChapter): void {
  if (
    chapter.version !== 'workshop-cast/1' ||
    !Array.isArray(chapter.inputs) ||
    chapter.inputs.length > 4 ||
    !Array.isArray(chapter.claims) ||
    chapter.claims.length !== chapter.inputs.length ||
    new Set(chapter.inputs.map((i) => i.parent.castId)).size !== chapter.inputs.length
  )
    throw new Error('The chapter has invalid cast records.');
  for (const input of chapter.inputs) {
    const claim = chapter.claims.find((c) => c.castId === input.parent.castId);
    if (
      !castRole(input.parent.castId) ||
      !claim ||
      claim.branchId !== input.parent.branchId ||
      claim.parentRevision !== input.parent.revision ||
      claim.source.game !== 'repair' ||
      claim.source.engine !== '4.8.0' ||
      claim.terminal ||
      !same(claim.transfer, { ...input.parent.transfer, life: input.life })
    )
      throw new Error('The saved cast source record is invalid.');
  }
}
