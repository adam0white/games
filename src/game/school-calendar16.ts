/** Unplayed school years advance real actor time; each new holiday begins in the morning. */
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_YEAR = 365 * MINUTES_PER_DAY;
const HOLIDAY_MORNING = 9 * 60;

/** First 09:00 at or after a full modeled year has elapsed. */
export function nextHolidayStart(now: number): number {
  const earliest = now + MINUTES_PER_YEAR;
  return (
    Math.ceil((earliest - HOLIDAY_MORNING) / MINUTES_PER_DAY) * MINUTES_PER_DAY + HOLIDAY_MORNING
  );
}

/** Read actual modeled age when the player exists; initialization retains its authored age. */
export function playerAge(s: {
  now: number;
  campaign?: { holiday: number };
  people?: { player?: { life: { bornAt: number } } };
}): number {
  const bornAt = s.people?.player?.life.bornAt;
  return bornAt === undefined
    ? 14 + (s.campaign?.holiday ?? 0)
    : Math.floor((s.now - bornAt) / MINUTES_PER_YEAR);
}

/** The first waking morning strictly after now, including this morning after midnight. */
export function nextWakingMorning(now: number): number {
  const morning = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + HOLIDAY_MORNING;
  return morning > now ? morning : morning + MINUTES_PER_DAY;
}
