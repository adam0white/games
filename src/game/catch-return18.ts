/** Optional household favour for the same returned sewing box. The original
 * repair remains part of its history; a new fault is never retroactive teaching. */
import type { ActionView, GameState } from './types18';

const KEY = 'sewing-box-returned-again';
export function catchReturnActions(s: GameState, noraHere: boolean): ActionView[] {
  const start = s.serviceWeek?.startedAt;
  const original = s.objects.find((o) => o.id === 'friend-4');
  if (
    start === undefined ||
    Math.floor(s.now / 1440) - Math.floor(start / 1440) !== 3 ||
    !s.campaign?.graduated ||
    !s.apprentice?.independentCompleted ||
    !noraHere ||
    s.unlocked.includes(KEY) ||
    !original?.verified ||
    original.location !== 'returned'
  )
    return [];
  return [
    {
      id: 'sewing-box-again',
      label: 'Offer to look at Nora’s sewing box again',
      detail:
        'A household favour, with no fee or collection deadline. She says the catch has begun resisting again.',
      intent: 'stay',
    },
  ];
}

export function acceptCatchReturn(s: GameState, noraHere: boolean): string[] {
  if (!catchReturnActions(s, noraHere).length) throw Error('Nora has no returned-box request here');
  const item = s.objects.find((o) => o.id === 'friend-4');
  if (!item) throw Error('Missing original sewing box');
  s.unlocked.push(KEY);
  item.observations.push(
    'Earlier school-break repair: the dusty hinge was cleaned, the box passed its longer check, and Nora took it home. This new request follows that completed repair.',
  );
  item.story +=
    ' Nora has brought this same box back after using it at home. The earlier cleaned hinge worked when it was returned; the strip of blue cloth is still inside.';
  item.fault = 'catch-offset';
  item.location = 'bench';
  item.inspected = false;
  item.tested = false;
  item.attempted = 0;
  item.repaired = false;
  item.verified = false;
  item.evidence = [];
  item.repairText =
    'You adjust the keeper so the catch meets it squarely. The freely moving catch now seats without rubbing; the blue cloth stays inside.';
  for (const key of [
    'checkStarted',
    'awaitingCollection',
    'collectedAt',
    'returnedEarly',
    'callbackAt',
    'callbackSeen',
    'assignedTo',
    'independent',
    'playerAssisted',
    'completedBy',
    'stepDecisions',
  ] as const)
    delete item[key];
  s.focusId = item.id;
  return [
    'It worked well after you cleaned it. Now it catches again. The keeper may have shifted while I was using it, but I cannot tell what is resisting.',
    'The blue cloth is still in there. I can leave the box with you; no hurry, and no need to take Sam away from his own work.',
  ];
}
