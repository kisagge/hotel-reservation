import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { Reservation } from "@/lib/api/queries";
import { formatDateKo, formatRange, formatTime, formatWon } from "@/lib/format";
import { kstParts } from "@/lib/time";

const at = (iso: string) => `${formatDateKo(kstParts(iso).ymd)} ${formatTime(iso)}`;

function detail(r: Reservation): string {
  const hours = Math.round((Date.parse(r.end_at) - Date.parse(r.start_at)) / 3_600_000);
  const base = r.type === "DAYUSE" ? `대실 ${hours}시간` : `${r.nights}박 · 체크인 ${formatTime(r.start_at)} / 체크아웃 ${formatTime(r.end_at)}`;
  return r.cancelled_at ? `${base} · ${formatDateKo(kstParts(r.cancelled_at).ymd)} 취소` : base;
}

/** One reservation card of G5 (Figma 8:201). */
export function ReservationCard({ r, onCancel }: { r: Reservation; onCancel: (r: Reservation) => void }) {
  const upcoming = r.display_status === "CONFIRMED";
  const kind = r.type === "STAY" ? "STAY" : "DAYUSE";
  return (
    <article className={cn("flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4", r.display_status === "CANCELLED" && "opacity-[.72]")}>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5"><Badge kind={kind} /><Badge kind={r.display_status} /></div>
        <span className="text-caption text-ink-3">{r.code}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-heading-m font-bold">{formatRange(r.start_at, r.end_at)}</h3>
        <p className="text-body-m text-ink-2">{detail(r)}</p>
      </div>
      <hr className="border-line" />
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-heading-s font-bold">{formatWon(r.total_price)}</span>
          {upcoming && (
            <span className="text-caption text-ink-3">
              {r.can_cancel && r.cancel_deadline_at ? `${at(r.cancel_deadline_at)}까지 무료 취소` : "취소 가능 시간이 지났어요"}
            </span>
          )}
        </div>
        {upcoming && r.can_cancel && <Button variant="danger" size="m" onClick={() => onCancel(r)}>예약 취소</Button>}
        {r.display_status === "COMPLETED" && (
          <Link href={`/book?tab=${r.type === "STAY" ? "stay" : "dayuse"}`}
            className="flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-label font-medium hover:bg-canvas">
            다시 예약
          </Link>
        )}
      </div>
    </article>
  );
}
