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

export interface SpokenLine {
  id: number;
  at: number;
  speaker: string;
  text: string;
  tone: 'ordinary' | 'good' | 'warning';
}

/**
 * Presentation only. What people said today, newest first, so speech reaches the bench instead of History.
 * Only lines a person said; the workshop's own notes and the player's lines stay in History.
 */
export function todaysWords(state: GameState, limit = 3): SpokenLine[] {
  const names = new Set(Object.values(state.people).map((p) => p.name));
  const dayStart = state.now - (state.now % 1440);
  return state.log
    .filter((e) => e.at >= dayStart && names.has(e.speaker))
    .slice(-limit)
    .reverse();
}
