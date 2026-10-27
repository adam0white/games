import type { GameState } from './types';
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
