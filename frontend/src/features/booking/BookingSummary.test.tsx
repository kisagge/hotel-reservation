import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DAYUSE_QUOTE } from "@/test/fixtures";
import { BookingSummary } from "./BookingSummary";

describe("BookingSummary", () => {
  it("explains an unavailable range without implying someone just booked it", () => {
    const quote = { ...DAYUSE_QUOTE, type: "STAY" as const, available: false, reason: "SLOT_UNAVAILABLE" as const };
    render(<BookingSummary caption="10.28 → 11.02" title="5박" quote={quote} loading={false} href="/checkout" hint="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("선택한 기간에 예약할 수 없는 날이 있어요");
    expect(screen.queryByText(/방금 다른 예약/)).toBeNull();
  });

  it("uses slot wording for day-use", () => {
    const quote = { ...DAYUSE_QUOTE, type: "DAYUSE" as const, available: false, reason: "SLOT_UNAVAILABLE" as const };
    render(<BookingSummary caption="c" title="t" quote={quote} loading={false} href="/checkout" hint="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("이미 예약된 시간이에요");
  });
});
