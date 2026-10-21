import { addDays, type YMD } from "@/lib/time";
import { isYmd } from "./filters";

/** "YYYY-MM" */
export type YM = string;
export type CalendarState = { month: YM; day: YMD | null };

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthOf = (d: YMD): YM => d.slice(0, 7);
export const monthRange = (m: YM): [YMD, YMD] => {
  const [y, mon] = m.split("-").map(Number);
  const next = mon === 12 ? `${y + 1}-01` : `${y}-${String(mon + 1).padStart(2, "0")}`;
  return [`${m}-01`, addDays(`${next}-01`, -1)];
};

/** URL → calendar view state (A2 캘린더). Bad values fall back to this KST month; today is preselected in it. */
export function calendarFromSearch(sp: URLSearchParams, today: YMD): CalendarState {
  const m = sp.get("m");
  const month = m && YM_RE.test(m) ? m : monthOf(today);
  const day = sp.get("day");
  if (isYmd(day) && monthOf(day) === month) return { month, day };
  return { month, day: monthOf(today) === month ? today : null };
}

export function calendarToSearch(c: CalendarState, id: number | null): string {
  const sp = new URLSearchParams({ view: "calendar", m: c.month });
  if (c.day) sp.set("day", c.day);
  if (id) sp.set("id", String(id));
  return sp.toString();
}
