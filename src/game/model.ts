import type {
  Component,
  ComponentKind,
  Condition,
  DeviceKind,
  DeviceModel,
  Intervention,
  Measurement,
  MeasurementRequest,
  Observation,
  TestCondition,
  UseResult,
} from './types';

/** Collar factors are visible instrument reference data, not hidden fault values. */
export const governorMultipliers = [0.4, 0.8, 1, 1.2, 1.6] as const;

/** Conditions with a modeled functional effect. Job generation should choose from this map. */
export const supportedFaults: Readonly<Record<ComponentKind, readonly Condition[]>> = {
  cell: ['weak', 'dirty', 'open'],
  switch: ['dirty', 'worn', 'misaligned', 'open'],
  contact: ['dirty', 'worn', 'misaligned', 'open'],
  bulb: ['worn', 'open'],
  motor: ['dirty', 'worn', 'misaligned', 'jammed', 'open'],
  spring: ['weak', 'dirty', 'jammed', 'open'],
  gear: ['dirty', 'worn', 'misaligned', 'jammed', 'open'],
  governor: ['dirty', 'worn', 'misaligned', 'jammed', 'open'],
  drum: ['dirty', 'worn', 'misaligned', 'jammed', 'open'],
};

/** Fictional sealed 6 V devices only. This is not a mains repair reference.
 * Bench means operating at rest; load means increased working resistance.
 * All electrical probes read the same connected circuit for that condition.
 * Motion reads shaft speeds relative to the stationary frame terminal 0.
 */
export function createModel(
  kind: DeviceKind,
  seed: number,
  faults?: { componentId: string; condition: Condition }[],
): DeviceModel {
  const kinds: ComponentKind[] =
    kind === 'music-box'
      ? ['spring', 'gear', 'governor', 'drum']
      : ['cell', 'switch', 'contact', kind === 'fan' ? 'motor' : 'bulb'];
  const nodes =
    kind === 'music-box'
      ? [
          ['0', 'A'],
          ['A', 'B'],
          ['B', 'C'],
          ['C', 'D'],
        ]
      : [
          ['0', 'A'],
          ['B', 'C'],
          ['C', 'D'],
          ['D', '0'],
        ];
  const components = kinds.map(
    (part, i): Component => ({
      id: part,
      kind: part,
      label: part === 'cell' ? '6 V cell pack' : part.charAt(0).toUpperCase() + part.slice(1),
      terminals: nodes[i] as [string, string],
      x: 20 + i * 20,
      y: i % 2 === 0 ? 35 : 65,
      condition: 'good',
    }),
  );
  const scenarios: { componentId: string; condition: Condition }[] =
    kind === 'music-box'
      ? [
          { componentId: 'spring', condition: 'weak' },
          { componentId: 'gear', condition: 'worn' },
          { componentId: 'governor', condition: 'misaligned' },
          { componentId: 'drum', condition: 'jammed' },
        ]
      : [
          { componentId: 'cell', condition: 'weak' },
          { componentId: 'switch', condition: 'worn' },
          { componentId: 'contact', condition: 'dirty' },
          {
            componentId: kind === 'fan' ? 'motor' : 'bulb',
            condition: kind === 'fan' ? 'misaligned' : 'open',
          },
        ];
  for (const fault of faults ?? [scenarios[(seed >>> 0) % scenarios.length]]) {
    if (!fault) continue;
    const component = components.find((c) => c.id === fault.componentId);
    if (component) component.condition = fault.condition;
  }
  const governor = components.find((c) => c.kind === 'governor');
  if (governor) governor.setting = governor.condition === 'misaligned' ? 4 : 2;
  const ratio = 3 + ((seed >>> 0) % 3);
  return {
    kind,
    components,
    power: true,
    sourceVolts: 6,
    ...(kind === 'music-box' ? { ratedDrive: 30 * ratio, gearRatio: ratio } : {}),
  };
}
export function terminals(model: DeviceModel): string[] {
  return [...new Set(model.components.flatMap((c) => c.terminals))];
}
export function compatiblePart(model: DeviceModel, id: string): ComponentKind | undefined {
  return model.components.find((c) => c.id === id)?.kind;
}
const round = (n: number) => Math.round(n * 100) / 100;
const part = (model: DeviceModel, id: string) => model.components.find((c) => c.id === id);
function resistance(c: Component, condition: TestCondition): number {
  if (c.condition === 'open') return 1e8;
  if (c.kind === 'switch' || c.kind === 'contact') {
    if (c.condition === 'worn')
      return condition === 'bench' ? 0.08 : condition === 'movement' ? 1e8 : 15;
    if (c.condition === 'misaligned' && condition === 'movement') return 1e8;
  }
  if (c.condition === 'dirty') return 10;
  if (c.kind === 'cell') return c.condition === 'weak' ? 12 : 0.35;
  if (c.kind === 'bulb') return 12;
  if (c.kind === 'motor') return condition === 'bench' ? 16 : 4;
  return 0.08;
}

