import { createPerson } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { beginSharedConversation, type ConversationRefusal } from '../src/game/humans';

it('a real own-plans decline without a current activity invents no activity or wait endpoint', () => {
  let found = false;
  for (let seed = 1; seed <= 100; seed++) {
    const player = createPerson({
      id: 'player',
      name: 'You',
      seed,
      now: 840,
      bornAt: -30 * 365 * 1440,
      sex: 'male',
    });
    const partner = createPerson({
      id: 'nora',
      name: 'Nora',
      seed,
      now: 840,
      bornAt: -30 * 365 * 1440,
      sex: 'female',
    });
    const controlPlayer = structuredClone(player);
    const controlPartner = structuredClone(partner);
    const reports: ConversationRefusal[] = [];
    const started = beginSharedConversation(
      player,
      partner,
      'comparison',
      'Compare the old notes',
      8,
      (report) => reports.push(report),
    );
    expect(
      beginSharedConversation(
        controlPlayer,
        controlPartner,
        'comparison',
        'Compare the old notes',
        8,
      ),
    ).toBe(started);
    expect(player).toEqual(controlPlayer);
    expect(partner).toEqual(controlPartner);
    if (started || reports[0]?.kind !== 'declined' || reports[0]?.participant !== 'partner')
      continue;
    expect(partner.trace.at(-1)?.chosenAffordanceId).toBe('keep-own-plans');
    expect(reports).toEqual([{ kind: 'declined', participant: 'partner' }]);
    expect(player.activity).toBeNull();
    expect(partner.activity).toBeNull();
    expect(player.now).toBe(840);
    expect(partner.now).toBe(840);
    found = true;
    break;
  }
  expect(found).toBe(true);
});
