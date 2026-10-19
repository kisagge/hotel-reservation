import { addDays, diffDays, type YMD } from "@/lib/time";

export type StayRange = { checkIn: YMD | null; checkOut: YMD | null };
export type StayAction = { type: "pick"; date: YMD; isAvailable: (night: YMD) => boolean; maxNights: number };

export const EMPTY_RANGE: StayRange = { checkIn: null, checkOut: null };

const restart = (date: YMD): StayRange => ({ checkIn: date, checkOut: null });

/**
 * Two-tap range picker. A pick completes the range only if every night in [checkIn, pick) is available and the
 * stay fits maxNights; otherwise the pick becomes the new check-in. The API quote is still the final word.
 */
export function stayRangeReducer(state: StayRange, action: StayAction): StayRange {
  const { date, isAvailable, maxNights } = action;
  if (!state.checkIn || state.checkOut || date <= state.checkIn) return restart(date);
  const nights = diffDays(state.checkIn, date);
  if (nights > maxNights) return restart(date);
  for (let i = 0; i < nights; i++) if (!isAvailable(addDays(state.checkIn, i))) return restart(date);
  return { checkIn: state.checkIn, checkOut: date };
}

export function nightsOf(r: StayRange): number | null {
  return r.checkIn && r.checkOut ? diffDays(r.checkIn, r.checkOut) : null;
}
