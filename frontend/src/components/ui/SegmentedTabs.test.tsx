import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTabs } from "./SegmentedTabs";

describe("SegmentedTabs", () => {
  it("is a labelled group of toggle buttons", async () => {
    const onChange = vi.fn();
    render(<SegmentedTabs label="예약 유형" items={[{ value: "d", label: "대실" }, { value: "s", label: "숙박" }]} value="d" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "예약 유형" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "대실" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "숙박" }));
    expect(onChange).toHaveBeenCalledWith("s");
  });
});
