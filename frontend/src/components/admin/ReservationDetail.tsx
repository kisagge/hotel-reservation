"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useAdminCancel, useAdminReservation } from "@/lib/api/adminQueries";
import { ApiError } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";
import { formatAdminRange, formatRange, formatTime, formatWon, weekdayKo } from "@/lib/format";
import { kstParts } from "@/lib/time";

const dotDate = (iso: string) => {
  const { ymd } = kstParts(iso);
  return `${ymd.replaceAll("-", ".")} (${weekdayKo(ymd)})`;
};
const dateTime = (iso: string) => `${kstParts(iso).ymd.replaceAll("-", ".")} ${formatTime(iso)}`;

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-body-m">
      <span className="shrink-0 text-ink-2">{k}</span><span className={`text-right font-medium ${tone ?? ""}`}>{v}</span>
    </div>
  );
}

/** A2 right-hand "예약 상세" panel. */
export function ReservationDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const detail = useAdminReservation(id);
  const cancel = useAdminCancel();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const r = detail.data;

  if (!id) return <aside className="flex w-[372px] shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong p-6 text-center text-body-m text-ink-3">예약을 선택하면<br />상세 정보가 보여요</aside>;
  if (!r) return <aside className="w-[372px] shrink-0 animate-pulse rounded-lg border border-line bg-surface" />;

  const hours = Math.round((Date.parse(r.end_at) - Date.parse(r.start_at)) / 3_600_000);
  const cancellable = r.display_status === "CONFIRMED";
  const doCancel = () =>
    cancel.mutate(r.id, {
      onSuccess: () => toast("예약을 취소했어요"),
      onError: (e) => toast(errorMessage(e instanceof ApiError ? e.code : null), "danger"),
      onSettled: () => setConfirming(false),
    });

  return (
    <aside aria-label="예약 상세" className="flex w-[372px] shrink-0 flex-col gap-5 rounded-lg border border-line bg-surface p-6">
      <div className="flex flex-col gap-2">
        <span className="text-caption text-ink-3">예약 상세</span>
        <h2 className="text-heading-l font-bold">{r.code}</h2>
        <div className="flex gap-1.5"><Badge kind={r.type === "STAY" ? "STAY" : "DAYUSE"} /><Badge kind={r.display_status} /></div>
      </div>
      <hr className="border-line" />
      <section className="flex flex-col gap-2.5">
        <h3 className="text-label font-medium text-ink-3">이용 정보</h3>
        <Row k="이용일" v={r.type === "STAY" ? formatRange(r.start_at, r.end_at) : dotDate(r.start_at)} />
        <Row k="시간" v={r.type === "STAY" ? `체크인 ${formatTime(r.start_at)} · 체크아웃 ${formatTime(r.end_at)} (${r.nights}박)` : `${formatAdminRange(r.start_at, r.end_at).split(") ")[1]} (${hours}시간)`} />
        <Row k="차단 구간" v={`${formatTime(r.start_at)} – ${formatTime(r.blocked_until)} · 청소 포함`} tone="text-amber" />
      </section>
      <section className="flex flex-col gap-2.5">
        <h3 className="text-label font-medium text-ink-3">예약자</h3>
        <Row k="이름" v={r.guest_name} />
        <Row k="연락처" v={r.guest_phone ?? "–"} />
        <Row k="이메일" v={r.user_email ?? "–"} />
      </section>
      <section className="flex flex-col gap-2.5">
        <h3 className="text-label font-medium text-ink-3">결제</h3>
        <Row k="결제 금액" v={<span className="text-heading-s font-bold">{formatWon(r.total_price)}</span>} />
        <Row k="결제 수단" v={r.payment?.provider === "MOCK" ? "모의 결제" : r.payment?.provider ?? "–"} />
        <Row k="결제 일시" v={r.payment ? dateTime(r.payment.paid_at) : "–"} />
        {r.payment?.refunded_at && <Row k="환불 일시" v={dateTime(r.payment.refunded_at)} tone="text-danger" />}
        {r.cancelled_at && <Row k="취소" v={`${dateTime(r.cancelled_at)} · ${r.cancelled_by === "ADMIN" ? "관리자" : "손님"}`} tone="text-danger" />}
      </section>
      <div className="flex-1" />
      {cancellable && (
        <p className="flex gap-2 rounded-md bg-canvas p-3 text-caption text-ink-2">
          <Clock className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          관리자는 이용 시작 전까지 언제든 취소할 수 있어요. 취소하면 해당 시간이 바로 예약 가능 상태가 돼요.
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" size="m" className="flex-1" onClick={onClose}>닫기</Button>
        {cancellable && <Button variant="danger" size="m" className="flex-1" onClick={() => setConfirming(true)}>예약 취소</Button>}
      </div>
      <ConfirmDialog open={confirming} tone="danger" title="이 예약을 취소할까요?" confirmLabel="취소하기" loading={cancel.isPending}
        body={`${r.guest_name} · ${formatAdminRange(r.start_at, r.end_at)}. 결제 금액은 환불 처리돼요.`}
        onConfirm={doCancel} onClose={() => setConfirming(false)} />
    </aside>
  );
}
