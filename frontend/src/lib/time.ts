/**
 * Calendar math in Asia/Seoul. Business dates are "YYYY-MM-DD" strings (YMD) and never go through the
 * browser's local timezone, so a guest abroad still sees the hotel's dates and times.
 */
export type YMD = string;

const KST_YMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const KST_HM = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const toUtc = (d: YMD) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromUtc = (ms: number): YMD => new Date(ms).toISOString().slice(0, 10);

export function todayKst(now: Date = new Date()): YMD {
  return KST_YMD.format(now);
}

export function addDays(d: YMD, n: number): YMD {
  return fromUtc(toUtc(d) + n * 86_400_000);
}

export function diffDays(from: YMD, to: YMD): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function weekdayKst(d: YMD): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(toUtc(d)).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function ymd(year: number, month: number, day: number): YMD {
  return fromUtc(Date.UTC(year, month - 1, day));
}

/** Weeks of a month, Sunday first; days outside the month are null. */
export function monthGrid(year: number, month: number): (YMD | null)[][] {
  const first = ymd(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (YMD | null)[] = [...Array(weekdayKst(first)).fill(null)];
  for (let day = 1; day <= daysInMonth; day++) cells.push(ymd(year, month, day));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function kstParts(iso: string): { ymd: YMD; hour: number; minute: number } {
  const date = new Date(iso);
  const [hour, minute] = KST_HM.format(date).split(":").map(Number);
  return { ymd: KST_YMD.format(date), hour, minute };
}

/** "YYYY-MM-DDTHH:00:00+09:00" for a KST wall-clock time. */
export function kstIso(d: YMD, hour = 0, minute = 0): string {
  return `${d}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}
