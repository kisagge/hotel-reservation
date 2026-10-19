import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Reservation } from "@/lib/api/queries";
import { ReservationTable } from "./ReservationTable";

const r: Reservation = {
  id: 12, code: "HR-1023-0012", type: "DAYUSE", status: "CONFIRMED", display_status: "CONFIRMED",
  start_at: "2026-10-23T20:00:00+09:00", end_at: "2026-10-24T00:00:00+09:00", blocked_until: "2026-10-24T01:00:00+09:00",
  nights: null, guest_name: "김하루", guest_phone: null, total_price: 35000, created_at: "2026-10-19T09:00:00+09:00",
  cancelled_at: null, cancel_deadline_at: null, can_cancel: false,
};

describe("ReservationTable", () => {
  it("is a native table whose rows can be opened from the keyboard", async () => {
    const onRowClick = vi.fn();
    render(<ReservationTable items={[r]} onRowClick={onRowClick} selectedId={null} />);
    expect(screen.getByRole("table", { name: "예약 목록" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    const open = screen.getByRole("button", { name: "HR-1023-0012 상세 보기" });
    open.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith(r);
  });

  it("marks the selected row", () => {
    render(<ReservationTable items={[r]} onRowClick={vi.fn()} selectedId={12} />);
    expect(screen.getByRole("button", { name: "HR-1023-0012 상세 보기" })).toHaveAttribute("aria-current", "true");
  });
});
