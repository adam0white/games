import { dayTime } from '../game/engine';
import type { GameState } from '../game/types';

/** A title inside a sentence, keeping a person's name: "Nora’s reading light". */
export function inSentence(title: string): string {
  const [first = '', ...rest] = title.split(' ');
  return [
    /[’']s$/.test(first) ? first : first.toLowerCase(),
    ...rest.map((w) => w.toLowerCase()),
  ].join(' ');
}

export interface Crisis {
  jobId: string;
  text: string;
  urgent: boolean;
  /** Where the answer lives, when it is not the object's bench. */
  people?: boolean;
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
        text: `${owner} is waiting for ${inSentence(job.title)}. You said ${dayTime(job.due)}.`,
      });
    else if (job.due < state.now - (state.now % 1440) + 1440)
      out.push({
        jobId: job.id,
        urgent: false,
        text: `${job.title} is due back today, at ${dayTime(job.due)}.`,
      });
    if (job.assignedTo === 'sam' && job.blocked)
      out.push({
        jobId: job.id,
        urgent: false,
        text: `Sam has stopped on ${inSentence(job.title)}: ${job.blocked.reason}`,
      });
  }
  const request = state.pendingRequest;
  if (
    request?.status === 'ready' &&
    request.readyUntil !== undefined &&
    request.readyUntil >= state.now
  )
    out.push({
      jobId: request.jobId ?? state.selectedJobId,
      urgent: false,
      people: true,
      text: `Sam is ready for the ${request.kind === 'lesson' ? 'lesson' : 'repair'} until ${dayTime(request.readyUntil)}.`,
    });
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
 * Presentation only. What people said in the last two hours of today, newest first, so speech reaches the bench instead of History.
 * Only lines a person said; the workshop's own notes and the player's lines stay in History.
 */
export function todaysWords(state: GameState, limit = 3): SpokenLine[] {
  const names = new Set(Object.values(state.people).map((p) => p.name));
  // Two hours: long enough to come back to, short enough that a morning offer does not linger all day.
  const since = Math.max(state.now - (state.now % 1440), state.now - 120);
  return state.log
    .filter((e) => e.at >= since && names.has(e.speaker))
    .slice(-limit)
    .reverse();
}
