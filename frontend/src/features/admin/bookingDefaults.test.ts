import { describe, expect, it } from "vitest";
import { defaultSlot } from "./bookingDefaults";

const RULES = { dayuse_first_start_hour: 10, dayuse_last_start_hour: 20 };

describe("defaultSlot (예약 추가 starts on a slot that is still in the future)", () => {
  it("is today's first hour before opening", () => {
    expect(defaultSlot(RULES, { ymd: "2026-10-21", hour: 8, minute: 30 })).toEqual({ date: "2026-10-21", hour: 10 });
  });

  it("is the next whole hour later in the day", () => {
    expect(defaultSlot(RULES, { ymd: "2026-10-21", hour: 12, minute: 15 })).toEqual({ date: "2026-10-21", hour: 13 });
    expect(defaultSlot(RULES, { ymd: "2026-10-21", hour: 12, minute: 0 })).toEqual({ date: "2026-10-21", hour: 13 });
  });

  it("is tomorrow's first hour once today's last start has passed", () => {
    expect(defaultSlot(RULES, { ymd: "2026-10-21", hour: 20, minute: 5 })).toEqual({ date: "2026-10-22", hour: 10 });
    expect(defaultSlot(RULES, { ymd: "2026-12-31", hour: 23, minute: 0 })).toEqual({ date: "2027-01-01", hour: 10 });
  });
});
