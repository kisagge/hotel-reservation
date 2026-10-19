import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import type { Reservation } from "@/lib/api/queries";
import { formatAdminRange, formatWon } from "@/lib/format";

const HEAD = ["예약번호", "유형", "이용 일시", "예약자", "금액", "상태"];
const WIDTHS = ["w-[132px]", "w-[64px]", "", "w-[72px]", "w-[96px]", "w-[80px]"];

/** A1 "다가오는 예약" / A2 list. Native table; the reservation code is the keyboard-reachable row action. */
export function ReservationTable({ items, onRowClick, selectedId, empty = "예약이 없어요" }: {
  items: Reservation[]; onRowClick?: (r: Reservation) => void; selectedId?: number | null; empty?: string;
}) {
  return (
    <table aria-label="예약 목록" className="w-full table-fixed border-collapse text-left">
      <thead>
        <tr className="bg-muted text-label font-medium text-ink-2">
          {HEAD.map((h, i) => (
            <th key={h} scope="col" className={cn("px-2 py-2.5 font-medium first:rounded-l-sm first:pl-4 last:rounded-r-sm", WIDTHS[i])}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr><td colSpan={6} className="py-10 text-center text-body-m text-ink-3">{empty}</td></tr>
        )}
        {items.map((r) => {
          const selected = r.id === selectedId;
          return (
            <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn("border-b border-line text-body-m", onRowClick && "cursor-pointer hover:bg-canvas", selected && "bg-pine-soft hover:bg-pine-soft")}>
              <th scope="row" className="py-3.5 pl-4 pr-2 font-medium">
                {onRowClick ? (
                  <button type="button" aria-current={selected || undefined} aria-label={`${r.code} 상세 보기`}
                    onClick={(e) => { e.stopPropagation(); onRowClick(r); }} className="rounded-sm text-left underline-offset-2 hover:underline">
                    {r.code}
                  </button>
                ) : r.code}
              </th>
              <td className="px-2"><Badge kind={r.type === "STAY" ? "STAY" : "DAYUSE"} /></td>
              <td className="truncate px-2">{formatAdminRange(r.start_at, r.end_at)}</td>
              <td className="truncate px-2">{r.guest_name}</td>
              <td className="px-2">{formatWon(r.total_price)}</td>
              <td className="px-2"><Badge kind={r.display_status} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
