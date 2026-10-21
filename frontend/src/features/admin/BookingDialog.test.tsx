import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminReservation } from "@/lib/api/adminQueries";
import { fakeApi, json } from "@/test/fakeApi";
import { ROOM } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { BookingDialog } from "./BookingDialog";

const quote = (o: object = {}) => ({
  type: "DAYUSE", start_at: "2026-10-23T15:00:00+09:00", end_at: "2026-10-23T19:00:00+09:00", nights: null,
  lines: [{ label: "대실 · 평일 4시간", amount: 35000 }], total: 35000, available: true, reason: null, ...o,
});
const RES = {
  id: 5, code: "HR-1023-0005", type: "DAYUSE", status: "CONFIRMED", display_status: "CONFIRMED",
  start_at: "2026-10-23T15:00:00+09:00", end_at: "2026-10-23T19:00:00+09:00", blocked_until: "2026-10-23T20:00:00+09:00",
  nights: null, guest_name: "김하루", guest_phone: "010-1234-5678", total_price: 35000, created_at: "2026-10-19T09:00:00+09:00",
  cancelled_at: null, cancel_deadline_at: "2026-10-22T15:00:00+09:00", can_cancel: true, user_email: null, cancelled_by: null,
  payment: null,
} as AdminReservation;

async function fillDayUse(dialog: HTMLElement, date: string, hour: string) {
  fireEvent.change(within(dialog).getByLabelText("날짜"), { target: { value: date } });
  await userEvent.selectOptions(within(dialog).getByLabelText("입실 시간"), hour);
}

