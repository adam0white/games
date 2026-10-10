/**
 * Finite household and workshop continuations. The host owns cabinet stages,
 * quotes, customer payments and a conserved cash ledger. People's willingness,
 * learning and independent repair decisions belong to HF and are supplied by
 * the engine. A paid agreement never grants a learned method or starts a job.
 * There is no market simulation, debt, business growth rate or idle income.
 */
import type { StoryLine } from './story';
import type { ActionView, Fault, GameState } from './types';

export interface WorkshopJobSpec {
  id: string;
  ownerId: string;
  owner: string;
  title: string;
  story: string;
  fault: Fault;
  appearance: 'kitchen' | 'reading' | 'bedside' | 'timer';
  form?: 'lamp' | 'timer';
  inspectText?: string;
  collectionPlan?: 'evening' | 'morning' | 'afternoon';
  materialsBatteryProvided: boolean;
}
export interface WorkshopJob {
  id: string;
  stage: 'offered' | 'quoted' | 'accepted' | 'complete' | 'declined';
  fee: number;
  materialCost: number;
  acceptedAt?: number;
  collectedAt?: number;
  independent?: boolean;
  due: 'this-evening' | 'tomorrow';
  collectionAt: number;
  samFee: number;
}
export interface LedgerEntry {
  id: string;
  at: number;
  amount: number;
  kind: 'materials-advance' | 'materials' | 'repair-fee' | 'sam-pay' | 'checking-place';
  jobId: string;
}
export interface WorkshopState {
  mode: 'undecided' | 'favours' | 'priced';
  intakeSpace: boolean;
  referralAt?: number;
  nextBatch: 'locked' | 'offered' | 'permitted' | 'declined';
  nextReferralAt?: number;
  referral: 'unasked' | 'offered' | 'permitted' | 'declined';
  paidHelp: boolean;
  cabinet: 'unnoticed' | 'looked' | 'measured' | 'hung' | 'finished';
  cabinetAppointment?: {
    task: 'measure' | 'hang' | 'align';
    at: number;
    until: number;
    dadId: string;
    playerId: string;
    status: 'planned' | 'kept' | 'cancelled' | 'missed';
  };
  drawingFound: boolean;
  drawingChoice: 'undecided' | 'displayed' | 'kept';
  projectOpen: boolean;
  jobs: WorkshopJob[];
  cash: number;
  ledger: LedgerEntry[];
}
export type WorkshopGame = Pick<
  GameState,
  'now' | 'chapter' | 'focusId' | 'objects' | 'unlocked' | 'parts'
