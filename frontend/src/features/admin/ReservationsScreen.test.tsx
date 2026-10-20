import { screen, waitFor } from "@testing-library/react";
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
