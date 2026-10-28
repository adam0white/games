/** Public HF4 Run host. Decisions receive sight, legal inputs and authored action semantics only. */
import {
  type ActionRequest,
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun,
  type Input,
  inspect,
  type Offer,
  type PerceptData,
  type Result,
  type RunSpec,
  step,
} from 'hf4';
import type { Cell, Inner, Mind, MindFactory, MindOptions, Observation } from '../types.ts';
import { authoredPerson, DAY, MINUTE, START } from './hf4-authoring.ts';

function need<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  return result.value;
}
const offsets: Record<string, Cell> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  here: { x: 0, y: 0 },
};
const verbs = ['move', 'climb', 'pick', 'place', 'place-spire', 'throw', 'rest', 'look'];
export function islandSpec(seed: number): RunSpec {
  return {
    id: 'island-hf4',
    seed,
    start: START,
    host: { id: 'island', edition: 'hf4-1', schema: 'observation-only-1' },
    definitions: {
      actions: verbs.map((id) => ({
        id,
        label: id,
        demands: { effort: 0, focus: 0, mode: 'awake', requires: {} },
        tags: id === 'rest' ? ['rest'] : [],
        norms: [],
      })),
      norms: [],
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [
        { type: 'host', id: 'island' },
        { type: 'voice', id: 'player' },
      ],
      lexicon: { names: { islander: 'Islander' }, roles: {}, prefer: 'name', actions: {} },
      calendar: {
        id: 'island-day',
        epoch: { id: 'island-epoch', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: DAY,
        days: [
          { dayIndex: 0, start: 0, windows: [] },
          { dayIndex: 1, start: DAY, windows: [] },
        ],
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: { revision: 0, facts: [], hostState: null },
  };
}

export class Hf4Mind implements Mind {
  readonly name = 'hf4';
  readonly hfVersion = '4.5.1';
  readonly run;
  private now = START;
  private serial = 0;
  private revision = 0;
  private here: Cell = { x: 0, y: 0 };
  private pending?: DeepReadonly<ActionRequest>;
  private selected?: Offer;
  private taskStarted = false;
  private episode = -1;
  private effects = new Set<string>();
  constructor({ seed }: MindOptions) {
    this.run = need(createRun(islandSpec(seed)));
    need(createPerson(this.run, authoredPerson('islander', 'Islander', 'male')));
  }
  archive() {
    return exportRun(this.run);
  }
  private input<K extends Input['kind']>(kind: K, payload: Extract<Input, { kind: K }>['payload']): Input {
    return {
      id: `island:${++this.serial}`,
      at: this.now,
      source: { type: 'host', id: 'island' },
      kind,
      payload,
    } as Input;
  }
  private cell(dx: number, dy: number) {
    return `cell:${this.here.x + dx},${this.here.y + dy}`;
  }
  /** Exact one-to-one legal input mapping. No task-conditioned offers and no route/search policy. */
  offers(obs: Observation): Offer[] {
    return obs.actions.map((action) => {
      const [, arg] = action.id.split(' ');
      const d = offsets[arg ?? ''] ?? (offsets.here as Cell);
      const onSpire =
        action.kind === 'place' &&
        !!obs.seen.carrying?.startsWith('cube-') &&
        (obs.seen.spire
          ? d.x === obs.seen.spire.dx && d.y === obs.seen.spire.dy
          : obs.seen.here.onSpire && arg === 'here');
      const object = action.kind === 'pick' ? obs.seen.things.find((t) => t.id === arg) : undefined;
      const place = object ? this.cell(object.dx, object.dy) : this.cell(d.x, d.y);
      const target =
        object?.id ??
        (action.kind === 'place' || action.kind === 'throw' ? (obs.seen.carrying ?? undefined) : undefined);
      const manipulation = ['pick', 'place', 'throw'].includes(action.kind);
      const effort = action.kind === 'climb' ? 0.18 : action.kind === 'move' ? 0.08 : manipulation ? 0.08 : 0;
      const advances =
        action.kind === 'place'
          ? this.prospects(obs)
              .filter((p) => p.placeId === place)
              .map((p) => p.id)
          : [];
      return {
        id: action.id,
        actionId: onSpire ? 'place-spire' : action.kind,
        label: action.label,
        person: 'islander',
        durationMs: MINUTE,
        ...(target ? { target } : {}),
        place,
        participants: [],
        alongside: [],
        demands: { effort, focus: manipulation ? 0.03 : 0, mode: 'awake', requires: {} },
        tags: action.kind === 'rest' ? ['rest'] : [],
        norms: [],
        expected: {
          needs: {
            leisure: manipulation ? 0.02 : action.kind === 'look' ? 0.01 : 0.004,
            ...(manipulation ? { competence: 0.01 } : {}),
          },
          followedBy: [],
          provenance: ['authored:island-hf4-1'],
        },
        fulfills: [],
        advances,
        diminishes:
          action.kind === 'pick'
            ? this.prospects(obs)
                .filter((p) => p.placeId === place)
                .map((p) => p.id)
            : [],
      };
    });
  }
  private prospects(obs: Observation) {
    const places = [
      ...(obs.seen.spire ? [{ id: 'Spire', dx: obs.seen.spire.dx, dy: obs.seen.spire.dy }] : []),
      ...obs.seen.things.filter((t) => t.kind === 'ring'),
    ];
    return places.map((t) => ({
      id: `prospect:${t.id}:${this.cell(t.dx, t.dy)}`,
      kind: 'arrange' as const,
      label: t.id === 'Spire' ? 'a pile on the Spire' : 'fill the ring',
      placeId: this.cell(t.dx, t.dy),
      materialIds: [
        ...obs.seen.things.filter((o) => o.kind === 'cube').map((o) => o.id),
        ...(obs.seen.carrying?.startsWith('cube-') ? [obs.seen.carrying] : []),
      ],
      progress: Math.min(
        1,
        obs.seen.things.filter((o) => o.kind === 'cube' && o.dx === t.dx && o.dy === t.dy).length / 10,
      ),
    }));
  }
  private percepts(obs: Observation): PerceptData[] {
    const facts = [
      { id: 'body', text: obs.text, place: this.cell(0, 0) },
      ...obs.seen.things.map((t) => ({
        id: t.id,
        text: `${t.kind} ${t.id} at ${t.dx},${t.dy}, level ${t.level}`,
        place: this.cell(t.dx, t.dy),
      })),
      ...obs.events.map((text, i) => ({ id: `event:${i}`, text, place: this.cell(0, 0) })),
    ];
    const base = {
      occurredAt: this.now,
      channel: 'saw' as const,
      salience: 0.5,
      claims: [],
      norms: [],
      advice: [],
      consequences: [],
      withdrawConsequences: [],
      witnesses: [],
      reports: [],
      provenance: ['observed:island'],
    };
    return [
      ...facts.map((f) => ({
        ...base,
        id: `percept:${this.serial}:${f.id}`,
        kind: 'island-observation',
        summary: f.text,
        targetId: f.id,
        placeId: f.place,
      })),
      ...this.prospects(obs).map((prospect) => ({
        ...base,
        id: `percept:${this.serial}:${prospect.id}`,
        kind: 'island-prospect',
        summary: prospect.label,
        placeId: prospect.placeId,
        prospect,
      })),
    ];
  }
  private close(obs: Observation): Input[] {
    if (!this.pending || !this.selected) return [];
    const r = this.pending,
      o = this.selected;
    const key = `${o.actionId}:${o.target ?? ''}:${o.place ?? ''}`;
    const novel = !this.effects.has(key);
    this.effects.add(key);
    const manipulation = ['pick', 'place', 'place-spire', 'throw'].includes(o.actionId);
    const input = this.input('action.resolved', {
      requestId: r.id,
      requestHash: r.requestHash,
      person: r.person,
      activityId: r.activityId,
      stage: r.stage,
      worldRevision: r.worldRevision,
      disposition: 'completed',
      observations: [],
      outcome: {
        activityId: r.activityId,
        offerId: o.id,
        actionId: o.actionId,
        ...(o.target ? { target: o.target } : {}),
        start: this.now - MINUTE,
        end: this.now,
        status: 'completed',
        evidenceId: `effect:${r.id}`,
        summary: obs.events.join(' ') || 'One island action completed.',
        actual: {
          psychological: {
            leisure: (manipulation ? 0.02 : o.actionId === 'look' ? 0.01 : 0.004) * (novel ? 1 : 0.2),
            ...(manipulation ? { competence: novel ? 0.01 : 0.002 } : {}),
          },
          exposures: [],
          observedProgress: this.prospects(obs).map((p) => ({
            prospectId: p.id,
            progress: p.progress,
            evidenceId: `progress:${r.id}:${p.id}`,
          })),
        },
        fulfills: [],
        advances: o.advances,
      },
    });
    this.pending = undefined;
    this.selected = undefined;
    return [input];
  }
  step(obs: Observation) {
    if (obs.episode !== this.episode) {
      this.here = { x: 0, y: 0 };
      this.episode = obs.episode;
    }
    const receipts = this.close(obs);
    if (receipts.length) {
      const settled = need(step(this.run, { until: this.now, inputs: receipts }));
      if (settled.boundary.type !== 'until') throw new Error('HF continued before fresh offers');
      this.now++;
    } else if (this.episode > 0 && obs.step === 0) this.now++;
    const inputs: Input[] = [];
    const offers = this.offers(obs);
    inputs.push(this.input('offers.received', { person: 'islander', revision: ++this.revision, offers }));
    inputs.push(
      this.input('observation.received', {
        person: 'islander',
        evidenceId: `sight:${this.serial}`,
        percepts: this.percepts(obs),
      }),
    );
    if (obs.task && !this.taskStarted) {
      this.taskStarted = true;
      inputs.push(
        this.input('agenda.requested', {
          person: 'islander',
          request: {
            type: 'goal',
            goal: {
              id: 'island-task',
              label: obs.task,
              serves: ['competence'],
              progress: 0,
              advancedBy: [{ action: 'place-spire', amount: 0.1 }],
              importance: 0.5,
              baseImportance: 0.5,
              completionHalfLifeMs: 60 * MINUTE,
              deadline: this.now + obs.stepsLeft * MINUTE,
            },
          },
        }),
      );
    }
    inputs.push(
      this.input('decision.requested', {
        person: 'islander',
        reason: 'island input',
        treatment: 'ordinary',
        offerRevision: this.revision,
      }),
    );
    const decision = need(step(this.run, { until: this.now, inputs }));
    if (decision.boundary.type !== 'world-required') throw new Error('HF did not choose an action');
    const request = decision.boundary.requests[0];
    if (decision.boundary.requests.length !== 1 || request?.kind !== 'action' || request.stage !== 'start')
      throw new Error('Unexpected HF start boundary');
    const offer = offers.find((o) => o.id === request.offerId);
    if (!offer) throw new Error('HF selected an absent offer');
    const until = this.now + MINUTE;
    const accepted = this.input('action.resolved', {
      requestId: request.id,
      requestHash: request.requestHash,
      person: request.person,
      activityId: request.activityId,
      stage: 'start',
      worldRevision: request.worldRevision,
      disposition: 'accepted',
      observations: [],
    });
    const lived = need(step(this.run, { until, inputs: [accepted] }));
    if (lived.boundary.type !== 'world-required') throw new Error('HF action did not finish');
    const finish = lived.boundary.requests[0];
    if (
      lived.boundary.requests.length !== 1 ||
      finish?.kind !== 'action' ||
      finish.stage !== 'finish' ||
      finish.boundaryAt !== until
    )
      throw new Error('Unexpected HF finish boundary');
    this.now = until;
    this.pending = finish;
    this.selected = offer;
    const [verb, direction] = offer.id.split(' ');
    const d = offsets[direction ?? ''];
    if ((verb === 'move' || verb === 'jump') && d) this.here = { x: this.here.x + d.x, y: this.here.y + d.y };
    return { action: offer.id, why: `HF4 public Run choice: ${offer.actionId}`, inner: this.closingInner() };
  }
  endEpisode(obs: Observation) {
    const inputs = this.close(obs);
    const result = need(step(this.run, { until: this.now, inputs }));
    if (result.boundary.type !== 'until') throw new Error('Episode ended with a host request');
    return 'HF4 person and Run state retained; island body reset next episode.';
  }
  closingInner(): Inner {
    const view = need(
      inspect(this.run, { perspective: { kind: 'host' }, people: ['islander'], select: ['agenda'] }),
    );
    const person = view.people[0];
    if (person?.kind !== 'host') throw new Error('Missing islander');
    const part = person.parts.find((p) => p.select === 'agenda');
    if (part?.select !== 'agenda') throw new Error('Missing agenda');
    const agenda = part.value;
    return {
      goals: agenda.goals.map((g) => ({
        id: g.id,
        label: g.label,
        minute: (g.adoptedAt - START) / MINUTE,
        status: g.status,
        source: g.id === 'island-task' ? 'task' : 'hf',
        proposed: g.id !== 'island-task',
        adopted: true,
      })),
      projects: agenda.goals.filter((g) => g.project).length,
      projectProgress: Math.max(0, ...agenda.goals.filter((g) => g.project).map((g) => g.progress)),
    };
  }
}
const hf4: MindFactory = (options) => new Hf4Mind(options);
export default hf4;
