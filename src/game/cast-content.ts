import { admissionFacts } from './cast';
import type { Command, GameState, Job } from './types';
/** Authored private accounts. Render only after the corresponding played discovery. */
export const discoveredAccounts = {
  sam: 'Sam opens his testing notebook. “I once copied another player’s bug report without reproducing it. The developer chased the wrong conditions. I still need to correct that report. Here I want to write what I actually saw, including what I have not checked.”',
  nora: 'Nora lays a handle sketch beside the object. “The first shape came from my older brother’s repair. I let an exhibition presenter call it wholly original. I need to credit that help. I also dropped an accessible grip without asking its user.” She has disclosed the problem; no user trial or reconciliation has happened.',
  rafi: 'Rafi stops calling his borrowed fan a finished repair. “I work at the dish station in Bornova. I took a deposit for another appliance before checking the part, then spent some on this exchange. The customer still thinks it is fixed. I need help saying what I actually know.” No money has been repaid and that other appliance is not repaired here.',
  halil:
    'Halil takes an old repair order from his bag. “I marked this finished and charged nothing. Then I complained that nobody valued my work. Nuran asked why I would not name a price.” He says his wife has died and Selin is his daughter. His hypertension, cigarettes and rent arrears have not disappeared on this visit. He chooses a break; this conversation does not treat his illness or settle his debts.',
};

/** Finite replies to these authored disclosures only. Receipt uses HF perception, never assent,
 * diagnosis, learned methods, financial settlement or a completed cast outcome. No input means no change.
 */
export const personalReplies = {
  sam: 'I heard you say you copied the report without checking it.',
  nora: 'I heard you say your brother helped and the excluded user was not asked.',
  rafi: 'I heard you say the customer still thinks the appliance is fixed.',
  halil: 'I heard what you said about Nuran asking why you would not name a price.',
} as const;
export type PersonalRole = keyof typeof personalReplies;
export const declinePersonal = 'I do not want to discuss this now.';

/** Display the exact existing account without treating narrator limits as the person's speech. */
export function accountParts(text: string): { words: string; limits: string } {
  if (!Object.values(discoveredAccounts).some((account) => account === text))
    return { words: text, limits: '' };
  const end = text.lastIndexOf('”') + 1;
  return { words: text.slice(0, end), limits: text.slice(end).trim() };
}
export function personalStatement(s: GameState, personId: PersonalRole) {
  return s.log.findLast(
    (e) => e.speaker === s.people[personId]?.name && e.text === discoveredAccounts[personId],
  );
}
export function replyReceiptKey(personId: PersonalRole, statementId: number): string {
  return `Reply to ${personId}, statement ${statementId}:`;
}
export function personalReplyBlock(
  s: GameState,
  personId: PersonalRole,
  statementId: number,
  jobId: string,
): string | undefined {
  const p = s.people[personId];
  const statement = personalStatement(s, personId);
  if (!p || (personId === 'halil' && s.day < 3)) return 'This person has not visited yet.';
  if (!s.discoveries?.includes(personId) || statement?.id !== statementId)
    return 'Hear this personal account first.';
  // The just-spoken account permits an immediate answer without interrupting any activity.
  if (
    s.chapterPaused ||
    s.ended ||
    (s.now > statement.at && (p.activity || s.npcWork.some((w) => w.personId === personId)))
  )
    return 'This person is occupied or the conversation has ended.';
  if (
    s.now < statement.at ||
    s.now - statement.at > 30 ||
    Math.floor(s.now / 1440) !== Math.floor(statement.at / 1440)
  )
    return 'That conversation has ended. The account remains in your notes.';
  const job = s.jobs.find((j) => j.id === jobId);
  if (
    !job ||
    s.selectedJobId !== jobId ||
    !['active', 'ready', 'delivered'].includes(job.status) ||
    job.assignedTo ||
    (personId === 'sam'
      ? !job.evidence.some((e) => e.witnessedBy?.includes('sam'))
      : job.ownerId !== personId ||
        !job.evidence.some((e) => e.kind === 'inspection' || e.kind === 'use'))
  )
    return 'Select the object you actually shared with this person.';
  if (
    s.log.some(
      (e) => e.speaker === 'You' && e.text.startsWith(replyReceiptKey(personId, statementId)),
    )
  )
    return 'You already answered this account.';
  return undefined;
}

