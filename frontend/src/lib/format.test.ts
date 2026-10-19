import { describe, expect, it } from "vitest";
import { formatAdminRange, formatDateKo, formatRange, formatShortDate, formatTime, formatWon } from "./format";

describe("format", () => {
  it("formatWon", () => {
    expect(formatWon(178000)).toBe("178,000원");
    expect(formatWon(0)).toBe("0원");
  });

  it("dates in Korean", () => {
    expect(formatDateKo("2026-10-23")).toBe("10월 23일 (금)");
    expect(formatShortDate("2026-10-23")).toBe("10.23 (금)");
  });

  it("formatTime shows KST wall clock", () => {
    expect(formatTime("2026-10-23T15:00:00+09:00")).toBe("15:00");
    expect(formatTime("2026-10-23T15:00:00Z")).toBe("00:00");
  });

  it("formatRange same day vs multi day", () => {
    expect(formatRange("2026-10-23T15:00:00+09:00", "2026-10-23T19:00:00+09:00")).toBe("10월 23일 (금) 15:00 ~ 19:00");
    expect(formatRange("2026-10-23T15:00:00+09:00", "2026-10-25T11:00:00+09:00")).toBe("10월 23일 (금) → 10월 25일 (일)");
  });

  it("day-use ending at midnight stays a same-day range", () => {
    expect(formatRange("2026-10-23T20:00:00+09:00", "2026-10-24T00:00:00+09:00")).toBe("10월 23일 (금) 20:00 ~ 24:00");
  });

  it("formatAdminRange", () => {
    expect(formatAdminRange("2026-10-19T12:00:00+09:00", "2026-10-19T16:00:00+09:00")).toBe("10/19 (월) 12:00 – 16:00");
    expect(formatAdminRange("2026-10-20T15:00:00+09:00", "2026-10-21T11:00:00+09:00")).toBe("10/20 (화) 15:00 → 10/21 11:00");
  });
});
