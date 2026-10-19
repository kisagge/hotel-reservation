"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { monthGrid, weekdayKst, type YMD } from "@/lib/time";
import { cn } from "./cn";

export type DayState = "default" | "disabled" | "soldout" | "selected" | "inRange";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS: Record<DayState, string> = { default: "", disabled: ", 선택 불가", soldout: ", 예약 마감", selected: ", 선택됨", inRange: ", 숙박 기간" };

/** Figma "Calendar Day" (5:20) cells in a month card (G2/G3), as a native table of day buttons. */
export function CalendarMonth({ year, month, today, dayState, onSelect, onMonthChange, canPrev, canNext }: {
  year: number; month: number; today: YMD; dayState: (d: YMD) => DayState;
  onSelect: (d: YMD) => void; onMonthChange: (delta: -1 | 1) => void; canPrev: boolean; canNext: boolean;
}) {
  const titleId = useId();
  return (
    <div className="rounded-lg border border-line bg-surface px-2 pb-3 pt-4">
      <div className="flex items-center justify-between px-1 pb-2">
        <button type="button" aria-label="이전 달" disabled={!canPrev} onClick={() => onMonthChange(-1)}
          className={cn("-m-2 flex size-11 items-center justify-center rounded-md", canPrev ? "text-ink" : "text-ink-disabled")}>
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
        <h2 id={titleId} className="text-heading-m font-bold" aria-live="polite">{year}년 {month}월</h2>
        <button type="button" aria-label="다음 달" disabled={!canNext} onClick={() => onMonthChange(1)}
          className={cn("-m-2 flex size-11 items-center justify-center rounded-md", canNext ? "text-ink" : "text-ink-disabled")}>
          <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <table aria-labelledby={titleId} className="w-full table-fixed border-separate border-spacing-y-2">
        <thead>
          <tr>
            {WEEKDAYS.map((w, i) => (
              <th key={w} scope="col" abbr={`${w}요일`} className={cn("h-5 text-center text-caption font-normal", i === 0 ? "text-danger" : "text-ink-3")}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(year, month).map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => (
                <td key={d ?? `e${di}`} className="p-0 text-center">
                  {d && <DayCell d={d} state={dayState(d)} isToday={d === today} onSelect={onSelect} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayCell({ d, state, isToday, onSelect }: { d: YMD; state: DayState; isToday: boolean; onSelect: (d: YMD) => void }) {
  const blocked = state === "disabled" || state === "soldout";
  const weekday = weekdayKst(d);
  const day = Number(d.slice(8));
  const tone = {
    selected: "bg-pine text-white text-heading-s font-bold",
    inRange: "bg-pine-soft text-pine text-body-m",
    soldout: "bg-disabled text-ink-disabled text-body-m line-through",
    disabled: "text-ink-disabled text-body-m",
    default: cn("text-body-m hover:bg-canvas", isToday ? "text-heading-s font-bold text-pine" : weekday === 0 ? "text-danger" : "text-ink"),
  }[state];
  const status = STATUS[state] || (isToday ? ", 오늘" : "");
  return (
    <button
      type="button"
      aria-label={`${day}, ${Number(d.slice(5, 7))}월 ${day}일 ${WEEKDAYS[weekday]}요일${status}`}
      aria-disabled={blocked || undefined}
      aria-pressed={state === "selected" || state === "inRange"}
      aria-current={isToday ? "date" : undefined}
      onClick={() => !blocked && onSelect(d)}
      className={cn("relative mx-auto flex h-[52px] w-full max-w-12 flex-col items-center justify-center gap-0.5 rounded-md", blocked && "cursor-default", tone)}
    >
      {day}
      {isToday && state === "default" && <span className="size-1 rounded-full bg-pine" aria-hidden />}
    </button>
  );
}