function circuit(model: DeviceModel, condition: TestCondition) {
  const [cell, sw, contact, load] = model.components as [
    Component,
    Component,
    Component,
    Component,
  ];
  const rs = model.components.map((c) => resistance(c, condition)) as [
    number,
    number,
    number,
    number,
  ];
  const current = model.power ? model.sourceVolts / rs.reduce((a, b) => a + b, 0) : 0;
  const source = model.power ? model.sourceVolts - current * rs[0] : 0;
  const nodes: Record<string, number> = {
    A: source,
    B: source,
    C: source - current * rs[1],
    D: current * rs[3],
    '0': 0,
  };
  return { cell, sw, contact, load, rs, current, nodes };
}
function mechanical(model: DeviceModel, condition: TestCondition) {
  const [spring, gear, governor, drum] = model.components as [
    Component,
    Component,
    Component,
    Component,
  ];
  const specification = model;
  let drive = model.power ? (specification.ratedDrive ?? 120) : 0;
  if (spring.condition === 'weak') drive *= condition === 'bench' ? 0.8 : 0.35;
  if (spring.condition === 'dirty') drive *= condition === 'bench' ? 0.65 : 0.45;
  if (spring.condition === 'open' || spring.condition === 'jammed') drive = 0;
  let geared = drive / (specification.gearRatio ?? 4);
  if (gear.condition === 'worn') geared *= condition === 'bench' ? 1 : 0.25;
  if (gear.condition === 'dirty') geared *= condition === 'bench' ? 0.65 : 0.45;
  if (gear.condition === 'misaligned') geared *= condition === 'bench' ? 0.9 : 0;
  if (gear.condition === 'open' || gear.condition === 'jammed') geared = 0;
  let regulated = geared;
  const setting = governor.setting ?? (governor.condition === 'misaligned' ? 4 : 2);
  regulated *= governorMultipliers[setting] ?? 1;
  if (governor.condition === 'dirty') regulated *= 0.5;
  if (governor.condition === 'worn') regulated *= condition === 'bench' ? 1 : 1.5;
  if (governor.condition === 'jammed' || governor.condition === 'open') regulated = 0;
  let output = regulated / 2;
  if (drum.condition === 'dirty') output *= 0.5;
  if (drum.condition === 'worn') output *= condition === 'bench' ? 1 : 0.4;
  if (
    drum.condition === 'jammed' ||
    drum.condition === 'open' ||
    (drum.condition === 'misaligned' && condition !== 'bench')
  )
    output = 0;
  const nodes: Record<string, number> = { '0': 0, A: drive, B: geared, C: regulated, D: output };
  return { nodes, output };
}
export function inspectComponent(model: DeviceModel, id: string): Observation {
  const c = part(model, id);
  if (!c)
    return { summary: 'There is no component at that location.', cues: { signal: 'invalid' } };
  // Exterior age does not establish electrical resistance or internal wear.
  if (c.kind === 'governor') {
    const setting = c.setting ?? (c.condition === 'misaligned' ? 4 : 2);
    return {
      summary: `${c.label}: The collar pointer is at ${setting} on the 0–4 scale. The casing looks intact.`,
      cues: { part: c.kind, signal: 'control-setting' },
    };
  }
  return {
    summary: `${c.label}: ${c.kind === 'contact' ? 'The exposed metal is aged and dull.' : 'The outside looks intact.'}`,
    cues: { part: c.kind, signal: c.kind === 'contact' ? 'aged-surface' : 'intact' },
  };
}

