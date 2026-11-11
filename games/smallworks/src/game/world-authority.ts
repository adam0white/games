import { createGame, dispatch, distinctFanFault, generationRngAfter } from './engine.ts';
import {
  isInputRecording,
  isRecordedCommand,
  isSupportedProvenance,
  MAX_RECORDED_INPUTS,
} from './recording.ts';
import { replayRecordedRun } from './replay.ts';
import type { GameState, Job } from './types.ts';

const DAY = 1440;
const CLOSE = 1020;
const initialTitles = [
  'Nora’s reading light',
  'Rafi’s borrowed desk fan',
  'Nora’s keepsake music box',
];
const titles = [
  ...initialTitles,
  'Halil’s visiting lantern',
  'The meeting-room fan',
  'Sam’s winding toy',
];
const commissions = [
  'Nora’s reading light commission',
  'Rafi’s desk fan commission',
  'Nora’s music-box commission',
  'Halil’s visiting lantern commission',
  'The household room-fan commission',
  'Sam’s winding toy commission',
];
const kinds = ['lantern', 'fan', 'music-box', 'lantern', 'fan', 'music-box'];
const owners = ['nora', 'rafi', 'nora', 'halil', 'mum', 'sam'];
const rewards = [18, 32, 26, 20, 24, 22];
const busyTitles = ['Nora’s path lantern', 'Rafi’s filter fan', 'Nora’s work light'];
const forcedVisit =
  '“I came from my town for this visit. I repair things, but I am working fewer hours. This lantern goes dark when carried.”';
