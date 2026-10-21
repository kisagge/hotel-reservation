"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { cn } from "@/components/ui/cn";
import { monthGrid, shiftMonth, weekdayKst, type YMD } from "@/lib/time";
import { dayChips, type DayChip, type TimelineItem } from "./timeline";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const KIND_KO: Record<DayChip["kind"], string> = { DAYUSE: "대실", STAY: "숙박", BLOCK: "차단" };
const CHIP: Record<DayChip["kind"], string> = {
  STAY: "bg-pine text-white",
  DAYUSE: "bg-amber text-white",
  BLOCK: "bg-danger-soft text-danger",
};
const MAX_CHIPS = 3;


/** A2 캘린더 보기: month grid of occupancy, as a native table of day buttons (same pattern as the guest calendar). */
export function AdminCalendar({ month, today, selected, items, onSelect, onMonthChange }: {
  month: string; today: YMD; selected: YMD | null; items: TimelineItem[];
  onSelect: (d: YMD) => void; onMonthChange: (month: string) => void;
}) {
  const titleId = useId();
  const [year, mon] = month.split("-").map(Number);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="이전 달" onClick={() => onMonthChange(shiftMonth(month, -1))}
          className="flex size-10 items-center justify-center rounded-md hover:bg-canvas">
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
        <h2 id={titleId} aria-live="polite" className="min-w-[120px] text-center text-heading-m font-bold">{year}년 {mon}월</h2>
        <button type="button" aria-label="다음 달" onClick={() => onMonthChange(shiftMonth(month, 1))}
          className="flex size-10 items-center justify-center rounded-md hover:bg-canvas">
          <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <table aria-labelledby={titleId} className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {WEEKDAYS.map((w, i) => (
              <th key={w} scope="col" abbr={`${w}요일`} className={cn("h-8 text-center text-caption font-medium", i === 0 ? "text-danger" : "text-ink-2")}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(year, mon).map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => (
                <td key={d ?? `e${di}`} className="relative h-[112px] border border-line p-0 align-top">
                  {d && <Day d={d} chips={dayChips(items, d)} isToday={d === today} selected={d === selected} onSelect={onSelect} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function summary(chips: DayChip[]): string {
  if (chips.length === 0) return "일정 없음";
  return (["DAYUSE", "STAY", "BLOCK"] as const)
    .map((k) => [k, chips.filter((c) => c.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${KIND_KO[k]} ${n}건`)
    .join(", ");
}

function Day({ d, chips, isToday, selected, onSelect }: {
  d: YMD; chips: DayChip[]; isToday: boolean; selected: boolean; onSelect: (d: YMD) => void;
}) {
  const [, m, day] = d.split("-").map(Number);
  const weekday = weekdayKst(d);
  // Same naming as the guest calendar: starts with the only visible text in the button, the day number
  // (WCAG 2.5.3 label in name). The chips sit outside the button as a click-through overlay, summarized here.
  const label = `${day}, ${m}월 ${day}일 ${WEEKDAYS[weekday]}요일${isToday ? ", 오늘" : ""}, ${summary(chips)}`;
  return (
    <>
      <button type="button" aria-label={label} aria-pressed={selected} aria-current={isToday ? "date" : undefined}
        onClick={() => onSelect(d)}
        className={cn("absolute inset-0 flex items-start p-1.5 outline-offset-[-2px] hover:bg-canvas",
          selected && "bg-pine-soft/60 outline-2 outline-pine")}>
        <span className={cn("flex size-6 items-center justify-center rounded-full text-label font-medium",
          isToday ? "bg-pine text-white" : weekday === 0 ? "text-danger" : "text-ink")}>{day}</span>
      </button>
      <div aria-hidden className="pointer-events-none absolute inset-x-1.5 top-[34px] flex flex-col gap-0.5">
        {chips.slice(0, MAX_CHIPS).map((c) => (
          <span key={c.id} className={cn("truncate rounded-[4px] px-1.5 py-px text-caption", CHIP[c.kind])}>
            {c.time} {c.label}
          </span>
        ))}
        {chips.length > MAX_CHIPS && <span className="px-1.5 text-caption text-ink-2">+{chips.length - MAX_CHIPS}건</span>}
      </div>
    </>
  );
}
