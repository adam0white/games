/** Board suggestions are player inputs, not new simulation rules. */

import { planOf, weekOf } from '../sim/campaign.ts';
import { RUSH_FROM, RUSH_TO } from '../sim/cooks.ts';
import {
  type BoardRow,
  boardDefaults,
  cloneState,
  type GameState,
  memberOf,
  nameOf,
  onShift,
  promisesOn,
  queueInput,
  restoreState,
} from '../sim/kitchen.ts';

type BoardMoneyState = Pick<GameState, 'night' | 'till' | 'carry' | 'wagesDue' | 'seen' | 'crew' | 'version'>;
/** Board-only projection: current active crew attend the remaining services; future changes are unknown. */
export function boardMoneyEstimate(s: BoardMoneyState) {
  const plan = planOf(s.night);
  const nights = weekOf(plan.week).weekdays.filter((day) => day >= plan.weekday).length;
  const wages = s.crew.filter((m) => !m.founder && !m.left).reduce((sum, m) => sum + m.wage, 0);
  const bill =
    weekOf(plan.week).bill + s.carry + s.wagesDue + (promisesOn(s) ? (s.seen ?? 0) : 0) + wages * nights;
  const need = Math.max(0, bill - s.till);
  return { bill, nights, need, average: nights > 0 ? Math.ceil(need / nights / 10) * 10 : 0 };
}

