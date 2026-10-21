"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReservationDetail } from "@/components/admin/ReservationDetail";
import { ReservationTable } from "@/components/admin/ReservationTable";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { PAGE_SIZE, useAdminReservations, type AdminReservation } from "@/lib/api/adminQueries";
import { kstParts, todayKst } from "@/lib/time";
import { BookingDialog, type BookingDialogMode } from "./BookingDialog";
import { CalendarView } from "./CalendarView";
import { filtersFromSearch, filtersToSearch, type AdminFilters } from "./filters";

const chip = "h-11 rounded-md border border-field bg-surface px-3.5 text-body-m font-medium outline-none focus:border-pine";

const toggle = (on: boolean) => cn("flex h-9 items-center rounded-sm px-6", on ? "bg-surface text-heading-s font-bold shadow-card" : "text-body-m font-medium text-ink-2 hover:text-ink");

/** A2 · 예약 관리 (Figma 11:52): list or calendar view. Filters, view and the selected row live in the URL. */
export function ReservationsScreen() {
  const sp = useSearchParams();
  const calendar = sp.get("view") === "calendar";
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [dialog, setDialog] = useState<BookingDialogMode | null>(null);
  const onReschedule = (reservation: AdminReservation) => setDialog({ kind: "reschedule", reservation });

  /** Show the booking just created or moved: its detail, and in the calendar also its day. */
  const reveal = (r: AdminReservation) => {
    const next = new URLSearchParams(sp.toString());
    next.set("id", String(r.id));
    if (calendar) {
      const day = kstParts(r.start_at).ymd;
      next.set("m", day.slice(0, 7));
      next.set("day", day);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  return (
    <>
      <AdminPageHeader title="예약 관리" subtitle="대실·숙박 예약을 한곳에서 확인하고 관리해요"
        actions={<>
          <Button size="m" onClick={() => setDialog({ kind: "create" })}>예약 추가</Button>
          <div role="group" aria-label="보기 방식" className="flex gap-1 rounded-md bg-muted p-1">
            <button type="button" aria-pressed={!calendar} className={toggle(!calendar)}
              onClick={() => calendar && router.replace(pathname, { scroll: false })}>목록</button>
            <button type="button" aria-pressed={calendar} className={toggle(calendar)}
              onClick={() => !calendar && router.replace(`${pathname}?view=calendar`, { scroll: false })}>캘린더</button>
          </div>
        </>} />
      {calendar ? <CalendarView onReschedule={onReschedule} /> : <ListView onReschedule={onReschedule} />}
      <BookingDialog open={!!dialog} mode={dialog ?? { kind: "create" }} onClose={() => setDialog(null)}
        onDone={(r) => {
          toast(dialog?.kind === "reschedule" ? `일정을 변경했어요 · ${r.code}` : `예약을 추가했어요 · ${r.code}`);
          setDialog(null);
          reveal(r);
        }} />
    </>
  );
}

function ListView({ onReschedule }: { onReschedule: (r: AdminReservation) => void }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = filtersFromSearch(new URLSearchParams(sp.toString()), todayKst());
  // The search debounce fires after later renders; read the newest URL filters, not the ones it closed over.
  const latest = useRef(f);
  useEffect(() => { latest.current = f; });
  const set = (patch: Partial<AdminFilters>) =>
    router.replace(`${pathname}?${filtersToSearch({ ...latest.current, page: 1, ...patch })}`, { scroll: false });
  const badRange = f.from > f.to;
  const list = useAdminReservations(f, !badRange);
  const [q, setQ] = useState(f.q);

  useEffect(() => {
    if (q === f.q) return;
    const t = setTimeout(() => set({ q, id: null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-md border border-field bg-surface px-3.5 focus-within:border-pine">
          <Search className="size-[18px] text-ink-3" strokeWidth={1.75} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예약번호, 예약자 이름, 연락처로 검색"
            aria-label="예약 검색" className="flex-1 bg-transparent text-body-m outline-none placeholder:text-ink-3" />
        </label>
        <input type="date" aria-label="시작일" className={chip} value={f.from} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        <span className="text-ink-3">–</span>
        <input type="date" aria-label="종료일" className={chip} value={f.to} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        <select aria-label="유형" className={chip} value={f.type} onChange={(e) => set({ type: e.target.value as AdminFilters["type"] })}>
          <option value="">유형 · 전체</option><option value="DAYUSE">대실</option><option value="STAY">숙박</option>
        </select>
        <select aria-label="상태" className={chip} value={f.status} onChange={(e) => set({ status: e.target.value as AdminFilters["status"] })}>
          <option value="">상태 · 전체</option><option value="CONFIRMED">예약확정</option><option value="CANCELLED">취소됨</option>
        </select>
      </div>
      <div className="flex min-h-[640px] items-stretch gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-line bg-surface px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-s font-bold">총 {total}건</h2>
            <span className="text-label font-medium text-ink-2">이용일 빠른 순</span>
          </div>
          {badRange ? (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-body-m text-danger">시작일이 종료일보다 늦어요. 기간을 다시 선택해 주세요.</p>
          ) : list.isError ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-danger-soft px-4 py-3 text-body-m text-danger">
              예약 목록을 불러오지 못했어요
              <Button size="m" variant="secondary" onClick={() => list.refetch()}>다시 시도</Button>
            </div>
          ) : (
            <ReservationTable items={list.data?.items ?? []} selectedId={f.id} empty="조건에 맞는 예약이 없어요"
              onRowClick={(r) => router.replace(`${pathname}?${filtersToSearch({ ...f, id: r.id })}`, { scroll: false })} />
          )}
          <div className="flex-1" />
          {pages > 1 && (
            <nav aria-label="페이지" className="flex items-center justify-center gap-1">
              <button type="button" aria-label="이전 페이지" disabled={f.page <= 1} onClick={() => set({ page: f.page - 1, id: f.id })}
                className="p-1 text-ink-2 disabled:text-ink-3"><ChevronLeft className="size-[18px]" /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" aria-current={p === f.page ? "page" : undefined} onClick={() => set({ page: p, id: f.id })}
                  className={cn("size-8 rounded-sm text-label font-medium", p === f.page ? "bg-pine text-white" : "text-ink-2 hover:bg-canvas")}>{p}</button>
              ))}
              <button type="button" aria-label="다음 페이지" disabled={f.page >= pages} onClick={() => set({ page: f.page + 1, id: f.id })}
                className="p-1 text-ink-2 disabled:text-ink-3"><ChevronRight className="size-[18px]" /></button>
            </nav>
          )}
        </section>
        <ReservationDetail id={f.id} onReschedule={onReschedule}
          onClose={() => router.replace(`${pathname}?${filtersToSearch({ ...f, id: null })}`, { scroll: false })} />
      </div>
    </>
  );
}
