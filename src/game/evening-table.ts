/** One finite personal arrangement of existing property. This module owns the
 * table placements and received scene moments; the host supplies real objects,
 * HF-completed activity receipts and original custody. No repair, skill, money,
 * invented company or borrowed family lamp is awarded here. */
import type { StoryLine } from './story';
export type TableOrigin = 'bench' | 'shelf' | 'returned';
export interface EveningTableState {
  stage: 'table' | 'finished';
  lampPosition: 'side' | 'near' | 'far';
  modelPosition: 'front' | 'back';
  modelAngle: 'facing' | 'angled';
  packagingRevealed: boolean;
  printDiscussed: boolean;
  mumJoinedAt?: number;
  chosenArrangement?: 'wall' | 'table';
  itemOrigins: Record<string, TableOrigin>;
  lastAction: string;
  lastAt: number;
  circuitAt?: number;
}
export interface EveningContext {
  now: number;
  model?: {
    id: string;
    title: string;
    available: boolean;
    atTable: boolean;
    origin?: TableOrigin;
    frontage: 'remembered' | 'current';
    canOriginal: boolean;
    canCurrent: boolean;
    driveChecked: boolean;
    arrangementChecked: boolean;
  };
  lamp?: { id: string; title: string; available: boolean; atTable: boolean; origin?: TableOrigin };
  mumHere: boolean;
  drawingsShared: boolean;
}
export interface EveningAction {
  id: string;
  label: string;
  minutes: number;
  partner?: 'mum';
}
/** School passage includes putting personal arrangements away during unplayed
 * time. This closes the scene without a performed repair or shared-work receipt. */
