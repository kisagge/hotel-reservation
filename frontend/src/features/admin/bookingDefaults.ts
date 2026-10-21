import { addDays, type YMD } from "@/lib/time";

/**
 * The first day-use start that is still in the future (a start must be later than now): the next whole hour
 * today within the opening hours, else tomorrow's first start.
 */
export function defaultSlot(rules: { dayuse_first_start_hour: number; dayuse_last_start_hour: number },
                            now: { ymd: YMD; hour: number; minute: number }): { date: YMD; hour: number } {
  const next = Math.max(rules.dayuse_first_start_hour, now.hour + 1);
  if (next <= rules.dayuse_last_start_hour) return { date: now.ymd, hour: next };
  return { date: addDays(now.ymd, 1), hour: rules.dayuse_first_start_hour };
}
