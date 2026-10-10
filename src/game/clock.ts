import { playerAge } from './school-calendar';

/** Labels observed time and modeled age without changing state. */
export function gameTimeLabel(s: {
  now: number;
  campaign?: { startedAt: number; holiday: number; graduated: boolean; holidayStartedAt?: number };
  people?: { player?: { life: { bornAt: number } } };
  operations?: { episode: number; episodeAt: number };
}): string {
  const campaign = s.campaign;
  const base =
    campaign?.holidayStartedAt ??
    (campaign?.startedAt ?? 0) + (campaign?.holiday ?? 0) * 365 * 1440;
  const day = Math.floor((s.now - Math.floor(base / 1440) * 1440) / 1440) + 1;
  const clock = `${String(Math.floor((s.now % 1440) / 60)).padStart(2, '0')}:${String(s.now % 60).padStart(2, '0')}`;
  if (s.operations) {
    const workingDay =
      Math.floor((s.now - Math.floor(s.operations.episodeAt / 1440) * 1440) / 1440) + 1;
    const period =
      s.operations.episode === 1
        ? 'Collection afternoon'
        : s.operations.episode === 2
          ? 'A month later'
          : 'The following year';
    return `Age ${playerAge(s)} · ${period} · Day ${workingDay} · ${clock}`;
  }
  return `${campaign?.graduated ? 'After school' : `Age ${playerAge(s)}`} · Summer day ${day} · ${clock}`;
}