describe("BookingDialog", () => {
  it("creates a walk-in booking after showing its price", async () => {
    let sent: unknown;
    fakeApi({
      "GET /api/room": () => json(ROOM),
      "POST /api/admin/quotes": () => json(quote()),
      "POST /api/admin/reservations": async (req) => { sent = await req.json(); return json({ ...RES, id: 7 }, 201); },
    });
    const onDone = vi.fn();
    renderWithProviders(<BookingDialog open mode={{ kind: "create" }} onClose={() => {}} onDone={onDone} />);
    const dialog = await screen.findByRole("dialog", { name: "예약 추가" });
    await fillDayUse(dialog, "2026-10-23", "15");
    await userEvent.type(within(dialog).getByLabelText("예약자 이름"), "현장손님");
    await userEvent.type(within(dialog).getByLabelText("연락처"), "010-2222-3333");
    expect(await within(dialog).findByText("35,000원")).toBeInTheDocument();
    const create = within(dialog).getByRole("button", { name: "예약 만들기" });
    await waitFor(() => expect(create).toBeEnabled()); // enabled once the quote for the final input is in
    await userEvent.click(create);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 7 })));
    expect(sent).toEqual({ type: "DAYUSE", date: "2026-10-23", start_hour: 15, guest_name: "현장손님", guest_phone: "010-2222-3333" });
  });

  it("asks for stay dates and nights when 숙박 is chosen", async () => {
    let sent: unknown;
    fakeApi({
      "GET /api/room": () => json(ROOM),
      "POST /api/admin/quotes": async (req) => { sent = await req.json(); return json(quote({ type: "STAY", nights: 2, total: 178000 })); },
    });
    renderWithProviders(<BookingDialog open mode={{ kind: "create" }} onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "예약 추가" });
    await userEvent.click(within(dialog).getByRole("button", { name: "숙박" }));
    fireEvent.change(within(dialog).getByLabelText("체크인 날짜"), { target: { value: "2026-10-23" } });
    await userEvent.selectOptions(within(dialog).getByLabelText("박 수"), "2");
    expect(await within(dialog).findByText("178,000원")).toBeInTheDocument();
    expect(sent).toEqual({ type: "STAY", check_in: "2026-10-23", nights: 2 });
  });

  it("reschedules, quoting without the booking itself and showing the price difference", async () => {
    let quoteUrl = "";
    let sent: unknown;
    const onDone = vi.fn();
    fakeApi({
      "GET /api/room": () => json(ROOM),
      "POST /api/admin/quotes": (req) => {
        quoteUrl = req.url;
        return json(quote({ total: 45000, start_at: "2026-10-24T12:00:00+09:00", end_at: "2026-10-24T16:00:00+09:00" }));
      },
      "POST /api/admin/reservations/5/reschedule": async (req) => { sent = await req.json(); return json({ ...RES, total_price: 45000 }); },
    });
    renderWithProviders(<BookingDialog open mode={{ kind: "reschedule", reservation: RES }} onClose={() => {}} onDone={onDone} />);
    const dialog = await screen.findByRole("dialog", { name: "일정 변경" });
    expect(within(dialog).getByText(/김하루/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("예약자 이름")).toBeNull();
    expect(within(dialog).getByLabelText("날짜")).toHaveValue("2026-10-23");
    await waitFor(() => expect(within(dialog).getByLabelText("입실 시간")).toHaveValue("15")); // options come with the room rules
    await fillDayUse(dialog, "2026-10-24", "12");
    expect(await within(dialog).findByText("45,000원")).toBeInTheDocument();
    expect(within(dialog).getByText("기존 35,000원 · +10,000원")).toBeInTheDocument();
    expect(new URL(quoteUrl).searchParams.get("exclude_id")).toBe("5");
    const move = within(dialog).getByRole("button", { name: "일정 변경하기" });
    await waitFor(() => expect(move).toBeEnabled());
    await userEvent.click(move);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sent).toEqual({ type: "DAYUSE", date: "2026-10-24", start_hour: 12 });
  });

  it("explains a taken slot and keeps the submit button disabled", async () => {
    fakeApi({ "GET /api/room": () => json(ROOM), "POST /api/admin/quotes": () => json(quote({ available: false, reason: "SLOT_UNAVAILABLE" })) });
    renderWithProviders(<BookingDialog open mode={{ kind: "reschedule", reservation: RES }} onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "일정 변경" });
    expect(await within(dialog).findByText("선택한 일정에 다른 예약이나 차단 일정이 있어요")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "일정 변경하기" })).toBeDisabled();
  });

  it("shows a rejection from the server inside the dialog", async () => {
    fakeApi({
      "GET /api/room": () => json(ROOM),
      "POST /api/admin/quotes": () => json(quote({ start_at: "2026-10-23T16:00:00+09:00", end_at: "2026-10-23T20:00:00+09:00" })),
      "POST /api/admin/reservations/5/reschedule": () => json({ detail: "RESERVATION_STARTED" }, 409),
    });
    const onDone = vi.fn();
    renderWithProviders(<BookingDialog open mode={{ kind: "reschedule", reservation: RES }} onClose={() => {}} onDone={onDone} />);
    const dialog = await screen.findByRole("dialog", { name: "일정 변경" });
    await within(dialog).findByText("35,000원");
    const move = within(dialog).getByRole("button", { name: "일정 변경하기" });
    await waitFor(() => expect(move).toBeEnabled());
    await userEvent.click(move);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("이미 시작된 예약이에요");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("does not submit a reschedule that keeps the current schedule", async () => {
    fakeApi({ "GET /api/room": () => json(ROOM), "POST /api/admin/quotes": () => json(quote()) });
    renderWithProviders(<BookingDialog open mode={{ kind: "reschedule", reservation: RES }} onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "일정 변경" });
    expect(await within(dialog).findByText("지금 일정과 같아요")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "일정 변경하기" })).toBeDisabled();
  });

  it("cannot be dismissed while the request is in flight", async () => {
    fakeApi({
      "GET /api/room": () => json(ROOM),
      "POST /api/admin/quotes": () => json(quote({ start_at: "2026-10-23T16:00:00+09:00", end_at: "2026-10-23T20:00:00+09:00" })),
      "POST /api/admin/reservations/5/reschedule": () => new Promise<Response>(() => {}),
    });
    const onClose = vi.fn();
    renderWithProviders(<BookingDialog open mode={{ kind: "reschedule", reservation: RES }} onClose={onClose} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "일정 변경" });
    const move = within(dialog).getByRole("button", { name: "일정 변경하기" });
    await waitFor(() => expect(move).toBeEnabled());
    await userEvent.click(move);
    await userEvent.keyboard("{Escape}");
    expect(within(dialog).getByRole("button", { name: "닫기" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("re-checks availability after the server rejects the slot", async () => {
    const api = fakeApi({
      "GET /api/room": () => json(ROOM),
      "POST /api/admin/quotes": () => json(quote({ start_at: "2026-10-23T16:00:00+09:00", end_at: "2026-10-23T20:00:00+09:00" })),
      "POST /api/admin/reservations/5/reschedule": () => json({ detail: "SLOT_UNAVAILABLE" }, 409),
    });
    renderWithProviders(<BookingDialog open mode={{ kind: "reschedule", reservation: RES }} onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "일정 변경" });
    const move = within(dialog).getByRole("button", { name: "일정 변경하기" });
    await waitFor(() => expect(move).toBeEnabled());
    const before = api.count("POST /api/admin/quotes");
    await userEvent.click(move);
    await within(dialog).findByRole("alert");
    await waitFor(() => expect(api.count("POST /api/admin/quotes")).toBeGreaterThan(before));
  });

  it("keeps the dialog open when a drag that started in a field ends on the backdrop", async () => {
    fakeApi({ "GET /api/room": () => json(ROOM), "POST /api/admin/quotes": () => json(quote()) });
    const onClose = vi.fn();
    renderWithProviders(<BookingDialog open mode={{ kind: "create" }} onClose={onClose} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "예약 추가" });
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(within(dialog).getByLabelText("예약자 이름"));
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
