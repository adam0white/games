import { admissionFacts } from './cast.ts';
import { dispatch } from './engine.ts';
import { matchesJson } from './json-data.ts';
import { isInputRecording, isRecordedCommand, MAX_RECORDED_INPUTS } from './recording.ts';
import { replayRecordedRun } from './replay.ts';
import type { Command, Evidence, GameState, Job, PersonChoice } from './types.ts';

type Question = Extract<Command, { type: 'discuss-repair-method' }>;
type Work = Job['contributions'][number];
export interface MethodReport {
  known: boolean;
  work: Work[];
  workInputs: { index: number; command: Command }[];
  ownerTerms: { componentId: string; answeredAt: number; terms: string; response: string }[];
  evidence: Evidence[];
  status: Job['status'];
  deliveredAt?: number;
  returnedUnfinished?: boolean;
}
export interface MethodResponse {
  edition: 'repair-method-response@1';
  activation: { index: number; command: Question };
  recordingClosedAtInput?: 10000;
  /** One bounded execution proof, on the first receipt only, created by normal input-cap deletion. */
  recordingClosure?: { inputs: Command[]; command: Command };
  jobId: string;
  ownerId: string;
  componentId: string;
  askedAt: number;
  answeredAt: number;
  originalRequest: string;
  report: MethodReport;
  attended: boolean;
  decision: PersonChoice;
  response: string;
}
const physical = (w: Work) => /^(clean|adjust|replace|calibrate):/.test(w.action);
function inputAction(c: Command | undefined): string | undefined {
  return c?.type === 'work'
    ? `${c.intervention}:${c.componentId}`
    : c?.type === 'calibrate'
      ? `calibrate:${c.componentId}:${c.setting}`
      : undefined;
}
/** Finite response to retained performed work only. Never reconstruct a method from a hidden fault,
 * current good condition, successful test or personal account. No new action means no new state/rules.
 */
