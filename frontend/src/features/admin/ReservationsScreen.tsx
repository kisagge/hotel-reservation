"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReservationDetail } from "@/components/admin/ReservationDetail";
import { ReservationTable } from "@/components/admin/ReservationTable";
import { cn } from "@/components/ui/cn";
import { PAGE_SIZE, useAdminReservations } from "@/lib/api/adminQueries";
import { todayKst } from "@/lib/time";
import { filtersFromSearch, filtersToSearch, type AdminFilters } from "./filters";

const chip = "h-11 rounded-md border border-line bg-surface px-3.5 text-body-m font-medium outline-none focus:border-pine";

/** A2 · 예약 관리 (Figma 11:52). Filters and the selected row live in the URL. */
export function ReservationsScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = filtersFromSearch(new URLSearchParams(sp.toString()), todayKst());
  const set = (patch: Partial<AdminFilters>) =>
    router.replace(`${pathname}?${filtersToSearch({ ...f, page: 1, ...patch })}`, { scroll: false });
  const list = useAdminReservations(f);
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
      <AdminPageHeader title="예약 관리" subtitle="대실·숙박 예약을 한곳에서 확인하고 관리해요"
        actions={
          <div role="tablist" className="flex gap-1 rounded-md bg-muted p-1">
            <span role="tab" aria-selected className="flex h-9 items-center rounded-sm bg-surface px-6 text-heading-s font-bold shadow-card">목록</span>
            <span role="tab" aria-disabled title="준비 중" className="flex h-9 cursor-not-allowed items-center px-6 text-body-m font-medium text-ink-3">캘린더</span>
          </div>
        } />
      <div className="flex items-center gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3.5 focus-within:border-pine">
          <Search className="size-[18px] text-ink-3" strokeWidth={1.75} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예약번호, 예약자 이름, 연락처로 검색"
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
          <ReservationTable items={list.data?.items ?? []} selectedId={f.id} empty="조건에 맞는 예약이 없어요"
            onRowClick={(r) => router.replace(`${pathname}?${filtersToSearch({ ...f, id: r.id })}`, { scroll: false })} />
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
        <ReservationDetail id={f.id} onClose={() => router.replace(`${pathname}?${filtersToSearch({ ...f, id: null })}`, { scroll: false })} />
      </div>
    </>
  );
}
