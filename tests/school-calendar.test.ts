import { describe, expect, it } from 'vitest';
import { gameTimeLabel } from '../src/game/clock';
import { nextHolidayStart, playerAge } from '../src/game/school-calendar';

const year = 365 * 1440;

describe('school calendar', () => {
  it.each([540, 840, 2 * 1440 + 1037, 800 * 1440 + 1300])(
    'starts the next holiday at 09:00 after at least a year from %i',
    (now) => {
      const to = nextHolidayStart(now);
      expect(to % 1440).toBe(540);
      expect(to - now).toBeGreaterThanOrEqual(year);
      expect(to - now).toBeLessThan(year + 1440);
    },
  );

  it('advances every modeled age past the next birthday without changing birth dates', () => {
    const now = 840;
    const bornAt = now - 14 * year;
    const to = nextHolidayStart(now);
    const state = { now: to, people: { player: { life: { bornAt } } }, campaign: { holiday: 1 } };
    expect(playerAge(state)).toBe(15);
    expect((to - bornAt) / year).toBeGreaterThanOrEqual(15);
    expect(state.people.player.life.bornAt).toBe(bornAt);
  });

  it('keeps a shared target at least one year forward for actors of different ages', () => {
    const now = 2 * 1440 + 1123;
    const to = nextHolidayStart(now);
    const births = [14, 17, 41, 45].map((age) => now - age * year);
    for (const bornAt of births) {
      expect((to - bornAt) / year - (now - bornAt) / year).toBeGreaterThanOrEqual(1);
    }
  });

  it('labels the new episode day one while preserving an earlier recorded label', () => {
    const campaign = { startedAt: 840, holiday: 0, graduated: false };
    const prior = { now: 1440 + 1037, campaign };
    const recorded = { at: prior.now, timeLabel: gameTimeLabel(prior) };
    const before = structuredClone(recorded);
    const now = nextHolidayStart(prior.now);
    const next = { now, campaign: { ...campaign, holiday: 1, holidayStartedAt: now } };
    expect(gameTimeLabel(next)).toBe('Age 15 · Summer day 1 · 09:00');
    expect(gameTimeLabel({ ...next, now: now + 1440 + 17 })).toBe('Age 15 · Summer day 2 · 09:17');
    expect(recorded).toEqual(before);
  });

  it('retains the old episode origin for states without holidayStartedAt', () => {
    expect(
      gameTimeLabel({
        now: year + 1440 + 840,
        campaign: { startedAt: 840, holiday: 1, graduated: false },
      }),
    ).toBe('Age 15 · Summer day 2 · 14:00');
  });

  it('uses actual age after an unusually long holiday, with an initialization fallback', () => {
    expect(
      playerAge({
        now: 2 * year,
        campaign: { holiday: 0 },
        people: { player: { life: { bornAt: -14 * year } } },
      }),
    ).toBe(16);
    expect(playerAge({ now: 840, campaign: { holiday: 0 } })).toBe(14);
  });
});