export function measure(model: DeviceModel, request: MeasurementRequest): Measurement {
  const { mode, a, b, condition } = request;
  const invalid = (summary: string): Measurement => ({
    value: null,
    unit: '',
    summary,
    cues: { signal: 'invalid' },
  });
  if (!terminals(model).includes(a) || !terminals(model).includes(b))
    return invalid('Choose two marked terminals.');
  const c = model.components.find(
    (c) => c.terminals.includes(a) && c.terminals.includes(b) && a !== b,
  );
  if (model.kind === 'music-box') {
    if (mode !== 'motion')
      return invalid('This mechanical device has no electrical circuit. Select motion.');
    const nodes = mechanical(model, condition).nodes;
    const value = round((nodes[b] ?? 0) - (nodes[a] ?? 0));
    // Use the downstream shaft of a span, excluding the stationary frame 0.
    const shaft = [a, b]
      .filter((node) => node !== '0')
      .sort()
      .at(-1);
    const observedSpeed = shaft ? Math.abs(nodes[shaft] ?? 0) : 0;
    return {
      value,
      unit: 'rpm Δ',
      summary: `Terminal ${a} reads ${round(nodes[a] ?? 0)} rpm. Terminal ${b} reads ${round(nodes[b] ?? 0)} rpm. The rotation changes by ${value} rpm.`,
      cues: {
        part: c?.kind ?? 'drive',
        signal:
          observedSpeed === 0 && shaft && model.power
            ? 'blocked-drive'
            : observedSpeed < 10 && shaft && model.power
              ? 'slow-drive'
              : 'rotation',
      },
    };
  }
  if (mode === 'motion')
    return invalid('Motion probes are for the mechanical drive. Use voltage or continuity.');
  if (mode === 'continuity') {
    if (model.power) return invalid('Turn power off before checking continuity.');
    if (a === b)
      return {
        value: 0,
        unit: 'Ω',
        summary: 'Both probes touch the same terminal, so the reading is 0 Ω.',
        cues: { signal: 'connected' },
      };
    // Cell voltage makes resistance testing through a source invalid even with its switch off.
    if (c?.kind === 'cell')
      return invalid('Resistance across the cell pack is not a valid continuity test.');
    const edges = model.components
      .filter((p) => p.kind !== 'cell')
      .map((p) => ({ a: p.terminals[0], b: p.terminals[1], r: resistance(p, condition) }));
    edges.push({ a: 'A', b: 'B', r: 0 });
    const distances: Record<string, number> = Object.fromEntries(
      terminals(model).map((n) => [n, Infinity]),
    );
    distances[a] = 0;
    for (let i = 0; i < 5; i++)
      for (const e of edges) {
        distances[e.b] = Math.min(distances[e.b] ?? Infinity, (distances[e.a] ?? Infinity) + e.r);
        distances[e.a] = Math.min(distances[e.a] ?? Infinity, (distances[e.b] ?? Infinity) + e.r);
      }
    const r = distances[b] ?? Infinity;
    return {
      value: r >= 1e7 ? null : round(r),
      unit: 'Ω',
      summary:
        r >= 1e7
          ? 'There is no conducting path between these terminals.'
          : `The resistance between ${a} and ${b} is ${round(r)} Ω.`,
      cues: {
        part: c?.kind ?? 'path',
        signal: r >= 1e7 ? 'open-path' : r > 2 ? 'resistance' : 'connected',
      },
    };
  }
  const data = circuit(model, condition);
  const value = round((data.nodes[a] ?? 0) - (data.nodes[b] ?? 0));
  const signal = !model.power
    ? 'power-off'
    : c?.kind === 'cell' && Math.abs(value) < 4
      ? 'low-source'
      : c && c.kind !== 'cell' && c.kind !== 'bulb' && c.kind !== 'motor' && Math.abs(value) > 1
        ? 'high-drop'
        : 'voltage';
  return {
    value,
    unit: 'V',
    summary: `The voltage from ${a} to ${b} is ${value} V (${condition}).`,
    cues: { part: c?.kind ?? 'path', signal },
  };
}
/**
 * Engine 5: what a person trying the object would notice, without numbers the player never measured.
 * The meter still gives exact readings; trying the object gives the felt result.
 */
