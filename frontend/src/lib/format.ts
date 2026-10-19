import { addDays, kstParts, weekdayKst, type YMD } from "./time";

const WEEKDAY_KO = "일월화수목금토";

export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function weekdayKo(d: YMD): string {
  return WEEKDAY_KO[weekdayKst(d)];
}

export function formatDateKo(d: YMD): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일 (${weekdayKo(d)})`;
}

export function formatShortDate(d: YMD): string {
  const [, m, day] = d.split("-");
  return `${m}.${day} (${weekdayKo(d)})`;
}

const hm = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export function formatTime(iso: string): string {
  const { hour, minute } = kstParts(iso);
  return hm(hour, minute);
}

/** Same-day (incl. ending exactly at midnight) → "10월 23일 (금) 15:00 ~ 19:00"; otherwise "start → end" dates. */
export function formatRange(startIso: string, endIso: string): string {
  const s = kstParts(startIso);
  const e = kstParts(endIso);
  if (e.ymd === s.ymd) return `${formatDateKo(s.ymd)} ${hm(s.hour, s.minute)} ~ ${hm(e.hour, e.minute)}`;
  if (e.ymd === addDays(s.ymd, 1) && e.hour === 0 && e.minute === 0)
    return `${formatDateKo(s.ymd)} ${hm(s.hour, s.minute)} ~ 24:00`;
  return `${formatDateKo(s.ymd)} → ${formatDateKo(e.ymd)}`;
}

/** Compact admin table form: "10/19 (월) 12:00 – 16:00" or "10/20 (화) 15:00 → 10/21 11:00". */
export function formatAdminRange(startIso: string, endIso: string): string {
  const s = kstParts(startIso);
  const e = kstParts(endIso);
  const md = (d: YMD) => `${Number(d.slice(5, 7))}/${d.slice(8)}`;
  const sameDay = e.ymd === s.ymd || (e.ymd === addDays(s.ymd, 1) && e.hour === 0 && e.minute === 0);
  if (sameDay) return `${md(s.ymd)} (${weekdayKo(s.ymd)}) ${hm(s.hour, s.minute)} – ${e.ymd === s.ymd ? hm(e.hour, e.minute) : "24:00"}`;
  return `${md(s.ymd)} (${weekdayKo(s.ymd)}) ${hm(s.hour, s.minute)} → ${md(e.ymd)} ${hm(e.hour, e.minute)}`;
}
