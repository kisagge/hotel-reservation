import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, json } from "@/test/fakeApi";
import { ROOM } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { BookingScreen } from "./BookingScreen";

let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/book",
}));

describe("BookingScreen URL robustness", () => {
  it.each(["tab=stay&m=2026-11x", "tab=stay&m=2026-13", "tab=dayuse&date=2026-02-31&hour=abc"])("survives a hand-edited URL: %s", async (qs) => {
    search = qs;
    fakeApi({
      "GET /api/room": () => json(ROOM),
      "GET /api/availability/stay": () => json({ month: "2026-10", days: [] }),
      "GET /api/availability/dayuse": () => json({ date: "2026-10-19", slots: [] }),
    });
    renderWithProviders(<BookingScreen />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^\d{4}년 (1[0-2]|[1-9])월$/ })).toBeInTheDocument();
  });
});
