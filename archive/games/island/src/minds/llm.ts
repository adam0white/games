import { type Mind, type MindFactory, type MindStep, type Observation, PERSONA } from '../types.ts';
import { type BackendResponse, createBackend } from './llm-backends.ts';

export interface LlmCost {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  /** Malformed/illegal action responses and failed action calls; each consumes one rest step. */
  invalid: number;
  /** Upper bound reserved for failed calls whose actual billed usage is unknown; excluded from confirmed usd. */
  unconfirmedUsd?: number;
}

export interface LlmMind extends Mind {
  cost(): LlmCost;
}

const BODY = `Your body can use only the listed legal action ids.
move N|S|E|W walks one cell: up at most one height level, down any distance, never into water.
jump N|S|E|W moves one cell up at most two levels, only with empty hands.
pick <id> picks the top object here or in an adjacent cell, only with empty hands.
place here or place N|S|E|W puts your carried object on top of that cell's stack.
throw N|S|E|W soft|hard throws your carried object two or four cells; it stops before higher ground.
Objects thrown into water are lost until reset.
rest waits for one step. look sees seven cells instead of four for that step.
N means north, S south, E east, W west. Each action uses one step.
Use the exact action ids from the legal list, including any object id shown there.`;

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parse(text: string): Record<string, unknown> | undefined {
  try {
    return object(JSON.parse(text));
  } catch {
    return undefined;
  }
}

function limit(value: unknown, fallback: number, integer = false): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isInteger(value))
  )
    throw new Error('LLM caps must be finite nonnegative numbers; maxCalls must be an integer');
  return value;
}

function describe(obs: Observation): string {
  return `Episode ${obs.episode + 1}, step ${obs.step}, ${obs.stepsLeft} steps left.
${obs.task ? `Task: ${obs.task}` : 'There is no task.'}
Observation:\n${obs.text}
Events:\n${obs.events.length ? obs.events.join('\n') : 'None.'}
Legal actions:\n${obs.actions.map((action, i) => `${i + 1}. ${action.id} — ${action.label}`).join('\n')}`;
}