export function breakSlots(current: number): { minute: number; label: string }[] {
  return [...new Set([1090, 1115, 1185, 1260, current])]
    .sort((a, b) => a - b)
    .map((minute) => ({
      minute,
      label: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} ${minute < RUSH_FROM ? 'before' : minute >= RUSH_TO ? 'after' : 'during'} the rush`,
    }));
}

const hhmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
/** The early table arrives at 18:12 and needs the grill and the cold side until 18:24. */
const EARLY_ARRIVES = 18 * 60 + 12;
const EARLY_LEAVES = 18 * 60 + 24;

/**
 * Plain consequences of the plan as it stands: a meal break with nobody to cover it leaves its station
 * empty while the early table waits. It names the cook, the break and the station; it changes nothing.
 */
export function earlyCoverageWarnings(s: GameState, rows: readonly BoardRow[]): string[] {
  if (!['pass@18', 'pass@20'].includes(s.version) || s.night > 3) return [];
  const agreed = s.board?.agreed ? s.board.rows : [];
  const place: Record<string, string> = { grill: 'grill', cold: 'cold side' };
  const out: string[] = [];
  for (const row of rows) {
    const where = place[row.station];
    if (!where || row.breakAt >= EARLY_LEAVES || row.breakAt + 20 <= EARLY_ARRIVES) continue;
    const answer = agreed.find(
      (a) =>
        a.cook === row.cook &&
        a.station === row.station &&
        a.breakAt === row.breakAt &&
        a.cover === row.cover,
    );
    if (row.cover && answer?.coverAccepted !== false) continue;
    const staffed = rows.some(
      (other) =>
        other.cook !== row.cook &&
        other.station === row.station &&
        (other.breakAt >= EARLY_LEAVES || other.breakAt + 20 <= EARLY_ARRIVES),
    );
    if (staffed) continue;
    const name = nameOf(s, row.cook);
    const plan = `${name}\u2019s meal break (${hhmm(row.breakAt)}\u2013${hhmm(row.breakAt + 20)})`;
    // The station empties at the later of the break start and the early table's arrival.
    const emptyAt = Math.max(row.breakAt, EARLY_ARRIVES);
    const when =
      emptyAt === EARLY_ARRIVES
        ? 'at 18:12'
        : `from ${hhmm(emptyAt)}, while the early table is still waiting`;
    out.push(
      row.cover
        ? `${plan} leaves the ${where} empty ${when} because the cook you chose to cover said no.`
        : emptyAt === EARLY_ARRIVES
          ? `${plan} leaves the ${where} empty when the early table arrives at 18:12.`
          : `${plan} leaves the ${where} empty ${when}.`,
    );
  }
  return out;
}

/** Half-open local-minute intervals: touching endpoints do not overlap. */
function overlaps(a: number, duration: number, b: number, end: number): boolean {
  return a < end && a + duration > b;
}

/** Describe only the draft and recorded answers, never a future activity. */
export function plannedBreakText(s: GameState, rows: readonly BoardRow[], row: BoardRow, revised: boolean) {
  const place = { grill: 'grill', cold: 'cold side', dish: 'dishes', oven: 'oven' };
  const station = place[row.station];
  const name = nameOf(s, row.cook);
  const interval = `${hhmm(row.breakAt)}–${hhmm(row.breakAt + 20)}`;
  const prefix = `${name}’s planned meal break is ${interval} at the ${station}.`;
  const answer =
    !revised && s.board?.agreed
      ? s.board.rows.find(
          (old) =>
            old.cook === row.cook &&
            old.station === row.station &&
            old.breakAt === row.breakAt &&
            old.cover === row.cover,
        )
      : undefined;
  const cover = row.cover ? nameOf(s, row.cover) : null;
  const relief = !cover
    ? 'You have not chosen anyone to take over.'
    : answer?.accepted && answer.coverAccepted === true
      ? `${cover} agreed to cover the ${station} for this interval.`
      : answer?.coverAccepted === false
        ? `${cover} did not agree to cover the ${station} for this interval.`
        : `You will ask ${cover} to cover the ${station} for this interval. Cover is not agreed.`;
  const others = rows.filter(
    (other) =>
      other.cook !== row.cook &&
      other.station === row.station &&
      !overlaps(other.breakAt, 20, row.breakAt, row.breakAt + 20) &&
      !rows.some(
        (borrow) =>
          borrow.cover === other.cook &&
          borrow.cook !== row.cook &&
          overlaps(borrow.breakAt, 20, row.breakAt, row.breakAt + 20) &&
          (revised ||
            s.board?.rows.some(
              (old) =>
                old.cook === borrow.cook &&
                old.accepted &&
                old.coverAccepted &&
                old.cover === borrow.cover &&
                old.breakAt === borrow.breakAt,
            )),
      ) &&
      (revised ||
        s.board?.rows.some(
          (old) =>
            old.cook === other.cook &&
            old.accepted &&
            old.station === other.station &&
            old.breakAt === other.breakAt,
        )),
  );
  const staffing = others.length
    ? `${revised ? 'In this proposed plan' : 'In the agreed plan'}, ${others.map((other) => nameOf(s, other.cook)).join(' and ')} ${others.length === 1 ? 'is' : 'are'} also assigned to the ${station} throughout this interval.`
    : `No other cook ${revised ? 'is assigned' : 'has agreed'} to stay at the ${station} throughout this interval.`;
  const borrowed = row.cover ? rows.find((other) => other.cook === row.cover) : undefined;
  const tradeoff =
    borrowed && borrowed.station !== row.station
      ? `If ${cover} takes over, they leave the ${place[borrowed.station]}; that station may need cover too.`
      : '';
  return {
    gap: [prefix, relief, staffing, tradeoff].filter(Boolean).join(' '),
    rush: overlaps(row.breakAt, 20, RUSH_FROM, RUSH_TO)
      ? `${name}’s planned meal break (${interval}) overlaps the rush (${hhmm(RUSH_FROM)}–${hhmm(RUSH_TO)}) at the ${station}.`
      : '',
  };
}

export function openingBoard(s: GameState): BoardRow[] {
  const rows = boardDefaults(s);
  const ids = onShift(s);
  // Panel edition never assigns relief without a player's choice. Previous choices survive.
  if (['pass@17', 'pass@18', 'pass@20'].includes(s.version))
    return rows.map((row) => ({
      ...row,
      cover: s.previousBoard?.some((old) => old.cook === row.cook) ? row.cover : null,
    }));
  // Preserve deliberate gaps for a returning crew. A new relief cook can fill old gaps.
  const sameCrew =
    s.previousBoard?.length === ids.length && ids.every((id) => s.previousBoard?.some((r) => r.cook === id));
  if (sameCrew) return rows;
  for (const row of rows) {
    if (row.cover) continue;
    row.cover =
      ids.find(
        (id) =>
          id !== row.cook &&
          memberOf(s, id).home === 'dish' &&
          rows.every(
            (other) =>
              (other.cook !== id && other.cover !== id) || Math.abs(other.breakAt - row.breakAt) >= 20,
          ),
      ) ?? null;
  }
  return rows;
}

export function sameBoard(a: BoardRow[], b: BoardRow[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => {
      const other = b[i];
      return (
        other &&
        row.cook === other.cook &&
        row.station === other.station &&
        row.breakAt === other.breakAt &&
        row.cover === other.cover
      );
    })
  );
}

/** Run the existing HF decision on a copy; reading an old notebook must not append inputs. */
export function boardReplies(s: GameState): BoardRow[] {
  if (s.board?.agreed) return s.board.rows;
  const preview = restoreState(cloneState(s));
  queueInput(preview, { kind: 'board', rows: openingBoard(s) });
  return preview.board?.rows ?? [];
}