export function methodReport(
  s: GameState,
  jobId: string,
  _componentId: string,
): MethodReport | undefined {
  const j = s.jobs.find((j) => j.id === jobId);
  if (!j) return;
  const work = structuredClone(j.contributions.filter(physical));
  const evidence = structuredClone(j.evidence);
  const workInputs = (s.inputs ?? []).flatMap((command, index) =>
    'jobId' in command && command.jobId === j.id && inputAction(command)
      ? [{ index, command: structuredClone(command) }]
      : [],
  );
  const playerWork = work.filter((w) => w.actorId === 'player');
  const ownerTerms = (s.ownerExchanges ?? [])
    .filter((r) => r.jobId === j.id)
    .map((r) => ({
      componentId: r.componentId,
      answeredAt: r.answeredAt,
      terms: r.terms,
      response: r.response,
    }));
  const known =
    Boolean(s.inputs) &&
    work.length > 0 &&
    playerWork.length === workInputs.length &&
    playerWork.every((w, i) => inputAction(workInputs[i]?.command) === w.action) &&
    work.every((w) =>
      evidence.some(
        (e) =>
          e.kind === 'work' &&
          e.componentId === w.action.split(':')[1] &&
          e.at === w.at &&
          e.actorId === w.actorId,
      ),
    );
  return {
    known,
    work,
    workInputs,
    ownerTerms,
    evidence,
    status: j.status,
    ...(j.deliveredAt !== undefined ? { deliveredAt: j.deliveredAt } : {}),
    ...(j.returnedUnfinished !== undefined ? { returnedUnfinished: j.returnedUnfinished } : {}),
  };
}
export function methodQuestion(s: GameState, jobId: string, componentId: string): Question {
  return {
    type: 'discuss-repair-method',
    jobId,
    ownerId: s.jobs.find((j) => j.id === jobId)?.ownerId ?? '',
    componentId,
    reportText: JSON.stringify(methodReport(s, jobId, componentId)),
  };
}
export function methodBlock(s: GameState, q: Question): string | undefined {
  const j = s.jobs.find((j) => j.id === q.jobId),
    p = s.people[q.ownerId];
  if (s.schema !== 'small-works@5' || !s.inputs || s.inputs.length >= MAX_RECORDED_INPUTS)
    return 'The old method is unknown without its recording. This exchange needs room for a recorded action.';
  if (
    !j ||
    !p ||
    j.ownerId !== q.ownerId ||
    s.selectedJobId !== j.id ||
    j.isDonor ||
    j.isPersonal ||
    !['active', 'ready', 'delivered'].includes(j.status) ||
    j.assignedTo ||
    !j.model.components.some((c) => c.id === q.componentId)
  )
    return 'Select this owner’s actual object and part.';
  const r = methodReport(s, j.id, q.componentId);
  if (
    !r ||
    !matchesJson(q.reportText, r) ||
    q.reportText.length > 100_000 ||
    !r.work.some((w) => w.action.split(':')[1] === q.componentId) ||
    !r.evidence.some(
      (e) => e.kind === 'use' && e.id > (r.evidence.findLast((e) => e.kind === 'work')?.id ?? 0),
    )
  )
    return 'Show actual performed work on this part and a later use test. Missing methods remain unknown.';
  const latest = r.evidence.at(-1)?.at;
  if (
    latest === undefined ||
    latest > s.now ||
    s.now - latest > 1440 ||
    Math.floor(latest / 1440) !== Math.floor(s.now / 1440)
  )
    return 'That visit has ended. The recorded work remains in your notes.';
  if (s.methodResponses?.some((r) => r.jobId === j.id) || (s.methodResponses?.length ?? 0) >= 100)
    return 'This object already has a method response, or this chapter has no response space left.';
  const carried = admissionFacts(s.castChapter, q.ownerId),
    work = s.npcWork.find((w) => w.personId === p.id);
  if (
    s.chapterPaused ||
    s.ended ||
    (p.id === 'halil' && s.day < 3) ||
    (carried &&
      (!carried.availableForExtraWork ||
        (carried.life.place !== 'local-workplace' && s.now % 1440 < 600))) ||
    (p.activity && (p.activity.action !== 'personal' || !work || work.jobId)) ||
    (p.id === 'sam' && (s.watching || s.pendingRequest)) ||
    p.agenda.commitments.some(
      (c) => c.status === 'pending' && c.from < s.now + 5 && c.until > s.now,
    )
  )
    return 'The owner is unavailable. Their current work or agreed plans come first.';
  if ((s.now % 1440) + 5 > 1020) return 'There is not enough time for a five-minute exchange.';
}
export function methodAccount(r: MethodReport): string {
  if (!r.known)
    return 'The complete repair method is unknown. These are the retained work and test records only.';
  const replaced = r.work
    .filter((w) => w.action.startsWith('replace:'))
    .map((w) => w.action.split(':')[1]);
  const verbs: Record<string, string> = {
    clean: 'cleaned',
    adjust: 'adjusted',
    replace: 'replaced',
    calibrate: 'set',
  };
  const actions = r.work
    .map((w) => {
      const [verb, part, setting] = w.action.split(':');
      return `${w.actorId === 'player' ? 'You' : w.actorId} ${verbs[verb ?? ''] ?? 'worked on'} the ${part}${setting ? ` to ${setting}` : ''} at minute ${w.at}`;
    })
    .join('; ');
  return `${replaced.length ? `You replaced the ${[...new Set(replaced)].join(', ')}.` : 'You kept the original parts.'} Recorded work: ${actions}.`;
}
export function methodResponse(
  r: Pick<MethodResponse, 'report' | 'originalRequest' | 'attended'>,
): string {
  if (!r.attended)
    return 'I am keeping my plans. I have not discussed this repair method with you.';
  const tests = r.report.evidence
    .filter((e) => e.kind === 'use')
    .map((e) => `[${e.id}] ${e.summary}`)
    .join(' ');
  const replacements = r.report.work.filter((w) => w.action.startsWith('replace:'));
  const limited = r.report.ownerTerms.filter(
    (t) =>
      t.terms === 'one-part' &&
      replacements.some((w) => w.action === `replace:${t.componentId}` && w.at > t.answeredAt),
  );
  const reaction = !r.report.known
    ? 'I cannot tell which parts were kept from this incomplete record.'
    : replacements.length
      ? limited.length
        ? 'I can see the replacement we discussed. My agreement covered only that named part.'
        : 'I can see that parts were replaced. A working test does not bring the original parts back.'
      : 'I notice you worked with the parts I brought. That matters to the history of this object.';
  return `${reaction} I hear how you worked on this object. ${methodAccount(r.report)} ${r.report.ownerTerms.map((t) => `Earlier part response: ${t.response}`).join(' ')} My original request was: “${r.originalRequest}” Test record: ${tests} ${r.report.status === 'delivered' ? (r.report.returnedUnfinished ? 'The object was returned unfinished.' : 'The object has already been returned.') : 'The object has not been returned.'} Hearing this is not permission, acceptance of the repair or personal forgiveness.`;
}
/** Admission re-executes the recorded historical exchange. Two editable report copies are not
 * evidence. Only the first receipt retains the bounded history when normal recording closes;
 * later physical work, returns and evidence rollover never redefine that historical exchange.
 */
