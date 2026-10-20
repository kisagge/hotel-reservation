import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reservation } from "@/lib/api/queries";
import { fakeApi, json } from "@/test/fakeApi";
import { ROOM } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { MyReservationsScreen } from "./MyReservationsScreen";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: replace, replace }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/me/reservations",
}));

const r = (o: Partial<Reservation>): Reservation => ({
  id: 1, code: "HR-1023-0001", type: "DAYUSE", status: "CONFIRMED", display_status: "CONFIRMED",
  start_at: "2026-10-23T15:00:00+09:00", end_at: "2026-10-23T19:00:00+09:00", blocked_until: "2026-10-23T20:00:00+09:00",
  nights: null, guest_name: "김하루", guest_phone: "010-1234-5678", total_price: 35000,
  created_at: "2026-10-19T09:00:00+09:00", cancelled_at: null, cancel_deadline_at: "2026-10-22T15:00:00+09:00", can_cancel: true, ...o,
});

const ITEMS = [
  r({ id: 1 }),
  r({ id: 2, code: "HR-1107-0002", type: "STAY", nights: 1, start_at: "2026-11-07T15:00:00+09:00", end_at: "2026-11-08T11:00:00+09:00",
    total_price: 89000, can_cancel: false, cancel_deadline_at: "2026-11-06T15:00:00+09:00" }),
  r({ id: 3, code: "HR-1003-0003", display_status: "COMPLETED", start_at: "2026-10-03T13:00:00+09:00", end_at: "2026-10-03T17:00:00+09:00", can_cancel: false }),
  r({ id: 4, code: "HR-0920-0004", type: "STAY", status: "CANCELLED", display_status: "CANCELLED", nights: 1, can_cancel: false,
    start_at: "2026-09-20T15:00:00+09:00", end_at: "2026-09-21T11:00:00+09:00", cancelled_at: "2026-09-18T10:00:00+09:00" }),
];

beforeEach(() => { replace.mockReset(); search = ""; });

describe("MyReservationsScreen", () => {
  it("splits upcoming and past reservations", async () => {
    fakeApi({ "GET /api/reservations/me": () => json(ITEMS), "GET /api/room": () => json(ROOM) });
    renderWithProviders(<MyReservationsScreen />);
    const upcoming = await screen.findByRole("region", { name: /이용 예정 2/ });
    expect(within(upcoming).getByText("HR-1023-0001")).toBeInTheDocument();
    expect(within(upcoming).getByText("HR-1107-0002")).toBeInTheDocument();
    const past = screen.getByRole("region", { name: "지난 예약" });
    expect(within(past).getByText("HR-1003-0003")).toBeInTheDocument();
    expect(within(past).getByText("HR-0920-0004")).toBeInTheDocument();
  });

  it("shows the stored free-cancel deadline, or why cancelling is no longer possible", async () => {
    fakeApi({ "GET /api/reservations/me": () => json(ITEMS), "GET /api/room": () => json(ROOM) });
    renderWithProviders(<MyReservationsScreen />);
    const upcoming = await screen.findByRole("region", { name: /이용 예정/ });
    expect(within(upcoming).getByText("10월 22일 (목) 15:00까지 무료 취소")).toBeInTheDocument();
    expect(within(upcoming).getByText("취소 가능 시간이 지났어요")).toBeInTheDocument();
    expect(within(upcoming).getAllByRole("button", { name: "예약 취소" })).toHaveLength(1);
  });

  it("cancels after confirmation and refetches", async () => {
    const api = fakeApi({
      "GET /api/reservations/me": () => json(ITEMS),
      "GET /api/room": () => json(ROOM),
      "POST /api/reservations/1/cancel": () => json({ ...ITEMS[0], status: "CANCELLED", display_status: "CANCELLED", can_cancel: false }),
    });
    renderWithProviders(<MyReservationsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "예약 취소" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "취소하기" }));
    await waitFor(() => expect(api.count("POST /api/reservations/1/cancel")).toBe(1));
    expect(await screen.findByText("예약을 취소했어요")).toBeInTheDocument();
    expect(api.count("GET /api/reservations/me")).toBe(2);
  });

  it("announces a freshly created reservation once", async () => {
    search = "created=HR-1023-0001";
    fakeApi({ "GET /api/reservations/me": () => json(ITEMS), "GET /api/room": () => json(ROOM) });
    renderWithProviders(<MyReservationsScreen />);
    expect(await screen.findByText("예약이 확정됐어요 · HR-1023-0001")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/me/reservations", { scroll: false });
  });

  it("redirects to login when the session is no longer valid", async () => {
    fakeApi({ "GET /api/reservations/me": () => json({ detail: "NOT_AUTHENTICATED" }, 401), "GET /api/room": () => json(ROOM) });
    renderWithProviders(<MyReservationsScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fme%2Freservations"));
  });

  it("lets the guest log out", async () => {
    const api = fakeApi({ "GET /api/reservations/me": () => json(ITEMS), "GET /api/room": () => json(ROOM),
      "POST /api/auth/logout": () => new Response(null, { status: 204 }) });
    renderWithProviders(<MyReservationsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(api.count("POST /api/auth/logout")).toBe(1);
  });

  it("refreshes the list when a cancel fails (e.g. the deadline passed meanwhile)", async () => {
    const api = fakeApi({ "GET /api/reservations/me": () => json(ITEMS), "GET /api/room": () => json(ROOM),
      "POST /api/reservations/1/cancel": () => json({ detail: "CANCEL_DEADLINE_PASSED" }, 409) });
    renderWithProviders(<MyReservationsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "예약 취소" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "취소하기" }));
    expect(await screen.findByText("취소 가능 시간이 지났어요", { selector: "[role=status]" })).toBeInTheDocument();
    await waitFor(() => expect(api.count("GET /api/reservations/me")).toBe(2));
  });

  it("shows an empty state", async () => {
    fakeApi({ "GET /api/reservations/me": () => json([]), "GET /api/room": () => json(ROOM) });
    renderWithProviders(<MyReservationsScreen />);
    expect(await screen.findByText("아직 예약이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "예약하러 가기" })).toHaveAttribute("href", "/book?tab=dayuse");
  });
});