> & {
  workshop?: WorkshopState;
};
export const CABINET_MINUTES = { measure: 20, hang: 40, align: 25, space: 8 } as const;
export interface WorkshopContext {
  graduated: boolean;
  independentRepair: boolean;
  paidHelpEligible: boolean;
  dadHere: boolean;
  noraHere: boolean;
  samHere: boolean;
  leilaHere?: boolean;
  ownerHere?: (id: string) => boolean;
  samWillAgree?: () => boolean;
  dadAgreesTime?: (task: 'measure' | 'hang' | 'align') => boolean;
  dadWorkReason?: () => string;
  dadWillWork?: (task: 'measure' | 'hang' | 'align' | 'space') => boolean;
}
export interface WorkshopResult {
  lines: StoryLine[];
  minutes: number;
  cabinetTime?: { task: 'measure' | 'hang' | 'align'; at: number; until: number };
  cancelCabinetTime?: boolean;
  job?: WorkshopJobSpec;
  personIds?: string[];
  visits?: { personId: string; at: number; activity: string }[];
}
const line = (speaker: string, text: string, tone: StoryLine['tone'] = 'warm'): StoryLine => ({
  speaker,
  text,
  tone,
});
export function freshWorkshop(): WorkshopState {
  return {
    mode: 'undecided',
    intakeSpace: false,
    nextBatch: 'locked',
    referral: 'unasked',
    paidHelp: false,
    cabinet: 'unnoticed',
    drawingFound: false,
    drawingChoice: 'undecided',
    projectOpen: false,
    jobs: [],
    cash: 0,
    ledger: [],
  };
}
function state(s: WorkshopGame): WorkshopState {
  s.workshop ??= freshWorkshop();
  return s.workshop;
}
const money = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;
export const workshopJobSpecs: readonly WorkshopJobSpec[] = [
  {
    id: 'workshop-leila',
    ownerId: 'leila',
    owner: 'Leila',
    title: 'Leila’s porch lamp',
    story:
      'Leila uses this lamp to see the porch latch without putting on the hall light. Nora introduced you before she left it here.',
    fault: 'battery',
    appearance: 'reading',
    materialsBatteryProvided: true,
  },
  {
    id: 'workshop-nora',
    ownerId: 'nora',
    owner: 'Nora',
    title: 'Nora’s sewing lamp',
    story:
      'This one sits beside Nora’s sewing machine. She wants a quiet morning to finish a pair of curtains, rather than another trip out today.',
    fault: 'contact',
    appearance: 'kitchen',
    materialsBatteryProvided: false,
  },
  {
    id: 'workshop-leila-landing',
    ownerId: 'leila',
    owner: 'Leila',
    title: 'Leila’s landing lamp',
    story:
      'A small ceramic lamp on Leila’s landing. She wants enough light to see the top stair without lighting the bedrooms.',
    fault: 'battery',
    appearance: 'bedside',
    materialsBatteryProvided: true,
    collectionPlan: 'evening',
  },
  {
    id: 'workshop-nora-stairs',
    ownerId: 'nora',
    owner: 'Nora',
    title: 'Nora’s stair light',
    story:
      'Nora keeps this small light by the lower stair. Its handle has a little fabric wrapped around it so she can move it quietly.',
    fault: 'contact',
    appearance: 'kitchen',
    materialsBatteryProvided: false,
    collectionPlan: 'morning',
  },
  {
    id: 'workshop-evan',
    ownerId: 'evan',
    owner: 'Evan',
    title: 'Evan’s folding work light',
    story:
      'Evan uses this folding light to find small things that roll under his bench. The shade is dented; he wants the light reliable, not made to look new.',
    fault: 'battery',
    appearance: 'reading',
    materialsBatteryProvided: true,
    collectionPlan: 'afternoon',
  },
  {
    id: 'workshop-evan-timer',
    ownerId: 'evan',
    owner: 'Evan',
    title: 'Evan’s winding timer',
    story:
      'Evan brought a mechanical timer as well. He would rather know whether you can help than have somebody wind it harder and break what remains.',
    fault: 'gear',
    appearance: 'timer',
    form: 'timer',
    inspectText:
      'Behind the external inspection flap, a gear is missing from the timer train. The winding key turns without driving the dial. None of the parts in this tray match it.',
    materialsBatteryProvided: false,
    collectionPlan: 'afternoon',
  },
];
function carefulFriendReturn(s: WorkshopGame) {
  return s.objects.some((o) => o.owner === 'Nora' && o.location === 'returned' && o.verified);
}
export function workshopActions(s: WorkshopGame, ctx: WorkshopContext): ActionView[] {
  if (s.chapter !== 'garage') return [];
  const w = s.workshop ?? freshWorkshop();
  const actions: ActionView[] = [];
  const add = (id: string, label: string, detail?: string, intent: ActionView['intent'] = 'stay') =>
    actions.push({ id, label, detail, intent });
  if (w.cabinet === 'unnoticed')
    add(
      'workshop-cabinet-look',
      'Look at Dad’s cabinet doors',
      'The kitchen cabinet still works without them.',
    );
  else if (!w.projectOpen)
    add(
      'workshop-cabinet-open',
      'Return to the cabinet doors',
      'A family project that can wait between repairs.',
    );
  if (w.projectOpen && ctx.dadHere) {
    if (['looked', 'measured', 'hung'].includes(w.cabinet))
      add(
        'workshop-cabinet-plan',
        ['planned', 'missed'].includes(w.cabinetAppointment?.status ?? '')
          ? 'Ask Dad to rearrange the cabinet time'
          : 'Ask Dad to arrange a cabinet time',
        'Tomorrow at 15:45, if he agrees. The next step still needs both of you.',
      );
    if (w.cabinet === 'looked')
      add(
        'workshop-cabinet-measure',
        'Ask Dad to measure the hinges together',
        'Twenty minutes, if he wants to work on it now.',
      );
    if (w.cabinet === 'measured')
      add(
        'workshop-cabinet-hang',
        'Ask Dad to hang the cabinet doors with you',
        'Forty minutes together. His vice stays clear for this work.',
      );
    if (w.cabinet === 'hung')
      add(
        'workshop-cabinet-align',
        'Ask Dad to align the doors together',
        'A final twenty-five minutes; then try how they close.',
      );
    if (w.cabinet === 'finished' && !w.drawingFound)
      add(
        'workshop-drawings',
        'Bring down the saved drawing box',
        'Mum kept your old drawings in a flat box.',
      );
  }
  if (w.cabinetAppointment?.status === 'planned')
    add(
      'workshop-cabinet-cancel',
      'Cancel the saved cabinet time',
      'Leave Dad a clear note; the doors can wait.',
    );
  if (w.projectOpen) {
    if (w.drawingFound && (w.drawingChoice ?? 'undecided') === 'undecided') {
      add('workshop-display-drawing', 'Put the drawing beside the finished cabinet');
      add('workshop-keep-drawing', 'Keep the drawing in the flat box');
    }
    add(
      'workshop-cabinet-close',
      w.cabinet === 'finished' ? 'Back to the bench' : 'Leave the cabinet safely for now',
      undefined,
      'pause',
    );
  }
  if (!ctx.graduated) return actions;
  if (w.referral === 'unasked' && carefulFriendReturn(s) && ctx.noraHere)
    add(
      'workshop-referral-ask',
      'Talk with Nora about one referral',
      'She will ask before sharing your name.',
    );
  if (w.referral === 'offered' && ctx.noraHere) {
    add(
      'workshop-favours',
      'Keep it to occasional favours',
      'One introduction is welcome; regular work is not agreed.',
    );
    add(
      'workshop-priced',
      'Agree a modest priced repair',
      'Discuss space and a clear quote before accepting anything.',
    );
    add(
      'workshop-no-referral',
      'Keep the introductions small for now',
      'Nora will not pass your name on.',
      'pause',
    );
  }
  if (w.referral === 'permitted' && !w.intakeSpace && ctx.dadHere)
    add(
      'workshop-intake-space',
      'Agree a labelled intake corner with Dad',
      'His vice and the rest of his work still belong here.',
    );
  if (
    w.referral === 'permitted' &&
    w.intakeSpace &&
    !w.jobs.some((j) => j.id === 'workshop-leila') &&
    s.now >= (w.referralAt ?? Infinity) &&
    ctx.leilaHere
  )
    add(
      'workshop-leila-arrival',
      'Meet Leila and hear about her lamp',
      'Nora has arranged the introduction.',
    );
  if (
    ctx.independentRepair &&
    w.intakeSpace &&
    !w.jobs.some((j) => j.id === 'workshop-nora') &&
    ctx.noraHere
  )
    add(
      'workshop-nora-arrival',
      'Hear Nora’s next request',
      'Her sewing lamp can wait for tomorrow; she would like a quiet morning.',
    );
  const originalsComplete = ['workshop-leila', 'workshop-nora'].every((id) =>
    w.jobs.some((job) => job.id === id && job.stage === 'complete'),
  );
  if (originalsComplete && (w.nextBatch ?? 'locked') === 'locked' && ctx.leilaHere)
    add(
      'workshop-next-batch',
      'Talk with Leila about the next small repairs',
      'There is room to decide what to take, and what to leave.',
    );
  if (w.nextBatch === 'offered' && ctx.leilaHere) {
    add(
      'workshop-next-referral-yes',
      'Agree one introduction to Evan',
      'He can bring a folding light. More than that needs a separate conversation.',
    );
    add(
      'workshop-next-referral-no',
      'Keep this batch between people you know',
      'Leila’s and Nora’s requests can still be considered.',
      'pause',
    );
  }
  if (originalsComplete && !w.jobs.some((job) => job.id === 'workshop-nora-stairs') && ctx.noraHere)
    add(
      'workshop-nora-stairs-arrival',
      'Hear about Nora’s stair light',
      'A light by the lower stair, with its own collection plan.',
    );
  const evanHere = ctx.ownerHere?.('evan') ?? false;
  if (
    w.nextBatch === 'permitted' &&
    s.now >= (w.nextReferralAt ?? Infinity) &&
    evanHere &&
    !w.jobs.some((job) => job.id === 'workshop-evan')
  )
    add(
      'workshop-evan-arrival',
      'Meet Evan and hear about his folding light',
      'Leila arranged this visit, and he is here now.',
    );
  if (
    w.jobs.some((job) => job.id === 'workshop-evan' && job.stage === 'complete') &&
    !w.jobs.some((job) => job.id === 'workshop-evan-timer') &&
    evanHere
  )
    add(
      'workshop-evan-timer-arrival',
      'Ask about Evan’s winding timer',
      'He has brought a different kind of mechanism. You can be clear about your limits.',
    );
  for (const job of w.jobs) {
    const spec = workshopJobSpecs.find((x) => x.id === job.id);
    if (!spec) continue;
    const ownerHere =
      ctx.ownerHere?.(spec.ownerId) ??
      (spec.ownerId === 'leila' ? ctx.leilaHere : spec.ownerId === 'nora' ? ctx.noraHere : false);
    if (!ownerHere) continue;
    if (job.stage === 'accepted' && s.now >= job.collectionAt)
      add(
        `workshop-delay-${spec.id.slice(9)}`,
        `Tell ${spec.owner} the repair needs another day`,
        'Keep the work safely labelled; say what is still unchecked.',
        'pause',
      );
    const object = s.objects.find((item) => item.id === job.id);
    if (
      spec.fault === 'gear' &&
      job.stage === 'accepted' &&
      object?.inspected &&
      object.assignedTo !== 'sam'
    )
      add(
        `workshop-return-unfixed-${spec.id.slice(9)}`,
        `Return ${spec.title} with an honest explanation`,
        'The missing gear is outside the parts and methods available here. No repair fee or wage.',
        'leave',
      );
    if (job.stage === 'offered')
      add(
        `workshop-quote-${spec.id.slice(9)}`,
        `Discuss ${spec.title}`,
        w.mode === 'priced'
          ? 'Agree the price and collection plan before accepting.'
          : 'Be clear about what you can offer without a deadline.',
      );
    if (job.stage === 'quoted' && !s.focusId) {
      add(
        `workshop-accept-${spec.id.slice(9)}`,
        `Accept ${spec.title}`,
        spec.fault === 'gear'
          ? 'An inspection only. No repair promised and no fee.'
          : w.mode === 'priced'
            ? `${money(job.fee)} work${job.materialCost ? `, ${money(job.materialCost)} battery money in advance` : ''}. ${job.due === 'this-evening' ? 'Aim for this evening, and tell her if it needs longer.' : 'Collection tomorrow; no need to crowd today.'}`
            : 'A favour, with no fee or promised rush.',
      );
      add(
        `workshop-decline-${spec.id.slice(9)}`,
        `Tell ${spec.owner} there is no room today`,
        'Nothing is charged; the object stays with its owner.',
        'pause',
      );
    }
    if (job.stage === 'quoted' && s.focusId)
      add(
        `workshop-defer-${spec.id.slice(9)}`,
        `Leave ${spec.owner}’s offer open`,
        'Put the current object safely aside before accepting another.',
        'pause',
      );
  }
  if (ctx.paidHelpEligible && !w.paidHelp && ctx.samHere && w.mode === 'priced')
    add(
      'workshop-sam-agreement',
      'Discuss paid repair work with Sam',
      '£3 for each agreed job he completes independently, paid from its repair fee.',
    );
  return actions;
}
function offer(s: WorkshopGame, w: WorkshopState, id: string) {
  if (w.jobs.some((job) => job.id === id)) return;
  const spec = workshopJobSpecs.find((job) => job.id === id);
  if (!spec) return;
  const base = Math.floor(s.now / 1440) * 1440;
  const collectionAt =
    spec.collectionPlan === 'afternoon'
      ? base + 1440 + 15 * 60
      : spec.collectionPlan === 'morning'
        ? base + 1440 + 10 * 60
        : s.now % 1440 < 17 * 60
          ? base + 18 * 60
          : base + 1440 + 18 * 60;
  w.jobs.push({
    id,
    stage: 'offered',
    fee: w.mode === 'priced' && spec.fault !== 'gear' ? 800 : 0,
    materialCost: w.mode === 'priced' && spec.materialsBatteryProvided ? 200 : 0,
    due: Math.floor(collectionAt / 1440) === Math.floor(s.now / 1440) ? 'this-evening' : 'tomorrow',
    collectionAt,
    samFee: 0,
  });
}
export function recordWorkshopEntry(w: WorkshopState, item: LedgerEntry) {
  if (w.ledger.some((e) => e.id === item.id)) return;
  w.ledger.push(item);
  w.cash += item.amount;
}
export function applyWorkshopAction(
  s: WorkshopGame,
  id: string,
  ctx: WorkshopContext,
): WorkshopResult | null {
  if (!workshopActions(s, ctx).some((a) => a.id === id)) return null;
  const w = state(s);
  const result = (lines: StoryLine[], minutes = 3): WorkshopResult => ({ lines, minutes });
  switch (id) {
    case 'workshop-cabinet-plan': {
      const task = w.cabinet === 'looked' ? 'measure' : w.cabinet === 'measured' ? 'hang' : 'align';
      if (!ctx.dadAgreesTime?.(task))
        return {
          minutes: 0,
          lines: [line('Dad', ctx.dadWorkReason?.() ?? 'I want to keep my own plans for now.')],
        };
      const at = (Math.floor(s.now / 1440) + 1) * 1440 + 15 * 60 + 45;
      return {
        minutes: 2,
        cabinetTime: { task, at, until: at + 60 },
        lines: [
          line(
            'Dad',
            'Let us leave tomorrow at quarter to four for that step. We will still check how we both are when the time comes.',
          ),
        ],
      };
    }
    case 'workshop-cabinet-cancel':
      return {
        minutes: 1,
        cancelCabinetTime: true,
        lines: [
          line(
            'You',
            'You leave a note cancelling the saved cabinet time. The unfinished step stays in the notebook.',
          ),
        ],
      };
    case 'workshop-cabinet-look':
      w.cabinet = 'looked';
      w.projectOpen = true;
      return result([
        line(
          'You',
          'Two unfinished cabinet doors lean against the wall. Dad’s hinge measurements are pencilled in the bench notebook.',
          'notice',
        ),
        ...(ctx.dadHere
          ? [
              line(
                'Dad',
                'The kitchen cabinet works without them. That made it easy to put off. We can finish them together when we both have time.',
              ),
            ]
          : []),
      ]);
    case 'workshop-cabinet-open':
      w.projectOpen = true;
      return result(
        [
          line(
            'You',
            'The cabinet doors and the hinge notebook are where you left them.',
            'notice',
          ),
        ],
        1,
      );
    case 'workshop-cabinet-close':
      w.projectOpen = false;
      return result(
        [
          line(
            'You',
            w.cabinet === 'finished'
              ? 'The finished cabinet stays in the kitchen. There is room to return to the other work.'
              : 'The doors are set safely against the wall. The measurements stay in the notebook.',
            'notice',
          ),
        ],
        1,
      );
    case 'workshop-cabinet-measure':
    case 'workshop-cabinet-hang':
    case 'workshop-cabinet-align': {
      const task =
        id === 'workshop-cabinet-measure'
          ? 'measure'
          : id === 'workshop-cabinet-hang'
            ? 'hang'
            : 'align';
      if (!ctx.dadWillWork?.(task))
        return result(
          [
            line(
              'Dad',
              ctx.dadWorkReason?.() ??
                'I want to keep my own plans for now. Leave the notebook there; we can ask again another time.',
            ),
          ],
          2,
        );
      if (task === 'measure') {
        w.cabinet = 'measured';
        return result(
          [
            line(
              'You',
              'You hold the first door while Dad measures. The notebook now has matching hinge marks for both doors.',
              'notice',
            ),
            line('Dad', 'That gives us something to work from. We do not have to hang them today.'),
          ],
          CABINET_MINUTES.measure,
        );
      }
      if (task === 'hang') {
        w.cabinet = 'hung';
        return result(
          [
            line(
              'You',
              'Between you, the two doors are hung. One catches a little at the corner; it can be adjusted without starting again.',
              'notice',
            ),
            line('Dad', 'Leave that last bit for a moment when neither of us is trying to hurry.'),
          ],
          CABINET_MINUTES.hang,
        );
      }
      w.cabinet = 'finished';
      return result(
        [
          line(
            'You',
            'You adjust the hinges together. Both doors close without catching, and the gap between them stays even.',
            'notice',
          ),
          line(
            'Dad',
            'There. The kitchen will still work tomorrow, but I will enjoy looking at those.',
          ),
        ],
        CABINET_MINUTES.align,
      );
    }
    case 'workshop-drawings':
      w.drawingFound = true;
      return result(
        [
          line(
            'You',
            'In the flat box is a pencil drawing of a small house, with paper tabs where you meant the roof to fold. The little shade-clearance mark is on the same page.',
            'notice',
          ),
          line(
            'Dad',
            'You had a reason for every bit of tape on those roofs. We can put this one by the finished cabinet, if you like.',
          ),
        ],
        10,
      );
    case 'workshop-display-drawing':
      w.drawingChoice = 'displayed';
      return result(
        [
          line(
            'You',
            'You set the saved drawing beside the finished cabinet. The little paper roofs and the doors you hung together can share this corner.',
            'notice',
          ),
        ],
        1,
      );
    case 'workshop-keep-drawing':
      w.drawingChoice = 'kept';
      return result(
        [
          line(
            'You',
            'You slide the drawing back into the flat box. It is still yours to bring out another day.',
            'notice',
          ),
        ],
        1,
      );
    case 'workshop-referral-ask':
      w.referral = 'offered';
      return result([
        line(
          'Nora',
          'Leila, a neighbour of mine, has a porch lamp she wants to keep using. May I introduce her? One person, not a queue at the door.',
        ),
        line(
          'Nora',
          'You can keep it to favours. If you would rather charge for the work, tell her plainly before she leaves anything.',
        ),
      ]);
    case 'workshop-favours':
      w.mode = 'favours';
      w.referral = 'permitted';
      return {
        ...result([
          line(
            'You',
            'One introduction is fine. For now, these are occasional favours, and there is no promise to take everyone’s things.',
          ),
          line('Nora', 'I will tell her exactly that. You can say no when there is no room.'),
        ]),
        personIds: ['leila'],
      };
    case 'workshop-priced':
      w.mode = 'priced';
      w.referral = 'permitted';
      return {
        ...result([
          line(
            'You',
            'I can quote for one small repair. I need to agree somewhere for it to wait before she brings it.',
          ),
          line(
            'Nora',
            'Good. I will arrange an introduction. A price should make the agreement clearer, not make you hurry.',
          ),
        ]),
        personIds: ['leila'],
      };
    case 'workshop-no-referral':
      w.referral = 'declined';
      return result([
        line(
          'Nora',
          'Of course. I will not share your name. There is still room for tea without turning it into work.',
        ),
      ]);
    case 'workshop-intake-space': {
      if (!ctx.dadWillWork?.('space'))
        return result(
          [
            line(
              'Dad',
              'I need to keep that shelf for my cabinet parts today. Let us agree a place when I have cleared them, before anyone leaves a lamp here.',
            ),
          ],
          2,
        );
      w.intakeSpace = true;
      const hour = s.now % 1440;
      w.referralAt =
        hour >= 9 * 60 && hour < 17 * 60
          ? s.now + 30
          : Math.floor(s.now / 1440) * 1440 + 1440 + 14 * 60;
      return {
        ...result(
          [
            line(
              'Dad',
              'That shelf by your end can hold labelled work. Leave my vice clear, and do not put an unlabelled job among my cabinet parts.',
            ),
            line(
              'You',
              `You set aside two spaces with paper labels. Leila's introduction is arranged for ${w.referralAt - s.now < 1440 && Math.floor(w.referralAt / 1440) === Math.floor(s.now / 1440) ? 'half an hour from now' : 'tomorrow afternoon'}.`,
              'notice',
            ),
          ],
          8,
        ),
        visits: [
          { personId: 'leila', at: w.referralAt, activity: 'Coming for the arranged introduction' },
        ],
      };
    }
    case 'workshop-leila-arrival':
      offer(s, w, 'workshop-leila');
      return {
        ...result([
          line(
            'Leila',
            `Nora introduced us. This lamp lets me see the porch latch without putting the hall light on. I can collect it ${s.now % 1440 < 17 * 60 ? 'this evening' : 'tomorrow evening'}, around six, if that suits you.`,
          ),
          line('Leila', 'If it needs longer, say so. I can use the hall light for another night.'),
        ]),
        personIds: ['leila'],
      };
    case 'workshop-nora-arrival':
      w.jobs.push({
        id: 'workshop-nora',
        stage: 'offered',
        fee: w.mode === 'priced' ? 800 : 0,
        materialCost: 0,
        due: 'tomorrow',
        collectionAt: Math.floor(s.now / 1440) * 1440 + 1440 + 10 * 60,
        samFee: 0,
      });
      return result([
        line(
          'Nora',
          'A different lamp this time, from beside the sewing machine. I want to finish some curtains quietly tomorrow morning.',
        ),
        line(
          'Nora',
          'Leila is hoping to collect hers today. Mine can wait here overnight if that keeps today manageable.',
        ),
      ]);
    case 'workshop-next-batch':
      w.nextBatch = 'offered';
      offer(s, w, 'workshop-leila-landing');
      return result([
        line(
          'Leila',
          'The porch lamp has stayed useful. I have a separate one on the landing that I would like you to look at; I can collect it in the evening if it is ready.',
        ),
        line(
          'Leila',
          'Evan, a friend of mine, uses a folding work light. May I introduce him? You need not take everything he brings.',
        ),
      ]);
    case 'workshop-next-referral-yes': {
      w.nextBatch = 'permitted';
      const hour = s.now % 1440;
      w.nextReferralAt =
        hour >= 9 * 60 && hour < 16 * 60
          ? s.now + 45
          : Math.floor(s.now / 1440) * 1440 + 1440 + 14 * 60;
      return {
        ...result([
          line(
            'You',
            'One introduction is fine. I will agree the work and price with him, and say clearly if something is outside what we can do.',
          ),
          line(
            'Leila',
            `I will arrange for him to come ${Math.floor(w.nextReferralAt / 1440) === Math.floor(s.now / 1440) ? 'in about three quarters of an hour' : 'tomorrow afternoon'}.`,
          ),
        ]),
        personIds: ['evan'],
        visits: [
          {
            personId: 'evan',
            at: w.nextReferralAt,
            activity: 'Coming for Leila’s arranged introduction',
          },
        ],
      };
    }
    case 'workshop-next-referral-no':
      w.nextBatch = 'declined';
      return result([
        line(
          'Leila',
          'Of course. I will not pass your name on. We can still discuss the landing lamp when you have room.',
        ),
      ]);
    case 'workshop-nora-stairs-arrival':
      offer(s, w, 'workshop-nora-stairs');
      return result([
        line(
          'Nora',
          'The sewing light is back where it belongs. This is the separate light by the stairs. The handle has that bit of cloth around it so it does not knock when I carry it.',
        ),
        line('Nora', 'Tomorrow is fine. I would rather come once and take a checked repair home.'),
      ]);
    case 'workshop-evan-arrival':
      offer(s, w, 'workshop-evan');
      return {
        ...result([
          line(
            'Evan',
            'Leila introduced us. This folds down beside my bench; it helps me find the small things that roll underneath.',
          ),
          line(
            'Evan',
            'The dent can stay. I need reliable light, not a new-looking shade. I can collect tomorrow afternoon.',
          ),
        ]),
        personIds: ['evan'],
      };
    case 'workshop-evan-timer-arrival':
      offer(s, w, 'workshop-evan-timer');
      return result([
        line(
          'Evan',
          'I brought this timer as well, but only if you want to look. It winds without moving the dial.',
        ),
        line(
          'Evan',
          'A light repair does not mean you can fix every mechanism. Tell me what you find; you are not agreeing a repair fee for this one.',
        ),
      ]);
    case 'workshop-sam-agreement':
      if (!ctx.samWillAgree?.())
        return result(
          [
            line(
              'Sam',
              'Not this afternoon. I am interested, but I need to keep the time I have already promised elsewhere. We can discuss another day.',
            ),
          ],
          2,
        );
      w.paidHelp = true;
      return result([
        line(
          'You',
          'For an agreed priced job you complete yourself, I can pay you £3 from its repair fee. We will agree the job before you start.',
        ),
        line(
          'Sam',
          'That is clear. Let me choose what fits around my shift and the dog. You can still work on your own things while I have the bench.',
        ),
      ]);
  }
  const match = /^workshop-(quote|accept|decline|defer|delay|return-unfixed)-([a-z-]+)$/.exec(id);
  if (!match) return null;
  const spec = workshopJobSpecs.find((j) => j.id === `workshop-${match[2]}`);
  const job = w.jobs.find((j) => j.id === spec?.id);
  if (!spec || !job) return null;
  if (match[1] === 'return-unfixed') {
    const object = s.objects.find((item) => item.id === spec.id);
    if (object) {
      object.location = 'returned';
      object.awaitingCollection = false;
      s.focusId = s.focusId === object.id ? null : s.focusId;
    }
    job.stage = 'declined';
    job.collectedAt = s.now;
    return result(
      [
        line(
          'You',
          'A gear is missing, and there is no matching part or learned method here. I cannot promise this repair.',
        ),
        line(
          spec.owner,
          'Thank you for telling me. I will take it back with the note about the missing gear. Nothing is owed.',
        ),
      ],
      4,
    );
  }
  if (match[1] === 'delay') {
    job.due = 'tomorrow';
    job.collectionAt = Math.floor(s.now / 1440) * 1440 + 1440 + 10 * 60;
    return {
      ...result([
        line(
          'You',
          'It needs longer. I do not want to call it checked just to meet a collection time.',
        ),
        line(
          spec.owner,
          'Thanks for telling me. Keep it safely labelled; I can come back tomorrow.',
        ),
      ]),
      visits: [
        {
          personId: spec.ownerId,
          at: job.collectionAt,
          activity: 'Collecting the labelled repair tomorrow',
        },
      ],
    };
  }
  if (match[1] === 'quote') {
    job.stage = 'quoted';
    return result([
      line(
        'You',
        spec.fault === 'gear'
          ? 'I can inspect the mechanism, but I have not agreed to repair it. No repair fee is due for finding out whether it is within our methods.'
          : job.fee
            ? `${money(job.fee)} for the repair work${job.materialCost ? `, plus ${money(job.materialCost)} for a fresh battery. The battery money comes with the lamp; the work fee is paid after a checked repair` : '. The work fee is paid after a checked repair'}. If I cannot finish it, there is no work fee.`
            : 'I can look at it as a favour. There is no fee and no promised rush; I will tell you what I find.',
      ),
      line(
        spec.owner,
        job.materialCost
          ? 'That is clear. I will leave the battery money with it. If it needs another part, ask me first.'
          : 'That works for me. Please tell me if the plan needs to change.',
      ),
    ]);
  }
  if (match[1] === 'defer')
    return result(
      [
        line(
          'You',
          'The offer stays open. The object already on the bench needs a safe place before another comes in.',
          'notice',
        ),
      ],
      1,
    );
  if (match[1] === 'decline') {
    job.stage = 'declined';
    return result([
      line(spec.owner, 'Thanks for being clear. I will keep it with me for now. Nothing is owed.'),
    ]);
  }
  job.stage = 'accepted';
  job.acceptedAt = s.now;
  // The per-job wage is fixed only if paid help was agreed before this intake.
  job.samFee = w.paidHelp && spec.fault !== 'gear' ? 300 : 0;
  if (spec.materialsBatteryProvided) {
    s.parts.batteries += 1;
    if (job.materialCost) {
      recordWorkshopEntry(w, {
        id: `${job.id}:advance`,
        at: s.now,
        amount: job.materialCost,
        kind: 'materials-advance',
        jobId: job.id,
      });
      recordWorkshopEntry(w, {
        id: `${job.id}:battery`,
        at: s.now,
        amount: -job.materialCost,
        kind: 'materials',
        jobId: job.id,
      });
    }
  }
  return {
    ...result(
      [
        line(
          spec.owner,
          job.fee
            ? `Agreed. ${money(job.fee)} for checked work${job.materialCost ? `, and ${money(job.materialCost)} for the battery already supplied` : ''}. Tell me if anything changes.`
            : spec.fault === 'gear'
              ? 'Here it is for a look, with no repair promised. Tell me what you find.'
              : spec.materialsBatteryProvided
                ? 'Here it is. I have brought a spare battery if you need it. Please tell me if it is more than a small favour.'
                : 'Here it is. Please tell me if it is more than a small favour.',
        ),
        line('You', `You label ${spec.title} with its owner and collection plan.`, 'notice'),
      ],
      5,
    ),
    job: spec,
    personIds: [spec.ownerId],
    visits: [
      {
        personId: spec.ownerId,
        at: job.collectionAt,
        activity:
          job.due === 'this-evening'
            ? 'Coming back for collection this evening'
            : 'Coming back for collection tomorrow',
      },
    ],
  };
}
/** Settlement is triggered by the actual host return, not merely by viewing or checking a lamp. */
export function completeWorkshopJob(
  s: WorkshopGame,
  objectId: string,
  outcome: { verified: boolean; independent: boolean; at: number },
): StoryLine[] {
  const w = s.workshop;
  const job = w?.jobs.find((j) => j.id === objectId);
  if (!w || !job || job.stage !== 'accepted' || !outcome.verified) return [];
  job.stage = 'complete';
  job.collectedAt = outcome.at;
  job.independent = outcome.independent;
  const spec = workshopJobSpecs.find((j) => j.id === objectId);
  const lines = [
    line(
      spec?.owner ?? 'Owner',
      'Thank you. You told me what it needed and gave it a proper check.',
    ),
  ];
  if (job.fee) {
    recordWorkshopEntry(w, {
      id: `${job.id}:fee`,
      at: outcome.at,
      amount: job.fee,
      kind: 'repair-fee',
      jobId: job.id,
    });
    lines.push(line('You', `${money(job.fee)} received for the agreed repair work.`, 'notice'));
  }
  if (job.samFee && outcome.independent) {
    recordWorkshopEntry(w, {
      id: `${job.id}:sam`,
      at: outcome.at,
      amount: -job.samFee,
      kind: 'sam-pay',
      jobId: job.id,
    });
    lines.push(
      line(
        'Sam',
        `The agreed ${money(job.samFee)} is paid. I have written down what I checked before giving it back.`,
      ),
    );
  }
  return lines;
}
export function getWorkshopView(s: WorkshopGame) {
  const w = s.workshop;
  if (!w || s.chapter !== 'garage') return null;
  const cabinetDescriptions: Record<WorkshopState['cabinet'], string> = {
    unnoticed: 'Two unfinished doors lean against the wall.',
    looked: 'The hinge notebook is ready when you both have time.',
    measured: 'Both hinge positions are marked. The doors are ready to hang.',
    hung: 'Both doors are hung; one corner still needs adjusting.',
    finished: 'Both doors close cleanly. The kitchen cabinet is finished.',
  };
  return {
    cabinet:
      w.cabinet === 'unnoticed'
        ? null
        : {
            stage: w.cabinet,
            description:
              cabinetDescriptions[w.cabinet] +
              (w.cabinetAppointment?.status === 'planned'
                ? ` The notebook holds an agreed ${w.cabinetAppointment.task} slot at 15:45; ask Dad when you are both available, or rearrange it.`
                : w.cabinetAppointment?.status === 'missed'
                  ? ' You missed the saved cabinet time. The step is unfinished; ask Dad to arrange another time.'
                  : ''),
            open: w.projectOpen,
            drawingFound: w.drawingFound,
            drawingDisplayed: w.drawingChoice === 'displayed',
          },
    jobs: w.jobs
      .filter((j) => j.stage === 'quoted' || j.stage === 'accepted')
      .map((j) => ({
        id: j.id,
        title: workshopJobSpecs.find((spec) => spec.id === j.id)?.title ?? j.id,
        note:
          s.now >= j.collectionAt && j.stage === 'accepted'
            ? 'Collection time has arrived. If it needs longer, tell the owner when they are here.'
            : Math.floor(j.collectionAt / 1440) === Math.floor(s.now / 1440)
              ? 'Collection today, if the repair is checked.'
              : `Collection ${Math.floor(j.collectionAt / 1440) === Math.floor(s.now / 1440) + 1 ? 'tomorrow' : 'on the arranged day'} at ${Math.floor((j.collectionAt % 1440) / 60)}:00; leave room for other work.`,
        quote: j.fee
          ? `${money(j.fee)} work${j.materialCost ? ` + ${money(j.materialCost)} battery` : ''}${j.samFee ? ` · ${money(j.samFee)} for Sam’s independent work` : ''}`
          : workshopJobSpecs.find((spec) => spec.id === j.id)?.fault === 'gear'
            ? 'Inspection only; no repair fee or promised fix.'
            : 'An occasional favour; no fee.',
        stage: j.stage,
      })),
    notebook: w.ledger.length
      ? {
          cash: money(w.cash),
          received: money(
            w.ledger.filter((e) => e.kind === 'repair-fee').reduce((sum, e) => sum + e.amount, 0),
          ),
          paid: money(
            -w.ledger.filter((e) => e.kind === 'sam-pay').reduce((sum, e) => sum + e.amount, 0),
          ),
          materials: money(
            -w.ledger.filter((e) => e.kind === 'materials').reduce((sum, e) => sum + e.amount, 0),
          ),
        }
      : null,
    arrangement: w.intakeSpace
      ? w.mode === 'priced'
        ? 'Labelled repairs, with a price agreed first.'
        : 'A corner for occasional favours.'
      : null,
  };
}
