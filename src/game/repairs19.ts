/** Fictional low-voltage repair rules owned by the host. Evidence is a visible
 * observation, never a latent fault label. Manual work and apprentice work use
 * these same tests, materials and success rules. */
import {
  ACCESS_MINUTES,
  accessKind,
  accessLabel,
  assertAccessStep,
  markPerformedWork,
  openAccess,
  temporaryTorchTest,
} from './repair-access19';
import type { Fault, GameState, RepairObject } from './types19';

export type RepairStep =
  | 'inspect'
  | 'test-catch'
  | 'adjust-catch'
  | 'test-battery'
  | 'clean-contact'
  | 'replace-battery'
  | 'fit-holder'
  | 'twist-cap'
  | 'verify'
  | 'check-result'
  | 'test-trolley-unloaded'
  | 'test-trolley-loaded'
  | 'align-trolley-wheel'
  | 'clear-trolley-rub'
  | 'check-trolley-route';
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
  | 'catch-needs-test'
  | 'hinge-stiff-clear'
  | 'keeper-rubs'
  | 'missing-spring'
  | 'missing-gear'
  | 'mechanism-working'
  | 'trolley-needs-comparison'
  | 'trolley-wanders'
  | 'trolley-rubs'
  | 'trolley-rolls';
export function cueFor(item: RepairObject, now: number): RepairCue {
  if (item.verified) return 'checked';
  if (item.checkStarted !== undefined)
    return now - item.checkStarted >= verificationMinutes(item) ? 'check-ready' : 'check-running';
  if (item.repaired) return isMechanical(item) ? 'mechanism-working' : 'light-steady';
  return item.evidence?.at(-1) ?? 'intake';
}
export function inspectRepair(
  item: RepairObject,
  actor: 'player' | 'sam' = 'player',
  at = 0,
): string {
  const newlyOpened = accessKind(item) && item.access?.state !== 'open';
  if (accessKind(item)) openAccess(item, actor, at, 'inspect', 4);
  const observation = inspectAccessibleRepair(item);
  return newlyOpened
    ? `The ${accessLabel(item)} is open and retained beside the object. ${observation}`
    : observation;
}
function inspectAccessibleRepair(item: RepairObject): string {
  item.inspected = true;
  if (item.form === 'trolley') {
    item.evidence ??= [];
    item.evidence.push('trolley-needs-comparison');
    return 'The trolley frame and handle are sound. One wheel has a polished rim and a little sideways movement; a loose strap lies near it. Compare rolling empty and with the agreed parcels before deciding what matters under load.';
  }
  if (item.id === 'friend-1' && item.form === 'torch') {
    item.evidence ??= [];
    item.evidence.push('needs-test');
    return 'The reported symptom was flickering when the torch moved. With the cap retained beside it, the battery, flat contact and cap threads are accessible. The disconnected torch is not producing a beam during this inspection. Nothing is broken through.';
  }
  if (item.fault === 'worn-catch')
    return (
      item.inspectText ??
      'The catch is worn. Compare retained hardware with the existing mounting holes before attempting a fitting.'
    );
  const mechanism: Partial<Record<Fault, RepairCue>> = {
    jam: 'blocked-mechanism',
    striker: 'binding-striker',
    hinge: item.form === 'box' ? 'catch-needs-test' : 'dirty-hinge',
    'catch-offset': 'catch-needs-test',
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
  if (item.form === 'box' && ['hinge', 'catch-offset'].includes(item.fault))
    return 'The exterior catch resists opening. Its joint looks dusty, and a polished mark runs along the keeper where the catch meets it. The wood and mounting screws are sound.';
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
export function testRepair(
  item: RepairObject,
  actor: 'player' | 'sam' = 'player',
  at = (item.access?.events.at(-1)?.at ?? 0) + 10,
): string {
  assertAccessStep(item, 'test-battery');
  return temporaryTorchTest(item, actor, at, 'test-battery', () => testAccessibleRepair(item));
}
function testAccessibleRepair(item: RepairObject): string {
  item.tested = true;
  if (item.id === 'friend-1' && item.form === 'torch') {
    const steady = item.fault === 'battery';
    item.evidence ??= [];
    item.evidence.push(steady ? 'battery-steady' : 'still-flickers');
    return steady
      ? 'With the known-good battery, the beam stays steady as you move the torch. You return that test cell to its tray.'
      : 'With the known-good battery, the beam still flickers as you move the torch. You return that test cell to its tray.';
  }
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
  if (['open-access', 'reassemble'].includes(step)) return ACCESS_MINUTES;
  if (step === 'sewing-box-again') return 5;
  const mechanical: Record<string, number> = {
    'clear-obstruction': 6,
    'align-striker': 10,
    'lubricate-hinge': 8,
    'adjust-catch': 10,
    'test-catch': 4,
    'replace-spring': 12,
    'fit-gear': 18,
    'test-trolley-unloaded': 6,
    'test-trolley-loaded': 8,
    'align-trolley-wheel': 12,
    'clear-trolley-rub': 8,
    'check-trolley-route': 12,
  };
  if (mechanical[step]) return mechanical[step];
  return ['clean-contact', 'replace-battery', 'fit-holder', 'twist-cap'].includes(step)
    ? 12
    : step === 'wait-check'
      ? 10
      : 4;
}
export function compatibleGearAvailable(item: RepairObject, parts: GameState['parts']): boolean {
  return Boolean(
    parts.gears && (parts.gearTargets?.includes(item.id) ?? item.id === 'paper-street'),
  );
}
export function applyRepair(
  item: RepairObject,
  step: string,
  parts: GameState['parts'],
): { succeeded: boolean; text: string } {
  if (item.form === 'trolley') return repairTrolley(item, step);
  assertAccessStep(item, step);
  markPerformedWork(item, step);
  const correct: Record<string, Fault> = {
    'clean-contact': 'contact',
    'replace-battery': 'battery',
    'fit-holder': 'holder',
    'twist-cap': 'cap',
    'clear-obstruction': 'jam',
    'align-striker': 'striker',
    'lubricate-hinge': 'hinge',
    'adjust-catch': 'catch-offset',
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
    if (!compatibleGearAvailable(item, parts)) throw Error('No matching gear for this object');
    parts.gears = (parts.gears ?? 0) - 1;
    const target = parts.gearTargets?.indexOf(item.id) ?? -1;
    if (target >= 0) parts.gearTargets?.splice(target, 1);
  }
  item.attempted++;
  item.repaired = correct[step] === item.fault;
  if (item.repaired) {
    item.evidence ??= [];
    item.evidence.push(isMechanical(item) ? 'mechanism-working' : 'light-steady');
  }
  if (item.form === 'torch' && item.access?.state === 'open')
    return {
      succeeded: item.repaired,
      text: item.repaired
        ? 'The accessible repair step is complete. The cap remains retained beside the torch; refit it before checking whether the beam stays steady in ordinary use.'
        : 'That work did not restore the supported fault. The cap remains retained beside the torch; use a temporary refit and control the cap position for another diagnostic comparison.',
    };
  if (item.id === 'friend-1' && item.form === 'torch')
    return {
      succeeded: item.repaired,
      text: item.repaired
        ? 'The beam stays on as you move the torch. Try changing your grip and switching it repeatedly before calling the handling fault fixed.'
        : 'The beam still fails as you move the torch. That adjustment did not restore reliable handling; compare the battery or control the cap position before choosing another step.',
    };
  if (!item.repaired && item.form === 'box' && ['hinge', 'catch-offset'].includes(item.fault)) {
    const text = testCatch(item);
    return { succeeded: false, text: `That step did not free the catch. ${text}` };
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

/** A bounded hand trolley comparison. Empty rolling is a control, not a
 * diagnosis; the agreed parcel load reveals the consequential difference.
 * No frame, bearing replacement or powered transport work is modelled. */
export function testTrolley(item: RepairObject, loaded: boolean): string {
  if (item.form !== 'trolley' || !item.inspected || !item.trolley)
    throw Error('Examine the trolley before comparing it');
  if (loaded && !item.trolley.permission) throw Error('The owner must agree the test load');
  item.evidence ??= [];
  if (!loaded) {
    item.trolley.unloaded = true;
    item.evidence.push('trolley-needs-comparison');
    return 'Empty, the trolley rolls across the level floor. The wheel can move sideways a little, but it neither drags nor pulls enough to explain the reported loaded difficulty. This empty run does not establish loaded use.';
  }
  item.trolley.loaded = true;
  item.tested = Boolean(item.trolley.unloaded);
  const cue = item.repaired
    ? 'trolley-rolls'
    : item.fault === 'trolley-alignment'
      ? 'trolley-wanders'
      : 'trolley-rubs';
  item.evidence.push(cue);
  return cue === 'trolley-rolls'
    ? 'With the same agreed parcels, the trolley rolls straight and the rim clears the strap. The short comparison is promising; its real route still needs an attended check.'
    : cue === 'trolley-wanders'
      ? 'With the parcels loaded, the wheel leans sideways and the trolley pulls toward the gate. Holding the loose strap clear makes no difference. Empty rolling had hidden the effect of the wheel mounting under load.'
      : 'With the parcels loaded, the low strap presses against the turning wheel and makes it drag. Holding that strap clear removes the drag; the small sideways wheel movement does not change. Empty rolling had left enough clearance.';
}
export function repairTrolley(
  item: RepairObject,
  step: string,
): { succeeded: boolean; text: string } {
  if (item.form !== 'trolley' || !item.trolley?.permission)
    throw Error('This borrowed trolley needs permission before work');
  if (!item.trolley.unloaded || !item.trolley.loaded)
    throw Error('Compare empty and loaded rolling before work');
  if (!['align-trolley-wheel', 'clear-trolley-rub'].includes(step))
    throw Error('This step does not belong to the trolley');
  item.attempted++;
  item.verified = false;
  item.trolley.routeChecked = false;
  delete item.checkStarted;
  item.repaired =
    (step === 'align-trolley-wheel' && item.fault === 'trolley-alignment') ||
    (step === 'clear-trolley-rub' && item.fault === 'trolley-rub');
  item.evidence ??= [];
  item.evidence.push(
    item.repaired
      ? 'trolley-rolls'
      : item.fault === 'trolley-alignment'
        ? 'trolley-wanders'
        : 'trolley-rubs',
  );
  return {
    succeeded: item.repaired,
    text: item.repaired
      ? step === 'align-trolley-wheel'
        ? 'With the borrowed trolley’s owner permission recorded, you seat and secure the accessible wheel mounting. It rolls straight with the agreed parcels. No part has been replaced; check the actual route before returning it.'
        : 'You secure the loose strap above the turning wheel, leaving the borrowed frame and wheel alone. The parcels no longer press it into the rim. Check the actual route before returning it.'
      : 'That change does not resolve the loaded difficulty. Repeat the controlled comparison rather than assuming the empty roll was enough.',
  };
}
export function performTrolleyRouteCheck(
  item: RepairObject,
  startedAt: number,
  endedAt: number,
): string {
  if (
    item.form !== 'trolley' ||
    !item.trolley?.permission ||
    !item.repaired ||
    !item.trolley.unloaded ||
    !item.trolley.loaded ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt - startedAt < 12
  )
    throw Error('The attended trolley route check is incomplete');
  item.verified = true;
  item.trolley.routeChecked = true;
  item.evidence ??= [];
  item.evidence.push('checked');
  return 'You load the agreed parcels and attend the twelve-minute route through the gate and back, stopping and turning with the load. The wheel stays straight and clear, the parcels remain secure, and the handle stays sound. The requested route is checked; waiting beside an empty trolley would not have checked it.';
}
export function readLongCheck(item: RepairObject, now: number): string {
  assertAccessStep(item, 'check-result');
  if (item.form === 'trolley') throw Error('The trolley needs its attended loaded route check');
  if (item.id === 'friend-0')
    throw Error('Nora’s kettle lamp needs its actual shade and position check');
  if (item.id === 'friend-1' && item.form === 'torch')
    throw Error('Sam’s path torch needs an attended grip and movement check');
  if (item.form === 'bell')
    throw Error('The bell needs an attended repeated-ringing and movement check');
  if (item.fault === 'worn-catch')
    throw Error('This case needs its repeated-closure and carrying check');
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

/** Bells need five actual minutes of repeated ringing and movement. Idle
 * elapsed time does not establish a physical repeated-use check. */
export function performActiveBellCheck(
  item: RepairObject,
  startedAt: number,
  endedAt: number,
): string {
  assertAccessStep(item, 'check-result');
  if (
    item.form !== 'bell' ||
    !item.repaired ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt - startedAt < 5
  )
    throw Error('The attended bell check is incomplete');
  item.verified = true;
  item.evidence ??= [];
  item.evidence.push('checked');
  return 'You ring the bell repeatedly for five minutes, moving it between tries. The striker keeps clearing the shell and the ring stays clear.';
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

/** A clear stable checking surface is a host opportunity, not a person skill. */
export function checkingSpaceAvailable(
  s: { objects: RepairObject[]; checkingPlaces?: number },
  objectId: string,
): boolean {
  return (
    s.objects.filter(
      (o) =>
        o.id !== objectId &&
        o.checkStarted !== undefined &&
        !o.verified &&
        o.location !== 'returned',
    ).length < (s.checkingPlaces ?? 1)
  );
}

/** Separates resistance inside the accessible joint from contact at the keeper.
 * This fictional low-force test supplies observation, not a hidden fault label. */
export function testCatch(item: RepairObject): string {
  if (item.form !== 'box' || !['hinge', 'catch-offset'].includes(item.fault))
    throw Error('This object has no accessible catch test');
  item.tested = true;
  item.evidence ??= [];
  item.evidence.push(item.fault === 'hinge' ? 'hinge-stiff-clear' : 'keeper-rubs');
  return item.fault === 'hinge'
    ? 'With the lid held clear of the keeper, the catch still drags through its travel. The resistance is in the hinge, rather than where the catch meets the keeper.'
    : 'With the lid held clear, the catch pivots freely. It resists only when it meets the keeper: the polished edge rubs before the catch can seat.';
}

/** Identical visible choices for both causes; choosing a method is player work. */
export function catchActions(item: RepairObject): readonly [string, string][] {
  if (
    item.form !== 'box' ||
    !['hinge', 'catch-offset'].includes(item.fault) ||
    !item.inspected ||
    item.repaired
  )
    return [];
  return [
    [
      'test-catch',
      item.tested
        ? 'Repeat the lid-clear movement check'
        : 'Move the catch with the lid clear of the keeper',
    ],
    ['lubricate-hinge', 'Clear the external dirt and lubricate the hinge'],
    ['adjust-catch', 'Adjust the keeper so the catch meets it squarely'],
  ];
}

/** Retained hardware belongs to this one case, never to the workshop stock.
 * This bounded fictional catch comparison covers labelled spacing, reversible
 * removal and repeated closure; it supplies no general metalworking method. */
export interface CaseFittings {
  measured: boolean;
  original: 'attached-worn' | 'retained';
  replacement: 'retained' | 'fitted';
  originalSpacing: 24;
  replacementSpacing: 30;
  compatible?: { source: string; permission: boolean; spacing: 24; status: 'retained' | 'fitted' };
  revisedUse?: 'stationary-tray';
  repeatedClosures?: boolean;
  trayChecked?: boolean;
}
export function freshCaseFittings(): CaseFittings {
  return {
    measured: false,
    original: 'attached-worn',
    replacement: 'retained',
    originalSpacing: 24,
    replacementSpacing: 30,
  };
}
export function measureCaseFittings(item: RepairObject, fittings: CaseFittings): string {
  fittings.measured = true;
  item.inspected = true;
  item.observations.push(
    'The retained catch mounts are 24 mm apart; the labelled interchangeable fitting is 30 mm. Its holes do not match.',
  );
  return item.observations.at(-1) ?? '';
}
export function fitCaseCatch(
  item: RepairObject,
  fittings: CaseFittings,
  candidate: 'replacement' | 'compatible',
): { succeeded: boolean; text: string } {
  if (fittings.revisedUse === 'stationary-tray')
    return {
      succeeded: false,
      text: 'Nora agreed to a stationary tray. Fitting a carrying catch would change that agreement.',
    };
  if (!fittings.measured)
    return {
      succeeded: false,
      text: 'Compare the existing holes before fitting anything. Nothing has been consumed or drilled.',
    };
  if (candidate === 'replacement')
    return {
      succeeded: false,
      text: 'The labelled replacement has different hole spacing. You leave it intact beside the case; no new holes are made.',
    };
  if (!fittings.compatible?.permission || fittings.compatible.status !== 'retained')
    return {
      succeeded: false,
      text: 'There is no measured compatible fitting that its owner has agreed you may use.',
    };
  fittings.original = 'retained';
  fittings.compatible.status = 'fitted';
  item.attempted++;
  item.repaired = true;
  item.verified = false;
  item.completedBy = 'player';
  item.observations.push(
    'The measured compatible catch is fitted to the existing holes. The worn catch and labelled replacement are retained in the hardware pocket.',
  );
  return {
    succeeded: true,
    text: 'You fit the measured catch to the existing holes and retain the worn catch and incompatible replacement with Nora’s case. Repeated closure and a carrying check remain.',
  };
}
export function checkCaseCarry(item: RepairObject, fittings: CaseFittings): string {
  if (fittings.revisedUse === 'stationary-tray')
    throw Error('Nora agreed to stationary use, not a carrying repair');
  if (!item.repaired || fittings.compatible?.status !== 'fitted')
    throw Error('No fitted compatible catch to check');
  fittings.repeatedClosures = true;
  item.verified = true;
  return 'Repeated opening, closure and a gentle carrying check keep Nora’s samples together. Both removed and unused fittings remain labelled with her case.';
}
export function adaptCaseTray(
  item: RepairObject,
  fittings: CaseFittings,
  consent: boolean,
): string {
  if (!consent) throw Error('Nora has not agreed to a stationary sample tray');
  fittings.original = 'retained';
  if (fittings.compatible) fittings.compatible.status = 'retained';
  fittings.replacement = 'retained';
  fittings.revisedUse = 'stationary-tray';
  fittings.trayChecked = false;
  item.observations.push(
    'The worn catch has been removed and retained with the lid and replacement fitting. Nora agreed to use the open compartments as a stationary sample tray.',
  );
  item.repaired = false;
  item.verified = false;
  delete item.checkStarted;
  return 'You remove and retain the worn catch. The lid and both fittings stay with Nora; the open case is being prepared for stationary samples, not carrying.';
}
export function checkCaseTray(item: RepairObject, fittings: CaseFittings): string {
  if (fittings.revisedUse !== 'stationary-tray') throw Error('No agreed tray adaptation to check');
  fittings.trayChecked = true;
  item.repaired = false;
  item.verified = false;
  return 'The samples stay arranged on the level counter and can be taken out without snagging. The tray check passes for stationary use; the original carrying repair remains unfulfilled.';
}

/** Reversible deferral restores the original hardware; no part enters stock. */
export function restoreCaseUnchanged(item: RepairObject, fittings: CaseFittings): void {
  item.observations.push(
    'The original worn catch is attached again. The unused replacement and any borrowed compatible fitting remain retained with Nora’s case.',
  );
  fittings.original = 'attached-worn';
  fittings.replacement = 'retained';
  if (fittings.compatible) fittings.compatible.status = 'retained';
  delete fittings.revisedUse;
  delete fittings.repeatedClosures;
  delete fittings.trayChecked;
  delete item.checkStarted;
  item.repaired = false;
  item.verified = false;
}

/** The first path torch offers two physical hypotheses without identifying the
 * stored cause. The player can test or attempt a reversible adjustment. This
 * finite interaction does not add an apprentice method or repair other torches. */
export function pathTorchActions(item: RepairObject): readonly [string, string][] {
  if (item.id !== 'friend-1' || item.form !== 'torch' || !item.inspected || item.repaired)
    return [];
  return [
    ['path-torch-test-cap', 'Hold the cap square and move the torch'],
    ['twist-cap', 'Clean and reseat the threaded cap'],
    ['clean-contact', 'Clean and reseat the flat contact'],
  ];
}

/** Controls the cap position while moving the same torch, without consuming
 * parts or silently repairing it. Evidence records the observed response. */
export function testPathTorchCap(
  item: RepairObject,
  actor: 'player' | 'sam' = 'player',
  at = (item.access?.events.at(-1)?.at ?? 0) + 10,
): string {
  assertAccessStep(item, 'path-torch-test-cap');
  return temporaryTorchTest(item, actor, at, 'path-torch-test-cap', () =>
    testRefittedTorchCap(item),
  );
}
function testRefittedTorchCap(item: RepairObject): string {
  if (item.id !== 'friend-1' || item.form !== 'torch' || !item.inspected)
    throw Error('Inspect the path torch before comparing cap positions');
  item.evidence ??= [];
  const cue =
    item.fault === 'cap'
      ? 'crooked-cap'
      : item.fault === 'battery'
        ? 'needs-test'
        : 'still-flickers';
  item.evidence.push(cue);
  return cue === 'crooked-cap'
    ? 'The beam stays steady only while you hold the cap square. Moving the body does not interrupt it then; releasing the cap lets the flicker return.'
    : cue === 'needs-test'
      ? 'Holding the cap square makes no visible difference: the beam remains weak in both positions. Cap position has not changed the weak beam.'
      : 'The beam still flickers when the body moves, even while the cap is held square. Letting go of the cap does not change that pattern.';
}

/** Six attended minutes reproduce this torch's ordinary handling: changing
 * grip, moving and switching. This does not claim a battery endurance test. */
export function performPathTorchUseCheck(
  item: RepairObject,
  startedAt: number,
  endedAt: number,
): string {
  assertAccessStep(item, 'check-result');
  if (
    item.id !== 'friend-1' ||
    item.form !== 'torch' ||
    !item.repaired ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt - startedAt < 6
  )
    throw Error('The attended path-torch check is incomplete');
  item.verified = true;
  item.evidence ??= [];
  item.evidence.push('checked');
  return 'For six minutes you change your grip, move the torch and switch it off and on. The beam stays steady without holding the cap in place. Its ordinary handling is checked; this was not a battery-endurance test.';
}

/** The kettle lamp's requested use is a steady work surface without light up
 * the stairs. After the electrical run, an attended placement check establishes
 * that bounded fictional outcome; elapsed time alone does not do this work. */
export function performKettleLampUseCheck(
  item: RepairObject,
  startedAt: number,
  endedAt: number,
): string {
  assertAccessStep(item, 'check-result');
  if (
    item.id !== 'friend-0' ||
    !item.repaired ||
    item.checkStarted === undefined ||
    startedAt - item.checkStarted < verificationMinutes(item) ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt - startedAt < 6
  )
    throw Error('The kettle lamp’s attended use check is incomplete');
  item.verified = true;
  item.evidence ??= [];
  item.evidence.push('checked');
  return 'After the longer electrical run, you spend six minutes positioning the shade beside the kettle, moving and switching the lamp, and checking from the stair doorway. The kettle surface stays lit and the shade keeps the light off the stairs.';
}
