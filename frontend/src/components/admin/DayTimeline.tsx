import { cn } from "@/components/ui/cn";
import type { YMD } from "@/lib/time";
import { timelineSegments, type Segment, type TimelineItem } from "./timeline";

const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const STYLE: Record<Segment["kind"], string> = {
  STAY: "bg-pine text-white",
  DAYUSE: "bg-amber text-white",
  BLOCK: "bg-danger-soft text-danger",
  CLEANING: "bg-muted text-ink-2",
  FREE: "text-ink-3",
};
const KIND_KO: Record<Segment["kind"], string> = { STAY: "숙박", DAYUSE: "대실", BLOCK: "차단", CLEANING: "청소", FREE: "예약 가능" };

export const TIMELINE_LEGEND: [string, string][] = [["bg-pine", "숙박"], ["bg-amber", "대실"], ["bg-muted", "청소"], ["bg-canvas", "예약 가능"]];

/** 24h occupancy bar (A1 "오늘의 객실 타임라인", also reused by the A3 rule preview). */
export function DayTimeline({ items, day, height = 64, compact = false, segments }: {
  items?: TimelineItem[]; day?: YMD; height?: number; compact?: boolean; segments?: Segment[];
}) {
  const segs = segments ?? timelineSegments(items ?? [], day!);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full overflow-hidden rounded-md border border-line bg-canvas" style={{ height }}>
        {segs.map((s, i) => {
          const width = s.toHour - s.fromHour;
          const wide = width >= (compact ? 2.5 : 1.5);
          return (
            <div key={i} title={`${KIND_KO[s.kind]} ${hhmm(s.fromHour)}–${hhmm(s.toHour)}${s.label ? ` · ${s.label}` : ""}`}
              className={cn("absolute inset-y-0 flex flex-col justify-center overflow-hidden whitespace-nowrap px-3", STYLE[s.kind], compact && "items-center px-1")}
              style={{ left: `${(s.fromHour / 24) * 100}%`, width: `${(width / 24) * 100}%` }}>
              {wide && (
                <>
                  <span className={cn("font-medium", compact ? "text-caption" : "text-label")}>
                    {s.kind === "CLEANING" || s.kind === "FREE" ? KIND_KO[s.kind] : compact ? `${KIND_KO[s.kind]} ${s.fromHour === 0 ? `~${hhmm(s.toHour)}` : hhmm(s.fromHour)}` : `${KIND_KO[s.kind]}${s.label ? ` · ${s.label}` : ""}`}
                  </span>
                  {!compact && s.kind !== "CLEANING" && (
                    <span className="text-caption opacity-80">{s.kind === "FREE" ? `${hhmm(s.fromHour)} 이후` : `${hhmm(s.fromHour)} – ${hhmm(s.toHour)}`}</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-caption text-ink-3">
        {(compact ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]).map((h) => <span key={h}>{String(h).padStart(2, "0")}{compact ? "" : ":00"}</span>)}
      </div>
    </div>
  );
}
