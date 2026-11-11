/**
 * SCOPE: HF 2.9.0 public API only. Same person/temperament as hf. One action is one activity and one
 * lived minute; its next observation closes it, including the episode's last action. No world imports,
 * task interpreter, invented projects, map, search, or recipe knowledge. Places use dead reckoning from
 * the reset origin (0,0), not hidden absolute world coordinates. Memory survives resets, body origin resets.
 * Every sight/event is offered to attention and encoded once even if unattended: the host supplies visible
 * facts, HF bounds/forgets them. Recall is HF cue recall, then exact filtering (HF cues use partial overlap).
 * Engagement half-life = 4 minutes. New routine movement supplies 0.12 stimulation: its steady
 * engagement is 0.46, above the 0.35 boredom line; a half-habituated repeat supplies 0.06, giving 0.29,
 * below it (e*=s/(1-r+r*s), r=2^(-1/4)). Manipulation/discovery supplies 0.55, look 0.18, rest 0.04.
 * Repeats habituate with a 30-minute recovery half-life. These are engineering premises, not human
 * measurements. The first calibration (0.55 for every effect) left all normal HF2 runs above the line;
 * this revision separates routine effects from manipulation before the final comparison. No stimulation
 * floor. Effect identity = event kind + object/body + observed place.
 * HF tick proposes hourly; explicit public proposeGoals is also called at those boundaries, idempotently,
 * to audit its returned path. HF's urgency threshold and one-proposal/day limit remain intact.
 * API LIMIT: Affordance has no serves/spatial goal predicate. Host declarations below bind advertised need
 * effects to generic need goals. The stated task binds ONLY the concrete cube-placement action name at the
 * observed Spire cell; no task-specific pickup/movement links. HF cannot infer those means from placeId.
 * hf3 adds attended world-semantic trigger → placement claims and temporal task valuation (60-minute half-life).
 * no-goals leaves tick's proposals intact but omits all goal links, including the adopted task's action match.
 * no-memory encodes no placeId and offers object-directed movement only from current sight.
 */
import {
  type Affordance,
  adoptGoal,
  begin,
  type Considered,
  createPerson,
  decide,
  emotionLevel,
  feel,
  finish,
  MINUTES_PER_YEAR,
  type NeedId,
  type Percept,
  type Person,
  perceive,
  proposeGoals,
  type ReceivedConsequence,
  random,
  readPerson,
  recall,
  remember,
  tick,
} from 'hfLegacy';
import type {
  Cell,
  GoalReading,
  Inner,
  Mind,
  MindFactory,
  MindOptions,
  MindStep,
  Observation,
} from '../types.ts';
import { scoreInputs } from './hf.ts';

const delta: Record<string, Cell> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};
const place = (p: Cell) => `cell:${p.x},${p.y}`;
const add = (p: Cell, d: Cell) => ({ x: p.x + d.x, y: p.y + d.y });
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const parsePlace = (id: string): Cell => {
  const [x, y] = id.slice(5).split(',').map(Number);
  return { x: x ?? 0, y: y ?? 0 };
};
export interface Offer extends Affordance {
  input: string;
  fromMemory: boolean;
  serves: NeedId[];
  effectTarget: string;
  effectPlace: string;
}

function choose(person: Person, considered: Considered[]): Considered {
  const choices = considered.filter((c) => Number.isFinite(c.utility) && !c.vetoed);
  if (!choices.length) throw new Error('HF2 has no scored legal offer');
  const top = Math.max(...choices.map((c) => c.utility));
  const weights = choices.map((c) => Math.exp((c.utility - top) / 0.03));
  let draw = random(person.rng) * weights.reduce((s, w) => s + w, 0);
  for (const [i, c] of choices.entries()) {
    draw -= weights[i] ?? 0;
    if (draw <= 0) return c;
  }
  return choices[choices.length - 1] as Considered;
}

function eventKind(text: string): string {
  if (text.includes('ring glows')) return 'ring-glow';
  if (text.includes('breaks off')) return 'new-cube';
  if (text.includes('lost')) return 'lost';
  return /You (walk|jump|pick|place|throw|look|rest)/.exec(text)?.[1]?.replace('walk', 'move') ?? 'event';
}

function effectStimulation(kind: string): number {
  if (['pick', 'place', 'throw', 'new-cube', 'ring-glow', 'lost'].includes(kind)) return 0.55;
  if (kind === 'look') return 0.18;
  if (kind === 'rest') return 0.04;
  return 0.12;
}

