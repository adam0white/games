import { createGame, getView, serializeGame, transition } from '../../src/game/engine';
import type { ActionView, GameInput, GameState, GameView } from '../../src/game/types';

export const archetypes = [
  'skip-everything',
  'impatient',
  'social-first',
  'completionist',
  'continuation-seeker',
] as const;
export type Archetype = (typeof archetypes)[number];
export interface Diagnostic {
  step: number;
  kind: 'empty-repeat' | 'repeated-visible-state' | 'known-plan-late' | 'no-visible-choice';
  detail: string;
}
export interface PlayerRun {
  simulated: true;
  archetype: Archetype;
  seed: number;
  budget: number;
  stop: 'budget' | 'no-visible-choice';
  actions: {
    step: number;
    input: GameInput;
    label: string;
    before: string;
    after: string;
    response: string | null;
  }[];
  diagnostics: Diagnostic[];
  finalExport: string;
}
const text = (a: ActionView) => `${a.label} ${a.detail ?? ''}`.toLowerCase();

/** Policies use only received GameView text and choice history. Scores model
 * deliberately narrow habits, not people, optimal play, hidden faults or fun. */
export function chooseVisible(
  view: GameView,
  archetype: Archetype,
  counts: ReadonlyMap<string, number>,
): GameInput | null {
  const candidates: { input: GameInput; score: number; index: number }[] = view.actions.map(
    (action, index) => {
      const words = text(action);
      const visits = counts.get(`action:${action.id}`) ?? 0;
      let score = -visits * 12;
      if (archetype === 'continuation-seeker') {
        if (
          /next school|school break|new holiday|school year|return to school|graduat|visit.*garage|go.*garage|move on|continue.*story/.test(
            words,
          )
        )
          score += 200;
        if (/next morning|next day|another afternoon|tomorrow/.test(words)) score -= 20;
        if (action.intent === 'leave') score += 40;
        if (/return.*unfinished|put.*aside|shelve/.test(words)) score += 50;
        if (/inspect|test|repair|clean|fit|verify|check/.test(words)) score -= 40;
      } else if (archetype === 'skip-everything') {
        if (action.intent === 'leave') score += 90;
        if (/move on|next|leave|return.*unfinished|put.*aside|shelve|end|close/.test(words))
          score += 65;
        if (/inspect|test|repair|clean|fit|verify|check/.test(words)) score -= 80;
      } else if (archetype === 'impatient') {
        if (/wait/.test(words)) score -= /\d+\s*minutes?|until|finishes|ends/.test(words) ? 15 : 90;
        if (/next|continue|return|finish|begin/.test(words)) score += 25;
      } else if (archetype === 'social-first') {
        if (/talk|ask|tea|listen|conversation|invite|together|watch|tell/.test(words)) score += 60;
        if (/wait/.test(words)) score -= 20;
      } else {
        if (/inspect|test|check|read|measure|compare|explain|repair|clean|fit|verify/.test(words))
          score += 30;
        if (/return.*unfinished|leave|end|close/.test(words)) score -= 30;
        if (/wait/.test(words)) score -= 10;
      }
      return { input: { type: 'action' as const, id: action.id }, score, index };
    },
  );
  for (const object of view.shelf) {
    const visits = counts.get(`select:${object.id}`) ?? 0;
    candidates.push({
      input: { type: 'select', id: object.id },
      score: 5 - visits * 12,
      index: candidates.length,
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.input ?? null;
}

function visibleWork(view: GameView): string {
  return JSON.stringify({
    scene: view.scene,
    title: view.title,
    chapter: view.lifeChapter,
    focus: view.focus,
    shelf: view.shelf,
    parts: view.parts,
    apprenticeship: view.apprenticeship?.responsibility,
    actions: view.actions.map((a) => a.id),
  });
}

export function runPlayer(
  archetype: Archetype,
  seed = 1701,
  budget = 100,
  initial?: GameState,
): PlayerRun {
  if (!Number.isInteger(budget) || budget < 0 || budget > 2000)
    throw new Error('Budget must be an integer from 0 to 2000');
  let state = initial ?? createGame(seed);
  const counts = new Map<string, number>();
  const repetitions = new Map<string, number>();
  const reported = new Set<string>();
  const result: PlayerRun = {
    simulated: true,
    archetype,
    seed: state.seed,
    budget,
    stop: 'budget',
    actions: [],
    diagnostics: [],
    finalExport: '',
  };
  for (let step = 0; step < budget; step++) {
    const before = getView(state);
    const input = chooseVisible(before, archetype, counts);
    if (!input) {
      result.stop = 'no-visible-choice';
      result.diagnostics.push({
        step,
        kind: 'no-visible-choice',
        detail: `No visible action or shelf object at ${before.title}`,
      });
      break;
    }
    const key = `${input.type}:${input.id}`;
    const label =
      input.type === 'action'
        ? before.actions.find((a) => a.id === input.id)?.label
        : before.shelf.find((o) => o.id === input.id)?.title;
    const next = transition(state, input);
    const after = getView(next);
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    if (unchanged && (counts.get(key) ?? 0) > 0)
      result.diagnostics.push({
        step,
        kind: 'empty-repeat',
        detail: `Repeated ${label} left the entire visible view unchanged`,
      });
    const signature = visibleWork(after);
    const repeated = (repetitions.get(signature) ?? 0) + 1;
    repetitions.set(signature, repeated);
    if (repeated === 8)
      result.diagnostics.push({
        step,
        kind: 'repeated-visible-state',
        detail:
          'Eight visits with the same visible work and offers; time/dialogue may have advanced. Review for an unproductive loop.',
      });
    for (const plan of after.dayPlan?.entries ?? []) {
      if (
        plan.status !== 'late' ||
        reported.has(plan.id) ||
        !before.dayPlan?.entries.some((p) => p.id === plan.id && p.status === 'agreed')
      )
        continue;
      reported.add(plan.id);
      result.diagnostics.push({
        step,
        kind: 'known-plan-late',
        detail: `Previously disclosed agreed plan became late after ${label}: ${plan.label}`,
      });
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
    result.actions.push({
      step,
      input,
      label: label ?? input.id,
      before: before.timeLabel ?? before.title,
      after: after.timeLabel ?? after.title,
      response:
        (after.journal ?? after.conversation)
          .filter(
            (line) => !(before.journal ?? before.conversation).some((old) => old.id === line.id),
          )
          .map((line) => `${line.speaker}: ${line.text}`)
          .join('\n') || (after.note !== before.note ? after.note : null),
    });
    state = next;
  }
  result.finalExport = serializeGame(state);
  return result;
}
