import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarMonth, type DayState } from "./CalendarMonth";

const setup = (dayState = (d: string): DayState => (d === "2026-10-27" ? "soldout" : "default")) => {
  const onSelect = vi.fn();
  render(
    <CalendarMonth year={2026} month={10} today="2026-10-19" dayState={dayState} onSelect={onSelect}
      onMonthChange={vi.fn()} canPrev={false} canNext />,
  );
  return { onSelect };
};

describe("CalendarMonth", () => {
  it("renders every day of the month with a month title", () => {
    setup();
    expect(screen.getByText("2026년 10월")).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell", { name: /^10월 \d+일/ })).toHaveLength(31);
  });

  it("ignores clicks on sold-out days and reports clicks on open days", async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole("gridcell", { name: /^10월 27일/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("gridcell", { name: /^10월 23일/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-10-23");
  });

  it("marks today and sold-out days", () => {
    setup();
    expect(screen.getByRole("gridcell", { name: /^10월 19일/ })).toHaveAttribute("data-today", "true");
    expect(screen.getByRole("gridcell", { name: /^10월 27일/ })).toHaveAttribute("aria-disabled", "true");
  });
});
