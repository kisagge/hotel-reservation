import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminCalendar } from "./AdminCalendar";

const ITEMS = [
  { id: 1, type: "DAYUSE" as const, start_at: "2026-10-23T10:00:00+09:00", end_at: "2026-10-23T14:00:00+09:00",
    blocked_until: "2026-10-23T15:00:00+09:00", guest_name: "이서연", block_reason: null },
  { id: 2, type: "STAY" as const, start_at: "2026-10-23T15:00:00+09:00", end_at: "2026-10-24T11:00:00+09:00",
    blocked_until: "2026-10-24T12:00:00+09:00", guest_name: "박준호", block_reason: null },
];

describe("AdminCalendar", () => {
  it("is a month table whose day buttons summarize the day", async () => {
    const onSelect = vi.fn();
    render(<AdminCalendar month="2026-10" today="2026-10-21" selected="2026-10-23" items={ITEMS}
      onSelect={onSelect} onMonthChange={() => {}} />);
    const table = screen.getByRole("table", { name: "2026년 10월" });
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
    const day23 = within(table).getByRole("button", { name: "23, 10월 23일 금요일, 대실 1건, 숙박 1건" });
    expect(day23).toHaveAttribute("aria-pressed", "true");
    expect(day23.closest("td")).toHaveTextContent("이서연");
    expect(within(table).getByRole("button", { name: "21, 10월 21일 수요일, 오늘, 일정 없음" })).toHaveAttribute("aria-current", "date");
    await userEvent.click(within(table).getByRole("button", { name: /^24, 10월 24일/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-10-24");
  });

  it("moves between months", async () => {
    const onMonthChange = vi.fn();
    render(<AdminCalendar month="2026-10" today="2026-10-21" selected={null} items={[]} onSelect={() => {}} onMonthChange={onMonthChange} />);
    await userEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-11");
    await userEvent.click(screen.getByRole("button", { name: "이전 달" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-09");
  });
});
