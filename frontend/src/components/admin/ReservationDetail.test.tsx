import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, json } from "@/test/fakeApi";
import { renderWithProviders } from "@/test/render";
import { ReservationDetail } from "./ReservationDetail";

const detail = (o: object = {}) => ({
  id: 5, code: "HR-1023-0005", type: "DAYUSE", status: "CONFIRMED", display_status: "CONFIRMED",
  start_at: "2099-10-23T15:00:00+09:00", end_at: "2099-10-23T19:00:00+09:00", blocked_until: "2099-10-23T20:00:00+09:00",
  nights: null, guest_name: "김하루", guest_phone: "010-1234-5678", total_price: 35000, created_at: "2026-10-19T09:00:00+09:00",
  cancelled_at: null, cancel_deadline_at: "2099-10-22T15:00:00+09:00", can_cancel: true, user_email: null, cancelled_by: null,
  payment: { provider: "MOCK", amount: 35000, status: "PAID", paid_at: "2026-10-19T09:00:00+09:00", refunded_at: null }, ...o,
});

describe("ReservationDetail", () => {
  it("offers 일정 변경 for a booking that has not started", async () => {
    fakeApi({ "GET /api/admin/reservations/5": () => json(detail()) });
    const onReschedule = vi.fn();
    renderWithProviders(<ReservationDetail id={5} onClose={() => {}} onReschedule={onReschedule} />);
    await userEvent.click(await screen.findByRole("button", { name: "일정 변경" }));
    expect(onReschedule).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it("does not offer it once the stay has started or was cancelled", async () => {
    const started = detail({ start_at: "2020-10-23T15:00:00+09:00", end_at: "2099-10-23T19:00:00+09:00" });
    fakeApi({ "GET /api/admin/reservations/5": () => json(started) });
    renderWithProviders(<ReservationDetail id={5} onClose={() => {}} onReschedule={() => {}} />);
    await screen.findByRole("heading", { name: "HR-1023-0005" });
    expect(screen.queryByRole("button", { name: "일정 변경" })).toBeNull();
  });
});
