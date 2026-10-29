import { validateCastChapter } from './cast.ts';
import { ownerReplacementProposal, ownerReplacementResponse } from './cast-content.ts';
import { createGame } from './engine.ts';
import { attachWorkshop, snapshotRuntime, type WorkshopRuntime } from './hf.ts';
import { matchesJson } from './json-data.ts';
import { validMethodResponses } from './method-response.ts';
import { compatiblePart, createModel } from './model.ts';
import { restoreOpeningPeople } from './opening.ts';
import { OUTCOME_TERMS } from './outcomes.ts';
import { validateOutcomeSave } from './outcomes-validation.ts';
import {
  isInputRecording,
  isMigratedFrom,
  isOutcomeProvenance,
  isRecordedCommand,
  isSupportedProvenance,
  MAX_RECORDED_INPUTS,
} from './recording.ts';
import { aspirationAdvances, responsibilityAdvances } from './responsibility.ts';
import type { Evidence, GameState, Job, TestCondition } from './types.ts';

const DAY = 1440;
const OPEN = 540;
const CLOSE = 1020;
const CONDITIONS: TestCondition[] = ['bench', 'movement', 'load'];
const UPGRADE_IDS = ['second-bench', 'precision-meter'];
export const MAX_GAME_SAVE_LENGTH = 256 * 1024 * 1024;
const SAVE_FIELDS = new Set<keyof GameState>([
  'hf',
  'schema',
  'provenance',
  'migratedFrom',
  'inputs',
  'discoveries',
  'ownerExchanges',
  'methodResponses',
  'castOutcomes',
  'castChapter',
  'chapterPaused',
  'openingPeople',
  'community',
  'seed',
  'rng',
  'now',
  'day',
  'cash',
  'reputation',
  'stock',
  'busyWorkshop',
  'jobs',
  'people',
  'npcWork',
  'watching',
  'watchUntil',
  'pendingRequest',
  'selectedJobId',
  'log',
  'nextId',
  'upgrades',
  'independentRepairs',
  'weekReviewed',
  'ended',
  'dailyCostsPaid',
]);

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );
}
export function saveGame(state: GameState): string {
  if (!isSupportedProvenance(state.provenance))
    throw new Error('This workshop belongs to an earlier edition. Start fresh here.');
  // Object insertion order may change when HF restores an archive. Canonical object keys make
  // the first save and every restored save byte-identical without changing arrays or evidence.
  return canonical({ ...state, hf: snapshotRuntime(state.people) });
}
export function loadGame(text: string): GameState {
  if (text.length > MAX_GAME_SAVE_LENGTH) throw new Error('This save exceeds the supported size.');
  const value = JSON.parse(text) as GameState & { hf: WorkshopRuntime; castSources?: unknown };
  delete value.castSources;
  if (value?.schema !== 'small-works@5' || !isSupportedProvenance(value?.provenance)) {
    throw new Error(
      'This save belongs to an earlier workshop edition. Start fresh here, or use its historical archive.',
    );
  }
  const invalid = () => {
    throw new Error('This Small Works save is incomplete or invalid.');
  };
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const num = (v: unknown, min = 0, max = 100_000_000): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const integer = (v: unknown, min = 0, max = 100_000_000): v is number =>
    num(v, min, max) && Number.isInteger(v);
  const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 10_000;
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length <= 1000 && v.every(str);
  const cues = (v: unknown) =>
    object(v) && Object.keys(v).length <= 8 && Object.values(v).every(str);
  const parts = [
    'cell',
    'switch',
    'contact',
    'bulb',
    'motor',
    'spring',
    'gear',
    'governor',
    'drum',
  ];
  const ids = new Set<string>();
  const actors = ['player', 'sam', 'mum', 'nora', 'rafi', 'halil'];
  const conditions = ['good', 'weak', 'dirty', 'open', 'worn', 'jammed', 'misaligned'];
  const requestValid = (v: unknown) =>
    object(v) &&
    ['voltage', 'continuity', 'motion'].includes(String(v.mode)) &&
    str(v.a) &&
    str(v.b) &&
    CONDITIONS.includes(v.condition as TestCondition);
  const evidenceValid = (e: Evidence, job: Job) =>
    object(e) &&
    integer(e.id, 1) &&
    integer(e.at) &&
    e.at <= value.now &&
    ['inspection', 'measurement', 'use', 'work'].includes(e.kind) &&
    str(e.summary) &&
    cues(e.cues) &&
    (e.componentId === undefined || job.model.components.some((c) => c.id === e.componentId)) &&
    (e.request === undefined || requestValid(e.request)) &&
    (e.value === undefined || e.value === null || num(e.value, -100_000_000)) &&
    (e.unit === undefined || str(e.unit)) &&
    (e.condition === undefined || (e.kind === 'use' && CONDITIONS.includes(e.condition))) &&
    (e.actorId === undefined || actors.includes(e.actorId)) &&
    (e.witnessedBy === undefined ||
      (strings(e.witnessedBy) && e.witnessedBy.every((id) => actors.includes(id))));
  if (
    !object(value) ||
    Object.keys(value).some((key) => !SAVE_FIELDS.has(key as keyof GameState)) ||
    !['small-works@4', 'small-works@5'].includes(value.schema) ||
    !isSupportedProvenance(value.provenance) ||
    (value.migratedFrom !== undefined &&
      (value.schema !== 'small-works@5' ||
        !isMigratedFrom(value.migratedFrom) ||
        (value.inputs !== undefined && value.migratedFrom.atInput > value.inputs.length))) ||
    (value.inputs !== undefined &&
      (!isInputRecording(value.inputs) || value.provenance === undefined)) ||
    (value.discoveries !== undefined &&
      (!strings(value.discoveries) ||
        value.discoveries.some((id) => !['sam', 'nora', 'rafi', 'halil'].includes(id)))) ||
    !integer(value.seed, 0, 0xffffffff) ||
    !integer(value.rng, 1, 0xffffffff) ||
    !integer(value.now) ||
    !integer(value.day, 1) ||
    value.day !== Math.floor(value.now / DAY) + 1 ||
    value.now % DAY < OPEN ||
    value.now % DAY > CLOSE ||
    !num(value.cash) ||
    !integer(value.reputation, -100_000_000) ||
    !integer(value.nextId, 1) ||
    !integer(value.independentRepairs) ||
    !num(value.dailyCostsPaid) ||
    typeof value.watching !== 'boolean' ||
    (value.watchUntil !== undefined && !integer(value.watchUntil)) ||
    typeof value.weekReviewed !== 'boolean' ||
    typeof value.ended !== 'boolean' ||
    !Array.isArray(value.jobs) ||
    value.jobs.length < 1 ||
    value.jobs.length > 10000 ||
    !Array.isArray(value.npcWork) ||
    value.npcWork.length > 5 ||
    !Array.isArray(value.log) ||
    value.log.length > 160 ||
    !object(value.people) ||
    !object(value.stock) ||
    !strings(value.upgrades) ||
    value.upgrades.some((id) => !UPGRADE_IDS.includes(id)) ||
    Object.entries(value.stock).some(([kind, count]) => !parts.includes(kind) || !integer(count))
  )
    invalid();
  if (isOutcomeProvenance(value.provenance) !== (value.castOutcomes !== undefined)) invalid();
  if (value.castOutcomes !== undefined) validateOutcomeSave(value);
  if (value.busyWorkshop !== undefined) {
    const busy = value.busyWorkshop;
    if (
      !object(busy) ||
      busy.edition !== 'busy-workshop@1' ||
      !integer(busy.startedAt) ||
      busy.startedAt > value.now ||
      busy.startedAt % DAY !== 810 ||
      busy.restockAt !== Math.floor(busy.startedAt / DAY) * DAY + DAY + OPEN ||
      !object(busy.recoveredStock) ||
      Object.entries(busy.recoveredStock).some(
        ([part, count]) =>
          !parts.includes(part) ||
          !integer(count) ||
          count > (value.stock[part as keyof typeof value.stock] ?? 0),
      )
    )
      invalid();
  }
  for (const job of value.jobs) {
    if (
      !object(job) ||
      !str(job.id) ||
      !job.id ||
      ids.has(job.id) ||
      !actors.includes(job.ownerId) ||
      !str(job.title) ||
      !str(job.description) ||
      !str(job.importance) ||
      !num(job.reward) ||
      !integer(job.due) ||
      !['offer', 'active', 'ready', 'delivered', 'declined', 'salvaged'].includes(job.status) ||
      !['lantern', 'fan', 'music-box'].includes(job.kind) ||
      !object(job.model) ||
      job.model.kind !== job.kind ||
      !num(job.model.sourceVolts, 0.01) ||
      typeof job.model.power !== 'boolean' ||
      !Array.isArray(job.model.components) ||
      job.model.components.length !== 4 ||
      !Array.isArray(job.evidence) ||
      job.evidence.length > 80 ||
      !strings(job.inspected) ||
      !strings(job.verified) ||
      !Array.isArray(job.contributions) ||
      job.contributions.length > 10000 ||
      !Array.isArray(job.pendingLessons) ||
      job.pendingLessons.length > 4
    )
      invalid();
    ids.add(job.id);
    const template = createModel(job.kind, 1);
    job.model.components.forEach((c, index) => {
      const expected = template.components[index];
      if (
        !object(c) ||
        c.id !== expected?.id ||
        c.kind !== expected.kind ||
        !str(c.label) ||
        !Array.isArray(c.terminals) ||
        JSON.stringify(c.terminals) !== JSON.stringify(expected.terminals) ||
        !num(c.x, -1000, 1000) ||
        !num(c.y, -1000, 1000) ||
        !conditions.includes(c.condition) ||
        (c.setting !== undefined && (c.kind !== 'governor' || !integer(c.setting, 0, 4)))
      )
        invalid();
    });
    if (
      (job.requiredConditions !== undefined &&
        (!Array.isArray(job.requiredConditions) ||
          job.requiredConditions.length < 1 ||
          job.requiredConditions.length > 3 ||
          new Set(job.requiredConditions).size !== job.requiredConditions.length ||
          job.requiredConditions.some((condition) => !CONDITIONS.includes(condition)))) ||
      (job.model.desiredRPM !== undefined && !num(job.model.desiredRPM, 0.01, 100_000)) ||
      (job.model.tolerance !== undefined && !num(job.model.tolerance, 0.01, 100_000)) ||
      (job.model.ratedDrive !== undefined && !num(job.model.ratedDrive, 0.01, 100_000)) ||
      (job.model.gearRatio !== undefined && !num(job.model.gearRatio, 0.01, 100_000)) ||
      job.inspected.some((id) => !job.model.components.some((c) => c.id === id)) ||
      job.verified.some((c) => !CONDITIONS.includes(c)) ||
      job.evidence.some((e) => !evidenceValid(e, job)) ||
      job.contributions.some(
        (c) =>
          !object(c) ||
          !actors.includes(c.actorId) ||
          !str(c.action) ||
          !integer(c.at) ||
          c.at > value.now,
      ) ||
      job.pendingLessons.some(
        (l) =>
          !object(l) ||
          l.observerId !== 'sam' ||
          !str(l.action) ||
          !/^(clean|adjust|replace|calibrate):/.test(l.action) ||
          !cues(l.cues) ||
          !str(l.demonstrationId) ||
          (l.baseline !== undefined && !evidenceValid(l.baseline, job)),
      ) ||
      (job.assignedTo !== undefined && job.assignedTo !== 'sam') ||
      (job.assignedTo !== undefined && !['active', 'ready'].includes(job.status)) ||
      (job.blocked !== undefined &&
        (!object(job.blocked) ||
          job.assignedTo !== 'sam' ||
          !integer(job.blocked.at) ||
          job.blocked.at > value.now ||
          !['help', 'unavailable'].includes(job.blocked.kind) ||
          !str(job.blocked.reason) ||
          !job.blocked.reason)) ||
      ['acceptedAt', 'deliveredAt'].some(
        (key) => job[key as 'acceptedAt'] !== undefined && !integer(job[key as 'acceptedAt']),
      ) ||
      [
        'isPersonal',
        'isDonor',
        'returnedUnfinished',
        'overdueNoted',
        'overdueAgain',
        'withheldNoted',
        'wentElsewhere',
      ].some(
        (key) =>
          job[key as 'isPersonal'] !== undefined && typeof job[key as 'isPersonal'] !== 'boolean',
      ) ||
      (job.completedBy !== undefined && !actors.includes(job.completedBy)) ||
      (job.quote !== undefined && !str(job.quote))
    )
      invalid();
  }
  if (
    !ids.has(value.selectedJobId) ||
    value.log.some(
      (e) =>
        !object(e) ||
        !integer(e.id, 1) ||
        !integer(e.at) ||
        e.at > value.now ||
        !str(e.speaker) ||
        !str(e.text) ||
        !['ordinary', 'good', 'warning'].includes(e.tone),
    )
  )
    invalid();
  if (value.ownerExchanges !== undefined) {
    if (
      !Array.isArray(value.ownerExchanges) ||
      value.ownerExchanges.length < 1 ||
      value.ownerExchanges.length > 100
    )
      invalid();
    const questions = new Set<string>();
    for (const r of value.ownerExchanges) {
      if (!object(r)) invalid();
      const job = value.jobs.find((j) => j.id === r.jobId);
      const key = `${r.jobId}:${r.componentId}`;
      if (
        !job ||
        questions.has(key) ||
        Object.keys(r)
          .filter((key) => key !== 'recordingClosedAtInput')
          .sort()
          .join(',') !==
          'activation,answeredAt,askedAt,componentId,decision,edition,evidence,importance,intervention,jobId,originalRequest,ownerId,proposal,response,terms' ||
        r.edition !== 'object-owner-exchange@1' ||
        r.ownerId !== job.ownerId ||
        job.isDonor ||
        job.isPersonal ||
        !job.model.components.some((c) => c.id === r.componentId) ||
        r.intervention !== 'replace' ||
        !integer(r.askedAt) ||
        !integer(r.answeredAt) ||
        r.answeredAt !== r.askedAt + 5 ||
        r.answeredAt > value.now ||
        (r.askedAt % DAY) + 5 > CLOSE ||
        !str(r.originalRequest) ||
        r.originalRequest !== job.description ||
        r.importance !== job.importance ||
        r.proposal !== ownerReplacementProposal(job, r.componentId) ||
        !['one-part', 'original-parts', 'refused'].includes(r.terms) ||
        r.response !== ownerReplacementResponse(job, r.componentId, r.terms) ||
        !Array.isArray(r.evidence) ||
        r.evidence.length < 1 ||
        r.evidence.length > 80 ||
        new Set(r.evidence.map((e) => e.id)).size !== r.evidence.length ||
        r.evidence.some(
          (e) =>
            !evidenceValid(e, job) ||
            e.actorId !== 'player' ||
            e.kind === 'work' ||
            e.at > r.askedAt ||
            r.askedAt - e.at > DAY,
        ) ||
        !r.evidence.some((e) => e.kind === 'inspection' && e.componentId === r.componentId) ||
        !r.evidence.some(
          (e) => e.kind === 'use' || (e.kind === 'measurement' && e.componentId === r.componentId),
        ) ||
        !object(r.decision) ||
        !str(r.decision.narration) ||
        !str(r.decision.reason) ||
        !object(r.decision.terms) ||
        Object.values(r.decision.terms).some((v) => !num(v, -100_000_000)) ||
        (r.decision.chosenId !== undefined && !str(r.decision.chosenId)) ||
        (r.decision.answer !== undefined &&
          (!object(r.decision.answer) ||
            !['assented', 'complied', 'deferred', 'modified', 'refused', 'commanded'].includes(
              r.decision.answer.verdict,
            ) ||
            !str(r.decision.answer.says) ||
            !str(r.decision.answer.reason))) ||
        (r.terms === 'one-part' &&
          (r.decision.chosenId !== 'owner-one-part' ||
            r.decision.answer?.verdict !== 'assented')) ||
        (r.terms === 'original-parts' && r.decision.chosenId !== 'owner-original-parts') ||
        (r.terms === 'refused' &&
          (r.decision.chosenId === 'owner-original-parts' ||
            (r.decision.chosenId === 'owner-one-part' &&
              r.decision.answer?.verdict === 'assented')))
      )
        invalid();
      const activation = r.activation;
      if (
        !object(activation) ||
        Object.keys(activation).sort().join(',') !== 'command,index' ||
        !integer(activation.index, 0, MAX_RECORDED_INPUTS - 1) ||
        !isRecordedCommand(activation.command) ||
        activation.command.type !== 'ask-owner-about-object'
      )
        invalid();
      const command = activation.command;
      if (
        command.jobId !== r.jobId ||
        command.ownerId !== r.ownerId ||
        command.componentId !== r.componentId ||
        !matchesJson(command.evidenceText, r.evidence) ||
        JSON.stringify(command.evidenceIds) !== JSON.stringify(r.evidence.map((e) => e.id))
      )
        invalid();
      // A missing ordinary input list is not proof of this new action. Only the actual existing cap
      // transition retains a closed recording receipt, with its complete original activating input.
      if (value.inputs === undefined) {
        if (r.recordingClosedAtInput !== MAX_RECORDED_INPUTS) invalid();
      } else if (
        r.recordingClosedAtInput !== undefined ||
        canonical(value.inputs[activation.index]) !== canonical(command)
      )
        invalid();
      questions.add(key);
    }
  }
  if (!validMethodResponses(value)) invalid();
  const request = value.pendingRequest;
  if (request !== undefined) {
    const offered = object(request) ? value.jobs.find((j) => j.id === request.jobId) : undefined;
    if (
      !object(request) ||
      !['lesson', 'repair'].includes(request.kind) ||
      Object.keys(request).some(
        (key) => !['kind', 'status', 'requestedAt', 'readyUntil', 'jobId'].includes(key),
      ) ||
      !['requested', 'ready'].includes(request.status) ||
      !integer(request.requestedAt) ||
      request.requestedAt > value.now ||
      request.requestedAt < Math.floor(value.now / DAY) * DAY + OPEN ||
      value.watching ||
      (request.status === 'requested' && request.readyUntil !== undefined) ||
      (request.status === 'ready' &&
        (request.kind !== 'lesson' ||
          !integer(request.readyUntil) ||
          request.readyUntil <= value.now ||
          request.readyUntil > value.now + 20 ||
          request.readyUntil > Math.floor(value.now / DAY) * DAY + CLOSE)) ||
      (request.kind === 'lesson' && request.jobId !== undefined) ||
      (request.kind === 'repair' &&
        (!offered ||
          !['active', 'ready'].includes(offered.status) ||
          value.jobs.some((j) => j.assignedTo && j.id !== offered.id)))
    )
      invalid();
  }
  if (value.jobs.filter((j) => j.assignedTo === 'sam').length > 1) invalid();
  if (value.community !== undefined) {
    const event = value.community;
    const formats = ['garden', 'reading', 'theatre'];
    const unique = (items: unknown): items is string[] =>
      strings(items) && new Set(items).size === items.length;
    const knownJobs = (items: unknown) => unique(items) && items.every((id) => ids.has(id));
    if (
      !object(event) ||
      !['announced', 'setting-up', 'completed'].includes(event.phase) ||
      !integer(event.announcedAt) ||
      event.announcedAt > value.now ||
      !integer(event.opensAt) ||
      event.opensAt < event.announcedAt ||
      !integer(event.deadline) ||
      event.deadline < event.opensAt ||
      !integer(event.finishesAt) ||
      event.finishesAt < event.deadline ||
      !unique(event.invitedPersonIds) ||
      event.invitedPersonIds.length > 5 ||
      event.invitedPersonIds.some((id) => !['sam', 'mum', 'nora', 'rafi', 'halil'].includes(id)) ||
      !unique(event.preparedFormats) ||
      event.preparedFormats.length > 3 ||
      event.preparedFormats.some((format) => !formats.includes(format)) ||
      !knownJobs(event.reservedJobIds) ||
      event.reservedJobIds.length > 3 ||
      !knownJobs(event.ownerConsentJobIds) ||
      !Array.isArray(event.preparations) ||
      event.preparations.length > 3 ||
      !Array.isArray(event.decisions) ||
      event.decisions.length > 5 ||
      !str(event.outcome) ||
      (event.resolvedAt !== undefined &&
        (!integer(event.resolvedAt) ||
          event.resolvedAt < event.deadline ||
          event.resolvedAt > value.now ||
          event.finishesAt !== event.resolvedAt + 30)) ||
      (event.phase === 'completed' &&
        (event.resolvedAt === undefined ||
          value.now < event.finishesAt ||
          event.reservedJobIds.length !== 0)) ||
      (event.phase === 'announced' && event.preparations.length !== 0) ||
      (event.resolvedAt === undefined && event.decisions.length !== 0)
    )
      invalid();
    const preparationFormats = new Set<string>();
    const preparationJobs = new Set<string>();
    for (const prep of event.preparations) {
      if (
        !object(prep) ||
        !formats.includes(prep.format) ||
        !ids.has(prep.jobId) ||
        preparationFormats.has(prep.format) ||
        preparationJobs.has(prep.jobId) ||
        !integer(prep.startedAt) ||
        prep.startedAt < event.opensAt ||
        prep.startedAt > value.now ||
        prep.startedAt + 90 > event.deadline ||
        (prep.completedAt !== undefined &&
          (!integer(prep.completedAt) ||
            prep.completedAt < prep.startedAt + 90 ||
            prep.completedAt > event.deadline ||
            prep.completedAt > value.now)) ||
        event.preparedFormats.includes(prep.format) !== (prep.completedAt !== undefined) ||
        (event.phase !== 'completed' && !event.reservedJobIds.includes(prep.jobId))
      )
        invalid();
      preparationFormats.add(prep.format);
      preparationJobs.add(prep.jobId);
    }
    if (
      event.preparedFormats.some((format) => !preparationFormats.has(format)) ||
      event.reservedJobIds.some((id) => !preparationJobs.has(id)) ||
      event.preparations.filter((prep) => prep.completedAt === undefined).length > 1
    )
      invalid();
    const decided = new Set<string>();
    for (const decision of event.decisions) {
      if (
        !object(decision) ||
        !event.invitedPersonIds.includes(decision.personId) ||
        decided.has(decision.personId) ||
        !str(decision.activityLabel) ||
        !str(decision.speech) ||
        typeof decision.completed !== 'boolean' ||
        (decision.format !== undefined &&
          (!formats.includes(decision.format) ||
            !event.preparedFormats.includes(decision.format))) ||
        (decision.activityId === undefined &&
          (decision.startedAt !== undefined ||
            decision.endsAt !== undefined ||
            decision.format !== undefined ||
            decision.completed)) ||
        (decision.activityId !== undefined &&
          (!str(decision.activityId) ||
            ![
              'personal',
              'eat',
              'rest',
              'postpone',
              'community:garden',
              'community:reading',
              'community:theatre',
            ].includes(decision.activityId) ||
            !integer(decision.startedAt) ||
            decision.startedAt !== event.resolvedAt ||
            !integer(decision.endsAt) ||
            decision.endsAt !== decision.startedAt + 30 ||
            (decision.format !== undefined &&
              decision.activityId !== `community:${decision.format}`))) ||
        (decision.completed &&
          (event.phase !== 'completed' || value.now < (decision.endsAt ?? Infinity)))
      )
        invalid();
      decided.add(decision.personId);
    }
  }
  // HF restores the archive. The host validates its own runtime ledger and cached inspection views.
  if (Object.keys(value.people).sort().join(',') !== 'halil,mum,nora,rafi,sam') invalid();
  if (!object(value.hf) || !object(value.hf.archive)) invalid();
  const savedPeople = canonical(value.people);
  attachWorkshop(value);
  if (
    canonical(value.people) !== savedPeople ||
    Object.entries(value.people).some(
      ([id, person]) => person.id !== id || person.now !== value.now,
    )
  )
    invalid();
  if (value.openingPeople !== undefined)
    value.openingPeople = restoreOpeningPeople(value.openingPeople);
  if (value.chapterPaused !== undefined && typeof value.chapterPaused !== 'boolean') invalid();
  if (value.castChapter !== undefined) {
    validateCastChapter(value.castChapter);
    createGame(value.seed, 'current', value.openingPeople, value.castChapter);
    if (
      value.castChapter.version !== 'workshop-cast/1' ||
      !Array.isArray(value.castChapter.inputs) ||
      value.castChapter.inputs.length > 4 ||
      !Array.isArray(value.castChapter.claims) ||
      value.castChapter.claims.length !== value.castChapter.inputs.length ||
      !value.openingPeople
    )
      invalid();
  }
  const responsibilityGoals = new Set<string>();
  for (const job of value.jobs) {
    const handle = job.responsibility;
    if (handle === undefined) continue;
    if (!object(handle)) invalid();
    const goal = value.people.sam?.agenda.goals.find((g) => g.id === handle.goalId);
    if (
      !object(handle) ||
      handle.jobId !== job.id ||
      !str(handle.goalId) ||
      responsibilityGoals.has(handle.goalId) ||
      !goal ||
      (handle.lastHelpEvidenceRevision !== undefined &&
        (!integer(handle.lastHelpEvidenceRevision) ||
          handle.lastHelpEvidenceRevision >
            Math.max(
              0,
              ...job.evidence
                .filter((e) => e.actorId === 'sam' || e.witnessedBy?.includes('sam'))
                .map((e) => e.id),
            ))) ||
      goal.label !== `Resolve accepted repair ${job.id}` ||
      goal.baseImportance !== 0.2 ||
      JSON.stringify(goal.serves) !== '["achievement"]' ||
      canonical(goal.advancedBy) !==
        canonical([
          { action: 'deliver', amount: 1 },
          { action: 'complete-project', amount: 1 },
          { action: 'delivery-independent', amount: 1 },
        ]) ||
      (goal.status === 'active' &&
        (job.assignedTo !== 'sam' ||
          !['active', 'ready'].includes(job.status) ||
          goal.progress > 0.2 + Number.EPSILON)) ||
      (goal.status === 'achieved' &&
        (job.status !== 'delivered' || job.returnedUnfinished || goal.progress !== 1)) ||
      goal.status === 'abandoned'
    )
      invalid();
    responsibilityGoals.add(handle.goalId);
  }
  for (const [id, person] of Object.entries(value.people))
    for (const goal of person.agenda.goals)
      if (
        goal.status === 'active' &&
        goal.label.startsWith('Resolve accepted repair ') &&
        (id !== 'sam' || !responsibilityGoals.has(goal.id))
      )
        invalid();
  const working = new Set<string>();
  for (const w of value.npcWork) {
    const job = value.jobs.find((j) => j.id === w.jobId);
    const person = value.people[w.personId];
    if (
      !object(w) ||
      !person ||
      !['sam', 'mum', 'nora', 'rafi', 'halil'].includes(w.personId) ||
      working.has(w.personId) ||
      (w.jobId !== undefined && (!job || job.assignedTo !== w.personId)) ||
      job?.blocked !== undefined ||
      (w.jobId === undefined &&
        !['eat', 'drink', 'rest', 'personal', 'leisure', 'pray'].includes(w.option?.action)) ||
      !object(w.option) ||
      !str(w.option.id) ||
      !str(w.option.action) ||
      !str(w.option.label) ||
      !integer(w.option.duration, 1, 480) ||
      !num(w.option.effort, 0, 1) ||
      (w.option.advances !== undefined &&
        (!strings(w.option.advances) ||
          JSON.stringify(w.option.advances) !==
            JSON.stringify(
              job
                ? responsibilityAdvances(person, job.responsibility, job.id, w.option.action)
                : [],
            ))) ||
      !integer(w.startedAt) ||
      w.startedAt > value.now ||
      !integer(w.endsAt) ||
      w.endsAt <= value.now ||
      w.endsAt !== w.startedAt + w.option.duration ||
      w.endsAt > Math.floor(value.now / DAY) * DAY + CLOSE ||
      value.people[w.personId]?.activity?.affordance.id !== w.option.id ||
      value.people[w.personId]?.activity?.startedAt !== w.startedAt ||
      value.people[w.personId]?.activity?.endsAt !== w.endsAt ||
      value.people[w.personId]?.activity?.action !== w.option.action ||
      value.people[w.personId]?.activity?.affordance.duration !== w.option.duration ||
      JSON.stringify(person?.activity?.affordance.advances ?? []) !==
        JSON.stringify([
          ...(w.option.advances ?? []),
          ...(person ? aspirationAdvances(person, w.option.action) : []),
        ]) ||
      (job !== undefined &&
        value.people[w.personId]?.activity?.targetId !==
          (w.option.action === 'accept-repair' ? 'ordinary-day' : job.id)) ||
      (w.reservedRecovered !== undefined &&
        (!value.busyWorkshop || w.reservedRecovered !== true || !w.reservedPart)) ||
      (w.reservedPart !== undefined &&
        (!job ||
          job.assignedTo !== w.personId ||
          !parts.includes(w.reservedPart) ||
          !w.option.action.startsWith('replace:') ||
          compatiblePart(
            job?.model as import('./types').DeviceModel,
            w.option.action.split(':')[1] ?? '',
          ) !== w.reservedPart))
    )
      invalid();
    working.add(w.personId);
  }
  for (const decision of value.community?.decisions ?? []) {
    if (decision.activityId && !decision.completed && value.now < (decision.endsAt ?? 0)) {
      const activity = value.people[decision.personId]?.activity;
      if (
        !activity ||
        activity.affordanceId !== decision.activityId ||
        activity.startedAt !== decision.startedAt ||
        activity.endsAt !== decision.endsAt ||
        working.has(decision.personId)
      )
        invalid();
    }
  }
  for (const job of value.jobs) {
    if (!job.assignedTo || job.blocked || value.npcWork.some((w) => w.jobId === job.id)) continue;
    // A continuing responsibility can wait through sleep, a gathering, or an explicit retry request.
    if (value.pendingRequest?.kind === 'repair' && value.pendingRequest.jobId === job.id) continue;
    if (value.now % DAY === OPEN || value.now % DAY > CLOSE - 5) continue;
    if (
      value.community?.decisions.some(
        (d) =>
          d.personId === job.assignedTo &&
          d.activityId &&
          !d.completed &&
          (d.endsAt ?? 0) > value.now,
      )
    )
      continue;
    invalid();
  }
  const outcomeWork = value.castOutcomes?.pending;
  if (outcomeWork) {
    const owner = OUTCOME_TERMS[outcomeWork.action].person;
    const activity = value.people[owner]?.activity;
    if (
      working.has(owner) ||
      !activity ||
      activity.startedAt !== outcomeWork.startedAt ||
      activity.endsAt !== outcomeWork.endsAt ||
      activity.affordance.id !== outcomeWork.option.id
    )
      invalid();
    working.add(owner);
  }
  for (const [id, person] of Object.entries(value.people)) {
    if (!person.activity || working.has(id)) continue;
    if (
      value.community?.decisions.some(
        (d) =>
          d.personId === id &&
          !d.completed &&
          d.activityId === person.activity?.affordanceId &&
          d.endsAt === person.activity?.endsAt,
      )
    )
      continue;
    invalid();
  }
  if (
    request?.status === 'ready' &&
    (!value.people.sam?.agenda.commitments.some(
      (c) =>
        c.status === 'pending' &&
        c.targetId === 'workshop-lesson' &&
        c.actions.includes('complete-lesson') &&
        c.until === request.readyUntil,
    ) ||
      value.people.sam.activity)
  )
    invalid();
  if (request?.status === 'requested' && !value.people.sam?.activity) invalid();
  if (request?.kind === 'lesson' && value.jobs.some((j) => j.assignedTo === 'sam' && !j.blocked))
    invalid();
  if (
    value.watching &&
    (!integer(value.watchUntil) ||
      value.watchUntil <= value.now ||
      value.watchUntil > Math.floor(value.now / DAY) * DAY + CLOSE ||
      !value.people.sam?.agenda.commitments.some(
        (c) =>
          c.status === 'pending' &&
          c.targetId === 'workshop-lesson' &&
          c.actions.includes('complete-lesson') &&
          c.until === value.watchUntil,
      ) ||
      value.jobs.some((j) => j.assignedTo === 'sam' && !j.blocked))
  )
    invalid();
  return value;
}
