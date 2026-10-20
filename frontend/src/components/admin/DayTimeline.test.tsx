import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayTimeline } from "./DayTimeline";

describe("DayTimeline", () => {
  it("exposes every segment to screen readers, not only via title tooltips", () => {
    render(<DayTimeline day="2026-10-19" items={[
      { id: 1, type: "DAYUSE", start_at: "2026-10-19T12:00:00+09:00", end_at: "2026-10-19T16:00:00+09:00",
        blocked_until: "2026-10-19T17:00:00+09:00", guest_name: "이서연", block_reason: null },
    ]} />);
    const list = screen.getByRole("list", { name: "시간대별 객실 상태" });
    const items = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["예약 가능 00:00–12:00", "대실 12:00–16:00 · 이서연", "청소 16:00–17:00", "예약 가능 17:00–24:00"]);
  });
});
