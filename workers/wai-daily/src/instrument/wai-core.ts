/** Pure daily-player rules shared by the local runner and the Worker cron: no Node or browser imports. */
import registry from '../../../../games.json' with { type: 'json' };
import { namedTapRoles, type PlayOp, validatePlayOp } from './play-helpers.ts';

/** Playable games only: a recorded viewer has no decisions to make. */
export const GAMES = (registry.games as { slug: string; kind?: string }[])
  .filter((game) => game.kind !== 'recorded-viewer')
  .map((game) => ({ id: game.slug, href: `https://play.adamwhite.work/${game.slug}/` }));

export const PERSONAS = ['Maya Chen', 'Emre Kaya', 'Nia Okafor'];
export const MODELS = [
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/meta/llama-3.2-11b-vision-instruct',
];
export function responseText(result: Record<string, unknown>): string {
  if (typeof result.response === 'string' && result.response.trim()) return result.response;
  const choices = result.choices;
  if (Array.isArray(choices)) {
    const message = choices[0]?.message;
    if (message && typeof message === 'object') {
      for (const key of ['content', 'reasoning']) {
        const value = (message as Record<string, unknown>)[key];
        if (typeof value === 'string' && value.trim()) return value;
      }
    }
  }
  throw new Error('Model returned no text response');
}
export function actionableNames(controls: string): { role: string; name: string }[] {
  const entries: { role: string; name: string }[] = [];
  for (const line of controls.split('\n')) {
    const entry = line.replace(/^\s*-\s+/u, '');
    const text = entry.startsWith("'") ? entry.slice(1, entry.lastIndexOf("'")).replace(/''/gu, "'") : entry;
    const match = /^(\S+)\s+("(?:\\.|[^"\\])*")/u.exec(text);
    if (!match?.[1] || !match[2] || !namedTapRoles.includes(match[1])) continue;
    try {
      entries.push({ role: match[1], name: JSON.parse(match[2]) as string });
    } catch {
      /* malformed snapshot label is not actionable evidence */
    }
  }
  return entries;
}
export function normalizeTapName(op: PlayOp, controls: string): PlayOp {
  if (op.op !== 'tap' || !('name' in op) || typeof op.name !== 'string') return op;
  const names = actionableNames(controls);
  // A literal accessible name always wins, even when it resembles a role wrapper.
  if (names.some((entry) => entry.name === op.name)) return op;
  const matches = names.filter(
    (entry) =>
      (!op.role || op.role === entry.role) && `${entry.role} ${JSON.stringify(entry.name)}` === op.name,
  );
  if (matches.length !== 1 || !matches[0]) return op;
  return { ...op, name: matches[0].name };
}
/** The focused game rotates over the registry by UTC day; the persona rotates independently. */
export function dailyPlan(date: Date, ceilings: { focused: number; control: number }) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const game = GAMES[day % GAMES.length];
  if (!game) throw new Error('Empty games registry');
  const persona = PERSONAS[day % PERSONAS.length] ?? PERSONAS[0];
  const model = MODELS[0] ?? '';
  return [
    {
      model,
      game: game.id,
      url: game.href,
      persona,
      floor: 0,
      ceiling: ceilings.focused,
      control: false,
      task: 'Complete one meaningful decision and observe its consequence. Then stop with FINISHED and report the decision, consequence and any confusion. This is a focused task, not a whole-game completion claim.',
    },
    {
      model,
      game: 'darkroom',
      url: 'https://adarkroom.doublespeakgames.com/',
      persona,
      floor: 0,
      ceiling: ceilings.control,
      control: true,
      task: 'Complete one opening decision and observe its consequence, then stop with FINISHED and report. Use this to check the same visible-text, action and final-report path on an independent game; this is not a matched game-quality comparison.',
    },
  ];
}
export interface ModelAnswer {
  op: unknown;
  report?: string;
}
export function answer(text: string): ModelAnswer {
  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')) as ModelAnswer;
  const op = validatePlayOp(parsed.op);
  if (['open', 'resize'].includes(op.op)) throw new Error('Player may not reset the session');
  if (op.op === 'shot' && !/^[a-zA-Z0-9_-]+\.png$/u.test(op.file)) throw new Error('Invalid screenshot name');
  if (op.op === 'wait' && (op.s < 1 || op.s > 30)) throw new Error('Wait must be 1–30 seconds');
  return {
    op,
    report: typeof parsed.report === 'string' ? parsed.report : undefined,
  };
}
/** Same UTC date as the Chicago afternoon, with at least 30 minutes before reset. */
export function scheduledDue(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const utcDay = now.toISOString().slice(0, 10);
  const localDay = `${part('year')}-${part('month')}-${part('day')}`;
  const reset = Date.parse(`${utcDay}T00:00:00Z`) + 86_400_000;
  return localDay === utcDay && Number(part('hour')) >= 16 && reset - now.getTime() >= 1_800_000;
}

export type DailySession = Omit<ReturnType<typeof dailyPlan>[number], 'task'> & { task?: string };
/** One driver reply as the model sees it: visible text, accessible controls and any coordinator note. */
export interface DriverReply {
  visible?: string;
  controls?: string;
  error?: string;
  elapsed_s?: number;
  [key: string]: unknown;
}
export function personaBrief(panel: string, persona: string | undefined): string {
  const brief = panel.split(`### ${persona}\n`)[1]?.split('\n### ')[0]?.split('\n## ')[0];
  if (!brief) throw new Error('Persona brief missing');
  return brief;
}
export function systemPrompt(protocol: string, brief: string, session: DailySession): string {
  return `${protocol}\nYour own persona brief: ${brief}\nYou have set aside time to explore.\nAssignment: ${JSON.stringify(session)}\nDevice: desktop driver. You receive visible text and accessible controls only; ${session.model.includes('vision') ? 'A current viewport screenshot is supplied with each decision; only report visual checks you actually observe.' : 'Screenshots are NOT supplied, so visual-only checks are NOT TESTED.'} Output JSON only: {"op": <one valid lab:play operation>, "report": <optional final report>}. Ops: tap(name or text or x,y), select(name or label,option), type(name,text), key(key), scroll(dy), wait(s=1..30), shot(file), log(kind,reaction,reason,engagement). Include reaction metadata on actions. Never invent a control. Log first_minute after 60 seconds and pulses every three minutes. Stop via log(kind=stop,reason,reaction) and provide report. Do not send feedback or change consent settings. When you stop, include your final report in the same JSON response; it is saved locally.`;
}
export function turnPrompt(
  elapsed: number,
  session: DailySession,
  closing: boolean,
  reply: DriverReply,
): string {
  return JSON.stringify({
    elapsed_minutes: elapsed,
    floor: session.floor,
    ceiling: session.ceiling,
    stage: closing
      ? 'Closing: log stop with your final report. No more gameplay or feedback submission.'
      : 'Play',
    snapshot: reply,
    actionableNames: actionableNames(reply.controls ?? ''),
    instruction:
      'Return exactly one JSON object for the next operation, not a diary or report. For named taps use only the exact inner name from actionableNames: if controls show button "Begin", send name: "Begin", never name: "button \\"Begin\\"". Do not include the role in name. Example: {"op":{"op":"tap","name":"EXACT CURRENT CONTROL"},"report":null}. Replace the example name with an actual current control, or choose another documented operation. Do not claim a future input, result or elapsed checkpoint. A final report is allowed only with a stop operation. First-minute notes require actual elapsed_minutes >= 1; pulses require actual elapsed time, never invented future times.',
  });
}