export class Hf2Mind implements Mind {
  readonly name: string;
  readonly person: Person;
  engagement = 0.6;
  private readonly consequences: boolean;
  private readonly memory: boolean;
  private readonly goals: boolean;
  private readonly boredom: boolean;
  private here: Cell = { x: 0, y: 0 };
  private pending: Offer | null = null;
  private taskId: string | undefined;
  private taskEpisode = -1;
  private proposalChecks = 0;
  private proposalMaxUrgency = 0;
  private goalHistory = new Map<string, GoalReading>();

  constructor(options: MindOptions) {
    this.consequences = options.consequences === true;
    this.memory = options.memory !== false;
    this.goals = options.goals !== false;
    this.boredom = options.boredom !== false;
    this.name = this.consequences
      ? 'hf3'
      : !this.memory
        ? 'hf2-no-memory'
        : !this.goals
          ? 'hf2-no-goals'
          : !this.boredom
            ? 'hf2-no-boredom'
            : 'hf2';
    this.person = createPerson({
      id: 'islander',
      name: 'the curious islander',
      seed: options.seed,
      now: 720,
      bornAt: 720 - 30 * MINUTES_PER_YEAR,
      sex: 'female',
      traits: { openness: 0.8, agreeableness: 0.2 },
      norms: [],
    });
  }

  private novelty(kind: string, targetId: string, placeId: string): number {
    // recall is fuzzy cue overlap, so exact-filter its results before counting an effect.
    const matches = recall(this.person, {
      action: kind,
      targetId,
      ...(this.memory ? { placeId } : {}),
      limit: 256,
    });
    const count = matches.reduce(
      (n, ep) =>
        n +
        (ep.kind === 'island-effect' &&
        ep.action === kind &&
        ep.targetId === targetId &&
        (!this.memory || ep.placeId === placeId)
          ? 2 ** (-(this.person.now - ep.at) / 30)
          : 0),
      0,
    );
    return 1 / (1 + count);
  }

  private encode(percepts: Percept[], kind: string): void {
    const attended = new Set(perceive(this.person, percepts));
    // Compare public percept identities; encode unattended visible facts explicitly.
    for (const pc of percepts) {
      if (
        [...attended].some(
          (a) =>
            a.kind === pc.kind &&
            a.targetId === pc.targetId &&
            a.placeId === pc.placeId &&
            a.summary === pc.summary,
        )
      )
        continue;
      remember(this.person, {
        at: pc.at,
        kind,
        action: pc.kind,
        targetId: pc.targetId,
        ...(pc.placeId ? { placeId: pc.placeId } : {}),
        valence: pc.valence ?? 0,
        summary: pc.summary,
        tags: [kind],
        salience: pc.salience,
      });
    }
  }

