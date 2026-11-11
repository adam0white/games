import type { Person } from '../game/hf';
import { playerWordReading } from '../game/people';
import type { Command, CommandResult, GameState, Job } from '../game/types';

/** Describe performed work, never the hidden fault or an untested result. */
export function componentWorkReading(job: Job, componentId: string) {
  const work = job.contributions.findLast((entry) =>
    ['clean', 'adjust', 'replace'].some((verb) => entry.action === `${verb}:${componentId}`),
  );
  const part = job.model.components.find((component) => component.id === componentId);
  if (!work || !part) return undefined;
  const kind = work.action.split(':')[0] as 'clean' | 'adjust' | 'replace';
  const text =
    kind === 'replace'
      ? `A replacement ${part.label.toLowerCase()} is fitted. Test the object to check the result.`
      : kind === 'clean'
        ? part.kind === 'contact' || part.kind === 'switch'
          ? 'The contact surfaces were cleaned. Cleaning does not prove the fault is fixed.'
          : `${part.label} was cleaned. Test the object to check the result.`
        : `${part.label} was adjusted. Test the object to check the result.`;
  return { kind, text };
}

/** Timing confidence and an honest return are different facts. Keep both visible. */
export function ownerPromiseAccount(person: Person, jobs: Job[]): string | undefined {
  const trust = playerWordReading(person);
  if (!trust) return undefined;
  const lateReturn = jobs.findLast(
    (job) =>
      job.ownerId === person.id &&
      job.returnedUnfinished &&
      job.deliveredAt !== undefined &&
      job.deliveredAt > job.due,
  );
  const outstanding = jobs.some(
    (job) =>
      job.ownerId === person.id && ['active', 'ready'].includes(job.status) && job.due < person.now,
  );
  return `${person.name} ${trust} about promised times.${lateReturn ? ` You returned ${lateReturn.title} honestly unfinished, after the promised time.` : ''}${outstanding ? ' This owner is still waiting for overdue work.' : ''}`;
}

/** The earned recovery result, already in the workshop log; never a forecast of hidden condition. */
export function latestRecoveryAccount(state: GameState): string | undefined {
  return state.log.findLast(
    (line) =>
      line.speaker === 'Workshop' &&
      /^(You recovered one working |The recovered .+ is not usable\.)/.test(line.text),
  )?.text;
}

/** Display only an existing lesson utterance. Unknown lines and native reasons stay exact. */
export function lessonWords(speaker: string, text: string): string {
  if (speaker !== 'Sam') return text;
  const lines: Record<string, string> = {
    'I watched the repair step, but I did not see a relevant test after the previous work and before this step. A later check cannot show what this step changed.':
      'I saw you work on it, but I didn’t see a relevant test after the previous change. I can’t tell what this change did.',
    'I watched the repair step. I need to watch a check before I know its result.':
      'I saw that. Let’s test it before we say it helped.',
    'The check showed that repair step helped. I can try it when I have the same observations.':
      'That helped. I can try it when I see the same signs.',
    'The check showed no improvement from that repair step. I’ll remember that result.':
      'That didn’t help. I’ll remember that when I see the same signs.',
    'Our agreed learning session has ended. I’ll keep what I actually saw.':
      'That’s all the time we agreed on. I’ll keep what I saw.',
    'I left before the final observation. I did not see that result.':
      'I left before the result. I didn’t see how it turned out.',
    'I was present but did not follow that observation closely enough to learn it.':
      'I was here, but I didn’t follow that closely enough to learn it.',
    'I kept my own plans during that work.': 'I followed my own plans while you worked.',
    'I took a break instead of watching that step.': 'I took a break. I didn’t watch that step.',
  };
  if (Object.hasOwn(lines, text)) return lines[text] ?? text;
  const ready = text.match(
    /^I can start a lesson with you before (.+)\. Start it when you are ready\.$/,
  );
  if (ready) return `I have time to start before ${ready[1]}. Let me know when you’re ready.`;
  const accepted = text.match(/^I will watch this repair with you until (.+)\.$/);
  if (accepted) return `I’ll watch with you until ${accepted[1]}.`;
  return text;
}

/** Explain only consequences of this completed command. The simulation remains the authority. */
export function actionAccount(prior: GameState, command: Command, result: CommandResult): string {
  if (!result.ok) return result.message;
  const next = result.state;
  const previousLogId = prior.log.at(-1)?.id ?? -1;
  const earnedLogs = next.log.filter(
    (line) => line.id > previousLogId && line.speaker === 'Workshop',
  );
  if (command.type === 'next-day') {
    const paid = next.dailyCostsPaid - prior.dailyCostsPaid;
    const purpose = earnedLogs.findLast(
      (line) => line.text === `£${paid} covers supplies and shared workshop costs for today.`,
    )?.text;
    return `${result.message} ${purpose ?? (paid === 0 ? 'No workshop cost was taken.' : `Workshop costs: £${paid}.`)} Cash £${prior.cash} → £${next.cash}.`;
  }
  if (
    command.type === 'salvage' ||
    (command.type === 'work' && command.intervention === 'replace')
  ) {
    const component = prior.jobs
      .find((job) => job.id === command.jobId)
      ?.model.components.find((part) => part.id === command.componentId);
    if (!component) return result.message;
    const kind = component.kind;
    const count = next.stock[kind] ?? 0;
    const drawer = `Drawer ${kind}: ${prior.stock[kind] ?? 0} → ${count}.`;
    if (command.type === 'salvage') {
      const outcome = earnedLogs.findLast(
        (line) =>
          line.text.startsWith(`You recovered one working ${kind}.`) ||
          line.text.startsWith(`The recovered ${kind} is not usable.`),
      )?.text;
      return `${outcome ?? result.message} ${drawer}`;
    }
    return `${result.message} ${drawer}`;
  }
  return command.type === 'start-lesson' || command.type === 'watch'
    ? lessonWords('Sam', result.message)
    : result.message;
}
