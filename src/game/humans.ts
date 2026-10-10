/** Released HF owns shared-time relationship updates and Mum's decision. The host
 * supplies two ordinary opportunities, not a learned repair policy. */
import {
  type Affordance,
  begin,
  decide,
  finish,
  type Person,
  tick,
} from '@adam0white/human-framework';

export function shareTea(player: Person, mum: Person, until: number): void {
  for (const [person, other] of [
    [player, mum],
    [mum, player],
  ] as const) {
    const offer: Affordance = {
      id: 'tea-together',
      action: 'talk',
      label: 'Sit together over tea',
      duration: until - person.now,
      effort: 0,
      focus: 0.05,
      with: [other.id],
      tags: ['social', 'leisure'],
      advertises: { belonging: 0.15, leisure: 0.1 },
    };
    begin(person, offer, decide(person, [offer]));
    tick(person, until);
    finish(person, {
      affordanceId: offer.id,
      action: offer.action,
      at: until,
      status: 'completed',
      summary: offer.label,
      needs: { belonging: 0.15, leisure: 0.1 },
    });
  }
}
export function askMumToHelp(mum: Person): boolean {
  const help: Affordance = {
    id: 'hold-light',
    action: 'help',
    label: 'Hold the light for a careful movement check',
    duration: 8,
    effort: 0.05,
    focus: 0.1,
    with: ['player'],
    tags: ['social', 'help'],
    advertises: { competence: 0.02 },
  };
  const read: Affordance = {
    id: 'read-chapter',
    action: 'read',
    label: 'Return to my chapter',
    duration: 8,
    effort: 0,
    focus: 0,
    advertises: { leisure: 0.12 },
  };
  const decision = decide(mum, [help, read]);
  const chosen = decision.chosenAffordanceId === help.id ? help : read;
  begin(mum, chosen, decision);
  tick(mum, mum.now + 8);
  finish(mum, {
    affordanceId: chosen.id,
    action: chosen.action,
    at: mum.now,
    status: 'completed',
    summary: chosen.label,
    needs: chosen.advertises,
  });
  return chosen.id === help.id;
}
