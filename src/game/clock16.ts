import { playerAge } from './school-calendar16';

/** Labels observed time and modeled age without changing state. */
export function gameTimeLabel(s: {
  now: number;
  campaign?: { startedAt: number; holiday: number; graduated: boolean; holidayStartedAt?: number };
  people?: { player?: { life: { bornAt: number } } };
}): string {
  const campaign = s.campaign;
  const base =
    campaign?.holidayStartedAt ??
    (campaign?.startedAt ?? 0) + (campaign?.holiday ?? 0) * 365 * 1440;
  const day = Math.floor((s.now - Math.floor(base / 1440) * 1440) / 1440) + 1;
  const clock = `${String(Math.floor((s.now % 1440) / 60)).padStart(2, '0')}:${String(s.now % 60).padStart(2, '0')}`;
  return `${campaign?.graduated ? 'After school' : `Age ${playerAge(s)}`} · Summer day ${day} · ${clock}`;
}
