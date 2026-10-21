"use client";

import { Ban } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { DayTimeline, TIMELINE_LEGEND } from "@/components/admin/DayTimeline";
import { ReservationDetail } from "@/components/admin/ReservationDetail";
import { dayChips, type TimelineItem } from "@/components/admin/timeline";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { useOccupancy, type AdminReservation } from "@/lib/api/adminQueries";
import { formatAdminRange, formatDateKo } from "@/lib/format";
import { todayKst, type YMD } from "@/lib/time";
import { calendarFromSearch, calendarToSearch, monthRange, type CalendarState } from "./calendar";

const KIND_KO = { DAYUSE: "대실", STAY: "숙박", BLOCK: "차단" } as const;
const DOT = { DAYUSE: "bg-amber", STAY: "bg-pine", BLOCK: "bg-danger" } as const;

/** A2 · 예약 관리 → 캘린더 보기. Month, selected day and the opened booking live in the URL. */
export function CalendarView({ onReschedule }: { onReschedule: (r: AdminReservation) => void }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayKst();
  const cal = calendarFromSearch(new URLSearchParams(sp.toString()), today);
  const id = Number(sp.get("id")) || null;
  const go = (next: CalendarState, nextId: number | null = null) =>
    router.replace(`${pathname}?${calendarToSearch(next, nextId)}`, { scroll: false });
  const [from, to] = monthRange(cal.month);
  const occ = useOccupancy(from, to);
  const items = occ.data ?? [];

  // Opening a booking swaps the day panel for the detail (and back), unmounting the focused button; move keyboard
  // focus with it. A deep link (id already in the URL on load) does not steal focus.
  const detailRef = useRef<HTMLDivElement>(null);
  const shownId = useRef(id);
  useEffect(() => {
    const prev = shownId.current;
    shownId.current = id;
    if (id && id !== prev) detailRef.current?.focus();
    else if (!id && prev) {
      const back = document.querySelector<HTMLElement>(`[data-booking-id="${prev}"]`)
        ?? document.querySelector<HTMLElement>('table [aria-pressed="true"]');
      back?.focus();
    }
  }, [id]);

  return (
    <div className="flex min-h-[640px] items-start gap-4">
      <section aria-label="월간 일정" className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-line bg-surface px-5 pb-5 pt-4">
        {occ.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-danger-soft px-4 py-3 text-body-m text-danger">
            일정을 불러오지 못했어요
            <Button size="m" variant="secondary" onClick={() => occ.refetch()}>다시 시도</Button>
          </div>
        ) : (
          <AdminCalendar month={cal.month} today={today} selected={cal.day} items={items}
            onSelect={(day) => go({ ...cal, day })} onMonthChange={(month) => go({ month, day: null })} />
        )}
        <ul className="flex items-center gap-4 text-caption text-ink-2">
          {(["STAY", "DAYUSE", "BLOCK"] as const).map((k) => (
            <li key={k} className="flex items-center gap-1.5"><span className={cn("size-3 rounded-[3px]", DOT[k])} />{KIND_KO[k]}</li>
          ))}
        </ul>
      </section>
      {id ? (
        <div ref={detailRef} tabIndex={-1} className="shrink-0 outline-none">
          <ReservationDetail key={id} id={id} onReschedule={onReschedule} onClose={() => go(cal)} />
        </div>
      ) : (
        <DayPanel day={cal.day} items={items} loading={occ.isPending} onOpen={(rid) => go(cal, rid)} />
      )}
    </div>
  );
}

function DayPanel({ day, items, loading, onOpen }: {
  day: YMD | null; items: TimelineItem[]; loading: boolean; onOpen: (id: number) => void;
}) {
  const headingId = useId();
  if (!day)
    return (
      <aside aria-label="날짜별 일정" className="flex w-[372px] shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong p-6 text-center text-body-m text-ink-3">
        날짜를 선택하면<br />그날 일정이 보여요
      </aside>
    );
  const chips = dayChips(items, day);
  const byId = new Map(items.map((it) => [it.id, it]));
  return (
    <section aria-labelledby={headingId} className="flex w-[372px] shrink-0 flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <h2 id={headingId} className="text-heading-m font-bold">{formatDateKo(day)}</h2>
      {loading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      ) : (
        <>
          <DayTimeline items={items} day={day} height={40} compact labels={false} />
          <ul aria-hidden className="flex flex-wrap gap-3 text-caption text-ink-2">
            {TIMELINE_LEGEND.map(([c, l]) => <li key={l} className="flex items-center gap-1.5"><span className={`size-3 rounded-[3px] border border-line ${c}`} />{l}</li>)}
          </ul>
          {chips.length === 0 ? (
            <p className="rounded-md bg-canvas px-4 py-6 text-center text-body-m text-ink-3">이날은 일정이 없어요</p>
          ) : (
            <ul aria-label="이날 일정" className="flex flex-col gap-2">
              {chips.map((c) => {
                const it = byId.get(c.id)!;
                const body = (
                  <>
                    <span className={cn("size-2.5 shrink-0 rounded-full", DOT[c.kind])} aria-hidden />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-body-m font-medium">{KIND_KO[c.kind]} · {c.label}</span>
                      <span className="text-caption text-ink-2">{formatAdminRange(it.start_at, it.end_at)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={c.id}>
                    {c.kind === "BLOCK" ? (
                      <div className="flex items-center gap-3 rounded-md bg-canvas p-3">
                        {body}
                        <Ban className="ml-auto size-4 shrink-0 text-danger" strokeWidth={1.75} aria-hidden />
                      </div>
                    ) : (
                      <button type="button" data-booking-id={c.id} onClick={() => onOpen(c.id)}
                        className="flex w-full items-center gap-3 rounded-md bg-canvas p-3 text-left hover:bg-pine-soft/50">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
