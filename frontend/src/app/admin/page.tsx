"use client";

import { Ban, CalendarDays, KeyRound, LogOut, Receipt } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DayTimeline, TIMELINE_LEGEND } from "@/components/admin/DayTimeline";
import { KpiCard } from "@/components/admin/KpiCard";
import { ReservationTable } from "@/components/admin/ReservationTable";
import { useBlocks, useDashboard } from "@/lib/api/adminQueries";
import { formatAdminRange, formatDateKo, formatWon } from "@/lib/format";
import { todayKst } from "@/lib/time";

/** A1 · 대시보드 (Figma 10:10). */
export default function DashboardPage() {
  const dash = useDashboard();
  const blocks = useBlocks();
  const today = todayKst();
  const d = dash.data;
  const [y] = today.split("-");
  return (
    <>
      <AdminPageHeader title="대시보드" subtitle={`${y}년 ${formatDateKo(today)} · 오늘도 하루가 시작됐어요`}
        actions={<>
          <Link href="/admin/settings#blocks" className="flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-label font-medium hover:bg-canvas">차단 일정 추가</Link>
          <Link href="/admin/reservations" className="flex h-10 items-center rounded-md bg-pine px-4 text-label font-medium text-white hover:bg-pine-hover">예약 관리</Link>
        </>} />
      <div className="flex gap-4">
        <KpiCard icon={KeyRound} label="오늘 체크인" value={d ? `${d.today_check_ins}건` : "–"} sub="대실·숙박 입실" />
        <KpiCard icon={LogOut} label="오늘 체크아웃" value={d ? `${d.today_check_outs}건` : "–"} sub="숙박 퇴실" />
        <KpiCard icon={CalendarDays} label="이번 주 예약" value={d ? `${d.week_reservations}건` : "–"} sub="월요일 ~ 일요일 입실 기준" tone="text-success" />
        <KpiCard icon={Receipt} label={`${Number(today.slice(5, 7))}월 매출`} value={d ? formatWon(d.month_revenue) : "–"} sub="확정 예약 기준" tone="text-amber" />
      </div>
      <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-heading-m font-bold">오늘의 객실 타임라인</h2>
            <p className="text-caption text-ink-2">701호 · 모든 예약은 퇴실 후 청소 시간을 포함해요</p>
          </div>
          <ul className="flex items-center gap-4 text-caption text-ink-2">
            {TIMELINE_LEGEND.map(([c, l]) => <li key={l} className="flex items-center gap-1.5"><span className={`size-3 rounded-[3px] border border-line ${c}`} />{l}</li>)}
          </ul>
        </div>
        {d ? <DayTimeline items={d.today_timeline} day={today} /> : <div className="h-20 animate-pulse rounded-md bg-muted" />}
      </section>
      <div className="flex items-start gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-m font-bold">다가오는 예약</h2>
            <Link href="/admin/reservations" className="text-label font-medium text-pine">전체 보기 →</Link>
          </div>
          <ReservationTable items={d?.upcoming ?? []} empty="다가오는 예약이 없어요" />
        </section>
        <section className="flex w-[320px] shrink-0 flex-col gap-3 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-heading-m font-bold">예정된 차단 일정</h2>
          {blocks.data?.length === 0 && <p className="py-4 text-body-m text-ink-3">예정된 차단 일정이 없어요</p>}
          {blocks.data?.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-md bg-canvas p-3">
              <Ban className="size-[18px] shrink-0 text-danger" strokeWidth={1.75} aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="text-body-m font-medium">{formatAdminRange(b.start_at, b.end_at)}</span>
                <span className="text-caption text-ink-2">{b.reason}</span>
              </div>
            </div>
          ))}
          <Link href="/admin/settings#blocks" className="flex h-10 items-center justify-center rounded-md text-label font-medium text-pine hover:bg-pine-soft/50">+ 차단 일정 추가</Link>
        </section>
      </div>
    </>
  );
}