export function closeEveningForSchool(
  prior: EveningTableState | undefined,
  at: number,
): EveningTableState | undefined {
  if (prior?.stage !== 'table') return;
  return { ...structuredClone(prior), stage: 'finished', lastAction: 'school-pause', lastAt: at };
}
export function eveningActions(
  s: EveningTableState | undefined,
  c: EveningContext,
): EveningAction[] {
  const actions: EveningAction[] = [];
  const add = (id: string, label: string, minutes: number, partner?: 'mum') =>
    actions.push({ id: `evening-${id}`, label, minutes, ...(partner ? { partner } : {}) });
  if (!s || s.stage === 'finished') {
    if (c.model?.available)
      add(
        'bring-model',
        s
          ? 'Bring the street back to the family table'
          : 'Try the paper street beneath the family-room light',
        5,
      );
    return actions;
  }
  if (!c.model?.atTable) return actions;
  if (c.lamp?.available && !c.lamp.atTable)
    add('bring-lamp', 'Bring your checked bedside lamp to the table', 3);
  if (c.lamp?.atTable) {
    for (const [position, label] of [
      ['side', 'Set the lamp beside the painted fronts'],
      ['near', 'Move the lamp close behind the street'],
      ['far', 'Move the lamp farther from the street'],
    ] as const)
      if (s.lampPosition !== position) add(`light-${position}`, label, 1);
  }
  if (s.modelPosition !== 'front') add('model-front', 'Move the street nearer the light', 1);
  if (s.modelPosition !== 'back') add('model-back', 'Move the street nearer the wall', 1);
  if (s.modelAngle !== 'facing') add('turn-facing', 'Face the street toward the table', 1);
  if (s.modelAngle !== 'angled') add('turn-angled', 'Turn the street a little sideways', 1);
  if (c.model.canOriginal) add('original', 'Fit your retained original fronts', 6);
  if (c.model.canCurrent) add('current', 'Fit your already-made present-day fronts', 6);
  if (!s.packagingRevealed)
    add('look-under', 'Lift the original front to look at its underside', 2);
  if (c.model.driveChecked) {
    if (c.model.arrangementChecked)
      add('run-circuit', 'Run the checked shutters through one circuit', 4);
    else add('check-circuit', 'Check the full circuit with these fitted fronts', 12);
  }
  if (c.mumHere && s.mumJoinedAt === undefined)
    add('show-mum', 'Ask Mum to look at the street with you', 4, 'mum');
  if (c.mumHere && s.packagingRevealed && !s.printDiscussed)
    add('ask-print', 'Ask Mum about the print beneath the roof', 3, 'mum');
  if (s.chosenArrangement !== 'wall')
    add('keep-wall', 'Leave the big street on the wall for a while', 1);
  if (s.chosenArrangement !== 'table')
    add('keep-table', 'Keep the little street close on the table', 1);
  add('put-away', 'Put your things back and return to the bench', 1);
  return actions;
}
const line = (speaker: string, text: string): StoryLine => ({
  speaker,
  text,
  tone: speaker === 'You' ? 'notice' : 'warm',
});
export function completeEveningActivity(
  prior: EveningTableState | undefined,
  c: EveningContext,
  receipt: { id: string; at: number; completed: boolean; participant?: string },
): { next: EveningTableState; lines: StoryLine[] } | undefined {
  const action = eveningActions(prior, c).find((a) => a.id === receipt.id);
  if (!action || !receipt.completed || (action.partner && receipt.participant !== action.partner))
    return;
  const s: EveningTableState = prior
    ? structuredClone(prior)
    : {
        stage: 'table',
        lampPosition: 'side',
        modelPosition: 'back',
        modelAngle: 'facing',
        packagingRevealed: false,
        printDiscussed: false,
        itemOrigins: {},
        lastAction: receipt.id,
        lastAt: receipt.at,
      };
  s.lastAction = receipt.id;
  s.lastAt = receipt.at;
  if (
    [
      'evening-bring-lamp',
      'evening-light-side',
      'evening-light-near',
      'evening-light-far',
      'evening-model-front',
      'evening-model-back',
      'evening-turn-facing',
      'evening-turn-angled',
      'evening-original',
      'evening-current',
    ].includes(receipt.id)
  )
    s.chosenArrangement = undefined;
  let text = '';
  const lines: StoryLine[] = [];
  switch (receipt.id) {
    case 'evening-bring-model':
      if (!c.model?.origin) return;
      s.stage = 'table';
      s.itemOrigins = { [c.model.id]: c.model.origin };
      s.circuitAt = undefined;
      s.mumJoinedAt = undefined;
      s.chosenArrangement = undefined;
      text =
        'You bring your same paper street to the family table. The ordinary room light throws its roofline onto the pale wall. There is room to move the model and see what changes.';
      break;
    case 'evening-bring-lamp':
      if (!c.lamp?.origin) return;
      s.itemOrigins[c.lamp.id] = c.lamp.origin;
      s.lampPosition = 'side';
      text =
        'Your own checked bedside lamp comes with its repair history. Beside the street it lights the painted fronts; now you can move the light as well as the model.';
      break;
    case 'evening-light-side':
      s.lampPosition = 'side';
      text =
        'Beside the model, the lamp brings out the painted fronts. The shadow stretches sideways.';
      break;
    case 'evening-light-near':
      s.lampPosition = 'near';
      text =
        c.model?.frontage === 'current'
          ? 'Close behind the street, the lamp makes the broad fronts loom across the wall.'
          : 'Close behind the street, the lamp makes the little roofs loom across the wall. The crooked one is especially hard to miss.';
      break;
    case 'evening-light-far':
      s.lampPosition = 'far';
      text =
        'Farther back, the lamp gives the street a smaller, sharper outline. The fronts are easier to take in at once.';
      break;
    case 'evening-model-front':
      s.modelPosition = 'front';
      text =
        c.model?.frontage === 'current'
          ? 'Nearer the light, the fitted street casts a larger shadow. Its broad outlines spread across the wall.'
          : 'Nearer the light, the little street casts a larger shadow. Its old uneven roof rises above the others.';
      break;
    case 'evening-model-back':
      s.modelPosition = 'back';
      text =
        'Nearer the wall, the outline shrinks and sharpens. It looks like something small you can hold again.';
      break;
    case 'evening-turn-facing':
      s.modelAngle = 'facing';
      text = 'The painted fronts face the table again. The houses overlap less in the shadow.';
      break;
    case 'evening-turn-angled':
      s.modelAngle = 'angled';
      text =
        'You turn the base a little. A shutter edge that was hidden from the light makes a narrow shape on the wall.';
      break;
    case 'evening-original':
      text =
        'The retained original street takes its place again. The later front stays flat with the model; neither is thrown away.';
      break;
    case 'evening-current':
      text =
        'Your made present-day front seats in the same slots. The old roofs stay retained beside it, ready to change back.';
      break;
    case 'evening-look-under':
      s.packagingRevealed = true;
      text =
        'Beneath the original paper roof, a strip of reused packaging reads TUESDAY / THURSDAY. Someone crossed out Tuesday by hand. The little line belongs to this scrap; the card does not say why.';
      break;
    case 'evening-run-circuit':
    case 'evening-check-circuit':
      if (receipt.id === 'evening-run-circuit') s.circuitAt = receipt.at;
      text =
        'The checked drive takes the fitted street through one whole circuit. Each shutter changes the shape on the wall as it opens, then settles back.';
      break;
    case 'evening-show-mum':
      s.mumJoinedAt = receipt.at;
      lines.push(
        line(
          'Mum',
          c.drawingsShared
            ? c.model?.frontage === 'current'
              ? 'You have changed the fronts, but the little street still looks bigger from here.'
              : 'That crooked roof reaches much farther from here. I like seeing it this way.'
            : 'You do not have to show me the pages. I like seeing what you did with the little houses.',
        ),
      );
      break;
    case 'evening-ask-print':
      s.printDiscussed = true;
      s.mumJoinedAt = receipt.at;
      lines.push(
        line(
          'Mum',
          'I used to put that box by the door. You took it before I had finished with it.',
        ),
        line('You', 'I needed a roof.'),
        line('Mum', 'You still could have asked.'),
      );
      break;
    case 'evening-keep-wall':
      s.chosenArrangement = 'wall';
      s.modelPosition = 'front';
      if (c.lamp?.atTable) s.lampPosition = 'near';
      text =
        c.model?.frontage === 'current'
          ? 'You leave the fitted street large on the wall for a while. Its broad outline reaches toward the picture rail.'
          : 'You leave the street large on the wall for a while. The crooked roof almost reaches the picture rail.';
      break;
    case 'evening-keep-table':
      s.chosenArrangement = 'table';
      s.modelPosition = 'back';
      if (c.lamp?.atTable) s.lampPosition = 'side';
      text =
        'You bring the street close again, where its small painted details are easy to see. The still arrangement can stay just as it is.';
      break;
    case 'evening-put-away':
      s.stage = 'finished';
      text =
        'You put the same model and any lamp you brought back in their own places. The family table is clear again.';
      break;
  }
  if (text) lines.unshift(line('You', text));
  return { next: s, lines };
}
export function eveningView(s: EveningTableState | undefined, c: EveningContext) {
  return {
    stage: s?.stage ?? ('invitation' as 'invitation' | 'table' | 'finished'),
    title: 'The street on the wall',
    detail:
      s?.stage === 'table'
        ? 'Move the street or turn its base. Keep the arrangement you like; a still street is enough.'
        : s?.stage === 'finished'
          ? 'Your things are back in their own places. You can bring the street out again whenever you want.'
          : 'The paper street can come to the family table. Try its roofline beneath the ordinary room light; no repair or company is required.',
    model: c.model
      ? {
          id: c.model.id,
          title: c.model.title,
          frontage: c.model.frontage,
          moving:
            s?.lastAction === 'evening-run-circuit' || s?.lastAction === 'evening-check-circuit',
          circuitAt: s?.circuitAt,
        }
      : undefined,
    light: c.lamp?.atTable ? ('bedside' as const) : ('room' as const),
    lightCaption: c.lamp?.atTable
      ? 'Your checked bedside lamp · movable'
      : 'Family-room light · fixed',
    lampPosition: s?.lampPosition ?? 'side',
    modelPosition: s?.modelPosition ?? 'back',
    modelAngle: s?.modelAngle ?? 'facing',
    packagingRevealed: s?.packagingRevealed ?? false,
    mumPresent: Boolean(
      s &&
        s.lastAt === c.now &&
        ['evening-show-mum', 'evening-ask-print'].includes(s.lastAction) &&
        c.mumHere,
    ),
    circuitReceiptId: s?.circuitAt === undefined ? undefined : `evening-circuit:${s.circuitAt}`,
    chosenArrangement: s?.chosenArrangement,
    actionIds: eveningActions(s, c).map((a) => a.id),
  };
}