const createMind = ((options): LlmMind => {
  const backend = createBackend(options);
  const maxCalls = limit(options.maxCalls, 40, true);
  const maxUsd = limit(options.maxUsd, 0.15);
  // Optional even share per episode (one call of it kept for the end-of-episode notes), so a small total budget
  // reaches the task episode instead of running out in free time.
  const perEpisode =
    options.maxCallsPerEpisode === undefined ? Infinity : limit(options.maxCallsPerEpisode, 0, true);
  let episodeCalls = 0;
  const totals: LlmCost = { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, invalid: 0 };
  let notes = '';
  let plan: string[] = [];
  let why = '';
  let episode: number | undefined;
  let history: string[] = [];
  let report: { text: string; boredom: number } | undefined;
  let stopped: string | undefined;

  function cap(prompt?: string): string | undefined {
    if (stopped) return stopped;
    if (totals.calls >= maxCalls) stopped = 'call cap reached, resting';
    else if (
      totals.usd + (totals.unconfirmedUsd ?? 0) >= maxUsd ||
      (prompt !== undefined &&
        totals.usd + (totals.unconfirmedUsd ?? 0) + (backend.estimateMaxUsd?.(prompt) ?? 0) > maxUsd)
    )
      stopped = 'cost cap reached, resting';
    return stopped;
  }

  function prefix(): string {
    return `${options.persona || PERSONA}\n\n${BODY}\n\nNotes carried from earlier episodes:\n${notes || 'None.'}`;
  }

  async function call(prompt: string): Promise<BackendResponse | undefined> {
    if (cap(prompt)) return undefined;
    totals.calls++;
    episodeCalls++;
    let response: BackendResponse;
    try {
      response = await backend.complete(prompt);
    } catch {
      const reserved = backend.estimateMaxUsd?.(prompt);
      if (reserved !== undefined) totals.unconfirmedUsd = (totals.unconfirmedUsd ?? 0) + reserved;
      throw new Error('Backend request failed');
    }
    totals.inputTokens += response.inputTokens;
    totals.outputTokens += response.outputTokens;
    totals.usd += response.usd;
    return response;
  }

  return {
    name: `llm-${backend.name}`,
    cost: () => ({ ...totals }),
    async step(obs): Promise<MindStep> {
      if (episode !== obs.episode) {
        episode = obs.episode;
        episodeCalls = 0;
        plan = [];
        history = [];
      }
      history.push(describe(obs));
      const rest = (reason: string): MindStep => {
        history.push(`Action: rest. Reason: ${reason}`);
        return { action: 'rest', why: reason };
      };
      const reason = cap();
      if (reason) return rest(reason);

      // Replan on news, not on the echo of the mind's own routine step ("You walk north.").
      const news = obs.events.some((e) => !/^You (walk|jump|rest|look|pick up|place)\b/.test(e));
      if (news || !plan.length || !obs.actions.some((action) => action.id === plan[0])) {
        plan = [];
        if (episodeCalls >= perEpisode - 1) return rest('episode call share used, resting');
        const prompt = `${prefix()}\n\n${describe(obs)}
Answer only JSON: {"plan":["<action id>","..."],"why":"<one sentence>"}.
Plan from one to eight actions. Return action ids, not the list numbers.
Your next observation may change which actions are legal.`;
        try {
          const response = await call(prompt);
          if (!response) return rest(stopped ?? 'call cap reached, resting');
          const parsed = parse(response.text);
          const first = parsed && Array.isArray(parsed.plan) ? parsed.plan[0] : undefined;
          if (
            !parsed ||
            !Array.isArray(parsed.plan) ||
            parsed.plan.length < 1 ||
            parsed.plan.length > 8 ||
            !parsed.plan.every((id: unknown) => typeof id === 'string' && id.length > 0) ||
            typeof parsed.why !== 'string' ||
            !parsed.why.trim() ||
            !obs.actions.some((action) => action.id === first)
          ) {
            totals.invalid++;
            return rest('invalid model output, resting');
          }
          plan = parsed.plan as string[];
          why = parsed.why;
        } catch {
          totals.invalid++;
          return rest('backend call failed, resting');
        }
      }
      const action = plan.shift();
      // A parsed plan always has an action; keep the fallback explicit under noUncheckedIndexedAccess.
      if (!action) return rest('empty plan, resting');
      history.push(`Action: ${action}. Reason: ${why}`);
      return { action, why };
    },
    async endEpisode(obs) {
      plan = [];
      report = undefined;
      const prompt = `${prefix()}\n\nExperience this episode:\n${history.join('\n\n')}
Final observation:\n${describe(obs)}
The episode is over. The same island and objects reset next time. Only your notes carry across the reset.
Answer only JSON: {"notes":"<at most 120 words to keep for next time>","boredom":0,"feeling":"<one sentence>"}.
Report boredom as a number from 0 to 10.`;
      try {
        const response = await call(prompt);
        const parsed = response && parse(response.text);
        if (
          parsed &&
          typeof parsed.notes === 'string' &&
          typeof parsed.boredom === 'number' &&
          Number.isFinite(parsed.boredom) &&
          parsed.boredom >= 0 &&
          parsed.boredom <= 10 &&
          typeof parsed.feeling === 'string'
        ) {
          notes = parsed.notes.trim().split(/\s+/).slice(0, 120).join(' ');
          report = { text: parsed.feeling, boredom: parsed.boredom };
        }
      } catch {
        // Keep the last valid notes and omit this episode's report on transport failure.
      } finally {
        history = [];
      }
      return notes;
    },
    async selfReport() {
      return report && { ...report };
    },
  };
}) satisfies MindFactory;

export default createMind;
