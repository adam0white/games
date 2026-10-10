/** One optional post-week request. Owns received invitations and agreed uses;
 * objects own physical hardware, HF actors own willingness and elapsed work.
 * No world explanation, automatic competence, payment or public advertising. */
import type { CaseFittings } from './repairs16';
import type { StoryLine } from './story16';
import type { ActionView, RepairObject } from './types18';
import type { WorkshopJobSpec } from './workshop16';

export interface NeighbourhoodState {
  noraPurposeId?: string;
  conservationPurposeId?: string;
  playerPurposeId?: string;
  introduced: boolean;
  frontage: 'unasked' | 'invited' | 'visited' | 'declined';
  frontageObservations: string[];
  sourceCompared: boolean;
  caseStage: 'unheard' | 'offered' | 'accepted' | 'declined' | 'returned';
  requestedUse: 'carry-samples';
  useConsent: 'original' | 'stationary-tray';
  outcome?: 'original-checked' | 'adapted-checked' | 'unchanged';
  lamp: 'unheard' | 'offered' | 'accepted' | 'declined';
}
export interface NeighbourhoodGame {
  now: number;
  neighbourhood?: NeighbourhoodState;
}
export interface NeighbourhoodContext {
  weekConcluded: boolean;
  noraHere: boolean;
  model?: RepairObject;
  caseObject?: RepairObject;
  fittings?: CaseFittings;
  drawingsShared: boolean;
  /** This callback asks an actual HF choice, without modifying its utilities. */
  agree: (purpose: 'frontage' | 'tray' | 'source') => boolean;
  /** Known continuous availability of both participants, including travel. */
  frontageAvailable: boolean;
  compatibleSourceKnown: boolean;
}
export interface NeighbourhoodResult {
  lines: StoryLine[];
  minutes: number;
  personIds?: string[];
  visitFrontage?: true;
  receiveCase?: true;
  sourceFitting?: { source: string; spacing: 24; permission: true };
  adaptTray?: true;
  returnCase?: 'original-checked' | 'adapted-checked' | 'unchanged';
  job?: WorkshopJobSpec;
}
const line = (speaker: string, text: string): StoryLine => ({ speaker, text, tone: 'warm' });
export function freshNeighbourhood(): NeighbourhoodState {
  return {
    introduced: false,
    frontage: 'unasked',
    frontageObservations: [],
    sourceCompared: false,
    caseStage: 'unheard',
    requestedUse: 'carry-samples',
    useConsent: 'original',
    lamp: 'unheard',
  };
}
export const neighbourhoodCase = {
  id: 'nora-sample-case',
  ownerId: 'nora',
  owner: 'Nora',
  title: 'Nora’s shop-counter sample case',
  form: 'box',
  fault: 'worn-catch',
  appearance: 'box',
  story:
    'A shallow old shop-counter case with divided sample compartments and handwritten fabric labels. A faded service label remains beside its worn brass-coloured catch. Nora keeps the replacement marked INTERCHANGEABLE in the narrow hardware pocket.',
  inspectText:
    'The catch is worn where it grips. The existing mounting holes and the labelled replacement can be compared without drilling or discarding anything.',
} as const;
export const neighbourhoodLight: WorkshopJobSpec = {
  id: 'workshop-neighbourhood-nora-light',
  ownerId: 'nora',
  owner: 'Nora',
  title: 'Nora’s sample-shelf light',
  story:
    'A battery light from Nora’s household sample shelf, with a sample label taped to its base. Nora has brought a compatible replacement battery.',
  fault: 'battery',
  appearance: 'reading',
  materialsBatteryProvided: true,
  collectionPlan: 'afternoon',
};
export function modelMemoryLines(
  model: RepairObject | undefined,
  drawingsShared: boolean,
): StoryLine[] {
  if (!model?.discovered)
    return [
      line(
        'Nora',
        'I remember one shop window with samples laid in shallow boxes. I cannot remember every front along the street.',
      ),
    ];
  const condition = model.verified
    ? 'The checked paper street carries its little shutters past Nora one by one.'
    : model.repaired
      ? 'The gear is fitted, but the model still needs its longer check. Its paper windows stand still beside Nora’s hand.'
      : 'The unfinished paper street sits with its drive slot empty. Nora leans over the low paper window.';
  return [
    line('You', condition),
    line(
      'Nora',
      'That low window reminds me of the sewing samples. I remember that window, not the whole street.',
    ),
    ...(!drawingsShared
      ? [
          line(
            'You',
            'The childhood drawing pages remain put away in their box. You show Nora the paper fronts.',
          ),
        ]
      : []),
  ];
}
export function neighbourhoodActions(s: NeighbourhoodGame, c: NeighbourhoodContext): ActionView[] {
  if (!c.weekConcluded) return [];
  const n = s.neighbourhood ?? freshNeighbourhood();
  if (!c.noraHere) return [];
  const actions: ActionView[] = [];
  const add = (id: string, label: string, detail?: string) =>
    actions.push({ id, label, detail, kind: 'quiet' });
  if (!n.introduced) add('neighbourhood-remember', 'Ask Nora about the old sample window');
  if (n.introduced && n.frontage === 'unasked') {
    add(
      'neighbourhood-frontage',
      'Suggest looking at the old frontage together',
      'A half-hour walk there and back, if you both have time.',
    );
    add('neighbourhood-no-visit', 'Keep the recollection at the bench');
  }
  if (n.introduced && n.caseStage === 'unheard')
    add('neighbourhood-hear-case', 'Hear what Nora wants from her sample case');
  if (n.caseStage === 'offered') {
    add('neighbourhood-accept-case', 'Take a look at the case');
    add('neighbourhood-decline-case', 'Leave the case with Nora');
  }
  if (n.caseStage === 'accepted') {
    if (c.fittings?.measured && !n.sourceCompared)
      add(
        'neighbourhood-compare-source',
        'Ask Nora to compare her retained counter catch',
        'Compare its mounting holes with the case.',
      );
    if (
      c.fittings?.measured &&
      (n.sourceCompared || c.compatibleSourceKnown) &&
      !c.fittings.compatible
    )
      add(
        'neighbourhood-source',
        'Ask to use Nora’s retained old-counter catch',
        'The measured holes match the case.',
      );
    if (n.useConsent === 'original')
      add(
        'neighbourhood-tray-consent',
        'Propose a stationary sample tray instead',
        'Leave the samples open on the counter, rather than carrying them in the case.',
      );
    if (c.caseObject?.verified && c.fittings?.repeatedClosures)
      add('neighbourhood-return-repaired', 'Return the checked carrying case');
    if (c.fittings?.trayChecked && n.useConsent === 'stationary-tray')
      add('neighbourhood-return-tray', 'Return the checked stationary sample tray');
    if (!c.caseObject?.verified && !c.fittings?.revisedUse)
      add(
        'neighbourhood-return-unchanged',
        'Restore and return the case unchanged with its fittings',
      );
  }
  if (['accepted', 'returned'].includes(n.caseStage) && n.lamp === 'unheard')
    add('neighbourhood-hear-light', 'Hear Nora’s separate household-light request');
  if (n.lamp === 'offered') {
    add('neighbourhood-accept-light', 'Agree the separate light and its collection');
    add('neighbourhood-decline-light', 'Leave the light for another time');
  }
  return actions;
}
export function applyNeighbourhoodAction(
  s: NeighbourhoodGame,
  id: string,
  c: NeighbourhoodContext,
): NeighbourhoodResult | null {
  if (!neighbourhoodActions(s, c).some((a) => a.id === id)) return null;
  s.neighbourhood ??= freshNeighbourhood();
  const n = s.neighbourhood;
  const result = (lines: StoryLine[], minutes = 3): NeighbourhoodResult => ({ lines, minutes });
  if (id === 'neighbourhood-remember') {
    n.introduced = true;
    return result(modelMemoryLines(c.model, c.drawingsShared));
  }
  if (id === 'neighbourhood-frontage') {
    if (!c.frontageAvailable || !c.agree('frontage'))
      return result([line('Nora', 'I cannot manage the walk just now. We can stay here.')], 0);
    n.frontage = 'visited';
    n.frontageObservations = [
      'A low window remains beside a wider boarded front.',
      'The former sample counter can no longer be seen through the glass.',
    ];
    return {
      ...result(
        [
          line('You', n.frontageObservations.join(' ')),
          line('Nora', 'There it is. The samples used to sit just behind that lower pane.'),
        ],
        30,
      ),
      personIds: ['player', 'nora'],
      visitFrontage: true,
    };
  }
  if (id === 'neighbourhood-no-visit') {
    n.frontage = 'declined';
    return result([line('Nora', 'We can leave the walk. I brought the case to show you anyway.')]);
  }
  if (id === 'neighbourhood-hear-case') {
    n.caseStage = 'offered';
    return result([
      line(
        'Nora',
        'This held samples on the old counter. I want them to stay together when I carry it. The catch slips, and this replacement says interchangeable. I brought the fittings I saved from the counter too, in case they help. Would you have a look?',
      ),
    ]);
  }
  if (id === 'neighbourhood-accept-case') {
    n.caseStage = 'accepted';
    return {
      ...result([
        line(
          'Nora',
          'Keep the little labels with their samples, please. And the old fittings—I still use some of them.',
        ),
      ]),
      receiveCase: true,
    };
  }
  if (id === 'neighbourhood-decline-case') {
    n.caseStage = 'declined';
    n.outcome = 'unchanged';
    return result([line('Nora', 'All right. I will keep them together at home for now.')]);
  }
  if (id === 'neighbourhood-compare-source') {
    n.sourceCompared = true;
    return result(
      [
        line(
          'Nora',
          'I saved this loose catch when the sample counter was taken apart. That is why I brought the old fittings. You lay it beside the case: both sets of holes are 24 mm apart.',
        ),
      ],
      5,
    );
  }
  if (id === 'neighbourhood-source') {
    if (!c.agree('source'))
      return result([line('Nora', 'I would rather keep that one as a spare for now.')], 0);
    return {
      ...result(
        [
          line(
            'Nora',
            'Yes, use that catch here. Keep the worn one and the labelled replacement together for me.',
          ),
        ],
        5,
      ),
      sourceFitting: { source: 'Nora’s retained old-counter catch', spacing: 24, permission: true },
    };
  }
  if (id === 'neighbourhood-tray-consent') {
    if (!c.agree('tray'))
      return result(
        [
          line(
            'Nora',
            'I still need to carry the samples. Leave the case as it is if you cannot do that.',
          ),
        ],
        0,
      );
    n.useConsent = 'stationary-tray';
    return {
      ...result([
        line(
          'Nora',
          'A tray on my counter would be useful. Let us do that instead. Keep the lid and fittings with it. I will need something else when I carry the samples.',
        ),
      ]),
      adaptTray: true,
    };
  }
  if (id.startsWith('neighbourhood-return-')) {
    const outcome =
      id === 'neighbourhood-return-repaired'
        ? 'original-checked'
        : id === 'neighbourhood-return-tray'
          ? 'adapted-checked'
          : 'unchanged';
    n.caseStage = 'returned';
    n.outcome = outcome;
    return {
      ...result([
        line(
          'Nora',
          outcome === 'original-checked'
            ? 'I can take the samples round to Mum again without gathering them off the path. I will keep the spare fittings in their pocket.'
            : outcome === 'adapted-checked'
              ? 'I will leave this on the counter, where I can see the colours together. The catch still cannot hold it shut for carrying; I will take a few samples in a separate bag.'
              : 'I will keep it flat at home for now. The catch is still worn. Thank you for leaving the samples and fittings together.',
        ),
      ]),
      returnCase: outcome,
    };
  }
  if (id === 'neighbourhood-hear-light') {
    n.lamp = 'offered';
    return result([
      line(
        'Nora',
        'The battery light on my sample shelf has faded too. I brought its matching battery. Could that be another job, if there is room?',
      ),
    ]);
  }
  if (id === 'neighbourhood-accept-light') {
    n.lamp = 'accepted';
    return {
      ...result([
        line(
          'Nora',
          'Here is the light and its battery. I will leave the sample labels on the base.',
        ),
      ]),
      job: neighbourhoodLight,
    };
  }
  if (id === 'neighbourhood-decline-light') {
    n.lamp = 'declined';
    return result([line('Nora', 'I can leave that for another afternoon.')]);
  }
  return null;
}
