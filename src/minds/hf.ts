/**
 * SCOPE: one HF person attends to island events, lives one minute per step, and samples HF-scored legal
 * inputs. The engagement and habituation bridge follows playtester/session.ts at one beat per minute.
 * Action novelty comes from the person's own episodic record. Only the stated task supplies a goal.
 * An episode is one HF activity: its realized leisure and competence teach an expectation for that stretch,
 * never a rule or payoff per input. Across resets only the Person survives, including its JSON RNG and memory.
 * This covers needs, attention, appraisal, habituation and boredom. It supplies no motor planning, hidden-rule
 * knowledge, rule learning per input, invented projects, or search: it can only find what its action list offers.
 * Coefficients are engineering premises from the playtester, not calibrated human measurements.
 */
import {
  type Affordance,
  abandonGoal,
  actionTendencies,
  adoptGoal,
  begin,
  type Considered,
  createPerson,
  decide,
  emotionLevel,
  feel,
  finish,
  lifeModifiers,
  MINUTES_PER_YEAR,
  type Percept,
  type Person,
  perceive,
  random,
  readPerson,
  remember,
  scoreAll,
  tendencyEmotions,
  tick,
} from '@adam0white/human-framework';
import type { Action, Mind, MindFactory, MindOptions, MindStep, Observation } from '../types.ts';

// SESSION_DEFAULTS, with seconds converted to minutes. No style.ts policy is used.
const S = {
  engagementHalfLifeBase: 20 / 60,
  engagementHalfLifeSpan: 70 / 60,
  habituationBase: 0.3,
  habituationSpan: 0.7,
  habituationHalfLife: 1,
  neutralStim: 0.12,
  appraisalScale: 0.5,
  boredLine: 0.35,
  boredGainBase: 0.25,
  boredGainSpan: 0.5,
  playLeisure: 0.02,
  competenceRate: 0.03,
  promiseCompetence: 0.3,
  actionFocus: 0.03,
  temperature: 0.03,
  // "Recently" is twenty lived minutes, independent of the world's episode/step counters.
  actionRecentMinutes: 20,
};
const TASK_LABEL = 'put cubes on the Spire';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const directions: Record<string, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

/** Task interpretation only: no unseen Spire, route, throw physics, ring rule or rock rule. */
export function taskAdvances(obs: Observation, action: Action): boolean {
  if (!obs.task) return false;
  const [verb, target] = action.id.split(' ');
  if (verb === 'pick') return obs.seen.things.some((thing) => thing.id === target && thing.kind === 'cube');
  if (!obs.seen.carrying?.startsWith('cube-')) return false;
  if (verb === 'place' && target === 'here') return obs.seen.here.onSpire;
  const delta = target ? directions[target] : undefined;
  const spire = obs.seen.spire;
  if (!delta || !spire) return false;
  if (verb === 'place') return delta.dx === spire.dx && delta.dy === spire.dy;
  if (verb !== 'move' && verb !== 'jump') return false;
  return (
    Math.abs(spire.dx - delta.dx) + Math.abs(spire.dy - delta.dy) < Math.abs(spire.dx) + Math.abs(spire.dy)
  );
}

function inputIdentity(action: Action): { action: string; targetId: string } {
  return { action: `island:input:${action.kind}`, targetId: action.id.split(' ').slice(1).join(' ') };
}

/** All inputs share a base promise. Tags read only the action class, own recent inputs and the stated task. */
export function inputOffers(person: Person, obs: Observation): Affordance[] {
  const goal = person.agenda.goals.find((item) => item.label === TASK_LABEL && item.status === 'active');
  return obs.actions.map((action) => {
    const identity = inputIdentity(action);
    const recent = person.memory.episodes.some(
      (episode) =>
        episode.kind === 'island-input' &&
        episode.action === identity.action &&
        episode.targetId === identity.targetId &&
        person.now - episode.at < S.actionRecentMinutes,
    );
    const tags: string[] = [];
    if (!recent) tags.push('novel');
    if (action.kind === 'rest' || action.kind === 'look') tags.push('rest');
    const advances = taskAdvances(obs, action);
    if (advances) tags.push('goal');
    const exertion = action.kind === 'climb' || action.id.startsWith('jump ') || action.kind === 'throw';
    return {
      id: action.id,
      ...identity,
      label: action.label,
      duration: 1,
      effort: (exertion ? 0.2 : 0) + (obs.seen.carrying ? 0.08 : 0),
      focus: S.actionFocus,
      advertises: { competence: S.promiseCompetence },
      tags,
      ...(advances && goal ? { advances: [goal.id] } : {}),
    };
  });
}

