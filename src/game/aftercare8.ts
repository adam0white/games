/**
 * Two optional conversations about objects after actual work. Persistent flags
 * own only which authored question was chosen; the host owns HF willingness,
 * conversation activity and elapsed time. Nothing here repairs, pays, teaches
 * or establishes why the wider world changed. Absent or unwilling people leave
 * the conversation available for another time.
 */
import type { ServiceWeekState } from './service-week8';
import type { StoryLine } from './story8';
import type { ActionView } from './types';
import type { WorkshopState } from './workshop8';

export interface AftercareGame {
  now: number;
  unlocked: string[];
  workshop?: Pick<WorkshopState, 'cabinet'>;
  serviceWeek?: Pick<ServiceWeekState, 'reflection' | 'donorInvited' | 'part'>;
}
export interface AftercareContext {
  dadHere: boolean;
  evanHere: boolean;
  wantsConversation?: (id: string) => boolean;
}
export interface AftercareResult {
  lines: StoryLine[];
  minutes: number;
}
const CABINET_PENDING = 'aftercare-cabinet-pending';
const CABINET_DONE = 'aftercare-cabinet-done';
const LABEL_PENDING = 'aftercare-label-pending';
const LABEL_DONE = 'aftercare-label-done';
const line = (speaker: string, text: string, tone: StoryLine['tone'] = 'warm'): StoryLine => ({
  speaker,
  text,
  tone,
});
const action = (id: string, label: string, detail?: string): ActionView => ({
  id,
  label,
  detail,
  kind: 'quiet',
  intent: 'stay',
});
function cabinetReady(s: AftercareGame): boolean {
  return s.workshop?.cabinet === 'finished' && !s.unlocked.includes(CABINET_DONE);
}
function labelReady(s: AftercareGame): boolean {
  const week = s.serviceWeek;
  return !!(
    week?.reflection &&
    week.donorInvited &&
    week.part !== 'unknown' &&
    !s.unlocked.includes(LABEL_DONE)
  );
}
export function aftercareActions(s: AftercareGame, ctx: AftercareContext): ActionView[] {
  const choices: ActionView[] = [];
  if (cabinetReady(s)) {
    if (s.unlocked.includes(CABINET_PENDING))
      choices.push(
        action('aftercare-door-ceremony', 'Open the cabinet door ceremoniously'),
        action('aftercare-door-question', 'Ask whether Dad misses the open shelves'),
        action('aftercare-door-leave', 'Leave Dad to it'),
      );
    else
      choices.push(
        action(
          'aftercare-door-start',
          'Try the finished cabinet doors with Dad',
          ctx.dadHere
            ? 'A little conversation; no further repair.'
            : 'Dad is away. Try when he is back.',
        ),
      );
  }
  if (labelReady(s)) {
    if (s.unlocked.includes(LABEL_PENDING))
      choices.push(
        action('aftercare-label-picture', 'Look at the picture together'),
        action('aftercare-label-list', 'Give Evan back the parts list'),
      );
    else
      choices.push(
        action(
          'aftercare-label-start',
          'Turn the display label back over with Evan',
          ctx.evanHere
            ? 'The picture and the parts list are both still there.'
            : 'Evan is away. Try when he is back.',
        ),
      );
  }
  return choices;
}
function finish(s: AftercareGame, pending: string, done: string, choice: string): void {
  s.unlocked = s.unlocked.filter((flag) => flag !== pending);
  s.unlocked.push(done, choice);
}
export function applyAftercareAction(
  s: AftercareGame,
  id: string,
  ctx: AftercareContext,
): AftercareResult | null {
  if (!aftercareActions(s, ctx).some((choice) => choice.id === id)) return null;
  const cabinet = id.startsWith('aftercare-door-');
  const personId = cabinet ? 'dad' : 'evan';
  const name = cabinet ? 'Dad' : 'Evan';
  if (!(cabinet ? ctx.dadHere : ctx.evanHere))
    return {
      lines: [
        line('You', `${name} is not here. You leave the conversation for another time.`, 'notice'),
      ],
      minutes: 0,
    };
  if (!ctx.wantsConversation?.(personId))
    return {
      lines: [
        line('You', `${name} is not available for this conversation now. It can wait.`, 'notice'),
      ],
      minutes: 0,
    };
  if (id === 'aftercare-door-start') {
    s.unlocked.push(CABINET_PENDING);
    return {
      lines: [
        line(
          'You',
          'You reach for a shelf and put your hand against the closed door. Dad reaches past you, then stops too.',
          'notice',
        ),
        line('Dad', 'We have both forgotten the extra step.'),
      ],
      minutes: 2,
    };
  }
  if (id === 'aftercare-label-start') {
    s.unlocked.push(LABEL_PENDING);
    return {
      lines: [
        line(
          'You',
          s.serviceWeek?.part === 'declined'
            ? 'Evan brings out the display label again. You turn it back to A BETTER HIGH STREET.'
            : 'You bring out the kept display label and turn it back to A BETTER HIGH STREET.',
          'notice',
        ),
        line('You', 'Which side do you keep facing out?'),
        line('Evan', 'The parts list. Unless someone needs the picture.'),
      ],
      minutes: 2,
    };
  }
  if (cabinet) {
    finish(s, CABINET_PENDING, CABINET_DONE, id);
    const lines =
      id === 'aftercare-door-ceremony'
        ? [
            line('You', 'You open the door with a grand sweep of your hand.', 'notice'),
            line('Dad', 'Good. Now do that every time you want a plate.'),
          ]
        : id === 'aftercare-door-question'
          ? [
              line('You', 'Do you miss the open shelves?'),
              line('Dad', 'A little. I still wanted to finish them.'),
            ]
          : [
              line(
                'You',
                'You stand aside. Dad opens the door and reaches for the shelf.',
                'notice',
              ),
            ];
    return { lines, minutes: 3 };
  }
  finish(s, LABEL_PENDING, LABEL_DONE, id);
  return {
    lines:
      id === 'aftercare-label-picture'
        ? [
            line('You', 'You leave the picture facing up between you.', 'notice'),
            line('Evan', 'Those windows are good. You could see what was inside.'),
          ]
        : [
            line('You', 'You turn the label back to the parts list and give it to Evan.', 'notice'),
            line('Evan', 'Thank you. That is the side I need today.'),
          ],
    minutes: 3,
  };
}
