import type { QuoteIn } from "./useAvailability";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** `/checkout?type=DAYUSE&date=&hour=` or `?type=STAY&in=&nights=` → QuoteIn; anything malformed → null. */
export function parseCheckoutParams(sp: URLSearchParams): QuoteIn | null {
  const int = (k: string) => (/^\d{1,2}$/.test(sp.get(k) ?? "") ? Number(sp.get(k)) : null);
  if (sp.get("type") === "DAYUSE") {
    const date = sp.get("date");
    const hour = int("hour");
    return date && YMD.test(date) && hour !== null ? { type: "DAYUSE", date, start_hour: hour } : null;
  }
  if (sp.get("type") === "STAY") {
    const checkIn = sp.get("in");
    const nights = int("nights");
    return checkIn && YMD.test(checkIn) && nights ? { type: "STAY", check_in: checkIn, nights } : null;
  }
  return null;
}

export function bookingHref(q: QuoteIn): string {
  return q.type === "DAYUSE" ? `/book?tab=dayuse&date=${q.date}` : `/book?tab=stay&in=${q.check_in}`;
}
