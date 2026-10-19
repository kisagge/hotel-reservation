import { describe, expect, it } from "vitest";
import { EMPTY_RANGE, nightsOf, stayRangeReducer, type StayRange } from "./stayRange";

const isAvailable = (d: string) => d !== "2026-10-27";
const pick = (state: StayRange, date: string, maxNights = 7) =>
  stayRangeReducer(state, { type: "pick", date, isAvailable, maxNights });

describe("stayRangeReducer", () => {
  it("first pick sets check-in", () => {
    expect(pick(EMPTY_RANGE, "2026-10-23")).toEqual({ checkIn: "2026-10-23", checkOut: null });
  });

  it("later pick completes the range", () => {
    const r = pick(pick(EMPTY_RANGE, "2026-10-23"), "2026-10-25");
    expect(r).toEqual({ checkIn: "2026-10-23", checkOut: "2026-10-25" });
    expect(nightsOf(r)).toBe(2);
  });

  it("an earlier or same day restarts check-in", () => {
    const start = pick(EMPTY_RANGE, "2026-10-23");
    expect(pick(start, "2026-10-21")).toEqual({ checkIn: "2026-10-21", checkOut: null });
    expect(pick(start, "2026-10-23")).toEqual({ checkIn: "2026-10-23", checkOut: null });
  });

  it("cannot span a sold-out night", () => {
    expect(pick(pick(EMPTY_RANGE, "2026-10-26"), "2026-10-28")).toEqual({ checkIn: "2026-10-28", checkOut: null });
  });

  it("checking out on a sold-out day is fine (no night is spent there)", () => {
    expect(pick(pick(EMPTY_RANGE, "2026-10-25"), "2026-10-27")).toEqual({ checkIn: "2026-10-25", checkOut: "2026-10-27" });
  });

  it("cannot exceed max nights", () => {
    expect(pick(pick(EMPTY_RANGE, "2026-11-01"), "2026-11-10")).toEqual({ checkIn: "2026-11-10", checkOut: null });
    expect(nightsOf(pick(pick(EMPTY_RANGE, "2026-11-01"), "2026-11-08"))).toBe(7);
  });

  it("a pick after a complete range starts over", () => {
    const full = pick(pick(EMPTY_RANGE, "2026-10-23"), "2026-10-25");
    expect(pick(full, "2026-10-29")).toEqual({ checkIn: "2026-10-29", checkOut: null });
  });

  it("nightsOf is null until complete", () => {
    expect(nightsOf(EMPTY_RANGE)).toBeNull();
    expect(nightsOf({ checkIn: "2026-10-23", checkOut: null })).toBeNull();
  });
});
