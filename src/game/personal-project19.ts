/** Reversible changes to the player's existing paper-street model. This owns
 * card, retained fronts, display comparison and a single neighbour occasion.
 * It never supplies a gear, repairs a drive, teaches HF a method or transfers
 * somebody else's property. A full circuit requires the actual repaired model. */
import type { StoryLine } from './story19';
import type { ActionView } from './types19';

export interface PersonalProjectState {
  originalFronts: 'on-model' | 'retained-envelope';
  fitted: 'remembered' | 'updated';
  cardSheets: number;
  insert: 'unmade' | 'retained' | 'fitted';
  support: 'unmade' | 'retained' | 'fitted';
  sleeve: 'unmade' | 'retained';
  measured: boolean;
  circuitChecked: boolean;
  checkedEdition?: 'remembered' | 'updated';
  lastComparison?: string;
  editionKept: boolean;
  custody: 'player' | 'nora';
  occasion:
    | 'unasked'
    | 'invited'
    | 'offered'
    | 'bench-agreed'
    | 'loan-agreed'
    | 'shown'
    | 'loaned'
    | 'returned'
    | 'declined';
  occasionMode?: 'stationary' | 'protected-carry';
  invitedAt?: number;
  returnAt?: number;
  returnInvited?: boolean;
  returnVisitAt?: number;
}
export interface PersonalProjectGame {
  now: number;
  operations?: { episode: number; personalProject?: PersonalProjectState };
}
export type PersonalProjectPresentation = Pick<
  PersonalProjectState,
  'fitted' | 'originalFronts' | 'insert' | 'support' | 'sleeve' | 'circuitChecked' | 'custody'