/** Object questions use only player observations. They never reveal the hidden component condition.
 * A limited replacement response concerns one part of one held object; biography is a separate topic.
 */
export function ownerQuestionEvidence(job: Job) {
  const revision = job.evidence.findLast((e) => e.kind === 'work')?.id ?? 0;
  return job.evidence.filter((e) => e.id > revision && e.actorId === 'player' && e.kind !== 'work');
}
export type OwnerQuestion = Extract<Command, { type: 'ask-owner-about-object' }>;
export function ownerQuestionBlock(s: GameState, q: OwnerQuestion): string | undefined {
  if (s.schema !== 'small-works@5' || !s.inputs || s.inputs.length >= 10000)
    return 'This question needs a current workshop with room for its recorded input.';
  const job = s.jobs.find((j) => j.id === q.jobId);
  const p = s.people[q.ownerId];
  if (
    !job ||
    job.id !== s.selectedJobId ||
    !['active', 'ready'].includes(job.status) ||
    job.isDonor ||
    job.isPersonal ||
    job.assignedTo ||
    job.ownerId !== q.ownerId ||
    !p
  )
    return 'Select an active object belonging to this owner.';
  const part = job.model.components.find((c) => c.id === q.componentId);
  if (!part || !job.inspected.includes(part.id) || q.intervention !== 'replace')
    return 'Inspect the selected part before proposing its replacement.';
  const evidence = ownerQuestionEvidence(job);
  if (
    q.evidenceText !== JSON.stringify(evidence) ||
    !q.evidenceIds.length ||
    new Set(q.evidenceIds).size !== q.evidenceIds.length ||
    q.evidenceIds.length !== evidence.length ||
    evidence.some((e, i) => q.evidenceIds[i] !== e.id) ||
    !evidence.some((e) => e.kind === 'inspection' && e.componentId === part.id) ||
    !evidence.some(
      (e) => e.kind === 'use' || (e.kind === 'measurement' && e.componentId === part.id),
    ) ||
    evidence.some((e) => e.at > s.now || s.now - e.at > 1440)
  )
    return 'Use the current inspected part and actual recent readings, after the last intervention.';
  if (
    s.ownerExchanges?.some((e) => e.jobId === q.jobId && e.componentId === q.componentId) ||
    (s.ownerExchanges?.length ?? 0) >= 100
  )
    return 'That finite question is already answered, or this chapter has no question space left.';
  const carried = admissionFacts(s.castChapter, q.ownerId);
  const activity = p.activity;
  const work = s.npcWork.find((w) => w.personId === q.ownerId);
  if (
    s.chapterPaused ||
    s.ended ||
    (q.ownerId === 'halil' && s.day < 3) ||
    (carried &&
      (!carried.availableForExtraWork ||
        (carried.life.place !== 'local-workplace' && s.now % 1440 < 600))) ||
    (activity && (activity.action !== 'personal' || !work || work.jobId)) ||
    (q.ownerId === 'sam' && (s.watching || s.pendingRequest)) ||
    p.agenda.commitments.some(
      (c) => c.status === 'pending' && c.from < s.now + 5 && c.until > s.now,
    )
  )
    return 'The owner is unavailable. Their current work or agreed plans come first.';
  if ((s.now % 1440) + 5 > 1020)
    return 'There is not enough workshop time for a five-minute question.';
  return undefined;
}
export function ownerReplacementProposal(job: Job, componentId: string): string {
  return `May I replace only the ${componentId} in ${job.title}, keeping every other original part? This is a proposal, not a diagnosis or a promise that it will work.`;
}
export function ownerReplacementResponse(
  job: Job,
  componentId: string,
  terms: 'one-part' | 'original-parts' | 'refused',
): string {
  if (terms === 'one-part')
    return `For ${job.title}, I agree only to replacing the ${componentId}. Keep every other original part. Check it afterwards; I have not agreed to any other replacement.`;
  if (terms === 'original-parts')
    return `For ${job.title}, keep the original ${componentId}. I do not agree to replacing it. You may put it aside or return it unfinished.`;
  return `For ${job.title}, I am not agreeing to replace the ${componentId}. I am keeping my plans. You may put it aside or return it unfinished.`;
}