/** The playtester's input scorer: no activity inertia, mutation or custom utility terms. */
export function scoreInputs(person: Person, offers: Affordance[]): Considered[] {
  const { body, needs, desperation } = readPerson(person);
  return scoreAll(person, offers, {
    id: 'island-input',
    now: person.now,
    body,
    needs,
    desperation,
    mods: lifeModifiers(person),
    tendencies: actionTendencies(person),
    tendencyEmotions: tendencyEmotions(person),
    habit: { now: person.now },
    necessity: true,
  }).considered;
}

/** Classify only what the event says. Directions and object ids do not make a familiar kind new. */
function eventReading(text: string, here: Observation['seen']['here']): { kind: string; valence: number } {
  const words = text.toLowerCase();
  if (/glow/.test(words)) return { kind: 'ring-glow', valence: 0.3 };
  if (/lost|sank|sinks|sunk/.test(words)) return { kind: 'lost-object', valence: -0.25 };
  if (/blocked|cannot|can't/.test(words)) return { kind: 'blocked', valence: -0.2 };
  if (/new cube|cube[^.]*(appears|emerges|breaks off)/.test(words))
    return { kind: 'new-cube', valence: 0.25 };
  if (/(reach|arriv|climb|you are|you stand)/.test(words) && /hilltop|spire/.test(words))
    return { kind: 'hilltop', valence: 0.2 };
  const movement = /\b(walk|move|jump)\w*\b/.exec(words)?.[1];
  if (movement && (here.onSpire || here.terrain === 'hilltop')) return { kind: 'hilltop', valence: 0.2 };
  const verb =
    movement === 'walk' ? 'move' : /\b(move|jump|pick|place|throw|rest|look)\w*\b/.exec(words)?.[1];
  return { kind: verb ?? words.replace(/\d+/g, '#'), valence: 0 };
}

function novelty(person: Person, kind: string): number {
  const count = person.memory.episodes.reduce(
    (sum, episode) =>
      sum + (episode.action === kind ? 2 ** (-(person.now - episode.at) / S.habituationHalfLife) : 0),
    0,
  );
  const habit = S.habituationBase + S.habituationSpan * person.traits.openness;
  return 1 / (1 + habit * count);
}

function pickSoftmax(person: Person, scored: Considered[]): Considered {
  const choices = scored.filter((item) => Number.isFinite(item.utility) && !item.vetoed);
  if (choices.length === 0) throw new Error('HF has no scored legal action');
  const top = Math.max(...choices.map((item) => item.utility));
  const weights = choices.map((item) => Math.exp((item.utility - top) / S.temperature));
  let draw = random(person.rng) * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, choice] of choices.entries()) {
    draw -= weights[index] ?? 0;
    if (draw <= 0) return choice;
  }
  return choices[choices.length - 1] as Considered;
}

/** Public, inspectable state for experimental auditing. Contains personal state, never an observation or map. */
export interface HfState {
  person: Person;
  engagement: number;
  stretch: { steps: number; leisure: number; competence: number } | null;
}

export class HfMind implements Mind {
  readonly name: string;
  readonly state: HfState;
  private readonly boredom: boolean;

  constructor(options: MindOptions) {
    this.boredom = options.boredom !== false;
    this.name = this.boredom ? 'hf' : 'hf-no-boredom';
    this.state = {
      person: createPerson({
        id: 'islander',
        name: 'the curious islander',
        seed: options.seed,
        now: 12 * 60,
        bornAt: 12 * 60 - 30 * MINUTES_PER_YEAR,
        sex: 'female',
        traits: { openness: 0.8, agreeableness: 0.2 },
        norms: [],
      }),
      engagement: 0.6,
      stretch: null,
    };
  }