  private receive(obs: Observation): void {
    const p = this.person;
    const previous = this.pending;
    if (previous) {
      const [verb, direction] = previous.input.split(' ');
      if ((verb === 'move' || verb === 'jump') && direction && delta[direction])
        this.here = add(this.here, delta[direction]);
    }
    let stimulation = 0;
    let competence = 0;
    for (const summary of obs.events) {
      const kind = eventKind(summary);
      const targetId = /cube-\d+|\brock\b|\bring\b/.exec(summary)?.[0] ?? previous?.effectTarget ?? p.id;
      const visible = obs.seen.things.find((t) => t.id === targetId);
      // Throws onto land report a landing offset. A lost object has only its launch place observed.
      let cell = visible ? add(this.here, { x: visible.dx, y: visible.dy }) : this.here;
      const landing = /It lands (.+)\./.exec(summary)?.[1];
      if (landing) {
        cell = { ...this.here };
        for (const match of landing.matchAll(/(\d+) (east|west|north|south)/g)) {
          const d =
            delta[
              ({ east: 'E', west: 'W', north: 'N', south: 'S' } as Record<string, string>)[match[2] ?? ''] ??
                ''
            ];
          if (d) cell = add(cell, { x: d.x * Number(match[1]), y: d.y * Number(match[1]) });
        }
      }
      const at = place(cell);
      const novel = this.novelty(kind, targetId, at);
      const lost = kind === 'lost';
      const valence = lost ? -0.25 : kind === 'ring-glow' || kind === 'new-cube' ? 0.3 : 0;
      const pc: Percept = {
        at: p.now,
        channel: 'outcome',
        kind,
        targetId,
        ...(this.memory ? { placeId: at } : {}),
        salience: novel,
        valence,
        summary,
      };
      this.encode([pc], 'island-percept');
      // Dedicated effect record makes the count independent of attention's episode kind and outcomes.
      remember(p, {
        at: p.now,
        kind: 'island-effect',
        action: kind,
        targetId,
        ...(this.memory ? { placeId: at } : {}),
        valence,
        summary,
        tags: ['island-effect'],
        salience: novel,
      });
      if (previous) {
        stimulation += effectStimulation(kind) * novel;
        if (lost) competence -= 0.04;
        else if (['pick', 'place', 'throw'].includes(kind)) competence += 0.025 * novel;
        else if (kind === 'new-cube' || kind === 'ring-glow') competence += 0.04 * novel;
      }
    }
    if (previous) {
      this.engagement *= 2 ** (-1 / 4);
      this.engagement += (1 - this.engagement) * Math.min(1, stimulation);
    }
    if (previous) {
      finish(p, {
        affordanceId: previous.id,
        action: previous.action,
        at: p.now,
        status: obs.events.length ? 'completed' : 'interrupted',
        needs: { leisure: 0.025 * Math.min(1, stimulation), competence },
        summary: obs.events.join(' '),
      });
      this.pending = null;
    }
    const objects = obs.seen.things.map((t) => ({ id: t.id, cell: add(this.here, { x: t.dx, y: t.dy }) }));
    if (obs.seen.spire)
      objects.push({ id: 'Spire', cell: add(this.here, { x: obs.seen.spire.dx, y: obs.seen.spire.dy }) });
    if (obs.seen.carrying) objects.push({ id: obs.seen.carrying, cell: this.here });
    this.encode(
      [
        ...objects.map(
          (o): Percept => ({
            at: p.now,
            channel: 'saw',
            kind: 'island-object',
            targetId: o.id,
            ...(this.memory ? { placeId: place(o.cell) } : {}),
            salience: 0.5,
            valence: 0,
            summary: `${o.id} observed${this.memory ? ` at ${place(o.cell)}` : ''}`,
          }),
        ),
        ...this.consequencePercepts(obs),
      ],
      'island-object',
    );
  }

  /** World semantics only: one legal trigger followed by one immediately reachable placement.
   * No task/goal input, route search, hidden terrain or forced attention. */
  private consequencePercepts(obs: Observation): Percept[] {
    if (!this.consequences) return [];
    const p = this.person;
    const land = new Map<string, Cell>([[place(this.here), this.here]]);
    for (const a of obs.actions) {
      const [verb, arg = ''] = a.id.split(' ');
      if (['move', 'jump', 'place'].includes(verb ?? '') && delta[arg]) {
        const cell = add(this.here, delta[arg]);
        land.set(place(cell), cell);
      }
    }
    for (const thing of obs.seen.things) {
      const cell = add(this.here, { x: thing.dx, y: thing.dy });
      land.set(place(cell), cell);
    }
    const spire = obs.seen.spire ? add(this.here, { x: obs.seen.spire.dx, y: obs.seen.spire.dy }) : null;
    if (spire) land.set(place(spire), spire);
    const claims: ReceivedConsequence[] = [];
    const offers = this.offers(obs);
    const described = new Set<string>();
    for (const offer of offers) {
      const [verb, arg = ''] = offer.input.split(' ');
      if (verb !== 'pick' && !(verb === 'move' && obs.seen.carrying)) continue;
      const identity = JSON.stringify([offer.action, offer.targetId, offer.placeId]);
      if (described.has(identity)) continue;
      described.add(identity);
      // HF trigger matching excludes affordance id. If several inputs share an identity,
      // claim only placements reachable after EVERY matching input.
      const bodies = offers
        .filter(
          (o) => o.action === offer.action && o.targetId === offer.targetId && o.placeId === offer.placeId,
        )
        .map((o) => {
          const [v, d = ''] = o.input.split(' ');
          return v === 'move' && delta[d] ? add(this.here, delta[d]) : this.here;
        });
      const carried = verb === 'pick' ? arg : obs.seen.carrying;
      if (!carried) continue;
      for (const cell of land.values()) {
        if (bodies.some((body) => distance(body, cell) > 1)) continue;
        claims.push({
          // Reuse bounded slots; each observation supersedes its old revision.
          id: `placement-${claims.length}`,
          revision: p.now,
          trigger: { action: offer.action, targetId: offer.targetId, placeId: offer.placeId },
          successor: {
            action: `island:place:${carried.startsWith('cube-') ? 'cube' : carried}${spire && distance(cell, spire) === 0 ? '@Spire' : ''}`,
            targetId: carried,
            placeId: place(cell),
            duration: 1,
            effort: 0.08,
            focus: 0.03,
          },
          availableFrom: p.now + 1,
          availableUntil: p.now + 2,
          expiresAt: p.now + 2,
          chance: 1,
          confidence: 1,
        });
      }
    }
    return claims.map((claim) => ({
      at: p.now,
      channel: 'told',
      actorId: 'island',
      targetId: p.id,
      kind: 'island-consequence',
      salience: 0.5,
      valence: 0,
      summary: `${claim.trigger.action} (${claim.trigger.targetId}, ${claim.trigger.placeId}) permits ${claim.successor.action} (${claim.successor.targetId}) at ${claim.successor.placeId} immediately next.`,
      consequences: [claim],
    }));
  }

