import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarMonth, type DayState } from "./CalendarMonth";

const setup = (dayState = (d: string): DayState => (d === "2026-10-27" ? "soldout" : d === "2026-10-23" ? "selected" : "default")) => {
  const onSelect = vi.fn();
  render(
    <CalendarMonth year={2026} month={10} today="2026-10-19" dayState={dayState} onSelect={onSelect}
      onMonthChange={vi.fn()} canPrev={false} canNext />,
  );
  return { onSelect, grid: () => screen.getByRole("table", { name: "2026년 10월" }) };
};

describe("CalendarMonth", () => {
  it("is a native table with weekday column headers and one button per day", () => {
    const { grid } = setup();
    expect(within(grid()).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(grid()).getAllByRole("button", { name: /^\d+, 10월 \d+일/ })).toHaveLength(31);
  });

  it("names each day starting with its visible number (label in name)", () => {
    const { grid } = setup();
    expect(within(grid()).getByRole("button", { name: "23, 10월 23일 금요일, 선택됨" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grid()).getByRole("button", { name: "27, 10월 27일 화요일, 예약 마감" })).toHaveAttribute("aria-disabled", "true");
    expect(within(grid()).getByRole("button", { name: "19, 10월 19일 월요일, 오늘" })).toHaveAttribute("aria-current", "date");
  });

  it("keeps month buttons focusable at the range limits", () => {
    setup();
    const prev = screen.getByRole("button", { name: "이전 달" });
    expect(prev).toHaveAttribute("aria-disabled", "true");
    expect(prev).not.toBeDisabled();
  });

  it("ignores clicks on sold-out days and reports clicks on open days", async () => {
    const { onSelect, grid } = setup();
    await userEvent.click(within(grid()).getByRole("button", { name: /^27, / }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(within(grid()).getByRole("button", { name: /^24, / }));
    expect(onSelect).toHaveBeenCalledWith("2026-10-24");
  });
});