>;
export interface PersonalProjectContext {
  model?: { present: boolean; repaired: boolean; verified: boolean };
  originalFrontage?: 'preserved' | 'rebuilt';
  measuredBefore?: boolean;
  noraHere: boolean;
  noraCaseOutcome?: 'carry' | 'tray';
  chooseOccasion?: (
    personId: string,
    mode: 'stationary' | 'protected-carry',
    from: number,
    until: number,
  ) => boolean;
}
export interface PersonalProjectResult {
  lines: StoryLine[];
  minutes: number;
  playerWork?: true;
  personIds?: string[];
  visits?: { personId: string; at: number; activity: string }[];
  promise?: { ownerId: string; objectId: string; collectionAt: number };
  releaseCollectionId?: string;
  participantId?: string;
}
const line = (speaker: string, text: string): StoryLine => ({ speaker, text, tone: 'warm' });
const outcome = (text: string, minutes: number, physical = true): PersonalProjectResult => ({
  lines: [line('You', text)],
  minutes,
  ...(physical ? { playerWork: true as const } : {}),
});
export function freshPersonalProject(measured: boolean): PersonalProjectState {
  return {
    originalFronts: 'on-model',
    fitted: 'remembered',
    cardSheets: 2,
    insert: 'unmade',
    support: 'unmade',
    sleeve: 'unmade',
    measured,
    circuitChecked: false,
    editionKept: false,
    custody: 'player',
    occasion: 'unasked',
  };
}
export function personalProjectActions(
  s: PersonalProjectGame,
  ctx: PersonalProjectContext,
): ActionView[] {
  if (!s.operations || !ctx.model?.present) return [];
  const p = s.operations.personalProject;
  const actions: ActionView[] = [];
  const add = (id: string, label: string, detail: string) =>
    actions.push({ id: `operations-personal-${id}`, label, detail, intent: 'stay' });
  if (!p) {
    add(
      'open',
      'Lay out your paper street and its retained fronts',
      'Eight minutes to examine your actual model and the two spare packaging cards kept with its box. An unfinished drive stays unfinished.',
    );
    return actions;
  }
  if (p.custody === 'nora') {
    if (
      s.now >= (p.returnAt ?? Infinity) &&
      (!p.returnInvited || (!ctx.noraHere && s.now > (p.returnVisitAt ?? 0) + 60))
    )
      add(
        'arrange-return',
        'Arrange to receive your model back from Nora',
        'Ask Nora to bring the same model and protective sleeve back in twenty minutes. Until then it stays in her custody.',
      );
    if (p.returnInvited && ctx.noraHere)
      add(
        'receive-model',
        'Receive the same model back and repeat its circuit',
        'Twelve attended minutes: unwrap the retained fronts and sleeve, then run the existing drive. This checks the loaned display without replacing its gear.',
      );
    return actions;
  }
  if (!p.measured)
    add(
      'measure',
      'Measure the removable front slots and turning clearance',
      'Eight minutes comparing the existing paper fronts, base slots and clearance. The original drawings stay intact.',
    );
  if (p.measured && p.insert === 'unmade' && p.cardSheets > 0)
    add(
      'make-insert',
      'Draw and cut a removable frontage insert',
      'Twenty-five minutes, using one spare packaging card. Draw the street as it looks now; keep the original paper fronts uncut.',
    );
  if (p.insert === 'retained')
    add(
      'fit-updated',
      'Fit the new removable frontage',
      'Six minutes to lift the original fronts into their labelled envelope and fit the new card in the existing slots. The drive is left alone.',
    );
  if (p.fitted === 'updated')
    add(
      'fit-remembered',
      'Put the remembered street back on the model',
      'Six minutes. Refit the original fronts and retain the new insert flat for another occasion.',
    );
  if (p.measured && p.support === 'unmade' && p.cardSheets > 0)
    add(
      'make-support',
      'Fold a stable removable display support',
      'Fourteen minutes, using one spare card. A broad folded foot supports the base on a level table; it is not a carrying handle.',
    );
  if (p.support === 'retained')
    add(
      'fit-support',
      'Fit the removable table support',
      'Six minutes; seat the support under the base without altering the winding mechanism.',
    );
  if (ctx.model.repaired)
    add(
      'check-circuit',
      p.circuitChecked
        ? 'Repeat the full circuit with the selected street'
        : 'Compare a complete circuit with the selected street',
      'Twelve attended minutes: run the remembered fronts as a control, fit the selected version and run it through a complete circuit. Watch doors, clearance and table stability.',
    );
  if (p.circuitChecked && !p.editionKept)
    add(
      'keep-edition',
      `Keep the ${p.fitted === 'remembered' ? 'remembered' : 'updated'} street for now`,
      'Keep the checked choice and both sets of fronts. You can change your mind later.',
    );
  if (!p.editionKept)
    add(
      'put-aside',
      'Keep this model work labelled for later',
      'Retain everything you made without claiming a complete circuit or a repaired drive. The existing donor and measured-gear route remains available.',
    );
  if (p.sleeve === 'unmade' && p.cardSheets > 0 && p.measured)
    add(
      'make-sleeve',
      'Make a protective sleeve for the retained model box',
      'Fourteen minutes using one spare packaging card and the box’s retained cloth. The sleeve supports the base and keeps loose fronts flat; test the display again before offering a loan.',
    );
  if (s.operations.episode >= 2 && p.editionKept && p.occasion === 'unasked')
    add(
      'invite-nora',
      'Invite Nora to see your model for one sewing afternoon',
      'A visit in twenty minutes. Offer a single occasion rather than a permanent loan or a customer order.',
    );
  if (p.occasion === 'invited' && ctx.noraHere)
    add(
      'hear-occasion',
      'Hear where Nora could use the paper street',
      'Five minutes to discuss her stable cutting table and the particular afternoon. Nothing has left your bench.',
    );
  if (p.occasion === 'offered' && ctx.noraHere) {
    if (p.circuitChecked && ctx.model.repaired) {
      add(
        'agree-bench',
        'Offer the checked display on your stable bench',
        'Ask Nora to see it here for twenty minutes. Her stationary-tray history stays a reason to keep the display supported, rather than to invent a carrying case.',
      );
      if (p.sleeve === 'retained' && ctx.noraCaseOutcome !== 'tray')
        add(
          'agree-loan',
          'Offer a protected loan for this one afternoon',
          'Ask Nora to keep the complete model in its retained box and sleeve, use it on her level table, and return it after two hours. The model remains yours.',
        );
    }
    add(
      'decline-occasion',
      'Keep the model at home this afternoon',
      'Decline the occasion without losing the model, fronts, support or relationship.',
    );
  }
  if (p.occasion === 'bench-agreed' && ctx.noraHere)
    add(
      'show-bench',
      'Show Nora the complete circuit at your bench',
      'Twenty attended minutes together. The selected street and stable support stay here; no carrying result is claimed.',
    );
  if (p.occasion === 'loan-agreed' && ctx.noraHere)
    add(
      'loan-model',
      'Pack and hand over your model for the agreed afternoon',
      'Twenty attended minutes: secure the base in its own box, retain loose fronts in their envelope, attend the handover and keep the return time. Nora takes custody of this one model.',
    );
  return actions;
}
export function applyPersonalProjectAction(
  s: PersonalProjectGame,
  id: string,
  ctx: PersonalProjectContext,
): PersonalProjectResult | null {
  if (!personalProjectActions(s, ctx).some((a) => a.id === id) || !s.operations) return null;
  const key = id.slice('operations-personal-'.length);
  if (key === 'open') {
    s.operations.personalProject = freshPersonalProject(ctx.measuredBefore ?? false);
    return outcome(
      ctx.model?.repaired
        ? 'You bring the restored paper street into the light. Its original fronts lift from their slots without cutting; two spare packaging cards remain in its own box. The drive you repaired is still the same drive.'
        : 'You lay out the paper street, its original fronts and two spare packaging cards. The missing drive work remains on its own repair page; a removable front will not supply a gear.',
      8,
    );
  }
  const p = s.operations.personalProject;
  if (!p) return null;
  if (key === 'measure') {
    p.measured = true;
    return outcome(
      'You compare the removable front slots and clearance through the turning path. The original drawing edges and the enclosed spring remain untouched. These measurements belong with this model.',
      8,
    );
  }
  if (key === 'make-insert') {
    p.cardSheets--;
    p.insert = 'retained';
    return outcome(
      'You make a new removable card front: the small repair door, Nora’s changed shop window and the delivery gate as they are now. The remembered street remains intact beside it. One of the two spare cards is used.',
      25,
    );
  }
  if (key === 'fit-updated') {
    p.originalFronts = 'retained-envelope';
    p.fitted = 'updated';
    p.insert = 'fitted';
    p.circuitChecked = false;
    p.editionKept = false;
    return outcome(
      'The updated street seats in the existing slots. You put the original crooked windows and REPAIRS lettering into their labelled envelope. The winding drive has not been adjusted; this arrangement needs its own full-circuit comparison.',
      6,
    );
  }
  if (key === 'fit-remembered') {
    p.originalFronts = 'on-model';
    p.fitted = 'remembered';
    p.insert = 'retained';
    p.circuitChecked = false;
    p.editionKept = false;
    return outcome(
      'The remembered street is back in its slots. Your new frontage is retained flat in the same box. Both choices remain yours, and this fitted arrangement needs another circuit.',
      6,
    );
  }
  if (key === 'make-support') {
    p.cardSheets--;
    p.support = 'retained';
    return outcome(
      'You fold one spare card into a broad removable table support. It braces the display base on a level surface without touching the gear or claiming to hold the model during carrying.',
      14,
    );
  }
  if (key === 'fit-support') {
    p.support = 'fitted';
    p.circuitChecked = false;
    p.editionKept = false;
    return outcome(
      'The broad support seats beneath the base. The original drive and both sets of fronts remain intact. Test the complete circuit on this supported arrangement.',
      6,
    );
  }
  if (key === 'check-circuit') {
    p.circuitChecked = true;
    p.checkedEdition = p.fitted;
    p.lastComparison =
      p.fitted === 'updated'
        ? 'The remembered fronts clear the turning path. The updated insert also completes the circuit: its new gate opens in order and no card rubs the base.'
        : 'The remembered street completes its circuit with every shutter opening in order. The original paper edges clear the base; the unselected insert stays retained.';
    return outcome(
      `${p.lastComparison} ${p.support === 'fitted' ? 'The fitted broad support keeps the base still on the level table.' : 'The level bench keeps the original base still; no carrying test is claimed.'}`,
      12,
    );
  }
  if (key === 'keep-edition') {
    p.editionKept = true;
    return outcome(
      `You keep the ${p.fitted === 'remembered' ? 'remembered' : 'updated'} street fitted for now and label the other fronts in the model box. A complete circuit stands behind this choice.`,
      2,
      false,
    );
  }
  if (key === 'put-aside') {
    p.editionKept = true;
    return outcome(
      'You put your model work aside with its original fronts and any new pieces retained. The unfinished checks and drive work stay written down, ready to return to.',
      3,
    );
  }
  if (key === 'make-sleeve') {
    p.cardSheets--;
    p.sleeve = 'retained';
    return outcome(
      'You make a removable sleeve for the model’s own box using one spare card and its retained cloth. It holds the base square and gives loose fronts an envelope; the stationary table support is not used as a handle.',
      14,
    );
  }
  if (key === 'invite-nora') {
    p.occasion = 'invited';
    p.invitedAt = s.now + 20;
    return {
      ...outcome(
        'You invite Nora to discuss showing the paper street for one sewing afternoon. Your model and its fronts remain at home.',
        3,
        false,
      ),
      personIds: ['nora'],
      visits: [
        { personId: 'nora', at: p.invitedAt, activity: 'Discussing one paper-street occasion' },
      ],
    };
  }
  if (key === 'hear-occasion') {
    p.occasion = 'offered';
    return {
      lines: [
        line(
          'Nora',
          ctx.noraCaseOutcome === 'tray'
            ? 'The sample tray stays on the stable table now. I would like to see the little street here, beside it, without turning that tray into a carrying case.'
            : 'I have a level place beside the sewing table for one afternoon. I could bring your little street back in its own box afterwards, if you want to lend it.',
        ),
        line('You', 'You have not promised a loan. Keeping it at home is still an option.'),
      ],
      minutes: 5,
      participantId: 'nora',
    };
  }
  if (key === 'agree-bench' || key === 'agree-loan') {
    const mode = key === 'agree-bench' ? 'stationary' : 'protected-carry';
    const until = s.now + (mode === 'stationary' ? 20 : 140);
    if (!ctx.chooseOccasion?.('nora', mode, s.now, until))
      return {
        lines: [
          line(
            'Nora',
            'I cannot take that time now. Keep the model with you; another afternoon is possible.',
          ),
        ],
        minutes: 2,
      };
    p.occasion = mode === 'stationary' ? 'bench-agreed' : 'loan-agreed';
    p.occasionMode = mode;
    return {
      lines: [
        line(
          'Nora',
          mode === 'stationary'
            ? 'I agree to see the full circuit here, with the base on this stable bench.'
            : 'I agree to the single afternoon, on my level sewing table, with the model in its own protective box for carrying. I will return the same model and retained fronts.',
        ),
      ],
      minutes: 3,
      participantId: 'nora',
    };
  }
  if (key === 'decline-occasion') {
    p.occasion = 'declined';
    return outcome(
      'You keep the paper street at home this afternoon. Nora keeps her own plans; both versions of your street remain in their labelled box.',
      2,
      false,
    );
  }
  if (key === 'show-bench') {
    p.occasion = 'shown';
    return {
      lines: [
        line(
          'You',
          `You run the ${p.fitted === 'updated' ? 'updated' : 'remembered'} street through its complete circuit beside Nora on the stable bench.`,
        ),
        line(
          'Nora',
          p.fitted === 'updated'
            ? 'That is the smaller gate we use now. You kept the old fronts too; I remember when the drawing had room for a whole delivery yard.'
            : 'There are the wide shop windows from your old drawing. Keeping it like that is a choice too. It is lovely to see the shutters open again.',
        ),
      ],
      minutes: 20,
      playerWork: true,
      participantId: 'nora',
    };
  }
  if (key === 'loan-model') {
    p.custody = 'nora';
    p.occasion = 'loaned';
    p.returnAt = s.now + 140;
    return {
      ...outcome(
        'You secure the base in its retained box and sleeve, keep unselected fronts flat in their envelope, and attend the handover. Nora takes this same model for the one agreed afternoon. Your bench no longer holds it until she returns it.',
        20,
      ),
      participantId: 'nora',
    };
  }
  if (key === 'arrange-return') {
    p.returnInvited = true;
    p.returnVisitAt = s.now + 20;
    return {
      ...outcome(
        'You ask Nora to bring back the same paper street, its sleeve and all retained fronts. They remain in her custody until the actual handover.',
        3,
        false,
      ),
      personIds: ['nora'],
      visits: [{ personId: 'nora', at: s.now + 20, activity: 'Returning the loaned paper street' }],
    };
  }
  if (key === 'receive-model') {
    p.custody = 'player';
    p.occasion = 'returned';
    p.returnInvited = false;
    return {
      ...outcome(
        `You receive the same model, original fronts and sleeve, unwrap them and attend a complete circuit. The ${p.fitted === 'updated' ? 'updated' : 'remembered'} street still clears the base. Nora tells you where it stood on her level table; the loan is complete.`,
        12,
      ),
      participantId: 'nora',
    };
  }
  return null;
}
export function personalProjectAway(s: PersonalProjectGame): boolean {
  return s.operations?.personalProject?.custody === 'nora';
}
export function getPersonalProjectView(s: PersonalProjectGame) {
  const p = s.operations?.personalProject;
  if (!p) return undefined;
  return {
    fitted: p.fitted,
    originalFronts: p.originalFronts,
    insert: p.insert,
    support: p.support,
    sleeve: p.sleeve,
    circuitChecked: p.circuitChecked,
    comparison: p.lastComparison,
    cardSheets: p.cardSheets,
    custody: p.custody,
    occasion: p.occasion,
    returnAt: p.returnAt,
    editionKept: p.editionKept,
  };
}
export function personalProjectPresentation(
  s: PersonalProjectGame,
): PersonalProjectPresentation | undefined {
  const p = s.operations?.personalProject;
  return p
    ? {
        fitted: p.fitted,
        originalFronts: p.originalFronts,
        insert: p.insert,
        support: p.support,
        sleeve: p.sleeve,
        circuitChecked: p.circuitChecked,
        custody: p.custody,
      }
    : undefined;
}