  offers(obs: Observation): Offer[] {
    const p = this.person;
    const visible = obs.seen.things.map((t) => ({
      id: t.id,
      cell: add(this.here, { x: t.dx, y: t.dy }),
      fromMemory: false,
    }));
    if (obs.seen.spire)
      visible.push({
        id: 'Spire',
        cell: add(this.here, { x: obs.seen.spire.dx, y: obs.seen.spire.dy }),
        fromMemory: false,
      });
    const targets = [...visible];
    if (this.memory) {
      const recalled = recall(p, { action: 'island-object', limit: 256 }).filter(
        (e) => e.action === 'island-object' && e.placeId && e.targetId,
      );
      recalled.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id, undefined, { numeric: true }));
      const known = new Set([...visible.map((o) => o.id), obs.seen.carrying]);
      for (const ep of recalled) {
        if (!ep.targetId || !ep.placeId || known.has(ep.targetId)) continue;
        known.add(ep.targetId);
        targets.push({ id: ep.targetId, cell: parsePlace(ep.placeId), fromMemory: true });
      }
    }
    const out: Offer[] = [];
    for (const input of obs.actions) {
      const [verb = '', arg = ''] = input.id.split(' ');
      const d = delta[arg] ?? { x: 0, y: 0 };
      const movement = verb === 'move' || verb === 'jump';
      const cell = movement || verb === 'place' ? add(this.here, d) : this.here;
      const picked = obs.seen.things.find((t) => t.id === arg);
      const effectCell =
        verb === 'pick' ? this.here : picked ? add(this.here, { x: picked.dx, y: picked.dy }) : cell;
      const effectTarget = verb === 'pick' ? arg : (obs.seen.carrying ?? p.id);
      const novel = this.novelty(verb, effectTarget, place(effectCell));
      const manipulation = ['pick', 'place', 'throw'].includes(verb);
      const serves: NeedId[] = manipulation
        ? ['competence', 'leisure']
        : verb === 'rest'
          ? ['rest']
          : ['leisure'];
      const spire = obs.seen.spire ? add(this.here, { x: obs.seen.spire.dx, y: obs.seen.spire.dy }) : null;
      // Endpoint semantics are declared in free time too; they do not interpret obs.task.
      const action =
        verb === 'place'
          ? `island:place:${obs.seen.carrying?.startsWith('cube-') ? 'cube' : obs.seen.carrying}${spire && distance(cell, spire) === 0 ? '@Spire' : ''}`
          : `island:${verb}`;
      const advances = this.goals
        ? p.agenda.goals
            .filter(
              (g) =>
                g.status === 'active' &&
                g.id !== this.taskId &&
                g.serves.some((n) => serves.includes(n as NeedId)),
            )
            .map((g) => g.id)
        : [];
      const base: Offer = {
        id: input.id,
        input: input.id,
        action,
        label: input.label,
        duration: 1,
        targetId: effectTarget,
        ...(this.memory ? { placeId: place(effectCell) } : {}),
        fromMemory: false,
        serves,
        effectTarget,
        effectPlace: place(effectCell),
        effort: (verb === 'jump' || verb === 'throw' ? 0.2 : 0) + (obs.seen.carrying ? 0.08 : 0),
        focus: 0.03,
        advertises: {
          ...(verb !== 'rest' ? { leisure: 0.025 * effectStimulation(verb) * novel } : {}),
          ...(manipulation ? { competence: 0.025 * novel } : {}),
        },
        tags: [...(novel > 0.65 ? ['novel'] : []), ...(verb === 'rest' || verb === 'look' ? ['rest'] : [])],
        advances,
      };
      // One scored offer per legal input. Current sight has priority; unseen targets follow in
      // most-recent recall order. Merge the other targets into the label without adding lottery weight.
      const toward = movement
        ? targets.filter((target) => distance(cell, target.cell) < distance(this.here, target.cell))
        : [];
      const target = toward[0];
      out.push(
        target
          ? {
              ...base,
              id: `${input.id}>${target.id}@${place(target.cell)}`,
              targetId: target.id,
              placeId: this.memory ? place(target.cell) : undefined,
              fromMemory: target.fromMemory,
              label: `${input.label} Toward ${toward.map((t) => t.id).join(', ')}.`,
            }
          : base,
      );
    }
    return out;
  }

  private audit(): GoalReading[] {
    for (const goal of this.person.agenda.goals) {
      this.goalHistory.set(goal.id, {
        id: goal.id,
        label: goal.label,
        minute: goal.adoptedAt - 720,
        status: goal.status,
        source: goal.id === this.taskId ? 'task' : 'hf',
        proposed: goal.id !== this.taskId,
        adopted: true,
      });
    }
    return [...this.goalHistory.values()].map((g) => ({ ...g }));
  }

  step(obs: Observation): MindStep {
    this.receive(obs);
    const p = this.person;
    if (obs.task && this.taskEpisode !== obs.episode) {
      const spire = obs.seen.spire ? add(this.here, { x: obs.seen.spire.dx, y: obs.seen.spire.dy }) : null;
      const goal = adoptGoal(
        p,
        {
          label: obs.task,
          serves: ['competence'],
          importance: 0.5,
          deadline: p.now + obs.stepsLeft,
          ...(this.consequences ? { temporal: { halfLifeMinutes: 60 } } : {}),
          advancedBy: this.goals && spire ? [{ action: 'island:place:cube@Spire', amount: 0.1 }] : [],
        },
        p.now,
      );
      this.taskId = goal.id;
      this.taskEpisode = obs.episode;
    }
    if (this.boredom && this.engagement < 0.35)
      feel(p, 'boredom', 0.65 * (1 - this.engagement / 0.35), 'island2:dull', p.now);
    const offers = this.offers(obs);
    const chosen = choose(p, scoreInputs(p, offers));
    const offer = offers.find((o) => o.id === chosen.affordanceId);
    if (!offer) throw new Error('HF2 selected a missing offer');
    begin(p, offer, decide(p, [offer]));
    this.pending = offer;
    // finish will not add another minute: the action's minute is lived now, feedback arrives next call.
    // Importing tick is public; proposals from tick remain observable even in the no-pull ablation.
    tick(p, p.now + 1);
    if (p.now % 60 === 0) {
      const needs = readPerson(p).needs;
      this.proposalChecks++;
      this.proposalMaxUrgency = Math.max(
        ...needs
          .filter((n) => ['competence', 'belonging', 'esteem', 'meaning'].includes(n.id))
          .map((n) => n.urgency),
      );
      proposeGoals(p, needs, p.now);
    }
    return {
      action: offer.input,
      why: `${offer.label} ${chosen.terms.map((t) => `${t.source}=${t.value.toFixed(4)}`).join('; ')}`,
      inner: { ...this.closingInner(), rememberedTargetMove: Number(offer.fromMemory) },
    };
  }

  closingInner(): Inner {
    return {
      boredom: emotionLevel(this.person, 'boredom'),
      engagement: this.engagement,
      leisure: this.person.needs.leisure,
      goals: this.audit(),
      proposalChecks: this.proposalChecks,
      proposalMaxUrgency: this.proposalMaxUrgency,
    };
  }

  endEpisode(obs: Observation): string {
    if (!this.pending) return '';
    this.receive(obs);
    const note = JSON.stringify(this.closingInner());
    this.here = { x: 0, y: 0 };
    return note;
  }
}

const createMind: MindFactory = (options) => new Hf2Mind(options);
export default createMind;
