import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import type { Reservation } from "@/lib/api/queries";
import { formatAdminRange, formatWon } from "@/lib/format";

const COLS = "grid grid-cols-[120px_64px_minmax(0,1fr)_72px_96px_76px] items-center gap-2 px-4";

/** A1 "다가오는 예약" / A2 list table. */
export function ReservationTable({ items, onRowClick, selectedId, empty = "예약이 없어요" }: {
  items: Reservation[]; onRowClick?: (r: Reservation) => void; selectedId?: number | null; empty?: string;
}) {
  return (
    <div role="table" aria-label="예약 목록" className="flex flex-col">
      <div role="row" className={cn(COLS, "rounded-sm bg-muted py-2.5 text-label font-medium text-ink-2")}>
        {["예약번호", "유형", "이용 일시", "예약자", "금액", "상태"].map((h) => <span key={h} role="columnheader">{h}</span>)}
      </div>
      {items.length === 0 && <p className="py-10 text-center text-body-m text-ink-3">{empty}</p>}
      {items.map((r) => (
        <div key={r.id} role="row" aria-selected={r.id === selectedId || undefined}
          onClick={onRowClick ? () => onRowClick(r) : undefined}
          className={cn(COLS, "border-b border-line py-3.5 text-body-m", onRowClick && "cursor-pointer hover:bg-canvas",
            r.id === selectedId && "rounded-sm border-transparent bg-pine-soft hover:bg-pine-soft")}>
          <span role="cell" className="font-medium">{r.code}</span>
          <span role="cell"><Badge kind={r.type === "STAY" ? "STAY" : "DAYUSE"} /></span>
          <span role="cell" className="truncate">{formatAdminRange(r.start_at, r.end_at)}</span>
          <span role="cell" className="truncate">{r.guest_name}</span>
          <span role="cell">{formatWon(r.total_price)}</span>
          <span role="cell"><Badge kind={r.display_status} /></span>
        </div>
      ))}
    </div>
  );
}
