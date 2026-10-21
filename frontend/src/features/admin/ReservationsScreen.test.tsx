import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, json } from "@/test/fakeApi";
import { renderWithProviders } from "@/test/render";
import { ReservationsScreen } from "./ReservationsScreen";

// A tiny URL store so router.replace re-renders like the real App Router does.
const nav = vi.hoisted(() => {
  let search = "";
  const subs = new Set<() => void>();
  return {
    replace: vi.fn((url: string) => { search = url.split("?")[1] ?? ""; subs.forEach((f) => f()); }),
    get: () => search,
    reset: () => { search = ""; },
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  };
});
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => ({ replace: nav.replace, push: nav.replace }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(nav.subscribe, nav.get)),
    usePathname: () => "/admin/reservations",
  };
});

const EMPTY = { items: [], total: 0, page: 1, size: 20 };
const lastUrl = () => new URLSearchParams(nav.get());

beforeEach(() => { nav.replace.mockClear(); nav.reset(); });

describe("ReservationsScreen", () => {
  it("keeps a filter changed while the search debounce is pending", async () => {
    fakeApi({ "GET /api/admin/reservations": () => json(EMPTY) });
    renderWithProviders(<ReservationsScreen />);
    await userEvent.type(screen.getByLabelText("예약 검색"), "김하");
    await userEvent.selectOptions(screen.getByLabelText("유형"), "STAY");
    await waitFor(() => expect(lastUrl().get("q")).toBe("김하"));
    expect(lastUrl().get("type")).toBe("STAY");
  });

  it("says so when the list fails to load, with a retry", async () => {
    const api = fakeApi({ "GET /api/admin/reservations": () => json({ detail: "BOOM" }, 500) });
    renderWithProviders(<ReservationsScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent("예약 목록을 불러오지 못했어요");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(api.count("GET /api/admin/reservations")).toBe(2));
  });

  it("flags a start date after the end date instead of showing an empty list", async () => {
    nav.replace("/admin/reservations?from=2026-11-10&to=2026-11-01");
    const api = fakeApi({ "GET /api/admin/reservations": () => json(EMPTY) });
    renderWithProviders(<ReservationsScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent("시작일이 종료일보다 늦어요");
    expect(api.count("GET /api/admin/reservations")).toBe(0);
  });
});

describe("ReservationsScreen · calendar view", () => {
  const OCC = [
    { id: 1, type: "DAYUSE", start_at: "2026-10-23T10:00:00+09:00", end_at: "2026-10-23T14:00:00+09:00",
      blocked_until: "2026-10-23T15:00:00+09:00", guest_name: "이서연", block_reason: null },
    { id: 9, type: "BLOCK", start_at: "2026-10-23T18:00:00+09:00", end_at: "2026-10-24T00:00:00+09:00",
      blocked_until: "2026-10-24T00:00:00+09:00", guest_name: "", block_reason: "보일러 점검" },
  ];

  it("switches from the list to the calendar", async () => {
    fakeApi({ "GET /api/admin/reservations": () => json(EMPTY), "GET /api/admin/occupancy": () => json([]) });
    renderWithProviders(<ReservationsScreen />);
    await userEvent.click(screen.getByRole("button", { name: "캘린더" }));
    expect(lastUrl().get("view")).toBe("calendar");
    expect(await screen.findByRole("button", { name: "캘린더" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows the selected day's timeline and bookings, and opens a booking's detail", async () => {
    nav.replace("/admin/reservations?view=calendar&m=2026-10&day=2026-10-23");
    let query = "";
    fakeApi({
      "GET /api/admin/occupancy": (req) => { query = new URL(req.url).search; return json(OCC); },
      "GET /api/admin/reservations/1": () => json({ detail: "NOT_FOUND" }, 404),
    });
    renderWithProviders(<ReservationsScreen />);
    const panel = await screen.findByRole("region", { name: "10월 23일 (금)" });
    expect(query).toBe("?date_from=2026-10-01&date_to=2026-10-31");
    expect(await within(panel).findByRole("list", { name: "시간대별 객실 상태" })).toBeInTheDocument();
    const dayList = within(panel).getByRole("list", { name: "이날 일정" });
    expect(within(dayList).getByText("차단 · 보일러 점검")).toBeInTheDocument();
    expect(within(dayList).getAllByRole("button")).toHaveLength(1); // blocks have no booking detail
    await userEvent.click(within(dayList).getByRole("button", { name: /이서연/ }));
    expect(lastUrl().get("id")).toBe("1");
    expect(lastUrl().get("view")).toBe("calendar");
  });
});
