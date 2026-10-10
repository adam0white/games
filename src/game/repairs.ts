/** Fictional low-voltage repair rules owned by the host. Evidence is a visible
 * observation, never a latent fault label. Manual work and apprentice work use
 * these same tests, materials and success rules. */
import type { Fault, GameState, RepairObject } from './types';

export type RepairStep =
  | 'inspect'
  | 'test-battery'
  | 'clean-contact'
  | 'replace-battery'
  | 'fit-holder'
  | 'twist-cap'
  | 'verify'
  | 'check-result';
export type RepairCue =
  | 'intake'
  | 'needs-test'
  | 'battery-steady'
  | 'still-flickers'
  | 'broken-holder'
  | 'crooked-cap'
  | 'light-steady'
  | 'check-running'
  | 'check-ready'
  | 'checked'
  | 'blocked-mechanism'
  | 'binding-striker'
  | 'dirty-hinge'
  | 'missing-spring'
  | 'missing-gear'
  | 'mechanism-working';
export function cueFor(item: RepairObject, now: number): RepairCue {
  if (item.verified) return 'checked';
  if (item.checkStarted !== undefined)
    return now - item.checkStarted >= verificationMinutes(item) ? 'check-ready' : 'check-running';
  if (item.repaired) return isMechanical(item) ? 'mechanism-working' : 'light-steady';
  return item.evidence?.at(-1) ?? 'intake';
}
export function inspectRepair(item: RepairObject): string {
  item.inspected = true;
  const mechanism: Partial<Record<Fault, RepairCue>> = {
    jam: 'blocked-mechanism',
    striker: 'binding-striker',
    hinge: 'dirty-hinge',
    spring: 'missing-spring',
    gear: 'missing-gear',
  };
  const evidence: RepairCue =
    mechanism[item.fault] ??
    (item.form === 'torch' && item.fault === 'cap'
      ? 'crooked-cap'
      : item.fault === 'holder'
        ? 'broken-holder'
        : 'needs-test');
  item.evidence ??= [];
  item.evidence.push(evidence);
  if (isMechanical(item))
    return (
      item.inspectText ??
      {
        jam: 'A crumb has wedged against the external winding lever. The lever cannot finish its travel.',
        striker:
          'The bell striker rubs the shell instead of clearing it. Its mounting plate has shifted.',
        hinge: 'External dirt has packed around the box hinge. The catch itself is unbroken.',
        spring: 'The timetable clip is missing its small leaf spring. The stamped jaws are intact.',
        gear: 'One gear is missing from the paper-street model. Winding cannot bridge that gap.',
      }[item.fault as 'jam' | 'striker' | 'hinge' | 'spring' | 'gear']
    );
  return evidence === 'crooked-cap'
    ? 'The torch’s cap sits crooked. Its metal thread completes the circuit; pressure on the cap makes the beam return.'
    : evidence === 'broken-holder'
      ? 'The battery holder is cracked through. It needs a matching holder, not a stronger battery.'
      : 'The switch moves freely. There’s a little grime on the contact; the battery could also be tired.';
}
export function testRepair(item: RepairObject): string {
  item.tested = true;
  const evidence: RepairCue =
    item.fault === 'cap'
      ? 'crooked-cap'
      : item.fault === 'battery'
        ? 'battery-steady'
        : item.fault === 'holder'
          ? 'broken-holder'
          : 'still-flickers';
  item.evidence ??= [];
  item.evidence.push(evidence);
  return evidence === 'crooked-cap'
    ? 'The fresh battery makes no difference. The beam returns only while the cap is held straight.'
    : evidence === 'battery-steady'
      ? 'With the known-good battery it shines steadily. The old battery is tired.'
      : evidence === 'broken-holder'
        ? 'The crack prevents the battery sitting firmly. A test battery cannot bridge it.'
        : 'With the known-good battery it still flickers when moved. The contact needs attention.';
}
export function repairDuration(step: string): number {
  const mechanical: Record<string, number> = {
    'clear-obstruction': 6,
    'align-striker': 10,
    'lubricate-hinge': 8,
    'replace-spring': 12,
    'fit-gear': 18,
  };
  if (mechanical[step]) return mechanical[step];
  return ['clean-contact', 'replace-battery', 'fit-holder', 'twist-cap'].includes(step)
    ? 12
    : step === 'wait-check'
      ? 10
      : 4;
}
export function applyRepair(
  item: RepairObject,
  step: string,
  parts: GameState['parts'],
): { succeeded: boolean; text: string } {
  const correct: Record<string, Fault> = {
    'clean-contact': 'contact',
    'replace-battery': 'battery',
    'fit-holder': 'holder',
    'twist-cap': 'cap',
    'clear-obstruction': 'jam',
    'align-striker': 'striker',
    'lubricate-hinge': 'hinge',
    'replace-spring': 'spring',
    'fit-gear': 'gear',
  };
  if (step === 'fit-holder') {
    if (parts.holders < 1) throw Error('No compatible holder');
    parts.holders--;
  }
  if (step === 'replace-battery') {
    if (parts.batteries < 1) throw Error('No spare battery');
    parts.batteries--;
  }
  if (step === 'replace-spring') {
    if (!parts.springs) throw Error('No matching spring');
    parts.springs--;
  }
  if (step === 'fit-gear') {
    if (!parts.gears) throw Error('No matching gear');
    parts.gears--;
  }
  item.attempted++;
  item.repaired = correct[step] === item.fault;
  if (item.repaired) {
    item.evidence ??= [];
    item.evidence.push(isMechanical(item) ? 'mechanism-working' : 'light-steady');
  }
  return {
    succeeded: item.repaired,
    text: isMechanical(item)
      ? item.repaired
        ? (item.repairText ??
          'The mechanism moves correctly. Run it for longer and repeat the motion before calling it finished.')
        : 'That did not restore the motion. The observed obstruction or missing part remains; repeating the same step will not supply it.'
      : item.repaired
        ? 'The light comes on steadily. It deserves a longer check before calling it finished.'
        : item.fault === 'contact'
          ? 'It still flickers when moved. Changing the battery did not restore the contact.'
          : item.fault === 'cap'
            ? 'That did not straighten the threaded cap. The cap must sit squarely for its thread to carry the return contact.'
            : item.tested
              ? 'The known-good battery made it shine steadily; the original cell needs replacing.'
              : 'That did not help. Testing the battery will separate a weak cell from a contact problem.',
  };
}
export function readLongCheck(item: RepairObject, now: number): string {
  if (
    !item.repaired ||
    item.checkStarted === undefined ||
    now - item.checkStarted < verificationMinutes(item)
  )
    throw Error('The longer check is not ready');
  item.verified = true;
  item.evidence ??= [];
  item.evidence.push('checked');
  return isMechanical(item)
    ? 'After a longer run and repeated operation, the mechanism moves correctly without sticking.'
    : 'After a longer run, movement and switching, the light stays steady.';
}

export function isMechanical(item: Pick<RepairObject, 'form'>): boolean {
  return !['lamp', 'torch'].includes(item.form);
}

export function verificationMinutes(item: Pick<RepairObject, 'form'>): number {
  return item.form === 'timer'
    ? 20
    : item.form === 'bell'
      ? 5
      : item.form === 'box'
        ? 10
        : item.form === 'clip'
          ? 3
          : 20;
}
