import type { YMD } from "@/lib/time";
import { addDays, kstIso, kstParts } from "@/lib/time";

export type TimelineItem = {
  id: number; type: "DAYUSE" | "STAY" | "BLOCK"; start_at: string; end_at: string; blocked_until: string;
  guest_name: string; block_reason: string | null;
};
export type Segment = { kind: "STAY" | "DAYUSE" | "BLOCK" | "CLEANING" | "FREE"; fromHour: number; toHour: number; label?: string };

/**
 * Split one KST day (0–24h) into occupancy, cleaning buffer (end_at → blocked_until) and free gaps.
 * Rows that start the day before or end the day after are clipped at the day edges.
 */
export function timelineSegments(items: TimelineItem[], day: YMD): Segment[] {
  const dayStart = Date.parse(kstIso(day));
  const dayEnd = Date.parse(kstIso(addDays(day, 1)));
  const toHour = (ms: number) => Math.round(((Math.min(Math.max(ms, dayStart), dayEnd) - dayStart) / 3_600_000) * 100) / 100;
  const busy: Segment[] = [];
  for (const it of [...items].sort((a, b) => a.start_at.localeCompare(b.start_at))) {
    const [s, e, b] = [Date.parse(it.start_at), Date.parse(it.end_at), Date.parse(it.blocked_until)];
    const label = it.type === "BLOCK" ? it.block_reason ?? "차단" : it.guest_name;
    if (toHour(e) > toHour(s)) busy.push({ kind: it.type, fromHour: toHour(s), toHour: toHour(e), label });
    if (toHour(b) > toHour(e)) busy.push({ kind: "CLEANING", fromHour: toHour(e), toHour: toHour(b) });
  }
  const out: Segment[] = [];
  let cursor = 0;
  for (const seg of busy) {
    if (seg.fromHour > cursor) out.push({ kind: "FREE", fromHour: cursor, toHour: seg.fromHour });
    out.push(seg);
    cursor = Math.max(cursor, seg.toHour);
  }
  if (cursor < 24) out.push({ kind: "FREE", fromHour: cursor, toHour: 24 });
  return out;
}

export type DayChip = { id: number; kind: TimelineItem["type"]; time: string; label: string };

const hhmm = (ms: number) => {
  const { hour, minute } = kstParts(new Date(ms).toISOString());
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

/**
 * Calendar-cell entries for one KST day: rows whose stay or use ([start_at, end_at)) touches the day, with the part
 * of the day they cover ("15:00" from, "~11:00" until, "종일"). Cleaning buffers alone do not put a row on a day.
 */
export function dayChips(items: TimelineItem[], day: YMD): DayChip[] {
  const dayStart = Date.parse(kstIso(day));
  const dayEnd = Date.parse(kstIso(addDays(day, 1)));
  return [...items]
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .flatMap((it) => {
      const from = Math.max(Date.parse(it.start_at), dayStart);
      const to = Math.min(Date.parse(it.end_at), dayEnd);
      if (from >= to) return [];
      const time = from === dayStart ? (to === dayEnd ? "종일" : `~${hhmm(to)}`) : hhmm(from);
      return [{ id: it.id, kind: it.type, time, label: it.type === "BLOCK" ? it.block_reason ?? "차단" : it.guest_name }];
    });
}
