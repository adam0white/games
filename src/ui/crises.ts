import { dayTime } from '../game/engine';
import type { GameState } from '../game/types';

export interface Crisis {
  jobId: string;
  text: string;
  urgent: boolean;
}

/**
 * Presentation only. Problems the player must see without opening the history: a promise past its time,
 * a promise due within the hour, and work Sam has stopped on. Says only what the screen already knows.
 */
export function workshopCrises(state: GameState): Crisis[] {
  const out: Crisis[] = [];
  for (const job of state.jobs) {
    if (job.isDonor || job.isPersonal || !['active', 'ready'].includes(job.status)) continue;
    const owner = state.people[job.ownerId]?.name ?? job.ownerId;
    if (job.due < state.now)
      out.push({
        jobId: job.id,
        urgent: true,
        text: `${owner} is waiting for ${job.title.toLowerCase()}. You said ${dayTime(job.due)}.`,
      });
    else if (job.due - state.now <= 60)
      out.push({
        jobId: job.id,
        urgent: false,
        text: `${job.title} is due back at ${dayTime(job.due)}.`,
      });
    if (job.assignedTo === 'sam' && job.blocked)
      out.push({
        jobId: job.id,
        urgent: false,
        text: `Sam has stopped on ${job.title.toLowerCase()}: ${job.blocked.reason}`,
      });
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