export function feltUse(model: DeviceModel, condition: TestCondition, use: UseResult): string {
  if (!model.power) return use.summary;
  const where =
    condition === 'bench'
      ? 'on the table'
      : condition === 'movement'
        ? 'while carried'
        : 'under load';
  if (model.kind === 'music-box') {
    const specification = model as DeviceModel & { desiredRPM?: number; tolerance?: number };
    const desired = specification.desiredRPM ?? 15;
    const ratio = use.output / desired;
    return use.output === 0
      ? `The drum does not turn ${where}; the melody stops.`
      : use.passes
        ? `The melody keeps its pace ${where}.`
        : ratio < 0.3
          ? `The drum barely turns ${where}; the tune is hard to recognise.`
          : ratio < 0.55
            ? `The drum turns very slowly ${where}; the melody is much too slow.`
            : ratio < 0.8
              ? `The melody is too slow ${where}.`
              : ratio < 1
                ? `The melody is a little too slow ${where}.`
                : ratio > 2
                  ? `The drum turns very fast ${where}; the melody is much too fast.`
                  : ratio > 1.4
                    ? `The melody is too fast ${where}.`
                    : `The melody is a little too fast ${where}.`;
  }
  const fan = model.kind === 'fan';
  const o = use.output;
  return o === 0
    ? fan
      ? `No air moves ${where}.`
      : `The light goes out ${where}.`
    : o < 0.4
      ? fan
        ? `The fan barely moves air ${where}. It is not enough.`
        : `The light glows faintly ${where}. It is not enough.`
      : !use.passes
        ? fan
          ? `The fan moves air weakly ${where}. It is not enough.`
          : `The light shines dimly ${where}. It is not enough.`
        : o >= 0.9
          ? fan
            ? `The fan moves air strongly and steadily ${where}.`
            : `The light shines brightly and steadily ${where}.`
          : fan
            ? `The fan moves air steadily ${where}.`
            : `The light shines steadily ${where}.`;
}
export function runUseTest(model: DeviceModel, condition: TestCondition): UseResult {
  if (!model.power)
    return {
      passes: false,
      output: 0,
      summary: 'The power is off, so the object does not run.',
      cues: { signal: 'power-off' },
    };
  if (model.kind === 'music-box') {
    const { output } = mechanical(model, condition);
    const specification = model as DeviceModel & { desiredRPM?: number; tolerance?: number };
    const desiredRPM = specification.desiredRPM ?? 15;
    const tolerance = specification.tolerance ?? 3;
    const passes = Math.abs(output - desiredRPM) <= tolerance;
    return {
      passes,
      output: round(output),
      summary: `The drum turns at ${round(output)} rpm during the ${condition} test (requested ${desiredRPM} ± ${tolerance} rpm); ${passes ? 'the melody keeps its pace.' : output === 0 ? 'the melody stops.' : 'the melody loses its pace.'}`,
      cues: {
        part: 'drum',
        signal: output === 0 ? 'blocked-drive' : passes ? 'steady-output' : 'timing',
      },
    };
  }
  const data = circuit(model, condition);
  let output = (data.current * data.rs[3]) / model.sourceVolts;
  if (
    data.load.condition === 'open' ||
    data.load.condition === 'jammed' ||
    (data.load.condition === 'misaligned' && condition !== 'bench')
  )
    output = 0;
  if (data.load.condition === 'dirty') output *= 0.45;
  if (data.load.condition === 'worn') output *= condition === 'bench' ? 0.65 : 0.4;
  const passes = output >= 0.7;
  return {
    passes,
    output: round(output),
    summary: `${model.kind === 'fan' ? 'Airflow' : 'Light'} reaches ${Math.round(output * 100)}% during the ${condition} test; ${passes ? 'the output stays steady.' : 'the output falls short.'}`,
    cues: {
      part: data.load.kind,
      signal: output === 0 ? 'no-output' : passes ? 'steady-output' : 'weak-output',
    },
  };
}
export function intervene(
  model: DeviceModel,
  id: string,
  intervention: Intervention,
): { ok: boolean; summary: string } {
  const c = part(model, id);
  if (!c) return { ok: false, summary: 'There is no component at that location.' };
  if (intervention === 'replace') {
    c.condition = 'good';
    if (c.kind === 'governor') c.setting = 2;
    return {
      ok: true,
      summary: `The ${c.label.toLowerCase()} was replaced. Test the object again.`,
    };
  }
  if (c.kind === 'governor' && intervention === 'adjust')
    return {
      ok: false,
      summary: 'Choose a collar setting from 0–4, then measure the resulting shaft speed.',
    };
  const fixes = intervention === 'clean' ? 'dirty' : 'misaligned';
  if (c.condition === fixes) c.condition = 'good';
  const cleanOperations: Record<ComponentKind, string> = {
    cell: 'The cell pack terminals were cleaned',
    switch: 'The switch contact faces were cleaned',
    contact: 'The mating contact faces were cleaned',
    bulb: 'The bulb socket faces were cleaned',
    motor: 'Residue was removed from the motor bearing',
    spring: 'Residue was removed from the spring arbor',
    gear: 'Residue was removed from the gear teeth',
    governor: 'The governor braking surfaces were cleaned',
    drum: 'Residue was removed from the drum spindle',
  };
  const adjustOperations: Record<ComponentKind, string> = {
    cell: 'The cell pack was seated again in its holder',
    switch: 'The switch mounting was tightened again and its lever was seated',
    contact: 'The contact was seated again and its clip was tightened',
    bulb: 'The bulb was seated again in its socket',
    motor: 'The motor bearing was centred in its mounting',
    spring: 'The spring arbor was seated again',
    gear: 'The gear was seated again on its spindle',
    governor: 'The governor collar was moved',
    drum: 'The drum spindle was centred in its mounting',
  };
  return {
    ok: true,
    summary: `${(intervention === 'clean' ? cleanOperations : adjustOperations)[c.kind]}. Run the object under load and while moving it to check the result.`,
  };
}

/** Move the exposed governor collar. The chosen setting changes braking, not a diagnosis flag. */
export function calibrate(
  model: DeviceModel,
  id: string,
  setting: number,
): { ok: boolean; summary: string } {
  const c = part(model, id);
  if (c?.kind !== 'governor' || model.kind !== 'music-box')
    return { ok: false, summary: 'This component has no calibrated collar.' };
  if (!Number.isInteger(setting) || setting < 0 || setting > 4)
    return { ok: false, summary: 'Choose a whole collar setting from 0–4.' };
  c.setting = setting;
  return {
    ok: true,
    summary: `The ${c.label.toLowerCase()} collar was set to ${setting}. Measure motion and test the melody.`,
  };
}