const stored = 'It has been stored for years; more than one part may have a fault.';
const canonical = (v: unknown) =>
  JSON.stringify(v, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
function fail(): never {
  throw new Error(
    'This world does not establish supported creation or generation history. Keep the complete workshop export.',
  );
}
function identity(j: Job) {
  return {
    id: j.id,
    title: j.title,
    kind: j.kind,
    ownerId: j.ownerId,
  };
}
function generation(j: Job) {
  return {
    id: j.id,
    title: j.title,
    kind: j.kind,
    reward: j.reward,
    extra: j.description.includes(stored),
  };
}
function generatedJobs(s: GameState) {
  // Public makeJob/outcome objects use this namespace. Existing native fixtures can also
  // contain authored objects outside it; replay does not claim to have generated those.
  return [...s.jobs.slice(0, 3), ...(s.busyWorkshop?.discardedGeneration ?? []), ...s.jobs.slice(3)]
    .filter((j) => /^object-\d+$/.test(j.id))
    .map(generation);
}

import { createModel } from './model.ts';
/** Bounded host generation consistency. This is neither ownership authentication nor proof of
 * actions after recording closure. Mutable repairs, deadlines and people remain host/HF state. */
export function assertWorldAuthority(s: GameState): void {
  if (!isSupportedProvenance(s.provenance) || s.migratedFrom) fail();
  const v = s.faultVariety;
  if (
    !v ||
    v.edition !== 'fault-variety@1' ||
    Object.keys(v).some(
      (k) => !['edition', 'generationSeed', 'first', 'second', 'recordingClosure'].includes(k),
    )
  )
    fail();
  const opening = createGame(s.seed);
  if (
    v.generationSeed !== opening.faultVariety?.generationSeed ||
    s.jobs.length < 3 ||
    s.jobs
      .slice(0, 3)
      .some((job, index) => canonical(identity(job)) !== canonical(identity(opening.jobs[index]!)))
  )
    fail();
  const fans = s.jobs.filter(
    (j) => /^object-\d+$/.test(j.id) && j.kind === 'fan' && j.id !== s.castOutcomes?.applianceId,
  );
  if (Boolean(fans[0]) !== Boolean(v.first) || (v.first && v.first.jobId !== fans[0]?.id)) fail();
  if (v.first) {
    const first = v.first;
    if (
      !['opening', 'busy'].includes(first.source) ||
      Object.keys(first).sort().join(',') !== 'jobId,model,source'
    )
      fail();
    // The original first cause survives subsequent repair. It is not player knowledge.
    const expected = createModel('fan', s.seed, [
      {
        componentId: first.source === 'opening' ? 'cell' : 'switch',
        condition: first.source === 'opening' ? 'weak' : 'worn',
      },
    ]);
    if (canonical(first.model) !== canonical(expected)) fail();
  }
  if (Boolean(fans[1]) !== Boolean(v.second) || (v.second && v.second.jobId !== fans[1]?.id))
    fail();
  if (
    v.second &&
    (!v.first ||
      v.second.seed !== v.generationSeed ||
      Object.keys(v.second).sort().join(',') !== 'fault,jobId,seed' ||
      canonical(v.second.fault) !==
        canonical(distinctFanFault(v.generationSeed, v.first.model) ?? null))
  )
    fail();
  const closure = v.recordingClosure ?? s.methodResponses?.[0]?.recordingClosure;
  if (s.inputs === undefined) {
    if (
      !closure ||
      Object.keys(closure).sort().join(',') !== 'command,inputs' ||
      !isInputRecording(closure.inputs) ||
      closure.inputs.length !== MAX_RECORDED_INPUTS ||
      !isRecordedCommand(closure.command)
    )
      fail();
  } else if (v.recordingClosure !== undefined) fail();
  const replay = replayRecordedRun({ ...s, inputs: s.inputs ?? closure?.inputs });
  if (!replay.ok && s.inputs === undefined) fail();
  let past = replay.ok ? replay.state : undefined;
  if (s.inputs === undefined && closure) {
    if (!past) fail();
    const closed = dispatch(past, closure.command);
    if (!closed.ok || closed.state.inputs !== undefined) fail();
    past = closed.state;
  }
  if (
    s.inputs !== undefined &&
    past &&
    past.rng === s.rng &&
    canonical(generatedJobs(past)) === canonical(generatedJobs(s)) &&
    canonical(past.faultVariety) === canonical(v)
  )
    return;
  // Mutable authored deadlines or acquired methods can alter offer eligibility. A divergent
  // replay does not authenticate their actions; audit actual retained generation phases.
  // Closed history cannot authenticate later work. The retained generation sequence must still
  // follow the actual ordered draws, including discarded busy offers and conditional extras.
  if (!retainedGenerationMatches(s, opening)) fail();
  if (s.inputs !== undefined) return;
  if (!past || canonical(past.faultVariety?.recordingClosure) !== canonical(v.recordingClosure))
    fail();
  if (
    past.busyWorkshop &&
    canonical(past.busyWorkshop.discardedGeneration) !==
      canonical(s.busyWorkshop?.discardedGeneration)
  )
    fail();
  for (const job of past.jobs) {
    const current =
      s.jobs.find((j) => j.id === job.id) ??
      (job.status === 'offer' && !past.busyWorkshop
        ? s.busyWorkshop?.discardedGeneration.find((j) => j.id === job.id)
        : undefined);
    if (
      !current ||
      canonical(identity(current)) !== canonical(identity(job)) ||
      canonical(current.contributions.slice(0, job.contributions.length)) !==
        canonical(job.contributions)
    )
      fail();
  }
}
function retainedGenerationMatches(s: GameState, opening: GameState): boolean {
  let rng = opening.rng;
  const draw = () => {
    rng = generationRngAfter(rng, 1);
    return rng / 0x100000000;
  };
  const ordered = [...(s.busyWorkshop?.discardedGeneration ?? []), ...s.jobs.slice(3)].filter((j) =>
    /^object-\d+$/.test(j.id),
  );
  for (const [offset, j] of ordered.entries()) {
    // This outcome scene supplies an authored object without calling the world RNG.
    if (
      j.id === s.castOutcomes?.applianceId &&
      j.title === 'Rafi’s separate customer appliance' &&
      j.ownerId === 'rafi' &&
      j.kind === 'fan' &&
      j.reward === 0
    )
      continue;
    const initial = initialTitles.indexOf(j.title);
    if (offset < 3 && initial >= 0) {
      if (
        initial !== offset ||
        j.kind !== kinds[initial] ||
        j.ownerId !== owners[initial] ||
        j.reward !== rewards[initial] ||
        j.due % DAY !== CLOSE ||
        Math.floor(j.due / DAY) > 2
      )
        return false;
      draw(); // authored/initial makeJob seed
      continue;
    }
    const busy = busyTitles.indexOf(j.title);
    if (s.busyWorkshop && busy >= 0) {
      if (
        j.ownerId !== (busy === 1 ? 'rafi' : 'nora') ||
        j.kind !== (busy === 1 ? 'fan' : 'lantern') ||
        j.reward !== (busy === 1 ? 32 : 18) ||
        j.due !== Math.floor(s.busyWorkshop.startedAt / DAY) * DAY + [870, 900, 930][busy]!
      )
        return false;
      draw(); // authored/initial makeJob seed
      continue;
    }
    if (j.title === 'The community room fan') {
      if (j.ownerId !== 'mum' || j.kind !== 'fan' || j.reward !== 0) return false;
      draw(); // authored/initial makeJob seed
      continue;
    }
    if (j.title === titles[3] && j.description === forcedVisit) {
      if (
        j.kind !== 'lantern' ||
        j.ownerId !== 'halil' ||
        j.reward !== 20 ||
        Math.floor(j.due / DAY) !== 3
      )
        return false;
      draw(); // authored/initial makeJob seed
      continue;
    }
    const choice = titles.indexOf(j.title);
    const commission = commissions.findIndex(
      (title) => j.title.startsWith(`${title} `) && /^\d+$/.test(j.title.slice(title.length + 1)),
    );
    const template = commission >= 0 ? commission : choice;
    const day = Math.floor(j.due / DAY);
    if (
      template < 0 ||
      j.kind !== kinds[template] ||
      j.ownerId !== owners[template] ||
      j.due % DAY !== CLOSE
    )
      return false;
    draw(); // actual neighbour selection precedes makeJob
    draw(); // makeJob seed
    const extra = j.description.includes(stored);
    const canExtra = day >= 4 && (commission >= 0 || choice !== 3);
    if ((extra && !canExtra) || j.reward !== rewards[template]! + (extra ? 8 : 0)) return false;
    if (canExtra) {
      if (draw() > 0.5 !== extra) return false; // actual conditional attempt, after makeJob
      if (extra) draw(); // actual fault choice only when that attempt succeeded
    }
  }
  return rng === s.rng;
}
