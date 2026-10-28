import type { Evidence, Job, TestCondition } from './types.ts';

const conditions: TestCondition[] = ['bench', 'movement', 'load'];

function span(evidence: Evidence): string | undefined {
  const request = evidence.request;
  if (!request || request.a === request.b) return;
  return `${request.mode}:${[request.a, request.b].sort().join(':')}`;
}

/** Sensory context from this actor's own readings and attended observations.
 * Work by any actor starts a new physical revision, even when it was not witnessed.
 * Comparisons describe readings; they do not diagnose a fault or prescribe a repair.
 */
export function evidenceContext(job: Job, actorId?: string): Record<string, string> {
  const revision = Math.max(0, ...job.evidence.filter((e) => e.kind === 'work').map((e) => e.id));
  const received = job.evidence
    .filter(
      (e) =>
        e.id >= revision && (!actorId || e.actorId === actorId || e.witnessedBy?.includes(actorId)),
    )
    .sort((a, b) => a.id - b.id);
  const last = received.at(-1);
  const observedChecks = new Set<TestCondition>();
  for (const observation of received) {
    if (observation.kind !== 'use' || !observation.condition) continue;
    if (observation.cues.signal === 'steady-output') observedChecks.add(observation.condition);
    else observedChecks.delete(observation.condition);
  }
  const required = job.requiredConditions ?? (job.kind === 'lantern' ? ['movement'] : ['load']);
  const stage = required.every((condition) => observedChecks.has(condition as TestCondition))
    ? 'ready'
    : observedChecks.size
      ? `checked-${[...observedChecks].sort().join('-')}`
      : last?.kind === 'work'
        ? 'repaired'
        : received.some((e) => e.kind === 'measurement' || e.kind === 'use')
          ? 'measured'
          : received.some((e) => e.kind === 'inspection')
            ? 'examined'
            : 'intake';
  const cues: Record<string, string> = {
    family: job.kind === 'music-box' ? 'mechanical' : 'electrical',
    stage,
    ...(job.kind === 'music-box' ? { 'requested-pace': String(job.model.desiredRPM ?? 15) } : {}),
  };
  // The visible object and owner's use brief scope an initial test order.
  // Later method conditions depend on received evidence, not the hidden cause.
  if (stage === 'intake' || stage === 'examined')
    cues['requested-use'] = `${job.kind}:${required.join('+')}`;
  if (stage === 'ready') return cues;
  // Only public sensory fields enter HF's bounded condition list.
  if (last?.cues.part) cues.part = last.cues.part;
  if (last?.cues.signal) cues.signal = last.cues.signal;
  const focus = [...received].reverse().find((e) => e.kind === 'measurement');
  if (!focus || !span(focus) || focus.cues.signal === 'invalid') return cues;
  // An inspection or work on another component changes what is being investigated.
  if (last?.componentId && last.componentId !== focus.componentId) return cues;
  const readings = new Map<TestCondition, Evidence>();
  for (const evidence of received) {
    if (
      evidence.kind === 'measurement' &&
      evidence.componentId === focus.componentId &&
      span(evidence) === span(focus) &&
      evidence.unit === focus.unit &&
      evidence.cues.signal !== 'invalid' &&
      evidence.cues.signal !== 'power-off' &&
      typeof evidence.value === 'number' &&
      Number.isFinite(evidence.value) &&
      evidence.request
    )
      readings.set(evidence.request.condition, evidence);
  }
  const observedConditions = conditions.filter((condition) => readings.has(condition));
  cues['observed-span'] =
    `${span(focus)}:${observedConditions.join('+') || focus.request?.condition}`;
  const referenceCondition = conditions.find((condition) => readings.has(condition));
  if (!referenceCondition || readings.size < 2) return cues;
  const reference = readings.get(referenceCondition) as Evidence;
  if (reference.cues.part) cues.part = reference.cues.part;
  cues.signal = reference.cues.signal ?? 'measurement';
  for (const condition of conditions) {
    const reading = readings.get(condition);
    if (!reading || condition === referenceCondition) continue;
    const difference = Math.abs(reading.value as number) - Math.abs(reference.value as number);
    cues[`comparison-${condition}`] =
      `${difference > 0 ? 'higher' : difference < 0 ? 'lower' : 'equal'}-than-${referenceCondition}`;
  }
  return cues;
}
