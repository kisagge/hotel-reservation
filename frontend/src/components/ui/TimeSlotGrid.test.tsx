import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimeSlotGrid } from "./TimeSlotGrid";

const slots = [
  { start_hour: 14, end_hour: 18, available: false },
  { start_hour: 15, end_hour: 19, available: true },
];

describe("TimeSlotGrid", () => {
  it("shows 마감 for unavailable slots and ignores clicks on them", async () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={slots} selected={null} onSelect={onSelect} />);
    const closed = screen.getByRole("button", { name: /14:00/ });
    expect(closed).toHaveTextContent("마감");
    expect(closed).toBeDisabled();
    await userEvent.click(closed);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects an available slot and shows its end time", async () => {
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={slots} selected={null} onSelect={onSelect} />);
    const open = screen.getByRole("button", { name: /15:00/ });
    expect(open).toHaveTextContent("~19:00");
    await userEvent.click(open);
    expect(onSelect).toHaveBeenCalledWith(15);
  });

  it("marks the selected slot as pressed", () => {
    render(<TimeSlotGrid slots={slots} selected={15} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /15:00/ })).toHaveAttribute("aria-pressed", "true");
  });
});