  step(obs: Observation): MindStep {
    if (obs.actions.length === 0) throw new Error('HF requires at least one legal action');
    const { person } = this.state;
    if (!this.state.stretch) {
      const activity: Affordance = {
        id: 'island-life',
        action: 'island-life',
        label: 'this stretch on the island',
        duration: Math.max(1, obs.stepsLeft),
        effort: 0,
        focus: S.actionFocus,
        advertises: { leisure: S.playLeisure * this.state.engagement * obs.stepsLeft },
      };
      begin(person, activity, decide(person, [activity]));
      this.state.stretch = { steps: 0, leisure: 0, competence: 0 };
    }
    const stretch = this.state.stretch;
    if (
      obs.task &&
      !person.agenda.goals.some((goal) => goal.label === TASK_LABEL && goal.status === 'active')
    )
      adoptGoal(
        person,
        {
          label: TASK_LABEL,
          serves: ['competence'],
          advancedBy: [],
          importance: 0.5,
          deadline: person.now + obs.stepsLeft,
        },
        person.now,
      );

    this.receive(obs);
    const mean = this.state.engagement; // one beat per minute
    const gain = S.boredGainBase + S.boredGainSpan * (1 - person.traits.agreeableness);
    // The ablation has exactly one causal switch. All other updates and offers share this path.
    if (this.boredom && stretch.steps > 0 && mean < S.boredLine)
      feel(person, 'boredom', clamp(gain * (1 - mean / S.boredLine)), 'island:dull', person.now);
    stretch.leisure += S.playLeisure * mean;
    stretch.steps++;

    const chosen = pickSoftmax(person, scoreInputs(person, inputOffers(person, obs)));
    const action = obs.actions.find((item) => item.id === chosen.affordanceId) as Action;
    remember(person, {
      at: person.now,
      kind: 'island-input',
      ...inputIdentity(action),
      actorId: person.id,
      valence: 0,
      summary: action.label,
      tags: ['island-input'],
    });
    const why = [...chosen.terms]
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.source.localeCompare(b.source))
      .slice(0, 3)
      .map((term) => `${term.source}=${term.value.toFixed(4)}`)
      .join('; ');
    const inner = this.readings();
    // HF's satisfied leisure store cannot trigger its separate hourly need-boredom injection. Dullness above
    // supplies the session emotion; tick still advances every ordinary faculty identically in both arms.
    tick(person, person.now + 1);
    return { action: action.id, why, inner };
  }

  endEpisode(obs: Observation): string {
    const { person, stretch } = this.state;
    // The runner's closing observation contains the last action's outcome. Receive it once, at the existing
    // clock time: it is feedback from the final minute, not another minute or another legal input.
    if (stretch) this.receive(obs);
    if (stretch && person.activity)
      finish(person, {
        affordanceId: person.activity.affordanceId,
        action: person.activity.action,
        status: 'completed',
        at: person.now,
        needs: { leisure: stretch.leisure, competence: stretch.competence },
        summary: 'a stretch on the island',
      });
    for (const goal of person.agenda.goals)
      if (goal.label === TASK_LABEL && goal.status === 'active') abandonGoal(person, goal.id);
    const readings = this.readings();
    const gist = Object.entries(readings)
      .map(([key, value]) => `${key}=${value.toFixed(3)}`)
      .join('; ');
    this.state.engagement = 0.6;
    this.state.stretch = null;
    return gist;
  }

  private receive(obs: Observation): void {
    const { person, stretch } = this.state;
    const percepts: Percept[] = obs.events.map((summary) => {
      const reading = eventReading(summary, obs.seen.here);
      const kind = `island:event:${reading.kind}`;
      return {
        at: person.now,
        channel: 'saw',
        kind,
        targetId: person.id,
        salience: novelty(person, kind),
        valence: S.appraisalScale * reading.valence,
        summary,
      };
    });
    // perceive already appraises attended valence into HF emotion and remembers it. Do not feel it twice.
    const attended = perceive(person, percepts);
    let stimulation = 0;
    let reward = 0;
    let setback = 0;
    for (const percept of attended) {
      const valence = eventReading(percept.summary, obs.seen.here).valence;
      // Intrinsic event salience is uniformly 1. The person's novelty supplies the single habituation factor,
      // and is also the salience offered to HF attention. Do not multiply it into stimulation a second time.
      stimulation += (S.neutralStim + (1 - S.neutralStim) * Math.abs(valence)) * percept.salience;
      const weight = Math.abs(valence) < 0.2 ? 0.5 : 1;
      if (valence > 0) reward += weight * valence * percept.salience;
      if (valence < 0) setback -= weight * valence * percept.salience;
    }
    const halfLife = S.engagementHalfLifeBase + S.engagementHalfLifeSpan * person.traits.agreeableness;
    this.state.engagement *= 2 ** (-1 / halfLife);
    this.state.engagement += (1 - this.state.engagement) * Math.min(1, stimulation);
    if (stretch)
      stretch.competence += Math.max(
        -S.competenceRate,
        Math.min(S.competenceRate, S.competenceRate * (reward - setback)),
      );
  }

  private readings(): Record<string, number> {
    return {
      boredom: clamp(emotionLevel(this.state.person, 'boredom')),
      engagement: clamp(this.state.engagement),
      leisure: clamp(this.state.person.needs.leisure),
    };
  }
}

const createMind: MindFactory = (options) => new HfMind(options);
export default createMind;