export function validMethodResponses(s: GameState): boolean {
  const hasMethodInput = s.inputs?.some((c) => c.type === 'discuss-repair-method');
  if (s.methodResponses === undefined) return !hasMethodInput;
  if (
    !Array.isArray(s.methodResponses) ||
    s.methodResponses.length < 1 ||
    s.methodResponses.length > 100
  )
    return false;
  const first = s.methodResponses[0];
  if (!first || typeof first !== 'object') return false;
  const closure = first.recordingClosure;
  let inputs: Command[], closing: Command | undefined;
  if (s.inputs === undefined) {
    if (
      !closure ||
      typeof closure !== 'object' ||
      Object.keys(closure).sort().join(',') !== 'command,inputs' ||
      !isInputRecording(closure.inputs) ||
      closure.inputs.length !== MAX_RECORDED_INPUTS ||
      !isRecordedCommand(closure.command)
    )
      return false;
    inputs = closure.inputs;
    closing = closure.command;
  } else {
    if (closure !== undefined) return false;
    // Later ordinary work is not historical exchange context. Include all actual method inputs,
    // even if a forged packet omitted their receipts, then compare the exact regenerated records.
    const last = s.inputs.findLastIndex((c) => c.type === 'discuss-repair-method');
    if (last < 0) return false;
    inputs = s.inputs.slice(0, last + 1);
  }
  const replay = replayRecordedRun({
    seed: s.seed,
    inputs,
    provenance: s.provenance,
    ...(s.migratedFrom ? { migratedFrom: s.migratedFrom } : {}),
    ...(s.openingPeople ? { openingPeople: s.openingPeople } : {}),
    ...(s.castChapter ? { castChapter: s.castChapter } : {}),
  });
  if (!replay.ok) return false;
  let historical = replay.state;
  if (closing) {
    const result = dispatch(historical, closing);
    if (!result.ok || result.state.inputs !== undefined) return false;
    historical = result.state;
  }
  // Exact generated shape includes nested reports, evidence, decisions and activation fields.
  // No unsupported field is stripped, and no current physical state substitutes for old evidence.
  const canonical = (v: unknown): string =>
    JSON.stringify(v, (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item,
    );
  if (canonical(historical.methodResponses) !== canonical(s.methodResponses)) return false;
  const identity = (j: Job) => ({
    id: j.id,
    title: j.title,
    ownerId: j.ownerId,
    description: j.description,
    importance: j.importance,
    kind: j.kind,
    isPersonal: j.isPersonal,
    isDonor: j.isDonor,
    components: j.model.components.map((c) => ({
      id: c.id,
      kind: c.kind,
      label: c.label,
      terminals: c.terminals,
      x: c.x,
      y: c.y,
    })),
  });
  return s.methodResponses.every((r) => {
    const current = s.jobs.find((j) => j.id === r.jobId);
    const original = historical.jobs.find((j) => j.id === r.jobId);
    if (!current || !original || canonical(identity(current)) !== canonical(identity(original)))
      return false;
    // Performed contribution records are retained. Later work is allowed; changing the actual
    // earlier action, actor or time is not. Physical condition and return status are mutable.
    if (
      canonical(current.contributions.filter((w) => w.at <= r.askedAt)) !==
      canonical(original.contributions.filter((w) => w.at <= r.askedAt))
    )
      return false;
    // Old evidence may roll out of the bounded list. A retained id must still be that same record.
    if (
      r.report.evidence.some((e) =>
        current.evidence.some((c) => c.id === e.id && canonical(c) !== canonical(e)),
      )
    )
      return false;
    const earlierTerms = (s.ownerExchanges ?? [])
      .filter((t) => t.jobId === r.jobId && t.answeredAt <= r.askedAt)
      .map((t) => ({
        componentId: t.componentId,
        answeredAt: t.answeredAt,
        terms: t.terms,
        response: t.response,
      }));
    return canonical(earlierTerms) === canonical(r.report.ownerTerms);
  });
}
