"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateKo } from "@/lib/format";
import { monthGrid, weekdayKst, type YMD } from "@/lib/time";
import { cn } from "./cn";

export type DayState = "default" | "disabled" | "soldout" | "selected" | "inRange";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** Figma "Calendar Day" (5:20) cells in a month card (G2/G3). */
export function CalendarMonth({ year, month, today, dayState, onSelect, onMonthChange, canPrev, canNext }: {
  year: number; month: number; today: YMD; dayState: (d: YMD) => DayState;
  onSelect: (d: YMD) => void; onMonthChange: (delta: -1 | 1) => void; canPrev: boolean; canNext: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-2 pb-3 pt-4">
      <div className="flex items-center justify-between px-1 pb-2">
        <button type="button" aria-label="이전 달" disabled={!canPrev} onClick={() => onMonthChange(-1)}
          className={cn("p-1", canPrev ? "text-ink" : "text-ink-3")}>
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        <h3 className="text-heading-m font-bold">{year}년 {month}월</h3>
        <button type="button" aria-label="다음 달" disabled={!canNext} onClick={() => onMonthChange(1)}
          className={cn("p-1", canNext ? "text-ink" : "text-ink-3")}>
          <ChevronRight className="size-5" strokeWidth={1.75} />
        </button>
      </div>
      <div role="grid" aria-label={`${year}년 ${month}월`} className="flex flex-col gap-2">
        <div role="row" className="flex justify-between">
          {WEEKDAYS.map((w, i) => (
            <span key={w} role="columnheader" className={cn("w-12 text-center text-caption", i === 0 ? "text-danger" : "text-ink-3")}>{w}</span>
          ))}
        </div>
        {monthGrid(year, month).map((week, wi) => (
          <div role="row" key={wi} className="flex justify-between">
            {week.map((d, di) =>
              d ? <DayCell key={d} d={d} state={dayState(d)} isToday={d === today} onSelect={onSelect} /> : <span key={`e${di}`} className="h-[52px] w-12" />,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({ d, state, isToday, onSelect }: { d: YMD; state: DayState; isToday: boolean; onSelect: (d: YMD) => void }) {
  const blocked = state === "disabled" || state === "soldout";
  const sunday = weekdayKst(d) === 0;
  const day = Number(d.slice(8));
  const tone = {
    selected: "bg-pine text-white text-heading-s font-bold",
    inRange: "bg-pine-soft text-pine text-body-m",
    soldout: "bg-disabled text-ink-disabled text-body-m line-through",
    disabled: "text-ink-disabled text-body-m",
    default: cn("text-body-m hover:bg-canvas", isToday ? "text-heading-s font-bold text-pine" : sunday ? "text-danger" : "text-ink"),
  }[state];
  const status = state === "soldout" ? ", 예약 마감" : state === "disabled" ? ", 선택 불가" : state === "selected" ? ", 선택됨" : "";
  return (
    <button
      type="button"
      role="gridcell"
      aria-label={`${formatDateKo(d)}${status}`}
      aria-disabled={blocked || undefined}
      aria-selected={state === "selected" || state === "inRange"}
      data-today={isToday || undefined}
      onClick={() => !blocked && onSelect(d)}
      className={cn("relative flex h-[52px] w-12 flex-col items-center justify-center gap-0.5 rounded-md", blocked && "cursor-default", tone)}
    >
      {day}
      {isToday && state === "default" && <span className="size-1 rounded-full bg-pine" aria-hidden />}
    </button>
  );
}
